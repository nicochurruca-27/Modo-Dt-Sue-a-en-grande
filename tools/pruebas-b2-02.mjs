// PRUEBAS DE LA CORRECCIÓN B2-02 — el jugador transferido también se retira.
//
//     npm install --no-save playwright
//     node tools/pruebas-b2-02.mjs
//
// El bug: en `Mercado.plantel()` el control de retiro se aplicaba solo a
// `base`. El que llegaba por `movimientos.dentro` no pasaba por ninguno y
// envejecía para siempre (José Sosa, transferido con 40, jugando con 53).
//
// La regla que tiene que cumplirse es la del Bloque 0, la misma para los dos
// lados: el que llega a la edad de retiro JUEGA su última temporada y al
// cerrarla queda afuera. O sea `yaSeRetiro`, que mira el cierre ANTERIOR, no
// `seRetira`, que mira el que viene.

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
  // Mueve un jugador de un club a otro y limpia la caché de fuerzas.
  window.__pasar = (id, de, a, anio) => {
    const j = Mercado.plantel(Engine, de).find((p) => p.id === id);
    Mercado.transferir(Engine.state, j, de, a, anio || Engine.state.season.year);
    Engine._fuerzas = {};
    return j;
  };
  window.__en = (clubId, id) => Mercado.plantel(Engine, clubId).find((p) => p.id === id) || null;
  window.__temporadaA = (t) => { Engine.state.season.year = t; Engine._fuerzas = {}; };
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

console.log('\n========== PRUEBAS B2-02 ==========\n');

await probar('Un transferido por debajo de la edad de retiro sigue activo', () => {
  window.__carrera('boca');
  // Un jugador joven de verdad: se busca el más pibe de un plantel real.
  const origen = 'estudianteslp';
  const joven = Mercado.plantel(Engine, origen)
    .slice().sort((a, b) => Engine.edadDe(a) - Engine.edadDe(b))[0];
  const edad = Engine.edadDe(joven);
  window.__pasar(joven.id, origen, 'river', 1);
  const seguimiento = [];
  for (let t = 1; t <= 10; t++) {
    window.__temporadaA(t);
    const p = window.__en('river', joven.id);
    seguimiento.push(`T${t}:${p ? Engine.edadDe(p) : 'AFUERA'}`);
  }
  const faltaAlguna = seguimiento.some((x) => x.includes('AFUERA'));
  return {
    ok: !faltaAlguna,
    detalle: `${joven.name} (${joven.id}), transferido con ${edad} años: ${seguimiento.join(' ')}`
      + ` — edad de retiro ${Engine.EDAD_DE_RETIRO}`,
  };
});

await probar('Un transferido que llega a su última temporada la juega', () => {
  window.__carrera('boca');
  // Ojo con cuál es "la última temporada": `seRetira` compara
  // `edadAlCierreDeTemporada > EDAD_DE_RETIRO`, estrictamente mayor. Con
  // EDAD_DE_RETIRO en 39 eso quiere decir que a los 39 se sigue jugando y que
  // la última temporada es la que se cierra con 40, que es la regla pedida:
  // "ya cuando llegan a 40, ahí se retiraron".
  const ULTIMA_EDAD = Engine.EDAD_DE_RETIRO + 1;
  // Se lo busca en cualquier club con plantel real: en uno solo no siempre
  // hay alguien con la edad justa.
  let caso = null;
  const clubes = Object.keys(REAL_ROSTERS).filter((c) => c !== 'river' && Engine.getClub(c));
  for (const club of clubes) {
    for (const p of Mercado.plantel(Engine, club)) {
      for (let t = 2; t <= 8; t++) {
        if (Engine.edadAlCierreDeTemporada(p, t) === ULTIMA_EDAD) { caso = { p, club, t }; break; }
      }
      if (caso) break;
    }
    if (caso) break;
  }
  if (!caso) return { ok: false, detalle: 'no se encontró un jugador con la edad justa' };
  window.__pasar(caso.p.id, caso.club, 'river', 1);
  window.__temporadaA(caso.t);
  const juegaSuUltima = !!window.__en('river', caso.p.id);
  window.__temporadaA(caso.t + 1);
  const sigueDespues = !!window.__en('river', caso.p.id);
  return {
    ok: juegaSuUltima && !sigueDespues,
    detalle: `${caso.p.name} (de ${caso.club}): cumple ${ULTIMA_EDAD} al cerrar T${caso.t} ·`
      + ` juega T${caso.t}=${juegaSuUltima} · sigue en T${caso.t + 1}=${sigueDespues} (tiene que ser false)`,
  };
});

await probar('Un transferido que ya pasó la edad de retiro no aparece', () => {
  window.__carrera('boca');
  const origen = 'estudianteslp';
  // El mismo caso de la auditoría: el más veterano del plantel.
  const viejo = Mercado.plantel(Engine, origen)
    .slice().sort((a, b) => Engine.edadDe(b) - Engine.edadDe(a))[0];
  window.__pasar(viejo.id, origen, 'river', 1);
  const seguimiento = [];
  for (let t = 1; t <= 14; t++) {
    window.__temporadaA(t);
    const p = window.__en('river', viejo.id);
    seguimiento.push(`T${t}:${p ? Engine.edadDe(p) : 'afuera'}`);
  }
  const activoPasadoElRetiro = [];
  for (let t = 1; t <= 14; t++) {
    window.__temporadaA(t);
    const p = window.__en('river', viejo.id);
    // La regla del Bloque 0, escrita acá aparte para no preguntarle al mismo
    // código que se está probando: en la temporada 1 no hay cierre anterior,
    // así que un veterano de más de 40 arranca adentro y juega su última.
    if (p && t > 1 && Engine.edadAlCierreDeTemporada(p, t - 1) > Engine.EDAD_DE_RETIRO) {
      activoPasadoElRetiro.push(`T${t} con ${Engine.edadDe(p)}`);
    }
  }
  return {
    ok: !activoPasadoElRetiro.length,
    detalle: `${viejo.name} (${viejo.id}), transferido con ${Engine.edadDe(viejo)}: ${seguimiento.join(' ')}`
      + (activoPasadoElRetiro.length ? ` — ACTIVO PASADO EL RETIRO: ${activoPasadoElRetiro.join(', ')}` : ''),
  };
});

await probar('El transferido retirado no reaparece en temporadas posteriores', () => {
  window.__carrera('boca');
  const origen = 'estudianteslp';
  const viejo = Mercado.plantel(Engine, origen)
    .slice().sort((a, b) => Engine.edadDe(b) - Engine.edadDe(a))[0];
  window.__pasar(viejo.id, origen, 'river', 1);
  // Primero la temporada en la que ya tiene que estar afuera.
  let primeraAfuera = null;
  for (let t = 1; t <= 20 && primeraAfuera === null; t++) {
    window.__temporadaA(t);
    if (!window.__en('river', viejo.id)) primeraAfuera = t;
  }
  if (primeraAfuera === null) return { ok: false, detalle: 'nunca se retiró en 20 temporadas' };
  // Y de ahí en adelante, nunca más.
  const reapariciones = [];
  for (let t = primeraAfuera; t <= 30; t++) {
    window.__temporadaA(t);
    if (window.__en('river', viejo.id)) reapariciones.push(`T${t}`);
  }
  return {
    ok: !reapariciones.length,
    detalle: `${viejo.name} queda afuera en T${primeraAfuera} y de T${primeraAfuera} a T30`
      + (reapariciones.length ? ` REAPARECE en ${reapariciones.join(',')}` : ' no reaparece ninguna vez'),
  };
});

await probar('La protección de último arquero del Bloque 0 sigue en pie', () => {
  // El caso adversario: se le saca al club TODOS los arqueros propios y el
  // único que le queda es uno que llegó por transferencia y ya está para
  // retirarse. Si el arreglo lo filtra y nadie lo cubre, el club queda con
  // cero arqueros, que es el estado imposible que arregló el Bloque 0.
  const resultados = [];
  const sinArquero = [];
  ['allboys', 'river', 'talleres', 'ferro', 'quilmes'].forEach((club) => {
    window.__carrera('boca');
    const s = Engine.state;
    const plantel = Mercado.plantel(Engine, club);
    const arqueros = plantel.filter((p) => p.pos === 'POR');
    // Todos los arqueros del club se van.
    arqueros.forEach((a) => Mercado.movimientosDe(s, club).fuera.push(a.id));
    // Y le llega uno viejo de otro club.
    const otro = Object.keys(REAL_ROSTERS).find((c) => c !== club);
    const arqueroViejo = Mercado.plantel(Engine, otro)
      .filter((p) => p.pos === 'POR').slice().sort((a, b) => Engine.edadDe(b) - Engine.edadDe(a))[0];
    Mercado.transferir(s, arqueroViejo, otro, club, 1);
    Engine._fuerzas = {};
    for (let t = 1; t <= 12; t++) {
      window.__temporadaA(t);
      const n = Engine.cuantosArqueros(Mercado.plantel(Engine, club));
      if (!n) sinArquero.push(`${club} en T${t}`);
    }
    window.__temporadaA(12);
    resultados.push(`${club}: ${Engine.cuantosArqueros(Mercado.plantel(Engine, club))} arquero(s) en T12`);
  });
  return {
    ok: !sinArquero.length,
    detalle: sinArquero.length ? `CLUBES SIN ARQUERO: ${sinArquero.join(', ')}` : resultados.join(' · '),
  };
});

await probar('Un transferido que todavía no se retira no desaparece antes de tiempo', () => {
  window.__carrera('boca');
  const origen = 'estudianteslp';
  // Veinte jugadores de distintas edades, todos transferidos en T1. Para cada
  // uno se compara temporada por temporada "¿está?" contra "¿debería estar?",
  // que es la misma pregunta que se le hace a un jugador de `base`.
  const candidatos = Mercado.plantel(Engine, origen).slice(0, 20);
  candidatos.forEach((j) => Mercado.transferir(Engine.state, j, origen, 'river', 1));
  Engine._fuerzas = {};
  const prematuros = [];
  const tardios = [];
  for (let t = 1; t <= 15; t++) {
    window.__temporadaA(t);
    const plantel = Mercado.plantel(Engine, 'river');
    candidatos.forEach((j) => {
      const esta = plantel.some((p) => p.id === j.id);
      const deberia = t <= 1 || Engine.edadAlCierreDeTemporada(j, t - 1) <= Engine.EDAD_DE_RETIRO;
      if (deberia && !esta) prematuros.push(`${j.name} faltó en T${t}`);
      if (!deberia && esta) tardios.push(`${j.name} de más en T${t}`);
    });
  }
  return {
    ok: !prematuros.length && !tardios.length,
    detalle: prematuros.length || tardios.length
      ? `prematuros: ${prematuros.slice(0, 3).join(', ') || '-'} · de más: ${tardios.slice(0, 3).join(', ') || '-'}`
      : `${candidatos.length} transferidos seguidos 15 temporadas: ninguno se fue antes ni se quedó de más`,
  };
});

console.log(`\n${pasaron}/${total.length} pruebas pasaron`);
if (erroresDePagina.length) console.log(`\nerrores de página: ${erroresDePagina.join(' | ')}`);
await navegador.close();
process.exit(pasaron === total.length ? 0 : 1);
