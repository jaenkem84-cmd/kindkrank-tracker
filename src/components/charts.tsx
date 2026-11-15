import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

export type ChartPoint = { x: number; y: number };
export type ChartGuide = { y: number; color: string; label: string };

export function TrendChart({
  points,
  domain,
  guides = [],
  formatX,
  formatY,
  colorForY,
}: {
  points: ChartPoint[];
  domain?: { min: number; max: number };
  guides?: ChartGuide[];
  formatX: (x: number) => string;
  formatY: (y: number) => string;
  colorForY?: (y: number) => string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(320);
  const height = 236;
  const pad = { left: 52, right: 14, top: 14, bottom: 34 };
  if (points.length === 0) return null;

  const xs = points.map((point) => point.x);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  const ys = [...points.map((point) => point.y), ...guides.map((guide) => guide.y)];
  let minY = domain?.min ?? Math.min(...ys);
  let maxY = domain?.max ?? Math.max(...ys);
  if (domain) {
    minY = Math.min(domain.min, ...points.map((point) => point.y));
    maxY = Math.max(domain.max, ...points.map((point) => point.y));
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const plotWidth = Math.max(width - pad.left - pad.right, 1);
  const plotHeight = height - pad.top - pad.bottom;
  const xOf = (x: number) => pad.left + ((x - minX) / (maxX - minX)) * plotWidth;
  const yOf = (y: number) => pad.top + ((maxY - y) / (maxY - minY)) * plotHeight;
  const line = points.map((point) => `${xOf(point.x)},${yOf(point.y)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Svg width={width} height={height}>
        {guides.map((guide) => (
          <Line
            key={guide.label}
            x1={pad.left}
            x2={width - pad.right}
            y1={yOf(guide.y)}
            y2={yOf(guide.y)}
            stroke={guide.color}
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
        ))}
        {guides.map((guide) => (
          <SvgText key={`${guide.label}-label`} x={4} y={yOf(guide.y) + 4} fill={guide.color} fontSize={11}>
            {formatY(guide.y)}
          </SvgText>
        ))}
        <Polyline points={line} fill="none" stroke={theme.chart} strokeWidth={2.5} />
        {points.map((point, index) => (
          <Circle
            key={`${point.x}-${index}`}
            cx={xOf(point.x)}
            cy={yOf(point.y)}
            r={5}
            fill={colorForY ? colorForY(point.y) : theme.accent}
          />
        ))}
        <SvgText x={xOf(first.x)} y={height - 8} fill={theme.muted} fontSize={11} textAnchor="start">
          {formatX(first.x)}
        </SvgText>
        {points.length > 1 ? (
          <SvgText x={xOf(last.x)} y={height - 8} fill={theme.muted} fontSize={11} textAnchor="end">
            {formatX(last.x)}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}
