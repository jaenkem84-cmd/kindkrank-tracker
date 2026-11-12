import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateAppData } from './migrate';

describe('Migration auf Personen', () => {
  it('macht aus Kindern Personen vom Typ Kind und behält die Eintrags-IDs', () => {
    const migrated = migrateAppData({
      version: 3,
      children: [
        {
          id: 'anna',
          name: 'Anna',
          birthDate: '2025-01-15',
          sex: 'maedchen',
          frameColor: '#E85A9B',
          isExample: true,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      caregivers: [{ id: 'papa', name: 'Papa', role: 'Vater', isOwner: true }],
      temperatures: [
        {
          id: 'temp-1',
          childId: 'anna',
          timestamp: '2026-11-04T07:05:00.000Z',
          celsius: 38.4,
          method: 'rektal',
          note: '',
          isExample: true,
        },
      ],
      medications: [],
      doses: [],
      growth: [],
      vaccinations: [],
      symptoms: [],
      reminders: [],
      settings: {
        defaultMethod: 'rektal',
        defaultGivenBy: 'Papa',
        activeChildId: 'anna',
        appearance: 'system',
        familyId: null,
      },
    });
    assert.ok(migrated);
    assert.equal(migrated.version, 4);
    assert.equal(migrated.children[0].personType, 'kind');
    assert.equal(migrated.children[0].defaultMethod, 'rektal');
    assert.equal(migrated.children[0].isSelf, false);
    assert.equal(migrated.temperatures[0].id, 'temp-1');
    assert.equal(migrated.temperatures[0].childId, 'anna');
    assert.equal(migrated.temperatures[0].celsius, 38.4);
    assert.equal(migrated.settings.activeChildId, 'anna');
    assert.equal(migrated.caregivers[0].name, 'Papa');
  });

  it('behält einen schon gespeicherten Erwachsenen', () => {
    const migrated = migrateAppData({
      version: 4,
      children: [
        {
          id: 'michael',
          name: 'Michael',
          birthDate: '1984-06-12',
          sex: 'junge',
          personType: 'erwachsen',
          role: 'Vater',
          isSelf: true,
          defaultMethod: 'oral',
          frameColor: '#3B82F6',
          isExample: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      caregivers: [],
      temperatures: [],
      medications: [],
      doses: [],
      growth: [],
      vaccinations: [],
      symptoms: [],
      reminders: [],
      settings: {
        defaultMethod: 'oral',
        defaultGivenBy: 'Michael',
        activeChildId: 'michael',
        appearance: 'dark',
        familyId: 'familie-1',
      },
    });
    assert.equal(migrated?.children[0].personType, 'erwachsen');
    assert.equal(migrated?.children[0].isSelf, true);
    assert.equal(migrated?.settings.familyId, 'familie-1');
  });
});
