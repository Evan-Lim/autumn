/**
 * Pure telemetry and multi-day trajectory simulation engine for autumn // PERSONAL COMMAND LEDGER.
 * Used by both the unit test suite (`node:test`) and the interactive 00 // Cockpit Mission Control view.
 */

export interface SimulationInput {
  currentStudyDebt: number;
  currentStepsDebt: number;
  plannedDailyStudyHours: number;
  plannedDailySteps: number;
  horizonDays: number;
  startDateStr: string;
}

export interface SimulatedDay {
  dayIndex: number;
  dateStr: string;
  isWeekend: boolean;
  baseStudyGoal: number;
  baseStepsGoal: number;
  effectiveStudyTarget: number;
  effectiveStepsTarget: number;
  studyDebtAfter: number;
  stepsDebtAfter: number;
  projectedScore: number;
  projectedGrade: string;
  passEarned: 'A+' | 'A' | 'NONE';
}

export interface SimulationSummary {
  days: SimulatedDay[];
  daysToZeroStudyDebt: number | null;
  daysToZeroStepsDebt: number | null;
  meanProjectedScore: number;
  totalPassesA: number;
  totalPassesAPlus: number;
}

export const STUDY_WEEKDAY_GOAL = 7.0;
export const STUDY_WEEKEND_GOAL = 5.0;
export const STUDY_MAX_DAILY = 12.0;

export const STEPS_WEEKDAY_GOAL = 10000;
export const STEPS_WEEKEND_GOAL = 9000;
export const STEPS_MAX_DAILY = 13500;
export const SCORING_FLOOR_RATIO = 0.25;

export function isWeekendDateStr(dateStr: string): boolean {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return false;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function addDays(dateStr: string, offset: number): string {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeGradeFromScore(score: number): { grade: string; passEarned: 'A+' | 'A' | 'NONE' } {
  if (score > 100) return { grade: 'A+', passEarned: 'A+' };
  if (score >= 95) return { grade: 'A', passEarned: 'A' };
  if (score >= 85) return { grade: 'A-', passEarned: 'NONE' };
  if (score >= 75) return { grade: 'B', passEarned: 'NONE' };
  if (score >= 60) return { grade: 'C', passEarned: 'NONE' };
  return { grade: 'D', passEarned: 'NONE' };
}

export function simulateMultiDayTrajectory(input: SimulationInput): SimulationSummary {
  const horizon = Math.max(1, Math.min(30, Math.round(input.horizonDays || 7)));
  let studyOverflow = Number(input.currentStudyDebt) || 0;
  let stepsOverflow = Number(input.currentStepsDebt) || 0;
  const planStudy = Math.max(0, Number(input.plannedDailyStudyHours) || 0);
  const planSteps = Math.max(0, Number(input.plannedDailySteps) || 0);

  const days: SimulatedDay[] = [];
  let daysToZeroStudyDebt: number | null = studyOverflow <= 0 ? 0 : null;
  let daysToZeroStepsDebt: number | null = stepsOverflow <= 0 ? 0 : null;
  let scoreSum = 0;
  let totalPassesA = 0;
  let totalPassesAPlus = 0;

  for (let i = 0; i < horizon; i++) {
    const dateStr = addDays(input.startDateStr, i);
    const weekend = isWeekendDateStr(dateStr);
    const baseStudy = weekend ? STUDY_WEEKEND_GOAL : STUDY_WEEKDAY_GOAL;
    const baseSteps = weekend ? STEPS_WEEKEND_GOAL : STEPS_WEEKDAY_GOAL;

    const rawStudyTarget = baseStudy + studyOverflow;
    const rawStepsTarget = baseSteps + stepsOverflow;

    const effectiveStudyTarget = Math.min(
      STUDY_MAX_DAILY,
      Math.max(baseStudy * SCORING_FLOOR_RATIO, rawStudyTarget)
    );
    const effectiveStepsTarget = Math.min(
      STEPS_MAX_DAILY,
      Math.max(baseSteps * SCORING_FLOOR_RATIO, rawStepsTarget)
    );

    studyOverflow = Math.round((rawStudyTarget - planStudy) * 100) / 100;
    stepsOverflow = Math.round(rawStepsTarget - planSteps);

    if (daysToZeroStudyDebt === null && studyOverflow <= 0) {
      daysToZeroStudyDebt = i + 1;
    }
    if (daysToZeroStepsDebt === null && stepsOverflow <= 0) {
      daysToZeroStepsDebt = i + 1;
    }

    const studyRatio = effectiveStudyTarget > 0 ? planStudy / effectiveStudyTarget : 1;
    const stepsRatio = effectiveStepsTarget > 0 ? planSteps / effectiveStepsTarget : 1;
    const baseStudyPts = Math.min(1, studyRatio) * 50;
    const baseStepsPts = Math.min(1, stepsRatio) * 30;
    const extraStudyPts = Math.max(0, studyRatio - 1) * 50;
    const extraStepsPts = Math.max(0, stepsRatio - 1) * 30;
    const disciplinePts = 20;

    const projectedScore = Math.round((baseStudyPts + baseStepsPts + extraStudyPts + extraStepsPts + disciplinePts) * 10) / 10;
    const { grade, passEarned } = computeGradeFromScore(projectedScore);

    if (passEarned === 'A+') totalPassesAPlus += 1;
    if (passEarned === 'A') totalPassesA += 1;
    scoreSum += projectedScore;

    days.push({
      dayIndex: i + 1,
      dateStr,
      isWeekend: weekend,
      baseStudyGoal: baseStudy,
      baseStepsGoal: baseSteps,
      effectiveStudyTarget: Math.round(effectiveStudyTarget * 100) / 100,
      effectiveStepsTarget: Math.round(effectiveStepsTarget),
      studyDebtAfter: Math.max(0, studyOverflow),
      stepsDebtAfter: Math.max(0, stepsOverflow),
      projectedScore,
      projectedGrade: grade,
      passEarned,
    });
  }

  return {
    days,
    daysToZeroStudyDebt,
    daysToZeroStepsDebt,
    meanProjectedScore: Math.round((scoreSum / horizon) * 10) / 10,
    totalPassesA,
    totalPassesAPlus,
  };
}

export function calculateKineticEfficiencyIndex(studyHours: number, steps: number): {
  stepsPerHour: number;
  status: 'SEDENTARY_RISK' | 'SUB_OPTIMAL' | 'OPTIMAL' | 'HIGH_KINETIC';
  efficiencyScore: number;
} {
  if (studyHours <= 0) {
    return {
      stepsPerHour: steps,
      status: steps >= 8000 ? 'HIGH_KINETIC' : 'SUB_OPTIMAL',
      efficiencyScore: steps >= 8000 ? 85 : 50,
    };
  }
  const ratio = Math.round(steps / studyHours);
  if (ratio < 800) {
    return { stepsPerHour: ratio, status: 'SEDENTARY_RISK', efficiencyScore: Math.max(20, Math.round((ratio / 800) * 60)) };
  }
  if (ratio < 1200) {
    return { stepsPerHour: ratio, status: 'SUB_OPTIMAL', efficiencyScore: Math.round(60 + ((ratio - 800) / 400) * 25) };
  }
  if (ratio <= 1800) {
    return { stepsPerHour: ratio, status: 'OPTIMAL', efficiencyScore: 100 };
  }
  return { stepsPerHour: ratio, status: 'HIGH_KINETIC', efficiencyScore: 95 };
}
