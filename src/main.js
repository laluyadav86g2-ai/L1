import './styles.css';
import {
  addDays,
  calculateMetrics,
  challengeCells,
  createInitialState,
  localDateISO,
  logCheckIn,
  MAX_MANUAL_DAYS,
  MAX_WALLPAPERS,
  sanitizeState,
  setDayStatus,
  setStreakDay,
  setStreakStart,
} from './tracker.js';
import { WALLPAPERS, wallpaperDataUrl, wallpaperSvg } from './wallpapers.js';

const STORAGE_KEY = 'daymark-21-reset-v1';
const MAX_WALLPAPER_DAYS = 20;
const root = document.querySelector('#app');
let state = loadState();
let activeTab = 'home';
let calendarCursor = new Date();
let manualMode = 'start';
let modal = null;
let toastTimer = null;
let toastMessage = '';

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? sanitizeState(JSON.parse(saved)) : createInitialState();
  } catch {
    return createInitialState();
  }
}

function saveState(next) {
  state = sanitizeState(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The app remains usable if storage is unavailable in a private browser context.
  }
  render();
}

function icon(name, size = 20, extraClass = '') {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1.4a2.1 2.1 0 0 0 1.5-3.6 1.9 1.9 0 0 1 1.4-3.2H18a3 3 0 0 0 3-3c0-4.5-4-8.2-9-8.2Z"/><path d="M7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01M17 11h.01"/>',
    arrowLeft: '<path d="m15 18-6-6 6-6"/>',
    arrowRight: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    share: '<path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    download: '<path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M5 17v3h14v-3"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    sparkles: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16ZM5 2l.7 2.3L8 5l-2.3.7L5 8l-.7-2.3L2 5l2.3-.7L5 2Z"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    heart: '<path d="M20.8 8.8c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.8 2.5Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  };
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
}

function safeText(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function dateObject(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDate(iso, options = { weekday: 'long', month: 'long', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(dateObject(iso));
}

function formatTodayHeading(iso) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(dateObject(iso));
}

function statusLabel(status) {
  if (status === 'clean') return 'Clean today';
  if (status === 'relapsed') return 'Relapse logged';
  return 'Check-in open';
}

function navItem(tab, label, iconName) {
  const selected = activeTab === tab;
  return `<button class="nav-item${selected ? ' is-active' : ''}" type="button" data-tab="${tab}" ${selected ? 'aria-current="page"' : ''}>
    ${icon(iconName, 19)}<span>${label}</span>${selected ? '<span class="nav-active-dot"></span>' : ''}
  </button>`;
}

function appliedTheme(metrics) {
  // A wallpaper only shows while the current streak still unlocks it.
  return state.theme != null && state.theme < metrics.unlocked ? state.theme : null;
}

function progressMarkup(percent, extraClass = '') {
  return `<div class="progress-track ${extraClass}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percent)}"><span style="width:${percent}%"></span></div>`;
}

function renderShell(metrics, today) {
  const themeIndex = appliedTheme(metrics);
  return `<div class="app-shell">
    ${themeIndex != null ? `<div class="theme-backdrop" aria-hidden="true"><img src="${wallpaperDataUrl(themeIndex)}" alt=""/></div>` : ''}
    <aside class="sidebar">
      <button class="brand" type="button" data-tab="home" aria-label="Daymark home">
        <span class="brand-mark"><span></span><i></i></span>
        <span class="brand-type"><strong>DAYMARK</strong><small>21-DAY RESET</small></span>
      </button>
      <div class="sidebar-section-label">YOUR SPACE</div>
      <nav class="desktop-nav" aria-label="Main navigation">
        ${navItem('home', 'Home', 'home')}
        ${navItem('calendar', 'Calendar', 'calendar')}
        ${navItem('themes', 'Themes', 'palette')}
      </nav>
      <div class="sidebar-progress">
        <div class="sidebar-progress__top"><span>THIS RESET</span><span>${Math.min(metrics.day, 21)} / 21</span></div>
        <div class="mini-ring" style="--ring-progress:${Math.min(100, (metrics.day / 21) * 100)}%"><div><strong>${metrics.day || '—'}</strong><small>DAY</small></div></div>
        <p>${metrics.day ? 'Every honest day is progress.' : 'A fresh page is always here.'}</p>
      </div>
      <div class="sidebar-bottom">
        <span class="privacy-mark">${icon('shield', 17)}</span>
        <span><strong>Just for you</strong><small>Your progress stays on this device.</small></span>
      </div>
      <div class="sidebar-version">DAYMARK <span>·</span> ONE DAY AT A TIME</div>
    </aside>

    <div class="workspace">
      <header class="mobile-header">
        <button class="brand brand--compact" type="button" data-tab="home" aria-label="Daymark home">
          <span class="brand-mark"><span></span><i></i></span>
          <span class="brand-type"><strong>DAYMARK</strong><small>21-DAY RESET</small></span>
        </button>
        <span class="mobile-day-pill">${icon('sun', 15)} ${formatDate(today, { month: 'short', day: 'numeric' })}</span>
      </header>
      <main class="page-container">
        ${activeTab === 'home' ? renderHome(metrics, today) : ''}
        ${activeTab === 'calendar' ? renderCalendar(today) : ''}
        ${activeTab === 'themes' ? renderThemes(metrics) : ''}
      </main>
    </div>

    <nav class="mobile-nav" aria-label="Main navigation">
      ${navItem('home', 'Home', 'home')}
      ${navItem('calendar', 'Calendar', 'calendar')}
      ${navItem('themes', 'Themes', 'palette')}
    </nav>
    ${modal ? renderModal(metrics, today) : ''}
    <div class="toast${toastMessage ? ' is-visible' : ''}" id="toast" role="status" aria-live="polite">${safeText(toastMessage)}</div>
  </div>`;
}

function renderHome(metrics, today) {
  const day = metrics.day;
  const percent = Math.min(100, (day / 21) * 100);
  const nextIndex = Math.min(metrics.unlocked, MAX_WALLPAPER_DAYS - 1);
  const allUnlocked = metrics.unlocked >= MAX_WALLPAPER_DAYS;
  const todayStatus = metrics.todayStatus;
  const statusClass = todayStatus === 'clean' ? 'status-clean' : todayStatus === 'relapsed' ? 'status-relapsed' : 'status-open';
  const cleanSelected = todayStatus === 'clean';
  const relapseSelected = todayStatus === 'relapsed';
  const helperCopy = todayStatus === 'clean'
    ? 'Today is in the books. Keep going at your own pace.'
    : todayStatus === 'relapsed'
      ? 'Your calendar keeps the truth, not a judgment. The next clean day can be day one.'
      : 'There is no perfect version of this. Just an honest check-in.';
  const challengeDone = metrics.completedDays >= MAX_MANUAL_DAYS;
  const streakCopy = challengeDone
    ? '21 days of showing up. The challenge is complete—keep going at your pace.'
    : day === 0
      ? 'A fresh start can begin with one honest choice.'
      : day === 1
        ? 'Day one. That is a real beginning.'
        : 'You have kept showing up. Let today be another step.';
  const challengeNote = challengeDone
    ? 'All 21 days are marked clean. The challenge is complete—keep going at your pace.'
    : todayStatus === 'relapsed'
      ? 'Today is recorded honestly. The next clean day can be day one.'
      : day === 0
        ? 'Each clean day fills a cell. Your first check-in starts the grid.'
        : `${Math.max(1, MAX_MANUAL_DAYS - metrics.completedDays)} ${MAX_MANUAL_DAYS - metrics.completedDays === 1 ? 'clean day' : 'clean days'} to complete the challenge. Green cells are days you have finished.`;
  const unlockCopy = allUnlocked
    ? 'All 20 wallpapers are yours. Keep your streak going.'
    : metrics.unlocked > 0
      ? `Day ${metrics.unlocked + 1} unlocks “${WALLPAPERS[nextIndex].name}”.`
      : 'Complete your first clean day to unlock a wallpaper.';

  return `<div class="page-view page-view--home">
    <section class="page-intro home-intro">
      <div>
        <div class="eyebrow">${safeText(formatTodayHeading(today)).toUpperCase()}</div>
        <h1>One day at a time.</h1>
        <p>A quiet place to notice your progress and keep moving forward.</p>
      </div>
      <div class="private-chip"><span class="live-dot"></span> PRIVATE BY DESIGN</div>
    </section>

    <section class="streak-card" aria-label="Current streak: ${day} days">
      <div class="streak-glow streak-glow--one"></div><div class="streak-glow streak-glow--two"></div>
      <div class="streak-card__main">
        <div class="streak-copy">
          <div class="streak-label-row"><span class="eyebrow">CURRENT STREAK</span><span class="today-status ${statusClass}"><span></span>${statusLabel(todayStatus)}</span></div>
          <div class="streak-count"><strong>${day}</strong><span>${day === 1 ? 'day' : 'days'}</span></div>
          <p>${streakCopy}</p>
        </div>
        <div class="streak-orbit" style="--ring-progress:${percent}%" aria-hidden="true">
          <div class="streak-orbit__inner"><span>DAY</span><strong>${day ? Math.min(day, 21) : '—'}</strong><small>OF 21</small></div>
          <i class="orbit-spark"></i>
        </div>
      </div>
      <div class="streak-card__footer">
        <div class="progress-copy"><span>21-day reset</span><span>${Math.min(day, 21)} <i>/ 21</i></span></div>
        ${progressMarkup(percent, 'streak-progress-bar')}
        <div class="unlock-note">${icon('sparkles', 15)}<span>${safeText(unlockCopy)}</span></div>
      </div>
    </section>

    <section class="surface challenge-panel" aria-label="21-day challenge">
      <div class="section-topline">
        <div><span class="eyebrow">THE 21-DAY CHALLENGE</span><h2>${challengeDone ? 'Complete.' : 'Your 21 days.'}</h2></div>
        <span class="challenge-chip${challengeDone ? ' is-complete' : ''}">${challengeDone ? icon('check', 12) : ''}${challengeDone ? 'CHALLENGE COMPLETE' : `${Math.min(metrics.completedDays, 21)} / 21 CLEAN`}</span>
      </div>
      <div class="challenge-grid" role="list">
        ${challengeCells(state, today).map((cell) => {
          const cellLabel = cell.status === 'clean' ? 'clean' : cell.status === 'relapsed' ? 'relapsed' : cell.status === 'today' ? 'check-in open' : 'ahead';
          const cellDate = cell.date ? ` · ${safeText(formatDate(cell.date, { month: 'short', day: 'numeric' }))}` : '';
          return `<div class="challenge-cell is-${cell.status}" role="listitem" title="Day ${cell.day}${cellDate} · ${cellLabel}" aria-label="Day ${cell.day}: ${cellLabel}"><span>${cell.day}</span></div>`;
        }).join('')}
      </div>
      <p class="challenge-note">${icon(challengeDone ? 'sparkles' : todayStatus === 'relapsed' ? 'heart' : 'shield', 14)}<span>${safeText(challengeNote)}</span></p>
    </section>

    <div class="home-grid">
      <section class="surface checkin-panel">
        <div class="section-topline"><div><span class="eyebrow">DAILY CHECK-IN</span><h2>How was today?</h2></div><span class="checkin-date">${safeText(formatDate(today, { month: 'short', day: 'numeric' }))}</span></div>
        <p class="panel-description">Choose the one that feels true. No judgment, just a clear record.</p>
        <div class="checkin-options">
          <button class="check-option check-option--clean${cleanSelected ? ' is-selected' : ''}" type="button" data-action="check-clean" aria-pressed="${cleanSelected}">
            <span class="check-option__icon">${icon('check', 20)}</span><span class="check-option__copy"><strong>${cleanSelected ? 'Marked clean' : 'Clean'}</strong><small>I stayed off porn and fap</small></span>${cleanSelected ? '<span class="option-check">' + icon('check', 16) + '</span>' : ''}
          </button>
          <button class="check-option check-option--relapse${relapseSelected ? ' is-selected' : ''}" type="button" data-action="check-relapsed" aria-pressed="${relapseSelected}">
            <span class="check-option__icon">${icon('heart', 20)}</span><span class="check-option__copy"><strong>${relapseSelected ? 'Relapse logged' : 'Relapsed'}</strong><small>Log it honestly, without shame</small></span>${relapseSelected ? '<span class="option-check">' + icon('check', 16) + '</span>' : ''}
          </button>
        </div>
        <div class="checkin-footnote ${todayStatus === 'relapsed' ? 'is-relapse' : ''}">${icon(todayStatus === 'clean' ? 'check' : todayStatus === 'relapsed' ? 'heart' : 'shield', 16)}<span>${safeText(helperCopy)}</span></div>
      </section>

      <section class="surface unlock-panel">
        <div class="section-topline"><div><span class="eyebrow">A LITTLE REWARD</span><h2>${allUnlocked ? 'You did it.' : 'Keep unlocking.'}</h2></div>${icon('sparkles', 19, 'accent-icon')}</div>
        <div class="unlock-preview" style="--wallpaper:url('${wallpaperDataUrl(nextIndex)}')">
          <img src="${wallpaperDataUrl(nextIndex)}" alt="Abstract wallpaper preview: ${safeText(WALLPAPERS[nextIndex].name)}" />
          <div class="unlock-preview__badge">${allUnlocked ? icon('check', 14) : icon('lock', 14)} ${allUnlocked ? 'ALL OPEN' : `DAY ${String(metrics.unlocked + 1).padStart(2, '0')}`}</div>
        </div>
        <p class="unlock-description">${safeText(unlockCopy)}</p>
        <button class="text-link" type="button" data-tab="themes">Explore all themes ${icon('arrowRight', 16)}</button>
      </section>
    </div>

    <section class="manual-entry surface">
      <div class="manual-mark">${icon('clock', 19)}</div>
      <div class="manual-copy"><h2>Already on a streak?</h2><p>Bring your last 21 days up to date—today stays open until your check-in.</p></div>
      <div class="manual-actions">
        <button type="button" class="button button--quiet" data-action="manual-start" ${todayStatus === 'relapsed' ? 'disabled title="Start a new streak tomorrow"' : ''}>I started on</button>
        <button type="button" class="button button--quiet" data-action="manual-day" ${todayStatus === 'relapsed' ? 'disabled title="Start a new streak tomorrow"' : ''}>I am on day</button>
      </div>
    </section>

    <section class="share-strip">
      <div class="share-strip__icon">${icon('share', 20)}</div>
      <div class="share-strip__copy"><strong>Mark the moment.</strong><span>Your share card keeps it simple—and keeps your name private.</span></div>
      <button type="button" class="button button--light" data-action="share-card">Create share card ${icon('arrowRight', 16)}</button>
    </section>

    <p class="privacy-note">${icon('shield', 14)} Stored only on this device. Nothing is sent to an account or server.</p>
  </div>`;
}

function renderCalendar(today) {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthISO = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthEntries = Object.entries(state.entries).filter(([date]) => date.startsWith(monthISO));
  const cleanCount = monthEntries.filter(([, status]) => status === 'clean').length;
  const relapseCount = monthEntries.filter(([, status]) => status === 'relapsed').length;
  const cells = [];
  for (let blank = 0; blank < firstWeekday; blank += 1) cells.push('<div class="calendar-cell is-empty" role="presentation"></div>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${monthISO}-${String(day).padStart(2, '0')}`;
    const status = state.entries[iso];
    const classes = ['calendar-cell'];
    if (status === 'clean') classes.push('is-clean');
    if (status === 'relapsed') classes.push('is-relapsed');
    if (iso === today) classes.push('is-today');
    const statusText = status === 'clean' ? 'clean' : status === 'relapsed' ? 'relapsed' : 'not marked';
    const inner = `<span>${day}</span>${status === 'clean' ? '<i class="clean-line"></i>' : status === 'relapsed' ? '<i class="relapse-ring"></i>' : ''}`;
    const label = `${safeText(formatDate(iso, { weekday: 'long', month: 'long', day: 'numeric' }))}: ${statusText}`;
    const title = `${safeText(formatDate(iso, { month: 'short', day: 'numeric' }))} · ${statusText}`;
    if (iso <= today) {
      cells.push(`<button type="button" class="${classes.join(' ')}" role="gridcell" data-day-edit="${iso}" aria-label="${label}, tap to change" title="${title}">${inner}</button>`);
    } else {
      cells.push(`<div class="${classes.join(' ')}" role="gridcell" aria-label="${label}" title="${title}">${inner}</div>`);
    }
  }
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
  const countPhrase = `${cleanCount} clean ${cleanCount === 1 ? 'day' : 'days'} · ${relapseCount} ${relapseCount === 1 ? 'relapse' : 'relapses'}`;

  return `<div class="page-view page-view--calendar">
    <section class="page-intro">
      <div><div class="eyebrow">LOOK BACK WITH KINDNESS</div><h1>Your calendar.</h1><p>Every mark is information, not a verdict.</p></div>
      <div class="calendar-summary-chip"><span class="calendar-summary-dot"></span>${safeText(countPhrase)}</div>
    </section>
    <section class="surface calendar-panel">
      <div class="calendar-toolbar"><div><span class="eyebrow">YOUR CHECK-INS</span><h2>${safeText(monthLabel)}</h2></div><div class="month-controls"><button type="button" aria-label="Previous month" data-calendar-nav="-1">${icon('arrowLeft', 19)}</button><button type="button" aria-label="Next month" data-calendar-nav="1">${icon('arrowRight', 19)}</button></div></div>
      <div class="calendar-grid" role="grid" aria-label="${safeText(monthLabel)}">
        ${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => `<div class="calendar-weekday" role="columnheader">${day}</div>`).join('')}
        ${cells.join('')}
      </div>
      <div class="calendar-legend"><span><i class="legend-clean"></i>Clean day</span><span><i class="legend-relapse"></i>Relapse logged</span><span><i class="legend-today"></i>Today</span></div>
    </section>
    <section class="calendar-reflection surface">
      <div class="reflection-icon">${icon('sun', 19)}</div>
      <div><strong>Progress is more than a perfect streak.</strong><p>Tap any past or current day to change its mark, clear it, or fill your streak from it. Clean days are underlined in green; relapse days are circled in red.</p></div>
    </section>
  </div>`;
}

function renderThemes(metrics) {
  const unlocked = metrics.unlocked;
  const applied = appliedTheme(metrics);
  return `<div class="page-view page-view--themes">
    <section class="page-intro themes-intro">
      <div><div class="eyebrow">A DAILY REMINDER OF YOUR PROGRESS</div><h1>Themes.</h1><p>One new wallpaper for every clean day you complete.</p></div>
      <div class="theme-count-card"><div><strong>${unlocked}</strong><span>/ 20</span></div><small>WALLPAPERS UNLOCKED</small>${progressMarkup((unlocked / MAX_WALLPAPER_DAYS) * 100, 'theme-count-progress')}</div>
    </section>
    <div class="theme-note">${icon('lock', 16)}<span>A relapse locks the collection again and returns you to the default dark screen. Your calendar history stays saved.</span></div>
    <section class="theme-grid" aria-label="20 daily wallpapers">
      ${WALLPAPERS.map((wallpaper, index) => {
        const locked = index >= unlocked;
        const day = index + 1;
        return `<button class="wallpaper-card${locked ? ' is-locked' : ''}${index === applied ? ' is-applied' : ''}" type="button" data-wallpaper="${index}" aria-label="${locked ? `Locked, complete day ${day} to unlock ${wallpaper.name}` : `Preview ${wallpaper.name} wallpaper`}" aria-disabled="${locked}">
          <span class="wallpaper-art"><img src="${wallpaperDataUrl(index)}" alt="" loading="lazy"/><span class="wallpaper-day">DAY ${String(day).padStart(2, '0')}</span>${index === applied ? '<span class="wallpaper-inuse">IN USE</span>' : ''}${locked ? `<span class="wallpaper-lock">${icon('lock', 19)}<small>LOCKED</small></span>` : '<span class="wallpaper-open">' + icon('arrowRight', 17) + '</span>'}</span>
          <span class="wallpaper-meta"><span><strong>${safeText(wallpaper.name)}</strong><small>${locked ? `Complete day ${day}` : index === applied ? 'Your background' : 'Unlocked · tap to use'}</small></span><span class="wallpaper-meta-icon">${locked ? icon('lock', 15) : icon('download', 15)}</span></span>
        </button>`;
      }).join('')}
    </section>
    <p class="themes-footnote">Wallpapers are generated on your device. Tap an unlocked one to set it as your background, or download it as a PNG for your phone’s gallery.</p>
  </div>`;
}

function renderModal(metrics, today) {
  if (modal.type === 'confirm-relapse') {
    return `<div class="modal-backdrop" data-backdrop="true"><section class="modal-panel modal-panel--compact" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" type="button" data-action="close-modal" aria-label="Close">${icon('close', 19)}</button>
      <div class="modal-symbol modal-symbol--rose">${icon('heart', 22)}</div><div class="eyebrow">HONEST CHECK-IN</div><h2 id="modal-title">Log today as a relapse?</h2><p>This records today honestly and locks the wallpapers again. Your past calendar stays saved. No judgment, and no start-over button—when you’re ready, tomorrow can be day one.</p>
      <div class="modal-actions"><button type="button" class="button button--quiet" data-action="close-modal">Keep today open</button><button type="button" class="button button--danger" data-action="confirm-relapse">Log relapse</button></div>
    </section></div>`;
  }
  if (modal.type === 'confirm-clean') {
    return `<div class="modal-backdrop" data-backdrop="true"><section class="modal-panel modal-panel--compact" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" type="button" data-action="close-modal" aria-label="Close">${icon('close', 19)}</button>
      <div class="modal-symbol">${icon('check', 22)}</div><div class="eyebrow">UPDATE TODAY</div><h2 id="modal-title">Mark today as clean?</h2><p>This changes today’s check-in to clean. Since a relapse was logged today, your new streak will begin with today.</p>
      <div class="modal-actions"><button type="button" class="button button--quiet" data-action="close-modal">Go back</button><button type="button" class="button button--primary" data-action="confirm-clean">Mark clean</button></div>
    </section></div>`;
  }
  if (modal.type === 'manual') {
    const minDate = addDays(today, -20);
    const currentDay = Math.min(21, Math.max(1, metrics.day || 1));
    const manualIntro = 'Choose a starting point in the last 21 days. Past days will be marked clean; today stays in progress until you check in.';
    return `<div class="modal-backdrop" data-backdrop="true"><section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" type="button" data-action="close-modal" aria-label="Close">${icon('close', 19)}</button>
      <div class="modal-symbol">${icon('clock', 22)}</div><div class="eyebrow">BACKFILL YOUR STREAK</div><h2 id="modal-title">Where are you today?</h2><p>${manualIntro}</p>
      <div class="manual-tabs" role="tablist"><button type="button" role="tab" aria-selected="${manualMode === 'start'}" class="${manualMode === 'start' ? 'is-active' : ''}" data-manual-mode="start">I started on</button><button type="button" role="tab" aria-selected="${manualMode === 'day'}" class="${manualMode === 'day' ? 'is-active' : ''}" data-manual-mode="day">I am on day</button></div>
      ${manualMode === 'start' ? `<div class="manual-field"><label for="manual-date">I started on</label><input id="manual-date" type="date" min="${minDate}" max="${today}" value="${today}"/><small>Pick any date from ${safeText(formatDate(minDate, { month: 'short', day: 'numeric' }))} through today.</small></div><div class="modal-actions modal-actions--end"><button type="button" class="button button--primary" data-action="save-start">Set my start date ${icon('arrowRight', 17)}</button></div>` : `<div class="manual-field"><label for="manual-day">I am on day</label><select id="manual-day">${Array.from({ length: 21 }, (_, index) => `<option value="${index + 1}" ${currentDay === index + 1 ? 'selected' : ''}>Day ${index + 1}${index === 0 ? ' — today' : ''}</option>`).join('')}</select><small>Day 1 is today; day 21 reaches back 20 days.</small></div><div class="modal-actions modal-actions--end"><button type="button" class="button button--primary" data-action="save-day">Set my day ${icon('arrowRight', 17)}</button></div>`}
      <div class="modal-privacy">${icon('shield', 15)} This only updates this device’s calendar.</div>
    </section></div>`;
  }
  if (modal.type === 'share') {
    const shareDescription = metrics.day === 1 ? '1 day of showing up' : `${metrics.day} days of showing up`;
    return `<div class="modal-backdrop" data-backdrop="true"><section class="modal-panel modal-panel--share" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" type="button" data-action="close-modal" aria-label="Close">${icon('close', 19)}</button>
      <div class="eyebrow">YOUR SHARE CARD</div><h2 id="modal-title">A little progress, shared.</h2><p>${safeText(shareDescription)}. Your name and calendar are never included.</p>
      <div class="share-card-preview"><img src="${modal.image}" alt="Daymark share card showing ${metrics.day} days of progress"/></div>
      <div class="modal-actions"><button type="button" class="button button--quiet" data-action="download-share">${icon('download', 17)} Save image</button><button type="button" class="button button--primary" data-action="share-share">${icon('share', 17)} Share card</button></div>
    </section></div>`;
  }
  if (modal.type === 'day-edit') {
    const date = modal.date;
    const isToday = date === today;
    const mark = state.entries[date] ?? null;
    const markLabel = mark === 'clean' ? 'Marked clean' : mark === 'relapsed' ? 'Relapse logged' : 'Not marked yet';
    return `<div class="modal-backdrop" data-backdrop="true"><section class="modal-panel modal-panel--compact" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" type="button" data-action="close-modal" aria-label="Close">${icon('close', 19)}</button>
      <div class="modal-symbol${mark === 'relapsed' ? ' modal-symbol--rose' : ''}">${icon(mark === 'relapsed' ? 'heart' : 'calendar', 22)}</div>
      <div class="eyebrow">${isToday ? 'TODAY’S CHECK-IN' : 'UPDATE A PAST DAY'}</div>
      <h2 id="modal-title">${safeText(formatDate(date))}</h2>
      <p>Currently: ${markLabel}. Your marks are an honest record—change this day whenever you need to.</p>
      <div class="modal-actions modal-actions--stack">
        ${mark !== 'clean' ? `<button type="button" class="button button--primary" data-action="day-clean">${icon('check', 16)} Mark clean</button>` : ''}
        ${mark !== 'relapsed' ? `<button type="button" class="button button--danger" data-action="day-relapse">${icon('heart', 16)} Log relapse</button>` : ''}
        ${!isToday && mark === null ? `<button type="button" class="button button--quiet" data-action="day-fill">${icon('clock', 16)} Fill streak from this day</button>` : ''}
        ${mark !== null ? `<button type="button" class="button button--quiet" data-action="day-clear">${icon('close', 16)} Clear this mark</button>` : ''}
      </div>
      ${!isToday && mark === null ? '<p class="day-edit-hint">“Fill streak from this day” marks the days from here to yesterday as clean, and leaves today open until your check-in.</p>' : ''}
      ${mark === 'relapsed' ? '<p class="day-edit-hint">Clearing a relapse leaves the day unmarked. Change it to clean if the day was actually clean.</p>' : ''}
      <div class="modal-privacy">${icon('shield', 15)} This only updates this device’s calendar.</div>
    </section></div>`;
  }
  if (modal.type === 'wallpaper') {
    const wallpaper = WALLPAPERS[modal.index];
    const data = wallpaperDataUrl(modal.index, 720, 1280);
    const isActive = appliedTheme(metrics) === modal.index;
    return `<div class="modal-backdrop" data-backdrop="true"><section class="modal-panel modal-panel--wallpaper" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close" type="button" data-action="close-modal" aria-label="Close">${icon('close', 19)}</button>
      <div class="wallpaper-modal-preview"><img src="${data}" alt="${safeText(wallpaper.name)} abstract phone wallpaper"/></div>
      <div class="wallpaper-modal-copy"><div class="eyebrow">DAY ${String(modal.index + 1).padStart(2, '0')} · UNLOCKED</div><h2 id="modal-title">${safeText(wallpaper.name)}</h2><p>${isActive ? 'This wallpaper is your current background.' : 'A small reminder of the progress you’ve made.'}</p></div>
      <div class="modal-actions">
        <button type="button" class="button button--quiet" data-action="close-modal">Close</button>
        ${isActive
          ? `<button type="button" class="button button--quiet" data-action="remove-theme">${icon('sun', 17)} Remove background</button>`
          : `<button type="button" class="button button--primary" data-action="set-theme" data-wallpaper-index="${modal.index}">${icon('sun', 17)} Set as background</button>`}
        <button type="button" class="button button--quiet" data-action="download-wallpaper" data-wallpaper-index="${modal.index}">${icon('download', 17)} Download wallpaper</button>
      </div>
    </section></div>`;
  }
  return '';
}

function render() {
  const today = localDateISO();
  const metrics = calculateMetrics(state, today);
  root.innerHTML = renderShell(metrics, today);
}

function showToast(message) {
  toastMessage = message;
  const toast = document.querySelector('#toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('is-visible');
  }
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMessage = '';
    document.querySelector('#toast')?.classList.remove('is-visible');
  }, 3300);
}

function closeModal() {
  modal = null;
  render();
}

function openManual(mode) {
  if (state.entries[localDateISO()] === 'relapsed') {
    showToast('You can mark a new streak tomorrow.');
    return;
  }
  manualMode = mode;
  modal = { type: 'manual' };
  render();
}

function recordClean() {
  const today = localDateISO();
  const next = logCheckIn(state, 'clean', today);
  modal = null;
  saveState(next);
  showToast('Today marked clean. Keep going at your pace.');
}

function recordRelapse() {
  const next = logCheckIn(state, 'relapsed', localDateISO());
  modal = null;
  saveState(next);
  showToast('Check-in saved. Your past calendar is still here.');
}

function applyDayEdit(date, status) {
  try {
    const next = setDayStatus(state, date, status, localDateISO());
    modal = null;
    saveState(next);
    const label = formatDate(date, { month: 'short', day: 'numeric' });
    if (status === 'clean') {
      showToast(`${label} marked clean.`);
    } else if (status === 'relapsed') {
      showToast(`Relapse logged for ${label}. Your past calendar is still here.`);
    } else {
      showToast(`Mark cleared for ${label}.`);
    }
  } catch (error) {
    showToast(error.message || 'Could not update that day.');
  }
}

function createShareCard(day) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  const background = context.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, '#122720');
  background.addColorStop(0.52, '#15201d');
  background.addColorStop(1, '#0a1111');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(850, 180, 8, 850, 180, 640);
  glow.addColorStop(0, 'rgba(183, 241, 123, .19)');
  glow.addColorStop(1, 'rgba(183, 241, 123, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = 'rgba(202, 240, 180, .12)';
  context.lineWidth = 2;
  for (const radius of [235, 318, 405]) {
    context.beginPath();
    context.arc(850, 180, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.beginPath();
  context.roundRect(48, 48, 984, 1254, 48);
  context.strokeStyle = 'rgba(220, 239, 221, .11)';
  context.stroke();

  context.fillStyle = '#b7f17b';
  context.beginPath();
  context.arc(116, 142, 22, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#eaf2e8';
  context.font = '700 32px system-ui, -apple-system, sans-serif';
  context.letterSpacing = '5px';
  context.fillText('DAYMARK', 158, 153);
  context.fillStyle = 'rgba(231, 241, 230, .54)';
  context.font = '600 20px system-ui, -apple-system, sans-serif';
  context.fillText('21-DAY RESET', 160, 185);

  context.fillStyle = '#e9f2e8';
  context.font = '500 28px system-ui, -apple-system, sans-serif';
  context.fillText(day ? 'I’M SHOWING UP' : 'MY RESET STARTS HERE', 96, 418);
  context.fillStyle = '#b7f17b';
  context.font = '700 272px system-ui, -apple-system, sans-serif';
  context.letterSpacing = '-12px';
  context.fillText(String(day), 80, 700);
  const numberWidth = context.measureText(String(day)).width;
  context.fillStyle = '#e9f2e8';
  context.font = '500 56px system-ui, -apple-system, sans-serif';
  context.letterSpacing = '0px';
  context.fillText(day === 1 ? 'day' : 'days', 96 + numberWidth + 24, 682);

  context.fillStyle = 'rgba(231, 241, 230, .73)';
  context.font = '400 32px system-ui, -apple-system, sans-serif';
  context.fillText('A little better, one day at a time.', 100, 810);

  context.fillStyle = 'rgba(231, 241, 230, .58)';
  context.font = '600 19px system-ui, -apple-system, sans-serif';
  context.letterSpacing = '3px';
  context.fillText('TODAY COUNTS. KEEP GOING.', 100, 1185);
  context.letterSpacing = '0px';
  context.fillStyle = 'rgba(231, 241, 230, .34)';
  context.font = '400 18px system-ui, -apple-system, sans-serif';
  context.fillText('Your pace. Your progress.', 100, 1225);
  return canvas.toDataURL('image/png');
}

function triggerDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}

async function svgToPng(svg, width = 1080, height = 1920) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function downloadWallpaper(index) {
  try {
    const data = await svgToPng(wallpaperSvg(index, 1080, 1920));
    triggerDownload(data, `daymark-${String(index + 1).padStart(2, '0')}-${WALLPAPERS[index].name.toLowerCase().replaceAll(' ', '-')}.png`);
    showToast('Wallpaper saved. Choose it from your gallery.');
  } catch {
    showToast('Could not save the wallpaper here. Try opening it in a browser.');
  }
}

async function shareCurrentCard() {
  if (!modal?.image) return;
  const image = modal.image;
  const currentDay = calculateMetrics(state).day;
  const text = `A little progress, one day at a time. ${currentDay} ${currentDay === 1 ? 'day' : 'days'} of showing up.`;
  try {
    const response = await fetch(image);
    const blob = await response.blob();
    const file = new File([blob], 'daymark-share-card.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'My Daymark progress', text });
    } else if (navigator.share) {
      await navigator.share({ title: 'My Daymark progress', text });
      triggerDownload(image, 'daymark-share-card.png');
    } else {
      triggerDownload(image, 'daymark-share-card.png');
      showToast('Share card saved. You can post it from your gallery.');
      return;
    }
    showToast('Your share card is ready.');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    triggerDownload(image, 'daymark-share-card.png');
    showToast('Share card saved. You can post it from your gallery.');
  }
}

function handleClick(event) {
  const tabButton = event.target.closest('[data-tab]');
  if (tabButton) {
    activeTab = tabButton.dataset.tab;
    modal = null;
    render();
    return;
  }

  const calendarButton = event.target.closest('[data-calendar-nav]');
  if (calendarButton) {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + Number(calendarButton.dataset.calendarNav), 1);
    render();
    return;
  }

  const modeButton = event.target.closest('[data-manual-mode]');
  if (modeButton) {
    manualMode = modeButton.dataset.manualMode;
    render();
    return;
  }

  const wallpaperButton = event.target.closest('[data-wallpaper]');
  if (wallpaperButton) {
    const index = Number(wallpaperButton.dataset.wallpaper);
    const metrics = calculateMetrics(state);
    if (index >= metrics.unlocked) {
      showToast(`Complete day ${index + 1} to unlock “${WALLPAPERS[index].name}”.`);
      return;
    }
    modal = { type: 'wallpaper', index };
    render();
    return;
  }

  const dayEditButton = event.target.closest('[data-day-edit]');
  if (dayEditButton) {
    modal = { type: 'day-edit', date: dayEditButton.dataset.dayEdit };
    render();
    return;
  }

  if (event.target.classList.contains('modal-backdrop')) {
    closeModal();
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.action;

  if (action === 'check-clean') {
    const current = state.entries[localDateISO()];
    if (current === 'clean') {
      showToast('Today is already marked clean.');
    } else if (current === 'relapsed') {
      modal = { type: 'confirm-clean' };
      render();
    } else {
      recordClean();
    }
  } else if (action === 'check-relapsed') {
    if (state.entries[localDateISO()] === 'relapsed') {
      showToast('Today is already recorded.');
    } else {
      modal = { type: 'confirm-relapse' };
      render();
    }
  } else if (action === 'manual-start') {
    openManual('start');
  } else if (action === 'manual-day') {
    openManual('day');
  } else if (action === 'save-start') {
    const startDate = document.querySelector('#manual-date')?.value;
    if (!startDate) return;
    try {
      const next = setStreakStart(state, startDate, localDateISO());
      const day = calculateMetrics(next).day;
      saveState(next);
      modal = null;
      render();
      showToast(`You’re on day ${day}. Past days were marked clean.`);
    } catch (error) {
      showToast(error.message || 'Choose a date in the last 21 days.');
    }
  } else if (action === 'save-day') {
    const day = Number(document.querySelector('#manual-day')?.value);
    try {
      const next = setStreakDay(state, day, localDateISO());
      saveState(next);
      modal = null;
      render();
      showToast(`You’re on day ${day}. Past days were marked clean.`);
    } catch (error) {
      showToast(error.message || 'Choose a day from 1 to 21.');
    }
  } else if (action === 'confirm-relapse') {
    recordRelapse();
  } else if (action === 'confirm-clean') {
    recordClean();
  } else if (action === 'close-modal') {
    closeModal();
  } else if (action === 'share-card') {
    const day = calculateMetrics(state).day;
    modal = { type: 'share', image: createShareCard(day) };
    render();
  } else if (action === 'download-share') {
    triggerDownload(modal.image, 'daymark-share-card.png');
    showToast('Share card saved to your downloads.');
  } else if (action === 'share-share') {
    shareCurrentCard();
  } else if (action === 'download-wallpaper') {
    downloadWallpaper(Number(actionButton.dataset.wallpaperIndex));
  } else if (action === 'day-clean') {
    applyDayEdit(modal.date, 'clean');
  } else if (action === 'day-relapse') {
    applyDayEdit(modal.date, 'relapsed');
  } else if (action === 'day-clear') {
    applyDayEdit(modal.date, null);
  } else if (action === 'day-fill') {
    try {
      const date = modal.date;
      const next = setStreakStart(state, date, localDateISO());
      modal = null;
      saveState(next);
      showToast(`Streak filled from ${formatDate(date, { month: 'short', day: 'numeric' })}. Past days were marked clean.`);
    } catch (error) {
      showToast(error.message || 'Choose a date in the last 21 days.');
    }
  } else if (action === 'set-theme') {
    const index = Number(actionButton.dataset.wallpaperIndex);
    const metrics = calculateMetrics(state);
    if (index >= metrics.unlocked) {
      showToast('This wallpaper is still locked. Keep completing clean days.');
      return;
    }
    modal = null;
    saveState({ ...state, theme: index });
    showToast(`“${WALLPAPERS[index].name}” is now your background.`);
  } else if (action === 'remove-theme') {
    modal = null;
    saveState({ ...state, theme: null });
    showToast('Background removed. Back to the default dark screen.');
  }
}

root.addEventListener('click', handleClick);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modal) closeModal();
});
render();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
