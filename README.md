# Sugar Rush Blitz

Sugar Rush Blitz is a fast, real-time match-3 browser game inspired by Candy Crush-style gameplay.

## Features

- 8x8 match-3 board
- Real-time timer gameplay
- Deterministic seeded levels
- Score, high score, and level progression
- Goal system per level (score + color clear target)
- Special candies:
  - Striped
  - Wrapped
  - Color bomb
- Special combo interactions (striped+striped, striped+wrapped, wrapped+wrapped, bomb combos)
- Combo scoring and floating score effects
- Ball pop, spark burst, and rolling drop animations
- Drag-to-swap and tap-to-swap controls
- Drag preview and stricter directional swap detection
- Idle hint system + manual hint button
- Pause/resume and end-game modal
- Auto-reshuffle when no valid moves remain
- Accessibility options:
  - Colorblind palette mode
  - Reduced motion mode
  - Keyboard controls
- Local persistence (`localStorage`) for high score and session stats

## Run Locally

Open `index.html` in a browser.

Or serve locally:

```bash
python3 -m http.server 4173
```

Then visit:

`http://127.0.0.1:4173/index.html`

## Scripts

```bash
npm run check   # syntax check
npm test        # unit tests
npm run build   # create dist/ package
```

## Controls

- Drag a candy toward a neighbor to swap.
- Or tap one candy, then tap an adjacent candy.
- Keyboard:
  - Arrow keys to move focus
  - Enter/Space to select and swap
- Create matches of 3 or more to score.

## Project Files

- `index.html` - app layout and HUD
- `styles.css` - visual design and animations
- `script.js` - game logic and effects
- `game-core.js` - pure utility logic for tests
- `core.test.js` - Node test coverage
- `.github/workflows/ci.yml` - CI pipeline
- `netlify.toml` - Netlify build and headers

## Tech

- Vanilla HTML/CSS/JavaScript
- Node built-in test runner (`node:test`)

## Deploy (Netlify)

- Build command: `npm run build`
- Publish directory: `dist`
- Config file: `netlify.toml`

## License

MIT
