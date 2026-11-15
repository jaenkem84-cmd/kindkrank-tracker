import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
import { limitQuestion } from '../domain/voice/spoken';
import { interpretUtterance } from '../domain/voice';
import { matchVoiceCommand } from '../domain/voice/commands';
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

type Phase = 'listening' | 'confirm' | 'saved' | 'clarify' | 'typing' | 'unknown' | 'unavailable';
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
  preview?: 'listening' | 'confirm' | 'saved' | 'unknown' | 'unavailable';
  onDone: () => void;
}) {
  const theme = useTheme();
  const { data, activeChild, update } = useStore();
  const [support] = useState<SpeechSupport>(() => (preview ? 'native' : speechSupport()));
  const [phase, setPhase] = useState<Phase>(
    preview === 'confirm'
      ? 'confirm'
      : preview === 'listening'
        ? 'listening'
        : preview === 'saved'
          ? 'saved'
          : preview === 'unknown'
            ? 'unknown'
            : preview === 'unavailable'
              ? 'unavailable'
              : 'typing',
  );
  const [text, setText] = useState('');
  const [partial, setPartial] = useState(preview === 'listening' ? 'Anna 38,5' : '');
  const [listening, setListening] = useState(preview === 'listening');
  const [notice, setNotice] = useState<string | null>(null);
  const [heard, setHeard] = useState(preview === 'unknown' ? 'hm irgendwas' : '');
  const [savedLine, setSavedLine] = useState(preview === 'saved' ? 'Eingetragen: 15.11.2026, 21:42 Uhr, 38,5 °C' : '');
  const [helpOpen, setHelpOpen] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spoken, setSpoken] = useState(preview === 'confirm' ? 'Anna, 38,5 Grad rektal, 1:52 Uhr. Speichern?' : '');
  const [summary, setSummary] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Block>(null);
  const [hasUndo, setHasUndo] = useState(false);
  const [pendingDose, setPendingDose] = useState<{ dose: DoseEntry; medication: Medication | null } | null>(null);
  const session = useRef<SpeechSession | null>(null);
  const started = useRef(false);
  const generation = useRef(0);
  const phaseRef = useRef<Phase>(phase);
  const draftRef = useRef<Draft | null>(draft);
  const dataRef = useRef(data);
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
  useKeepAwake('kindkrank-voice');

  function clearTimers() {
    for (const id of timers.current) clearInterval(id);
    timers.current = [];
    if (returnTimer.current) {
      clearTimeout(returnTimer.current);
      returnTimer.current = null;
    }
  }

  function wipe() {
    setNotice(null);
    setSpoken('');
    setError(null);
    setHeard('');
  }

  function armReturn(ms: number, next: () => void) {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    returnTimer.current = setTimeout(next, ms);
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
      if (returnTimer.current) clearTimeout(returnTimer.current);
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
      wipe();
      setBlocked(null);
      phaseRef.current = 'listening';
      setPhase('listening');
      setPartial('');
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
          if (phaseRef.current === 'clarify') void beginListen(true);
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
      setPartial('');
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
    wipe();
    applyDraft(next);
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
      const question =
        medication && assessment
          ? limitQuestion({
              medicationName: medication.name,
              minIntervalHours: medication.minIntervalHours,
              nextCount: assessment.count24h + 1,
              tooSoon: assessment.tooSoon,
              exceedsMax: assessment.exceedsMax,
            })
          : 'Die eingegebene Grenze wäre überschritten. Trotzdem eintragen?';
      phaseRef.current = 'clarify';
      setPhase('clarify');
      setBlocked('limit');
      setError(question);
      await speakGerman(question);
      if (phaseRef.current === 'clarify' && !previewRef.current) void beginListen(true);
      return;
    }
    if (!canAutoSave(next, current)) {
      phaseRef.current = 'typing';
      setPhase('typing');
      setBlocked('text');
      setError('Prüf die Angabe, bevor sie gespeichert wird.');
      return;
    }
    await commitRef.current(false);
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
    wipe();
    setHeard(raw.trim());
    phaseRef.current = 'unknown';
    setPhase('unknown');
    const line = raw.trim()
      ? `Ich habe „${raw.trim()}“ gehört, aber keinen Eintrag erkannt.`
      : 'Ich habe nichts erkannt.';
    await speakGerman(line);
    if (phaseRef.current !== 'unknown' || previewRef.current) return;
    armReturn(2800, () => {
      if (phaseRef.current !== 'unknown') return;
      if (support === 'none') {
        phaseRef.current = 'unavailable';
        setPhase('unavailable');
        return;
      }
      void beginListen();
    });
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
    if ((currentPhase === 'confirm' || currentPhase === 'clarify') && command === 'cancel') {
      await discard();
      return;
    }
    if (currentPhase === 'clarify' && blockedRef.current === 'limit' && (command === 'anyway' || command === 'save')) {
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
        const question = limitQuestion({
          medicationName: medication.name,
          minIntervalHours: medication.minIntervalHours,
          nextCount: assessment.count24h + 1,
          tooSoon: assessment.tooSoon,
          exceedsMax: assessment.exceedsMax,
        });
        setError(question);
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
        await speakGerman(question);
        if (phaseRef.current === 'clarify' && !previewRef.current) void beginListen(true);
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
    const line = confirmationLine(next, current);
    applyDraft(null);
    setPendingDose(null);
    wipe();
    setSavedLine(line);
    phaseRef.current = 'saved';
    setPhase('saved');
    saving.current = false;
    await playCue('saved');
    void speakGerman(line);
    if (previewRef.current) return;
    armReturn(5000, () => {
      if (phaseRef.current !== 'saved') return;
      stopSpeaking();
      if (support === 'none') {
        phaseRef.current = 'unavailable';
        setPhase('unavailable');
        return;
      }
      void beginListen();
    });
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
    wipe();
    setBlocked(null);
    await playCue('cancel');
    await speakGerman('Nicht gespeichert.');
    if (support !== 'none') void beginListen();
    else {
      phaseRef.current = 'unavailable';
      setPhase('unavailable');
    }
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
    wipe();
    phaseRef.current = 'typing';
    setPhase('typing');
  }

  useEffect(() => {
    if (phase !== 'listening') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  useEffect(() => {
    if (!preview || !data) return;
    wipe();
    if (preview === 'listening') {
      phaseRef.current = 'listening';
      setPhase('listening');
      setPartial('Anna 38,5');
      setListening(true);
      return;
    }
    if (preview === 'saved') {
      phaseRef.current = 'saved';
      setPhase('saved');
      setSavedLine('Eingetragen: 15.11.2026, 21:42 Uhr, 38,5 °C');
      return;
    }
    if (preview === 'unknown') {
      phaseRef.current = 'unknown';
      setPhase('unknown');
      setHeard('hm irgendwas');
      return;
    }
    if (preview === 'unavailable') {
      phaseRef.current = 'unavailable';
      setPhase('unavailable');
      return;
    }
    const medication = data.medications.find((item) => item.name.startsWith('Ibuprofen'));
    const next: Draft = {
      kind: 'dose',
      childId: data.children.find((child) => child.name === 'Anna')?.id ?? data.children[0]?.id ?? '',
      medicationId: medication?.id ?? null,
      query: 'Ibuprofen',
      candidates: [],
      doseText: '60 mg',
      givenBy: 'Michael',
      interval: '',
      max: '',
      date: '15.11.2026',
      time: '21:42',
    };
    applyDraft(next);
    phaseRef.current = 'clarify';
    setPhase('clarify');
    setBlocked('limit');
    setError(
      limitQuestion({
        medicationName: medication?.name ?? 'Ibuprofen',
        minIntervalHours: medication?.minIntervalHours ?? 6,
        nextCount: 4,
        tooSoon: false,
        exceedsMax: true,
      }),
    );
  }, [preview, data]);

  useEffect(() => {
    if (preview || started.current) return;
    started.current = true;
    if (support === 'none') {
      wipe();
      phaseRef.current = 'unavailable';
      setPhase('unavailable');
      return;
    }
    if (autoStart) void beginListen();
    // The session should arm once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, preview, support]);

  const current = data;
  const personName = current?.children.find((child) => child.id === draft?.childId)?.name ?? (preview === 'confirm' ? 'Anna' : '');
  const activeName = activeChild?.name ?? personName;
  const ring = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <Screen
      title="Spracheingabe"
      onBack={leave}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hilfe zur Spracheingabe"
          onPress={() => setHelpOpen(true)}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#2F6FED', alignItems: 'center', justifyContent: 'center' }}
        >
          <MaterialCommunityIcons name="cog" size={22} color="#FFFFFF" />
        </Pressable>
      }
      dialog={
        <ConfirmDialog
          visible={pendingDose !== null && (phase === 'typing' || phase === 'unavailable')}
          title="Grenze überschritten"
          message={`${error ?? ''} Trotzdem speichern?`}
          confirmLabel="Trotzdem speichern"
          onCancel={() => setPendingDose(null)}
          onConfirm={() => void commit(true)}
        />
      }
    >
      {phase === 'listening' ? (
        <View style={{ alignItems: 'center', gap: 16, paddingTop: 36 }}>
          <View style={{ width: 188, height: 188, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              style={{
                position: 'absolute',
                width: 168,
                height: 168,
                borderRadius: 84,
                borderWidth: 3,
                borderColor: theme.accent,
                opacity: ringOpacity,
                transform: [{ scale: ring }],
              }}
            />
            <View style={{ width: 148, height: 148, borderRadius: 74, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <MicIcon color={theme.accent} size={64} />
            </View>
          </View>
          <Text accessibilityLiveRegion="polite" style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Ich höre zu …</Text>
          <Text style={{ color: theme.muted, fontSize: 18, minHeight: 26, textAlign: 'center' }}>{partial}</Text>
          {activeName ? <Text style={{ color: theme.muted, fontSize: 13 }}>für {activeName}</Text> : null}
        </View>
      ) : null}

      {phase === 'confirm' || phase === 'clarify' ? (
        <View style={{ gap: 14, paddingTop: 12 }}>
          <Card>
            <Text accessibilityLiveRegion="polite" style={{ color: theme.text, fontSize: 22, lineHeight: 30, fontWeight: '800' }}>
              {draft && current ? confirmCard(draft, personName, current) : 'Anna · 38,5 °C rektal · 21:42'}
            </Text>
          </Card>
          {blocked === 'limit' && error ? <Banner tone="warning">{error}</Banner> : null}
          {blocked === 'person' && current ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Welche Person?</Text>
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
          ) : (
            <>
              <Button label="Speichern" onPress={() => void commit(true)} />
              <Button label="Verwerfen" variant="secondary" onPress={() => void discard()} />
              <Muted>Sag ja, trotzdem oder nein.</Muted>
            </>
          )}
        </View>
      ) : null}

      {phase === 'saved' ? (
        <View style={{ alignItems: 'center', gap: 16, paddingTop: 48 }}>
          <MaterialCommunityIcons name="check-circle" size={72} color={theme.ok} />
          <Text accessibilityLiveRegion="polite" style={{ color: theme.text, fontSize: 20, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>
            {savedLine || 'Eingetragen.'}
          </Text>
          <Button label="Rückgängig" variant="secondary" onPress={() => void undo()} />
        </View>
      ) : null}

      {phase === 'unknown' ? (
        <View style={{ gap: 12, paddingTop: 28 }}>
          <Banner tone="warning">
            {heard ? `Ich habe „${heard}“ gehört, aber keinen Eintrag erkannt.` : 'Ich habe nichts erkannt.'}
          </Banner>
          <Muted>z. B. „Anna 38,5“</Muted>
        </View>
      ) : null}

      {phase === 'unavailable' ? (
        <View style={{ gap: 12 }}>
          <Banner tone="info">
            Das Mikrofon ist hier nicht verfügbar. In Expo Go tippst du den Satz. Zuhören ohne Tippen braucht die installierte App.
          </Banner>
          <TextField label="Satz" value={text} onChangeText={setText} placeholder="Anna 38,5" multiline />
          <Button label="Auswerten" onPress={() => void interpret()} />
        </View>
      ) : null}

      {phase === 'typing' ? (
        <View style={{ gap: 12 }}>
          <TextField label="Satz" value={text} onChangeText={setText} placeholder="Anna 38,5" multiline />
          <Button label="Auswerten" onPress={() => void interpret()} />
          {support !== 'none' ? (
            <Pressable accessibilityRole="button" onPress={() => void beginListen()}>
              <Text style={{ color: theme.accent, fontSize: 15, textAlign: 'center' }}>Wieder zuhören</Text>
            </Pressable>
          ) : null}
          {summary && draft && current ? (
            <Card>
              <Body>{confirmCard(draft, personName, current)}</Body>
              <Button label="Speichern" onPress={() => void commit(false)} />
            </Card>
          ) : null}
        </View>
      ) : null}

      {phase === 'listening' || phase === 'confirm' || phase === 'clarify' ? (
        <Pressable accessibilityRole="button" onPress={correct} style={{ marginTop: 28 }}>
          <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center' }}>Stattdessen tippen</Text>
        </Pressable>
      ) : null}

      {helpOpen ? (
        <View style={{ marginTop: 16, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, padding: 14, gap: 8 }}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Sprachbefehle</Text>
          <Muted>Bei einer Grenze fragt die App nach. ja oder trotzdem trägt ein, nein verwirft. rückgängig macht den letzten Eintrag rückgängig.</Muted>
          <Button label="Schließen" variant="secondary" onPress={() => setHelpOpen(false)} />
        </View>
      ) : null}
    </Screen>
  );
}


function confirmCard(draft: Draft, person: string, data: AppData): string {
  const who = person || 'Eintrag';
  if (draft.kind === 'temperature') return `${who} · ${draft.celsius} °C ${METHOD_LABELS[draft.method]} · ${draft.time}`;
  if (draft.kind === 'symptom') return `${who} · ${draft.label} · ${draft.time}`;
  if (draft.kind === 'growth') return `${who} · ${detailFor(draft, data)} · ${draft.time}`;
  const medication = data.medications.find((item) => item.id === draft.medicationId);
  return `${who} · ${medication?.name ?? draft.query} ${draft.doseText} · ${draft.time}`.replace(/\s+/g, ' ');
}

function confirmationLine(draft: Draft, data: AppData): string {
  const clock = `${draft.date}, ${draft.time} Uhr`;
  if (draft.kind === 'temperature') return `Eingetragen: ${clock}, ${draft.celsius} °C`;
  if (draft.kind === 'symptom') return `Eingetragen: ${clock}, ${draft.label}`;
  if (draft.kind === 'growth') return `Eingetragen: ${clock}, ${detailFor(draft, data)}`;
  const medication = data.medications.find((item) => item.id === draft.medicationId);
  return `Eingetragen: ${clock}, ${medication?.name ?? draft.query} ${draft.doseText}`.replace(/\s+/g, ' ');
}
