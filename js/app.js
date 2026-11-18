// autumn // PERSONAL COMMAND LEDGER — Core Engine (v1.5.0 Modular)
// Loads upfront for immediate 01 // STUDY interactivity; lazy-loads secondary tabs,
// modals, changelog data, and feature modules on demand.

// ==========================================
// 1. SUPABASE & GOOGLE CALENDAR CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://urmlywiuzplcmivcefak.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_UcN-EW5PmAtdEVk7UprZNw_Fz8CPodd';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ==========================================================================
   SECURITY // RLS CONTRACT (enforce in the Supabase dashboard, not in this file)
   --------------------------------------------------------------------------
   The anon key above is public by design — it ships to every browser. Every
   protection therefore lives in Row Level Security. The contract this client
   depends on:

   1. READ is public on the data tables. Guest read-only browsing is a product
      decision, so `select` policies may use `using (true)`.
   2. WRITE is owner-only. Every insert/update/delete policy must be restricted
      to the authenticated role; the `currentUser` checks in this file are UX
      affordances, never the security boundary.
   3. daily_notes rows '1970-01-01' and '1970-01-02' hold Google Calendar /
      Drive config INCLUDING API keys. They must not be selectable by anon.
   4. drive_config holds an API key: owner-only, no public select at all.

   Reference SQL:
     create policy "public read"  on public.study_ledger for select using (true);
     create policy "owner write"  on public.study_ledger for all to authenticated
       using (true) with check (true);

     create policy "notes public read" on public.daily_notes for select
       using (date <> '1970-01-01' and date <> '1970-01-02');
     create policy "notes owner read"  on public.daily_notes for select
       to authenticated using (true);

     alter table public.drive_config enable row level security;
     create policy "drive_config owner" on public.drive_config for all
       to authenticated using (true) with check (true);

   Repeat (1)+(2) for: steps_ledger, task_columns, task_items, recurring_habits,
   running_logs, portfolio_logs, general_notes, youtube_resources,
   calendar_events_cache, operational_yield_ledger.
   Without (3)/(4), any visitor can read the owner's Google API key from the DOM
   or the network tab — this file no longer loads it for guests, but RLS is the
   only real fix.
   ========================================================================== */

// Optional: You can hardcode your Google Calendar ID & API Key right here,
// OR paste them once inside the app's "Configure Google Calendar Source" modal!
// PRIVACY: no personal address is baked into the shipped source any more. The owner
// enters the calendar ID once in the "Configure Google Calendar" modal; it is stored in
// the authenticated-only reserved row and is never rendered for a guest.
let GOOGLE_CALENDAR_ID = '';
let GOOGLE_API_KEY = '';

// Optional: You can hardcode your Google Drive API Key and Primary Folder ID right here,
// OR paste them once inside the app's "Configure Google Drive Folders & API Key" modal!
let GOOGLE_DRIVE_API_KEY = '';
let GOOGLE_DRIVE_FOLDERS = [
  {
    id: '', // <-- Paste your Google Drive Folder ID here (or via the  Configure button in Tab 06)
    title: 'Primary Study Resources',
    expandedByDefault: true
  }
];

// Reserved date rows in daily_notes used to store public Google Calendar & Drive config
const GCAL_CONFIG_DATE_KEY = '1970-01-01';
const GDRIVE_CONFIG_DATE_KEY = '1970-01-02'; // reserved daily_notes row: Drive config

// ==========================================
// 1B. SINGLE-FILE PWA BOILERPLATE (icon + manifest, zero external assets)
// The app ships as ONE .html file, so icon.svg / manifest.webmanifest cannot exist on
// disk. Both are therefore synthesised at runtime: the icon is drawn on a <canvas> and
// exported as a PNG data URL, and the manifest is a Blob URL. On file:// the manifest
// step is skipped (browsers ignore Blob manifests there) and nothing else is affected.
// ==========================================
function buildAutumnIconPng(size) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    // C2 brand mark: emerald field with four corner brackets (mirrors .brand-mark).
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#0c1f17';
    ctx.lineWidth = Math.max(2, Math.round(size * 0.055));
    const pad = Math.round(size * 0.15);
    const arm = Math.round(size * 0.22);
    const bracket = (x1, y1, x2, y2, x3, y3) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.stroke();
    };
    bracket(pad, pad + arm, pad, pad, pad + arm, pad);
    bracket(size - pad - arm, pad, size - pad, pad, size - pad, pad + arm);
    bracket(pad, size - pad - arm, pad, size - pad, pad + arm, size - pad);
    bracket(size - pad - arm, size - pad, size - pad, size - pad, size - pad, size - pad - arm);
    return canvas.toDataURL('image/png');
  } catch (e) {
    return '';
  }
}

function installInlinedManifest() {
  try {
    const icon192 = buildAutumnIconPng(192);
    const icon512 = buildAutumnIconPng(512);

    // iOS home-screen icon prefers a real PNG over an SVG data URI.
    const touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (touchIcon && icon512) touchIcon.href = icon512;

    if (String(location.protocol).indexOf('http') !== 0) return; // file:// → no manifest

    const icons = [];
    if (icon192) icons.push({ src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' });
    if (icon512) icons.push({ src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' });
    if (icons.length === 0) return;

    const manifest = {
      name: 'autumn // Personal Command Ledger',
      short_name: 'autumn',
      description: 'Personal command ledger for study hours, steps, calendar, tasks, habits, runs and notes.',
      // A blob: manifest has no useful base URL, so start_url/scope must be absolute —
      // with relative values Chrome warns and then IGNORES both properties, which
      // silently breaks installability.
      start_url: location.origin + location.pathname,
      scope: location.origin + location.pathname.replace(/[^/]*$/, ''),
      display: 'standalone',
      orientation: 'any',
      background_color: '#e8f3ec',
      theme_color: '#0c1f17',
      icons: icons
    };

    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = blobUrl;
    window.__autumnManifestUrl = blobUrl;
  } catch (e) {
    // A missing manifest is a cosmetic loss, never a boot failure.
    console.warn('[autumn] runtime manifest/icon generation skipped:', e && e.message);
  }
}

// Global Auth State
let currentUser = null;

// Guards the operational-yield engine: grades must never be computed/persisted until
// BOTH the study and steps ledgers have finished loading. Without this, the
// INITIAL_SESSION auth event fired during page load and wrote grades computed against
// an empty steps ledger (every day picking up a bogus -6 "missing module" penalty).
let ledgerDataReady = false;

// Study Constants (Weekdays: 7h, Weekends: 5h, Daily Cap: 12h)
const STUDY_WEEKDAY_GOAL = 7;
const STUDY_WEEKEND_GOAL = 5;
const BASE_GOAL = 7;
const MAX_DAILY = 12;
let studyChartInstance = null;
let globalStudyRows = [];
let currentStudyCalDate = new Date();

// Steps Constants (Weekdays: 10,000, Weekends: 7,000, Daily Cap: 18,000)
const STEPS_WEEKDAY_GOAL = 10000;
const STEPS_WEEKEND_GOAL = 7000;
const STEPS_BASE_GOAL = 10000;
const STEPS_MAX_DAILY = 18000;
let stepsChartInstance = null;
let globalStepsRows = [];
let currentStepsCalDate = new Date();

function isWeekendDate(dateInput) {
  const d = typeof dateInput === 'string'
    ? new Date(dateInput + 'T00:00:00')
    : new Date(dateInput);
  const day = d.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

function getStudyBaseGoalForDate(dateInput) {
  return isWeekendDate(dateInput) ? STUDY_WEEKEND_GOAL : STUDY_WEEKDAY_GOAL;
}

function getStepsBaseGoalForDate(dateInput) {
  return isWeekendDate(dateInput) ? STEPS_WEEKEND_GOAL : STEPS_WEEKDAY_GOAL;
}

// Calendar State
let globalCalendarEvents = [];
let currentCalViewMode = 'schedule'; // Default view: schedule
let currentCalCursorDate = new Date();

// Tasks & Inline Editing State
let globalTaskColumns = [];
let globalTaskItems = [];
let editingColumnId = null;
let editingTaskId = null;

// Running Ledgers State (5K active by default; 10K, Half, Marathon toggleable or auto-shown if they have logs)
let globalRunningLogs = [];
let visibleRunCategories = {
  '5k': true,
  '10k': false,
  'half': false,
  'marathon': false
};
let editingRunId = null;

const RUN_CATEGORY_META = {
  '5k': { title: '5K', km: 5 },
  '10k': { title: '10K', km: 10 },
  'half': { title: 'HALF MARATHON (21.1K)', km: 21.0975 },
  'marathon': { title: 'MARATHON (42.2K)', km: 42.195 }
};

// Notes State (Daily Journal + General Notes)
let globalNotes = [];
let selectedNoteDate = '';
let globalGeneralNotes = [];
let selectedGeneralNoteId = null;

// 1C. VERSION & RELEASE CHANGELOG (v1.0.0)
// ONE constant drives everything: the header chip, the Tools Hub "CHANGELOG" panel, the
// ›changelog palette command, the "what's new" nudge and the diagnostics BUILD row.
// To ship a release: bump APP_VERSION, prepend an entry to CHANGELOG. Nothing else.

// Shared states owned by Core so lazy modules never clash or throw ReferenceError
let journalEditorDirty = false;
let generalNoteDirty = false;
const NOTES_ORDER_DATE_KEY = '1970-01-04';
let journalEntryOrder = [];
let generalNoteOrder = [];
let globalPortfolioLogs = [];
let globalHabits = [];
let driveExpandedState = {};
let driveFolderChildrenCache = {};
let globalDriveFilesMap = {};
let globalYoutubeResources = [];
let activeYoutubeResourceId = null;
let isTerminalDrawerOpen = false;
let terminalSaveTimeout = null;
let isSavingTerminalNote = false;
let pendingTerminalSave = false;
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const btn = document.getElementById('tools-install-btn');
  if (btn) btn.classList.remove('hidden');
});

// 1C. VERSION & RELEASE CHANGELOG (v1.5.0)
const APP_VERSION = '1.5.0';
const APP_VERSION_DATE = '2026-11-18';
const APP_VERSION_LABEL = 'LIGHTSPEED SVG ENGINE & MODULAR COMMAND LEDGER';
const SEEN_VERSION_KEY = 'autumn_seen_version';
const CHANGELOG_TAG_CLASS = {
  NEW: 'badge-green',
  FIX: 'badge-red',
  IMPROVE: 'badge-blue',
  DATA: 'badge-amber'
};
window.__autumnBuild = 'v' + APP_VERSION;

async function renderChangelog() {
  const host = document.getElementById('tools-changelog-body');
  if (!host) return;
  if (!Array.isArray(window.AUTUMN_CHANGELOG) && window.__autumnLazy && typeof window.__autumnLazy.ensureModule === 'function') {
    try { await window.__autumnLazy.ensureModule('changelog-data'); } catch (e) {}
  }
  const list = Array.isArray(window.AUTUMN_CHANGELOG) ? window.AUTUMN_CHANGELOG : [];
  if (!list.length) {
    host.innerHTML = '<div class="font-mono-tech text-xs text-[#436152] p-3">Changelog unavailable.</div>';
    return;
  }
  host.innerHTML = list.map((release) => {
    const isCurrent = release.version === APP_VERSION;
    const rows = (release.items || []).map((item) => `
      <li class="flex items-start gap-1.5 leading-relaxed min-w-0">
        <span class="tech-badge ${CHANGELOG_TAG_CLASS[item.tag] || 'badge-neutral'} !text-[9px] shrink-0">${escapeHtml(item.tag || 'NOTE')}</span>
        <span class="text-[11px] text-[#0c1f17] break-words">${escapeHtml(item.text)}</span>
      </li>
    `).join('');
    return `
      <div class="metric-box ${isCurrent ? 'accent-green' : ''}">
        <div class="flex flex-wrap items-center justify-between gap-1.5 border-b border-[#e8f3ec] pb-1.5 mb-1.5">
          <div class="flex flex-wrap items-center gap-1.5 min-w-0">
            <span class="font-mono-tech text-xs font-bold text-[#0c1f17]">v${escapeHtml(release.version)}</span>
            ${isCurrent ? '<span class="tech-badge badge-green !text-[9px]">CURRENT</span>' : ''}
            ${release.label ? `<span class="tech-badge badge-neutral !text-[9px]">${escapeHtml(release.label)}</span>` : ''}
          </div>
          <span class="font-mono-tech text-[10px] text-[#436152] shrink-0">${escapeHtml(release.date || '')}</span>
        </div>
        <ul class="flex flex-col gap-1 mt-0.5">${rows}</ul>
      </div>
    `;
  }).join('');
  const foot = document.getElementById('tools-changelog-foot');
  if (foot) {
    foot.textContent = 'Running v' + APP_VERSION + ' (' + APP_VERSION_LABEL + ', ' + APP_VERSION_DATE + ') — ' +
      list.length + ' recorded release(s). Open with the header chip, ›changelog, or index.html#changelog.';
  }
}

function syncVersionUi() {
  const chip = document.getElementById('app-version-chip');
  if (chip) {
    chip.textContent = 'v' + APP_VERSION;
    chip.title = 'autumn v' + APP_VERSION + ' — open the release changelog';
    chip.setAttribute('aria-label', 'Version ' + APP_VERSION + ' — open the release changelog');
  }
}

function maybeAnnounceVersion() {
  let seen = '';
  try { seen = safeStorage.getItem(SEEN_VERSION_KEY) || ''; } catch (e) { return; }
  if (seen === APP_VERSION) return;
  try { safeStorage.setItem(SEEN_VERSION_KEY, APP_VERSION); } catch (e) {}
  setTimeout(() => {
    if (typeof showToast === 'function') {
      showToast('AUTUMN v' + APP_VERSION, 'Lightspeed SVG Engine & Modular Command Ledger ready. Click v' + APP_VERSION + ' for changelog.');
    }
  }, 1800);
}

// ==========================================
// 2. HELPERS & NOTIFICATIONS
// ==========================================
// ── Defensive storage + DOM wiring ──────────────────────────────────────
// localStorage throws a SecurityError when storage is disabled, when the page is
// embedded without storage access, or in some hardened browser modes. Because this app
// is ONE classic script, an uncaught throw at top level would silently kill every
// statement after it — so every read/write goes through these three mirrors instead.
const safeStorage = {
  getItem(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  setItem(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
  removeItem(key) { try { localStorage.removeItem(key); } catch (e) {} }
};

// Deferred-aware DOM listener wiring + lazy fragment/module loader
const __pendingOnReady = [];
const __boundOnReadyElements = new WeakMap();

function bindOnReadyElement(el, eventName, handler) {
  let map = __boundOnReadyElements.get(el);
  if (!map) {
    map = new Map();
    __boundOnReadyElements.set(el, map);
  }
  let set = map.get(eventName);
  if (!set) {
    set = new Set();
    map.set(eventName, set);
  }
  if (set.has(handler)) return;
  set.add(handler);
  el.addEventListener(eventName, handler);
}

function onReady(elementId, eventName, handler) {
  const el = document.getElementById(elementId);
  if (el) {
    bindOnReadyElement(el, eventName, handler);
    return el;
  }
  __pendingOnReady.push({ id: elementId, ev: eventName, handler });
  return null;
}

function __flushDeferredOnReady() {
  for (let i = __pendingOnReady.length - 1; i >= 0; i--) {
    const entry = __pendingOnReady[i];
    const el = document.getElementById(entry.id);
    if (el) {
      bindOnReadyElement(el, entry.ev, entry.handler);
      __pendingOnReady.splice(i, 1);
    }
  }
}

window.__autumnLazy = (function () {
  const fragPromises = new Map();
  const modPromises = new Map();
  const mountedFragments = new Set();
  const loadedModules = new Set();

  const TAB_FRAGMENTS = {
    steps: './fragments/tab-steps.html',
    calendar: './fragments/tab-calendar.html',
    tasks: './fragments/tab-tasks.html',
    notes: './fragments/tab-notes.html',
    resources: './fragments/tab-resources.html',
    focus: './fragments/tab-focus.html'
  };

  const MODULE_URLS = {
    'mod-steps': './js/mod-steps.js',
    'mod-calendar': './js/mod-calendar.js',
    'mod-tasks': './js/mod-tasks.js',
    'tasks-power': './js/tasks-power.js',
    'mod-notes': './js/mod-notes.js',
    'mod-resources': './js/mod-resources.js',
    'mod-extras': './js/mod-extras.js',
    'changelog-data': './js/changelog-data.js'
  };

  function resolveUrl(rawUrl) {
    const assets = window.__autumnAssets;
    if (assets && assets[rawUrl]) return assets[rawUrl];
    return rawUrl;
  }

  function ensureFragment(hostId, url) {
    if (mountedFragments.has(hostId)) return Promise.resolve();
    if (fragPromises.has(hostId)) return fragPromises.get(hostId);
    const p = fetch(resolveUrl(url))
      .then((res) => {
        if (!res.ok) throw new Error('Fragment load failed: ' + url);
        return res.text();
      })
      .then((html) => {
        const host = document.getElementById(hostId);
        if (host) {
          host.innerHTML = html;
          mountedFragments.add(hostId);
          __flushDeferredOnReady();
          if (typeof applyIconLabels === 'function') applyIconLabels(host);
          if (typeof syncOwnerPermissions === 'function') syncOwnerPermissions(host);
        }
      })
      .catch((err) => {
        fragPromises.delete(hostId);
        console.warn('[autumn] fragment error:', err && err.message);
      });
    fragPromises.set(hostId, p);
    return p;
  }

  function ensureModule(key) {
    if (loadedModules.has(key)) return Promise.resolve();
    if (modPromises.has(key)) return modPromises.get(key);
    const url = MODULE_URLS[key] || key;
    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = resolveUrl(url);
      s.async = false;
      s.onload = () => {
        loadedModules.add(key);
        __flushDeferredOnReady();
        resolve();
      };
      s.onerror = (err) => {
        modPromises.delete(key);
        reject(err);
      };
      document.head.appendChild(s);
    });
    modPromises.set(key, p);
    return p;
  }

  async function ensureModalsMounted() {
    if (document.getElementById('login-modal')) return;
    await ensureFragment('modals-host', './fragments/modals.html');
  }

  async function ensureTabReady(tabName) {
    if (!tabName || tabName === 'study') return;
    const hostId = 'tab-' + tabName;
    const fragUrl = TAB_FRAGMENTS[tabName];
    const modKey = tabName === 'focus' ? 'mod-resources' : ('mod-' + tabName);
    if (fragUrl) await ensureFragment(hostId, fragUrl);
    if (MODULE_URLS[modKey]) await ensureModule(modKey);
    const initMap = {
      steps: 'initStepsModule',
      calendar: 'initCalendarModule',
      tasks: 'initTasksModule',
      notes: 'initNotesModule',
      resources: 'initResourcesModule',
      focus: 'initFocusModule'
    };
    const initFn = window[initMap[tabName]];
    if (typeof initFn === 'function') await initFn();
  }

  let secondaryWarmed = false;
  function warmSecondaryData() {
    if (secondaryWarmed) return;
    secondaryWarmed = true;
    Promise.allSettled([
      ensureModule('mod-tasks').then(() => {
        if (typeof fetchAndRenderHabits === 'function') fetchAndRenderHabits();
        if (typeof fetchAndRenderRunningLogs === 'function') fetchAndRenderRunningLogs();
      }),
      ensureModule('mod-notes').then(() => {
        if (typeof fetchAndRenderNotes === 'function') fetchAndRenderNotes();
        if (typeof fetchAndRenderGeneralNotes === 'function') fetchAndRenderGeneralNotes();
        if (typeof fetchAndRenderPortfolioLogs === 'function') fetchAndRenderPortfolioLogs();
      }),
      ensureModule('mod-resources').then(() => {
        if (typeof fetchAndRenderYoutubeResources === 'function') fetchAndRenderYoutubeResources();
      })
    ]);
  }

  return {
    ensureFragment,
    ensureModule,
    ensureModalsMounted,
    ensureTabReady,
    warmSecondaryData
  };
})();

function getLocalDateString(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHours(decimalHours) {
  if (!decimalHours || decimalHours === 0) return "0h 0m";
  const isNegative = decimalHours < 0;
  const absHours = Math.abs(decimalHours);
  const h = Math.floor(absHours);
  const m = Math.round((absHours - h) * 60);
  const prefix = isNegative ? "-" : "";
  if (h === 0) return `${prefix}${m}m`;
  if (m === 0) return `${prefix}${h}h`;
  return `${prefix}${h}h ${m}m`;
}

function formatHMM(decimalHours) {
  if (!decimalHours || decimalHours <= 0) return "";
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatSteps(steps) {
  if (steps === null || steps === undefined) return "0";
  return Math.round(steps).toLocaleString('en-US');
}

function formatStepsCompact(steps) {
  if (!steps || steps <= 0) return "";
  if (steps >= 1000) return `${(steps / 1000).toFixed(1)}k`;
  return String(steps);
}

// Cheap deterministic string hash — used to detect "nothing changed" before writing to
// Supabase (see the calendar cache sync).
function simpleHash(str) {
  const s = String(str || '');
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
  }
  return h1.toString(36) + ':' + s.length;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Escapes a value that is interpolated into a JS string literal which itself lives
// inside an HTML attribute (e.g. onclick="openEventDetails('<id>')"). Without this a
// quote or backslash in an externally-sourced id (Google Calendar) would break out of
// the string. Order matters: backslash-escape first, then HTML-escape, so the entity
// decodes back to a still-escaped \' by the time the browser parses the handler.
function jsAttrQuote(value) {
  const raw = (value === null || value === undefined) ? '' : String(value);
  return escapeHtml(raw
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' '));
}

// Strip HTML tags cleanly for compact single-line previews & word counting
function stripHtmlTags(str) {
  if (!str) return '';
  return String(str)
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Safely allow <br> and <b> (plus basic formatting tags) in Calendar Event Details
function formatSafeCalendarHtml(rawStr) {
  if (!rawStr) return '';
  let safe = escapeHtml(rawStr);
  // Restore <br>, <br/>, <br />
  safe = safe.replace(/&lt;\s*br\s*\/?\s*&gt;/gi, '<br>');
  // Restore <b>, </b>, <strong>, </strong>, <i>, </i>, <em>, </em>, <u>, </u>
  safe = safe.replace(/&lt;(\/?(b|strong|i|em|u|ul|ol|li|p))\s*&gt;/gi, '<$1>');
  // Also convert plain newline characters to <br> if not already HTML-formatted
  safe = safe.replace(/\r?\n/g, '<br>');
  return safe;
}

let toastTimeout = null;
let toastUndoHandler = null;

// `undoFn` (optional) turns the toast into a 5–8s undo affordance for destructive actions.
function showToast(title, message, isError = false, undoFn = null) {
  const banner = document.getElementById('toast-banner');
  const titleEl = document.getElementById('toast-title');
  const messageEl = document.getElementById('toast-message');
  if (!banner || !titleEl || !messageEl) return;
  titleEl.textContent = title;
  messageEl.textContent = message;
  banner.style.borderLeftColor = isError ? '#dc2626' : '#10b981';
  // Errors interrupt the screen reader; successes wait for a pause.
  banner.setAttribute('role', isError ? 'alert' : 'status');
  banner.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  banner.classList.remove('hidden');

  toastUndoHandler = (typeof undoFn === 'function') ? undoFn : null;
  const undoBtn = document.getElementById('toast-undo-btn');
  if (undoBtn) undoBtn.classList.toggle('hidden', !toastUndoHandler);

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => hideToast(), toastUndoHandler ? 8000 : 4200);
}

function runToastUndo() {
  const handler = toastUndoHandler;
  toastUndoHandler = null;
  hideToast();
  if (typeof handler === 'function') handler();
}

function hideToast() {
  const banner = document.getElementById('toast-banner');
  if (banner) banner.classList.add('hidden');
  const undoBtn = document.getElementById('toast-undo-btn');
  if (undoBtn) undoBtn.classList.add('hidden');
  toastUndoHandler = null;
}

// Re-inserts a row captured just before a delete (undo path for the list deletes).
async function restoreDeletedRow(table, row, refreshFn) {
  if (!currentUser || !row) return;
  const { error } = await supabaseClient.from(table).insert(row);
  if (error) return showToast('UNDO FAILED', error.message, true);
  showToast('UNDONE', 'Row restored.');
  if (typeof refreshFn === 'function') refreshFn();
}

// ── Modal controller ────────────────────────────────────────────────────
// Tracks the open stack so Esc closes the TOP-most dialog, the page behind cannot
// scroll, and clicking the dimmed backdrop dismisses it (mobile-friendly).
const modalStack = [];
const modalReturnFocus = new Map();
let bodyScrollLockY = 0;

// iOS Safari ignores overflow:hidden on <body>, so the page has to be frozen with
// position:fixed and the scroll offset restored on close (see body.modal-open in CSS).
// Guarded by its own flag, NOT by modalStack.length: openModal() pushes the id before
// locking, so a length-based guard silently skipped the lock (and the iOS scroll fix).
let bodyIsLocked = false;
function lockBodyScroll() {
  if (bodyIsLocked) return;
  bodyIsLocked = true;
  bodyScrollLockY = window.scrollY || window.pageYOffset || 0;
  document.body.style.top = '-' + bodyScrollLockY + 'px';
  document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
  if (!bodyIsLocked) return;
  bodyIsLocked = false;
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  window.scrollTo(0, bodyScrollLockY);
}

// Safety net for a stuck scroll lock. `body.modal-open` freezes the page with
// position:fixed + overflow:hidden, and it is only cleared when the modal stack empties.
// If a dialog is ever dismissed by something other than closeModal(), the class survives
// and the page stops scrolling for good — which looks exactly like "I can't scroll down".
// This heals that state instead of asking the operator to reload.
function healStuckBodyScrollLock() {
  if (!document.body || !document.body.classList.contains('modal-open')) return false;
  const visibleDialog = Array.from(document.querySelectorAll('[id$="-modal"]'))
    .some(el => el && !el.classList.contains('hidden'));
  if (visibleDialog) return false;
  modalStack.length = 0;
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  bodyIsLocked = false;
  try { unlockBodyScroll(); } catch (e) {}
  Array.from(document.body.children).forEach((node) => {
    if (node.tagName === 'SCRIPT') return;
    node.removeAttribute('inert');
    node.removeAttribute('aria-hidden');
  });
  console.warn('[autumn] healed a stuck body scroll lock (no dialog was open)');
  return true;
}

function getModalFocusables(el) {
  if (!el) return [];
  return Array.from(el.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((node) => node.offsetParent !== null || node === document.activeElement);
}


async function openModal(id) {
  if (!document.getElementById(id) && window.__autumnLazy) {
    await window.__autumnLazy.ensureModalsMounted();
  }
  const el = document.getElementById(id);
  if (!el) return;
  if (id === 'gcal-config-modal') {
    const isOwner = Boolean(currentUser);
    const gcalIdInput = document.getElementById('gcal-id-input');
    const gcalKeyInput = document.getElementById('gcal-key-input');
    if (gcalIdInput) gcalIdInput.value = isOwner ? (GOOGLE_CALENDAR_ID || '') : '';
    if (gcalKeyInput) gcalKeyInput.value = isOwner ? (GOOGLE_API_KEY || '') : '';
    if (typeof renderManualMonthsBadges === 'function') renderManualMonthsBadges();
  } else if (id === 'gdrive-config-modal' && typeof window.hydrateDriveConfigModalInputs === 'function') {
    window.hydrateDriveConfigModalInputs();
  }
  el.classList.remove('hidden');
  if (modalStack.indexOf(id) === -1) modalStack.push(id);
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  if (!el.getAttribute('aria-labelledby')) {
    const heading = el.querySelector('h1, h2, h3, h4, [data-modal-title]');
    if (heading) {
      if (!heading.id) heading.id = id + '-title';
      el.setAttribute('aria-labelledby', heading.id);
    } else {
      el.setAttribute('aria-label', 'Dialog');
    }
  }
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  lockBodyScroll();
  Array.from(document.body.children).forEach((node) => {
    if (node === el || node.contains(el) || node.tagName === 'SCRIPT') return;
    node.setAttribute('inert', '');
    node.setAttribute('aria-hidden', 'true');
  });
  modalReturnFocus.set(id, document.activeElement);
  const focusables = getModalFocusables(el);
  const target = focusables[0] || el;
  setTimeout(() => { try { target.focus(); } catch (e) {} }, 30);
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  const idx = modalStack.indexOf(id);
  if (idx !== -1) modalStack.splice(idx, 1);

  if (modalStack.length === 0) {
    Array.from(document.body.children).forEach((node) => {
      node.removeAttribute('inert');
      node.removeAttribute('aria-hidden');
    });
    unlockBodyScroll();
  }

  // Focus goes back where the operator left it (trigger button, row action, …).
  const returnTo = modalReturnFocus.get(id);
  modalReturnFocus.delete(id);
  if (returnTo && typeof returnTo.focus === 'function' && document.contains(returnTo)) {
    setTimeout(() => { try { returnTo.focus(); } catch (e) {} }, 0);
  }
}

// Esc closes the top-most dialog; Tab / Shift+Tab cycle inside it.
document.addEventListener('keydown', (e) => {
  if (modalStack.length === 0) return;
  const topId = modalStack[modalStack.length - 1];
  const top = document.getElementById(topId);

  if (e.key === 'Escape') {
    e.stopPropagation();
    closeModal(topId);
    return;
  }
  if (e.key !== 'Tab' || !top) return;

  const focusables = getModalFocusables(top);
  if (focusables.length === 0) {
    e.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !top.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !top.contains(active))) {
    e.preventDefault();
    first.focus();
  }
});

// Backdrop click: only when the dimmed overlay itself is the target.
document.addEventListener('click', (e) => {
  const el = e.target;
  if (!el || !el.id || el.id.indexOf('-modal') === -1) return;
  if (modalStack.indexOf(el.id) === -1) return;
  closeModal(el.id);
});


async function confirmAction(title, desc, onConfirm) {
  if (!document.getElementById('confirm-modal') && window.__autumnLazy) {
    await window.__autumnLazy.ensureModalsMounted();
  }
  const tEl = document.getElementById('confirm-modal-title');
  const dEl = document.getElementById('confirm-modal-desc');
  const btn = document.getElementById('confirm-modal-accept');
  if (!tEl || !dEl || !btn) return;
  tEl.textContent = title;
  dEl.textContent = desc;
  btn.onclick = () => {
    closeModal('confirm-modal');
    onConfirm();
  };
  openModal('confirm-modal');
}

// ==========================================
// 3. TAB NAVIGATION (study -> steps -> calendar -> tasks -> notes -> resources + focus mode)
// ==========================================
const TAB_META = {
  study: '01 // STUDY',
  steps: '02 // STEPS',
  calendar: '03 // CALENDAR',
  tasks: '04 // TASKS',
  notes: '05 // NOTES',
  resources: '06 // RESOURCES',
  focus: '◈ // FOCUS'
};

// ==========================================
// 3B. ACCESSIBILITY ENHANCEMENT (applied once, programmatically)
// The markup predates the accessibility pass, so instead of hand-editing hundreds of
// nodes this runs once at boot: it assigns tab / tabpanel roles, labels icon-only
// buttons, promotes the brand to the page's only level-1 heading, and exposes state.
// ==========================================
const A11Y_GLYPH_LABELS = {
  '×': 'Close', '×': 'Remove', '↶': 'Undo', '◐': 'Cycle display theme',
  '▣': 'Open stat card', '▲': 'Move up', '▼': 'Move down', '‹': 'Move left', '›': 'Move right',
  '▴': 'Collapse', '▾': 'Expand', 'Edit': 'Edit', '+': 'Add', '＋': 'Add', '+': 'Add',
  '⌕': 'Search', '⋮': 'More actions', '⟳': 'Refresh', '⎘': 'Copy', '↵': 'Open'
};

// Assigns an accessible name to any icon-only button inside `root`. enhanceA11y() runs
// this once at boot; renderers call it again for dynamically created rows (task ▲▼Edit×,
// drive rows, youtube rows) which never pass through the boot-time sweep.
function applyIconLabels(root) {
  const scope = root || document;
  if (!scope.querySelectorAll) return;
  scope.querySelectorAll('button').forEach((btn) => {
    if (btn.getAttribute('aria-label') || btn.getAttribute('aria-labelledby')) return;
    const text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length > 1) return;
    btn.setAttribute('aria-label', btn.getAttribute('title') || A11Y_GLYPH_LABELS[text] || 'Action');
  });
}

function enhanceA11y() {
  // 1. Brand is the only page-level heading (tab titles are level 2).
  const brand = document.querySelector('header h1, header span.font-bold');
  if (brand && brand.tagName !== 'H1' && !brand.getAttribute('role')) {
    brand.setAttribute('role', 'heading');
    brand.setAttribute('aria-level', '1');
  }

  // 2. Desktop tab bar becomes a real tablist with roving tabindex.
  const TAB_IDS = ['study', 'steps', 'calendar', 'tasks', 'notes', 'resources'];
  const firstTabBtn = document.getElementById('tab-btn-study');
  if (firstTabBtn && firstTabBtn.parentElement) {
    firstTabBtn.parentElement.setAttribute('role', 'tablist');
    firstTabBtn.parentElement.setAttribute('aria-label', 'Command modules');
  }
  TAB_IDS.forEach((tabId) => {
    const btn = document.getElementById('tab-btn-' + tabId);
    const section = document.getElementById('tab-' + tabId);
    if (btn) {
      const isActive = btn.classList.contains('active');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', 'tab-' + tabId);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    }
    if (section && !section.getAttribute('role')) {
      section.setAttribute('role', 'tabpanel');
      section.setAttribute('aria-labelledby', 'tab-btn-' + tabId);
    }
  });

  // 3. Icon-only buttons get an accessible name from title, then the glyph map.
  applyIconLabels(document);

  // 4b. Tools Hub tablist: roving focus + arrow-key navigation (same model as the main nav).
  const toolsTabs = document.getElementById('tools-tabs');
  if (toolsTabs && !toolsTabs.getAttribute('data-kb-wired')) {
    toolsTabs.setAttribute('data-kb-wired', '1');
    toolsTabs.addEventListener('keydown', (event) => {
      if (!/^(ArrowRight|ArrowLeft|Home|End)$/.test(event.key)) return;
      const tabs = Array.from(toolsTabs.querySelectorAll('[role="tab"]'));
      const index = tabs.indexOf(document.activeElement);
      if (index === -1) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      // Switch first, then focus: showToolsPanel rewrites the roving tabindex.
      showToolsPanel(tabs[next].id.replace('tools-tab-', ''));
      tabs[next].focus();
    });
  }

  // 4. Toggle-style controls expose their state.
  const radarBtn = document.getElementById('navbar-line3-toggle-btn');
  if (radarBtn) {
    radarBtn.setAttribute('aria-controls', 'navbar-line3-bar');
    radarBtn.setAttribute('aria-expanded', isThirdNavbarExpanded ? 'true' : 'false');
  }

  // 5. Purely decorative chrome (corner brackets, diamonds) is skipped by readers.
  document.querySelectorAll('.corner-tl, .corner-tr, .corner-bl, .corner-br, .diamond').forEach((el) => {
    el.setAttribute('aria-hidden', 'true');
  });

  // 5b. Landmarks must be distinguishable (axe: landmark-unique). Each <aside> gets a
  // name derived from its own heading, de-duplicated within the document.
  const usedAsideLabels = [];
  document.querySelectorAll('aside').forEach((aside) => {
    if (aside.getAttribute('aria-label') || aside.getAttribute('aria-labelledby')) return;
    const heading = aside.querySelector('h1, h2, h3, .section-tag');
    const base = (heading && heading.textContent ? heading.textContent.replace(/[◆\s]+/g, ' ').trim() : '') ||
      (aside.id ? aside.id.replace(/-/g, ' ') : 'Side panel');
    let label = base.slice(0, 48) || 'Side panel';
    let suffix = 2;
    while (usedAsideLabels.indexOf(label) !== -1) { label = base.slice(0, 44) + ' ' + suffix; suffix += 1; }
    usedAsideLabels.push(label);
    aside.setAttribute('aria-label', label);
  });

  // 6. Live regions for the two constantly-updating readouts.
  const yieldBadge = document.getElementById('navbar-daily-yield-badge');
  if (yieldBadge) yieldBadge.setAttribute('aria-live', 'polite');
}

let activeTabName = 'study';
let lastNonFocusTab = 'study';
// Guards against the popstate handler re-pushing history when it restores a tab.
let suppressHistoryPush = false;
const __dirtyTabs = new Set();
window.__markAutumnTabDirty = function (tab) {
  if (tab && tab !== activeTabName) __dirtyTabs.add(tab);
};

function isTabActive(tab) {
  return activeTabName === tab;
}

function ensureChartJsAndRender(targetChart) {
  if ((!targetChart || targetChart === 'study') && activeTabName === 'study') {
    if (globalStudyRows.length) updateStudyChart(globalStudyRows);
    if (typeof renderAdvancedTelemetryAnalytics === 'function') renderAdvancedTelemetryAnalytics();
  }
  if ((!targetChart || targetChart === 'steps') && activeTabName === 'steps') {
    if (typeof updateStepsChart === 'function' && globalStepsRows.length) updateStepsChart(globalStepsRows);
    if (typeof renderAdvancedTelemetryAnalytics === 'function') renderAdvancedTelemetryAnalytics();
  }
}

let _postLedgerRafId = 0;
function schedulePostLedgerPipeline() {
  if (_postLedgerRafId) return;
  const run = () => {
    _postLedgerRafId = 0;
    if (typeof renderAdvancedTelemetryAnalytics === 'function') renderAdvancedTelemetryAnalytics();
    if (typeof renderPlannerInsights === 'function') renderPlannerInsights();
  };
  if (typeof requestAnimationFrame === 'function') _postLedgerRafId = requestAnimationFrame(run);
  else run();
}

function flushDirtyTab(tabName) {
  if (!__dirtyTabs.has(tabName) && tabName !== 'resources' && tabName !== 'focus') return;
  __dirtyTabs.delete(tabName);
  if (tabName === 'study') {
    updateStudyCalendar(globalStudyRows);
    updateStudyTodayDisplay(globalStudyRows);
    updateStudyTable(globalStudyRows);
    updateStudyPredictions(globalStudyRows);
    updateStudyChart(globalStudyRows);
    if (typeof renderAdvancedTelemetryAnalytics === 'function') renderAdvancedTelemetryAnalytics();
    if (typeof renderPlannerInsights === 'function') renderPlannerInsights();
    if (window.umAtlas && typeof window.umAtlas.renderStudyCourseHubStrip === 'function') window.umAtlas.renderStudyCourseHubStrip();
    if (window.analyticsMatrix && typeof window.analyticsMatrix.refreshAllAnalytics === 'function') window.analyticsMatrix.refreshAllAnalytics();
  } else if (tabName === 'steps') {
    if (typeof updateStepsCalendar === 'function') updateStepsCalendar(globalStepsRows);
    if (typeof updateStepsTodayDisplay === 'function') updateStepsTodayDisplay(globalStepsRows);
    if (typeof updateStepsTable === 'function') updateStepsTable(globalStepsRows);
    if (typeof updateStepsPredictions === 'function') updateStepsPredictions(globalStepsRows);
    if (typeof updateStepsChart === 'function') updateStepsChart(globalStepsRows);
    if (typeof renderAdvancedTelemetryAnalytics === 'function') renderAdvancedTelemetryAnalytics();
    if (window.analyticsMatrix && typeof window.analyticsMatrix.refreshAllAnalytics === 'function') window.analyticsMatrix.refreshAllAnalytics();
  } else if (tabName === 'calendar') {
    if (window.umAtlas) {
      if (typeof window.umAtlas.loadUmSearchIndex === 'function') window.umAtlas.loadUmSearchIndex();
      if (typeof window.umAtlas.renderCalendarCommuteStrip === 'function') window.umAtlas.renderCalendarCommuteStrip();
    }
    if (typeof renderCalendarViewport === 'function') renderCalendarViewport();
  } else if (tabName === 'tasks') {
    if (typeof renderTasksBoard === 'function') renderTasksBoard();
  } else if (tabName === 'focus') {
    if (window.umAtlas && typeof window.umAtlas.loadUmSearchIndex === 'function') window.umAtlas.loadUmSearchIndex();
    if (typeof updateClock === 'function') updateClock(true);
    if (typeof renderFocusMode === 'function') renderFocusMode();
  } else if (tabName === 'resources') {
    if (typeof renderYoutubeResources === 'function') renderYoutubeResources();
    if (typeof loadYoutubeResourceInPlayer === 'function' && !activeYoutubeResourceId && globalYoutubeResources.length > 0) {
      loadYoutubeResourceInPlayer(globalYoutubeResources[0].id, false);
    }
  }
}

function toggleMobileNavMenu(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('mobile-nav-dropdown');
  const chevron = document.getElementById('mobile-nav-chevron');
  const trigger = document.getElementById('mobile-nav-trigger');
  if (!dropdown) return;
  const isHidden = dropdown.classList.contains('hidden');
  if (isHidden) {
    dropdown.classList.remove('hidden');
    if (chevron) chevron.textContent = '▴';
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  } else {
    dropdown.classList.add('hidden');
    if (chevron) chevron.textContent = '▾';
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
}

function closeMobileNavMenu() {
  const dropdown = document.getElementById('mobile-nav-dropdown');
  const chevron = document.getElementById('mobile-nav-chevron');
  const trigger = document.getElementById('mobile-nav-trigger');
  if (dropdown) dropdown.classList.add('hidden');
  if (chevron) chevron.textContent = '▾';
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

// Browser Back/Forward between modules.
window.addEventListener('popstate', () => {
  const hashTab = (location.hash || '').replace('#', '');
  const target = TAB_META[hashTab] ? hashTab : 'study';
  suppressHistoryPush = true;
  switchTab(target);
  suppressHistoryPush = false;
});

document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('mobile-nav-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    closeMobileNavMenu();
  }
  const searchWrapper = document.getElementById('global-search-wrapper');
  if (searchWrapper && !searchWrapper.contains(e.target)) {
    const searchDropdown = document.getElementById('global-search-dropdown');
    if (searchDropdown) searchDropdown.classList.add('hidden');
  }
});

function toggleFocusMode() {
  if (activeTabName === 'focus') {
    switchTab(lastNonFocusTab || 'study');
  } else {
    switchTab('focus');
  }
}


async function switchTab(tabName) {
  if (tabName !== 'focus') {
    lastNonFocusTab = tabName;
  }
  activeTabName = tabName;

  if (tabName !== 'study' && window.__autumnLazy) {
    await window.__autumnLazy.ensureTabReady(tabName);
  }
  if (activeTabName !== tabName) return;

  const tabs = ['study', 'steps', 'calendar', 'tasks', 'notes', 'resources', 'focus'];
  tabs.forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    const mobBtn = document.getElementById(`mob-tab-btn-${t}`);
    const railBtn = document.getElementById(`rail-btn-${t}`);
    if (!section) return;
    if (t === tabName) {
      section.classList.remove('hidden');
      if (t === 'tasks' || t === 'focus') section.classList.add('flex');
      else section.classList.add('grid');
      if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); btn.setAttribute('tabindex', '0'); }
      if (mobBtn) { mobBtn.classList.add('active'); mobBtn.setAttribute('aria-selected', 'true'); }
      if (railBtn) { railBtn.classList.add('active'); railBtn.setAttribute('aria-current', 'page'); }
    } else {
      section.classList.add('hidden');
      section.classList.remove('grid', 'flex');
      if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-selected', 'false'); btn.setAttribute('tabindex', '-1'); }
      if (mobBtn) { mobBtn.classList.remove('active'); mobBtn.setAttribute('aria-selected', 'false'); }
      if (railBtn) { railBtn.classList.remove('active'); railBtn.removeAttribute('aria-current'); }
    }
  });

  const focusBtn = document.getElementById('focus-mode-btn');
  const focusBtnText = document.getElementById('focus-mode-btn-text');
  const focusIndicator = document.getElementById('focus-mode-indicator');
  if (focusBtn) {
    if (tabName === 'focus') {
      focusBtn.classList.add('active');
      if (focusBtnText) focusBtnText.textContent = 'Exit Focus';
      if (focusIndicator) focusIndicator.className = 'w-1.5 h-1.5 rounded-full bg-[#34d399] inline-block pulse-live';
    } else {
      focusBtn.classList.remove('active');
      if (focusBtnText) focusBtnText.textContent = 'Focus Mode';
      if (focusIndicator) focusIndicator.className = 'w-1.5 h-1.5 rounded-full bg-[#059669] inline-block';
    }
  }

  const mobileLabel = document.getElementById('mobile-active-tab-label');
  if (mobileLabel && TAB_META[tabName]) mobileLabel.textContent = TAB_META[tabName];
  closeMobileNavMenu();

  if (tabName === 'study') {
    if (__dirtyTabs.has('study')) flushDirtyTab('study');
    else if (studyChartInstance && typeof studyChartInstance.resize === 'function') studyChartInstance.resize();
    else ensureChartJsAndRender('study');
  }
  if (tabName === 'steps') {
    if (__dirtyTabs.has('steps')) flushDirtyTab('steps');
    else if (stepsChartInstance && typeof stepsChartInstance.resize === 'function') stepsChartInstance.resize();
    else ensureChartJsAndRender('steps');
  }
  if (tabName === 'calendar') {
    __dirtyTabs.delete('calendar');
    if (window.umAtlas) {
      if (typeof window.umAtlas.loadUmSearchIndex === 'function') window.umAtlas.loadUmSearchIndex();
      if (typeof window.umAtlas.renderCalendarCommuteStrip === 'function') window.umAtlas.renderCalendarCommuteStrip();
    }
    if (typeof renderCalendarViewport === 'function') renderCalendarViewport();
  }
  if (tabName === 'resources') {
    if (typeof renderDriveFoldersTree === 'function') renderDriveFoldersTree();
    flushDirtyTab('resources');
  }
  if (tabName === 'focus') {
    flushDirtyTab('focus');
  }
  if (tabName === 'tasks') {
    if (__dirtyTabs.has('tasks')) flushDirtyTab('tasks');
    if (globalTaskColumns.length === 0) fetchAndRenderTasks();
    if (globalHabits.length === 0 && typeof fetchAndRenderHabits === 'function') fetchAndRenderHabits();
    if (globalRunningLogs.length === 0 && typeof fetchAndRenderRunningLogs === 'function') fetchAndRenderRunningLogs();
  }
  if (tabName === 'notes') {
    if (globalNotes.length === 0 && typeof fetchAndRenderNotes === 'function') fetchAndRenderNotes();
    if (globalGeneralNotes.length === 0 && typeof fetchAndRenderGeneralNotes === 'function') fetchAndRenderGeneralNotes();
  }
  if (tabName === 'resources') {
    if (globalYoutubeResources.length === 0 && typeof fetchAndRenderYoutubeResources === 'function') fetchAndRenderYoutubeResources();
    if (Object.keys(globalDriveFilesMap).length === 0 && typeof loadSavedGDriveConfig === 'function') {
      loadSavedGDriveConfig().then(() => fetchGoogleDriveResources(false)).catch(() => {});
    }
  }
  if (!suppressHistoryPush && window.history && history.pushState && location.hash !== '#' + tabName) {
    history.pushState({ tab: tabName }, '', '#' + tabName);
  }
  if (typeof applyIconLabels === 'function') applyIconLabels();
}

function syncOwnerPermissions(root) {
  const isOwner = Boolean(currentUser);
  const scope = root || document;
  scope.querySelectorAll(".owner-input").forEach((el) => {
    el.disabled = !isOwner;
  });
  const noteEditor = document.getElementById("note-content-editor");
  if (noteEditor) noteEditor.setAttribute("contenteditable", isOwner ? "true" : "false");
  const genNoteEditor = document.getElementById("gen-note-content-editor");
  if (genNoteEditor) genNoteEditor.setAttribute("contenteditable", isOwner ? "true" : "false");
  scope.querySelectorAll(".owner-lock-badge").forEach((badge) => {
    if (isOwner) badge.classList.add("hidden");
    else badge.classList.remove("hidden");
  });
}
window.syncOwnerPermissions = syncOwnerPermissions;

function updateAuthUI(user) {
  currentUser = user;
  const isOwner = Boolean(user);
  const pill = document.getElementById("auth-status-pill");
  const actionBtn = document.getElementById("auth-action-btn");
  if (pill) {
    if (isOwner) {
      pill.className = "tech-badge badge-green shrink-0";
      pill.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#10b981] inline-block"></span><span>OWNER OPS // autumn</span>`;
    } else {
      pill.className = "tech-badge badge-amber shrink-0";
      pill.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#d97706] inline-block"></span><span>READ-ONLY // GUEST</span>`;
    }
  }
  if (actionBtn) actionBtn.textContent = isOwner ? "Sign Out" : "Owner Sign In";

  syncOwnerPermissions(document);

  if (typeof renderTasksBoard === "function") renderTasksBoard();
  if (typeof renderHabitsTable === "function") renderHabitsTable();
  if (typeof renderRunningTables === "function") renderRunningTables();
  if (typeof renderPortfolioTables === "function") renderPortfolioTables();
  if (typeof renderCalendarViewport === "function") renderCalendarViewport();
  if (typeof renderManualMonthsBadges === "function") renderManualMonthsBadges();
  if (typeof renderYoutubeResources === "function") renderYoutubeResources();
  if (typeof renderFocusMode === "function") renderFocusMode();
  if (typeof updateTerminalAuthUI === "function") updateTerminalAuthUI();
  if (typeof fetchAndSyncOperationalYield === "function") fetchAndSyncOperationalYield();
}

async function handleAuthClick() {
  if (currentUser) {
    supabaseClient.auth.signOut().then(() => {
      showToast('SIGNED OUT', 'Session returned to Read-Only mode.');
    });
  } else {
    if (window.__autumnLazy) await window.__autumnLazy.ensureModalsMounted();
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.classList.add('hidden');
    openModal('login-modal');
  }
}

onReady('login-form', 'submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');

  errBox.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying...';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Verify & Unlock';

  if (error) {
    errBox.textContent = error.message;
    errBox.classList.remove('hidden');
  } else {
    closeModal('login-modal');
    document.getElementById('login-password').value = '';
    showToast('WELCOME BACK, AUTUMN', 'Owner edit permissions unlocked.');
  }
});

// Supabase emits TOKEN_REFRESHED (roughly hourly) and USER_UPDATED alongside real
// sign-in/out events. Re-rendering the whole board on those wiped any in-progress inline
// edit (task title, habit row, calendar colour…), so only react when the identity changes.
let lastRenderedAuthIdentity = '__unset__';
supabaseClient.auth.onAuthStateChange((_event, session) => {
  const user = session ? session.user : null;
  const identity = user ? user.id : 'guest';
  if (identity === lastRenderedAuthIdentity) return;
  lastRenderedAuthIdentity = identity;
  updateAuthUI(user);
});


const REALTIME_REFRESH = {
  study_ledger: () => { fetchAndRenderStudy(); fetchAndSyncOperationalYield(); },
  steps_ledger: () => { fetchAndRenderSteps(); fetchAndSyncOperationalYield(); },
  operational_yield_ledger: () => { fetchAndSyncOperationalYield(); },
  daily_notes: () => { if (typeof fetchAndRenderNotes === "function") fetchAndRenderNotes(); loadSavedGCalCredentials(); },
  general_notes: () => { if (typeof fetchAndRenderGeneralNotes === "function") fetchAndRenderGeneralNotes(); },
  task_columns: () => fetchAndRenderTasks(),
  task_items: () => fetchAndRenderTasks(),
  recurring_habits: () => { if (typeof fetchAndRenderHabits === "function") fetchAndRenderHabits(); },
  running_logs: () => { if (typeof fetchAndRenderRunningLogs === "function") fetchAndRenderRunningLogs(); },
  portfolio_logs: () => { if (typeof fetchAndRenderPortfolioLogs === "function") fetchAndRenderPortfolioLogs(); },
  youtube_resources: () => { if (typeof fetchAndRenderYoutubeResources === "function") fetchAndRenderYoutubeResources(); },
  calendar_events_cache: () => { loadSavedGCalCredentials(); fetchGoogleCalendarEvents(false); }
};
const realtimeRefreshTimers = {};
let realtimeChannel = null;

function scheduleRealtimeRefresh(table) {
  if (!REALTIME_REFRESH[table]) return;
  // A hidden tab does nothing; the visibility handler refreshes when it comes back.
  if (document.visibilityState === 'hidden') return;
  if (realtimeRefreshTimers[table]) clearTimeout(realtimeRefreshTimers[table]);
  realtimeRefreshTimers[table] = setTimeout(() => {
    realtimeRefreshTimers[table] = null;
    try {
      REALTIME_REFRESH[table]();
    } catch (e) {
      console.warn('[autumn] live refresh skipped for ' + table + ':', e && e.message);
    }
  }, 400);
}

function initRealtimeSync() {
  if (realtimeChannel || typeof supabaseClient.channel !== 'function') return;
  try {
    const channel = supabaseClient.channel('autumn-live-sync');
    Object.keys(REALTIME_REFRESH).forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: table }, () => {
        scheduleRealtimeRefresh(table);
      });
    });
    // If the tables are not in the `supabase_realtime` publication this simply never
    // fires — the app keeps working exactly as before, just without live updates.
    realtimeChannel = channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[autumn] realtime sync connected');
    });
  } catch (e) {
    console.warn('[autumn] realtime sync unavailable:', e && e.message);
  }
}

// Cross-tab: preferences live in the browser, so when one tab rewrites them the others
// must re-read instead of drifting apart.
window.addEventListener('storage', (e) => {
  const key = e && e.key;
  if (!key || key.indexOf('autumn_') !== 0) return;
  try {
    if (key === 'autumn_task_col_order') {
      const v = JSON.parse(safeStorage.getItem(key) || '[]');
      if (Array.isArray(v)) { taskColOrder = v; if (typeof renderTasksBoard === "function") renderTasksBoard(); }
    } else if (key === 'autumn_task_item_order') {
      const v = JSON.parse(safeStorage.getItem(key) || '{}');
      if (v && typeof v === 'object') { taskItemOrder = v; if (typeof renderTasksBoard === "function") renderTasksBoard(); }
    } else if (key === 'autumn_task_col_collapsed') {
      const v = JSON.parse(safeStorage.getItem(key) || '{}');
      if (v && typeof v === 'object') { collapsedTaskCols = v; if (typeof renderTasksBoard === "function") renderTasksBoard(); }
    } else if (key === 'autumn_task_child_collapsed') {
      const v = JSON.parse(safeStorage.getItem(key) || '{}');
      if (v && typeof v === 'object') { collapsedTaskChildren = v; if (typeof renderTasksBoard === "function") renderTasksBoard(); }
    } else if (key === 'autumn_redeemed_passes_map') {
      const v = JSON.parse(safeStorage.getItem(key) || '{}');
      if (v && typeof v === 'object') { localRedeemedPassesMap = v; renderPlannerInsights(); }
    } else if (key === 'autumn_pass_used_dates_map') {
      const v = JSON.parse(safeStorage.getItem(key) || '{}');
      if (v && typeof v === 'object') { localPassUsedDatesMap = v; renderPlannerInsights(); }
    } else if (key === 'autumn_nav3_expanded') {
      isThirdNavbarExpanded = safeStorage.getItem(key) !== 'false';
      applyThirdNavbarState();
    } else if (key === 'autumn_display_profile') {
      applyDisplayColorProfile(safeStorage.getItem(key) || 'default');
    }
  } catch (err) {}
});

// ==========================================
// 5. LIVE CLOCK & DAY PROGRESS
// ==========================================
let _lastClockDateStr = '';
let _lastClockPctStr = '';
let _lastFocusHmStr = '';
function updateClock(forceFocusSync) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const timeEl = document.getElementById('current-time');
  if (timeEl && timeEl.textContent !== timeStr) timeEl.textContent = timeStr;

  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  if (dateStr !== _lastClockDateStr) {
    _lastClockDateStr = dateStr;
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = dateStr;
  }

  const hours = now.getHours();
  const mins = now.getMinutes();
  const secs = now.getSeconds();
  const totalSecondsPassed = (hours * 3600) + (mins * 60) + secs;
  const secondsRemaining = Math.max(0, 86400 - totalSecondsPassed);
  const percentPassed = (totalSecondsPassed / 86400) * 100;
  const percentRemaining = 100 - percentPassed;
  const remPctStr = `${percentRemaining.toFixed(1)}%`;

  if (remPctStr !== _lastClockPctStr) {
    _lastClockPctStr = remPctStr;
    const progEl = document.getElementById('day-progress');
    const remEl = document.getElementById('day-remaining-text');
    if (progEl) progEl.style.width = `${percentPassed.toFixed(2)}%`;
    if (remEl) remEl.textContent = `${remPctStr} left`;
  }

  if (activeTabName === 'focus' || forceFocusSync) {
    const focusClockEl = document.getElementById('focus-live-clock');
    if (focusClockEl) focusClockEl.textContent = timeStr;
    const focusRemPctEl = document.getElementById('focus-day-rem-pct');
    const focusRemBarEl = document.getElementById('focus-day-rem-bar');
    if (focusRemPctEl && focusRemPctEl.textContent !== remPctStr) focusRemPctEl.textContent = remPctStr;
    if (focusRemBarEl) focusRemBarEl.style.width = `${percentRemaining.toFixed(2)}%`;
    const remH = Math.floor(secondsRemaining / 3600);
    const remM = Math.floor((secondsRemaining % 3600) / 60);
    const hmStr = `${remH}h ${remM}m left until 24:00`;
    if (hmStr !== _lastFocusHmStr || forceFocusSync) {
      _lastFocusHmStr = hmStr;
      const focusRemHmEl = document.getElementById('focus-day-rem-hm');
      if (focusRemHmEl) focusRemHmEl.textContent = hmStr;
    }
  }
}
// Tick only while the tab is visible — browsers throttle background timers anyway, and
// there is no point repainting a dashboard nobody can see.
setInterval(() => { if (!document.hidden) updateClock(false); }, 1000);
updateClock(false);

// ==========================================
// 6. TAB 1: STUDY LEDGER LOGIC (TESTING PHASE NOW -> RESETS NOV 1 WITH OCT 30–31 CARRYOVER)
// ==========================================
const OFFICIAL_LEDGER_START_DATE = '2026-11-01';
const CARRYOVER_WINDOW_START_DATE = '2026-10-30'; // Oct 30 & Oct 31 carry over into Nov 1 real phase

function isOfficialLedgerDate(dateStr) {
  return Boolean(dateStr && dateStr >= OFFICIAL_LEDGER_START_DATE);
}

function isCarryoverWindowDate(dateStr) {
  return Boolean(dateStr && dateStr >= CARRYOVER_WINDOW_START_DATE && dateStr < OFFICIAL_LEDGER_START_DATE);
}

function isRealPhaseActiveNow() {
  return getLocalDateString(new Date()) >= OFFICIAL_LEDGER_START_DATE;
}

// During Testing Phase (before Nov 1): returns all rows so stats/charts/grades are visible now.
// Once Real Phase starts (Nov 1+): resets earlier test logs (< Oct 30) while carrying over Oct 30–31 + Nov 1+.
function getPhaseActiveRows(rows) {
  if (!Array.isArray(rows)) return [];
  if (!isRealPhaseActiveNow()) return rows;
  return rows.filter(r => r.date >= CARRYOVER_WINDOW_START_DATE);
}

// Returns the newest ledger row whose date is <= dateStr.
// Ledger rows arrive sorted ascending, so this is also the debt carrier for "today".
// Prevents future-dated rows (e.g. a quota pass redeemed ahead of time) from being
// mistaken for the latest state when projecting the 7-day forecast.
function getLatestLedgerRowUpTo(rows, dateStr) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let latest = null;
  for (const r of rows) {
    if (r && r.date && r.date <= dateStr) latest = r;
    else if (r && r.date && r.date > dateStr) break;
  }
  return latest;
}

// ==========================================
// CANONICAL DEBT / OVERFLOW MODEL  (single source of truth)
// ---------------------------------------------------------------
//   daily target         = clamp(baseGoal + debtBefore, 0, cap)     -> CAPPED
//   debt after the day   = (baseGoal + debtBefore) - actual         -> UNCAPPED
//
// Consequences by design:
//   • A missed day pushes tomorrow's target up, and that backlog never expires.
//   • A capped day can never demand more than `cap`, but any excess debt stays on the book.
//   • `actual` > goal produces a NEGATIVE debt (surplus). Surplus is real credit: it
//     lowers future targets day-by-day until it is used up.
//
// Pass actual = null/undefined for FORECASTING: it assumes the target was met, which is
// the only self-consistent projection (actual === target).
// ==========================================
function computeOverflowStep(baseGoal, debtBefore, actual, cap) {
  const base = Number(baseGoal) || 0;
  const debt = Number(debtBefore) || 0;
  const limit = Number(cap) || 0;
  const raw = base + debt;
  const target = Math.min(Math.max(0, raw), limit);
  const effectiveActual = (actual === null || actual === undefined || actual === '')
    ? target
    : Math.max(0, Number(actual) || 0);
  return { target, overflow: raw - effectiveActual };
}

// ==========================================
// SCORING BASELINE (v1.3.0) — surplus/debt aware
// The score used to divide by the flat base goal (5.2 h / 7 h → 74% of 50 pts) even on a
// day that a carried surplus had already paid for. The baseline for scoring is now the
// day's computed target — the same number the ledger's "Computed Target" column and the
// "REQUIRED TARGET TODAY" token already print — floored at 25% of the base goal so the
// divisor can never collapse to zero, plus a small proportional boost when the day opens
// on a large surplus.
//
//   surplus 2.7 h  →  baseline 7 − 2.7 = 4.3 h  →  5.2 / 4.3 * 50 = 60.5 pts
//   (anything above the baseline keeps flowing into the existing uncapped extra points)
// ==========================================
const SCORING_BASELINE_FLOOR_RATIO = 0.25;              // never score against < 25% of base
const SURPLUS_BOOST_MAX_PTS = { study: 6, steps: 4 };   // "slight": capped, scales with surplus

// Carry into a date from the ledger chain: positive = debt owed, negative = surplus credit.
// Order-independent (takes the latest row strictly before the date).
function getLedgerCarryBefore(dateStr, rows) {
  let bestDate = '';
  let carry = 0;
  (rows || []).forEach((row) => {
    if (!row || !row.date || row.date >= dateStr) return;
    if (row.date < bestDate) return;
    bestDate = row.date;
    carry = Number(row.computed_overflow) || 0;
  });
  return carry;
}

// Everything the grader needs about one module on one date.
function resolveScoringBaseline(dateStr, rows, baseGoalFn, cap) {
  const base = Number(baseGoalFn(dateStr)) || 0;
  const floor = base * SCORING_BASELINE_FLOOR_RATIO;
  const carryBefore = getLedgerCarryBefore(dateStr, rows);
  const row = (rows || []).find(r => r && r.date === dateStr);

  let ledgerTarget;
  if (row && row.computed_target !== undefined && row.computed_target !== null) {
    ledgerTarget = Number(row.computed_target) || 0;
  } else {
    // No row for that date yet: project from the carry, assuming the target is met.
    ledgerTarget = computeOverflowStep(base, carryBefore, null, cap).target;
  }

  const surplus = Math.max(0, -carryBefore);
  return {
    base: base,
    floor: floor,
    ledgerTarget: ledgerTarget,
    baseline: Math.max(floor, ledgerTarget),
    carryBefore: carryBefore,
    surplus: surplus,
    surplusFraction: base > 0 ? Math.min(1, surplus / base) : 0
  };
}

// Proportional surplus boost. Deliberately modest and gated on actual progress, so a
// credit never pays out on a day that was not worked at all.
function computeSurplusBoostPts(surplus, base, ratio, maxPts) {
  const surplusAmount = Number(surplus) || 0;
  const baseAmount = Number(base) || 0;
  const ceiling = Number(maxPts) || 0;
  if (surplusAmount <= 0 || baseAmount <= 0 || ceiling <= 0) return 0;
  const fraction = Math.min(1, surplusAmount / baseAmount);
  const attainment = Math.max(0, Math.min(1, Number(ratio) || 0));
  return ceiling * fraction * attainment;
}

function addDaysToDateStr(dateStr, deltaDays) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + deltaDays);
  return getLocalDateString(d);
}

// Builds the phase ledger for one module (study or steps).
//   • Rows dated BEFORE the phase anchor are archived: still displayed, but isolated (0 spillover).
//   • The Oct 30–31 carryover rows convert their logged value into surplus CREDIT (never debt).
//   • Every calendar day between the anchor and YESTERDAY that has no logged row becomes a
//     synthetic "gap" row, so a skipped day still accrues its full base goal as debt.
//     Gap rows are UI-only (is_gap_day) and are NEVER written back to Supabase.
//
// The anchor is the LATER of the carryover window start and the first row ever logged, so a
// ledger can never inherit bogus debt from days before the tracker existed (no infinite debt).
function buildComputedLedger(dbRows, config) {
  const baseGoalFn = config.baseGoalFn;
  const cap = config.cap;
  const valueField = config.valueField;

  const rows = (Array.isArray(dbRows) ? dbRows : []).filter(r => r && r.date);
  const todayStr = config.todayStr || getLocalDateString(new Date());
  const yesterdayStr = addDaysToDateStr(todayStr, -1);
  const inRealPhase = isRealPhaseActiveNow();

  const firstRowDate = rows.length ? rows[0].date : todayStr;
  const lastRowDate = rows.length ? rows[rows.length - 1].date : yesterdayStr;

  const anchor = inRealPhase
    ? (firstRowDate > CARRYOVER_WINDOW_START_DATE ? firstRowDate : CARRYOVER_WINDOW_START_DATE)
    : firstRowDate;

  // Walk up to the later of "yesterday" and the last logged day: this accounts for a
  // backlog of unlogged days without inventing days in the future.
  const walkEnd = lastRowDate > yesterdayStr ? lastRowDate : yesterdayStr;

  const byDate = new Map();
  rows.forEach(r => byDate.set(r.date, r));

  const out = [];

  // 1. Pre-anchor rows — archived display rows, excluded from the debt chain.
  rows.filter(r => r.date < anchor).forEach(r => {
    out.push({
      ...r,
      is_testing: true,
      is_carryover: false,
      is_gap_day: false,
      computed_target: baseGoalFn(r.date),
      computed_overflow: 0
    });
  });

  // 2. Walk the chain one calendar day at a time.
  let debt = 0;
  let cursor = anchor;
  let guard = 0;
  while (cursor <= walkEnd && guard < 1200) {
    guard += 1;
    const base = baseGoalFn(cursor);
    const row = byDate.get(cursor);

    if (row) {
      if (inRealPhase && isCarryoverWindowDate(cursor)) {
        debt -= Number(row[valueField]) || 0;
        out.push({
          ...row,
          is_testing: false,
          is_carryover: true,
          is_gap_day: false,
          computed_target: base,
          computed_overflow: debt
        });
      } else {
        const step = computeOverflowStep(base, debt, row[valueField], cap);
        debt = step.overflow;
        // v1.3.0 — the displayed target never drops below 25% of the base goal. The score
        // uses the same floor (resolveScoringBaseline), so the ledger column, the
        // "required target today" token and the grade can never disagree. The debt chain
        // itself is untouched: it always uses the raw overflow above.
        const flooredTarget = Math.max(base * SCORING_BASELINE_FLOOR_RATIO, step.target);
        out.push({
          ...row,
          is_testing: !isOfficialLedgerDate(cursor),
          is_carryover: false,
          is_gap_day: false,
          computed_target: flooredTarget,
          computed_overflow: step.overflow
        });
      }
    } else if (cursor <= yesterdayStr) {
      // Skipped day: the full base goal is pushed onto the (uncapped) debt.
      const step = computeOverflowStep(base, debt, 0, cap);
      debt = step.overflow;
      const gapRow = {
        date: cursor,
        source: 'gap',
        is_testing: !isOfficialLedgerDate(cursor),
        is_carryover: false,
        is_gap_day: true,
        computed_target: step.target,
        computed_overflow: step.overflow
      };
      gapRow[valueField] = 0;
      out.push(gapRow);
    }

    cursor = addDaysToDateStr(cursor, 1);
  }

  return out;
}

// ==========================================
// LOCAL READ CACHE (instant first paint + offline read path)
// Ledgers are cached in localStorage purely for display; Supabase is always the
// source of truth and overwrites the cache on the next successful fetch.
// ==========================================

const LEDGER_CACHE_STUDY_KEY = 'autumn_cache_study_ledger';
const LEDGER_CACHE_STEPS_KEY = 'autumn_cache_steps_ledger';

function readRowsCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && Array.isArray(parsed.rows)) ? parsed.rows : null;
  } catch (e) {
    return null;
  }
}

function writeRowsCache(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), rows }));
  } catch (e) {
    // Quota exceeded / private mode — cache is optional, never fatal.
  }
}

// Renders a study dataset (cached or fresh) through the full pipeline, gating hidden DOM.
function applyStudyRows(dbRows) {
  const computedRows = buildComputedLedger(dbRows, {
    baseGoalFn: getStudyBaseGoalForDate,
    cap: MAX_DAILY,
    valueField: 'actual_hours'
  });
  globalStudyRows = computedRows;
  if (isTabActive('study')) {
    updateStudyCalendar(computedRows);
    updateStudyTodayDisplay(computedRows);
    updateStudyTable(computedRows);
    updateStudyPredictions(computedRows);
    updateStudyChart(computedRows);
  } else {
    __dirtyTabs.add('study');
  }
  schedulePostLedgerPipeline();

  return computedRows;
}

function applyStepsRows(dbRows) {
  const computedRows = buildComputedLedger(dbRows, {
    baseGoalFn: getStepsBaseGoalForDate,
    cap: STEPS_MAX_DAILY,
    valueField: 'actual_steps'
  });
  globalStepsRows = computedRows;
  if (isTabActive('steps')) {
    if (typeof updateStepsCalendar === "function") updateStepsCalendar(computedRows);
    if (typeof updateStepsTodayDisplay === "function") updateStepsTodayDisplay(computedRows);
    if (typeof updateStepsTable === "function") updateStepsTable(computedRows);
    if (typeof updateStepsPredictions === "function") updateStepsPredictions(computedRows);
    if (typeof updateStepsChart === "function") updateStepsChart(computedRows);
  } else {
    __dirtyTabs.add('steps');
  }
  schedulePostLedgerPipeline();

  return computedRows;
}

// Paints the last known ledgers immediately so the dashboard is never empty on load
// (and still renders when the device is offline).
function hydrateLedgersFromCache() {
  const cachedStudy = readRowsCache(LEDGER_CACHE_STUDY_KEY);
  const cachedSteps = readRowsCache(LEDGER_CACHE_STEPS_KEY);
  if (cachedStudy && cachedStudy.length) applyStudyRows(cachedStudy);
  if (cachedSteps && cachedSteps.length) applyStepsRows(cachedSteps);
}

async function fetchAndRenderStudy() {
  const { data: rows, error } = await supabaseClient
    .from('study_ledger')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.warn('Study ledger fetch warning:', error.message);
    return;
  }

  writeRowsCache(LEDGER_CACHE_STUDY_KEY, rows || []);
  applyStudyRows(rows);
}


// Checks whether a YYYY-MM-DD date falls on the last 2 days of its calendar month
function isLastTwoDaysOfMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() >= (lastDay - 1);
}

// Computes the monthly accumulated study hours for a target month (starting Nov 2026+),
// automatically adding hours logged on the last 2 days of the previous month (Oct 30–31) as a carryover bonus.
function computeMonthlyStudyWithBonus(rows, refDateObj) {
  let y = refDateObj.getFullYear();
  let m = refDateObj.getMonth(); // 0 = Jan ... 9 = Oct, 10 = Nov
  // Anchor monthly accumulation display to Nov 2026 if viewing Oct 2026
  if (y < 2026 || (y === 2026 && m < 10)) {
    y = 2026;
    m = 10; // November 2026
  }

  const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
  const prevDate = new Date(y, m - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const monthName = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  let baseMonthHours = 0;
  let bonusHoursFromPrevEnd = 0;

  (rows || []).forEach(r => {
    const hrs = Number(r.actual_hours) || 0;
    if (r.date.startsWith(monthKey)) {
      baseMonthHours += hrs;
    } else if (r.date.startsWith(prevMonthKey) && isLastTwoDaysOfMonth(r.date)) {
      bonusHoursFromPrevEnd += hrs;
    }
  });

  return {
    monthKey,
    monthName,
    baseMonthHours,
    bonusHours: bonusHoursFromPrevEnd,
    totalMonthlyHours: baseMonthHours + bonusHoursFromPrevEnd
  };
}

function updateStudyStats(rows) {
  const monthlyInfo = computeMonthlyStudyWithBonus(rows, currentStudyCalDate);
  const lblEl = document.getElementById('stat-total-label');
  const bonusEl = document.getElementById('stat-bonus-pill');
  const subEl = document.getElementById('stat-total-sub');
  const cumNovBadge = document.getElementById('study-cum-nov-badge');

  // Secondary total: cumulative study from Nov 2026 onwards (including Oct 30–31 carryover bonus)
  const cumFromNovHours = (rows || [])
    .filter(r => r.date >= CARRYOVER_WINDOW_START_DATE)
    .reduce((acc, r) => acc + (Number(r.actual_hours) || 0), 0);

  if (lblEl) lblEl.textContent = `MONTHLY HOURS (${monthlyInfo.monthName})`;
  if (bonusEl) {
    bonusEl.textContent = `+${formatHours(monthlyInfo.bonusHours)} bonus`;
  }
  if (subEl) {
    subEl.textContent = `${formatHours(monthlyInfo.baseMonthHours)} in-month + ${formatHours(monthlyInfo.bonusHours)} 2d bonus • Since Nov: ${formatHours(cumFromNovHours)}`;
  }
  if (cumNovBadge) {
    cumNovBadge.textContent = `TOTAL FROM NOV 2026: ${formatHours(cumFromNovHours)}`;
  }

  const activeRows = getPhaseActiveRows(rows);
  // Gap rows (days never logged) carry debt arithmetic only — they must not skew
  // "AVG/DAY" or "BEST DAY", which describe actual study sessions.
  const loggedRows = activeRows.filter(r => !r.is_gap_day);
  const phaseTotal = activeRows.reduce((acc, r) => acc + (Number(r.actual_hours) || 0), 0);
  const displayTotal = monthlyInfo.totalMonthlyHours > 0 ? monthlyInfo.totalMonthlyHours : phaseTotal;
  document.getElementById('stat-total').textContent = formatHours(displayTotal);

  if (loggedRows.length === 0) {
    document.getElementById('stat-avg').textContent = "0h 0m";
    document.getElementById('stat-best').textContent = "0h 0m";
    return;
  }
  let totalHours = 0;
  let bestDay = 0;
  loggedRows.forEach(r => {
    totalHours += r.actual_hours;
    if (r.actual_hours > bestDay) bestDay = r.actual_hours;
  });
  const avg = totalHours / loggedRows.length;
  document.getElementById('stat-avg').textContent = formatHours(avg);
  document.getElementById('stat-best').textContent = formatHours(bestDay);
}

function updateStudyCalendar(rows) {
  updateStudyStats(rows);
  const container = document.getElementById('calendar-grid');
  container.innerHTML = '';

  const dataMap = {};
  // Only paint days that belong to the active phase — otherwise archived "testing
  // phase" rows stay visible on the heatmap while the KPI cards exclude them.
  getPhaseActiveRows(rows).forEach(r => dataMap[r.date] = r.actual_hours);

  const currentMonth = currentStudyCalDate.getMonth();
  const currentYear = currentStudyCalDate.getFullYear();

  document.getElementById('month-display').textContent =
    currentStudyCalDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  const todayStr = getLocalDateString(new Date());
  const firstDay = new Date(currentYear, currentMonth, 1);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  let weekCounter = 1;

  for (let i = 0; i < startingDayOfWeek; i++) {
    if (i === 0) {
      const weekLabel = document.createElement('div');
      weekLabel.className = 'cal-week-label';
      weekLabel.textContent = `W${weekCounter}`;
      container.appendChild(weekLabel);
    }
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'cal-day-box empty';
    container.appendChild(emptyDiv);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(currentYear, currentMonth, day);
    const dateString = getLocalDateString(d);
    const hours = dataMap[dateString] || 0;
    const dayOfWeek = d.getDay();

    if (dayOfWeek === 0) {
      const weekLabel = document.createElement('div');
      weekLabel.className = 'cal-week-label';
      weekLabel.textContent = `W${weekCounter}`;
      container.appendChild(weekLabel);
      weekCounter++;
    }

    const dayBox = document.createElement('div');
    dayBox.className = 'cal-day-box';
    dayBox.title = `${dateString}: ${formatHours(hours)}`;

    if (dateString === todayStr) dayBox.classList.add('today');

    if (hours === 0) dayBox.classList.add('level-0');
    else if (hours <= 2) dayBox.classList.add('level-1');
    else if (hours <= 4) dayBox.classList.add('level-2');
    else if (hours <= 6) dayBox.classList.add('level-3');
    else dayBox.classList.add('level-4');

    const timeStr = formatHMM(hours);
    dayBox.innerHTML = `
      <span class="cal-date-num">${day}</span>
      ${timeStr ? `<span class="cal-time-text">${timeStr}</span>` : ''}
    `;
    container.appendChild(dayBox);
  }
}

function updateStudyTodayDisplay(rows) {
  const todayStr = getLocalDateString(new Date());
  const activeRows = getPhaseActiveRows(rows);
  const todayRow = activeRows.find(r => r.date === todayStr);
  const todayBaseGoal = getStudyBaseGoalForDate(todayStr);
  const actual = todayRow ? todayRow.actual_hours : 0;

  let target = todayBaseGoal;
  let overflow = 0;

  if (todayRow) {
    target = todayRow.computed_target;
    overflow = todayRow.computed_overflow;
  } else {
    const lastRow = getLatestLedgerRowUpTo(activeRows, todayStr);
    if (lastRow) {
      const lastDebt = Number(lastRow.computed_overflow) || 0;
      target = computeOverflowStep(todayBaseGoal, lastDebt, null, MAX_DAILY).target;
      overflow = lastDebt;
    }
  }

  document.getElementById('today-target').textContent = target.toFixed(1);

  let overflowText = overflow > 0 ? `DEBT: +${formatHours(overflow)}`
                   : overflow < 0 ? `SURPLUS: ${formatHours(overflow)}`
                   : `ON TRACK`;

  const phaseTag = isCarryoverWindowDate(todayStr)
    ? ' // CARRIES OVER TO NOV 1'
    : !isOfficialLedgerDate(todayStr)
      ? ' // TESTING PHASE'
      : '';

  document.getElementById('today-actual').textContent =
    `actual: ${formatHours(actual)} (base ${todayBaseGoal}h) // ${overflowText}${phaseTag}`;
}

// ── Ledger windowing ────────────────────────────────────────────────────
// The deficit ledgers walk the phase day-by-day (the chain is capped at 1,200 days) and
// every save re-rendered every row. The operator can cap a table to its newest N rows.
// Default is ALL, so CSV/MD/JSON export and print keep the complete history unless the
// operator explicitly narrows the view.
const LEDGER_WINDOW_KEY = 'autumn_ledger_window_days';
let ledgerWindowDays = 0; // 0 = every row
let lastStudyTableRows = [];
let lastStepsTableRows = [];
try {
  const savedWindow = parseInt(safeStorage.getItem(LEDGER_WINDOW_KEY), 10);
  if (Number.isFinite(savedWindow) && savedWindow >= 0) ledgerWindowDays = savedWindow;
} catch (e) {}

function applyLedgerWindow(newestFirstRows) {
  if (!ledgerWindowDays || ledgerWindowDays <= 0) return newestFirstRows;
  return newestFirstRows.slice(0, ledgerWindowDays);
}

function updateLedgerWindowButtons() {
  const label = ledgerWindowDays > 0 ? `◧ WINDOW: ${ledgerWindowDays}D` : '◧ WINDOW: ALL';
  ['study-ledger-window-btn', 'steps-ledger-window-btn'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (btn.textContent !== label) btn.textContent = label;
    btn.setAttribute('aria-pressed', ledgerWindowDays > 0 ? 'true' : 'false');
    btn.title = ledgerWindowDays > 0
      ? `Showing the newest ${ledgerWindowDays} rows — exports follow the visible rows. Click for the full history.`
      : 'Showing every row. Click to cap the table at the newest 60 rows (faster on long phases).';
  });
}

function toggleLedgerWindow() {
  ledgerWindowDays = ledgerWindowDays > 0 ? 0 : 60;
  safeStorage.setItem(LEDGER_WINDOW_KEY, String(ledgerWindowDays));
  updateStudyTable(lastStudyTableRows);
  updateStepsTable(lastStepsTableRows);
  updateLedgerWindowButtons();
  showToast('LEDGER WINDOW', ledgerWindowDays > 0
    ? `Tables capped to the newest ${ledgerWindowDays} rows. Exports and print follow the visible rows.`
    : 'Showing the full ledger history again.');
}

function updateStudyTable(rows) {
  lastStudyTableRows = rows;
  const tbody = document.querySelector('#ledger-table tbody');
  tbody.innerHTML = '';

  const activeRows = getPhaseActiveRows(rows);
  if (activeRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-[#56735f]">No study days logged yet.</td></tr>`;
    updateLedgerWindowButtons();
    return;
  }

  // Windowing keeps the DOM small on long phases (see toggleLedgerWindow above).
  const reversedRows = applyLedgerWindow([...activeRows].reverse());
  updateLedgerWindowButtons();
  const frag = document.createDocumentFragment();
  reversedRows.forEach(row => {
    const tr = document.createElement('tr');
    const isPassUsed = row.source === 'pass_redeemed' || (typeof isPassUsedOnDate === 'function' && isPassUsedOnDate(row.date, 'study'));
    if (isPassUsed) {
      tr.className = 'bg-[#fef3c7]/65 border-l-4 border-l-[#f59e0b]';
    }

    let badgeHtml = '';
    const carryTag = row.is_carryover ? ` <span class="tech-badge badge-blue !text-[9px]">→ NOV CARRYOVER</span>` : '';
    const passUsedTag = isPassUsed ? ` <span class="tech-badge badge-amber !text-[9px]">PASS USED (INELIGIBLE)</span>` : '';
    // Synthetic row for a day that was never logged: the base goal was still added to debt.
    const gapTag = row.is_gap_day ? ` <span class="tech-badge badge-neutral !text-[9px]" title="No entry recorded for this day — its base goal was added to your debt">○ NO LOG</span>` : '';

    if (row.computed_overflow > 0) {
      badgeHtml = `<span class="tech-badge badge-red">DEBT +${formatHours(row.computed_overflow)}</span>${carryTag}${passUsedTag}${gapTag}`;
    } else if (row.computed_overflow < 0) {
      badgeHtml = `<span class="tech-badge badge-green">SURPLUS ${formatHours(row.computed_overflow)}</span>${carryTag}${passUsedTag}${gapTag}`;
    } else {
      badgeHtml = `<span class="tech-badge badge-blue">ON TRACK</span>${carryTag}${passUsedTag}${gapTag}`;
    }

    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${formatHours(row.actual_hours)}</td>
      <td>${formatHours(row.computed_target)}</td>
      <td class="flex flex-wrap items-center gap-1">${badgeHtml}</td>
    `;
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  if (window.umAtlas && typeof window.umAtlas.attachLedgerInlineEditing === 'function') {
    window.umAtlas.attachLedgerInlineEditing('study');
  }
  if (window.umAtlas && typeof window.umAtlas.renderStudyCourseHubStrip === 'function') {
    window.umAtlas.renderStudyCourseHubStrip();
  }
}

// 7-day debt projection. Model (per spec): the DAILY TARGET is capped at MAX_DAILY both
// while logged and while forecasting, but the underlying DEBT compounds uncapped.
// When today already has a logged row we take that row's target/debt as authoritative
// instead of re-deriving them (this previously produced a "TODAY" target that disagreed
// with the deficit ledger, and seeded the chain from a future-dated row if one existed).
function updateStudyPredictions(rows) {
  const tbody = document.querySelector('#prediction-table tbody');
  tbody.innerHTML = '';

  const activeRows = getPhaseActiveRows(rows);
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const todayRow = activeRows.find(r => r.date === todayStr) || null;
  const latestRow = getLatestLedgerRowUpTo(activeRows, todayStr);

  let currentOverflow = latestRow ? (Number(latestRow.computed_overflow) || 0) : 0;

  for (let i = 0; i < 7; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + i);
    const dateStr = getLocalDateString(futureDate);
    const dayBaseGoal = getStudyBaseGoalForDate(futureDate);

    let target;
    if (i === 0 && todayRow) {
      // Today is already logged — mirror the ledger exactly.
      // NOTE: a legitimate 0h target (fully covered by surplus credit) must NOT fall
      // back to the base goal, so check for a finite number rather than truthiness.
      const loggedTarget = Number(todayRow.computed_target);
      target = Number.isFinite(loggedTarget) ? loggedTarget : dayBaseGoal;
      currentOverflow = Number(todayRow.computed_overflow) || 0;
    } else {
      // Forecast variant: assume the target is met (actual === target).
      const step = computeOverflowStep(dayBaseGoal, currentOverflow, null, MAX_DAILY);
      target = step.target;
      currentOverflow = step.overflow;
    }

    const tr = document.createElement('tr');
    const dayName = i === 0 ? "TODAY" : i === 1 ? "TOMORROW" : futureDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

    tr.innerHTML = `
      <td>${dayName} <span class="text-[#56735f]">(${dateStr.slice(5)})</span></td>
      <td class="text-right font-bold text-[#047857]">${target.toFixed(1)}h</td>
    `;
    tbody.appendChild(tr);
  }
}


function updateStudyChart(allRows) {
  if (!isTabActive('study')) {
    __dirtyTabs.add('study');
    return;
  }
  if (!window.AutumnCharts || typeof window.AutumnCharts.renderCumulativeChart !== 'function') return;
  const rows = getPhaseActiveRows(allRows);
  const labels = rows.map(r => r.date.slice(5));
  const expectedCumulative = [];
  const actualCumulative = [];
  const idealCumulative = [];
  let expSum = 0;
  let actSum = 0;
  let idealSum = 0;
  rows.forEach((r) => {
    expSum += r.computed_target;
    actSum += r.actual_hours;
    idealSum += getStudyBaseGoalForDate(r.date);
    expectedCumulative.push(expSum);
    actualCumulative.push(actSum);
    idealCumulative.push(idealSum);
  });
  studyChartInstance = window.AutumnCharts.renderCumulativeChart('studyChart', {
    labels,
    datasets: [
      { label: 'Baseline (7h wkday / 5h wkend)', shortLabel: 'Baseline', data: idealCumulative, color: '#718f80', dash: '4,4', width: 1.5 },
      { label: 'Target Quota', shortLabel: 'Target', data: expectedCumulative, color: '#059669', dash: '5,5', width: 2, stepped: true },
      { label: 'Actual Studied', shortLabel: 'Actual', data: actualCumulative, color: '#10b981', fill: true, width: 2.5, stepped: true }
    ],
    formatValue: (v) => formatHours(v)
  });
}

onReady('study-entry-form', 'submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to log study hours.', true);

  const date = document.getElementById('date-input').value;
  const h = parseFloat(document.getElementById('hours-input').value) || 0;
  const m = parseFloat(document.getElementById('mins-input').value) || 0;
  const s = parseFloat(document.getElementById('secs-input').value) || 0;
  const decimalHours = h + (m / 60) + (s / 3600);

  if (!date) return;

  const { error } = await supabaseClient
    .from('study_ledger')
    .upsert({
      date,
      actual_hours: decimalHours,
      target_hours: getStudyBaseGoalForDate(date),
      source: 'manual'
    }, { onConflict: 'date' });

  if (error) {
    // TOOLS-HUB (T1.2): a connectivity failure is journalled and replayed on reconnect.
    if (queueWriteIfOffline(error, 'study_ledger', {
      date: date,
      actual_hours: decimalHours,
      target_hours: getStudyBaseGoalForDate(date),
      source: 'manual'
    }, 'date')) return;
    showToast('DATABASE ERROR', error.message, true);
  } else {
    if (typeof clearPassUsedLockForDate === 'function') clearPassUsedLockForDate(date, 'study');
    document.getElementById('hours-input').value = '';
    document.getElementById('mins-input').value = '';
    document.getElementById('secs-input').value = '';
    showToast('STUDY LOG SAVED', `Recorded ${formatHours(decimalHours)} for ${date}.`);
    fetchAndRenderStudy();
  }
});

onReady('reset-study-btn', 'click', () => {
  if (!currentUser) return;
  confirmAction(
    'Purge All Study Ledger Data?',
    'This will permanently delete all recorded rows in study_ledger. This cannot be undone.',
    async () => {
      const { error } = await supabaseClient.from('study_ledger').delete().neq('date', '1900-01-01');
      if (error) showToast('RESET ERROR', error.message, true);
      else {
        showToast('STUDY LEDGER PURGED', 'All study records cleared.');
        fetchAndRenderStudy();
      }
    }
  );
});

onReady('prev-month', 'click', () => {
  currentStudyCalDate.setMonth(currentStudyCalDate.getMonth() - 1);
  updateStudyCalendar(globalStudyRows);
});

onReady('next-month', 'click', () => {
  currentStudyCalDate.setMonth(currentStudyCalDate.getMonth() + 1);
  updateStudyCalendar(globalStudyRows);
});


async function fetchAndRenderSteps() {
  const { data: rows, error } = await supabaseClient
    .from('steps_ledger')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.warn('Steps ledger fetch note:', error.message);
  }

  writeRowsCache(LEDGER_CACHE_STEPS_KEY, rows || []);
  applyStepsRows(rows);
}

// Computes monthly accumulated steps for a target month (starting Nov 2026+),
// automatically adding steps logged on the last 2 days of the previous month as a bonus.

// ==========================================
// 8. TAB 3: GOOGLE CALENDAR SYNC, PRIORITY COLOURS & ±2M WINDOW CONTROL
// ==========================================
const GCAL_MANUAL_MONTHS_DATE_KEY = '1970-01-05';
let globalEventColorMap = {};       // eventId -> 'GREEN' | 'YELLOW' | 'RED'
let manualCalendarMonths = [];      // array of 'YYYY-MM' strings manually included outside ±2M
let activeModalEventId = null;

const EVENT_PRIORITY_THEMES = {
  RED: {
    label: 'HIGH // CLASS / COMP',
    badgeClass: 'badge-red',
    bg: '#fee2e2',
    border: '#fca5a5',
    accent: '#dc2626',
    title: '#7f1d1d',
    meta: '#991b1b',
    pillBg: '#fecaca',
    dot: '#ef4444'
  },
  YELLOW: {
    label: 'MEDIUM PRIORITY',
    badgeClass: 'badge-amber',
    bg: '#fef3c7',
    border: '#fcd34d',
    accent: '#d97706',
    title: '#78350f',
    meta: '#92400e',
    pillBg: '#fde68a',
    dot: '#f59e0b'
  },
  GREEN: {
    label: 'LOW // OWN PLANS',
    badgeClass: 'badge-green',
    bg: '#dcfce7',
    border: '#86efac',
    accent: '#059669',
    title: '#064e3b',
    meta: '#047857',
    pillBg: '#bbf7d0',
    dot: '#10b981'
  }
};

function getEventPriorityColor(evOrId) {
  const id = typeof evOrId === 'string' ? evOrId : evOrId?.id;
  const color = (id && globalEventColorMap[id]) || (typeof evOrId === 'object' && evOrId?.priorityColor) || 'GREEN';
  return ['RED', 'YELLOW', 'GREEN'].includes(color) ? color : 'GREEN';
}

function getEventPriorityTheme(evOrId) {
  return EVENT_PRIORITY_THEMES[getEventPriorityColor(evOrId)] || EVENT_PRIORITY_THEMES.GREEN;
}

// Returns the automatic ±2 months (60 days before and 60 days after today) bounds
function getAutoCalendarBounds(refDate = new Date()) {
  const minDate = new Date(refDate);
  minDate.setHours(0, 0, 0, 0);
  minDate.setDate(minDate.getDate() - 60);

  const maxDate = new Date(refDate);
  maxDate.setHours(23, 59, 59, 999);
  maxDate.setDate(maxDate.getDate() + 60);

  return {
    minDate,
    maxDate,
    minDateStr: getLocalDateString(minDate),
    maxDateStr: getLocalDateString(maxDate)
  };
}

function getMonthKeyFromDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function isMonthWithinAutoWindow(monthKey, refDate = new Date()) {
  if (!monthKey) return true;
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return true;
  const monthStart = new Date(y, m - 1, 1, 0, 0, 0);
  const monthEnd = new Date(y, m, 0, 23, 59, 59);
  const { minDate, maxDate } = getAutoCalendarBounds(refDate);
  return monthEnd >= minDate && monthStart <= maxDate;
}


async function loadSavedGCalCredentials() {
  // SECURITY: the reserved 1970-01-01 row holds the owner's Google API key. It must
  // never be fetched for — or rendered into the DOM for — an unauthenticated visitor.
  // Guests render the calendar from the cached calendar_events_cache rows instead,
  // which is exactly the read-only experience this app is designed around.
  const isOwner = Boolean(currentUser);

  const [credRes, manualRes, cacheRes] = await Promise.all([
    isOwner
      ? supabaseClient.from('daily_notes').select('*').eq('date', GCAL_CONFIG_DATE_KEY).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseClient.from('daily_notes').select('*').eq('date', GCAL_MANUAL_MONTHS_DATE_KEY).maybeSingle(),
    supabaseClient.from('calendar_events_cache').select('*')
  ]);

  if (isOwner && credRes.data && credRes.data.content) {
    try {
      const parsed = JSON.parse(credRes.data.content);
      if (parsed.calendarId) GOOGLE_CALENDAR_ID = parsed.calendarId;
      if (parsed.apiKey) GOOGLE_API_KEY = parsed.apiKey;
    } catch (e) {
      console.warn('Could not parse saved GCal config:', e);
    }
  }

  if (manualRes.data && manualRes.data.content) {
    try {
      const parsedM = JSON.parse(manualRes.data.content);
      if (Array.isArray(parsedM.months)) {
        manualCalendarMonths = parsedM.months;
      }
    } catch (e) {}
  }

  if (cacheRes.data && Array.isArray(cacheRes.data)) {
    cacheRes.data.forEach(row => {
      if (row.event_id && row.priority_color) {
        globalEventColorMap[row.event_id] = row.priority_color;
      }
      if (row.is_manual_month && row.month_key && !manualCalendarMonths.includes(row.month_key)) {
        manualCalendarMonths.push(row.month_key);
      }
    });
  }

  // Never echo credentials into the DOM for a guest: the inputs stay in the document
  // even while the owner-only modal is disabled, so a value here is a readable secret.
  const gcalIdInput = document.getElementById('gcal-id-input');
  const gcalKeyInput = document.getElementById('gcal-key-input');
  if (gcalIdInput) gcalIdInput.value = isOwner ? (GOOGLE_CALENDAR_ID || '') : '';
  if (gcalKeyInput) gcalKeyInput.value = isOwner ? (GOOGLE_API_KEY || '') : '';
  if (typeof renderManualMonthsBadges === "function") renderManualMonthsBadges();
}

async function fetchGoogleCalendarSegment(timeMinIso, timeMaxIso) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?key=${encodeURIComponent(GOOGLE_API_KEY)}&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMinIso)}&timeMax=${encodeURIComponent(timeMaxIso)}&maxResults=500`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch Google Calendar events');
  }
  return data.items || [];
}

async function fetchGoogleCalendarEvents(showManualFeedback = false) {
  const badgeEl = document.getElementById('gcal-sync-badge');

  // Always pull latest saved priority colours from Supabase cache first so guests & owner see them
  const { data: cachedRows } = await supabaseClient
    .from('calendar_events_cache')
    .select('*');

  if (Array.isArray(cachedRows)) {
    cachedRows.forEach(r => {
      if (r.event_id && r.priority_color) {
        globalEventColorMap[r.event_id] = r.priority_color;
      }
      if (r.is_manual_month && r.month_key && !manualCalendarMonths.includes(r.month_key)) {
        manualCalendarMonths.push(r.month_key);
      }
    });
    if (typeof renderManualMonthsBadges === "function") renderManualMonthsBadges();
  }

  if (!GOOGLE_API_KEY || !GOOGLE_CALENDAR_ID) {
    // Fallback to cached Supabase rows if API key isn't present
    if (Array.isArray(cachedRows) && cachedRows.length > 0) {
      globalCalendarEvents = cachedRows.map(r => ({
        id: r.event_id,
        title: r.title || 'Untitled Event',
        description: r.description || '',
        location: r.location || '',
        htmlLink: r.html_link || '',
        start: new Date(r.start_time),
        end: new Date(r.end_time),
        isAllDay: Boolean(r.is_all_day),
        dateStr: r.date_str,
        priorityColor: r.priority_color || 'GREEN'
      })).sort((a, b) => a.start - b.start);
      badgeEl.className = 'tech-badge badge-green';
      badgeEl.textContent = 'CACHED // SUPABASE';
    } else {
      badgeEl.className = 'tech-badge badge-amber';
      badgeEl.textContent = 'AWAITING API KEY';
      globalCalendarEvents = [];
    }
    updateNavbarAndRadarTelemetry();
    if (typeof renderCalendarViewport === "function") renderCalendarViewport();
    return;
  }

  try {
    badgeEl.className = 'tech-badge badge-blue';
    badgeEl.textContent = 'SYNCING...';

    // 1. Fetch automatic ±2 months window (60 days before to 60 days after today)
    const { minDate, maxDate } = getAutoCalendarBounds(new Date());
    const segmentsPromises = [
      fetchGoogleCalendarSegment(minDate.toISOString(), maxDate.toISOString())
    ];

    // 2. Also fetch any manually included months outside ±2M
    manualCalendarMonths.forEach(mKey => {
      if (!isMonthWithinAutoWindow(mKey)) {
        const [y, m] = mKey.split('-').map(Number);
        if (y && m) {
          const mStart = new Date(y, m - 1, 1, 0, 0, 0);
          const mEnd = new Date(y, m, 0, 23, 59, 59);
          segmentsPromises.push(
            fetchGoogleCalendarSegment(mStart.toISOString(), mEnd.toISOString())
          );
        }
      }
    });

    const segmentsResults = await Promise.all(segmentsPromises);
    const mergedRawMap = {};
    segmentsResults.flat().forEach(item => {
      if (item && item.id) mergedRawMap[item.id] = item;
    });

    const rawItems = Object.values(mergedRawMap);
    globalCalendarEvents = rawItems
      .filter(item => {
        if (item.status === 'cancelled') return false;
        if (item.eventType && item.eventType !== 'default') return false;
        return Boolean(item.start && (item.start.dateTime || item.start.date));
      })
      .map(item => {
        const isAllDay = Boolean(item.start.date && !item.start.dateTime);
        const startObj = isAllDay
          ? new Date(item.start.date + 'T00:00:00')
          : new Date(item.start.dateTime);

        // NOTE: Google returns `end.date` EXCLUSIVE for date-only (all-day) events.
        // A single-day all-day event on Nov 5 has start 2026-11-05 and end 2026-11-06.
        // We therefore subtract 1ms so the event truly ends at 23:59:59.999 on its final
        // day instead of bleeding into (and being reported as ONGOING throughout) the
        // following day in the radar, status badges, agenda window and Supabase cache.
        let endObj;
        if (item.end?.dateTime) {
          endObj = new Date(item.end.dateTime);
        } else if (item.end?.date) {
          const exclusiveEnd = new Date(item.end.date + 'T00:00:00');
          endObj = new Date(exclusiveEnd.getTime() - 1);
          // Guard against malformed payloads where end <= start
          if (!(endObj.getTime() > startObj.getTime())) {
            endObj = new Date(startObj.getTime() + 3600000);
          }
        } else {
          endObj = new Date(startObj.getTime() + 3600000);
        }

        return {
          id: item.id,
          title: item.summary || 'Untitled Event',
          description: item.description || '',
          location: item.location || '',
          htmlLink: item.htmlLink || '',
          start: startObj,
          end: endObj,
          isAllDay,
          dateStr: getLocalDateString(startObj),
          priorityColor: globalEventColorMap[item.id] || 'GREEN'
        };
      })
      .sort((a, b) => a.start - b.start);

    // Sync & prune ±2M window in Supabase
    if (typeof pruneAndSyncCalendarCacheInSupabase === "function") await pruneAndSyncCalendarCacheInSupabase(globalCalendarEvents, showManualFeedback);

    badgeEl.className = 'tech-badge badge-green';
    badgeEl.textContent = 'LIVE // ±2M SYNCED';
    document.getElementById('gcal-last-sync-text').textContent =
      `Last synced: ${new Date().toLocaleTimeString('en-US', { hour12: false })}`;

    if (showManualFeedback) {
      showToast('CALENDAR SYNCED', `Synced ${globalCalendarEvents.length} events (±2M window + ${manualCalendarMonths.length} manual month(s)).`);
    }
  } catch (err) {
    console.warn('Google Calendar sync error:', err.message);
    badgeEl.className = 'tech-badge badge-red';
    badgeEl.textContent = 'SYNC ERROR';
    if (showManualFeedback) {
      showToast('CALENDAR SYNC ERROR', err.message, true);
    }
  }

  updateNavbarAndRadarTelemetry();
  if (typeof renderCalendarViewport === "function") renderCalendarViewport();
}

function updateNavbarAndRadarTelemetry() {
  const now = new Date();
  const navContainer = document.getElementById('navbar-events-container');
  const sidebarRadar = document.getElementById('cal-sidebar-radar');
  if (!navContainer) return;

  const ongoingEvents = [];
  const upcomingSoonEvents = [];
  const upcomingCampusWalkEvents = [];

  globalCalendarEvents.forEach(ev => {
    const diffStartMs = ev.start - now;
    const diffEndMs = ev.end - now;
    const umInfo = (window.umAtlas && typeof window.umAtlas.resolveEventUmTelemetry === 'function')
      ? window.umAtlas.resolveEventUmTelemetry(ev, now)
      : null;

    if (now >= ev.start && now < ev.end) {
      const elapsedMins = Math.max(1, Math.floor((now - ev.start) / 60000));
      const leftMins = Math.max(1, Math.ceil(diffEndMs / 60000));
      ongoingEvents.push({ ...ev, elapsedMins, leftMins, umInfo });
    } else if (diffStartMs > 0 && diffStartMs <= 60 * 60 * 1000) {
      const inMins = Math.max(1, Math.ceil(diffStartMs / 60000));
      upcomingSoonEvents.push({ ...ev, inMins, umInfo });
    } else if (umInfo && diffStartMs > 60 * 60 * 1000 && diffStartMs <= 8 * 60 * 60 * 1000) {
      const inMins = Math.max(1, Math.ceil(diffStartMs / 60000));
      upcomingCampusWalkEvents.push({ ...ev, inMins, umInfo });
    }
  });

  maybeNotifyUpcomingEvents(upcomingSoonEvents);
  const todayStr = getLocalDateString(now);
  const nextWeek = new Date(now.getTime() + 7 * 86400000);
  const todayCount = globalCalendarEvents.filter(e => e.dateStr === todayStr).length;
  const weekCount = globalCalendarEvents.filter(e => e.end >= now && e.start <= nextWeek).length;
  const statTodayEl = document.getElementById('cal-stat-today');
  const statWeekEl = document.getElementById('cal-stat-week');
  if (statTodayEl) statTodayEl.textContent = todayCount;
  if (statWeekEl) statWeekEl.textContent = weekCount;

  if (ongoingEvents.length === 0 && upcomingSoonEvents.length === 0 && upcomingCampusWalkEvents.length === 0) {
    navContainer.innerHTML = `
      <button onclick="switchTab('calendar')" class="tech-badge badge-neutral hover:border-[#059669] cursor-pointer" title="Open Calendar Tab">
        <span class="w-1.5 h-1.5 bg-[#718f80] inline-block"></span>
        <span>NO UPCOMING EVENTS</span>
      </button>
    `;
    if (sidebarRadar) {
      sidebarRadar.innerHTML = `<div class="font-mono-tech text-xs text-[#56735f] text-center py-2">No ongoing or upcoming events within 60m.</div>`;
    }
    if (window.umAtlas && typeof window.umAtlas.renderCalendarCommuteStrip === 'function') window.umAtlas.renderCalendarCommuteStrip();
    if (window.umAtlas && typeof window.umAtlas.renderStudyCourseHubStrip === 'function') window.umAtlas.renderStudyCourseHubStrip();
    return;
  }

  const navPillsHtml = [];
  const radarCardsHtml = [];
  const walkSvg = (window.autumnIcons && window.autumnIcons.svg('walk')) || '';
  const routeSvg = (window.autumnIcons && window.autumnIcons.svg('route')) || '';

  ongoingEvents.forEach(ev => {
    const theme = getEventPriorityTheme(ev);
    const um = ev.umInfo;
    const destTxt = um ? escapeHtml(um.displayDestLabel || um.dest.title.split('(')[0].trim()) : '';
    const walkSuffix = um ? ` · ${um.walkMins}m to ${destTxt}` : '';
    navPillsHtml.push(`
      <div class="inline-flex flex-wrap items-center gap-1 max-w-full min-w-0">
        <button onclick="openEventDetails('${jsAttrQuote(ev.id)}')" class="tech-badge bg-[#065f46] text-white border-[#047857] cursor-pointer max-w-full sm:max-w-[400px] min-w-0 overflow-hidden" title="Click to view event details">
          <span class="w-1.5 h-1.5 bg-[#34d399] inline-block pulse-live shrink-0"></span>
          <span class="truncate block">NOW (${ev.leftMins}m left): ${escapeHtml(ev.title)}${walkSuffix}</span>
        </button>
        ${um ? `<a href="${escapeHtml(um.deepLinkUrl)}" target="_blank" rel="noopener noreferrer" class="um-atlas-route-btn shrink-0" title="Open exact walking route in UM 3D Atlas">${routeSvg}<span>3D ROUTE</span></a>` : ''}
      </div>
    `);
    radarCardsHtml.push(`
      <div style="background-color:${theme.bg}; border-color:${theme.border};" class="p-2.5 border text-xs font-mono-tech">
        <div class="flex items-center justify-between gap-2" style="color:${theme.meta};">
          <span>ONGOING (${ev.elapsedMins}m in)</span>
          <span>${ev.leftMins}m left</span>
        </div>
        <div class="text-[#0c1f17] mt-1 break-words">${escapeHtml(ev.title)}</div>
        ${um ? window.umAtlas.buildEventUmWalkInlineHtml(ev, true) : ''}
        <div class="flex items-center justify-between gap-2 mt-2">
          <span class="text-[10px] text-[#436152] truncate">${escapeHtml(ev.location || formatEventTimeSpan(ev))}</span>
          <button type="button" onclick="openEventDetails('${jsAttrQuote(ev.id)}')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]">Details</button>
        </div>
      </div>
    `);
  });

  upcomingSoonEvents.concat(upcomingCampusWalkEvents.slice(0, 2)).forEach(ev => {
    const theme = getEventPriorityTheme(ev);
    const um = ev.umInfo;
    const timeTag = ev.inMins >= 60 ? `IN ${(ev.inMins / 60).toFixed(1)}h` : `IN ${ev.inMins}m`;
    const destTxt = um ? escapeHtml(um.displayDestLabel || um.dest.title.split('(')[0].trim()) : '';
    const walkInfoText = um
      ? ` · ${destTxt} · ${um.walkMins}m (${escapeHtml(um.leaveStatusLabel)})`
      : '';
    navPillsHtml.push(`
      <div class="inline-flex flex-wrap items-center gap-1 max-w-full min-w-0">
        <button onclick="openEventDetails('${jsAttrQuote(ev.id)}')" class="tech-badge ${theme.badgeClass} cursor-pointer max-w-full sm:max-w-[440px] min-w-0 overflow-hidden" title="Click to view event & walking telemetry">
          <span class="w-1.5 h-1.5 inline-block pulse-live shrink-0" style="background-color:${theme.dot};"></span>
          <span class="truncate block">${timeTag}: ${escapeHtml(ev.title)}${walkInfoText}</span>
        </button>
        ${um ? `<a href="${escapeHtml(um.deepLinkUrl)}" target="_blank" rel="noopener noreferrer" class="um-atlas-route-btn shrink-0" title="Open walking route in UM 3D Atlas">${routeSvg}<span>3D ROUTE</span></a>` : ''}
      </div>
    `);
    radarCardsHtml.push(`
      <div style="background-color:${theme.bg}; border-color:${theme.border};" class="p-2.5 border text-xs font-mono-tech">
        <div class="flex items-center justify-between gap-2" style="color:${theme.meta};">
          <span>UPCOMING</span>
          <span>${timeTag.toLowerCase()}</span>
        </div>
        <div class="text-[#0c1f17] mt-1 break-words">${escapeHtml(ev.title)}</div>
        ${um ? window.umAtlas.buildEventUmWalkInlineHtml(ev, true) : ''}
        <div class="flex items-center justify-between gap-2 mt-2">
          <span class="text-[10px] text-[#436152] truncate">${escapeHtml(ev.location || formatEventTimeSpan(ev))}</span>
          <button type="button" onclick="openEventDetails('${jsAttrQuote(ev.id)}')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]">Details</button>
        </div>
      </div>
    `);
  });

  navContainer.innerHTML = navPillsHtml.join('');
  if (sidebarRadar) sidebarRadar.innerHTML = radarCardsHtml.join('');
  if (window.umAtlas && typeof window.umAtlas.renderCalendarCommuteStrip === 'function') window.umAtlas.renderCalendarCommuteStrip();
  if (window.umAtlas && typeof window.umAtlas.renderStudyCourseHubStrip === 'function') window.umAtlas.renderStudyCourseHubStrip();
}

function formatEventTimeSpan(ev) {
  if (ev.isAllDay) return 'ALL DAY';
  const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
  return `${ev.start.toLocaleTimeString('en-US', opts)} – ${ev.end.toLocaleTimeString('en-US', opts)}`;
}

function formatShortAmPmSpan(ev) {
  if (ev.isAllDay) return 'All Day';
  const fmt = (d) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return m === 0 ? `${h}${ampm}` : `${h}:${String(m).padStart(2, '0')}${ampm}`;
  };
  return `${fmt(ev.start)} – ${fmt(ev.end)}`;
}

function getEventStatusBadge(ev, now) {
  const prio = getEventPriorityColor(ev);
  const prioTheme = getEventPriorityTheme(ev);
  const prioTag = `<span class="tech-badge ${prioTheme.badgeClass}" title="Priority Colour: ${prio}">${prio === 'RED' ? '◆ HIGH' : prio === 'YELLOW' ? '▲ MED' : '● LOW'}</span>`;

  if (now >= ev.start && now < ev.end) {
    const elapsed = Math.max(1, Math.floor((now - ev.start) / 60000));
    const left = Math.max(1, Math.ceil((ev.end - now) / 60000));
    return `${prioTag} <span class="tech-badge badge-green">● ONGOING • ${elapsed}m in (${left}m left)</span>`;
  }
  const diffMins = Math.ceil((ev.start - now) / 60000);
  if (diffMins > 0 && diffMins <= 60) {
    return `${prioTag} <span class="tech-badge badge-amber">▲ UPCOMING IN ${diffMins}m</span>`;
  }
  if (ev.end < now) {
    return `${prioTag} <span class="tech-badge badge-neutral">COMPLETED</span>`;
  }
  return `${prioTag}`;
}

// Auto-refresh live event status every 15s and sync Google Calendar every 60s
setInterval(() => {
  if (document.hidden) return;
  updateNavbarAndRadarTelemetry();
  // Keeps the "in Xm" countdown and the quota/streak tiles honest (D3.9).
  if (typeof renderDailyBriefing === 'function') renderDailyBriefing();
}, 15000);
// `.then(refreshEventLinkedViews)` is what keeps the  task badges correct after a sync.
setInterval(() => { if (!document.hidden) fetchGoogleCalendarEvents(false).then(refreshEventLinkedViews); }, 60000);

// Catch up immediately when the user comes back instead of waiting for the next tick.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (typeof persistTimerState === 'function') persistTimerState();
    return;
  }
  updateClock();
  updateNavbarAndRadarTelemetry();
  fetchGoogleCalendarEvents(false).then(refreshEventLinkedViews);
});

// ==========================================
// 9. TAB 4: TASKS MATRIX (DEADLINES, CALENDAR LINKS, REARRANGEABLE & COLLAPSIBLE)
// ==========================================
const TASK_ORDER_DATE_KEY = '1970-01-03';
let taskColOrder = [];
let taskItemOrder = {};  // columnId -> array of taskIds in custom vertical order
let taskStatusMap = {};  // taskId -> 'QUEUED' | 'IN-PROGRESS'
let taskMetaMap = {};    // taskId -> { dueDate: 'YYYY-MM-DD', eventId: '...' }
let collapsedTaskCols = {};
let isEntireTaskMatrixCollapsed = false;
let draggedTaskColId = null;
// Radar bar defaults to OPEN (persisted preference still wins once you toggle it).
let isThirdNavbarExpanded = true;

// ── SUBTASK STATE (v1.0.0) ────────────────────────────────────────────────
// Declared up here, next to the rest of the task state, because
// persistTaskColumnOrder() (§9A) serialises collapsedTaskChildren and may run before
// §9A-1 is reached. A subtask is just a task_items row with parent_task_id set.
const SUBTASK_COLLAPSED_KEY = 'autumn_task_child_collapsed';
let taskParentColumnsAvailable = null; // null = unknown, false = migration not applied
let collapsedTaskChildren = {};        // taskId -> true when its child thread is hidden
let addingSubtaskParentId = null;      // taskId whose inline composer is open
let subtaskDraft = { parentId: '', title: '', due: '', eventId: '' };

// Load saved local collapse, order, status & deadline/event metadata preferences
try {
  const savedOrder = JSON.parse(localStorage.getItem('autumn_task_col_order') || '[]');
  if (Array.isArray(savedOrder)) taskColOrder = savedOrder;
  const savedItemOrder = JSON.parse(localStorage.getItem('autumn_task_item_order') || '{}');
  if (savedItemOrder && typeof savedItemOrder === 'object') taskItemOrder = savedItemOrder;
  const savedStatusMap = JSON.parse(localStorage.getItem('autumn_task_status_map') || '{}');
  if (savedStatusMap && typeof savedStatusMap === 'object') taskStatusMap = savedStatusMap;
  const savedMetaMap = JSON.parse(localStorage.getItem('autumn_task_meta_map') || '{}');
  if (savedMetaMap && typeof savedMetaMap === 'object') taskMetaMap = savedMetaMap;
  const savedCollapsed = JSON.parse(localStorage.getItem('autumn_task_col_collapsed') || '{}');
  if (savedCollapsed && typeof savedCollapsed === 'object') collapsedTaskCols = savedCollapsed;
  const savedNav3 = localStorage.getItem('autumn_nav3_expanded');
  if (savedNav3 !== null) isThirdNavbarExpanded = savedNav3 === 'true';
} catch (e) {}

function toggleThirdNavbar() {
  isThirdNavbarExpanded = !isThirdNavbarExpanded;
  try {
    localStorage.setItem('autumn_nav3_expanded', String(isThirdNavbarExpanded));
  } catch (e) {}
  applyThirdNavbarState();
}

function applyThirdNavbarState() {
  const bar = document.getElementById('navbar-line3-bar');
  const chev = document.getElementById('navbar-line3-chevron');
  if (!bar) return;
  if (isThirdNavbarExpanded) {
    bar.classList.remove('hidden');
    if (chev) chev.textContent = '▾';
  } else {
    bar.classList.add('hidden');
    if (chev) chev.textContent = '▸';
  }
}

function getTaskMeta(taskId) {
  return taskMetaMap[taskId] || { dueDate: '', eventId: '' };
}

// Evaluates a YYYY-MM-DD deadline relative to today:
// diffDays < 0 => OVERDUE (Red), diffDays <= 1 => DUE <=1D (Red), diffDays <= 3 => DUE 2-3D (Yellow)
function evaluateTaskDeadline(dueDateStr) {
  if (!dueDateStr) return null;
  const todayStr = getLocalDateString(new Date());
  const todayMs = new Date(todayStr + 'T00:00:00').getTime();
  const dueMs = new Date(dueDateStr + 'T00:00:00').getTime();
  if (isNaN(dueMs)) return null;
  const diffDays = Math.round((dueMs - todayMs) / 86400000);

  if (diffDays < 0) {
    return { diffDays, level: 'OVERDUE', badgeClass: 'badge-red', label: `[!] OVERDUE (${Math.abs(diffDays)}d ago • ${dueDateStr.slice(5)})` };
  }
  if (diffDays === 0) {
    return { diffDays, level: 'CRITICAL', badgeClass: 'badge-red', label: `[!] DUE TODAY (${dueDateStr.slice(5)})` };
  }
  if (diffDays === 1) {
    return { diffDays, level: 'CRITICAL', badgeClass: 'badge-red', label: `[!] DUE TOMORROW (${dueDateStr.slice(5)})` };
  }
  if (diffDays <= 3) {
    return { diffDays, level: 'WARNING', badgeClass: 'badge-amber', label: `[~] DUE IN ${diffDays}D (${dueDateStr.slice(5)})` };
  }
  return { diffDays, level: 'NORMAL', badgeClass: 'badge-blue', label: `DUE ${dueDateStr.slice(5)} (${diffDays}d)` };
}

function updateNavbarTaskDeadlinesTelemetry() {
  applyThirdNavbarState();
  const container = document.getElementById('navbar-deadlines-container');
  if (!container) return;

  const urgentItems = [];
  (globalTaskItems || []).forEach(task => {
    if (task.is_done) return;
    const col = globalTaskColumns.find(c => c.id === task.column_id);
    if (col && col.is_done) return;
    const meta = getTaskMeta(task.id);
    if (!meta.dueDate) return;
    const info = evaluateTaskDeadline(meta.dueDate);
    if (info && info.diffDays <= 3) {
      urgentItems.push({ task, col, meta, info });
    }
  });

  urgentItems.sort((a, b) => a.info.diffDays - b.info.diffDays);

  if (urgentItems.length === 0) {
    container.innerHTML = `<span class="tech-badge badge-neutral">NO URGENT DEADLINES (≤3D)</span>`;
    return;
  }

  container.innerHTML = urgentItems.slice(0, 5).map(({ task, col, meta, info }) => {
    const colTag = col ? `${col.title}: ` : '';
    // A nested task names its parent so the phone radar entry is unambiguous.
    const parentTask = getTaskParentId(task) ? getTaskById(getTaskParentId(task)) : null;
    const taskLabel = (parentTask ? parentTask.title + ' › ' : '') + task.title;
    const clickAction = meta.eventId
      ? `openEventDetails('${jsAttrQuote(meta.eventId)}')`
      : `switchTab('tasks')`;
    return `
      <button
        type="button"
        onclick="${clickAction}"
        class="tech-badge ${info.badgeClass} cursor-pointer max-w-[230px] sm:max-w-[320px] overflow-hidden"
        title="${escapeHtml(colTag + taskLabel)} • ${escapeHtml(info.label)}"
      >
        <span class="truncate block"><strong>${escapeHtml(info.label.split('(')[0].trim())}:</strong> ${escapeHtml(colTag + taskLabel)}</span>
      </button>
    `;
  }).join('');
}


function sortTaskColumnsBySavedOrder(cols) {
  if (!Array.isArray(taskColOrder) || taskColOrder.length === 0) return cols;
  const orderMap = {};
  taskColOrder.forEach((id, i) => { orderMap[id] = i; });
  return cols.slice().sort((a, b) => {
    const posA = orderMap[a.id] !== undefined ? orderMap[a.id] : 99999;
    const posB = orderMap[b.id] !== undefined ? orderMap[b.id] : 99999;
    if (posA !== posB) return posA - posB;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });
}

function sortTaskItemsForColumn(colId, items) {
  const savedIds = taskItemOrder[colId];
  if (!Array.isArray(savedIds) || savedIds.length === 0) return items;
  const orderMap = {};
  savedIds.forEach((id, i) => { orderMap[id] = i; });
  return items.slice().sort((a, b) => {
    const posA = orderMap[a.id] !== undefined ? orderMap[a.id] : 99999;
    const posB = orderMap[b.id] !== undefined ? orderMap[b.id] : 99999;
    if (posA !== posB) return posA - posB;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });
}

async function persistTaskColumnOrder(newOrderIds) {
  if (Array.isArray(newOrderIds)) taskColOrder = newOrderIds;
  try {
    localStorage.setItem('autumn_task_col_order', JSON.stringify(taskColOrder));
    localStorage.setItem('autumn_task_item_order', JSON.stringify(taskItemOrder));
    localStorage.setItem('autumn_task_status_map', JSON.stringify(taskStatusMap));
    localStorage.setItem('autumn_task_meta_map', JSON.stringify(taskMetaMap));
  } catch (e) {}

  if (currentUser) {
    await supabaseClient
      .from('daily_notes')
      .upsert({
        date: TASK_ORDER_DATE_KEY,
        title: '__TASK_COL_ORDER__',
        mood: 'SYSTEM',
        content: JSON.stringify({
          order: taskColOrder,
          itemOrder: taskItemOrder,
          statusMap: taskStatusMap,
          metaMap: taskMetaMap,
          childCollapsed: collapsedTaskChildren,
          subchecklists: window.tasksPower ? window.tasksPower.getSubchecklistsMap() : {}
        }),
        updated_at: new Date().toISOString()
      }, { onConflict: 'date' });
  }
}

async function fetchAndRenderTasks() {
  const [colRes, itemRes, orderRes] = await Promise.all([
    supabaseClient.from('task_columns').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('task_items').select('*').order('created_at', { ascending: true }),
    supabaseClient.from('daily_notes').select('content').eq('date', TASK_ORDER_DATE_KEY).maybeSingle()
  ]);

  if (colRes.error) {
    console.warn('task_columns fetch note:', colRes.error.message);
  }

  if (orderRes && orderRes.data && orderRes.data.content) {
    try {
      const parsed = JSON.parse(orderRes.data.content);
      if (Array.isArray(parsed.order) && parsed.order.length > 0) {
        taskColOrder = parsed.order;
        localStorage.setItem('autumn_task_col_order', JSON.stringify(taskColOrder));
      }
      if (parsed.itemOrder && typeof parsed.itemOrder === 'object') {
        taskItemOrder = parsed.itemOrder;
        localStorage.setItem('autumn_task_item_order', JSON.stringify(taskItemOrder));
      }
      if (parsed.statusMap && typeof parsed.statusMap === 'object') {
        taskStatusMap = parsed.statusMap;
        localStorage.setItem('autumn_task_status_map', JSON.stringify(taskStatusMap));
      }
      if (parsed.metaMap && typeof parsed.metaMap === 'object') {
        taskMetaMap = parsed.metaMap;
        localStorage.setItem('autumn_task_meta_map', JSON.stringify(taskMetaMap));
      }
      if (parsed.childCollapsed && typeof parsed.childCollapsed === 'object') {
        collapsedTaskChildren = parsed.childCollapsed;
        localStorage.setItem(SUBTASK_COLLAPSED_KEY, JSON.stringify(collapsedTaskChildren));
      }
      if (parsed.subchecklists && typeof parsed.subchecklists === 'object' && window.tasksPower) {
        window.tasksPower.setTaskSubchecklistsFromSync(parsed.subchecklists);
      }
    } catch (e) {}
  }

  globalTaskColumns = sortTaskColumnsBySavedOrder(colRes.data || []);
  globalTaskItems = itemRes.data || [];
  // B6: deadlines / event links come from the optional columns when the migration exists.
  hydrateTaskMetaFromRows(globalTaskItems);
  renderTasksBoard();
}


let taskMetaColumnsAvailable = null; // null = unknown, false = migration not applied

function hasTaskMetaColumns(row) {
  return Object.prototype.hasOwnProperty.call(row, 'due_date') ||
    Object.prototype.hasOwnProperty.call(row, 'event_id');
}

// Merges the database columns into the local map (called after every task fetch).
// IMPORTANT: this is a MERGE, never an overwrite. Right after the task_items migration
// every row still has due_date/event_id = NULL, so an overwrite would erase every link
// this browser already knows — and the next persist would write that erasure to disk.
function hydrateTaskMetaFromRows(rows) {
  const backfill = [];
  // Subtask nesting is a separate optional column; detect it on the same pass so the
  // diagnostics row and the "not nested" fallback stay accurate.
  if ((rows || []).length > 0) taskParentColumnsAvailable = (rows || []).some(hasTaskParentColumn);
  (rows || []).forEach((row) => {
    if (!row || !hasTaskMetaColumns(row)) return;
    const local = taskMetaMap[row.id] || { dueDate: '', eventId: '' };
    const dbDue = row.due_date || '';
    const dbEvent = row.event_id || '';
    const merged = {
      dueDate: dbDue || local.dueDate || '',
      eventId: dbEvent || local.eventId || ''
    };
    taskMetaMap[row.id] = merged;
    // The database is blank but this browser holds a link → adopt it upward.
    if ((!dbDue && merged.dueDate) || (!dbEvent && merged.eventId)) {
      backfill.push({ taskId: row.id, dueDate: merged.dueDate, eventId: merged.eventId });
    }
  });
  if ((rows || []).length > 0) {
    taskMetaColumnsAvailable = (rows || []).some(hasTaskMetaColumns);
  }
  if (backfill.length > 0) backfillTaskMeta(backfill);
}

// One-shot, owner-only, capped: pushes browser-only links into the columns so applying
// the migration ADOPTS existing data instead of losing it.
let taskMetaBackfillRunning = false;
async function backfillTaskMeta(entries) {
  if (!currentUser || taskMetaBackfillRunning || !entries || entries.length === 0) return;
  taskMetaBackfillRunning = true;
  let pushed = 0;
  try {
    for (const entry of entries.slice(0, 40)) {
      const { error } = await supabaseClient
        .from('task_items')
        .update({ due_date: entry.dueDate || null, event_id: entry.eventId || null })
        .eq('id', entry.taskId);
      if (error) {
        if (isMissingColumnError(error)) { taskMetaColumnsAvailable = false; break; }
        continue;
      }
      pushed += 1;
    }
  } catch (e) {
    console.warn('[autumn] task meta backfill skipped:', e && e.message);
  } finally {
    taskMetaBackfillRunning = false;
  }
  if (pushed > 0) {
    showToast('TASK LINKS SYNCED', pushed + ' browser-only link(s) moved into Supabase.');
  }
}

function isMissingColumnError(error) {
  const msg = String((error && error.message) || '');
  return /could not find the .* column|column .* does not exist|schema cache/i.test(msg);
}

async function mirrorTaskMeta(taskId) {
  if (!currentUser || !taskId) return;
  const meta = taskMetaMap[taskId] || { dueDate: '', eventId: '' };
  const { error } = await supabaseClient
    .from('task_items')
    .update({ due_date: meta.dueDate || null, event_id: meta.eventId || null })
    .eq('id', taskId);
  if (error) {
    if (isMissingColumnError(error)) taskMetaColumnsAvailable = false;
    return;
  }
  taskMetaColumnsAvailable = true;
}

// Any path that repopulates globalCalendarEvents must call this: renderTasksBoard() looks
// each task's linked event up in that array, and at boot the board paints BEFORE the
// calendar resolves — which is exactly why the  badge used to need a manual re-render.
// Cheap fingerprint of the loaded calendar: length + first/last id. The 60s sync fires
// this every minute, and rebuilding 850 board nodes when nothing changed destroyed any
// text selection the operator had on a task title. Now the DOM is only rebuilt when the
// event set actually moved.
let lastEventSignature = '';

function currentEventSignature() {
  const list = globalCalendarEvents || [];
  if (list.length === 0) return 'empty';
  const first = list[0] || {};
  const last = list[list.length - 1] || {};
  return list.length + '|' + (first.id || '') + '|' + (last.id || '');
}

function refreshEventLinkedViews(force) {
  // Never clobber an inline editor or a half-typed add-task form.
  if (typeof editingTaskId !== 'undefined' && editingTaskId) return;
  if (typeof editingColumnId !== 'undefined' && editingColumnId) return;
  if (typeof addingSubtaskParentId !== 'undefined' && addingSubtaskParentId) return;
  const active = document.activeElement;
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) && active.closest('#tasks-columns-container')) return;

  const signature = currentEventSignature();
  const changed = signature !== lastEventSignature;
  lastEventSignature = signature;

  try {
    if (changed || force) {
      if (typeof renderTasksBoard === 'function') renderTasksBoard();
      if (typeof applyIconLabels === 'function') applyIconLabels(document.getElementById('tasks-columns-container'));
    }
    if (typeof updateNavbarTaskDeadlinesTelemetry === 'function') updateNavbarTaskDeadlinesTelemetry();
    if (typeof activeTabName !== 'undefined' && activeTabName === 'focus' && typeof renderFocusMode === 'function') renderFocusMode();
    if (typeof renderDailyBriefing === 'function') renderDailyBriefing();
  } catch (e) {
    console.warn('[autumn] event-linked refresh skipped:', e && e.message);
  }
}

// ==========================================
// 9A-1. SUBTASKS (v1.0.0) — unlimited nesting, full task parity
// A subtask is a normal task_items row with parent_task_id set, so every task feature
// (done, QUEUED/IN-PROGRESS, deadline, linked calendar event, edit, reorder, delete)
// works unchanged — the board simply renders the rows as a tree. Nesting is unlimited;
// only the VISIBLE indent is capped (see renderTaskRowHtml).
//
// ── MIGRATION (run once in the Supabase SQL editor) ─────────────────────
//   alter table public.task_items add column if not exists parent_task_id uuid;
//   alter table public.task_items add constraint task_items_parent_task_id_fkey
//     foreign key (parent_task_id) references public.task_items(id) on delete cascade;
//
// Until it is applied nothing breaks: the insert is retried without the parent column,
// the row lands as a top-level task and the operator is told to run the migration.
// ==========================================

// Collapse preference is local-first; persistChildCollapse() also mirrors it into the
// reserved daily_notes row so a phone agrees with the laptop.
try {
  const savedChildCollapsed = JSON.parse(localStorage.getItem(SUBTASK_COLLAPSED_KEY) || '{}');
  if (savedChildCollapsed && typeof savedChildCollapsed === 'object') collapsedTaskChildren = savedChildCollapsed;
} catch (e) {}

function hasTaskParentColumn(row) {
  return Object.prototype.hasOwnProperty.call(row || {}, 'parent_task_id');
}

function getTaskParentId(task) {
  return (task && task.parent_task_id) ? String(task.parent_task_id) : '';
}

function getTaskById(taskId) {
  if (!taskId) return null;
  return (globalTaskItems || []).find(t => t.id === taskId) || null;
}

// 0 = column root, 1 = direct subtask, 2 = subtask of a subtask … (cycle-safe).
function getTaskDepth(task) {
  let depth = 0;
  let cursor = task;
  const seen = new Set();
  while (cursor && getTaskParentId(cursor) && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    cursor = getTaskById(getTaskParentId(cursor));
    if (cursor) depth += 1;
  }
  return depth;
}

function parsePaceToSeconds(paceStr) {
  if (!paceStr) return 999999;
  const parts = String(paceStr).trim().split(':').map(p => Number(p));
  if (parts.some(n => !isFinite(n) || n < 0)) return 999999;
  if (parts.length === 2 && parts[1] < 60) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && parts[1] < 60 && parts[2] < 60) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 999999;
}

function normalizePaceDisplay(paceStr) {
  const secs = parsePaceToSeconds(paceStr);
  if (secs === 999999) return paceStr;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatRunDateDMY(isoDateStr) {
  if (!isoDateStr) return '';
  if (isoDateStr === 'REFERENCE') return 'REFERENCE';
  // If already in D/M/YYYY format, return as-is
  if (isoDateStr.includes('/')) return isoDateStr;
  const parts = isoDateStr.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (isNaN(m) || isNaN(d)) return isoDateStr;
    // Zero-padded so rows read 05/11/2026 rather than 5/11/2026.
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  }
  return isoDateStr;
}


const NOTE_ALLOWED_TAGS = {
  b: [], strong: [], i: [], em: [], u: [], s: [], del: [], br: [], hr: [],
  p: [], div: [], span: [], blockquote: [], pre: [], code: [],
  ul: [], ol: [], li: [], a: ['href'], h1: [], h2: [], h3: [], h4: []
};
const NOTE_BLOCKED_TAGS = [
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
  'form', 'input', 'button', 'textarea', 'select', 'svg', 'math', 'template'
];

function sanitizeNoteHtml(rawHtml, options) {
  const opts = options || {};
  // Reader mode (v1.1.0) keeps the images and tables a parsed .docx produces; note mode
  // never does, so the default behaviour and the security posture are unchanged.
  const allowTags = Object.assign({}, NOTE_ALLOWED_TAGS);
  if (opts.allowTables) {
    allowTags.table = []; allowTags.thead = []; allowTags.tbody = []; allowTags.tfoot = [];
    allowTags.tr = []; allowTags.th = ['colspan', 'rowspan']; allowTags.td = ['colspan', 'rowspan'];
  }
  if (opts.allowImages) allowTags.img = ['src', 'alt'];
  if (!rawHtml) return '';
  // Parse into an INERT document instead of assigning to a detached <div>. A detached
  // div still starts resource loading for its whole subtree — the classic
  // <img src=x onerror=…> sanitizer bypass — whereas DOMParser's text/html document
  // fetches nothing and executes nothing. The whitelist walk below then rewrites the
  // parsed tree in place, and only the sanitised result is ever re-serialised.
  const parseDoc = new DOMParser().parseFromString(String(rawHtml), 'text/html');
  const holder = parseDoc.body;

  Array.from(holder.querySelectorAll('*')).forEach(el => {
    if (!el.parentNode) return;
    const tag = el.tagName.toLowerCase();

    if (NOTE_BLOCKED_TAGS.indexOf(tag) !== -1) {
      el.remove();
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(allowTags, tag)) {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      el.remove();
      return;
    }

    const allowedAttrs = allowTags[tag] || [];
    Array.from(el.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      // href is only allowed on links, and only with a safe scheme — this check must run
      // BEFORE the whitelist test, otherwise `href` passes simply for being listed.
      if (tag === 'a' && name === 'href') {
        if (!/^(https?:\/\/|mailto:|#|\/)/i.test(attr.value.trim())) el.removeAttribute(attr.name);
        return;
      }
      if (allowedAttrs.indexOf(name) === -1) el.removeAttribute(attr.name);
    });

    // Reader mode only: an <img> is acceptable when it carries an inline data URL
    // (mammoth inlines .docx images). Anything remote is dropped — no tracking pixels.
    if (tag === 'img') {
      const src = String(el.getAttribute('src') || '').trim();
      if (!/^data:image\//i.test(src)) { el.remove(); return; }
    }

    if (tag === 'a') {
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
    }
  });

  return holder.innerHTML;
}

function getWeekMondayDateString(dateStrOrObj) {
  const d = typeof dateStrOrObj === 'string'
    ? new Date(dateStrOrObj + 'T00:00:00')
    : new Date(dateStrOrObj);
  if (isNaN(d.getTime())) return getLocalDateString(new Date());
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  return getLocalDateString(d);
}

function formatWeekSpanLabel(mondayDateStr) {
  const mon = new Date(mondayDateStr + 'T00:00:00');
  if (isNaN(mon.getTime())) return mondayDateStr;
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `WK ${fmt(mon)} – ${fmt(sun)}, ${sun.getFullYear()}`;
}


// Viewport resize listener for timeline / masonry reflow
let layoutResizeTimer = null;
let lastMasonryWidthBucket = window.innerWidth >= 1280 ? 3 : window.innerWidth >= 768 ? 2 : 1;
window.addEventListener('resize', () => {
  if (layoutResizeTimer) clearTimeout(layoutResizeTimer);
  layoutResizeTimer = setTimeout(() => {
    if (activeTabName === 'calendar' && currentCalViewMode === 'timeline' && typeof renderCalendarViewport === 'function') {
      renderCalendarViewport();
    }
    const currentBucket = window.innerWidth >= 1280 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    if (currentBucket !== lastMasonryWidthBucket) {
      lastMasonryWidthBucket = currentBucket;
      if (typeof renderTasksBoard === 'function') renderTasksBoard();
    }
  }, 180);
});

let latestSearchMatches = [];

function clearGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const dropdown = document.getElementById('global-search-dropdown');
  const clearBtn = document.getElementById('global-search-clear');
  const kbdHint = document.getElementById('global-search-kbd');
  if (input) input.value = '';
  setSearchDropdownOpen(false);
  if (clearBtn) clearBtn.classList.add('hidden');
  if (kbdHint) kbdHint.classList.remove('hidden');
}

// Debounced wrapper: the search scans study, steps, calendar, tasks, running and both
// note tables, so running it on every keystroke was needlessly expensive.
let globalSearchDebounceTimer = null;
let searchActiveIndex = -1;

// One owner for the combobox open/closed state so aria-expanded can never drift out of
// sync with the dropdown's visibility.
function setSearchDropdownOpen(open) {
  const dropdown = document.getElementById('global-search-dropdown');
  const input = document.getElementById('global-search-input');
  if (dropdown) dropdown.classList.toggle('hidden', !open);
  if (input) input.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (!open) {
    searchActiveIndex = -1;
    if (input) input.removeAttribute('aria-activedescendant');
    document.querySelectorAll('#global-search-results [role="option"]').forEach((el) => {
      el.setAttribute('aria-selected', 'false');
      el.classList.remove('search-option-active');
    });
    const hintEl = document.getElementById('global-search-hint');
    if (hintEl) hintEl.textContent = DEFAULT_SEARCH_HINT;
  }
}

function highlightSearchResult(index) {
  const input = document.getElementById('global-search-input');
  const options = Array.from(document.querySelectorAll('#global-search-results [role="option"]'));
  if (options.length === 0 || !input) return;
  const clamped = Math.max(0, Math.min(index, options.length - 1));
  searchActiveIndex = clamped;
  options.forEach((el, i) => {
    const isActive = i === clamped;
    el.setAttribute('aria-selected', isActive ? 'true' : 'false');
    el.classList.toggle('search-option-active', isActive);
    if (isActive) input.setAttribute('aria-activedescendant', el.id);
  });
  try { options[clamped].scrollIntoView({ block: 'nearest' }); } catch (e) {}
}

// Discoverability: the "›" chip inside the search field pre-fills command mode, so the
// feature is one click away instead of being documented only in the shortcut sheet.
const DEFAULT_SEARCH_HINT = '› COMMANDS · ESC CLOSE';
const COMMAND_SEARCH_HINT = '↑↓ NAVIGATE · ESC CLOSE';

function startCommandMode() {
  const input = document.getElementById('global-search-input');
  if (!input) return;
  input.focus();
  input.value = '>';
  handleGlobalSearch('>');
  showToast('COMMAND MODE', 'Type a command — e.g. study 7.5 · export · theme · review · audio.');
}

function queueGlobalSearch(value) {
  if (globalSearchDebounceTimer) clearTimeout(globalSearchDebounceTimer);
  globalSearchDebounceTimer = setTimeout(() => handleGlobalSearch(value), 140);
}

function handleGlobalSearch(rawQuery) {
  const trimmedRaw = (rawQuery || '').trim();

  // ---------------------------------------------------------------- command mode (T2.5)
  // A leading ">" turns the content search into a command palette. Commands reuse the
  // terminal CLI parser, so ">study 7.5" and "study 7.5" can never drift apart.
  if (trimmedRaw.charAt(0) === '>') {
    const cmdDropdown = document.getElementById('global-search-dropdown');
    const cmdResults = document.getElementById('global-search-results');
    const cmdCount = document.getElementById('global-search-count');
    if (!cmdDropdown || !cmdResults) return;
    if (typeof paletteMatches !== "function") {
      if (window.__autumnLazy && typeof window.__autumnLazy.ensureModule === "function") {
        window.__autumnLazy.ensureModule("mod-extras").then(() => {
          const curIn = document.getElementById("global-search-input");
          if (curIn && curIn.value.trim().charAt(0) === ">") handleGlobalSearch(curIn.value);
        });
      }
      latestSearchMatches = [];
      if (cmdCount) cmdCount.textContent = "LOADING COMMANDS...";
      cmdResults.innerHTML = "<div class=\x27p-4 font-mono-tech text-xs text-[#436152]\x27>Loading command palette...</div>";
      setSearchDropdownOpen(true);
      return;
    }
    latestSearchMatches = paletteMatches(trimmedRaw);
    if (cmdCount) {
      cmdCount.textContent = latestSearchMatches.length + ' COMMAND' + (latestSearchMatches.length === 1 ? '' : 'S');
    }
    cmdResults.innerHTML = latestSearchMatches.map((item, idx) => `
      <button
        type="button"
        role="option"
        id="gsr-${idx}"
        data-search-index="${idx}"
        aria-selected="false"
        onclick="triggerSearchResult(${idx})"
        class="w-full text-left p-2.5 sm:p-3 hover:bg-[#eff8f2] transition-colors flex items-start justify-between gap-2.5 group"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="tech-badge ${item.badgeClass} !text-[9px] !py-0.5 !px-1.5">${escapeHtml(item.category)}</span>
            <span class="font-bold text-xs text-[#0c1f17] group-hover:text-[#047857] truncate">${escapeHtml(item.title)}</span>
          </div>
          <div class="font-mono-tech text-[11px] text-[#436152] truncate mt-1">${escapeHtml(item.subtitle || '')}</div>
        </div>
        <span class="font-mono-tech text-xs text-[#56735f] group-hover:text-[#047857] shrink-0 self-center">↵</span>
      </button>
    `).join('');
    setSearchDropdownOpen(true);
    const cmdClear = document.getElementById('global-search-clear');
    if (cmdClear) cmdClear.classList.remove('hidden');
    const cmdKbd = document.getElementById('global-search-kbd');
    if (cmdKbd) cmdKbd.classList.add('hidden');
    const cmdHint = document.getElementById('global-search-hint');
    if (cmdHint) cmdHint.textContent = COMMAND_SEARCH_HINT;
    return;
  }

  const query = (rawQuery || '').trim().toLowerCase();
  const dropdown = document.getElementById('global-search-dropdown');
  const resultsContainer = document.getElementById('global-search-results');
  const countEl = document.getElementById('global-search-count');
  const clearBtn = document.getElementById('global-search-clear');
  const kbdHint = document.getElementById('global-search-kbd');

  if (!dropdown || !resultsContainer) return;

  if (!query) {
    setSearchDropdownOpen(false);
    if (clearBtn) clearBtn.classList.add('hidden');
    if (kbdHint) kbdHint.classList.remove('hidden');
    return;
  }

  if (clearBtn) clearBtn.classList.remove('hidden');
  if (kbdHint) kbdHint.classList.add('hidden');

  const matches = [];

  // 1. Navigation & Command Modules
  const modules = [
    { title: '01 // Study Wallet & Dashboard', sub: 'Daily study quota, heatmap & trajectory chart', tab: 'study' },
    { title: '02 // Steps Wallet & Dashboard', sub: '10,000 daily step quota & kinetic telemetry', tab: 'steps' },
    { title: '03 // Master Schedule & Google Calendar', sub: 'Live event radar, schedule, month, week & day views', tab: 'calendar' },
    { title: '04 // Subject & Competition Task Matrix + Running', sub: 'Multi-column tasks & 5K/10K/Half/Marathon ledgers', tab: 'tasks' },
    { title: '05 // Daily Journal & General Notes Archive', sub: 'Dated operational logs & rich-text reference notes', tab: 'notes' },
    { title: '06 // Resource Vault & PDF Reader', sub: 'Google Drive expandable folders & integrated PDF viewer', tab: 'resources' },
    { title: '◈ // Focus Mode Command View', sub: 'Minimal daily execution telemetry, targets & active tasks', tab: 'focus' }
  ];

  // 1B. Google Drive Files & PDFs
  if (typeof globalDriveFilesMap === 'object' && globalDriveFilesMap) {
    Object.values(globalDriveFilesMap).forEach(file => {
      if (file.mimeType === 'application/vnd.google-apps.folder') return;
      if ((file.name || '').toLowerCase().includes(query)) {
        matches.push({
          category: `DRIVE // ${typeof getDriveFileTypeLabel === "function" ? getDriveFileTypeLabel(file.mimeType) : "FILE"}`,
          badgeClass: 'badge-green',
          title: file.name,
          subtitle: `Open in 06 // Resources PDF & Document Reader`,
          action: () => {
            switchTab('resources');
            openDriveFileInReader(file.id);
          }
        });
      }
    });
  }

  // 1C. YouTube Educational Playlists & Videos
  if (Array.isArray(globalYoutubeResources)) {
    globalYoutubeResources.forEach(yt => {
      const hay = `${yt.title || ''} ${yt.category || ''} ${yt.channel_name || ''} ${yt.resource_type || ''}`.toLowerCase();
      if (hay.includes(query)) {
        matches.push({
          category: `YOUTUBE // ${yt.category || 'EDU'}`,
          badgeClass: 'badge-red',
          title: yt.title,
          subtitle: `${yt.resource_type || 'PLAYLIST'}${yt.channel_name ? ' • ' + yt.channel_name : ''}`,
          action: () => {
            switchTab('resources');
            loadYoutubeResourceInPlayer(yt.id, true);
          }
        });
      }
    });
  }
  modules.forEach(m => {
    if (m.title.toLowerCase().includes(query) || m.sub.toLowerCase().includes(query)) {
      matches.push({
        category: 'MODULE',
        badgeClass: 'badge-green',
        title: m.title,
        subtitle: m.sub,
        action: () => switchTab(m.tab)
      });
    }
  });

  // 2. Tasks & Columns
  globalTaskColumns.forEach(col => {
    if ((col.title || '').toLowerCase().includes(query) || (col.category || '').toLowerCase().includes(query)) {
      matches.push({
        category: `COLUMN // ${col.category}`,
        badgeClass: 'badge-blue',
        title: col.title,
        subtitle: col.is_done ? 'Completed Column in Tasks Matrix' : 'Active Column in Tasks Matrix',
        action: () => switchTab('tasks')
      });
    }
  });

  globalTaskItems.forEach(task => {
    if ((task.title || '').toLowerCase().includes(query)) {
      const parentCol = globalTaskColumns.find(c => c.id === task.column_id);
      // Subtasks are searchable too, and the subtitle names the parent so two identical
      // titles in the same column are still distinguishable.
      const parentTask = getTaskParentId(task) ? getTaskById(getTaskParentId(task)) : null;
      const kind = parentTask ? 'SUBTASK' : 'TASK';
      matches.push({
        category: kind + (task.is_done ? ' // DONE' : ' // PENDING'),
        badgeClass: task.is_done ? 'badge-neutral' : 'badge-amber',
        title: task.title,
        subtitle: `Column: ${parentCol ? parentCol.title : 'Tasks'}${parentTask ? ' • Parent: ' + parentTask.title : ''}${getTaskParentId(task) ? ' • Level ' + getTaskDepth(task) : ''}`,
        action: () => switchTab('tasks')
      });
    }
  });

  // 2B. Recurring Tasks & Habits
  if (Array.isArray(globalHabits)) {
    globalHabits.forEach(habit => {
      const hay = `${habit.title || ''} ${habit.frequency || ''} ${habit.notes || ''}`.toLowerCase();
      if (hay.includes(query)) {
        const doneNow = typeof isHabitCheckedInCurrentCycle === "function" ? isHabitCheckedInCurrentCycle(habit) : false;
        matches.push({
          category: `HABIT // ${habit.frequency || 'DAILY'}`,
          badgeClass: doneNow ? 'badge-green' : 'badge-amber',
          title: habit.title,
          subtitle: `${doneNow ? 'Completed this cycle' : 'Pending this cycle'} • Streak: ${habit.streak_count || 0}`,
          action: () => {
            switchTab('tasks');
            const el = document.getElementById('habits-ledger-table');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
    });
  }

  // 3. Google Calendar Events
  globalCalendarEvents.forEach(ev => {
    const hay = `${ev.title} ${ev.location} ${stripHtmlTags(ev.description)} ${ev.dateStr}`.toLowerCase();
    if (hay.includes(query)) {
      matches.push({
        category: 'CALENDAR EVENT',
        badgeClass: 'badge-blue',
        title: ev.title,
        subtitle: `${ev.dateStr} • ${formatEventTimeSpan(ev)}${ev.location ? ' •  ' + ev.location : ''}`,
        action: () => {
          switchTab('calendar');
          openEventDetails(ev.id);
        }
      });
    }
  });

  // 4. Daily Journal Notes
  globalNotes.forEach(note => {
    const plain = stripHtmlTags(note.content || '');
    const hay = `${note.date} ${note.title || ''} ${note.mood || ''} ${plain}`.toLowerCase();
    if (hay.includes(query)) {
      matches.push({
        category: `JOURNAL // ${note.date}`,
        badgeClass: 'badge-green',
        title: note.title || `Daily Log (${note.date})`,
        subtitle: plain ? plain.slice(0, 90) : `Mood: ${note.mood || 'OPTIMAL'}`,
        action: () => {
          switchTab('notes');
          selectJournalDate(note.date);
        }
      });
    }
  });

  // 5. General Notes
  globalGeneralNotes.forEach(gn => {
    const plain = stripHtmlTags(gn.content || '');
    const hay = `${gn.title || ''} ${gn.category || ''} ${plain}`.toLowerCase();
    if (hay.includes(query)) {
      matches.push({
        category: `GEN NOTE // ${gn.category || 'GENERAL'}`,
        badgeClass: 'badge-blue',
        title: gn.title || 'Untitled General Note',
        subtitle: plain ? plain.slice(0, 90) : 'General reference note',
        action: () => {
          switchTab('notes');
          selectGeneralNote(gn.id);
          const el = document.getElementById('gen-note-editor-form');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  });

  // 5B. Competitions / Activities & Leadership Positions
  if (Array.isArray(globalPortfolioLogs)) {
    globalPortfolioLogs.forEach(item => {
      const hay = `${item.title || ''} ${item.date_str || ''} ${item.result_str || ''} ${item.category || ''}`.toLowerCase();
      if (hay.includes(query)) {
        matches.push({
          category: item.category === 'POSITION' ? 'POSITION // ROLE' : 'COMP // ACTIVITY',
          badgeClass: item.category === 'POSITION' ? 'badge-blue' : 'badge-green',
          title: `${item.title} — ${item.result_str}`,
          subtitle: `Date/Duration: ${item.date_str}`,
          action: () => {
            switchTab('notes');
            const el = document.getElementById('portfolio-tables-container');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }
    });
  }

  // 6. Running Performance Logs
  globalRunningLogs.forEach(run => {
    const meta = RUN_CATEGORY_META[run.category] || { title: run.category };
    const hay = `${meta.title} ${run.run_date || ''} ${run.pace_str || ''} ${run.time_str || ''} ${run.location || ''} ${run.run_type || ''}`.toLowerCase();
    if (hay.includes(query)) {
      matches.push({
        category: `RUN // ${meta.title}`,
        badgeClass: run.run_type === 'EASY' ? 'badge-green' : run.run_type === 'THRESHOLD' ? 'badge-amber' : 'badge-neutral',
        title: `${normalizePaceDisplay(run.pace_str)}/km (${run.time_str || '--:--'}) — ${run.location || run.run_type}`,
        subtitle: `Date: ${formatRunDateDMY(run.run_date)} • Type: ${run.run_type}`,
        action: () => {
          visibleRunCategories[run.category] = true;
          updateRunCategoryToggleButtons();
          renderRunningTables();
          switchTab('tasks');
          const el = document.getElementById('running-tables-container');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  });

  // 7. Study & Steps Ledger Dates
  globalStudyRows.forEach(r => {
    if (r.date.includes(query)) {
      matches.push({
        category: 'STUDY LOG',
        badgeClass: 'badge-green',
        title: `${r.date}: Studied ${formatHours(r.actual_hours)}`,
        subtitle: `Target: ${formatHours(r.computed_target)}`,
        action: () => switchTab('study')
      });
    }
  });

  globalStepsRows.forEach(r => {
    if (r.date.includes(query) || String(r.actual_steps).includes(query)) {
      matches.push({
        category: 'STEPS LOG',
        badgeClass: 'badge-blue',
        title: `${r.date}: ${formatSteps(r.actual_steps)} steps`,
        subtitle: `Target: ${formatSteps(r.computed_target)} steps`,
        action: () => switchTab('steps')
      });
    }
  });

  latestSearchMatches = matches.slice(0, 25);
  if (countEl) {
    countEl.textContent = `${matches.length} RESULT${matches.length === 1 ? '' : 'S'}${matches.length > 25 ? ' (SHOWING TOP 25)' : ''}`;
  }

  if (latestSearchMatches.length === 0) {
    resultsContainer.innerHTML = `
      <div class="p-6 text-center font-mono-tech text-xs text-[#56735f]">
        No matching records found across Study, Steps, Calendar, Tasks, Running or Notes for "<strong>${escapeHtml(rawQuery)}</strong>".
        <div class="mt-2 text-[10px] text-[#436152]">Type <strong class="text-[#047857]">›</strong> first to run a command instead — e.g. <code>›study 7.5</code>.</div>
      </div>
    `;
  } else {
    resultsContainer.innerHTML = latestSearchMatches.map((item, idx) => `
      <button
        type="button"
        role="option"
        id="gsr-${idx}"
        data-search-index="${idx}"
        aria-selected="false"
        onclick="triggerSearchResult(${idx})"
        class="w-full text-left p-2.5 sm:p-3 hover:bg-[#eff8f2] transition-colors flex items-start justify-between gap-2.5 group"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="tech-badge ${item.badgeClass} !text-[9px] !py-0.5 !px-1.5">${escapeHtml(item.category)}</span>
            <span class="font-bold text-xs text-[#0c1f17] group-hover:text-[#047857] truncate">${escapeHtml(item.title)}</span>
          </div>
          <div class="font-mono-tech text-[11px] text-[#436152] truncate mt-1">${escapeHtml(item.subtitle || '')}</div>
        </div>
        <span class="font-mono-tech text-xs text-[#56735f] group-hover:text-[#047857] shrink-0 self-center">↵</span>
      </button>
    `).join('');
  }

  setSearchDropdownOpen(true);
}

function triggerSearchResult(index) {
  const item = latestSearchMatches[index];
  if (!item) return;
  clearGlobalSearch();
  if (typeof item.action === 'function') item.action();
}

// Keyboard Shortcuts: '/' or Ctrl+K / Cmd+K to focus search, Esc to close
document.addEventListener('keydown', (e) => {
  const searchInput = document.getElementById('global-search-input');
  if (!searchInput) return;

  if (e.key === 'Escape') {
    const dropdown = document.getElementById('global-search-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
      setSearchDropdownOpen(false);
      searchInput.blur();
    }
    return;
  }

  // Arrow keys / Enter walk the results listbox (WAI-ARIA combobox pattern).
  const dropdownEl = document.getElementById('global-search-dropdown');
  const dropdownOpen = dropdownEl && !dropdownEl.classList.contains('hidden');
  if (dropdownOpen && latestSearchMatches && latestSearchMatches.length > 0) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const total = latestSearchMatches.length;
      const next = searchActiveIndex < 0
        ? (delta === 1 ? 0 : total - 1)
        : (searchActiveIndex + delta + total) % total;
      highlightSearchResult(next);
      return;
    }
    if (e.key === 'Enter' && searchActiveIndex >= 0) {
      e.preventDefault();
      triggerSearchResult(searchActiveIndex);
      return;
    }
  }

  const tag = (document.activeElement?.tagName || '').toLowerCase();
  const isEditable = document.activeElement?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';

  if ((e.key === '/' && !isEditable) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }

  // Shortcut: Backtick (`) when not typing in an input, or Ctrl+\ / Cmd+\ anywhere toggles the Terminal Drawer
  if ((e.key === '`' && !isEditable) || ((e.ctrlKey || e.metaKey) && e.key === '\\')) {
    e.preventDefault();
    toggleTerminalDrawer(true);
  }
});


// ==========================================
// 10H. DISPLAY MOOD COLOR PROFILES (SAVED ACROSS SESSIONS)
// ==========================================
const DISPLAY_COLOR_PROFILES = [
  { id: 'default', label: 'DEFAULT' },
  { id: 'm3-dark', label: 'MD3 DARK' },
  { id: 'amber-crt', label: 'AMBER CRT' },
  { id: 'phosphor-green', label: 'PHOSPHOR GREEN' },
  { id: 'cyan-cold', label: 'CYAN // COLD' },
  { id: 'autumn-oled', label: 'AUTUMN OLED' }
];
let activeDisplayProfile = localStorage.getItem('autumn_display_profile') || 'default';

function applyDisplayColorProfile(profileId) {
  const found = DISPLAY_COLOR_PROFILES.find(p => p.id === profileId) || DISPLAY_COLOR_PROFILES[0];
  activeDisplayProfile = found.id;
  if (found.id === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', found.id);
  }
  try {
    localStorage.setItem('autumn_display_profile', found.id);
  } catch (e) {}
  const lbl = document.getElementById('theme-profile-label');
  if (lbl) lbl.textContent = `THEME: ${found.label}`;
}

function cycleDisplayColorProfile() {
  const idx = DISPLAY_COLOR_PROFILES.findIndex(p => p.id === activeDisplayProfile);
  const next = DISPLAY_COLOR_PROFILES[(idx + 1) % DISPLAY_COLOR_PROFILES.length];
  applyDisplayColorProfile(next.id);
  showToast('DISPLAY PROFILE', `Activated mood profile: ${next.label}`);
  if (typeof renderAdvancedTelemetryAnalytics === 'function') renderAdvancedTelemetryAnalytics();
}

// Apply saved profile immediately
applyDisplayColorProfile(activeDisplayProfile);

// 10H-2. UI DENSITY MODE (PRO ULTRA-DENSE vs STANDARD COMFORTABLE)
let activeDensityMode = localStorage.getItem('autumn_density_mode') || 'compact';

function applyDensityMode(mode) {
  activeDensityMode = mode === 'comfortable' ? 'comfortable' : 'compact';
  if (activeDensityMode === 'compact') {
    document.documentElement.setAttribute('data-density', 'compact');
  } else {
    document.documentElement.removeAttribute('data-density');
  }
  try {
    localStorage.setItem('autumn_density_mode', activeDensityMode);
  } catch (e) {}
  const navLbl = document.getElementById('density-mode-label');
  if (navLbl) navLbl.textContent = activeDensityMode === 'compact' ? 'DENSITY: PRO' : 'DENSITY: STD';
  const railLbl = document.getElementById('rail-density-label');
  if (railLbl) railLbl.textContent = activeDensityMode === 'compact' ? 'Dense' : 'Std';
}

function toggleDensityMode() {
  const next = activeDensityMode === 'compact' ? 'comfortable' : 'compact';
  applyDensityMode(next);
  showToast('UI DENSITY', next === 'compact' ? 'Activated Pro Ultra-Dense Telemetry Mode.' : 'Activated Standard Comfortable Spacing.');
}

applyDensityMode(activeDensityMode);

// ==========================================
// 10I. BUILT-IN STUDY STOPWATCH & POMODORO TIMER ENGINE
// ==========================================
let studyTimerMode = 'stopwatch'; // 'stopwatch' | 'pomodoro'
let studyTimerRunning = false;
let studyTimerInterval = null;
let studyTimerLastTickMs = null;
// Persisting on every 1s tick meant ~7,200 synchronous localStorage writes per hour on
// the main thread. Flush every 15s instead, plus on pause / hide / unload.
let timerTicksSincePersist = 0;
const TIMER_PERSIST_EVERY_TICKS = 15;

// ── Timer persistence ───────────────────────────────────────────────────
// Accumulation is keyed BY DAY so yesterday's leftovers never leak into today, and the
// running/mode/phase state survives a reload. The clock deliberately does NOT back-credit
// the time the page was closed: on restore we resume from "now" and only count from there.
const TIMER_LEGACY_ACCUM_KEY = 'autumn_study_accum_secs';
const TIMER_STATE_KEY = 'autumn_study_timer_state';

function timerAccumKey(dateStr) {
  return TIMER_LEGACY_ACCUM_KEY + ':' + dateStr;
}

function loadTimerAccumulatedSecs() {
  const todayStr = getLocalDateString(new Date());
  try {
    const todayRaw = localStorage.getItem(timerAccumKey(todayStr));
    if (todayRaw !== null) return Number(todayRaw) || 0;

    // One-time migration: the old single un-keyed value becomes today's bucket so an
    // in-flight session is not lost by upgrading.
    const legacyRaw = localStorage.getItem(TIMER_LEGACY_ACCUM_KEY);
    if (legacyRaw !== null) {
      localStorage.setItem(timerAccumKey(todayStr), legacyRaw);
      localStorage.removeItem(TIMER_LEGACY_ACCUM_KEY);
      return Number(legacyRaw) || 0;
    }
  } catch (e) {}
  return 0;
}

function persistTimerAccumulatedSecs() {
  try {
    localStorage.setItem(timerAccumKey(getLocalDateString(new Date())), String(studyAccumulatedSecs));
  } catch (e) {}
}

function persistTimerState() {
  try {
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify({
      date: getLocalDateString(new Date()),
      running: studyTimerRunning,
      mode: studyTimerMode,
      phase: pomoPhase,
      workMins: pomoWorkMins,
      breakMins: pomoBreakMins,
      pomoRemainingSecs: pomoRemainingSecs,
      savedAt: Date.now()
    }));
  } catch (e) {}
}

let studyAccumulatedSecs = loadTimerAccumulatedSecs();
let pomoPhase = 'WORK'; // 'WORK' | 'BREAK'
let pomoWorkMins = 25;
let pomoBreakMins = 5;
let pomoRemainingSecs = 25 * 60;

function formatTimerHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateStudyTimerUI() {
  const disp = document.getElementById('study-timer-display');
  const accumLbl = document.getElementById('study-timer-accum-label');
  const phaseLbl = document.getElementById('study-timer-phase-label');
  const toggleBtn = document.getElementById('study-timer-toggle-btn');

  if (disp) {
    disp.textContent = studyTimerMode === 'stopwatch'
      ? formatTimerHMS(studyAccumulatedSecs)
      : formatTimerHMS(pomoRemainingSecs);
  }
  if (accumLbl) {
    const h = Math.floor(studyAccumulatedSecs / 3600);
    const m = Math.floor((studyAccumulatedSecs % 3600) / 60);
    const s = Math.floor(studyAccumulatedSecs % 60);
    accumLbl.textContent = `session study accumulated: ${h}h ${m}m ${s}s`;
  }
  if (phaseLbl) {
    if (studyTimerMode === 'stopwatch') {
      phaseLbl.textContent = studyTimerRunning ? '● RECORDING STUDY SESSION' : 'MAIN STUDY STOPWATCH // PAUSED';
    } else {
      phaseLbl.textContent = `POMODORO // ${pomoPhase} PHASE (${pomoWorkMins}M / ${pomoBreakMins}M)`;
    }
  }
  if (toggleBtn) {
    toggleBtn.textContent = studyTimerRunning ? '[PAUSE] Pause Timer' : 'Start Study';
  }

  // Mirror the clock into Focus Mode so the session timer is visible while executing.
  const focusTimerEl = document.getElementById('focus-timer-display');
  const focusTimerBtn = document.getElementById('focus-timer-toggle');
  if (focusTimerEl) {
    focusTimerEl.textContent = studyTimerMode === 'stopwatch'
      ? formatTimerHMS(studyAccumulatedSecs)
      : formatTimerHMS(pomoRemainingSecs);
  }
  if (focusTimerBtn) {
    focusTimerBtn.textContent = studyTimerRunning ? 'Pause' : 'Start';
  }
  const execTimerVal = document.getElementById('exec-timer-val');
  const execTimerState = document.getElementById('exec-timer-state');
  const execTimerSub = document.getElementById('exec-timer-sub');
  if (execTimerVal) {
    execTimerVal.textContent = studyTimerMode === 'stopwatch'
      ? formatTimerHMS(studyAccumulatedSecs)
      : formatTimerHMS(pomoRemainingSecs);
  }
  if (execTimerState) {
    execTimerState.textContent = studyTimerRunning ? '● LIVE' : 'PAUSED';
    execTimerState.className = studyTimerRunning ? 'text-[#047857] font-bold' : 'text-[#436152]';
  }
  if (execTimerSub) {
    const hrs = (studyAccumulatedSecs / 3600).toFixed(2);
    execTimerSub.textContent = `${hrs}h banked · [T] toggle`;
  }
}

// Visual-only mode switch (safe to call during restore, never touches a running clock).
function applyStudyTimerModeUI(mode) {
  studyTimerMode = (mode === 'pomodoro') ? 'pomodoro' : 'stopwatch';
  const swBtn = document.getElementById('study-timer-mode-sw');
  const pomoBtn = document.getElementById('study-timer-mode-pomo');
  const pomoCfg = document.getElementById('study-pomo-config');

  if (studyTimerMode === 'pomodoro') {
    if (swBtn) swBtn.classList.remove('active-view');
    if (pomoBtn) pomoBtn.classList.add('active-view');
    if (pomoCfg) pomoCfg.classList.remove('hidden');
    const wIn = document.getElementById('pomo-work-mins');
    const bIn = document.getElementById('pomo-break-mins');
    if (wIn) wIn.value = pomoWorkMins;
    if (bIn) bIn.value = pomoBreakMins;
  } else {
    if (swBtn) swBtn.classList.add('active-view');
    if (pomoBtn) pomoBtn.classList.remove('active-view');
    if (pomoCfg) pomoCfg.classList.add('hidden');
  }
  updateStudyTimerUI();
}

function setStudyTimerMode(mode) {
  if (studyTimerRunning) toggleStudyTimer();
  if (mode === 'pomodoro') {
    pomoPhase = 'WORK';
    pomoRemainingSecs = pomoWorkMins * 60;
  }
  applyStudyTimerModeUI(mode);
  persistTimerState();
}

function setPomodoroPreset(workM, breakM) {
  pomoWorkMins = workM;
  pomoBreakMins = breakM;
  const wIn = document.getElementById('pomo-work-mins');
  const bIn = document.getElementById('pomo-break-mins');
  if (wIn) wIn.value = workM;
  if (bIn) bIn.value = breakM;
  pomoPhase = 'WORK';
  pomoRemainingSecs = workM * 60;
  if (studyTimerRunning) toggleStudyTimer();
  updateStudyTimerUI();
  persistTimerState();
}

function updateCustomPomodoroSettings() {
  const wIn = parseInt(document.getElementById('pomo-work-mins')?.value, 10) || 25;
  const bIn = parseInt(document.getElementById('pomo-break-mins')?.value, 10) || 5;
  setPomodoroPreset(Math.max(1, wIn), Math.max(1, bIn));
}

// Starts (or restarts) the 1s tick. Delta-based, so a throttled/background tab and a
// sleeping laptop both stay accurate while the page is open.
function startStudyTimerInterval() {
  if (studyTimerInterval) clearInterval(studyTimerInterval);
  studyTimerLastTickMs = Date.now();
  studyTimerInterval = setInterval(() => {
    const nowMs = Date.now();
    const deltaSecs = Math.max(0, Math.round((nowMs - studyTimerLastTickMs) / 1000));
    studyTimerLastTickMs = nowMs;

    if (studyTimerMode === 'stopwatch') {
      studyAccumulatedSecs += deltaSecs;
    } else {
      if (pomoPhase === 'WORK') {
        studyAccumulatedSecs += deltaSecs;
      }
      pomoRemainingSecs -= deltaSecs;
      if (pomoRemainingSecs <= 0) {
        if (pomoPhase === 'WORK') {
          pomoPhase = 'BREAK';
          pomoRemainingSecs = pomoBreakMins * 60;
          showToast('POMODORO COMPLETE', `Focus block done! Starting ${pomoBreakMins}m break.`);
        } else {
          pomoPhase = 'WORK';
          pomoRemainingSecs = pomoWorkMins * 60;
          showToast('BREAK COMPLETE', `Break finished! Starting ${pomoWorkMins}m focus block.`);
        }
      }
    }

    timerTicksSincePersist += 1;
    if (timerTicksSincePersist >= TIMER_PERSIST_EVERY_TICKS) {
      timerTicksSincePersist = 0;
      persistTimerAccumulatedSecs();
      persistTimerState();
    }
    updateStudyTimerUI();
  }, 1000);
}

// Never lose more than a few seconds: flush the moment the tab is hidden, backgrounded
// or closed (pagehide also covers the mobile app-switcher path).
function flushTimerPersistence() {
  if (!studyTimerRunning) return;
  timerTicksSincePersist = 0;
  persistTimerAccumulatedSecs();
  persistTimerState();
}
window.addEventListener('pagehide', flushTimerPersistence);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushTimerPersistence();
  else if (studyTimerRunning) { studyTimerLastTickMs = Date.now(); }
});

function toggleStudyTimer() {
  studyTimerRunning = !studyTimerRunning;
  if (studyTimerRunning) {
    startStudyTimerInterval();
  } else {
    if (studyTimerInterval) clearInterval(studyTimerInterval);
    studyTimerInterval = null;
    persistTimerAccumulatedSecs();
  }
  persistTimerState();
  updateStudyTimerUI();
}

// Restores the clock after a reload. Resumes ticking but never credits the closed window.
function restoreTimerState() {
  let state = null;
  try {
    state = JSON.parse(localStorage.getItem(TIMER_STATE_KEY) || 'null');
  } catch (e) {
    state = null;
  }
  if (!state) return;

  pomoWorkMins = Math.max(1, Number(state.workMins) || 25);
  pomoBreakMins = Math.max(1, Number(state.breakMins) || 5);
  pomoPhase = state.phase === 'BREAK' ? 'BREAK' : 'WORK';
  const restoredRemaining = Number(state.pomoRemainingSecs);
  pomoRemainingSecs = Number.isFinite(restoredRemaining) && restoredRemaining > 0
    ? restoredRemaining
    : pomoWorkMins * 60;

  // A session from a previous day is discarded rather than silently resumed.
  if (state.date !== getLocalDateString(new Date())) {
    applyStudyTimerModeUI('stopwatch');
    return;
  }

  applyStudyTimerModeUI(state.mode);

  if (state.running) {
    studyTimerRunning = true;
    startStudyTimerInterval();
    updateStudyTimerUI();
    const awaySecs = Math.max(0, Math.round((Date.now() - (Number(state.savedAt) || Date.now())) / 1000));
    showToast(
      'TIMER RESUMED',
      awaySecs > 90
        ? `Session restored (${formatTimerHMS(studyAccumulatedSecs)}). The ${Math.floor(awaySecs / 60)}m the page was closed was NOT added.`
        : `Session restored (${formatTimerHMS(studyAccumulatedSecs)}).`
    );
  }
}

function resetStudyTimer() {
  if (studyTimerRunning) toggleStudyTimer();
  studyAccumulatedSecs = 0;
  pomoPhase = 'WORK';
  pomoRemainingSecs = pomoWorkMins * 60;
  persistTimerAccumulatedSecs();
  persistTimerState();
  updateStudyTimerUI();
}

async function commitTimerToStudyLedger() {
  if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to commit timer hours.', true);
  if (studyAccumulatedSecs < 10) {
    return showToast('TIMER EMPTY', 'Record at least a few seconds of study before committing.', true);
  }
  if (studyTimerRunning) toggleStudyTimer();

  const todayStr = getLocalDateString(new Date());
  const existingRow = globalStudyRows.find(r => r.date === todayStr);
  const existingHours = existingRow ? Number(existingRow.actual_hours) || 0 : 0;
  const addedHours = studyAccumulatedSecs / 3600;
  const newTotalHours = existingHours + addedHours;

  const { error } = await supabaseClient
    .from('study_ledger')
    .upsert({
      date: todayStr,
      actual_hours: newTotalHours,
      target_hours: getStudyBaseGoalForDate(todayStr),
      source: 'timer'
    }, { onConflict: 'date' });

  if (error) {
    showToast('DATABASE ERROR', error.message, true);
  } else {
    const committedSecs = studyAccumulatedSecs;
    resetStudyTimer();
    showToast('SESSION COMMITTED', `Added ${formatHours(committedSecs / 3600)} to ${todayStr} (Total today: ${formatHours(newTotalHours)}).`);
    fetchAndRenderStudy();
  }
}

// ==========================================
// 10J. ADVANCED TELEMETRY ANALYTICS (DTI, MDD, VaR, QUARTILES, KINETIC RATIO, YIELD & PASSES)
// ==========================================
let studyEmaChartInstance = null;
let stepsEmaChartInstance = null;
let globalYieldRows = []; // rows from operational_yield_ledger

function calcStandardDeviation(values) {
  if (!values || values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calcPercentile(sortedArr, q) {
  if (!sortedArr || sortedArr.length === 0) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedArr[base + 1] !== undefined) {
    return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
  }
  return sortedArr[base];
}

function calcEMA(values, period = 7) {
  if (!values || values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcPearsonCorrelation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

// Standard Normal CDF approximation for Value at Risk (VaR) probability
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

// Local caches for redeemed passes & pass-fulfilled target dates
let localRedeemedPassesMap = {};
let localPassUsedDatesMap = {}; // dateStr -> { study: boolean, steps: boolean }
try {
  const savedRedemptions = JSON.parse(localStorage.getItem('autumn_redeemed_passes_map') || '{}');
  if (savedRedemptions && typeof savedRedemptions === 'object') {
    localRedeemedPassesMap = savedRedemptions;
  }
  const savedUsedDates = JSON.parse(localStorage.getItem('autumn_pass_used_dates_map') || '{}');
  if (savedUsedDates && typeof savedUsedDates === 'object') {
    localPassUsedDatesMap = savedUsedDates;
  }
} catch (e) {}

// Checks if a specific date (and optional module 'study'|'steps') had a Quota Pass used on it
function isPassUsedOnDate(dateStr, moduleName = null) {
  if (!dateStr) return false;
  const sRow = globalStudyRows.find(r => r.date === dateStr);
  const stRow = globalStepsRows.find(r => r.date === dateStr);
  const localLock = localPassUsedDatesMap[dateStr] || {};

  const studyUsed = Boolean((sRow && sRow.source === 'pass_redeemed') || localLock.study);
  const stepsUsed = Boolean((stRow && stRow.source === 'pass_redeemed') || localLock.steps);

  if (moduleName === 'study') return studyUsed;
  if (moduleName === 'steps') return stepsUsed;
  return studyUsed || stepsUsed;
}

// Clears the pass-used lock when the owner manually updates Study or Steps on that date
function clearPassUsedLockForDate(dateStr, moduleName) {
  if (!dateStr || !localPassUsedDatesMap[dateStr]) return;
  if (moduleName === 'study') delete localPassUsedDatesMap[dateStr].study;
  if (moduleName === 'steps') delete localPassUsedDatesMap[dateStr].steps;
  if (!localPassUsedDatesMap[dateStr].study && !localPassUsedDatesMap[dateStr].steps) {
    delete localPassUsedDatesMap[dateStr];
  }
  try {
    localStorage.setItem('autumn_pass_used_dates_map', JSON.stringify(localPassUsedDatesMap));
  } catch (e) {}
}

// Dual-Module Operational Score (v1.3.0 — surplus/debt aware, uncapped extras when balanced)
// BASELINE (per module, per day) = the ledger's computed target, i.e. base goal ± the carried
//   debt/surplus, floored at 25% of the base goal. 7 h with 2.7 h banked → 4.3 h.
// 1. Base Execution (80 pts max): 50 * min(1, Study/Baseline) + 30 * min(1, Steps/Baseline)
// 2. Uncapped Extra Points (1.0x full linear rate, NO cap when everything is satisfied):
//    rawExtraPts = 50 * max(0, Study/Baseline - 1) + 30 * max(0, Steps/Baseline - 1)
//    - If both baselines are met (studyRatio >= 1 && stepsRatio >= 1), balanced (|studyRatio - stepsRatio| <= 0.25),
//      and zero penalties exist (totalPenalty === 0), 100% of rawExtraPts are awarded with zero diminishing returns and zero cap.
//    - If unbalanced (|studyRatio - stepsRatio| > 0.25), or a baseline is unmet, or penalties exist, extra points are penalized proportionally.
// 3. Verified Discipline (20 max pts):
//    - Dual-Quota Synergy (0–8 pts): 8 * min(1, studyRatio) * min(1, stepsRatio)
//    - 7D Consistency & Streak (0–7 pts): up to 3.5 pts for low 7D volatility + 0.5 pt per consecutive dual-quota day (up to 3.5 pts)
//    - Zero-Debt & Deadline Integrity (0–5 pts): 5 * overallCompletion - debtPenalty - overduePenalty - missingModulePenalty
// 4. Surplus Boost (0–10 pts, v1.3.0): capped +6 study / +4 steps, proportional to how much of a
//    full base goal the carried surplus is worth and scaled by attainment.
function computeDailyOperationalYield(dateStr, overrides) {
  const sRow = globalStudyRows.find(r => r.date === dateStr);
  const stRow = globalStepsRows.find(r => r.date === dateStr);

  // `overrides` powers the planner's WHAT-IF projection (nothing is persisted).
  const studyActual = (overrides && overrides.studyActual !== undefined && overrides.studyActual !== null)
    ? Math.max(0, Number(overrides.studyActual) || 0)
    : (sRow ? Number(sRow.actual_hours) || 0 : 0);
  // v1.3.0 — score against the debt/surplus-adjusted target, floored at 25% of the base.
  const studyScoreBase = resolveScoringBaseline(dateStr, globalStudyRows, getStudyBaseGoalForDate, MAX_DAILY);
  const stepsScoreBase = resolveScoringBaseline(dateStr, globalStepsRows, getStepsBaseGoalForDate, STEPS_MAX_DAILY);
  const studyBaseTarget = studyScoreBase.baseline || (getStudyBaseGoalForDate(dateStr) || 7);
  const stepsActual = (overrides && overrides.stepsActual !== undefined && overrides.stepsActual !== null)
    ? Math.max(0, Number(overrides.stepsActual) || 0)
    : (stRow ? Number(stRow.actual_steps) || 0 : 0);
  const stepsBaseTarget = stepsScoreBase.baseline || (getStepsBaseGoalForDate(dateStr) || 10000);

  const hasStudy = studyActual > 0;
  const hasSteps = stepsActual > 0;
  const passUsedOnThisDay = isPassUsedOnDate(dateStr);

  if (!hasStudy && !hasSteps) {
    return {
      date: dateStr,
      score: 0,
      grade: 'D',
      standing: 'FAIL',
      passEarned: 'NONE',
      isPassUsedDay: passUsedOnThisDay,
      disciplineBreakdown: '0.0/20',
      studyActual: 0,
      studyTarget: Math.round(studyBaseTarget * 100) / 100,
      stepsTarget: Math.round(stepsBaseTarget),
      surplusBoost: 0,
      studySurplus: Math.round(studyScoreBase.surplus * 100) / 100,
      stepsSurplus: Math.round(stepsScoreBase.surplus),
      stepsActual: 0
    };
  }

  const studyRatio = studyBaseTarget > 0 ? studyActual / studyBaseTarget : 0;
  const stepsRatio = stepsBaseTarget > 0 ? stepsActual / stepsBaseTarget : 0;

  // 1. Base Execution Points (50 for Study, 30 for Steps)
  const sHit = Math.min(1, studyRatio);
  const stHit = Math.min(1, stepsRatio);
  const studyBasePts = 50 * sHit;
  const stepsBasePts = 30 * stHit;

  // 2. Verified 20-Point Discipline & Penalties Calculation
  // (A) Dual-Quota Synergy (0 to 8 pts)
  const synergyPts = 8 * (sHit * stHit);

  // (B) Rolling 7-Day Consistency (0 to 3.5 pts) + Consecutive Dual-Clear Streak (0 to 3.5 pts)
  const studyHistoryUpToDate = globalStudyRows.filter(r => r.date <= dateStr).slice(-7);
  const stepsHistoryUpToDate = globalStepsRows.filter(r => r.date <= dateStr).slice(-7);

  let consistencyPts = 1.5; // conservative baseline until >=3 days are logged
  if (studyHistoryUpToDate.length >= 3) {
    const hrsArr = studyHistoryUpToDate.map(r => Number(r.actual_hours) || 0);
    const sigma7 = calcStandardDeviation(hrsArr);
    const stabilityRatio = Math.max(0, Math.min(1, 1 - (sigma7 / 4.5)));
    consistencyPts = 3.5 * stabilityRatio;
  } else if (stepsHistoryUpToDate.length >= 3) {
    const stpArr = stepsHistoryUpToDate.map(r => Number(r.actual_steps) || 0);
    const sigmaStp = calcStandardDeviation(stpArr);
    const stabilityRatio = Math.max(0, Math.min(1, 1 - (sigmaStp / 6000)));
    consistencyPts = 3.5 * stabilityRatio;
  }

  let streakDays = 0;
  const combinedDatesUpTo = Array.from(new Set([
    ...studyHistoryUpToDate.map(r => r.date),
    ...stepsHistoryUpToDate.map(r => r.date)
  ])).sort();
  for (let i = combinedDatesUpTo.length - 1; i >= 0; i--) {
    const dKey = combinedDatesUpTo[i];
    const sr = globalStudyRows.find(r => r.date === dKey);
    const str = globalStepsRows.find(r => r.date === dKey);
    const sBase = resolveScoringBaseline(dKey, globalStudyRows, getStudyBaseGoalForDate, MAX_DAILY).baseline;
    const stBase = resolveScoringBaseline(dKey, globalStepsRows, getStepsBaseGoalForDate, STEPS_MAX_DAILY).baseline;
    const sOk = sr && sr.actual_hours >= sBase * 0.9;
    const stOk = str && str.actual_steps >= stBase * 0.85;
    if (sOk && stOk) streakDays++;
    else break;
  }
  const streakPts = Math.min(3.5, streakDays * 0.5);
  const totalConsistencyPts = Math.min(7, consistencyPts + streakPts);

  // (C) Zero-Debt & Deadline Integrity (0 to 5 pts) minus Verified Penalties
  const overallQuotaCompletion = 0.625 * sHit + 0.375 * stHit;
  const integrityPts = 5.0 * overallQuotaCompletion;

  const studyOverflow = sRow && isOfficialLedgerDate(dateStr) ? Math.max(0, Number(sRow.computed_overflow) || 0) : 0;
  const stepsOverflow = stRow && isOfficialLedgerDate(dateStr) ? Math.max(0, Number(stRow.computed_overflow) || 0) : 0;
  const debtPenalty = Math.min(8, (studyOverflow * 0.75) + ((stepsOverflow / 2500) * 0.75));

  const missingModulePenalty = (!hasStudy || !hasSteps) ? 6.0 : 0;

  let overduePenalty = 0;
  const todayStr = getLocalDateString(new Date());
  if (dateStr === todayStr && typeof evaluateTaskDeadline === 'function') {
    const overdueCount = (globalTaskItems || []).filter(t => {
      if (t.is_done) return false;
      const m = getTaskMeta(t.id);
      const ev = m.dueDate ? evaluateTaskDeadline(m.dueDate) : null;
      return ev && ev.diffDays < 0;
    }).length;
    overduePenalty = Math.min(6, overdueCount * 1.5);
  }

  const totalPenalty = debtPenalty + missingModulePenalty + overduePenalty;
  const netDisciplinePts = Math.max(-12, Math.min(20, synergyPts + totalConsistencyPts + integrityPts - totalPenalty));

  // 3. Uncapped Full-Rate Extra Points (1.0x linear scale, NO cap when satisfied & balanced)
  const rawExtraStudyPts = studyRatio > 1 ? 50 * (studyRatio - 1) : 0;
  const rawExtraStepsPts = stepsRatio > 1 ? 30 * (stepsRatio - 1) : 0;
  const rawExtraTotalPts = rawExtraStudyPts + rawExtraStepsPts;

  let extraPtsRetention = 1.0;
  // Penalty 1 on Extra Points: Unmet Base Quota in the other module
  if (sHit < 1 || stHit < 1) {
    extraPtsRetention *= Math.pow(sHit * stHit, 2);
  }
  // Penalty 2 on Extra Points: Too Unbalanced between Study ratio and Steps ratio (gap > 0.25)
  const ratioGap = Math.abs(studyRatio - stepsRatio);
  if (ratioGap > 0.25) {
    const excessImbalance = ratioGap - 0.25;
    const imbalanceFactor = Math.max(0.10, 1 - (excessImbalance * 1.15));
    extraPtsRetention *= imbalanceFactor;
  }
  // Penalty 3 on Extra Points: Active spillover debt, overdue tasks, or missing module penalties
  if (totalPenalty > 0) {
    const activePenaltyFactor = Math.max(0, 1 - (totalPenalty / 8));
    extraPtsRetention *= activePenaltyFactor;
  }

  const netExtraPts = rawExtraTotalPts * extraPtsRetention;

  // 4. Surplus boost (v1.3.0) — a small, capped award proportional to the credit the day
  //    opened with, on top of the lower baseline that credit already earned.
  const studySurplusBoostPts = computeSurplusBoostPts(studyScoreBase.surplus, studyScoreBase.base, studyRatio, SURPLUS_BOOST_MAX_PTS.study);
  const stepsSurplusBoostPts = computeSurplusBoostPts(stepsScoreBase.surplus, stepsScoreBase.base, stepsRatio, SURPLUS_BOOST_MAX_PTS.steps);
  const surplusBoostPts = studySurplusBoostPts + stepsSurplusBoostPts;

  const rawScore = studyBasePts + stepsBasePts + netExtraPts + netDisciplinePts + surplusBoostPts;
  const score = Math.max(0, Math.round(rawScore));

  // Grade Thresholds: A+ > 100, A 95–100, A- 85–94 (Passing, No Pass), B 75–84, C 60–74, D 0–59
  let grade = 'D';
  let standing = 'FAIL';
  let passEarned = 'NONE';

  if (score > 100) {
    grade = 'A+';
    standing = 'PASSING GRADE';
    passEarned = passUsedOnThisDay ? 'NONE' : 'APLUS';
  } else if (score >= 95) {
    grade = 'A';
    standing = 'PASSING GRADE';
    passEarned = passUsedOnThisDay ? 'NONE' : 'A';
  } else if (score >= 85) {
    grade = 'A-';
    standing = 'PASSING GRADE';
    passEarned = 'NONE';
  } else if (score >= 75) {
    grade = 'B';
    standing = 'PASSING GRADE';
    passEarned = 'NONE';
  } else if (score >= 60) {
    grade = 'C';
    standing = 'PASSING GRADE';
    passEarned = 'NONE';
  } else {
    grade = 'D';
    standing = 'FAIL';
    passEarned = 'NONE';
  }

  return {
    date: dateStr,
    score,
    grade,
    standing,
    passEarned,
    isPassUsedDay: passUsedOnThisDay,
    disciplineBreakdown: `${netDisciplinePts.toFixed(1)}/20`,
    studyActual,
    studyTarget: Math.round(studyBaseTarget * 100) / 100,
    stepsTarget: Math.round(stepsBaseTarget),
    surplusBoost: Math.round(surplusBoostPts * 10) / 10,
    studySurplus: Math.round(studyScoreBase.surplus * 100) / 100,
    stepsSurplus: Math.round(stepsScoreBase.surplus),
    stepsActual
  };
}

// Parses how many [A+] and [A] pass units remain on a graded day record
// An A+ pass is worth 1 [A+] pass OR can be split into 2 [A] passes
function getPassRecordRemainingUnits(rec) {
  if (!rec || rec.isPassUsedDay || rec.pass_earned === 'NONE') {
    return { aPlusLeft: 0, aLeft: 0, statusLabel: rec?.isPassUsedDay ? 'PASS USED ON THIS DAY (INELIGIBLE)' : '—' };
  }
  const rFor = String(rec.redeemed_for || '');
  if (rec.pass_earned === 'A') {
    if (rec.pass_redeemed) {
      return { aPlusLeft: 0, aLeft: 0, statusLabel: `USED ([A] → ${rFor})` };
    }
    return { aPlusLeft: 0, aLeft: 1, statusLabel: ' +1 [A] AVAILABLE' };
  }
  if (rec.pass_earned === 'APLUS') {
    if (rec.pass_redeemed || rFor.startsWith('APLUS_BOTH') || rFor.startsWith('SPLIT:2')) {
      return { aPlusLeft: 0, aLeft: 0, statusLabel: `USED (${rFor.startsWith('SPLIT') ? '2×[A]' : '[A+] DUAL'})` };
    }
    if (rFor.startsWith('SPLIT:1')) {
      return { aPlusLeft: 0, aLeft: 1, statusLabel: ' 1/2 [A] LEFT (FROM [A+])' };
    }
    if (rFor.startsWith('SPLIT:0')) {
      return { aPlusLeft: 0, aLeft: 2, statusLabel: ' 2×[A] AVAILABLE (SPLIT [A+])' };
    }
    return { aPlusLeft: 1, aLeft: 0, statusLabel: ' +1 [A+] AVAILABLE (= 2×[A])' };
  }
  return { aPlusLeft: 0, aLeft: 0, statusLabel: '—' };
}

// Retroactively merges & grades EVERY inputted date
function getMergedOfficialGradeRecords() {
  const mergedByDate = {};
  const dbRedemptionMap = { ...localRedeemedPassesMap };

  globalYieldRows.forEach(r => {
    if (r && r.date) {
      if (r.pass_redeemed || (r.redeemed_for && r.redeemed_for.trim() !== '')) {
        dbRedemptionMap[r.date] = {
          pass_redeemed: Boolean(r.pass_redeemed),
          redeemed_for: r.redeemed_for || ''
        };
      }
      // Also detect target dates where passes were redeemed from redeemed_for strings
      const matches = String(r.redeemed_for || '').match(/(A_STUDY|A_STEPS|APLUS_BOTH):(\d{4}-\d{2}-\d{2})/g);
      if (matches) {
        matches.forEach(token => {
          const [mType, mDate] = token.split(':');
          if (mDate) {
            if (!localPassUsedDatesMap[mDate]) localPassUsedDatesMap[mDate] = {};
            if (mType === 'A_STUDY' || mType === 'APLUS_BOTH') localPassUsedDatesMap[mDate].study = true;
            if (mType === 'A_STEPS' || mType === 'APLUS_BOTH') localPassUsedDatesMap[mDate].steps = true;
          }
        });
      }
    }
  });

  const allInputtedDates = Array.from(new Set([
    ...getPhaseActiveRows(globalStudyRows).filter(r => !r.is_gap_day).map(r => r.date),
    ...getPhaseActiveRows(globalStepsRows).filter(r => !r.is_gap_day).map(r => r.date),
    ...Object.keys(localPassUsedDatesMap)
  ]));

  allInputtedDates.forEach(dStr => {
    const comp = computeDailyOperationalYield(dStr);
    if (comp.studyActual > 0 || comp.stepsActual > 0 || comp.isPassUsedDay) {
      const savedState = dbRedemptionMap[dStr] || { pass_redeemed: false, redeemed_for: '' };
      mergedByDate[dStr] = {
        date: dStr,
        score: comp.score,
        grade: comp.grade,
        standing: comp.standing,
        pass_earned: comp.passEarned,
        isPassUsedDay: comp.isPassUsedDay,
        pass_redeemed: Boolean(savedState.pass_redeemed),
        redeemed_for: savedState.redeemed_for || ''
      };
    }
  });

  return Object.values(mergedByDate).sort((a, b) => b.date.localeCompare(a.date));
}

function getHighestYieldDayRecord() {
  const records = getMergedOfficialGradeRecords();
  if (records.length === 0) return null;
  return records.slice().sort((a, b) => b.score - a.score)[0];
}

function getAvailableQuotaPasses() {
  const allItems = getMergedOfficialGradeRecords();
  const availA = [];     // Each entry represents 1 available [A] pass unit
  const availAPlus = []; // Each entry represents 1 available unsplit [A+] pass

  allItems.forEach(rec => {
    const units = getPassRecordRemainingUnits(rec);
    if (units.aPlusLeft > 0) {
      availAPlus.push(rec);
    }
    for (let i = 0; i < units.aLeft; i++) {
      availA.push(rec);
    }
  });

  return { availA, availAPlus };
}

function renderQuotaPassWallet() {
  const { availA, availAPlus } = getAvailableQuotaPasses();
  const bestRec = getHighestYieldDayRecord();

  const elA = document.getElementById('pass-count-a');
  const elAPlus = document.getElementById('pass-count-aplus');
  const statusEl = document.getElementById('pass-wallet-status');
  const sideBestEl = document.getElementById('sidebar-best-yield-record');
  const headerBestEl = document.getElementById('grades-best-day-badge');

  if (elA) elA.textContent = String(availA.length);
  if (elAPlus) elAPlus.textContent = String(availAPlus.length);

  if (bestRec) {
    if (sideBestEl) sideBestEl.textContent = `${bestRec.score} pts [${bestRec.grade}] (${bestRec.date})`;
    if (headerBestEl) headerBestEl.textContent = ` RECORD HIGHEST DAY: ${bestRec.score} PTS [${bestRec.grade}] (${bestRec.date})`;
  } else {
    if (sideBestEl) sideBestEl.textContent = '-- pts';
    if (headerBestEl) headerBestEl.textContent = ' RECORD HIGHEST DAY: -- PTS';
  }

  if (statusEl) {
    const totalGraded = getMergedOfficialGradeRecords().length;
    statusEl.textContent = `Graded ${totalGraded} day(s) • ${availA.length} [A] & ${availAPlus.length} [A+] available (1 [A+] = 2 [A])`;
  }
}

function renderGradesHistoryTable() {
  const tbody = document.getElementById('grades-history-tbody');
  const sumEl = document.getElementById('grades-history-summary');
  if (!tbody) return;

  const records = getMergedOfficialGradeRecords();
  const { availA, availAPlus } = getAvailableQuotaPasses();
  if (sumEl) {
    sumEl.textContent = `${records.length} DAYS GRADED • ${availA.length} [A] / ${availAPlus.length} [A+] AVAILABLE`;
  }

  if (records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-6 text-[#56735f] font-mono-tech text-xs">
          No graded days logged yet. Log study hours or steps to generate your daily operational yield &amp; grade.
        </td>
      </tr>
    `;
    return;
  }

  const bestRec = getHighestYieldDayRecord();

  tbody.innerHTML = records.map(rec => {
    const sRow = globalStudyRows.find(r => r.date === rec.date);
    const stRow = globalStepsRows.find(r => r.date === rec.date);
    const studyH = sRow ? formatHours(sRow.actual_hours) : '0h 0m';
    const stepsC = stRow ? formatSteps(stRow.actual_steps) : '0';
    const isCarryover = isCarryoverWindowDate(rec.date);
    const isBestEver = bestRec && bestRec.date === rec.date && rec.score > 0;

    // v1.3.0 — the score is computed against the surplus/debt-adjusted baseline, so show
    // exactly which baseline a row used (hover the points).
    const gradeBaseline = resolveScoringBaseline(rec.date, globalStudyRows, getStudyBaseGoalForDate, MAX_DAILY);
    const gradeStepsBaseline = resolveScoringBaseline(rec.date, globalStepsRows, getStepsBaseGoalForDate, STEPS_MAX_DAILY);
    const baselineTitle = 'Scored against ' + formatHours(gradeBaseline.baseline) + ' study / ' +
      formatSteps(gradeStepsBaseline.baseline) + ' steps' +
      (gradeBaseline.surplus > 0 ? ' · study surplus credit ' + formatHours(gradeBaseline.surplus) : '') +
      (gradeStepsBaseline.surplus > 0 ? ' · steps surplus credit ' + formatSteps(gradeStepsBaseline.surplus) : '') +
      ' (floor = 25% of the base goal)';

    const gradeBadgeClass = rec.grade === 'A+'
      ? 'badge-green'
      : rec.grade === 'A'
        ? 'badge-blue'
        : rec.grade === 'A-'
          ? 'badge-purple'
          : rec.grade === 'B'
            ? 'badge-neutral'
            : rec.grade === 'C'
              ? 'badge-amber'
              : 'badge-red';

    const standingBadge = rec.standing === 'FAIL'
      ? `<span class="tech-badge badge-red !text-[8px] !py-0 !px-1">FAIL</span>`
      : `<span class="tech-badge badge-green !text-[8px] !py-0 !px-1">PASSING</span>`;

    const unitsInfo = getPassRecordRemainingUnits(rec);
    let passHtml = '<span class="text-[#56735f]">—</span>';
    if (rec.isPassUsedDay) {
      passHtml = `<span class="tech-badge badge-amber !text-[9px]"> PASS USED (INELIGIBLE)</span>`;
    } else if (rec.pass_earned === 'APLUS' || rec.pass_earned === 'A') {
      const isAvail = unitsInfo.aPlusLeft > 0 || unitsInfo.aLeft > 0;
      passHtml = `<span class="tech-badge ${isAvail ? 'badge-green' : 'badge-neutral'} !text-[9px]">${escapeHtml(unitsInfo.statusLabel)}</span>`;
    }

    const rowHighlightClass = rec.isPassUsedDay
      ? 'bg-[#fef3c7]/70 border-l-4 border-l-[#f59e0b]'
      : isBestEver
        ? 'bg-[#dcfce7]/45'
        : '';

    return `
      <tr class="${rowHighlightClass}">
        <td class="font-semibold align-middle">
          <div class="flex items-center gap-1 flex-wrap">
            <span>${rec.date}</span>
            ${isBestEver ? `<span class="tech-badge badge-green !text-[8px] !py-0 !px-1">RECORD</span>` : ''}
          </div>
          ${isCarryover ? `<span class="tech-badge badge-blue !text-[8px] !py-0 !px-1 mt-0.5">→ NOV CARRYOVER</span>` : ''}
          <div class="sm:hidden font-mono-tech text-[10px] text-[#436152] mt-0.5">${studyH} • ${stepsC} stp</div>
        </td>
        <td class="hidden sm:table-cell align-middle">${studyH}</td>
        <td class="hidden sm:table-cell align-middle">${stepsC}</td>
        <td class="font-bold align-middle" title="${escapeHtml(baselineTitle)}">${rec.score} pts</td>
        <td class="align-middle">
          <div class="flex items-center gap-1 flex-wrap">
            <span class="tech-badge ${gradeBadgeClass} font-bold">${rec.grade}</span>
            ${standingBadge}
          </div>
        </td>
        <td class="align-middle">${passHtml}</td>
      </tr>
    `;
  }).join('');
}

// Renders the Grade Distribution table: percentage of graded days per grade tier
function renderGradeDistributionTable() {
  const tbody = document.getElementById('grades-distribution-tbody');
  const sumEl = document.getElementById('grades-distribution-summary');
  if (!tbody) return;

  const records = getMergedOfficialGradeRecords();

  // Canonical grade tiers (matches the Grade Reference Rubric), highest to lowest
  const gradeTiers = [
    { grade: 'A+', band: '> 100 (101+)', badge: 'badge-green' },
    { grade: 'A',  band: '95 – 100',     badge: 'badge-blue' },
    { grade: 'A-', band: '85 – 94',      badge: 'badge-purple' },
    { grade: 'B',  band: '75 – 84',      badge: 'badge-neutral' },
    { grade: 'C',  band: '60 – 74',      badge: 'badge-amber' },
    { grade: 'D',  band: '0 – 59',       badge: 'badge-red' }
  ];

  const totalDays = records.length;
  const counts = {};
  gradeTiers.forEach(t => { counts[t.grade] = 0; });
  records.forEach(rec => {
    const g = rec.grade || 'D';
    counts[g] = (counts[g] || 0) + 1;
  });

  if (sumEl) {
    sumEl.textContent = `${totalDays} DAY${totalDays === 1 ? '' : 'S'} GRADED`;
  }

  if (totalDays === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-6 text-[#56735f] font-mono-tech text-xs">
          No graded days logged yet. Log study hours or steps to see your grade distribution.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = gradeTiers.map(t => {
    const count = counts[t.grade] || 0;
    const pct = totalDays > 0 ? (count / totalDays) * 100 : 0;
    const pctLabel = pct.toFixed(1);
    const barColor = t.grade === 'A+'
      ? 'bg-[#059669]'
      : t.grade === 'A'
        ? 'bg-[#0284c7]'
        : t.grade === 'A-'
          ? 'bg-[#6b21a8]'
          : t.grade === 'B'
            ? 'bg-[#047857]'
            : t.grade === 'C'
              ? 'bg-[#d97706]'
              : 'bg-[#dc2626]';

    return `
      <tr class="${count === 0 ? 'bg-[#f4faf6]' : ''}">
        <td class="align-middle"><span class="tech-badge ${t.badge} font-bold">${t.grade}</span></td>
        <td class="font-mono-tech text-[11px] text-[#436152] whitespace-nowrap align-middle">${t.band}</td>
        <td class="font-bold align-middle">${count}</td>
        <td class="font-bold align-middle">${pctLabel}%</td>
        <td class="align-middle">
          <div class="w-full min-w-[80px] h-2 bg-[#e8f3ec] border border-[#c5ded0]">
            <div class="h-full ${barColor}" style="width: ${pct.toFixed(1)}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function persistPassRecordState(dateKey, scoreVal, gradeVal, passEarnedVal, isFullyRedeemed, redeemedForStr) {
  localRedeemedPassesMap[dateKey] = {
    pass_redeemed: Boolean(isFullyRedeemed),
    redeemed_for: redeemedForStr
  };
  try {
    localStorage.setItem('autumn_redeemed_passes_map', JSON.stringify(localRedeemedPassesMap));
  } catch (e) {}

  const existingIdx = globalYieldRows.findIndex(r => r.date === dateKey);
  const updatedRow = {
    date: dateKey,
    score: scoreVal,
    grade: gradeVal,
    pass_earned: passEarnedVal,
    pass_redeemed: Boolean(isFullyRedeemed),
    redeemed_for: redeemedForStr,
    updated_at: new Date().toISOString()
  };
  if (existingIdx >= 0) globalYieldRows[existingIdx] = updatedRow;
  else globalYieldRows.push(updatedRow);

  await supabaseClient.from('operational_yield_ledger').upsert(updatedRow, { onConflict: 'date' });
}

// Explicitly converts 1 available [A+] pass into 2 [A] passes
async function splitAPlusPassToTwoA() {
  if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to convert Quota Passes.', true);
  const { availAPlus } = getAvailableQuotaPasses();
  if (availAPlus.length === 0) {
    return showToast('NO [A+] PASS TO SPLIT', 'You need at least 1 available [A+] pass (score ≥ 97) to split into 2 [A] passes.', true);
  }
  const targetRec = availAPlus[0];
  await persistPassRecordState(targetRec.date, targetRec.score, targetRec.grade, 'APLUS', false, 'SPLIT:0');
  renderQuotaPassWallet();
  renderGradesHistoryTable();
  renderGradeDistributionTable();
  showToast('PASS CONVERTED', `Split 1 [A+] pass from ${targetRec.date} into 2 [A] passes!`);
}

async function fetchAndSyncOperationalYield() {
  const inRealPhase = isRealPhaseActiveNow();

  // Only grade days that belong to the ACTIVE phase. Using the raw arrays here pulled
  // archived "testing phase" rows (pre Oct 30) back into the grade ledger and re-persisted
  // them to operational_yield_ledger even though getPhaseActiveRows() hides them everywhere else.
  // Gap rows carry debt arithmetic ONLY: they are not logged days, so they must never be
  // graded, persisted to operational_yield_ledger, or used as the navbar day reference.
  const activeStudyRows = getPhaseActiveRows(globalStudyRows).filter(r => !r.is_gap_day);
  const activeStepsRows = getPhaseActiveRows(globalStepsRows).filter(r => !r.is_gap_day);

  const allLoggedDates = Array.from(new Set([
    ...activeStudyRows.map(r => r.date),
    ...activeStepsRows.map(r => r.date)
  ])).sort();

  const todayStr = getLocalDateString(new Date());
  const refDateForBadge = (activeStudyRows.some(r => r.date === todayStr) || activeStepsRows.some(r => r.date === todayStr))
    ? todayStr
    : (allLoggedDates[allLoggedDates.length - 1] || todayStr);
  const badgeYield = computeDailyOperationalYield(refDateForBadge);

  const navBadge = document.getElementById('navbar-daily-yield-badge');
  if (navBadge) {
    navBadge.textContent = `DAILY YIELD: ${badgeYield.score} PTS [GRADE: ${badgeYield.grade} • ${badgeYield.standing === 'FAIL' ? 'FAIL' : 'PASS'}]`;
    navBadge.className = `tech-badge cursor-pointer ${
      badgeYield.score >= 90 ? 'badge-green' : badgeYield.score >= 60 ? 'badge-blue' : 'badge-red'
    }`;
    // v1.3.0 — surface the baseline the score was measured against (surplus/debt aware).
    navBadge.title = 'Scored against ' + formatHours(badgeYield.studyTarget || 0) + ' study / ' +
      formatSteps(badgeYield.stepsTarget || 0) + ' steps' +
      (badgeYield.studySurplus > 0 ? ' · study surplus ' + formatHours(badgeYield.studySurplus) : '') +
      (badgeYield.stepsSurplus > 0 ? ' · steps surplus ' + formatSteps(badgeYield.stepsSurplus) : '') +
      (badgeYield.surplusBoost > 0 ? ' · surplus boost +' + badgeYield.surplusBoost + ' pts' : '');
  }
  const sidePill = document.getElementById('study-yield-grade-pill');
  if (sidePill) {
    sidePill.textContent = `YIELD: ${badgeYield.score} PTS [${badgeYield.grade}]`;
  }
  const phaseBadgeEl = document.getElementById('grades-phase-status-badge');
  if (phaseBadgeEl) {
    phaseBadgeEl.textContent = inRealPhase
      ? 'REAL PHASE ACTIVE // OCT 30–31 CARRIED OVER'
      : 'TESTING PHASE // OCT 30–31 CARRY OVER TO NOV 1';
  }

  renderQuotaPassWallet();
  renderGradesHistoryTable();
  renderGradeDistributionTable();

  try {
    const { data, error } = await supabaseClient
      .from('operational_yield_ledger')
      .select('*')
      .order('date', { ascending: true });

    if (!error && Array.isArray(data)) {
      globalYieldRows = data;
    }

    let activeOwner = currentUser;
    if (!activeOwner) {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      activeOwner = sessionData?.session?.user || null;
    }

    if (activeOwner && ledgerDataReady && allLoggedDates.length > 0) {
      const existingMap = {};
      globalYieldRows.forEach(r => { existingMap[r.date] = r; });
      const toUpsert = [];

      allLoggedDates.forEach(dStr => {
        const yInfo = computeDailyOperationalYield(dStr);
        const prev = existingMap[dStr];
        const localRedeem = localRedeemedPassesMap[dStr];
        const isRedeemed = (prev && prev.pass_redeemed) || (localRedeem && localRedeem.pass_redeemed) || false;
        const redeemedFor = (localRedeem && localRedeem.redeemed_for) || (prev && prev.redeemed_for) || '';

        if (yInfo.studyActual > 0 || yInfo.stepsActual > 0) {
          if (!prev || prev.score !== yInfo.score || prev.grade !== yInfo.grade || prev.pass_earned !== yInfo.passEarned) {
            toUpsert.push({
              date: dStr,
              score: yInfo.score,
              grade: yInfo.grade,
              pass_earned: yInfo.passEarned,
              pass_redeemed: Boolean(isRedeemed),
              redeemed_for: redeemedFor,
              updated_at: new Date().toISOString()
            });
          }
        }
      });

      if (toUpsert.length > 0) {
        const { data: updatedRows } = await supabaseClient
          .from('operational_yield_ledger')
          .upsert(toUpsert, { onConflict: 'date' })
          .select('*');
        if (updatedRows) {
          const { data: fullRefresh } = await supabaseClient
            .from('operational_yield_ledger')
            .select('*')
            .order('date', { ascending: true });
          if (fullRefresh) globalYieldRows = fullRefresh;
        }
      }
    }
  } catch (err) {
    console.warn('Operational yield sync note:', err);
  }

  renderQuotaPassWallet();
  renderGradesHistoryTable();
  renderGradeDistributionTable();
}

async function redeemQuotaPass(mode) {
  if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to redeem Quota Passes.', true);
  const { availA, availAPlus } = getAvailableQuotaPasses();
  const targetDate = document.getElementById('date-input')?.value || getLocalDateString(new Date());

  let passRecord = null;
  let nextRedeemedState = true;
  let nextRedeemedFor = '';

  if (mode === 'APLUS_BOTH') {
    if (availAPlus.length > 0) {
      passRecord = availAPlus[0];
      nextRedeemedState = true;
      nextRedeemedFor = `APLUS_BOTH:${targetDate}`;
    } else {
      return showToast('NO [A+] PASS AVAILABLE', 'Earn a Daily Yield above 100 [Grade A+] to unlock a Dual-Module Pass.', true);
    }
  } else if (mode === 'A_STUDY' || mode === 'A_STEPS') {
    if (availA.length > 0) {
      passRecord = availA[0];
      if (passRecord.pass_earned === 'APLUS') {
        // Using 1 unit of a split [A+] pass
        const curFor = String(passRecord.redeemed_for || '');
        if (curFor.startsWith('SPLIT:0')) {
          nextRedeemedState = false;
          nextRedeemedFor = `SPLIT:1|${mode}:${targetDate}`;
        } else {
          nextRedeemedState = true;
          nextRedeemedFor = `SPLIT:2|${curFor.replace('SPLIT:1|', '')}+${mode}:${targetDate}`;
        }
      } else {
        nextRedeemedState = true;
        nextRedeemedFor = `${mode}:${targetDate}`;
      }
    } else if (availAPlus.length > 0) {
      // Automatically split 1 [A+] pass into 2 [A] passes and use 1 now (leaving 1 [A] pass available)
      passRecord = availAPlus[0];
      nextRedeemedState = false;
      nextRedeemedFor = `SPLIT:1|${mode}:${targetDate}`;
    } else {
      return showToast('NO PASS AVAILABLE', 'Earn Grade A (95–100) or A+ (>100) to unlock Quota Passes.', true);
    }
  }

  // Mark targetDate as pass-used so it is highlighted and ineligible to earn a new pass
  if (!localPassUsedDatesMap[targetDate]) localPassUsedDatesMap[targetDate] = {};
  if (mode === 'A_STUDY' || mode === 'APLUS_BOTH') localPassUsedDatesMap[targetDate].study = true;
  if (mode === 'A_STEPS' || mode === 'APLUS_BOTH') localPassUsedDatesMap[targetDate].steps = true;
  try {
    localStorage.setItem('autumn_pass_used_dates_map', JSON.stringify(localPassUsedDatesMap));
  } catch (e) {}

  const baseStudy = getStudyBaseGoalForDate(targetDate);
  const baseSteps = getStepsBaseGoalForDate(targetDate);

  if (mode === 'A_STUDY' || mode === 'APLUS_BOTH') {
    await supabaseClient.from('study_ledger').upsert({
      date: targetDate,
      actual_hours: baseStudy,
      target_hours: baseStudy,
      source: 'pass_redeemed'
    }, { onConflict: 'date' });
  }
  if (mode === 'A_STEPS' || mode === 'APLUS_BOTH') {
    await supabaseClient.from('steps_ledger').upsert({
      date: targetDate,
      actual_steps: baseSteps,
      target_steps: baseSteps,
      source: 'pass_redeemed'
    }, { onConflict: 'date' });
  }

  await persistPassRecordState(
    passRecord.date,
    passRecord.score,
    passRecord.grade,
    passRecord.pass_earned,
    nextRedeemedState,
    nextRedeemedFor
  );

  renderQuotaPassWallet();
  renderGradesHistoryTable();
  renderGradeDistributionTable();
  showToast(
    'QUOTA PASS REDEEMED',
    `Fulfilled ${mode === 'APLUS_BOTH' ? 'Study + Steps' : mode === 'A_STUDY' ? 'Study' : 'Steps'} for ${targetDate} (marked pass-used & ineligible for passes).`
  );
  await Promise.allSettled([fetchAndRenderStudy(), fetchAndRenderSteps(), fetchAndSyncOperationalYield()]);
}


function renderAdvancedTelemetryAnalytics() {
  const activeStudyRows = getPhaseActiveRows(globalStudyRows);
  const activeStepsRows = getPhaseActiveRows(globalStepsRows);
  const globalStudyRowsBackup = globalStudyRows;
  const globalStepsRowsBackup = globalStepsRows;
  globalStudyRows = activeStudyRows;
  globalStepsRows = activeStepsRows;
  try {
  // 1. 30-Day Sedentary vs Cognitive Correlation (r) & Kinetic Ratio
  const stepMap = {};
  globalStepsRows.forEach(r => { stepMap[r.date] = Number(r.actual_steps) || 0; });
  const pairedDates = globalStudyRows.filter(r => stepMap[r.date] !== undefined).slice(-30);
  const corrR = calcPearsonCorrelation(
    pairedDates.map(r => Number(r.actual_hours) || 0),
    pairedDates.map(r => stepMap[r.date])
  );
  const corrDesc = pairedDates.length < 3
    ? 'Need ≥3 paired days'
    : corrR >= 0.25
      ? 'Positive kinetic-cognitive synergy'
      : corrR <= -0.25
        ? 'Inverse trade-off detected'
        : 'Independent / neutral coupling';

  ['study-adv-corr', 'steps-adv-corr'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `r = ${corrR >= 0 ? '+' : ''}${corrR.toFixed(2)}`;
  });
  ['study-adv-corr-sub', 'steps-adv-corr-sub'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${corrDesc} (${pairedDates.length}d paired)`;
  });

  // 2. Risk & Deficit Telemetry: DTI Ratio, Maximum Drawdown (MDD), MTTR, and Value at Risk (VaR)
  const currentDeficit = globalStudyRows.length > 0
    ? Math.max(0, Number(globalStudyRows[globalStudyRows.length - 1].computed_overflow) || 0)
    : 0;
  const dtiRatio = currentDeficit / 49.0;
  const dtiEl = document.getElementById('study-risk-dti');
  const dtiSubEl = document.getElementById('study-risk-dti-sub');
  const dtiBadgeEl = document.getElementById('study-dti-health-badge');

  if (dtiEl) dtiEl.textContent = `DTI = ${dtiRatio.toFixed(2)}`;
  if (dtiRatio < 0.15) {
    if (dtiSubEl) { dtiSubEl.textContent = 'SYS_HEALTH: OPTIMAL (< 0.15)'; dtiSubEl.className = 'font-mono-tech text-[10px] text-[#047857] mt-0.5'; }
    if (dtiBadgeEl) { dtiBadgeEl.textContent = 'SYS_HEALTH: OPTIMAL'; dtiBadgeEl.className = 'tech-badge badge-green'; }
  } else if (dtiRatio <= 0.35) {
    if (dtiSubEl) { dtiSubEl.textContent = 'SYS_ALERT: ELEVATED RISK (0.15–0.35)'; dtiSubEl.className = 'font-mono-tech text-[10px] text-[#92400e] mt-0.5'; }
    if (dtiBadgeEl) { dtiBadgeEl.textContent = 'SYS_ALERT: ELEVATED RISK'; dtiBadgeEl.className = 'tech-badge badge-amber'; }
  } else {
    if (dtiSubEl) { dtiSubEl.textContent = 'CRITICAL DEFICIT // AMORTIZE NOW'; dtiSubEl.className = 'font-mono-tech text-[10px] text-[#b91c1c] font-bold mt-0.5'; }
    if (dtiBadgeEl) { dtiBadgeEl.textContent = 'CRITICAL DEFICIT'; dtiBadgeEl.className = 'tech-badge badge-red'; }
  }

  // Maximum Drawdown (Peak-to-Trough Debt) + Streak Durability + MTTR
  let maxDrawdown = 0;
  let curStreak = 0;
  const streaks = [];
  let recoveryDays = 0;
  let recoveredHours = 0;

  globalStudyRows.forEach((r, idx) => {
    if (r.computed_overflow > maxDrawdown) maxDrawdown = r.computed_overflow;
    const base = getStudyBaseGoalForDate(r.date);
    if (r.actual_hours >= base) {
      curStreak++;
      if (idx > 0 && globalStudyRows[idx - 1].computed_overflow > 0 && r.actual_hours > base) {
        recoveryDays++;
        recoveredHours += (r.actual_hours - base);
      }
    } else {
      if (curStreak > 0) streaks.push(curStreak);
      curStreak = 0;
    }
  });
  if (curStreak > 0) streaks.push(curStreak);
  const avgStreak = streaks.length > 0 ? streaks.reduce((a, b) => a + b, 0) / streaks.length : 0;
  const mttr = recoveredHours > 0 ? recoveryDays / recoveredHours : 0;

  const mddEl = document.getElementById('study-risk-mdd');
  const mddSubEl = document.getElementById('study-risk-mdd-sub');
  if (mddEl) mddEl.textContent = `${formatHours(maxDrawdown)} peak`;
  if (mddSubEl) mddSubEl.textContent = `MTTR: ${mttr.toFixed(1)}d/h • Avg Streak: ${avgStreak.toFixed(1)}d`;

  // Value at Risk (VaR / Weekly Quota Ruin Probability)
  const studyVals = globalStudyRows.map(r => Number(r.actual_hours) || 0);
  const last30Vals = studyVals.slice(-30);
  const mean30 = last30Vals.length > 0 ? last30Vals.reduce((a, b) => a + b, 0) / last30Vals.length : 0;
  const sigma30 = calcStandardDeviation(last30Vals);
  const weeklyExpected = mean30 * 7;
  const weeklyStd = sigma30 * Math.sqrt(7);
  const weeklyQuota = 45.0; // 5x7h + 2x5h
  const ruinProb = last30Vals.length < 3
    ? 0
    : weeklyStd === 0
      ? (weeklyExpected < weeklyQuota ? 100 : 0)
      : normalCdf((weeklyQuota - weeklyExpected) / weeklyStd) * 100;

  const varEl = document.getElementById('study-risk-var');
  const varSubEl = document.getElementById('study-risk-var-sub');
  if (varEl) varEl.textContent = `VaR = ${ruinProb.toFixed(1)}%`;
  if (varSubEl) varSubEl.textContent = `Exp Wk: ${weeklyExpected.toFixed(1)}h vs 45h quota`;

  // Volatility (14D & 7D sigma)
  const studySigma14 = calcStandardDeviation(studyVals.slice(-14));
  const studySigma7 = calcStandardDeviation(studyVals.slice(-7));
  const studySigmaEl = document.getElementById('study-adv-sigma');
  const studySigmaSubEl = document.getElementById('study-adv-sigma-sub');
  if (studySigmaEl) studySigmaEl.textContent = `σ = ${studySigma14.toFixed(2)}h`;
  if (studySigmaSubEl) {
    const tag = studySigma14 < 1.2 ? 'Machine consistency' : studySigma14 < 2.4 ? 'Nominal variance' : 'Erratic cram/crash';
    studySigmaSubEl.textContent = `7D σ: ${studySigma7.toFixed(2)}h • ${tag}`;
  }

  // 3. Box-and-Whisker Quartiles (P25, P50 Median, P75, IQR)
  const sortedStudy = studyVals.slice().sort((a, b) => a - b);
  const p25 = calcPercentile(sortedStudy, 0.25);
  const p50 = calcPercentile(sortedStudy, 0.50);
  const p75 = calcPercentile(sortedStudy, 0.75);
  const iqr = Math.max(0, p75 - p25);
  const qSumEl = document.getElementById('study-quartile-summary');
  const boxBarEl = document.getElementById('study-boxplot-bar');
  if (qSumEl) {
    qSumEl.textContent = `P25 (Floor): ${p25.toFixed(1)}h • MEDIAN (P50): ${p50.toFixed(1)}h • P75 (Peak): ${p75.toFixed(1)}h • IQR: ${iqr.toFixed(1)}h`;
  }
  if (boxBarEl) {
    const leftPct = Math.min(95, (p25 / 12) * 100);
    const medPct = Math.min(98, (p50 / 12) * 100);
    const widthPct = Math.max(2, Math.min(100 - leftPct, ((p75 - p25) / 12) * 100));
    boxBarEl.innerHTML = `
      <div class="w-full h-0.5 bg-[#87b39b] relative">
        <div style="left:${leftPct}%; width:${widthPct}%;" class="absolute -top-2 h-4 bg-[#dcfce7] border border-[#059669]" title="IQR Box: ${p25.toFixed(1)}h to ${p75.toFixed(1)}h"></div>
        <div style="left:${medPct}%;" class="absolute -top-2.5 h-5 w-0.5 bg-[#0c1f17]" title="Median (P50): ${p50.toFixed(1)}h"></div>
      </div>
    `;
  }

  // 4. Kinetic-Cognitive Efficiency Ratios (Steps-per-Study-Hour & Active-Day Multiplier)
  let totalPairedStudy = 0, totalPairedSteps = 0;
  pairedDates.forEach(r => {
    totalPairedStudy += Number(r.actual_hours) || 0;
    totalPairedSteps += stepMap[r.date] || 0;
  });
  const kineticRatio = totalPairedStudy > 0 ? Math.round(totalPairedSteps / totalPairedStudy) : 0;
  const kinEl = document.getElementById('study-kinetic-ratio');
  const kinSubEl = document.getElementById('study-kinetic-ratio-sub');
  if (kinEl) kinEl.textContent = `${formatSteps(kineticRatio)} steps/h`;
  if (kinSubEl) {
    if (kineticRatio > 0 && kineticRatio < 800) {
      kinSubEl.textContent = '[!] SEDENTARY LOCK (< 800 steps/h)';
      kinSubEl.className = 'font-mono-tech text-[10px] text-[#b91c1c] font-bold mt-0.5';
    } else if (kineticRatio >= 1200 && kineticRatio <= 1600) {
      kinSubEl.textContent = '● OPTIMAL KINETIC YIELD (1.2k–1.5k)';
      kinSubEl.className = 'font-mono-tech text-[10px] text-[#047857] mt-0.5';
    } else {
      kinSubEl.textContent = 'Target: 1,200–1,500 steps/h';
      kinSubEl.className = 'font-mono-tech text-[10px] text-[#436152] mt-0.5';
    }
  }

  // Active-Day Performance Multiplier (Next-day study after >=10k steps vs <10k steps)
  const afterActiveStudy = [];
  const afterSedentaryStudy = [];
  for (let i = 1; i < globalStudyRows.length; i++) {
    const curRow = globalStudyRows[i];
    const prevDateObj = new Date(curRow.date + 'T00:00:00');
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = getLocalDateString(prevDateObj);
    if (stepMap[prevDateStr] !== undefined) {
      if (stepMap[prevDateStr] >= 10000) afterActiveStudy.push(curRow.actual_hours);
      else afterSedentaryStudy.push(curRow.actual_hours);
    }
  }
  const avgAfterActive = afterActiveStudy.length > 0 ? afterActiveStudy.reduce((a, b) => a + b, 0) / afterActiveStudy.length : 0;
  const avgAfterSed = afterSedentaryStudy.length > 0 ? afterSedentaryStudy.reduce((a, b) => a + b, 0) / afterSedentaryStudy.length : 0;
  const mult = (avgAfterActive > 0 && avgAfterSed > 0) ? (avgAfterActive / avgAfterSed) : 1.0;
  const multEl = document.getElementById('study-rest-multiplier');
  const multSubEl = document.getElementById('study-rest-multiplier-sub');
  if (multEl) multEl.textContent = `${mult.toFixed(2)}×`;
  if (multSubEl) {
    multSubEl.textContent = `After ≥10k: ${avgAfterActive.toFixed(1)}h vs <10k: ${avgAfterSed.toFixed(1)}h`;
  }

  // 5. Hit Rate & Halving Time
  const studyOnSpecCount = globalStudyRows.filter(r => {
    const base = getStudyBaseGoalForDate(r.date);
    return r.actual_hours >= base && r.actual_hours <= MAX_DAILY;
  }).length;
  const studyHitRate = globalStudyRows.length > 0 ? (studyOnSpecCount / globalStudyRows.length) * 100 : 0;
  const lastStudyOver = globalStudyRows.length > 0 ? globalStudyRows[globalStudyRows.length - 1].computed_overflow : 0;
  const recent7Study = globalStudyRows.slice(-7);
  const avgDailySurplusStudy = recent7Study.length > 0
    ? recent7Study.reduce((acc, r) => acc + (r.actual_hours - getStudyBaseGoalForDate(r.date)), 0) / recent7Study.length
    : 0;
  const halfText = lastStudyOver <= 0
    ? 'Debt Clear'
    : avgDailySurplusStudy > 0
      ? `Half: ${((lastStudyOver / 2) / avgDailySurplusStudy).toFixed(1)}d`
      : 'Debt Stalled';

  const sHitEl = document.getElementById('study-adv-hitrate');
  const sHitSubEl = document.getElementById('study-adv-hitrate-sub');
  if (sHitEl) sHitEl.textContent = `${studyHitRate.toFixed(1)}%`;
  if (sHitSubEl) sHitSubEl.textContent = `${studyOnSpecCount}/${globalStudyRows.length} on-spec • ${halfText}`;

  // Render Study Daily Bar + 7-Day EMA Native SVG Chart (skip if tab hidden)
  const studyEmaHost = isTabActive('study') ? document.getElementById('studyEmaChart') : null;
  if (studyEmaHost && window.AutumnCharts && typeof window.AutumnCharts.renderEmaBarLineChart === 'function') {
    const recentStudyRows = globalStudyRows.slice(-30);
    const sLabels = recentStudyRows.map(r => r.date.slice(5));
    const sRaw = recentStudyRows.map(r => r.actual_hours);
    const sEma = calcEMA(sRaw, 7);
    studyEmaChartInstance = window.AutumnCharts.renderEmaBarLineChart('studyEmaChart', {
      labels: sLabels,
      rawValues: sRaw,
      emaValues: sEma,
      barLabel: 'Daily Study (h)',
      emaLabel: '7-Day EMA Trend',
      emaColor: '#f59e0b',
      formatValue: (v) => formatHours(v)
    });
  } else if (!isTabActive('study')) {
    __dirtyTabs.add('study');
  }

  // 6. Steps Volatility (σ), Hit Rate, Debt Halving & 7D EMA
  const stepsVals = globalStepsRows.map(r => Number(r.actual_steps) || 0);
  const stepsSigma14 = calcStandardDeviation(stepsVals.slice(-14));
  const stepsSigma7 = calcStandardDeviation(stepsVals.slice(-7));
  const stSigmaEl = document.getElementById('steps-adv-sigma');
  const stSigmaSubEl = document.getElementById('steps-adv-sigma-sub');
  if (stSigmaEl) stSigmaEl.textContent = `σ = ${formatSteps(stepsSigma14)}`;
  if (stSigmaSubEl) {
    const tag = stepsSigma14 < 1800 ? 'Machine consistency' : stepsSigma14 < 3500 ? 'Nominal variance' : 'High volatility';
    stSigmaSubEl.textContent = `7D σ: ${formatSteps(stepsSigma7)} • ${tag}`;
  }

  const stepsOnSpecCount = globalStepsRows.filter(r => r.actual_steps >= getStepsBaseGoalForDate(r.date)).length;
  const stepsHitRate = globalStepsRows.length > 0 ? (stepsOnSpecCount / globalStepsRows.length) * 100 : 0;
  const stHitEl = document.getElementById('steps-adv-hitrate');
  const stHitSubEl = document.getElementById('steps-adv-hitrate-sub');
  if (stHitEl) stHitEl.textContent = `${stepsHitRate.toFixed(1)}%`;
  if (stHitSubEl) stHitSubEl.textContent = `${stepsOnSpecCount} / ${globalStepsRows.length} days ≥ base quota`;

  const lastStepsOver = globalStepsRows.length > 0 ? globalStepsRows[globalStepsRows.length - 1].computed_overflow : 0;
  const recent7Steps = globalStepsRows.slice(-7);
  const avgDailySurplusSteps = recent7Steps.length > 0
    ? recent7Steps.reduce((acc, r) => acc + (r.actual_steps - getStepsBaseGoalForDate(r.date)), 0) / recent7Steps.length
    : 0;
  const stHalvEl = document.getElementById('steps-adv-halving');
  const stHalvSubEl = document.getElementById('steps-adv-halving-sub');
  if (stHalvEl && stHalvSubEl) {
    if (lastStepsOver <= 0) {
      stHalvEl.textContent = '0.0d // CLEAR';
      stHalvSubEl.textContent = 'No step rollover debt active';
    } else if (avgDailySurplusSteps > 0) {
      const halfDays = (lastStepsOver / 2) / avgDailySurplusSteps;
      const fullDays = lastStepsOver / avgDailySurplusSteps;
      stHalvEl.textContent = `${halfDays.toFixed(1)}d half`;
      stHalvSubEl.textContent = `~${fullDays.toFixed(1)}d to full clear`;
    } else {
      stHalvEl.textContent = '∞ // STALLED';
      stHalvSubEl.textContent = `Need > base quota to reduce debt`;
    }
  }

  const stepsEmaHost = isTabActive('steps') ? document.getElementById('stepsEmaChart') : null;
  if (stepsEmaHost && window.AutumnCharts && typeof window.AutumnCharts.renderEmaBarLineChart === 'function') {
    const recentStepsRows = globalStepsRows.slice(-30);
    const stLabels = recentStepsRows.map(r => r.date.slice(5));
    const stRaw = recentStepsRows.map(r => r.actual_steps);
    const stEma = calcEMA(stRaw, 7);
    stepsEmaChartInstance = window.AutumnCharts.renderEmaBarLineChart('stepsEmaChart', {
      labels: stLabels,
      rawValues: stRaw,
      emaValues: stEma,
      barLabel: 'Daily Steps',
      emaLabel: '7-Day EMA Trend',
      emaColor: '#0284c7',
      formatValue: (v) => formatSteps(Math.round(v)) + ' steps'
    });
  } else if (!isTabActive('steps')) {
    __dirtyTabs.add('steps');
  }

  // 7. 7-Column Day-of-Week Efficiency Matrix (Mon through Sun)
  const dowOrder = [
    { dayIdx: 1, name: 'MON' },
    { dayIdx: 2, name: 'TUE' },
    { dayIdx: 3, name: 'WED' },
    { dayIdx: 4, name: 'THU' },
    { dayIdx: 5, name: 'FRI' },
    { dayIdx: 6, name: 'SAT' },
    { dayIdx: 0, name: 'SUN' }
  ];

  const dowStats = dowOrder.map(d => {
    const sRows = globalStudyRows.filter(r => new Date(r.date + 'T00:00:00').getDay() === d.dayIdx);
    const stRows = globalStepsRows.filter(r => new Date(r.date + 'T00:00:00').getDay() === d.dayIdx);
    const avgStudy = sRows.length > 0 ? sRows.reduce((a, r) => a + r.actual_hours, 0) / sRows.length : 0;
    const sDeficitCount = sRows.filter(r => r.actual_hours < getStudyBaseGoalForDate(r.date)).length;
    const sDeficitRate = sRows.length > 0 ? (sDeficitCount / sRows.length) * 100 : 0;

    const avgSteps = stRows.length > 0 ? stRows.reduce((a, r) => a + r.actual_steps, 0) / stRows.length : 0;
    const stDeficitCount = stRows.filter(r => r.actual_steps < getStepsBaseGoalForDate(r.date)).length;
    const stDeficitRate = stRows.length > 0 ? (stDeficitCount / stRows.length) * 100 : 0;

    return { ...d, avgStudy, sDeficitRate, sCount: sRows.length, avgSteps, stDeficitRate, stCount: stRows.length };
  });

  const activeStudyDow = dowStats.filter(d => d.sCount > 0);
  const weakestStudyDow = activeStudyDow.length > 0
    ? activeStudyDow.slice().sort((a, b) => a.avgStudy - b.avgStudy)[0]
    : null;
  const weakestStudyLbl = document.getElementById('study-dow-weakest');
  if (weakestStudyLbl) {
    weakestStudyLbl.textContent = weakestStudyDow
      ? `WEAKEST STUDY DAY: ${weakestStudyDow.name} (AVG ${formatHours(weakestStudyDow.avgStudy)} • ${weakestStudyDow.sDeficitRate.toFixed(0)}% DEFICIT)`
      : 'AWAITING STUDY LOGS';
  }

  const studyDowEl = document.getElementById('study-dow-matrix');
  if (studyDowEl) {
    studyDowEl.innerHTML = dowStats.map(d => {
      const isWeakest = weakestStudyDow && weakestStudyDow.dayIdx === d.dayIdx;
      return `
        <div class="p-2.5 border ${isWeakest ? 'border-[#dc2626] bg-[#fee2e2]/40' : 'border-[#c5ded0] bg-[#f9fdfb]'} font-mono-tech text-xs flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="font-bold text-[#0c1f17]">${d.name}</span>
            ${isWeakest ? '<span class="tech-badge badge-red !text-[8px] !py-0 !px-1">WEAK</span>' : `<span class="text-[9px] text-[#56735f]">${d.sCount}d</span>`}
          </div>
          <div class="text-sm font-bold text-[#047857] mt-1">${formatHours(d.avgStudy)}</div>
          <div class="text-[10px] text-[#436152] mt-0.5">${formatStepsCompact(d.avgSteps) || '0'} steps</div>
          <div class="text-[9px] ${d.sDeficitRate > 50 ? 'text-[#b91c1c]' : 'text-[#56735f]'} mt-0.5">Deficit: ${d.sDeficitRate.toFixed(0)}%</div>
        </div>
      `;
    }).join('');
  }

  const activeStepsDow = dowStats.filter(d => d.stCount > 0);
  const weakestStepsDow = activeStepsDow.length > 0
    ? activeStepsDow.slice().sort((a, b) => a.avgSteps - b.avgSteps)[0]
    : null;
  const weakestStepsLbl = document.getElementById('steps-dow-weakest');
  if (weakestStepsLbl) {
    weakestStepsLbl.textContent = weakestStepsDow
      ? `WEAKEST STEP DAY: ${weakestStepsDow.name} (AVG ${formatSteps(weakestStepsDow.avgSteps)} • ${weakestStepsDow.stDeficitRate.toFixed(0)}% DEFICIT)`
      : 'AWAITING STEP LOGS';
  }

  const stepsDowEl = document.getElementById('steps-dow-matrix');
  if (stepsDowEl) {
    stepsDowEl.innerHTML = dowStats.map(d => {
      const isWeakest = weakestStepsDow && weakestStepsDow.dayIdx === d.dayIdx;
      return `
        <div class="p-2.5 border ${isWeakest ? 'border-[#dc2626] bg-[#fee2e2]/40' : 'border-[#c5ded0] bg-[#f9fdfb]'} font-mono-tech text-xs flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="font-bold text-[#0c1f17]">${d.name}</span>
            ${isWeakest ? '<span class="tech-badge badge-red !text-[8px] !py-0 !px-1">WEAK</span>' : `<span class="text-[9px] text-[#56735f]">${d.stCount}d</span>`}
          </div>
          <div class="text-sm font-bold text-[#0369a1] mt-1">${formatSteps(d.avgSteps)}</div>
          <div class="text-[10px] text-[#436152] mt-0.5">Study: ${formatHours(d.avgStudy)}</div>
          <div class="text-[9px] ${d.stDeficitRate > 50 ? 'text-[#b91c1c]' : 'text-[#56735f]'} mt-0.5">Deficit: ${d.stDeficitRate.toFixed(0)}%</div>
        </div>
      `;
    }).join('');
  }

  } finally {
    globalStudyRows = globalStudyRowsBackup;
    globalStepsRows = globalStepsRowsBackup;
  }
  fetchAndSyncOperationalYield();
  if (window.analyticsMatrix && typeof window.analyticsMatrix.refreshAllAnalytics === 'function') {
    window.analyticsMatrix.refreshAllAnalytics();
  }
}

// ==========================================
// 10J-2. EXECUTIVE TELEMETRY RIBBON & 00 // MISSION CONTROL COCKPIT
// ==========================================
function getGradeAndPassFromScore(score) {
  const s = Number(score) || 0;
  if (s > 100) return { grade: 'A+', passEarned: 'A+' };
  if (s >= 95) return { grade: 'A', passEarned: 'A' };
  if (s >= 85) return { grade: 'A-', passEarned: 'NONE' };
  if (s >= 75) return { grade: 'B', passEarned: 'NONE' };
  if (s >= 60) return { grade: 'C', passEarned: 'NONE' };
  return { grade: 'D', passEarned: 'NONE' };
}

window.addEventListener('beforeunload', (e) => {
  // Flush the stopwatch state so a reload can resume it (closed time is not credited).
  if (typeof persistTimerState === 'function') persistTimerState();
  if (typeof persistTimerAccumulatedSecs === 'function') persistTimerAccumulatedSecs();
  if ((typeof journalEditorDirty !== "undefined" && journalEditorDirty) || (typeof generalNoteDirty !== "undefined" && generalNoteDirty)) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

// ==========================================
// ------------------------------------------
// PHASE 8: OFFLINE SHELL + KEYBOARD SHORTCUTS
// ------------------------------------------

// OFFLINE SHELL — deliberately NOT a service worker.
// This build is one self-contained index.html, so there is no sw.js to register: a
// service worker script must be a same-origin URL (the spec rejects a Blob URL).
// Offline reads are already covered without one — hydrateLedgersFromCache() paints the
// last Supabase snapshot from localStorage before the network is even asked, and
// setConnectivityBanner() tells the operator that writes are paused. Registering a
// sw.js that does not exist only ever produced a 404 on every single visit.

// Vim-style navigation: press "g" then a letter (within 1.2s).
const TAB_SHORTCUTS = { s: 'study', p: 'steps', c: 'calendar', t: 'tasks', n: 'notes', r: 'resources', f: 'focus' };
let pendingGPressAt = 0;

window.addEventListener('keydown', (e) => {
  const tag = (document.activeElement?.tagName || '').toLowerCase();
  const isEditable = document.activeElement?.isContentEditable ||
    tag === 'input' || tag === 'textarea' || tag === 'select';
  if (isEditable || e.ctrlKey || e.metaKey || e.altKey) return;

  const key = String(e.key || '').toLowerCase();

  // "?" opens the shortcut sheet (Shift+/ on most layouts).
  if (e.key === '?') {
    e.preventDefault();
    openToolsModal('keys');
    return;
  }

  // "t" toggles the study stopwatch / pomodoro.
  if (key === 't') {
    e.preventDefault();
    toggleStudyTimer();
    return;
  }

  // "g" arms the navigation chord.
  if (key === 'g') {
    pendingGPressAt = Date.now();
    return;
  }

  if (pendingGPressAt && (Date.now() - pendingGPressAt) < 1200 && TAB_SHORTCUTS[key]) {
    e.preventDefault();
    pendingGPressAt = 0;
    switchTab(TAB_SHORTCUTS[key]);
    showToast('SHORTCUT', 'Jumped to ' + TAB_SHORTCUTS[key].toUpperCase() + '.');
    return;
  }

  pendingGPressAt = 0;
});


// TIER 2: PLANNER & CROSS-MODULE INSIGHTS
// ==========================================
function countCurrentStreak(rows, valueField, baseGoalFn) {
  const byDate = {};
  getPhaseActiveRows(rows).filter(r => !r.is_gap_day).forEach(r => {
    byDate[r.date] = Number(r[valueField]) || 0;
  });
  let cursor = getLocalDateString(new Date());
  // An unlogged "today" must not break yesterday's streak.
  if (byDate[cursor] === undefined) cursor = addDaysToDateStr(cursor, -1);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const val = byDate[cursor];
    if (val === undefined || val < baseGoalFn(cursor)) break;
    streak++;
    cursor = addDaysToDateStr(cursor, -1);
  }
  return streak;
}

function renderPlannerClearance(todayStr) {
  const clearanceEl = document.getElementById('planner-clearance');
  if (!clearanceEl) return;
  const hoursEl = document.getElementById('planner-hours-input');
  const perDay = Math.max(0, Number(hoursEl && hoursEl.value) || 0);
  const latest = getLatestLedgerRowUpTo(getPhaseActiveRows(globalStudyRows), todayStr);
  const startDebt = latest ? (Number(latest.computed_overflow) || 0) : 0;

  if (startDebt <= 0) {
    clearanceEl.innerHTML = 'No debt outstanding.<br><span class="font-bold text-[#047857]">' +
      (startDebt < 0 ? 'Surplus credit ' + formatHours(-startDebt) : 'Exactly on track') + '</span>';
    return;
  }

  let debt = startDebt;
  let cursor = todayStr;
  let clearedAfter = -1;
  for (let i = 1; i <= 400; i++) {
    cursor = addDaysToDateStr(cursor, 1);
    const step = computeOverflowStep(getStudyBaseGoalForDate(cursor), debt, perDay, MAX_DAILY);
    debt = step.overflow;
    if (debt <= 0) { clearedAfter = i; break; }
  }

  clearanceEl.innerHTML = 'Debt now: <strong>' + formatHours(startDebt) + '</strong><br>' +
    (clearedAfter > 0
      ? 'At ' + perDay + 'h/day &rarr; <span class="font-bold text-[#047857]">' + clearedAfter + ' day(s)</span><br>' +
        '<span class="text-[#56735f]">by ' + formatRunDateDMY(cursor) + '</span>'
      : '<span class="font-bold text-[#b91c1c]">Never</span> at ' + perDay + 'h/day<br>' +
        '<span class="text-[#56735f]">that pace is below the recurring goal</span>');
}

function renderPlannerStreaksAndCorrelations(activeStudy, activeSteps) {
  const streakEl = document.getElementById('planner-streaks');
  if (streakEl) {
    const studyStreak = countCurrentStreak(globalStudyRows, 'actual_hours', getStudyBaseGoalForDate);
    const stepsStreak = countCurrentStreak(globalStepsRows, 'actual_steps', getStepsBaseGoalForDate);
    const habitStreak = (typeof globalHabits !== 'undefined' && Array.isArray(globalHabits))
      ? globalHabits.reduce((best, h) => Math.max(best, Number(h.streak_count) || 0), 0)
      : 0;
    streakEl.innerHTML =
      'STUDY quota: <strong>' + studyStreak + 'd</strong><br>' +
      'STEPS quota: <strong>' + stepsStreak + 'd</strong><br>' +
      'BEST habit: <strong>' + habitStreak + 'd</strong>';
  }

  const corrEl = document.getElementById('planner-correlations');
  if (!corrEl) return;

  const studyMap = {};
  activeStudy.forEach(r => { studyMap[r.date] = Number(r.actual_hours) || 0; });
  const stepsMap = {};
  activeSteps.forEach(r => { stepsMap[r.date] = Number(r.actual_steps) || 0; });

  const sharedDates = Object.keys(studyMap).filter(d => stepsMap[d] !== undefined).sort();
  const xs = sharedDates.map(d => studyMap[d]);
  const ys = sharedDates.map(d => stepsMap[d]);
  const rStudySteps = calcPearsonCorrelation(xs, ys);
  const yields = sharedDates.map(d => computeDailyOperationalYield(d).score);
  const rStudyYield = calcPearsonCorrelation(xs, yields);
  const fmtR = (v) => (isFinite(v) ? v.toFixed(2) : '—');

  corrEl.innerHTML =
    'Study &#8596; Steps: <strong>' + fmtR(rStudySteps) + '</strong><br>' +
    'Study &#8596; Yield: <strong>' + fmtR(rStudyYield) + '</strong><br>' +
    '<span class="text-[#56735f]">n=' + sharedDates.length + ' shared days</span>';
}

function renderPlannerWhatIf(todayStr) {
  const whatIfEl = document.getElementById('whatif-result');
  if (!whatIfEl) return;
  const hEl = document.getElementById('whatif-hours-input');
  const sEl = document.getElementById('whatif-steps-input');
  const hVal = Number(hEl && hEl.value) || 0;
  const sVal = Number(sEl && sEl.value) || 0;

  // Uses the REAL grading engine with overrides — nothing is persisted.
  const projected = computeDailyOperationalYield(todayStr, { studyActual: hVal, stepsActual: sVal });
  const tone = projected.score >= 95 ? '#059669' : projected.score >= 60 ? '#0284c7' : '#dc2626';
  whatIfEl.innerHTML =
    'Projected: <strong style="color:' + tone + '">' + projected.score + ' pts</strong><br>' +
    'Grade <strong>' + projected.grade + '</strong> &bull; ' +
    (projected.passEarned !== 'NONE'
      ? '<span class="font-bold text-[#047857]">+' + projected.passEarned + ' PASS</span>'
      : projected.standing) +
    '<br><span class="text-[#56735f]">discipline ' + projected.disciplineBreakdown + '</span>';
}

function renderPlannerPassLedger() {
  const ledgerEl = document.getElementById('planner-pass-ledger');
  if (!ledgerEl) return;
  const events = [];
  getMergedOfficialGradeRecords().forEach((rec) => {
    if (rec.pass_earned && rec.pass_earned !== 'NONE') {
      events.push('<div>' + rec.date + ' — <span class="font-bold text-[#047857]">EARNED ' +
        (rec.pass_earned === 'APLUS' ? '[A+]' : '[A]') + '</span> at ' + rec.score + ' pts</div>');
    }
    if (rec.redeemed_for) {
      events.push('<div>' + rec.date + ' — <span class="font-bold text-[#92400e]">REDEEMED</span> ' +
        escapeHtml(rec.redeemed_for) + '</div>');
    }
  });
  ledgerEl.innerHTML = events.length
    ? events.slice(0, 40).join('')
    : '<span class="text-[#56735f]">No passes earned or redeemed yet.</span>';
}

// Master renderer — safe to call on every ledger refresh.
function renderPlannerInsights() {
  const todayStr = getLocalDateString(new Date());
  const activeStudy = getPhaseActiveRows(globalStudyRows).filter(r => !r.is_gap_day);
  const activeSteps = getPhaseActiveRows(globalStepsRows).filter(r => !r.is_gap_day);

  renderPlannerClearance(todayStr);
  renderPlannerStreaksAndCorrelations(activeStudy, activeSteps);
  renderPlannerWhatIf(todayStr);
  renderPlannerPassLedger();
}

// ==========================================
// TIER 3: EVENT NOTIFICATIONS (15-minute warning)
// ==========================================
const NOTIFIED_EVENTS_KEY = 'autumn_notified_event_ids';

function loadNotifiedEventIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_EVENTS_KEY) || '[]'));
  } catch (e) {
    return new Set();
  }
}

function saveNotifiedEventIds(set) {
  try {
    // Keep the tail only so the key cannot grow without bound.
    localStorage.setItem(NOTIFIED_EVENTS_KEY, JSON.stringify(Array.from(set).slice(-200)));
  } catch (e) {}
}

async function enableEventNotifications() {
  if (!('Notification' in window)) {
    return showToast('NOT SUPPORTED', 'This browser does not support desktop notifications.', true);
  }
  const btn = document.getElementById('notify-enable-btn');
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    if (btn) btn.textContent = ' ALERTS ON';
    showToast('ALERTS ENABLED', 'You will be warned 15 minutes before an event starts.');
  } else {
    if (btn) btn.textContent = ' ALERTS BLOCKED';
    showToast('ALERTS BLOCKED', 'Notifications were not granted in the browser.', true);
  }
}

// Called from the radar refresh loop; fires at most one notification per event id.
function maybeNotifyUpcomingEvents(soonEvents) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const notified = loadNotifiedEventIds();
  let changed = false;

  (soonEvents || []).forEach((ev) => {
    if (!ev || !ev.id || notified.has(ev.id)) return;
    if (Number(ev.inMins) > 15) return;
    try {
      new Notification('autumn // event in ' + ev.inMins + 'm', {
        body: ev.title + (ev.location ? ' @ ' + ev.location : ''),
        tag: ev.id
      });
      notified.add(ev.id);
      changed = true;
    } catch (e) {}
  });

  if (changed) saveNotifiedEventIds(notified);
}


// GLOBAL FAILURE SURFACE (offline + uncaught errors)
// Previously every failed request was a silent console.warn, which is indistinguishable
// from "no data" (a dashboard of zeros).
// ==========================================
function setConnectivityBanner(isOffline) {
  if (!document.body) return;
  let el = document.getElementById('net-status-banner');
  if (isOffline) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'net-status-banner';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9998;background:#fef3c7;' +
        'color:#92400e;border-top:1px solid #fcd34d;font-family:"Inter",-apple-system,BlinkMacSystemFont,sans-serif;' +
        'font-size:11px;padding:6px 12px;text-align:center;';
      document.body.appendChild(el);
    }
    el.textContent = '[!] OFFLINE — showing the last cached data. Saves will fail until the connection returns.';
    // Lift the fixed terminal drawer / toast instead of covering them (see body.is-offline).
    document.body.classList.add('is-offline');
  } else if (el) {
    el.remove();
    document.body.classList.remove('is-offline');
  }
}

window.addEventListener('offline', () => setConnectivityBanner(true));
window.addEventListener('online', () => {
  setConnectivityBanner(false);
  if (typeof showToast === 'function') showToast('BACK ONLINE', 'Reconnected — refreshing ledgers.');
  if (typeof fetchAndRenderStudy === 'function') fetchAndRenderStudy();
  if (typeof fetchAndRenderSteps === 'function') fetchAndRenderSteps();
  if (typeof fetchGoogleCalendarEvents === 'function') fetchGoogleCalendarEvents(false);
  // Replay every write that was journalled while offline (Tier 1.2).
  if (typeof flushWriteQueue === 'function') flushWriteQueue(false);
});
if (!navigator.onLine) setConnectivityBanner(true);

// Throttled error toasts so a retry loop cannot spam the UI.
const recentErrorToasts = new Map();
function reportFailure(title, message) {
  const msg = String(message || 'Unknown error').slice(0, 180);
  const now = Date.now();
  const last = recentErrorToasts.get(msg) || 0;
  if (now - last < 8000) return;
  recentErrorToasts.set(msg, now);
  if (typeof showToast === 'function') showToast(title, msg, true);
}

window.addEventListener('error', (event) => {
  const err = event.error;
  console.error('[autumn] uncaught error:', err || event.message);
  reportFailure('UNEXPECTED ERROR', (err && err.message) || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  console.error('[autumn] unhandled rejection:', reason);
  reportFailure('REQUEST FAILED', (reason && reason.message) ? reason.message : reason);
});

// ==========================================
// 13. TOOLS HUB — Tier 1/2/3 feature set
// Diagnostics · export suite · weekly review · habit strips · achievements ·
// ambient audio · install prompt · keyboard help · health import · attachments ·
// command palette · offline write queue · trash vault.
// Everything below is additive: no existing data path is rewired except the two
// logging flows and one delete flow, each marked with a TOOLS-HUB note.
// ==========================================

// ---------------------------------------------------------------- 13.1 utilities
function downloadBlob(filename, content, mime) {
  try {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast('EXPORT READY', filename);
  } catch (e) {
    showToast('EXPORT FAILED', (e && e.message) || 'Could not build the file.', true);
  }
}

function csvEscape(value) {
  const s = (value === null || value === undefined) ? '' : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(rows, columns) {
  const head = columns.map(c => csvEscape(c.label || c.key)).join(',');
  const body = rows.map(r => columns.map(c => csvEscape(c.get ? c.get(r) : r[c.key])).join(','));
  return [head].concat(body).join('\r\n');
}

// ------------------------------------------------- 13.2 offline write queue (T1.2)
// Supabase writes that fail because the browser is offline are journalled here and
// replayed when connectivity returns, instead of being lost behind a red toast.
// Deliberate scope: the two daily logging flows are wired to it (study & steps);
// autumnQueueWrite() is the entry point for anything else that wants durability.
const WRITE_QUEUE_KEY = 'autumn_write_queue';
let pendingWrites = [];

function loadWriteQueue() {
  try {
    const raw = safeStorage.getItem(WRITE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    pendingWrites = Array.isArray(parsed) ? parsed : [];
  } catch (e) { pendingWrites = []; }
}

function persistWriteQueue() {
  // Trim BEFORE persisting so the in-memory queue and the stored queue cannot drift.
  if (pendingWrites.length > 200) pendingWrites = pendingWrites.slice(-200);
  safeStorage.setItem(WRITE_QUEUE_KEY, JSON.stringify(pendingWrites));
  updateWriteQueueBadge();
}

function isNetworkError(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return !navigator.onLine ||
    msg.indexOf('failed to fetch') !== -1 ||
    msg.indexOf('networkerror') !== -1 ||
    msg.indexOf('network error') !== -1 ||
    msg.indexOf('load failed') !== -1 ||
    msg.indexOf('timeout') !== -1;
}

function autumnQueueWrite(table, payload, onConflict) {
  pendingWrites.push({
    id: 'wq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    table: table,
    payload: payload,
    onConflict: onConflict || null,
    at: new Date().toISOString()
  });
  persistWriteQueue();
}

// Returns true when the error was a connectivity problem and the row is now queued.
function queueWriteIfOffline(error, table, payload, onConflict) {
  if (!isNetworkError(error)) return false;
  autumnQueueWrite(table, payload, onConflict);
  showToast('SAVED OFFLINE', 'No connection — queued for ' + table + '. It will sync automatically.', false);
  return true;
}

// Replaying an offline log must never LOWER a newer online entry. Study hours and steps
// are cumulative for the day, so the operator's rule is: the larger value wins.
function mergeQueuedPayload(item) {
  const payload = Object.assign({}, item.payload);
  if (!item || (item.table !== 'study_ledger' && item.table !== 'steps_ledger')) return payload;
  const dateKey = payload.date;
  if (!dateKey) return payload;
  const isStudy = item.table === 'study_ledger';
  const rows = isStudy ? globalStudyRows : globalStepsRows;
  const field = isStudy ? 'actual_hours' : 'actual_steps';
  const existing = (rows || []).find(r => r.date === dateKey);
  const current = existing ? Number(existing[field]) || 0 : 0;
  const queued = Number(payload[field]) || 0;
  if (current > queued) {
    payload[field] = current;
    if (existing && existing.source) payload.source = existing.source;
  }
  return payload;
}

async function flushWriteQueue(showFeedback) {
  loadWriteQueue();
  if (pendingWrites.length === 0) {
    if (showFeedback) showToast('WRITE QUEUE', 'Nothing pending — everything is already saved.');
    return { ok: 0, failed: 0 };
  }
  if (!navigator.onLine) {
    if (showFeedback) showToast('STILL OFFLINE', pendingWrites.length + ' write(s) waiting for a connection.', true);
    return { ok: 0, failed: pendingWrites.length };
  }

  let ok = 0;
  const stillPending = [];
  for (const item of pendingWrites) {
    try {
      const replayPayload = mergeQueuedPayload(item);
      let query = supabaseClient.from(item.table);
      query = item.onConflict ? query.upsert(replayPayload, { onConflict: item.onConflict }) : query.insert(replayPayload);
      const { error } = await query;
      if (error) {
        if (isNetworkError(error)) { stillPending.push(item); break; }
        console.warn('[autumn] queued write rejected for ' + item.table + ':', error.message);
        continue; // permanent rejection (e.g. RLS) — dropping it is correct
      }
      ok += 1;
    } catch (e) {
      stillPending.push(item);
      break;
    }
  }
  pendingWrites = stillPending;
  persistWriteQueue();

  if (ok > 0) {
    showToast('QUEUE FLUSHED', ok + ' offline write(s) synced to Supabase.');
    if (typeof fetchAndRenderStudy === 'function') fetchAndRenderStudy();
    if (typeof fetchAndRenderSteps === 'function') fetchAndRenderSteps();
  } else if (showFeedback) {
    showToast('QUEUE PENDING', stillPending.length + ' write(s) could not be sent yet.', true);
  }
  return { ok: ok, failed: stillPending.length };
}

function updateWriteQueueBadge() {
  const count = pendingWrites.length;
  // The radar-bar pill disappears when the operator collapses that bar, so the same
  // count is mirrored on the ⌘ Tools button, which is always visible.
  const badge = document.getElementById('write-queue-badge');
  if (badge) {
    badge.classList.toggle('hidden', count === 0);
    badge.textContent = '⇅ PENDING WRITES (' + count + ')';
    badge.title = count ? 'Click to retry ' + count + ' offline write(s) now' : '';
  }
  const menuBadge = document.getElementById('tools-menu-badge');
  if (menuBadge) {
    menuBadge.classList.toggle('hidden', count === 0);
    menuBadge.textContent = String(count);
    menuBadge.title = count ? count + ' offline write(s) waiting — open Tools → Diagnostics' : '';
  }
}


// ------------------------------------------------------- 13.3 trash vault (T1.4)
// Supabase has no deleted_at column, so deleted rows are snapshotted locally for 30 days
// and can be re-inserted from the tools hub. This covers the delete flows that already
// capture the row (tasks today); autumnTrashPush() is the hook for anything else.

// ------------------------------------------------- 13.17 daily briefing (D3.9)
// "What matters right now" — next event, urgent deadline, remaining quota, momentum.
// Purely derived from data already in memory, so it costs no extra requests.
function computeCurrentStudyStreak() {
  let streak = 0;
  const rows = getPhaseActiveRows(globalStudyRows).filter(r => !r.is_gap_day);
  const todayStr = getLocalDateString(new Date());
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const goal = resolveScoringBaseline(row.date, globalStudyRows, getStudyBaseGoalForDate, MAX_DAILY).baseline;
    if ((Number(row.actual_hours) || 0) >= goal) streak += 1;
    else if (row.date !== todayStr) break; // today not met yet does not break the chain
  }
  return streak;
}

function renderDailyBriefing() {
  const host = document.getElementById('daily-briefing-body');
  if (!host) return;
  const now = new Date();
  const todayStr = getLocalDateString(now);

  const nextEvent = (globalCalendarEvents || [])
    .filter(ev => ev && ev.end instanceof Date && ev.end > now)
    .sort((a, b) => a.start - b.start)[0];

  let urgent = 0;
  let nearestTask = null;
  (globalTaskItems || []).forEach((task) => {
    if (task.is_done) return;
    const meta = getTaskMeta(task.id);
    if (!meta.dueDate) return;
    const info = evaluateTaskDeadline(meta.dueDate);
    if (!info || info.diffDays > 1) return;
    urgent += 1;
    if (!nearestTask || info.diffDays < nearestTask.info.diffDays) nearestTask = { task: task, info: info };
  });

  const studyRow = (globalStudyRows || []).find(r => r.date === todayStr);
  const studyActual = studyRow ? Number(studyRow.actual_hours) || 0 : 0;
  const studyTarget = resolveScoringBaseline(todayStr, globalStudyRows, getStudyBaseGoalForDate, MAX_DAILY).baseline;
  const stepsRow = (globalStepsRows || []).find(r => r.date === todayStr);
  const stepsActual = stepsRow ? Number(stepsRow.actual_steps) || 0 : 0;
  const stepsTarget = resolveScoringBaseline(todayStr, globalStepsRows, getStepsBaseGoalForDate, STEPS_MAX_DAILY).baseline;

  const active = getPhaseActiveRows(globalStudyRows);
  const debt = active.length ? Math.max(0, Number(active[active.length - 1].computed_overflow) || 0) : 0;
  const streak = computeCurrentStudyStreak();

  const tile = (label, value, sub, tone) =>
    '<div class="metric-box ' + (tone || '') + '">' +
    '<div class="section-tag mb-1"><span class="diamond">◆</span> ' + label + '</div>' +
    '<div class="font-mono-tech text-base font-bold text-[#0c1f17] leading-tight break-words">' + value + '</div>' +
    '<div class="font-mono-tech text-[10px] text-[#436152] mt-0.5 break-words">' + sub + '</div>' +
    '</div>';

  const quotaDone = studyActual >= studyTarget && stepsActual >= stepsTarget;

  host.innerHTML =
    tile('NEXT EVENT',
      nextEvent ? escapeHtml(String(nextEvent.title || 'Event').slice(0, 34)) : 'Nothing scheduled',
      nextEvent
        ? (nextEvent.start <= now
          ? 'in progress · ' + escapeHtml(formatEventTimeSpan(nextEvent))
          : 'in ' + Math.max(1, Math.round((nextEvent.start - now) / 60000)) + 'm · ' + escapeHtml(formatEventTimeSpan(nextEvent)))
        : 'calendar is clear',
      nextEvent ? 'accent-blue' : '') +
    tile('URGENT DEADLINES', String(urgent),
      nearestTask
        ? escapeHtml(String(nearestTask.task.title).slice(0, 28)) + ' · ' + escapeHtml(nearestTask.info.label.slice(0, 22))
        : 'nothing due within 24h',
      urgent ? 'accent-red' : '') +
    tile('QUOTA LEFT', formatHours(Math.max(0, studyTarget - studyActual)) + ' study',
      formatSteps(Math.max(0, stepsTarget - stepsActual)) + ' steps · target ' + formatHours(studyTarget) + ' / ' + formatSteps(stepsTarget),
      quotaDone ? 'accent-green' : 'accent-amber') +
    tile('MOMENTUM', streak + 'd streak',
      debt > 0 ? 'open debt ' + formatHours(debt) : 'zero debt — clean chain',
      debt > 0 ? 'accent-red' : 'accent-green');

  const stamp = document.getElementById('briefing-stamp');
  if (stamp) stamp.textContent = 'UPDATED ' + now.toLocaleTimeString('en-US', { hour12: false });
}

// Thin async proxies so global search, header/terminal actions, and modals work even before their lazy script finishes loading
function __makeAsyncProxy(modKey, fnName, needsModals) {
  return async function (...args) {
    if (needsModals && window.__autumnLazy) await window.__autumnLazy.ensureModalsMounted();
    if (window.__autumnLazy) await window.__autumnLazy.ensureModule(modKey);
    const fn = window[fnName];
    if (typeof fn === 'function' && !fn.__isAutumnProxy) return fn(...args);
  };
}
[
  ['mod-extras', 'openToolsModal', true],
  ['mod-extras', 'showToolsPanel', true],
  ['mod-extras', 'openBackupModal', true],
  ['mod-extras', 'openReportModal', true],
  ['mod-extras', 'openStatCardModal', true],
  ['mod-extras', 'setStatCardMode', true],
  ['mod-extras', 'renderReport', true],
  ['mod-extras', 'renderStatCardPreview', true],
  ['mod-extras', 'downloadStatCardFile', false],
  ['mod-extras', 'copyStatCardPngToClipboard', false],
  ['mod-extras', 'toggleTerminalDrawer', false],
  ['mod-extras', 'handleTerminalCliSubmit', false],
  ['mod-extras', 'handleTerminalBufferInput', false],
  ['mod-extras', 'prefillCliCommand', false],
  ['mod-extras', 'insertTerminalTimestamp', false],
  ['mod-extras', 'flushTerminalToGeneralNote', false],
  ['mod-extras', 'openTodayTerminalInNotesTab', false],
  ['mod-extras', 'exportHtmlTableData', false],
  ['mod-extras', 'promptInstall', false],
  ['mod-extras', 'runSelfTest', false],
  ['mod-calendar', 'openEventDetails', true],
  ['mod-notes', 'selectJournalDate', false],
  ['mod-notes', 'selectGeneralNote', false],
  ['mod-resources', 'loadYoutubeResourceInPlayer', false],
  ['mod-resources', 'openDriveFileInReader', false],
  ['mod-resources', 'toggleAmbientAudio', false]
].forEach(([modKey, fnName, needsModals]) => {
  if (typeof window[fnName] !== 'function') {
    const p = __makeAsyncProxy(modKey, fnName, needsModals);
    p.__isAutumnProxy = true;
    window[fnName] = p;
  }
});

// 11. INITIALIZATION ON LOAD (01 // STUDY FIRST — LIGHTSPEED PATH)
window.addEventListener('DOMContentLoaded', async () => {
  installInlinedManifest();
  syncVersionUi();
  enhanceA11y();
  healStuckBodyScrollLock();
  window.addEventListener('focus', healStuckBodyScrollLock);
  window.addEventListener('pageshow', healStuckBodyScrollLock);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) healStuckBodyScrollLock();
  });
  loadWriteQueue();
  updateWriteQueueBadge();
  if (navigator.onLine && pendingWrites.length > 0) flushWriteQueue(false);
  if (!safeStorage.getItem('autumn_seen_cmd_hint')) {
    safeStorage.setItem('autumn_seen_cmd_hint', 'true');
    setTimeout(() => {
      showToast('COMMAND MODE', 'Type › in the search bar to run commands — e.g. ›study 7.5, ›export, ›theme.');
    }, 2500);
  }
  maybeAnnounceVersion();
  initRealtimeSync();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  const dateIn = document.getElementById('date-input');
  if (dateIn) dateIn.value = yesterdayStr;

  const currentWeekMondayStr = getWeekMondayDateString(new Date());
  selectedNoteDate = currentWeekMondayStr;
  updateStudyTimerUI();
  restoreTimerState();

  // Warm secondary data gracefully only when operator interacts with global search
  const gsInput = document.getElementById('global-search-input');
  if (gsInput && window.__autumnLazy) {
    gsInput.addEventListener('focus', () => window.__autumnLazy.warmSecondaryData(), { once: true });
  }

  // 1. Instant paint from local cache (zero network wait)
  hydrateLedgersFromCache();
  if (globalStudyRows.length) {
    updateStudyChart(globalStudyRows);
    renderAdvancedTelemetryAnalytics();
  }

  // 2. Critical data fetches only (Study + Steps for Yield grading + Tasks deadlines)
  await Promise.allSettled([
    fetchAndRenderStudy(),
    fetchAndRenderSteps(),
    fetchAndRenderTasks()
  ]);

  ledgerDataReady = true;
  await fetchAndSyncOperationalYield();

  // 3. Calendar shell for sticky radar bar
  await loadSavedGCalCredentials();
  await fetchGoogleCalendarEvents(false);
  refreshEventLinkedViews(true);

  // Paint Study SVG charts right after fresh fetch
  updateStudyChart(globalStudyRows);
  renderAdvancedTelemetryAnalytics();

  // 4. Deep links (#selftest / #changelog / #tab)
  const requestedTab = (location.hash || '').replace('#', '');
  if (requestedTab === 'selftest') {
    setTimeout(() => { try { runSelfTest(); } catch (e) { console.error('[autumn] self-test failed:', e); } }, 500);
  } else if (requestedTab === 'changelog') {
    openToolsModal('changelog');
  } else if (requestedTab && TAB_META[requestedTab] && requestedTab !== 'focus' && requestedTab !== 'study') {
    suppressHistoryPush = true;
    await switchTab(requestedTab);
    suppressHistoryPush = false;
  }
});
