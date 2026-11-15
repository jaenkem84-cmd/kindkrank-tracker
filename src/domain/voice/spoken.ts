import { METHOD_LABELS, type MeasurementMethod } from '../types';
import { formatDecimal } from '../format';

export function speakClock(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time.trim();
  return `${Number(match[1])}:${match[2]} Uhr`;
}

export function speakWhen(date: string, time: string, today: string): string {
  const clock = speakClock(time);
  if (!date || date === today) return clock;
  const [, month, day] = date.split('-');
  if (!month || !day) return clock;
  return `${Number(day)}.${Number(month)}., ${clock}`;
}

export function temperatureDetail(celsius: number, method: MeasurementMethod): string {
  return `${formatDecimal(celsius, 1)} Grad ${METHOD_LABELS[method]}`;
}

export function spokenSavePrompt(personName: string, detail: string, when: string): string {
  const head = [personName.trim(), detail.trim()].filter(Boolean).join(', ');
  return `${head}, ${when}. Speichern?`;
}

const DOSE_ORDINALS = ['', 'erste', 'zweite', 'dritte', 'vierte', 'fünfte', 'sechste', 'siebte', 'achte', 'neunte', 'zehnte', 'elfte', 'zwölfte'];

export function doseOrdinal(count: number): string {
  if (count >= 1 && count < DOSE_ORDINALS.length) return DOSE_ORDINALS[count];
  return `${count}.`;
}

function spokenHours(hours: number): string {
  const text = Number.isInteger(hours) ? String(hours) : String(hours).replace('.', ',');
  return `${text} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
}

/** Spoken and shown when a parent-set medication limit would be crossed. */
export function limitQuestion(input: {
  medicationName: string;
  minIntervalHours: number;
  nextCount: number;
  tooSoon: boolean;
  exceedsMax: boolean;
}): string {
  const parts: string[] = [];
  const name = input.medicationName.trim() || 'Das Medikament';
  if (input.exceedsMax) parts.push(`${name} wäre die ${doseOrdinal(input.nextCount)} Gabe in 24 Stunden.`);
  if (input.tooSoon) parts.push(`Der Mindestabstand von ${spokenHours(input.minIntervalHours)} ist noch nicht erreicht.`);
  if (parts.length === 0) parts.push('Die eingegebene Grenze wäre überschritten.');
  parts.push('Trotzdem eintragen?');
  return parts.join(' ');
}
