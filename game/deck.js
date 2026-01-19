const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createShoe(numDecks = 6) {
  let shoe = [];
  for (let i = 0; i < numDecks; i++) {
    shoe = shoe.concat(createDeck());
  }
  return shuffle(shoe);
}

function drawCard(shoe) {
  if (shoe.length === 0) {
    return { card: null, shoe: createShoe() };
  }
  const card = shoe.pop();
  return { card, shoe };
}

function cardToString(card) {
  return `${card.rank}${card.suit}`;
}

module.exports = {
  createDeck,
  shuffle,
  createShoe,
  drawCard,
  cardToString,
  SUITS,
  RANKS
};
