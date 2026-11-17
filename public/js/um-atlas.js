// ============================================================================
// autumn // UM 3D ATLAS (https://um-3d-atlas.netlify.app), 1PX WIREFRAME SVGS,
// KIE1003-KIX1001 DETAILS PARSER, COMPACT 4TH-BAR STRIPS & INLINE LEDGER EDITOR
// - Zero emojis: Minimal 1px hairline wireframe schematic SVGs (window.autumnIcons)
// - Full 1,546-place UM 3D Atlas index + 161 Faculty of Engineering (FK) nodes
// - Details-first location parser for KIE1003, KIE1004, KIE1005, KIX1001
// - Maps fkej = fkum = fac of engineering -> Faculty of Engineering (FK) fallback
// - Compact 4th-navbar-style strips for 01 // study (Course Hub) & 03 // calendar
// - Inline table cell editing & keyboard navigation across Study & Steps ledgers
// ============================================================================

(function () {
  // ── 1. Minimal 1px Hairline Wireframe Schematic SVG Icon Registry ─────────
  const SVG_ATTR = 'class="svg-wire" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"';

  const ICONS = {
    walk: `<svg ${SVG_ATTR}><circle cx="8.5" cy="2.5" r="1.3"/><path d="M5.5 6.5L8.5 5L11 7.5M7.5 5.5L6.5 10L4 14M7 9.5L10 11.5L11 14.5"/></svg>`,
    pin: `<svg ${SVG_ATTR}><circle cx="8" cy="6.5" r="2.2"/><path d="M8 1.5C5.2 1.5 3 3.7 3 6.5C3 10.2 8 14.5 8 14.5C8 14.5 13 10.2 13 6.5C13 3.7 10.8 1.5 8 1.5Z"/></svg>`,
    gps: `<svg ${SVG_ATTR}><circle cx="8" cy="8" r="4.5"/><circle cx="8" cy="8" r="1"/><path d="M8 1V3.5M8 12.5V15M1 8H3.5M12.5 8H15"/></svg>`,
    route: `<svg ${SVG_ATTR}><rect x="2" y="10.5" width="3" height="3"/><rect x="11" y="2.5" width="3" height="3"/><path d="M5 12H8.5V4H11M9.5 2.5L11 4L9.5 5.5"/></svg>`,
    ext: `<svg ${SVG_ATTR}><path d="M6 3H3V13H13V10M9 3H13V7M13 3L7.5 8.5"/></svg>`,
    clock: `<svg ${SVG_ATTR}><rect x="2" y="2" width="12" height="12"/><path d="M8 4.5V8L10.5 9.5"/></svg>`,
    check: `<svg ${SVG_ATTR}><path d="M3 8.5L6.5 12L13 4.5"/></svg>`,
    checkbox: `<svg ${SVG_ATTR}><rect x="2" y="2" width="12" height="12"/><path d="M4.5 8.2L7 10.8L11.5 5.2"/></svg>`,
    close: `<svg ${SVG_ATTR}><path d="M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5"/></svg>`,
    trash: `<svg ${SVG_ATTR}><path d="M2.5 4.5H13.5M5.5 4.5V2.5H10.5V4.5M4 4.5V13.5H12V4.5M6.5 7V11.5M9.5 7V11.5"/></svg>`,
    edit: `<svg ${SVG_ATTR}><path d="M11 2.5L13.5 5L5.5 13H3V10.5L11 2.5Z"/></svg>`,
    plus: `<svg ${SVG_ATTR}><path d="M8 3V13M3 8H13"/></svg>`,
    tools: `<svg ${SVG_ATTR}><path d="M2 4H14M2 8H14M2 12H14"/><rect x="5" y="2.5" width="2.5" height="3" fill="var(--bg-panel, #fff)"/><rect x="9.5" y="6.5" width="2.5" height="3" fill="var(--bg-panel, #fff)"/><rect x="4" y="10.5" width="2.5" height="3" fill="var(--bg-panel, #fff)"/></svg>`,
    focus: `<svg ${SVG_ATTR}><path d="M2 6V2H6M10 2H14V6M14 10V14H10M6 14H2V10"/><circle cx="8" cy="8" r="1.5"/></svg>`,
    course: `<svg ${SVG_ATTR}><rect x="3" y="3" width="10" height="10"/><path d="M5.5 1V3M10.5 1V3M5.5 13V15M10.5 13V15M1 5.5H3M1 10.5H3M13 5.5H15M13 10.5H15"/></svg>`,
    sync: `<svg ${SVG_ATTR}><path d="M13 5.5V2.5H10M13 2.5L10.5 5C9.2 3.7 7.1 3.5 5.4 4.5C3.5 5.6 2.8 8 3.7 10M3 10.5V13.5H6M3 13.5L5.5 11C6.8 12.3 8.9 12.5 10.6 11.5C12.5 10.4 13.2 8 12.3 6"/></svg>`,
    lock: `<svg ${SVG_ATTR}><rect x="3.5" y="7" width="9" height="6.5"/><path d="M5.5 7V4.8C5.5 3.4 6.6 2.3 8 2.3C9.4 2.3 10.5 3.4 10.5 4.8V7"/></svg>`,
    alert: `<svg ${SVG_ATTR}><path d="M8 2L14.5 13.5H1.5L8 2ZM8 6.5V9.8M8 11.5V12.2"/></svg>`,
    calendar: `<svg ${SVG_ATTR}><rect x="2" y="3" width="12" height="11"/><path d="M2 6.5H14M5 1.5V4M11 1.5V4"/></svg>`,
    folder: `<svg ${SVG_ATTR}><path d="M2 3.5H6.5L8 5.5H14V13H2V3.5Z"/></svg>`,
    link: `<svg ${SVG_ATTR}><path d="M6.5 9.5L9.5 6.5M5.5 7.5L3.5 9.5C2.5 10.5 2.5 12 3.5 13C4.5 14 6 14 7 13L9 11M10.5 8.5L12.5 6.5C13.5 5.5 13.5 4 12.5 3C11.5 2 10 2 9 3L7 5"/></svg>`,
    menu: `<svg ${SVG_ATTR}><path d="M2 4H14M2 8H14M2 12H14"/></svg>`,
    star: `<svg ${SVG_ATTR}><path d="M8 2L9.8 5.8L14 6.3L10.9 9.2L11.7 13.4L8 11.3L4.3 13.4L5.1 9.2L2 6.3L6.2 5.8L8 2Z"/></svg>`,
    bell: `<svg ${SVG_ATTR}><path d="M4 11V7C4 4.8 5.8 3 8 3C10.2 3 12 4.8 12 7V11L13.5 12.5H2.5L4 11ZM6.8 12.5C6.8 13.3 7.3 14 8 14C8.7 14 9.2 13.3 9.2 12.5"/></svg>`,
    clip: `<svg ${SVG_ATTR}><path d="M10.5 4.5L5.2 9.8C4.5 10.5 4.5 11.6 5.2 12.3C5.9 13 7 13 7.7 12.3L13.3 6.7C14.4 5.6 14.4 3.8 13.3 2.7C12.2 1.6 10.4 1.6 9.3 2.7L3.7 8.3C2.1 9.9 2.1 12.4 3.7 14"/></svg>`,
    pulse: `<svg ${SVG_ATTR}><path d="M1.5 8H4.5L6.5 3.5L9.5 12.5L11.5 8H14.5"/></svg>`
  };

  window.autumnIcons = {
    svg: (name) => ICONS[name] || ICONS.course,
    raw: ICONS
  };

  function getCalEvents() {
    return typeof globalCalendarEvents !== 'undefined' && Array.isArray(globalCalendarEvents)
      ? globalCalendarEvents
      : (Array.isArray(window.globalCalendarEvents) ? window.globalCalendarEvents : []);
  }
  function getTaskList() {
    return typeof globalTaskItems !== 'undefined' && Array.isArray(globalTaskItems)
      ? globalTaskItems
      : (Array.isArray(window.globalTaskItems) ? window.globalTaskItems : []);
  }
  function getStudyRowsList() {
    return typeof globalStudyRows !== 'undefined' && Array.isArray(globalStudyRows)
      ? globalStudyRows
      : (Array.isArray(window.globalStudyRows) ? window.globalStudyRows : []);
  }
  function getStepsRowsList() {
    return typeof globalStepsRows !== 'undefined' && Array.isArray(globalStepsRows)
      ? globalStepsRows
      : (Array.isArray(window.globalStepsRows) ? window.globalStepsRows : []);
  }

  // ── 2. UM 3D Atlas Constants & Core Places ────────────────────────────────
  const UM_ATLAS_BASE_URL = 'https://um-3d-atlas.netlify.app';
  const UM_CAMPUS_CENTER = [101.6535, 3.1209]; // [lng, lat]
  const UM_CAMPUS_MAX_RADIUS_M = 6500;
  const WALK_SPEED_M_PER_MIN = 80;
  const WALK_PATH_DETOUR_FACTOR = 1.22;
  const DEFAULT_ARRIVAL_BUFFER_MINS = 3;

  const STORAGE_ORIGIN_KEY = 'autumn_um_default_origin';
  const STORAGE_DEST_OVERRIDES_KEY = 'autumn_um_event_dest_overrides';
  const STORAGE_LAST_GPS_KEY = 'autumn_um_last_gps';
  const STORAGE_COURSE_HOURS_KEY = 'autumn_course_study_log_map';

  const TRACKED_ENG_COURSES = [
    { code: 'KIE1003', name: 'Digital Systems', defaultBlockHint: 'FK Block Y' },
    { code: 'KIE1004', name: 'Programming I', defaultBlockHint: 'FK Block Y' },
    { code: 'KIE1005', name: 'Circuit Analysis I', defaultBlockHint: 'FK Block Y' },
    { code: 'KIX1001', name: 'Engineering Mathematics I', defaultBlockHint: 'Faculty of Engineering' }
  ];

  const CORE_FALLBACK_PLACES = [
    { id: 'gate/way-992786254', kind: 'gate', title: 'KL gate', subtitle: 'Gate · Federal Highway / FK Entrance', faculty_id: '', center: [101.663025, 3.118763], keywords: 'kl gate main entrance federal highway' },
    { id: 'gate/9509924125', kind: 'gate', title: 'Main Entrance', subtitle: 'Gate · UM Main Entrance', faculty_id: '', center: [101.658184, 3.130169], keywords: 'main entrance gate utama' },
    { id: 'gate/way-992786252', kind: 'gate', title: 'PJ gate', subtitle: 'Gate · Petaling Jaya Entrance', faculty_id: '', center: [101.651094, 3.11578], keywords: 'pj gate petaling jaya' },
    { id: 'gate/9116471603', kind: 'gate', title: 'Pintu Pagar Utama', subtitle: 'Gate · Jalan Universiti Entrance', faculty_id: '', center: [101.6509, 3.124621], keywords: 'pintu pagar utama jalan universiti' },
    { id: 'rail/KJ19', kind: 'rail_station', title: 'LRT Universiti (KL Gateway) (KJ19)', subtitle: 'LRT Kelana Jaya Line', faculty_id: '', center: [101.66174, 3.11456], keywords: 'lrt universiti kj19 kl gateway' },
    { id: 'rail/KG12', kind: 'rail_station', title: 'MRT Phileo Damansara (KG12)', subtitle: 'MRT Kajang Line', faculty_id: '', center: [101.64292, 3.12925], keywords: 'mrt phileo kg12' },
    { id: 'rail/KJ18', kind: 'rail_station', title: 'LRT Kerinchi (KJ18)', subtitle: 'LRT Kelana Jaya Line', faculty_id: '', center: [101.66851, 3.11548], keywords: 'lrt kerinchi kj18' },
    { id: 'FK', kind: 'faculty', title: 'Faculty of Engineering', subtitle: 'FK · Engineering & Technology', faculty_id: 'FK', center: [101.65535, 3.11785], keywords: 'fk fkej fkum fac of engineering faculty of engineering fakulti kejuruteraan kie1003 kie1004 kie1005 kix1001' },
    { id: 'way/358009632', kind: 'building', title: 'FK Block Y (Electrical Engineering)', subtitle: 'FK · 4 floors · FK-Y', faculty_id: 'FK', center: [101.6548, 3.1179], keywords: 'fk block y blok y electrical engineering dk8 dk9 fk-y' },
    { id: 'way/358009632::FK-Y-DK8', kind: 'room', title: 'Dewan Kuliah 8 (DK8)', subtitle: 'FK Block Y (Electrical Engineering) · Ground (G) · FK-Y-DK8', faculty_id: 'FK', center: [101.6548, 3.1179], keywords: 'dk8 dewan kuliah 8 fk block y electrical engineering' },
    { id: 'way/358009632::FK-Y-DK9', kind: 'room', title: 'Dewan Kuliah 9 (DK9)', subtitle: 'FK Block Y (Electrical Engineering) · Ground (G) · FK-Y-DK9', faculty_id: 'FK', center: [101.6548, 3.1179], keywords: 'dk9 dewan kuliah 9 fk block y electrical engineering' },
    { id: 'way/358009631', kind: 'building', title: 'FK Block T (DK2, DK3 & Multi-Level Complex)', subtitle: 'FK · 5 floors · FK-T', faculty_id: 'FK', center: [101.6552, 3.1182], keywords: 'fk block t blok t dk2 dk3 fk-t' },
    { id: 'way/358009631::FK-T-DK2', kind: 'room', title: 'Dewan Kuliah 2 (DK2 FK)', subtitle: 'FK Block T · Ground (G) · FK-T-DK2', faculty_id: 'FK', center: [101.6552, 3.1182], keywords: 'dk2 dewan kuliah 2 fk block t' },
    { id: 'way/358009631::FK-T-DK3', kind: 'room', title: 'Dewan Kuliah 3 (DK3 FK)', subtitle: 'FK Block T · Ground (G) · FK-T-DK3', faculty_id: 'FK', center: [101.6552, 3.1182], keywords: 'dk3 dewan kuliah 3 fk block t' },
    { id: 'way/996056951', kind: 'building', title: 'FK Block B (Dewan Kuliah 1)', subtitle: 'FK · 2 floors · FK-B', faculty_id: 'FK', center: [101.6555, 3.1177], keywords: 'fk block b blok b dk1 dewan kuliah 1' },
    { id: 'way/996056951::FK-B-DK1', kind: 'room', title: 'Dewan Kuliah 1 (DK1 FK)', subtitle: 'FK Block B · Ground (G) · FK-B-DK1', faculty_id: 'FK', center: [101.6555, 3.1177], keywords: 'dk1 dewan kuliah 1 fk block b' },
    { id: 'way/1007653253', kind: 'building', title: 'FK Block U (Lecture Halls & Auditorium)', subtitle: 'FK · 5 floors · FK-U', faculty_id: 'FK', center: [101.6558, 3.1181], keywords: 'fk block u blok u bk1 bk2 auditorium fk-u' },
    { id: 'way/1007653253::FK-U-AUD', kind: 'room', title: 'Engineering Auditorium', subtitle: 'FK Block U · Ground (G) · FK-U-AUD', faculty_id: 'FK', center: [101.6558, 3.1181], keywords: 'engineering auditorium aud fk-u-aud' },
    { id: 'way/358004268', kind: 'building', title: 'Menara Kejuruteraan (Block L Admin)', subtitle: 'FK · 9 floors · FK-L', faculty_id: 'FK', center: [101.6553, 3.1175], keywords: 'menara kejuruteraan block l blok l fk-l' },
    { id: 'way/358006849', kind: 'building', title: 'FK Block D (Research & The Cube)', subtitle: 'FK · 3 floors · FK-D', faculty_id: 'FK', center: [101.6550, 3.1176], keywords: 'fk block d blok d the cube fk-d' },
    { id: 'FSKTM', kind: 'faculty', title: 'Faculty of Computer Science & IT (FSKTM)', subtitle: 'FSKTM · Computing & AI', faculty_id: 'FSKTM', center: [101.65055, 3.12822], keywords: 'fsktm computer science it fcsit mm1 mm2' },
    { id: 'FS', kind: 'faculty', title: 'Faculty of Science (FS)', subtitle: 'FS · Natural Sciences', faculty_id: 'FS', center: [101.6537, 3.1232], keywords: 'fs science sains physics chemistry mathematics ism' },
    { id: 'FASS', kind: 'faculty', title: 'Faculty of Arts & Social Sciences (FASS)', subtitle: 'FASS · Arts & Humanities', faculty_id: 'FASS', center: [101.65235, 3.12135], keywords: 'fass fsss arts social sciences sastera' },
    { id: 'FPE', kind: 'faculty', title: 'Faculty of Business & Economics (FPE)', subtitle: 'FPE · Business & Economics', faculty_id: 'FPE', center: [101.65285, 3.1187], keywords: 'fpe fbe business economics azman hashim' },
    { id: 'FAB', kind: 'faculty', title: 'Faculty of Built Environment (FAB)', subtitle: 'FAB · Architecture & Design', faculty_id: 'FAB', center: [101.6556, 3.1163], keywords: 'fab built environment alam bina' },
    { id: 'FP', kind: 'faculty', title: 'Faculty of Education (FP)', subtitle: 'FP · Education', faculty_id: 'FP', center: [101.65225, 3.12035], keywords: 'fp education pendidikan' },
    { id: 'FLL', kind: 'faculty', title: 'Faculty of Languages & Linguistics (FLL)', subtitle: 'FLL · Languages', faculty_id: 'FLL', center: [101.65105, 3.1225], keywords: 'fbl fll languages linguistics bahasa' },
    { id: 'FL', kind: 'faculty', title: 'Faculty of Law (FL)', subtitle: 'FL · Law', faculty_id: 'FL', center: [101.6611, 3.11785], keywords: 'fuu fl law undang-undang' },
    { id: 'FOM', kind: 'faculty', title: 'Faculty of Medicine (FOM)', subtitle: 'FOM · Medical & Health', faculty_id: 'FOM', center: [101.65335, 3.1149], keywords: 'fom medicine perubatan ppum ummc' },
    { id: 'PASUM', kind: 'faculty', title: 'Centre for Foundation Studies (PASUM)', subtitle: 'PASUM · Foundation Studies', faculty_id: 'PASUM', center: [101.6594, 3.1228], keywords: 'pasum foundation asasi sains' },
    { id: 'CORE', kind: 'faculty', title: 'Chancellery, Main Library & DTC Core', subtitle: 'CORE · Central Campus', faculty_id: 'CORE', center: [101.6558, 3.1208], keywords: 'dtc dewan tunku canselor library perpustakaan central library exam hall' },
    { id: 'KK1', kind: 'faculty', title: '1st Residential College (KK1 / ASTAR)', subtitle: 'KK1 · Residential College', faculty_id: 'KK1', center: [101.65945, 3.11726], keywords: 'kk1 astar first college' },
    { id: 'KK2', kind: 'faculty', title: '2nd Residential College (KK2 / Tuanku Bahiyah)', subtitle: 'KK2 · Residential College', faculty_id: 'KK2', center: [101.65709, 3.11773], keywords: 'kk2 tuanku bahiyah second college' },
    { id: 'KK3', kind: 'faculty', title: '3rd Residential College (KK3 / Tuanku Kurshiah)', subtitle: 'KK3 · Residential College', faculty_id: 'KK3', center: [101.6506, 3.12402], keywords: 'kk3 kurshiah third college' },
    { id: 'KK4', kind: 'faculty', title: '4th Residential College (KK4 / Bestari)', subtitle: 'KK4 · Residential College', faculty_id: 'KK4', center: [101.64898, 3.12498], keywords: 'kk4 bestari fourth college' },
    { id: 'KK5', kind: 'faculty', title: '5th Residential College (KK5 / Dayasari)', subtitle: 'KK5 · Residential College', faculty_id: 'KK5', center: [101.65859, 3.12753], keywords: 'kk5 dayasari fifth college' },
    { id: 'KK7', kind: 'faculty', title: '7th Residential College (KK7 / Za\'ba)', subtitle: 'KK7 · Residential College', faculty_id: 'KK7', center: [101.65059, 3.12616], keywords: 'kk7 zaba seventh college' },
    { id: 'KK8', kind: 'faculty', title: '8th Residential College (KK8 / Kinabalu)', subtitle: 'KK8 · Residential College', faculty_id: 'KK8', center: [101.64965, 3.12992], keywords: 'kk8 kinabalu eighth college' },
    { id: 'KK9', kind: 'faculty', title: '9th Residential College (KK9 / Tun Syed Zahiruddin)', subtitle: 'KK9 · Residential College', faculty_id: 'KK9', center: [101.64534, 3.12112], keywords: 'kk9 syed putra ninth college' },
    { id: 'KK10', kind: 'faculty', title: '10th Residential College (KK10 / Tun Ahmad Zaidi)', subtitle: 'KK10 · Residential College', faculty_id: 'KK10', center: [101.65057, 3.13118], keywords: 'kk10 taz tenth college' },
    { id: 'KK11', kind: 'faculty', title: '11th Residential College (KK11 / Ungku Aziz)', subtitle: 'KK11 · Residential College', faculty_id: 'KK11', center: [101.66065, 3.12944], keywords: 'kk11 ungku aziz eleventh college' },
    { id: 'KK12', kind: 'faculty', title: '12th Residential College (KK12 / Raja Dr. Nazrin Shah)', subtitle: 'KK12 · Residential College', faculty_id: 'KK12', center: [101.66073, 3.12544], keywords: 'kk12 nazrin shah twelfth college' }
  ];

  const LEGACY_KEY_MIGRATION = {
    'gate:gate-main': 'gate:gate/way-992786254',
    'gate-main': 'gate/way-992786254',
    'rail_station:lrt-universiti': 'rail_station:rail/KJ19',
    'lrt-universiti': 'rail/KJ19',
    'rail_station:mrt-phileo': 'rail_station:rail/KG12',
    'mrt-phileo': 'rail/KG12'
  };

  function normalizeAtlasKey(key) {
    const k = String(key || '').trim();
    return LEGACY_KEY_MIGRATION[k] || k;
  }

  const SHORTHAND_ALIAS_MAP = [
    { rx: /\b(fkej|fkum|fac(?:ulty)?\s+of\s+engineering|fakulti\s+kejuruteraan|kejuruteraan|\bfk\b|menara\s+kejuruteraan|kie\s*100[345]|kix\s*1001|kie\d{4}|kix\d{4})\b/i, targetId: 'FK' },
    { rx: /\b(fsktm|fcsit|computer\s+science|comp\s+sci|mm[1-4]|dewan\s+kuliah\s+fsktm)\b/i, targetId: 'FSKTM' },
    { rx: /\b(faculty\s+of\s+science|institut\s+sains\s+matematik|\bism\b|\bfs\b|dewan\s+kuliah\s+sains)\b/i, targetId: 'FS' },
    { rx: /\b(fass|fsss|faculty\s+of\s+arts|sastera)\b/i, targetId: 'FASS' },
    { rx: /\b(fpe|fbe|business\s+(?:and|&)\s+economics|azman\s+hashim)\b/i, targetId: 'FPE' },
    { rx: /\b(fab|built\s+environment|alam\s+bina)\b/i, targetId: 'FAB' },
    { rx: /\b(faculty\s+of\s+education|fakulti\s+pendidikan|\bfp\b)\b/i, targetId: 'FP' },
    { rx: /\b(fbl|fll|languages\s+(?:and|&)\s+linguistics|fakulti\s+bahasa)\b/i, targetId: 'FLL' },
    { rx: /\b(fuu|faculty\s+of\s+law|undang-undang)\b/i, targetId: 'FL' },
    { rx: /\b(fom|faculty\s+of\s+medicine|perubatan|ppum|ummc)\b/i, targetId: 'FOM' },
    { rx: /\b(pasum|asasi\s+sains)\b/i, targetId: 'PASUM' },
    { rx: /\b(dtc|dewan\s+tunku\s+canselor|central\s+library|perpustakaan\s+utama|dewan\s+peperiksaan|exam\s+hall)\b/i, targetId: 'CORE' },
    { rx: /\b(kk\s*12|12th\s+college|kolej\s+12|nazrin\s+shah)\b/i, targetId: 'KK12' },
    { rx: /\b(kk\s*11|11th\s+college|kolej\s+11|ungku\s+aziz)\b/i, targetId: 'KK11' },
    { rx: /\b(kk\s*10|10th\s+college|kolej\s+10|ahmad\s+zaidi)\b/i, targetId: 'KK10' },
    { rx: /\b(kk\s*9|9th\s+college|kolej\s+9|syed\s+zahiruddin|syed\s+putra)\b/i, targetId: 'KK9' },
    { rx: /\b(kk\s*8|8th\s+college|kolej\s+8|kinabalu)\b/i, targetId: 'KK8' },
    { rx: /\b(kk\s*7|7th\s+college|kolej\s+7|za'?ba)\b/i, targetId: 'KK7' },
    { rx: /\b(kk\s*5|5th\s+college|kolej\s+5|dayasari)\b/i, targetId: 'KK5' },
    { rx: /\b(kk\s*4|4th\s+college|kolej\s+4|bestari)\b/i, targetId: 'KK4' },
    { rx: /\b(kk\s*3|3rd\s+college|kolej\s+3|kurshiah)\b/i, targetId: 'KK3' },
    { rx: /\b(kk\s*2|2nd\s+college|kolej\s+2|bahiyah)\b/i, targetId: 'KK2' },
    { rx: /\b(kk\s*1|1st\s+college|kolej\s+1|astar)\b/i, targetId: 'KK1' },
    { rx: /\b(kl\s+gate|pintu\s+kl)\b/i, targetId: 'gate/way-992786254' },
    { rx: /\b(pj\s+gate|petaling\s+jaya\s+gate)\b/i, targetId: 'gate/way-992786252' },
    { rx: /\b(main\s+gate|pintu\s+(?:pagar\s+)?utama|main\s+entrance)\b/i, targetId: 'gate/9509924125' },
    { rx: /\b(lrt\s+universiti|kl\s+gateway)\b/i, targetId: 'rail/KJ19' },
    { rx: /\b(lrt\s+kerinchi)\b/i, targetId: 'rail/KJ18' },
    { rx: /\b(mrt\s+phileo)\b/i, targetId: 'rail/KG12' }
  ];

  const FK_SPECIFIC_ROOM_PATTERNS = [
    { rx: /\b(dk\s*8|dewan\s+kuliah\s*8|fk-y-dk8)\b/i, id: 'way/358009632::FK-Y-DK8' },
    { rx: /\b(dk\s*9|dewan\s+kuliah\s*9|fk-y-dk9)\b/i, id: 'way/358009632::FK-Y-DK9' },
    { rx: /\b(dk\s*2|dewan\s+kuliah\s*2|fk-t-dk2)\b/i, id: 'way/358009631::FK-T-DK2' },
    { rx: /\b(dk\s*3|dewan\s+kuliah\s*3|fk-t-dk3)\b/i, id: 'way/358009631::FK-T-DK3' },
    { rx: /\b(dk\s*1|dewan\s+kuliah\s*1|fk-b-dk1)\b/i, id: 'way/996056951::FK-B-DK1' },
    { rx: /\b(bkk\s*3|bilik\s+kuliah\s+kimia\s*3|fk-v-bkk3)\b/i, id: 'way/358007641::FK-V-BKK3' },
    { rx: /\b(bkk\s*4|bilik\s+kuliah\s+kimia\s*4|fk-v-bkk4)\b/i, id: 'way/358007641::FK-V-BKK4' },
    { rx: /\b(bk\s*u?1|bilik\s+kuliah\s*u?1|fk-u-bk1)\b/i, id: 'way/1007653253::FK-U-BK1' },
    { rx: /\b(bk\s*u?2|bilik\s+kuliah\s*u?2|fk-u-bk2)\b/i, id: 'way/1007653253::FK-U-BK2' },
    { rx: /\b(tutorial\s+rooms?\s*t[12]|fk-t-bk)\b/i, id: 'way/358009631::FK-T-BK' },
    { rx: /\b(lab\s*t1|fk-t-lab1|integrated\s+engineering\s+lab)\b/i, id: 'way/358009631::FK-T-LAB1' },
    { rx: /\b(bp\s*204|fk-d-bp204)\b/i, id: 'way/358006849::FK-D-BP204' },
    { rx: /\b(cube\s*1|the\s+cube\s*1|fk-d-cube1)\b/i, id: 'way/358006849::FK-D-CUBE1' },
    { rx: /\b(cube\s*2|the\s+cube\s*2|fk-d-cube2)\b/i, id: 'way/358006849::FK-D-CUBE2' },
    { rx: /\b(seminar\s+room\s*l2|fk-l-2b)\b/i, id: 'way/358004268::FK-L-2B' },
    { rx: /\b(seminar\s+room\s*a2|fk-a-2b)\b/i, id: 'way/358004498::FK-A-2B' },
    { rx: /\b(auditorium|engineering\s+auditorium|fk-u-aud)\b/i, id: 'way/1007653253::FK-U-AUD' },
    { rx: /\b(circuit(?:s)?\s+(?:&\s+electronics\s+)?(?:teaching\s+)?lab|fk-y-cir)\b/i, id: 'way/358009632::FK-Y-CIR' },
    { rx: /\b(digital\s+(?:&\s+microprocessor\s+)?lab|microprocessor\s+lab|fk-y-dig)\b/i, id: 'way/358009632::FK-Y-DIG' },
    { rx: /\b(power\s+systems?\s+(?:&\s+high\s+voltage\s+)?lab|high\s+voltage\s+lab|fk-y-pwr)\b/i, id: 'way/358009632::FK-Y-PWR' },
    { rx: /\b(telecom(?:munications?)?\s+(?:&\s+rf\s+)?lab|rf\s+lab|fk-y-com)\b/i, id: 'way/358009632::FK-Y-COM' },
    { rx: /\b(cad\s+(?:computer\s+)?lab)\b/i, id: 'way/358004274' },
    { rx: /\b(the\s+cube|block\s*d|blok\s*d|fk-d)\b/i, id: 'way/358006849' },
    { rx: /\b(block\s*y|blok\s*y|fk-y|electrical\s+engineering|jabatan\s+kejuruteraan\s+elektrik)\b/i, id: 'way/358009632' },
    { rx: /\b(block\s*t|blok\s*t|fk-t)\b/i, id: 'way/358009631' },
    { rx: /\b(block\s*u|blok\s*u|fk-u)\b/i, id: 'way/1007653253' },
    { rx: /\b(block\s*b|blok\s*b|fk-b)\b/i, id: 'way/996056951' },
    { rx: /\b(block\s*l|blok\s*l|fk-l|menara\s+kejuruteraan)\b/i, id: 'way/358004268' },
    { rx: /\b(block\s*v|blok\s*v|fk-v|chemical\s+engineering)\b/i, id: 'way/358007641' },
    { rx: /\b(block\s*a|blok\s*a|fk-a|biomedical)\b/i, id: 'way/358004498' },
    { rx: /\b(student\s+workshop|block\s*k|blok\s*k)\b/i, id: 'way/1021001323' },
    { rx: /\b(kantin\s+fakulti\s+kejuruteraan|block\s*h|blok\s*h)\b/i, id: 'way/1007727375' }
  ];

  let umPlaces = CORE_FALLBACK_PLACES.slice();
  let umPlaceByKey = new Map();
  let umIndexLoaded = false;
  let activeSelectedCourseCode = '';

  const rawStoredOrigin = (() => {
    try { return localStorage.getItem(STORAGE_ORIGIN_KEY) || ''; } catch (e) { return ''; }
  })();
  const migratedInitialOrigin = normalizeAtlasKey(rawStoredOrigin) || 'gate:gate/way-992786254';
  if (rawStoredOrigin && migratedInitialOrigin !== rawStoredOrigin) {
    try { localStorage.setItem(STORAGE_ORIGIN_KEY, migratedInitialOrigin); } catch (e) {}
  }

  const userGpsState = {
    coord: null,
    nearestPlace: null,
    onCampus: false,
    status: 'idle',
    fallbackOriginKey: migratedInitialOrigin,
    updatedAt: 0
  };

  function rebuildPlaceMap() {
    umPlaceByKey.clear();
    CORE_FALLBACK_PLACES.forEach((p) => {
      umPlaceByKey.set(`${p.kind}:${p.id}`, p);
      umPlaceByKey.set(String(p.id), p);
      umPlaceByKey.set(String(p.id).toUpperCase(), p);
    });
    umPlaces.forEach((p) => {
      if (!p || !p.id || !p.kind) return;
      umPlaceByKey.set(`${p.kind}:${p.id}`, p);
      umPlaceByKey.set(String(p.id), p);
      if (!umPlaceByKey.has(String(p.id).toUpperCase())) {
        umPlaceByKey.set(String(p.id).toUpperCase(), p);
      }
    });
  }
  rebuildPlaceMap();

  try {
    const savedGps = JSON.parse(localStorage.getItem(STORAGE_LAST_GPS_KEY) || 'null');
    if (savedGps && Array.isArray(savedGps.coord) && Date.now() - (savedGps.updatedAt || 0) < 30 * 60000) {
      userGpsState.coord = savedGps.coord;
      userGpsState.updatedAt = savedGps.updatedAt;
      userGpsState.status = savedGps.onCampus ? 'live_on_campus' : 'live_off_campus';
      userGpsState.onCampus = Boolean(savedGps.onCampus);
    }
  } catch (e) {}

  function getEventDestOverrides() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_DEST_OVERRIDES_KEY) || '{}') || {};
      let changed = false;
      Object.keys(raw).forEach((k) => {
        const nextVal = normalizeAtlasKey(raw[k]);
        if (nextVal !== raw[k]) {
          raw[k] = nextVal;
          changed = true;
        }
      });
      if (changed) localStorage.setItem(STORAGE_DEST_OVERRIDES_KEY, JSON.stringify(raw));
      return raw;
    } catch (e) {
      return {};
    }
  }

  function setEventDestOverride(eventId, placeKey) {
    if (!eventId) return;
    const map = getEventDestOverrides();
    if (!placeKey) delete map[eventId];
    else map[eventId] = normalizeAtlasKey(placeKey);
    try {
      localStorage.setItem(STORAGE_DEST_OVERRIDES_KEY, JSON.stringify(map));
    } catch (e) {}
    refreshAllUmTelemetryViews();
  }

  function haversineMeters(coordA, coordB) {
    if (!Array.isArray(coordA) || !Array.isArray(coordB)) return 0;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(coordB[1] - coordA[1]);
    const dLng = toRad(coordB[0] - coordA[0]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(coordA[1])) * Math.cos(toRad(coordB[1])) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function findNearestUmPlace(coord) {
    if (!Array.isArray(coord)) return null;
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < umPlaces.length; i++) {
      const p = umPlaces[i];
      if (!p || !Array.isArray(p.center)) continue;
      const weight = p.kind === 'room' ? 1.15 : 1.0;
      const d = haversineMeters(coord, p.center) * weight;
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  function resolveActiveOriginPlace() {
    if (userGpsState.coord && userGpsState.onCampus) {
      const nearest = userGpsState.nearestPlace || findNearestUmPlace(userGpsState.coord);
      if (nearest) {
        return {
          place: nearest,
          coord: userGpsState.coord,
          key: `${nearest.kind}:${nearest.id}`,
          label: `GPS near ${nearest.title.split('(')[0].trim()}`,
          isLiveGps: true
        };
      }
    }
    const fallbackKey = normalizeAtlasKey(userGpsState.fallbackOriginKey || 'gate:gate/way-992786254');
    const fallbackPlace =
      umPlaceByKey.get(fallbackKey) ||
      umPlaceByKey.get('gate:gate/way-992786254') ||
      CORE_FALLBACK_PLACES[0];
    return {
      place: fallbackPlace,
      coord: fallbackPlace.center,
      key: `${fallbackPlace.kind}:${fallbackPlace.id}`,
      label: fallbackPlace.title.split('(')[0].trim(),
      isLiveGps: false
    };
  }

  async function loadUmSearchIndex() {
    if (umIndexLoaded) return umPlaces;
    const urls = ['./data/um_search_index.json', `${UM_ATLAS_BASE_URL}/data/um_search_index.json`];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        const items = Array.isArray(json) ? json : (json && Array.isArray(json.items) ? json.items : []);
        if (items.length > 0) {
          const extraFallbacks = CORE_FALLBACK_PLACES.filter((f) =>
            !items.some((x) => x.id === f.id && x.kind === f.kind)
          );
          umPlaces = extraFallbacks.concat(items);
          umIndexLoaded = true;
          rebuildPlaceMap();
          if (userGpsState.coord) {
            userGpsState.nearestPlace = findNearestUmPlace(userGpsState.coord);
          }
          updateUmGpsStatusButton();
          refreshAllUmTelemetryViews();
          return umPlaces;
        }
      } catch (e) {}
    }
    return umPlaces;
  }

  function sanitizeVenueNoise(text) {
    return String(text || '')
      .replace(/\((?:formerly)\s+[^)]*\)/gi, ' ')
      .replace(/\b(bilik\s+dummy|dummy\s*(?:room|venue|location)?|tba|tbd|n\/a|online|zoom|google\s*meet|ms\s*teams|lecturer\s*:?[^\n|;]*)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractDetailVenueNote(text) {
    if (!text) return '';
    // Timetable corrections formatted as "[NOT Dewan Kuliah 8 FKEJ (100)]" specify the actual room
    const notBracketMatch = String(text).match(/\[NOT\s+([^\]]+)\]/i);
    const sourceText = notBracketMatch && notBracketMatch[1] ? notBracketMatch[1] : text;

    const cleaned = sanitizeVenueNoise(sourceText)
      .replace(/\b(fkej|fkum|fac(?:ulty)?\s+of\s+engineering|fakulti\s+kejuruteraan|universiti\s+malaya)\b/gi, '')
      .replace(/[|,;/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return '';
    const roomRx = /\b(DK\s*\d+[A-Z]?|BKK?\s*\d+[A-Z]?|BP\s*\d+|MM\s*\d+|Cube\s*\d?|Block\s+[A-Z]\b|Blok\s+[A-Z]\b|Room\s+[A-Z0-9-]{2,}|Dewan\s+Kuliah\s*\d+|Bilik\s+(?:Kuliah|Seminar)[A-Za-z0-9\s-]*|Makmal\s+[A-Za-z0-9\s-]+|Auditorium(?:\s*\d+)?)\b/i;
    const m = cleaned.match(roomRx);
    if (m && m[1]) {
      const hit = m[1].trim();
      if (!/^room\s+(at|in|on|or|for|is)$/i.test(hit)) return hit;
    }
    if (cleaned.length >= 2 && cleaned.length <= 28 && !/^(http|zoom|google|meet|teams|online|or|at|in|tbd|tba|dummy)/i.test(cleaned)) {
      return cleaned;
    }
    return '';
  }

  function matchSubPlaceSnippet(snippet, facultyId) {
    const stripped = sanitizeVenueNoise(snippet);
    if (!stripped) return null;
    const norm = stripped.toLowerCase();

    if (facultyId === 'FK') {
      for (const pat of FK_SPECIFIC_ROOM_PATTERNS) {
        if (pat.rx.test(stripped)) {
          const matchedNode = umPlaceByKey.get(pat.id) || umPlaceByKey.get(`room:${pat.id}`) || umPlaceByKey.get(`building:${pat.id}`);
          if (matchedNode) return matchedNode;
        }
      }
    }

    const candidates = umPlaces.filter((p) => p.faculty_id === facultyId && p.kind !== 'faculty');
    let best = null;
    let bestScore = 0;
    for (const c of candidates) {
      const t = String(c.title || '').toLowerCase();
      const sub = String(c.subtitle || '').toLowerCase();
      let s = 0;
      if (t.length >= 5) {
        const escapedTitle = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(^|[^a-z0-9])${escapedTitle}([^a-z0-9]|$)`, 'i').test(norm)) {
          s += 60 + t.length;
        }
      }
      const codeMatch = sub.match(/•\s*([a-z0-9-]+)$/i);
      if (codeMatch && codeMatch[1] && codeMatch[1].length >= 3) {
        const escapedCode = codeMatch[1].toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(^|[^a-z0-9])${escapedCode}([^a-z0-9]|$)`, 'i').test(norm)) {
          s += 75;
        }
      }
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    return bestScore >= 40 ? best : null;
  }

  function findSpecificSubPlace(text, facultyId) {
    if (!text || !facultyId) return null;
    // Timetable room corrections like "Room: Auditorium 2 [NOT Dewan Kuliah 8 FKEJ (100)]" -> resolve [NOT ...] first
    const notBracketMatch = String(text).match(/\[NOT\s+([^\]]+)\]/i);
    if (notBracketMatch && notBracketMatch[1]) {
      const overriddenMatch = matchSubPlaceSnippet(notBracketMatch[1], facultyId);
      if (overriddenMatch) return overriddenMatch;
    }
    return matchSubPlaceSnippet(text, facultyId);
  }

  function matchUmPlaceFromEvent(ev) {
    if (!ev) return null;

    const overrides = getEventDestOverrides();
    if (ev.id && overrides[ev.id]) {
      const overridden = umPlaceByKey.get(overrides[ev.id]);
      if (overridden) return { place: overridden, matchSource: 'pinned', confidence: 100, detailVenueNote: '' };
    }

    const locRaw = String(ev.location || '').trim();
    const titleRaw = String(ev.title || '').trim();
    const descRaw = typeof stripHtmlTags === 'function'
      ? stripHtmlTags(ev.description || '').trim()
      : String(ev.description || '').replace(/<[^>]*>/g, ' ').trim();

    const combined = `${descRaw} | ${locRaw} | ${titleRaw}`.trim();
    if (!combined || combined === '|  |') return null;

    // Priority Rule for Engineering Classes (KIE1003, KIE1004, KIE1005, KIX1001) & FKEJ / FKUM / Fac of Engineering
    const isTrackedEngClass = /\b(kie\s*1003|kie\s*1004|kie\s*1005|kix\s*1001|kie\s*\d{4}|kix\s*\d{4})\b/i.test(combined);
    const hasEngAlias = /\b(fkej|fkum|fac(?:ulty)?\s+of\s+engineering|fakulti\s+kejuruteraan|\bfk\b|menara\s+kejuruteraan)\b/i.test(combined);

    if (isTrackedEngClass || hasEngAlias) {
      const fkFaculty = umPlaceByKey.get('faculty:FK') || umPlaceByKey.get('FK') || CORE_FALLBACK_PLACES.find((p) => p.id === 'FK');
      const detailTexts = [
        { text: descRaw, source: 'details' },
        { text: locRaw, source: 'location' },
        { text: titleRaw, source: 'title' }
      ];

      for (const dt of detailTexts) {
        if (!dt.text) continue;
        const specificFkNode = findSpecificSubPlace(dt.text, 'FK');
        if (specificFkNode) {
          const note = extractDetailVenueNote(descRaw || locRaw);
          return {
            place: specificFkNode,
            matchSource: dt.source,
            confidence: 98,
            detailVenueNote: note,
            isEngineeringFallback: false
          };
        }
      }

      if (fkFaculty) {
        return {
          place: fkFaculty,
          matchSource: descRaw ? 'details (Fac of Engineering)' : 'course (Fac of Engineering)',
          confidence: 95,
          detailVenueNote: '',
          isEngineeringFallback: true
        };
      }
    }

    const fields = [
      { text: descRaw, source: 'details', boost: 25 },
      { text: locRaw, source: 'location', boost: 30 },
      { text: titleRaw, source: 'title', boost: 20 }
    ];

    for (const f of fields) {
      if (!f.text) continue;
      for (const alias of SHORTHAND_ALIAS_MAP) {
        if (alias.rx.test(f.text)) {
          const found =
            umPlaceByKey.get(`faculty:${alias.targetId}`) ||
            umPlaceByKey.get(`rail_station:${alias.targetId}`) ||
            umPlaceByKey.get(`gate:${alias.targetId}`) ||
            umPlaceByKey.get(alias.targetId) ||
            umPlaceByKey.get(alias.targetId.toUpperCase());
          if (found) {
            const specific =
              findSpecificSubPlace(descRaw, found.faculty_id || found.id) ||
              findSpecificSubPlace(locRaw, found.faculty_id || found.id) ||
              findSpecificSubPlace(f.text, found.faculty_id || found.id);
            return {
              place: specific || found,
              matchSource: f.source,
              confidence: 92,
              detailVenueNote: extractDetailVenueNote(descRaw || locRaw)
            };
          }
        }
      }
    }

    const queryCandidates = [];
    if (locRaw.length >= 2) queryCandidates.push({ q: locRaw, source: 'location', weight: 1.35 });
    if (descRaw.length >= 2) queryCandidates.push({ q: descRaw.slice(0, 220), source: 'details', weight: 1.25 });
    const titleLocMatch = titleRaw.match(/(?:@|\bat\b|\bin\b|—|-|\||\[|\()\s*([A-Za-z0-9\s,&.'/-]{2,40})/i);
    if (titleLocMatch && titleLocMatch[1]) {
      queryCandidates.push({ q: titleLocMatch[1].trim(), source: 'title', weight: 1.2 });
    }
    if (titleRaw.length >= 3) queryCandidates.push({ q: titleRaw, source: 'title', weight: 1.0 });

    const STOPWORDS = new Set([
      'study', 'session', 'lecture', 'tutorial', 'class', 'meeting', 'exam', 'test', 'quiz',
      'online', 'zoom', 'google', 'meet', 'teams', 'submission', 'deadline', 'assignment',
      'project', 'review', 'general', 'daily', 'weekly', 'morning', 'evening', 'night',
      'block', 'room', 'level', 'floor', 'hall', 'lab', 'the', 'and', 'for', 'with', 'from'
    ]);

    let bestMatch = null;
    let bestScore = 0;

    for (const cand of queryCandidates) {
      const normQ = cand.q.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!normQ || normQ.length < 2) continue;
      const tokens = normQ.split(' ').filter((t) => t.length >= 2 && !STOPWORDS.has(t));
      if (tokens.length === 0 && cand.source !== 'location') continue;

      for (let i = 0; i < umPlaces.length; i++) {
        const p = umPlaces[i];
        const titleLower = String(p.title || '').toLowerCase();
        const idLower = String(p.id || '').toLowerCase();
        const facLower = String(p.faculty_id || '').toLowerCase();
        const kwStr = Array.isArray(p.keywords) ? p.keywords.join(' ').toLowerCase() : String(p.keywords || '').toLowerCase();

        let score = 0;
        if (facLower && tokens.includes(facLower)) score += 55;
        if (idLower.length >= 3 && tokens.includes(idLower)) score += 60;

        if (titleLower.length >= 5 && normQ.includes(titleLower)) {
          score += 80;
        } else if ((cand.source === 'location' || cand.source === 'details') && normQ.length >= 4 && titleLower.includes(normQ)) {
          score += 70;
        }

        let matchedTokens = 0;
        for (let t = 0; t < tokens.length; t++) {
          const tok = tokens[t];
          if (tok.length < 3) continue;
          if (titleLower.includes(tok)) {
            matchedTokens++;
            score += tok.length >= 5 ? 22 : 12;
          } else if (kwStr && kwStr.split(/\s+/).includes(tok)) {
            matchedTokens++;
            score += 18;
          }
        }

        if (matchedTokens >= 2) score += 20;
        if (p.kind === 'faculty' || p.kind === 'building') score += 4;
        score *= cand.weight;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            place: p,
            matchSource: cand.source,
            confidence: Math.min(99, Math.round(score)),
            detailVenueNote: extractDetailVenueNote(descRaw || locRaw)
          };
        }
      }
    }

    const minThreshold = (locRaw.length >= 3 || descRaw.length >= 3) ? 34 : 48;
    return bestScore >= minThreshold ? bestMatch : null;
  }

  function buildUmAtlasDeepLink(fromKey, toKey) {
    const cleanTo = normalizeAtlasKey(toKey);
    const cleanFrom = normalizeAtlasKey(fromKey);
    if (!cleanTo) return UM_ATLAS_BASE_URL;
    const toExists = umPlaceByKey.has(cleanTo);
    const fromExists = cleanFrom && umPlaceByKey.has(cleanFrom);
    if (toExists && fromExists && cleanFrom !== cleanTo) {
      return `${UM_ATLAS_BASE_URL}/?from=${encodeURIComponent(cleanFrom)}&to=${encodeURIComponent(cleanTo)}&mode=walk`;
    }
    return `${UM_ATLAS_BASE_URL}/?place=${encodeURIComponent(cleanTo)}&mode=walk`;
  }

  function resolveEventUmTelemetry(ev, nowDate) {
    const matched = matchUmPlaceFromEvent(ev);
    if (!matched || !matched.place) return null;

    const now = nowDate instanceof Date ? nowDate : new Date();
    const dest = matched.place;
    const originInfo = resolveActiveOriginPlace();
    const toKey = `${dest.kind}:${dest.id}`;
    const fromKey = originInfo.key;

    const straightDistM = haversineMeters(originInfo.coord, dest.center);
    const floorExtraM = dest.kind === 'room' && Number(dest.floor) > 0 ? Number(dest.floor) * 14 : 0;
    const walkDistanceM = Math.max(25, Math.round(straightDistM * WALK_PATH_DETOUR_FACTOR + floorExtraM));
    const floorBufferMin = dest.kind === 'room' && Number(dest.floor) > 0 ? 1 : 0;
    const walkMins = Math.max(1, Math.round(walkDistanceM / WALK_SPEED_M_PER_MIN) + floorBufferMin);
    const estSteps = Math.round(walkDistanceM * 1.31);
    const estKcal = Math.max(1, Math.round(walkDistanceM * 0.048));

    const totalLeadMins = walkMins + DEFAULT_ARRIVAL_BUFFER_MINS;
    const leaveByDate = ev.start instanceof Date
      ? new Date(ev.start.getTime() - totalLeadMins * 60000)
      : null;

    const minsUntilLeave = leaveByDate ? Math.round((leaveByDate.getTime() - now.getTime()) / 60000) : null;
    const minsUntilStart = ev.start instanceof Date ? Math.round((ev.start.getTime() - now.getTime()) / 60000) : null;

    const leaveByTimeStr = leaveByDate
      ? leaveByDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '--:--';

    let urgency = 'normal';
    let leaveStatusLabel = `LEAVE BY ${leaveByTimeStr}`;
    if (ev.end instanceof Date && now >= ev.end) {
      urgency = 'past';
      leaveStatusLabel = `WALK ${walkMins}M`;
    } else if (ev.start instanceof Date && now >= ev.start) {
      urgency = 'ongoing';
      leaveStatusLabel = `ONGOING · ${walkMins}M WALK`;
    } else if (minsUntilLeave !== null) {
      if (minsUntilLeave <= 0 && minsUntilStart > 0) {
        urgency = 'urgent';
        leaveStatusLabel = `LEAVE NOW (${walkMins}m walk)`;
      } else if (minsUntilLeave <= 15) {
        urgency = 'urgent';
        leaveStatusLabel = `LEAVE IN ${minsUntilLeave}m (${leaveByTimeStr})`;
      } else if (minsUntilLeave <= 45) {
        urgency = 'soon';
        leaveStatusLabel = `LEAVE IN ${minsUntilLeave}m (${leaveByTimeStr})`;
      } else {
        leaveStatusLabel = `LEAVE BY ${leaveByTimeStr} (${walkMins}m walk)`;
      }
    }

    const distanceFormatted = walkDistanceM >= 1000
      ? `${(walkDistanceM / 1000).toFixed(2)} km`
      : `${walkDistanceM} m`;

    const deepLinkUrl = buildUmAtlasDeepLink(fromKey, toKey);

    let displayDestLabel = dest.title.split('(')[0].trim();
    const shortParen = (dest.title.match(/\(([^)]+)\)/) || [])[1];
    if (matched.detailVenueNote) {
      const noteLower = matched.detailVenueNote.toLowerCase();
      const alreadyInTitle = dest.title.toLowerCase().includes(noteLower) ||
        (shortParen && shortParen.toLowerCase() === noteLower);
      if (!alreadyInTitle) {
        displayDestLabel = `${matched.detailVenueNote} · ${displayDestLabel}`;
      }
    }

    return {
      dest,
      displayDestLabel,
      detailVenueNote: matched.detailVenueNote || '',
      originInfo,
      fromKey,
      toKey,
      walkDistanceM,
      distanceFormatted,
      walkMins,
      estSteps,
      estKcal,
      leaveByDate,
      leaveByTimeStr,
      minsUntilLeave,
      urgency,
      leaveStatusLabel,
      deepLinkUrl,
      matchSource: matched.matchSource,
      confidence: matched.confidence
    };
  }

  function requestUserCampusGps(showFeedback) {
    if (!navigator.geolocation) {
      userGpsState.status = 'denied';
      updateUmGpsStatusButton();
      if (showFeedback && typeof showToast === 'function') {
        showToast('GPS UNAVAILABLE', 'Browser geolocation is not supported. Using selected UM campus origin.', true);
      }
      return;
    }

    userGpsState.status = 'locating';
    updateUmGpsStatusButton();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        const coord = [lng, lat];
        const distFromCampus = haversineMeters(coord, UM_CAMPUS_CENTER);
        const onCampus = distFromCampus <= UM_CAMPUS_MAX_RADIUS_M;
        const nearest = findNearestUmPlace(coord);

        userGpsState.coord = coord;
        userGpsState.onCampus = onCampus;
        userGpsState.nearestPlace = nearest;
        userGpsState.status = onCampus ? 'live_on_campus' : 'live_off_campus';
        userGpsState.updatedAt = Date.now();

        try {
          localStorage.setItem(STORAGE_LAST_GPS_KEY, JSON.stringify({
            coord,
            onCampus,
            updatedAt: userGpsState.updatedAt
          }));
        } catch (e) {}

        updateUmGpsStatusButton();
        refreshAllUmTelemetryViews();

        if (showFeedback && typeof showToast === 'function') {
          if (onCampus && nearest) {
            showToast('UM 3D ATLAS // GPS LOCKED', `Live location locked near ${nearest.title}. Walking departure times updated.`);
          } else {
            const origin = resolveActiveOriginPlace();
            showToast('GPS ACQUIRED (OFF-CAMPUS)', `You are ${(distFromCampus / 1000).toFixed(1)}km from UM. Calculating campus walks from ${origin.label}.`);
          }
        }
      },
      (err) => {
        userGpsState.status = 'denied';
        updateUmGpsStatusButton();
        refreshAllUmTelemetryViews();
        if (showFeedback && typeof showToast === 'function') {
          const origin = resolveActiveOriginPlace();
          showToast('USING CAMPUS ORIGIN', `GPS permission declined (${err.message}). Calculating walks from ${origin.label}.`);
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }

  function setDefaultCampusOrigin(originKey) {
    if (!originKey) return;
    const cleanKey = normalizeAtlasKey(originKey);
    userGpsState.fallbackOriginKey = cleanKey;
    try {
      localStorage.setItem(STORAGE_ORIGIN_KEY, cleanKey);
    } catch (e) {}
    updateUmGpsStatusButton();
    refreshAllUmTelemetryViews();
    const origin = resolveActiveOriginPlace();
    if (typeof showToast === 'function') {
      showToast('UM ORIGIN UPDATED', `Walking routes now calculated from ${origin.label}.`);
    }
  }

  function updateUmGpsStatusButton() {
    const btn = document.getElementById('um-gps-status-btn');
    const lbl = document.getElementById('um-gps-status-label');
    const dot = document.getElementById('um-gps-status-dot');
    if (!btn || !lbl) return;

    const origin = resolveActiveOriginPlace();
    const shortOrigin = origin.label.length > 18 ? origin.label.slice(0, 18) + '…' : origin.label;

    if (userGpsState.status === 'locating') {
      lbl.textContent = 'UM GPS: LOCATING…';
      if (dot) dot.className = 'w-1.5 h-1.5 bg-[#f59e0b] inline-block pulse-live';
    } else if (userGpsState.status === 'live_on_campus') {
      lbl.textContent = `UM GPS: ${shortOrigin}`;
      if (dot) dot.className = 'w-1.5 h-1.5 bg-[#10b981] inline-block pulse-live';
    } else {
      lbl.textContent = `UM ORIGIN: ${shortOrigin}`;
      if (dot) dot.className = 'w-1.5 h-1.5 bg-[#0284c7] inline-block';
    }
  }

  function buildEventUmWalkInlineHtml(ev, compact) {
    const info = resolveEventUmTelemetry(ev, new Date());
    if (!info) return '';

    const urgencyClass =
      info.urgency === 'urgent' ? 'leave-urgent' :
      info.urgency === 'soon' ? 'leave-soon' : '';

    const safeUrl = typeof escapeHtml === 'function' ? escapeHtml(info.deepLinkUrl) : info.deepLinkUrl;
    const safeDest = typeof escapeHtml === 'function' ? escapeHtml(info.displayDestLabel) : info.displayDestLabel;

    if (compact) {
      return `
        <div class="flex flex-wrap items-center gap-1 mt-1" onclick="event.stopPropagation();">
          <span class="um-atlas-chip ${urgencyClass}" title="Destination: ${safeDest} (from ${escapeHtml(info.originInfo.label)})">
            ${ICONS.walk}
            <span>${safeDest} · ${info.walkMins}m (${info.distanceFormatted})</span>
            <span>·</span>
            <span>${escapeHtml(info.leaveStatusLabel)}</span>
          </span>
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="um-atlas-route-btn" title="Open exact walking route in UM 3D Atlas">
            ${ICONS.route}
            <span>3D ROUTE</span>
          </a>
        </div>
      `;
    }

    return `
      <div class="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1.5 border-t border-[#e2efe8]" onclick="event.stopPropagation();">
        <span class="um-atlas-chip ${urgencyClass}" title="From ${escapeHtml(info.originInfo.label)} to ${safeDest}">
          ${ICONS.pin}
          <span>${safeDest}</span>
          <span>·</span>
          ${ICONS.walk}
          <span>${info.walkMins}m walk (${info.distanceFormatted} · +${info.estSteps} steps)</span>
          <span>·</span>
          <span>${escapeHtml(info.leaveStatusLabel)}</span>
        </span>
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="um-atlas-route-btn" title="Redirect to UM 3D Atlas with exact walking route pre-loaded">
          ${ICONS.route}
          <span>Open Route in UM 3D Atlas</span>
        </a>
      </div>
    `;
  }

  // ── 3. Compact 4th-Navbar-Style Next-Class Commute Strip (03 // calendar) ──
  function renderCalendarCommuteStrip() {
    const host = document.getElementById('calendar-commute-strip');
    if (!host) return;

    const now = new Date();
    const events = getCalEvents();
    const origin = resolveActiveOriginPlace();

    const upcomingWithWalk = events
      .filter((ev) => ev && ev.end instanceof Date && ev.end > now)
      .sort((a, b) => a.start - b.start)
      .map((ev) => ({ ev, info: resolveEventUmTelemetry(ev, now) }))
      .filter((x) => Boolean(x.info));

    if (upcomingWithWalk.length === 0) {
      host.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 w-full text-xs">
          <div class="flex items-center gap-2 min-w-0">
            <span class="tech-badge badge-neutral">${ICONS.walk}<span>NEXT CAMPUS COMMUTE</span></span>
            <span class="text-[#436152]">No upcoming class with a UM location in the current window. Classes KIE1003, KIE1004, KIE1005 &amp; KIX1001 auto-parse rooms from event details or default to Faculty of Engineering.</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="window.umAtlas.requestUserCampusGps(true)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]">
              ${ICONS.gps}<span>${origin.isLiveGps ? 'GPS Locked' : 'Origin: ' + escapeHtml(origin.label)}</span>
            </button>
            <a href="${UM_ATLAS_BASE_URL}" target="_blank" rel="noopener noreferrer" class="um-atlas-route-btn">
              ${ICONS.ext}<span>UM 3D ATLAS</span>
            </a>
          </div>
        </div>
      `;
      return;
    }

    const { ev, info } = upcomingWithWalk[0];
    const startTimeStr = ev.start instanceof Date
      ? ev.start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '--:--';
    const isToday = ev.start instanceof Date && ev.start.toDateString() === now.toDateString();
    const dayPrefix = isToday ? 'TODAY' : ev.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
    const urgencyClass =
      info.urgency === 'urgent' ? 'leave-urgent' :
      info.urgency === 'soon' ? 'leave-soon' : '';

    host.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 w-full">
        <div class="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          <span class="tech-badge badge-green shrink-0">${ICONS.walk}<span>NEXT COMMUTE</span></span>
          <button type="button" onclick="openEventDetails('${jsAttrQuote(ev.id)}')" class="text-xs text-[#0c1f17] hover:text-[#047857] truncate max-w-full sm:max-w-[320px] text-left" title="Click to inspect event details &amp; route">
            <span>${escapeHtml(ev.title)}</span>
            <span class="text-[#56735f] ml-1 tnum">(${dayPrefix} ${startTimeStr})</span>
          </button>
          <span class="text-[#9fc2af] hidden sm:inline">|</span>
          <span class="um-atlas-chip ${urgencyClass} max-w-full" title="Parsed from ${escapeHtml(info.matchSource)} · From ${escapeHtml(info.originInfo.label)}">
            ${ICONS.pin}<span>${escapeHtml(info.displayDestLabel)}</span>
            <span>·</span>
            ${ICONS.walk}<span class="tnum">${info.walkMins}m (${info.distanceFormatted} · +${info.estSteps} steps)</span>
            <span>·</span>
            <span class="tnum">${escapeHtml(info.leaveStatusLabel)}</span>
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 shrink-0">
          <button type="button" onclick="window.umAtlas.requestUserCampusGps(true)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]" title="Refresh live GPS origin">
            ${ICONS.gps}<span>From: ${escapeHtml(info.originInfo.label)}</span>
          </button>
          <a href="${escapeHtml(info.deepLinkUrl)}" target="_blank" rel="noopener noreferrer" class="um-atlas-route-btn" title="Open exact 3D walking route in UM 3D Atlas">
            ${ICONS.route}<span>3D ROUTE</span>
          </a>
        </div>
      </div>
    `;
  }

  // ── 4. Compact 4th-Navbar-Style Combined ENG Course Hub Strip (01 // study)
  function getCourseHoursMap() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_COURSE_HOURS_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function recordCourseStudyHours(courseCode, dateStr, hoursVal) {
    if (!courseCode || !dateStr) return;
    const map = getCourseHoursMap();
    if (!map[courseCode]) map[courseCode] = {};
    map[courseCode][dateStr] = Math.max(0, Number(hoursVal) || 0);
    try {
      localStorage.setItem(STORAGE_COURSE_HOURS_KEY, JSON.stringify(map));
    } catch (e) {}
    renderStudyCourseHubStrip();
  }

  function selectCourseForStudyLog(courseCode) {
    const normalized = courseCode || 'ENG';
    activeSelectedCourseCode = activeSelectedCourseCode === normalized ? '' : normalized;
    const badgeEl = document.getElementById('study-active-course-tag');
    if (badgeEl) {
      badgeEl.textContent = activeSelectedCourseCode ? `TAGGED: ${activeSelectedCourseCode}` : 'CLICK TO TAG: ENG';
      badgeEl.className = activeSelectedCourseCode ? 'tech-badge badge-green cursor-pointer' : 'tech-badge badge-neutral cursor-pointer';
    }
    const hoursIn = document.getElementById('hours-input');
    if (hoursIn && activeSelectedCourseCode) hoursIn.focus();
    renderStudyCourseHubStrip();
    if (activeSelectedCourseCode && typeof showToast === 'function') {
      showToast('ENG COURSE TAG ARMED', `Next study log entry will also be recorded under ${activeSelectedCourseCode}.`);
    }
  }

  function renderStudyCourseHubStrip() {
    const host = document.getElementById('study-course-hub-strip');
    if (!host) return;

    const now = new Date();
    const events = getCalEvents();
    const tasks = getTaskList();
    const courseMap = getCourseHoursMap();

    const cutoff7d = new Date(now);
    cutoff7d.setDate(now.getDate() - 7);
    const cutoff7dStr = typeof getLocalDateString === 'function' ? getLocalDateString(cutoff7d) : '';

    // Aggregate total & 7-day study hours across ENG + any legacy KIE1003-KIX1001 buckets
    const allEngKeys = ['ENG'].concat(TRACKED_ENG_COURSES.map((c) => c.code));
    let totalHours = 0;
    let hours7d = 0;
    allEngKeys.forEach((key) => {
      const byDate = courseMap[key] || {};
      Object.keys(byDate).forEach((d) => {
        const h = Number(byDate[d]) || 0;
        totalHours += h;
        if (!cutoff7dStr || d >= cutoff7dStr) hours7d += h;
      });
    });

    const engRx = /\b(kie\s*100[345]|kix\s*1001|kie\s*\d{4}|kix\s*\d{4}|fkej|fkum|fac(?:ulty)?\s+of\s+engineering)\b/i;
    const taskCols = typeof globalTaskColumns !== 'undefined' && Array.isArray(globalTaskColumns) ? globalTaskColumns : [];
    const engColIds = new Set(taskCols.filter((col) => engRx.test(col.title || '')).map((col) => col.id));
    const openTasksCount = tasks.filter((t) => !t.is_done && (engRx.test(t.title || '') || engColIds.has(t.column_id))).length;

    const nextEngEv = events
      .filter((ev) => ev && ev.end instanceof Date && ev.end > now &&
        (engRx.test(ev.title || '') || engRx.test(ev.description || '') || engRx.test(ev.location || '')))
      .sort((a, b) => a.start - b.start)[0] || null;

    const origin = resolveActiveOriginPlace();
    let routeUrl = buildUmAtlasDeepLink(origin.key, 'faculty:FK');
    let routeText = 'Fac of Eng';
    let fullRouteTitle = 'Faculty of Engineering (FK)';

    if (nextEngEv) {
      const umInfo = resolveEventUmTelemetry(nextEngEv, now);
      if (umInfo) {
        routeUrl = umInfo.deepLinkUrl;
        routeText = `${umInfo.displayDestLabel} (${umInfo.walkMins}m)`;
        fullRouteTitle = `${nextEngEv.title} — ${umInfo.displayDestLabel} (${umInfo.walkMins}m walk from ${origin.label})`;
      }
    } else {
      const fkPlace = umPlaceByKey.get('faculty:FK') || CORE_FALLBACK_PLACES.find((p) => p.id === 'FK');
      if (fkPlace) {
        const distM = Math.max(25, Math.round(haversineMeters(origin.coord, fkPlace.center) * WALK_PATH_DETOUR_FACTOR));
        const walkMins = Math.max(1, Math.round(distM / WALK_SPEED_M_PER_MIN));
        routeText = `Fac of Eng (${walkMins}m)`;
      }
    }

    const isSelected = activeSelectedCourseCode === 'ENG';

    host.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 w-full">
        <div class="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onclick="window.umAtlas.selectCourseForStudyLog('ENG')"
            class="m3-course-pill cursor-pointer ${isSelected ? 'active-course' : ''}"
            title="Click to tag your next study log under ENG (Engineering courses)"
          >
            ${ICONS.course}
            <span class="m3-course-code">ENG</span>
            <span class="text-[#9fc2af]">|</span>
            <span class="text-[#436152] tnum">TOTAL ${totalHours.toFixed(1)}h</span>
            <span class="text-[#9fc2af]">·</span>
            <span class="text-[#047857] tnum">7D ${hours7d.toFixed(1)}h</span>
            <span class="text-[#9fc2af]">·</span>
            <span class="${openTasksCount > 0 ? 'text-[#b45309]' : 'text-[#56735f]'} tnum">${openTasksCount} OPEN TASKS</span>
          </button>
          <a
            href="${escapeHtml(routeUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            class="um-atlas-route-btn max-w-full"
            title="${escapeHtml(fullRouteTitle)}"
          >
            ${ICONS.route}
            <span class="truncate max-w-[180px] sm:max-w-[260px]">${escapeHtml(routeText)}</span>
          </a>
        </div>
        <button
          type="button"
          id="study-active-course-tag"
          onclick="window.umAtlas.selectCourseForStudyLog('ENG')"
          class="${isSelected ? 'tech-badge badge-green' : 'tech-badge badge-neutral'} cursor-pointer shrink-0"
          title="Click to toggle ENG study log tagging"
        >
          ${isSelected ? 'TAGGED: ENG' : 'CLICK TO TAG: ENG'}
        </button>
      </div>
    `;
  }

  // ── 5. Event Modal UM 3D Atlas Panel (Zero Emojis, 1px SVGs) ───────────────
  function renderEventModalUmPanel(ev) {
    const host = document.getElementById('event-modal-um-atlas-box');
    if (!host || !ev) return;

    const info = resolveEventUmTelemetry(ev, new Date());
    const origin = resolveActiveOriginPlace();

    const originOptions = [
      { key: 'gate:gate/way-992786254', label: 'UM KL Gate (Federal Hwy / Near FK)' },
      { key: 'gate:gate/9509924125', label: 'UM Main Entrance' },
      { key: 'gate:gate/way-992786252', label: 'UM PJ Gate' },
      { key: 'gate:gate/9116471603', label: 'Pintu Pagar Utama (Jalan Universiti)' },
      { key: 'rail_station:rail/KJ19', label: 'LRT Universiti (KL Gateway) (KJ19)' },
      { key: 'rail_station:rail/KJ18', label: 'LRT Kerinchi (KJ18)' },
      { key: 'rail_station:rail/KG12', label: 'MRT Phileo Damansara (KG12)' },
      { key: 'faculty:CORE', label: 'Chancellery, Main Library & DTC Core' },
      { key: 'faculty:FK', label: 'FK (Faculty of Engineering / FKEJ / FKUM)' },
      { key: 'building:way/358009632', label: 'FK Block Y (Electrical Engineering)' },
      { key: 'room:way/358009632::FK-Y-DK8', label: 'FK Block Y — Dewan Kuliah 8 (DK8)' },
      { key: 'room:way/358009632::FK-Y-DK9', label: 'FK Block Y — Dewan Kuliah 9 (DK9)' },
      { key: 'building:way/358009631', label: 'FK Block T (DK2, DK3 & Complex)' },
      { key: 'building:way/1007653253', label: 'FK Block U (Lecture Halls & Auditorium)' },
      { key: 'room:way/1007653253::FK-U-AUD', label: 'FK Block U — Engineering Auditorium' },
      { key: 'building:way/996056951', label: 'FK Block B (Dewan Kuliah 1)' },
      { key: 'building:way/358004268', label: 'Menara Kejuruteraan (Block L)' },
      { key: 'faculty:FSKTM', label: 'FSKTM (Computer Science & IT)' },
      { key: 'faculty:FS', label: 'FS (Faculty of Science)' },
      { key: 'faculty:FASS', label: 'FASS (Arts & Social Sciences)' },
      { key: 'faculty:FPE', label: 'FPE (Business & Economics)' },
      { key: 'faculty:PASUM', label: 'PASUM (Foundation Science)' },
      { key: 'faculty:KK1', label: 'KK1 (1st Residential College)' },
      { key: 'faculty:KK2', label: 'KK2 (2nd Residential College)' },
      { key: 'faculty:KK3', label: 'KK3 (3rd Residential College)' },
      { key: 'faculty:KK4', label: 'KK4 (4th Residential College)' },
      { key: 'faculty:KK5', label: 'KK5 (5th Residential College)' },
      { key: 'faculty:KK7', label: 'KK7 (7th Residential College)' },
      { key: 'faculty:KK8', label: 'KK8 (8th Residential College)' },
      { key: 'faculty:KK9', label: 'KK9 (9th Residential College)' },
      { key: 'faculty:KK10', label: 'KK10 (10th Residential College)' },
      { key: 'faculty:KK11', label: 'KK11 (11th Residential College)' },
      { key: 'faculty:KK12', label: 'KK12 (12th Residential College)' }
    ];

    const destOptionsHtml = originOptions.map((o) => {
      const selected = info && info.toKey === o.key ? 'selected' : '';
      return `<option value="${escapeHtml(o.key)}" ${selected}>${escapeHtml(o.label)}</option>`;
    }).join('');

    const originSelectHtml = originOptions.map((o) => {
      const selected = userGpsState.fallbackOriginKey === o.key ? 'selected' : '';
      return `<option value="${escapeHtml(o.key)}" ${selected}>${escapeHtml(o.label)}</option>`;
    }).join('');

    if (!info) {
      host.innerHTML = `
        <div class="p-3 bg-[#eff8f2] border border-[#c5ded0] flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="section-tag"><span class="diamond">◆</span> UM 3D ATLAS // WALKING &amp; DEPARTURE ROUTE</div>
            <button type="button" onclick="window.umAtlas.requestUserCampusGps(true)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]">
              ${ICONS.gps}<span>Refresh GPS</span>
            </button>
          </div>
          <div class="text-[11px] text-[#436152]">
            No UM campus location was detected in this event's details, location, or title. Select a destination below to compute walking time &amp; Leave-By telemetry:
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label class="block text-[9px] uppercase text-[#436152] mb-0.5">Pin UM Destination for Event</label>
              <select onchange="window.umAtlas.setEventDestOverride('${jsAttrQuote(ev.id)}', this.value)" class="tech-input !py-1 !px-2 !text-[11px] !bg-white">
                <option value="">— Select UM Building / Faculty / College —</option>
                ${destOptionsHtml}
              </select>
            </div>
            <div>
              <label class="block text-[9px] uppercase text-[#436152] mb-0.5">Starting Origin (${origin.isLiveGps ? 'Live GPS Active' : 'Campus Pin'})</label>
              <select onchange="window.umAtlas.setDefaultCampusOrigin(this.value)" class="tech-input !py-1 !px-2 !text-[11px] !bg-white">
                ${originSelectHtml}
              </select>
            </div>
          </div>
        </div>
      `;
      host.classList.remove('hidden');
      return;
    }

    const urgencyBannerClass =
      info.urgency === 'urgent' ? 'bg-[#fee2e2] border-[#fca5a5] text-[#991b1b]' :
      info.urgency === 'soon' ? 'bg-[#fef3c7] border-[#fcd34d] text-[#92400e]' :
      'bg-[#dcfce7] border-[#86efac] text-[#065f46]';

    host.innerHTML = `
      <div class="p-3 bg-[#eff8f2] border border-[#059669] flex flex-col gap-2.5">
        <div class="flex items-center justify-between gap-2 flex-wrap border-b border-[#c5ded0] pb-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="tech-badge badge-green">${ICONS.route}<span>UM 3D ATLAS // ROUTE TELEMETRY</span></span>
            <span class="text-[10px] text-[#436152]">Matched via ${escapeHtml(info.matchSource.toUpperCase())}</span>
          </div>
          <button type="button" onclick="window.umAtlas.requestUserCampusGps(true)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white">
            ${ICONS.gps}<span>${origin.isLiveGps ? 'Live GPS Active' : 'Get GPS Location'}</span>
          </button>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div class="p-2 border ${urgencyBannerClass}">
            <div class="text-[9px] uppercase opacity-80">LEAVE BY (${DEFAULT_ARRIVAL_BUFFER_MINS}M BUF)</div>
            <div class="text-sm mt-0.5 tnum">${escapeHtml(info.leaveByTimeStr)}</div>
            <div class="text-[9px] mt-0.5">${info.minsUntilLeave !== null && info.minsUntilLeave > 0 ? `in ${info.minsUntilLeave} min` : info.urgency === 'urgent' ? 'LEAVE NOW' : 'Scheduled'}</div>
          </div>
          <div class="p-2 bg-white border border-[#c5ded0]">
            <div class="text-[9px] uppercase text-[#436152]">WALK DURATION</div>
            <div class="text-sm text-[#0c1f17] mt-0.5 tnum">${info.walkMins} min</div>
            <div class="text-[9px] text-[#56735f] mt-0.5">80 m/min pace</div>
          </div>
          <div class="p-2 bg-white border border-[#c5ded0]">
            <div class="text-[9px] uppercase text-[#436152]">WALK DISTANCE</div>
            <div class="text-sm text-[#0369a1] mt-0.5 tnum">${escapeHtml(info.distanceFormatted)}</div>
            <div class="text-[9px] text-[#56735f] mt-0.5">campus path</div>
          </div>
          <div class="p-2 bg-white border border-[#c5ded0]">
            <div class="text-[9px] uppercase text-[#436152]">STEP QUOTA YIELD</div>
            <div class="text-sm text-[#047857] mt-0.5 tnum">+${info.estSteps.toLocaleString()}</div>
            <div class="text-[9px] text-[#56735f] mt-0.5">~${info.estKcal} kcal</div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2 border border-[#c5ded0] text-[11px]">
          <div>
            <label class="block text-[9px] uppercase text-[#436152] mb-0.5">FROM ORIGIN (${origin.isLiveGps ? 'Nearest to GPS' : 'Default Campus Pin'})</label>
            <select onchange="window.umAtlas.setDefaultCampusOrigin(this.value);" class="tech-input !py-1 !px-2 !text-[11px]">
              ${originSelectHtml}
            </select>
          </div>
          <div>
            <label class="block text-[9px] uppercase text-[#436152] mb-0.5">TO UM DESTINATION (${escapeHtml(info.displayDestLabel.slice(0, 32))})</label>
            <select onchange="window.umAtlas.setEventDestOverride('${jsAttrQuote(ev.id)}', this.value);" class="tech-input !py-1 !px-2 !text-[11px]">
              <option value="${escapeHtml(info.toKey)}">${escapeHtml(info.displayDestLabel)}</option>
              ${destOptionsHtml}
            </select>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span class="text-[10px] text-[#436152]">Opens exact 3D walking route &amp; building cutaway in UM 3D Atlas</span>
          <a href="${escapeHtml(info.deepLinkUrl)}" target="_blank" rel="noopener noreferrer" class="btn-chamfer !py-1.5 !px-3.5 !text-xs shrink-0 inline-flex items-center gap-1.5 max-w-full">
            ${ICONS.route}<span class="truncate">Open Walk Route in UM 3D Atlas</span>
          </a>
        </div>
      </div>
    `;
    host.classList.remove('hidden');
  }

  function refreshAllUmTelemetryViews() {
    if (typeof updateNavbarAndRadarTelemetry === 'function') updateNavbarAndRadarTelemetry();
    renderCalendarCommuteStrip();
    renderStudyCourseHubStrip();
    if (typeof renderCalendarViewport === 'function' && typeof activeTabName !== 'undefined' && activeTabName === 'calendar') {
      renderCalendarViewport();
    }
    if (typeof renderFocusMode === 'function' && typeof activeTabName !== 'undefined' && activeTabName === 'focus') {
      renderFocusMode();
    }
    const calList = getCalEvents();
    if (typeof activeModalEventId !== 'undefined' && activeModalEventId && calList.length > 0) {
      const ev = calList.find((e) => e.id === activeModalEventId);
      if (ev) renderEventModalUmPanel(ev);
    }
  }

  // ── 6. Inline Table Cell Editing & Keyboard Navigation Across Ledgers ──────
  function attachLedgerInlineEditing() {
    const studyTbody = document.querySelector('#ledger-table tbody');
    const stepsTbody = document.querySelector('#steps-ledger-table tbody');

    function enhanceTableRows(tbody, type) {
      if (!tbody) return;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.forEach((tr, idx) => {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 4) return;
        const dateStr = (cells[0].textContent || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

        tr.tabIndex = 0;
        tr.dataset.ledgerDate = dateStr;
        tr.dataset.ledgerType = type;
        tr.dataset.rowIndex = String(idx);
        tr.title = 'Double-click or press Enter to edit this day inline · ArrowUp/ArrowDown to navigate rows';

        const statusCell = cells[3];
        if (statusCell && !statusCell.querySelector('.inline-row-edit-btn')) {
          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'inline-row-edit-btn btn-tech-outline !py-0 !px-1 !text-[9px] ml-auto opacity-70 hover:opacity-100';
          editBtn.title = `Inline edit ${dateStr}`;
          editBtn.innerHTML = ICONS.edit;
          editBtn.onclick = (e) => {
            e.stopPropagation();
            startInlineRowEdit(tr, type, dateStr);
          };
          statusCell.appendChild(editBtn);
        }

        tr.ondblclick = () => startInlineRowEdit(tr, type, dateStr);
        tr.onkeydown = (e) => {
          if (tr.dataset.editing === '1') return;
          if (e.key === 'Enter') {
            e.preventDefault();
            startInlineRowEdit(tr, type, dateStr);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = rows[idx + 1];
            if (next && next.focus) next.focus();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = rows[idx - 1];
            if (prev && prev.focus) prev.focus();
          }
        };
        tr.onfocus = () => tr.classList.add('ledger-row-focused');
        tr.onblur = () => tr.classList.remove('ledger-row-focused');
      });
    }

    enhanceTableRows(studyTbody, 'study');
    enhanceTableRows(stepsTbody, 'steps');
  }

  function startInlineRowEdit(tr, type, dateStr) {
    if (!tr || tr.dataset.editing === '1') return;
    if (typeof currentUser !== 'undefined' && !currentUser) {
      if (typeof showToast === 'function') showToast('READ-ONLY MODE', 'Sign in as autumn to edit ledger cells inline.', true);
      return;
    }

    const cells = tr.querySelectorAll('td');
    if (cells.length < 4) return;
    tr.dataset.editing = '1';

    const valCell = cells[1];
    const originalHtml = valCell.innerHTML;

    if (type === 'study') {
      const studyRows = getStudyRowsList();
      const rowObj = studyRows.find((r) => r.date === dateStr);
      const curHours = rowObj ? Number(rowObj.actual_hours) || 0 : 0;

      valCell.innerHTML = `
        <div class="flex items-center gap-1" onclick="event.stopPropagation();">
          <input type="number" step="0.1" min="0" max="24" value="${curHours.toFixed(2)}" class="inline-ledger-input w-16" id="inline-edit-val-${dateStr}" aria-label="Edit study hours for ${dateStr}" />
          <select id="inline-edit-course-${dateStr}" class="inline-ledger-input !w-20" title="Optional course tag">
            <option value="">Tag</option>
            <option value="ENG">ENG</option>
            <option value="KIE1003">KIE1003</option>
            <option value="KIE1004">KIE1004</option>
            <option value="KIE1005">KIE1005</option>
            <option value="KIX1001">KIX1001</option>
          </select>
          <button type="button" id="inline-save-${dateStr}" class="btn-tech-outline !py-0 !px-1.5 !text-[9px] !bg-[#dcfce7] !text-[#065f46]" title="Save (Enter)">${ICONS.check}</button>
          <button type="button" id="inline-cancel-${dateStr}" class="btn-tech-outline !py-0 !px-1.5 !text-[9px]" title="Cancel (Esc)">${ICONS.close}</button>
        </div>
      `;

      const inputEl = document.getElementById(`inline-edit-val-${dateStr}`);
      const courseEl = document.getElementById(`inline-edit-course-${dateStr}`);
      const saveBtn = document.getElementById(`inline-save-${dateStr}`);
      const cancelBtn = document.getElementById(`inline-cancel-${dateStr}`);

      const cancel = () => {
        delete tr.dataset.editing;
        valCell.innerHTML = originalHtml;
      };

      const commit = async () => {
        const nextHours = Math.max(0, Math.min(24, parseFloat(inputEl.value) || 0));
        const pickedCourse = courseEl ? courseEl.value : '';
        delete tr.dataset.editing;
        if (pickedCourse) recordCourseStudyHours(pickedCourse, dateStr, nextHours);

        const targetH = typeof getStudyBaseGoalForDate === 'function' ? getStudyBaseGoalForDate(dateStr) : 7;
        const { error } = await supabaseClient
          .from('study_ledger')
          .upsert({ date: dateStr, actual_hours: nextHours, target_hours: targetH, source: 'manual' }, { onConflict: 'date' });
        if (error) {
          if (typeof queueWriteIfOffline === 'function' && queueWriteIfOffline(error, 'study_ledger', { date: dateStr, actual_hours: nextHours, target_hours: targetH, source: 'manual' }, 'date')) return;
          if (typeof showToast === 'function') showToast('UPDATE ERROR', error.message, true);
          valCell.innerHTML = originalHtml;
          return;
        }
        if (typeof showToast === 'function') showToast('STUDY ROW UPDATED', `Updated ${dateStr} to ${nextHours.toFixed(2)}h${pickedCourse ? ' (' + pickedCourse + ')' : ''}.`);
        if (typeof fetchAndRenderStudy === 'function') fetchAndRenderStudy();
      };

      if (saveBtn) saveBtn.onclick = commit;
      if (cancelBtn) cancelBtn.onclick = cancel;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
        inputEl.onkeydown = (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
          else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
        };
      }
    } else if (type === 'steps') {
      const stepsRows = getStepsRowsList();
      const rowObj = stepsRows.find((r) => r.date === dateStr);
      const curSteps = rowObj ? parseInt(rowObj.actual_steps, 10) || 0 : 0;

      valCell.innerHTML = `
        <div class="flex items-center gap-1" onclick="event.stopPropagation();">
          <input type="number" step="100" min="0" max="150000" value="${curSteps}" class="inline-ledger-input w-24" id="inline-edit-steps-${dateStr}" aria-label="Edit steps for ${dateStr}" />
          <button type="button" id="inline-steps-save-${dateStr}" class="btn-tech-outline !py-0 !px-1.5 !text-[9px] !bg-[#dcfce7] !text-[#065f46]" title="Save (Enter)">${ICONS.check}</button>
          <button type="button" id="inline-steps-cancel-${dateStr}" class="btn-tech-outline !py-0 !px-1.5 !text-[9px]" title="Cancel (Esc)">${ICONS.close}</button>
        </div>
      `;

      const inputEl = document.getElementById(`inline-edit-steps-${dateStr}`);
      const saveBtn = document.getElementById(`inline-steps-save-${dateStr}`);
      const cancelBtn = document.getElementById(`inline-steps-cancel-${dateStr}`);

      const cancel = () => {
        delete tr.dataset.editing;
        valCell.innerHTML = originalHtml;
      };

      const commit = async () => {
        const nextSteps = Math.max(0, parseInt(inputEl.value, 10) || 0);
        delete tr.dataset.editing;
        const targetS = typeof getStepsBaseGoalForDate === 'function' ? getStepsBaseGoalForDate(dateStr) : 10000;
        const { error } = await supabaseClient
          .from('steps_ledger')
          .upsert({ date: dateStr, actual_steps: nextSteps, target_steps: targetS, source: 'manual' }, { onConflict: 'date' });
        if (error) {
          if (typeof queueWriteIfOffline === 'function' && queueWriteIfOffline(error, 'steps_ledger', { date: dateStr, actual_steps: nextSteps, target_steps: targetS, source: 'manual' }, 'date')) return;
          if (typeof showToast === 'function') showToast('UPDATE ERROR', error.message, true);
          valCell.innerHTML = originalHtml;
          return;
        }
        if (typeof showToast === 'function') showToast('STEPS ROW UPDATED', `Updated ${dateStr} to ${nextSteps.toLocaleString()} steps.`);
        if (typeof fetchAndRenderSteps === 'function') fetchAndRenderSteps();
      };

      if (saveBtn) saveBtn.onclick = commit;
      if (cancelBtn) cancelBtn.onclick = cancel;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
        inputEl.onkeydown = (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
          else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
        };
      }
    }
  }

  window.umAtlas = {
    loadUmSearchIndex,
    requestUserCampusGps,
    setDefaultCampusOrigin,
    setEventDestOverride,
    matchUmPlaceFromEvent,
    resolveEventUmTelemetry,
    buildUmAtlasDeepLink,
    buildEventUmWalkInlineHtml,
    renderEventModalUmPanel,
    renderCalendarCommuteStrip,
    renderStudyCourseHubStrip,
    selectCourseForStudyLog,
    recordCourseStudyHours,
    attachLedgerInlineEditing,
    updateUmGpsStatusButton,
    refreshAllUmTelemetryViews,
    getActiveSelectedCourse: () => activeSelectedCourseCode,
    getState: () => userGpsState,
    getPlacesCount: () => umPlaces.length
  };

  window.addEventListener('DOMContentLoaded', () => {
    updateUmGpsStatusButton();
    loadUmSearchIndex();
    renderStudyCourseHubStrip();
    renderCalendarCommuteStrip();
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((res) => {
        if (res.state === 'granted') requestUserCampusGps(false);
      }).catch(() => {});
    }
    const studyForm = document.getElementById('study-entry-form');
    if (studyForm) {
      studyForm.addEventListener('submit', () => {
        if (!activeSelectedCourseCode) return;
        const d = (document.getElementById('date-input') || {}).value;
        const h = parseFloat((document.getElementById('hours-input') || {}).value) || 0;
        const m = parseFloat((document.getElementById('mins-input') || {}).value) || 0;
        const s = parseFloat((document.getElementById('secs-input') || {}).value) || 0;
        const dec = h + m / 60 + s / 3600;
        if (d && dec >= 0) recordCourseStudyHours(activeSelectedCourseCode, d, dec);
      });
    }
  });
})();
