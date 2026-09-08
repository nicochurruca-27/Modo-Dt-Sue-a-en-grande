// Lógica del juego: estado, generación de datos y simulación.
// Todo vive en el objeto global `Engine`. No usa módulos para poder
// abrirse el juego directamente con doble click (sin servidor).

const SAVE_KEY = 'dt-simulador-save-v1';

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
    return CLUBS.find((c) => c.id === id);
  },

  randomPlayerName() {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    return `${first} ${last}`;
  },

  generateSquad(club) {
    return SQUAD_POSITIONS.map((pos, i) => {
      const base = 48 + club.reputation * 6;
      const rating = Math.max(38, Math.min(96, Math.round(base + (Math.random() * 16 - 8))));
      return { id: `${club.id}-${i}`, name: this.randomPlayerName(), pos, rating };
    });
  },

  squadStrength(squad) {
    const top11 = [...squad].sort((a, b) => b.rating - a.rating).slice(0, 11);
    const avg = top11.reduce((sum, p) => sum + p.rating, 0) / top11.length;
    return avg;
  },

  // Método del círculo: genera todos-contra-todos ida y vuelta para 6 equipos.
  buildSchedule(clubIds) {
    const n = clubIds.length;
    const arr = clubIds.slice();
    const firstLeg = [];
    for (let r = 0; r < n - 1; r++) {
      const roundMatches = [];
      for (let i = 0; i < n / 2; i++) {
        const home = arr[i];
        const away = arr[n - 1 - i];
        roundMatches.push(r % 2 === 0 ? { home, away } : { home: away, away: home });
      }
      firstLeg.push(roundMatches);
      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr.splice(0, arr.length, fixed, ...rest);
    }
    const secondLeg = firstLeg.map((round) => round.map((m) => ({ home: m.away, away: m.home })));
    return firstLeg.concat(secondLeg);
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

  clubBaseStrength(clubId) {
    const club = this.getClub(clubId);
    if (clubId === this.state.clubId) return this.squadStrength(this.state.squad);
    return 48 + club.reputation * 6 + (Math.random() * 10 - 5);
  },

  simulateScore(homeStrength, awayStrength, homeAdvantage) {
    const diff = homeStrength - awayStrength;
    const lambdaHome = Math.max(0.2, Math.min(4.5, 1.35 + diff / 12 + homeAdvantage / 10));
    const lambdaAway = Math.max(0.15, Math.min(4, 1.05 - diff / 12));
    return {
      homeGoals: this.samplePoisson(lambdaHome),
      awayGoals: this.samplePoisson(lambdaAway),
    };
  },

  newGame(clubId) {
    const club = this.getClub(clubId);
    const clubIds = CLUBS.map((c) => c.id);
    this.state = {
      screen: 'pre-match',
      clubId,
      budget: club.budget,
      morale: 0,
      squad: this.generateSquad(club),
      round: 0,
      schedule: this.buildSchedule(clubIds),
      table: Object.fromEntries(clubIds.map((id) => [id, this.emptyTableRow()])),
      currentDecision: null,
      pendingMatch: null,
      lastDecisionNote: null,
      log: [],
    };
    this.pickDecision();
    this.save();
  },

  pickDecision() {
    const pool = DECISIONS;
    this.state.currentDecision = pool[Math.floor(Math.random() * pool.length)];
  },

  findUserMatch(round) {
    return round.find((m) => m.home === this.state.clubId || m.away === this.state.clubId);
  },

  chooseDecision(optionIndex) {
    const s = this.state;
    const option = s.currentDecision.options[optionIndex];
    s.lastDecisionNote = option.note;
    s.morale = Math.max(-15, Math.min(15, s.morale + option.moraleMod));

    const round = s.schedule[s.round];
    const userMatch = this.findUserMatch(round);
    const isHome = userMatch.home === s.clubId;
    const opponentId = isHome ? userMatch.away : userMatch.home;

    const myStrength = this.squadStrength(s.squad) + option.tacticMod + s.morale / 3;
    const oppStrength = this.clubBaseStrength(opponentId);
    const homeAdvantage = 4;

    const homeStrength = isHome ? myStrength : oppStrength;
    const awayStrength = isHome ? oppStrength : myStrength;
    const score = this.simulateScore(homeStrength, awayStrength, homeAdvantage);

    const match = {
      home: userMatch.home,
      away: userMatch.away,
      homeGoals: score.homeGoals,
      awayGoals: score.awayGoals,
      isHome,
      opponentId,
      penalty: null,
    };

    s.pendingMatch = match;

    // 25% de chances de que haya un penal en el partido del usuario.
    if (Math.random() < 0.25) {
      const attackingSide = Math.random() < 0.5 ? 'user' : 'rival';
      s.pendingMatch.penalty = { side: attackingSide, resolved: false, scored: null };
      s.screen = 'penalty';
    } else {
      s.screen = 'match-result';
    }
    this.save();
  },

  getPenaltyShooters() {
    return [...this.state.squad]
      .filter((p) => p.pos === 'DEL' || p.pos === 'MED')
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);
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
      const rating = shooterOrKeeper.rating;
      const matched = guess === direction;
      const baseChance = matched ? 0.3 : 0.9;
      const chance = Math.max(0.05, Math.min(0.97, baseChance + (rating - 70) / 300));
      scored = Math.random() < chance;
      pen.shooterName = shooterOrKeeper.name;
      pen.direction = direction;
      pen.keeperGuess = guess;
    } else {
      const rating = shooterOrKeeper.rating; // arquero
      const matched = guess === direction;
      const baseChance = matched ? 0.35 : 0.05;
      const chance = Math.max(0.03, Math.min(0.8, baseChance + (rating - 70) / 300));
      scored = !(Math.random() < chance); // si atajó, no hay gol
      pen.keeperName = shooterOrKeeper.name;
      pen.direction = direction;
      pen.shotGuess = guess;
    }

    pen.resolved = true;
    pen.scored = scored;

    if (scored) {
      if (pen.side === 'user') {
        if (s.pendingMatch.isHome) s.pendingMatch.homeGoals++;
        else s.pendingMatch.awayGoals++;
      } else if (s.pendingMatch.isHome) {
        s.pendingMatch.awayGoals++;
      } else {
        s.pendingMatch.homeGoals++;
      }
    }

    s.screen = 'match-result';
    this.save();
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

  finishMatchAndAdvance() {
    const s = this.state;
    const m = s.pendingMatch;
    this.updateTableRow(s.table, m.home, m.homeGoals, m.awayGoals);
    this.updateTableRow(s.table, m.away, m.awayGoals, m.homeGoals);

    const clubName = (id) => this.getClub(id).name;
    s.log.unshift(`${clubName(m.home)} ${m.homeGoals} - ${m.awayGoals} ${clubName(m.away)}`);

    const round = s.schedule[s.round];
    round.forEach((fixture) => {
      if (fixture === m || (fixture.home === m.home && fixture.away === m.away)) return;
      if (fixture.home === s.clubId || fixture.away === s.clubId) return;
      const homeStrength = this.clubBaseStrength(fixture.home);
      const awayStrength = this.clubBaseStrength(fixture.away);
      const score = this.simulateScore(homeStrength, awayStrength, 4);
      this.updateTableRow(s.table, fixture.home, score.homeGoals, score.awayGoals);
      this.updateTableRow(s.table, fixture.away, score.awayGoals, score.homeGoals);
    });

    s.pendingMatch = null;
    s.round++;

    if (s.round >= s.schedule.length) {
      s.screen = 'season-end';
    } else if (s.round % 3 === 0) {
      s.market = this.generateMarket();
      s.screen = 'transfer';
    } else {
      this.pickDecision();
      s.screen = 'pre-match';
    }
    this.save();
  },

  generateMarket() {
    const club = this.getClub(this.state.clubId);
    return Array.from({ length: 3 }, (_, i) => {
      const pos = SQUAD_POSITIONS[Math.floor(Math.random() * SQUAD_POSITIONS.length)];
      const rating = Math.max(40, Math.min(95, Math.round(48 + club.reputation * 6 + (Math.random() * 20 - 6))));
      const price = Math.round(rating * 15000 * (0.8 + Math.random() * 0.4));
      return { id: `market-${this.state.round}-${i}`, name: this.randomPlayerName(), pos, rating, price };
    });
  },

  buyPlayer(marketIndex) {
    const s = this.state;
    const offer = s.market[marketIndex];
    if (!offer || s.budget < offer.price) return false;
    s.budget -= offer.price;
    // Reemplaza al peor jugador de esa posición (o al peor del plantel si no hay de esa posición).
    const samePos = s.squad.filter((p) => p.pos === offer.pos);
    const target = (samePos.length ? samePos : s.squad).sort((a, b) => a.rating - b.rating)[0];
    const idx = s.squad.findIndex((p) => p.id === target.id);
    s.squad[idx] = { id: offer.id, name: offer.name, pos: offer.pos, rating: offer.rating };
    s.market.splice(marketIndex, 1);
    this.save();
    return true;
  },

  sellPlayer(squadIndex) {
    const s = this.state;
    if (s.squad.length <= 12) return false; // no vender por debajo de un plantel mínimo jugable
    const player = s.squad[squadIndex];
    const value = Math.round(player.rating * 15000 * 0.7);
    s.budget += value;
    s.squad.splice(squadIndex, 1);
    this.save();
    return true;
  },

  continueFromTransfer() {
    this.pickDecision();
    this.state.screen = 'pre-match';
    this.save();
  },

  getTableSorted() {
    const s = this.state;
    return Object.entries(s.table)
      .map(([id, row]) => ({ id, name: this.getClub(id).name, ...row }))
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  },
};
