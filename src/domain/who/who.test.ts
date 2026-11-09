import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lmsAt, valueAtZ } from './who';

describe('WHO-Perzentile', () => {
  it('trifft das veröffentlichte Geburtsgewicht von Mädchen am Median', () => {
    const lms = lmsAt('weight', 'maedchen', 0);
    assert.ok(lms);
    assert.ok(Math.abs(valueAtZ(lms.l, lms.m, lms.s, 0) - 3.2322) < 0.0001);
  });

  it('liegt P97 über P50 und P3 darunter', () => {
    const lms = lmsAt('height', 'maedchen', 12);
    assert.ok(lms);
    const low = valueAtZ(lms.l, lms.m, lms.s, -1.8807936081512509);
    const mid = valueAtZ(lms.l, lms.m, lms.s, 0);
    const high = valueAtZ(lms.l, lms.m, lms.s, 1.8807936081512509);
    assert.ok(low < mid && mid < high);
  });
});
