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
  'defensor central': 'DFC',
  'mediocampista defensivo': 'MCD',
  'mediocampista mixto': 'MC',
  'mediocampista ofensivo': 'MCO',
  'volante por izquierda': 'MI',
  'volante por derecha': 'MD',
  'delantero centro': 'DC',
  'extremo izquierdo': 'EI',
  'extremo derecho': 'ED',
};
function posDetailAbbrev(posDetail) {
  return POS_DETAIL_ABBREV[posDetail] || null;
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
// El panel tiene 3 vistas que se recorren con flechas: tu zona, la otra zona
// de tu misma división (las dos están siempre simuladas en paralelo), y un
// resumen de la última clasificación a copas internacionales (Libertadores /
// Sudamericana todavía no se juegan partido a partido, así que no hay una
// "tabla" en vivo — se muestra el resultado de la última vez que se definió).
function renderTablePanel() {
  const s = Engine.state;
  if (!s || !s.season) { tablePanel.innerHTML = ''; return; }
  const club = Engine.getClub(s.clubId);
  const myZoneLetter = s.season.myZone;
  const otherZoneLetter = myZoneLetter === 'A' ? 'B' : 'A';

  const tabs = [
    { id: 'mine', label: `Zona ${myZoneLetter}` },
    { id: 'other', label: `Zona ${otherZoneLetter}` },
    { id: 'copas', label: 'Copas' },
  ];
  const activeIndex = tabs.findIndex((t) => t.id === tablePanelTab);
  const prevTab = tabs[(activeIndex - 1 + tabs.length) % tabs.length];
  const nextTab = tabs[(activeIndex + 1) % tabs.length];

  let body;
  if (tablePanelTab === 'copas') {
    const sum = s.lastSeasonSummary;
    if (sum && sum.qualification && sum.qualification.length) {
      body = `
        <p class="muted">Clasificación definida a fin de la temporada anterior (Libertadores/Sudamericana no se juegan partido a partido todavía):</p>
        <ul>
          ${sum.qualification.map((q) => `<li${q.clubId === s.clubId ? ' class="me-line"' : ''}>${q.name} — ${q.comp} (${q.stage})</li>`).join('')}
        </ul>
      `;
    } else {
      body = '<p class="muted">Todavía no se definió ninguna clasificación a copas internacionales (se sabe recién a fin de temporada).</p>';
    }
  } else {
    const zoneKey = `${s.season.myDivision}-${tablePanelTab === 'mine' ? myZoneLetter : otherZoneLetter}`;
    const zoneData = s.season.zones[zoneKey];
    const table = zoneData ? Engine.sortTable(zoneData.table) : [];
    body = `
      <div class="table-wrap">
        <table class="table compact">
          <thead><tr><th>#</th><th>Club</th><th>PJ</th><th>Pts</th></tr></thead>
          <tbody>
            ${table.map((r, i) => `<tr class="${r.id === s.clubId ? 'me' : ''}"><td>${i + 1}</td><td>${r.name}</td><td>${r.played}</td><td>${r.pts}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const heading = tablePanelTab === 'copas' ? 'Copas' : `Tabla — ${tabs[activeIndex].label}`;
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
function buildPitchSvg(xi, club) {
  const rows = [
    { players: xi.del },
    ...(xi.off.length ? [{ players: xi.off }] : []),
    { players: xi.med },
    { players: xi.def },
    { players: xi.gk },
  ];
  const maxCols = Math.max(...rows.map((r) => r.players.length), 1);
  const svgWidth = 2 * PITCH_MARGIN_X + maxCols * PITCH_JERSEY_W + Math.max(0, maxCols - 1) * PITCH_COL_GAP;
  const rowContentH = PITCH_JERSEY_H + PITCH_LABEL_H + PITCH_LABEL2_H + 8;
  const svgHeight = 2 * PITCH_MARGIN_Y + Math.max(0, rows.length - 1) * PITCH_ROW_H + rowContentH;
  const fieldInnerWidth = svgWidth - 2 * PITCH_MARGIN_X;

  let playersMarkup = '';
  rows.forEach((row, i) => {
    const count = row.players.length;
    const rowWidth = count * PITCH_JERSEY_W + Math.max(0, count - 1) * PITCH_COL_GAP;
    const rowStartX = PITCH_MARGIN_X + (fieldInnerWidth - rowWidth) / 2;
    const y = PITCH_MARGIN_Y + i * PITCH_ROW_H;
    row.players.forEach((p, j) => {
      const x = rowStartX + j * (PITCH_JERSEY_W + PITCH_COL_GAP);
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
  Engine.swapPlayers(selectedPlayerId, id);
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
          return `
          <div class="pick-row player-chip-row ${p.id === selectedPlayerId ? 'selected' : ''}" data-player="${p.id}">
            <span>${p.number != null ? `#${p.number} ` : ''}${p.name} — ${p.pos}${detail} (${p.rating})</span>
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
            <strong>${n.flag} ${n.name}</strong>
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

function renderClubSelect() {
  const clubs = CLUB_TEMPLATES.filter((c) => c.division === selectDivision && c.zone === selectZone);
  app.innerHTML = `
    <div class="card">
      <h1>Elegí tu club</h1>
      <p class="muted">Dirigís una temporada completa: liga (con playoffs si jugás en Primera), Copa Argentina, fechas FIFA y mercado de pases a mitad de año.</p>
      <div class="tabs">
        <button class="tab-btn ${selectDivision === 'D1' ? 'active' : ''}" data-division="D1">Primera División</button>
        <button class="tab-btn ${selectDivision === 'D2' ? 'active' : ''}" data-division="D2">Primera Nacional</button>
      </div>
      <div class="tabs">
        <button class="tab-btn ${selectZone === 'A' ? 'active' : ''}" data-zone="A">Zona A</button>
        <button class="tab-btn ${selectZone === 'B' ? 'active' : ''}" data-zone="B">Zona B</button>
      </div>
      <div class="club-grid">
        ${clubs.map((c) => `
          <button class="club-btn" data-club="${c.id}">
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
    return `${editionLabel}Fecha ${s.season.roundIndex + 1} de ${s.season.totalRounds}`;
  }
  if (ctx.context === 'bracket') return Engine.bracketStageLabel();
  return '';
}

function header() {
  const s = Engine.state;
  const club = Engine.getClub(s.clubId);
  const zoneKey = Engine.myZoneKey();
  const table = Engine.sortTable(s.season.zones[zoneKey].table);
  const pos = table.findIndex((r) => r.id === s.clubId) + 1;
  const divisionName = club.division === 'D1' ? 'Primera División' : 'Primera Nacional';
  const dt = s.dt;
  const dtNation = dt && NATIONS.find((n) => n.code === dt.nation);
  const dtLine = dt ? `<div class="muted">DT: ${dtNation ? dtNation.flag : ''} ${dt.name}</div>` : '';
  const objectiveLine = s.objective ? `<div class="muted">Objetivo de la dirigencia: ${s.objective.text}</div>` : '';
  return `
    <div class="topbar">
      <div><strong>${club.name}</strong> <span class="muted">— ${divisionName}, Zona ${club.zone}</span></div>
      ${dtLine}
      ${objectiveLine}
      <div class="muted">${competitionLabel()}</div>
      <div class="muted">Presupuesto: ${money(s.budget)} · Posición en zona: ${pos}°/${table.length} · Ánimo: ${s.morale}</div>
      <button class="option-btn small danger" id="end-career-btn">Terminar carrera</button>
    </div>
  `;
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
    `;
    app.querySelectorAll('#calendar-message-options .option-btn').forEach((btn) => {
      btn.addEventListener('click', () => { Engine.answerCalendarMessage(Number(btn.dataset.i)); render(); });
    });
    return;
  }

  app.innerHTML = `
    ${header()}
    <div class="card">
      <h2>${dateLabel}</h2>
      <p class="muted">${s.lastDecisionNote ? s.lastDecisionNote : 'Otro día tranquilo en el club.'}</p>
      <button class="option-btn" id="continue-btn">Avanzar</button>
    </div>
  `;
  document.getElementById('continue-btn').addEventListener('click', () => {
    s.lastDecisionNote = null;
    Engine.advanceCalendarDay();
    render();
  });
}

function renderPreMatch() {
  const s = Engine.state;
  const d = s.currentDecision;
  const ctx = s.matchContext;
  const opponent = Engine.getClub(ctx.opponentId);

  app.innerHTML = `
    ${header()}
    <div class="card">
      <p class="muted">${ctx.isHome ? 'Jugás de local' : 'Jugás de visitante'} vs <strong>${opponent.name}</strong></p>
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
  const topPct = z.row === 0 ? 28 : 68; // arriba / abajo dentro del arco
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
    <svg viewBox="0 0 40 46" width="34" height="40">
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

function goalWidgetHtml(keeperKit) {
  return `
    <div class="goal-wrap" id="goal-wrap">
      <div class="goal-net"></div>
      <svg class="goal-frame" viewBox="0 0 100 60" preserveAspectRatio="none">
        <polyline points="4,56 4,4 96,4 96,56" fill="none" stroke="#e2e8f0" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
      </svg>
      ${PENALTY_ZONES.map((z) => `<div class="goal-zone" data-zone="${z.id}" style="left:${z.col * 33.33}%;top:${z.row * 50}%;"></div>`).join('')}
      <div class="goal-keeper" id="goal-keeper" style="left:50%;top:48%;">${keeperIconSvg(keeperKit.shirt, keeperKit.trim)}</div>
      <div class="goal-ball" id="goal-ball" style="left:50%;top:96%;">⚽</div>
      <div class="goal-result-banner" id="goal-banner"></div>
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
  const ballTarget = goalZoneCenter(shotZone);
  const keeperTarget = goalZoneCenter(keeperZone);

  ball.style.left = `${ballTarget.leftPct}%`;
  ball.style.top = `${ballTarget.topPct}%`;
  keeper.style.left = `${keeperTarget.leftPct}%`;
  keeper.style.top = `${keeperTarget.topPct}%`;

  setTimeout(() => {
    if (pen.scored) {
      banner.textContent = '¡GOL!';
      banner.className = 'goal-result-banner show gol';
      // La pelota queda clavada adentro del arco como confirmación visual del gol.
      ball.style.top = `${ballTarget.topPct}%`;
    } else {
      banner.textContent = '¡ATAJADA!';
      banner.className = 'goal-result-banner show atajada';
    }
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
    if (m.penalty.side === 'user') {
      penaltyText = m.penalty.scored
        ? `${m.penalty.shooterName} pateó ${dirLabel} y marcó el penal.`
        : `${m.penalty.shooterName} pateó ${dirLabel} y el arquero lo contuvo.`;
    } else {
      penaltyText = m.penalty.scored
        ? `Tu arquero se tiró ${dirLabel} y no llegó: gol de penal rival.`
        : `Tu arquero se tiró ${dirLabel} y ¡atajó el penal!`;
    }
  }

  const shootoutText = m.shootout
    ? `Se definió por penales: ${home.name} ${m.shootout.homeScore} - ${m.shootout.awayScore} ${away.name}.`
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
  const canRelease = s.squad.length > 12 && !soleAtPosition;

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
  const windowLabel = s.season.transferReason === 'between-editions'
    ? 'Mercado de pases — ventana entre el Apertura y el Clausura'
    : 'Mercado de pases — ventana de mitad de temporada';
  app.innerHTML = `
    ${header()}
    <div class="card">
      <h2>${windowLabel}</h2>
      <p class="muted">Podés comprar refuerzos si el presupuesto alcanza, y vender jugadores del plantel.</p>
      <h3>Ofertas disponibles</h3>
      <div class="options" id="market-list">
        ${s.market.map((p, i) => `
          <div class="pick-row">
            <span>${p.name} — ${p.pos} (${p.rating}, ${p.age} años) — ${money(p.price)}</span>
            <button class="option-btn small" data-i="${i}" ${s.budget < p.price ? 'disabled' : ''}>Comprar</button>
          </div>
        `).join('') || '<p class="muted">No quedan ofertas esta ronda.</p>'}
      </div>
      <h3>Tu plantel</h3>
      <div class="table-wrap">
      <div class="options" id="squad-list">
        ${s.squad.map((p, i) => `
          <div class="pick-row">
            <span>${p.name} — ${p.pos} (${p.rating}, ${p.age} años) — contrato hasta fin de ${p.contractYears > 1 ? `${p.contractYears} temporadas` : '1 temporada'}</span>
            <button class="option-btn small danger" data-i="${i}">Vender</button>
          </div>
        `).join('')}
      </div>
      </div>
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
          ${ev.callUps.map((p) => `<li>${NATIONS.find((n) => n.code === p.nation).flag} ${p.name} (${p.rating}) — ${Engine.nationName(p.nation)}</li>`).join('')}
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

  app.innerHTML = `
    <div class="card">
      <h1>Fin de temporada — Año ${s.season.year}</h1>
      <p>Terminaste ${pos}° en tu zona (${sum.myZoneTable[pos - 1].pts} puntos en el año).</p>
      <h3>Tabla de tu zona (temporada completa)</h3>
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

      <h3>Torneos de Primera División</h3>
      <p>${torneosText}</p>

      ${!sum.isD1 ? `<h3>Ascenso a Primera División</h3><p>${ascensoText}</p>` : ''}

      <h3>Copa Argentina</h3>
      <p>${copaText}</p>

      ${sum.qualification.length ? `
        <h3>Clasificación a copas internacionales</h3>
        <ul>
          ${sum.qualification.map((q) => `<li${q.clubId === s.clubId ? ' class="me-line"' : ''}>${q.name} — ${q.comp} (${q.stage})</li>`).join('')}
        </ul>
      ` : ''}

      <h3>Ascensos y descensos de Primera División</h3>
      <p><strong>${movementText}</strong></p>
      <p class="muted">Descendieron (último de la tabla anual + peor promedio): ${sum.relegated.join(', ')}.</p>
      <p class="muted">Ascendieron (Final directa + Reducido): ${sum.promoted.join(', ')}.</p>
      <p class="muted">${sum.economyNote}</p>

      <button class="option-btn" id="continue-season-btn">Comenzar nueva temporada</button>
      <button class="option-btn danger" id="restart-btn">Empezar de cero con otro club</button>
    </div>
  `;
  document.getElementById('continue-season-btn').addEventListener('click', () => { Engine.startNewSeason(); render(); });
  document.getElementById('restart-btn').addEventListener('click', () => { Engine.resetGame(); render(); });
}

// Barra de pestañas de solo celular (vertical): cambia cuál de los 3
// paneles se ve sin tener que scrollear. En PC / celular horizontal esta
// barra está oculta y los 3 paneles se ven siempre juntos (ver style.css).
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
