// Lógica del juego: estado, generación de datos y simulación.
// Todo vive en el objeto global `Engine`. No usa módulos para poder
// abrirse el juego directamente con doble click (sin servidor).
//
// Estructura de la temporada (basada en el formato real de AFA 2026, con
// algunas simplificaciones documentadas en el README):
// - Primera División: 30 clubes en 2 zonas de 15. Se juegan DOS torneos por
//   año —Apertura y Clausura—, cada uno con fase de zonas a una rueda y
//   playoffs de octavos a la final (16 mejores de la tabla combinada de esa
//   edición). Entre ambos torneos hay una ventana de pases.
// - Primera Nacional: 36 clubes en 2 zonas de 18, un solo torneo anual a una
//   rueda. Ascienden 2: el ganador de una Final directa entre los líderes de
//   cada zona, y el ganador de un Torneo Reducido (2º a 8º de cada zona +
//   el perdedor de la Final).
// - Copa Argentina: se sortea un cuadro de 32 al arrancar el año (los 30
//   clubes de Primera + 2 de la Nacional, garantizando que tu club esté
//   adentro), y se juega en simultáneo con la primera edición del año
//   (dieciseisavos a la final). El resto del cuadro se resuelve solo según
//   la fuerza de cada club; si no la ganás vos, sale campeón el que gane esa
//   simulación (no queda "vacante").
// - Fechas FIFA: pausan la liga y muestran si algún jugador destacado fue
//   convocado a su selección.
// - Descienden 2 de Primera por año: el último de la Tabla Anual (suma de
//   Apertura + Clausura) y el peor promedio de puntos por partido de las
//   últimas 3 temporadas en Primera (si coinciden, el segundo descenso pasa
//   al siguiente peor promedio).
// - Cupos a copas internacionales: 6 a Libertadores (campeón Apertura,
//   campeón Clausura, campeón Copa Argentina, 1º y 2º de la Tabla Anual, y
//   un repechaje anclado en el 9º), y 6 a Sudamericana (del 3º al 8º de la
//   Tabla Anual), salteando siempre clubes ya clasificados por otra vía. Si
//   un campeón desciende esa misma temporada, pierde el cupo directo y este
//   se reparte igual por tabla.
// - La división en la que NO juega el usuario se simula completa e
//   instantáneamente al arrancar el año (no hay nada interactivo ahí), para
//   que los cupos a copas y los ascensos/descensos tengan sentido siempre.

const SAVE_KEY = 'dt-simulador-save-v3';

const FIFA_ROUNDS = [5, 11];
const COPA_ROUNDS = [2, 4, 7, 10, 13];
const COPA_STAGE_NAMES = ['Dieciseisavos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];
const TRANSFER_ROUND_D2 = 9; // ventana de pases de la Nacional, a mitad de su único torneo
const TOTAL_ROUNDS = { D1: 15, D2: 17 };
const PLAYOFF_STAGES = ['Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];
const REDUCIDO_STAGES = ['Primera Rueda del Reducido', 'Cuartos del Reducido', 'Semifinal del Reducido', 'Final del Reducido'];
const BRACKET_KIND_LABELS = {
  apertura: 'Playoffs del Apertura',
  clausura: 'Playoffs del Clausura',
  copa: 'Copa Argentina',
  'final-directa': 'Final por el Ascenso',
  reducido: 'Torneo Reducido',
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
    this.state = { screen: 'dt-create' };
  },

  // Primer paso de toda carrera nueva: nombre, nacionalidad y estilo
  // personal del DT (no del equipo — eso lo sigue definiendo la
  // formación). El estilo da un empujoncito de sabor al arrancar la
  // carrera, nada que rompa el balance del juego:
  // - Ofensivo: arranca con más confianza (+10 de ánimo).
  // - Conservador: administra mejor la caja (+10% de presupuesto inicial).
  // - Equilibrado: sin bonus, deja que el club hable por sí solo.
  createDT(name, nation, style) {
    const cleanName = (name || '').trim().slice(0, 30) || 'DT';
    this.state = { screen: 'club-select', dt: { name: cleanName, nation, style } };
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

  // Si el club tiene un plantel real cargado en players.js, se usa ese en
  // vez de generar jugadores al azar. Ver REAL_ROSTERS en ese archivo.
  generateSquad(club) {
    const real = REAL_ROSTERS[club.id];
    if (real && real.length >= 11) {
      return real.map((p, i) => ({
        id: `${club.id}-${i}`, name: p.name, pos: p.pos, rating: p.rating, age: p.age, nation: p.nation, contractYears: p.contractYears, number: p.number, role: p.role,
      }));
    }
    const MED_ROLES = ['contención', 'mixto', 'ofensivo'];
    return SQUAD_POSITIONS.map((pos, i) => {
      const base = 44 + club.reputation * 6;
      const rating = Math.max(35, Math.min(90, Math.round(base + (Math.random() * 16 - 8))));
      const age = Math.round(17 + Math.random() * 18);
      const nation = this.rollNation();
      const contractYears = 1 + Math.floor(Math.random() * 4); // 1-4 años de contrato restantes
      const role = pos === 'MED' ? MED_ROLES[Math.floor(Math.random() * MED_ROLES.length)] : undefined;
      return { id: `p${i}`, name: this.randomPlayerName(nation), pos, rating, age, nation, contractYears, role };
    });
  },

  // La fuerza de TU equipo sale del once que realmente vas a poner en cancha
  // (según la formación elegida), no de los 11 mejores del plantel sin más:
  // una formación con 5 defensores igual tiene que poner 5, aunque el 5º no
  // sea tan bueno como un delantero suplente. Además cuenta la valoración
  // EFECTIVA de cada uno (ver effectiveRating): jugar fuera de puesto rinde
  // menos que en su posición natural.
  squadStrength() {
    const xi = this.getStartingXI().starters;
    return xi.reduce((sum, p) => sum + p.effectiveRating, 0) / xi.length;
  },

  clubStrength(clubId) {
    if (clubId === this.state.clubId) return this.squadStrength();
    const club = this.getClub(clubId);
    return 44 + club.reputation * 6 + (Math.random() * 10 - 5);
  },

  // ---------- Formación y once titular ----------
  //
  // El once se guarda como "slots" (s.startingSlots): 11 casilleros fijos
  // según la formación elegida (1 POR + los DEF/MED/DEL que toquen), cada
  // uno con el id del jugador que lo ocupa. Así la forma de la cancha
  // (cuántos hay en cada línea) la define SIEMPRE la formación elegida, sin
  // importar a quién pongas en cada casillero — cambiar un jugador de lugar
  // nunca cambia la formación por sí solo.
  //
  // Se puede poner a cualquiera en cualquier casillero (el usuario decide),
  // pero jugar fuera de su posición natural le baja el rendimiento: ver
  // positionFit/effectiveRating más abajo.

  currentFormation() {
    return FORMATIONS.find((f) => f.id === this.state.formation) || FORMATIONS.find((f) => f.id === '433') || FORMATIONS[0];
  },

  setFormation(id) {
    if (!FORMATIONS.some((f) => f.id === id)) return;
    this.state.formation = id;
    this.recomputeStartingSlots();
    this.save();
  },

  // 'OFF' es la línea de enganches/mediapuntas/extremos entre el mediocampo
  // y el ataque (4-3-1-2, 4-2-3-1, 3-2-5, etc.) — no es una posición real de
  // ningún jugador (el plantel solo tiene POR/DEF/MED/DEL), es un casillero
  // más en la cancha.
  slotOrderForFormation(formation) {
    return [
      'POR',
      ...Array(formation.def).fill('DEF'),
      ...Array(formation.med).fill('MED'),
      ...Array(formation.off || 0).fill('OFF'),
      ...Array(formation.del).fill('DEL'),
    ];
  },

  // Qué posiciones reales sirven para cubrir cada casillero, de mejor a peor
  // candidato. El casillero OFF no es una posición real: se cubre primero
  // con mediocampistas (mediapuntas) y si no hay, con delanteros.
  preferredPositionsForSlot(slot) {
    return slot === 'OFF' ? ['MED', 'DEL'] : [slot];
  },

  // Arma el once automáticamente: para cada casillero busca el mejor jugador
  // libre entre sus posiciones candidatas (ver preferredPositionsForSlot); si
  // no alcanzan (plantel chico), completa los casilleros que queden vacíos
  // con lo mejor que sobre. Se usa al arrancar la carrera y al cambiar de
  // formación (ahí sí se resetean las elecciones manuales, porque cambiar de
  // formación es una acción explícita del usuario).
  recomputeStartingSlots() {
    const s = this.state;
    const formation = this.currentFormation();
    const usedIds = new Set();
    const bestFor = (slot) => {
      for (const pos of this.preferredPositionsForSlot(slot)) {
        const p = [...s.squad].filter((pl) => !usedIds.has(pl.id) && pl.pos === pos).sort((a, b) => b.rating - a.rating)[0];
        if (p) return p;
      }
      return null;
    };
    let slots = this.slotOrderForFormation(formation).map((slot) => {
      const p = bestFor(slot);
      if (!p) return { slot, playerId: null };
      usedIds.add(p.id);
      return { slot, playerId: p.id };
    });
    const leftover = [...s.squad].filter((p) => !usedIds.has(p.id)).sort((a, b) => b.rating - a.rating);
    slots = slots.map((entry) => {
      if (entry.playerId) return entry;
      const p = leftover.shift();
      return p ? { slot: entry.slot, playerId: p.id } : entry;
    });
    s.startingSlots = slots;
  },

  // Saca de los casilleros a cualquiera que ya no esté en el plantel (se
  // vendió, se dejó ir, etc.) y completa lo que falte, priorizando su
  // posición natural. Mantiene el resto de las elecciones manuales tal cual
  // estaban.
  repairStartingSlots() {
    const s = this.state;
    if (!s.startingSlots) { this.recomputeStartingSlots(); return; }
    const squadIds = new Set(s.squad.map((p) => p.id));
    const usedIds = new Set();
    s.startingSlots = s.startingSlots.map((entry) => {
      if (entry.playerId && squadIds.has(entry.playerId)) { usedIds.add(entry.playerId); return entry; }
      return { slot: entry.slot, playerId: null };
    });
    s.startingSlots = s.startingSlots.map((entry) => {
      if (entry.playerId) return entry;
      let pick = null;
      for (const pos of this.preferredPositionsForSlot(entry.slot)) {
        pick = [...s.squad].filter((p) => !usedIds.has(p.id) && p.pos === pos).sort((a, b) => b.rating - a.rating)[0];
        if (pick) break;
      }
      if (!pick) pick = [...s.squad].filter((p) => !usedIds.has(p.id)).sort((a, b) => b.rating - a.rating)[0];
      if (!pick) return entry;
      usedIds.add(pick.id);
      return { slot: entry.slot, playerId: pick.id };
    });
  },

  // Qué tan bien le queda a cada posición real jugar en cada casillero.
  // Simétrica (POR-DEF vale lo mismo que DEF-POR). OFF (enganche/mediapunta)
  // se cubre naturalmente con MED (así clasificamos a los mediapuntas en el
  // plantel) y razonablemente con DEL; el arquero en cualquier lado que no
  // sea el arco es siempre grave.
  //
  // Dentro de MED hay además un rol (`player.role`: 'contención' | 'mixto'
  // | 'ofensivo') que solo importa cuando la formación tiene línea de
  // enganche (formation.off > 0): ahí sí hay una diferencia real entre "el
  // 5" (el casillero MED, más de marca) y el enganche (el casillero OFF,
  // más ofensivo), y no es lo mismo poner a cualquier mediocampista en
  // cualquiera de los dos. En formaciones de 3 líneas (sin OFF) el mediocampo
  // es una sola banda sin esa distinción, así que el rol no cambia nada ahí.
  positionFit(player, slot, formation) {
    const playerPos = player.pos;
    if (playerPos === 'MED' && formation && formation.off && player.role) {
      if (slot === 'OFF') {
        if (player.role === 'contención') return { color: 'red', mult: 0.55 };
        return { color: 'green', mult: 1 }; // ofensivo o mixto: es lo suyo
      }
      if (slot === 'MED') {
        if (player.role === 'ofensivo') return { color: 'yellow', mult: 0.85 };
        return { color: 'green', mult: 1 }; // contención o mixto: es lo suyo
      }
    }
    if (playerPos === slot) return { color: 'green', mult: 1 };
    const table = {
      'DEF-MED': { color: 'yellow', mult: 0.85 },
      'DEL-MED': { color: 'yellow', mult: 0.85 },
      'MED-OFF': { color: 'green', mult: 1 },
      'DEL-OFF': { color: 'yellow', mult: 0.85 },
      'DEF-DEL': { color: 'red', mult: 0.72 },
      'DEF-OFF': { color: 'red', mult: 0.5 },
      'DEF-POR': { color: 'red', mult: 0.55 },
      'MED-POR': { color: 'red', mult: 0.45 },
      'OFF-POR': { color: 'red', mult: 0.4 },
      'DEL-POR': { color: 'red', mult: 0.35 },
    };
    const key = [playerPos, slot].sort().join('-');
    return table[key] || { color: 'red', mult: 0.5 };
  },

  effectiveRating(player, slot, formation) {
    return Math.round(player.rating * this.positionFit(player, slot, formation).mult);
  },

  getStartingXI() {
    const s = this.state;
    if (!s.startingSlots || !s.startingSlots.length) this.recomputeStartingSlots();
    const formation = this.currentFormation();
    const rows = { POR: [], DEF: [], MED: [], OFF: [], DEL: [] };
    const starters = [];
    s.startingSlots.forEach(({ slot, playerId }) => {
      const p = s.squad.find((pl) => pl.id === playerId);
      if (!p) return;
      const fit = this.positionFit(p, slot, formation);
      const entry = { ...p, slot, fit: fit.color, effectiveRating: this.effectiveRating(p, slot, formation) };
      rows[slot].push(entry);
      starters.push(entry);
    });
    return {
      formation,
      gk: rows.POR,
      def: rows.DEF,
      med: rows.MED,
      off: rows.OFF,
      del: rows.DEL,
      starters,
    };
  },

  getBench() {
    const s = this.state;
    if (!s.startingSlots || !s.startingSlots.length) this.recomputeStartingSlots();
    const startingSet = new Set(s.startingSlots.map((e) => e.playerId).filter(Boolean));
    return [...s.squad].filter((p) => !startingSet.has(p.id)).sort((a, b) => b.rating - a.rating);
  },

  // Intercambia dos jugadores cualesquiera: dos titulares (se cambian de
  // casillero entre sí), un titular y un suplente (el suplente entra a ese
  // casillero), o nada si los dos son suplentes (ninguno ocupa un casillero
  // para intercambiar). Es lo que dispara tocar/arrastrar dos jugadores en
  // la UI. Se puede cambiar por alguien de OTRA posición a propósito — el
  // que entra rinde según positionFit, pero la formación (los casilleros en
  // sí) nunca cambia por hacer un cambio.
  swapPlayers(idA, idB) {
    const s = this.state;
    if (!s.startingSlots || idA === idB) return false;
    const slotA = s.startingSlots.find((e) => e.playerId === idA);
    const slotB = s.startingSlots.find((e) => e.playerId === idB);
    if (slotA && slotB) {
      slotA.playerId = idB;
      slotB.playerId = idA;
      this.save();
      return true;
    }
    if (!slotA && !slotB) return false;
    const starterEntry = slotA || slotB;
    const benchId = slotA ? idB : idA;
    if (!s.squad.some((p) => p.id === benchId)) return false;
    starterEntry.playerId = benchId;
    this.save();
    return true;
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

  simulateRoundOntoTable(round, table) {
    round.forEach((fixture) => {
      const hs = this.clubStrength(fixture.home);
      const as = this.clubStrength(fixture.away);
      const score = this.simulateScore(hs, as, 4);
      this.updateTableRow(table, fixture.home, score.homeGoals, score.awayGoals);
      this.updateTableRow(table, fixture.away, score.awayGoals, score.homeGoals);
    });
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

  // ---------- Simulación instantánea de la división en la que NO juega el usuario ----------

  simulateFullDivisionYear(division) {
    const s = this.state;
    const idsA = s.clubs.filter((c) => c.division === division && c.zone === 'A').map((c) => c.id);
    const idsB = s.clubs.filter((c) => c.division === division && c.zone === 'B').map((c) => c.id);

    const runZoneStage = () => {
      const tableA = Object.fromEntries(idsA.map((id) => [id, this.emptyTableRow()]));
      const tableB = Object.fromEntries(idsB.map((id) => [id, this.emptyTableRow()]));
      this.buildSchedule(idsA).forEach((round) => this.simulateRoundOntoTable(round, tableA));
      this.buildSchedule(idsB).forEach((round) => this.simulateRoundOntoTable(round, tableB));
      return { zoneATable: this.sortTable(tableA), zoneBTable: this.sortTable(tableB) };
    };

    if (division === 'D2') {
      const { zoneATable, zoneBTable } = runZoneStage();
      const finalWinner = this.resolveKnockout(zoneATable[0].id, zoneBTable[0].id);
      const finalLoser = finalWinner === zoneATable[0].id ? zoneBTable[0].id : zoneATable[0].id;
      const pool = zoneATable.slice(1, 8).concat(zoneBTable.slice(1, 8)).map((r) => r.id).concat([finalLoser]);
      const reducidoWinner = this.simulateKnockoutPool(pool);
      return { promoted: [finalWinner, reducidoWinner], zoneATable, zoneBTable };
    }

    const runEdition = () => {
      const { zoneATable, zoneBTable } = runZoneStage();
      const combined = zoneATable.concat(zoneBTable).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      const seeds = combined.slice(0, 16).map((r, i) => ({ id: r.id, seed: i + 1 }));
      const { champion, runnerUp } = this.simulateSeedsToChampion(seeds);
      return { zoneATable, zoneBTable, champion, runnerUp };
    };
    const apertura = runEdition();
    const clausura = runEdition();
    return {
      tablaAnualYear: this.combineEditionTables(apertura, clausura),
      aperturaChampion: apertura.champion,
      aperturaRunnerUp: apertura.runnerUp,
      clausuraChampion: clausura.champion,
      clausuraRunnerUp: clausura.runnerUp,
    };
  },

  // ---------- Ciclo de vida de la partida ----------

  newGame(clubId) {
    const dt = this.state && this.state.dt;
    this.state = {
      screen: 'pre-match',
      dt,
      clubId,
      clubs: CLUB_TEMPLATES.map((c) => ({ ...c, history: [] })),
      budget: 0,
      morale: dt && dt.style === 'ofensivo' ? 10 : 0,
      squad: null,
      formation: '433',
      startingSlots: null,
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
    let budget = this.startingBudget(club);
    if (dt && dt.style === 'conservador') budget = Math.round(budget * 1.1);
    this.state.budget = budget;
    this.state.squad = this.generateSquad(club);
    this.recomputeStartingSlots();
    this.startNewSeason();
    // La presentación en sociedad solo aparece al arrancar la carrera (acá,
    // después de armar la primera temporada): las temporadas siguientes
    // arrancan directo por startNewSeason() sin pasar por acá.
    this.state.objective = this.seasonObjective(club);
    this.state.screen = 'presentation';
  },

  // Qué le pide la dirigencia para esta temporada, según el nivel del club.
  // Es solo sabor/contexto (no afecta el cálculo del juego): le da un
  // objetivo a la carrera en vez de arrancar en el vacío.
  seasonObjective(club) {
    if (club.division === 'D1') {
      if (club.reputation >= 5) return { key: 'campeonato', text: 'Pelear el campeonato y meterse en la Copa Libertadores.' };
      if (club.reputation === 4) return { key: 'copas', text: 'Terminar entre los primeros puestos y clasificar a una copa internacional.' };
      if (club.reputation === 3) return { key: 'mitad-tabla', text: 'Consolidarse en la mitad de la tabla, sin sobresaltos.' };
      if (club.reputation === 2) return { key: 'no-descender', text: 'Terminar la temporada lejos de la zona de descenso.' };
      return { key: 'salvarse', text: 'Sobrevivir la temporada: cualquier cosa que no sea bajar de categoría ya es un buen año.' };
    }
    if (club.reputation >= 3) return { key: 'ascenso', text: 'Pelear el ascenso directo a Primera División.' };
    if (club.reputation === 2) return { key: 'reducido', text: 'Meterse en el Torneo Reducido y pelear el ascenso por ahí.' };
    return { key: 'consolidarse', text: 'Consolidar a la institución en la categoría, con los pies en la tierra.' };
  },

  // Las 3 respuestas posibles en la presentación en sociedad. Son genéricas
  // (no cambian según el objetivo) para arrancar simple; el efecto es un
  // empujón chico de ánimo, como cualquier otra decisión del juego.
  presentationResponses() {
    return [
      { label: 'Aceptar el desafío con confianza', moraleMod: 5, note: 'El plantel se entusiasma con el objetivo planteado.' },
      { label: 'Pedir tiempo, esto es un proceso', moraleMod: 0, note: 'La dirigencia entiende que hay que ir paso a paso.' },
      { label: 'Poner paños fríos, no prometer nada', moraleMod: -3, note: 'La cautela deja algo fría a la hinchada.' },
    ];
  },

  continueFromPresentation(optionIndex) {
    const s = this.state;
    const option = this.presentationResponses()[optionIndex];
    if (option) {
      s.morale = Math.max(-15, Math.min(15, s.morale + option.moraleMod));
      s.lastDecisionNote = option.note;
    }
    s.screen = 'pre-match';
    this.save();
  },

  // Arranca un año nuevo completo: simula instantáneamente la división en la
  // que el usuario no juega, y arranca la primera edición/etapa de la propia.
  startNewSeason() {
    const s = this.state;
    const club = this.getClub(s.clubId);
    const otherDivision = club.division === 'D1' ? 'D2' : 'D1';
    const prevYear = s.season ? s.season.year : 0;

    s.season = {
      year: prevYear + 1,
      myDivision: club.division,
      myZone: club.zone,
      edition: null,
      roundIndex: 0,
      totalRounds: TOTAL_ROUNDS[club.division],
      fifaShown: [],
      copaShown: [],
      transferShown: false,
      transferReason: null,
      zones: {},
      myD1: club.division === 'D1' ? { apertura: null, clausura: null } : null,
      myD2: club.division === 'D2' ? { zoneATable: null, zoneBTable: null, promotedDirect: null, promotedReducido: null } : null,
      backgroundResult: null,
    };
    s.bracket = null;
    s.lastSeasonSummary = null;

    s.season.backgroundResult = this.simulateFullDivisionYear(otherDivision);
    this.setupCopaBracket();

    this.startEdition(club.division === 'D1' ? 'apertura' : null);
  },

  // Sortea el cuadro de 32 de la Copa Argentina para todo el año: los 30
  // clubes de Primera + 2 de la Nacional. Si tu club juega en la Nacional,
  // se le garantiza un lugar (en la vida real muy pocos equipos de la
  // Nacional llegan tan lejos en la clasificación, pero así te aseguramos
  // que siempre tengas partidos de copa para jugar).
  setupCopaBracket() {
    const s = this.state;
    const club = this.getClub(s.clubId);
    const d1Ids = s.clubs.filter((c) => c.division === 'D1').map((c) => c.id);
    const d2Pool = s.clubs.filter((c) => c.division === 'D2' && c.id !== s.clubId).map((c) => c.id);
    for (let i = d2Pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d2Pool[i], d2Pool[j]] = [d2Pool[j], d2Pool[i]];
    }

    const entrants = d1Ids.slice();
    if (club.division === 'D2') entrants.push(s.clubId);
    while (entrants.length < 32) entrants.push(d2Pool.shift());

    for (let i = entrants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entrants[i], entrants[j]] = [entrants[j], entrants[i]];
    }
    s.copaBracket = { alive: entrants.map((id, i) => ({ id, seed: i + 1 })), stageIndex: 0, champion: null, runnerUp: null };
  },

  startEdition(edition) {
    const s = this.state;
    const season = s.season;
    const club = this.getClub(s.clubId);
    season.edition = edition;
    season.roundIndex = 0;
    season.fifaShown = [];
    season.copaShown = [];

    const zoneAId = `${club.division}-A`;
    const zoneBId = `${club.division}-B`;
    const idsA = s.clubs.filter((c) => c.division === club.division && c.zone === 'A').map((c) => c.id);
    const idsB = s.clubs.filter((c) => c.division === club.division && c.zone === 'B').map((c) => c.id);
    season.zones = {
      [zoneAId]: { clubIds: idsA, schedule: this.buildSchedule(idsA), table: Object.fromEntries(idsA.map((id) => [id, this.emptyTableRow()])) },
      [zoneBId]: { clubIds: idsB, schedule: this.buildSchedule(idsB), table: Object.fromEntries(idsB.map((id) => [id, this.emptyTableRow()])) },
    };

    this.enterEditionRound();
  },

  myZoneKey() {
    const s = this.state;
    return `${s.season.myDivision}-${s.season.myZone}`;
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

    if (season.myDivision === 'D2' && season.roundIndex === TRANSFER_ROUND_D2 && !season.transferShown) {
      season.transferShown = true;
      season.transferReason = 'mid-edition';
      s.market = this.generateMarket();
      s.screen = 'transfer';
      this.save();
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
    const myStrength = this.squadStrength() + option.tacticMod + this.currentFormation().mod + s.morale / 3;
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
      const myStrength = this.squadStrength();
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

  // ---------- Fin de zona: playoffs (Primera) o Final+Reducido (Nacional) ----------

  enterEditionPlayoffOrFinish() {
    const s = this.state;
    const season = s.season;
    const zoneA = season.zones[`${season.myDivision}-A`];
    const zoneB = season.zones[`${season.myDivision}-B`];
    const zoneATable = this.sortTable(zoneA.table);
    const zoneBTable = this.sortTable(zoneB.table);

    if (season.myDivision === 'D1') {
      const combined = zoneATable.concat(zoneBTable).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      const seeds = combined.slice(0, 16).map((r, i) => ({ id: r.id, seed: i + 1 }));
      season.myD1[season.edition] = { zoneATable, zoneBTable, champion: null, runnerUp: null };
      this.startBracket(season.edition, seeds, PLAYOFF_STAGES);
    } else {
      season.myD2 = { zoneATable, zoneBTable, promotedDirect: null, promotedReducido: null };
      const seeds = [{ id: zoneATable[0].id, seed: 1 }, { id: zoneBTable[0].id, seed: 2 }];
      this.startBracket('final-directa', seeds, ['Final por el Ascenso']);
    }
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

  simulateKnockoutPool(ids) {
    const seeds = ids.map((id, i) => ({ id, seed: i + 1 }));
    let target = 2;
    while (target < seeds.length) target *= 2;
    while (seeds.length < target) seeds.push({ id: null, seed: seeds.length + 1 });
    return this.simulateSeedsToChampion(seeds).champion;
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

    if (kind === 'final-directa') {
      const winner = s.bracket.champion;
      const loser = s.bracket.runnerUp;
      season.myD2.promotedDirect = winner;
      s.bracket = null;
      const pool = season.myD2.zoneATable.slice(1, 8).concat(season.myD2.zoneBTable.slice(1, 8)).map((r) => r.id).concat([loser]);
      const seeds = pool.map((id, i) => ({ id, seed: i + 1 }));
      seeds.push({ id: null, seed: seeds.length + 1 }); // 15 equipos -> se completa a 16 con 1 bye
      this.startBracket('reducido', seeds, REDUCIDO_STAGES);
      return;
    }

    if (kind === 'reducido') {
      season.myD2.promotedReducido = s.bracket.champion;
      s.bracket = null;
      this.finishMyDivisionYear();
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

  // A mitad de temporada (ventana entre Apertura y Clausura) es cuando en la
  // vida real empiezan a preocupar los contratos que vencen a fin de año:
  // por eso el aviso de renovación aparece acá, antes de abrir el mercado.
  startTransferWindow() {
    const s = this.state;
    s.season.transferReason = 'between-editions';
    s.contractQueue = s.squad.filter((p) => p.contractYears <= 1).map((p) => p.id);
    this.showNextContractDecision();
  },

  showNextContractDecision() {
    const s = this.state;
    if (!s.contractQueue || !s.contractQueue.length) {
      this.openTransferMarket();
      return;
    }
    s.screen = 'contract-renewal';
    this.save();
  },

  resolveContractDecision(renew) {
    const s = this.state;
    const playerId = s.contractQueue.shift();
    const player = s.squad.find((p) => p.id === playerId);
    // No se puede dejar ir a nadie si el plantel ya está en el mínimo jugable,
    // ni tampoco si es el único jugador que le queda al equipo en su
    // posición (por ejemplo, el último arquero: dejarlo ir rompería
    // cualquier pantalla que necesite un arquero, como los penales).
    const soleAtPosition = player && s.squad.filter((p) => p.pos === player.pos).length <= 1;
    if (player && (renew || s.squad.length <= 12 || soleAtPosition)) {
      const cost = Math.round(player.rating * 8000);
      s.budget -= cost;
      player.contractYears = 2 + Math.floor(Math.random() * 2);
    } else if (player) {
      s.squad = s.squad.filter((p) => p.id !== playerId);
      this.repairStartingSlots();
    }
    this.showNextContractDecision();
  },

  openTransferMarket() {
    const s = this.state;
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
    s.squad[idx] = { id: offer.id, name: offer.name, pos: offer.pos, rating: offer.rating, age: offer.age, nation: offer.nation, contractYears: 3 };
    s.market.splice(marketIndex, 1);
    this.repairStartingSlots();
    this.save();
    return true;
  },

  sellPlayer(squadIndex) {
    const s = this.state;
    if (s.squad.length <= 12) return false;
    const player = s.squad[squadIndex];
    s.budget += Math.round(player.rating * 15000 * 0.7);
    s.squad.splice(squadIndex, 1);
    this.repairStartingSlots();
    this.save();
    return true;
  },

  continueFromTransfer() {
    const s = this.state;
    if (s.season.transferReason === 'between-editions') this.startEdition('clausura');
    else this.enterEditionRound();
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

  finishMyDivisionYear() {
    const s = this.state;
    const season = s.season;
    const divisionThisSeason = season.myDivision;
    // Se captura ANTES de rebalancear zonas: el rebalanceo reasigna la zona
    // de todos los clubes, así que consultar club.zone después ya no sirve
    // para saber quién jugó en tu zona ESTA temporada.
    const myZoneClubIds = new Set(season.zones[this.myZoneKey()].clubIds);

    let myYearResult;
    if (divisionThisSeason === 'D1') {
      myYearResult = {
        tablaAnualYear: this.combineEditionTables(season.myD1.apertura, season.myD1.clausura),
        aperturaChampion: season.myD1.apertura.champion,
        clausuraChampion: season.myD1.clausura.champion,
      };
    } else {
      myYearResult = {
        promoted: [season.myD2.promotedDirect, season.myD2.promotedReducido],
        zoneATable: season.myD2.zoneATable,
        zoneBTable: season.myD2.zoneBTable,
      };
    }

    const bg = season.backgroundResult;
    const d1Data = divisionThisSeason === 'D1' ? myYearResult : bg;
    const d2Data = divisionThisSeason === 'D2' ? myYearResult : bg;

    const tablaAnualD1 = d1Data.tablaAnualYear;
    this.updateClubHistories(tablaAnualD1);
    const lastByTable = tablaAnualD1[tablaAnualD1.length - 1].id;
    const promedios = tablaAnualD1.map((row) => {
      const club = this.getClub(row.id);
      const totalPts = club.history.reduce((sum, h) => sum + h.points, 0);
      const totalPlayed = club.history.reduce((sum, h) => sum + h.played, 0);
      return { id: row.id, coef: totalPlayed > 0 ? totalPts / totalPlayed : 0 };
    }).sort((a, b) => a.coef - b.coef);
    let worstPromedio = promedios[0].id;
    if (worstPromedio === lastByTable) worstPromedio = promedios[1] ? promedios[1].id : null;
    const relegated = worstPromedio && worstPromedio !== lastByTable ? [lastByTable, worstPromedio] : [lastByTable];

    const promoted = d2Data.promoted.filter((id) => !!id);

    relegated.forEach((id) => { this.getClub(id).division = 'D2'; });
    promoted.forEach((id) => { this.getClub(id).division = 'D1'; });

    // Como el descenso (tabla anual + promedios) y el ascenso (Final directa +
    // Reducido) no respetan las zonas de origen, hay que volver a repartir las
    // zonas para que queden 15/15 en Primera y 18/18 en la Nacional. Los
    // clubes que no se movieron pueden cambiar de zona igual: en la vida real
    // la AFA también rearma las zonas cada temporada.
    this.rebalanceZones('D1', 15);
    this.rebalanceZones('D2', 18);

    const qualification = this.assignQualification(d1Data, relegated);

    const userRelegated = relegated.includes(s.clubId);
    const userPromoted = promoted.includes(s.clubId);
    let economyNote = '';
    if (userRelegated) {
      const penalty = Math.round(s.budget * 0.25);
      s.budget -= penalty;
      economyNote = `Por el descenso, el presupuesto bajó $${penalty.toLocaleString('es-AR')} para la próxima temporada.`;
    } else if (userPromoted) {
      s.budget += 400000;
      economyNote = 'Por el ascenso, la dirigencia sumó un refuerzo económico de $400.000.';
    } else if (divisionThisSeason === 'D1') {
      const pos = tablaAnualD1.findIndex((r) => r.id === s.clubId) + 1;
      const bonus = Math.max(0, Math.round((31 - pos) * 120000));
      s.budget += bonus;
      economyNote = `Premio por terminar ${pos}° en la tabla anual: $${bonus.toLocaleString('es-AR')}.`;
    } else {
      s.budget += 150000;
      economyNote = 'Ingresos de la temporada: $150.000.';
    }

    s.lastSeasonSummary = {
      division: divisionThisSeason,
      isD1: divisionThisSeason === 'D1',
      // tablaAnualD1 ya viene ordenada por puntos: filtrar preserva el orden relativo.
      myZoneTable: divisionThisSeason === 'D1'
        ? tablaAnualD1.filter((r) => myZoneClubIds.has(r.id))
        : (season.myZone === 'A' ? season.myD2.zoneATable : season.myD2.zoneBTable),
      tablaAnualD1,
      aperturaChampion: d1Data.aperturaChampion ? this.getClub(d1Data.aperturaChampion).name : null,
      clausuraChampion: d1Data.clausuraChampion ? this.getClub(d1Data.clausuraChampion).name : null,
      userWasAperturaChampion: d1Data.aperturaChampion === s.clubId,
      userWasClausuraChampion: d1Data.clausuraChampion === s.clubId,
      d2PromotedDirect: d2Data.promoted[0] ? this.getClub(d2Data.promoted[0]).name : null,
      d2PromotedReducido: d2Data.promoted[1] ? this.getClub(d2Data.promoted[1]).name : null,
      userPromotedDirect: d2Data.promoted[0] === s.clubId,
      userPromotedReducido: d2Data.promoted[1] === s.clubId,
      copaChampionName: s.copaBracket.champion ? this.getClub(s.copaBracket.champion).name : null,
      userWonCopa: s.copaBracket.champion === s.clubId,
      qualification,
      relegated: relegated.map((id) => this.getClub(id).name),
      promoted: promoted.map((id) => this.getClub(id).name),
      userRelegated,
      userPromoted,
      economyNote,
    };

    s.squad.forEach((p) => { p.age++; p.contractYears = Math.max(0, p.contractYears - 1); });
    s.screen = 'season-end';
    this.save();
  },
};
