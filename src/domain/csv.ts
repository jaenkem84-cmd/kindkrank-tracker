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

function personFields(data: AppData, personId: string): string[] {
  const person = data.children.find((item) => item.id === personId);
  const typ = person?.personType === 'erwachsen' ? 'Erwachsener' : person ? 'Kind' : '';
  return [personId, person?.name ?? '', typ];
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
  const personen = toCsv(
    ['id', 'name', 'person_typ', 'geburtsdatum', 'geschlecht', 'rolle', 'das_bin_ich', 'standard_messart', 'rahmenfarbe', 'beispiel', 'angelegt_am'],
    data.children.map((child) => [
      child.id,
      child.name,
      child.personType === 'erwachsen' ? 'Erwachsener' : 'Kind',
      child.birthDate,
      child.sex,
      child.role,
      flag(child.isSelf),
      child.defaultMethod,
      child.frameColor,
      flag(child.isExample),
      stamp(child.createdAt),
    ]),
  );

  const temperatur = toCsv(
    ['id', 'person_id', 'person', 'person_typ', 'zeitpunkt', 'celsius', 'methode', 'notiz', 'beispiel'],
    data.temperatures.map((entry) => [
      entry.id,
      ...personFields(data, entry.childId),
      stamp(entry.timestamp),
      String(entry.celsius).replace('.', ','),
      entry.method,
      entry.note,
      flag(entry.isExample),
    ]),
  );

  const medikamente = toCsv(
    ['id', 'person_id', 'person', 'person_typ', 'name', 'dosis', 'mindestabstand_stunden', 'max_gaben_24h', 'beispiel'],
    data.medications.map((med) => [
      med.id,
      ...personFields(data, med.childId),
      med.name,
      med.doseText,
      String(med.minIntervalHours).replace('.', ','),
      String(med.maxDosesPer24h),
      flag(med.isExample),
    ]),
  );

  const medName = (id: string) => data.medications.find((med) => med.id === id)?.name ?? '';
  const gaben = toCsv(
    ['id', 'person_id', 'person', 'person_typ', 'medikament_id', 'medikament', 'zeitpunkt', 'gegeben_von', 'dosis', 'trotz_hinweis', 'notiz', 'beispiel'],
    data.doses.map((dose) => [
      dose.id,
      ...personFields(data, dose.childId),
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
    ['id', 'person_id', 'person', 'person_typ', 'zeitpunkt', 'gewicht_kg', 'groesse_cm', 'kopfumfang_cm', 'beispiel'],
    data.growth.map((entry) => [
      entry.id,
      ...personFields(data, entry.childId),
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
    ['id', 'person_id', 'person', 'person_typ', 'art', 'medikament_id', 'medikament', 'aktiv', 'modus', 'uhrzeiten', 'stunden_danach'],
    data.reminders.map((reminder) => [
      reminder.id,
      ...personFields(data, reminder.childId),
      reminder.kind,
      reminder.medicationId ?? '',
      reminder.medicationId ? medName(reminder.medicationId) : '',
      flag(reminder.enabled),
      reminder.mode,
      reminder.times.join(' '),
      String(reminder.hoursAfter).replace('.', ','),
    ]),
  );

  const impfungen = toCsv(
    ['id', 'person_id', 'person', 'person_typ', 'zeitpunkt', 'handelsname', 'antigene', 'charge', 'arzt', 'notiz', 'beispiel'],
    data.vaccinations.map((entry) => [
      entry.id,
      ...personFields(data, entry.childId),
      stamp(entry.timestamp),
      entry.productName,
      entry.antigens.join(' '),
      entry.batch,
      entry.doctor,
      entry.note,
      flag(entry.isExample),
    ]),
  );
  const symptome = toCsv(
    ['id', 'person_id', 'person', 'person_typ', 'zeitpunkt', 'symptom', 'schwere', 'notiz', 'beispiel'],
    data.symptoms.map((entry) => [
      entry.id,
      ...personFields(data, entry.childId),
      stamp(entry.timestamp),
      entry.label,
      entry.severity === null ? '' : String(entry.severity),
      entry.note,
      flag(entry.isExample),
    ]),
  );

  return [
    { name: 'personen.csv', contents: personen },
    { name: 'temperatur.csv', contents: temperatur },
    { name: 'medikamente.csv', contents: medikamente },
    { name: 'gaben.csv', contents: gaben },
    { name: 'wachstum.csv', contents: wachstum },
    { name: 'familie.csv', contents: familie },
    { name: 'impfungen.csv', contents: impfungen },
    { name: 'symptome.csv', contents: symptome },
    { name: 'erinnerungen.csv', contents: erinnerungen },
  ];
}
