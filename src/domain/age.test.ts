import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ageWeeksDays, formatAgeWeeks, formatDisplayAge } from './dates';

describe('Alter in Wochen', () => {
  it('rechnet Anna am 9.11.2026 als 94 Wochen 5 Tage', () => {
    const now = new Date('2026-11-09T12:00:00.000Z');
    assert.deepEqual(ageWeeksDays('2025-01-15', now), { weeks: 94, days: 5 });
    assert.equal(formatAgeWeeks('2025-01-15', now), '94 Wochen 5 Tage');
    assert.equal(formatDisplayAge('2025-01-15', now), '1 Jahr 9 Monate');
  });

  it('zeigt junge Kinder in Wochen und ältere Säuglinge in Monaten', () => {
    assert.equal(formatDisplayAge('2026-10-01', new Date('2026-11-09T12:00:00.000Z')), '5 Wochen');
    assert.equal(formatDisplayAge('2026-01-15', new Date('2026-08-20T12:00:00.000Z')), '7 Monate');
  });
});