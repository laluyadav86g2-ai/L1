export const MAX_MANUAL_DAYS = 21;
export const MAX_WALLPAPERS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(iso, count) {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() + count);
  return localDateISO(date);
}

export function daysBetween(startISO, endISO) {
  const [startYear, startMonth, startDay] = startISO.split('-').map(Number);
  const [endYear, endMonth, endDay] = endISO.split('-').map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((end - start) / DAY_MS);
}

export function createInitialState() {
  return { startDate: null, entries: {} };
}

export function sanitizeState(value) {
  if (!value || typeof value !== 'object') return createInitialState();
  const entries = {};
  if (value.entries && typeof value.entries === 'object') {
    for (const [date, status] of Object.entries(value.entries)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && (status === 'clean' || status === 'relapsed')) {
        entries[date] = status;
      }
    }
  }
  const startDate = typeof value.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.startDate)
    ? value.startDate
    : null;
  return { startDate, entries };
}

export function calculateMetrics(state, today = localDateISO()) {
  const entries = state?.entries ?? {};
  const todayStatus = entries[today] ?? null;

  if (todayStatus === 'relapsed') {
    return { day: 0, completedDays: 0, unlocked: 0, todayStatus, startDate: null };
  }

  let startDate = state?.startDate ?? null;
  if (!startDate) {
    // A legacy/manual set of clean entries can still be recovered as a run.
    let cursor = todayStatus === 'clean' ? today : addDays(today, -1);
    if (entries[cursor] !== 'clean') {
      return { day: 0, completedDays: 0, unlocked: 0, todayStatus, startDate: null };
    }
    while (entries[addDays(cursor, -1)] === 'clean') cursor = addDays(cursor, -1);
    startDate = cursor;
  }

  const elapsed = daysBetween(startDate, today);
  if (elapsed < 0) {
    return { day: 0, completedDays: 0, unlocked: 0, todayStatus, startDate: null };
  }

  const day = elapsed + 1;
  const completedDays = todayStatus === 'clean' ? day : Math.max(0, day - 1);
  return {
    day,
    completedDays,
    unlocked: Math.min(MAX_WALLPAPERS, completedDays),
    todayStatus,
    startDate,
  };
}

export function logCheckIn(state, status, today = localDateISO()) {
  if (status !== 'clean' && status !== 'relapsed') {
    throw new TypeError('Check-in status must be clean or relapsed.');
  }

  const next = {
    startDate: state?.startDate ?? null,
    entries: { ...(state?.entries ?? {}) },
  };
  const previousStatus = next.entries[today] ?? null;
  next.entries[today] = status;

  if (status === 'relapsed') {
    // Keep the calendar history, but a relapse starts a new run later.
    next.startDate = null;
  } else if (previousStatus === 'relapsed') {
    // Correcting a same-day relapse starts again today, not before it.
    next.startDate = today;
  } else if (!next.startDate) {
    let cursor = today;
    while (next.entries[addDays(cursor, -1)] === 'clean') cursor = addDays(cursor, -1);
    next.startDate = cursor;
  }

  return next;
}

export function setStreakStart(state, startDate, today = localDateISO()) {
  const age = daysBetween(startDate, today);
  if (age < 0 || age >= MAX_MANUAL_DAYS) {
    throw new RangeError('Choose a start date within the last 21 days, including today.');
  }
  if (state?.entries?.[today] === 'relapsed') {
    throw new Error('A relapse is already logged for today. Start a new streak tomorrow.');
  }

  const next = {
    startDate,
    entries: { ...(state?.entries ?? {}) },
  };
  for (let offset = 0; offset < age; offset += 1) {
    next.entries[addDays(startDate, offset)] = 'clean';
  }
  return next;
}

export function setStreakDay(state, day, today = localDateISO()) {
  const dayNumber = Number(day);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > MAX_MANUAL_DAYS) {
    throw new RangeError('Choose a day between 1 and 21.');
  }
  return setStreakStart(state, addDays(today, 1 - dayNumber), today);
}
