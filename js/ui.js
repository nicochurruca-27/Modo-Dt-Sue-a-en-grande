// Renderizado de pantallas y manejo de clicks. Sin frameworks: arma HTML
// como texto y lo inserta en #app. Cada acción del usuario vuelve a llamar
// a render() para reflejar el nuevo estado del juego.

const app = document.getElementById('app');
const tablePanel = document.getElementById('table-panel');
const squadPanel = document.getElementById('squad-panel');

let selectDivision = 'D1';
let selectZone = 'A';
let tablePanelTab = 'mine'; // 'mine' | 'other' | 'copas'
let selectedPlayerId = null; // jugador tocado en la cancha/banco, esperando el segundo toque para cambiarlo

function money(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

function zoneLabel(id) {
  const z = PENALTY_ZONES.find((p) => p.id === id);
  return z ? z.label : '';
}

// Abreviatura de la posición detallada de un jugador (posDetail, ver
// players.js), para mostrar algo corto en la lista de suplentes en vez del
// texto completo. Un jugador sin posDetail cargado (club sin investigar
// todavía, o generado al azar) simplemente no muestra nada acá — no rompe
// nada, es la misma degradación elegante que ya usa `role`.
const POS_DETAIL_ABBREV = {
  arquero: 'POR',
  'lateral derecho': 'LD',
  'lateral izquierdo': 'LI',
  'carrilero derecho': 'CD',
  'carrilero izquierdo': 'CI',
  'defensor central': 'DFC',
  'mediocampista defensivo': 'MCD',
  'mediocampista mixto': 'MC',
  'mediocampista ofensivo': 'MCO',
  'volante por izquierda': 'MI',
  'volante por derecha': 'MD',
  'delantero centro': 'DC',
  'extremo izquierdo': 'EI',
  'extremo derecho': 'ED',
  'segundo delantero': 'SD',
};
function posDetailAbbrev(posDetail) {
  return POS_DETAIL_ABBREV[posDetail] || null;
}

// Banderas dibujadas a mano, en un viewBox de 30x20 (la proporción 3:2 de
// una bandera de verdad). No se usan los emojis (🇦🇷): Windows no trae las
// banderas de países en su fuente de emojis y las muestra como las dos
// letras del código — en una PC, Argentina aparecía literalmente como "AR".
// Dibujadas así se ven igual en cualquier sistema.
//
// Son versiones simplificadas: los soles de Argentina y Uruguay y el
// emblema de Paraguay van como un círculo, porque a 12 píxeles de alto el
// detalle no se distingue igual.
const NATION_FLAGS = {
  ARG: `<rect width="30" height="20" fill="#fff"/><rect width="30" height="6.7" fill="#74acdf"/><rect y="13.3" width="30" height="6.7" fill="#74acdf"/><circle cx="15" cy="10" r="2.4" fill="#f6b40e" stroke="#c77c00" stroke-width="0.3"/>`,
  URU: `<rect width="30" height="20" fill="#fff"/><rect y="4.4" width="30" height="2.2" fill="#0038a8"/><rect y="8.9" width="30" height="2.2" fill="#0038a8"/><rect y="13.3" width="30" height="2.2" fill="#0038a8"/><rect y="17.8" width="30" height="2.2" fill="#0038a8"/><rect width="11" height="11" fill="#fff"/><circle cx="5.5" cy="5.5" r="2.6" fill="#f6b40e"/>`,
  BRA: `<rect width="30" height="20" fill="#009739"/><polygon points="15,2.2 27.5,10 15,17.8 2.5,10" fill="#fedd00"/><circle cx="15" cy="10" r="3.6" fill="#012169"/>`,
  PAR: `<rect width="30" height="6.7" fill="#d52b1e"/><rect y="6.7" width="30" height="6.6" fill="#fff"/><rect y="13.3" width="30" height="6.7" fill="#0038a8"/><circle cx="15" cy="10" r="2.2" fill="#fff" stroke="#d52b1e" stroke-width="0.5"/>`,
  COL: `<rect width="30" height="10" fill="#fcd116"/><rect y="10" width="30" height="5" fill="#003893"/><rect y="15" width="30" height="5" fill="#ce1126"/>`,
  ECU: `<rect width="30" height="20" fill="#ffdd00"/><rect y="10" width="30" height="5" fill="#0033a0"/><rect y="15" width="30" height="5" fill="#ef3340"/><circle cx="15" cy="10" r="3" fill="#c8b568" stroke="#0033a0" stroke-width="0.6"/>`,
  CHI: `<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d52b1e"/><rect width="10" height="10" fill="#0039a6"/><polygon points="5,2 5.71,4.03 7.85,4.07 6.14,5.37 6.76,7.43 5,6.2 3.24,7.43 3.86,5.37 2.15,4.07 4.29,4.03" fill="#fff"/>`,
};

function nationFlag(code, height = 12) {
  const shapes = NATION_FLAGS[code];
  if (!shapes) return '';
  const width = Math.round(height * 1.5);
  return `<svg class="nation-flag" width="${width}" height="${height}" viewBox="0 0 30 20" role="img" aria-label="Bandera">${shapes}<rect width="30" height="20" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1"/></svg>`;
}

// Convierte el contador de días (s.calendar.dayCount, un simple entero
// que sobrevive bien al save/load) en una fecha legible, sumando días
// sobre el almanaque fijo de DAYS_IN_MONTH — sin usar el objeto Date del
// navegador, para no depender de nada más que aritmética simple.
function formatCalendarDate(dayCount) {
  let day = CALENDAR_START_DAY + dayCount;
  let month = CALENDAR_START_MONTH;
  while (day > DAYS_IN_MONTH[month]) {
    day -= DAYS_IN_MONTH[month];
    month = (month + 1) % 12;
  }
  return `${day} de ${MONTH_NAMES[month]}`;
}

function render() {
  const s = Engine.state;
  if (!s) return;
  // El carrusel de noticias es lo único del juego que usa un temporizador.
  // Como render() rehace todo el HTML de cero, hay que apagarlo acá o el
  // temporizador viejo seguiría corriendo contra nodos que ya no existen.
  detenerCarruselNoticias();
  if (s.screen === 'dt-create') renderDTCreate();
  else if (s.screen === 'club-select') renderClubSelect();
  else if (s.screen === 'presentation') renderPresentation();
  else if (s.screen === 'calendar') renderCalendar();
  else if (s.screen === 'pre-match') renderPreMatch();
  else if (s.screen === 'penalty') renderPenalty();
  else if (s.screen === 'match-result') renderMatchResult();
  else if (s.screen === 'contract-renewal') renderContractRenewal();
  else if (s.screen === 'transfer') renderTransfer();
  else if (s.screen === 'fifa-break') renderFifaBreak();
  else if (s.screen === 'season-end') renderSeasonEnd();
  renderTablePanel();
  renderSquadPanel();
  renderMarketPanel();
  const endCareerBtn = document.getElementById('end-career-btn');
  if (endCareerBtn) {
    endCareerBtn.addEventListener('click', () => {
      if (confirm('¿Seguro que querés terminar esta carrera ahora y empezar una nueva? Se pierde el progreso actual.')) {
        Engine.resetGame();
        render();
      }
    });
  }
}

// Los paneles laterales no existen todavía en la pantalla de elegir club
// (no hay temporada armada). Se limpian ahí y se dibujan en cualquier otra.
//
// El panel de tablas tiene varias vistas que se recorren con flechas: tu
// zona, la otra zona de tu misma división (las dos están siempre simuladas en
// paralelo), la Tabla Anual (solo en Primera) y las copas internacionales.
//
// ---------- Colores de las tablas ----------
//
// Cada fila puede llevar una franja de color a la izquierda según a qué le
// está jugando ese puesto, como en las tablas de Promiedos. Las reglas de
// acá son las mismas que aplica el motor a fin de año (ver el comentario de
// arriba de engine.js), no una aproximación.

// Tabla de zona: clasifican los 8 primeros. En Primera van a los playoffs;
// en la Nacional el 1º juega la Final por el ascenso y del 2º al 8º van al
// Reducido.
function zoneRowZone(index, isD1) {
  if (index >= 8) return null;
  if (isD1) return 'playoff';
  return index === 0 ? 'champ' : 'playoff';
}

// Tabla Anual: los 3 primeros van a la Libertadores (el 3º por fase previa),
// del 4º al 9º a la Sudamericana, y los dos últimos descienden. Es la foto
// del reparto suponiendo que los campeones del Apertura, del Clausura y de
// la Copa Argentina son otros tres clubes; si alguno de ellos sale de estos
// puestos, a fin de año la lista se corre hacia abajo un lugar por cada uno.
function anualRowZone(index, total) {
  if (index >= total - 2) return 'desc';
  if (index <= 1) return 'lib';
  if (index === 2) return 'repechaje';
  if (index <= 8) return 'suda';
  return null;
}

function tableRowHtml(row, index, zone) {
  const s = Engine.state;
  const classes = [row.id === s.clubId ? 'me' : '', zone ? `zone-${zone}` : ''].filter(Boolean).join(' ');
  return `<tr class="${classes}"><td>${index + 1}</td><td><span class="table-club">${clubCrest(row, 18)}${row.name}</span></td><td>${row.played}</td><td>${row.pts}</td></tr>`;
}

function tableLegend(items) {
  return `<ul class="table-legend">${items.map((it) => `<li><span class="legend-dot zone-${it.zone}"></span>${it.text}</li>`).join('')}</ul>`;
}

function anualTableBody() {
  const table = Engine.tablaAnualRows();
  if (!table || !table.length) {
    return '<p class="muted">La Tabla Anual arranca cuando empieza la primera fecha del Apertura.</p>';
  }
  return `
    <p class="muted">Suma la fase de zonas del Apertura y la del Clausura. Los playoffs no suman puntos.</p>
    <div class="table-wrap">
      <table class="table compact">
        <thead><tr><th>#</th><th>Club</th><th>PJ</th><th>Pts</th></tr></thead>
        <tbody>
          ${table.map((r, i) => tableRowHtml(r, i, anualRowZone(i, table.length))).join('')}
        </tbody>
      </table>
    </div>
    ${tableLegend([
      { zone: 'lib', text: 'Copa Libertadores (fase de grupos)' },
      { zone: 'repechaje', text: 'Copa Libertadores (fase previa)' },
      { zone: 'suda', text: 'Copa Sudamericana' },
      { zone: 'desc', text: 'Descienden a la Primera Nacional' },
    ])}
    <p class="muted">Los campeones del Apertura, del Clausura y de la Copa Argentina van a la Libertadores por su cuenta: por cada uno que salga de estos puestos, la lista se corre un lugar hacia abajo.</p>
  `;
}

// Resultado de la Libertadores y la Sudamericana que se jugaron este año
// (con los clasificados de la temporada anterior). La primera temporada de
// una carrera no tiene copas todavía.
// "Copa Libertadores", pero la Recopa ya trae su nombre completo.
function nombreDeCopa(c) {
  return c.esRecopa ? c.copa : `Copa ${c.copa}`;
}

function copasResultHtml(copas) {
  if (!copas || !copas.length) {
    return '<p class="muted">Las copas internacionales se juegan a partir del año que viene, con los clasificados de esta temporada.</p>';
  }
  return copas.map((c) => {
    let tuyo = '';
    if (c.userWon) tuyo = '<div class="me-line">¡La ganaste vos!</div>';
    else if (c.userStage) tuyo = `<div class="me-line">Tu club llegó hasta ${c.userStage}.</div>`;
    return `
      <h4>${nombreDeCopa(c)}</h4>
      <p>Campeón: <strong>${c.championName}</strong>${c.championPais ? ` <span class="muted">(${c.championPais})</span>` : ''}${c.runnerUpName ? `<br><span class="muted">Finalista: ${c.runnerUpName}</span>` : ''}</p>
      ${tuyo}
    `;
  }).join('');
}

function renderTablePanel() {
  const s = Engine.state;
  if (!s || !s.season) { tablePanel.innerHTML = ''; return; }
  const club = Engine.getClub(s.clubId);
  const myZoneLetter = s.season.myZone;
  const otherZoneLetter = myZoneLetter === 'A' ? 'B' : 'A';

  const tabs = [
    { id: 'mine', label: `Zona ${myZoneLetter}` },
    { id: 'other', label: `Zona ${otherZoneLetter}` },
    // La Tabla Anual solo existe en Primera: la Nacional juega un torneo
    // anual único, así que su tabla de zona ya es la del año.
    ...(s.season.myDivision === 'D1' ? [{ id: 'anual', label: 'Anual' }] : []),
    { id: 'copas', label: 'Copas' },
  ];
  // Si la pestaña guardada ya no existe (pasa al descender a la Nacional,
  // que no tiene Tabla Anual), se vuelve a la primera.
  if (!tabs.some((t) => t.id === tablePanelTab)) tablePanelTab = tabs[0].id;
  const activeIndex = tabs.findIndex((t) => t.id === tablePanelTab);
  const prevTab = tabs[(activeIndex - 1 + tabs.length) % tabs.length];
  const nextTab = tabs[(activeIndex + 1) % tabs.length];

  let body;
  if (tablePanelTab === 'anual') {
    body = anualTableBody();
  } else if (tablePanelTab === 'copas') {
    // Estos dos datos sobreviven al cambio de temporada, así que el panel
    // muestra todo el año quiénes están jugando las copas y cómo salieron las
    // del año pasado.
    const jugando = s.copaQualification || [];
    if (!jugando.length) {
      body = '<p class="muted">Todavía no se definió ninguna clasificación a copas internacionales: se sabe recién a fin de temporada.</p>';
    } else {
      body = `
        <h4>Clasificados argentinos</h4>
        <p class="muted">Los que están jugando las copas de este año:</p>
        <ul>
          ${jugando.map((q) => `<li${q.clubId === s.clubId ? ' class="me-line"' : ''}>${q.name} — ${q.comp} (${q.stage})</li>`).join('')}
        </ul>
        <h4>Cómo salieron las del año pasado</h4>
        ${copasResultHtml(s.ultimasCopas)}
      `;
    }
  } else {
    const zoneKey = `${s.season.myDivision}-${tablePanelTab === 'mine' ? myZoneLetter : otherZoneLetter}`;
    const zoneData = s.season.zones[zoneKey];
    const table = zoneData ? Engine.sortTable(zoneData.table) : [];
    const isD1 = s.season.myDivision === 'D1';
    body = `
      <div class="table-wrap">
        <table class="table compact">
          <thead><tr><th>#</th><th>Club</th><th>PJ</th><th>Pts</th></tr></thead>
          <tbody>
            ${table.map((r, i) => tableRowHtml(r, i, zoneRowZone(i, isD1))).join('')}
          </tbody>
        </table>
      </div>
      ${tableLegend(isD1
        ? [{ zone: 'playoff', text: 'Clasifica a los playoffs (octavos de final)' }]
        : [
          { zone: 'champ', text: 'Juega la Final por el ascenso' },
          { zone: 'playoff', text: 'Clasifica al Torneo Reducido' },
        ])}
    `;
  }

  const heading = tablePanelTab === 'copas' ? 'Copas'
    : tablePanelTab === 'anual' ? 'Tabla Anual'
    : `Tabla — ${tabs[activeIndex].label}`;
  tablePanel.innerHTML = `
    <div class="card side-card">
      <div class="panel-tab-switch">
        <button class="option-btn small" id="table-prev-btn">◀</button>
        <h3>${heading}</h3>
        <button class="option-btn small" id="table-next-btn">▶</button>
      </div>
      ${body}
    </div>
  `;
  document.getElementById('table-prev-btn').addEventListener('click', () => { tablePanelTab = prevTab.id; renderTablePanel(); });
  document.getElementById('table-next-btn').addEventListener('click', () => { tablePanelTab = nextTab.id; renderTablePanel(); });
}

// Escudo del club. Si está cargado (ver CLUB_CRESTS en escudos.js) se
// muestra el escudo real; si no —hoy, todos los de Primera Nacional— se
// dibuja uno genérico con las iniciales del club, para que la pantalla se
// vea pareja igual y no queden huecos.
//
// `size` es el lado en píxeles: siempre cuadrado, así el escudo entra
// completo sin deformarse sea cual sea su forma (escudo, círculo, banderín).
function clubCrest(club, size) {
  const crest = (typeof CLUB_CRESTS !== 'undefined' && CLUB_CRESTS[club.id]) || null;
  if (crest) {
    return `<img class="club-crest" src="${crest}" alt="Escudo de ${club.name}" width="${size}" height="${size}">`;
  }
  return `<span class="club-crest club-crest-generic" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px">${clubInitials(club.name)}</span>`;
}

// Iniciales para el escudo genérico: las primeras letras de las primeras
// palabras que cuentan (se saltean "de", "y", etc.), hasta 3.
function clubInitials(name) {
  const ignorar = ['de', 'del', 'y', 'la', 'el', 'los', 'las'];
  return name
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !ignorar.includes(w.toLowerCase()))
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Colores reales si el club los tiene cargados (ver CLUB_COLORS en
// players.js); si no, cae al verde genérico de siempre.
function clubKit(club) {
  const c = (typeof CLUB_COLORS !== 'undefined' && CLUB_COLORS[club.id]) || null;
  return c || { shirt: 'var(--accent)', band: null, trim: '#04220f' };
}

// ---------- Cancha: un solo SVG con todo calculado a mano ----------
//
// Después de varias vueltas con flexbox (que dependía de que el navegador
// calculara solo el ancho del contenido, y en algunos celulares reales no
// funcionaba bien) se pasó todo el dibujo de la cancha a un único <svg>
// donde la posición de cada jugador se calcula en JS con aritmética
// simple y se pone directo en sus coordenadas (x, y). No hay ningún
// flexbox de por medio en el camino crítico: el ancho/alto del <svg> son
// atributos numéricos fijos (como los de una <img>), lo más viejo y
// compatible que hay — así que un jugador JAMÁS puede terminar afuera de
// la línea pintada, porque su posición se calculó para estar adentro.
const PITCH_JERSEY_W = 40;
const PITCH_JERSEY_H = 40;
const PITCH_LABEL_H = 16; // alto de la placa con el nombre, debajo del dorsal
const PITCH_LABEL2_H = 13; // alto de la placa chica con posición + valoración, debajo del nombre
const PITCH_ROW_H = 80; // separación vertical entre el arranque de una fila y la siguiente
const PITCH_COL_GAP = 12;
const PITCH_MARGIN_X = 26;
const PITCH_MARGIN_Y = 22;

function truncateLastName(name) {
  const last = name.trim().split(' ').slice(-1)[0];
  return last.length > 9 ? `${last.slice(0, 8)}…` : last;
}

// Líneas pintadas de la cancha, proporcionadas al tamaño real que termine
// midiendo (que varía según la formación) en vez de una imagen fija.
function pitchMarkingsSvg(w, h) {
  const inset = 9;
  const boxW = Math.min(w * 0.62, w - 36);
  const boxH = Math.min(30, h * 0.17);
  const goalW = boxW * 0.44;
  const goalH = boxH * 0.42;
  const arcR = Math.min(26, w * 0.16);
  const circleR = Math.max(14, Math.min(30, w * 0.16, h * 0.09));
  const corner = 9;
  const cx = w / 2;
  const stroke = 'rgba(255,255,255,0.55)';
  return `
    <rect x="${inset}" y="${inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="3" fill="none" stroke="${stroke}" stroke-width="1.5" />
    <line x1="${inset}" y1="${h / 2}" x2="${w - inset}" y2="${h / 2}" stroke="${stroke}" stroke-width="1.5" />
    <circle cx="${cx}" cy="${h / 2}" r="${circleR}" fill="none" stroke="${stroke}" stroke-width="1.5" />
    <circle cx="${cx}" cy="${h / 2}" r="2" fill="${stroke}" />
    <rect x="${cx - boxW / 2}" y="${inset}" width="${boxW}" height="${boxH}" fill="none" stroke="${stroke}" stroke-width="1.5" />
    <rect x="${cx - goalW / 2}" y="${inset}" width="${goalW}" height="${goalH}" fill="none" stroke="${stroke}" stroke-width="1.5" />
    <path d="M ${cx - arcR} ${inset + boxH} A ${arcR} ${arcR} 0 0 0 ${cx + arcR} ${inset + boxH}" fill="none" stroke="${stroke}" stroke-width="1.5" />
    <rect x="${cx - boxW / 2}" y="${h - inset - boxH}" width="${boxW}" height="${boxH}" fill="none" stroke="${stroke}" stroke-width="1.5" />
    <rect x="${cx - goalW / 2}" y="${h - inset - goalH}" width="${goalW}" height="${goalH}" fill="none" stroke="${stroke}" stroke-width="1.5" />
    <path d="M ${cx - arcR} ${h - inset - boxH} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${h - inset - boxH}" fill="none" stroke="${stroke}" stroke-width="1.5" />
    <path d="M ${inset} ${inset + corner} A ${corner} ${corner} 0 0 0 ${inset + corner} ${inset}" fill="none" stroke="${stroke}" stroke-width="1.2" />
    <path d="M ${w - inset - corner} ${inset} A ${corner} ${corner} 0 0 0 ${w - inset} ${inset + corner}" fill="none" stroke="${stroke}" stroke-width="1.2" />
    <path d="M ${inset} ${h - inset - corner} A ${corner} ${corner} 0 0 1 ${inset + corner} ${h - inset}" fill="none" stroke="${stroke}" stroke-width="1.2" />
    <path d="M ${w - inset - corner} ${h - inset} A ${corner} ${corner} 0 0 1 ${w - inset} ${h - inset - corner}" fill="none" stroke="${stroke}" stroke-width="1.2" />
  `;
}

// Un jugador puesto en (x, y): camiseta con mangas/cuello (como una
// camiseta de verdad, no un rectángulo), dorsal, y una placa oscura con el
// nombre debajo — el mismo estilo que las planillas de formación típicas.
// El aro de color (verde/amarillo/rojo) indica qué tan bien juega ahí (ver
// Engine.positionFit); el aro celeste es la selección para el cambio.
function playerMarkerSvg(p, club, x, y, selected) {
  const kit = clubKit(club);
  const label = p.number != null ? p.number : p.rating;
  const bandPath = kit.band
    ? `<path d="M14 4 L22 8 L30 4 L32 9 L22 13 L12 9 Z" fill="${kit.band}" />`
    : '';
  const fitStroke = p.fit === 'green' ? 'var(--accent)' : p.fit === 'yellow' ? '#eab308' : p.fit === 'red' ? 'var(--danger)' : null;
  const posAbbrev = posDetailAbbrev(p.posDetail);
  const roleNote = posAbbrev ? ` (${posAbbrev})` : p.role ? ` (rol: ${p.role})` : '';
  const title = p.fit && p.fit !== 'green' ? `<title>Valoración natural ${p.rating}${roleNote}, jugando ahí rinde ${p.effectiveRating}</title>` : '';
  const w = PITCH_JERSEY_W;
  const h = PITCH_JERSEY_H;
  const scale = w / 44;
  // Placa chica debajo del nombre: posición detallada (si la tenemos
  // investigada) + valoración, ej. "LD · 78". Sin posDetail se muestra
  // solo la valoración, para que siempre se vea ese dato en la cancha
  // aunque el jugador tenga dorsal (antes solo se veía la valoración si
  // NO tenía dorsal, porque compartía el mismo lugar que el número).
  const infoLine = posAbbrev ? `${posAbbrev} · ${p.rating}` : `${p.rating}`;
  const label2Y = h + 3 + PITCH_LABEL_H + 2;
  return `
    <g class="player-marker" data-player="${p.id}" transform="translate(${x}, ${y})">
      ${title}
      ${selected ? `<rect x="-8" y="-8" width="${w + 16}" height="${h + PITCH_LABEL_H + PITCH_LABEL2_H + 18}" rx="10" fill="rgba(56,189,248,0.28)" />` : ''}
      ${fitStroke ? `<rect x="-4" y="-4" width="${w + 8}" height="${h + 8}" rx="8" fill="none" stroke="${fitStroke}" stroke-width="2.5" />` : ''}
      <g transform="scale(${scale})">
        <path d="M14 4 L22 8 L30 4 L38 10 L34 17 L30 14 L30 40 L14 40 L14 14 L10 17 L6 10 Z" fill="${kit.shirt}" stroke="${kit.trim}" stroke-width="1.5" />
        ${bandPath}
        <text x="22" y="29" text-anchor="middle" font-size="12" font-weight="700" fill="${kit.trim}">${label}</text>
      </g>
      <rect x="-3" y="${h + 3}" width="${w + 6}" height="${PITCH_LABEL_H}" rx="3" fill="rgba(0,0,0,0.6)" />
      <text x="${w / 2}" y="${h + 3 + PITCH_LABEL_H - 4}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#ffffff">${truncateLastName(p.name)}</text>
      <rect x="-3" y="${label2Y}" width="${w + 6}" height="${PITCH_LABEL2_H}" rx="3" fill="rgba(0,0,0,0.4)" />
      <text x="${w / 2}" y="${label2Y + PITCH_LABEL2_H - 3.5}" text-anchor="middle" font-size="9" font-weight="600" fill="#cbd5e1">${infoLine}</text>
    </g>
  `;
}

// Arma el <svg> completo: calcula el ancho según la fila con más jugadores
// (nunca se achica un jugador para que "entre" — es la cancha la que mide
// lo que haga falta) y centra cada fila dentro de ese ancho.
// Ancho relativo (0-1) de cada categoría declarada en defWidth/medWidth/
// offWidth/delWidth (ver FORMATIONS en data.js) — 'total' no está acá
// porque ya es el default (fracción 1) cuando la formación no declara nada
// para esa línea.
const WIDTH_FRACTION_BY_CATEGORY = {
  compacta: 0.4,
  intermedio: 0.62,
  abierta: 0.84,
};

function buildPitchSvg(xi, club) {
  const f = xi.formation;
  const rows = [
    { type: 'del', players: xi.del },
    ...(xi.off.length ? [{ type: 'off', players: xi.off }] : []),
    { type: 'med', players: xi.med },
    { type: 'def', players: xi.def },
    { type: 'gk', players: xi.gk },
  ];
  const maxCols = Math.max(...rows.map((r) => r.players.length), 1);
  const svgWidth = 2 * PITCH_MARGIN_X + maxCols * PITCH_JERSEY_W + Math.max(0, maxCols - 1) * PITCH_COL_GAP;
  const rowContentH = PITCH_JERSEY_H + PITCH_LABEL_H + PITCH_LABEL2_H + 8;
  const svgHeight = 2 * PITCH_MARGIN_Y + Math.max(0, rows.length - 1) * PITCH_ROW_H + rowContentH;
  const fieldInnerWidth = svgWidth - 2 * PITCH_MARGIN_X;

  // Grilla de referencia: la misma que usa la fila más ancha (maxCols),
  // empaquetada justa — es la que ya sabemos que entra siempre en el
  // ancho del <svg>. Las filas con menos jugadores no se centran como un
  // bloque aparte (eso las dejaba amontonadas y, encima, alineadas en
  // columnas rígidas contra cualquier otra fila del mismo tamaño — ej. en
  // 4-2-2-2 la línea de enganches quedaba pegada justo debajo de los dos
  // delanteros, apilada). En cambio se reparten proporcionalmente sobre
  // ESA MISMA grilla (el primero va al casillero 0, el último al
  // maxCols-1, y los del medio interpolados) — así una dupla queda en las
  // dos puntas del ancho disponible, como una formación real dibujada en
  // una pizarra, y nunca se sale de los límites ya probados.
  const maxRowWidth = maxCols * PITCH_JERSEY_W + Math.max(0, maxCols - 1) * PITCH_COL_GAP;
  const gridStartX = PITCH_MARGIN_X + (fieldInnerWidth - maxRowWidth) / 2;
  const gridStep = PITCH_JERSEY_W + PITCH_COL_GAP;

  let playersMarkup = '';
  rows.forEach((row, i) => {
    const count = row.players.length;
    const y = PITCH_MARGIN_Y + i * PITCH_ROW_H;
    // Cada línea usa el ancho que le corresponde según la investigación
    // táctica cargada en la formación (defWidth/medWidth/offWidth/
    // delWidth); sin ese dato, 'total' = toda la grilla (comportamiento de
    // siempre). Nunca aplica a una fila de un solo jugador (esa ya se
    // centra aparte, más abajo).
    const widthCategory = f && f[`${row.type}Width`];
    const fraction = widthCategory ? WIDTH_FRACTION_BY_CATEGORY[widthCategory] ?? 1 : 1;
    const span = fraction * (maxCols - 1);
    const spanOffset = (maxCols - 1 - span) / 2;
    row.players.forEach((p, j) => {
      const virtualIndex = count === 1 ? (maxCols - 1) / 2 : spanOffset + (j * span) / (count - 1);
      const x = gridStartX + virtualIndex * gridStep;
      playersMarkup += playerMarkerSvg(p, club, x, y, p.id === selectedPlayerId);
    });
  });

  return `
    <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" class="pitch-svg">
      <defs>
        <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e7a3a" />
          <stop offset="100%" stop-color="#15602e" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" rx="10" fill="url(#pitchGrad)" />
      ${pitchMarkingsSvg(svgWidth, svgHeight)}
      ${playersMarkup}
    </svg>
  `;
}

function handlePlayerTap(id) {
  const s = Engine.state;
  if (selectedPlayerId === null || selectedPlayerId === id) {
    selectedPlayerId = selectedPlayerId === id ? null : id;
    render();
    return;
  }
  const isStarter = (pid) => s.startingSlots.some((e) => e.playerId === pid);
  if (!isStarter(selectedPlayerId) && !isStarter(id)) {
    // Dos suplentes entre sí: ninguno ocupa un casillero de la cancha, así
    // que no hay nada que intercambiar. Solo se mueve la selección.
    selectedPlayerId = id;
    render();
    return;
  }
  const ok = Engine.swapPlayers(selectedPlayerId, id);
  if (!ok) {
    // El único cambio que el motor rechaza es meter a la cancha a alguien
    // lesionado o suspendido.
    const lesionado = [selectedPlayerId, id]
      .map((pid) => s.squad.find((p) => p.id === pid))
      .find((p) => p && !Engine.isAvailable(p));
    if (lesionado) alert(`${lesionado.name} no está disponible: ${Engine.outLabel(lesionado)}.`);
  }
  selectedPlayerId = null;
  render();
}

function renderSquadPanel() {
  const s = Engine.state;
  if (!s || !s.squad) { squadPanel.innerHTML = ''; return; }
  const club = Engine.getClub(s.clubId);
  const xi = Engine.getStartingXI();
  const bench = Engine.getBench();

  const styles = ['Defensiva', 'Equilibrada', 'Ofensiva'];
  const activeStyle = xi.formation.style;
  const visibleFormations = FORMATIONS.filter((f) => f.style === activeStyle);

  squadPanel.innerHTML = `
    <div class="card side-card">
      <h3>Estilo</h3>
      <div class="formation-select">
        ${styles.map((st) => `<button class="tab-btn ${st === activeStyle ? 'active' : ''}" data-style="${st}">${st}</button>`).join('')}
      </div>
      <h3>Formación</h3>
      <div class="formation-select">
        ${visibleFormations.map((f) => `<button class="tab-btn ${f.id === s.formation ? 'active' : ''}" data-formation="${f.id}">${f.name}</button>`).join('')}
      </div>
      <div class="pitch-scroll">
        ${buildPitchSvg(xi, club)}
      </div>
      <p class="muted">Tocá un jugador de la cancha y después uno del banco (o al revés) para cambiarlos. Podés poner a cualquiera en cualquier puesto, pero fuera de su posición natural rinde menos. Si la cancha no entra completa, deslizala para el costado.</p>
      <p class="muted fit-legend"><span class="fit-dot fit-green"></span>su posición &nbsp; <span class="fit-dot fit-yellow"></span>posición cercana &nbsp; <span class="fit-dot fit-red"></span>fuera de lugar</p>
      ${xi.formation.off ? '<p class="muted">Esta formación distingue el mediocampista de marca (el 5) del enganche: fijate el rol de cada uno en la lista de suplentes.</p>' : ''}
      <h3>Suplentes</h3>
      <div class="bench-list">
        ${bench.map((p) => {
          const abbrev = posDetailAbbrev(p.posDetail);
          const detail = abbrev ? ` (${abbrev})` : p.role ? ` (${p.role})` : '';
          const baja = Engine.outLabel(p);
          return `
          <div class="pick-row player-chip-row ${p.id === selectedPlayerId ? 'selected' : ''} ${baja ? 'unavailable' : ''}" data-player="${p.id}">
            <span>${p.number != null ? `#${p.number} ` : ''}${p.name} — ${p.pos}${detail} (${p.rating})</span>
            ${baja ? `<span class="out-tag">${baja}</span>` : ''}
          </div>
        `;
        }).join('') || '<p class="muted">No hay suplentes disponibles.</p>'}
      </div>
    </div>
  `;

  squadPanel.querySelectorAll('[data-style]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const first = FORMATIONS.find((f) => f.style === btn.dataset.style);
      if (first) { Engine.setFormation(first.id); render(); }
    });
  });
  squadPanel.querySelectorAll('[data-formation]').forEach((btn) => {
    btn.addEventListener('click', () => { Engine.setFormation(btn.dataset.formation); render(); });
  });
  squadPanel.querySelectorAll('.player-marker, .player-chip-row').forEach((el) => {
    el.addEventListener('click', () => handlePlayerTap(el.getAttribute('data-player')));
  });
}

let dtNameDraft = '';
let dtNationDraft = 'ARG';
let dtStyleDraft = 'equilibrado';

const DT_STYLES = [
  { id: 'ofensivo', name: 'Ofensivo', desc: 'Te gusta que el equipo siempre vaya al frente. Arrancás la carrera con más confianza (+10 de ánimo).' },
  { id: 'equilibrado', name: 'Equilibrado', desc: 'Adaptás el plan según el rival, sin bonus ni penalidad — el club habla por sí solo.' },
  { id: 'conservador', name: 'Conservador', desc: 'Cuidás cada peso y jugás con las cuentas claras. Arrancás con +10% de presupuesto inicial.' },
];

function renderDTCreate() {
  app.innerHTML = `
    <div class="card">
      <h1>Creá tu Director Técnico</h1>
      <p class="muted">Antes de elegir club, contanos quién sos como DT. Esto no cambia después — es tu identidad para toda la carrera.</p>
      <label class="muted" for="dt-name-input">Nombre</label>
      <input id="dt-name-input" type="text" maxlength="30" placeholder="Tu nombre" value="${dtNameDraft.replace(/"/g, '&quot;')}" class="text-input" />
      <h3>Nacionalidad</h3>
      <div class="club-grid">
        ${NATIONS.map((n) => `
          <button class="club-btn ${n.code === dtNationDraft ? 'active' : ''}" data-nation="${n.code}">
            <strong>${nationFlag(n.code, 14)} ${n.name}</strong>
          </button>
        `).join('')}
      </div>
      <h3>Estilo personal</h3>
      <div class="options">
        ${DT_STYLES.map((st) => `
          <button class="club-btn ${st.id === dtStyleDraft ? 'active' : ''}" data-dtstyle="${st.id}">
            <strong>${st.name}</strong>
            <span class="muted">${st.desc}</span>
          </button>
        `).join('')}
      </div>
      <button class="option-btn" id="dt-create-btn">Empezar carrera</button>
    </div>
  `;
  document.getElementById('dt-name-input').addEventListener('input', (ev) => { dtNameDraft = ev.target.value; });
  app.querySelectorAll('[data-nation]').forEach((btn) => {
    btn.addEventListener('click', () => { dtNationDraft = btn.dataset.nation; render(); });
  });
  app.querySelectorAll('[data-dtstyle]').forEach((btn) => {
    btn.addEventListener('click', () => { dtStyleDraft = btn.dataset.dtstyle; render(); });
  });
  document.getElementById('dt-create-btn').addEventListener('click', () => {
    Engine.createDT(dtNameDraft, dtNationDraft, dtStyleDraft);
    render();
  });
}

// Solo se puede arrancar una carrera en Primera. La Primera Nacional sigue
// existiendo entera —se simula en paralelo todo el año, aparece en la Copa
// Argentina, y si te descienden la jugás de verdad— pero no es un punto de
// partida: el juego es sobre dirigir en Primera y pelearla para no bajar.
// Los 36 clubes de la Nacional quedan en la base de datos para eso.
//
// Si algún día se quiere volver a habilitar, se agrega 'D2' acá y vuelven las
// pestañas de división solas.
const DIVISIONES_JUGABLES = ['D1'];

function renderClubSelect() {
  if (!DIVISIONES_JUGABLES.includes(selectDivision)) selectDivision = DIVISIONES_JUGABLES[0];
  const clubs = CLUB_TEMPLATES.filter((c) => c.division === selectDivision && c.zone === selectZone);
  app.innerHTML = `
    <div class="card">
      <h1>Elegí tu club</h1>
      <p class="muted">Dirigís una temporada completa: liga con playoffs, Copa Argentina, fechas FIFA y mercado de pases. Si te va mal y descendés, seguís la carrera en la Primera Nacional peleando por volver.</p>
      ${DIVISIONES_JUGABLES.length > 1 ? `
        <div class="tabs">
          ${DIVISIONES_JUGABLES.map((d) => `<button class="tab-btn ${selectDivision === d ? 'active' : ''}" data-division="${d}">${d === 'D1' ? 'Primera División' : 'Primera Nacional'}</button>`).join('')}
        </div>
      ` : ''}
      <div class="tabs">
        <button class="tab-btn ${selectZone === 'A' ? 'active' : ''}" data-zone="A">Zona A</button>
        <button class="tab-btn ${selectZone === 'B' ? 'active' : ''}" data-zone="B">Zona B</button>
      </div>
      <div class="club-grid">
        ${clubs.map((c) => `
          <button class="club-btn" data-club="${c.id}">
            ${clubCrest(c, 56)}
            <strong>${c.name}</strong>
            <span class="muted">Reputación: ${'★'.repeat(c.reputation)}${'☆'.repeat(5 - c.reputation)}</span>
            <span class="muted">Presupuesto inicial: ${money(Engine.startingBudget(c))}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  app.querySelectorAll('[data-division]').forEach((btn) => {
    btn.addEventListener('click', () => { selectDivision = btn.dataset.division; render(); });
  });
  app.querySelectorAll('[data-zone]').forEach((btn) => {
    btn.addEventListener('click', () => { selectZone = btn.dataset.zone; render(); });
  });
  app.querySelectorAll('.club-btn').forEach((btn) => {
    btn.addEventListener('click', () => { Engine.newGame(btn.dataset.club); render(); });
  });
}

function renderPresentation() {
  const s = Engine.state;
  const club = Engine.getClub(s.clubId);
  const dt = s.dt;
  const responses = Engine.presentationResponses();
  app.innerHTML = `
    <div class="card">
      <h1>Presentación en sociedad</h1>
      <div class="presentation-crest">${clubCrest(club, 96)}</div>
      <p class="muted">La dirigencia de <strong>${club.name}</strong> te da la bienvenida${dt ? `, ${dt.name}` : ''}.</p>
      <p>"Este año el objetivo es claro: <strong>${s.objective.text}</strong>"</p>
      <h3>¿Cómo respondés?</h3>
      <div class="options">
        ${responses.map((opt, i) => `<button class="option-btn" data-i="${i}">${opt.label}</button>`).join('')}
      </div>
    </div>
  `;
  app.querySelectorAll('.options .option-btn').forEach((btn) => {
    btn.addEventListener('click', () => { Engine.continueFromPresentation(Number(btn.dataset.i)); render(); });
  });
}

function competitionLabel() {
  const s = Engine.state;
  const ctx = s.matchContext;
  if (!ctx) return '';
  if (ctx.context === 'league') {
    const editionLabel = s.season.edition ? `${s.season.edition === 'apertura' ? 'Apertura' : 'Clausura'} — ` : '';
    const extra = ctx.clasico ? ' · Clásico' : ctx.interzonal ? ' · Interzonal' : '';
    return `${editionLabel}Fecha ${s.season.roundIndex + 1} de ${s.season.totalRounds}${extra}`;
  }
  if (ctx.context === 'bracket') return Engine.bracketStageLabel();
  return '';
}

function header() {
  const s = Engine.state;
  const club = Engine.getClub(s.clubId);
  // Entre una temporada y la otra la tabla no existe: startNewSeason() arma
  // el season nuevo con zones vacío y recién después se juegan las fechas,
  // así que las pantallas de pretemporada (renovación de contrato y mercado
  // de pases) pasaban por acá sin tabla y rompían todo el render. Cuando no
  // hay tabla, simplemente no se muestra la posición.
  const zona = s.season.zones[Engine.myZoneKey()];
  const table = zona ? Engine.sortTable(zona.table) : null;
  const pos = table ? table.findIndex((r) => r.id === s.clubId) + 1 : 0;
  const divisionName = club.division === 'D1' ? 'Primera División' : 'Primera Nacional';
  const dt = s.dt;
  const dtNation = dt && NATIONS.find((n) => n.code === dt.nation);
  const dtLine = dt ? `<div class="muted">DT: ${dtNation ? nationFlag(dtNation.code) : ''} ${dt.name}</div>` : '';
  const objectiveLine = s.objective ? `<div class="muted">Objetivo de la dirigencia: ${s.objective.text}</div>` : '';
  return `
    <div class="topbar">
      <div class="topbar-club">${clubCrest(club, 28)}<span><strong>${club.name}</strong> <span class="muted">— ${divisionName}, Zona ${club.zone}</span></span></div>
      ${dtLine}
      ${objectiveLine}
      <div class="muted">${competitionLabel()}</div>
      <div class="muted">Presupuesto: ${money(s.budget)}${table ? ` · Posición en zona: ${pos}°/${table.length}` : ''} · Ánimo: ${s.morale}</div>
      <button class="option-btn small danger" id="end-career-btn">Terminar carrera</button>
    </div>
  `;
}

// ---------- Portal de noticias ----------
//
// El feed se alimenta solo desde js/noticias.js, que a su vez se alimenta de
// lo que pasa de verdad en la partida. Acá solo se dibuja.
//
// Hay dos formas de recorrerlo, como se pidió: pestañas por categoría (que
// filtran la lista) y un titular grande que va rotando solo entre las
// noticias destacadas, estilo portada de diario deportivo.

let noticiaFiltro = 'todas'; // 'todas' o una clave de NOTICIA_CATEGORIAS
let noticiaCarruselTimer = null;
let noticiaCarruselIndex = 0;

function detenerCarruselNoticias() {
  if (noticiaCarruselTimer) {
    clearInterval(noticiaCarruselTimer);
    noticiaCarruselTimer = null;
  }
}

function noticiasVisibles() {
  const lista = Engine.state.noticias || [];
  if (noticiaFiltro === 'todas') return lista;
  return lista.filter((n) => n.cat === noticiaFiltro);
}

function noticiaPill(cat) {
  const c = NOTICIA_CATEGORIAS[cat] || { label: 'Noticia', color: '#94a3b8' };
  return `<span class="noticia-pill" style="background:${c.color}1f;color:${c.color};border-color:${c.color}55;">${c.label}</span>`;
}

// El escudo solo se puede mostrar si la noticia habla de un club argentino
// del juego. Las de afuera (ligas extranjeras) no tienen escudo cargado, así
// que sencillamente no lo muestran.
function noticiaEscudo(clubId, size) {
  if (!clubId) return '';
  const club = Engine.state.clubs.find((c) => c.id === clubId);
  return club ? clubCrest(club, size) : '';
}

function noticiaHeroHtml(n) {
  if (!n) return '';
  return `
    ${noticiaEscudo(n.clubId, 40)}
    <div class="noticia-hero-texto">
      <div class="noticia-item-cabecera">${noticiaPill(n.cat)}<span class="noticia-fecha">${formatCalendarDate(n.dia)}</span></div>
      <h3>${n.titular}</h3>
      <p class="muted">${n.bajada}</p>
    </div>
  `;
}

function noticiaItemHtml(n) {
  return `
    <li class="noticia-item">
      ${noticiaEscudo(n.clubId, 26)}
      <div class="noticia-item-texto">
        <div class="noticia-item-cabecera">${noticiaPill(n.cat)}<span class="noticia-fecha">${formatCalendarDate(n.dia)}</span></div>
        <strong>${n.titular}</strong>
        <p class="muted">${n.bajada}</p>
      </div>
    </li>
  `;
}

function noticiasHtml() {
  const s = Engine.state;
  const todas = s.noticias || [];

  if (!todas.length) {
    return `
      <div class="card noticias-card">
        <div class="noticias-cabecera"><h3>Noticias</h3><span class="muted">Portal deportivo</span></div>
        <p class="muted">Todavía no pasó nada para contar. Avanzá los días y el diario se va a ir llenando solo.</p>
      </div>
    `;
  }

  // Solo se ofrecen las pestañas que tienen algo adentro, así no quedan
  // filtros que llevan a una lista vacía. Y si el filtro elegido se quedó
  // sin noticias (pasa al cambiar de temporada, cuando el feed se renueva),
  // se vuelve solo a "Todas" en vez de dejar la lista en blanco.
  const conNoticias = NOTICIA_ORDEN_CATEGORIAS.filter((cat) => todas.some((n) => n.cat === cat));
  if (noticiaFiltro !== 'todas' && !conNoticias.includes(noticiaFiltro)) noticiaFiltro = 'todas';
  const tabs = ['todas', ...conNoticias].map((cat) => {
    const label = cat === 'todas' ? 'Todas' : NOTICIA_CATEGORIAS[cat].label;
    return `<button class="noticia-tab ${cat === noticiaFiltro ? 'active' : ''}" data-noticia-cat="${cat}">${label}</button>`;
  }).join('');

  const visibles = noticiasVisibles();
  const destacadas = visibles.filter((n) => n.destacada).slice(0, 5);
  const hero = destacadas.length ? destacadas[noticiaCarruselIndex % destacadas.length] : visibles[0];
  // De la lista de abajo se sacan TODAS las que entran en el carrusel, no
  // solo la que se está mostrando: el carrusel cambia el titular sin rehacer
  // la lista, así que si se filtrara únicamente la actual, al girar la
  // noticia del titular aparecería repetida abajo.
  const enElCarrusel = new Set(destacadas.map((n) => n.id));
  if (hero) enElCarrusel.add(hero.id);
  const resto = visibles.filter((n) => !enElCarrusel.has(n.id)).slice(0, 12);

  const puntos = destacadas.length > 1
    ? `<div class="noticia-puntos">${destacadas.map((_, i) => `<span class="noticia-punto ${i === noticiaCarruselIndex % destacadas.length ? 'active' : ''}"></span>`).join('')}</div>`
    : '';

  return `
    <div class="card noticias-card">
      <div class="noticias-cabecera"><h3>Noticias</h3><span class="muted">Portal deportivo</span></div>
      <div class="noticia-tabs">${tabs}</div>
      <div class="noticia-hero" id="noticia-hero">${noticiaHeroHtml(hero)}</div>
      ${puntos}
      <ul class="noticia-lista">${resto.map(noticiaItemHtml).join('')}</ul>
    </div>
  `;
}

// Se llama después de insertar el HTML: engancha las pestañas y arranca la
// rotación del titular. La rotación toca solo el nodo del titular (no vuelve
// a llamar a render()) para no interrumpir lo que el usuario esté haciendo.
function wireNoticias() {
  app.querySelectorAll('[data-noticia-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      noticiaFiltro = btn.dataset.noticiaCat;
      noticiaCarruselIndex = 0;
      render();
    });
  });

  const hero = document.getElementById('noticia-hero');
  if (!hero) return;
  const destacadas = noticiasVisibles().filter((n) => n.destacada).slice(0, 5);
  if (destacadas.length < 2) return;

  detenerCarruselNoticias();
  noticiaCarruselTimer = setInterval(() => {
    const nodo = document.getElementById('noticia-hero');
    if (!nodo) { detenerCarruselNoticias(); return; }
    noticiaCarruselIndex = (noticiaCarruselIndex + 1) % destacadas.length;
    nodo.innerHTML = noticiaHeroHtml(destacadas[noticiaCarruselIndex]);
    nodo.classList.remove('noticia-hero-entra');
    void nodo.offsetWidth; // reinicia la animación de entrada
    nodo.classList.add('noticia-hero-entra');
    const puntos = app.querySelectorAll('.noticia-punto');
    puntos.forEach((pt, i) => pt.classList.toggle('active', i === noticiaCarruselIndex));
  }, 5000);
}

function renderCalendar() {
  const s = Engine.state;
  const cal = s.calendar;
  const dateLabel = formatCalendarDate(cal.dayCount);

  if (cal.message) {
    app.innerHTML = `
      ${header()}
      <div class="card">
        <p class="muted">${dateLabel}</p>
        <h2>${cal.message.subject}</h2>
        <p class="muted">De: ${cal.message.from}</p>
        <p>${cal.message.body}</p>
        <div class="options" id="calendar-message-options">
          ${cal.message.options.map((opt, i) => `<button class="option-btn" data-i="${i}">${opt.label}</button>`).join('')}
        </div>
      </div>
      ${noticiasHtml()}
    `;
    app.querySelectorAll('#calendar-message-options .option-btn').forEach((btn) => {
      btn.addEventListener('click', () => { Engine.answerCalendarMessage(Number(btn.dataset.i)); render(); });
    });
    wireNoticias();
    return;
  }

  app.innerHTML = `
    ${header()}
    <div class="card">
      <h2>${dateLabel}</h2>
      <p class="muted">${s.lastDecisionNote ? s.lastDecisionNote : 'Otro día tranquilo en el club.'}</p>
      <button class="option-btn" id="continue-btn">Avanzar</button>
    </div>
    ${noticiasHtml()}
  `;
  document.getElementById('continue-btn').addEventListener('click', () => {
    s.lastDecisionNote = null;
    Engine.advanceCalendarDay();
    render();
  });
  wireNoticias();
}

// "Jugás de local en La Bombonera", "Se juega en cancha neutral: el Kempes".
// Si el club no tiene cancha cargada (los de la Nacional), se dice solo si sos
// local o visitante, como antes.
function dondeSeJuega(ctx) {
  if (ctx.isNeutral) return `Se juega en cancha neutral${ctx.sede ? `: ${ctx.sede}` : ''}`;
  return `Jugás de ${ctx.isHome ? 'local' : 'visitante'}${ctx.sede ? ` en ${ctx.sede}` : ''}`;
}

function renderPreMatch() {
  const s = Engine.state;
  const d = s.currentDecision;
  const ctx = s.matchContext;
  const opponent = Engine.getClub(ctx.opponentId);

  app.innerHTML = `
    ${header()}
    <div class="card">
      <p class="muted match-rival">${dondeSeJuega(ctx)} vs ${clubCrest(opponent, 24)}<strong>${opponent.name}</strong></p>
      <h2>${d.title}</h2>
      <p>${d.description}</p>
      <div class="options">
        ${d.options.map((opt, i) => `<button class="option-btn" data-i="${i}">${opt.label}</button>`).join('')}
      </div>
    </div>
  `;
  app.querySelectorAll('.options .option-btn').forEach((btn) => {
    btn.addEventListener('click', () => { Engine.chooseDecision(Number(btn.dataset.i)); render(); });
  });
}

// ---------- Arquito de los penales ----------
//
// Mismo criterio que la cancha: nada de "aspect-ratio" moderno ni
// transform de CSS (que fallaron antes en el celular real del usuario).
// El arquito usa el truco viejo de padding-bottom en % para mantener la
// proporción, y la pelota/arquero se mueven con left/top en % + transition,
// que es soportado hace muchísimos años.
function goalZoneCenter(zoneId) {
  const z = PENALTY_ZONES.find((p) => p.id === zoneId);
  const leftPct = 18 + z.col * 32; // 3 columnas: 18%, 50%, 82%
  const topPct = z.row === 0 ? 28 : 72; // arriba / abajo dentro del arco
  return { leftPct, topPct };
}

// El arquero no se para en el mismo punto que la pelota. El muñeco es alto
// (ocupa casi la mitad del alto del arco), así que si lo centráramos en el
// centro de la zona, en los tiros de abajo le quedarían los pies afuera del
// arco. Estos valores lo dejan siempre apoyado adentro: KEEPER_REST es la
// pose de espera, y en el tiro de abajo se queda a esa misma altura (se
// tira para el costado, no para abajo).
const KEEPER_REST_TOP = 60;

function keeperSpot(zoneId) {
  const z = PENALTY_ZONES.find((p) => p.id === zoneId);
  const leftPct = 18 + z.col * 32;
  const topPct = z.row === 0 ? 36 : KEEPER_REST_TOP;
  return { leftPct, topPct };
}

// Arquero parado en pose de espera: brazos bien abiertos hacia arriba con
// guantes, piernas separadas, como en la pose clásica de "listo para
// atajar" (a diferencia de la versión anterior, que no se distinguía de
// un muñeco cualquiera).
function keeperIconSvg(shirt, trim) {
  const t = trim || '#0a0a0a';
  const shorts = trim || '#1e293b';
  return `
    <svg viewBox="0 0 40 46">
      <path d="M20 16 L7 5 M20 16 L33 5" stroke="${shirt}" stroke-width="5" fill="none" stroke-linecap="round" />
      <circle cx="7" cy="5" r="4" fill="#e8b48c" stroke="${t}" stroke-width="1" />
      <circle cx="33" cy="5" r="4" fill="#e8b48c" stroke="${t}" stroke-width="1" />
      <circle cx="20" cy="8" r="6" fill="#e8b48c" />
      <path d="M15 6 Q20 2 25 6" stroke="${t}" stroke-width="1.5" fill="none" stroke-linecap="round" />
      <rect x="11" y="13" width="18" height="19" rx="4" fill="${shirt}" stroke="${t}" stroke-width="1.5" />
      <path d="M17 32 L11 45 M23 32 L29 45" stroke="${shorts}" stroke-width="6" fill="none" stroke-linecap="round" />
      <ellipse cx="11" cy="45" rx="4" ry="2.4" fill="${t}" />
      <ellipse cx="29" cy="45" rx="4" ry="2.4" fill="${t}" />
    </svg>
  `;
}

// El arco va envuelto en .goal-outer porque el alto de .goal-wrap sale de un
// padding-bottom en porcentaje, y ese porcentaje se calcula contra el ancho
// del PADRE, no contra el ancho propio. Con el max-width puesto directamente
// en .goal-wrap, en una pantalla grande el padre medía mucho más que el arco
// y el alto se disparaba: el arco salía cuadrado en la PC (en el celular no
// se notaba porque ahí el padre es angosto). Con el max-width en el envoltorio
// las dos medidas salen del mismo ancho y la proporción se respeta siempre.
//
// El viewBox (100x50) tiene la misma proporción que el recuadro, así que el
// marco no necesita deformarse para llenarlo: antes se estiraba con
// preserveAspectRatio="none" y el travesaño terminaba mucho más grueso que
// los palos, porque el trazo se estira junto con el dibujo.
function goalWidgetHtml(keeperKit) {
  return `
    <div class="goal-outer">
      <div class="goal-wrap" id="goal-wrap">
        <div class="goal-net"></div>
        <svg class="goal-frame" viewBox="0 0 100 50">
          <polyline points="4,47 4,3 96,3 96,47" fill="none" stroke="#e2e8f0" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
        ${PENALTY_ZONES.map((z) => `<div class="goal-zone" data-zone="${z.id}" style="left:${z.col * 33.33}%;top:${z.row * 50}%;"></div>`).join('')}
        <div class="goal-keeper" id="goal-keeper" style="left:50%;top:60%;">${keeperIconSvg(keeperKit.shirt, keeperKit.trim)}</div>
        <div class="goal-ball" id="goal-ball" style="left:50%;top:96%;">⚽</div>
        <div class="goal-result-banner" id="goal-banner"></div>
      </div>
    </div>
  `;
}

function wireGoalZones(onZoneClick) {
  const zones = document.querySelectorAll('#goal-wrap .goal-zone');
  let done = false;
  zones.forEach((z) => {
    z.addEventListener('click', () => {
      if (done) return;
      done = true;
      zones.forEach((zz) => { zz.style.pointerEvents = 'none'; });
      onZoneClick(z.getAttribute('data-zone'));
    });
  });
}

function animatePenaltyResult(side) {
  const s = Engine.state;
  const pen = s.pendingMatch.penalty;
  const ball = document.getElementById('goal-ball');
  const keeper = document.getElementById('goal-keeper');
  const banner = document.getElementById('goal-banner');
  if (!ball || !keeper || !banner) return;

  const shotZone = side === 'user' ? pen.direction : pen.shooterZone;
  const keeperZone = side === 'user' ? pen.keeperZone : pen.direction;
  const resultado = pen.resultado || (pen.scored ? 'gol' : 'atajada');
  const ballTarget = goalZoneCenter(shotZone);
  const keeperTarget = keeperSpot(keeperZone);

  // Que la animación cuente exactamente lo que pasó:
  //
  // - errado: la pelota NO puede terminar adentro del arco. Se va contra el
  //   palo o por arriba del travesaño, según a qué altura fue el remate.
  //   (No se puede mandar más afuera todavía porque .goal-wrap recorta lo que
  //   se sale, así que el borde del marco es lo más lejos que llega.)
  // - gol con el arquero en el palo correcto: si los dos van al mismo punto,
  //   se ve al arquero tapando la pelota y el cartel diciendo GOL. Se lo corre
  //   un poco al costado para que se lea "llegó a tocarla pero se le escapó".
  const zona = PENALTY_ZONES.find((z) => z.id === shotZone);
  if (resultado === 'errado') {
    if (zona.row === 0) ball.style.top = '2%';                 // por arriba del travesaño
    else ball.style.left = zona.col === 2 ? '97%' : '3%';      // contra el palo
    if (zona.row === 0) ball.style.left = `${ballTarget.leftPct}%`;
    else ball.style.top = `${ballTarget.topPct}%`;
  } else {
    ball.style.left = `${ballTarget.leftPct}%`;
    ball.style.top = `${ballTarget.topPct}%`;
  }

  const corrido = resultado === 'gol' && pen.atajadoEnElPalo ? (zona.col === 0 ? 9 : -9) : 0;
  keeper.style.left = `${keeperTarget.leftPct + corrido}%`;
  keeper.style.top = `${keeperTarget.topPct}%`;

  setTimeout(() => {
    const carteles = {
      gol: ['¡GOL!', 'gol'],
      atajada: ['¡ATAJADA!', 'atajada'],
      errado: [zona.row === 0 ? '¡POR ARRIBA!' : '¡AL PALO!', 'errado'],
    };
    const [texto, clase] = carteles[resultado];
    banner.textContent = texto;
    banner.className = `goal-result-banner show ${clase}`;
  }, 650);

  setTimeout(() => { render(); }, 2000);
}

let penaltyShooterId = null;

function renderPenalty() {
  penaltyShooterId = null;
  drawPenalty();
}

function drawPenalty() {
  const s = Engine.state;
  const pen = s.pendingMatch.penalty;
  const opponent = Engine.getClub(s.pendingMatch.opponentId);

  if (pen.side === 'user') {
    const shooters = Engine.getPenaltyShooters();
    const rivalKit = { shirt: '#6b7280', trim: '#111827' };
    app.innerHTML = `
      ${header()}
      <div class="card">
        <h2>¡Penal a favor!</h2>
        <p>Elegí quién lo patea.</p>
        <div class="options" id="shooter-list">
          ${shooters.map((p) => `
            <button class="option-btn small${p.id === penaltyShooterId ? ' active' : ''}" data-player="${p.id}">${p.name} (${p.rating})</button>
          `).join('')}
        </div>
        ${penaltyShooterId ? `<p class="muted">Ahora tocá el lugar del arco donde quiere patear ${shooters.find((p) => p.id === penaltyShooterId).name}.</p>${goalWidgetHtml(rivalKit)}` : ''}
      </div>
    `;
    app.querySelectorAll('#shooter-list .option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        penaltyShooterId = btn.dataset.player;
        drawPenalty();
      });
    });
    if (penaltyShooterId) {
      const shooter = shooters.find((p) => p.id === penaltyShooterId);
      wireGoalZones((zoneId) => {
        Engine.resolvePenalty(zoneId, shooter);
        animatePenaltyResult('user');
      });
    }
  } else {
    const keeper = Engine.getUserKeeper();
    const kit = clubKit(Engine.getClub(s.clubId));
    app.innerHTML = `
      ${header()}
      <div class="card">
        <h2>Penal en contra</h2>
        <p>${opponent.name} va a patear. Elegí para dónde se tira ${keeper.name}.</p>
        ${goalWidgetHtml(kit)}
      </div>
    `;
    wireGoalZones((zoneId) => {
      Engine.resolvePenalty(zoneId, keeper);
      animatePenaltyResult('rival');
    });
  }
}

function renderMatchResult() {
  const s = Engine.state;
  const m = s.pendingMatch;
  const home = Engine.getClub(m.home);
  const away = Engine.getClub(m.away);
  const winner = Engine.matchWinnerId(m);
  const userWon = winner === s.clubId;
  const draw = winner === null;
  const resultClass = draw ? 'result-draw' : userWon ? 'result-win' : 'result-loss';
  const isFinalStage = m.context === 'bracket' && s.bracket && s.bracket.pendingIsFinal;

  let penaltyText = '';
  if (m.penalty) {
    const dirLabel = zoneLabel(m.penalty.direction);
    const resultado = m.penalty.resultado || (m.penalty.scored ? 'gol' : 'atajada');
    if (m.penalty.side === 'user') {
      penaltyText = {
        gol: `${m.penalty.shooterName} pateó ${dirLabel} y marcó el penal.`,
        atajada: `${m.penalty.shooterName} pateó ${dirLabel} y el arquero adivinó el palo: se lo contuvo.`,
        errado: `${m.penalty.shooterName} pateó ${dirLabel} y la mandó afuera. El arquero ni se enteró.`,
      }[resultado];
    } else {
      penaltyText = {
        gol: `Tu arquero se tiró ${dirLabel} y no llegó: gol de penal rival.`,
        atajada: `Tu arquero se tiró ${dirLabel}, adivinó el palo y ¡atajó el penal!`,
        errado: `Tu arquero se tiró ${dirLabel} y no hizo falta: el rival la tiró afuera.`,
      }[resultado];
    }
  }

  const shootoutText = m.shootout
    ? `Se definió por penales: ${home.name} ${m.shootout.homeScore} - ${m.shootout.awayScore} ${away.name}.`
    : m.extraTime
      ? `Se definió en el alargue, con ${m.extraTime.homeGoals + m.extraTime.awayGoals === 1 ? 'un gol' : `${m.extraTime.homeGoals + m.extraTime.awayGoals} goles`} en los 30 minutos extra.`
      : '';

  const contextLabel = m.context === 'bracket' ? competitionLabel() : 'Liga';

  // Cabecera bien visible del desenlace: quién sale campeón si es la final,
  // o directamente si ganaste/empataste/perdiste. Esto además deja clarísimo
  // que un empate en una instancia eliminatoria SIEMPRE termina definido por
  // penales (nunca queda un partido "sin ganador").
  let outcomeBanner;
  if (isFinalStage) {
    const championName = Engine.getClub(winner).name;
    outcomeBanner = userWon ? `🏆 ¡SOS CAMPEÓN! ${championName} se queda con el título.` : `🏆 Campeón: ${championName}.`;
  } else if (m.context === 'bracket') {
    outcomeBanner = userWon ? '✅ Avanzás de ronda' : '❌ Quedás eliminado';
  } else if (draw) {
    outcomeBanner = '🤝 Empate';
  } else {
    outcomeBanner = userWon ? '⚽ ¡Victoria!' : '😔 Derrota';
  }

  app.innerHTML = `
    ${header()}
    <div class="card ${resultClass}">
      <h2>Resultado — ${contextLabel}</h2>
      <p class="outcome-banner">${outcomeBanner}</p>
      <div class="scoreline">${home.name} <strong>${m.homeGoals}</strong> - <strong>${m.awayGoals}</strong> ${away.name}</div>
      ${penaltyText ? `<p class="muted">${penaltyText}</p>` : ''}
      ${shootoutText ? `<p class="shootout-line">${shootoutText}</p>` : ''}
      ${s.lastDecisionNote ? `<p class="muted">${s.lastDecisionNote}</p>` : ''}
      ${(s.lastAvailabilityNotes || []).length ? `
        <div class="injury-notes">
          <h3>Parte médico</h3>
          ${s.lastAvailabilityNotes.map((n) => `<p>${n}</p>`).join('')}
        </div>
      ` : ''}
      ${(s.lastDevelopmentNotes || []).length ? `
        <div class="injury-notes desarrollo-notes">
          <h3>Evolución del plantel</h3>
          ${s.lastDevelopmentNotes.map((n) => `<p>${n}</p>`).join('')}
        </div>
      ` : ''}
      <button class="option-btn" id="continue-btn">Continuar</button>
    </div>
  `;
  document.getElementById('continue-btn').addEventListener('click', () => { Engine.finishMatchAndAdvance(); render(); });
}

function renderContractRenewal() {
  const s = Engine.state;
  const playerId = s.contractQueue[0];
  const player = s.squad.find((p) => p.id === playerId);
  const renewCost = Math.round(player.rating * 8000);
  const soleAtPosition = s.squad.filter((p) => p.pos === player.pos).length <= 1;
  const canRelease = s.squad.length > MIN_SQUAD && !soleAtPosition;

  app.innerHTML = `
    ${header()}
    <div class="card">
      <h2>Contrato por vencer</h2>
      <p>El contrato de <strong>${player.name}</strong> (${player.pos}, ${player.rating}, ${player.age} años) termina a fin de esta temporada.</p>
      <div class="options">
        <button class="option-btn" id="renew-btn">Renovar por ${money(renewCost)}</button>
        <button class="option-btn danger" id="release-btn" ${canRelease ? '' : 'disabled'}>Dejarlo ir a fin de año</button>
      </div>
      ${!canRelease ? `<p class="muted">No podés dejarlo ir: ${soleAtPosition ? 'es el único que te queda en esa posición' : 'el plantel ya está en el mínimo jugable'}.</p>` : ''}
    </div>
  `;
  document.getElementById('renew-btn').addEventListener('click', () => { Engine.resolveContractDecision(true); render(); });
  if (canRelease) {
    document.getElementById('release-btn').addEventListener('click', () => { Engine.resolveContractDecision(false); render(); });
  }
}

function renderTransfer() {
  const s = Engine.state;
  const windowLabel = {
    'between-editions': 'Mercado de pases — entre el Apertura y el Clausura',
    'pre-season': 'Mercado de pases — pretemporada',
  }[s.season.transferReason] || 'Mercado de pases — mitad de temporada';
  app.innerHTML = `
    ${header()}
    <div class="card">
      <h2>${windowLabel}</h2>
      <p class="muted">Tenés ${money(s.budget)} y ${s.squad.length} jugadores en el plantel (máximo ${MAX_SQUAD}). Un refuerzo suma al plantel; si está lleno, primero tenés que vender.</p>
      ${(s.notasMercado || []).length ? `
        <div class="mercado-acuerdos">
          <strong>Se concretaron los acuerdos que veníamos negociando</strong>
          <ul>${s.notasMercado.map((n) => `<li>${n}</li>`).join('')}</ul>
        </div>
      ` : ''}
      <h3>Ofertas disponibles</h3>
      <div class="options" id="market-list">
        ${s.market.map((p, i) => {
          const caro = s.budget < p.price;
          const lleno = s.squad.length >= MAX_SQUAD;
          return `
          <div class="pick-row">
            <span>${p.name} — ${p.pos} (${p.rating}, ${p.age} años) — <strong>${money(p.price)}</strong>${caro ? ' <span class="muted">(no te alcanza)</span>' : ''}</span>
            <button class="option-btn small" data-i="${i}" ${caro || lleno ? 'disabled' : ''}>Comprar</button>
          </div>
        `;
        }).join('') || '<p class="muted">No quedan ofertas esta ronda.</p>'}
      </div>
      <details class="collapsible">
        <summary>Vender jugadores de tu plantel (${s.squad.length})</summary>
        <div class="collapsible-body">
          ${s.squad.length <= MIN_SQUAD ? `<p class="muted">No podés vender más: el plantel está en el mínimo de ${MIN_SQUAD} jugadores.</p>` : ''}
          <div class="options" id="squad-list">
            ${[...s.squad].map((p, i) => ({ p, i })).sort((a, b) => b.p.rating - a.p.rating).map(({ p, i }) => `
              <div class="pick-row">
                <span>${p.name} — ${p.pos} (${p.rating}, ${p.age} años) — contrato hasta fin de ${p.contractYears > 1 ? `${p.contractYears} temporadas` : '1 temporada'}</span>
                <button class="option-btn small danger" data-i="${i}" ${s.squad.length <= MIN_SQUAD ? 'disabled' : ''}>Vender por ${money(Engine.sellValue(p))}</button>
              </div>
            `).join('')}
          </div>
        </div>
      </details>
      <button class="option-btn" id="continue-btn">Continuar temporada</button>
    </div>
  `;
  app.querySelectorAll('#market-list button').forEach((btn) => {
    btn.addEventListener('click', () => { Engine.buyPlayer(Number(btn.dataset.i)); render(); });
  });
  app.querySelectorAll('#squad-list button').forEach((btn) => {
    btn.addEventListener('click', () => { Engine.sellPlayer(Number(btn.dataset.i)); render(); });
  });
  document.getElementById('continue-btn').addEventListener('click', () => { Engine.continueFromTransfer(); render(); });
}

function renderFifaBreak() {
  const s = Engine.state;
  const ev = s.fifaEvent;

  if (ev.callUps.length === 0) {
    app.innerHTML = `
      ${header()}
      <div class="card">
        <h2>Fecha FIFA</h2>
        <p>La liga se detiene por la fecha FIFA. Esta vez ninguno de tus jugadores fue convocado a su selección.</p>
        <button class="option-btn" id="continue-btn">Continuar</button>
      </div>
    `;
    document.getElementById('continue-btn').addEventListener('click', () => { Engine.continueFromFifa(); render(); });
    return;
  }

  if (!ev.resolved) {
    app.innerHTML = `
      ${header()}
      <div class="card">
        <h2>Fecha FIFA — Convocatorias</h2>
        <p>La liga se detiene. Estos jugadores tuyos fueron convocados a su selección:</p>
        <ul>
          ${ev.callUps.map((p) => `<li>${nationFlag(p.nation)} ${p.name} (${p.rating}) — ${Engine.nationName(p.nation)}</li>`).join('')}
        </ul>
        <p class="muted">¿Le pedís a la selección que le cuide los minutos para reducir el riesgo de lesión?</p>
        <div class="options">
          <button class="option-btn" id="care-btn">Pedir que le cuiden los minutos</button>
          <button class="option-btn" id="nocare-btn">No intervenir</button>
        </div>
      </div>
    `;
    document.getElementById('care-btn').addEventListener('click', () => { Engine.resolveFifaEvent(true); render(); });
    document.getElementById('nocare-btn').addEventListener('click', () => { Engine.resolveFifaEvent(false); render(); });
    return;
  }

  app.innerHTML = `
    ${header()}
    <div class="card">
      <h2>Fecha FIFA — Resumen</h2>
      <ul>${ev.results.map((r) => `<li>${r}</li>`).join('')}</ul>
      <button class="option-btn" id="continue-btn">Continuar</button>
    </div>
  `;
  document.getElementById('continue-btn').addEventListener('click', () => { Engine.continueFromFifa(); render(); });
}

function renderSeasonEnd() {
  const s = Engine.state;
  const sum = s.lastSeasonSummary;
  const pos = sum.myZoneTable.findIndex((r) => r.id === s.clubId) + 1;

  let torneosText;
  if (sum.userWasAperturaChampion && sum.userWasClausuraChampion) torneosText = '¡Ganaste el Apertura Y el Clausura!';
  else if (sum.userWasAperturaChampion) torneosText = `¡Ganaste el Apertura! Clausura: campeón ${sum.clausuraChampion}.`;
  else if (sum.userWasClausuraChampion) torneosText = `¡Ganaste el Clausura! Apertura: campeón ${sum.aperturaChampion}.`;
  else torneosText = `Campeón del Apertura: ${sum.aperturaChampion || '—'}. Campeón del Clausura: ${sum.clausuraChampion || '—'}.`;

  const copaText = sum.userWonCopa
    ? '¡Sos el campeón de la Copa Argentina!'
    : `Campeón de la Copa Argentina: ${sum.copaChampionName || '—'}.`;

  let ascensoText = '';
  if (!sum.isD1) {
    if (sum.userPromotedDirect) ascensoText = '¡Ascendiste ganando la Final directa entre líderes de zona!';
    else if (sum.userPromotedReducido) ascensoText = '¡Ascendiste ganando el Torneo Reducido!';
    else ascensoText = `Ascenso directo: ${sum.d2PromotedDirect}. Ascenso por Reducido: ${sum.d2PromotedReducido}.`;
  }

  const movementText = sum.userRelegated
    ? 'Descendiste a Primera Nacional para la próxima temporada.'
    : sum.userPromoted
      ? '¡Lograste el ascenso a Primera División!'
      : `Seguís en ${sum.isD1 ? 'Primera División' : 'Primera Nacional'} la próxima temporada.`;

  // Lo que ganaste este año, para la vitrina de arriba de todo.
  const trofeos = [];
  if (sum.userWasAperturaChampion) trofeos.push('Campeón del Apertura');
  if (sum.userWasClausuraChampion) trofeos.push('Campeón del Clausura');
  if (sum.userWonCopa) trofeos.push('Campeón de la Copa Argentina');
  (sum.copasInternacionales || []).forEach((c) => { if (c.userWon) trofeos.push(`Campeón de la ${nombreDeCopa(c)}`); });
  if (sum.userPromotedDirect || sum.userPromotedReducido) trofeos.push('Ascenso a Primera División');

  // Si no la ganaste pero jugaste una copa internacional, igual va arriba:
  // es de las cosas que más te interesa saber apenas termina el año.
  const copasDeTuClub = (sum.copasInternacionales || [])
    .filter((c) => !c.userWon && c.userStage)
    .map((c) => `En la ${nombreDeCopa(c)} llegaste hasta ${c.userStage}.`);

  const bloque = (titulo, contenido) => `
    <details class="collapsible">
      <summary>${titulo}</summary>
      <div class="collapsible-body">${contenido}</div>
    </details>
  `;

  app.innerHTML = `
    <div class="card">
      <h1>Fin de temporada — Año ${s.season.year}</h1>

      <div class="season-summary">
        <p>Terminaste <strong>${pos}°</strong> en tu zona con ${sum.myZoneTable[pos - 1].pts} puntos.</p>
        ${trofeos.length
          ? `<ul class="trophy-list">${trofeos.map((t) => `<li>${t}</li>`).join('')}</ul>`
          : '<p class="muted">Este año se terminó sin títulos.</p>'}
        ${copasDeTuClub.map((t) => `<p class="muted">${t}</p>`).join('')}
        <p class="season-movement">${movementText}</p>
        <p class="muted">${sum.economyNote}</p>
      </div>

      ${bloque('Tabla de tu zona', `
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>#</th><th>Club</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>Pts</th></tr></thead>
            <tbody>
              ${sum.myZoneTable.map((r, i) => `
                <tr class="${r.id === s.clubId ? 'me' : ''}">
                  <td>${i + 1}</td><td>${r.name}</td><td>${r.played}</td><td>${r.win}</td><td>${r.draw}</td><td>${r.loss}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.pts}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `)}

      ${bloque('Campeones del año', `
        <p>${torneosText}</p>
        <p>${copaText}</p>
        ${!sum.isD1 ? `<p>${ascensoText}</p>` : ''}
      `)}

      ${sum.copasInternacionales && sum.copasInternacionales.length
        ? bloque('Copas internacionales', copasResultHtml(sum.copasInternacionales))
        : ''}

      ${sum.qualification.length ? bloque('Clasificados a las copas del año que viene', `
        <ul>
          ${sum.qualification.map((q) => `<li${q.clubId === s.clubId ? ' class="me-line"' : ''}>${q.name} — ${q.comp} (${q.stage})</li>`).join('')}
        </ul>
      `) : ''}

      ${bloque('Ascensos y descensos', `
        <p class="muted">Descendieron (los dos últimos de la tabla anual): ${sum.relegated.join(', ')}.</p>
        <p class="muted">Ascendieron (Final directa + Reducido): ${sum.promoted.join(', ')}.</p>
      `)}

      <button class="option-btn" id="continue-season-btn">Comenzar nueva temporada</button>
      <button class="option-btn danger" id="restart-btn">Empezar de cero con otro club</button>
    </div>
  `;
  document.getElementById('continue-season-btn').addEventListener('click', () => { Engine.startNewSeason(); render(); });
  document.getElementById('restart-btn').addEventListener('click', () => { Engine.resetGame(); render(); });
}

// ---------- Panel del mercado de pases ----------
//
// En la PC vive abajo del bloque de noticias (los dos están en la columna
// del medio, ver .center-col en style.css); en el celular es la cuarta
// pestaña. Es el mismo HTML en los dos lados, no hay versión duplicada.
//
// La lógica de planteles, estados y negociación está toda en js/mercado.js.
// Acá solo se dibuja y se enganchan los botones.

let mercadoClubId = null;   // club que se está mirando
let mercadoBusqueda = '';   // texto del buscador

function mercadoEstadoPill(estado) {
  const e = MERCADO_ESTADOS[estado];
  if (!e) return '';
  return `<span class="mercado-pill" style="background:${e.color}1f;color:${e.color};border-color:${e.color}55;">${e.label}</span>`;
}

// Qué se muestra como valor según en qué situación está el jugador. Antes de
// consultarlo solo se ve un rango estimado; después, el número exacto.
function mercadoValorTexto(j) {
  if (j.estado === 'fin-contrato') {
    return `Libre en ${j.meses} ${j.meses === 1 ? 'mes' : 'meses'} · prima ${j.consultado ? Mercado.plata(j.prima) : Mercado.rango(j.prima)}`;
  }
  if (j.estado === 'clausula') return `Cláusula ${Mercado.plata(j.precio)}`;
  if (j.estado === 'intocable') return `No está en venta · vale ${Mercado.plata(j.valor)}`;
  return j.consultado ? Mercado.plata(j.precio) : Mercado.rango(j.precio);
}

function mercadoBotonNegociar(j) {
  if (j.estado === 'intocable') return 'Insistir igual';
  if (j.estado === 'fin-contrato') return 'Tentar libre';
  if (j.estado === 'clausula') return 'Pagar cláusula';
  return 'Hacer oferta';
}

function mercadoJugadorHtml(j) {
  const detalle = j.posDetail && POS_DETAIL_ABBREV[j.posDetail] ? POS_DETAIL_ABBREV[j.posDetail] : j.pos;
  const respuesta = Engine.state.mercado.respuestas[j.id];
  const bloqueado = j.acordado || j.rechazado || !!j.loanFrom;
  return `
    <li class="mercado-jugador${j.acordado ? ' acordado' : ''}">
      <div class="mercado-jugador-datos">
        <div class="mercado-jugador-nombre">
          <strong>${j.name}</strong>
          <span class="muted">${detalle} · ${j.rating} · ${j.age} años</span>
        </div>
        ${mercadoEstadoPill(j.estado)}
      </div>
      <div class="mercado-valor">${mercadoValorTexto(j)}</div>
      ${j.loanFrom ? `<p class="muted mercado-nota">A préstamo de ${j.loanFrom}: el club no lo puede vender.</p>` : ''}
      ${respuesta ? `<p class="mercado-respuesta">${respuesta}</p>` : ''}
      <div class="mercado-acciones">
        <button class="option-btn small" data-mercado-consultar="${j.id}">Consultar</button>
        ${j.acordado
          ? `<button class="option-btn small danger" data-mercado-cancelar="${j.id}">Cancelar acuerdo</button>`
          : `<button class="option-btn small" data-mercado-negociar="${j.id}" ${bloqueado ? 'disabled' : ''}>${mercadoBotonNegociar(j)}</button>`}
        ${!j.acordado && j.clausula && j.estado !== 'clausula' && j.estado !== 'fin-contrato'
          ? `<button class="option-btn small" data-mercado-clausula="${j.id}" ${j.loanFrom ? 'disabled' : ''}>Pagar cláusula ${Mercado.plata(j.clausula)}</button>`
          : ''}
      </div>
    </li>
  `;
}

// ---------- De dónde sale la plata ----------
//
// El presupuesto ya no aparece y desaparece sin explicación: cada ingreso y
// cada gasto queda anotado (ver Economia.registrar) y acá se listan los
// últimos. Va colapsado adentro del panel del mercado, que es donde importa
// saber con cuánto contás.

function finanzasHtml() {
  const s = Engine.state;
  const f = s.finanzas;
  if (!f || !f.movimientos.length) return '';
  const club = Engine.getClub(s.clubId);
  const resumen = Economia.resumenAnual(club);
  return `
    <details class="collapsible finanzas">
      <summary>De dónde sale la plata</summary>
      <div class="collapsible-body">
        <p class="muted finanzas-resumen">
          Entran <strong>${money(resumen.semanal)}</strong> por semana de TV, sponsors y cuota social,
          más <strong>${money(resumen.local)}</strong> cada partido de local.
          Balance de la temporada: <strong class="${f.totalTemporada >= 0 ? 'finanzas-positivo' : 'finanzas-negativo'}">${f.totalTemporada >= 0 ? '+' : ''}${money(f.totalTemporada)}</strong>.
        </p>
        <ul class="finanzas-lista">
          ${f.movimientos.map((m) => `
            <li>
              <span class="finanzas-concepto">${m.concepto}</span>
              <span class="finanzas-monto ${m.monto >= 0 ? 'finanzas-positivo' : 'finanzas-negativo'}">${m.monto >= 0 ? '+' : ''}${money(m.monto)}</span>
              <span class="finanzas-fecha muted">${formatCalendarDate(m.dia)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    </details>
  `;
}

function renderMarketPanel() {
  const panel = document.getElementById('market-panel');
  if (!panel) return;
  const s = Engine.state;
  // Sin temporada armada (elegir DT / elegir club) no hay mercado que mostrar.
  if (!s || !s.clubId || !s.season) { panel.innerHTML = ''; return; }
  Mercado.init(s);

  const clubes = Mercado.clubes(Engine);
  const filtro = mercadoBusqueda.trim().toLowerCase();
  const filtrados = filtro ? clubes.filter((c) => c.name.toLowerCase().includes(filtro)) : clubes;
  const elegido = mercadoClubId && clubes.some((c) => c.id === mercadoClubId) ? mercadoClubId : null;
  const acuerdos = s.mercado.acuerdos;

  const listaClubes = filtrados.length
    ? filtrados.map((c) => `
        <button class="mercado-club ${c.id === elegido ? 'active' : ''}" data-mercado-club="${c.id}">
          ${clubCrest(c, 20)}<span>${c.name}</span>
          <span class="muted mercado-club-div">${c.division === 'D1' ? '1ª' : 'Nac'}</span>
        </button>
      `).join('')
    : '<p class="muted">Ningún club coincide con esa búsqueda.</p>';

  const jugadores = elegido ? Mercado.plantel(Engine, elegido) : [];

  panel.innerHTML = `
    <div class="card mercado-card">
      <div class="mercado-cabecera"><h3>Mercado de pases</h3><span class="muted">${money(s.budget)}</span></div>
      <p class="muted mercado-aviso">Podés negociar cuando quieras, pero nada se firma hasta que abra el mercado (al terminar el Apertura y en la pretemporada). Un acuerdo cerrado se concreta ahí.</p>
      ${finanzasHtml()}

      ${acuerdos.length ? `
        <div class="mercado-acuerdos">
          <strong>Acuerdos cerrados (${acuerdos.length})</strong>
          <ul>
            ${acuerdos.map((a) => `<li>${a.jugador.name} <span class="muted">— ${Engine.getClub(a.clubId).name} · ${Mercado.plata(a.precio)}</span></li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <input id="mercado-buscador" class="text-input" type="text" placeholder="Buscar club…" value="${mercadoBusqueda.replace(/"/g, '&quot;')}" />
      <div class="mercado-clubes">${listaClubes}</div>

      ${elegido ? `
        <div class="mercado-plantel">
          <div class="mercado-plantel-titulo">${clubCrest(Engine.getClub(elegido), 24)}<strong>${Engine.getClub(elegido).name}</strong></div>
          <ul class="mercado-lista">${jugadores.map(mercadoJugadorHtml).join('')}</ul>
        </div>
      ` : '<p class="muted">Elegí un club para ver cómo está cada jugador de contrato.</p>'}
    </div>
  `;

  const buscador = document.getElementById('mercado-buscador');
  if (buscador) {
    buscador.addEventListener('input', (ev) => {
      mercadoBusqueda = ev.target.value;
      renderMarketPanel();
      // Escribir no debe hacer perder el foco ni el cursor.
      const nuevo = document.getElementById('mercado-buscador');
      if (nuevo) { nuevo.focus(); nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length); }
    });
  }
  panel.querySelectorAll('[data-mercado-club]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mercadoClubId = btn.dataset.mercadoClub === mercadoClubId ? null : btn.dataset.mercadoClub;
      renderMarketPanel();
    });
  });
  panel.querySelectorAll('[data-mercado-consultar]').forEach((btn) => {
    btn.addEventListener('click', () => { Mercado.consultar(Engine, elegido, btn.dataset.mercadoConsultar); renderMarketPanel(); });
  });
  panel.querySelectorAll('[data-mercado-negociar]').forEach((btn) => {
    btn.addEventListener('click', () => { Mercado.negociar(Engine, elegido, btn.dataset.mercadoNegociar); renderMarketPanel(); });
  });
  panel.querySelectorAll('[data-mercado-clausula]').forEach((btn) => {
    btn.addEventListener('click', () => { Mercado.negociar(Engine, elegido, btn.dataset.mercadoClausula, true); renderMarketPanel(); });
  });
  panel.querySelectorAll('[data-mercado-cancelar]').forEach((btn) => {
    btn.addEventListener('click', () => { Mercado.cancelarAcuerdo(Engine, btn.dataset.mercadoCancelar); renderMarketPanel(); });
  });
}

// Barra de pestañas de solo celular (vertical): cambia cuál de los 4
// paneles se ve sin tener que scrollear (Tabla, Partido, Plantel, Mercado).
// En PC / celular horizontal esta barra está oculta y los paneles se ven
// todos juntos, con el mercado abajo del partido (ver style.css).
function setupMobileTabs() {
  const layout = document.querySelector('.layout');
  const buttons = document.querySelectorAll('#mobile-tabs button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      layout.dataset.view = btn.dataset.view;
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
}

function init() {
  if (Engine.hasSave()) {
    Engine.load();
  } else {
    Engine.state = { screen: 'dt-create' };
  }
  setupMobileTabs();
  render();
}

init();
