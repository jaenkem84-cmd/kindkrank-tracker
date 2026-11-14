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
