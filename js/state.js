// La partida guardada: dónde vive, cómo se guarda, cómo se lleva de un
// aparato a otro.
//
// ---------- Una sola fuente de verdad ----------
//
// Toda la carrera —la fecha del almanaque, el club que elegiste, tu plantel
// con los cambios que le hiciste, las tablas, el calendario, el presupuesto,
// las noticias y los partidos jugados— vive en UN solo objeto: `Engine.state`.
// No hay una copia acá ni en ningún otro lado, y es a propósito: dos objetos
// con el mismo estado terminan siempre desincronizados y con bugs imposibles
// de encontrar.
//
// `GameState` es la puerta a ese objeto y el dueño de todo lo que tiene que
// ver con guardarlo: el motor no toca localStorage nunca, le pide a esto.
//
// ---------- Qué hay adentro ----------
//
//   screen            en qué pantalla estás
//   dt                nombre, nacionalidad y estilo del entrenador
//   clubId            el club que dirigís
//   clubs             los 66 clubes con su reputación y su división
//   squad             TU plantel, con los fichajes, cambios y lesiones
//   startingSlots     tu once, casillero por casillero
//   banco             los doce del banco, en tu orden
//   formation         la formación elegida
//   season            la temporada: zonas, tablas, calendario, playoffs, copas
//   calendar          el día del almanaque y lo que pasa esta semana
//   budget            la plata
//   finanzas          el movimiento de plata del año
//   mercado           negociaciones, acuerdos y fichados
//   cedidos           los que están a préstamo en otro club
//   noticias          el portal de noticias
//   historialPuntos   los puntos y partidos de las temporadas terminadas de
//                     cada club, para la tabla de promedios
//   retirados         los que colgaron los botines, con edad y temporada
//   log               el historial de resultados
//   stats             partidos, goles y asistencias de cada jugador tuyo
//   confianza         lo que piensa la dirigencia de vos
//   historialDT       los clubes que dirigiste antes
//
// Lo que NO se guarda: nada que se pueda volver a calcular (la fuerza de los
// planteles rivales, por ejemplo, que sale de un generador sembrado).
//
// ---------- El historial de los promedios ----------
//
// El descenso de Primera se define por promedio: puntos sobre partidos de
// las últimas TRES temporadas, la que se está jugando incluida. Para eso
// hace falta acordarse de lo que pasó antes, y eso es `historialPuntos`: un
// array por club con las temporadas TERMINADAS, cada una con el año.
//
//   historialPuntos: {
//     boca:  [{ pts: 58, pj: 32, temporada: 0 }, { pts: 61, pj: 32, temporada: 1 }],
//     union: [{ pts: 37, pj: 32, temporada: 0 }, { pts: 34, pj: 32, temporada: 1 }],
//   }
//
// Los puntos de la temporada EN CURSO no están acá a propósito: ya viven en
// las tablas de zona (de donde sale la Tabla Anual) y guardar el mismo
// número en dos lados termina siempre con los dos números distintos. El
// motor los suma al vuelo cuando arma la tabla; si lo que se quiere es el
// desglose de un club —lo que lleva este año y lo que arrastra— está
// `Engine.historialDePromedios(clubId)`, que devuelve:
//
//   { ptsTemporadaActual, pjTemporadaActual, temporadasAnteriores: [{ pts, pj }] }
//
// Al empezar una carrera nadie tiene pasado, así que la tabla de promedios
// sería igual a la Anual y el descenso por promedio no significaría nada
// hasta la tercera temporada. Por eso `Engine.sembrarHistorialDePromedios()`
// inventa dos temporadas previas verosímiles para cada club de Primera,
// sacadas de su reputación: un grande arranca con colchón y un chico
// arranca comprometido desde la fecha 1.
//
// Cuando una temporada termina, `Engine.registrarTemporadaEnHistorial()` la
// guarda y la ventana de tres años deja caer sola a la más vieja.

const SAVE_KEY = 'dt-simulador-save-v3';

// La versión del FORMATO de la partida. Sube solo cuando cambia la forma de
// los datos de manera que una partida vieja no se pueda leer derecho. Sirve
// para dos cosas: rechazar un archivo de una versión más nueva que el juego
// (en vez de romperse en pedazos), y tener dónde enganchar la conversión de
// las partidas viejas el día que haga falta.
const SAVE_VERSION = 1;

const ARCHIVO_DE_PARTIDA = 'partida_dt.json';

const GameState = {
  // ---------- El estado ----------

  get() {
    return typeof Engine === 'undefined' ? null : Engine.state;
  },

  set(nuevo) {
    if (typeof Engine !== 'undefined') Engine.state = nuevo;
  },

  hay() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch (e) {
      return false;
    }
  },

  // ---------- Guardar y cargar ----------
  //
  // Guardar es automático: el motor llama a esto después de cada partido,
  // cada día del almanaque y cada decisión. No hay botón de guardar ni hace
  // falta: si cerrás la pestaña en el minuto 44, volvés al minuto 44.

  saveToLocalStorage() {
    const estado = this.get();
    if (!estado) return false;
    estado.version = SAVE_VERSION;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(estado));
      return true;
    } catch (e) {
      // El caso real es quedarse sin espacio (el navegador da ~5 MB). Que no
      // se pueda guardar no puede tumbar la partida en curso: se avisa por
      // consola y se sigue jugando.
      console.error('No se pudo guardar la partida:', e);
      return false;
    }
  },

  loadFromLocalStorage() {
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
      return false;
    }
    if (!raw) return false;
    let estado;
    try {
      estado = JSON.parse(raw);
    } catch (e) {
      console.error('La partida guardada está rota:', e);
      return false;
    }
    // El orden importa, y antes no se respetaba del todo: el estado se
    // instalaba apenas pasaba una validación floja, así que un guardado roto
    // te borraba la partida que estabas jugando (medido: el clubId quedaba en
    // undefined). Ahora nada toca el estado vivo hasta que TODO validó.
    //
    //   1. leer   2. parsear   3. validar lo que vino
    //   4. migrar 5. validar lo migrado   6. recién ahí, instalar
    //
    // Y si algo falla, se devuelve false y la partida en memoria queda como
    // estaba. No se usa resetGame(): un save roto no tiene por qué costarte
    // la carrera que tenías abierta.
    if (!this.esPartida(estado)) return false;
    let migrado;
    try {
      migrado = this.migrar(estado);
    } catch (e) {
      console.error('La partida guardada no se pudo convertir:', e);
      return false;
    }
    if (!this.esPartida(migrado)) return false;
    this.set(migrado);
    return true;
  },

  resetGame() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      /* si no se puede borrar, igual se arranca de cero en memoria */
    }
    this.set({ screen: 'dt-create' });
  },

  // ---------- Que una partida vieja siga abriendo ----------
  //
  // Hoy no hay nada que convertir: la versión 1 es la primera que lleva
  // número. Una partida guardada antes de que esto existiera no tiene
  // `version` y se toma como versión 1, que es lo que es. El día que cambie
  // la forma de algo —por ejemplo, si la temporada deja de ser "dos zonas"
  // para poder meter otras ligas— la conversión va acá, un paso por versión.
  migrar(estado) {
    const desde = estado.version || 1;
    let v = desde;
    // if (v < 2) { ...convertir de 1 a 2...; v = 2; }
    estado.version = v;
    return estado;
  },

  // Los campos del estado que el motor recorre con forEach/map/filter. Si
  // alguno llega con otra cosa adentro, el juego revienta en cuanto lo toca
  // (medido: `squad: 'no soy un array'` pasaba la validación y después
  // Engine.load() tiraba "(s.squad || []).forEach is not a function").
  LISTAS_DE_LA_PARTIDA: ['squad', 'clubs', 'startingSlots', 'noticias', 'historialDT',
    'ofertasRecibidas', 'cedidos', 'notasMercado', 'ultimasCopas', 'retirados',
    'libres', 'contractQueue', 'lastDevelopmentNotes', 'log'],

  // Los que tienen que ser objetos (no arrays, no strings).
  OBJETOS_DE_LA_PARTIDA: ['season', 'calendar', 'mercado', 'finanzas', 'mundo',
    'historialPuntos', 'juveniles', 'copaBracket', 'copasInter', 'dt', 'objective'],

  // Los que tienen que ser números.
  NUMEROS_DE_LA_PARTIDA: ['budget', 'morale', 'confianza', 'escalaSalarial',
    'titulosEnElClub', 'desdeAnio', 'varaSalarial', 'promesa', 'version'],

  // Las ÚNICAS dos pantallas que existen antes de que haya una carrera. No
  // son una lista inventada: `dt-create` la pone resetGame() (y el arranque
  // cuando no hay partida guardada) y `club-select` la pone createDT(), que
  // deja el estado en `{ screen, dt }` y nada más. Cualquier otra pantalla
  // —empezando por `presentation`, que la asigna newGame()— solo existe con
  // una carrera ya armada detrás.
  PANTALLAS_SIN_CARRERA: ['dt-create', 'club-select'],

  // ¿Esto que llegó es una partida de este juego?
  //
  // Antes pedía poco a propósito —alcanzaba con que tuviera un `screen` de
  // texto— y por eso entraban cosas que no eran una partida: un objeto sin
  // clubId ni clubs, o con el plantel en un string. Ahora se mira la
  // estructura REAL que arma el juego (ver newGame), con una distinción que
  // importa: antes de elegir club, una partida legítima es apenas
  // `{ screen }` o `{ screen, dt }`, así que esas siguen siendo válidas.
  esPartida(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    if (obj.version != null) {
      if (typeof obj.version !== 'number' || !Number.isFinite(obj.version)) return false;
      if (obj.version > SAVE_VERSION) return false;
    }
    if (typeof obj.screen !== 'string' && !obj.dt && !obj.clubId) return false;

    // Tipos, para todo lo que esté presente. Un campo ausente no molesta: el
    // juego lo crea cuando hace falta. Uno presente con el tipo equivocado sí.
    const esObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (this.LISTAS_DE_LA_PARTIDA.some((k) => obj[k] != null && !Array.isArray(obj[k]))) return false;
    if (this.OBJETOS_DE_LA_PARTIDA.some((k) => obj[k] != null && !esObjeto(obj[k]))) return false;
    if (this.NUMEROS_DE_LA_PARTIDA.some((k) => obj[k] != null
      && (typeof obj[k] !== 'number' || !Number.isFinite(obj[k])))) return false;

    // ¿Es una carrera ya empezada? Se mira por dos lados, y el segundo es el
    // que faltaba: no alcanza con buscar las piezas de la carrera, porque un
    // guardado puede no traer ninguna y aun así decir que está en una
    // pantalla que solo existe con la carrera andando. `{ screen: 'calendar' }`
    // pasaba por ahí: entraba como si fuera una partida recién abierta y
    // dejaba el clubId en undefined, borrando la carrera que estabas jugando.
    const traeLasPiezas = ['clubId', 'squad', 'clubs', 'season'].some((k) => obj[k] != null);
    const pantallaDeCarrera = typeof obj.screen === 'string'
      && !this.PANTALLAS_SIN_CARRERA.includes(obj.screen);
    const empezada = traeLasPiezas || pantallaDeCarrera;
    if (!empezada) return true;
    if (typeof obj.clubId !== 'string' || !obj.clubId) return false;
    if (!Array.isArray(obj.squad)) return false;
    if (!Array.isArray(obj.clubs) || !obj.clubs.length) return false;
    // El club que dirigís tiene que ser uno de los que están en la partida.
    if (!obj.clubs.some((c) => c && c.id === obj.clubId)) return false;
    return true;
  },

  // ---------- Llevarse la partida a otro aparato ----------
  //
  // El guardado vive en el navegador de ESE aparato: la carrera del celular
  // no aparece en la computadora. Exportar baja un archivo con todo adentro e
  // importar lo vuelve a meter, así la misma carrera sigue donde quieras.

  // Lo que se escribe en el archivo: la partida más una cabecera para saber
  // qué es sin tener que adivinar.
  paraExportar() {
    const estado = this.get();
    if (!estado) return null;
    estado.version = SAVE_VERSION;
    return {
      juego: 'modo-dt-sueno-en-grande',
      version: SAVE_VERSION,
      exportado: new Date().toISOString(),
      resumen: this.resumen(),
      estado,
    };
  },

  // Un renglón para saber de qué carrera es el archivo sin abrirlo.
  resumen() {
    const s = this.get();
    if (!s || !s.clubId) return null;
    const club = typeof Engine !== 'undefined' && Engine.getClub ? Engine.getClub(s.clubId) : null;
    return {
      dt: s.dt ? s.dt.name : null,
      club: club ? club.name : s.clubId,
      temporada: s.season ? s.season.year : null,
      anio: s.season && typeof anioDeTemporada === 'function' ? anioDeTemporada(s.season.year) : null,
      dia: s.calendar ? s.calendar.dayCount : null,
    };
  },

  exportar() {
    const datos = this.paraExportar();
    if (!datos) return { ok: false, nota: 'No hay ninguna carrera para exportar.' };
    try {
      const texto = JSON.stringify(datos, null, 2);
      const blob = new Blob([texto], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ARCHIVO_DE_PARTIDA;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // El objeto URL se suelta después, que en algunos navegadores la
      // descarga arranca en el tic siguiente.
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      const kb = Math.round(texto.length / 1024);
      return { ok: true, nota: `Se bajó ${ARCHIVO_DE_PARTIDA} (${kb} KB).` };
    } catch (e) {
      console.error('No se pudo exportar:', e);
      return { ok: false, nota: 'No se pudo bajar el archivo.' };
    }
  },

  // Toma el texto de un archivo exportado y reemplaza la partida actual.
  // Acepta el archivo con cabecera y también un volcado pelado del estado.
  importar(texto) {
    let datos;
    try {
      datos = JSON.parse(texto);
    } catch (e) {
      return { ok: false, nota: 'Ese archivo no es un JSON válido.' };
    }
    if (datos && datos.juego && datos.juego !== 'modo-dt-sueno-en-grande') {
      return { ok: false, nota: 'Ese archivo es de otro juego.' };
    }
    if (datos && datos.version && datos.version > SAVE_VERSION) {
      return { ok: false, nota: 'Esa partida es de una versión más nueva del juego. Actualizá el juego para poder abrirla.' };
    }
    const estado = datos && datos.estado ? datos.estado : datos;
    if (!this.esPartida(estado)) {
      return { ok: false, nota: 'Ese archivo no tiene una partida adentro.' };
    }
    this.set(this.migrar(estado));
    this.saveToLocalStorage();
    const r = this.resumen();
    return {
      ok: true,
      nota: r ? `Cargada la carrera de ${r.dt || 'tu DT'} en ${r.club}${r.anio ? `, ${r.anio}` : ''}.` : 'Partida cargada.',
    };
  },
};
