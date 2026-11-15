import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { vaccinationStatus } from './stiko';

const BIRTH = '2025-01-15';
const SIX = ['diphtherie', 'tetanus', 'pertussis', 'hib', 'polio', 'hepatitisB'];

describe('Impfstatus nach STIKO', () => {
  it('sieht die Sechsfach-Impfung mit 5 Tagen als später', () => {
    const rows = vaccinationStatus(BIRTH, [], new Date('2025-01-20T12:00:00.000Z'));
    assert.equal(rows.find((row) => row.id === 'diphtherie')?.status, 'spaeter');
  });

  it('markiert die erste Sechsfach-Dosis im 2. Monat als fällig', () => {
    const rows = vaccinationStatus(BIRTH, [], new Date('2025-03-20T12:00:00.000Z'));
    assert.equal(rows.find((row) => row.id === 'tetanus')?.status, 'faellig');
  });

  it('zählt ein vollständiges Beispiel im November 2026 als erledigt und MenACWY als später', () => {
    const shots = [
      ['2025-03-17', [...SIX, 'pneumokokken', 'menb', 'rotaviren']],
      ['2025-05-19', [...SIX, 'pneumokokken', 'menb', 'rotaviren']],
      ['2025-12-17', [...SIX, 'pneumokokken', 'masern', 'mumps', 'roeteln', 'varizellen']],
      ['2026-01-16', ['menb']],
      ['2026-04-16', ['masern', 'mumps', 'roeteln', 'varizellen']],
    ].map(([timestamp, antigens]) => ({ timestamp: `${timestamp}T09:00:00.000Z`, antigens: antigens as string[] }));
    const rows = vaccinationStatus(BIRTH, shots, new Date('2026-11-09T12:00:00.000Z'));
    assert.equal(rows.find((row) => row.id === 'polio')?.status, 'erledigt');
    assert.equal(rows.find((row) => row.id === 'masern')?.status, 'erledigt');
    assert.equal(rows.find((row) => row.id === 'menacwy')?.status, 'spaeter');
  });
});
