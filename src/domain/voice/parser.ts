import { addCalendarDays, formatDateTime, zonedDateTime } from '../dates';
import { formatDecimal } from '../format';
import { SYMPTOM_PATTERNS, symptomLabel } from '../symptoms';
import { METHOD_LABELS, type MeasurementMethod } from '../types';
import type { EntryParser, Intent, ParseContext, ParseResult, ParserMedication } from './types';

const STOP = new Set([
  'ich', 'habe', 'hab', 'ihm', 'ihr', 'dem', 'den', 'der', 'die', 'das', 'ein', 'eine', 'einen',
  'mal', 'bitte', 'noch', 'schon', 'gerade', 'eben', 'jetzt', 'heute', 'gestern', 'gegeben',
  'verabreicht', 'eingenommen', 'genommen', 'fuer', 'mit', 'und', 'am', 'um', 'uhr', 'kind',
  'bei', 'von', 'auf', 'ist', 'war', 'grad', 'celsius', 'temperatur', 'fieber', 'fiebert',
  'gewicht', 'wiegt', 'kilo', 'kg', 'groesse', 'laenge', 'kopfumfang', 'cm', 'im',
]);

export function foldSpeech(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/°/g, ' grad ')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^a-z0-9:.\s-]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanup(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractWhen(folded: string, now: Date): { at: Date; rest: string } {
  let rest = folded;
  const vorMin = rest.match(/\bvor\s+(\d+(?:\.\d+)?)\s*(minuten|minute|min)\b/);
  if (vorMin) {
    rest = cleanup(rest.replace(vorMin[0], ' '));
    return { at: new Date(now.getTime() - Number(vorMin[1]) * 60_000), rest };
  }
  const vorStd = rest.match(/\bvor\s+(\d+(?:\.\d+)?)\s*(stunden|stunde|std|h)\b/);
  if (vorStd) {
    rest = cleanup(rest.replace(vorStd[0], ' '));
    return { at: new Date(now.getTime() - Number(vorStd[1]) * 3_600_000), rest };
  }
  const clock = rest.match(/\bum\s+(\d{1,2})[:.](\d{2})\b/);
  if (clock) {
    const gestern = /\bgestern\b/.test(rest);
    let hour = Number(clock[1]);
    const minute = Number(clock[2]);
    if (hour === 24) hour = 0;
    rest = cleanup(rest.replace(clock[0], ' ').replace(/\bgestern\b/, ' ').replace(/\bheute\b/, ' '));
    let day = addCalendarDays(now, gestern ? -1 : 0);
    let at = zonedDateTime({ ...day, hour, minute });
    if (!gestern && at.getTime() - now.getTime() > 2 * 3_600_000) {
      day = addCalendarDays(now, -1);
      at = zonedDateTime({ ...day, hour, minute });
    }
    return { at, rest };
  }
  if (/\bgestern\b/.test(rest)) {
    return { at: new Date(now.getTime() - 24 * 3_600_000), rest: cleanup(rest.replace(/\bgestern\b/, ' ')) };
  }
  return { at: now, rest };
}

function extractChild(rest: string, context: ParseContext): { childId: string | null; rest: string } {
  const ordered = [...context.children].sort((a, b) => foldSpeech(b.name).length - foldSpeech(a.name).length);
  for (const child of ordered) {
    const folded = foldSpeech(child.name);
    if (!folded) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(folded)}\\b`);
    if (pattern.test(rest)) {
      return { childId: child.id, rest: cleanup(rest.replace(pattern, ' ')) };
    }
  }
  return { childId: null, rest };
}

function extractMethod(rest: string, fallback: MeasurementMethod): { method: MeasurementMethod; rest: string } {
  const rules: [RegExp, MeasurementMethod][] = [
    [/\bim ohr\b|\bohr\b/, 'ohr'],
    [/\bstirn\b/, 'stirn'],
    [/\baxillar\b/, 'axillar'],
    [/\brektal\b/, 'rektal'],
    [/\boral\b/, 'oral'],
  ];
  for (const [pattern, method] of rules) {
    if (pattern.test(rest)) return { method, rest: cleanup(rest.replace(pattern, ' ')) };
  }
  return { method: fallback, rest };
}

function extractCelsius(rest: string): { value: number; rest: string } | null {
  const pattern = /\b(\d{2}(?:\.\d{1,2})?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(rest))) {
    const value = Number(match[1]);
    if (value >= 34 && value <= 43) {
      return { value, rest: cleanup(`${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`) };
    }
  }
  return null;
}

function extractLabeledNumber(rest: string, labels: string[], min: number, max: number): { value: number; rest: string } | null {
  const pattern = new RegExp(`\\b(?:${labels.join('|')})\\s+(\\d{1,3}(?:\\.\\d{1,3})?)\\b`);
  const match = rest.match(pattern);
  if (!match) return null;
  const value = Number(match[1]);
  if (value < min || value > max) return null;
  return { value, rest: cleanup(rest.replace(match[0], ' ')) };
}

function extractWeight(rest: string): { value: number; rest: string } | null {
  const labeled = extractLabeledNumber(rest, ['gewicht', 'wiegt'], 0.3, 200);
  if (labeled) return labeled;
  const unit = rest.match(/\b(\d{1,3}(?:\.\d{1,3})?)\s*(kilo|kg)\b/);
  if (!unit) return null;
  const value = Number(unit[1]);
  if (value < 0.3 || value > 200) return null;
  return { value, rest: cleanup(rest.replace(unit[0], ' ')) };
}

function tokens(folded: string): string[] {
  return folded.split(' ').filter((token) => token && token !== 'beispiel');
}

export function scoreMedicationName(query: string, name: string): number {
  const left = foldSpeech(query);
  const right = foldSpeech(name);
  if (!left || !right) return 0;
  if (left === right) return 100;
  const queryTokens = tokens(left);
  const nameTokens = tokens(right);
  if (queryTokens.length === 0 || nameTokens.length === 0) return 0;
  const queryText = queryTokens.join(' ');
  const nameText = nameTokens.join(' ');
  if (queryText === nameText) return 100;
  if (nameText.startsWith(queryText) || queryText.startsWith(nameText)) return 80;
  if (queryTokens.every((token) => nameTokens.includes(token))) return 70;
  if (nameTokens.every((token) => queryTokens.includes(token))) return 65;
  if (queryTokens.length === 1 && nameTokens.includes(queryTokens[0]) && queryTokens[0].length >= 5) return 50;
  return 0;
}

function medicationQuery(rest: string): string {
  return rest
    .split(' ')
    .filter((token) => token && !STOP.has(token) && !/^\d/.test(token))
    .join(' ');
}

function matchMedications(
  query: string,
  medications: ParserMedication[],
  childId: string | null,
): { id: string | null; candidates: string[]; score: number } {
  const pool = childId ? medications.filter((med) => med.childId === childId) : medications;
  const scored = pool
    .map((med) => ({ id: med.id, score: scoreMedicationName(query, med.name) }))
    .filter((item) => item.score >= 50)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { id: null, candidates: [], score: 0 };
  const best = scored[0].score;
  const top = scored.filter((item) => item.score >= best - 5);
  return {
    id: top.length === 1 ? top[0].id : null,
    candidates: top.map((item) => item.id),
    score: best,
  };
}

function resolveChildId(spokenChildId: string | null, context: ParseContext): string | null {
  return spokenChildId ?? context.activeChildId;
}

function childName(context: ParseContext, childId: string | null): string {
  if (!childId) return '';
  return context.children.find((child) => child.id === childId)?.name ?? '';
}

function withChild(summary: string, context: ParseContext, childId: string | null): string {
  const name = childName(context, childId);
  return name ? `${name}: ${summary}` : summary;
}

function doseTextFor(context: ParseContext, medicationId: string | null): string | null {
  if (!medicationId) return null;
  const last = context.lastDoseTextByMedicationId?.[medicationId];
  if (last) return last;
  return context.medications.find((med) => med.id === medicationId)?.doseText ?? null;
}

function matchSymptom(folded: string): string | null {
  const patterns = SYMPTOM_PATTERNS.flatMap((item) => item.phrases.map((phrase) => ({ id: item.id, phrase }))).sort(
    (a, b) => b.phrase.length - a.phrase.length,
  );
  for (const item of patterns) {
    const pattern = new RegExp(`(?:^|\\s)${item.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`);
    if (pattern.test(` ${folded} `)) return item.id;
  }
  return null;
}

function finish(parserId: string, intent: Intent, summary: string): ParseResult {
  return { parserId, intent, summary };
}

function parseRules(text: string, context: ParseContext): ParseResult {
  const folded = foldSpeech(text);
  if (!folded) {
    return finish('rules-de', { type: 'unknown', text }, 'Sag zum Beispiel: Temperatur jetzt 38,2.');
  }
  const timed = extractWhen(folded, context.now);
  let rest = timed.rest;
  const hasTemp = /\b(temperatur|fiebert|fieber|grad)\b/.test(rest);
  const hasDose = /\b(gegeben|verabreicht|eingenommen|genommen)\b/.test(rest);
  const hasWeight = /\b(gewicht|wiegt|kilo|kg)\b/.test(rest);
  const hasHeight = /\b(groesse|laenge)\b/.test(rest);
  const hasHead = /\bkopfumfang\b/.test(rest);

  const spoken = extractChild(rest, context);
  rest = spoken.rest;
  const methodResult = extractMethod(rest, context.defaultMethod);
  rest = methodResult.rest;
  const childId = resolveChildId(spoken.childId, context);
  const when = timed.at.toISOString();

  if ((hasWeight || hasHeight || hasHead) && !hasTemp && !hasDose) {
    const weight = hasWeight ? extractWeight(rest) : null;
    const height = hasHeight ? extractLabeledNumber(weight?.rest ?? rest, ['groesse', 'laenge'], 20, 220) : null;
    const head = hasHead
      ? extractLabeledNumber(height?.rest ?? weight?.rest ?? rest, ['kopfumfang'], 20, 80)
      : null;
    if (weight || height || head) {
      const bits = [
        weight ? `${formatDecimal(weight.value, 1)} kg` : null,
        height ? `${formatDecimal(height.value, 1)} cm Größe` : null,
        head ? `${formatDecimal(head.value, 1)} cm Kopf` : null,
      ].filter(Boolean);
      return finish(
        'rules-de',
        {
          type: 'growth',
          childId,
          timestamp: when,
          weightKg: weight?.value ?? null,
          heightCm: height?.value ?? null,
          headCm: head?.value ?? null,
        },
        withChild(`${bits.join(', ')}, ${formatDateTime(timed.at)}`, context, childId),
      );
    }
  }

  const celsius = extractCelsius(rest);
  const query = medicationQuery(celsius?.rest ?? rest);
  const bareNumber = Boolean(celsius) && query.length === 0;
  if (hasTemp || (celsius && !hasDose && bareNumber)) {
    if (!celsius) {
      return finish('rules-de', { type: 'unknown', text }, 'Die Temperatur habe ich nicht als Zahl erkannt.');
    }
    return finish(
      'rules-de',
      {
        type: 'temperature',
        childId,
        timestamp: when,
        celsius: celsius.value,
        method: methodResult.method,
      },
      withChild(
        `Temperatur ${formatDecimal(celsius.value, 1)} °C, ${METHOD_LABELS[methodResult.method]}, ${formatDateTime(timed.at)}`,
        context,
        childId,
      ),
    );
  }

  if (!hasTemp && !hasDose && !hasWeight) {
    const symptom = matchSymptom(folded);
    if (symptom) {
      const severity = /\bstark\b/.test(folded) ? 3 : /\bleicht\b/.test(folded) ? 1 : null;
      return finish(
        'rules-de',
        {
          type: 'symptom',
          childId,
          timestamp: when,
          symptomId: symptom,
          label: symptomLabel(symptom),
          severity,
        },
        withChild(`${symptomLabel(symptom)}, ${formatDateTime(timed.at)}`, context, childId),
      );
    }
  }

  const tryDose = hasDose || query.length > 0;
  if (tryDose && query) {
    let match = matchMedications(query, context.medications, childId);
    let resolvedChild = childId;
    if (!match.id && match.candidates.length === 0 && !spoken.childId) {
      const anyChild = matchMedications(query, context.medications, null);
      if (anyChild.id || anyChild.candidates.length > 0) {
        match = anyChild;
        if (anyChild.id) {
          resolvedChild = context.medications.find((med) => med.id === anyChild.id)?.childId ?? resolvedChild;
        }
      }
    }
    const strongBareName = !hasDose && match.score >= 70;
    if (hasDose || strongBareName || match.candidates.length > 0) {
      const medName = match.id
        ? context.medications.find((med) => med.id === match.id)?.name ?? query
        : query;
      return finish(
        'rules-de',
        {
          type: 'dose',
          childId: resolvedChild,
          timestamp: when,
          medicationId: match.id,
          medicationQuery: query,
          candidateIds: match.candidates,
          doseText: doseTextFor(context, match.id),
          givenBy: context.defaultGivenBy,
        },
        withChild(
          match.id
            ? `${medName} geben, ${formatDateTime(timed.at)}`
            : `Medikament „${query}“ ist noch nicht eindeutig. Bitte prüfen.`,
          context,
          resolvedChild,
        ),
      );
    }
  }

  return finish(
    'rules-de',
    { type: 'unknown', text },
    'Nicht erkannt. Beispiele: „Temperatur jetzt 38,2“, „vor 15 Minuten 37,3 Grad“, „Ibuprofen gegeben“, „Gewicht 9,6 Kilo“.',
  );
}

export const ruleBasedParser: EntryParser = {
  id: 'rules-de',
  parse(text, context) {
    if (!text.trim()) return null;
    return parseRules(text, context);
  },
};

export function parseUtterance(text: string, context: ParseContext): ParseResult {
  return (
    ruleBasedParser.parse(text, context) as ParseResult | null
  ) ?? {
    parserId: 'rules-de',
    summary: 'Leere Eingabe.',
    intent: { type: 'unknown', text },
  };
}

export async function interpretUtterance(
  text: string,
  context: ParseContext,
  parsers: EntryParser[] = [ruleBasedParser],
): Promise<ParseResult> {
  let fallback: ParseResult | null = null;
  for (const parser of parsers) {
    const result = await parser.parse(text, context);
    if (!result) continue;
    if (result.intent.type !== 'unknown') return result;
    fallback = result;
  }
  return (
    fallback ?? {
      parserId: 'none',
      summary: 'Das habe ich nicht als Eintrag erkannt.',
      intent: { type: 'unknown', text: text.trim() },
    }
  );
}
