import { useState } from 'react';
import { Text, View } from 'react-native';
import { Banner, Body, Button, Card, ConfirmDialog, DateTimeFields, Muted, Screen, TextField } from '../components/ui';
import { combineBerlin, dateFieldValue, formatDateTime, formatTime, sameBerlinDay, timeFieldValue } from '../domain/dates';
import { formatHours, formatSince, parseDecimal } from '../domain/format';
import { createId } from '../domain/ids';
import { assessDose, type DoseAssessment } from '../domain/medication';
import { forChild } from '../domain/select';
import { MEDICAL_DISCLAIMER, type DoseEntry, type Medication } from '../domain/types';
import { removeDose, removeMedication, saveDose, saveMedication } from '../data/mutations';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

function limitsText(assessment: DoseAssessment, now: Date): string {
  if (!assessment.lastDoseAt || !assessment.nextEarliest) return 'noch keine Gabe';
  if (assessment.nextEarliest.getTime() <= now.getTime()) return 'nächste Gabe jetzt möglich';
  const clock = sameBerlinDay(assessment.nextEarliest, now)
    ? `um ${formatTime(assessment.nextEarliest)}`
    : `am ${formatDateTime(assessment.nextEarliest)}`;
  return `nächste Gabe frühestens ${clock}`;
}

function warningText(name: string, assessment: DoseAssessment): string | null {
  const parts: string[] = [];
  if (assessment.tooSoon && assessment.nextEarliest) {
    parts.push(
      `Der Mindestabstand von ${formatHours(assessment.minIntervalHours)} ist noch nicht um. Frühestens ${formatDateTime(assessment.nextEarliest)}.`,
    );
  }
  if (assessment.exceedsMax) {
    parts.push(
      `In den letzten 24 Stunden sind schon ${assessment.count24h} von ${assessment.maxPer24h} Gaben eingetragen. Das wäre die ${assessment.count24h + 1}.`,
    );
  }
  if (parts.length === 0) return null;
  return `${name}: ${parts.join(' ')} Diese Grenzen hast du selbst eingetragen.`;
}

export function MedicationScreen({ now, onDose, onEdit }: { now: Date; onDose: (id: string) => void; onEdit: (id: string) => void }) {
  const theme = useTheme();
  const { data, activeChild } = useStore();
  if (!data || !activeChild) return <Body>Lege zuerst ein Kind an.</Body>;
  const meds = forChild(data.medications, activeChild.id);
  const doses = forChild(data.doses, activeChild.id);
  return (
    <View style={{ gap: 14 }}>
      <Muted>{MEDICAL_DISCLAIMER}</Muted>
      {meds.length === 0 ? <Body>Noch kein Medikament. Trag Name, Dosis, Abstand und Maximum selbst ein.</Body> : null}
      {meds.map((medication) => {
        const own = doses.filter((dose) => dose.medicationId === medication.id);
        const assessment = assessDose({
          doses: own,
          minIntervalHours: medication.minIntervalHours,
          maxPer24h: medication.maxDosesPer24h,
          at: now,
        });
        return (
          <Card key={medication.id}>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{medication.name}</Text>
            <Muted>
              {medication.doseText} · Abstand {formatHours(medication.minIntervalHours)} · höchstens {medication.maxDosesPer24h}{' '}
              in 24 h
            </Muted>
            <Body>
              {assessment.lastDoseAt
                ? `letzte Gabe ${formatDateTime(new Date(assessment.lastDoseAt))}${assessment.hoursSince !== null ? ` · ${formatSince(assessment.hoursSince)}` : ''}`
                : 'letzte Gabe: noch keine'}
            </Body>
            <Body>{limitsText(assessment, now)}</Body>
            <Body>{`Heute: ${assessment.countToday} · letzte 24h: ${assessment.count24h} von ${medication.maxDosesPer24h}`}</Body>
            {assessment.count24h >= medication.maxDosesPer24h ? <Banner tone="warning">Maximum für 24 Stunden erreicht.</Banner> : null}
            <Button label="Gabe eintragen" onPress={() => onDose(medication.id)} />
            <Button label="Medikament ändern" variant="secondary" onPress={() => onEdit(medication.id)} />
          </Card>
        );
      })}
    </View>
  );
}

export function MedicationForm({
  medicationId,
  prefillName = '',
  onDone,
}: {
  medicationId?: string;
  prefillName?: string;
  onDone: () => void;
}) {
  const { data, activeChild, update } = useStore();
  const existing = data?.medications.find((entry) => entry.id === medicationId);
  const [name, setName] = useState(existing?.name ?? prefillName);
  const [doseText, setDoseText] = useState(existing?.doseText ?? '');
  const [interval, setIntervalHours] = useState(existing ? String(existing.minIntervalHours).replace('.', ',') : '');
  const [max, setMax] = useState(existing ? String(existing.maxDosesPer24h) : '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    if (!data || !activeChild) return;
    const hours = parseDecimal(interval);
    const maximum = Number(max.trim());
    if (!name.trim()) {
      setError('Wie heißt das Medikament?');
      return;
    }
    if (!doseText.trim()) {
      setError('Trag die Dosis so ein, wie sie gegeben werden soll. Die App rechnet sie nicht aus.');
      return;
    }
    if (hours === null || hours <= 0 || hours > 72) {
      setError('Mindestabstand in Stunden, größer als 0 und höchstens 72.');
      return;
    }
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 24) {
      setError('Höchstzahl der Gaben in 24 Stunden als ganze Zahl von 1 bis 24.');
      return;
    }
    const entry: Medication = {
      id: existing?.id ?? createId('med'),
      childId: existing?.childId ?? activeChild.id,
      name: name.trim(),
      doseText: doseText.trim(),
      minIntervalHours: hours,
      maxDosesPer24h: maximum,
      isExample: existing?.isExample ?? false,
    };
    update((current) => saveMedication(current, entry));
    onDone();
  }

  return (
    <Screen
      title={existing ? 'Medikament ändern' : 'Medikament'}
      onBack={onDone}
      footer={
        <>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button label="Speichern" onPress={save} />
          {existing ? <Button label="Medikament löschen" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
        </>
      }
      dialog={
        <ConfirmDialog
          visible={confirmDelete}
          title="Medikament löschen?"
          message="Das Medikament und die dazu eingetragenen Gaben werden gelöscht."
          confirmLabel="Wirklich löschen"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            if (!existing) return;
            update((current) => removeMedication(current, existing.id));
            onDone();
          }}
        />
      }
    >
      <Banner tone="info">
        Keine Dosisberechnung. Trag ein, was auf dem Beipackzettel steht oder was Ärztin, Arzt oder Apotheke gesagt haben.
      </Banner>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="z. B. Ibuprofen-Saft" />
      <TextField label="Dosis" value={doseText} onChangeText={setDoseText} placeholder="z. B. 2,5 ml oder 1 Zäpfchen" />
      <TextField
        label="Mindestabstand in Stunden"
        value={interval}
        onChangeText={setIntervalHours}
        placeholder="laut Beipackzettel"
        keyboard="decimal-pad"
      />
      <TextField
        label="Höchstens so viele Gaben in 24 Stunden"
        value={max}
        onChangeText={setMax}
        placeholder="laut Beipackzettel"
        keyboard="number-pad"
      />
    </Screen>
  );
}

export function DoseForm({
  medicationId,
  entryId,
  onDone,
}: {
  medicationId?: string;
  entryId?: string;
  onDone: () => void;
}) {
  const { data, activeChild, update } = useStore();
  const existing = data?.doses.find((entry) => entry.id === entryId);
  const initialMedId = existing?.medicationId ?? medicationId ?? '';
  const initialMed = data?.medications.find((entry) => entry.id === initialMedId);
  const lastDose = data?.doses
    .filter((entry) => entry.medicationId === initialMedId && entry.id !== existing?.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const initialWhen = existing ? new Date(existing.timestamp) : new Date();
  const [selectedId, setSelectedId] = useState(initialMedId);
  const [doseText, setDoseText] = useState(existing?.doseText ?? lastDose?.doseText ?? initialMed?.doseText ?? '');
  const [givenBy, setGivenBy] = useState(existing?.givenBy ?? data?.settings.defaultGivenBy ?? '');
  const [date, setDate] = useState(dateFieldValue(initialWhen));
  const [time, setTime] = useState(timeFieldValue(initialWhen));
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<DoseEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const medication = data?.medications.find((entry) => entry.id === selectedId) ?? null;
  const choices = data && activeChild ? forChild(data.medications, existing?.childId ?? activeChild.id) : [];

  function choose(id: string) {
    setSelectedId(id);
    const med = data?.medications.find((entry) => entry.id === id);
    const previous = data?.doses
      .filter((entry) => entry.medicationId === id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    setDoseText(previous?.doseText || med?.doseText || '');
  }

  function build(overridden: boolean): DoseEntry | null {
    if (!data || !activeChild || !medication) return null;
    const when = combineBerlin(date, time);
    if (!doseText.trim()) {
      setError('Welche Dosis wurde gegeben?');
      return null;
    }
    if (!givenBy.trim()) {
      setError('Wer hat die Gabe gegeben?');
      return null;
    }
    if (!when) {
      setError('Datum als TT.MM.JJJJ und Uhrzeit als HH:MM.');
      return null;
    }
    return {
      id: existing?.id ?? createId('gabe'),
      childId: existing?.childId ?? medication.childId,
      medicationId: medication.id,
      timestamp: when.toISOString(),
      givenBy: givenBy.trim(),
      doseText: doseText.trim(),
      note: note.trim(),
      overridden,
      isExample: existing?.isExample ?? false,
    };
  }

  function save() {
    if (!data || !medication) {
      setError('Wähle zuerst ein Medikament.');
      return;
    }
    const when = combineBerlin(date, time);
    if (!when) {
      setError('Datum als TT.MM.JJJJ und Uhrzeit als HH:MM.');
      return;
    }
    const others = data.doses.filter((entry) => entry.medicationId === medication.id && entry.id !== existing?.id);
    const assessment = assessDose({
      doses: others,
      minIntervalHours: medication.minIntervalHours,
      maxPer24h: medication.maxDosesPer24h,
      at: when,
    });
    const warning = warningText(medication.name, assessment);
    const entry = build(Boolean(warning));
    if (!entry) return;
    if (warning) {
      setError(warning);
      setPending(entry);
      return;
    }
    update((current) => saveDose(current, entry));
    onDone();
  }

  return (
    <Screen
      title={existing ? 'Gabe ändern' : 'Gabe'}
      onBack={onDone}
      footer={
        <>
          {error && !pending ? <Banner tone="danger">{error}</Banner> : null}
          <Button label="Speichern" onPress={save} />
          {existing ? <Button label="Gabe löschen" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
        </>
      }
      dialog={
        <>
          <ConfirmDialog
            visible={pending !== null}
            title="Grenze überschritten"
            message={`${error ?? ''} Trotzdem speichern?`}
            confirmLabel="Trotzdem speichern"
            onCancel={() => setPending(null)}
            onConfirm={() => {
              if (!pending) return;
              update((current) => saveDose(current, pending));
              onDone();
            }}
          />
          <ConfirmDialog
            visible={confirmDelete}
            title="Gabe löschen?"
            message="Der Eintrag wird entfernt."
            confirmLabel="Wirklich löschen"
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => {
              if (!existing) return;
              update((current) => removeDose(current, existing.id));
              onDone();
            }}
          />
        </>
      }
    >
      <Muted>Die Dosis startet mit der letzten Gabe dieses Medikaments, sonst mit der von dir hinterlegten Dosis.</Muted>
      {choices.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Body>Medikament</Body>
          {choices.map((item) => (
            <Button
              key={item.id}
              label={item.name}
              variant={item.id === selectedId ? 'primary' : 'secondary'}
              onPress={() => choose(item.id)}
            />
          ))}
        </View>
      ) : (
        <Body>{medication?.name ?? 'Kein Medikament angelegt.'}</Body>
      )}
      <TextField label="Dosis" value={doseText} onChangeText={setDoseText} placeholder="wie gegeben" />
      <TextField label="Gegeben von" value={givenBy} onChangeText={setGivenBy} placeholder="Name" />
      <DateTimeFields date={date} time={time} onChange={(nextDate, nextTime) => { setDate(nextDate); setTime(nextTime); }} />
      <TextField label="Notiz" value={note} onChangeText={setNote} placeholder="optional" />
      {medication ? (
        <Muted>
          Hinterlegt: Abstand {formatHours(medication.minIntervalHours)}, höchstens {medication.maxDosesPer24h} Gaben in 24 h.
        </Muted>
      ) : null}
    </Screen>
  );
}
