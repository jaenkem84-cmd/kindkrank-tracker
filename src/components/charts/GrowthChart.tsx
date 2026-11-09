import { Text, View } from 'react-native';
import { ageMonths, formatDate } from '../../domain/dates';
import { formatDecimal } from '../../domain/format';
import type { GrowthEntry, Sex } from '../../domain/types';
import { PERCENTILES, nearestPercentile, percentileCurve, type GrowthMetric } from '../../domain/who/who';
import { useTheme } from '../../theme/ThemeProvider';
import { ChartFrame } from './ChartFrame';
import { ChoiceRow } from './ChoiceRow';

const UNIT: Record<GrowthMetric, string> = { weight: 'kg', height: 'cm', head: 'cm' };
const FIELD: Record<GrowthMetric, 'weightKg' | 'heightCm' | 'headCm'> = {
  weight: 'weightKg',
  height: 'heightCm',
  head: 'headCm',
};

export function GrowthChart({
  metric,
  sex,
  birthDate,
  entries,
  months,
  labelEvery,
  onMonths,
  onLabelEvery,
  selectedId = null,
  onSelectId,
}: {
  metric: GrowthMetric;
  sex: Sex | null;
  birthDate: string;
  entries: GrowthEntry[];
  months: number;
  labelEvery: number;
  onMonths: (months: number) => void;
  onLabelEvery: (months: number) => void;
  selectedId?: string | null;
  onSelectId?: (id: string) => void;
}) {
  const theme = useTheme();
  const field = FIELD[metric];
  const unit = UNIT[metric];
  const measured = entries
    .filter((entry) => entry[field] !== undefined)
    .map((entry) => ({
      id: entry.id,
      month: ageMonths(birthDate, new Date(entry.timestamp)),
      value: entry[field] as number,
      label: `${formatDate(new Date(entry.timestamp))} · ${formatDecimal(entry[field] as number, metric === 'weight' ? 2 : 1)} ${unit}${
        sex ? ` · nahe ${nearestPercentile(metric, sex, ageMonths(birthDate, new Date(entry.timestamp)), entry[field] as number) ?? '–'}` : ''
      }`,
    }))
    .filter((point) => point.month >= 0 && point.month <= months)
    .sort((a, b) => a.month - b.month);
  const bands = sex ? percentileCurve(metric, sex, 0, months, 0.5) : [];
  const bandValues = bands.flatMap((point) => Object.values(point.values));
  const measuredValues = measured.map((point) => point.value);
  const yMin = Math.min(...bandValues, ...measuredValues);
  const yMax = Math.max(...bandValues, ...measuredValues);
  const pad = (yMax - yMin) * 0.08 || 1;
  const verticals = [];
  const labels = [];
  for (let month = 0; month <= months; month += 1) {
    verticals.push({ x: month, strong: month % 12 === 0 });
    if (month % labelEvery === 0) {
      const label = month === 0 ? '0' : month % 12 === 0 ? `${month / 12} J.` : `${month}`;
      labels.push({ x: month, label });
    }
  }
  const yStep = metric === 'weight' ? 2 : 5;
  const yTicks = [];
  const yStart = Math.ceil((yMin - pad) / yStep) * yStep;
  for (let value = yStart; value < yMax + pad; value += yStep) {
    yTicks.push({ y: value, label: formatDecimal(value, 0) });
  }
  const percentileSeries = PERCENTILES.map((band) => ({
    points: bands
      .filter((point) => point.values[band.id] !== undefined)
      .map((point) => ({ x: point.month, y: point.values[band.id] as number })),
    color: theme.dark ? 'rgba(186,194,204,0.55)' : 'rgba(90,98,110,0.45)',
    width: band.id === 'P50' ? 1.2 : 0.9,
  }));

  return (
    <View style={{ gap: 8 }}>
      <ChoiceRow
        label="Alter"
        value={String(months)}
        options={[
          { value: '12', label: '1 Jahr' },
          { value: '24', label: '2 Jahre' },
          { value: '60', label: '5 Jahre' },
        ]}
        onChange={(value) => onMonths(Number(value))}
      />
      <ChoiceRow
        label="Achse"
        value={String(labelEvery)}
        options={[
          { value: '2', label: '2 Mon.' },
          { value: '4', label: '4 Mon.' },
          { value: '6', label: '6 Mon.' },
        ]}
        onChange={(value) => onLabelEvery(Number(value))}
      />
      {Number.isFinite(yMin) ? (
        <ChartFrame
          height={320}
          xDomain={[0, months]}
          yDomain={[yMin - pad, yMax + pad]}
          yTicks={yTicks}
          xLabels={labels}
          verticals={verticals}
          horizontals={[]}
          yUnit={unit}
          selectedId={selectedId}
          onSelectId={onSelectId}
          endLabels={PERCENTILES.flatMap((band) => {
            const last = bands[bands.length - 1];
            const y = last?.values[band.id];
            return y === undefined ? [] : [{ y, text: band.id }];
          })}
          series={[
            ...percentileSeries,
            {
              points: measured.map((point) => ({ x: point.month, y: point.value })),
              color: '#3DB8B0',
              width: 2.1,
            },
          ]}
          points={measured.map((point) => ({
            id: point.id,
            x: point.month,
            y: point.value,
            label: point.label,
            fill: '#3DB8B0',
          }))}
        />
      ) : null}
      <Text style={{ color: theme.muted, fontSize: 12 }}>
        Alter in Monaten. {sex ? 'Kurven: WHO-Perzentile.' : 'Geschlecht im Profil fehlt, deshalb keine Perzentile.'}
      </Text>
    </View>
  );
}
