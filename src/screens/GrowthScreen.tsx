import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GrowthChart } from '../components/charts/GrowthChart';
import { Banner, Body, Button, Card, ConfirmDialog, DateTimeFields, Muted, Screen, TextField } from '../components/ui';
import { combineBerlin, dateFieldValue, formatDateTime, timeFieldValue } from '../domain/dates';
import { formatDecimal, parseDecimal } from '../domain/format';
import { createId } from '../domain/ids';
import { forChild } from '../domain/select';
import type { GrowthEntry } from '../domain/types';
import { removeGrowth, saveGrowth } from '../data/mutations';
import { useStore } from '../state/store';
import type { GrowthMetric } from '../domain/who/who';
import { useTheme } from '../theme/ThemeProvider';

const TITLES: Record<GrowthMetric, string> = { weight: 'Gewicht', height: 'Größe', head: 'Kopfumfang' };

export function GrowthScreen({
  metric,
  onEdit,
  onAdd,
}: {
  metric: GrowthMetric;
  onEdit: (id: string) => void;
  onAdd: () => void;
}) {
  const theme = useTheme();
  const [months, setMonths] = useState(24);
  const [labelEvery, setLabelEvery] = useState(4);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scroller = useRef<{ scrollTo: (options: { y: number; animated?: boolean }) => void } | null>(null);
  const rowY = useRef<Record<string, number>>({});
  const { data, activeChild } = useStore();
  useEffect(() => {
    if (!selectedId) return;
    const y = rowY.current[selectedId];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, [selectedId]);
  if (!data || !activeChild) return <Body>Lege zuerst ein Kind an.</Body>;
  const entries = forChild(data.growth, activeChild.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const field = metric === 'weight' ? 'weightKg' : metric === 'height' ? 'heightCm' : 'headCm';
  const listed = [...entries].reverse().filter((entry) => entry[field] !== undefined);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Button label={`${TITLES[metric]} eintragen`} onPress={onAdd} />
        <Card>
          <GrowthChart
            metric={metric}
            sex={activeChild.sex}
            birthDate={activeChild.birthDate}
            entries={entries}
            months={months}
            labelEvery={labelEvery}
            onMonths={setMonths}
            onLabelEvery={setLabelEvery}
            selectedId={selectedId}
            onSelectId={setSelectedId}
          />
        </Card>
      </View>
      <ScrollView
        ref={(node) => {
          scroller.current = node;
        }}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 28 }}
      >
      {listed.map((entry) => (
        <Pressable
          key={entry.id}
          accessibilityRole="button"
          onLayout={(event) => {
            rowY.current[entry.id] = event.nativeEvent.layout.y;
          }}
          onPress={() => setSelectedId(entry.id)}
        >
          <Card>
            <Text style={{ color: entry.id === selectedId ? '#3DB8B0' : theme.text, fontSize: 18, fontWeight: '700' }}>
              {formatDateTime(new Date(entry.timestamp))}
            </Text>
            <Body>
              {[
                entry.weightKg !== undefined ? `${formatDecimal(entry.weightKg, 2)} kg` : null,
                entry.heightCm !== undefined ? `${formatDecimal(entry.heightCm, 1)} cm Größe` : null,
                entry.headCm !== undefined ? `${formatDecimal(entry.headCm, 1)} cm Kopf` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Body>
            {entry.isExample ? <Muted>Beispieldaten</Muted> : null}
            <Button compact label="Ändern" variant="secondary" onPress={() => onEdit(entry.id)} />
          </Card>
        </Pressable>
      ))}
      </ScrollView>
    </View>
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
