// Mercado de pases club por club: entrar a cualquier equipo del fútbol
// argentino, ver cómo está cada jugador de contrato y negociarlo.
//
// Dos decisiones de diseño que explican todo lo demás:
//
// 1) Los planteles rivales NO se guardan en la partida. El juego solo modela
//    de verdad el plantel propio; el resto de los clubes son una reputación.
//    Guardar 65 planteles inventados engordaría el save al pedo, así que acá
//    se generan con un generador de números pseudoaleatorios *sembrado* con
//    el id del club y el año (ver `semilla`/`generador`). Sembrado quiere
//    decir que la misma semilla da siempre exactamente la misma secuencia:
//    abrís Boca hoy, cerrás el juego, volvés mañana y está el mismo plantel,
//    sin haber guardado un solo byte. Cambia de un año al otro, como pasa en
//    la realidad. El club que sí tiene plantel real cargado (ver REAL_ROSTERS
//    en players.js) usa ese, no el generador.
//
// 2) Negociar se puede todo el año, pero **nada se firma fuera del mercado
//    de pases**. Una negociación aceptada queda como un acuerdo pendiente y
//    se concreta cuando abre la ventana (al terminar el Apertura y en la
//    pretemporada). Recién ahí se descuenta la plata y el jugador entra al
//    plantel. Así el módulo sirve todo el año sin romper la regla de que
//    solo se compra cuando el mercado está abierto.
//
// Lo único que se guarda en s.mercado son ids y los acuerdos pendientes:
// JSON puro, chico, y sobrevive al save/load como el resto del estado.

// Con menos de esto un club no puede ni poner un once y rotar, así que el
// generador lo completa con juveniles (ver `plantel`).
const PLANTEL_MINIMO = 22;

// Abajo de esto un club no vende a nadie más: ya está en el hueso.
const MIN_PLANTEL_RIVAL = 18;

const MERCADO_ESTADOS = {
  intocable: {
    label: 'Intocable',
    color: '#a78bfa',
    ayuda: 'El club no lo vende ni en broma. Solo sale si tiene cláusula y la pagás.',
  },
  retenido: {
    label: 'Retenido',
    color: '#f87171',
    ayuda: 'El club no lo quiere vender. Sale carísimo y lo más probable es que te digan que no.',
  },
  'fin-contrato': {
    label: 'Fin de contrato',
    color: '#fbbf24',
    ayuda: 'Se le termina el contrato: lo podés tentar para que firme libre, pagando solo la prima.',
  },
  transferible: {
    label: 'Transferible',
    color: '#4ade80',
    ayuda: 'El club lo escucha: con una oferta razonable, sale.',
  },
  clausula: {
    label: 'Cláusula',
    color: '#38bdf8',
    ayuda: 'Tiene cláusula de rescisión: si la pagás, el club no puede negarse.',
  },
};

// Cómo se traduce el estado que trae la investigación de cada club al estado
// que maneja el juego.
const MERCADO_ESTADO_POR_TEXTO = {
  'Intocable': 'intocable',
  'Retenido': 'retenido',
  'Transferible': 'transferible',
  'Fin de contrato cercano': 'fin-contrato',
};

const Mercado = {
  // ---------- Generador sembrado ----------
  //
  // FNV-1a para pasar de texto a número, y mulberry32 para la secuencia.
  // Los dos son cortitos, no dependen de nada y dan siempre lo mismo para la
  // misma entrada, que es todo lo que se necesita acá.

  semilla(texto) {
    let h = 2166136261;
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },

  generador(sem) {
    let a = sem;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // ---------- Estado guardado ----------

  init(s) {
    if (!s.mercado) s.mercado = {};
    const m = s.mercado;
    if (!Array.isArray(m.consultados)) m.consultados = [];
    if (!Array.isArray(m.acuerdos)) m.acuerdos = [];
    if (!Array.isArray(m.fichados)) m.fichados = [];
    if (!Array.isArray(m.rechazados)) m.rechazados = [];
    if (!m.respuestas) m.respuestas = {};
    return m;
  },

  // Las respuestas de los clubes son solo texto para mostrar; se podan para
  // que el save no crezca sin límite en una carrera larga.
  guardarRespuesta(s, jugadorId, texto) {
    const m = this.init(s);
    const claves = Object.keys(m.respuestas);
    if (claves.length > 60) claves.slice(0, claves.length - 40).forEach((k) => { delete m.respuestas[k]; });
    m.respuestas[jugadorId] = texto;
  },

  // ---------- Clubes que se pueden mirar ----------
  //
  // El club propio queda afuera: el plantel propio se maneja desde la pestaña
  // Plantel y desde el mercado de pases cuando abre.

  clubes(engine) {
    const s = engine.state;
    return s.clubs
      .filter((c) => c.id !== s.clubId)
      .slice()
      .sort((a, b) => (a.division === b.division ? a.name.localeCompare(b.name, 'es') : a.division < b.division ? -1 : 1));
  },

  // ---------- Plantel de un club ----------

  // Cuántos meses faltan para que se termine la temporada (y con ella los
  // contratos que vencen). Se calcula sobre el mismo almanaque fijo que usa
  // la fecha del calendario, sin objetos Date.
  // `anio` hace falta para que febrero mida lo que mide: sin él, en un año
  // bisiesto el recorrido se corre un día y el cambio de mes puede caer un
  // día antes de lo que corresponde.
  mesesHastaFinDeTemporada(dayCount, anio) {
    let day = CALENDAR_START_DAY + (dayCount || 0);
    let month = CALENDAR_START_MONTH;
    let corrido = 0;
    while (day > diasDelMes(month, anio == null ? undefined : anio + corrido)) {
      day -= diasDelMes(month, anio == null ? undefined : anio + corrido);
      month = (month + 1) % 12;
      if (month === 0) corrido++;
    }
    const faltan = (11 - month + 12) % 12; // hasta diciembre
    return Math.max(1, faltan);
  },

  // ---------- Las ofertas que te llegan a vos ----------
  //
  // Hasta acá los rivales se movían entre ellos y tu plantel era intocable:
  // podías quedarte con tu 9 de 85 para siempre y nadie iba a venir a
  // buscarlo. Eso es media historia menos, y es la mitad que más duele.
  //
  // Ahora, en cada ventana, los clubes que te miran hacen una oferta por
  // alguno de tus mejores. Puede venir de un club argentino —y entonces el
  // jugador pasa a jugar ahí, y te lo vas a cruzar— o de afuera, que paga
  // bastante más y se lo lleva del país.
  MAX_OFERTAS_POR_VENTANA: 3,
  // Cuántos de los que VOS ofreciste pueden recibir oferta en la misma
  // ventana. Va aparte del tope de arriba, que es para el resto del plantel.
  MAX_OFERTAS_DE_LOS_MARCADOS: 5,

  // ---------- Lo que vos decidís con cada jugador tuyo ----------
  //
  // Antes había un botón de "vender" al lado de cada jugador y salía al toque,
  // como si un club pudiera poner a cualquiera en la vidriera y cobrarlo el
  // mismo día. No funciona así: vos marcás la postura del club y las ofertas
  // llegan (o no). Lo único que sí podés hacer solo es rescindirle el
  // contrato, y eso cuesta plata en vez de darte.
  ESTADOS_PROPIOS: {
    retenido: {
      label: 'No se vende',
      corto: 'No se vende',
      ayuda: 'El club no lo pone en el mercado. Igual pueden venir a buscarlo, pero tienen que pagar mucho más.',
    },
    transferible: {
      label: 'Transferible',
      corto: 'Transferible',
      ayuda: 'Avisás que lo escuchás. Llegan más ofertas y por un precio cercano a lo que vale.',
    },
    prestamo: {
      label: 'A préstamo',
      corto: 'Préstamo',
      ayuda: 'Lo ofrecés cedido para que sume minutos en otro lado. Las ofertas son de préstamo, no de compra.',
    },
  },

  // ¿Está a préstamo? Hay dos maneras de saberlo y hasta acá el juego miraba
  // una sola. `loanFrom` es la de los préstamos que ocurren jugando (sabemos
  // de qué club salió). `loanUntil` es la de los planteles investigados: la
  // base de SoFIFA dice hasta cuándo está cedido pero no de qué club es, así
  // que el dueño queda vacío. Los 134 cedidos de la liga argentina entran por
  // ahí, y sin esto el filtro "a préstamo" del mercado no devolvía a nadie.
  estaCedido(j) {
    return !!(j && (j.loanFrom || j.loanUntil));
  },

  estadoPropio(p) {
    return (p && p.mercado) || 'retenido';
  },

  // Qué tan mirado está cada jugador tuyo. Un pibe de 70 con techo 85 interesa
  // más que un 74 de 31 años.
  atractivoDe(p) {
    const techo = p.potential || p.rating;
    return p.rating + Math.max(0, techo - p.rating) * (p.age <= 23 ? 1.2 : 0.3) - Math.max(0, p.age - 29) * 2;
  },

  ofertasPorTusJugadores(engine) {
    const s = engine.state;
    if (!s.squad || s.squad.length <= 15) return [];
    const club = engine.getClub(s.clubId);

    // Los que ofreciste a préstamo van por otro camino: por ellos no llegan
    // ofertas de compra.
    // Por el último arquero no llega ninguna oferta. Se corta acá y no solo
    // al resolverla: un club no va a ir a buscar al único arquero de otro
    // sabiendo que no se lo van a vender, y así el usuario tampoco ve una
    // oferta que no puede aceptar.
    const enVenta = s.squad
      .filter((p) => this.estadoPropio(p) !== 'prestamo')
      .filter((p) => !engine.esUltimoArquero(s.squad, p));
    const conAtractivo = (lista) => lista.map((p) => ({ p, atractivo: this.atractivoDe(p) }));

    // Los que vos ofreciste se miran aunque no sean figuras: es justamente lo
    // que hace que suene el teléfono. Y van primero, para que marcarlos sirva
    // de algo: antes la lista salía de los ocho más codiciados del plantel y
    // por ahí no entraba ninguno (con un plantel lleno de pibes con techo
    // alto, un 81 de 32 años no aparecía nunca, lo pusieras como lo pusieras).
    //
    // Cada transferible tira su propia moneda y NO comparte cupo con el resto
    // del plantel: si ponés seis en la lista, el teléfono suena seis veces más
    // (hasta el tope de abajo). Antes todos entraban en el mismo cupo de tres
    // y marcar a más gente no cambiaba casi nada.
    const ofrecidos = engine.shuffled(conAtractivo(enVenta.filter((p) => this.estadoPropio(p) === 'transferible'))
      .filter((x) => x.atractivo >= 52)).slice(0, this.MAX_OFERTAS_DE_LOS_MARCADOS);
    const resto = engine.shuffled(conAtractivo(enVenta.filter((p) => this.estadoPropio(p) !== 'transferible'))
      .filter((x) => x.atractivo >= 63)
      .sort((a, b) => b.atractivo - a.atractivo)
      .slice(0, 8)).slice(0, this.MAX_OFERTAS_POR_VENTANA);
    const deseables = ofrecidos.concat(resto);
    if (!deseables.length) return [];

    const ofertas = [];
    deseables.forEach(({ p, atractivo }) => {
      const estado = this.estadoPropio(p);
      // Cuanto más te lo quieren, más chances de que la oferta exista. Que lo
      // pongas en la lista de transferibles es justamente lo que hace que
      // suene el teléfono; que digas que no se vende no lo protege del todo,
      // pero espanta a la mayoría.
      let chance = Math.min(0.8, (atractivo - 54) / 28);
      if (estado === 'transferible') chance = Math.min(0.95, chance * 2 + 0.35);
      else chance *= 0.5;
      if (Math.random() > chance) return;
      const comprador = this.compradorPara(engine, p, club);
      if (!comprador) return;
      const valor = engine.valueOf(p);

      // La cláusula de rescisión: si la pagan, no hay nada que discutir. Es
      // poco frecuente y solo la pagan por alguien que vale la pena.
      const clausula = p.clause || 0;
      if (clausula && clausula >= valor && Math.random() < (comprador.extranjero ? 0.18 : 0.07)) {
        ofertas.push({
          tipo: 'clausula',
          playerId: p.id, nombre: p.name, rating: p.rating, edad: p.age,
          club: comprador,
          monto: clausula,
          obligatoria: true,
        });
        return;
      }

      // Lo que pagan. De afuera pagan más (se lo llevan del país y compiten
      // con otros), y por alguien que NO está en venta hay que poner mucho
      // más arriba de lo que vale para que el club se siente a escuchar.
      let factor = comprador.extranjero ? 1.3 + Math.random() * 0.6 : 0.95 + Math.random() * 0.45;
      if (estado === 'retenido') factor *= 1.35;
      else if (estado === 'transferible') factor *= 0.92;
      ofertas.push({
        tipo: 'compra',
        playerId: p.id,
        nombre: p.name,
        rating: p.rating,
        edad: p.age,
        club: comprador,
        monto: Math.round(valor * factor),
      });
    });
    return ofertas;
  },

  // ---------- Las ofertas de préstamo ----------
  //
  // Por los que marcaste "a préstamo". Vienen en las tres formas que se usan
  // de verdad: seis meses, un año, o un año con obligación de compra (que es
  // una venta en cuotas: se va ahora y la plata entra cuando termina).
  MODALIDADES_DE_PRESTAMO: [
    { id: 'seis-meses', label: 'por seis meses', ventanas: 1 },
    { id: 'un-anio', label: 'por un año', ventanas: 2 },
    { id: 'compra-obligatoria', label: 'por un año con obligación de compra', ventanas: 2 },
  ],

  ofertasDePrestamo(engine) {
    const s = engine.state;
    const club = engine.getClub(s.clubId);
    const ofrecidos = (s.squad || []).filter((p) => this.estadoPropio(p) === 'prestamo');
    if (!ofrecidos.length) return [];

    const ofertas = [];
    engine.shuffled(ofrecidos).slice(0, this.MAX_OFERTAS_DE_LOS_MARCADOS).forEach((p) => {
      // A un préstamo se prende casi cualquiera, salvo que el jugador no le
      // sirva a nadie.
      if (Math.random() > Math.min(0.92, 0.5 + (p.rating - 58) / 40)) return;
      const club2 = this.clubParaPrestamo(engine, p, club);
      if (!club2) return;
      const modalidad = this.MODALIDADES_DE_PRESTAMO[Math.floor(Math.random() * this.MODALIDADES_DE_PRESTAMO.length)];
      const valor = engine.valueOf(p);
      // El cargo por el préstamo es chico: lo que importa es que el otro club
      // le paga el sueldo mientras esté allá.
      const cargo = Math.round(valor * (0.02 + Math.random() * 0.06));
      ofertas.push({
        tipo: 'prestamo',
        playerId: p.id,
        nombre: p.name,
        rating: p.rating,
        edad: p.age,
        club: club2,
        modalidad: modalidad.id,
        modalidadLabel: modalidad.label,
        ventanas: modalidad.ventanas,
        monto: cargo,
        compra: modalidad.id === 'compra-obligatoria' ? Math.round(valor * (0.85 + Math.random() * 0.35)) : 0,
      });
    });
    return ofertas;
  },

  // ---------- La contraoferta ----------
  //
  // Aceptar o rechazar dejaba afuera lo que más se hace en un pase: sentarse a
  // discutir una condición. Es una sola: la que más pesa en esa oferta. Si te
  // dicen que no, la oferta original sigue arriba de la mesa —no perdés nada
  // por preguntar, más allá de que se te caiga la ilusión.
  contraofertaPara(oferta) {
    if (!oferta || oferta.obligatoria || oferta.negociada) return null;
    if (oferta.tipo === 'prestamo') {
      if (oferta.modalidad === 'compra-obligatoria') {
        return {
          id: 'sin-obligacion',
          label: 'Pedir que sea sin obligación de compra',
          nota: 'Mismo préstamo por un año, pero al final vuelve a tu club.',
        };
      }
      if (oferta.modalidad === 'un-anio') {
        return {
          id: 'mas-corto',
          label: 'Pedir que sea por seis meses',
          nota: 'Lo tenés de vuelta en la próxima ventana.',
        };
      }
      return {
        id: 'mas-cargo',
        label: 'Pedir más plata por la cesión',
        nota: 'El préstamo es el mismo, pero te pagan más por prestarlo.',
      };
    }
    return {
      id: 'mas-plata',
      label: 'Pedir más plata',
      nota: 'Le decís que así no, a ver si estiran la oferta.',
    };
  },

  // La respuesta del otro club. Devuelve { ok, texto } y, si aceptaron, la
  // oferta que se está mirando queda modificada en el lugar.
  responderContraoferta(engine, oferta) {
    const pedido = this.contraofertaPara(oferta);
    if (!pedido) return null;
    oferta.negociada = true;
    const club = oferta.club.nombre;

    if (pedido.id === 'sin-obligacion') {
      // La obligación de compra es justamente lo que fueron a buscar, así que
      // acá te dicen que no bastante seguido.
      if (Math.random() < 0.45) {
        oferta.modalidad = 'un-anio';
        oferta.modalidadLabel = 'por un año';
        oferta.compra = 0;
        oferta.monto = Math.round(oferta.monto * 0.8);
        return { ok: true, texto: `${club} acepta: préstamo por un año, sin obligación de compra. Bajan un poco el cargo.` };
      }
      return { ok: false, texto: `${club} no afloja: lo quieren con la compra obligatoria o no hay préstamo.` };
    }

    if (pedido.id === 'mas-corto') {
      if (Math.random() < 0.55) {
        oferta.modalidad = 'seis-meses';
        oferta.modalidadLabel = 'por seis meses';
        oferta.ventanas = 1;
        oferta.monto = Math.round(oferta.monto * 0.65);
        return { ok: true, texto: `${club} acepta: se lo llevan por seis meses.` };
      }
      return { ok: false, texto: `${club} lo quiere todo el año: dicen que por seis meses no les sirve.` };
    }

    if (pedido.id === 'mas-cargo') {
      if (Math.random() < 0.5) {
        oferta.monto = Math.round(oferta.monto * 1.6);
        return { ok: true, texto: `${club} acepta pagar más por la cesión.` };
      }
      return { ok: false, texto: `${club} dice que no le da el presupuesto para pagar más.` };
    }

    // Plata por una compra. Cuanto más arriba del valor está ya la oferta,
    // menos margen les queda: por alguien que ya pagaron caro no estiran más.
    const jugador = (engine.state.squad || []).find((p) => p.id === oferta.playerId);
    const valor = jugador ? engine.valueOf(jugador) : oferta.monto;
    const sobre = oferta.monto / Math.max(1, valor) - 1;
    const chance = Math.max(0.12, Math.min(0.8, 0.65 - sobre * 0.5));
    if (Math.random() < chance) {
      const subida = 1.15 + Math.random() * 0.2;
      oferta.monto = Math.round(oferta.monto * subida);
      return { ok: true, texto: `${club} mejora la oferta: ahora ponen ${this.plata(oferta.monto)}.` };
    }
    return { ok: false, texto: `${club} dice que es lo máximo que pueden pagar. La oferta sigue en pie.` };
  },

  // A quién se lo prestás: un club más chico que el tuyo, que es donde un
  // jugador va a buscar los minutos que no tiene en tu equipo.
  clubParaPrestamo(engine, jugador, club) {
    const s = engine.state;
    const clasicos = typeof CLASICOS !== 'undefined' ? CLASICOS : [];
    const esClasico = (id) => clasicos.some((par) => par.includes(id) && par.includes(s.clubId));
    const candidatos = s.clubs.filter((c) => c.id !== s.clubId
      && !esClasico(c.id)
      && c.reputation <= club.reputation);
    if (!candidatos.length) return null;
    const c = engine.shuffled(candidatos)[0];
    return { id: c.id, nombre: c.name, pais: 'Argentina', extranjero: false };
  },

  // Quién viene a buscarlo. Un jugador bueno interesa a un club más grande que
  // el tuyo; uno muy bueno, a uno de afuera. Nunca lo viene a buscar un club
  // más chico: esos no pagan.
  compradorPara(engine, jugador, club) {
    const s = engine.state;
    const deAfuera = typeof CLUBES_INTERNACIONALES !== 'undefined' ? CLUBES_INTERNACIONALES : [];
    // Los de afuera aparecen solo por jugadores que valen la pena, y más
    // seguido cuanto mejor es el jugador.
    if (deAfuera.length && jugador.rating >= 72 && Math.random() < (jugador.rating - 68) / 16) {
      const nivelQueLoQuiere = jugador.rating >= 80 ? 4 : 3;
      const candidatos = deAfuera.filter((c) => c.nivel >= nivelQueLoQuiere);
      if (candidatos.length) {
        const c = engine.shuffled(candidatos)[0];
        return { id: c.id, nombre: c.nombre, pais: c.pais, extranjero: true };
      }
    }
    // Entre clásicos no se venden jugadores. Que River viniera a comprarle un
    // pibe a Boca rompía la ilusión más que cualquier otra cosa del mercado.
    const clasicos = typeof CLASICOS !== 'undefined' ? CLASICOS : [];
    const esClasico = (id) => clasicos.some((par) => par.includes(id) && par.includes(s.clubId));
    const argentinos = s.clubs.filter((c) => c.id !== s.clubId
      && c.division === 'D1'
      && !esClasico(c.id)
      && c.reputation >= club.reputation - 1);
    if (!argentinos.length) return null;
    const c = engine.shuffled(argentinos)[0];
    return { id: c.id, nombre: c.name, pais: 'Argentina', extranjero: false };
  },

  // ---------- El mercado de los otros clubes ----------
  //
  // Una vez por ventana de pases, los clubes rivales se compran y se venden
  // jugadores entre ellos. Es la primera vez que pasa algo en el juego sin que
  // el usuario lo haga: hasta acá el único que se movía era vos.
  //
  // Es a propósito una IA simple: el club que compra es uno sorteado con peso
  // en su reputación (los grandes se mueven más), y lo que busca es un jugador
  // que lo mejore de verdad, que su club esté dispuesto a soltar. No hay
  // presupuesto, ni necesidades por puesto, ni política de fichajes: eso es el
  // nivel siguiente. Esto es que el mundo deje de estar quieto.
  TRANSFERENCIAS_POR_VENTANA: 9,

  mercadoDeLosRivales(engine) {
    const s = engine.state;
    const anio = s.season ? s.season.year : 1;
    const clubes = s.clubs.filter((c) => c.id !== s.clubId);
    if (clubes.length < 4) return [];

    // Bolillero de compradores: la reputación al cuadrado, así un grande se
    // mueve mucho más seguido que uno chico, pero ninguno queda afuera.
    const bolillero = [];
    clubes.forEach((c) => {
      const bolillas = Math.max(1, c.reputation * c.reputation);
      for (let i = 0; i < bolillas; i++) bolillero.push(c);
    });

    const hechas = [];
    const tocados = new Set();
    for (let i = 0; i < this.TRANSFERENCIAS_POR_VENTANA; i++) {
      const comprador = bolillero[Math.floor(Math.random() * bolillero.length)];
      if (tocados.has(comprador.id)) continue;
      const suyo = this.plantel(engine, comprador.id);
      if (!suyo.length || suyo.length >= 30) continue;
      // El nivel que ya tiene: solo tiene sentido comprar a alguien mejor.
      const ordenado = suyo.slice().sort((a, b) => b.rating - a.rating);
      const nivel = ordenado.slice(0, 11).reduce((a, p) => a + p.rating, 0) / Math.min(11, ordenado.length);

      // Se miran tres clubes al azar, no los 65: armar un plantel cuesta.
      const vendedores = engine.shuffled(clubes.filter((c) => c.id !== comprador.id && !tocados.has(c.id))).slice(0, 3);
      let mejor = null;
      vendedores.forEach((vendedor) => {
        const plantel = this.plantel(engine, vendedor.id);
        if (plantel.length <= MIN_PLANTEL_RIVAL) return;
        const suyas = plantel.slice().sort((a, b) => b.rating - a.rating);
        // Las dos figuras no se venden: un club no se desarma solo.
        suyas.slice(2).forEach((j) => {
          if (this.estaCedido(j) || j.rating <= nivel) return;
          // Tampoco entre ellos: ningún club vende a su último arquero.
          if (engine.esUltimoArquero(plantel, j)) return;
          const ganancia = j.rating - nivel;
          if (!mejor || ganancia > mejor.ganancia) mejor = { jugador: j, vendedor, ganancia };
        });
      });
      if (!mejor) continue;

      this.transferir(s, mejor.jugador, mejor.vendedor.id, comprador.id, anio);
      tocados.add(comprador.id);
      tocados.add(mejor.vendedor.id);
      hechas.push({ jugador: mejor.jugador, de: mejor.vendedor, a: comprador });
    }

    // La fuerza de los clubes que se movieron cambió: hay que recalcularla.
    if (hechas.length) engine._fuerzas = {};
    if (typeof Noticias !== 'undefined') Noticias.trasElMercadoDeLosRivales(engine, hechas);
    return hechas;
  },

  // ---------- Jugadores libres ----------
  //
  // Antes la pantalla del mercado ofrecía cinco jugadores inventados en el
  // momento: no existían en ningún lado, no tenían club ni pasado, y aparecían
  // y desaparecían solos. Ahora lo que se ofrece son jugadores LIBRES de
  // verdad: veteranos a los que un club del país no les renovó y quedaron sin
  // equipo. Salen del mismo mundo que todo lo demás, así que se los puede
  // haber visto jugar el año pasado.
  //
  // Cuestan cero de pase: lo único que se paga es el sueldo. Por eso los que
  // quedan libres son los que un club dejaría ir de verdad —grandes de edad y
  // de los más flojos del plantel— y no figuras: un 80 gratis rompería el
  // juego.
  LIBRES_POR_VENTANA: 3,
  LIBRES_MAXIMO: 8,
  // Cuántas ventanas se queda un libre sin equipo antes de que se lo lleve
  // otro o se retire.
  VENTANAS_SIN_EQUIPO: 2,

  libres(s) {
    if (!s.libres) s.libres = [];
    return s.libres;
  },

  // El jugador libre como se ve HOY: envejece igual que cualquier fichaje.
  jugadorLibre(engine, j) {
    const anio = engine.state.season ? engine.state.season.year : 1;
    return { ...this.jugadorFichado(engine, j, anio), desdeClub: j.desdeClub, id: j.id };
  },

  // Se ejecuta al abrir cada ventana: primero se van los que llevaban mucho
  // tiempo sin club y después algunos clubes sueltan gente.
  liberarJugadores(engine) {
    const s = engine.state;
    const anio = s.season ? s.season.year : 1;
    const lista = this.libres(s);

    // Los que nadie fichó: se los llevó otro o colgaron los botines.
    for (let i = lista.length - 1; i >= 0; i--) {
      lista[i].ventanas = (lista[i].ventanas || 0) + 1;
      if (lista[i].ventanas > this.VENTANAS_SIN_EQUIPO) lista.splice(i, 1);
    }

    // Los clubes se miran por reputación y no al azar: si se sortearan parejo,
    // los libres salían casi siempre del ascenso y con 45 de valoración, o sea
    // que no le servían a nadie. Un club grande suelta gente más seguido y la
    // que suelta sirve.
    const bolillero = [];
    s.clubs.filter((c) => c.id !== s.clubId).forEach((c) => {
      for (let i = 0; i < Math.max(1, c.reputation * c.reputation); i++) bolillero.push(c);
    });
    if (!bolillero.length) return lista;

    const tocados = new Set();
    let sueltos = 0;
    for (let intento = 0; intento < 60 && sueltos < this.LIBRES_POR_VENTANA; intento++) {
      if (lista.length >= this.LIBRES_MAXIMO) break;
      const club = bolillero[Math.floor(Math.random() * bolillero.length)];
      if (tocados.has(club.id)) continue;
      const plantel = this.plantel(engine, club.id);
      if (plantel.length <= MIN_PLANTEL_RIVAL) continue;
      // El que un club deja ir es grande y está en la mitad floja del plantel:
      // ni la figura ni el peor de todos. Primero los que se les termina el
      // contrato, que es como pasa de verdad.
      const flojos = plantel.slice().sort((a, b) => a.rating - b.rating)
        .slice(0, Math.ceil(plantel.length / 2))
        .filter((j) => !this.estaCedido(j) && j.age >= 30);
      // Un club no suelta a su último arquero: se quedaría sin nadie al arco.
      const libera = flojos.filter((j) => !engine.esUltimoArquero(plantel, j));
      const candidato = libera.find((j) => (j.contractYears || 3) <= 1) || libera.find((j) => j.age >= 33);
      if (!candidato) continue;
      tocados.add(club.id);
      this.movimientosDe(s, club.id).fuera.push(candidato.id);
      lista.push({
        id: candidato.id,
        name: candidato.name,
        pos: candidato.pos,
        posDetail: candidato.posDetail,
        nation: candidato.nation,
        role: candidato.role,
        projection: candidato.projection,
        ratingBase: candidato.rating,
        edadBase: candidato.age,
        birthDate: candidato.birthDate,
        edadAlLlegar: candidato.edadAlLlegar,
        temporadaAlLlegar: candidato.temporadaAlLlegar,
        contractYears: 1,
        desdeAnio: anio,
        desdeClub: club.id,
        ventanas: 0,
      });
      sueltos++;
    }
    // Los planteles que soltaron gente cambiaron de fuerza.
    if (sueltos) engine._fuerzas = {};
    return lista;
  },

  // ---------- Lo que se movió en el mundo ----------
  //
  // Los planteles rivales salen de un generador sembrado y no se guardan (ver
  // la cabecera del archivo). Pero si nunca se guardara NADA, el mundo no
  // podría moverse: un club no podría vender ni comprar, y el pibe que viste
  // el año pasado en Vélez estaría ahí para siempre.
  //
  // La solución es guardar solo la DIFERENCIA contra lo sembrado: a quién se
  // le fue y quién le llegó. Son dos listas cortas por club, así que después
  // de veinte temporadas el guardado sigue siendo chico.
  movimientosDe(s, clubId) {
    if (!s.mundo) s.mundo = {};
    if (!s.mundo[clubId]) s.mundo[clubId] = { fuera: [], dentro: [] };
    return s.mundo[clubId];
  },

  // Un jugador que llegó a un club por transferencia. Se guarda con su
  // valoración y edad del día que llegó, y de ahí en más envejece y evoluciona
  // solo, igual que los sembrados: si se guardara la valoración a secas, el
  // fichaje quedaría congelado para siempre.
  jugadorFichado(engine, j, anio) {
    const anios = Math.max(0, anio - (j.desdeAnio || anio));
    // La fecha de nacimiento es del JUGADOR, no del club: viaja con él en
    // cada pase. Si no la tiene (un jugador de plantel real), viaja el reloj
    // grueso: la edad que tenía el año que se movió.
    const edad = {
      birthDate: j.birthDate,
      edadAlLlegar: j.edadAlLlegar != null ? j.edadAlLlegar : j.edadBase,
      temporadaAlLlegar: j.temporadaAlLlegar != null ? j.temporadaAlLlegar : (j.desdeAnio || 1),
    };
    return {
      id: j.id,
      name: j.name,
      pos: j.pos,
      posDetail: j.posDetail,
      nation: j.nation,
      role: j.role,
      projection: j.projection,
      birthDate: j.birthDate,
      edadAlLlegar: edad.edadAlLlegar,
      temporadaAlLlegar: edad.temporadaAlLlegar,
      age: engine.edadDe(edad),
      rating: this.ratingConLosAnios(j.ratingBase, j.edadBase, j.projection || j.ratingBase, anios),
      contractYears: Math.max(1, (j.contractYears || 3) - anios),
    };
  },

  // Pasa un jugador de un club a otro, dejando anotado el movimiento en los
  // dos lados.
  transferir(s, jugador, deClubId, aClubId, anio) {
    this.movimientosDe(s, deClubId).fuera.push(jugador.id);
    this.movimientosDe(s, aClubId).dentro.push({
      id: jugador.id,
      name: jugador.name,
      pos: jugador.pos,
      posDetail: jugador.posDetail,
      nation: jugador.nation,
      role: jugador.role,
      projection: jugador.projection,
      ratingBase: jugador.rating,
      edadBase: jugador.age,
      // Lo que hace falta para saber su edad en cualquier momento. La fecha
      // de nacimiento no cambia de dueño con el pase.
      birthDate: jugador.birthDate,
      edadAlLlegar: jugador.edadAlLlegar,
      temporadaAlLlegar: jugador.temporadaAlLlegar,
      contractYears: 3,
      desdeAnio: anio,
    });
  },

  plantel(engine, clubId) {
    const s = engine.state;
    const m = this.init(s);
    const club = engine.getClub(clubId);
    if (!club) return [];
    const anio = s.season ? s.season.year : 1;
    // La semilla va SOLO con el id del club, sin el año. Antes llevaba el año
    // y el plantel entero se rehacía en cada temporada: leías en el diario
    // sobre una joya de otro club, pasaba el año y ese jugador no existía
    // más. Con la semilla fija, el plantel es el mismo siempre y lo que
    // cambia con los años es cada jugador: envejece y evoluciona hacia su
    // techo, igual que los tuyos. Así se puede seguir a un pibe de una
    // temporada a la otra, que es de lo que se trata.
    const rnd = this.generador(this.semilla(clubId));
    const aniosPasados = Math.max(0, anio - 1);
    const meses = this.mesesHastaFinDeTemporada(s.calendar ? s.calendar.dayCount : 0, anioDeTemporada(anio));

    const real = typeof REAL_ROSTERS !== 'undefined' && REAL_ROSTERS[clubId];
    // Los planteles investigados también corren los años: envejecen, crecen
    // hacia su proyección y se retiran, igual que los generados. Sin esto,
    // Boca y River quedaban congelados en su plantel de 2026 para siempre:
    // en la temporada 15 seguían con los mismos jugadores y la misma edad,
    // y eran los dos únicos clubes del juego que no podían ni crecer ni caer.
    const base = real && real.length >= 11
      ? real.map((p, i) => ({
        id: `${clubId}-r${i}`,
        name: p.name, pos: p.pos, posDetail: p.posDetail, altPosDetail: p.altPosDetail,
        // La edad la calcula el motor contra el almanaque (ver Engine.edadDe).
        // De estos jugadores todavía no tenemos la fecha de nacimiento real
        // —y no se inventa—, así que se les anota con qué edad entraron y en
        // qué temporada, que es el reloj grueso del que habla ese comentario.
        // `aniosPasados` sigue usándose para la valoración, que sí depende de
        // los años que corrieron, pero ya no para la edad.
        birthDate: p.birthDate,
        edadAlLlegar: p.age,
        temporadaAlLlegar: 1,
        age: engine.edadDe({ birthDate: p.birthDate, edadAlLlegar: p.age, temporadaAlLlegar: 1 }),
        rating: this.ratingConLosAnios(p.rating, p.age, p.projection ?? p.rating, aniosPasados),
        projection: p.projection,
        nation: p.nation,
        // El contrato corre y, si se venció, el club lo renueva.
        contractYears: Math.max(1, (p.contractYears || 1) - (aniosPasados % Math.max(1, p.contractYears || 1))),
        role: p.role, loanFrom: p.loanFrom, loanUntil: p.loanUntil,
        // El valor y el sueldo investigados valen para el plantel de hoy. Con
        // los años la valoración cambia, así que el valor se recalcula solo
        // (ver más abajo) y el sueldo se deja como referencia del contrato.
        value: aniosPasados ? undefined : p.value,
        salary: p.salary, clause: aniosPasados ? undefined : p.clause,
        transferState: p.transferState,
      }))
      : (() => {
        // Dos clubes de la misma reputación tenían plantel del mismo nivel
        // exacto: la media de once jugadores lavaba cualquier diferencia y
        // Platense y Riestra daban el mismo número hasta el decimal. Este
        // sorteo —uno por club, sembrado, siempre el mismo— hace que adentro
        // de cada reputación haya clubes mejor y peor armados, que es lo que
        // pasa de verdad y lo que hace que la tabla no tenga siempre la
        // misma forma.
        // Los 36 de la Nacional tienen su nivel cargado uno por uno (ver
        // NACIONAL_DATOS en data.js); el resto sigue saliendo de la
        // reputación, con el sorteo sembrado de siempre para que dos clubes
        // de la misma reputación no den el mismo número hasta el decimal.
        const cargado = engine.sesgoDeLaNacional ? engine.sesgoDeLaNacional(club) : null;
        const nivelDelClub = cargado
          ? cargado.base + (rnd() * 2 - 1)
          : 44 + club.reputation * 6 + (rnd() * 6 - 3);
        return SQUAD_POSITIONS.map((pos, i) => {
        // Un club con más defensa que ataque arma mejores defensores que
        // delanteros. El mediocampo se lleva la mitad de cada cosa.
        let sesgo = 0;
        if (cargado) {
          if (pos === 'DEF' || pos === 'POR') sesgo = cargado.defensa;
          else if (pos === 'DEL') sesgo = cargado.ataque;
          else sesgo = (cargado.ataque + cargado.defensa) / 2;
        }
        const promedio = nivelDelClub + sesgo;
        const ratingBase = Math.max(35, Math.min(90, Math.round(promedio + (rnd() * 16 - 8))));
        const edadBase = Math.round(17 + rnd() * 18);
        const nation = this.nacionSembrada(rnd);
        const techo = engine.computePotential(ratingBase, edadBase, club, rnd);
        const contratoBase = 1 + Math.floor(rnd() * 4);
        // Este jugador no existe, así que su fecha de nacimiento sí se
        // inventa: sale del id (no del sorteo sembrado, para no correr la
        // secuencia y cambiar los planteles de las partidas ya empezadas) y
        // de la edad que tenía en la temporada 1.
        const id = `${clubId}-g${i}`;
        const nacimiento = engine.fechaDeNacimientoSembrada(id, edadBase, engine.fechaDeJuegoDeLaTemporada(1));
        return {
          id,
          name: this.nombreSembrado(rnd, nation),
          pos, nation,
          birthDate: nacimiento,
          age: engine.edadDe({ birthDate: nacimiento }),
          rating: this.ratingConLosAnios(ratingBase, edadBase, techo, aniosPasados),
          projection: techo,
          // El contrato corre: si ya venció, se le renueva por otras tantas.
          contractYears: Math.max(1, contratoBase - (aniosPasados % Math.max(1, contratoBase))),
          role: pos === 'MED' ? ['contención', 'mixto', 'ofensivo'][Math.floor(rnd() * 3)] : undefined,
        };
        });
      })();

    // Los que se pasaron de edad se retiran y dejan el lugar libre. Vale para
    // los dos caminos: un plantel investigado también se queda sin sus
    // veteranos a medida que pasan las temporadas.
    //
    // Y acá se aplica lo que se movió de verdad: los que el club vendió (o le
    // compraste vos) salen, y los que compró entran. Eso es lo único que se
    // guarda en la partida — el resto del plantel sigue saliendo de la
    // semilla, así que el guardado no engorda por más años que pasen.
    const movimientos = this.movimientosDe(s, clubId);
    // `fuera` tiene que filtrar las DOS fuentes, no solo la sembrada. Un
    // jugador que llegó por transferencia entra por `dentro`; si después lo
    // transfieren de nuevo, su id se anota en el `fuera` de este club, pero
    // seguía estando en su `dentro` y por eso aparecía en los dos clubes a la
    // vez. En una cadena A -> B -> C -> D quedaba en B, en C y en D.
    //
    // Medido antes del arreglo: 60 jugadores en dos clubes a la vez después
    // de 12 temporadas, y creciendo.
    //
    // Y el retiro tiene que filtrar las DOS fuentes, por lo mismo. Antes el
    // control estaba solo arriba, sobre `base`: el que llegaba por
    // transferencia no pasaba por ninguno y envejecía para siempre. Medido:
    // José Sosa, transferido con 40 años, seguía jugando con 53.
    //
    // El filtro va DESPUÉS de `jugadorFichado` y no sobre la entrada cruda de
    // `dentro`, porque la entrada cruda no guarda `age` sino `edadBase` y
    // `desdeAnio`: preguntarle la edad a eso daría cero y no se retiraría
    // nunca ninguno. `jugadorFichado` es el que resuelve la edad, y lo que
    // devuelve tiene la misma forma que un jugador de `base`, así que la
    // pregunta es exactamente la misma para los dos lados.
    const seFue = (id) => movimientos.fuera.includes(id);
    const vivos = base
      .filter((p) => !engine.yaSeRetiro(p) && !seFue(p.id))
      .concat(movimientos.dentro
        .filter((j) => !seFue(j.id))
        .map((j) => this.jugadorFichado(engine, j, anio))
        .filter((p) => !engine.yaSeRetiro(p)));

    // ---------- La red del arquero ----------
    //
    // Todas las salidas ya se cuidan de no dejar a un club sin arquero, pero
    // los retiros se acumulan solos con los años y no pasan por ninguna de
    // ellas: un club con dos arqueros veteranos los pierde a los dos y queda
    // en cero. Medido antes de esto: 19 veces en 20 temporadas.
    //
    // Si pasa, el arquero más joven de los que se habían retirado sigue un
    // año más, igual que hace tu club (ver procesarRetiros). No se inventa un
    // jugador: se usa uno que ya existía en el plantel investigado.
    //
    // Y se prefiere a uno que NO esté anunciado como retirado. Si no se mira
    // eso, la red termina rescatando a alguien que el diario ya despidió hace
    // temporadas y queda jugando y retirado a la vez (B2-04). Es solo una
    // preferencia: si no hubiera ningún otro, vuelve igual, porque un club
    // con cero arqueros es un estado imposible y eso pesa más. En ese caso el
    // asiento se limpia al cerrar la temporada (ver Engine.procesarRetiros).
    if (!engine.cuantosArqueros(vivos)) {
      const candidatos = base
        .filter((p) => p.pos === 'POR' && !movimientos.fuera.includes(p.id))
        .sort((a, b) => engine.edadDe(a) - engine.edadDe(b));
      const anunciados = new Set((s.retirados || []).map((r) => r.id));
      const arqueroQueVuelve = candidatos.find((p) => !anunciados.has(p.id)) || candidatos[0];
      if (arqueroQueVuelve) vivos.push(arqueroQueVuelve);
    }

    // ---------- El relleno, y por qué NO se hace en los clubes con plantel
    // real ----------
    //
    // Un club al que le cargamos su plantel de verdad NO recibe jugadores
    // inventados para tapar los huecos que dejan los retiros. Si a Boca se le
    // retiran dos, Boca queda con dos menos, y punto: el juego no inventa un
    // pibe de 18 con nombre sorteado para que la cuenta cierre. Eso va a
    // llegar por donde corresponde —el mercado y, más adelante, las
    // inferiores—, no por un relleno automático.
    //
    // En los clubes que TODAVÍA no tienen plantel real el relleno sigue,
    // porque ahí el plantel entero es generado igual y sin esto se vacían
    // solos: sin reponer, un club llegaba a la temporada 12 con 17 jugadores
    // y seguía bajando hasta quedar por debajo de un once. El día que a ese
    // club se le cargue su REAL_ROSTERS pasa solo al otro comportamiento,
    // sin tocar una línea de acá.
    const tienePlantelReal = !!(real && real.length >= 11);

    // ---------- Las inferiores ----------
    //
    // Acá se cumple lo que promete el comentario de arriba. Un club con
    // plantel real no recibe relleno inventado, pero SÍ sube los pibes de su
    // propia cantera, que no son inventados a la ligera: salen de la misma
    // semilla de siempre y del nivel de cantera del club (ver js/juveniles.js
    // y CANTERAS en data.js). Argentinos sube mejores juveniles que Barracas,
    // como en la realidad.
    //
    // Sube solo los que hagan falta para no bajar del piso, así que un club
    // completo no suma a nadie y uno al que se le retiraron tres veteranos
    // repone tres. Sin esto los planteles reales se vaciaban solos: medido,
    // en la temporada 15 el club más chico quedaba con 8 jugadores.
    if (tienePlantelReal && typeof Juveniles !== 'undefined') {
      const suben = Juveniles.egresados(engine, clubId, Juveniles.pisoDe(clubId) - vivos.length,
        !engine.cuantosArqueros(vivos));
      suben.forEach((p) => { if (!movimientos.fuera.includes(p.id)) vivos.push(p); });
    }

    const nivel = 44 + club.reputation * 6;
    while (!tienePlantelReal && vivos.length < PLANTEL_MINIMO) {
      const pos = SQUAD_POSITIONS[vivos.length % SQUAD_POSITIONS.length];
      const edad = 17 + Math.floor(rnd() * 4);
      // El sorteo va centrado en el nivel del club. Si los juveniles entraran
      // por debajo, cada reposición bajaría un poco el promedio y en 30
      // temporadas todos los clubes del juego habrían perdido 4 o 5 puntos
      // mientras el tuyo sube: la diferencia se iría a cualquier lado.
      const rating = Math.max(35, Math.round(nivel - 5 + rnd() * 10));
      const nation = this.nacionSembrada(rnd);
      const idCantera = `${clubId}-c${anio}-${vivos.length}`;
      vivos.push({
        id: idCantera,
        name: this.nombreSembrado(rnd, nation),
        pos, nation, rating,
        // Inventado: fecha de nacimiento inventada, del año en que apareció.
        birthDate: engine.fechaDeNacimientoSembrada(idCantera, edad, engine.fechaDeJuegoDeLaTemporada(anio)),
        age: edad,
        projection: engine.computePotential(rating, edad, club, rnd),
        contractYears: 2 + Math.floor(rnd() * 3),
        role: pos === 'MED' ? ['contención', 'mixto', 'ofensivo'][Math.floor(rnd() * 3)] : undefined,
      });
    }

    // La posición detallada (lateral derecho, defensor central, extremo
    // izquierdo...). Los planteles investigados ya la traen; a los generados
    // se les pone acá, en una pasada aparte y NO adentro del sorteo, por dos
    // razones: el rol del mediocampista se sortea después y tienen que
    // coincidir, y tocar la secuencia del generador sembrado cambiaría de
    // golpe los planteles de las partidas ya empezadas.
    //
    // Se lleva una cuenta por puesto para que el reparto salga parejo: dos
    // laterales por lado y centrales, y no seis defensores centrales.
    const porPuesto = {};
    vivos.forEach((j) => {
      if (j.posDetail) return;
      const n = porPuesto[j.pos] || 0;
      j.posDetail = engine.posDetalladaPara(j.pos, n, j.role);
      porPuesto[j.pos] = n + 1;
    });

    // El ranking por valoración decide a quiénes el club considera
    // intocables: las figuras del plantel.
    const ranking = vivos.slice().sort((a, b) => b.rating - a.rating).map((p) => p.id);

    return vivos
      .filter((p) => !m.fichados.includes(p.id))
      .map((p) => {
        const valor = engine.valueOf(p);
        const esFigura = ranking.indexOf(p.id) < 3;
        const dado = rnd();

        // Con un club investigado, la situación de contrato sale de la
        // investigación y no de un dado. "Intocable" es más duro que
        // "Retenido": ahí el club directamente no negocia.
        let estado;
        if (this.estaCedido(p)) estado = 'retenido';
        else if (p.transferState) estado = MERCADO_ESTADO_POR_TEXTO[p.transferState] || 'transferible';
        else if (p.contractYears <= 1) estado = 'fin-contrato';
        else if (esFigura && dado < 0.8) estado = 'retenido';
        else if (dado < 0.35) estado = 'clausula';
        else estado = 'transferible';

        // La cláusula NO pisa al estado. En el primer intento sí lo hacía, y
        // el resultado era que "Intocable" no aparecía nunca en Boca: los
        // cinco intocables tienen cláusula, así que todos se mostraban como
        // "Cláusula" y se perdía la información de que el club no los quiere
        // vender. Ahora el estado dice la postura del club y la cláusula es
        // un camino aparte que siempre está disponible, que es como funciona
        // de verdad: te pueden decir que no, pero si pagás la cláusula no
        // tienen nada que hacer.
        const clausula = p.clause || 0;

        let precio = 0;
        let prima = 0;
        if (estado === 'clausula') precio = clausula || Math.round(valor * (1.8 + rnd() * 0.8));
        else if (estado === 'transferible') precio = Math.round(valor * (0.9 + rnd() * 0.4));
        else if (estado === 'clausula') precio = Math.round(valor * (1.8 + rnd() * 0.8));
        else if (estado === 'retenido') precio = Math.round(valor * (2.4 + rnd() * 1.2));
        else if (estado === 'intocable') precio = Math.round(valor * (3.5 + rnd() * 1.5));
        else prima = Math.round(valor * (0.12 + rnd() * 0.15));

        // El techo sale del generador SEMBRADO, no de Math.random: así el
        // pibe de otro club tiene siempre la misma proyección y se lo puede
        // seguir de una temporada a la otra.
        const techo = p.projection || engine.computePotential(p.rating, p.age, club, rnd);

        const acordado = m.acuerdos.some((a) => a.jugadorId === p.id);
        return {
          ...p,
          clubId,
          potential: techo,
          valor,
          estado,
          clausula,
          precio,
          prima,
          meses,
          consultado: m.consultados.includes(p.id),
          rechazado: m.rechazados.includes(p.id),
          acordado,
        };
      })
      .sort((a, b) => b.rating - a.rating);
  },

  // Cómo evolucionó un jugador de otro club después de N temporadas. Es una
  // versión determinística y simplificada de lo que le pasa a tu plantel
  // (ver developSquadAfterMatch en engine.js): el joven sube hacia su techo y
  // lo alcanza cerca de los 26, y el veterano se cae después de los 30. No se
  // simula partido a partido porque serían 65 planteles por fecha; con la
  // curva alcanza para que el mundo se mueva de forma creíble.
  ratingConLosAnios(ratingBase, edadBase, techo, anios) {
    if (!anios) return ratingBase;
    const edad = edadBase + anios;
    let rating = ratingBase;
    if (techo > ratingBase) {
      const aniosParaLlegar = Math.max(1, 26 - edadBase);
      rating += Math.round((techo - ratingBase) * Math.min(1, anios / aniosParaLlegar));
    }
    // El declive cuenta solo los años vividos DESDE que arrancó la partida,
    // no todos los que lleva encima. Contándolos todos, un jugador de 35 caía
    // 5 puntos de golpe en la primera temporada (su valoración de arranque ya
    // refleja su edad: no hay que volver a cobrársela).
    const desde = Math.max(30, edadBase);
    if (edad > desde) rating -= Math.round((edad - desde) * 0.8);
    return Math.max(35, Math.min(99, rating));
  },

  // Mismo criterio de países y nombres que el resto del juego, pero tirando
  // del generador sembrado en vez de Math.random, para que el plantel no
  // cambie cada vez que se abre.
  nacionSembrada(rnd) {
    const r = rnd();
    let acc = 0;
    for (const n of NATIONS) {
      acc += n.weight;
      if (r <= acc) return n.code;
    }
    return 'ARG';
  },

  nombreSembrado(rnd, nation) {
    const pool = NAMES_BY_NATION[nation] || NAMES_BY_NATION.ARG;
    const first = pool.first[Math.floor(rnd() * pool.first.length)];
    const last = pool.last[Math.floor(rnd() * pool.last.length)];
    return `${first} ${last}`;
  },

  // ---------- Buscar jugadores en toda la liga ----------
  //
  // Antes el mercado era una lista de los 66 clubes: para encontrar un lateral
  // izquierdo de menos de 25 había que entrar club por club y leer 66
  // planteles. Ahora se busca por lo que uno realmente busca —puesto, edad,
  // valoración, situación de contrato— y el club es apenas un dato más de
  // cada fila.
  //
  // Armar los 66 planteles cuesta (son ~1.800 jugadores sembrados), así que el
  // índice se guarda. NO va en this.state: es un dato derivado, se recalcula
  // solo y no tiene por qué engordar el guardado. La clave lleva todo lo que
  // puede cambiarlo: el año (los planteles envejecen), los que fichaste y los
  // movimientos del mundo.
  indice(engine) {
    const s = engine.state;
    const clave = `${s.season ? s.season.year : 1}|${(s.mercado && s.mercado.fichados || []).length}`
      + `|${Object.keys(s.mundo || {}).length}|${(s.libres || []).length}`;
    if (this._indice && this._indice.clave === clave) return this._indice.lista;
    const lista = [];
    this.clubes(engine).forEach((c) => {
      this.plantel(engine, c.id).forEach((j) => {
        lista.push({ ...j, clubId: c.id, clubName: c.name, division: c.division });
      });
    });
    // Los que no tienen club entran a la misma búsqueda: es donde uno los
    // busca, no en una pantalla aparte.
    engine.jugadoresLibres().forEach((j) => {
      lista.push({ ...j, clubId: null, clubName: 'Sin club', division: null, estado: 'libre' });
    });
    this._indice = { clave, lista };
    return lista;
  },

  // La situación de un jugador, en las categorías con las que uno busca.
  situacionDe(j) {
    if (!j.clubId) return 'libre';
    if (this.estaCedido(j)) return 'prestamo';
    if (j.estado === 'transferible') return 'transferible';
    if (j.estado === 'fin-contrato' || (j.contractYears || 9) <= 1) return 'fin-contrato';
    if (j.clausula) return 'clausula';
    return 'retenido';
  },

  SITUACIONES: [
    { id: 'todas', label: 'Todos' },
    { id: 'transferible', label: 'Transferibles' },
    { id: 'fin-contrato', label: 'Fin de contrato' },
    { id: 'libre', label: 'Libres' },
    { id: 'clausula', label: 'Con cláusula' },
    { id: 'prestamo', label: 'A préstamo' },
  ],

  TOPE_DE_RESULTADOS: 40,

  filtrar(engine, f) {
    const texto = (f.texto || '').trim().toLowerCase();
    const puestos = f.puestos && f.puestos.length ? f.puestos : null;
    const resultados = this.indice(engine).filter((j) => {
      if (puestos && !puestos.includes(j.pos)) return false;
      if (f.edadMin != null && j.age < f.edadMin) return false;
      if (f.edadMax != null && j.age > f.edadMax) return false;
      if (f.ratingMin != null && j.rating < f.ratingMin) return false;
      if (f.division && f.division !== 'todas' && j.division !== f.division) return false;
      if (f.situacion && f.situacion !== 'todas' && this.situacionDe(j) !== f.situacion) return false;
      if (texto && !j.name.toLowerCase().includes(texto)
        && !(j.clubName || '').toLowerCase().includes(texto)) return false;
      return true;
    });
    resultados.sort((a, b) => b.rating - a.rating || a.age - b.age);
    return { total: resultados.length, lista: resultados.slice(0, this.TOPE_DE_RESULTADOS) };
  },

  buscar(engine, clubId, jugadorId) {
    return this.plantel(engine, clubId).find((p) => p.id === jugadorId) || null;
  },

  // ---------- Acciones ----------

  // Consultar es gratis y no compromete a nada: el club te dice cómo está la
  // situación y te pasa el número exacto (antes de consultar solo se ve un
  // rango estimado).
  consultar(engine, clubId, jugadorId) {
    const s = engine.state;
    const m = this.init(s);
    const j = this.buscar(engine, clubId, jugadorId);
    if (!j) return null;
    if (!m.consultados.includes(jugadorId)) m.consultados.push(jugadorId);

    const club = engine.getClub(clubId);
    let texto;
    if (this.estaCedido(j)) {
      texto = j.loanFrom
        ? `En ${club.name} te aclaran que ${j.name} está a préstamo de ${j.loanFrom}: no es de ellos, no lo pueden vender.`
        : `En ${club.name} te aclaran que ${j.name} está a préstamo${j.loanUntil ? ` hasta ${j.loanUntil}` : ''}: no es de ellos, no lo pueden vender.`;
    } else if (j.estado === 'intocable') {
      texto = `En ${club.name} te cortan el teléfono: ${j.name} es intocable. Ni por ${this.plata(j.precio)} lo largan.`;
    } else if (j.estado === 'retenido') {
      texto = `En ${club.name} no lo quieren largar. "Por menos de ${this.plata(j.precio)} no lo escuchamos, y ni así te aseguro nada."`;
    } else if (j.estado === 'fin-contrato') {
      texto = `${j.name} termina contrato en ${j.meses} ${j.meses === 1 ? 'mes' : 'meses'}. Su representante pide ${this.plata(j.prima)} de prima para firmar con vos.`;
    } else if (j.estado === 'clausula') {
      texto = `${j.name} tiene cláusula de rescisión de ${this.plata(j.precio)}. Si la pagás, ${club.name} no puede hacer nada.`;
    } else {
      texto = `En ${club.name} lo escuchan: piden ${this.plata(j.precio)} por ${j.name}.`;
    }
    if (j.clausula && j.estado !== 'clausula' && j.estado !== 'fin-contrato') {
      texto += ` Eso sí: tiene cláusula de ${this.plata(j.clausula)}, y contra eso no pueden hacer nada.`;
    }
    this.guardarRespuesta(s, jugadorId, texto);
    engine.save();
    return texto;
  },

  // Negociar de verdad. Nunca firma en el momento: si sale bien queda un
  // acuerdo pendiente que se concreta cuando abre el mercado de pases.
  negociar(engine, clubId, jugadorId, porLaClausula) {
    const s = engine.state;
    const m = this.init(s);
    const j = this.buscar(engine, clubId, jugadorId);
    if (!j) return null;
    const club = engine.getClub(clubId);
    // Pagar la cláusula es la vía rápida: cuesta más, pero no se negocia.
    const porClausula = !!(porLaClausula && j.clausula);
    const costo = porClausula ? j.clausula : (j.estado === 'fin-contrato' ? j.prima : j.precio);

    if (j.acordado) {
      return this.responder(engine, jugadorId, `Ya tenés un acuerdo cerrado por ${j.name}. Se concreta cuando abra el mercado.`, false);
    }
    // Ni con la cláusula en la mano: un club no se queda sin nadie al arco.
    // Vale igual para el usuario que para los rivales entre ellos.
    if (engine.esUltimoArquero(this.plantel(engine, clubId), j)) {
      return this.responder(engine, jugadorId,
        `${club.name} no te lo va a vender: ${j.name} es el único arquero que tienen. Ni por la cláusula.`, false);
    }
    if (m.rechazados.includes(jugadorId)) {
      return this.responder(engine, jugadorId, `${club.name} ya te dijo que no por ${j.name}. Habrá que esperar al próximo mercado para volver a intentarlo.`, false);
    }
    if (this.estaCedido(j)) {
      return this.responder(engine, jugadorId, j.loanFrom
        ? `${j.name} está a préstamo de ${j.loanFrom}: ${club.name} no puede negociarlo.`
        : `${j.name} está a préstamo en ${club.name}: no es de ellos, no lo pueden negociar.`, false);
    }
    if (s.budget < costo) {
      return this.responder(engine, jugadorId, `No te alcanza: hacen falta ${this.plata(costo)} y tenés ${this.plata(s.budget)}.`, false);
    }

    // La cláusula no se negocia: se paga y listo.
    if (porClausula || j.estado === 'clausula') {
      return this.cerrarAcuerdo(engine, j, costo, `Pagás la cláusula de ${j.name}. ${club.name} no puede oponerse: arreglado por ${this.plata(costo)}.`);
    }

    // En el resto sí hay una decisión del otro club. Pesa qué tan dispuesto
    // está a venderlo y qué tan grande sos vos comparado con él.
    const mio = engine.getClub(s.clubId);
    const tiron = (mio.reputation - club.reputation) * 0.06;
    const baseProb = { transferible: 0.82, 'fin-contrato': 0.6, retenido: 0.12, intocable: 0.03 }[j.estado] || 0.5;
    const prob = Math.max(0.05, Math.min(0.95, baseProb + tiron));

    if (Math.random() > prob) {
      m.rechazados.push(jugadorId);
      const excusa = j.estado === 'intocable'
        ? `Ni escuchan la oferta por ${j.name}. En ${club.name} es intocable.`
        : j.estado === 'retenido'
        ? `En ${club.name} rechazan la oferta por ${j.name}: "es intransferible".`
        : j.estado === 'fin-contrato'
          ? `${j.name} escuchó la propuesta pero prefiere seguir en ${club.name} por ahora.`
          : `${club.name} rechazó la oferta por ${j.name}: quieren más plata.`;
      return this.responder(engine, jugadorId, excusa, false);
    }

    const mensaje = j.estado === 'fin-contrato'
      ? `¡Acuerdo con ${j.name}! Firma libre al terminar su contrato: solo pagás ${this.plata(costo)} de prima.`
      : `¡${club.name} acepta! ${j.name} es tuyo por ${this.plata(costo)}.`;
    return this.cerrarAcuerdo(engine, j, costo, mensaje);
  },

  cerrarAcuerdo(engine, j, costo, mensaje) {
    const s = engine.state;
    const m = this.init(s);
    const acuerdo = {
      clubId: j.clubId,
      jugadorId: j.id,
      tipo: j.estado,
      precio: costo,
      // Se guarda una copia del jugador porque el plantel de cada club se
      // regenera al cambiar de año: si el acuerdo se concreta en la
      // pretemporada, el jugador original ya no existiría.
      jugador: {
        id: j.id, name: j.name, pos: j.pos, posDetail: j.posDetail, altPosDetail: j.altPosDetail,
        rating: j.rating, age: j.age, nation: j.nation, role: j.role,
      },
    };

    // Si el mercado está ABIERTO, el pase se hace ahora mismo y el jugador se
    // suma al plantel (entra por la reserva, como cualquier refuerzo). Decirte
    // "se concreta cuando abra el mercado" estando adentro de la ventana no
    // tenía ningún sentido: el mercado es hoy.
    //
    // La excepción es el de fin de contrato: ese no se compra, firma libre
    // cuando se le termina el contrato con su club, así que espera igual.
    if (acuerdo.tipo !== 'fin-contrato' && engine.mercadoAbierto()) {
      const hecho = this.concretarAcuerdo(engine, acuerdo);
      return this.responder(engine, j.id, hecho.ok
        ? `${mensaje} Ya está en tu plantel, en la reserva.`
        // Si no se pudo (plantel lleno, no te alcanzaba la plata), la excusa
        // es más útil que el "acepta".
        : hecho.nota, hecho.ok);
    }

    m.acuerdos.push(acuerdo);
    return this.responder(engine, j.id, acuerdo.tipo === 'fin-contrato'
      ? `${mensaje} Se suma cuando se le termine el contrato.`
      : `${mensaje} Se concreta cuando abra el mercado de pases.`, true);
  },

  // Concreta UN acuerdo: paga y suma el jugador al plantel. Devuelve
  // { ok, nota }: la nota es la línea que lo cuenta, o la excusa si no se pudo.
  concretarAcuerdo(engine, a) {
    const s = engine.state;
    const m = this.init(s);
    const j = a.jugador;
    if (s.budget < a.precio) {
      return { ok: false, nota: `${j.name} no pudo sumarse: hacían falta ${this.plata(a.precio)} y no los tenías. El acuerdo se cayó.` };
    }
    // Pasa por Economia.registrar y no por s.budget directo, para que la
    // compra quede anotada en el detalle de "de dónde sale la plata".
    Economia.registrar(engine, `Fichaje de ${j.name}`, -a.precio);
    s.squad.push({
      id: j.id, name: j.name, pos: j.pos, posDetail: j.posDetail, altPosDetail: j.altPosDetail,
      rating: j.rating, age: j.age, nation: j.nation, role: j.role,
      // La fecha de nacimiento (o el reloj grueso, si no la tiene) viaja con
      // el jugador: es del jugador y no del club.
      birthDate: j.birthDate,
      edadAlLlegar: j.edadAlLlegar,
      temporadaAlLlegar: j.temporadaAlLlegar,
      contractYears: 3,
      potential: engine.computePotential(j.rating, j.age, engine.getClub(a.clubId)),
      // Llega entero: no viene de jugar.
      energia: ENERGIA_MAXIMA,
    });
    // Deja de estar en el plantel de su club (ver plantel(), que filtra los
    // fichados).
    m.fichados.push(j.id);
    engine._fuerzas = {};
    engine.repairStartingSlots();
    if (typeof Noticias !== 'undefined') Noticias.trasUnaOperacion(engine, 'compra', j, a.precio);
    return { ok: true, nota: a.tipo === 'fin-contrato'
      ? `${j.name} llegó libre desde ${engine.getClub(a.clubId).name}: pagaste ${this.plata(a.precio)} de prima.`
      : `${j.name} llegó desde ${engine.getClub(a.clubId).name} por ${this.plata(a.precio)}.` };
  },

  responder(engine, jugadorId, texto, ok) {
    this.guardarRespuesta(engine.state, jugadorId, texto);
    engine.save();
    return { ok, mensaje: texto };
  },

  cancelarAcuerdo(engine, jugadorId) {
    const s = engine.state;
    const m = this.init(s);
    const i = m.acuerdos.findIndex((a) => a.jugadorId === jugadorId);
    if (i < 0) return null;
    const [a] = m.acuerdos.splice(i, 1);
    return this.responder(engine, jugadorId, `Diste de baja el acuerdo por ${a.jugador.name}.`, true);
  },

  // ---------- Concretar cuando abre el mercado ----------
  //
  // Se llama desde Engine.openTransferMarket. Devuelve las líneas para
  // mostrar en la pantalla del mercado.

  resolverAcuerdos(engine) {
    const s = engine.state;
    const m = this.init(s);
    const notas = [];
    const pendientes = m.acuerdos.slice();
    m.acuerdos = [];

    pendientes.forEach((a) => {
      notas.push(this.concretarAcuerdo(engine, a).nota);
    });

    // Cada mercado nuevo borra los portazos del anterior: se puede volver a
    // intentar por los jugadores que te habían dicho que no.
    m.rechazados = [];
    engine.repairStartingSlots();
    return notas;
  },

  // Formato corto para los montos, que en el panel angosto del celular no
  // entra el número completo con todos los ceros.
  plata(n) {
    const v = Math.round(n);
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1).replace('.', ',')} M`;
    if (v >= 1000) return `$${Math.round(v / 1000)} mil`;
    return `$${v}`;
  },

  // Rango estimado, para mostrar antes de consultar: el número exacto se
  // revela recién cuando preguntás.
  rango(precio) {
    return `${this.plata(precio * 0.85)} – ${this.plata(precio * 1.15)}`;
  },
};
