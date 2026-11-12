import { berlinParts } from '../dates';
import { ageDays, type AntigenStatus, type DoseStatus } from './stiko';

/**
 * Adult STIKO orientation. This is not a medical recommendation.
 *
 * The ages below follow the public STIKO adult schedule in broad form:
 * Td or Tdap about every 10 years, one pertussis dose as an adult,
 * influenza and COVID-19 from age 60 (earlier only for indications),
 * pneumococcal and herpes zoster from age 60, MMR when born after 1970
 * and the status is unclear.
 *
 * Product schemes, indications and the current Epidemiologisches Bulletin
 * have to be checked before anyone relies on a row. The source is marked
 * as needing that check on purpose.
 */

export const ADULT_STIKO_SOURCE =
  'Orientierung an STIKO-Empfehlungen für Erwachsene: Td/Tdap etwa alle 10 Jahre, Pertussis einmal im Erwachsenenalter, Influenza und COVID-19 ab 60 (davor nach Indikation), Pneumokokken und Herpes zoster ab 60, MMR für nach 1970 Geborene mit unklarem Status. Bitte mit dem Epidemiologischen Bulletin des laufenden Jahres und der Hausärztin oder dem Hausarzt prüfen. Keine ärztliche Beurteilung.';

type Dose = { timestamp: string; antigens: readonly string[] };

const YEAR_DAYS = 365.2425;

function birthYear(birthDateIso: string): number | null {
  const match = birthDateIso.match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
}

function years(birthDateIso: string, at: Date): number {
  return ageDays(birthDateIso, at) / YEAR_DAYS;
}

function ageAtDose(birthDateIso: string, timestamp: string): number {
  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return 0;
  return years(birthDateIso, at);
}

function daysSince(timestamp: string, now: Date): number {
  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return Number.POSITIVE_INFINITY;
  return (now.getTime() - at.getTime()) / 86_400_000;
}

function withAntigen(doses: Dose[], antigen: string): Dose[] {
  return doses.filter((dose) => dose.antigens.includes(antigen)).slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function row(id: AntigenStatus['id'], label: string, status: DoseStatus, detail: string, given = 0, total = 1): AntigenStatus {
  return { id, label, given, total, status, detail };
}

function influenzaSeasonStart(now: Date): number {
  const parts = berlinParts(now);
  const year = parts.month >= 9 ? parts.year : parts.year - 1;
  return Date.UTC(year, 8, 1);
}

export function adultVaccinationStatus(birthDateIso: string, doses: Dose[], now: Date): AntigenStatus[] {
  if (!birthYear(birthDateIso)) {
    return [
      row('tetanus', 'Td/Tdap-Auffrischung', 'unklar', 'Geburtsdatum fehlt'),
      row('pertussis', 'Pertussis einmal als Erwachsener', 'unklar', 'Geburtsdatum fehlt'),
      row('influenza', 'Influenza', 'unklar', 'Geburtsdatum fehlt'),
      row('covid19', 'COVID-19', 'unklar', 'Geburtsdatum fehlt'),
      row('pneumokokken', 'Pneumokokken', 'unklar', 'Geburtsdatum fehlt'),
      row('herpesZoster', 'Herpes zoster', 'unklar', 'Geburtsdatum fehlt'),
      row('masern', 'MMR', 'unklar', 'Geburtsdatum fehlt'),
    ];
  }
  const age = years(birthDateIso, now);
  const td = doses
    .filter((dose) => dose.antigens.includes('diphtherie') && dose.antigens.includes('tetanus'))
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const lastTd = td[td.length - 1];
  const tdRow = !lastTd
    ? row('tetanus', 'Td/Tdap-Auffrischung', 'unklar', 'kein Eintrag, üblich etwa alle 10 Jahre')
    : daysSince(lastTd.timestamp, now) > 10 * YEAR_DAYS
      ? row('tetanus', 'Td/Tdap-Auffrischung', 'faellig', 'letzte Auffrischung vor mehr als 10 Jahren', 1, 1)
      : row('tetanus', 'Td/Tdap-Auffrischung', 'erledigt', 'innerhalb von 10 Jahren', 1, 1);

  const adultPertussis = withAntigen(doses, 'pertussis').filter((dose) => ageAtDose(birthDateIso, dose.timestamp) >= 18);
  const pertussisRow =
    adultPertussis.length > 0
      ? row('pertussis', 'Pertussis einmal als Erwachsener', 'erledigt', 'eine Dosis im Erwachsenenalter', 1, 1)
      : row('pertussis', 'Pertussis einmal als Erwachsener', 'faellig', 'einmal im Erwachsenenalter, noch kein Eintrag', 0, 1);

  const fluDoses = withAntigen(doses, 'influenza');
  const seasonStart = influenzaSeasonStart(now);
  const fluThisSeason = fluDoses.some((dose) => new Date(dose.timestamp).getTime() >= seasonStart);
  const fluRow =
    age < 60
      ? row('influenza', 'Influenza', 'spaeter', 'ab 60, davor nur bei Indikation')
      : fluThisSeason
        ? row('influenza', 'Influenza', 'erledigt', 'eine Dosis in dieser Saison', 1, 1)
        : row('influenza', 'Influenza', 'faellig', 'ab 60, in dieser Saison noch kein Eintrag', 0, 1);

  const covid = withAntigen(doses, 'covid19').filter((dose) => daysSince(dose.timestamp, now) <= YEAR_DAYS);
  const covidRow =
    age < 60
      ? row('covid19', 'COVID-19', 'spaeter', 'ab 60 jährlich, davor nach Indikation')
      : covid.length > 0
        ? row('covid19', 'COVID-19', 'erledigt', 'eine Dosis im letzten Jahr', 1, 1)
        : row('covid19', 'COVID-19', 'faellig', 'ab 60, im letzten Jahr kein Eintrag', 0, 1);

  const pneumo = withAntigen(doses, 'pneumokokken').filter((dose) => ageAtDose(birthDateIso, dose.timestamp) >= 60);
  const pneumoRow =
    age < 60
      ? row('pneumokokken', 'Pneumokokken', 'spaeter', 'ab 60, davor nur bei Indikation')
      : pneumo.length > 0
        ? row('pneumokokken', 'Pneumokokken', 'erledigt', 'eine Dosis ab 60, Schema bitte prüfen', 1, 1)
        : row('pneumokokken', 'Pneumokokken', 'faellig', 'ab 60, noch kein Eintrag', 0, 1);

  const zoster = withAntigen(doses, 'herpesZoster').filter((dose) => ageAtDose(birthDateIso, dose.timestamp) >= 60);
  const zosterRow =
    age < 60
      ? row('herpesZoster', 'Herpes zoster', 'spaeter', 'ab 60, meist zwei Dosen')
      : zoster.length >= 2
        ? row('herpesZoster', 'Herpes zoster', 'erledigt', '2 von 2 ab 60', 2, 2)
        : row('herpesZoster', 'Herpes zoster', 'faellig', `${zoster.length} von 2 ab 60`, zoster.length, 2);

  const year = birthYear(birthDateIso) as number;
  const measles = withAntigen(doses, 'masern');
  const mmrRow =
    year <= 1970
      ? row('masern', 'MMR', 'spaeter', 'Standard vor allem für nach 1970 Geborene', measles.length, 2)
      : measles.length >= 2
        ? row('masern', 'MMR', 'erledigt', 'zwei Masern-Dosen dokumentiert', 2, 2)
        : measles.length === 1
          ? row('masern', 'MMR', 'faellig', 'nach 1970 geboren, zweite Dosis fehlt oder Status unklar', 1, 2)
          : row('masern', 'MMR', 'unklar', 'nach 1970 geboren, Impfstatus unklar', 0, 2);

  return [tdRow, pertussisRow, fluRow, covidRow, pneumoRow, zosterRow, mmrRow];
}
