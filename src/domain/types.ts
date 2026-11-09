export const MEASUREMENT_METHODS = ['rektal', 'axillar', 'oral', 'ohr', 'stirn'] as const;

export type MeasurementMethod = (typeof MEASUREMENT_METHODS)[number];

export type Appearance = 'system' | 'light' | 'dark';

export type Child = {
  id: string;
  name: string;
  /** ISO date YYYY-MM-DD */
  birthDate: string;
  isExample: boolean;
  createdAt: string;
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

export type Settings = {
  /** How many weeks of measurements the fever chart may include. Default 5. */
  chartWindowWeeks: number;
  defaultMethod: MeasurementMethod;
  defaultGivenBy: string;
  activeChildId: string | null;
  appearance: Appearance;
};

export type AppData = {
  version: 1;
  children: Child[];
  temperatures: TemperatureEntry[];
  medications: Medication[];
  doses: DoseEntry[];
  growth: GrowthEntry[];
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
  'Keine Diagnose und keine Dosierungsempfehlung. Die Linien im Diagramm sind nur eine Orientierung. Abstände und Höchstmengen trägst du selbst ein, so wie sie auf dem Beipackzettel stehen oder von Ärztin, Arzt oder Apotheke genannt wurden.';
