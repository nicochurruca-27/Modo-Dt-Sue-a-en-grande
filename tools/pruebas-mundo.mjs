// PRUEBAS DE MUNDO-01 y MUNDO-02.
//
//     npm install --no-save playwright
//     node tools/pruebas-mundo.mjs [temporadasDelSoak]
//
// MUNDO-01: `state.contratos` acumulaba contratos de jugadores que ya no
// existen. A 30 temporadas, 1873 de 2577 (73%) eran de gente muerta y la
// estructura pesaba 150 KB, el 44% del save. Ahora se poda una vez por
// temporada en `cerrarContratos`.
//
// La regla es conservadora: se CONSERVA salvo prueba en contrario. Sobrevive
// el contrato de quien está en algún plantel, libre, cedido o con un acuerdo
// cerrado. No se usa `state.retirados` como criterio, porque la auditoría
// mostró que hay anotados como retirados que siguen jugando legítimamente.
//
// MUNDO-02: la clave del caché del índice contaba CLUBES con entrada en
// `mundo` y no movimientos, así que un pase entre dos clubes que ya tenían
// entrada dejaba la clave igual y el buscador seguía mostrando al jugador en
// el club que lo vendió.

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
  window.__T = (t) => { Engine.state.season.year = t; Engine._fuerzas = {}; Mercado._indice = null; };
  window.__en = (clubId, id) => Mercado.plantel(Engine, clubId).find((p) => p.id === id) || null;
  window.__tiene = (id) => !!Mercado.contratoDe(Engine.state, id);
  window.__clubEnElIndice = (id) => {
    const fila = Mercado.indice(Engine).find((x) => x.id === id);
    return fila ? fila.clubId : null;
  };
  window.__abrirMercado = () => { if (!Engine.mercadoAbierto()) Engine.state.calendar.dayCount = 0; };
  window.__pesoDe = (x) => JSON.stringify(x || {}).length;
  window.__muertos = () => {
    const s = Engine.state;
    const vivos = new Set();
    s.clubs.forEach((c) => {
      const pl = c.id === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, c.id);
      pl.forEach((p) => vivos.add(p.id));
    });
    (s.libres || []).forEach((j) => vivos.add(j.id));
    (s.cedidos || []).forEach((c) => { if (c && c.jugador) vivos.add(c.jugador.id); });
    return Object.keys(s.contratos || {}).filter((id) => !vivos.has(id));
  };
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

console.log('\n========== PRUEBAS MUNDO-01 / MUNDO-02 ==========');
console.log('\n--- MUNDO-01: la poda de contratos muertos ---');

await probar('Un contrato activo sobrevive a la poda', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = Mercado.plantel(Engine, 'estudianteslp')[0];
  Mercado.firmar(s, j.id, Mercado.contratoNuevo(Engine, j, 1, j), 1);
  const antes = Mercado.contratoDe(s, j.id);
  const podados = Mercado.podarContratos(Engine);
  return {
    ok: !!Mercado.contratoDe(s, j.id) && JSON.stringify(Mercado.contratoDe(s, j.id)) === JSON.stringify(antes),
    detalle: `${j.name} sigue en estudianteslp · podados ${podados} · su contrato ${window.__tiene(j.id) ? 'quedó' : 'SE BORRÓ'}`,
  };
});

await probar('Una renovación sobrevive a la poda', () => {
  window.__carrera('boca');
  const s = Engine.state;
  s.season.year = 3; Engine._fuerzas = {};
  const r = Mercado.cerrarContratos(Engine);
  const renovados = Object.keys(s.contratos).length;
  Engine._fuerzas = {};
  const siguen = Object.keys(s.contratos).filter((id) => window.__tiene(id)).length;
  return {
    ok: r.renovados > 0 && siguen === renovados && renovados > 0,
    detalle: `${r.renovados} renovaciones · ${renovados} contratos guardados · podados en la misma pasada: ${r.contratosPodados} · sobreviven ${siguen}`,
  };
});

await probar('Una transferencia conserva el contrato nuevo', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = Mercado.plantel(Engine, 'estudianteslp')[0];
  Mercado.transferir(s, j, 'estudianteslp', 'river', 1, Engine);
  Engine._fuerzas = {};
  const contrato = JSON.stringify(Mercado.contratoDe(s, j.id));
  Mercado.podarContratos(Engine);
  const despues = JSON.stringify(Mercado.contratoDe(s, j.id));
  const enRiver = window.__en('river', j.id);
  return {
    ok: contrato === despues && !!enRiver && contrato !== 'null',
    detalle: `${j.name} a river · contrato ${contrato} · después de podar ${despues}`,
  };
});

await probar('Un fichaje tuyo conserva el contrato nuevo', () => {
  window.__carrera('boca');
  const s = Engine.state;
  window.__abrirMercado();
  s.budget = 999999999999;
  const fila = Mercado.indice(Engine)[0];
  Mercado.negociar(Engine, fila.clubId, fila.id, !!fila.clausula);
  const mio = s.squad.find((p) => p.id === fila.id);
  Mercado.podarContratos(Engine);
  const sigue = s.squad.find((p) => p.id === fila.id);
  return {
    ok: !!mio && !!sigue && sigue.salary > 0,
    detalle: `${fila.name} fichado: ${sigue ? `${sigue.contractYears}a/${sigue.salary}` : 'NO LLEGÓ'} · sigue en tu plantel después de podar: ${!!sigue}`,
  };
});

await probar('Un jugador cedido no pierde su contrato', () => {
  window.__carrera('estudianteslp');
  const s = Engine.state;
  const j = s.squad.find((p) => p.pos !== 'POR');
  // Se arma el préstamo como lo arma el juego: sale del plantel y vive en cedidos.
  s.squad = s.squad.filter((p) => p.id !== j.id);
  s.cedidos.push({ jugador: j, club: { id: 'lanus', nombre: 'Lanús' }, ventanas: 0 });
  Mercado.firmar(s, j.id, Mercado.contratoNuevo(Engine, j, 1, j), 1);
  Engine._fuerzas = {};
  const podados = Mercado.podarContratos(Engine);
  return {
    ok: window.__tiene(j.id),
    detalle: `${j.name} cedido (no está en ningún plantel del mundo) · podados ${podados}`
      + ` · su contrato ${window.__tiene(j.id) ? 'quedó' : 'SE BORRÓ'}`,
  };
});

await probar('Un jugador libre no pierde su contrato', () => {
  window.__carrera('boca');
  const s = Engine.state;
  Mercado.liberarJugadores(Engine);
  Engine._fuerzas = {};
  const libre = (s.libres || [])[0];
  if (!libre) return { ok: false, detalle: 'no quedó nadie libre' };
  Mercado.firmar(s, libre.id, Mercado.contratoNuevo(Engine, { id: libre.id, rating: libre.ratingBase, age: libre.edadBase }, 1, libre), 1);
  const podados = Mercado.podarContratos(Engine);
  return {
    ok: window.__tiene(libre.id),
    detalle: `${libre.name} libre · podados ${podados} · su contrato ${window.__tiene(libre.id) ? 'quedó' : 'SE BORRÓ'}`,
  };
});

await probar('El que se reconstruye desde `mundo` no pierde su contrato', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const j = Mercado.plantel(Engine, 'estudianteslp')[0];
  Mercado.transferir(s, j, 'estudianteslp', 'river', 1, Engine);
  Engine._fuerzas = {};
  // No está en REAL_ROSTERS de river: solo existe porque está en `dentro`.
  const soloPorMundo = Mercado.movimientosDe(s, 'river').dentro.some((x) => x.id === j.id);
  const podados = Mercado.podarContratos(Engine);
  return {
    ok: soloPorMundo && window.__tiene(j.id) && !!window.__en('river', j.id),
    detalle: `${j.name} existe en river solo por state.mundo · podados ${podados}`
      + ` · contrato ${window.__tiene(j.id) ? 'quedó' : 'SE BORRÓ'}`,
  };
});

await probar('Un anotado como retirado que sigue jugando no pierde su contrato', () => {
  // El caso que la auditoría dejó marcado: la red del último arquero sostiene
  // a un arquero que el diario ya anunció retirado. Está en el plantel, así
  // que la regla lo tiene que conservar sin mirar `state.retirados`.
  window.__carrera('boca');
  const s = Engine.state;
  const club = 'riestra';
  const arqueros = Mercado.plantel(Engine, club).filter((p) => p.pos === 'POR');
  const masViejo = arqueros.slice().sort((a, b) => Engine.edadDe(b) - Engine.edadDe(a))[0];
  arqueros.filter((a) => a.id !== masViejo.id)
    .forEach((a) => Mercado.movimientosDe(s, club).fuera.push(a.id));
  Engine._fuerzas = {};
  // Se corre hasta que la red del arquero lo sostenga pasada la edad de
  // retiro: ahí está activo aunque le corresponda colgar los botines.
  let t = 1;
  for (; t <= 16; t++) {
    s.season.year = t; Engine._fuerzas = {};
    Engine.procesarRetiros(); Engine._fuerzas = {};
    const p = window.__en(club, masViejo.id);
    if (p && Engine.edadAlCierreDeTemporada(p, t - 1) > Engine.EDAD_DE_RETIRO) break;
  }
  // Y se fuerza el asiento a mano. B2-04 arregló que esto pase solo, así que
  // la única forma de probar que la poda NO mira `state.retirados` es
  // ponerlo ahí a propósito: si la regla lo usara como criterio, este
  // contrato se borraría.
  if (!(s.retirados || []).some((r) => r.id === masViejo.id)) {
    s.retirados.push({ id: masViejo.id, name: masViejo.name, pos: masViejo.pos, edad: 41, clubId: club, temporada: Math.max(1, t - 1) });
  }
  const anotado = (s.retirados || []).some((r) => r.id === masViejo.id);
  const activo = !!window.__en(club, masViejo.id);
  Mercado.firmar(s, masViejo.id, Mercado.contratoNuevo(Engine, masViejo, t, masViejo), t);
  const podados = Mercado.podarContratos(Engine);
  return {
    ok: activo && anotado && window.__tiene(masViejo.id),
    detalle: `${masViejo.name} en T${t}: anotado en retirados=${anotado}, activo en el plantel=${activo}`
      + ` · podados ${podados} · su contrato ${window.__tiene(masViejo.id) ? 'quedó' : 'SE BORRÓ'}`,
  };
});

await probar('Un contrato de alguien que ya no existe sí se borra', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const inventados = ['fantasma-r999', 'otrofantasma-g888', 'nadie-c777'];
  inventados.forEach((id) => Mercado.firmar(s, id, { contractYears: 3, salary: 100000, clause: undefined }, 1));
  const antes = Object.keys(s.contratos).length;
  const podados = Mercado.podarContratos(Engine);
  const quedan = inventados.filter((id) => window.__tiene(id));
  return {
    ok: !quedan.length && podados >= 3,
    detalle: `${antes} contratos antes · podados ${podados} · de los 3 inventados quedan ${quedan.length}`,
  };
});

await probar('Cerrar la temporada dos veces seguidas no rompe nada', () => {
  window.__carrera('boca');
  const s = Engine.state;
  s.season.year = 4; Engine._fuerzas = {};
  const a = Mercado.cerrarContratos(Engine);
  Engine._fuerzas = {};
  const b = Mercado.cerrarContratos(Engine);
  Engine._fuerzas = {};
  const c = Mercado.cerrarContratos(Engine);
  const sinArquero = s.clubs.filter((x) => {
    const pl = x.id === s.clubId ? s.squad : Mercado.plantel(Engine, x.id);
    return pl.length && !Engine.cuantosArqueros(pl);
  });
  return {
    ok: !sinArquero.length && Object.keys(s.contratos).length > 0,
    detalle: `tres cierres seguidos: ${a.renovados}/${b.renovados}/${c.renovados} renovaciones,`
      + ` ${a.contratosPodados}/${b.contratosPodados}/${c.contratosPodados} podados`
      + ` · ${Object.keys(s.contratos).length} contratos · clubes sin arquero: ${sinArquero.length}`,
  };
});

await probar('Guardar y cargar conserva exactamente los que sobrevivieron', () => {
  const s = Engine.state;
  const antes = JSON.stringify(s.contratos);
  Engine.save();
  const cargo = Engine.load();
  Engine._fuerzas = {};
  const despues = JSON.stringify(Engine.state.contratos);
  return {
    ok: cargo && antes === despues,
    detalle: `load()=${cargo} · ${Object.keys(JSON.parse(antes)).length} contratos`
      + ` · ${antes === despues ? 'idénticos' : 'DISTINTOS'}`,
  };
});

await probar(`Después de ${TEMPORADAS} temporadas los muertos no crecen sin freno`, (n) => {
  window.__carrera('aldosivi');
  const s = Engine.state;
  const filas = [];
  for (let t = 1; t <= n; t++) {
    s.season.year = t; Engine._fuerzas = {};
    Mercado.mercadoDeLosRivales(Engine); Engine._fuerzas = {};
    Mercado.liberarJugadores(Engine); Engine._fuerzas = {};
    Mercado.cerrarContratos(Engine); Engine._fuerzas = {};
    Engine.procesarRetiros(); Engine._fuerzas = {};
    if (t === 1 || t === Math.round(n / 2) || t === n) {
      filas.push({ t, contratos: Object.keys(s.contratos).length, muertos: window.__muertos().length });
    }
  }
  const ultimos = window.__muertos();
  window.__soakFilas = filas;
  return {
    ok: ultimos.length === 0,
    detalle: filas.map((f) => `T${f.t}: ${f.contratos} contratos / ${f.muertos} muertos`).join(' · ')
      + (ultimos.length ? ` — QUEDARON ${ultimos.length} muertos: ${ultimos.slice(0, 3).join(', ')}` : ''),
  };
}, TEMPORADAS);

console.log('\n--- MUNDO-02: la invalidación del caché del índice ---');

await probar('El índice muestra al jugador en su club, y después del pase en el nuevo', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const conEntrada = Object.keys(s.mundo).filter((c) => c !== s.clubId);
  const de = conEntrada[0]; const a = conEntrada[1];
  const j = Mercado.plantel(Engine, de)[0];
  const antes = window.__clubEnElIndice(j.id);
  Mercado.transferir(s, j, de, a, s.season.year, Engine);
  Engine._fuerzas = {};
  const despues = window.__clubEnElIndice(j.id);
  return {
    ok: antes === de && despues === a,
    detalle: `${j.name}: el índice lo mostraba en ${antes}, se transfiere a ${a}, ahora lo muestra en ${despues}`,
  };
});

await probar('Un segundo movimiento entre los mismos clubes tampoco repite la clave', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const clave = () => `${s.season.year}|${(s.mercado.fichados || []).length}`
    + `|${Object.values(s.mundo || {}).reduce((x, m) => x + m.fuera.length + m.dentro.length, 0)}`
    + `|${(s.libres || []).length}|${Object.keys(s.contratos || {}).length}`;
  const conEntrada = Object.keys(s.mundo).filter((c) => c !== s.clubId);
  const de = conEntrada[0]; const a = conEntrada[1];
  const claves = [clave()];
  const plantel = Mercado.plantel(Engine, de);
  [plantel[0], plantel[1]].forEach((j) => {
    Mercado.transferir(s, j, de, a, s.season.year, Engine);
    Engine._fuerzas = {};
    claves.push(clave());
  });
  return {
    ok: new Set(claves).size === claves.length,
    detalle: `tres claves distintas: ${claves.join('  ·  ')}`,
  };
});

await probar('Cadena A -> B -> C: el índice sigue al jugador', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const clubes = Object.keys(s.mundo).filter((c) => c !== s.clubId).slice(0, 3);
  const j = Mercado.plantel(Engine, clubes[0])[0];
  const traza = [window.__clubEnElIndice(j.id)];
  for (let i = 0; i < 2; i++) {
    const actual = Mercado.plantel(Engine, clubes[i]).find((p) => p.id === j.id) || j;
    Mercado.transferir(s, actual, clubes[i], clubes[i + 1], s.season.year, Engine);
    Engine._fuerzas = {};
    traza.push(window.__clubEnElIndice(j.id));
  }
  return {
    ok: traza[0] === clubes[0] && traza[1] === clubes[1] && traza[2] === clubes[2],
    detalle: `${j.name}: ${traza.join(' -> ')} (esperado ${clubes.join(' -> ')})`,
  };
});

await probar('Guardar y cargar deja el índice mostrando el club correcto', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const conEntrada = Object.keys(s.mundo).filter((c) => c !== s.clubId);
  const de = conEntrada[0]; const a = conEntrada[1];
  const j = Mercado.plantel(Engine, de)[0];
  Mercado.transferir(s, j, de, a, s.season.year, Engine);
  Engine._fuerzas = {};
  const antes = window.__clubEnElIndice(j.id);
  Engine.save();
  const cargo = Engine.load();
  Engine._fuerzas = {};
  const despues = window.__clubEnElIndice(j.id);
  return { ok: cargo && antes === a && despues === a, detalle: `load()=${cargo} · antes ${antes} · después ${despues} (esperado ${a})` };
});

await probar('No hay regresión en la búsqueda de jugadores libres', () => {
  window.__carrera('boca');
  const s = Engine.state;
  Mercado.liberarJugadores(Engine);
  Engine._fuerzas = {};
  const libres = Engine.jugadoresLibres();
  const porSituacion = Mercado.filtrar(Engine, { situacion: 'libre' });
  const todos = Mercado.filtrar(Engine, { situacion: 'todas' });
  return {
    ok: libres.length > 0 && todos.total > 0,
    detalle: `${libres.length} libres en la lista · el filtro "libre" da ${porSituacion.total}`
      + ` · el filtro "todas" da ${todos.total} jugadores`,
  };
});

console.log(`\n${pasaron}/${total.length} pruebas pasaron`);
if (erroresDePagina.length) console.log(`\nerrores de página: ${erroresDePagina.join(' | ')}`);
await navegador.close();
process.exit(pasaron === total.length ? 0 : 1);
