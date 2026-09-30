// Segunda pasada de SoFIFA: la fecha de nacimiento exacta.
//
// El listado sólo trae el AÑO. El día y el mes están en la ficha de cada
// jugador, así que hay que entrar a las 930. Tarda unos 7 minutos.
//
// CÓMO SE USA
//   1. Entrá a https://sofifa.com
//   2. F12 -> Console. Si pide, escribí a mano: allow pasting
//   3. Pegá todo esto y Enter. Dejalo correr.
//   4. Al final descarga sofifa-fechas-<liga>.csv
//
// La red de seguridad: del listado ya sabemos el año de nacimiento de cada
// jugador. Si la fecha que aparece en la ficha tiene otro año, se descarta en
// vez de darla por buena. Así un cambio de formato en la página no mete datos
// falsos: mete huecos, que se ven.

(async () => {
  const LIGA = 353;
  const ESPERA_LISTADO = 700;
  const ESPERA_FICHA = 350;
  const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };

  const limpiar = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const traer = async (u) => {
    const r = await fetch(u, { credentials: 'include' });
    if (!r.ok) throw new Error(r.status);
    return new DOMParser().parseFromString(await r.text(), 'text/html');
  };

  // ---------- 1. El listado, para tener los links y los años ----------
  console.log('Paso 1: juntando los jugadores de la liga...');
  const jugadores = [];
  const vistos = new Set();
  for (let pag = 0; pag < 40; pag++) {
    let doc;
    try { doc = await traer(`https://sofifa.com/players?type=all&lg%5B0%5D=${LIGA}&offset=${pag * 60}&showCol%5B0%5D=by`); }
    catch (e) { break; }
    const filas = [...doc.querySelectorAll('table tbody tr')];
    let nuevos = 0;
    filas.forEach((tr) => {
      const a = tr.querySelector('a[href*="/player/"]');
      if (!a) return;
      const id = (a.getAttribute('href').match(/\/player\/(\d+)/) || [])[1];
      if (!id || vistos.has(id)) return;
      vistos.add(id); nuevos++;
      // El año es la única columna pedida, así que es la primera celda numérica de 4 dígitos.
      const anio = (limpiar(tr.textContent).match(/\b(19|20)\d{2}\b/) || [])[0];
      jugadores.push({ id, nombre: limpiar(a.getAttribute('data-tippy-content') || a.textContent),
                       url: 'https://sofifa.com' + a.getAttribute('href').replace('https://sofifa.com', ''), anio });
    });
    console.log(`   página ${pag + 1}: ${nuevos} nuevos · total ${jugadores.length}`);
    if (!nuevos) break;
    await new Promise((r) => setTimeout(r, ESPERA_LISTADO));
  }
  if (!jugadores.length) { console.error('No salió ningún jugador. ¿Estás en sofifa.com?'); return; }

  // ---------- 2. La ficha de cada uno ----------
  function leerFecha(texto, anioEsperado) {
    const re = /\((\d{1,2})\s*(?:de\s+)?([a-záéíóúA-ZÁÉÍÓÚ]+)\.?\s*(?:de\s+)?(\d{4})\)/g;
    let m;
    while ((m = re.exec(texto))) {
      const dia = +m[1];
      const mes = MESES[m[2].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 3)];
      const anio = +m[3];
      if (!mes || dia < 1 || dia > 31) continue;
      if (anioEsperado && anio !== +anioEsperado) continue;  // la red de seguridad
      return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
    return null;
  }

  console.log(`\nPaso 2: leyendo ${jugadores.length} fichas. Esto tarda unos ${Math.ceil(jugadores.length * ESPERA_FICHA / 60000)} minutos.`);
  let con = 0, sin = 0, fallos = 0;
  for (let i = 0; i < jugadores.length; i++) {
    const j = jugadores[i];
    try {
      const doc = await traer(j.url);
      j.birthDate = leerFecha(limpiar(doc.body.textContent), j.anio);
      j.birthDate ? con++ : sin++;
    } catch (e) { fallos++; j.error = String(e.message || e); }
    if ((i + 1) % 50 === 0 || i === jugadores.length - 1) {
      console.log(`   ${i + 1}/${jugadores.length} · con fecha ${con} · sin fecha ${sin} · fallaron ${fallos}`);
    }
    await new Promise((r) => setTimeout(r, ESPERA_FICHA));
  }

  // ---------- 3. El archivo ----------
  const campos = ['sofifaId', 'nombre', 'anioDelListado', 'birthDate', 'error'];
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = [campos.join(','), ...jugadores.map((j) => [j.id, j.nombre, j.anio, j.birthDate, j.error].map(esc).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `sofifa-fechas-${LIGA}.csv`;
  document.body.appendChild(a); a.click(); a.remove();

  console.log(`\nLISTO: ${con} con fecha, ${sin} sin fecha, ${fallos} fallaron. Se descargó sofifa-fechas-${LIGA}.csv`);
  window.__fechas = jugadores;
})();
