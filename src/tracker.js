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
  return { startDate: null, entries: {}, theme: null };
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
  const theme = Number.isInteger(value.theme) && value.theme >= 0 && value.theme < MAX_WALLPAPERS
    ? value.theme
    : null;
  return { startDate, entries, theme };
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

function recoverRunStart(entries, today) {
  // A run is the unbroken stretch of clean days ending today (or yesterday if today is open).
  let cursor = entries[today] === 'clean' ? today : addDays(today, -1);
  if (entries[cursor] !== 'clean') return null;
  while (entries[addDays(cursor, -1)] === 'clean') cursor = addDays(cursor, -1);
  return cursor;
}

function retainTheme(next, today) {
  // A wallpaper only stays applied while the streak still earns it.
  if (next.theme != null && next.theme >= calculateMetrics(next, today).unlocked) {
    next.theme = null;
  }
}

export function logCheckIn(state, status, today = localDateISO()) {
  if (status !== 'clean' && status !== 'relapsed') {
    throw new TypeError('Check-in status must be clean or relapsed.');
  }

  const next = {
    startDate: state?.startDate ?? null,
    entries: { ...(state?.entries ?? {}) },
    theme: state?.theme ?? null,
  };
  const previousStatus = next.entries[today] ?? null;
  next.entries[today] = status;

  if (status === 'relapsed') {
    // Keep the calendar history, but a relapse starts a new run later and locks the wallpapers.
    next.startDate = null;
    next.theme = null;
  } else if (previousStatus === 'relapsed') {
    // Correcting a same-day relapse starts again today, not before it.
    next.startDate = today;
    retainTheme(next, today);
  } else if (!next.startDate) {
    next.startDate = recoverRunStart(next.entries, today);
    retainTheme(next, today);
  } else {
    retainTheme(next, today);
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
    theme: state?.theme ?? null,
  };
  for (let offset = 0; offset < age; offset += 1) {
    next.entries[addDays(startDate, offset)] = 'clean';
  }
  retainTheme(next, today);
  return next;
}

export function setStreakDay(state, day, today = localDateISO()) {
  const dayNumber = Number(day);
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > MAX_MANUAL_DAYS) {
    throw new RangeError('Choose a day between 1 and 21.');
  }
  return setStreakStart(state, addDays(today, 1 - dayNumber), today);
}

export function setDayStatus(state, date, status, today = localDateISO()) {
  if (status !== 'clean' && status !== 'relapsed' && status !== null) {
    throw new TypeError('Check-in status must be clean, relapsed, or null.');
  }
  if (daysBetween(date, today) < 0) {
    throw new RangeError('You cannot mark days in the future.');
  }

  const next = {
    startDate: state?.startDate ?? null,
    entries: { ...(state?.entries ?? {}) },
    theme: state?.theme ?? null,
  };
  const previousStatus = next.entries[date] ?? null;
  if (status === null) {
    delete next.entries[date];
  } else {
    next.entries[date] = status;
  }

  if (next.entries[today] === 'relapsed') {
    // A relapse logged today ends the run; edits stay on the calendar as history.
    next.startDate = null;
    next.theme = null;
    return next;
  }

  if (date === today && previousStatus === 'relapsed' && status === 'clean') {
    // Correcting a same-day relapse starts again today, not before it.
    next.startDate = today;
    retainTheme(next, today);
    return next;
  }

  const runStart = next.startDate;
  const insideRun = Boolean(runStart) && daysBetween(runStart, date) >= 0;

  if (status === 'relapsed') {
    if (insideRun) {
      // The unbroken clean stretch after the relapse becomes the new run.
      next.startDate = recoverRunStart(next.entries, today);
    }
    next.theme = null;
    return next;
  }

  if (runStart && daysBetween(runStart, date) < 0) {
    // A clean mark just before the run can extend it backward.
    let cursor = runStart;
    while (next.entries[addDays(cursor, -1)] === 'clean') cursor = addDays(cursor, -1);
    next.startDate = cursor;
    retainTheme(next, today);
  } else if (insideRun || !runStart) {
    next.startDate = recoverRunStart(next.entries, today);
    retainTheme(next, today);
  }

  return next;
}

export function challengeCells(state, today = localDateISO()) {
  const metrics = calculateMetrics(state, today);
  const runStart = metrics.startDate;
  return Array.from({ length: MAX_MANUAL_DAYS }, (_, index) => {
    const day = index + 1;
    if (!runStart) {
      // With no run, a slip today shows honestly on day one of the next attempt.
      return {
        day,
        date: null,
        status: day === 1 && metrics.todayStatus === 'relapsed' ? 'relapsed' : 'pending',
      };
    }
    const date = addDays(runStart, index);
    if (daysBetween(date, today) < 0) return { day, date, status: 'pending' };
    const mark = state?.entries?.[date] ?? null;
    if (date === today && mark === null) return { day, date, status: 'today' };
    return {
      day,
      date,
      status: mark === 'clean' ? 'clean' : mark === 'relapsed' ? 'relapsed' : 'pending',
    };
  });
}
