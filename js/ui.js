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

function render() {
  const s = Engine.state;
  if (!s) return;
  if (s.screen === 'club-select') renderClubSelect();
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

function jerseySvg(kit, label) {
  const bandPath = kit.band
    ? `<path d="M14 4 L22 8 L30 4 L32 9 L22 13 L12 9 Z" fill="${kit.band}" />`
    : '';
  return `
    <svg width="40" height="40" viewBox="0 0 44 44">
      <path d="M14 4 L22 8 L30 4 L38 10 L34 17 L30 14 L30 40 L14 40 L14 14 L10 17 L6 10 Z" fill="${kit.shirt}" stroke="${kit.trim}" stroke-width="1.5" />
      ${bandPath}
      <text x="22" y="29" text-anchor="middle" font-size="11" font-weight="700" fill="${kit.trim}">${label}</text>
    </svg>
  `;
}

// Cada jugador es tocable/arrastrable: `data-player` identifica el id para
// el intercambio (ver handlePlayerTap/los listeners de drag en
// renderSquadPanel). El dorsal real se muestra si lo tenemos cargado; si no,
// se sigue mostrando la valoración como antes. Los que están en la cancha
// (`p.fit`, ver getStartingXI en engine.js) llevan un borde de color según
// qué tan bien juegan en ese casillero: verde = su posición, amarillo =
// línea vecina, rojo = fuera de lugar (rinde menos, ver effectiveRating).
// El drag & drop de HTML5 (draggable="true") solo se activa en dispositivos
// que no son táctiles: en el celular, esa marca puede confundir al
// navegador (interpreta un toque como intento de arrastre, aparece el menú
// de "guardar imagen", etc.) y termina comiéndose el tap. En touch, tocar
// para elegir siempre funciona igual.
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

function playerChip(p, club, selected) {
  const lastName = p.name.trim().split(' ').slice(-1)[0];
  const kit = clubKit(club);
  const label = p.number != null ? p.number : p.rating;
  const fitClass = p.fit ? `fit-${p.fit}` : '';
  const title = p.fit && p.fit !== 'green' ? `title="Valoración natural ${p.rating}, jugando ahí rinde ${p.effectiveRating}"` : '';
  const draggable = isTouchDevice ? '' : 'draggable="true"';
  return `
    <div class="player-chip ${fitClass} ${selected ? 'selected' : ''}" data-player="${p.id}" ${draggable} ${title}>
      ${jerseySvg(kit, label)}
      <span>${lastName}</span>
    </div>
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

  const chip = (p) => playerChip(p, club, p.id === selectedPlayerId);

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
      <div class="pitch">
        <div class="pitch-row">${xi.del.map(chip).join('')}</div>
        ${xi.off.length ? `<div class="pitch-row">${xi.off.map(chip).join('')}</div>` : ''}
        <div class="pitch-row">${xi.med.map(chip).join('')}</div>
        <div class="pitch-row">${xi.def.map(chip).join('')}</div>
        <div class="pitch-row">${xi.gk.map(chip).join('')}</div>
      </div>
      <p class="muted">Tocá un jugador de la cancha y después uno del banco (o al revés) para cambiarlos${isTouchDevice ? '' : ' (o arrastrá uno sobre el otro)'}. Podés poner a cualquiera en cualquier puesto, pero fuera de su posición natural rinde menos.</p>
      <p class="muted fit-legend"><span class="fit-dot fit-green"></span>su posición &nbsp; <span class="fit-dot fit-yellow"></span>posición cercana &nbsp; <span class="fit-dot fit-red"></span>fuera de lugar</p>
      <h3>Suplentes</h3>
      <div class="bench-list">
        ${bench.map((p) => `
          <div class="pick-row player-chip-row ${p.id === selectedPlayerId ? 'selected' : ''}" data-player="${p.id}" ${isTouchDevice ? '' : 'draggable="true"'}>
            <span>${p.number != null ? `#${p.number} ` : ''}${p.name} — ${p.pos} (${p.rating})</span>
          </div>
        `).join('') || '<p class="muted">No hay suplentes disponibles.</p>'}
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

  const playerEls = squadPanel.querySelectorAll('[data-player]');
  playerEls.forEach((el) => {
    el.addEventListener('click', () => handlePlayerTap(el.dataset.player));
    el.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', el.dataset.player); });
    el.addEventListener('dragover', (ev) => ev.preventDefault());
    el.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const draggedId = ev.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== el.dataset.player) {
        Engine.swapPlayers(draggedId, el.dataset.player);
        selectedPlayerId = null;
        render();
      }
    });
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
  return `
    <div class="topbar">
      <div><strong>${club.name}</strong> <span class="muted">— ${divisionName}, Zona ${club.zone}</span></div>
      <div class="muted">${competitionLabel()}</div>
      <div class="muted">Presupuesto: ${money(s.budget)} · Posición en zona: ${pos}°/${table.length} · Ánimo: ${s.morale}</div>
      <button class="option-btn small danger" id="end-career-btn">Terminar carrera</button>
    </div>
  `;
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
  app.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => { Engine.chooseDecision(Number(btn.dataset.i)); render(); });
  });
}

function renderPenalty() {
  const s = Engine.state;
  const pen = s.pendingMatch.penalty;
  const opponent = Engine.getClub(s.pendingMatch.opponentId);

  if (pen.side === 'user') {
    const shooters = Engine.getPenaltyShooters();
    app.innerHTML = `
      ${header()}
      <div class="card">
        <h2>¡Penal a favor!</h2>
        <p>Elegí quién lo patea y hacia dónde.</p>
        <div class="options" id="shooter-list">
          ${shooters.map((p) => `
            <div class="pick-row">
              <span>${p.name} (${p.rating})</span>
              <div class="options inline">
                ${PENALTY_DIRECTIONS.map((dir) => `<button class="option-btn small" data-player="${p.id}" data-dir="${dir}">${dir}</button>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    app.querySelectorAll('#shooter-list .option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shooter = shooters.find((p) => p.id === btn.dataset.player);
        Engine.resolvePenalty(btn.dataset.dir, shooter);
        render();
      });
    });
  } else {
    const keeper = Engine.getUserKeeper();
    app.innerHTML = `
      ${header()}
      <div class="card">
        <h2>Penal en contra</h2>
        <p>${opponent.name} va a patear. Elegí para dónde se tira ${keeper.name}.</p>
        <div class="options">
          ${PENALTY_DIRECTIONS.map((dir) => `<button class="option-btn" data-dir="${dir}">${dir}</button>`).join('')}
        </div>
      </div>
    `;
    app.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => { Engine.resolvePenalty(btn.dataset.dir, keeper); render(); });
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
    if (m.penalty.side === 'user') {
      penaltyText = m.penalty.scored
        ? `${m.penalty.shooterName} pateó a la ${m.penalty.direction.toLowerCase()} y marcó el penal.`
        : `${m.penalty.shooterName} pateó a la ${m.penalty.direction.toLowerCase()} y el arquero lo contuvo.`;
    } else {
      penaltyText = m.penalty.scored
        ? 'El arquero se tiró al lado equivocado y llegó el gol de penal rival.'
        : 'Tu arquero adivinó el remate y ¡atajó el penal!';
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
    Engine.state = { screen: 'club-select' };
  }
  setupMobileTabs();
  render();
}

init();
