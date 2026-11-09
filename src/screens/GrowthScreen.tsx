import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TrendChart } from '../components/charts';
import { Banner, Body, Button, Card, ConfirmDialog, DateTimeFields, Muted, Screen, TextField } from '../components/ui';
import { ageMonths, combineBerlin, dateFieldValue, formatDateTime, timeFieldValue } from '../domain/dates';
import { formatDecimal, parseDecimal } from '../domain/format';
import { createId } from '../domain/ids';
import { forChild } from '../domain/select';
import type { GrowthEntry } from '../domain/types';
import { removeGrowth, saveGrowth } from '../data/mutations';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

function formatAge(months: number): string {
  if (months < 24) return `${Math.round(months)} Mon.`;
  const years = Math.floor(months / 12);
  const rest = Math.round(months % 12);
  return rest ? `${years} J. ${rest} M.` : `${years} J.`;
}

export function GrowthScreen({ onEdit }: { onEdit: (id: string) => void }) {
  const theme = useTheme();
  const { data, activeChild } = useStore();
  if (!data || !activeChild) return <Body>Lege zuerst ein Kind an.</Body>;
  const entries = forChild(data.growth, activeChild.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const series = (pick: (entry: GrowthEntry) => number | undefined) =>
    entries
      .filter((entry) => pick(entry) !== undefined)
      .map((entry) => ({ x: ageMonths(activeChild.birthDate, new Date(entry.timestamp)), y: pick(entry) as number }));

  return (
    <View style={{ gap: 14 }}>
      <Muted>Eigene Messwerte über das Alter. Keine Perzentilkurve und keine Bewertung.</Muted>
      <ChartCard title="Gewicht" unit="kg" points={series((entry) => entry.weightKg)} />
      <ChartCard title="Größe" unit="cm" points={series((entry) => entry.heightCm)} />
      <ChartCard title="Kopfumfang" unit="cm" points={series((entry) => entry.headCm)} />
      {[...entries].reverse().map((entry) => (
        <Pressable key={entry.id} accessibilityRole="button" onPress={() => onEdit(entry.id)}>
          <Card>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
              {formatDateTime(new Date(entry.timestamp))}
            </Text>
            <Body>
              {[
                entry.weightKg !== undefined ? `${formatDecimal(entry.weightKg, 1)} kg` : null,
                entry.heightCm !== undefined ? `${formatDecimal(entry.heightCm, 1)} cm Größe` : null,
                entry.headCm !== undefined ? `${formatDecimal(entry.headCm, 1)} cm Kopf` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Body>
            {entry.isExample ? <Muted>Beispieldaten</Muted> : null}
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

function ChartCard({ title, unit, points }: { title: string; unit: string; points: { x: number; y: number }[] }) {
  return (
    <Card>
      <Body>{title}</Body>
      {points.length === 0 ? (
        <Muted>Noch keine Werte.</Muted>
      ) : (
        <TrendChart points={points} formatX={formatAge} formatY={(value) => `${formatDecimal(value, 1)} ${unit}`} />
      )}
    </Card>
  );
}

export function GrowthForm({ entryId, onDone }: { entryId?: string; onDone: () => void }) {
  const { data, activeChild, update } = useStore();
  const existing = data?.growth.find((entry) => entry.id === entryId);
  const initial = existing ? new Date(existing.timestamp) : new Date();
  const [weight, setWeight] = useState(existing?.weightKg !== undefined ? String(existing.weightKg).replace('.', ',') : '');
  const [height, setHeight] = useState(existing?.heightCm !== undefined ? String(existing.heightCm).replace('.', ',') : '');
  const [head, setHead] = useState(existing?.headCm !== undefined ? String(existing.headCm).replace('.', ',') : '');
  const [date, setDate] = useState(dateFieldValue(initial));
  const [time, setTime] = useState(timeFieldValue(initial));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function optional(raw: string, min: number, max: number, label: string): number | undefined | 'invalid' {
    if (!raw.trim()) return undefined;
    const value = parseDecimal(raw);
    if (value === null || value < min || value > max) {
      setError(`${label}: Zahl zwischen ${String(min).replace('.', ',')} und ${String(max).replace('.', ',')}.`);
      return 'invalid';
    }
    return value;
  }

  function save() {
    if (!data || !activeChild) return;
    const weightKg = optional(weight, 0.5, 80, 'Gewicht in kg');
    if (weightKg === 'invalid') return;
    const heightCm = optional(height, 30, 220, 'Größe in cm');
    if (heightCm === 'invalid') return;
    const headCm = optional(head, 20, 70, 'Kopfumfang in cm');
    if (headCm === 'invalid') return;
    const when = combineBerlin(date, time);
    if (!when) {
      setError('Datum als TT.MM.JJJJ und Uhrzeit als HH:MM.');
      return;
    }
    if (weightKg === undefined && heightCm === undefined && headCm === undefined) {
      setError('Trag mindestens Gewicht, Größe oder Kopfumfang ein.');
      return;
    }
    const entry: GrowthEntry = {
      id: existing?.id ?? createId('wuchs'),
      childId: existing?.childId ?? activeChild.id,
      timestamp: when.toISOString(),
      isExample: existing?.isExample ?? false,
    };
    if (weightKg !== undefined) entry.weightKg = weightKg;
    if (heightCm !== undefined) entry.heightCm = heightCm;
    if (headCm !== undefined) entry.headCm = headCm;
    update((current) => saveGrowth(current, entry));
    onDone();
  }

  return (
    <Screen
      title={existing ? 'Messung ändern' : 'Gewicht und Wachstum'}
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
          message="Der Wachstumseintrag wird entfernt."
          confirmLabel="Wirklich löschen"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            if (!existing) return;
            update((current) => removeGrowth(current, existing.id));
            onDone();
          }}
        />
      }
    >
      <Muted>Gewicht ist während einer Krankheit oft das Wichtigste, zum Beispiel bei starkem Gewichtsverlust.</Muted>
      <TextField label="Gewicht in kg" value={weight} onChangeText={setWeight} placeholder="9,6" keyboard="decimal-pad" />
      <TextField label="Größe in cm" value={height} onChangeText={setHeight} placeholder="optional" keyboard="decimal-pad" />
      <TextField label="Kopfumfang in cm" value={head} onChangeText={setHead} placeholder="optional" keyboard="decimal-pad" />
      <DateTimeFields date={date} time={time} onChange={(nextDate, nextTime) => { setDate(nextDate); setTime(nextTime); }} />
    </Screen>
  );
}
