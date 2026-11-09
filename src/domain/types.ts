export const MEASUREMENT_METHODS = ['rektal', 'axillar', 'oral', 'ohr', 'stirn'] as const;

export type MeasurementMethod = (typeof MEASUREMENT_METHODS)[number];

export type Appearance = 'system' | 'light' | 'dark';

export type Sex = 'maedchen' | 'junge';

export const FRAME_COLORS = ['#3B82F6', '#E85A9B', '#F5A524', '#3DDC97', '#EF4444', '#8B5CF6'] as const;

export const CAREGIVER_ROLES = ['Vater', 'Mutter', 'Oma', 'Opa', 'Andere'] as const;

export type Child = {
  id: string;
  name: string;
  /** ISO date YYYY-MM-DD */
  birthDate: string;
  sex: Sex;
  frameColor: string;
  isExample: boolean;
  createdAt: string;
};

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
  version: 3;
  children: Child[];
  caregivers: Caregiver[];
  temperatures: TemperatureEntry[];
  medications: Medication[];
  doses: DoseEntry[];
  growth: GrowthEntry[];
  vaccinations: VaccinationEntry[];
  symptoms: SymptomEntry[];
  reminders: Reminder[];
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
