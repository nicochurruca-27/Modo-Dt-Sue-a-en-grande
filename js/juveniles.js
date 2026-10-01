// Las inferiores: la cantera de cada club.
//
// Esto es lo que faltaba para que el mundo no se vacíe. Hasta acá, los clubes
// con plantel real perdían un jugador por retiro cada temporada y no reponían
// a nadie: medido en el navegador, en la temporada 15 el club más chico
// quedaba con 8 jugadores y no podía ni parar un once. El comentario de
// Mercado.plantel ya decía que la reposición iba a llegar "por donde
// corresponde —el mercado y, más adelante, las inferiores". Esto es eso.
//
// ---------- Lo que NO se guarda ----------
//
// Una cantera de 8 pibes por club, por 30 clubes, por temporada, sería una
// montaña de datos en el guardado. Así que no se guarda casi nada: la camada
// de cada club sale de una SEMILLA (el id del club y el año), igual que los
// planteles rivales. El mismo club en la misma temporada saca siempre los
// mismos juveniles, en cualquier partida y en cualquier aparato, sin ocupar
// un byte.
//
// Lo único que se guarda son TUS decisiones —a quién subiste, a quién dejaste
// ir— y el jugador que te trajo el ojeador, que ese sí es tuyo y no sale de
// ninguna semilla.
//
// ---------- Cómo funciona una camada ----------
//
// Cada temporada entran POR_CAMADA pibes de 15, 16 o 17 años. Se quedan
// hasta los 19 inclusive. A los 20 se van: o los subiste a Primera, o los
// perdiste. Así que en cualquier momento la cantera tiene entre 6 y 10
// jugadores de edades mezcladas, que es lo que se ve en el panel.
//
// En la temporada 1 no hay temporadas anteriores, pero la cantera no puede
// arrancar vacía: se generan igual las camadas de los años previos (la
// semilla es un texto, así que "temporada -2" es una semilla perfectamente
// válida). Por eso el juego arranca con la cantera ya poblada.
//
// ---------- Los clubes rivales ----------
//
// A los rivales nadie les maneja la cantera, así que sus juveniles ascienden
// SOLOS y de forma determinista (ver egresados). Un club sube a los mejores
// que tenga disponibles, los que hagan falta para no bajar del piso de
// plantel. Eso no cuesta un byte de guardado tampoco: se calcula cada vez a
// partir de la misma semilla.

// ---------- Los cinco niveles de techo ----------
//
// El techo (`projection`) es hasta dónde puede llegar el jugador, y es lo
// único que de verdad importa de un juvenil: su valoración de hoy es baja
// siempre.
//
// Cada nivel tiene dos nombres: el `corto` es el de la chapita de la lista,
// donde el ancho es de oro (en un celular de 390px, con el nombre largo la
// chapita se comía el nombre del jugador), y el `label` es el de la ficha,
// donde hay lugar para decirlo bien.
const NIVELES_DE_JUVENIL = [
  { id: 'descarte', corto: 'Flojo', label: 'Difícil que llegue', techo: [50, 62], color: '#94a3b8' },
  { id: 'normal', corto: 'Normal', label: 'Puede llegar', techo: [63, 71], color: '#38bdf8' },
  { id: 'promesa', corto: 'Promesa', label: 'Promesa', techo: [72, 79], color: '#22c55e' },
  { id: 'crack', corto: 'Crack', label: 'Crack', techo: [80, 86], color: '#f59e0b' },
  { id: 'estrella', corto: 'Estrella', label: 'Estrella mundial', techo: [87, 93], color: '#ef4444' },
];

// Con qué frecuencia sale cada nivel, según la CANTERA del club (1 a 5, ver
// CANTERAS en data.js). Cada fila suma 1.
//
// Los números están puestos para que la diferencia se sienta sin volverse
// absurda. Aldosivi tiene cantera 2: de cada 100 juveniles suyos, 2 son
// estrellas mundiales, o sea que sacar una es cosa de una vez cada 25
// temporadas. River, Boca, Argentinos y Vélez tienen cantera 5: 8 de cada
// 100, una estrella cada cinco o seis temporadas. Difícil en los dos casos,
// pero difícil de dos maneras distintas.
//
// Los niveles 6 y 7 no los usa ningún club argentino: están puestos de
// antemano para cuando entren al juego los clubes europeos grandes, donde
// que aparezca una joya en las inferiores SÍ es lo habitual.
const REPARTO_DE_CANTERA = {
  1: [0.50, 0.35, 0.13, 0.015, 0.005],
  2: [0.42, 0.36, 0.16, 0.04, 0.02],
  3: [0.34, 0.36, 0.21, 0.06, 0.03],
  4: [0.26, 0.34, 0.24, 0.11, 0.05],
  5: [0.18, 0.30, 0.28, 0.16, 0.08],
  6: [0.12, 0.24, 0.30, 0.21, 0.13],
  7: [0.08, 0.18, 0.30, 0.26, 0.18],
};

// Los puestos que puede salir un juvenil, con su peso. Un plantel necesita
// muchos más defensores y mediocampistas que arqueros, y la cantera tiene que
// acompañar eso: si saliera uno de cada puesto al azar, en diez temporadas
// tendrías nueve arqueros.
const PUESTOS_DE_CANTERA = [
  { pos: 'POR', peso: 0.10 },
  { pos: 'DEF', peso: 0.32 },
  { pos: 'MED', peso: 0.34 },
  { pos: 'DEL', peso: 0.24 },
];

const Juveniles = {
  // Cuántos entran por temporada, y hasta qué edad se quedan.
  POR_CAMADA: 2,
  EDAD_MAXIMA: 19,
  // Cuántas temporadas para atrás se miran al reconstruir los egresados de un
  // club rival. Un pibe que subió a los 20 se retira a los 40, así que más
  // atrás que esto no hay nadie vivo y solo sería trabajo al pedo.
  CAMADAS_QUE_SE_MIRAN: 22,
  // Piso de plantel de un club rival: si baja de acá, sube juveniles. No es
  // un número fijo para todos, y esa fue una corrección importante: con un
  // piso parejo de 24, de la temporada 15 en adelante los 30 clubes tenían
  // exactamente 24 jugadores —el piso se había vuelto techo— y la liga entera
  // quedaba del mismo tamaño, que es justo lo contrario de lo que se busca.
  // Ahora cada club apunta al tamaño que tenía su plantel de verdad, menos un
  // margen: Boca sostiene un plantel más grande que Instituto porque en la
  // realidad lo tiene.
  PISO_MINIMO: 20,
  PISO_MAXIMO: 30,
  MARGEN_DEL_PISO: 5,

  pisoDe(clubId) {
    const real = typeof REAL_ROSTERS !== 'undefined' && REAL_ROSTERS[clubId];
    const tamanio = real ? real.length : 26;
    return Math.max(this.PISO_MINIMO, Math.min(this.PISO_MAXIMO, tamanio - this.MARGEN_DEL_PISO));
  },
  // Cuánto tarda el ojeador en volver de un viaje, en días de almanaque.
  DIAS_DE_VIAJE: 30,
  // Cuántos jugadores trae en el informe.
  DEL_INFORME: 12,

  NIVELES: NIVELES_DE_JUVENIL,

  // ---------- Estado guardado ----------

  init(s) {
    if (!s.juveniles) s.juveniles = {};
    const j = s.juveniles;
    // Los ids de los que subiste a Primera y de los que dejaste ir. Con eso
    // alcanza para reconstruir la cantera entera desde la semilla.
    if (!Array.isArray(j.subidos)) j.subidos = [];
    if (!Array.isArray(j.liberados)) j.liberados = [];
    // Los que te trajo el ojeador. Estos NO salen de ninguna semilla, así que
    // se guardan enteros.
    if (!Array.isArray(j.fichados)) j.fichados = [];
    // El viaje en curso, y el informe esperando que elijas.
    if (j.ojeador === undefined) j.ojeador = null;
    if (j.informe === undefined) j.informe = null;
    return j;
  },

  // ---------- La semilla ----------

  semilla(texto) {
    return Mercado.semilla(texto);
  },

  generador(sem) {
    return Mercado.generador(sem);
  },

  // Un número entero entre a y b, los dos incluidos.
  entre(rnd, a, b) {
    return a + Math.floor(rnd() * (b - a + 1));
  },

  // El nivel que le toca a este juvenil, según la cantera de su club.
  nivelSorteado(rnd, cantera) {
    const reparto = REPARTO_DE_CANTERA[cantera] || REPARTO_DE_CANTERA[3];
    const r = rnd();
    let acc = 0;
    for (let i = 0; i < reparto.length; i++) {
      acc += reparto[i];
      if (r <= acc) return NIVELES_DE_JUVENIL[i];
    }
    return NIVELES_DE_JUVENIL[0];
  },

  puestoSorteado(rnd) {
    const r = rnd();
    let acc = 0;
    for (const p of PUESTOS_DE_CANTERA) {
      acc += p.peso;
      if (r <= acc) return p.pos;
    }
    return 'MED';
  },

  // ---------- Generar un juvenil ----------
  //
  // Todo sale del generador sembrado y en un orden fijo. Agregar un sorteo en
  // el medio de esta función corre toda la secuencia y cambia las canteras de
  // las partidas ya empezadas, igual que pasa en Mercado.plantel: si hay que
  // sortear algo nuevo, va al final.
  generarUno(engine, club, temporadaDeIngreso, indice) {
    const id = `${club.id}-j${temporadaDeIngreso}-${indice}`;
    const rnd = this.generador(this.semilla(id));
    const cantera = engine.canteraDe(club);
    const nivel = this.nivelSorteado(rnd, cantera);
    const techo = this.entre(rnd, nivel.techo[0], nivel.techo[1]);
    const edadAlIngresar = this.entre(rnd, 15, 17);
    const pos = this.puestoSorteado(rnd);
    const nation = Mercado.nacionSembrada(rnd);
    const name = Mercado.nombreSembrado(rnd, nation);
    const zurdo = rnd() < (pos === 'POR' ? 0.12 : 0.24);
    const altura = pos === 'POR' ? this.entre(rnd, 183, 196) : this.entre(rnd, 166, 192);
    const peso = Math.round(altura * 0.4 - 4 + rnd() * 8);
    const role = pos === 'MED' ? ['contención', 'mixto', 'ofensivo'][Math.floor(rnd() * 3)] : undefined;
    // El sorteo del puesto detallado va acá y no en posDetalladaPara() porque
    // esa función elige por índice dentro del plantel, y una cantera no es un
    // plantel: no necesita dos laterales por lado.
    const opciones = engine.POS_DETALLE_POR_PUESTO[pos] || [];
    const posDetail = pos === 'MED' && role
      ? engine.POS_DETALLE_POR_ROL[role]
      : opciones[Math.floor(rnd() * opciones.length)];

    // La fecha de nacimiento sale del id (no del sorteo, para no correr la
    // secuencia) y de la edad que tenía el día que entró a la cantera.
    const birthDate = engine.fechaDeNacimientoSembrada(
      id, edadAlIngresar, engine.fechaDeJuegoDeLaTemporada(temporadaDeIngreso));
    const edad = engine.edadDe({ birthDate });

    return {
      id,
      name,
      clubId: club.id,
      camada: temporadaDeIngreso,
      pos,
      posDetail,
      role,
      nation,
      birthDate,
      age: edad,
      // Un juvenil vale hoy lo que vale hoy, que es poco. Lo que se compra al
      // subirlo es el techo, no esto.
      rating: this.ratingDeHoy(techo, edad, edadAlIngresar),
      projection: techo,
      nivel: nivel.id,
      nivelLabel: nivel.label,
      nivelCorto: nivel.corto,
      nivelColor: nivel.color,
      pierna: zurdo ? 'izquierda' : 'derecha',
      altura,
      peso,
      juvenil: true,
    };
  },

  // La valoración de hoy. Sube con la edad y con el techo: un pibe de 19 con
  // techo 90 ya es bastante mejor que uno de 15 con techo 60, que es lo que
  // pasa de verdad. Nunca llega al techo estando en la cantera —para eso hay
  // que jugar en Primera.
  ratingDeHoy(techo, edad, edadAlIngresar) {
    const anios = Math.max(0, edad - edadAlIngresar);
    const base = 36 + (edad - 15) * 3.5 + (techo - 60) * 0.28 + anios * 0.8;
    return Math.max(32, Math.min(techo - 3, Math.round(base)));
  },

  // ---------- La cantera de un club ----------

  // Las camadas que todavía están en la cantera en esta temporada: la de este
  // año y las de los años anteriores cuyos pibes no pasaron la edad.
  camada(engine, clubId) {
    const club = engine.getClub(clubId);
    if (!club) return [];
    const s = engine.state;
    const temporada = s.season ? s.season.year : 1;
    const j = this.init(s);
    const fuera = new Set([...j.subidos, ...j.liberados]);
    const lista = [];
    // Se mira desde la camada de este año hacia atrás. Con entrada a los 15 y
    // salida a los 19 cumplidos, cinco camadas alcanzan y sobran.
    for (let atras = 0; atras <= 5; atras++) {
      for (let i = 0; i < this.POR_CAMADA; i++) {
        const p = this.generarUno(engine, club, temporada - atras, i);
        if (p.age > this.EDAD_MAXIMA) continue;
        if (fuera.has(p.id)) continue;
        lista.push(p);
      }
    }
    // Los que trajo el ojeador van con los demás.
    if (clubId === s.clubId) {
      (j.fichados || []).forEach((f) => {
        if (fuera.has(f.id)) return;
        const p = this.refrescar(engine, f);
        if (p.age > this.EDAD_MAXIMA) return;
        lista.push(p);
      });
    }
    // Primero el que más lejos puede llegar: es el orden en el que uno los
    // mira.
    return lista.sort((a, b) => b.projection - a.projection || b.rating - a.rating);
  },

  // Un juvenil guardado (los del ojeador) vuelve a la vida con la edad y la
  // valoración del día de hoy. Lo guardado es su ficha, no su foto de ayer.
  refrescar(engine, f) {
    const edad = engine.edadDe(f);
    return {
      ...f,
      age: edad,
      rating: this.ratingDeHoy(f.projection, edad, f.edadAlIngresar || edad),
      juvenil: true,
    };
  },

  buscar(engine, id) {
    return this.camada(engine, engine.state.clubId).find((p) => p.id === id) || null;
  },

  // ---------- Subir a Primera ----------

  // Lo que cuesta ponerle el primer contrato profesional. No es un pase: no se
  // le paga a nadie por el jugador, es del club. Lo que se paga es la prima de
  // la firma, que sale del sueldo que le va a corresponder.
  costoDeSubir(engine, p) {
    return Math.round(this.sueldoDe(engine, p) * 0.5);
  },

  sueldoDe(engine, p) {
    // La curva salarial del juego sabe cuánto gana un jugador de tal
    // valoración a tal edad. A un juvenil se le paga por lo que es hoy, no por
    // lo que puede llegar a ser, con un plus chico si el techo es alto: a una
    // joya hay que asegurarla.
    const base = Economia.curvaSalarial(p.rating, p.age);
    const plusPorTecho = 1 + Math.max(0, p.projection - p.rating) * 0.012;
    return Math.round(base * plusPorTecho);
  },

  puedeSubir(engine, p) {
    const s = engine.state;
    if (!p) return { ok: false, motivo: 'Ese juvenil ya no está en la cantera.' };
    const costo = this.costoDeSubir(engine, p);
    if (s.budget < costo) {
      return { ok: false, motivo: `La prima de contrato son ${Mercado.plata(costo)} y no los tenés.` };
    }
    return { ok: true, costo };
  },

  subir(engine, id) {
    const s = engine.state;
    const j = this.init(s);
    const p = this.buscar(engine, id);
    const permiso = this.puedeSubir(engine, p);
    if (!permiso.ok) return { ok: false, nota: permiso.motivo };

    Economia.registrar(engine, `Primer contrato de ${p.name}`, -permiso.costo);
    s.squad.push({
      number: this.dorsalLibre(s.squad),
      id: p.id,
      name: p.name,
      pos: p.pos,
      posDetail: p.posDetail,
      role: p.role,
      nation: p.nation,
      birthDate: p.birthDate,
      age: p.age,
      rating: p.rating,
      potential: p.projection,
      contractYears: 3,
      salary: this.sueldoDe(engine, p),
      energia: ENERGIA_MAXIMA,
      // De dónde salió. Se muestra en la ficha y, además, es lo que hace que
      // un pibe de la casa se sienta distinto a uno comprado.
      deLaCantera: true,
      altura: p.altura,
      peso: p.peso,
      pierna: p.pierna,
    });
    j.subidos.push(p.id);
    engine._fuerzas = {};
    engine.repairStartingSlots();
    if (typeof Noticias !== 'undefined') {
      Noticias.debutJuvenil(engine, p);
    }
    engine.save();
    return { ok: true, nota: `${p.name} firmó su primer contrato profesional. Prima: ${Mercado.plata(permiso.costo)}.`, jugador: p };
  },

  // El primer dorsal libre del plantel. Los pibes de la cantera no eligen
  // número: les dan el que sobra, y suele ser alto.
  dorsalLibre(squad) {
    const tomados = new Set((squad || []).map((x) => x.number).filter((n) => n != null));
    for (let n = 2; n <= 99; n++) if (!tomados.has(n)) return n;
    return null;
  },

  liberar(engine, id) {
    const s = engine.state;
    const j = this.init(s);
    const p = this.buscar(engine, id);
    if (!p) return { ok: false, nota: 'Ese juvenil ya no está en la cantera.' };
    j.liberados.push(p.id);
    engine.save();
    return { ok: true, nota: `${p.name} quedó libre. Ya no está en las inferiores del club.` };
  },

  // ---------- Los que se pasan de edad ----------
  //
  // A los 20 se termina: o firmó contrato, o se va. Es la contracara de que
  // tenerlos en la cantera no cueste nada — si pudieras guardarlos para
  // siempre gratis, no habría decisión que tomar.
  //
  // Se corre al cerrar la temporada, junto con los retiros.
  cerrarTemporada(engine) {
    const s = engine.state;
    const j = this.init(s);
    const temporada = s.season ? s.season.year : 1;
    const avisos = [];
    // Al cerrar el año todos cumplen uno más, así que el que hoy tiene 19 ya
    // no entra a la temporada que viene.
    this.camada(engine, s.clubId).forEach((p) => {
      if (engine.edadAlCierreDeTemporada(p, temporada) <= this.EDAD_MAXIMA) return;
      j.liberados.push(p.id);
      avisos.push({
        tono: p.projection >= 80 ? 'malo' : 'neutro',
        texto: `${p.name} (${p.posDetail}, techo ${p.projection}) se fue libre: cumplió la edad y nunca le hiciste contrato.`,
      });
      if (typeof Noticias !== 'undefined' && p.projection >= 78) {
        Noticias.juvenilQueSeFue(engine, p);
      }
    });
    // La lista de decisiones no puede crecer para siempre: los ids de camadas
    // viejas ya no los busca nadie, porque esos pibes pasaron la edad.
    this.podar(engine);
    return avisos;
  },

  // ---------- La red de seguridad de TU club ----------
  //
  // Un club no juega con once. Si se te retiraron cuatro y no subiste a nadie,
  // el club sube pibes SOLO, porque es lo que haría cualquier club de verdad:
  // no se presenta a jugar con lo justo.
  //
  // Medido antes de esto: dejando correr quince temporadas sin tocar nada, el
  // plantel del usuario bajaba de 32 a 11 jugadores. Los rivales ya tenían su
  // reposición (ver egresados); al club del usuario le faltaba.
  //
  // El piso es el mismo mínimo que usa todo el juego: los once y el banco. Por
  // debajo de eso el equipo no se puede presentar, así que si los retiros te
  // dejaron corto, el club sube pibes y listo. De ahí para arriba decidís vos.
  reponerPlantelDelUsuario(engine) {
    const s = engine.state;
    const faltan = MIN_SQUAD - (s.squad || []).length;
    if (faltan <= 0) return [];
    const disponibles = this.camada(engine, s.clubId);
    // Si al club no le quedó arquero, el primero que sube es arquero: sin
    // nadie al arco no se puede jugar, por más jugadores de campo que haya.
    const suben = [];
    if (!engine.cuantosArqueros(s.squad)) {
      const arquero = disponibles.find((p) => p.pos === 'POR');
      if (arquero) suben.push(arquero);
    }
    disponibles.forEach((p) => {
      if (suben.length >= faltan) return;
      if (!suben.includes(p)) suben.push(p);
    });
    const avisos = [];
    suben.forEach((p) => {
      // Sube gratis: es una urgencia del club, no un fichaje que decidiste. El
      // sueldo sí lo va a pagar, como cualquier contrato.
      const j = this.init(s);
      s.squad.push({
        id: p.id, name: p.name, pos: p.pos, posDetail: p.posDetail, role: p.role,
        nation: p.nation, birthDate: p.birthDate, age: p.age,
        rating: p.rating, potential: p.projection,
        contractYears: 3, salary: this.sueldoDe(engine, p),
        energia: ENERGIA_MAXIMA, deLaCantera: true,
        number: this.dorsalLibre(s.squad),
        altura: p.altura, peso: p.peso, pierna: p.pierna,
      });
      j.subidos.push(p.id);
      avisos.push({
        tono: 'neutro',
        texto: `${p.name} (${p.posDetail}, ${p.age} años) subió de inferiores: el plantel estaba corto y el club no podía dejarlo así.`,
      });
    });
    if (suben.length) {
      engine._fuerzas = {};
      engine.repairStartingSlots();
    }
    return avisos;
  },

  // Saca de las listas guardadas a los que ya no pueden estar en ninguna
  // cantera. Sin esto, `liberados` sumaría dos ids por temporada por siempre.
  podar(engine) {
    const s = engine.state;
    const j = this.init(s);
    const temporada = s.season ? s.season.year : 1;
    const vigente = (id) => {
      const m = /-j(-?\d+)-\d+$/.exec(id);
      // Los del ojeador no tienen camada en el id: esos se podan por edad.
      if (!m) return true;
      return Number(m[1]) > temporada - 6;
    };
    // Los subidos SÍ se conservan: si se podaran, el pibe volvería a aparecer
    // en la cantera al mismo tiempo que está en el plantel.
    j.liberados = j.liberados.filter(vigente);
    j.fichados = (j.fichados || []).filter((f) => engine.edadDe(f) <= this.EDAD_MAXIMA);
  },

  // ---------- Los clubes rivales ----------
  //
  // Un club que no dirigís sube sus juveniles solo. No se guarda nada: se
  // calcula igual que el resto del plantel, a partir de la semilla.
  //
  // La regla es simple y se explica sola: un club sube a los mejores que
  // tenga hasta llegar al piso de plantel. Un club al que se le retiraron
  // tres veteranos sube tres pibes; uno que está completo no sube a ninguno.
  // Así los planteles no se vacían y, al mismo tiempo, no se inflan.
  // `sinArquero` lo pasa Mercado.plantel cuando al club no le quedó ninguno:
  // en ese caso sube un arquero sí o sí, aunque el plantel ya esté completo.
  egresados(engine, clubId, cuantosFaltan, sinArquero) {
    if (cuantosFaltan <= 0 && !sinArquero) return [];
    const club = engine.getClub(clubId);
    if (!club) return [];
    const temporada = engine.state.season ? engine.state.season.year : 1;
    const candidatos = [];
    // Las camadas que ya pasaron por la cantera y hoy tendrían edad de
    // Primera. La de este año no: todavía están en inferiores.
    for (let atras = 1; atras <= this.CAMADAS_QUE_SE_MIRAN; atras++) {
      const cuando = temporada - atras;
      for (let i = 0; i < this.POR_CAMADA; i++) {
        const p = this.generarUno(engine, club, cuando, i);
        if (p.age <= this.EDAD_MAXIMA) continue;
        if (engine.yaSeRetiro(p)) continue;
        candidatos.push(p);
      }
    }
    // Los mejores primero: un club sube al que más promete, no al primero que
    // encuentra.
    candidatos.sort((a, b) => b.projection - a.projection || b.rating - a.rating);
    // ...con una excepción: si al club no le quedó ningún arquero, el primero
    // que sube es un arquero aunque haya pibes mejores en otros puestos. Un
    // club sin nadie al arco no puede jugar, y es la necesidad más urgente
    // que puede tener. Es lo único que la cantera mira del puesto.
    const elegidos = [];
    if (sinArquero) {
      const arquero = candidatos.find((p) => p.pos === 'POR');
      if (arquero) elegidos.push(arquero);
    }
    candidatos.forEach((p) => {
      if (elegidos.length >= cuantosFaltan) return;
      if (!elegidos.includes(p)) elegidos.push(p);
    });
    return elegidos.slice(0, Math.max(cuantosFaltan, elegidos.length ? 1 : 0)).map((p) => {
      // Ya no es un juvenil: es un jugador de Primera que entró por la cantera
      // y que envejeció y creció desde que subió.
      const edadAlSubir = this.EDAD_MAXIMA + 1;
      const aniosDeProfesional = Math.max(0, p.age - edadAlSubir);
      return {
        ...p,
        juvenil: false,
        deLaCantera: true,
        rating: Mercado.ratingConLosAnios(
          this.ratingDeHoy(p.projection, edadAlSubir, 16),
          edadAlSubir, p.projection, aniosDeProfesional),
        contractYears: 1 + ((p.age + p.projection) % 4),
      };
    });
  },

  // ---------- El ojeador ----------
  //
  // Mandar al ojeador a un país tarda un mes de almanaque. Vuelve con una
  // lista de DEL_INFORME chicos de los puestos que le pediste, y te quedás con
  // uno. Los otros once no existen más: son chicos que vio y no trajo.

  // A dónde se lo puede mandar. Sale de los países para los que el juego tiene
  // nombres cargados (NAMES_BY_NATION en data.js): mandarlo a un país sin
  // nombres devolvería doce argentinos, que es peor que no poder mandarlo.
  paises() {
    return Object.keys(typeof NAMES_BY_NATION === 'undefined' ? {} : NAMES_BY_NATION);
  },

  ojeadorEnViaje(s) {
    const j = this.init(s);
    return j.ojeador || null;
  },

  diasQueFaltan(s) {
    const j = this.init(s);
    if (!j.ojeador) return 0;
    return Math.max(0, j.ojeador.vuelve - (s.calendar ? s.calendar.dayCount : 0));
  },

  mandarOjeador(engine, pais, puestos) {
    const s = engine.state;
    const j = this.init(s);
    if (j.ojeador) return { ok: false, nota: 'El ojeador ya está de viaje.' };
    if (j.informe) return { ok: false, nota: 'Primero resolvé el informe que trajo.' };
    const limpios = (puestos || []).filter((p) => ['POR', 'DEF', 'MED', 'DEL'].includes(p)).slice(0, 2);
    if (!limpios.length) return { ok: false, nota: 'Elegí al menos un puesto.' };
    if (!this.paises().includes(pais)) return { ok: false, nota: 'A ese país no lo podemos cubrir.' };
    j.ojeador = {
      pais,
      puestos: limpios,
      // El día en que vuelve, en días de almanaque.
      vuelve: (s.calendar ? s.calendar.dayCount : 0) + this.DIAS_DE_VIAJE,
      temporada: s.season ? s.season.year : 1,
    };
    engine.save();
    return { ok: true, nota: `El ojeador salió para ${engine.nationName(pais)}. Vuelve en un mes.` };
  },

  // La llama Engine.avanzarUnDia todos los días. Devuelve true si el ojeador
  // volvió justo hoy, que es lo que frena el avance del almanaque.
  revisarOjeador(engine) {
    const s = engine.state;
    const j = this.init(s);
    if (!j.ojeador) return false;
    if ((s.calendar ? s.calendar.dayCount : 0) < j.ojeador.vuelve) return false;
    const viaje = j.ojeador;
    j.ojeador = null;
    j.informe = {
      pais: viaje.pais,
      puestos: viaje.puestos,
      jugadores: this.armarInforme(engine, viaje),
    };
    if (typeof Noticias !== 'undefined') Noticias.volvioElOjeador(engine, viaje.pais);
    engine.save();
    return true;
  },

  // Los doce del informe. Se generan una sola vez, al volver, y se guardan
  // hasta que elijas: si se regeneraran en cada dibujado de pantalla, la lista
  // cambiaría abajo del dedo.
  armarInforme(engine, viaje) {
    const club = engine.getClub(engine.state.clubId);
    const rnd = this.generador(this.semilla(
      `${engine.state.clubId}-ojeo-${viaje.temporada}-${viaje.vuelve}-${viaje.pais}`));
    // El ojeador de un club grande consigue mejores entrevistas que el de uno
    // chico, pero la diferencia es MUCHO más chica que en la cantera propia:
    // la gracia de mandarlo es justamente que un club chico pueda encontrar
    // afuera lo que no le sale en casa.
    const cantera = Math.max(1, Math.min(5, Math.round((engine.canteraDe(club) + 5) / 2)));
    const lista = [];
    for (let i = 0; i < this.DEL_INFORME; i++) {
      const id = `ojeo-${viaje.temporada}-${viaje.vuelve}-${i}`;
      const r = this.generador(this.semilla(id));
      const nivel = this.nivelSorteado(r, cantera);
      const techo = this.entre(r, nivel.techo[0], nivel.techo[1]);
      const edadAlIngresar = this.entre(r, 15, 17);
      const pos = viaje.puestos[Math.floor(rnd() * viaje.puestos.length)];
      const name = Mercado.nombreSembrado(r, viaje.pais);
      const zurdo = r() < (pos === 'POR' ? 0.12 : 0.24);
      const altura = pos === 'POR' ? this.entre(r, 183, 196) : this.entre(r, 166, 192);
      const role = pos === 'MED' ? ['contención', 'mixto', 'ofensivo'][Math.floor(r() * 3)] : undefined;
      const opciones = engine.POS_DETALLE_POR_PUESTO[pos] || [];
      const posDetail = pos === 'MED' && role
        ? engine.POS_DETALLE_POR_ROL[role]
        : opciones[Math.floor(r() * opciones.length)];
      const birthDate = engine.fechaDeNacimientoSembrada(id, edadAlIngresar, engine.fechaDelJuego());
      const edad = engine.edadDe({ birthDate });
      lista.push({
        id, name, pos, posDetail, role, nation: viaje.pais,
        birthDate, age: edad, edadAlIngresar,
        rating: this.ratingDeHoy(techo, edad, edadAlIngresar),
        projection: techo,
        nivel: nivel.id, nivelLabel: nivel.label, nivelCorto: nivel.corto, nivelColor: nivel.color,
        pierna: zurdo ? 'izquierda' : 'derecha',
        altura, peso: Math.round(altura * 0.4 - 4 + r() * 8),
        juvenil: true, delOjeador: true,
      });
    }
    return lista.sort((a, b) => b.projection - a.projection);
  },

  // Te quedás con los que quieras del informe, no con uno solo. El límite de
  // uno era una regla nuestra sin razón: si el ojeador vio doce chicos y a vos
  // te sirven cuatro, te llevás cuatro. Tenerlos en inferiores no cuesta nada;
  // el costo aparece cuando los subís a Primera, que es donde tiene que estar
  // la decisión difícil.
  elegirDelInforme(engine, id) {
    const s = engine.state;
    const j = this.init(s);
    if (!j.informe) return { ok: false, nota: 'No hay ningún informe abierto.' };
    const elegido = j.informe.jugadores.find((p) => p.id === id);
    if (!elegido) return { ok: false, nota: 'Ese chico no está en el informe.' };
    j.fichados.push({ ...elegido, clubId: s.clubId, camada: s.season ? s.season.year : 1 });
    // Sale del informe, y el informe sigue abierto con los que quedan.
    j.informe.jugadores = j.informe.jugadores.filter((p) => p.id !== id);
    if (!j.informe.jugadores.length) j.informe = null;
    engine.save();
    return { ok: true, nota: `${elegido.name} se suma a las inferiores del club.`, jugador: elegido };
  },

  descartarInforme(engine) {
    const j = this.init(engine.state);
    j.informe = null;
    engine.save();
    return { ok: true, nota: 'No te quedaste con ninguno.' };
  },
};
