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
    assert.equal(migrated.version, 5);
    const anna = migrated.children.find((person) => person.id === 'anna');
    const papa = migrated.children.find((person) => person.name === 'Papa');
    assert.equal(anna?.personType, 'kind');
    assert.equal(anna?.defaultMethod, 'rektal');
    assert.ok(papa);
    assert.equal(papa?.personType, 'erwachsen');
    assert.equal(papa?.isAdmin, true);
    assert.equal(papa?.isSelf, true);
    assert.equal(migrated.caregivers.length, 0);
    assert.equal(migrated.temperatures[0].id, 'temp-1');
    assert.equal(migrated.temperatures[0].childId, 'anna');
    assert.equal(migrated.temperatures[0].celsius, 38.4);
    assert.equal(migrated.settings.activeChildId, 'anna');
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
          isAdmin: true,
          joinStatus: 'admin',
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
    assert.equal(migrated?.children[0].isAdmin, true);
    assert.equal(migrated?.settings.familyId, 'familie-1');
  });

  it('nimmt Michael und Julia in die eine Familienliste und legt keine zweite Partnerin an', () => {
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
          isExample: true,
          defaultMethod: 'oral',
          frameColor: '#3B82F6',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'partner',
          name: 'Partnerin',
          birthDate: '1986-09-04',
          sex: 'maedchen',
          personType: 'erwachsen',
          role: 'Mutter',
          isSelf: false,
          isExample: true,
          defaultMethod: 'axillar',
          frameColor: '#8B5CF6',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'anna',
          name: 'Anna',
          birthDate: '2025-01-15',
          sex: 'maedchen',
          personType: 'kind',
          isExample: false,
          defaultMethod: 'rektal',
          frameColor: '#E85A9B',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      caregivers: [
        { id: 'c-michael', name: 'Michael', role: 'Vater', isOwner: true },
        { id: 'c-julia', name: 'Julia', role: 'Mutter', isOwner: false },
      ],
      temperatures: [],
      medications: [],
      doses: [],
      growth: [],
      vaccinations: [],
      symptoms: [],
      reminders: [],
      settings: {
        defaultMethod: 'rektal',
        defaultGivenBy: 'Michael',
        activeChildId: 'anna',
        appearance: 'system',
        familyId: null,
      },
    });
    assert.ok(migrated);
    assert.deepEqual(
      migrated.children.map((person) => person.name),
      ['Michael', 'Julia', 'Anna'],
    );
    assert.equal(migrated.children.find((person) => person.name === 'Michael')?.isAdmin, true);
    assert.equal(migrated.children.filter((person) => person.name === 'Michael').length, 1);
    assert.equal(migrated.caregivers.length, 0);
  });
});
