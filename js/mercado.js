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
  mesesHastaFinDeTemporada(dayCount) {
    let day = CALENDAR_START_DAY + (dayCount || 0);
    let month = CALENDAR_START_MONTH;
    while (day > DAYS_IN_MONTH[month]) {
      day -= DAYS_IN_MONTH[month];
      month = (month + 1) % 12;
    }
    const faltan = (11 - month + 12) % 12; // hasta diciembre
    return Math.max(1, faltan);
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
    const meses = this.mesesHastaFinDeTemporada(s.calendar ? s.calendar.dayCount : 0);

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
        age: p.age + aniosPasados,
        rating: this.ratingConLosAnios(p.rating, p.age, p.projection ?? p.rating, aniosPasados),
        projection: p.projection,
        nation: p.nation,
        // El contrato corre y, si se venció, el club lo renueva.
        contractYears: Math.max(1, (p.contractYears || 1) - (aniosPasados % Math.max(1, p.contractYears || 1))),
        role: p.role, loanFrom: p.loanFrom,
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
        const nivelDelClub = 44 + club.reputation * 6 + (rnd() * 6 - 3);
        return SQUAD_POSITIONS.map((pos, i) => {
        const promedio = nivelDelClub;
        const ratingBase = Math.max(35, Math.min(90, Math.round(promedio + (rnd() * 16 - 8))));
        const edadBase = Math.round(17 + rnd() * 18);
        const nation = this.nacionSembrada(rnd);
        const techo = engine.computePotential(ratingBase, edadBase, club, rnd);
        const contratoBase = 1 + Math.floor(rnd() * 4);
        return {
          id: `${clubId}-g${i}`,
          name: this.nombreSembrado(rnd, nation),
          pos, nation,
          age: edadBase + aniosPasados,
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
    const vivos = base.filter((p) => p.age <= 39);

    // Y el club repone. Sin esto los planteles se vaciaban solos: como nadie
    // reemplaza a los que se retiran, River llegaba a la temporada 12 con 17
    // jugadores y seguía bajando, hasta quedar por debajo de un once.
    //
    // Los que entran son pibes, como si subieran de inferiores: es el
    // reemplazo más barato de modelar y el más parecido a lo que hace un club
    // que perdió un veterano. Salen del mismo generador sembrado, así que son
    // siempre los mismos para ese club en esa temporada.
    //
    // Esto NO es todavía un mercado entre clubes rivales: nadie compra ni
    // vende, solo se tapa el agujero para que un plantel no se desarme en una
    // carrera larga.
    const nivel = 44 + club.reputation * 6;
    while (vivos.length < PLANTEL_MINIMO) {
      const pos = SQUAD_POSITIONS[vivos.length % SQUAD_POSITIONS.length];
      const edad = 17 + Math.floor(rnd() * 4);
      // El sorteo va centrado en el nivel del club. Si los juveniles entraran
      // por debajo, cada reposición bajaría un poco el promedio y en 30
      // temporadas todos los clubes del juego habrían perdido 4 o 5 puntos
      // mientras el tuyo sube: la diferencia se iría a cualquier lado.
      const rating = Math.max(35, Math.round(nivel - 5 + rnd() * 10));
      const nation = this.nacionSembrada(rnd);
      vivos.push({
        id: `${clubId}-c${anio}-${vivos.length}`,
        name: this.nombreSembrado(rnd, nation),
        pos, nation, age: edad, rating,
        projection: engine.computePotential(rating, edad, club, rnd),
        contractYears: 2 + Math.floor(rnd() * 3),
        role: pos === 'MED' ? ['contención', 'mixto', 'ofensivo'][Math.floor(rnd() * 3)] : undefined,
      });
    }

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
        if (p.loanFrom) estado = 'retenido';
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
    if (j.loanFrom) {
      texto = `En ${club.name} te aclaran que ${j.name} está a préstamo de ${j.loanFrom}: no es de ellos, no lo pueden vender.`;
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
    if (m.rechazados.includes(jugadorId)) {
      return this.responder(engine, jugadorId, `${club.name} ya te dijo que no por ${j.name}. Habrá que esperar al próximo mercado para volver a intentarlo.`, false);
    }
    if (j.loanFrom) {
      return this.responder(engine, jugadorId, `${j.name} está a préstamo de ${j.loanFrom}: ${club.name} no puede negociarlo.`, false);
    }
    if (s.budget < costo) {
      return this.responder(engine, jugadorId, `No te alcanza: hacen falta ${this.plata(costo)} y tenés ${this.plata(s.budget)}.`, false);
    }
    if (s.squad.length >= MAX_SQUAD && !j.acordado) {
      return this.responder(engine, jugadorId, `Tenés el plantel lleno (${MAX_SQUAD}). Vendé a alguien antes de traer a ${j.name}.`, false);
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
    m.acuerdos.push({
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
    });
    return this.responder(engine, j.id, `${mensaje} Se concreta cuando abra el mercado de pases.`, true);
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
      const j = a.jugador;
      if (s.squad.length >= MAX_SQUAD) {
        notas.push(`${j.name} no pudo sumarse: el plantel está lleno (${MAX_SQUAD}). El acuerdo se cayó.`);
        return;
      }
      if (s.budget < a.precio) {
        notas.push(`${j.name} no pudo sumarse: hacían falta ${this.plata(a.precio)} y no los tenías. El acuerdo se cayó.`);
        return;
      }
      // Pasa por Economia.registrar y no por s.budget directo, para que la
      // compra quede anotada en el detalle de "de dónde sale la plata".
      Economia.registrar(engine, `Fichaje de ${j.name}`, -a.precio);
      s.squad.push({
        id: j.id, name: j.name, pos: j.pos, posDetail: j.posDetail, altPosDetail: j.altPosDetail,
        rating: j.rating, age: j.age, nation: j.nation, role: j.role,
        contractYears: 3,
        potential: engine.computePotential(j.rating, j.age, engine.getClub(a.clubId)),
        // Llega de pretemporada: entero.
        energia: ENERGIA_MAXIMA,
      });
      m.fichados.push(j.id);
      notas.push(a.tipo === 'fin-contrato'
        ? `${j.name} llegó libre desde ${engine.getClub(a.clubId).name}: pagaste ${this.plata(a.precio)} de prima.`
        : `${j.name} llegó desde ${engine.getClub(a.clubId).name} por ${this.plata(a.precio)}.`);
      if (typeof Noticias !== 'undefined') {
        Noticias.trasUnaOperacion(engine, 'compra', j, a.precio);
      }
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
