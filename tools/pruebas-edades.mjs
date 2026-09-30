// Pruebas de la fecha de nacimiento, la edad, el cumpleaños y el retiro.
//
//     npm install --no-save playwright
//     node tools/pruebas-edades.mjs
//
// Corren contra el juego de verdad, en un Chromium sin ventana: se abre
// index.html, se arranca una carrera y se le pregunta al motor. No hay
// mocks — si una prueba pasa acá, pasa jugando.

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
await page.waitForFunction(() => typeof Engine !== 'undefined');

// Arranca una carrera limpia y deja el juego listo para preguntarle cosas.
await page.evaluate(() => {
  window.__carrera = (clubId) => {
    Engine.createDT('Nico', 'ARG', 'equilibrado');
    Engine.newGame(clubId || 'boca');
    Engine.continueFromPresentation(0);
  };
  // Mueve el almanaque a un día concreto de la temporada en curso.
  window.__irAlDia = (dayCount) => {
    Engine.state.calendar.dayCount = dayCount;
    Engine.refrescarEdades();
    return Engine.fechaDelJuego();
  };
  // El dayCount de una fecha del almanaque (mes 0-11).
  window.__diaDe = (dia, mes) => {
    let total = 0;
    for (let m = 0; m < mes; m++) total += DAYS_IN_MONTH[m];
    return total + dia - CALENDAR_START_DAY;
  };
});

const pruebas = [];
const probar = async (nombre, fn) => {
  try {
    const r = await page.evaluate(fn);
    const ok = r === true || (r && r.ok);
    pruebas.push({ nombre, ok, detalle: r && r.detalle ? r.detalle : '' });
  } catch (e) {
    pruebas.push({ nombre, ok: false, detalle: String(e).split('\n')[0] });
  }
};

// ---------- 1, 2 y 3: el cumpleaños ----------

await probar('1. Con el cumpleaños por delante, la edad todavía no sube', () => {
  window.__carrera('platense'); // club sin plantel real: sus jugadores tienen fecha de nacimiento
  const j = Engine.state.squad.find((p) => p.birthDate);
  const [, mes, dia] = j.birthDate.split('-').map(Number);
  // Un día antes del cumpleaños
  window.__irAlDia(window.__diaDe(dia, mes - 1) - 1);
  const antes = Engine.edadDe(j);
  window.__irAlDia(window.__diaDe(dia, mes - 1));
  const elDia = Engine.edadDe(j);
  return { ok: elDia === antes + 1, detalle: `${j.name} (${j.birthDate}): la víspera ${antes}, el día ${elDia}` };
});

await probar('2. El día exacto del cumpleaños sube exactamente 1', () => {
  const j = Engine.state.squad.find((p) => p.birthDate);
  const [, mes, dia] = j.birthDate.split('-').map(Number);
  window.__irAlDia(window.__diaDe(dia, mes - 1) - 1);
  const antes = Engine.edadDe(j);
  window.__irAlDia(window.__diaDe(dia, mes - 1));
  const hoy = Engine.edadDe(j);
  return { ok: hoy - antes === 1, detalle: `${antes} -> ${hoy}` };
});

await probar('3. Después del cumpleaños se queda con la edad nueva', () => {
  const j = Engine.state.squad.find((p) => p.birthDate);
  const [, mes, dia] = j.birthDate.split('-').map(Number);
  window.__irAlDia(window.__diaDe(dia, mes - 1));
  const elDia = Engine.edadDe(j);
  window.__irAlDia(window.__diaDe(dia, mes - 1) + 20);
  const despues = Engine.edadDe(j);
  return { ok: despues === elDia, detalle: `el día ${elDia}, veinte días después ${despues}` };
});

// ---------- 4 y 5: el cambio de temporada ----------

await probar('4. Al cambiar de temporada la fecha de nacimiento no se toca', () => {
  window.__carrera('platense');
  const antes = Engine.state.squad.map((p) => `${p.id}:${p.birthDate}`).join('|');
  Engine.state.season.year += 1;
  Engine.refrescarEdades();
  const despues = Engine.state.squad.map((p) => `${p.id}:${p.birthDate}`).join('|');
  return { ok: antes === despues, detalle: antes === despues ? 'idénticas' : 'CAMBIARON' };
});

await probar('5. Al cambiar de temporada la edad no sube por p.age++', () => {
  window.__carrera('platense');
  const j = Engine.state.squad.find((p) => p.birthDate);
  const [anio, mes, dia] = j.birthDate.split('-').map(Number);
  // Parados ANTES de su cumpleaños: pasar de temporada mueve el año del
  // almanaque, así que la edad sube 1 y ni uno más.
  window.__irAlDia(window.__diaDe(dia, mes - 1) - 1);
  const antes = Engine.edadDe(j);
  Engine.state.season.year += 1;
  Engine.refrescarEdades();
  const despues = Engine.edadDe(j);
  return {
    ok: despues === antes + 1 && j.age === despues,
    detalle: `${antes} -> ${despues} (p.age quedó en ${j.age}); nació el ${j.birthDate}`,
  };
});

// ---------- 6, 7 y 8: el retiro y el no-reemplazo ----------

await probar('6. Un jugador que pasa la edad se retira y sale del plantel', () => {
  window.__carrera('boca');
  const j = Engine.state.squad[0];
  const hoy = Engine.fechaDelJuego();
  j.birthDate = `${hoy.anio - 41}-01-01`; // 41 años
  Engine.refrescarEdades();
  const antes = Engine.state.squad.length;
  const avisos = Engine.procesarRetiros();
  const sigue = Engine.state.squad.some((p) => p.id === j.id);
  return {
    ok: !sigue && Engine.state.squad.length === antes - 1 && avisos.length === 1,
    detalle: `${j.name}: ${antes} -> ${Engine.state.squad.length} jugadores, ${avisos.length} aviso(s)`,
  };
});

await probar('7. Al retirarse NO aparece ningún jugador de reemplazo', () => {
  window.__carrera('boca');
  const idsAntes = new Set(Engine.state.squad.map((p) => p.id));
  const hoy = Engine.fechaDelJuego();
  Engine.state.squad.slice(0, 3).forEach((p) => { p.birthDate = `${hoy.anio - 41}-01-01`; });
  Engine.refrescarEdades();
  Engine.procesarRetiros();
  const nuevos = Engine.state.squad.filter((p) => !idsAntes.has(p.id));
  return {
    ok: nuevos.length === 0 && Engine.state.squad.length === idsAntes.size - 3,
    detalle: `quedaron ${Engine.state.squad.length} de ${idsAntes.size}, jugadores nuevos: ${nuevos.length}`,
  };
});

// Antes, esta prueba fijaba que un club con plantel real PODÍA quedar por
// debajo del mínimo: no había de dónde reponer y en la temporada 16 Boca
// tenía 13 jugadores. Las inferiores dieron vuelta eso a propósito. Lo que se
// sigue fijando, que es lo importante, es que la reposición venga de la
// cantera del club y NO del relleno genérico.
await probar('8. Un club con plantel real repone con SU cantera, no con relleno', () => {
  window.__carrera('platense');
  // Quince temporadas más adelante: a Boca se le retiró medio plantel.
  Engine.state.season.year = 16;
  Engine._fuerzas = {};
  const boca = Mercado.plantel(Engine, 'boca');
  const canteranos = boca.filter((p) => p.deLaCantera).length;
  const relleno = boca.filter((p) => /-c\d/.test(p.id)).length;
  return {
    ok: boca.length >= Juveniles.pisoDe('boca') && canteranos > 0 && relleno === 0,
    detalle: `Boca ${boca.length} jugadores (piso ${Juveniles.pisoDe('boca')}): ${canteranos} de la cantera, ${relleno} de relleno genérico`,
  };
});

await probar('9. Un club sin plantel real sigue completando su plantel', () => {
  Engine.state.season.year = 16;
  Engine._fuerzas = {};
  const t = Mercado.plantel(Engine, 'ferro');
  const rellenados = t.filter((p) => /-c\d/.test(p.id)).length;
  return { ok: t.length >= 22, detalle: `${t.length} jugadores, ${rellenados} venidos del relleno` };
});

// ---------- 10 y 11: la fecha viaja con el jugador ----------

await probar('10. Un jugador transferido conserva su fecha de nacimiento', () => {
  window.__carrera('platense');
  const j = Mercado.plantel(Engine, 'ferro').find((p) => p.birthDate);
  const antes = j.birthDate;
  Mercado.transferir(Engine.state, j, 'ferro', 'lanus', Engine.state.season.year);
  Engine._fuerzas = {};
  const enLanus = Mercado.plantel(Engine, 'lanus').find((p) => p.id === j.id);
  return {
    ok: !!enLanus && enLanus.birthDate === antes,
    detalle: enLanus ? `${j.name}: ${antes} -> ${enLanus.birthDate}` : 'no llegó al club nuevo',
  };
});

await probar('11. Un jugador cedido vuelve con su fecha de nacimiento', () => {
  window.__carrera('platense');
  const j = Engine.state.squad.find((p) => p.birthDate);
  const antes = j.birthDate;
  Engine.cederJugador({ playerId: j.id, club: { id: 'lanus', nombre: 'Lanús' }, ventanas: 1, modalidad: 'simple' });
  const estaCedido = !Engine.state.squad.some((p) => p.id === j.id)
    && Engine.state.cedidos.some((c) => c.jugador.id === j.id);
  Engine.revisarPrestamos();
  const vuelto = Engine.state.squad.find((p) => p.id === j.id);
  return {
    ok: estaCedido && !!vuelto && vuelto.birthDate === antes,
    detalle: vuelto ? `${j.name}: ${antes} -> ${vuelto.birthDate}` : 'no volvió del préstamo',
  };
});

await probar('12. Un jugador generado tiene fecha de nacimiento', () => {
  window.__carrera('platense');
  const propios = Engine.state.squad;
  const rivales = Mercado.plantel(Engine, 'talleres');
  const sinFecha = propios.concat(rivales).filter((p) => !p.birthDate);
  return {
    ok: sinFecha.length === 0,
    detalle: `${propios.length + rivales.length} jugadores generados, ${sinFecha.length} sin fecha`,
  };
});

// ---------- 13 y 14: el aviso ----------

await probar('13. El retiro genera una sola noticia', () => {
  window.__carrera('boca');
  const hoy = Engine.fechaDelJuego();
  const j = Engine.state.squad[0];
  j.birthDate = `${hoy.anio - 41}-01-01`;
  Engine.refrescarEdades();
  Engine.procesarRetiros();
  const noticias = (Engine.state.noticias || []).filter((n) => n.cat === 'retiros' && n.titular.includes(j.name));
  return { ok: noticias.length === 1, detalle: `${noticias.length} noticia(s): "${noticias[0] ? noticias[0].titular : '—'}"` };
});

await probar('14. Al recargar la partida la noticia no se duplica', () => {
  const antes = (Engine.state.noticias || []).filter((n) => n.cat === 'retiros').length;
  const retiradosAntes = (Engine.state.retirados || []).length;
  Engine.save();
  Engine.load();
  // Y se vuelve a dibujar la pantalla, que es lo que hace el juego al volver.
  if (typeof render === 'function') { pantallaDeInicio = false; render(); }
  const despues = (Engine.state.noticias || []).filter((n) => n.cat === 'retiros').length;
  return {
    ok: despues === antes && (Engine.state.retirados || []).length === retiradosAntes,
    detalle: `${antes} noticia(s) antes de guardar, ${despues} después de cargar`,
  };
});

// ---------- 15 a 18: el veterano juega su última temporada ----------
//
// Los planteles reales arrancan con jugadores pasados de la edad de retiro
// (José Sosa, 40, en Estudiantes; Insaurralde, 41, en Sarmiento). La regla es
// que esos juegan la temporada 1 entera y cuelgan los botines al cerrarla,
// igual que cualquiera que llegue a los 40 en el medio. Antes desaparecían
// antes del primer partido, y peor: desaparecían solo si NO dirigías su club.

await probar('15. El veterano de más de 40 arranca adentro del plantel', () => {
  window.__carrera('estudianteslp');
  const viejos = Engine.state.squad.filter((p) => Engine.edadDe(p) > Engine.EDAD_DE_RETIRO);
  return {
    ok: viejos.some((p) => p.name === 'José Sosa'),
    detalle: viejos.map((p) => `${p.name} (${Engine.edadDe(p)})`).join(', ') || 'ninguno',
  };
});

await probar('16. El mismo veterano existe igual si es tu rival', () => {
  window.__carrera('boca');
  Engine._fuerzas = {};
  const rival = Mercado.plantel(Engine, 'estudianteslp');
  const propio = (() => {
    window.__carrera('estudianteslp');
    const n = Engine.state.squad.length;
    window.__carrera('boca');
    Engine._fuerzas = {};
    return n;
  })();
  return {
    ok: rival.length === propio && rival.some((p) => p.name === 'José Sosa'),
    detalle: `${propio} dirigiéndolo vos, ${rival.length} como rival`,
  };
});

await probar('17. Al cerrar la temporada se retira, y el diario lo cuenta', () => {
  window.__carrera('estudianteslp');
  const antes = Engine.state.squad.length;
  const avisos = Engine.procesarRetiros();
  const sigue = Engine.state.squad.some((p) => p.name === 'José Sosa');
  // Y los de los otros clubes también quedan anotados, aunque arranquen con
  // 41: antes solo se avisaba del que cumplía 40 justo ese año.
  const deOtros = Engine.state.retirados.filter((r) => r.clubId !== 'estudianteslp');
  return {
    ok: !sigue && Engine.state.squad.length < antes && avisos.length >= 1
      && deOtros.some((r) => r.name === 'Juan Manuel Insaurralde'),
    detalle: `${antes} -> ${Engine.state.squad.length}; ${avisos.length} aviso(s) propios, ${deOtros.length} de otros clubes`,
  };
});

await probar('18. En la temporada 2 ya no está, y no se lo cuenta dos veces', () => {
  window.__carrera('estudianteslp');
  Engine.procesarRetiros();
  Engine.state.season.year = 2;
  Engine._fuerzas = {};
  const enSarmiento = Mercado.plantel(Engine, 'sarmientojunin')
    .filter((p) => p.name === 'Juan Manuel Insaurralde').length;
  Engine.procesarRetiros();
  const veces = Engine.state.retirados.filter((r) => r.name === 'Juan Manuel Insaurralde').length;
  return {
    ok: enSarmiento === 0 && veces === 1,
    detalle: `sigue en el plantel: ${enSarmiento} · anotado ${veces} vez/veces en retirados`,
  };
});

// ---------- El informe ----------
console.log('\nPRUEBAS DE EDAD, CUMPLEAÑOS Y RETIRO\n');
pruebas.forEach((p) => {
  console.log(`  ${p.ok ? '✓' : '✗'} ${p.nombre}`);
  if (p.detalle) console.log(`      ${p.detalle}`);
});
const fallaron = pruebas.filter((p) => !p.ok);
console.log(`\n${pruebas.length - fallaron.length}/${pruebas.length} pruebas pasaron`);
if (errores.length) console.log('errores de la página:', errores);
await navegador.close();
process.exit(fallaron.length || errores.length ? 1 : 0);
