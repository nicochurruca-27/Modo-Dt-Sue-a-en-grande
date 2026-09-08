// Lógica del juego: estado, generación de datos y simulación.
// Todo vive en el objeto global `Engine`. No usa módulos para poder
// abrirse el juego directamente con doble click (sin servidor).
//
// Estructura de la temporada (basada en el formato real de AFA 2026, con
// algunas simplificaciones documentadas en el README):
// - Solo se juega la Primera División: 30 clubes en 2 zonas de 15. Se
//   juegan DOS torneos por año —Apertura y Clausura—, cada uno con fase de
//   zonas a una rueda y playoffs de octavos a la final (16 mejores de la
//   tabla combinada de esa edición). Entre ambos torneos hay una ventana
//   de pases.
// - La Primera Nacional NO se simula partido a partido: es una "reserva"
//   de 36 clubes (division:'D2' en data.js) de la que salen al azar los 2
//   ascensos de cada año, y a la que van los 2 descensos — así el mundo del
//   juego se siente vivo (nombres reales entrando y saliendo de Primera)
//   sin tener que jugar una segunda división completa.
// - Copa Argentina: se sortea un cuadro de 32 al arrancar el año (los 30
//   clubes de Primera + 2 de la reserva, como "invitados" de una categoría
//   menor), y se juega en simultáneo con la primera edición del año
//   (dieciseisavos a la final). El resto del cuadro se resuelve solo según
//   la fuerza de cada club; si no la ganás vos, sale campeón el que gane esa
//   simulación (no queda "vacante").
// - Fechas FIFA: pausan la liga y muestran si algún jugador destacado fue
//   convocado a su selección.
// - Descienden 2 por año: el último de la Tabla Anual (suma de Apertura +
//   Clausura) y el peor promedio de puntos por partido de las últimas 3
//   temporadas en Primera (si coinciden, el segundo descenso pasa al
//   siguiente peor promedio). Tu propio club nunca puede ser uno de los 2
//   descensos, porque no habría dónde jugar la temporada siguiente.
// - Cupos a copas internacionales: 6 a Libertadores (campeón Apertura,
//   campeón Clausura, campeón Copa Argentina, 1º y 2º de la Tabla Anual, y
//   un repechaje anclado en el 9º), y 6 a Sudamericana (del 3º al 8º de la
//   Tabla Anual), salteando siempre clubes ya clasificados por otra vía. Si
//   un campeón desciende esa misma temporada, pierde el cupo directo y este
//   se reparte igual por tabla.

const SAVE_KEY = 'dt-simulador-save-v4';

const FIFA_ROUNDS = [5, 11];
const COPA_ROUNDS = [2, 4, 7, 10, 13];
const COPA_STAGE_NAMES = ['Dieciseisavos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];
const TOTAL_ROUNDS = { D1: 15 };
const PLAYOFF_STAGES = ['Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];
const BRACKET_KIND_LABELS = {
  apertura: 'Playoffs del Apertura',
  clausura: 'Playoffs del Clausura',
  copa: 'Copa Argentina',
};

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

  // El presupuesto usa budgetTier si el club lo tiene definido (situación
  // económica real, que puede no coincidir con su nivel deportivo — el caso
  // típico es un club grande pero con problemas de plata) y si no, cae a su
  // reputation. La escala tiene bastante más diferencia entre el tier 5 y el
  // 1 que entre niveles deportivos intermedios, para reflejar que los
  // ingresos de los clubes grandes son varias veces los de uno chico.
  startingBudget(club) {
    const tier = club.budgetTier || club.reputation;
    const table = club.division === 'D1'
      ? { 5: 16000000, 4: 8000000, 3: 5000000, 2: 3000000, 1: 1800000 }
      : { 3: 1800000, 2: 1100000, 1: 650000 };
    return table[tier] || table[1];
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

  combineEditionTables(apertura, clausura) {
    const allRows = apertura.zoneATable.concat(apertura.zoneBTable, clausura.zoneATable, clausura.zoneBTable);
    const byId = {};
    allRows.forEach((r) => {
      if (!byId[r.id]) byId[r.id] = { id: r.id, name: r.name, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0 };
      const acc = byId[r.id];
      acc.played += r.played; acc.win += r.win; acc.draw += r.draw; acc.loss += r.loss; acc.gf += r.gf; acc.ga += r.ga; acc.pts += r.pts;
    });
    return Object.values(byId).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  },

  // ---------- Ciclo de vida de la partida ----------

  newGame(clubId) {
    this.state = {
      screen: 'pre-match',
      clubId,
      clubs: CLUB_TEMPLATES.map((c) => ({ ...c, history: [] })),
      budget: 0,
      morale: 0,
      squad: null,
      season: null,
      copaBracket: null,
      bracket: null,
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
    this.startNewSeason();
  },

  // Arranca un año nuevo completo de Primera División (la única división
  // jugable). La "Primera Nacional" ya no se simula partido a partido: es
  // simplemente la reserva de clubes de la que salen los 2 ascensos de cada
  // año y a la que van los 2 descensos (ver promoteFromReserve en
  // finishMyDivisionYear).
  startNewSeason() {
    const s = this.state;
    const prevYear = s.season ? s.season.year : 0;

    s.season = {
      year: prevYear + 1,
      myZone: this.getClub(s.clubId).zone,
      edition: null,
      roundIndex: 0,
      totalRounds: TOTAL_ROUNDS.D1,
      fifaShown: [],
      copaShown: [],
      transferShown: false,
      transferReason: null,
      zones: {},
      myD1: { apertura: null, clausura: null },
    };
    s.bracket = null;
    s.lastSeasonSummary = null;

    this.setupCopaBracket();
    this.startEdition('apertura');
  },

  // Sortea el cuadro de 32 de la Copa Argentina para todo el año: los 30
  // clubes de Primera + 2 de la reserva (ex Primera Nacional), como
  // "invitados" de una categoría menor — así siempre hay 32 sin necesidad
  // de simular el resto del ascenso.
  setupCopaBracket() {
    const s = this.state;
    const d1Ids = s.clubs.filter((c) => c.division === 'D1').map((c) => c.id);
    const reservePool = s.clubs.filter((c) => c.division === 'D2').map((c) => c.id);
    for (let i = reservePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [reservePool[i], reservePool[j]] = [reservePool[j], reservePool[i]];
    }

    const entrants = d1Ids.concat(reservePool.slice(0, 2));

    for (let i = entrants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entrants[i], entrants[j]] = [entrants[j], entrants[i]];
    }
    s.copaBracket = { alive: entrants.map((id, i) => ({ id, seed: i + 1 })), stageIndex: 0, champion: null, runnerUp: null };
  },

  startEdition(edition) {
    const s = this.state;
    const season = s.season;
    season.edition = edition;
    season.roundIndex = 0;
    season.fifaShown = [];
    season.copaShown = [];

    const idsA = s.clubs.filter((c) => c.division === 'D1' && c.zone === 'A').map((c) => c.id);
    const idsB = s.clubs.filter((c) => c.division === 'D1' && c.zone === 'B').map((c) => c.id);
    season.zones = {
      'D1-A': { clubIds: idsA, schedule: this.buildSchedule(idsA), table: Object.fromEntries(idsA.map((id) => [id, this.emptyTableRow()])) },
      'D1-B': { clubIds: idsB, schedule: this.buildSchedule(idsB), table: Object.fromEntries(idsB.map((id) => [id, this.emptyTableRow()])) },
    };

    this.enterEditionRound();
  },

  myZoneKey() {
    return `D1-${this.state.season.myZone}`;
  },

  pickDecision() {
    this.state.currentDecision = DECISIONS[Math.floor(Math.random() * DECISIONS.length)];
  },

  // ---------- Progreso fecha a fecha dentro de una edición/etapa ----------

  enterEditionRound() {
    const s = this.state;
    const season = s.season;

    if (season.roundIndex >= season.totalRounds) {
      this.enterEditionPlayoffOrFinish();
      return;
    }

    if (FIFA_ROUNDS.includes(season.roundIndex) && !season.fifaShown.includes(season.roundIndex)) {
      season.fifaShown.push(season.roundIndex);
      s.fifaEvent = this.buildFifaEvent();
      s.screen = 'fifa-break';
      this.save();
      return;
    }

    // La Copa Argentina corre una sola vez por año, en simultáneo con la
    // primera etapa (Apertura para Primera, la única edición de la Nacional).
    // Cada uno de los 5 checkpoints hace avanzar el cuadro exactamente una
    // ronda (dieciseisavos, octavos, cuartos, semifinal, final).
    const copaEditionOk = season.edition !== 'clausura';
    if (copaEditionOk && COPA_ROUNDS.includes(season.roundIndex) && !season.copaShown.includes(season.roundIndex) && s.copaBracket.alive.length > 1) {
      season.copaShown.push(season.roundIndex);
      this.advanceCopaBracket();
      return;
    }

    const zoneKey = this.myZoneKey();
    const zone = season.zones[zoneKey];
    const round = zone.schedule[season.roundIndex];
    const userMatch = round.find((f) => f.home === s.clubId || f.away === s.clubId);

    if (!userMatch) {
      Object.keys(season.zones).forEach((k) => this.simulateZoneRound(k, season.roundIndex, null));
      s.log.unshift('Fecha libre para tu equipo.');
      season.roundIndex++;
      this.enterEditionRound();
      return;
    }

    const isHome = userMatch.home === s.clubId;
    s.matchContext = { context: 'league', opponentId: isHome ? userMatch.away : userMatch.home, isHome };
    this.pickDecision();
    s.screen = 'pre-match';
    this.save();
  },

  // Hace avanzar el cuadro de la Copa Argentina exactamente una ronda. Si el
  // usuario ya no está en carrera (o nunca lo estuvo), esa ronda se resuelve
  // sola; si sigue con vida, se juega de forma interactiva.
  advanceCopaBracket() {
    const s = this.state;
    const cb = s.copaBracket;
    const userInvolved = cb.alive.some((x) => x.id === s.clubId);

    if (!userInvolved) {
      const pairs = this.pairStage(cb.alive);
      cb.alive = pairs.map((pair) => {
        const winnerId = this.resolveKnockout(pair[0].id, pair[1].id);
        return pair.find((p) => p.id === winnerId);
      });
      cb.stageIndex++;
      if (cb.alive.length === 1) {
        cb.champion = cb.alive[0].id;
        s.log.unshift(`Copa Argentina: salió campeón ${this.getClub(cb.champion).name}.`);
      }
      this.enterEditionRound();
      return;
    }

    s.bracket = { kind: 'copa', alive: cb.alive, stageIndex: cb.stageIndex, champion: null, runnerUp: null, stageNames: COPA_STAGE_NAMES, oneRoundAtATime: true };
    this.resolveBracketStage();
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
  },

  // ---------- Un partido interactivo (liga, copa o cuadro eliminatorio) ----------

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
    // Liga: los empates quedan como empate. Cualquier otro contexto (Copa
    // Argentina, playoffs, Final por el ascenso, Reducido) es eliminación
    // directa: un empate se define por penales.
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
    // Salvaguarda: una instancia de eliminación directa nunca puede terminar
    // sin ganador. Si por algún motivo no se calculó el shootout, se decide
    // acá al azar en vez de dejar el partido sin resolver.
    if (m.context !== 'league') return Math.random() < 0.5 ? m.home : m.away;
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
      const zoneKey = this.myZoneKey();
      const zone = s.season.zones[zoneKey];
      this.updateTableRow(zone.table, m.home, m.homeGoals, m.awayGoals);
      this.updateTableRow(zone.table, m.away, m.awayGoals, m.homeGoals);
      s.log.unshift(`Liga: ${clubName(m.home)} ${m.homeGoals}-${m.awayGoals} ${clubName(m.away)}`);
      this.simulateZoneRound(zoneKey, s.season.roundIndex, m);
      Object.keys(s.season.zones).filter((k) => k !== zoneKey).forEach((k) => this.simulateZoneRound(k, s.season.roundIndex, null));
      s.pendingMatch = null;
      s.matchContext = null;
      s.season.roundIndex++;
      this.enterEditionRound();
    } else if (m.context === 'bracket') {
      this.resolveUserBracketMatch(userWon, false);
    }
    this.save();
  },

  // ---------- Fin de zona: playoffs del Apertura o del Clausura ----------

  enterEditionPlayoffOrFinish() {
    const s = this.state;
    const season = s.season;
    const zoneATable = this.sortTable(season.zones['D1-A'].table);
    const zoneBTable = this.sortTable(season.zones['D1-B'].table);
    const combined = zoneATable.concat(zoneBTable).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    const seeds = combined.slice(0, 16).map((r, i) => ({ id: r.id, seed: i + 1 }));
    season.myD1[season.edition] = { zoneATable, zoneBTable, champion: null, runnerUp: null };
    this.startBracket(season.edition, seeds, PLAYOFF_STAGES);
  },

  pairStage(alive) {
    const sorted = [...alive].sort((a, b) => a.seed - b.seed);
    const pairs = [];
    for (let i = 0; i < sorted.length / 2; i++) pairs.push([sorted[i], sorted[sorted.length - 1 - i]]);
    return pairs;
  },

  resolveKnockout(idA, idB) {
    if (idA === null) return idB;
    if (idB === null) return idA;
    const sa = this.clubStrength(idA);
    const sb = this.clubStrength(idB);
    const score = this.simulateScore(sa, sb, 2);
    if (score.homeGoals !== score.awayGoals) return score.homeGoals > score.awayGoals ? idA : idB;
    const prob = Math.max(0.15, Math.min(0.85, 0.5 + (sa - sb) / 100));
    return Math.random() < prob ? idA : idB;
  },

  simulateSeedsToChampion(seeds) {
    let alive = seeds;
    let runnerUp = null;
    while (alive.length > 1) {
      const pairs = this.pairStage(alive);
      const winners = pairs.map((pair) => {
        const winnerId = this.resolveKnockout(pair[0].id, pair[1].id);
        if (pairs.length === 1) {
          const loser = pair.find((p) => p.id !== winnerId);
          runnerUp = loser ? loser.id : null;
        }
        return pair.find((p) => p.id === winnerId);
      });
      alive = winners;
    }
    return { champion: alive[0] ? alive[0].id : null, runnerUp };
  },

  bracketStageLabel() {
    const b = this.state.bracket;
    return `${BRACKET_KIND_LABELS[b.kind] || b.kind} — ${b.stageNames[b.stageIndex]}`;
  },

  startBracket(kind, seeds, stageNames) {
    const s = this.state;
    s.bracket = { kind, alive: seeds, stageIndex: 0, champion: null, runnerUp: null, stageNames };
    const userQualified = seeds.some((x) => x.id === s.clubId);
    if (!userQualified) {
      this.simulateBracketFully();
      return;
    }
    this.resolveBracketStage();
  },

  // Se asume que el usuario sigue con vida en el cuadro cuando se llama a esto.
  resolveBracketStage() {
    const s = this.state;
    const pairs = this.pairStage(s.bracket.alive);
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

    s.bracket.pendingWinners = winners;
    s.bracket.pendingIsFinal = pairs.length === 1;
    s.bracket.pendingUserEntry = userEntry;
    s.bracket.pendingOpponentEntry = opponentEntry;

    if (!opponentEntry || opponentEntry.id === null) {
      s.log.unshift(`${this.bracketStageLabel()}: tenés fecha libre, pasás de ronda directo.`);
      this.resolveUserBracketMatch(true, true);
      return;
    }

    s.matchContext = { context: 'bracket', opponentId: opponentEntry.id, isHome: userEntry.seed < opponentEntry.seed };
    this.pickDecision();
    s.screen = 'pre-match';
    this.save();
  },

  resolveUserBracketMatch(userWon, isBye) {
    const s = this.state;
    const isFinal = s.bracket.pendingIsFinal;

    if (!isBye) {
      const m = s.pendingMatch;
      const clubName = (id) => this.getClub(id).name;
      const label = this.bracketStageLabel();
      if (userWon) s.log.unshift(`${label}: avanzaste ${m.homeGoals}-${m.awayGoals} vs ${clubName(m.opponentId)}${m.shootout ? ' (por penales)' : ''}.`);
      else s.log.unshift(`${label}: quedaste eliminado ante ${clubName(m.opponentId)}.`);
    }

    const advancingEntry = userWon ? s.bracket.pendingUserEntry : s.bracket.pendingOpponentEntry;
    s.bracket.alive = s.bracket.pendingWinners.concat([advancingEntry]);
    s.pendingMatch = null;
    s.matchContext = null;

    if (isFinal) {
      s.bracket.champion = advancingEntry.id;
      s.bracket.runnerUp = userWon ? s.bracket.pendingOpponentEntry.id : s.clubId;
      this.onBracketComplete();
      return;
    }

    if (!userWon) {
      this.simulateBracketFully();
      return;
    }

    s.bracket.stageIndex++;
    if (s.bracket.oneRoundAtATime) {
      // Copa Argentina: guardar el progreso y volver a la liga. El próximo
      // checkpoint retoma esta misma ronda del cuadro.
      s.copaBracket = { alive: s.bracket.alive, stageIndex: s.bracket.stageIndex, champion: null, runnerUp: null };
      s.bracket = null;
      this.enterEditionRound();
      return;
    }
    this.resolveBracketStage();
  },

  // Simula el resto del cuadro sin intervención del usuario (no clasificó,
  // ya quedó eliminado, o le tocó un bye) y define campeón y subcampeón.
  simulateBracketFully() {
    const s = this.state;
    const result = this.simulateSeedsToChampion(s.bracket.alive);
    s.bracket.champion = result.champion;
    s.bracket.runnerUp = result.runnerUp;
    this.onBracketComplete();
  },

  onBracketComplete() {
    const s = this.state;
    const season = s.season;
    const kind = s.bracket.kind;

    if (kind === 'apertura' || kind === 'clausura') {
      season.myD1[kind].champion = s.bracket.champion;
      season.myD1[kind].runnerUp = s.bracket.runnerUp;
      s.bracket = null;
      if (kind === 'apertura') this.startTransferWindow();
      else this.finishMyDivisionYear();
      return;
    }

    if (kind === 'copa') {
      s.copaBracket = { alive: [{ id: s.bracket.champion, seed: 1 }], stageIndex: s.bracket.stageIndex, champion: s.bracket.champion, runnerUp: s.bracket.runnerUp };
      s.log.unshift(`Copa Argentina: salió campeón ${this.getClub(s.bracket.champion).name}.`);
      s.bracket = null;
      this.enterEditionRound();
      return;
    }
    this.save();
  },

  // ---------- Ventana de pases ----------

  startTransferWindow() {
    const s = this.state;
    s.season.transferReason = 'between-editions';
    s.market = this.generateMarket();
    s.screen = 'transfer';
    this.save();
  },

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
    this.startEdition('clausura');
    this.save();
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
    this.enterEditionRound();
    this.save();
  },

  // ---------- Fin de año: promedios, ascensos/descensos y cupos a copas ----------

  // Reparte de nuevo las zonas de una división para que queden equilibradas
  // (15/15 en Primera, 18/18 en la Nacional) después de mover clubes por
  // ascenso/descenso. Se mezcla al azar, igual que un sorteo de zonas real.
  rebalanceZones(division, perZone) {
    const clubs = this.state.clubs.filter((c) => c.division === division);
    const shuffled = [...clubs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach((club, i) => { club.zone = i < perZone ? 'A' : 'B'; });
  },

  updateClubHistories(tablaAnualD1) {
    tablaAnualD1.forEach((row) => {
      const club = this.getClub(row.id);
      if (!club.history) club.history = [];
      club.history.push({ points: row.pts, played: row.played });
      if (club.history.length > 3) club.history.shift();
    });
  },

  assignQualification(d1Data, relegatedD1Ids) {
    const s = this.state;
    const assigned = new Set();
    const results = [];
    const grant = (clubId, comp, stage) => {
      if (!clubId || assigned.has(clubId)) return false;
      assigned.add(clubId);
      results.push({ clubId, name: this.getClub(clubId).name, comp, stage });
      return true;
    };

    const relegatedSet = new Set(relegatedD1Ids);
    let libertadoresPorTablaNeeded = 2; // 1° y 2° de la tabla anual
    const grantTitle = (clubId) => {
      if (!clubId) { libertadoresPorTablaNeeded++; return; }
      if (relegatedSet.has(clubId)) { libertadoresPorTablaNeeded++; return; } // pierde el cupo por descenso
      const granted = grant(clubId, 'Libertadores', 'Directo');
      if (!granted) libertadoresPorTablaNeeded++; // ya clasificado por otro título: libera el cupo y se reparte por tabla
    };

    grantTitle(d1Data.aperturaChampion);
    grantTitle(d1Data.clausuraChampion);
    grantTitle(s.copaBracket.champion);

    const tablaAnual = d1Data.tablaAnualYear;

    let cursor = 0;
    while (libertadoresPorTablaNeeded > 0 && cursor < tablaAnual.length) {
      if (!assigned.has(tablaAnual[cursor].id)) { grant(tablaAnual[cursor].id, 'Libertadores', 'Fase previa'); libertadoresPorTablaNeeded--; }
      cursor++;
    }

    let repechajeIdx = 8; // 9° puesto (índice 8)
    while (repechajeIdx < tablaAnual.length && assigned.has(tablaAnual[repechajeIdx].id)) repechajeIdx++;
    if (repechajeIdx < tablaAnual.length) grant(tablaAnual[repechajeIdx].id, 'Libertadores', 'Repechaje');

    let sudaNeeded = 6;
    let sudaIdx = 2; // 3° puesto (índice 2)
    while (sudaNeeded > 0 && sudaIdx < tablaAnual.length) {
      if (!assigned.has(tablaAnual[sudaIdx].id)) { grant(tablaAnual[sudaIdx].id, 'Sudamericana', 'Fase de grupos'); sudaNeeded--; }
      sudaIdx++;
    }

    return results;
  },

  // Elige 2 clubes al azar de la reserva (ex Primera Nacional, ya no se
  // simula partido a partido) para que asciendan a Primera.
  promoteFromReserve() {
    const s = this.state;
    const pool = s.clubs.filter((c) => c.division === 'D2').map((c) => c.id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 2);
  },

  finishMyDivisionYear() {
    const s = this.state;
    const season = s.season;
    // Se captura ANTES de rebalancear zonas: el rebalanceo reasigna la zona
    // de todos los clubes, así que consultar club.zone después ya no sirve
    // para saber quién jugó en tu zona ESTA temporada.
    const myZoneClubIds = new Set(season.zones[this.myZoneKey()].clubIds);

    const d1Data = {
      tablaAnualYear: this.combineEditionTables(season.myD1.apertura, season.myD1.clausura),
      aperturaChampion: season.myD1.apertura.champion,
      clausuraChampion: season.myD1.clausura.champion,
    };
    const tablaAnualD1 = d1Data.tablaAnualYear;
    this.updateClubHistories(tablaAnualD1);

    // Tu club nunca puede ser uno de los 2 descensos: como la Primera
    // Nacional ya no se juega, no tendrías dónde disputar la siguiente
    // temporada. Los otros 29 sí compiten normalmente por el descenso.
    const relegationCandidates = tablaAnualD1.filter((r) => r.id !== s.clubId);
    const lastByTable = relegationCandidates[relegationCandidates.length - 1].id;
    const promedios = relegationCandidates.map((row) => {
      const club = this.getClub(row.id);
      const totalPts = club.history.reduce((sum, h) => sum + h.points, 0);
      const totalPlayed = club.history.reduce((sum, h) => sum + h.played, 0);
      return { id: row.id, coef: totalPlayed > 0 ? totalPts / totalPlayed : 0 };
    }).sort((a, b) => a.coef - b.coef);
    let worstPromedio = promedios[0].id;
    if (worstPromedio === lastByTable) worstPromedio = promedios[1] ? promedios[1].id : null;
    const relegated = worstPromedio && worstPromedio !== lastByTable ? [lastByTable, worstPromedio] : [lastByTable];

    const promoted = this.promoteFromReserve();

    relegated.forEach((id) => { this.getClub(id).division = 'D2'; });
    promoted.forEach((id) => { this.getClub(id).division = 'D1'; });
    this.rebalanceZones('D1', 15);

    const qualification = this.assignQualification(d1Data, relegated);

    const userRelegated = relegated.includes(s.clubId);
    let economyNote = '';
    if (userRelegated) {
      const penalty = Math.round(s.budget * 0.25);
      s.budget -= penalty;
      economyNote = `Por el descenso, el presupuesto bajó $${penalty.toLocaleString('es-AR')} para la próxima temporada.`;
    } else {
      const pos = tablaAnualD1.findIndex((r) => r.id === s.clubId) + 1;
      const bonus = Math.max(0, Math.round((31 - pos) * 120000));
      s.budget += bonus;
      economyNote = `Premio por terminar ${pos}° en la tabla anual: $${bonus.toLocaleString('es-AR')}.`;
    }

    s.lastSeasonSummary = {
      // tablaAnualD1 ya viene ordenada por puntos: filtrar preserva el orden relativo.
      myZoneTable: tablaAnualD1.filter((r) => myZoneClubIds.has(r.id)),
      tablaAnualD1,
      aperturaChampion: d1Data.aperturaChampion ? this.getClub(d1Data.aperturaChampion).name : null,
      clausuraChampion: d1Data.clausuraChampion ? this.getClub(d1Data.clausuraChampion).name : null,
      userWasAperturaChampion: d1Data.aperturaChampion === s.clubId,
      userWasClausuraChampion: d1Data.clausuraChampion === s.clubId,
      copaChampionName: s.copaBracket.champion ? this.getClub(s.copaBracket.champion).name : null,
      userWonCopa: s.copaBracket.champion === s.clubId,
      qualification,
      relegated: relegated.map((id) => this.getClub(id).name),
      promoted: promoted.map((id) => this.getClub(id).name),
      userRelegated,
      economyNote,
    };

    s.squad.forEach((p) => { p.age++; });
    s.screen = 'season-end';
    this.save();
  },
};
