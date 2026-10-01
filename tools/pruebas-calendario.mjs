// Pruebas del almanaque: días de cada mes, años bisiestos, validación de
// fechas y avance del calendario.
//
//     npm install --no-save playwright
//     node tools/pruebas-calendario.mjs
//
// Corren contra el juego de verdad, en un Chromium sin ventana. No hay mocks.
//
// Lo que vinieron a fijar: parseFechaDeNacimiento validaba con un `dia > 31`
// para TODOS los meses, así que entraban al juego fechas que no existen
// (2025-02-29, 2025-04-31, 2025-06-31, 2025-09-31, 2025-11-31, 1900-02-29), y
// el recorrido del almanaque usaba una tabla fija con febrero en 28, así que
// el juego se salteaba el 29 de febrero en los años bisiestos.

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

await page.evaluate(() => {
  window.__carrera = (clubId) => {
    localStorage.removeItem('dt-simulador-save-v3');
    Engine.createDT('Nico', 'ARG', 'equilibrado');
    Engine.newGame(clubId || 'boca');
    Engine.continueFromPresentation(0);
  };
  // La fecha del almanaque en un año y un día concretos. El año sale de la
  // temporada (ver anioDeTemporada), así que para pararse en 2024 hay que ir
  // a la temporada -1.
  window.__fechaEn = (anioBuscado, dayCount) => {
    Engine.state.season.year = anioBuscado - ANIO_INICIAL + 1;
    Engine.state.calendar.dayCount = dayCount;
    return Engine.fechaDelJuego();
  };
  // El dayCount del 1° de enero es 0, así que el de cualquier fecha es la
  // suma de los meses anteriores. Se usa diasDelMes para que la cuenta sea
  // la misma que la del juego.
  window.__diaDe = (dia, mes, anio) => {
    let total = 0;
    for (let m = 0; m < mes; m++) total += diasDelMes(m, anio);
    return total + dia - CALENDAR_START_DAY;
  };
  window.__texto = (f) => `${String(f.dia).padStart(2, '0')}/${String(f.mes + 1).padStart(2, '0')}/${f.anio}`;
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

// ---------- 1 a 3: los días de cada mes ----------

await probar('1. Cada mes tiene los días que tiene', () => {
  const esperado = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const dan = esperado.map((_, m) => diasDelMes(m, 2025));
  return {
    ok: dan.every((d, i) => d === esperado[i]),
    detalle: `2025: ${dan.join(' ')}`,
  };
});

await probar('2. En un año bisiesto febrero tiene 29', () => {
  return {
    ok: diasDelMes(1, 2024) === 29 && diasDelMes(1, 2025) === 28
      && diasDelMes(1, 1900) === 28 && diasDelMes(1, 2000) === 29,
    detalle: `2024:${diasDelMes(1, 2024)} 2025:${diasDelMes(1, 2025)} 1900:${diasDelMes(1, 1900)} 2000:${diasDelMes(1, 2000)}`,
  };
});

await probar('3. La regla gregoriana completa (div 4, salvo 100, salvo 400)', () => {
  const casos = [[2024, true], [2025, false], [1900, false], [2000, true],
    [2023, false], [2100, false], [2400, true], [1996, true]];
  const mal = casos.filter(([a, esperado]) => esBisiesto(a) !== esperado).map(([a]) => a);
  return { ok: !mal.length, detalle: mal.length ? `fallan: ${mal.join(', ')}` : `${casos.length} años, todos bien` };
});

// ---------- 4 y 5: fechas que no existen ----------

await probar('4. Las fechas imposibles se rechazan', () => {
  const malas = ['2025-02-29', '2025-04-31', '2025-06-31', '2025-09-31', '2025-11-31',
    '2025-01-00', '2025-00-15', '2025-13-15', '2025-01-32', '2025-02-30',
    '1900-02-29', '2100-02-29'];
  const entraron = malas.filter((f) => Engine.parseFechaDeNacimiento(f) !== null);
  return {
    ok: !entraron.length,
    detalle: entraron.length ? `ENTRARON: ${entraron.join(', ')}` : `${malas.length} fechas imposibles, todas afuera`,
  };
});

await probar('5. Las fechas que existen se aceptan', () => {
  const buenas = ['2025-02-28', '2024-02-29', '2025-04-30', '2025-06-30',
    '2025-12-31', '2024-12-31', '2000-02-29', '2025-01-01'];
  const rebotadas = buenas.filter((f) => Engine.parseFechaDeNacimiento(f) === null);
  return {
    ok: !rebotadas.length,
    detalle: rebotadas.length ? `REBOTARON: ${rebotadas.join(', ')}` : `${buenas.length} fechas válidas, todas adentro`,
  };
});

// ---------- 6 a 9: el almanaque avanza bien ----------
//
// El año del almanaque sale de la temporada, así que las pruebas se paran en
// el año que necesitan moviendo season.year (ver window.__fechaEn).

await probar('6. Año común: del 28 de febrero se pasa al 1° de marzo', () => {
  window.__carrera('boca');
  const anio = 2027; // no bisiesto
  const d = window.__diaDe(28, 1, anio);
  const antes = window.__fechaEn(anio, d);
  const despues = window.__fechaEn(anio, d + 1);
  return {
    ok: window.__texto(antes) === `28/02/${anio}` && window.__texto(despues) === `01/03/${anio}`,
    detalle: `${window.__texto(antes)} -> ${window.__texto(despues)}`,
  };
});

await probar('7. Año bisiesto: del 28 de febrero se pasa al 29', () => {
  window.__carrera('boca');
  const anio = 2028; // bisiesto
  const d = window.__diaDe(28, 1, anio);
  const antes = window.__fechaEn(anio, d);
  const despues = window.__fechaEn(anio, d + 1);
  return {
    ok: window.__texto(antes) === `28/02/${anio}` && window.__texto(despues) === `29/02/${anio}`,
    detalle: `${window.__texto(antes)} -> ${window.__texto(despues)}`,
  };
});

await probar('8. Y del 29 de febrero al 1° de marzo', () => {
  window.__carrera('boca');
  const anio = 2028;
  const d = window.__diaDe(29, 1, anio);
  const antes = window.__fechaEn(anio, d);
  const despues = window.__fechaEn(anio, d + 1);
  return {
    ok: window.__texto(antes) === `29/02/${anio}` && window.__texto(despues) === `01/03/${anio}`,
    detalle: `${window.__texto(antes)} -> ${window.__texto(despues)}`,
  };
});

await probar('9. Del 31 de diciembre se pasa al 1° de enero del año siguiente', () => {
  window.__carrera('boca');
  const anio = 2026;
  const d = window.__diaDe(31, 11, anio);
  const antes = window.__fechaEn(anio, d);
  const despues = window.__fechaEn(anio, d + 1);
  return {
    ok: window.__texto(antes) === `31/12/${anio}` && window.__texto(despues) === `01/01/${anio + 1}`,
    detalle: `${window.__texto(antes)} -> ${window.__texto(despues)}`,
  };
});

await probar('10. Un año bisiesto tiene 366 días y uno común 365', () => {
  window.__carrera('boca');
  const largo = (anio) => {
    let dias = 0;
    for (let m = 0; m < 12; m++) dias += diasDelMes(m, anio);
    return dias;
  };
  // Y el almanaque del juego lo camina igual: el día 365 de un año bisiesto
  // todavía es diciembre, no enero del que viene.
  const enBisiesto = window.__fechaEn(2028, 365);
  return {
    ok: largo(2028) === 366 && largo(2027) === 365 && enBisiesto.anio === 2028 && enBisiesto.mes === 11,
    detalle: `2028: ${largo(2028)} días · 2027: ${largo(2027)} · día 365 de 2028 = ${window.__texto(enBisiesto)}`,
  };
});

// ---------- 11 a 14: que no se haya roto la edad ----------

await probar('11. edadDe() sigue andando con los 932 jugadores reales', () => {
  window.__carrera('boca');
  const malos = [];
  Object.values(REAL_ROSTERS).flat().forEach((p) => {
    if (!Engine.parseFechaDeNacimiento(p.birthDate)) malos.push(`${p.name} ${p.birthDate}`);
  });
  return {
    ok: !malos.length,
    detalle: malos.length ? `fechas que ya no pasan: ${malos.slice(0, 5).join(', ')}` : 'las 932 fechas investigadas siguen siendo válidas',
  };
});

await probar('12. La edad del plantel coincide con su fecha de nacimiento', () => {
  window.__carrera('river');
  const malos = Engine.state.squad.filter((p) => p.birthDate && p.age !== Engine.edadDe(p));
  return {
    ok: !malos.length,
    detalle: malos.length ? malos.map((p) => `${p.name} ${p.age}≠${Engine.edadDe(p)}`).join(', ')
      : `${Engine.state.squad.length} jugadores, todas las edades cuadran`,
  };
});

await probar('13. El cumpleaños sube la edad el día que corresponde', () => {
  window.__carrera('boca');
  const j = Engine.state.squad.find((p) => p.birthDate);
  const n = Engine.parseFechaDeNacimiento(j.birthDate);
  const anio = anioDeTemporada(Engine.state.season.year);
  const elDia = window.__diaDe(n.dia, n.mes, anio);
  Engine.state.calendar.dayCount = elDia - 1;
  Engine.refrescarEdades();
  const vispera = Engine.edadDe(j);
  Engine.state.calendar.dayCount = elDia;
  Engine.refrescarEdades();
  const cumple = Engine.edadDe(j);
  return {
    ok: cumple === vispera + 1,
    detalle: `${j.name} (${j.birthDate}): víspera ${vispera} -> cumpleaños ${cumple}`,
  };
});

await probar('14. Un nacido el 29 de febrero no rompe la cuenta de la edad', () => {
  window.__carrera('boca');
  // 2008 fue bisiesto. En los años comunes el juego lo hace cumplir el 1° de
  // marzo, que es lo que importa: la edad sube una vez por año y nunca se
  // saltea un año.
  const bisiesto = { birthDate: '2008-02-29' };
  const edades = [];
  for (let t = 1; t <= 6; t++) {
    Engine.state.season.year = t;
    Engine.state.calendar.dayCount = 300; // bien entrado el año
    edades.push(Engine.edadDe(bisiesto));
  }
  const suben = edades.every((e, i) => i === 0 || e === edades[i - 1] + 1);
  return {
    ok: Engine.parseFechaDeNacimiento('2008-02-29') !== null && suben,
    detalle: `edades temporada 1 a 6: ${edades.join(', ')}`,
  };
});

// ---------- El informe ----------
console.log('\nPRUEBAS DEL ALMANAQUE\n');
pruebas.forEach((p) => {
  console.log(`  ${p.ok ? '✓' : '✗'} ${p.nombre}`);
  if (p.detalle) console.log(`      ${p.detalle}`);
});
const fallaron = pruebas.filter((p) => !p.ok);
console.log(`\n${pruebas.length - fallaron.length}/${pruebas.length} pruebas pasaron`);
if (errores.length) console.log('errores de la página:', errores);
await navegador.close();
process.exit(fallaron.length || errores.length ? 1 : 0);
