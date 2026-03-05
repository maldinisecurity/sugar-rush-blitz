function keyOf(row, col) {
  return `${row}-${col}`;
}

function findMatchDataForGrid(grid) {
  const size = grid.length;
  const matches = new Set();
  const groups = [];

  for (let row = 0; row < size; row += 1) {
    let start = 0;
    while (start < size) {
      const value = grid[row][start];
      if (value === null || value === undefined) {
        start += 1;
        continue;
      }

      let end = start + 1;
      while (end < size && grid[row][end] === value) end += 1;

      if (end - start >= 3) {
        const cells = [];
        for (let col = start; col < end; col += 1) {
          matches.add(keyOf(row, col));
          cells.push({ row, col });
        }
        groups.push({ dir: "h", len: end - start, cells });
      }
      start = end;
    }
  }

  for (let col = 0; col < size; col += 1) {
    let start = 0;
    while (start < size) {
      const value = grid[start][col];
      if (value === null || value === undefined) {
        start += 1;
        continue;
      }

      let end = start + 1;
      while (end < size && grid[end][col] === value) end += 1;

      if (end - start >= 3) {
        const cells = [];
        for (let row = start; row < end; row += 1) {
          matches.add(keyOf(row, col));
          cells.push({ row, col });
        }
        groups.push({ dir: "v", len: end - start, cells });
      }
      start = end;
    }
  }

  return { matches, groups };
}

function hasValidMoveForGrid(grid) {
  const size = grid.length;
  const dirs = [[0, 1], [1, 0]];

  const swap = (a, b) => {
    const t = grid[a.row][a.col];
    grid[a.row][a.col] = grid[b.row][b.col];
    grid[b.row][b.col] = t;
  };

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= size || nc >= size) continue;

        swap({ row, col }, { row: nr, col: nc });
        const has = findMatchDataForGrid(grid).matches.size > 0;
        swap({ row, col }, { row: nr, col: nc });
        if (has) return true;
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

function computeScoreBreakdown({ clearCount, specialsCleared, combo, scoreMultiplier, timeLeft }) {
  const basePoints = clearCount * 50;
  const specialBonus = specialsCleared * 130;
  const comboMultiplier = 1 + (combo - 1) * 0.35;
  const pressureBonus = timeLeft <= 15 ? Math.round(basePoints * 0.15) : 0;
  const total = Math.round((basePoints + specialBonus + pressureBonus) * comboMultiplier * scoreMultiplier);
  return { basePoints, specialBonus, pressureBonus, comboMultiplier, total };
}

function shouldAdvanceLevel({ score, scoreStart, scoreTarget, colorProgress, colorTargetCount }) {
  return score - scoreStart >= scoreTarget && colorProgress >= colorTargetCount;
}

module.exports = {
  computeScoreBreakdown,
  findMatchDataForGrid,
  hasValidMoveForGrid,
  seededRng,
  shouldAdvanceLevel,
};
