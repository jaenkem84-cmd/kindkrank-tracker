import type {
  AppData,
  Caregiver,
  DoseEntry,
  GrowthEntry,
  MeasurementMethod,
  Medication,
  Person,
  Reminder,
  Settings,
  SymptomEntry,
  TemperatureEntry,
  VaccinationEntry,
} from '../domain/types';
import { MEASUREMENT_METHODS } from '../domain/types';

function isMethod(value: unknown): value is MeasurementMethod {
  return typeof value === 'string' && (MEASUREMENT_METHODS as readonly string[]).includes(value);
}

function normalizePerson(item: unknown, fallbackMethod: MeasurementMethod): Person | null {
  if (!item || typeof item !== 'object') return null;
  const raw = item as Partial<Person>;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const personType = raw.personType === 'erwachsen' ? 'erwachsen' : 'kind';
  return {
    id: raw.id,
    name: raw.name,
    birthDate: typeof raw.birthDate === 'string' ? raw.birthDate : '',
    sex: raw.sex === 'junge' ? 'junge' : 'maedchen',
    personType,
    role: typeof raw.role === 'string' ? raw.role : '',
    isSelf: raw.isSelf === true,
    defaultMethod: isMethod(raw.defaultMethod) ? raw.defaultMethod : personType === 'erwachsen' ? 'oral' : fallbackMethod,
    frameColor: typeof raw.frameColor === 'string' ? raw.frameColor : '#3B82F6',
    isExample: raw.isExample === true,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
  };
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Turns version 3 child documents into version 4 persons.
 * Missing personType becomes Kind. Entry ids and childId links are kept.
 * Returns null when the document has no person list or no temperature list.
 */
export function migrateAppData(value: unknown): AppData | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const people = Array.isArray(raw.children) ? raw.children : Array.isArray(raw.persons) ? raw.persons : null;
  if (!people || !Array.isArray(raw.temperatures)) return null;
  const settingsIn = (raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) as Partial<Settings>;
  const fallbackMethod = isMethod(settingsIn.defaultMethod) ? settingsIn.defaultMethod : 'rektal';
  const children = people.map((item) => normalizePerson(item, fallbackMethod));
  if (children.some((person) => person === null)) return null;
  const persons = children as Person[];
  const requested = typeof settingsIn.activeChildId === 'string' ? settingsIn.activeChildId : null;
  const activeChildId = requested && persons.some((person) => person.id === requested) ? requested : (persons[0]?.id ?? null);
  const appearance = settingsIn.appearance === 'light' || settingsIn.appearance === 'dark' ? settingsIn.appearance : 'system';
  return {
    version: 4,
    children: persons,
    caregivers: asArray<Caregiver>(raw.caregivers),
    temperatures: asArray<TemperatureEntry>(raw.temperatures),
    medications: asArray<Medication>(raw.medications),
    doses: asArray<DoseEntry>(raw.doses),
    growth: asArray<GrowthEntry>(raw.growth),
    vaccinations: asArray<VaccinationEntry>(raw.vaccinations),
    symptoms: asArray<SymptomEntry>(raw.symptoms),
    reminders: asArray<Reminder>(raw.reminders),
    settings: {
      defaultMethod: fallbackMethod,
      defaultGivenBy: typeof settingsIn.defaultGivenBy === 'string' ? settingsIn.defaultGivenBy : '',
      activeChildId,
      appearance,
      familyId: typeof settingsIn.familyId === 'string' ? settingsIn.familyId : null,
    },
  };
}
