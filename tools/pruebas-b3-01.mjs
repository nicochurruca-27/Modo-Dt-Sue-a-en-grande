// PRUEBAS DE LA CORRECCIÓN B3-01 — la lesión del arquero deja el arco vacío.
//
//     npm install --no-save playwright
//     node tools/pruebas-b3-01.mjs
//
// El bug: `sacarAlLesionado` vacía el casillero del lesionado. Si el que se
// rompía era el arquero y tocabas "Seguir con uno menos", terminabas el
// partido SIN NADIE al arco, con los arqueros suplentes sanos en el banco.
// Reproducido en la auditoría del Bloque 3: 6 casos en menos de 3 temporadas.
//
// Contradice la regla del Bloque 0: un jugador de campo no cubre el arco.
//
// La corrección: cuando el arco queda vacío Y hay un arquero que puede
// entrar, el cambio es OBLIGATORIO. Jugar con diez porque se rompió un
// jugador de campo sigue siendo una decisión tuya y no cambia.

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
    Engine.state.confianza = 80;
  };

  // Lleva la partida hasta un partido en curso, resolviendo lo que haga falta.
  window.__hastaUnPartido = () => {
    const s = Engine.state;
    let v = 0;
    while (v++ < 6000 && s.screen !== 'partido') {
      s.confianza = 80;
      const sc = s.screen;
      if (sc === 'calendar') Engine.avanzarUnDia();
      else if (sc === 'pre-match') Engine.chooseDecision(0);
      else if (sc === 'oferta-recibida') Engine.resolverOferta(false);
      else if (sc === 'transfer') Engine.continueFromTransfer();
      else if (sc === 'fifa-break') Engine.continueFromFifa();
      else if (sc === 'contract-renewal') Engine.resolveContractDecision(true, 3);
      else if (sc === 'match-result') Engine.finishMatchAndAdvance();
      else if (sc === 'season-end') Engine.startNewSeason();
      else if (sc === 'entretiempo') Engine.resolverEntretiempo(0);
      else if (sc === 'lesion') Engine.seguirDespuesDeLaLesion();
      else if (sc === 'penalty') {
        const pen = s.partido && s.partido.penal ? s.partido.penal : (s.pendingMatch || {}).penalty;
        if (pen && pen.side === 'user') Engine.resolvePenalty(PENALTY_ZONES[0].id, Engine.getPenaltyShooters()[0]);
        else Engine.resolvePenalty(PENALTY_ZONES[0].id, Engine.getUserKeeper());
        Engine.seguirDespuesDelPenal();
      } else return false;
    }
    return s.screen === 'partido';
  };

  // Provoca la lesión de UN jugador concreto, por el mismo camino del juego.
  window.__lesionarA = (id) => {
    const s = Engine.state;
    const j = s.squad.find((p) => p.id === id);
    if (!j) return false;
    Engine.sacarAlLesionado({ id, detail: 'Desgarro', matches: 2, minuto: s.partido.minuto || 50 });
    Engine.state.screen = 'lesion';
    return true;
  };

  window.__alArco = () => {
    const s = Engine.state;
    const slot = (s.startingSlots || []).find((e) => e.slot === 'POR');
    if (!slot || !slot.playerId) return null;
    return s.squad.find((p) => p.id === slot.playerId) || null;
  };
  window.__enCancha = () => Engine.getStartingXI().starters.map((e) => e.id);
  window.__titularPOR = () => {
    const s = Engine.state;
    const slot = (s.startingSlots || []).find((e) => e.slot === 'POR');
    return slot ? slot.playerId : null;
  };
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

console.log('\n========== PRUEBAS B3-01 ==========\n');

await probar('Un jugador de campo lesionado: se puede seguir con uno menos, como antes', () => {
  window.__carrera('boca');
  if (!window.__hastaUnPartido()) return { ok: false, detalle: 'no se llegó a un partido' };
  const s = Engine.state;
  const deCampo = Engine.getStartingXI().starters.find((e) => e.slot !== 'POR');
  window.__lesionarA(deCampo.id);
  const antes = window.__enCancha().length;
  const obligatorio = Engine.cambioObligatorioPorLesion();
  Engine.seguirDespuesDeLaLesion();
  const despues = window.__enCancha().length;
  return {
    ok: !obligatorio && s.screen === 'partido' && despues === antes && antes === 10,
    detalle: `se lesiona ${deCampo.name} (${deCampo.slot}) · ¿cambio obligatorio?: ${!!obligatorio} (tiene que ser false)`
      + ` · en la cancha ${antes} -> ${despues} · pantalla "${s.screen}" · el arco sigue con ${window.__alArco() ? window.__alArco().name : 'NADIE'}`,
  };
});

await probar('Arquero lesionado con otro arquero disponible: NO se puede seguir con el arco vacío', () => {
  window.__carrera('boca');
  if (!window.__hastaUnPartido()) return { ok: false, detalle: 'no se llegó a un partido' };
  const s = Engine.state;
  const arquero = Engine.getStartingXI().starters.find((e) => e.slot === 'POR');
  window.__lesionarA(arquero.id);
  const disponibles = Engine.arquerosQuePuedenEntrar();
  const obligatorio = Engine.cambioObligatorioPorLesion();
  // Se toca "seguir" sin elegir a nadie: el arco NO puede quedar vacío.
  Engine.seguirDespuesDeLaLesion();
  const alArco = window.__alArco();
  return {
    ok: !!obligatorio && s.screen === 'partido' && !!alArco && alArco.pos === 'POR'
      && alArco.id !== arquero.id,
    detalle: `se lesiona el arquero ${arquero.name} · arqueros que pueden entrar: ${disponibles.length}`
      + ` · ¿obligatorio?: ${!!obligatorio} · se toca seguir SIN elegir y al arco queda`
      + ` ${alArco ? `${alArco.name} (${alArco.pos})` : 'NADIE'} · aviso: "${s.avisoDeLesion || 'ninguno'}"`,
  };
});

await probar('El arquero suplente entra y el lesionado sale de la cancha', () => {
  window.__carrera('boca');
  if (!window.__hastaUnPartido()) return { ok: false, detalle: 'no se llegó a un partido' };
  const s = Engine.state;
  const arquero = Engine.getStartingXI().starters.find((e) => e.slot === 'POR');
  window.__lesionarA(arquero.id);
  const lesionado = s.partido.lesion.id;
  const suplente = Engine.arquerosQuePuedenEntrar()[0];
  const ok = Engine.meterPorElLesionado(suplente.id);
  const alArco = window.__alArco();
  Engine.seguirDespuesDeLaLesion();
  return {
    ok: ok && !!alArco && alArco.id === suplente.id && alArco.pos === 'POR'
      && !window.__enCancha().includes(lesionado) && s.screen === 'partido',
    detalle: `entra ${suplente.name} (${suplente.pos}) · al arco queda ${alArco ? `${alArco.name} (${alArco.pos})` : 'NADIE'}`
      + ` · el lesionado sigue en cancha: ${window.__enCancha().includes(lesionado)}`
      + ` · el partido se reanudó: ${s.screen === 'partido'}`,
  };
});

await probar('No se duplican jugadores ni desaparecen del plantel', () => {
  const s = Engine.state;
  const ids = window.__enCancha();
  const repetidos = ids.length !== new Set(ids).size;
  const fantasma = ids.filter((id) => !s.squad.some((p) => p.id === id));
  const arqueros = s.squad.filter((p) => p.pos === 'POR').length;
  return {
    ok: !repetidos && !fantasma.length && arqueros >= 1,
    detalle: `${ids.length} en la cancha, ${new Set(ids).size} distintos · ids que no están en el plantel: ${fantasma.length}`
      + ` · el plantel tiene ${s.squad.length} jugadores y ${arqueros} arquero(s)`,
  };
});

await probar('No se pasa de once en cancha ni del límite de cambios', () => {
  const s = Engine.state;
  const enCancha = window.__enCancha().length;
  const hechos = (s.partido.cambios || []).length;
  const quedan = Engine.cambiosQueQuedan();
  return {
    ok: enCancha <= 11 && hechos + quedan === Engine.CAMBIOS_POR_PARTIDO && quedan >= 0,
    detalle: `${enCancha} en la cancha (<= 11) · cambios hechos ${hechos} + restantes ${quedan}`
      + ` = ${hechos + quedan} (el tope es ${Engine.CAMBIOS_POR_PARTIDO})`,
  };
});

await probar('Sin ningún arquero disponible: no se inventa nada ni va un jugador de campo al arco', () => {
  window.__carrera('boca');
  if (!window.__hastaUnPartido()) return { ok: false, detalle: 'no se llegó a un partido' };
  const s = Engine.state;
  const arquero = Engine.getStartingXI().starters.find((e) => e.slot === 'POR');
  // Se lesionan TODOS los arqueros del banco antes de romper al titular.
  s.squad.filter((p) => p.pos === 'POR' && p.id !== arquero.id)
    .forEach((p) => { p.out = { reason: 'lesión', detail: 'Rodilla', matches: 5 }; });
  window.__lesionarA(arquero.id);
  const disponibles = Engine.arquerosQuePuedenEntrar();
  const obligatorio = Engine.cambioObligatorioPorLesion();
  // Se intenta meter un jugador de campo al arco: con arqueros no se podría,
  // sin arqueros el comportamiento es el de antes.
  const deCampo = Engine.getBanco().find((j) => j.pos !== 'POR' && Engine.isAvailable(j));
  const entroDeCampo = deCampo ? Engine.meterPorElLesionado(deCampo.id) : false;
  const alArco = window.__alArco();
  Engine.seguirDespuesDeLaLesion();
  const plantelTieneInventados = s.squad.some((p) => !p.id);
  return {
    ok: disponibles.length === 0 && !obligatorio && !entroDeCampo && !alArco
      && !plantelTieneInventados && s.screen === 'partido',
    detalle: `arqueros que pueden entrar: ${disponibles.length} · ¿obligatorio?: ${!!obligatorio}`
      + ` · se intentó meter a ${deCampo ? `${deCampo.name} (${deCampo.pos})` : 'nadie'} al arco: ${entroDeCampo ? 'ENTRÓ' : 'rechazado'}`
      + ` · al arco queda ${alArco ? `${alArco.name} (${alArco.pos})` : 'nadie, y así se juega'}`
      + ` · jugadores inventados en el plantel: ${plantelTieneInventados ? 'SÍ' : 'no'}`
      + ` · el partido pudo seguir: ${s.screen === 'partido'}`,
  };
});

await probar('Con arquero disponible, un jugador de campo NO puede ocupar el arco', () => {
  window.__carrera('boca');
  if (!window.__hastaUnPartido()) return { ok: false, detalle: 'no se llegó a un partido' };
  const s = Engine.state;
  const arquero = Engine.getStartingXI().starters.find((e) => e.slot === 'POR');
  window.__lesionarA(arquero.id);
  const deCampo = Engine.getBanco().find((j) => j.pos !== 'POR' && Engine.isAvailable(j));
  const entro = Engine.meterPorElLesionado(deCampo.id);
  const alArco = window.__alArco();
  return {
    ok: !entro && !alArco,
    detalle: `con ${Engine.arquerosQuePuedenEntrar().length} arquero(s) disponible(s), se intentó meter a`
      + ` ${deCampo.name} (${deCampo.pos}) al arco: ${entro ? 'ENTRÓ' : 'rechazado'}`
      + ` · al arco queda ${alArco ? `${alArco.name} (${alArco.pos})` : 'nadie'}`,
  };
});

await probar('Resuelta la lesión, el partido sigue y se cierra bien', () => {
  const s = Engine.state;
  const suplente = Engine.arquerosQuePuedenEntrar()[0];
  Engine.meterPorElLesionado(suplente.id);
  Engine.seguirDespuesDeLaLesion();
  // Se juega hasta el final.
  let v = 0;
  while (v++ < 400 && s.screen === 'partido') {
    Engine.simularUnMinuto();
    if (s.screen === 'entretiempo') Engine.resolverEntretiempo(0);
    else if (s.screen === 'lesion') {
      const ob = Engine.cambioObligatorioPorLesion();
      if (ob) Engine.meterPorElLesionado(ob.arqueros[0].id);
      Engine.seguirDespuesDeLaLesion();
    } else if (s.screen === 'penalty') {
      const pen = s.partido && s.partido.penal ? s.partido.penal : (s.pendingMatch || {}).penalty;
      if (pen && pen.side === 'user') Engine.resolvePenalty(PENALTY_ZONES[0].id, Engine.getPenaltyShooters()[0]);
      else Engine.resolvePenalty(PENALTY_ZONES[0].id, Engine.getUserKeeper());
      Engine.seguirDespuesDelPenal();
    }
  }
  const pm = s.pendingMatch;
  return {
    ok: !s.partido && !!pm && Number.isFinite(pm.homeGoals) && Number.isFinite(pm.awayGoals)
      && (pm.enCancha || []).length <= 11,
    detalle: `el partido terminó en la pantalla "${s.screen}" · marcador ${pm ? `${pm.homeGoals}-${pm.awayGoals}` : 'sin planilla'}`
      + ` · ${pm ? (pm.enCancha || []).length : '?'} terminaron en la cancha`,
  };
});

await probar('La pantalla de lesión no deja seguir con el arco vacío', async () => {
  window.__carrera('boca');
  if (!window.__hastaUnPartido()) return { ok: false, detalle: 'no se llegó a un partido' };
  const s = Engine.state;
  const arquero = Engine.getStartingXI().starters.find((e) => e.slot === 'POR');
  window.__lesionarA(arquero.id);
  renderLesion();
  const botonSeguir = document.getElementById('seguir-lesion');
  const fichas = [...document.querySelectorAll('.cambio-ficha')];
  const ofrecidos = fichas.map((f) => f.dataset.cambio)
    .map((id) => s.squad.find((p) => p.id === id))
    .filter(Boolean);
  const soloArqueros = ofrecidos.length > 0 && ofrecidos.every((p) => p.pos === 'POR');
  const dice = app.textContent.includes('sin nadie al arco');
  const textoBoton = botonSeguir ? botonSeguir.textContent.trim() : '';
  return {
    ok: !!botonSeguir && textoBoton === 'Meter al arquero y seguir' && soloArqueros && dice,
    detalle: `el botón dice "${textoBoton}" (ya no ofrece seguir con el arco vacío)`
      + ` · se ofrecen ${ofrecidos.length} jugador(es), todos arqueros: ${soloArqueros}`
      + ` · el cartel avisa del arco vacío: ${dice}`,
  };
});

console.log(`\n${pasaron}/${total.length} pruebas pasaron`);
if (erroresDePagina.length) console.log(`\nerrores de página: ${erroresDePagina.join(' | ')}`);
await navegador.close();
process.exit(pasaron === total.length ? 0 : 1);
