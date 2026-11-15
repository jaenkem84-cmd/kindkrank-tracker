import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BellIcon } from '../components/chrome';
import { ReminderCard } from '../components/ReminderCard';
import { Banner, Body, Button, Card, ConfirmDialog, DateTimeFields, Muted, Screen, TextField } from '../components/ui';
import { combineBerlin, dateFieldValue, formatDateTime, timeFieldValue } from '../domain/dates';
import { formatHours, formatSince, parseDecimal } from '../domain/format';
import { createId } from '../domain/ids';
import { assessDose, type DoseAssessment } from '../domain/medication';
import { forChild } from '../domain/select';
import type { DoseEntry, Medication } from '../domain/types';
import { removeDose, removeMedication, saveDose, saveMedication } from '../data/mutations';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

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

const TILE = 196;

export function MedicationScreen({
  now,
  onDose,
  onEdit,
  onEditDose,
  onAdd,
}: {
  now: Date;
  onDose: (id: string) => void;
  onEdit: (id: string) => void;
  onEditDose: (id: string) => void;
  onAdd: () => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { data, activeChild } = useStore();
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState<string[]>([]);
  const [gearOpen, setGearOpen] = useState(false);
  const scroller = useRef<{ scrollTo: (options: { x: number; animated?: boolean }) => void } | null>(null);
  const personId = activeChild?.id ?? '';
  useEffect(() => {
    setIndex(0);
    setHidden([]);
    setGearOpen(false);
    scroller.current?.scrollTo({ x: 0, animated: false });
  }, [personId]);

  if (!data || !activeChild) return <Body>Lege zuerst eine Person an.</Body>;
  const meds = forChild(data.medications, activeChild.id);
  const doses = forChild(data.doses, activeChild.id);
  const slots = meds.length + 1;
  const activeIndex = Math.max(0, Math.min(index, slots - 1));
  const active = meds[activeIndex] ?? null;
  const sheetMed = meds.find((item) => item.id === sheetId) ?? null;
  const side = Math.max(0, (width - TILE) / 2);
  const listed = [...doses]
    .filter((dose) => !hidden.includes(dose.medicationId))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const activeAssessment = active
    ? assessDose({
        doses: doses.filter((dose) => dose.medicationId === active.id),
        minIntervalHours: active.minIntervalHours,
        maxPer24h: active.maxDosesPer24h,
        at: now,
      })
    : null;
  const activeWarning = active && activeAssessment ? warningText(active.name, activeAssessment) : null;

  function selectIndex(next: number) {
    const clamped = Math.max(0, Math.min(slots - 1, next));
    setIndex(clamped);
    scroller.current?.scrollTo({ x: clamped * TILE, animated: true });
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Button
          label={active ? 'Gabe eintragen' : 'Medikament anlegen'}
          onPress={() => (active ? onDose(active.id) : onAdd())}
        />
      </View>
      <ScrollView
        ref={(node) => {
          scroller.current = node;
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={TILE}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: side, alignItems: 'center' }}
        style={{ height: 172, marginTop: 8, flexShrink: 0 }}
        onMomentumScrollEnd={(event) => selectIndex(Math.round(event.nativeEvent.contentOffset.x / TILE))}
        onScrollEndDrag={(event) => selectIndex(Math.round(event.nativeEvent.contentOffset.x / TILE))}
      >
        {meds.map((medication, slot) => {
          const own = doses.filter((dose) => dose.medicationId === medication.id);
          const assessment = assessDose({
            doses: own,
            minIntervalHours: medication.minIntervalHours,
            maxPer24h: medication.maxDosesPer24h,
            at: now,
          });
          const reminder = data.reminders.find((item) => item.medicationId === medication.id && item.enabled);
          const since = assessment.hoursSince === null ? 'noch keine Gabe' : formatSince(assessment.hoursSince);
          const focused = slot === activeIndex;
          return (
            <View key={medication.id} style={{ width: TILE, alignItems: 'center', justifyContent: 'center', opacity: focused ? 1 : 0.45 }}>
              <View
                style={{
                  width: focused ? 184 : 150,
                  height: focused ? 148 : 120,
                  borderRadius: 16,
                  borderWidth: focused ? 2 : 1,
                  borderColor: focused ? theme.accent : theme.border,
                  backgroundColor: theme.card,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  justifyContent: 'space-between',
                }}
              >
                <Pressable accessibilityRole="button" accessibilityLabel={medication.name} accessibilityState={{ selected: focused }} onPress={() => (focused ? onEdit(medication.id) : selectIndex(slot))} style={{ gap: 1 }}>
                  <Text style={{ color: theme.text, fontSize: focused ? 16 : 14, lineHeight: 20, fontWeight: '800' }} numberOfLines={2}>
                    {medication.name}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 17 }} numberOfLines={1}>
                    {medication.doseText}
                  </Text>
                  <Text style={{ color: focused ? theme.accent : theme.muted, fontSize: 13, lineHeight: 17 }} numberOfLines={1}>
                    {since}
                  </Text>
                  <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                    heute {assessment.countToday}/{medication.maxDosesPer24h}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={reminder ? 'Erinnerung an' : 'Erinnerung aus'}
                    onPress={() => setSheetId(medication.id)}
                    style={{ width: 40, height: 36, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <BellIcon color={reminder ? theme.accent : theme.muted} filled={Boolean(reminder)} />
                  </Pressable>
                  {focused ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Gabe eintragen"
                      onPress={() => onDose(medication.id)}
                      style={{ minWidth: 76, height: 34, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: theme.onAccent, fontSize: 14, fontWeight: '800' }}>+ Gabe</Text>
                    </Pressable>
                  ) : (
                    <View style={{ width: 40 }} />
                  )}
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ width: TILE, alignItems: 'center', justifyContent: 'center', opacity: active ? 0.55 : 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Medikament anlegen"
            onPress={onAdd}
            style={{
              width: active ? 150 : 184,
              height: active ? 120 : 148,
              borderRadius: 16,
              borderWidth: active ? 1 : 2,
              borderColor: theme.accent,
              backgroundColor: theme.card,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <Text style={{ color: theme.accent, fontSize: 36, lineHeight: 40, fontWeight: '700' }}>+</Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>Neu</Text>
          </Pressable>
        </View>
      </ScrollView>
      {activeWarning ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Banner tone="warning">{activeWarning}</Banner>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 }}>
        <Text style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: '700' }}>Gaben</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gaben filtern"
          onPress={() => setGearOpen((open) => !open)}
          style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: theme.text, fontSize: 18 }}>⚙</Text>
        </Pressable>
      </View>
      {gearOpen ? (
        <View style={{ marginHorizontal: 16, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, gap: 8, backgroundColor: theme.card }}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>In der Liste</Text>
          {meds.length === 0 ? <Muted>Noch kein Medikament.</Muted> : null}
          {meds.map((medication) => {
            const on = !hidden.includes(medication.id);
            return (
              <Text
                key={medication.id}
                onPress={() => setHidden(on ? [...hidden, medication.id] : hidden.filter((id) => id !== medication.id))}
                style={{ color: theme.text, fontSize: 15, lineHeight: 22, paddingVertical: 4 }}
              >
                {on ? '☑' : '☐'} {medication.name}
              </Text>
            );
          })}
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 8, paddingBottom: 28 }}>
        {meds.length === 0 ? (
          <Body>Noch kein Medikament. Name, Dosis, Abstand und Maximum trägst du selbst ein.</Body>
        ) : listed.length === 0 ? (
          <Body>Keine Gaben für diese Auswahl.</Body>
        ) : null}
        {listed.map((dose) => {
          const medication = meds.find((item) => item.id === dose.medicationId);
          const marked = active?.id === dose.medicationId;
          return (
            <View
              key={dose.id}
              style={{
                minHeight: 52,
                borderRadius: 12,
                borderWidth: marked ? 1.5 : 1,
                borderColor: marked ? theme.accent : theme.border,
                backgroundColor: theme.card,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Pressable accessibilityRole="button" accessibilityLabel="Gabe ändern" onPress={() => onEditDose(dose.id)} style={{ flex: 1, paddingLeft: 12, paddingVertical: 6, justifyContent: 'center' }}>
                <Text style={{ color: marked ? theme.accent : theme.text, fontSize: 16, lineHeight: 20, fontWeight: '700' }} numberOfLines={1}>
                  {medication?.name ?? 'Medikament'} · {dose.doseText}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                  {formatDateTime(new Date(dose.timestamp))} · {dose.givenBy}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Ändern" onPress={() => onEditDose(dose.id)} style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: theme.muted, fontSize: 22, lineHeight: 24 }}>›</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      {sheetMed ? (
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }]} onPress={() => setSheetId(null)}>
          <Pressable onPress={() => undefined} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 8, maxHeight: '86%' }}>
            <Text style={{ color: theme.text, fontSize: 18, lineHeight: 24, fontWeight: '700' }}>Erinnerung · {sheetMed.name}</Text>
            <ReminderCard
              childId={activeChild.id}
              kind="medication"
              medicationId={sheetMed.id}
              reminder={data.reminders.find((item) => item.medicationId === sheetMed.id)}
            />
            <Button label="Schließen" variant="secondary" onPress={() => setSheetId(null)} />
          </Pressable>
        </Pressable>
      ) : null}
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
