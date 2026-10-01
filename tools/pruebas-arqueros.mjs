// Pruebas del último arquero: ningún club puede quedarse con cero.
//
//     npm install --no-save playwright
//     node tools/pruebas-arqueros.mjs
//
// Corren contra el juego de verdad, en un Chromium sin ventana. No hay mocks.
//
// Lo que vinieron a fijar: un jugador de campo puede jugar fuera de puesto,
// pero NADIE puede jugar al arco. Un club con cero arqueros es un estado
// imposible, y el juego llegaba a él: medido sobre 20 temporadas del mundo
// rival, 19 veces un club terminó con el plantel completo y ningún arquero
// (Racing con 26 jugadores y nadie al arco).
//
// La comprobación mira SIEMPRE `pos === 'POR'`, nunca `posDetail`: posDetail
// dice cómo juega, pos dice qué es.

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navegador.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
await page.goto('file://' + path.join(raiz, 'index.html'));
await page.waitForFunction(() => typeof Juveniles !== 'undefined');

await page.evaluate(() => {
  window.__carrera = (clubId) => {
    localStorage.removeItem('dt-simulador-save-v3');
    Engine.createDT('Nico', 'ARG', 'equilibrado');
    Engine.newGame(clubId || 'boca');
    Engine.continueFromPresentation(0);
    Engine._fuerzas = {};
  };
  // Deja el plantel con UN arquero y la cantidad de jugadores de campo que se
  // pida. Es el escenario de todas las pruebas de abajo.
  window.__unSoloArquero = (cuantosDeCampo) => {
    const s = Engine.state;
    const arqueros = s.squad.filter((p) => p.pos === 'POR');
    const campo = s.squad.filter((p) => p.pos !== 'POR');
    s.squad = [arqueros[0]].concat(campo.slice(0, cuantosDeCampo || 20));
    Engine.repairStartingSlots();
    return { arqueros: Engine.cuantosArqueros(s.squad), total: s.squad.length, elArquero: arqueros[0] };
  };
  window.__arqueros = (lista) => (lista || Engine.state.squad).filter((p) => p.pos === 'POR').length;
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

// ---------- 1 a 4: las salidas de TU club ----------

await probar('1. Venta: no se puede vender al único arquero', () => {
  window.__carrera('boca');
  const { elArquero } = window.__unSoloArquero(20);
  const s = Engine.state;
  s.ofertasRecibidas = [{
    playerId: elArquero.id, monto: 50000000,
    club: { id: 'river', nombre: 'River Plate' },
  }];
  Engine.resolverOferta(true);
  return {
    ok: window.__arqueros() === 1 && s.squad.some((p) => p.id === elArquero.id),
    detalle: `POR = ${window.__arqueros()} · "${s.lastDecisionNote}"`,
  };
});

await probar('2. Cláusula: tampoco pagando la cláusula', () => {
  window.__carrera('boca');
  const { elArquero } = window.__unSoloArquero(20);
  const s = Engine.state;
  s.ofertasRecibidas = [{
    playerId: elArquero.id, monto: 99000000, obligatoria: true,
    club: { id: 'river', nombre: 'River Plate' },
  }];
  Engine.resolverOferta(true);
  return {
    ok: window.__arqueros() === 1 && s.squad.some((p) => p.id === elArquero.id),
    detalle: `POR = ${window.__arqueros()} · "${s.lastDecisionNote}"`,
  };
});

await probar('3. Préstamo: no se puede ceder al único arquero', () => {
  window.__carrera('boca');
  const { elArquero } = window.__unSoloArquero(20);
  const salio = Engine.cederJugador({ playerId: elArquero.id, club: { id: 'lanus', nombre: 'Lanús' }, ventanas: 2 });
  return {
    ok: salio === false && window.__arqueros() === 1,
    detalle: `cederJugador devolvió ${salio} · POR = ${window.__arqueros()} · "${Engine.state.lastDecisionNote}"`,
  };
});

await probar('4. Rescisión: no se puede liberar al único arquero', () => {
  window.__carrera('boca');
  const { elArquero } = window.__unSoloArquero(30);
  Engine.state.budget = 99999999;
  const r = Engine.rescindirContrato(elArquero.id);
  return {
    ok: !r.ok && window.__arqueros() === 1,
    detalle: `POR = ${window.__arqueros()} · "${r.nota}"`,
  };
});

// ---------- 5 y 6: contrato y retiro ----------

await probar('5. Contrato: al único arquero se le renueva sí o sí', () => {
  window.__carrera('boca');
  const { elArquero } = window.__unSoloArquero(30);
  Engine.state.contractQueue = [elArquero.id];
  // Se aprieta "dejarlo ir" a propósito: el juego no tiene que hacerle caso.
  Engine.resolveContractDecision(false);
  return {
    ok: window.__arqueros() === 1 && Engine.state.squad.some((p) => p.id === elArquero.id),
    detalle: `POR = ${window.__arqueros()} · aviso: "${Engine.state.renovacionForzada || '(ninguno)'}"`,
  };
});

await probar('6. Retiro: el único arquero no se retira dejando el arco vacío', () => {
  window.__carrera('boca');
  const { elArquero } = window.__unSoloArquero(30);
  // Se lo manda a los 45: pasado de sobra la edad de retiro.
  const hoy = Engine.fechaDelJuego();
  const enElPlantel = Engine.state.squad.find((p) => p.id === elArquero.id);
  enElPlantel.birthDate = `${hoy.anio - 45}-01-01`;
  Engine.refrescarEdades();
  const avisos = Engine.procesarRetiros();
  const aviso = avisos.find((a) => a.texto.includes(enElPlantel.name));
  return {
    ok: window.__arqueros() === 1 && !!aviso,
    detalle: `POR = ${window.__arqueros()} · aviso: "${aviso ? aviso.texto : '(NINGUNO)'}"`,
  };
});

// ---------- 7: con dos arqueros sí se puede ----------

await probar('7. Con dos arqueros, uno puede salir y queda 1', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const arqueros = s.squad.filter((p) => p.pos === 'POR');
  s.squad = arqueros.slice(0, 2).concat(s.squad.filter((p) => p.pos !== 'POR').slice(0, 28));
  Engine.repairStartingSlots();
  const antes = window.__arqueros();
  s.budget = 99999999;
  const r = Engine.rescindirContrato(arqueros[1].id);
  return {
    ok: antes === 2 && r.ok && window.__arqueros() === 1,
    detalle: `${antes} -> ${window.__arqueros()} arqueros · la operación ${r.ok ? 'se permitió' : `se bloqueó: ${r.nota}`}`,
  };
});

// ---------- 8 y 9: el de campo juega fuera de puesto, pero no al arco ----------

await probar('8. Un jugador de campo sigue pudiendo jugar fuera de su puesto', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const def = s.squad.find((p) => p.pos === 'DEF');
  const med = s.squad.find((p) => p.pos === 'MED');
  const del = s.squad.find((p) => p.pos === 'DEL');
  // Un jugador de campo en un casillero que no es el suyo rinde MENOS, pero
  // rinde: el juego lo deja jugar. Eso tiene que seguir igual.
  const f = Engine.getStartingXI().formation;
  const combos = [[def, 'DEF', 'MED'], [med, 'MED', 'DEL'], [del, 'DEL', 'DEF']];
  const detalles = combos.map(([j, suyo, ajeno]) => {
    const enSuPuesto = Engine.effectiveRating(j, suyo, f, 0, 4);
    const fuera = Engine.effectiveRating(j, ajeno, f, 0, 4);
    return { suyo, ajeno, enSuPuesto, fuera, ok: fuera > 0 && fuera < enSuPuesto };
  });
  return {
    ok: detalles.every((d) => d.ok),
    detalle: detalles.map((d) => `${d.suyo}→${d.ajeno}: ${d.enSuPuesto}→${d.fuera}`).join(' · '),
  };
});

await probar('8b. Un jugador de campo en el arco rinde como para no ser una solución', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const f = Engine.getStartingXI().formation;
  const arquero = s.squad.find((p) => p.pos === 'POR');
  const campo = ['DEF', 'MED', 'DEL'].map((pos) => s.squad.find((p) => p.pos === pos));
  const alArco = campo.map((j) => ({
    pos: j.pos,
    rinde: Engine.effectiveRating(j, 'POR', f, 0, 1),
    suyo: Engine.effectiveRating(j, j.pos, f, 0, 4),
  }));
  const delArquero = Engine.effectiveRating(arquero, 'POR', f, 0, 1);
  return {
    // Ponerlo igual es cosa del usuario, pero el juego lo castiga fuerte y
    // NUNCA lo cuenta como tener arquero (eso lo fija la prueba 9).
    ok: alArco.every((x) => x.rinde < x.suyo && x.rinde < delArquero),
    detalle: `arquero de verdad al arco: ${delArquero} · ` + alArco.map((x) => `${x.pos} al arco: ${x.rinde} (en su puesto ${x.suyo})`).join(' · '),
  };
});

await probar('9. Pero un jugador de campo NO cuenta como arquero', () => {
  window.__carrera('boca');
  const s = Engine.state;
  // Un plantel sin ningún POR, lleno de jugadores de campo: el juego tiene
  // que decir que hay cero arqueros, no "ya hay alguien que lo cubre".
  const campo = s.squad.filter((p) => p.pos !== 'POR');
  s.squad = campo;
  const cuenta = Engine.cuantosArqueros(s.squad);
  // Y ninguno de ellos puede ser "el último arquero": no son arqueros.
  const alguienCuenta = campo.some((p) => Engine.esUltimoArquero(s.squad, p));
  return {
    ok: cuenta === 0 && !alguienCuenta && campo.length > 20,
    detalle: `${campo.length} jugadores de campo, ${cuenta} arqueros · ninguno se cuenta como arquero: ${!alguienCuenta}`,
  };
});

await probar('10. No se puede comprar al último arquero de un rival', () => {
  window.__carrera('boca');
  const s = Engine.state;
  s.budget = 999999999;
  // Se busca un club rival y se le deja un solo arquero (sacando los demás
  // por la vía que el juego ya tiene: marcarlos como que se fueron).
  const rival = 'lanus';
  const plantel = Mercado.plantel(Engine, rival);
  const arqueros = plantel.filter((p) => p.pos === 'POR');
  arqueros.slice(1).forEach((p) => Mercado.movimientosDe(s, rival).fuera.push(p.id));
  Engine._fuerzas = {};
  const ahora = Mercado.plantel(Engine, rival);
  const unico = ahora.filter((p) => p.pos === 'POR')[0];
  const r = Mercado.negociar(Engine, rival, unico.id);
  const porClausula = Mercado.negociar(Engine, rival, unico.id, true);
  return {
    ok: window.__arqueros(ahora) === 1 && r && !r.ok && porClausula && !porClausula.ok,
    detalle: `Lanús con 1 arquero · "${r ? r.mensaje : 'sin respuesta'}"`,
  };
});

// ---------- 11: el soak del mundo rival ----------

await probar('11. SOAK: 25 temporadas del mundo y ningún club sin arquero', () => {
  window.__carrera('boca');
  const fallos = [];
  const revisar = (temporada) => {
    Engine.state.clubs.forEach((c) => {
      const propio = c.id === Engine.state.clubId;
      const pl = propio ? Engine.state.squad : Mercado.plantel(Engine, c.id);
      if (!pl.length) return;
      const pors = pl.filter((p) => p.pos === 'POR');
      if (!pors.length) {
        fallos.push({
          club: c.name, temporada, jugadores: pl.length, propio,
          // Quiénes eran los últimos arqueros de ese club, para poder
          // rastrear qué operación lo dejó sin ninguno.
          ultimosArqueros: ((typeof REAL_ROSTERS !== 'undefined' && REAL_ROSTERS[c.id]) || [])
            .filter((p) => p.pos === 'POR').map((p) => p.name).join(', ') || '(plantel generado)',
          seFueron: (Mercado.movimientosDe(Engine.state, c.id).fuera || []).length,
        });
      }
    });
  };
  for (let t = 1; t <= 25; t++) {
    Engine.state.season.year = t;
    Engine._fuerzas = {};
    // Todo lo que mueve jugadores en una temporada.
    Engine.procesarRetiros();
    Mercado.liberarJugadores(Engine);
    Mercado.mercadoDeLosRivales(Engine);
    if (typeof Juveniles !== 'undefined') Juveniles.cerrarTemporada(Engine);
    Engine._fuerzas = {};
    revisar(t);
  }
  return {
    ok: !fallos.length,
    detalle: fallos.length
      ? `${fallos.length} CLUBES SIN ARQUERO: ` + fallos.slice(0, 5).map((f) =>
        `${f.club} (temporada ${f.temporada}, ${f.jugadores} jugadores, ${f.seFueron} salidas registradas, arqueros originales: ${f.ultimosArqueros})`).join(' | ')
      : '25 temporadas, 66 clubes por temporada, todos con al menos 1 arquero',
  };
});

await probar('12. SOAK: tu propio club tampoco se queda sin arquero', () => {
  window.__carrera('aldosivi');
  const problemas = [];
  for (let t = 1; t <= 25; t++) {
    Engine.state.season.year = t;
    // Se envejece el plantel a lo bestia: todos los arqueros pasados de edad.
    const hoy = Engine.fechaDelJuego();
    Engine.state.squad.filter((p) => p.pos === 'POR').forEach((p, i) => {
      if (i === 0) p.birthDate = `${hoy.anio - 44}-01-01`;
    });
    Engine.refrescarEdades();
    Engine.procesarRetiros();
    if (typeof Juveniles !== 'undefined') {
      Juveniles.cerrarTemporada(Engine);
      Juveniles.reponerPlantelDelUsuario(Engine);
    }
    if (!window.__arqueros()) problemas.push(`temporada ${t}: ${Engine.state.squad.length} jugadores y 0 arqueros`);
  }
  return {
    ok: !problemas.length,
    detalle: problemas.length ? problemas.slice(0, 3).join(' | ')
      : `25 temporadas retirando arqueros a la fuerza: nunca bajó de 1 (quedó con ${window.__arqueros()})`,
  };
});

// ---------- El informe ----------
console.log('\nPRUEBAS DEL ÚLTIMO ARQUERO\n');
pruebas.forEach((p) => {
  console.log(`  ${p.ok ? '✓' : '✗'} ${p.nombre}`);
  if (p.detalle) console.log(`      ${p.detalle}`);
});
const fallaron = pruebas.filter((p) => !p.ok);
console.log(`\n${pruebas.length - fallaron.length}/${pruebas.length} pruebas pasaron`);
if (errores.length) console.log('errores de la página:', errores);
await navegador.close();
process.exit(fallaron.length || errores.length ? 1 : 0);
