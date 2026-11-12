import type { MeasurementMethod } from '../types';

export type ParserChild = {
  id: string;
  name: string;
  role?: string;
  isSelf?: boolean;
  defaultMethod?: MeasurementMethod;
};

export type ParserMedication = {
  id: string;
  childId: string;
  name: string;
  doseText: string;
};

export type ParseContext = {
  now: Date;
  children: ParserChild[];
  medications: ParserMedication[];
  activeChildId: string | null;
  defaultMethod: MeasurementMethod;
  defaultGivenBy: string;
  /** Last logged dose text per medication. Preferred over the medication default. */
  lastDoseTextByMedicationId?: Record<string, string>;
};

export type TemperatureIntent = {
  type: 'temperature';
  childId: string | null;
  timestamp: string;
  celsius: number;
  method: MeasurementMethod;
};

export type DoseIntent = {
  type: 'dose';
  childId: string | null;
  timestamp: string;
  medicationId: string | null;
  medicationQuery: string;
  candidateIds: string[];
  doseText: string | null;
  givenBy: string;
};

export type GrowthIntent = {
  type: 'growth';
  childId: string | null;
  timestamp: string;
  weightKg: number | null;
  heightCm: number | null;
  headCm: number | null;
};

export type SymptomIntent = {
  type: 'symptom';
  childId: string | null;
  timestamp: string;
  symptomId: string;
  label: string;
  severity: 1 | 2 | 3 | null;
};

export type UnknownIntent = {
  type: 'unknown';
  text: string;
};

export type Intent = TemperatureIntent | DoseIntent | GrowthIntent | SymptomIntent | UnknownIntent;

export type ParseResult = {
  intent: Intent;
  summary: string;
  parserId: string;
  /** More than one person matched the sentence. */
  personAmbiguous?: boolean;
  personCandidateIds?: string[];
};

/**
 * A parser may return null when it does not handle the phrase, so a later parser
 * (for example a Gemini adapter) can try. Return an unknown intent only from the
 * final fallback.
 */
export interface EntryParser {
  id: string;
  parse(text: string, context: ParseContext): ParseResult | null | Promise<ParseResult | null>;
}
