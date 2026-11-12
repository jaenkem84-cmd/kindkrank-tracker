import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adultVaccinationStatus } from './adultStiko';

const NOW = new Date('2026-11-12T10:00:00.000Z');

describe('Impfstatus Erwachsene', () => {
  it('fordert bei Jahrgang 1984 ohne Eintrag MMR als unklar und die Seniorenimpfungen als später', () => {
    const rows = adultVaccinationStatus('1984-06-12', [], NOW);
    assert.equal(rows.find((row) => row.id === 'masern')?.status, 'unklar');
    assert.equal(rows.find((row) => row.id === 'tetanus')?.status, 'unklar');
    assert.equal(rows.find((row) => row.id === 'pertussis')?.status, 'faellig');
    assert.equal(rows.find((row) => row.id === 'influenza')?.status, 'spaeter');
    assert.equal(rows.find((row) => row.id === 'covid19')?.status, 'spaeter');
    assert.equal(rows.find((row) => row.id === 'pneumokokken')?.status, 'spaeter');
    assert.equal(rows.find((row) => row.id === 'herpesZoster')?.status, 'spaeter');
  });

  it('wertet Tdap von 2014 als fällige Auffrischung und Pertussis als erledigt', () => {
    const rows = adultVaccinationStatus(
      '1984-06-12',
      [{ timestamp: '2014-04-14T08:00:00.000Z', antigens: ['diphtherie', 'tetanus', 'pertussis'] }],
      NOW,
    );
    assert.equal(rows.find((row) => row.id === 'tetanus')?.status, 'faellig');
    assert.equal(rows.find((row) => row.id === 'pertussis')?.status, 'erledigt');
  });

  it('lässt MMR bei Geburtsjahr 1968 aus der Standardgruppe', () => {
    const rows = adultVaccinationStatus('1968-01-01', [], NOW);
    assert.equal(rows.find((row) => row.id === 'masern')?.status, 'spaeter');
  });

  it('markiert Influenza ab 60 ohne Saisondosis als fällig', () => {
    const rows = adultVaccinationStatus('1960-01-01', [], NOW);
    assert.equal(rows.find((row) => row.id === 'influenza')?.status, 'faellig');
    assert.equal(rows.find((row) => row.id === 'pneumokokken')?.status, 'faellig');
    assert.equal(rows.find((row) => row.id === 'herpesZoster')?.status, 'faellig');
  });
});
