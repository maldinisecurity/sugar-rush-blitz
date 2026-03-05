const BOARD_SIZE = 8;
const CANDY_TYPES = 6;
const BASE_TIME_SECONDS = 90;
const TIME_BONUS_PER_LEVEL = 18;
const SCORE_PER_CANDY = 60;
const FALL_ANIMATION_MS = 280;
const MATCH_ANIMATION_MS = 190;
const CLEAR_DELAY_MS = 55;
const STORAGE_STATS_KEY = "candy-session-stats-v2";
const STORAGE_HIGH_SCORE_KEY = "candy-high-score";

const LEVELS = [
  { scoreTarget: 5000, colorTarget: { type: 0, count: 20 } },
  { scoreTarget: 12000, colorTarget: { type: 2, count: 26 } },
  { scoreTarget: 22000, colorTarget: { type: 4, count: 30 } },
];

const COLOR_NAMES = ["Pink", "Yellow", "Blue", "Green", "Purple", "Orange"];

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("high-score");
const timeLeftEl = document.getElementById("time-left");
const levelEl = document.getElementById("level");
const goalTextEl = document.getElementById("goal-text");
const goalProgressEl = document.getElementById("goal-progress");
const messageEl = document.getElementById("message");
const resetBtn = document.getElementById("reset-btn");
const pauseBtn = document.getElementById("pause-btn");
const overlayEl = document.getElementById("overlay");
const modalTitleEl = document.getElementById("modal-title");
const modalTextEl = document.getElementById("modal-text");
const modalStatsEl = document.getElementById("modal-stats");
const resumeBtn = document.getElementById("resume-btn");
const playAgainBtn = document.getElementById("play-again-btn");

let board = [];
let score = 0;
let highScore = Number(localStorage.getItem(STORAGE_HIGH_SCORE_KEY) || 0);
let timeLeft = BASE_TIME_SECONDS;
let currentLevel = 1;
let levelState = { scoreStart: 0, colorProgress: 0 };
let selectedCell = null;
let busy = false;
let paused = false;
let gameOver = false;
let timerId = null;
let comboLongestThisRun = 0;
let totalMatchesThisRun = 0;
let audioCtx = null;
let warnedLowTime = false;

const persistentStats = loadPersistentStats();
const cellEls = [];
const candyEls = [];
const specialEls = [];
let pointerState = null;

highScoreEl.textContent = String(highScore);

function loadPersistentStats() {
  const fallback = {
    gamesPlayed: 0,
    totalScore: 0,
    longestComboEver: 0,
    totalMatchesEver: 0,
    scoreHistory: [],
  };

  try {
    const raw = localStorage.getItem(STORAGE_STATS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      scoreHistory: Array.isArray(parsed.scoreHistory)
        ? parsed.scoreHistory.slice(-10)
        : [],
    };
  } catch {
    return fallback;
  }
}

function savePersistentStats() {
  localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(persistentStats));
}

function randomCandyType() {
  return Math.floor(Math.random() * CANDY_TYPES);
}

function createCell(type = randomCandyType(), special = null) {
  return { type, special };
}

function keyOf(row, col) {
  return `${row}-${col}`;
}

function parseKey(key) {
  const [row, col] = key.split("-").map(Number);
  return { row, col };
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function setMessage(text) {
  messageEl.textContent = text;
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(freq, durationMs, type = "sine", gain = 0.05) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

function playSwapSound() {
  playTone(330, 70, "triangle", 0.03);
}

function playMatchSound(combo) {
  const base = 410 + Math.min(combo, 6) * 40;
  playTone(base, 120, "square", 0.04);
}

function playComboSound(combo) {
  playTone(530 + Math.min(combo, 7) * 35, 140, "sawtooth", 0.045);
}

function playWarningSound() {
  playTone(240, 130, "sine", 0.05);
}

function playEndSound() {
  playTone(280, 100, "triangle", 0.045);
  setTimeout(() => playTone(220, 160, "triangle", 0.04), 90);
}

function buildBoardDom() {
  boardEl.innerHTML = "";
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    cellEls[row] = [];
    candyEls[row] = [];
    specialEls[row] = [];

    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute("aria-label", `Candy at row ${row + 1}, column ${col + 1}`);

      const candy = document.createElement("span");
      candy.className = "candy";

      const special = document.createElement("span");
      special.className = "special";

      cell.appendChild(candy);
      cell.appendChild(special);
      boardEl.appendChild(cell);

      cellEls[row][col] = cell;
      candyEls[row][col] = candy;
      specialEls[row][col] = special;
    }
  }
}

function refreshCell(row, col, dropRows = 0) {
  const cellData = board[row][col];
  const candy = candyEls[row][col];
  const special = specialEls[row][col];

  if (!cellData) {
    candy.style.visibility = "hidden";
    candy.className = "candy";
    special.className = "special";
    return;
  }

  candy.style.visibility = "visible";
  candy.className = `candy type-${cellData.type ?? 0}`;

  if (dropRows > 0) {
    candy.classList.add("falling");
    const stepPx = boardEl.clientWidth / BOARD_SIZE;
    candy.style.setProperty("--fall-distance", `${Math.round(stepPx * dropRows)}px`);
    candy.style.setProperty("--fall-turns", `${Math.max(0.2, dropRows * 0.34)}turn`);
  } else {
    candy.style.removeProperty("--fall-distance");
    candy.style.removeProperty("--fall-turns");
  }

  special.className = "special";
  if (cellData.special === "striped-h") {
    special.classList.add("striped-h");
  } else if (cellData.special === "striped-v") {
    special.classList.add("striped-v");
  } else if (cellData.special === "wrapped") {
    special.classList.add("wrapped");
  } else if (cellData.special === "color-bomb") {
    special.classList.add("color-bomb");
    candy.className = "candy";
  }
}

function refreshBoard(dropMap = null, changedKeys = null) {
  if (!changedKeys) {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        refreshCell(row, col, dropMap?.[row]?.[col] || 0);
      }
    }
    return;
  }

  for (const key of changedKeys) {
    const { row, col } = parseKey(key);
    refreshCell(row, col, dropMap?.[row]?.[col] || 0);
  }
}

function clearSelection() {
  if (selectedCell) {
    cellEls[selectedCell.row][selectedCell.col].classList.remove("selected");
  }
  selectedCell = null;
}

function setSelected(row, col) {
  clearSelection();
  selectedCell = { row, col };
  cellEls[row][col].classList.add("selected");
}

function updateHud() {
  scoreEl.textContent = String(score);
  timeLeftEl.textContent = String(timeLeft);
  levelEl.textContent = String(currentLevel);

  if (score > highScore) {
    highScore = score;
    highScoreEl.textContent = String(highScore);
    localStorage.setItem(STORAGE_HIGH_SCORE_KEY, String(highScore));
  }

  updateGoalsHud();
}

function currentLevelConfig() {
  return LEVELS[Math.min(currentLevel - 1, LEVELS.length - 1)];
}

function updateGoalsHud() {
  const goal = currentLevelConfig();
  const colorName = COLOR_NAMES[goal.colorTarget.type];
  goalTextEl.textContent = `Goal: ${goal.scoreTarget.toLocaleString()} points + clear ${goal.colorTarget.count} ${colorName}.`;

  const scoreProgress = Math.max(0, score - levelState.scoreStart);
  goalProgressEl.textContent = `Progress: ${scoreProgress.toLocaleString()} / ${goal.scoreTarget.toLocaleString()} | ${levelState.colorProgress} / ${goal.colorTarget.count} ${colorName}`;
}

function areAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function swapCells(a, b) {
  const temp = board[a.row][a.col];
  board[a.row][a.col] = board[b.row][b.col];
  board[b.row][b.col] = temp;
}

function createRandomBoard() {
  board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => createCell())
  );

  while (findMatchData().matches.size > 0 || !hasValidMove()) {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        board[row][col] = createCell();
      }
    }
  }
}

function findMatchData() {
  const matches = new Set();
  const groups = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let start = 0;
    while (start < BOARD_SIZE) {
      const first = board[row][start];
      if (!first || first.special === "color-bomb" || first.type === null) {
        start += 1;
        continue;
      }

      let end = start + 1;
      while (end < BOARD_SIZE) {
        const next = board[row][end];
        if (!next || next.special === "color-bomb" || next.type !== first.type) break;
        end += 1;
      }

      const len = end - start;
      if (len >= 3) {
        const cells = [];
        for (let col = start; col < end; col += 1) {
          matches.add(keyOf(row, col));
          cells.push({ row, col });
        }
        groups.push({ dir: "h", len, cells });
      }

      start = end;
    }
  }

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let start = 0;
    while (start < BOARD_SIZE) {
      const first = board[start][col];
      if (!first || first.special === "color-bomb" || first.type === null) {
        start += 1;
        continue;
      }

      let end = start + 1;
      while (end < BOARD_SIZE) {
        const next = board[end][col];
        if (!next || next.special === "color-bomb" || next.type !== first.type) break;
        end += 1;
      }

      const len = end - start;
      if (len >= 3) {
        const cells = [];
        for (let row = start; row < end; row += 1) {
          matches.add(keyOf(row, col));
          cells.push({ row, col });
        }
        groups.push({ dir: "v", len, cells });
      }

      start = end;
    }
  }

  return { matches, groups };
}

function tryColorBombSwap(a, b) {
  const cellA = board[a.row][a.col];
  const cellB = board[b.row][b.col];

  const bombA = cellA?.special === "color-bomb";
  const bombB = cellB?.special === "color-bomb";
  if (!bombA && !bombB) return null;

  const clearSet = new Set();

  if (bombA && bombB) {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        clearSet.add(keyOf(row, col));
      }
    }
    return { clearSet, scoreMult: 3 };
  }

  const targetType = bombA ? cellB?.type : cellA?.type;
  if (targetType === null || targetType === undefined) {
    clearSet.add(keyOf(a.row, a.col));
    clearSet.add(keyOf(b.row, b.col));
    return { clearSet, scoreMult: 1.5 };
  }

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = board[row][col];
      if (cell && cell.type === targetType) {
        clearSet.add(keyOf(row, col));
      }
    }
  }

  clearSet.add(keyOf(a.row, a.col));
  clearSet.add(keyOf(b.row, b.col));

  return { clearSet, scoreMult: 2 };
}

function determineSpecialToCreate(matchData, preferredCells) {
  const cellHits = new Map();
  let best = null;

  for (const group of matchData.groups) {
    for (const cell of group.cells) {
      const key = keyOf(cell.row, cell.col);
      if (!cellHits.has(key)) {
        cellHits.set(key, { h: 0, v: 0, row: cell.row, col: cell.col });
      }
      const entry = cellHits.get(key);
      if (group.dir === "h") entry.h += 1;
      else entry.v += 1;
    }

    if (group.len >= 5) {
      const source = choosePreferredCell(group.cells, preferredCells) || group.cells[2];
      best = { row: source.row, col: source.col, special: "color-bomb", type: null, priority: 4 };
    } else if (!best && group.len === 4) {
      const source = choosePreferredCell(group.cells, preferredCells) || group.cells[1];
      best = {
        row: source.row,
        col: source.col,
        special: group.dir === "h" ? "striped-h" : "striped-v",
        type: board[source.row][source.col]?.type ?? randomCandyType(),
        priority: 2,
      };
    }
  }

  for (const entry of cellHits.values()) {
    if (entry.h > 0 && entry.v > 0) {
      const priority = 3;
      if (!best || priority > best.priority) {
        best = {
          row: entry.row,
          col: entry.col,
          special: "wrapped",
          type: board[entry.row][entry.col]?.type ?? randomCandyType(),
          priority,
        };
      }
    }
  }

  if (!best) return null;
  return { row: best.row, col: best.col, special: best.special, type: best.type };
}

function choosePreferredCell(cells, preferredCells) {
  for (const cell of cells) {
    if (preferredCells.has(keyOf(cell.row, cell.col))) return cell;
  }
  return null;
}

function expandSpecialEffects(seedSet) {
  const clearSet = new Set(seedSet);
  const queue = [...seedSet];
  const activated = new Set();

  while (queue.length) {
    const key = queue.shift();
    if (activated.has(key)) continue;
    activated.add(key);

    const { row, col } = parseKey(key);
    const cell = board[row][col];
    if (!cell || !cell.special) continue;

    const add = (r, c) => {
      if (!inBounds(r, c)) return;
      const next = keyOf(r, c);
      if (!clearSet.has(next)) {
        clearSet.add(next);
        queue.push(next);
      }
    };

    if (cell.special === "striped-h") {
      for (let c = 0; c < BOARD_SIZE; c += 1) add(row, c);
    } else if (cell.special === "striped-v") {
      for (let r = 0; r < BOARD_SIZE; r += 1) add(r, col);
    } else if (cell.special === "wrapped") {
      for (let r = row - 1; r <= row + 1; r += 1) {
        for (let c = col - 1; c <= col + 1; c += 1) {
          add(r, c);
        }
      }
    } else if (cell.special === "color-bomb") {
      for (let r = 0; r < BOARD_SIZE; r += 1) {
        for (let c = 0; c < BOARD_SIZE; c += 1) {
          add(r, c);
        }
      }
    }
  }

  return clearSet;
}

function showFloatingText(text, row, col, extraClass = "") {
  const bubble = document.createElement("span");
  bubble.className = `floating-text ${extraClass}`.trim();
  bubble.textContent = text;
  bubble.style.gridRowStart = String(row + 1);
  bubble.style.gridColumnStart = String(col + 1);
  boardEl.appendChild(bubble);
  bubble.addEventListener("animationend", () => bubble.remove(), { once: true });
}

function showClearSpark(row, col, candyType = 0) {
  const cell = cellEls[row]?.[col];
  if (!cell) return;

  const boardRect = boardEl.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  const spark = document.createElement("span");
  spark.className = `impact-spark type-${candyType}`;
  spark.style.left = `${cellRect.left - boardRect.left + cellRect.width / 2}px`;
  spark.style.top = `${cellRect.top - boardRect.top + cellRect.height / 2}px`;
  boardEl.appendChild(spark);
  spark.addEventListener("animationend", () => spark.remove(), { once: true });
}

function triggerBoardImpact(clearCount) {
  if (clearCount < 4) return;
  boardEl.classList.remove("combo-impact");
  void boardEl.offsetWidth;
  boardEl.classList.add("combo-impact");
  boardEl.addEventListener(
    "animationend",
    () => boardEl.classList.remove("combo-impact"),
    { once: true }
  );
}

async function animateMatches(clearSet, combo) {
  let rowSum = 0;
  let colSum = 0;
  const sparkStride = clearSet.size > 24 ? 2 : 1;
  let index = 0;

  for (const key of clearSet) {
    const { row, col } = parseKey(key);
    const candyType = board[row][col]?.type ?? 0;
    rowSum += row;
    colSum += col;
    const candy = candyEls[row][col];
    if (candy) candy.classList.add("matched");
    if (index % sparkStride === 0) {
      showClearSpark(row, col, candyType);
    }
    index += 1;
  }

  const count = clearSet.size || 1;
  const centerRow = Math.round(rowSum / count);
  const centerCol = Math.round(colSum / count);
  const points = clearSet.size * SCORE_PER_CANDY * combo;
  showFloatingText(`+${points}`, centerRow, centerCol);
  if (combo > 1) {
    showFloatingText(`Combo x${combo}`, Math.max(0, centerRow - 1), centerCol, "combo");
    playComboSound(combo);
  } else {
    playMatchSound(combo);
  }

  if (combo >= 3) vibrate([12, 35, 12]);
  else vibrate(10);
  triggerBoardImpact(clearSet.size);

  await delay(MATCH_ANIMATION_MS);
}

function clearCellsAndApplyScore(clearSet, combo, scoreMultiplier = 1) {
  let colorsCleared = 0;

  for (const key of clearSet) {
    const { row, col } = parseKey(key);
    const cell = board[row][col];
    if (cell && cell.type !== null && cell.type === currentLevelConfig().colorTarget.type) {
      colorsCleared += 1;
    }
    board[row][col] = null;
  }

  levelState.colorProgress += colorsCleared;
  totalMatchesThisRun += clearSet.size;
  comboLongestThisRun = Math.max(comboLongestThisRun, combo);

  score += Math.round(clearSet.size * SCORE_PER_CANDY * combo * scoreMultiplier);
}

function collapseBoard() {
  const dropMap = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let pointer = BOARD_SIZE - 1;

    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const cell = board[row][col];
      if (cell) {
        const dropRows = pointer - row;
        board[pointer][col] = cell;
        dropMap[pointer][col] = dropRows;
        if (pointer !== row) board[row][col] = null;
        pointer -= 1;
      }
    }

    const generatedRows = pointer + 1;
    while (pointer >= 0) {
      board[pointer][col] = createCell();
      dropMap[pointer][col] = generatedRows;
      pointer -= 1;
    }
  }

  return dropMap;
}

function boardSnapshot() {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function restoreSnapshot(snapshot) {
  board = snapshot.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function hasValidMove() {
  const directions = [
    [0, 1],
    [1, 0],
  ];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = board[row][col];
      if (!cell) continue;

      for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (!inBounds(nr, nc)) continue;
        const other = board[nr][nc];
        if (!other) continue;

        if (cell.special === "color-bomb" || other.special === "color-bomb") return true;

        swapCells({ row, col }, { row: nr, col: nc });
        const hasMatch = findMatchData().matches.size > 0;
        swapCells({ row, col }, { row: nr, col: nc });

        if (hasMatch) return true;
      }
    }
  }

  return false;
}

function reshuffleBoard() {
  const pool = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = board[row][col];
      if (cell) pool.push(cell);
    }
  }

  let tries = 0;
  do {
    tries += 1;
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    let idx = 0;
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        board[row][col] = { ...pool[idx] };
        idx += 1;
      }
    }
  } while ((findMatchData().matches.size > 0 || !hasValidMove()) && tries < 20);

  refreshBoard();
  setMessage("No moves left. Board reshuffled.");
}

function shouldAdvanceLevel() {
  const goal = currentLevelConfig();
  const scoreProgress = score - levelState.scoreStart;
  return scoreProgress >= goal.scoreTarget && levelState.colorProgress >= goal.colorTarget.count;
}

function advanceLevel() {
  if (currentLevel >= LEVELS.length) {
    setMessage("Final level complete. Push for a huge score before time runs out.");
    showFloatingText("Level Complete!", 3, 3, "combo");
    return;
  }

  currentLevel += 1;
  levelState = { scoreStart: score, colorProgress: 0 };
  timeLeft += TIME_BONUS_PER_LEVEL;
  warnedLowTime = false;
  createRandomBoard();
  refreshBoard();
  showFloatingText(`Level ${currentLevel}!`, 3, 3, "combo");
  setMessage(`Level ${currentLevel} started. +${TIME_BONUS_PER_LEVEL}s bonus.`);
}

async function resolveBoard(preferredCells = new Set(), scoreMultiplier = 1) {
  let combo = 1;

  while (true) {
    const matchData = findMatchData();
    if (matchData.matches.size === 0) break;

    const specialToCreate = determineSpecialToCreate(matchData, preferredCells);
    const clearSet = expandSpecialEffects(matchData.matches);

    await animateMatches(clearSet, combo);
    clearCellsAndApplyScore(clearSet, combo, scoreMultiplier);

    if (specialToCreate && inBounds(specialToCreate.row, specialToCreate.col)) {
      board[specialToCreate.row][specialToCreate.col] = {
        type: specialToCreate.type,
        special: specialToCreate.special,
      };
    }

    updateHud();
    await delay(CLEAR_DELAY_MS);

    const dropMap = collapseBoard();
    refreshBoard(dropMap);
    await delay(FALL_ANIMATION_MS);

    preferredCells = new Set();
    combo += 1;
  }

  if (!hasValidMove()) {
    reshuffleBoard();
  }

  if (shouldAdvanceLevel()) {
    advanceLevel();
    updateHud();
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSwapDirection(startX, startY, endX, endY) {
  const dx = endX - startX;
  const dy = endY - startY;
  const threshold = 14;

  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? { dr: 0, dc: 1 } : { dr: 0, dc: -1 };
  return dy > 0 ? { dr: 1, dc: 0 } : { dr: -1, dc: 0 };
}

async function processSwap(a, b) {
  if (busy || paused || gameOver) return;
  if (!inBounds(a.row, a.col) || !inBounds(b.row, b.col)) return;
  if (!areAdjacent(a, b)) return;

  busy = true;
  playSwapSound();
  candyEls[a.row][a.col].classList.add("swapping");
  candyEls[b.row][b.col].classList.add("swapping");

  const preferred = new Set([keyOf(a.row, a.col), keyOf(b.row, b.col)]);
  swapCells(a, b);
  refreshCell(a.row, a.col);
  refreshCell(b.row, b.col);

  const bombResult = tryColorBombSwap(a, b);
  const hasMatch = findMatchData().matches.size > 0;

  if (!bombResult && !hasMatch) {
    await delay(115);
    swapCells(a, b);
    refreshCell(a.row, a.col);
    refreshCell(b.row, b.col);
    setMessage("Invalid move. Swap must create a match.");
    busy = false;
    clearSelection();
    return;
  }

  if (bombResult) {
    await animateMatches(bombResult.clearSet, 1);
    clearCellsAndApplyScore(bombResult.clearSet, 1, bombResult.scoreMult);
    updateHud();
    await delay(CLEAR_DELAY_MS);
    const dropMap = collapseBoard();
    refreshBoard(dropMap);
    await delay(FALL_ANIMATION_MS);
    await resolveBoard();
  } else {
    await resolveBoard(preferred);
  }

  setMessage("Keep chaining for bigger combos.");
  clearSelection();
  busy = false;
}

function handleBoardClick(cell) {
  if (busy || paused || gameOver) return;

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (!selectedCell) {
    setSelected(row, col);
    return;
  }

  const prev = selectedCell;
  if (prev.row === row && prev.col === col) {
    clearSelection();
    return;
  }

  if (!areAdjacent(prev, { row, col })) {
    setSelected(row, col);
    return;
  }

  processSwap(prev, { row, col });
}

function stopTimer() {
  if (!timerId) return;
  clearInterval(timerId);
  timerId = null;
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (paused || gameOver) return;
    timeLeft = Math.max(0, timeLeft - 1);

    if (timeLeft <= 10 && !warnedLowTime) {
      warnedLowTime = true;
      playWarningSound();
      setMessage("10 seconds left. Move fast.");
    }

    updateHud();
    if (timeLeft === 0) {
      endGame();
    }
  }, 1000);
}

function showOverlay(mode) {
  overlayEl.classList.remove("hidden");

  if (mode === "pause") {
    modalTitleEl.textContent = "Game Paused";
    modalTextEl.textContent = "Tap Resume to continue.";
    resumeBtn.style.display = "inline-block";
  } else {
    modalTitleEl.textContent = "Time Up";
    modalTextEl.textContent = `Final score: ${score.toLocaleString()}`;
    resumeBtn.style.display = "none";
  }

  const avgScore =
    persistentStats.gamesPlayed > 0
      ? Math.round(persistentStats.totalScore / persistentStats.gamesPlayed)
      : 0;

  modalStatsEl.innerHTML = [
    `This run combo: x${comboLongestThisRun}`,
    `This run matches: ${totalMatchesThisRun.toLocaleString()}`,
    `Games played: ${persistentStats.gamesPlayed.toLocaleString()}`,
    `Average score: ${avgScore.toLocaleString()}`,
    `Best combo ever: x${persistentStats.longestComboEver}`,
  ].join("<br>");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function pauseGame() {
  if (gameOver || paused) return;
  paused = true;
  stopTimer();
  showOverlay("pause");
  setMessage("Paused.");
}

function resumeGame() {
  if (gameOver || !paused) return;
  paused = false;
  hideOverlay();
  startTimer();
  setMessage("Back in action.");
}

function endGame() {
  gameOver = true;
  paused = false;
  stopTimer();
  clearSelection();
  playEndSound();
  vibrate([20, 40, 20]);

  persistentStats.gamesPlayed += 1;
  persistentStats.totalScore += score;
  persistentStats.longestComboEver = Math.max(
    persistentStats.longestComboEver,
    comboLongestThisRun
  );
  persistentStats.totalMatchesEver += totalMatchesThisRun;
  persistentStats.scoreHistory.push(score);
  persistentStats.scoreHistory = persistentStats.scoreHistory.slice(-10);
  savePersistentStats();

  setMessage("Game over. Check stats and play again.");
  showOverlay("gameover");
}

function togglePause() {
  if (paused) resumeGame();
  else pauseGame();
}

function startGame() {
  score = 0;
  timeLeft = BASE_TIME_SECONDS;
  currentLevel = 1;
  levelState = { scoreStart: 0, colorProgress: 0 };
  selectedCell = null;
  busy = false;
  paused = false;
  gameOver = false;
  comboLongestThisRun = 0;
  totalMatchesThisRun = 0;
  warnedLowTime = false;

  createRandomBoard();
  refreshBoard();
  hideOverlay();
  updateHud();
  startTimer();
  setMessage("Real-time mode: drag or tap to swap and chain combos.");
}

function extractCellFromEventTarget(target) {
  return target.closest(".cell");
}

boardEl.addEventListener("pointerdown", (event) => {
  const cell = extractCellFromEventTarget(event.target);
  if (!cell || busy || paused || gameOver) return;

  ensureAudioContext();

  pointerState = {
    startX: event.clientX,
    startY: event.clientY,
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
    acted: false,
  };

  boardEl.setPointerCapture(event.pointerId);
});

boardEl.addEventListener("pointermove", (event) => {
  if (!pointerState || pointerState.acted || busy || paused || gameOver) return;

  const dir = getSwapDirection(
    pointerState.startX,
    pointerState.startY,
    event.clientX,
    event.clientY
  );
  if (!dir) return;

  pointerState.acted = true;
  const from = { row: pointerState.row, col: pointerState.col };
  const to = { row: from.row + dir.dr, col: from.col + dir.dc };
  processSwap(from, to);
});

boardEl.addEventListener("pointerup", (event) => {
  if (pointerState && !pointerState.acted) {
    const cell = extractCellFromEventTarget(event.target);
    if (cell) handleBoardClick(cell);
  }

  if (pointerState) {
    try {
      boardEl.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  pointerState = null;
});

boardEl.addEventListener("click", (event) => {
  if (pointerState) return;
  const cell = extractCellFromEventTarget(event.target);
  if (!cell) return;
  handleBoardClick(cell);
});

resetBtn.addEventListener("click", () => {
  startGame();
});

pauseBtn.addEventListener("click", () => {
  togglePause();
});

resumeBtn.addEventListener("click", () => {
  resumeGame();
});

playAgainBtn.addEventListener("click", () => {
  startGame();
});

buildBoardDom();
startGame();
