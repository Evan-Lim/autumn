(function(){const b="autumn_task_subchecklists";let r={},p={};const i=new Set;let h="",f="ALL";function m(){try{const e=localStorage.getItem(b),t=e?JSON.parse(e):{};r=t&&typeof t=="object"?t:{}}catch{r={}}}m();function k(){try{localStorage.setItem(b,JSON.stringify(r))}catch{}typeof persistTaskColumnOrder=="function"&&typeof taskColOrder<"u"&&persistTaskColumnOrder(taskColOrder)}function d(e){const t=r[e];return Array.isArray(t)?t:[]}function x(e){if(!(!e||typeof e!="object")){r=Object.assign({},r,e);try{localStorage.setItem(b,JSON.stringify(r))}catch{}}}function S(e,t){t&&t.stopPropagation(),p[e]=!p[e],typeof renderTasksBoard=="function"&&renderTasksBoard()}function y(e,t){if(e&&e.preventDefault(),typeof currentUser<"u"&&!currentUser){typeof showToast=="function"&&showToast("READ-ONLY MODE","Sign in as autumn to edit task checklists.",!0);return}const s=document.getElementById(`subcheck-input-${t}`);if(!s)return;const n=s.value.trim();if(!n)return;const a=d(t).slice();a.push({id:"chk_"+Date.now()+"_"+Math.random().toString(36).slice(2,6),text:n,done:!1}),r[t]=a,p[t]=!0,k(),typeof renderTasksBoard=="function"&&renderTasksBoard(),setTimeout(()=>{const o=document.getElementById(`subcheck-input-${t}`);o&&o.focus()},30)}function E(e,t){if(typeof currentUser<"u"&&!currentUser)return;const s=d(e).slice();s[t]&&(s[t].done=!s[t].done,r[e]=s,k(),typeof renderTasksBoard=="function"&&renderTasksBoard())}function $(e,t){if(typeof currentUser<"u"&&!currentUser)return;const s=d(e).slice();s[t]&&(s.splice(t,1),s.length===0?delete r[e]:r[e]=s,k(),typeof renderTasksBoard=="function"&&renderTasksBoard())}function D(e){const t=d(e),s=!!p[e],n=t.filter(l=>l.done).length,a=t.length>0&&n===t.length,o=window.autumnIcons&&window.autumnIcons.svg("checkbox")||"",c=window.autumnIcons&&window.autumnIcons.svg("close")||"x";return`
      <button
        type="button"
        onclick="window.tasksPower.toggleTaskChecklistPanel('${e}', event)"
        class="tech-badge ${a?"badge-green":t.length>0?"badge-blue":"badge-neutral"} !text-[9px] !py-0 !px-1.5 cursor-pointer"
        title="Toggle granular sub-checklist items (${n}/${t.length} completed)"
      >
        ${o}
        <span>${t.length>0?`${n}/${t.length}`:"+CHECK"}</span>
        <span>${s?"\u25B4":"\u25BE"}</span>
      </button>
    `}function v(e){const t=d(e),s=!!p[e];if(!s&&t.length===0)return"";const n=typeof currentUser<"u"&&!!currentUser,a=t.filter(u=>u.done).length,o=t.length>0?Math.round(a/t.length*100):0,c=window.autumnIcons&&window.autumnIcons.svg("close")||"x";if(!s&&t.length>0)return`
        <div class="mt-1.5 w-full bg-[#e2efe8] h-1 overflow-hidden" title="Checklist progress: ${a}/${t.length} (${o}%)">
          <div class="h-full ${o===100?"bg-[#059669]":"bg-[#0284c7]"}" style="width:${o}%"></div>
        </div>
      `;const l=t.length===0?'<div class="text-[10px] text-[#56735f] py-1">No checklist steps yet. Add quick steps below:</div>':t.map((u,g)=>`
          <div class="task-subcheck-item">
            <label class="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer">
              <input
                type="checkbox"
                ${u.done?"checked":""}
                ${n?"":"disabled"}
                onchange="window.tasksPower.toggleTaskChecklistItem('${e}', ${g})"
                class="tech-checkbox !w-3 !h-3 shrink-0"
              />
              <span class="truncate ${u.done?"line-through text-[#56735f]":"text-[#0c1f17]"}">${escapeHtml(u.text)}</span>
            </label>
            ${n?`
              <button
                type="button"
                onclick="window.tasksPower.deleteTaskChecklistItem('${e}', ${g})"
                class="text-[10px] text-[#56735f] hover:text-[#b91c1c] px-1 shrink-0"
                title="Remove checklist item"
              >${c}</button>
            `:""}
          </div>
        `).join("");return`
      <div class="task-subcheck-wrap" onclick="event.stopPropagation();">
        <div class="flex items-center justify-between gap-2 mb-1 text-[9px] font-bold uppercase text-[#436152]">
          <span>SUB-CHECKLIST (${a}/${t.length})</span>
          <span class="tnum">${o}%</span>
        </div>
        <div class="w-full bg-[#d5e6dc] h-1 mb-1.5 overflow-hidden">
          <div class="h-full ${o===100?"bg-[#059669]":"bg-[#0284c7]"}" style="width:${o}%"></div>
        </div>
        <div class="flex flex-col divide-y divide-[#e2efe8]">
          ${l}
        </div>
        ${n?`
          <form onsubmit="window.tasksPower.addTaskChecklistItem(event, '${e}')" class="flex items-center gap-1 mt-1.5 pt-1 border-t border-[#c5ded0]">
            <input
              type="text"
              id="subcheck-input-${e}"
              placeholder="+ Add checklist step..."
              class="tech-input !py-0.5 !px-1.5 !text-[10px] !bg-white flex-1 min-w-0"
              required
            />
            <button type="submit" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] shrink-0">Add</button>
          </form>
        `:""}
      </div>
    `}function A(e){return i.has(e)}function O(e,t){t===void 0?i.has(e)?i.delete(e):i.add(e):t?i.add(e):i.delete(e),T()}function C(){Array.isArray(globalTaskItems)&&(globalTaskItems.forEach(e=>{w(e)&&i.add(e.id)}),typeof renderTasksBoard=="function"&&renderTasksBoard())}function B(){i.clear(),typeof renderTasksBoard=="function"&&renderTasksBoard()}function R(e){h=String(e||"").trim().toLowerCase(),typeof renderTasksBoard=="function"&&renderTasksBoard()}function I(e){f=e||"ALL",typeof renderTasksBoard=="function"&&renderTasksBoard()}function w(e){if(!e)return!1;if(h){const t=String(e.title||"").toLowerCase().includes(h),n=d(e.id).some(a=>String(a.text||"").toLowerCase().includes(h));if(!t&&!n)return!1}if(f==="PENDING"&&e.is_done||f==="DONE"&&!e.is_done)return!1;if(f==="IN-PROGRESS"){const t=typeof getTaskProgressState=="function"?getTaskProgressState(e.id):"QUEUED";if(e.is_done||t!=="IN-PROGRESS")return!1}if(f==="URGENT"){if(e.is_done)return!1;const t=typeof getTaskMeta=="function"?getTaskMeta(e.id):{};if(!t||!t.dueDate)return!1;const s=typeof evaluateTaskDeadline=="function"?evaluateTaskDeadline(t.dueDate):null;if(!s||s.diffDays>3)return!1}return!0}async function P(e,t){if(typeof currentUser<"u"&&!currentUser){typeof showToast=="function"&&showToast("READ-ONLY MODE","Sign in as autumn to run batch task operations.",!0);return}const s=Array.from(i).filter(n=>Array.isArray(globalTaskItems)&&globalTaskItems.some(a=>a.id===n));if(s.length===0){typeof showToast=="function"&&showToast("NO TASKS SELECTED","Select one or more tasks using the [BATCH] checkboxes first.",!0);return}if(e==="STATUS_DONE"||e==="STATUS_UNDONE"){const n=e==="STATUS_DONE",{error:a}=await supabaseClient.from("task_items").update({is_done:n}).in("id",s);if(a)return showToast("BATCH ERROR",a.message,!0);showToast("BATCH UPDATED",`Marked ${s.length} task(s) as ${n?"DONE":"ACTIVE"}.`),i.clear(),fetchAndRenderTasks();return}if(e==="PROGRESS_STATE"){const n=t==="IN-PROGRESS"?"IN-PROGRESS":"QUEUED";s.forEach(a=>{n==="IN-PROGRESS"?taskStatusMap[a]="IN-PROGRESS":delete taskStatusMap[a]}),typeof persistTaskColumnOrder=="function"&&await persistTaskColumnOrder(taskColOrder),showToast("BATCH STATUS",`Set ${s.length} task(s) to ${n}.`),i.clear(),renderTasksBoard();return}if(e==="SHIFT_DUE"){const n=Number(t)||0,a=getLocalDateString(new Date);for(const o of s){const c=typeof getTaskMeta=="function"?getTaskMeta(o):{dueDate:"",eventId:""};let l="";if(t==="CLEAR")l="";else if(t==="TODAY")l=a;else{const u=c.dueDate&&/^\d{4}-\d{2}-\d{2}$/.test(c.dueDate)?c.dueDate:a;l=addDaysToDateStr(u,n)}if(taskMetaMap[o]={dueDate:l,eventId:c.eventId||""},typeof mirrorTaskMeta=="function")try{await mirrorTaskMeta(o)}catch{}}typeof persistTaskColumnOrder=="function"&&await persistTaskColumnOrder(taskColOrder),showToast("DEADLINES UPDATED",`Updated deadlines for ${s.length} task(s).`),i.clear(),renderTasksBoard();return}if(e==="MOVE_COL"){if(!t)return;const{error:n}=await supabaseClient.from("task_items").update({column_id:t}).in("id",s);if(n)return showToast("MOVE ERROR",n.message,!0);const a=(globalTaskColumns||[]).find(o=>o.id===t);showToast("BATCH MOVED",`Moved ${s.length} task(s) to ${a?a.title:"column"}.`),i.clear(),fetchAndRenderTasks();return}e==="DELETE"&&confirmAction(`Delete ${s.length} selected task(s)?`,`This removes ${s.length} task(s) from Supabase. Snapshots are stored in Tools \u2192 Trash Vault.`,async()=>{s.forEach(a=>{const o=(globalTaskItems||[]).find(c=>c.id===a);o&&typeof autumnTrashPush=="function"&&autumnTrashPush("task_items",o)});const{error:n}=await supabaseClient.from("task_items").delete().in("id",s);if(n)return showToast("BATCH DELETE ERROR",n.message,!0);i.clear(),showToast("BATCH DELETED",`Deleted ${s.length} task(s).`),fetchAndRenderTasks()})}function T(){const e=document.getElementById("tasks-batch-bar-host");if(!e)return;Array.from(i).forEach(o=>{(!Array.isArray(globalTaskItems)||!globalTaskItems.some(c=>c.id===o))&&i.delete(o)});const t=i.size,s=typeof currentUser<"u"&&!!currentUser,n=(globalTaskColumns||[]).map(o=>`<option value="${escapeHtml(o.id)}">Move to: ${escapeHtml(o.title)}</option>`).join(""),a=[{id:"ALL",label:"ALL"},{id:"PENDING",label:"ACTIVE"},{id:"IN-PROGRESS",label:"IN-PROGRESS"},{id:"URGENT",label:"DUE \u22643D"},{id:"DONE",label:"DONE"}].map(o=>`
      <button
        type="button"
        onclick="window.tasksPower.setTaskFilterStatus('${o.id}')"
        class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${f===o.id?"active-view":""}"
      >${o.label}</button>
    `).join("");e.innerHTML=`
      <div class="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[#c5ded0] text-xs">
        <div class="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            value="${escapeHtml(h)}"
            oninput="window.tasksPower.setTaskFilterQuery(this.value)"
            placeholder="Filter tasks or sub-checklists..."
            class="tech-input !w-44 sm:!w-56 !py-1 !px-2 !text-xs !bg-white"
          />
          <div class="flex items-center gap-1 bg-[#e8f3ec] p-0.5 border border-[#c5ded0]">
            ${a}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" onclick="window.tasksPower.selectAllVisibleTasks()" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]">
            ${window.autumnIcons&&window.autumnIcons.svg("checkbox")||""}<span>Select Visible</span>
          </button>
          ${t>0?`
            <button type="button" onclick="window.tasksPower.clearBatchSelection()" class="btn-tech-outline !py-0.5 !px-2 !text-[10px]">
              ${window.autumnIcons&&window.autumnIcons.svg("close")||""}<span>Clear (${t})</span>
            </button>
          `:""}
        </div>
      </div>

      ${t>0?`
        <div class="task-batch-bar mt-2">
          <div class="flex items-center gap-2">
            <span class="tech-badge bg-[#10b981] text-[#0c1f17]">${t} SELECTED</span>
            <span class="text-[11px]">BATCH MATRIX OPERATIONS:</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button type="button" onclick="window.tasksPower.executeBatchAction('PROGRESS_STATE', 'IN-PROGRESS')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-[#fef3c7] !text-[#92400e] !border-[#fcd34d]" ${s?"":"disabled"}>
              <span>Set IN-PROGRESS</span>
            </button>
            <button type="button" onclick="window.tasksPower.executeBatchAction('PROGRESS_STATE', 'QUEUED')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white" ${s?"":"disabled"}>
              <span>Set QUEUED</span>
            </button>
            <button type="button" onclick="window.tasksPower.executeBatchAction('STATUS_DONE')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-[#dcfce7] !text-[#065f46] !border-[#86efac]" ${s?"":"disabled"}>
              ${window.autumnIcons&&window.autumnIcons.svg("check")||""}<span>Mark DONE</span>
            </button>
            <span class="text-[#34d399]">|</span>
            <button type="button" onclick="window.tasksPower.executeBatchAction('SHIFT_DUE', 'TODAY')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white" ${s?"":"disabled"}>
              Due Today
            </button>
            <button type="button" onclick="window.tasksPower.executeBatchAction('SHIFT_DUE', 1)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white" ${s?"":"disabled"}>
              +1D
            </button>
            <button type="button" onclick="window.tasksPower.executeBatchAction('SHIFT_DUE', 3)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white" ${s?"":"disabled"}>
              +3D
            </button>
            <button type="button" onclick="window.tasksPower.executeBatchAction('SHIFT_DUE', 7)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-white" ${s?"":"disabled"}>
              +7D
            </button>
            <select onchange="if(this.value){ window.tasksPower.executeBatchAction('MOVE_COL', this.value); this.value=''; }" class="tech-input !w-36 !py-0.5 !px-1.5 !text-[10px] !bg-white !text-[#0c1f17]" ${s?"":"disabled"}>
              <option value="">Move Column...</option>
              ${n}
            </select>
            <button type="button" onclick="window.tasksPower.executeBatchAction('DELETE')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] !bg-[#fee2e2] !text-[#991b1b] !border-[#fca5a5]" ${s?"":"disabled"}>
              ${window.autumnIcons&&window.autumnIcons.svg("trash")||""}<span>Delete (${t})</span>
            </button>
          </div>
        </div>
      `:""}
    `}window.tasksPower={getTaskSubchecklist:d,getSubchecklistsMap:()=>r,setTaskSubchecklistsFromSync:x,toggleTaskChecklistPanel:S,addTaskChecklistItem:y,toggleTaskChecklistItem:E,deleteTaskChecklistItem:$,renderTaskChecklistBadgeHtml:D,renderTaskChecklistDrawerHtml:v,isTaskSelected:A,toggleTaskBatchSelect:O,selectAllVisibleTasks:C,clearBatchSelection:B,setTaskFilterQuery:R,setTaskFilterStatus:I,matchesTaskFilter:w,executeBatchAction:P,renderBatchMatrixBar:T}})();
