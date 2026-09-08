// Renderizado de pantallas y manejo de clicks. Sin frameworks: arma HTML
// como texto y lo inserta en #app. Cada acción del usuario vuelve a llamar
// a render() para reflejar el nuevo estado del juego.

const app = document.getElementById('app');

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
  if (s.screen === 'season-end') return renderSeasonEnd();
}

function renderClubSelect() {
  app.innerHTML = `
    <div class="card">
      <h1>Elegí tu club</h1>
      <p class="muted">Vas a dirigir esta temporada en la Liga Argentina. Las decisiones que tomes antes de cada partido influyen en el resultado.</p>
      <div class="club-grid">
        ${CLUBS.map((c) => `
          <button class="club-btn" data-club="${c.id}">
            <strong>${c.name}</strong>
            <span class="muted">Reputación: ${'★'.repeat(c.reputation)}${'☆'.repeat(5 - c.reputation)}</span>
            <span class="muted">Presupuesto: ${money(c.budget)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  app.querySelectorAll('.club-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      Engine.newGame(btn.dataset.club);
      render();
    });
  });
}

function header() {
  const s = Engine.state;
  const club = Engine.getClub(s.clubId);
  const table = Engine.getTableSorted();
  const pos = table.findIndex((r) => r.id === s.clubId) + 1;
  return `
    <div class="topbar">
      <div><strong>${club.name}</strong> <span class="muted">— Fecha ${s.round + 1} de ${s.schedule.length}</span></div>
      <div class="muted">Presupuesto: ${money(s.budget)} · Posición: ${pos}° · Ánimo: ${s.morale}</div>
    </div>
  `;
}

function renderPreMatch() {
  const s = Engine.state;
  const d = s.currentDecision;
  const round = s.schedule[s.round];
  const match = Engine.findUserMatch(round);
  const isHome = match.home === s.clubId;
  const opponent = Engine.getClub(isHome ? match.away : match.home);

  app.innerHTML = `
    ${header()}
    <div class="card">
      <p class="muted">${isHome ? 'Jugás de local' : 'Jugás de visitante'} vs <strong>${opponent.name}</strong></p>
      <h2>${d.title}</h2>
      <p>${d.description}</p>
      <div class="options">
        ${d.options.map((opt, i) => `<button class="option-btn" data-i="${i}">${opt.label}</button>`).join('')}
      </div>
    </div>
  `;
  app.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      Engine.chooseDecision(Number(btn.dataset.i));
      render();
    });
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
      btn.addEventListener('click', () => {
        Engine.resolvePenalty(btn.dataset.dir, keeper);
        render();
      });
    });
  }
}

function renderMatchResult() {
  const s = Engine.state;
  const m = s.pendingMatch;
  const home = Engine.getClub(m.home);
  const away = Engine.getClub(m.away);
  const userWon = (m.isHome && m.homeGoals > m.awayGoals) || (!m.isHome && m.awayGoals > m.homeGoals);
  const draw = m.homeGoals === m.awayGoals;
  const resultClass = draw ? 'result-draw' : userWon ? 'result-win' : 'result-loss';

  let penaltyText = '';
  if (m.penalty) {
    if (m.penalty.side === 'user') {
      penaltyText = m.penalty.scored
        ? `${m.penalty.shooterName} pateó a la ${m.penalty.direction.toLowerCase()} y marcó el penal.`
        : `${m.penalty.shooterName} pateó a la ${m.penalty.direction.toLowerCase()} y el arquero lo contuvo.`;
    } else {
      penaltyText = m.penalty.scored
        ? `El arquero se tiró al lado equivocado y llegó el gol de penal rival.`
        : `${m.penalty.keeperName} adivinó el remate y ¡atajó el penal!`;
    }
  }

  app.innerHTML = `
    ${header()}
    <div class="card ${resultClass}">
      <h2>Resultado</h2>
      <div class="scoreline">${home.name} <strong>${m.homeGoals}</strong> - <strong>${m.awayGoals}</strong> ${away.name}</div>
      ${penaltyText ? `<p class="muted">${penaltyText}</p>` : ''}
      ${s.lastDecisionNote ? `<p class="muted">${s.lastDecisionNote}</p>` : ''}
      <button class="option-btn" id="continue-btn">Continuar</button>
    </div>
  `;
  document.getElementById('continue-btn').addEventListener('click', () => {
    Engine.finishMatchAndAdvance();
    render();
  });
}

function renderTransfer() {
  const s = Engine.state;
  app.innerHTML = `
    ${header()}
    <div class="card">
      <h2>Mercado de pases</h2>
      <p class="muted">Podés comprar refuerzos si el presupuesto alcanza, y vender jugadores del plantel.</p>
      <h3>Ofertas disponibles</h3>
      <div class="options" id="market-list">
        ${s.market.map((p, i) => `
          <div class="pick-row">
            <span>${p.name} — ${p.pos} (${p.rating}) — ${money(p.price)}</span>
            <button class="option-btn small" data-i="${i}" ${s.budget < p.price ? 'disabled' : ''}>Comprar</button>
          </div>
        `).join('') || '<p class="muted">No quedan ofertas esta ronda.</p>'}
      </div>
      <h3>Tu plantel</h3>
      <div class="options" id="squad-list">
        ${s.squad.map((p, i) => `
          <div class="pick-row">
            <span>${p.name} — ${p.pos} (${p.rating})</span>
            <button class="option-btn small danger" data-i="${i}">Vender</button>
          </div>
        `).join('')}
      </div>
      <button class="option-btn" id="continue-btn">Continuar temporada</button>
    </div>
  `;
  app.querySelectorAll('#market-list button').forEach((btn) => {
    btn.addEventListener('click', () => {
      Engine.buyPlayer(Number(btn.dataset.i));
      render();
    });
  });
  app.querySelectorAll('#squad-list button').forEach((btn) => {
    btn.addEventListener('click', () => {
      Engine.sellPlayer(Number(btn.dataset.i));
      render();
    });
  });
  document.getElementById('continue-btn').addEventListener('click', () => {
    Engine.continueFromTransfer();
    render();
  });
}

function renderSeasonEnd() {
  const s = Engine.state;
  const table = Engine.getTableSorted();
  const pos = table.findIndex((r) => r.id === s.clubId) + 1;
  app.innerHTML = `
    <div class="card">
      <h1>Fin de temporada</h1>
      <p>Terminaste en el puesto <strong>${pos}°</strong> con ${table[pos - 1].pts} puntos.</p>
      <h3>Tabla final</h3>
      <table class="table">
        <thead><tr><th>#</th><th>Club</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>Pts</th></tr></thead>
        <tbody>
          ${table.map((r, i) => `
            <tr class="${r.id === s.clubId ? 'me' : ''}">
              <td>${i + 1}</td><td>${r.name}</td><td>${r.played}</td><td>${r.win}</td><td>${r.draw}</td><td>${r.loss}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.pts}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <button class="option-btn" id="restart-btn">Jugar otra temporada</button>
    </div>
  `;
  document.getElementById('restart-btn').addEventListener('click', () => {
    Engine.resetGame();
    render();
  });
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
