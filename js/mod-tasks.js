// ============================================================================
// autumn // 04 TASKS MATRIX, RECURRING HABITS & RUNNING LEDGERS (lazy-loaded)
// ============================================================================

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
  const totalCols = globalTaskColumns.length;
  const doneCols = globalTaskColumns.filter(c => c.is_done).length;
  const totalItems = globalTaskItems.length;
  const doneItems = globalTaskItems.filter(i => i.is_done).length;

  updateNavbarTaskDeadlinesTelemetry();
  if (typeof renderCalendarViewport === 'function') renderCalendarViewport();
  if (typeof renderFocusMode === 'function') renderFocusMode();

  if (!isTabActive('tasks')) {
    __dirtyTabs.add('tasks');
    return;
  }

  const container = document.getElementById('tasks-columns-container');
  if (!container) return;
  container.innerHTML = '';

  globalTaskColumns = sortTaskColumnsBySavedOrder(globalTaskColumns);

  const isOwner = Boolean(currentUser);

  document.getElementById('tasks-col-count').textContent = totalCols;
  document.getElementById('tasks-col-done-count').textContent = doneCols;
  document.getElementById('tasks-item-done-count').textContent = `${doneItems} / ${totalItems}`;
  const subtaskSummary = document.getElementById('tasks-subtask-count');
  if (subtaskSummary) subtaskSummary.textContent = globalTaskItems.filter(i => getTaskParentId(i)).length;

  if (window.tasksPower && typeof window.tasksPower.renderBatchMatrixBar === 'function') {
    window.tasksPower.renderBatchMatrixBar();
  }

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

window.initTasksModule = async function () {
  const runDateEl = document.getElementById("run-date-input");
  if (runDateEl && !runDateEl.value) runDateEl.value = getLocalDateString(new Date());
  if (window.__autumnLazy && typeof window.__autumnLazy.ensureModule === "function") {
    try { await window.__autumnLazy.ensureModule("tasks-power"); } catch (e) {}
  }
  if (typeof syncOwnerPermissions === "function") syncOwnerPermissions(document.getElementById("tab-tasks"));
  updateRunCategoryToggleButtons();
  renderTasksBoard();
  if (Array.isArray(globalHabits) && globalHabits.length > 0) renderHabitsTable();
  else fetchAndRenderHabits();
  if (Array.isArray(globalRunningLogs) && globalRunningLogs.length > 0) renderRunningTables();
  else fetchAndRenderRunningLogs();
};
