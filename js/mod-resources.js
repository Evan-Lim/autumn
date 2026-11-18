// ============================================================================
// autumn // 06 RESOURCE VAULT, FOCUS MODE & AMBIENT AUDIO (lazy-loaded)
// ============================================================================

function saveFocusDirective(val) {
  try {
    localStorage.setItem('autumn_focus_directive', val || '');
  } catch (e) {}
}

// updated function

function renderFocusMode() {
  if (!isTabActive('focus')) {
    __dirtyTabs.add('focus');
    return;
  }
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

  if (typeof window.hydrateDriveConfigModalInputs === 'function') {
    window.hydrateDriveConfigModalInputs();
  }
}

window.hydrateDriveConfigModalInputs = function () {
  const isOwner = Boolean(currentUser);
  const driveKeyInput = document.getElementById('gdrive-key-input');
  if (driveKeyInput) driveKeyInput.value = isOwner ? (GOOGLE_DRIVE_API_KEY || '') : '';
  const primary = GOOGLE_DRIVE_FOLDERS[0] || { title: 'Primary Study Resources', id: '' };
  const f1NameEl = document.getElementById('gdrive-folder1-name');
  const f1IdEl = document.getElementById('gdrive-folder1-id');
  const extrasEl = document.getElementById('gdrive-extra-folders-input');
  if (f1NameEl) f1NameEl.value = primary.title || 'Primary Study Resources';
  if (f1IdEl) f1IdEl.value = primary.rawUrl || primary.id || '';
  if (extrasEl) {
    extrasEl.value = GOOGLE_DRIVE_FOLDERS.slice(1).map(f => `${f.title} | ${f.rawUrl || f.id}`).join('\n');
  }
};

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
  if (isTabActive('resources')) {
    renderYoutubeResources();
    if (!activeYoutubeResourceId && globalYoutubeResources.length > 0) {
      loadYoutubeResourceInPlayer(globalYoutubeResources[0].id, false);
    }
  } else {
    __dirtyTabs.add('resources');
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


window.initResourcesModule = async function () {
  if (typeof syncOwnerPermissions === "function") syncOwnerPermissions(document.getElementById("tab-resources"));
  renderDriveFoldersTree();
  if (!Array.isArray(globalYoutubeResources) || globalYoutubeResources.length === 0) {
    await fetchAndRenderYoutubeResources();
  } else {
    renderYoutubeResources();
    if (!activeYoutubeResourceId && globalYoutubeResources.length > 0) {
      loadYoutubeResourceInPlayer(globalYoutubeResources[0].id, false);
    }
  }
  if (Object.keys(globalDriveFilesMap || {}).length === 0) {
    try {
      await loadSavedGDriveConfig();
      await fetchGoogleDriveResources(false);
    } catch (e) {}
  }
};
window.initFocusModule = async function () {
  if (typeof syncOwnerPermissions === "function") syncOwnerPermissions(document.getElementById("tab-focus"));
  try {
    const savedDirective = localStorage.getItem("autumn_focus_directive");
    const dirInput = document.getElementById("focus-directive-input");
    if (dirInput && savedDirective) dirInput.value = savedDirective;
  } catch (e) {}
  if (window.umAtlas && typeof window.umAtlas.loadUmSearchIndex === "function") {
    window.umAtlas.loadUmSearchIndex();
  }
  if (typeof updateClock === "function") updateClock(true);
  if (typeof updateStudyTimerUI === "function") updateStudyTimerUI();
  renderFocusMode();
};
