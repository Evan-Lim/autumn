// ============================================================================
// autumn // 02 STEPS MODULE (lazy-loaded on demand)
// ============================================================================

function adjustStepInput(amount) {
  const input = document.getElementById('steps-count-input');
  if (amount === 10000 && !input.value) {
    input.value = 10000;
  } else {
    input.value = (parseInt(input.value, 10) || 0) + amount;
  }
}

function computeMonthlyStepsWithBonus(rows, refDateObj) {
  let y = refDateObj.getFullYear();
  let m = refDateObj.getMonth(); // 0 = Jan ... 9 = Oct, 10 = Nov
  if (y < 2026 || (y === 2026 && m < 10)) {
    y = 2026;
    m = 10; // November 2026
  }

  const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
  const prevDate = new Date(y, m - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const monthName = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  let baseMonthSteps = 0;
  let bonusStepsFromPrevEnd = 0;

  (rows || []).forEach(r => {
    const stp = Number(r.actual_steps) || 0;
    if (r.date.startsWith(monthKey)) {
      baseMonthSteps += stp;
    } else if (r.date.startsWith(prevMonthKey) && isLastTwoDaysOfMonth(r.date)) {
      bonusStepsFromPrevEnd += stp;
    }
  });

  return {
    monthKey,
    monthName,
    baseMonthSteps,
    bonusSteps: bonusStepsFromPrevEnd,
    totalMonthlySteps: baseMonthSteps + bonusStepsFromPrevEnd
  };
}

function updateStepsStats(allRows) {
  const monthlyInfo = computeMonthlyStepsWithBonus(allRows, currentStepsCalDate);
  const lblEl = document.getElementById('steps-stat-total-label');
  const bonusEl = document.getElementById('steps-stat-bonus-pill');
  const subEl = document.getElementById('steps-stat-total-sub');
  const cumNovBadge = document.getElementById('steps-cum-nov-badge');

  // Secondary total: cumulative steps from Nov 2026 onwards (including Oct 30–31 carryover bonus)
  const cumFromNovSteps = (allRows || [])
    .filter(r => r.date >= CARRYOVER_WINDOW_START_DATE)
    .reduce((acc, r) => acc + (Number(r.actual_steps) || 0), 0);

  if (lblEl) lblEl.textContent = `MONTHLY STEPS (${monthlyInfo.monthName})`;
  if (bonusEl) {
    bonusEl.textContent = `+${formatStepsCompact(monthlyInfo.bonusSteps) || '0'} bonus`;
  }
  if (subEl) {
    subEl.textContent = `${formatSteps(monthlyInfo.baseMonthSteps)} in-month + ${formatSteps(monthlyInfo.bonusSteps)} 2d bonus • Since Nov: ${formatSteps(cumFromNovSteps)}`;
  }
  if (cumNovBadge) {
    cumNovBadge.textContent = `TOTAL FROM NOV 2026: ${formatSteps(cumFromNovSteps)}`;
  }

  const rows = getPhaseActiveRows(allRows);
  // Exclude synthetic gap rows from the per-session statistics (see updateStudyStats).
  const loggedRows = rows.filter(r => !r.is_gap_day);
  const phaseTotal = rows.reduce((acc, r) => acc + (Number(r.actual_steps) || 0), 0);
  const displayTotal = monthlyInfo.totalMonthlySteps > 0 ? monthlyInfo.totalMonthlySteps : phaseTotal;
  document.getElementById('steps-stat-total').textContent = formatSteps(displayTotal);

  if (loggedRows.length === 0) {
    document.getElementById('steps-stat-avg').textContent = "0";
    document.getElementById('steps-stat-best').textContent = "0";
    return;
  }
  let totalSteps = 0;
  let bestDay = 0;
  loggedRows.forEach(r => {
    totalSteps += r.actual_steps;
    if (r.actual_steps > bestDay) bestDay = r.actual_steps;
  });
  const avg = totalSteps / loggedRows.length;
  document.getElementById('steps-stat-avg').textContent = formatSteps(avg);
  document.getElementById('steps-stat-best').textContent = formatSteps(bestDay);
}

function updateStepsCalendar(rows) {
  updateStepsStats(rows);
  const container = document.getElementById('steps-calendar-grid');
  container.innerHTML = '';

  const dataMap = {};
  getPhaseActiveRows(rows).forEach(r => dataMap[r.date] = r.actual_steps);

  const currentMonth = currentStepsCalDate.getMonth();
  const currentYear = currentStepsCalDate.getFullYear();

  document.getElementById('steps-month-display').textContent =
    currentStepsCalDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  const todayStr = getLocalDateString(new Date());
  const firstDay = new Date(currentYear, currentMonth, 1);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  let weekCounter = 1;

  for (let i = 0; i < startingDayOfWeek; i++) {
    if (i === 0) {
      const weekLabel = document.createElement('div');
      weekLabel.className = 'cal-week-label';
      weekLabel.textContent = `W${weekCounter}`;
      container.appendChild(weekLabel);
    }
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'cal-day-box empty';
    container.appendChild(emptyDiv);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(currentYear, currentMonth, day);
    const dateString = getLocalDateString(d);
    const steps = dataMap[dateString] || 0;
    const dayOfWeek = d.getDay();

    if (dayOfWeek === 0) {
      const weekLabel = document.createElement('div');
      weekLabel.className = 'cal-week-label';
      weekLabel.textContent = `W${weekCounter}`;
      container.appendChild(weekLabel);
      weekCounter++;
    }

    const dayBox = document.createElement('div');
    dayBox.className = 'cal-day-box';
    dayBox.title = `${dateString}: ${formatSteps(steps)} steps`;

    if (dateString === todayStr) dayBox.classList.add('today');

    if (steps === 0) dayBox.classList.add('level-0');
    else if (steps < 5000) dayBox.classList.add('level-1');
    else if (steps < 7500) dayBox.classList.add('level-2');
    else if (steps < 10000) dayBox.classList.add('level-3');
    else dayBox.classList.add('level-4');

    const stepLabel = formatStepsCompact(steps);
    dayBox.innerHTML = `
      <span class="cal-date-num">${day}</span>
      ${stepLabel ? `<span class="cal-time-text">${stepLabel}</span>` : ''}
    `;
    container.appendChild(dayBox);
  }
}

function updateStepsTodayDisplay(rows) {
  const todayStr = getLocalDateString(new Date());
  const activeRows = getPhaseActiveRows(rows);
  const todayRow = activeRows.find(r => r.date === todayStr);
  const todayBaseGoal = getStepsBaseGoalForDate(todayStr);
  const actual = todayRow ? todayRow.actual_steps : 0;

  let target = todayBaseGoal;
  let overflow = 0;

  if (todayRow) {
    target = todayRow.computed_target;
    overflow = todayRow.computed_overflow;
  } else {
    const lastRow = getLatestLedgerRowUpTo(activeRows, todayStr);
    if (lastRow) {
      const lastDebt = Number(lastRow.computed_overflow) || 0;
      target = computeOverflowStep(todayBaseGoal, lastDebt, null, STEPS_MAX_DAILY).target;
      overflow = lastDebt;
    }
  }

  document.getElementById('steps-today-target').textContent = formatSteps(target);

  let overflowText = overflow > 0 ? `DEBT: +${formatSteps(overflow)}`
                   : overflow < 0 ? `SURPLUS: ${formatSteps(overflow)}`
                   : `ON TRACK`;

  const phaseTag = isCarryoverWindowDate(todayStr)
    ? ' // CARRIES OVER TO NOV 1'
    : !isOfficialLedgerDate(todayStr)
      ? ' // TESTING PHASE'
      : '';

  document.getElementById('steps-today-actual').textContent =
    `actual: ${formatSteps(actual)} steps (base ${formatSteps(todayBaseGoal)}) // ${overflowText}${phaseTag}`;
}

function updateStepsTable(rows) {
  lastStepsTableRows = rows;
  const tbody = document.querySelector('#steps-ledger-table tbody');
  tbody.innerHTML = '';

  const activeRows = getPhaseActiveRows(rows);
  if (activeRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-[#56735f]">No step days logged yet.</td></tr>`;
    updateLedgerWindowButtons();
    return;
  }

  // Windowing keeps the DOM small on long phases (see toggleLedgerWindow above).
  const reversedRows = applyLedgerWindow([...activeRows].reverse());
  updateLedgerWindowButtons();
  const frag = document.createDocumentFragment();
  reversedRows.forEach(row => {
    const tr = document.createElement('tr');
    const isPassUsed = row.source === 'pass_redeemed' || (typeof isPassUsedOnDate === 'function' && isPassUsedOnDate(row.date, 'steps'));
    if (isPassUsed) {
      tr.className = 'bg-[#fef3c7]/65 border-l-4 border-l-[#f59e0b]';
    }

    let badgeHtml = '';
    const carryTag = row.is_carryover ? ` <span class="tech-badge badge-blue !text-[9px]">→ NOV CARRYOVER</span>` : '';
    const passUsedTag = isPassUsed ? ` <span class="tech-badge badge-amber !text-[9px]">PASS USED (INELIGIBLE)</span>` : '';
    const gapTag = row.is_gap_day ? ` <span class="tech-badge badge-neutral !text-[9px]" title="No steps recorded for this day — its base goal was added to your debt">○ NO LOG</span>` : '';

    if (row.computed_overflow > 0) {
      badgeHtml = `<span class="tech-badge badge-red">DEBT +${formatSteps(row.computed_overflow)}</span>${carryTag}${passUsedTag}${gapTag}`;
    } else if (row.computed_overflow < 0) {
      badgeHtml = `<span class="tech-badge badge-green">SURPLUS ${formatSteps(row.computed_overflow)}</span>${carryTag}${passUsedTag}${gapTag}`;
    } else {
      badgeHtml = `<span class="tech-badge badge-blue">ON TRACK</span>${carryTag}${passUsedTag}${gapTag}`;
    }

    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${formatSteps(row.actual_steps)}</td>
      <td>${formatSteps(row.computed_target)}</td>
      <td class="flex flex-wrap items-center gap-1">${badgeHtml}</td>
    `;
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  if (window.umAtlas && typeof window.umAtlas.attachLedgerInlineEditing === 'function') {
    window.umAtlas.attachLedgerInlineEditing('steps');
  }
}

// Steps twin of updateStudyPredictions(): target capped at STEPS_MAX_DAILY, debt uncapped,
// and today's already-logged row is treated as authoritative.
function updateStepsPredictions(rows) {
  const tbody = document.querySelector('#steps-prediction-table tbody');
  tbody.innerHTML = '';

  const activeRows = getPhaseActiveRows(rows);
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const todayRow = activeRows.find(r => r.date === todayStr) || null;
  const latestRow = getLatestLedgerRowUpTo(activeRows, todayStr);

  let currentOverflow = latestRow ? (Number(latestRow.computed_overflow) || 0) : 0;

  for (let i = 0; i < 7; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + i);
    const dateStr = getLocalDateString(futureDate);
    const dayBaseGoal = getStepsBaseGoalForDate(futureDate);

    let target;
    if (i === 0 && todayRow) {
      const loggedTarget = Number(todayRow.computed_target);
      target = Number.isFinite(loggedTarget) ? loggedTarget : dayBaseGoal;
      currentOverflow = Number(todayRow.computed_overflow) || 0;
    } else {
      // Forecast variant: assume the target is met (actual === target).
      const step = computeOverflowStep(dayBaseGoal, currentOverflow, null, STEPS_MAX_DAILY);
      target = step.target;
      currentOverflow = step.overflow;
    }

    const tr = document.createElement('tr');
    const dayName = i === 0 ? "TODAY" : i === 1 ? "TOMORROW" : futureDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

    tr.innerHTML = `
      <td>${dayName} <span class="text-[#56735f]">(${dateStr.slice(5)})</span></td>
      <td class="text-right font-bold text-[#047857]">${formatSteps(target)}</td>
    `;
    tbody.appendChild(tr);
  }
}


function updateStepsChart(allRows) {
  if (!isTabActive("steps")) {
    __dirtyTabs.add("steps");
    return;
  }
  if (!window.AutumnCharts || typeof window.AutumnCharts.renderCumulativeChart !== "function") return;
  const rows = getPhaseActiveRows(allRows);
  const labels = rows.map(r => r.date.slice(5));
  const expectedCumulative = [];
  const actualCumulative = [];
  const idealCumulative = [];
  let expSum = 0;
  let actSum = 0;
  let idealSum = 0;
  rows.forEach((r) => {
    expSum += r.computed_target;
    actSum += r.actual_steps;
    idealSum += getStepsBaseGoalForDate(r.date);
    expectedCumulative.push(expSum);
    actualCumulative.push(actSum);
    idealCumulative.push(idealSum);
  });
  stepsChartInstance = window.AutumnCharts.renderCumulativeChart("stepsChart", {
    labels,
    datasets: [
      { label: "Baseline (10k wkday / 7k wkend)", shortLabel: "Baseline", data: idealCumulative, color: "#718f80", dash: "4,4", width: 1.5 },
      { label: "Target Steps", shortLabel: "Target", data: expectedCumulative, color: "#0284c7", dash: "5,5", width: 2, stepped: true },
      { label: "Actual Steps", shortLabel: "Actual", data: actualCumulative, color: "#10b981", fill: true, width: 2.5, stepped: true }
    ],
    formatValue: (v) => formatSteps(Math.round(v)) + " steps"
  });
}

onReady('steps-entry-form', 'submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return showToast('ACCESS DENIED', 'Sign in as autumn to log steps.', true);

  const date = document.getElementById('steps-date-input').value;
  const actualSteps = parseInt(document.getElementById('steps-count-input').value, 10) || 0;
  if (!date) return;

  const { error } = await supabaseClient
    .from('steps_ledger')
    .upsert({
      date,
      actual_steps: actualSteps,
      target_steps: getStepsBaseGoalForDate(date),
      source: 'manual'
    }, { onConflict: 'date' });

  if (error) {
    // TOOLS-HUB (T1.2): queue the log instead of losing it when the link is down.
    if (queueWriteIfOffline(error, 'steps_ledger', {
      date: date,
      actual_steps: actualSteps,
      target_steps: getStepsBaseGoalForDate(date),
      source: 'manual'
    }, 'date')) return;
    showToast('DATABASE ERROR', error.message, true);
  } else {
    if (typeof clearPassUsedLockForDate === 'function') clearPassUsedLockForDate(date, 'steps');
    document.getElementById('steps-count-input').value = '';
    showToast('STEP LOG SAVED', `Recorded ${formatSteps(actualSteps)} steps for ${date}.`);
    fetchAndRenderSteps();
  }
});

onReady('reset-steps-btn', 'click', () => {
  if (!currentUser) return;
  confirmAction(
    'Purge All Step Ledger Data?',
    'This will permanently delete all recorded rows in steps_ledger.',
    async () => {
      const { error } = await supabaseClient.from('steps_ledger').delete().neq('date', '1900-01-01');
      if (error) showToast('RESET ERROR', error.message, true);
      else {
        showToast('STEP LEDGER PURGED', 'All step records cleared.');
        fetchAndRenderSteps();
      }
    }
  );
});

onReady('steps-prev-month', 'click', () => {
  currentStepsCalDate.setMonth(currentStepsCalDate.getMonth() - 1);
  updateStepsCalendar(globalStepsRows);
});

onReady('steps-next-month', 'click', () => {
  currentStepsCalDate.setMonth(currentStepsCalDate.getMonth() + 1);
  updateStepsCalendar(globalStepsRows);
});

window.initStepsModule = function () {
  const stepDateEl = document.getElementById("steps-date-input");
  if (stepDateEl && !stepDateEl.value) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    stepDateEl.value = getLocalDateString(yesterday);
  }
  if (typeof syncOwnerPermissions === "function") syncOwnerPermissions(document.getElementById("tab-steps"));
  if (Array.isArray(globalStepsRows) && globalStepsRows.length > 0) {
    updateStepsStats(globalStepsRows);
    updateStepsCalendar(globalStepsRows);
    updateStepsTodayDisplay(globalStepsRows);
    updateStepsTable(globalStepsRows);
    updateStepsPredictions(globalStepsRows);
    updateStepsChart(globalStepsRows);
  }
  if (typeof renderAdvancedTelemetryAnalytics === "function") renderAdvancedTelemetryAnalytics();
  if (window.umAtlas && typeof window.umAtlas.attachLedgerInlineEditing === "function") {
    window.umAtlas.attachLedgerInlineEditing();
  }
  if (window.analyticsMatrix && typeof window.analyticsMatrix.refreshAllAnalytics === "function") {
    window.analyticsMatrix.refreshAllAnalytics();
  }
};
