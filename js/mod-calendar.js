// ============================================================================
// autumn // 03 CALENDAR VIEWPORTS & EVENT MANAGEMENT MODULE (lazy-loaded)
// ============================================================================

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
async function openEventDetails(eventId) {
  if (window.__autumnLazy && typeof window.__autumnLazy.ensureModalsMounted === 'function') {
    await window.__autumnLazy.ensureModalsMounted();
  }
  if (window.umAtlas && typeof window.umAtlas.loadUmSearchIndex === 'function') {
    window.umAtlas.loadUmSearchIndex();
  }
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
  if (!isTabActive('calendar')) {
    __dirtyTabs.add('calendar');
    return;
  }
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

window.initCalendarModule = function () {
  if (typeof syncOwnerPermissions === "function") syncOwnerPermissions(document.getElementById("tab-calendar"));
  const gcalIdInput = document.getElementById("gcal-id-input");
  const gcalKeyInput = document.getElementById("gcal-key-input");
  const isOwner = Boolean(currentUser);
  if (gcalIdInput) gcalIdInput.value = isOwner ? (GOOGLE_CALENDAR_ID || "") : "";
  if (gcalKeyInput) gcalKeyInput.value = isOwner ? (GOOGLE_API_KEY || "") : "";
  renderManualMonthsBadges();
  updateNavbarAndRadarTelemetry();
  renderCalendarViewport();
  if (window.umAtlas) {
    if (typeof window.umAtlas.loadUmSearchIndex === "function") window.umAtlas.loadUmSearchIndex();
    if (typeof window.umAtlas.renderCalendarCommuteStrip === "function") window.umAtlas.renderCalendarCommuteStrip();
  }
};
