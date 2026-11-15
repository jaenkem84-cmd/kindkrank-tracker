import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { growthAxis, growthGridStep } from './growthAxis';

describe('Wachstumsachse', () => {
  it('setzt das Gitter nach dem Zeitraum', () => {
    assert.equal(growthGridStep(12), 2);
    assert.equal(growthGridStep(24), 4);
    assert.equal(growthGridStep(60), 6);
  });

  it('beschriftet ein Jahr mit 2, 4, 6, 8, 10 und 1 J', () => {
    assert.deepEqual(
      growthAxis(12).map((mark) => mark.label),
      ['0', '2', '4', '6', '8', '10', '1 J'],
    );
  });

  it('beginnt die Monate im zweiten Jahr wieder bei 4 und 8', () => {
    const labels = growthAxis(24).map((mark) => mark.label);
    assert.deepEqual(labels, ['0', '4', '8', '1 J', '4', '8', '2 J']);
    assert.equal(labels.includes('16'), false);
    assert.equal(labels.includes('20'), false);
  });

  it('zeigt über fünf Jahre nur 6 und die Jahresmarken', () => {
    const labels = growthAxis(60).map((mark) => mark.label);
    assert.deepEqual(labels, ['0', '6', '1 J', '6', '2 J', '6', '3 J', '6', '4 J', '6', '5 J']);
    assert.equal(growthAxis(60).filter((mark) => mark.strong).map((mark) => mark.label).join(','), '0,1 J,2 J,3 J,4 J,5 J');
  });
});
