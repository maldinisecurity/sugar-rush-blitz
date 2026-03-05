# Sugar Rush Blitz

Sugar Rush Blitz is a fast, real-time match-3 browser game inspired by Candy Crush-style gameplay.

## Features

- 8x8 match-3 board
- Real-time timer gameplay
- Score, high score, and level progression
- Goal system per level (score + color clear target)
- Special candies:
  - Striped
  - Wrapped
  - Color bomb
- Combo scoring and floating score effects
- Ball pop, spark burst, and rolling drop animations
- Drag-to-swap and tap-to-swap controls
- Pause/resume and end-game modal
- Auto-reshuffle when no valid moves remain
- Local persistence (`localStorage`) for high score and session stats

## Run Locally

Open `index.html` in a browser.

Or serve locally:

```bash
python3 -m http.server 4173
```

Then visit:

`http://127.0.0.1:4173/index.html`

## Controls

- Drag a candy toward a neighbor to swap.
- Or tap one candy, then tap an adjacent candy.
- Create matches of 3 or more to score.

## Project Files

- `index.html` - app layout and HUD
- `styles.css` - visual design and animations
- `script.js` - game logic and effects

## Tech

- Vanilla HTML/CSS/JavaScript
- No external dependencies

## License

MIT
