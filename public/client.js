const socket = io();

let currentPlayerId = null;
let playerChips = 1000;
let canDouble = false;

// DOM Elements
const elements = {
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  end: document.getElementById('end'),
  timer: document.getElementById('timer'),
  playerName: document.getElementById('player-name'),
  joinBtn: document.getElementById('join-btn'),
  playerCount: document.getElementById('player-count'),
  startDatetime: document.getElementById('start-datetime'),
  endDatetime: document.getElementById('end-datetime'),
  scheduleTournamentBtn: document.getElementById('schedule-tournament-btn'),
  scheduleStatus: document.getElementById('schedule-status'),
  tournamentEndTime: document.getElementById('tournament-end-time'),
  newTournamentBtn: document.getElementById('new-tournament-btn'),
  dealerCards: document.getElementById('dealer-cards'),
  playerCards: document.getElementById('player-cards'),
  dealerValue: document.getElementById('dealer-value'),
  playerValue: document.getElementById('player-value'),
  bettingSection: document.getElementById('betting-section'),
  actionSection: document.getElementById('action-section'),
  resultSection: document.getElementById('result-section'),
  resultMessage: document.getElementById('result-message'),
  hitBtn: document.getElementById('hit-btn'),
  standBtn: document.getElementById('stand-btn'),
  doubleBtn: document.getElementById('double-btn'),
  nextHandBtn: document.getElementById('next-hand-btn'),
  customBet: document.getElementById('custom-bet'),
  placeBetBtn: document.getElementById('place-bet-btn'),
  chips: document.getElementById('chips'),
  handsPlayed: document.getElementById('hands-played'),
  handsWon: document.getElementById('hands-won'),
  leaderboardList: document.getElementById('leaderboard-list'),
  winnerAnnouncement: document.getElementById('winner-announcement')
};

// Set default datetime values (now + 5 minutes for start, +1 hour for end)
function setDefaultDatetimes() {
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
  const end = new Date(now.getTime() + 65 * 60000); // 1 hour 5 minutes from now

  elements.startDatetime.value = formatDatetimeLocal(start);
  elements.endDatetime.value = formatDatetimeLocal(end);
}

function formatDatetimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatTimeRemaining(ms) {
  if (ms <= 0) return '0:00';

  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDateTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York'
  }) + ' ET';
}

// Utility Functions
function showView(viewName) {
  elements.lobby.classList.add('hidden');
  elements.game.classList.add('hidden');
  elements.end.classList.add('hidden');

  if (viewName === 'lobby') elements.lobby.classList.remove('hidden');
  else if (viewName === 'game') elements.game.classList.remove('hidden');
  else if (viewName === 'end') elements.end.classList.remove('hidden');
}

function createCardElement(cardStr) {
  const card = document.createElement('div');
  card.className = 'card';

  if (!cardStr) {
    card.classList.add('hidden-card');
    return card;
  }

  const suit = cardStr.slice(-1);
  const isRed = suit === '♥' || suit === '♦';
  card.classList.add(isRed ? 'red' : 'black');
  card.textContent = cardStr;

  return card;
}

function renderCards(container, cards, showValue = true) {
  container.innerHTML = '';
  cards.forEach(card => {
    container.appendChild(createCardElement(card));
  });
}

function showBettingSection() {
  elements.bettingSection.classList.remove('hidden');
  elements.actionSection.classList.add('hidden');
  elements.resultSection.classList.add('hidden');
  elements.dealerCards.innerHTML = '';
  elements.playerCards.innerHTML = '';
  elements.dealerValue.textContent = '';
  elements.playerValue.textContent = '';
}

function showActionSection(canDoubleDown) {
  elements.bettingSection.classList.add('hidden');
  elements.actionSection.classList.remove('hidden');
  elements.resultSection.classList.add('hidden');
  elements.doubleBtn.disabled = !canDoubleDown;
  canDouble = canDoubleDown;
}

function showResultSection(result, payout) {
  elements.bettingSection.classList.add('hidden');
  elements.actionSection.classList.add('hidden');
  elements.resultSection.classList.remove('hidden');

  const messages = {
    blackjack: `BLACKJACK! +$${payout}`,
    player: `YOU WIN! +$${payout}`,
    dealer: `Dealer Wins`,
    push: `Push - Bet Returned`
  };

  elements.resultMessage.textContent = messages[result] || result;
  elements.resultMessage.className = 'result-message ' + result;
}

function updateStats(chips, handsPlayed, handsWon) {
  elements.chips.textContent = chips;
  elements.handsPlayed.textContent = handsPlayed;
  elements.handsWon.textContent = handsWon;
  playerChips = chips;
}

function updateLeaderboard(leaderboard) {
  elements.leaderboardList.innerHTML = '';

  leaderboard.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';

    if (index < 3) item.classList.add('top-3');
    if (player.id === currentPlayerId) item.classList.add('current-player');

    item.innerHTML = `
      <span class="rank">${index + 1}</span>
      <span class="player-name">${escapeHtml(player.name)}</span>
      <span class="player-chips">$${player.chips}</span>
    `;

    elements.leaderboardList.appendChild(item);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateScheduleDisplay(schedule) {
  if (schedule && schedule.isScheduled) {
    elements.scheduleStatus.textContent = `Scheduled: ${formatDateTime(schedule.startTime)} - ${formatDateTime(schedule.endTime)}`;
    elements.scheduleStatus.className = 'schedule-status scheduled';
    elements.scheduleTournamentBtn.textContent = 'Update Schedule';
  } else {
    elements.scheduleStatus.textContent = '';
    elements.scheduleStatus.className = 'schedule-status';
    elements.scheduleTournamentBtn.textContent = 'Schedule Tournament';
  }
}

// Event Listeners
elements.joinBtn.addEventListener('click', () => {
  const name = elements.playerName.value.trim();
  if (name) {
    socket.emit('join', name);
    elements.joinBtn.disabled = true;
  }
});

elements.playerName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    elements.joinBtn.click();
  }
});

// Schedule tournament
elements.scheduleTournamentBtn.addEventListener('click', () => {
  const startValue = elements.startDatetime.value;
  const endValue = elements.endDatetime.value;

  if (!startValue || !endValue) {
    elements.scheduleStatus.textContent = 'Please select both start and end times';
    elements.scheduleStatus.className = 'schedule-status error';
    return;
  }

  const startTime = new Date(startValue).getTime();
  const endTime = new Date(endValue).getTime();

  socket.emit('schedule-tournament', { startTime, endTime });
});

elements.newTournamentBtn.addEventListener('click', () => {
  socket.emit('admin-reset');
  currentPlayerId = null;
  elements.joinBtn.disabled = false;
  elements.playerName.value = '';
  setDefaultDatetimes();
});

document.querySelectorAll('.bet-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const amount = parseInt(btn.dataset.amount);
    socket.emit('place-bet', amount);
  });
});

elements.placeBetBtn.addEventListener('click', () => {
  const amount = parseInt(elements.customBet.value) || 50;
  socket.emit('place-bet', amount);
});

elements.customBet.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    elements.placeBetBtn.click();
  }
});

elements.hitBtn.addEventListener('click', () => {
  socket.emit('hit');
});

elements.standBtn.addEventListener('click', () => {
  socket.emit('stand');
});

elements.doubleBtn.addEventListener('click', () => {
  socket.emit('double');
});

elements.nextHandBtn.addEventListener('click', () => {
  if (playerChips > 0) {
    showBettingSection();
  } else {
    elements.resultMessage.textContent = 'No chips remaining!';
    elements.resultMessage.className = 'result-message lose';
    elements.nextHandBtn.disabled = true;
  }
});

// Socket Events
socket.on('state-update', (state) => {
  elements.playerCount.textContent = state.playerCount;
  updateLeaderboard(state.leaderboard);

  if (state.schedule) {
    updateScheduleDisplay(state.schedule);
  }

  if (state.phase === 'lobby') {
    if (!currentPlayerId) {
      showView('lobby');
    }
    if (state.schedule && state.schedule.isScheduled) {
      elements.timer.textContent = `Starts: ${formatDateTime(state.schedule.startTime)}`;
    } else {
      elements.timer.textContent = 'Waiting to be scheduled...';
    }
  } else if (state.phase === 'playing') {
    if (state.schedule && state.schedule.endTime) {
      elements.timer.textContent = `Ends: ${formatDateTime(state.schedule.endTime)}`;
    } else {
      elements.timer.textContent = 'Tournament in progress';
    }
  } else if (state.phase === 'ended') {
    showView('end');
    elements.timer.textContent = 'Tournament ended';
  }
});

socket.on('countdown-update', ({ phase, remaining, startTime, endTime }) => {
  if (phase === 'lobby') {
    elements.timer.textContent = `Starts in: ${formatTimeRemaining(remaining)}`;
  } else if (phase === 'playing') {
    elements.timer.textContent = `Ends in: ${formatTimeRemaining(remaining)}`;
    elements.tournamentEndTime.textContent = `Time remaining: ${formatTimeRemaining(remaining)}`;
  }
});

socket.on('schedule-update', (schedule) => {
  updateScheduleDisplay(schedule);
});

socket.on('scheduled', (schedule) => {
  elements.scheduleStatus.textContent = `Scheduled! Starts: ${formatDateTime(schedule.startTime)}`;
  elements.scheduleStatus.className = 'schedule-status scheduled';
});

socket.on('joined', ({ player, state }) => {
  currentPlayerId = player.id;
  updateStats(player.chips, player.handsPlayed, player.handsWon);
  updateLeaderboard(state.leaderboard);

  if (state.schedule) {
    updateScheduleDisplay(state.schedule);
  }

  if (state.phase === 'playing') {
    showView('game');
    showBettingSection();
  }
});

socket.on('player-joined', ({ name, count }) => {
  elements.playerCount.textContent = count;
});

socket.on('tournament-start', (state) => {
  if (currentPlayerId) {
    showView('game');
    showBettingSection();
  }
});

socket.on('deal', (data) => {
  renderCards(elements.playerCards, data.playerHand);
  renderCards(elements.dealerCards, [...data.dealerVisible, null]);
  elements.playerValue.textContent = data.playerValue;
  elements.dealerValue.textContent = '?';
  if (data.chips !== undefined) {
    elements.chips.textContent = data.chips;
    playerChips = data.chips;
  }
  showActionSection(data.canDouble);
});

socket.on('card', (data) => {
  renderCards(elements.playerCards, data.playerHand);
  elements.playerValue.textContent = data.playerValue;
  elements.doubleBtn.disabled = true;
});

socket.on('hand-result', (data) => {
  renderCards(elements.playerCards, data.playerHand);
  renderCards(elements.dealerCards, data.dealerHand);
  elements.playerValue.textContent = data.playerValue;
  elements.dealerValue.textContent = data.dealerValue;
  updateStats(data.chips, 0, 0);
  showResultSection(data.result, data.payout);

  socket.emit('get-state');
});

socket.on('player-state', (player) => {
  updateStats(player.chips, player.handsPlayed, player.handsWon);
});

socket.on('leaderboard-update', (leaderboard) => {
  updateLeaderboard(leaderboard);
});

socket.on('tournament-end', (results) => {
  showView('end');

  if (results.winner) {
    elements.winnerAnnouncement.innerHTML = `
      <div>Winner: <strong>${escapeHtml(results.winner.name)}</strong></div>
      <div>Final Chips: $${results.winner.chips}</div>
    `;
  } else {
    elements.winnerAnnouncement.textContent = 'No players participated.';
  }
});

socket.on('error', (message) => {
  console.error('Server error:', message);
  if (elements.scheduleStatus) {
    elements.scheduleStatus.textContent = message;
    elements.scheduleStatus.className = 'schedule-status error';
  }
});

socket.on('connect', () => {
  console.log('Connected to server');
  socket.emit('get-state');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// Initialize
setDefaultDatetimes();
