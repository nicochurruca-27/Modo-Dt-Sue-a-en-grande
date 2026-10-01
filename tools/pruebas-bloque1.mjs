// Pruebas de la corrección del Bloque 1 (B1-01 a B1-06).
//
//     npm install --no-save playwright
//     node tools/pruebas-bloque1.mjs
//
// Corren contra el juego de verdad, en un Chromium sin ventana. No hay mocks.

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navegador.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => {
  // Los console.error de state.js son parte de lo que se está probando: el
  // juego AVISA que el guardado está roto. Eso no es un error de página.
  const t = m.text();
  if (m.type() === 'error' && !/La partida guardada/.test(t)) errores.push('console: ' + t);
});
await page.goto('file://' + path.join(raiz, 'index.html'));
await page.waitForFunction(() => typeof Juveniles !== 'undefined');

await page.evaluate(() => {
  window.__carrera = (c) => {
    localStorage.removeItem('dt-simulador-save-v3');
    Engine.createDT('Nico', 'ARG', 'equilibrado');
    Engine.newGame(c || 'boca');
    Engine.continueFromPresentation(0);
    Engine._fuerzas = {};
  };
  window.__temporada = () => {
    let v = 0;
    while (v++ < 60000) {
      const s = Engine.state;
      switch (s.screen) {
        case 'calendar': Engine.avanzarUnDia(); break;
        case 'pre-match': Engine.chooseDecision(0); break;
        case 'partido': Engine.simularUnMinuto(); break;
        case 'entretiempo': Engine.resolverEntretiempo(0); break;
        case 'lesion': Engine.seguirDespuesDeLaLesion(); break;
        case 'penalty': Engine.seguirDespuesDelPenal(); break;
        case 'match-result': Engine.finishMatchAndAdvance(); break;
        case 'contract-renewal': Engine.resolveContractDecision(true); break;
        case 'transfer': Engine.continueFromTransfer(); break;
        case 'fifa-break': Engine.continueFromFifa(); break;
        case 'oferta-recibida': Engine.resolverOferta(false); break;
        case 'season-end': return 'ok';
        default: return 'cortó en ' + s.screen;
      }
    }
    return 'sin vueltas';
  };
  // En qué clubes aparece un id. Si la respuesta tiene más de uno, hay bug.
  window.__dondeEsta = (id) => Engine.state.clubs
    .filter((c) => (c.id === Engine.state.clubId ? Engine.state.squad : Mercado.plantel(Engine, c.id))
      .some((p) => p.id === id))
    .map((c) => c.id);
});

const pruebas = [];
const probar = async (nombre, fn) => {
  try {
    const r = await page.evaluate(fn);
    pruebas.push({ nombre, ...r });
  } catch (e) {
    pruebas.push({ nombre, ok: false, detalle: `reventó: ${e.message}` });
  }
};

// ================= B1-01: cadenas de transferencias =================

await probar('B1-01 · A -> B: queda solo en B', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = Mercado.plantel(Engine, 'estudianteslp')[5];
  Mercado.transferir(s, j, 'estudianteslp', 'argentinos', s.season.year);
  Engine._fuerzas = {};
  const donde = window.__dondeEsta(j.id);
  return { ok: donde.length === 1 && donde[0] === 'argentinos', detalle: `${j.name}: ${donde.join(' + ') || 'en ningún club'}` };
});

await probar('B1-01 · A -> B -> C: queda solo en C', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const a = Mercado.plantel(Engine, 'estudianteslp')[5];
  Mercado.transferir(s, a, 'estudianteslp', 'argentinos', s.season.year);
  Engine._fuerzas = {};
  const b = Mercado.plantel(Engine, 'argentinos').find((x) => x.id === a.id);
  Mercado.transferir(s, b, 'argentinos', 'quilmes', s.season.year);
  Engine._fuerzas = {};
  const donde = window.__dondeEsta(a.id);
  return { ok: donde.length === 1 && donde[0] === 'quilmes', detalle: `${a.name}: ${donde.join(' + ') || 'en ningún club'}` };
});

await probar('B1-01 · A -> B -> C -> D: queda solo en D', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const cadena = ['estudianteslp', 'argentinos', 'quilmes', 'lanus'];
  let j = Mercado.plantel(Engine, cadena[0])[5];
  const idOriginal = j.id;
  for (let i = 0; i < cadena.length - 1; i++) {
    Mercado.transferir(s, j, cadena[i], cadena[i + 1], s.season.year);
    Engine._fuerzas = {};
    j = Mercado.plantel(Engine, cadena[i + 1]).find((x) => x.id === idOriginal);
    if (!j) return { ok: false, detalle: `se perdió al pasar a ${cadena[i + 1]}` };
  }
  const donde = window.__dondeEsta(idOriginal);
  return { ok: donde.length === 1 && donde[0] === 'lanus', detalle: `${j.name}: ${donde.join(' + ') || 'en ningún club'}` };
});

await probar('B1-01 · Transferido y después vendido a otro club', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = Mercado.plantel(Engine, 'talleres')[6];
  Mercado.transferir(s, j, 'talleres', 'huracan', s.season.year);
  Engine._fuerzas = {};
  const enHuracan = Mercado.plantel(Engine, 'huracan').find((x) => x.id === j.id);
  Mercado.transferir(s, enHuracan, 'huracan', 'banfield', s.season.year);
  Engine._fuerzas = {};
  const donde = window.__dondeEsta(j.id);
  return { ok: donde.length === 1 && donde[0] === 'banfield', detalle: `${j.name}: ${donde.join(' + ') || 'en ningún club'}` };
});

await probar('B1-01 · Un jugador que te compran a VOS sale de tu plantel', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const mio = s.squad.find((p) => p.pos !== 'POR');
  Mercado.transferir(s, mio, s.clubId, 'river', s.season.year);
  s.squad = s.squad.filter((p) => p.id !== mio.id);
  Engine._fuerzas = {};
  const donde = window.__dondeEsta(mio.id);
  return { ok: donde.length === 1 && donde[0] === 'river', detalle: `${mio.name}: ${donde.join(' + ') || 'en ningún club'}` };
});

await probar('B1-01 · Ningún id aparece en dos clubes después de 40 transferencias', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const clubes = s.clubs.filter((c) => c.id !== s.clubId).map((c) => c.id);
  for (let i = 0; i < 40; i++) {
    const de = clubes[i % clubes.length];
    const a = clubes[(i * 7 + 3) % clubes.length];
    if (de === a) continue;
    const plantel = Mercado.plantel(Engine, de);
    const j = plantel[(i * 3) % plantel.length];
    if (!j) continue;
    Mercado.transferir(s, j, de, a, s.season.year);
    Engine._fuerzas = {};
  }
  const dueño = new Map();
  const dobles = [];
  s.clubs.forEach((c) => {
    (c.id === s.clubId ? s.squad : Mercado.plantel(Engine, c.id)).forEach((p) => {
      if (dueño.has(p.id) && dueño.get(p.id) !== c.id) dobles.push(`${p.name}: ${dueño.get(p.id)} + ${c.id}`);
      dueño.set(p.id, c.id);
    });
  });
  return { ok: !dobles.length, detalle: dobles.length ? dobles.slice(0, 4).join(' · ') : `${dueño.size} jugadores, ninguno en dos clubes` };
});

// ================= B1-02 / B1-03 / B1-04: guardado =================

await probar('B1-02/03/04 · Un save válido carga bien', () => {
  window.__carrera('racing');
  const s = Engine.state;
  s.squad[0].out = { reason: 'lesión', detail: 'Desgarro', matches: 3 };
  s.squad[1].amarillas = 4;
  s.budget = 12345678;
  const antes = JSON.stringify(s);
  Engine.save();
  const cargo = Engine.load();
  return {
    ok: cargo === true && JSON.stringify(Engine.state) === antes,
    detalle: `load()=${cargo} · el estado volvió ${JSON.stringify(Engine.state) === antes ? 'idéntico' : 'CAMBIADO'}`,
  };
});

await probar('B1-02/03/04 · Toda partida inválida se rechaza Y deja intacta la que estabas jugando', () => {
  const casos = {
    'JSON inválido': '{esto no es json',
    'vacío': '',
    'solo espacios': '   ',
    'array': '[]',
    'objeto vacío': '{}',
    'null': 'null',
    'número suelto': '42',
    'versión futura': JSON.stringify({ screen: 'calendar', version: 999, clubId: 'boca' }),
    'versión que no es número': JSON.stringify({ screen: 'calendar', version: 'uno', clubId: 'boca' }),
    'sin clubId': JSON.stringify({ screen: 'calendar', version: 1, squad: [], clubs: [{ id: 'boca' }] }),
    'sin clubs': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [] }),
    'clubs vacío': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [], clubs: [] }),
    'clubId que no está en clubs': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'inexistente', squad: [], clubs: [{ id: 'boca' }] }),
    'squad string': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: 'no', clubs: [{ id: 'boca' }] }),
    'squad número': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: 7, clubs: [{ id: 'boca' }] }),
    'clubs string': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [], clubs: 'no' }),
    'season array': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [], clubs: [{ id: 'boca' }], season: [] }),
    'calendar string': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [], clubs: [{ id: 'boca' }], calendar: 'x' }),
    // Ojo: `budget: null` NO va acá. En este estado decenas de campos valen
    // null legítimamente (bracket, matchContext, lastSeasonSummary...), así
    // que un null es "no hay dato", no un tipo equivocado. Lo inválido es que
    // venga con OTRO tipo.
    'budget string': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [], clubs: [{ id: 'boca' }], budget: 'mucha' }),
    'budget booleano': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [], clubs: [{ id: 'boca' }], budget: true }),
    'confianza string': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [], clubs: [{ id: 'boca' }], confianza: 'alta' }),
    'mercado array': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [], clubs: [{ id: 'boca' }], mercado: [] }),
    'noticias objeto': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: [], clubs: [{ id: 'boca' }], noticias: {} }),
  };
  const malos = [];
  Object.entries(casos).forEach(([nombre, valor]) => {
    window.__carrera('boca');
    const buena = JSON.stringify(Engine.state);
    localStorage.setItem('dt-simulador-save-v3', valor);
    let cargo;
    let revento = null;
    try { cargo = Engine.load(); } catch (e) { revento = e.message; }
    const sobrevivio = JSON.stringify(Engine.state) === buena;
    if (cargo !== false || revento || !sobrevivio) {
      malos.push(`${nombre} (aceptado=${cargo}, reventó=${revento || 'no'}, sobrevivió=${sobrevivio})`);
    }
  });
  localStorage.removeItem('dt-simulador-save-v3');
  return {
    ok: !malos.length,
    detalle: malos.length ? malos.join(' · ') : `${Object.keys(casos).length} partidas inválidas: todas rechazadas y la partida buena intacta en todas`,
  };
});

await probar('B1-02 · Una partida recién empezada (sin club todavía) SIGUE siendo válida', () => {
  // La validación no se puede pasar de estricta: antes de elegir club, una
  // partida legítima es apenas { screen } o { screen, dt }.
  return {
    ok: GameState.esPartida({ screen: 'dt-create' })
      && GameState.esPartida({ screen: 'club-select', dt: { name: 'Nico' } })
      && GameState.esPartida({ screen: 'calendar', version: 1 }),
    detalle: 'las partidas sin carrera empezada se siguen aceptando',
  };
});

// ================= B1-05: la edad al cambiar de temporada =================

await probar('B1-05 · Al arrancar la temporada, p.age === edadDe(p) para todos', () => {
  window.__carrera('aldosivi');
  window.__temporada();
  Engine.startNewSeason();
  const malos = Engine.state.squad
    .filter((p) => p.birthDate && p.age !== Engine.edadDe(p))
    .map((p) => `${p.name}: ${p.age} vs ${Engine.edadDe(p)}`);
  return { ok: !malos.length, detalle: malos.length ? malos.join(' · ') : `${Engine.state.squad.length} jugadores, todas las edades al día` };
});

await probar('B1-05 · Se mantiene en cinco temporadas seguidas', () => {
  window.__carrera('aldosivi');
  const problemas = [];
  for (let t = 1; t <= 5; t++) {
    if (window.__temporada() !== 'ok') break;
    Engine.startNewSeason();
    const malos = Engine.state.squad.filter((p) => p.birthDate && p.age !== Engine.edadDe(p));
    if (malos.length) problemas.push(`temporada ${Engine.state.season.year}: ${malos.length} desfasados`);
  }
  return { ok: !problemas.length, detalle: problemas.length ? problemas.join(' · ') : 'cinco temporadas, ninguna edad desfasada al arrancar' };
});

await probar('B1-05 · Un cumpleaños del 29 de febrero también queda al día', () => {
  window.__carrera('boca');
  const j = Engine.state.squad[0];
  j.birthDate = '2008-02-29';
  const problemas = [];
  for (let t = 1; t <= 4; t++) {
    if (window.__temporada() !== 'ok') break;
    Engine.startNewSeason();
    const enPlantel = Engine.state.squad.find((p) => p.id === j.id);
    if (enPlantel && enPlantel.age !== Engine.edadDe(enPlantel)) {
      problemas.push(`temporada ${Engine.state.season.year}: ${enPlantel.age} vs ${Engine.edadDe(enPlantel)}`);
    }
  }
  return { ok: !problemas.length, detalle: problemas.length ? problemas.join(' · ') : 'el nacido el 29/02 llega al día a cada temporada' };
});

// ================= B1-06: la fecha histórica de una temporada =================

await probar('B1-06 · Dentro del año, la temporada anterior da el año correcto', () => {
  window.__carrera('boca');
  const s = Engine.state;
  s.season.year = 3; s.calendar.dayCount = 100;
  const hoy = Engine.fechaDelJuego();
  const t1 = Engine.fechaDeJuegoDeLaTemporada(1);
  return {
    ok: hoy.anio === 2028 && t1.anio === 2026,
    detalle: `hoy ${hoy.dia}/${hoy.mes + 1}/${hoy.anio} · la temporada 1 iba por ${t1.dia}/${t1.mes + 1}/${t1.anio}`,
  };
});

await probar('B1-06 · Cruzando el 31 de diciembre ya no se pierde un día', () => {
  window.__carrera('boca');
  const s = Engine.state;
  // El mismo contador de días, mirado desde la temporada 3 y desde la 1.
  s.season.year = 3; s.calendar.dayCount = 400;
  const hoy = Engine.fechaDelJuego();
  const comoTemporada1 = Engine.fechaDeJuegoDeLaTemporada(1);
  // Y la verdad: pararse de verdad en la temporada 1 con el mismo día.
  s.season.year = 1;
  const temporada1DeVerdad = Engine.fechaDelJuego();
  return {
    ok: comoTemporada1.dia === temporada1DeVerdad.dia
      && comoTemporada1.mes === temporada1DeVerdad.mes
      && comoTemporada1.anio === temporada1DeVerdad.anio,
    detalle: `desde la temporada 3 (hoy ${hoy.dia}/${hoy.mes + 1}/${hoy.anio}) dice ${comoTemporada1.dia}/${comoTemporada1.mes + 1}/${comoTemporada1.anio}`
      + ` · parado de verdad en la 1: ${temporada1DeVerdad.dia}/${temporada1DeVerdad.mes + 1}/${temporada1DeVerdad.anio}`,
  };
});

await probar('B1-06 · Da lo mismo mirar una temporada desde afuera que estar parado en ella', () => {
  // La prueba de fondo: para cualquier temporada y cualquier día, preguntar
  // "¿qué fecha era en la temporada N?" tiene que dar exactamente lo mismo
  // que ponerse en la temporada N y mirar el almanaque. Eso cubre años
  // normales, bisiestos, el 28 y el 29 de febrero, y lo que viene después.
  window.__carrera('boca');
  const s = Engine.state;
  const malos = [];
  const diasDePrueba = [0, 31, 57, 58, 59, 60, 100, 180, 300, 364, 365, 366, 400, 500, 730];
  for (let desde = 1; desde <= 8; desde++) {
    for (let hasta = 1; hasta <= 8; hasta++) {
      diasDePrueba.forEach((d) => {
        s.calendar.dayCount = d;
        s.season.year = desde;
        const preguntado = Engine.fechaDeJuegoDeLaTemporada(hasta);
        s.season.year = hasta;
        const real = Engine.fechaDelJuego();
        if (preguntado.dia !== real.dia || preguntado.mes !== real.mes || preguntado.anio !== real.anio) {
          malos.push(`desde T${desde} preguntando T${hasta} día ${d}: ${preguntado.dia}/${preguntado.mes + 1}/${preguntado.anio} ≠ ${real.dia}/${real.mes + 1}/${real.anio}`);
        }
      });
    }
  }
  return {
    ok: !malos.length,
    detalle: malos.length ? `${malos.length} desacuerdos, p.ej.: ${malos.slice(0, 3).join(' · ')}`
      : `${8 * 8 * diasDePrueba.length} combinaciones de temporada y día, todas coinciden`,
  };
});

await probar('B1-06 · El 29 de febrero de una temporada bisiesta existe y el día siguiente es marzo', () => {
  window.__carrera('boca');
  const s = Engine.state;
  // La temporada 3 es 2028, bisiesto. Día 59 = 29 de febrero.
  s.season.year = 3;
  const dias = [57, 58, 59, 60].map((d) => {
    s.calendar.dayCount = d;
    const f = Engine.fechaDeJuegoDeLaTemporada(3);
    return `${f.dia}/${f.mes + 1}`;
  });
  // Y la temporada 2 es 2027, común: el mismo día 59 ya es marzo.
  s.season.year = 2;
  s.calendar.dayCount = 59;
  const enComun = Engine.fechaDeJuegoDeLaTemporada(2);
  return {
    ok: dias.join(' ') === '27/2 28/2 29/2 1/3' && `${enComun.dia}/${enComun.mes + 1}` === '1/3',
    detalle: `2028 (bisiesto): ${dias.join(' -> ')} · 2027 (común) el mismo día: ${enComun.dia}/${enComun.mes + 1}`,
  };
});

await probar('B1-06 · Retroceder varias temporadas da los años consecutivos', () => {
  window.__carrera('boca');
  const s = Engine.state;
  s.season.year = 8; s.calendar.dayCount = 200;
  const anios = [1, 2, 3, 4, 5, 6, 7, 8].map((t) => Engine.fechaDeJuegoDeLaTemporada(t).anio);
  return {
    ok: anios.join(',') === '2026,2027,2028,2029,2030,2031,2032,2033',
    detalle: `temporadas 1 a 8 -> ${anios.join(', ')}`,
  };
});

// ---------- El informe ----------
console.log('\nPRUEBAS DE LA CORRECCIÓN DEL BLOQUE 1\n');
pruebas.forEach((p) => {
  console.log(`  ${p.ok ? '✓' : '✗'} ${p.nombre}`);
  if (p.detalle) console.log(`      ${p.detalle}`);
});
const fallaron = pruebas.filter((p) => !p.ok);
console.log(`\n${pruebas.length - fallaron.length}/${pruebas.length} pruebas pasaron`);
if (errores.length) console.log('errores de la página:', errores);
await navegador.close();
process.exit(fallaron.length || errores.length ? 1 : 0);
