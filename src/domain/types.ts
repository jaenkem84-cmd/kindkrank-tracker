export const MEASUREMENT_METHODS = ['rektal', 'axillar', 'oral', 'ohr', 'stirn'] as const;

export type MeasurementMethod = (typeof MEASUREMENT_METHODS)[number];

export type Appearance = 'system' | 'light' | 'dark';

export type Sex = 'maedchen' | 'junge';

export type PersonType = 'kind' | 'erwachsen';

/** Who this member is on this phone. Admin installs the app. Others may be invited. */
export type JoinStatus = 'admin' | 'eingeladen' | 'beigetreten' | 'ohne-app';

export const FRAME_COLORS = ['#3B82F6', '#E85A9B', '#F5A524', '#3DDC97', '#EF4444', '#8B5CF6'] as const;

export const CAREGIVER_ROLES = ['Vater', 'Mutter', 'Oma', 'Opa', 'Andere'] as const;

export type Person = {
  id: string;
  name: string;
  /** ISO date YYYY-MM-DD */
  birthDate: string;
  sex: Sex;
  personType: PersonType;
  /**
   * Kept only so older phrases like „Mama“ still match after migration.
   * The profile does not ask for a role.
   */
  role: string;
  /** The member using this phone. Voice phrases like "meine Temperatur" use this. */
  isSelf: boolean;
  /** The person who set up this family. There is one admin. */
  isAdmin: boolean;
  joinStatus: JoinStatus;
  defaultMethod: MeasurementMethod;
  frameColor: string;
  /** Gallery or camera image. Shown instead of the preset avatar. */
  photoUri?: string | null;
  /** MaterialCommunityIcons name. Empty means initials in the frame colour. */
  avatarIcon?: string | null;
  isExample: boolean;
  createdAt: string;
};

/** Entries still store this id as childId. It is the person id. */
export type Child = Person;

export type Caregiver = {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
};

export type TemperatureEntry = {
  id: string;
  childId: string;
  /** ISO timestamp */
  timestamp: string;
  celsius: number;
  method: MeasurementMethod;
  note: string;
  isExample: boolean;
};

export type Medication = {
  id: string;
  childId: string;
  name: string;
  /** Free text exactly as the parent entered it. The app never calculates a dose. */
  doseText: string;
  minIntervalHours: number;
  maxDosesPer24h: number;
  isExample: boolean;
};

export type DoseEntry = {
  id: string;
  childId: string;
  medicationId: string;
  timestamp: string;
  givenBy: string;
  doseText: string;
  note: string;
  /** True when the parent saved despite a min-interval or max-per-24h warning. */
  overridden: boolean;
  isExample: boolean;
};

export type GrowthEntry = {
  id: string;
  childId: string;
  timestamp: string;
  weightKg?: number;
  heightCm?: number;
  headCm?: number;
  isExample: boolean;
};

export type ReminderMode = 'daily' | 'after';

export type Reminder = {
  id: string;
  childId: string;
  kind: 'temperature' | 'medication';
  medicationId?: string;
  enabled: boolean;
  mode: ReminderMode;
  /** Local times HH:MM. The phone clock should be Europe/Berlin. */
  times: string[];
  /** Used when mode is "after". Chosen by the parent, never suggested as a dose interval. */
  hoursAfter: number;
};

export type Settings = {
  defaultMethod: MeasurementMethod;
  defaultGivenBy: string;
  activeChildId: string | null;
  appearance: Appearance;
  /** Set when this device has joined a Supabase family. Null while local-only. */
  familyId: string | null;
};

export type VaccinationEntry = {
  id: string;
  childId: string;
  /** ISO timestamp, the calendar day of the vaccination. */
  timestamp: string;
  /** Id from the bundled product list, or null if only diseases were chosen. */
  productId: string | null;
  /** Handelsname as shown to the parent. */
  productName: string;
  /** Antigen ids covered by this dose. */
  antigens: string[];
  batch: string;
  doctor: string;
  note: string;
  isExample: boolean;
};

/** A symptom the family added. Shared by every person, not tied to one child. */
export const INVITE_RELATIONS = [
  { id: 'partner', label: 'Partner/in' },
  { id: 'mutter', label: 'Mutter' },
  { id: 'vater', label: 'Vater' },
  { id: 'grossmutter', label: 'Großmutter' },
  { id: 'grossvater', label: 'Großvater' },
  { id: 'geschwister', label: 'Geschwister' },
  { id: 'betreuer', label: 'Betreuer/in' },
  { id: 'sonstige', label: 'Sonstige' },
] as const;

export type InviteRelation = (typeof INVITE_RELATIONS)[number]['id'];

/** Relationship lives on the invite, not on the person's profile. */
export type FamilyInvite = {
  id: string;
  token: string;
  personId: string | null;
  name: string;
  relation: InviteRelation;
  createdAt: string;
  expiresAt: string;
  status: 'offen' | 'zurueckgezogen';
};

export type CustomSymptom = {
  id: string;
  name: string;
  /** MaterialCommunityIcons glyph name. */
  icon: string;
};

export type SymptomEntry = {
  id: string;
  childId: string;
  timestamp: string;
  /** Id from the chip list, or null for free text. */
  symptomId: string | null;
  label: string;
  /** 1 leicht, 2 mittel, 3 stark. Omitted when the parent did not choose. */
  severity: 1 | 2 | 3 | null;
  note: string;
  isExample: boolean;
};

export type AppData = {
  version: 5;
  children: Person[];
  caregivers: Caregiver[];
  temperatures: TemperatureEntry[];
  medications: Medication[];
  doses: DoseEntry[];
  growth: GrowthEntry[];
  vaccinations: VaccinationEntry[];
  symptoms: SymptomEntry[];
  customSymptoms: CustomSymptom[];
  reminders: Reminder[];
  invites: FamilyInvite[];
  settings: Settings;
};

export const METHOD_LABELS: Record<MeasurementMethod, string> = {
  rektal: 'rektal',
  axillar: 'axillar',
  oral: 'oral',
  ohr: 'Ohr',
  stirn: 'Stirn',
};

export const MEDICAL_DISCLAIMER =
  'Keine Diagnose und keine Dosierungsempfehlung. Die Linien im Fieberdiagramm sind nur eine Orientierung. Abstände, Höchstmengen und Erinnerungen trägst du selbst ein.';
