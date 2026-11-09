export const TIME_ZONE = 'Europe/Berlin';

export type BerlinParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function berlinParts(date: Date, timeZone = TIME_ZONE): BerlinParts {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = berlinParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function zonedDateTime(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone = TIME_ZONE,
): Date {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  const offset = zoneOffsetMs(new Date(utcGuess), timeZone);
  let result = new Date(utcGuess - offset);
  const offset2 = zoneOffsetMs(result, timeZone);
  if (offset2 !== offset) result = new Date(utcGuess - offset2);
  return result;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDate(date: Date): string {
  const parts = berlinParts(date);
  return `${pad(parts.day)}.${pad(parts.month)}.${parts.year}`;
}

export function formatTime(date: Date): string {
  const parts = berlinParts(date);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatDateIso(date: Date): string {
  const parts = berlinParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function addCalendarDays(
  date: Date,
  days: number,
): { year: number; month: number; day: number } {
  const parts = berlinParts(date);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function sameBerlinDay(a: Date, b: Date): boolean {
  const left = berlinParts(a);
  const right = berlinParts(b);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

export function parseGermanDate(input: string): { year: number; month: number; day: number } | null {
  const match = input.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function parseClock(input: string): { hour: number; minute: number } | null {
  const match = input.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function combineBerlin(dateText: string, timeText: string): Date | null {
  const date = parseGermanDate(dateText);
  const time = parseClock(timeText);
  if (!date || !time) return null;
  return zonedDateTime({ ...date, ...time });
}

export function dateFieldValue(date: Date): string {
  return formatDate(date);
}

export function timeFieldValue(date: Date): string {
  return formatTime(date);
}

export function birthDateToIso(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function isoDateToGerman(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function ageLabel(birthDateIso: string, now: Date): string {
  const match = birthDateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const today = berlinParts(now);
  let months = (today.year - year) * 12 + (today.month - month);
  if (today.day < day) months -= 1;
  if (months < 0) return 'Geburtsdatum liegt in der Zukunft';
  if (months === 0) {
    const start = Date.UTC(year, month - 1, day);
    const end = Date.UTC(today.year, today.month - 1, today.day);
    const days = Math.round((end - start) / 86_400_000);
    if (days <= 0) return 'heute geboren';
    return days === 1 ? '1 Tag' : `${days} Tage`;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return rem === 1 ? '1 Monat' : `${rem} Monate`;
  const yearText = years === 1 ? '1 Jahr' : `${years} Jahre`;
  if (rem === 0) return yearText;
  return `${yearText}, ${rem === 1 ? '1 Monat' : `${rem} Monate`}`;
}

export function greeting(now: Date): string {
  const hour = berlinParts(now).hour;
  if (hour < 5 || hour >= 22) return 'Gute Nacht';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function shiftMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function startOfBerlinDay(date: Date): Date {
  const parts = berlinParts(date);
  return zonedDateTime({ year: parts.year, month: parts.month, day: parts.day, hour: 0, minute: 0 });
}

export function endOfBerlinDay(date: Date): Date {
  const next = addCalendarDays(date, 1);
  return new Date(zonedDateTime({ ...next, hour: 0, minute: 0 }).getTime() - 1);
}

export function shiftBerlinDays(date: Date, days: number): Date {
  const shifted = addCalendarDays(date, days);
  return zonedDateTime({ ...shifted, hour: 12, minute: 0 });
}

const WEEKDAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
const MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];

export function weekdayIndex(date: Date): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(label);
}

export function formatDayHeading(date: Date): string {
  const parts = berlinParts(date);
  const weekday = WEEKDAYS[weekdayIndex(date)] ?? '';
  return `${weekday}, ${parts.day}. ${MONTHS[parts.month - 1]}`;
}

export function formatShortDay(date: Date): string {
  const parts = berlinParts(date);
  const weekday = (WEEKDAYS[weekdayIndex(date)] ?? '').replace('.', '');
  return `${weekday} ${parts.day}.${parts.month}.`;
}

/** Whole weeks and leftover days between the Berlin calendar dates. */
export function ageWeeksDays(birthDateIso: string, now: Date): { weeks: number; days: number } | null {
  const match = birthDateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const birth = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = berlinParts(now);
  const end = Date.UTC(today.year, today.month - 1, today.day);
  const diff = Math.round((end - birth) / 86_400_000);
  if (diff < 0) return { weeks: 0, days: 0 };
  return { weeks: Math.floor(diff / 7), days: diff % 7 };
}

export function formatAgeWeeks(birthDateIso: string, now: Date): string {
  const age = ageWeeksDays(birthDateIso, now);
  if (!age) return '';
  const weeks = age.weeks === 1 ? '1 Woche' : `${age.weeks} Wochen`;
  const days = age.days === 1 ? '1 Tag' : `${age.days} Tage`;
  return `${weeks} ${days}`;
}

/** Approximate age in months, using the Berlin calendar date of `at`. */
export function ageMonths(birthDateIso: string, at: Date): number {
  const match = birthDateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 0;
  const birth = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parts = berlinParts(at);
  const then = Date.UTC(parts.year, parts.month - 1, parts.day);
  return Math.max(0, (then - birth) / (30.4375 * 86_400_000));
}
