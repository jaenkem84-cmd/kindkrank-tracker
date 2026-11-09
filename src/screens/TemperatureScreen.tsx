import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TemperatureChart } from '../components/charts/TemperatureChart';
import { ReminderCard } from '../components/ReminderCard';
import { Banner, Body, Button, Card, ConfirmDialog, DateTimeFields, Muted, Screen, Segmented, TextField } from '../components/ui';
import { combineBerlin, dateFieldValue, formatDateTime, timeFieldValue } from '../domain/dates';
import { formatCelsius, parseDecimal } from '../domain/format';
import { createId } from '../domain/ids';
import { forChild } from '../domain/select';
import { MEASUREMENT_METHODS, METHOD_LABELS, type MeasurementMethod, type TemperatureEntry } from '../domain/types';
import { removeTemperature, saveTemperature } from '../data/mutations';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

export function TemperatureScreen({ now, onEdit, onAdd }: { now: Date; onEdit: (id: string) => void; onAdd: () => void }) {
  const theme = useTheme();
  const [days, setDays] = useState(5);
  const [stepHours, setStepHours] = useState(6);
  const { data, activeChild } = useStore();
  if (!data || !activeChild) return <Body>Lege zuerst ein Kind an.</Body>;
  const own = forChild(data.temperatures, activeChild.id);
  const listed = [...own].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const reminder = data.reminders.find((item) => item.childId === activeChild.id && item.kind === 'temperature');

  return (
    <View style={{ gap: 14 }}>
      <Button label="Temperatur eintragen" onPress={onAdd} />
      <Card>
        <TemperatureChart
          entries={own}
          doses={forChild(data.doses, activeChild.id)}
          medications={forChild(data.medications, activeChild.id)}
          now={now}
          days={days}
          stepHours={stepHours}
          onDays={setDays}
          onStep={setStepHours}
        />
      </Card>
      <ReminderCard childId={activeChild.id} kind="temperature" reminder={reminder} />
      {listed.map((entry) => (
        <Pressable key={entry.id} accessibilityRole="button" onPress={() => onEdit(entry.id)}>
          <Card>
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{formatCelsius(entry.celsius)}</Text>
            <Body>
              {formatDateTime(new Date(entry.timestamp))} · {METHOD_LABELS[entry.method]}
            </Body>
            {entry.note ? <Muted>{entry.note}</Muted> : null}
            {entry.isExample ? <Muted>Beispieldaten</Muted> : null}
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

export function TemperatureForm({ entryId, onDone }: { entryId?: string; onDone: () => void }) {
  const { data, activeChild, update } = useStore();
  const existing = data?.temperatures.find((entry) => entry.id === entryId);
  const initial = existing ? new Date(existing.timestamp) : new Date();
  const [celsius, setCelsius] = useState(existing ? String(existing.celsius).replace('.', ',') : '');
  const [method, setMethod] = useState<MeasurementMethod>(existing?.method ?? data?.settings.defaultMethod ?? 'rektal');
  const [date, setDate] = useState(dateFieldValue(initial));
  const [time, setTime] = useState(timeFieldValue(initial));
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    if (!data || !activeChild) return;
    const value = parseDecimal(celsius);
    const when = combineBerlin(date, time);
    if (value === null || value < 34 || value > 43) {
      setError('Trag eine Temperatur zwischen 34,0 und 43,0 °C ein.');
      return;
    }
    if (!when) {
      setError('Datum als TT.MM.JJJJ und Uhrzeit als HH:MM.');
      return;
    }
    const entry: TemperatureEntry = {
      id: existing?.id ?? createId('temp'),
      childId: existing?.childId ?? activeChild.id,
      timestamp: when.toISOString(),
      celsius: value,
      method,
      note: note.trim(),
      isExample: existing?.isExample ?? false,
    };
    update((current) => saveTemperature(current, entry));
    onDone();
  }

  return (
    <Screen
      title={existing ? 'Messung ändern' : 'Temperatur'}
      onBack={onDone}
      footer={
        <>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button label="Speichern" onPress={save} />
          {existing ? <Button label="Löschen" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
        </>
      }
      dialog={
        <ConfirmDialog
          visible={confirmDelete}
          title="Messung löschen?"
          message="Die Temperatur wird aus dem Verlauf entfernt."
          confirmLabel="Wirklich löschen"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            if (!existing) return;
            update((current) => removeTemperature(current, existing.id));
            onDone();
          }}
        />
      }
    >
      <TextField label="Temperatur in °C" value={celsius} onChangeText={setCelsius} placeholder="38,2" keyboard="decimal-pad" />
      <Segmented
        label="Messart"
        value={method}
        options={MEASUREMENT_METHODS.map((item) => ({ value: item, label: METHOD_LABELS[item] }))}
        onChange={setMethod}
      />
      <DateTimeFields date={date} time={time} onChange={(nextDate, nextTime) => { setDate(nextDate); setTime(nextTime); }} />
      <TextField label="Notiz" value={note} onChangeText={setNote} placeholder="optional" />
      <Muted>Standard-Messart ist {METHOD_LABELS[data?.settings.defaultMethod ?? 'rektal']}. Das änderst du in den Einstellungen.</Muted>
    </Screen>
  );
}

