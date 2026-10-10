import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  calculateMetrics,
  challengeCells,
  createInitialState,
  logCheckIn,
  setDayStatus,
  setStreakDay,
  setStreakStart,
} from '../src/tracker.js';

const TODAY = '2026-10-09';

test('manual day setup fills prior days but leaves today in progress', () => {
  const state = setStreakDay(createInitialState(), 7, TODAY);
  const metrics = calculateMetrics(state, TODAY);

  assert.equal(state.startDate, '2026-10-03');
  assert.equal(state.entries['2026-10-08'], 'clean');
  assert.equal(state.entries[TODAY], undefined);
  assert.equal(metrics.day, 7);
  assert.equal(metrics.completedDays, 6);
  assert.equal(metrics.unlocked, 6);
});

test('a clean check-in completes today and unlocks that day’s wallpaper', () => {
  const backfilled = setStreakDay(createInitialState(), 7, TODAY);
  const state = logCheckIn(backfilled, 'clean', TODAY);
  const metrics = calculateMetrics(state, TODAY);

  assert.equal(metrics.day, 7);
  assert.equal(metrics.completedDays, 7);
  assert.equal(metrics.unlocked, 7);
});

test('relapse locks all wallpapers; the next clean day starts at day one', () => {
  const streak = setStreakDay(createInitialState(), 10, TODAY);
  const relapsed = logCheckIn(streak, 'relapsed', TODAY);
  const afterRelapse = calculateMetrics(relapsed, TODAY);

  assert.equal(afterRelapse.day, 0);
  assert.equal(afterRelapse.unlocked, 0);
  assert.equal(relapsed.entries[TODAY], 'relapsed');

  const tomorrow = addDays(TODAY, 1);
  const newStreak = logCheckIn(relapsed, 'clean', tomorrow);
  const newMetrics = calculateMetrics(newStreak, tomorrow);
  assert.equal(newMetrics.day, 1);
  assert.equal(newMetrics.unlocked, 1);
});

test('a clean run from yesterday counts as today in progress until checked in', () => {
  const state = {
    startDate: null,
    entries: {
      '2026-10-07': 'clean',
      '2026-10-08': 'clean',
    },
  };
  const metrics = calculateMetrics(state, TODAY);

  assert.equal(metrics.day, 3);
  assert.equal(metrics.completedDays, 2);
  assert.equal(metrics.unlocked, 2);
});

test('manual start accepts only the current day and previous 20 days', () => {
  const valid = setStreakStart(createInitialState(), '2026-09-19', TODAY);
  assert.equal(calculateMetrics(valid, TODAY).day, 21);
  assert.throws(
    () => setStreakStart(createInitialState(), '2026-09-18', TODAY),
    RangeError,
  );
});

test('a relapse already logged today cannot be backdated away', () => {
  const relapsed = logCheckIn(createInitialState(), 'relapsed', TODAY);
  assert.throws(() => setStreakDay(relapsed, 4, TODAY), /relapse is already logged/);
});

test('correcting a same-day relapse restarts the count today rather than rewinding', () => {
  const priorStreak = setStreakDay(createInitialState(), 8, TODAY);
  const relapsed = logCheckIn(priorStreak, 'relapsed', TODAY);
  const corrected = logCheckIn(relapsed, 'clean', TODAY);
  const metrics = calculateMetrics(corrected, TODAY);

  assert.equal(corrected.startDate, TODAY);
  assert.equal(metrics.day, 1);
  assert.equal(metrics.unlocked, 1);
});

test('calendar edits can change and clear any past day while keeping history', () => {
  const backfilled = setStreakDay(createInitialState(), 7, TODAY);
  const relapsedMidRun = setDayStatus(backfilled, '2026-10-05', 'relapsed', TODAY);
  const broken = calculateMetrics(relapsedMidRun, TODAY);

  assert.equal(relapsedMidRun.entries['2026-10-05'], 'relapsed');
  assert.equal(relapsedMidRun.entries['2026-10-04'], 'clean');
  assert.equal(broken.startDate, '2026-10-06');
  assert.equal(broken.day, 4);

  // Clearing leaves the day unmarked, so the run keeps only the clean tail.
  const cleared = setDayStatus(relapsedMidRun, '2026-10-05', null, TODAY);
  const clearedMetrics = calculateMetrics(cleared, TODAY);
  assert.equal(clearedMetrics.startDate, '2026-10-06');
  assert.equal(clearedMetrics.day, 4);

  // Changing the day to clean reconnects the earlier days into one run.
  const restored = setDayStatus(relapsedMidRun, '2026-10-05', 'clean', TODAY);
  const restoredMetrics = calculateMetrics(restored, TODAY);
  assert.equal(restoredMetrics.startDate, '2026-10-03');
  assert.equal(restoredMetrics.day, 7);
});

test('marking a clean day just before the run extends it backward', () => {
  const run = setStreakDay(createInitialState(), 3, TODAY);
  const extended = setDayStatus(run, '2026-10-06', 'clean', TODAY);
  const metrics = calculateMetrics(extended, TODAY);

  assert.equal(metrics.startDate, '2026-10-06');
  assert.equal(metrics.day, 4);
});

test('days in the future cannot be marked', () => {
  assert.throws(
    () => setDayStatus(createInitialState(), addDays(TODAY, 1), 'clean', TODAY),
    RangeError,
  );
});

test('a relapse edit locks the applied wallpaper', () => {
  const themed = { ...setStreakDay(createInitialState(), 5, TODAY), theme: 2 };
  assert.equal(themed.theme, 2);

  const relapsed = setDayStatus(themed, TODAY, 'relapsed', TODAY);
  assert.equal(relapsed.theme, null);
});

test('losing earned days through a clear locks a wallpaper the streak no longer earns', () => {
  const themed = { ...setStreakDay(createInitialState(), 5, TODAY), theme: 3 };
  const shrunk = setDayStatus(themed, '2026-10-08', null, TODAY);

  assert.equal(calculateMetrics(shrunk, TODAY).unlocked, 0);
  assert.equal(shrunk.theme, null);
});

test('the challenge grid fills clean cells from the run start', () => {
  const state = setStreakDay(createInitialState(), 3, TODAY);
  const cells = challengeCells(state, TODAY);

  assert.equal(cells.length, 21);
  assert.deepEqual(cells.map((cell) => cell.status).slice(0, 4), ['clean', 'clean', 'today', 'pending']);
  assert.equal(cells[2].date, TODAY);
});

test('a relapse today shows the slip on the grid and resets the run', () => {
  const relapsed = logCheckIn(setStreakDay(createInitialState(), 5, TODAY), 'relapsed', TODAY);
  const cells = challengeCells(relapsed, TODAY);

  assert.equal(cells[0].status, 'relapsed');
  assert.equal(cells[1].status, 'pending');
});

test('21 clean days mark the challenge complete', () => {
  const start = addDays(TODAY, -20);
  const state = logCheckIn(setStreakStart(createInitialState(), start, TODAY), 'clean', TODAY);
  const cells = challengeCells(state, TODAY);

  assert.equal(calculateMetrics(state, TODAY).completedDays, 21);
  assert.ok(cells.every((cell) => cell.status === 'clean'));
});
