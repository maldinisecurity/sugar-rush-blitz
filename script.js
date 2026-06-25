const SIZE = 8;
const TYPES = 6;
const START_TIME = 90;
const MOVE_TIME = 260;
const CLEAR_TIME = 210;
const DROP_TIME = 300;
const STORE_BEST = "sugar-rush-best-v3";

const LEVELS = [
  { score: 4500, type: 0, count: 18, time: 90 },
  { score: 10500, type: 2, count: 24, time: 28 },
  { score: 19000, type: 4, count: 30, time: 32 },
  { score: 30000, type: 1, count: 36, time: 36 },
];

const TYPE_NAMES = ["Berry", "Lemon", "Fizz", "Lime", "Grape", "Tangerine"];
const SPARKS = ["#f83f73", "#ffd349", "#20bfd1", "#8ec64b", "#9637b8", "#ff7b48"];

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const timeEl = document.getElementById("time-left");
const levelEl = document.getElementById("level");
const streakEl = document.getElementById("streak");
const clearedEl = document.getElementById("cleared");
const movesEl = document.getElementById("moves");
const feverEl = document.getElementById("fever");
const messageEl = document.getElementById("message");
const goalTitleEl = document.getElementById("goal-title");
const goalCopyEl = document.getElementById("goal-copy");
const scoreLabelEl = document.getElementById("score-label");
const colorLabelEl = document.getElementById("color-label");
const scoreProgressEl = document.getElementById("score-progress");
const colorProgressEl = document.getElementById("color-progress");
const overlayEl = document.getElementById("overlay");
const dialogKickerEl = document.getElementById("dialog-kicker");
const dialogTitleEl = document.getElementById("dialog-title");
const dialogCopyEl = document.getElementById("dialog-copy");
const dialogStatsEl = document.getElementById("dialog-stats");
const startBtn = document.getElementById("start");
const resumeBtn = document.getElementById("resume");
const newGameBtn = document.getElementById("new-game");
const pauseBtn = document.getElementById("pause");
const hintBtn = document.getElementById("hint");
const motionBtn = document.getElementById("motion");
const soundBtn = document.getElementById("sound");

let grid = [];
let pieces = new Map();
let tiles = [];
let pieceLayer;
let fxLayer;
let nextId = 1;
let score = 0;
let highScore = Number(localStorage.getItem(STORE_BEST) || 0);
let levelIndex = 0;
let levelStartScore = 0;
let colorProgress = 0;
let timeLeft = START_TIME;
let moves = 0;
let cleared = 0;
let streak = 1;
let fever = 0;
let selected = null;
let cursor = { row: 0, col: 0 };
let busy = false;
let paused = true;
let gameOver = false;
let timerId = null;
let hintTimer = null;
let pointer = null;
let reducedMotion = false;
let soundOn = true;
let audioCtx = null;

function keyOf(row, col) {
  return `${row}-${col}`;
}

function delay(ms) {
  if (reducedMotion) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function level() {
  return LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function areAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function cellSize() {
  return Number(getComputedStyle(boardEl).getPropertyValue("--cell").replace("px", "")) || 64;
}

function updateBoardMetrics() {
  const gridInset = window.matchMedia("(max-width: 640px)").matches ? 12 : 16;
  const usable = boardEl.clientWidth - gridInset;
  boardEl.style.setProperty("--cell", `${usable / SIZE}px`);
  for (const piece of pieces.values()) placePiece(piece);
}

function buildBoardShell() {
  boardEl.innerHTML = "";
  const boardGrid = document.createElement("div");
  boardGrid.className = "board-grid";
  pieceLayer = document.createElement("div");
  pieceLayer.className = "piece-layer";
  fxLayer = document.createElement("div");
  fxLayer.className = "fx-layer";
  tiles = [];

  for (let row = 0; row < SIZE; row += 1) {
    tiles[row] = [];
    for (let col = 0; col < SIZE; col += 1) {
      const tile = document.createElement("span");
      tile.className = "tile";
      tile.dataset.row = String(row);
      tile.dataset.col = String(col);
      boardGrid.append(tile);
      tiles[row][col] = tile;
    }
  }

  boardEl.append(boardGrid, pieceLayer, fxLayer);
}

function randomType() {
  return Math.floor(Math.random() * TYPES);
}

function safeRandomType(row, col) {
  let type = randomType();
  let guard = 0;
  while (guard < 20) {
    const left = col >= 2 && grid[row][col - 1]?.type === type && grid[row][col - 2]?.type === type;
    const up = row >= 2 && grid[row - 1][col]?.type === type && grid[row - 2][col]?.type === type;
    if (!left && !up) return type;
    type = randomType();
    guard += 1;
  }
  return type;
}

function createPiece(row, col, type = randomType(), special = null) {
  const id = nextId;
  nextId += 1;
  const el = document.createElement("span");
  el.className = "piece";
  el.dataset.id = String(id);
  el.innerHTML = `<span class="piece-inner"></span>`;
  pieceLayer.append(el);
  const piece = { id, row, col, type, special, el };
  pieces.set(id, piece);
  applyPieceClass(piece);
  placePiece(piece);
  return piece;
}

function applyPieceClass(piece) {
  piece.el.className = `piece type-${piece.type}${piece.special ? ` ${piece.special}` : ""}`;
}

function placePiece(piece, row = piece.row, col = piece.col) {
  const size = cellSize();
  piece.el.style.setProperty("--x", `${col * size}px`);
  piece.el.style.setProperty("--y", `${row * size}px`);
}

function movePiece(piece, row, col) {
  piece.row = row;
  piece.col = col;
  placePiece(piece);
}

function clearTileStates() {
  for (const row of tiles) {
    for (const tile of row) tile.className = "tile";
  }
}

function refreshTileStates() {
  clearTileStates();
  if (selected) tiles[selected.row][selected.col].classList.add("selected");
  tiles[cursor.row][cursor.col].classList.add("cursor");
}

function makeBoard() {
  pieces.clear();
  pieceLayer.innerHTML = "";
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  do {
    for (const piece of pieces.values()) piece.el.remove();
    pieces.clear();
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const piece = createPiece(row, col, safeRandomType(row, col));
        grid[row][col] = piece;
      }
    }
  } while (!findValidMove());
}

function swapGrid(a, b) {
  const first = grid[a.row][a.col];
  const second = grid[b.row][b.col];
  grid[a.row][a.col] = second;
  grid[b.row][b.col] = first;
  movePiece(first, b.row, b.col);
  movePiece(second, a.row, a.col);
}

function findMatches() {
  const matches = new Set();
  const groups = [];

  for (let row = 0; row < SIZE; row += 1) {
    let start = 0;
    while (start < SIZE) {
      const first = grid[row][start];
      if (!first || first.special === "bomb") {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < SIZE) {
        const next = grid[row][end];
        if (!next || next.special === "bomb" || next.type !== first.type) break;
        end += 1;
      }
      if (end - start >= 3) {
        const cells = [];
        for (let col = start; col < end; col += 1) {
          matches.add(keyOf(row, col));
          cells.push({ row, col });
        }
        groups.push({ dir: "h", len: end - start, type: first.type, cells });
      }
      start = end;
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    let start = 0;
    while (start < SIZE) {
      const first = grid[start][col];
      if (!first || first.special === "bomb") {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < SIZE) {
        const next = grid[end][col];
        if (!next || next.special === "bomb" || next.type !== first.type) break;
        end += 1;
      }
      if (end - start >= 3) {
        const cells = [];
        for (let row = start; row < end; row += 1) {
          matches.add(keyOf(row, col));
          cells.push({ row, col });
        }
        groups.push({ dir: "v", len: end - start, type: first.type, cells });
      }
      start = end;
    }
  }

  return { matches, groups };
}

function chooseSpecial(matchData, preferred) {
  let chosen = null;
  const hits = new Map();

  for (const group of matchData.groups) {
    for (const cell of group.cells) {
      const key = keyOf(cell.row, cell.col);
      const hit = hits.get(key) || { row: cell.row, col: cell.col, h: 0, v: 0, type: group.type };
      if (group.dir === "h") hit.h += 1;
      else hit.v += 1;
      hits.set(key, hit);
    }

    if (group.len >= 5) {
      const source = group.cells.find((cell) => preferred.has(keyOf(cell.row, cell.col))) || group.cells[2];
      chosen = { ...source, type: group.type, special: "bomb", priority: 4 };
    } else if (group.len === 4 && (!chosen || chosen.priority < 2)) {
      const source = group.cells.find((cell) => preferred.has(keyOf(cell.row, cell.col))) || group.cells[1];
      chosen = { ...source, type: group.type, special: group.dir === "h" ? "striped-h" : "striped-v", priority: 2 };
    }
  }

  for (const hit of hits.values()) {
    if (hit.h && hit.v && (!chosen || chosen.priority < 3)) {
      chosen = { row: hit.row, col: hit.col, type: hit.type, special: "wrapped", priority: 3 };
    }
  }

  return chosen;
}

function addCell(set, row, col) {
  if (inBounds(row, col)) set.add(keyOf(row, col));
}

function expandSpecials(seedSet) {
  const out = new Set(seedSet);
  const queue = [...seedSet];
  const seen = new Set();

  while (queue.length) {
    const key = queue.shift();
    if (seen.has(key)) continue;
    seen.add(key);
    const [row, col] = key.split("-").map(Number);
    const piece = grid[row][col];
    if (!piece?.special) continue;

    const before = out.size;
    if (piece.special === "striped-h") {
      for (let c = 0; c < SIZE; c += 1) addCell(out, row, c);
    } else if (piece.special === "striped-v") {
      for (let r = 0; r < SIZE; r += 1) addCell(out, r, col);
    } else if (piece.special === "wrapped") {
      for (let r = row - 1; r <= row + 1; r += 1) {
        for (let c = col - 1; c <= col + 1; c += 1) addCell(out, r, c);
      }
    } else if (piece.special === "bomb") {
      const target = [...out].map((item) => item.split("-").map(Number))
        .map(([r, c]) => grid[r][c])
        .find((item) => item && item.id !== piece.id && item.special !== "bomb");
      const type = target?.type ?? piece.type;
      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          if (grid[r][c]?.type === type || grid[r][c]?.special === "bomb") addCell(out, r, c);
        }
      }
    }

    if (out.size > before) {
      for (const next of out) {
        if (!seen.has(next)) queue.push(next);
      }
    }
  }

  return out;
}

function findValidMove() {
  const dirs = [[0, 1], [1, 0]];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (!inBounds(nr, nc)) continue;
        if (grid[row][col]?.special === "bomb" || grid[nr][nc]?.special === "bomb") {
          return { from: { row, col }, to: { row: nr, col: nc } };
        }
        swapGrid({ row, col }, { row: nr, col: nc });
        const has = findMatches().matches.size > 0;
        swapGrid({ row, col }, { row: nr, col: nc });
        if (has) return { from: { row, col }, to: { row: nr, col: nc } };
      }
    }
  }
  return null;
}

function computePoints(clearCount, specialsCleared) {
  const base = clearCount * 60;
  const special = specialsCleared * 220;
  const streakBonus = Math.max(0, streak - 1) * clearCount * 30;
  const pressure = timeLeft <= 12 ? Math.round(base * 0.2) : 0;
  const feverBonus = Math.round((base + special) * fever * 0.5);
  return base + special + streakBonus + pressure + feverBonus;
}

function addFloat(text, row, col) {
  const size = cellSize();
  const el = document.createElement("span");
  el.className = "float-text";
  el.textContent = text;
  el.style.left = `${col * size + size / 2}px`;
  el.style.top = `${row * size + size / 2}px`;
  fxLayer.append(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

function addBurst(row, col, type) {
  const size = cellSize();
  const el = document.createElement("span");
  el.className = "burst";
  el.style.left = `${col * size + size / 2}px`;
  el.style.top = `${row * size + size / 2}px`;
  el.style.setProperty("--spark", SPARKS[type] || "#fff");
  fxLayer.append(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

function ensureAudio() {
  if (!soundOn) return;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function tone(freq, ms, type = "sine", gain = 0.035) {
  if (!soundOn || !audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + ms / 1000);
}

async function clearPieces(clearSet, specialToCreate) {
  let specialsCleared = 0;
  let targetCleared = 0;
  let rowSum = 0;
  let colSum = 0;
  const keptKey = specialToCreate ? keyOf(specialToCreate.row, specialToCreate.col) : null;

  for (const key of clearSet) {
    const [row, col] = key.split("-").map(Number);
    const piece = grid[row][col];
    if (!piece) continue;
    rowSum += row;
    colSum += col;
    if (piece.special) specialsCleared += 1;
    if (piece.type === level().type) targetCleared += 1;
    addBurst(row, col, piece.type);
    if (key !== keptKey) piece.el.classList.add("clear");
  }

  await delay(CLEAR_TIME);

  for (const key of clearSet) {
    const [row, col] = key.split("-").map(Number);
    const piece = grid[row][col];
    if (!piece) continue;
    if (key === keptKey) {
      piece.type = specialToCreate.type;
      piece.special = specialToCreate.special;
      applyPieceClass(piece);
      continue;
    }
    piece.el.remove();
    pieces.delete(piece.id);
    grid[row][col] = null;
  }

  const points = computePoints(clearSet.size, specialsCleared);
  score += points;
  cleared += clearSet.size;
  colorProgress += targetCleared;
  fever = clamp(fever + clearSet.size / 90 + specialsCleared * 0.08, 0, 1);
  if (clearSet.size) addFloat(`+${points}`, rowSum / clearSet.size, colSum / clearSet.size);
  tone(380 + streak * 35, 120, streak > 2 ? "square" : "triangle");
  updateHud();
}

async function collapseBoard() {
  for (let col = 0; col < SIZE; col += 1) {
    let write = SIZE - 1;
    for (let row = SIZE - 1; row >= 0; row -= 1) {
      const piece = grid[row][col];
      if (!piece) continue;
      if (write !== row) {
        grid[write][col] = piece;
        grid[row][col] = null;
        movePiece(piece, write, col);
      }
      write -= 1;
    }

    for (let row = write; row >= 0; row -= 1) {
      const piece = createPiece(row, col, randomType());
      grid[row][col] = piece;
      placePiece(piece, row - (write + 1), col);
      requestAnimationFrame(() => movePiece(piece, row, col));
    }
  }
  await delay(DROP_TIME);
}

async function resolveBoard(preferred = new Set()) {
  let cascades = 0;
  while (true) {
    const matchData = findMatches();
    if (!matchData.matches.size) break;
    cascades += 1;
    streak = Math.max(streak, cascades);
    const special = chooseSpecial(matchData, preferred);
    const clearSet = expandSpecials(matchData.matches);
    await clearPieces(clearSet, special);
    await collapseBoard();
    preferred = new Set();
  }

  if (cascades > 1) addFloat(`Streak x${cascades}`, 3.5, 3.5);
  if (!findValidMove()) reshuffleBoard();
  if (score - levelStartScore >= level().score && colorProgress >= level().count) advanceLevel();
  updateHud();
}

function reshuffleBoard() {
  const pool = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) pool.push(grid[row][col]);
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let idx = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const piece = pool[idx];
      grid[row][col] = piece;
      movePiece(piece, row, col);
      idx += 1;
    }
  }
  setMessage("No moves left. Board reshuffled.");
}

async function processSwap(a, b) {
  if (busy || paused || gameOver || !areAdjacent(a, b)) return;
  busy = true;
  clearHints();
  ensureAudio();
  tone(300, 70, "triangle", 0.025);
  const preferred = new Set([keyOf(a.row, a.col), keyOf(b.row, b.col)]);
  swapGrid(a, b);
  await delay(MOVE_TIME);

  const bombSwap = grid[a.row][a.col]?.special === "bomb" || grid[b.row][b.col]?.special === "bomb";
  const matches = findMatches();
  if (!bombSwap && !matches.matches.size) {
    grid[a.row][a.col].el.classList.add("invalid");
    grid[b.row][b.col].el.classList.add("invalid");
    swapGrid(a, b);
    await delay(MOVE_TIME);
    for (const piece of [grid[a.row][a.col], grid[b.row][b.col]]) piece.el.classList.remove("invalid");
    setMessage("That swap needs a match.");
    busy = false;
    selected = null;
    refreshTileStates();
    return;
  }

  moves += 1;
  streak = 1;
  if (bombSwap && !matches.matches.size) {
    await clearPieces(expandSpecials(preferred), null);
    await collapseBoard();
  }
  await resolveBoard(preferred);
  fever = clamp(fever - 0.05, 0, 1);
  selected = null;
  refreshTileStates();
  setMessage(fever >= 0.98 ? "Fever is maxed. Specials score harder." : "Keep chaining for bigger streaks.");
  busy = false;
  scheduleHint();
}

function advanceLevel() {
  if (levelIndex < LEVELS.length - 1) {
    levelIndex += 1;
    levelStartScore = score;
    colorProgress = 0;
    timeLeft += level().time;
    addFloat(`Level ${levelIndex + 1}`, 3.5, 3.5);
    setMessage(`Level ${levelIndex + 1}. Timer bonus added.`);
    makeBoard();
  } else {
    setMessage("Final quota complete. Run up the score before time expires.");
  }
}

function updateHud() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem(STORE_BEST, String(highScore));
  }
  const cfg = level();
  scoreEl.textContent = score.toLocaleString();
  highScoreEl.textContent = highScore.toLocaleString();
  timeEl.textContent = String(timeLeft);
  levelEl.textContent = String(levelIndex + 1);
  streakEl.textContent = `x${streak}`;
  clearedEl.textContent = cleared.toLocaleString();
  movesEl.textContent = moves.toLocaleString();
  feverEl.textContent = `${Math.round(fever * 100)}%`;
  goalTitleEl.textContent = `Level ${levelIndex + 1}`;
  goalCopyEl.textContent = `${cfg.score.toLocaleString()} points and ${cfg.count} ${TYPE_NAMES[cfg.type]} candies.`;
  scoreLabelEl.textContent = `${Math.min(score - levelStartScore, cfg.score).toLocaleString()} / ${cfg.score.toLocaleString()} points`;
  colorLabelEl.textContent = `${Math.min(colorProgress, cfg.count)} / ${cfg.count} ${TYPE_NAMES[cfg.type]}`;
  scoreProgressEl.value = clamp(score - levelStartScore, 0, cfg.score);
  scoreProgressEl.max = cfg.score;
  colorProgressEl.value = clamp(colorProgress, 0, cfg.count);
  colorProgressEl.max = cfg.count;
}

function setMessage(text) {
  messageEl.textContent = text;
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (paused || gameOver) return;
    timeLeft -= 1;
    fever = clamp(fever - 0.012, 0, 1);
    if (timeLeft === 10) {
      setMessage("10 seconds left.");
      tone(220, 160, "sine", 0.05);
    }
    if (timeLeft <= 0) endGame();
    updateHud();
  }, 1000);
}

function showOverlay(mode) {
  overlayEl.classList.remove("hidden");
  resumeBtn.hidden = mode !== "pause";
  startBtn.textContent = mode === "intro" ? "Start Game" : "Play Again";
  if (mode === "intro") {
    dialogKickerEl.textContent = "Match-3 Sprint";
    dialogTitleEl.textContent = "Sugar Rush Blitz";
    dialogCopyEl.textContent = "Swap adjacent sweets, chain cascades, charge fever, and use specials to beat every quota.";
    dialogStatsEl.innerHTML = "";
  } else if (mode === "pause") {
    dialogKickerEl.textContent = "Paused";
    dialogTitleEl.textContent = "Game Paused";
    dialogCopyEl.textContent = "Resume when ready.";
    dialogStatsEl.innerHTML = statsMarkup();
  } else {
    dialogKickerEl.textContent = "Time Up";
    dialogTitleEl.textContent = "Run Complete";
    dialogCopyEl.textContent = `Final score: ${score.toLocaleString()}`;
    dialogStatsEl.innerHTML = statsMarkup();
  }
}

function statsMarkup() {
  return [
    ["Score", score.toLocaleString()],
    ["Best", highScore.toLocaleString()],
    ["Moves", moves.toLocaleString()],
    ["Candies cleared", cleared.toLocaleString()],
  ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function newGame() {
  score = 0;
  levelIndex = 0;
  levelStartScore = 0;
  colorProgress = 0;
  timeLeft = START_TIME;
  moves = 0;
  cleared = 0;
  streak = 1;
  fever = 0;
  selected = null;
  cursor = { row: 0, col: 0 };
  busy = false;
  paused = false;
  gameOver = false;
  makeBoard();
  refreshTileStates();
  updateHud();
  hideOverlay();
  startTimer();
  scheduleHint();
  setMessage("Swap sweets, build streaks, beat the quota.");
}

function pauseGame() {
  if (gameOver || paused) return;
  paused = true;
  clearHints();
  showOverlay("pause");
}

function resumeGame() {
  if (gameOver || !paused) return;
  paused = false;
  hideOverlay();
  scheduleHint();
}

function endGame() {
  gameOver = true;
  paused = true;
  clearInterval(timerId);
  tone(180, 240, "triangle", 0.05);
  showOverlay("end");
}

function cellFromPoint(clientX, clientY) {
  const rect = pieceLayer.getBoundingClientRect();
  const size = rect.width / SIZE;
  const col = Math.floor((clientX - rect.left) / size);
  const row = Math.floor((clientY - rect.top) / size);
  return inBounds(row, col) ? { row, col } : null;
}

function selectCell(cell) {
  if (!cell) return;
  if (!selected) {
    selected = cell;
  } else if (selected.row === cell.row && selected.col === cell.col) {
    selected = null;
  } else if (areAdjacent(selected, cell)) {
    processSwap(selected, cell);
  } else {
    selected = cell;
  }
  cursor = cell;
  refreshTileStates();
}

function dragDirection(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return null;
  if (Math.abs(dx) > Math.abs(dy)) return { row: 0, col: dx > 0 ? 1 : -1 };
  return { row: dy > 0 ? 1 : -1, col: 0 };
}

function clearHints() {
  clearTimeout(hintTimer);
  for (const row of tiles) {
    for (const tile of row) tile.classList.remove("hint");
  }
}

function showHint() {
  clearHints();
  const move = findValidMove();
  if (!move) return;
  tiles[move.from.row][move.from.col].classList.add("hint");
  tiles[move.to.row][move.to.col].classList.add("hint");
}

function scheduleHint() {
  clearHints();
  hintTimer = setTimeout(() => {
    if (!busy && !paused && !gameOver) showHint();
  }, 5000);
}

boardEl.addEventListener("pointerdown", (event) => {
  if (busy || paused || gameOver) return;
  ensureAudio();
  const cell = cellFromPoint(event.clientX, event.clientY);
  if (!cell) return;
  pointer = { cell, x: event.clientX, y: event.clientY, acted: false };
  boardEl.setPointerCapture(event.pointerId);
});

boardEl.addEventListener("pointermove", (event) => {
  if (!pointer || pointer.acted || busy || paused || gameOver) return;
  const dir = dragDirection(pointer, { x: event.clientX, y: event.clientY });
  if (!dir) return;
  const to = { row: pointer.cell.row + dir.row, col: pointer.cell.col + dir.col };
  if (inBounds(to.row, to.col)) {
    pointer.acted = true;
    processSwap(pointer.cell, to);
  }
});

boardEl.addEventListener("pointerup", (event) => {
  if (pointer && !pointer.acted) {
    const cell = cellFromPoint(event.clientX, event.clientY);
    selectCell(cell);
  }
  try {
    boardEl.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture can already be released by the browser.
  }
  pointer = null;
});

boardEl.addEventListener("keydown", (event) => {
  if (busy || paused || gameOver) return;
  const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " "];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  if (event.key === "ArrowUp") cursor.row = Math.max(0, cursor.row - 1);
  if (event.key === "ArrowDown") cursor.row = Math.min(SIZE - 1, cursor.row + 1);
  if (event.key === "ArrowLeft") cursor.col = Math.max(0, cursor.col - 1);
  if (event.key === "ArrowRight") cursor.col = Math.min(SIZE - 1, cursor.col + 1);
  if (event.key === "Enter" || event.key === " ") selectCell({ ...cursor });
  refreshTileStates();
});

startBtn.addEventListener("click", newGame);
resumeBtn.addEventListener("click", resumeGame);
newGameBtn.addEventListener("click", newGame);
pauseBtn.addEventListener("click", () => (paused ? resumeGame() : pauseGame()));
hintBtn.addEventListener("click", showHint);
motionBtn.addEventListener("click", () => {
  reducedMotion = !reducedMotion;
  document.body.classList.toggle("reduced-motion", reducedMotion);
  motionBtn.textContent = reducedMotion ? "Motion Off" : "Motion On";
  motionBtn.setAttribute("aria-pressed", String(!reducedMotion));
});
soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? "Sound On" : "Sound Off";
  soundBtn.setAttribute("aria-pressed", String(soundOn));
});

window.addEventListener("resize", updateBoardMetrics);

buildBoardShell();
updateBoardMetrics();
makeBoard();
refreshTileStates();
updateHud();
showOverlay("intro");
