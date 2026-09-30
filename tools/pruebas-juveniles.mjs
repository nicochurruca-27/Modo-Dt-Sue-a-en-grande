// Pruebas de las inferiores: la cantera, el ojeador y el ascenso a Primera.
//
//     npm install --no-save playwright
//     node tools/pruebas-juveniles.mjs
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
await page.waitForFunction(() => typeof Juveniles !== 'undefined');

await page.evaluate(() => {
  window.__carrera = (clubId) => {
    localStorage.removeItem('dt-simulador-save-v3');
    Engine.createDT('Nico', 'ARG', 'equilibrado');
    Engine.newGame(clubId || 'boca');
    Engine.continueFromPresentation(0);
    Engine._fuerzas = {};
  };
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

// ---------- 1 a 4: la camada ----------

await probar('1. Cada club arranca con una cantera poblada', () => {
  window.__carrera('boca');
  const tamanios = Object.keys(REAL_ROSTERS).map((c) => Juveniles.camada(Engine, c).length);
  const min = Math.min(...tamanios);
  const max = Math.max(...tamanios);
  return { ok: min >= 6 && max <= 12, detalle: `los 30 clubes tienen entre ${min} y ${max} juveniles` };
});

await probar('2. La camada es la misma siempre (sale de la semilla)', () => {
  window.__carrera('velez');
  const a = Juveniles.camada(Engine, 'velez').map((p) => `${p.id}:${p.name}:${p.projection}`).join('|');
  window.__carrera('velez');
  const b = Juveniles.camada(Engine, 'velez').map((p) => `${p.id}:${p.name}:${p.projection}`).join('|');
  // Y desde otra carrera, con otro club dirigido, tiene que dar lo mismo.
  window.__carrera('huracan');
  const c = Juveniles.camada(Engine, 'velez').map((p) => `${p.id}:${p.name}:${p.projection}`).join('|');
  return { ok: a === b && b === c, detalle: a === c ? 'dos carreras distintas dan la misma camada' : 'la camada cambió entre carreras' };
});

await probar('3. Nadie pasa de la edad de inferiores', () => {
  window.__carrera('boca');
  const malos = [];
  for (const c of Object.keys(REAL_ROSTERS)) {
    Juveniles.camada(Engine, c).forEach((p) => {
      if (p.age > Juveniles.EDAD_MAXIMA || p.age < 15) malos.push(`${p.name} (${p.age})`);
    });
  }
  return { ok: !malos.length, detalle: malos.length ? malos.join(', ') : `todos entre 15 y ${Juveniles.EDAD_MAXIMA} años` };
});

await probar('4. La valoración de hoy nunca llega al techo', () => {
  window.__carrera('boca');
  const malos = [];
  for (const c of Object.keys(REAL_ROSTERS)) {
    Juveniles.camada(Engine, c).forEach((p) => {
      if (p.rating >= p.projection) malos.push(`${p.name} ${p.rating}/${p.projection}`);
    });
  }
  return { ok: !malos.length, detalle: malos.length ? malos.join(', ') : 'ninguno de los 30 clubes tiene un juvenil ya hecho' };
});

// ---------- 5 y 6: la cantera del club manda ----------

await probar('5. Un club de cantera grande saca mejores juveniles que uno chico', () => {
  window.__carrera('boca');
  const techoPromedio = (clubId) => {
    const club = Engine.getClub(clubId);
    let suma = 0;
    let n = 0;
    for (let t = -150; t <= 150; t++) {
      for (let i = 0; i < Juveniles.POR_CAMADA; i++) { suma += Juveniles.generarUno(Engine, club, t, i).projection; n++; }
    }
    return suma / n;
  };
  const grande = techoPromedio('river');   // cantera 5
  const chico = techoPromedio('riocuarto'); // cantera 2
  return {
    ok: grande > chico + 3,
    detalle: `River (cantera 5) techo medio ${grande.toFixed(1)} · Río Cuarto (cantera 2) ${chico.toFixed(1)}`,
  };
});

await probar('6. Las estrellas son raras, y más raras en un club chico', () => {
  window.__carrera('boca');
  const porcentaje = (clubId) => {
    const club = Engine.getClub(clubId);
    let estrellas = 0;
    let n = 0;
    for (let t = -400; t <= 400; t++) {
      for (let i = 0; i < Juveniles.POR_CAMADA; i++) {
        if (Juveniles.generarUno(Engine, club, t, i).nivel === 'estrella') estrellas++;
        n++;
      }
    }
    return (estrellas / n) * 100;
  };
  const river = porcentaje('river');
  const aldosivi = porcentaje('aldosivi');
  return {
    // Hasta en River tiene que ser raro: si pasara del 15% dejaría de ser
    // una noticia y sería la rutina.
    ok: river > aldosivi && river < 15 && aldosivi < 6,
    detalle: `River ${river.toFixed(1)}% de estrellas · Aldosivi ${aldosivi.toFixed(1)}%`,
  };
});

// ---------- 7 a 10: subir, liberar, guardar ----------

await probar('7. Subir un juvenil lo pasa al plantel y le cobra la prima', () => {
  window.__carrera('river');
  const antes = Engine.state.squad.length;
  const plata = Engine.state.budget;
  const p = Juveniles.camada(Engine, 'river')[0];
  const costo = Juveniles.costoDeSubir(Engine, p);
  const r = Juveniles.subir(Engine, p.id);
  const enPlantel = Engine.state.squad.find((x) => x.id === p.id);
  return {
    ok: r.ok
      && Engine.state.squad.length === antes + 1
      && Engine.state.budget === plata - costo
      && enPlantel && enPlantel.potential === p.projection
      && enPlantel.contractYears === 3
      && enPlantel.number != null
      && enPlantel.deLaCantera === true,
    detalle: `${p.name}: plantel ${antes} -> ${Engine.state.squad.length}, prima ${costo}, dorsal ${enPlantel ? enPlantel.number : '-'}`,
  };
});

await probar('8. El que subió ya no está en inferiores', () => {
  window.__carrera('river');
  const p = Juveniles.camada(Engine, 'river')[0];
  Juveniles.subir(Engine, p.id);
  return {
    ok: !Juveniles.camada(Engine, 'river').some((x) => x.id === p.id),
    detalle: `${p.name} está en el plantel y no en la cantera`,
  };
});

await probar('9. Liberar saca al juvenil y no vuelve', () => {
  window.__carrera('river');
  const p = Juveniles.camada(Engine, 'river')[0];
  Juveniles.liberar(Engine, p.id);
  return {
    ok: !Juveniles.camada(Engine, 'river').some((x) => x.id === p.id),
    detalle: `${p.name} quedó libre`,
  };
});

await probar('10. Las decisiones sobreviven a guardar y cargar', () => {
  window.__carrera('river');
  const subido = Juveniles.camada(Engine, 'river')[0];
  Juveniles.subir(Engine, subido.id);
  const liberado = Juveniles.camada(Engine, 'river')[0];
  Juveniles.liberar(Engine, liberado.id);
  Engine.save();
  Engine.load();
  Engine._fuerzas = {};
  const cantera = Juveniles.camada(Engine, 'river');
  return {
    ok: Engine.state.squad.some((x) => x.id === subido.id)
      && !cantera.some((x) => x.id === subido.id)
      && !cantera.some((x) => x.id === liberado.id),
    detalle: `subido: ${subido.name} · liberado: ${liberado.name} · quedan ${cantera.length} en la cantera`,
  };
});

// ---------- 11 y 12: el que cumple la edad se va ----------

await probar('11. Al cerrar la temporada, el que cumplió la edad se va libre', () => {
  window.__carrera('boca');
  const temporada = Engine.state.season.year;
  const seVan = Juveniles.camada(Engine, 'boca')
    .filter((p) => Engine.edadAlCierreDeTemporada(p, temporada) > Juveniles.EDAD_MAXIMA);
  const avisos = Juveniles.cerrarTemporada(Engine);
  const quedan = Juveniles.camada(Engine, 'boca');
  return {
    ok: avisos.length === seVan.length
      && seVan.every((p) => !quedan.some((x) => x.id === p.id)),
    detalle: `${seVan.length} cumplieron la edad, ${avisos.length} avisos, quedan ${quedan.length}`,
  };
});

await probar('12. Las listas guardadas no crecen para siempre', () => {
  window.__carrera('boca');
  for (let t = 1; t <= 30; t++) {
    Engine.state.season.year = t;
    Engine.refrescarEdades();
    Juveniles.cerrarTemporada(Engine);
  }
  const j = Engine.state.juveniles;
  return {
    ok: j.liberados.length < 30,
    detalle: `después de 30 temporadas: ${j.liberados.length} liberados guardados, ${j.subidos.length} subidos`,
  };
});

// ---------- 13 a 16: el ojeador ----------

await probar('13. El ojeador tarda un mes y vuelve con un informe', () => {
  window.__carrera('aldosivi');
  const envio = Juveniles.mandarOjeador(Engine, 'BRA', ['DEL', 'MED']);
  let dias = 0;
  while (dias < 60 && !Engine.state.juveniles.informe) {
    Engine.avanzarUnDia();
    dias++;
    if (Engine.state.screen !== 'calendar') Engine.state.screen = 'calendar';
  }
  const inf = Engine.state.juveniles.informe;
  return {
    ok: envio.ok && dias === Juveniles.DIAS_DE_VIAJE
      && inf && inf.jugadores.length === Juveniles.DEL_INFORME,
    detalle: `volvió el día ${dias} con ${inf ? inf.jugadores.length : 0} chicos`,
  };
});

await probar('14. Trae del país y de los puestos que le pediste', () => {
  window.__carrera('aldosivi');
  Juveniles.mandarOjeador(Engine, 'COL', ['POR', 'DEF']);
  for (let i = 0; i < 60 && !Engine.state.juveniles.informe; i++) {
    Engine.avanzarUnDia();
    if (Engine.state.screen !== 'calendar') Engine.state.screen = 'calendar';
  }
  const inf = Engine.state.juveniles.informe;
  const naciones = [...new Set(inf.jugadores.map((p) => p.nation))];
  const puestos = [...new Set(inf.jugadores.map((p) => p.pos))].sort();
  return {
    ok: naciones.length === 1 && naciones[0] === 'COL'
      && puestos.every((x) => ['POR', 'DEF'].includes(x)),
    detalle: `naciones: ${naciones.join(',')} · puestos: ${puestos.join(',')}`,
  };
});

await probar('15. Te quedás con uno y los otros once desaparecen', () => {
  window.__carrera('aldosivi');
  Juveniles.mandarOjeador(Engine, 'BRA', ['DEL']);
  for (let i = 0; i < 60 && !Engine.state.juveniles.informe; i++) {
    Engine.avanzarUnDia();
    if (Engine.state.screen !== 'calendar') Engine.state.screen = 'calendar';
  }
  const inf = Engine.state.juveniles.informe;
  const elegido = inf.jugadores[0];
  const descartado = inf.jugadores[1];
  Juveniles.elegirDelInforme(Engine, elegido.id);
  const cantera = Juveniles.camada(Engine, 'aldosivi');
  return {
    ok: Engine.state.juveniles.informe === null
      && cantera.some((x) => x.id === elegido.id)
      && !cantera.some((x) => x.id === descartado.id),
    detalle: `${elegido.name} entró a inferiores; los otros ${inf.jugadores.length - 1} no`,
  };
});

await probar('16. No se puede mandar dos ojeadores a la vez', () => {
  window.__carrera('aldosivi');
  const uno = Juveniles.mandarOjeador(Engine, 'BRA', ['DEL']);
  const dos = Juveniles.mandarOjeador(Engine, 'URU', ['DEF']);
  const sinPuesto = Juveniles.mandarOjeador(Engine, 'BRA', []);
  return {
    ok: uno.ok && !dos.ok && !sinPuesto.ok,
    detalle: `segundo envío rechazado: "${dos.nota}"`,
  };
});

// ---------- 17 a 19: lo que esto vino a arreglar ----------

await probar('17. Los planteles rivales ya no se vacían con los años', () => {
  window.__carrera('boca');
  const medir = (temporada) => {
    Engine.state.season.year = temporada;
    Engine._fuerzas = {};
    Engine.procesarRetiros();
    const tam = Object.keys(REAL_ROSTERS).map((c) => Mercado.plantel(Engine, c).length);
    return { min: Math.min(...tam), max: Math.max(...tam) };
  };
  let peor = 99;
  for (let t = 1; t <= 25; t++) peor = Math.min(peor, medir(t).min);
  const final = medir(25);
  return {
    // Antes de las inferiores, en la temporada 15 el club más chico quedaba
    // con 8 jugadores y no podía ni parar un once.
    ok: peor >= 20,
    detalle: `en 25 temporadas el plantel más chico nunca bajó de ${peor} (temporada 25: ${final.min}-${final.max})`,
  };
});

await probar('18. Un club con plantel real repone de SU cantera, no de relleno', () => {
  window.__carrera('platense');
  Engine.state.season.year = 20;
  Engine._fuerzas = {};
  const conRelleno = [];
  let canteranos = 0;
  for (const c of Object.keys(REAL_ROSTERS)) {
    const pl = Mercado.plantel(Engine, c);
    canteranos += pl.filter((p) => p.deLaCantera).length;
    if (pl.some((p) => /-c\d/.test(p.id))) conRelleno.push(c);
  }
  return {
    ok: !conRelleno.length && canteranos > 0,
    detalle: `${canteranos} jugadores de cantera en la liga, ${conRelleno.length} clubes con relleno genérico`,
  };
});

await probar('19. Los planteles no quedan todos del mismo tamaño', () => {
  window.__carrera('boca');
  Engine.state.season.year = 20;
  Engine._fuerzas = {};
  const tam = Object.keys(REAL_ROSTERS).map((c) => Mercado.plantel(Engine, c).length);
  const distintos = new Set(tam).size;
  return {
    // El primer intento tenía un piso parejo de 24 y los 30 clubes quedaban
    // exactamente en 24: el piso se había vuelto techo.
    ok: distintos >= 4,
    detalle: `${distintos} tamaños distintos entre los 30 clubes (${Math.min(...tam)} a ${Math.max(...tam)})`,
  };
});

// ---------- 20: el panel ----------

await probar('20. El panel se dibuja y no rompe nada', () => {
  window.__carrera('argentinos');
  pantallaDeInicio = false;
  render();
  const panel = document.getElementById('youth-panel');
  const filas = panel.querySelectorAll('.juvenil-fila').length;
  const camada = Juveniles.camada(Engine, 'argentinos').length;
  return {
    ok: filas === camada && panel.innerHTML.includes('Inferiores'),
    detalle: `${filas} filas dibujadas para ${camada} juveniles`,
  };
});

// ---------- El informe ----------
console.log('\nPRUEBAS DE LAS INFERIORES\n');
pruebas.forEach((p) => {
  console.log(`  ${p.ok ? '✓' : '✗'} ${p.nombre}`);
  if (p.detalle) console.log(`      ${p.detalle}`);
});
const fallaron = pruebas.filter((p) => !p.ok);
console.log(`\n${pruebas.length - fallaron.length}/${pruebas.length} pruebas pasaron`);
if (errores.length) console.log('errores de la página:', errores);
await navegador.close();
process.exit(fallaron.length || errores.length ? 1 : 0);
