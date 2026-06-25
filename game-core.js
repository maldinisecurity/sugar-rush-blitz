function keyOf(row, col) {
  return `${row}-${col}`;
}

function findMatchDataForGrid(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const matches = new Set();
  const groups = [];

  for (let row = 0; row < rows; row += 1) {
    let start = 0;
    while (start < cols) {
      const value = grid[row][start];
      if (value === null || value === undefined) {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < cols && grid[row][end] === value) end += 1;
      if (end - start >= 3) {
        const cells = [];
        for (let col = start; col < end; col += 1) {
          matches.add(keyOf(row, col));
          cells.push({ row, col });
        }
        groups.push({ dir: "h", len: end - start, cells, type: value });
      }
      start = end;
    }
  }

  for (let col = 0; col < cols; col += 1) {
    let start = 0;
    while (start < rows) {
      const value = grid[start][col];
      if (value === null || value === undefined) {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < rows && grid[end][col] === value) end += 1;
      if (end - start >= 3) {
        const cells = [];
        for (let row = start; row < end; row += 1) {
          matches.add(keyOf(row, col));
          cells.push({ row, col });
        }
        groups.push({ dir: "v", len: end - start, cells, type: value });
      }
      start = end;
    }
  }

  return { matches, groups };
}

function hasValidMoveForGrid(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const dirs = [[0, 1], [1, 0]];

  const swap = (a, b) => {
    const temp = grid[a.row][a.col];
    grid[a.row][a.col] = grid[b.row][b.col];
    grid[b.row][b.col] = temp;
  };

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= rows || nc >= cols) continue;
        swap({ row, col }, { row: nr, col: nc });
        const hasMatch = findMatchDataForGrid(grid).matches.size > 0;
        swap({ row, col }, { row: nr, col: nc });
        if (hasMatch) return true;
      }
    }
  }

  return false;
}

function seededRng(seed) {
  let x = seed >>> 0;
  return function next() {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

function computeScoreBreakdown({ clearCount, specialsCleared = 0, streak = 1, fever = 0, timeLeft = 0 }) {
  const basePoints = clearCount * 60;
  const specialBonus = specialsCleared * 220;
  const streakBonus = Math.max(0, streak - 1) * clearCount * 30;
  const pressureBonus = timeLeft <= 12 ? Math.round(basePoints * 0.2) : 0;
  const feverBonus = Math.round((basePoints + specialBonus) * Math.min(1, fever) * 0.5);
  const total = basePoints + specialBonus + streakBonus + pressureBonus + feverBonus;
  return { basePoints, specialBonus, streakBonus, pressureBonus, feverBonus, total };
}

function shouldAdvanceLevel({ score, scoreStart, scoreTarget, colorProgress, colorTargetCount }) {
  return score - scoreStart >= scoreTarget && colorProgress >= colorTargetCount;
}

module.exports = {
  computeScoreBreakdown,
  findMatchDataForGrid,
  hasValidMoveForGrid,
  keyOf,
  seededRng,
  shouldAdvanceLevel,
};
