import { sameBerlinDay } from './dates';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type DoseStamp = { timestamp: string };

export type DoseAssessment = {
  lastDoseAt: string | null;
  hoursSince: number | null;
  nextEarliest: Date | null;
  /** Doses already logged in the 24 hours before `at` (the new dose is not included). */
  count24h: number;
  countToday: number;
  maxPer24h: number;
  minIntervalHours: number;
  tooSoon: boolean;
  exceedsMax: boolean;
};

function timeOf(stamp: DoseStamp): number {
  return new Date(stamp.timestamp).getTime();
}

/**
 * Checks parent-entered limits only. A dose is too soon when it falls inside the
 * minimum interval before the previous dose or before the next already logged dose.
 * The 24-hour maximum counts existing doses in the open-closed window (at-24h, at].
 * A dose exactly 24 hours earlier does not count.
 */
export function assessDose(input: {
  doses: DoseStamp[];
  minIntervalHours: number;
  maxPer24h: number;
  at: Date;
}): DoseAssessment {
  const atMs = input.at.getTime();
  const intervalMs = input.minIntervalHours * HOUR_MS;
  const sorted = [...input.doses].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const previous = [...sorted].reverse().find((dose) => timeOf(dose) <= atMs) ?? null;
  const following = sorted.find((dose) => timeOf(dose) > atMs) ?? null;

  const previousMs = previous ? timeOf(previous) : null;
  const hoursSince = previousMs === null ? null : (atMs - previousMs) / HOUR_MS;
  const nextEarliest = previousMs === null ? null : new Date(previousMs + intervalMs);

  const tooSoonBefore = nextEarliest !== null && atMs + 1000 < nextEarliest.getTime();
  const tooSoonAfter = following !== null && timeOf(following) - atMs + 1000 < intervalMs;
  const windowStart = atMs - DAY_MS;
  const count24h = input.doses.filter((dose) => {
    const time = timeOf(dose);
    return time > windowStart && time <= atMs;
  }).length;
  const countToday = input.doses.filter(
    (dose) => timeOf(dose) <= atMs + 60_000 && sameBerlinDay(new Date(dose.timestamp), input.at),
  ).length;

  return {
    lastDoseAt: previous?.timestamp ?? null,
    hoursSince,
    nextEarliest,
    count24h,
    countToday,
    maxPer24h: input.maxPer24h,
    minIntervalHours: input.minIntervalHours,
    tooSoon: tooSoonBefore || tooSoonAfter,
    exceedsMax: count24h + 1 > input.maxPer24h,
  };
}

export function latestDose<T extends DoseStamp>(doses: T[]): T | null {
  return doses.reduce<T | null>((best, dose) => {
    if (!best || dose.timestamp > best.timestamp) return dose;
    return best;
  }, null);
}
