import table from './who2006-lms.json';

export type GrowthMetric = 'weight' | 'height' | 'head';
export type GrowthSex = 'maedchen' | 'junge';

type LmsRow = [number, number, number, number];

export const WHO_CITATION =
  'Perzentile nach WHO Child Growth Standards (2006), LMS-Parameter für Gewicht, Länge/Körperhöhe und Kopfumfang, 0–5 Jahre. Länge bis 2 Jahre, danach Körperhöhe, wie in der WHO-Tabelle zusammengeführt.';

export const PERCENTILES = [
  { id: 'P3', z: -1.8807936081512509 },
  { id: 'P15', z: -1.0364333894937896 },
  { id: 'P50', z: 0 },
  { id: 'P85', z: 1.0364333894937896 },
  { id: 'P97', z: 1.8807936081512509 },
] as const;

const seriesKey: Record<GrowthMetric, 'weight' | 'length' | 'head'> = {
  weight: 'weight',
  height: 'length',
  head: 'head',
};

function rowsFor(metric: GrowthMetric, sex: GrowthSex): LmsRow[] {
  const key = seriesKey[metric];
  const sexKey = sex === 'junge' ? 'boys' : 'girls';
  return table.series[key][sexKey] as LmsRow[];
}

export function lmsAt(metric: GrowthMetric, sex: GrowthSex, ageMonths: number): { l: number; m: number; s: number } | null {
  const rows = rowsFor(metric, sex);
  if (rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return null;
  const month = Math.min(last[0], Math.max(first[0], ageMonths));
  let low = 0;
  let high = rows.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    const row = rows[mid];
    if (row && row[0] <= month) low = mid;
    else high = mid;
  }
  const left = rows[low];
  const right = rows[high];
  if (!left || !right) return null;
  const span = right[0] - left[0] || 1;
  const t = (month - left[0]) / span;
  const mix = (index: 1 | 2 | 3) => left[index] + (right[index] - left[index]) * t;
  return { l: mix(1), m: mix(2), s: mix(3) };
}

/** Measurement at a WHO percentile from the LMS parameters. */
export function valueAtZ(l: number, m: number, s: number, z: number): number {
  if (Math.abs(l) < 1e-7) return m * Math.exp(s * z);
  const base = 1 + l * s * z;
  if (base <= 0) return Number.NaN;
  return m * base ** (1 / l);
}

/** Closest labelled percentile for a measurement. Orientation only. */
export function nearestPercentile(metric: GrowthMetric, sex: GrowthSex, ageMonths: number, value: number): string | null {
  const lms = lmsAt(metric, sex, ageMonths);
  if (!lms) return null;
  let best: { id: string; distance: number } | null = null;
  for (const band of PERCENTILES) {
    const at = valueAtZ(lms.l, lms.m, lms.s, band.z);
    if (!Number.isFinite(at)) continue;
    const distance = Math.abs(at - value);
    if (!best || distance < best.distance) best = { id: band.id, distance };
  }
  return best?.id ?? null;
}

export function percentileCurve(
  metric: GrowthMetric,
  sex: GrowthSex,
  fromMonth: number,
  toMonth: number,
  step = 0.5,
): { month: number; values: Record<string, number> }[] {
  const start = Math.max(0, fromMonth);
  const end = Math.min(60, toMonth);
  const points: { month: number; values: Record<string, number> }[] = [];
  for (let month = start; month <= end + 1e-6; month += step) {
    const lms = lmsAt(metric, sex, month);
    if (!lms) continue;
    const values: Record<string, number> = {};
    for (const band of PERCENTILES) {
      const value = valueAtZ(lms.l, lms.m, lms.s, band.z);
      if (Number.isFinite(value)) values[band.id] = value;
    }
    points.push({ month, values });
  }
  return points;
}
