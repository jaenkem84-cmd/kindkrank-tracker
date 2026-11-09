import { formatDateTime } from './dates';
import type { AppData } from './types';

export type CsvFile = { name: string; contents: string };

function escape(value: string): string {
  if (/[";\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => escape(cell ?? '')).join(';'));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function childName(data: AppData, childId: string): string {
  return data.children.find((child) => child.id === childId)?.name ?? '';
}

function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return formatDateTime(date);
}

function flag(value: boolean): string {
  return value ? 'ja' : 'nein';
}

export function buildExportFiles(data: AppData): CsvFile[] {
  const kinder = toCsv(
    ['id', 'name', 'geburtsdatum', 'geschlecht', 'rahmenfarbe', 'beispiel', 'angelegt_am'],
    data.children.map((child) => [
      child.id,
      child.name,
      child.birthDate,
      child.sex,
      child.frameColor,
      flag(child.isExample),
      stamp(child.createdAt),
    ]),
  );

  const temperatur = toCsv(
    ['id', 'kind_id', 'kind', 'zeitpunkt', 'celsius', 'methode', 'notiz', 'beispiel'],
    data.temperatures.map((entry) => [
      entry.id,
      entry.childId,
      childName(data, entry.childId),
      stamp(entry.timestamp),
      String(entry.celsius).replace('.', ','),
      entry.method,
      entry.note,
      flag(entry.isExample),
    ]),
  );

  const medikamente = toCsv(
    ['id', 'kind_id', 'kind', 'name', 'dosis', 'mindestabstand_stunden', 'max_gaben_24h', 'beispiel'],
    data.medications.map((med) => [
      med.id,
      med.childId,
      childName(data, med.childId),
      med.name,
      med.doseText,
      String(med.minIntervalHours).replace('.', ','),
      String(med.maxDosesPer24h),
      flag(med.isExample),
    ]),
  );

  const medName = (id: string) => data.medications.find((med) => med.id === id)?.name ?? '';
  const gaben = toCsv(
    ['id', 'kind_id', 'kind', 'medikament_id', 'medikament', 'zeitpunkt', 'gegeben_von', 'dosis', 'trotz_hinweis', 'notiz', 'beispiel'],
    data.doses.map((dose) => [
      dose.id,
      dose.childId,
      childName(data, dose.childId),
      dose.medicationId,
      medName(dose.medicationId),
      stamp(dose.timestamp),
      dose.givenBy,
      dose.doseText,
      flag(dose.overridden),
      dose.note,
      flag(dose.isExample),
    ]),
  );

  const wachstum = toCsv(
    ['id', 'kind_id', 'kind', 'zeitpunkt', 'gewicht_kg', 'groesse_cm', 'kopfumfang_cm', 'beispiel'],
    data.growth.map((entry) => [
      entry.id,
      entry.childId,
      childName(data, entry.childId),
      stamp(entry.timestamp),
      entry.weightKg === undefined ? '' : String(entry.weightKg).replace('.', ','),
      entry.heightCm === undefined ? '' : String(entry.heightCm).replace('.', ','),
      entry.headCm === undefined ? '' : String(entry.headCm).replace('.', ','),
      flag(entry.isExample),
    ]),
  );

  const familie = toCsv(
    ['id', 'name', 'rolle', 'ist_konto'],
    data.caregivers.map((person) => [person.id, person.name, person.role, flag(person.isOwner)]),
  );
  const erinnerungen = toCsv(
    ['id', 'kind_id', 'kind', 'art', 'medikament_id', 'medikament', 'aktiv', 'modus', 'uhrzeiten', 'stunden_danach'],
    data.reminders.map((reminder) => [
      reminder.id,
      reminder.childId,
      childName(data, reminder.childId),
      reminder.kind,
      reminder.medicationId ?? '',
      reminder.medicationId ? medName(reminder.medicationId) : '',
      flag(reminder.enabled),
      reminder.mode,
      reminder.times.join(' '),
      String(reminder.hoursAfter).replace('.', ','),
    ]),
  );

  return [
    { name: 'kinder.csv', contents: kinder },
    { name: 'temperatur.csv', contents: temperatur },
    { name: 'medikamente.csv', contents: medikamente },
    { name: 'gaben.csv', contents: gaben },
    { name: 'wachstum.csv', contents: wachstum },
    { name: 'familie.csv', contents: familie },
    { name: 'erinnerungen.csv', contents: erinnerungen },
  ];
}
