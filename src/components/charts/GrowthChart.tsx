import { Text, View } from 'react-native';
import { ageMonths, formatDate, formatDateTime } from '../../domain/dates';
import { formatDecimal } from '../../domain/format';
import type { GrowthEntry, Sex } from '../../domain/types';
import { growthAxis } from '../../domain/growthAxis';
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
  onMonths,
  selectedId = null,
  onSelectId,
  showReference = true,
}: {
  metric: GrowthMetric;
  sex: Sex | null;
  birthDate: string;
  entries: GrowthEntry[];
  months: number;
  onMonths: (months: number) => void;
  selectedId?: string | null;
  onSelectId?: (id: string) => void;
  /** WHO percentiles. Adults use a plain curve. */
  showReference?: boolean;
}) {
  const theme = useTheme();
  if (!showReference) {
    return (
      <PlainGrowthChart
        metric={metric}
        entries={entries}
        months={months}
        onMonths={onMonths}
        selectedId={selectedId}
        onSelectId={onSelectId}
      />
    );
  }
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
  const marks = growthAxis(months);
  const verticals = marks.map((mark) => ({ x: mark.x, strong: mark.strong }));
  const labels = marks.map((mark) => ({ x: mark.x, label: mark.label }));
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
          xLabelSize={9}
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

function PlainGrowthChart({
  metric,
  entries,
  months,
  onMonths,
  selectedId = null,
  onSelectId,
}: {
  metric: GrowthMetric;
  entries: GrowthEntry[];
  months: number;
  onMonths: (months: number) => void;
  selectedId?: string | null;
  onSelectId?: (id: string) => void;
}) {
  const theme = useTheme();
  const field = FIELD[metric];
  const unit = UNIT[metric];
  const windowDays = months >= 60 ? 1825 : months >= 24 ? 730 : 365;
  const stamped = entries
    .filter((entry) => entry[field] !== undefined)
    .map((entry) => ({ entry, at: new Date(entry.timestamp).getTime() }))
    .filter((item) => Number.isFinite(item.at))
    .sort((a, b) => a.at - b.at);
  const end = stamped.length > 0 ? stamped[stamped.length - 1].at : Date.now();
  const start = end - windowDays * 86_400_000;
  const measured = stamped
    .filter((item) => item.at >= start && item.at <= end)
    .map((item) => {
      const value = item.entry[field] as number;
      return {
        id: item.entry.id,
        x: (item.at - start) / 86_400_000,
        value,
        label: `${formatDateTime(new Date(item.entry.timestamp))} · ${formatDecimal(value, metric === 'weight' ? 1 : 1)} ${unit}`,
      };
    });
  const values = measured.map((point) => point.value);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const pad = (yMax - yMin) * 0.12 || 1;
  const yStep = metric === 'weight' ? 2 : 5;
  const yTicks = [];
  if (Number.isFinite(yMin)) {
    const yStart = Math.floor((yMin - pad) / yStep) * yStep;
    for (let value = yStart; value <= yMax + pad; value += yStep) yTicks.push({ y: value, label: formatDecimal(value, 0) });
  }
  const labelCount = 4;
  const xLabels = [];
  const verticals = [];
  for (let index = 0; index <= labelCount; index += 1) {
    const day = (windowDays / labelCount) * index;
    xLabels.push({ x: day, label: formatDate(new Date(start + day * 86_400_000)).slice(0, 6) });
    verticals.push({ x: day, strong: index === 0 || index === labelCount });
  }

  return (
    <View style={{ gap: 8 }}>
      <ChoiceRow
        label="Zeitraum"
        value={String(months)}
        options={[
          { value: '12', label: '1 Jahr' },
          { value: '24', label: '2 Jahre' },
          { value: '60', label: '5 Jahre' },
        ]}
        onChange={(value) => onMonths(Number(value))}
      />
      {Number.isFinite(yMin) ? (
        <ChartFrame
          height={320}
          xDomain={[0, windowDays]}
          yDomain={[yMin - pad, yMax + pad]}
          yTicks={yTicks}
          xLabels={xLabels}
          verticals={verticals}
          horizontals={[]}
          yUnit={unit}
          selectedId={selectedId}
          onSelectId={onSelectId}
          series={[{ points: measured.map((point) => ({ x: point.x, y: point.value })), color: '#3DB8B0', width: 2.1 }]}
          points={measured.map((point) => ({
            id: point.id,
            x: point.x,
            y: point.value,
            label: point.label,
            fill: '#3DB8B0',
          }))}
        />
      ) : (
        <Text style={{ color: theme.muted, fontSize: 14 }}>Noch keine Werte in diesem Zeitraum.</Text>
      )}
      <Text style={{ color: theme.muted, fontSize: 12 }}>Kurve ohne Perzentile. Zeitraum bis zur letzten Messung.</Text>
    </View>
  );
}
