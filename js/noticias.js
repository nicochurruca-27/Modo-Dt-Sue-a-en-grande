// Portal de noticias del juego: el "diario deportivo" que se va llenando
// solo a medida que avanza el calendario.
//
// La regla de oro de este archivo: **una noticia se arma sobre algo que de
// verdad pasó en la partida**, no sobre texto inventado al azar. Los
// resultados salen de los partidos que simuló el motor, las lesiones de los
// jugadores que efectivamente se lesionaron, el mercado de las operaciones
// que hizo el usuario y las copas de la Libertadores/Sudamericana que se
// jugaron. Lo único que se genera de la nada es el color de relleno de los
// clubes rivales (ver "Relleno de color" más abajo), porque el juego no modela
// los planteles de los otros equipos: ahí sí hay nombres de jugadores
// inventados con el mismo generador que usa el resto del juego.
//
// La excepción es joyaJuvenil(): el pibe que nombra existe de verdad en el
// plantel de ese club y lo podés ir a fichar al Mercado de pases.
//
// Todo lo que se guarda en s.noticias es JSON puro (strings y números), sin
// funciones ni objetos Date, para que sobreviva al save/load de localStorage
// igual que el resto del estado.

const NOTICIA_CATEGORIAS = {
  ultimahora: { label: 'Última hora', color: '#ef4444' },
  resultados: { label: 'Resultados', color: '#22c55e' },
  lesiones: { label: 'Lesión', color: '#f59e0b' },
  mercado: { label: 'Mercado de pases', color: '#38bdf8' },
  premios: { label: 'Premios', color: '#a78bfa' },
  internacional: { label: 'Internacional', color: '#f472b6' },
};

// Orden en el que se muestran las pestañas del feed.
const NOTICIA_ORDEN_CATEGORIAS = ['ultimahora', 'resultados', 'lesiones', 'mercado', 'premios', 'internacional'];

const Noticias = {
  // Cuántas noticias se guardan. Más que esto no sirve: el feed muestra las
  // últimas y el resto solo agranda el save.
  MAX: 30,

  // ---------- Utilidades ----------

  init(s) {
    if (!Array.isArray(s.noticias)) s.noticias = [];
    return s.noticias;
  },

  // `destacada` marca la noticia que va arriba de todo como titular grande.
  // `clubId` (opcional) es el club argentino al que se le muestra el escudo.
  push(s, cat, titular, bajada, extra) {
    const lista = this.init(s);
    const op = extra || {};
    // Un mismo titular puede repetirse de verdad (el mismo jugador con la
    // misma molestia en dos fechas distintas, por ejemplo). No es un error,
    // pero ver dos tarjetas idénticas juntas parece uno, así que no se
    // agrega si la misma frase todavía está a la vista en el feed.
    if (lista.slice(0, 8).some((n) => n.titular === titular)) return;
    lista.unshift({
      id: `n${s.calendar ? s.calendar.dayCount : 0}-${lista.length}-${Math.floor(Math.random() * 100000)}`,
      cat,
      titular,
      bajada: bajada || '',
      dia: s.calendar ? s.calendar.dayCount : 0,
      clubId: op.clubId || null,
      destacada: !!op.destacada,
    });
    if (lista.length > this.MAX) lista.length = this.MAX;
  },

  alAzar(lista) { return lista[Math.floor(Math.random() * lista.length)]; },

  // ---------- Enganches con el motor ----------
  //
  // Cada uno de estos se llama desde engine.js justo después de que pasó la
  // cosa real que la noticia cuenta.

  // Después de jugarse una fecha completa de la liga.
  trasLaFecha(engine) {
    const s = engine.state;
    const resultados = (s.season && s.season.lastRoundResults) || [];
    if (!resultados.length) return;

    const nombre = (id) => engine.getClub(id).name;
    const rep = (id) => engine.getClub(id).reputation;
    const fecha = s.season.roundIndex + 1;

    const conDatos = resultados.map((r) => {
      const dif = Math.abs(r.hg - r.ag);
      const ganador = r.hg > r.ag ? r.home : r.ag > r.hg ? r.away : null;
      const perdedor = ganador ? (ganador === r.home ? r.away : r.home) : null;
      return { ...r, dif, ganador, perdedor };
    });

    // 1) La goleada de la fecha.
    const goleadas = conDatos.filter((r) => r.dif >= 3).sort((a, b) => b.dif - a.dif);
    if (goleadas.length) {
      const g = goleadas[0];
      this.push(s, 'resultados',
        `${nombre(g.ganador)} lo pasó por arriba: ${g.hg}-${g.ag} a ${nombre(g.perdedor)}`,
        `Goleada en la fecha ${fecha}. ${g.dif === 3 ? 'Diferencia de tres goles' : `Le metió ${g.dif} de diferencia`} y se llevó los tres puntos sin discusión.`,
        { clubId: g.ganador, destacada: g.dif >= 4 });
    }

    // 2) El batacazo: un club chico que le ganó a uno grande.
    const batacazos = conDatos
      .filter((r) => r.ganador && rep(r.perdedor) - rep(r.ganador) >= 2)
      .sort((a, b) => (rep(b.perdedor) - rep(b.ganador)) - (rep(a.perdedor) - rep(a.ganador)));
    if (batacazos.length) {
      const b = batacazos[0];
      this.push(s, 'ultimahora',
        `Batacazo: ${nombre(b.ganador)} le ganó ${Math.max(b.hg, b.ag)}-${Math.min(b.hg, b.ag)} a ${nombre(b.perdedor)}`,
        `Nadie lo esperaba. ${nombre(b.ganador)} dio el golpe de la fecha ${fecha} y dejó sin respuesta a ${nombre(b.perdedor)}.`,
        { clubId: b.ganador, destacada: true });
    }

    // 3) El clásico, si se jugó alguno en esta fecha.
    const clasico = conDatos.find((r) => CLASICOS.some((par) =>
      (par[0] === r.home && par[1] === r.away) || (par[1] === r.home && par[0] === r.away)));
    if (clasico) {
      const texto = clasico.ganador
        ? `Se lo llevó ${nombre(clasico.ganador)} por ${Math.max(clasico.hg, clasico.ag)}-${Math.min(clasico.hg, clasico.ag)}.`
        : 'Empate y repartija de bronca en las dos hinchadas.';
      this.push(s, 'resultados',
        `Clásico: ${nombre(clasico.home)} ${clasico.hg}-${clasico.ag} ${nombre(clasico.away)}`,
        `${texto} Un partido aparte dentro de la fecha ${fecha}.`,
        { clubId: clasico.ganador || clasico.home, destacada: true });
    }

    // 4) El puntero, cada tanto, para que el feed también cuente la carrera
    //    por el torneo y no solo partidos sueltos.
    if (fecha >= 4 && fecha % 3 === 0) {
      // myZoneKey() es la clave interna de la tabla ('D1-A'); la letra que se
      // muestra es season.myZone.
      const zonaData = s.season.zones[engine.myZoneKey()];
      const tabla = zonaData ? engine.sortTable(zonaData.table) : [];
      const zona = s.season.myZone;
      const lider = tabla[0];
      const segundo = tabla[1];
      if (lider && segundo) {
        const ventaja = lider.pts - segundo.pts;
        this.push(s, 'resultados',
          `${nombre(lider.id)} manda en la Zona ${zona} con ${lider.pts} puntos`,
          ventaja === 0
            ? `Está igualado con ${nombre(segundo.id)} en la punta. Se define en el detalle.`
            : `Le saca ${ventaja} ${ventaja === 1 ? 'punto' : 'puntos'} a ${nombre(segundo.id)}, que lo persigue de cerca.`,
          { clubId: lider.id });
      }
    }
  },

  // Partes médicos del propio plantel. `avisos` es exactamente el array que
  // devuelve Engine.updateAvailability(), o sea que cada línea corresponde a
  // un jugador que de verdad se lesionó, se recuperó o quedó suspendido.
  trasElParteMedico(engine, avisos) {
    if (!avisos || !avisos.length) return;
    const s = engine.state;
    const club = engine.getClub(s.clubId);
    avisos.forEach((aviso) => {
      const esBaja = /lesion|expulsad|amarilla/i.test(aviso);
      this.push(s, 'lesiones',
        `${club.name}: ${aviso}`,
        esBaja
          ? 'El cuerpo médico ya trabaja en la recuperación. El DT tendrá que rearmar el equipo.'
          : 'Buena noticia para el cuerpo técnico, que recupera una alternativa.',
        { clubId: s.clubId, destacada: esBaja });
    });
  },

  // Una operación de mercado que hizo el usuario de verdad.
  trasUnaOperacion(engine, tipo, jugador, monto) {
    const s = engine.state;
    const club = engine.getClub(s.clubId);
    const plata = '$' + Math.round(monto).toLocaleString('es-AR');
    if (tipo === 'compra') {
      this.push(s, 'mercado',
        `${club.name} cerró la llegada de ${jugador.name}`,
        `${jugador.name} (${jugador.age} años, valoración ${jugador.rating}) firma en ${club.name}. La operación se cerró en ${plata}.`,
        { clubId: s.clubId, destacada: jugador.rating >= 75 });
    } else {
      this.push(s, 'mercado',
        `${jugador.name} se va de ${club.name}`,
        `${club.name} aceptó ${plata} por el pase de ${jugador.name} (valoración ${jugador.rating}). Se le abre el lugar a otro en el plantel.`,
        { clubId: s.clubId });
    }
  },

  // Resultado real de la Libertadores y la Sudamericana del año.
  trasLasCopas(engine, copas) {
    if (!copas || !copas.length) return;
    const s = engine.state;
    copas.forEach((c) => {
      if (!c.championName) return;
      if (c.userWon) {
        this.push(s, 'internacional',
          `¡${engine.getClub(s.clubId).name} campeón de la ${c.copa}!`,
          `Vuelta olímpica en el continente. ${c.runnerUpName ? `Dejó en el camino a ${c.runnerUpName} en la final.` : ''}`,
          { clubId: s.clubId, destacada: true });
      } else {
        this.push(s, 'internacional',
          `${c.championName} se quedó con la ${c.copa}`,
          `${c.championPais ? `El equipo de ${c.championPais} ` : ''}levantó el trofeo${c.runnerUpName ? ` tras vencer a ${c.runnerUpName} en la final` : ''}.`,
          { destacada: true });
      }
      if (c.userStage && !c.userWon) {
        this.push(s, 'internacional',
          `${engine.getClub(s.clubId).name} llegó hasta ${c.userStage} de la ${c.copa}`,
          'Hasta ahí llegó la ilusión continental de esta temporada.',
          { clubId: s.clubId });
      }
    });
  },

  // ---------- Relleno de color ----------
  //
  // Estas son las únicas noticias que NO salen de un hecho simulado: son el
  // ruido de fondo del mundo del juego (rumores, partes médicos de otros
  // clubes, premios, ligas de afuera). Se generan sobre datos reales del
  // juego igual — clubes que existen en la liga, países que existen en la
  // base internacional — pero los jugadores que nombran son inventados con
  // el mismo generador de nombres que usa el resto del juego, porque el
  // motor no modela los planteles de los rivales.

  clubDeLaLigaAlAzar(engine, excluirPropio) {
    const s = engine.state;
    const mios = engine.getClub(s.clubId);
    const candidatos = s.clubs.filter((c) => c.division === mios.division && (!excluirPropio || c.id !== s.clubId));
    return this.alAzar(candidatos);
  },

  rumorDeMercado(engine) {
    const s = engine.state;
    const club = this.clubDeLaLigaAlAzar(engine, true);
    const jugador = engine.randomPlayerName(engine.rollNation());
    const plantillas = [
      [`${club.name} va por ${jugador}`, `En el club admiten el interés y esperan respuesta en las próximas horas.`],
      [`Sondeo de ${club.name} por ${jugador}`, `Todavía no hay oferta formal, pero el nombre gusta en la dirigencia.`],
      [`${jugador} suena fuerte para ${club.name}`, `El representante ya se reunió con los dirigentes. La negociación está encaminada.`],
      [`Se enfría la salida de ${jugador} a ${club.name}`, `Las partes no se pusieron de acuerdo en la forma de pago y todo quedó en suspenso.`],
    ];
    const [titular, bajada] = this.alAzar(plantillas);
    this.push(s, 'mercado', titular, bajada, { clubId: club.id });
  },

  parteMedicoRival(engine) {
    const s = engine.state;
    const club = this.clubDeLaLigaAlAzar(engine, true);
    const jugador = engine.randomPlayerName(engine.rollNation());
    const cuadros = [
      ['desgarro en el isquiotibial', '3 a 4 semanas'],
      ['esguince de tobillo', '2 semanas'],
      ['una molestia muscular', 'unos días'],
      ['sobrecarga en el aductor', 'una semana'],
      ['un golpe en la rodilla', '10 días'],
    ];
    const [cuadro, tiempo] = this.alAzar(cuadros);
    this.push(s, 'lesiones',
      `${club.name} pierde a ${jugador} por ${cuadro}`,
      `Los estudios confirmaron el diagnóstico. El parte del club habla de ${tiempo} de recuperación.`,
      { clubId: club.id });
  },

  premio(engine) {
    const s = engine.state;
    // Si se puede, el premio se lo lleva un jugador de verdad del plantel
    // propio: el de mejor valoración disponible. Si no, uno de la liga.
    const propios = (s.squad || []).filter((p) => engine.isAvailable(p)).sort((a, b) => b.rating - a.rating);
    const club = this.clubDeLaLigaAlAzar(engine, true);
    const opciones = [];
    if (propios.length) {
      const fig = propios[0];
      opciones.push([
        'premios',
        `${fig.name} es la figura del mes en ${engine.getClub(s.clubId).name}`,
        `Con valoración ${fig.rating}, se llevó el reconocimiento de la prensa por su nivel en las últimas fechas.`,
        s.clubId,
      ]);
    }
    const jugador = engine.randomPlayerName(engine.rollNation());
    opciones.push(
      ['premios', `${jugador} fue elegido el mejor jugador del mes`, `La votación de los periodistas lo puso por encima del resto. Juega en ${club.name}.`, club.id],
      ['premios', `${jugador} pelea por el premio al goleador del torneo`, `El delantero de ${club.name} viene siendo de lo mejor del campeonato y la prensa ya lo mira de reojo.`, club.id],
      ['premios', `La liga premió el juego limpio y ${club.name} se llevó el reconocimiento`, 'Un gesto que la organización quiso destacar por encima de los resultados.', club.id],
    );
    const [cat, titular, bajada, clubId] = this.alAzar(opciones);
    this.push(s, cat, titular, bajada, { clubId });
  },

  desdeAfuera(engine) {
    const s = engine.state;
    const a = this.alAzar(CLUBES_INTERNACIONALES);
    // El rival de un partido de liga tiene que ser del mismo país que `a`:
    // un "Flamengo vs Peñarol por el torneo local" no existe. Si en la base
    // no hay otro club de ese país, esa plantilla directamente no se ofrece.
    const paisanos = CLUBES_INTERNACIONALES.filter((c) => c.pais === a.pais && c.id !== a.id);
    const otro = this.alAzar(CLUBES_INTERNACIONALES.filter((c) => c.id !== a.id));

    const plantillas = [
      [`${a.nombre} manda en el torneo de ${a.pais}`, 'Sigue de racha y se afirma arriba en la tabla de su liga.'],
      [`${a.nombre} prepara refuerzos para la ${a.copa}`, `En ${a.pais} aseguran que el club quiere llegar con el plantel completo a la fase decisiva.`],
      [`Crisis en ${otro.nombre}: se fue el técnico`, `La derrota del fin de semana en ${otro.pais} terminó de romper la relación con la dirigencia.`],
      [`${a.nombre} ya palpita su cruce por la ${a.copa}`, `En ${a.pais} lo tienen entre los candidatos y la hinchada agotó las entradas.`],
    ];
    if (paisanos.length) {
      const rival = this.alAzar(paisanos);
      const gl = Math.floor(Math.random() * 4);
      const gv = Math.floor(Math.random() * 3);
      plantillas.push([
        `${a.nombre} ${gl}-${gv} ${rival.nombre} en el clásico de ${a.pais}`,
        `Partidazo allá. ${gl > gv ? 'Se lo llevó el local.' : gl === gv ? 'Terminaron igualados.' : 'Golpe de visitante.'}`,
      ]);
    }

    const [titular, bajada] = this.alAzar(plantillas);
    this.push(s, 'internacional', titular, bajada, {});
  },

  // La joya de otro club. Esta es distinta al resto del relleno: el jugador
  // que nombra EXISTE de verdad en el plantel de ese club (sale del mismo
  // Mercado.plantel que ves al entrar ahí), con ese nombre, esa edad y esa
  // valoración. O sea que después de leerla podés ir al Mercado, buscarlo y
  // ficharlo. Es la única noticia del juego que te da algo para hacer.
  joyaJuvenil(engine) {
    const s = engine.state;
    if (typeof Mercado === 'undefined') return;
    // Se prueban varios clubes en vez de uno solo: la mayoría no tiene ninguna
    // joya en ese momento, y probando uno solo la noticia salía 1 de cada 10
    // veces. Probando cinco sale casi siempre que haya alguna en la liga.
    let club = null;
    let joyas = [];
    for (let intento = 0; intento < 5 && !joyas.length; intento++) {
      club = this.clubDeLaLigaAlAzar(engine, true);
      if (!club) return;
      // Una joya es un pibe con mucho recorrido por delante. El margen se mide
      // contra el techo, que en el mercado ya viene calculado y es estable.
      joyas = Mercado.plantel(engine, club.id)
        .filter((j) => j.age <= 21 && j.potential && j.potential - j.rating >= 8);
    }
    if (!joyas.length) return;
    const j = this.alAzar(joyas);

    const plantillas = [
      [`${j.name}, la joya de ${club.name}`,
        `Tiene ${j.age} años y en el club no lo quieren soltar. Los que lo vieron dicen que de acá a dos temporadas no lo paga nadie.`],
      [`En ${club.name} apareció ${j.name}`,
        `${j.age} años y ya juega como un grande. En el mercado empezaron a preguntar por él.`],
      [`Todos hablan de ${j.name}`,
        `El pibe de ${j.age} años de ${club.name} es la novedad del campeonato. Si lo querés, conviene que sea ahora.`],
      [`${club.name} se ilusiona con ${j.name}`,
        `A los ${j.age} años ya está en ${j.rating} de valoración y en el club creen que todavía le sobra recorrido.`],
    ];
    const [titular, bajada] = this.alAzar(plantillas);
    this.push(s, 'premios', titular, bajada, { clubId: club.id, destacada: true });
  },

  climaDeVestuario(engine) {
    const s = engine.state;
    const club = engine.getClub(s.clubId);
    // Entre temporadas el season se rearma con zones vacío: ahí no hay tabla
    // de la que hablar, así que esta noticia simplemente no sale.
    const zonaData = s.season.zones[engine.myZoneKey()];
    if (!zonaData) return;
    const tabla = engine.sortTable(zonaData.table);
    const zona = s.season.myZone;
    const pos = tabla.findIndex((r) => r.id === s.clubId) + 1;
    // El tono depende de dónde está el equipo de verdad en la tabla y del
    // ánimo real que lleva el DT.
    if (pos > 0 && pos <= 4) {
      this.push(s, 'ultimahora',
        `Ilusión en ${club.name}: ${pos}° en la Zona ${zona}`,
        'La hinchada se entusiasma y en el predio piden mantener los pies sobre la tierra.',
        { clubId: s.clubId });
    } else if (pos >= tabla.length - 3) {
      this.push(s, 'ultimahora',
        `Preocupación en ${club.name}: ${pos}° en la Zona ${zona}`,
        s.morale < 0
          ? 'El clima con la dirigencia está tenso y la prensa ya pregunta por el futuro del entrenador.'
          : 'La dirigencia respalda al cuerpo técnico, pero pide una reacción urgente.',
        { clubId: s.clubId });
    } else {
      this.push(s, 'ultimahora',
        `${club.name} busca despegar en la tabla`,
        `Marcha ${pos}° en la Zona ${zona} y el objetivo es meterse en zona de clasificación.`,
        { clubId: s.clubId });
    }
  },

  // ---------- Latido diario ----------
  //
  // Se llama una vez por día del calendario. No siempre hay noticia: si
  // hubiera una por día el feed se llenaría de relleno y taparía las que
  // cuentan algo real.
  tick(engine) {
    const s = engine.state;
    this.init(s);
    if (Math.random() > 0.45) return;
    const generadores = [
      () => this.rumorDeMercado(engine),
      () => this.rumorDeMercado(engine),
      () => this.parteMedicoRival(engine),
      () => this.premio(engine),
      () => this.desdeAfuera(engine),
      () => this.climaDeVestuario(engine),
      // Va dos veces porque muchas tiradas no encuentran ninguna joya en el
      // club que le tocó y no publican nada.
      () => this.joyaJuvenil(engine),
      () => this.joyaJuvenil(engine),
    ];
    this.alAzar(generadores)();
  },
};
