import { createId } from '../domain/ids';
import type { AppData, Child, DoseEntry, GrowthEntry, Medication, TemperatureEntry } from '../domain/types';

function hoursAgo(now: Date, hours: number): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

/**
 * One clearly marked example child so the fever chart and dose cards are visible
 * the first time the app opens. Everything here can be deleted.
 */
export function createSeedData(now: Date): AppData {
  const anna: Child = {
    id: createId('kind'),
    name: 'Anna',
    birthDate: '2025-01-15',
    isExample: true,
    createdAt: now.toISOString(),
  };

  const paracetamol: Medication = {
    id: createId('med'),
    childId: anna.id,
    name: 'Paracetamol-Zäpfchen (Beispiel)',
    doseText: '1 Zäpfchen',
    minIntervalHours: 6,
    maxDosesPer24h: 4,
    isExample: true,
  };
  const ibuprofen: Medication = {
    id: createId('med'),
    childId: anna.id,
    name: 'Ibuprofen-Saft (Beispiel)',
    doseText: '2,5 ml',
    minIntervalHours: 6,
    maxDosesPer24h: 3,
    isExample: true,
  };

  const temperatures: TemperatureEntry[] = [
    [50, 38.4],
    [44, 39.1],
    [36, 38.7],
    [26, 37.9],
    [18, 38.2],
    [8, 37.6],
    [2, 37.4],
  ].map(([hours, celsius]) => ({
    id: createId('temp'),
    childId: anna.id,
    timestamp: hoursAgo(now, hours),
    celsius,
    method: 'rektal' as const,
    note: '',
    isExample: true,
  }));

  const doses: DoseEntry[] = [14, 7].map((hours) => ({
    id: createId('gabe'),
    childId: anna.id,
    medicationId: paracetamol.id,
    timestamp: hoursAgo(now, hours),
    givenBy: 'Mama (Beispiel)',
    doseText: paracetamol.doseText,
    note: '',
    overridden: false,
    isExample: true,
  }));

  const growth: GrowthEntry[] = [
    { timestamp: '2025-01-20T10:00:00.000Z', weightKg: 3.4, heightCm: 51, headCm: 35 },
    { timestamp: '2025-07-15T10:00:00.000Z', weightKg: 7.8, heightCm: 68, headCm: 43 },
    { timestamp: '2026-01-15T10:00:00.000Z', weightKg: 9.4, heightCm: 78, headCm: 46 },
    { timestamp: hoursAgo(now, 48), weightKg: 11.2, heightCm: 84, headCm: 47.5 },
    { timestamp: hoursAgo(now, 6), weightKg: 10.6 },
  ].map((entry) => ({
    id: createId('wuchs'),
    childId: anna.id,
    isExample: true,
    ...entry,
  }));

  return {
    version: 1,
    children: [anna],
    temperatures,
    medications: [paracetamol, ibuprofen],
    doses,
    growth,
    settings: {
      chartWindowWeeks: 5,
      defaultMethod: 'rektal',
      defaultGivenBy: '',
      activeChildId: anna.id,
      appearance: 'system',
    },
  };
}

export function deleteExampleData(data: AppData): AppData {
  const exampleIds = new Set(data.children.filter((child) => child.isExample).map((child) => child.id));
  const dropChild = (childId: string, isExample: boolean) => exampleIds.has(childId) || isExample;
  const children = data.children.filter((child) => !child.isExample);
  const activeStillThere = children.some((child) => child.id === data.settings.activeChildId);
  return {
    ...data,
    children,
    temperatures: data.temperatures.filter((entry) => !dropChild(entry.childId, entry.isExample)),
    medications: data.medications.filter((entry) => !dropChild(entry.childId, entry.isExample)),
    doses: data.doses.filter((entry) => !dropChild(entry.childId, entry.isExample)),
    growth: data.growth.filter((entry) => !dropChild(entry.childId, entry.isExample)),
    settings: {
      ...data.settings,
      activeChildId: activeStillThere ? data.settings.activeChildId : (children[0]?.id ?? null),
    },
  };
}

export function keepExampleChild(data: AppData, childId: string): AppData {
  return {
    ...data,
    children: data.children.map((child) => (child.id === childId ? { ...child, isExample: false } : child)),
    temperatures: data.temperatures.map((entry) =>
      entry.childId === childId ? { ...entry, isExample: false } : entry,
    ),
    medications: data.medications.map((entry) =>
      entry.childId === childId ? { ...entry, isExample: false } : entry,
    ),
    doses: data.doses.map((entry) => (entry.childId === childId ? { ...entry, isExample: false } : entry)),
    growth: data.growth.map((entry) => (entry.childId === childId ? { ...entry, isExample: false } : entry)),
  };
}
