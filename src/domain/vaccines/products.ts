/**
 * Common childhood vaccine products on the German market and the antigens
 * named in their Fachinformation.
 *
 * This list is a parent-facing aid, not a product database of the
 * Paul-Ehrlich-Institut. Trade names, combinations and licensed ages change.
 * Check the current Fachinformation or the PEI vaccine list before relying on it:
 * https://www.pei.de/DE/arzneimittel/impfstoffe/impfstoffe-node.html
 */

export type AntigenId =
  | 'diphtherie'
  | 'tetanus'
  | 'pertussis'
  | 'hib'
  | 'polio'
  | 'hepatitisB'
  | 'pneumokokken'
  | 'rotaviren'
  | 'menb'
  | 'masern'
  | 'mumps'
  | 'roeteln'
  | 'varizellen'
  | 'menacwy';

export const ANTIGEN_LABELS: Record<AntigenId, string> = {
  diphtherie: 'Diphtherie',
  tetanus: 'Tetanus',
  pertussis: 'Pertussis',
  hib: 'Hib',
  polio: 'Polio',
  hepatitisB: 'Hepatitis B',
  pneumokokken: 'Pneumokokken',
  rotaviren: 'Rotaviren',
  menb: 'Meningokokken B',
  masern: 'Masern',
  mumps: 'Mumps',
  roeteln: 'Röteln',
  varizellen: 'Varizellen',
  menacwy: 'Meningokokken ACWY',
};

const SIX = ['diphtherie', 'tetanus', 'pertussis', 'hib', 'polio', 'hepatitisB'] as const;
const MMR = ['masern', 'mumps', 'roeteln'] as const;

export type VaccineProduct = {
  id: string;
  /** Handelsname. */
  name: string;
  antigens: readonly AntigenId[];
  /** Short note when the product is easy to confuse. Needs Fachinformation check. */
  note?: string;
};

export const VACCINE_PRODUCTS: readonly VaccineProduct[] = [
  { id: 'hexyon', name: 'Hexyon', antigens: SIX },
  { id: 'infanrix-hexa', name: 'Infanrix hexa', antigens: SIX },
  { id: 'vaxelis', name: 'Vaxelis', antigens: SIX },
  { id: 'priorix', name: 'Priorix', antigens: MMR },
  { id: 'mmr-vaxpro', name: 'M-M-RvaxPro', antigens: MMR },
  { id: 'priorix-tetra', name: 'Priorix-Tetra', antigens: [...MMR, 'varizellen'] },
  { id: 'proquad', name: 'ProQuad', antigens: [...MMR, 'varizellen'] },
  { id: 'varivax', name: 'Varivax', antigens: ['varizellen'] },
  { id: 'prevenar13', name: 'Prevenar 13', antigens: ['pneumokokken'], note: 'PCV13. Zusammensetzung laut Fachinformation prüfen.' },
  { id: 'vaxneuvance', name: 'Vaxneuvance', antigens: ['pneumokokken'], note: 'PCV15.' },
  { id: 'prevenar20', name: 'Prevenar 20', antigens: ['pneumokokken'], note: 'PCV20. Für Säuglinge die STIKO-Fußnote zu PCV13/PCV15 beachten.' },
  { id: 'synflorix', name: 'Synflorix', antigens: ['pneumokokken'], note: 'PCV10.' },
  { id: 'bexsero', name: 'Bexsero', antigens: ['menb'] },
  { id: 'nimenrix', name: 'Nimenrix', antigens: ['menacwy'] },
  { id: 'menquadfi', name: 'MenQuadfi', antigens: ['menacwy'] },
  { id: 'rotarix', name: 'Rotarix', antigens: ['rotaviren'], note: 'Schluckimpfung, meist 2 Dosen. Zeitfenster laut Fachinformation.' },
  { id: 'rotateq', name: 'RotaTeq', antigens: ['rotaviren'], note: 'Schluckimpfung, meist 3 Dosen. Zeitfenster laut Fachinformation.' },
  { id: 'boostrix', name: 'Boostrix', antigens: ['diphtherie', 'tetanus', 'pertussis'], note: 'Tdap-Auffrischung, nicht die Säuglings-Grundimmunisierung.' },
];

export function productById(id: string | null | undefined): VaccineProduct | undefined {
  return VACCINE_PRODUCTS.find((product) => product.id === id);
}
