// Lógica del juego: estado, generación de datos y simulación.
// Todo vive en el objeto global `Engine`. No usa módulos para poder
// abrirse el juego directamente con doble click (sin servidor).
//
// Estructura de la temporada (simplificada respecto al fútbol argentino real,
// para que sea manejable en un simulador chico):
// - Primera División: 30 clubes en 2 zonas de 15 (con 1 fecha libre por vuelta
//   ya que 15 es impar). Fase de zonas a una rueda -> playoffs de octavos a
//   la final con los 16 mejores de la tabla combinada ("tabla anual").
// - Primera Nacional: 36 clubes en 2 zonas de 18, fase de zonas a una rueda,
//   sin playoff propio.
// - Copa Argentina: eliminación directa simultánea a la liga, abierta a
//   clubes de ambas divisiones, con el rival sorteado al azar en cada ronda.
// - Fechas FIFA: pausan la liga y muestran si algún jugador destacado fue
//   convocado a su selección.
// - Cupos a copas internacionales: campeón del torneo -> Libertadores
//   (grupos); subcampeón del torneo y campeón de la Copa Argentina ->
//   Libertadores (previa); el resto de los cupos (1 Libertadores + 3
//   Sudamericana) se reparten por la tabla anual, salteando clubes que ya
//   clasificaron por otra vía (igual que en la vida real).

const SAVE_KEY = 'dt-simulador-save-v2';

const FIFA_ROUNDS = [5, 11];
const COPA_ROUNDS = [2, 4, 7, 10, 13];
const COPA_STAGE_NAMES = ['Dieciseisavos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];
const TRANSFER_ROUND = { D1: 8, D2: 9 }; // aprox. mitad de temporada de cada división
const TOTAL_ROUNDS = { D1: 15, D2: 17 };
const PLAYOFF_STAGES = ['Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];

const Engine = {
  state: null,

  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  },

  save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
  },

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    this.state = JSON.parse(raw);
    return true;
  },

  resetGame() {
    localStorage.removeItem(SAVE_KEY);
    this.state = { screen: 'club-select' };
  },

  getClub(id) {
    return this.state.clubs.find((c) => c.id === id);
  },

  rollNation() {
    const r = Math.random();
    let acc = 0;
    for (const n of NATIONS) {
      acc += n.weight;
      if (r <= acc) return n.code;
    }
    return 'ARG';
  },

  randomPlayerName(nation) {
    const pool = NAMES_BY_NATION[nation] || NAMES_BY_NATION.ARG;
    const first = pool.first[Math.floor(Math.random() * pool.first.length)];
    const last = pool.last[Math.floor(Math.random() * pool.last.length)];
    return `${first} ${last}`;
  },

  startingBudget(club) {
    return club.division === 'D1'
      ? Math.round(1500000 + club.reputation * 1300000)
      : Math.round(500000 + club.reputation * 450000);
  },

  generateSquad(club) {
    return SQUAD_POSITIONS.map((pos, i) => {
      const base = 44 + club.reputation * 6;
      const rating = Math.max(35, Math.min(90, Math.round(base + (Math.random() * 16 - 8))));
      const age = Math.round(17 + Math.random() * 18);
      const nation = this.rollNation();
      return { id: `p${i}`, name: this.randomPlayerName(nation), pos, rating, age, nation };
    });
  },

  squadStrength(squad) {
    const top11 = [...squad].sort((a, b) => b.rating - a.rating).slice(0, 11);
    return top11.reduce((sum, p) => sum + p.rating, 0) / top11.length;
  },

  clubStrength(clubId) {
    if (clubId === this.state.clubId) return this.squadStrength(this.state.squad);
    const club = this.getClub(clubId);
    return 44 + club.reputation * 6 + (Math.random() * 10 - 5);
  },

  // Genera un todos-contra-todos a una rueda. Si la cantidad de equipos es
  // impar se agrega un "descanso" (null) para que cada equipo tenga 1 fecha
  // libre repartida a lo largo del campeonato (método del círculo).
  buildSchedule(teamIds) {
    let arr = teamIds.slice();
    if (arr.length % 2 !== 0) arr.push(null);
    const n = arr.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const roundMatches = [];
      for (let i = 0; i < n / 2; i++) {
        const home = arr[i];
        const away = arr[n - 1 - i];
        if (home !== null && away !== null) {
          roundMatches.push(r % 2 === 0 ? { home, away } : { home: away, away: home });
        }
      }
      rounds.push(roundMatches);
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr = [fixed, ...rest];
    }
    return rounds;
  },

  emptyTableRow() {
    return { played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0 };
  },

  // Algoritmo de Knuth para muestrear una distribución de Poisson.
  samplePoisson(lambda) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  },

  simulateScore(homeStrength, awayStrength, homeAdvantage) {
    const diff = homeStrength - awayStrength;
    const lambdaHome = Math.max(0.2, Math.min(4.5, 1.35 + diff / 12 + homeAdvantage / 10));
    const lambdaAway = Math.max(0.15, Math.min(4, 1.05 - diff / 12));
    return { homeGoals: this.samplePoisson(lambdaHome), awayGoals: this.samplePoisson(lambdaAway) };
  },

  updateTableRow(table, id, gf, ga) {
    const row = table[id];
    row.played++;
    row.gf += gf;
    row.ga += ga;
    if (gf > ga) { row.win++; row.pts += 3; }
    else if (gf === ga) { row.draw++; row.pts += 1; }
    else { row.loss++; }
  },

  sortTable(table) {
    return Object.entries(table)
      .map(([id, row]) => ({ id, name: this.getClub(id).name, ...row }))
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  },

  // ---------- Ciclo de vida de la partida ----------

  buildAllZones() {
    const zones = {};
    ['D1-A', 'D1-B', 'D2-A', 'D2-B'].forEach((key) => {
      const [division, zone] = key.split('-');
      const ids = this.state.clubs.filter((c) => c.division === division && c.zone === zone).map((c) => c.id);
      zones[key] = {
        clubIds: ids,
        schedule: this.buildSchedule(ids),
        table: Object.fromEntries(ids.map((id) => [id, this.emptyTableRow()])),
        roundsPlayed: 0,
      };
    });
    return zones;
  },

  newGame(clubId) {
    this.state = {
      screen: 'pre-match',
      clubId,
      clubs: CLUB_TEMPLATES.map((c) => ({ ...c })),
      budget: 0,
      morale: 0,
      squad: null,
      season: null,
      copa: null,
      playoff: null,
      matchContext: null,
      currentDecision: null,
      lastDecisionNote: null,
      pendingMatch: null,
      fifaEvent: null,
      market: null,
      lastSeasonSummary: null,
      log: [],
    };
    const club = this.getClub(clubId);
    this.state.budget = this.startingBudget(club);
    this.state.squad = this.generateSquad(club);
    this.startSeasonStructures();
    this.enterRound();
    this.save();
  },

  startSeasonStructures() {
    const s = this.state;
    const club = this.getClub(s.clubId);
    s.season = {
      year: (s.season && s.season.year) || 1,
      roundIndex: 0,
      totalRounds: TOTAL_ROUNDS[club.division],
      transferRound: TRANSFER_ROUND[club.division],
      transferShown: false,
      fifaShown: [],
      copaShown: [],
      zones: this.buildAllZones(),
    };
    s.copa = { alive: true, champion: false, eliminatedAt: null, faced: [s.clubId] };
    s.playoff = null;
    s.lastSeasonSummary = null;
  },

  userZoneKey() {
    const club = this.getClub(this.state.clubId);
    return `${club.division}-${club.zone}`;
  },

  pickDecision() {
    this.state.currentDecision = DECISIONS[Math.floor(Math.random() * DECISIONS.length)];
  },

  // ---------- Progreso de la liga, fecha a fecha ----------

  enterRound() {
    const s = this.state;
    const season = s.season;

    if (season.roundIndex >= season.totalRounds) {
      this.enterPlayoffOrEnd();
      return;
    }

    if (FIFA_ROUNDS.includes(season.roundIndex) && !season.fifaShown.includes(season.roundIndex)) {
      season.fifaShown.push(season.roundIndex);
      s.fifaEvent = this.buildFifaEvent();
      s.screen = 'fifa-break';
      this.save();
      return;
    }

    if (COPA_ROUNDS.includes(season.roundIndex) && !season.copaShown.includes(season.roundIndex) && s.copa.alive && !s.copa.champion) {
      season.copaShown.push(season.roundIndex);
      const stageIndex = COPA_ROUNDS.indexOf(season.roundIndex);
      const opponentId = this.pickCopaOpponent();
      s.matchContext = { context: 'copa', opponentId, isHome: Math.random() < 0.5, stageIndex };
      this.pickDecision();
      s.screen = 'pre-match';
      this.save();
      return;
    }

    if (season.roundIndex === season.transferRound && !season.transferShown) {
      season.transferShown = true;
      s.market = this.generateMarket();
      s.screen = 'transfer';
      this.save();
      return;
    }

    const zoneKey = this.userZoneKey();
    const zone = season.zones[zoneKey];
    const round = zone.schedule[season.roundIndex];
    const userMatch = round.find((f) => f.home === s.clubId || f.away === s.clubId);

    if (!userMatch) {
      Object.keys(season.zones).forEach((k) => this.simulateZoneRound(k, season.roundIndex, null));
      s.log.unshift('Fecha libre para tu equipo.');
      season.roundIndex++;
      this.enterRound();
      return;
    }

    const isHome = userMatch.home === s.clubId;
    s.matchContext = { context: 'league', opponentId: isHome ? userMatch.away : userMatch.home, isHome };
    this.pickDecision();
    s.screen = 'pre-match';
    this.save();
  },

  pickCopaOpponent() {
    const s = this.state;
    const candidates = s.clubs.map((c) => c.id).filter((id) => !s.copa.faced.includes(id));
    const pool = candidates.length ? candidates : s.clubs.map((c) => c.id).filter((id) => id !== s.clubId);
    return pool[Math.floor(Math.random() * pool.length)];
  },

  simulateZoneRound(zoneKey, roundIndex, excludeMatch) {
    const zone = this.state.season.zones[zoneKey];
    if (roundIndex >= zone.schedule.length) return;
    const round = zone.schedule[roundIndex];
    round.forEach((fixture) => {
      if (excludeMatch && fixture.home === excludeMatch.home && fixture.away === excludeMatch.away) return;
      const hs = this.clubStrength(fixture.home);
      const as = this.clubStrength(fixture.away);
      const score = this.simulateScore(hs, as, 4);
      this.updateTableRow(zone.table, fixture.home, score.homeGoals, score.awayGoals);
      this.updateTableRow(zone.table, fixture.away, score.awayGoals, score.homeGoals);
    });
    zone.roundsPlayed++;
  },

  catchUpAllZones() {
    Object.keys(this.state.season.zones).forEach((k) => {
      const zone = this.state.season.zones[k];
      while (zone.roundsPlayed < zone.schedule.length) {
        this.simulateZoneRound(k, zone.roundsPlayed, null);
      }
    });
  },

  // ---------- Un partido interactivo (liga, copa o playoff) ----------

  chooseDecision(optionIndex) {
    const s = this.state;
    const option = s.currentDecision.options[optionIndex];
    s.lastDecisionNote = option.note;
    s.morale = Math.max(-15, Math.min(15, s.morale + option.moraleMod));

    if (option.growthBoost) {
      const youngsters = s.squad.filter((p) => p.age <= 21);
      if (youngsters.length && Math.random() < 0.35) {
        const p = youngsters[Math.floor(Math.random() * youngsters.length)];
        p.rating = Math.min(99, p.rating + 1);
        s.lastDecisionNote += ` ${p.name} mejoró con los entrenamientos.`;
      }
    }

    const ctx = s.matchContext;
    const myStrength = this.squadStrength(s.squad) + option.tacticMod + s.morale / 3;
    const oppStrength = this.clubStrength(ctx.opponentId);
    const homeAdvantage = 4;
    const homeStrength = ctx.isHome ? myStrength : oppStrength;
    const awayStrength = ctx.isHome ? oppStrength : myStrength;
    const score = this.simulateScore(homeStrength, awayStrength, homeAdvantage);

    s.pendingMatch = {
      home: ctx.isHome ? s.clubId : ctx.opponentId,
      away: ctx.isHome ? ctx.opponentId : s.clubId,
      homeGoals: score.homeGoals,
      awayGoals: score.awayGoals,
      isHome: ctx.isHome,
      opponentId: ctx.opponentId,
      context: ctx.context,
      penalty: null,
      shootout: null,
    };

    if (Math.random() < 0.25) {
      s.pendingMatch.penalty = { side: Math.random() < 0.5 ? 'user' : 'rival', resolved: false, scored: null };
      s.screen = 'penalty';
      this.save();
    } else {
      this.finalizePendingScore();
    }
  },

  getPenaltyShooters() {
    return [...this.state.squad].filter((p) => p.pos === 'DEL' || p.pos === 'MED').sort((a, b) => b.rating - a.rating).slice(0, 3);
  },

  getUserKeeper() {
    return [...this.state.squad].filter((p) => p.pos === 'POR').sort((a, b) => b.rating - a.rating)[0];
  },

  resolvePenalty(direction, shooterOrKeeper) {
    const s = this.state;
    const pen = s.pendingMatch.penalty;
    const guess = PENALTY_DIRECTIONS[Math.floor(Math.random() * PENALTY_DIRECTIONS.length)];
    let scored;

    if (pen.side === 'user') {
      const matched = guess === direction;
      const chance = Math.max(0.05, Math.min(0.97, (matched ? 0.3 : 0.9) + (shooterOrKeeper.rating - 70) / 300));
      scored = Math.random() < chance;
      pen.shooterName = shooterOrKeeper.name;
      pen.direction = direction;
    } else {
      const matched = guess === direction;
      const chance = Math.max(0.03, Math.min(0.8, (matched ? 0.35 : 0.05) + (shooterOrKeeper.rating - 70) / 300));
      scored = !(Math.random() < chance);
      pen.keeperName = shooterOrKeeper.name;
      pen.direction = direction;
    }

    pen.resolved = true;
    pen.scored = scored;

    if (scored) {
      const scoringIsHome = (pen.side === 'user') === s.pendingMatch.isHome;
      if (scoringIsHome) s.pendingMatch.homeGoals++;
      else s.pendingMatch.awayGoals++;
    }

    this.finalizePendingScore();
  },

  finalizePendingScore() {
    const s = this.state;
    const m = s.pendingMatch;
    if (m.context !== 'league' && m.homeGoals === m.awayGoals) {
      const myStrength = this.squadStrength(s.squad);
      const oppStrength = this.clubStrength(m.opponentId);
      const userIsHomeSide = m.isHome;
      const prob = Math.max(0.15, Math.min(0.85, 0.5 + (myStrength - oppStrength) / 100));
      const userWinsShootout = Math.random() < prob;
      const winnerGoals = 4 + Math.floor(Math.random() * 2);
      const loserGoals = winnerGoals - (1 + Math.floor(Math.random() * 2));
      m.shootout = {
        userWon: userWinsShootout,
        homeScore: userIsHomeSide === userWinsShootout ? winnerGoals : loserGoals,
        awayScore: userIsHomeSide === userWinsShootout ? loserGoals : winnerGoals,
      };
    }
    s.screen = 'match-result';
    this.save();
  },

  developSquadAfterMatch(userWon, userLost) {
    const s = this.state;
    const sample = [...s.squad].sort(() => Math.random() - 0.5).slice(0, 3);
    sample.forEach((p) => {
      let chance = 0;
      let delta = 0;
      if (p.age <= 22) { chance = 0.2; delta = 1; }
      else if (p.age >= 32) { chance = 0.2; delta = -1; }
      else if (userWon) { chance = 0.08; delta = 1; }
      else if (userLost) { chance = 0.08; delta = -1; }
      if (Math.random() < chance) p.rating = Math.max(35, Math.min(99, p.rating + delta));
    });
  },

  matchWinnerId(m) {
    if (m.homeGoals !== m.awayGoals) return m.homeGoals > m.awayGoals ? m.home : m.away;
    if (m.shootout) {
      const userIsHome = m.isHome;
      if (m.shootout.userWon) return userIsHome ? m.home : m.away;
      return userIsHome ? m.away : m.home;
    }
    return null;
  },

  // ---------- Continuar tras ver el resultado ----------

  finishMatchAndAdvance() {
    const s = this.state;
    const m = s.pendingMatch;
    const clubName = (id) => this.getClub(id).name;
    const winner = this.matchWinnerId(m);
    const userWon = winner === s.clubId;
    const userLost = winner !== null && !userWon;
    this.developSquadAfterMatch(userWon, userLost);

    if (m.context === 'league') {
      const zoneKey = this.userZoneKey();
      const zone = s.season.zones[zoneKey];
      this.updateTableRow(zone.table, m.home, m.homeGoals, m.awayGoals);
      this.updateTableRow(zone.table, m.away, m.awayGoals, m.homeGoals);
      s.log.unshift(`Liga: ${clubName(m.home)} ${m.homeGoals}-${m.awayGoals} ${clubName(m.away)}`);
      this.simulateZoneRound(zoneKey, s.season.roundIndex, m);
      Object.keys(s.season.zones).filter((k) => k !== zoneKey).forEach((k) => this.simulateZoneRound(k, s.season.roundIndex, null));
      s.pendingMatch = null;
      s.matchContext = null;
      s.season.roundIndex++;
      this.enterRound();
    } else if (m.context === 'copa') {
      const stage = COPA_STAGE_NAMES[s.matchContext.stageIndex];
      s.copa.faced.push(m.opponentId);
      if (userWon) {
        s.log.unshift(`Copa Argentina (${stage}): ganaste ${m.homeGoals}-${m.awayGoals} vs ${clubName(m.opponentId)}${m.shootout ? ' (por penales)' : ''}.`);
        if (s.matchContext.stageIndex === COPA_STAGE_NAMES.length - 1) {
          s.copa.champion = true;
          s.log.unshift('¡Sos campeón de la Copa Argentina!');
        }
      } else {
        s.copa.alive = false;
        s.copa.eliminatedAt = stage;
        s.log.unshift(`Copa Argentina (${stage}): quedaste eliminado ante ${clubName(m.opponentId)}.`);
      }
      s.pendingMatch = null;
      s.matchContext = null;
      this.enterRound();
    } else if (m.context === 'playoff') {
      this.resolveUserPlayoffMatch(userWon);
    }
    this.save();
  },

  // ---------- Fin de la fase de zonas: playoffs (solo D1) ----------

  // Los playoffs y la tabla anual de Primera División se calculan siempre,
  // sin importar en qué división esté jugando el usuario esta temporada,
  // porque los cupos a copas internacionales dependen de ese resultado.
  // Si el usuario juega en Primera Nacional (o no clasificó a los 16 mejores
  // de Primera), esa fase se resuelve automáticamente en segundo plano.
  enterPlayoffOrEnd() {
    const s = this.state;
    this.catchUpAllZones();

    const combined = this.sortTable(s.season.zones['D1-A'].table)
      .concat(this.sortTable(s.season.zones['D1-B'].table))
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    s.season.tablaAnual = combined;

    const seeds = combined.slice(0, 16).map((row, i) => ({ id: row.id, seed: i + 1 }));
    const userQualified = seeds.some((x) => x.id === s.clubId);
    s.playoff = { alive: seeds, stageIndex: 0, champion: null, runnerUp: null, userQualified };

    if (!userQualified) {
      this.simulatePlayoffFully();
      this.endSeason();
      return;
    }

    this.resolvePlayoffStage();
  },

  pairStage(alive) {
    const sorted = [...alive].sort((a, b) => a.seed - b.seed);
    const pairs = [];
    for (let i = 0; i < sorted.length / 2; i++) pairs.push([sorted[i], sorted[sorted.length - 1 - i]]);
    return pairs;
  },

  resolveKnockout(idA, idB) {
    const sa = this.clubStrength(idA);
    const sb = this.clubStrength(idB);
    const score = this.simulateScore(sa, sb, 2);
    if (score.homeGoals !== score.awayGoals) return score.homeGoals > score.awayGoals ? idA : idB;
    const prob = Math.max(0.15, Math.min(0.85, 0.5 + (sa - sb) / 100));
    return Math.random() < prob ? idA : idB;
  },

  // Se asume que el usuario sigue con vida en el playoff cuando se llama a esto.
  resolvePlayoffStage() {
    const s = this.state;
    const pairs = this.pairStage(s.playoff.alive);
    const winners = [];
    let userEntry = null;
    let opponentEntry = null;

    pairs.forEach((pair) => {
      const involvesUser = pair.some((p) => p.id === s.clubId);
      if (involvesUser) {
        userEntry = pair.find((p) => p.id === s.clubId);
        opponentEntry = pair.find((p) => p.id !== s.clubId);
        return;
      }
      const winnerId = this.resolveKnockout(pair[0].id, pair[1].id);
      winners.push(pair.find((p) => p.id === winnerId));
    });

    s.playoff.pendingWinners = winners;
    s.playoff.pendingIsFinal = pairs.length === 1;
    s.playoff.pendingUserEntry = userEntry;
    s.playoff.pendingOpponentEntry = opponentEntry;

    s.matchContext = { context: 'playoff', opponentId: opponentEntry.id, isHome: userEntry.seed < opponentEntry.seed };
    this.pickDecision();
    s.screen = 'pre-match';
    this.save();
  },

  resolveUserPlayoffMatch(userWon) {
    const s = this.state;
    const stageName = PLAYOFF_STAGES[s.playoff.stageIndex];
    const clubName = (id) => this.getClub(id).name;
    const m = s.pendingMatch;
    const isFinal = s.playoff.pendingIsFinal;

    if (userWon) {
      s.log.unshift(`Playoffs (${stageName}): avanzaste ${m.homeGoals}-${m.awayGoals} vs ${clubName(m.opponentId)}${m.shootout ? ' (por penales)' : ''}.`);
    } else {
      s.log.unshift(`Playoffs (${stageName}): quedaste eliminado ante ${clubName(m.opponentId)}.`);
    }

    const advancingEntry = userWon ? s.playoff.pendingUserEntry : s.playoff.pendingOpponentEntry;
    s.playoff.alive = s.playoff.pendingWinners.concat([advancingEntry]);
    s.pendingMatch = null;
    s.matchContext = null;

    if (isFinal) {
      s.playoff.champion = advancingEntry.id;
      s.playoff.runnerUp = userWon ? s.playoff.pendingOpponentEntry.id : s.clubId;
      this.endSeason();
      return;
    }

    if (!userWon) {
      this.simulatePlayoffFully();
      this.endSeason();
      return;
    }

    s.playoff.stageIndex++;
    this.resolvePlayoffStage();
  },

  // Simula el resto del cuadro sin intervención del usuario (no clasificó o
  // ya quedó eliminado) y define campeón y subcampeón.
  simulatePlayoffFully() {
    const s = this.state;
    let alive = s.playoff.alive;
    let runnerUp = s.playoff.runnerUp || null;
    while (alive.length > 1) {
      const pairs = this.pairStage(alive);
      const winners = pairs.map((pair) => {
        const winnerId = this.resolveKnockout(pair[0].id, pair[1].id);
        if (pairs.length === 1) runnerUp = pair.find((p) => p.id !== winnerId).id;
        return pair.find((p) => p.id === winnerId);
      });
      alive = winners;
    }
    s.playoff.alive = alive;
    s.playoff.champion = alive[0] ? alive[0].id : null;
    s.playoff.runnerUp = runnerUp;
  },

  // ---------- Fechas FIFA ----------

  buildFifaEvent() {
    const callUps = this.state.squad.filter((p) => p.rating >= 78).map((p) => ({ ...p }));
    return { callUps, resolved: callUps.length === 0, results: null };
  },

  resolveFifaEvent(careRequested) {
    const s = this.state;
    const results = s.fifaEvent.callUps.map((p) => {
      const injuryChance = careRequested ? 0.05 : 0.15;
      const real = s.squad.find((sp) => sp.id === p.id);
      if (Math.random() < injuryChance) {
        real.rating = Math.max(35, real.rating - 3);
        return `${p.name} volvió con una molestia física tras la fecha FIFA.`;
      }
      if (Math.random() < 0.25) {
        real.rating = Math.min(99, real.rating + 1);
        return `${p.name} hizo un gran partido con ${this.nationName(p.nation)} y sumó experiencia.`;
      }
      return `${p.name} sumó minutos con ${this.nationName(p.nation)} sin sobresaltos.`;
    });
    s.fifaEvent.results = results;
    s.fifaEvent.resolved = true;
    this.save();
  },

  nationName(code) {
    const n = NATIONS.find((x) => x.code === code);
    return n ? n.name : code;
  },

  continueFromFifa() {
    this.enterRound();
    this.save();
  },

  // ---------- Mercado de pases (ventana de mitad de temporada) ----------

  generateMarket() {
    const club = this.getClub(this.state.clubId);
    return Array.from({ length: 3 }, (_, i) => {
      const pos = SQUAD_POSITIONS[Math.floor(Math.random() * SQUAD_POSITIONS.length)];
      const rating = Math.max(38, Math.min(92, Math.round(44 + club.reputation * 6 + (Math.random() * 20 - 6))));
      const price = Math.round(rating * 15000 * (0.8 + Math.random() * 0.4));
      const age = Math.round(18 + Math.random() * 15);
      const nation = this.rollNation();
      return { id: `market-${i}-${Date.now()}`, name: this.randomPlayerName(nation), pos, rating, price, age, nation };
    });
  },

  buyPlayer(marketIndex) {
    const s = this.state;
    const offer = s.market[marketIndex];
    if (!offer || s.budget < offer.price) return false;
    s.budget -= offer.price;
    const samePos = s.squad.filter((p) => p.pos === offer.pos);
    const target = (samePos.length ? samePos : s.squad).sort((a, b) => a.rating - b.rating)[0];
    const idx = s.squad.findIndex((p) => p.id === target.id);
    s.squad[idx] = { id: offer.id, name: offer.name, pos: offer.pos, rating: offer.rating, age: offer.age, nation: offer.nation };
    s.market.splice(marketIndex, 1);
    this.save();
    return true;
  },

  sellPlayer(squadIndex) {
    const s = this.state;
    if (s.squad.length <= 12) return false;
    const player = s.squad[squadIndex];
    s.budget += Math.round(player.rating * 15000 * 0.7);
    s.squad.splice(squadIndex, 1);
    this.save();
    return true;
  },

  continueFromTransfer() {
    this.enterRound();
    this.save();
  },

  // ---------- Fin de temporada: copas, ascensos y descensos ----------

  bottomN(table, n) {
    const sorted = this.sortTable(table);
    return sorted.slice(-n).map((r) => r.id);
  },

  topN(table, n) {
    return this.sortTable(table).slice(0, n).map((r) => r.id);
  },

  assignQualification(tablaAnual) {
    const assigned = new Set();
    const results = [];
    const grant = (clubId, comp, stage) => {
      if (!clubId || assigned.has(clubId)) return false;
      assigned.add(clubId);
      results.push({ clubId, name: this.getClub(clubId).name, comp, stage });
      return true;
    };

    const s = this.state;
    if (s.playoff) {
      grant(s.playoff.champion, 'Libertadores', 'Fase de grupos');
      grant(s.playoff.runnerUp, 'Libertadores', 'Fase previa');
    }

    // El cupo de la Copa Argentina solo se asigna si el usuario fue quien la
    // ganó: no simulamos en segundo plano el resto del cuadro de esa copa
    // (serían más de 60 clubes), así que si el jugador no es el campeón, ese
    // cupo se reparte igual que el resto, por tabla anual.
    let libLeft = 1;
    let sudaLeft = 3;
    if (s.copa.champion) grant(s.clubId, 'Libertadores', 'Fase previa');
    else libLeft++;

    if (tablaAnual) {
      for (const row of tablaAnual) {
        if (libLeft <= 0 && sudaLeft <= 0) break;
        if (assigned.has(row.id)) continue;
        if (libLeft > 0) { grant(row.id, 'Libertadores', 'Fase previa'); libLeft--; }
        else { grant(row.id, 'Sudamericana', 'Fase de grupos'); sudaLeft--; }
      }
    }
    return results;
  },

  endSeason() {
    const s = this.state;
    // Se capturan ANTES de mover clubes de división: si el usuario asciende o
    // desciende, this.getClub(s.clubId).division y userZoneKey() cambian, y
    // necesitamos la zona/división en la que jugó esta temporada, no la que
    // le toca en la próxima.
    const divisionThisSeason = this.getClub(s.clubId).division;
    const zoneKeyThisSeason = this.userZoneKey();

    // Ascensos y descensos se calculan siempre para las 4 zonas, sea cual
    // sea la división del usuario, porque la liga completa se mueve entera
    // de una temporada a la otra.
    const relegated = this.bottomN(s.season.zones['D1-A'].table, 2).concat(this.bottomN(s.season.zones['D1-B'].table, 2));
    const promoted = this.topN(s.season.zones['D2-A'].table, 2).concat(this.topN(s.season.zones['D2-B'].table, 2));
    relegated.forEach((id) => { this.getClub(id).division = 'D2'; });
    promoted.forEach((id) => { this.getClub(id).division = 'D1'; });

    const qualification = this.assignQualification(s.season.tablaAnual || null);

    const userRelegated = relegated.includes(s.clubId);
    const userPromoted = promoted.includes(s.clubId);
    let economyNote = '';
    if (userRelegated) {
      const penalty = Math.round(s.budget * 0.25);
      s.budget -= penalty;
      economyNote = `Por el descenso, el presupuesto bajó ${penalty.toLocaleString('es-AR')} para la próxima temporada.`;
    } else if (userPromoted) {
      s.budget += 400000;
      economyNote = 'Por el ascenso, la dirigencia sumó un refuerzo económico de $400.000.';
    } else if (divisionThisSeason === 'D1' && s.season.tablaAnual) {
      const pos = s.season.tablaAnual.findIndex((r) => r.id === s.clubId) + 1;
      const bonus = Math.max(0, Math.round((31 - pos) * 120000));
      s.budget += bonus;
      economyNote = `Premio por terminar ${pos}° en la tabla anual: $${bonus.toLocaleString('es-AR')}.`;
    } else {
      s.budget += 150000;
      economyNote = 'Ingresos de la temporada: $150.000.';
    }

    s.lastSeasonSummary = {
      division: divisionThisSeason,
      zoneTable: this.sortTable(s.season.zones[zoneKeyThisSeason].table),
      tablaAnual: s.season.tablaAnual || null,
      playoff: s.playoff,
      copa: s.copa,
      qualification,
      relegated: relegated.map((id) => this.getClub(id).name),
      promoted: promoted.map((id) => this.getClub(id).name),
      userRelegated,
      userPromoted,
      economyNote,
    };

    s.squad.forEach((p) => { p.age++; });
    s.screen = 'season-end';
    this.save();
  },

  startNewSeason() {
    const s = this.state;
    const year = s.season.year + 1;
    s.season = null;
    this.startSeasonStructures();
    s.season.year = year;
    this.enterRound();
    this.save();
  },
};
