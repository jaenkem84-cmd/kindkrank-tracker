import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TrendChart } from '../components/charts';
import { Banner, Body, Button, Card, ConfirmDialog, DateTimeFields, Muted, Screen, Segmented, TextField } from '../components/ui';
import { combineBerlin, dateFieldValue, formatDateTime, timeFieldValue } from '../domain/dates';
import { REFERENCE_LINES, temperatureBand } from '../domain/fever';
import { formatCelsius, formatDecimal, parseDecimal } from '../domain/format';
import { createId } from '../domain/ids';
import { temperaturesForChart } from '../domain/illness';
import { forChild } from '../domain/select';
import { MEASUREMENT_METHODS, METHOD_LABELS, type MeasurementMethod, type TemperatureEntry } from '../domain/types';
import { removeTemperature, saveTemperature } from '../data/mutations';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { guideColors, type Theme } from '../theme/theme';

const guidePalette: Record<(typeof REFERENCE_LINES)[number]['id'], string> = {
  raised: guideColors.raised,
  fever: guideColors.fever,
  high: guideColors.high,
  care: guideColors.care,
};

function pointColor(celsius: number, theme: Theme): string {
  const band = temperatureBand(celsius).id;
  if (band === 'below') return theme.chart;
  return guidePalette[band];
}

export function TemperatureScreen({ now, onEdit }: { now: Date; onEdit: (id: string) => void }) {
  const theme = useTheme();
  const { data, activeChild } = useStore();
  if (!data || !activeChild) return <Body>Lege zuerst ein Kind an.</Body>;
  const own = forChild(data.temperatures, activeChild.id);
  const weeks = data.settings.chartWindowWeeks;
  const chart = temperaturesForChart(own, now, weeks);
  const points = chart.map((entry) => ({ x: new Date(entry.timestamp).getTime(), y: entry.celsius }));
  const listed = [...own].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <View style={{ gap: 14 }}>
      <Muted>
        Diagramm: aktuelle Krankheitsphase, höchstens die letzten {weeks} {weeks === 1 ? 'Woche' : 'Wochen'}. Eine Pause
        von mehr als 48 Stunden beginnt eine neue Phase. Den Zeitraum stellst du unter Mehr ein.
      </Muted>
      <Card>
        {points.length === 0 ? (
          <Body>In diesem Zeitraum gibt es noch keine Messung.</Body>
        ) : (
          <TrendChart
            points={points}
            domain={{ min: 36.8, max: 40.7 }}
            guides={REFERENCE_LINES.map((line) => ({
              y: line.celsius,
              color: guidePalette[line.id],
              label: line.label,
            }))}
            formatX={(x) => {
              const text = formatDateTime(new Date(x));
              return `${text.slice(0, 5)} ${text.slice(11)}`;
            }}
            formatY={(y) => formatDecimal(y, y % 1 === 0 ? 0 : 1)}
            colorForY={(y) => pointColor(y, theme)}
          />
        )}
        <View style={{ gap: 4 }}>
          {REFERENCE_LINES.map((line) => (
            <Text key={line.id} style={{ color: guidePalette[line.id], fontSize: 14 }}>
              {formatDecimal(line.celsius, line.celsius % 1 === 0 ? 0 : 1)} {line.label}
            </Text>
          ))}
          <Muted>Nur Orientierung, keine Diagnose.</Muted>
        </View>
      </Card>
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
      <Muted>Standard ist {METHOD_LABELS[data?.settings.defaultMethod ?? 'rektal']}. Das änderst du unter Mehr.</Muted>
    </Screen>
  );
}

