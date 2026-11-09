import { berlinParts } from '../dates';
import { ANTIGEN_LABELS, type AntigenId } from './products';

/**
 * Standard immunisations for infants, children and adolescents.
 *
 * Source: STIKO recommendations in Epidemiologisches Bulletin 4/2026
 * (Robert Koch-Institut), table 1A for age < 5 years and table 1B from age 5.
 * https://www.rki.de/DE/Themen/Infektionskrankheiten/Impfen/Staendige-Impfkommission/Empfehlungen-der-STIKO/Empfehlungen/empfehlungen-node.html
 *
 * This is an orientation for parents, not a vaccination recommendation.
 * Schemes for preterm infants, missed doses and product-specific windows
 * (especially rotavirus) differ. Check the Epidemiologisches Bulletin of the
 * current year before relying on these ages.
 *
 * Modelled here for a term infant, 2+1 where STIKO uses it:
 * - 6-fold (D, T, aP, Hib, IPV, HB) and pneumococcal: 2, 4 and 11 months
 * - Rotavirus: from 6 weeks, 2 doses, series finished by 24 weeks
 *   (3-dose products may run to 32 weeks; that product detail is not modelled)
 * - MenB: 2, 4 and 12 months
 * - MMR and varicella: 11 and 15 months
 * - MenACWY: 12–14 years (the 12-month MenC dose was dropped, Epid. Bull. 44/2025)
 */

export type DoseStatus = 'erledigt' | 'faellig' | 'ueberfaellig' | 'spaeter' | 'fenster';

export const STATUS_LABEL: Record<DoseStatus, string> = {
  erledigt: 'erledigt',
  faellig: 'fällig',
  ueberfaellig: 'überfällig',
  spaeter: 'später',
  fenster: 'Zeitfenster vorbei',
};

type DoseRule = {
  dose: number;
  /** Age in days from the birth date when this dose becomes due. */
  fromDays: number;
  /** Last day on which it still counts as "fällig" rather than overdue. */
  untilDays: number;
  /** Last day a missed dose is still described as überfällig. */
  catchupUntilDays: number | null;
  /** After the catch-up day the dose is not described as still due (rotavirus). */
  closes?: boolean;
};

export type AntigenPlan = {
  id: AntigenId;
  label: string;
  doses: DoseRule[];
};

const DAY = 86_400_000;

export function ageDays(birthDateIso: string, at: Date): number {
  const match = birthDateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 0;
  const birth = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parts = berlinParts(at);
  const today = Date.UTC(parts.year, parts.month - 1, parts.day);
  return Math.round((today - birth) / DAY);
}

export function daysFromBirth(birthDateIso: string, months: number, extraDays = 0): number {
  const match = birthDateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birth = Date.UTC(year, month - 1, day);
  const target = Date.UTC(year, month - 1 + months, day + extraDays);
  return Math.round((target - birth) / DAY);
}

function primary(birth: string, atMonths: number[], catchupMonths: number | null): DoseRule[] {
  return atMonths.map((month, index) => {
    const fromDays = daysFromBirth(birth, month);
    const untilDays = daysFromBirth(birth, month + 1);
    return {
      dose: index + 1,
      fromDays,
      untilDays,
      catchupUntilDays: catchupMonths === null ? null : daysFromBirth(birth, catchupMonths),
    };
  });
}

export function stikoPlan(birthDateIso: string): AntigenPlan[] {
  const infant = (antigens: AntigenId[], months: number[], catchup: number | null): AntigenPlan[] =>
    antigens.map((id) => ({
      id,
      label: ANTIGEN_LABELS[id],
      doses: primary(birthDateIso, months, catchup),
    }));
  const six = infant(
    ['diphtherie', 'tetanus', 'pertussis', 'polio', 'hepatitisB'],
    [2, 4, 11],
    18 * 12,
  );
  const hib = infant(['hib'], [2, 4, 11], 5 * 12);
  const pneumo = infant(['pneumokokken'], [2, 4, 11], 24);
  const menb = infant(['menb'], [2, 4, 12], 60);
  const mmr = infant(['masern', 'mumps', 'roeteln'], [11, 15], 18 * 12);
  const varicella = infant(['varizellen'], [11, 15], 18 * 12);
  const rota: AntigenPlan = {
    id: 'rotaviren',
    label: ANTIGEN_LABELS.rotaviren,
    doses: [
      { dose: 1, fromDays: 42, untilDays: 12 * 7, catchupUntilDays: 24 * 7, closes: true },
      { dose: 2, fromDays: 10 * 7, untilDays: 20 * 7, catchupUntilDays: 24 * 7, closes: true },
    ],
  };
  const menacwy: AntigenPlan = {
    id: 'menacwy',
    label: ANTIGEN_LABELS.menacwy,
    doses: [
      {
        dose: 1,
        fromDays: daysFromBirth(birthDateIso, 12 * 12),
        untilDays: daysFromBirth(birthDateIso, 15 * 12),
        catchupUntilDays: daysFromBirth(birthDateIso, 25 * 12),
      },
    ],
  };
  return [...six, ...hib, ...pneumo, ...menb, rota, ...mmr, ...varicella, menacwy];
}

export type AntigenStatus = {
  id: AntigenId;
  label: string;
  given: number;
  total: number;
  status: DoseStatus;
  detail: string;
};

export function vaccinationStatus(
  birthDateIso: string,
  doses: { timestamp: string; antigens: readonly string[] }[],
  now: Date,
): AntigenStatus[] {
  const age = ageDays(birthDateIso, now);
  return stikoPlan(birthDateIso).map((plan) => {
    const given = doses
      .filter((dose) => dose.antigens.includes(plan.id))
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    let status: DoseStatus = 'erledigt';
    let detail = `${Math.min(given.length, plan.doses.length)} von ${plan.doses.length}`;
    for (const rule of plan.doses) {
      if (given.length >= rule.dose) continue;
      if (age < rule.fromDays) {
        status = 'spaeter';
        detail = `${given.length} von ${plan.doses.length}, nächste Dosis später`;
        break;
      }
      if (age <= rule.untilDays) {
        status = 'faellig';
        detail = `${given.length} von ${plan.doses.length}, Dosis ${rule.dose} fällig`;
        break;
      }
      const catchupEnd = rule.catchupUntilDays ?? rule.untilDays;
      if (age <= catchupEnd) {
        status = 'ueberfaellig';
        detail = `${given.length} von ${plan.doses.length}, Dosis ${rule.dose} überfällig`;
        break;
      }
      status = rule.closes ? 'fenster' : 'ueberfaellig';
      detail =
        status === 'fenster'
          ? `${given.length} von ${plan.doses.length}, Zeitfenster vorbei`
          : `${given.length} von ${plan.doses.length}, Dosis ${rule.dose} überfällig`;
      break;
    }
    if (given.length >= plan.doses.length) {
      status = 'erledigt';
      detail = `${plan.doses.length} von ${plan.doses.length}`;
    }
    return { id: plan.id, label: plan.label, given: Math.min(given.length, plan.doses.length), total: plan.doses.length, status, detail };
  });
}

export const STIKO_SOURCE =
  'STIKO-Impfkalender, Epidemiologisches Bulletin 4/2026, Robert Koch-Institut. Bitte mit dem Epidemiologischen Bulletin des laufenden Jahres und der Kinderärztin oder dem Kinderarzt abgleichen.';
