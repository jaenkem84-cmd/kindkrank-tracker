import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchVaccineLabel } from './matcher';

describe('Impfstoff-Etikett', () => {
  it('erkennt Hexyon und die Charge drumherum', () => {
    const matches = matchVaccineLabel('Hexyon Charge AB1234 Kinderarzt');
    assert.deepEqual(matches.map((match) => match.product.id), ['hexyon']);
  });

  it('bevorzugt Priorix-Tetra vor Priorix', () => {
    const matches = matchVaccineLabel('Priorix-Tetra');
    assert.equal(matches[0]?.product.id, 'priorix-tetra');
    assert.equal(matches.some((match) => match.product.id === 'priorix'), false);
  });

  it('trennt Prevenar 13 und Prevenar 20', () => {
    assert.equal(matchVaccineLabel('Prevenar 13')[0]?.product.id, 'prevenar13');
    assert.equal(matchVaccineLabel('Prevenar 20 Lot XY')[0]?.product.id, 'prevenar20');
  });

  it('liefert bei unrelated Text keine Treffer', () => {
    assert.deepEqual(matchVaccineLabel('hat erbrochen, Husten seit gestern'), []);
  });
});
