import type { TemperatureEntry } from '../../domain/types';

/** One palette for every medication, shared by the curve markers and the legend. */
export const MED_MARKER_COLORS = ['#E7C27A', '#7EB6E0', '#D7A0AE', '#9BC7A4'] as const;

export const DOSE_MARKER_OPACITY = 0.55;
export const DOSE_MARKER_RADIUS = 5.5;
export const DOSE_MARKER_STROKE = 1.5;

export function doseMarkerPaint(index: number): { fill: string; opacity: number; r: number; stroke: string; strokeWidth: number } {
  const fill = MED_MARKER_COLORS[index % MED_MARKER_COLORS.length];
  return {
    fill,
    opacity: DOSE_MARKER_OPACITY,
    r: DOSE_MARKER_RADIUS,
    stroke: fill,
    strokeWidth: DOSE_MARKER_STROKE,
  };
}

export function symptomMarkColor(dark: boolean): string {
  return dark ? '#E7C27A' : '#8A5A16';
}

/** Drop a trailing dosage form so the legend stays short. */
export function shortMedicationName(name: string): string {
  const cleaned = name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[-\s]+(zäpfchen|zaepfchen|saft|tabletten|tablette|kapseln|kapsel|tropfen|sirup|salbe|creme|gel|spray)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || name.trim();
}

/** Temperature on the fever curve at `time`, clamped to the nearest measurement outside the series. */
export function temperatureOnCurve(entries: TemperatureEntry[], time: number): number | null {
  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (sorted.length === 0) return null;
  const times = sorted.map((entry) => new Date(entry.timestamp).getTime());
  if (time <= times[0]) return sorted[0].celsius;
  const last = times.length - 1;
  if (time >= times[last]) return sorted[last].celsius;
  let index = 0;
  while (index < last - 1 && times[index + 1] < time) index += 1;
  const span = times[index + 1] - times[index];
  if (span <= 0) return sorted[index].celsius;
  const fraction = (time - times[index]) / span;
  return sorted[index].celsius + (sorted[index + 1].celsius - sorted[index].celsius) * fraction;
}
