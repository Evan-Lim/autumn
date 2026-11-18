function getTaskProgressState(e){return taskStatusMap[e]==="IN-PROGRESS"?"IN-PROGRESS":"QUEUED"}function toggleTaskProgressState(e,n){if(n&&n.stopPropagation(),!currentUser)return showToast("READ-ONLY MODE","Sign in as autumn to toggle task status.",!0);const t=getTaskProgressState(e);taskStatusMap[e]=t==="IN-PROGRESS"?"QUEUED":"IN-PROGRESS",persistTaskColumnOrder(taskColOrder),renderTasksBoard()}function moveTaskItem(e,n,t){const a=getTaskById(n);if(!a)return;const s=getTaskParentId(a),o=s||e,i=sortTaskItemsForColumn(o,(globalTaskItems||[]).filter(u=>u.column_id===e&&getTaskParentId(u)===s)).map(u=>u.id),d=i.indexOf(n);if(d===-1)return;const c=d+t;if(c<0||c>=i.length)return;const r=i[d];i[d]=i[c],i[c]=r,taskItemOrder[o]=i,persistTaskColumnOrder(taskColOrder),renderTasksBoard()}function toggleEntireTaskMatrixSection(){const e=document.getElementById("tasks-matrix-body-wrap"),n=document.getElementById("toggle-task-matrix-section-btn");e&&(isEntireTaskMatrixCollapsed=!isEntireTaskMatrixCollapsed,isEntireTaskMatrixCollapsed?(e.classList.add("hidden"),n&&(n.textContent="\u25B8 Expand Matrix")):(e.classList.remove("hidden"),n&&(n.textContent="\u25BE Collapse Matrix")))}function toggleTaskColumnCollapse(e){collapsedTaskCols[e]=!collapsedTaskCols[e];try{localStorage.setItem("autumn_task_col_collapsed",JSON.stringify(collapsedTaskCols))}catch{}renderTasksBoard()}function setAllTaskColumnsCollapsed(e){globalTaskColumns.forEach(n=>{collapsedTaskCols[n.id]=e});try{localStorage.setItem("autumn_task_col_collapsed",JSON.stringify(collapsedTaskCols))}catch{}!e&&isEntireTaskMatrixCollapsed&&toggleEntireTaskMatrixSection(),renderTasksBoard()}function moveTaskColumn(e,n){const t=globalTaskColumns.map(l=>l.id),a=t.indexOf(e);if(a===-1)return;const s=a+n;if(s<0||s>=t.length)return;const o=t[a];t[a]=t[s],t[s]=o,persistTaskColumnOrder(t),globalTaskColumns=sortTaskColumnsBySavedOrder(globalTaskColumns),renderTasksBoard()}function handleTaskColDragStart(e,n){draggedTaskColId=n,e.currentTarget.classList.add("dragging"),e.dataTransfer&&(e.dataTransfer.effectAllowed="move",e.dataTransfer.setData("text/plain",n))}function handleTaskColDragOver(e){e.preventDefault(),e.dataTransfer&&(e.dataTransfer.dropEffect="move"),e.currentTarget.classList.add("drag-over")}function handleTaskColDragLeave(e){e.currentTarget.classList.remove("drag-over")}function handleTaskColDragEnd(e){e.currentTarget.classList.remove("dragging","drag-over"),draggedTaskColId=null}function handleTaskColDrop(e,n){e.preventDefault(),e.currentTarget.classList.remove("drag-over");const t=draggedTaskColId||(e.dataTransfer?e.dataTransfer.getData("text/plain"):null);if(draggedTaskColId=null,!t||t===n)return;const a=globalTaskColumns.map(l=>l.id),s=a.indexOf(t),o=a.indexOf(n);s===-1||o===-1||(a.splice(s,1),a.splice(o,0,t),persistTaskColumnOrder(a),globalTaskColumns=sortTaskColumnsBySavedOrder(globalTaskColumns),renderTasksBoard())}function buildCalendarEventsOptionsHtml(e=""){const n=getLocalDateString(new Date),t=new Date(n+"T00:00:00").getTime(),a=(globalCalendarEvents||[]).slice().sort((o,l)=>{const i=new Date((o.dateStr||n)+"T00:00:00").getTime(),d=new Date((l.dateStr||n)+"T00:00:00").getTime(),c=i>=t,r=d>=t;return c&&!r?-1:!c&&r?1:c&&r?i-d:d-i}).slice(0,60);let s='<option value="">\u2014 No Linked Event (Optional) \u2014</option>';return a.forEach(o=>{const l=o.id===e?"selected":"",i=`${o.dateStr} \u2022 ${o.title.slice(0,32)}`;s+=`<option value="${escapeHtml(o.id)}" ${l}>${escapeHtml(i)}</option>`}),s}function getChildTasks(e,n){const t=n||"";return sortTaskItemsForColumn(t||e,(globalTaskItems||[]).filter(a=>a.column_id===e&&getTaskParentId(a)===t))}function getRootTasks(e){return sortTaskItemsForColumn(e,(globalTaskItems||[]).filter(n=>{if(n.column_id!==e)return!1;const t=getTaskParentId(n);return!t||!getTaskById(t)}))}function getTaskDescendants(e,n){const t=n||new Set;if(!e)return[];n||t.add(e);const a=[];return(globalTaskItems||[]).forEach(s=>{getTaskParentId(s)===e&&(t.has(s.id)||(t.add(s.id),a.push(s),getTaskDescendants(s.id,t).forEach(o=>a.push(o))))}),a}function persistChildCollapse(){try{localStorage.setItem(SUBTASK_COLLAPSED_KEY,JSON.stringify(collapsedTaskChildren))}catch{}persistTaskColumnOrder(taskColOrder)}function toggleTaskChildrenCollapse(e){collapsedTaskChildren[e]=!collapsedTaskChildren[e],persistChildCollapse(),renderTasksBoard()}function captureSubtaskDraft(){if(!addingSubtaskParentId)return;const e=document.getElementById("subtask-input-"+addingSubtaskParentId);if(!e)return;const n=document.getElementById("subtask-due-"+addingSubtaskParentId),t=document.getElementById("subtask-event-"+addingSubtaskParentId);subtaskDraft={parentId:addingSubtaskParentId,title:e.value||"",due:n?n.value:"",eventId:t?t.value:""}}function startAddSubtask(e){if(!currentUser)return showToast("READ-ONLY MODE","Sign in as autumn to add subtasks.",!0);if(addingSubtaskParentId===e)return cancelAddSubtask();captureSubtaskDraft(),addingSubtaskParentId=e,editingTaskId=null,editingColumnId=null,collapsedTaskChildren[e]=!1,persistChildCollapse(),renderTasksBoard(),setTimeout(()=>{const n=document.getElementById("subtask-input-"+e);if(n)try{n.focus()}catch{}},40)}function cancelAddSubtask(){addingSubtaskParentId=null,subtaskDraft={parentId:"",title:"",due:"",eventId:""},renderTasksBoard()}function renderSubtaskComposerHtml(e,n){const t=e.id,a=subtaskDraft&&subtaskDraft.parentId===t?subtaskDraft:{title:"",due:"",eventId:""};return`
    <form onsubmit="handleAddSubtaskItem(event, '${t}', '${n}')" class="subtask-composer">
      <div class="flex items-center gap-1.5">
        <input
          type="text"
          id="subtask-input-${t}"
          name="subtaskTitle"
          value="${escapeHtml(a.title||"")}"
          aria-label="New subtask title"
          placeholder="+ Add subtask under this task..."
          class="tech-input !py-1.5 !text-xs flex-1 min-w-0"
          required
        />
        <button type="submit" class="btn-tech-outline !py-1.5 !px-3 text-xs shrink-0">Add</button>
        <button type="button" onclick="cancelAddSubtask()" class="btn-tech-outline !py-1.5 !px-2 text-xs shrink-0" title="Cancel subtask" aria-label="Cancel subtask">\xD7</button>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <input type="date" id="subtask-due-${t}" name="subtaskDue" value="${escapeHtml(a.due||"")}" aria-label="Optional subtask deadline" title="Optional Deadline Date" class="tech-input !py-1 !px-1.5 !text-[10px] !bg-white" />
        <select id="subtask-event-${t}" name="subtaskEvent" aria-label="Optional linked calendar event" title="Optional Linked Calendar Event" class="tech-input !py-1 !px-1.5 !text-[10px] !bg-white">
          ${buildCalendarEventsOptionsHtml(a.eventId||"")}
        </select>
      </div>
    </form>
  `}function renderTaskRowHtml(e,n,t,a,s,o){if(window.tasksPower&&!window.tasksPower.matchesTaskFilter(e))return"";const l=Array.isArray(o)?o:[];if(l.indexOf(e.id)!==-1)return"";const i=l.concat(e.id),d=!!currentUser,c=d&&editingTaskId===e.id,r=getTaskMeta(e.id),u=!e.is_done&&r.dueDate?evaluateTaskDeadline(r.dueDate):null,p=r.eventId?globalCalendarEvents.find(b=>b.id===r.eventId):null,m=Math.min(t,3)*10;if(c)return`
      <form onsubmit="saveEditedTaskItem(event, '${e.id}')" class="p-2.5 border-b border-[#c5ded0] bg-[#eff8f2] flex flex-col gap-2"${m?` style="margin-left:${m}px"`:""}>
        <input type="text" id="edit-task-input-${e.id}" value="${escapeHtml(e.title)}" class="tech-input !py-1.5 !px-2 !text-xs w-full" required />
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <div>
            <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-task-due-${e.id}">Deadline (Optional)</label>
            <input type="date" id="edit-task-due-${e.id}" value="${escapeHtml(r.dueDate||"")}" class="tech-input !py-1 !px-2 !text-[11px] !bg-white" />
          </div>
          <div>
            <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-task-event-${e.id}">Link Calendar Event (Opt)</label>
            <select id="edit-task-event-${e.id}" class="tech-input !py-1 !px-2 !text-[11px] !bg-white">
              ${buildCalendarEventsOptionsHtml(r.eventId||"")}
            </select>
          </div>
        </div>
        <div class="flex items-center justify-end gap-1.5">
          <button type="button" onclick="cancelEditTaskItem()" class="btn-tech-outline !py-1 !px-2.5 text-[11px]">Cancel</button>
          <button type="submit" class="btn-chamfer !py-1 !px-3 !text-xs">Save</button>
        </div>
      </form>
    `;const h=getTaskProgressState(e.id),E=!e.is_done&&h==="IN-PROGRESS",x=getChildTasks(n,e.id),g=getTaskDescendants(e.id),k=g.filter(b=>b.is_done).length,f=!!collapsedTaskChildren[e.id],y=addingSubtaskParentId===e.id,T=`
    <div class="subtask-row flex items-start justify-between gap-2 p-2.5 border-b border-[#e8f3ec] ${u&&u.diffDays<=1?"bg-[#fee2e2]/45 border-l-2 border-l-[#dc2626]":u&&u.diffDays<=3?"bg-[#fef3c7]/50 border-l-2 border-l-[#f59e0b]":E?"bg-[#fef3c7]/45 border-l-2 border-l-[#f59e0b]":"hover:bg-[#f4faf6]"} group"${m?` style="margin-left:${m}px"`:""}>
      <div class="flex items-start gap-2.5 flex-1 min-w-0 py-0.5">
        ${x.length>0?`
          <button
            type="button"
            onclick="toggleTaskChildrenCollapse('${e.id}')"
            class="subtask-toggle ${f?"":"open"}"
            aria-expanded="${f?"false":"true"}"
            title="${f?"Show":"Hide"} ${g.length} nested subtask(s)"
            aria-label="${f?"Expand":"Collapse"} subtasks of ${escapeJsAttrSafe(e.title)}"
          >${f?"\u25B8":"\u25BE"}</button>
        `:""}
        <input type="checkbox"
          ${e.is_done?"checked":""}
          ${d?"":"disabled"}
          onchange="toggleTaskItem('${e.id}', this.checked)"
          class="tech-checkbox mt-0.5 shrink-0"
          aria-label="Toggle task: ${escapeJsAttrSafe(e.title)}"
        />
        <div class="min-w-0 flex-1">
          <div class="font-mono-tech text-xs break-words leading-snug ${e.is_done?"line-through text-[#56735f]":"text-[#0c1f17] font-medium"}">
            ${escapeHtml(e.title)}
            ${g.length>0?`<span class="subtask-rollup ${k===g.length?"all-done":""}" title="${k} of ${g.length} nested subtask(s) done">\u21B3 ${k}/${g.length}</span>`:""}
          </div>
          <div class="flex flex-wrap items-center gap-1 mt-1">
            <label class="inline-flex items-center gap-1 text-[9px] font-bold text-[#436152] bg-[#e8f3ec] border border-[#c5ded0] px-1 py-0 cursor-pointer" title="Select task for Batch Matrix operations" onclick="event.stopPropagation();"><input type="checkbox" ${window.tasksPower&&window.tasksPower.isTaskSelected(e.id)?"checked":""} onchange="window.tasksPower && window.tasksPower.toggleTaskBatchSelect('${e.id}', this.checked)" class="!w-2.5 !h-2.5" /><span>SEL</span></label>
            <span class="tech-badge badge-neutral !text-[9px] !py-0 !px-1.5" title="Position in the subtask tree">${t===0?"TASK":"SUBTASK \xB7 L"+t}</span>
            ${window.tasksPower?window.tasksPower.renderTaskChecklistBadgeHtml(e.id):""}
            ${e.is_done?"":`
              <button
                type="button"
                onclick="toggleTaskProgressState('${e.id}', event)"
                class="task-status-pill ${E?"in-progress":""}"
                title="Click to toggle between QUEUED and IN-PROGRESS"
              >
                <span class="w-1.5 h-1.5 rounded-full ${E?"bg-[#d97706] pulse-live":"bg-[#718f80]"}"></span>
                <span>${E?"IN-PROGRESS":"QUEUED"}</span>
              </button>
            `}
            ${u?`
              <span class="tech-badge ${u.badgeClass} !text-[9px] !py-0 !px-1.5">${escapeHtml(u.label)}</span>
            `:r.dueDate&&e.is_done?`<span class="tech-badge badge-neutral !text-[9px] !py-0 !px-1.5">DUE ${escapeHtml(r.dueDate.slice(5))}</span>`:""}
            ${p?`
              <button
                type="button"
                data-linked-event-badge="${escapeHtml(r.eventId)}"
                onclick="openEventDetails('${jsAttrQuote(p.id)}')"
                class="tech-badge badge-blue !text-[9px] !py-0 !px-1.5 cursor-pointer max-w-[180px] truncate"
                title="Inspect linked Calendar Event: ${escapeJsAttrSafe(p.title)}"
              > ${escapeHtml(p.title)}</button>
            `:r.eventId?`
              <span
                data-linked-event-badge="${escapeHtml(r.eventId)}"
                class="tech-badge badge-neutral !text-[9px] !py-0 !px-1.5 max-w-[180px] truncate"
                title="${globalCalendarEvents.length===0?"The linked event is still loading \u2014 this badge resolves itself.":"The linked event is outside the \xB12 month sync window. Open 03 // CALENDAR and pin that month."}"
              > ${globalCalendarEvents.length===0?"LINKED (LOADING\u2026)":"EVENT OUT OF WINDOW"}</span>
            `:""}
          </div>
          ${window.tasksPower?window.tasksPower.renderTaskChecklistDrawerHtml(e.id):""}
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onclick="moveTaskItem('${n}', '${e.id}', -1)"
          ${a<=0?"disabled":""}
          class="touch-action-btn !min-w-[24px] !min-h-[26px] !px-1 disabled:opacity-30"
          title="Move up among its siblings"
        >\u25B2</button>
        <button
          type="button"
          onclick="moveTaskItem('${n}', '${e.id}', 1)"
          ${a>=s-1?"disabled":""}
          class="touch-action-btn !min-w-[24px] !min-h-[26px] !px-1 disabled:opacity-30"
          title="Move down among its siblings"
        >\u25BC</button>
        ${d?`
          <button type="button" onclick="startAddSubtask('${e.id}')" class="touch-action-btn !min-w-[26px] !min-h-[26px]" title="Add a subtask under this task" aria-label="Add subtask under ${escapeJsAttrSafe(e.title)}">\uFF0B</button>
          <button type="button" onclick="startEditTaskItem('${e.id}')" class="touch-action-btn !min-w-[26px] !min-h-[26px]" title="Edit title, deadline or event link">Edit</button>
          <button type="button" onclick="deleteTaskItem('${e.id}')" class="touch-action-btn danger !min-w-[26px] !min-h-[26px]" title="Delete ${t===0?"task":"subtask"}${g.length>0?" and its "+g.length+" nested subtask(s)":""}">\xD7</button>
        `:""}
      </div>
    </div>
  `,v=y?renderSubtaskComposerHtml(e,n):"",w=x.length>0&&!f?`<div class="subtask-thread">${x.map((b,$)=>renderTaskRowHtml(b,n,t+1,$,x.length,i)).join("")}</div>`:"";return T+v+w}function escapeJsAttrSafe(e){return escapeHtml(String(e??""))}function renderTasksBoard(){const e=globalTaskColumns.length,n=globalTaskColumns.filter(r=>r.is_done).length,t=globalTaskItems.length,a=globalTaskItems.filter(r=>r.is_done).length;if(updateNavbarTaskDeadlinesTelemetry(),typeof renderCalendarViewport=="function"&&renderCalendarViewport(),typeof renderFocusMode=="function"&&renderFocusMode(),!isTabActive("tasks")){__dirtyTabs.add("tasks");return}const s=document.getElementById("tasks-columns-container");if(!s)return;s.innerHTML="",globalTaskColumns=sortTaskColumnsBySavedOrder(globalTaskColumns);const o=!!currentUser;document.getElementById("tasks-col-count").textContent=e,document.getElementById("tasks-col-done-count").textContent=n,document.getElementById("tasks-item-done-count").textContent=`${a} / ${t}`;const l=document.getElementById("tasks-subtask-count");if(l&&(l.textContent=globalTaskItems.filter(r=>getTaskParentId(r)).length),window.tasksPower&&typeof window.tasksPower.renderBatchMatrixBar=="function"&&window.tasksPower.renderBatchMatrixBar(),e===0){s.innerHTML=`
      <div class="w-full border border-dashed border-[#87b39b] p-8 sm:p-10 text-center tech-grid-bg flex flex-col items-center justify-center">
        <div class="font-mono-tech text-xs uppercase text-[#436152]">NO SUBJECT / COMPETITION COLUMNS CREATED YET</div>
        <p class="font-mono-tech text-xs text-[#56735f] mt-1 max-w-md">
          Use the top bar to add a Subject, Competition, or Other column. Each column holds its own checklist of tasks and can be rearranged, collapsed, or edited anytime.
        </p>
      </div>
    `;return}const i=window.innerWidth>=1650?4:window.innerWidth>=1180?3:window.innerWidth>=768?2:1,d=[],c=[];for(let r=0;r<i;r++){const u=document.createElement("div");u.className="tasks-masonry-lane",d.push(u),c.push(0),s.appendChild(u)}globalTaskColumns.forEach((r,u)=>{const p=sortTaskItemsForColumn(r.id,globalTaskItems.filter(b=>b.column_id===r.id)),m=getRootTasks(r.id),h=p.filter(b=>b.is_done).length,E=p.filter(b=>getTaskParentId(b)).length,x=o&&editingColumnId===r.id,g=!!collapsedTaskCols[r.id];let k="badge-green";r.category==="COMPETITION"&&(k="badge-blue"),r.category==="OTHER"&&(k="badge-amber");const f=document.createElement("div");f.className=`task-col-card w-full border border-[#c5ded0] bg-white flex flex-col justify-between ${r.is_done?"opacity-65 bg-[#eff8f2]":""}`,!x&&!editingTaskId&&!addingSubtaskParentId&&(f.setAttribute("draggable","true"),f.addEventListener("dragstart",b=>handleTaskColDragStart(b,r.id)),f.addEventListener("dragover",handleTaskColDragOver),f.addEventListener("dragleave",handleTaskColDragLeave),f.addEventListener("dragend",handleTaskColDragEnd),f.addEventListener("drop",b=>handleTaskColDrop(b,r.id)));const y=p.length===0?'<div class="font-mono-tech text-xs text-[#56735f] py-6 text-center">No tasks in this column yet.</div>':m.map((b,$)=>renderTaskRowHtml(b,r.id,0,$,m.length,[])).join(""),C=x?`
        <form onsubmit="saveEditedTaskColumn(event, '${r.id}')" class="flex flex-col gap-2 mb-2 p-2.5 bg-white border border-[#86efac]">
          <div class="flex items-center justify-between gap-1">
            <select id="edit-col-cat-${r.id}" class="tech-input !py-1.5 !px-2 !text-xs">
              <option value="SUBJECT" ${r.category==="SUBJECT"?"selected":""}>SUBJECT</option>
              <option value="COMPETITION" ${r.category==="COMPETITION"?"selected":""}>COMPETITION</option>
              <option value="OTHER" ${r.category==="OTHER"?"selected":""}>OTHER</option>
            </select>
          </div>
          <input type="text" id="edit-col-title-${r.id}" value="${escapeHtml(r.title)}" class="tech-input !py-1.5 !px-2 !text-xs" required />
          <div class="flex items-center justify-end gap-1.5">
            <button type="button" onclick="cancelEditTaskColumn()" class="btn-tech-outline !py-1 !px-2.5 text-[11px]">Cancel</button>
            <button type="submit" class="btn-chamfer !py-1 !px-3 !text-xs">Save</button>
          </div>
        </form>
      `:`
        <div class="flex items-center justify-between gap-1.5 mb-2 flex-wrap">
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onclick="toggleTaskColumnCollapse('${r.id}')"
              class="touch-action-btn !min-w-[26px] !min-h-[26px] !px-1.5 font-bold text-[#047857]"
              title="${g?"Expand column":"Collapse column"}"
            >
              ${g?"\u25B8":"\u25BE"}
            </button>
            <span class="tech-badge ${k}">${escapeHtml(r.category)}</span>
          </div>

          <div class="flex items-center gap-1 ml-auto">
            <span class="font-mono-tech text-[11px] text-[#436152]">${h}/${p.length}</span>
            ${E>0?`<span class="tech-badge badge-neutral !text-[9px]" title="${E} of these rows are nested subtasks">${E} SUB</span>`:""}
            <span class="font-mono-tech text-[10px] text-[#56735f] mr-0.5">/C${String(u+1).padStart(2,"0")}</span>
            <button
              type="button"
              onclick="moveTaskColumn('${r.id}', -1)"
              ${u===0?"disabled":""}
              class="touch-action-btn !min-w-[24px] !min-h-[26px] !px-1 disabled:opacity-30"
              title="Move column earlier / left"
            >&lsaquo;</button>
            <button
              type="button"
              onclick="moveTaskColumn('${r.id}', 1)"
              ${u===e-1?"disabled":""}
              class="touch-action-btn !min-w-[24px] !min-h-[26px] !px-1 disabled:opacity-30"
              title="Move column later / right"
            >&rsaquo;</button>
            ${o?`
              <button type="button" onclick="startEditTaskColumn('${r.id}')" class="touch-action-btn !min-w-[26px] !min-h-[26px]" title="Edit column name or category">Edit</button>
              <button type="button" onclick="deleteTaskColumn('${r.id}', '${jsAttrQuote(r.title)}')" class="touch-action-btn danger !min-w-[26px] !min-h-[26px]" title="Delete entire column">${window.autumnIcons&&window.autumnIcons.svg("trash")||"\xD7"}</button>
            `:""}
          </div>
        </div>

        <div
          onclick="toggleTaskColumnCollapse('${r.id}')"
          class="flex items-center justify-between gap-2 cursor-pointer select-none"
          title="Click to ${g?"expand":"collapse"} column"
        >
          <h3 class="font-bold text-base text-[#0c1f17] break-words ${r.is_done?"line-through text-[#436152]":""}">${escapeHtml(r.title)}</h3>
          <div class="flex items-center gap-1.5 shrink-0">
            ${g?`<span class="tech-badge badge-neutral !text-[9px]">${p.length} TASKS HIDDEN</span>`:""}
            ${r.is_done?'<span class="tech-badge badge-green">DONE</span>':""}
          </div>
        </div>
      `;f.innerHTML=`
      <div>
        <!-- Column Top Header -->
        <div class="p-3 sm:p-3.5 ${g?"":"border-b border-[#c5ded0]"} bg-[#eff8f2]">
          ${C}

          ${g?"":`
            <!-- Mark Entire Column Done Toggle -->
            <label class="flex items-center gap-2 mt-2.5 pt-2 border-t border-[#c5ded0] font-mono-tech text-[11px] text-[#436152] cursor-pointer select-none">
              <input type="checkbox"
                ${r.is_done?"checked":""}
                ${o?"":"disabled"}
                onchange="toggleTaskColumnDone('${r.id}', this.checked)"
                class="tech-checkbox shrink-0"
              />
              <span>Mark entire ${escapeHtml(r.category.toLowerCase())} done</span>
            </label>
          `}
        </div>

        <!-- Column Tasks List -->
        ${g?"":`
          <div class="p-2">
            ${y}
          </div>
        `}
      </div>

      <!-- Add Task Input Footer with Optional Deadline & Calendar Event Link -->
      ${g?"":`
        <form onsubmit="handleAddTaskItem(event, '${r.id}')" class="p-2.5 border-t border-[#c5ded0] bg-[#f4faf6] flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5">
            <input type="text" name="taskTitle" aria-label="New task title" placeholder="${o?"+ Add task to column...":" Sign in to add tasks"}"
              class="tech-input !py-1.5 !text-xs flex-1 min-w-0"
              ${o?"":"disabled"}
              required
            />
            <button type="submit" class="btn-tech-outline !py-1.5 !px-3 text-xs shrink-0" ${o?"":"disabled"}>Add</button>
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <input type="date" name="taskDue" aria-label="Optional deadline" title="Optional Deadline Date" class="tech-input !py-1 !px-1.5 !text-[10px] !bg-white" ${o?"":"disabled"} />
            <select name="taskEvent" aria-label="Optional linked calendar event" title="Optional Linked Calendar Event" class="tech-input !py-1 !px-1.5 !text-[10px] !bg-white" ${o?"":"disabled"}>
              ${buildCalendarEventsOptionsHtml("")}
            </select>
          </div>
        </form>
      `}
    `;let T=0;for(let b=1;b<i;b++)c[b]<c[T]&&(T=b);d[T].appendChild(f);const v=globalTaskItems.filter(b=>b.id===addingSubtaskParentId).length,w=g?70:165+m.length*46+Math.max(0,p.length-m.length)*30+v*118;c[T]+=w})}function startEditTaskColumn(e){currentUser&&(editingColumnId=e,editingTaskId=null,renderTasksBoard())}function cancelEditTaskColumn(){editingColumnId=null,renderTasksBoard()}async function saveEditedTaskColumn(e,n){if(e.preventDefault(),!currentUser)return;const t=document.getElementById(`edit-col-cat-${n}`).value,a=document.getElementById(`edit-col-title-${n}`).value.trim();if(!a)return;const{error:s}=await supabaseClient.from("task_columns").update({title:a,category:t}).eq("id",n);editingColumnId=null,s?showToast("UPDATE ERROR",s.message,!0):(showToast("COLUMN UPDATED",`Updated ${t}: ${a}`),fetchAndRenderTasks())}function startEditTaskItem(e){currentUser&&(editingTaskId=e,editingColumnId=null,renderTasksBoard())}function cancelEditTaskItem(){editingTaskId=null,renderTasksBoard()}async function saveEditedTaskItem(e,n){if(e.preventDefault(),!currentUser)return;const t=document.getElementById(`edit-task-input-${n}`).value.trim(),a=document.getElementById(`edit-task-due-${n}`)?.value||"",s=document.getElementById(`edit-task-event-${n}`)?.value||"";if(!t)return;taskMetaMap[n]={dueDate:a,eventId:s},await persistTaskColumnOrder(taskColOrder);let l=(await supabaseClient.from("task_items").update({title:t,due_date:a||null,event_id:s||null}).eq("id",n)).error;l&&isMissingColumnError(l)?(taskMetaColumnsAvailable=!1,l=(await supabaseClient.from("task_items").update({title:t}).eq("id",n)).error):l||(taskMetaColumnsAvailable=!0),editingTaskId=null,l?showToast("UPDATE ERROR",l.message,!0):(showToast("TASK UPDATED","Saved task, deadline & event link."),fetchAndRenderTasks())}onReady("add-column-form","submit",async e=>{if(e.preventDefault(),!currentUser)return;const n=document.getElementById("col-type-input").value,t=document.getElementById("col-title-input").value.trim();if(!t)return;const{data:a,error:s}=await supabaseClient.from("task_columns").insert({title:t,category:n,is_done:!1}).select().single();if(s)showToast("COLUMN ERROR",s.message,!0);else{if(a&&a.id){const o=[...globalTaskColumns.map(l=>l.id),a.id];persistTaskColumnOrder(o)}document.getElementById("col-title-input").value="",showToast("COLUMN CREATED",`Added ${n}: ${t}`),fetchAndRenderTasks()}});async function handleAddTaskItem(e,n){if(e.preventDefault(),!currentUser)return;const t=e.target.querySelector('input[name="taskTitle"]')||e.target.querySelector("input"),a=e.target.querySelector('input[name="taskDue"]'),s=e.target.querySelector('select[name="taskEvent"]'),o=t?t.value.trim():"",l=a?a.value:"",i=s?s.value:"";if(!o)return;const{data:d,error:c}=await supabaseClient.from("task_items").insert({column_id:n,title:o,is_done:!1}).select().single();c?showToast("TASK ERROR",c.message,!0):(d&&d.id&&(l||i)&&(taskMetaMap[d.id]={dueDate:l,eventId:i},await persistTaskColumnOrder(taskColOrder),await mirrorTaskMeta(d.id)),t&&(t.value=""),a&&(a.value=""),s&&(s.value=""),fetchAndRenderTasks())}async function handleAddSubtaskItem(e,n,t){if(e.preventDefault(),!currentUser)return showToast("READ-ONLY MODE","Sign in as autumn to add subtasks.",!0);const a=e.target,s=a.querySelector('input[name="subtaskTitle"]'),o=a.querySelector('input[name="subtaskDue"]'),l=a.querySelector('select[name="subtaskEvent"]'),i=s?s.value.trim():"",d=o?o.value:"",c=l?l.value:"";if(!i)return;let r=await supabaseClient.from("task_items").insert({column_id:t,parent_task_id:n||null,title:i,is_done:!1}).select().single(),u=!0;if(r.error&&isMissingColumnError(r.error)&&(taskParentColumnsAvailable=!1,u=!1,r=await supabaseClient.from("task_items").insert({column_id:t,title:i,is_done:!1}).select().single()),r.error)return showToast("SUBTASK ERROR",r.error.message,!0);u&&(taskParentColumnsAvailable=!0);const p=r.data;p&&p.id&&(d||c)&&(taskMetaMap[p.id]={dueDate:d,eventId:c},await persistTaskColumnOrder(taskColOrder),await mirrorTaskMeta(p.id));const m=getTaskById(n);addingSubtaskParentId=null,subtaskDraft={parentId:"",title:"",due:"",eventId:""},showToast(u?"SUBTASK ADDED":"ADDED WITHOUT NESTING",u?"Added "+i+" under "+(m?m.title:"the task")+".":"The parent_task_id column is missing, so "+i+" was added as a top-level task. Run the task_items migration to nest it.",!u),fetchAndRenderTasks()}async function toggleTaskItem(e,n){if(!currentUser)return;const{error:t}=await supabaseClient.from("task_items").update({is_done:n}).eq("id",e);t?showToast("UPDATE ERROR",t.message,!0):fetchAndRenderTasks()}async function toggleTaskColumnDone(e,n){if(!currentUser)return;const{error:t}=await supabaseClient.from("task_columns").update({is_done:n}).eq("id",e);t?showToast("UPDATE ERROR",t.message,!0):fetchAndRenderTasks()}async function deleteTaskItem(e){if(!currentUser)return;const n=(globalTaskItems||[]).find(o=>o.id===e)||null,t=getTaskDescendants(e);for(let o=t.length-1;o>=0;o-=1){const{error:l}=await supabaseClient.from("task_items").delete().eq("id",t[o].id);l&&console.warn("[autumn] nested task delete note:",l.message)}const{error:a}=await supabaseClient.from("task_items").delete().eq("id",e);if(a)return showToast("DELETE ERROR",a.message,!0);fetchAndRenderTasks();const s=(n?[n]:[]).concat(t);if(s.length>0){typeof autumnTrashPush=="function"&&s.forEach(l=>autumnTrashPush("task_items",l));const o=t.length>0?" and "+t.length+" nested subtask"+(t.length===1?"":"s"):"";showToast("TASK DELETED","Removed "+(n?n.title:"task")+o+".",!1,()=>restoreDeletedTaskTree(s))}else showToast("TASK DELETED","Removed task.")}async function restoreDeletedTaskTree(e){if(!currentUser||!e||e.length===0)return;let n=0;for(const t of e){const{error:a}=await supabaseClient.from("task_items").insert(t);if(a){showToast("UNDO FAILED",a.message,!0);break}n+=1}n>0&&showToast("UNDONE",n+" task row(s) restored."),fetchAndRenderTasks()}function deleteTaskColumn(e,n){if(!currentUser)return;const t=(globalTaskItems||[]).filter(s=>s.column_id===e),a=[];getRootTasks(e).forEach(s=>{const o=getTaskDescendants(s.id);for(let l=o.length-1;l>=0;l-=1)a.push(o[l]);a.push(s)}),t.forEach(s=>{a.indexOf(s)===-1&&a.push(s)}),confirmAction("Delete column: "+n+"?","This deletes the column, its "+t.length+" task row(s) and every nested subtask.",async()=>{for(const o of a){const{error:l}=await supabaseClient.from("task_items").delete().eq("id",o.id);if(l){console.warn("[autumn] column row delete note:",l.message);break}}const{error:s}=await supabaseClient.from("task_columns").delete().eq("id",e);if(s)return showToast("DELETE ERROR",s.message,!0);delete collapsedTaskCols[e],delete collapsedTaskChildren[e],t.forEach(o=>{typeof autumnTrashPush=="function"&&autumnTrashPush("task_items",o)}),showToast("COLUMN DELETED","Removed "+n+" and "+t.length+" task row(s)."),fetchAndRenderTasks()})}let editingHabitId=null;const HABIT_FREQ_META={DAILY:{label:"DAILY",badge:"badge-green",cycleDesc:"Resets daily at 00:00"},WEEKDAYS:{label:"WEEKDAYS (M-F)",badge:"badge-blue",cycleDesc:"Resets each weekday"},WEEKENDS:{label:"WEEKENDS (S-S)",badge:"badge-amber",cycleDesc:"Resets each weekend day"},WEEKLY:{label:"WEEKLY",badge:"badge-blue",cycleDesc:"Resets every Monday"},BIWEEKLY:{label:"BIWEEKLY",badge:"badge-amber",cycleDesc:"Resets every 2 weeks"},MONTHLY:{label:"MONTHLY",badge:"badge-green",cycleDesc:"Resets 1st of month"}};function getHabitCurrentPeriodKey(e,n=new Date){const t=new Date(n);t.setHours(0,0,0,0);const a=(e||"DAILY").toUpperCase();if(a==="DAILY"||a==="WEEKDAYS"||a==="WEEKENDS")return`DAY:${getLocalDateString(t)}`;if(a==="WEEKLY"){const s=t.getDay(),o=s===0?-6:1-s,l=new Date(t);return l.setDate(t.getDate()+o),`WEEK:${getLocalDateString(l)}`}if(a==="BIWEEKLY"){const s=t.getDay(),o=s===0?-6:1-s,l=new Date(t);l.setDate(t.getDate()+o);const i=Math.floor(l.getTime()/(7*864e5));return`BIWEEK:${Math.floor(i/2)}`}if(a==="MONTHLY"){const s=t.getFullYear(),o=String(t.getMonth()+1).padStart(2,"0");return`MONTH:${s}-${o}`}return`DAY:${getLocalDateString(t)}`}function getHabitCycleWindowLabel(e,n=new Date){const t=new Date(n),a=(e||"DAILY").toUpperCase(),s=t.getDay();if(a==="WEEKDAYS")return s===0||s===6?"OFF DUTY (WEEKEND)":`TODAY (${getLocalDateString(t).slice(5)})`;if(a==="WEEKENDS")return s!==0&&s!==6?"OFF DUTY (WEEKDAY)":`TODAY (${getLocalDateString(t).slice(5)})`;if(a==="WEEKLY"){const o=s===0?-6:1-s,l=new Date(t);l.setDate(t.getDate()+o);const i=new Date(l);return i.setDate(l.getDate()+6),`WK ${l.toLocaleDateString("en-US",{month:"short",day:"numeric"})} \u2013 ${i.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`}return a==="BIWEEKLY"?"CURRENT 2-WK BLOCK":a==="MONTHLY"?t.toLocaleDateString("en-US",{month:"short",year:"numeric"}).toUpperCase():`TODAY (${getLocalDateString(t).slice(5)})`}function isHabitCheckedInCurrentCycle(e,n=new Date){if(!e)return!1;const t=getHabitCurrentPeriodKey(e.frequency,n);return e.completed_period===t}function isHabitActiveToday(e,n=new Date){if(!e)return!0;const t=(e.frequency||"DAILY").toUpperCase(),a=n.getDay();return t==="WEEKDAYS"?a>=1&&a<=5:t==="WEEKENDS"?a===0||a===6:!0}async function fetchAndRenderHabits(){const{data:e,error:n}=await supabaseClient.from("recurring_habits").select("*").order("sort_order",{ascending:!0}).order("created_at",{ascending:!0});n&&console.warn("recurring_habits fetch note:",n.message),globalHabits=e||[],renderHabitsTable(),typeof renderFocusMode=="function"&&renderFocusMode()}function renderHabitsTable(){const e=document.getElementById("habits-ledger-tbody"),n=document.getElementById("habits-done-count"),t=document.getElementById("habits-act-header");if(!e)return;const a=!!currentUser;t&&(a?t.classList.remove("hidden"):t.classList.add("hidden"));const s=new Date,o=globalHabits.filter(i=>isHabitActiveToday(i,s)),l=o.filter(i=>isHabitCheckedInCurrentCycle(i,s)).length;if(n&&(n.textContent=`${l} / ${o.length}`),globalHabits.length===0){e.innerHTML=`
      <tr>
        <td colspan="${a?6:5}" class="text-center py-8 text-[#56735f] font-mono-tech text-xs">
          No recurring tasks or habits added yet. Use the form above to add daily, weekly, or monthly habits.
        </td>
      </tr>
    `;return}e.innerHTML=globalHabits.map((i,d)=>{const c=(i.frequency||"DAILY").toUpperCase(),r=HABIT_FREQ_META[c]||HABIT_FREQ_META.DAILY,u=isHabitCheckedInCurrentCycle(i,s),p=isHabitActiveToday(i,s),m=getHabitCycleWindowLabel(c,s),h=Number(i.streak_count)||0;if(a&&editingHabitId===i.id)return`
        <tr class="bg-[#eff8f2]">
          <td colspan="6" class="p-2.5 sm:p-3">
            <div class="font-mono-tech text-[10px] uppercase text-[#047857] font-bold mb-2">Edit EDITING RECURRING HABIT</div>
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div class="sm:col-span-2">
                <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-habit-title-${i.id}">Habit / Task Name</label>
                <input type="text" id="edit-habit-title-${i.id}" value="${escapeHtml(i.title||"")}" class="tech-input !py-1.5 !px-2 !text-xs">
              </div>
              <div>
                <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-habit-freq-${i.id}">Frequency</label>
                <select id="edit-habit-freq-${i.id}" class="tech-input !py-1.5 !px-2 !text-xs">
                  <option value="DAILY" ${c==="DAILY"?"selected":""}>DAILY</option>
                  <option value="WEEKDAYS" ${c==="WEEKDAYS"?"selected":""}>WEEKDAYS (M-F)</option>
                  <option value="WEEKENDS" ${c==="WEEKENDS"?"selected":""}>WEEKENDS (S-S)</option>
                  <option value="WEEKLY" ${c==="WEEKLY"?"selected":""}>WEEKLY</option>
                  <option value="BIWEEKLY" ${c==="BIWEEKLY"?"selected":""}>BIWEEKLY</option>
                  <option value="MONTHLY" ${c==="MONTHLY"?"selected":""}>MONTHLY</option>
                </select>
              </div>
              <div>
                <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-habit-notes-${i.id}">Notes / Target Window</label>
                <input type="text" id="edit-habit-notes-${i.id}" value="${escapeHtml(i.notes||"")}" placeholder="Optional note" class="tech-input !py-1.5 !px-2 !text-xs">
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 mt-2.5 pt-2 border-t border-[#c5ded0]">
              <div class="flex items-center gap-2">
                <label class="font-mono-tech text-[9px] uppercase text-[#436152]" for="edit-habit-streak-${i.id}">Streak Count:</label>
                <input type="number" id="edit-habit-streak-${i.id}" min="0" value="${h}" class="tech-input !py-1 !px-2 !text-xs !w-20">
              </div>
              <div class="flex items-center gap-2">
                <button type="button" onclick="cancelEditHabitRow()" class="btn-tech-outline !py-1 !px-3 !text-xs">Cancel</button>
                <button type="button" onclick="saveEditedHabitRow('${i.id}')" class="btn-chamfer !py-1 !px-3.5 !text-xs">Save Changes</button>
              </div>
            </div>
          </td>
        </tr>
      `;const E=u?`<span class="tech-badge badge-green !whitespace-normal text-center"> DONE (${escapeHtml(m)})</span>`:p?`<span class="tech-badge badge-amber !whitespace-normal text-center">PENDING \u2022 ${escapeHtml(m)}</span>`:`<span class="tech-badge badge-neutral !whitespace-normal text-center">${escapeHtml(m)}</span>`,x=u?'<span class="tech-badge badge-green !text-[9px] !py-0.5 !px-1.5"> DONE</span>':p?'<span class="tech-badge badge-amber !text-[9px] !py-0.5 !px-1.5">PENDING</span>':'<span class="tech-badge badge-neutral !text-[9px] !py-0.5 !px-1.5">OFF TODAY</span>';return`
      <tr class="${u?"bg-[#f0fdf4]":"hover:bg-[#f9fdfb]"} transition-colors">
        <td class="text-center border-r border-[#c5ded0]/60 align-middle">
          <span class="hidden">${u?"DONE":"PENDING"}</span>
          <input
            type="checkbox"
            ${u?"checked":""}
            ${a?"":"disabled"}
            onchange="toggleHabitCheck('${i.id}', this.checked)"
            class="tech-checkbox mx-auto"
            aria-label="Toggle habit: ${escapeHtml(i.title||"habit")}"
            title="${u?"Checked for current cycle":"Check off for current cycle"}"
          />
        </td>
        <td class="border-r border-[#c5ded0]/60 break-words align-middle py-2">
          <div class="font-bold text-xs sm:text-sm leading-snug ${u?"line-through text-[#56735f]":"text-[#0c1f17]"}">
            ${escapeHtml(i.title||"")}
          </div>
          ${i.notes?`<div class="font-mono-tech text-[10px] text-[#436152] mt-0.5 break-words">${escapeHtml(i.notes)}</div>`:""}
          <!-- Mobile-only stacked metadata pills so badges never overlap on narrow screens -->
          <div class="sm:hidden flex flex-wrap items-center gap-1 mt-1.5">
            <span class="tech-badge ${r.badge} !text-[9px] !py-0.5 !px-1.5">${escapeHtml(r.label)}</span>
            ${x}
            <span class="tech-badge badge-neutral !text-[9px] !py-0.5 !px-1.5 font-bold text-[#047857]">${h} </span>
          </div>
        </td>
        <td class="hidden md:table-cell text-center border-r border-[#c5ded0]/60 align-middle">
          <span class="tech-badge ${r.badge} !text-[10px]">${escapeHtml(r.label)}</span>
        </td>
        <td class="hidden sm:table-cell text-center border-r border-[#c5ded0]/60 align-middle">
          ${E}
        </td>
        <td class="hidden sm:table-cell text-center font-bold border-r border-[#c5ded0]/60 text-[#047857] align-middle">
          ${h} 
        </td>
        ${a?`
          <td class="text-center sm:text-right align-middle p-1.5 sm:p-2">
            <div class="grid grid-cols-2 sm:inline-flex items-center gap-1 w-fit mx-auto sm:mx-0">
              <button type="button" onclick="moveHabitRow('${i.id}', -1)" ${d===0?"disabled":""} class="touch-action-btn !min-w-[26px] !min-h-[26px] !px-1 disabled:opacity-30" title="Move habit up">\u25B2</button>
              <button type="button" onclick="moveHabitRow('${i.id}', 1)" ${d===globalHabits.length-1?"disabled":""} class="touch-action-btn !min-w-[26px] !min-h-[26px] !px-1 disabled:opacity-30" title="Move habit down">\u25BC</button>
              <button type="button" onclick="startEditHabitRow('${i.id}')" class="touch-action-btn !min-w-[26px] !min-h-[26px] !px-1" title="Edit habit">Edit</button>
              <button type="button" onclick="deleteHabitRow('${i.id}')" class="touch-action-btn danger !min-w-[26px] !min-h-[26px] !px-1" title="Delete habit">\xD7</button>
            </div>
          </td>
        `:""}
      </tr>
    `}).join("")}onReady("add-habit-form","submit",async e=>{if(e.preventDefault(),!currentUser)return showToast("ACCESS DENIED","Sign in as autumn to add recurring habits.",!0);const n=document.getElementById("habit-title-input").value.trim(),t=document.getElementById("habit-frequency-input").value,a=document.getElementById("habit-notes-input").value.trim();if(!n)return;const s=globalHabits.length>0?Math.max(...globalHabits.map(l=>Number(l.sort_order)||0))+1:1,{error:o}=await supabaseClient.from("recurring_habits").insert({title:n,frequency:t,notes:a,completed_period:"",streak_count:0,sort_order:s});o?showToast("HABIT ERROR",o.message,!0):(document.getElementById("habit-title-input").value="",document.getElementById("habit-notes-input").value="",showToast("HABIT CREATED",`Added recurring habit: "${n}" (${t}).`),fetchAndRenderHabits())});async function toggleHabitCheck(e,n){if(!currentUser)return;const t=globalHabits.find(d=>d.id===e);if(!t)return;const a=getHabitCurrentPeriodKey(t.frequency),s=Number(t.streak_count)||0,o=n?a:"",l=n?s+1:Math.max(0,s-1),{error:i}=await supabaseClient.from("recurring_habits").update({completed_period:o,streak_count:l,updated_at:new Date().toISOString()}).eq("id",e);i?showToast("UPDATE ERROR",i.message,!0):fetchAndRenderHabits()}function startEditHabitRow(e){currentUser&&(editingHabitId=e,renderHabitsTable())}function cancelEditHabitRow(){editingHabitId=null,renderHabitsTable()}async function saveEditedHabitRow(e){if(!currentUser)return;const n=document.getElementById(`edit-habit-title-${e}`)?.value.trim(),t=document.getElementById(`edit-habit-freq-${e}`)?.value||"DAILY",a=document.getElementById(`edit-habit-notes-${e}`)?.value.trim()||"",s=parseInt(document.getElementById(`edit-habit-streak-${e}`)?.value,10)||0;if(!n)return;const{error:o}=await supabaseClient.from("recurring_habits").update({title:n,frequency:t,notes:a,streak_count:Math.max(0,s),updated_at:new Date().toISOString()}).eq("id",e);editingHabitId=null,o?showToast("UPDATE ERROR",o.message,!0):(showToast("HABIT UPDATED",`Saved changes to "${n}".`),fetchAndRenderHabits())}async function moveHabitRow(e,n){if(!currentUser)return;const t=globalHabits.findIndex(l=>l.id===e);if(t===-1)return;const a=t+n;if(a<0||a>=globalHabits.length)return;const s=globalHabits.slice(),o=s[t];s[t]=s[a],s[a]=o,await Promise.all(s.map((l,i)=>supabaseClient.from("recurring_habits").update({sort_order:i+1}).eq("id",l.id))),fetchAndRenderHabits()}function deleteHabitRow(e){if(!currentUser)return;const n=globalHabits.find(t=>t.id===e);confirmAction(`Delete Recurring Habit "${n?n.title:"this habit"}"?`,"This will permanently remove this recurring habit from Supabase.",async()=>{const{error:t}=await supabaseClient.from("recurring_habits").delete().eq("id",e);t?showToast("DELETE ERROR",t.message,!0):(showToast("HABIT DELETED","Removed recurring habit.",!1,()=>restoreDeletedRow("recurring_habits",n,fetchAndRenderHabits)),fetchAndRenderHabits())})}function parsePaceToSeconds(e){if(!e)return 999999;const n=String(e).trim().split(":").map(t=>Number(t));return n.some(t=>!isFinite(t)||t<0)?999999:n.length===2&&n[1]<60?n[0]*60+n[1]:n.length===3&&n[1]<60&&n[2]<60?n[0]*3600+n[1]*60+n[2]:999999}function normalizePaceDisplay(e){const n=parsePaceToSeconds(e);if(n===999999)return e;const t=Math.floor(n/60),a=n%60;return`${String(t).padStart(2,"0")}:${String(a).padStart(2,"0")}`}function calculateTotalTimeFromPace(e,n){const t=parsePaceToSeconds(e);if(t===999999)return"--:--";const a=Math.round(t*n),s=Math.floor(a/3600),o=Math.floor(a%3600/60),l=a%60;return s>0?`${s}:${String(o).padStart(2,"0")}:${String(l).padStart(2,"0")}`:`${String(o).padStart(2,"0")}:${String(l).padStart(2,"0")}`}function calculatePaceFromTotalTime(e,n){const t=parsePaceToSeconds(e);if(t===999999||!n||n<=0)return"";const a=Math.round(t/n),s=Math.floor(a/60),o=a%60;return`${String(s).padStart(2,"0")}:${String(o).padStart(2,"0")}`}function normalizeTotalTimeDisplay(e){const n=parsePaceToSeconds(e);if(n===999999)return e;const t=Math.floor(n/3600),a=Math.floor(n%3600/60),s=n%60;return t>0?`${t}:${String(a).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(a).padStart(2,"0")}:${String(s).padStart(2,"0")}`}function handleRunPaceOrTimePreview(e){const n=document.getElementById("run-category-input"),t=document.getElementById("run-pace-input"),a=document.getElementById("run-time-input");if(!n||!t||!a)return;const s=RUN_CATEGORY_META[n.value]||RUN_CATEGORY_META["5k"],o=t.value.trim(),l=a.value.trim();if(e==="pace"&&o&&parsePaceToSeconds(o)!==999999){const i=calculateTotalTimeFromPace(o,s.km);a.placeholder=`Auto: ${i}`}else if(e==="time"&&l&&parsePaceToSeconds(l)!==999999){const i=calculatePaceFromTotalTime(l,s.km);i&&(t.placeholder=`Auto: ${i}`)}else a.placeholder="Auto (e.g. 26:15)",t.placeholder="05:15 (or via time)"}function handleRunTypeSelectChange(){const e=document.getElementById("run-type-input").value,n=document.getElementById("run-location-input"),t=document.getElementById("run-date-field-wrapper");e==="REFERENCE"?(n.placeholder="Optional note (or blank)",t.classList.add("opacity-40")):(n.placeholder="KMPP / Raffel Park",t.classList.remove("opacity-40"))}function toggleRunCategoryTable(e){visibleRunCategories[e]=!visibleRunCategories[e],Object.values(visibleRunCategories).some(Boolean)||(visibleRunCategories["5k"]=!0),updateRunCategoryToggleButtons(),renderRunningTables()}function updateRunCategoryToggleButtons(){["5k","10k","half","marathon"].forEach(e=>{const n=document.getElementById(`run-tab-toggle-${e}`);if(!n)return;const t={"5k":"5K Run","10k":visibleRunCategories["10k"]?"10K Run":"+ 10K Run",half:visibleRunCategories.half?"Half Marathon":"+ Half Marathon",marathon:visibleRunCategories.marathon?"Marathon":"+ Marathon"};n.textContent=t[e],visibleRunCategories[e]?n.classList.add("active-view"):n.classList.remove("active-view")})}async function fetchAndRenderRunningLogs(){const{data:e,error:n}=await supabaseClient.from("running_logs").select("*").order("created_at",{ascending:!0});n&&console.warn("running_logs fetch note:",n.message),globalRunningLogs=e||[],["10k","half","marathon"].forEach(t=>{globalRunningLogs.some(a=>a.category===t)&&(visibleRunCategories[t]=!0)}),updateRunCategoryToggleButtons(),renderRunningTables()}function renderRunningTables(){const e=document.getElementById("running-tables-container");if(!e)return;e.innerHTML="";const n=!!currentUser;typeof renderFocusMode=="function"&&renderFocusMode(),["5k","10k","half","marathon"].forEach(t=>{if(!visibleRunCategories[t])return;const a=RUN_CATEGORY_META[t],s=globalRunningLogs.filter(d=>d.category===t).slice().sort((d,c)=>{const r=parsePaceToSeconds(d.pace_str),u=parsePaceToSeconds(c.pace_str);if(r!==u)return r-u;const p=d.run_type==="REFERENCE"?1:0,m=c.run_type==="REFERENCE"?1:0;return p-m}),o=document.createElement("div");o.className="border border-[#87b39b] bg-white overflow-hidden max-w-full";const l=s.length===0?`
        <tr>
          <td colspan="${n?5:4}" class="text-center py-8 text-[#56735f] font-mono-tech text-xs">
            No ${a.title} runs or reference paces logged yet. Use the form above to add entries.
          </td>
        </tr>
      `:s.map(d=>{const c=d.run_type==="REFERENCE",r=c?"run-row-reference":d.run_type==="EASY"?"run-row-easy":"run-row-threshold",u=c?"REF":formatRunDateDMY(d.run_date),p=c?"REFERENCE":formatRunDateDMY(d.run_date),m=normalizePaceDisplay(d.pace_str),h=d.time_str||calculateTotalTimeFromPace(m,a.km);return n&&editingRunId===d.id?`
              <tr class="bg-[#eff8f2]">
                <td colspan="5" class="p-2.5 sm:p-3">
                  <div class="font-mono-tech text-[10px] uppercase text-[#047857] font-bold mb-2">Edit EDITING ${a.title} ENTRY</div>
                  <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-run-date-${d.id}">Date</label>
                      <input type="text" id="edit-run-date-${d.id}" value="${escapeHtml(d.run_date||"")}" placeholder="YYYY-MM-DD / REFERENCE" class="tech-input !py-1.5 !px-2 !text-xs">
                    </div>
                    <div>
                      <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-run-time-${d.id}">Total Time</label>
                      <input type="text" id="edit-run-time-${d.id}" value="${escapeHtml(h)}" placeholder="Auto from pace" class="tech-input !py-1.5 !px-2 !text-xs">
                    </div>
                    <div>
                      <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-run-pace-${d.id}">Pace (/km)</label>
                      <input type="text" id="edit-run-pace-${d.id}" value="${escapeHtml(m)}" placeholder="MM:SS" class="tech-input !py-1.5 !px-2 !text-xs">
                    </div>
                    <div>
                      <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-run-type-${d.id}">Run Type</label>
                      <select id="edit-run-type-${d.id}" class="tech-input !py-1.5 !px-2 !text-xs">
                        <option value="THRESHOLD" ${d.run_type==="THRESHOLD"?"selected":""}>THRESHOLD</option>
                        <option value="EASY" ${d.run_type==="EASY"?"selected":""}>EASY</option>
                        <option value="REFERENCE" ${d.run_type==="REFERENCE"?"selected":""}>REFERENCE</option>
                      </select>
                    </div>
                    <div class="col-span-2 sm:col-span-1">
                      <label class="block font-mono-tech text-[9px] uppercase text-[#436152] mb-0.5" for="edit-run-loc-${d.id}">Location</label>
                      <input type="text" id="edit-run-loc-${d.id}" value="${escapeHtml(d.location||"")}" placeholder="Location" class="tech-input !py-1.5 !px-2 !text-xs">
                    </div>
                  </div>
                  <div class="flex items-center justify-end gap-2 mt-2.5 pt-2 border-t border-[#c5ded0]">
                    <button type="button" onclick="cancelEditRunRow()" class="btn-tech-outline !py-1 !px-3 !text-xs">Cancel</button>
                    <button type="button" onclick="saveEditedRunRow('${d.id}', ${a.km})" class="btn-chamfer !py-1 !px-3.5 !text-xs">Save Changes</button>
                  </div>
                </td>
              </tr>
            `:`
            <tr class="${r}">
              <td class="text-center font-semibold border-r border-[#c5ded0]/60 align-middle">
                <span class="sm:hidden text-[10px]">${escapeHtml(u)}</span>
                <span class="hidden sm:inline">${escapeHtml(p)}</span>
              </td>
              <td class="text-center font-semibold border-r border-[#c5ded0]/60 align-middle">${escapeHtml(h)}</td>
              <td class="text-center font-bold border-r border-[#c5ded0]/60 align-middle">${escapeHtml(m)}</td>
              <td class="break-words align-middle">${escapeHtml(d.location||(c?"\u2014":""))}</td>
              ${n?`
                <td class="text-center sm:text-right align-middle p-1 sm:p-2">
                  <div class="inline-flex items-center gap-0.5 sm:gap-1">
                    <button type="button" onclick="startEditRunRow('${d.id}')" class="touch-action-btn !min-w-[24px] !min-h-[24px] !px-1" title="Edit row">Edit</button>
                    <button type="button" onclick="deleteRunRow('${d.id}')" class="touch-action-btn danger !min-w-[24px] !min-h-[24px] !px-1" title="Delete row">\xD7</button>
                  </div>
                </td>
              `:""}
            </tr>
          `}).join(""),i=`run-table-${t}`;o.innerHTML=`
      <!-- Spreadsheet-Style Technical Banner -->
      <div class="bg-[#d5e6dc] text-center font-mono-tech text-xs font-bold uppercase tracking-widest py-1 border-b border-[#87b39b] text-[#0c1f17]">
        RUN
      </div>
      <div class="bg-[#e8f3ec] text-center font-mono-tech text-xs font-bold uppercase tracking-wider py-1 border-b border-[#87b39b] text-[#047857]">
        ${a.title}
      </div>
      <div class="w-full overflow-x-auto">
        <table id="${i}" class="tech-table run-mobile-table">
          <thead>
            <tr class="bg-[#f4faf6]">
              <th class="!text-center w-[22%] sm:w-32 border-r border-[#c5ded0]">DATE</th>
              <th class="!text-center w-[19%] sm:w-28 border-r border-[#c5ded0]">TIME</th>
              <th class="!text-center w-[18%] sm:w-32 border-r border-[#c5ded0]">PACE</th>
              <th class="w-auto">LOCATION <span class="hidden sm:inline text-[10px] font-normal text-[#436152]">(YELLOW = THRESHOLD / GREEN = EASY)</span></th>
              ${n?'<th data-no-export="true" class="!text-center sm:!text-right w-[52px] sm:w-20">ACT</th>':""}
            </tr>
          </thead>
          <tbody>
            ${l}
          </tbody>
        </table>
      </div>
      <div class="table-export-bar px-3 pb-2">
        <span>EXPORT ${a.title} TABLE:</span>
        <div class="flex flex-wrap items-center gap-1">
          <button type="button" onclick="exportHtmlTableData('${i}', 'running-${t}-ledger', 'csv')" class="btn-export-tag">\u2193 CSV</button>
          <button type="button" onclick="exportHtmlTableData('${i}', 'running-${t}-ledger', 'md')" class="btn-export-tag">\u2193 MD</button>
          <button type="button" onclick="exportHtmlTableData('${i}', 'running-${t}-ledger', 'json')" class="btn-export-tag">\u2193 JSON</button>
          <button type="button" onclick="exportHtmlTableData('${i}', 'running-${t}-ledger', 'tsv')" class="btn-export-tag">\u2193 TSV</button>
          <button type="button" onclick="exportHtmlTableData('${i}', 'running-${t}-ledger', 'copy')" class="btn-export-tag">\u2398 COPY MD</button>
        </div>
      </div>
    `,e.appendChild(o)})}onReady("add-run-form","submit",async e=>{if(e.preventDefault(),!currentUser)return showToast("ACCESS DENIED","Sign in as autumn to log runs.",!0);const n=document.getElementById("run-category-input").value,t=document.getElementById("run-pace-input").value.trim(),a=document.getElementById("run-time-input").value.trim(),s=document.getElementById("run-location-input").value.trim(),o=document.getElementById("run-type-input").value,l=document.getElementById("run-date-input").value,i=RUN_CATEGORY_META[n]||RUN_CATEGORY_META["5k"];let d="",c="";const r=t&&parsePaceToSeconds(t)!==999999,u=a&&parsePaceToSeconds(a)!==999999;if(!r&&!u)return showToast("PACE OR TIME REQUIRED","Enter either Pace (MM:SS) or Total Time (MM:SS / H:MM:SS).",!0);r&&u?(d=normalizePaceDisplay(t),c=normalizeTotalTimeDisplay(a)):r?(d=normalizePaceDisplay(t),c=calculateTotalTimeFromPace(d,i.km)):(c=normalizeTotalTimeDisplay(a),d=calculatePaceFromTotalTime(a,i.km));const p=o==="REFERENCE"?"REFERENCE":l||getLocalDateString(new Date);visibleRunCategories[n]=!0,updateRunCategoryToggleButtons();const{error:m}=await supabaseClient.from("running_logs").insert({category:n,run_date:p,time_str:c,pace_str:d,run_type:o,location:s});m?showToast("DATABASE ERROR",m.message,!0):(document.getElementById("run-pace-input").value="",document.getElementById("run-time-input").value="",document.getElementById("run-location-input").value="",handleRunPaceOrTimePreview("pace"),showToast(o==="REFERENCE"?"REF PACE INSERTED":"RUN LOGGED",`Added ${i.title} entry at ${d}/km (${c}).`),fetchAndRenderRunningLogs())});function startEditRunRow(e){currentUser&&(editingRunId=e,renderRunningTables())}function cancelEditRunRow(){editingRunId=null,renderRunningTables()}async function saveEditedRunRow(e,n){if(!currentUser)return;const t=document.getElementById(`edit-run-date-${e}`).value.trim(),a=document.getElementById(`edit-run-pace-${e}`).value.trim(),s=document.getElementById(`edit-run-time-${e}`).value.trim(),o=document.getElementById(`edit-run-type-${e}`).value,l=document.getElementById(`edit-run-loc-${e}`).value.trim(),i=normalizePaceDisplay(a),d=calculateTotalTimeFromPace(i,n),c=s||d,r=o==="REFERENCE"?"REFERENCE":t||getLocalDateString(new Date),{error:u}=await supabaseClient.from("running_logs").update({run_date:r,pace_str:i,time_str:c,run_type:o,location:l}).eq("id",e);editingRunId=null,u?showToast("UPDATE ERROR",u.message,!0):(showToast("RUN UPDATED","Updated running log entry."),fetchAndRenderRunningLogs())}async function deleteRunRow(e){if(!currentUser)return;const{error:n}=await supabaseClient.from("running_logs").delete().eq("id",e);if(n)showToast("DELETE ERROR",n.message,!0);else{const t=(globalRunningLogs||[]).find(a=>a.id===e)||null;fetchAndRenderRunningLogs(),t?showToast("RUN DELETED","Removed run entry.",!1,()=>restoreDeletedRow("running_logs",t,fetchAndRenderRunningLogs)):showToast("RUN DELETED","Removed run entry.")}}window.initTasksModule=async function(){const e=document.getElementById("run-date-input");if(e&&!e.value&&(e.value=getLocalDateString(new Date)),window.__autumnLazy&&typeof window.__autumnLazy.ensureModule=="function")try{await window.__autumnLazy.ensureModule("tasks-power")}catch{}typeof syncOwnerPermissions=="function"&&syncOwnerPermissions(document.getElementById("tab-tasks")),updateRunCategoryToggleButtons(),renderTasksBoard(),Array.isArray(globalHabits)&&globalHabits.length>0?renderHabitsTable():fetchAndRenderHabits(),Array.isArray(globalRunningLogs)&&globalRunningLogs.length>0?renderRunningTables():fetchAndRenderRunningLogs()};
