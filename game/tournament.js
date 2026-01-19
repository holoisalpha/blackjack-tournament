const { createShoe } = require('./deck');
const {
  dealInitialHands,
  hit,
  playDealerHand,
  isBlackjack,
  isBust,
  canDoubleDown,
  determineWinner,
  calculatePayout,
  calculateHandValue,
  handToStrings
} = require('./blackjack');

class Tournament {
  constructor(options = {}) {
    this.joinPeriod = options.joinPeriod || 120;
    this.tournamentDuration = options.tournamentDuration || 600;
    this.startingChips = options.startingChips || 1000;
    this.minBet = options.minBet || 10;
    this.maxBet = options.maxBet || 500;

    this.players = new Map();
    this.phase = 'lobby';
    this.shoe = createShoe();
    this.startTime = null;
    this.endTime = null;
    this.lobbyEndTime = null;

    this.onLeaderboardUpdate = null;
    this.onPhaseChange = null;
  }

  addPlayer(id, name) {
    if (this.phase !== 'lobby') {
      return { success: false, error: 'Tournament already started' };
    }

    if (this.players.has(id)) {
      return { success: false, error: 'Already joined' };
    }

    const player = {
      id,
      name,
      chips: this.startingChips,
      currentHand: null,
      currentBet: 0,
      handsPlayed: 0,
      handsWon: 0
    };

    this.players.set(id, player);
    return { success: true, player };
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  startLobby() {
    this.phase = 'lobby';
    this.lobbyEndTime = Date.now() + this.joinPeriod * 1000;
    this.notifyPhaseChange();
  }

  startTournament() {
    if (this.players.size < 1) {
      return { success: false, error: 'Need at least 1 player' };
    }

    this.phase = 'playing';
    this.startTime = Date.now();
    this.endTime = this.startTime + this.tournamentDuration * 1000;
    this.notifyPhaseChange();
    return { success: true };
  }

  endTournament() {
    this.phase = 'ended';
    this.notifyPhaseChange();
    return this.getResults();
  }

  getTimeRemaining() {
    if (this.phase === 'lobby' && this.lobbyEndTime) {
      return Math.max(0, this.lobbyEndTime - Date.now());
    }
    if (this.phase === 'playing' && this.endTime) {
      return Math.max(0, this.endTime - Date.now());
    }
    return 0;
  }

  placeBet(playerId, amount) {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (this.phase !== 'playing') {
      return { success: false, error: 'Tournament not in progress' };
    }

    if (player.currentHand) {
      return { success: false, error: 'Hand already in progress' };
    }

    const bet = Math.min(Math.max(amount, this.minBet), Math.min(this.maxBet, player.chips));

    if (bet > player.chips) {
      return { success: false, error: 'Insufficient chips' };
    }

    if (player.chips <= 0) {
      return { success: false, error: 'No chips remaining' };
    }

    player.chips -= bet;
    player.currentBet = bet;

    const dealt = dealInitialHands(this.shoe);
    this.shoe = dealt.shoe;

    player.currentHand = {
      playerHand: dealt.playerHand,
      dealerHand: dealt.dealerHand,
      dealerVisible: [dealt.dealerHand[0]],
      status: 'playing',
      doubled: false
    };

    const playerBlackjack = isBlackjack(dealt.playerHand);
    const dealerBlackjack = isBlackjack(dealt.dealerHand);

    if (playerBlackjack || dealerBlackjack) {
      return this.resolveHand(playerId);
    }

    this.notifyLeaderboardUpdate();

    return {
      success: true,
      playerHand: handToStrings(dealt.playerHand),
      dealerVisible: handToStrings([dealt.dealerHand[0]]),
      playerValue: calculateHandValue(dealt.playerHand),
      canDouble: canDoubleDown(dealt.playerHand) && player.chips >= bet,
      chips: player.chips,
      bet: bet
    };
  }

  hit(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.currentHand) {
      return { success: false, error: 'No active hand' };
    }

    if (player.currentHand.status !== 'playing') {
      return { success: false, error: 'Hand already complete' };
    }

    const result = hit(player.currentHand.playerHand, this.shoe);
    player.currentHand.playerHand = result.hand;
    this.shoe = result.shoe;

    if (isBust(result.hand)) {
      return this.resolveHand(playerId);
    }

    return {
      success: true,
      playerHand: handToStrings(result.hand),
      playerValue: calculateHandValue(result.hand),
      canDouble: false
    };
  }

  stand(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.currentHand) {
      return { success: false, error: 'No active hand' };
    }

    if (player.currentHand.status !== 'playing') {
      return { success: false, error: 'Hand already complete' };
    }

    return this.resolveHand(playerId);
  }

  doubleDown(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.currentHand) {
      return { success: false, error: 'No active hand' };
    }

    if (player.currentHand.status !== 'playing') {
      return { success: false, error: 'Hand already complete' };
    }

    if (!canDoubleDown(player.currentHand.playerHand)) {
      return { success: false, error: 'Cannot double down' };
    }

    if (player.chips < player.currentBet) {
      return { success: false, error: 'Insufficient chips to double' };
    }

    player.chips -= player.currentBet;
    player.currentBet *= 2;
    player.currentHand.doubled = true;

    const result = hit(player.currentHand.playerHand, this.shoe);
    player.currentHand.playerHand = result.hand;
    this.shoe = result.shoe;

    return this.resolveHand(playerId);
  }

  resolveHand(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.currentHand) {
      return { success: false, error: 'No active hand' };
    }

    const hand = player.currentHand;
    const playerBust = isBust(hand.playerHand);

    let finalDealerHand = hand.dealerHand;

    if (!playerBust) {
      const dealerResult = playDealerHand(hand.dealerHand, this.shoe);
      finalDealerHand = dealerResult.hand;
      this.shoe = dealerResult.shoe;
    }

    const playerBlackjack = isBlackjack(hand.playerHand);
    const dealerBlackjack = isBlackjack(hand.dealerHand);

    const result = determineWinner(hand.playerHand, finalDealerHand, playerBlackjack, dealerBlackjack);
    const payout = calculatePayout(player.currentBet, result);

    player.chips += payout;
    player.handsPlayed++;
    if (result === 'player' || result === 'blackjack') {
      player.handsWon++;
    }

    hand.status = 'complete';
    hand.result = result;
    hand.dealerHand = finalDealerHand;

    const response = {
      success: true,
      complete: true,
      result,
      payout,
      chips: player.chips,
      playerHand: handToStrings(hand.playerHand),
      dealerHand: handToStrings(finalDealerHand),
      playerValue: calculateHandValue(hand.playerHand),
      dealerValue: calculateHandValue(finalDealerHand)
    };

    player.currentHand = null;
    player.currentBet = 0;

    this.notifyLeaderboardUpdate();

    return response;
  }

  getLeaderboard() {
    const players = Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        handsPlayed: p.handsPlayed,
        handsWon: p.handsWon
      }))
      .sort((a, b) => b.chips - a.chips);

    return players;
  }

  getResults() {
    const leaderboard = this.getLeaderboard();
    return {
      phase: this.phase,
      leaderboard,
      winner: leaderboard.length > 0 ? leaderboard[0] : null
    };
  }

  getPlayerState(playerId) {
    const player = this.players.get(playerId);
    if (!player) return null;

    return {
      id: player.id,
      name: player.name,
      chips: player.chips,
      handsPlayed: player.handsPlayed,
      handsWon: player.handsWon,
      hasActiveHand: !!player.currentHand,
      currentHand: player.currentHand ? {
        playerHand: handToStrings(player.currentHand.playerHand),
        dealerVisible: handToStrings(player.currentHand.dealerVisible),
        playerValue: calculateHandValue(player.currentHand.playerHand),
        canDouble: canDoubleDown(player.currentHand.playerHand) && player.chips >= player.currentBet
      } : null
    };
  }

  getTournamentState() {
    return {
      phase: this.phase,
      timeRemaining: this.getTimeRemaining(),
      playerCount: this.players.size,
      leaderboard: this.getLeaderboard()
    };
  }

  notifyLeaderboardUpdate() {
    if (this.onLeaderboardUpdate) {
      this.onLeaderboardUpdate(this.getLeaderboard());
    }
  }

  notifyPhaseChange() {
    if (this.onPhaseChange) {
      this.onPhaseChange(this.getTournamentState());
    }
  }
}

module.exports = Tournament;
