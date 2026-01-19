const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Tournament = require('./game/tournament');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const STARTING_CHIPS = parseInt(process.env.STARTING_CHIPS) || 1000;

app.use(express.static(path.join(__dirname, 'public')));

let tournament = new Tournament({
  startingChips: STARTING_CHIPS
});

// Schedule state
let schedule = {
  startTime: null,
  endTime: null,
  isScheduled: false
};

let startTimer = null;
let endTimer = null;
let countdownInterval = null;

// Start in lobby mode (waiting for schedule)
tournament.phase = 'lobby';

function broadcastState() {
  io.emit('state-update', {
    ...tournament.getTournamentState(),
    schedule: schedule
  });
}

function broadcastLeaderboard() {
  io.emit('leaderboard-update', tournament.getLeaderboard());
}

function broadcastSchedule() {
  io.emit('schedule-update', schedule);
}

function startTournament() {
  if (tournament.players.size < 1) {
    console.log('No players joined - tournament cannot start');
    return { success: false, error: 'No players joined' };
  }

  tournament.phase = 'playing';
  tournament.startTime = Date.now();

  broadcastState();
  io.emit('tournament-start', tournament.getTournamentState());
  console.log('Tournament started!');

  return { success: true };
}

function endTournament() {
  // Clear any remaining timers
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  tournament.phase = 'ended';
  const results = tournament.getResults();
  io.emit('tournament-end', results);
  broadcastState();
  console.log('Tournament ended!');

  return results;
}

function resetTournament() {
  // Clear all timers
  if (startTimer) {
    clearTimeout(startTimer);
    startTimer = null;
  }
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  tournament = new Tournament({
    startingChips: STARTING_CHIPS
  });
  tournament.phase = 'lobby';

  schedule = {
    startTime: null,
    endTime: null,
    isScheduled: false
  };

  broadcastState();
  broadcastLeaderboard();
  broadcastSchedule();
  console.log('New tournament created - lobby open!');
}

function scheduleTournament(startTime, endTime) {
  const now = Date.now();

  if (startTime <= now) {
    return { success: false, error: 'Start time must be in the future' };
  }

  if (endTime <= startTime) {
    return { success: false, error: 'End time must be after start time' };
  }

  // Clear any existing timers
  if (startTimer) clearTimeout(startTimer);
  if (endTimer) clearTimeout(endTimer);
  if (countdownInterval) clearInterval(countdownInterval);

  schedule = {
    startTime: startTime,
    endTime: endTime,
    isScheduled: true
  };

  // Set up start timer
  const msUntilStart = startTime - now;
  startTimer = setTimeout(() => {
    console.log('Scheduled start time reached!');
    startTournament();

    // Set up end timer
    const msUntilEnd = endTime - Date.now();
    endTimer = setTimeout(() => {
      console.log('Scheduled end time reached!');
      endTournament();
    }, msUntilEnd);
  }, msUntilStart);

  // Broadcast countdown updates every second
  countdownInterval = setInterval(() => {
    const currentTime = Date.now();

    if (tournament.phase === 'lobby' && schedule.startTime) {
      const remaining = schedule.startTime - currentTime;
      if (remaining > 0) {
        io.emit('countdown-update', {
          phase: 'lobby',
          remaining: remaining,
          startTime: schedule.startTime,
          endTime: schedule.endTime
        });
      }
    } else if (tournament.phase === 'playing' && schedule.endTime) {
      const remaining = schedule.endTime - currentTime;
      if (remaining > 0) {
        io.emit('countdown-update', {
          phase: 'playing',
          remaining: remaining,
          startTime: schedule.startTime,
          endTime: schedule.endTime
        });
      }
    }
  }, 1000);

  broadcastSchedule();
  broadcastState();

  console.log(`Tournament scheduled: Start at ${new Date(startTime).toLocaleString()}, End at ${new Date(endTime).toLocaleString()}`);

  return { success: true, schedule };
}

tournament.onLeaderboardUpdate = broadcastLeaderboard;
tournament.onPhaseChange = broadcastState;

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.emit('state-update', {
    ...tournament.getTournamentState(),
    schedule: schedule
  });

  socket.on('join', (name) => {
    const trimmedName = (name || '').trim().substring(0, 20) || 'Anonymous';
    const result = tournament.addPlayer(socket.id, trimmedName);

    if (result.success) {
      socket.emit('joined', {
        player: tournament.getPlayerState(socket.id),
        state: {
          ...tournament.getTournamentState(),
          schedule: schedule
        }
      });
      io.emit('player-joined', { name: trimmedName, count: tournament.players.size });
      broadcastLeaderboard();
    } else {
      socket.emit('error', result.error);
    }
  });

  // Schedule tournament with start and end times
  socket.on('schedule-tournament', ({ startTime, endTime }) => {
    if (tournament.phase !== 'lobby') {
      socket.emit('error', 'Cannot schedule - tournament already in progress');
      return;
    }

    const result = scheduleTournament(startTime, endTime);
    if (!result.success) {
      socket.emit('error', result.error);
    } else {
      socket.emit('scheduled', result.schedule);
    }
  });

  socket.on('admin-reset', () => {
    if (tournament.phase === 'ended') {
      resetTournament();
    }
  });

  socket.on('place-bet', (amount) => {
    const bet = parseInt(amount) || 50;
    const result = tournament.placeBet(socket.id, bet);

    if (result.success) {
      socket.emit('deal', result);
    } else {
      socket.emit('error', result.error);
    }
  });

  socket.on('hit', () => {
    const result = tournament.hit(socket.id);

    if (result.success) {
      if (result.complete) {
        socket.emit('hand-result', result);
      } else {
        socket.emit('card', result);
      }
    } else {
      socket.emit('error', result.error);
    }
  });

  socket.on('stand', () => {
    const result = tournament.stand(socket.id);

    if (result.success) {
      socket.emit('hand-result', result);
    } else {
      socket.emit('error', result.error);
    }
  });

  socket.on('double', () => {
    const result = tournament.doubleDown(socket.id);

    if (result.success) {
      socket.emit('hand-result', result);
    } else {
      socket.emit('error', result.error);
    }
  });

  socket.on('get-state', () => {
    socket.emit('state-update', {
      ...tournament.getTournamentState(),
      schedule: schedule
    });
    const playerState = tournament.getPlayerState(socket.id);
    if (playerState) {
      socket.emit('player-state', playerState);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           BLACKJACK TOURNAMENT SERVER                      ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                  ║
║                                                            ║
║  Scheduled Mode:                                           ║
║  - Set start and end times via the web interface          ║
║  - Tournament auto-starts and auto-ends at scheduled times ║
║  - Starting Chips: ${String(STARTING_CHIPS).padEnd(5)}                              ║
╚════════════════════════════════════════════════════════════╝
  `);
});
