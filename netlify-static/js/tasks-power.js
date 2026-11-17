// ============================================================================
// autumn // TASK SUB-CHECKLISTS & BATCH MATRIX ACTIONS MODULE (04 // TASKS)
// - Granular inline sub-checklists ([x]) with micro progress bars per task
// - Multi-select checkboxes & Batch Matrix Action Bar for bulk status,
//   deadline shifts (+1D / +3D / +7D), column reassignment & bulk deletion
// ============================================================================

(function () {
  const SUBCHECK_STORAGE_KEY = 'autumn_task_subchecklists';
  let taskSubchecklistsMap = {};
  let expandedSubcheckTaskIds = {};
  const selectedBatchTaskIds = new Set();
  let taskMatrixFilterQuery = '';
  let taskMatrixFilterStatus = 'ALL'; // 'ALL' | 'PENDING' | 'IN-PROGRESS' | 'URGENT' | 'DONE'

  function loadSubchecklists() {
    try {
      const raw = localStorage.getItem(SUBCHECK_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      taskSubchecklistsMap = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      taskSubchecklistsMap = {};
    }
  }
  loadSubchecklists();

  function saveSubchecklists() {
    try {
      localStorage.setItem(SUBCHECK_STORAGE_KEY, JSON.stringify(taskSubchecklistsMap));
    } catch (e) {}
    if (typeof persistTaskColumnOrder === 'function' && typeof taskColOrder !== 'undefined') {
      persistTaskColumnOrder(taskColOrder);
    }
  }

  function getTaskSubchecklist(taskId) {
    const list = taskSubchecklistsMap[taskId];
    return Array.isArray(list) ? list : [];
  }

  function setTaskSubchecklistsFromSync(remoteMap) {
    if (!remoteMap || typeof remoteMap !== 'object') return;
    taskSubchecklistsMap = Object.assign({}, taskSubchecklistsMap, remoteMap);
    try {
      localStorage.setItem(SUBCHECK_STORAGE_KEY, JSON.stringify(taskSubchecklistsMap));
    } catch (e) {}
  }

  function toggleTaskChecklistPanel(taskId, ev) {
    if (ev) ev.stopPropagation();
    expandedSubcheckTaskIds[taskId] = !expandedSubcheckTaskIds[taskId];
    if (typeof renderTasksBoard === 'function') renderTasksBoard();
  }

  function addTaskChecklistItem(ev, taskId) {
    if (ev) ev.preventDefault();
    if (typeof currentUser !== 'undefined' && !currentUser) {
      if (typeof showToast === 'function') showToast('READ-ONLY MODE', 'Sign in as autumn to edit task checklists.', true);
      return;
    }
    const input = document.getElementById(`subcheck-input-${taskId}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const list = getTaskSubchecklist(taskId).slice();
    list.push({
      id: 'chk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      text,
      done: false
    });
    taskSubchecklistsMap[taskId] = list;
    expandedSubcheckTaskIds[taskId] = true;
    saveSubchecklists();
    if (typeof renderTasksBoard === 'function') renderTasksBoard();
    setTimeout(() => {
      const nextIn = document.getElementById(`subcheck-input-${taskId}`);
      if (nextIn) nextIn.focus();
    }, 30);
  }

  function toggleTaskChecklistItem(taskId, idx) {
    if (typeof currentUser !== 'undefined' && !currentUser) return;
    const list = getTaskSubchecklist(taskId).slice();
    if (!list[idx]) return;
    list[idx].done = !list[idx].done;
    taskSubchecklistsMap[taskId] = list;
    saveSubchecklists();
    if (typeof renderTasksBoard === 'function') renderTasksBoard();
  }

  function deleteTaskChecklistItem(taskId, idx) {
    if (typeof currentUser !== 'undefined' && !currentUser) return;
    const list = getTaskSubchecklist(taskId).slice();
    if (!list[idx]) return;
    list.splice(idx, 1);
    if (list.length === 0) delete taskSubchecklistsMap[taskId];
    else taskSubchecklistsMap[taskId] = list;
    saveSubchecklists();
    if (typeof renderTasksBoard === 'function') renderTasksBoard();
  }

  function renderTaskChecklistBadgeHtml(taskId) {
    const items = getTaskSubchecklist(taskId);
    const isExpanded = Boolean(expandedSubcheckTaskIds[taskId]);
    const doneCount = items.filter((i) => i.done).length;
    const allDone = items.length > 0 && doneCount === items.length;

    const chkSvg = (window.autumnIcons && window.autumnIcons.svg('checkbox')) || '';
    const closeSvg = (window.autumnIcons && window.autumnIcons.svg('close')) || 'x';

    return `
      <button
        type="button"
        onclick="window.tasksPower.toggleTaskChecklistPanel('${taskId}', event)"
        class="tech-badge ${allDone ? 'badge-green' : items.length > 0 ? 'badge-blue' : 'badge-neutral'} !text-[9px] !py-0 !px-1.5 cursor-pointer"
        title="Toggle granular sub-checklist items (${doneCount}/${items.length} completed)"
      >
        ${chkSvg}
        <span>${items.length > 0 ? `${doneCount}/${items.length}` : '+CHECK'}</span>
        <span>${isExpanded ? '▴' : '▾'}</span>
      </button>
    `;
  }

  function renderTaskChecklistDrawerHtml(taskId) {
    const items = getTaskSubchecklist(taskId);
    const isExpanded = Boolean(expandedSubcheckTaskIds[taskId]);
    if (!isExpanded && items.length === 0) return '';

    const isOwner = typeof currentUser !== 'undefined' && Boolean(currentUser);
    const doneCount = items.filter((i) => i.done).length;
    const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
    const closeSvg = (window.autumnIcons && window.autumnIcons.svg('close')) || 'x';

    // If collapsed but has items, render compact 2px micro progress bar
    if (!isExpanded && items.length > 0) {
      return `
        <div class="mt-1.5 w-full bg-[#e2efe8] h-1 overflow-hidden" title="Checklist progress: ${doneCount}/${items.length} (${pct}%)">
          <div class="h-full ${pct === 100 ? 'bg-[#059669]' : 'bg-[#0284c7]'}" style="width:${pct}%"></div>
        </div>
      `;
    }

    const rowsHtml = items.length === 0
      ? `<div class="text-[10px] text-[#56735f] py-1">No checklist steps yet. Add quick steps below:</div>`
      : items.map((item, idx) => `
          <div class="task-subcheck-item">
            <label class="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer">
              <input
                type="checkbox"
                ${item.done ? 'checked' : ''}
                ${!isOwner ? 'disabled' : ''}
                onchange="window.tasksPower.toggleTaskChecklistItem('${taskId}', ${idx})"
                class="tech-checkbox !w-3 !h-3 shrink-0"
              />
              <span class="truncate ${item.done ? 'line-through text-[#56735f]' : 'text-[#0c1f17]'}">${escapeHtml(item.text)}</span>
            </label>
            ${isOwner ? `
              <button
                type="button"
                onclick="window.tasksPower.deleteTaskChecklistItem('${taskId}', ${idx})"
                class="text-[10px] text-[#56735f] hover:text-[#b91c1c] px-1 shrink-0"
                title="Remove checklist item"
              >${closeSvg}</button>
            ` : ''}
          </div>
        `).join('');

    return `
      <div class="task-subcheck-wrap" onclick="event.stopPropagation();">
        <div class="flex items-center justify-between gap-2 mb-1 text-[9px] font-bold uppercase text-[#436152]">
          <span>SUB-CHECKLIST (${doneCount}/${items.length})</span>
          <span class="tnum">${pct}%</span>
        </div>
        <div class="w-full bg-[#d5e6dc] h-1 mb-1.5 overflow-hidden">
          <div class="h-full ${pct === 100 ? 'bg-[#059669]' : 'bg-[#0284c7]'}" style="width:${pct}%"></div>
        </div>
        <div class="flex flex-col divide-y divide-[#e2efe8]">
          ${rowsHtml}
        </div>
        ${isOwner ? `
          <form onsubmit="window.tasksPower.addTaskChecklistItem(event, '${taskId}')" class="flex items-center gap-1 mt-1.5 pt-1 border-t border-[#c5ded0]">
            <input
              type="text"
              id="subcheck-input-${taskId}"
              placeholder="+ Add checklist step..."
              class="tech-input !py-0.5 !px-1.5 !text-[10px] !bg-white flex-1 min-w-0"
              required
            />
            <button type="submit" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] shrink-0">Add</button>
          </form>
        ` : ''}
      </div>
    `;
  }

  // ── Batch Matrix Multi-Select & Bulk Operations ─────────────────────────────
  function isTaskSelected(taskId) {
    return selectedBatchTaskIds.has(taskId);
  }

  function toggleTaskBatchSelect(taskId, checked) {
    if (checked === undefined) {
      if (selectedBatchTaskIds.has(taskId)) selectedBatchTaskIds.delete(taskId);
      else selectedBatchTaskIds.add(taskId);
    } else if (checked) {
      selectedBatchTaskIds.add(taskId);
    } else {
      selectedBatchTaskIds.delete(taskId);
    }
    renderBatchMatrixBar();
  }

  function selectAllVisibleTasks() {
    if (!Array.isArray(globalTaskItems)) return;
    globalTaskItems.forEach((t) => {
      if (matchesTaskFilter(t)) selectedBatchTaskIds.add(t.id);
    });
    if (typeof renderTasksBoard === 'function') renderTasksBoard();
  }

  function clearBatchSelection() {
    selectedBatchTaskIds.clear();
    if (typeof renderTasksBoard === 'function') renderTasksBoard();
  }

  function setTaskFilterQuery(q) {
    taskMatrixFilterQuery = String(q || '').trim().toLowerCase();
    if (typeof renderTasksBoard === 'function') renderTasksBoard();
  }

  function setTaskFilterStatus(status) {
    taskMatrixFilterStatus = status || 'ALL';
    if (typeof renderTasksBoard === 'function') renderTasksBoard();
  }

  function matchesTaskFilter(task) {
    if (!task) return false;
    if (taskMatrixFilterQuery) {
      const titleMatch = String(task.title || '').toLowerCase().includes(taskMatrixFilterQuery);
      const subItems = getTaskSubchecklist(task.id);
      const subMatch = subItems.some((s) => String(s.text || '').toLowerCase().includes(taskMatrixFilterQuery));
      if (!titleMatch && !subMatch) return false;
    }
    if (taskMatrixFilterStatus === 'PENDING' && task.is_done) return false;
    if (taskMatrixFilterStatus === 'DONE' && !task.is_done) return false;
    if (taskMatrixFilterStatus === 'IN-PROGRESS') {
      const state = typeof getTaskProgressState === 'function' ? getTaskProgressState(task.id) : 'QUEUED';
      if (task.is_done || state !== 'IN-PROGRESS') return false;
    }
    if (taskMatrixFilterStatus === 'URGENT') {
      if (task.is_done) return false;
      const meta = typeof getTaskMeta === 'function' ? getTaskMeta(task.id) : {};
      if (!meta || !meta.dueDate) return false;
      const info = typeof evaluateTaskDeadline === 'function' ? evaluateTaskDeadline(meta.dueDate) : null;
      if (!info || info.diffDays > 3) return false;
    }
    return true;
  }

  async function executeBatchAction(actionType, value) {
    if (typeof currentUser !== 'undefined' && !currentUser) {
      if (typeof showToast === 'function') showToast('READ-ONLY MODE', 'Sign in as autumn to run batch task operations.', true);
      return;
    }
    // Prune stale IDs
    const validIds = Array.from(selectedBatchTaskIds).filter((id) =>
      Array.isArray(globalTaskItems) && globalTaskItems.some((t) => t.id === id)
    );
    if (validIds.length === 0) {
      if (typeof showToast === 'function') showToast('NO TASKS SELECTED', 'Select one or more tasks using the [BATCH] checkboxes first.', true);
      return;
    }

    if (actionType === 'STATUS_DONE' || actionType === 'STATUS_UNDONE') {
      const isDone = actionType === 'STATUS_DONE';
      const { error } = await supabaseClient
        .from('task_items')
        .update({ is_done: isDone })
        .in('id', validIds);
      if (error) return showToast('BATCH ERROR', error.message, true);
      showToast('BATCH UPDATED', `Marked ${validIds.length} task(s) as ${isDone ? 'DONE' : 'ACTIVE'}.`);
      selectedBatchTaskIds.clear();
      fetchAndRenderTasks();
      return;
    }

    if (actionType === 'PROGRESS_STATE') {
      const targetState = value === 'IN-PROGRESS' ? 'IN-PROGRESS' : 'QUEUED';
      validIds.forEach((id) => {
        if (targetState === 'IN-PROGRESS') taskStatusMap[id] = 'IN-PROGRESS';
        else delete taskStatusMap[id];
      });
      if (typeof persistTaskColumnOrder === 'function') await persistTaskColumnOrder(taskColOrder);
      showToast('BATCH STATUS', `Set ${validIds.length} task(s) to ${targetState}.`);
      selectedBatchTaskIds.clear();
      renderTasksBoard();
      return;
    }

    if (actionType === 'SHIFT_DUE') {
      const shiftDays = Number(value) || 0;
      const todayStr = getLocalDateString(new Date());
      for (const id of validIds) {
        const curMeta = typeof getTaskMeta === 'function' ? getTaskMeta(id) : { dueDate: '', eventId: '' };
        let nextDue = '';
        if (value === 'CLEAR') {
          nextDue = '';
        } else if (value === 'TODAY') {
          nextDue = todayStr;
        } else {
          const baseDate = curMeta.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(curMeta.dueDate) ? curMeta.dueDate : todayStr;
          nextDue = addDaysToDateStr(baseDate, shiftDays);
        }
        taskMetaMap[id] = { dueDate: nextDue, eventId: curMeta.eventId || '' };
        if (typeof mirrorTaskMeta === 'function') {
          try { await mirrorTaskMeta(id); } catch (e) {}
        }
      }
      if (typeof persistTaskColumnOrder === 'function') await persistTaskColumnOrder(taskColOrder);
      showToast('DEADLINES UPDATED', `Updated deadlines for ${validIds.length} task(s).`);
      selectedBatchTaskIds.clear();
      renderTasksBoard();
      return;
    }

    if (actionType === 'MOVE_COL') {
      if (!value) return;
      const { error } = await supabaseClient
        .from('task_items')
        .update({ column_id: value })
        .in('id', validIds);
      if (error) return showToast('MOVE ERROR', error.message, true);
      const col = (globalTaskColumns || []).find((c) => c.id === value);
      showToast('BATCH MOVED', `Moved ${validIds.length} task(s) to ${col ? col.title : 'column'}.`);
      selectedBatchTaskIds.clear();
      fetchAndRenderTasks();
      return;
    }

    if (actionType === 'DELETE') {
      confirmAction(
        `Delete ${validIds.length} selected task(s)?`,
        `This removes ${validIds.length} task(s) from Supabase. Snapshots are stored in Tools → Trash Vault.`,
        async () => {
          validIds.forEach((id) => {
            const row = (globalTaskItems || []).find((t) => t.id === id);
            if (row && typeof autumnTrashPush === 'function') autumnTrashPush('task_items', row);
          });
          const { error } = await supabaseClient.from('task_items').delete().in('id', validIds);
          if (error) return showToast('BATCH DELETE ERROR', error.message, true);
          selectedBatchTaskIds.clear();
          showToast('BATCH DELETED', `Deleted ${validIds.length} task(s).`);
          fetchAndRenderTasks();
        }
      );
    }
  }

  function renderBatchMatrixBar() {
    const host = document.getElementById('tasks-batch-bar-host');
    if (!host) return;

    // Clean up deleted IDs
    Array.from(selectedBatchTaskIds).forEach((id) => {
      if (!Array.isArray(globalTaskItems) || !globalTaskItems.some((t) => t.id === id)) {
        selectedBatchTaskIds.delete(id);
      }
    });

    const count = selectedBatchTaskIds.size;
    const isOwner = typeof currentUser !== 'undefined' && Boolean(currentUser);
    const colOptions = (globalTaskColumns || [])
      .map((c) => `<option value="${escapeHtml(c.id)}">Move to: ${escapeHtml(c.title)}</option>`)
      .join('');

    const filterBtns = [
      { id: 'ALL', label: 'ALL' },
      { id: 'PENDING', label: 'ACTIVE' },
      { id: 'IN-PROGRESS', label: 'IN-PROGRESS' },
      { id: 'URGENT', label: 'DUE ≤3D' },
      { id: 'DONE', label: 'DONE' }
    ].map((f) => `
      <button
        type="button"
        onclick="window.tasksPower.setTaskFilterStatus('${f.id}')"
        class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${taskMatrixFilterStatus === f.id ? 'active-view' : ''}"
      >${f.label}</button>
    `).join('');

    host.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[#c5ded0] text-xs">
        <div class="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            value="${escapeHtml(taskMatrixFilterQuery)}"
            oninput="window.tasksPower.setTaskFilterQuery(this.value)"
            placeholder="Filter tasks or sub-checklists..."
            class="tech-input !w-44 sm:!w-56 !py-1 !px-2 !text-xs !bg-white"
          />
          <div class="flex items-center gap-1 bg-[#e8f3ec] p-0.5 border border-[#c5ded0]">
            ${filterBtns}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" onclick="window.tasksPower.selectAllVisibleTasks()" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]">
            ${(window.autumnIcons && window.autumnIcons.svg('checkbox')) || ''}<span>Select Visible</span>
          </button>
          ${count > 0 ? `
            <button type="button" onclick="window.tasksPower.clearBatchSelection()" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]">
              ${(window.autumnIcons && window.autumnIcons.svg('close')) || ''}<span>Clear (${count})</span>
            </button>
          ` : ''}
        </div>
      </div>

      ${count > 0 ? `
        <div class="task-batch-bar mt-2">
          <div class="flex items-center gap-2">
            <span class="tech-badge bg-[#10b981] text-[#0c1f17]">${count} SELECTED</span>
            <span class="text-[11px]">BATCH MATRIX OPERATIONS:</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button type="button" onclick="window.tasksPower.executeBatchAction('PROGRESS_STATE', 'IN-PROGRESS')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-[#fef3c7] !text-[#92400e] !border-[#fcd34d]" ${!isOwner ? 'disabled' : ''}>
              <span>Set IN-PROGRESS</span>
            </button>
            <button type="button" onclick="window.tasksPower.executeBatchAction('PROGRESS_STATE', 'QUEUED')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white" ${!isOwner ? 'disabled' : ''}>
              <span>Set QUEUED</span>
            </button>
            <button type="button" onclick="window.tasksPower.executeBatchAction('STATUS_DONE')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-[#dcfce7] !text-[#065f46] !border-[#86efac]" ${!isOwner ? 'disabled' : ''}>
              ${(window.autumnIcons && window.autumnIcons.svg('check')) || ''}<span>Mark DONE</span>
            </button>
            <span class="text-[#34d399]">|</span>
            <button type="button" onclick="window.tasksPower.executeBatchAction('SHIFT_DUE', 'TODAY')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white" ${!isOwner ? 'disabled' : ''}>
              Due Today
            </button>
            <button type="button" onclick="window.tasksPower.executeBatchAction('SHIFT_DUE', 1)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white" ${!isOwner ? 'disabled' : ''}>
              +1D
            </button>
            <button type="button" onclick="window.tasksPower.executeBatchAction('SHIFT_DUE', 3)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white" ${!isOwner ? 'disabled' : ''}>
              +3D
            </button>
            <button type="button" onclick="window.tasksPower.executeBatchAction('SHIFT_DUE', 7)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white" ${!isOwner ? 'disabled' : ''}>
              +7D
            </button>
            <select onchange="if(this.value){ window.tasksPower.executeBatchAction('MOVE_COL', this.value); this.value=''; }" class="tech-input !w-36 !py-0.5 !px-1.5 !text-[10px] !bg-white !text-[#0c1f17]" ${!isOwner ? 'disabled' : ''}>
              <option value="">Move Column...</option>
              ${colOptions}
            </select>
            <button type="button" onclick="window.tasksPower.executeBatchAction('DELETE')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-[#fee2e2] !text-[#991b1b] !border-[#fca5a5]" ${!isOwner ? 'disabled' : ''}>
              ${(window.autumnIcons && window.autumnIcons.svg('trash')) || ''}<span>Delete (${count})</span>
            </button>
          </div>
        </div>
      ` : ''}
    `;
  }

  window.tasksPower = {
    getTaskSubchecklist,
    getSubchecklistsMap: () => taskSubchecklistsMap,
    setTaskSubchecklistsFromSync,
    toggleTaskChecklistPanel,
    addTaskChecklistItem,
    toggleTaskChecklistItem,
    deleteTaskChecklistItem,
    renderTaskChecklistBadgeHtml,
    renderTaskChecklistDrawerHtml,
    isTaskSelected,
    toggleTaskBatchSelect,
    selectAllVisibleTasks,
    clearBatchSelection,
    setTaskFilterQuery,
    setTaskFilterStatus,
    matchesTaskFilter,
    executeBatchAction,
    renderBatchMatrixBar
  };
})();
