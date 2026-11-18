// autumn // RELEASE CHANGELOG DATA (lazy-loaded when Tools Hub -> CHANGELOG opens)
window.AUTUMN_CHANGELOG = [
  {
    version: '1.5.0',
    date: '2026-11-18',
    label: 'LIGHTSPEED SVG ENGINE & MODULAR COMMAND LEDGER',
    items: [
      { tag: 'NEW', text: 'Zero-Dependency Native SVG Charts: replaced ~200 KB Chart.js CDN & canvas elements with interactive native SVG trajectories and 30D + 7D EMA overlay charts (window.AutumnCharts) featuring responsive resize and pointer/touch crosshairs.' },
      { tag: 'NEW', text: 'Modular Tab Fragments & On-Demand Script Splitting: initial page load renders only the Command Header, 01 // Study, Terminal Drawer, and Toast Banner — lazy-loading Steps, Calendar, Tasks, Notes, Resources, Focus, 11 modals, and secondary JS modules on demand.' },
      { tag: 'IMPROVE', text: 'Critical CSS Pipeline & Unused Rule Pruning: inlines above-the-fold critical CSS into <head> during build, strips unused utility rules, and async-loads deferred styles with zero render-blocking stylesheets.' },
      { tag: 'IMPROVE', text: 'Staggered Hydration & Idle Resource Scheduling: defers secondary Supabase table fetches, tasks power helpers, and UM 3D Atlas index loading past initial interactive readiness while keeping live radar telemetry, shortcuts, and all owner controls instant.' }
    ]
  },
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
