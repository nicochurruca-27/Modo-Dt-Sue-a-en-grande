// Renderizado de pantallas y manejo de clicks. Sin frameworks: arma HTML
// como texto y lo inserta en #app. Cada acción del usuario vuelve a llamar
// a render() para reflejar el nuevo estado del juego.

const app = document.getElementById('app');

let selectDivision = 'D1';
let selectZone = 'A';

function money(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

function render() {
  const s = Engine.state;
  if (!s) return;
  if (s.screen === 'club-select') return renderClubSelect();
  if (s.screen === 'pre-match') return renderPreMatch();
  if (s.screen === 'penalty') return renderPenalty();
  if (s.screen === 'match-result') return renderMatchResult();
  if (s.screen === 'transfer') return renderTransfer();
  if (s.screen === 'fifa-break') return renderFifaBreak();
  if (s.screen === 'season-end') return renderSeasonEnd();
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
    ? `Definición por penales: ${home.name} ${m.shootout.homeScore} - ${m.shootout.awayScore} ${away.name}.`
    : '';

  const contextLabel = m.context === 'bracket' ? competitionLabel() : 'Liga';

  app.innerHTML = `
    ${header()}
    <div class="card ${resultClass}">
      <h2>Resultado — ${contextLabel}</h2>
      <div class="scoreline">${home.name} <strong>${m.homeGoals}</strong> - <strong>${m.awayGoals}</strong> ${away.name}</div>
      ${penaltyText ? `<p class="muted">${penaltyText}</p>` : ''}
      ${shootoutText ? `<p class="muted">${shootoutText}</p>` : ''}
      ${s.lastDecisionNote ? `<p class="muted">${s.lastDecisionNote}</p>` : ''}
      <button class="option-btn" id="continue-btn">Continuar</button>
    </div>
  `;
  document.getElementById('continue-btn').addEventListener('click', () => { Engine.finishMatchAndAdvance(); render(); });
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
            <span>${p.name} — ${p.pos} (${p.rating}, ${p.age} años)</span>
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

function init() {
  if (Engine.hasSave()) {
    Engine.load();
  } else {
    Engine.state = { screen: 'club-select' };
  }
  render();
}

init();
