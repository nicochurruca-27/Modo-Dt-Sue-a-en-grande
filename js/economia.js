// Economía del club: de dónde sale la plata y en qué se va.
//
// Los números de este archivo NO son inventados: salen de una investigación
// puntual sobre la economía real de los clubes argentinos (temporada
// 2026/2027, todo en dólares para que la inflación no lo desactualice), que
// el usuario pidió aparte y pasó como está. Están cargados tal cual en
// ECONOMIA_DATOS, sin retocar, para que se pueda auditar contra la fuente.
//
// Ahora, tres decisiones sobre CÓMO se usan esos datos, que son la parte
// importante:
//
// 1) `s.budget` es el PRESUPUESTO DE FICHAJES del DT, no la caja del club.
//    Un club grande factura 95 millones al año, pero de eso paga sueldos,
//    inferiores, empleados, instalaciones y deuda. Al técnico le llega una
//    porción. Por eso todo lo que entra acá se calcula sobre el excedente
//    (ingresos ordinarios menos masa salarial) y encima se toma solo una
//    parte, PORCION_DT. Es el mismo criterio de cualquier juego de manager:
//    lo que ves no es el balance del club, es lo que te dejan gastar.
//
// 2) La venta de jugadores NO entra en el goteo, aunque en los datos figure
//    como el 19% del ingreso de un grande. El juego ya modela tus ventas: si
//    además te la pagara todas las semanas, te estaría pagando dos veces por
//    lo mismo. Igual con los premios: no van en el goteo, se cobran cuando
//    de verdad llegás a esa instancia.
//
// 3) La masa salarial ya está descontada del goteo, así que renovar un
//    contrato NO vuelve a cobrar el sueldo entero: cobra una prima de
//    renovación (PRIMA_RENOVACION del costo anual). Si cobrara el sueldo
//    completo estaría contando el mismo gasto dos veces.
//
// Antes de esto el juego tenía un solo ingreso, un premio anual, contra unos
// 2,75 millones por año en renovaciones: el presupuesto se hundía sí o sí y
// no había forma de comprar a nadie nunca.

const ECONOMIA_DATOS = {
  moneda: 'USD',
  temporada: '2026/2027',
  categorias: {
    grandes: {
      ejemplos: ['Boca Juniors', 'River Plate'],
      ingresoAnualTotal: 95000000,
      fuentes: {
        television: { anual: 6500000, periodicidad: 'mensual' },
        patrocinadores: { anual: 18000000, periodicidad: 'mensual' },
        entradas: { anual: 16000000, periodicidad: 'por partido' },
        cuotaSocial: { anual: 24000000, periodicidad: 'mensual' },
        premiosLocales: { anual: 500000, periodicidad: 'anual' },
        premiosInternacionales: { anual: 8000000, periodicidad: 'anual' },
        ventaDeJugadores: { anual: 18000000, periodicidad: 'anual' },
        otros: { anual: 4000000, periodicidad: 'mensual' },
      },
      recaudacionPartidoLocal: 650000,
      multiplicadorClasico: 1.8,
      masaSalarialAnual: 42000000,
      costoRenovacionTitular: 1800000,
      costoRenovacionSuplente: 800000,
      costoRenovacionJuvenil: 250000,
    },
    historicos: {
      ejemplos: ['Racing', 'Independiente', 'Estudiantes', 'Vélez', 'Rosario Central', "Newell's", 'Talleres'],
      ingresoAnualTotal: 32000000,
      fuentes: {
        television: { anual: 4200000, periodicidad: 'mensual' },
        patrocinadores: { anual: 5500000, periodicidad: 'mensual' },
        entradas: { anual: 4500000, periodicidad: 'por partido' },
        cuotaSocial: { anual: 6800000, periodicidad: 'mensual' },
        premiosLocales: { anual: 300000, periodicidad: 'anual' },
        premiosInternacionales: { anual: 2500000, periodicidad: 'anual' },
        ventaDeJugadores: { anual: 7000000, periodicidad: 'anual' },
        otros: { anual: 1200000, periodicidad: 'mensual' },
      },
      recaudacionPartidoLocal: 220000,
      multiplicadorClasico: 1.6,
      masaSalarialAnual: 16500000,
      costoRenovacionTitular: 750000,
      costoRenovacionSuplente: 350000,
      costoRenovacionJuvenil: 100000,
    },
    mediaTabla: {
      ejemplos: ['Argentinos Juniors', 'Defensa y Justicia', 'Belgrano', 'Huracán', 'Gimnasia LP', 'Tigre', 'Unión', 'Atlético Tucumán'],
      ingresoAnualTotal: 12500000,
      fuentes: {
        television: { anual: 3100000, periodicidad: 'mensual' },
        patrocinadores: { anual: 2200000, periodicidad: 'mensual' },
        entradas: { anual: 1500000, periodicidad: 'por partido' },
        cuotaSocial: { anual: 1800000, periodicidad: 'mensual' },
        premiosLocales: { anual: 100000, periodicidad: 'anual' },
        premiosInternacionales: { anual: 800000, periodicidad: 'anual' },
        ventaDeJugadores: { anual: 2600000, periodicidad: 'anual' },
        otros: { anual: 400000, periodicidad: 'mensual' },
      },
      recaudacionPartidoLocal: 85000,
      multiplicadorClasico: 1.5,
      masaSalarialAnual: 6800000,
      costoRenovacionTitular: 320000,
      costoRenovacionSuplente: 160000,
      costoRenovacionJuvenil: 45000,
    },
    chicosPrimera: {
      ejemplos: ['Riestra', 'Barracas Central', 'Sarmiento', 'Central Córdoba', 'Platense', 'Independiente Rivadavia', 'Aldosivi'],
      ingresoAnualTotal: 5800000,
      fuentes: {
        television: { anual: 2700000, periodicidad: 'mensual' },
        patrocinadores: { anual: 1100000, periodicidad: 'mensual' },
        entradas: { anual: 500000, periodicidad: 'por partido' },
        cuotaSocial: { anual: 400000, periodicidad: 'mensual' },
        premiosLocales: { anual: 50000, periodicidad: 'anual' },
        premiosInternacionales: { anual: 0, periodicidad: 'anual' },
        ventaDeJugadores: { anual: 900000, periodicidad: 'anual' },
        otros: { anual: 150000, periodicidad: 'mensual' },
      },
      recaudacionPartidoLocal: 30000,
      multiplicadorClasico: 1.4,
      masaSalarialAnual: 3400000,
      costoRenovacionTitular: 160000,
      costoRenovacionSuplente: 85000,
      costoRenovacionJuvenil: 25000,
    },
    primeraNacional: {
      ejemplos: ['Quilmes', 'Chacarita', 'San Martín de Tucumán', 'Ferro', 'Colón', 'Atlanta'],
      ingresoAnualTotal: 2200000,
      fuentes: {
        television: { anual: 1100000, periodicidad: 'mensual' },
        patrocinadores: { anual: 400000, periodicidad: 'mensual' },
        entradas: { anual: 250000, periodicidad: 'por partido' },
        cuotaSocial: { anual: 250000, periodicidad: 'mensual' },
        premiosLocales: { anual: 10000, periodicidad: 'anual' },
        premiosInternacionales: { anual: 0, periodicidad: 'anual' },
        ventaDeJugadores: { anual: 150000, periodicidad: 'anual' },
        otros: { anual: 40000, periodicidad: 'mensual' },
      },
      recaudacionPartidoLocal: 15000,
      multiplicadorClasico: 1.5,
      masaSalarialAnual: 1400000,
      costoRenovacionTitular: 75000,
      costoRenovacionSuplente: 40000,
      costoRenovacionJuvenil: 12000,
    },
  },
  // Los premios de CONMEBOL son ACUMULATIVOS: el que llega a cuartos cobró
  // también lo de grupos y lo de octavos. Se nota en que el número de octavos
  // (1,25 M) es más chico que el de grupos (3 M): no es que valga menos
  // llegar a octavos, es que ese monto se suma al anterior.
  premios: {
    ligaProfesional: { campeonApertura: 500000, campeonClausura: 500000 },
    copaArgentina: { dieciseisavos: 12000, octavos: 22000, cuartos: 40000, semifinal: 70000, subcampeon: 120000, campeon: 237500 },
    libertadores: { fasePrevia: 500000, grupos: 3000000, octavos: 1250000, cuartos: 1700000, semifinal: 2300000, subcampeon: 7000000, campeon: 25000000 },
    sudamericana: { fasePrevia: 225000, grupos: 900000, octavos: 600000, cuartos: 700000, semifinal: 800000, subcampeon: 2000000, campeon: 10000000 },
  },
};

const Economia = {
  // Qué parte del excedente del club termina en el bolsillo del DT para
  // fichajes. Es la única perilla inventada de todo esto: los datos dicen
  // cuánto factura y cuánto gasta en sueldos un club, pero no cuánto de eso
  // le sueltan al técnico. Con 0,35 un club de media tabla junta unos 700 mil
  // por año (medio jugador de 70) y un grande unos 7 millones. Si algún día
  // querés una economía más holgada o más ahogada, se toca acá y nada más.
  PORCION_DT: 0.35,

  // Renovar no vuelve a cobrar el sueldo entero (ya está descontado del
  // goteo semanal): cobra esta fracción, que es la prima por firmar.
  PRIMA_RENOVACION: 0.3,

  SEMANAS_POR_ANIO: 52,
  MAX_MOVIMIENTOS: 25,

  // ---------- A qué categoría económica pertenece cada club ----------
  //
  // Se usa budgetTier si el club lo tiene cargado y, si no, la reputación
  // deportiva — el mismo criterio que ya usaba el presupuesto inicial. Los
  // dos campos existen separados justamente para casos como San Lorenzo, que
  // deportivamente es grande pero económicamente está complicado.
  categoriaDe(club) {
    const tier = club.budgetTier || club.reputation;
    if (club.division === 'D2') return 'primeraNacional';
    if (tier >= 5) return 'grandes';
    if (tier === 4) return 'historicos';
    if (tier === 3) return 'mediaTabla';
    return 'chicosPrimera';
  },

  datosDe(club) {
    return ECONOMIA_DATOS.categorias[this.categoriaDe(club)];
  },

  // ---------- Estado guardado ----------

  init(s) {
    if (!s.finanzas) s.finanzas = { movimientos: [], totalTemporada: 0 };
    if (!Array.isArray(s.finanzas.movimientos)) s.finanzas.movimientos = [];
    if (typeof s.finanzas.totalTemporada !== 'number') s.finanzas.totalTemporada = 0;
    return s.finanzas;
  },

  // Todo ingreso y todo gasto pasa por acá, así el panel puede mostrar de
  // dónde salió cada peso en vez de que el número cambie sin explicación.
  registrar(engine, concepto, monto) {
    const s = engine.state;
    const f = this.init(s);
    const redondeado = Math.round(monto);
    if (!redondeado) return 0;
    s.budget = Math.max(0, s.budget + redondeado);
    f.totalTemporada += redondeado;
    f.movimientos.unshift({ concepto, monto: redondeado, dia: s.calendar ? s.calendar.dayCount : 0 });
    if (f.movimientos.length > this.MAX_MOVIMIENTOS) f.movimientos.length = this.MAX_MOVIMIENTOS;
    return redondeado;
  },

  // ---------- Goteo semanal ----------

  // El margen que le queda al club sobre sus ingresos ordinarios una vez
  // pagados los sueldos. Se calcula sobre TODOS los ingresos ordinarios
  // (goteo + entradas), no solo sobre el goteo.
  //
  // Esto último importa y me lo comí en el primer intento: descontando la
  // masa salarial entera del goteo nada más, un club de media tabla quedaba
  // cobrando menos por semana que uno chico (porque gasta un porcentaje más
  // alto de su ingreso en sueldos) y encima quedaba viviendo casi solo de
  // las entradas, cuando en los datos las entradas son apenas el 12-17% del
  // ingreso y la TV más los socios son el grueso. Repartiendo el peso de los
  // sueldos de forma pareja sobre las dos partes, la proporción entre una y
  // otra queda como en la realidad.
  margen(club) {
    const d = this.datosDe(club);
    const ordinarios = d.fuentes.television.anual + d.fuentes.patrocinadores.anual
      + d.fuentes.cuotaSocial.anual + d.fuentes.otros.anual + d.fuentes.entradas.anual;
    return Math.max(0, (ordinarios - d.masaSalarialAnual) / ordinarios);
  },

  // Lo que entra todas las semanas pase lo que pase: televisión, sponsors,
  // cuota social y otros. Las entradas NO están acá: se cobran el día que
  // jugás de local.
  ingresoSemanalFijo(club) {
    const d = this.datosDe(club);
    const goteoAnual = d.fuentes.television.anual + d.fuentes.patrocinadores.anual
      + d.fuentes.cuotaSocial.anual + d.fuentes.otros.anual;
    return Math.round((goteoAnual * this.margen(club) * this.PORCION_DT) / this.SEMANAS_POR_ANIO);
  },

  cobrarSemana(engine) {
    const s = engine.state;
    if (!s.clubId) return;
    const club = engine.getClub(s.clubId);
    const monto = this.ingresoSemanalFijo(club);
    if (monto > 0) this.registrar(engine, 'TV, sponsors y cuota social', monto);
  },

  // ---------- Recaudación de local ----------

  // Un equipo que anda bien llena más la cancha. El dato de recaudación por
  // partido es un promedio de la temporada, así que se lo mueve un poco según
  // cómo venís en la tabla: esto sí es criterio nuestro, no sale de los
  // datos, pero es lo que pasa de verdad en una cancha.
  factorPorRendimiento(engine) {
    const s = engine.state;
    const zona = s.season && s.season.zones ? s.season.zones[engine.myZoneKey()] : null;
    if (!zona) return 1;
    const tabla = engine.sortTable(zona.table);
    const pos = tabla.findIndex((r) => r.id === s.clubId);
    if (pos < 0 || tabla.length < 2) return 1;
    // 1° → 1,15 · último → 0,85
    return 1.15 - (pos / (tabla.length - 1)) * 0.3;
  },

  cobrarPartidoDeLocal(engine, esClasico) {
    const s = engine.state;
    const club = engine.getClub(s.clubId);
    const d = this.datosDe(club);
    const bruto = d.recaudacionPartidoLocal
      * (esClasico ? d.multiplicadorClasico : 1)
      * this.factorPorRendimiento(engine);
    this.registrar(engine, esClasico ? 'Recaudación del clásico de local' : 'Recaudación de local',
      bruto * this.margen(club) * this.PORCION_DT);
  },

  // ---------- Renovaciones ----------

  costoRenovacion(engine, jugador) {
    const s = engine.state;
    const club = engine.getClub(s.clubId);
    const d = this.datosDe(club);
    let base;
    if (jugador.age <= 21) base = d.costoRenovacionJuvenil;
    else {
      const titulares = engine.getStartingXI().starters.map((e) => e.id);
      base = titulares.includes(jugador.id) ? d.costoRenovacionTitular : d.costoRenovacionSuplente;
    }
    return Math.round(base * this.PRIMA_RENOVACION);
  },

  // ---------- Premios ----------
  //
  // A los premios se les aplica la MISMA porción que al resto. En el primer
  // intento no se la aplicaba y quedaba incoherente: del ingreso de todos los
  // días te daba el 35% pero de la Libertadores te daba el 100%, como si esa
  // plata no pagara sueldos ni deuda. El resultado era que las copas se
  // comían todo: en una prueba de 8 temporadas, el 89% de lo que entró salió
  // de premios de copa y el goteo semanal quedaba de adorno. Con la porción
  // pareja, ganar la Sudamericana sigue siendo un golpe de suerte enorme para
  // un club chico (varios años de ingreso de una) pero no borra el resto.

  porcion(monto) {
    return Math.round(monto * this.PORCION_DT);
  },

  // Copa Argentina: se cobra al pasar cada ronda. `vivos` es cuántos equipos
  // quedaban antes de jugarla.
  premioCopaArgentina(engine, vivos, salioCampeon) {
    const p = ECONOMIA_DATOS.premios.copaArgentina;
    const porRonda = { 32: p.dieciseisavos, 16: p.octavos, 8: p.cuartos, 4: p.semifinal, 2: salioCampeon ? p.campeon : p.subcampeon };
    const monto = porRonda[vivos];
    if (monto) this.registrar(engine, `Copa Argentina — premio por ${vivos === 2 ? (salioCampeon ? 'salir campeón' : 'llegar a la final') : 'pasar de ronda'}`, this.porcion(monto));
  },

  // Libertadores y Sudamericana: acumulativo hasta la instancia alcanzada.
  // `fase` es el texto que arma simulateCopa ('los cuartos de final', etc.).
  //
  // Queda algo afuera a propósito: los datos traen un premio por cada partido
  // ganado en la fase de grupos, pero el juego no guarda cuántos ganó cada
  // club, así que cobrarlo sería inventar el número.
  premioInternacional(engine, copa, fase) {
    const tabla = copa === 'Libertadores' ? ECONOMIA_DATOS.premios.libertadores : ECONOMIA_DATOS.premios.sudamericana;
    const escalera = ['la fase previa', 'la fase de grupos', 'los octavos de final', 'los cuartos de final', 'las semifinales', 'la final', 'el título'];
    const claves = ['fasePrevia', 'grupos', 'octavos', 'cuartos', 'semifinal', 'subcampeon', 'campeon'];
    const hasta = escalera.indexOf(fase);
    if (hasta < 0) return 0;
    let total = 0;
    for (let i = 0; i <= hasta; i++) {
      // Si salió campeón no cobra además el premio de subcampeón.
      if (claves[i] === 'subcampeon' && hasta === escalera.length - 1) continue;
      total += tabla[claves[i]] || 0;
    }
    const paraElDT = this.porcion(total);
    if (paraElDT) this.registrar(engine, `${copa} — premio por llegar a ${fase}`, paraElDT);
    return paraElDT;
  },

  premioTitulo(engine, edicion) {
    const p = ECONOMIA_DATOS.premios.ligaProfesional;
    const monto = edicion === 'apertura' ? p.campeonApertura : p.campeonClausura;
    this.registrar(engine, `Campeón del ${edicion === 'apertura' ? 'Apertura' : 'Clausura'}`, this.porcion(monto));
    return this.porcion(monto);
  },

  // ---------- Resumen para mostrar ----------

  resumenAnual(club) {
    const d = this.datosDe(club);
    const semanal = this.ingresoSemanalFijo(club);
    const local = Math.round(d.recaudacionPartidoLocal * this.margen(club) * this.PORCION_DT);
    return {
      categoria: this.categoriaDe(club),
      semanal,
      local,
      // 16 fechas por edición, dos ediciones, mitad de local.
      estimadoAnual: semanal * this.SEMANAS_POR_ANIO + local * 16,
    };
  },

  // Formato de plata propio. El money() de ui.js hace lo mismo, pero el motor
  // no debería depender de una función de la interfaz para armar un texto.
  monto(n) {
    return '$' + Math.round(n).toLocaleString('es-AR');
  },

  nuevaTemporada(s) {
    const f = this.init(s);
    f.totalTemporada = 0;
  },
};
