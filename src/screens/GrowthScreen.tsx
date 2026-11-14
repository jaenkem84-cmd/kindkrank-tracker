import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GrowthChart } from '../components/charts/GrowthChart';
import { Banner, Body, Button, Card, ConfirmDialog, DateTimeFields, Screen, TextField } from '../components/ui';
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
  const { data, activeChild } = useStore();
  const adult = activeChild?.personType === 'erwachsen';
  const [months, setMonths] = useState(adult ? 60 : 24);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scroller = useRef<{ scrollTo: (options: { y: number; animated?: boolean }) => void } | null>(null);
  const rowY = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!selectedId) return;
    const y = rowY.current[selectedId];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, [selectedId]);
  if (!data || !activeChild) return <Body>Lege zuerst eine Person an.</Body>;
  if (adult && metric === 'head') return <Body>Kopfumfang gibt es nur für Kinder.</Body>;
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
            onMonths={setMonths}
            selectedId={selectedId}
            onSelectId={setSelectedId}
            showReference={!adult}
          />
        </Card>
      </View>
      <ScrollView
        ref={(node) => {
          scroller.current = node;
        }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 8, paddingBottom: 28 }}
      >
      {listed.map((entry) => {
        const selected = entry.id === selectedId;
        const value = metric === 'weight'
          ? `${formatDecimal(entry.weightKg ?? 0, 2)} kg`
          : metric === 'height'
            ? `${formatDecimal(entry.heightCm ?? 0, 1)} cm`
            : `${formatDecimal(entry.headCm ?? 0, 1)} cm`;
        return (
          <View
            key={entry.id}
            onLayout={(event) => {
              rowY.current[entry.id] = event.nativeEvent.layout.y;
            }}
            style={{
              minHeight: 52,
              borderRadius: 12,
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? '#3DB8B0' : theme.border,
              backgroundColor: theme.card,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Pressable accessibilityRole="button" onPress={() => setSelectedId(entry.id)} style={{ flex: 1, paddingLeft: 12, paddingVertical: 6, justifyContent: 'center' }}>
              <Text style={{ color: selected ? '#3DB8B0' : theme.text, fontSize: 16, lineHeight: 20, fontWeight: '700' }} numberOfLines={1}>
                {value}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
                {formatDateTime(new Date(entry.timestamp))}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Ändern" onPress={() => onEdit(entry.id)} style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: theme.muted, fontSize: 22, lineHeight: 24 }}>›</Text>
            </Pressable>
          </View>
        );
      })}
      </ScrollView>
    </View>
  );
}

export function GrowthForm({ entryId, metric = 'weight', onDone }: { entryId?: string; metric?: GrowthMetric; onDone: () => void }) {
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
    const adult = activeChild.personType === 'erwachsen';
    const when = combineBerlin(date, time);
    if (!when) {
      setError('Datum als TT.MM.JJJJ und Uhrzeit als HH:MM.');
      return;
    }
    const entry: GrowthEntry = {
      id: existing?.id ?? createId('wuchs'),
      childId: existing?.childId ?? activeChild.id,
      timestamp: when.toISOString(),
      isExample: existing?.isExample ?? false,
    };
    if (metric === 'weight') {
      const weightKg = optional(weight, adult ? 20 : 0.5, adult ? 250 : 80, 'Gewicht in kg');
      if (weightKg === 'invalid' || weightKg === undefined) {
        if (weightKg !== 'invalid') setError('Trag das Gewicht ein.');
        return;
      }
      entry.weightKg = weightKg;
    } else if (metric === 'height') {
      const heightCm = optional(height, 30, 230, 'Größe in cm');
      if (heightCm === 'invalid' || heightCm === undefined) {
        if (heightCm !== 'invalid') setError('Trag die Größe ein.');
        return;
      }
      entry.heightCm = heightCm;
    } else {
      const headCm = optional(head, 20, 70, 'Kopfumfang in cm');
      if (headCm === 'invalid' || headCm === undefined) {
        if (headCm !== 'invalid') setError('Trag den Kopfumfang ein.');
        return;
      }
      entry.headCm = headCm;
    }
    update((current) => saveGrowth(current, entry));
    onDone();
  }

  return (
    <Screen
      title={existing ? `${TITLES[metric]} ändern` : TITLES[metric]}
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
      {metric === 'weight' ? <TextField label="Gewicht in kg" value={weight} onChangeText={setWeight} placeholder={activeChild?.personType === 'erwachsen' ? '82,4' : '9,6'} keyboard="decimal-pad" /> : null}
      {metric === 'height' ? <TextField label="Größe in cm" value={height} onChangeText={setHeight} placeholder="72" keyboard="decimal-pad" /> : null}
      {metric === 'head' ? <TextField label="Kopfumfang in cm" value={head} onChangeText={setHead} placeholder="45" keyboard="decimal-pad" /> : null}
      <DateTimeFields date={date} time={time} onChange={(nextDate, nextTime) => { setDate(nextDate); setTime(nextTime); }} />
    </Screen>
  );
}
