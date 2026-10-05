// PRUEBAS DE B2-03 — el sistema contractual.
//
//     npm install --no-save playwright
//     node tools/pruebas-b2-03.mjs [temporadasDelSoak]
//
// El modelo que se verifica:
//
//   JUGADOR          id, nombre, puesto, altPosDetail, nacimiento, rating,
//                    proyección...        -> viajan con él siempre
//   CONTRATO         contractYears, salary, clause
//                    -> se termina y se firma otro al cambiar de club
//   ESTADO DEL CLUB  transferState
//                    -> no viaja: es del club, no del jugador
//
// Esta suite reemplaza a la anterior, que afirmaba el modelo viejo (sueldo
// copiado tal cual y cláusula que moría al pasar un año).

import path from 'node:path';
import { chromium } from 'playwright';

const TEMPORADAS = Number(process.argv[2] || 15);
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
  window.__T = (t) => { Engine.state.season.year = t; Engine._fuerzas = {}; };
  window.__conTodo = (clubId) => Mercado.plantel(Engine, clubId).find((p) =>
    Array.isArray(p.altPosDetail) && p.altPosDetail.length && p.salary && p.clause && p.transferState);
  window.__contratoValido = (p) => p
    && Number.isFinite(p.contractYears) && p.contractYears >= 0 && p.contractYears <= Mercado.CONTRATO_MAXIMO
    && Number.isFinite(p.salary) && p.salary > 0
    && (p.clause === undefined || (Number.isFinite(p.clause) && p.clause > 0));
});

let pasaron = 0;
const total = [];
async function probar(nombre, fn, arg) {
  total.push(nombre);
  let r;
  try { r = await page.evaluate(fn, arg); } catch (e) { r = { ok: false, detalle: 'EXCEPCIÓN: ' + e.message }; }
  console.log(`  ${r.ok ? '✓' : '✗'} ${total.length}. ${nombre}`);
  console.log(`      ${r.detalle}`);
  if (r.ok) pasaron++;
}

console.log('\n========== PRUEBAS B2-03 — SISTEMA CONTRACTUAL ==========');

console.log('\n--- A. LA CLÁUSULA ---');

await probar('Un rival con cláusula en T1 la conserva en T2', () => {
  window.__carrera('boca');
  const j = Mercado.plantel(Engine, 'estudianteslp').find((p) => p.clause && p.contractYears >= 4);
  window.__T(1); const t1 = window.__en('estudianteslp', j.id);
  window.__T(2); const t2 = window.__en('estudianteslp', j.id);
  return {
    ok: !!t2 && t2.clause === t1.clause,
    detalle: `${j.name}: T1 contrato ${t1.contractYears} cláusula ${t1.clause}`
      + ` · T2 contrato ${t2.contractYears} cláusula ${t2.clause}`,
  };
});

await probar('La cláusula dura lo que dura el contrato', () => {
  window.__carrera('boca');
  const j = Mercado.plantel(Engine, 'estudianteslp').find((p) => p.clause && p.contractYears >= 4);
  const traza = [];
  let fallo = null;
  for (let t = 1; t <= 5; t++) {
    window.__T(t);
    const p = window.__en('estudianteslp', j.id);
    traza.push(`T${t}: ${p.contractYears}a/${p.clause === undefined ? 'sin cláusula' : p.clause}`);
    if (p.contractYears >= 1 && p.clause !== j.clause) fallo = `en T${t} perdió la cláusula con el contrato vigente`;
  }
  return { ok: !fallo, detalle: fallo || traza.join(' · ') };
});

await probar('Un contrato nuevo no hereda la cláusula vieja', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = window.__conTodo('estudianteslp');
  const vieja = j.clause;
  Mercado.transferir(s, j, 'estudianteslp', 'river', 1, Engine);
  Engine._fuerzas = {};
  const d = window.__en('river', j.id);
  return {
    ok: d.clause !== vieja,
    detalle: `${j.name}: cláusula vieja ${vieja} · cláusula del contrato nuevo ${d.clause === undefined ? 'ninguna' : d.clause}`
      + ' (lo que no puede es ser la misma de antes)',
  };
});

console.log('\n--- B. TRANSFERENCIA ---');

await probar('El transferido conserva altPosDetail', () => {
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  const antes = JSON.stringify(j.altPosDetail);
  Mercado.transferir(Engine.state, j, 'estudianteslp', 'river', 1, Engine);
  Engine._fuerzas = {};
  const d = window.__en('river', j.id);
  return { ok: JSON.stringify(d.altPosDetail) === antes, detalle: `${j.name}: ${antes} -> ${JSON.stringify(d.altPosDetail)}` };
});

await probar('transferState del club anterior no viaja', () => {
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  const viejo = j.transferState;
  Mercado.transferir(Engine.state, j, 'estudianteslp', 'river', 1, Engine);
  Engine._fuerzas = {};
  const d = window.__en('river', j.id);
  const fila = Mercado.indice(Engine).find((x) => x.id === j.id);
  return {
    ok: d.transferState === undefined && !!fila && !!fila.estado,
    detalle: `era "${viejo}" en su club · en river transferState=${d.transferState}`
      + ` y el club nuevo arma la suya: "${fila ? fila.estado : 'SIN FILA'}"`,
  };
});

await probar('El contrato anterior no se copia como contrato nuevo', () => {
  window.__carrera('boca');
  const j = window.__conTodo('estudianteslp');
  const antes = { anios: j.contractYears, salary: j.salary, clause: j.clause };
  Mercado.transferir(Engine.state, j, 'estudianteslp', 'river', 1, Engine);
  Engine._fuerzas = {};
  const d = window.__en('river', j.id);
  const esElMismo = d.contractYears === antes.anios && d.salary === antes.salary && d.clause === antes.clause;
  return {
    ok: !esElMismo,
    detalle: `${j.name}: viejo ${antes.anios}a/${antes.salary}/${antes.clause}`
      + ` -> nuevo ${d.contractYears}a/${d.salary}/${d.clause === undefined ? 'sin cláusula' : d.clause}`,
  };
});

await probar('El contrato nuevo tiene estructura válida', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const malos = [];
  Mercado.plantel(Engine, 'estudianteslp').slice(0, 10).forEach((j) => {
    Mercado.transferir(s, j, 'estudianteslp', 'river', 1, Engine);
  });
  Engine._fuerzas = {};
  Mercado.plantel(Engine, 'river').forEach((p) => {
    if (Mercado.contratoDe(s, p.id) && !window.__contratoValido(p)) {
      malos.push(`${p.id}: ${p.contractYears}a/${p.salary}/${p.clause}`);
    }
  });
  const nuevos = Mercado.plantel(Engine, 'river').filter((p) => Mercado.contratoDe(s, p.id));
  return {
    ok: !malos.length && nuevos.length >= 10,
    detalle: malos.length ? malos.slice(0, 3).join(' · ')
      : `${nuevos.length} contratos nuevos, todos con duración 1-${Mercado.CONTRATO_MAXIMO}, sueldo > 0 y cláusula válida o ausente`,
  };
});

await probar('El sueldo del contrato nuevo se negocia, no se copia', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const casos = [];
  Mercado.plantel(Engine, 'estudianteslp').slice(0, 12).forEach((j) => {
    const antes = j.salary;
    Mercado.transferir(s, j, 'estudianteslp', 'river', 1, Engine);
    Engine._fuerzas = {};
    const d = window.__en('river', j.id);
    casos.push({ copiado: antes != null && d.salary === antes, bajo: d.salary <= 0 });
  });
  const copiados = casos.filter((c) => c.copiado).length;
  return {
    ok: !copiados && !casos.filter((c) => c.bajo).length,
    detalle: `${casos.length} pases: ${copiados} con el sueldo copiado tal cual (tiene que ser 0),`
      + ' todos con sueldo > 0',
  };
});

console.log('\n--- C. RENOVACIÓN DEL USUARIO ---');

await probar('Podés elegir la duración de 1 a 5 años', () => {
  const resultados = [];
  for (const anios of [1, 2, 3, 4, 5]) {
    window.__carrera('estudianteslp');
    const s = Engine.state;
    const j = s.squad.find((p) => p.clause);
    j.contractYears = 1;
    s.contractQueue = [j.id];
    s.screen = 'contract-decision';
    Engine.resolveContractDecision(true, anios);
    const d = s.squad.find((p) => p.id === j.id);
    resultados.push(`pedí ${anios} -> ${d ? d.contractYears : 'se fue'}`);
  }
  const ok = resultados.every((x, i) => x === `pedí ${i + 1} -> ${i + 1}`);
  return { ok, detalle: resultados.join(' · ') };
});

await probar('La renovación deja un contrato coherente, no un agujero', () => {
  window.__carrera('estudianteslp');
  const s = Engine.state;
  const j = s.squad.find((p) => p.clause);
  const antes = { salary: j.salary, clause: j.clause };
  j.contractYears = 1;
  s.contractQueue = [j.id];
  s.screen = 'contract-decision';
  Engine.resolveContractDecision(true, 4);
  const d = s.squad.find((p) => p.id === j.id);
  return {
    ok: window.__contratoValido(d) && d.contractYears === 4,
    detalle: `${j.name}: antes ${antes.salary}/${antes.clause} -> renovado 4 años,`
      + ` sueldo ${d.salary}, cláusula ${d.clause === undefined ? 'ninguna' : d.clause}`,
  };
});

await probar('Al renovar, la cláusula es la del contrato nuevo (puede estar o no)', () => {
  window.__carrera('estudianteslp');
  const s = Engine.state;
  let con = 0; let sin = 0; let igualALaVieja = 0;
  s.squad.slice(0, 20).forEach((j) => {
    const vieja = j.clause;
    j.contractYears = 1;
    s.contractQueue = [j.id];
    s.screen = 'contract-decision';
    Engine.resolveContractDecision(true, 3);
    const d = s.squad.find((p) => p.id === j.id);
    if (!d) return;
    if (d.clause === undefined) sin++; else con++;
    if (vieja != null && d.clause === vieja) igualALaVieja++;
  });
  return {
    ok: (con + sin) > 0 && !igualALaVieja,
    detalle: `20 renovaciones: ${con} con cláusula nueva, ${sin} sin cláusula,`
      + ` ${igualALaVieja} que arrastraron la vieja (tiene que ser 0)`,
  };
});

console.log('\n--- D. CONTRATOS DE LOS RIVALES ---');

await probar('No hay rollover silencioso 1 -> 5', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = Mercado.plantel(Engine, 'estudianteslp').find((p) => p.contractYears >= 4 && p.clause);
  const traza = [];
  const subidasSinContrato = [];
  let anterior = null;
  for (let t = 1; t <= 10; t++) {
    window.__T(t);
    const p = window.__en('estudianteslp', j.id);
    if (!p) { traza.push(`T${t}: ya no está`); break; }
    if (anterior != null && p.contractYears > anterior && !Mercado.contratoDe(s, j.id)) {
      subidasSinContrato.push(`T${t}: ${anterior} -> ${p.contractYears} sin contrato nuevo`);
    }
    traza.push(`T${t}:${p.contractYears}`);
    anterior = p.contractYears;
  }
  return { ok: !subidasSinContrato.length, detalle: subidasSinContrato.join(' · ') || traza.join(' ') };
});

await probar('El contrato de un rival llega de verdad a cero', () => {
  window.__carrera('boca');
  const conCero = [];
  for (let t = 1; t <= 6 && !conCero.length; t++) {
    window.__T(t);
    Engine.state.clubs.slice(0, 20).forEach((c) => {
      if (c.id === Engine.state.clubId) return;
      Mercado.plantel(Engine, c.id).forEach((p) => {
        if (p.contractYears === 0 && !Mercado.contratoDe(Engine.state, p.id)) conCero.push(`${p.id} en T${t}`);
      });
    });
  }
  return {
    ok: conCero.length > 0,
    detalle: conCero.length ? `${conCero.length} contratos vencidos, por ejemplo ${conCero[0]}`
      : 'ningún contrato llegó a 0 en 6 temporadas',
  };
});

await probar('Un club rival puede renovar, y otro puede dejar ir', () => {
  window.__carrera('boca');
  const s = Engine.state;
  let renovados = 0; const liberados = [];
  for (let t = 1; t <= 6; t++) {
    s.season.year = t; Engine._fuerzas = {};
    const r = Mercado.cerrarContratos(Engine);
    renovados += r.renovados;
    liberados.push(...r.liberados);
  }
  return {
    ok: renovados > 0 && liberados.length > 0,
    detalle: `6 temporadas: ${renovados} renovaciones y ${liberados.length} jugadores libres`
      + (liberados.length ? ` (${liberados.slice(0, 2).join(', ')})` : ''),
  };
});

await probar('El que queda libre no reaparece en su club', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const soltados = [];
  for (let t = 1; t <= 6; t++) {
    s.season.year = t; Engine._fuerzas = {};
    Mercado.cerrarContratos(Engine);
  }
  (s.libres || []).forEach((l) => {
    if (!l.desdeClub) return;
    if (Mercado.plantel(Engine, l.desdeClub).some((p) => p.id === l.id)) soltados.push(`${l.id} volvió a ${l.desdeClub}`);
    s.clubs.forEach((c) => {
      if (c.id === s.clubId || c.id === l.desdeClub) return;
      if (Mercado.plantel(Engine, c.id).some((p) => p.id === l.id)) soltados.push(`${l.id} apareció en ${c.id}`);
    });
  });
  return {
    ok: !soltados.length,
    detalle: soltados.length ? soltados.slice(0, 3).join(' · ')
      : `${(s.libres || []).length} libres, ninguno sigue en un plantel`,
  };
});

console.log('\n--- E. FICHAJE DEL USUARIO ---');

await probar('El que fichás entra con un contrato completo', () => {
  window.__carrera('boca');
  const s = Engine.state;
  if (!Engine.mercadoAbierto()) s.calendar.dayCount = 0;
  const fila = Mercado.indice(Engine).find((x) => x.clausula > 0 && x.altPosDetail && x.altPosDetail.length);
  if (!fila) return { ok: false, detalle: 'no apareció una fila con cláusula y posiciones alternativas' };
  const enSuClub = Mercado.plantel(Engine, fila.clubId).find((p) => p.id === fila.id);
  s.budget = fila.clausula * 3;
  Mercado.negociar(Engine, fila.clubId, fila.id, true);
  const mio = s.squad.find((p) => p.id === fila.id);
  return {
    ok: !!mio && window.__contratoValido(mio) && JSON.stringify(mio.altPosDetail) === JSON.stringify(enSuClub.altPosDetail),
    detalle: `${fila.name}: en su club ${enSuClub.contractYears}a/${enSuClub.salary}`
      + ` -> fichado ${mio ? `${mio.contractYears}a/${mio.salary}/${mio.clause === undefined ? 'sin cláusula' : mio.clause}` : 'NO LLEGÓ'}`
      + ` · altPosDetail ${mio ? JSON.stringify(mio.altPosDetail) : '-'}`,
  };
});

await probar('Ningún fichado queda con el sueldo sin definir', () => {
  window.__carrera('boca');
  const s = Engine.state;
  if (!Engine.mercadoAbierto()) s.calendar.dayCount = 0;
  s.budget = 999999999999;
  const sinSueldo = [];
  Mercado.indice(Engine).slice(0, 10).forEach((fila) => {
    Mercado.negociar(Engine, fila.clubId, fila.id, !!fila.clausula);
    const mio = s.squad.find((p) => p.id === fila.id);
    if (mio && !(mio.salary > 0)) sinSueldo.push(`${mio.name}: ${mio.salary}`);
  });
  const fichados = s.squad.filter((p) => Mercado.init(s).fichados.includes(p.id));
  return {
    ok: !sinSueldo.length,
    detalle: sinSueldo.length ? sinSueldo.slice(0, 3).join(' · ')
      : `${fichados.length} fichajes, todos con sueldo definido`,
  };
});

console.log('\n--- F. INTEGRIDAD (no romper B2-01, B2-02 ni B2-04) ---');

await probar(`SOAK de ${TEMPORADAS} temporadas`, (n) => {
  window.__carrera('aldosivi');
  const s = Engine.state;
  const problemas = { dobles: [], retiradosActivos: [], sinArquero: [], contratoInvalido: [] };
  const filas = [];
  for (let t = 1; t <= n; t++) {
    s.season.year = t; Engine._fuerzas = {};
    if (typeof Mercado.mercadoDeLosRivales === 'function') Mercado.mercadoDeLosRivales(Engine);
    Engine._fuerzas = {};
    Mercado.cerrarContratos(Engine);
    Engine._fuerzas = {};
    Engine.procesarRetiros();
    Engine._fuerzas = {};

    const dueno = new Map();
    const retiradosDeAntes = new Set((s.retirados || []).filter((r) => r.temporada < t).map((r) => r.id));
    let conClausula = 0; let jugadores = 0;
    s.clubs.forEach((c) => {
      const pl = c.id === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, c.id);
      if (pl.length && !Engine.cuantosArqueros(pl)) problemas.sinArquero.push(`T${t}: ${c.id}`);
      pl.forEach((p) => {
        jugadores++;
        if (p.clause) conClausula++;
        if (dueno.has(p.id)) problemas.dobles.push(`T${t}: ${p.id} en ${dueno.get(p.id)} y ${c.id}`);
        dueno.set(p.id, c.id);
        if (retiradosDeAntes.has(p.id)) problemas.retiradosActivos.push(`T${t}: ${p.id}`);
        if (Mercado.contratoDe(s, p.id) && !window.__contratoValido(p)) {
          problemas.contratoInvalido.push(`T${t}: ${p.id} ${p.contractYears}a/${p.salary}`);
        }
      });
    });
    filas.push({ t, jugadores, conClausula, libres: (s.libres || []).length, contratos: Object.keys(s.contratos || {}).length });
  }
  const totalProblemas = Object.values(problemas).reduce((a, x) => a + x.length, 0);
  return {
    ok: !totalProblemas,
    detalle: Object.entries(problemas).map(([k, v]) => `${k}: ${v.length}`).join(' · ')
      + ` · T1: ${filas[0].jugadores} jugadores, ${filas[0].conClausula} con cláusula`
      + ` · T${n}: ${filas[n - 1].jugadores} jugadores, ${filas[n - 1].conClausula} con cláusula,`
      + ` ${filas[n - 1].contratos} contratos firmados, ${filas[n - 1].libres} libres`
      + (totalProblemas ? ` · ${Object.values(problemas).flat().slice(0, 2).join(' · ')}` : ''),
  };
}, TEMPORADAS);

await probar('Guardar y cargar conserva los contratos', () => {
  const s = Engine.state;
  const antes = JSON.stringify(s.contratos || {});
  const planAntes = JSON.stringify(s.clubs.map((c) => {
    const pl = c.id === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, c.id);
    return pl.map((p) => `${p.id}:${p.contractYears}:${p.salary}:${p.clause}`).join(',');
  }));
  Engine.save();
  const cargo = Engine.load();
  Engine._fuerzas = {};
  const despues = JSON.stringify(Engine.state.contratos || {});
  const planDespues = JSON.stringify(Engine.state.clubs.map((c) => {
    const pl = c.id === Engine.state.clubId ? (Engine.state.squad || []) : Mercado.plantel(Engine, c.id);
    return pl.map((p) => `${p.id}:${p.contractYears}:${p.salary}:${p.clause}`).join(',');
  }));
  return {
    ok: cargo && antes === despues && planAntes === planDespues,
    detalle: `load()=${cargo} · ${Object.keys(JSON.parse(antes)).length} contratos`
      + ` · contratos ${antes === despues ? 'idénticos' : 'DISTINTOS'}`
      + ` · planteles ${planAntes === planDespues ? 'idénticos' : 'DISTINTOS'}`,
  };
});

console.log(`\n${pasaron}/${total.length} pruebas pasaron`);
if (erroresDePagina.length) console.log(`\nerrores de página: ${erroresDePagina.join(' | ')}`);
await navegador.close();
process.exit(pasaron === total.length ? 0 : 1);
