// Pruebas de regresión del guardado, tal como funciona HOY.
//
//     npm install --no-save playwright
//     node tools/pruebas-guardado.mjs
//
// Esto es la red de seguridad del Bloque 0 del rediseño hacia cuentas de
// usuario y varias carreras. No prueba nada nuevo: fija por escrito lo que el
// juego hace ahora, para que cada bloque que venga después se pueda comprobar
// contra algo en vez de contra la memoria.
//
// Corren contra el juego de verdad, en un Chromium sin ventana: se abre
// index.html y se le pregunta al motor. No hay mocks.
//
// Playwright NO es una dependencia del proyecto: se instala con --no-save
// para correr esto y después se borra. El juego sigue sin dependencias.
//
// ---------- Ojo con dos pruebas ----------
//
// La 15 y la 16 dejan anotado un comportamiento que hoy es correcto y que el
// Bloque 2 va a cambiar a propósito: las variables de vista de ui.js NO se
// reinician al terminar una carrera. Hoy no molesta porque nunca se cambia de
// carrera. Cuando el Bloque 2 agregue reiniciarLaVista(), esas dos pruebas
// tienen que darse vuelta, y eso es la señal de que el bloque funcionó.

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = 'file://' + path.join(raiz, 'index.html');
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navegador.newPage();
const errores = [];
// Algunas pruebas rompen la partida a propósito y el juego avisa por consola,
// que es justo lo que se está comprobando. Esos avisos se dejan pasar; los
// demás cuentan como falla.
const avisosEsperados = ['La partida guardada está rota'];
const esperado = (texto) => avisosEsperados.some((a) => texto.includes(a));
page.on('pageerror', (e) => { if (!esperado(String(e))) errores.push(String(e)); });
page.on('console', (m) => { if (m.type() === 'error' && !esperado(m.text())) errores.push('console: ' + m.text()); });

const abrir = async () => {
  await page.goto(url);
  await page.waitForFunction(() => typeof Engine !== 'undefined');
  await page.evaluate(() => {
    // Arranca una carrera limpia.
    window.__carrera = (clubId) => {
      Engine.createDT('Nico', 'ARG', 'equilibrado');
      Engine.newGame(clubId || 'boca');
      Engine.continueFromPresentation(0);
    };
    // Avanza días del almanaque sin trabarse en las pantallas que piden
    // una decisión: lo que importa acá es mover la carrera, no jugarla bien.
    window.__avanzar = (dias) => {
      for (let i = 0; i < dias; i++) {
        try { Engine.avanzarUnDia(); } catch (e) { break; }
        if (Engine.state.screen !== 'calendar') Engine.state.screen = 'calendar';
      }
      return Engine.state.calendar.dayCount;
    };
    // La huella de una carrera: el estado entero, en texto.
    window.__huella = () => JSON.stringify(Engine.state);
  });
};

await abrir();

const pruebas = [];
const probar = async (nombre, fn, arg) => {
  try {
    const r = await page.evaluate(fn, arg);
    pruebas.push({ nombre, ok: r === true || !!(r && r.ok), detalle: (r && r.detalle) || '' });
  } catch (e) {
    pruebas.push({ nombre, ok: false, detalle: String(e).split('\n')[0] });
  }
};
// Para las que necesitan recargar la página, que eso pasa del lado de node.
const probarConRecarga = async (nombre, fn) => {
  try {
    const r = await fn();
    pruebas.push({ nombre, ok: r === true || !!(r && r.ok), detalle: (r && r.detalle) || '' });
  } catch (e) {
    pruebas.push({ nombre, ok: false, detalle: String(e).split('\n')[0] });
  }
};

// ---------- El ciclo básico: crear, guardar, recargar, seguir ----------

await probar('1. Crear una carrera deja un estado completo', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const claves = Object.keys(s).length;
  const faltan = ['clubId', 'squad', 'season', 'calendar', 'clubs', 'dt', 'budget']
    .filter((k) => s[k] === undefined || s[k] === null);
  return {
    ok: s.clubId === 'boca' && s.squad.length > 0 && !!s.season && faltan.length === 0,
    detalle: `${claves} claves de primer nivel, ${s.squad.length} jugadores, club ${s.clubId}${faltan.length ? `, FALTAN: ${faltan}` : ''}`,
  };
});

await probar('2. Guardar escribe la partida en su clave y es JSON válido', () => {
  const ok = Engine.save();
  const crudo = localStorage.getItem('dt-simulador-save-v3');
  let parseado = null;
  try { parseado = JSON.parse(crudo); } catch (e) { /* queda en null */ }
  return {
    ok: ok === true && !!crudo && !!parseado && parseado.clubId === 'boca',
    detalle: `${Math.round((crudo || '').length / 1024)} KB bajo 'dt-simulador-save-v3'`,
  };
});

await probarConRecarga('3. Al recargar la página vuelve la misma carrera', async () => {
  const antes = await page.evaluate(() => {
    window.__avanzar(40);
    Engine.save();
    return { dia: Engine.state.calendar.dayCount, club: Engine.state.clubId, huella: window.__huella() };
  });
  await abrir(); // recarga de verdad: vuelve a correr init()
  const despues = await page.evaluate(() => ({
    dia: Engine.state.calendar.dayCount,
    club: Engine.state.clubId,
    huella: JSON.stringify(Engine.state),
  }));
  return {
    ok: despues.dia === antes.dia && despues.club === antes.club,
    detalle: `día ${antes.dia} → día ${despues.dia}, club ${despues.club}`,
    huellas: { antes: antes.huella, despues: despues.huella },
  };
});

await probar('4. Después de recargar se puede seguir jugando desde donde estaba', () => {
  const antes = Engine.state.calendar.dayCount;
  const despues = window.__avanzar(10);
  return {
    ok: despues > antes && Engine.state.clubId === 'boca',
    detalle: `siguió del día ${antes} al ${despues}`,
  };
});

await probarConRecarga('5. El estado sobrevive entero al guardar y cargar', async () => {
  const r = await page.evaluate(() => {
    Engine.save();
    const antes = window.__huella();
    Engine.state = null;          // se tira el estado vivo
    const cargo = Engine.load();  // y se recupera solo del guardado
    const despues = JSON.stringify(Engine.state);
    return { cargo, iguales: antes === despues, largo: antes.length };
  });
  return {
    ok: r.cargo === true && r.iguales,
    detalle: r.iguales ? `${Math.round(r.largo / 1024)} KB idénticos byte a byte` : 'el estado cambió al ida y vuelta',
  };
});

// ---------- Lo que la arquitectura nueva se va a apoyar encima ----------

await probar('6. El estado es JSON puro: se puede mandar a un servidor tal cual', () => {
  const s = Engine.state;
  const texto = JSON.stringify(s);
  const vueltaYVuelta = JSON.stringify(JSON.parse(texto));
  // Y además: que no haya Date, funciones ni undefined escondidos.
  const raros = [];
  const mirar = (v, camino, hondo) => {
    if (hondo > 8 || raros.length > 5) return;
    if (v instanceof Date) { raros.push(`${camino}: Date`); return; }
    if (typeof v === 'function') { raros.push(`${camino}: función`); return; }
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) mirar(v[k], `${camino}.${k}`, hondo + 1);
    }
  };
  mirar(s, 'state', 0);
  return {
    ok: texto === vueltaYVuelta && raros.length === 0,
    detalle: raros.length ? `encontrado: ${raros.join(', ')}` : 'sin Date, sin funciones, sin pérdidas al serializar',
  };
});

await probar('7. El guardado se basta solo: no depende de nada de la sesión anterior', () => {
  // Las tres partes que se calculan aparte y podrían no estar guardadas.
  const s = Engine.state;
  const claves = ['mundo', 'copasInter', 'ultimasCopas', 'season', 'historialPuntos'];
  const guardado = JSON.parse(localStorage.getItem('dt-simulador-save-v3'));
  const faltan = claves.filter((k) => guardado[k] === undefined);
  const distintas = claves.filter((k) => JSON.stringify(guardado[k]) !== JSON.stringify(s[k]));
  return {
    ok: faltan.length === 0 && distintas.length === 0,
    detalle: faltan.length ? `no se guardan: ${faltan}` : `${claves.length} partes calculadas, todas guardadas`,
  };
});

await probar('8. El juego usa dos claves de almacenamiento y ninguna más', () => {
  Sonido.alternar(); // fuerza a que la clave del sonido exista
  const claves = Object.keys(localStorage).sort();
  const esperadas = ['dt-simulador-save-v3', 'dt-sonido'];
  return {
    ok: claves.length === esperadas.length && claves.every((c, i) => c === esperadas[i]),
    detalle: claves.join(', '),
  };
});

await probar('9. Cuánto pesa una carrera (línea base para varias)', () => {
  const kb = Math.round(localStorage.getItem('dt-simulador-save-v3').length / 1024);
  const partes = Object.keys(Engine.state)
    .map((k) => [k, Math.round(JSON.stringify(Engine.state[k]).length / 1024)])
    .filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, v]) => `${k} ${v}KB`);
  // El límite del navegador ronda los 5 MB: tres carreras tienen que entrar
  // con muchísimo aire. Si esto llegara a fallar, el plan cambia.
  return { ok: kb > 0 && kb * 3 < 2000, detalle: `${kb} KB (×3 carreras = ${kb * 3} KB) · ${partes.join(', ')}` };
});

// ---------- Los bordes ----------

await probar('10. Terminar la carrera borra la partida y deja el juego listo para otra', () => {
  Engine.resetGame();
  return {
    ok: localStorage.getItem('dt-simulador-save-v3') === null && Engine.state.screen === 'dt-create',
    detalle: `clave borrada, pantalla '${Engine.state.screen}'`,
  };
});

await probar('11. Borrar la partida no toca la configuración del aparato', () => {
  const antes = localStorage.getItem('dt-sonido');
  window.__carrera('river');
  Engine.save();
  Engine.resetGame();
  const despues = localStorage.getItem('dt-sonido');
  return { ok: antes === despues && despues !== null, detalle: `'dt-sonido' quedó en ${despues}` };
});

await probar('12. Una partida corrupta no rompe el arranque', () => {
  localStorage.setItem('dt-simulador-save-v3', '{esto no es json');
  const cargo = Engine.load();
  return { ok: cargo === false, detalle: 'load() devolvió false en vez de tirar una excepción' };
});

await probar('13. Una partida de una versión más nueva se rechaza', () => {
  localStorage.setItem('dt-simulador-save-v3', JSON.stringify({ screen: 'calendar', version: 99 }));
  const cargo = Engine.load();
  return { ok: cargo === false, detalle: 'load() devolvió false' };
});

await probar('14. Un JSON que no es una partida se rechaza', () => {
  localStorage.setItem('dt-simulador-save-v3', JSON.stringify({ cualquier: 'cosa' }));
  const cargo = Engine.load();
  localStorage.removeItem('dt-simulador-save-v3');
  return { ok: cargo === false, detalle: 'load() devolvió false' };
});

// ---------- Lo que el Bloque 2 va a dar vuelta ----------

await probar('15. HOY: el estado de la vista NO se reinicia al terminar una carrera', () => {
  window.__carrera('boca');
  selectedPlayerId = Engine.state.squad[0].id;
  mercadoClubId = 'river';
  noticiaFiltro = 'retiros';
  juvenilSeleccionado = Juveniles.camada(Engine, 'boca')[0].id;
  Engine.resetGame();
  const quedaron = [
    selectedPlayerId !== null && 'selectedPlayerId',
    mercadoClubId !== null && 'mercadoClubId',
    noticiaFiltro !== 'todas' && 'noticiaFiltro',
    juvenilSeleccionado !== null && 'juvenilSeleccionado',
  ].filter(Boolean);
  // Hoy esto es correcto (no hay cambio de carrera). El Bloque 2 lo invierte.
  return {
    ok: quedaron.length === 4,
    detalle: `sobreviven: ${quedaron.join(', ')} — el Bloque 2 tiene que dejar esta lista vacía`,
  };
});

await probar('16. Dibujar la pantalla apaga los tres temporizadores', () => {
  window.__carrera('boca');
  pantallaDeInicio = false;
  render();
  const prendidos = [
    relojDelPartido !== null && 'relojDelPartido',
    relojDelAlmanaque !== null && 'relojDelAlmanaque',
    noticiaCarruselTimer !== null && 'noticiaCarruselTimer',
  ].filter(Boolean);
  return {
    ok: prendidos.length === 0,
    detalle: prendidos.length ? `quedaron prendidos: ${prendidos.join(', ')}` : 'los tres apagados antes de dibujar',
  };
});

// ---------- El generador sembrado ----------

await probar('17. Dos carreras con el mismo club generan el mismo plantel rival', () => {
  window.__carrera('boca');
  const a = Mercado.plantel(Engine, 'platense').map((j) => `${j.id}:${j.name}:${j.rating}`).join('|');
  Engine.resetGame();
  window.__carrera('river');
  const b = Mercado.plantel(Engine, 'platense').map((j) => `${j.id}:${j.name}:${j.rating}`).join('|');
  return {
    ok: a === b && a.length > 0,
    detalle: a === b ? 'el generador sembrado es determinista' : 'dos carreras dan planteles distintos para el mismo club',
  };
});

await probar('18. El once titular y el plantel guardan la relación entre sí', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const ids = new Set(s.squad.map((p) => p.id));
  const huerfanos = s.startingSlots.filter((c) => c.playerId && !ids.has(c.playerId));
  const repetidos = s.squad.length - ids.size;
  Engine.save();
  Engine.state = null;
  Engine.load();
  const ids2 = new Set(Engine.state.squad.map((p) => p.id));
  const huerfanos2 = Engine.state.startingSlots.filter((c) => c.playerId && !ids2.has(c.playerId));
  return {
    ok: huerfanos.length === 0 && repetidos === 0 && huerfanos2.length === 0,
    detalle: `${s.squad.length} jugadores, ${s.startingSlots.length} casilleros, 0 ids repetidos, 0 huérfanos antes y después de cargar`,
  };
});

// ---------- El informe ----------
console.log('\nPRUEBAS DE REGRESIÓN DEL GUARDADO (Bloque 0)\n');
pruebas.forEach((p) => {
  console.log(`  ${p.ok ? '✓' : '✗'} ${p.nombre}`);
  if (p.detalle) console.log(`      ${p.detalle}`);
});
const fallaron = pruebas.filter((p) => !p.ok);
console.log(`\n${pruebas.length - fallaron.length}/${pruebas.length} pruebas pasaron`);
if (errores.length) console.log('errores de la página:', errores);
await navegador.close();
process.exit(fallaron.length || errores.length ? 1 : 0);
