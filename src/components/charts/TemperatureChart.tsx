import { useState } from 'react';
import { Text, View } from 'react-native';
import { endOfBerlinDay, formatShortDay, formatTime, shiftBerlinDays, startOfBerlinDay } from '../../domain/dates';
import { formatDecimal } from '../../domain/format';
import { REFERENCE_LINES } from '../../domain/fever';
import type { DoseEntry, Medication, SymptomEntry, TemperatureEntry } from '../../domain/types';
import { useTheme } from '../../theme/ThemeProvider';
import { ChartFrame } from './ChartFrame';
import { ChoiceRow } from './ChoiceRow';

const MARKER_COLORS = ['#E7C27A', '#7EB6E0', '#D7A0AE', '#9BC7A4'];
const TEMP_RED = '#FF5C6C';

export function TemperatureChart({
  entries,
  doses,
  medications,
  symptoms = [],
  selectedId = null,
  onSelectId,
  now,
  days,
  stepHours,
  onDays,
  onStep,
}: {
  entries: TemperatureEntry[];
  doses: DoseEntry[];
  medications: Medication[];
  symptoms?: SymptomEntry[];
  selectedId?: string | null;
  onSelectId?: (id: string) => void;
  now: Date;
  days: number;
  stepHours: number;
  onDays: (days: number) => void;
  onStep: (hours: number) => void;
}) {
  const theme = useTheme();
  const [showSymptoms, setShowSymptoms] = useState(true);
  const [gearOpen, setGearOpen] = useState(false);
  const [hiddenMeds, setHiddenMeds] = useState<string[]>(() =>
    medications.filter((med) => /husten|prospan/i.test(med.name)).map((med) => med.id),
  );
  const end = endOfBerlinDay(now);
  const start = startOfBerlinDay(shiftBerlinDays(now, -(days - 1)));
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
  for (let day = 0; day < days; day += 1) {
    const dayStart = startOfBerlinDay(shiftBerlinDays(now, -(days - 1) + day)).getTime();
    verticals.push({ x: dayStart, strong: true });
    labels.push({ x: dayStart + 12 * 3_600_000, label: formatShortDay(new Date(dayStart + 12 * 3_600_000)) });
    for (let hour = stepHours; hour < 24; hour += stepHours) {
      verticals.push({
        x: dayStart + hour * 3_600_000,
        strong: false,
        label: hour % 6 === 0 ? `${hour}h` : undefined,
      });
    }
  }
  const yTicks = [36, 37, 38, 39, 40, 41]
    .filter((value) => value > yMin + 0.15 && value < yMax - 0.15)
    .map((value) => ({ y: value, label: formatDecimal(value, 0) }));
  const medIndex = new Map(medications.map((med, index) => [med.id, index]));
  const visibleMeds = medications.filter((med) => !hiddenMeds.includes(med.id));
  const markerY = yMin + (yMax - yMin) * 0.045;
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

  return (
    <View style={{ gap: 8 }}>
      <ChoiceRow
        label="Zeitraum"
        value={String(days)}
        options={[
          { value: '5', label: '5 Tage' },
          { value: '7', label: '7 Tage' },
          { value: '14', label: '14 Tage' },
        ]}
        onChange={(value) => onDays(Number(value))}
      />
      <ChoiceRow
        label="Raster"
        value={String(stepHours)}
        options={[
          { value: '3', label: '3 h' },
          { value: '6', label: '6 h' },
          { value: '12', label: '12 h' },
        ]}
        onChange={(value) => onStep(Number(value))}
      />
      <ChartFrame
        xDomain={[from, to]}
        yDomain={[yMin, yMax]}
        yTicks={yTicks}
        xLabels={labels}
        verticals={verticals}
        horizontals={REFERENCE_LINES.map((line) => ({
          y: line.celsius,
          color: theme.dark ? 'rgba(186,194,204,0.40)' : 'rgba(90,98,110,0.35)',
          dashed: true,
          label: formatDecimal(line.celsius, line.celsius % 1 === 0 ? 0 : 1),
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
            opacity: 0.55,
            hit: false as const,
          })),
          ...symptomMarks.map((item) => ({
            x: new Date(item.timestamp).getTime(),
            y: markerY + (yMax - yMin) * 0.035,
            label: '',
            fill: theme.dark ? '#E7C27A' : '#8A5A16',
            r: 2.5,
            opacity: 0.7,
            hit: false as const,
          })),
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 }}>
          {visibleMeds.map((med) => (
            <Text key={med.id} style={{ color: theme.muted, fontSize: 11 }}>
              <Text style={{ color: MARKER_COLORS[(medIndex.get(med.id) ?? 0) % MARKER_COLORS.length] }}>● </Text>
              {med.name.replace(' (Beispiel)', '')}
            </Text>
          ))}
          {showSymptoms ? <Text style={{ color: theme.muted, fontSize: 11 }}>● Symptome</Text> : null}
        </View>
        <Text accessibilityRole="button" accessibilityLabel="Diagramm einstellen" onPress={() => setGearOpen(true)} style={{ color: theme.text, fontSize: 18, padding: 6 }}>
          ⚙
        </Text>
      </View>
      {gearOpen ? (
        <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, gap: 8, backgroundColor: theme.card }}>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Im Diagramm</Text>
          {medications.map((med) => {
            const on = !hiddenMeds.includes(med.id);
            return (
              <Text key={med.id} onPress={() => setHiddenMeds(on ? [...hiddenMeds, med.id] : hiddenMeds.filter((id) => id !== med.id))} style={{ color: theme.text, fontSize: 15, paddingVertical: 4 }}>
                {on ? '☑' : '☐'} {med.name}
              </Text>
            );
          })}
          <Text onPress={() => setShowSymptoms(!showSymptoms)} style={{ color: theme.text, fontSize: 15, paddingVertical: 4 }}>
            {showSymptoms ? '☑' : '☐'} Symptome
          </Text>
          <Text onPress={() => setGearOpen(false)} style={{ color: theme.accent, fontWeight: '700', paddingTop: 4 }}>Schließen</Text>
        </View>
      ) : null}
    </View>
  );
}
