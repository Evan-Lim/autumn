async function persistManualCalendarMonths(){manualCalendarMonths=Array.from(new Set(manualCalendarMonths)).sort(),renderManualMonthsBadges(),currentUser&&await supabaseClient.from("daily_notes").upsert({date:GCAL_MANUAL_MONTHS_DATE_KEY,title:"__GCAL_MANUAL_MONTHS__",mood:"SYSTEM",content:JSON.stringify({months:manualCalendarMonths}),updated_at:new Date().toISOString()},{onConflict:"date"})}function renderManualMonthsBadges(){const e=document.getElementById("gcal-manual-months-list");if(!e)return;const t=!!currentUser;if(!manualCalendarMonths||manualCalendarMonths.length===0){e.innerHTML='<span class="font-mono-tech text-[10px] text-[#56735f]">None pinned (using \xB12M auto window)</span>';return}e.innerHTML=manualCalendarMonths.map(n=>`
    <span class="tech-badge badge-blue !text-[10px] flex items-center gap-1">
      <span> ${escapeHtml(n)}</span>
      ${t?`
        <button type="button" onclick="removeManualCalendarMonth('${n}')" class="ml-1 text-[#b91c1c] hover:font-bold" title="Delete this manually included month from Supabase">\xD7</button>
      `:""}
    </span>
  `).join("")}let calendarCacheFingerprint="";async function pruneAndSyncCalendarCacheInSupabase(e,t=!1){if(!currentUser)return;const n=getLocalDateString(new Date),l=localStorage.getItem("autumn_cal_last_prune_date"),c=t||l!==n,{minDateStr:a,maxDateStr:d}=getAutoCalendarBounds(new Date);try{if(c){const{data:o}=await supabaseClient.from("calendar_events_cache").select("event_id,date_str,month_key,is_manual_month");if(Array.isArray(o)&&o.length>0){const s=o.filter(r=>{const u=r.month_key&&manualCalendarMonths.includes(r.month_key),p=r.date_str>=a&&r.date_str<=d;return!u&&!p}).map(r=>r.event_id);s.length>0&&await supabaseClient.from("calendar_events_cache").delete().in("event_id",s)}localStorage.setItem("autumn_cal_last_prune_date",n)}const i=(e||[]).filter(o=>{const s=o.dateStr?o.dateStr.slice(0,7):"",r=s&&manualCalendarMonths.includes(s);return o.dateStr>=a&&o.dateStr<=d||r});if(i.length>0){const o=i.map(r=>{const u=r.dateStr.slice(0,7);return{event_id:r.id,title:r.title,start_time:r.start.toISOString(),end_time:r.end.toISOString(),date_str:r.dateStr,month_key:u,is_all_day:!!r.isAllDay,location:r.location||"",description:r.description||"",html_link:r.htmlLink||"",priority_color:getEventPriorityColor(r),is_manual_month:manualCalendarMonths.includes(u),updated_at:new Date().toISOString()}}),s=simpleHash(JSON.stringify(o));if(!t&&s===calendarCacheFingerprint)return;await supabaseClient.from("calendar_events_cache").upsert(o,{onConflict:"event_id"}),calendarCacheFingerprint=s}}catch(i){console.warn("Supabase calendar cache sync note:",i.message)}}async function includeManualCalendarMonth(e){if(!currentUser)return showToast("ACCESS DENIED","Sign in as autumn to manually include months in Supabase.",!0);e&&(manualCalendarMonths.includes(e)||(manualCalendarMonths.push(e),await persistManualCalendarMonths()),showToast("MONTH INCLUDED",`Fetching & pinning ${e} in Supabase...`),await fetchGoogleCalendarEvents(!0),refreshEventLinkedViews())}async function removeManualCalendarMonth(e){if(!currentUser)return showToast("ACCESS DENIED","Sign in as autumn to remove manual months.",!0);manualCalendarMonths=manualCalendarMonths.filter(t=>t!==e),await persistManualCalendarMonths(),await supabaseClient.from("calendar_events_cache").delete().eq("month_key",e),showToast("MONTH REMOVED",`Removed manual month ${e} from Supabase.`),await fetchGoogleCalendarEvents(!1),refreshEventLinkedViews()}async function setCalendarEventPriorityColor(e,t){if(!currentUser)return showToast("ACCESS DENIED","Sign in as autumn to edit event colours.",!0);if(!e||!["RED","YELLOW","GREEN"].includes(t))return;globalEventColorMap[e]=t;const n=globalCalendarEvents.find(l=>l.id===e);if(n&&(n.priorityColor=t),n){const l=n.dateStr.slice(0,7),{error:c}=await supabaseClient.from("calendar_events_cache").upsert({event_id:n.id,title:n.title,start_time:n.start.toISOString(),end_time:n.end.toISOString(),date_str:n.dateStr,month_key:l,is_all_day:!!n.isAllDay,location:n.location||"",description:n.description||"",html_link:n.htmlLink||"",priority_color:t,is_manual_month:manualCalendarMonths.includes(l),updated_at:new Date().toISOString()},{onConflict:"event_id"});if(c)showToast("DB SYNC ERROR",c.message,!0);else{const a={RED:"RED (High Priority / Class / Comp)",YELLOW:"YELLOW (Medium Priority)",GREEN:"GREEN (Low Priority / Own Plans)"};showToast("EVENT COLOUR SAVED",`Updated "${n.title}" to ${a[t]}.`)}}updateNavbarAndRadarTelemetry(),renderCalendarViewport(),typeof renderFocusMode=="function"&&renderFocusMode()}function cycleEventPriorityColor(e,t){if(t&&t.stopPropagation(),!currentUser)return showToast("READ-ONLY MODE","Sign in as autumn to change event priority colours.",!0);const n=getEventPriorityColor(e);setCalendarEventPriorityColor(e,{GREEN:"YELLOW",YELLOW:"RED",RED:"GREEN"}[n]||"GREEN")}function updateEventPriorityColorFromModal(e){if(!activeModalEventId)return;setCalendarEventPriorityColor(activeModalEventId,e),highlightModalColorButtons(e);const t=globalCalendarEvents.find(n=>n.id===activeModalEventId);t&&(document.getElementById("event-modal-status").innerHTML=getEventStatusBadge(t,new Date))}function highlightModalColorButtons(e){["RED","YELLOW","GREEN"].forEach(t=>{const n=document.getElementById(`ev-color-btn-${t}`);n&&(t===e?(n.style.outline="2px solid #0c1f17",n.style.outlineOffset="1px"):n.style.outline="none")})}onReady("gcal-config-form","submit",async e=>{if(e.preventDefault(),!currentUser)return showToast("ACCESS DENIED","Sign in as autumn to configure calendar sync.",!0);const t=document.getElementById("gcal-id-input").value.trim(),n=document.getElementById("gcal-key-input").value.trim();GOOGLE_CALENDAR_ID=t,GOOGLE_API_KEY=n;const{error:l}=await supabaseClient.from("daily_notes").upsert({date:GCAL_CONFIG_DATE_KEY,title:"__GCAL_CONFIG__",mood:"SYSTEM",content:JSON.stringify({calendarId:t,apiKey:n}),updated_at:new Date().toISOString()},{onConflict:"date"});closeModal("gcal-config-modal"),l?showToast("CONFIG WARNING","Applied for current session, but could not persist to Supabase: "+l.message,!0):showToast("CALENDAR LINKED","Google Calendar credentials saved & syncing live events."),fetchGoogleCalendarEvents(!0)});function getTasksLinkedToEvent(e){return!e||!Array.isArray(globalTaskItems)?[]:globalTaskItems.filter(t=>{const n=typeof getTaskMeta=="function"?getTaskMeta(t.id):null;return n&&n.eventId===e}).map(t=>{const n=(globalTaskColumns||[]).find(a=>a.id===t.column_id),l=getTaskMeta(t.id),c=!t.is_done&&l.dueDate&&typeof evaluateTaskDeadline=="function"?evaluateTaskDeadline(l.dueDate):null;return{task:t,col:n,meta:l,dueInfo:c}})}function buildEventLinkedTasksPillsHtml(e,t=!1){const n=getTasksLinkedToEvent(e);return n.length===0?"":t?`
      <div class="flex flex-wrap items-center gap-1 mt-1">
        ${n.map(({task:l,col:c,dueInfo:a})=>`
          <span onclick="event.stopPropagation(); closeModal('event-details-modal'); switchTab('tasks');" class="tech-badge ${l.is_done?"badge-neutral line-through":a?a.badgeClass:"badge-purple"} !text-[9px] !py-0 !px-1.5 cursor-pointer max-w-full truncate" title="Linked Task (${escapeHtml(c?c.title:"Task")}): ${escapeHtml(l.title)}">
            \u25A3 ${escapeHtml(l.title)}
          </span>
        `).join("")}
      </div>
    `:`
    <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
      ${n.map(({task:l,col:c,dueInfo:a})=>`
        <button type="button" onclick="event.stopPropagation(); switchTab('tasks');" class="tech-badge ${l.is_done?"badge-neutral line-through":a?a.badgeClass:"badge-purple"} !text-[9px] !py-0.5 !px-1.5 cursor-pointer max-w-[260px] truncate" title="Open in 04 // TASKS">
          <span>\u25A3 TASK (${escapeHtml(c?c.title:"MATRIX")}): ${escapeHtml(l.title)}</span>
        </button>
      `).join("")}
    </div>
  `}async function openEventDetails(e){window.__autumnLazy&&typeof window.__autumnLazy.ensureModalsMounted=="function"&&await window.__autumnLazy.ensureModalsMounted(),window.umAtlas&&typeof window.umAtlas.loadUmSearchIndex=="function"&&window.umAtlas.loadUmSearchIndex();const t=globalCalendarEvents.find(u=>u.id===e);if(!t)return;activeModalEventId=t.id;const n=new Date,l=getEventPriorityColor(t);highlightModalColorButtons(l),document.getElementById("event-modal-status").innerHTML=getEventStatusBadge(t,n),document.getElementById("event-modal-title").textContent=t.title;const c=t.start.toLocaleDateString("en-US",{weekday:"short",year:"numeric",month:"short",day:"numeric"});document.getElementById("event-modal-date").textContent=c,document.getElementById("event-modal-time").textContent=formatEventTimeSpan(t);const a=document.getElementById("event-modal-location-box"),d=document.getElementById("event-modal-location");t.location&&t.location.trim()!==""?(d.textContent=t.location,a.classList.remove("hidden")):a.classList.add("hidden");const i=document.getElementById("event-modal-desc"),o=getTasksLinkedToEvent(t.id),s=o.length>0?`
      <div class="mb-3 p-2.5 bg-[#f3e8ff]/60 border border-[#d8b4fe]">
        <div class="font-mono-tech text-[10px] font-bold uppercase text-[#6b21a8] mb-1.5">\u25C6 LINKED TASKS IN 04 // TASKS (${o.length})</div>
        <div class="flex flex-col gap-1.5">
          ${o.map(({task:u,col:p,dueInfo:h})=>`
            <div class="flex items-center justify-between gap-2 p-1.5 bg-white border border-[#c5ded0] text-xs font-mono-tech">
              <div class="min-w-0 flex-1">
                <span class="font-bold text-[#047857]">[${escapeHtml(p?p.title:"Task")}]</span>
                <span class="${u.is_done?"line-through text-[#56735f]":"text-[#0c1f17] font-semibold"} ml-1 break-words">${escapeHtml(u.title)}</span>
                ${h?`<span class="tech-badge ${h.badgeClass} !text-[8px] !py-0 !px-1 ml-1">${escapeHtml(h.label)}</span>`:""}
              </div>
              <button type="button" onclick="closeModal('event-details-modal'); switchTab('tasks');" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] shrink-0">Open Task \u2192</button>
            </div>
          `).join("")}
        </div>
      </div>
    `:"";t.description&&t.description.trim()!==""?(i.innerHTML=s+formatSafeCalendarHtml(t.description),i.classList.remove("text-[#56735f]","italic")):s?(i.innerHTML=s+'<div class="text-[#56735f] italic">No additional event description.</div>',i.classList.remove("text-[#56735f]","italic")):(i.textContent="No description or additional notes provided for this event.",i.classList.add("text-[#56735f]","italic"));const r=document.getElementById("event-modal-gcal-link");t.htmlLink?(r.href=t.htmlLink,r.classList.remove("hidden")):r.classList.add("hidden"),window.umAtlas&&typeof window.umAtlas.renderEventModalUmPanel=="function"&&window.umAtlas.renderEventModalUmPanel(t),openModal("event-details-modal")}let timelineDaysSpan=5;function setCalendarViewMode(e){currentCalViewMode=e,["schedule","timeline","month","week","day"].forEach(t=>{const n=document.getElementById(`cal-view-btn-${t}`);n&&(t===e?n.classList.add("active-view"):n.classList.remove("active-view"))}),renderCalendarViewport()}function setTimelineDaysSpan(e){timelineDaysSpan=e,renderCalendarViewport()}function navigateCalendarView(e){if(e===0)currentCalCursorDate=new Date;else if(currentCalViewMode==="month")currentCalCursorDate.setMonth(currentCalCursorDate.getMonth()+e);else if(currentCalViewMode==="week")currentCalCursorDate.setDate(currentCalCursorDate.getDate()+e*7);else if(currentCalViewMode==="day")currentCalCursorDate.setDate(currentCalCursorDate.getDate()+e);else if(currentCalViewMode==="timeline"){const t=typeof timelineDaysSpan=="number"?timelineDaysSpan:5;currentCalCursorDate.setDate(currentCalCursorDate.getDate()+e*t)}else currentCalCursorDate.setDate(currentCalCursorDate.getDate()+e*7);renderCalendarViewport()}function formatEventTimeSpan(e){if(e.isAllDay)return"ALL DAY";const t={hour:"2-digit",minute:"2-digit",hour12:!1};return`${e.start.toLocaleTimeString("en-US",t)} \u2013 ${e.end.toLocaleTimeString("en-US",t)}`}function formatShortAmPmSpan(e){if(e.isAllDay)return"All Day";const t=n=>{let l=n.getHours();const c=n.getMinutes(),a=l>=12?"pm":"am";return l=l%12||12,c===0?`${l}${a}`:`${l}:${String(c).padStart(2,"0")}${a}`};return`${t(e.start)} \u2013 ${t(e.end)}`}function getEventStatusBadge(e,t){const n=getEventPriorityColor(e),c=`<span class="tech-badge ${getEventPriorityTheme(e).badgeClass}" title="Priority Colour: ${n}">${n==="RED"?"\u25C6 HIGH":n==="YELLOW"?"\u25B2 MED":"\u25CF LOW"}</span>`;if(t>=e.start&&t<e.end){const d=Math.max(1,Math.floor((t-e.start)/6e4)),i=Math.max(1,Math.ceil((e.end-t)/6e4));return`${c} <span class="tech-badge badge-green">\u25CF ONGOING \u2022 ${d}m in (${i}m left)</span>`}const a=Math.ceil((e.start-t)/6e4);return a>0&&a<=60?`${c} <span class="tech-badge badge-amber">\u25B2 UPCOMING IN ${a}m</span>`:e.end<t?`${c} <span class="tech-badge badge-neutral">COMPLETED</span>`:`${c}`}function buildManualMonthControlBanner(e){const t=getMonthKeyFromDate(e);if(isMonthWithinAutoWindow(t))return"";const n=manualCalendarMonths.includes(t),l=e.toLocaleDateString("en-US",{month:"long",year:"numeric"}).toUpperCase(),c=!!currentUser;return n?`
      <div class="mb-3 p-3 bg-[#e0f2fe] border border-[#7dd3fc] flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="tech-badge badge-blue"> MANUALLY INCLUDED MONTH</span>
          <span class="text-[#0c1f17] font-semibold">${l} (${t}) is manually pinned in Supabase outside the \xB12M window.</span>
        </div>
        ${c?`
          <button type="button" onclick="removeManualCalendarMonth('${t}')" class="btn-tech-outline !py-1 !px-2.5 !text-[11px] !border-[#fca5a5] !text-[#b91c1c] hover:!bg-[#fee2e2]">
             Remove ${t} from Supabase
          </button>
        `:""}
      </div>
    `:`
    <div class="mb-3 p-3 bg-[#fef3c7] border border-[#fcd34d] flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="tech-badge badge-amber">OUTSIDE \xB12M AUTO WINDOW</span>
        <span class="text-[#78350f]"><strong>${l} (${t})</strong> is beyond 2 months from today and not auto-synced.</span>
      </div>
      ${c?`
        <button type="button" onclick="includeManualCalendarMonth('${t}')" class="btn-chamfer !py-1 !px-3 !text-xs">
          + Request &amp; Include ${t}
        </button>
      `:'<span class="text-[10px] text-[#92400e]"> Sign in as owner to request this month</span>'}
    </div>
  `}function computeStructuredDayLayout(e,t,n){const l=e.slice().sort((o,s)=>o.start.getTime()!==s.start.getTime()?o.start-s.start:s.end-s.start-(o.end-o.start)),c=[];let a=[],d=null;l.forEach(o=>{a.length===0?(a.push(o),d=o.end):o.start<d?(a.push(o),o.end>d&&(d=o.end)):(c.push(a),a=[o],d=o.end)}),a.length>0&&c.push(a);const i=[];return c.forEach(o=>{const s=[],r=o.map(p=>{let h=-1;for(let f=0;f<s.length;f++)if(s[f]<=p.start){h=f,s[f]=p.end;break}return h===-1&&(h=s.length,s.push(p.end)),{ev:p,colIndex:h}}),u=Math.max(1,s.length);r.forEach(({ev:p,colIndex:h})=>{const f=p.start.getHours()+p.start.getMinutes()/60,w=Math.max(f+.45,p.end.getDate()!==p.start.getDate()?24:p.end.getHours()+p.end.getMinutes()/60),b=Math.max(0,(f-t)*n),$=Math.max(26,(w-f)*n-2);i.push({ev:p,colIndex:h,totalCols:u,topPx:b,heightPx:$})})}),i}function renderCalendarViewport(){if(!isTabActive("calendar")){__dirtyTabs.add("calendar");return}const e=document.getElementById("calendar-main-viewport"),t=document.getElementById("cal-range-label");if(!e)return;const n=new Date,l=!!currentUser,c=buildManualMonthControlBanner(currentCalCursorDate);if(!GOOGLE_API_KEY&&globalCalendarEvents.length===0){t.textContent="Google Calendar API Key Not Configured Yet",e.innerHTML=`
      <div class="tech-grid-bg border border-dashed border-[#87b39b] p-8 text-center flex flex-col items-center justify-center min-h-[360px]">
        <span class="tech-badge badge-amber mb-2">GOOGLE CALENDAR LINK REQUIRED</span>
        <h3 class="text-base font-bold text-[#0c1f17]">Connect Your Google Calendar Events</h3>
        <p class="font-mono-tech text-xs text-[#436152] max-w-md mt-1">
          Sign in as <strong>autumn</strong> and click <strong>" Configure Google Calendar Source"</strong> on the left panel to stream your Google Calendar events automatically.
        </p>
      </div>
    `;return}if(currentCalViewMode==="schedule"){const a=new Date(currentCalCursorDate);a.setHours(0,0,0,0);const d=new Date(a);d.setDate(d.getDate()+30),t.textContent=`SCHEDULE AGENDA // ${a.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} \u2192 +30 Days`;const i=globalCalendarEvents.filter(u=>u.end>=a&&u.start<=d),o=`
      ${c}
      <div class="mb-3 p-2.5 bg-[#eff8f2] border border-[#c5ded0] flex flex-wrap items-center justify-between gap-2 font-mono-tech text-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="tech-badge badge-green">DEFAULT AGENDA</span>
          <span class="text-[#436152]">Click colour badge to cycle priority (Green \u2192 Yellow \u2192 Red)</span>
        </div>
        <button type="button" onclick="setCalendarViewMode('timeline')" class="btn-tech-outline !py-1 !px-2.5 !text-[11px]">
          Switch to Structured Timeline Grid \u229E \u2192
        </button>
      </div>
    `;if(i.length===0){e.innerHTML=`
        ${o}
        <div class="tech-grid-bg border border-[#c5ded0] p-10 text-center font-mono-tech text-xs text-[#56735f]">
          No Google Calendar events scheduled in this 30-day window.
        </div>
      `;return}const s={};i.forEach(u=>{s[u.dateStr]||(s[u.dateStr]=[]),s[u.dateStr].push(u)});const r=getLocalDateString(n);e.innerHTML=`
      ${o}
      <div class="flex flex-col gap-4">
        ${Object.keys(s).map(u=>{const p=s[u],h=new Date(u+"T00:00:00"),f=u===r,w=h.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}).toUpperCase();return`
            <div class="border ${f?"border-[#059669] bg-[#eff8f2]":"border-[#c5ded0] bg-white"}">
              <div class="px-3.5 py-2 border-b border-[#c5ded0] flex items-center justify-between flex-wrap gap-2 bg-[#f4faf6]">
                <div class="flex items-center gap-2 font-mono-tech text-xs font-bold text-[#0c1f17]">
                  <span>${w}</span>
                  ${f?'<span class="tech-badge badge-green">TODAY</span>':""}
                </div>
                <span class="font-mono-tech text-[11px] text-[#436152]">${p.length} event${p.length>1?"s":""}</span>
              </div>
              <div class="divide-y divide-[#e2efe8]">
                ${p.map(b=>{const $=getEventPriorityTheme(b);return`
                    <div style="border-left: 4px solid ${$.accent}; background-color: ${$.bg}45;" class="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#f9fdfb]">
                      <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
                        <div class="font-mono-tech text-xs font-semibold sm:w-32 shrink-0" style="color:${$.meta};">
                          ${formatEventTimeSpan(b)}
                        </div>
                        <div class="min-w-0">
                          <div class="font-bold text-sm text-[#0c1f17] break-words">${escapeHtml(b.title)}</div>
                          ${b.location||b.description?`
                            <div class="font-mono-tech text-xs text-[#436152] mt-0.5 truncate max-w-xl">
                              ${b.location?` ${escapeHtml(b.location)} `:""}${b.description?escapeHtml(stripHtmlTags(b.description).slice(0,90)):""}
                            </div>
                          `:""}
                          ${buildEventLinkedTasksPillsHtml(b.id,!1)}
                          ${window.umAtlas?window.umAtlas.buildEventUmWalkInlineHtml(b,!1):""}
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0 flex-wrap">
                        ${l?`
                          <button type="button" onclick="cycleEventPriorityColor('${jsAttrQuote(b.id)}', event)" class="touch-action-btn !text-[10px] !px-2" title="Click to cycle colour (Green / Yellow / Red)">
                             Colour
                          </button>
                        `:""}
                        ${getEventStatusBadge(b,n)}
                        <button type="button" onclick="openEventDetails('${jsAttrQuote(b.id)}')" class="btn-tech-outline !py-1 !px-2.5 !text-[11px]">
                          Details
                        </button>
                      </div>
                    </div>
                  `}).join("")}
              </div>
            </div>
          `}).join("")}
      </div>
    `;return}if(currentCalViewMode==="timeline"){const a=new Date(currentCalCursorDate);a.setHours(0,0,0,0);let d=[];if(timelineDaysSpan==="active"){const m=[];if(globalCalendarEvents.forEach(x=>{x.end>=a&&!m.includes(x.dateStr)&&m.push(x.dateStr)}),d=m.slice(0,5).map(x=>new Date(x+"T00:00:00")),d.length===0)for(let x=0;x<3;x++){const y=new Date(a);y.setDate(a.getDate()+x),d.push(y)}}else{const m=Number(timelineDaysSpan)||5;for(let x=0;x<m;x++){const y=new Date(a);y.setDate(a.getDate()+x),d.push(y)}}const i=d[0].toLocaleDateString("en-US",{month:"short",day:"numeric"}),o=d[d.length-1].toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});t.textContent=`STRUCTURED TIMELINE (12AM \u2013 12AM) // ${i} \u2013 ${o}`;const s=0,r=24,u=24,p=56,h=u*p,f=getLocalDateString(n);let w="";for(let m=s;m<=r;m++){const x=(m-s)*p,y=m===0||m===24?"12 AM":m===12?"12 PM":m>12?`${m-12} PM`:`${m} AM`;w+=`
        <div style="top: ${x}px;" class="absolute left-0 right-0 pr-1.5 text-right font-mono-tech text-[10px] font-semibold text-[#436152] ${m===0?"translate-y-0.5":m===24?"-translate-y-3.5":"-translate-y-2"} select-none">
          ${y}
        </div>
      `}let b="";for(let m=s;m<r;m++){const x=(m-s)*p;b+=`
        <div class="timeline-hour-line" style="top: ${x}px;"></div>
        <div class="timeline-half-hour-line" style="top: ${x+p/2}px;"></div>
      `}const $=e.clientWidth||window.innerWidth,E=window.innerWidth<640?250:window.innerWidth<1024?220:195,_=Math.max(1,Math.floor(($-58)/E)),k=[];for(let m=0;m<d.length;m+=_)k.push(d.slice(m,m+_));const G=m=>{const x=getLocalDateString(m),y=x===f,M=globalCalendarEvents.filter(g=>g.dateStr===x),A=M.filter(g=>g.isAllDay),R=M.filter(g=>!g.isAllDay),j=computeStructuredDayLayout(R,s,p);let H="";if(y){const C=(n.getHours()+n.getMinutes()/60-s)*p,S=n.toLocaleTimeString("en-US",{hour12:!1,hour:"2-digit",minute:"2-digit"});H=`
          <div style="top: ${C}px;" class="absolute left-0 right-0 z-30 pointer-events-none flex items-center">
            <span class="px-1 py-0.2 bg-[#0c1f17] text-[#34d399] border border-[#10b981] font-mono-tech text-[9px] font-bold tracking-tighter shadow-xs">
              \u25C6 NOW ${S}
            </span>
            <div class="flex-1 border-t-2 border-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.6)]"></div>
          </div>
        `}const B=j.map(({ev:g,colIndex:C,totalCols:S,topPx:W,heightPx:D})=>{const L=n>=g.start&&n<g.end,I=g.end<n,Y=getEventPriorityTheme(g),v=L?{bg:"#064e3b",border:"#10b981",accent:"#34d399",title:"#ffffff",meta:"#a7f3d0",pillBg:"#047857"}:Y,O=100/S,V=C*O,T=Math.max(1,Math.round((g.end-g.start)/6e4)),N=T>=60?formatHours(T/60):`${T}m`,U=stripHtmlTags(g.description||""),F=D<38,K=D>=54&&!!g.location,Q=D>=86&&!!U,z=D>=125;return`
          <div
            onclick="openEventDetails('${jsAttrQuote(g.id)}')"
            class="timeline-event-card flex flex-col justify-between ${I?"opacity-80":""}"
            style="
              top: ${W+1}px;
              height: ${D}px;
              left: calc(${V}% + 2px);
              width: calc(${O}% - 4px);
              background-color: ${v.bg};
              border: 1px solid ${v.border};
              border-left: 3px solid ${v.accent};
              color: ${v.title};
              z-index: ${10+C};
            "
            title="${escapeHtml(g.title)} (${formatEventTimeSpan(g)} \u2022 ${N})${g.location?" \u2022  "+escapeHtml(g.location):""}"
          >
            <div class="min-w-0 overflow-hidden">
              ${F?`
                <div class="flex items-center justify-between gap-1 truncate">
                  <span class="font-bold text-[11px] truncate">${escapeHtml(g.title)}</span>
                  <span class="font-mono-tech text-[9px] shrink-0" style="color: ${v.meta};">${escapeHtml(formatShortAmPmSpan(g))}</span>
                </div>
              `:`
                <div class="flex items-start justify-between gap-1">
                  <span class="font-mono-tech text-[9px] font-bold uppercase tracking-tight px-1 py-0.2 border border-current/20 shrink-0" style="background-color: ${v.pillBg}; color: ${v.meta};">
                    ${escapeHtml(formatEventTimeSpan(g))} \u2022 ${N}
                  </span>
                  ${S>1?`
                    <span class="font-mono-tech text-[8px] px-1 border border-current/20 shrink-0" style="color: ${v.meta};">
                      C${C+1}/${S}
                    </span>
                  `:""}
                </div>
                <div class="font-bold text-xs leading-snug break-words mt-1 ${D>=110?"line-clamp-3":"line-clamp-2"}">
                  ${L?'<span class="inline-block w-1.5 h-1.5 rounded-full bg-[#34d399] pulse-live mr-1"></span>':""}${escapeHtml(g.title)}
                </div>
              `}

              ${K?`
                <div class="font-mono-tech text-[10px] mt-1 truncate flex items-center gap-1" style="color: ${v.meta};">
                  <span>\u25C6</span>
                  <span class="truncate">LOC: ${escapeHtml(g.location)}</span>
                </div>
              `:""}

              ${D>=50?buildEventLinkedTasksPillsHtml(g.id,!0):""}
              ${D>=64&&window.umAtlas?window.umAtlas.buildEventUmWalkInlineHtml(g,!0):""}

              ${Q?`
                <div class="font-mono-tech text-[10px] mt-1 pt-1 border-t border-current/15 break-words ${D>=150?"line-clamp-4":"line-clamp-2"} opacity-90" style="color: ${v.meta};">
                  ${escapeHtml(U)}
                </div>
              `:""}
            </div>

            ${z?`
              <div class="flex items-center justify-between gap-1 pt-1 mt-1 border-t border-current/15 font-mono-tech text-[9px] shrink-0" style="color: ${v.meta};">
                <span>STATUS // ${L?"LIVE NOW":I?"COMPLETED":"SCHEDULED"}</span>
                <span class="underline font-bold">INSPECT \u2192</span>
              </div>
            `:""}
          </div>
        `}).join("");return`
        <div class="flex-1 min-w-0 border-l border-[#c5ded0] flex flex-col">
          <div class="p-2.5 border-b border-[#c5ded0] ${y?"bg-[#dcfce7]":"bg-[#f4faf6]"} text-center">
            <div class="flex items-center justify-center gap-1.5 font-mono-tech text-[10px] uppercase ${y?"text-[#047857] font-bold":"text-[#436152]"}">
              <span>${m.toLocaleDateString("en-US",{weekday:"short"})}</span>
              <span>\u2022</span>
              <span>${M.length} EVT</span>
            </div>
            <div class="font-mono-tech text-sm font-bold ${y?"text-[#047857]":"text-[#0c1f17]"} mt-0.5">
              ${m.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
              ${y?'<span class="ml-1 text-[9px] px-1.5 py-0.5 bg-[#0c1f17] text-[#34d399]">TODAY</span>':""}
            </div>
            ${A.length>0?`
              <div class="mt-1.5 flex flex-col gap-1">
                ${A.map(g=>{const C=getEventPriorityTheme(g);return`
                    <button type="button" onclick="openEventDetails('${jsAttrQuote(g.id)}')" style="background-color:${C.bg}; color:${C.title}; border-color:${C.accent};" class="w-full text-left px-1.5 py-0.5 border font-mono-tech text-[10px] font-bold truncate">
                      \u25C6 ALL DAY: ${escapeHtml(g.title)}
                    </button>
                  `}).join("")}
              </div>
            `:""}
          </div>

          <div class="relative w-full tech-grid-bg/40" style="height: ${h}px;">
            ${b}
            ${H}
            ${B}
          </div>
        </div>
      `},P=k.map((m,x)=>`
      <div class="timeline-grid-wrapper ${x>0?"mt-4":""}">
        <div class="flex items-stretch w-full min-w-0">
          <div class="w-12 sm:w-14 shrink-0 bg-[#f4faf6] select-none flex flex-col">
            <div class="p-2.5 border-b border-[#c5ded0] bg-[#e8f3ec] flex flex-col items-center justify-center font-mono-tech text-[9px] font-bold text-[#436152] min-h-[54px]">
              <span>UTC+8</span>
              <span class="text-[8px] text-[#047857]">24H</span>
            </div>
            <div class="relative flex-1" style="height: ${h}px;">
              ${w}
            </div>
          </div>
          <div class="flex flex-1 min-w-0">
            ${m.map(y=>G(y)).join("")}
          </div>
        </div>
      </div>
    `).join("");e.innerHTML=`
      ${c}
      <div class="mb-3 p-2.5 bg-[#eff8f2] border border-[#c5ded0] flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-wrap font-mono-tech text-xs">
          <span class="tech-badge badge-green">12AM \u2013 12AM TIMELINE</span>
          <span class="text-[#436152] text-[11px]">Click any event card to inspect or change priority colour</span>
        </div>
        <div class="flex items-center gap-1 flex-wrap">
          <span class="font-mono-tech text-[10px] uppercase text-[#436152] mr-1">Span:</span>
          <button type="button" onclick="setTimelineDaysSpan(1)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${timelineDaysSpan===1?"active-view":""}">1D</button>
          <button type="button" onclick="setTimelineDaysSpan(3)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${timelineDaysSpan===3?"active-view":""}">3D</button>
          <button type="button" onclick="setTimelineDaysSpan(5)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${timelineDaysSpan===5?"active-view":""}">5D</button>
          <button type="button" onclick="setTimelineDaysSpan(7)" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${timelineDaysSpan===7?"active-view":""}">7D</button>
          <button type="button" onclick="setTimelineDaysSpan('active')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${timelineDaysSpan==="active"?"active-view":""}" title="Show upcoming days with scheduled events">Active Days</button>
          <button type="button" onclick="setCalendarViewMode('schedule')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ml-1">List View</button>
        </div>
      </div>

      ${P}
    `;return}if(currentCalViewMode==="month"){const a=currentCalCursorDate.getFullYear(),d=currentCalCursorDate.getMonth();t.textContent=`MONTH MATRIX // ${currentCalCursorDate.toLocaleDateString("en-US",{month:"long",year:"numeric"}).toUpperCase()}`;const i=new Date(a,d,1).getDay(),o=new Date(a,d+1,0).getDate(),s=getLocalDateString(n);let r="";for(let u=0;u<i;u++)r+='<div class="min-h-[92px] bg-[#eff8f2]/50 border border-[#d5e6dc]"></div>';for(let u=1;u<=o;u++){const p=new Date(a,d,u),h=getLocalDateString(p),f=globalCalendarEvents.filter(b=>b.dateStr===h),w=h===s;r+=`
        <div onclick="inspectCalendarDay('${h}')" class="min-h-[92px] p-1.5 border ${w?"border-2 border-[#059669] bg-[#eff8f2]":"border-[#c5ded0] bg-white"} flex flex-col justify-between cursor-pointer hover:border-[#0c1f17] transition-all min-w-0">
          <div class="flex items-center justify-between font-mono-tech text-xs">
            <span class="font-bold ${w?"text-[#047857]":"text-[#0c1f17]"}">${u}</span>
            ${f.length>0?`<span class="text-[10px] text-[#047857] font-bold">${f.length}</span>`:""}
          </div>
          <div class="flex flex-col gap-1 mt-1 overflow-hidden">
            ${f.slice(0,3).map(b=>{const $=n>=b.start&&n<b.end,E=getEventPriorityTheme(b);return`
                <button type="button" onclick="event.stopPropagation(); openEventDetails('${jsAttrQuote(b.id)}')" style="${$?"":`background-color:${E.bg}; color:${E.title}; border-color:${E.border};`}" class="text-left px-1 py-0.5 text-[10px] font-mono-tech truncate border ${$?"bg-[#059669] text-white border-[#047857]":""} hover:border-[#0c1f17]" title="Click for details: ${escapeHtml(b.title)}">
                  ${escapeHtml(b.title)}
                </button>
              `}).join("")}
            ${f.length>3?`<div class="text-[9px] font-mono-tech text-[#436152]">+${f.length-3} more</div>`:""}
          </div>
        </div>
      `}e.innerHTML=`
      ${c}
      <div>
        <div class="grid grid-cols-7 gap-1.5 mb-1.5 font-mono-tech text-[11px] font-bold text-[#436152] text-center uppercase">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>
        <div class="grid grid-cols-7 gap-1.5">
          ${r}
        </div>
      </div>
    `;return}if(currentCalViewMode==="week"){const a=new Date(currentCalCursorDate);a.setDate(a.getDate()-a.getDay()),a.setHours(0,0,0,0);const d=new Date(a);d.setDate(d.getDate()+6),t.textContent=`WEEK MATRIX // ${a.toLocaleDateString("en-US",{month:"short",day:"numeric"})} \u2013 ${d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;const i=getLocalDateString(n);let o="";for(let s=0;s<7;s++){const r=new Date(a);r.setDate(a.getDate()+s);const u=getLocalDateString(r),p=u===i,h=globalCalendarEvents.filter(f=>f.dateStr===u);o+=`
        <div class="border ${p?"border-[#059669] bg-[#eff8f2]":"border-[#c5ded0] bg-white"} flex flex-col min-h-[340px] min-w-0">
          <div class="p-2 border-b border-[#c5ded0] bg-[#f4faf6] text-center font-mono-tech">
            <div class="text-[10px] uppercase text-[#436152]">${r.toLocaleDateString("en-US",{weekday:"short"})}</div>
            <div class="text-sm font-bold ${p?"text-[#047857]":"text-[#0c1f17]"}">${r.getDate()}</div>
          </div>
          <div class="p-2 flex flex-col gap-2 flex-1">
            ${h.length===0?'<div class="font-mono-tech text-[10px] text-[#56735f] text-center my-auto">\u2014</div>':h.map(f=>{const w=getEventPriorityTheme(f);return`
                    <div style="background-color:${w.bg}; border-color:${w.border}; border-left:3px solid ${w.accent};" class="p-2 border text-xs font-mono-tech flex flex-col justify-between gap-1.5">
                      <div>
                        <div class="text-[10px] font-bold" style="color:${w.meta};">${formatEventTimeSpan(f)}</div>
                        <div class="font-bold text-[#0c1f17] mt-0.5 break-words">${escapeHtml(f.title)}</div>
                        ${f.location?`<div class="text-[10px] text-[#436152] truncate mt-0.5"> ${escapeHtml(f.location)}</div>`:""}
                        ${buildEventLinkedTasksPillsHtml(f.id,!0)}
                        ${window.umAtlas?window.umAtlas.buildEventUmWalkInlineHtml(f,!0):""}
                      </div>
                      <button type="button" onclick="openEventDetails('${jsAttrQuote(f.id)}')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] w-full justify-center mt-1">
                        Details
                      </button>
                    </div>
                  `}).join("")}
          </div>
        </div>
      `}e.innerHTML=`
      ${c}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
        ${o}
      </div>
    `;return}if(currentCalViewMode==="day"){const a=getLocalDateString(currentCalCursorDate);t.textContent=`DAY TIMELINE // ${currentCalCursorDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}).toUpperCase()}`;const d=globalCalendarEvents.filter(i=>i.dateStr===a);if(d.length===0){e.innerHTML=`
        ${c}
        <div class="tech-grid-bg border border-[#c5ded0] p-12 text-center font-mono-tech text-xs text-[#56735f]">
          No events scheduled on ${a}.
        </div>
      `;return}e.innerHTML=`
      ${c}
      <div class="flex flex-col gap-3">
        ${d.map(i=>{const o=getEventPriorityTheme(i);return`
            <div style="border-left: 4px solid ${o.accent}; background-color: ${o.bg}45;" class="p-4 border border-[#c5ded0] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="font-mono-tech text-xs font-bold" style="color:${o.meta};">${formatEventTimeSpan(i)}</div>
                <h3 class="text-base font-bold text-[#0c1f17] mt-1 break-words">${escapeHtml(i.title)}</h3>
                ${i.location?`<div class="font-mono-tech text-xs text-[#436152] mt-1"> ${escapeHtml(i.location)}</div>`:""}
                ${i.description?`<div class="font-mono-tech text-xs text-[#436152] mt-1.5 line-clamp-2 break-words">${formatSafeCalendarHtml(i.description)}</div>`:""}
                ${buildEventLinkedTasksPillsHtml(i.id,!1)}
                ${window.umAtlas?window.umAtlas.buildEventUmWalkInlineHtml(i,!1):""}
              </div>
              <div class="flex items-center gap-2 shrink-0 flex-wrap">
                ${l?`
                  <button type="button" onclick="cycleEventPriorityColor('${jsAttrQuote(i.id)}', event)" class="touch-action-btn !text-[10px] !px-2">
                     Colour
                  </button>
                `:""}
                ${getEventStatusBadge(i,n)}
                <button type="button" onclick="openEventDetails('${jsAttrQuote(i.id)}')" class="btn-tech-outline !py-1 !px-2.5 !text-xs">
                  Details
                </button>
              </div>
            </div>
          `}).join("")}
      </div>
    `}}function inspectCalendarDay(e){currentCalCursorDate=new Date(e+"T00:00:00"),setCalendarViewMode("day")}window.initCalendarModule=function(){if(typeof syncOwnerPermissions=="function"&&syncOwnerPermissions(document.getElementById("tab-calendar")),window.__lastGCalSyncState){const l=document.getElementById("gcal-sync-badge");if(l&&(l.className=window.__lastGCalSyncState.badgeClass,l.textContent=window.__lastGCalSyncState.badgeText),window.__lastGCalSyncState.syncMsg){const c=document.getElementById("gcal-last-sync-text");c&&(c.textContent=window.__lastGCalSyncState.syncMsg)}}const e=document.getElementById("gcal-id-input"),t=document.getElementById("gcal-key-input"),n=!!currentUser;e&&(e.value=n&&GOOGLE_CALENDAR_ID||""),t&&(t.value=n&&GOOGLE_API_KEY||""),renderManualMonthsBadges(),updateNavbarAndRadarTelemetry(),renderCalendarViewport(),window.umAtlas&&(typeof window.umAtlas.loadUmSearchIndex=="function"&&window.umAtlas.loadUmSearchIndex(),typeof window.umAtlas.renderCalendarCommuteStrip=="function"&&window.umAtlas.renderCalendarCommuteStrip())};
