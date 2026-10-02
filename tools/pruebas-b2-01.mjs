// PRUEBAS DE LA CORRECCIÓN B2-01 — identidad estable del relleno.
//
//     npm install --no-save playwright
//     node tools/pruebas-b2-01.mjs [temporadasDelSoak]
//
// El bug: el id del relleno era `${clubId}-c${anio}-${vivos.length}`. El
// número final era el LUGAR del jugador en la fila, así que si se iba alguien
// de más arriba todos los ids se corrían uno y pasaban a nombrar a otra
// persona. Y el año adelante hacía que la camada entera se volviera a acuñar
// cada temporada.
//
// La regla que se verifica acá es una sola: un id es una identidad, no una
// posición. El mismo id siempre tiene que ser la misma persona, en el club
// que sea y en la temporada que sea.

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
  window.ES_RELLENO = (id) => /-c\d+$/.test(id);
  window.__carrera = (c) => {
    localStorage.removeItem('dt-simulador-save-v3');
    Engine.createDT('Nico', 'ARG', 'equilibrado');
    Engine.newGame(c || 'boca');
    Engine.continueFromPresentation(0);
    Engine._fuerzas = {};
  };
  // La "huella" de una persona: lo que la identifica más allá del club.
  window.__huella = (p) => `${p.name}|${p.pos}|${p.nation}|${p.birthDate}|${p.projection}`;
  window.__relleno = (clubId) => Mercado.plantel(Engine, clubId).filter((p) => window.ES_RELLENO(p.id));
  window.__dondeEsta = (id) => {
    const s = Engine.state;
    return s.clubs.filter((c) => {
      const pl = c.id === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, c.id);
      return pl.some((p) => p.id === id);
    }).map((c) => c.id);
  };
  window.__temporadaA = (t) => { Engine.state.season.year = t; Engine._fuerzas = {}; };
  // Un club generado (sin plantel real) que tenga relleno.
  window.__clubGenerado = () => Engine.state.clubs
    .map((c) => c.id)
    .find((id) => id !== Engine.state.clubId
      && !(typeof REAL_ROSTERS !== 'undefined' && REAL_ROSTERS[id] && REAL_ROSTERS[id].length >= 11)
      && window.__relleno(id).length > 0);
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

console.log('\n========== PRUEBAS B2-01 ==========\n');

await probar('Caso 1 — Sacar un jugador no le cambia el dueño a ningún id', () => {
  window.__carrera('boca');
  const club = window.__clubGenerado();
  const antes = {};
  window.__relleno(club).forEach((p) => { antes[p.id] = window.__huella(p); });
  const idsAntes = Object.keys(antes);
  // Se saca UN jugador sembrado, que es el mínimo movimiento posible: en el
  // código viejo esto corría todos los ids del relleno una posición.
  const sembrado = Mercado.plantel(Engine, club).find((p) => /-g\d+$/.test(p.id));
  Mercado.transferir(Engine.state, sembrado, club, 'river', 1);
  Engine._fuerzas = {};

  const despues = {};
  window.__relleno(club).forEach((p) => { despues[p.id] = window.__huella(p); });
  const cambiaronDeDueno = idsAntes.filter((id) => despues[id] && despues[id] !== antes[id]);
  const sobrevivientesPerdidos = idsAntes.filter((id) => !despues[id]);
  const nuevos = Object.keys(despues).filter((id) => !antes[id]);
  const nuevosQueReutilizan = nuevos.filter((id) => antes[id] !== undefined);
  return {
    ok: !cambiaronDeDueno.length && !sobrevivientesPerdidos.length && !nuevosQueReutilizan.length,
    detalle: `${club}: ${idsAntes.length} de relleno antes · se saca ${sembrado.id}`
      + ` · ids que cambiaron de persona: ${cambiaronDeDueno.length}`
      + ` · sobrevivientes que desaparecieron: ${sobrevivientesPerdidos.length}`
      + ` · ids nuevos: ${nuevos.join(',') || 'ninguno'} (reutilizados: ${nuevosQueReutilizan.length})`,
  };
});

await probar('Caso 2 — Transferencia: mismo id, un solo club', () => {
  window.__carrera('boca');
  const club = window.__clubGenerado();
  const j = window.__relleno(club)[0];
  const huellaAntes = window.__huella(j);
  Mercado.transferir(Engine.state, j, club, 'lanus', 1);
  Engine._fuerzas = {};
  const donde = window.__dondeEsta(j.id);
  const enDestino = Mercado.plantel(Engine, 'lanus').find((p) => p.id === j.id);
  return {
    ok: donde.length === 1 && donde[0] === 'lanus' && !!enDestino,
    detalle: `${j.name} (${j.id}) de ${club} a lanus · está en: [${donde.join(', ')}]`
      + ` (tiene que ser solo lanus) · el id no cambió: ${enDestino ? 'sí' : 'NO'}`
      + ` · misma persona en destino: ${enDestino ? window.__huella(enDestino) === huellaAntes : '-'}`,
  };
});

await probar('Caso 3 — Transferencia y después reconstruir muchas veces', () => {
  window.__carrera('boca');
  const club = window.__clubGenerado();
  const j = window.__relleno(club)[0];
  Mercado.transferir(Engine.state, j, club, 'lanus', 1);
  Engine._fuerzas = {};
  const problemas = [];
  for (let i = 0; i < 25; i++) {
    Engine._fuerzas = {};
    const donde = window.__dondeEsta(j.id);
    if (donde.length !== 1 || donde[0] !== 'lanus') problemas.push(`vuelta ${i}: [${donde.join(',')}]`);
    // Y que nadie en el club de origen haya heredado su id.
    if (Mercado.plantel(Engine, club).some((p) => p.id === j.id)) problemas.push(`vuelta ${i}: volvió a ${club}`);
  }
  return {
    ok: !problemas.length,
    detalle: problemas.length ? problemas.slice(0, 3).join(' · ')
      : `${j.name} (${j.id}): 25 reconstrucciones, siempre solo en lanus y nunca de vuelta en ${club}`,
  };
});

await probar('Caso 4 — Cambiar de lugar en el array no cambia la identidad', () => {
  window.__carrera('boca');
  const club = window.__clubGenerado();
  const original = {};
  window.__relleno(club).forEach((p) => { original[p.id] = window.__huella(p); });
  const problemas = [];
  const posiciones = {};
  // Se sacan jugadores de a uno, lo que mueve a todos los demás de lugar.
  const sembrados = Mercado.plantel(Engine, club).filter((p) => /-g\d+$/.test(p.id)).slice(0, 6);
  sembrados.forEach((sem, paso) => {
    Mercado.transferir(Engine.state, sem, club, 'river', 1);
    Engine._fuerzas = {};
    const pl = window.__relleno(club);
    pl.forEach((p, indice) => {
      if (original[p.id] && original[p.id] !== window.__huella(p)) {
        problemas.push(`paso ${paso}: ${p.id} cambió de persona`);
      }
      if (!original[p.id]) original[p.id] = window.__huella(p);
      (posiciones[p.id] = posiciones[p.id] || new Set()).add(indice);
    });
  });
  const semovieron = Object.entries(posiciones).filter(([, v]) => v.size > 1).length;
  return {
    ok: !problemas.length,
    detalle: problemas.length ? problemas.slice(0, 3).join(' · ')
      : `6 salidas en ${club}: ${semovieron} jugador(es) de relleno cambiaron de lugar en el array`
        + ` y ninguno de los ${Object.keys(original).length} ids cambió de persona`,
  };
});

await probar('Caso 5 — El id no se recicla cuando alguien se va', () => {
  window.__carrera('boca');
  const club = window.__clubGenerado();
  const usadosAlguna = {};
  const problemas = [];
  const registrar = () => {
    window.__relleno(club).forEach((p) => {
      const h = window.__huella(p);
      if (usadosAlguna[p.id] && usadosAlguna[p.id] !== h) {
        problemas.push(`${p.id}: era "${usadosAlguna[p.id].split('|')[0]}", ahora "${h.split('|')[0]}"`);
      }
      usadosAlguna[p.id] = h;
    });
  };
  registrar();
  // Se va un jugador de relleno del medio, una y otra vez.
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const pl = window.__relleno(club);
    if (pl.length < 2) break;
    const victima = pl[Math.floor(pl.length / 2)];
    Mercado.transferir(Engine.state, victima, club, 'river', 1);
    Engine._fuerzas = {};
    registrar();
    if (window.__relleno(club).some((p) => p.id === victima.id)) {
      problemas.push(`${victima.id} volvió a aparecer en ${club} después de irse`);
    }
  }
  return {
    ok: !problemas.length,
    detalle: problemas.length ? problemas.slice(0, 3).join(' · ')
      : `6 salidas del medio del plantel en ${club}: ${Object.keys(usadosAlguna).length} ids distintos,`
        + ' ninguno reciclado y ninguno reaparecido',
  };
});

await probar('Caso 6 — El mismo id es la misma persona a lo largo de las temporadas', () => {
  window.__carrera('boca');
  const s = Engine.state;
  const registro = {};
  const problemas = [];
  for (let t = 1; t <= 20; t++) {
    window.__temporadaA(t);
    s.clubs.forEach((c) => {
      if (c.id === s.clubId) return;
      window.__relleno(c.id).forEach((p) => {
        // La huella sin la valoración: la valoración sube con los años a
        // propósito, lo que no puede cambiar es QUIÉN es.
        const h = window.__huella(p);
        if (registro[p.id] && registro[p.id] !== h) {
          problemas.push(`T${t}: ${p.id} era "${registro[p.id].split('|')[0]}" y ahora es "${h.split('|')[0]}"`);
        }
        registro[p.id] = h;
      });
    });
  }
  return {
    ok: !problemas.length,
    detalle: problemas.length ? `${problemas.length} cambios de dueño · ${problemas.slice(0, 2).join(' · ')}`
      : `20 temporadas, ${Object.keys(registro).length} jugadores de relleno distintos en todo el mundo:`
        + ' ningún id cambió de persona',
  };
});

await probar('Caso 6b — Un jugador de relleno sobrevive de una temporada a la otra', () => {
  window.__carrera('boca');
  const club = window.__clubGenerado();
  window.__temporadaA(1);
  const t1 = window.__relleno(club).map((p) => p.id);
  const sobreviven = [];
  for (let t = 2; t <= 8; t++) {
    window.__temporadaA(t);
    const ahora = window.__relleno(club).map((p) => p.id);
    sobreviven.push(`T${t}: ${t1.filter((id) => ahora.includes(id)).length}/${t1.length}`);
  }
  window.__temporadaA(2);
  const enT2 = window.__relleno(club).map((p) => p.id);
  return {
    ok: t1.some((id) => enT2.includes(id)),
    detalle: `${club}, relleno de la T1 = [${t1.join(', ')}] · cuántos siguen: ${sobreviven.join(' · ')}`,
  };
});

await probar(`SOAK de ${TEMPORADAS} temporadas — invariante global de identidad`, (n) => {
  window.__carrera('aldosivi');
  const s = Engine.state;
  const identidad = {};      // id -> huella original
  const clubDeCadaUno = {};  // id -> último club conocido
  const problemas = { cambioDeDueno: [], enDosClubes: [], volvioSolo: [], sinArquero: [], retiradoActivo: [] };
  // Ojo: el que llega a la edad JUEGA su última temporada y se anota al
  // cerrarla, así que estar en `retirados` con la temporada en curso es lo
  // correcto (Bloque 0). La contradicción es seguir jugando una temporada
  // DESPUÉS de haberse retirado.
  const retiradosDeAntes = (t) => new Set((s.retirados || [])
    .filter((r) => r.temporada < t).map((r) => r.id));

  for (let t = 1; t <= n; t++) {
    s.season.year = t; Engine._fuerzas = {};
    if (typeof Mercado.mercadoDeLosRivales === 'function') Mercado.mercadoDeLosRivales(Engine);
    Engine._fuerzas = {};
    Engine.procesarRetiros();
    Engine._fuerzas = {};

    const vistoEsteAnio = {};
    const yaRetirados = retiradosDeAntes(t);
    s.clubs.forEach((c) => {
      const pl = c.id === s.clubId ? (s.squad || []) : Mercado.plantel(Engine, c.id);
      if (pl.length && !Engine.cuantosArqueros(pl)) problemas.sinArquero.push(`T${t}: ${c.id}`);
      pl.forEach((p) => {
        if (yaRetirados.has(p.id)) problemas.retiradoActivo.push(`T${t}: ${p.id} en ${c.id}`);
        if (vistoEsteAnio[p.id] && vistoEsteAnio[p.id] !== c.id) {
          problemas.enDosClubes.push(`T${t}: ${p.id} en ${vistoEsteAnio[p.id]} y en ${c.id}`);
        }
        vistoEsteAnio[p.id] = c.id;
        if (!window.ES_RELLENO(p.id)) return;
        const h = window.__huella(p);
        if (identidad[p.id] && identidad[p.id] !== h) {
          problemas.cambioDeDueno.push(`T${t}: ${p.id} era "${identidad[p.id].split('|')[0]}", ahora "${h.split('|')[0]}"`);
        }
        identidad[p.id] = h;
        // Volver al club de origen sin una transferencia explícita: el club
        // anterior lo tiene en `fuera` y aun así reapareció ahí.
        const mov = Mercado.movimientosDe(s, c.id);
        if ((mov.fuera || []).includes(p.id)) problemas.volvioSolo.push(`T${t}: ${p.id} en ${c.id}, que lo tiene en fuera`);
        clubDeCadaUno[p.id] = c.id;
      });
    });
  }
  const totalProblemas = Object.values(problemas).reduce((a, x) => a + x.length, 0);
  const resumen = Object.entries(problemas).map(([k, v]) => `${k}: ${v.length}`).join(' · ');
  const ejemplos = Object.values(problemas).flat().slice(0, 3);
  return {
    ok: !totalProblemas,
    detalle: `${n} temporadas, ${Object.keys(identidad).length} jugadores de relleno seguidos · ${resumen}`
      + (ejemplos.length ? ` · ${ejemplos.join(' · ')}` : ''),
  };
}, TEMPORADAS);

await probar('SOAK — guardar y cargar después de todo eso', () => {
  const antes = JSON.stringify(Engine.state.clubs.map((c) => {
    const pl = c.id === Engine.state.clubId ? (Engine.state.squad || []) : Mercado.plantel(Engine, c.id);
    return `${c.id}:${pl.map((p) => p.id).sort().join(',')}`;
  }));
  Engine.save();
  const cargo = Engine.load();
  Engine._fuerzas = {};
  const despues = JSON.stringify(Engine.state.clubs.map((c) => {
    const pl = c.id === Engine.state.clubId ? (Engine.state.squad || []) : Mercado.plantel(Engine, c.id);
    return `${c.id}:${pl.map((p) => p.id).sort().join(',')}`;
  }));
  return { ok: cargo && antes === despues, detalle: `load()=${cargo} · los planteles del mundo quedaron ${antes === despues ? 'idénticos' : 'DISTINTOS'}` };
});

console.log(`\n${pasaron}/${total.length} pruebas pasaron`);
if (erroresDePagina.length) console.log(`\nerrores de página: ${erroresDePagina.join(' | ')}`);
await navegador.close();
process.exit(pasaron === total.length ? 0 : 1);
