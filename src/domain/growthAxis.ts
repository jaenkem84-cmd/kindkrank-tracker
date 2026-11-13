/** Month lines follow the selected age window. Labels restart inside each year of life. */
export function growthGridStep(months: number): 2 | 4 | 6 {
  if (months <= 12) return 2;
  if (months <= 24) return 4;
  return 6;
}

export type GrowthAxisMark = { x: number; strong: boolean; label: string };

export function growthAxis(months: number): GrowthAxisMark[] {
  const step = growthGridStep(months);
  const marks: GrowthAxisMark[] = [];
  for (let month = 0; month <= months; month += step) {
    const yearBoundary = month !== 0 && month % 12 === 0;
    const label = month === 0 ? '0' : yearBoundary ? `${month / 12} J` : String(month % 12);
    marks.push({ x: month, strong: month % 12 === 0, label });
  }
  return marks;
}
