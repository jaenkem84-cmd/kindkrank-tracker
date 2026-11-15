import type { TemperatureEntry } from './types';

/** Gap that starts a new illness episode. The chart shows the latest episode inside the window. */
export const ILLNESS_GAP_HOURS = 48;

const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;

export function temperaturesForChart(
  entries: TemperatureEntry[],
  now: Date,
  windowWeeks: number,
  gapHours = ILLNESS_GAP_HOURS,
): TemperatureEntry[] {
  const start = now.getTime() - windowWeeks * WEEK_MS;
  const end = now.getTime() + 60_000;
  const inWindow = entries
    .filter((entry) => {
      const time = new Date(entry.timestamp).getTime();
      return time >= start && time <= end;
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (inWindow.length === 0) return [];

  const episode: TemperatureEntry[] = [inWindow[inWindow.length - 1]];
  for (let index = inWindow.length - 2; index >= 0; index -= 1) {
    const newer = new Date(episode[0].timestamp).getTime();
    const older = new Date(inWindow[index].timestamp).getTime();
    if (newer - older <= gapHours * HOUR_MS) episode.unshift(inWindow[index]);
    else break;
  }
  return episode;
}
