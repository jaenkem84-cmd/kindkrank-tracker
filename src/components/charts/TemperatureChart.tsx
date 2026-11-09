import { useState } from 'react';
import { Text, View } from 'react-native';
import { endOfBerlinDay, formatShortDay, formatTime, shiftBerlinDays, startOfBerlinDay } from '../../domain/dates';
import { formatDecimal } from '../../domain/format';
import { REFERENCE_LINES } from '../../domain/fever';
import type { DoseEntry, Medication, SymptomEntry, TemperatureEntry } from '../../domain/types';
import { useTheme } from '../../theme/ThemeProvider';
import { ChartFrame } from './ChartFrame';
import { ChoiceRow } from './ChoiceRow';

const MARKER_COLORS = ['#C4A15A', '#7BA3C9', '#C48B9A', '#8FB59A'];

export function TemperatureChart({
  entries,
  doses,
  medications,
  symptoms = [],
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
  now: Date;
  days: number;
  stepHours: number;
  onDays: (days: number) => void;
  onStep: (hours: number) => void;
}) {
  const theme = useTheme();
  const [showSymptoms, setShowSymptoms] = useState(true);
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
  const verticals: { x: number; strong: boolean }[] = [];
  const labels: { x: number; label: string }[] = [];
  for (let day = 0; day < days; day += 1) {
    const dayStart = startOfBerlinDay(shiftBerlinDays(now, -(days - 1) + day)).getTime();
    verticals.push({ x: dayStart, strong: true });
    labels.push({ x: dayStart + 12 * 3_600_000, label: formatShortDay(new Date(dayStart + 12 * 3_600_000)) });
    for (let hour = stepHours; hour < 24; hour += stepHours) {
      verticals.push({ x: dayStart + hour * 3_600_000, strong: false });
    }
  }
  const yTicks = [36, 37, 38, 39, 40, 41]
    .filter((value) => value > yMin + 0.15 && value < yMax - 0.15)
    .map((value) => ({ y: value, label: formatDecimal(value, 0) }));
  const medIndex = new Map(medications.map((med, index) => [med.id, index]));
  const markers = doses.filter((dose) => {
    const time = new Date(dose.timestamp).getTime();
    return time >= from && time <= to;
  });

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
        label="Symptome"
        value={showSymptoms ? 'an' : 'aus'}
        options={[
          { value: 'an', label: 'an' },
          { value: 'aus', label: 'aus' },
        ]}
        onChange={(value) => setShowSymptoms(value === 'an')}
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
          color: theme.dark ? 'rgba(232,196,154,0.55)' : 'rgba(138,90,22,0.45)',
          dashed: true,
          label: formatDecimal(line.celsius, line.celsius % 1 === 0 ? 0 : 1),
        }))}
        yUnit="°C"
        series={[
          {
            points: shown.map((entry) => ({ x: new Date(entry.timestamp).getTime(), y: entry.celsius })),
            color: theme.dark ? '#F4F0E8' : '#163A38',
            width: 1.6,
          },
        ]}
        points={shown.map((entry) => ({
          id: entry.id,
          x: new Date(entry.timestamp).getTime(),
          y: entry.celsius,
          label: `${formatShortDay(new Date(entry.timestamp))} ${formatTime(new Date(entry.timestamp))} · ${formatDecimal(entry.celsius, 1)} °C`,
          fill: theme.accent,
        }))}
      />
      {markers.length > 0 ? <DoseTicks markers={markers} medications={medications} medIndex={medIndex} from={from} to={to} /> : null}
      {showSymptoms ? <SymptomTicks symptoms={symptoms.filter((item) => {
        const time = new Date(item.timestamp).getTime();
        return time >= from && time <= to;
      })} from={from} to={to} /> : null}
      <Text style={{ color: theme.muted, fontSize: 12 }}>Mitternacht kräftig. Gestrichelt nur zur Orientierung.</Text>
    </View>
  );
}

function DoseTicks({
  markers,
  medications,
  medIndex,
  from,
  to,
}: {
  markers: DoseEntry[];
  medications: Medication[];
  medIndex: Map<string, number>;
  from: number;
  to: number;
}) {
  const theme = useTheme();
  const span = to - from || 1;
  const used = [...new Set(markers.map((dose) => dose.medicationId))];
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 14, marginLeft: 44, marginRight: 8, position: 'relative' }}>
        {markers.map((dose) => {
          const index = medIndex.get(dose.medicationId) ?? 0;
          const left = `${((new Date(dose.timestamp).getTime() - from) / span) * 100}%`;
          return (
            <View
              key={dose.id}
              style={{
                position: 'absolute',
                left,
                top: 2,
                width: 2,
                height: 10,
                backgroundColor: MARKER_COLORS[index % MARKER_COLORS.length],
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {used.map((id) => {
          const medication = medications.find((item) => item.id === id);
          const index = medIndex.get(id) ?? 0;
          return (
            <Text key={id} style={{ color: theme.muted, fontSize: 11 }}>
              <Text style={{ color: MARKER_COLORS[index % MARKER_COLORS.length] }}>┃ </Text>
              {medication?.name ?? 'Gabe'}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function SymptomTicks({ symptoms, from, to }: { symptoms: SymptomEntry[]; from: number; to: number }) {
  const theme = useTheme();
  if (symptoms.length === 0) return null;
  const span = to - from || 1;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ height: 10, marginLeft: 44, marginRight: 8, position: 'relative' }}>
        {symptoms.map((item) => (
          <View
            key={item.id}
            style={{
              position: 'absolute',
              left: `${((new Date(item.timestamp).getTime() - from) / span) * 100}%`,
              top: 2,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.dark ? '#E7C27A' : '#8A5A16',
            }}
          />
        ))}
      </View>
      <Text style={{ color: theme.muted, fontSize: 11 }}>Punkte: Symptome</Text>
    </View>
  );
}
