import type {
  AppData,
  Caregiver,
  DoseEntry,
  GrowthEntry,
  MeasurementMethod,
  Medication,
  Person,
  Reminder,
  FamilyInvite,
  Settings,
  SymptomEntry,
  CustomSymptom,
  TemperatureEntry,
  VaccinationEntry,
} from '../domain/types';
import { MEASUREMENT_METHODS } from '../domain/types';

function isMethod(value: unknown): value is MeasurementMethod {
  return typeof value === 'string' && (MEASUREMENT_METHODS as readonly string[]).includes(value);
}

function foldName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function normalizePerson(item: unknown, fallbackMethod: MeasurementMethod): Person | null {
  if (!item || typeof item !== 'object') return null;
  const raw = item as Partial<Person>;
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const personType = raw.personType === 'erwachsen' ? 'erwachsen' : 'kind';
  const isAdmin = raw.isAdmin === true;
  const joinStatus =
    raw.joinStatus === 'admin' || raw.joinStatus === 'eingeladen' || raw.joinStatus === 'beigetreten' || raw.joinStatus === 'ohne-app'
      ? raw.joinStatus
      : isAdmin
        ? 'admin'
        : 'ohne-app';
  return {
    id: raw.id,
    name: raw.name,
    birthDate: typeof raw.birthDate === 'string' ? raw.birthDate : '',
    sex: raw.sex === 'junge' ? 'junge' : 'maedchen',
    personType,
    role: typeof raw.role === 'string' ? raw.role : '',
    isSelf: raw.isSelf === true,
    isAdmin,
    joinStatus,
    defaultMethod: isMethod(raw.defaultMethod) ? raw.defaultMethod : personType === 'erwachsen' ? 'oral' : fallbackMethod,
    frameColor: typeof raw.frameColor === 'string' ? raw.frameColor : '#3B82F6',
    photoUri: typeof raw.photoUri === 'string' ? raw.photoUri : null,
    avatarIcon: typeof raw.avatarIcon === 'string' ? raw.avatarIcon : null,
    isExample: raw.isExample === true,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
  };
}

/**
 * Caregivers were a second list (Papa, Michael, Julia) and never showed up
 * in the home switcher. Fold them into the one family list.
 * An example adult named Partnerin is renamed to the stored partner name
 * instead of becoming a duplicate.
 */
function foldCaregivers(persons: Person[], caregivers: Caregiver[]): Person[] {
  const next = persons.map((person) => ({ ...person }));
  for (const caregiver of caregivers) {
    const name = caregiver.name.trim();
    if (!name) continue;
    const folded = foldName(name);
    const same = next.find((person) => foldName(person.name) === folded);
    if (same) {
      if (caregiver.isOwner) {
        next.forEach((person) => {
          person.isSelf = person.id === same.id;
        });
        same.isAdmin = true;
        same.joinStatus = 'admin';
        if (!same.role && caregiver.role) same.role = caregiver.role;
      }
      continue;
    }
    if (caregiver.isOwner) {
      const self = next.find((person) => person.isSelf);
      if (self) {
        self.isAdmin = true;
        self.joinStatus = 'admin';
        continue;
      }
    } else {
      const placeholder = next.find(
        (person) =>
          person.isExample &&
          person.personType === 'erwachsen' &&
          !person.isSelf &&
          ['partnerin', 'partner', 'frau'].includes(foldName(person.name)),
      );
      if (placeholder) {
        placeholder.name = name;
        if (!placeholder.role && caregiver.role) placeholder.role = caregiver.role;
        continue;
      }
    }
    const created: Person = {
      id: caregiver.id.startsWith('kind-') ? caregiver.id : `kind-${caregiver.id}`,
      name,
      birthDate: '',
      sex: caregiver.role === 'Vater' || caregiver.role === 'Opa' ? 'junge' : 'maedchen',
      personType: 'erwachsen',
      role: caregiver.role || '',
      isSelf: caregiver.isOwner === true,
      isAdmin: caregiver.isOwner === true,
      joinStatus: caregiver.isOwner ? 'admin' : 'ohne-app',
      defaultMethod: 'oral',
      frameColor: caregiver.isOwner ? '#3B82F6' : '#8B5CF6',
      isExample: false,
      createdAt: new Date(0).toISOString(),
    };
    if (created.isSelf) {
      next.forEach((person) => {
        person.isSelf = false;
      });
    }
    next.push(created);
  }
  if (!next.some((person) => person.isAdmin)) {
    const admin = next.find((person) => person.isSelf) ?? next.find((person) => person.personType === 'erwachsen') ?? next[0];
    if (admin) {
      admin.isAdmin = true;
      admin.isSelf = true;
      admin.joinStatus = 'admin';
      next.forEach((person) => {
        if (person.id !== admin.id) person.isSelf = false;
      });
    }
  }
  const admin = next.find((person) => person.isAdmin);
  if (admin) admin.joinStatus = 'admin';
  return next;
}

export function splitGrowth(entries: GrowthEntry[]): GrowthEntry[] {
  const result: GrowthEntry[] = [];
  for (const entry of entries) {
    const pieces: GrowthEntry[] = [];
    if (entry.weightKg !== undefined) {
      pieces.push({ id: entry.id, childId: entry.childId, timestamp: entry.timestamp, weightKg: entry.weightKg, isExample: entry.isExample });
    }
    if (entry.heightCm !== undefined) {
      pieces.push({
        id: pieces.length === 0 ? entry.id : `${entry.id}-groesse`,
        childId: entry.childId,
        timestamp: entry.timestamp,
        heightCm: entry.heightCm,
        isExample: entry.isExample,
      });
    }
    if (entry.headCm !== undefined) {
      pieces.push({
        id: pieces.length === 0 ? entry.id : `${entry.id}-kopf`,
        childId: entry.childId,
        timestamp: entry.timestamp,
        headCm: entry.headCm,
        isExample: entry.isExample,
      });
    }
    result.push(...(pieces.length > 0 ? pieces : [entry]));
  }
  return result;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Turns older documents into one family list (version 5).
 * Missing personType becomes Kind. Entry ids and childId links are kept.
 * Caregivers are folded into that list and then dropped.
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
  const persons = foldCaregivers(children as Person[], asArray<Caregiver>(raw.caregivers));
  const requested = typeof settingsIn.activeChildId === 'string' ? settingsIn.activeChildId : null;
  const activeChildId = requested && persons.some((person) => person.id === requested) ? requested : (persons[0]?.id ?? null);
  const appearance = settingsIn.appearance === 'light' || settingsIn.appearance === 'dark' ? settingsIn.appearance : 'system';
  return {
    version: 5,
    children: persons,
    caregivers: [],
    temperatures: asArray<TemperatureEntry>(raw.temperatures),
    medications: asArray<Medication>(raw.medications),
    doses: asArray<DoseEntry>(raw.doses),
    growth: splitGrowth(asArray<GrowthEntry>(raw.growth)),
    vaccinations: asArray<VaccinationEntry>(raw.vaccinations),
    symptoms: asArray<SymptomEntry>(raw.symptoms),
    customSymptoms: asArray<CustomSymptom>(raw.customSymptoms),
    reminders: asArray<Reminder>(raw.reminders),
    invites: asArray<FamilyInvite>(raw.invites),
    settings: {
      defaultMethod: fallbackMethod,
      defaultGivenBy: typeof settingsIn.defaultGivenBy === 'string' ? settingsIn.defaultGivenBy : '',
      activeChildId,
      appearance,
      familyId: typeof settingsIn.familyId === 'string' ? settingsIn.familyId : null,
    },
  };
}
