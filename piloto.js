window.paso = function () {
  const s = Engine.state;
  switch (s.screen) {
    case 'calendar': if (s.calendar && s.calendar.message) Engine.answerCalendarMessage(0); else Engine.advanceCalendarDay(); return true;
    case 'presentation': Engine.continueFromPresentation(0); return true;
    case 'pre-match': Engine.chooseDecision(0); return true;
    case 'penalty': { const p = s.pendingMatch.penalty; Engine.resolvePenalty('centro', p.side === 'user' ? Engine.getPenaltyShooters()[0] : Engine.getUserKeeper()); return true; }
    case 'match-result': Engine.finishMatchAndAdvance(); return true;
    case 'fifa-break': Engine.resolveFifaEvent(false); Engine.continueFromFifa(); return true;
    case 'transfer': Engine.continueFromTransfer(); return true;
    case 'contract-renewal': Engine.resolveContractDecision(true); return true;
    default: return false;
  }
};
window.correr = function () { let n = 0; while (n++ < 80000) { if (Engine.state.screen === 'season-end') return true; if (!window.paso()) return false; } return false; };
