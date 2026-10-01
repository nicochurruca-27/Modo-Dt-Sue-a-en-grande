// REPRODUCCIONES MÍNIMAS de los bugs que encontró la auditoría del Bloque 1.
//
//     npm install --no-save playwright
//     node tools/auditoria-bloque1-reproducciones.mjs
//
// Esto NO corrige nada. Cada caso aísla un bug en los menos pasos posibles,
// para que el bloque de corrección tenga con qué comprobar que lo arregló.
// Mientras los bugs sigan vivos, este archivo IMPRIME QUE FALLAN: eso es lo
// correcto. Cuando estén corregidos, los 5 casos tienen que dar ✓.

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navegador.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
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
});

const casos = [];
const caso = async (id, nombre, fn) => {
  try {
    const r = await page.evaluate(fn);
    casos.push({ id, nombre, ...r });
  } catch (e) {
    casos.push({ id, nombre, ok: false, detalle: `reventó: ${e.message}` });
  }
};

// ---------- B1-01 ----------
await caso('B1-01', 'Dos transferencias seguidas dejan al jugador en DOS clubes', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const anio = s.season.year;
  const j = Mercado.plantel(Engine, 'estudianteslp')[5];
  // Estudiantes -> Argentinos
  Mercado.transferir(s, j, 'estudianteslp', 'argentinos', anio);
  Engine._fuerzas = {};
  const enArgentinos = Mercado.plantel(Engine, 'argentinos').find((x) => x.id === j.id);
  // Argentinos -> Quilmes
  Mercado.transferir(s, enArgentinos, 'argentinos', 'quilmes', anio);
  Engine._fuerzas = {};
  const donde = ['estudianteslp', 'argentinos', 'quilmes']
    .filter((c) => Mercado.plantel(Engine, c).some((x) => x.id === j.id));
  return {
    ok: donde.length === 1 && donde[0] === 'quilmes',
    detalle: `${j.name} (${j.id}) aparece en: ${donde.join(' + ')} — debería aparecer solo en quilmes`,
  };
});

// ---------- B1-02 ----------
await caso('B1-02', 'Un save sin clubId se acepta como partida válida', () => {
  window.__carrera('boca');
  localStorage.setItem('dt-simulador-save-v3', JSON.stringify({ screen: 'calendar', version: 1, squad: [] }));
  const cargo = Engine.load();
  return { ok: cargo === false, detalle: `Engine.load() devolvió ${cargo} — debería devolver false` };
});

// ---------- B1-03 ----------
await caso('B1-03', 'Un save con squad que no es un array hace reventar a load()', () => {
  window.__carrera('boca');
  localStorage.setItem('dt-simulador-save-v3',
    JSON.stringify({ screen: 'calendar', version: 1, clubId: 'boca', squad: 'no soy un array' }));
  let cargo;
  let revento = null;
  try { cargo = Engine.load(); } catch (e) { revento = e.message; }
  return {
    ok: revento === null && cargo === false,
    detalle: revento ? `tiró una excepción: "${revento}"` : `devolvió ${cargo}`,
  };
});

// ---------- B1-04 ----------
await caso('B1-04', 'Un save inválido PISA la partida buena que estabas jugando', () => {
  window.__carrera('boca');
  const buena = JSON.stringify(Engine.state);
  localStorage.setItem('dt-simulador-save-v3', JSON.stringify({ screen: 'calendar', version: 1, squad: [] }));
  Engine.load();
  const sigueLaBuena = JSON.stringify(Engine.state) === buena;
  return {
    ok: sigueLaBuena,
    detalle: sigueLaBuena ? 'la partida en memoria sobrevivió'
      : `la partida en memoria se perdió: clubId quedó en ${JSON.stringify(Engine.state.clubId)}, squad ${Array.isArray(Engine.state.squad) ? Engine.state.squad.length : 'no es array'}`,
  };
});

// ---------- B1-05 ----------
await caso('B1-05', 'Al empezar una temporada, p.age queda desfasada de la fecha de nacimiento', () => {
  window.__carrera('aldosivi');
  window.__temporada();
  const antes = Engine.state.squad.filter((p) => p.birthDate && p.age !== Engine.edadDe(p)).length;
  Engine.startNewSeason();
  const desfasados = Engine.state.squad
    .filter((p) => p.birthDate && p.age !== Engine.edadDe(p))
    .map((p) => `${p.name}: p.age=${p.age} pero edadDe=${Engine.edadDe(p)}`);
  return {
    ok: desfasados.length === 0,
    detalle: desfasados.length
      ? `al cerrar la temporada había ${antes} desfasados; después de startNewSeason hay ${desfasados.length}: ${desfasados.join(' · ')}`
      : 'ninguno',
  };
});


await page.evaluate(() => localStorage.removeItem('dt-simulador-save-v3'));

console.log('\nREPRODUCCIONES DE LOS BUGS DEL BLOQUE 1\n');
casos.forEach((c) => {
  console.log(`  ${c.ok ? '✓ CORREGIDO' : '✗ SIGUE VIVO '} ${c.id} — ${c.nombre}`);
  if (c.detalle) console.log(`      ${c.detalle}`);
});
const vivos = casos.filter((c) => !c.ok);
console.log(`\n${vivos.length} de ${casos.length} bugs siguen vivos.`);
if (errores.length) console.log('errores de la página:', errores.slice(0, 5));
await navegador.close();
// No falla el proceso: mientras los bugs existan, "fallar" es el resultado
// esperado. Lo que importa es la lista de arriba.
process.exit(0);
