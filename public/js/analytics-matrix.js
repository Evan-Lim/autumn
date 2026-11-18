(function(){let g="30";function R(u,y,f,c){const e=(Array.isArray(u)?u:[]).map(d=>Number(d)||0);if(e.length===0)return'<svg width="110" height="26" viewBox="0 0 110 26" class="shrink-0"><line x1="0" y1="13" x2="110" y2="13" stroke="#9fc2af" stroke-dasharray="2,2" stroke-width="1"/></svg>';const o=e.length===1?[e[0],e[0]]:e,n=Math.min(0,...o),i=Math.max(c||1,...o,1),r=Math.max(.001,i-n),s=112,l=26,a=2,b=o.map((d,v)=>{const w=a+v/(o.length-1)*(s-a*2),m=l-a-(d-n)/r*(l-a*2);return[w,Math.max(a,Math.min(l-a,m))]}),x=b.map(d=>`${d[0].toFixed(1)},${d[1].toFixed(1)}`).join(" "),_=`${b[0][0].toFixed(1)},${l-a} ${x} ${b[b.length-1][0].toFixed(1)},${l-a}`;let t="";if(c&&c>n&&c<=i){const d=l-a-(c-n)/r*(l-a*2);t=`<line x1="${a}" y1="${d.toFixed(1)}" x2="${s-a}" y2="${d.toFixed(1)}" stroke="#87b39b" stroke-dasharray="2,2" stroke-width="1" />`}const p=b[b.length-1];return`
      <svg width="${s}" height="${l}" viewBox="0 0 ${s} ${l}" class="shrink-0 overflow-visible" aria-hidden="true">
        <polygon points="${_}" fill="${f}" />
        ${t}
        <polyline fill="none" stroke="${y}" stroke-width="1.6" points="${x}" />
        <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.3" fill="${y}" />
      </svg>
    `}function h(u,y,f,c,e,o,n){const i=document.getElementById(u);if(!i||!i.parentElement)return;const r=i.closest(".metric-box");if(!r)return;let s=r.querySelector(".metric-sparkline-wrap");s||(s=document.createElement("div"),s.className="metric-sparkline-wrap",r.appendChild(s)),s.innerHTML=`
      <div class="min-w-0">
        <div class="text-[9px] uppercase font-bold text-[#436152]">${f}</div>
        <div class="text-[10px] font-semibold text-[#0c1f17] tnum">${c}</div>
      </div>
      ${R(y,e,o,n)}
    `}function E(){if(typeof getPhaseActiveRows!="function")return;const u=typeof activeTabName<"u"?activeTabName:"study",y=u==="study",f=u==="steps";if(!y&&!f){typeof window.__markAutumnTabDirty=="function"&&(window.__markAutumnTabDirty("study"),window.__markAutumnTabDirty("steps"));return}const c=e=>e.length?e.reduce((o,n)=>o+n,0)/e.length:0;if(y){const e=getPhaseActiveRows(globalStudyRows||[]).filter(a=>!a.is_gap_day),o=e.slice(-14).map(a=>Number(a.actual_hours)||0),n=e.slice(-14).map(a=>typeof computeDailyOperationalYield=="function"&&computeDailyOperationalYield(a.date).score||0),i=c(o.slice(-7)),r=c(o.slice(0,-7)),s=r>0?`${i>=r?"+":""}${(i-r).toFixed(1)}h vs prior 7d`:`7D mean: ${i.toFixed(1)}h/d`,l=c(n.slice(-7));h("stat-total",o,"14D STUDY VELOCITY",s,"#047857","rgba(16, 185, 129, 0.16)",7),h("stat-avg",n,"14D YIELD SCORE TREND",`7D mean: ${l.toFixed(1)} pts`,"#0284c7","rgba(2, 132, 199, 0.14)",95),h("stat-best",e.slice(-14).map(a=>-(Number(a.computed_overflow)||0)),"14D SURPLUS / DEBT CHAIN",e.length?`Bal: ${(-(Number(e[e.length-1].computed_overflow)||0)).toFixed(1)}h`:"0.0h","#d97706","rgba(245, 158, 11, 0.15)",0)}else typeof window.__markAutumnTabDirty=="function"&&window.__markAutumnTabDirty("study");if(f){const e=getPhaseActiveRows(globalStepsRows||[]).filter(s=>!s.is_gap_day),o=e.slice(-14).map(s=>Number(s.actual_steps)||0),n=c(o.slice(-7)),i=c(o.slice(0,-7)),r=i>0?`${n>=i?"+":""}${Math.round(n-i).toLocaleString()} vs prior 7d`:`7D mean: ${Math.round(n).toLocaleString()}/d`;h("steps-stat-total",o,"14D STEP VELOCITY",r,"#047857","rgba(16, 185, 129, 0.16)",1e4),h("steps-stat-avg",o.slice(-7),"7D KINETIC PULSE",`Mean: ${Math.round(n).toLocaleString()} steps`,"#0284c7","rgba(2, 132, 199, 0.14)",1e4),h("steps-stat-best",e.slice(-14).map(s=>-(Number(s.computed_overflow)||0)),"14D STEP SURPLUS / DEBT",e.length?`Bal: ${Math.round(-(Number(e[e.length-1].computed_overflow)||0)).toLocaleString()}`:"0","#d97706","rgba(245, 158, 11, 0.15)",0)}else typeof window.__markAutumnTabDirty=="function"&&window.__markAutumnTabDirty("steps")}function F(u){g=u||"30",D()}function D(){if((typeof activeTabName<"u"?activeTabName:"study")!=="study"){typeof window.__markAutumnTabDirty=="function"&&window.__markAutumnTabDirty("study");return}const y=document.getElementById("cross-module-corr-matrix");if(!y||typeof getPhaseActiveRows!="function")return;const f=getPhaseActiveRows(globalStudyRows||[]).filter(t=>!t.is_gap_day),c=getPhaseActiveRows(globalStepsRows||[]).filter(t=>!t.is_gap_day),e={};f.forEach(t=>{e[t.date]=t});const o={};c.forEach(t=>{o[t.date]=t});const n=Array.from(new Set(Object.keys(e).concat(Object.keys(o)))).sort(),i=g==="14"?14:g==="30"?30:n.length,r=n.slice(-Math.max(1,i)),s={study:[],steps:[],yieldScore:[],surplus:[],consistency:[]};r.forEach((t,p)=>{const d=e[t],v=o[t],w=d&&Number(d.actual_hours)||0,m=v&&Number(v.actual_steps)||0,$=typeof computeDailyOperationalYield=="function"?computeDailyOperationalYield(t):{score:0},k=typeof getStudyBaseGoalForDate=="function"?getStudyBaseGoalForDate(t):7,P=typeof getStepsBaseGoalForDate=="function"?getStepsBaseGoalForDate(t):1e4,A=r.slice(Math.max(0,p-6),p+1);let M=0;A.forEach(S=>{const B=e[S]&&Number(e[S].actual_hours)||0,C=o[S]&&Number(o[S].actual_steps)||0;B>=(typeof getStudyBaseGoalForDate=="function"?getStudyBaseGoalForDate(S):7)*.9&&C>=(typeof getStepsBaseGoalForDate=="function"?getStepsBaseGoalForDate(S):1e4)*.9&&(M+=1)}),s.study.push(w),s.steps.push(m),s.yieldScore.push(Number($.score)||0),s.surplus.push(w-k+(m-P)/2e3),s.consistency.push(A.length?M/A.length*100:0)});const l=[{key:"study",label:"STUDY (H)"},{key:"steps",label:"STEPS (N)"},{key:"yieldScore",label:"YIELD (PTS)"},{key:"surplus",label:"NET SURPLUS"},{key:"consistency",label:"7D HIT %"}],a=(t,p)=>typeof calcPearsonCorrelation=="function"&&t.length>=2?calcPearsonCorrelation(t,p):0,b=(t,p)=>p?"bg-[#d5e6dc] text-[#0c1f17]":t>=.5?"bg-[#dcfce7] text-[#065f46]":t>=.2?"bg-[#eff8f2] text-[#047857]":t<=-.4?"bg-[#fee2e2] text-[#991b1b]":t<=-.15?"bg-[#fef3c7] text-[#92400e]":"bg-white text-[#436152]";let x=0;s.steps.length>=4&&(x=a(s.steps.slice(0,-1),s.study.slice(1)));const _=l.map((t,p)=>{const d=l.map((v,w)=>{const m=p===w,$=m?1:a(s[t.key],s[v.key]),k=m?"1.00":($>=0?"+":"")+$.toFixed(2);return`<td class="corr-cell ${b($,m)}">${k}</td>`}).join("");return`
        <tr>
          <th class="text-left font-bold text-[10px] px-2 py-1.5 bg-[#f4faf6] border border-[#c5ded0] whitespace-nowrap">${t.label}</th>
          ${d}
        </tr>
      `}).join("");y.innerHTML=`
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div>
          <div class="section-tag"><span class="diamond">\u25C6</span> 5\xD75 CROSS-MODULE PEARSON CORRELATION MATRIX (n = ${r.length}d)</div>
          <p class="text-[11px] text-[#436152] mt-0.5">
            Multi-variable coupling across Study Hours, Step Volume, Operational Yield, Quota Surplus &amp; 7D Consistency
          </p>
        </div>
        <div class="flex items-center gap-1 bg-[#e8f3ec] p-0.5 border border-[#c5ded0]">
          <button type="button" onclick="window.analyticsMatrix.setCorrelationMatrixWindow('14')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${g==="14"?"active-view":""}">14D</button>
          <button type="button" onclick="window.analyticsMatrix.setCorrelationMatrixWindow('30')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${g==="30"?"active-view":""}">30D</button>
          <button type="button" onclick="window.analyticsMatrix.setCorrelationMatrixWindow('all')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${g==="all"?"active-view":""}">ALL</button>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-3 items-center">
        <div class="xl:col-span-8 overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr>
                <th class="text-left text-[9px] uppercase text-[#436152] px-2 py-1 bg-[#e8f3ec] border border-[#c5ded0]">VARIABLE</th>
                ${l.map(t=>`<th class="text-center text-[9px] uppercase text-[#0c1f17] px-2 py-1 bg-[#e8f3ec] border border-[#c5ded0] whitespace-nowrap">${t.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${_}
            </tbody>
          </table>
        </div>
        <div class="xl:col-span-4 flex flex-col gap-2">
          <div class="p-2.5 bg-[#eff8f2] border border-[#c5ded0] text-xs">
            <div class="text-[10px] font-bold uppercase text-[#047857]">\u25C6 LAG-1 CARRYOVER (STEPS t-1 \u2192 STUDY t)</div>
            <div class="text-base font-bold text-[#0c1f17] mt-0.5 tnum">r = ${x>=0?"+":""}${x.toFixed(2)}</div>
            <div class="text-[10px] text-[#436152] mt-0.5">
              ${x>=.15?"Positive kinetic carryover: higher step days precede stronger next-day study sessions.":x<=-.15?"Inverse fatigue carryover: high physical volume slightly dips next-day study hours.":"Neutral carryover: next-day study output is independent of prior-day step count."}
            </div>
          </div>
          <div class="p-2.5 bg-white border border-[#c5ded0] text-[10px] text-[#436152] flex items-center justify-between gap-2">
            <span><strong class="text-[#065f46]">\u25A0 +0.50+</strong> Strong Synergy</span>
            <span><strong class="text-[#436152]">\u25A0 \xB10.15</strong> Decoupled</span>
            <span><strong class="text-[#991b1b]">\u25A0 -0.40-</strong> Trade-off</span>
          </div>
        </div>
      </div>
    `}let T=0;function N(){if(T)return;const u=()=>{T=0,E(),D()};typeof requestAnimationFrame=="function"?T=requestAnimationFrame(u):u()}window.analyticsMatrix={renderVelocitySparklines:E,renderCorrelationMatrix:D,setCorrelationMatrixWindow:F,refreshAllAnalytics:N}})();
