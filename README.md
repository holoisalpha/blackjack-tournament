# Blackjack Tournament

A real-time multiplayer blackjack tournament game. Compete against other players to finish with the most chips!

## Live Demo

**https://blackjack-tournament.onrender.com**

## Features

- **Real-time Multiplayer** - Compete with other players simultaneously
- **Tournament Mode** - Scheduled tournaments with join period and timed gameplay
- **Live Leaderboard** - See rankings update in real-time
- **Classic Blackjack Rules** - Hit, Stand, Double Down, Split
- **Mobile Friendly** - Play on any device

## How to Play

1. Enter your name and join the tournament
2. Wait for the tournament to start (or for admin to schedule one)
3. Play blackjack hands to increase your chip count
4. Player with the most chips when time runs out wins!

## Game Rules

- **Blackjack pays 3:2**
- **Dealer stands on 17**
- **Double down on any two cards**
- **Split pairs allowed**
- **Insurance offered when dealer shows Ace**

## Running Locally

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or run in dev mode (shorter timers)
npm run dev
```

The game will be available at `http://localhost:3000`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `STARTING_CHIPS` | 1000 | Chips each player starts with |
| `JOIN_PERIOD` | 30 | Seconds to join (dev mode) |
| `TOURNAMENT_DURATION` | 120 | Tournament length in seconds (dev mode) |

## Tech Stack

- **Backend:** Node.js, Express
- **Real-time:** Socket.io
- **Frontend:** Vanilla HTML/CSS/JavaScript

## Deployment

Deployed on Render. Supports any platform with WebSocket support:
- Render
- Railway (paid)
- Fly.io
- Heroku

## License

MIT
