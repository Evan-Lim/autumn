// ============================================================================
// autumn // CROSS-MODULE CORRELATION MATRIX & VELOCITY SPARKLINES MODULE
// - Inline 14-day SVG velocity sparklines in Study, Steps & Focus Mode KPIs
// - Interactive 5x5 Pearson r Cross-Module Correlation Matrix (14D / 30D / ALL)
// - Lag-1 next-day cognitive/kinetic carryover & regime diagnostics
// ============================================================================

(function () {
  let corrWindowMode = '30'; // '14' | '30' | 'all'

  function buildSvgSparkline(values, strokeColor, fillColor, targetLineVal) {
    const nums = (Array.isArray(values) ? values : []).map((v) => Number(v) || 0);
    if (nums.length === 0) {
      return `<svg width="110" height="26" viewBox="0 0 110 26" class="shrink-0"><line x1="0" y1="13" x2="110" y2="13" stroke="#9fc2af" stroke-dasharray="2,2" stroke-width="1"/></svg>`;
    }
    const pts = nums.length === 1 ? [nums[0], nums[0]] : nums;
    const minVal = Math.min(0, ...pts);
    const maxVal = Math.max(targetLineVal || 1, ...pts, 1);
    const span = Math.max(0.001, maxVal - minVal);
    const w = 112;
    const h = 26;
    const pad = 2;

    const coords = pts.map((v, i) => {
      const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - minVal) / span) * (h - pad * 2);
      return [x, Math.max(pad, Math.min(h - pad, y))];
    });

    const polyPoints = coords.map((c) => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
    const areaPoints = `${coords[0][0].toFixed(1)},${h - pad} ${polyPoints} ${coords[coords.length - 1][0].toFixed(1)},${h - pad}`;

    let targetLineHtml = '';
    if (targetLineVal && targetLineVal > minVal && targetLineVal <= maxVal) {
      const ty = h - pad - ((targetLineVal - minVal) / span) * (h - pad * 2);
      targetLineHtml = `<line x1="${pad}" y1="${ty.toFixed(1)}" x2="${w - pad}" y2="${ty.toFixed(1)}" stroke="#87b39b" stroke-dasharray="2,2" stroke-width="1" />`;
    }

    const lastPt = coords[coords.length - 1];
    return `
      <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="shrink-0 overflow-visible" aria-hidden="true">
        <polygon points="${areaPoints}" fill="${fillColor}" />
        ${targetLineHtml}
        <polyline fill="none" stroke="${strokeColor}" stroke-width="1.6" points="${polyPoints}" />
        <circle cx="${lastPt[0].toFixed(1)}" cy="${lastPt[1].toFixed(1)}" r="2.3" fill="${strokeColor}" />
      </svg>
    `;
  }

  function injectSparklineIntoCard(valueElId, values, labelText, deltaText, strokeColor, fillColor, targetVal) {
    const valEl = document.getElementById(valueElId);
    if (!valEl || !valEl.parentElement) return;
    const card = valEl.closest('.metric-box');
    if (!card) return;

    let wrap = card.querySelector('.metric-sparkline-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'metric-sparkline-wrap';
      card.appendChild(wrap);
    }

    wrap.innerHTML = `
      <div class="min-w-0">
        <div class="text-[9px] uppercase font-bold text-[#436152]">${labelText}</div>
        <div class="text-[10px] font-semibold text-[#0c1f17] tnum">${deltaText}</div>
      </div>
      ${buildSvgSparkline(values, strokeColor, fillColor, targetVal)}
    `;
  }

  function renderVelocitySparklines() {
    if (typeof getPhaseActiveRows !== 'function') return;
    const activeStudy = getPhaseActiveRows(globalStudyRows || []).filter((r) => !r.is_gap_day);
    const activeSteps = getPhaseActiveRows(globalStepsRows || []).filter((r) => !r.is_gap_day);

    const last14Study = activeStudy.slice(-14).map((r) => Number(r.actual_hours) || 0);
    const last14Steps = activeSteps.slice(-14).map((r) => Number(r.actual_steps) || 0);
    const last14Yield = activeStudy.slice(-14).map((r) => {
      if (typeof computeDailyOperationalYield === 'function') {
        return computeDailyOperationalYield(r.date).score || 0;
      }
      return 0;
    });

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const study7 = avg(last14Study.slice(-7));
    const studyPrev7 = avg(last14Study.slice(0, -7));
    const studyDelta = studyPrev7 > 0 ? `${study7 >= studyPrev7 ? '+' : ''}${(study7 - studyPrev7).toFixed(1)}h vs prior 7d` : `7D mean: ${study7.toFixed(1)}h/d`;

    const steps7 = avg(last14Steps.slice(-7));
    const stepsPrev7 = avg(last14Steps.slice(0, -7));
    const stepsDelta = stepsPrev7 > 0 ? `${steps7 >= stepsPrev7 ? '+' : ''}${Math.round(steps7 - stepsPrev7).toLocaleString()} vs prior 7d` : `7D mean: ${Math.round(steps7).toLocaleString()}/d`;

    const yield7 = avg(last14Yield.slice(-7));

    // Study KPI cards
    injectSparklineIntoCard('stat-total', last14Study, '14D STUDY VELOCITY', studyDelta, '#047857', 'rgba(16, 185, 129, 0.16)', 7);
    injectSparklineIntoCard('stat-avg', last14Yield, '14D YIELD SCORE TREND', `7D mean: ${yield7.toFixed(1)} pts`, '#0284c7', 'rgba(2, 132, 199, 0.14)', 95);
    injectSparklineIntoCard(
      'stat-best',
      activeStudy.slice(-14).map((r) => -(Number(r.computed_overflow) || 0)),
      '14D SURPLUS / DEBT CHAIN',
      activeStudy.length ? `Bal: ${(-(Number(activeStudy[activeStudy.length - 1].computed_overflow) || 0)).toFixed(1)}h` : '0.0h',
      '#d97706',
      'rgba(245, 158, 11, 0.15)',
      0
    );

    // Steps KPI cards
    injectSparklineIntoCard('steps-stat-total', last14Steps, '14D STEP VELOCITY', stepsDelta, '#047857', 'rgba(16, 185, 129, 0.16)', 10000);
    injectSparklineIntoCard('steps-stat-avg', last14Steps.slice(-7), '7D KINETIC PULSE', `Mean: ${Math.round(steps7).toLocaleString()} steps`, '#0284c7', 'rgba(2, 132, 199, 0.14)', 10000);
    injectSparklineIntoCard(
      'steps-stat-best',
      activeSteps.slice(-14).map((r) => -(Number(r.computed_overflow) || 0)),
      '14D STEP SURPLUS / DEBT',
      activeSteps.length ? `Bal: ${Math.round(-(Number(activeSteps[activeSteps.length - 1].computed_overflow) || 0)).toLocaleString()}` : '0',
      '#d97706',
      'rgba(245, 158, 11, 0.15)',
      0
    );
  }

  function setCorrelationMatrixWindow(mode) {
    corrWindowMode = mode || '30';
    renderCorrelationMatrix();
  }

  function renderCorrelationMatrix() {
    const host = document.getElementById('cross-module-corr-matrix');
    if (!host || typeof getPhaseActiveRows !== 'function') return;

    const activeStudy = getPhaseActiveRows(globalStudyRows || []).filter((r) => !r.is_gap_day);
    const activeSteps = getPhaseActiveRows(globalStepsRows || []).filter((r) => !r.is_gap_day);

    const studyMap = {};
    activeStudy.forEach((r) => { studyMap[r.date] = r; });
    const stepsMap = {};
    activeSteps.forEach((r) => { stepsMap[r.date] = r; });

    const allDates = Array.from(new Set(Object.keys(studyMap).concat(Object.keys(stepsMap)))).sort();
    const limit = corrWindowMode === '14' ? 14 : corrWindowMode === '30' ? 30 : allDates.length;
    const windowDates = allDates.slice(-Math.max(1, limit));

    const series = {
      study: [],
      steps: [],
      yieldScore: [],
      surplus: [],
      consistency: []
    };

    windowDates.forEach((d, idx) => {
      const sRow = studyMap[d];
      const stRow = stepsMap[d];
      const sHours = sRow ? Number(sRow.actual_hours) || 0 : 0;
      const stCount = stRow ? Number(stRow.actual_steps) || 0 : 0;
      const yObj = typeof computeDailyOperationalYield === 'function' ? computeDailyOperationalYield(d) : { score: 0 };
      const sBase = typeof getStudyBaseGoalForDate === 'function' ? getStudyBaseGoalForDate(d) : 7;
      const stBase = typeof getStepsBaseGoalForDate === 'function' ? getStepsBaseGoalForDate(d) : 10000;

      // Rolling 7d hit ratio up to day idx
      const subDates = windowDates.slice(Math.max(0, idx - 6), idx + 1);
      let hits = 0;
      subDates.forEach((sd) => {
        const sh = studyMap[sd] ? Number(studyMap[sd].actual_hours) || 0 : 0;
        const st = stepsMap[sd] ? Number(stepsMap[sd].actual_steps) || 0 : 0;
        if (sh >= (typeof getStudyBaseGoalForDate === 'function' ? getStudyBaseGoalForDate(sd) : 7) * 0.9 &&
            st >= (typeof getStepsBaseGoalForDate === 'function' ? getStepsBaseGoalForDate(sd) : 10000) * 0.9) {
          hits += 1;
        }
      });

      series.study.push(sHours);
      series.steps.push(stCount);
      series.yieldScore.push(Number(yObj.score) || 0);
      series.surplus.push((sHours - sBase) + ((stCount - stBase) / 2000));
      series.consistency.push(subDates.length ? (hits / subDates.length) * 100 : 0);
    });

    const dims = [
      { key: 'study', label: 'STUDY (H)' },
      { key: 'steps', label: 'STEPS (N)' },
      { key: 'yieldScore', label: 'YIELD (PTS)' },
      { key: 'surplus', label: 'NET SURPLUS' },
      { key: 'consistency', label: '7D HIT %' }
    ];

    const corrFn = (a, b) => {
      if (typeof calcPearsonCorrelation === 'function' && a.length >= 2) {
        return calcPearsonCorrelation(a, b);
      }
      return 0;
    };

    const cellTone = (r, isDiag) => {
      if (isDiag) return 'bg-[#d5e6dc] text-[#0c1f17]';
      if (r >= 0.5) return 'bg-[#dcfce7] text-[#065f46]';
      if (r >= 0.2) return 'bg-[#eff8f2] text-[#047857]';
      if (r <= -0.4) return 'bg-[#fee2e2] text-[#991b1b]';
      if (r <= -0.15) return 'bg-[#fef3c7] text-[#92400e]';
      return 'bg-white text-[#436152]';
    };

    // Lag-1 correlation: Steps(t-1) -> Study(t)
    let lagStepsToStudy = 0;
    if (series.steps.length >= 4) {
      lagStepsToStudy = corrFn(series.steps.slice(0, -1), series.study.slice(1));
    }

    const matrixRowsHtml = dims.map((rowDim, rIdx) => {
      const cells = dims.map((colDim, cIdx) => {
        const isDiag = rIdx === cIdx;
        const r = isDiag ? 1.0 : corrFn(series[rowDim.key], series[colDim.key]);
        const formatted = isDiag ? '1.00' : (r >= 0 ? '+' : '') + r.toFixed(2);
        return `<td class="corr-cell ${cellTone(r, isDiag)}">${formatted}</td>`;
      }).join('');
      return `
        <tr>
          <th class="text-left font-bold text-[10px] px-2 py-1.5 bg-[#f4faf6] border border-[#c5ded0] whitespace-nowrap">${rowDim.label}</th>
          ${cells}
        </tr>
      `;
    }).join('');

    host.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div>
          <div class="section-tag"><span class="diamond">◆</span> 5×5 CROSS-MODULE PEARSON CORRELATION MATRIX (n = ${windowDates.length}d)</div>
          <p class="text-[11px] text-[#436152] mt-0.5">
            Multi-variable coupling across Study Hours, Step Volume, Operational Yield, Quota Surplus &amp; 7D Consistency
          </p>
        </div>
        <div class="flex items-center gap-1 bg-[#e8f3ec] p-0.5 border border-[#c5ded0]">
          <button type="button" onclick="window.analyticsMatrix.setCorrelationMatrixWindow('14')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${corrWindowMode === '14' ? 'active-view' : ''}">14D</button>
          <button type="button" onclick="window.analyticsMatrix.setCorrelationMatrixWindow('30')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${corrWindowMode === '30' ? 'active-view' : ''}">30D</button>
          <button type="button" onclick="window.analyticsMatrix.setCorrelationMatrixWindow('all')" class="btn-tech-outline !py-0.5 !px-2 !text-[10px] ${corrWindowMode === 'all' ? 'active-view' : ''}">ALL</button>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-3 items-center">
        <div class="xl:col-span-8 overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr>
                <th class="text-left text-[9px] uppercase text-[#436152] px-2 py-1 bg-[#e8f3ec] border border-[#c5ded0]">VARIABLE</th>
                ${dims.map((d) => `<th class="text-center text-[9px] uppercase text-[#0c1f17] px-2 py-1 bg-[#e8f3ec] border border-[#c5ded0] whitespace-nowrap">${d.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${matrixRowsHtml}
            </tbody>
          </table>
        </div>
        <div class="xl:col-span-4 flex flex-col gap-2">
          <div class="p-2.5 bg-[#eff8f2] border border-[#c5ded0] text-xs">
            <div class="text-[10px] font-bold uppercase text-[#047857]">◆ LAG-1 CARRYOVER (STEPS t-1 → STUDY t)</div>
            <div class="text-base font-bold text-[#0c1f17] mt-0.5 tnum">r = ${lagStepsToStudy >= 0 ? '+' : ''}${lagStepsToStudy.toFixed(2)}</div>
            <div class="text-[10px] text-[#436152] mt-0.5">
              ${lagStepsToStudy >= 0.15
                ? 'Positive kinetic carryover: higher step days precede stronger next-day study sessions.'
                : lagStepsToStudy <= -0.15
                  ? 'Inverse fatigue carryover: high physical volume slightly dips next-day study hours.'
                  : 'Neutral carryover: next-day study output is independent of prior-day step count.'}
            </div>
          </div>
          <div class="p-2.5 bg-white border border-[#c5ded0] text-[10px] text-[#436152] flex items-center justify-between gap-2">
            <span><strong class="text-[#065f46]">■ +0.50+</strong> Strong Synergy</span>
            <span><strong class="text-[#436152]">■ ±0.15</strong> Decoupled</span>
            <span><strong class="text-[#991b1b]">■ -0.40-</strong> Trade-off</span>
          </div>
        </div>
      </div>
    `;
  }

  function refreshAllAnalytics() {
    renderVelocitySparklines();
    renderCorrelationMatrix();
  }

  window.analyticsMatrix = {
    renderVelocitySparklines,
    renderCorrelationMatrix,
    setCorrelationMatrixWindow,
    refreshAllAnalytics
  };
})();
