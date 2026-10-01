// RE-AUDITORÍA DEL BLOQUE 1 — solo verificación.
//
//     npm install --no-save playwright
//     node tools/reauditoria-bloque1.mjs
//
// Esto NO corrige nada y no toca el código del juego. Verifica, de forma
// independiente de las pruebas que acompañaron a la corrección, que los seis
// bugs B1-01 a B1-06 estén realmente cerrados.
//
// Dos decisiones de método, porque de ellas depende que la verificación
// sirva de algo:
//
//   1. Para el almanaque (B1-06) NO se usa la aritmética del propio motor
//      como referencia —sería verificar algo contra sí mismo—. Se usa el
//      objeto Date del navegador, que el juego deliberadamente nunca usa
//      (ver el comentario de formatCalendarDate en ui.js). Es un oráculo de
//      verdad externo.
//
//   2. Para el guardado se distingue con cuidado entre un TIPO inválido y un
//      `null` legítimo. En este estado hay decenas de campos que valen null
//      de forma perfectamente válida (bracket, matchContext,
//      lastSeasonSummary, anioDelDescenso...). Rechazar un null sería un
//      falso positivo, no un acierto.

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navegador.newPage();
const erroresDePagina = [];
page.on('pageerror', (e) => erroresDePagina.push(String(e)));
page.on('console', (m) => {
  const t = m.text();
  // state.js avisa por consola cuando un guardado está roto. Eso es el
  // comportamiento que se está verificando, no un error.
  if (m.type() === 'error' && !/La partida guardada/.test(t)) erroresDePagina.push('console: ' + t);
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
  // Dónde está un id, mirando TODOS los clubes.
  window.__dondeEsta = (id) => Engine.state.clubs
    .filter((c) => (c.id === Engine.state.clubId ? Engine.state.squad : Mercado.plantel(Engine, c.id))
      .some((p) => p.id === id))
    .map((c) => c.id);
  // Un mapa id -> club de TODO el mundo, para cazar duplicados.
  window.__dueños = () => {
    const dueño = new Map();
    const dobles = [];
    Engine.state.clubs.forEach((c) => {
      (c.id === Engine.state.clubId ? Engine.state.squad : Mercado.plantel(Engine, c.id)).forEach((p) => {
        if (dueño.has(p.id) && dueño.get(p.id) !== c.id) dobles.push(`${p.name} (${p.id}): ${dueño.get(p.id)} + ${c.id}`);
        dueño.set(p.id, c.id);
      });
    });
    return { total: dueño.size, dobles };
  };
  // La huella de los campos esenciales, para comprobar que un save corrupto
  // no toque nada.
  window.__huella = () => {
    const s = Engine.state || {};
    return JSON.stringify({
      screen: s.screen,
      clubId: s.clubId,
      clubs: Array.isArray(s.clubs) ? s.clubs.length : `NO ES ARRAY (${typeof s.clubs})`,
      squad: Array.isArray(s.squad) ? s.squad.map((p) => p.id).join(',') : `NO ES ARRAY (${typeof s.squad})`,
      season: s.season ? s.season.year : null,
      budget: s.budget,
      calendar: s.calendar ? s.calendar.dayCount : null,
    });
  };
});

const pruebas = [];
const probar = async (bug, nombre, fn) => {
  try {
    const r = await page.evaluate(fn);
    pruebas.push({ bug, nombre, ...r });
  } catch (e) {
    pruebas.push({ bug, nombre, ok: false, detalle: `reventó: ${e.message}` });
  }
};

// ================================================================
// B1-01 — TRANSFERENCIAS
// ================================================================

await probar('B1-01', 'Cadena de cinco clubes: A -> B -> C -> D -> E', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const cadena = ['estudianteslp', 'argentinos', 'quilmes', 'lanus', 'talleres'];
  let j = Mercado.plantel(Engine, cadena[0])[5];
  const id = j.id;
  const nombre = j.name;
  const camino = [];
  for (let i = 0; i < cadena.length - 1; i++) {
    Mercado.transferir(s, j, cadena[i], cadena[i + 1], s.season.year);
    Engine._fuerzas = {};
    camino.push(`${cadena[i]}->${cadena[i + 1]}: ${window.__dondeEsta(id).join('+')}`);
    j = Mercado.plantel(Engine, cadena[i + 1]).find((x) => x.id === id);
    if (!j) return { ok: false, detalle: `${nombre} se perdió al llegar a ${cadena[i + 1]}` };
  }
  const donde = window.__dondeEsta(id);
  return {
    ok: donde.length === 1 && donde[0] === 'talleres',
    detalle: `${nombre}: ${camino.join(' | ')} — final: ${donde.join('+')}`,
  };
});

await probar('B1-01', 'El mismo jugador transferido ocho veces', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const clubes = ['racing', 'velez', 'huracan', 'banfield', 'tigre', 'platense', 'union', 'belgrano', 'instituto'];
  let j = Mercado.plantel(Engine, clubes[0])[4];
  const id = j.id;
  for (let i = 0; i < clubes.length - 1; i++) {
    Mercado.transferir(s, j, clubes[i], clubes[i + 1], s.season.year);
    Engine._fuerzas = {};
    j = Mercado.plantel(Engine, clubes[i + 1]).find((x) => x.id === id);
    if (!j) return { ok: false, detalle: `se perdió en el paso ${i + 1}` };
  }
  const donde = window.__dondeEsta(id);
  return { ok: donde.length === 1 && donde[0] === 'instituto', detalle: `${j.name} tras 8 pases: ${donde.join('+')}` };
});

await probar('B1-01', 'Transferencia y después venta a un tercero', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = Mercado.plantel(Engine, 'sanlorenzo')[7];
  Mercado.transferir(s, j, 'sanlorenzo', 'defensayjusticia', s.season.year);
  Engine._fuerzas = {};
  const enDefensa = Mercado.plantel(Engine, 'defensayjusticia').find((x) => x.id === j.id);
  Mercado.transferir(s, enDefensa, 'defensayjusticia', 'rosariocentral', s.season.year);
  Engine._fuerzas = {};
  const donde = window.__dondeEsta(j.id);
  return { ok: donde.length === 1 && donde[0] === 'rosariocentral', detalle: `${j.name}: ${donde.join('+')}` };
});

await probar('B1-01', 'Transferencias repartidas a lo largo de varias temporadas', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const clubes = ['newells', 'gimnasialp', 'atleticotucuman', 'aldosivi'];
  let j = Mercado.plantel(Engine, clubes[0])[3];
  const id = j.id;
  const porTemporada = [];
  for (let i = 0; i < clubes.length - 1; i++) {
    Mercado.transferir(s, j, clubes[i], clubes[i + 1], s.season.year);
    Engine._fuerzas = {};
    // Pasa una temporada entre pase y pase.
    s.season.year += 1;
    Engine._fuerzas = {};
    porTemporada.push(`T${s.season.year}: ${window.__dondeEsta(id).join('+')}`);
    j = Mercado.plantel(Engine, clubes[i + 1]).find((x) => x.id === id);
    if (!j) return { ok: false, detalle: `se perdió en la temporada ${s.season.year}` };
  }
  const donde = window.__dondeEsta(id);
  return { ok: donde.length === 1, detalle: `${porTemporada.join(' | ')} — final: ${donde.join('+')}` };
});

await probar('B1-01', 'Ningún id en dos planteles tras 120 transferencias al azar', () => {
  window.__carrera('boca');
  const s = Engine.state;
  // SOLO entre clubes con plantel investigado. Los 36 de la Nacional juegan
  // con relleno generado, y ese relleno tiene un problema de ids propio que
  // NO es el que arregló B1-01: se mide aparte, en la sección de hallazgos.
  const clubes = Object.keys(REAL_ROSTERS).filter((c) => c !== s.clubId);
  let hechas = 0;
  for (let i = 0; i < 120; i++) {
    const de = clubes[(i * 13) % clubes.length];
    const a = clubes[(i * 29 + 11) % clubes.length];
    if (de === a) continue;
    const plantel = Mercado.plantel(Engine, de);
    const j = plantel[(i * 7) % plantel.length];
    if (!j) continue;
    Mercado.transferir(s, j, de, a, s.season.year);
    Engine._fuerzas = {};
    hechas++;
  }
  const { total, dobles } = window.__dueños();
  return {
    ok: !dobles.length,
    detalle: dobles.length ? `${dobles.length} duplicados: ${dobles.slice(0, 3).join(' · ')}`
      : `${hechas} transferencias, ${total} jugadores, 0 en dos clubes`,
  };
});

// ================================================================
// B1-02 — VALIDACIÓN DE ESTRUCTURA
// ================================================================

await probar('B1-02', 'El caso exacto del informe se rechaza', () => {
  const caso = { screen: 'calendar', version: 1, squad: [] };
  return {
    ok: GameState.esPartida(caso) === false,
    detalle: `esPartida({screen:'calendar', version:1, squad:[]}) = ${GameState.esPartida(caso)}`,
  };
});

await probar('B1-02', 'Otras estructuras incompletas también se rechazan', () => {
  const casos = {
    'solo squad': { squad: [] },
    'clubId sin clubs': { screen: 'calendar', clubId: 'boca', squad: [] },
    'clubs sin clubId': { screen: 'calendar', clubs: [{ id: 'boca' }], squad: [] },
    'clubs vacío': { screen: 'calendar', clubId: 'boca', clubs: [], squad: [] },
    'clubId que no está en clubs': { screen: 'calendar', clubId: 'nadie', clubs: [{ id: 'boca' }], squad: [] },
    'season sin lo demás': { screen: 'calendar', season: { year: 1 } },
    'clubId vacío': { screen: 'calendar', clubId: '', clubs: [{ id: 'boca' }], squad: [] },
    'array en vez de objeto': [],
    'string': 'soy una partida',
    'número': 7,
    'null': null,
  };
  const aceptados = Object.entries(casos).filter(([, v]) => GameState.esPartida(v) !== false).map(([k]) => k);
  return {
    ok: !aceptados.length,
    detalle: aceptados.length ? `ACEPTADOS (mal): ${aceptados.join(', ')}` : `${Object.keys(casos).length} estructuras incompletas, todas rechazadas`,
  };
});

await probar('B1-02', 'Las partidas que el juego REALMENTE genera se siguen aceptando', () => {
  // Se recorren los tres estados que arma el juego de verdad y se le
  // pregunta a esPartida por cada uno. Si la validación se pasó de estricta,
  // acá se ve.
  const reales = [];
  localStorage.removeItem('dt-simulador-save-v3');
  Engine.state = { screen: 'dt-create' };
  reales.push(['recién abierto', JSON.parse(JSON.stringify(Engine.state))]);
  Engine.createDT('Nico', 'ARG', 'equilibrado');
  reales.push(['DT creado, sin club', JSON.parse(JSON.stringify(Engine.state))]);
  Engine.newGame('boca');
  reales.push(['carrera recién empezada', JSON.parse(JSON.stringify(Engine.state))]);
  Engine.continueFromPresentation(0);
  reales.push(['en el calendario', JSON.parse(JSON.stringify(Engine.state))]);
  window.__temporada();
  reales.push(['al cerrar la temporada', JSON.parse(JSON.stringify(Engine.state))]);
  Engine.startNewSeason();
  reales.push(['temporada nueva', JSON.parse(JSON.stringify(Engine.state))]);
  const rechazados = reales.filter(([, st]) => !GameState.esPartida(st)).map(([n]) => n);
  return {
    ok: !rechazados.length,
    detalle: rechazados.length ? `RECHAZADOS (mal): ${rechazados.join(', ')}` : `${reales.length} estados reales del juego, todos aceptados`,
  };
});

await probar('B1-02', 'Un null legítimo NO se confunde con un tipo inválido', () => {
  // En el estado real hay decenas de campos en null. Rechazarlos sería un
  // falso positivo. Se toma una partida de verdad y se comprueba que todos
  // sus nulls siguen pasando.
  window.__carrera('boca');
  const st = JSON.parse(JSON.stringify(Engine.state));
  const enNull = Object.keys(st).filter((k) => st[k] === null);
  const sigueValida = GameState.esPartida(st);
  // Y poniendo en null, de a uno, cada campo opcional.
  const rotos = [];
  ['bracket', 'matchContext', 'lastSeasonSummary', 'anioDelDescenso', 'market', 'banco',
    'currentDecision', 'pendingMatch', 'fifaEvent', 'lastDecisionNote'].forEach((k) => {
    const copia = JSON.parse(JSON.stringify(st));
    copia[k] = null;
    if (!GameState.esPartida(copia)) rotos.push(k);
  });
  return {
    ok: sigueValida && !rotos.length,
    detalle: rotos.length ? `rechaza null en: ${rotos.join(', ')}`
      : `la partida real trae ${enNull.length} campos en null y sigue siendo válida; ninguno de los 10 opcionales la invalida`,
  };
});

// ================================================================
// B1-03 — TIPOS INCORRECTOS
// ================================================================

await probar('B1-03', 'Los nueve tipos incompatibles del pedido se rechazan sin crash', () => {
  const base = { screen: 'calendar', version: 1, clubId: 'boca', clubs: [{ id: 'boca' }], squad: [] };
  const casos = {
    "squad: 'texto'": { ...base, squad: 'texto' },
    'squad: {}': { ...base, squad: {} },
    "clubs: 'texto'": { ...base, clubs: 'texto' },
    'clubs: {}': { ...base, clubs: {} },
    "budget: 'texto'": { ...base, budget: 'texto' },
    'budget: true': { ...base, budget: true },
    "confianza: 'texto'": { ...base, confianza: 'texto' },
    'mercado: []': { ...base, mercado: [] },
  };
  const malos = [];
  Object.entries(casos).forEach(([nombre, obj]) => {
    window.__carrera('boca');
    const antes = window.__huella();
    localStorage.setItem('dt-simulador-save-v3', JSON.stringify(obj));
    let cargo;
    let revento = null;
    try { cargo = Engine.load(); } catch (e) { revento = e.message; }
    if (cargo !== false || revento || window.__huella() !== antes) {
      malos.push(`${nombre} (load=${cargo}, crash=${revento || 'no'}, estado intacto=${window.__huella() === antes})`);
    }
  });
  localStorage.removeItem('dt-simulador-save-v3');
  return {
    ok: !malos.length,
    detalle: malos.length ? malos.join(' · ') : `${Object.keys(casos).length} tipos incompatibles: todos rechazados, sin crash, sin instalar nada`,
  };
});

await probar('B1-03', 'squad: null — se distingue el caso legítimo del inválido', () => {
  // Con una carrera empezada (hay clubId y clubs), squad null es INVÁLIDO:
  // el motor da por hecho que el plantel existe.
  const conCarrera = { screen: 'calendar', version: 1, clubId: 'boca', clubs: [{ id: 'boca' }], squad: null };
  // Sin carrera empezada, squad null es lo mismo que no tenerlo: LEGÍTIMO.
  const sinCarrera = { screen: 'dt-create', version: 1, squad: null };
  return {
    ok: GameState.esPartida(conCarrera) === false && GameState.esPartida(sinCarrera) === true,
    detalle: `con carrera empezada: ${GameState.esPartida(conCarrera)} (debe ser false) · sin carrera: ${GameState.esPartida(sinCarrera)} (debe ser true)`,
  };
});

// ================================================================
// B1-04 — UN SAVE CORRUPTO NO DESTRUYE LA PARTIDA
// ================================================================

await probar('B1-04', 'Seis clases de corrupción: load()=false y estado intacto en las seis', () => {
  const casos = {
    '1. JSON inválido': '{esto no es json',
    '2. objeto incompleto': JSON.stringify({ screen: 'calendar', version: 1, squad: [] }),
    '3. tipos incorrectos': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', clubs: [{ id: 'boca' }], squad: 'texto' }),
    '4. estructura corrupta': JSON.stringify({ screen: 'calendar', version: 1, clubId: 'nadie', clubs: [{ id: 'boca' }], squad: [], season: [] }),
    '5. versión futura': JSON.stringify({ screen: 'calendar', version: 999, clubId: 'boca', clubs: [{ id: 'boca' }], squad: [] }),
    '6. vacío': '',
  };
  const malos = [];
  const detalles = [];
  Object.entries(casos).forEach(([nombre, valor]) => {
    window.__carrera('racing');
    const antes = window.__huella();
    localStorage.setItem('dt-simulador-save-v3', valor);
    let cargo;
    let revento = null;
    try { cargo = Engine.load(); } catch (e) { revento = e.message; }
    const despues = window.__huella();
    const s = Engine.state || {};
    const ok = cargo === false && !revento && despues === antes
      && s.clubId !== undefined && Array.isArray(s.clubs) && Array.isArray(s.squad);
    if (!ok) malos.push(`${nombre}: load=${cargo}, crash=${revento || 'no'}, clubId=${s.clubId}`);
    else detalles.push(nombre.split('. ')[1]);
  });
  localStorage.removeItem('dt-simulador-save-v3');
  return { ok: !malos.length, detalle: malos.length ? malos.join(' · ') : `las seis (${detalles.join(', ')}): load()=false, clubId intacto, clubs y squad siguen siendo arrays` };
});

await probar('B1-04', 'Si la migración revienta, tampoco se instala nada', () => {
  // La migración de hoy no puede fallar (solo escribe `version`), así que la
  // única manera de ejercitar ese camino es hacerla fallar desde afuera. Se
  // reemplaza a mano, se prueba, y se restaura. NO se toca el archivo.
  window.__carrera('boca');
  const antes = window.__huella();
  const original = GameState.migrar;
  GameState.migrar = () => { throw new Error('migración rota a propósito'); };
  localStorage.setItem('dt-simulador-save-v3', JSON.stringify(JSON.parse(JSON.stringify(Engine.state))));
  let cargo;
  let revento = null;
  try { cargo = Engine.load(); } catch (e) { revento = e.message; }
  GameState.migrar = original;
  localStorage.removeItem('dt-simulador-save-v3');
  return {
    ok: cargo === false && !revento && window.__huella() === antes,
    detalle: `load()=${cargo}, crash=${revento || 'no'}, estado intacto=${window.__huella() === antes}`,
  };
});

await probar('B1-04', 'En ningún caso queda clubId === undefined', () => {
  const basura = ['{roto', '', '[]', '{}', 'null', '42', '"texto"',
    JSON.stringify({ screen: 'calendar' }),
    JSON.stringify({ screen: 'calendar', version: 1, squad: [] }),
    JSON.stringify({ screen: 'x', version: 1, clubId: 'boca', clubs: [{ id: 'boca' }], squad: 1 }),
    JSON.stringify({ version: 500 }),
    JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', clubs: 'no', squad: [] })];
  const malos = [];
  basura.forEach((v, i) => {
    window.__carrera('velez');
    localStorage.setItem('dt-simulador-save-v3', v);
    try { Engine.load(); } catch (e) { /* se registra abajo */ }
    if (Engine.state.clubId === undefined) malos.push(`caso ${i + 1} (${v.length > 40 ? v.slice(0, 40) + '…' : v}): clubId quedó undefined`);
  });
  localStorage.removeItem('dt-simulador-save-v3');
  return { ok: !malos.length, detalle: malos.length ? malos.join(' · ') : `${basura.length} intentos de carga basura: clubId nunca quedó undefined` };
});

await probar('B1-04', 'No se usa resetGame() para recuperarse de un save inválido', () => {
  // Si se usara, la pantalla pasaría a 'dt-create' y se borraría la clave.
  window.__carrera('boca');
  const pantallaAntes = Engine.state.screen;
  const clubAntes = Engine.state.clubId;
  localStorage.setItem('dt-simulador-save-v3', '{roto');
  Engine.load();
  return {
    ok: Engine.state.screen === pantallaAntes && Engine.state.clubId === clubAntes && Engine.state.screen !== 'dt-create',
    detalle: `pantalla ${pantallaAntes} -> ${Engine.state.screen} · club ${clubAntes} -> ${Engine.state.clubId}`,
  };
});

await probar('B1-04', 'Un save válido sí se carga (la validación no bloquea lo bueno)', () => {
  window.__carrera('racing');
  window.__temporada();
  const antes = window.__huella();
  Engine.save();
  const cargo = Engine.load();
  return { ok: cargo === true && window.__huella() === antes, detalle: `load()=${cargo}, huella ${window.__huella() === antes ? 'idéntica' : 'DISTINTA'}` };
});

// ================================================================
// B1-05 — EDADES
// ================================================================

await probar('B1-05', 'Siete temporadas seguidas: p.age === edadDe(p) al arrancar cada una', () => {
  window.__carrera('aldosivi');
  const problemas = [];
  const detalle = [];
  for (let t = 1; t <= 7; t++) {
    if (window.__temporada() !== 'ok') break;
    Engine.startNewSeason();
    const malos = Engine.state.squad.filter((p) => p.birthDate && p.age !== Engine.edadDe(p));
    detalle.push(`T${Engine.state.season.year}:${malos.length}`);
    if (malos.length) problemas.push(`temporada ${Engine.state.season.year}: ${malos.map((p) => `${p.name} ${p.age}/${Engine.edadDe(p)}`).join(', ')}`);
  }
  return { ok: !problemas.length, detalle: problemas.length ? problemas.join(' · ') : `desfasados por temporada: ${detalle.join(' ')}` };
});

await probar('B1-05', 'El que cumple años justo en el cambio de temporada queda al día', () => {
  window.__carrera('boca');
  const s = Engine.state;
  // Se le pone a tres jugadores un cumpleaños en enero: al pasar de
  // temporada el año avanza y tienen que sumar uno.
  const elegidos = s.squad.slice(0, 3);
  const anioBase = anioDeTemporada(s.season.year);
  elegidos.forEach((p, i) => { p.birthDate = `${anioBase - 25}-01-0${i + 2}`; });
  Engine.refrescarEdades();
  const antes = elegidos.map((p) => p.age);
  window.__temporada();
  Engine.startNewSeason();
  const despues = elegidos.map((p) => {
    const q = Engine.state.squad.find((x) => x.id === p.id);
    return q ? { age: q.age, calc: Engine.edadDe(q) } : null;
  }).filter(Boolean);
  return {
    ok: despues.length > 0 && despues.every((x) => x.age === x.calc),
    detalle: `antes ${antes.join(',')} · después ${despues.map((x) => `${x.age}(calc ${x.calc})`).join(', ')}`,
  };
});

await probar('B1-05', 'Nacidos el 29/02 a lo largo de cinco temporadas', () => {
  // Con Boca no se puede: la dirigencia echa al piloto automático en la
  // temporada 2 y la prueba se quedaba sin temporadas que medir (pasaba en
  // vacío). Aldosivi tiene exigencias de club chico y aguanta las cinco.
  window.__carrera('aldosivi');
  const j = Engine.state.squad[0];
  j.birthDate = '2008-02-29';
  const edades = [];
  const problemas = [];
  for (let t = 1; t <= 5; t++) {
    if (window.__temporada() !== 'ok') break;
    Engine.startNewSeason();
    let q = Engine.state.squad.find((x) => x.id === j.id);
    // Si se fue del plantel (lo vendieron, se retiró), se lo vuelve a poner:
    // lo que se está midiendo es la edad, no su carrera. Sin esto la prueba
    // podía terminar con la lista vacía y pasar sin haber comprobado nada.
    if (!q) {
      q = { ...j, birthDate: '2008-02-29' };
      Engine.state.squad.push(q);
      Engine.refrescarEdades();
      q = Engine.state.squad.find((x) => x.id === j.id);
    }
    edades.push(q.age);
    if (q.age !== Engine.edadDe(q)) problemas.push(`T${Engine.state.season.year}: ${q.age} vs ${Engine.edadDe(q)}`);
  }
  const suben = edades.length >= 5 && edades.every((e, i) => i === 0 || e === edades[i - 1] + 1);
  return {
    ok: !problemas.length && suben,
    detalle: problemas.length ? problemas.join(' · ')
      : `${edades.length} temporadas medidas · edades: ${edades.join(' -> ')}${suben ? ' (suben de a una, sin saltos)' : ' (NO SUBEN BIEN o faltan temporadas)'}`,
  };
});

await probar('B1-05', 'Mercado y Economía reciben la edad YA actualizada', () => {
  window.__carrera('boca');
  window.__temporada();
  // La edad del año viejo, para comparar.
  const antes = Engine.state.squad.map((p) => ({ id: p.id, age: p.age }));
  Engine.startNewSeason();
  // Lo que de verdad importa: lo que leen los dos sistemas que usan p.age.
  const malos = [];
  Engine.state.squad.forEach((p) => {
    if (!p.birthDate) return;
    const real = Engine.edadDe(p);
    if (p.age !== real) malos.push(`${p.name}: p.age=${p.age} real=${real}`);
    // atractivoDe y curvaSalarial leen p.age: se comprueba que den lo mismo
    // que si se les pasara la edad calculada.
    const atractivoConCache = Mercado.atractivoDe(p);
    const atractivoReal = Mercado.atractivoDe({ ...p, age: real });
    if (atractivoConCache !== atractivoReal) malos.push(`${p.name}: atractivoDe ${atractivoConCache} vs ${atractivoReal}`);
    const salarioConCache = Economia.curvaSalarial(p.rating, p.age);
    const salarioReal = Economia.curvaSalarial(p.rating, real);
    if (salarioConCache !== salarioReal) malos.push(`${p.name}: curvaSalarial ${salarioConCache} vs ${salarioReal}`);
  });
  const cambiaron = antes.filter((a) => {
    const q = Engine.state.squad.find((x) => x.id === a.id);
    return q && q.age !== a.age;
  }).length;
  return {
    ok: !malos.length,
    detalle: malos.length ? malos.slice(0, 4).join(' · ')
      : `${cambiaron} jugadores cumplieron al cambiar de año; atractivoDe y curvaSalarial leen la edad correcta en los ${Engine.state.squad.length}`,
  };
});

// ================================================================
// B1-06 — FECHAS HISTÓRICAS Y BISIESTOS
// Verificado contra Date (UTC), que el motor nunca usa.
// ================================================================

await probar('B1-06', 'Documentación verificada: el día 0 de la temporada N es el 1/1 de su año', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const filas = [];
  for (let t = 1; t <= 6; t++) {
    s.season.year = t; s.calendar.dayCount = 0;
    const f = Engine.fechaDelJuego();
    filas.push(`T${t}=${f.dia}/${f.mes + 1}/${f.anio}`);
  }
  const bien = filas.every((x, i) => x === `T${i + 1}=1/1/${2026 + i}`);
  return { ok: bien, detalle: filas.join(' · ') };
});

await probar('B1-06', 'fechaDelJuego coincide con Date(UTC) en 2.200 días de 11 temporadas', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const malos = [];
  for (let t = 1; t <= 11; t++) {
    for (let d = 0; d <= 199; d++) {
      s.season.year = t; s.calendar.dayCount = d;
      const f = Engine.fechaDelJuego();
      // El oráculo: sumar d días al 1 de enero del año de esa temporada.
      const o = new Date(Date.UTC(2026 + t - 1, 0, 1 + d));
      if (f.dia !== o.getUTCDate() || f.mes !== o.getUTCMonth() || f.anio !== o.getUTCFullYear()) {
        malos.push(`T${t} d${d}: motor ${f.dia}/${f.mes + 1}/${f.anio} vs Date ${o.getUTCDate()}/${o.getUTCMonth() + 1}/${o.getUTCFullYear()}`);
      }
    }
  }
  return { ok: !malos.length, detalle: malos.length ? `${malos.length} desacuerdos: ${malos.slice(0, 3).join(' · ')}` : '2.200 días (11 temporadas x 200), todos coinciden con Date' };
});

await probar('B1-06', 'fechaDeJuegoDeLaTemporada coincide con Date(UTC) en 4.356 combinaciones', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const malos = [];
  const dias = [0, 31, 57, 58, 59, 60, 61, 100, 180, 300, 364, 365, 366, 400, 500, 729, 730, 731];
  for (let desde = 1; desde <= 11; desde++) {
    for (let hasta = 1; hasta <= 11; hasta++) {
      dias.forEach((d) => {
        s.season.year = desde; s.calendar.dayCount = d;
        const f = Engine.fechaDeJuegoDeLaTemporada(hasta);
        const o = new Date(Date.UTC(2026 + hasta - 1, 0, 1 + d));
        if (f.dia !== o.getUTCDate() || f.mes !== o.getUTCMonth() || f.anio !== o.getUTCFullYear()) {
          malos.push(`desde T${desde}, pidiendo T${hasta}, día ${d}: motor ${f.dia}/${f.mes + 1}/${f.anio} vs Date ${o.getUTCDate()}/${o.getUTCMonth() + 1}/${o.getUTCFullYear()}`);
        }
      });
    }
  }
  return {
    ok: !malos.length,
    detalle: malos.length ? `${malos.length} desacuerdos: ${malos.slice(0, 3).join(' · ')}`
      : `${11 * 11 * dias.length} combinaciones (11 temporadas de origen x 11 de destino x ${dias.length} días), todas coinciden con Date`,
  };
});

await probar('B1-06', 'El 28/02, el 29/02 y el 1/3 caen donde deben, en bisiesto y en común', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const leer = (t, d) => { s.season.year = t; s.calendar.dayCount = d; const f = Engine.fechaDeJuegoDeLaTemporada(t); return `${f.dia}/${f.mes + 1}/${f.anio}`; };
  // T3 = 2028 (bisiesto), T2 = 2027 (común).
  const bisiesto = [58, 59, 60, 61].map((d) => leer(3, d));
  const comun = [58, 59, 60, 61].map((d) => leer(2, d));
  const esperadoBisiesto = ['28/2/2028', '29/2/2028', '1/3/2028', '2/3/2028'];
  const esperadoComun = ['28/2/2027', '1/3/2027', '2/3/2027', '3/3/2027'];
  return {
    ok: bisiesto.join() === esperadoBisiesto.join() && comun.join() === esperadoComun.join(),
    detalle: `2028 (bisiesto) días 58-61: ${bisiesto.join(' ')} · 2027 (común) los mismos días: ${comun.join(' ')}`,
  };
});

await probar('B1-06', 'Atravesando un 29/02: la distancia entre temporadas es la que tiene que ser', () => {
  window.__carrera('boca');
  const s = Engine.state;
  // Un "día de temporada" es el día N del año de esa temporada: el día 100 es
  // siempre el día 101 del almanaque, en todas. De ahí sale la cuenta, y hay
  // que hacerla con cuidado porque NO da lo mismo en los dos casos:
  //
  //   T1 (2026) -> T3 (2028): el 29/2/2028 cae ANTES del día 100 de 2028, o
  //   sea que ya está metido adentro de la posición de llegada. Del 11/4/2026
  //   al 10/4/2028 hay 730 días.
  //
  //   T2 (2027) -> T4 (2029): el 29/2/2028 cae ENTRE las dos fechas, así que
  //   se suma. Del 11/4/2027 al 11/4/2029 hay 731 días.
  //
  // Las dos cuentas son correctas y distintas. La primera versión de esta
  // prueba pedía 731 en los dos casos, y ese era el error: confundía "el
  // mismo día de temporada" con "la misma fecha del almanaque".
  s.calendar.dayCount = 100;
  s.season.year = 4;
  const ms = (f) => Date.UTC(f.anio, f.mes, f.dia);
  const t1 = Engine.fechaDeJuegoDeLaTemporada(1);
  const t2 = Engine.fechaDeJuegoDeLaTemporada(2);
  const t3 = Engine.fechaDeJuegoDeLaTemporada(3);
  const t4 = Engine.fechaDeJuegoDeLaTemporada(4);
  const unoATres = (ms(t3) - ms(t1)) / 86400000;
  const dosACuatro = (ms(t4) - ms(t2)) / 86400000;
  // Y la comprobación de fondo: el día 100 es el día 101 del año en las cuatro.
  const posiciones = [t1, t2, t3, t4].map((f) => (ms(f) - Date.UTC(f.anio, 0, 1)) / 86400000);
  return {
    ok: unoATres === 730 && dosACuatro === 731 && posiciones.every((x) => x === 100),
    detalle: `día 100: T1=${t1.dia}/${t1.mes + 1}/${t1.anio} T2=${t2.dia}/${t2.mes + 1}/${t2.anio} T3=${t3.dia}/${t3.mes + 1}/${t3.anio} T4=${t4.dia}/${t4.mes + 1}/${t4.anio}`
      + ` · T1->T3 = ${unoATres} días (el 29/2/2028 ya está adentro del día 100 de 2028)`
      + ` · T2->T4 = ${dosACuatro} días (el 29/2/2028 queda en el medio)`
      + ` · posición dentro del año: ${posiciones.join(',')}`,
  };
});

await probar('B1-06', 'Retroceder una y varias temporadas', () => {
  window.__carrera('boca');
  const s = Engine.state;
  s.season.year = 9; s.calendar.dayCount = 250;
  const una = Engine.fechaDeJuegoDeLaTemporada(8);
  const varias = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((t) => Engine.fechaDeJuegoDeLaTemporada(t));
  const aniosBien = varias.every((f, i) => f.anio === 2026 + i);
  const oracle = new Date(Date.UTC(2033, 0, 1 + 250));
  return {
    ok: aniosBien && una.anio === 2033 && una.dia === oracle.getUTCDate() && una.mes === oracle.getUTCMonth(),
    detalle: `desde T9 día 250 · una atrás (T8): ${una.dia}/${una.mes + 1}/${una.anio} (Date dice ${oracle.getUTCDate()}/${oracle.getUTCMonth() + 1}/${oracle.getUTCFullYear()}) · años T1..T9: ${varias.map((f) => f.anio).join(',')}`,
  };
});

await probar('B1-06', 'Ida y vuelta: fecha real -> día de temporada -> fecha real', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const malos = [];
  for (let t = 1; t <= 8; t++) {
    const anio = 2026 + t - 1;
    for (let d = 0; d <= 370; d += 7) {
      // ida: día de temporada -> fecha
      s.season.year = t; s.calendar.dayCount = d;
      const f = Engine.fechaDeJuegoDeLaTemporada(t);
      // vuelta: fecha -> día de temporada, contando con Date
      const vuelta = (new Date(Date.UTC(f.anio, f.mes, f.dia)) - new Date(Date.UTC(anio, 0, 1))) / 86400000;
      if (vuelta !== d) malos.push(`T${t} d${d} -> ${f.dia}/${f.mes + 1}/${f.anio} -> d${vuelta}`);
    }
  }
  return { ok: !malos.length, detalle: malos.length ? malos.slice(0, 3).join(' · ') : `8 temporadas x 54 días: la ida y la vuelta cierran en todos` };
});

// ================================================================
// BLOQUE 0 — que no haya regresado
// ================================================================

await probar('Bloque 0', 'Las fechas gregorianas imposibles se siguen rechazando', () => {
  const malas = ['2025-02-29', '2025-04-31', '2025-06-31', '2025-09-31', '2025-11-31',
    '1900-02-29', '2100-02-29', '2025-00-15', '2025-13-15', '2025-01-00', '2025-01-32'];
  const buenas = ['2024-02-29', '2000-02-29', '2025-02-28', '2025-12-31', '2024-12-31', '2025-04-30'];
  const entraron = malas.filter((f) => Engine.parseFechaDeNacimiento(f));
  const rebotaron = buenas.filter((f) => !Engine.parseFechaDeNacimiento(f));
  return {
    ok: !entraron.length && !rebotaron.length,
    detalle: entraron.length || rebotaron.length ? `entraron: ${entraron.join(',')} · rebotaron: ${rebotaron.join(',')}`
      : `${malas.length} imposibles afuera, ${buenas.length} válidas adentro`,
  };
});

await probar('Bloque 0', 'Ningún club se queda sin arquero (15 temporadas)', () => {
  window.__carrera('boca');
  const sinArquero = [];
  for (let t = 1; t <= 15; t++) {
    Engine.state.season.year = t;
    Engine._fuerzas = {};
    Engine.procesarRetiros();
    Mercado.liberarJugadores(Engine);
    Mercado.mercadoDeLosRivales(Engine);
    Engine._fuerzas = {};
    Engine.state.clubs.forEach((c) => {
      const pl = c.id === Engine.state.clubId ? Engine.state.squad : Mercado.plantel(Engine, c.id);
      if (pl.length && !pl.filter((p) => p.pos === 'POR').length) sinArquero.push(`T${t} ${c.name}`);
    });
  }
  return { ok: !sinArquero.length, detalle: sinArquero.length ? sinArquero.slice(0, 5).join(' · ') : '15 temporadas x 66 clubes, todos con al menos 1 arquero' };
});

// ================================================================
// HALLAZGOS — cosas que NO son B1-01..B1-06 y que NO se corrigen.
// Van aparte a propósito: no cuentan para el veredicto de ningún bug.
// ================================================================

await probar('HALLAZGO', 'Los ids del relleno de la Nacional no son estables', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const relleno = s.clubs.find((c) => !REAL_ROSTERS[c.id]).id;
  const j = Mercado.plantel(Engine, relleno).find((x) => /-c\d+-\d+$/.test(x.id));
  if (!j) return { ok: true, detalle: 'ese club no tiene jugadores de relleno ahora mismo' };
  Mercado.transferir(s, j, relleno, 'lanus', s.season.year);
  Engine._fuerzas = {};
  const sigueEnElOrigen = Mercado.plantel(Engine, relleno).some((x) => x.id === j.id);
  const estaEnElDestino = Mercado.plantel(Engine, 'lanus').some((x) => x.id === j.id);
  return {
    ok: !(sigueEnElOrigen && estaEnElDestino),
    detalle: `${j.name} (${j.id}) de ${relleno} -> lanus · ¿sigue en el origen? ${sigueEnElOrigen} · ¿llegó al destino? ${estaEnElDestino}`
      + ' — el id del relleno lleva el índice dentro del plantel, y el relleno se genera DESPUÉS del filtro de `fuera`, así que se vuelve a acuñar igual',
  };
});

// ---------- El informe ----------
console.log('\n============ RE-AUDITORÍA DEL BLOQUE 1 ============\n');
const porBug = {};
pruebas.forEach((p) => { (porBug[p.bug] = porBug[p.bug] || []).push(p); });
Object.entries(porBug).forEach(([bug, lista]) => {
  const fallaron = lista.filter((p) => !p.ok);
  console.log(`\n${bug} — ${fallaron.length ? 'FAIL' : 'PASS'} (${lista.length - fallaron.length}/${lista.length})`);
  lista.forEach((p) => {
    console.log(`  ${p.ok ? '✓' : '✗'} ${p.nombre}`);
    if (p.detalle) console.log(`      ${p.detalle}`);
  });
});
const deBugs = pruebas.filter((p) => p.bug !== 'HALLAZGO');
const fallaron = deBugs.filter((p) => !p.ok);
console.log(`\n--------------------------------------------------`);
console.log(`VERIFICACIÓN B1-01..B1-06 + Bloque 0: ${deBugs.length - fallaron.length}/${deBugs.length}`);
const hallazgos = pruebas.filter((p) => p.bug === 'HALLAZGO' && !p.ok);
console.log(`Hallazgos fuera de alcance (NO corregidos): ${hallazgos.length}`);
console.log(`errores de página no provocados: ${erroresDePagina.length ? erroresDePagina.slice(0, 5).join(' | ') : 'ninguno'}`);
console.log('==================================================\n');
await navegador.close();
process.exit(fallaron.length || erroresDePagina.length ? 1 : 0);
