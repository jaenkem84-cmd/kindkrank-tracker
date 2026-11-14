import { useState } from 'react';
import { Pressable, Text, View, type GestureResponderHandlers } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { line } from 'd3-shape';
import { SymptomGlyph } from '../SymptomGlyph';
import { useTheme } from '../../theme/ThemeProvider';

export type ChartPoint = {
  id?: string;
  x: number;
  y: number;
  label: string;
  fill?: string;
  r?: number;
  opacity?: number;
  /** False for overlay marks that should not be selected. */
  hit?: boolean;
  /** MaterialCommunityIcons name drawn instead of a dot, when there is room. */
  icon?: string;
};

export type ChartSeries = {
  points: { x: number; y: number }[];
  color: string;
  width?: number;
  opacity?: number;
};

type Tick = { x: number; label: string };
type VLine = { x: number; strong: boolean; label?: string; labelAxis?: 'horizontal' | 'vertical' };
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
  yUnit,
  endLabels = [],
  selectedId = null,
  onSelectId,
  panHandlers,
  xLabelSize = 10,
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
  yUnit?: string;
  endLabels?: { y: number; text: string }[];
  selectedId?: string | null;
  onSelectId?: (id: string) => void;
  panHandlers?: GestureResponderHandlers;
  xLabelSize?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(360);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const activeId = selectedId ?? pickedId;
  const selected = points.find((point) => point.id && point.id === activeId) ?? null;
  const pad = { left: 44, right: endLabels.length > 0 ? 34 : 8, top: 16, bottom: 28 + markerLane };
  const innerW = Math.max(width - pad.left - pad.right, 1);
  const innerH = Math.max(height - pad.top - pad.bottom, 1);
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const xSpan = x1 - x0 || 1;
  const ySpan = y1 - y0 || 1;
  const xOf = (x: number) => pad.left + ((x - x0) / xSpan) * innerW;
  const yOf = (y: number) => pad.top + ((y1 - y) / ySpan) * innerH;
  const minor = theme.dark ? 'rgba(186,194,204,0.22)' : 'rgba(90,98,110,0.18)';
  const major = theme.dark ? 'rgba(186,194,204,0.55)' : 'rgba(70,78,90,0.42)';
  const pathOf = line<{ x: number; y: number }>()
    .x((item) => xOf(item.x))
    .y((item) => yOf(item.y));

  function pick(locationX: number) {
    let best: ChartPoint | null = null;
    let bestDist = 28;
    for (const point of points) {
      if (point.hit === false || !point.id) continue;
      const dist = Math.abs(xOf(point.x) - locationX);
      if (dist < bestDist) {
        best = point;
        bestDist = dist;
      }
    }
    if (best?.id) {
      setPickedId(best.id);
      onSelectId?.(best.id);
    }
  }

  const tipLeft = selected ? Math.min(Math.max(xOf(selected.x) - 78, 8), Math.max(width - 168, 8)) : 0;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} {...panHandlers}>
      <Svg width={width} height={height}>
        {verticals.map((item, index) => (
          <Line
            key={`v-${index}`}
            x1={xOf(item.x)}
            x2={xOf(item.x)}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke={item.strong ? major : minor}
            strokeWidth={item.strong ? 1.15 : 0.6}
          />
        ))}
        {verticals.map((item, index) => {
          if (!item.label) return null;
          const x = xOf(item.x);
          const y = pad.top + innerH - 3;
          if (item.labelAxis === 'vertical') {
            return (
              <SvgText
                key={`vh-${index}`}
                x={0}
                y={0}
                fill={theme.muted}
                fontSize={8}
                textAnchor="end"
                transform={`translate(${x}, ${y}) rotate(-90)`}
              >
                {item.label}
              </SvgText>
            );
          }
          return (
            <SvgText key={`vh-${index}`} x={x} y={y} fill={theme.muted} fontSize={8} textAnchor="middle" opacity={0.8}>
              {item.label}
            </SvgText>
          );
        })}
        {selected ? (
          <Line
            x1={xOf(selected.x)}
            x2={xOf(selected.x)}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke={theme.dark ? 'rgba(255,255,255,0.45)' : 'rgba(20,24,32,0.35)'}
            strokeWidth={1}
          />
        ) : null}
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
        {yUnit ? (
          <SvgText x={pad.left - 6} y={11} fill={theme.muted} fontSize={10} textAnchor="end">
            {yUnit}
          </SvgText>
        ) : null}
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
        {placeEndLabels(endLabels, yOf).map((label) => (
          <SvgText key={`end-${label.text}`} x={width - 2} y={label.pixel + 3} fill={theme.muted} fontSize={9} textAnchor="end">
            {label.text}
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
            <SvgText key={`xl-${tick.label}-${tick.x}`} x={xOf(tick.x)} y={height - 8} fill={theme.muted} fontSize={xLabelSize} textAnchor="middle">
            {tick.label}
          </SvgText>
        ))}
        {points.map((point, index) => point.icon ? null : (
          <Circle
            key={point.id ?? `p-${index}`}
            cx={xOf(point.x)}
            cy={yOf(point.y)}
            r={point.id && point.id === activeId ? 6 : (point.r ?? 3)}
            fill={point.fill ?? theme.accent}
            opacity={point.opacity ?? 1}
            stroke={point.id && point.id === activeId ? '#FFFFFF' : theme.card}
            strokeWidth={point.id && point.id === activeId ? 1.6 : 1}
            onPress={() => {
              if (!point.id || point.hit === false) return;
              setPickedId(point.id);
              onSelectId?.(point.id);
            }}
          />
        ))}
        {points
          .filter((point) => point.icon)
          .map((point, index) => (
            <View
              key={`icon-${point.id ?? index}`}
              pointerEvents="none"
              style={{ position: 'absolute', left: xOf(point.x) - 9, top: yOf(point.y) - 9 }}
            >
              <SymptomGlyph name={point.icon as string} color={point.fill ?? theme.text} size={18} />
            </View>
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

function placeEndLabels(labels: { y: number; text: string }[], yOf: (y: number) => number): { text: string; pixel: number }[] {
  const placed: { text: string; pixel: number }[] = [];
  const ordered = [...labels].sort((a, b) => yOf(a.y) - yOf(b.y));
  for (const label of ordered) {
    const pixel = yOf(label.y);
    const crowded = placed.some((item) => Math.abs(item.pixel - pixel) < 11);
    if (crowded && label.text !== 'P50') continue;
    placed.push({ text: label.text, pixel });
  }
  return placed;
}
