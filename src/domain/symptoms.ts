export const SYMPTOM_CHIPS = [
  { id: 'husten', label: 'Husten' },
  { id: 'schnupfen', label: 'Schnupfen' },
  { id: 'erbrechen', label: 'Erbrechen' },
  { id: 'durchfall', label: 'Durchfall' },
  { id: 'ausschlag', label: 'Ausschlag' },
  { id: 'ohr', label: 'Ohrenschmerzen' },
  { id: 'hals', label: 'Halsschmerzen' },
  { id: 'appetit', label: 'Appetitlosigkeit' },
  { id: 'trinken', label: 'wenig getrunken' },
  { id: 'schlapp', label: 'Müdigkeit/schlapp' },
  { id: 'atemnot', label: 'Atemnot' },
  { id: 'krampf', label: 'Krampf' },
] as const;

export type SymptomChipId = (typeof SYMPTOM_CHIPS)[number]['id'];

/** Folded phrases that mean a chip. Longer phrases are tried first by the parser. */
export const SYMPTOM_PATTERNS: { id: SymptomChipId; phrases: string[] }[] = [
  { id: 'erbrechen', phrases: ['hat erbrochen', 'erbrochen', 'erbricht', 'erbrechen', 'gekotzt'] },
  { id: 'durchfall', phrases: ['durchfall', 'durchfallt'] },
  { id: 'schnupfen', phrases: ['schnupfen', 'laufende nase'] },
  { id: 'husten', phrases: ['husten', 'hustet'] },
  { id: 'ausschlag', phrases: ['ausschlag'] },
  { id: 'ohr', phrases: ['ohrenschmerzen', 'ohrweh'] },
  { id: 'hals', phrases: ['halsschmerzen', 'halsweh'] },
  { id: 'appetit', phrases: ['appetitlosigkeit', 'keinen appetit', 'isst nicht', 'isst nichts'] },
  { id: 'trinken', phrases: ['wenig getrunken', 'trinkt wenig', 'trinkt nichts'] },
  { id: 'schlapp', phrases: ['muedigkeit', 'schlapp', 'muede'] },
  { id: 'atemnot', phrases: ['atemnot', 'atmet schwer'] },
  { id: 'krampf', phrases: ['krampf', 'krampft', 'krampfanfall'] },
];

export function symptomLabel(id: string): string {
  return SYMPTOM_CHIPS.find((chip) => chip.id === id)?.label ?? id;
}
