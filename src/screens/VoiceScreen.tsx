import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { Banner, Body, Button, Card, ConfirmDialog, DateTimeFields, MicIcon, Muted, Screen, Segmented, TextField } from '../components/ui';
import { combineBerlin, dateFieldValue, timeFieldValue } from '../domain/dates';
import { parseDecimal } from '../domain/format';
import { createId } from '../domain/ids';
import { assessDose } from '../domain/medication';
import {
  MEASUREMENT_METHODS,
  METHOD_LABELS,
  type AppData,
  type DoseEntry,
  type GrowthEntry,
  type MeasurementMethod,
  type Medication,
  type TemperatureEntry,
} from '../domain/types';
import { interpretUtterance } from '../domain/voice';
import { matchVoiceCommand } from '../domain/voice/commands';
import { speakWhen, spokenSavePrompt } from '../domain/voice/spoken';
import type { ParseContext } from '../domain/voice/types';
import { saveDose, saveGrowth, saveMedication, saveSymptom, saveTemperature, removeDose, removeGrowth, removeMedication, removeSymptom, removeTemperature } from '../data/mutations';
import type { SymptomEntry } from '../domain/types';
import { playCue } from '../speech/feedback';
import { speechSupport, startSpeech, type SpeechSession, type SpeechSupport } from '../speech/recognition';
import { speakGerman, stopSpeaking } from '../speech/speak';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

type Draft =
  | {
      kind: 'temperature';
      childId: string;
      celsius: string;
      method: MeasurementMethod;
      date: string;
      time: string;
    }
  | {
      kind: 'dose';
      childId: string;
      medicationId: string | null;
      query: string;
      candidates: string[];
      doseText: string;
      givenBy: string;
      interval: string;
      max: string;
      date: string;
      time: string;
    }
  | {
      kind: 'growth';
      childId: string;
      weight: string;
      height: string;
      head: string;
      date: string;
      time: string;
    }
  | {
      kind: 'symptom';
      childId: string;
      symptomId: string;
      label: string;
      severity: 1 | 2 | 3 | null;
      date: string;
      time: string;
    };

type Phase = 'listening' | 'confirm' | 'saved' | 'clarify' | 'typing';
type Block = 'person' | 'limit' | 'text' | null;

type UndoBag = {
  temperatureIds: string[];
  doseIds: string[];
  growthIds: string[];
  symptomIds: string[];
  medicationIds: string[];
};

function detailFor(draft: Draft, data: AppData): string {
  if (draft.kind === 'temperature') return `${draft.celsius} Grad ${METHOD_LABELS[draft.method]}`;
  if (draft.kind === 'symptom') return draft.label;
  if (draft.kind === 'growth') {
    return [
      draft.weight.trim() ? `${draft.weight} Kilogramm` : '',
      draft.height.trim() ? `${draft.height} Zentimeter` : '',
      draft.head.trim() ? `Kopf ${draft.head} Zentimeter` : '',
    ]
      .filter(Boolean)
      .join(', ');
  }
  const medication = data.medications.find((item) => item.id === draft.medicationId);
  return [medication?.name ?? draft.query, draft.doseText].filter(Boolean).join(', ');
}

function canAutoSave(draft: Draft, data: AppData): boolean {
  if (!draft.childId || !combineBerlin(draft.date, draft.time)) return false;
  if (draft.kind === 'temperature') {
    const value = parseDecimal(draft.celsius);
    return value !== null && value >= 34 && value <= 43;
  }
  if (draft.kind === 'symptom') return true;
  if (draft.kind === 'growth') {
    const weight = draft.weight.trim() ? parseDecimal(draft.weight) : undefined;
    const height = draft.height.trim() ? parseDecimal(draft.height) : undefined;
    const head = draft.head.trim() ? parseDecimal(draft.head) : undefined;
    if (weight === null || height === null || head === null) return false;
    return weight !== undefined || height !== undefined || head !== undefined;
  }
  if (!draft.medicationId || !draft.doseText.trim() || !draft.givenBy.trim()) return false;
  const medication = data.medications.find((item) => item.id === draft.medicationId);
  if (!medication) return false;
  const assessment = assessDose({
    doses: data.doses.filter((dose) => dose.medicationId === medication.id),
    minIntervalHours: medication.minIntervalHours,
    maxPer24h: medication.maxDosesPer24h,
    at: combineBerlin(draft.date, draft.time) ?? new Date(),
  });
  return !assessment.tooSoon && !assessment.exceedsMax;
}

export function VoiceScreen({
  autoStart = false,
  preview,
  onDone,
}: {
  autoStart?: boolean;
  preview?: 'listening' | 'confirm';
  onDone: () => void;
}) {
  const theme = useTheme();
  const { data, activeChild, update } = useStore();
  const [support] = useState<SpeechSupport>(() => (preview ? 'native' : speechSupport()));
  const [phase, setPhase] = useState<Phase>(preview === 'confirm' ? 'confirm' : preview === 'listening' ? 'listening' : 'typing');
  const [text, setText] = useState('');
  const [partial, setPartial] = useState(preview === 'listening' ? 'Anna 38,5' : '');
  const [listening, setListening] = useState(preview === 'listening');
  const [notice, setNotice] = useState<string | null>(null);
  const [spoken, setSpoken] = useState(preview === 'confirm' ? 'Anna, 38,5 Grad rektal, 1:52 Uhr. Speichern?' : '');
  const [summary, setSummary] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Block>(null);
  const [countdown, setCountdown] = useState<number | null>(preview === 'confirm' ? 3 : null);
  const [hasUndo, setHasUndo] = useState(false);
  const [pendingDose, setPendingDose] = useState<{ dose: DoseEntry; medication: Medication | null } | null>(null);
  const session = useRef<SpeechSession | null>(null);
  const started = useRef(false);
  const generation = useRef(0);
  const phaseRef = useRef<Phase>(phase);
  const draftRef = useRef<Draft | null>(draft);
  const dataRef = useRef(data);
  const countdownRef = useRef<number | null>(countdown);
  const undoRef = useRef<UndoBag | null>(null);
  const sourceRef = useRef('');
  const misses = useRef(0);
  const saving = useRef(false);
  const blockedRef = useRef<Block>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const previewRef = useRef(preview);
  phaseRef.current = phase;
  blockedRef.current = blocked;
  draftRef.current = draft;
  dataRef.current = data;
  countdownRef.current = countdown;
  useKeepAwake('kindkrank-voice');

  function clearTimers() {
    for (const id of timers.current) clearInterval(id);
    timers.current = [];
    countdownRef.current = null;
    setCountdown(null);
  }

  function stopMic() {
    generation.current += 1;
    session.current?.stop();
    session.current = null;
    setListening(false);
  }

  useEffect(
    () => () => {
      generation.current += 1;
      session.current?.stop();
      for (const id of timers.current) clearInterval(id);
      stopSpeaking();
    },
    [],
  );

  function hints(): string[] {
    return ['Speichern', 'Abbrechen', 'Rückgängig', 'Ja', 'Nein', 'Trotzdem', ...(dataRef.current?.children.map((child) => child.name) ?? [])];
  }

  async function beginListen(keepPhase = false) {
    if (previewRef.current) return;
    const fromSaved = phaseRef.current === 'saved';
    const token = ++generation.current;
    session.current?.stop();
    if (!keepPhase && !fromSaved) {
      phaseRef.current = 'listening';
      setPhase('listening');
      setPartial('');
      setBlocked(null);
      clearTimers();
    }
    const next = await startSpeech(
      {
        onPartial: (heard) => {
          if (generation.current !== token) return;
          setPartial(heard);
        },
        onFinal: (heard) => {
          if (generation.current !== token) return;
          setPartial(heard);
          void onHeard(heard);
        },
        onError: (message, code) => {
          if (generation.current !== token) return;
          void onListenError(message, code);
        },
        onEnd: () => {
          if (generation.current !== token) return;
          setListening(false);
          if (phaseRef.current === 'confirm' && countdownRef.current !== null) void beginListen(true);
        },
      },
      { hints: hints() },
    );
    if (generation.current !== token) {
      next?.stop();
      return;
    }
    session.current = next;
    setListening(Boolean(next));
    if (!next) {
      if (fromSaved || keepPhase || phaseRef.current === 'saved' || phaseRef.current === 'confirm' || phaseRef.current === 'clarify') {
        setListening(false);
        return;
      }
      phaseRef.current = 'typing';
      setPhase('typing');
      setNotice('Spracherkennung ist hier nicht verfügbar. Der Satz kann unten eingetippt werden.');
      return;
    }
    if (fromSaved) {
      phaseRef.current = 'listening';
      setPhase('listening');
    }
    if (!keepPhase) void playCue('heard');
  }

  async function onListenError(message: string, code?: string) {
    const quiet = code === 'no-speech' || code === 'speech-timeout';
    const current = phaseRef.current;
    stopMic();
    if (current === 'confirm' || current === 'clarify') {
      if (quiet) void beginListen(true);
      return;
    }
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      setNotice(message);
      if (current === 'saved') {
        phaseRef.current = 'saved';
        setPhase('saved');
        return;
      }
      phaseRef.current = 'typing';
      setPhase('typing');
      return;
    }
    if (current === 'saved') return;
    if (quiet) {
      misses.current += 1;
      if (misses.current < 2) {
        await speakGerman('Ich höre noch.');
        if (phaseRef.current === 'listening' || phaseRef.current === 'saved') void beginListen();
        return;
      }
      phaseRef.current = 'typing';
      setPhase('typing');
      setNotice('Ich habe nichts gehört. Du kannst den Satz unten eintippen.');
      await speakGerman('Ich habe nichts gehört. Du kannst den Satz auch eintippen.');
      return;
    }
    setNotice(message);
    phaseRef.current = 'typing';
    setPhase('typing');
  }

  function armCountdown() {
    clearTimers();
    countdownRef.current = 3;
    setCountdown(3);
    let left = 3;
    const id = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(id);
        countdownRef.current = null;
        setCountdown(null);
        void commitRef.current(false);
      } else {
        countdownRef.current = left;
        setCountdown(left);
      }
    }, 1000);
    timers.current.push(id);
  }

  function buildContext(): ParseContext | null {
    const current = dataRef.current;
    if (!current) return null;
    const lastDoseTextByMedicationId: Record<string, string> = {};
    for (const medication of current.medications) {
      const last = current.doses
        .filter((dose) => dose.medicationId === medication.id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      if (last?.doseText) lastDoseTextByMedicationId[medication.id] = last.doseText;
    }
    return {
      now: new Date(),
      children: current.children.map((child) => ({
        id: child.id,
        name: child.name,
        role: child.role,
        isSelf: child.isSelf,
        defaultMethod: child.defaultMethod,
      })),
      medications: current.medications.map((medication) => ({
        id: medication.id,
        childId: medication.childId,
        name: medication.name,
        doseText: medication.doseText,
      })),
      activeChildId: activeChild?.id ?? null,
      defaultMethod: current.settings.defaultMethod,
      defaultGivenBy: current.settings.defaultGivenBy,
      lastDoseTextByMedicationId,
    };
  }

  function applyDraft(next: Draft | null) {
    draftRef.current = next;
    setDraft(next);
  }

  async function presentDraft(next: Draft, ambiguous?: boolean) {
    const current = dataRef.current;
    if (!current) return;
    applyDraft(next);
    const person = current.children.find((child) => child.id === next.childId)?.name ?? '';
    const when = speakWhen(next.date, next.time, dateFieldValue(new Date()));
    if (ambiguous || !next.childId) {
      const names = current.children.map((child) => child.name).join(', ');
      const question = names ? `Welche Person ist gemeint? ${names}.` : 'Welche Person ist gemeint?';
      phaseRef.current = 'clarify';
      setPhase('clarify');
      setBlocked('person');
      setSpoken(question);
      await speakGerman(question);
      if (phaseRef.current === 'clarify') void beginListen(true);
      return;
    }
    if (next.kind === 'dose' && !next.medicationId) {
      phaseRef.current = 'typing';
      setPhase('typing');
      setBlocked('text');
      setNotice('Dieses Medikament ist neu. Abstand und Maximum trägst du unten ein. Die App schlägt keine Dosis vor.');
      await speakGerman('Dieses Medikament ist neu. Abstand und Maximum bitte eintippen.');
      return;
    }
    if (next.kind === 'dose' && !canAutoSave(next, current)) {
      const medication = current.medications.find((item) => item.id === next.medicationId);
      const whenDate = combineBerlin(next.date, next.time);
      const assessment =
        medication && whenDate
          ? assessDose({
              doses: current.doses.filter((dose) => dose.medicationId === medication.id),
              minIntervalHours: medication.minIntervalHours,
              maxPer24h: medication.maxDosesPer24h,
              at: whenDate,
            })
          : null;
      const reason = [
        assessment?.tooSoon ? 'Der Mindestabstand ist noch nicht um.' : null,
        assessment?.exceedsMax ? 'Die Höchstzahl in 24 Stunden wäre überschritten.' : null,
      ]
        .filter(Boolean)
        .join(' ');
      phaseRef.current = 'clarify';
      setPhase('clarify');
      setBlocked('limit');
      setError(reason || 'Prüf die Angabe.');
      setSpoken(`${person}, ${detailFor(next, current)}. ${reason} Sag trotzdem oder abbrechen.`);
      await speakGerman(spokenLine(person, detailFor(next, current), reason || 'Prüf die Angabe.'));
      if (phaseRef.current === 'clarify') void beginListen(true);
      return;
    }
    if (!canAutoSave(next, current)) {
      phaseRef.current = 'typing';
      setPhase('typing');
      setBlocked('text');
      setError('Prüf die Angabe, bevor sie gespeichert wird.');
      return;
    }
    const prompt = spokenSavePrompt(person, detailFor(next, current), when);
    phaseRef.current = 'confirm';
    setPhase('confirm');
    setBlocked(null);
    setSpoken(prompt);
    setError(null);
    await speakGerman(prompt);
    if (phaseRef.current !== 'confirm' || previewRef.current) return;
    armCountdown();
    void beginListen(true);
  }

  async function interpret(raw = text) {
    const context = buildContext();
    const current = dataRef.current;
    if (!context || !current) return;
    sourceRef.current = raw;
    clearTimers();
    stopMic();
    setError(null);
    setPendingDose(null);
    const result = await interpretUtterance(raw, context);
    setSummary(result.summary);
    const personId = result.personAmbiguous ? '' : result.intent.type === 'unknown' ? '' : (result.intent.childId ?? activeChild?.id ?? '');
    if (result.intent.type === 'temperature') {
      const at = new Date(result.intent.timestamp);
      await presentDraft(
        {
          kind: 'temperature',
          childId: personId,
          celsius: String(result.intent.celsius).replace('.', ','),
          method: result.intent.method,
          date: dateFieldValue(at),
          time: timeFieldValue(at),
        },
        result.personAmbiguous,
      );
      return;
    }
    if (result.intent.type === 'growth') {
      const at = new Date(result.intent.timestamp);
      await presentDraft(
        {
          kind: 'growth',
          childId: personId,
          weight: result.intent.weightKg === null ? '' : String(result.intent.weightKg).replace('.', ','),
          height: result.intent.heightCm === null ? '' : String(result.intent.heightCm).replace('.', ','),
          head: result.intent.headCm === null ? '' : String(result.intent.headCm).replace('.', ','),
          date: dateFieldValue(at),
          time: timeFieldValue(at),
        },
        result.personAmbiguous,
      );
      return;
    }
    if (result.intent.type === 'symptom') {
      const at = new Date(result.intent.timestamp);
      await presentDraft(
        {
          kind: 'symptom',
          childId: personId,
          symptomId: result.intent.symptomId,
          label: result.intent.label,
          severity: result.intent.severity,
          date: dateFieldValue(at),
          time: timeFieldValue(at),
        },
        result.personAmbiguous,
      );
      return;
    }
    if (result.intent.type === 'dose') {
      const at = new Date(result.intent.timestamp);
      await presentDraft(
        {
          kind: 'dose',
          childId: personId,
          medicationId: result.intent.medicationId,
          query: result.intent.medicationQuery,
          candidates: result.intent.candidateIds,
          doseText: result.intent.doseText ?? '',
          givenBy: result.intent.givenBy,
          interval: '',
          max: '',
          date: dateFieldValue(at),
          time: timeFieldValue(at),
        },
        result.personAmbiguous,
      );
      return;
    }
    applyDraft(null);
    setNotice(result.summary);
    phaseRef.current = support === 'none' ? 'typing' : 'listening';
    setPhase(phaseRef.current);
    await speakGerman(result.summary);
    if (support !== 'none') void beginListen();
  }

  async function onHeard(heard: string) {
    stopMic();
    misses.current = 0;
    const command = matchVoiceCommand(heard);
    const currentPhase = phaseRef.current;
    if (command === 'stop') {
      leave();
      return;
    }
    if (command === 'undo') {
      await undo();
      return;
    }
    if (currentPhase === 'confirm' && (command === 'save' || command === 'anyway')) {
      await commitRef.current(false);
      return;
    }
    if ((currentPhase === 'confirm' || currentPhase === 'clarify') && command === 'cancel') {
      await discard();
      return;
    }
    if (currentPhase === 'clarify' && (command === 'anyway' || (command === 'save' && blockedRef.current === 'limit'))) {
      await commitRef.current(true);
      return;
    }
    if ((currentPhase === 'listening' || currentPhase === 'saved') && command) {
      if (command === 'cancel') leave();
      else void beginListen();
      return;
    }
    const combined =
      currentPhase === 'clarify' && blockedRef.current === 'person' && sourceRef.current && !/\d/.test(heard)
        ? `${heard} ${sourceRef.current}`
        : heard;
    sourceRef.current = combined;
    setText(combined);
    await interpret(combined);
  }

  async function commit(force: boolean) {
    if (saving.current) return;
    const current = dataRef.current;
    const next = draftRef.current;
    if (!current || !next) return;
    if (!next.childId) {
      setError('Bitte eine Person wählen.');
      return;
    }
    saving.current = true;
    clearTimers();
    stopMic();
    const undo: UndoBag = { temperatureIds: [], doseIds: [], growthIds: [], symptomIds: [], medicationIds: [] };
    if (next.kind === 'temperature') {
      const value = parseDecimal(next.celsius);
      const when = combineBerlin(next.date, next.time);
      if (value === null || value < 34 || value > 43 || !when) {
        saving.current = false;
        setError('Prüf Temperatur, Datum und Uhrzeit.');
        phaseRef.current = 'typing';
        setPhase('typing');
        return;
      }
      const entry: TemperatureEntry = {
        id: createId('temp'),
        childId: next.childId,
        timestamp: when.toISOString(),
        celsius: value,
        method: next.method,
        note: '',
        isExample: false,
      };
      undo.temperatureIds.push(entry.id);
      update((state) => saveTemperature(state, entry));
    } else if (next.kind === 'symptom') {
      const when = combineBerlin(next.date, next.time);
      if (!when) {
        saving.current = false;
        setError('Prüf Datum und Uhrzeit.');
        return;
      }
      const entry: SymptomEntry = {
        id: createId('sym'),
        childId: next.childId,
        timestamp: when.toISOString(),
        symptomId: next.symptomId,
        label: next.label,
        severity: next.severity,
        note: '',
        isExample: false,
      };
      undo.symptomIds.push(entry.id);
      update((state) => saveSymptom(state, entry));
    } else if (next.kind === 'growth') {
      const when = combineBerlin(next.date, next.time);
      const weight = next.weight.trim() ? parseDecimal(next.weight) : undefined;
      const height = next.height.trim() ? parseDecimal(next.height) : undefined;
      const head = next.head.trim() ? parseDecimal(next.head) : undefined;
      if (!when || weight === null || height === null || head === null || (weight === undefined && height === undefined && head === undefined)) {
        saving.current = false;
        setError('Prüf die Zahlen und die Zeit.');
        phaseRef.current = 'typing';
        setPhase('typing');
        return;
      }
      const pieces: GrowthEntry[] = [];
      if (weight !== undefined) pieces.push({ id: createId('wuchs'), childId: next.childId, timestamp: when.toISOString(), weightKg: weight, isExample: false });
      if (height !== undefined) pieces.push({ id: createId('wuchs'), childId: next.childId, timestamp: when.toISOString(), heightCm: height, isExample: false });
      if (head !== undefined) pieces.push({ id: createId('wuchs'), childId: next.childId, timestamp: when.toISOString(), headCm: head, isExample: false });
      undo.growthIds.push(...pieces.map((entry) => entry.id));
      update((state) => pieces.reduce((acc, entry) => saveGrowth(acc, entry), state));
    } else {
      const when = combineBerlin(next.date, next.time);
      if (!when || !next.doseText.trim() || !next.givenBy.trim()) {
        saving.current = false;
        setError('Dosis, gebende Person und Zeitpunkt werden gebraucht.');
        phaseRef.current = 'typing';
        setPhase('typing');
        return;
      }
      let medication = next.medicationId ? current.medications.find((item) => item.id === next.medicationId) ?? null : null;
      let created: Medication | null = null;
      if (!medication) {
        const hours = parseDecimal(next.interval);
        const maximum = Number(next.max.trim());
        if (hours === null || hours <= 0 || !Number.isInteger(maximum) || maximum < 1) {
          saving.current = false;
          setError('Für ein neues Medikament brauche ich Abstand in Stunden und die Höchstzahl pro 24 Stunden.');
          phaseRef.current = 'typing';
          setPhase('typing');
          return;
        }
        created = {
          id: createId('med'),
          childId: next.childId,
          name: next.query.trim() || 'Medikament',
          doseText: next.doseText.trim(),
          minIntervalHours: hours,
          maxDosesPer24h: maximum,
          isExample: false,
        };
        medication = created;
        undo.medicationIds.push(created.id);
      }
      const others = current.doses.filter((dose) => dose.medicationId === medication?.id);
      const assessment = assessDose({
        doses: created ? [] : others,
        minIntervalHours: medication.minIntervalHours,
        maxPer24h: medication.maxDosesPer24h,
        at: when,
      });
      const overridden = assessment.tooSoon || assessment.exceedsMax;
      if (overridden && !force) {
        saving.current = false;
        const reason = [
          assessment.tooSoon ? 'Der Mindestabstand ist noch nicht um.' : null,
          assessment.exceedsMax ? 'Die Höchstzahl in 24 Stunden wäre überschritten.' : null,
        ]
          .filter(Boolean)
          .join(' ');
        setError(`${medication.name}: ${reason}`);
        setPendingDose({
          dose: {
            id: createId('gabe'),
            childId: next.childId,
            medicationId: medication.id,
            timestamp: when.toISOString(),
            givenBy: next.givenBy.trim(),
            doseText: next.doseText.trim(),
            note: '',
            overridden: true,
            isExample: false,
          },
          medication: created,
        });
        phaseRef.current = 'clarify';
        setPhase('clarify');
        setBlocked('limit');
        await speakGerman(`${reason} Sag trotzdem oder abbrechen.`);
        return;
      }
      const dose: DoseEntry = {
        id: createId('gabe'),
        childId: next.childId,
        medicationId: medication.id,
        timestamp: when.toISOString(),
        givenBy: next.givenBy.trim(),
        doseText: next.doseText.trim(),
        note: '',
        overridden,
        isExample: false,
      };
      undo.doseIds.push(dose.id);
      update((state) => {
        const withMed = created ? saveMedication(state, created) : state;
        return saveDose(withMed, dose);
      });
    }
    undoRef.current = undo;
    setHasUndo(true);
    applyDraft(null);
    setPendingDose(null);
    setError(null);
    phaseRef.current = 'saved';
    setPhase('saved');
    setSpoken('Gespeichert.');
    saving.current = false;
    await playCue('saved');
    await speakGerman('Gespeichert.');
    if (phaseRef.current === 'saved' && support !== 'none') void beginListen();
  }

  const commitRef = useRef(commit);
  commitRef.current = commit;

  async function undo() {
    const bag = undoRef.current;
    clearTimers();
    stopMic();
    if (!bag) {
      await speakGerman('Es gibt nichts rückgängig zu machen.');
      if (support !== 'none') void beginListen();
      return;
    }
    update((state) => {
      let next = state;
      for (const id of bag.doseIds) next = removeDose(next, id);
      for (const id of bag.symptomIds) next = removeSymptom(next, id);
      for (const id of bag.temperatureIds) next = removeTemperature(next, id);
      for (const id of bag.growthIds) next = removeGrowth(next, id);
      for (const id of bag.medicationIds) next = removeMedication(next, id);
      return next;
    });
    undoRef.current = null;
    setHasUndo(false);
    applyDraft(null);
    phaseRef.current = 'listening';
    setSpoken('Rückgängig.');
    await playCue('cancel');
    await speakGerman('Rückgängig.');
    if (support !== 'none') void beginListen();
    else setPhase('typing');
  }

  async function discard() {
    clearTimers();
    stopMic();
    applyDraft(null);
    setPendingDose(null);
    setError(null);
    setBlocked(null);
    phaseRef.current = support === 'none' ? 'typing' : 'listening';
    setPhase(phaseRef.current);
    setSpoken('Nicht gespeichert.');
    await playCue('cancel');
    await speakGerman('Nicht gespeichert.');
    if (support !== 'none') void beginListen();
  }

  function leave() {
    clearTimers();
    stopMic();
    stopSpeaking();
    onDone();
  }

  function correct() {
    clearTimers();
    stopMic();
    stopSpeaking();
    phaseRef.current = 'typing';
    setPhase('typing');
  }

  useEffect(() => {
    if (!preview || !data) return;
    if (preview === 'listening') {
      phaseRef.current = 'listening';
      setPhase('listening');
      setPartial('Anna 38,5');
      setListening(true);
      return;
    }
    const next: Draft = {
      kind: 'temperature',
      childId: data.children.find((child) => child.name === 'Anna')?.id ?? data.children[0]?.id ?? '',
      celsius: '38,5',
      method: 'rektal',
      date: dateFieldValue(new Date()),
      time: '01:52',
    };
    applyDraft(next);
    phaseRef.current = 'confirm';
    setPhase('confirm');
    setCountdown(3);
    countdownRef.current = 3;
    setSpoken('Anna, 38,5 Grad rektal, 1:52 Uhr. Speichern?');
  }, [preview, data]);

  useEffect(() => {
    if (preview || started.current) return;
    started.current = true;
    if (support === 'none') {
      setNotice(
        'In Expo Go hört das Mikrofon nicht mit. Tipp den Satz unten ein. Dieselbe Vorlese-Bestätigung läuft dort trotzdem. Zuhören ohne Tippen braucht die installierte APK.',
      );
      return;
    }
    if (autoStart) void beginListen();
    // The session should arm once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, preview, support]);

  const current = data;
  const personName = current?.children.find((child) => child.id === draft?.childId)?.name ?? (preview === 'confirm' ? 'Anna' : '');
  const detail = draft && current ? detailFor(draft, current) : preview === 'confirm' ? '38,5 Grad rektal' : '';
  const when = draft ? speakWhen(draft.date, draft.time, dateFieldValue(new Date())) : preview === 'confirm' ? '1:52 Uhr' : '';

  return (
    <Screen
      title="Spracheingabe"
      onBack={leave}
      dialog={
        <ConfirmDialog
          visible={pendingDose !== null && phase === 'typing'}
          title="Grenze überschritten"
          message={`${error ?? ''} Trotzdem speichern?`}
          confirmLabel="Trotzdem speichern"
          onCancel={() => setPendingDose(null)}
          onConfirm={() => void commit(true)}
        />
      }
    >
      {phase === 'listening' || phase === 'saved' ? (
        <View style={{ alignItems: 'center', gap: 18, paddingTop: 28 }}>
          <View
            style={{
              width: 168,
              height: 168,
              borderRadius: 84,
              backgroundColor: theme.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MicIcon color={theme.accent} size={72} />
          </View>
          <Text accessibilityLiveRegion="polite" style={{ color: theme.text, fontSize: 32, fontWeight: '800', textAlign: 'center' }}>
            {phase === 'saved' ? 'Gespeichert' : listening ? 'Ich höre zu' : 'Einen Moment'}
          </Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: '700', textAlign: 'center', minHeight: 36 }}>{partial}</Text>
          {spoken ? (
            <Text style={{ color: theme.accent, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{spoken}</Text>
          ) : null}
          <Muted>{phase === 'saved' ? 'Sag Rückgängig oder den nächsten Wert.' : 'Zum Beispiel: Anna 38,5'}</Muted>
          {notice ? <Banner tone="info">{notice}</Banner> : null}
          {support === 'none' ? null : (
            <Muted>Die Erkennung nutzt die Spracherkennung des Geräts. Gespeichert wird erst nach der Ansage.</Muted>
          )}
          {hasUndo ? <Button label="Rückgängig" variant="secondary" onPress={() => void undo()} /> : null}
          <Button label="Tippen" variant="secondary" onPress={correct} />
        </View>
      ) : null}

      {phase === 'confirm' || phase === 'clarify' ? (
        <View style={{ alignItems: 'center', gap: 10, paddingTop: 24 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: theme.text, fontSize: 40, fontWeight: '800', textAlign: 'center' }}>
            {personName || 'Eintrag'}
          </Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: '700', textAlign: 'center' }}>{detail}</Text>
          <Text style={{ color: theme.muted, fontSize: 22, textAlign: 'center' }}>{when}</Text>
          <Text style={{ color: theme.accent, fontSize: 28, fontWeight: '800', marginTop: 12 }}>
            {blocked === 'person' ? 'Welche Person?' : blocked === 'limit' ? 'Grenze erreicht' : 'Speichern?'}
          </Text>
          {countdown !== null ? (
            <Text style={{ color: theme.text, fontSize: 64, fontWeight: '800' }}>{countdown}</Text>
          ) : (
            <Text style={{ color: theme.muted, fontSize: 18, textAlign: 'center' }}>{spoken}</Text>
          )}
          {blocked === 'person' && current ? (
            <View style={{ alignSelf: 'stretch', gap: 8 }}>
              {current.children.map((child) => (
                <Button
                  key={child.id}
                  label={child.name}
                  variant="secondary"
                  onPress={() => {
                    if (!draft) return;
                    const chosen = { ...draft, childId: child.id, ...(draft.kind === 'temperature' ? { method: child.defaultMethod } : {}) };
                    void presentDraft(chosen, false);
                  }}
                />
              ))}
            </View>
          ) : null}
          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 8 }}>
            {blocked !== 'person' ? (
              <Button label={blocked === 'limit' ? 'Trotzdem speichern' : 'Speichern'} onPress={() => void commit(blocked === 'limit')} />
            ) : null}
            <Button label="Abbrechen" variant="secondary" onPress={() => void discard()} />
            {hasUndo ? <Button label="Rückgängig" variant="secondary" onPress={() => void undo()} /> : null}
            <Button label="Korrigieren" variant="ghost" onPress={correct} />
          </View>
          <Muted>Sag ja, speichern, nein, abbrechen oder rückgängig.</Muted>
        </View>
      ) : null}

      {phase === 'typing' ? (
        <>
          {spoken ? (
            <Text accessibilityLiveRegion="polite" style={{ color: theme.accent, fontSize: 22, fontWeight: '800' }}>
              {spoken}
            </Text>
          ) : null}
          {support === 'none' ? (
            <Banner>
              In Expo Go und im Browser ohne Mikrofon tippst du den Satz. Vorlesen, drei Sekunden und die Befehle laufen in der installierten APK
              ohne Tippen. Hier kannst du Speichern und Abbrechen antippen.
            </Banner>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mikrofon starten"
              onPress={() => void beginListen()}
              style={{
                minHeight: 96,
                borderRadius: 24,
                backgroundColor: theme.accent,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 12,
              }}
            >
              <MicIcon color={theme.onAccent} />
              <Text style={{ color: theme.onAccent, fontSize: 20, fontWeight: '800' }}>Mikrofon</Text>
            </Pressable>
          )}
          {notice ? <Banner tone="info">{notice}</Banner> : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <TextField label="Satz" value={text} onChangeText={setText} placeholder="Anna 38,5" multiline />
          <Button label="Auswerten" onPress={() => void interpret()} />
          <Muted>Beispiele: „Anna 38,5“, „vor 15 Minuten 37,3 Grad“, „Ibuprofen gegeben“, „Gewicht 9,6 Kilo“.</Muted>
          {summary && draft && current ? (
            <Card>
              <Body>Das wird gespeichert</Body>
              <Muted>{summary}</Muted>
              {current.children.length > 1 || !draft.childId ? (
                <Segmented
                  label="Person"
                  value={draft.childId}
                  options={current.children.map((child) => ({ value: child.id, label: child.name }))}
                  onChange={(childId) => {
                    const person = current.children.find((item) => item.id === childId);
                    applyDraft({
                      ...draft,
                      childId,
                      ...(draft.kind === 'temperature' && person ? { method: person.defaultMethod } : {}),
                    });
                  }}
                />
              ) : null}
              {draft.kind === 'temperature' ? (
                <>
                  <TextField label="Temperatur °C" value={draft.celsius} onChangeText={(celsius) => applyDraft({ ...draft, celsius })} keyboard="decimal-pad" />
                  <Segmented
                    label="Messart"
                    value={draft.method}
                    options={MEASUREMENT_METHODS.map((method) => ({ value: method, label: METHOD_LABELS[method] }))}
                    onChange={(method) => applyDraft({ ...draft, method })}
                  />
                </>
              ) : null}
              {draft.kind === 'dose' ? (
                <>
                  <TextField label="Dosis" value={draft.doseText} onChangeText={(doseText) => applyDraft({ ...draft, doseText })} />
                  <TextField label="Gegeben von" value={draft.givenBy} onChangeText={(givenBy) => applyDraft({ ...draft, givenBy })} />
                  {!draft.medicationId ? (
                    <>
                      <TextField label="Mindestabstand in Stunden" value={draft.interval} onChangeText={(interval) => applyDraft({ ...draft, interval })} keyboard="decimal-pad" />
                      <TextField label="Höchstens Gaben in 24 Stunden" value={draft.max} onChangeText={(max) => applyDraft({ ...draft, max })} keyboard="number-pad" />
                    </>
                  ) : null}
                </>
              ) : null}
              {draft.kind === 'growth' ? (
                <>
                  <TextField label="Gewicht kg" value={draft.weight} onChangeText={(weight) => applyDraft({ ...draft, weight })} keyboard="decimal-pad" />
                  <TextField label="Größe cm" value={draft.height} onChangeText={(height) => applyDraft({ ...draft, height })} keyboard="decimal-pad" />
                  <TextField label="Kopfumfang cm" value={draft.head} onChangeText={(head) => applyDraft({ ...draft, head })} keyboard="decimal-pad" />
                </>
              ) : null}
              <DateTimeFields date={draft.date} time={draft.time} onChange={(date, time) => applyDraft({ ...draft, date, time })} />
              <Button label="So speichern" onPress={() => void commit(false)} />
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function spokenLine(person: string, detail: string, reason: string): string {
  return [person, detail, reason, 'Sag trotzdem oder abbrechen.'].filter(Boolean).join('. ');
}
