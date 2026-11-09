import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

export function Avatar({ name, color, size = 52 }: { name: string; color: string; size?: number }) {
  const theme = useTheme();
  const letter = name.trim().slice(0, 1).toUpperCase() || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 3,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.card,
      }}
    >
      <Text style={{ color: theme.text, fontSize: size * 0.38, fontWeight: '700' }}>{letter}</Text>
    </View>
  );
}

export function MenuIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function CategoryIcon({ name, color }: { name: string; color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      {name === 'temperature' ? <Path d="M10 4.5a2 2 0 1 1 4 0v7.2a3.5 3.5 0 1 1-4 0V4.5z" stroke={color} strokeWidth={1.6} fill="none" /> : null}
      {name === 'medication' ? <Rect x="4" y="8" width="16" height="8" rx="4" stroke={color} strokeWidth={1.6} fill="none" /> : null}
      {name === 'weight' ? <Path d="M6 16h12l-1.2-6H7.2L6 16zm6-6V6" stroke={color} strokeWidth={1.6} fill="none" /> : null}
      {name === 'height' ? <Path d="M8 4v16M8 6h4M8 10h3M8 14h4M8 18h3" stroke={color} strokeWidth={1.6} strokeLinecap="round" /> : null}
      {name === 'head' ? <Circle cx="12" cy="11" r="5.5" stroke={color} strokeWidth={1.6} fill="none" /> : null}
      {name === 'vaccination' ? <Path d="M15 4l5 5M14 9l-8 8M9 14l-2 2M17 7l-2 2" stroke={color} strokeWidth={1.6} strokeLinecap="round" /> : null}
      {name === 'symptom' ? <Path d="M12 4c2 3 5 4 5 8a5 5 0 1 1-10 0c0-4 3-5 5-8z" stroke={color} strokeWidth={1.6} fill="none" /> : null}
    </Svg>
  );
}

export function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </Pressable>
  );
}
