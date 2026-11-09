import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { line } from 'd3-shape';
import { useTheme } from '../../theme/ThemeProvider';

export type ChartPoint = {
  id?: string;
  x: number;
  y: number;
  label: string;
  fill?: string;
};

export type ChartSeries = {
  points: { x: number; y: number }[];
  color: string;
  width?: number;
  opacity?: number;
};

type Tick = { x: number; label: string };
type VLine = { x: number; strong: boolean };
type HLine = { y: number; color: string; dashed?: boolean; label?: string };

export function ChartFrame({
  height = 292,
  xDomain,
  yDomain,
  yTicks,
  xLabels,
  verticals,
  horizontals,
  series,
  points,
  markerLane = 0,
}: {
  height?: number;
  xDomain: [number, number];
  yDomain: [number, number];
  yTicks: { y: number; label: string }[];
  xLabels: Tick[];
  verticals: VLine[];
  horizontals: HLine[];
  series: ChartSeries[];
  points: ChartPoint[];
  markerLane?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(360);
  const [selected, setSelected] = useState<ChartPoint | null>(null);
  const pad = { left: 44, right: 8, top: 12, bottom: 28 + markerLane };
  const innerW = Math.max(width - pad.left - pad.right, 1);
  const innerH = Math.max(height - pad.top - pad.bottom, 1);
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const xSpan = x1 - x0 || 1;
  const ySpan = y1 - y0 || 1;
  const xOf = (x: number) => pad.left + ((x - x0) / xSpan) * innerW;
  const yOf = (y: number) => pad.top + ((y1 - y) / ySpan) * innerH;
  const minor = theme.dark ? 'rgba(244,240,232,0.10)' : 'rgba(28,36,48,0.08)';
  const major = theme.dark ? 'rgba(244,240,232,0.78)' : 'rgba(28,36,48,0.62)';
  const pathOf = line<{ x: number; y: number }>()
    .x((item) => xOf(item.x))
    .y((item) => yOf(item.y));

  function pick(locationX: number) {
    let best: ChartPoint | null = null;
    let bestDist = 28;
    for (const point of points) {
      const dist = Math.abs(xOf(point.x) - locationX);
      if (dist < bestDist) {
        best = point;
        bestDist = dist;
      }
    }
    if (best) setSelected(best);
  }

  const tipLeft = selected ? Math.min(Math.max(xOf(selected.x) - 78, 8), Math.max(width - 168, 8)) : 0;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Svg width={width} height={height}>
        {verticals.map((item, index) => (
          <Line
            key={`v-${index}`}
            x1={xOf(item.x)}
            x2={xOf(item.x)}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke={item.strong ? major : minor}
            strokeWidth={item.strong ? 1.6 : 0.6}
          />
        ))}
        {yTicks.map((tick) => (
          <Line
            key={`y-${tick.label}`}
            x1={pad.left}
            x2={width - pad.right}
            y1={yOf(tick.y)}
            y2={yOf(tick.y)}
            stroke={minor}
            strokeWidth={0.75}
          />
        ))}
        {horizontals.map((item) => (
          <Line
            key={`h-${item.y}-${item.label ?? ''}`}
            x1={pad.left}
            x2={width - pad.right}
            y1={yOf(item.y)}
            y2={yOf(item.y)}
            stroke={item.color}
            strokeWidth={1}
            strokeDasharray={item.dashed ? '3 4' : undefined}
            opacity={0.7}
          />
        ))}
        {series.map((item, index) => {
          const d = pathOf(item.points);
          if (!d) return null;
          return (
            <Path
              key={`s-${index}`}
              d={d}
              fill="none"
              stroke={item.color}
              strokeWidth={item.width ?? 1.6}
              opacity={item.opacity ?? 1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
        {yTicks.map((tick) => (
          <SvgText
            key={`yl-${tick.label}`}
            x={pad.left - 6}
            y={yOf(tick.y) + 3}
            fill={theme.muted}
            fontSize={10}
            textAnchor="end"
          >
            {tick.label}
          </SvgText>
        ))}
        {horizontals.map((item) =>
          item.label ? (
            <SvgText key={`hl-${item.label}`} x={width - pad.right - 2} y={yOf(item.y) - 3} fill={item.color} fontSize={9} textAnchor="end">
              {item.label}
            </SvgText>
          ) : null,
        )}
        {xLabels.map((tick) => (
          <SvgText key={`xl-${tick.label}-${tick.x}`} x={xOf(tick.x)} y={height - 8} fill={theme.muted} fontSize={10} textAnchor="middle">
            {tick.label}
          </SvgText>
        ))}
        {points.map((point, index) => (
          <Circle
            key={point.id ?? `p-${index}`}
            cx={xOf(point.x)}
            cy={yOf(point.y)}
            r={selected?.id && selected.id === point.id ? 5 : 3.2}
            fill={point.fill ?? theme.accent}
            stroke={theme.card}
            strokeWidth={1.2}
            onPress={() => setSelected(point)}
          />
        ))}
      </Svg>
      <Pressable
        accessibilityRole="adjustable"
        accessibilityLabel="Diagramm, Punkt auswählen"
        onPress={(event) => {
          const native = event.nativeEvent as { locationX?: number; offsetX?: number };
          pick(native.locationX || native.offsetX || 0);
        }}
        style={{ position: 'absolute', left: pad.left, right: pad.right, top: pad.top, height: innerH }}
      />
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: tipLeft,
            top: 4,
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 12, fontVariant: ['tabular-nums'] }}>{selected.label}</Text>
        </View>
      ) : null}
    </View>
  );
}
