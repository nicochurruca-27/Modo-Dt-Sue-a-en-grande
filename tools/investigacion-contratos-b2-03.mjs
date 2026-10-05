// INVESTIGACIÓN B2-03 — ciclo de vida de la cláusula de rescisión.
//
//     npm install --no-save playwright
//     node tools/investigacion-contratos-b2-03.mjs
//
// ESTO NO ES CÓDIGO DEL JUEGO. Es un arnés de diagnóstico: solo observa,
// no corrige nada y no modifica un solo archivo de js/.
//
// Pregunta central: ¿por qué `clause` pasa de tener un valor a quedar
// `undefined` después de avanzar una temporada, sin que el jugador cambie
// de club?

import path from 'node:path';
import { chromium } from 'playwright';

const raiz = path.resolve(import.meta.dirname, '..');
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navegador.newPage();
const erroresDePagina = [];
page.on('pageerror', (e) => erroresDePagina.push(e.message));
await page.goto('file://' + path.join(raiz, 'index.html'));
await page.waitForFunction(() => typeof Juveniles !== 'undefined');

const L = (x) => console.log(x);

await page.evaluate(() => {
  window.__carrera = (c) => {
    localStorage.removeItem('dt-simulador-save-v3');
    Engine.createDT('Nico', 'ARG', 'equilibrado');
    Engine.newGame(c || 'boca');
    Engine.continueFromPresentation(0);
    Engine._fuerzas = {};
  };
  window.__foto = (p) => p ? {
    nombre: p.name,
    contrato: p.contractYears,
    salary: p.salary,
    clause: p.clause,
    transferState: p.transferState,
    value: p.value,
    altPosDetail: p.altPosDetail ? p.altPosDetail.length : undefined,
  } : null;
  window.__rival = (clubId, id) => Mercado.plantel(Engine, clubId).find((p) => p.id === id) || null;
  window.__T = (t) => { Engine.state.season.year = t; Engine._fuerzas = {}; };
});

L('\n================ INVESTIGACIÓN B2-03: LA CLÁUSULA ================');

// ---------------------------------------------------------------
L('\n--- PRUEBA 1 y 3. Un jugador rival con contrato LARGO y cláusula ---');
L('    (la clave: si el contrato dura 5 años, en la T2 le quedan 4 y la');
L('     cláusula no debería haber vencido)');
console.table(await page.evaluate(() => {
  window.__carrera('boca');
  // Se busca a propósito uno con contrato largo, para separar "se venció el
  // contrato" de "pasó una temporada".
  const j = Mercado.plantel(Engine, 'estudianteslp')
    .find((p) => p.clause && p.salary && p.transferState && p.contractYears >= 4);
  if (!j) return [{ error: 'no se encontró uno con contrato largo y cláusula' }];
  const filas = [];
  for (let t = 1; t <= 5; t++) {
    window.__T(t);
    filas.push({ temporada: t, ...window.__foto(window.__rival('estudianteslp', j.id)) });
  }
  return filas;
}));

// ---------------------------------------------------------------
L('\n--- PRUEBA 2. Avanzar UN DÍA (sin cambiar de temporada) ---');
L(await page.evaluate(() => {
  window.__carrera('boca');
  const j = Mercado.plantel(Engine, 'estudianteslp').find((p) => p.clause);
  const antes = JSON.stringify(window.__foto(j));
  for (let i = 0; i < 40; i++) {
    if (Engine.state.screen === 'calendar') Engine.avanzarUnDia();
    else break;
  }
  Engine._fuerzas = {};
  const despues = JSON.stringify(window.__foto(window.__rival('estudianteslp', j.id)));
  return `  dayCount=${Engine.state.calendar.dayCount}, temporada=${Engine.state.season.year}`
    + `\n  ¿cambió algo?: ${antes === despues ? 'NO, idéntico' : 'SÍ'}`
    + `\n  ${despues}`;
}));

// ---------------------------------------------------------------
L('\n--- COMPARACIÓN. El MISMO campo en las dos representaciones ---');
L('    tu plantel se guarda de verdad; el rival se reconstruye');
console.table(await page.evaluate(() => {
  const filas = [];
  // Tu club: el plantel se guarda en state.squad.
  window.__carrera('estudianteslp');
  const tuyo = Engine.state.squad.find((p) => p.clause && p.contractYears >= 4);
  for (const t of [1, 2, 5, 10]) {
    window.__T(t);
    const p = Engine.state.squad.find((x) => x.id === tuyo.id);
    filas.push({ representación: 'TU plantel (state.squad)', temporada: t, ...window.__foto(p) });
  }
  // El mismo club, pero como rival: se reconstruye en Mercado.plantel.
  window.__carrera('boca');
  const rival = Mercado.plantel(Engine, 'estudianteslp')
    .find((p) => p.clause && p.contractYears >= 4);
  for (const t of [1, 2, 5, 10]) {
    window.__T(t);
    filas.push({ representación: 'RIVAL (Mercado.plantel)', temporada: t, ...window.__foto(window.__rival('estudianteslp', rival.id)) });
  }
  return filas;
}));

// ---------------------------------------------------------------
L('\n--- PRUEBA 4 y 5. Renovación y vencimiento (solo existe para TU plantel) ---');
L(await page.evaluate(() => {
  window.__carrera('estudianteslp');
  const s = Engine.state;
  const j = s.squad.find((p) => p.clause);
  if (!j) return '  no se encontró uno con cláusula en tu plantel';
  const lineas = [];
  lineas.push(`  ${j.name}: contrato ${j.contractYears} años, cláusula ${j.clause}, sueldo ${j.salary}`);
  // Se lo lleva a un año para que entre en la cola de renovación.
  j.contractYears = 1;
  s.contractQueue = [j.id];
  s.screen = 'contract-decision';
  const antes = JSON.stringify(window.__foto(j));
  Engine.resolveContractDecision(true);   // RENOVAR
  const despues = s.squad.find((p) => p.id === j.id);
  lineas.push(`  tras RENOVAR: contrato ${despues.contractYears} años, cláusula ${despues.clause}, sueldo ${despues.salary}`);
  lineas.push(`  ¿la renovación tocó la cláusula?: ${JSON.parse(antes).clause === despues.clause ? 'NO, quedó la vieja' : 'sí'}`);
  lineas.push(`  ¿se puede pactar una cláusula nueva al renovar?: ${
    Engine.resolveContractDecision.length > 1 ? 'la función toma parámetros extra' : 'NO: resolveContractDecision(renew) es sí o no'}`);
  // Vencimiento: no renovar.
  const otro = s.squad.find((p) => p.clause && p.id !== j.id);
  if (otro) {
    s.contractQueue = [otro.id];
    s.screen = 'contract-decision';
    Engine.resolveContractDecision(false);  // DEJARLO IR
    const sigue = s.squad.find((p) => p.id === otro.id);
    const libre = (s.libres || []).find((p) => p.id === otro.id);
    lineas.push(`  al NO renovar a ${otro.name}: ¿sigue en el plantel? ${!!sigue}`
      + ` · ¿quedó en libres con cláusula? ${libre ? String(libre.clause) : 'no está en libres'}`);
  }
  return lineas.join('\n');
}));

// ---------------------------------------------------------------
L('\n--- PRUEBA 6. Transferencia normal entre rivales ---');
console.table(await page.evaluate(() => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = Mercado.plantel(Engine, 'estudianteslp').find((p) => p.clause && p.salary && p.transferState);
  const filas = [{ momento: '1. en su club', ...window.__foto(j) }];
  Mercado.transferir(s, j, 'estudianteslp', 'river', 1);
  const guardado = Mercado.movimientosDe(s, 'river').dentro.find((x) => x.id === j.id);
  filas.push({ momento: '2. lo guardado en `dentro`', nombre: guardado.name, contrato: guardado.contractYears,
    salary: guardado.salary, clause: guardado.clause, transferState: guardado.transferState,
    value: guardado.value, altPosDetail: guardado.altPosDetail ? guardado.altPosDetail.length : undefined });
  Engine._fuerzas = {};
  filas.push({ momento: '3. reconstruido en el club nuevo', ...window.__foto(window.__rival('river', j.id)) });
  return filas;
}));

// ---------------------------------------------------------------
L('\n--- PRUEBA 7. ¿Existe un flujo de PAGO DE CLÁUSULA? ---');
L(await page.evaluate(() => {
  window.__carrera('boca');
  const s = Engine.state;
  const lineas = [];
  // (a) VOS le pagás la cláusula a un rival.
  const fila = Mercado.indice(Engine).find((x) => x.clausula > 0);
  if (!fila) { lineas.push('  (a) no apareció ninguna fila con cláusula en el índice'); }
  else {
    s.budget = fila.clausula * 3;
    const antes = { clausula: fila.clausula, estado: fila.estado, clubId: fila.clubId };
    // La compra pasa por Mercado.negociar(engine, clubId, jugadorId, porLaClausula).
    if (typeof Engine.mercadoAbierto === 'function' && !Engine.mercadoAbierto()) {
      Engine.state.calendar.dayCount = 0;
    }
    const r = Mercado.negociar(Engine, fila.clubId, fila.id, true);
    const enTuPlantel = s.squad.find((p) => p.id === fila.id);
    lineas.push(`  (a) VOS pagás la cláusula: existe · ${fila.name} de ${antes.clubId} por ${antes.clausula}`);
    lineas.push(`      resultado: ${r && r.ok ? 'concretado' : 'no se concretó'} — ${r ? r.mensaje : ''}`);
    if (enTuPlantel) {
      lineas.push(`      en tu plantel queda: contrato ${enTuPlantel.contractYears} años,`
        + ` cláusula ${enTuPlantel.clause}, sueldo ${enTuPlantel.salary},`
        + ` transferState ${enTuPlantel.transferState}, altPosDetail ${enTuPlantel.altPosDetail ? enTuPlantel.altPosDetail.length : undefined}`);
    }
  }
  // (b) UN RIVAL te paga la cláusula a vos.
  window.__carrera('estudianteslp');
  const s2 = Engine.state;
  const mio = s2.squad.find((p) => p.clause && p.pos !== 'POR');
  if (!mio) { lineas.push('  (b) no tenés a nadie con cláusula'); return lineas.join('\n'); }
  const fotoAntes = window.__foto(mio);
  s2.ofertasRecibidas = [{
    playerId: mio.id, nombre: mio.name, monto: mio.clause, obligatoria: true,
    club: { id: 'river', nombre: 'River', extranjero: false },
  }];
  s2.screen = 'transfer-offer';
  Engine.resolverOferta(true);
  Engine._fuerzas = {};
  const enRiver = window.__rival('river', mio.id);
  lineas.push(`  (b) UN RIVAL te paga la cláusula: existe (oferta.obligatoria) · ${mio.name}, cláusula ${fotoAntes.clause}`);
  lineas.push(`      ¿sigue en tu plantel?: ${!!s2.squad.find((p) => p.id === mio.id)}`);
  lineas.push(`      en River queda: ${enRiver ? JSON.stringify(window.__foto(enRiver)) : 'NO LLEGÓ'}`);
  return lineas.join('\n');
}));

// ---------------------------------------------------------------
L('\n--- PRUEBA 8. Transferencia y después renovación ---');
L(await page.evaluate(() => {
  window.__carrera('estudianteslp');
  const s = Engine.state;
  const mio = s.squad.find((p) => p.clause && p.pos !== 'POR');
  const lineas = [`  ${mio.name} en TU plantel: cláusula ${mio.clause}, contrato ${mio.contractYears}`];
  // Se lo vende a un rival y se lo recompra, para pasar por los dos caminos.
  s.ofertasRecibidas = [{ playerId: mio.id, nombre: mio.name, monto: 1, obligatoria: false,
    club: { id: 'river', nombre: 'River', extranjero: false } }];
  s.screen = 'transfer-offer';
  Engine.resolverOferta(true);
  Engine._fuerzas = {};
  const enRiver = window.__rival('river', mio.id);
  lineas.push(`  tras venderlo a River: ${JSON.stringify(window.__foto(enRiver))}`);
  const fila = Mercado.indice(Engine).find((x) => x.id === mio.id);
  lineas.push(`  en el mercado figura como: estado "${fila ? fila.estado : 'SIN FILA'}",`
    + ` cláusula ${fila ? fila.clausula : '-'}`);
  return lineas.join('\n');
}));

// ---------------------------------------------------------------
L('\n--- LA ASIMETRÍA. `value` y `clause` se borran en la MISMA línea:');
L('    ¿los dos tienen reemplazo?');
console.table(await page.evaluate(() => {
  window.__carrera('boca');
  const j = Mercado.plantel(Engine, 'estudianteslp')
    .find((p) => p.clause && p.value && p.contractYears >= 4);
  const filas = [];
  for (const t of [1, 2]) {
    window.__T(t);
    const p = window.__rival('estudianteslp', j.id);
    const fila = Mercado.indice(Engine).find((x) => x.id === j.id);
    filas.push({
      temporada: t,
      'p.value guardado': p.value,
      'lo que vale (valueOf)': Engine.valueOf(p),
      'p.clause guardado': p.clause,
      'cláusula en el mercado': fila ? fila.clausula : '(sin fila)',
      'se puede pagar cláusula': fila ? !!fila.clausula : '-',
    });
  }
  return filas;
}));

L('\n--- ¿El jugador que FICHÁS vos conserva sus datos? ---');
L(await page.evaluate(() => {
  window.__carrera('boca');
  const s = Engine.state;
  if (!Engine.mercadoAbierto()) s.calendar.dayCount = 0;
  const fila = Mercado.indice(Engine).find((x) => x.clausula > 0 && x.altPosDetail && x.altPosDetail.length);
  if (!fila) return '  no apareció una fila con cláusula y posiciones alternativas';
  const enSuClub = Mercado.plantel(Engine, fila.clubId).find((p) => p.id === fila.id);
  s.budget = fila.clausula * 3;
  Mercado.negociar(Engine, fila.clubId, fila.id, true);
  const mio = s.squad.find((p) => p.id === fila.id);
  return `  ${fila.name}, en su club: salary ${enSuClub.salary}, clause ${enSuClub.clause},`
    + ` altPosDetail ${JSON.stringify(enSuClub.altPosDetail)}`
    + `\n  ya fichado por vos: salary ${mio ? mio.salary : '-'}, clause ${mio ? mio.clause : '-'},`
    + ` altPosDetail ${mio ? JSON.stringify(mio.altPosDetail) : '-'}, contrato ${mio ? mio.contractYears : '-'}`;
}));

// ---------------------------------------------------------------
L('\n--- PUNTO 8. El contrato de un RIVAL a lo largo de 12 temporadas ---');
L('    (¿llega a 0 y vence, o vuelve a empezar?)');
console.table(await page.evaluate(() => {
  window.__carrera('boca');
  const j = Mercado.plantel(Engine, 'estudianteslp')
    .find((p) => p.clause && p.salary && p.contractYears >= 4);
  const filas = [];
  for (let t = 1; t <= 12; t++) {
    window.__T(t);
    const p = window.__rival('estudianteslp', j.id);
    filas.push({
      temporada: t,
      'contrato que muestra': p.contractYears,
      salary: p.salary,
      clause: p.clause,
      'sigue en el club': true,
      edad: p.age,
    });
  }
  return filas;
}));

L('\n--- CASO 8. Vencimiento en TU plantel: contractYears llega a 0 ---');
L(await page.evaluate(() => {
  window.__carrera('estudianteslp');
  const s = Engine.state;
  const j = s.squad.find((p) => p.clause && p.pos !== 'POR');
  const lineas = [`  ${j.name}: contrato ${j.contractYears}, cláusula ${j.clause}`];
  // El decremento real que corre al cerrar la temporada (engine.js:7826).
  j.contractYears = 1;
  s.squad.forEach((p) => { p.contractYears = Math.max(0, p.contractYears - 1); });
  lineas.push(`  tras el decremento de cierre: contrato ${j.contractYears}, cláusula ${j.clause}`);
  // Y quién entra en la cola de renovación (engine.js:7009).
  const cola = s.squad.filter((p) => p.contractYears <= 1).map((p) => p.id);
  lineas.push(`  ¿entra en la cola de renovación?: ${cola.includes(j.id)}`
    + ` (la cola se arma con contractYears <= 1, y él está en ${j.contractYears})`);
  lineas.push(`  o sea: con el contrato en 0 sigue en el plantel hasta que vos decidas en la cola`);
  return lineas.join('\n');
}));

L('\n--- CASOS 5, 6 y 7. ¿Se puede ASIGNAR una cláusula en algún lado? ---');
L(await page.evaluate(() => {
  const lineas = [];
  lineas.push(`  resolveContractDecision(renew) toma ${Engine.resolveContractDecision.length} parámetro(s):`
    + ' es sí o no, no acepta cláusula ni sueldo');
  lineas.push(`  Mercado.negociar(engine, clubId, jugadorId, porLaClausula) toma ${Mercado.negociar.length}:`
    + ' el último es un booleano de "pagar la cláusula", no una cláusula nueva');
  lineas.push(`  Mercado.transferir(s, jugador, de, a, anio) toma ${Mercado.transferir.length}:`
    + ' no recibe condiciones de contrato');
  lineas.push(`  Mercado.jugadorFichado(engine, j, anio) toma ${Mercado.jugadorFichado.length}:`
    + ' reconstruye desde lo guardado, no negocia nada');
  lineas.push('  => CASO 5 (nueva cláusula al transferir): NO es posible, no hay dónde ponerla');
  lineas.push('  => CASO 6 (quedar sin cláusula): es lo ÚNICO que pasa hoy, siempre');
  lineas.push('  => CASO 7 (renovar sin cláusula a propósito): NO es posible,'
    + ' la renovación ni la mira');
  return lineas.join('\n');
}));

L('\n--- ERRORES DE PÁGINA ---');
L(erroresDePagina.length ? '  ' + erroresDePagina.join('\n  ') : '  ninguno');
L('\n==================================================================');
await navegador.close();
