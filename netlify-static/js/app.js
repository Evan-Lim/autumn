// autumn // PERSONAL COMMAND LEDGER — application logic (single-file build v1.3.0)
// Classic script on purpose, not a module: every top-level declaration stays global so the
// ~330 inline on* handlers in the markup resolve without a bundler. The whole app — styles
// (hand-written + precompiled Tailwind), logic, icon and manifest — lives in this one file.
//
// FILE MAP (every region below is introduced by a "// n." banner comment):
//   1   Supabase / Google Calendar / Drive config · RLS contract · runtime PWA boilerplate
//   1C  Release version + changelog data (APP_VERSION, CHANGELOG, renderChangelog)
//   2   Helpers: dates, formatting, escaping (escapeHtml / jsAttrQuote), toasts, modals
//   3   Tab navigation       4  Auth             5  Live clock & day progress
//   6   Study ledger (debt chain, chart, heatmap, planner)
//   7   Steps ledger         8  Google Calendar sync + 4 views (schedule/month/week/day)
//   9   Tasks matrix · habits · running ledgers · portfolio
//   10  Notes (journal + general) · resources (Drive/YouTube) · themes · timer engine
//   11  Yield engine · advanced analytics · global search · backup/restore · init

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
    // ==========================================
    const APP_VERSION = '1.4.0';
    const APP_VERSION_DATE = '2026-11-17';
    const APP_VERSION_LABEL = 'M3 SHARP DASHBOARD, UM 3D ATLAS & POWER MATRIX';
    const SEEN_VERSION_KEY = 'autumn_seen_version';

    // Newest first. `tag` is NEW / FIX / IMPROVE / DATA and only selects a badge colour.
    // (0.9.0 / 0.5.0 are the pre-release builds that were never publicly versioned — give
    // them real dates whenever you like; the renderer prints whatever is stored here.)
    const CHANGELOG = [
      {
        version: '1.4.0',
        date: '2026-11-17',
        label: 'ULTRA-LIGHT INTER M3, UM 3D ATLAS & COMPACT LEDGERS',
        items: [
          { tag: 'NEW', text: 'Ultra-Light Inter Typography (200–300 body & table cells, 400 headers & KPIs with tabular numerals) across the entire UI, stat cards, and exports with strictly 0px M3 Sharp framing.' },
          { tag: 'NEW', text: 'Zero Emojis: replaced all decorative emojis and symbols with custom 1px hairline wireframe schematic SVGs (window.autumnIcons).' },
          { tag: 'NEW', text: 'UM 3D Atlas (um-3d-atlas.netlify.app) live routing: details-first parsing for KIE1003, KIE1004, KIE1005 & KIX1001, [NOT ...] override resolution (e.g. Dewan Kuliah 8 DK8), FKEJ/FKUM to Faculty of Engineering mapping, GPS/campus origins using verified index IDs, Leave-By countdowns, and 1-click 3D route links.' },
          { tag: 'NEW', text: 'Compact 4th-Navbar Strips & Inline Editing: single combined ENG Course Hub strip (total/7D hours, open tasks, click-to-tag & route), Next-Class Commute strips (03 // Calendar & Focus Mode), plus Double-Click/Enter inline ledger editing with ArrowUp/ArrowDown navigation.' },
          { tag: 'NEW', text: 'Task Sub-Checklists, Batch Matrix Action Bar (+1D/+3D/+7D, status, column move, bulk delete), 14-Day Velocity Sparklines & 5x5 Cross-Module Correlation Matrix (14D / 30D / ALL).' },
          { tag: 'IMPROVE', text: 'Responsive width-first dashboard layout across Desktop, Tablet, and Mobile viewports with zero clipping or horizontal overflow, bundled cleanly into /netlify-static.' }
        ]
      },
      {
        version: '1.3.0',
        date: '2026-11-02',
        label: 'SURPLUS-AWARE SCORING',
        items: [
          { tag: 'NEW', text: 'Study (50) and steps (30) points are now scored against the debt/surplus-adjusted target instead of the flat base goal: with 2.7 h of surplus banked, today asks 7 − 2.7 = 4.3 h, so 5.2 h scores 5.2 / 4.3 × 50 = 60.5 points instead of 37.' },
          { tag: 'NEW', text: 'The baseline never drops below 25% of the normal goal (1.75 h / 2,500 steps on a weekday), so a large credit cannot collapse the divisor.' },
          { tag: 'NEW', text: 'A modest surplus boost is added on top, proportional to how much of a full day the credit is worth (up to +6 study / +4 steps points) and scaled by how much of the baseline you actually hit.' },
          { tag: 'IMPROVE', text: 'Debt raises the baseline the same way, so a day with 2.7 h owed asks 9.7 h for full marks — everything still flows through the existing uncapped extra-points system, so beating the baseline keeps paying 50 + extra.' },
          { tag: 'DATA', text: 'All grades were recalculated: the daily yield ledger re-grades every logged day on the next sync and only rewrites rows whose score or grade actually changed. Hover any score in the grades table (or the navbar badge) to see the baseline and surplus it used.' },
          { tag: 'IMPROVE', text: 'Streaks, the daily briefing quota tile and the achievements shelf now measure against the same baseline, and the ledger\'s Computed Target column applies the same 25% floor, so the table and the grade can never disagree.' }
        ]
      },
      {
        version: '1.2.2',
        date: '2026-11-02',
        label: 'FOLDER SCROLL FIX',
        items: [
          { tag: 'FIX', text: 'Expanded folders could not be scrolled through: the Drive tree lived inside a fixed-height scroll box, which trapped the wheel/touch gesture and hid the files a folder had just revealed. The list is now normal page flow, so the page itself scrolls — on every device and screen size.' },
          { tag: 'IMPROVE', text: 'Expanding a folder that sits low on the page now parks its header near the top of the viewport, so the files it opens are immediately visible instead of landing below the fold.' },
          { tag: 'IMPROVE', text: 'The per-folder 50-row cap and SHOW MORE footer keep the page length sane now that the list is no longer height-capped.' }
        ]
      },
      {
        version: '1.2.1',
        date: '2026-11-02',
        label: 'SCROLLING FIX',
        items: [
          { tag: 'FIX', text: 'The Resource Vault folder list could not be scrolled any further. It no longer uses overscroll-behavior, which was swallowing the wheel/touch gesture once the inner list reached its end, and its max-height is now clamped so calc(100vh - 19rem) can never evaluate negative and drop the rule on a short window.' },
          { tag: 'FIX', text: 'On phones and tablets the list is no longer a nested scroll area at all — it simply grows and the page scrolls, which is what a touch gesture expects.' },
          { tag: 'FIX', text: 'A stuck modal scroll-lock (the only thing that can freeze page scrolling entirely) is now healed automatically on boot, on window focus, on pageshow and when the tab becomes visible again — no reload needed.' },
          { tag: 'IMPROVE', text: 'The folder list accepts keyboard focus, so PageDown / arrows scroll it, and shows a thin scrollbar so it is obvious there is more below.' }
        ]
      },
      {
        version: '1.2.0',
        date: '2026-11-02',
        label: 'RESOURCE VAULT SCALE-UP',
        items: [
          { tag: 'FIX', text: 'A Drive folder with more than 200 entries could not be expanded past the first 200: the listing ignored Google\'s nextPageToken. Every page is now walked and any remainder is fetchable with FETCH MORE.' },
          { tag: 'FIX', text: 'Adding a folder to the config used to blank the whole vault when one folder was unreadable; each folder now settles on its own and reports its own error inline.' },
          { tag: 'IMPROVE', text: 'Rows are drawn 50 at a time per folder with a SHOW MORE footer, so a folder with thousands of files no longer freezes the panel.' },
          { tag: 'IMPROVE', text: 'Filtering is debounced, searches the whole indexed tree (not just the first level), highlights the match, hides folders with no hits and opens the ones that have them. Esc clears it.' },
          { tag: 'IMPROVE', text: 'New SORT control (folders first / name / newest / size), per-folder file+folder counts, INDEXED FILES / FOLDERS totals, and a working ↻ Sync that clears every cache.' },
          { tag: 'IMPROVE', text: 'Folder rows are real buttons with aria-expanded, the list keeps its scroll position when you expand something deep down, and the panel is its own scroll container on every screen size.' }
        ]
      },
      {
        version: '1.1.1',
        date: '2026-11-02',
        label: 'DRIVE CONFIG FIX',
        items: [
          { tag: 'FIX', text: 'Saving a new Google Drive folder link failed with “expandedDriveFolders is not defined” and nothing was stored. That line still used the pre-rename variable, so it threw before the Supabase writes; it now updates driveExpandedState and the folder list, API key and both config rows save correctly.' },
          { tag: 'IMPROVE', text: 'Expansion and cached-file state for folders that are no longer configured is cleared when the folder list changes.' },
          { tag: 'IMPROVE', text: 'If Supabase rejects the config write, the dialog still closes with a SAVED LOCALLY toast (the browser copy is already written) instead of surfacing a bare promise rejection as REQUEST FAILED.' }
        ]
      },
      {
        version: '1.1.0',
        date: '2026-11-02',
        label: 'DOCUMENT READER EXPANSION',
        items: [
          { tag: 'NEW', text: 'The Resource Vault reader now opens Word (.doc/.docx), Excel (.xls/.xlsx/.csv), PowerPoint (.ppt/.pptx) and Google Docs / Sheets / Slides instead of only PDFs.' },
          { tag: 'NEW', text: 'Viewer source switcher above the frame: Drive preview, Microsoft Office Online, Google Docs Viewer, or render in-app. The choice is remembered per file type.' },
          { tag: 'NEW', text: 'In-app renderers: .docx becomes formatted HTML with inline images, spreadsheets become switchable sheet tabs with scrollable tables, .pptx becomes a slide-by-slide text outline.' },
          { tag: 'IMPROVE', text: 'File typing is now extension-first, so uploads Drive reports as application/octet-stream still get the right viewer, badge and buttons.' },
          { tag: 'IMPROVE', text: 'The Drive API request now includes fileExtension, and the folder tree shows DOCX / XLSX / PPTX / GDOC / GSHEET / GSLIDE instead of a generic DOC / SHEET / SLIDE.' },
          { tag: 'DATA', text: 'Content-Security-Policy frame-src now allows view.officeapps.live.com for the Office Online embed.' },
          { tag: 'FIX', text: 'The note sanitiser gained an opt-in reader mode (tables, and images restricted to data: URLs) while note bodies keep the previous strict allowlist.' }
        ]
      },
      {
        version: '1.0.0',
        date: '2026-11-02',
        label: 'FIRST PUBLIC RELEASE',
        items: [
          { tag: 'NEW', text: 'Unlimited recursive subtasks: every task in every column can hold its own nested thread of tasks, each with the full task feature set (done, QUEUED / IN-PROGRESS, deadline, linked calendar event, edit, reorder, delete).' },
          { tag: 'NEW', text: 'Release chip in the header plus this changelog — one entry per version, opened once automatically when the version changes.' },
          { tag: 'NEW', text: '›changelog command in the search palette, and index.html#changelog opens this panel directly.' },
          { tag: 'FIX', text: 'A column title containing an apostrophe (or a quote) used to break its own delete button — handler attributes are now escaped with jsAttrQuote().' },
          { tag: 'FIX', text: 'Same escaping bug on the Drive folder tree "open in reader" buttons.' },
          { tag: 'FIX', text: 'Deleting a column now removes its task rows first, so nothing is left orphaned in TASKS DONE, exports, search or the deadlines radar.' },
          { tag: 'IMPROVE', text: 'Subtask deadlines surface in the radar bar and Focus mode with their parent task named; a parent row shows a live done/total roll-up.' },
          { tag: 'IMPROVE', text: 'Task exports (MD / CSV / JSON) nest subtasks instead of flattening them.' },
          { tag: 'IMPROVE', text: 'Diagnostics reports whether the parent_task_id column exists, next to the existing deadline / event-column check.' }
        ]
      },
      {
        version: '0.9.0-beta',
        date: 'pre-1.0',
        label: 'BETA',
        items: [
          { tag: 'IMPROVE', text: 'Rebuilt as one self-contained index.html: Tailwind compiled into the file, no runtime styling CDN.' },
          { tag: 'NEW', text: 'Tools Hub — diagnostics, export suite, weekly review, habit strips, achievements, trash vault, step import, attachments, shortcut sheet, system toggles.' },
          { tag: 'IMPROVE', text: 'Offline durability: ledger cache for instant paint plus a queued write buffer with retry.' },
          { tag: 'IMPROVE', text: 'Accessibility pass applied programmatically: tab / tabpanel roles, icon-button labels, live-region toasts, focus-trapped modals, Esc handling.' },
          { tag: 'DATA', text: 'Row Level Security contract documented: public reads, owner-only writes, API-key rows excluded from anonymous access.' }
        ]
      },
      {
        version: '0.5.0-alpha',
        date: 'pre-1.0',
        label: 'ALPHA',
        items: [
          { tag: 'NEW', text: 'Core ledgers: study hours with a cumulative debt chain and grading engine, daily steps, operational yield ledger.' },
          { tag: 'NEW', text: 'Google Calendar sync with schedule / month / week / day / timeline views.' },
          { tag: 'NEW', text: 'Subject & competition task matrix, recurring habits, running log with pace PRs, portfolio log.' },
          { tag: 'NEW', text: 'Journal + general notes, Drive / YouTube study resources, focus mode, study timer, theme profiles.' }
        ]
      }
    ];

    const CHANGELOG_TAG_CLASS = {
      NEW: 'badge-green',
      FIX: 'badge-red',
      IMPROVE: 'badge-blue',
      DATA: 'badge-amber'
    };

    // Keep the pre-boot constant (head script) and the runtime build string in lock step.
    window.__autumnBuild = 'v' + APP_VERSION;

    function renderChangelog() {
      const host = document.getElementById('tools-changelog-body');
      if (!host) return;

      host.innerHTML = CHANGELOG.map((release) => {
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
          CHANGELOG.length + ' recorded release(s). Open with the header chip, ›changelog, or index.html#changelog.';
      }
    }

    // The header chip is static markup, so the number is re-stamped from APP_VERSION at boot
    // instead of being typed twice and drifting.
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
          showToast('AUTUMN v' + APP_VERSION, 'M3 Sharp Dashboard, Ultra-Light Inter & UM 3D Atlas ready. Click v' + APP_VERSION + ' for changelog.');
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

    // Same idea for wiring: a missing node (markup drift, A/B variant, partial render) must
    // never abort the rest of the script. Returns the element, or null after a warning.
    function onReady(elementId, eventName, handler) {
      const el = document.getElementById(elementId);
      if (!el) {
        console.warn('[autumn] onReady: #' + elementId + ' not found — skipped "' + eventName + '" listener.');
        return null;
      }
      el.addEventListener(eventName, handler);
      return el;
    }

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

    function openModal(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('hidden');
      if (modalStack.indexOf(id) === -1) modalStack.push(id);

      // Dialog semantics for assistive technology, applied here so all ten modals inherit
      // them without touching their markup.
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

      // Everything behind the dialog becomes inert (not focusable, not announced).
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

    function confirmAction(title, desc, onConfirm) {
      document.getElementById('confirm-modal-title').textContent = title;
      document.getElementById('confirm-modal-desc').textContent = desc;
      const btn = document.getElementById('confirm-modal-accept');
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

    function switchTab(tabName) {
      if (tabName !== 'focus') {
        lastNonFocusTab = tabName;
      }
      activeTabName = tabName;

      const tabs = ['study', 'steps', 'calendar', 'tasks', 'notes', 'resources', 'focus'];
      tabs.forEach(t => {
        const section = document.getElementById(`tab-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        const mobBtn = document.getElementById(`mob-tab-btn-${t}`);
        const railBtn = document.getElementById(`rail-btn-${t}`);
        if (!section) return;

        if (t === tabName) {
          section.classList.remove('hidden');
          if (t === 'tasks' || t === 'focus') {
            section.classList.add('flex');
          } else {
            section.classList.add('grid');
          }
          if (btn) {
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            btn.setAttribute('tabindex', '0');
          }
          if (mobBtn) {
            mobBtn.classList.add('active');
            mobBtn.setAttribute('aria-selected', 'true');
          }
          if (railBtn) {
            railBtn.classList.add('active');
            railBtn.setAttribute('aria-current', 'page');
          }
        } else {
          section.classList.add('hidden');
          section.classList.remove('grid', 'flex');
          if (btn) {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
            btn.setAttribute('tabindex', '-1');
          }
          if (mobBtn) {
            mobBtn.classList.remove('active');
            mobBtn.setAttribute('aria-selected', 'false');
          }
          if (railBtn) {
            railBtn.classList.remove('active');
            railBtn.removeAttribute('aria-current');
          }
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
      if (mobileLabel && TAB_META[tabName]) {
        mobileLabel.textContent = TAB_META[tabName];
      }
      closeMobileNavMenu();

      if (tabName === 'study' && studyChartInstance) studyChartInstance.resize();
      if (tabName === 'steps' && stepsChartInstance) stepsChartInstance.resize();
      if (tabName === 'calendar') renderCalendarViewport();
      if (tabName === 'resources' && typeof renderDriveFoldersTree === 'function') renderDriveFoldersTree();
      if (tabName === 'focus' && typeof renderFocusMode === 'function') renderFocusMode();

      // Secondary data now loads in the background after first paint. If the user reaches a
      // tab before that finishes (or before it starts), pull just that module in on demand.
      if (tabName === 'tasks') {
        if (globalTaskColumns.length === 0) fetchAndRenderTasks();
        if (globalHabits.length === 0) fetchAndRenderHabits();
        if (globalRunningLogs.length === 0) fetchAndRenderRunningLogs();
      }
      if (tabName === 'notes') {
        if (globalNotes.length === 0) fetchAndRenderNotes();
        if (globalGeneralNotes.length === 0) fetchAndRenderGeneralNotes();
      }
      if (tabName === 'resources') {
        if (globalYoutubeResources.length === 0) fetchAndRenderYoutubeResources();
        if (Object.keys(globalDriveFilesMap).length === 0) {
          loadSavedGDriveConfig().then(() => fetchGoogleDriveResources(false)).catch(() => {});
        }
      }

      // Deep-linkable tabs (#study, #calendar, …). pushState makes the browser Back button
      // return to the previous module instead of leaving the app.
      if (!suppressHistoryPush && window.history && history.pushState && location.hash !== '#' + tabName) {
        history.pushState({ tab: tabName }, '', '#' + tabName);
      }
      // Rows rendered after boot (tasks, drive, youtube) never pass the boot-time label sweep.
      if (typeof applyIconLabels === 'function') applyIconLabels();
    }

    // ==========================================
    // 4. AUTHENTICATION (OWNER DISPLAY NAME = autumn)
    // ==========================================
    function updateAuthUI(user) {
      currentUser = user;
      const isOwner = Boolean(user);

      const pill = document.getElementById('auth-status-pill');
      const actionBtn = document.getElementById('auth-action-btn');

      if (isOwner) {
        // Always display name as autumn when signed in
        pill.className = 'tech-badge badge-green shrink-0';
        pill.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#10b981] inline-block"></span><span>OWNER OPS // autumn</span>`;
        actionBtn.textContent = 'Sign Out';
      } else {
        pill.className = 'tech-badge badge-amber shrink-0';
        pill.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#d97706] inline-block"></span><span>READ-ONLY // GUEST</span>`;
        actionBtn.textContent = 'Owner Sign In';
      }

      document.querySelectorAll('.owner-input').forEach(el => {
        el.disabled = !isOwner;
      });

      const noteEditor = document.getElementById('note-content-editor');
      if (noteEditor) {
        noteEditor.setAttribute('contenteditable', isOwner ? 'true' : 'false');
      }

      const genNoteEditor = document.getElementById('gen-note-content-editor');
      if (genNoteEditor) {
        genNoteEditor.setAttribute('contenteditable', isOwner ? 'true' : 'false');
      }

      document.querySelectorAll('.owner-lock-badge').forEach(badge => {
        if (isOwner) badge.classList.add('hidden');
        else badge.classList.remove('hidden');
      });

      renderTasksBoard();
      if (typeof renderHabitsTable === 'function') renderHabitsTable();
      renderRunningTables();
      if (typeof renderPortfolioTables === 'function') renderPortfolioTables();
      if (typeof renderCalendarViewport === 'function') renderCalendarViewport();
      if (typeof renderManualMonthsBadges === 'function') renderManualMonthsBadges();
      if (typeof renderYoutubeResources === 'function') renderYoutubeResources();
      if (typeof renderFocusMode === 'function') renderFocusMode();
      if (typeof updateTerminalAuthUI === 'function') updateTerminalAuthUI();
      if (typeof fetchAndSyncOperationalYield === 'function') fetchAndSyncOperationalYield();
    }

    function handleAuthClick() {
      if (currentUser) {
        supabaseClient.auth.signOut().then(() => {
          showToast('SIGNED OUT', 'Session returned to Read-Only mode.');
        });
      } else {
        document.getElementById('login-error').classList.add('hidden');
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

    // ==========================================
    // 4B. LIVE SYNC — Supabase Realtime + cross-tab storage events
    // Previously the board only re-read when the operator refreshed or pressed "Sync Now",
    // so a phone and a laptop silently overwrote each other (last write wins on upsert).
    // One channel, one subscription per table, debounced re-render of just that module.
    // ==========================================
    const REALTIME_REFRESH = {
      study_ledger: () => { fetchAndRenderStudy(); fetchAndSyncOperationalYield(); },
      steps_ledger: () => { fetchAndRenderSteps(); fetchAndSyncOperationalYield(); },
      operational_yield_ledger: () => { fetchAndSyncOperationalYield(); },
      daily_notes: () => { fetchAndRenderNotes(); loadSavedGCalCredentials(); },
      general_notes: () => fetchAndRenderGeneralNotes(),
      task_columns: () => fetchAndRenderTasks(),
      task_items: () => fetchAndRenderTasks(),
      recurring_habits: () => fetchAndRenderHabits(),
      running_logs: () => fetchAndRenderRunningLogs(),
      portfolio_logs: () => fetchAndRenderPortfolioLogs(),
      youtube_resources: () => fetchAndRenderYoutubeResources(),
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
          if (Array.isArray(v)) { taskColOrder = v; renderTasksBoard(); }
        } else if (key === 'autumn_task_item_order') {
          const v = JSON.parse(safeStorage.getItem(key) || '{}');
          if (v && typeof v === 'object') { taskItemOrder = v; renderTasksBoard(); }
        } else if (key === 'autumn_task_col_collapsed') {
          const v = JSON.parse(safeStorage.getItem(key) || '{}');
          if (v && typeof v === 'object') { collapsedTaskCols = v; renderTasksBoard(); }
        } else if (key === 'autumn_task_child_collapsed') {
          const v = JSON.parse(safeStorage.getItem(key) || '{}');
          if (v && typeof v === 'object') { collapsedTaskChildren = v; renderTasksBoard(); }
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
    function updateClock() {
      const now = new Date();
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      const dateEl = document.getElementById('current-date');
      const timeEl = document.getElementById('current-time');
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
      if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', options);
      if (timeEl) timeEl.textContent = timeStr;

      const hours = now.getHours();
      const mins = now.getMinutes();
      const secs = now.getSeconds();
      const totalSecondsPassed = (hours * 3600) + (mins * 60) + secs;
      const secondsRemaining = Math.max(0, 86400 - totalSecondsPassed);
      const percentPassed = (totalSecondsPassed / 86400) * 100;
      const percentRemaining = 100 - percentPassed;

      const progEl = document.getElementById('day-progress');
      const remEl = document.getElementById('day-remaining-text');
      if (progEl) progEl.style.width = `${percentPassed}%`;
      if (remEl) remEl.textContent = `${percentRemaining.toFixed(1)}% left`;

      // Sync Focus Mode Live Telemetry Clock & Day Window
      const focusClockEl = document.getElementById('focus-live-clock');
      const focusRemPctEl = document.getElementById('focus-day-rem-pct');
      const focusRemHmEl = document.getElementById('focus-day-rem-hm');
      const focusRemBarEl = document.getElementById('focus-day-rem-bar');
      if (focusClockEl) focusClockEl.textContent = timeStr;
      if (focusRemPctEl) focusRemPctEl.textContent = `${percentRemaining.toFixed(1)}%`;
      if (focusRemHmEl) {
        const remH = Math.floor(secondsRemaining / 3600);
        const remM = Math.floor((secondsRemaining % 3600) / 60);
        focusRemHmEl.textContent = `${remH}h ${remM}m left until 24:00`;
      }
      if (focusRemBarEl) focusRemBarEl.style.width = `${percentRemaining}%`;
    }
    // Tick only while the tab is visible — browsers throttle background timers anyway, and
    // there is no point repainting a dashboard nobody can see.
    setInterval(() => { if (!document.hidden) updateClock(); }, 1000);
    updateClock();

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

    // Renders a study dataset (cached or fresh) through the full pipeline.
    function applyStudyRows(dbRows) {
      const computedRows = buildComputedLedger(dbRows, {
        baseGoalFn: getStudyBaseGoalForDate,
        cap: MAX_DAILY,
        valueField: 'actual_hours'
      });
      globalStudyRows = computedRows;
      updateStudyCalendar(computedRows);
      updateStudyTodayDisplay(computedRows);
      updateStudyTable(computedRows);
      updateStudyPredictions(computedRows);
      updateStudyChart(computedRows);
      if (typeof renderAdvancedTelemetryAnalytics === 'function') renderAdvancedTelemetryAnalytics();
      if (typeof renderPlannerInsights === 'function') renderPlannerInsights();

      return computedRows;
    }

    function applyStepsRows(dbRows) {
      const computedRows = buildComputedLedger(dbRows, {
        baseGoalFn: getStepsBaseGoalForDate,
        cap: STEPS_MAX_DAILY,
        valueField: 'actual_steps'
      });
      globalStepsRows = computedRows;
      updateStepsCalendar(computedRows);
      updateStepsTodayDisplay(computedRows);
      updateStepsTable(computedRows);
      updateStepsPredictions(computedRows);
      updateStepsChart(computedRows);
      if (typeof renderAdvancedTelemetryAnalytics === 'function') renderAdvancedTelemetryAnalytics();
      if (typeof renderPlannerInsights === 'function') renderPlannerInsights();

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
        tbody.appendChild(tr);
      });
      if (window.umAtlas && typeof window.umAtlas.attachLedgerInlineEditing === 'function') {
        window.umAtlas.attachLedgerInlineEditing();
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
      const rows = getPhaseActiveRows(allRows);
      const ctx = document.getElementById('studyChart').getContext('2d');
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

      // Reuse the existing instance instead of destroy+recreate on every render: recreating
      // replays the intro animation and forces a full canvas re-layout each time.
      if (studyChartInstance) {
        studyChartInstance.data.labels = labels;
        studyChartInstance.data.datasets[0].data = idealCumulative;
        studyChartInstance.data.datasets[1].data = expectedCumulative;
        studyChartInstance.data.datasets[2].data = actualCumulative;
        studyChartInstance.update('none');
        return;
      }

      studyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Baseline (7h wkday / 5h wkend)',
              data: idealCumulative,
              borderColor: '#718f80',
              borderDash: [4, 4],
              borderWidth: 1.5,
              pointRadius: 0
            },
            {
              label: 'Target Quota',
              data: expectedCumulative,
              borderColor: '#059669',
              borderDash: [5, 5],
              borderWidth: 2,
              stepped: 'after',
              pointRadius: 0
            },
            {
              label: 'Actual Studied',
              data: actualCumulative,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              fill: true,
              borderWidth: 2.5,
              stepped: 'after',
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: {
              labels: { font: { family: 'Inter', size: 10 }, color: '#436152', boxWidth: 12 }
            },
            tooltip: {
              titleFont: { family: 'Inter' },
              bodyFont: { family: 'Inter' },
              callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatHours(ctx.raw)}` }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#d5e6dc' },
              ticks: { font: { family: 'Inter', size: 10 }, color: '#436152' }
            },
            x: {
              grid: { display: false },
              ticks: { font: { family: 'Inter', size: 10 }, color: '#436152' }
            }
          }
        }
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

    // ==========================================
    // 7. TAB 2: STEPS LEDGER LOGIC (10,000 WEEKDAY / 7,000 WEEKEND)
    // ==========================================
    function adjustStepInput(amount) {
      const input = document.getElementById('steps-count-input');
      if (amount === 10000 && !input.value) {
        input.value = 10000;
      } else {
        input.value = (parseInt(input.value, 10) || 0) + amount;
      }
    }

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
    function computeMonthlyStepsWithBonus(rows, refDateObj) {
      let y = refDateObj.getFullYear();
      let m = refDateObj.getMonth(); // 0 = Jan ... 9 = Oct, 10 = Nov
      if (y < 2026 || (y === 2026 && m < 10)) {
        y = 2026;
        m = 10; // November 2026
      }

      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      const prevDate = new Date(y, m - 1, 1);
      const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const monthName = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

      let baseMonthSteps = 0;
      let bonusStepsFromPrevEnd = 0;

      (rows || []).forEach(r => {
        const stp = Number(r.actual_steps) || 0;
        if (r.date.startsWith(monthKey)) {
          baseMonthSteps += stp;
        } else if (r.date.startsWith(prevMonthKey) && isLastTwoDaysOfMonth(r.date)) {
          bonusStepsFromPrevEnd += stp;
        }
      });

      return {
        monthKey,
        monthName,
        baseMonthSteps,
        bonusSteps: bonusStepsFromPrevEnd,
        totalMonthlySteps: baseMonthSteps + bonusStepsFromPrevEnd
      };
    }

    function updateStepsStats(allRows) {
      const monthlyInfo = computeMonthlyStepsWithBonus(allRows, currentStepsCalDate);
      const lblEl = document.getElementById('steps-stat-total-label');
      const bonusEl = document.getElementById('steps-stat-bonus-pill');
      const subEl = document.getElementById('steps-stat-total-sub');
      const cumNovBadge = document.getElementById('steps-cum-nov-badge');

      // Secondary total: cumulative steps from Nov 2026 onwards (including Oct 30–31 carryover bonus)
      const cumFromNovSteps = (allRows || [])
        .filter(r => r.date >= CARRYOVER_WINDOW_START_DATE)
        .reduce((acc, r) => acc + (Number(r.actual_steps) || 0), 0);

      if (lblEl) lblEl.textContent = `MONTHLY STEPS (${monthlyInfo.monthName})`;
      if (bonusEl) {
        bonusEl.textContent = `+${formatStepsCompact(monthlyInfo.bonusSteps) || '0'} bonus`;
      }
      if (subEl) {
        subEl.textContent = `${formatSteps(monthlyInfo.baseMonthSteps)} in-month + ${formatSteps(monthlyInfo.bonusSteps)} 2d bonus • Since Nov: ${formatSteps(cumFromNovSteps)}`;
      }
      if (cumNovBadge) {
        cumNovBadge.textContent = `TOTAL FROM NOV 2026: ${formatSteps(cumFromNovSteps)}`;
      }

      const rows = getPhaseActiveRows(allRows);
      // Exclude synthetic gap rows from the per-session statistics (see updateStudyStats).
      const loggedRows = rows.filter(r => !r.is_gap_day);
      const phaseTotal = rows.reduce((acc, r) => acc + (Number(r.actual_steps) || 0), 0);
      const displayTotal = monthlyInfo.totalMonthlySteps > 0 ? monthlyInfo.totalMonthlySteps : phaseTotal;
      document.getElementById('steps-stat-total').textContent = formatSteps(displayTotal);

      if (loggedRows.length === 0) {
        document.getElementById('steps-stat-avg').textContent = "0";
        document.getElementById('steps-stat-best').textContent = "0";
        return;
      }
      let totalSteps = 0;
      let bestDay = 0;
      loggedRows.forEach(r => {
        totalSteps += r.actual_steps;
        if (r.actual_steps > bestDay) bestDay = r.actual_steps;
      });
      const avg = totalSteps / loggedRows.length;
      document.getElementById('steps-stat-avg').textContent = formatSteps(avg);
      document.getElementById('steps-stat-best').textContent = formatSteps(bestDay);
    }

    function updateStepsCalendar(rows) {
      updateStepsStats(rows);
      const container = document.getElementById('steps-calendar-grid');
      container.innerHTML = '';

      const dataMap = {};
      getPhaseActiveRows(rows).forEach(r => dataMap[r.date] = r.actual_steps);

      const currentMonth = currentStepsCalDate.getMonth();
      const currentYear = currentStepsCalDate.getFullYear();

      document.getElementById('steps-month-display').textContent =
        currentStepsCalDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

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
        const steps = dataMap[dateString] || 0;
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
        dayBox.title = `${dateString}: ${formatSteps(steps)} steps`;

        if (dateString === todayStr) dayBox.classList.add('today');

        if (steps === 0) dayBox.classList.add('level-0');
        else if (steps < 5000) dayBox.classList.add('level-1');
        else if (steps < 7500) dayBox.classList.add('level-2');
        else if (steps < 10000) dayBox.classList.add('level-3');
        else dayBox.classList.add('level-4');

        const stepLabel = formatStepsCompact(steps);
        dayBox.innerHTML = `
          <span class="cal-date-num">${day}</span>
          ${stepLabel ? `<span class="cal-time-text">${stepLabel}</span>` : ''}
        `;
        container.appendChild(dayBox);
      }
    }

    function updateStepsTodayDisplay(rows) {
      const todayStr = getLocalDateString(new Date());
      const activeRows = getPhaseActiveRows(rows);
      const todayRow = activeRows.find(r => r.date === todayStr);
      const todayBaseGoal = getStepsBaseGoalForDate(todayStr);
      const actual = todayRow ? todayRow.actual_steps : 0;

      let target = todayBaseGoal;
      let overflow = 0;

      if (todayRow) {
        target = todayRow.computed_target;
        overflow = todayRow.computed_overflow;
      } else {
        const lastRow = getLatestLedgerRowUpTo(activeRows, todayStr);
        if (lastRow) {
          const lastDebt = Number(lastRow.computed_overflow) || 0;
          target = computeOverflowStep(todayBaseGoal, lastDebt, null, STEPS_MAX_DAILY).target;
          overflow = lastDebt;
        }
      }

      document.getElementById('steps-today-target').textContent = formatSteps(target);

      let overflowText = overflow > 0 ? `DEBT: +${formatSteps(overflow)}`
                       : overflow < 0 ? `SURPLUS: ${formatSteps(overflow)}`
                       : `ON TRACK`;

      const phaseTag = isCarryoverWindowDate(todayStr)
        ? ' // CARRIES OVER TO NOV 1'
        : !isOfficialLedgerDate(todayStr)
          ? ' // TESTING PHASE'
          : '';

      document.getElementById('steps-today-actual').textContent =
        `actual: ${formatSteps(actual)} steps (base ${formatSteps(todayBaseGoal)}) // ${overflowText}${phaseTag}`;
    }

    function updateStepsTable(rows) {
      lastStepsTableRows = rows;
      const tbody = document.querySelector('#steps-ledger-table tbody');
      tbody.innerHTML = '';

      const activeRows = getPhaseActiveRows(rows);
      if (activeRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-[#56735f]">No step days logged yet.</td></tr>`;
        updateLedgerWindowButtons();
        return;
      }

      // Windowing keeps the DOM small on long phases (see toggleLedgerWindow above).
      const reversedRows = applyLedgerWindow([...activeRows].reverse());
      updateLedgerWindowButtons();
      reversedRows.forEach(row => {
        const tr = document.createElement('tr');
        const isPassUsed = row.source === 'pass_redeemed' || (typeof isPassUsedOnDate === 'function' && isPassUsedOnDate(row.date, 'steps'));
        if (isPassUsed) {
          tr.className = 'bg-[#fef3c7]/65 border-l-4 border-l-[#f59e0b]';
        }

        let badgeHtml = '';
        const carryTag = row.is_carryover ? ` <span class="tech-badge badge-blue !text-[9px]">→ NOV CARRYOVER</span>` : '';
        const passUsedTag = isPassUsed ? ` <span class="tech-badge badge-amber !text-[9px]">PASS USED (INELIGIBLE)</span>` : '';
        const gapTag = row.is_gap_day ? ` <span class="tech-badge badge-neutral !text-[9px]" title="No steps recorded for this day — its base goal was added to your debt">○ NO LOG</span>` : '';

        if (row.computed_overflow > 0) {
          badgeHtml = `<span class="tech-badge badge-red">DEBT +${formatSteps(row.computed_overflow)}</span>${carryTag}${passUsedTag}${gapTag}`;
        } else if (row.computed_overflow < 0) {
          badgeHtml = `<span class="tech-badge badge-green">SURPLUS ${formatSteps(row.computed_overflow)}</span>${carryTag}${passUsedTag}${gapTag}`;
        } else {
          badgeHtml = `<span class="tech-badge badge-blue">ON TRACK</span>${carryTag}${passUsedTag}${gapTag}`;
        }

        tr.innerHTML = `
          <td>${row.date}</td>
          <td>${formatSteps(row.actual_steps)}</td>
          <td>${formatSteps(row.computed_target)}</td>
          <td class="flex flex-wrap items-center gap-1">${badgeHtml}</td>
        `;
        tbody.appendChild(tr);
      });
      if (window.umAtlas && typeof window.umAtlas.attachLedgerInlineEditing === 'function') {
        window.umAtlas.attachLedgerInlineEditing();
      }
    }

    // Steps twin of updateStudyPredictions(): target capped at STEPS_MAX_DAILY, debt uncapped,
    // and today's already-logged row is treated as authoritative.
    function updateStepsPredictions(rows) {
      const tbody = document.querySelector('#steps-prediction-table tbody');
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
        const dayBaseGoal = getStepsBaseGoalForDate(futureDate);

        let target;
        if (i === 0 && todayRow) {
          const loggedTarget = Number(todayRow.computed_target);
          target = Number.isFinite(loggedTarget) ? loggedTarget : dayBaseGoal;
          currentOverflow = Number(todayRow.computed_overflow) || 0;
        } else {
          // Forecast variant: assume the target is met (actual === target).
          const step = computeOverflowStep(dayBaseGoal, currentOverflow, null, STEPS_MAX_DAILY);
          target = step.target;
          currentOverflow = step.overflow;
        }

        const tr = document.createElement('tr');
        const dayName = i === 0 ? "TODAY" : i === 1 ? "TOMORROW" : futureDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

        tr.innerHTML = `
          <td>${dayName} <span class="text-[#56735f]">(${dateStr.slice(5)})</span></td>
          <td class="text-right font-bold text-[#047857]">${formatSteps(target)}</td>
        `;
        tbody.appendChild(tr);
      }
    }

    function updateStepsChart(allRows) {
      const rows = getPhaseActiveRows(allRows);
      const ctx = document.getElementById('stepsChart').getContext('2d');
      const labels = rows.map(r => r.date.slice(5));

      const expectedCumulative = [];
      const actualCumulative = [];
      const idealCumulative = [];

      let expSum = 0;
      let actSum = 0;
      let idealSum = 0;

      rows.forEach((r) => {
        expSum += r.computed_target;
        actSum += r.actual_steps;
        idealSum += getStepsBaseGoalForDate(r.date);
        expectedCumulative.push(expSum);
        actualCumulative.push(actSum);
        idealCumulative.push(idealSum);
      });

      // Reuse the existing instance (see updateStudyChart for rationale).
      if (stepsChartInstance) {
        stepsChartInstance.data.labels = labels;
        stepsChartInstance.data.datasets[0].data = idealCumulative;
        stepsChartInstance.data.datasets[1].data = expectedCumulative;
        stepsChartInstance.data.datasets[2].data = actualCumulative;
        stepsChartInstance.update('none');
        return;
      }

      stepsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Baseline (10k wkday / 7k wkend)',
              data: idealCumulative,
              borderColor: '#718f80',
              borderDash: [4, 4],
              borderWidth: 1.5,
              pointRadius: 0
            },
            {
              label: 'Target Steps',
              data: expectedCumulative,
              borderColor: '#0284c7',
              borderDash: [5, 5],
              borderWidth: 2,
              stepped: 'after',
              pointRadius: 0
            },
            {
              label: 'Actual Steps',
              data: actualCumulative,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              fill: true,
              borderWidth: 2.5,
              stepped: 'after',
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: {
              labels: { font: { family: 'Inter', size: 10 }, color: '#436152', boxWidth: 12 }
            },
            tooltip: {
              titleFont: { family: 'Inter' },
              bodyFont: { family: 'Inter' },
              callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatSteps(ctx.raw)} steps` }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#d5e6dc' },
              ticks: { font: { family: 'Inter', size: 10 }, color: '#436152' }
            },
            x: {
              grid: { display: false },
              ticks: { font: { family: 'Inter', size: 10 }, color: '#436152' }
            }
          }
        }
      });
    }

    onReady('steps-entry-form', 'submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to log steps.', true);

      const date = document.getElementById('steps-date-input').value;
      const actualSteps = parseInt(document.getElementById('steps-count-input').value, 10) || 0;
      if (!date) return;

      const { error } = await supabaseClient
        .from('steps_ledger')
        .upsert({
          date,
          actual_steps: actualSteps,
          target_steps: getStepsBaseGoalForDate(date),
          source: 'manual'
        }, { onConflict: 'date' });

      if (error) {
        // TOOLS-HUB (T1.2): queue the log instead of losing it when the link is down.
        if (queueWriteIfOffline(error, 'steps_ledger', {
          date: date,
          actual_steps: actualSteps,
          target_steps: getStepsBaseGoalForDate(date),
          source: 'manual'
        }, 'date')) return;
        showToast('DATABASE ERROR', error.message, true);
      } else {
        if (typeof clearPassUsedLockForDate === 'function') clearPassUsedLockForDate(date, 'steps');
        document.getElementById('steps-count-input').value = '';
        showToast('STEP LOG SAVED', `Recorded ${formatSteps(actualSteps)} steps for ${date}.`);
        fetchAndRenderSteps();
      }
    });

    onReady('reset-steps-btn', 'click', () => {
      if (!currentUser) return;
      confirmAction(
        'Purge All Step Ledger Data?',
        'This will permanently delete all recorded rows in steps_ledger.',
        async () => {
          const { error } = await supabaseClient.from('steps_ledger').delete().neq('date', '1900-01-01');
          if (error) showToast('RESET ERROR', error.message, true);
          else {
            showToast('STEP LEDGER PURGED', 'All step records cleared.');
            fetchAndRenderSteps();
          }
        }
      );
    });

    onReady('steps-prev-month', 'click', () => {
      currentStepsCalDate.setMonth(currentStepsCalDate.getMonth() - 1);
      updateStepsCalendar(globalStepsRows);
    });

    onReady('steps-next-month', 'click', () => {
      currentStepsCalDate.setMonth(currentStepsCalDate.getMonth() + 1);
      updateStepsCalendar(globalStepsRows);
    });

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
      renderManualMonthsBadges();
    }

    async function persistManualCalendarMonths() {
      manualCalendarMonths = Array.from(new Set(manualCalendarMonths)).sort();
      renderManualMonthsBadges();
      if (currentUser) {
        await supabaseClient
          .from('daily_notes')
          .upsert({
            date: GCAL_MANUAL_MONTHS_DATE_KEY,
            title: '__GCAL_MANUAL_MONTHS__',
            mood: 'SYSTEM',
            content: JSON.stringify({ months: manualCalendarMonths }),
            updated_at: new Date().toISOString()
          }, { onConflict: 'date' });
      }
    }

    function renderManualMonthsBadges() {
      const container = document.getElementById('gcal-manual-months-list');
      if (!container) return;
      const isOwner = Boolean(currentUser);

      if (!manualCalendarMonths || manualCalendarMonths.length === 0) {
        container.innerHTML = `<span class="font-mono-tech text-[10px] text-[#56735f]">None pinned (using ±2M auto window)</span>`;
        return;
      }

      container.innerHTML = manualCalendarMonths.map(mKey => `
        <span class="tech-badge badge-blue !text-[10px] flex items-center gap-1">
          <span> ${escapeHtml(mKey)}</span>
          ${isOwner ? `
            <button type="button" onclick="removeManualCalendarMonth('${mKey}')" class="ml-1 text-[#b91c1c] hover:font-bold" title="Delete this manually included month from Supabase">×</button>
          ` : ''}
        </span>
      `).join('');
    }

    // Prunes events in Supabase outside ±2 months of today unless their month_key is in manualCalendarMonths
    // Fingerprint of the last payload written to calendar_events_cache (see the sync below).
    let calendarCacheFingerprint = '';

    async function pruneAndSyncCalendarCacheInSupabase(eventsList, forcePrune = false) {
      if (!currentUser) return;
      const todayStr = getLocalDateString(new Date());
      const lastPrune = localStorage.getItem('autumn_cal_last_prune_date');
      const shouldRunDailyPrune = forcePrune || lastPrune !== todayStr;

      const { minDateStr, maxDateStr } = getAutoCalendarBounds(new Date());

      try {
        if (shouldRunDailyPrune) {
          const { data: existingRows } = await supabaseClient
            .from('calendar_events_cache')
            .select('event_id,date_str,month_key,is_manual_month');

          if (Array.isArray(existingRows) && existingRows.length > 0) {
            const idsToDelete = existingRows
              .filter(r => {
                const inManual = r.month_key && manualCalendarMonths.includes(r.month_key);
                const inAuto = r.date_str >= minDateStr && r.date_str <= maxDateStr;
                return !inManual && !inAuto;
              })
              .map(r => r.event_id);

            if (idsToDelete.length > 0) {
              await supabaseClient
                .from('calendar_events_cache')
                .delete()
                .in('event_id', idsToDelete);
            }
          }
          localStorage.setItem('autumn_cal_last_prune_date', todayStr);
        }

        // Upsert current active events (within ±2M auto window or in manualCalendarMonths)
        const eligibleEvents = (eventsList || []).filter(ev => {
          const mKey = ev.dateStr ? ev.dateStr.slice(0, 7) : '';
          const inManual = mKey && manualCalendarMonths.includes(mKey);
          const inAuto = ev.dateStr >= minDateStr && ev.dateStr <= maxDateStr;
          return inAuto || inManual;
        });

        if (eligibleEvents.length > 0) {
          const upsertPayload = eligibleEvents.map(ev => {
            const mKey = ev.dateStr.slice(0, 7);
            return {
              event_id: ev.id,
              title: ev.title,
              start_time: ev.start.toISOString(),
              end_time: ev.end.toISOString(),
              date_str: ev.dateStr,
              month_key: mKey,
              is_all_day: Boolean(ev.isAllDay),
              location: ev.location || '',
              description: ev.description || '',
              html_link: ev.htmlLink || '',
              priority_color: getEventPriorityColor(ev),
              is_manual_month: manualCalendarMonths.includes(mKey),
              updated_at: new Date().toISOString()
            };
          });

          // This runs on every 60s poll. Previously it re-upserted every single event each
          // time (constant Supabase writes + updated_at churn) even when nothing had changed.
          // Skip the write unless the payload actually differs, or a manual action asked for it.
          const fingerprint = simpleHash(JSON.stringify(upsertPayload));
          if (!forcePrune && fingerprint === calendarCacheFingerprint) return;

          await supabaseClient
            .from('calendar_events_cache')
            .upsert(upsertPayload, { onConflict: 'event_id' });

          calendarCacheFingerprint = fingerprint;
        }
      } catch (err) {
        console.warn('Supabase calendar cache sync note:', err.message);
      }
    }

    async function includeManualCalendarMonth(monthKey) {
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to manually include months in Supabase.', true);
      if (!monthKey) return;
      if (!manualCalendarMonths.includes(monthKey)) {
        manualCalendarMonths.push(monthKey);
        await persistManualCalendarMonths();
      }
      showToast('MONTH INCLUDED', `Fetching & pinning ${monthKey} in Supabase...`);
      await fetchGoogleCalendarEvents(true);
      refreshEventLinkedViews();
    }

    async function removeManualCalendarMonth(monthKey) {
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to remove manual months.', true);
      manualCalendarMonths = manualCalendarMonths.filter(m => m !== monthKey);
      await persistManualCalendarMonths();

      await supabaseClient
        .from('calendar_events_cache')
        .delete()
        .eq('month_key', monthKey);

      showToast('MONTH REMOVED', `Removed manual month ${monthKey} from Supabase.`);
      await fetchGoogleCalendarEvents(false);
      refreshEventLinkedViews();
    }

    async function setCalendarEventPriorityColor(eventId, newColor) {
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to edit event colours.', true);
      if (!eventId || !['RED', 'YELLOW', 'GREEN'].includes(newColor)) return;

      globalEventColorMap[eventId] = newColor;
      const ev = globalCalendarEvents.find(e => e.id === eventId);
      if (ev) ev.priorityColor = newColor;

      if (ev) {
        const mKey = ev.dateStr.slice(0, 7);
        const { error } = await supabaseClient
          .from('calendar_events_cache')
          .upsert({
            event_id: ev.id,
            title: ev.title,
            start_time: ev.start.toISOString(),
            end_time: ev.end.toISOString(),
            date_str: ev.dateStr,
            month_key: mKey,
            is_all_day: Boolean(ev.isAllDay),
            location: ev.location || '',
            description: ev.description || '',
            html_link: ev.htmlLink || '',
            priority_color: newColor,
            is_manual_month: manualCalendarMonths.includes(mKey),
            updated_at: new Date().toISOString()
          }, { onConflict: 'event_id' });

        if (error) {
          showToast('DB SYNC ERROR', error.message, true);
        } else {
          const labelMap = { RED: 'RED (High Priority / Class / Comp)', YELLOW: 'YELLOW (Medium Priority)', GREEN: 'GREEN (Low Priority / Own Plans)' };
          showToast('EVENT COLOUR SAVED', `Updated "${ev.title}" to ${labelMap[newColor]}.`);
        }
      }

      updateNavbarAndRadarTelemetry();
      renderCalendarViewport();
      if (typeof renderFocusMode === 'function') renderFocusMode();
    }

    function cycleEventPriorityColor(eventId, e) {
      if (e) e.stopPropagation();
      if (!currentUser) return showToast('READ-ONLY MODE', 'Sign in as autumn to change event priority colours.', true);
      const current = getEventPriorityColor(eventId);
      const nextOrder = { GREEN: 'YELLOW', YELLOW: 'RED', RED: 'GREEN' };
      setCalendarEventPriorityColor(eventId, nextOrder[current] || 'GREEN');
    }

    function updateEventPriorityColorFromModal(newColor) {
      if (!activeModalEventId) return;
      setCalendarEventPriorityColor(activeModalEventId, newColor);
      highlightModalColorButtons(newColor);
      const ev = globalCalendarEvents.find(e => e.id === activeModalEventId);
      if (ev) {
        document.getElementById('event-modal-status').innerHTML = getEventStatusBadge(ev, new Date());
      }
    }

    function highlightModalColorButtons(activeColor) {
      ['RED', 'YELLOW', 'GREEN'].forEach(c => {
        const btn = document.getElementById(`ev-color-btn-${c}`);
        if (!btn) return;
        if (c === activeColor) {
          btn.style.outline = '2px solid #0c1f17';
          btn.style.outlineOffset = '1px';
        } else {
          btn.style.outline = 'none';
        }
      });
    }

    onReady('gcal-config-form', 'submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to configure calendar sync.', true);

      const calId = document.getElementById('gcal-id-input').value.trim();
      const apiKey = document.getElementById('gcal-key-input').value.trim();

      GOOGLE_CALENDAR_ID = calId;
      GOOGLE_API_KEY = apiKey;

      const { error } = await supabaseClient
        .from('daily_notes')
        .upsert({
          date: GCAL_CONFIG_DATE_KEY,
          title: '__GCAL_CONFIG__',
          mood: 'SYSTEM',
          content: JSON.stringify({ calendarId: calId, apiKey: apiKey }),
          updated_at: new Date().toISOString()
        }, { onConflict: 'date' });

      closeModal('gcal-config-modal');
      if (error) {
        showToast('CONFIG WARNING', 'Applied for current session, but could not persist to Supabase: ' + error.message, true);
      } else {
        showToast('CALENDAR LINKED', 'Google Calendar credentials saved & syncing live events.');
      }
      fetchGoogleCalendarEvents(true);
    });

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
        renderManualMonthsBadges();
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
        renderCalendarViewport();
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
        await pruneAndSyncCalendarCacheInSupabase(globalCalendarEvents, showManualFeedback);

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
      renderCalendarViewport();
    }

    // Returns all tasks in 04 // TASKS that are linked to a given Google Calendar eventId
    function getTasksLinkedToEvent(eventId) {
      if (!eventId || !Array.isArray(globalTaskItems)) return [];
      return globalTaskItems
        .filter(t => {
          const m = typeof getTaskMeta === 'function' ? getTaskMeta(t.id) : null;
          return m && m.eventId === eventId;
        })
        .map(t => {
          const col = (globalTaskColumns || []).find(c => c.id === t.column_id);
          const meta = getTaskMeta(t.id);
          const dueInfo = !t.is_done && meta.dueDate && typeof evaluateTaskDeadline === 'function'
            ? evaluateTaskDeadline(meta.dueDate)
            : null;
          return { task: t, col, meta, dueInfo };
        });
    }

    function buildEventLinkedTasksPillsHtml(eventId, compact = false) {
      const linked = getTasksLinkedToEvent(eventId);
      if (linked.length === 0) return '';
      if (compact) {
        return `
          <div class="flex flex-wrap items-center gap-1 mt-1">
            ${linked.map(({ task, col, dueInfo }) => `
              <span onclick="event.stopPropagation(); closeModal('event-details-modal'); switchTab('tasks');" class="tech-badge ${task.is_done ? 'badge-neutral line-through' : dueInfo ? dueInfo.badgeClass : 'badge-purple'} !text-[9px] !py-0 !px-1.5 cursor-pointer max-w-full truncate" title="Linked Task (${escapeHtml(col ? col.title : 'Task')}): ${escapeHtml(task.title)}">
                ▣ ${escapeHtml(task.title)}
              </span>
            `).join('')}
          </div>
        `;
      }
      return `
        <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
          ${linked.map(({ task, col, dueInfo }) => `
            <button type="button" onclick="event.stopPropagation(); switchTab('tasks');" class="tech-badge ${task.is_done ? 'badge-neutral line-through' : dueInfo ? dueInfo.badgeClass : 'badge-purple'} !text-[9px] !py-0.5 !px-1.5 cursor-pointer max-w-[260px] truncate" title="Open in 04 // TASKS">
              <span>▣ TASK (${escapeHtml(col ? col.title : 'MATRIX')}): ${escapeHtml(task.title)}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    // Open Event Details Modal for any Event ID
    function openEventDetails(eventId) {
      const ev = globalCalendarEvents.find(e => e.id === eventId);
      if (!ev) return;

      activeModalEventId = ev.id;
      const now = new Date();
      const prioColor = getEventPriorityColor(ev);
      highlightModalColorButtons(prioColor);

      document.getElementById('event-modal-status').innerHTML = getEventStatusBadge(ev, now);
      document.getElementById('event-modal-title').textContent = ev.title;

      const dateFormatted = ev.start.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      document.getElementById('event-modal-date').textContent = dateFormatted;
      document.getElementById('event-modal-time').textContent = formatEventTimeSpan(ev);

      const locBox = document.getElementById('event-modal-location-box');
      const locText = document.getElementById('event-modal-location');
      if (ev.location && ev.location.trim() !== '') {
        locText.textContent = ev.location;
        locBox.classList.remove('hidden');
      } else {
        locBox.classList.add('hidden');
      }

      const descEl = document.getElementById('event-modal-desc');
      const linkedTasks = getTasksLinkedToEvent(ev.id);
      const linkedTasksModalHtml = linkedTasks.length > 0
        ? `
          <div class="mb-3 p-2.5 bg-[#f3e8ff]/60 border border-[#d8b4fe]">
            <div class="font-mono-tech text-[10px] font-bold uppercase text-[#6b21a8] mb-1.5">◆ LINKED TASKS IN 04 // TASKS (${linkedTasks.length})</div>
            <div class="flex flex-col gap-1.5">
              ${linkedTasks.map(({ task, col, dueInfo }) => `
                <div class="flex items-center justify-between gap-2 p-1.5 bg-white border border-[#c5ded0] text-xs font-mono-tech">
                  <div class="min-w-0 flex-1">
                    <span class="font-bold text-[#047857]">[${escapeHtml(col ? col.title : 'Task')}]</span>
                    <span class="${task.is_done ? 'line-through text-[#56735f]' : 'text-[#0c1f17] font-semibold'} ml-1 break-words">${escapeHtml(task.title)}</span>
                    ${dueInfo ? `<span class="tech-badge ${dueInfo.badgeClass} !text-[8px] !py-0 !px-1 ml-1">${escapeHtml(dueInfo.label)}</span>` : ''}
                  </div>
                  <button type="button" onclick="closeModal('event-details-modal'); switchTab('tasks');" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] shrink-0">Open Task →</button>
                </div>
              `).join('')}
            </div>
          </div>
        `
        : '';

      if (ev.description && ev.description.trim() !== '') {
        descEl.innerHTML = linkedTasksModalHtml + formatSafeCalendarHtml(ev.description);
        descEl.classList.remove('text-[#56735f]', 'italic');
      } else if (linkedTasksModalHtml) {
        descEl.innerHTML = linkedTasksModalHtml + `<div class="text-[#56735f] italic">No additional event description.</div>`;
        descEl.classList.remove('text-[#56735f]', 'italic');
      } else {
        descEl.textContent = 'No description or additional notes provided for this event.';
        descEl.classList.add('text-[#56735f]', 'italic');
      }

      const linkEl = document.getElementById('event-modal-gcal-link');
      if (ev.htmlLink) {
        linkEl.href = ev.htmlLink;
        linkEl.classList.remove('hidden');
      } else {
        linkEl.classList.add('hidden');
      }

      if (window.umAtlas && typeof window.umAtlas.renderEventModalUmPanel === 'function') {
        window.umAtlas.renderEventModalUmPanel(ev);
      }
      openModal('event-details-modal');
    }

    // Live Telemetry Bar & Sidebar Radar for Ongoing + Upcoming Events + UM 3D Atlas Walk Telemetry
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

    let timelineDaysSpan = 5;

    function setCalendarViewMode(mode) {
      currentCalViewMode = mode;
      ['schedule', 'timeline', 'month', 'week', 'day'].forEach(v => {
        const btn = document.getElementById(`cal-view-btn-${v}`);
        if (btn) {
          if (v === mode) btn.classList.add('active-view');
          else btn.classList.remove('active-view');
        }
      });
      renderCalendarViewport();
    }

    function setTimelineDaysSpan(spanVal) {
      timelineDaysSpan = spanVal;
      renderCalendarViewport();
    }

    function navigateCalendarView(direction) {
      if (direction === 0) {
        currentCalCursorDate = new Date();
      } else if (currentCalViewMode === 'month') {
        currentCalCursorDate.setMonth(currentCalCursorDate.getMonth() + direction);
      } else if (currentCalViewMode === 'week') {
        currentCalCursorDate.setDate(currentCalCursorDate.getDate() + direction * 7);
      } else if (currentCalViewMode === 'day') {
        currentCalCursorDate.setDate(currentCalCursorDate.getDate() + direction);
      } else if (currentCalViewMode === 'timeline') {
        const step = typeof timelineDaysSpan === 'number' ? timelineDaysSpan : 5;
        currentCalCursorDate.setDate(currentCalCursorDate.getDate() + direction * step);
      } else {
        currentCalCursorDate.setDate(currentCalCursorDate.getDate() + direction * 7);
      }
      renderCalendarViewport();
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

    // Banner shown when navigating to a month outside the ±2-month automatic window
    function buildManualMonthControlBanner(cursorDate) {
      const mKey = getMonthKeyFromDate(cursorDate);
      if (isMonthWithinAutoWindow(mKey)) return '';

      const isIncluded = manualCalendarMonths.includes(mKey);
      const monthLabel = cursorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
      const isOwner = Boolean(currentUser);

      if (isIncluded) {
        return `
          <div class="mb-3 p-3 bg-[#e0f2fe] border border-[#7dd3fc] flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="tech-badge badge-blue"> MANUALLY INCLUDED MONTH</span>
              <span class="text-[#0c1f17] font-semibold">${monthLabel} (${mKey}) is manually pinned in Supabase outside the ±2M window.</span>
            </div>
            ${isOwner ? `
              <button type="button" onclick="removeManualCalendarMonth('${mKey}')" class="btn-tech-outline !py-1 !px-2.5 !text-[11px] !border-[#fca5a5] !text-[#b91c1c] hover:!bg-[#fee2e2]">
                 Remove ${mKey} from Supabase
              </button>
            ` : ''}
          </div>
        `;
      }

      return `
        <div class="mb-3 p-3 bg-[#fef3c7] border border-[#fcd34d] flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="tech-badge badge-amber">OUTSIDE ±2M AUTO WINDOW</span>
            <span class="text-[#78350f]"><strong>${monthLabel} (${mKey})</strong> is beyond 2 months from today and not auto-synced.</span>
          </div>
          ${isOwner ? `
            <button type="button" onclick="includeManualCalendarMonth('${mKey}')" class="btn-chamfer !py-1 !px-3 !text-xs">
              + Request &amp; Include ${mKey}
            </button>
          ` : `<span class="text-[10px] text-[#92400e]"> Sign in as owner to request this month</span>`}
        </div>
      `;
    }

    function computeStructuredDayLayout(dayTimedEvents, dayStartHour, hourHeightPx) {
      const sorted = dayTimedEvents.slice().sort((a, b) => {
        if (a.start.getTime() !== b.start.getTime()) return a.start - b.start;
        return (b.end - b.start) - (a.end - a.start);
      });

      const clusters = [];
      let currentCluster = [];
      let clusterMaxEnd = null;

      sorted.forEach(ev => {
        if (currentCluster.length === 0) {
          currentCluster.push(ev);
          clusterMaxEnd = ev.end;
        } else if (ev.start < clusterMaxEnd) {
          currentCluster.push(ev);
          if (ev.end > clusterMaxEnd) clusterMaxEnd = ev.end;
        } else {
          clusters.push(currentCluster);
          currentCluster = [ev];
          clusterMaxEnd = ev.end;
        }
      });
      if (currentCluster.length > 0) clusters.push(currentCluster);

      const positioned = [];
      clusters.forEach(cluster => {
        const colsLastEnd = [];
        const itemsWithCol = cluster.map(ev => {
          let assignedCol = -1;
          for (let c = 0; c < colsLastEnd.length; c++) {
            if (colsLastEnd[c] <= ev.start) {
              assignedCol = c;
              colsLastEnd[c] = ev.end;
              break;
            }
          }
          if (assignedCol === -1) {
            assignedCol = colsLastEnd.length;
            colsLastEnd.push(ev.end);
          }
          return { ev, colIndex: assignedCol };
        });

        const totalCols = Math.max(1, colsLastEnd.length);
        itemsWithCol.forEach(({ ev, colIndex }) => {
          const startFloat = ev.start.getHours() + ev.start.getMinutes() / 60;
          const endFloat = Math.max(
            startFloat + 0.45,
            ev.end.getDate() !== ev.start.getDate() ? 24 : (ev.end.getHours() + ev.end.getMinutes() / 60)
          );
          const topPx = Math.max(0, (startFloat - dayStartHour) * hourHeightPx);
          const heightPx = Math.max(26, (endFloat - startFloat) * hourHeightPx - 2);

          positioned.push({
            ev,
            colIndex,
            totalCols,
            topPx,
            heightPx
          });
        });
      });

      return positioned;
    }

    function renderCalendarViewport() {
      const viewport = document.getElementById('calendar-main-viewport');
      const rangeLabel = document.getElementById('cal-range-label');
      if (!viewport) return;

      const now = new Date();
      const isOwner = Boolean(currentUser);
      const manualMonthBannerHtml = buildManualMonthControlBanner(currentCalCursorDate);

      if (!GOOGLE_API_KEY && globalCalendarEvents.length === 0) {
        rangeLabel.textContent = 'Google Calendar API Key Not Configured Yet';
        viewport.innerHTML = `
          <div class="tech-grid-bg border border-dashed border-[#87b39b] p-8 text-center flex flex-col items-center justify-center min-h-[360px]">
            <span class="tech-badge badge-amber mb-2">GOOGLE CALENDAR LINK REQUIRED</span>
            <h3 class="text-base font-bold text-[#0c1f17]">Connect Your Google Calendar Events</h3>
            <p class="font-mono-tech text-xs text-[#436152] max-w-md mt-1">
              Sign in as <strong>autumn</strong> and click <strong>" Configure Google Calendar Source"</strong> on the left panel to stream your Google Calendar events automatically.
            </p>
          </div>
        `;
        return;
      }

      // 1. SCHEDULE VIEW (DEFAULT LIST AGENDA)
      if (currentCalViewMode === 'schedule') {
        const startWindow = new Date(currentCalCursorDate);
        startWindow.setHours(0, 0, 0, 0);
        const endWindow = new Date(startWindow);
        endWindow.setDate(endWindow.getDate() + 30);

        rangeLabel.textContent = `SCHEDULE AGENDA // ${startWindow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} → +30 Days`;

        const upcomingList = globalCalendarEvents.filter(ev => ev.end >= startWindow && ev.start <= endWindow);

        const modeSwitchSubbar = `
          ${manualMonthBannerHtml}
          <div class="mb-3 p-2.5 bg-[#eff8f2] border border-[#c5ded0] flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="tech-badge badge-green">DEFAULT AGENDA</span>
              <span class="text-[#436152]">Click colour badge to cycle priority (Green → Yellow → Red)</span>
            </div>
            <button type="button" onclick="setCalendarViewMode('timeline')" class="btn-tech-outline !py-1 !px-2.5 !text-[11px]">
              Switch to Structured Timeline Grid ⊞ →
            </button>
          </div>
        `;

        if (upcomingList.length === 0) {
          viewport.innerHTML = `
            ${modeSwitchSubbar}
            <div class="tech-grid-bg border border-[#c5ded0] p-10 text-center font-mono-tech text-xs text-[#56735f]">
              No Google Calendar events scheduled in this 30-day window.
            </div>
          `;
          return;
        }

        const grouped = {};
        upcomingList.forEach(ev => {
          if (!grouped[ev.dateStr]) grouped[ev.dateStr] = [];
          grouped[ev.dateStr].push(ev);
        });

        const todayStr = getLocalDateString(now);
        viewport.innerHTML = `
          ${modeSwitchSubbar}
          <div class="flex flex-col gap-4">
            ${Object.keys(grouped).map(dateKey => {
              const dayEvents = grouped[dateKey];
              const dObj = new Date(dateKey + 'T00:00:00');
              const isToday = dateKey === todayStr;
              const dateHeader = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();

              return `
                <div class="border ${isToday ? 'border-[#059669] bg-[#eff8f2]' : 'border-[#c5ded0] bg-white'}">
                  <div class="px-3.5 py-2 border-b border-[#c5ded0] flex items-center justify-between flex-wrap gap-2 bg-[#f4faf6]">
                    <div class="flex items-center gap-2 font-mono-tech text-xs font-bold text-[#0c1f17]">
                      <span>${dateHeader}</span>
                      ${isToday ? '<span class="tech-badge badge-green">TODAY</span>' : ''}
                    </div>
                    <span class="font-mono-tech text-[11px] text-[#436152]">${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}</span>
                  </div>
                  <div class="divide-y divide-[#e2efe8]">
                    ${dayEvents.map(ev => {
                      const theme = getEventPriorityTheme(ev);
                      return `
                        <div style="border-left: 4px solid ${theme.accent}; background-color: ${theme.bg}45;" class="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#f9fdfb]">
                          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
                            <div class="font-mono-tech text-xs font-semibold sm:w-32 shrink-0" style="color:${theme.meta};">
                              ${formatEventTimeSpan(ev)}
                            </div>
                            <div class="min-w-0">
                              <div class="font-bold text-sm text-[#0c1f17] break-words">${escapeHtml(ev.title)}</div>
                              ${(ev.location || ev.description) ? `
                                <div class="font-mono-tech text-xs text-[#436152] mt-0.5 truncate max-w-xl">
                                  ${ev.location ? ` ${escapeHtml(ev.location)} ` : ''}${ev.description ? escapeHtml(stripHtmlTags(ev.description).slice(0, 90)) : ''}
                                </div>
                              ` : ''}
                              ${buildEventLinkedTasksPillsHtml(ev.id, false)}
                              ${window.umAtlas ? window.umAtlas.buildEventUmWalkInlineHtml(ev, false) : ''}
                            </div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0 flex-wrap">
                            ${isOwner ? `
                              <button type="button" onclick="cycleEventPriorityColor('${jsAttrQuote(ev.id)}', event)" class="touch-action-btn !text-[10px] !px-2" title="Click to cycle colour (Green / Yellow / Red)">
                                 Colour
                              </button>
                            ` : ''}
                            ${getEventStatusBadge(ev, now)}
                            <button type="button" onclick="openEventDetails('${jsAttrQuote(ev.id)}')" class="btn-tech-outline !py-1 !px-2.5 !text-[11px]">
                              Details
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
        return;
      }

      // 1B. ALTERNATIVE SCHEDULE VIEW: 12AM–12AM STRUCTURED TIMELINE GRID
      if (currentCalViewMode === 'timeline') {
        const startCursor = new Date(currentCalCursorDate);
        startCursor.setHours(0, 0, 0, 0);

        let dayDates = [];
        if (timelineDaysSpan === 'active') {
          const uniqueDateStrs = [];
          globalCalendarEvents.forEach(ev => {
            if (ev.end >= startCursor && !uniqueDateStrs.includes(ev.dateStr)) {
              uniqueDateStrs.push(ev.dateStr);
            }
          });
          dayDates = uniqueDateStrs.slice(0, 5).map(ds => new Date(ds + 'T00:00:00'));
          if (dayDates.length === 0) {
            for (let i = 0; i < 3; i++) {
              const d = new Date(startCursor);
              d.setDate(startCursor.getDate() + i);
              dayDates.push(d);
            }
          }
        } else {
          const count = Number(timelineDaysSpan) || 5;
          for (let i = 0; i < count; i++) {
            const d = new Date(startCursor);
            d.setDate(startCursor.getDate() + i);
            dayDates.push(d);
          }
        }

        const firstDayLabel = dayDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const lastDayLabel = dayDates[dayDates.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        rangeLabel.textContent = `STRUCTURED TIMELINE (12AM – 12AM) // ${firstDayLabel} – ${lastDayLabel}`;

        const minHour = 0;
        const maxHour = 24;
        const totalHours = 24;
        const hourHeightPx = 56;
        const totalGridHeightPx = totalHours * hourHeightPx;
        const todayStr = getLocalDateString(now);

        let timeAxisHtml = '';
        for (let h = minHour; h <= maxHour; h++) {
          const topPx = (h - minHour) * hourHeightPx;
          const label = h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
          const posClass = h === 0 ? 'translate-y-0.5' : h === 24 ? '-translate-y-3.5' : '-translate-y-2';
          timeAxisHtml += `
            <div style="top: ${topPx}px;" class="absolute left-0 right-0 pr-1.5 text-right font-mono-tech text-[10px] font-semibold text-[#436152] ${posClass} select-none">
              ${label}
            </div>
          `;
        }

        let gridLinesHtml = '';
        for (let h = minHour; h < maxHour; h++) {
          const topPx = (h - minHour) * hourHeightPx;
          gridLinesHtml += `
            <div class="timeline-hour-line" style="top: ${topPx}px;"></div>
            <div class="timeline-half-hour-line" style="top: ${topPx + hourHeightPx / 2}px;"></div>
          `;
        }

        const availWidth = viewport.clientWidth || window.innerWidth;
        const minColWidthPx = window.innerWidth < 640 ? 250 : window.innerWidth < 1024 ? 220 : 195;
        const maxColsPerRow = Math.max(1, Math.floor((availWidth - 58) / minColWidthPx));

        const dayChunks = [];
        for (let i = 0; i < dayDates.length; i += maxColsPerRow) {
          dayChunks.push(dayDates.slice(i, i + maxColsPerRow));
        }

        const renderDayColumnHtml = (dObj) => {
          const dStr = getLocalDateString(dObj);
          const isToday = dStr === todayStr;
          const dayAllEvents = globalCalendarEvents.filter(e => e.dateStr === dStr);
          const allDayEvs = dayAllEvents.filter(e => e.isAllDay);
          const timedEvs = dayAllEvents.filter(e => !e.isAllDay);

          const positionedItems = computeStructuredDayLayout(timedEvs, minHour, hourHeightPx);

          let nowLineHtml = '';
          if (isToday) {
            const nowFloat = now.getHours() + now.getMinutes() / 60;
            const nowTop = (nowFloat - minHour) * hourHeightPx;
            const nowTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            nowLineHtml = `
              <div style="top: ${nowTop}px;" class="absolute left-0 right-0 z-30 pointer-events-none flex items-center">
                <span class="px-1 py-0.2 bg-[#0c1f17] text-[#34d399] border border-[#10b981] font-mono-tech text-[9px] font-bold tracking-tighter shadow-xs">
                  ◆ NOW ${nowTimeStr}
                </span>
                <div class="flex-1 border-t-2 border-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.6)]"></div>
              </div>
            `;
          }

          const eventsBlocksHtml = positionedItems.map(({ ev, colIndex, totalCols, topPx, heightPx }) => {
            const isOngoing = now >= ev.start && now < ev.end;
            const isPast = ev.end < now;
            const prioTheme = getEventPriorityTheme(ev);
            const styleSet = isOngoing
              ? { bg: '#064e3b', border: '#10b981', accent: '#34d399', title: '#ffffff', meta: '#a7f3d0', pillBg: '#047857' }
              : prioTheme;

            const widthPct = 100 / totalCols;
            const leftPct = colIndex * widthPct;
            const durationMins = Math.max(1, Math.round((ev.end - ev.start) / 60000));
            const durationText = durationMins >= 60 ? formatHours(durationMins / 60) : `${durationMins}m`;
            const cleanDesc = stripHtmlTags(ev.description || '');

            const showCompactSingleLine = heightPx < 38;
            const showLocationRow = heightPx >= 54 && Boolean(ev.location);
            const showDescriptionSnippet = heightPx >= 86 && Boolean(cleanDesc);
            const showTelemetryFooter = heightPx >= 125;

            return `
              <div
                onclick="openEventDetails('${jsAttrQuote(ev.id)}')"
                class="timeline-event-card flex flex-col justify-between ${isPast ? 'opacity-80' : ''}"
                style="
                  top: ${topPx + 1}px;
                  height: ${heightPx}px;
                  left: calc(${leftPct}% + 2px);
                  width: calc(${widthPct}% - 4px);
                  background-color: ${styleSet.bg};
                  border: 1px solid ${styleSet.border};
                  border-left: 3px solid ${styleSet.accent};
                  color: ${styleSet.title};
                  z-index: ${10 + colIndex};
                "
                title="${escapeHtml(ev.title)} (${formatEventTimeSpan(ev)} • ${durationText})${ev.location ? ' •  ' + escapeHtml(ev.location) : ''}"
              >
                <div class="min-w-0 overflow-hidden">
                  ${showCompactSingleLine ? `
                    <div class="flex items-center justify-between gap-1 truncate">
                      <span class="font-bold text-[11px] truncate">${escapeHtml(ev.title)}</span>
                      <span class="font-mono-tech text-[9px] shrink-0" style="color: ${styleSet.meta};">${escapeHtml(formatShortAmPmSpan(ev))}</span>
                    </div>
                  ` : `
                    <div class="flex items-start justify-between gap-1">
                      <span class="font-mono-tech text-[9px] font-bold uppercase tracking-tight px-1 py-0.2 border border-current/20 shrink-0" style="background-color: ${styleSet.pillBg}; color: ${styleSet.meta};">
                        ${escapeHtml(formatEventTimeSpan(ev))} • ${durationText}
                      </span>
                      ${totalCols > 1 ? `
                        <span class="font-mono-tech text-[8px] px-1 border border-current/20 shrink-0" style="color: ${styleSet.meta};">
                          C${colIndex + 1}/${totalCols}
                        </span>
                      ` : ''}
                    </div>
                    <div class="font-bold text-xs leading-snug break-words mt-1 ${heightPx >= 110 ? 'line-clamp-3' : 'line-clamp-2'}">
                      ${isOngoing ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-[#34d399] pulse-live mr-1"></span>' : ''}${escapeHtml(ev.title)}
                    </div>
                  `}

                  ${showLocationRow ? `
                    <div class="font-mono-tech text-[10px] mt-1 truncate flex items-center gap-1" style="color: ${styleSet.meta};">
                      <span>◆</span>
                      <span class="truncate">LOC: ${escapeHtml(ev.location)}</span>
                    </div>
                  ` : ''}

                  ${heightPx >= 50 ? buildEventLinkedTasksPillsHtml(ev.id, true) : ''}
                  ${heightPx >= 64 && window.umAtlas ? window.umAtlas.buildEventUmWalkInlineHtml(ev, true) : ''}

                  ${showDescriptionSnippet ? `
                    <div class="font-mono-tech text-[10px] mt-1 pt-1 border-t border-current/15 break-words ${heightPx >= 150 ? 'line-clamp-4' : 'line-clamp-2'} opacity-90" style="color: ${styleSet.meta};">
                      ${escapeHtml(cleanDesc)}
                    </div>
                  ` : ''}
                </div>

                ${showTelemetryFooter ? `
                  <div class="flex items-center justify-between gap-1 pt-1 mt-1 border-t border-current/15 font-mono-tech text-[9px] shrink-0" style="color: ${styleSet.meta};">
                    <span>STATUS // ${isOngoing ? 'LIVE NOW' : isPast ? 'COMPLETED' : 'SCHEDULED'}</span>
                    <span class="underline font-bold">INSPECT →</span>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('');

          return `
            <div class="flex-1 min-w-0 border-l border-[#c5ded0] flex flex-col">
              <div class="p-2.5 border-b border-[#c5ded0] ${isToday ? 'bg-[#dcfce7]' : 'bg-[#f4faf6]'} text-center">
                <div class="flex items-center justify-center gap-1.5 font-mono-tech text-[10px] uppercase ${isToday ? 'text-[#047857] font-bold' : 'text-[#436152]'}">
                  <span>${dObj.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span>•</span>
                  <span>${dayAllEvents.length} EVT</span>
                </div>
                <div class="font-mono-tech text-sm font-bold ${isToday ? 'text-[#047857]' : 'text-[#0c1f17]'} mt-0.5">
                  ${dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  ${isToday ? '<span class="ml-1 text-[9px] px-1.5 py-0.5 bg-[#0c1f17] text-[#34d399]">TODAY</span>' : ''}
                </div>
                ${allDayEvs.length > 0 ? `
                  <div class="mt-1.5 flex flex-col gap-1">
                    ${allDayEvs.map(aev => {
                      const ath = getEventPriorityTheme(aev);
                      return `
                        <button type="button" onclick="openEventDetails('${jsAttrQuote(aev.id)}')" style="background-color:${ath.bg}; color:${ath.title}; border-color:${ath.accent};" class="w-full text-left px-1.5 py-0.5 border font-mono-tech text-[10px] font-bold truncate">
                          ◆ ALL DAY: ${escapeHtml(aev.title)}
                        </button>
                      `;
                    }).join('')}
                  </div>
                ` : ''}
              </div>

              <div class="relative w-full tech-grid-bg/40" style="height: ${totalGridHeightPx}px;">
                ${gridLinesHtml}
                ${nowLineHtml}
                ${eventsBlocksHtml}
              </div>
            </div>
          `;
        };

        const timelineRowsHtml = dayChunks.map((chunkDates, chunkIdx) => `
          <div class="timeline-grid-wrapper ${chunkIdx > 0 ? 'mt-4' : ''}">
            <div class="flex items-stretch w-full min-w-0">
              <div class="w-12 sm:w-14 shrink-0 bg-[#f4faf6] select-none flex flex-col">
                <div class="p-2.5 border-b border-[#c5ded0] bg-[#e8f3ec] flex flex-col items-center justify-center font-mono-tech text-[9px] font-bold text-[#436152] min-h-[54px]">
                  <span>UTC+8</span>
                  <span class="text-[8px] text-[#047857]">24H</span>
                </div>
                <div class="relative flex-1" style="height: ${totalGridHeightPx}px;">
                  ${timeAxisHtml}
                </div>
              </div>
              <div class="flex flex-1 min-w-0">
                ${chunkDates.map(d => renderDayColumnHtml(d)).join('')}
              </div>
            </div>
          </div>
        `).join('');

        viewport.innerHTML = `
          ${manualMonthBannerHtml}
          <div class="mb-3 p-2.5 bg-[#eff8f2] border border-[#c5ded0] flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap font-mono-tech text-xs">
              <span class="tech-badge badge-green">12AM – 12AM TIMELINE</span>
              <span class="text-[#436152] text-[11px]">Click any event card to inspect or change priority colour</span>
            </div>
            <div class="flex items-center gap-1 flex-wrap">
              <span class="font-mono-tech text-[10px] uppercase text-[#436152] mr-1">Span:</span>
              <button type="button" onclick="setTimelineDaysSpan(1)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${timelineDaysSpan === 1 ? 'active-view' : ''}">1D</button>
              <button type="button" onclick="setTimelineDaysSpan(3)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${timelineDaysSpan === 3 ? 'active-view' : ''}">3D</button>
              <button type="button" onclick="setTimelineDaysSpan(5)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${timelineDaysSpan === 5 ? 'active-view' : ''}">5D</button>
              <button type="button" onclick="setTimelineDaysSpan(7)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${timelineDaysSpan === 7 ? 'active-view' : ''}">7D</button>
              <button type="button" onclick="setTimelineDaysSpan('active')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${timelineDaysSpan === 'active' ? 'active-view' : ''}" title="Show upcoming days with scheduled events">Active Days</button>
              <button type="button" onclick="setCalendarViewMode('schedule')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ml-1">List View</button>
            </div>
          </div>

          ${timelineRowsHtml}
        `;
        return;
      }

      // 2. MONTH VIEW
      if (currentCalViewMode === 'month') {
        const year = currentCalCursorDate.getFullYear();
        const month = currentCalCursorDate.getMonth();
        rangeLabel.textContent = `MONTH MATRIX // ${currentCalCursorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = getLocalDateString(now);

        let cellsHtml = '';
        for (let i = 0; i < firstDay; i++) {
          cellsHtml += `<div class="min-h-[92px] bg-[#eff8f2]/50 border border-[#d5e6dc]"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
          const dObj = new Date(year, month, day);
          const dStr = getLocalDateString(dObj);
          const dayEvs = globalCalendarEvents.filter(e => e.dateStr === dStr);
          const isToday = dStr === todayStr;

          cellsHtml += `
            <div onclick="inspectCalendarDay('${dStr}')" class="min-h-[92px] p-1.5 border ${isToday ? 'border-2 border-[#059669] bg-[#eff8f2]' : 'border-[#c5ded0] bg-white'} flex flex-col justify-between cursor-pointer hover:border-[#0c1f17] transition-all min-w-0">
              <div class="flex items-center justify-between font-mono-tech text-xs">
                <span class="font-bold ${isToday ? 'text-[#047857]' : 'text-[#0c1f17]'}">${day}</span>
                ${dayEvs.length > 0 ? `<span class="text-[10px] text-[#047857] font-bold">${dayEvs.length}</span>` : ''}
              </div>
              <div class="flex flex-col gap-1 mt-1 overflow-hidden">
                ${dayEvs.slice(0, 3).map(ev => {
                  const isLive = now >= ev.start && now < ev.end;
                  const th = getEventPriorityTheme(ev);
                  return `
                    <button type="button" onclick="event.stopPropagation(); openEventDetails('${jsAttrQuote(ev.id)}')" style="${isLive ? '' : `background-color:${th.bg}; color:${th.title}; border-color:${th.border};`}" class="text-left px-1 py-0.5 text-[10px] font-mono-tech truncate border ${isLive ? 'bg-[#059669] text-white border-[#047857]' : ''} hover:border-[#0c1f17]" title="Click for details: ${escapeHtml(ev.title)}">
                      ${escapeHtml(ev.title)}
                    </button>
                  `;
                }).join('')}
                ${dayEvs.length > 3 ? `<div class="text-[9px] font-mono-tech text-[#436152]">+${dayEvs.length - 3} more</div>` : ''}
              </div>
            </div>
          `;
        }

        viewport.innerHTML = `
          ${manualMonthBannerHtml}
          <div>
            <div class="grid grid-cols-7 gap-1.5 mb-1.5 font-mono-tech text-[11px] font-bold text-[#436152] text-center uppercase">
              <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div class="grid grid-cols-7 gap-1.5">
              ${cellsHtml}
            </div>
          </div>
        `;
        return;
      }

      // 3. WEEK VIEW
      if (currentCalViewMode === 'week') {
        const startOfWeek = new Date(currentCalCursorDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);

        rangeLabel.textContent = `WEEK MATRIX // ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        const todayStr = getLocalDateString(now);
        let colsHtml = '';

        for (let i = 0; i < 7; i++) {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          const dStr = getLocalDateString(d);
          const isToday = dStr === todayStr;
          const dayEvs = globalCalendarEvents.filter(e => e.dateStr === dStr);

          colsHtml += `
            <div class="border ${isToday ? 'border-[#059669] bg-[#eff8f2]' : 'border-[#c5ded0] bg-white'} flex flex-col min-h-[340px] min-w-0">
              <div class="p-2 border-b border-[#c5ded0] bg-[#f4faf6] text-center font-mono-tech">
                <div class="text-[10px] uppercase text-[#436152]">${d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div class="text-sm font-bold ${isToday ? 'text-[#047857]' : 'text-[#0c1f17]'}">${d.getDate()}</div>
              </div>
              <div class="p-2 flex flex-col gap-2 flex-1">
                ${dayEvs.length === 0
                  ? `<div class="font-mono-tech text-[10px] text-[#56735f] text-center my-auto">—</div>`
                  : dayEvs.map(ev => {
                      const th = getEventPriorityTheme(ev);
                      return `
                        <div style="background-color:${th.bg}; border-color:${th.border}; border-left:3px solid ${th.accent};" class="p-2 border text-xs font-mono-tech flex flex-col justify-between gap-1.5">
                          <div>
                            <div class="text-[10px] font-bold" style="color:${th.meta};">${formatEventTimeSpan(ev)}</div>
                            <div class="font-bold text-[#0c1f17] mt-0.5 break-words">${escapeHtml(ev.title)}</div>
                            ${ev.location ? `<div class="text-[10px] text-[#436152] truncate mt-0.5"> ${escapeHtml(ev.location)}</div>` : ''}
                            ${buildEventLinkedTasksPillsHtml(ev.id, true)}
                            ${window.umAtlas ? window.umAtlas.buildEventUmWalkInlineHtml(ev, true) : ''}
                          </div>
                          <button type="button" onclick="openEventDetails('${jsAttrQuote(ev.id)}')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] w-full justify-center mt-1">
                            Details
                          </button>
                        </div>
                      `;
                    }).join('')
                }
              </div>
            </div>
          `;
        }

        viewport.innerHTML = `
          ${manualMonthBannerHtml}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
            ${colsHtml}
          </div>
        `;
        return;
      }

      // 4. DAY VIEW
      if (currentCalViewMode === 'day') {
        const dStr = getLocalDateString(currentCalCursorDate);
        rangeLabel.textContent = `DAY TIMELINE // ${currentCalCursorDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}`;

        const dayEvs = globalCalendarEvents.filter(e => e.dateStr === dStr);

        if (dayEvs.length === 0) {
          viewport.innerHTML = `
            ${manualMonthBannerHtml}
            <div class="tech-grid-bg border border-[#c5ded0] p-12 text-center font-mono-tech text-xs text-[#56735f]">
              No events scheduled on ${dStr}.
            </div>
          `;
          return;
        }

        viewport.innerHTML = `
          ${manualMonthBannerHtml}
          <div class="flex flex-col gap-3">
            ${dayEvs.map(ev => {
              const th = getEventPriorityTheme(ev);
              return `
                <div style="border-left: 4px solid ${th.accent}; background-color: ${th.bg}45;" class="p-4 border border-[#c5ded0] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="font-mono-tech text-xs font-bold" style="color:${th.meta};">${formatEventTimeSpan(ev)}</div>
                    <h3 class="text-base font-bold text-[#0c1f17] mt-1 break-words">${escapeHtml(ev.title)}</h3>
                    ${ev.location ? `<div class="font-mono-tech text-xs text-[#436152] mt-1"> ${escapeHtml(ev.location)}</div>` : ''}
                    ${ev.description ? `<div class="font-mono-tech text-xs text-[#436152] mt-1.5 line-clamp-2 break-words">${formatSafeCalendarHtml(ev.description)}</div>` : ''}
                    ${buildEventLinkedTasksPillsHtml(ev.id, false)}
                    ${window.umAtlas ? window.umAtlas.buildEventUmWalkInlineHtml(ev, false) : ''}
                  </div>
                  <div class="flex items-center gap-2 shrink-0 flex-wrap">
                    ${isOwner ? `
                      <button type="button" onclick="cycleEventPriorityColor('${jsAttrQuote(ev.id)}', event)" class="touch-action-btn !text-[10px] !px-2">
                         Colour
                      </button>
                    ` : ''}
                    ${getEventStatusBadge(ev, now)}
                    <button type="button" onclick="openEventDetails('${jsAttrQuote(ev.id)}')" class="btn-tech-outline !py-1 !px-2.5 !text-xs">
                      Details
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    function inspectCalendarDay(dateStr) {
      currentCalCursorDate = new Date(dateStr + 'T00:00:00');
      setCalendarViewMode('day');
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

    function getTaskProgressState(taskId) {
      return taskStatusMap[taskId] === 'IN-PROGRESS' ? 'IN-PROGRESS' : 'QUEUED';
    }

    function toggleTaskProgressState(taskId, e) {
      if (e) e.stopPropagation();
      if (!currentUser) return showToast('READ-ONLY MODE', 'Sign in as autumn to toggle task status.', true);
      const current = getTaskProgressState(taskId);
      taskStatusMap[taskId] = current === 'IN-PROGRESS' ? 'QUEUED' : 'IN-PROGRESS';
      persistTaskColumnOrder(taskColOrder);
      renderTasksBoard();
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

    function moveTaskItem(colId, taskId, delta) {
      // Reorder among SIBLINGS: the scope key is the parent task id (or the column id for
      // roots), so a subtask can never swap places with a top-level task.
      const moving = getTaskById(taskId);
      if (!moving) return;
      const parentId = getTaskParentId(moving);
      const scopeKey = parentId || colId;
      const siblings = sortTaskItemsForColumn(scopeKey, (globalTaskItems || []).filter(item =>
        item.column_id === colId && getTaskParentId(item) === parentId));
      const currentIds = siblings.map(t => t.id);
      const idx = currentIds.indexOf(taskId);
      if (idx === -1) return;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= currentIds.length) return;

      const temp = currentIds[idx];
      currentIds[idx] = currentIds[targetIdx];
      currentIds[targetIdx] = temp;

      taskItemOrder[scopeKey] = currentIds;
      persistTaskColumnOrder(taskColOrder);
      renderTasksBoard();
    }

    function toggleEntireTaskMatrixSection() {
      const wrap = document.getElementById('tasks-matrix-body-wrap');
      const btn = document.getElementById('toggle-task-matrix-section-btn');
      if (!wrap) return;
      isEntireTaskMatrixCollapsed = !isEntireTaskMatrixCollapsed;
      if (isEntireTaskMatrixCollapsed) {
        wrap.classList.add('hidden');
        if (btn) btn.textContent = '▸ Expand Matrix';
      } else {
        wrap.classList.remove('hidden');
        if (btn) btn.textContent = '▾ Collapse Matrix';
      }
    }

    function toggleTaskColumnCollapse(colId) {
      collapsedTaskCols[colId] = !collapsedTaskCols[colId];
      try {
        localStorage.setItem('autumn_task_col_collapsed', JSON.stringify(collapsedTaskCols));
      } catch (e) {}
      renderTasksBoard();
    }

    function setAllTaskColumnsCollapsed(collapsed) {
      globalTaskColumns.forEach(c => {
        collapsedTaskCols[c.id] = collapsed;
      });
      try {
        localStorage.setItem('autumn_task_col_collapsed', JSON.stringify(collapsedTaskCols));
      } catch (e) {}
      if (!collapsed && isEntireTaskMatrixCollapsed) {
        toggleEntireTaskMatrixSection();
      }
      renderTasksBoard();
    }

    function moveTaskColumn(colId, delta) {
      const currentIds = globalTaskColumns.map(c => c.id);
      const idx = currentIds.indexOf(colId);
      if (idx === -1) return;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= currentIds.length) return;

      const temp = currentIds[idx];
      currentIds[idx] = currentIds[targetIdx];
      currentIds[targetIdx] = temp;

      persistTaskColumnOrder(currentIds);
      globalTaskColumns = sortTaskColumnsBySavedOrder(globalTaskColumns);
      renderTasksBoard();
    }

    function handleTaskColDragStart(e, colId) {
      draggedTaskColId = colId;
      e.currentTarget.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', colId);
      }
    }

    function handleTaskColDragOver(e) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      e.currentTarget.classList.add('drag-over');
    }

    function handleTaskColDragLeave(e) {
      e.currentTarget.classList.remove('drag-over');
    }

    function handleTaskColDragEnd(e) {
      e.currentTarget.classList.remove('dragging', 'drag-over');
      draggedTaskColId = null;
    }

    function handleTaskColDrop(e, targetColId) {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      const sourceId = draggedTaskColId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
      draggedTaskColId = null;
      if (!sourceId || sourceId === targetColId) return;

      const currentIds = globalTaskColumns.map(c => c.id);
      const fromIdx = currentIds.indexOf(sourceId);
      const toIdx = currentIds.indexOf(targetColId);
      if (fromIdx === -1 || toIdx === -1) return;

      currentIds.splice(fromIdx, 1);
      currentIds.splice(toIdx, 0, sourceId);

      persistTaskColumnOrder(currentIds);
      globalTaskColumns = sortTaskColumnsBySavedOrder(globalTaskColumns);
      renderTasksBoard();
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

    // Sorts calendar events so upcoming/today events closest to today appear first,
    // followed by recent past events ordered by proximity to today.
    function buildCalendarEventsOptionsHtml(selectedEventId = '') {
      const todayStr = getLocalDateString(new Date());
      const todayMs = new Date(todayStr + 'T00:00:00').getTime();

      const sortedByClosest = (globalCalendarEvents || []).slice().sort((a, b) => {
        const aTime = new Date((a.dateStr || todayStr) + 'T00:00:00').getTime();
        const bTime = new Date((b.dateStr || todayStr) + 'T00:00:00').getTime();
        const aIsFutureOrToday = aTime >= todayMs;
        const bIsFutureOrToday = bTime >= todayMs;

        // Show upcoming/today events first, ordered nearest date first (e.g. Nov 1, Nov 2...)
        if (aIsFutureOrToday && !bIsFutureOrToday) return -1;
        if (!aIsFutureOrToday && bIsFutureOrToday) return 1;
        if (aIsFutureOrToday && bIsFutureOrToday) return aTime - bTime;
        // For past events, show most recent past dates first
        return bTime - aTime;
      }).slice(0, 60);

      let html = `<option value="">— No Linked Event (Optional) —</option>`;
      sortedByClosest.forEach(ev => {
        const sel = ev.id === selectedEventId ? 'selected' : '';
        const label = `${ev.dateStr} • ${ev.title.slice(0, 32)}`;
        html += `<option value="${escapeHtml(ev.id)}" ${sel}>${escapeHtml(label)}</option>`;
      });
      return html;
    }

    // ── Event-linked views + cross-device task meta (B6) ────────────────────
    // taskMetaMap (deadline + linked Calendar event) used to live only in localStorage, so a
    // link made on the laptop never reached the phone. The optional task_items columns below
    // are now the source of truth when they exist; if the migration has not been applied the
    // local map stays authoritative and nothing breaks.
    //
    // ── MIGRATION (run once in the Supabase SQL editor) ─────────────────────
    //   alter table public.task_items add column if not exists due_date date;
    //   alter table public.task_items add column if not exists event_id text;
    // ────────────────────────────────────────────────────────────────────────
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

    // Direct children of `parentId` ('' = the column's roots), in the operator's saved order.
    // Child order reuses taskItemOrder keyed by the PARENT id, so the existing cross-device
    // ordering payload needs no new field.
    function getChildTasks(columnId, parentId) {
      const pid = parentId || '';
      return sortTaskItemsForColumn(pid || columnId, (globalTaskItems || []).filter(item =>
        item.column_id === columnId && getTaskParentId(item) === pid));
    }

    function getRootTasks(columnId) {
      // A row whose parent vanished (deleted, or moved to another column) is promoted back
      // to a root instead of disappearing from the board.
      return sortTaskItemsForColumn(columnId, (globalTaskItems || []).filter(item => {
        if (item.column_id !== columnId) return false;
        const pid = getTaskParentId(item);
        return !pid || !getTaskById(pid);
      }));
    }

    // Depth-first descendants, parent before child, cycle-safe.
    function getTaskDescendants(taskId, guard) {
      const seen = guard || new Set();
      if (!taskId) return [];
      if (!guard) seen.add(taskId); // the starting task is never its own descendant
      const out = [];
      (globalTaskItems || []).forEach((item) => {
        if (getTaskParentId(item) !== taskId) return;
        if (seen.has(item.id)) return;
        seen.add(item.id);
        out.push(item);
        getTaskDescendants(item.id, seen).forEach(child => out.push(child));
      });
      return out;
    }

    function persistChildCollapse() {
      try {
        localStorage.setItem(SUBTASK_COLLAPSED_KEY, JSON.stringify(collapsedTaskChildren));
      } catch (e) {}
      // Also rides in the reserved daily_notes row so a phone agrees with the laptop.
      persistTaskColumnOrder(taskColOrder);
    }

    function toggleTaskChildrenCollapse(taskId) {
      collapsedTaskChildren[taskId] = !collapsedTaskChildren[taskId];
      persistChildCollapse();
      renderTasksBoard();
    }

    // Keeps what is already typed when a re-render happens while a composer is open
    // (toggling another task, a realtime refresh, …).
    function captureSubtaskDraft() {
      if (!addingSubtaskParentId) return;
      const titleEl = document.getElementById('subtask-input-' + addingSubtaskParentId);
      if (!titleEl) return;
      const dueEl = document.getElementById('subtask-due-' + addingSubtaskParentId);
      const eventEl = document.getElementById('subtask-event-' + addingSubtaskParentId);
      subtaskDraft = {
        parentId: addingSubtaskParentId,
        title: titleEl.value || '',
        due: dueEl ? dueEl.value : '',
        eventId: eventEl ? eventEl.value : ''
      };
    }

    function startAddSubtask(parentTaskId) {
      if (!currentUser) return showToast('READ-ONLY MODE', 'Sign in as autumn to add subtasks.', true);
      if (addingSubtaskParentId === parentTaskId) return cancelAddSubtask();
      captureSubtaskDraft();
      addingSubtaskParentId = parentTaskId;
      editingTaskId = null;
      editingColumnId = null;
      collapsedTaskChildren[parentTaskId] = false; // a new child must be visible
      persistChildCollapse();
      renderTasksBoard();
      setTimeout(() => {
        const input = document.getElementById('subtask-input-' + parentTaskId);
        if (input) { try { input.focus(); } catch (e) {} }
      }, 40);
    }

    function cancelAddSubtask() {
      addingSubtaskParentId = null;
      subtaskDraft = { parentId: '', title: '', due: '', eventId: '' };
      renderTasksBoard();
    }

    // Inline composer: the same field set as the column footer's add-task form.
    function renderSubtaskComposerHtml(parentTask, colId) {
      const id = parentTask.id;
      const draft = (subtaskDraft && subtaskDraft.parentId === id) ? subtaskDraft : { title: '', due: '', eventId: '' };
      return `
        <form onsubmit="handleAddSubtaskItem(event, '${id}', '${colId}')" class="subtask-composer">
          <div class="flex items-center gap-1.5">
            <input
              type="text"
              id="subtask-input-${id}"
              name="subtaskTitle"
              value="${escapeHtml(draft.title || '')}"
              aria-label="New subtask title"
              placeholder="+ Add subtask under this task..."
              class="tech-input !py-1.5 !text-xs flex-1 min-w-0"
              required
            />
            <button type="submit" class="btn-tech-outline !py-1.5 !px-3 text-xs shrink-0">Add</button>
            <button type="button" onclick="cancelAddSubtask()" class="btn-tech-outline !py-1.5 !px-2 text-xs shrink-0" title="Cancel subtask" aria-label="Cancel subtask">×</button>
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <input type="date" id="subtask-due-${id}" name="subtaskDue" value="${escapeHtml(draft.due || '')}" aria-label="Optional subtask deadline" title="Optional Deadline Date" class="tech-input !py-1 !px-1.5 !text-[10px] !bg-white" />
            <select id="subtask-event-${id}" name="subtaskEvent" aria-label="Optional linked calendar event" title="Optional Linked Calendar Event" class="tech-input !py-1 !px-1.5 !text-[10px] !bg-white">
              ${buildCalendarEventsOptionsHtml(draft.eventId || '')}
            </select>
          </div>
        </form>
      `;
    }

    // Renders ONE task row, then (recursively) its composer and its child thread.
    // `ancestry` is a guard list so a corrupt parent chain can never loop the renderer.
    function renderTaskRowHtml(task, colId, depth, siblingIdx, siblingCount, ancestry) {
      if (window.tasksPower && !window.tasksPower.matchesTaskFilter(task)) return '';
      const path = Array.isArray(ancestry) ? ancestry : [];
      if (path.indexOf(task.id) !== -1) return ''; // cyclic data: stop instead of spinning
      const nextPath = path.concat(task.id);
      const isOwner = Boolean(currentUser);
      const isEditingThisTask = isOwner && editingTaskId === task.id;
      const meta = getTaskMeta(task.id);
      const dueInfo = !task.is_done && meta.dueDate ? evaluateTaskDeadline(meta.dueDate) : null;
      const linkedEv = meta.eventId ? globalCalendarEvents.find(ev => ev.id === meta.eventId) : null;
      const indent = Math.min(depth, 3) * 10; // visible cap; the data model stays unlimited

      if (isEditingThisTask) {
        return `
          <form onsubmit="saveEditedTaskItem(event, '${task.id}')" class="p-2.5 border-b border-[#c5ded0] bg-[#eff8f2] flex flex-col gap-2"${indent ? ` style="margin-left:${indent}px"` : ''}>
            <input type="text" id="edit-task-input-${task.id}" value="${escapeHtml(task.title)}" class="tech-input !py-1.5 !px-2 !text-xs w-full" required />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <div>
                <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-task-due-${task.id}">Deadline (Optional)</label>
                <input type="date" id="edit-task-due-${task.id}" value="${escapeHtml(meta.dueDate || '')}" class="tech-input !py-1 !px-2 !text-[11px] !bg-white" />
              </div>
              <div>
                <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-task-event-${task.id}">Link Calendar Event (Opt)</label>
                <select id="edit-task-event-${task.id}" class="tech-input !py-1 !px-2 !text-[11px] !bg-white">
                  ${buildCalendarEventsOptionsHtml(meta.eventId || '')}
                </select>
              </div>
            </div>
            <div class="flex items-center justify-end gap-1.5">
              <button type="button" onclick="cancelEditTaskItem()" class="btn-tech-outline !py-1 !px-2.5 text-[11px]">Cancel</button>
              <button type="submit" class="btn-chamfer !py-1 !px-3 !text-xs">Save</button>
            </div>
          </form>
        `;
      }

      const taskState = getTaskProgressState(task.id);
      const isInProgress = !task.is_done && taskState === 'IN-PROGRESS';
      const children = getChildTasks(colId, task.id);
      const descendants = getTaskDescendants(task.id);
      const doneDescendants = descendants.filter(d => d.is_done).length;
      const childThreadCollapsed = Boolean(collapsedTaskChildren[task.id]);
      const isAddingHere = addingSubtaskParentId === task.id;
      const rowUrgentBg = dueInfo && dueInfo.diffDays <= 1
        ? 'bg-[#fee2e2]/45 border-l-2 border-l-[#dc2626]'
        : dueInfo && dueInfo.diffDays <= 3
          ? 'bg-[#fef3c7]/50 border-l-2 border-l-[#f59e0b]'
          : isInProgress
            ? 'bg-[#fef3c7]/45 border-l-2 border-l-[#f59e0b]'
            : 'hover:bg-[#f4faf6]';

      const rowHtml = `
        <div class="subtask-row flex items-start justify-between gap-2 p-2.5 border-b border-[#e8f3ec] ${rowUrgentBg} group"${indent ? ` style="margin-left:${indent}px"` : ''}>
          <div class="flex items-start gap-2.5 flex-1 min-w-0 py-0.5">
            ${children.length > 0 ? `
              <button
                type="button"
                onclick="toggleTaskChildrenCollapse('${task.id}')"
                class="subtask-toggle ${childThreadCollapsed ? '' : 'open'}"
                aria-expanded="${childThreadCollapsed ? 'false' : 'true'}"
                title="${childThreadCollapsed ? 'Show' : 'Hide'} ${descendants.length} nested subtask(s)"
                aria-label="${childThreadCollapsed ? 'Expand' : 'Collapse'} subtasks of ${escapeJsAttrSafe(task.title)}"
              >${childThreadCollapsed ? '▸' : '▾'}</button>
            ` : ''}
            <input type="checkbox"
              ${task.is_done ? 'checked' : ''}
              ${!isOwner ? 'disabled' : ''}
              onchange="toggleTaskItem('${task.id}', this.checked)"
              class="tech-checkbox mt-0.5 shrink-0"
              aria-label="Toggle task: ${escapeJsAttrSafe(task.title)}"
            />
            <div class="min-w-0 flex-1">
              <div class="font-mono-tech text-xs break-words leading-snug ${task.is_done ? 'line-through text-[#56735f]' : 'text-[#0c1f17] font-medium'}">
                ${escapeHtml(task.title)}
                ${descendants.length > 0 ? `<span class="subtask-rollup ${doneDescendants === descendants.length ? 'all-done' : ''}" title="${doneDescendants} of ${descendants.length} nested subtask(s) done">↳ ${doneDescendants}/${descendants.length}</span>` : ''}
              </div>
              <div class="flex flex-wrap items-center gap-1 mt-1">
                <label class="inline-flex items-center gap-1 text-[9px] font-bold text-[#436152] bg-[#e8f3ec] border border-[#c5ded0] px-1 py-0 cursor-pointer" title="Select task for Batch Matrix operations" onclick="event.stopPropagation();"><input type="checkbox" ${window.tasksPower && window.tasksPower.isTaskSelected(task.id) ? 'checked' : ''} onchange="window.tasksPower && window.tasksPower.toggleTaskBatchSelect('${task.id}', this.checked)" class="!w-2.5 !h-2.5" /><span>SEL</span></label>
                <span class="tech-badge badge-neutral !text-[9px] !py-0 !px-1.5" title="Position in the subtask tree">${depth === 0 ? 'TASK' : 'SUBTASK · L' + depth}</span>
                ${window.tasksPower ? window.tasksPower.renderTaskChecklistBadgeHtml(task.id) : ''}
                ${!task.is_done ? `
                  <button
                    type="button"
                    onclick="toggleTaskProgressState('${task.id}', event)"
                    class="task-status-pill ${isInProgress ? 'in-progress' : ''}"
                    title="Click to toggle between QUEUED and IN-PROGRESS"
                  >
                    <span class="w-1.5 h-1.5 rounded-full ${isInProgress ? 'bg-[#d97706] pulse-live' : 'bg-[#718f80]'}"></span>
                    <span>${isInProgress ? 'IN-PROGRESS' : 'QUEUED'}</span>
                  </button>
                ` : ''}
                ${dueInfo ? `
                  <span class="tech-badge ${dueInfo.badgeClass} !text-[9px] !py-0 !px-1.5">${escapeHtml(dueInfo.label)}</span>
                ` : (meta.dueDate && task.is_done ? `<span class="tech-badge badge-neutral !text-[9px] !py-0 !px-1.5">DUE ${escapeHtml(meta.dueDate.slice(5))}</span>` : '')}
                ${linkedEv ? `
                  <button
                    type="button"
                    data-linked-event-badge="${escapeHtml(meta.eventId)}"
                    onclick="openEventDetails('${jsAttrQuote(linkedEv.id)}')"
                    class="tech-badge badge-blue !text-[9px] !py-0 !px-1.5 cursor-pointer max-w-[180px] truncate"
                    title="Inspect linked Calendar Event: ${escapeJsAttrSafe(linkedEv.title)}"
                  > ${escapeHtml(linkedEv.title)}</button>
                ` : (meta.eventId ? `
                  <span
                    data-linked-event-badge="${escapeHtml(meta.eventId)}"
                    class="tech-badge badge-neutral !text-[9px] !py-0 !px-1.5 max-w-[180px] truncate"
                    title="${globalCalendarEvents.length === 0
                      ? 'The linked event is still loading — this badge resolves itself.'
                      : 'The linked event is outside the ±2 month sync window. Open 03 // CALENDAR and pin that month.'}"
                  > ${globalCalendarEvents.length === 0 ? 'LINKED (LOADING…)' : 'EVENT OUT OF WINDOW'}</span>
                ` : '')}
              </div>
              ${window.tasksPower ? window.tasksPower.renderTaskChecklistDrawerHtml(task.id) : ''}
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onclick="moveTaskItem('${colId}', '${task.id}', -1)"
              ${siblingIdx <= 0 ? 'disabled' : ''}
              class="touch-action-btn !min-w-[24px] !min-h-[26px] !px-1 disabled:opacity-30"
              title="Move up among its siblings"
            >▲</button>
            <button
              type="button"
              onclick="moveTaskItem('${colId}', '${task.id}', 1)"
              ${siblingIdx >= siblingCount - 1 ? 'disabled' : ''}
              class="touch-action-btn !min-w-[24px] !min-h-[26px] !px-1 disabled:opacity-30"
              title="Move down among its siblings"
            >▼</button>
            ${isOwner ? `
              <button type="button" onclick="startAddSubtask('${task.id}')" class="touch-action-btn !min-w-[26px] !min-h-[26px]" title="Add a subtask under this task" aria-label="Add subtask under ${escapeJsAttrSafe(task.title)}">＋</button>
              <button type="button" onclick="startEditTaskItem('${task.id}')" class="touch-action-btn !min-w-[26px] !min-h-[26px]" title="Edit title, deadline or event link">Edit</button>
              <button type="button" onclick="deleteTaskItem('${task.id}')" class="touch-action-btn danger !min-w-[26px] !min-h-[26px]" title="Delete ${depth === 0 ? 'task' : 'subtask'}${descendants.length > 0 ? ' and its ' + descendants.length + ' nested subtask(s)' : ''}">×</button>
            ` : ''}
          </div>
        </div>
      `;

      const composerHtml = isAddingHere ? renderSubtaskComposerHtml(task, colId) : '';

      // Unlimited depth, capped indent: past level 3 rows stop shifting right so a card never
      // runs out of width, while the SUBTASK · L<n> badge still reports the true level.
      const childHtml = (children.length > 0 && !childThreadCollapsed)
        ? `<div class="subtask-thread">${children.map((child, i) =>
            renderTaskRowHtml(child, colId, depth + 1, i, children.length, nextPath)).join('')}</div>`
        : '';

      return rowHtml + composerHtml + childHtml;
    }

    // Escapes a value used BOTH as visible text and inside a double-quoted attribute.
    function escapeJsAttrSafe(value) {
      return escapeHtml(String(value === null || value === undefined ? '' : value));
    }

    function renderTasksBoard() {
      const container = document.getElementById('tasks-columns-container');
      if (!container) return;
      container.innerHTML = '';

      globalTaskColumns = sortTaskColumnsBySavedOrder(globalTaskColumns);

      const isOwner = Boolean(currentUser);
      const totalCols = globalTaskColumns.length;
      const doneCols = globalTaskColumns.filter(c => c.is_done).length;
      const totalItems = globalTaskItems.length;
      const doneItems = globalTaskItems.filter(i => i.is_done).length;

      document.getElementById('tasks-col-count').textContent = totalCols;
      document.getElementById('tasks-col-done-count').textContent = doneCols;
      document.getElementById('tasks-item-done-count').textContent = `${doneItems} / ${totalItems}`;
      const subtaskSummary = document.getElementById('tasks-subtask-count');
      if (subtaskSummary) subtaskSummary.textContent = globalTaskItems.filter(i => getTaskParentId(i)).length;

      if (window.tasksPower && typeof window.tasksPower.renderBatchMatrixBar === 'function') {
        window.tasksPower.renderBatchMatrixBar();
      }
      updateNavbarTaskDeadlinesTelemetry();
      if (typeof renderCalendarViewport === 'function') renderCalendarViewport();
      if (typeof renderFocusMode === 'function') renderFocusMode();

      if (totalCols === 0) {
        container.innerHTML = `
          <div class="w-full border border-dashed border-[#87b39b] p-8 sm:p-10 text-center tech-grid-bg flex flex-col items-center justify-center">
            <div class="font-mono-tech text-xs uppercase text-[#436152]">NO SUBJECT / COMPETITION COLUMNS CREATED YET</div>
            <p class="font-mono-tech text-xs text-[#56735f] mt-1 max-w-md">
              Use the top bar to add a Subject, Competition, or Other column. Each column holds its own checklist of tasks and can be rearranged, collapsed, or edited anytime.
            </p>
          </div>
        `;
        return;
      }

      const numLanes = window.innerWidth >= 1650 ? 4 : window.innerWidth >= 1180 ? 3 : window.innerWidth >= 768 ? 2 : 1;
      const laneEls = [];
      const laneHeights = [];
      for (let l = 0; l < numLanes; l++) {
        const lane = document.createElement('div');
        lane.className = 'tasks-masonry-lane';
        laneEls.push(lane);
        laneHeights.push(0);
        container.appendChild(lane);
      }

      globalTaskColumns.forEach((col, idx) => {
        const colTasks = sortTaskItemsForColumn(
          col.id,
          globalTaskItems.filter(item => item.column_id === col.id)
        );
        const rootTasks = getRootTasks(col.id);
        const completedCount = colTasks.filter(t => t.is_done).length;
        const subtaskCount = colTasks.filter(t => getTaskParentId(t)).length;
        const isEditingThisCol = isOwner && editingColumnId === col.id;
        const isCollapsed = Boolean(collapsedTaskCols[col.id]);

        let badgeClass = 'badge-green';
        if (col.category === 'COMPETITION') badgeClass = 'badge-blue';
        if (col.category === 'OTHER') badgeClass = 'badge-amber';

        const colEl = document.createElement('div');
        colEl.className = `task-col-card w-full border border-[#c5ded0] bg-white flex flex-col justify-between ${col.is_done ? 'opacity-65 bg-[#eff8f2]' : ''}`;

        if (!isEditingThisCol && !editingTaskId && !addingSubtaskParentId) {
          colEl.setAttribute('draggable', 'true');
          colEl.addEventListener('dragstart', (e) => handleTaskColDragStart(e, col.id));
          colEl.addEventListener('dragover', handleTaskColDragOver);
          colEl.addEventListener('dragleave', handleTaskColDragLeave);
          colEl.addEventListener('dragend', handleTaskColDragEnd);
          colEl.addEventListener('drop', (e) => handleTaskColDrop(e, col.id));
        }

        const tasksHtml = colTasks.length === 0
          ? `<div class="font-mono-tech text-xs text-[#56735f] py-6 text-center">No tasks in this column yet.</div>`
          : rootTasks.map((task, tIdx) => renderTaskRowHtml(task, col.id, 0, tIdx, rootTasks.length, [])).join('');

        const colHeaderHtml = isEditingThisCol
          ? `
            <form onsubmit="saveEditedTaskColumn(event, '${col.id}')" class="flex flex-col gap-2 mb-2 p-2.5 bg-white border border-[#86efac]">
              <div class="flex items-center justify-between gap-1">
                <select id="edit-col-cat-${col.id}" class="tech-input !py-1.5 !px-2 !text-xs">
                  <option value="SUBJECT" ${col.category === 'SUBJECT' ? 'selected' : ''}>SUBJECT</option>
                  <option value="COMPETITION" ${col.category === 'COMPETITION' ? 'selected' : ''}>COMPETITION</option>
                  <option value="OTHER" ${col.category === 'OTHER' ? 'selected' : ''}>OTHER</option>
                </select>
              </div>
              <input type="text" id="edit-col-title-${col.id}" value="${escapeHtml(col.title)}" class="tech-input !py-1.5 !px-2 !text-xs" required />
              <div class="flex items-center justify-end gap-1.5">
                <button type="button" onclick="cancelEditTaskColumn()" class="btn-tech-outline !py-1 !px-2.5 text-[11px]">Cancel</button>
                <button type="submit" class="btn-chamfer !py-1 !px-3 !text-xs">Save</button>
              </div>
            </form>
          `
          : `
            <div class="flex items-center justify-between gap-1.5 mb-2 flex-wrap">
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  onclick="toggleTaskColumnCollapse('${col.id}')"
                  class="touch-action-btn !min-w-[26px] !min-h-[26px] !px-1.5 font-bold text-[#047857]"
                  title="${isCollapsed ? 'Expand column' : 'Collapse column'}"
                >
                  ${isCollapsed ? '▸' : '▾'}
                </button>
                <span class="tech-badge ${badgeClass}">${escapeHtml(col.category)}</span>
              </div>

              <div class="flex items-center gap-1 ml-auto">
                <span class="font-mono-tech text-[11px] text-[#436152]">${completedCount}/${colTasks.length}</span>
                ${subtaskCount > 0 ? `<span class="tech-badge badge-neutral !text-[9px]" title="${subtaskCount} of these rows are nested subtasks">${subtaskCount} SUB</span>` : ''}
                <span class="font-mono-tech text-[10px] text-[#56735f] mr-0.5">/C${String(idx + 1).padStart(2, '0')}</span>
                <button
                  type="button"
                  onclick="moveTaskColumn('${col.id}', -1)"
                  ${idx === 0 ? 'disabled' : ''}
                  class="touch-action-btn !min-w-[24px] !min-h-[26px] !px-1 disabled:opacity-30"
                  title="Move column earlier / left"
                >&lsaquo;</button>
                <button
                  type="button"
                  onclick="moveTaskColumn('${col.id}', 1)"
                  ${idx === totalCols - 1 ? 'disabled' : ''}
                  class="touch-action-btn !min-w-[24px] !min-h-[26px] !px-1 disabled:opacity-30"
                  title="Move column later / right"
                >&rsaquo;</button>
                ${isOwner ? `
                  <button type="button" onclick="startEditTaskColumn('${col.id}')" class="touch-action-btn !min-w-[26px] !min-h-[26px]" title="Edit column name or category">Edit</button>
                  <button type="button" onclick="deleteTaskColumn('${col.id}', '${jsAttrQuote(col.title)}')" class="touch-action-btn danger !min-w-[26px] !min-h-[26px]" title="Delete entire column">${(window.autumnIcons && window.autumnIcons.svg('trash')) || '×'}</button>
                ` : ''}
              </div>
            </div>

            <div
              onclick="toggleTaskColumnCollapse('${col.id}')"
              class="flex items-center justify-between gap-2 cursor-pointer select-none"
              title="Click to ${isCollapsed ? 'expand' : 'collapse'} column"
            >
              <h3 class="font-bold text-base text-[#0c1f17] break-words ${col.is_done ? 'line-through text-[#436152]' : ''}">${escapeHtml(col.title)}</h3>
              <div class="flex items-center gap-1.5 shrink-0">
                ${isCollapsed ? `<span class="tech-badge badge-neutral !text-[9px]">${colTasks.length} TASKS HIDDEN</span>` : ''}
                ${col.is_done ? `<span class="tech-badge badge-green">DONE</span>` : ''}
              </div>
            </div>
          `;

        colEl.innerHTML = `
          <div>
            <!-- Column Top Header -->
            <div class="p-3 sm:p-3.5 ${isCollapsed ? '' : 'border-b border-[#c5ded0]'} bg-[#eff8f2]">
              ${colHeaderHtml}

              ${!isCollapsed ? `
                <!-- Mark Entire Column Done Toggle -->
                <label class="flex items-center gap-2 mt-2.5 pt-2 border-t border-[#c5ded0] font-mono-tech text-[11px] text-[#436152] cursor-pointer select-none">
                  <input type="checkbox"
                    ${col.is_done ? 'checked' : ''}
                    ${!isOwner ? 'disabled' : ''}
                    onchange="toggleTaskColumnDone('${col.id}', this.checked)"
                    class="tech-checkbox shrink-0"
                  />
                  <span>Mark entire ${escapeHtml(col.category.toLowerCase())} done</span>
                </label>
              ` : ''}
            </div>

            <!-- Column Tasks List -->
            ${!isCollapsed ? `
              <div class="p-2">
                ${tasksHtml}
              </div>
            ` : ''}
          </div>

          <!-- Add Task Input Footer with Optional Deadline & Calendar Event Link -->
          ${!isCollapsed ? `
            <form onsubmit="handleAddTaskItem(event, '${col.id}')" class="p-2.5 border-t border-[#c5ded0] bg-[#f4faf6] flex flex-col gap-1.5">
              <div class="flex items-center gap-1.5">
                <input type="text" name="taskTitle" aria-label="New task title" placeholder="${isOwner ? '+ Add task to column...' : ' Sign in to add tasks'}"
                  class="tech-input !py-1.5 !text-xs flex-1 min-w-0"
                  ${!isOwner ? 'disabled' : ''}
                  required
                />
                <button type="submit" class="btn-tech-outline !py-1.5 !px-3 text-xs shrink-0" ${!isOwner ? 'disabled' : ''}>Add</button>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <input type="date" name="taskDue" aria-label="Optional deadline" title="Optional Deadline Date" class="tech-input !py-1 !px-1.5 !text-[10px] !bg-white" ${!isOwner ? 'disabled' : ''} />
                <select name="taskEvent" aria-label="Optional linked calendar event" title="Optional Linked Calendar Event" class="tech-input !py-1 !px-1.5 !text-[10px] !bg-white" ${!isOwner ? 'disabled' : ''}>
                  ${buildCalendarEventsOptionsHtml('')}
                </select>
              </div>
            </form>
          ` : ''}
        `;

        let targetLaneIdx = 0;
        for (let l = 1; l < numLanes; l++) {
          if (laneHeights[l] < laneHeights[targetLaneIdx]) {
            targetLaneIdx = l;
          }
        }
        laneEls[targetLaneIdx].appendChild(colEl);
        // Nested rows are shorter than roots and an open composer adds real height — the
        // estimate now accounts for both so columns land in the lane they visually belong to.
        const openComposers = globalTaskItems.filter(t => t.id === addingSubtaskParentId).length;
        const estimatedWeight = isCollapsed
          ? 70
          : (165 + rootTasks.length * 46 + Math.max(0, colTasks.length - rootTasks.length) * 30 + openComposers * 118);
        laneHeights[targetLaneIdx] += estimatedWeight;
      });
    }

    function startEditTaskColumn(colId) {
      if (!currentUser) return;
      editingColumnId = colId;
      editingTaskId = null;
      renderTasksBoard();
    }

    function cancelEditTaskColumn() {
      editingColumnId = null;
      renderTasksBoard();
    }

    async function saveEditedTaskColumn(e, colId) {
      e.preventDefault();
      if (!currentUser) return;
      const newCategory = document.getElementById(`edit-col-cat-${colId}`).value;
      const newTitle = document.getElementById(`edit-col-title-${colId}`).value.trim();
      if (!newTitle) return;

      const { error } = await supabaseClient
        .from('task_columns')
        .update({ title: newTitle, category: newCategory })
        .eq('id', colId);

      editingColumnId = null;
      if (error) {
        showToast('UPDATE ERROR', error.message, true);
      } else {
        showToast('COLUMN UPDATED', `Updated ${newCategory}: ${newTitle}`);
        fetchAndRenderTasks();
      }
    }

    function startEditTaskItem(taskId) {
      if (!currentUser) return;
      editingTaskId = taskId;
      editingColumnId = null;
      renderTasksBoard();
    }

    function cancelEditTaskItem() {
      editingTaskId = null;
      renderTasksBoard();
    }

    async function saveEditedTaskItem(e, taskId) {
      e.preventDefault();
      if (!currentUser) return;
      const newTitle = document.getElementById(`edit-task-input-${taskId}`).value.trim();
      const newDue = document.getElementById(`edit-task-due-${taskId}`)?.value || '';
      const newEventId = document.getElementById(`edit-task-event-${taskId}`)?.value || '';
      if (!newTitle) return;

      taskMetaMap[taskId] = { dueDate: newDue, eventId: newEventId };
      await persistTaskColumnOrder(taskColOrder);

      // B6: write the link into task_items when the columns exist; otherwise retry with the
      // title only, so saving a task never fails on a database without the migration.
      const fullUpdate = await supabaseClient
        .from('task_items')
        .update({ title: newTitle, due_date: newDue || null, event_id: newEventId || null })
        .eq('id', taskId);
      let error = fullUpdate.error;
      if (error && isMissingColumnError(error)) {
        taskMetaColumnsAvailable = false;
        const retry = await supabaseClient.from('task_items').update({ title: newTitle }).eq('id', taskId);
        error = retry.error;
      } else if (!error) {
        taskMetaColumnsAvailable = true;
      }

      editingTaskId = null;
      if (error) {
        showToast('UPDATE ERROR', error.message, true);
      } else {
        showToast('TASK UPDATED', 'Saved task, deadline & event link.');
        fetchAndRenderTasks();
      }
    }

    onReady('add-column-form', 'submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return;

      const category = document.getElementById('col-type-input').value;
      const title = document.getElementById('col-title-input').value.trim();
      if (!title) return;

      const { data, error } = await supabaseClient
        .from('task_columns')
        .insert({ title, category, is_done: false })
        .select()
        .single();

      if (error) {
        showToast('COLUMN ERROR', error.message, true);
      } else {
        if (data && data.id) {
          const updatedOrder = [...globalTaskColumns.map(c => c.id), data.id];
          persistTaskColumnOrder(updatedOrder);
        }
        document.getElementById('col-title-input').value = '';
        showToast('COLUMN CREATED', `Added ${category}: ${title}`);
        fetchAndRenderTasks();
      }
    });

    async function handleAddTaskItem(e, columnId) {
      e.preventDefault();
      if (!currentUser) return;
      const titleInput = e.target.querySelector('input[name="taskTitle"]') || e.target.querySelector('input');
      const dueInput = e.target.querySelector('input[name="taskDue"]');
      const eventSelect = e.target.querySelector('select[name="taskEvent"]');

      const title = titleInput ? titleInput.value.trim() : '';
      const dueDate = dueInput ? dueInput.value : '';
      const eventId = eventSelect ? eventSelect.value : '';
      if (!title) return;

      const { data, error } = await supabaseClient
        .from('task_items')
        .insert({ column_id: columnId, title, is_done: false })
        .select()
        .single();

      if (error) {
        showToast('TASK ERROR', error.message, true);
      } else {
        if (data && data.id && (dueDate || eventId)) {
          taskMetaMap[data.id] = { dueDate, eventId };
          await persistTaskColumnOrder(taskColOrder);
          // B6: mirror into task_items so the link follows you to other devices.
          await mirrorTaskMeta(data.id);
        }
        if (titleInput) titleInput.value = '';
        if (dueInput) dueInput.value = '';
        if (eventSelect) eventSelect.value = '';
        fetchAndRenderTasks();
      }
    }

    // Adds a nested task under `parentTaskId`. Mirrors handleAddTaskItem, but carries the
    // parent through and degrades to a flat task when the migration has not been applied.
    async function handleAddSubtaskItem(e, parentTaskId, columnId) {
      e.preventDefault();
      if (!currentUser) return showToast('READ-ONLY MODE', 'Sign in as autumn to add subtasks.', true);
      const form = e.target;
      const titleInput = form.querySelector('input[name="subtaskTitle"]');
      const dueInput = form.querySelector('input[name="subtaskDue"]');
      const eventSelect = form.querySelector('select[name="subtaskEvent"]');

      const title = titleInput ? titleInput.value.trim() : '';
      const dueDate = dueInput ? dueInput.value : '';
      const eventId = eventSelect ? eventSelect.value : '';
      if (!title) return;

      let res = await supabaseClient
        .from('task_items')
        .insert({ column_id: columnId, parent_task_id: parentTaskId || null, title, is_done: false })
        .select()
        .single();

      let nested = true;
      if (res.error && isMissingColumnError(res.error)) {
        taskParentColumnsAvailable = false;
        nested = false;
        res = await supabaseClient
          .from('task_items')
          .insert({ column_id: columnId, title, is_done: false })
          .select()
          .single();
      }
      if (res.error) return showToast('SUBTASK ERROR', res.error.message, true);
      if (nested) taskParentColumnsAvailable = true;

      const data = res.data;
      if (data && data.id && (dueDate || eventId)) {
        taskMetaMap[data.id] = { dueDate, eventId };
        await persistTaskColumnOrder(taskColOrder);
        await mirrorTaskMeta(data.id);
      }

      const parentTask = getTaskById(parentTaskId);
      addingSubtaskParentId = null;
      subtaskDraft = { parentId: '', title: '', due: '', eventId: '' };
      showToast(
        nested ? 'SUBTASK ADDED' : 'ADDED WITHOUT NESTING',
        nested
          ? 'Added ' + title + ' under ' + (parentTask ? parentTask.title : 'the task') + '.'
          : 'The parent_task_id column is missing, so ' + title + ' was added as a top-level task. Run the task_items migration to nest it.',
        !nested
      );
      fetchAndRenderTasks();
    }
    async function toggleTaskItem(taskId, isDone) {
      if (!currentUser) return;
      const { error } = await supabaseClient
        .from('task_items')
        .update({ is_done: isDone })
        .eq('id', taskId);

      if (error) showToast('UPDATE ERROR', error.message, true);
      else fetchAndRenderTasks();
    }

    async function toggleTaskColumnDone(columnId, isDone) {
      if (!currentUser) return;
      const { error } = await supabaseClient
        .from('task_columns')
        .update({ is_done: isDone })
        .eq('id', columnId);

      if (error) showToast('UPDATE ERROR', error.message, true);
      else fetchAndRenderTasks();
    }

    async function deleteTaskItem(taskId) {
      if (!currentUser) return;
      const removed = (globalTaskItems || []).find(t => t.id === taskId) || null;
      const descendants = getTaskDescendants(taskId); // parent before child order

      // Deepest-first: a row must never be deleted while its children still point at it,
      // even on a database whose parent_task_id foreign key has no ON DELETE CASCADE.
      for (let i = descendants.length - 1; i >= 0; i -= 1) {
        const { error: childError } = await supabaseClient
          .from('task_items')
          .delete()
          .eq('id', descendants[i].id);
        if (childError) console.warn('[autumn] nested task delete note:', childError.message);
      }

      const { error } = await supabaseClient
        .from('task_items')
        .delete()
        .eq('id', taskId);

      if (error) return showToast('DELETE ERROR', error.message, true);
      fetchAndRenderTasks();

      const removedRows = (removed ? [removed] : []).concat(descendants);
      if (removedRows.length > 0) {
        // TOOLS-HUB (T1.4): keep a 30-day local snapshot so every row stays restorable.
        if (typeof autumnTrashPush === 'function') {
          removedRows.forEach(row => autumnTrashPush('task_items', row));
        }
        const nestedLabel = descendants.length > 0
          ? ' and ' + descendants.length + ' nested subtask' + (descendants.length === 1 ? '' : 's')
          : '';
        showToast('TASK DELETED',
          'Removed ' + (removed ? removed.title : 'task') + nestedLabel + '.',
          false,
          () => restoreDeletedTaskTree(removedRows));
      } else {
        showToast('TASK DELETED', 'Removed task.');
      }
    }

    // Undo path: parent first, then descendants in tree order, so the self-referencing
    // foreign key is always satisfied when the rows come back.
    async function restoreDeletedTaskTree(rows) {
      if (!currentUser || !rows || rows.length === 0) return;
      let restored = 0;
      for (const row of rows) {
        const { error } = await supabaseClient.from('task_items').insert(row);
        if (error) {
          showToast('UNDO FAILED', error.message, true);
          break;
        }
        restored += 1;
      }
      if (restored > 0) showToast('UNDONE', restored + ' task row(s) restored.');
      fetchAndRenderTasks();
    }

    function deleteTaskColumn(columnId, title) {
      if (!currentUser) return;
      const columnItems = (globalTaskItems || []).filter(t => t.column_id === columnId);
      // Depth-first, deepest-first ordering so a row is never removed before its children.
      const deleteOrder = [];
      getRootTasks(columnId).forEach(root => {
        const nested = getTaskDescendants(root.id);
        for (let i = nested.length - 1; i >= 0; i -= 1) deleteOrder.push(nested[i]);
        deleteOrder.push(root);
      });
      columnItems.forEach(row => { if (deleteOrder.indexOf(row) === -1) deleteOrder.push(row); });

      confirmAction(
        'Delete column: ' + title + '?',
        'This deletes the column, its ' + columnItems.length + ' task row(s) and every nested subtask.',
        async () => {
          // The rows are removed explicitly instead of relying on the foreign key, so
          // TASKS DONE, exports, search and the deadline radar can never count orphans.
          for (const row of deleteOrder) {
            const { error: rowError } = await supabaseClient
              .from('task_items')
              .delete()
              .eq('id', row.id);
            if (rowError) {
              console.warn('[autumn] column row delete note:', rowError.message);
              break;
            }
          }

          const { error } = await supabaseClient
            .from('task_columns')
            .delete()
            .eq('id', columnId);

          if (error) return showToast('DELETE ERROR', error.message, true);
          delete collapsedTaskCols[columnId];
          delete collapsedTaskChildren[columnId];
          columnItems.forEach(row => {
            if (typeof autumnTrashPush === 'function') autumnTrashPush('task_items', row);
          });
          showToast('COLUMN DELETED', 'Removed ' + title + ' and ' + columnItems.length + ' task row(s).');
          fetchAndRenderTasks();
        }
      );
    }

    // ==========================================
    // 9A-2. RECURRING TASKS & HABITS LEDGER LOGIC
    // ==========================================
    let globalHabits = [];
    let editingHabitId = null;

    const HABIT_FREQ_META = {
      DAILY: { label: 'DAILY', badge: 'badge-green', cycleDesc: 'Resets daily at 00:00' },
      WEEKDAYS: { label: 'WEEKDAYS (M-F)', badge: 'badge-blue', cycleDesc: 'Resets each weekday' },
      WEEKENDS: { label: 'WEEKENDS (S-S)', badge: 'badge-amber', cycleDesc: 'Resets each weekend day' },
      WEEKLY: { label: 'WEEKLY', badge: 'badge-blue', cycleDesc: 'Resets every Monday' },
      BIWEEKLY: { label: 'BIWEEKLY', badge: 'badge-amber', cycleDesc: 'Resets every 2 weeks' },
      MONTHLY: { label: 'MONTHLY', badge: 'badge-green', cycleDesc: 'Resets 1st of month' }
    };

    // Computes the unique period key for the current cycle so habits automatically uncheck when a new period starts
    function getHabitCurrentPeriodKey(frequency, refDate = new Date()) {
      const d = new Date(refDate);
      d.setHours(0, 0, 0, 0);
      const freq = (frequency || 'DAILY').toUpperCase();

      if (freq === 'DAILY' || freq === 'WEEKDAYS' || freq === 'WEEKENDS') {
        return `DAY:${getLocalDateString(d)}`;
      }
      if (freq === 'WEEKLY') {
        // Compute Monday of the current week
        const dayOfWeek = d.getDay(); // 0 (Sun) .. 6 (Sat)
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diffToMonday);
        return `WEEK:${getLocalDateString(monday)}`;
      }
      if (freq === 'BIWEEKLY') {
        const dayOfWeek = d.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diffToMonday);
        const epochWeeks = Math.floor(monday.getTime() / (7 * 86400000));
        const biweekIndex = Math.floor(epochWeeks / 2);
        return `BIWEEK:${biweekIndex}`;
      }
      if (freq === 'MONTHLY') {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `MONTH:${y}-${m}`;
      }
      return `DAY:${getLocalDateString(d)}`;
    }

    function getHabitCycleWindowLabel(frequency, refDate = new Date()) {
      const d = new Date(refDate);
      const freq = (frequency || 'DAILY').toUpperCase();
      const dayOfWeek = d.getDay();

      if (freq === 'WEEKDAYS') {
        if (dayOfWeek === 0 || dayOfWeek === 6) return 'OFF DUTY (WEEKEND)';
        return `TODAY (${getLocalDateString(d).slice(5)})`;
      }
      if (freq === 'WEEKENDS') {
        if (dayOfWeek !== 0 && dayOfWeek !== 6) return 'OFF DUTY (WEEKDAY)';
        return `TODAY (${getLocalDateString(d).slice(5)})`;
      }
      if (freq === 'WEEKLY') {
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return `WK ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
      if (freq === 'BIWEEKLY') {
        return 'CURRENT 2-WK BLOCK';
      }
      if (freq === 'MONTHLY') {
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
      }
      return `TODAY (${getLocalDateString(d).slice(5)})`;
    }

    function isHabitCheckedInCurrentCycle(habit, refDate = new Date()) {
      if (!habit) return false;
      const currentKey = getHabitCurrentPeriodKey(habit.frequency, refDate);
      return habit.completed_period === currentKey;
    }

    function isHabitActiveToday(habit, refDate = new Date()) {
      if (!habit) return true;
      const freq = (habit.frequency || 'DAILY').toUpperCase();
      const day = refDate.getDay();
      if (freq === 'WEEKDAYS') return day >= 1 && day <= 5;
      if (freq === 'WEEKENDS') return day === 0 || day === 6;
      return true;
    }

    async function fetchAndRenderHabits() {
      const { data, error } = await supabaseClient
        .from('recurring_habits')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('recurring_habits fetch note:', error.message);
      }

      globalHabits = data || [];
      renderHabitsTable();
      if (typeof renderFocusMode === 'function') renderFocusMode();
    }

    function renderHabitsTable() {
      const tbody = document.getElementById('habits-ledger-tbody');
      const doneCountEl = document.getElementById('habits-done-count');
      const actHeaderEl = document.getElementById('habits-act-header');
      if (!tbody) return;

      const isOwner = Boolean(currentUser);
      if (actHeaderEl) {
        if (isOwner) actHeaderEl.classList.remove('hidden');
        else actHeaderEl.classList.add('hidden');
      }

      const now = new Date();
      const activeHabits = globalHabits.filter(h => isHabitActiveToday(h, now));
      const doneActiveCount = activeHabits.filter(h => isHabitCheckedInCurrentCycle(h, now)).length;

      if (doneCountEl) {
        doneCountEl.textContent = `${doneActiveCount} / ${activeHabits.length}`;
      }

      if (globalHabits.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="${isOwner ? 6 : 5}" class="text-center py-8 text-[#56735f] font-mono-tech text-xs">
              No recurring tasks or habits added yet. Use the form above to add daily, weekly, or monthly habits.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = globalHabits.map((habit, idx) => {
        const freqKey = (habit.frequency || 'DAILY').toUpperCase();
        const meta = HABIT_FREQ_META[freqKey] || HABIT_FREQ_META.DAILY;
        const isCheckedNow = isHabitCheckedInCurrentCycle(habit, now);
        const isActiveDay = isHabitActiveToday(habit, now);
        const cycleLabel = getHabitCycleWindowLabel(freqKey, now);
        const streakVal = Number(habit.streak_count) || 0;

        if (isOwner && editingHabitId === habit.id) {
          return `
            <tr class="bg-[#eff8f2]">
              <td colspan="6" class="p-2.5 sm:p-3">
                <div class="font-mono-tech text-[10px] uppercase text-[#047857] font-bold mb-2">Edit EDITING RECURRING HABIT</div>
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div class="sm:col-span-2">
                    <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-habit-title-${habit.id}">Habit / Task Name</label>
                    <input type="text" id="edit-habit-title-${habit.id}" value="${escapeHtml(habit.title || '')}" class="tech-input !py-1.5 !px-2 !text-xs">
                  </div>
                  <div>
                    <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-habit-freq-${habit.id}">Frequency</label>
                    <select id="edit-habit-freq-${habit.id}" class="tech-input !py-1.5 !px-2 !text-xs">
                      <option value="DAILY" ${freqKey === 'DAILY' ? 'selected' : ''}>DAILY</option>
                      <option value="WEEKDAYS" ${freqKey === 'WEEKDAYS' ? 'selected' : ''}>WEEKDAYS (M-F)</option>
                      <option value="WEEKENDS" ${freqKey === 'WEEKENDS' ? 'selected' : ''}>WEEKENDS (S-S)</option>
                      <option value="WEEKLY" ${freqKey === 'WEEKLY' ? 'selected' : ''}>WEEKLY</option>
                      <option value="BIWEEKLY" ${freqKey === 'BIWEEKLY' ? 'selected' : ''}>BIWEEKLY</option>
                      <option value="MONTHLY" ${freqKey === 'MONTHLY' ? 'selected' : ''}>MONTHLY</option>
                    </select>
                  </div>
                  <div>
                    <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-habit-notes-${habit.id}">Notes / Target Window</label>
                    <input type="text" id="edit-habit-notes-${habit.id}" value="${escapeHtml(habit.notes || '')}" placeholder="Optional note" class="tech-input !py-1.5 !px-2 !text-xs">
                  </div>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 border-t border-[#c5ded0]">
                  <div class="flex items-center gap-2">
                    <label class="font-mono-tech text-[9px] uppercase text-[#436152]" for="edit-habit-streak-${habit.id}">Streak Count:</label>
                    <input type="number" id="edit-habit-streak-${habit.id}" min="0" value="${streakVal}" class="tech-input !py-1 !px-2 !text-xs !w-20">
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="cancelEditHabitRow()" class="btn-tech-outline !py-1 !px-3 !text-xs">Cancel</button>
                    <button type="button" onclick="saveEditedHabitRow('${habit.id}')" class="btn-chamfer !py-1 !px-3.5 !text-xs">Save Changes</button>
                  </div>
                </div>
              </td>
            </tr>
          `;
        }

        const statusBadgeHtml = isCheckedNow
          ? `<span class="tech-badge badge-green !whitespace-normal text-center"> DONE (${escapeHtml(cycleLabel)})</span>`
          : !isActiveDay
            ? `<span class="tech-badge badge-neutral !whitespace-normal text-center">${escapeHtml(cycleLabel)}</span>`
            : `<span class="tech-badge badge-amber !whitespace-normal text-center">PENDING • ${escapeHtml(cycleLabel)}</span>`;

        const mobileStatusShort = isCheckedNow
          ? `<span class="tech-badge badge-green !text-[9px] !py-0.5 !px-1.5"> DONE</span>`
          : !isActiveDay
            ? `<span class="tech-badge badge-neutral !text-[9px] !py-0.5 !px-1.5">OFF TODAY</span>`
            : `<span class="tech-badge badge-amber !text-[9px] !py-0.5 !px-1.5">PENDING</span>`;

        return `
          <tr class="${isCheckedNow ? 'bg-[#f0fdf4]' : 'hover:bg-[#f9fdfb]'} transition-colors">
            <td class="text-center border-r border-[#c5ded0]/60 align-middle">
              <span class="hidden">${isCheckedNow ? 'DONE' : 'PENDING'}</span>
              <input
                type="checkbox"
                ${isCheckedNow ? 'checked' : ''}
                ${!isOwner ? 'disabled' : ''}
                onchange="toggleHabitCheck('${habit.id}', this.checked)"
                class="tech-checkbox mx-auto"
                aria-label="Toggle habit: ${escapeHtml(habit.title || 'habit')}"
                title="${isCheckedNow ? 'Checked for current cycle' : 'Check off for current cycle'}"
              />
            </td>
            <td class="border-r border-[#c5ded0]/60 break-words align-middle py-2">
              <div class="font-bold text-xs sm:text-sm leading-snug ${isCheckedNow ? 'line-through text-[#56735f]' : 'text-[#0c1f17]'}">
                ${escapeHtml(habit.title || '')}
              </div>
              ${habit.notes ? `<div class="font-mono-tech text-[10px] text-[#436152] mt-0.5 break-words">${escapeHtml(habit.notes)}</div>` : ''}
              <!-- Mobile-only stacked metadata pills so badges never overlap on narrow screens -->
              <div class="sm:hidden flex flex-wrap items-center gap-1 mt-1.5">
                <span class="tech-badge ${meta.badge} !text-[9px] !py-0.5 !px-1.5">${escapeHtml(meta.label)}</span>
                ${mobileStatusShort}
                <span class="tech-badge badge-neutral !text-[9px] !py-0.5 !px-1.5 font-bold text-[#047857]">${streakVal} </span>
              </div>
            </td>
            <td class="hidden md:table-cell text-center border-r border-[#c5ded0]/60 align-middle">
              <span class="tech-badge ${meta.badge} !text-[10px]">${escapeHtml(meta.label)}</span>
            </td>
            <td class="hidden sm:table-cell text-center border-r border-[#c5ded0]/60 align-middle">
              ${statusBadgeHtml}
            </td>
            <td class="hidden sm:table-cell text-center font-bold border-r border-[#c5ded0]/60 text-[#047857] align-middle">
              ${streakVal} 
            </td>
            ${isOwner ? `
              <td class="text-center sm:text-right align-middle p-1.5 sm:p-2">
                <div class="grid grid-cols-2 sm:inline-flex items-center gap-1 w-fit mx-auto sm:mx-0">
                  <button type="button" onclick="moveHabitRow('${habit.id}', -1)" ${idx === 0 ? 'disabled' : ''} class="touch-action-btn !min-w-[26px] !min-h-[26px] !px-1 disabled:opacity-30" title="Move habit up">▲</button>
                  <button type="button" onclick="moveHabitRow('${habit.id}', 1)" ${idx === globalHabits.length - 1 ? 'disabled' : ''} class="touch-action-btn !min-w-[26px] !min-h-[26px] !px-1 disabled:opacity-30" title="Move habit down">▼</button>
                  <button type="button" onclick="startEditHabitRow('${habit.id}')" class="touch-action-btn !min-w-[26px] !min-h-[26px] !px-1" title="Edit habit">Edit</button>
                  <button type="button" onclick="deleteHabitRow('${habit.id}')" class="touch-action-btn danger !min-w-[26px] !min-h-[26px] !px-1" title="Delete habit">×</button>
                </div>
              </td>
            ` : ''}
          </tr>
        `;
      }).join('');
    }

    onReady('add-habit-form', 'submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to add recurring habits.', true);

      const title = document.getElementById('habit-title-input').value.trim();
      const frequency = document.getElementById('habit-frequency-input').value;
      const notes = document.getElementById('habit-notes-input').value.trim();
      if (!title) return;

      const nextSortOrder = globalHabits.length > 0
        ? Math.max(...globalHabits.map(h => Number(h.sort_order) || 0)) + 1
        : 1;

      const { error } = await supabaseClient
        .from('recurring_habits')
        .insert({
          title,
          frequency,
          notes,
          completed_period: '',
          streak_count: 0,
          sort_order: nextSortOrder
        });

      if (error) {
        showToast('HABIT ERROR', error.message, true);
      } else {
        document.getElementById('habit-title-input').value = '';
        document.getElementById('habit-notes-input').value = '';
        showToast('HABIT CREATED', `Added recurring habit: "${title}" (${frequency}).`);
        fetchAndRenderHabits();
      }
    });

    async function toggleHabitCheck(habitId, isChecked) {
      if (!currentUser) return;
      const habit = globalHabits.find(h => h.id === habitId);
      if (!habit) return;

      const currentPeriodKey = getHabitCurrentPeriodKey(habit.frequency);
      const currentStreak = Number(habit.streak_count) || 0;
      const newCompletedPeriod = isChecked ? currentPeriodKey : '';
      const newStreak = isChecked ? currentStreak + 1 : Math.max(0, currentStreak - 1);

      const { error } = await supabaseClient
        .from('recurring_habits')
        .update({
          completed_period: newCompletedPeriod,
          streak_count: newStreak,
          updated_at: new Date().toISOString()
        })
        .eq('id', habitId);

      if (error) {
        showToast('UPDATE ERROR', error.message, true);
      } else {
        fetchAndRenderHabits();
      }
    }

    function startEditHabitRow(habitId) {
      if (!currentUser) return;
      editingHabitId = habitId;
      renderHabitsTable();
    }

    function cancelEditHabitRow() {
      editingHabitId = null;
      renderHabitsTable();
    }

    async function saveEditedHabitRow(habitId) {
      if (!currentUser) return;
      const newTitle = document.getElementById(`edit-habit-title-${habitId}`)?.value.trim();
      const newFreq = document.getElementById(`edit-habit-freq-${habitId}`)?.value || 'DAILY';
      const newNotes = document.getElementById(`edit-habit-notes-${habitId}`)?.value.trim() || '';
      const newStreak = parseInt(document.getElementById(`edit-habit-streak-${habitId}`)?.value, 10) || 0;
      if (!newTitle) return;

      const { error } = await supabaseClient
        .from('recurring_habits')
        .update({
          title: newTitle,
          frequency: newFreq,
          notes: newNotes,
          streak_count: Math.max(0, newStreak),
          updated_at: new Date().toISOString()
        })
        .eq('id', habitId);

      editingHabitId = null;
      if (error) {
        showToast('UPDATE ERROR', error.message, true);
      } else {
        showToast('HABIT UPDATED', `Saved changes to "${newTitle}".`);
        fetchAndRenderHabits();
      }
    }

    async function moveHabitRow(habitId, delta) {
      if (!currentUser) return;
      const idx = globalHabits.findIndex(h => h.id === habitId);
      if (idx === -1) return;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= globalHabits.length) return;

      const reordered = globalHabits.slice();
      const temp = reordered[idx];
      reordered[idx] = reordered[targetIdx];
      reordered[targetIdx] = temp;

      await Promise.all(
        reordered.map((h, i) =>
          supabaseClient.from('recurring_habits').update({ sort_order: i + 1 }).eq('id', h.id)
        )
      );
      fetchAndRenderHabits();
    }

    function deleteHabitRow(habitId) {
      if (!currentUser) return;
      const target = globalHabits.find(h => h.id === habitId);
      confirmAction(
        `Delete Recurring Habit "${target ? target.title : 'this habit'}"?`,
        'This will permanently remove this recurring habit from Supabase.',
        async () => {
          const { error } = await supabaseClient
            .from('recurring_habits')
            .delete()
            .eq('id', habitId);

          if (error) showToast('DELETE ERROR', error.message, true);
          else {
            showToast('HABIT DELETED', 'Removed recurring habit.', false, () => restoreDeletedRow('recurring_habits', target, fetchAndRenderHabits));
            fetchAndRenderHabits();
          }
        }
      );
    }

    // ==========================================
    // 9B. RUNNING PERFORMANCE LEDGERS (5K / 10K / HALF / MARATHON)
    // ==========================================
    // Parses "M:SS", "H:MM:SS" or "MM:SS"-style strings into seconds.
    // Returns 999999 for anything invalid. Enforces 0-59 on the minutes/seconds subgroups:
    // previously "05:75" was accepted as 375s and "5:5" silently read as 5m 05s.
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

    function calculateTotalTimeFromPace(paceStr, distanceKm) {
      const paceSecs = parsePaceToSeconds(paceStr);
      if (paceSecs === 999999) return '--:--';
      const totalSecs = Math.round(paceSecs * distanceKm);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      if (hours > 0) {
        return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function calculatePaceFromTotalTime(timeStr, distanceKm) {
      const totalSecs = parsePaceToSeconds(timeStr);
      if (totalSecs === 999999 || !distanceKm || distanceKm <= 0) return '';
      const paceSecs = Math.round(totalSecs / distanceKm);
      const m = Math.floor(paceSecs / 60);
      const s = paceSecs % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function normalizeTotalTimeDisplay(timeStr) {
      const totalSecs = parsePaceToSeconds(timeStr);
      if (totalSecs === 999999) return timeStr;
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      if (hours > 0) {
        return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // Live helper: updates placeholders or computes counterpart when adding a run
    function handleRunPaceOrTimePreview(sourceField) {
      const catEl = document.getElementById('run-category-input');
      const paceEl = document.getElementById('run-pace-input');
      const timeEl = document.getElementById('run-time-input');
      if (!catEl || !paceEl || !timeEl) return;

      const meta = RUN_CATEGORY_META[catEl.value] || RUN_CATEGORY_META['5k'];
      const rawPace = paceEl.value.trim();
      const rawTime = timeEl.value.trim();

      if (sourceField === 'pace' && rawPace && parsePaceToSeconds(rawPace) !== 999999) {
        const autoTime = calculateTotalTimeFromPace(rawPace, meta.km);
        timeEl.placeholder = `Auto: ${autoTime}`;
      } else if (sourceField === 'time' && rawTime && parsePaceToSeconds(rawTime) !== 999999) {
        const autoPace = calculatePaceFromTotalTime(rawTime, meta.km);
        if (autoPace) paceEl.placeholder = `Auto: ${autoPace}`;
      } else {
        timeEl.placeholder = 'Auto (e.g. 26:15)';
        paceEl.placeholder = '05:15 (or via time)';
      }
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

    function handleRunTypeSelectChange() {
      const runType = document.getElementById('run-type-input').value;
      const locInput = document.getElementById('run-location-input');
      const dateWrapper = document.getElementById('run-date-field-wrapper');
      if (runType === 'REFERENCE') {
        locInput.placeholder = 'Optional note (or blank)';
        dateWrapper.classList.add('opacity-40');
      } else {
        locInput.placeholder = 'KMPP / Raffel Park';
        dateWrapper.classList.remove('opacity-40');
      }
    }

    function toggleRunCategoryTable(catKey) {
      visibleRunCategories[catKey] = !visibleRunCategories[catKey];
      // Ensure at least 5K is visible if everything is toggled off
      if (!Object.values(visibleRunCategories).some(Boolean)) {
        visibleRunCategories['5k'] = true;
      }
      updateRunCategoryToggleButtons();
      renderRunningTables();
    }

    function updateRunCategoryToggleButtons() {
      ['5k', '10k', 'half', 'marathon'].forEach(cat => {
        const btn = document.getElementById(`run-tab-toggle-${cat}`);
        if (!btn) return;
        const labelMap = {
          '5k': '5K Run',
          '10k': visibleRunCategories['10k'] ? '10K Run' : '+ 10K Run',
          'half': visibleRunCategories['half'] ? 'Half Marathon' : '+ Half Marathon',
          'marathon': visibleRunCategories['marathon'] ? 'Marathon' : '+ Marathon'
        };
        btn.textContent = labelMap[cat];
        if (visibleRunCategories[cat]) {
          btn.classList.add('active-view');
        } else {
          btn.classList.remove('active-view');
        }
      });
    }

    async function fetchAndRenderRunningLogs() {
      const { data, error } = await supabaseClient
        .from('running_logs')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('running_logs fetch note:', error.message);
      }

      globalRunningLogs = data || [];

      // Automatically show 10k / half / marathon tables if they already contain logged records
      ['10k', 'half', 'marathon'].forEach(cat => {
        if (globalRunningLogs.some(r => r.category === cat)) {
          visibleRunCategories[cat] = true;
        }
      });

      updateRunCategoryToggleButtons();
      renderRunningTables();
    }

    function renderRunningTables() {
      const container = document.getElementById('running-tables-container');
      if (!container) return;
      container.innerHTML = '';

      const isOwner = Boolean(currentUser);
      if (typeof renderFocusMode === 'function') renderFocusMode();

      ['5k', '10k', 'half', 'marathon'].forEach(catKey => {
        if (!visibleRunCategories[catKey]) return;

        const meta = RUN_CATEGORY_META[catKey];
        // Filter rows for this distance and sort by increasing speed / decreasing pace (fastest pace at top)
        const catRows = globalRunningLogs
          .filter(r => r.category === catKey)
          .slice()
          .sort((a, b) => {
            const paceA = parsePaceToSeconds(a.pace_str);
            const paceB = parsePaceToSeconds(b.pace_str);
            if (paceA !== paceB) return paceA - paceB;
            const refA = a.run_type === 'REFERENCE' ? 1 : 0;
            const refB = b.run_type === 'REFERENCE' ? 1 : 0;
            return refA - refB;
          });

        const tableWrap = document.createElement('div');
        tableWrap.className = 'border border-[#87b39b] bg-white overflow-hidden max-w-full';

        const rowsHtml = catRows.length === 0
          ? `
            <tr>
              <td colspan="${isOwner ? 5 : 4}" class="text-center py-8 text-[#56735f] font-mono-tech text-xs">
                No ${meta.title} runs or reference paces logged yet. Use the form above to add entries.
              </td>
            </tr>
          `
          : catRows.map(row => {
              const isRef = row.run_type === 'REFERENCE';
              const rowClass = isRef
                ? 'run-row-reference'
                : row.run_type === 'EASY'
                  ? 'run-row-easy'
                  : 'run-row-threshold';

              const dateCell = isRef ? 'REF' : formatRunDateDMY(row.run_date);
              const dateCellDesktop = isRef ? 'REFERENCE' : formatRunDateDMY(row.run_date);
              const paceFormatted = normalizePaceDisplay(row.pace_str);
              const timeFormatted = row.time_str || calculateTotalTimeFromPace(paceFormatted, meta.km);

              // Mobile-friendly full-row card editor so inputs never squish on narrow screens
              if (isOwner && editingRunId === row.id) {
                return `
                  <tr class="bg-[#eff8f2]">
                    <td colspan="5" class="p-2.5 sm:p-3">
                      <div class="font-mono-tech text-[10px] uppercase text-[#047857] font-bold mb-2">Edit EDITING ${meta.title} ENTRY</div>
                      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div>
                          <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-run-date-${row.id}">Date</label>
                          <input type="text" id="edit-run-date-${row.id}" value="${escapeHtml(row.run_date || '')}" placeholder="YYYY-MM-DD / REFERENCE" class="tech-input !py-1.5 !px-2 !text-xs">
                        </div>
                        <div>
                          <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-run-time-${row.id}">Total Time</label>
                          <input type="text" id="edit-run-time-${row.id}" value="${escapeHtml(timeFormatted)}" placeholder="Auto from pace" class="tech-input !py-1.5 !px-2 !text-xs">
                        </div>
                        <div>
                          <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-run-pace-${row.id}">Pace (/km)</label>
                          <input type="text" id="edit-run-pace-${row.id}" value="${escapeHtml(paceFormatted)}" placeholder="MM:SS" class="tech-input !py-1.5 !px-2 !text-xs">
                        </div>
                        <div>
                          <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-run-type-${row.id}">Run Type</label>
                          <select id="edit-run-type-${row.id}" class="tech-input !py-1.5 !px-2 !text-xs">
                            <option value="THRESHOLD" ${row.run_type === 'THRESHOLD' ? 'selected' : ''}>THRESHOLD</option>
                            <option value="EASY" ${row.run_type === 'EASY' ? 'selected' : ''}>EASY</option>
                            <option value="REFERENCE" ${row.run_type === 'REFERENCE' ? 'selected' : ''}>REFERENCE</option>
                          </select>
                        </div>
                        <div class="col-span-2 sm:col-span-1">
                          <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-run-loc-${row.id}">Location</label>
                          <input type="text" id="edit-run-loc-${row.id}" value="${escapeHtml(row.location || '')}" placeholder="Location" class="tech-input !py-1.5 !px-2 !text-xs">
                        </div>
                      </div>
                      <div class="flex items-center justify-end gap-2 mt-2.5 pt-2 border-t border-[#c5ded0]">
                        <button type="button" onclick="cancelEditRunRow()" class="btn-tech-outline !py-1 !px-3 !text-xs">Cancel</button>
                        <button type="button" onclick="saveEditedRunRow('${row.id}', ${meta.km})" class="btn-chamfer !py-1 !px-3.5 !text-xs">Save Changes</button>
                      </div>
                    </td>
                  </tr>
                `;
              }

              return `
                <tr class="${rowClass}">
                  <td class="text-center font-semibold border-r border-[#c5ded0]/60 align-middle">
                    <span class="sm:hidden text-[10px]">${escapeHtml(dateCell)}</span>
                    <span class="hidden sm:inline">${escapeHtml(dateCellDesktop)}</span>
                  </td>
                  <td class="text-center font-semibold border-r border-[#c5ded0]/60 align-middle">${escapeHtml(timeFormatted)}</td>
                  <td class="text-center font-bold border-r border-[#c5ded0]/60 align-middle">${escapeHtml(paceFormatted)}</td>
                  <td class="break-words align-middle">${escapeHtml(row.location || (isRef ? '—' : ''))}</td>
                  ${isOwner ? `
                    <td class="text-center sm:text-right align-middle p-1 sm:p-2">
                      <div class="inline-flex items-center gap-0.5 sm:gap-1">
                        <button type="button" onclick="startEditRunRow('${row.id}')" class="touch-action-btn !min-w-[24px] !min-h-[24px] !px-1" title="Edit row">Edit</button>
                        <button type="button" onclick="deleteRunRow('${row.id}')" class="touch-action-btn danger !min-w-[24px] !min-h-[24px] !px-1" title="Delete row">×</button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('');

        const tableDomId = `run-table-${catKey}`;
        tableWrap.innerHTML = `
          <!-- Spreadsheet-Style Technical Banner -->
          <div class="bg-[#d5e6dc] text-center font-mono-tech text-xs font-bold uppercase tracking-widest py-1 border-b border-[#87b39b] text-[#0c1f17]">
            RUN
          </div>
          <div class="bg-[#e8f3ec] text-center font-mono-tech text-xs font-bold uppercase tracking-wider py-1 border-b border-[#87b39b] text-[#047857]">
            ${meta.title}
          </div>
          <div class="w-full overflow-x-auto">
            <table id="${tableDomId}" class="tech-table run-mobile-table">
              <thead>
                <tr class="bg-[#f4faf6]">
                  <th class="!text-center w-[22%] sm:w-32 border-r border-[#c5ded0]">DATE</th>
                  <th class="!text-center w-[19%] sm:w-28 border-r border-[#c5ded0]">TIME</th>
                  <th class="!text-center w-[18%] sm:w-32 border-r border-[#c5ded0]">PACE</th>
                  <th class="w-auto">LOCATION <span class="hidden sm:inline text-[10px] font-normal text-[#436152]">(YELLOW = THRESHOLD / GREEN = EASY)</span></th>
                  ${isOwner ? `<th data-no-export="true" class="!text-center sm:!text-right w-[52px] sm:w-20">ACT</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          <div class="table-export-bar px-3 pb-2">
            <span>EXPORT ${meta.title} TABLE:</span>
            <div class="flex flex-wrap items-center gap-1">
              <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'running-${catKey}-ledger', 'csv')" class="btn-export-tag">↓ CSV</button>
              <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'running-${catKey}-ledger', 'md')" class="btn-export-tag">↓ MD</button>
              <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'running-${catKey}-ledger', 'json')" class="btn-export-tag">↓ JSON</button>
              <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'running-${catKey}-ledger', 'tsv')" class="btn-export-tag">↓ TSV</button>
              <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'running-${catKey}-ledger', 'copy')" class="btn-export-tag">⎘ COPY MD</button>
            </div>
          </div>
        `;

        container.appendChild(tableWrap);
      });
    }

    onReady('add-run-form', 'submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to log runs.', true);

      const category = document.getElementById('run-category-input').value;
      const rawPace = document.getElementById('run-pace-input').value.trim();
      const rawTime = document.getElementById('run-time-input').value.trim();
      const location = document.getElementById('run-location-input').value.trim();
      const runType = document.getElementById('run-type-input').value;
      const dateInputVal = document.getElementById('run-date-input').value;

      const meta = RUN_CATEGORY_META[category] || RUN_CATEGORY_META['5k'];

      let paceFormatted = '';
      let finalTimeStr = '';

      const hasValidPace = rawPace && parsePaceToSeconds(rawPace) !== 999999;
      const hasValidTime = rawTime && parsePaceToSeconds(rawTime) !== 999999;

      if (!hasValidPace && !hasValidTime) {
        return showToast('PACE OR TIME REQUIRED', 'Enter either Pace (MM:SS) or Total Time (MM:SS / H:MM:SS).', true);
      }

      if (hasValidPace && hasValidTime) {
        paceFormatted = normalizePaceDisplay(rawPace);
        finalTimeStr = normalizeTotalTimeDisplay(rawTime);
      } else if (hasValidPace) {
        paceFormatted = normalizePaceDisplay(rawPace);
        finalTimeStr = calculateTotalTimeFromPace(paceFormatted, meta.km);
      } else {
        finalTimeStr = normalizeTotalTimeDisplay(rawTime);
        paceFormatted = calculatePaceFromTotalTime(rawTime, meta.km);
      }

      const runDate = runType === 'REFERENCE'
        ? 'REFERENCE'
        : (dateInputVal || getLocalDateString(new Date()));

      // Ensure the target category table is visible
      visibleRunCategories[category] = true;
      updateRunCategoryToggleButtons();

      const { error } = await supabaseClient
        .from('running_logs')
        .insert({
          category,
          run_date: runDate,
          time_str: finalTimeStr,
          pace_str: paceFormatted,
          run_type: runType,
          location: runType === 'REFERENCE' ? location : location
        });

      if (error) {
        showToast('DATABASE ERROR', error.message, true);
      } else {
        document.getElementById('run-pace-input').value = '';
        document.getElementById('run-time-input').value = '';
        document.getElementById('run-location-input').value = '';
        handleRunPaceOrTimePreview('pace');
        showToast(
          runType === 'REFERENCE' ? 'REF PACE INSERTED' : 'RUN LOGGED',
          `Added ${meta.title} entry at ${paceFormatted}/km (${finalTimeStr}).`
        );
        fetchAndRenderRunningLogs();
      }
    });

    function startEditRunRow(runId) {
      if (!currentUser) return;
      editingRunId = runId;
      renderRunningTables();
    }

    function cancelEditRunRow() {
      editingRunId = null;
      renderRunningTables();
    }

    async function saveEditedRunRow(runId, distanceKm) {
      if (!currentUser) return;
      const newDate = document.getElementById(`edit-run-date-${runId}`).value.trim();
      const newPaceRaw = document.getElementById(`edit-run-pace-${runId}`).value.trim();
      const newTimeRaw = document.getElementById(`edit-run-time-${runId}`).value.trim();
      const newType = document.getElementById(`edit-run-type-${runId}`).value;
      const newLoc = document.getElementById(`edit-run-loc-${runId}`).value.trim();

      const paceFormatted = normalizePaceDisplay(newPaceRaw);
      const autoTime = calculateTotalTimeFromPace(paceFormatted, distanceKm);
      const finalTime = newTimeRaw || autoTime;
      const finalDate = newType === 'REFERENCE' ? 'REFERENCE' : (newDate || getLocalDateString(new Date()));

      const { error } = await supabaseClient
        .from('running_logs')
        .update({
          run_date: finalDate,
          pace_str: paceFormatted,
          time_str: finalTime,
          run_type: newType,
          location: newLoc
        })
        .eq('id', runId);

      editingRunId = null;
      if (error) {
        showToast('UPDATE ERROR', error.message, true);
      } else {
        showToast('RUN UPDATED', 'Updated running log entry.');
        fetchAndRenderRunningLogs();
      }
    }

    async function deleteRunRow(runId) {
      if (!currentUser) return;
      const { error } = await supabaseClient
        .from('running_logs')
        .delete()
        .eq('id', runId);

      if (error) showToast('DELETE ERROR', error.message, true);
      else {
        const removed = (globalRunningLogs || []).find(r => r.id === runId) || null;
        fetchAndRenderRunningLogs();
        if (removed) {
          showToast('RUN DELETED', 'Removed run entry.', false,
            () => restoreDeletedRow('running_logs', removed, fetchAndRenderRunningLogs));
        } else {
          showToast('RUN DELETED', 'Removed run entry.');
        }
      }
    }

    // ==========================================
    // 10. TAB 5: DAILY JOURNAL NOTES LOGIC (RICH TEXT)
    // ==========================================
    // Rich-text commands: document.execCommand is deprecated but remains the only portable
    // way to toggle bold/italic/lists inside a contenteditable. Guard it so an engine that
    // dropped the command shows a notice instead of throwing into the global error surface.
    function applyRichTextCommand(command, editor) {
      if (!editor) return false;
      try {
        if (typeof document.queryCommandSupported === 'function' && !document.queryCommandSupported(command)) {
          showToast('FORMAT UNAVAILABLE', 'This browser does not support "' + command + '".', true);
          return false;
        }
        const applied = document.execCommand(command, false, null);
        if (!applied) showToast('FORMAT UNAVAILABLE', 'The "' + command + '" command was rejected by this browser.', true);
        return applied;
      } catch (e) {
        showToast('FORMAT FAILED', (e && e.message) || 'Rich-text command failed.', true);
        return false;
      }
    }

    function formatJournalDoc(command) {
      if (!currentUser) return;
      const editor = document.getElementById('note-content-editor');
      if (!editor) return;
      editor.focus();
      applyRichTextCommand(command, editor);
      updateWordCount();
    }

    // Whitelist sanitiser for note HTML.
    // Journal / general-note bodies are stored in Supabase as rich text and injected with
    // innerHTML, so a pasted <img onerror=...> or <script> payload would execute inside the
    // owner's authenticated session. Anything not explicitly allowed is dropped (dangerous
    // tags) or unwrapped (unknown-but-harmless tags keep their text).
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

    function normalizeNoteHtml(rawContent) {
      if (!rawContent) return '';
      // If content has no HTML tags at all, convert plain newlines to <br>
      if (!/<[a-z][\s\S]*>/i.test(rawContent)) {
        return escapeHtml(rawContent).replace(/\r?\n/g, '<br>');
      }
      return sanitizeNoteHtml(rawContent);
    }

    const NOTES_ORDER_DATE_KEY = '1970-01-04';
    let journalEntryOrder = [];
    let generalNoteOrder = [];

    try {
      const savedJOrder = JSON.parse(localStorage.getItem('autumn_journal_order') || '[]');
      if (Array.isArray(savedJOrder)) journalEntryOrder = savedJOrder;
      const savedGOrder = JSON.parse(localStorage.getItem('autumn_gen_note_order') || '[]');
      if (Array.isArray(savedGOrder)) generalNoteOrder = savedGOrder;
    } catch (e) {}

    function sortJournalNotesBySavedOrder(notes) {
      if (!Array.isArray(journalEntryOrder) || journalEntryOrder.length === 0) return notes;
      const orderMap = {};
      journalEntryOrder.forEach((d, idx) => { orderMap[d] = idx; });
      return notes.slice().sort((a, b) => {
        const posA = orderMap[a.date] !== undefined ? orderMap[a.date] : -1;
        const posB = orderMap[b.date] !== undefined ? orderMap[b.date] : -1;
        if (posA !== posB) return posA - posB;
        return b.date.localeCompare(a.date);
      });
    }

    function sortGeneralNotesBySavedOrder(notes) {
      if (!Array.isArray(generalNoteOrder) || generalNoteOrder.length === 0) return notes;
      const orderMap = {};
      generalNoteOrder.forEach((id, idx) => { orderMap[id] = idx; });
      return notes.slice().sort((a, b) => {
        const posA = orderMap[a.id] !== undefined ? orderMap[a.id] : -1;
        const posB = orderMap[b.id] !== undefined ? orderMap[b.id] : -1;
        if (posA !== posB) return posA - posB;
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      });
    }

    async function persistNotesOrderConfig() {
      try {
        localStorage.setItem('autumn_journal_order', JSON.stringify(journalEntryOrder));
        localStorage.setItem('autumn_gen_note_order', JSON.stringify(generalNoteOrder));
      } catch (e) {}

      if (currentUser) {
        await supabaseClient
          .from('daily_notes')
          .upsert({
            date: NOTES_ORDER_DATE_KEY,
            title: '__NOTES_ORDER__',
            mood: 'SYSTEM',
            content: JSON.stringify({ journalOrder: journalEntryOrder, generalNoteOrder: generalNoteOrder }),
            updated_at: new Date().toISOString()
          }, { onConflict: 'date' });
      }
    }

    function moveJournalEntry(dateStr, delta) {
      const sorted = sortJournalNotesBySavedOrder(globalNotes);
      const currentDates = sorted.map(n => n.date);
      const idx = currentDates.indexOf(dateStr);
      if (idx === -1) return;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= currentDates.length) return;

      const temp = currentDates[idx];
      currentDates[idx] = currentDates[targetIdx];
      currentDates[targetIdx] = temp;

      journalEntryOrder = currentDates;
      globalNotes = sortJournalNotesBySavedOrder(globalNotes);
      persistNotesOrderConfig();
      renderNotesArchive();
    }

    function moveGeneralNoteEntry(noteId, delta) {
      const sorted = sortGeneralNotesBySavedOrder(globalGeneralNotes);
      const currentIds = sorted.map(n => n.id);
      const idx = currentIds.indexOf(noteId);
      if (idx === -1) return;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= currentIds.length) return;

      const temp = currentIds[idx];
      currentIds[idx] = currentIds[targetIdx];
      currentIds[targetIdx] = temp;

      generalNoteOrder = currentIds;
      globalGeneralNotes = sortGeneralNotesBySavedOrder(globalGeneralNotes);
      persistNotesOrderConfig();
      renderGeneralNotesArchive();
    }

    // Reserved `daily_notes` rows used as a lightweight key/value store for app config.
    // Every one of them is dated in 1970, so they must NEVER surface as journal entries.
    function isReservedSystemNoteDate(dateStr) {
      if (!dateStr) return true;
      return String(dateStr) < '2000-01-01';
    }

    async function fetchAndRenderNotes() {
      const [notesRes, orderRes] = await Promise.all([
        supabaseClient
          .from('daily_notes')
          .select('*')
          // Single range guard instead of one .neq() per reserved key: this automatically
          // excludes GCAL_CONFIG (1970-01-01), GDRIVE_CONFIG (1970-01-02), TASK_COL_ORDER
          // (1970-01-03), NOTES_ORDER (1970-01-04) AND GCAL_MANUAL_MONTHS (1970-01-05),
          // which previously leaked into the archive as a phantom "WK Jan 5 – Jan 11, 1970".
          .gte('date', '2000-01-01')
          .order('date', { ascending: false }),
        supabaseClient
          .from('daily_notes')
          .select('content')
          .eq('date', NOTES_ORDER_DATE_KEY)
          .maybeSingle()
      ]);

      if (notesRes.error) {
        console.warn('daily_notes fetch note:', notesRes.error.message);
      }

      if (orderRes && orderRes.data && orderRes.data.content) {
        try {
          const parsed = JSON.parse(orderRes.data.content);
          if (Array.isArray(parsed.journalOrder) && parsed.journalOrder.length > 0) {
            journalEntryOrder = parsed.journalOrder;
            localStorage.setItem('autumn_journal_order', JSON.stringify(journalEntryOrder));
          }
          if (Array.isArray(parsed.generalNoteOrder) && parsed.generalNoteOrder.length > 0) {
            generalNoteOrder = parsed.generalNoteOrder;
            localStorage.setItem('autumn_gen_note_order', JSON.stringify(generalNoteOrder));
          }
        } catch (e) {}
      }

      globalNotes = sortJournalNotesBySavedOrder(
        (notesRes.data || []).filter(n => !isReservedSystemNoteDate(n.date) && n.title !== '__NOTES_ORDER__')
      );
      renderNotesArchive();
      loadNoteForDate(selectedNoteDate);
    }

    // Normalizes any YYYY-MM-DD date string to the Monday of that week for Weekly Journal entries
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

    function renderNotesArchive() {
      const list = document.getElementById('notes-archive-list');
      globalNotes = sortJournalNotesBySavedOrder(globalNotes);
      document.getElementById('notes-count').textContent = globalNotes.length;
      list.innerHTML = '';

      if (globalNotes.length === 0) {
        list.innerHTML = `<div class="font-mono-tech text-xs text-[#56735f] py-6 text-center">No weekly journal entries archived yet.</div>`;
        return;
      }

      globalNotes.forEach((note, idx) => {
        const isSelected = note.date === selectedNoteDate;
        const item = document.createElement('div');
        item.onclick = () => selectJournalDate(note.date, true);
        item.className = `w-full text-left p-2.5 border transition-all cursor-pointer select-none ${
          isSelected
            ? 'border-[#059669] bg-[#dcfce7]'
            : 'border-[#c5ded0] bg-white hover:border-[#87b39b]'
        }`;

        const previewTitle = note.title ? escapeHtml(note.title) : 'Untitled Weekly Log';
        const plainText = stripHtmlTags(note.content || '');
        const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
        const weekLabel = formatWeekSpanLabel(note.date);

        item.innerHTML = `
          <div class="flex items-center justify-between gap-1 font-mono-tech text-[10px]">
            <span class="font-bold text-[#0c1f17] truncate">${escapeHtml(weekLabel)}</span>
            <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
              <span class="text-[10px] text-[#047857] mr-0.5">${escapeHtml(note.mood || 'OPTIMAL')}</span>
              <button
                type="button"
                onclick="moveJournalEntry('${note.date}', -1)"
                ${idx === 0 ? 'disabled' : ''}
                class="touch-action-btn !min-w-[22px] !min-h-[22px] !px-1 !py-0 text-[10px] disabled:opacity-30"
                title="Move weekly entry up"
              >▲</button>
              <button
                type="button"
                onclick="moveJournalEntry('${note.date}', 1)"
                ${idx === globalNotes.length - 1 ? 'disabled' : ''}
                class="touch-action-btn !min-w-[22px] !min-h-[22px] !px-1 !py-0 text-[10px] disabled:opacity-30"
                title="Move weekly entry down"
              >▼</button>
            </div>
          </div>
          <div class="text-xs font-semibold text-[#0c1f17] truncate mt-1">${previewTitle}</div>
          <div class="font-mono-tech text-[10px] text-[#56735f] mt-0.5">${words} words • key: ${note.date}</div>
        `;
        list.appendChild(item);
      });
    }

    // ── Weekly Journal editor state ─────────────────────────────────────────
    // The editor previously had NO autosave and no navigation guard: clicking another week
    // (or closing the tab) silently threw away whatever had been typed.
    let journalEditorDirty = false;
    let journalLoadedKey = null;
    let journalAutosaveTimer = null;
    const JOURNAL_AUTOSAVE_MS = 2500;

    function setJournalSaveStatus(text) {
      const statusEl = document.getElementById('note-last-saved');
      if (statusEl && text) statusEl.textContent = text;
    }

    function selectJournalDate(dateStr, keepExactKey = false, pickerDisplayValue = null) {
      const resolvedKey = keepExactKey ? dateStr : getWeekMondayDateString(dateStr);

      // Re-selecting the week that is already open must never reload over unsaved text.
      if (journalEditorDirty && journalLoadedKey === resolvedKey) return;

      // Never silently discard unsaved edits when hopping between weeks.
      if (journalEditorDirty && journalLoadedKey && journalLoadedKey !== resolvedKey) {
        confirmAction(
          'Unsaved Journal Edits',
          'This weekly entry has unsaved changes. Load another week and discard them?',
          () => {
            journalEditorDirty = false;
            applyJournalSelection(resolvedKey, pickerDisplayValue);
          }
        );
        return;
      }
      applyJournalSelection(resolvedKey, pickerDisplayValue);
    }

    function applyJournalSelection(resolvedKey, pickerDisplayValue = null) {
      selectedNoteDate = resolvedKey;
      const picker = document.getElementById('notes-date-picker');
      // Keep the day the user actually picked visible instead of snapping it back to the
      // Monday key; the loaded entry is still the week containing that day.
      if (picker) picker.value = pickerDisplayValue || resolvedKey;
      renderNotesArchive();
      loadNoteForDate(resolvedKey);
    }

    function loadNoteForDate(dateStr) {
      journalLoadedKey = dateStr;
      journalEditorDirty = false;
      const weekSpanText = formatWeekSpanLabel(dateStr);
      document.getElementById('note-active-date-badge').textContent = weekSpanText;
      const existing = globalNotes.find(n => n.date === dateStr);

      const titleInput = document.getElementById('note-title-input');
      const moodInput = document.getElementById('note-mood-input');
      const contentEditor = document.getElementById('note-content-editor');
      const statusEl = document.getElementById('note-last-saved');

      if (existing) {
        titleInput.value = existing.title || '';
        moodInput.value = existing.mood || 'OPTIMAL';
        contentEditor.innerHTML = normalizeNoteHtml(existing.content || '');
        const updated = existing.updated_at ? new Date(existing.updated_at).toLocaleString() : 'Recorded';
        statusEl.textContent = `ARCHIVED WEEKLY LOG (${weekSpanText}) // Last updated: ${updated}`;
      } else {
        titleInput.value = '';
        moodInput.value = 'OPTIMAL';
        contentEditor.innerHTML = '';
        statusEl.textContent = `NEW WEEKLY LOG SLOT // No entry saved for ${weekSpanText} yet.`;
      }
      updateWordCount();
    }

    function updateWordCount() {
      const editor = document.getElementById('note-content-editor');
      const text = editor ? (editor.innerText || editor.textContent || '').trim() : '';
      const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
      document.getElementById('note-word-count').textContent = `${count} words`;
    }

    onReady('note-content-editor', 'input', updateWordCount);

    // Persists the current weekly entry. `silent` = autosave (no toast, no editor rebuild).
    async function saveJournalEntry(opts = {}) {
      const silent = Boolean(opts.silent);
      if (!currentUser) {
        if (!silent) showToast('ACCESS DENIED', 'Sign in as autumn to save journal notes.', true);
        return false;
      }
      if (!selectedNoteDate) return false;

      const title = document.getElementById('note-title-input').value.trim();
      const mood = document.getElementById('note-mood-input').value;
      const content = document.getElementById('note-content-editor').innerHTML.trim();

      const { error } = await supabaseClient
        .from('daily_notes')
        .upsert({
          date: selectedNoteDate,
          title,
          mood,
          content,
          updated_at: new Date().toISOString()
        }, { onConflict: 'date' });

      if (error) {
        setJournalSaveStatus('SAVE FAILED — ' + error.message);
        if (!silent) showToast('SAVE ERROR', error.message, true);
        return false;
      }

      journalEditorDirty = false;
      if (journalAutosaveTimer) {
        clearTimeout(journalAutosaveTimer);
        journalAutosaveTimer = null;
      }

      // Update the in-memory archive instead of re-fetching, so an autosave can never
      // rebuild the editor underneath the caret.
      const savedEntry = {
        date: selectedNoteDate,
        title,
        mood,
        content,
        updated_at: new Date().toISOString()
      };
      const idx = globalNotes.findIndex(n => n.date === savedEntry.date);
      if (idx >= 0) globalNotes[idx] = Object.assign({}, globalNotes[idx], savedEntry);
      else globalNotes.push(savedEntry);
      renderNotesArchive();

      setJournalSaveStatus(
        `ARCHIVED WEEKLY LOG (${formatWeekSpanLabel(selectedNoteDate)}) // Last updated: ${new Date().toLocaleString()}`
      );
      if (!silent) showToast('JOURNAL SAVED', `Weekly log for ${selectedNoteDate} committed.`);
      return true;
    }

    // Any edit in the form (rich-text body, title or mood) marks it unsaved and schedules
    // an autosave once typing pauses.
    onReady('note-editor-form', 'input', () => {
      journalEditorDirty = true;
      setJournalSaveStatus(`UNSAVED CHANGES // autosaving in ${Math.round(JOURNAL_AUTOSAVE_MS / 1000)}s…`);
      if (journalAutosaveTimer) clearTimeout(journalAutosaveTimer);
      journalAutosaveTimer = setTimeout(() => saveJournalEntry({ silent: true }), JOURNAL_AUTOSAVE_MS);
    });

    onReady('notes-date-picker', 'change', (e) => {
      if (e.target.value) selectJournalDate(e.target.value, false, e.target.value);
    });

    onReady('note-editor-form', 'submit', async (e) => {
      e.preventDefault();
      await saveJournalEntry({ silent: false });
    });

    onReady('delete-note-btn', 'click', () => {
      if (!currentUser) return;
      confirmAction(
        `Delete Journal Entry for ${selectedNoteDate}?`,
        'This will permanently remove this daily journal entry from Supabase.',
        async () => {
          const { error } = await supabaseClient
            .from('daily_notes')
            .delete()
            .eq('date', selectedNoteDate);

          if (error) showToast('DELETE ERROR', error.message, true);
          else {
            showToast('ENTRY DELETED', `Removed journal entry for ${selectedNoteDate}.`);
            fetchAndRenderNotes();
          }
        }
      );
    });

    // ==========================================
    // 10B. TAB 5: GENERAL NOTES & INFO LOGIC (RICH TEXT)
    // ==========================================
    function formatGeneralNoteDoc(command) {
      if (!currentUser) return;
      const editor = document.getElementById('gen-note-content-editor');
      if (!editor) return;
      editor.focus();
      applyRichTextCommand(command, editor);
      updateGeneralNoteWordCount();
    }

    async function fetchAndRenderGeneralNotes() {
      const { data, error } = await supabaseClient
        .from('general_notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('general_notes fetch note:', error.message);
      }

      globalGeneralNotes = sortGeneralNotesBySavedOrder(data || []);
      renderGeneralNotesArchive();
      if (typeof syncTerminalDrawerFromGeneralNotes === 'function') {
        syncTerminalDrawerFromGeneralNotes();
      }

      if (selectedGeneralNoteId) {
        const stillExists = globalGeneralNotes.find(n => n.id === selectedGeneralNoteId);
        if (stillExists) {
          // Never clobber text the user is still editing (e.g. a background refresh).
          if (!generalNoteDirty) loadGeneralNoteIntoEditor(stillExists);
          return;
        }
      }

      if (globalGeneralNotes.length > 0) {
        if (generalNoteDirty) { renderGeneralNotesArchive(); return; }
        selectedGeneralNoteId = globalGeneralNotes[0].id;
        renderGeneralNotesArchive();
        loadGeneralNoteIntoEditor(globalGeneralNotes[0]);
      } else {
        createNewGeneralNoteSlot();
      }
    }

    function renderGeneralNotesArchive() {
      const list = document.getElementById('gen-notes-archive-list');
      const countEl = document.getElementById('gen-notes-count');
      const searchInput = document.getElementById('gen-notes-search');
      if (!list) return;

      globalGeneralNotes = sortGeneralNotesBySavedOrder(globalGeneralNotes);

      const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const filtered = globalGeneralNotes.filter(n => {
        if (!query) return true;
        return (
          (n.title || '').toLowerCase().includes(query) ||
          (n.category || '').toLowerCase().includes(query) ||
          stripHtmlTags(n.content || '').toLowerCase().includes(query)
        );
      });

      if (countEl) countEl.textContent = filtered.length;
      list.innerHTML = '';

      if (filtered.length === 0) {
        list.innerHTML = `<div class="font-mono-tech text-xs text-[#56735f] py-6 text-center">No general notes saved yet.</div>`;
        return;
      }

      filtered.forEach((note, idx) => {
        const isSelected = note.id === selectedGeneralNoteId;
        const isTerminalNote = note.category === 'TERMINAL' || (note.title || '').startsWith('TERMINAL SCRATCHPAD //');
        const item = document.createElement('div');
        item.onclick = () => selectGeneralNote(note.id);
        item.className = `w-full text-left p-2.5 border transition-all cursor-pointer select-none ${
          isSelected
            ? 'border-[#059669] bg-[#dcfce7]'
            : isTerminalNote
              ? 'border-[#059669]/60 bg-[#f0fdf4] hover:border-[#059669]'
              : 'border-[#c5ded0] bg-white hover:border-[#87b39b]'
        }`;

        const previewTitle = note.title ? escapeHtml(note.title) : 'Untitled General Note';
        const plainText = stripHtmlTags(note.content || '');
        const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
        const dateShort = note.updated_at ? new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

        item.innerHTML = `
          <div class="flex items-center justify-between gap-1 font-mono-tech text-[10px]">
            <span class="font-bold ${isTerminalNote ? 'text-[#047857] bg-[#dcfce7] px-1 border border-[#86efac]' : 'text-[#0369a1]'} uppercase truncate">
              ${isTerminalNote ? '⌘ TERMINAL // DAILY' : escapeHtml(note.category || 'GENERAL')}
            </span>
            <div class="flex items-center gap-1 shrink-0" onclick="event.stopPropagation()">
              <span class="text-[#56735f] mr-0.5">${dateShort}</span>
              <button
                type="button"
                onclick="moveGeneralNoteEntry('${note.id}', -1)"
                ${idx === 0 ? 'disabled' : ''}
                class="touch-action-btn !min-w-[22px] !min-h-[22px] !px-1 !py-0 text-[10px] disabled:opacity-30"
                title="Move general note up"
              >▲</button>
              <button
                type="button"
                onclick="moveGeneralNoteEntry('${note.id}', 1)"
                ${idx === filtered.length - 1 ? 'disabled' : ''}
                class="touch-action-btn !min-w-[22px] !min-h-[22px] !px-1 !py-0 text-[10px] disabled:opacity-30"
                title="Move general note down"
              >▼</button>
            </div>
          </div>
          <div class="text-xs font-semibold text-[#0c1f17] truncate mt-1">${previewTitle}</div>
          <div class="font-mono-tech text-[10px] text-[#56735f] mt-0.5">${words} words</div>
        `;
        list.appendChild(item);
      });
    }

    // ── General Notes editor state (mirrors the Weekly Journal behaviour) ────
    let generalNoteDirty = false;
    let generalNoteAutosaveTimer = null;
    const GENERAL_NOTE_AUTOSAVE_MS = 2500;

    function setGeneralNoteStatus(text) {
      const el = document.getElementById('gen-note-last-saved');
      if (el && text) el.textContent = text;
    }

    function selectGeneralNote(noteId) {
      if (generalNoteDirty && noteId !== selectedGeneralNoteId) {
        confirmAction(
          'Unsaved Note Changes',
          'This note has unsaved changes. Load another note and discard them?',
          () => {
            generalNoteDirty = false;
            applyGeneralNoteSelection(noteId);
          }
        );
        return;
      }
      applyGeneralNoteSelection(noteId);
    }

    function applyGeneralNoteSelection(noteId) {
      selectedGeneralNoteId = noteId;
      renderGeneralNotesArchive();
      const found = globalGeneralNotes.find(n => n.id === noteId);
      if (found) loadGeneralNoteIntoEditor(found);
    }

    function createNewGeneralNoteSlot() {
      selectedGeneralNoteId = null;
      renderGeneralNotesArchive();
      document.getElementById('gen-note-active-badge').textContent = 'NEW NOTE';
      document.getElementById('gen-note-title-input').value = '';
      document.getElementById('gen-note-category-input').value = 'GENERAL';
      document.getElementById('gen-note-content-editor').innerHTML = '';
      document.getElementById('gen-note-last-saved').textContent = 'NEW GENERAL NOTE // Fill in title and content below to save.';
      updateGeneralNoteWordCount();
    }

    function loadGeneralNoteIntoEditor(noteObj) {
      generalNoteDirty = false;
      document.getElementById('gen-note-active-badge').textContent = noteObj.category || 'GENERAL';
      document.getElementById('gen-note-title-input').value = noteObj.title || '';
      document.getElementById('gen-note-category-input').value = noteObj.category || 'GENERAL';
      document.getElementById('gen-note-content-editor').innerHTML = normalizeNoteHtml(noteObj.content || '');
      const updated = noteObj.updated_at ? new Date(noteObj.updated_at).toLocaleString() : 'Saved';
      document.getElementById('gen-note-last-saved').textContent = `SAVED NOTE // Last updated: ${updated}`;
      updateGeneralNoteWordCount();
    }

    function updateGeneralNoteWordCount() {
      const editor = document.getElementById('gen-note-content-editor');
      const text = editor ? (editor.innerText || editor.textContent || '').trim() : '';
      const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
      document.getElementById('gen-note-word-count').textContent = `${count} words`;
    }

    onReady('gen-note-content-editor', 'input', updateGeneralNoteWordCount);

    // Persists the current general note. `silent` = autosave (no toast, no editor rebuild).
    async function saveGeneralNote(opts = {}) {
      const silent = Boolean(opts.silent);
      if (!currentUser) {
        if (!silent) showToast('ACCESS DENIED', 'Sign in as autumn to save general notes.', true);
        return false;
      }

      const title = document.getElementById('gen-note-title-input').value.trim();
      const category = document.getElementById('gen-note-category-input').value;
      const content = document.getElementById('gen-note-content-editor').innerHTML.trim();

      if (!title) {
        // A title is required by the schema flow, so autosave just waits for one.
        if (silent) setGeneralNoteStatus('UNSAVED // add a title to autosave');
        else showToast('TITLE REQUIRED', 'Give the note a title before saving.', true);
        return false;
      }

      let error = null;
      if (selectedGeneralNoteId) {
        const res = await supabaseClient
          .from('general_notes')
          .update({ title, category, content, updated_at: new Date().toISOString() })
          .eq('id', selectedGeneralNoteId);
        error = res.error;
      } else {
        const res = await supabaseClient
          .from('general_notes')
          .insert({ title, category, content, updated_at: new Date().toISOString() })
          .select()
          .single();
        error = res.error;
        if (res.data && res.data.id) selectedGeneralNoteId = res.data.id;
      }

      if (error) {
        setGeneralNoteStatus('SAVE FAILED — ' + error.message);
        if (!silent) showToast('SAVE ERROR', error.message, true);
        return false;
      }

      generalNoteDirty = false;
      if (generalNoteAutosaveTimer) {
        clearTimeout(generalNoteAutosaveTimer);
        generalNoteAutosaveTimer = null;
      }

      // Refresh the in-memory list (no re-fetch) so the archive stays in sync without
      // rebuilding the editor underneath the caret.
      const saved = {
        id: selectedGeneralNoteId,
        title,
        category,
        content,
        updated_at: new Date().toISOString()
      };
      const idx = globalGeneralNotes.findIndex(n => n.id === selectedGeneralNoteId);
      if (idx >= 0) globalGeneralNotes[idx] = Object.assign({}, globalGeneralNotes[idx], saved);
      else globalGeneralNotes.unshift(saved);
      renderGeneralNotesArchive();

      setGeneralNoteStatus(`SAVED NOTE // Last updated: ${new Date().toLocaleString()}`);
      if (!silent) showToast(selectedGeneralNoteId ? 'GENERAL NOTE SAVED' : 'GENERAL NOTE CREATED', `Saved "${title}".`);
      return true;
    }

    onReady('gen-note-editor-form', 'input', () => {
      generalNoteDirty = true;
      setGeneralNoteStatus(`UNSAVED CHANGES // autosaving in ${Math.round(GENERAL_NOTE_AUTOSAVE_MS / 1000)}s…`);
      if (generalNoteAutosaveTimer) clearTimeout(generalNoteAutosaveTimer);
      generalNoteAutosaveTimer = setTimeout(() => saveGeneralNote({ silent: true }), GENERAL_NOTE_AUTOSAVE_MS);
    });

    onReady('gen-note-editor-form', 'submit', async (e) => {
      e.preventDefault();
      await saveGeneralNote({ silent: false });
    });

    onReady('delete-gen-note-btn', 'click', () => {
      if (!currentUser || !selectedGeneralNoteId) return;
      const currentTitle = document.getElementById('gen-note-title-input').value || 'this note';
      confirmAction(
        `Delete General Note "${currentTitle}"?`,
        'This will permanently remove this general note from Supabase.',
        async () => {
          const { error } = await supabaseClient
            .from('general_notes')
            .delete()
            .eq('id', selectedGeneralNoteId);

          if (error) showToast('DELETE ERROR', error.message, true);
          else {
            selectedGeneralNoteId = null;
            showToast('GENERAL NOTE DELETED', `Removed "${currentTitle}".`);
            fetchAndRenderGeneralNotes();
          }
        }
      );
    });

    // ==========================================
    // 10B-2. TAB 5: COMPETITIONS / ACTIVITIES & POSITIONS LEDGERS
    // ==========================================
    let globalPortfolioLogs = [];
    let editingPortfolioId = null;

    const PORTFOLIO_CATEGORY_META = {
      COMPETITION: {
        bannerTop: 'PORTFOLIO LEDGER // 01',
        title: 'COMPETITIONS & ACTIVITIES',
        col1Header: 'COMPETITION / ACTIVITY',
        col2Header: 'DATE / DURATION',
        col3Header: 'RESULTS / POSITION',
        emptyMsg: 'No competitions or activities logged yet. Use the form above to add entries.'
      },
      POSITION: {
        bannerTop: 'PORTFOLIO LEDGER // 02',
        title: 'POSITIONS & LEADERSHIP ROLES',
        col1Header: 'POSITION / ORGANIZATION',
        col2Header: 'DATE / TENURE',
        col3Header: 'ROLE / ACHIEVEMENT',
        emptyMsg: 'No leadership positions or roles logged yet. Use the form above to add entries.'
      }
    };

    function handlePortfolioCategoryChange() {
      const cat = document.getElementById('portfolio-category-input')?.value || 'COMPETITION';
      const titleLbl = document.getElementById('portfolio-title-label');
      const titleIn = document.getElementById('portfolio-title-input');
      const resLbl = document.getElementById('portfolio-result-label');
      const resIn = document.getElementById('portfolio-result-input');

      if (cat === 'POSITION') {
        if (titleLbl) titleLbl.textContent = '1. Position / Organization';
        if (titleIn) titleIn.placeholder = 'e.g., President — Robotics Society';
        if (resLbl) resLbl.textContent = '3. Role / Division / Scope';
        if (resIn) resIn.placeholder = 'e.g., Executive Committee / Lead';
      } else {
        if (titleLbl) titleLbl.textContent = '1. Competition / Activity';
        if (titleIn) titleIn.placeholder = 'e.g., National Physics Olympiad';
        if (resLbl) resLbl.textContent = '3. Results / Position';
        if (resIn) resIn.placeholder = 'e.g., Gold Medal / 1st Place';
      }
    }

    async function fetchAndRenderPortfolioLogs() {
      const { data, error } = await supabaseClient
        .from('portfolio_logs')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('portfolio_logs fetch note:', error.message);
      }

      globalPortfolioLogs = data || [];
      renderPortfolioTables();
    }

    function renderPortfolioTables() {
      const container = document.getElementById('portfolio-tables-container');
      if (!container) return;
      container.innerHTML = '';

      const isOwner = Boolean(currentUser);

      ['COMPETITION', 'POSITION'].forEach(catKey => {
        const meta = PORTFOLIO_CATEGORY_META[catKey];
        const catRows = globalPortfolioLogs.filter(r => r.category === catKey);
        const tableDomId = `portfolio-table-${catKey.toLowerCase()}`;

        const rowsHtml = catRows.length === 0
          ? `
            <tr>
              <td colspan="${isOwner ? 5 : 4}" class="text-center py-8 text-[#56735f] font-mono-tech text-xs">
                ${meta.emptyMsg}
              </td>
            </tr>
          `
          : catRows.map((row, idx) => {
              const rowClass = row.row_style === 'THRESHOLD'
                ? 'run-row-threshold'
                : row.row_style === 'EASY'
                  ? 'run-row-easy'
                  : '';

              if (isOwner && editingPortfolioId === row.id) {
                return `
                  <tr class="bg-[#eff8f2]">
                    <td colspan="5" class="p-2.5 sm:p-3">
                      <div class="font-mono-tech text-[10px] uppercase text-[#047857] font-bold mb-2">Edit EDITING ${meta.title} ENTRY</div>
                      <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div class="sm:col-span-2">
                          <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-port-title-${row.id}">${meta.col1Header}</label>
                          <input type="text" id="edit-port-title-${row.id}" value="${escapeHtml(row.title || '')}" class="tech-input !py-1.5 !px-2 !text-xs">
                        </div>
                        <div>
                          <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-port-date-${row.id}">${meta.col2Header}</label>
                          <input type="text" id="edit-port-date-${row.id}" value="${escapeHtml(row.date_str || '')}" placeholder="14/5/2026 or Mar – Aug 2026" class="tech-input !py-1.5 !px-2 !text-xs">
                        </div>
                        <div>
                          <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-port-result-${row.id}">${meta.col3Header}</label>
                          <input type="text" id="edit-port-result-${row.id}" value="${escapeHtml(row.result_str || '')}" class="tech-input !py-1.5 !px-2 !text-xs">
                        </div>
                      </div>
                      <div class="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 border-t border-[#c5ded0]">
                        <div class="flex items-center gap-2">
                          <label class="font-mono-tech text-[9px] uppercase text-[#436152]" for="edit-port-style-${row.id}">Highlight:</label>
                          <select id="edit-port-style-${row.id}" class="tech-input !py-1 !px-2 !text-xs !w-32">
                            <option value="STANDARD" ${(row.row_style || 'STANDARD') === 'STANDARD' ? 'selected' : ''}>Standard (White)</option>
                            <option value="THRESHOLD" ${row.row_style === 'THRESHOLD' ? 'selected' : ''}>Highlight (Yellow)</option>
                            <option value="EASY" ${row.row_style === 'EASY' ? 'selected' : ''}>Verified (Green)</option>
                          </select>
                        </div>
                        <div class="flex items-center gap-2">
                          <button type="button" onclick="cancelEditPortfolioRow()" class="btn-tech-outline !py-1 !px-3 !text-xs">Cancel</button>
                          <button type="button" onclick="saveEditedPortfolioRow('${row.id}')" class="btn-chamfer !py-1 !px-3.5 !text-xs">Save Changes</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                `;
              }

              return `
                <tr class="${rowClass}">
                  <td class="text-center font-semibold border-r border-[#c5ded0]/60 w-8 sm:w-10 align-middle">${idx + 1}</td>
                  <td class="font-bold border-r border-[#c5ded0]/60 break-words align-middle py-2">
                    <div class="text-xs sm:text-sm leading-snug">${escapeHtml(row.title || '')}</div>
                    <!-- Mobile-only stacked date badge so columns never squish on phones -->
                    <div class="sm:hidden mt-1">
                      <span class="tech-badge badge-neutral !text-[9px] !py-0 !px-1.5"> ${escapeHtml(row.date_str || '')}</span>
                    </div>
                  </td>
                  <td class="hidden sm:table-cell text-center font-semibold border-r border-[#c5ded0]/60 break-words align-middle">${escapeHtml(row.date_str || '')}</td>
                  <td class="font-semibold break-words align-middle text-[11px] sm:text-xs">${escapeHtml(row.result_str || '')}</td>
                  ${isOwner ? `
                    <td class="text-center sm:text-right align-middle p-1 sm:p-2">
                      <div class="grid grid-cols-2 sm:inline-flex items-center gap-1 w-fit mx-auto sm:mx-0">
                        <button type="button" onclick="movePortfolioRow('${catKey}', '${row.id}', -1)" ${idx === 0 ? 'disabled' : ''} class="touch-action-btn !min-w-[24px] !min-h-[24px] !px-1 disabled:opacity-30" title="Move row up">▲</button>
                        <button type="button" onclick="movePortfolioRow('${catKey}', '${row.id}', 1)" ${idx === catRows.length - 1 ? 'disabled' : ''} class="touch-action-btn !min-w-[24px] !min-h-[24px] !px-1 disabled:opacity-30" title="Move row down">▼</button>
                        <button type="button" onclick="startEditPortfolioRow('${row.id}')" class="touch-action-btn !min-w-[24px] !min-h-[24px] !px-1" title="Edit row">Edit</button>
                        <button type="button" onclick="deletePortfolioRow('${row.id}')" class="touch-action-btn danger !min-w-[24px] !min-h-[24px] !px-1" title="Delete row">×</button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('');

        const tableWrap = document.createElement('div');
        tableWrap.className = 'border border-[#87b39b] bg-white overflow-hidden max-w-full flex flex-col justify-between';

        tableWrap.innerHTML = `
          <div>
            <!-- Spreadsheet-Style Technical Banner -->
            <div class="bg-[#d5e6dc] text-center font-mono-tech text-xs font-bold uppercase tracking-widest py-1 border-b border-[#87b39b] text-[#0c1f17]">
              ${meta.bannerTop}
            </div>
            <div class="bg-[#e8f3ec] text-center font-mono-tech text-xs font-bold uppercase tracking-wider py-1 border-b border-[#87b39b] text-[#047857]">
              ${meta.title} (${catRows.length})
            </div>
            <div class="w-full overflow-x-auto">
              <table id="${tableDomId}" class="tech-table w-full">
                <thead>
                  <tr class="bg-[#f4faf6]">
                    <th class="!text-center w-8 sm:w-12 border-r border-[#c5ded0]">#</th>
                    <th class="w-auto border-r border-[#c5ded0]">${meta.col1Header}</th>
                    <th class="hidden sm:table-cell !text-center w-36 border-r border-[#c5ded0]">${meta.col2Header}</th>
                    <th class="w-[34%] sm:w-44 border-r border-[#c5ded0]">${meta.col3Header}</th>
                    ${isOwner ? `<th data-no-export="true" class="!text-center sm:!text-right w-[62px] sm:w-28">ACT</th>` : ''}
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </div>
          <div class="table-export-bar px-3 pb-2">
            <span>EXPORT ${meta.title}:</span>
            <div class="flex flex-wrap items-center gap-1">
              <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'portfolio-${catKey.toLowerCase()}', 'csv')" class="btn-export-tag">↓ CSV</button>
              <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'portfolio-${catKey.toLowerCase()}', 'md')" class="btn-export-tag">↓ MD</button>
              <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'portfolio-${catKey.toLowerCase()}', 'json')" class="btn-export-tag">↓ JSON</button>
              <button type="button" onclick="exportHtmlTableData('${tableDomId}', 'portfolio-${catKey.toLowerCase()}', 'copy')" class="btn-export-tag">⎘ COPY MD</button>
            </div>
          </div>
        `;

        container.appendChild(tableWrap);
      });
    }

    onReady('add-portfolio-form', 'submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to log entries.', true);

      const category = document.getElementById('portfolio-category-input').value;
      const title = document.getElementById('portfolio-title-input').value.trim();
      const dateStr = document.getElementById('portfolio-date-input').value.trim();
      const resultStr = document.getElementById('portfolio-result-input').value.trim();
      const rowStyle = document.getElementById('portfolio-style-input').value;

      if (!title || !dateStr || !resultStr) return;

      const existingCatRows = globalPortfolioLogs.filter(r => r.category === category);
      const nextSortOrder = existingCatRows.length > 0
        ? Math.max(...existingCatRows.map(r => Number(r.sort_order) || 0)) + 1
        : 1;

      const { error } = await supabaseClient
        .from('portfolio_logs')
        .insert({
          category,
          title,
          date_str: dateStr,
          result_str: resultStr,
          row_style: rowStyle,
          sort_order: nextSortOrder
        });

      if (error) {
        showToast('DATABASE ERROR', error.message, true);
      } else {
        document.getElementById('portfolio-title-input').value = '';
        document.getElementById('portfolio-date-input').value = '';
        document.getElementById('portfolio-result-input').value = '';
        showToast('RECORD LOGGED', `Added "${title}" to ${category === 'POSITION' ? 'Positions' : 'Competitions & Activities'}.`);
        fetchAndRenderPortfolioLogs();
      }
    });

    function startEditPortfolioRow(rowId) {
      if (!currentUser) return;
      editingPortfolioId = rowId;
      renderPortfolioTables();
    }

    function cancelEditPortfolioRow() {
      editingPortfolioId = null;
      renderPortfolioTables();
    }

    async function saveEditedPortfolioRow(rowId) {
      if (!currentUser) return;
      const newTitle = document.getElementById(`edit-port-title-${rowId}`)?.value.trim();
      const newDate = document.getElementById(`edit-port-date-${rowId}`)?.value.trim();
      const newResult = document.getElementById(`edit-port-result-${rowId}`)?.value.trim();
      const newStyle = document.getElementById(`edit-port-style-${rowId}`)?.value || 'STANDARD';

      if (!newTitle || !newDate || !newResult) return;

      const { error } = await supabaseClient
        .from('portfolio_logs')
        .update({
          title: newTitle,
          date_str: newDate,
          result_str: newResult,
          row_style: newStyle
        })
        .eq('id', rowId);

      editingPortfolioId = null;
      if (error) {
        showToast('UPDATE ERROR', error.message, true);
      } else {
        showToast('RECORD UPDATED', `Updated "${newTitle}".`);
        fetchAndRenderPortfolioLogs();
      }
    }

    async function movePortfolioRow(catKey, rowId, delta) {
      if (!currentUser) return;
      const catRows = globalPortfolioLogs.filter(r => r.category === catKey);
      const idx = catRows.findIndex(r => r.id === rowId);
      if (idx === -1) return;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= catRows.length) return;

      // Swap items in array and reassign sequential sort_order
      const reordered = catRows.slice();
      const temp = reordered[idx];
      reordered[idx] = reordered[targetIdx];
      reordered[targetIdx] = temp;

      await Promise.all(
        reordered.map((r, i) =>
          supabaseClient.from('portfolio_logs').update({ sort_order: i + 1 }).eq('id', r.id)
        )
      );
      fetchAndRenderPortfolioLogs();
    }

    function deletePortfolioRow(rowId) {
      if (!currentUser) return;
      const target = globalPortfolioLogs.find(r => r.id === rowId);
      confirmAction(
        `Delete "${target ? target.title : 'this entry'}"?`,
        'This will permanently remove this record from Supabase.',
        async () => {
          const { error } = await supabaseClient
            .from('portfolio_logs')
            .delete()
            .eq('id', rowId);

          if (error) showToast('DELETE ERROR', error.message, true);
          else {
            showToast('RECORD DELETED', 'Removed entry from ledger.', false, () => restoreDeletedRow('portfolio_logs', target, fetchAndRenderPortfolioLogs));
            fetchAndRenderPortfolioLogs();
          }
        }
      );
    }

    // ==========================================
    // 10C. FOCUS MODE TELEMETRY & EXECUTION VIEW
    // ==========================================
    function saveFocusDirective(val) {
      try {
        localStorage.setItem('autumn_focus_directive', val || '');
      } catch (e) {}
    }

    // updated function

    function renderFocusMode() {
      const now = new Date();
      const todayStr = getLocalDateString(now);
      const isOwner = Boolean(currentUser);

      // Restore saved primary directive input
      const dirInput = document.getElementById('focus-directive-input');
      if (dirInput && document.activeElement !== dirInput) {
        try {
          dirInput.value = localStorage.getItem('autumn_focus_directive') || '';
        } catch (e) {}
      }

      // 1. Today's Study Telemetry
      const activeStudyRows = typeof getPhaseActiveRows === 'function'
        ? getPhaseActiveRows(globalStudyRows)
        : globalStudyRows;
      const todayStudyRow = activeStudyRows.find(r => r.date === todayStr);
      const studyBaseGoal = getStudyBaseGoalForDate(todayStr);
      const studyActual = todayStudyRow ? (Number(todayStudyRow.actual_hours) || 0) : 0;
      let studyTarget = studyBaseGoal;
      if (todayStudyRow) {
        studyTarget = Number(todayStudyRow.computed_target) || studyBaseGoal;
      } else if (activeStudyRows.length > 0) {
        const lastS = activeStudyRows[activeStudyRows.length - 1];
        studyTarget = Math.min(MAX_DAILY, Math.max(0, studyBaseGoal + (Number(lastS.computed_overflow) || 0)));
      }
      const studyPct = studyTarget > 0 ? Math.min(100, (studyActual / studyTarget) * 100) : 100;
      const studyRem = Math.max(0, studyTarget - studyActual);

      const elStudyAct = document.getElementById('focus-study-actual');
      const elStudyTgt = document.getElementById('focus-study-target');
      const elStudySt = document.getElementById('focus-study-status');
      const elStudyBar = document.getElementById('focus-study-bar');
      if (elStudyAct) elStudyAct.textContent = formatHours(studyActual);
      if (elStudyTgt) elStudyTgt.textContent = formatHours(studyTarget);
      if (elStudySt) {
        elStudySt.textContent = studyRem <= 0
          ? `QUOTA CLEARED (+${formatHours(studyActual - studyTarget)})`
          : `${formatHours(studyRem)} remaining today`;
      }
      if (elStudyBar) elStudyBar.style.width = `${studyPct}%`;

      // 2. Today's Steps Telemetry
      const activeStepsRows = typeof getPhaseActiveRows === 'function'
        ? getPhaseActiveRows(globalStepsRows)
        : globalStepsRows;
      const todayStepsRow = activeStepsRows.find(r => r.date === todayStr);
      const stepsBaseGoal = getStepsBaseGoalForDate(todayStr);
      const stepsActual = todayStepsRow ? (Number(todayStepsRow.actual_steps) || 0) : 0;
      let stepsTarget = stepsBaseGoal;
      if (todayStepsRow) {
        stepsTarget = Number(todayStepsRow.computed_target) || stepsBaseGoal;
      } else if (activeStepsRows.length > 0) {
        const lastSt = activeStepsRows[activeStepsRows.length - 1];
        stepsTarget = Math.min(STEPS_MAX_DAILY, Math.max(0, stepsBaseGoal + (Number(lastSt.computed_overflow) || 0)));
      }
      const stepsPct = stepsTarget > 0 ? Math.min(100, (stepsActual / stepsTarget) * 100) : 100;
      const stepsRem = Math.max(0, stepsTarget - stepsActual);

      const elStepsAct = document.getElementById('focus-steps-actual');
      const elStepsTgt = document.getElementById('focus-steps-target');
      const elStepsSt = document.getElementById('focus-steps-status');
      const elStepsBar = document.getElementById('focus-steps-bar');
      if (elStepsAct) elStepsAct.textContent = formatSteps(stepsActual);
      if (elStepsTgt) elStepsTgt.textContent = formatSteps(stepsTarget);
      if (elStepsSt) {
        elStepsSt.textContent = stepsRem <= 0
          ? `STEP QUOTA CLEARED`
          : `${formatSteps(stepsRem)} steps remaining`;
      }
      if (elStepsBar) elStepsBar.style.width = `${stepsPct}%`;

      // 3. Active Tasks & 5K PR Benchmark
      const totalTasks = globalTaskItems.length;
      const doneTasks = globalTaskItems.filter(t => t.is_done).length;
      const pendingTasksCount = Math.max(0, totalTasks - doneTasks);
      const tasksPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

      const fiveKRuns = globalRunningLogs
        .filter(r => r.category === '5k' && r.run_type !== 'REFERENCE')
        .slice()
        .sort((a, b) => parsePaceToSeconds(a.pace_str) - parsePaceToSeconds(b.pace_str));
      const best5kPace = fiveKRuns.length > 0 ? `${normalizePaceDisplay(fiveKRuns[0].pace_str)}/km` : '--:--/km';

      const elTasksPend = document.getElementById('focus-tasks-pending');
      const elTasksSub = document.getElementById('focus-tasks-sub');
      const elTasksBar = document.getElementById('focus-tasks-bar');
      if (elTasksPend) elTasksPend.textContent = String(pendingTasksCount);
      if (elTasksSub) elTasksSub.textContent = `${doneTasks}/${totalTasks} done · 5K PR: ${best5kPace}`;
      if (elTasksBar) elTasksBar.style.width = `${tasksPct}%`;

      // 4. Overall Readiness & Live Operational Yield Grade Badge
      const overallCompletion = (studyPct * 0.5) + (stepsPct * 0.3) + (tasksPct * 0.2);
      const todayYieldInfo = typeof computeDailyOperationalYield === 'function'
        ? computeDailyOperationalYield(todayStr)
        : { score: 0, grade: 'D', standing: 'FAIL' };
      const readyBadge = document.getElementById('focus-readiness-badge');
      if (readyBadge) {
        readyBadge.textContent = `DAILY COMPLETION: ${overallCompletion.toFixed(0)}% · YIELD: ${todayYieldInfo.score} PTS [${todayYieldInfo.grade}]`;
        readyBadge.className = `tech-badge ${
          todayYieldInfo.score > 100 ? 'badge-green' :
          todayYieldInfo.score >= 95 ? 'badge-blue' :
          todayYieldInfo.score >= 85 ? 'badge-purple' :
          todayYieldInfo.score >= 60 ? 'badge-amber' : 'badge-neutral'
        }`;
      }

      const iconSvg = (name) => (window.autumnIcons && window.autumnIcons.svg(name)) || '';

      // 4b. Compact Next-Class UM 3D Atlas Commute Bar
      const focusCommuteHost = document.getElementById('focus-um-commute-strip');
      if (focusCommuteHost && window.umAtlas && typeof window.umAtlas.resolveEventUmTelemetry === 'function') {
        const upcomingUm = (globalCalendarEvents || [])
          .filter(ev => ev && ev.end instanceof Date && ev.end > now)
          .slice()
          .sort((a, b) => a.start - b.start)
          .map(ev => ({ ev, info: window.umAtlas.resolveEventUmTelemetry(ev, now) }))
          .find(x => Boolean(x.info));

        if (!upcomingUm) {
          focusCommuteHost.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 w-full text-xs">
              <div class="flex flex-wrap items-center gap-2 min-w-0">
                <span class="tech-badge badge-neutral">${iconSvg('walk')}<span>NEXT CAMPUS COMMUTE</span></span>
                <span class="text-[#436152]">No upcoming class with a UM campus destination right now.</span>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                <button type="button" onclick="window.umAtlas.requestUserCampusGps(true)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]">
                  ${iconSvg('gps')}<span>Refresh GPS</span>
                </button>
                <a href="https://um-3d-atlas.netlify.app" target="_blank" rel="noopener noreferrer" class="um-atlas-route-btn">
                  ${iconSvg('ext')}<span>UM 3D ATLAS</span>
                </a>
              </div>
            </div>
          `;
        } else {
          const { ev, info } = upcomingUm;
          const startStr = ev.start instanceof Date
            ? ev.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '--:--';
          const isTodayEv = ev.start instanceof Date && ev.start.toDateString() === now.toDateString();
          const dayPrefix = isTodayEv ? 'TODAY' : ev.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
          const urgCls = info.urgency === 'urgent' ? 'leave-urgent' : info.urgency === 'soon' ? 'leave-soon' : '';
          focusCommuteHost.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 w-full">
              <div class="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                <span class="tech-badge badge-green shrink-0">${iconSvg('walk')}<span>NEXT COMMUTE</span></span>
                <button type="button" onclick="openEventDetails('${jsAttrQuote(ev.id)}')" class="text-xs text-[#0c1f17] hover:text-[#047857] truncate max-w-full sm:max-w-[300px] text-left">
                  <span>${escapeHtml(ev.title)}</span>
                  <span class="text-[#56735f] ml-1 tnum">(${dayPrefix} ${startStr})</span>
                </button>
                <span class="um-atlas-chip ${urgCls} max-w-full">
                  ${iconSvg('pin')}<span>${escapeHtml(info.displayDestLabel)}</span>
                  <span>·</span>
                  ${iconSvg('walk')}<span class="tnum">${info.walkMins}m (${escapeHtml(info.distanceFormatted)})</span>
                  <span>·</span>
                  <span class="tnum">${escapeHtml(info.leaveStatusLabel)}</span>
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                <button type="button" onclick="window.umAtlas.requestUserCampusGps(true)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]">
                  ${iconSvg('gps')}<span>From: ${escapeHtml(info.originInfo.label)}</span>
                </button>
                <a href="${escapeHtml(info.deepLinkUrl)}" target="_blank" rel="noopener noreferrer" class="um-atlas-route-btn">
                  ${iconSvg('route')}<span>3D ROUTE</span>
                </a>
              </div>
            </div>
          `;
        }
      }

      // 5. Today's Calendar Schedule List (with Priority Colours & Linked Tasks)
      const calListEl = document.getElementById('focus-calendar-list');
      const calSubEl = document.getElementById('focus-cal-subtitle');
      const todayEvents = globalCalendarEvents.filter(ev => ev.dateStr === todayStr);
      if (calSubEl) {
        calSubEl.textContent = `${todayEvents.length} event${todayEvents.length === 1 ? '' : 's'} scheduled for ${todayStr}`;
      }
      if (calListEl) {
        if (todayEvents.length === 0) {
          calListEl.innerHTML = `<div class="p-6 tech-grid-bg border border-[#c5ded0] text-center font-mono-tech text-xs text-[#56735f]">No calendar events scheduled for today. Clear runway for deep study.</div>`;
        } else {
          calListEl.innerHTML = todayEvents.map(ev => {
            const th = typeof getEventPriorityTheme === 'function'
              ? getEventPriorityTheme(ev)
              : { accent: '#059669', bg: '#dcfce7', meta: '#047857' };
            return `
              <div onclick="openEventDetails('${jsAttrQuote(ev.id)}')" style="border-left: 2px solid ${th.accent}; background-color: ${th.bg}50;" class="p-3 border border-[#c5ded0] flex items-start justify-between gap-2 cursor-pointer hover:bg-[#f9fdfb] min-w-0">
                <div class="min-w-0 flex-1">
                  <div class="font-mono-tech text-[11px] tnum" style="color:${th.meta};">${formatEventTimeSpan(ev)}</div>
                  <div class="text-xs sm:text-sm text-[#0c1f17] break-words mt-0.5">${escapeHtml(ev.title)}</div>
                  ${ev.location ? `<div class="font-mono-tech text-[10px] text-[#436152] truncate mt-0.5 inline-flex items-center gap-1 max-w-full">${iconSvg('pin')}<span>${escapeHtml(ev.location)}</span></div>` : ''}
                  ${typeof buildEventLinkedTasksPillsHtml === 'function' ? buildEventLinkedTasksPillsHtml(ev.id, true) : ''}
                  ${window.umAtlas ? window.umAtlas.buildEventUmWalkInlineHtml(ev, true) : ''}
                </div>
                <div class="shrink-0 flex flex-col items-end gap-1">
                  ${getEventStatusBadge(ev, now)}
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // 6. Active Tasks Queue (with Deadlines, Sub-Checklists & Linked Calendar Event Badges)
      const tasksListEl = document.getElementById('focus-tasks-list');
      if (tasksListEl) {
        const activeCols = globalTaskColumns.filter(c => !c.is_done);
        const pendingCardsHtml = [];

        activeCols.forEach(col => {
          const pendingTasks = sortTaskItemsForColumn(
            col.id,
            globalTaskItems.filter(t => t.column_id === col.id && !t.is_done)
          );
          if (pendingTasks.length === 0) return;

          let badgeClass = 'badge-green';
          if (col.category === 'COMPETITION') badgeClass = 'badge-blue';
          if (col.category === 'OTHER') badgeClass = 'badge-amber';

          pendingCardsHtml.push(`
            <div class="border border-[#c5ded0] bg-white p-3 flex flex-col gap-2 min-w-0">
              <div class="flex items-center justify-between gap-1 border-b border-[#e8f3ec] pb-1.5">
                <span class="text-xs text-[#0c1f17] truncate">${escapeHtml(col.title)}</span>
                <span class="tech-badge ${badgeClass} !text-[9px]">${escapeHtml(col.category)}</span>
              </div>
              <div class="flex flex-col gap-1.5">
                ${pendingTasks.slice(0, 6).map(task => {
                  const isInProg = getTaskProgressState(task.id) === 'IN-PROGRESS';
                  const meta = typeof getTaskMeta === 'function' ? getTaskMeta(task.id) : { dueDate: '', eventId: '' };
                  const dueInfo = meta.dueDate && typeof evaluateTaskDeadline === 'function'
                    ? evaluateTaskDeadline(meta.dueDate)
                    : null;
                  const linkedEv = meta.eventId ? globalCalendarEvents.find(e => e.id === meta.eventId) : null;
                  const subItems = (window.tasksPower && typeof window.tasksPower.getTaskSubchecklist === 'function')
                    ? window.tasksPower.getTaskSubchecklist(task.id)
                    : [];
                  const subDone = subItems.filter(i => i.done).length;
                  const urgentClass = dueInfo && dueInfo.diffDays <= 1
                    ? 'bg-[#fee2e2]/45 border-l-2 border-l-[#dc2626]'
                    : dueInfo && dueInfo.diffDays <= 3
                      ? 'bg-[#fef3c7]/50 border-l-2 border-l-[#f59e0b]'
                      : isInProg
                        ? 'bg-[#fef3c7]/50 border-l-2 border-l-[#f59e0b]'
                        : '';

                  return `
                    <div class="flex items-start justify-between gap-2 p-1.5 ${urgentClass} font-mono-tech text-xs text-[#0c1f17] min-w-0">
                      <div class="flex items-start gap-2 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          ${!isOwner ? 'disabled' : ''}
                          onchange="toggleTaskItem('${task.id}', this.checked)"
                          class="tech-checkbox mt-0.5 shrink-0"
                        />
                        <div class="min-w-0 flex-1">
                          <div class="break-words leading-snug">${getTaskParentId(task) ? '<span class="font-mono-tech text-[10px] text-[#56735f]">— </span>' : ''}${escapeHtml(task.title)}</div>
                          <div class="flex flex-wrap items-center gap-1 mt-1">
                            ${dueInfo ? `<span class="tech-badge ${dueInfo.badgeClass} !text-[8px] !py-0 !px-1">${escapeHtml(dueInfo.label)}</span>` : ''}
                            ${subItems.length > 0 ? `<span class="tech-badge ${subDone === subItems.length ? 'badge-green' : 'badge-blue'} !text-[8px] !py-0 !px-1 inline-flex items-center gap-0.5 tnum">${iconSvg('checkbox')}<span>${subDone}/${subItems.length}</span></span>` : ''}
                            ${linkedEv ? `<button type="button" onclick="openEventDetails('${jsAttrQuote(linkedEv.id)}')" class="tech-badge badge-blue !text-[8px] !py-0 !px-1 cursor-pointer truncate max-w-[155px] inline-flex items-center gap-0.5" title="Inspect linked event: ${escapeHtml(linkedEv.title)}">${iconSvg('calendar')}<span class="truncate">${escapeHtml(linkedEv.title)}</span></button>` : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onclick="toggleTaskProgressState('${task.id}', event)"
                        class="task-status-pill shrink-0 ${isInProg ? 'in-progress' : ''}"
                      >${isInProg ? 'IN-PROG' : 'QUEUED'}</button>
                    </div>
                  `;
                }).join('')}
                ${pendingTasks.length > 6 ? `<div class="font-mono-tech text-[10px] text-[#56735f]">+${pendingTasks.length - 6} more in matrix...</div>` : ''}
              </div>
            </div>
          `);
        });

        if (pendingCardsHtml.length === 0) {
          tasksListEl.innerHTML = `<div class="md:col-span-2 p-6 tech-grid-bg border border-[#c5ded0] text-center font-mono-tech text-xs text-[#047857]">All active tasks completed!</div>`;
        } else {
          tasksListEl.innerHTML = pendingCardsHtml.join('');
        }
      }

      // 7. Recurring Habits & Routines Queue (Current Cycle)
      const habitsListEl = document.getElementById('focus-habits-list');
      const habitsSumEl = document.getElementById('focus-habits-summary');
      if (habitsListEl && typeof isHabitActiveToday === 'function') {
        const activeHabits = (globalHabits || []).filter(h => isHabitActiveToday(h, now));
        const doneHabits = activeHabits.filter(h => isHabitCheckedInCurrentCycle(h, now));
        if (habitsSumEl) {
          habitsSumEl.textContent = `${doneHabits.length} / ${activeHabits.length} COMPLETED`;
        }
        if (activeHabits.length === 0) {
          habitsListEl.innerHTML = `<div class="sm:col-span-2 font-mono-tech text-xs text-[#56735f] py-2">No recurring habits active for today.</div>`;
        } else {
          habitsListEl.innerHTML = activeHabits.map(h => {
            const isChecked = isHabitCheckedInCurrentCycle(h, now);
            return `
              <label class="flex items-center justify-between gap-2 p-2 border border-[#c5ded0] ${isChecked ? 'bg-[#f0fdf4]' : 'bg-white'} font-mono-tech text-xs cursor-pointer">
                <div class="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    ${isChecked ? 'checked' : ''}
                    ${!isOwner ? 'disabled' : ''}
                    onchange="toggleHabitCheck('${h.id}', this.checked)"
                    class="tech-checkbox shrink-0"
                  />
                  <span class="truncate ${isChecked ? 'line-through text-[#56735f]' : 'text-[#0c1f17]'}">${escapeHtml(h.title)}</span>
                </div>
                <span class="text-[10px] text-[#047857] shrink-0 tnum">${Number(h.streak_count) || 0}d streak</span>
              </label>
            `;
          }).join('');
        }
      }

      // 8. Weekly / Daily Journal Snapshot
      const journalPreviewEl = document.getElementById('focus-journal-preview');
      if (journalPreviewEl) {
        const wkKey = typeof getWeekMondayDateString === 'function' ? getWeekMondayDateString(todayStr) : todayStr;
        const matchedNote = globalNotes.find(n => n.date === wkKey) || globalNotes.find(n => n.date === todayStr) || globalNotes[0];
        if (matchedNote && (matchedNote.title || matchedNote.content)) {
          const cleanText = stripHtmlTags(matchedNote.content || '');
          journalPreviewEl.innerHTML = `
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-[#0c1f17]">${escapeHtml(matchedNote.title || 'Weekly Operational Log')}</span>
              <span class="tech-badge badge-green !text-[9px]">${escapeHtml(matchedNote.date)}</span>
            </div>
            <div class="text-xs text-[#436152] line-clamp-3 break-words">${escapeHtml(cleanText || 'No text content yet.')}</div>
          `;
        } else {
          journalPreviewEl.textContent = 'No journal entry recorded for this week yet.';
        }
      }

      // 9. 3-Day Quota Horizon Table
      const horizonEl = document.getElementById('focus-horizon-table');
      if (horizonEl) {
        let sOverflow = activeStudyRows.length > 0 ? (Number(activeStudyRows[activeStudyRows.length - 1].computed_overflow) || 0) : 0;
        let stOverflow = activeStepsRows.length > 0 ? (Number(activeStepsRows[activeStepsRows.length - 1].computed_overflow) || 0) : 0;
        let rowsHtml = '';

        for (let i = 0; i < 3; i++) {
          const d = new Date(now);
          d.setDate(now.getDate() + i);
          const dStr = getLocalDateString(d);
          const sBase = getStudyBaseGoalForDate(d);
          const stBase = getStepsBaseGoalForDate(d);

          const sTgt = Math.min(MAX_DAILY, Math.max(0, sBase + sOverflow));
          sOverflow = (sBase + sOverflow) - sTgt;

          const stTgt = Math.min(STEPS_MAX_DAILY, Math.max(0, stBase + stOverflow));
          stOverflow = (stBase + stOverflow) - stTgt;

          const label = i === 0 ? 'TODAY' : i === 1 ? 'TOMORROW' : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
          rowsHtml += `
            <tr>
              <td>${label} <span class="text-[#56735f]">(${dStr.slice(5)})</span></td>
              <td class="text-right text-[#047857] tnum">${formatHours(sTgt)}</td>
              <td class="text-right text-[#0369a1] tnum">${formatSteps(stTgt)}</td>
            </tr>
          `;
        }

        horizonEl.innerHTML = `
          <table class="tech-table">
            <thead>
              <tr>
                <th>Day</th>
                <th class="text-right">Study Quota</th>
                <th class="text-right">Step Quota</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }
    }

    // legacy function

    // function renderFocusMode() {
    //   const todayStr = getLocalDateString(new Date());
    //   const isOwner = Boolean(currentUser);

    //   // 1. Study Target & Progress Today (7h Weekday / 5h Weekend)
    //   const todayStudyRow = globalStudyRows.find(r => r.date === todayStr);
    //   const todayStudyBase = getStudyBaseGoalForDate(todayStr);
    //   let studyTarget = todayStudyBase;
    //   let studyOverflow = 0;
    //   if (todayStudyRow) {
    //     studyTarget = todayStudyRow.computed_target;
    //     studyOverflow = todayStudyRow.computed_overflow;
    //   } else if (globalStudyRows.length > 0) {
    //     const lastRow = globalStudyRows[globalStudyRows.length - 1];
    //     studyTarget = Math.min(todayStudyBase + lastRow.computed_overflow, MAX_DAILY);
    //     studyOverflow = lastRow.computed_overflow;
    //   }
    //   const studyActual = todayStudyRow ? todayStudyRow.actual_hours : 0;
    //   const studyPct = studyTarget > 0 ? Math.min(100, (studyActual / studyTarget) * 100) : 100;
    //   const studyRem = Math.max(0, studyTarget - studyActual);

    //   const elStudyAct = document.getElementById('focus-study-actual');
    //   const elStudyTgt = document.getElementById('focus-study-target');
    //   const elStudySt = document.getElementById('focus-study-status');
    //   const elStudyBar = document.getElementById('focus-study-bar');
    //   if (elStudyAct) elStudyAct.textContent = formatHours(studyActual);
    //   if (elStudyTgt) elStudyTgt.textContent = `${studyTarget.toFixed(1)}h`;
    //   if (elStudySt) {
    //     const debtTag = studyOverflow > 0 ? `DEBT +${formatHours(studyOverflow)}` : studyOverflow < 0 ? `SURPLUS ${formatHours(studyOverflow)}` : 'ON TRACK';
    //     elStudySt.textContent = studyRem > 0 ? `${formatHours(studyRem)} left today // ${debtTag}` : `QUOTA MET // ${debtTag}`;
    //   }
    //   if (elStudyBar) elStudyBar.style.width = `${studyPct.toFixed(1)}%`;

    //   // 2. Steps Target & Progress Today (10,000 Weekday / 7,000 Weekend)
    //   const todayStepsRow = globalStepsRows.find(r => r.date === todayStr);
    //   const todayStepsBase = getStepsBaseGoalForDate(todayStr);
    //   let stepsTarget = todayStepsBase;
    //   let stepsOverflow = 0;
    //   if (todayStepsRow) {
    //     stepsTarget = todayStepsRow.computed_target;
    //     stepsOverflow = todayStepsRow.computed_overflow;
    //   } else if (globalStepsRows.length > 0) {
    //     const lastRow = globalStepsRows[globalStepsRows.length - 1];
    //     stepsTarget = Math.min(todayStepsBase + lastRow.computed_overflow, STEPS_MAX_DAILY);
    //     stepsOverflow = lastRow.computed_overflow;
    //   }
    //   const stepsActual = todayStepsRow ? todayStepsRow.actual_steps : 0;
    //   const stepsPct = stepsTarget > 0 ? Math.min(100, (stepsActual / stepsTarget) * 100) : 100;
    //   const stepsRem = Math.max(0, stepsTarget - stepsActual);

    //   const elStepsAct = document.getElementById('focus-steps-actual');
    //   const elStepsTgt = document.getElementById('focus-steps-target');
    //   const elStepsSt = document.getElementById('focus-steps-status');
    //   const elStepsBar = document.getElementById('focus-steps-bar');
    //   if (elStepsAct) elStepsAct.textContent = formatSteps(stepsActual);
    //   if (elStepsTgt) elStepsTgt.textContent = formatSteps(stepsTarget);
    //   if (elStepsSt) {
    //     const debtTag = stepsOverflow > 0 ? `DEBT +${formatSteps(stepsOverflow)}` : stepsOverflow < 0 ? `SURPLUS ${formatSteps(stepsOverflow)}` : 'ON TRACK';
    //     elStepsSt.textContent = stepsRem > 0 ? `${formatSteps(stepsRem)} left // ${debtTag}` : `QUOTA MET // ${debtTag}`;
    //   }
    //   if (elStepsBar) elStepsBar.style.width = `${stepsPct.toFixed(1)}%`;

    //   // 3. Active Tasks, Recurring Habits & 5K PR Benchmark
    //   const now = new Date();
    //   const activeCols = globalTaskColumns.filter(c => !c.is_done);
    //   const activeColIds = new Set(activeCols.map(c => c.id));
    //   const relevantTasks = globalTaskItems.filter(t => activeColIds.has(t.column_id));
    //   const pendingTasks = relevantTasks.filter(t => !t.is_done);
    //   const doneTasksCount = globalTaskItems.filter(t => t.is_done).length;
    //   const totalTasksCount = globalTaskItems.length;

    //   const activeHabitsToday = globalHabits.filter(h => isHabitActiveToday(h, now));
    //   const doneHabitsToday = activeHabitsToday.filter(h => isHabitCheckedInCurrentCycle(h, now));
    //   const pendingHabitsCount = activeHabitsToday.length - doneHabitsToday.length;

    //   const combinedTotal = totalTasksCount + activeHabitsToday.length;
    //   const combinedDone = doneTasksCount + doneHabitsToday.length;
    //   const tasksPct = combinedTotal > 0 ? (combinedDone / combinedTotal) * 100 : 100;

    //   const fiveKRuns = globalRunningLogs
    //     .filter(r => r.category === '5k' && r.run_type !== 'REFERENCE')
    //     .sort((a, b) => parsePaceToSeconds(a.pace_str) - parsePaceToSeconds(b.pace_str));
    //   const best5kPace = fiveKRuns.length > 0 ? `${normalizePaceDisplay(fiveKRuns[0].pace_str)}/km` : '--:--/km';

    //   const elTasksPend = document.getElementById('focus-tasks-pending');
    //   const elTasksSub = document.getElementById('focus-tasks-sub');
    //   const elTasksBar = document.getElementById('focus-tasks-bar');
    //   if (elTasksPend) elTasksPend.textContent = pendingTasks.length + pendingHabitsCount;
    //   if (elTasksSub) {
    //     elTasksSub.textContent = `${doneTasksCount}/${totalTasksCount} tasks • ${doneHabitsToday.length}/${activeHabitsToday.length} habits • 5K: ${best5kPace}`;
    //   }
    //   if (elTasksBar) elTasksBar.style.width = `${tasksPct.toFixed(1)}%`;

    //   // Overall Daily Completion Score Badge
    //   const overallScore = Math.round((studyPct + stepsPct + tasksPct) / 3);
    //   const readinessBadge = document.getElementById('focus-readiness-badge');
    //   if (readinessBadge) {
    //     readinessBadge.textContent = `DAILY COMPLETION: ${overallScore}%`;
    //     readinessBadge.className = `tech-badge ${overallScore >= 75 ? 'badge-green' : overallScore >= 40 ? 'badge-blue' : 'badge-amber'}`;
    //   }

    //   // 4. Today's Calendar Events List
    //   const focusCalList = document.getElementById('focus-calendar-list');
    //   const focusCalSub = document.getElementById('focus-cal-subtitle');
    //   if (focusCalList) {
    //     const todayEvents = globalCalendarEvents.filter(ev => ev.dateStr === todayStr);
    //     if (focusCalSub) {
    //       focusCalSub.textContent = `${todayEvents.length} event${todayEvents.length === 1 ? '' : 's'} scheduled for ${todayStr}`;
    //     }

    //     if (todayEvents.length === 0) {
    //       const nextUpcoming = globalCalendarEvents.find(ev => ev.start > now);
    //       focusCalList.innerHTML = `
    //         <div class="p-4 tech-grid-bg border border-[#c5ded0] text-center font-mono-tech text-xs text-[#56735f]">
    //           <div>No calendar events scheduled for today.</div>
    //           ${nextUpcoming ? `
    //             <div class="mt-2 pt-2 border-t border-[#c5ded0] text-[#0c1f17]">
    //               <span class="text-[#047857] font-bold">NEXT UPCOMING:</span> ${escapeHtml(nextUpcoming.title)} (${nextUpcoming.dateStr} • ${formatEventTimeSpan(nextUpcoming)})
    //             </div>
    //           ` : ''}
    //         </div>
    //       `;
    //     } else {
    //       focusCalList.innerHTML = todayEvents.map(ev => {
    //         const th = getEventPriorityTheme(ev);
    //         return `
    //           <div onclick="openEventDetails('${jsAttrQuote(ev.id)}')" style="border-left: 4px solid ${th.accent};" class="p-3 border border-[#c5ded0] bg-white hover:border-[#059669] cursor-pointer transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-2 min-w-0">
    //             <div class="min-w-0 flex-1">
    //               <div class="font-mono-tech text-[11px] font-bold" style="color:${th.meta};">${formatEventTimeSpan(ev)}</div>
    //               <div class="font-bold text-sm text-[#0c1f17] break-words mt-0.5 leading-snug">${escapeHtml(ev.title)}</div>
    //               ${ev.location ? `<div class="font-mono-tech text-[11px] text-[#436152] break-words mt-0.5"> ${escapeHtml(ev.location)}</div>` : ''}
    //             </div>
    //             <div class="flex flex-wrap items-center gap-1 shrink-0">
    //               ${getEventStatusBadge(ev, now)}
    //             </div>
    //           </div>
    //         `;
    //       }).join('');
    //     }
    //   }

    //   // 5. Active Tasks Queue (Grouped by Active Column, with IN-PROGRESS tasks prioritized first)
    //   const focusTasksList = document.getElementById('focus-tasks-list');
    //   if (focusTasksList) {
    //     const colsWithPending = activeCols.filter(col =>
    //       globalTaskItems.some(t => t.column_id === col.id && !t.is_done)
    //     );

    //     if (colsWithPending.length === 0) {
    //       focusTasksList.innerHTML = `
    //         <div class="md:col-span-2 p-6 tech-grid-bg border border-[#c5ded0] text-center font-mono-tech text-xs text-[#56735f]">
    //           All active tasks are completed. Great job!
    //         </div>
    //       `;
    //     } else {
    //       focusTasksList.innerHTML = colsWithPending.map(col => {
    //         const items = sortTaskItemsForColumn(
    //           col.id,
    //           globalTaskItems.filter(t => t.column_id === col.id && !t.is_done)
    //         ).slice().sort((a, b) => {
    //           const sA = getTaskProgressState(a.id) === 'IN-PROGRESS' ? 0 : 1;
    //           const sB = getTaskProgressState(b.id) === 'IN-PROGRESS' ? 0 : 1;
    //           return sA - sB;
    //         });

    //         let badgeClass = 'badge-green';
    //         if (col.category === 'COMPETITION') badgeClass = 'badge-blue';
    //         if (col.category === 'OTHER') badgeClass = 'badge-amber';

    //         return `
    //           <div class="border border-[#c5ded0] bg-white flex flex-col min-w-0">
    //             <div class="px-3 py-2 bg-[#eff8f2] border-b border-[#c5ded0] flex items-center justify-between gap-2">
    //               <span class="font-bold text-xs text-[#0c1f17] truncate">${escapeHtml(col.title)}</span>
    //               <span class="tech-badge ${badgeClass} !text-[9px] !py-0.5 !px-1.5">${escapeHtml(col.category)}</span>
    //             </div>
    //             <div class="divide-y divide-[#e8f3ec] p-1.5">
    //               ${items.map(task => {
    //                 const isInProg = getTaskProgressState(task.id) === 'IN-PROGRESS';
    //                 return `
    //                   <div class="flex items-start justify-between gap-2 p-1.5 ${isInProg ? 'bg-[#fef3c7]/45' : 'hover:bg-[#f4faf6]'}">
    //                     <label class="flex items-start gap-2.5 cursor-pointer select-none min-w-0 flex-1">
    //                       <input type="checkbox"
    //                         ${!isOwner ? 'disabled' : ''}
    //                         onchange="toggleTaskItem('${task.id}', this.checked)"
    //                         class="tech-checkbox mt-0.5 shrink-0"
    //                       />
    //                       <span class="font-mono-tech text-xs text-[#0c1f17] break-words leading-snug">${escapeHtml(task.title)}</span>
    //                     </label>
    //                     <button
    //                       type="button"
    //                       onclick="toggleTaskProgressState('${task.id}', event)"
    //                       class="task-status-pill shrink-0 ${isInProg ? 'in-progress' : ''}"
    //                     >
    //                       <span class="w-1.5 h-1.5 rounded-full ${isInProg ? 'bg-[#d97706] pulse-live' : 'bg-[#718f80]'}"></span>
    //                       <span>${isInProg ? 'IN-PROG' : 'QUEUED'}</span>
    //                     </button>
    //                   </div>
    //                 `;
    //               }).join('')}
    //             </div>
    //           </div>
    //         `;
    //       }).join('');
    //     }
    //   }

    //   // 5B. Recurring Habits Queue in Focus Mode
    //   const focusHabitsList = document.getElementById('focus-habits-list');
    //   const focusHabitsSummary = document.getElementById('focus-habits-summary');
    //   if (focusHabitsSummary) {
    //     focusHabitsSummary.textContent = `${doneHabitsToday.length} / ${activeHabitsToday.length} COMPLETED`;
    //   }
    //   if (focusHabitsList) {
    //     if (activeHabitsToday.length === 0) {
    //       focusHabitsList.innerHTML = `
    //         <div class="sm:col-span-2 p-3 tech-grid-bg border border-[#c5ded0] text-center font-mono-tech text-xs text-[#56735f]">
    //           No recurring habits scheduled for today.
    //         </div>
    //       `;
    //     } else {
    //       focusHabitsList.innerHTML = activeHabitsToday.map(habit => {
    //         const checked = isHabitCheckedInCurrentCycle(habit, now);
    //         const freqKey = (habit.frequency || 'DAILY').toUpperCase();
    //         const meta = HABIT_FREQ_META[freqKey] || HABIT_FREQ_META.DAILY;
    //         return `
    //           <label class="p-2.5 border ${checked ? 'border-[#86efac] bg-[#f0fdf4]' : 'border-[#c5ded0] bg-white hover:border-[#059669]'} flex items-center justify-between gap-2 cursor-pointer select-none transition-colors">
    //             <div class="flex items-center gap-2.5 min-w-0">
    //               <input
    //                 type="checkbox"
    //                 ${checked ? 'checked' : ''}
    //                 ${!isOwner ? 'disabled' : ''}
    //                 onchange="toggleHabitCheck('${habit.id}', this.checked)"
    //                 class="tech-checkbox shrink-0"
    //               />
    //               <div class="min-w-0">
    //                 <div class="font-mono-tech text-xs font-semibold truncate ${checked ? 'line-through text-[#56735f]' : 'text-[#0c1f17]'}">
    //                   ${escapeHtml(habit.title)}
    //                 </div>
    //                 ${habit.notes ? `<div class="font-mono-tech text-[10px] text-[#436152] truncate">${escapeHtml(habit.notes)}</div>` : ''}
    //               </div>
    //             </div>
    //             <div class="flex items-center gap-1.5 shrink-0">
    //               <span class="tech-badge ${meta.badge} !text-[9px] !py-0 !px-1.5">${escapeHtml(freqKey)}</span>
    //               <span class="font-mono-tech text-[10px] font-bold text-[#047857]">${Number(habit.streak_count) || 0}</span>
    //             </div>
    //           </label>
    //         `;
    //       }).join('');
    //     }
    //   }

    //   // 6. Today's Journal Snapshot
    //   const journalPreviewEl = document.getElementById('focus-journal-preview');
    //   if (journalPreviewEl) {
    //     const todayNote = globalNotes.find(n => n.date === todayStr);
    //     if (todayNote) {
    //       const snippet = stripHtmlTags(todayNote.content || '');
    //       journalPreviewEl.innerHTML = `
    //         <div class="flex items-center justify-between gap-2 mb-1">
    //           <span class="font-bold text-[#0c1f17]">${escapeHtml(todayNote.title || 'Untitled Daily Log')}</span>
    //           <span class="tech-badge badge-green">${escapeHtml(todayNote.mood || 'OPTIMAL')}</span>
    //         </div>
    //         <div class="text-xs text-[#436152] line-clamp-2 break-words">${escapeHtml(snippet || 'No body text recorded.')}</div>
    //       `;
    //     } else {
    //       journalPreviewEl.innerHTML = `
    //         <div class="flex items-center justify-between gap-2">
    //           <span>No journal entry logged for <strong>${todayStr}</strong> yet.</span>
    //           <button type="button" onclick="selectJournalDate('${todayStr}'); switchTab('notes');" class="text-[#047857] font-bold hover:underline">Write Today's Log →</button>
    //         </div>
    //       `;
    //     }
    //   }

    //   // 7. 3-Day Quota Horizon Table
    //   const horizonEl = document.getElementById('focus-horizon-table');
    //   if (horizonEl) {
    //     let sOver = globalStudyRows.length > 0 ? globalStudyRows[globalStudyRows.length - 1].computed_overflow : 0;
    //     let stOver = globalStepsRows.length > 0 ? globalStepsRows[globalStepsRows.length - 1].computed_overflow : 0;
    //     const baseDate = new Date();
    //     const rowsHtml = [];

    //     for (let i = 0; i < 3; i++) {
    //       const d = new Date(baseDate);
    //       d.setDate(baseDate.getDate() + i);
    //       const dStr = getLocalDateString(d);
    //       const label = i === 0 ? 'TODAY' : i === 1 ? 'TOMORROW' : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

    //       const sUncapped = getStudyBaseGoalForDate(d) + sOver;
    //       const sTarget = Math.min(sUncapped, MAX_DAILY);
    //       sOver = sUncapped - sTarget;

    //       const stUncapped = getStepsBaseGoalForDate(d) + stOver;
    //       const stTarget = Math.min(stUncapped, STEPS_MAX_DAILY);
    //       stOver = stUncapped - stTarget;

    //       rowsHtml.push(`
    //         <tr>
    //           <td class="font-semibold">${label} <span class="text-[#56735f]">(${dStr.slice(5)})</span></td>
    //           <td class="text-right font-bold text-[#047857]">${sTarget.toFixed(1)}h</td>
    //           <td class="text-right font-bold text-[#0369a1]">${formatSteps(stTarget)}</td>
    //         </tr>
    //       `);
    //     }

    //     horizonEl.innerHTML = `
    //       <table id="focus-horizon-tech-table" class="tech-table">
    //         <thead>
    //           <tr>
    //             <th>Day</th>
    //             <th class="!text-right">Study Quota</th>
    //             <th class="!text-right">Step Quota</th>
    //           </tr>
    //         </thead>
    //         <tbody>${rowsHtml.join('')}</tbody>
    //       </table>
    //       <div class="table-export-bar">
    //         <span>EXPORT HORIZON:</span>
    //         <div class="flex flex-wrap items-center gap-1">
    //           <button type="button" onclick="exportHtmlTableData('focus-horizon-tech-table', 'focus-3day-horizon', 'csv')" class="btn-export-tag">↓ CSV</button>
    //           <button type="button" onclick="exportHtmlTableData('focus-horizon-tech-table', 'focus-3day-horizon', 'md')" class="btn-export-tag">↓ MD</button>
    //           <button type="button" onclick="exportHtmlTableData('focus-horizon-tech-table', 'focus-3day-horizon', 'json')" class="btn-export-tag">↓ JSON</button>
    //           <button type="button" onclick="exportHtmlTableData('focus-horizon-tech-table', 'focus-3day-horizon', 'copy')" class="btn-export-tag">⎘ COPY</button>
    //         </div>
    //       </div>
    //     `;
    //   }
    // }



    // ==========================================
    // 10C-2. UNIVERSAL DATA TABLE EXPORT ENGINE (CSV / MD / JSON / TSV / CLIPBOARD)
    // ==========================================
    function extractCleanCellText(cellEl) {
      if (!cellEl) return '';
      const clone = cellEl.cloneNode(true);
      // Remove mobile-only duplicate spans when a desktop span is present
      clone.querySelectorAll('.sm\\:hidden').forEach(el => el.remove());
      return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function exportHtmlTableData(tableId, filenameBase, format = 'csv') {
      const tableEl = document.getElementById(tableId);
      if (!tableEl) return showToast('EXPORT ERROR', 'Table element not found.', true);

      const headerCells = Array.from(tableEl.querySelectorAll('thead th'));
      const includeColIndices = [];
      const headers = [];

      headerCells.forEach((th, idx) => {
        if (th.getAttribute('data-no-export') === 'true' || th.textContent.trim() === 'ACT') return;
        includeColIndices.push(idx);
        headers.push(extractCleanCellText(th));
      });

      const bodyRows = Array.from(tableEl.querySelectorAll('tbody tr'));
      const dataRows = [];

      bodyRows.forEach(tr => {
        const tds = Array.from(tr.querySelectorAll('td'));
        // Skip empty-state colspan message rows
        if (tds.length === 1 && tds[0].hasAttribute('colspan')) return;
        if (tds.length === 0) return;
        const rowValues = includeColIndices.map(colIdx => extractCleanCellText(tds[colIdx]));
        dataRows.push(rowValues);
      });

      if (dataRows.length === 0) {
        return showToast('EMPTY TABLE', 'No recorded rows available to export yet.', true);
      }

      const dateStamp = getLocalDateString(new Date());
      const fullFilename = `${filenameBase}-${dateStamp}`;

      // Build Markdown format
      const buildMarkdown = () => {
        const mdHeader = `| ${headers.map(h => h.replace(/\|/g, '\\|')).join(' | ')} |`;
        const mdDivider = `| ${headers.map(() => '---').join(' | ')} |`;
        const mdBody = dataRows.map(r => `| ${r.map(c => String(c).replace(/\|/g, '\\|')).join(' | ')} |`).join('\n');
        return `${mdHeader}\n${mdDivider}\n${mdBody}\n`;
      };

      if (format === 'copy') {
        const mdText = buildMarkdown();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(mdText).then(() => {
            showToast('COPIED TO CLIPBOARD', `Copied ${dataRows.length} row(s) as Markdown table.`);
          });
        } else {
          showToast('CLIPBOARD NOTICE', 'Browser blocked clipboard access; use ↓ MD instead.', true);
        }
        return;
      }

      let outputContent = '';
      let mimeType = 'text/plain;charset=utf-8;';
      let ext = format;

      if (format === 'csv') {
        const escapeCsv = (val) => `"${String(val).replace(/"/g, '""')}"`;
        outputContent = [
          headers.map(escapeCsv).join(','),
          ...dataRows.map(r => r.map(escapeCsv).join(','))
        ].join('\r\n');
        mimeType = 'text/csv;charset=utf-8;';
      } else if (format === 'tsv') {
        outputContent = [
          headers.join('\t'),
          ...dataRows.map(r => r.join('\t'))
        ].join('\r\n');
        mimeType = 'text/tab-separated-values;charset=utf-8;';
      } else if (format === 'md') {
        outputContent = buildMarkdown();
        mimeType = 'text/markdown;charset=utf-8;';
      } else if (format === 'json') {
        const jsonArr = dataRows.map(r => {
          const obj = {};
          headers.forEach((h, i) => { obj[h || `col_${i + 1}`] = r[i]; });
          return obj;
        });
        outputContent = JSON.stringify(jsonArr, null, 2);
        mimeType = 'application/json;charset=utf-8;';
      }

      const blob = new Blob([outputContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fullFilename}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('EXPORT COMPLETE', `Downloaded ${fullFilename}.${ext} (${dataRows.length} rows).`);
    }

    // Helper: Trigger file download for any text/markdown/json/html/csv payload
    function triggerFileDownload(content, filename, mimeType = 'text/plain;charset=utf-8;') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // Helper: Convert rich HTML content from Daily Journal / General Notes into clean Markdown
    function richHtmlToMarkdown(htmlStr) {
      if (!htmlStr) return '';
      let md = String(htmlStr)
        .replace(/<\s*(b|strong)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '**$2**')
        .replace(/<\s*(i|em)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '*$2*')
        .replace(/<\s*(s|strike|del)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '~~$2~~')
        .replace(/<\s*li\b[^>]*>([\s\S]*?)<\s*\/\s*li\s*>/gi, '- $1\n')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|ul|ol|h[1-6])>/gi, '\n');
      const tmp = document.createElement('div');
      tmp.innerHTML = md;
      return (tmp.textContent || tmp.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    }

    // 1. Export Currently Open Daily Journal Entry
    function exportCurrentJournalEntry(format = 'md') {
      const dateStr = selectedNoteDate || getLocalDateString(new Date());
      const title = document.getElementById('note-title-input')?.value.trim() || `Daily Journal (${dateStr})`;
      const mood = document.getElementById('note-mood-input')?.value || 'OPTIMAL';
      const rawHtml = document.getElementById('note-content-editor')?.innerHTML.trim() || '';
      const mdBody = richHtmlToMarkdown(rawHtml);
      const plainBody = htmlToPlainTerminalText(rawHtml);

      if (!rawHtml && !document.getElementById('note-title-input')?.value.trim()) {
        return showToast('EMPTY JOURNAL', `No content to export for ${dateStr}.`, true);
      }

      const mdDocument = `# ${title}\n- **Date:** ${dateStr}\n- **Status:** ${mood}\n\n---\n\n${mdBody}\n`;

      if (format === 'copy') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(mdDocument).then(() => {
            showToast('JOURNAL COPIED', `Copied ${dateStr} journal entry as Markdown.`);
          });
        }
        return;
      }

      const baseName = `journal-${dateStr}`;
      if (format === 'md') {
        triggerFileDownload(mdDocument, `${baseName}.md`, 'text/markdown;charset=utf-8;');
      } else if (format === 'txt') {
        const txtDoc = `${title.toUpperCase()}\nDate: ${dateStr} | Status: ${mood}\n${'='.repeat(40)}\n\n${plainBody}\n`;
        triggerFileDownload(txtDoc, `${baseName}.txt`, 'text/plain;charset=utf-8;');
      } else if (format === 'html') {
        const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:2rem auto;line-height:1.6;"><h1>${escapeHtml(title)}</h1><p><strong>Date:</strong> ${escapeHtml(dateStr)} | <strong>Status:</strong> ${escapeHtml(mood)}</p><hr><div>${rawHtml}</div></body></html>`;
        triggerFileDownload(htmlDoc, `${baseName}.html`, 'text/html;charset=utf-8;');
      } else if (format === 'json') {
        const jsonDoc = JSON.stringify({ date: dateStr, title, mood, markdown: mdBody, html: rawHtml }, null, 2);
        triggerFileDownload(jsonDoc, `${baseName}.json`, 'application/json;charset=utf-8;');
      }
      showToast('JOURNAL EXPORTED', `Downloaded ${baseName}.${format}`);
    }

    // 2. Export All Recorded Daily Journal Entries
    function exportAllJournalEntries(format = 'md') {
      if (!globalNotes || globalNotes.length === 0) {
        return showToast('NO JOURNAL LOGS', 'No archived daily journal entries to export yet.', true);
      }
      const stamp = getLocalDateString(new Date());
      const baseName = `all-daily-journals-${stamp}`;

      if (format === 'md') {
        const mdAll = globalNotes.map(n => {
          const t = n.title || 'Untitled Daily Log';
          const body = richHtmlToMarkdown(n.content || '');
          return `## ${n.date} — ${t} [${n.mood || 'OPTIMAL'}]\n\n${body}\n`;
        }).join('\n---\n\n');
        triggerFileDownload(`# Daily Journal Archive (${globalNotes.length} Entries)\n\n${mdAll}`, `${baseName}.md`, 'text/markdown;charset=utf-8;');
      } else if (format === 'txt') {
        const txtAll = globalNotes.map(n => {
          const t = n.title || 'Untitled Daily Log';
          const body = htmlToPlainTerminalText(n.content || '');
          return `[${n.date}] ${t} (${n.mood || 'OPTIMAL'})\n${'-'.repeat(40)}\n${body}\n`;
        }).join('\n========================================\n\n');
        triggerFileDownload(txtAll, `${baseName}.txt`, 'text/plain;charset=utf-8;');
      } else if (format === 'csv') {
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = [
          ['Date', 'Title', 'Status', 'Content'].map(esc).join(','),
          ...globalNotes.map(n => [n.date, n.title || '', n.mood || 'OPTIMAL', htmlToPlainTerminalText(n.content || '')].map(esc).join(','))
        ].join('\r\n');
        triggerFileDownload(rows, `${baseName}.csv`, 'text/csv;charset=utf-8;');
      } else if (format === 'json') {
        const payload = globalNotes.map(n => ({
          date: n.date,
          title: n.title || '',
          mood: n.mood || 'OPTIMAL',
          content_markdown: richHtmlToMarkdown(n.content || ''),
          content_html: n.content || '',
          updated_at: n.updated_at || null
        }));
        triggerFileDownload(JSON.stringify(payload, null, 2), `${baseName}.json`, 'application/json;charset=utf-8;');
      }
      showToast('ARCHIVE EXPORTED', `Downloaded ${globalNotes.length} journal entries as .${format}`);
    }

    // 3. Export Currently Open General Note
    function exportCurrentGeneralNote(format = 'md') {
      const title = document.getElementById('gen-note-title-input')?.value.trim() || 'Untitled General Note';
      const category = document.getElementById('gen-note-category-input')?.value || 'GENERAL';
      const rawHtml = document.getElementById('gen-note-content-editor')?.innerHTML.trim() || '';
      const mdBody = richHtmlToMarkdown(rawHtml);
      const plainBody = htmlToPlainTerminalText(rawHtml);

      if (!rawHtml && !document.getElementById('gen-note-title-input')?.value.trim()) {
        return showToast('EMPTY NOTE', 'Select or write a general note before exporting.', true);
      }

      const safeSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general-note';
      const mdDocument = `# ${title}\n- **Category:** ${category}\n\n---\n\n${mdBody}\n`;

      if (format === 'copy') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(mdDocument).then(() => {
            showToast('GENERAL NOTE COPIED', `Copied "${title}" as Markdown.`);
          });
        }
        return;
      }

      if (format === 'md') {
        triggerFileDownload(mdDocument, `${safeSlug}.md`, 'text/markdown;charset=utf-8;');
      } else if (format === 'txt') {
        const txtDoc = `${title.toUpperCase()}\nCategory: ${category}\n${'='.repeat(40)}\n\n${plainBody}\n`;
        triggerFileDownload(txtDoc, `${safeSlug}.txt`, 'text/plain;charset=utf-8;');
      } else if (format === 'html') {
        const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:2rem auto;line-height:1.6;"><h1>${escapeHtml(title)}</h1><p><strong>Category:</strong> ${escapeHtml(category)}</p><hr><div>${rawHtml}</div></body></html>`;
        triggerFileDownload(htmlDoc, `${safeSlug}.html`, 'text/html;charset=utf-8;');
      } else if (format === 'json') {
        const jsonDoc = JSON.stringify({ title, category, markdown: mdBody, html: rawHtml }, null, 2);
        triggerFileDownload(jsonDoc, `${safeSlug}.json`, 'application/json;charset=utf-8;');
      }
      showToast('NOTE EXPORTED', `Downloaded ${safeSlug}.${format}`);
    }

    // 4. Export All Saved General Notes
    function exportAllGeneralNotes(format = 'md') {
      if (!globalGeneralNotes || globalGeneralNotes.length === 0) {
        return showToast('NO GENERAL NOTES', 'No saved general notes to export yet.', true);
      }
      const stamp = getLocalDateString(new Date());
      const baseName = `all-general-notes-${stamp}`;

      if (format === 'md') {
        const mdAll = globalGeneralNotes.map(n => {
          const t = n.title || 'Untitled General Note';
          const body = richHtmlToMarkdown(n.content || '');
          return `## ${t} [${n.category || 'GENERAL'}]\n\n${body}\n`;
        }).join('\n---\n\n');
        triggerFileDownload(`# General Notes Archive (${globalGeneralNotes.length} Notes)\n\n${mdAll}`, `${baseName}.md`, 'text/markdown;charset=utf-8;');
      } else if (format === 'txt') {
        const txtAll = globalGeneralNotes.map(n => {
          const t = n.title || 'Untitled General Note';
          const body = htmlToPlainTerminalText(n.content || '');
          return `${t} [${n.category || 'GENERAL'}]\n${'-'.repeat(40)}\n${body}\n`;
        }).join('\n========================================\n\n');
        triggerFileDownload(txtAll, `${baseName}.txt`, 'text/plain;charset=utf-8;');
      } else if (format === 'csv') {
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = [
          ['Title', 'Category', 'Updated At', 'Content'].map(esc).join(','),
          ...globalGeneralNotes.map(n => [n.title || '', n.category || 'GENERAL', n.updated_at || '', htmlToPlainTerminalText(n.content || '')].map(esc).join(','))
        ].join('\r\n');
        triggerFileDownload(rows, `${baseName}.csv`, 'text/csv;charset=utf-8;');
      } else if (format === 'json') {
        const payload = globalGeneralNotes.map(n => ({
          id: n.id,
          title: n.title || '',
          category: n.category || 'GENERAL',
          content_markdown: richHtmlToMarkdown(n.content || ''),
          content_html: n.content || '',
          updated_at: n.updated_at || null
        }));
        triggerFileDownload(JSON.stringify(payload, null, 2), `${baseName}.json`, 'application/json;charset=utf-8;');
      }
      showToast('NOTES ARCHIVE EXPORTED', `Downloaded ${globalGeneralNotes.length} general notes as .${format}`);
    }

    // 5. Export Tasks Matrix (Subjects / Competitions / Other)
    function exportTasksMatrixData(format = 'md') {
      if (!globalTaskColumns || globalTaskColumns.length === 0) {
        return showToast('EMPTY MATRIX', 'No task columns to export yet.', true);
      }
      const stamp = getLocalDateString(new Date());
      const baseName = `tasks-matrix-${stamp}`;

      // Flattens a column's tree into { task, depth } rows in board order, so every export
      // format can indent subtasks instead of flattening them into the parent's level.
      const flattenColumnTasks = (colId) => {
        const out = [];
        const walk = (list, depth, ancestry) => {
          list.forEach((task) => {
            if (ancestry.indexOf(task.id) !== -1) return;
            out.push({ task, depth });
            walk(getChildTasks(colId, task.id), depth + 1, ancestry.concat(task.id));
          });
        };
        walk(getRootTasks(colId), 0, []);
        return out;
      };

      const buildTasksMd = () => globalTaskColumns.map(col => {
        const rows = flattenColumnTasks(col.id);
        const lines = rows.length === 0
          ? '_No tasks_'
          : rows.map(({ task, depth }) => '  '.repeat(depth) + `- [${task.is_done ? 'x' : ' '}] ${task.title}`).join('\n');
        return `### ${col.title} [${col.category}]${col.is_done ? ' (COMPLETED)' : ''}\n${lines}\n`;
      }).join('\n');

      if (format === 'copy') {
        const md = `# Subject & Competition Task Matrix\n\n${buildTasksMd()}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(md).then(() => {
            showToast('TASKS COPIED', 'Copied Task Matrix as Markdown checklist.');
          });
        }
        return;
      }

      if (format === 'md') {
        triggerFileDownload(`# Subject & Competition Task Matrix\n\n${buildTasksMd()}`, `${baseName}.md`, 'text/markdown;charset=utf-8;');
      } else if (format === 'csv') {
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csvRows = [['Column', 'Category', 'Column Done', 'Task', 'Task Done', 'Parent', 'Depth'].map(esc).join(',')];
        globalTaskColumns.forEach(col => {
          const rows = flattenColumnTasks(col.id);
          if (rows.length === 0) {
            csvRows.push([col.title, col.category, col.is_done ? 'YES' : 'NO', '', '', '', ''].map(esc).join(','));
          } else {
            rows.forEach(({ task, depth }) => {
              const parentTask = getTaskParentId(task) ? getTaskById(getTaskParentId(task)) : null;
              csvRows.push([
                col.title, col.category, col.is_done ? 'YES' : 'NO', task.title,
                task.is_done ? 'YES' : 'NO', parentTask ? parentTask.title : '', String(depth)
              ].map(esc).join(','));
            });
          }
        });
        triggerFileDownload(csvRows.join('\r\n'), `${baseName}.csv`, 'text/csv;charset=utf-8;');
      } else if (format === 'json') {
        const nestForJson = (colId, parentId) => getChildTasks(colId, parentId).map(t => ({
          title: t.title,
          is_done: Boolean(t.is_done),
          subtasks: nestForJson(colId, t.id)
        }));
        const payload = globalTaskColumns.map(col => ({
          title: col.title,
          category: col.category,
          is_done: Boolean(col.is_done),
          tasks: nestForJson(col.id, '')
        }));
        triggerFileDownload(JSON.stringify(payload, null, 2), `${baseName}.json`, 'application/json;charset=utf-8;');
      }
      showToast('TASKS EXPORTED', `Downloaded ${baseName}.${format}`);
    }

    // Automatically reflow Timeline columns & Padlet Masonry lanes when resizing viewport
    let layoutResizeTimer = null;
    let lastMasonryWidthBucket = window.innerWidth >= 1280 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    window.addEventListener('resize', () => {
      if (layoutResizeTimer) clearTimeout(layoutResizeTimer);
      layoutResizeTimer = setTimeout(() => {
        if (activeTabName === 'calendar' && currentCalViewMode === 'timeline') {
          renderCalendarViewport();
        }
        const currentBucket = window.innerWidth >= 1280 ? 3 : window.innerWidth >= 768 ? 2 : 1;
        if (currentBucket !== lastMasonryWidthBucket) {
          lastMasonryWidthBucket = currentBucket;
          renderTasksBoard();
        }
      }, 180);
    });

    // ==========================================
    // 10D. GLOBAL COMMAND SEARCH BAR & DROPDOWN
    // ==========================================
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
              category: `DRIVE // ${getDriveFileTypeLabel(file.mimeType)}`,
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
            const doneNow = isHabitCheckedInCurrentCycle(habit);
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
      if (!dropdownOpen || !latestSearchMatches || latestSearchMatches.length === 0) return;
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
    // 10E. PERSISTENT TERMINAL DRAWER (AUTO-SAVED DAILY SPECIAL GENERAL NOTE)
    // ==========================================
    let isTerminalDrawerOpen = false;
    let terminalSaveTimeout = null;
    let isSavingTerminalNote = false;
    let pendingTerminalSave = false;

    function getTodayTerminalNoteTitle() {
      const todayStr = getLocalDateString(new Date());
      return `TERMINAL SCRATCHPAD // ${todayStr}`;
    }

    function getTodayTerminalLocalCacheKey() {
      const todayStr = getLocalDateString(new Date());
      return `autumn_terminal_scratchpad_${todayStr}`;
    }

    function htmlToPlainTerminalText(htmlStr) {
      if (!htmlStr) return '';
      const temp = document.createElement('div');
      let normalized = String(htmlStr)
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n');
      temp.innerHTML = normalized;
      return (temp.textContent || temp.innerText || '').replace(/\n{3,}/g, '\n\n').trimEnd();
    }

    function plainTerminalTextToHtml(plainStr) {
      if (!plainStr) return '';
      return escapeHtml(plainStr).replace(/\r?\n/g, '<br>');
    }

    function findTodayTerminalGeneralNote() {
      const expectedTitle = getTodayTerminalNoteTitle();
      return globalGeneralNotes.find(
        n => n.title === expectedTitle || (n.category === 'TERMINAL' && n.title === expectedTitle)
      );
    }

    function toggleTerminalDrawer(focusInput = false) {
      const bodyEl = document.getElementById('terminal-drawer-body');
      const chevronEl = document.getElementById('terminal-chevron');
      if (!bodyEl) return;

      isTerminalDrawerOpen = !isTerminalDrawerOpen;
      const drawerToggleEl = document.getElementById('terminal-toggle-btn');
      if (drawerToggleEl) drawerToggleEl.setAttribute('aria-expanded', isTerminalDrawerOpen ? 'true' : 'false');
      if (isTerminalDrawerOpen) {
        bodyEl.classList.remove('hidden');
        if (chevronEl) chevronEl.textContent = '▼';
        syncTerminalDrawerFromGeneralNotes();
        if (focusInput) {
          setTimeout(() => {
            const quickIn = document.getElementById('terminal-quick-input');
            if (quickIn) quickIn.focus();
          }, 50);
        }
      } else {
        bodyEl.classList.add('hidden');
        if (chevronEl) chevronEl.textContent = '▲';
      }
    }

    function updateTerminalWordCount() {
      const textarea = document.getElementById('terminal-scratchpad-textarea');
      const countEl = document.getElementById('terminal-word-count');
      if (!textarea || !countEl) return;
      const text = textarea.value.trim();
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      countEl.textContent = `${words} word${words === 1 ? '' : 's'}`;
    }

    function updateTerminalAuthUI() {
      const todayStr = getLocalDateString(new Date());
      const datePill = document.getElementById('terminal-date-pill');
      const titleLabel = document.getElementById('terminal-note-title-label');
      const authHint = document.getElementById('terminal-auth-hint');
      const syncLabel = document.getElementById('terminal-sync-label');

      if (datePill) datePill.textContent = todayStr;
      if (titleLabel) titleLabel.textContent = getTodayTerminalNoteTitle();

      if (currentUser) {
        if (authHint) authHint.textContent = `Auto-saves to General Notes (${todayStr})`;
        if (syncLabel) syncLabel.textContent = 'AUTO-SYNC // READY';
        // If there was a local draft typed before signing in, sync it up
        const localDraft = localStorage.getItem(getTodayTerminalLocalCacheKey());
        const existingNote = findTodayTerminalGeneralNote();
        if (localDraft && !existingNote) {
          const textarea = document.getElementById('terminal-scratchpad-textarea');
          if (textarea && !textarea.value.trim()) {
            textarea.value = localDraft;
          }
          flushTerminalToGeneralNote(false);
        }
      } else {
        if (authHint) authHint.textContent = ' Guest mode: saved locally (Sign in to sync to DB)';
        if (syncLabel) syncLabel.textContent = 'LOCAL DRAFT';
      }
    }

    function syncTerminalDrawerFromGeneralNotes() {
      const textarea = document.getElementById('terminal-scratchpad-textarea');
      if (!textarea) return;

      updateTerminalAuthUI();
      const todayNote = findTodayTerminalGeneralNote();

      // Avoid overwriting while the user is actively typing in the textarea
      if (document.activeElement === textarea && pendingTerminalSave) return;

      if (todayNote) {
        textarea.value = htmlToPlainTerminalText(todayNote.content || '');
      } else {
        const localDraft = localStorage.getItem(getTodayTerminalLocalCacheKey());
        textarea.value = localDraft || '';
      }
      updateTerminalWordCount();
    }

    function setTerminalSyncStatus(stateText, colorHex = '#6ee7b7') {
      const syncLabel = document.getElementById('terminal-sync-label');
      if (syncLabel) {
        syncLabel.textContent = stateText;
        syncLabel.style.color = colorHex;
      }
      // BUGFIX: there are TWO status dots (header bar + drawer sub-header) and they used to
      // share one id, so only the first was ever updated. Both are driven now.
      document.querySelectorAll('#terminal-status-dot, #terminal-status-dot-drawer').forEach((dot) => {
        dot.style.backgroundColor = colorHex;
      });
    }

    function handleTerminalBufferInput() {
      updateTerminalWordCount();
      const textarea = document.getElementById('terminal-scratchpad-textarea');
      if (!textarea) return;

      // Always keep a local browser backup for today
      try {
        localStorage.setItem(getTodayTerminalLocalCacheKey(), textarea.value);
      } catch (e) {}

      pendingTerminalSave = true;
      setTerminalSyncStatus('TYPING...', '#fcd34d');

      if (terminalSaveTimeout) clearTimeout(terminalSaveTimeout);
      terminalSaveTimeout = setTimeout(() => {
        flushTerminalToGeneralNote(false);
      }, 750);
    }

    function handleTerminalQuickAppend(e) {
      e.preventDefault();
      const quickInput = document.getElementById('terminal-quick-input');
      const textarea = document.getElementById('terminal-scratchpad-textarea');
      if (!quickInput || !textarea) return;

      const thought = quickInput.value.trim();
      if (!thought) return;

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const stampedLine = `[${hh}:${mm}] • ${thought}`;

      const currentVal = textarea.value.trimEnd();
      textarea.value = currentVal ? `${currentVal}\n${stampedLine}` : stampedLine;
      quickInput.value = '';

      // Scroll textarea to bottom so the newly appended line is visible
      textarea.scrollTop = textarea.scrollHeight;
      updateTerminalWordCount();

      try {
        localStorage.setItem(getTodayTerminalLocalCacheKey(), textarea.value);
      } catch (err) {}

      flushTerminalToGeneralNote(false);
    }

    function insertTerminalTimestamp() {
      const textarea = document.getElementById('terminal-scratchpad-textarea');
      if (!textarea) return;
      const now = new Date();
      const stamp = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}] `;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const prefix = start > 0 && textarea.value[start - 1] !== '\n' ? '\n' : '';
      textarea.value = textarea.value.slice(0, start) + prefix + stamp + textarea.value.slice(end);
      textarea.focus();
      const newCursor = start + prefix.length + stamp.length;
      textarea.setSelectionRange(newCursor, newCursor);
      handleTerminalBufferInput();
    }

    async function flushTerminalToGeneralNote(showManualToast = false) {
      if (terminalSaveTimeout) {
        clearTimeout(terminalSaveTimeout);
        terminalSaveTimeout = null;
      }

      const textarea = document.getElementById('terminal-scratchpad-textarea');
      if (!textarea) return;

      const plainText = textarea.value;
      const htmlContent = plainTerminalTextToHtml(plainText);
      const targetTitle = getTodayTerminalNoteTitle();

      try {
        localStorage.setItem(getTodayTerminalLocalCacheKey(), plainText);
      } catch (e) {}

      if (!currentUser) {
        pendingTerminalSave = false;
        setTerminalSyncStatus('SAVED LOCALLY', '#fcd34d');
        if (showManualToast) {
          showToast('LOCAL SCRATCHPAD SAVED', 'Sign in as autumn to sync today\'s terminal note to Supabase.');
        }
        return;
      }

      if (isSavingTerminalNote) {
        pendingTerminalSave = true;
        return;
      }

      isSavingTerminalNote = true;
      pendingTerminalSave = false;
      setTerminalSyncStatus('SYNCING...', '#38bdf8');

      try {
        let todayNote = findTodayTerminalGeneralNote();

        if (!todayNote) {
          // Double-check database in case it was created in another session
          const { data: existingRows } = await supabaseClient
            .from('general_notes')
            .select('*')
            .eq('title', targetTitle)
            .limit(1);

          if (existingRows && existingRows.length > 0) {
            todayNote = existingRows[0];
          }
        }

        if (todayNote && todayNote.id) {
          const { error } = await supabaseClient
            .from('general_notes')
            .update({
              title: targetTitle,
              category: 'TERMINAL',
              content: htmlContent,
              updated_at: new Date().toISOString()
            })
            .eq('id', todayNote.id);

          if (error) throw error;
        } else if (plainText.trim().length > 0 || showManualToast) {
          const { data: created, error } = await supabaseClient
            .from('general_notes')
            .insert({
              title: targetTitle,
              category: 'TERMINAL',
              content: htmlContent,
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) throw error;
          if (created) {
            globalGeneralNotes.unshift(created);
          }
        }

        const timeShort = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setTerminalSyncStatus(`SAVED ${timeShort}`, '#34d399');

        // Refresh General Notes list in Tab 05 without stealing cursor focus
        const { data: refreshed } = await supabaseClient
          .from('general_notes')
          .select('*')
          .order('updated_at', { ascending: false });

        if (refreshed) {
          globalGeneralNotes = refreshed;
          renderGeneralNotesArchive();
          const updatedTodayNote = findTodayTerminalGeneralNote();
          if (updatedTodayNote && selectedGeneralNoteId === updatedTodayNote.id) {
            const genEditor = document.getElementById('gen-note-content-editor');
            if (document.activeElement !== genEditor) {
              loadGeneralNoteIntoEditor(updatedTodayNote);
            }
          }
        }

        if (showManualToast) {
          showToast('TERMINAL NOTE SYNCED', `Saved to "${targetTitle}" in General Notes.`);
        }
      } catch (err) {
        console.warn('Terminal scratchpad sync error:', err.message);
        setTerminalSyncStatus('SYNC ERROR', '#f87171');
        if (showManualToast) {
          showToast('TERMINAL SYNC ERROR', err.message, true);
        }
      } finally {
        isSavingTerminalNote = false;
        if (pendingTerminalSave) {
          flushTerminalToGeneralNote(false);
        }
      }
    }

    async function openTodayTerminalInNotesTab() {
      await flushTerminalToGeneralNote(false);
      switchTab('notes');
      const todayNote = findTodayTerminalGeneralNote();
      if (todayNote) {
        selectGeneralNote(todayNote.id);
      } else {
        document.getElementById('gen-note-active-badge').textContent = 'TERMINAL';
        document.getElementById('gen-note-title-input').value = getTodayTerminalNoteTitle();
        document.getElementById('gen-note-category-input').value = 'TERMINAL';
        const textarea = document.getElementById('terminal-scratchpad-textarea');
        document.getElementById('gen-note-content-editor').innerHTML = plainTerminalTextToHtml(textarea ? textarea.value : '');
        updateGeneralNoteWordCount();
      }
      const genForm = document.getElementById('gen-note-editor-form');
      if (genForm) genForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // 10F. TAB 6: GOOGLE DRIVE RESOURCES & INTEGRATED PDF READER
    // ==========================================
    let driveExpandedState = {};       // folderId -> boolean (expanded/collapsed)
    let driveFolderChildrenCache = {}; // folderId -> array of file/folder items from Google Drive API
    let globalDriveFilesMap = {};      // fileId -> file metadata object

    // ── RESOURCE TREE ENGINE (v1.2.0) ────────────────────────────────────────
    // Before this the tree re-rendered EVERY cached row on every toggle, and each folder
    // only ever read its first 200 children (nextPageToken was ignored) — so a large Drive
    // appeared to stop expanding. Rendering is now bounded per folder, listing is fully
    // paginated, and every folder reports loading / empty / error distinctly.
    const DRIVE_PAGE_SIZE = 1000;              // Drive API maximum per page
    const DRIVE_MAX_ITEMS_PER_FOLDER = 5000;   // hard stop so one folder cannot hang a tab
    const DRIVE_ROW_STEP = 50;                 // rows drawn per folder before "SHOW MORE"
    const DRIVE_SORT_KEY = 'autumn_drive_sort';
    const DRIVE_SORT_MODES = ['folder', 'name', 'newest', 'size'];

    let driveFolderNextPageTokens = {};  // folderId -> nextPageToken ('' = fully loaded)
    let driveFolderFetchState = {};      // folderId -> 'loading' | 'error' | 'ready'
    let driveFolderErrors = {};          // folderId -> message shown inline in the tree
    let driveVisibleLimits = {};         // folderId -> how many rows are currently drawn
    let driveSearchTimer = null;
    let driveSortMode = 'folder';
    try {
      const savedDriveSort = localStorage.getItem(DRIVE_SORT_KEY);
      if (savedDriveSort && DRIVE_SORT_MODES.indexOf(savedDriveSort) !== -1) driveSortMode = savedDriveSort;
    } catch (e) {}

    function isDriveFolder(item) {
      return Boolean(item) && item.mimeType === 'application/vnd.google-apps.folder';
    }

    function driveItemMatches(item, query) {
      if (!query) return true;
      return String((item && item.name) || '').toLowerCase().indexOf(query) !== -1;
    }

    // Deep, cycle-safe filter match: a subfolder stays visible when anything inside it
    // (however deep, once indexed) matches. Filtering never triggers network traffic.
    function driveFolderMatchesDeep(folderId, query, guard) {
      const seen = guard || new Set();
      if (!folderId || seen.has(folderId)) return false;
      seen.add(folderId);
      const items = driveFolderChildrenCache[folderId] || [];
      return items.some((item) => {
        if (driveItemMatches(item, query)) return true;
        return isDriveFolder(item) ? driveFolderMatchesDeep(item.id, query, seen) : false;
      });
    }

    function sortDriveItems(items, mode) {
      const list = (items || []).slice();
      const byName = (a, b) => String((a && a.name) || '')
        .localeCompare(String((b && b.name) || ''), 'en', { numeric: true, sensitivity: 'base' });
      if (mode === 'newest') {
        return list.sort((a, b) => new Date((b && b.modifiedTime) || 0) - new Date((a && a.modifiedTime) || 0));
      }
      if (mode === 'size') {
        return list.sort((a, b) => (Number((b && b.size) || 0) - Number((a && a.size) || 0)) || byName(a, b));
      }
      if (mode === 'name') return list.sort(byName);
      // 'folder' (default): folders first, then names — matches Drive's own ordering.
      return list.sort((a, b) => {
        const af = isDriveFolder(a) ? 0 : 1;
        const bf = isDriveFolder(b) ? 0 : 1;
        if (af !== bf) return af - bf;
        return byName(a, b);
      });
    }

    function countDriveItems(items) {
      let folders = 0;
      (items || []).forEach((item) => { if (isDriveFolder(item)) folders += 1; });
      const total = (items || []).length;
      return { total: total, folders: folders, files: total - folders };
    }

    function describeDriveItemCounts(items) {
      const counts = countDriveItems(items);
      if (counts.total === 0) return 'empty';
      const parts = [];
      if (counts.folders > 0) parts.push(counts.folders + (counts.folders === 1 ? ' folder' : ' folders'));
      if (counts.files > 0) parts.push(counts.files + (counts.files === 1 ? ' file' : ' files'));
      return parts.join(' · ');
    }

    // Escapes a name but wraps the first filter hit, so a deep list stays scannable.
    function highlightDriveMatch(text, query) {
      const raw = String(text || '');
      if (!query) return escapeHtml(raw);
      const at = raw.toLowerCase().indexOf(query);
      if (at === -1) return escapeHtml(raw);
      return escapeHtml(raw.slice(0, at)) +
        '<span class="drive-hit">' + escapeHtml(raw.slice(at, at + query.length)) + '</span>' +
        escapeHtml(raw.slice(at + query.length));
    }
    let activeDriveFileId = null;
    let isDriveReaderTall = false;

    // Extracts a clean Google Drive Folder ID whether the user pastes a raw ID or a full Google Drive URL
    function extractDriveFolderId(rawInput) {
      if (!rawInput) return '';
      const trimmed = String(rawInput).trim();
      const matchFolderUrl = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (matchFolderUrl && matchFolderUrl[1]) return matchFolderUrl[1];
      const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (matchIdParam && matchIdParam[1]) return matchIdParam[1];
      return trimmed;
    }

    function getEffectiveDriveApiKey() {
      return (GOOGLE_DRIVE_API_KEY && GOOGLE_DRIVE_API_KEY.trim()) || (GOOGLE_API_KEY && GOOGLE_API_KEY.trim()) || '';
    }

    async function loadSavedGDriveConfig() {
      let loadedConfig = null;

      // SECURITY: drive_config.api_key belongs to the owner. The folder LIST is not secret
      // (guests browse it through the keyless embedded Drive viewer), but the key must
      // never be assigned for an unauthenticated visitor — and the row itself should be
      // unreadable with the public anon key at the database level (RLS — see §1).
      const isOwner = Boolean(currentUser);

      // 1. Check dedicated drive_config table in Supabase first
      const { data: driveRow } = await supabaseClient
        .from('drive_config')
        .select('*')
        .eq('config_key', 'primary')
        .maybeSingle();

      if (driveRow && Array.isArray(driveRow.folders) && driveRow.folders.length > 0) {
        loadedConfig = {
          // The key is dropped immediately for a guest; only the folder list travels.
          apiKey: isOwner ? (driveRow.api_key || '') : '',
          folders: driveRow.folders
        };
      }

      // 2. Fallback to daily_notes reserved config row (any key inside is dropped for guests)
      if (!loadedConfig) {
        const { data } = await supabaseClient
          .from('daily_notes')
          .select('*')
          .eq('date', GDRIVE_CONFIG_DATE_KEY)
          .maybeSingle();

        if (data && data.content) {
          try {
            loadedConfig = JSON.parse(data.content);
          } catch (e) {}
        }
      }

      // 3. Fallback to browser localStorage cache (owner's own browser only)
      if (!loadedConfig && isOwner) {
        try {
          const localRaw = localStorage.getItem('autumn_gdrive_config');
          if (localRaw) loadedConfig = JSON.parse(localRaw);
        } catch (e) {}
      }

      if (loadedConfig) {
        // The folder list is not secret, but the API key is owner-only.
        if (isOwner && loadedConfig.apiKey !== undefined) GOOGLE_DRIVE_API_KEY = loadedConfig.apiKey;
        if (Array.isArray(loadedConfig.folders) && loadedConfig.folders.length > 0) {
          GOOGLE_DRIVE_FOLDERS = loadedConfig.folders;
        }
      }

      // Populate modal inputs — credentials are never echoed for a guest.
      const driveKeyInput = document.getElementById('gdrive-key-input');
      if (driveKeyInput) driveKeyInput.value = isOwner ? (GOOGLE_DRIVE_API_KEY || '') : '';
      const primary = GOOGLE_DRIVE_FOLDERS[0] || { title: 'Primary Study Resources', id: '' };
      document.getElementById('gdrive-folder1-name').value = primary.title || 'Primary Study Resources';
      document.getElementById('gdrive-folder1-id').value = primary.rawUrl || primary.id || '';

      const extras = GOOGLE_DRIVE_FOLDERS.slice(1).map(f => `${f.title} | ${f.rawUrl || f.id}`).join('\n');
      document.getElementById('gdrive-extra-folders-input').value = extras;
    }

    onReady('gdrive-config-form', 'submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to configure Google Drive folders.', true);

      const apiKey = document.getElementById('gdrive-key-input').value.trim();
      const f1Name = document.getElementById('gdrive-folder1-name').value.trim() || 'Primary Study Resources';
      const rawF1Input = document.getElementById('gdrive-folder1-id').value.trim();
      const f1Id = extractDriveFolderId(rawF1Input);
      const extraRaw = document.getElementById('gdrive-extra-folders-input').value.trim();

      if (!f1Id) {
        return showToast('INVALID FOLDER ID', 'Please enter a valid Google Drive Folder Link or Folder ID.', true);
      }

      const foldersList = [
        { id: f1Id, rawUrl: rawF1Input, title: f1Name, expandedByDefault: true }
      ];

      if (extraRaw) {
        extraRaw.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;
          if (trimmed.includes('|')) {
            const [t, rawId] = trimmed.split('|');
            const cleanId = extractDriveFolderId(rawId);
            if (cleanId) foldersList.push({ id: cleanId, rawUrl: rawId.trim(), title: t.trim() || 'Drive Folder', expandedByDefault: false });
          } else {
            const cleanId = extractDriveFolderId(trimmed);
            if (cleanId) foldersList.push({ id: cleanId, rawUrl: trimmed, title: 'Drive Folder', expandedByDefault: false });
          }
        });
      }

      GOOGLE_DRIVE_API_KEY = apiKey;
      GOOGLE_DRIVE_FOLDERS = foldersList;
      // The expand/collapse map is driveExpandedState. This line used to say
      // `expandedDriveFolders[...]`, a name that no longer exists: evaluating it threw a
      // ReferenceError before anything was saved, so the whole update was lost.
      const configuredIds = foldersList.map(f => f.id);
      Object.keys(driveExpandedState).forEach((id) => {
        if (configuredIds.indexOf(id) === -1) delete driveExpandedState[id];
      });
      Object.keys(driveFolderChildrenCache).forEach((id) => {
        if (configuredIds.indexOf(id) === -1) delete driveFolderChildrenCache[id];
      });
      driveExpandedState[f1Id] = true;

      const configPayload = { apiKey: GOOGLE_DRIVE_API_KEY, folders: GOOGLE_DRIVE_FOLDERS };
      try {
        localStorage.setItem('autumn_gdrive_config', JSON.stringify(configPayload));
      } catch (err) {}

      // Save to both the dedicated drive_config table AND the daily_notes config slot.
      // Wrapped so an unexpected throw becomes a readable toast instead of a bare
      // unhandled rejection (the browser/browser-cache copy is already written above).
      let resDriveTable = { error: null };
      let resNotesTable = { error: null };
      try {
        const results = await Promise.all([
          supabaseClient.from('drive_config').upsert({
            config_key: 'primary',
            api_key: GOOGLE_DRIVE_API_KEY,
            folders: GOOGLE_DRIVE_FOLDERS,
            updated_at: new Date().toISOString()
          }, { onConflict: 'config_key' }),
          supabaseClient.from('daily_notes').upsert({
            date: GDRIVE_CONFIG_DATE_KEY,
            title: '__GDRIVE_CONFIG__',
            mood: 'SYSTEM',
            content: JSON.stringify(configPayload),
            updated_at: new Date().toISOString()
          }, { onConflict: 'date' })
        ]);
        resDriveTable = results[0] || { error: null };
        resNotesTable = results[1] || { error: null };
      } catch (err) {
        console.warn("[autumn] drive config save failed:", err);
        resDriveTable = { error: err };
        resNotesTable = { error: err };
      }

      closeModal('gdrive-config-modal');
      if (resDriveTable.error && resNotesTable.error) {
        showToast('SAVED LOCALLY', 'Saved in browser; run the drive_config SQL in Supabase to sync across devices.', true);
      } else {
        showToast('DRIVE LINK SAVED', `Persisted ${foldersList.length} Google Drive folder(s) to Supabase.`);
      }
      fetchGoogleDriveResources(true);
    });

    // ── DRIVE DATA OPERATIONS (v1.2.0) ───────────────────────────────────────
    // Full pagination: Drive returns at most 1000 entries per page, so a folder with 800
    // files used to show 200 and hide the rest forever. Every page is now walked (capped at
    // DRIVE_MAX_ITEMS_PER_FOLDER) and any remainder is fetchable with "FETCH MORE".
    async function fetchDriveFolderContents(folderId, apiKey, pageToken) {
      const query = `'${folderId}' in parents and trashed = false`;
      const fields = 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,iconLink,fileExtension)';
      const collected = pageToken ? (driveFolderChildrenCache[folderId] || []).slice() : [];
      const seenIds = new Set(collected.map(f => f.id));
      let token = pageToken || '';
      let pages = 0;

      do {
        const url = 'https://www.googleapis.com/drive/v3/files' +
          '?q=' + encodeURIComponent(query) +
          '&fields=' + encodeURIComponent(fields) +
          '&orderBy=folder,name' +
          '&pageSize=' + DRIVE_PAGE_SIZE +
          '&key=' + encodeURIComponent(apiKey) +
          (token ? '&pageToken=' + encodeURIComponent(token) : '');

        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          throw new Error((data && data.error && data.error.message) || 'Failed to fetch Google Drive folder');
        }
        (data.files || []).forEach((file) => {
          if (seenIds.has(file.id)) return;
          seenIds.add(file.id);
          globalDriveFilesMap[file.id] = file;
          collected.push(file);
        });
        token = data.nextPageToken || '';
        pages += 1;
      } while (token && pages < 10 && collected.length < DRIVE_MAX_ITEMS_PER_FOLDER);

      driveFolderChildrenCache[folderId] = collected;
      driveFolderNextPageTokens[folderId] = token || '';
      return collected;
    }

    // Pull one more page for an already-listed folder ("FETCH MORE" in the tree footer).
    async function loadMoreDriveFolder(folderId) {
      const apiKey = getEffectiveDriveApiKey();
      const token = driveFolderNextPageTokens[folderId];
      if (!apiKey || !token || driveFolderFetchState[folderId] === 'loading') return;
      driveFolderFetchState[folderId] = 'loading';
      renderDriveFoldersTree();
      try {
        await fetchDriveFolderContents(folderId, apiKey, token);
        driveFolderFetchState[folderId] = 'ready';
        delete driveFolderErrors[folderId];
      } catch (err) {
        driveFolderFetchState[folderId] = 'error';
        driveFolderErrors[folderId] = err.message;
        showToast('FOLDER LOAD ERROR', err.message, true);
      }
      renderDriveFoldersTree();
    }

    // Grows the per-folder row cap instead of drawing thousands of rows up front.
    function loadMoreDriveRows(scopeKey) {
      const key = scopeKey || 'root';
      driveVisibleLimits[key] = (driveVisibleLimits[key] || DRIVE_ROW_STEP) + DRIVE_ROW_STEP;
      renderDriveFoldersTree();
    }

    function resetDriveRowLimits() {
      driveVisibleLimits = {};
    }


    async function fetchGoogleDriveResources(showManualFeedback = false) {
      const badgeEl = document.getElementById('gdrive-sync-badge');
      const apiKey = getEffectiveDriveApiKey();
      const validFolders = (GOOGLE_DRIVE_FOLDERS || []).filter(f => f && f.id);

      // If a Folder Link/ID is saved but no API Key is provided, automatically load the folder in the embedded Drive viewer
      if (!apiKey) {
        if (badgeEl) {
          badgeEl.className = 'tech-badge badge-green';
          badgeEl.textContent = 'DIRECT LINK MODE';
        }
        renderDriveFoldersTree();
        // BUGFIX: this used to reference an undeclared `configuredFolders`, which threw a
        // ReferenceError as soon as a visitor without an API key reached 06 // RESOURCES.
        if (validFolders.length > 0) {
          openDriveFolderEmbedInReader(validFolders[0].id, validFolders[0].title);
        }
        return;
      }

      try {
        if (badgeEl) {
          badgeEl.className = 'tech-badge badge-blue';
          badgeEl.textContent = 'SYNCING DRIVE...';
        }

        // Ensure Primary Folder #1 is expanded by default
        validFolders.forEach((f, idx) => {
          if (driveExpandedState[f.id] === undefined) {
            driveExpandedState[f.id] = idx === 0 ? true : Boolean(f.expandedByDefault);
          }
        });

        // Settle each folder independently: a single unshared folder used to reject the
        // whole Promise.all and blank the entire vault with a sync error.
        validFolders.forEach((folder) => { driveFolderFetchState[folder.id] = 'loading'; });
        renderDriveFoldersTree();
        const syncResults = await Promise.allSettled(validFolders.map(async (folder) => {
          try {
            await fetchDriveFolderContents(folder.id, apiKey);
            driveFolderFetchState[folder.id] = 'ready';
            delete driveFolderErrors[folder.id];
          } catch (err) {
            driveFolderFetchState[folder.id] = 'error';
            driveFolderErrors[folder.id] = err.message;
            throw err;
          }
        }));
        const failedSyncs = syncResults.filter(result => result.status === 'rejected');
        const failedFolderNames = failedSyncs
          .map((result) => validFolders[syncResults.indexOf(result)])
          .filter(Boolean)
          .map(folder => folder.title || folder.id);
        if (failedSyncs.length === validFolders.length && validFolders.length > 0) {
          throw (failedSyncs[0].reason || new Error('Google Drive sync failed'));
        }
        if (failedSyncs.length > 0) {
          showToast('PARTIAL DRIVE SYNC', failedSyncs.length + ' of ' + validFolders.length +
            ' folder(s) could not be read: ' + failedFolderNames.join(', ') + '. Share them as “Anyone with the link”.', true);
        }
        renderDriveFoldersTree();

        if (badgeEl) {
          badgeEl.className = 'tech-badge badge-green';
          badgeEl.textContent = 'LIVE // DRIVE SYNCED';
        }
        const syncTextEl = document.getElementById('gdrive-last-sync-text');
        if (syncTextEl) {
          syncTextEl.textContent = `Last synced: ${new Date().toLocaleTimeString('en-US', { hour12: false })}`;
        }

        renderDriveFoldersTree();

        // Automatically load the first PDF/document into the reader if none is selected yet
        if (!activeDriveFileId && validFolders.length > 0) {
          const primaryItems = driveFolderChildrenCache[validFolders[0].id] || [];
          const firstDoc = primaryItems.find(item => item.mimeType !== 'application/vnd.google-apps.folder');
          if (firstDoc) {
            openDriveFileInReader(firstDoc.id, false);
          }
        }

        if (showManualFeedback) {
          showToast('DRIVE SYNCED', `Synced ${validFolders.length} Google Drive folder(s).`);
        }
      } catch (err) {
        console.warn('Google Drive sync error:', err.message);
        if (badgeEl) {
          badgeEl.className = 'tech-badge badge-red';
          badgeEl.textContent = 'DRIVE SYNC ERROR';
        }
        renderDriveFoldersTree(err.message);
        if (showManualFeedback) {
          showToast('DRIVE API ERROR', err.message, true);
        }
      }
    }

    // ── READER TYPE MODEL (v1.1.0) ───────────────────────────────────────────
    // Before v1.1.0 the reader knew four labels (PDF / DOC / SHEET / SLIDE) and always
    // pointed the iframe at Drive's /preview endpoint, which silently fails for plenty of
    // Office uploads. It now resolves a precise KIND — extension first, because Drive
    // reports application/octet-stream for a lot of files — and every kind exposes the
    // providers that can actually render it: Google-native embeds, Drive preview,
    // Microsoft Office Online, the Google Docs Viewer, and an in-page renderer.
    const DRIVE_KIND_META = {
      pdf:    { label: 'PDF',    badge: 'badge-red',     native: '' },
      gdoc:   { label: 'GDOC',   badge: 'badge-blue',    native: '' },
      gsheet: { label: 'GSHEET', badge: 'badge-green',   native: '' },
      gslide: { label: 'GSLIDE', badge: 'badge-amber',   native: '' },
      docx:   { label: 'DOCX',   badge: 'badge-blue',    native: 'docx' },
      doc:    { label: 'DOC',    badge: 'badge-blue',    native: '' },
      xlsx:   { label: 'XLSX',   badge: 'badge-green',   native: 'sheet' },
      xls:    { label: 'XLS',    badge: 'badge-green',   native: 'sheet' },
      csv:    { label: 'CSV',    badge: 'badge-green',   native: 'sheet' },
      pptx:   { label: 'PPTX',   badge: 'badge-amber',   native: 'slides' },
      ppt:    { label: 'PPT',    badge: 'badge-amber',   native: '' },
      image:  { label: 'IMAGE',  badge: 'badge-amber',   native: '' },
      media:  { label: 'MEDIA',  badge: 'badge-amber',   native: '' },
      folder: { label: 'FOLDER', badge: 'badge-neutral', native: '' },
      other:  { label: 'FILE',   badge: 'badge-neutral', native: '' }
    };
    const DRIVE_OFFICE_KINDS = ['docx', 'doc', 'xlsx', 'xls', 'csv', 'pptx', 'ppt'];
    const DRIVE_GOOGLE_KINDS = ['gdoc', 'gsheet', 'gslide'];
    const READER_SOURCE_PREF_KEY = 'autumn_reader_source_pref';

    let activeDriveReaderSources = [];
    let activeDriveSourceId = '';
    let activeDriveNativeToken = 0;   // bumped on every swap so a slow parse cannot paint late
    let nativeWorkbook = null;        // SheetJS workbook currently displayed
    let nativeActiveSheet = '';

    function getDriveFileExtension(file) {
      const src = (typeof file === 'string') ? { mimeType: file } : (file || {});
      const fromApi = String(src.fileExtension || '').toLowerCase().replace(/^\./, '');
      if (fromApi) return fromApi;
      const name = String(src.name || '');
      const dot = name.lastIndexOf('.');
      return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
    }

    function getDriveFileKind(file) {
      const src = (typeof file === 'string') ? { mimeType: file } : (file || {});
      const mime = String(src.mimeType || '').toLowerCase();
      const ext = getDriveFileExtension(src);

      if (mime === 'application/vnd.google-apps.folder') return 'folder';
      if (mime === 'application/vnd.google-apps.document') return 'gdoc';
      if (mime === 'application/vnd.google-apps.spreadsheet') return 'gsheet';
      if (mime === 'application/vnd.google-apps.presentation') return 'gslide';
      if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
      if (mime.indexOf('image/') === 0 || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic'].indexOf(ext) !== -1) return 'image';
      if (mime.indexOf('audio/') === 0 || mime.indexOf('video/') === 0 || ['mp3', 'mp4', 'm4a', 'wav', 'mov', 'webm', 'ogg'].indexOf(ext) !== -1) return 'media';

      // Office + plain text: the extension wins, because Drive often sends octet-stream.
      if (ext === 'docx') return 'docx';
      if (ext === 'doc' || ext === 'rtf' || ext === 'odt') return 'doc';
      if (ext === 'xlsx' || ext === 'xlsm') return 'xlsx';
      if (ext === 'xls' || ext === 'ods') return 'xls';
      if (ext === 'csv' || ext === 'tsv') return 'csv';
      if (ext === 'pptx') return 'pptx';
      if (ext === 'ppt' || ext === 'odp') return 'ppt';

      // No usable extension: fall back to the MIME family.
      if (mime.indexOf('wordprocessingml') !== -1) return 'docx';
      if (mime === 'application/msword') return 'doc';
      if (mime.indexOf('spreadsheetml') !== -1) return 'xlsx';
      if (mime === 'application/vnd.ms-excel') return 'xls';
      if (mime === 'text/csv' || mime === 'text/tab-separated-values') return 'csv';
      if (mime.indexOf('presentationml') !== -1) return 'pptx';
      if (mime === 'application/vnd.ms-powerpoint') return 'ppt';
      if (mime.indexOf('text/') === 0) return 'doc';
      return 'other';
    }
    // Accepts a MIME string or a whole Drive file object; the object form is preferred
    // because Drive reports application/octet-stream for many uploads and only the file
    // NAME carries the real extension.
    function getDriveFileTypeLabel(mimeTypeOrFile) {
      const kind = getDriveFileKind(mimeTypeOrFile);
      return (DRIVE_KIND_META[kind] || DRIVE_KIND_META.other).label;
    }

    function getDriveFileBadgeClass(typeLabel) {
      const match = Object.keys(DRIVE_KIND_META).find(k => DRIVE_KIND_META[k].label === typeLabel);
      return (DRIVE_KIND_META[match] || DRIVE_KIND_META.other).badge;
    }

    function getDriveDirectDownloadUrl(file) {
      if (!file) return '';
      if (file.webContentLink) return file.webContentLink;
      if (!file.id) return '';
      return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(file.id);
    }

    function getDriveReaderPrefs() {
      try {
        const raw = localStorage.getItem(READER_SOURCE_PREF_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return (parsed && typeof parsed === 'object') ? parsed : {};
      } catch (e) { return {}; }
    }

    function saveDriveReaderPref(kind, sourceId) {
      try {
        const prefs = getDriveReaderPrefs();
        prefs[kind] = sourceId;
        localStorage.setItem(READER_SOURCE_PREF_KEY, JSON.stringify(prefs));
      } catch (e) {}
    }
    // Every provider that can display this file, best first. Pure function: no DOM and no
    // network — which is why the #selftest harness can assert it directly.
    function buildDriveReaderSources(file) {
      const kind = getDriveFileKind(file);
      const meta = DRIVE_KIND_META[kind] || DRIVE_KIND_META.other;
      const id = encodeURIComponent((file && file.id) || '');
      const downloadUrl = getDriveDirectDownloadUrl(file);
      const sources = [];

      const add = (sourceId, label, url, note) => {
        if (sources.some(s => s.id === sourceId)) return;
        sources.push({ id: sourceId, label: label, url: url, note: note || '' });
      };

      // 1. Google-native files have purpose-built embeds (Docs / Sheets / Slides).
      if (kind === 'gdoc') add('gdocs', 'GOOGLE DOCS', 'https://docs.google.com/document/d/' + id + '/preview?rm=minimal', 'native Google embedding');
      if (kind === 'gsheet') add('gsheets', 'GOOGLE SHEETS', 'https://docs.google.com/spreadsheets/d/' + id + '/preview?rm=minimal', 'native Google embedding');
      if (kind === 'gslide') add('gslides', 'GOOGLE SLIDES', 'https://docs.google.com/presentation/d/' + id + '/embed?rm=minimal&start=false&loop=false', 'native Google embedding');

      // 2. Drive's own previewer: PDFs, images, media, and Office files Drive can convert.
      add('drive', 'DRIVE PREVIEW', 'https://drive.google.com/file/d/' + id + '/preview', 'works with your Google session');

      // 3. Microsoft Office Online: best fidelity for .docx/.xlsx/.pptx (needs a public link).
      if (DRIVE_OFFICE_KINDS.indexOf(kind) !== -1) {
        add('office', 'OFFICE ONLINE', 'https://view.officeapps.live.com/op/embed.aspx?src=' + encodeURIComponent(downloadUrl), 'needs public link sharing');
      }

      // 4. Google Docs Viewer: second opinion when Drive refuses to convert the file.
      if (DRIVE_OFFICE_KINDS.indexOf(kind) !== -1 || kind === 'pdf') {
        add('gview', 'GOOGLE VIEWER', 'https://docs.google.com/gview?embedded=true&url=' + encodeURIComponent(downloadUrl), 'needs public link sharing');
      }

      // 5. Render inside autumn: parses the bytes in this page, no third-party frame.
      if (meta.native) {
        add('native', 'RENDER IN APP', '', 'parses the file locally');
      }

      let defaultSource = 'drive';
      if (kind === 'gdoc') defaultSource = 'gdocs';
      else if (kind === 'gsheet') defaultSource = 'gsheets';
      else if (kind === 'gslide') defaultSource = 'gslides';

      const saved = getDriveReaderPrefs()[kind];
      const sourceId = sources.some(s => s.id === saved) ? saved : defaultSource;

      return { kind: kind, meta: meta, sources: sources, defaultSource: defaultSource, sourceId: sourceId };
    }

    function formatFileSize(bytes) {
      if (!bytes || isNaN(bytes)) return '';
      const b = Number(bytes);
      if (b < 1024) return `${b} B`;
      if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
      return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    }

    // With the list in normal page flow, expanding a folder deep in the tree can push its
    // files below the fold. This parks the folder you just opened at the top of the viewport
    // (only when it would otherwise be off-screen) so its files are always reachable.
    function keepDriveFolderInView(folderId) {
      const heads = document.querySelectorAll('[data-drive-folder-id]');
      let head = null;
      heads.forEach((node) => {
        if (node.getAttribute('data-drive-folder-id') === folderId) head = node;
      });
      if (!head) return;
      document.querySelectorAll('.drive-folder-head.is-current').forEach((node) => {
        node.classList.remove('is-current');
      });
      head.classList.add('is-current');
      const headerHeight = 96; // sticky app header + a little breathing room
      const top = head.getBoundingClientRect().top;
      if (top < headerHeight || top > window.innerHeight - 120) {
        const target = Math.max(0, window.scrollY + top - headerHeight - 8);
        try { window.scrollTo({ top: target, behavior: 'smooth' }); }
        catch (e) { window.scrollTo(0, target); }
      }
    }

    // Expand/collapse reacts instantly, then fetches only if this folder has never loaded.
    async function toggleDriveFolderExpand(folderId) {
      const willOpen = !driveExpandedState[folderId];
      driveExpandedState[folderId] = willOpen;
      renderDriveFoldersTree();
      if (!willOpen) return;

      const cached = driveFolderChildrenCache[folderId];
      if (cached) { keepDriveFolderInView(folderId); return; }
      if (driveFolderFetchState[folderId] === 'loading') return;

      const apiKey = getEffectiveDriveApiKey();
      if (!apiKey) { keepDriveFolderInView(folderId); return; }

      driveFolderFetchState[folderId] = 'loading';
      delete driveFolderErrors[folderId];
      renderDriveFoldersTree();
      try {
        await fetchDriveFolderContents(folderId, apiKey);
        driveFolderFetchState[folderId] = 'ready';
      } catch (err) {
        driveFolderFetchState[folderId] = 'error';
        driveFolderErrors[folderId] = err.message;
        showToast('FOLDER LOAD ERROR', err.message, true);
      }
      renderDriveFoldersTree();
      keepDriveFolderInView(folderId);
    }



    // Full re-sync: drop every cache so moved/renamed files are picked up.
    function refreshDriveResources() {
      driveFolderChildrenCache = {};
      driveFolderNextPageTokens = {};
      driveFolderFetchState = {};
      driveFolderErrors = {};
      globalDriveFilesMap = {};
      resetDriveRowLimits();
      renderDriveFoldersTree();
      fetchGoogleDriveResources(true);
    }

    // Keystrokes no longer rebuild the whole tree: 220 ms debounce, then one render.
    function onDriveSearchInput() {
      if (driveSearchTimer) clearTimeout(driveSearchTimer);
      driveSearchTimer = setTimeout(() => {
        driveSearchTimer = null;
        resetDriveRowLimits();
        renderDriveFoldersTree();
      }, 220);
    }

    function clearDriveSearch() {
      const input = document.getElementById('gdrive-search-input');
      if (input) input.value = '';
      if (driveSearchTimer) { clearTimeout(driveSearchTimer); driveSearchTimer = null; }
      resetDriveRowLimits();
      renderDriveFoldersTree();
    }

    function setDriveSortMode(mode) {
      driveSortMode = DRIVE_SORT_MODES.indexOf(mode) !== -1 ? mode : 'folder';
      try { localStorage.setItem(DRIVE_SORT_KEY, driveSortMode); } catch (e) {}
      resetDriveRowLimits();
      renderDriveFoldersTree();
    }


    function setAllDriveFoldersExpanded(expanded) {
      (GOOGLE_DRIVE_FOLDERS || []).forEach(f => {
        if (f && f.id) driveExpandedState[f.id] = expanded;
      });
      Object.keys(driveExpandedState).forEach(k => {
        driveExpandedState[k] = expanded;
      });
      renderDriveFoldersTree();
    }

    // ── BOUNDED TREE RENDERER (v1.2.0) ───────────────────────────────────────
    // `scopeKey` is the parent folder id (the root folder id at depth 0) so every folder
    // keeps its own "show more" cursor instead of one global cap.
    function renderDriveSubtreeItems(items, searchQuery, depth, scopeKey) {
      const key = scopeKey || 'root';
      const limit = driveVisibleLimits[key] || DRIVE_ROW_STEP;
      const sorted = sortDriveItems(items, driveSortMode);

      // Filtering keeps a folder when it — or anything indexed beneath it — matches.
      const visible = searchQuery
        ? sorted.filter((item) => driveItemMatches(item, searchQuery) ||
            (isDriveFolder(item) && driveFolderMatchesDeep(item.id, searchQuery)))
        : sorted;

      if (visible.length === 0) {
        const emptyText = searchQuery ? 'Nothing here matches this filter.' : 'This folder is empty.';
        return '<div class="p-3 font-mono-tech text-xs text-[#56735f] text-center">' + emptyText + '</div>';
      }

      const shown = visible.slice(0, limit);
      const hidden = visible.length - shown.length;
      const state = driveFolderFetchState[key];
      const errorMessage = driveFolderErrors[key];
      const hasMorePages = Boolean(driveFolderNextPageTokens[key]);

      let footer = '';
      if (state === 'loading') {
        footer = '<div class="p-2 font-mono-tech text-[10px] text-[#436152] bg-[#eff8f2] border-t border-[#e2efe8]">⟳ Loading entries…</div>';
      } else if (state === 'error' && errorMessage) {
        footer = '<div class="p-2 font-mono-tech text-[10px] text-[#b91c1c] bg-[#fee2e2] border-t border-[#fca5a5] break-words">[!] ' + escapeHtml(errorMessage) + '</div>';
      } else if (hidden > 0) {
        footer = '<div class="p-2 bg-[#f4faf6] border-t border-[#e2efe8] flex items-center justify-between gap-2">' +
          '<span class="font-mono-tech text-[10px] text-[#436152]">Showing ' + shown.length + ' of ' + visible.length + '</span>' +
          '<button type="button" onclick="loadMoreDriveRows(\'' + jsAttrQuote(key) + '\')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] shrink-0">＋ SHOW ' + Math.min(DRIVE_ROW_STEP, hidden) + ' MORE</button>' +
          '</div>';
      } else if (hasMorePages) {
        footer = '<div class="p-2 bg-[#f4faf6] border-t border-[#e2efe8] flex items-center justify-between gap-2">' +
          '<span class="font-mono-tech text-[10px] text-[#436152]">' + visible.length + ' loaded · more on Drive</span>' +
          '<button type="button" onclick="loadMoreDriveFolder(\'' + jsAttrQuote(key) + '\')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] shrink-0">⇩ FETCH MORE</button>' +
          '</div>';
      }

      const rows = shown.map((item) => (isDriveFolder(item)
        ? renderDriveFolderRow(item, searchQuery, depth)
        : renderDriveFileRow(item, searchQuery, depth))).join('');

      return rows + footer;
    }

    function renderDriveFolderRow(item, searchQuery, depth) {
      // A filter opens any folder that contains a hit, so deep matches are one glance away.
      const isOpen = Boolean(driveExpandedState[item.id]) ||
        (Boolean(searchQuery) && driveFolderMatchesDeep(item.id, searchQuery));
      const children = driveFolderChildrenCache[item.id];
      const state = driveFolderFetchState[item.id];
      const errorMessage = driveFolderErrors[item.id];
      const counts = children ? describeDriveItemCounts(children) : '';
      const moreOnDrive = Boolean(driveFolderNextPageTokens[item.id]);
      const indent = 'padding-left:' + (depth * 14 + 10) + 'px';
      const driveUrl = item.webViewLink || ('https://drive.google.com/drive/folders/' + encodeURIComponent(item.id));

      let countText = 'not loaded yet';
      if (children) countText = counts + (moreOnDrive ? ' · more on Drive' : '');
      else if (state === 'loading') countText = 'loading…';
      else if (state === 'error') countText = 'could not load';

      let body = '';
      if (isOpen) {
        if (state === 'loading' && !children) {
          body = '<div class="p-3 font-mono-tech text-xs text-[#436152] text-center">⟳ Loading folder…</div>';
        } else if (state === 'error' && !children) {
          body = '<div class="p-3 font-mono-tech text-[10px] text-[#b91c1c] bg-[#fee2e2] break-words">[!] ' +
            escapeHtml(errorMessage || 'Could not load this folder.') + '</div>';
        } else if (children) {
          body = renderDriveSubtreeItems(children, searchQuery, depth + 1, item.id);
        } else {
          body = '<div class="p-3 font-mono-tech text-[10px] text-[#56735f] text-center">Open this folder to load its contents.</div>';
        }
      }

      return '<div class="border-b border-[#e2efe8] last:border-b-0">' +
        '<div class="drive-folder-head flex items-center justify-between gap-2 bg-[#f4faf6] hover:bg-[#e8f3ec] transition-colors" data-drive-folder-id="' + jsAttrQuote(item.id) + '" style="' + indent + '">' +
          '<button type="button" onclick="toggleDriveFolderExpand(\'' + jsAttrQuote(item.id) + '\')" ' +
            'class="flex-1 min-w-0 flex items-center gap-2 p-2.5 text-left" ' +
            'aria-expanded="' + (isOpen ? 'true' : 'false') + '" ' +
            'title="' + (isOpen ? 'Collapse' : 'Expand') + ' ' + jsAttrQuote(item.name || '') + '">' +
            '<span class="font-mono-tech text-xs font-bold text-[#047857] w-4 text-center shrink-0">' + (isOpen ? '▾' : '▸') + '</span>' +
            '<span class="tech-badge badge-amber !text-[9px] !py-0.5 !px-1.5 shrink-0"> FOLDER</span>' +
            '<span class="min-w-0 flex flex-col">' +
              '<span class="font-bold text-xs text-[#0c1f17] truncate">' + highlightDriveMatch(item.name, searchQuery) + '</span>' +
              '<span class="font-mono-tech text-[9px] text-[#56735f] truncate">' + escapeHtml(countText) + '</span>' +
            '</span>' +
          '</button>' +
          '<a href="' + escapeHtml(driveUrl) + '" target="_blank" rel="noopener noreferrer" ' +
            'class="btn-tech-outline !py-0.5 !px-2 !text-[10px] mr-2 shrink-0" title="Open folder in Google Drive">Drive →</a>' +
        '</div>' +
        (body ? '<div class="bg-white border-t border-[#e2efe8]">' + body + '</div>' : '') +
      '</div>';
    }

    function renderDriveFileRow(item, searchQuery, depth) {
      const typeLabel = getDriveFileTypeLabel(item);
      const badgeClass = getDriveFileBadgeClass(typeLabel);
      const isSelected = activeDriveFileId === item.id;
      const sizeStr = formatFileSize(item.size);
      const modDate = item.modifiedTime
        ? new Date(item.modifiedTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      const driveUrl = item.webViewLink || ('https://drive.google.com/file/d/' + encodeURIComponent(item.id) + '/view');
      const indent = depth > 0 ? ' style="padding-left:' + (depth * 14 + 10) + 'px"' : '';
      const rowTone = isSelected
        ? 'bg-[#dcfce7] border-l-4 border-l-[#059669]'
        : 'bg-white hover:bg-[#f4faf6]';

      return '<div class="p-2.5 border-b border-[#e8f3ec] last:border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ' + rowTone + '"' + indent + '>' +
        '<button type="button" onclick="openDriveFileInReader(\'' + jsAttrQuote(item.id) + '\', true)" ' +
          'class="w-full sm:flex-1 min-w-0 text-left" title="Read ' + jsAttrQuote(item.name || '') + ' in the built-in viewer">' +
          '<span class="flex items-start gap-1.5">' +
            '<span class="tech-badge ' + badgeClass + ' !text-[9px] !py-0.5 !px-1.5 shrink-0 mt-0.5">' + typeLabel + '</span>' +
            '<span class="font-bold text-xs text-[#0c1f17] break-words leading-snug">' + highlightDriveMatch(item.name, searchQuery) + '</span>' +
          '</span>' +
          '<span class="font-mono-tech text-[10px] text-[#56735f] mt-1 flex items-center gap-2 flex-wrap">' +
            (sizeStr ? '<span>' + escapeHtml(sizeStr) + '</span>' : '') +
            (modDate ? '<span>• ' + escapeHtml(modDate) + '</span>' : '') +
          '</span>' +
        '</button>' +
        '<div class="flex items-center justify-end gap-1.5 shrink-0 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-[#e8f3ec]">' +
          '<button type="button" onclick="openDriveFileInReader(\'' + jsAttrQuote(item.id) + '\', true)" ' +
            'class="btn-tech-outline !py-1 !px-2.5 !text-[10px] flex-1 sm:flex-initial justify-center ' + (isSelected ? 'active-view' : '') + '">Read</button>' +
          '<a href="' + escapeHtml(driveUrl) + '" target="_blank" rel="noopener noreferrer" ' +
            'class="btn-tech-outline !py-1 !px-2.5 !text-[10px] flex-1 sm:flex-initial justify-center" title="Open file directly in Google Drive">Drive →</a>' +
        '</div>' +
      '</div>';
    }


    function renderDriveFoldersTree(errorMessage = '') {
      const container = document.getElementById('gdrive-folders-container');
      const countEl = document.getElementById('gdrive-total-files-count');
      const folderCountEl = document.getElementById('gdrive-total-folders-count');
      if (!container) return;

      const indexed = Object.values(globalDriveFilesMap);
      const indexedFolders = indexed.filter(isDriveFolder).length;
      if (countEl) countEl.textContent = indexed.length - indexedFolders;
      if (folderCountEl) folderCountEl.textContent = indexedFolders;

      const apiKey = getEffectiveDriveApiKey();
      const validFolders = (GOOGLE_DRIVE_FOLDERS || []).filter(f => f && f.id);

      if (!apiKey) {
        if (validFolders.length === 0) {
          container.innerHTML = `
            <div class="p-4 bg-[#eff8f2] border border-[#c5ded0] font-mono-tech text-xs text-[#436152] leading-relaxed">
              <strong class="text-[#0c1f17]">NO DRIVE FOLDERS CONFIGURED.</strong><br>
              Google Drive folders need either the owner's API key or the keyless embedded viewer.
              The owner adds them here via <strong>Configure</strong>; the YouTube / lecture archive below stays available to everyone.
            </div>
          `;
          return;
        }
        container.innerHTML = validFolders.map(folder => `
          <div class="border border-[#87b39b] bg-white p-3 flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-xs text-[#0c1f17] truncate"> ${escapeHtml(folder.title || 'Google Drive Folder')}</span>
              <span class="tech-badge badge-green !text-[9px]">LINK SAVED</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="openDriveFolderEmbedInReader('${folder.id}', '${jsAttrQuote(folder.title || 'Drive Folder')}')" class="btn-tech-outline !py-1 !px-2.5 !text-[10px] flex-1 justify-center">
                ⊞ Browse Folder Here
              </button>
              <a href="https://drive.google.com/drive/folders/${encodeURIComponent(folder.id)}" target="_blank" rel="noopener noreferrer" class="btn-chamfer !py-1 !px-2.5 !text-[10px]">
                Open Drive →
              </a>
            </div>
          </div>
        `).join('');
        return;
      }

      if (errorMessage) {
        container.innerHTML = `
          <div class="p-4 bg-[#fee2e2] border border-[#fca5a5] font-mono-tech text-xs text-[#b91c1c]">
            <strong>Google Drive Sync Error:</strong> ${escapeHtml(errorMessage)}
            <div class="mt-1 text-[11px] text-[#0c1f17]">Make sure the folder is shared as "Anyone with the link can view" and Google Drive API is enabled for your API Key.</div>
          </div>
        `;
        return;
      }

      const searchInput = document.getElementById('gdrive-search-input');
      const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const clearBtn = document.getElementById('gdrive-search-clear');
      if (clearBtn) clearBtn.classList.toggle('hidden', !searchQuery);
      const statusEl = document.getElementById('gdrive-tree-status');
      const sortEl = document.getElementById('gdrive-drive-sort');
      if (sortEl && sortEl.value !== driveSortMode) sortEl.value = driveSortMode;

      if (validFolders.length === 0) {
        container.innerHTML = `
          <div class="p-4 bg-[#eff8f2] border border-[#c5ded0] font-mono-tech text-xs text-[#436152] leading-relaxed">
            <strong class="text-[#0c1f17]">NO DRIVE FOLDERS CONFIGURED.</strong><br>
            Use <strong> Configure</strong> to paste a Google Drive folder link and an API key.
          </div>
        `;
        if (statusEl) statusEl.textContent = '';
        return;
      }
      // Filtering hides whole roots that cannot match, so a big Drive collapses to the hits.
      const matchedFolders = validFolders.filter((folder) => {
        if (!searchQuery) return true;
        if (driveItemMatches({ name: folder.title }, searchQuery)) return true;
        return driveFolderMatchesDeep(folder.id, searchQuery);
      });

      if (searchQuery && matchedFolders.length === 0) {
        container.innerHTML = `
          <div class="p-4 bg-[#fef3c7] border border-[#fcd34d] font-mono-tech text-xs text-[#92400e] leading-relaxed">
            No indexed file or folder matches <strong>${escapeHtml(searchQuery)}</strong>.
            <div class="mt-2">
              <button type="button" onclick="clearDriveSearch()" class="btn-tech-outline !py-1 !px-2 !text-[10px]">× CLEAR FILTER</button>
            </div>
            <div class="mt-1.5 text-[10px] text-[#78350f]">Subfolders become searchable once they have been opened at least once.</div>
          </div>
        `;
        if (statusEl) statusEl.textContent = '0 of ' + validFolders.length + ' folder(s) match';
        return;
      }

      container.innerHTML = matchedFolders.map((folder) => {
        // A filter forces every matching folder open so the hits are visible immediately.
        const isExpanded = Boolean(searchQuery) || Boolean(driveExpandedState[folder.id]);
        const items = driveFolderChildrenCache[folder.id];
        const state = driveFolderFetchState[folder.id];
        const folderError = driveFolderErrors[folder.id];
        const folderUrl = 'https://drive.google.com/drive/folders/' + encodeURIComponent(folder.id);
        const configIndex = validFolders.indexOf(folder);
        const title = folder.title || ('Folder #' + (configIndex + 1));

        let meta;
        if (items) meta = describeDriveItemCounts(items) + (driveFolderNextPageTokens[folder.id] ? ' · more on Drive' : '');
        else if (state === 'loading') meta = 'syncing…';
        else if (state === 'error') meta = 'could not load';
        else meta = 'not loaded yet';

        let body = '';
        if (isExpanded) {
          if (state === 'loading' && !items) {
            body = '<div class="p-4 text-center font-mono-tech text-xs text-[#436152]">⟳ Fetching folder…</div>';
          } else if (state === 'error' && !items) {
            body = '<div class="p-3 font-mono-tech text-[10px] text-[#b91c1c] bg-[#fee2e2] break-words">[!] ' +
              escapeHtml(folderError || 'Could not load this folder.') + '</div>';
          } else if (items) {
            body = renderDriveSubtreeItems(items, searchQuery, 0, folder.id);
          } else {
            body = '<div class="p-4 text-center font-mono-tech text-[10px] text-[#56735f]">Open this folder to load its contents.</div>';
          }
        }

        return '<div class="border ' + (isExpanded ? 'border-[#059669]' : 'border-[#c5ded0]') + ' bg-white overflow-hidden">' +
          '<div class="drive-folder-head p-3 bg-[#eff8f2] border-b ' + (isExpanded ? 'border-[#c5ded0]' : 'border-transparent') + ' flex items-center justify-between gap-2" data-drive-folder-id="' + jsAttrQuote(folder.id) + '">' +
            '<button type="button" onclick="toggleDriveFolderExpand(\'' + jsAttrQuote(folder.id) + '\')" class="flex-1 min-w-0 flex items-center gap-2 text-left" aria-expanded="' + (isExpanded ? 'true' : 'false') + '">' +
              '<span class="font-mono-tech text-xs font-bold text-[#047857] w-4 text-center shrink-0">' + (isExpanded ? '▾' : '▸') + '</span>' +
              '<span class="min-w-0 flex flex-col">' +
                '<span class="flex items-center gap-1.5 flex-wrap">' +
                  '<span class="font-bold text-xs sm:text-sm text-[#0c1f17] truncate">' + highlightDriveMatch(title, searchQuery) + '</span>' +
                  (configIndex === 0 ? '<span class="tech-badge badge-green !text-[9px] !py-0 !px-1.5">PRIMARY</span>' : '') +
                '</span>' +
                '<span class="font-mono-tech text-[10px] text-[#436152] truncate">' + escapeHtml(meta) + '</span>' +
              '</span>' +
            '</button>' +
            '<a href="' + escapeHtml(folderUrl) + '" target="_blank" rel="noopener noreferrer" class="btn-tech-outline !py-1 !px-2 !text-[10px] shrink-0" title="Open this folder in Google Drive">Folder →</a>' +
          '</div>' +
          (body ? '<div class="divide-y divide-[#e8f3ec]">' + body + '</div>' : '') +
        '</div>';
      }).join('');

      if (statusEl) {
        statusEl.textContent = searchQuery ? (matchedFolders.length + ' of ' + validFolders.length + ' folder(s) match') : '';
      }
    }


    // ── READER SOURCE SWITCHER (v1.1.0) ──────────────────────────────────────
    function renderDriveReaderSourceBar(sources, activeId) {
      const bar = document.getElementById('gdrive-reader-sources');
      if (!bar) return;
      const list = sources || [];
      // Nothing to choose between: keep the chrome out of the way.
      if (list.length <= 1) {
        bar.classList.add('hidden');
        bar.innerHTML = '';
        return;
      }
      const active = list.find(s => s.id === activeId) || list[0];
      bar.innerHTML = list.map(s => `
        <button
          type="button"
          onclick="selectDriveReaderSource('${jsAttrQuote(String(s.id))}')"
          class="btn-tech-outline !py-1 !px-2 !text-[10px] ${s.id === active.id ? 'active-view' : ''}"
          title="${jsAttrQuote(s.note || s.label)}"
          aria-pressed="${s.id === active.id ? 'true' : 'false'}"
        >${escapeHtml(s.label)}</button>
      `).join('') + `<span class="font-mono-tech text-[10px] text-[#56735f] ml-auto truncate">${escapeHtml(active.note || '')}</span>`;
      bar.classList.remove('hidden');
    }

    function describeDriveFile(file, built, source) {
      const sizeStr = formatFileSize(file && file.size);
      const modStr = (file && file.modifiedTime)
        ? new Date(file.modifiedTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';
      const label = (built && built.meta ? built.meta.label : 'FILE');
      return label + (sizeStr ? ' • ' + sizeStr : '') + (modStr ? ' • Updated ' + modStr : '') +
        ' • ' + (source ? source.label : 'viewer');
    }

    function selectDriveReaderSource(sourceId) {
      const file = globalDriveFilesMap[activeDriveFileId];
      if (!file) return;
      const built = buildDriveReaderSources(file);
      const chosen = built.sources.find(s => s.id === sourceId);
      if (!chosen) return;
      activeDriveReaderSources = built.sources;
      activeDriveSourceId = chosen.id;
      saveDriveReaderPref(built.kind, chosen.id);   // remembered per file kind
      renderDriveReaderSourceBar(built.sources, chosen.id);
      applyDriveReaderSource(file, chosen, built);
      const metaEl = document.getElementById('gdrive-reader-meta');
      if (metaEl) metaEl.textContent = describeDriveFile(file, built, chosen);
    }

    function applyDriveReaderSource(file, source, built) {
      const emptyEl = document.getElementById('gdrive-reader-empty');
      const iframeEl = document.getElementById('gdrive-pdf-iframe');
      const nativeEl = document.getElementById('gdrive-native-host');
      const badgeEl = document.getElementById('gdrive-reader-badge');
      const info = built || buildDriveReaderSources(file);
      const meta = info.meta || DRIVE_KIND_META.other;

      if (emptyEl) emptyEl.classList.add('hidden');
      // Any in-flight native parse is invalidated the moment the operator swaps source.
      activeDriveNativeToken += 1;

      if (source && source.id === 'native') {
        if (iframeEl) {
          iframeEl.src = 'about:blank';
          iframeEl.classList.add('hidden');
        }
        if (nativeEl) nativeEl.classList.remove('hidden');
        if (badgeEl) {
          badgeEl.className = 'tech-badge ' + meta.badge;
          badgeEl.textContent = meta.label + ' // IN-APP';
        }
        renderNativeDriveFile(file, activeDriveNativeToken);
        return;
      }

      if (nativeEl) {
        nativeEl.classList.add('hidden');
        nativeEl.innerHTML = '';
      }
      nativeWorkbook = null;
      if (iframeEl) {
        iframeEl.src = (source && source.url) ? source.url : 'about:blank';
        iframeEl.classList.remove('hidden');
        iframeEl.title = meta.label + ' reader — ' + ((source && source.label) || 'viewer');
      }
      if (badgeEl) {
        badgeEl.className = 'tech-badge ' + meta.badge;
        badgeEl.textContent = meta.label + ' READER';
      }
    }

    function openDriveFileInReader(fileId, scrollOnMobile = true) {
      const file = globalDriveFilesMap[fileId];
      if (!file) return;

      activeDriveFileId = fileId;
      renderDriveFoldersTree();

      const built = buildDriveReaderSources(file);
      activeDriveReaderSources = built.sources;
      activeDriveSourceId = built.sourceId;

      const titleEl = document.getElementById('gdrive-reader-title');
      const metaEl = document.getElementById('gdrive-reader-meta');
      const externalLinkEl = document.getElementById('gdrive-external-link');
      const downloadLinkEl = document.getElementById('gdrive-download-link');

      if (titleEl) titleEl.textContent = file.name || 'Untitled document';

      const chosen = built.sources.find(s => s.id === built.sourceId) || built.sources[0];
      if (metaEl) metaEl.textContent = describeDriveFile(file, built, chosen);

      // "Open in Drive" always goes to the canonical Drive page for the file.
      const directDriveUrl = file.webViewLink || ('https://drive.google.com/file/d/' + encodeURIComponent(file.id) + '/view');
      if (externalLinkEl) {
        externalLinkEl.href = directDriveUrl;
        externalLinkEl.classList.remove('hidden');
      }
      if (downloadLinkEl) {
        downloadLinkEl.href = getDriveDirectDownloadUrl(file);
        downloadLinkEl.classList.remove('hidden');
      }

      renderDriveReaderSourceBar(built.sources, built.sourceId);
      applyDriveReaderSource(file, chosen, built);

      if (scrollOnMobile && window.innerWidth < 1024) {
        const panel = document.getElementById('gdrive-reader-panel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }


    // ── IN-APP RENDERERS (v1.1.0) ────────────────────────────────────────────
    // Third-party preview frames are blocked or empty more often than you would think
    // (third-party cookies, organisational policy, a file Drive refuses to convert). This
    // path downloads the bytes through the Drive API and parses them in this page, so the
    // document still opens. Parsers are lazy-loaded from cdn.jsdelivr.net the first time a
    // format is used — nothing is added to the boot path.
    const READER_LIBRARIES = {
      mammoth: { url: 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js', global: 'mammoth' },
      xlsx: { url: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', global: 'XLSX' },
      jszip: { url: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', global: 'JSZip' }
    };
    const readerLibPromises = {};

    function loadReaderLibrary(key) {
      const spec = READER_LIBRARIES[key];
      if (!spec) return Promise.reject(new Error('Unknown reader library: ' + key));
      if (window[spec.global]) return Promise.resolve(window[spec.global]);
      if (readerLibPromises[key]) return readerLibPromises[key];

      readerLibPromises[key] = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = spec.url;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onload = () => {
          if (window[spec.global]) resolve(window[spec.global]);
          else reject(new Error(spec.global + ' loaded but did not register a global'));
        };
        script.onerror = () => {
          delete readerLibPromises[key];   // let a later attempt retry
          reject(new Error('Could not load ' + key + ' from cdn.jsdelivr.net'));
        };
        document.head.appendChild(script);
      });
      return readerLibPromises[key];
    }

    async function fetchDriveFileArrayBuffer(file) {
      const apiKey = getEffectiveDriveApiKey();
      const attempts = [];
      if (apiKey && file && file.id) {
        attempts.push('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(file.id) +
          '?alt=media&key=' + encodeURIComponent(apiKey));
      }
      const direct = getDriveDirectDownloadUrl(file);
      if (direct) attempts.push(direct);

      let lastError = null;
      for (const url of attempts) {
        try {
          const res = await fetch(url, { credentials: 'omit' });
          if (!res.ok) { lastError = new Error('HTTP ' + res.status); continue; }
          const buffer = await res.arrayBuffer();
          if (buffer && buffer.byteLength > 0) return buffer;
          lastError = new Error('Empty response');
        } catch (err) {
          lastError = err;
        }
      }
      throw new Error((lastError && lastError.message) || 'Download failed');
    }

    function setNativeReaderHtml(html) {
      const host = document.getElementById('gdrive-native-host');
      if (!host) return;
      host.innerHTML = html;
      host.classList.remove('hidden');
    }

    function showNativeReaderMessage(title, detail, hint) {
      setNativeReaderHtml(
        '<div class="p-5 font-mono-tech text-xs leading-relaxed text-[#0c1f17]">' +
        '<div class="tech-badge badge-amber !text-[10px] mb-2">' + escapeHtml(title) + '</div>' +
        '<p class="text-[#436152] break-words">' + escapeHtml(detail || '') + '</p>' +
        (hint ? '<p class="mt-2 text-[11px] text-[#56735f] leading-relaxed">' + hint + '</p>' : '') +
        '</div>'
      );
    }

    async function renderNativeDriveFile(file, token) {
      const kind = getDriveFileKind(file);
      const meta = DRIVE_KIND_META[kind] || DRIVE_KIND_META.other;
      if (!meta.native) {
        showNativeReaderMessage('NO IN-PAGE RENDERER',
          'In-app rendering supports .docx, .xlsx, .xls, .csv and .pptx.',
          'Use DRIVE PREVIEW or OFFICE ONLINE for this file.');
        return;
      }

      setNativeReaderHtml('<div class="p-5 font-mono-tech text-xs text-[#436152]">⇩ Downloading &amp; parsing ' +
        escapeHtml(file.name || 'document') + '…</div>');

      let buffer;
      try {
        buffer = await fetchDriveFileArrayBuffer(file);
      } catch (err) {
        showNativeReaderMessage('DOWNLOAD BLOCKED', err.message,
          'In-app rendering needs the file shared as “Anyone with the link can view”. Otherwise use DRIVE PREVIEW (works with your Google session) or OFFICE ONLINE.');
        return;
      }
      if (token !== activeDriveNativeToken) return;   // operator already moved on

      if (meta.native === 'docx') return renderNativeDocx(buffer, token);
      if (meta.native === 'sheet') return renderNativeSheet(file, buffer, token);
      if (meta.native === 'slides') return renderNativeSlides(buffer, token);
    }
    async function renderNativeDocx(buffer, token) {
      let mammoth;
      try {
        mammoth = await loadReaderLibrary('mammoth');
      } catch (err) {
        showNativeReaderMessage('RENDERER UNAVAILABLE', err.message,
          'Allow cdn.jsdelivr.net, or switch to DRIVE PREVIEW / OFFICE ONLINE.');
        return;
      }
      if (token !== activeDriveNativeToken) return;

      try {
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer }, {
          // Inline every image as a data URL: the reader has no Drive auth for <img src>.
          convertImage: mammoth.images.imgElement((image) =>
            image.read('base64').then((base64) => ({ src: 'data:' + image.contentType + ';base64,' + base64 })))
        });
        if (token !== activeDriveNativeToken) return;

        const safe = sanitizeNoteHtml(result.value || '', { allowImages: true, allowTables: true });
        const notes = (result.messages || []).slice(0, 4).map(m => escapeHtml(m.message)).join('<br>');
        setNativeReaderHtml(
          '<div class="native-doc">' + (safe || '<p class="text-[#56735f]">This document has no readable text.</p>') + '</div>' +
          (notes ? '<div class="native-doc-notes">PARSE NOTES: ' + notes + '</div>' : '')
        );
      } catch (err) {
        showNativeReaderMessage('DOCX PARSE FAILED', err.message,
          'The file may be password-protected or corrupt. OFFICE ONLINE renders it with full fidelity.');
      }
    }

    async function renderNativeSheet(file, buffer, token) {
      let XLSXLib;
      try {
        XLSXLib = await loadReaderLibrary('xlsx');
      } catch (err) {
        showNativeReaderMessage('RENDERER UNAVAILABLE', err.message,
          'Allow cdn.jsdelivr.net, or switch to DRIVE PREVIEW / OFFICE ONLINE.');
        return;
      }
      if (token !== activeDriveNativeToken) return;

      try {
        const workbook = XLSXLib.read(new Uint8Array(buffer), { type: 'array' });
        if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('No worksheets found in this file');
        }
        nativeWorkbook = { workbook: workbook, fileName: file.name || 'workbook' };
        nativeActiveSheet = workbook.SheetNames[0];
        renderNativeSheetView();
      } catch (err) {
        showNativeReaderMessage('SPREADSHEET PARSE FAILED', err.message,
          'Legacy .xls and password-protected workbooks are best opened with OFFICE ONLINE.');
      }
    }

    // Renders the active worksheet. 400 rows keeps a 50k-row export from locking the tab;
    // the footer says when it truncated.
    function renderNativeSheetView() {
      const host = document.getElementById('gdrive-native-host');
      if (!host || !nativeWorkbook || !window.XLSX) return;
      const workbook = nativeWorkbook.workbook;
      const sheetName = (nativeActiveSheet && workbook.Sheets[nativeActiveSheet])
        ? nativeActiveSheet
        : workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const maxRows = 400;
      const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false, defval: '' });
      const shown = rows.slice(0, maxRows);

      let width = 0;
      shown.forEach((row) => { width = Math.max(width, row.length); });

      const bodyHtml = shown.map((row, rowIndex) => {
        const cells = [];
        for (let col = 0; col < width; col += 1) {
          const raw = row[col] === undefined || row[col] === null ? '' : String(row[col]);
          const tag = rowIndex === 0 ? 'th' : 'td';
          cells.push('<' + tag + '>' + escapeHtml(raw) + '</' + tag + '>');
        }
        return '<tr>' + cells.join('') + '</tr>';
      }).join('');

      const tabs = workbook.SheetNames.map(name =>
        '<button type="button" onclick="selectNativeSheet(\'' + jsAttrQuote(name) + '\')" ' +
        'class="btn-tech-outline !py-1 !px-2 !text-[10px] ' + (name === sheetName ? 'active-view' : '') + '">' +
        escapeHtml(name) + '</button>'
      ).join('');

      host.innerHTML =
        '<div class="native-sheet">' +
        '<div class="native-sheet-tabs">' + tabs + '</div>' +
        '<div class="native-sheet-wrap"><table class="native-sheet-table"><tbody>' +
        (bodyHtml || '<tr><td class="text-[#56735f]">This worksheet is empty.</td></tr>') +
        '</tbody></table></div>' +
        '<div class="native-sheet-foot">' + shown.length + ' row(s) · ' + width + ' column(s)' +
        (rows.length > maxRows ? ' · showing the first ' + maxRows + ' of ' + rows.length : '') +
        ' · ' + escapeHtml(nativeWorkbook.fileName) + '</div>' +
        '</div>';
    }

    function selectNativeSheet(sheetName) {
      nativeActiveSheet = sheetName;
      renderNativeSheetView();
    }
    async function renderNativeSlides(buffer, token) {
      let JSZipLib;
      try {
        JSZipLib = await loadReaderLibrary('jszip');
      } catch (err) {
        showNativeReaderMessage('RENDERER UNAVAILABLE', err.message,
          'Allow cdn.jsdelivr.net, or switch to OFFICE ONLINE for full slide visuals.');
        return;
      }
      if (token !== activeDriveNativeToken) return;

      try {
        const zip = await JSZipLib.loadAsync(buffer);
        const slidePaths = Object.keys(zip.files)
          .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .sort((a, b) => {
            const na = parseInt((a.match(/slide(\d+)\.xml/) || [])[1] || '0', 10);
            const nb = parseInt((b.match(/slide(\d+)\.xml/) || [])[1] || '0', 10);
            return na - nb;
          });
        if (slidePaths.length === 0) throw new Error('No slides found inside the .pptx package');

        const slides = [];
        for (const path of slidePaths) {
          const xml = await zip.files[path].async('string');
          slides.push(extractPptxSlideLines(xml));
        }
        if (token !== activeDriveNativeToken) return;

        const cards = slides.map((lines, index) => {
          const body = lines.length
            ? lines.map((line, i) => '<div class="' + (i === 0 ? 'native-slide-title' : 'native-slide-line') + '">' +
                escapeHtml(line) + '</div>').join('')
            : '<div class="native-slide-line text-[#56735f]">(no text on this slide)</div>';
          return '<div class="native-slide-card"><div class="native-slide-index">SLIDE ' +
            (index + 1) + ' / ' + slides.length + '</div>' + body + '</div>';
        }).join('');

        setNativeReaderHtml(
          '<div class="native-slides">' +
          '<div class="native-slide-note">TEXT OUTLINE — shapes, images, charts and transitions need OFFICE ONLINE.</div>' +
          cards +
          '</div>'
        );
      } catch (err) {
        showNativeReaderMessage('PPTX PARSE FAILED', err.message,
          'Use OFFICE ONLINE to see the rendered slides.');
      }
    }

    // Pulls the visible text runs (<a:t>) out of one slide's XML. Good enough for revision
    // notes and lecture outlines; deliberately not a layout engine.
    function extractPptxSlideLines(slideXml) {
      try {
        const doc = new DOMParser().parseFromString(slideXml, 'application/xml');
        const runs = Array.from(doc.getElementsByTagName('a:t'));
        const lines = runs
          .map(node => String(node.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .filter((line, index, all) => all.indexOf(line) === index);
        return lines.slice(0, 60);
      } catch (e) {
        return [];
      }
    }

    function openDriveFolderEmbedInReader(folderId, folderTitle) {
      if (!folderId) return;
      // A folder view is not a document: clear the source bar and the in-app host.
      const srcBarEl = document.getElementById('gdrive-reader-sources');
      const nativeHostEl = document.getElementById('gdrive-native-host');
      if (srcBarEl) { srcBarEl.classList.add('hidden'); srcBarEl.innerHTML = ''; }
      if (nativeHostEl) { nativeHostEl.classList.add('hidden'); nativeHostEl.innerHTML = ''; }
      activeDriveNativeToken += 1;
      nativeWorkbook = null;
      const emptyEl = document.getElementById('gdrive-reader-empty');
      const iframeEl = document.getElementById('gdrive-pdf-iframe');
      const titleEl = document.getElementById('gdrive-reader-title');
      const metaEl = document.getElementById('gdrive-reader-meta');
      const badgeEl = document.getElementById('gdrive-reader-badge');
      const extLinkEl = document.getElementById('gdrive-external-link');
      const dlLinkEl = document.getElementById('gdrive-download-link');

      if (badgeEl) badgeEl.textContent = 'GOOGLE DRIVE FOLDER';
      if (titleEl) titleEl.textContent = folderTitle || 'Google Drive Folder';
      if (metaEl) metaEl.textContent = `Embedded Google Drive Folder View • ID: ${folderId}`;
      if (dlLinkEl) dlLinkEl.classList.add('hidden');
      if (extLinkEl) {
        extLinkEl.href = `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
        extLinkEl.classList.remove('hidden');
      }
      if (emptyEl) emptyEl.classList.add('hidden');
      if (iframeEl) {
        iframeEl.src = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
        iframeEl.classList.remove('hidden');
      }
    }

    function toggleDriveReaderHeight() {
      const viewport = document.getElementById('gdrive-reader-viewport');
      const btn = document.getElementById('gdrive-expand-View-btn');
      if (!viewport) return;
      isDriveReaderTall = !isDriveReaderTall;
      if (isDriveReaderTall) {
        viewport.className = 'w-full h-[78vh] sm:h-[84vh] tech-grid-bg border border-[#c5ded0] relative overflow-hidden flex items-center justify-center transition-all duration-200';
        if (btn) btn.textContent = '⤡ Standard View';
      } else {
        viewport.className = 'w-full h-[460px] sm:h-[680px] tech-grid-bg border border-[#c5ded0] relative overflow-hidden flex items-center justify-center transition-all duration-200';
        if (btn) btn.textContent = '⤢ Tall View';
      }
    }

    // ==========================================
    // 10G. EDUCATIONAL YOUTUBE PLAYLISTS & VIDEOS VAULT (ANY CHANNEL)
    // ==========================================
    let globalYoutubeResources = [];
    let activeYoutubeResourceId = null;
    let editingYoutubeId = null;
    let ytUseNoCookieHost = false;
    let ytPlaylistVideosCache = {}; // listId -> array of { videoId, title }
    let activePlaylistSelectedVideoId = '';

    function getYoutubeEmbedDomain() {
      return ytUseNoCookieHost ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
    }

    // Parses any YouTube Playlist URL, Watch URL (with or without list=), Share URL, or raw ID
    function parseYoutubeUrlOrId(rawInput, overrideVideoId = '') {
      const str = String(rawInput || '').trim();
      if (!str) return null;

      let listId = '';
      let videoId = overrideVideoId || '';

      const listMatch = str.match(/[?&]list=([a-zA-Z0-9_-]+)/);
      if (listMatch && listMatch[1]) listId = listMatch[1];

      if (!videoId) {
        const vidWatchMatch = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        const vidShortMatch = str.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        const vidEmbedMatch = str.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/);

        if (vidWatchMatch && vidWatchMatch[1]) videoId = vidWatchMatch[1];
        else if (vidShortMatch && vidShortMatch[1]) videoId = vidShortMatch[1];
        else if (vidEmbedMatch && vidEmbedMatch[1]) videoId = vidEmbedMatch[1];
      }

      // If user pasted a raw ID or composite "VIDEO_ID|LIST_ID"
      if (!listId && !videoId) {
        if (str.includes('|')) {
          const [vPart, lPart] = str.split('|');
          if (vPart && vPart.length === 11) videoId = vPart;
          if (lPart) listId = lPart;
        } else if (/^(PL|OL|UU|FL|RD)[a-zA-Z0-9_-]{10,}$/.test(str)) {
          listId = str;
        } else if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
          videoId = str;
        }
      }

      const host = getYoutubeEmbedDomain();
      const originParam = window.location.protocol.startsWith('http')
        ? `&origin=${encodeURIComponent(window.location.origin)}`
        : '';

      if (listId) {
        // Using /embed/{VIDEO_ID}?list={LIST_ID} avoids YouTube's Error 153 on /embed/videoseries
        const embedUrl = videoId
          ? `${host}/embed/${encodeURIComponent(videoId)}?list=${encodeURIComponent(listId)}&rel=0${originParam}`
          : `${host}/embed?listType=playlist&list=${encodeURIComponent(listId)}&rel=0${originParam}`;

        const watchUrl = videoId
          ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&list=${encodeURIComponent(listId)}`
          : `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;

        return {
          resourceType: 'PLAYLIST',
          ytId: videoId ? `${videoId}|${listId}` : listId,
          listId,
          videoId,
          embedUrl,
          watchUrl
        };
      }

      if (videoId) {
        return {
          resourceType: 'VIDEO',
          ytId: videoId,
          listId: '',
          videoId,
          embedUrl: `${host}/embed/${encodeURIComponent(videoId)}?rel=0${originParam}`,
          watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
        };
      }
      return null;
    }

    // Automatically resolves the individual video IDs & titles inside a YouTube Playlist
    // so we can embed /embed/{VIDEO_ID}?list={LIST_ID} and avoid Error 153 on /embed/videoseries
    async function resolvePlaylistVideos(listId) {
      if (!listId) return [];
      if (ytPlaylistVideosCache[listId] && ytPlaylistVideosCache[listId].length > 0) {
        return ytPlaylistVideosCache[listId];
      }

      // 1. Try YouTube Data API v3 first if an API key is configured
      const apiKey = getEffectiveDriveApiKey();
      if (apiKey) {
        try {
          const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(listId)}&key=${encodeURIComponent(apiKey)}`;
          const res = await fetch(apiUrl);
          if (res.ok) {
            const data = await res.json();
            const items = (data.items || [])
              .map(it => ({
                videoId: it.snippet?.resourceId?.videoId,
                title: it.snippet?.title || 'Lecture Video'
              }))
              .filter(v => v.videoId && v.title !== 'Private video' && v.title !== 'Deleted video');
            if (items.length > 0) {
              ytPlaylistVideosCache[listId] = items;
              return items;
            }
          }
        } catch (e) {}
      }

      // 2. Keyless fallback: YouTube's RSS feed sends no CORS header, so it has to be
      //    relayed. This is a THIRD-PARTY hop — the playlist id leaves the browser through
      //    somebody else's server. corsproxy.io was dropped: its API changed to ?url= and the
      //    failure was silent, so it only ever cost a wasted round trip. Configure a YouTube
      //    API key below and this path is never taken.
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(listId)}`;
      const proxyUrls = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`
      ];

      for (const proxyUrl of proxyUrls) {
        try {
          const res = await fetch(proxyUrl);
          if (!res.ok) continue;
          const xmlText = await res.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
          const entries = Array.from(xmlDoc.querySelectorAll('entry'));
          const items = entries.map(entry => {
            const vidNode = entry.getElementsByTagName('yt:videoId')[0] || entry.querySelector('videoId');
            const titleNode = entry.querySelector('title');
            return {
              videoId: vidNode ? vidNode.textContent.trim() : '',
              title: titleNode ? titleNode.textContent.trim() : 'Lecture Video'
            };
          }).filter(v => v.videoId);

          if (items.length > 0) {
            ytPlaylistVideosCache[listId] = items;
            return items;
          }
        } catch (e) {}
      }

      return [];
    }

    function toggleYoutubeEmbedHostMode() {
      ytUseNoCookieHost = !ytUseNoCookieHost;
      showToast(
        'PLAYER MODE SWITCHED',
        ytUseNoCookieHost ? 'Switched to YouTube No-Cookie Embed.' : 'Switched to Standard YouTube Embed.'
      );
      if (activeYoutubeResourceId) {
        loadYoutubeResourceInPlayer(activeYoutubeResourceId, false, activePlaylistSelectedVideoId);
      }
    }

    async function fetchAndRenderYoutubeResources() {
      const { data, error } = await supabaseClient
        .from('youtube_resources')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('youtube_resources fetch note:', error.message);
      }

      globalYoutubeResources = data || [];
      renderYoutubeResources();

      if (!activeYoutubeResourceId && globalYoutubeResources.length > 0) {
        loadYoutubeResourceInPlayer(globalYoutubeResources[0].id, false);
      }
    }

    function renderYoutubeResources() {
      const listEl = document.getElementById('yt-resources-list');
      const countEl = document.getElementById('yt-total-count');
      const searchEl = document.getElementById('yt-search-input');
      const hiddenTbody = document.getElementById('yt-export-hidden-tbody');
      if (!listEl) return;

      const isOwner = Boolean(currentUser);
      const q = searchEl ? searchEl.value.trim().toLowerCase() : '';

      const filtered = globalYoutubeResources.filter(item => {
        if (!q) return true;
        return (
          (item.title || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q) ||
          (item.channel_name || '').toLowerCase().includes(q)
        );
      });

      if (countEl) countEl.textContent = filtered.length;

      if (hiddenTbody) {
        hiddenTbody.innerHTML = globalYoutubeResources.map(item => `
          <tr>
            <td>${escapeHtml(item.title || '')}</td>
            <td>${escapeHtml(item.resource_type || 'PLAYLIST')}</td>
            <td>${escapeHtml(item.category || 'GENERAL')}</td>
            <td>${escapeHtml(item.channel_name || '')}</td>
            <td>${escapeHtml(item.url || '')}</td>
          </tr>
        `).join('');
      }

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div class="p-8 text-center font-mono-tech text-xs text-[#56735f]">
            No educational YouTube playlists or videos saved yet. Paste any YouTube playlist or video link above to add one.
          </div>
        `;
        return;
      }

      listEl.innerHTML = filtered.map((item, idx) => {
        const isSelected = activeYoutubeResourceId === item.id;
        const isPlaylist = (item.resource_type || 'PLAYLIST') === 'PLAYLIST';

        if (isOwner && editingYoutubeId === item.id) {
          return `
            <div class="p-3 bg-[#eff8f2] flex flex-col gap-2">
              <div class="font-mono-tech text-[10px] uppercase text-[#047857] font-bold">Edit EDIT YOUTUBE RESOURCE</div>
              <input type="text" id="edit-yt-title-${item.id}" value="${escapeHtml(item.title || '')}" placeholder="Title" class="tech-input !py-1 !px-2 !text-xs">
              <input type="text" id="edit-yt-url-${item.id}" value="${escapeHtml(item.url || '')}" placeholder="YouTube URL or ID" class="tech-input !py-1 !px-2 !text-xs">
              <div class="grid grid-cols-2 gap-2">
                <select id="edit-yt-cat-${item.id}" class="tech-input !py-1 !px-2 !text-xs">
                  <option value="MATH" ${item.category === 'MATH' ? 'selected' : ''}>MATH</option>
                  <option value="PHYSICS" ${item.category === 'PHYSICS' ? 'selected' : ''}>PHYSICS</option>
                  <option value="CS / AI" ${item.category === 'CS / AI' ? 'selected' : ''}>CS / AI</option>
                  <option value="CHEMISTRY" ${item.category === 'CHEMISTRY' ? 'selected' : ''}>CHEMISTRY</option>
                  <option value="COMPETITION" ${item.category === 'COMPETITION' ? 'selected' : ''}>COMPETITION</option>
                  <option value="GENERAL" ${item.category === 'GENERAL' ? 'selected' : ''}>GENERAL</option>
                </select>
                <input type="text" id="edit-yt-chan-${item.id}" value="${escapeHtml(item.channel_name || '')}" placeholder="Channel / Notes" class="tech-input !py-1 !px-2 !text-xs">
              </div>
              <div class="flex items-center justify-end gap-1.5 pt-1">
                <button type="button" onclick="cancelEditYoutubeResource()" class="btn-tech-outline !py-1 !px-2.5 !text-[11px]">Cancel</button>
                <button type="button" onclick="saveEditedYoutubeResource('${item.id}')" class="btn-chamfer !py-1 !px-3 !text-xs">Save</button>
              </div>
            </div>
          `;
        }

        return `
          <div
            onclick="loadYoutubeResourceInPlayer('${item.id}', true)"
            class="p-3 flex flex-col gap-2 cursor-pointer transition-colors ${
              isSelected ? 'bg-[#dcfce7] border-l-4 border-l-[#059669]' : 'bg-white hover:bg-[#f4faf6]'
            }"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="tech-badge ${isPlaylist ? 'badge-red' : 'badge-blue'} !text-[9px] !py-0 !px-1.5">
                    ${isPlaylist ? 'MENU PLAYLIST' : 'VIDEO'}
                  </span>
                  <span class="tech-badge badge-green !text-[9px] !py-0 !px-1.5">${escapeHtml(item.category || 'GENERAL')}</span>
                </div>
                <div class="font-bold text-xs sm:text-sm text-[#0c1f17] mt-1 break-words leading-snug">
                  ${escapeHtml(item.title || 'Untitled Stream')}
                </div>
                ${item.channel_name ? `
                  <div class="font-mono-tech text-[10px] text-[#436152] mt-0.5 truncate">
                    ◈ ${escapeHtml(item.channel_name)}
                  </div>
                ` : ''}
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-[#e8f3ec]" onclick="event.stopPropagation()">
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  onclick="loadYoutubeResourceInPlayer('${item.id}', true)"
                  class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${isSelected ? 'active-view' : ''}"
                >
                  Watch Here
                </button>
                <a
                  href="${escapeHtml(item.url || '#')}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-tech-outline !py-0.5 !px-2 !text-[10px]"
                >
                  YouTube →
                </a>
              </div>

              ${isOwner ? `
                <div class="flex items-center gap-1">
                  <button type="button" onclick="moveYoutubeResource('${item.id}', -1)" ${idx === 0 ? 'disabled' : ''} class="touch-action-btn !min-w-[22px] !min-h-[24px] !px-1 disabled:opacity-30" title="Move up">▲</button>
                  <button type="button" onclick="moveYoutubeResource('${item.id}', 1)" ${idx === filtered.length - 1 ? 'disabled' : ''} class="touch-action-btn !min-w-[22px] !min-h-[24px] !px-1 disabled:opacity-30" title="Move down">▼</button>
                  <button type="button" onclick="startEditYoutubeResource('${item.id}')" class="touch-action-btn !min-w-[24px] !min-h-[24px] !px-1" title="Edit">Edit</button>
                  <button type="button" onclick="deleteYoutubeResource('${item.id}')" class="touch-action-btn danger !min-w-[24px] !min-h-[24px] !px-1" title="Delete">×</button>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    async function loadYoutubeResourceInPlayer(resourceId, scrollOnMobile = false, specificVideoId = '') {
      const item = globalYoutubeResources.find(r => r.id === resourceId);
      if (!item) return;

      activeYoutubeResourceId = item.id;
      activePlaylistSelectedVideoId = specificVideoId || '';
      renderYoutubeResources();

      const fileWarnEl = document.getElementById('yt-file-protocol-warning');
      if (fileWarnEl) {
        if (window.location.protocol === 'file:') fileWarnEl.classList.remove('hidden');
        else fileWarnEl.classList.add('hidden');
      }

      let parsed = parseYoutubeUrlOrId(item.url || item.yt_id, specificVideoId);
      const badgeEl = document.getElementById('yt-player-badge');
      const catBadgeEl = document.getElementById('yt-player-cat-badge');
      const titleEl = document.getElementById('yt-player-title');
      const metaEl = document.getElementById('yt-player-meta');
      const emptyEl = document.getElementById('yt-player-empty');
      const iframeEl = document.getElementById('yt-embed-iframe');
      const extLinkEl = document.getElementById('yt-external-link');
      const switchHostBtn = document.getElementById('yt-switch-host-btn');
      const episodesBox = document.getElementById('yt-episodes-box');
      const episodesListEl = document.getElementById('yt-episodes-list');
      const episodesStatusEl = document.getElementById('yt-episodes-status');

      if (badgeEl) badgeEl.textContent = item.resource_type === 'VIDEO' ? 'YOUTUBE LECTURE' : 'MENU YOUTUBE PLAYLIST';
      if (catBadgeEl) {
        catBadgeEl.textContent = item.category || 'GENERAL';
        catBadgeEl.classList.remove('hidden');
      }
      if (titleEl) titleEl.textContent = item.title || 'Educational Stream';
      if (metaEl) {
        metaEl.textContent = item.channel_name
          ? `Channel / Notes: ${item.channel_name}`
          : 'Click any episode below or use the player controls to switch lectures.';
      }
      if (switchHostBtn) switchHostBtn.classList.remove('hidden');

      // If this is a playlist, resolve its individual videos so we can embed /embed/{VIDEO_ID}?list={LIST_ID}
      // (This prevents YouTube's Error 153 on bare playlist embeds)
      if (parsed && parsed.listId) {
        if (episodesBox) episodesBox.classList.remove('hidden');
        if (episodesStatusEl) episodesStatusEl.textContent = 'Resolving playlist videos...';

        const episodes = await resolvePlaylistVideos(parsed.listId);
        if (episodes.length > 0) {
          const chosenVid = specificVideoId || parsed.videoId || episodes[0].videoId;
          activePlaylistSelectedVideoId = chosenVid;
          parsed = parseYoutubeUrlOrId(item.url || item.yt_id, chosenVid);

          if (episodesStatusEl) episodesStatusEl.textContent = `${episodes.length} lectures indexed`;
          if (episodesListEl) {
            episodesListEl.innerHTML = episodes.map((ep, idx) => {
              const isCurrentEp = ep.videoId === chosenVid;
              return `
                <button
                  type="button"
                  onclick="loadYoutubeResourceInPlayer('${item.id}', false, '${ep.videoId}')"
                  class="w-full text-left px-2.5 py-1.5 border font-mono-tech text-xs flex items-center justify-between gap-2 transition-colors ${
                    isCurrentEp
                      ? 'bg-[#059669] text-white border-[#047857] font-bold'
                      : 'bg-white text-[#0c1f17] border-[#c5ded0] hover:bg-[#dcfce7]'
                  }"
                >
                  <span class="truncate">${idx + 1}. ${escapeHtml(ep.title)}</span>
                  <span class="text-[10px] shrink-0">${isCurrentEp ? 'PLAYING' : 'PLAY'}</span>
                </button>
              `;
            }).join('');
          }
        } else {
          if (episodesStatusEl) episodesStatusEl.textContent = 'Use player menu (top-right) to switch videos';
          if (episodesListEl) {
            episodesListEl.innerHTML = `
              <div class="font-mono-tech text-[11px] text-[#436152]">
                Tip: If a playlist shows Error 153, click <strong>Edit</strong> on the playlist and paste the URL of the <strong>first video inside the playlist</strong> (e.g. <code>youtube.com/watch?v=...&amp;list=PL...</code>).
              </div>
            `;
          }
        }
      } else {
        if (episodesBox) episodesBox.classList.add('hidden');
      }

      const embedSrc = parsed ? parsed.embedUrl : '';
      const watchHref = parsed ? parsed.watchUrl : (item.url || '#');

      if (extLinkEl) {
        extLinkEl.href = watchHref;
        extLinkEl.classList.remove('hidden');
      }

      if (embedSrc && iframeEl) {
        if (emptyEl) emptyEl.classList.add('hidden');
        iframeEl.src = embedSrc;
        iframeEl.classList.remove('hidden');
      }

      if (scrollOnMobile && window.innerWidth < 1024) {
        const panel = document.getElementById('yt-player-panel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    onReady('add-yt-form', 'submit', async (e) => {
      e.preventDefault();
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to add YouTube resources.', true);

      const title = document.getElementById('yt-title-input').value.trim();
      const rawUrl = document.getElementById('yt-url-input').value.trim();
      const category = document.getElementById('yt-category-input').value;
      const channelName = document.getElementById('yt-channel-input').value.trim();

      const parsed = parseYoutubeUrlOrId(rawUrl);
      if (!parsed) {
        return showToast('INVALID YOUTUBE LINK', 'Paste a valid YouTube Playlist URL (list=...) or Video URL (watch?v=... / youtu.be/...).', true);
      }

      const nextSortOrder = globalYoutubeResources.length > 0
        ? Math.max(...globalYoutubeResources.map(r => Number(r.sort_order) || 0)) + 1
        : 1;

      const { data, error } = await supabaseClient
        .from('youtube_resources')
        .insert({
          title,
          url: parsed.watchUrl,
          yt_id: parsed.ytId,
          resource_type: parsed.resourceType,
          category,
          channel_name: channelName,
          sort_order: nextSortOrder
        })
        .select()
        .single();

      if (error) {
        showToast('DATABASE ERROR', error.message, true);
      } else {
        document.getElementById('yt-title-input').value = '';
        document.getElementById('yt-url-input').value = '';
        document.getElementById('yt-channel-input').value = '';
        if (data && data.id) activeYoutubeResourceId = data.id;
        showToast('YOUTUBE RESOURCE ADDED', `Added ${parsed.resourceType}: "${title}".`);
        await fetchAndRenderYoutubeResources();
        if (data && data.id) loadYoutubeResourceInPlayer(data.id, false);
      }
    });

    function startEditYoutubeResource(id) {
      if (!currentUser) return;
      editingYoutubeId = id;
      renderYoutubeResources();
    }

    function cancelEditYoutubeResource() {
      editingYoutubeId = null;
      renderYoutubeResources();
    }

    async function saveEditedYoutubeResource(id) {
      if (!currentUser) return;
      const newTitle = document.getElementById(`edit-yt-title-${id}`)?.value.trim();
      const newRawUrl = document.getElementById(`edit-yt-url-${id}`)?.value.trim();
      const newCat = document.getElementById(`edit-yt-cat-${id}`)?.value || 'GENERAL';
      const newChan = document.getElementById(`edit-yt-chan-${id}`)?.value.trim() || '';

      const parsed = parseYoutubeUrlOrId(newRawUrl);
      if (!newTitle || !parsed) {
        return showToast('INVALID INPUT', 'Please provide a title and a valid YouTube playlist or video URL.', true);
      }

      const { error } = await supabaseClient
        .from('youtube_resources')
        .update({
          title: newTitle,
          url: parsed.watchUrl,
          yt_id: parsed.ytId,
          resource_type: parsed.resourceType,
          category: newCat,
          channel_name: newChan
        })
        .eq('id', id);

      editingYoutubeId = null;
      if (error) {
        showToast('UPDATE ERROR', error.message, true);
      } else {
        showToast('YOUTUBE RESOURCE UPDATED', `Saved changes to "${newTitle}".`);
        await fetchAndRenderYoutubeResources();
        if (activeYoutubeResourceId === id) loadYoutubeResourceInPlayer(id, false);
      }
    }

    async function moveYoutubeResource(id, delta) {
      if (!currentUser) return;
      const idx = globalYoutubeResources.findIndex(r => r.id === id);
      if (idx === -1) return;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= globalYoutubeResources.length) return;

      const reordered = globalYoutubeResources.slice();
      const temp = reordered[idx];
      reordered[idx] = reordered[targetIdx];
      reordered[targetIdx] = temp;

      await Promise.all(
        reordered.map((r, i) =>
          supabaseClient.from('youtube_resources').update({ sort_order: i + 1 }).eq('id', r.id)
        )
      );
      fetchAndRenderYoutubeResources();
    }

    function deleteYoutubeResource(id) {
      if (!currentUser) return;
      const target = globalYoutubeResources.find(r => r.id === id);
      confirmAction(
        `Delete YouTube Resource "${target ? target.title : 'this item'}"?`,
        'This will permanently remove this playlist/video from your Resource Vault.',
        async () => {
          const { error } = await supabaseClient
            .from('youtube_resources')
            .delete()
            .eq('id', id);

          if (error) showToast('DELETE ERROR', error.message, true);
          else {
            if (activeYoutubeResourceId === id) activeYoutubeResourceId = null;
            showToast('RESOURCE DELETED', 'Removed YouTube resource.', false, () => restoreDeletedRow('youtube_resources', target, fetchAndRenderYoutubeResources));
            fetchAndRenderYoutubeResources();
          }
        }
      );
    }

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

    // ==========================================
    // TERMINAL CLI INGESTION ENGINE (>_ QUICK PARSE)
    // ==========================================
    function prefillCliCommand(cmdText) {
      closeModal('cli-help-modal');
      const body = document.getElementById('terminal-drawer-body');
      const chev = document.getElementById('terminal-chevron');
      if (body && body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        body.classList.add('flex');
        if (chev) chev.textContent = '▼';
      }
      const input = document.getElementById('terminal-quick-input');
      if (input) {
        input.value = cmdText;
        input.focus();
      }
    }

    // Parses a free-form duration typed in the terminal into decimal hours.
    // Accepts: 7.5  7.5h  7h 30m  7h30m  45m  2 hours  90 minutes  1:30
    // Returns NaN for unparseable input. (Previously "study 2 hours" logged 0h because the
    // old regex demanded a literal "m", matched neither group, and fell through to 0.)
    function parseDurationToHours(rawText) {
      const text = String(rawText || '').trim();
      if (!text) return NaN;

      const clockMatch = text.match(/^(\d{1,2}):([0-5]\d)$/);
      if (clockMatch) return Number(clockMatch[1]) + (Number(clockMatch[2]) / 60);

      const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*h(?:ou?rs?)?/i);
      const minMatch = text.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?/i);
      if (hourMatch || minMatch) {
        return (hourMatch ? Number(hourMatch[1]) : 0) + (minMatch ? Number(minMatch[1]) / 60 : 0);
      }

      return parseFloat(text);
    }

    async function handleTerminalCliSubmit(e) {
      if (e) e.preventDefault();
      const input = document.getElementById('terminal-quick-input');
      if (!input) return;
      const raw = input.value.trim();
      if (!raw) return;

      const lower = raw.toLowerCase();
      const todayStr = getLocalDateString(new Date());

      // 1. HELP / COMMANDS POPUP
      if (lower === 'help' || lower === '?' || lower === 'commands' || lower === 'cli') {
        input.value = '';
        openModal('cli-help-modal');
        return;
      }

      // 2. TAB NAVIGATION: go <tab>
      const goMatch = lower.match(/^(?:go|open|tab)\s+(study|steps|calendar|tasks|notes|resources|focus)$/);
      if (goMatch) {
        input.value = '';
        switchTab(goMatch[1]);
        showToast('CLI NAVIGATION', `Switched to ${goMatch[1].toUpperCase()} module.`);
        return;
      }

      // 3. STUDY LOGGING: study 7.5 [2026-10-31] OR study 7h 30m [2026-10-31]
      if (lower.startsWith('study ')) {
        if (!currentUser) return showToast('CLI LOCKED', 'Sign in as autumn to log study via CLI.', true);
        const rest = raw.slice(6).trim();
        const dateMatch = rest.match(/(\d{4}-\d{2}-\d{2})/);
        const targetDate = dateMatch ? dateMatch[1] : todayStr;
        const cleanRest = rest.replace(/\d{4}-\d{2}-\d{2}/, '').trim();

        // Duration parsing lives in parseDurationToHours() so it can be unit tested.
        const decimalHours = parseDurationToHours(cleanRest);

        if (!isFinite(decimalHours) || decimalHours < 0 || decimalHours > 24) {
          return showToast('CLI SYNTAX', 'Example: study 7.5 | study 7h 30m | study 45m | study 2 hours', true);
        }

        clearPassUsedLockForDate(targetDate, 'study');
        const { error } = await supabaseClient.from('study_ledger').upsert({
          date: targetDate,
          actual_hours: decimalHours,
          target_hours: getStudyBaseGoalForDate(targetDate),
          source: 'cli'
        }, { onConflict: 'date' });

        if (error) return showToast('CLI DB ERROR', error.message, true);
        input.value = '';
        showToast('CLI // STUDY LOGGED', `Committed ${formatHours(decimalHours)} for ${targetDate}.`);
        await fetchAndRenderStudy();
        return;
      }

      // 4. STEPS LOGGING: steps 10500 [2026-10-31] OR steps 10.5k
      if (lower.startsWith('steps ') || lower.startsWith('step ')) {
        if (!currentUser) return showToast('CLI LOCKED', 'Sign in as autumn to log steps via CLI.', true);
        const rest = raw.replace(/^steps?\s+/i, '').trim();
        const dateMatch = rest.match(/(\d{4}-\d{2}-\d{2})/);
        const targetDate = dateMatch ? dateMatch[1] : todayStr;
        const cleanRest = rest.replace(/\d{4}-\d{2}-\d{2}/, '').trim().toLowerCase();

        let stepsVal = 0;
        if (cleanRest.endsWith('k')) {
          stepsVal = Math.round(parseFloat(cleanRest.slice(0, -1)) * 1000);
        } else {
          stepsVal = parseInt(cleanRest.replace(/,/g, ''), 10);
        }

        if (isNaN(stepsVal) || stepsVal < 0) {
          return showToast('CLI SYNTAX', 'Example: steps 10500  OR  steps 11k 2026-10-31', true);
        }

        clearPassUsedLockForDate(targetDate, 'steps');
        const { error } = await supabaseClient.from('steps_ledger').upsert({
          date: targetDate,
          actual_steps: stepsVal,
          target_steps: getStepsBaseGoalForDate(targetDate),
          source: 'cli'
        }, { onConflict: 'date' });

        if (error) return showToast('CLI DB ERROR', error.message, true);
        input.value = '';
        showToast('CLI // STEPS LOGGED', `Committed ${formatSteps(stepsVal)} steps for ${targetDate}.`);
        await fetchAndRenderSteps();
        return;
      }

      // 5. TASK CREATION: task <Column> | <Task Title> | [YYYY-MM-DD]
      if (lower.startsWith('task ')) {
        if (!currentUser) return showToast('CLI LOCKED', 'Sign in as autumn to add tasks via CLI.', true);
        const rest = raw.slice(5).trim();
        const parts = rest.split('|').map(s => s.trim()).filter(Boolean);
        let targetCol = globalTaskColumns[0];
        let taskTitle = '';
        let dueDate = '';

        if (parts.length === 1) {
          taskTitle = parts[0];
        } else {
          const colQuery = parts[0].toLowerCase();
          const matchedCol = globalTaskColumns.find(c => (c.title || '').toLowerCase().includes(colQuery));
          if (matchedCol) targetCol = matchedCol;
          taskTitle = parts[1];
          if (parts[2]) {
            const dMatch = parts[2].match(/(\d{4}-\d{2}-\d{2})/);
            if (dMatch) dueDate = dMatch[1];
          }
        }

        if (!targetCol) return showToast('CLI TASK ERROR', 'Create a task column in 04 // TASKS first.', true);
        if (!taskTitle) return showToast('CLI SYNTAX', 'Example: task Physics | Mechanics Set 4 | 2026-11-05', true);

        const { data, error } = await supabaseClient
          .from('task_items')
          .insert({ column_id: targetCol.id, title: taskTitle, is_done: false })
          .select()
          .single();

        if (error) return showToast('CLI DB ERROR', error.message, true);
        if (data && data.id && dueDate) {
          taskMetaMap[data.id] = { dueDate, eventId: '' };
          await persistTaskColumnOrder(taskColOrder);
        }
        input.value = '';
        showToast('CLI // TASK ADDED', `Added "${taskTitle}" to ${targetCol.title}${dueDate ? ' (Due ' + dueDate + ')' : ''}.`);
        await fetchAndRenderTasks();
        return;
      }

      // 6. RUN LOGGING: run <5k|10k|half|marathon> <pace> [location] [easy|threshold]
      if (lower.startsWith('run ')) {
        if (!currentUser) return showToast('CLI LOCKED', 'Sign in as autumn to log runs via CLI.', true);
        const tokens = raw.slice(4).trim().split(/\s+/);
        const cat = (tokens[0] || '5k').toLowerCase();
        const paceRaw = tokens[1] || '';
        if (!RUN_CATEGORY_META[cat] || parsePaceToSeconds(paceRaw) === 999999) {
          return showToast('CLI SYNTAX', 'Example: run 5k 05:12 KMPP threshold', true);
        }
        const tail = tokens.slice(2).join(' ');
        const isEasy = /\beasy\b/i.test(tail);
        const isRef = /\bref(?:erence)?\b/i.test(tail);
        const runType = isRef ? 'REFERENCE' : isEasy ? 'EASY' : 'THRESHOLD';
        const location = tail.replace(/\b(easy|threshold|reference|ref)\b/gi, '').trim() || 'CLI Log';
        const paceFormatted = normalizePaceDisplay(paceRaw);
        const totalTime = calculateTotalTimeFromPace(paceFormatted, RUN_CATEGORY_META[cat].km);

        visibleRunCategories[cat] = true;
        const { error } = await supabaseClient.from('running_logs').insert({
          category: cat,
          run_date: isRef ? 'REFERENCE' : todayStr,
          time_str: totalTime,
          pace_str: paceFormatted,
          run_type: runType,
          location
        });
        if (error) return showToast('CLI DB ERROR', error.message, true);
        input.value = '';
        showToast('CLI // RUN LOGGED', `Logged ${cat.toUpperCase()} at ${paceFormatted}/km (${totalTime}).`);
        await fetchAndRenderRunningLogs();
        return;
      }

      // 7. HABIT CHECK-OFF: habit <keyword>
      if (lower.startsWith('habit ')) {
        if (!currentUser) return showToast('CLI LOCKED', 'Sign in as autumn to check habits via CLI.', true);
        const kw = raw.slice(6).trim().toLowerCase();
        const match = globalHabits.find(h => (h.title || '').toLowerCase().includes(kw));
        if (!match) return showToast('HABIT NOT FOUND', `No recurring habit matching "${kw}".`, true);
        input.value = '';
        await toggleHabitCheck(match.id, true);
        showToast('CLI // HABIT CHECKED', `Completed "${match.title}" for current cycle.`);
        return;
      }

      // 8. QUOTA PASS REDEMPTION: pass <study|steps|both|split> [YYYY-MM-DD]
      if (lower.startsWith('pass ')) {
        if (!currentUser) return showToast('CLI LOCKED', 'Sign in as autumn to use passes via CLI.', true);
        const tokens = raw.slice(5).trim().split(/\s+/);
        const sub = (tokens[0] || '').toLowerCase();
        const dateOverride = tokens[1] && /^\d{4}-\d{2}-\d{2}$/.test(tokens[1]) ? tokens[1] : null;
        if (dateOverride) {
          const dateIn = document.getElementById('date-input');
          if (dateIn) dateIn.value = dateOverride;
        }
        input.value = '';
        if (sub === 'split') {
          await splitAPlusPassToTwoA();
        } else if (sub === 'study') {
          await redeemQuotaPass('A_STUDY');
        } else if (sub === 'steps') {
          await redeemQuotaPass('A_STEPS');
        } else if (sub === 'both' || sub === 'aplus' || sub === 'a+') {
          await redeemQuotaPass('APLUS_BOTH');
        } else {
          showToast('CLI SYNTAX', 'Use: pass study | pass steps | pass both | pass split', true);
        }
        return;
      }

      // 9. FALLBACK: Normal timestamped thought in Daily Scratchpad
      if (typeof handleTerminalQuickAppend === 'function') {
        handleTerminalQuickAppend(e);
      }
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

      // Render Study Daily Bar + 7-Day EMA Chart
      const studyEmaCtx = document.getElementById('studyEmaChart')?.getContext('2d');
      if (studyEmaCtx) {
        const recentStudyRows = globalStudyRows.slice(-30);
        const sLabels = recentStudyRows.map(r => r.date.slice(5));
        const sRaw = recentStudyRows.map(r => r.actual_hours);
        const sEma = calcEMA(sRaw, 7);
        if (studyEmaChartInstance) studyEmaChartInstance.destroy();
        studyEmaChartInstance = new Chart(studyEmaCtx, {
          type: 'bar',
          data: {
            labels: sLabels,
            datasets: [
              {
                type: 'line',
                label: '7-Day EMA Trend',
                data: sEma,
                borderColor: '#f59e0b',
                borderWidth: 2.5,
                pointRadius: 0,
                tension: 0.3
              },
              {
                type: 'bar',
                label: 'Daily Study (h)',
                data: sRaw,
                backgroundColor: 'rgba(16, 185, 129, 0.45)',
                borderColor: '#059669',
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { font: { family: 'Inter', size: 10 } } } },
            scales: {
              y: { beginAtZero: true, ticks: { font: { family: 'Inter', size: 10 } } },
              x: { ticks: { font: { family: 'Inter', size: 9 } } }
            }
          }
        });
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

      const stepsEmaCtx = document.getElementById('stepsEmaChart')?.getContext('2d');
      if (stepsEmaCtx) {
        const recentStepsRows = globalStepsRows.slice(-30);
        const stLabels = recentStepsRows.map(r => r.date.slice(5));
        const stRaw = recentStepsRows.map(r => r.actual_steps);
        const stEma = calcEMA(stRaw, 7);
        if (stepsEmaChartInstance) stepsEmaChartInstance.destroy();
        stepsEmaChartInstance = new Chart(stepsEmaCtx, {
          type: 'bar',
          data: {
            labels: stLabels,
            datasets: [
              {
                type: 'line',
                label: '7-Day EMA Trend',
                data: stEma,
                borderColor: '#0284c7',
                borderWidth: 2.5,
                pointRadius: 0,
                tension: 0.3
              },
              {
                type: 'bar',
                label: 'Daily Steps',
                data: stRaw,
                backgroundColor: 'rgba(16, 185, 129, 0.45)',
                borderColor: '#059669',
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { font: { family: 'Inter', size: 10 } } } },
            scales: {
              y: { beginAtZero: true, ticks: { font: { family: 'Inter', size: 10 } } },
              x: { ticks: { font: { family: 'Inter', size: 9 } } }
            }
          }
        });
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

    // ==========================================
    // 10K. EXPORTABLE PNG / SVG FLIGHT RECORDER & WEEKLY JOURNAL STAT CARD GENERATOR
    // ==========================================
    let currentStatCardMode = 'telemetry'; // 'telemetry' | 'journal'

    function setStatCardMode(mode) {
      currentStatCardMode = mode === 'journal' ? 'journal' : 'telemetry';
      const btnT = document.getElementById('stat-card-mode-telemetry');
      const btnJ = document.getElementById('stat-card-mode-journal');
      if (btnT) {
        if (currentStatCardMode === 'telemetry') btnT.classList.add('active-view');
        else btnT.classList.remove('active-view');
      }
      if (btnJ) {
        if (currentStatCardMode === 'journal') btnJ.classList.add('active-view');
        else btnJ.classList.remove('active-view');
      }
      renderStatCardPreview();
    }

    function openStatCardModal(mode = 'telemetry') {
      const dateIn = document.getElementById('stat-card-date-input');
      if (dateIn) {
        dateIn.value = mode === 'journal'
          ? (selectedNoteDate || getWeekMondayDateString(new Date()))
          : getLocalDateString(new Date());
      }
      setStatCardMode(mode);
      openModal('stat-card-modal');
    }

    function getStatCardPalette() {
      const paletteMap = {
        'default': { bg: '#0c1f17', panel: '#112a20', border: '#10b981', text: '#ecfdf5', muted: '#6ee7b7', accent: '#34d399', sky: '#7dd3fc', pink: '#f9a8d4' },
        'amber-crt': { bg: '#120c04', panel: '#1f1407', border: '#ffb000', text: '#ffca4b', muted: '#d48800', accent: '#ffb000', sky: '#ffd27d', pink: '#ff9900' },
        'phosphor-green': { bg: '#041108', panel: '#091f10', border: '#33ff66', text: '#a3ffba', muted: '#1fc74b', accent: '#33ff66', sky: '#6ee7b7', pink: '#86efac' },
        'cyan-cold': { bg: '#041019', panel: '#091d2c', border: '#38bdf8', text: '#e0f2fe', muted: '#0ea5e9', accent: '#38bdf8', sky: '#7dd3fc', pink: '#c084fc' },
        'autumn-oled': { bg: '#000000', panel: '#0a0d0b', border: '#34d399', text: '#f1f5f9', muted: '#94a3b8', accent: '#10b981', sky: '#7dd3fc', pink: '#f9a8d4' }
      };
      return paletteMap[activeDisplayProfile] || paletteMap['default'];
    }

    function buildWeeklyJournalCardSvgString() {
      const pal = getStatCardPalette();
      const rawDate = document.getElementById('stat-card-date-input')?.value || selectedNoteDate || getLocalDateString(new Date());
      const weekMonday = getWeekMondayDateString(rawDate);
      const weekLabel = formatWeekSpanLabel(weekMonday);

      // Find saved weekly note OR use currently typed editor values if matching
      const savedNote = globalNotes.find(n => n.date === weekMonday);
      const titleText = (selectedNoteDate === weekMonday && document.getElementById('note-title-input')?.value.trim())
        ? document.getElementById('note-title-input').value.trim()
        : (savedNote?.title || `Weekly Operational Log (${weekMonday})`);
      const moodText = (selectedNoteDate === weekMonday && document.getElementById('note-mood-input')?.value)
        ? document.getElementById('note-mood-input').value
        : (savedNote?.mood || 'OPTIMAL');
      const rawHtml = (selectedNoteDate === weekMonday && document.getElementById('note-content-editor')?.innerHTML.trim())
        ? document.getElementById('note-content-editor').innerHTML.trim()
        : (savedNote?.content || 'No weekly reflection text recorded for this week yet.');
      const plainBody = htmlToPlainTerminalText(rawHtml);

      // Compute 7-day study & step totals for this week
      const monObj = new Date(weekMonday + 'T00:00:00');
      let wkStudy = 0, wkSteps = 0;
      const dayBars = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monObj);
        d.setDate(monObj.getDate() + i);
        const ds = getLocalDateString(d);
        const sR = globalStudyRows.find(r => r.date === ds);
        const stR = globalStepsRows.find(r => r.date === ds);
        const sh = sR ? sR.actual_hours : 0;
        const stp = stR ? stR.actual_steps : 0;
        wkStudy += sh;
        wkSteps += stp;
        dayBars.push({ label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i], sh, stp });
      }

      // Word-wrap plainBody into up to 11 clean lines (~74 chars per line)
      const wrappedLines = [];
      plainBody.split(/\r?\n/).forEach(para => {
        const words = para.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) {
          if (wrappedLines.length > 0 && wrappedLines[wrappedLines.length - 1] !== '') wrappedLines.push('');
          return;
        }
        let line = '';
        words.forEach(w => {
          if ((line + ' ' + w).trim().length > 76) {
            wrappedLines.push(line.trim());
            line = w;
          } else {
            line = (line + ' ' + w).trim();
          }
        });
        if (line) wrappedLines.push(line);
      });
      const displayLines = wrappedLines.slice(0, 11);

      let punchHoles = '';
      for (let i = 0; i < 24; i++) {
        punchHoles += `<rect x="${28 + i * 28}" y="14" width="10" height="14" rx="2" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1" opacity="0.7"/>`;
        punchHoles += `<rect x="${28 + i * 28}" y="532" width="10" height="14" rx="2" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1" opacity="0.7"/>`;
      }

      const miniBarsSvg = dayBars.map((b, i) => {
        const bh = Math.min(48, Math.round((b.sh / 12) * 48));
        const bx = 508 + i * 24;
        const by = 148 - bh;
        return `
          <rect x="${bx}" y="${by}" width="16" height="${bh}" fill="${i % 2 === 0 ? pal.sky : pal.pink}" opacity="0.88"/>
          <text x="${bx + 8}" y="162" text-anchor="middle" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="9">${b.label}</text>
        `;
      }).join('');

      const linesSvg = displayLines.map((ln, idx) => `
        <text x="44" y="${238 + idx * 22}" fill="${pal.text}" font-family="Inter, sans-serif" font-size="12">${escapeHtml(ln)}</text>
      `).join('');

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 560" width="720" height="560">
        <rect width="720" height="560" fill="${pal.bg}"/>
        <rect x="10" y="8" width="700" height="544" fill="${pal.panel}" stroke="${pal.border}" stroke-width="2"/>
        ${punchHoles}

        <text x="30" y="52" fill="${pal.accent}" font-family="Inter, sans-serif" font-size="15" font-weight="400">AUTUMN // WEEKLY OPERATIONAL JOURNAL PUNCH CARD</text>
        <text x="690" y="52" text-anchor="end" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="12" font-weight="400">${escapeHtml(weekLabel)}</text>
        <line x1="28" y1="64" x2="692" y2="64" stroke="${pal.border}" stroke-width="1" stroke-dasharray="4 4"/>

        <!-- Top Summary & 7-Day Mini Bar Graph -->
        <rect x="28" y="76" width="456" height="96" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1.2"/>
        <text x="42" y="98" fill="${pal.pink}" font-family="Inter, sans-serif" font-size="10">WEEKLY HEADLINE // STATUS: ${escapeHtml(moodText)}</text>
        <text x="42" y="124" fill="${pal.text}" font-family="Inter, sans-serif" font-size="16" font-weight="400">${escapeHtml(titleText.slice(0, 44))}</text>
        <text x="42" y="152" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="11">WEEKLY STUDY: ${escapeHtml(formatHours(wkStudy))}   |   WEEKLY STEPS: ${escapeHtml(formatSteps(wkSteps))}</text>

        <rect x="496" y="76" width="196" height="96" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1.2"/>
        <text x="508" y="94" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="9">7D STUDY OUTPUT (M–S)</text>
        ${miniBarsSvg}

        <!-- Journal Body Content Box -->
        <rect x="28" y="186" width="664" height="304" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1.2"/>
        <text x="44" y="210" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="10" font-weight="400">WEEKLY REFLECTION &amp; FIELD LOG</text>
        <line x1="44" y1="218" x2="676" y2="218" stroke="${pal.border}" stroke-width="0.6" opacity="0.5"/>
        ${linesSvg}

        <!-- Footer -->
        <text x="30" y="514" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">OPERATOR: AUTUMN   |   KEY: ${escapeHtml(weekMonday)}   |   PROFILE: ${escapeHtml(activeDisplayProfile.toUpperCase())}</text>
      </svg>`;
    }

    function buildStatCardSvgString() {
      if (currentStatCardMode === 'journal') {
        return buildWeeklyJournalCardSvgString();
      }

      const pal = getStatCardPalette();
      const dateStr = document.getElementById('stat-card-date-input')?.value || getLocalDateString(new Date());
      const sRow = globalStudyRows.find(r => r.date === dateStr);
      const stRow = globalStepsRows.find(r => r.date === dateStr);

      const studyActual = sRow ? sRow.actual_hours : 0;
      const studyTarget = sRow ? sRow.computed_target : getStudyBaseGoalForDate(dateStr);
      const studyOver = sRow ? sRow.computed_overflow : (globalStudyRows.length > 0 ? globalStudyRows[globalStudyRows.length - 1].computed_overflow : 0);

      const stepsActual = stRow ? stRow.actual_steps : 0;
      const stepsTarget = stRow ? stRow.computed_target : getStepsBaseGoalForDate(dateStr);

      const monthlyInfo = computeMonthlyStudyWithBonus(globalStudyRows, new Date(dateStr + 'T00:00:00'));
      const yieldInfo = computeDailyOperationalYield(dateStr);
      const { availA, availAPlus } = getAvailableQuotaPasses();

      const studyVals = globalStudyRows.map(r => Number(r.actual_hours) || 0);
      const studySigma14 = calcStandardDeviation(studyVals.slice(-14));
      const sortedStudy = studyVals.slice().sort((a, b) => a - b);
      const p25 = calcPercentile(sortedStudy, 0.25);
      const p50 = calcPercentile(sortedStudy, 0.50);
      const p75 = calcPercentile(sortedStudy, 0.75);
      const dtiRatio = Math.max(0, studyOver) / 49.0;

      const recent14 = globalStudyRows.slice(-14);
      const recent14Hrs = recent14.map(r => r.actual_hours);
      const recent14Ema = calcEMA(recent14Hrs, 7);
      const latestEma = recent14Ema.length > 0 ? recent14Ema[recent14Ema.length - 1] : 0;

      const doneTasks = globalTaskItems.filter(t => t.is_done).length;
      const totalTasks = globalTaskItems.length;
      const inProgTasks = globalTaskItems.filter(t => !t.is_done && getTaskProgressState(t.id) === 'IN-PROGRESS').length;

      const fiveKRuns = globalRunningLogs
        .filter(r => r.category === '5k' && r.run_type !== 'REFERENCE')
        .sort((a, b) => parsePaceToSeconds(a.pace_str) - parsePaceToSeconds(b.pace_str));
      const best5k = fiveKRuns.length > 0 ? `${normalizePaceDisplay(fiveKRuns[0].pace_str)}/km` : '--:--/km';

      const studyPct = Math.min(100, Math.round((studyActual / Math.max(0.1, studyTarget)) * 100));
      const stepsPct = Math.min(100, Math.round((stepsActual / Math.max(1, stepsTarget)) * 100));

      let punchHoles = '';
      for (let i = 0; i < 24; i++) {
        punchHoles += `<rect x="${28 + i * 28}" y="14" width="10" height="14" rx="2" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1" opacity="0.7"/>`;
        punchHoles += `<rect x="${28 + i * 28}" y="532" width="10" height="14" rx="2" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1" opacity="0.7"/>`;
      }

      // Build 14-Day Mini Bar + EMA Sparkline SVG Graph
      let barsSvg = '';
      let emaPoints = [];
      recent14.forEach((r, idx) => {
        const bx = 44 + idx * 21;
        const bh = Math.min(54, Math.round((r.actual_hours / 12) * 54));
        const by = 408 - bh;
        barsSvg += `<rect x="${bx}" y="${by}" width="14" height="${bh}" fill="${idx % 2 === 0 ? pal.sky : pal.pink}" opacity="0.82"/>`;
        const ey = 408 - Math.min(54, Math.round(((recent14Ema[idx] || 0) / 12) * 54));
        emaPoints.push(`${bx + 7},${ey}`);
      });
      const emaPolyline = emaPoints.length > 1
        ? `<polyline fill="none" stroke="${pal.accent}" stroke-width="2.2" points="${emaPoints.join(' ')}"/>`
        : '';

      // Quartile Box-and-Whisker SVG coordinates (0h to 12h mapped to 280px width)
      const qLeft = 390 + Math.round((Math.min(12, p25) / 12) * 280);
      const qRight = 390 + Math.round((Math.min(12, p75) / 12) * 280);
      const qMed = 390 + Math.round((Math.min(12, p50) / 12) * 280);
      const qWidth = Math.max(6, qRight - qLeft);

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 560" width="720" height="560">
        <rect width="720" height="560" fill="${pal.bg}"/>
        <rect x="10" y="8" width="700" height="544" fill="${pal.panel}" stroke="${pal.border}" stroke-width="2"/>
        ${punchHoles}

        <!-- Header -->
        <text x="30" y="52" fill="${pal.accent}" font-family="Inter, sans-serif" font-size="15" font-weight="400">AUTUMN // FLIGHT RECORDER TELEMETRY PUNCH CARD</text>
        <text x="690" y="52" text-anchor="end" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="12" font-weight="400">YIELD: ${yieldInfo.score}/100 [${yieldInfo.grade}] // ${escapeHtml(dateStr)}</text>
        <line x1="28" y1="64" x2="692" y2="64" stroke="${pal.border}" stroke-width="1" stroke-dasharray="4 4"/>

        <!-- Primary Study & Steps Readouts -->
        <rect x="28" y="76" width="322" height="114" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1.2"/>
        <text x="42" y="96" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="10">01 // COGNITIVE STUDY OUTPUT</text>
        <text x="42" y="130" fill="${pal.text}" font-family="Inter, sans-serif" font-size="26" font-weight="400">${escapeHtml(formatHours(studyActual))} <tspan font-size="13" fill="${pal.muted}">/ ${escapeHtml(formatHours(studyTarget))}</tspan></text>
        <rect x="42" y="142" width="294" height="9" fill="${pal.panel}" stroke="${pal.border}" stroke-width="1"/>
        <rect x="42" y="142" width="${Math.round(2.94 * studyPct)}" height="9" fill="${pal.accent}"/>
        <text x="42" y="172" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">7D EMA: ${latestEma.toFixed(1)}h · 14D σ: ${studySigma14.toFixed(2)}h · DTI: ${dtiRatio.toFixed(2)}</text>

        <rect x="370" y="76" width="322" height="114" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1.2"/>
        <text x="384" y="96" fill="${pal.pink}" font-family="Inter, sans-serif" font-size="10">02 // KINETIC STEP OUTPUT</text>
        <text x="384" y="130" fill="${pal.text}" font-family="Inter, sans-serif" font-size="26" font-weight="400">${escapeHtml(formatSteps(stepsActual))} <tspan font-size="13" fill="${pal.muted}">/ ${escapeHtml(formatSteps(stepsTarget))}</tspan></text>
        <rect x="384" y="142" width="294" height="9" fill="${pal.panel}" stroke="${pal.border}" stroke-width="1"/>
        <rect x="384" y="142" width="${Math.round(2.94 * stepsPct)}" height="9" fill="${pal.sky}"/>
        <text x="384" y="172" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">QUOTA: ${stepsPct}% · 5K PR: ${escapeHtml(best5k)} · PASSES: ${availA.length}[A] ${availAPlus.length}[A+]</text>

        <!-- Secondary Telemetry Grid (3 Cells: Monthly Cycle + Bonus, Risk & DTI, Tasks & Habits) -->
        <rect x="28" y="204" width="212" height="84" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
        <text x="40" y="224" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">MONTHLY CYCLE (${escapeHtml(monthlyInfo.monthName)})</text>
        <text x="40" y="254" fill="${pal.text}" font-family="Inter, sans-serif" font-size="19" font-weight="400">${escapeHtml(formatHours(monthlyInfo.totalMonthlyHours))}</text>
        <text x="40" y="274" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="10">includes +${escapeHtml(formatHours(monthlyInfo.bonusHours))} bonus</text>

        <rect x="254" y="204" width="212" height="84" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
        <text x="266" y="224" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">PORTFOLIO RISK &amp; MEDIAN</text>
        <text x="266" y="254" fill="${pal.text}" font-family="Inter, sans-serif" font-size="19" font-weight="400">P50: ${p50.toFixed(1)}h</text>
        <text x="266" y="274" fill="${pal.pink}" font-family="Inter, sans-serif" font-size="10">${dtiRatio < 0.15 ? 'SYS_HEALTH: OPTIMAL' : dtiRatio <= 0.35 ? 'ELEVATED RISK' : 'CRITICAL DEFICIT'}</text>

        <rect x="480" y="204" width="212" height="84" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
        <text x="492" y="224" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">TASK MATRIX &amp; EXECUTION</text>
        <text x="492" y="254" fill="${pal.text}" font-family="Inter, sans-serif" font-size="19" font-weight="400">${doneTasks}/${totalTasks} DONE</text>
        <text x="492" y="274" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">${inProgTasks} task(s) IN-PROGRESS</text>

        <!-- Embedded Telemetry Graphs Row (14D Study + EMA Graph & Quartile Boxplot) -->
        <rect x="28" y="302" width="322" height="122" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
        <text x="42" y="322" fill="${pal.sky}" font-family="Inter, sans-serif" font-size="10" font-weight="400">14-DAY STUDY BARS &amp; 7D EMA CURVE</text>
        <line x1="42" y1="408" x2="336" y2="408" stroke="${pal.border}" stroke-width="0.8"/>
        ${barsSvg}
        ${emaPolyline}

        <rect x="370" y="302" width="322" height="122" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
        <text x="384" y="322" fill="${pal.pink}" font-family="Inter, sans-serif" font-size="10" font-weight="400">BOX-AND-WHISKER QUARTILES (0H–12H)</text>
        <text x="384" y="344" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">P25: ${p25.toFixed(1)}h  |  P50: ${p50.toFixed(1)}h  |  P75: ${p75.toFixed(1)}h</text>
        <line x1="390" y1="376" x2="670" y2="376" stroke="${pal.muted}" stroke-width="1.5" stroke-dasharray="3 3"/>
        <rect x="${qLeft}" y="362" width="${qWidth}" height="28" fill="${pal.panel}" stroke="${pal.sky}" stroke-width="2"/>
        <line x1="${qMed}" y1="358" x2="${qMed}" y2="394" stroke="${pal.pink}" stroke-width="3"/>
        <text x="390" y="412" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="9">0h</text>
        <text x="530" y="412" text-anchor="middle" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="9">6h</text>
        <text x="670" y="412" text-anchor="end" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="9">12h</text>

        <!-- Footer Serial Strip -->
        <rect x="28" y="438" width="664" height="74" fill="${pal.bg}" stroke="${pal.border}" stroke-width="1"/>
        <text x="42" y="460" fill="${pal.accent}" font-family="Inter, sans-serif" font-size="11" font-weight="400">DIRECTIVE // ${escapeHtml((document.getElementById('focus-directive-input')?.value || 'CONSISTENT DAILY EXECUTION & ZERO DEFICIT SPILLOVER').slice(0, 60))}</text>
        <text x="42" y="480" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">DAILY YIELD: ${yieldInfo.score}/100 [GRADE: ${yieldInfo.grade}]   |   OPERATOR: AUTUMN   |   SYS: LEDGER-06</text>
        <text x="42" y="498" fill="${pal.muted}" font-family="Inter, sans-serif" font-size="10">STAMP: ${escapeHtml(new Date().toISOString())}</text>
      </svg>`;
    }

    function renderStatCardPreview() {
      const box = document.getElementById('stat-card-preview-box');
      if (!box) return;
      box.innerHTML = buildStatCardSvgString();
    }

    function renderStatCardToCanvas(callback) {
      const svgStr = buildStatCardSvgString();
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1440;
        canvas.height = 1120;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        callback(canvas, svgStr);
      };
      img.src = url;
    }

    function copyStatCardPngToClipboard() {
      renderStatCardToCanvas((canvas) => {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast('STAT CARD COPIED', 'High-DPI PNG card copied directly to clipboard!');
          } catch (err) {
            showToast('CLIPBOARD FALLBACK', 'Browser blocked image clipboard; downloading PNG instead.', true);
            downloadStatCardFile('png');
          }
        }, 'image/png');
      });
    }

    function downloadStatCardFile(format = 'png') {
      const dateStr = document.getElementById('stat-card-date-input')?.value || getLocalDateString(new Date());
      const prefix = currentStatCardMode === 'journal' ? 'autumn-weekly-journal' : 'autumn-flight-recorder';
      const baseName = `${prefix}-${dateStr}`;
      if (format === 'svg') {
        const svgStr = buildStatCardSvgString();
        triggerFileDownload(svgStr, `${baseName}.svg`, 'image/svg+xml;charset=utf-8');
        showToast('SVG DOWNLOADED', `Saved ${baseName}.svg`);
        return;
      }
      renderStatCardToCanvas((canvas) => {
        const link = document.createElement('a');
        link.download = `${baseName}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('PNG DOWNLOADED', `Saved high-resolution ${baseName}.png`);
      });
    }

    // Warn before losing unsaved journal / general-note edits on refresh or tab close.
    window.addEventListener('beforeunload', (e) => {
      // Flush the stopwatch state so a reload can resume it (closed time is not credited).
      if (typeof persistTimerState === 'function') persistTimerState();
      if (typeof persistTimerAccumulatedSecs === 'function') persistTimerAccumulatedSecs();
      if (journalEditorDirty || generalNoteDirty) {
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

    // ==========================================
    // TIER 3: FULL JSON BACKUP & RESTORE
    // ==========================================
    const BACKUP_TABLES = [
      { name: 'study_ledger', key: 'date' },
      { name: 'steps_ledger', key: 'date' },
      { name: 'daily_notes', key: 'date' },
      { name: 'general_notes', key: 'id' },
      { name: 'calendar_events_cache', key: 'event_id' },
      { name: 'task_columns', key: 'id' },
      { name: 'task_items', key: 'id' },
      { name: 'recurring_habits', key: 'id' },
      { name: 'running_logs', key: 'id' },
      { name: 'portfolio_logs', key: 'id' },
      { name: 'youtube_resources', key: 'id' },
      { name: 'operational_yield_ledger', key: 'date' },
      { name: 'drive_config', key: 'config_key' }
    ];

    // Supabase refuses an unfiltered DELETE, so each key type needs a "match nothing" value
    // that is still valid for that column type (a non-date string errors on a date column).
    const BACKUP_DELETE_SENTINEL = {
      date: '1900-01-01',
      id: '00000000-0000-0000-0000-000000000000',
      event_id: '__autumn_none__',
      config_key: '__autumn_none__'
    };

    const BACKUP_LOCAL_KEYS = [
      'autumn_display_profile', 'autumn_focus_directive',
      'autumn_task_col_order', 'autumn_task_item_order', 'autumn_task_status_map',
      'autumn_task_meta_map', 'autumn_task_col_collapsed', 'autumn_task_child_collapsed', 'autumn_nav3_expanded',
      'autumn_journal_order', 'autumn_gen_note_order',
      'autumn_redeemed_passes_map', 'autumn_pass_used_dates_map',
      'autumn_gdrive_config'
    ];

    let pendingBackupPayload = null;

    async function buildFullBackupPayload() {
      const payload = {
        app: 'autumn',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        tables: {},
        local: {}
      };

      for (const spec of BACKUP_TABLES) {
        const { data, error } = await supabaseClient.from(spec.name).select('*');
        payload.tables[spec.name] = error
          ? { key: spec.key, rows: [], error: error.message }
          : { key: spec.key, rows: data || [] };
      }

      BACKUP_LOCAL_KEYS.forEach((k) => {
        try {
          const v = localStorage.getItem(k);
          if (v !== null) payload.local[k] = v;
        } catch (e) {}
      });

      return payload;
    }

    async function downloadFullBackup() {
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to export a backup.', true);
      showToast('BUILDING BACKUP', 'Reading all 13 tables…');
      try {
        const payload = await buildFullBackupPayload();
        const rowCount = Object.values(payload.tables).reduce((n, t) => n + t.rows.length, 0);
        triggerFileDownload(
          JSON.stringify(payload, null, 2),
          'autumn-backup-' + getLocalDateString(new Date()) + '.json',
          'application/json;charset=utf-8;'
        );
        showToast('BACKUP DOWNLOADED', rowCount + ' rows across ' + BACKUP_TABLES.length + ' tables.');
      } catch (err) {
        showToast('BACKUP FAILED', err.message, true);
      }
    }

    // Builds the per-table checkboxes. Extracted so it can be exercised independently of the
    // owner-only guard in openBackupModal().
    function populateBackupTableChecks(payload) {
      const list = document.getElementById('backup-table-checks');
      if (!list) return 0;
      list.innerHTML = BACKUP_TABLES.map((t) => {
        const present = payload ? Boolean(payload.tables && payload.tables[t.name]) : true;
        return '<label class="flex items-center gap-1.5 font-mono-tech text-[11px] text-[#0c1f17] truncate">' +
          '<input type="checkbox" class="tech-checkbox" data-backup-table="' + t.name + '"' +
            (present ? ' checked' : ' disabled') + '>' +
          '<span class="truncate">' + t.name + '</span>' +
        '</label>';
      }).join('');
      return list.querySelectorAll('[data-backup-table]').length;
    }

    function openBackupModal() {
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to back up or restore.', true);
      pendingBackupPayload = null;
      const summary = document.getElementById('backup-file-summary');
      if (summary) summary.textContent = 'No file loaded yet.';
      const input = document.getElementById('backup-file-input');
      if (input) input.value = '';
      populateBackupTableChecks(null);
      openModal('backup-modal');
    }

    function inspectBackupFile(inputEl) {
      const file = inputEl.files && inputEl.files[0];
      const summary = document.getElementById('backup-file-summary');
      if (!file || !summary) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!parsed || typeof parsed !== 'object' || !parsed.tables) {
            throw new Error('not an autumn backup file');
          }
          pendingBackupPayload = parsed;
          const rowTotal = Object.keys(parsed.tables).reduce((n, k) => {
            const t = parsed.tables[k];
            return n + ((t && Array.isArray(t.rows)) ? t.rows.length : 0);
          }, 0);
          summary.textContent = 'Loaded ' + file.name + ' — exported ' +
            (parsed.exportedAt || 'unknown') + ' • ' + rowTotal + ' rows, ' +
            Object.keys(parsed.tables).length + ' table(s).';

          // Tick only the tables the file actually contains.
          document.querySelectorAll('[data-backup-table]').forEach((cb) => {
            const present = Boolean(parsed.tables[cb.getAttribute('data-backup-table')]);
            cb.checked = present;
            cb.disabled = !present;
          });
        } catch (err) {
          pendingBackupPayload = null;
          summary.textContent = 'Invalid file: ' + err.message;
        }
      };
      reader.readAsText(file);
    }

    async function runRestoreFromBackup() {
      if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to restore a backup.', true);
      if (!pendingBackupPayload) return showToast('NO FILE', 'Choose a backup JSON file first.', true);

      const modeEl = document.querySelector('input[name="backup-restore-mode"]:checked');
      const mode = modeEl ? modeEl.value : 'merge';
      const selected = Array.from(document.querySelectorAll('[data-backup-table]'))
        .filter((cb) => cb.checked && !cb.disabled)
        .map((cb) => cb.getAttribute('data-backup-table'));

      if (selected.length === 0) return showToast('NOTHING SELECTED', 'Tick at least one table to restore.', true);

      const verb = mode === 'replace' ? 'REPLACE every existing row in' : 'MERGE (upsert) into';
      confirmAction(
        'Restore Backup?',
        verb + ' ' + selected.length + ' table(s): ' + selected.join(', ') + '. This cannot be undone.',
        async () => {
          closeModal('backup-modal');
          showToast('RESTORING', 'Writing ' + selected.length + ' table(s)…');

          const problems = [];
          for (const name of selected) {
            const spec = BACKUP_TABLES.find((t) => t.name === name);
            const table = pendingBackupPayload.tables[name];
            const rows = (table && Array.isArray(table.rows)) ? table.rows : [];
            if (!spec || rows.length === 0) continue;

            if (mode === 'replace') {
              const sentinel = BACKUP_DELETE_SENTINEL[spec.key] || '__autumn_none__';
              const del = await supabaseClient.from(name).delete().neq(spec.key, sentinel);
              if (del.error) {
                problems.push(name + ' (delete): ' + del.error.message);
                continue;
              }
            }

            const res = await supabaseClient.from(name).upsert(rows, { onConflict: spec.key });
            if (res.error) problems.push(name + ': ' + res.error.message);
          }

          // Device settings are always merged — never wiped, so unrelated keys survive.
          if (pendingBackupPayload.local) {
            Object.keys(pendingBackupPayload.local).forEach((k) => {
              try { localStorage.setItem(k, pendingBackupPayload.local[k]); } catch (e) {}
            });
          }

          if (problems.length) {
            showToast('RESTORE INCOMPLETE', problems.slice(0, 3).join(' | '), true);
            setTimeout(() => location.reload(), 2800);
          } else {
            showToast('RESTORE COMPLETE', selected.length + ' table(s) restored. Reloading…');
            setTimeout(() => location.reload(), 1200);
          }
        }
      );
    }

    // ==========================================
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

    // ==========================================
    // TIER 2: WEEKLY / MONTHLY PERIOD REPORT
    // ==========================================
    let currentReportPeriod = 'week';

    function getReportDateRange(period) {
      const todayStr = getLocalDateString(new Date());
      if (period === 'week') {
        return { from: getWeekMondayDateString(todayStr), to: todayStr, label: 'THIS WEEK (MON → TODAY)' };
      }
      if (period === 'month') {
        const d = new Date();
        const from = getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
        return { from, to: todayStr, label: 'THIS MONTH TO DATE' };
      }
      if (period === '30') {
        return { from: addDaysToDateStr(todayStr, -29), to: todayStr, label: 'LAST 30 DAYS' };
      }
      const active = getPhaseActiveRows(globalStudyRows).filter(r => !r.is_gap_day);
      return { from: active.length ? active[0].date : todayStr, to: todayStr, label: 'WHOLE PHASE' };
    }

    function openReportModal() {
      openModal('report-modal');
      renderReport(currentReportPeriod || 'week');
    }

    function renderReport(period) {
      currentReportPeriod = period || currentReportPeriod || 'week';
      const range = getReportDateRange(currentReportPeriod);

      document.querySelectorAll('[data-report-tab]').forEach((btn) => {
        btn.classList.toggle('active-view', btn.getAttribute('data-report-tab') === currentReportPeriod);
      });
      const rangeEl = document.getElementById('report-range-label');
      if (rangeEl) rangeEl.textContent = range.from + ' → ' + range.to;

      const inRange = (r) => !r.is_gap_day && r.date >= range.from && r.date <= range.to;
      const studyRows = getPhaseActiveRows(globalStudyRows).filter(inRange);
      const stepsRows = getPhaseActiveRows(globalStepsRows).filter(inRange);

      const dates = Array.from(new Set([
        ...studyRows.map(r => r.date),
        ...stepsRows.map(r => r.date)
      ])).sort();

      const studyMap = {};
      studyRows.forEach(r => { studyMap[r.date] = Number(r.actual_hours) || 0; });
      const stepsMap = {};
      stepsRows.forEach(r => { stepsMap[r.date] = Number(r.actual_steps) || 0; });

      let totalHours = 0, totalSteps = 0, scoreSum = 0, passes = 0;
      let bestDay = { date: '—', score: -1 };
      const gradeCounts = {};
      const rowParts = [];

      dates.slice().reverse().forEach((d) => {
        const h = studyMap[d] || 0;
        const st = stepsMap[d] || 0;
        const y = computeDailyOperationalYield(d);
        totalHours += h;
        totalSteps += st;
        scoreSum += y.score;
        if (y.score > bestDay.score) bestDay = { date: d, score: y.score };
        if (y.passEarned !== 'NONE') passes++;
        gradeCounts[y.grade] = (gradeCounts[y.grade] || 0) + 1;
        rowParts.push(
          '<tr><td class="font-semibold">' + d + '</td><td>' + formatHours(h) + '</td><td>' +
          formatSteps(st) + '</td><td class="font-bold">' + y.score + '</td><td>' + y.grade + '</td></tr>'
        );
      });

      const days = dates.length;
      const avgScore = days ? Math.round(scoreSum / days) : 0;
      const gradeMix = Object.keys(gradeCounts).sort().map(g => g + '×' + gradeCounts[g]).join('  ') || '—';

      const kpiEl = document.getElementById('report-kpis');
      if (kpiEl) {
        const card = (label, value, sub, accent) =>
          '<div class="metric-box ' + (accent || '') + '">' +
            '<div class="font-mono-tech text-[9px] uppercase text-[#436152]">' + label + '</div>' +
            '<div class="font-mono-tech text-base font-bold text-[#0c1f17] mt-0.5">' + value + '</div>' +
            '<div class="font-mono-tech text-[10px] text-[#56735f] mt-0.5">' + sub + '</div>' +
          '</div>';
        kpiEl.innerHTML =
          card('Study', formatHours(totalHours), days + ' day(s) logged', 'accent-blue') +
          card('Steps', formatSteps(totalSteps), 'avg ' + (days ? formatSteps(Math.round(totalSteps / days)) : '0') + '/day', 'accent-amber') +
          card('Avg Score', avgScore + ' pts', days ? 'per logged day' : 'no data', 'accent-red') +
          card('Best Day', bestDay.score >= 0 ? bestDay.score + ' pts' : '—', bestDay.date) +
          card('Passes Earned', String(passes), 'in this period') +
          card('Grade Mix', gradeMix, 'A+ · A · A- · B · C · D');
      }

      const tbody = document.getElementById('report-tbody');
      if (tbody) {
        tbody.innerHTML = rowParts.length
          ? rowParts.join('')
          : '<tr><td colspan="5" class="text-center py-6 text-[#56735f]">No logged days in this period.</td></tr>';
      }
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
    const TRASH_KEY = 'autumn_trash_vault';
    const TRASH_TTL_DAYS = 30;

    function loadTrashVault() {
      try {
        const raw = safeStorage.getItem(TRASH_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const cutoff = Date.now() - TRASH_TTL_DAYS * 86400000;
        return (Array.isArray(parsed) ? parsed : []).filter(t => new Date(t.deletedAt).getTime() > cutoff);
      } catch (e) { return []; }
    }

    function saveTrashVault(list) {
      safeStorage.setItem(TRASH_KEY, JSON.stringify(list.slice(-100)));
    }

    function autumnTrashPush(table, row) {
      if (!row) return;
      const list = loadTrashVault();
      list.push({ id: 'tr_' + Date.now(), table: table, row: row, deletedAt: new Date().toISOString() });
      saveTrashVault(list);
    }

    async function restoreFromTrash(trashId) {
      if (!currentUser) return showToast('READ-ONLY', 'Sign in as autumn to restore rows.', true);
      const list = loadTrashVault();
      const entry = list.find(t => t.id === trashId);
      if (!entry) return;
      const { error } = await supabaseClient.from(entry.table).insert(entry.row);
      if (error) return showToast('RESTORE FAILED', error.message, true);
      saveTrashVault(list.filter(t => t.id !== trashId));
      showToast('RESTORED', 'Row re-inserted into ' + entry.table + '.');
      renderToolsTrash();
      if (typeof fetchAndRenderTasks === 'function') fetchAndRenderTasks();
      if (typeof fetchAndRenderHabits === 'function') fetchAndRenderHabits();
      if (typeof fetchAndRenderRunningLogs === 'function') fetchAndRenderRunningLogs();
    }

    function purgeTrashVault() {
      confirmAction('Empty the trash vault?', 'Permanently forgets every locally snapshotted deleted row. This cannot be undone.', () => {
        saveTrashVault([]);
        renderToolsTrash();
        showToast('TRASH EMPTIED', 'The local restore vault is empty.');
      });
    }


    // --------------------------------------------------- 13.4 diagnostics (T1.3)
    function localCacheAge(key) {
      try {
        const raw = safeStorage.getItem(key);
        if (!raw) return '—';
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.savedAt) return '—';
        const mins = Math.round((Date.now() - parsed.savedAt) / 60000);
        return mins < 1 ? 'just now' : (mins < 90 ? mins + ' min ago' : Math.round(mins / 60) + ' h ago');
      } catch (e) { return '—'; }
    }

    function localStorageFootprint() {
      let bytes = 0;
      let keys = 0;
      try {
        for (let i = 0; i < localStorage.length; i += 1) {
          const k = localStorage.key(i);
          if (!k || k.indexOf('autumn') !== 0) continue;
          keys += 1;
          bytes += (k.length + String(localStorage.getItem(k) || '').length) * 2;
        }
      } catch (e) {}
      return { keys: keys, kb: Math.round(bytes / 1024) };
    }

    function diagRow(label, value, tone) {
      const toneClass = tone === 'warn' ? 'text-[#b45309]' : (tone === 'bad' ? 'text-[#b91c1c]' : 'text-[#0c1f17]');
      return '<div class="flex items-start justify-between gap-3 py-1 border-b border-[#e2efe8]">' +
        '<span class="font-mono-tech text-[10px] uppercase text-[#436152] shrink-0">' + escapeHtml(label) + '</span>' +
        '<span class="font-mono-tech text-[11px] text-right break-words ' + toneClass + '">' + value + '</span>' +
        '</div>';
    }

    function renderToolsDiagnostics() {
      const host = document.getElementById('tools-diag-body');
      if (!host) return;
      const storage = localStorageFootprint();
      const counts = [
        ['study', globalStudyRows.length],
        ['steps', globalStepsRows.length],
        ['tasks', globalTaskItems.length],
        ['columns', globalTaskColumns.length],
        ['habits', globalHabits.length],
        ['runs', globalRunningLogs.length],
        ['journal', globalNotes.length],
        ['notes', globalGeneralNotes.length],
        ['events', globalCalendarEvents.length]
      ].map(t => '<span class="tech-badge badge-neutral !text-[9px]">' + t[0] + ': ' + t[1] + '</span>').join(' ');

      host.innerHTML =
        diagRow('BUILD', escapeHtml(window.__autumnBuild || '—')) +
        diagRow('BOOT', window.__autumnBootOk ? 'OK' : 'DEGRADED', window.__autumnBootOk ? '' : 'warn') +
        diagRow('AUTH', currentUser ? 'OWNER OPS // autumn' : 'READ-ONLY // GUEST') +
        diagRow('NETWORK', navigator.onLine ? 'ONLINE' : 'OFFLINE', navigator.onLine ? '' : 'bad') +
        diagRow('REALTIME', realtimeChannel ? 'SUBSCRIBED' : 'NOT CONNECTED', realtimeChannel ? '' : 'warn') +
        diagRow('PENDING WRITES', String(pendingWrites.length), pendingWrites.length ? 'warn' : '') +
        diagRow('TASK LINK SYNC', taskMetaColumnsAvailable === false
          ? 'LOCAL ONLY — run the task_items migration'
          : (taskMetaColumnsAvailable ? 'SUPABASE COLUMNS' : 'unknown'),
          taskMetaColumnsAvailable === false ? 'warn' : '') +
        diagRow('SUBTASK NESTING', taskParentColumnsAvailable === false
          ? 'LOCAL ONLY — run the task_items migration'
          : (taskParentColumnsAvailable ? 'SUPABASE COLUMNS (' + globalTaskItems.filter(t => getTaskParentId(t)).length + ' nested)' : 'unknown'),
          taskParentColumnsAvailable === false ? 'warn' : '') +
        diagRow('LEDGER CACHE', 'study ' + localCacheAge('autumn_cache_study_ledger') + ' · steps ' + localCacheAge('autumn_cache_steps_ledger')) +
        diagRow('LOCAL STORAGE', storage.keys + ' autumn keys · ' + storage.kb + ' KB') +
        diagRow('TRASH VAULT', loadTrashVault().length + ' row(s) restorable') +
        diagRow('THEME', escapeHtml(activeDisplayProfile)) +
        diagRow('VIEWPORT', window.innerWidth + '×' + window.innerHeight) +
        '<div class="mt-2 flex flex-wrap gap-1">' + counts + '</div>' +
        '<div class="mt-3 flex flex-wrap gap-1.5">' +
        '<button type="button" onclick="flushWriteQueue(true)" class="btn-export-tag">⇅ RETRY WRITES</button>' +
        '<button type="button" onclick="recomputeEverything()" class="btn-export-tag">⟳ RECOMPUTE GRADES</button>' +
        '<button type="button" onclick="clearAutumnCaches()" class="btn-export-tag">⌫ CLEAR CACHES</button>' +
        '<button type="button" onclick="copyDiagnostics()" class="btn-export-tag">⎘ COPY REPORT</button>' +
        '</div>';
    }


    function recomputeEverything() {
      try {
        if (typeof fetchAndRenderStudy === 'function') fetchAndRenderStudy();
        if (typeof fetchAndRenderSteps === 'function') fetchAndRenderSteps();
        if (typeof fetchAndSyncOperationalYield === 'function') fetchAndSyncOperationalYield();
        if (typeof renderAdvancedTelemetryAnalytics === 'function') renderAdvancedTelemetryAnalytics();
        if (typeof renderPlannerInsights === 'function') renderPlannerInsights();
        showToast('RECOMPUTED', 'Ledgers, grades and telemetry re-ran against live data.');
      } catch (e) {
        showToast('RECOMPUTE FAILED', (e && e.message) || 'unknown error', true);
      }
      renderToolsDiagnostics();
    }

    function clearAutumnCaches() {
      confirmAction('Clear local caches?', 'Removes the offline ledger mirror in THIS browser. Supabase data is untouched; the next load re-fetches everything.', () => {
        try {
          const doomed = [];
          for (let i = 0; i < localStorage.length; i += 1) {
            const k = localStorage.key(i);
            if (k && k.indexOf('autumn_cache') === 0) doomed.push(k);
          }
          doomed.forEach(k => safeStorage.removeItem(k));
          showToast('CACHES CLEARED', doomed.length + ' cache key(s) removed.');
        } catch (e) {}
        renderToolsDiagnostics();
      });
    }

    function copyDiagnostics() {
      const text = [
        'autumn // diagnostics',
        'build: ' + window.__autumnBuild,
        'boot: ' + window.__autumnBootOk,
        'auth: ' + (currentUser ? 'owner' : 'guest'),
        'online: ' + navigator.onLine,
        'pending writes: ' + pendingWrites.length,
        'study rows: ' + globalStudyRows.length,
        'steps rows: ' + globalStepsRows.length,
        'tasks: ' + globalTaskItems.length,
        'notes: ' + globalNotes.length,
        'at: ' + new Date().toISOString()
      ].join('\n');
      try {
        navigator.clipboard.writeText(text).then(
          () => showToast('COPIED', 'Diagnostics copied to the clipboard.'),
          () => downloadBlob('autumn-diagnostics.txt', text)
        );
      } catch (e) {
        downloadBlob('autumn-diagnostics.txt', text);
      }
    }


    // ---------------------------------------------------- 13.5 export suite (T2.6)
    // One download helper, six artefacts: study CSV, steps CSV, tasks CSV, journal
    // Markdown, calendar ICS, and a full JSON snapshot (the restore path already exists).
    function exportLedgerCsv(kind) {
      const isStudy = kind === 'study';
      const rows = isStudy ? globalStudyRows : globalStepsRows;
      if (!rows || rows.length === 0) return showToast('NOTHING TO EXPORT', 'No ' + kind + ' rows are loaded yet.', true);
      const columns = isStudy
        ? [
            { key: 'date', label: 'date' },
            { key: 'actual_hours', label: 'actual_hours' },
            { key: 'computed_target', label: 'computed_target' },
            { key: 'computed_overflow', label: 'computed_overflow' },
            { key: 'source', label: 'source' }
          ]
        : [
            { key: 'date', label: 'date' },
            { key: 'actual_steps', label: 'actual_steps' },
            { key: 'computed_target', label: 'computed_target' },
            { key: 'computed_overflow', label: 'computed_overflow' },
            { key: 'source', label: 'source' }
          ];
      downloadBlob('autumn-' + kind + '-ledger-' + getLocalDateString(new Date()) + '.csv',
        toCsv(rows, columns), 'text/csv;charset=utf-8');
    }

    function exportTasksCsv() {
      if (!globalTaskItems || globalTaskItems.length === 0) return showToast('NOTHING TO EXPORT', 'No tasks loaded yet.', true);
      const colName = (id) => {
        const col = globalTaskColumns.find(c => c.id === id);
        return col ? col.title : '';
      };
      const rows = globalTaskItems.map(t => {
        const meta = (typeof getTaskMeta === 'function') ? getTaskMeta(t.id) : { dueDate: '' };
        const parentTask = (typeof getTaskParentId === 'function' && getTaskParentId(t))
          ? (typeof getTaskById === 'function' ? getTaskById(getTaskParentId(t)) : null)
          : null;
        return {
          column: colName(t.column_id),
          title: (typeof getTaskDepth === 'function' ? '  '.repeat(getTaskDepth(t)) : '') + t.title,
          parent: parentTask ? parentTask.title : '',
          done: t.is_done ? 'yes' : 'no',
          due_date: meta.dueDate || '',
          status: (typeof getTaskProgressState === 'function') ? getTaskProgressState(t.id) : ''
        };
      });
      downloadBlob('autumn-tasks-' + getLocalDateString(new Date()) + '.csv',
        toCsv(rows, [{ key: 'column' }, { key: 'title' }, { key: 'parent' }, { key: 'done' }, { key: 'due_date' }, { key: 'status' }]),
        'text/csv;charset=utf-8');
    }


    function exportNotesMarkdown() {
      if (globalNotes.length === 0 && globalGeneralNotes.length === 0) {
        return showToast('NOTHING TO EXPORT', 'No notes loaded yet.', true);
      }
      const parts = ['# autumn // notes export', 'generated: ' + new Date().toISOString(), ''];
      if (globalNotes.length > 0) {
        parts.push('## Weekly journal');
        globalNotes.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(n => {
          parts.push('', '### ' + (n.date || 'undated') + (n.title ? ' — ' + n.title : ''));
          parts.push(stripHtmlTags(n.content || ''));
        });
      }
      if (globalGeneralNotes.length > 0) {
        parts.push('', '## General notes');
        globalGeneralNotes.forEach(n => {
          parts.push('', '### ' + (n.title || 'Untitled'));
          parts.push(stripHtmlTags(n.content || ''));
        });
      }
      downloadBlob('autumn-notes-' + getLocalDateString(new Date()) + '.md', parts.join('\n'), 'text/markdown;charset=utf-8');
    }

    function exportCalendarIcs() {
      if (!globalCalendarEvents || globalCalendarEvents.length === 0) {
        return showToast('NOTHING TO EXPORT', 'The calendar has no loaded events.', true);
      }
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
        'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
      const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//autumn//command ledger//EN', 'CALSCALE:GREGORIAN'];
      globalCalendarEvents.forEach((ev) => {
        if (!ev.start || !ev.end) return;
        lines.push('BEGIN:VEVENT');
        lines.push('UID:' + esc(ev.id || ('autumn-' + ev.start.getTime())));
        lines.push('DTSTAMP:' + stamp(new Date()));
        if (ev.isAllDay) {
          lines.push('DTSTART;VALUE=DATE:' + getLocalDateString(ev.start).replace(/-/g, ''));
        } else {
          lines.push('DTSTART:' + stamp(ev.start));
          lines.push('DTEND:' + stamp(ev.end));
        }
        lines.push('SUMMARY:' + esc(ev.title));
        if (ev.location) lines.push('LOCATION:' + esc(ev.location));
        if (ev.description) lines.push('DESCRIPTION:' + esc(stripHtmlTags(ev.description).slice(0, 900)));
        lines.push('END:VEVENT');
      });
      lines.push('END:VCALENDAR');
      downloadBlob('autumn-calendar-' + getLocalDateString(new Date()) + '.ics', lines.join('\r\n'), 'text/calendar;charset=utf-8');
    }

    function exportFullSnapshot() {
      const snapshot = {
        meta: { app: 'autumn', build: window.__autumnBuild, exportedAt: new Date().toISOString() },
        study: globalStudyRows,
        steps: globalStepsRows,
        tasks: { columns: globalTaskColumns, items: globalTaskItems },
        habits: globalHabits,
        runs: globalRunningLogs,
        journal: globalNotes,
        generalNotes: globalGeneralNotes,
        prefs: {
          theme: activeDisplayProfile,
          taskColOrder: taskColOrder,
          taskItemOrder: taskItemOrder,
          taskStatusMap: taskStatusMap,
          taskMetaMap: taskMetaMap,
          ledgerWindowDays: ledgerWindowDays
        }
      };
      downloadBlob('autumn-snapshot-' + getLocalDateString(new Date()) + '.json',
        JSON.stringify(snapshot, null, 2), 'application/json;charset=utf-8');
    }

    function downloadNetlifyBundleIndex() {
      const htmlSource = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      downloadBlob('index.html', htmlSource, 'text/html;charset=utf-8');
      showToast('NETLIFY BUNDLE', 'Downloaded standalone index.html for Netlify Drop.');
    }

    function downloadNetlifyTomlConfig() {
      const toml = [
        '# Netlify Static Site Configuration for autumn // PERSONAL COMMAND LEDGER',
        '[build]',
        '  publish = "."',
        '  command = "echo \'Static bundle ready\'"',
        '',
        '[[headers]]',
        '  for = "/*"',
        '  [headers.values]',
        '    X-Frame-Options = "SAMEORIGIN"',
        '    X-Content-Type-Options = "nosniff"',
        '    Referrer-Policy = "strict-origin-when-cross-origin"',
        '',
        '[[redirects]]',
        '  from = "/*"',
        '  to = "/index.html"',
        '  status = 200'
      ].join('\n');
      downloadBlob('netlify.toml', toml, 'text/plain;charset=utf-8');
      showToast('NETLIFY CONFIG', 'Downloaded netlify.toml configuration file.');
    }

    function renderToolsExport() {
      const host = document.getElementById('tools-export-body');
      if (!host) return;
      const tile = (label, hint, fn) =>
        '<button type="button" onclick="' + fn + '" class="cmd-frame p-2.5 text-left hover:border-[#059669] transition-colors">' +
        '<div class="font-mono-tech text-[11px] font-bold text-[#0c1f17]">' + label + '</div>' +
        '<div class="font-mono-tech text-[10px] text-[#436152] mt-0.5">' + hint + '</div>' +
        '</button>';
      host.innerHTML =
        '<div class="p-3 mb-3 border border-[#059669] bg-[#dcfce7]/40 font-mono-tech text-xs" style="border-radius:10px;">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<div>' +
              '<div class="font-bold text-[#047857]">◆ NETLIFY STATIC SITE DEPLOYMENT FOLDER (/netlify-static)</div>' +
              '<div class="text-[10px] text-[#436152] mt-0.5">Drag &amp; drop the project\'s <code>netlify-deploy/</code> directory directly into <strong>app.netlify.com/drop</strong> or download the standalone static files below.</div>' +
            '</div>' +
            '<div class="flex items-center gap-1.5">' +
              '<button type="button" onclick="downloadNetlifyBundleIndex()" class="btn-chamfer !py-1 !px-2.5 !text-[10px]">↓ index.html</button>' +
              '<button type="button" onclick="downloadNetlifyTomlConfig()" class="btn-tech-outline !py-1 !px-2.5 !text-[10px]">↓ netlify.toml</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
        tile('↓ STUDY LEDGER CSV', globalStudyRows.length + ' rows · targets + spillover', "exportLedgerCsv('study')") +
        tile('↓ STEPS LEDGER CSV', globalStepsRows.length + ' rows · targets + spillover', "exportLedgerCsv('steps')") +
        tile('↓ TASKS CSV', globalTaskItems.length + ' tasks · column, done, deadline', 'exportTasksCsv()') +
        tile('↓ NOTES MARKDOWN', (globalNotes.length + globalGeneralNotes.length) + ' notes · journal + general', 'exportNotesMarkdown()') +
        tile('↓ CALENDAR ICS', globalCalendarEvents.length + ' events · import anywhere', 'exportCalendarIcs()') +
        tile('↓ FULL JSON SNAPSHOT', 'Everything above + preferences', 'exportFullSnapshot()') +
        '</div>';
    }


    // ------------------------------------------------- 13.6 weekly review (T2.7)
    function getWeekReviewRange() {
      return { from: getWeekMondayDateString(new Date()), to: getLocalDateString(new Date()) };
    }

    function computeWeekReview() {
      const range = getWeekReviewRange();
      const activeStudy = getPhaseActiveRows(globalStudyRows).filter(r => !r.is_gap_day && r.date >= range.from && r.date <= range.to);
      const activeSteps = getPhaseActiveRows(globalStepsRows).filter(r => !r.is_gap_day && r.date >= range.from && r.date <= range.to);
      const dates = Array.from(new Set(activeStudy.map(r => r.date).concat(activeSteps.map(r => r.date)))).sort();
      const studyMap = {};
      activeStudy.forEach(r => { studyMap[r.date] = Number(r.actual_hours) || 0; });
      const stepsMap = {};
      activeSteps.forEach(r => { stepsMap[r.date] = Number(r.actual_steps) || 0; });

      let hours = 0, steps = 0, scoreSum = 0, passes = 0;
      let best = null, worst = null;
      const grades = {};
      dates.forEach((d) => {
        const y = computeDailyOperationalYield(d);
        hours += studyMap[d] || 0;
        steps += stepsMap[d] || 0;
        scoreSum += y.score;
        if (y.passEarned && y.passEarned !== 'NONE') passes += 1;
        grades[y.grade] = (grades[y.grade] || 0) + 1;
        if (!best || y.score > best.score) best = { date: d, score: y.score, grade: y.grade };
        if (!worst || y.score < worst.score) worst = { date: d, score: y.score, grade: y.grade };
      });
      const debt = globalStudyRows.length
        ? Math.max(0, Number(globalStudyRows[globalStudyRows.length - 1].computed_overflow) || 0)
        : 0;
      return {
        from: range.from, to: range.to, days: dates.length, hours: hours, steps: steps,
        avgScore: dates.length ? Math.round(scoreSum / dates.length) : 0,
        passes: passes, grades: grades, best: best, worst: worst, debt: debt
      };
    }

    function renderToolsReview() {
      const host = document.getElementById('tools-review-body');
      if (!host) return;
      const r = computeWeekReview();
      const gradeMix = Object.keys(r.grades).sort().map(g => g + '×' + r.grades[g]).join('  ') || '—';
      const kpi = (label, value, sub, tone) =>
        '<div class="metric-box ' + (tone || '') + '">' +
        '<div class="section-tag mb-1"><span class="diamond">◆</span> ' + label + '</div>' +
        '<div class="font-mono-tech text-xl font-bold text-[#0c1f17] leading-tight">' + value + '</div>' +
        '<div class="font-mono-tech text-[10px] text-[#436152] mt-0.5">' + sub + '</div></div>';

      host.innerHTML =
        '<div class="font-mono-tech text-[10px] text-[#436152] mb-2">WEEK ' + r.from + ' → ' + r.to + ' · ' + r.days + ' logged day(s)</div>' +
        '<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">' +
        kpi('STUDY', formatHours(r.hours), 'this week', 'accent-green') +
        kpi('STEPS', formatSteps(r.steps), 'this week', 'accent-amber') +
        kpi('AVG SCORE', r.avgScore + ' pts', 'per logged day', 'accent-blue') +
        kpi('BEST DAY', r.best ? r.best.score + ' pts' : '—', r.best ? r.best.date + ' · ' + r.best.grade : 'no data') +
        kpi('WEAKEST DAY', r.worst ? r.worst.score + ' pts' : '—', r.worst ? r.worst.date + ' · ' + r.worst.grade : 'no data', 'accent-red') +
        kpi('OPEN DEBT', formatHours(r.debt), 'carried forward', r.debt > 0 ? 'accent-red' : '') +
        '</div>' +
        '<div class="mt-2 font-mono-tech text-[11px] text-[#0c1f17]">GRADE MIX: ' + escapeHtml(gradeMix) +
        ' · PASSES EARNED: ' + r.passes + '</div>' +
        '<div class="mt-3 flex flex-wrap gap-1.5">' +
        '<button type="button" onclick="saveWeeklyReviewToJournal()" class="btn-chamfer !py-1.5 !px-3 !text-xs">Edit WRITE INTO THIS WEEK\'S JOURNAL</button>' +
        '<button type="button" onclick="renderToolsReview()" class="btn-tech-outline !py-1.5 !px-3 !text-xs">⟳ REFRESH</button>' +
        '</div>';
    }

    async function saveWeeklyReviewToJournal() {
      if (!currentUser) return showToast('READ-ONLY', 'Sign in as autumn to write the review.', true);
      const r = computeWeekReview();
      const key = r.from;
      const gradeMix = Object.keys(r.grades).sort().map(g => g + '×' + r.grades[g]).join(', ') || '—';
      const block =
        '<h3>WEEKLY REVIEW // ' + r.from + ' → ' + r.to + '</h3>' +
        '<ul>' +
        '<li>Study: ' + formatHours(r.hours) + ' · Steps: ' + formatSteps(r.steps) + ' steps</li>' +
        '<li>Average operational score: ' + r.avgScore + ' pts over ' + r.days + ' logged day(s)</li>' +
        '<li>Grade mix: ' + gradeMix + ' · Quota passes earned: ' + r.passes + '</li>' +
        '<li>Best day: ' + (r.best ? r.best.date + ' (' + r.best.score + ' pts)' : '—') +
        ' · Weakest: ' + (r.worst ? r.worst.date + ' (' + r.worst.score + ' pts)' : '—') + '</li>' +
        '<li>Open study debt: ' + formatHours(r.debt) + '</li>' +
        '</ul>';
      const existing = (globalNotes || []).find(n => n.date === key);
      const merged = block + (existing && existing.content ? existing.content : '');
      const { error } = await supabaseClient
        .from('daily_notes')
        .upsert({ date: key, title: existing ? existing.title : 'Weekly Review', mood: 'REVIEW', content: merged }, { onConflict: 'date' });
      if (error) {
        if (queueWriteIfOffline(error, 'daily_notes', { date: key, title: 'Weekly Review', mood: 'REVIEW', content: merged }, 'date')) return;
        return showToast('SAVE FAILED', error.message, true);
      }
      showToast('REVIEW SAVED', 'Written into the journal entry for ' + key + '.');
      if (typeof fetchAndRenderNotes === 'function') fetchAndRenderNotes();
    }


    // --------------------------------------------- 13.7 habit streak strips (T2.8)
    // Supabase stores only completed_period + streak_count per habit, so a true 12-week
    // history grid is not derivable. This renders the last 12 periods with the recorded
    // streak filled in — honest about what the schema can support.
    function renderToolsHabits() {
      const host = document.getElementById('tools-habits-body');
      if (!host) return;
      if (!globalHabits || globalHabits.length === 0) {
        host.innerHTML = '<div class="font-mono-tech text-[11px] text-[#436152] p-3 bg-[#eff8f2] border border-[#c5ded0]">No recurring habits yet. Add them in 04 // TASKS → RECURRING TASKS &amp; HABITS.</div>';
        return;
      }
      const rows = globalHabits.map((h) => {
        const streak = Number(h.streak_count) || 0;
        const done = h.completed_period && h.completed_period === getHabitCurrentPeriodKey(h.frequency);
        const cells = [];
        for (let i = 11; i >= 0; i -= 1) {
          const filled = i < streak;
          cells.push('<span title="' + (filled ? 'counted in the recorded streak' : 'not recorded') + '" class="inline-block w-2.5 h-3.5 border ' +
            (filled ? 'bg-[#059669] border-[#047857]' : 'bg-[#e8f3ec] border-[#c5ded0]') + '"></span>');
        }
        return '<div class="py-1.5 border-b border-[#e2efe8] flex items-center justify-between gap-2 flex-wrap">' +
          '<div class="min-w-0">' +
          '<div class="font-mono-tech text-[11px] font-bold text-[#0c1f17] truncate">' + escapeHtml(h.title || 'Habit') + '</div>' +
          '<div class="font-mono-tech text-[9px] text-[#436152]">' + escapeHtml(h.frequency || '') + ' · streak ' + streak +
          (done ? ' · <span class="text-[#047857] font-bold">CURRENT PERIOD DONE</span>' : '') + '</div>' +
          '</div>' +
          '<div class="flex gap-0.5 items-center">' + cells.join('') + '</div>' +
          '</div>';
      }).join('');
      host.innerHTML = rows +
        '<div class="font-mono-tech text-[9px] text-[#436152] mt-2 leading-relaxed">Each cell = one prior period. Filled cells come from the recorded streak_count; the schema keeps no per-period history.</div>';
    }


    // ---------------------------------------------- 13.8 achievements (T3.13)
    // Everything here is derived from data the app already holds — no schema change.
    function computeAchievements() {
      const activeStudy = getPhaseActiveRows(globalStudyRows).filter(r => !r.is_gap_day);
      const activeSteps = getPhaseActiveRows(globalStepsRows).filter(r => !r.is_gap_day);

      let run = 0, bestStudyStreak = 0;
      activeStudy.forEach((r) => {
        if ((Number(r.actual_hours) || 0) >= resolveScoringBaseline(r.date, globalStudyRows, getStudyBaseGoalForDate, MAX_DAILY).baseline) { run += 1; bestStudyStreak = Math.max(bestStudyStreak, run); }
        else run = 0;
      });
      run = 0;
      let bestStepsStreak = 0;
      activeSteps.forEach((r) => {
        if ((Number(r.actual_steps) || 0) >= resolveScoringBaseline(r.date, globalStepsRows, getStepsBaseGoalForDate, STEPS_MAX_DAILY).baseline) { run += 1; bestStepsStreak = Math.max(bestStepsStreak, run); }
        else run = 0;
      });

      const totalHours = activeStudy.reduce((a, r) => a + (Number(r.actual_hours) || 0), 0);
      const totalSteps = activeSteps.reduce((a, r) => a + (Number(r.actual_steps) || 0), 0);
      const doneTasks = (globalTaskItems || []).filter(t => t.is_done).length;
      const habitStreaks = (globalHabits || []).reduce((a, h) => a + (Number(h.streak_count) || 0), 0);
      const noteCount = (globalNotes || []).length + (globalGeneralNotes || []).length;

      let aPlusDays = 0, centuryDays = 0;
      activeStudy.slice(-120).forEach((r) => {
        const y = computeDailyOperationalYield(r.date);
        if (y.grade === 'A+') aPlusDays += 1;
        if (y.score >= 100) centuryDays += 1;
      });

      return [
        { title: 'CONSISTENCY', sub: '7-day study streak', value: bestStudyStreak, target: 7 },
        { title: 'DISCIPLINE', sub: '30-day study streak', value: bestStudyStreak, target: 30 },
        { title: 'KINETIC', sub: '7-day steps streak', value: bestStepsStreak, target: 7 },
        { title: 'CENTURION', sub: '100+ point day', value: centuryDays, target: 1 },
        { title: 'PERFECTIONIST', sub: '5 × A+ graded days', value: aPlusDays, target: 5 },
        { title: 'SCHOLAR', sub: '100 study hours logged', value: Math.round(totalHours), target: 100 },
        { title: 'TREKKER', sub: '100,000 steps logged', value: Math.round(totalSteps), target: 100000 },
        { title: 'EXECUTOR', sub: '50 tasks completed', value: doneTasks, target: 50 },
        { title: 'SCRIBE', sub: '30 notes written', value: noteCount, target: 30 },
        { title: 'RITUALIST', sub: '20 cumulative habit streak', value: habitStreaks, target: 20 }
      ].map(a => Object.assign(a, { unlocked: a.value >= a.target }));
    }

    function renderToolsAchievements() {
      const host = document.getElementById('tools-ach-body');
      if (!host) return;
      const list = computeAchievements();
      const unlocked = list.filter(a => a.unlocked).length;
      host.innerHTML =
        '<div class="font-mono-tech text-[10px] text-[#436152] mb-2">' + unlocked + ' / ' + list.length + ' unlocked</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
        list.map((a) => {
          const pct = Math.max(0, Math.min(100, Math.round((a.value / a.target) * 100)));
          const valueText = a.target >= 1000 ? formatSteps(a.value) : String(a.value);
          return '<div class="cmd-frame p-2 ' + (a.unlocked ? 'border-[#86efac] bg-[#dcfce7]/40' : '') + '">' +
            '<div class="flex items-center justify-between gap-2">' +
            '<span class="font-mono-tech text-[11px] font-bold ' + (a.unlocked ? 'text-[#047857]' : 'text-[#0c1f17]') + '">' +
            (a.unlocked ? ' ' : ' ') + escapeHtml(a.title) + '</span>' +
            '<span class="font-mono-tech text-[9px] text-[#436152]">' + valueText + ' / ' + (a.target >= 1000 ? formatSteps(a.target) : a.target) + '</span>' +
            '</div>' +
            '<div class="font-mono-tech text-[9px] text-[#436152] mt-0.5">' + escapeHtml(a.sub) + '</div>' +
            '<div class="h-1 bg-[#e8f3ec] mt-1.5"><div class="h-1 ' + (a.unlocked ? 'bg-[#059669]' : 'bg-[#87b39b]') + '" style="width:' + pct + '%"></div></div>' +
            '</div>';
        }).join('') +
        '</div>';
    }


    // -------------------------------------------------- 13.9 ambient audio (T3.14)
    // No audio assets: a filtered brown-noise bed plus a low sine, generated with WebAudio.
    let ambientCtx = null;
    let ambientNodes = null;
    let ambientOn = false;

    function updateAmbientAudioUI() {
      const btn = document.getElementById('tools-ambient-btn');
      if (btn) {
        btn.textContent = ambientOn ? 'STOP AMBIENT AUDIO' : 'START AMBIENT AUDIO';
        btn.setAttribute('aria-pressed', ambientOn ? 'true' : 'false');
      }
    }

    function stopAmbientAudio() {
      try {
        if (ambientNodes && ambientCtx) {
          ambientNodes.gain.gain.exponentialRampToValueAtTime(0.0001, ambientCtx.currentTime + 0.4);
          const nodes = ambientNodes;
          setTimeout(() => { try { nodes.noise.stop(); nodes.osc.stop(); } catch (e) {} }, 500);
        }
      } catch (e) {}
      ambientNodes = null;
      ambientOn = false;
      safeStorage.setItem('autumn_ambient_on', 'false');
      updateAmbientAudioUI();
      showToast('AMBIENT OFF', 'Focus audio stopped.');
    }

    function toggleAmbientAudio() {
      try {
        if (ambientOn) { stopAmbientAudio(); return; }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return showToast('AUDIO UNAVAILABLE', 'This browser has no Web Audio API.', true);
        if (!ambientCtx) ambientCtx = new Ctx();
        if (ambientCtx.state === 'suspended') ambientCtx.resume();

        const bufferSize = 2 * ambientCtx.sampleRate;
        const buffer = ambientCtx.createBuffer(1, bufferSize, ambientCtx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < bufferSize; i += 1) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02; // brown-ish noise
          data[i] = last * 3.5;
        }
        const noise = ambientCtx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = ambientCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 620;

        const gain = ambientCtx.createGain();
        gain.gain.value = 0.0001;
        gain.gain.exponentialRampToValueAtTime(0.09, ambientCtx.currentTime + 1.2);

        const osc = ambientCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 110;
        const oscGain = ambientCtx.createGain();
        oscGain.gain.value = 0.012;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ambientCtx.destination);
        osc.connect(oscGain);
        oscGain.connect(ambientCtx.destination);
        noise.start();
        osc.start();

        ambientNodes = { noise: noise, osc: osc, gain: gain };
        ambientOn = true;
        safeStorage.setItem('autumn_ambient_on', 'true');
        updateAmbientAudioUI();
        showToast('AMBIENT ON', 'Low-noise focus bed engaged. Press again to stop.');
      } catch (e) {
        showToast('AUDIO FAILED', (e && e.message) || 'Could not start audio.', true);
      }
    }

    // ------------------------------------------------- 13.10 install prompt (T3.15)
    let deferredInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      const btn = document.getElementById('tools-install-btn');
      if (btn) btn.classList.remove('hidden');
    });

    async function promptInstall() {
      if (!deferredInstallPrompt) {
        return showToast('INSTALL APP', 'Use your browser menu → "Install app" or "Add to Home Screen".', false);
      }
      try {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        showToast('INSTALL APP', (choice && choice.outcome === 'accepted') ? 'Installing autumn…' : 'Install dismissed.');
      } catch (e) {
        showToast('INSTALL FAILED', (e && e.message) || 'Install prompt unavailable.', true);
      }
    }


    // ------------------------------------------------ 13.11 trash renderer (T1.4)
    function renderToolsTrash() {
      const host = document.getElementById('tools-trash-body');
      if (!host) return;
      const list = loadTrashVault().slice().reverse();
      if (list.length === 0) {
        host.innerHTML = '<div class="font-mono-tech text-[11px] text-[#436152] p-3 bg-[#eff8f2] border border-[#c5ded0]">The vault is empty. Deleted rows are snapshotted here for ' + TRASH_TTL_DAYS + ' days and can be re-inserted into Supabase.</div>';
        return;
      }
      host.innerHTML = list.map((t) => {
        const label = (t.row && (t.row.title || t.row.date || t.row.id)) || '(row)';
        const hours = Math.round((Date.now() - new Date(t.deletedAt).getTime()) / 3600000);
        return '<div class="flex items-center justify-between gap-2 py-1.5 border-b border-[#e2efe8]">' +
          '<div class="min-w-0">' +
          '<div class="font-mono-tech text-[11px] text-[#0c1f17] truncate">' + escapeHtml(String(label)) + '</div>' +
          '<div class="font-mono-tech text-[9px] text-[#436152]">' + escapeHtml(t.table) + ' · deleted ' + (hours < 1 ? 'moments' : hours + 'h') + ' ago</div>' +
          '</div>' +
          '<button type="button" onclick="restoreFromTrash(\'' + escapeHtml(t.id) + '\')" class="btn-export-tag">↺ RESTORE</button>' +
          '</div>';
      }).join('') +
        '<button type="button" onclick="purgeTrashVault()" class="btn-export-tag mt-2">⌫ EMPTY VAULT</button>';
    }

    // ----------------------------------------------- 13.12 keyboard help (T2.9)
    function renderToolsKeys() {
      const host = document.getElementById('tools-keys-body');
      if (!host) return;
      const rows = [
        ['/', 'Focus the global search'],
        ['Ctrl+K / Cmd+K', 'Focus the global search'],
        ['Right / Up / Down / Enter', 'Walk and open search results'],
        ['Double-click / Enter', 'Inline-edit focused study or steps ledger row'],
        ['ArrowUp / ArrowDown', 'Navigate between ledger rows during inline editing'],
        ['>', 'Command mode — type >study 7.5, >theme, >export'],
        ['g then s/p/c/t/n/r/f', 'Jump to Study / Steps / Calendar / Tasks / Notes / Resources / Focus'],
        ['t', 'Start or pause the study stopwatch'],
        ['`', 'Open the terminal (CLI + scratchpad)'],
        ['Esc', 'Cancel inline edit, close top dialog, or close search'],
        ['?', 'Open this shortcut sheet'],
        ['Tab / Shift+Tab', 'Cycles inside an open dialog (focus is trapped)']
      ];
      host.innerHTML = '<table class="tech-table w-full"><tbody>' +
        rows.map(r => '<tr><td class="font-mono-tech text-[10px] text-[#047857] whitespace-nowrap !py-1">' + escapeHtml(r[0]) + '</td>' +
          '<td class="text-[11px] !py-1">' + escapeHtml(r[1]) + '</td></tr>').join('') +
        '</tbody></table>';
    }


    // ---------------------------------------------- 13.13 health import (T3.12)
    // Accepts the 2-column CSV (date,steps) that Apple Health shortcuts, Google Fit takeout
    // and most step apps export. Always dry-runs first, then upserts on confirm.
    let healthImportPreview = [];

    function parseHealthCsv(text) {
      const byDate = {};
      String(text || '').split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const parts = trimmed.split(/[,;\t]/);
        if (parts.length < 2) return;
        const rawDate = parts[0].replace(/"/g, '').trim();
        const rawSteps = parts[1].replace(/"/g, '').replace(/[^0-9.]/g, '');
        let iso = '';
        const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const usMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (isoMatch) iso = isoMatch[1] + '-' + isoMatch[2] + '-' + isoMatch[3];
        else if (usMatch) iso = usMatch[3] + '-' + String(usMatch[1]).padStart(2, '0') + '-' + String(usMatch[2]).padStart(2, '0');
        if (!iso) return;
        const steps = Math.round(Number(rawSteps));
        if (!Number.isFinite(steps) || steps <= 0) return;
        byDate[iso] = Math.max(byDate[iso] || 0, steps);
      });
      return Object.keys(byDate).sort().map(d => ({ date: d, steps: byDate[d] }));
    }

    function previewHealthImport() {
      const box = document.getElementById('health-import-text');
      const host = document.getElementById('tools-health-preview');
      if (!box || !host) return;
      const parsed = parseHealthCsv(box.value);
      if (parsed.length === 0) {
        healthImportPreview = [];
        host.innerHTML = '<div class="font-mono-tech text-[11px] text-[#b45309] p-2 bg-[#fef3c7] border border-[#fcd34d]">No usable rows found. Expected two columns per line: <strong>2026-10-31, 10500</strong>.</div>';
        return;
      }
      const existing = {};
      globalStepsRows.forEach((r) => { existing[r.date] = Number(r.actual_steps) || 0; });
      healthImportPreview = parsed.map((row) => {
        const before = existing[row.date];
        return Object.assign({}, row, { before: before, isNew: before === undefined, delta: before === undefined ? row.steps : row.steps - before });
      });
      const added = healthImportPreview.filter(r => r.isNew).length;
      const changed = healthImportPreview.filter(r => !r.isNew && r.delta !== 0).length;
      host.innerHTML =
        '<div class="font-mono-tech text-[10px] text-[#436152] mb-1">DRY RUN · ' + healthImportPreview.length + ' day(s) parsed · ' + added + ' new · ' + changed + ' changed</div>' +
        '<div class="max-h-[210px] overflow-y-auto border border-[#c5ded0]">' +
        '<table class="tech-table w-full"><thead class="sticky top-0 bg-[#f4faf6]"><tr><th>Date</th><th>In file</th><th>Current</th><th>Effect</th></tr></thead><tbody>' +
        healthImportPreview.slice().reverse().map((r) =>
          '<tr><td>' + r.date + '</td><td>' + formatSteps(r.steps) + '</td>' +
          '<td>' + (r.isNew ? '—' : formatSteps(r.before)) + '</td>' +
          '<td>' + (r.isNew ? '<span class="tech-badge badge-green !text-[9px]">NEW</span>'
            : (r.delta === 0 ? '<span class="tech-badge badge-neutral !text-[9px]">SAME</span>'
              : '<span class="tech-badge ' + (r.delta > 0 ? 'badge-blue' : 'badge-amber') + ' !text-[9px]">' + (r.delta > 0 ? '+' : '') + formatSteps(r.delta) + '</span>')) + '</td></tr>'
        ).join('') + '</tbody></table></div>' +
        '<button type="button" onclick="applyHealthImport()" class="btn-chamfer !py-1.5 !px-3 !text-xs mt-2">⇧ IMPORT ' + healthImportPreview.length + ' DAY(S)</button>';
    }

    async function applyHealthImport() {
      if (!currentUser) return showToast('READ-ONLY', 'Sign in as autumn to import step history.', true);
      if (healthImportPreview.length === 0) return showToast('NOTHING TO IMPORT', 'Parse a CSV first.', true);
      const rows = healthImportPreview.map(r => ({
        date: r.date,
        actual_steps: r.steps,
        target_steps: getStepsBaseGoalForDate(r.date),
        source: 'import'
      }));
      const { error } = await supabaseClient.from('steps_ledger').upsert(rows, { onConflict: 'date' });
      if (error) return showToast('IMPORT FAILED', error.message, true);
      showToast('IMPORTED', rows.length + ' day(s) written to the steps ledger.');
      healthImportPreview = [];
      const box = document.getElementById('health-import-text');
      if (box) box.value = '';
      const host = document.getElementById('tools-health-preview');
      if (host) host.innerHTML = '';
      if (typeof fetchAndRenderSteps === 'function') fetchAndRenderSteps();
    }

    function readHealthFile(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const box = document.getElementById('health-import-text');
        if (box) box.value = String(reader.result || '');
        previewHealthImport();
      };
      reader.readAsText(file);
      input.value = '';
    }


    // ------------------------------------------------ 13.14 attachments (T2.10)
    // DEVIATION from the plan: attachments are embedded as data: URLs inside the note HTML
    // instead of IndexedDB blobs. IndexedDB is device-local, so a note synced to the phone
    // would render a broken image; data URLs travel with the row, survive export and print.
    // Guard rails: 1.5 MB per file, images and PDFs only, cursor-aware insertion.
    const ATTACHMENT_MAX_BYTES = 1.5 * 1024 * 1024;

    function insertAttachmentIntoNote(file, dataUrl) {
      const active = document.activeElement;
      const target = (active && active.isContentEditable) ? active : document.getElementById('note-content-editor');
      if (!target) return showToast('NO EDITOR', 'Open 05 // NOTES and put the cursor in the journal first.', true);
      if (!target.isContentEditable) return showToast('READ-ONLY', 'That editor is locked — sign in as autumn.', true);
      target.focus();
      const safeName = escapeHtml(file.name);
      const html = /^image\//.test(file.type)
        ? '<div><img src="' + dataUrl + '" alt="' + safeName + '" style="max-width:100%;border:1px solid #c5ded0;margin:6px 0"></div>'
        : '<div><a href="' + dataUrl + '" download="' + safeName + '" target="_blank" rel="noopener noreferrer"> ' + safeName + '</a></div>';
      let inserted = false;
      try { inserted = document.execCommand('insertHTML', false, html); } catch (e) { inserted = false; }
      if (!inserted) target.insertAdjacentHTML('beforeend', html);
      if (typeof updateWordCount === 'function') updateWordCount();
      if (typeof updateGeneralNoteWordCount === 'function') updateGeneralNoteWordCount();
      showToast('ATTACHED', file.name + ' embedded (' + Math.round(dataUrl.length / 1024) + ' KB). Save the note to persist it.');
    }

    function handleAttachmentFiles(input) {
      const files = Array.from(input.files || []);
      input.value = '';
      if (files.length === 0) return;
      files.forEach((file) => {
        if (file.size > ATTACHMENT_MAX_BYTES) {
          showToast('FILE TOO LARGE', file.name + ' is ' + Math.round(file.size / 1024) + ' KB — the cap is 1.5 MB.', true);
          return;
        }
        const isImage = /^image\//.test(file.type);
        if (!isImage && file.type !== 'application/pdf') {
          showToast('UNSUPPORTED FILE', 'Only images and PDFs can be attached.', true);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => insertAttachmentIntoNote(file, String(reader.result || ''));
        reader.onerror = () => showToast('READ FAILED', 'Could not read ' + file.name + '.', true);
        reader.readAsDataURL(file);
      });
    }


    // -------------------------------------------- 13.15 command palette (T2.5)
    // The global search becomes dual-mode: ">cmd args" runs a command, everything else is
    // the normal content search. Logging commands are delegated to the existing terminal
    // CLI parser, so there is exactly one implementation of "study 7.5" / "steps 10500".
    function runTerminalCommandString(text) {
      const input = document.getElementById('terminal-quick-input');
      if (!input) return false;
      if (typeof isTerminalDrawerOpen !== 'undefined' && !isTerminalDrawerOpen) toggleTerminalDrawer();
      input.value = text;
      const form = input.closest('form');
      if (!form) return false;
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      input.value = '';
      return true;
    }

    const PALETTE_COMMANDS = [
      { id: 'study', usage: '>study 7.5 [YYYY-MM-DD]', hint: 'Log study hours (terminal parser)', run: (a) => runTerminalCommandString('study ' + a) },
      { id: 'steps', usage: '>steps 10500 [YYYY-MM-DD]', hint: 'Log steps (terminal parser)', run: (a) => runTerminalCommandString('steps ' + a) },
      { id: 'task', usage: '>task <Column> | <Title> | [YYYY-MM-DD]', hint: 'Create a task', run: (a) => runTerminalCommandString('task ' + a) },
      { id: 'run', usage: '>run 5k 5:30 [location]', hint: 'Log a run', run: (a) => runTerminalCommandString('run ' + a) },
      { id: 'habit', usage: '>habit <keyword>', hint: 'Check off a habit', run: (a) => runTerminalCommandString('habit ' + a) },
      { id: 'theme', usage: '>theme', hint: 'Cycle the display mood profile', run: () => cycleDisplayColorProfile() },
      { id: 'focus', usage: '>focus', hint: 'Toggle Focus mode', run: () => toggleFocusMode() },
      { id: 'tools', usage: '>tools', hint: 'Open the tools hub', run: () => openToolsModal('diagnostics') },
      { id: 'diag', usage: '>diag', hint: 'Diagnostics panel', run: () => openToolsModal('diagnostics') },
      { id: 'export', usage: '>export', hint: 'Export suite', run: () => openToolsModal('export') },
      { id: 'review', usage: '>review', hint: 'Weekly review', run: () => openToolsModal('review') },
      { id: 'trash', usage: '>trash', hint: 'Restore deleted rows', run: () => openToolsModal('trash') },
      { id: 'audio', usage: '>audio', hint: 'Toggle ambient focus audio', run: () => toggleAmbientAudio() },
      { id: 'sync', usage: '>sync', hint: 'Flush queued offline writes', run: () => flushWriteQueue(true) },
      { id: 'keys', usage: '>keys', hint: 'Keyboard shortcut sheet', run: () => openToolsModal('keys') },
      { id: 'print', usage: '>print', hint: 'Print the current view', run: () => window.print() },
      { id: 'gps', usage: '>gps', hint: 'Lock live GPS for UM 3D Atlas walking routes', run: () => window.umAtlas && window.umAtlas.requestUserCampusGps(true) },
      { id: 'dense', usage: '>dense', hint: 'Toggle Pro Ultra-Dense / Standard UI density', run: () => toggleDensityMode() },
      { id: 'netlify', usage: '>netlify', hint: 'Open Netlify static bundle & export suite', run: () => openToolsModal('export') },
      { id: 'changelog', usage: '>changelog', hint: 'Version & release changelog', run: () => openToolsModal('changelog') },
      { id: 'version', usage: '>version', hint: 'Version & release changelog', run: () => openToolsModal('changelog') }
    ];

    // ---- command history (D3.10) -------------------------------------------
    // The last 10 commands run from the palette, surfaced as "RECENT" whenever the operator
    // opens command mode with a bare ">". No extra keystrokes, no conflict with list nav.
    const CMD_HISTORY_KEY = 'autumn_cmd_history';

    function loadCommandHistory() {
      try {
        const raw = safeStorage.getItem(CMD_HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
      } catch (e) { return []; }
    }

    function recordCommandHistory(text) {
      const clean = String(text || '').trim();
      if (!clean) return;
      const list = loadCommandHistory().filter(entry => entry !== clean);
      list.unshift(clean);
      safeStorage.setItem(CMD_HISTORY_KEY, JSON.stringify(list.slice(0, 10)));
    }

    function executeCommandString(text) {
      const body = String(text || '').replace(/^>/, '').trim();
      const segments = body.split(/\s+/);
      const cmd = (segments[0] || '').toLowerCase();
      const args = segments.slice(1).join(' ');
      const found = PALETTE_COMMANDS.find(c => c.id === cmd);
      if (!found) return false;
      recordCommandHistory('>' + cmd + (args ? ' ' + args : ''));
      found.run(args);
      return true;
    }

    function paletteMatches(rawQuery) {
      const body = String(rawQuery || '').replace(/^>/, '').trim();
      const segments = body.split(/\s+/);
      const cmd = (segments[0] || '').toLowerCase();
      const args = segments.slice(1).join(' ');
      const exact = PALETTE_COMMANDS.find(c => c.id === cmd);

      if (exact) {
        return [{
          category: 'RUN // ' + exact.id.toUpperCase(),
          badgeClass: 'badge-green',
          title: exact.usage,
          subtitle: exact.hint,
          action: () => {
            clearGlobalSearch();
            recordCommandHistory('>' + exact.id + (args ? ' ' + args : ''));
            exact.run(args);
          }
        }];
      }

      const recent = body === ''
        ? loadCommandHistory().slice(0, 4).map(entry => ({
            category: 'RECENT',
            badgeClass: 'badge-amber',
            title: entry,
            subtitle: 'run it again',
            action: () => { clearGlobalSearch(); executeCommandString(entry); }
          }))
        : [];

      const needle = body.toLowerCase();
      const matches = PALETTE_COMMANDS
        .filter(c => !needle || c.id.indexOf(needle) !== -1 || c.hint.toLowerCase().indexOf(needle) !== -1)
        .map(c => ({
          category: 'COMMAND',
          badgeClass: 'badge-blue',
          title: c.usage,
          subtitle: c.hint,
          action: () => {
            clearGlobalSearch();
            recordCommandHistory('>' + c.id);
            c.run('');
          }
        }));

      return recent.concat(matches);
    }


    // -------------------------------------------------- 13.16 tools router
    const TOOLS_PANELS = ['diagnostics', 'export', 'review', 'habits', 'achievements', 'trash', 'health', 'attachments', 'keys', 'system', 'changelog'];

    const TOOLS_RENDERERS = {
      diagnostics: () => renderToolsDiagnostics(),
      export: () => renderToolsExport(),
      review: () => renderToolsReview(),
      habits: () => renderToolsHabits(),
      achievements: () => renderToolsAchievements(),
      trash: () => renderToolsTrash(),
      health: () => previewHealthImport(),
      attachments: () => {},
      keys: () => renderToolsKeys(),
      system: () => renderToolsSystem(),
      changelog: () => renderChangelog()
    };

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

    function showToolsPanel(name) {
      const panelName = TOOLS_PANELS.indexOf(name) >= 0 ? name : 'diagnostics';
      TOOLS_PANELS.forEach((p) => {
        const el = document.getElementById('tools-panel-' + p);
        const tab = document.getElementById('tools-tab-' + p);
        if (el) el.classList.toggle('hidden', p !== panelName);
        if (tab) {
          tab.classList.toggle('active-view', p === panelName);
          tab.setAttribute('aria-selected', p === panelName ? 'true' : 'false');
          // Roving tabindex: only the selected panel tab is in the Tab order (WAI-ARIA tabs).
          tab.setAttribute('tabindex', p === panelName ? '0' : '-1');
        }
      });
      const render = TOOLS_RENDERERS[panelName];
      if (render) {
        try { render(); } catch (e) { console.warn('[autumn] tools panel "' + panelName + '" failed:', e); }
      }
      updateAmbientAudioUI();
    }

    function openToolsModal(name) {
      openModal('tools-modal');
      showToolsPanel(name || 'diagnostics');
    }

    // The "system" panel holds toggles that are not data views.
    function renderToolsSystem() {
      updateAmbientAudioUI();
      const status = document.getElementById('tools-system-status');
      if (status) status.textContent = navigator.onLine ? 'ONLINE' : 'OFFLINE';
      const pending = document.getElementById('tools-system-pending');
      if (pending) pending.textContent = pendingWrites.length + ' queued';
      const installBtn = document.getElementById('tools-install-btn');
      if (installBtn && deferredInstallPrompt) installBtn.classList.remove('hidden');
    }


    // ==========================================
    // 12. SELF-TEST HARNESS — open index.html#selftest
    // Pure-function assertions so a future edit to the debt chain, the grading engine or the
    // sanitiser fails loudly instead of silently changing the numbers.
    // ==========================================
    function runSelfTest() {
      const results = [];
      const check = (name, fn) => {
        try {
          const out = fn();
          results.push({ name: name, ok: out === true, detail: out === true ? 'ok' : String(out) });
        } catch (e) {
          results.push({ name: name, ok: false, detail: (e && e.message) || String(e) });
        }
      };

      check('getLocalDateString pads month/day', () => getLocalDateString(new Date(2026, 0, 5)) === '2026-01-05');
      check('formatHours(1.5) → 1h 30m', () => {
        const s = formatHours(1.5);
        return s.indexOf('1h') === 0 && s.indexOf('30m') !== -1 ? true : s;
      });
      check('escapeHtml neutralises a tag', () => escapeHtml('<b>') === '&lt;b&gt;');
      check('drive kind: docx from an octet-stream upload', () => getDriveFileKind({ name: 'Lecture Notes.docx', mimeType: 'application/octet-stream' }) === 'docx');
      check('drive kind: legacy .doc', () => getDriveFileKind({ name: 'old.doc', mimeType: 'application/msword' }) === 'doc');
      check('drive kind: xlsx from mime only', () => getDriveFileKind({ name: 'no-extension', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) === 'xlsx');
      check('drive kind: google sheet', () => getDriveFileKind({ name: 'Grades', mimeType: 'application/vnd.google-apps.spreadsheet' }) === 'gsheet');
      check('drive kind: pptx from the name only', () => getDriveFileKind({ name: 'Deck.pptx', mimeType: '' }) === 'pptx');
      check('reader offers drive/office/gview/native for docx', () => {
        const built = buildDriveReaderSources({ id: 'ABC', name: 'a.docx', mimeType: 'application/octet-stream', webContentLink: 'https://drive.google.com/uc?id=ABC' });
        return ['drive', 'office', 'gview', 'native'].every(id => built.sources.some(s => s.id === id)) && built.sourceId === 'drive';
      });
      check('reader defaults a Google Doc to the docs.google.com embed', () => {
        const built = buildDriveReaderSources({ id: 'XYZ', name: 'Plan', mimeType: 'application/vnd.google-apps.document' });
        return built.sourceId === 'gdocs' && built.sources[0].url === 'https://docs.google.com/document/d/XYZ/preview?rm=minimal';
      });
      check('reader quotes the Office Online src', () => {
        const built = buildDriveReaderSources({ id: 'Q 1', name: 'q.xlsx', mimeType: 'application/vnd.ms-excel', webContentLink: 'https://drive.google.com/uc?id=Q%201' });
        const office = built.sources.find(s => s.id === 'office');
        return Boolean(office) && office.url.indexOf('view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fdrive.google.com') !== -1;
      });
      check('escapeHtml escapes quotes', () => escapeHtml('"\'') === '&quot;&#039;');
      check('jsAttrQuote escapes a single quote', () => jsAttrQuote("a'b").indexOf('&#039;') !== -1);
      check('sanitizeNoteHtml drops <img>', () => sanitizeNoteHtml('<img src=x onerror=alert(1)>').indexOf('<img') === -1);
      check('sanitizeNoteHtml drops javascript: href', () => sanitizeNoteHtml('<a href="javascript:x">a</a>').indexOf('javascript:') === -1);
      check('sanitizeNoteHtml keeps <b>', () => sanitizeNoteHtml('<b>k</b>').indexOf('<b>k</b>') !== -1);
      check('stripHtmlTags strips markup', () => stripHtmlTags('<b>a</b><br>b') === 'a b');
      check('isWeekendDate saturday', () => isWeekendDate('2026-10-31') === true);
      check('isWeekendDate monday', () => isWeekendDate('2026-11-02') === false);
      check('study base goal weekday', () => getStudyBaseGoalForDate('2026-11-02') === STUDY_WEEKDAY_GOAL);
      // v1.3.0 — surplus/debt aware scoring baseline
      check('scoring baseline follows a carried surplus', () => {
        const rows = [{ date: '2026-11-01', computed_overflow: -2.7 }];
        const base = resolveScoringBaseline('2026-11-02', rows, getStudyBaseGoalForDate, MAX_DAILY);
        return Math.abs(base.baseline - (getStudyBaseGoalForDate('2026-11-02') - 2.7)) < 0.001 && Math.abs(base.surplus - 2.7) < 0.001;
      });
      check('scoring baseline floors at 25% of base', () => {
        const rows = [{ date: '2026-11-01', computed_overflow: -99 }];
        return resolveScoringBaseline('2026-11-02', rows, getStudyBaseGoalForDate, MAX_DAILY).baseline === getStudyBaseGoalForDate('2026-11-02') * SCORING_BASELINE_FLOOR_RATIO;
      });
      check('debt raises the scoring baseline', () => {
        const rows = [{ date: '2026-11-01', computed_overflow: 2.7 }];
        const base = resolveScoringBaseline('2026-11-02', rows, getStudyBaseGoalForDate, MAX_DAILY);
        return Math.abs(base.baseline - (getStudyBaseGoalForDate('2026-11-02') + 2.7)) < 0.001;
      });
      check('surplus boost is capped, proportional and progress-gated', () =>
        computeSurplusBoostPts(99, 7, 1, 6) === 6 &&
        Math.abs(computeSurplusBoostPts(3.5, 7, 1, 6) - 3) < 0.001 &&
        computeSurplusBoostPts(2.7, 7, 0, 6) === 0);
      check('study base goal weekend', () => getStudyBaseGoalForDate('2026-10-31') === STUDY_WEEKEND_GOAL);
      check('steps base goal weekday', () => getStepsBaseGoalForDate('2026-11-02') === STEPS_WEEKDAY_GOAL);
      check('addDaysToDateStr crosses a month', () => addDaysToDateStr('2026-10-31', 1) === '2026-11-01');
      check('evaluateTaskDeadline overdue', () => {
        const d = new Date();
        d.setDate(d.getDate() - 2);
        const info = evaluateTaskDeadline(getLocalDateString(d));
        return info && info.level === 'OVERDUE' ? true : 'got ' + JSON.stringify(info);
      });
      check('evaluateTaskDeadline due today', () => {
        const info = evaluateTaskDeadline(getLocalDateString(new Date()));
        return info && info.level === 'CRITICAL' ? true : 'got ' + JSON.stringify(info);
      });
      check('simpleHash is deterministic', () => simpleHash('autumn') === simpleHash('autumn'));
      check('formatSteps groups thousands', () => formatSteps(12345) === '12,345');
      check('formatTimerHMS(3661)', () => formatTimerHMS(3661) === '01:01:01');
      check('calcPearsonCorrelation perfect line = 1', () => {
        const r = calcPearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8]);
        return Math.abs(r - 1) < 1e-9 ? true : String(r);
      });
      // Tools-hub regressions: the offline queue, its merge rule, the task-meta hydration and
      // the command palette are the newest moving parts, so they get assertions too.
      check('isNetworkError detects a dead link', () => isNetworkError({ message: 'TypeError: Failed to fetch' }) === true);
      check('isNetworkError ignores RLS rejections', () => isNetworkError({ message: 'row-level security policy' }) === false);
      check('mergeQueuedPayload keeps the larger online value', () => {
        const snapshot = globalStudyRows;
        globalStudyRows = [{ date: '2000-01-01', actual_hours: 9 }];
        const merged = mergeQueuedPayload({ table: 'study_ledger', payload: { date: '2000-01-01', actual_hours: 4 } });
        globalStudyRows = snapshot;
        return merged.actual_hours === 9 ? true : String(merged.actual_hours);
      });
      check('mergeQueuedPayload keeps the larger offline value', () => {
        const snapshot = globalStudyRows;
        globalStudyRows = [{ date: '2000-01-02', actual_hours: 3 }];
        const merged = mergeQueuedPayload({ table: 'study_ledger', payload: { date: '2000-01-02', actual_hours: 6 } });
        globalStudyRows = snapshot;
        return merged.actual_hours === 6 ? true : String(merged.actual_hours);
      });
      check('hydrateTaskMetaFromRows merges instead of overwriting', () => {
        const snapshot = taskMetaMap;
        taskMetaMap = { t1: { dueDate: '2026-11-05', eventId: 'ev-local' } };
        hydrateTaskMetaFromRows([{ id: 't1', due_date: null, event_id: null }]);
        const kept = taskMetaMap.t1 && taskMetaMap.t1.eventId === 'ev-local' && taskMetaMap.t1.dueDate === '2026-11-05';
        taskMetaMap = snapshot;
        return kept === true ? true : JSON.stringify(taskMetaMap.t1);
      });
      check('parseHealthCsv dedupes by highest value', () => {
        const rows = parseHealthCsv('date,steps\n2026-10-30,9000\n2026-10-30,12000\n2026-10-31,7200');
        return rows.length === 2 && rows[0].steps === 12000 ? true : JSON.stringify(rows);
      });
      check('toCsv quotes commas', () => toCsv([{ a: 'x,y' }], [{ key: 'a' }]) === 'a\r\n"x,y"');
      check('paletteMatches lists commands for a bare ">"', () => paletteMatches('>').length > 5);
      check('paletteMatches resolves an exact command', () => {
        const matches = paletteMatches('>theme');
        return matches.length === 1 && matches[0].category.indexOf('RUN') === 0;
      });
      check('computeCurrentStudyStreak returns a number', () => Number.isFinite(computeCurrentStudyStreak()));
      // v1.4.0 — MD3 Cockpit, trajectory grade helper & Netlify/Density commands
      check('getGradeAndPassFromScore maps A+ and A thresholds', () =>
        getGradeAndPassFromScore(105).grade === 'A+' &&
        getGradeAndPassFromScore(96).grade === 'A' &&
        getGradeAndPassFromScore(45).grade === 'D');
      check('TAB_META has 6 core modules + focus (no redundant cockpit)', () => !TAB_META.overview && Boolean(TAB_META.study && TAB_META.resources));
      check('UM 3D Atlas fuzzy matcher resolves FSKTM & KK8 events', () => {
        if (!window.umAtlas) return 'umAtlas not loaded';
        const info = window.umAtlas.resolveEventUmTelemetry({ id: 't1', title: 'Algorithms Lecture @ FSKTM', location: 'Dewan Kuliah 2, FSKTM', start: new Date(Date.now() + 3600000), end: new Date(Date.now() + 7200000) });
        return Boolean(info && info.walkMins > 0 && info.deepLinkUrl.indexOf('um-3d-atlas.netlify.app') !== -1);
      });
      check('Task power module & correlation matrix initialized', () => Boolean(window.tasksPower && window.analyticsMatrix));

      const failed = results.filter((r) => !r.ok);
      const rowsHtml = results.map((r) =>
        '<div style="display:flex;gap:.5rem">' +
        '<span style="color:' + (r.ok ? '#34d399' : '#fca5a5') + '">' + (r.ok ? '[OK]' : '[ERR]') + '</span>' +
        '<span style="flex:1">' + escapeHtml(r.name) + '</span>' +
        '<span style="color:#8aa79a;max-width:46%;text-align:right">' + escapeHtml(r.detail) + '</span>' +
        '</div>'
      ).join('');

      const old = document.getElementById('autumn-selftest');
      if (old) old.remove();
      const box = document.createElement('div');
      box.id = 'autumn-selftest';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', 'Self test results');
      box.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(12,31,23,.86);display:flex;' +
        'align-items:center;justify-content:center;padding:1rem;font-family:"Inter",sans-serif;';
      box.innerHTML =
        '<div style="background:#0f241b;color:#d1fae5;border:1px solid #059669;max-width:760px;width:100%;' +
        'max-height:86vh;overflow:auto;padding:1rem;font-size:12px;line-height:1.7">' +
        '<div style="display:flex;justify-content:space-between;gap:1rem;border-bottom:1px solid #1e4635;padding-bottom:.5rem;margin-bottom:.5rem">' +
        '<strong>SELF-TEST // ' + (results.length - failed.length) + '/' + results.length + ' PASSED</strong>' +
        '<button type="button" onclick="document.getElementById(\'autumn-selftest\').remove()" ' +
        'style="background:#132d22;color:#34d399;border:1px solid #059669;padding:0 .5rem;cursor:pointer">CLOSE</button>' +
        '</div>' + rowsHtml + '</div>';
      document.body.appendChild(box);
      console.info('[autumn] self-test: ' + (results.length - failed.length) + '/' + results.length + ' passed', failed);
      return results;
    }

    // ==========================================
    // 11. INITIALIZATION ON LOAD
    // ==========================================
    window.addEventListener('DOMContentLoaded', async () => {
      // Single-file PWA boilerplate: canvas-drawn icon + Blob-URL manifest (no-op on file://).
      installInlinedManifest();
      // Stamp the release number onto the header chip from APP_VERSION (§1C).
      syncVersionUi();
      // Roles, labels and live regions for the existing markup (see §3B).
      enhanceA11y();
      // A dialog dismissed by anything other than closeModal() would leave the page frozen;
      // heal that on boot and whenever the tab regains focus.
      healStuckBodyScrollLock();
      window.addEventListener('focus', healStuckBodyScrollLock);
      window.addEventListener('pageshow', healStuckBodyScrollLock);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) healStuckBodyScrollLock();
      });
      // Tools hub bootstrap: pending offline writes survive a reload (see §13.2).
      loadWriteQueue();
      updateWriteQueueBadge();
      if (navigator.onLine && pendingWrites.length > 0) flushWriteQueue(false);
      // One-time nudge so the "›" command mode is discovered without reading docs (A5).
      if (!safeStorage.getItem('autumn_seen_cmd_hint')) {
        safeStorage.setItem('autumn_seen_cmd_hint', 'true');
        setTimeout(() => {
          showToast('COMMAND MODE', 'Type › in the search bar to run commands — e.g. ›study 7.5, ›export, ›theme.');
        }, 2500);
      }
      // "What's new": opens the changelog panel once per released version (§1C).
      maybeAnnounceVersion();
      // Live multi-device sync (§4B). Safe no-op when the tables are not in the
      // supabase_realtime publication — it simply never emits.
      initRealtimeSync();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);
      const todayStr = getLocalDateString(new Date());
      const currentWeekMondayStr = getWeekMondayDateString(new Date());

      document.getElementById('date-input').value = yesterdayStr;
      document.getElementById('steps-date-input').value = yesterdayStr;
      document.getElementById('run-date-input').value = todayStr;
      selectedNoteDate = currentWeekMondayStr;
      document.getElementById('notes-date-picker').value = currentWeekMondayStr;
      const statDateIn = document.getElementById('stat-card-date-input');
      if (statDateIn) statDateIn.value = todayStr;
      updateStudyTimerUI();
      restoreTimerState();

      // Load saved Focus Directive if present
      try {
        const savedDirective = localStorage.getItem('autumn_focus_directive');
        const dirInput = document.getElementById('focus-directive-input');
        if (dirInput && savedDirective) dirInput.value = savedDirective;
      } catch (e) {}

      // 1. Instant paint from the local cache (also the offline read path).
      hydrateLedgersFromCache();

      // 2. Critical data only: both ledgers (grading engine) + tasks (navbar deadlines).
      await Promise.allSettled([
        fetchAndRenderStudy(),
        fetchAndRenderSteps(),
        fetchAndRenderTasks()
      ]);

      // Study + steps ledgers are now in memory, so the grading engine can safely run
      // (this previously happened mid-load via the auth callback and wrote bad grades).
      ledgerDataReady = true;
      await fetchAndSyncOperationalYield();

      // 3. Calendar shell (credentials + events feed the sticky radar).
      await loadSavedGCalCredentials();
      await fetchGoogleCalendarEvents(false);
      // The task board painted before the calendar existed — repaint the views that show
      // linked-event badges now that globalCalendarEvents is populated (B1/B2).
      refreshEventLinkedViews(true);

      // 4. Everything else warms up in the background so the first paint is not blocked by
      //    six unrelated table fetches (previously all 9 ran before anything could render).
      const warmUpSecondaryData = () => {
        Promise.allSettled([
          fetchAndRenderHabits(),
          fetchAndRenderRunningLogs(),
          fetchAndRenderNotes(),
          fetchAndRenderGeneralNotes(),
          fetchAndRenderPortfolioLogs(),
          fetchAndRenderYoutubeResources()
        ]);
        loadSavedGDriveConfig().then(() => fetchGoogleDriveResources(false)).catch(() => {});
      };
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(warmUpSecondaryData, { timeout: 2500 });
      } else {
        setTimeout(warmUpSecondaryData, 600);
      }

      // 5. Restore the module from the URL (#study / #calendar / …) so refreshes, bookmarks
      //    and Back/Forward land on the right tab instead of always resetting to 01 // STUDY.
      // Optional diagnostics: index.html#selftest runs the pure-function assertions (§12).
      if ((location.hash || '').replace('#', '') === 'selftest') {
        setTimeout(() => { try { runSelfTest(); } catch (e) { console.error('[autumn] self-test failed:', e); } }, 700);
      }

      const requestedTab = (location.hash || '').replace('#', '');
      if (requestedTab === 'changelog') {
        // Deep link straight into the release notes (see §1C).
        openToolsModal('changelog');
      } else if (requestedTab && TAB_META[requestedTab] && requestedTab !== 'focus') {
        suppressHistoryPush = true;
        switchTab(requestedTab);
        suppressHistoryPush = false;
      }
    });
  