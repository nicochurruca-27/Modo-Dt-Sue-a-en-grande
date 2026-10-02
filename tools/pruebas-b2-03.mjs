// PRUEBAS DE LA CORRECCIÓN B2-03 — datos que se pierden al cambiar de club.
//
//     npm install --no-save playwright
//     node tools/pruebas-b2-03.mjs
//
// La auditoría del Bloque 2 encontró que un jugador transferido perdía cuatro
// campos: altPosDetail, clause, salary y transferState. Pero "perder un
// campo" no es automáticamente un bug: hay que mirar qué significa cada uno.
//
// `Mercado.plantel()` arma a los jugadores de plantel real así (js/mercado.js):
//
//     altPosDetail: p.altPosDetail,                      <- siempre
//     salary: p.salary,                                  <- siempre
//     clause: aniosPasados ? undefined : p.clause,       <- SOLO la temporada 1
//     transferState: p.transferState,                    <- siempre
//
// Los dos primeros son del jugador y el código base los conserva sin
// condiciones: perderlos en un pase es un bug.
//
// Los otros dos no. La cláusula es del CONTRATO, y el propio código base la
// tira apenas pasa un año porque queda vieja; un pase rompe ese contrato de
// una manera todavía más fuerte, así que no puede viajar. Y `transferState`
// no es del jugador sino la POSTURA DEL CLUB sobre él ('Intocable',
// 'Retenido', 'Transferible', 'Fin de contrato cercano'): la postura del club
// que lo vendió no dice nada del club que lo compró, y como el fichado firma
// contrato nuevo por 3 años, un 'Fin de contrato cercano' heredado sería
// directamente falso. `Mercado.indice` ya tiene la salida prevista para
// cuando no está: sortea la postura del club nuevo.
//
// Así que lo que se arregla es altPosDetail y salary, y lo que se verifica de
// clause y transferState es que se van A PROPÓSITO. Las pruebas 7 y 8 no dan
// eso por sentado: lo demuestran ejecutando el código base.

import path from 'node:path';
import { chromium } from 'playwright';

const raiz = path.resolve(import.meta.dirname, '..');
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navegador.newPage();
const erroresDePagina = [];
page.on('pageerror', (e) => erroresDePagina.push(e.message));
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
  window.__en = (clubId, id) => Mercado.plantel(Engine, clubId).find((p) => p.id === id) || null;
  // Un jugador de plantel real que tenga los cuatro campos cargados, para que
  // la prueba no pase por tener todo vacío de los dos lados.
  window.__conTodo = (clubId) => Mercado.plantel(Engine, clubId).find((p) =>
    Array.isArray(p.altPosDetail) && p.altPosDetail.length && p.salary && p.clause && p.transferState);
  window.__viajan = (p) => ({
    altPosDetail: p ? JSON.stringify(p.altPosDetail) : null,
    salary: p ? p.salary : null,
  });
});

let pasaron = 0;
const total = [];
async function probar(nombre, fn) {
  total.push(nombre);
  let r;
  try { r = await page.evaluate(fn); } catch (e) { r = { ok: false, detalle: 'EXCEPCIÓN: ' + e.message }; }
  console.log(`  ${r.ok ? '✓' : '✗'} ${total.length}. ${nombre}`);
  console.log(`      ${r.detalle}`);
  if (r.ok) pasaron++;
}

console.log('\n========== PRUEBAS B2-03 ==========\n');

await probar('Transferencia simple: altPosDetail y salary quedan iguales', () => {
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  if (!j) return { ok: false, detalle: 'no se encontró un jugador con los cuatro campos' };
  const antes = window.__viajan(j);
  Mercado.transferir(Engine.state, j, 'estudianteslp', 'river', 1);
  Engine._fuerzas = {};
  const despues = window.__viajan(window.__en('river', j.id));
  const faltan = Object.keys(antes).filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]));
  return {
    ok: !faltan.length,
    detalle: `${j.name} (${j.id}) · altPosDetail ${antes.altPosDetail} -> ${despues.altPosDetail}`
      + ` · salary ${antes.salary} -> ${despues.salary}`
      + (faltan.length ? ` · SE PIERDEN: ${faltan.join(', ')}` : ''),
  };
});

await probar('Reconstruir el plantel muchas veces no los borra', () => {
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  const antes = window.__viajan(j);
  Mercado.transferir(Engine.state, j, 'estudianteslp', 'river', 1);
  const fallos = [];
  for (let i = 0; i < 20; i++) {
    Engine._fuerzas = {};
    const d = window.__viajan(window.__en('river', j.id));
    if (JSON.stringify(d) !== JSON.stringify(antes)) fallos.push(`vuelta ${i}`);
  }
  return {
    ok: !fallos.length,
    detalle: fallos.length ? `cambió en: ${fallos.slice(0, 3).join(', ')}`
      : `${j.name}: 20 reconstrucciones y los dos campos siguen iguales`,
  };
});

await probar('Segunda transferencia: siguen iguales', () => {
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  const antes = window.__viajan(j);
  Mercado.transferir(Engine.state, j, 'estudianteslp', 'river', 1);
  Engine._fuerzas = {};
  const enRiver = window.__en('river', j.id);
  Mercado.transferir(Engine.state, enRiver, 'river', 'lanus', 1);
  Engine._fuerzas = {};
  const despues = window.__viajan(window.__en('lanus', j.id));
  return {
    ok: JSON.stringify(antes) === JSON.stringify(despues),
    detalle: `${j.name}: estudianteslp -> river -> lanus ·`
      + ` altPosDetail ${antes.altPosDetail} -> ${despues.altPosDetail} · salary ${antes.salary} -> ${despues.salary}`,
  };
});

await probar('Después de avanzar de temporada siguen iguales', () => {
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  const antes = window.__viajan(j);
  Mercado.transferir(Engine.state, j, 'estudianteslp', 'river', 1);
  const traza = [];
  const fallos = [];
  for (let t = 1; t <= 6; t++) {
    Engine.state.season.year = t; Engine._fuerzas = {};
    const d = window.__viajan(window.__en('river', j.id));
    traza.push(`T${t}: salary=${d.salary} alt=${d.altPosDetail ? 'sí' : 'no'}`);
    if (JSON.stringify(d) !== JSON.stringify(antes)) fallos.push(`T${t}`);
  }
  return {
    ok: !fallos.length,
    detalle: fallos.length ? `cambió en ${fallos.join(',')} · ${traza.join(' · ')}` : traza.join(' · '),
  };
});

await probar('Varios transferidos: nadie recibe los datos de otro', () => {
  window.__carrera('boca');
  const candidatos = Mercado.plantel(Engine, 'estudianteslp')
    .filter((p) => Array.isArray(p.altPosDetail) && p.altPosDetail.length && p.salary)
    .slice(0, 8);
  if (candidatos.length < 4) return { ok: false, detalle: 'pocos candidatos' };
  const esperado = {};
  candidatos.forEach((p) => { esperado[p.id] = window.__viajan(p); });
  candidatos.forEach((p) => Mercado.transferir(Engine.state, p, 'estudianteslp', 'river', 1));
  Engine._fuerzas = {};
  const cruzados = [];
  candidatos.forEach((p) => {
    const d = window.__viajan(window.__en('river', p.id));
    if (JSON.stringify(d) !== JSON.stringify(esperado[p.id])) {
      // ¿Le tocaron los datos de otro?
      const deQuien = Object.keys(esperado).find((id) => id !== p.id
        && JSON.stringify(esperado[id]) === JSON.stringify(d));
      cruzados.push(`${p.id}: ${deQuien ? `tiene los datos de ${deQuien}` : 'no coincide con los suyos'}`);
    }
  });
  return {
    ok: !cruzados.length,
    detalle: cruzados.length ? cruzados.slice(0, 3).join(' · ')
      : `${candidatos.length} transferidos a la vez: cada uno conservó lo suyo y ninguno recibió datos de otro`,
  };
});

await probar('Guardar y cargar no los pierde', () => {
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  const antes = window.__viajan(j);
  Mercado.transferir(Engine.state, j, 'estudianteslp', 'river', 1);
  Engine.save();
  const cargo = Engine.load();
  Engine._fuerzas = {};
  const despues = window.__viajan(window.__en('river', j.id));
  return {
    ok: cargo && JSON.stringify(antes) === JSON.stringify(despues),
    detalle: `load()=${cargo} · altPosDetail ${despues.altPosDetail} · salary ${despues.salary}`,
  };
});

await probar('DEMOSTRACIÓN: el código base tira la cláusula al pasar un año', () => {
  // Si el propio juego descarta la cláusula de un jugador que NO se movió de
  // club apenas pasa una temporada, entonces la cláusula no es un dato del
  // jugador: es una foto del contrato de hoy. Y un pase rompe ese contrato
  // más fuerte que el paso del tiempo.
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  Engine.state.season.year = 1; Engine._fuerzas = {};
  const enT1 = window.__en('estudianteslp', j.id);
  Engine.state.season.year = 2; Engine._fuerzas = {};
  const enT2 = window.__en('estudianteslp', j.id);
  return {
    ok: !!enT1.clause && enT2.clause === undefined,
    detalle: `${j.name} SIN moverse de club: cláusula en T1 = ${enT1.clause},`
      + ` en T2 = ${enT2.clause} · el diseño la descarta solo, así que no viaja en un pase`,
  };
});

await probar('DEMOSTRACIÓN: sin transferState el club nuevo fija su propia postura', () => {
  // `transferState` no es del jugador: es lo que opina SU club de él. El
  // fichado firma contrato nuevo por 3 años, así que heredar un
  // 'Fin de contrato cercano' sería falso. Se comprueba que `Mercado.indice`
  // tiene prevista la ausencia y le pone una postura al club nuevo.
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  const estadoViejo = j.transferState;
  Mercado.transferir(Engine.state, j, 'estudianteslp', 'river', 1);
  Engine._fuerzas = {};
  const fichado = window.__en('river', j.id);
  const fila = Mercado.indice(Engine).find((x) => x.id === j.id);
  return {
    ok: fichado.transferState === undefined && !!fila && !!fila.estado && fichado.contractYears === 3,
    detalle: `${j.name}: en estudianteslp era "${estadoViejo}" · en river no hereda nada`
      + ` (transferState=${fichado.transferState}, contrato nuevo de ${fichado.contractYears} años)`
      + ` y el mercado le asigna "${fila ? fila.estado : 'SIN FILA'}"`,
  };
});

await probar('altPosDetail no comparte referencia con nadie', () => {
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  Mercado.transferir(Engine.state, j, 'estudianteslp', 'river', 1);
  Engine._fuerzas = {};
  const uno = window.__en('river', j.id);
  const otro = window.__en('river', j.id);
  if (!uno || !uno.altPosDetail) return { ok: false, detalle: 'el fichado no tiene altPosDetail' };
  // Dos reconstrucciones no pueden compartir el array, y tocarlo no puede
  // llegar ni al estado guardado ni a REAL_ROSTERS.
  const guardadoAntes = JSON.stringify(Mercado.movimientosDe(Engine.state, 'river').dentro
    .find((x) => x.id === j.id).altPosDetail);
  const originalAntes = JSON.stringify(REAL_ROSTERS['estudianteslp']
    .find((x) => x.name === j.name).altPosDetail);
  uno.altPosDetail.push('INVENTADO');
  const guardadoDespues = JSON.stringify(Mercado.movimientosDe(Engine.state, 'river').dentro
    .find((x) => x.id === j.id).altPosDetail);
  const originalDespues = JSON.stringify(REAL_ROSTERS['estudianteslp']
    .find((x) => x.name === j.name).altPosDetail);
  return {
    ok: uno.altPosDetail !== otro.altPosDetail
      && guardadoAntes === guardadoDespues && originalAntes === originalDespues,
    detalle: `dos reconstrucciones comparten el array: ${uno.altPosDetail === otro.altPosDetail}`
      + ` (tiene que ser false) · al tocarlo, el estado guardado quedó ${guardadoAntes === guardadoDespues ? 'intacto' : 'CONTAMINADO'}`
      + ` y REAL_ROSTERS quedó ${originalAntes === originalDespues ? 'intacto' : 'CONTAMINADO'}`,
  };
});

console.log(`\n${pasaron}/${total.length} pruebas pasaron`);
if (erroresDePagina.length) console.log(`\nerrores de página: ${erroresDePagina.join(' | ')}`);
await navegador.close();
process.exit(pasaron === total.length ? 0 : 1);
