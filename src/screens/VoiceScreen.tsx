import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Banner, Body, Button, Card, ConfirmDialog, DateTimeFields, MicIcon, Muted, Screen, Segmented, TextField } from '../components/ui';
import { combineBerlin, dateFieldValue, timeFieldValue } from '../domain/dates';
import { parseDecimal } from '../domain/format';
import { createId } from '../domain/ids';
import { assessDose } from '../domain/medication';
import {
  MEASUREMENT_METHODS,
  METHOD_LABELS,
  type DoseEntry,
  type GrowthEntry,
  type MeasurementMethod,
  type Medication,
  type TemperatureEntry,
} from '../domain/types';
import { interpretUtterance } from '../domain/voice';
import type { ParseContext } from '../domain/voice/types';
import { saveDose, saveGrowth, saveMedication, saveSymptom, saveTemperature } from '../data/mutations';
import type { SymptomEntry } from '../domain/types';
import { speechSupport, startSpeech, type SpeechSession, type SpeechSupport } from '../speech/recognition';
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

export function VoiceScreen({ autoStart = false, onDone }: { autoStart?: boolean; onDone: () => void }) {
  const theme = useTheme();
  const { data, activeChild, update } = useStore();
  const [support] = useState<SpeechSupport>(() => speechSupport());
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDose, setPendingDose] = useState<{ dose: DoseEntry; medication: Medication | null } | null>(null);
  const session = useRef<SpeechSession | null>(null);
  const started = useRef(false);

  useEffect(() => () => session.current?.stop(), []);

  async function listen() {
    setNotice(null);
    setError(null);
    const next = await startSpeech({
      onPartial: setText,
      onFinal: (spoken) => {
        setText(spoken);
        void interpret(spoken);
      },
      onError: setNotice,
      onEnd: () => setListening(false),
    });
    session.current = next;
    setListening(Boolean(next));
    if (!next) setNotice('Spracherkennung ist hier nicht verfügbar. Der Satz kann unten eingetippt werden.');
  }

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    if (support === 'none') {
      setNotice('In Expo Go und Snack gibt es meist kein Mikrofon im System. Tipp den Satz unten ein. Eine echte Spracherkennung braucht einen Entwicklungs-Build.');
      return;
    }
    void listen();
    // listen is recreated each render; auto-start should happen once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, support]);

  function buildContext(): ParseContext | null {
    if (!data) return null;
    const lastDoseTextByMedicationId: Record<string, string> = {};
    for (const medication of data.medications) {
      const last = data.doses
        .filter((dose) => dose.medicationId === medication.id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      if (last?.doseText) lastDoseTextByMedicationId[medication.id] = last.doseText;
    }
    return {
      now: new Date(),
      children: data.children.map((child) => ({
        id: child.id,
        name: child.name,
        role: child.role,
        isSelf: child.isSelf,
        defaultMethod: child.defaultMethod,
      })),
      medications: data.medications.map((medication) => ({
        id: medication.id,
        childId: medication.childId,
        name: medication.name,
        doseText: medication.doseText,
      })),
      activeChildId: activeChild?.id ?? null,
      defaultMethod: data.settings.defaultMethod,
      defaultGivenBy: data.settings.defaultGivenBy,
      lastDoseTextByMedicationId,
    };
  }

  async function interpret(raw = text) {
    const context = buildContext();
    if (!context) return;
    setError(null);
    setPendingDose(null);
    const result = await interpretUtterance(raw, context);
    setSummary(result.summary);
    const personId = result.personAmbiguous ? '' : (result.intent.type === 'unknown' ? '' : (result.intent.childId ?? activeChild?.id ?? ''));
    if (result.intent.type === 'temperature') {
      const at = new Date(result.intent.timestamp);
      setDraft({
        kind: 'temperature',
        childId: personId,
        celsius: String(result.intent.celsius).replace('.', ','),
        method: result.intent.method,
        date: dateFieldValue(at),
        time: timeFieldValue(at),
      });
      return;
    }
    if (result.intent.type === 'growth') {
      const at = new Date(result.intent.timestamp);
      setDraft({
        kind: 'growth',
        childId: personId,
        weight: result.intent.weightKg === null ? '' : String(result.intent.weightKg).replace('.', ','),
        height: result.intent.heightCm === null ? '' : String(result.intent.heightCm).replace('.', ','),
        head: result.intent.headCm === null ? '' : String(result.intent.headCm).replace('.', ','),
        date: dateFieldValue(at),
        time: timeFieldValue(at),
      });
      return;
    }
    if (result.intent.type === 'symptom') {
      const at = new Date(result.intent.timestamp);
      setDraft({
        kind: 'symptom',
        childId: personId,
        symptomId: result.intent.symptomId,
        label: result.intent.label,
        severity: result.intent.severity,
        date: dateFieldValue(at),
        time: timeFieldValue(at),
      });
      return;
    }
    if (result.intent.type === 'dose') {
      const at = new Date(result.intent.timestamp);
      setDraft({
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
      });
      return;
    }
    setDraft(null);
    setNotice(result.summary);
  }

  function save() {
    if (!data || !draft) return;
    if (!draft.childId) {
      setError('Bitte eine Person wählen.');
      return;
    }
    if (draft.kind === 'temperature') {
      const value = parseDecimal(draft.celsius);
      const when = combineBerlin(draft.date, draft.time);
      if (value === null || value < 34 || value > 43 || !when) {
        setError('Prüf Temperatur, Datum und Uhrzeit.');
        return;
      }
      const entry: TemperatureEntry = {
        id: createId('temp'),
        childId: draft.childId,
        timestamp: when.toISOString(),
        celsius: value,
        method: draft.method,
        note: '',
        isExample: false,
      };
      update((current) => saveTemperature(current, entry));
      onDone();
      return;
    }
    if (draft.kind === 'symptom') {
      const when = combineBerlin(draft.date, draft.time);
      if (!when) {
        setError('Prüf Datum und Uhrzeit.');
        return;
      }
      const entry: SymptomEntry = {
        id: createId('sym'),
        childId: draft.childId,
        timestamp: when.toISOString(),
        symptomId: draft.symptomId,
        label: draft.label,
        severity: draft.severity,
        note: '',
        isExample: false,
      };
      update((current) => saveSymptom(current, entry));
      onDone();
      return;
    }
    if (draft.kind === 'growth') {
      const when = combineBerlin(draft.date, draft.time);
      const weight = draft.weight.trim() ? parseDecimal(draft.weight) : undefined;
      const height = draft.height.trim() ? parseDecimal(draft.height) : undefined;
      const head = draft.head.trim() ? parseDecimal(draft.head) : undefined;
      if (!when || weight === null || height === null || head === null) {
        setError('Prüf die Zahlen und die Zeit.');
        return;
      }
      if (weight === undefined && height === undefined && head === undefined) {
        setError('Es fehlt ein Messwert.');
        return;
      }
      const entry: GrowthEntry = {
        id: createId('wuchs'),
        childId: draft.childId,
        timestamp: when.toISOString(),
        isExample: false,
      };
      if (weight !== undefined) entry.weightKg = weight;
      if (height !== undefined) entry.heightCm = height;
      if (head !== undefined) entry.headCm = head;
      update((current) => saveGrowth(current, entry));
      onDone();
      return;
    }

    const when = combineBerlin(draft.date, draft.time);
    if (!when || !draft.doseText.trim() || !draft.givenBy.trim()) {
      setError('Dosis, gebende Person und Zeitpunkt werden gebraucht.');
      return;
    }
    let medication = draft.medicationId ? data.medications.find((item) => item.id === draft.medicationId) ?? null : null;
    let created: Medication | null = null;
    if (!medication) {
      const hours = parseDecimal(draft.interval);
      const maximum = Number(draft.max.trim());
      if (!draft.query.trim() && !draft.doseText.trim()) {
        setError('Welches Medikament?');
        return;
      }
      if (hours === null || hours <= 0 || !Number.isInteger(maximum) || maximum < 1) {
        setError('Für ein neues Medikament brauche ich Abstand in Stunden und die Höchstzahl pro 24 Stunden. Die App schlägt keine Dosis vor.');
        return;
      }
      created = {
        id: createId('med'),
        childId: draft.childId,
        name: draft.query.trim() || 'Medikament',
        doseText: draft.doseText.trim(),
        minIntervalHours: hours,
        maxDosesPer24h: maximum,
        isExample: false,
      };
      medication = created;
    }
    const others = data.doses.filter((dose) => dose.medicationId === medication?.id);
    const assessment = assessDose({
      doses: created ? [] : others,
      minIntervalHours: medication.minIntervalHours,
      maxPer24h: medication.maxDosesPer24h,
      at: when,
    });
    const dose: DoseEntry = {
      id: createId('gabe'),
      childId: draft.childId,
      medicationId: medication.id,
      timestamp: when.toISOString(),
      givenBy: draft.givenBy.trim(),
      doseText: draft.doseText.trim(),
      note: '',
      overridden: assessment.tooSoon || assessment.exceedsMax,
      isExample: false,
    };
    if (dose.overridden) {
      const reason = [
        assessment.tooSoon ? 'Der Mindestabstand ist noch nicht um.' : null,
        assessment.exceedsMax ? 'Die Höchstzahl in 24 Stunden wäre überschritten.' : null,
      ]
        .filter(Boolean)
        .join(' ');
      setError(`${medication.name}: ${reason}`);
      setPendingDose({ dose, medication: created });
      return;
    }
    update((current) => {
      const withMed = created ? saveMedication(current, created) : current;
      return saveDose(withMed, dose);
    });
    onDone();
  }

  return (
    <Screen
      title="Spracheingabe"
      onBack={onDone}
      footer={
        <>
          {error && !pendingDose ? <Banner tone="danger">{error}</Banner> : null}
          <Button label="Auswerten" onPress={() => void interpret()} />
          {draft ? <Button label="So speichern" onPress={save} /> : null}
        </>
      }
      dialog={
        <ConfirmDialog
          visible={pendingDose !== null}
          title="Grenze überschritten"
          message={`${error ?? ''} Trotzdem speichern?`}
          confirmLabel="Trotzdem speichern"
          onCancel={() => setPendingDose(null)}
          onConfirm={() => {
            if (!pendingDose) return;
            update((current) => {
              const withMed = pendingDose.medication ? saveMedication(current, pendingDose.medication) : current;
              return saveDose(withMed, pendingDose.dose);
            });
            onDone();
          }}
        />
      }
    >
      <Muted>Deutsch (de-DE). Nichts wird gespeichert, bevor du es bestätigt hast.</Muted>
      {support === 'none' ? (
        <Banner>
          Mikrofon über die System-Spracherkennung ist in Snack und Expo Go in der Regel nicht dabei. Unten tippen
          funktioniert mit demselben Parser. Für echtes Mikrofon: Entwicklungs-Build mit expo-speech-recognition.
        </Banner>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listening ? 'Zuhören beenden' : 'Mikrofon starten'}
          onPress={() => {
            if (listening) {
              session.current?.stop();
              setListening(false);
              return;
            }
            void listen();
          }}
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
          <Text style={{ color: theme.onAccent, fontSize: 20, fontWeight: '800' }}>{listening ? 'Hört zu …' : 'Mikrofon'}</Text>
        </Pressable>
      )}
      {notice ? <Banner tone="info">{notice}</Banner> : null}
      <TextField
        label="Satz"
        value={text}
        onChangeText={setText}
        placeholder="Temperatur jetzt 38,2"
        multiline
      />
      <Muted>Beispiele: „vor 15 Minuten 37,3 Grad“, „Ibuprofen gegeben“, „Paracetamol-Zäpfchen gegeben“, „Gewicht 9,6 Kilo“.</Muted>
      {summary && draft ? (
        <Card>
          <Body>Das wird gespeichert</Body>
          <Muted>{summary}</Muted>
          {data && (data.children.length > 1 || !draft.childId) ? (
            <Segmented
              label="Person"
              value={draft.childId}
              options={data.children.map((child) => ({ value: child.id, label: child.name }))}
              onChange={(childId) => {
                const person = data.children.find((item) => item.id === childId);
                setDraft({
                  ...draft,
                  childId,
                  ...(draft.kind === 'temperature' && person ? { method: person.defaultMethod } : {}),
                });
                if (person) {
                  setSummary((current) => {
                    const text = current ?? '';
                    return text.startsWith('Welche Person')
                      ? `Eingetragen: ${person.name}, ${text.replace(/^Welche Person ist gemeint\?\s*/, '')}`
                      : text.replace(/^Eingetragen: [^,]+/, `Eingetragen: ${person.name}`);
                  });
                }
              }}
            />
          ) : null}
          {draft.kind === 'temperature' ? (
            <>
              <TextField label="Temperatur °C" value={draft.celsius} onChangeText={(celsius) => setDraft({ ...draft, celsius })} keyboard="decimal-pad" />
              <Segmented
                label="Messart"
                value={draft.method}
                options={MEASUREMENT_METHODS.map((method) => ({ value: method, label: METHOD_LABELS[method] }))}
                onChange={(method) => setDraft({ ...draft, method })}
              />
            </>
          ) : null}
          {draft.kind === 'dose' ? (
            <>
              {draft.candidates.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Body>Welches Medikament?</Body>
                  {draft.candidates.map((id) => {
                    const medication = data?.medications.find((item) => item.id === id);
                    if (!medication) return null;
                    return (
                      <Button
                        key={id}
                        label={medication.name}
                        variant={draft.medicationId === id ? 'primary' : 'secondary'}
                        onPress={() =>
                          setDraft({
                            ...draft,
                            medicationId: id,
                            doseText: medication.doseText,
                            childId: medication.childId,
                          })
                        }
                      />
                    );
                  })}
                </View>
              ) : null}
              <TextField label="Dosis" value={draft.doseText} onChangeText={(doseText) => setDraft({ ...draft, doseText })} />
              <TextField label="Gegeben von" value={draft.givenBy} onChangeText={(givenBy) => setDraft({ ...draft, givenBy })} />
              {!draft.medicationId ? (
                <>
                  <Banner tone="warning">
                    „{draft.query || 'Dieses Medikament'}“ ist noch nicht angelegt. Abstand und Maximum musst du selbst
                    eintragen.
                  </Banner>
                  <TextField label="Mindestabstand in Stunden" value={draft.interval} onChangeText={(interval) => setDraft({ ...draft, interval })} keyboard="decimal-pad" />
                  <TextField label="Höchstens Gaben in 24 Stunden" value={draft.max} onChangeText={(max) => setDraft({ ...draft, max })} keyboard="number-pad" />
                </>
              ) : null}
            </>
          ) : null}
          {draft.kind === 'growth' ? (
            <>
              <TextField label="Gewicht kg" value={draft.weight} onChangeText={(weight) => setDraft({ ...draft, weight })} keyboard="decimal-pad" />
              <TextField label="Größe cm" value={draft.height} onChangeText={(height) => setDraft({ ...draft, height })} keyboard="decimal-pad" />
              <TextField label="Kopfumfang cm" value={draft.head} onChangeText={(head) => setDraft({ ...draft, head })} keyboard="decimal-pad" />
            </>
          ) : null}
          <DateTimeFields
            date={draft.date}
            time={draft.time}
            onChange={(date, time) => setDraft({ ...draft, date, time })}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
