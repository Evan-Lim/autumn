import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWeekendDateStr,
  addDays,
  computeGradeFromScore,
  simulateMultiDayTrajectory,
  calculateKineticEfficiencyIndex,
} from './telemetryMath.ts';

test('isWeekendDateStr identifies Saturdays and Sundays accurately', () => {
  assert.equal(isWeekendDateStr('2026-10-31'), true);
  assert.equal(isWeekendDateStr('2026-11-01'), true);
  assert.equal(isWeekendDateStr('2026-11-02'), false);
});

test('addDays crosses month boundaries cleanly', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-11-01', 5), '2026-11-06');
});

test('computeGradeFromScore maps operational yield bands and quota pass rewards', () => {
  assert.deepEqual(computeGradeFromScore(104.5), { grade: 'A+', passEarned: 'A+' });
  assert.deepEqual(computeGradeFromScore(97.0), { grade: 'A', passEarned: 'A' });
  assert.deepEqual(computeGradeFromScore(88.0), { grade: 'A-', passEarned: 'NONE' });
  assert.deepEqual(computeGradeFromScore(78.0), { grade: 'B', passEarned: 'NONE' });
  assert.deepEqual(computeGradeFromScore(65.0), { grade: 'C', passEarned: 'NONE' });
  assert.deepEqual(computeGradeFromScore(42.0), { grade: 'D', passEarned: 'NONE' });
});

test('simulateMultiDayTrajectory amortizes study and step debt over horizon', () => {
  const result = simulateMultiDayTrajectory({
    currentStudyDebt: 4.0,
    currentStepsDebt: 4000,
    plannedDailyStudyHours: 9.0,
    plannedDailySteps: 12000,
    horizonDays: 5,
    startDateStr: '2026-11-02',
  });

  assert.equal(result.days.length, 5);
  assert.equal(result.days[0].studyDebtAfter, 2.0);
  assert.equal(result.days[1].studyDebtAfter, 0);
  assert.equal(result.daysToZeroStudyDebt, 2);
  assert.equal(result.daysToZeroStepsDebt, 2);
  assert.ok(result.meanProjectedScore >= 95);
  assert.ok(result.totalPassesAPlus + result.totalPassesA >= 3);
});

test('calculateKineticEfficiencyIndex flags sedentary lock vs optimal kinetic ratio', () => {
  const optimal = calculateKineticEfficiencyIndex(7.5, 10500);
  assert.equal(optimal.stepsPerHour, 1400);
  assert.equal(optimal.status, 'OPTIMAL');
  assert.equal(optimal.efficiencyScore, 100);

  const sedentary = calculateKineticEfficiencyIndex(10, 4000);
  assert.equal(sedentary.stepsPerHour, 400);
  assert.equal(sedentary.status, 'SEDENTARY_RISK');
});
