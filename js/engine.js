// Lógica del juego: estado, generación de datos y simulación.
// Todo vive en el objeto global `Engine`. No usa módulos para poder
// abrirse el juego directamente con doble click (sin servidor).
//
// Estructura de la temporada (basada en el formato real de AFA 2026, con
// algunas simplificaciones documentadas en el README):
// - Primera División: 30 clubes en 2 zonas de 15. Se juegan DOS torneos por
//   año —Apertura y Clausura—, cada uno con 16 fechas de fase regular (14
//   contra los equipos de la propia zona, más dos interzonales: uno de
//   emparejamiento y el clásico contra el rival histórico de la otra zona) y
//   playoffs de octavos a la final: clasifican los 8 primeros de cada zona,
//   cruzados entre zonas (1ºA-8ºB, 2ºA-7ºB, y así). Entre ambos torneos hay
//   una ventana de pases.
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
// - Descienden 2 de Primera por año: los dos últimos de la Tabla Anual (suma
//   de las fases regulares del Apertura y el Clausura). En la realidad baja
//   el último de esa tabla y, aparte, el peor promedio de las últimas 3
//   temporadas; acá se usan los dos últimos de la Anual para no arrastrar
//   una segunda tabla con el historial de cada club.
// - Cupos a copas internacionales: 6 a Libertadores (campeón Apertura,
//   campeón Clausura, campeón Copa Argentina, y los 3 mejores de la Tabla
//   Anual que no hayan clasificado ya, el tercero de ellos a fase previa) y
//   6 a Sudamericana (los 6 siguientes de la Tabla Anual). Un campeón que
//   además desciende conserva igual su cupo, como en la realidad.
// - La división en la que NO juega el usuario se simula completa e
//   instantáneamente al arrancar el año (no hay nada interactivo ahí), para
//   que los cupos a copas y los ascensos/descensos tengan sentido siempre.

const SAVE_KEY = 'dt-simulador-save-v3';

const FIFA_ROUNDS = [5, 11];
const COPA_ROUNDS = [2, 4, 7, 10, 13];
const COPA_STAGE_NAMES = ['Dieciseisavos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];
const TRANSFER_ROUND_D2 = 9; // ventana de pases de la Nacional, a mitad de su único torneo
// Primera juega 16 fechas: las 15 del fixture de su zona (14 partidos contra
// su zona + el interzonal de emparejamiento en la fecha que le tocaría estar
// libre) más una última fecha de clásicos, también interzonal. La Nacional
// son 17 fechas a una rueda contra su propia zona de 18.
const TOTAL_ROUNDS = { D1: 16, D2: 17 };
// Límites del plantel: con el máximo lleno hay que vender para poder
// comprar, y con el mínimo no se puede vender más (si no te quedás sin
// equipo).
const MAX_SQUAD = 30;
const MIN_SQUAD = 14;
const PLAYOFF_STAGES = ['Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];
const REDUCIDO_STAGES = ['Primera Rueda del Reducido', 'Cuartos del Reducido', 'Semifinal del Reducido', 'Final del Reducido'];
// Cómo se llama cada instancia de una copa internacional según cuántos
// equipos quedan vivos.
const COPA_STAGE_LABELS = {
  2: 'la final',
  4: 'las semifinales',
  8: 'los cuartos de final',
  16: 'los octavos de final',
  32: 'los dieciseisavos de final',
};

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

  // Techo de crecimiento de un jugador: se calcula una sola vez, al armar el
  // plantel, y no se vuelve a tocar en toda la carrera (representa su
  // potencial, no algo que cambie solo). Los jóvenes tienen margen para
  // mejorar unos puntos con el tiempo, pero nunca de forma exagerada — un
  // jugador de 25 años con 82 de valoración no va a terminar llegando a los
  // 90, como mucho a un par de puntos más. A partir de los 26 ya no hay
  // margen adicional (ver developSquadAfterMatch, más abajo, para cómo se
  // aplica este techo).
  canteraDe(club) {
    if (!club) return 3;
    const c = typeof CANTERAS !== 'undefined' && CANTERAS[club.id];
    return c || (typeof CANTERA_POR_DEFECTO !== 'undefined' ? CANTERA_POR_DEFECTO[club.division] : 3) || 3;
  },

  // Techo estimado de un jugador del que no se investigó la proyección real.
  //
  // Dos cosas deciden cuánto margen le toca: la edad y LA CANTERA DEL CLUB
  // donde se formó. Lo segundo faltaba y era el error de fondo: el techo no
  // dependía del club para nada, así que Platense sacaba tantas joyas como
  // River y Argentinos no tenía ninguna ventaja sobre Barracas Central.
  //
  // La cantera mueve dos perillas a la vez:
  //   - cuánto margen se puede sortear como máximo (un club de cantera 5
  //     puede sacar un pibe con 14 puntos por delante; uno de cantera 1 no
  //     pasa de 7, así que directamente NO produce joyas);
  //   - qué tan cargado está el sorteo hacia arriba (exponente): en una
  //     cantera grande el buen sorteo es frecuente, en una chica es raro.
  //
  // El margen por edad sigue siendo el máximo, no lo que le toca a cada uno:
  // en la realidad la mayoría de los juveniles no llega, unos pocos pegan el
  // salto y el resto se queda en el camino.
  // `rng` permite pasar un generador sembrado en vez de Math.random. Lo usa el
  // mercado de pases para que el techo de un juvenil de otro club sea siempre
  // el mismo: si usara Math.random, el pibe cambiaría de proyección cada vez
  // que abrís su club.
  computePotential(rating, age, club, rng) {
    const azar = rng || Math.random;
    let maxMargin = 0;
    if (age <= 19) maxMargin = 12;
    else if (age <= 21) maxMargin = 9;
    else if (age <= 23) maxMargin = 6;
    else if (age <= 25) maxMargin = 3;
    if (!maxMargin) return Math.min(99, rating);

    const cantera = this.canteraDe(club);
    const tope = { 5: 1.2, 4: 1.05, 3: 0.9, 2: 0.7, 1: 0.55 }[cantera] || 0.9;
    // Exponente del sorteo: más bajo = más parejo = más seguido sale un
    // margen grande. Más alto = cargado hacia abajo.
    const sesgo = { 5: 1.3, 4: 1.7, 3: 2.2, 2: 2.9, 1: 3.6 }[cantera] || 2.2;

    // El golpe de suerte: de vez en cuando, en CUALQUIER club, sale un pibe
    // que no tiene nada que ver con el resto de la cantera. Sin esto, un club
    // chico tenía el techo cortado en +8 y por lo tanto era imposible que
    // sacara una joya, que es demasiado absoluto — Riestra puede sacar un
    // crack, solo que mucho menos seguido que River. Con este 5%, un club de
    // cantera 2 saca joyas en torno al 2% de sus juveniles en vez de nunca.
    if (azar() < 0.05) {
      const porcionSuerte = 0.6 + azar() * 0.4;
      return Math.min(99, rating + Math.round(maxMargin * porcionSuerte));
    }

    const porcion = 0.25 + Math.pow(azar(), sesgo) * 0.75;
    return Math.min(99, rating + Math.round(maxMargin * tope * porcion));
  },

  // Si el club tiene un plantel real cargado en players.js, se usa ese en
  // vez de generar jugadores al azar. Ver REAL_ROSTERS en ese archivo.
  generateSquad(club) {
    const real = REAL_ROSTERS[club.id];
    if (real && real.length >= 11) {
      return real.map((p, i) => ({
        id: `${club.id}-${i}`, name: p.name, pos: p.pos, rating: p.rating, age: p.age, nation: p.nation, contractYears: p.contractYears, number: p.number, role: p.role,
        posDetail: p.posDetail, altPosDetail: p.altPosDetail, loanFrom: p.loanFrom, loanUntil: p.loanUntil,
        // Datos económicos reales, cuando el club los tiene investigados.
        value: p.value, salary: p.salary, clause: p.clause, transferState: p.transferState,
        // Si vino una proyección investigada se usa esa; si no, la estimada.
        potential: p.projection || this.computePotential(p.rating, p.age, club),
      }));
    }
    const MED_ROLES = ['contención', 'mixto', 'ofensivo'];
    // Los nombres salen de un pool chico, así que en 1 de cada 10 planteles
    // aparecían dos jugadores con el mismo nombre y apellido. No rompía nada,
    // pero en la lista de suplentes parece un error del juego.
    const usados = new Set();
    const nombreUnico = (nation) => {
      for (let intento = 0; intento < 25; intento++) {
        const n = this.randomPlayerName(nation);
        if (!usados.has(n)) { usados.add(n); return n; }
      }
      return this.randomPlayerName(nation);
    };
    return SQUAD_POSITIONS.map((pos, i) => {
      const base = 44 + club.reputation * 6;
      const rating = Math.max(35, Math.min(90, Math.round(base + (Math.random() * 16 - 8))));
      const age = Math.round(17 + Math.random() * 18);
      const nation = this.rollNation();
      const contractYears = 1 + Math.floor(Math.random() * 4); // 1-4 años de contrato restantes
      const role = pos === 'MED' ? MED_ROLES[Math.floor(Math.random() * MED_ROLES.length)] : undefined;
      return { id: `p${i}`, name: nombreUnico(nation), pos, rating, age, nation, contractYears, role, potential: this.computePotential(rating, age, club) };
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

  // ¿Este jugador es de ese lado de la cancha? Un lateral izquierdo para el
  // casillero de la izquierda, un central para los del medio. Solo aplica a
  // DEF y DEL, que son las líneas donde el lado importa; si no tenemos el
  // dato de posición detallada, no se lo descarta.
  matchesSlotSide(player, slot, slotIndex, slotCount) {
    if (slot !== 'DEF' && slot !== 'DEL') return true;
    if (slotIndex === undefined || slotCount === undefined) return true;
    const side = this.WIDTH_BY_POS_DETAIL[player.posDetail];
    if (!side) return true;
    return side === this.slotWidthCategory(slotIndex, slotCount);
  },

  // El mejor de una lista para un casillero puntual. Primero se queda con
  // los que son de ese lado de la cancha (si no, un lateral derecho bueno se
  // queda con el puesto de lateral izquierdo y el izquierdo natural termina
  // en el banco), y entre esos elige por rendimiento REAL en el casillero
  // (effectiveRating ya tiene en cuenta la posición detallada y el lado) en
  // vez del rating pelado.
  bestPlayerForSlot(candidatos, slot, slotIndex, slotCount, formation) {
    if (!candidatos.length) return null;
    const delLadoJusto = candidatos.filter((p) => this.matchesSlotSide(p, slot, slotIndex, slotCount));
    const lista = delLadoJusto.length ? delLadoJusto : candidatos;
    return lista.reduce((mejor, p) => (
      this.effectiveRating(p, slot, formation, slotIndex, slotCount) > this.effectiveRating(mejor, slot, formation, slotIndex, slotCount) ? p : mejor
    ));
  },

  // Arma el once automáticamente: para cada casillero busca al mejor jugador
  // libre entre sus posiciones candidatas (ver preferredPositionsForSlot y
  // bestPlayerForSlot). El once que sale se parece al equipo que pondría el
  // club de verdad, en vez de ser los 11 de mejor puntaje amontonados.
  //
  // Se usa al arrancar la carrera y al cambiar de formación (ahí sí se
  // resetean las elecciones manuales, porque cambiar de formación es una
  // acción explícita del usuario).
  recomputeStartingSlots() {
    const s = this.state;
    const formation = this.currentFormation();
    const slotCounts = { POR: 1, DEF: formation.def, MED: formation.med, OFF: formation.off || 0, DEL: formation.del };
    const seenPerSlot = { POR: 0, DEF: 0, MED: 0, OFF: 0, DEL: 0 };
    const usedIds = new Set();
    const bestFor = (slot, slotIndex) => {
      const slotCount = slotCounts[slot];
      for (const pos of this.preferredPositionsForSlot(slot)) {
        const candidatos = s.squad.filter((pl) => !usedIds.has(pl.id) && pl.pos === pos && this.isAvailable(pl));
        const pick = this.bestPlayerForSlot(candidatos, slot, slotIndex, slotCount, formation);
        if (pick) return pick;
      }
      return null;
    };
    let slots = this.slotOrderForFormation(formation).map((slot) => {
      const p = bestFor(slot, seenPerSlot[slot]++);
      if (!p) return { slot, playerId: null };
      usedIds.add(p.id);
      return { slot, playerId: p.id };
    });
    // Si el plantel no alcanza (muchos lesionados, plantel chico), se rellena
    // con lo que sobre: primero los disponibles.
    const leftover = [...s.squad]
      .filter((p) => !usedIds.has(p.id))
      .sort((a, b) => (this.isAvailable(b) - this.isAvailable(a)) || b.rating - a.rating);
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
    const byId = Object.fromEntries(s.squad.map((p) => [p.id, p]));
    const usedIds = new Set();
    // Se vacía el casillero de cualquiera que ya no esté en el plantel o que
    // esté lesionado/suspendido: esos no pueden ser titulares.
    s.startingSlots = s.startingSlots.map((entry) => {
      const p = entry.playerId ? byId[entry.playerId] : null;
      if (p && this.isAvailable(p)) { usedIds.add(p.id); return entry; }
      return { slot: entry.slot, playerId: null };
    });
    const formation = this.currentFormation();
    const slotCounts = { POR: 1, DEF: formation.def, MED: formation.med, OFF: formation.off || 0, DEL: formation.del };
    const seenPerSlot = { POR: 0, DEF: 0, MED: 0, OFF: 0, DEL: 0 };
    s.startingSlots = s.startingSlots.map((entry) => {
      const slotIndex = seenPerSlot[entry.slot]++;
      if (entry.playerId) return entry;
      const slotCount = slotCounts[entry.slot];
      const mejorDe = (lista) => this.bestPlayerForSlot(lista, entry.slot, slotIndex, slotCount, formation);
      let pick = null;
      for (const pos of this.preferredPositionsForSlot(entry.slot)) {
        pick = mejorDe(s.squad.filter((p) => !usedIds.has(p.id) && p.pos === pos && this.isAvailable(p)));
        if (pick) break;
      }
      // Último recurso, con el plantel diezmado: cualquiera que quede libre.
      if (!pick) pick = mejorDe(s.squad.filter((p) => !usedIds.has(p.id) && this.isAvailable(p)));
      if (!pick) pick = mejorDe(s.squad.filter((p) => !usedIds.has(p.id)));
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
  // A qué lado de la cancha corresponde una posición detallada (posDetail,
  // ver players.js). Solo se define para DEF y DEL: un lateral/extremo es
  // claramente de un lado, un central/delantero centro es del medio. En el
  // mediocampo no se aplica (los casilleros MED son de profundidad —
  // contención/mixto/ofensivo, ya cubierto por `role`— no de ancho: un
  // doble/triple cinco no se arma como "izquierda/centro/derecha").
  WIDTH_BY_POS_DETAIL: {
    'lateral izquierdo': 'left',
    'lateral derecho': 'right',
    'carrilero izquierdo': 'left',
    'carrilero derecho': 'right',
    'defensor central': 'center',
    'extremo izquierdo': 'left',
    'extremo derecho': 'right',
    'delantero centro': 'center',
    'segundo delantero': 'center',
  },

  // A qué lado corresponde el casillero N de un total de `count` en una
  // misma línea, según su posición de izquierda a derecha en la cancha
  // (índice 0 = más a la izquierda, ver buildPitchSvg en ui.js). Con 3 o
  // más casilleros, los de las puntas son de banda y el resto del medio.
  // Con 1 o 2 (un delantero solo, o una dupla de delanteros centrales, que
  // es lo más común en el fútbol argentino) no hay banda: todos del medio.
  slotWidthCategory(index, count) {
    if (count <= 2) return 'center';
    if (index === 0) return 'left';
    if (index === count - 1) return 'right';
    return 'center';
  },

  // A qué casillero general (POR/DEF/MED/DEL) corresponde una posición
  // detallada — se usa para saber si una posición ALTERNATIVA de un
  // jugador (altPosDetail, ver más abajo) sirve para tapar un casillero.
  BUCKET_BY_POS_DETAIL: {
    arquero: 'POR',
    'lateral izquierdo': 'DEF',
    'lateral derecho': 'DEF',
    'carrilero izquierdo': 'DEF',
    'carrilero derecho': 'DEF',
    'defensor central': 'DEF',
    'mediocampista defensivo': 'MED',
    'mediocampista mixto': 'MED',
    'mediocampista ofensivo': 'MED',
    'volante por izquierda': 'MED',
    'volante por derecha': 'MED',
    'delantero centro': 'DEL',
    'extremo izquierdo': 'DEL',
    'extremo derecho': 'DEL',
    'segundo delantero': 'DEL',
  },

  // Algunos jugadores rinden bien en más de una posición real (ej. Thiago
  // Almada: mediocampista ofensivo o extremo izquierdo; Gonzalo Montiel:
  // lateral derecho o izquierdo) — `altPosDetail` en players.js guarda esas
  // posiciones alternativas (una lista, puede tener más de una). Si el
  // casillero donde lo pusiste corresponde a una de ellas, el ajuste sube
  // un escalón (rojo→amarillo, amarillo→verde) respecto de lo que daría su
  // posición principal sola. En DEF/DEL también se compara el lado: la
  // alternativa de Montiel es "lateral izquierdo", así que solo lo
  // beneficia del lado izquierdo, no le regala verde en cualquier
  // casillero de defensa.
  applyAltPositionBonus(player, slot, fit, slotIndex, slotCount) {
    if (!player.altPosDetail || !player.altPosDetail.length || fit.color === 'green') return fit;
    const slotBuckets = slot === 'OFF' ? ['MED', 'DEL'] : [slot];
    const hasWidthInfo = (slot === 'DEF' || slot === 'DEL') && slotIndex !== undefined && slotCount !== undefined;
    const slotSide = hasWidthInfo ? this.slotWidthCategory(slotIndex, slotCount) : null;
    const matches = player.altPosDetail.some((pd) => {
      const bucket = this.BUCKET_BY_POS_DETAIL[pd];
      if (!bucket || !slotBuckets.includes(bucket)) return false;
      if (hasWidthInfo) {
        const altSide = this.WIDTH_BY_POS_DETAIL[pd];
        if (altSide) return altSide === slotSide;
      }
      return true;
    });
    if (!matches) return fit;
    if (fit.color === 'red') return { color: 'yellow', mult: Math.max(fit.mult, 0.85) };
    return { color: 'green', mult: 1 }; // era amarillo
  },

  // Cuando la formación define una "forma" explícita para el casillero
  // (medShape/offShape, ver FORMATIONS en data.js) y el ajuste de base ya
  // daba verde, se compara la posición detallada real del jugador (o sus
  // alternativas) contra la que se espera en ESE casillero puntual — no
  // alcanza con estar en la línea correcta, tiene que ser el tipo de
  // mediocampista/enganche correcto (ej. un volante lateral en un casillero
  // que pide un enganche central). Sin ese dato (posDetail no cargado, o la
  // formación sin forma definida todavía) el comportamiento es el de
  // siempre. Nunca empeora un amarillo/rojo ya existente, solo baja un
  // verde que no corresponde.
  applyShapeRefinement(player, slot, formation, slotIndex, fit) {
    if (fit.color !== 'green' || slotIndex === undefined || !formation || !player.posDetail) return fit;
    if (slot !== 'MED' && slot !== 'OFF') return fit;
    const shape = slot === 'MED' ? formation.medShape : formation.offShape;
    const expected = shape && shape[slotIndex];
    if (!expected) return fit;
    if (player.posDetail === expected) return fit;
    if (player.altPosDetail && player.altPosDetail.includes(expected)) return fit;
    return { color: 'yellow', mult: 0.85 };
  },

  // slotIndex/slotCount (posición del casillero dentro de su línea, ver
  // getStartingXI) afinan el color cuando el jugador ya está en su posición
  // general correcta (DEF o DEL) pero del lado equivocado de la cancha —
  // por ejemplo un lateral derecho jugando de central, o un extremo
  // izquierdo puesto de "9". Es un matiz menor (amarillo, no rojo) y solo
  // se aplica si tenemos el dato de posDetail del jugador; sin ese dato el
  // comportamiento es exactamente el de antes.
  positionFit(player, slot, formation, slotIndex, slotCount) {
    return this.applyShapeRefinement(player, slot, formation, slotIndex, this.baseFit(player, slot, formation, slotIndex, slotCount));
  },

  baseFit(player, slot, formation, slotIndex, slotCount) {
    const playerPos = player.pos;
    if (playerPos === 'MED' && formation && formation.off && player.role) {
      if (slot === 'OFF') {
        if (player.role === 'contención') return this.applyAltPositionBonus(player, slot, { color: 'red', mult: 0.55 }, slotIndex, slotCount);
        return { color: 'green', mult: 1 }; // ofensivo o mixto: es lo suyo
      }
      if (slot === 'MED') {
        if (player.role === 'ofensivo') return this.applyAltPositionBonus(player, slot, { color: 'yellow', mult: 0.85 }, slotIndex, slotCount);
        return { color: 'green', mult: 1 }; // contención o mixto: es lo suyo
      }
    }
    if (playerPos === slot) {
      if ((slot === 'DEF' || slot === 'DEL') && player.posDetail && slotIndex !== undefined && slotCount !== undefined) {
        const playerSide = this.WIDTH_BY_POS_DETAIL[player.posDetail];
        const slotSide = this.slotWidthCategory(slotIndex, slotCount);
        if (playerSide && playerSide !== slotSide) return this.applyAltPositionBonus(player, slot, { color: 'yellow', mult: 0.9 }, slotIndex, slotCount);
      }
      return { color: 'green', mult: 1 };
    }
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
    return this.applyAltPositionBonus(player, slot, table[key] || { color: 'red', mult: 0.5 }, slotIndex, slotCount);
  },

  effectiveRating(player, slot, formation, slotIndex, slotCount) {
    return Math.round(player.rating * this.positionFit(player, slot, formation, slotIndex, slotCount).mult);
  },

  getStartingXI() {
    const s = this.state;
    if (!s.startingSlots || !s.startingSlots.length) this.recomputeStartingSlots();
    const formation = this.currentFormation();
    const slotCounts = { POR: 1, DEF: formation.def, MED: formation.med, OFF: formation.off || 0, DEL: formation.del };
    const seenPerSlot = { POR: 0, DEF: 0, MED: 0, OFF: 0, DEL: 0 };
    const rows = { POR: [], DEF: [], MED: [], OFF: [], DEL: [] };
    const starters = [];
    s.startingSlots.forEach(({ slot, playerId }) => {
      const p = s.squad.find((pl) => pl.id === playerId);
      const slotIndex = seenPerSlot[slot]++;
      if (!p) return;
      const slotCount = slotCounts[slot];
      const fit = this.positionFit(p, slot, formation, slotIndex, slotCount);
      const entry = { ...p, slot, fit: fit.color, effectiveRating: this.effectiveRating(p, slot, formation, slotIndex, slotCount) };
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
    // Los lesionados y suspendidos van al final: arriba quedan los que
    // realmente podés poner en la cancha.
    return [...s.squad]
      .filter((p) => !startingSet.has(p.id))
      .sort((a, b) => (this.isAvailable(b) - this.isAvailable(a)) || b.rating - a.rating);
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
    // Un lesionado o suspendido no puede entrar a la cancha: el cambio se
    // rechaza y la UI avisa por qué.
    const entra = [idA, idB].map((id) => s.squad.find((p) => p.id === id)).filter(Boolean);
    if (entra.some((p) => !this.isAvailable(p) && !s.startingSlots.some((e) => e.playerId === p.id))) return false;
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

  // Fechas interzonales de Primera. Con 15 equipos por zona, el fixture de
  // zona deja a uno libre por fecha: en vez de perder esa fecha, el que
  // descansa en la zona A juega contra el que descansa en la zona B. Eso da
  // el interzonal "de emparejamiento", uno por equipo.
  //
  // Después se agrega una fecha más, la última, donde juegan TODOS contra su
  // clásico de la otra zona (los clubes sin clásico en la categoría se
  // emparejan al azar). Así cada equipo termina con 16 partidos: 14 contra su
  // zona y 2 interzonales.
  //
  // Los puntos de estos partidos suman en la tabla de la zona de cada uno,
  // como en el torneo real.
  buildInterzonalSchedule(scheduleA, idsA, scheduleB, idsB) {
    const libreDe = (schedule, ids, roundIndex) => {
      const round = schedule[roundIndex] || [];
      const jugando = new Set(round.flatMap((f) => [f.home, f.away]));
      return ids.find((id) => !jugando.has(id)) || null;
    };

    const total = Math.max(scheduleA.length, scheduleB.length);
    const libresA = [];
    const libresB = [];
    for (let r = 0; r < total; r++) {
      libresA.push(libreDe(scheduleA, idsA, r));
      libresB.push(libreDe(scheduleB, idsB, r));
    }

    // Si a dos clásicos les toca descansar la misma fecha, este cruce sería
    // justo el clásico, que ya se juega en la última fecha — y terminarían
    // enfrentándose dos veces en el mismo torneo. Cuando pasa, se intercambia
    // el rival con otra fecha donde el cambio no arme otro clásico.
    const esClasico = (uno, otro) => !!uno && !!otro
      && CLASICOS.some(([x, y]) => (x === uno && y === otro) || (x === otro && y === uno));
    for (let r = 0; r < total; r++) {
      if (!esClasico(libresA[r], libresB[r])) continue;
      const otra = libresB.findIndex((_, o) => o !== r
        && !esClasico(libresA[r], libresB[o])
        && !esClasico(libresA[o], libresB[r]));
      if (otra >= 0) [libresB[r], libresB[otra]] = [libresB[otra], libresB[r]];
    }

    const rounds = libresA.map((a, r) => {
      const b = libresB[r];
      // De local va uno u otro según la fecha, para que no sea siempre el
      // mismo lado el que recibe.
      return a && b ? [r % 2 === 0 ? { home: a, away: b } : { home: b, away: a }] : [];
    });

    // Contra quién jugó cada uno su interzonal de emparejamiento, para que la
    // fecha de clásicos no vuelva a cruzarlos.
    const yaEnfrentado = {};
    libresA.forEach((a, r) => {
      const b = libresB[r];
      if (a && b) { yaEnfrentado[a] = b; yaEnfrentado[b] = a; }
    });

    rounds.push(this.buildClasicoRound(idsA, idsB, yaEnfrentado));
    return rounds;
  },

  buildClasicoRound(idsA, idsB, yaEnfrentado = {}) {
    const enA = new Set(idsA);
    const pendientes = { A: [...idsA], B: [...idsB] };
    const sacar = (id, zona) => {
      const i = pendientes[zona].indexOf(id);
      if (i >= 0) pendientes[zona].splice(i, 1);
    };

    const round = [];
    CLASICOS.forEach(([unId, otroId]) => {
      const zonaDeUno = enA.has(unId) ? 'A' : 'B';
      const zonaDeOtro = enA.has(otroId) ? 'A' : 'B';
      const estanCruzados = pendientes[zonaDeUno].includes(unId)
        && pendientes[zonaDeOtro].includes(otroId)
        && zonaDeUno !== zonaDeOtro;
      if (!estanCruzados) return;
      sacar(unId, zonaDeUno);
      sacar(otroId, zonaDeOtro);
      round.push(Math.random() < 0.5 ? { home: unId, away: otroId } : { home: otroId, away: unId });
    });

    // Los que no tienen clásico en la categoría se cruzan al azar contra
    // alguno de la otra zona, salteando al que ya enfrentaron en el
    // interzonal de emparejamiento para que nadie juegue dos veces contra el
    // mismo rival en el torneo.
    const disponibles = this.shuffled(pendientes.B);
    const parejas = [];
    this.shuffled(pendientes.A).forEach((id) => {
      if (!disponibles.length) return;
      let i = disponibles.findIndex((rival) => yaEnfrentado[id] !== rival);
      if (i < 0) i = 0; // no quedaba otro: se corrige con el intercambio de abajo
      parejas.push([id, disponibles[i]]);
      disponibles.splice(i, 1);
    });

    // Si al último le tocó justo el rival prohibido, se le cambia el rival
    // con otra pareja a la que el intercambio no le arme el mismo problema.
    parejas.forEach((par, i) => {
      if (yaEnfrentado[par[0]] !== par[1]) return;
      const otra = parejas.findIndex((p, j) => j !== i
        && yaEnfrentado[p[0]] !== par[1]
        && yaEnfrentado[par[0]] !== p[1]);
      if (otra >= 0) [par[1], parejas[otra][1]] = [parejas[otra][1], par[1]];
    });

    parejas.forEach(([local, visitante], i) => {
      round.push(i % 2 === 0 ? { home: local, away: visitante } : { home: visitante, away: local });
    });
    return round;
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

  // Un equipo no mete más de 6 goles en un partido: la cola larga de la
  // Poisson daba resultados que en el fútbol real no pasan (10 a 0). Se
  // vuelve a tirar en vez de recortar, para no amontonar probabilidad justo
  // en el 6; con los lambdas de abajo esto casi nunca se activa.
  sampleGoals(lambda) {
    for (let i = 0; i < 8; i++) {
      const goals = this.samplePoisson(lambda);
      if (goals <= 6) return goals;
    }
    return 6;
  },

  // La diferencia de nivel entre dos equipos define sobre todo QUIÉN gana,
  // no por cuánto: un grande contra un chico gana muy seguido, pero 2-0 o
  // 1-0, no 6-0. Por eso la diferencia de fuerza entra dividida (pesa poco
  // en la cantidad de goles) y los dos lambdas tienen piso y techo cortitos
  // — el favorito no pasa de ~2,1 goles esperados y el más débil nunca baja
  // de ~0,65, así que siempre puede descontar o dar el golpe.
  simulateScore(homeStrength, awayStrength, homeAdvantage) {
    const diff = homeStrength - awayStrength;
    const lambdaHome = Math.max(0.7, Math.min(2.1, 1.25 + diff / 40 + homeAdvantage / 16));
    const lambdaAway = Math.max(0.65, Math.min(1.95, 1.1 - diff / 40));
    return { homeGoals: this.sampleGoals(lambdaHome), awayGoals: this.sampleGoals(lambdaAway) };
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

  // Suma varias tablas ya ordenadas (cada una es un array de filas) en una
  // sola, sumando los números de cada club y reordenando el resultado.
  mergeTableRows(tables) {
    const byId = {};
    tables.forEach((rows) => rows.forEach((r) => {
      if (!byId[r.id]) byId[r.id] = { id: r.id, name: r.name, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0 };
      const acc = byId[r.id];
      acc.played += r.played; acc.win += r.win; acc.draw += r.draw; acc.loss += r.loss; acc.gf += r.gf; acc.ga += r.ga; acc.pts += r.pts;
    }));
    return Object.values(byId).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  },

  combineEditionTables(apertura, clausura) {
    return this.mergeTableRows([apertura.zoneATable, apertura.zoneBTable, clausura.zoneATable, clausura.zoneBTable]);
  },

  // Tabla Anual como se ve DURANTE el año: la fase de zonas de las ediciones
  // que ya terminaron más la que se esté jugando ahora. Solo cuenta la fase
  // de zonas — los playoffs de cada edición no suman puntos, igual que en la
  // tabla anual real.
  //
  // Al terminar la fase de zonas de una edición sus tablas quedan guardadas
  // en season.myD1[edición]; hasta que arranque la edición siguiente,
  // season.zones sigue teniendo esas mismas tablas, así que las de "ahora"
  // se suman solo mientras la edición en curso no esté guardada todavía (si
  // no, se contaría dos veces).
  tablaAnualRows() {
    const season = this.state && this.state.season;
    if (!season || season.myDivision !== 'D1' || !season.myD1) return null;
    const tables = [];
    ['apertura', 'clausura'].forEach((edition) => {
      const done = season.myD1[edition];
      if (done) tables.push(done.zoneATable, done.zoneBTable);
    });
    if (season.edition && !season.myD1[season.edition]) {
      Object.values(season.zones).forEach((z) => tables.push(this.sortTable(z.table)));
    }
    return this.mergeTableRows(tables);
  },

  // Cuadro de los playoffs de Primera: los 8 primeros de cada zona en la
  // llave FIJA del reglamento de la LPF. El array está en orden de cuadro
  // (ver pairStage: se enfrentan de a dos, los vecinos), así que el cruce de
  // cada ronda queda determinado desde el arranque — ganar los octavos ya te
  // dice contra quién jugás en cuartos.
  //
  //   Octavos              Cuartos                Semi
  //   1ºA - 8ºB  ┐
  //   4ºB - 5ºA  ┘─ C1  ┐
  //   2ºB - 7ºA  ┐      ├─ S1  ┐
  //   3ºA - 6ºB  ┘─ C4  ┘      │
  //   1ºB - 8ºA  ┐             ├─ FINAL
  //   4ºA - 5ºB  ┘─ C2  ┐      │
  //   2ºA - 7ºB  ┐      ├─ S2  ┘
  //   3ºB - 6ºA  ┘─ C3  ┘
  //
  // El `seed` no ordena el cuadro (eso ya lo hace la posición en el array):
  // solo dice quién es el mejor ubicado de la fase regular, que es el que
  // juega de local. Se numera por puesto en la zona (los dos 1º primero, los
  // dos 2º después, y así), desempatando por puntos entre zonas.
  playoffSeedsFromZones(zoneATable, zoneBTable) {
    const a = zoneATable.slice(0, 8);
    const b = zoneBTable.slice(0, 8);

    const seedByClub = {};
    for (let pos = 0; pos < 8; pos++) {
      const pair = [a[pos], b[pos]].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf);
      seedByClub[pair[0].id] = pos * 2 + 1;
      seedByClub[pair[1].id] = pos * 2 + 2;
    }

    const bracket = [
      a[0], b[7], b[3], a[4], // 1ºA-8ºB / 4ºB-5ºA  -> C1
      b[1], a[6], a[2], b[5], // 2ºB-7ºA / 3ºA-6ºB  -> C4
      b[0], a[7], a[3], b[4], // 1ºB-8ºA / 4ºA-5ºB  -> C2
      a[1], b[6], b[2], a[5], // 2ºA-7ºB / 3ºB-6ºA  -> C3
    ];
    return bracket.map((r) => ({ id: r.id, seed: seedByClub[r.id] }));
  },

  // ---------- Copas internacionales (Libertadores y Sudamericana) ----------
  //
  // Se juegan enteras: fase previa, fase de grupos y eliminatorias hasta el
  // campeón. Los cupos argentinos son los que se ganaron en el juego la
  // temporada anterior (así que cambian según cómo te vaya); el resto del
  // continente sale de CLUBES_INTERNACIONALES (internacional.js).
  //
  // Es una versión simplificada del formato real: las llaves son a partido
  // único en vez de ida y vuelta, los grupos se sortean sin bombos por país,
  // y no está el repechaje que manda equipos de una copa a la otra. Alcanza
  // para que cada temporada tenga un campeón creíble y para saber hasta dónde
  // llegó tu club.

  shuffled(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // Cada país del resto del continente reparte sus plazas de nuevo todos los
  // años. Las plazas en sí no cambian (las mismas que trae internacional.js:
  // tantas a la Libertadores, tantas por fase previa, tantas a la
  // Sudamericana), pero quién ocupa cada una se define por la campaña de ese
  // año: el nivel del club pesa, pero con bastante azar encima. Así Peñarol
  // suele ir a la Libertadores y a veces cae en la Sudamericana, y no
  // clasifican siempre exactamente los mismos.
  //
  // El valor de una plaza ordena de mejor a peor: entrar directo a los grupos
  // de la Libertadores es lo máximo, después su fase previa, después la
  // Sudamericana.
  sortearCuposInternacionales() {
    const valorPlaza = (p) => (p.copa === 'Libertadores' ? (p.fase === 'grupos' ? 3 : 2) : 1);
    const porPais = {};
    (typeof CLUBES_INTERNACIONALES === 'undefined' ? [] : CLUBES_INTERNACIONALES)
      .forEach((c) => { (porPais[c.pais] = porPais[c.pais] || []).push(c); });

    const sorteados = [];
    Object.values(porPais).forEach((clubes) => {
      const plazas = clubes.map((c) => ({ copa: c.copa, fase: c.fase }))
        .sort((a, b) => valorPlaza(b) - valorPlaza(a));
      const ranking = clubes
        .map((c) => ({ club: c, campania: c.nivel + Math.random() * 3.5 }))
        .sort((a, b) => b.campania - a.campania);
      ranking.forEach((r, i) => {
        sorteados.push({ id: r.club.id, nombre: r.club.nombre, pais: r.club.pais, nivel: r.club.nivel, ...plazas[i] });
      });
    });
    return sorteados;
  },

  copaEntrants(copa, qualification, internacionales) {
    const argentinos = qualification.filter((q) => q.comp === copa).map((q) => {
      const club = this.getClub(q.clubId);
      return {
        id: q.clubId,
        nombre: club.name,
        pais: 'Argentina',
        nivel: club.reputation,
        fase: q.stage === 'Fase previa' ? 'previa' : 'grupos',
      };
    });
    const resto = (internacionales || this.sortearCuposInternacionales())
      .filter((c) => c.copa === copa)
      .map((c) => ({ id: c.id, nombre: c.nombre, pais: c.pais, nivel: c.nivel, fase: c.fase }));
    return argentinos.concat(resto);
  },

  // Los clubes internacionales no están en s.clubs (no se puede dirigir a
  // ninguno), así que su fuerza sale de su `nivel` con la misma fórmula que
  // usa clubStrength con la reputación de un club argentino.
  copaStrength(entrant) {
    if (entrant.id === this.state.clubId) return this.squadStrength();
    return 44 + entrant.nivel * 6 + (Math.random() * 6 - 3);
  },

  // Una llave de copa pesa más la diferencia de nivel que un partido de liga:
  // si no, en un torneo de eliminación directa el azar termina coronando
  // campeón a cualquiera y los grandes del continente no se notan.
  copaTieWinner(idA, idB, byId) {
    if (!idA) return idB;
    if (!idB) return idA;
    const sa = this.copaStrength(byId[idA]);
    const sb = this.copaStrength(byId[idB]);
    const prob = Math.max(0.12, Math.min(0.88, 0.5 + (sa - sb) / 70));
    return Math.random() < prob ? idA : idB;
  },

  // Las dos copas de un mismo año se juegan con UN solo sorteo de cupos: si
  // no, un club del resto del continente podría terminar jugando las dos.
  simulateCopasDelAnio(qualification) {
    if (!qualification || !qualification.length) return [];
    const internacionales = this.sortearCuposInternacionales();
    return ['Libertadores', 'Sudamericana']
      .map((copa) => this.simulateCopa(copa, qualification, internacionales))
      .filter(Boolean);
  },

  simulateCopa(copa, qualification, internacionales) {
    const entrants = this.copaEntrants(copa, qualification, internacionales);
    if (entrants.length < 4) return null;
    const byId = Object.fromEntries(entrants.map((e) => [e.id, e]));
    // Hasta dónde llegó cada club: se pisa en cada instancia que juega, así
    // que al final queda la más lejana.
    const reached = {};
    const mark = (ids, etapa) => ids.forEach((id) => { if (id) reached[id] = etapa; });

    const previa = this.shuffled(entrants.filter((e) => e.fase === 'previa').map((e) => e.id));
    mark(previa, 'la fase previa');
    const enGrupos = entrants.filter((e) => e.fase === 'grupos').map((e) => e.id);
    for (let i = 0; i < previa.length; i += 2) {
      enGrupos.push(this.copaTieWinner(previa[i], previa[i + 1], byId));
    }

    // 8 grupos como en las dos copas reales: de cada uno pasan 2, así los
    // octavos arrancan con 16 y las llaves cierran justo hasta la final.
    mark(enGrupos, 'la fase de grupos');
    const sorteo = this.shuffled(enGrupos);
    const cantGrupos = Math.max(1, Math.min(8, Math.floor(sorteo.length / 2)));
    const grupos = Array.from({ length: cantGrupos }, () => []);
    sorteo.forEach((id, i) => grupos[i % cantGrupos].push(id));

    let clasificados = [];
    grupos.forEach((grupo) => {
      const table = Object.fromEntries(grupo.map((id) => [id, this.emptyTableRow()]));
      for (let i = 0; i < grupo.length; i++) {
        for (let j = i + 1; j < grupo.length; j++) {
          const score = this.simulateScore(this.copaStrength(byId[grupo[i]]), this.copaStrength(byId[grupo[j]]), 4);
          this.updateTableRow(table, grupo[i], score.homeGoals, score.awayGoals);
          this.updateTableRow(table, grupo[j], score.awayGoals, score.homeGoals);
        }
      }
      const orden = Object.entries(table)
        .map(([id, row]) => ({ id, ...row }))
        .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
      clasificados = clasificados.concat(orden.slice(0, 2).map((r) => r.id));
    });

    let alive = this.shuffled(clasificados);
    let runnerUp = null;
    while (alive.length > 1) {
      if (alive.length % 2) alive.push(null); // si quedó impar, uno pasa de largo
      mark(alive, COPA_STAGE_LABELS[alive.length] || 'las eliminatorias');
      const ganadores = [];
      for (let i = 0; i < alive.length; i += 2) {
        const ganador = this.copaTieWinner(alive[i], alive[i + 1], byId);
        if (alive.length === 2) runnerUp = ganador === alive[i] ? alive[i + 1] : alive[i];
        ganadores.push(ganador);
      }
      alive = ganadores;
    }

    const champion = alive[0] || null;
    if (champion) reached[champion] = 'el título';
    return {
      copa,
      championName: champion ? byId[champion].nombre : null,
      championPais: champion ? byId[champion].pais : null,
      runnerUpName: runnerUp && byId[runnerUp] ? byId[runnerUp].nombre : null,
      userWon: champion === this.state.clubId,
      userStage: reached[this.state.clubId] || null,
    };
  },

  // ---------- Simulación instantánea de la división en la que NO juega el usuario ----------

  simulateFullDivisionYear(division) {
    const s = this.state;
    const idsA = s.clubs.filter((c) => c.division === division && c.zone === 'A').map((c) => c.id);
    const idsB = s.clubs.filter((c) => c.division === division && c.zone === 'B').map((c) => c.id);

    const runZoneStage = () => {
      const tableA = Object.fromEntries(idsA.map((id) => [id, this.emptyTableRow()]));
      const tableB = Object.fromEntries(idsB.map((id) => [id, this.emptyTableRow()]));
      const scheduleA = this.buildSchedule(idsA);
      const scheduleB = this.buildSchedule(idsB);
      scheduleA.forEach((round) => this.simulateRoundOntoTable(round, tableA));
      scheduleB.forEach((round) => this.simulateRoundOntoTable(round, tableB));
      // Primera juega además sus dos fechas interzonales, así que acá se
      // simulan igual que en la división del usuario: si no, las dos mitades
      // del país llegarían a fin de año con distinta cantidad de partidos
      // jugados y la Tabla Anual no cerraría.
      if (division === 'D1') {
        const enA = new Set(idsA);
        this.buildInterzonalSchedule(scheduleA, idsA, scheduleB, idsB).forEach((round) => {
          round.forEach((fixture) => {
            const score = this.simulateScore(this.clubStrength(fixture.home), this.clubStrength(fixture.away), 4);
            this.updateTableRow(enA.has(fixture.home) ? tableA : tableB, fixture.home, score.homeGoals, score.awayGoals);
            this.updateTableRow(enA.has(fixture.away) ? tableA : tableB, fixture.away, score.awayGoals, score.homeGoals);
          });
        });
      }
      return { zoneATable: this.sortTable(tableA), zoneBTable: this.sortTable(tableB) };
    };

    if (division === 'D2') {
      const { zoneATable, zoneBTable } = runZoneStage();
      const finalWinner = this.resolveKnockout(zoneATable[0].id, zoneBTable[0].id);
      const finalLoser = finalWinner === zoneATable[0].id ? zoneBTable[0].id : zoneATable[0].id;
      const reducidoWinner = this.simulateSeedsToChampion(this.reducidoBracket(zoneATable, zoneBTable, finalLoser)).champion;
      return { promoted: [finalWinner, reducidoWinner], zoneATable, zoneBTable };
    }

    const runEdition = () => {
      const { zoneATable, zoneBTable } = runZoneStage();
      const seeds = this.playoffSeedsFromZones(zoneATable, zoneBTable);
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
      clubs: CLUB_TEMPLATES.map((c) => ({ ...c })),
      budget: 0,
      morale: dt && dt.style === 'ofensivo' ? 10 : 0,
      squad: null,
      formation: '433',
      startingSlots: null,
      season: null,
      calendar: null,
      copaBracket: null,
      bracket: null,
      matchContext: null,
      currentDecision: null,
      lastDecisionNote: null,
      pendingMatch: null,
      fifaEvent: null,
      market: null,
      lastSeasonSummary: null,
      noticias: [],
      lastDevelopmentNotes: [],
      finanzas: null,
      mercado: null,
      notasMercado: [],
      log: [],
    };
    const club = this.getClub(clubId);
    let budget = this.startingBudget(club);
    if (dt && dt.style === 'conservador') budget = Math.round(budget * 1.1);
    this.state.budget = budget;
    this.state.squad = this.generateSquad(club);
    this.applyRealLineup(club);
    this.startNewSeason(true);
    // La presentación en sociedad solo aparece al arrancar la carrera (acá,
    // después de armar la primera temporada): las temporadas siguientes
    // arrancan directo por startNewSeason() sin pasar por acá.
    this.state.objective = this.seasonObjective(club);
    this.state.screen = 'presentation';
  },

  // Si el club tiene investigado cómo se para en la realidad (ver
  // REAL_LINEUPS en players.js), se arranca con esa formación y ese once en
  // vez de armarlo solo por valoración. El usuario después lo acomoda a su
  // gusto desde la pantalla de Plantel.
  //
  // Si algún nombre del once no aparece en el plantel, ese puesto queda vacío
  // y lo completa el armado automático: así un error de tipeo en los datos no
  // rompe nada, solo se pierde ese casillero.
  applyRealLineup(club) {
    const s = this.state;
    const real = typeof REAL_LINEUPS !== 'undefined' && REAL_LINEUPS[club.id];
    if (!real) { this.recomputeStartingSlots(); return; }

    if (FORMATIONS.some((f) => f.id === real.formation)) s.formation = real.formation;
    const formation = this.currentFormation();
    const orden = this.slotOrderForFormation(formation);
    const usados = new Set();
    s.startingSlots = orden.map((slot, i) => {
      const nombre = real.xi[i];
      const jugador = nombre && s.squad.find((p) => p.name === nombre && !usados.has(p.id));
      if (!jugador) return { slot, playerId: null };
      usados.add(jugador.id);
      return { slot, playerId: jugador.id };
    });
    // repairStartingSlots rellena los casilleros que hayan quedado vacíos.
    this.repairStartingSlots();
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
    }
    // El primer partido de la carrera también pasa por el calendario día a
    // día, igual que cualquier otra fecha (antes saltaba directo a
    // 'pre-match' porque enterEditionRound ya lo había dejado armado desde
    // newGame(), pero ahora esa función solo arranca la semana en
    // calendario, así que hay que volver a llamarla acá).
    this.enterEditionRound();
  },

  // Arranca un año nuevo completo: simula instantáneamente la división en la
  // que el usuario no juega y abre el mercado de pases de pretemporada, que
  // es el que se juega cuando terminó el Clausura y ya sabés en qué
  // categoría vas a estar. Recién al cerrarlo arranca la primera etapa.
  //
  // `careerStart` es el arranque de la carrera: ahí no hay mercado (empezás
  // con el plantel del club tal cual) y la pantalla la maneja newGame.
  startNewSeason(careerStart = false) {
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
    Economia.nuevaTemporada(s);

    s.season.backgroundResult = this.simulateFullDivisionYear(otherDivision);
    this.setupCopaBracket();

    if (careerStart) this.startFirstEdition();
    else this.startTransferWindow('pre-season');
  },

  startFirstEdition() {
    const club = this.getClub(this.state.clubId);
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
    const scheduleA = this.buildSchedule(idsA);
    const scheduleB = this.buildSchedule(idsB);
    season.zones = {
      [zoneAId]: { clubIds: idsA, schedule: scheduleA, table: Object.fromEntries(idsA.map((id) => [id, this.emptyTableRow()])) },
      [zoneBId]: { clubIds: idsB, schedule: scheduleB, table: Object.fromEntries(idsB.map((id) => [id, this.emptyTableRow()])) },
    };
    // Solo Primera tiene fechas interzonales: en la Nacional las zonas son de
    // 18 equipos, así que no queda nadie libre y el torneo son 17 fechas
    // contra la propia zona.
    season.interzonal = club.division === 'D1'
      ? this.buildInterzonalSchedule(scheduleA, idsA, scheduleB, idsB)
      : [];

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

  // Punto de entrada real de "pasar a la próxima fecha": en vez de saltar
  // directo al próximo evento (partido, fecha FIFA, mercado, etc.) como
  // antes, primero se recorre la semana día a día (ver startCalendarWeek).
  // enterEditionRoundContent() de más abajo es la lógica de siempre —
  // decide qué toca esta fecha — y se llama recién cuando la semana
  // termina de recorrerse.
  enterEditionRound() {
    this.startCalendarWeek('enterEditionRoundContent');
  },

  // ---------- Calendario día a día entre una fecha y la siguiente ----------
  //
  // Una semana dura 7 días: los días 1 a 6 son de rutina (a veces con un
  // mensaje del club, ver INBOX_MESSAGES en data.js) y el día 7 revela lo
  // que corresponda a la próxima fecha (nextAction, casi siempre
  // 'enterEditionRoundContent'). Todo lo que se guarda en s.calendar es
  // JSON-serializable (nada de objetos Date ni funciones) para que
  // sobreviva bien al save/load: la fecha se calcula con un contador de
  // días (dayCount) sobre un almanaque fijo, ver formatCalendarDate.
  startCalendarWeek(nextAction) {
    const s = this.state;
    if (!s.calendar) s.calendar = { dayCount: 0 };
    const hasMessage = Math.random() < 0.5;
    s.calendar.dayInWeek = 0;
    s.calendar.messageDay = hasMessage ? 2 + Math.floor(Math.random() * 4) : null; // día 2 a 5 de la semana
    s.calendar.message = null;
    s.calendar.nextAction = nextAction;
    s.lastDecisionNote = null;
    s.screen = 'calendar';
    this.save();
  },

  // Un solo toque de "Avanzar" pasa de largo todos los días sin nada (no
  // hace falta tocarlo una vez por día) y se frena recién en el primer día
  // con algo: un mensaje, o el final de la semana (que revela el próximo
  // partido/evento).
  advanceCalendarDay() {
    const s = this.state;
    const cal = s.calendar;

    while (true) {
      cal.dayInWeek++;
      cal.dayCount++;
      // El club genera plata todos los días, no una vez al año: cada 7 días
      // de calendario entra el goteo fijo (TV, sponsors, cuota social).
      if (cal.dayCount % 7 === 0) Economia.cobrarSemana(this);
      Noticias.tick(this);

      if (cal.messageDay && cal.dayInWeek === cal.messageDay) {
        cal.message = INBOX_MESSAGES[Math.floor(Math.random() * INBOX_MESSAGES.length)];
        this.save();
        return;
      }

      if (cal.dayInWeek >= 7) {
        this[cal.nextAction]();
        return;
      }
    }
  },

  answerCalendarMessage(optionIndex) {
    const s = this.state;
    const cal = s.calendar;
    const option = cal.message.options[optionIndex];
    s.morale = Math.max(-15, Math.min(15, s.morale + option.moraleMod));
    s.lastDecisionNote = option.note;
    cal.message = null;
    cal.messageDay = null; // un solo mensaje por semana
    this.save();
  },

  enterEditionRoundContent() {
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

    const encontrado = this.findUserMatch(season.roundIndex);

    if (!encontrado) {
      this.simulateWholeRound(season.roundIndex, null);
      Noticias.trasLaFecha(this);
      s.log.unshift('Fecha libre para tu equipo.');
      season.roundIndex++;
      this.enterEditionRound();
      return;
    }

    const userMatch = encontrado.fixture;
    const isHome = userMatch.home === s.clubId;
    s.matchContext = {
      context: 'league',
      opponentId: isHome ? userMatch.away : userMatch.home,
      isHome,
      interzonal: encontrado.interzonal,
      // La última fecha de Primera es la de los clásicos.
      clasico: encontrado.interzonal && season.interzonal && season.roundIndex === season.interzonal.length - 1,
    };
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
      this.recordRoundResult(fixture.home, fixture.away, score.homeGoals, score.awayGoals);
    });
  },

  // La tabla donde suma un club es siempre la de SU zona, aunque el rival sea
  // de la otra: por eso un partido interzonal toca las dos tablas.
  zoneTableOf(clubId) {
    const zones = this.state.season.zones;
    const key = Object.keys(zones).find((k) => zones[k].clubIds.includes(clubId));
    return key ? zones[key].table : null;
  },

  simulateInterzonalRound(roundIndex, excludeMatch) {
    const season = this.state.season;
    const round = (season.interzonal || [])[roundIndex] || [];
    round.forEach((fixture) => {
      if (excludeMatch && fixture.home === excludeMatch.home && fixture.away === excludeMatch.away) return;
      const score = this.simulateScore(this.clubStrength(fixture.home), this.clubStrength(fixture.away), 4);
      const homeTable = this.zoneTableOf(fixture.home);
      const awayTable = this.zoneTableOf(fixture.away);
      if (homeTable) this.updateTableRow(homeTable, fixture.home, score.homeGoals, score.awayGoals);
      if (awayTable) this.updateTableRow(awayTable, fixture.away, score.awayGoals, score.homeGoals);
      this.recordRoundResult(fixture.home, fixture.away, score.homeGoals, score.awayGoals);
    });
  },

  // Todos los partidos de una fecha: los de cada zona más los interzonales.
  // Los resultados de la fecha se simulaban y se perdían: solo quedaba su
  // efecto en la tabla. Ahora además se anotan en season.lastRoundResults,
  // que es de donde el portal de noticias saca las goleadas, los batacazos y
  // los clásicos (ver Noticias.trasLaFecha). Se pisa en cada fecha nueva: es
  // la foto de la última jugada, no un historial.
  simulateWholeRound(roundIndex, excludeMatch) {
    this.state.season.lastRoundResults = [];
    Object.keys(this.state.season.zones).forEach((k) => this.simulateZoneRound(k, roundIndex, excludeMatch));
    this.simulateInterzonalRound(roundIndex, excludeMatch);
  },

  recordRoundResult(home, away, hg, ag) {
    const season = this.state.season;
    if (!Array.isArray(season.lastRoundResults)) season.lastRoundResults = [];
    season.lastRoundResults.push({ home, away, hg, ag });
  },

  // El partido del usuario en una fecha puede estar en el fixture de su zona
  // o ser uno de los dos interzonales del año (el clásico o el de
  // emparejamiento).
  findUserMatch(roundIndex) {
    const s = this.state;
    const season = s.season;
    const esSuyo = (f) => f.home === s.clubId || f.away === s.clubId;
    const zone = season.zones[this.myZoneKey()];
    const enZona = (zone.schedule[roundIndex] || []).find(esSuyo);
    if (enZona) return { fixture: enZona, interzonal: false };
    const enInterzonal = ((season.interzonal || [])[roundIndex] || []).find(esSuyo);
    return enInterzonal ? { fixture: enInterzonal, interzonal: true } : null;
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
    const homeAdvantage = ctx.isNeutral ? 0 : 4;
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

  // direction es el id de una de las PENALTY_ZONES: dónde apunta el
  // usuario (pateando) o a dónde se tira su arquero (atajando). `guess` es
  // la zona a la que se tira el otro lado al azar (el arquero rival, o el
  // remate del rival) — decide la probabilidad, y se guarda también para
  // que la UI pueda animar la cinemática del penal con la posición real de
  // cada uno.
  // Tres finales posibles, no dos. Esto es lo que arregla el bug que reportó
  // el usuario: "lo pateó, entró, y contó como atajada del rival".
  //
  // Antes se sorteaba si era gol SIN mirar si el arquero había adivinado el
  // palo. Entonces podías patear a la izquierda, el arquero volaba a la
  // derecha —y la animación te lo mostraba así— y el cartel igual decía
  // ATAJADA. Al revés también: el arquero se tiraba justo encima de la
  // pelota y decía GOL. La animación contaba una cosa y el resultado otra.
  //
  // Ahora el resultado se deduce de lo que pasó:
  //   - entró                     -> 'gol'
  //   - no entró y el arquero
  //     adivinó el palo           -> 'atajada' (la sacó)
  //   - no entró y el arquero
  //     se tiró para el otro lado -> 'errado' (la tiró afuera)
  // Ese tercer caso es el que faltaba y el que generaba las atajadas
  // imposibles: si el arquero salió para cualquier lado y no fue gol, es
  // porque el que pateó la mandó a la tribuna.
  resolvePenalty(direction, shooterOrKeeper) {
    const s = this.state;
    const pen = s.pendingMatch.penalty;
    const guess = PENALTY_ZONES[Math.floor(Math.random() * PENALTY_ZONES.length)].id;
    let scored;
    let matched;

    if (pen.side === 'user') {
      matched = guess === direction;
      const chance = Math.max(0.05, Math.min(0.97, (matched ? 0.3 : 0.9) + (shooterOrKeeper.rating - 70) / 300));
      scored = Math.random() < chance;
      pen.shooterName = shooterOrKeeper.name;
      pen.direction = direction; // dónde pateó el usuario
      pen.keeperZone = guess; // a dónde se tiró el arquero rival
    } else {
      matched = guess === direction;
      const chance = Math.max(0.05, Math.min(0.95, (matched ? 0.25 : 0.85) - (shooterOrKeeper.rating - 70) / 300));
      scored = Math.random() < chance;
      pen.keeperName = shooterOrKeeper.name;
      pen.direction = direction; // a dónde se tiró tu arquero
      pen.shooterZone = guess; // a dónde pateó el rival
    }

    pen.resolved = true;
    pen.scored = scored;
    pen.atajadoEnElPalo = matched; // el arquero fue para el lado correcto
    pen.resultado = scored ? 'gol' : (matched ? 'atajada' : 'errado');

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
    // Las novedades físicas salen junto con el resultado, que es cuando el
    // usuario se entera de todo lo que pasó en el partido.
    s.lastAvailabilityNotes = this.updateAvailability();
    Noticias.trasElParteMedico(this, s.lastAvailabilityNotes);
    s.screen = 'match-result';
    this.save();
  },

  // ---------- Bajas: lesiones y suspensiones ----------
  //
  // Un jugador con `out` no puede ser titular hasta que se le acaben los
  // partidos de baja. El contador baja de a uno por cada partido que juega el
  // equipo, así que una baja de 3 partidos son 3 partidos de verdad, no días
  // del calendario.

  isAvailable(player) {
    return !player.out || player.out.matches <= 0;
  },

  outLabel(player) {
    if (this.isAvailable(player)) return null;
    const p = player.out.matches === 1 ? 'partido' : 'partidos';
    return `${player.out.detail} — ${player.out.matches} ${p}`;
  },

  // Después de cada partido: se descuentan las bajas en curso y se sortea si
  // alguno de los que jugó se lesiona o se va expulsado. Devuelve los avisos
  // para mostrarle al usuario en la pantalla del resultado.
  updateAvailability() {
    const s = this.state;
    const avisos = [];

    s.squad.forEach((p) => {
      if (p.out && p.out.matches > 0) {
        p.out.matches--;
        if (p.out.matches === 0) {
          avisos.push(`${p.name} se recuperó y ya está disponible.`);
          p.out = null;
        }
      }
    });

    const titulares = this.getStartingXI().starters
      .map((entry) => s.squad.find((p) => p.id === entry.id))
      .filter((p) => p && this.isAvailable(p));
    if (!titulares.length) return avisos;

    const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];

    // Lesiones: alrededor de un jugador cada cuatro partidos. Las molestias
    // leves son mucho más comunes que las lesiones largas.
    if (Math.random() < 0.26) {
      const p = sortear(titulares);
      const tipo = sortear([
        ...Array(5).fill({ detail: 'Molestia muscular', min: 1, max: 2 }),
        ...Array(3).fill({ detail: 'Desgarro', min: 2, max: 4 }),
        ...Array(2).fill({ detail: 'Esguince de tobillo', min: 3, max: 5 }),
        { detail: 'Lesión de rodilla', min: 5, max: 9 },
      ]);
      const matches = tipo.min + Math.floor(Math.random() * (tipo.max - tipo.min + 1));
      p.out = { reason: 'lesión', detail: tipo.detail, matches };
      avisos.push(`${p.name} se lesionó: ${tipo.detail.toLowerCase()}. Se pierde ${matches} ${matches === 1 ? 'partido' : 'partidos'}.`);
    }

    // Suspensiones: una expulsión cada tantos partidos, o la quinta amarilla.
    if (Math.random() < 0.12) {
      const disponibles = titulares.filter((p) => this.isAvailable(p));
      if (disponibles.length) {
        const p = sortear(disponibles);
        const roja = Math.random() < 0.45;
        const matches = roja ? 1 + Math.floor(Math.random() * 2) : 1;
        p.out = { reason: 'suspensión', detail: roja ? 'Expulsado' : 'Acumulación de amarillas', matches };
        avisos.push(`${p.name} ${roja ? 'se fue expulsado' : 'llegó a la quinta amarilla'}: no puede jugar ${matches === 1 ? 'el próximo partido' : `los próximos ${matches} partidos`}.`);
      }
    }

    // Si alguno de los que quedó afuera era titular, el hueco se cubre solo.
    this.repairStartingSlots();
    return avisos;
  },

  // ---------- Cómo evoluciona cada jugador ----------
  //
  // El sistema viejo agarraba 3 jugadores al azar por partido y les subía o
  // bajaba un punto según la edad y el resultado. Tenía un problema grande:
  // no le importaba si el jugador había jugado. Un pibe que se pasó la
  // temporada en el banco mejoraba igual que el titular, que es justo al
  // revés de lo que pasa en la realidad — un juvenil crece porque juega.
  //
  // Ahora todo se mueve alrededor del TECHO de cada jugador (`potential`, que
  // en los clubes investigados es la proyección real que trajo la
  // investigación). Si está por debajo del techo, crece; si está en el techo
  // o por encima, lo único que le queda es el desgaste de la edad. Eso último
  // no es un detalle: en los jugadores de más de 30 la investigación devuelve
  // una proyección MENOR a la valoración actual, que es su forma de decir
  // "a este se le viene la bajada". El sistema lo respeta.

  // Cuánto ayuda el club a que un jugador crezca. Un grande tiene mejores
  // entrenadores, mejor cuerpo médico y mejores instalaciones que un club de
  // la Nacional: el mismo pibe rinde distinto según dónde se forme.
  factorDeDesarrollo(club) {
    const cat = typeof Economia !== 'undefined' ? Economia.categoriaDe(club) : null;
    return { grandes: 1.25, historicos: 1.15, mediaTabla: 1, chicosPrimera: 0.9, primeraNacional: 0.8 }[cat] || 1;
  },

  // Probabilidad POR PARTIDO de ganar un punto. Los números están calibrados
  // para que un juvenil titular en un grande sume unos 3 a 5 puntos por
  // temporada (son ~40 partidos entre liga y copas), que es más o menos lo
  // que progresa un jugador real que la está rompiendo.
  probabilidadDeMejorar(player, jugo, factorClub, userWon) {
    const techo = player.potential ?? 99;
    if (player.rating >= techo) return 0;
    const edad = player.age;
    let base;
    if (edad <= 19) base = 0.07;
    else if (edad <= 21) base = 0.055;
    else if (edad <= 23) base = 0.04;
    else if (edad <= 25) base = 0.025;
    else if (edad <= 27) base = 0.012;
    else base = 0.004;
    // El que no juega casi no progresa. Es la diferencia más importante con
    // el sistema anterior.
    base *= jugo ? 1 : 0.3;
    // Cuanto más lejos está de su techo, más rápido avanza al principio.
    base *= 0.8 + (techo - player.rating) / 20;
    base *= factorClub;
    if (userWon) base *= 1.15;
    return base;
  },

  // Probabilidad por partido de perder un punto por edad. Antes de los 30 no
  // se cae nadie.
  probabilidadDeCaer(player) {
    const edad = player.age;
    if (edad < 30) return 0;
    if (edad <= 31) return 0.008;
    if (edad <= 33) return 0.02;
    if (edad <= 35) return 0.035;
    return 0.055;
  },

  developSquadAfterMatch(userWon, userLost) {
    const s = this.state;
    const club = this.getClub(s.clubId);
    const factorClub = this.factorDeDesarrollo(club);
    const jugaron = new Set(this.getStartingXI().starters.map((e) => e.id));
    const notas = [];

    s.squad.forEach((p) => {
      const antes = p.rating;
      if (p.rating < (p.potential ?? 99)) {
        if (Math.random() < this.probabilidadDeMejorar(p, jugaron.has(p.id), factorClub, userWon)) {
          p.rating = Math.min(99, p.rating + 1);
        }
      } else if (Math.random() < this.probabilidadDeCaer(p)) {
        p.rating = Math.max(35, p.rating - 1);
      }
      if (p.rating !== antes) {
        notas.push(p.rating > antes
          ? `${p.name} mejoró: ${antes} → ${p.rating}.`
          : `${p.name} bajó un punto: ${antes} → ${p.rating}. Los años no perdonan.`);
        if (p.rating > antes && p.age <= 23 && typeof Noticias !== 'undefined') {
          Noticias.push(s, 'premios',
            `${p.name} sigue creciendo en ${club.name}`,
            `A los ${p.age} años ya está en ${p.rating} de valoración. En el club están convencidos de que todavía tiene margen.`,
            { clubId: s.clubId });
        }
      }
    });

    s.lastDevelopmentNotes = notas;
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
      // Los dos equipos suman en su propia tabla: en un interzonal, cada uno
      // en la zona que le toca.
      const homeTable = this.zoneTableOf(m.home);
      const awayTable = this.zoneTableOf(m.away);
      if (homeTable) this.updateTableRow(homeTable, m.home, m.homeGoals, m.awayGoals);
      if (awayTable) this.updateTableRow(awayTable, m.away, m.awayGoals, m.homeGoals);
      s.log.unshift(`Liga: ${clubName(m.home)} ${m.homeGoals}-${m.awayGoals} ${clubName(m.away)}`);
      if (m.isHome) Economia.cobrarPartidoDeLocal(this, !!(s.matchContext && s.matchContext.clasico));
      this.simulateWholeRound(s.season.roundIndex, m);
      this.recordRoundResult(m.home, m.away, m.homeGoals, m.awayGoals);
      Noticias.trasLaFecha(this);
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
      const seeds = this.playoffSeedsFromZones(zoneATable, zoneBTable);
      season.myD1[season.edition] = { zoneATable, zoneBTable, champion: null, runnerUp: null };
      this.startBracket(season.edition, seeds, PLAYOFF_STAGES);
    } else {
      season.myD2 = { zoneATable, zoneBTable, promotedDirect: null, promotedReducido: null };
      const seeds = [{ id: zoneATable[0].id, seed: 1 }, { id: zoneBTable[0].id, seed: 2 }];
      this.startBracket('final-directa', seeds, ['Final por el Ascenso']);
    }
  },

  // El array ES el cuadro: se enfrentan los vecinos (0 con 1, 2 con 3, ...) y
  // los ganadores quedan en ese mismo orden para la ronda siguiente. Así la
  // llave es fija — el cruce de cada ronda ya está determinado de entrada, no
  // se reordena por posición al terminar cada instancia. Quien arma el
  // cuadro decide los cruces poniendo a cada uno en su lugar del array (ver
  // playoffSeedsFromZones y seedOrderBestVsWorst).
  pairStage(alive) {
    const pairs = [];
    for (let i = 0; i < alive.length; i += 2) pairs.push([alive[i], alive[i + 1]]);
    return pairs;
  },

  // Ordena una lista ya rankeada (de mejor a peor) para que la primera ronda
  // enfrente al mejor con el peor, al segundo con el anteúltimo, etc. De ahí
  // en adelante el cuadro queda fijo como cualquier otro.
  seedOrderBestVsWorst(list) {
    const order = [];
    for (let i = 0; i < list.length / 2; i++) order.push(list[i], list[list.length - 1 - i]);
    return order;
  },

  // Cuadro del Torneo Reducido de la Nacional: del 2º al 8º de cada zona más
  // el perdedor de la Final por el ascenso (15 equipos), ordenados por lo que
  // hicieron en la fase regular y cruzados el mejor contra el peor. Como son
  // 15, el mejor de todos entra con fecha libre.
  reducidoBracket(zoneATable, zoneBTable, finalLoserId) {
    const rows = zoneATable.slice(1, 8).concat(zoneBTable.slice(1, 8));
    const loserRow = zoneATable.concat(zoneBTable).find((r) => r.id === finalLoserId);
    if (loserRow) rows.push(loserRow);
    const ranked = rows
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf)
      .map((r, i) => ({ id: r.id, seed: i + 1 }));
    while (ranked.length < 16) ranked.push({ id: null, seed: ranked.length + 1 });
    return this.seedOrderBestVsWorst(ranked);
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

    // Local el mejor ubicado de la fase regular (seed más bajo). La final de
    // los playoffs de Primera se juega en cancha neutral, así que ahí no hay
    // ventaja para ninguno de los dos.
    const isPlayoffFinal = s.bracket.pendingIsFinal && (s.bracket.kind === 'apertura' || s.bracket.kind === 'clausura');
    s.matchContext = {
      context: 'bracket',
      opponentId: opponentEntry.id,
      isHome: userEntry.seed < opponentEntry.seed,
      isNeutral: isPlayoffFinal,
    };
    this.pickDecision();
    s.screen = 'pre-match';
    this.save();
  },

  resolveUserBracketMatch(userWon, isBye) {
    const s = this.state;
    const isFinal = s.bracket.pendingIsFinal;

    // Premio de la Copa Argentina. Se cobra por la ronda jugada, ganes o
    // pierdas (así funciona el premio por instancia alcanzada), y va acá
    // arriba porque la final sale de esta función por un return propio.
    // Cuántos equipos había antes de esta ronda: los que ya pasaron, más el
    // que salga de tu llave, por dos.
    if (s.bracket.kind === 'copa') {
      const vivosAntes = (s.bracket.pendingWinners.length + 1) * 2;
      Economia.premioCopaArgentina(this, vivosAntes, isFinal && userWon);
    }

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
      const seeds = this.reducidoBracket(season.myD2.zoneATable, season.myD2.zoneBTable, loser);
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

  // Hay dos ventanas de pases por año: una al terminar el Apertura y otra de
  // pretemporada, al terminar el Clausura (ahí ya sabés en qué categoría vas
  // a jugar). En las dos, antes de abrir el mercado, aparece el aviso por los
  // contratos que vencen a fin de esa temporada — que es cuando en la vida
  // real empiezan a preocupar.
  startTransferWindow(reason = 'between-editions') {
    const s = this.state;
    s.season.transferReason = reason;
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
    if (player && (renew || s.squad.length <= MIN_SQUAD || soleAtPosition)) {
      // Lo que cuesta renovar sale de la categoría económica del club (ver
      // Economia.costoRenovacion): no es lo mismo renovarle a un titular en
      // Boca que en un club de la Nacional. Antes era rating * 8000 para
      // todos, y como el club no generaba plata en todo el año, el saldo se
      // iba a menos y no volvía nunca.
      const cost = Economia.costoRenovacion(this, player);
      Economia.registrar(this, `Renovación de ${player.name}`, -cost);
      player.contractYears = 2 + Math.floor(Math.random() * 2);
    } else if (player) {
      s.squad = s.squad.filter((p) => p.id !== playerId);
      this.repairStartingSlots();
    }
    this.showNextContractDecision();
  },

  openTransferMarket() {
    const s = this.state;
    // Lo que se negoció durante el año (panel Mercado) recién se firma acá:
    // fuera de la ventana no se mueve un peso.
    s.notasMercado = Mercado.resolverAcuerdos(this);
    s.market = this.generateMarket();
    s.screen = 'transfer';
    this.save();
  },

  // Cuánto vale un jugador. El precio DUPLICA cada 6 puntos de valoración:
  // un 70 (titular de Primera) vale ~1,5 millones, un 82 (un crack como
  // Almada) ronda los 6, y un 88 se va arriba de los 12. Antes era casi
  // lineal (valoración × 15.000) y un crack costaba apenas un tercio más que
  // uno del montón, así que con el presupuesto de River se compraban trece
  // jugadores de 80 y el mercado no tenía ninguna tensión.
  //
  // La edad ajusta el valor: un pibe con proyección cuesta más caro que un
  // veterano de la misma valoración, al que ya casi no le queda recorrido.
  // Valor de un jugador concreto. Si tiene valor de mercado investigado se
  // usa ese; si no, se estima con la fórmula. Así los clubes ya cargados
  // manejan precios reales y el resto sigue funcionando igual que antes.
  valueOf(player) {
    if (player && player.value) return player.value;
    return this.playerValue(player.rating, player.age);
  },

  playerValue(rating, age) {
    const base = 1500000 * Math.pow(2, (rating - 70) / 6);
    let ageFactor = 1;
    if (age <= 22) ageFactor = 1.3;
    else if (age >= 33) ageFactor = 0.55;
    else if (age >= 30) ageFactor = 0.8;
    return Math.round(base * ageFactor);
  },

  generateMarket() {
    const club = this.getClub(this.state.clubId);
    return Array.from({ length: 5 }, (_, i) => {
      const pos = SQUAD_POSITIONS[Math.floor(Math.random() * SQUAD_POSITIONS.length)];
      const rating = Math.max(38, Math.min(92, Math.round(44 + club.reputation * 6 + (Math.random() * 20 - 6))));
      const age = Math.round(18 + Math.random() * 15);
      const price = Math.round(this.playerValue(rating, age) * (0.85 + Math.random() * 0.3));
      const nation = this.rollNation();
      return { id: `market-${i}-${Date.now()}`, name: this.randomPlayerName(nation), pos, rating, price, age, nation };
    });
  },

  // Un refuerzo SUMA al plantel. Antes reemplazaba al peor jugador de esa
  // posición, así que comprar nunca agrandaba el plantel y encima te borraba
  // a alguien sin avisar. Si el plantel está lleno hay que vender primero,
  // como en la realidad.
  buyPlayer(marketIndex) {
    const s = this.state;
    const offer = s.market[marketIndex];
    if (!offer || s.budget < offer.price) return false;
    if (s.squad.length >= MAX_SQUAD) return false;
    Economia.registrar(this, `Compra de ${offer.name}`, -offer.price);
    s.squad.push({
      id: offer.id,
      name: offer.name,
      pos: offer.pos,
      rating: offer.rating,
      // El jugador que llega del mercado se formó en otro lado, pero de acá
      // en más crece en tu club: se usa tu cantera como aproximación.
      potential: this.computePotential(offer.rating, offer.age, this.getClub(s.clubId)),
      age: offer.age,
      nation: offer.nation,
      contractYears: 3,
    });
    s.market.splice(marketIndex, 1);
    Noticias.trasUnaOperacion(this, 'compra', offer, offer.price);
    this.repairStartingSlots();
    this.save();
    return true;
  },

  // Lo que te pagan por un jugador: un poco menos de lo que vale en el
  // mercado, que es lo que pasa cuando el que vende es el apurado.
  sellValue(player) {
    return Math.round(this.valueOf(player) * 0.75);
  },

  sellPlayer(squadIndex) {
    const s = this.state;
    if (s.squad.length <= MIN_SQUAD) return false;
    const player = s.squad[squadIndex];
    const monto = this.sellValue(player);
    Economia.registrar(this, `Venta de ${player.name}`, monto);
    s.squad.splice(squadIndex, 1);
    Noticias.trasUnaOperacion(this, 'venta', player, monto);
    this.repairStartingSlots();
    this.save();
    return true;
  },

  continueFromTransfer() {
    const s = this.state;
    if (s.season.transferReason === 'between-editions') this.startEdition('clausura');
    else if (s.season.transferReason === 'pre-season') this.startFirstEdition();
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

  // ---------- Fin de año: ascensos/descensos y cupos a copas ----------

  // Reparte de nuevo las zonas de una división para que queden equilibradas
  // (15/15 en Primera, 18/18 en la Nacional) después de mover clubes por
  // ascenso/descenso. Se mezcla al azar, igual que un sorteo de zonas real.
  // Reparte los clubes de una división en las dos zonas. En Primera los pares
  // de clásicos (ver CLASICOS en data.js) van SIEMPRE uno en cada zona: si
  // cayeran juntos no se podría jugar la fecha del clásico, que es interzonal.
  // Cuál de los dos va a cada zona se sortea, así el reparto igual cambia
  // todos los años.
  rebalanceZones(division, perZone) {
    const clubs = this.state.clubs.filter((c) => c.division === division);
    const byId = Object.fromEntries(clubs.map((c) => [c.id, c]));
    const zonas = { A: [], B: [] };
    const yaUbicado = new Set();

    if (division === 'D1') {
      this.shuffled(CLASICOS).forEach(([unId, otroId]) => {
        const uno = byId[unId];
        const otro = byId[otroId];
        // Un clásico solo se separa si los dos están en la categoría: si uno
        // descendió, el que quedó se reparte como cualquier otro club.
        if (!uno || !otro) return;
        const [primero, segundo] = Math.random() < 0.5 ? [uno, otro] : [otro, uno];
        if (zonas.A.length < perZone && zonas.B.length < perZone) {
          zonas.A.push(primero);
          zonas.B.push(segundo);
          yaUbicado.add(primero.id);
          yaUbicado.add(segundo.id);
        }
      });
    }

    this.shuffled(clubs.filter((c) => !yaUbicado.has(c.id))).forEach((club) => {
      (zonas.A.length < perZone ? zonas.A : zonas.B).push(club);
    });

    zonas.A.forEach((c) => { c.zone = 'A'; });
    zonas.B.forEach((c) => { c.zone = 'B'; });
  },

  // Argentina tiene 6 cupos a la Libertadores y 6 a la Sudamericana.
  //
  // Los tres títulos del año —Apertura, Clausura y Copa Argentina— dan
  // Libertadores directo, y un campeón que además descendió conserva igual su
  // cupo. Los cupos de Libertadores que queden (porque un mismo club ganó más
  // de un título) se completan corriendo la Tabla Anual, y el último de esos
  // 6 entra por fase previa en vez de fase de grupos. Después de eso, los 6
  // siguientes de la Tabla Anual van a la Sudamericana.
  assignQualification(d1Data) {
    const s = this.state;
    const assigned = new Set();
    const results = [];
    const grant = (clubId, comp, stage) => {
      if (!clubId || assigned.has(clubId)) return;
      assigned.add(clubId);
      results.push({ clubId, name: this.getClub(clubId).name, comp, stage });
    };

    grant(d1Data.aperturaChampion, 'Libertadores', 'Fase de grupos');
    grant(d1Data.clausuraChampion, 'Libertadores', 'Fase de grupos');
    grant(s.copaBracket.champion, 'Libertadores', 'Fase de grupos');

    const porTabla = d1Data.tablaAnualYear.filter((row) => !assigned.has(row.id));
    const cuposLibertadores = Math.max(0, 6 - results.length);
    porTabla.slice(0, cuposLibertadores).forEach((row, i) => {
      grant(row.id, 'Libertadores', i === cuposLibertadores - 1 ? 'Fase previa' : 'Fase de grupos');
    });
    porTabla.slice(cuposLibertadores, cuposLibertadores + 6).forEach((row) => {
      grant(row.id, 'Sudamericana', 'Fase de grupos');
    });

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

    // En la realidad baja el último de la Tabla Anual y, aparte, el peor
    // promedio de las últimas 3 temporadas. Acá bajan los dos últimos de la
    // Tabla Anual: es una simplificación deliberada para no arrastrar una
    // segunda tabla con el historial de cada club.
    const tablaAnualD1 = d1Data.tablaAnualYear;
    const relegated = tablaAnualD1.slice(-2).map((row) => row.id);

    const promoted = d2Data.promoted.filter((id) => !!id);

    relegated.forEach((id) => { this.getClub(id).division = 'D2'; });
    promoted.forEach((id) => { this.getClub(id).division = 'D1'; });

    // Como el descenso (los dos últimos de la Anual) y el ascenso (Final directa +
    // Reducido) no respetan las zonas de origen, hay que volver a repartir las
    // zonas para que queden 15/15 en Primera y 18/18 en la Nacional. Los
    // clubes que no se movieron pueden cambiar de zona igual: en la vida real
    // la AFA también rearma las zonas cada temporada.
    this.rebalanceZones('D1', 15);
    this.rebalanceZones('D2', 18);

    // Las copas de ESTE año se juegan con los clasificados que salieron de la
    // temporada anterior (como en la realidad), así que la primera temporada
    // de una carrera todavía no tiene copas: se juegan recién al año
    // siguiente, con los cupos que se ganen ahora.
    const copasDelAnio = this.simulateCopasDelAnio(s.copaQualification);

    const qualification = this.assignQualification(d1Data);
    // Estos dos sobreviven al cambio de temporada (a diferencia de
    // lastSeasonSummary, que se limpia): son los que alimentan la pestaña
    // "Copas" del panel durante todo el año siguiente.
    s.ultimasCopas = copasDelAnio;
    Noticias.trasLasCopas(this, copasDelAnio);
    s.copaQualification = qualification;

    // Premios de verdad de fin de año. Antes acá había un único ingreso
    // inventado (un bonus por puesto en la tabla anual y, en la Nacional,
    // $150.000 fijos) que era TODA la plata que el club generaba en el año.
    // Ahora el ingreso ordinario entra semana a semana, así que este bloque
    // se ocupa solo de los premios que se cobran por lograr algo:
    // los títulos de liga y lo que pagó CONMEBOL por la copa que jugaste.
    // El premio por posición en la tabla anual se fue porque, según los
    // datos, no existe: la Liga Profesional paga por salir campeón, no por
    // terminar octavo.
    const notasEconomia = [];
    if (d1Data.aperturaChampion === s.clubId) {
      notasEconomia.push(`Premio por salir campeón del Apertura: ${Economia.monto(Economia.premioTitulo(this, 'apertura'))}.`);
    }
    if (d1Data.clausuraChampion === s.clubId) {
      notasEconomia.push(`Premio por salir campeón del Clausura: ${Economia.monto(Economia.premioTitulo(this, 'clausura'))}.`);
    }
    copasDelAnio.forEach((c) => {
      if (!c.userStage) return;
      const cobrado = Economia.premioInternacional(this, c.copa, c.userStage);
      if (cobrado) notasEconomia.push(`${c.copa}: ${Economia.monto(cobrado)} de premio por llegar a ${c.userStage}.`);
    });

    const userRelegated = relegated.includes(s.clubId);
    const userPromoted = promoted.includes(s.clubId);
    if (userRelegated) {
      const penalty = Math.round(s.budget * 0.25);
      Economia.registrar(this, 'Recorte por el descenso', -penalty);
      notasEconomia.push(`Por el descenso, el presupuesto bajó ${Economia.monto(penalty)} para la próxima temporada.`);
    } else if (userPromoted) {
      Economia.registrar(this, 'Refuerzo económico por el ascenso', 400000);
      notasEconomia.push(`Por el ascenso, la dirigencia sumó un refuerzo económico de ${Economia.monto(400000)}.`);
    }
    if (!notasEconomia.length) notasEconomia.push('Sin premios extra este año: el club se movió con sus ingresos de siempre.');
    const economyNote = notasEconomia.join(' ');

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
      copasInternacionales: copasDelAnio,
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
