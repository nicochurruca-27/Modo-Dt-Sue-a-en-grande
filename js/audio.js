// Los sonidos del juego, hechos a mano con la Web Audio API.
//
// No hay un solo archivo de audio en el proyecto: cada efecto se arma en el
// momento con osciladores y ruido. Es a propósito y por dos motivos. Uno: el
// juego entero tiene que entrar en un archivo HTML que se manda por WhatsApp,
// y cuatro MP3 en base64 lo engordarían más que todo el código junto. Dos: un
// sonido sintetizado se puede ajustar acá, en dos números, sin volver a
// grabar nada.
//
// ---------- Las dos reglas del audio en el navegador ----------
//
// 1. El AudioContext NO se puede crear antes de que el usuario toque algo: si
//    se crea al cargar la página queda "suspended" y el navegador escribe una
//    advertencia en la consola. Por eso acá se crea recién en el primer
//    sonido, que siempre viene de un toque.
// 2. Cada sonido arma sus propios nodos y los suelta al terminar. Reusar un
//    oscilador no se puede: una vez que arrancó y paró, no vuelve a sonar.

const SONIDO_KEY = 'dt-sonido';

class AudioManager {
  // Singleton: hay un solo AudioManager en todo el juego y se llega a él por
  // AudioManager.instance (o por la constante Sonido, más abajo).
  static get instance() {
    if (!AudioManager._instancia) AudioManager._instancia = new AudioManager();
    return AudioManager._instancia;
  }

  constructor() {
    this.ctx = null;
    this.master = null;
    this.volumen = 0.22;
    // La preferencia vive aparte de la partida: empezar una carrera nueva no
    // tiene por qué volver a prender el sonido.
    this.activo = this.leerPreferencia();
    // Para no ametrallar con el mismo efecto cuando pasan cosas muy seguidas
    // (los días del almanaque corren a tres por segundo).
    this.ultimo = {};
  }

  // ---------- Prendido y apagado ----------

  leerPreferencia() {
    try {
      const v = localStorage.getItem(SONIDO_KEY);
      // Por defecto viene prendido: si nunca lo tocaste, suena.
      return v === null ? true : v === '1';
    } catch (e) {
      return true;
    }
  }

  guardarPreferencia() {
    try {
      localStorage.setItem(SONIDO_KEY, this.activo ? '1' : '0');
    } catch (e) {
      /* si el navegador no deja guardar, el sonido igual funciona esta vez */
    }
  }

  alternar() {
    this.activo = !this.activo;
    this.guardarPreferencia();
    // Un clic al prenderlo, para escuchar que quedó andando.
    if (this.activo) this.playClick();
    return this.activo;
  }

  // ---------- La cocina ----------

  // El contexto, creado en el momento en que hace falta. Devuelve null si el
  // navegador no tiene Web Audio (o si lo bloqueó): todo lo demás lo banca y
  // el juego sigue igual, mudo.
  contexto() {
    if (!this.activo) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volumen;
        this.master.connect(this.ctx.destination);
      } catch (e) {
        this.ctx = null;
        return null;
      }
    }
    // En el celular el contexto arranca dormido hasta el primer toque. El
    // try es por si el contexto no se puede despertar (pasa, por ejemplo,
    // con un OfflineAudioContext): que no se pueda hacer sonar algo nunca
    // puede tirar abajo lo que estaba haciendo el juego.
    // OJO: resume() devuelve una promesa, así que un try/catch a secas no
    // alcanza —la falla llega después, como rechazo— y quedaba escribiendo
    // errores en la consola. Hay que atrapar las dos cosas.
    if (this.ctx.state === 'suspended' && this.ctx.resume) {
      try {
        const p = this.ctx.resume();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* se sigue sin sonido */ }
    }
    return this.ctx;
  }

  // ¿Pasó suficiente tiempo desde la última vez que sonó esto? Sirve para que
  // una tanda de noticias no suene como una ametralladora.
  puede(nombre, msMinimo) {
    const ahora = Date.now();
    if (this.ultimo[nombre] && ahora - this.ultimo[nombre] < msMinimo) return false;
    this.ultimo[nombre] = ahora;
    return true;
  }

  // Un tono con su envolvente: sube rapidísimo y baja. Sin la subida se
  // escucha un "clack" al principio (el salto de cero al volumen).
  tono({ tipo = 'sine', desde, hasta, inicio = 0, largo = 0.2, volumen = 0.5, curva = 'exp' }) {
    const ctx = this.contexto();
    if (!ctx) return null;
    const t0 = ctx.currentTime + inicio;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(desde, t0);
    if (hasta && hasta !== desde) {
      if (curva === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, hasta), t0 + largo);
      else osc.frequency.linearRampToValueAtTime(hasta, t0 + largo);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volumen, t0 + Math.min(0.012, largo / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + largo);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + largo + 0.02);
    return { osc, gain, t0 };
  }

  // Ruido blanco filtrado: es lo que le da cuerpo al impacto del gol y el
  // aire del silbato. Un oscilador solo suena a pitido de consola vieja.
  ruido({ inicio = 0, largo = 0.3, volumen = 0.3, frecuencia = 1200, q = 1, tipo = 'bandpass' }) {
    const ctx = this.contexto();
    if (!ctx) return null;
    const t0 = ctx.currentTime + inicio;
    const muestras = Math.max(1, Math.floor(ctx.sampleRate * largo));
    const buffer = ctx.createBuffer(1, muestras, ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < muestras; i++) datos[i] = Math.random() * 2 - 1;

    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.frequency.setValueAtTime(frecuencia, t0);
    filtro.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volumen, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + largo);

    fuente.connect(filtro);
    filtro.connect(gain);
    gain.connect(this.master);
    fuente.start(t0);
    fuente.stop(t0 + largo);
    return { fuente, gain, t0 };
  }

  // ---------- Los cuatro efectos ----------

  // Botones y navegación: un tic corto y metálico, de consola vieja. Tiene
  // que ser CORTO: se escucha decenas de veces por partida.
  playClick() {
    if (!this.contexto()) return;
    if (!this.puede('click', 40)) return;
    this.tono({ tipo: 'square', desde: 1180, hasta: 760, largo: 0.045, volumen: 0.12 });
    this.tono({ tipo: 'triangle', desde: 2400, hasta: 1900, largo: 0.03, volumen: 0.05 });
  }

  // El silbato del árbitro. Un silbato de verdad no es un tono limpio: es un
  // agudo con la pelotita adentro girando, que lo hace temblar rapidísimo.
  // Eso es el LFO: un oscilador lento moviéndole la frecuencia al agudo.
  //
  // Arranque de partido: dos pitidos cortos. Final: uno largo.
  playWhistle(final = false) {
    const ctx = this.contexto();
    if (!ctx) return;
    if (!this.puede('whistle', 250)) return;

    const soplido = (inicio, largo) => {
      const t0 = ctx.currentTime + inicio;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(3150, t0);
      // El temblor de la pelotita: 30 veces por segundo, ±130 Hz.
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(30, t0);
      lfoGain.gain.setValueAtTime(130, t0);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02);
      gain.gain.setValueAtTime(0.5, t0 + largo - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + largo);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      lfo.start(t0);
      osc.stop(t0 + largo + 0.02);
      lfo.stop(t0 + largo + 0.02);

      // El segundo armónico y un poco de aire: sin esto suena a pitido de
      // microondas y no a silbato.
      this.tono({ tipo: 'sine', desde: 4550, hasta: 4550, inicio, largo, volumen: 0.12 });
      this.ruido({ inicio, largo: Math.min(0.08, largo), volumen: 0.07, frecuencia: 3600, q: 3 });
    };

    if (final) {
      soplido(0, 0.95);
    } else {
      soplido(0, 0.28);
      soplido(0.36, 0.28);
    }
  }

  // El gol: el golpe grave del estadio entero. Un barrido de 150 a 45 Hz (el
  // "boom"), un cuerpo medio que le da el color, y una cola de ruido que hace
  // de resonancia y de gente.
  playGoal() {
    if (!this.contexto()) return;
    if (!this.puede('goal', 300)) return;
    this.tono({ tipo: 'sine', desde: 150, hasta: 45, largo: 0.55, volumen: 0.75 });
    this.tono({ tipo: 'triangle', desde: 220, hasta: 110, largo: 0.35, volumen: 0.25 });
    this.ruido({ largo: 0.75, volumen: 0.22, frecuencia: 900, q: 0.8 });
    // Y un repique arriba, corto, que es lo que lo hace sonar a festejo y no
    // a portazo.
    this.tono({ tipo: 'square', desde: 660, hasta: 990, inicio: 0.06, largo: 0.18, volumen: 0.1, curva: 'lin' });
  }

  // Una noticia: tres teclas de máquina de escribir y el campanazo del
  // carro al final. Bajito, que aparecen seguido.
  playNews() {
    if (!this.contexto()) return;
    if (!this.puede('news', 1200)) return;
    [0, 0.07, 0.14].forEach((inicio) => {
      this.ruido({ inicio, largo: 0.035, volumen: 0.16, frecuencia: 2600, q: 6 });
      this.tono({ tipo: 'square', desde: 320, hasta: 240, inicio, largo: 0.03, volumen: 0.05 });
    });
    this.tono({ tipo: 'triangle', desde: 1180, hasta: 1180, inicio: 0.22, largo: 0.28, volumen: 0.14 });
  }
}

// El único AudioManager del juego. Se usa así: Sonido.playClick().
// (No se puede llamar `Audio` a secas: ese nombre ya es del navegador.)
const Sonido = AudioManager.instance;
