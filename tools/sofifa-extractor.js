// Extractor de planteles de SoFIFA para Modo DT.
//
// CÓMO SE USA
//   1. Entrá a https://sofifa.com y logueate si hace falta.
//   2. Abrí las herramientas del navegador con F12 y andá a la pestaña Console.
//   3. Pegá TODO este archivo y apretá Enter.
//   4. Esperá. Va contando las páginas y al final te descarga un CSV.
//
// Recorre todas las páginas solo (de 60 en 60) y junta todos los jugadores de
// la liga que le pidas. Para cambiar de liga, cambiá LIGA acá abajo:
//   353 = Liga Profesional Argentina
//
// Pide las columnas que necesita el juego. No hace falta que las actives a
// mano en la página: van en la URL.
//
// OJO: la fecha de nacimiento EXACTA no está en el listado —sólo el año—. Para
// el día y el mes hay que entrar a la ficha de cada jugador, que es un segundo
// paso aparte (ver sofifa-fechas.js cuando exista).

(async () => {
  const LIGA = 353;
  const POR_PAGINA = 60;
  const TOPE_DE_PAGINAS = 40;      // red de seguridad, por si algo sale mal
  const ESPERA_MS = 700;           // pausa entre pedidos, para no castigar el sitio

  // ae edad · oa valoración · pt potencial · vl valor · wg salario
  // rc cláusula · by año de nacimiento · hi altura · wi peso · pf pierna hábil
  // ir reputación internacional · cj dorsal · bp mejor posición · gu progresión
  // hc cara real (¿tiene foto escaneada o una genérica?)
  // le fecha de fin de préstamo (los cedidos no traen años de contrato)
  const COLUMNAS = ['ae', 'oa', 'pt', 'vl', 'wg', 'rc', 'by', 'hi', 'wi', 'pf', 'ir', 'cj', 'bp', 'gu', 'hc', 'le'];

  const limpiar = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const url = (offset) => {
    const cols = COLUMNAS.map((c, i) => `showCol%5B${i}%5D=${c}`).join('&');
    return `https://sofifa.com/players?type=all&lg%5B0%5D=${LIGA}&offset=${offset}&${cols}`;
  };

  function parsear(doc) {
    const tabla = doc.querySelector('table');
    if (!tabla) return [];
    const etiquetas = [...tabla.querySelectorAll('thead th')].map((th) => {
      const a = th.querySelector('a');
      return limpiar((a && a.getAttribute('data-tippy-content')) || th.textContent);
    });
    return [...tabla.querySelectorAll('tbody tr')].map((tr) => {
      const link = tr.querySelector('a[href*="/player/"]');
      if (!link) return null;
      const j = {};
      j.sofifaId = (link.getAttribute('href').match(/\/player\/(\d+)/) || [])[1];
      j.nombre = limpiar(link.getAttribute('data-tippy-content') || link.textContent);
      j.url = 'https://sofifa.com' + link.getAttribute('href').replace('https://sofifa.com', '');
      // La foto no hace falta bajarla: la URL sale del id, rellenado a 6
      // dígitos y partido en dos mitades (183898 -> players/183/898/).
      const seis = String(j.sofifaId).padStart(6, '0');
      j.fotoUrl = `https://cdn.sofifa.net/players/${seis.slice(0, 3)}/${seis.slice(3)}/27_120.png`;
      const celda = link.closest('td');
      // Los puestos aparecen anidados (un contenedor y adentro el texto), así
      // que sin el Set salen duplicados: ED/ED/MD/MD en vez de ED/MD.
      j.puestos = [...new Set([...celda.querySelectorAll('span, a')]
        .map((e) => limpiar(e.textContent))
        .filter((t) => /^[A-ZÁ]{2,4}$/.test(t)))].join('/');
      j.nacionalidades = [...celda.querySelectorAll('img[title]')].map((i) => i.getAttribute('title')).join('/');
      const equipo = tr.querySelector('a[href*="/team/"]');
      if (equipo) {
        j.equipo = limpiar(equipo.textContent);
        j.equipoId = (equipo.getAttribute('href').match(/\/team\/(\d+)/) || [])[1];
        const texto = limpiar(equipo.closest('td').textContent);
        const anios = texto.match(/(\d{4})\s*~\s*(\d{4})/);
        if (anios) { j.contratoDesde = +anios[1]; j.contratoHasta = +anios[2]; }
      }
      [...tr.children].forEach((td, i) => {
        const etiqueta = etiquetas[i];
        if (!etiqueta || etiqueta === 'Nombre' || etiqueta === 'Equipo & Contrato') return;
        const valor = limpiar(td.textContent);
        if (valor) j[etiqueta] = valor;
      });
      return j;
    }).filter(Boolean);
  }

  const todos = [];
  const vistos = new Set();
  for (let pagina = 0; pagina < TOPE_DE_PAGINAS; pagina++) {
    const offset = pagina * POR_PAGINA;
    const respuesta = await fetch(url(offset), { credentials: 'include' });
    if (!respuesta.ok) { console.warn('La página', pagina + 1, 'devolvió', respuesta.status, '— corto acá.'); break; }
    const doc = new DOMParser().parseFromString(await respuesta.text(), 'text/html');
    const lote = parsear(doc);
    const nuevos = lote.filter((j) => j.sofifaId && !vistos.has(j.sofifaId));
    nuevos.forEach((j) => vistos.add(j.sofifaId));
    todos.push(...nuevos);
    console.log(`página ${pagina + 1}: ${lote.length} filas, ${nuevos.length} nuevas · total ${todos.length}`);
    // Se corta cuando una página no trae nada nuevo: ahí se terminó la liga.
    if (!nuevos.length) break;
    await new Promise((r) => setTimeout(r, ESPERA_MS));
  }

  if (!todos.length) { console.error('No salió ningún jugador. ¿Estás en sofifa.com y con la sesión abierta?'); return; }

  // A CSV, con una columna por cada campo que haya aparecido.
  const campos = [...new Set(todos.flatMap((j) => Object.keys(j)))];
  const escapar = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = [campos.join(','), ...todos.map((j) => campos.map((c) => escapar(j[c])).join(','))].join('\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sofifa-liga-${LIGA}.csv`;
  document.body.appendChild(a); a.click(); a.remove();

  console.log(`LISTO: ${todos.length} jugadores, ${campos.length} columnas. Se descargó sofifa-liga-${LIGA}.csv`);
  window.__jugadores = todos;
})();
