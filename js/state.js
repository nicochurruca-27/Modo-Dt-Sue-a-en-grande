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
//   log               el historial de resultados
//   stats             partidos, goles y asistencias de cada jugador tuyo
//   confianza         lo que piensa la dirigencia de vos
//   historialDT       los clubes que dirigiste antes
//
// Lo que NO se guarda: nada que se pueda volver a calcular (la fuerza de los
// planteles rivales, por ejemplo, que sale de un generador sembrado).

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
    if (!this.esPartida(estado)) return false;
    this.set(this.migrar(estado));
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

  // ¿Esto que llegó es una partida de este juego? Se pide poco a propósito:
  // lo mínimo para saber que no es otro archivo cualquiera.
  esPartida(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.version && obj.version > SAVE_VERSION) return false;
    return typeof obj.screen === 'string' || !!obj.dt || !!obj.clubId;
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
