import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { endOfBerlinDay, formatDate, formatShortDay, formatTime, shiftBerlinDays, startOfBerlinDay } from '../../domain/dates';
import { formatDecimal } from '../../domain/format';
import { REFERENCE_LINES } from '../../domain/fever';
import { symptomIconName } from '../../domain/symptomIcons';
import type { CustomSymptom, DoseEntry, Medication, SymptomEntry, TemperatureEntry } from '../../domain/types';
import { useTheme } from '../../theme/ThemeProvider';
import { ChartFrame } from './ChartFrame';

const MARKER_COLORS = ['#E7C27A', '#7EB6E0', '#D7A0AE', '#9BC7A4'];
const TEMP_RED = '#FF5C6C';
const DAY_MS = 86_400_000;
const RANGES = [2, 5, 7, 14];

export function TemperatureChart({
  entries,
  doses,
  medications,
  symptoms = [],
  customSymptoms = [],
  selectedId = null,
  onSelectId,
  now,
  days,
  onDays,
}: {
  entries: TemperatureEntry[];
  doses: DoseEntry[];
  medications: Medication[];
  symptoms?: SymptomEntry[];
  customSymptoms?: CustomSymptom[];
  selectedId?: string | null;
  onSelectId?: (id: string) => void;
  now: Date;
  days: number;
  onDays: (days: number) => void;
}) {
  const theme = useTheme();
  const [showSymptoms, setShowSymptoms] = useState(true);
  const [gearOpen, setGearOpen] = useState(false);
  const [hiddenMeds, setHiddenMeds] = useState<string[]>(() =>
    medications.filter((med) => /husten|prospan/i.test(med.name)).map((med) => med.id),
  );
  const latest = useMemo(
    () => [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).at(-1) ?? null,
    [entries],
  );
  const latestDay = latest ? startOfBerlinDay(new Date(latest.timestamp)) : startOfBerlinDay(now);
  const [endDay, setEndDay] = useState(latestDay);
  const [shiftMs, setShiftMs] = useState(0);
  const widthRef = useRef(320);
  const endRef = useRef(endDay);
  endRef.current = endDay;
  const daysRef = useRef(days);
  daysRef.current = days;
  const capRef = useRef(0);

  useEffect(() => {
    setEndDay(latestDay);
    setShiftMs(0);
  }, [latest?.id]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        const span = daysRef.current * DAY_MS;
        setShiftMs((gesture.dx / Math.max(widthRef.current, 1)) * span);
      },
      onPanResponderRelease: (_, gesture) => {
        const span = daysRef.current * DAY_MS;
        const ms = (gesture.dx / Math.max(widthRef.current, 1)) * span;
        const next = endOfBerlinDay(endRef.current).getTime() + ms;
        const capped = Math.min(next, capRef.current);
        setEndDay(startOfBerlinDay(new Date(capped)));
        setShiftMs(0);
      },
    }),
  ).current;

  const cap = Math.max(endOfBerlinDay(now).getTime(), endOfBerlinDay(latestDay).getTime());
  capRef.current = cap;
  const end = new Date(Math.min(endOfBerlinDay(endDay).getTime() + shiftMs, cap));
  const start = new Date(end.getTime() - days * DAY_MS);
  const from = start.getTime();
  const to = end.getTime();
  const shown = entries
    .filter((entry) => {
      const time = new Date(entry.timestamp).getTime();
      return time >= from && time <= to;
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const ys = shown.map((entry) => entry.celsius);
  const yMin = Math.min(36, ...ys, 37.6) - 0.3;
  const yMax = Math.max(41, ...ys, 40) + 0.25;
  const verticals: { x: number; strong: boolean; label?: string }[] = [];
  const labels: { x: number; label: string }[] = [];
  let cursor = startOfBerlinDay(start);
  while (cursor.getTime() < to + DAY_MS && labels.length < days + 2) {
    const dayStart = cursor.getTime();
    if (dayStart + DAY_MS > from && dayStart < to) {
      verticals.push({ x: dayStart, strong: true });
      const noon = dayStart + 12 * 3_600_000;
      const margin = (to - from) * 0.12;
      if (noon > from + margin && noon < to - margin) {
        labels.push({ x: noon, label: formatShortDay(new Date(noon)) });
      }
      for (const hour of [6, 12, 18]) {
        const x = dayStart + hour * 3_600_000;
        if (x > from && x < to) {
          verticals.push({ x, strong: false, label: x > from + margin && x < to - margin ? `${hour}h` : undefined });
        }
      }
    }
    cursor = startOfBerlinDay(shiftBerlinDays(cursor, 1));
  }
  const yTicks = [36, 37, 38, 39, 40, 41]
    .filter((value) => value > yMin + 0.15 && value < yMax - 0.15)
    .map((value) => ({ y: value, label: formatDecimal(value, 0) }));
  const medIndex = new Map(medications.map((med, index) => [med.id, index]));
  const visibleMeds = medications.filter((med) => !hiddenMeds.includes(med.id));
  const markerY = yMin + (yMax - yMin) * 0.06;
  const markers = doses.filter((dose) => {
    const time = new Date(dose.timestamp).getTime();
    return time >= from && time <= to && visibleMeds.some((med) => med.id === dose.medicationId);
  });
  const symptomMarks = showSymptoms
    ? symptoms.filter((item) => {
        const time = new Date(item.timestamp).getTime();
        return time >= from && time <= to;
      })
    : [];
  const latestLabel = latest ? formatDate(new Date(latest.timestamp)).slice(0, 6) : '';

  return (
    <View style={{ gap: 8 }} onLayout={(event) => { widthRef.current = event.nativeEvent.layout.width; }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {RANGES.map((range) => {
          const selected = range === days;
          return (
            <Pressable
              key={range}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onDays(range)}
              style={{
                minHeight: 36,
                paddingHorizontal: 8,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? theme.accent : 'transparent',
                borderWidth: 1,
                borderColor: selected ? theme.accent : theme.border,
              }}
            >
              <Text style={{ color: selected ? theme.onAccent : theme.text, fontSize: 13, fontWeight: '700' }}>{range} Tage</Text>
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Diagramm einstellen"
          onPress={() => setGearOpen((open) => !open)}
          style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: theme.text, fontSize: 18 }}>⚙</Text>
        </Pressable>
      </View>
      {latest ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Letzte Messung ${latestLabel}`} onPress={() => { setEndDay(latestDay); setShiftMs(0); }}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>Letzte Messung: {latestLabel}</Text>
        </Pressable>
      ) : null}
      <View>
        <ChartFrame
          panHandlers={pan.panHandlers}
          xDomain={[from, to]}
          yDomain={[yMin, yMax]}
          yTicks={yTicks}
          xLabels={labels}
          verticals={verticals}
          horizontals={REFERENCE_LINES.map((line) => ({
            y: line.celsius,
            color: theme.dark ? 'rgba(186,194,204,0.40)' : 'rgba(90,98,110,0.35)',
            dashed: true,
            label: '',
          }))}
          yUnit="°C"
          selectedId={selectedId}
          onSelectId={onSelectId}
          series={[
            {
              points: shown.map((entry) => ({ x: new Date(entry.timestamp).getTime(), y: entry.celsius })),
              color: TEMP_RED,
              width: 1.8,
            },
          ]}
          points={[
            ...markers.map((dose) => ({
              x: new Date(dose.timestamp).getTime(),
              y: markerY,
              label: '',
              fill: MARKER_COLORS[(medIndex.get(dose.medicationId) ?? 0) % MARKER_COLORS.length],
              r: 3.5,
              opacity: 0.4,
              hit: false as const,
            })),
            ...symptomMarks.map((item) => {
              const icon = symptomMarks.length <= 8 ? symptomIconName(item.symptomId, customSymptoms) : null;
              return {
                x: new Date(item.timestamp).getTime(),
                y: markerY + (yMax - yMin) * 0.08,
                label: '',
                fill: theme.dark ? '#E7C27A' : '#8A5A16',
                r: 2.5,
                opacity: icon ? 1 : 0.55,
                hit: false as const,
                icon: icon ?? undefined,
              };
            }),
            ...shown.map((entry) => ({
              id: entry.id,
              x: new Date(entry.timestamp).getTime(),
              y: entry.celsius,
              label: `${formatShortDay(new Date(entry.timestamp))} ${formatTime(new Date(entry.timestamp))} · ${formatDecimal(entry.celsius, 1)} °C`,
              fill: TEMP_RED,
              r: 3,
            })),
          ]}
        />
      </View>
      {visibleMeds.length > 0 || showSymptoms ? (
        <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 15 }} numberOfLines={2}>
          {visibleMeds.map((med) => med.name.replace(' (Beispiel)', '')).join(' · ')}
          {showSymptoms ? `${visibleMeds.length ? ' · ' : ''}Symptome` : ''}
        </Text>
      ) : null}
      {gearOpen ? (
        <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, gap: 8, backgroundColor: theme.card }}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Im Diagramm</Text>
          {medications.map((med) => {
            const on = !hiddenMeds.includes(med.id);
            return (
              <Text
                key={med.id}
                onPress={() => setHiddenMeds(on ? [...hiddenMeds, med.id] : hiddenMeds.filter((id) => id !== med.id))}
                style={{ color: theme.text, fontSize: 15, lineHeight: 22, paddingVertical: 4 }}
              >
                {on ? '☑' : '☐'} {med.name}
              </Text>
            );
          })}
          <Text onPress={() => setShowSymptoms(!showSymptoms)} style={{ color: theme.text, fontSize: 15, lineHeight: 22, paddingVertical: 4 }}>
            {showSymptoms ? '☑' : '☐'} Symptome
          </Text>
        </View>
      ) : null}
    </View>
  );
}
