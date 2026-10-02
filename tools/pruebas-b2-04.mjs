// PRUEBAS DE LA CORRECCIÓN B2-04 — retiros de arqueros rivales y su asiento.
//
//     npm install --no-save playwright
//     node tools/pruebas-b2-04.mjs
//
// El bug: `Engine.procesarRetiros()` decidía quién se retiraba en los clubes
// rivales mirando la edad en REAL_ROSTERS, mientras que quien decide quién
// juega es `Mercado.plantel()`, que además aplica la red del último arquero.
// Las dos cuentas no coincidían: Marino Arzamendia (riestra-r2) se anunció
// retirado en la T13 y siguió jugando la T14, la T15 y la T16.
//
// Y un jugador transferido no quedaba anotado en ningún lado: en su club de
// origen está en `fuera` y se lo salteaba, y en el club nuevo no figura en
// REAL_ROSTERS porque no es de ahí.
//
// El arreglo: `procesarRetiros` le pregunta a `Mercado.plantel()` qué plantel
// va a tener cada club LA TEMPORADA QUE VIENE, y anota como retirado solo al
// que no esté. Una sola fuente de verdad.

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
  // Cierra la temporada t: procesa los retiros y pasa a la siguiente.
  window.__cerrar = (t) => {
    Engine.state.season.year = t;
    Engine._fuerzas = {};
    Engine.procesarRetiros();
    Engine._fuerzas = {};
  };
  window.__plantelDe = (clubId) => Mercado.plantel(Engine, clubId);
  window.__activo = (clubId, id) => Mercado.plantel(Engine, clubId).some((p) => p.id === id);
  window.__anotado = (id) => (Engine.state.retirados || []).some((r) => r.id === id);
  // Todos los que están anotados como retirados Y siguen jugando en algún club.
  window.__contradicciones = () => {
    const s = Engine.state;
    const malos = [];
    (s.retirados || []).forEach((r) => {
      s.clubs.forEach((c) => {
        const pl = c.id === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, c.id);
        if (pl.some((p) => p.id === r.id)) malos.push(`${r.id} anotado retirado en T${r.temporada} y activo en ${c.id}`);
      });
    });
    return malos;
  };
  window.__clubesSinArquero = () => {
    const s = Engine.state;
    return s.clubs.filter((c) => {
      const pl = c.id === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, c.id);
      return pl.length && !Engine.cuantosArqueros(pl);
    }).map((c) => c.id);
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

console.log('\n========== PRUEBAS B2-04 ==========\n');

await probar('Caso 1 — Arquero rival NO protegido: se retira y queda anotado', () => {
  window.__carrera('boca');
  // Un club con más de un arquero, y el arquero más veterano de ese club.
  let caso = null;
  for (const clubId of Object.keys(REAL_ROSTERS)) {
    if (clubId === Engine.state.clubId || !Engine.getClub(clubId)) continue;
    const arqueros = Mercado.plantel(Engine, clubId).filter((p) => p.pos === 'POR');
    if (arqueros.length < 2) continue;
    const viejo = arqueros.slice().sort((a, b) => Engine.edadDe(b) - Engine.edadDe(a))[0];
    // La temporada en la que cumple la edad de retiro (cierra con 40).
    for (let t = 1; t <= 12; t++) {
      if (Engine.edadAlCierreDeTemporada(viejo, t) === Engine.EDAD_DE_RETIRO + 1) { caso = { clubId, viejo, t, arqueros: arqueros.length }; break; }
    }
    if (caso) break;
  }
  if (!caso) return { ok: false, detalle: 'no se encontró el caso' };
  for (let t = 1; t < caso.t; t++) window.__cerrar(t);
  // Durante su última temporada: activo y NO anotado todavía.
  Engine.state.season.year = caso.t; Engine._fuerzas = {};
  const juegaSuUltima = window.__activo(caso.clubId, caso.viejo.id);
  window.__cerrar(caso.t);
  const anotado = window.__anotado(caso.viejo.id);
  Engine.state.season.year = caso.t + 1; Engine._fuerzas = {};
  const sigueDespues = window.__activo(caso.clubId, caso.viejo.id);
  return {
    ok: juegaSuUltima && anotado && !sigueDespues,
    detalle: `${caso.viejo.name} (${caso.viejo.id}) en ${caso.clubId}, que tiene ${caso.arqueros} arqueros ·`
      + ` juega su última T${caso.t}=${juegaSuUltima} · anotado al cierre=${anotado}`
      + ` · sigue en T${caso.t + 1}=${sigueDespues} (tiene que ser false)`,
  };
});

await probar('Caso 2 — Último arquero protegido: no queda anotado y el club no queda en cero', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const clubId = 'riestra';
  // Se le dejan al club solo sus arqueros viejos, sacando a los demás.
  const arqueros = Mercado.plantel(Engine, clubId).filter((p) => p.pos === 'POR');
  const masViejo = arqueros.slice().sort((a, b) => Engine.edadDe(b) - Engine.edadDe(a))[0];
  arqueros.filter((a) => a.id !== masViejo.id)
    .forEach((a) => Mercado.movimientosDe(s, clubId).fuera.push(a.id));
  Engine._fuerzas = {};
  const traza = [];
  let contradicciones = [];
  let sinArquero = [];
  for (let t = 1; t <= 14; t++) {
    window.__cerrar(t);
    s.season.year = t + 1; Engine._fuerzas = {};
    const activo = window.__activo(clubId, masViejo.id);
    const anotado = window.__anotado(masViejo.id);
    const n = Engine.cuantosArqueros(Mercado.plantel(Engine, clubId));
    if (activo && anotado) contradicciones.push(`T${t + 1}`);
    if (!n) sinArquero.push(`T${t + 1}`);
    if (t >= 10) traza.push(`T${t + 1}: activo=${activo} anotado=${anotado} arqueros=${n}`);
  }
  return {
    ok: !contradicciones.length && !sinArquero.length,
    detalle: `${masViejo.name} (único arquero de ${clubId}) · ${traza.join(' · ')}`
      + (contradicciones.length ? ` — CONTRADICCIÓN en ${contradicciones.join(',')}` : '')
      + (sinArquero.length ? ` — SIN ARQUERO en ${sinArquero.join(',')}` : ''),
  };
});

await probar('Caso 3 — Cuando deja de ser necesario, el protegido se retira', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const clubId = 'riestra';
  const arqueros = Mercado.plantel(Engine, clubId).filter((p) => p.pos === 'POR');
  const masViejo = arqueros.slice().sort((a, b) => Engine.edadDe(b) - Engine.edadDe(a))[0];
  arqueros.filter((a) => a.id !== masViejo.id)
    .forEach((a) => Mercado.movimientosDe(s, clubId).fuera.push(a.id));
  Engine._fuerzas = {};
  // Se corre hasta que esté protegido: pasado de edad y todavía jugando.
  let tProtegido = null;
  for (let t = 1; t <= 14 && tProtegido === null; t++) {
    window.__cerrar(t);
    s.season.year = t + 1; Engine._fuerzas = {};
    if (window.__activo(clubId, masViejo.id)
      && Engine.edadAlCierreDeTemporada(masViejo, t) > Engine.EDAD_DE_RETIRO) tProtegido = t + 1;
  }
  if (tProtegido === null) return { ok: false, detalle: 'nunca quedó protegido' };
  const anotadoMientrasProtegido = window.__anotado(masViejo.id);
  // Ahora le llega un arquero joven: ya no hace falta retenerlo.
  const otroClub = Object.keys(REAL_ROSTERS).find((c) => c !== clubId && c !== s.clubId);
  const joven = Mercado.plantel(Engine, otroClub).filter((p) => p.pos === 'POR')
    .slice().sort((a, b) => Engine.edadDe(a) - Engine.edadDe(b))[0];
  Mercado.transferir(s, joven, otroClub, clubId, tProtegido);
  Engine._fuerzas = {};
  window.__cerrar(tProtegido);
  s.season.year = tProtegido + 1; Engine._fuerzas = {};
  const sigueActivo = window.__activo(clubId, masViejo.id);
  const anotadoAhora = window.__anotado(masViejo.id);
  const arquerosAhora = Engine.cuantosArqueros(Mercado.plantel(Engine, clubId));
  return {
    ok: !anotadoMientrasProtegido && !sigueActivo && anotadoAhora && arquerosAhora >= 1,
    detalle: `${masViejo.name}: protegido desde T${tProtegido}, anotado mientras protegido=${anotadoMientrasProtegido}`
      + ` (tiene que ser false) · le llega ${joven.name} · después: activo=${sigueActivo} (false)`
      + ` anotado=${anotadoAhora} (true) · el club queda con ${arquerosAhora} arquero(s)`,
  };
});

await probar('Caso 4 — Arquero transferido: se retira en el club nuevo y queda anotado', () => {
  window.__carrera('boca');
  const s = Engine.state;
  // Un arquero veterano de un club, al club de al lado.
  let origen = null; let arquero = null;
  for (const clubId of Object.keys(REAL_ROSTERS)) {
    if (clubId === s.clubId || !Engine.getClub(clubId)) continue;
    const arqueros = Mercado.plantel(Engine, clubId).filter((p) => p.pos === 'POR');
    if (arqueros.length < 2) continue;
    const v = arqueros.slice().sort((a, b) => Engine.edadDe(b) - Engine.edadDe(a))[0];
    if (Engine.edadDe(v) >= 33) { origen = clubId; arquero = v; break; }
  }
  if (!arquero) return { ok: false, detalle: 'no se encontró un arquero veterano' };
  const destino = Object.keys(REAL_ROSTERS).find((c) => c !== origen && c !== s.clubId);
  Mercado.transferir(s, arquero, origen, destino, 1);
  Engine._fuerzas = {};
  const traza = [];
  let anotadoEn = null;
  for (let t = 1; t <= 14; t++) {
    window.__cerrar(t);
    s.season.year = t + 1; Engine._fuerzas = {};
    const enDestino = window.__activo(destino, arquero.id);
    const enOrigen = window.__activo(origen, arquero.id);
    const anotado = window.__anotado(arquero.id);
    if (anotado && anotadoEn === null) anotadoEn = t;
    if (!enDestino && !enOrigen && anotado && anotadoEn !== null) { traza.push(`T${t + 1}: retirado y afuera de los dos`); break; }
    traza.push(`T${t + 1}: destino=${enDestino} origen=${enOrigen} anotado=${anotado}`);
  }
  const reg = (s.retirados || []).find((r) => r.id === arquero.id);
  return {
    ok: !!reg && !window.__activo(destino, arquero.id) && !window.__activo(origen, arquero.id),
    detalle: `${arquero.name} (${arquero.id}) de ${origen} a ${destino} · ${traza.slice(-3).join(' · ')}`
      + ` · anotado en retirados: ${reg ? `sí, club ${reg.clubId}, T${reg.temporada}, ${reg.edad} años` : 'NO'}`,
  };
});

await probar('Caso 5 — El retirado no reaparece en varias temporadas', () => {
  window.__carrera('boca');
  const s = Engine.state;
  for (let t = 1; t <= 6; t++) window.__cerrar(t);
  const antes = (s.retirados || []).map((r) => r.id);
  if (!antes.length) return { ok: false, detalle: 'no se retiró nadie en 6 temporadas' };
  const reapariciones = [];
  for (let t = 7; t <= 18; t++) {
    window.__cerrar(t);
    s.season.year = t + 1; Engine._fuerzas = {};
    antes.forEach((id) => {
      s.clubs.forEach((c) => {
        const pl = c.id === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, c.id);
        if (pl.some((p) => p.id === id)) reapariciones.push(`${id} en ${c.id} en T${t + 1}`);
      });
    });
  }
  return {
    ok: !reapariciones.length,
    detalle: reapariciones.length
      ? `REAPARECIERON: ${reapariciones.slice(0, 3).join(' · ')} (${reapariciones.length} en total)`
      : `${antes.length} retirados de las primeras 6 temporadas, seguidos hasta la T19: ninguno volvió`,
  };
});

await probar('Caso 6 — Llegar a la edad no borra al jugador antes de terminar su última', () => {
  window.__carrera('boca');
  const s = Engine.state;
  // Todos los jugadores de un club que cumplen la edad de retiro en alguna
  // temporada: cada uno tiene que estar presente ESA temporada.
  const clubId = 'estudianteslp';
  const plantel = Mercado.plantel(Engine, clubId);
  const casos = [];
  plantel.forEach((p) => {
    for (let t = 1; t <= 10; t++) {
      if (Engine.edadAlCierreDeTemporada(p, t) === Engine.EDAD_DE_RETIRO + 1) { casos.push({ p, t }); break; }
    }
  });
  if (!casos.length) return { ok: false, detalle: 'ningún jugador llega a la edad en 10 temporadas' };
  const faltaron = [];
  for (let t = 1; t <= 10; t++) {
    s.season.year = t; Engine._fuerzas = {};
    const pl = Mercado.plantel(Engine, clubId);
    casos.filter((c) => c.t === t).forEach((c) => {
      if (!pl.some((x) => x.id === c.p.id)) faltaron.push(`${c.p.name} faltó en su última T${t}`);
    });
    window.__cerrar(t);
  }
  return {
    ok: !faltaron.length,
    detalle: faltaron.length ? faltaron.slice(0, 3).join(' · ')
      : `${casos.length} jugadores de ${clubId} llegan a los ${Engine.EDAD_DE_RETIRO + 1}: todos jugaron su última temporada entera`,
  };
});

await probar('Invariante — nadie anotado como retirado sigue activo, y ningún club sin arquero', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const problemas = [];
  for (let t = 1; t <= 15; t++) {
    window.__cerrar(t);
    s.season.year = t + 1; Engine._fuerzas = {};
    const c = window.__contradicciones();
    const sa = window.__clubesSinArquero();
    if (c.length) problemas.push(`T${t + 1}: ${c.length} contradicción(es) — ${c[0]}`);
    if (sa.length) problemas.push(`T${t + 1}: sin arquero ${sa.join(',')}`);
  }
  return {
    ok: !problemas.length,
    detalle: problemas.length ? problemas.slice(0, 3).join(' · ')
      : `15 temporadas: 0 retirados activos y 0 clubes sin arquero (${(s.retirados || []).length} retiros anotados)`,
  };
});

console.log(`\n${pasaron}/${total.length} pruebas pasaron`);
if (erroresDePagina.length) console.log(`\nerrores de página: ${erroresDePagina.join(' | ')}`);
await navegador.close();
process.exit(pasaron === total.length ? 0 : 1);
