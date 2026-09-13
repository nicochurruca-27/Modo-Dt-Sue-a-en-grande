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
// - Copas internacionales (Libertadores y Sudamericana): se arman al empezar
//   el año con los clasificados de la temporada anterior. La fase previa se
//   resuelve ahí mismo (en la realidad se juega en enero y febrero) y los 8
//   grupos de cada copa se sortean con bombos por nivel y sin dos clubes del
//   mismo país en un grupo. Las 6 fechas de la fase de grupos se juegan
//   DURANTE el año, entre marzo y mayo, intercaladas con las fechas de la
//   liga: si tu club está en una copa, las jugás vos; si no, se simulan
//   solas, pero las tablas se pueden mirar igual. Las llaves —de octavos a la
//   final, con el playoff previo en la Sudamericana— se juegan en el Clausura,
//   que es cuando van de verdad (agosto a noviembre): cada instancia es ida y
//   vuelta, define el global y después los penales, y la final es a partido
//   único en una sede neutral del continente. En la Nacional, que tiene un
//   solo torneo de 35 fechas, todo eso entra en las mismas semanas del año.
// - Fechas FIFA: pausan la liga y muestran si algún jugador destacado fue
//   convocado a su selección.
// - Descienden 2 de Primera por año: el último de la tabla de PROMEDIOS
//   (puntos sobre partidos de las últimas 3 temporadas en Primera) y el
//   último de la Tabla Anual que no sea ese mismo. La Tabla Anual es la suma
//   de las fases regulares del Apertura y el Clausura, 32 partidos: los
//   playoffs no cuentan ni para la Anual ni para el promedio. Un campeón
//   puede descender.
// - Cupos a copas internacionales: 6 a Libertadores (campeón Apertura,
//   campeón Clausura, campeón Copa Argentina, y los mejores de la Tabla
//   Anual que no hayan clasificado ya, el último de ellos a fase previa) y
//   6 a Sudamericana (los 6 siguientes de la Anual que no hayan clasificado).
//   Un club que descendió pierde el cupo que le daba la tabla y su lugar se
//   corre al siguiente, salvo que sea el campeón de la Copa Argentina: ese
//   título no se pierde por descender, y es la única manera de que un club de
//   la Nacional juegue la Libertadores. Aparte de esos 12 está el cupo de
//   campeón vigente de la Libertadores o la Sudamericana, que es de CONMEBOL
//   y no gasta ninguno de los 6: si lo gana un argentino, el lugar que deja
//   en la tabla se corre y entra uno más a la Sudamericana.
// - La división en la que NO juega el usuario se simula completa e
//   instantáneamente al arrancar el año (no hay nada interactivo ahí), para
//   que los cupos a copas y los ascensos/descensos tengan sentido siempre.

const SAVE_KEY = 'dt-simulador-save-v3';

const FIFA_ROUNDS = [5, 11];
const COPA_STAGE_NAMES = ['Treintaidosavos de Final', 'Dieciseisavos de Final', 'Octavos de Final', 'Cuartos de Final', 'Semifinal', 'Final'];

// ---------- El calendario del año ----------
//
// La unidad es la semana: una fecha de liga por semana, el fin de semana. Los
// partidos de copa se juegan ENTRE SEMANA, en la misma semana que la fecha de
// liga, así que un checkpoint de copa NO arranca una semana nueva: sigue la
// que está (ver seguirEnLaMismaSemana). Antes cada partido de copa se comía
// siete días y el año futbolero terminaba durando catorce meses.
//
// Con esto el año entra en un año: arranca el 1º de febrero y las finales de
// los playoffs caen a mediados de diciembre, como en la realidad.
//
// Abajo está dónde cae cada partido de copa, por fecha del torneo local. En
// Primera el año son dos torneos, así que hay una lista para cada uno; la
// Nacional juega un torneo anual de 35 fechas y lleva una sola.
//
// Los números salen de las fechas reales. Contando las semanas que se comen
// las fechas FIFA y el mercado de pases del medio, las fechas del Apertura
// caen entre febrero y junio y las del Clausura entre julio y noviembre, así
// que cada competencia queda más o menos donde va:
//
//   Recopa            febrero (dos fechas seguidas)
//   Fase de grupos    marzo, abril y mayo, dos por mes
//   Copa Argentina    de febrero a noviembre, una cada mes y medio
//   Llaves de copa    de julio a noviembre, ida y vuelta con un hueco
const FECHAS_DE_COPAS = {
  D1: {
    apertura: {
      recopa: [0, 1],
      grupos: [4, 6, 8, 10, 12, 14],
      copaArgentina: [2, 9, 15],
    },
    clausura: {
      copaArgentina: [5, 9, 13],
      llaves: { playoff: [0, 1], octavos: [3, 4], cuartos: [7, 8], semis: [11, 12], final: [15] },
    },
  },
  D2: {
    unico: {
      recopa: [0, 1],
      grupos: [4, 6, 8, 10, 12, 14],
      copaArgentina: [2, 9, 15, 22, 27, 33],
      llaves: { playoff: [18, 19], octavos: [20, 21], cuartos: [24, 25], semis: [28, 29], final: [31] },
    },
  },
};

// Las instancias de las llaves, en orden. El playoff de octavos es solo de la
// Sudamericana: ahí el segundo de cada grupo se cruza con un tercero de la
// Libertadores. En qué fecha cae cada una sale de FECHAS_DE_COPAS.
const COPA_INTER_LLAVES = [
  { etapa: 'playoff', nombre: 'Playoff de Octavos', alcanzado: 'el playoff de octavos', soloSudamericana: true },
  { etapa: 'octavos', nombre: 'Octavos de Final', alcanzado: 'los octavos de final' },
  { etapa: 'cuartos', nombre: 'Cuartos de Final', alcanzado: 'los cuartos de final' },
  { etapa: 'semis', nombre: 'Semifinal', alcanzado: 'las semifinales' },
  { etapa: 'final', nombre: 'Final', alcanzado: 'la final', neutral: true },
];
const FECHAS_DE_GRUPOS = 6;
const GRUPOS_POR_COPA = 8;
const LETRAS_DE_GRUPO = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const TRANSFER_ROUND_D2 = 17; // ventana de pases de la Nacional, a mitad de su único torneo
// Primera juega 16 fechas: las 15 del fixture de su zona (14 partidos contra
// su zona + el interzonal de emparejamiento en la fecha que le tocaría estar
// libre) más una última fecha de clásicos, también interzonal. La Nacional
// juega DOS ruedas contra su propia zona de 18 (34 fechas, ida y vuelta) más
// una fecha interzonal al final: 35 partidos de fase regular por club.
const TOTAL_ROUNDS = { D1: 16, D2: 35 };
// Límites del plantel: con el máximo lleno hay que vender para poder
// comprar, y con el mínimo no se puede vender más (si no te quedás sin
// equipo). El tope es 36 y no 30 porque los planteles de verdad son así de
// grandes: Boca arranca con 31 contando a los pibes que suben de la Reserva,
// y con el tope viejo no podías traer a nadie sin vender dos.
// Los dos últimos de cada zona de la Nacional se van al Federal A. Abajo de la
// Nacional el juego no tiene nada cargado, así que esto solo se mira para tu
// club: si el que dirigís se va a la tercera, la carrera se termina ahí. Es la
// única manera de perder el juego.
const DESCENSOS_POR_ZONA_D2 = 2;
const MAX_SQUAD = 36;
// A partir de acá el juego empieza a avisar que te estás quedando sin lugar.
const AVISO_PLANTEL = 3;
const MIN_SQUAD = 14;

// ---------- Energía ----------
//
// Cada jugador tiene una energía de 0 a 100. Jugar la gasta, los días la
// recuperan. Recién ahora tiene sentido: hasta que se arregló el calendario
// había un partido por semana y rotar no servía de nada. Con copa entre
// semana y liga el fin de semana, una semana doble te deja el once fundido.
//
// Los números están puestos para que un titular que juega SOLO la liga se
// mantenga arriba (gasta 29 y recupera 35 en la semana), y para que el que
// juega absolutamente todo no exista: con 45 partidos en el año no hay
// descanso que alcance. Hay que rotar, que es de lo que se trata.
const ENERGIA_MAXIMA = 100;
const ENERGIA_POR_PARTIDO = 30;
const ENERGIA_POR_DIA = 5;
// Abajo de esto el jugador empieza a rendir menos. Arriba, juega entero.
const ENERGIA_SIN_MERMA = 80;
// Lo peor que puede rendir un jugador reventado: el 72% de su valoración.
const RENDIMIENTO_MINIMO = 0.72;
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

  // La cancha de un club, o null si todavía no está cargada (los de la
  // Primera Nacional). Quien la muestre tiene que bancarse el null.
  estadioDe(clubId) {
    const propio = (typeof ESTADIOS === 'undefined' ? null : ESTADIOS[clubId]);
    if (propio) return propio;
    // Cuando el partido es de copa, el rival puede ser de afuera: su estadio
    // viene cargado en el propio club (ver CLUBES_INTERNACIONALES).
    const deAfuera = (typeof CLUBES_INTERNACIONALES === 'undefined' ? [] : CLUBES_INTERNACIONALES)
      .find((c) => c.id === clubId);
    return (deAfuera && deAfuera.estadio) || null;
  },

  // Una cancha neutral al azar para las llaves (playoffs y Copa Argentina).
  canchaNeutral() {
    const canchas = typeof CANCHAS_NEUTRALES === 'undefined' ? [] : CANCHAS_NEUTRALES;
    return canchas.length ? canchas[Math.floor(Math.random() * canchas.length)] : null;
  },

  getClub(id) {
    return this.state.clubs.find((c) => c.id === id) || this.clubInternacional(id);
  },

  // Los clubes del resto del continente no están en s.clubs (no se puede
  // dirigir a ninguno), pero desde que las copas se juegan de verdad aparecen
  // como rivales en la pantalla de partido, en la tabla del grupo y en el
  // historial. Para que todo eso funcione sin tocar nada más, se los devuelve
  // con la misma forma que un club argentino: su `nivel` hace de reputación.
  clubInternacional(id) {
    const c = (typeof CLUBES_INTERNACIONALES === 'undefined' ? [] : CLUBES_INTERNACIONALES)
      .find((x) => x.id === id);
    if (!c) return undefined;
    return {
      id: c.id,
      name: c.nombre,
      reputation: c.nivel,
      pais: c.pais,
      internacional: true,
      colors: c.colores ? [c.colores.primario, c.colores.secundario] : ['#888888', '#ffffff'],
    };
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
        // Cuánto se aparta su sueldo investigado de lo que diría la curva. Se
        // calcula una sola vez, acá, y después el sueldo se mueve con el
        // jugador sin perder esa proporción (ver Economia.sueldoBase).
        factorSueldo: p.salary
          ? p.salary / Math.max(1, Economia.curvaSalarial(p.rating, p.age))
          : undefined,
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

  // Cuánto vale un club en la cancha.
  //
  // El tuyo vale lo que valen tus once. Los demás valían `reputación * 6`: un
  // número fijo que no cambiaba nunca, ni en la fecha 30 ni en la temporada
  // 12. Eso hacía que ningún club pudiera crecer ni caer, que venderle el 9 a
  // Vélez no debilitara a Vélez, y que vos ganaras todo.
  //
  // Ahora sale del plantel de verdad. Mercado.plantel() ya arma el plantel
  // completo de cualquier club con un generador sembrado por id: es el mismo
  // siempre, envejece y evoluciona solo con los años, y NO incluye a los
  // jugadores que vos le compraste. Todo eso ya estaba escrito; lo único que
  // faltaba era que el motor de partido lo mirara.
  clubStrength(clubId) {
    if (clubId === this.state.clubId) return this.squadStrength();
    const club = this.getClub(clubId);
    if (!club) return 50;
    // El ±3 es la diferencia entre un día bueno y uno malo. Antes era ±5 sobre
    // un número fijo y era lo ÚNICO que separaba dos partidos del mismo club.
    return this.fuerzaDelPlantel(clubId, club) + (Math.random() * 6 - 3);
  },

  // El nivel del mejor once posible de un club: el arquero y los diez de campo
  // de más valoración. No se toman los 11 mejores a secas porque sin el
  // arquero un club lleno de delanteros daría un promedio inflado.
  //
  // Armar un plantel cuesta (son ~22 jugadores con nombre, edad y valor), y
  // esto se llama dos veces por partido en cada fecha de las dos divisiones.
  // Así que se guarda el resultado. La memoria NO va en this.state: es un dato
  // derivado, se puede recalcular siempre, y no tiene por qué engordar el
  // guardado. La clave lleva el año (los planteles envejecen) y cuántos
  // jugadores fichaste (comprarle uno a un club lo deja sin él).
  fuerzaDelPlantel(clubId, club) {
    const s = this.state;
    const clave = `${clubId}|${s.season ? s.season.year : 1}|${(s.mercado && s.mercado.fichados || []).length}`;
    if (!this._fuerzas) this._fuerzas = {};
    if (this._fuerzas[clave] != null) return this._fuerzas[clave];

    let fuerza;
    const plantel = typeof Mercado !== 'undefined' ? Mercado.plantel(this, clubId) : null;
    if (!plantel || plantel.length < 11) {
      // Un club sin plantel generable (no debería pasar) cae al número viejo.
      fuerza = 44 + club.reputation * 6;
    } else {
      const porRating = (a, b) => b.rating - a.rating;
      const arquero = plantel.filter((p) => p.pos === 'POR').sort(porRating)[0];
      const campo = plantel.filter((p) => p !== arquero).sort(porRating).slice(0, arquero ? 10 : 11);
      const once = arquero ? [arquero, ...campo] : campo;
      fuerza = once.reduce((suma, p) => suma + p.rating, 0) / once.length;
    }
    this._fuerzas[clave] = fuerza;
    return fuerza;
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

  // Lo que rinde de verdad un jugador en la cancha: su valoración ajustada por
  // dos cosas independientes, si está jugando en su puesto y cómo está
  // físicamente.
  effectiveRating(player, slot, formation, slotIndex, slotCount) {
    const puesto = this.positionFit(player, slot, formation, slotIndex, slotCount).mult;
    return Math.round(player.rating * puesto * this.factorDeEnergia(player));
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

  // ---------- Banco de suplentes y reserva ----------
  //
  // De los que no son titulares, doce van al banco y el resto a la reserva.
  // El banco lo arma el juego solo la primera vez (el mejor arquero que
  // quede, y después por valoración), pero una vez que lo tocás manda tu
  // orden: s.banco es la lista de los doce y se guarda con la partida.
  BANCO_SUPLENTES: 12,

  // Todos los que no están en el once, con los lesionados y suspendidos al
  // final: arriba quedan los que realmente podés poner en la cancha.
  getBench() {
    const s = this.state;
    if (!s.startingSlots || !s.startingSlots.length) this.recomputeStartingSlots();
    const startingSet = new Set(s.startingSlots.map((e) => e.playerId).filter(Boolean));
    return [...s.squad]
      .filter((p) => !startingSet.has(p.id))
      .sort((a, b) => (this.isAvailable(b) - this.isAvailable(a)) || b.rating - a.rating);
  },

  // Deja s.banco con doce nombres válidos: saca a los que se fueron del club
  // o pasaron a ser titulares y completa con los mejores de la reserva. Si
  // entre los doce no quedó ningún arquero, entra el mejor que haya: quedarse
  // sin arquero en el banco no es una decisión táctica, es un descuido.
  asegurarBanco() {
    const s = this.state;
    const fueraDelOnce = this.getBench();
    const disponibles = new Map(fueraDelOnce.map((p) => [p.id, p]));
    const banco = (s.banco || []).filter((id) => disponibles.has(id));
    const enBanco = new Set(banco);
    const resto = fueraDelOnce.filter((p) => !enBanco.has(p.id));

    while (banco.length < this.BANCO_SUPLENTES && resto.length) {
      const hayArquero = banco.some((id) => disponibles.get(id).pos === 'POR');
      const faltanParaCerrar = this.BANCO_SUPLENTES - banco.length;
      const arquero = resto.find((p) => p.pos === 'POR');
      const elegido = (!hayArquero && arquero && faltanParaCerrar === 1) ? arquero : resto[0];
      banco.push(elegido.id);
      enBanco.add(elegido.id);
      resto.splice(resto.indexOf(elegido), 1);
    }
    s.banco = banco;
    return banco;
  },

  // Los doce del banco, en el orden que tengan guardado.
  getBanco() {
    const ids = this.asegurarBanco();
    const porId = new Map(this.state.squad.map((p) => [p.id, p]));
    return ids.map((id) => porId.get(id)).filter(Boolean);
  },

  // Los que no entran ni al once ni al banco.
  getReserva() {
    const enBanco = new Set(this.asegurarBanco());
    return this.getBench().filter((p) => !enBanco.has(p.id));
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
    const banco = this.asegurarBanco();
    const enBancoA = banco.indexOf(idA);
    const enBancoB = banco.indexOf(idB);

    // Dos del banco (o uno del banco y uno de la reserva): cambian de lugar
    // entre ellos y el once no se toca.
    const esTitular = (id) => s.startingSlots.some((e) => e.playerId === id);
    if (!esTitular(idA) && !esTitular(idB)) {
      if (enBancoA >= 0 && enBancoB >= 0) {
        banco[enBancoA] = idB;
        banco[enBancoB] = idA;
      } else if (enBancoA >= 0) {
        banco[enBancoA] = idB;
      } else if (enBancoB >= 0) {
        banco[enBancoB] = idA;
      } else {
        return false; // los dos son de la reserva: no hay nada que cambiar
      }
      s.banco = banco;
      this.save();
      return true;
    }
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
    const starterId = starterEntry.playerId;
    const benchId = slotA ? idB : idA;
    if (!s.squad.some((p) => p.id === benchId)) return false;
    starterEntry.playerId = benchId;
    // El que sale de la cancha ocupa exactamente el lugar del que entró: si
    // el que entró estaba en el banco, se queda con ese lugar; si venía de la
    // reserva, el titular se va a la reserva.
    const lugar = banco.indexOf(benchId);
    if (lugar >= 0) {
      banco[lugar] = starterId;
      s.banco = banco;
    }
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

  // Los 30 minutos del alargue: un tercio de un partido, con los mismos
  // lambdas de simulateScore divididos por tres. Sin ventaja de localía, que
  // en un alargue ya pesa poco y en cancha neutral directamente no existe.
  simulateExtraTime(m) {
    const mia = this.squadStrength();
    const suya = this.clubStrength(m.opponentId);
    const diff = (m.isHome ? mia - suya : suya - mia);
    const lambdaHome = Math.max(0.7, Math.min(2.1, 1.25 + diff / 40)) / 3;
    const lambdaAway = Math.max(0.65, Math.min(1.95, 1.1 - diff / 40)) / 3;
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
  // ---------- Promedios ----------
  //
  // Bajan dos por año: el último de la tabla de PROMEDIOS y, aparte, el último
  // de la Tabla Anual que no sea ese mismo. Si el peor promedio es además el
  // último de la Anual, no baja dos veces: baja por promedio y el segundo
  // descenso se lo lleva el anteúltimo de la Anual.
  //
  // El promedio es la suma de puntos dividida por la suma de partidos de las
  // últimas tres temporadas EN PRIMERA. A un recién ascendido NO se le
  // rellenan con cero las temporadas que jugó en la Nacional: se le divide
  // solo por los partidos que jugó acá, así que puede tener mejor promedio que
  // un club con más historia pero peor campaña.
  //
  // Solo entran los puntos de las fases regulares del Apertura y el Clausura
  // (32 partidos por año). Los playoffs, la Copa Argentina y las copas
  // internacionales no cuentan.
  registrarTemporadaEnHistorial(tablaAnual) {
    const s = this.state;
    s.historialPuntos = s.historialPuntos || {};
    tablaAnual.forEach((row) => {
      const previas = s.historialPuntos[row.id] || [];
      s.historialPuntos[row.id] = previas.concat([{ pts: row.pts, pj: row.played }]).slice(-3);
    });
  },

  tablaDePromedios(tablaAnual) {
    const historial = (this.state && this.state.historialPuntos) || {};
    return tablaAnual
      .map((row) => {
        const temporadas = historial[row.id] || [];
        const pts = temporadas.reduce((t, x) => t + x.pts, 0);
        const pj = temporadas.reduce((t, x) => t + x.pj, 0);
        return { id: row.id, name: row.name, pts, pj, temporadas: temporadas.length, promedio: pj ? pts / pj : 0 };
      })
      .sort((a, b) => b.promedio - a.promedio);
  },

  // Al arrancar una carrera nadie tiene historial, así que la tabla de
  // promedios sería idéntica a la Anual y el descenso por promedio no
  // significaría nada hasta la tercera temporada. Por eso se siembran dos
  // temporadas previas inventadas pero verosímiles, sacadas de la reputación
  // de cada club: un grande arranca con colchón y uno chico arranca comprometido,
  // que es justo lo que hace que el promedio pese.
  sembrarHistorialDePromedios() {
    const s = this.state;
    s.historialPuntos = {};
    s.clubs.filter((c) => c.division === 'D1').forEach((club) => {
      const temporadas = [];
      for (let i = 0; i < 2; i++) {
        const porPartido = 0.95 + club.reputation * 0.19 + (Math.random() * 0.3 - 0.15);
        temporadas.push({ pts: Math.round(Math.max(0.6, porPartido) * 32), pj: 32 });
      }
      s.historialPuntos[club.id] = temporadas;
    });
  },

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

  // Cada país del resto del continente reparte sus cupos de nuevo todos los
  // años. Cuántos cupos tiene cada uno no cambia (sale de
  // CUPOS_INTERNACIONALES, tomado de las ediciones reales), pero quién los
  // ocupa se define por la campaña de ese año: el nivel del club pesa, pero
  // con bastante azar encima.
  //
  // La gracia es que internacional.js tiene bastantes más clubes por país que
  // cupos, así que los que sobran se quedan afuera esa temporada. Por eso
  // Flamengo está casi siempre y Coritiba aparece de vez en cuando, y no te
  // cruzás todos los años exactamente con los mismos.
  //
  // Los cupos se reparten de mejor a peor: los grupos de la Libertadores
  // primero, después su fase previa, después la Sudamericana.
  sortearCuposInternacionales() {
    const porPais = {};
    (typeof CLUBES_INTERNACIONALES === 'undefined' ? [] : CLUBES_INTERNACIONALES)
      .forEach((c) => { (porPais[c.pais] = porPais[c.pais] || []).push(c); });

    const sorteados = [];
    Object.entries(porPais).forEach(([pais, clubes]) => {
      const cupos = CUPOS_INTERNACIONALES[pais];
      if (!cupos) return;
      const plazas = [
        ...Array.from({ length: cupos.libertadoresGrupos }, () => ({ copa: 'Libertadores', fase: 'grupos' })),
        ...Array.from({ length: cupos.libertadoresPrevia }, () => ({ copa: 'Libertadores', fase: 'previa' })),
        ...Array.from({ length: cupos.sudamericanaGrupos }, () => ({ copa: 'Sudamericana', fase: 'grupos' })),
        ...Array.from({ length: cupos.sudamericanaPrimeraFase }, () => ({ copa: 'Sudamericana', fase: 'previa' })),
      ];
      const ranking = clubes
        .map((c) => ({ club: c, campania: c.nivel + Math.random() * 3.5 }))
        .sort((a, b) => b.campania - a.campania);
      ranking.slice(0, plazas.length).forEach((r, i) => {
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
  // Lo que se juega antes de la fase de grupos. Devuelve { pasan, eliminados }:
  // los `eliminados` importan porque en la Libertadores los que pierden la
  // última fase previa no se van a casa, caen a los grupos de la Sudamericana.
  //
  // Ver FASES_PREVIAS en internacional.js para el formato de cada copa. Una
  // copa sin formato cargado, o con menos equipos de los que ese formato
  // espera, se resuelve en una sola ronda cruzando a todos de a dos.
  jugarFasesPrevias(copa, previa, byId) {
    const formato = (typeof FASES_PREVIAS === 'undefined' ? null : FASES_PREVIAS[copa]) || {};
    // El camino del usuario, para cobrar la previa por lo que jugó de verdad:
    // en qué fases estuvo y, en la Sudamericana (que es a partido único), si
    // le tocó de local.
    const camino = { fases: [], deLocal: false };
    const cruzar = (ids, numeroDeFase) => {
      const pasan = [];
      const eliminados = [];
      for (let i = 0; i < ids.length; i += 2) {
        if (ids[i] === this.state.clubId || ids[i + 1] === this.state.clubId) {
          camino.fases.push(numeroDeFase);
          camino.deLocal = ids[i] === this.state.clubId;
        }
        const ganador = this.copaTieWinner(ids[i], ids[i + 1], byId);
        pasan.push(ganador);
        const perdedor = ganador === ids[i] ? ids[i + 1] : ids[i];
        if (perdedor) eliminados.push(perdedor);
      }
      return { pasan, eliminados };
    };

    // Sudamericana: los equipos de cada país se cruzan entre ellos.
    if (formato.cruceEntreCompatriotas) {
      const porPais = {};
      previa.forEach((id) => {
        const pais = (byId[id] && byId[id].pais) || '—';
        (porPais[pais] = porPais[pais] || []).push(id);
      });
      const pasan = [];
      const eliminados = [];
      Object.values(porPais).forEach((delPais) => {
        const r = cruzar(this.shuffled(delPais), 1);
        pasan.push(...r.pasan);
        eliminados.push(...r.eliminados);
      });
      return { pasan, eliminados, camino };
    }

    const fases = formato.encadenadas || [];
    if (!fases.length || previa.length < fases[0]) return { ...cruzar(previa, 1), camino };

    const esperando = previa.slice();
    let vivos = [];
    let eliminadosUltima = [];
    fases.forEach((cuantosJuegan, i) => {
      vivos = vivos.concat(esperando.splice(0, Math.max(0, cuantosJuegan - vivos.length)));
      const r = cruzar(vivos, i + 1);
      vivos = r.pasan;
      eliminadosUltima = r.eliminados;
    });
    // Si quedó alguno sin entrar a ninguna fase (porque ese año hubo más
    // equipos en previa de los que el formato contempla), pasa directo.
    return { pasan: vivos.concat(esperando), eliminados: eliminadosUltima, camino };
  },

  // Ordena un grupo con los criterios de desempate que rigen desde 2026: lo
  // primero son los puntos, pero entre los que quedaron empatados manda el
  // mano a mano (puntos, diferencia y goles SOLO en los partidos entre ellos)
  // y recién después la diferencia de gol de todo el grupo. Hasta 2025 se
  // arrancaba por la diferencia general, que es lo que hacía el juego antes.
  //
  // Las tarjetas, que en el reglamento van después de los goles, no se usan:
  // el simulador no lleva amonestados en las copas.
  ordenarGrupo(filas, partidos) {
    const porPuntos = {};
    filas.forEach((f) => { (porPuntos[f.pts] = porPuntos[f.pts] || []).push(f); });
    const generales = (a, b) => (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf;
    return Object.keys(porPuntos)
      .map(Number)
      .sort((a, b) => b - a)
      .reduce((orden, pts) => {
        const empatados = porPuntos[pts];
        if (empatados.length < 2) return orden.concat(empatados);
        const entreEllos = new Set(empatados.map((f) => f.id));
        const mini = {};
        empatados.forEach((f) => { mini[f.id] = { pts: 0, gf: 0, ga: 0 }; });
        partidos.forEach((p) => {
          if (!entreEllos.has(p.local) || !entreEllos.has(p.visitante)) return;
          mini[p.local].gf += p.golesLocal; mini[p.local].ga += p.golesVisitante;
          mini[p.visitante].gf += p.golesVisitante; mini[p.visitante].ga += p.golesLocal;
          if (p.golesLocal > p.golesVisitante) mini[p.local].pts += 3;
          else if (p.golesVisitante > p.golesLocal) mini[p.visitante].pts += 3;
          else { mini[p.local].pts += 1; mini[p.visitante].pts += 1; }
        });
        return orden.concat(empatados.slice().sort((a, b) =>
          mini[b.id].pts - mini[a.id].pts
          || generales(mini[a.id], mini[b.id])
          || generales(a, b)));
      }, []);
  },

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
  //
  // La Libertadores va primero porque le da de comer a la Sudamericana, como
  // en la realidad: los que pierden su última fase previa caen a los grupos de
  // la Sudamericana, y los 8 terceros de grupo van a su playoff de octavos.
  // Por eso un club puede aparecer en las dos copas el mismo año, y cobrar
  // premio en las dos.
  simulateCopasDelAnio(qualification) {
    // Lo normal es que las copas se hayan ido jugando durante el año: ahí el
    // sorteo de cupos, las fases previas y los grupos ya están hechos y lo
    // único que falta resolver son las eliminatorias. El camino de abajo (con
    // sorteo acá mismo) queda para una partida que no llegó a armarlas.
    const enCurso = !!this.copaEnCurso('Libertadores') || !!this.copaEnCurso('Sudamericana');
    if (!enCurso && (!qualification || !qualification.length)) return [];
    const internacionales = enCurso ? null : this.sortearCuposInternacionales();
    const recopa = this.simularRecopa();
    const libertadores = this.simulateCopa('Libertadores', qualification, internacionales, enCurso ? {} : {
      aGrupos: this.campeonesVigentes(qualification, internacionales),
    });
    const sudamericana = this.simulateCopa('Sudamericana', qualification, internacionales, {
      // Los que bajan de la previa de la Libertadores ya entraron a los grupos
      // de la Sudamericana cuando se armó la copa, en febrero.
      aGrupos: enCurso || !libertadores ? [] : libertadores.bajanAGrupos,
      alPlayoff: libertadores ? libertadores.bajanAlPlayoff : [],
    });
    // Los que bajan son para armar la otra copa, no para guardarlos en la
    // partida: se sacan del resumen que queda en el save.
    return [recopa, libertadores, sudamericana]
      .filter(Boolean)
      .map(({ bajanAGrupos, bajanAlPlayoff, ...resumen }) => resumen);
  },

  // Un club, en el formato mínimo que usan las copas. Sirve tanto para los
  // argentinos (que salen de s.clubs) como para el resto del continente.
  entrantDeClub(id) {
    // OJO: acá se busca en s.clubs a mano y NO con getClub(), porque getClub()
    // también resuelve clubes del resto del continente (ver clubInternacional)
    // y entonces todos saldrían marcados como argentinos. Justamente lo que
    // decide esta función es de qué país es cada uno, que es lo que después
    // impide que dos compatriotas caigan en el mismo grupo.
    const propio = (this.state.clubs || []).find((c) => c.id === id);
    if (propio) return { id, nombre: propio.name, pais: 'Argentina', nivel: propio.reputation };
    const deAfuera = (typeof CLUBES_INTERNACIONALES === 'undefined' ? [] : CLUBES_INTERNACIONALES)
      .find((c) => c.id === id);
    return deAfuera ? { id, nombre: deAfuera.nombre, pais: deAfuera.pais, nivel: deAfuera.nivel } : null;
  },

  // Los campeones del año pasado de las dos copas tienen su cupo propio en la
  // Libertadores y entran directo a la fase de grupos. Son los dos lugares que
  // hacen que la copa llegue a 47 equipos y 32 en la fase de grupos.
  //
  // Si el campeón ya se había ganado un lugar por su liga, el cupo NO se
  // pierde: se corre al mejor club de su país que había quedado afuera, que es
  // como se reparte en la realidad. La excepción es un campeón argentino,
  // porque los cupos argentinos ya salieron de la temporada del juego: ahí sí
  // se pierde el lugar y la copa queda con uno menos.
  campeonesVigentes(qualification, internacionales) {
    const yaEstan = new Set(
      (qualification || []).map((q) => q.clubId).concat((internacionales || []).map((c) => c.id)),
    );
    const entrants = [];
    const suplenteDe = (pais) => {
      const deAfuera = (typeof CLUBES_INTERNACIONALES === 'undefined' ? [] : CLUBES_INTERNACIONALES)
        .filter((x) => x.pais === pais && !yaEstan.has(x.id))
        .sort((a, b) => b.nivel - a.nivel)[0];
      return deAfuera
        ? { id: deAfuera.id, nombre: deAfuera.nombre, pais: deAfuera.pais, nivel: deAfuera.nivel }
        : null;
    };
    const sumar = (club) => {
      if (!club || yaEstan.has(club.id)) return false;
      yaEstan.add(club.id);
      entrants.push({ ...club, fase: 'grupos' });
      return true;
    };
    // Solo las dos copas internacionales reparten cupo de campeón vigente. Los
    // títulos nacionales (Trofeo de Campeones, Supercopa Argentina y demás)
    // también pasan por acá y no dan nada: sin este filtro, el campeón de la
    // Supercopa se metía en los grupos de la Libertadores por la ventana.
    ((this.state && this.state.ultimasCopas) || []).forEach((c) => {
      if (c.esRecopa || !c.championId) return;
      if (c.copa !== 'Libertadores' && c.copa !== 'Sudamericana') return;
      const campeon = this.entrantDeClub(c.championId);
      if (!campeon) return;
      // Si el campeón es argentino su cupo ya se lo dio assignQualification
      // junto con los demás cupos del país, y el corrimiento que genera ya se
      // hizo ahí. Acá se resuelven solo los del resto del continente.
      if (campeon.pais === 'Argentina') return;
      if (sumar(campeon)) return;
      // El campeón ya había clasificado por su liga, así que el cupo no se
      // pierde: se lo queda el mejor club de su país que se había quedado
      // afuera del pozo del continente. Así la copa entra siempre con 32.
      const suplente = suplenteDe(campeon.pais);
      if (suplente) sumar(suplente);
    });
    return entrants;
  },

  // ---------- Títulos nacionales ----------
  //
  // Además del Apertura y el Clausura hay cuatro títulos más en juego, y no
  // son amistosos: son oficiales y cuentan como vuelta olímpica.
  //
  //   Campeón de Liga        — el primero de la Tabla Anual. No se juega un
  //                            partido: se gana sumando todo el año.
  //   Trofeo de Campeones    — campeón del Apertura contra campeón del
  //                            Clausura, partido único en cancha neutral.
  //   Supercopa Argentina    — campeón del Trofeo contra campeón de la Copa
  //                            Argentina, los dos del año pasado.
  //   Supercopa Internacional— campeón del Trofeo contra el Campeón de Liga,
  //                            también del año pasado.
  //
  // Las dos Supercopas se juegan al año siguiente, así que usan lo que quedó
  // guardado en s.ultimosTitulos cuando cerró la temporada anterior.
  //
  // Queda afuera la Recopa de Campeones (un triangular que arranca recién en
  // 2027 y que el propio reglamento pone por debajo de todos estos).
  simularTitulosNacionales(d1Data) {
    const s = this.state;
    const resultados = [];
    const anual = d1Data.tablaAnualYear || [];
    const previos = s.ultimosTitulos || {};

    const campeonDeLiga = anual[0] ? anual[0].id : null;
    if (campeonDeLiga) {
      resultados.push({
        copa: 'Campeón de Liga',
        nombrePropio: true,
        sinArticulo: true,
        championId: campeonDeLiga,
        championName: this.getClub(campeonDeLiga).name,
        runnerUpName: anual[1] ? anual[1].name : null,
        userWon: campeonDeLiga === s.clubId,
        userStage: campeonDeLiga === s.clubId ? 'el título' : null,
      });
    }

    const trofeo = this.jugarTrofeoDeCampeones(d1Data);
    if (trofeo) resultados.push(trofeo);

    const supArg = this.finalDeUnPartido('Supercopa Argentina', previos.trofeoDeCampeones, previos.copaArgentina)
      || this.finalDeUnPartido('Supercopa Argentina', previos.trofeoDeCampeones, previos.trofeoSubcampeon);
    if (supArg) resultados.push(supArg);

    const supInt = this.finalDeUnPartido('Supercopa Internacional', previos.trofeoDeCampeones, previos.campeonDeLiga)
      || this.finalDeUnPartido('Supercopa Internacional', previos.trofeoDeCampeones, previos.segundoDeLaAnual);
    if (supInt) resultados.push(supInt);

    // Lo que necesitan las Supercopas del año que viene.
    s.ultimosTitulos = {
      trofeoDeCampeones: trofeo ? trofeo.championId : null,
      trofeoSubcampeon: trofeo ? trofeo.runnerUpId : null,
      copaArgentina: s.copaBracket ? s.copaBracket.champion : null,
      campeonDeLiga,
      segundoDeLaAnual: anual[1] ? anual[1].id : null,
    };
    return resultados;
  },

  // Un título que se define en un partido único. Devuelve null si falta
  // alguno de los dos o si son el mismo club, para que el que llama pueda
  // probar con el suplente que manda el reglamento.
  // El artículo que le corresponde al nombre del título, para que las
  // pantallas no tengan que adivinarlo: la Supercopa, la Recopa, el Trofeo.
  articuloDe(nombre) {
    return /^(Copa|Supercopa|Recopa|Liga)/.test(nombre) ? 'la' : 'el';
  },

  finalDeUnPartido(nombre, idA, idB) {
    if (!idA || !idB || idA === idB) return null;
    const a = this.entrantDeClub(idA);
    const b = this.entrantDeClub(idB);
    if (!a || !b) return null;
    const byId = { [idA]: a, [idB]: b };
    const ganador = this.copaTieWinner(idA, idB, byId);
    const perdedor = ganador === idA ? idB : idA;
    const jugaste = ganador === this.state.clubId || perdedor === this.state.clubId;
    return {
      copa: nombre,
      nombrePropio: true,
      articulo: this.articuloDe(nombre),
      championId: ganador,
      championName: byId[ganador].nombre,
      championPais: byId[ganador].pais,
      runnerUpId: perdedor,
      runnerUpName: byId[perdedor].nombre,
      userWon: ganador === this.state.clubId,
      userStage: jugaste ? 'la final' : null,
    };
  },

  // Si el mismo club ganó el Apertura y el Clausura no se queda el trofeo de
  // arriba: el rival sale de un partido entre los dos subcampeones, y si esos
  // también son el mismo club, ese pasa directo a la final.
  jugarTrofeoDeCampeones(d1Data) {
    const campeonApertura = d1Data.aperturaChampion;
    const campeonClausura = d1Data.clausuraChampion;
    if (!campeonApertura || !campeonClausura) return null;
    if (campeonApertura !== campeonClausura) {
      return this.finalDeUnPartido('Trofeo de Campeones', campeonApertura, campeonClausura);
    }
    const subApertura = d1Data.aperturaRunnerUp;
    const subClausura = d1Data.clausuraRunnerUp;
    const definicion = this.finalDeUnPartido('Clasificación al Trofeo', subApertura, subClausura);
    const rival = definicion ? definicion.championId : (subApertura || subClausura);
    return this.finalDeUnPartido('Trofeo de Campeones', campeonApertura, rival);
  },

  // La Recopa: los dos campeones del año pasado, ida y vuelta. Se juega antes
  // que las copas nuevas, como en la realidad.
  // Una carrera no empieza con el fútbol recién inventado: cuando arrancás, las
  // copas del año anterior ya se jugaron y sus campeones tienen su cupo en la
  // próxima edición. Sin esto, la primera Libertadores de la carrera entraba
  // con 30 equipos y dos grupos quedaban de a tres. Es la misma idea que
  // sembrarHistorialDePromedios con la tabla de promedios.
  //
  // De paso, el primer año que se juegan las copas también se juega la Recopa
  // entre estos dos, como corresponde.
  sembrarCampeonesVigentes() {
    const pozo = (typeof CLUBES_INTERNACIONALES === 'undefined' ? [] : CLUBES_INTERNACIONALES)
      .filter((c) => c.nivel >= 4);
    if (pozo.length < 2) return [];
    const alAzar = (candidatos) => candidatos[Math.floor(Math.random() * candidatos.length)];
    const deLaLibertadores = alAzar(pozo);
    const deLaSudamericana = alAzar(pozo.filter((c) => c.pais !== deLaLibertadores.pais));
    if (!deLaSudamericana) return [];
    return [
      { copa: 'Libertadores', club: deLaLibertadores },
      { copa: 'Sudamericana', club: deLaSudamericana },
    ].map(({ copa, club }) => ({
      copa,
      championId: club.id,
      championName: club.nombre,
      championPais: club.pais,
      runnerUpName: null,
      userWon: false,
      userStage: null,
    }));
  },

  // El cruce de la Recopa de este año, con los campeones del año pasado. `a`
  // es el campeón de la Libertadores, que juega la vuelta de local; `b` el de
  // la Sudamericana, que abre en su cancha.
  armarRecopa() {
    const campeonDe = (copa) => {
      const r = (this.state.ultimasCopas || [])
        .find((c) => !c.esRecopa && c.copa === copa && c.championId);
      return r ? this.entrantDeClub(r.championId) : null;
    };
    const deLaLibertadores = campeonDe('Libertadores');
    const deLaSudamericana = campeonDe('Sudamericana');
    if (!deLaLibertadores || !deLaSudamericana || deLaLibertadores.id === deLaSudamericana.id) return null;
    return {
      ...this.nuevoCruce(deLaLibertadores.id, deLaSudamericana.id),
      clubes: { [deLaLibertadores.id]: deLaLibertadores, [deLaSudamericana.id]: deLaSudamericana },
    };
  },

  // Un partido de la Recopa. Si no la juega tu club se resuelve solo; si la
  // jugás vos, se abre la pantalla de partido como cualquier otra llave.
  avanzarRecopa(pierna) {
    const s = this.state;
    const rec = s.copasInter.recopa;
    const cuando = {
      etapa: { etapa: 'recopa', nombre: 'Recopa Sudamericana' },
      pierna,
      piernas: (this.calendarioDeCopas().recopa || [0, 1]).length,
    };

    if (rec.a !== s.clubId && rec.b !== s.clubId) {
      this.jugarPartidoDeLlave({ clubes: rec.clubes }, rec, cuando);
      if (pierna === cuando.piernas - 1) this.cerrarRecopa();
      this.seguirEnLaMismaSemana();
      return;
    }

    const soyA = rec.a === s.clubId;
    const rivalId = soyA ? rec.b : rec.a;
    const soyLocal = this.localDelCruce(rec, cuando) === s.clubId;
    s.matchContext = {
      context: 'copa-inter',
      copa: 'Recopa',
      opponentId: rivalId,
      isHome: soyLocal,
      sede: this.estadioDe(soyLocal ? s.clubId : rivalId),
      llave: {
        etapa: 'recopa',
        nombre: cuando.etapa.nombre,
        pierna,
        piernas: cuando.piernas,
        decisiva: pierna === cuando.piernas - 1,
        globalMio: soyA ? rec.gA : rec.gB,
        globalRival: soyA ? rec.gB : rec.gA,
      },
    };
    this.pickDecision();
    s.screen = 'pre-match';
    this.save();
  },

  resolverRecopaDelUsuario() {
    const s = this.state;
    const m = s.pendingMatch;
    const ctx = s.matchContext;
    const rec = s.copasInter.recopa;
    this.anotarPartidoDeLlave(rec, m.home, m.away, m.homeGoals, m.awayGoals);
    if (m.shootout) {
      rec.ganador = m.shootout.userWon ? s.clubId : ctx.opponentId;
      rec.penales = rec.ganador;
    }
    s.log.unshift(`Recopa Sudamericana: ${this.getClub(m.home).name} ${m.homeGoals}-${m.awayGoals} ${this.getClub(m.away).name}${m.shootout ? ' (por penales)' : ''}`);
    if (m.isHome) Economia.cobrarPartidoDeLocal(this, false);
    s.pendingMatch = null;
    s.matchContext = null;
    if (ctx.llave.decisiva) this.cerrarRecopa();
    this.seguirEnLaMismaSemana();
  },

  cerrarRecopa() {
    const rec = this.state.copasInter.recopa;
    if (!rec || rec.ganador) return;
    if (rec.gA > rec.gB) rec.ganador = rec.a;
    else if (rec.gB > rec.gA) rec.ganador = rec.b;
    else {
      rec.ganador = this.copaTieWinner(rec.a, rec.b, rec.clubes);
      rec.penales = rec.ganador;
    }
    this.state.log.unshift(`Recopa Sudamericana: la ganó ${rec.clubes[rec.ganador].nombre}.`);
  },

  // El resumen de la Recopa para la partida. Lo normal es que se haya jugado
  // durante el año; el camino de abajo queda para una partida que llegue a fin
  // de año sin tenerla armada.
  simularRecopa() {
    const jugada = this.state.copasInter && this.state.copasInter.recopa;
    if (jugada) {
      if (!jugada.ganador) this.cerrarRecopa();
      const perdedor = jugada.ganador === jugada.a ? jugada.b : jugada.a;
      const jugaste = jugada.a === this.state.clubId || jugada.b === this.state.clubId;
      return {
        copa: 'Recopa Sudamericana',
        esRecopa: true,
        nombrePropio: true,
        articulo: 'la',
        championId: jugada.ganador,
        championName: jugada.clubes[jugada.ganador].nombre,
        championPais: jugada.clubes[jugada.ganador].pais,
        runnerUpName: jugada.clubes[perdedor].nombre,
        userWon: jugada.ganador === this.state.clubId,
        userStage: jugaste ? 'la final' : null,
      };
    }
    return this.simularRecopaDeUnaVez();
  },

  simularRecopaDeUnaVez() {
    const ultimas = (this.state && this.state.ultimasCopas) || [];
    const campeonDe = (copa) => {
      const r = ultimas.find((c) => c.copa === copa && c.championId);
      return r ? this.entrantDeClub(r.championId) : null;
    };
    const deLaLibertadores = campeonDe('Libertadores');
    const deLaSudamericana = campeonDe('Sudamericana');
    if (!deLaLibertadores || !deLaSudamericana || deLaLibertadores.id === deLaSudamericana.id) return null;

    const byId = { [deLaLibertadores.id]: deLaLibertadores, [deLaSudamericana.id]: deLaSudamericana };
    const ganador = this.copaTieWinner(deLaLibertadores.id, deLaSudamericana.id, byId);
    const perdedor = ganador === deLaLibertadores.id ? deLaSudamericana.id : deLaLibertadores.id;
    const jugaste = ganador === this.state.clubId || perdedor === this.state.clubId;
    return {
      copa: 'Recopa Sudamericana',
      esRecopa: true,
      nombrePropio: true,
      articulo: 'la',
      championId: ganador,
      championName: byId[ganador].nombre,
      championPais: byId[ganador].pais,
      runnerUpName: byId[perdedor].nombre,
      userWon: ganador === this.state.clubId,
      userStage: jugaste ? 'la final' : null,
    };
  },

  // La fase de grupos resuelta de una, sin pasar por el calendario. Es el
  // camino viejo: hoy solo lo usa una partida que todavía no tiene copas
  // armadas para el año en curso.
  simularFaseDeGrupos(copa, qualification, internacionales, deLaOtra) {
    const entrants = this.copaEntrants(copa, qualification, internacionales)
      .concat(deLaOtra.aGrupos || [], deLaOtra.alPlayoff || []);
    if (entrants.length < 4) return null;
    const byId = Object.fromEntries(entrants.map((e) => [e.id, e]));
    // Hasta dónde llegó cada club: se pisa en cada instancia que juega, así
    // que al final queda la más lejana.
    const reached = {};
    const mark = (ids, etapa) => ids.forEach((id) => { if (id) reached[id] = etapa; });

    const previa = this.shuffled(entrants.filter((e) => e.fase === 'previa').map((e) => e.id));
    mark(previa, 'la fase previa');
    const resultadoPrevia = this.jugarFasesPrevias(copa, previa, byId);
    const enGrupos = entrants.filter((e) => e.fase === 'grupos').map((e) => e.id)
      .concat(resultadoPrevia.pasan);

    mark(enGrupos, 'la fase de grupos');
    const grupos = this.sortearGruposDeCopa(enGrupos, byId);

    const primeros = [];
    const segundos = [];
    const terceros = [];
    let victoriasDelUsuario = 0;
    grupos.forEach((grupo) => {
      grupo.fixture.forEach((fecha) => {
        fecha.forEach((p) => {
          const score = this.simulateScore(this.copaStrength(byId[p.local]), this.copaStrength(byId[p.visitante]), 4);
          this.anotarEnGrupo(grupo, p.local, p.visitante, score.homeGoals, score.awayGoals);
          if (p.local === this.state.clubId && score.homeGoals > score.awayGoals) victoriasDelUsuario++;
          if (p.visitante === this.state.clubId && score.awayGoals > score.homeGoals) victoriasDelUsuario++;
        });
      });
      const orden = this.posicionesDeGrupo(grupo);
      if (orden[0]) primeros.push(orden[0]);
      if (orden[1]) segundos.push(orden[1]);
      if (orden[2]) terceros.push(orden[2]);
    });

    return {
      byId,
      reached,
      primeros,
      segundos,
      terceros,
      victoriasDelUsuario,
      camino: resultadoPrevia.camino,
      eliminadosPrevia: resultadoPrevia.eliminados,
    };
  },

  // Una copa internacional, de la fase de grupos en adelante.
  //
  // La fase de grupos puede llegar acá de dos maneras: si la temporada la fue
  // jugando fecha a fecha (que es lo normal desde que las copas son jugables,
  // ver armarCopasInternacionales) se leen esas tablas tal como quedaron; si
  // no hay copa en curso, se simula entera de una. De octavos en adelante el
  // camino es el mismo para las dos.
  simulateCopa(copa, qualification, internacionales, desdeLaOtraCopa) {
    const deLaOtra = desdeLaOtraCopa || {};
    const alPlayoff = deLaOtra.alPlayoff || [];
    const enCurso = this.copaEnCurso(copa);
    // Lo normal: la copa se jugó durante el año y ya tiene campeón.
    if (enCurso && enCurso.llave) return this.resumenDeCopaJugada(enCurso);
    const fase = enCurso
      ? this.cerrarFaseDeGrupos(enCurso)
      : this.simularFaseDeGrupos(copa, qualification, internacionales, deLaOtra);
    if (!fase) return null;

    const { byId, reached, primeros, segundos, terceros } = fase;
    // Los terceros de la Libertadores llegan a la Sudamericana recién en el
    // playoff, así que no están en ninguno de sus grupos: hay que sumarlos al
    // padrón para poder jugarles la llave.
    alPlayoff.forEach((e) => { byId[e.id] = e; });
    const mark = (ids, etapa) => ids.forEach((id) => { if (id) reached[id] = etapa; });
    // De mejor a peor campaña, que es como CONMEBOL numera a los que
    // terminaron en la misma posición de sus grupos.
    const porCampania = (filas) => filas.slice()
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);

    // En la Sudamericana el primero de cada grupo se mete derecho en octavos y
    // el segundo tiene que ganar el playoff contra un tercero de la
    // Libertadores. En la Libertadores no hay playoff: pasan los dos.
    //
    // Los cruces del playoff NO se sortean: están armados por campaña. Los
    // segundos de la Sudamericana se numeran del 9º al 16º y los terceros de
    // la Libertadores del 17º al 24º, y se cruzan 9º vs 24º, 10º vs 23º, y así
    // hasta 16º vs 17º. O sea que al que mejor le fue le toca el rival más
    // flojo.
    let clasificados;
    if (alPlayoff.length) {
      const deLaSuda = porCampania(segundos).map((r) => r.id);
      const deLaLibertadores = alPlayoff.map((e) => e.id);
      mark(deLaSuda.concat(deLaLibertadores), 'el playoff de octavos');
      const ganadores = [];
      const cruces = Math.max(deLaSuda.length, deLaLibertadores.length);
      for (let i = 0; i < cruces; i++) {
        const rival = deLaLibertadores[deLaLibertadores.length - 1 - i];
        ganadores.push(this.copaTieWinner(deLaSuda[i], rival, byId));
      }
      clasificados = primeros.map((r) => r.id).concat(ganadores.filter(Boolean));
    } else {
      clasificados = primeros.concat(segundos).map((r) => r.id);
    }

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
    const userStage = reached[this.state.clubId] || null;
    return {
      copa,
      championId: champion,
      championName: champion ? byId[champion].nombre : null,
      championPais: champion ? byId[champion].pais : null,
      runnerUpName: runnerUp && byId[runnerUp] ? byId[runnerUp].nombre : null,
      userWon: champion === this.state.clubId,
      userStage,
      // Lo que hace falta para cobrar más allá de hasta dónde llegó: cada
      // partido ganado en la fase de grupos se paga aparte, y la previa
      // depende de qué fases jugó y de si le tocó de local.
      userExtras: {
        victoriasEnGrupos: fase.victoriasDelUsuario,
        previa: fase.camino && fase.camino.fases.length ? fase.camino : null,
      },
      // Los que se van de esta copa pero siguen en la otra (ver
      // simulateCopasDelAnio). Solo los usa la Libertadores para alimentar a
      // la Sudamericana; no quedan guardados en la partida.
      //
      // Los terceros van ordenados de mejor a peor campaña (el 17º primero y
      // el 24º último), porque así es como se arman los cruces del playoff.
      bajanAGrupos: fase.eliminadosPrevia.map((id) => ({ ...byId[id], fase: 'grupos' })),
      bajanAlPlayoff: porCampania(terceros).map((r) => ({ ...byId[r.id], fase: 'playoff' })),
    };
  },

  // ---------- Copas internacionales: armado y fase de grupos en vivo ----------

  // La copa que se está jugando este año, si es que hay una. Devuelve null
  // cuando la temporada no tiene copas armadas (la primera de una carrera,
  // que todavía no tiene clasificados de nadie).
  copaEnCurso(copa) {
    const ci = this.state.copasInter;
    return (ci && ci.copas && ci.copas[copa]) || null;
  },

  // Arma las dos copas del año enteras al empezar la temporada: sortea los
  // cupos del continente, resuelve las fases previas —que en la realidad se
  // juegan en enero y febrero, antes de que arranque el torneo local— y
  // sortea los 8 grupos de cada copa con su fixture de 6 fechas.
  //
  // Las dos se arman de una sola vez y con UN solo sorteo de cupos, porque la
  // Libertadores le da de comer a la Sudamericana: los que pierden su última
  // fase previa caen a los grupos de la otra copa.
  //
  // A partir de acá la fase de grupos se juega fecha a fecha durante el año
  // (ver FECHAS_DE_COPAS). Lo que va de octavos en adelante se sigue
  // resolviendo al cierre de la temporada, pero ya partiendo de estas tablas.
  armarCopasInternacionales() {
    const s = this.state;
    s.copasInter = null;
    const qualification = s.copaQualification;
    // La primera temporada de una carrera no tiene clasificados de nadie: esos
    // salen recién al cerrar un año. En vez de quedarse sin copas, se siembra
    // con la edición real (ver SIEMBRA_PRIMERA_TEMPORADA en internacional.js).
    if (!qualification || !qualification.length) {
      this.sembrarCopasDeLaPrimeraTemporada();
      return;
    }

    // El primer año que se juegan las copas todavía no hay campeones del año
    // anterior, porque esa edición nunca existió en la partida. Se siembran
    // dos: una carrera no arranca con el continente en blanco.
    const hayVigentes = (s.ultimasCopas || [])
      .some((c) => !c.esRecopa && (c.copa === 'Libertadores' || c.copa === 'Sudamericana'));
    if (!hayVigentes) s.ultimasCopas = (s.ultimasCopas || []).concat(this.sembrarCampeonesVigentes());

    const internacionales = this.sortearCuposInternacionales();
    // Nadie puede jugar las dos copas el mismo año, ni siquiera cuando hay que
    // completar cupos: acá está todo lo que ya tiene dueño.
    const ocupados = new Set(qualification.map((q) => q.clubId)
      .concat(internacionales.map((c) => c.id)));
    const campeones = this.campeonesVigentes(qualification, internacionales);
    campeones.forEach((c) => ocupados.add(c.id));
    const libertadores = this.armarCopa('Libertadores', qualification, internacionales, {
      aGrupos: campeones,
      // Si sobrara un cupo, el que se va es un campeón vigente: nunca uno que
      // se ganó el lugar en la cancha.
      prescindibles: campeones.map((c) => c.id),
      ocupados,
    });
    const sudamericana = this.armarCopa('Sudamericana', qualification, internacionales, {
      aGrupos: libertadores ? libertadores.bajanAGrupos : [],
      ocupados,
    });
    if (!libertadores && !sudamericana) return;

    // `bajanAGrupos` era solo para armar la otra copa: no se guarda.
    const limpia = (copa) => {
      if (!copa) return null;
      const { bajanAGrupos, ...resto } = copa;
      return resto;
    };
    s.copasInter = {
      year: s.season.year,
      fecha: 0,
      copas: { Libertadores: limpia(libertadores), Sudamericana: limpia(sudamericana) },
      recopa: this.armarRecopa(),
    };
  },

  // Arma las dos copas de la temporada 1 con los grupos reales cargados a
  // mano, sin sorteo y sin fases previas: el sorteo ya está hecho en la vida
  // real y las previas de ese año ya se jugaron.
  //
  // Los grupos arrancan en cero, igual que los de cualquier otro año: lo único
  // sembrado es QUIÉN juega contra quién, no lo que pasó.
  //
  // Si algo de la siembra no cierra —un id que no existe, un grupo con menos
  // de dos equipos— se descarta entera y la temporada 1 queda sin copas, como
  // antes de que esto existiera. Media copa sembrada sería peor que ninguna.
  sembrarCopasDeLaPrimeraTemporada() {
    const s = this.state;
    const siembra = typeof SIEMBRA_PRIMERA_TEMPORADA === 'undefined' ? null : SIEMBRA_PRIMERA_TEMPORADA;
    if (!siembra || !siembra.grupos) return;

    const armada = {};
    for (const copa of ['Libertadores', 'Sudamericana']) {
      const porLetra = siembra.grupos[copa];
      if (!porLetra) return;
      const clubes = {};
      const grupos = [];
      for (const [letra, ids] of Object.entries(porLetra)) {
        if (!ids || ids.length < 2) return;
        for (const id of ids) {
          const entrant = this.entrantDeClub(id);
          if (!entrant) return;
          clubes[id] = entrant;
        }
        grupos.push({
          letra,
          ids: ids.slice(),
          tabla: Object.fromEntries(ids.map((id) => [id, this.emptyTableRow()])),
          partidos: [],
          fixture: this.fixtureDeGrupo(ids),
        });
      }
      // Ningún club puede estar en las dos copas el mismo año.
      if (armada.Libertadores && Object.keys(clubes).some((id) => armada.Libertadores.clubes[id])) return;
      armada[copa] = {
        copa,
        clubes,
        previa: { jugaron: [], camino: { fases: [], deLocal: false }, eliminados: [] },
        grupos,
      };
    }

    // Los campeones del año pasado: los de verdad, no los sorteados de
    // sembrarCampeonesVigentes(). Con estos dos se juega la Recopa de febrero,
    // que es el primer partido de copa de la carrera.
    const vigentes = siembra.campeonesVigentes || {};
    s.ultimasCopas = (s.ultimasCopas || []).concat(
      ['Libertadores', 'Sudamericana'].map((copa) => {
        const club = this.entrantDeClub(vigentes[copa]);
        return club && {
          copa,
          championId: club.id,
          championName: club.nombre,
          championPais: club.pais,
          runnerUpName: null,
          userWon: false,
          userStage: null,
        };
      }).filter(Boolean),
    );

    s.copasInter = {
      year: s.season.year,
      fecha: 0,
      copas: { Libertadores: armada.Libertadores, Sudamericana: armada.Sudamericana },
      recopa: this.armarRecopa(),
    };
  },

  armarCopa(copa, qualification, internacionales, desdeLaOtraCopa) {
    const deLaOtra = desdeLaOtraCopa || {};
    const entrants = this.copaEntrants(copa, qualification, internacionales)
      .concat(deLaOtra.aGrupos || []);
    if (entrants.length < 8) return null;
    const clubes = Object.fromEntries(entrants.map((e) => [
      e.id, { id: e.id, nombre: e.nombre, pais: e.pais, nivel: e.nivel },
    ]));

    const previa = this.shuffled(entrants.filter((e) => e.fase === 'previa').map((e) => e.id));
    const resultadoPrevia = this.jugarFasesPrevias(copa, previa, clubes);
    const enGrupos = this.completarCuposDeGrupos(
      copa,
      entrants.filter((e) => e.fase === 'grupos').map((e) => e.id).concat(resultadoPrevia.pasan),
      clubes,
      deLaOtra,
    );

    return {
      copa,
      clubes,
      previa: {
        jugaron: previa,
        camino: resultadoPrevia.camino,
        eliminados: resultadoPrevia.eliminados,
      },
      grupos: this.sortearGruposDeCopa(enGrupos, clubes),
      bajanAGrupos: resultadoPrevia.eliminados.map((id) => ({ ...clubes[id], fase: 'grupos' })),
    };
  },

  // Las dos copas arrancan la fase de grupos con 32 equipos, siempre: 8 grupos
  // de 4, ni uno más ni uno menos. Los cupos de cada país, los de la fase
  // previa y los de campeón vigente están puestos para que la cuenta dé justo,
  // pero puede haber años raros —un campeón que se quedó sin país donde buscar
  // suplente, una previa que devolvió de más— y un grupo de tres no existe en
  // ninguna de las dos copas. Así que la cuenta se cierra acá, antes del
  // sorteo.
  //
  // Si sobra alguno, el que se va es un campeón vigente (el cupo más blando de
  // los tres), empezando por el de menor nivel. Nunca sale uno que se ganó el
  // lugar en la cancha.
  //
  // Si falta, entran por orden de mérito: primero los argentinos que quedaron
  // próximos en la Tabla Anual del año pasado —así un argentino nunca entra de
  // prepo, entra por cómo salió en el torneo— y después el mejor club del
  // continente que se haya quedado afuera, empezando por los países con menos
  // representantes para no amontonar cinco brasileños.
  completarCuposDeGrupos(copa, enGrupos, clubes, deLaOtra) {
    const objetivo = (typeof CUPOS_EN_GRUPOS === 'undefined' ? {} : CUPOS_EN_GRUPOS)[copa];
    if (!objetivo) return enGrupos;
    const lista = enGrupos.slice();
    const dentro = new Set(lista);
    const ocupados = (deLaOtra && deLaOtra.ocupados) || new Set();
    const sumar = (entrant) => {
      clubes[entrant.id] = {
        id: entrant.id, nombre: entrant.nombre, pais: entrant.pais, nivel: entrant.nivel,
      };
      lista.push(entrant.id);
      dentro.add(entrant.id);
      ocupados.add(entrant.id);
    };

    const sobrantes = ((deLaOtra && deLaOtra.prescindibles) || [])
      .filter((id) => dentro.has(id))
      .sort((a, b) => clubes[a].nivel - clubes[b].nivel);
    while (lista.length > objetivo && sobrantes.length) {
      const fuera = sobrantes.shift();
      lista.splice(lista.indexOf(fuera), 1);
      dentro.delete(fuera);
    }

    const espera = (this.state.copaEspera || []).filter((id) => !dentro.has(id) && !ocupados.has(id));
    while (lista.length < objetivo && espera.length) {
      const suplente = this.entrantDeClub(espera.shift());
      if (suplente) sumar(suplente);
    }

    while (lista.length < objetivo) {
      const porPais = {};
      lista.forEach((id) => { porPais[clubes[id].pais] = (porPais[clubes[id].pais] || 0) + 1; });
      const candidato = (typeof CLUBES_INTERNACIONALES === 'undefined' ? [] : CLUBES_INTERNACIONALES)
        .filter((c) => !dentro.has(c.id) && !ocupados.has(c.id))
        .sort((a, b) => (porPais[a.pais] || 0) - (porPais[b.pais] || 0) || b.nivel - a.nivel)[0];
      if (!candidato) break;
      sumar(candidato);
    }
    return lista;
  },

  // El sorteo de los 8 grupos, con las dos reglas del sorteo de verdad:
  //
  //   - Bombos. Los equipos se ordenan por nivel y se parten en cuatro bombos
  //     de ocho. De cada bombo sale uno por grupo, así que ningún grupo junta
  //     a los cuatro mejores del continente ni a los cuatro más flojos.
  //   - No puede haber dos del mismo país en un mismo grupo. Vale para todos:
  //     Brasil y Argentina incluidos.
  //
  // La restricción de país se resuelve con backtracking, bombo por bombo: se
  // prueba a quién mandar a cada grupo y se vuelve atrás si el reparto se
  // traba. Si por los cupos de ese año no hubiera forma de repartir un bombo
  // sin repetir país (con los cupos reales no pasa, pero más vale no colgar
  // el juego), ese bombo se reparte sin la restricción.
  sortearGruposDeCopa(ids, clubes) {
    const cantGrupos = Math.max(1, Math.min(GRUPOS_POR_COPA, Math.floor(ids.length / 2)));
    const grupos = Array.from({ length: cantGrupos }, (_, i) => ({
      letra: LETRAS_DE_GRUPO[i] || String(i + 1),
      ids: [],
      tabla: {},
      partidos: [],
      fixture: [],
    }));
    const ordenados = ids.slice().sort((a, b) => clubes[b].nivel - clubes[a].nivel);

    for (let desde = 0; desde < ordenados.length; desde += cantGrupos) {
      const bombo = this.shuffled(ordenados.slice(desde, desde + cantGrupos));
      // El último bombo puede venir incompleto si ese año entraron menos
      // equipos de los que esperan los ocho grupos: los que haya van a grupos
      // sorteados, no siempre a los primeros.
      const destinos = this.shuffled(grupos.map((_, i) => i)).slice(0, bombo.length);
      const usados = new Set();
      const repartir = (k, conRestriccion) => {
        if (k >= destinos.length) return true;
        const grupo = grupos[destinos[k]];
        const candidatos = bombo.filter((id) => !usados.has(id)
          && (!conRestriccion || !grupo.ids.some((otro) => clubes[otro].pais === clubes[id].pais)));
        for (const id of candidatos) {
          usados.add(id);
          grupo.ids.push(id);
          if (repartir(k + 1, conRestriccion)) return true;
          usados.delete(id);
          grupo.ids.pop();
        }
        return false;
      };
      if (!repartir(0, true)) repartir(0, false);
    }

    grupos.forEach((grupo) => {
      grupo.tabla = Object.fromEntries(grupo.ids.map((id) => [id, this.emptyTableRow()]));
      grupo.fixture = this.fixtureDeGrupo(grupo.ids);
    });
    return grupos;
  },

  // Las 6 fechas de un grupo: la rueda de ida y la de vuelta. Cada equipo
  // termina con 3 de local y 3 de visitante, pero el orden importa: si se
  // juega la ida entera y después la vuelta entera, a alguno le tocan los
  // tres de local seguidos y después los tres de visitante, que no es como se
  // juega una copa.
  //
  // Así que se prueban todos los órdenes posibles de la ida y de la vuelta y
  // se elige el que mejor reparte la localía: nadie con más de dos partidos
  // seguidos del mismo lado, y siempre al menos dos fechas entre un partido y
  // su revancha. Son tres rondas, así que probarlas todas sale gratis.
  fixtureDeGrupo(ids) {
    const rondas = this.buildSchedule(ids);
    const invertida = (ronda) => ronda.map((m) => ({ home: m.away, away: m.home }));
    const ordenes = this.permutaciones(rondas.map((_, i) => i));
    // Cada cruce se juega dos veces, una de cada lado, así que dar vuelta la
    // ida de cualquiera de ellos siempre es legal: lo único que cambia es cuál
    // de las dos fechas es la de local. Con grupos de 3 o 4 son 8 o 64
    // combinaciones, así que se prueban todas.
    const partidos = rondas.reduce((total, ronda) => total + ronda.length, 0);
    const vueltas = partidos <= 12
      ? this.shuffled(Array.from({ length: 1 << partidos }, (_, m) => m))
      : [0];
    let mejor = null;
    for (const mask of vueltas) {
      let n = 0;
      const base = rondas.map((ronda) => ronda.map((m) => (((mask >> n++) & 1)
        ? { home: m.away, away: m.home }
        : m)));
      for (const ida of ordenes) {
        for (const vuelta of ordenes) {
          // La revancha no puede caer pegada a la ida: entre un partido y el
          // de vuelta contra el mismo rival tienen que pasar al menos dos
          // fechas, como en las copas de verdad.
          const separacion = Math.min(...ida.map((r, k) => rondas.length + vuelta.indexOf(r) - k));
          if (separacion < 2) continue;
          const fechas = ida.map((i) => base[i]).concat(vuelta.map((i) => invertida(base[i])));
          const peor = this.peorRachaDeLocalia(ids, fechas);
          if (!mejor || peor < mejor.peor) mejor = { fechas, peor };
        }
      }
      // Dos partidos seguidos del mismo lado es lo mejor a lo que se puede
      // llegar en un grupo de cuatro: cuando aparece, no hace falta seguir.
      if (mejor && mejor.peor <= 2) break;
    }
    const fechas = mejor ? mejor.fechas : rondas.concat(rondas.map(invertida));
    return fechas.map((ronda) => ronda.map((m) => ({ local: m.home, visitante: m.away })));
  },

  permutaciones(arr) {
    if (arr.length <= 1) return [arr];
    return arr.flatMap((x, i) => this
      .permutaciones(arr.slice(0, i).concat(arr.slice(i + 1)))
      .map((resto) => [x].concat(resto)));
  },

  // La racha más larga de partidos seguidos del mismo lado (todos de local o
  // todos de visitante) que le toca al equipo peor parado del grupo. Cuanto
  // más chica, mejor repartido está el fixture.
  peorRachaDeLocalia(ids, fechas) {
    return Math.max(...ids.map((id) => {
      let racha = 0;
      let peor = 0;
      let anterior = null;
      fechas.forEach((ronda) => {
        const m = ronda.find((x) => x.home === id || x.away === id);
        if (!m) return;
        const lado = m.home === id ? 'L' : 'V';
        racha = lado === anterior ? racha + 1 : 1;
        anterior = lado;
        peor = Math.max(peor, racha);
      });
      return peor;
    }));
  },

  anotarEnGrupo(grupo, local, visitante, golesLocal, golesVisitante) {
    this.updateTableRow(grupo.tabla, local, golesLocal, golesVisitante);
    this.updateTableRow(grupo.tabla, visitante, golesVisitante, golesLocal);
    grupo.partidos.push({ local, visitante, golesLocal, golesVisitante });
  },

  // Las posiciones de un grupo, con los desempates de CONMEBOL (ver
  // ordenarGrupo). Es lo que usan tanto la tabla que se ve en el panel como
  // el cierre de la fase.
  posicionesDeGrupo(grupo) {
    return this.ordenarGrupo(
      Object.entries(grupo.tabla).map(([id, row]) => ({ id, ...row })),
      grupo.partidos,
    );
  },

  // Cierra la fase de grupos de una copa que se jugó fecha a fecha y la deja
  // en la misma forma que devuelve simularFaseDeGrupos, para que de octavos
  // en adelante sea todo el mismo código.
  cerrarFaseDeGrupos(enCurso) {
    const byId = {};
    Object.entries(enCurso.clubes).forEach(([id, c]) => { byId[id] = { ...c }; });
    const reached = {};
    const mark = (ids, etapa) => ids.forEach((id) => { if (id) reached[id] = etapa; });
    mark(enCurso.previa.jugaron || [], 'la fase previa');

    const primeros = [];
    const segundos = [];
    const terceros = [];
    let victoriasDelUsuario = 0;
    enCurso.grupos.forEach((grupo) => {
      mark(grupo.ids, 'la fase de grupos');
      grupo.partidos.forEach((p) => {
        if (p.local === this.state.clubId && p.golesLocal > p.golesVisitante) victoriasDelUsuario++;
        if (p.visitante === this.state.clubId && p.golesVisitante > p.golesLocal) victoriasDelUsuario++;
      });
      const orden = this.posicionesDeGrupo(grupo);
      if (orden[0]) primeros.push(orden[0]);
      if (orden[1]) segundos.push(orden[1]);
      if (orden[2]) terceros.push(orden[2]);
    });

    return {
      byId,
      reached,
      primeros,
      segundos,
      terceros,
      victoriasDelUsuario,
      camino: enCurso.previa.camino,
      eliminadosPrevia: enCurso.previa.eliminados || [],
    };
  },

  // ¿El usuario juega esta fecha de grupos? Puede estar en una sola de las dos
  // copas, así que apenas aparece el partido se devuelve.
  partidoDeCopaDelUsuario(fecha) {
    const s = this.state;
    const ci = s.copasInter;
    if (!ci) return null;
    const copas = Object.values(ci.copas).filter(Boolean);
    for (const copa of copas) {
      for (const grupo of copa.grupos) {
        const partido = (grupo.fixture[fecha] || [])
          .find((p) => p.local === s.clubId || p.visitante === s.clubId);
        if (partido) return { copa: copa.copa, grupo, partido };
      }
    }
    return null;
  },

  // Simula de una todos los partidos de una fecha de grupos, en las dos copas.
  // `excepto` es el partido que jugó el usuario, que ya quedó anotado.
  simularFechaDeCopas(fecha, excepto) {
    const ci = this.state.copasInter;
    if (!ci) return;
    Object.values(ci.copas).filter(Boolean).forEach((copa) => {
      copa.grupos.forEach((grupo) => {
        (grupo.fixture[fecha] || []).forEach((p) => {
          if (excepto && p.local === excepto.home && p.visitante === excepto.away) return;
          const score = this.simulateScore(
            this.copaStrength(copa.clubes[p.local]),
            this.copaStrength(copa.clubes[p.visitante]),
            4,
          );
          this.anotarEnGrupo(grupo, p.local, p.visitante, score.homeGoals, score.awayGoals);
        });
      });
    });
  },

  // Un checkpoint de copa internacional: se juega la fecha de grupos que toca.
  // Si el usuario no está en ninguna de las dos copas (o está en la Nacional),
  // la fecha se resuelve sola y el año sigue; si juega, se abre la pantalla de
  // partido y el resto de la fecha se simula cuando termine el suyo.
  avanzarFechaDeCopas() {
    const s = this.state;
    const ci = s.copasInter;
    const mio = this.partidoDeCopaDelUsuario(ci.fecha);

    if (!mio) {
      this.simularFechaDeCopas(ci.fecha, null);
      ci.fecha++;
      if (ci.fecha >= FECHAS_DE_GRUPOS) this.cerrarLasDosFasesDeGrupos();
      this.seguirEnLaMismaSemana();
      return;
    }

    const isHome = mio.partido.local === s.clubId;
    const rivalId = isHome ? mio.partido.visitante : mio.partido.local;
    s.matchContext = {
      context: 'copa-inter',
      copa: mio.copa,
      grupo: mio.grupo.letra,
      fechaDeGrupos: ci.fecha + 1,
      opponentId: rivalId,
      isHome,
      sede: this.estadioDe(isHome ? s.clubId : rivalId),
    };
    this.pickDecision();
    s.screen = 'pre-match';
    this.save();
  },

  // ---------- Copas internacionales: de octavos a la final ----------

  // Las instancias que juega cada copa. La Libertadores entra derecho a
  // octavos con los dos primeros de cada grupo; la Sudamericana tiene antes el
  // playoff, donde los ocho segundos se cruzan con los ocho terceros de la
  // Libertadores.
  etapasDeLaCopa(copa) {
    return COPA_INTER_LLAVES.filter((e) => !e.soloSudamericana || copa === 'Sudamericana');
  },

  // Qué partido de llave toca en esta fecha del torneo local, si toca alguno.
  // En Primera las llaves van en el Clausura; en la Nacional, que tiene un
  // solo torneo, en su segunda mitad.
  llaveQueTocaEstaFecha() {
    const llaves = this.calendarioDeCopas().llaves;
    if (!llaves) return null;
    for (const etapa of COPA_INTER_LLAVES) {
      const rondas = llaves[etapa.etapa] || [];
      const pierna = rondas.indexOf(this.state.season.roundIndex);
      if (pierna >= 0) return { etapa, pierna, piernas: rondas.length };
    }
    return null;
  },

  // Cierra la fase de grupos de las dos copas y arma con eso la primera
  // instancia de cada llave. Se llama apenas se juega la sexta fecha.
  cerrarLasDosFasesDeGrupos() {
    const ci = this.state.copasInter;
    if (!ci || ci.gruposCerrados) return;
    ci.gruposCerrados = true;

    const libertadores = ci.copas.Libertadores;
    const sudamericana = ci.copas.Sudamericana;
    const cierre = {};
    [libertadores, sudamericana].filter(Boolean).forEach((copa) => {
      cierre[copa.copa] = this.cerrarFaseDeGrupos(copa);
    });

    // Los terceros de la Libertadores no quedan eliminados: se van al playoff
    // de la Sudamericana, numerados de mejor a peor campaña.
    const porCampania = (filas) => filas.slice()
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    const terceros = libertadores ? porCampania(cierre.Libertadores.terceros) : [];

    if (libertadores) this.armarLlaveInicial(libertadores, cierre.Libertadores, []);
    if (sudamericana) this.armarLlaveInicial(sudamericana, cierre.Sudamericana, terceros, libertadores);
    this.save();
  },

  // La primera instancia de una copa. En la Libertadores son los octavos
  // directo; en la Sudamericana, el playoff, y los primeros de grupo esperan
  // en octavos.
  armarLlaveInicial(copa, cierre, tercerosDeLaOtra, laOtraCopa) {
    const porCampania = (filas) => filas.slice()
      .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    const grupoDe = {};
    copa.grupos.forEach((g) => g.ids.forEach((id) => { grupoDe[id] = g.letra; }));

    const llave = {
      etapa: null,
      cruces: [],
      seeds: {},
      grupoDe,
      alcanzado: { ...cierre.reached },
      campeon: null,
      subcampeon: null,
    };
    copa.llave = llave;

    const primeros = porCampania(cierre.primeros).map((r) => r.id);
    const segundos = porCampania(cierre.segundos).map((r) => r.id);

    if (copa.copa === 'Sudamericana' && tercerosDeLaOtra.length) {
      // Los terceros de la Libertadores llegan de la otra copa, así que hay
      // que meterlos en el padrón de esta antes de poder jugarles.
      tercerosDeLaOtra.forEach((fila) => {
        const club = (laOtraCopa && laOtraCopa.clubes[fila.id]) || this.entrantDeClub(fila.id);
        if (club) copa.clubes[fila.id] = { ...club };
      });
      // Los cruces del playoff no se sortean: van por campaña. Los segundos de
      // la Sudamericana son del 9º al 16º y los terceros de la Libertadores del
      // 17º al 24º, y se cruzan 9º-24º, 10º-23º, y así hasta 16º-17º. Al que
      // mejor le fue le toca el rival más flojo.
      const deAfuera = tercerosDeLaOtra.map((r) => r.id);
      llave.esperanEnOctavos = primeros;
      llave.cruces = segundos.map((id, i) => this.nuevoCruce(id, deAfuera[deAfuera.length - 1 - i]))
        .filter((c) => c.a && c.b);
      segundos.forEach((id, i) => { llave.seeds[id] = 9 + i; });
      deAfuera.forEach((id, i) => { llave.seeds[id] = 17 + i; });
      primeros.forEach((id, i) => { llave.seeds[id] = 1 + i; });
      this.empezarEtapaDeLlave(copa, 'playoff');
      return;
    }

    primeros.forEach((id, i) => { llave.seeds[id] = 1 + i; });
    segundos.forEach((id, i) => { llave.seeds[id] = 9 + i; });
    llave.cruces = this.sortearOctavos(primeros, segundos, grupoDe);
    this.empezarEtapaDeLlave(copa, 'octavos');
  },

  nuevoCruce(a, b) {
    return { a, b, gA: 0, gB: 0, partidos: [], penales: null, ganador: null };
  },

  // El sorteo de los octavos: cada primero de grupo contra un segundo, y nunca
  // contra uno de su propio grupo. El primero es el mejor sembrado del cruce,
  // así que define la llave de local en la vuelta.
  //
  // Los cruces salen ordenados al azar en el cuadro, y de ahí en adelante el
  // cuadro es fijo: los ganadores de los cruces 1 y 2 se enfrentan en cuartos,
  // los de 3 y 4, y así. Es lo que pasa de verdad: se sortean los octavos y
  // después ya está todo definido hasta la final.
  sortearOctavos(cabezas, resto, grupoDe) {
    const usados = new Set();
    const cruces = [];
    const repartir = (k, conRestriccion) => {
      if (k >= cabezas.length) return true;
      const candidatos = this.shuffled(resto.filter((id) => !usados.has(id)
        && (!conRestriccion || !grupoDe || grupoDe[id] !== grupoDe[cabezas[k]])));
      for (const id of candidatos) {
        usados.add(id);
        cruces[k] = this.nuevoCruce(cabezas[k], id);
        if (repartir(k + 1, conRestriccion)) return true;
        usados.delete(id);
      }
      return false;
    };
    if (!repartir(0, true)) repartir(0, false);
    return this.shuffled(cruces.filter(Boolean));
  },

  // Deja la copa parada en una instancia y anota que todos los que la juegan
  // llegaron hasta ahí (es lo que después define hasta dónde llegaste vos y
  // cuánto se cobra).
  empezarEtapaDeLlave(copa, etapa) {
    const llave = copa.llave;
    llave.etapa = etapa;
    const definicion = COPA_INTER_LLAVES.find((e) => e.etapa === etapa);
    llave.cruces.forEach((cruce) => {
      llave.alcanzado[cruce.a] = definicion.alcanzado;
      llave.alcanzado[cruce.b] = definicion.alcanzado;
    });
  },

  // El cruce del usuario en la instancia que se juega ahora, si está vivo.
  cruceDelUsuario(cuando) {
    const s = this.state;
    const ci = s.copasInter;
    if (!ci) return null;
    for (const copa of Object.values(ci.copas).filter(Boolean)) {
      const llave = copa.llave;
      if (!llave || llave.campeon || llave.etapa !== cuando.etapa.etapa) continue;
      const cruce = llave.cruces.find((c) => !c.ganador && (c.a === s.clubId || c.b === s.clubId));
      if (cruce) return { copa, cruce };
    }
    return null;
  },

  // Quién juega de local en este partido del cruce. En la ida es el peor
  // sembrado y en la vuelta el mejor (por eso el que ganó su grupo define en
  // casa); en la final no hay local, se juega en cancha neutral.
  localDelCruce(cruce, cuando) {
    if (cuando.etapa.neutral) return null;
    return cuando.pierna === 0 ? cruce.b : cruce.a;
  },

  sedeDeFinalContinental() {
    const sedes = typeof SEDES_FINALES_CONMEBOL === 'undefined' ? [] : SEDES_FINALES_CONMEBOL;
    return sedes.length ? sedes[Math.floor(Math.random() * sedes.length)] : this.canchaNeutral();
  },

  // Simula un partido de un cruce y lo suma al global.
  jugarPartidoDeLlave(copa, cruce, cuando) {
    const local = this.localDelCruce(cruce, cuando);
    const esLocalA = local === cruce.a || (!local && Math.random() < 0.5);
    const idLocal = local || (esLocalA ? cruce.a : cruce.b);
    const idVisitante = idLocal === cruce.a ? cruce.b : cruce.a;
    const score = this.simulateScore(
      this.copaStrength(copa.clubes[idLocal]),
      this.copaStrength(copa.clubes[idVisitante]),
      local ? 4 : 0,
    );
    this.anotarPartidoDeLlave(cruce, idLocal, idVisitante, score.homeGoals, score.awayGoals);
  },

  anotarPartidoDeLlave(cruce, local, visitante, golesLocal, golesVisitante) {
    if (local === cruce.a) { cruce.gA += golesLocal; cruce.gB += golesVisitante; }
    else { cruce.gB += golesLocal; cruce.gA += golesVisitante; }
    cruce.partidos.push({ local, visitante, golesLocal, golesVisitante });
  },

  // Todos los partidos de esta fecha de llaves, en las dos copas. `excepto` es
  // el cruce del usuario, que se resuelve aparte.
  simularPartidosDeLlave(cuando, excepto) {
    const ci = this.state.copasInter;
    Object.values(ci.copas).filter(Boolean).forEach((copa) => {
      const llave = copa.llave;
      if (!llave || llave.campeon || llave.etapa !== cuando.etapa.etapa) return;
      llave.cruces.forEach((cruce) => {
        if (cruce.ganador || cruce === excepto) return;
        this.jugarPartidoDeLlave(copa, cruce, cuando);
      });
    });
  },

  // Cierra la instancia cuando ya se jugaron sus partidos: define cada cruce
  // (global, y si quedó igualado, penales) y arma la instancia siguiente.
  cerrarEtapaDeLlave(copa) {
    const llave = copa.llave;
    llave.cruces.forEach((cruce) => {
      if (cruce.ganador) return;
      if (cruce.gA > cruce.gB) cruce.ganador = cruce.a;
      else if (cruce.gB > cruce.gA) cruce.ganador = cruce.b;
      else {
        cruce.ganador = this.copaTieWinner(cruce.a, cruce.b, copa.clubes);
        cruce.penales = cruce.ganador;
      }
    });

    const etapas = this.etapasDeLaCopa(copa.copa);
    const actual = etapas.findIndex((e) => e.etapa === llave.etapa);
    const ganadores = llave.cruces.map((c) => c.ganador);

    if (llave.etapa === 'final') {
      const cruce = llave.cruces[0];
      llave.campeon = cruce.ganador;
      llave.subcampeon = cruce.ganador === cruce.a ? cruce.b : cruce.a;
      llave.alcanzado[llave.campeon] = 'el título';
      this.state.log.unshift(`Copa ${copa.copa}: salió campeón ${copa.clubes[llave.campeon].nombre}.`);
      return;
    }

    const siguiente = etapas[actual + 1];
    llave.historial = (llave.historial || []).concat([{ etapa: llave.etapa, cruces: llave.cruces }]);

    if (siguiente.etapa === 'octavos' && llave.esperanEnOctavos) {
      // Los ocho primeros de grupo entran recién ahora, contra los que ganaron
      // el playoff.
      llave.cruces = this.sortearOctavos(llave.esperanEnOctavos, ganadores, llave.grupoDe);
      llave.esperanEnOctavos = null;
    } else {
      llave.cruces = [];
      for (let i = 0; i < ganadores.length; i += 2) {
        const x = ganadores[i];
        const y = ganadores[i + 1];
        if (!y) { llave.cruces.push(this.nuevoCruce(x, null)); continue; }
        llave.cruces.push((llave.seeds[x] || 99) <= (llave.seeds[y] || 99)
          ? this.nuevoCruce(x, y)
          : this.nuevoCruce(y, x));
      }
    }
    this.empezarEtapaDeLlave(copa, siguiente.etapa);
  },

  // Un checkpoint de llave: se juega el partido que toca. Si el usuario no está
  // vivo en ninguna de las dos copas, la fecha se resuelve sola.
  avanzarLlaveDeCopas(cuando) {
    const s = this.state;
    this.cerrarLasDosFasesDeGrupos();
    const mio = this.cruceDelUsuario(cuando);

    if (!mio) {
      this.simularPartidosDeLlave(cuando, null);
      this.cerrarLoQueTermino(cuando);
      this.seguirEnLaMismaSemana();
      return;
    }

    const cruce = mio.cruce;
    const soyA = cruce.a === s.clubId;
    const rivalId = soyA ? cruce.b : cruce.a;
    const neutral = !!cuando.etapa.neutral;
    const soyLocal = !neutral && this.localDelCruce(cruce, cuando) === s.clubId;
    s.matchContext = {
      context: 'copa-inter',
      copa: mio.copa.copa,
      opponentId: rivalId,
      isHome: soyLocal,
      isNeutral: neutral,
      sede: neutral ? this.sedeDeFinalContinental() : this.estadioDe(soyLocal ? s.clubId : rivalId),
      llave: {
        etapa: cuando.etapa.etapa,
        nombre: cuando.etapa.nombre,
        pierna: cuando.pierna,
        piernas: cuando.piernas,
        // Solo el último partido del cruce se puede ir al alargue y a los
        // penales, y solo si el global quedó igualado.
        decisiva: cuando.pierna === cuando.piernas - 1,
        globalMio: soyA ? cruce.gA : cruce.gB,
        globalRival: soyA ? cruce.gB : cruce.gA,
      },
    };
    this.pickDecision();
    s.screen = 'pre-match';
    this.save();
  },

  // Después del partido del usuario: se anota su resultado, se juega el resto
  // de la fecha y, si era el último partido de la instancia, se cierra.
  resolverLlaveDelUsuario() {
    const s = this.state;
    const m = s.pendingMatch;
    const ctx = s.matchContext;
    const copa = s.copasInter.copas[ctx.copa];
    const cruce = copa.llave.cruces.find((c) => c.a === s.clubId || c.b === s.clubId);
    this.anotarPartidoDeLlave(cruce, m.home, m.away, m.homeGoals, m.awayGoals);
    if (m.shootout) {
      cruce.ganador = m.shootout.userWon ? s.clubId : ctx.opponentId;
      cruce.penales = cruce.ganador;
    }
    const etiqueta = `Copa ${ctx.copa} — ${ctx.llave.nombre}`;
    s.log.unshift(`${etiqueta}: ${this.getClub(m.home).name} ${m.homeGoals}-${m.awayGoals} ${this.getClub(m.away).name}${m.shootout ? ' (por penales)' : ''}`);
    if (ctx.isNeutral) Economia.cobrarPartidoNeutral(this, ctx.opponentId, cruce.ganador === s.clubId);
    else if (m.isHome) Economia.cobrarPartidoDeLocal(this, false);

    const cuando = { etapa: COPA_INTER_LLAVES.find((e) => e.etapa === ctx.llave.etapa), pierna: ctx.llave.pierna, piernas: ctx.llave.piernas };
    this.simularPartidosDeLlave(cuando, cruce);
    s.pendingMatch = null;
    s.matchContext = null;
    this.cerrarLoQueTermino(cuando);
    this.seguirEnLaMismaSemana();
  },

  cerrarLoQueTermino(cuando) {
    if (cuando.pierna !== cuando.piernas - 1) return;
    Object.values(this.state.copasInter.copas).filter(Boolean).forEach((copa) => {
      if (copa.llave && !copa.llave.campeon && copa.llave.etapa === cuando.etapa.etapa) {
        this.cerrarEtapaDeLlave(copa);
      }
    });
  },

  // Termina sola una copa que quedó a medio jugar. No debería hacer falta —las
  // llaves entran enteras en el calendario— pero si una partida vieja llega a
  // fin de año con la copa abierta, el campeón sale igual.
  terminarLlaveSimulando(copa) {
    let vueltas = 0;
    while (copa.llave && !copa.llave.campeon && vueltas++ < 10) {
      const etapa = COPA_INTER_LLAVES.find((e) => e.etapa === copa.llave.etapa);
      const piernas = etapa.etapa === 'final' ? 1 : 2;
      for (let pierna = 0; pierna < piernas; pierna++) {
        copa.llave.cruces.forEach((cruce) => {
          if (!cruce.ganador && cruce.b) this.jugarPartidoDeLlave(copa, cruce, { etapa, pierna });
        });
      }
      this.cerrarEtapaDeLlave(copa);
    }
  },

  // El resumen de una copa que ya se jugó entera, en el mismo formato que
  // devuelve simulateCopa: es lo que se guarda en la partida y lo que lee la
  // pantalla de fin de temporada.
  resumenDeCopaJugada(copa) {
    const s = this.state;
    if (!copa.llave) return null;
    if (!copa.llave.campeon) this.terminarLlaveSimulando(copa);
    const llave = copa.llave;
    const campeon = llave.campeon;
    if (!campeon) return null;
    const victorias = copa.grupos.reduce((total, grupo) => total + grupo.partidos.filter((p) => (
      (p.local === s.clubId && p.golesLocal > p.golesVisitante)
      || (p.visitante === s.clubId && p.golesVisitante > p.golesLocal)
    )).length, 0);
    return {
      copa: copa.copa,
      championId: campeon,
      championName: copa.clubes[campeon].nombre,
      championPais: copa.clubes[campeon].pais,
      runnerUpName: llave.subcampeon ? copa.clubes[llave.subcampeon].nombre : null,
      userWon: campeon === s.clubId,
      userStage: llave.alcanzado[s.clubId] || null,
      userExtras: {
        victoriasEnGrupos: victorias,
        previa: copa.previa.camino && copa.previa.camino.fases.length ? copa.previa.camino : null,
      },
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
      // La Nacional va a ida y vuelta, igual que cuando la dirige el usuario:
      // si acá jugara una sola rueda, la división simulada terminaría el año
      // con la mitad de los partidos y los ascensos saldrían de otra cosa.
      const idaYVuelta = (rondas) => rondas.concat(
        rondas.map((ronda) => ronda.map((m) => ({ home: m.away, away: m.home }))),
      );
      const scheduleA = division === 'D2' ? idaYVuelta(this.buildSchedule(idsA)) : this.buildSchedule(idsA);
      const scheduleB = division === 'D2' ? idaYVuelta(this.buildSchedule(idsB)) : this.buildSchedule(idsB);
      scheduleA.forEach((round) => this.simulateRoundOntoTable(round, tableA));
      scheduleB.forEach((round) => this.simulateRoundOntoTable(round, tableB));
      // Las fechas interzonales se simulan igual que en la división del
      // usuario: si no, las dos mitades del país llegarían a fin de año con
      // distinta cantidad de partidos jugados y la tabla no cerraría. Primera
      // tiene dos; la Nacional, una sola al final.
      const enA = new Set(idsA);
      const interzonales = division === 'D1'
        ? this.buildInterzonalSchedule(scheduleA, idsA, scheduleB, idsB)
        : [this.buildClasicoRound(idsA, idsB)];
      interzonales.forEach((round) => {
        round.forEach((fixture) => {
          const score = this.simulateScore(this.clubStrength(fixture.home), this.clubStrength(fixture.away), 4);
          this.updateTableRow(enA.has(fixture.home) ? tableA : tableB, fixture.home, score.homeGoals, score.awayGoals);
          this.updateTableRow(enA.has(fixture.away) ? tableA : tableB, fixture.away, score.awayGoals, score.homeGoals);
        });
      });
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
      banco: null,
      season: null,
      calendar: null,
      copaBracket: null,
      copasInter: null,
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
      // Cuánto de un sueldo "de catálogo" paga este club (ver Economia).
      escalaSalarial: null,
      mercado: null,
      notasMercado: [],
      historialPuntos: {},
      // En qué año te fuiste de Primera. Lo usa la pantalla de fin de carrera
      // para contar el camino completo hasta el Federal A.
      anioDelDescenso: null,
      log: [],
    };
    this.sembrarHistorialDePromedios();
    const club = this.getClub(clubId);
    let budget = this.startingBudget(club);
    if (dt && dt.style === 'conservador') budget = Math.round(budget * 1.1);
    this.state.budget = budget;
    this.state.squad = this.generateSquad(club);
    // La escala salarial se calibra con el plantel de arranque: arrancás justo
    // en el presupuesto de sueldos de tu club y de ahí en más depende de vos.
    Economia.calibrarEscalaSalarial(this);
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
      copaInterShown: [],
      transferShown: false,
      transferReason: null,
      zones: {},
      myD1: club.division === 'D1' ? { apertura: null, clausura: null } : null,
      myD2: club.division === 'D2' ? { zoneATable: null, zoneBTable: null, promotedDirect: null, promotedReducido: null } : null,
      backgroundResult: null,
    };
    s.bracket = null;
    s.lastSeasonSummary = null;
    // El almanaque arranca de nuevo cada temporada. El año futbolero va de
    // febrero a noviembre y todo el calendario de copas está programado sobre
    // esos meses: la Recopa en febrero, la fase de grupos entre marzo y mayo,
    // las llaves de agosto a noviembre. El contador de días seguía de largo de
    // una temporada a la otra, así que cada año se corría unos tres meses y a
    // la tercera temporada la segunda fecha del Apertura caía en diciembre.
    // De paso, esto también arregla los contratos: Mercado calcula los meses
    // que faltan hasta fin de año sobre este mismo contador.
    if (s.calendar) s.calendar.dayCount = 0;
    // La pretemporada deja a todos enteros, por cansados que hayan terminado.
    if (s.squad) s.squad.forEach((p) => { p.energia = ENERGIA_MAXIMA; });
    this.cerrarEstadisticasDelAnio();
    Economia.nuevaTemporada(s);

    s.season.backgroundResult = this.simulateFullDivisionYear(otherDivision);
    this.setupCopaBracket();
    // Las copas internacionales de este año se arman ahora, con los
    // clasificados que salieron de la temporada pasada: la fase previa queda
    // resuelta y los grupos sorteados, listos para jugarse fecha a fecha.
    this.armarCopasInternacionales();

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

    // El cuadro principal es de 64: los 30 de Primera entran directo a los
    // treintaidosavos y el resto son clubes del ascenso. En la realidad esos
    // 34 salen de la Primera Nacional, la Primera B, la Primera C y el Federal
    // A; como el juego solo tiene cargada la Nacional, por ahora salen todos
    // de ahí.
    const entrants = d1Ids.slice();
    if (club.division === 'D2') entrants.push(s.clubId);
    while (entrants.length < 64 && d2Pool.length) entrants.push(d2Pool.shift());

    for (let i = entrants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entrants[i], entrants[j]] = [entrants[j], entrants[i]];
    }
    s.copaBracket = { alive: entrants.map((id, i) => ({ id, seed: i + 1 })), stageIndex: 0, champion: null, runnerUp: null, historial: [] };
  },

  // Las amarillas que no llegaron a suspensión se borran al terminar cada
  // torneo y también al pasar de la fase regular a los playoffs. Lo que NO se
  // borra es una suspensión ya puesta: el que llegó a la quinta en la última
  // fecha la cumple igual en el playoff, que es justo lo que dice el
  // reglamento.
  limpiarAmarillas() {
    (this.state.squad || []).forEach((p) => { p.amarillas = 0; });
  },

  startEdition(edition) {
    const s = this.state;
    const season = s.season;
    const club = this.getClub(s.clubId);
    season.edition = edition;
    season.roundIndex = 0;
    this.limpiarAmarillas();
    season.fifaShown = [];
    season.copaShown = [];
    season.copaInterShown = [];

    const zoneAId = `${club.division}-A`;
    const zoneBId = `${club.division}-B`;
    const idsA = s.clubs.filter((c) => c.division === club.division && c.zone === 'A').map((c) => c.id);
    const idsB = s.clubs.filter((c) => c.division === club.division && c.zone === 'B').map((c) => c.id);
    // La Nacional es a ida y vuelta, así que su fixture es el de una rueda más
    // el mismo dado vuelta (el que fue local ahora es visitante).
    const idaYVuelta = (rondas) => rondas.concat(
      rondas.map((ronda) => ronda.map((m) => ({ home: m.away, away: m.home }))),
    );
    const esNacional = club.division === 'D2';
    const scheduleA = esNacional ? idaYVuelta(this.buildSchedule(idsA)) : this.buildSchedule(idsA);
    const scheduleB = esNacional ? idaYVuelta(this.buildSchedule(idsB)) : this.buildSchedule(idsB);
    season.zones = {
      [zoneAId]: { clubIds: idsA, schedule: scheduleA, table: Object.fromEntries(idsA.map((id) => [id, this.emptyTableRow()])) },
      [zoneBId]: { clubIds: idsB, schedule: scheduleB, table: Object.fromEntries(idsB.map((id) => [id, this.emptyTableRow()])) },
    };
    // Primera tiene dos fechas interzonales repartidas en el torneo; la
    // Nacional tiene una sola, al final, después de las dos ruedas.
    season.interzonal = esNacional
      ? Array.from({ length: scheduleA.length }, () => []).concat([this.buildClasicoRound(idsA, idsB)])
      : this.buildInterzonalSchedule(scheduleA, idsA, scheduleB, idsB);

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

  // Los partidos de copa son de entre semana: se juegan en la MISMA semana que
  // la fecha de liga, así que al terminar uno no se arranca una semana nueva,
  // se sigue con lo que falte de esta. Solo la fecha de liga hace pasar la
  // semana (ver enterEditionRound). Si cada copa se comiera su propia semana,
  // el año duraría catorce meses.
  seguirEnLaMismaSemana() {
    this.enterEditionRoundContent();
  },

  // Dónde caen los partidos de copa dentro del torneo que se está jugando
  // (ver FECHAS_DE_COPAS). En Primera cambia según sea el Apertura o el
  // Clausura; en la Nacional hay una sola lista.
  calendarioDeCopas() {
    const season = this.state.season;
    if (!season) return {};
    if (season.myDivision === 'D2') return FECHAS_DE_COPAS.D2.unico;
    return FECHAS_DE_COPAS.D1[season.edition] || {};
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
  // En qué día del almanaque se juega una fecha del torneo. Una fecha es una
  // semana (ver advanceCalendarDay), más una semana extra por cada parate FIFA
  // que haya quedado atrás. El día 0 es el 1° de febrero, así que la fecha 0
  // se juega el día 7.
  //
  // OJO: solo vale para el PRIMER torneo del año. En el Clausura el roundIndex
  // vuelve a empezar de cero pero el almanaque sigue corriendo, así que la
  // cuenta daría cualquier cosa. Hoy lo usa únicamente la Recopa, que se juega
  // en las dos primeras fechas de febrero.
  diaDeLaFechaDeLiga(roundIndex) {
    const parates = FIFA_ROUNDS.filter((r) => r <= roundIndex).length;
    return 7 * (roundIndex + 1 + parates);
  },

  // Los días en que se juegan la ida y la vuelta de la Recopa, para poder
  // decir cuándo es en vez de solo "todavía no se jugó". Devuelve null si
  // este año no hay Recopa en el calendario.
  diasDeLaRecopa() {
    const rondas = (this.calendarioDeCopas() || {}).recopa;
    if (!rondas || !rondas.length) return null;
    return rondas.map((ronda) => this.diaDeLaFechaDeLiga(ronda));
  },

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
      this.recuperarEnergia();
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

    const calendario = this.calendarioDeCopas();

    // La Copa Argentina dura todo el año, como en la realidad: sus seis rondas
    // se reparten de febrero a noviembre, una cada mes y medio más o menos, y
    // cruzan el Apertura y el Clausura. Cada checkpoint hace avanzar el cuadro
    // exactamente una ronda.
    if ((calendario.copaArgentina || []).includes(season.roundIndex) && !season.copaShown.includes(season.roundIndex) && s.copaBracket.alive.length > 1) {
      season.copaShown.push(season.roundIndex);
      this.advanceCopaBracket();
      return;
    }

    // La Recopa abre el año, en febrero, antes que todo lo demás.
    const recopaRounds = calendario.recopa || [];
    if (s.copasInter && s.copasInter.recopa && !s.copasInter.recopa.ganador
      && recopaRounds.includes(season.roundIndex)
      && !(season.copaInterShown || []).includes(`r${season.roundIndex}`)) {
      season.copaInterShown = (season.copaInterShown || []).concat([`r${season.roundIndex}`]);
      this.avanzarRecopa(recopaRounds.indexOf(season.roundIndex));
      return;
    }

    // Las copas internacionales corren en paralelo a la liga: seis fechas de
    // grupos entre marzo y mayo, en semanas distintas a las de la Copa
    // Argentina para no amontonar partidos.
    if (s.copasInter && s.copasInter.fecha < FECHAS_DE_GRUPOS
      && (calendario.grupos || []).includes(season.roundIndex)
      && !(season.copaInterShown || []).includes(season.roundIndex)) {
      season.copaInterShown = (season.copaInterShown || []).concat([season.roundIndex]);
      this.avanzarFechaDeCopas();
      return;
    }

    // Y de octavos a la final, que van en el Clausura.
    const llaveDeCopa = s.copasInter ? this.llaveQueTocaEstaFecha() : null;
    if (llaveDeCopa && !(season.copaInterShown || []).includes(`k${season.roundIndex}`)) {
      season.copaInterShown = (season.copaInterShown || []).concat([`k${season.roundIndex}`]);
      this.avanzarLlaveDeCopas(llaveDeCopa);
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
      sede: this.estadioDe(isHome ? userMatch.home : userMatch.away),
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
      const cruces = [];
      cb.alive = pairs.map((pair, idx) => {
        const resultado = this.resolverCruce(pair[0].id, pair[1] ? pair[1].id : null);
        cruces.push(this.cruceAnotado(pair, resultado, idx));
        return pair.find((p) => p.id === resultado.ganador);
      });
      this.anotarRondaDeCopa(cb.stageIndex, cruces);
      cb.stageIndex++;
      if (cb.alive.length === 1) {
        cb.champion = cb.alive[0].id;
        s.log.unshift(`Copa Argentina: salió campeón ${this.getClub(cb.champion).name}.`);
      }
      this.seguirEnLaMismaSemana();
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
    // directa: primero se juega un alargue de 30 minutos y, si sigue empatado,
    // recién ahí van los penales.
    // El alargue es un tercio de un partido, así que la mayoría de las veces
    // termina 0-0 y se define por penales igual, pero de vez en cuando aparece
    // el gol y la serie se cierra ahí. La Copa Argentina es la excepción: no
    // tiene alargue, del empate se va derecho a los penales.
    const sinAlargue = !!(s.matchContext && s.matchContext.sinAlargue);
    if (this.empateSinResolver(m) && !sinAlargue) {
      const enAlargue = this.simulateExtraTime(m);
      if (enAlargue.homeGoals || enAlargue.awayGoals) {
        m.homeGoals += enAlargue.homeGoals;
        m.awayGoals += enAlargue.awayGoals;
        m.extraTime = enAlargue;
      }
    }
    if (this.empateSinResolver(m)) {
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

  // ¿El partido quedó sin ganador y hay que definirlo ahí mismo?
  //
  // En la liga y en la fase de grupos de las copas, no: el empate es empate y
  // suma un punto. En una llave de ida y vuelta tampoco alcanza con mirar el
  // partido, porque lo que define es el global: la ida puede terminar empatada
  // sin que pase nada, y solo el último partido del cruce se va al alargue y a
  // los penales, y únicamente si el global quedó igualado. (CONMEBOL sacó la
  // ventaja del gol de visitante en 2022: hoy es global, alargue y penales.)
  empateSinResolver(m) {
    const llave = this.state.matchContext && this.state.matchContext.llave;
    if (llave) {
      if (!llave.decisiva) return false;
      const mios = (m.isHome ? m.homeGoals : m.awayGoals) + llave.globalMio;
      const suyos = (m.isHome ? m.awayGoals : m.homeGoals) + llave.globalRival;
      return mios === suyos;
    }
    if (m.context === 'league' || m.context === 'copa-inter') return false;
    return m.homeGoals === m.awayGoals;
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
  // La energía de un jugador. Los que vienen de una partida guardada antes de
  // que esto existiera no tienen el campo: se los toma enteros.
  energiaDe(player) {
    return player.energia == null ? ENERGIA_MAXIMA : player.energia;
  },

  // Cuánto rinde según cómo está físicamente. Hasta 80 juega entero; de ahí
  // para abajo baja derecho hasta el 72% de su valoración.
  factorDeEnergia(player) {
    const e = this.energiaDe(player);
    if (e >= ENERGIA_SIN_MERMA) return 1;
    return RENDIMIENTO_MINIMO + (1 - RENDIMIENTO_MINIMO) * (e / ENERGIA_SIN_MERMA);
  },

  // Un jugador de jerarquía se cansa menos: está mejor entrenado y resuelve
  // con menos esfuerzo.
  costoDeUnPartido(player) {
    return ENERGIA_POR_PARTIDO * (1 - (player.rating - 65) / 250);
  },

  // Un pibe se repone más rápido que un veterano. Es la diferencia más
  // importante entre tener un plantel joven y uno de nombres grandes.
  recuperacionPorDia(player) {
    const edad = player.age;
    const factor = edad <= 21 ? 1.2 : edad <= 25 ? 1.1 : edad <= 29 ? 1 : edad <= 33 ? 0.88 : 0.78;
    return ENERGIA_POR_DIA * factor;
  },

  // Los once que jugaron llegan cansados al vestuario.
  gastarEnergia(jugaron) {
    this.state.squad.forEach((p) => {
      if (!jugaron.has(p.id)) return;
      p.energia = Math.max(0, this.energiaDe(p) - this.costoDeUnPartido(p));
    });
  },

  // Un día de calendario de descanso para todo el plantel. Se llama una vez
  // por día en advanceCalendarDay, así que una semana son siete pasadas.
  recuperarEnergia() {
    const s = this.state;
    if (!s.squad) return;
    s.squad.forEach((p) => {
      p.energia = Math.min(ENERGIA_MAXIMA, this.energiaDe(p) + this.recuperacionPorDia(p));
    });
  },

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

    // Un jugador fundido se lesiona más. Se nota en dos lugares: sube la
    // chance de que haya lesión en el partido, y el que se lesiona es casi
    // siempre uno de los que venían cansados.
    const energiaMedia = titulares.reduce((suma, p) => suma + this.energiaDe(p), 0) / titulares.length;
    const riesgo = 0.26 * (1 + Math.max(0, ENERGIA_SIN_MERMA - energiaMedia) / 160);
    // Sorteo con bolillas: cada jugador entra tantas veces como cansado esté.
    // Uno entero entra una vez; uno en cero, cuatro.
    const bolillero = [];
    titulares.forEach((p) => {
      const bolillas = 1 + Math.round(3 * (1 - this.energiaDe(p) / ENERGIA_MAXIMA));
      for (let i = 0; i < bolillas; i++) bolillero.push(p);
    });

    // Lesiones: alrededor de un jugador cada cuatro partidos, más si el once
    // viene fundido. Las molestias leves son mucho más comunes que las largas.
    if (Math.random() < riesgo) {
      const p = sortear(bolillero);
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

    // Amarillas. Se cuentan de verdad, una por una: a la quinta el jugador se
    // pierde el próximo partido y el contador vuelve a cero. El contador es
    // por torneo (ver limpiarAmarillas), así que lo que juntó en el Apertura
    // no se arrastra al Clausura.
    titulares.filter((p) => this.isAvailable(p)).forEach((p) => {
      if (Math.random() > 0.16) return; // da algo menos de 2 amarillas por partido
      p.amarillas = (p.amarillas || 0) + 1;
      if (p.amarillas >= 5) {
        p.amarillas = 0;
        p.out = { reason: 'suspensión', detail: 'Acumulación de amarillas', matches: 1 };
        avisos.push(`${p.name} llegó a la quinta amarilla: no puede jugar el próximo partido.`);
      } else if (p.amarillas === 4) {
        avisos.push(`${p.name} llegó a la cuarta amarilla: con una más se pierde un partido.`);
      }
    });

    // Expulsiones. Las fechas de una roja directa las gradúa el Tribunal de
    // Disciplina según la jugada, así que van de 1 a 4; la doble amarilla es
    // siempre una sola fecha.
    if (Math.random() < 0.07) {
      const disponibles = titulares.filter((p) => this.isAvailable(p));
      if (disponibles.length) {
        const p = sortear(disponibles);
        const dobleAmarilla = Math.random() < 0.5;
        const matches = dobleAmarilla ? 1 : 1 + Math.floor(Math.random() * 4);
        p.out = { reason: 'suspensión', detail: dobleAmarilla ? 'Doble amarilla' : 'Expulsado', matches };
        avisos.push(`${p.name} ${dobleAmarilla ? 'se fue por doble amarilla' : 'se fue expulsado'}: no puede jugar ${matches === 1 ? 'el próximo partido' : `los próximos ${matches} partidos`}.`);
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

  // ---------- Estadísticas de los jugadores ----------
  //
  // Hasta acá un partido producía un marcador y nada más: no había forma de
  // saber quién estaba rindiendo, ni tabla de goleadores, ni "mi 9 lleva 14".
  //
  // El motor no simula jugadas, así que no sabe quién la metió. Los goles se
  // reparten con un bolillero entre los que jugaron: un delantero entra
  // muchas más veces que un defensor y, adentro de cada línea, pesa la
  // valoración. En una temporada eso da un reparto parecido al real — el 9
  // termina arriba de la tabla y el central mete tres de pelota parada.
  GOLES_POR_PUESTO: { DEL: 10, MED: 4, DEF: 1.2, POR: 0 },
  ASISTENCIAS_POR_PUESTO: { DEL: 4, MED: 7, DEF: 2, POR: 0.1 },
  // Cuántos goles llevan asistencia. El resto son de pelota parada, rebote,
  // jugada individual o en contra.
  CHANCE_DE_ASISTENCIA: 0.62,

  // Los números de un jugador en la temporada. Se crean cuando hacen falta,
  // así un jugador que llega a mitad de año o una partida vieja no rompen.
  estadisticasDe(player) {
    if (!player.stats) player.stats = { pj: 0, goles: 0, asistencias: 0 };
    return player.stats;
  },

  carreraDe(player) {
    if (!player.carrera) player.carrera = { pj: 0, goles: 0, asistencias: 0 };
    return player.carrera;
  },

  // Un bolillero con los que jugaron: cada uno entra tantas veces como diga
  // su puesto, multiplicado por lo bueno que es.
  bolilleroDe(jugadores, pesos) {
    const bolillero = [];
    jugadores.forEach((p) => {
      const peso = (pesos[p.pos] || 0) * (0.5 + p.rating / 100);
      const bolillas = Math.round(peso * 10);
      for (let i = 0; i < bolillas; i++) bolillero.push(p);
    });
    return bolillero;
  },

  // Reparte los goles de tu equipo entre los que jugaron y suma un partido a
  // cada uno. Se llama una vez por partido, con el marcador ya cerrado.
  anotarEstadisticas(m, jugaron) {
    const s = this.state;
    if (!m || !s.squad) return;
    const enCancha = s.squad.filter((p) => jugaron.has(p.id));
    if (!enCancha.length) return;
    enCancha.forEach((p) => { this.estadisticasDe(p).pj++; });

    // Los goles de los penales de la tanda no cuentan como goles del partido,
    // igual que en la realidad.
    const mios = m.isHome ? m.homeGoals : m.awayGoals;
    if (!mios) return;

    const bolGoles = this.bolilleroDe(enCancha, this.GOLES_POR_PUESTO);
    const bolAsist = this.bolilleroDe(enCancha, this.ASISTENCIAS_POR_PUESTO);
    if (!bolGoles.length) return;
    const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)];

    for (let g = 0; g < mios; g++) {
      const autor = alAzar(bolGoles);
      this.estadisticasDe(autor).goles++;
      if (Math.random() < this.CHANCE_DE_ASISTENCIA && bolAsist.length) {
        // El que asiste no puede ser el mismo que hizo el gol.
        const candidatos = bolAsist.filter((p) => p.id !== autor.id);
        if (candidatos.length) this.estadisticasDe(alAzar(candidatos)).asistencias++;
      }
      if (typeof Noticias !== 'undefined') Noticias.trasUnGol(this, autor);
    }
  },

  // Al cerrar la temporada, lo del año se suma a la carrera y las cuentas del
  // año vuelven a cero.
  cerrarEstadisticasDelAnio() {
    (this.state.squad || []).forEach((p) => {
      const anio = this.estadisticasDe(p);
      const carrera = this.carreraDe(p);
      carrera.pj += anio.pj;
      carrera.goles += anio.goles;
      carrera.asistencias += anio.asistencias;
      p.stats = { pj: 0, goles: 0, asistencias: 0 };
    });
  },

  developSquadAfterMatch(userWon, userLost) {
    const s = this.state;
    const club = this.getClub(s.clubId);
    const factorClub = this.factorDeDesarrollo(club);
    const jugaron = new Set(this.getStartingXI().starters.map((e) => e.id));
    // Los once llegan cansados. Se hace ANTES de mirar el desarrollo para que
    // el orden sea el de la realidad: primero se jugó el partido.
    this.gastarEnergia(jugaron);
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
    if (m.context !== 'league' && m.context !== 'copa-inter') return Math.random() < 0.5 ? m.home : m.away;
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
    this.anotarEstadisticas(m, new Set(this.getStartingXI().starters.map((e) => e.id)));

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
    } else if (m.context === 'copa-inter' && s.matchContext.copa === 'Recopa') {
      this.resolverRecopaDelUsuario();
    } else if (m.context === 'copa-inter' && s.matchContext.llave) {
      this.resolverLlaveDelUsuario();
    } else if (m.context === 'copa-inter') {
      // Fase de grupos: el partido se anota en la tabla del grupo y el resto
      // de la fecha (los otros 15 partidos de esa copa, más los de la otra)
      // se simula recién ahora, para que la tabla se mueva con tu resultado
      // ya puesto.
      const ctx = s.matchContext;
      const ci = s.copasInter;
      const copa = ci.copas[ctx.copa];
      const grupo = copa.grupos.find((g) => g.ids.includes(s.clubId));
      this.anotarEnGrupo(grupo, m.home, m.away, m.homeGoals, m.awayGoals);
      s.log.unshift(`Copa ${ctx.copa} — Grupo ${grupo.letra}: ${clubName(m.home)} ${m.homeGoals}-${m.awayGoals} ${clubName(m.away)}`);
      if (m.isHome) Economia.cobrarPartidoDeLocal(this, false);
      this.simularFechaDeCopas(ci.fecha, m);
      ci.fecha++;
      s.pendingMatch = null;
      s.matchContext = null;
      if (ci.fecha >= FECHAS_DE_GRUPOS) this.cerrarLasDosFasesDeGrupos();
      this.seguirEnLaMismaSemana();
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

  // Una llave a partido único. Devuelve el resultado completo y no solo quién
  // pasó, porque el cuadro de la Copa Argentina muestra los marcadores.
  resolverCruce(idA, idB) {
    if (idA === null || idB === null) {
      return { ganador: idA === null ? idB : idA, golesA: null, golesB: null, penales: false };
    }
    const sa = this.clubStrength(idA);
    const sb = this.clubStrength(idB);
    const score = this.simulateScore(sa, sb, 2);
    const empate = score.homeGoals === score.awayGoals;
    const prob = Math.max(0.15, Math.min(0.85, 0.5 + (sa - sb) / 100));
    return {
      ganador: empate
        ? (Math.random() < prob ? idA : idB)
        : (score.homeGoals > score.awayGoals ? idA : idB),
      golesA: score.homeGoals,
      golesB: score.awayGoals,
      penales: empate,
    };
  },

  resolveKnockout(idA, idB) {
    return this.resolverCruce(idA, idB).ganador;
  },

  // El cuadro de la Copa Argentina, ronda por ronda. s.copaBracket.alive solo
  // guarda a los que siguen vivos, así que sin esto no hay manera de saber
  // quién eliminó a quién ni con qué resultado. Una ronda se puede anotar en
  // dos veces (primero los cruces que resuelve la computadora y después el
  // tuyo, cuando lo jugás), así que se van sumando al mismo registro.
  anotarRondaDeCopa(stageIndex, cruces) {
    this.anotarRondaEn(this.state.copaBracket, stageIndex, cruces);
  },

  // Lo mismo para los playoffs del Apertura y del Clausura, el Reducido y la
  // Final por el ascenso: el cuadro se guarda en la propia llave, así se puede
  // dibujar mientras se juega y queda para mirarlo después.
  anotarRondaDeLlave(stageIndex, cruces) {
    this.anotarRondaEn(this.state.bracket, stageIndex, cruces);
  },

  anotarRondaEn(destino, stageIndex, cruces) {
    if (!destino || !cruces || !cruces.length) return;
    destino.historial = destino.historial || [];
    const ronda = destino.historial.find((r) => r.stageIndex === stageIndex);
    if (ronda) ronda.cruces = ronda.cruces.concat(cruces);
    else destino.historial.push({ stageIndex, cruces });
    destino.historial.sort((a, b) => a.stageIndex - b.stageIndex);
  },

  // `pos` es el lugar del cruce dentro de la ronda. Sin eso el cuadro no se
  // puede dibujar: los cruces no siempre se resuelven en orden (el tuyo se
  // juega después que los demás), así que hay que saber dónde va cada uno.
  cruceAnotado(pair, resultado, pos) {
    return {
      pos,
      a: pair[0] ? pair[0].id : null,
      b: pair[1] ? pair[1].id : null,
      ganador: resultado.ganador,
      golesA: resultado.golesA,
      golesB: resultado.golesB,
      penales: resultado.penales,
    };
  },

  // `anotar` es opcional: la Copa Argentina lo usa para guardar cada ronda que
  // se resuelve de una, y así el cuadro queda completo aunque vos hayas
  // quedado eliminado en la primera.
  simulateSeedsToChampion(seeds, anotar) {
    let alive = seeds;
    let runnerUp = null;
    while (alive.length > 1) {
      const pairs = this.pairStage(alive);
      const cruces = [];
      const winners = pairs.map((pair, idx) => {
        const resultado = this.resolverCruce(pair[0].id, pair[1] ? pair[1].id : null);
        cruces.push(this.cruceAnotado(pair, resultado, idx));
        if (pairs.length === 1) {
          const loser = pair.find((p) => p.id !== resultado.ganador);
          runnerUp = loser ? loser.id : null;
        }
        return pair.find((p) => p.id === resultado.ganador);
      });
      if (anotar) anotar(alive.length, cruces);
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
    // Los playoffs arrancan con el contador de amarillas en cero.
    if (kind === 'apertura' || kind === 'clausura') this.limpiarAmarillas();
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
    const cruces = [];
    let userEntry = null;
    let opponentEntry = null;

    let userPos = 0;
    pairs.forEach((pair, idx) => {
      const involvesUser = pair.some((p) => p.id === s.clubId);
      if (involvesUser) {
        userEntry = pair.find((p) => p.id === s.clubId);
        opponentEntry = pair.find((p) => p.id !== s.clubId);
        userPos = idx;
        return;
      }
      const resultado = this.resolverCruce(pair[0].id, pair[1] ? pair[1].id : null);
      winners.push(pair.find((p) => p.id === resultado.ganador));
      cruces.push(this.cruceAnotado(pair, resultado, idx));
    });
    s.bracket.userPos = userPos;
    // Los otros cruces de la ronda quedan resueltos desde ahora, pero NO se
    // anotan todavía: si se anotaran acá, el cuadro te mostraría cómo salió el
    // resto de la ronda antes de que juegues tu partido. Se guardan y se
    // anotan junto con el tuyo (ver resolveUserBracketMatch).
    s.bracket.pendingCruces = cruces;
    // Los cuadros de playoffs arrancan dibujados desde el sorteo, así que hay
    // que guardar quién se cruza con quién ya mismo: los resultados se
    // completan cuando termine la ronda.
    if (s.bracket.kind !== 'copa') {
      this.anotarRondaDeLlave(s.bracket.stageIndex, cruces.map((c) => ({ ...c, ganador: null, golesA: null, golesB: null })));
    }

    s.bracket.pendingWinners = winners;
    s.bracket.pendingIsFinal = pairs.length === 1;
    s.bracket.pendingUserEntry = userEntry;
    s.bracket.pendingOpponentEntry = opponentEntry;

    if (!opponentEntry || opponentEntry.id === null) {
      s.log.unshift(`${this.bracketStageLabel()}: tenés fecha libre, pasás de ronda directo.`);
      this.resolveUserBracketMatch(true, true);
      return;
    }

    // En los playoffs (los del Apertura y el Clausura, y también el Reducido
    // de la Nacional) es local el que terminó mejor en la fase regular, o sea
    // el de seed más bajo, y solo la final se juega en cancha neutral.
    //
    // La Copa Argentina es la excepción: se juega entera en canchas neutrales.
    //
    // La sede neutral sale sorteada de los estadios provinciales grandes (ver
    // CANCHAS_NEUTRALES en data.js), que son los que se usan de verdad, así
    // que nunca es la cancha de uno de los grandes. Cuando no hay local
    // tampoco hay ventaja de localía para ninguno de los dos.
    const enNeutral = s.bracket.kind === 'copa' || !!s.bracket.pendingIsFinal;
    const isHome = userEntry.seed < opponentEntry.seed;
    s.matchContext = {
      context: 'bracket',
      opponentId: opponentEntry.id,
      isHome,
      isNeutral: enNeutral,
      sede: enNeutral ? this.canchaNeutral() : this.estadioDe(isHome ? s.clubId : opponentEntry.id),
      // La Copa Argentina no tiene alargue: si termina empatada se va derecho
      // a los penales. Los playoffs sí juegan los 30 minutos extra.
      sinAlargue: s.bracket.kind === 'copa',
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

    if (isBye) {
      if (s.bracket.kind === 'copa') this.anotarRondaDeCopa(s.bracket.stageIndex, s.bracket.pendingCruces || []);
      s.bracket.pendingCruces = null;
    }

    if (!isBye) {
      const m = s.pendingMatch;
      const clubName = (id) => this.getClub(id).name;
      const label = this.bracketStageLabel();
      // La recaudación de la llave: si se jugó en cancha neutral se reparte
      // 70/30 entre ganador y perdedor; si fuiste local en tu cancha, es toda
      // tuya como en cualquier partido de local.
      const ctx = s.matchContext;
      if (ctx && ctx.isNeutral) Economia.cobrarPartidoNeutral(this, m.opponentId, userWon);
      else if (m.isHome) Economia.cobrarPartidoDeLocal(this, false);
      if (userWon) s.log.unshift(`${label}: avanzaste ${m.homeGoals}-${m.awayGoals} vs ${clubName(m.opponentId)}${m.shootout ? ' (por penales)' : m.extraTime ? ' (en el alargue)' : ''}.`);
      else s.log.unshift(`${label}: quedaste eliminado ante ${clubName(m.opponentId)}.`);
      const cruces = (s.bracket.pendingCruces || []).concat([{
        pos: s.bracket.userPos || 0,
        a: m.home,
        b: m.away,
        ganador: userWon ? s.clubId : m.opponentId,
        golesA: m.homeGoals,
        golesB: m.awayGoals,
        penales: !!m.shootout,
      }]);
      if (s.bracket.kind === 'copa') this.anotarRondaDeCopa(s.bracket.stageIndex, cruces);
      else {
        s.bracket.historial = (s.bracket.historial || []).filter((r) => r.stageIndex !== s.bracket.stageIndex);
        this.anotarRondaDeLlave(s.bracket.stageIndex, cruces);
      }
      s.bracket.pendingCruces = null;
    }

    const advancingEntry = userWon ? s.bracket.pendingUserEntry : s.bracket.pendingOpponentEntry;
    // El que sale de tu llave vuelve a SU lugar del cuadro, no al final de la
    // fila. Si se agregaba al final, en la ronda siguiente te tocaba siempre el
    // ganador de la última llave en vez del de la llave de al lado, y el cuadro
    // dejaba de ser un cuadro.
    const avanzan = s.bracket.pendingWinners.slice();
    avanzan.splice(s.bracket.userPos || 0, 0, advancingEntry);
    s.bracket.alive = avanzan;
    s.pendingMatch = null;
    s.matchContext = null;

    if (isFinal) {
      s.bracket.champion = advancingEntry.id;
      s.bracket.runnerUp = userWon ? s.bracket.pendingOpponentEntry.id : s.clubId;
      this.onBracketComplete();
      return;
    }

    // La Copa Argentina sigue su curso aunque vos quedes afuera, ronda por
    // ronda y en la fecha que le toca a cada una. Si se simulara todo de una
    // acá, en marzo ya sabrías quién sale campeón en octubre.
    if (!userWon && !s.bracket.oneRoundAtATime) {
      this.simulateBracketFully();
      return;
    }

    s.bracket.stageIndex++;
    if (s.bracket.oneRoundAtATime) {
      // Copa Argentina: guardar el progreso y volver a la liga. El próximo
      // checkpoint retoma esta misma ronda del cuadro.
      s.copaBracket = { alive: s.bracket.alive, stageIndex: s.bracket.stageIndex, champion: null, runnerUp: null, historial: s.copaBracket.historial || [] };
      s.bracket = null;
      this.seguirEnLaMismaSemana();
      return;
    }
    this.resolveBracketStage();
  },

  // Simula el resto del cuadro sin intervención del usuario (no clasificó,
  // ya quedó eliminado, o le tocó un bye) y define campeón y subcampeón.
  simulateBracketFully() {
    const s = this.state;
    // La instancia se saca de cuántos siguen vivos (64 equipos = 6 rondas), así
    // no hay que llevar un contador aparte que se desincronice.
    const etapas = (s.bracket.stageNames || COPA_STAGE_NAMES).length;
    const etapaPorVivos = (vivos) => etapas - Math.round(Math.log2(vivos));
    const anotar = s.bracket.kind === 'copa'
      ? (vivos, cruces) => this.anotarRondaDeCopa(etapaPorVivos(vivos), cruces)
      : (vivos, cruces) => {
        const etapa = etapaPorVivos(vivos);
        s.bracket.historial = (s.bracket.historial || []).filter((r) => r.stageIndex !== etapa);
        this.anotarRondaDeLlave(etapa, cruces);
      };
    const result = this.simulateSeedsToChampion(s.bracket.alive, anotar);
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
      // El cuadro de la fase final queda guardado para poder mirarlo después
      // de que termine (s.bracket se limpia acá abajo).
      season.myD1[kind].historial = s.bracket.historial || [];
      season.myD1[kind].stageNames = s.bracket.stageNames;
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
      season.myD2.historial = s.bracket.historial || [];
      season.myD2.stageNames = s.bracket.stageNames;
      season.myD2.champion = s.bracket.champion;
      s.bracket = null;
      this.finishMyDivisionYear();
      return;
    }

    if (kind === 'copa') {
      s.copaBracket = { alive: [{ id: s.bracket.champion, seed: 1 }], stageIndex: s.bracket.stageIndex, champion: s.bracket.champion, runnerUp: s.bracket.runnerUp, historial: s.copaBracket.historial || [] };
      s.log.unshift(`Copa Argentina: salió campeón ${this.getClub(s.bracket.champion).name}.`);
      s.bracket = null;
      this.seguirEnLaMismaSemana();
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
      energia: ENERGIA_MAXIMA,
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
  // Reparte los 12 cupos internacionales de Argentina: 6 a la Libertadores y
  // 6 a la Sudamericana, todos los años, pase lo que pase.
  //
  // Los tres títulos del año —Apertura, Clausura y Copa Argentina— dan
  // Libertadores directo y ocupan uno de esos 6. Los que sobren se completan
  // corriendo la Tabla Anual, y el último de los 6 entra por fase previa en
  // vez de fase de grupos. Después de eso, los 6 siguientes de la Tabla Anual
  // van a la Sudamericana.
  //
  // Aparte de esos 12 está el cupo de campeón vigente: el que ganó la
  // Libertadores o la Sudamericana el año pasado juega la próxima
  // Libertadores por ese título. Ese cupo NO es de la liga, es de CONMEBOL,
  // así que no gasta ninguno de los 6 — y ahí está lo importante: si al
  // campeón además le alcanzaba la tabla, el lugar que deja se corre hacia
  // abajo y termina entrando uno más a la Sudamericana. La cuenta de 6 y 6
  // no se mueve nunca; lo que cambia es quiénes son.
  // ¿Tu club terminó en zona de descenso de la Nacional? Los dos últimos de
  // cada zona se van al Federal A. Solo se mira para tu club: los demás no se
  // mueven, porque abajo no hay una división cargada de dónde traer reemplazos
  // — y si el que baja sos vos, la carrera se terminó igual.
  seVaAlDescensoDeLaNacional(season) {
    const tabla = season.myZone === 'A' ? season.myD2.zoneATable : season.myD2.zoneBTable;
    if (!tabla || tabla.length <= DESCENSOS_POR_ZONA_D2) return false;
    const puesto = tabla.findIndex((r) => r.id === this.state.clubId) + 1;
    return puesto > 0 && puesto > tabla.length - DESCENSOS_POR_ZONA_D2;
  },

  assignQualification(d1Data, relegated, copasDelAnio) {
    const s = this.state;
    const bajaron = new Set(relegated || []);
    const assigned = new Set();
    const results = [];
    // Cuántos de los 6 cupos de liga se llevan usados. Los cupos de campeón
    // vigente no suman acá: por eso el corrimiento.
    let deLaLiga = 0;
    // El que se fue a la Nacional pierde el cupo que había ganado por tabla:
    // no puede ir a la Libertadores por haber salido quinto en una categoría
    // en la que el año que viene no juega. La excepción es el campeón de la
    // Copa Argentina, que se llevó un título y el título no se pierde por
    // descender. Es la única puerta por la que un equipo de la Nacional entra
    // a la Libertadores, y pasó de verdad: Patronato ganó la Copa Argentina
    // 2022, descendió ese mismo año y jugó la Libertadores 2023 desde la
    // Nacional.
    const grant = (clubId, comp, stage, opciones) => {
      const { peseAlDescenso, fueraDeCupo } = opciones || {};
      if (!clubId || assigned.has(clubId)) return;
      if (bajaron.has(clubId) && !peseAlDescenso) return;
      if (!this.state.clubs.some((c) => c.id === clubId)) return;
      assigned.add(clubId);
      if (!fueraDeCupo) deLaLiga++;
      results.push({ clubId, name: this.getClub(clubId).name, comp, stage });
    };

    // Primero los campeones vigentes, porque su cupo es aparte: al sacarlos
    // de la fila, la Tabla Anual se corre y entra uno más a la Sudamericana.
    ((copasDelAnio || []).filter((c) => !c.esRecopa && (c.copa === 'Libertadores' || c.copa === 'Sudamericana')))
      .forEach((c) => grant(c.championId, 'Libertadores', 'Fase de grupos', { fueraDeCupo: true }));

    grant(d1Data.aperturaChampion, 'Libertadores', 'Fase de grupos');
    grant(d1Data.clausuraChampion, 'Libertadores', 'Fase de grupos');
    grant(s.copaBracket.champion, 'Libertadores', 'Fase de grupos', { peseAlDescenso: true });

    const porTabla = d1Data.tablaAnualYear.filter((row) => !assigned.has(row.id) && !bajaron.has(row.id));
    const cuposLibertadores = Math.max(0, 6 - deLaLiga);
    porTabla.slice(0, cuposLibertadores).forEach((row, i) => {
      grant(row.id, 'Libertadores', i === cuposLibertadores - 1 ? 'Fase previa' : 'Fase de grupos');
    });
    porTabla.slice(cuposLibertadores, cuposLibertadores + 6).forEach((row) => {
      grant(row.id, 'Sudamericana', 'Fase de grupos');
    });

    // Los que quedaron en la puerta: si el año que viene alguna copa arranca
    // con un cupo sin dueño, entran estos y por este orden, que es el de la
    // Tabla Anual. Un argentino nunca entra a una copa por sorteo ni por
    // relleno: entra por cómo salió en el torneo.
    s.copaEspera = porTabla.slice(cuposLibertadores + 6).map((row) => row.id);

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
        aperturaRunnerUp: season.myD1.apertura.runnerUp,
        clausuraChampion: season.myD1.clausura.champion,
        clausuraRunnerUp: season.myD1.clausura.runnerUp,
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

    // Baja el último de la tabla de promedios y, aparte, el último de la Tabla
    // Anual que no sea ese mismo (ver tablaDePromedios). La temporada que
    // termina se suma al historial ANTES de calcular los promedios, porque
    // cuenta para ellos.
    const tablaAnualD1 = d1Data.tablaAnualYear;
    this.registrarTemporadaEnHistorial(tablaAnualD1);
    const promedios = this.tablaDePromedios(tablaAnualD1);
    const bajaPorPromedio = promedios.length ? promedios[promedios.length - 1].id : null;
    const bajaPorAnual = tablaAnualD1.slice().reverse()
      .map((row) => row.id)
      .find((id) => id !== bajaPorPromedio) || null;
    const relegated = [bajaPorPromedio, bajaPorAnual].filter(Boolean);

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
    const copasDelAnio = this.simulateCopasDelAnio(s.copaQualification)
      .concat(this.simularTitulosNacionales(d1Data));

    const qualification = this.assignQualification(d1Data, relegated, copasDelAnio);
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
      if (c.esRecopa) {
        const cobrado = Economia.premioRecopa(this, c.userWon);
        if (cobrado) notasEconomia.push(`Recopa Sudamericana: ${Economia.monto(cobrado)} por salir ${c.userWon ? 'campeón' : 'subcampeón'}.`);
        return;
      }
      // Los títulos nacionales (Campeón de Liga, Trofeo de Campeones, las dos
      // Supercopas) no tienen premio publicado, así que no pagan plata: valen
      // por el título.
      if (c.nombrePropio) return;
      const cobrado = Economia.premioInternacional(this, c.copa, c.userStage, c.userExtras);
      if (!cobrado) return;
      const ganados = (c.userExtras && c.userExtras.victoriasEnGrupos) || 0;
      const porVictorias = ganados ? ` (incluye ${ganados} ${ganados === 1 ? 'partido ganado' : 'partidos ganados'} en la fase de grupos)` : '';
      notasEconomia.push(`${c.copa}: ${Economia.monto(cobrado)} de premio por llegar a ${c.userStage}${porVictorias}.`);
    });

    const userRelegated = relegated.includes(s.clubId);
    const userPromoted = promoted.includes(s.clubId);
    const bajasteALaTercera = divisionThisSeason === 'D2' && this.seVaAlDescensoDeLaNacional(season);
    const userPromoted2 = userPromoted;
    if (bajasteALaTercera) {
      notasEconomia.push('El club se va al Federal A y la dirigencia da por terminado tu ciclo.');
    } else if (userRelegated) {
      s.anioDelDescenso = s.season.year;
      const penalty = Math.round(s.budget * 0.25);
      Economia.registrar(this, 'Recorte por el descenso', -penalty);
      notasEconomia.push(`Por el descenso, el presupuesto bajó ${Economia.monto(penalty)} para la próxima temporada.`);
    } else if (userPromoted2) {
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
      // Cuando esto es true no hay temporada siguiente: se terminó la carrera.
      carreraTerminada: bajasteALaTercera,
      temporadasDirigidas: s.season.year,
      anioDelDescenso: s.anioDelDescenso,
      economyNote,
    };

    s.squad.forEach((p) => { p.age++; p.contractYears = Math.max(0, p.contractYears - 1); });
    s.screen = 'season-end';
    this.save();
  },
};
