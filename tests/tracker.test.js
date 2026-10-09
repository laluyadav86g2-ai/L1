import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  calculateMetrics,
  createInitialState,
  logCheckIn,
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
