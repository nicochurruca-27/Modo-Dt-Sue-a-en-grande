// AUDITORÍA DE state.mundo — ¿hay historia viva o movimientos muertos?
//
//     npm install --no-save playwright
//     node tools/auditoria-mundo.mjs [temporadas]
//
// SOLO DIAGNÓSTICO. No modifica una línea del juego.
//
// ---------- Qué es state.mundo ----------
//
// Los planteles rivales no se guardan: Mercado.plantel() los reconstruye en
// cada llamada a partir de una semilla fija. `state.mundo` es la DIFERENCIA
// guardada contra esa semilla, un objeto por club:
//
//     state.mundo[clubId] = { fuera: [ids], dentro: [jugadores] }
//
// `fuera` es una LISTA DE EXCLUSIÓN: mientras un id esté ahí, el generador no
// lo devuelve. `dentro` son los jugadores completos que llegaron.
//
// ---------- Quién la consulta ----------
//
//   mercado.js:1087  plantel()            `seFue`: filtra las dos fuentes
//   mercado.js:1090  plantel()            concatena `dentro`
//   mercado.js:1114  plantel()            la red del arquero excluye `fuera`
//   mercado.js:1155  plantel()            los egresados excluyen `fuera`
//   engine.js:618    procesarRetiros 2a   saltea a los de plantel real que se fueron
//   engine.js:640    procesarRetiros 2b   recorre `dentro` para anotar retiros
//   mercado.js:1424  indice()             usa Object.keys(mundo).length en la clave
//
// Y quién escribe: liberarJugadores (616), cerrarContratos (822) y
// transferir (906, el único que escribe en `dentro`).

import path from 'node:path';
import { chromium } from 'playwright';

const TEMPORADAS = Number(process.argv[2] || 30);
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
    Engine.newGame(c || 'aldosivi');
    Engine.continueFromPresentation(0);
    Engine._fuerzas = {};
  };
  // Una temporada de mercado, sin el piloto automático: mucho más rápido y
  // ejercita igual a los tres que escriben en `mundo`.
  window.__temporada = (t) => {
    const s = Engine.state;
    s.season.year = t; Engine._fuerzas = {};
    Mercado.mercadoDeLosRivales(Engine); Engine._fuerzas = {};
    Mercado.liberarJugadores(Engine); Engine._fuerzas = {};
    Mercado.cerrarContratos(Engine); Engine._fuerzas = {};
    Engine.procesarRetiros(); Engine._fuerzas = {};
  };
  // El id dice de qué club ES el jugador: `clubId-rN`, `-gN`, `-cN`, `-j-...`
  // o `clubId-N` (tu plantel inicial).
  window.__esDeLaCasa = (clubId, id) => typeof id === 'string' && id.startsWith(clubId + '-');
  // Foto de todos los planteles del mundo, para comparar.
  window.__fotoDelMundo = () => {
    const s = Engine.state;
    Engine._fuerzas = {};
    return s.clubs.map((c) => {
      const pl = c.id === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, c.id);
      return `${c.id}:${pl.map((p) => p.id).sort().join(',')}`;
    }).join('\n');
  };
  window.__pesoDe = (x) => JSON.stringify(x || {}).length;
});

await page.evaluate(() => window.__carrera('aldosivi'));

// ---------------------------------------------------------------
L('\n================ AUDITORÍA DE state.mundo ================');
L('\n--- 1. LA ESTRUCTURA, CON UN EJEMPLO REAL ---');
L(await page.evaluate(() => {
  window.__temporada(1);
  const s = Engine.state;
  const club = Object.keys(s.mundo).find((k) => s.mundo[k].dentro.length) || Object.keys(s.mundo)[0];
  const m = s.mundo[club];
  return `  clubes con entrada: ${Object.keys(s.mundo).length}\n`
    + `  ejemplo (${club}):\n`
    + `    fuera  = ${JSON.stringify(m.fuera)}\n`
    + `    dentro = ${m.dentro.length ? JSON.stringify(m.dentro[0], null, 2).split('\n').map((l, i) => i ? '      ' + l : l).join('\n') : '[]'}`;
}));

// ---------------------------------------------------------------
L('\n--- 2. CÓMO CRECE, TEMPORADA POR TEMPORADA ---');
const crecimiento = await page.evaluate((n) => {
  const filas = [];
  const hitos = new Set([1, 5, 10, 15, 20, 25, 30, n]);
  // Partida nueva. OJO: hay que leer `Engine.state` DENTRO del bucle y no
  // capturarlo antes, porque `__carrera` crea un estado nuevo y la referencia
  // vieja queda apuntando a la partida descartada. La primera versión de esta
  // medición se comió justo eso y daba la misma cifra en las siete temporadas.
  window.__carrera('aldosivi');
  for (let t = 1; t <= n; t++) {
    window.__temporada(t);
    if (!hitos.has(t)) continue;
    const s = Engine.state;
    let fuera = 0; let dentro = 0;
    Object.values(s.mundo).forEach((m) => { fuera += m.fuera.length; dentro += m.dentro.length; });
    Engine.save();
    const save = localStorage.getItem('dt-simulador-save-v3') || '';
    filas.push({
      temporada: t,
      'clubes con entrada': Object.keys(s.mundo).length,
      'ids en fuera': fuera,
      'jugadores en dentro': dentro,
      'mundo (KB)': Math.round(window.__pesoDe(s.mundo) / 1024 * 10) / 10,
      'save entero (KB)': Math.round(save.length / 1024 * 10) / 10,
      '% del save': Math.round(window.__pesoDe(s.mundo) / Math.max(1, save.length) * 100) + '%',
      'retirados': (s.retirados || []).length,
      'contratos': Object.keys(s.contratos || {}).length,
    });
  }
  return filas;
}, TEMPORADAS);
console.table(crecimiento);

// ---------------------------------------------------------------
L('\n--- 3. QUÉ ENTRADAS SIGUEN VIVAS Y CUÁLES NO ---');
const clasificacion = await page.evaluate(() => {
  const s = Engine.state;
  const clases = {
    'fuera · bloquea a un jugador de la casa (NECESARIA)': 0,
    'fuera · de alguien que llegó y después se fue (par muerto)': 0,
    'fuera · sin contraparte, id ajeno (huérfana)': 0,
    'dentro · el jugador está hoy en el club (VIVA)': 0,
    'dentro · el jugador ya se fue del club (par muerto)': 0,
    'dentro · no está y tampoco figura en fuera': 0,
  };
  const ejemplos = {};
  const anotar = (k, v) => { clases[k]++; if (!ejemplos[k]) ejemplos[k] = v; };
  Object.entries(s.mundo).forEach(([clubId, m]) => {
    const enFuera = new Set(m.fuera);
    const plantel = clubId === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, clubId);
    const presentes = new Set(plantel.map((p) => p.id));
    const idsDentro = new Set(m.dentro.map((j) => j.id));
    m.fuera.forEach((id) => {
      if (window.__esDeLaCasa(clubId, id)) anotar('fuera · bloquea a un jugador de la casa (NECESARIA)', `${clubId}: ${id}`);
      else if (idsDentro.has(id)) anotar('fuera · de alguien que llegó y después se fue (par muerto)', `${clubId}: ${id}`);
      else anotar('fuera · sin contraparte, id ajeno (huérfana)', `${clubId}: ${id}`);
    });
    m.dentro.forEach((j) => {
      if (presentes.has(j.id)) anotar('dentro · el jugador está hoy en el club (VIVA)', `${clubId}: ${j.id}`);
      else if (enFuera.has(j.id)) anotar('dentro · el jugador ya se fue del club (par muerto)', `${clubId}: ${j.id}`);
      else anotar('dentro · no está y tampoco figura en fuera', `${clubId}: ${j.id}`);
    });
  });
  return Object.entries(clases).map(([k, v]) => ({ clase: k, cuántas: v, ejemplo: ejemplos[k] || '-' }));
});
console.table(clasificacion);

// ---------------------------------------------------------------
L('\n--- 4. "LLEGÓ Y NO ESTÁ": POR QUÉ, UNO POR UNO ---');
console.table(await page.evaluate(() => {
  const s = Engine.state;
  const porMotivo = {};
  const ejemplos = {};
  const retirados = new Set((s.retirados || []).map((r) => r.id));
  const libres = new Set((s.libres || []).map((j) => j.id));
  Object.entries(s.mundo).forEach(([clubId, m]) => {
    const enFuera = new Set(m.fuera);
    const plantel = clubId === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, clubId);
    const presentes = new Set(plantel.map((p) => p.id));
    m.dentro.forEach((j) => {
      if (presentes.has(j.id)) return;
      let motivo = 'SIN EXPLICACIÓN';
      if (enFuera.has(j.id)) motivo = 'después se fue del club (está en fuera)';
      else if (retirados.has(j.id)) motivo = 'se retiró';
      else if (libres.has(j.id)) motivo = 'quedó libre';
      else if ((s.squad || []).some((p) => p.id === j.id)) motivo = 'lo fichaste vos';
      else if (Engine.yaSeRetiro(Mercado.jugadorFichado(Engine, j, s.season.year))) motivo = 'se retiró (sin asiento)';
      porMotivo[motivo] = (porMotivo[motivo] || 0) + 1;
      if (!ejemplos[motivo]) ejemplos[motivo] = `${clubId}: ${j.id}`;
    });
  });
  return Object.entries(porMotivo).map(([k, v]) => ({ motivo: k, casos: v, ejemplo: ejemplos[k] }));
}));

// ---------------------------------------------------------------
L('\n--- 5. PRUEBA DE DEPENDENCIA: ¿qué pasa si se poda? ---');
L('    Se comparan los planteles de los 66 clubes antes y después.');
console.table(await page.evaluate(() => {
  const s = Engine.state;
  const original = JSON.parse(JSON.stringify(s.mundo));
  const antes = window.__fotoDelMundo();
  const resultados = [];

  const probarPoda = (nombre, podar) => {
    s.mundo = JSON.parse(JSON.stringify(original));
    const quitadas = podar(s.mundo);
    Engine._fuerzas = {};
    Mercado._indice = null;
    const despues = window.__fotoDelMundo();
    // En qué clubes cambió el plantel.
    const a = antes.split('\n'); const b = despues.split('\n');
    const distintos = a.filter((x, i) => x !== b[i]).length;
    resultados.push({
      poda: nombre,
      'entradas quitadas': quitadas,
      'clubes con el plantel cambiado': distintos,
      veredicto: distintos ? 'ROMPE' : 'seguro',
    });
    s.mundo = JSON.parse(JSON.stringify(original));
    Engine._fuerzas = {};
    Mercado._indice = null;
  };

  // (a) La poda propuesta: el par muerto (el que llegó y después se fue).
  probarPoda('par muerto: id que está en `dentro` y en `fuera` del mismo club', (mundo) => {
    let n = 0;
    Object.entries(mundo).forEach(([clubId, m]) => {
      const enFuera = new Set(m.fuera);
      const muertos = new Set(m.dentro.filter((j) => enFuera.has(j.id)).map((j) => j.id));
      m.dentro = m.dentro.filter((j) => !muertos.has(j.id));
      m.fuera = m.fuera.filter((id) => !muertos.has(id) || window.__esDeLaCasa(clubId, id));
      n += muertos.size * 2;
    });
    return n;
  });

  // (a2) La otra poda candidata, que es más grande: el `dentro` de alguien
  //      que ya se retiró Y ya quedó anotado en state.retirados. El asiento
  //      del retiro ya está hecho, así que la entrada no tendría más trabajo.
  probarPoda('`dentro` de jugadores ya anotados en state.retirados', (mundo) => {
    const retirados = new Set((s.retirados || []).map((r) => r.id));
    let n = 0;
    Object.values(mundo).forEach((m) => {
      const antesN = m.dentro.length;
      m.dentro = m.dentro.filter((j) => !retirados.has(j.id));
      n += antesN - m.dentro.length;
    });
    return n;
  });

  // (a3) Las dos juntas.
  probarPoda('las dos podas seguras juntas', (mundo) => {
    const retirados = new Set((s.retirados || []).map((r) => r.id));
    let n = 0;
    Object.entries(mundo).forEach(([clubId, m]) => {
      const enFuera = new Set(m.fuera);
      const muertos = new Set(m.dentro.filter((j) => enFuera.has(j.id)).map((j) => j.id));
      const antesD = m.dentro.length; const antesF = m.fuera.length;
      m.dentro = m.dentro.filter((j) => !muertos.has(j.id) && !retirados.has(j.id));
      m.fuera = m.fuera.filter((id) => !muertos.has(id) || window.__esDeLaCasa(clubId, id));
      n += (antesD - m.dentro.length) + (antesF - m.fuera.length);
    });
    return n;
  });

  // (b) Control negativo: borrar TODO `fuera`. Tiene que romper, y si no
  //     rompe es que la prueba no sirve.
  probarPoda('CONTROL: borrar todo `fuera`', (mundo) => {
    let n = 0;
    Object.values(mundo).forEach((m) => { n += m.fuera.length; m.fuera = []; });
    return n;
  });

  // (c) Control negativo: borrar todo `dentro`.
  probarPoda('CONTROL: borrar todo `dentro`', (mundo) => {
    let n = 0;
    Object.values(mundo).forEach((m) => { n += m.dentro.length; m.dentro = []; });
    return n;
  });

  // (d) Borrar solo las entradas `fuera` de ids ajenos al club.
  probarPoda('solo `fuera` de ids que no son de la casa', (mundo) => {
    let n = 0;
    Object.entries(mundo).forEach(([clubId, m]) => {
      const antesN = m.fuera.length;
      m.fuera = m.fuera.filter((id) => window.__esDeLaCasa(clubId, id));
      n += antesN - m.fuera.length;
    });
    return n;
  });

  return resultados;
}));

// ---------------------------------------------------------------
L('\n--- 6. CUÁNTO SE AHORRARÍA CON LA PODA SEGURA ---');
L(await page.evaluate(() => {
  const s = Engine.state;
  const antes = window.__pesoDe(s.mundo);
  const copia = JSON.parse(JSON.stringify(s.mundo));
  let pares = 0;
  Object.entries(copia).forEach(([clubId, m]) => {
    const enFuera = new Set(m.fuera);
    const muertos = new Set(m.dentro.filter((j) => enFuera.has(j.id)).map((j) => j.id));
    m.dentro = m.dentro.filter((j) => !muertos.has(j.id));
    m.fuera = m.fuera.filter((id) => !muertos.has(id) || window.__esDeLaCasa(clubId, id));
    pares += muertos.size;
  });
  const despues = window.__pesoDe(copia);
  return `  ${pares} pares muertos · mundo ${Math.round(antes / 1024 * 10) / 10} KB -> `
    + `${Math.round(despues / 1024 * 10) / 10} KB (${Math.round((1 - despues / antes) * 100)}% menos)`;
}));

// ---------------------------------------------------------------
L('\n--- 7. LA CLAVE DEL CACHÉ DEL ÍNDICE ---');
L(await page.evaluate(() => {
  const s = Engine.state;
  Mercado._indice = null;
  const clave = () => `${s.season.year}|${(s.mercado.fichados || []).length}`
    + `|${Object.keys(s.mundo || {}).length}|${(s.libres || []).length}`;
  const k1 = clave();
  const n1 = Mercado.indice(Engine).length;
  // Un pase entre dos clubes que YA tienen entrada en `mundo`.
  const conEntrada = Object.keys(s.mundo).filter((c) => c !== s.clubId);
  const de = conEntrada[0]; const a = conEntrada[1];
  const j = Mercado.plantel(Engine, de)[0];
  Mercado.transferir(s, j, de, a, s.season.year, Engine);
  Engine._fuerzas = {};
  const k2 = clave();
  const n2 = Mercado.indice(Engine).length;
  const filaDespues = Mercado.indice(Engine).find((x) => x.id === j.id);
  return `  se transfiere ${j.name} de ${de} a ${a}, los dos ya tenían entrada\n`
    + `  clave antes: ${k1}\n  clave después: ${k2}\n`
    + `  ¿cambió la clave?: ${k1 !== k2}\n`
    + `  el índice lo sigue mostrando en: ${filaDespues ? filaDespues.clubId : '(no está)'}`
    + ` (debería ser ${a})`;
}));

// ---------------------------------------------------------------
L('\n--- 8. DE PASO: QUIÉN HACE CRECER EL SAVE DE VERDAD ---');
console.table(await page.evaluate(() => {
  const s = Engine.state;
  const total = window.__pesoDe(s);
  const pedazos = ['mundo', 'contratos', 'retirados', 'noticias', 'squad', 'libres', 'historialPuntos', 'clubs', 'juveniles']
    .map((k) => ({
      clave: k,
      'KB': Math.round(window.__pesoDe(s[k]) / 1024 * 10) / 10,
      '% del save': Math.round(window.__pesoDe(s[k]) / total * 100) + '%',
      entradas: Array.isArray(s[k]) ? s[k].length : (s[k] ? Object.keys(s[k]).length : 0),
    }))
    .sort((a, b) => b.KB - a.KB);
  return pedazos;
}));

L('\n--- 9. ¿state.contratos también acumula entradas muertas? ---');
L(await page.evaluate(() => {
  const s = Engine.state;
  const vivos = new Set();
  s.clubs.forEach((c) => {
    const pl = c.id === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, c.id);
    pl.forEach((p) => vivos.add(p.id));
  });
  (s.libres || []).forEach((j) => vivos.add(j.id));
  (s.cedidos || []).forEach((c) => vivos.add(c.jugador.id));
  const ids = Object.keys(s.contratos || {});
  const muertos = ids.filter((id) => !vivos.has(id));
  return `  ${ids.length} contratos guardados · ${vivos.size} jugadores que existen hoy\n`
    + `  contratos de alguien que ya no existe en ningún lado: ${muertos.length}`
    + ` (${Math.round(muertos.length / Math.max(1, ids.length) * 100)}%)\n`
    + `  ejemplo: ${muertos.slice(0, 3).join(', ') || 'ninguno'}`;
}));

L('\n--- ERRORES DE PÁGINA ---');
L(erroresDePagina.length ? '  ' + erroresDePagina.join('\n  ') : '  ninguno');
L('\n==========================================================');
await navegador.close();
