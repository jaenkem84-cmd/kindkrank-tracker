import { useState } from 'react';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { TemperatureChart } from '../components/charts/TemperatureChart';
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
  const [days, setDays] = useState(2);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scroller = useRef<{ scrollTo: (options: { y: number; animated?: boolean }) => void } | null>(null);
  const rowY = useRef<Record<string, number>>({});
  const { data, activeChild } = useStore();
  useEffect(() => {
    if (!selectedId) return;
    const y = rowY.current[selectedId];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, [selectedId]);
  if (!data || !activeChild) return <Body>Lege zuerst eine Person an.</Body>;
  const own = forChild(data.temperatures, activeChild.id);
  const listed = [...own].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
        <Button label="Temperatur eintragen" onPress={onAdd} />
        <Card>
          <TemperatureChart
            entries={own}
            doses={forChild(data.doses, activeChild.id)}
            medications={forChild(data.medications, activeChild.id)}
            symptoms={forChild(data.symptoms, activeChild.id)}
            customSymptoms={data.customSymptoms ?? []}
            selectedId={selectedId}
            onSelectId={setSelectedId}
            now={now}
            days={days}
            onDays={setDays}
          />
        </Card>
      </View>
      <ScrollView
        ref={(node) => {
          scroller.current = node;
        }}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {listed.map((entry) => {
          const selected = entry.id === selectedId;
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              onLayout={(event) => {
                rowY.current[entry.id] = event.nativeEvent.layout.y;
              }}
              onPress={() => setSelectedId(entry.id)}
            >
              <Card>
                <Text style={{ color: selected ? TEMP_RED : theme.text, fontSize: 22, fontWeight: '700' }}>{formatCelsius(entry.celsius)}</Text>
                <Body>
                  {formatDateTime(new Date(entry.timestamp))} · {METHOD_LABELS[entry.method]}
                </Body>
                {entry.note ? <Muted>{entry.note}</Muted> : null}
                {entry.isExample ? <Muted>Beispieldaten</Muted> : null}
                <Button compact label="Ändern" variant="secondary" onPress={() => onEdit(entry.id)} />
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const TEMP_RED = '#FF5C6C';

export function TemperatureForm({ entryId, onDone }: { entryId?: string; onDone: () => void }) {
  const { data, activeChild, update } = useStore();
  const existing = data?.temperatures.find((entry) => entry.id === entryId);
  const initial = existing ? new Date(existing.timestamp) : new Date();
  const [celsius, setCelsius] = useState(existing ? String(existing.celsius).replace('.', ',') : '');
  const [method, setMethod] = useState<MeasurementMethod>(
    existing?.method ?? activeChild?.defaultMethod ?? data?.settings.defaultMethod ?? 'rektal',
  );
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

