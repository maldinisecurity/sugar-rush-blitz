# Sugar Rush Blitz

Sugar Rush Blitz is a fast browser match-3 game with animated candy movement, cascades, specials, score quotas, color targets, fever scoring, and timed level progression.

## What Changed

- Rebuilt the board around an absolute-positioned piece layer so swaps, drops, refills, clears, and rollbacks animate as continuous movement.
- Added stronger gameplay pacing: timed levels, dual objectives, streak scoring, fever bonus, auto hints, no-move reshuffle, and persistent best score.
- Added special candy behavior for striped, wrapped, and bomb pieces, including chained activations.
- Improved controls across drag, tap, and keyboard play.
- Reworked the layout for a denser game-first interface on desktop and mobile.

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
npm run check
npm test
npm run build
```

## Project Files

- `index.html` - app shell and HUD
- `styles.css` - visual design, layout, and animation system
- `script.js` - game runtime and browser interactions
- `game-core.js` - pure utility logic used by tests
- `core.test.js` - Node test coverage

## Tech

- Vanilla HTML/CSS/JavaScript
- Node built-in test runner (`node:test`)
