const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeScoreBreakdown,
  findMatchDataForGrid,
  hasValidMoveForGrid,
  seededRng,
  shouldAdvanceLevel,
} = require("./game-core");

test("findMatchDataForGrid detects row and column matches", () => {
  const grid = [
    [1, 1, 1, 2],
    [2, 3, 4, 2],
    [2, 3, 4, 2],
    [2, 5, 6, 2],
  ];
  const out = findMatchDataForGrid(grid);
  assert.equal(out.matches.has("0-0"), true);
  assert.equal(out.matches.has("0-1"), true);
  assert.equal(out.matches.has("0-2"), true);
  assert.equal(out.groups.length >= 2, true);
});

test("hasValidMoveForGrid returns true when a single swap can match", () => {
  const grid = [
    [1, 2, 3],
    [4, 1, 3],
    [5, 1, 6],
  ];
  assert.equal(hasValidMoveForGrid(grid), true);
});

test("seededRng is deterministic", () => {
  const a = seededRng(42);
  const b = seededRng(42);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test("computeScoreBreakdown includes special/combo bonuses", () => {
  const out = computeScoreBreakdown({
    clearCount: 10,
    specialsCleared: 2,
    combo: 3,
    scoreMultiplier: 2,
    timeLeft: 12,
  });
  assert.equal(out.basePoints, 500);
  assert.equal(out.specialBonus, 260);
  assert.equal(out.total > 0, true);
});

test("shouldAdvanceLevel validates score and color goals", () => {
  assert.equal(
    shouldAdvanceLevel({
      score: 7000,
      scoreStart: 1000,
      scoreTarget: 5000,
      colorProgress: 20,
      colorTargetCount: 20,
    }),
    true
  );
  assert.equal(
    shouldAdvanceLevel({
      score: 6500,
      scoreStart: 1000,
      scoreTarget: 5000,
      colorProgress: 18,
      colorTargetCount: 20,
    }),
    false
  );
});
