import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ageWeeksDays, formatAgeWeeks } from './dates';

describe('Alter in Wochen', () => {
  it('rechnet Anna am 9.11.2026 als 94 Wochen 5 Tage', () => {
    const now = new Date('2026-11-09T12:00:00.000Z');
    assert.deepEqual(ageWeeksDays('2025-01-15', now), { weeks: 94, days: 5 });
    assert.equal(formatAgeWeeks('2025-01-15', now), '94 Wochen 5 Tage');
  });
});