import { zonedDateTime } from '../domain/dates';
import { createId } from '../domain/ids';
import type {
  AppData,
  Caregiver,
  Child,
  DoseEntry,
  GrowthEntry,
  Medication,
  SymptomEntry,
  TemperatureEntry,
  VaccinationEntry,
} from '../domain/types';

function at(day: string, time: string): string {
  const [date, month, year] = day.split('.').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return zonedDateTime({ year, month, day: date, hour, minute }).toISOString();
}

const TEMPERATURES: [string, string, number][] = [
  ['03.11.2026', '23:40', 40.7],
  ['04.11.2026', '08:05', 38.4],
  ['04.11.2026', '13:29', 40.3],
  ['04.11.2026', '17:41', 39.0],
  ['04.11.2026', '19:18', 40.0],
  ['05.11.2026', '00:30', 38.3],
  ['05.11.2026', '07:18', 40.0],
  ['05.11.2026', '12:01', 38.7],
  ['05.11.2026', '14:19', 40.5],
  ['05.11.2026', '18:41', 36.8],
  ['06.11.2026', '07:33', 39.7],
  ['06.11.2026', '15:47', 39.9],
  ['06.11.2026', '19:48', 37.0],
  ['06.11.2026', '20:28', 37.3],
  ['07.11.2026', '07:36', 39.7],
  ['07.11.2026', '08:15', 39.0],
  ['07.11.2026', '11:10', 39.2],
  ['07.11.2026', '13:09', 40.1],
  ['07.11.2026', '16:53', 37.0],
  ['07.11.2026', '18:56', 36.8],
  ['08.11.2026', '08:10', 40.0],
  ['08.11.2026', '10:55', 37.3],
  ['08.11.2026', '13:36', 36.0],
  ['08.11.2026', '14:45', 36.5],
  ['08.11.2026', '16:52', 37.6],
  ['08.11.2026', '18:46', 38.4],
  ['09.11.2026', '00:00', 38.2],
  ['09.11.2026', '18:54', 37.4],
];

const HEIGHT: [string, number][] = [
  ['15.01.2025', 50.0],
  ['17.01.2025', 50.0],
  ['10.02.2025', 52.0],
  ['25.04.2025', 59.5],
  ['25.07.2025', 65.6],
  ['20.08.2025', 68.2],
  ['11.10.2025', 71.0],
  ['16.01.2026', 72.0],
  ['23.10.2026', 85.0],
];

const HEAD: [string, number][] = [
  ['15.01.2025', 35.5],
  ['17.01.2025', 35.5],
  ['10.02.2025', 36.5],
  ['25.04.2025', 40.5],
  ['25.07.2025', 43.4],
  ['16.01.2026', 45.5],
];

const WEIGHT: [string, number][] = [
  ['15.01.2025', 3.34],
  ['17.01.2025', 3.0],
  ['10.02.2025', 3.91],
  ['25.04.2025', 6.3],
  ['25.07.2025', 7.5],
  ['16.01.2026', 8.68],
];

function exampleVaccinations(childId: string): VaccinationEntry[] {
  const shot = (
    day: string,
    productId: string,
    productName: string,
    antigens: string[],
  ): VaccinationEntry => ({
    id: createId('impf'),
    childId,
    timestamp: at(day, '10:00'),
    productId,
    productName,
    antigens,
    batch: 'BEISPIEL',
    doctor: 'Kinderarztpraxis Beispiel',
    note: 'Beispieldaten, keine Dokumentation aus einem Impfpass.',
    isExample: true,
  });
  const six = ['diphtherie', 'tetanus', 'pertussis', 'hib', 'polio', 'hepatitisB'];
  return [
    shot('17.03.2025', 'hexyon', 'Hexyon', six),
    shot('17.03.2025', 'prevenar13', 'Prevenar 13', ['pneumokokken']),
    shot('17.03.2025', 'bexsero', 'Bexsero', ['menb']),
    shot('17.03.2025', 'rotarix', 'Rotarix', ['rotaviren']),
    shot('19.05.2025', 'hexyon', 'Hexyon', six),
    shot('19.05.2025', 'prevenar13', 'Prevenar 13', ['pneumokokken']),
    shot('19.05.2025', 'bexsero', 'Bexsero', ['menb']),
    shot('19.05.2025', 'rotarix', 'Rotarix', ['rotaviren']),
    shot('17.12.2025', 'hexyon', 'Hexyon', six),
    shot('17.12.2025', 'prevenar13', 'Prevenar 13', ['pneumokokken']),
    shot('17.12.2025', 'priorix', 'Priorix', ['masern', 'mumps', 'roeteln']),
    shot('17.12.2025', 'varivax', 'Varivax', ['varizellen']),
    shot('16.01.2026', 'bexsero', 'Bexsero', ['menb']),
    shot('16.04.2026', 'priorix', 'Priorix', ['masern', 'mumps', 'roeteln']),
    shot('16.04.2026', 'varivax', 'Varivax', ['varizellen']),
  ];
}

function exampleSymptoms(childId: string): SymptomEntry[] {
  const item = (day: string, time: string, symptomId: string, label: string): SymptomEntry => ({
    id: createId('sym'),
    childId,
    timestamp: at(day, time),
    symptomId,
    label,
    severity: null,
    note: '',
    isExample: true,
  });
  return [
    item('04.11.2026', '09:10', 'husten', 'Husten'),
    item('04.11.2026', '20:15', 'schnupfen', 'Schnupfen'),
    item('05.11.2026', '12:40', 'appetit', 'Appetitlosigkeit'),
    item('06.11.2026', '08:05', 'husten', 'Husten'),
  ];
}

/**
 * Anna, girl, born 15.01.2025, with the recorded measurements.
 * Medication intervals are example values entered like a parent would, not recommendations.
 * Vaccinations follow the shape of the STIKO 2026 infant schedule and are example data only.
 */
export function createSeedData(now: Date): AppData {
  const michael: Child = {
    id: createId('kind'),
    name: 'Michael',
    birthDate: '1984-06-12',
    sex: 'junge',
    personType: 'erwachsen',
    role: 'Vater',
    isSelf: true,
    defaultMethod: 'oral',
    frameColor: '#3B82F6',
    isExample: true,
    createdAt: now.toISOString(),
  };
  const partner: Child = {
    id: createId('kind'),
    name: 'Partnerin',
    birthDate: '1986-09-04',
    sex: 'maedchen',
    personType: 'erwachsen',
    role: 'Mutter',
    isSelf: false,
    defaultMethod: 'axillar',
    frameColor: '#8B5CF6',
    isExample: true,
    createdAt: now.toISOString(),
  };
  const anna: Child = {
    id: createId('kind'),
    name: 'Anna',
    birthDate: '2025-01-15',
    sex: 'maedchen',
    personType: 'kind',
    role: '',
    isSelf: false,
    defaultMethod: 'rektal',
    frameColor: '#E85A9B',
    isExample: true,
    createdAt: now.toISOString(),
  };
  const papa: Caregiver = {
    id: createId('person'),
    name: 'Michael',
    role: 'Vater',
    isOwner: true,
  };
  const ibuprofen: Medication = {
    id: createId('med'),
    childId: anna.id,
    name: 'Ibuprofen-Zäpfchen',
    doseText: '60 mg',
    minIntervalHours: 6,
    maxDosesPer24h: 4,
    isExample: true,
  };
  const paracetamol: Medication = {
    id: createId('med'),
    childId: anna.id,
    name: 'Paracetamol-Zäpfchen',
    doseText: '125 mg',
    minIntervalHours: 6,
    maxDosesPer24h: 4,
    isExample: true,
  };
  const prospan: Medication = {
    id: createId('med'),
    childId: anna.id,
    name: 'Prospan Hustensaft (Kinder)',
    doseText: '2,5 ml',
    minIntervalHours: 6,
    maxDosesPer24h: 3,
    isExample: true,
  };

  const temperatures: TemperatureEntry[] = TEMPERATURES.map(([day, time, celsius]) => ({
    id: createId('temp'),
    childId: anna.id,
    timestamp: at(day, time),
    celsius,
    method: 'rektal',
    note: '',
    isExample: true,
  }));

  const dose = (medication: Medication, day: string, time: string): DoseEntry => ({
    id: createId('gabe'),
    childId: anna.id,
    medicationId: medication.id,
    timestamp: at(day, time),
    givenBy: 'Papa',
    doseText: medication.doseText,
    note: '',
    overridden: false,
    isExample: true,
  });

  const doses: DoseEntry[] = [
    ...[
      ['03.11.2026', '23:45'],
      ['04.11.2026', '19:19'],
      ['05.11.2026', '14:21'],
      ['06.11.2026', '15:48'],
      ['07.11.2026', '13:10'],
      ['08.11.2026', '08:11'],
    ].map(([day, time]) => dose(ibuprofen, day, time)),
    ...[
      ['04.11.2026', '13:30'],
      ['05.11.2026', '07:19'],
      ['06.11.2026', '07:37'],
      ['07.11.2026', '07:38'],
      ['08.11.2026', '18:46'],
    ].map(([day, time]) => dose(paracetamol, day, time)),
    dose(prospan, '04.11.2026', '09:30'),
  ];

  const byDay = new Map<string, GrowthEntry>();
  const growthOf = (day: string) => {
    const existing = byDay.get(day);
    if (existing) return existing;
    const created: GrowthEntry = {
      id: createId('wuchs'),
      childId: anna.id,
      timestamp: at(day, '12:00'),
      isExample: true,
    };
    byDay.set(day, created);
    return created;
  };
  for (const [day, heightCm] of HEIGHT) growthOf(day).heightCm = heightCm;
  for (const [day, headCm] of HEAD) growthOf(day).headCm = headCm;
  for (const [day, weightKg] of WEIGHT) growthOf(day).weightKg = weightKg;

  const adultTemp = (day: string, time: string, celsius: number): TemperatureEntry => ({
    id: createId('temp'),
    childId: michael.id,
    timestamp: at(day, time),
    celsius,
    method: 'oral',
    note: '',
    isExample: true,
  });
  const adultWeight = (day: string, weightKg: number): GrowthEntry => ({
    id: createId('wuchs'),
    childId: michael.id,
    timestamp: at(day, '08:00'),
    weightKg,
    isExample: true,
  });

  return {
    version: 4,
    children: [michael, partner, anna],
    caregivers: [papa],
    temperatures: [
      ...temperatures,
      adultTemp('08.11.2026', '07:10', 36.6),
      adultTemp('09.11.2026', '21:40', 37.8),
      adultTemp('10.11.2026', '08:05', 38.4),
      adultTemp('11.11.2026', '19:15', 37.9),
      adultTemp('12.11.2026', '07:40', 36.9),
    ],
    medications: [ibuprofen, paracetamol, prospan],
    doses,
    growth: [
      ...byDay.values(),
      adultWeight('12.11.2024', 82.4),
      adultWeight('01.06.2025', 81.1),
      adultWeight('15.03.2026', 83.0),
      adultWeight('01.11.2026', 82.6),
    ],
    vaccinations: [
      ...exampleVaccinations(anna.id),
      {
        id: createId('impf'),
        childId: michael.id,
        timestamp: at('14.04.2014', '09:00'),
        productId: 'boostrix',
        productName: 'Boostrix',
        antigens: ['diphtherie', 'tetanus', 'pertussis'],
        batch: 'BEISPIEL',
        doctor: 'Hausarzt Beispiel',
        note: 'Beispiel, keine echte Impfung.',
        isExample: true,
      },
    ],
    symptoms: exampleSymptoms(anna.id),
    reminders: [],
    settings: {
      defaultMethod: 'rektal',
      defaultGivenBy: 'Michael',
      activeChildId: michael.id,
      appearance: 'system',
      familyId: null,
    },
  };
}

export function deleteExampleData(data: AppData): AppData {
  const exampleIds = new Set(data.children.filter((child) => child.isExample).map((child) => child.id));
  const drop = (childId: string, isExample: boolean) => exampleIds.has(childId) || isExample;
  const children = data.children.filter((child) => !child.isExample);
  const activeStillThere = children.some((child) => child.id === data.settings.activeChildId);
  return {
    ...data,
    children,
    temperatures: data.temperatures.filter((entry) => !drop(entry.childId, entry.isExample)),
    medications: data.medications.filter((entry) => !drop(entry.childId, entry.isExample)),
    doses: data.doses.filter((entry) => !drop(entry.childId, entry.isExample)),
    growth: data.growth.filter((entry) => !drop(entry.childId, entry.isExample)),
    vaccinations: data.vaccinations.filter((entry) => !drop(entry.childId, entry.isExample)),
    symptoms: data.symptoms.filter((entry) => !drop(entry.childId, entry.isExample)),
    reminders: data.reminders.filter((entry) => !exampleIds.has(entry.childId)),
    settings: {
      ...data.settings,
      activeChildId: activeStillThere ? data.settings.activeChildId : (children[0]?.id ?? null),
    },
  };
}

export function keepExampleChild(data: AppData, childId: string): AppData {
  const clear = <T extends { childId: string; isExample: boolean }>(items: T[]) =>
    items.map((entry) => (entry.childId === childId ? { ...entry, isExample: false } : entry));
  return {
    ...data,
    children: data.children.map((child) => (child.id === childId ? { ...child, isExample: false } : child)),
    temperatures: clear(data.temperatures),
    medications: clear(data.medications),
    doses: clear(data.doses),
    growth: clear(data.growth),
    vaccinations: clear(data.vaccinations),
    symptoms: clear(data.symptoms),
  };
}
