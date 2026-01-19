const { drawCard, cardToString } = require('./deck');

function getCardValue(card) {
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 11;
  return parseInt(card.rank, 10);
}

function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    value += getCardValue(card);
    if (card.rank === 'A') aces++;
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

function isBlackjack(hand) {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

function isBust(hand) {
  return calculateHandValue(hand) > 21;
}

function canDoubleDown(hand) {
  return hand.length === 2;
}

function dealInitialHands(shoe) {
  let result = drawCard(shoe);
  const playerCard1 = result.card;
  shoe = result.shoe;

  result = drawCard(shoe);
  const dealerCard1 = result.card;
  shoe = result.shoe;

  result = drawCard(shoe);
  const playerCard2 = result.card;
  shoe = result.shoe;

  result = drawCard(shoe);
  const dealerCard2 = result.card;
  shoe = result.shoe;

  return {
    playerHand: [playerCard1, playerCard2],
    dealerHand: [dealerCard1, dealerCard2],
    shoe
  };
}

function hit(hand, shoe) {
  const result = drawCard(shoe);
  return {
    hand: [...hand, result.card],
    shoe: result.shoe
  };
}

function playDealerHand(dealerHand, shoe) {
  let hand = [...dealerHand];
  let currentShoe = shoe;

  while (calculateHandValue(hand) < 17) {
    const result = drawCard(currentShoe);
    hand.push(result.card);
    currentShoe = result.shoe;
  }

  return { hand, shoe: currentShoe };
}

function determineWinner(playerHand, dealerHand, playerBlackjack, dealerBlackjack) {
  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);

  if (playerBlackjack && dealerBlackjack) {
    return 'push';
  }
  if (playerBlackjack) {
    return 'blackjack';
  }
  if (dealerBlackjack) {
    return 'dealer';
  }
  if (playerValue > 21) {
    return 'dealer';
  }
  if (dealerValue > 21) {
    return 'player';
  }
  if (playerValue > dealerValue) {
    return 'player';
  }
  if (dealerValue > playerValue) {
    return 'dealer';
  }
  return 'push';
}

function calculatePayout(bet, result) {
  switch (result) {
    case 'blackjack':
      return bet + Math.floor(bet * 1.5);
    case 'player':
      return bet * 2;
    case 'push':
      return bet;
    case 'dealer':
    default:
      return 0;
  }
}

function handToStrings(hand) {
  return hand.map(cardToString);
}

module.exports = {
  getCardValue,
  calculateHandValue,
  isBlackjack,
  isBust,
  canDoubleDown,
  dealInitialHands,
  hit,
  playDealerHand,
  determineWinner,
  calculatePayout,
  handToStrings
};
