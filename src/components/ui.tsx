import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { dateFieldValue, shiftMinutes, timeFieldValue } from '../domain/dates';
import { useTheme } from '../theme/ThemeProvider';
import type { Theme } from '../theme/theme';

export function Screen({
  title,
  onBack,
  children,
  footer,
  dialog,
}: {
  title: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  dialog?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Zurück" onPress={onBack} style={styles.back} hitSlop={8}>
            <Text style={[styles.backText, { color: theme.accent }]}>Zurück</Text>
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>{footer}</View> : null}
      {dialog}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  compact?: boolean;
}) {
  const theme = useTheme();
  const palette = buttonPalette(theme, variant);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, compact && styles.buttonTextCompact, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function buttonPalette(theme: Theme, variant: 'primary' | 'secondary' | 'danger' | 'ghost') {
  if (variant === 'primary') return { bg: theme.accent, border: theme.accent, text: theme.onAccent };
  if (variant === 'danger') return { bg: theme.dangerSoft, border: theme.danger, text: theme.danger };
  if (variant === 'ghost') return { bg: 'transparent', border: 'transparent', text: theme.accent };
  return { bg: theme.card, border: theme.border, text: theme.text };
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  keyboard = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  keyboard?: 'default' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        keyboardType={keyboard}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.inputMulti,
          { color: theme.text, backgroundColor: theme.input, borderColor: theme.border },
        ]}
      />
      {hint ? <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: theme.text }]}>{label}</Text> : null}
      <View style={styles.segmentRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[
                styles.segment,
                {
                  backgroundColor: selected ? theme.accent : theme.card,
                  borderColor: selected ? theme.accent : theme.border,
                },
              ]}
            >
              <Text style={{ color: selected ? theme.onAccent : theme.text, fontSize: 16, fontWeight: '600' }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function QuickTimes({ onPick }: { onPick: (date: Date) => void }) {
  const presets: [string, number][] = [
    ['Jetzt', 0],
    ['vor 15 Min', -15],
    ['vor 30 Min', -30],
    ['vor 1 Std', -60],
    ['vor 2 Std', -120],
  ];
  return (
    <View style={styles.segmentRow}>
      {presets.map(([label, minutes]) => (
        <Button key={label} compact label={label} variant="secondary" onPress={() => onPick(shiftMinutes(new Date(), minutes))} />
      ))}
    </View>
  );
}

export function DateTimeFields({
  date,
  time,
  onChange,
}: {
  date: string;
  time: string;
  onChange: (date: string, time: string) => void;
}) {
  return (
    <View style={styles.field}>
      <QuickTimes onPick={(value) => onChange(dateFieldValue(value), timeFieldValue(value))} />
      <View style={styles.dateRow}>
        <View style={{ flex: 1.4 }}>
          <TextField label="Datum" value={date} onChangeText={(next) => onChange(next, time)} placeholder="TT.MM.JJJJ" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Uhrzeit" value={time} onChangeText={(next) => onChange(date, next)} placeholder="HH:MM" />
        </View>
      </View>
    </View>
  );
}

export function Banner({ tone = 'warning', children }: { tone?: 'warning' | 'danger' | 'ok' | 'info'; children: ReactNode }) {
  const theme = useTheme();
  const colors =
    tone === 'danger'
      ? { bg: theme.dangerSoft, text: theme.danger }
      : tone === 'ok'
        ? { bg: theme.okSoft, text: theme.ok }
        : tone === 'info'
          ? { bg: theme.accentSoft, text: theme.accent }
          : { bg: theme.warningSoft, text: theme.warning };
  return (
    <View style={[styles.banner, { backgroundColor: colors.bg }]}>
      <Text style={[styles.bannerText, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <View style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.dialogTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.dialogBody, { color: theme.text }]}>{message}</Text>
        <Button label={confirmLabel} variant={tone === 'danger' ? 'danger' : 'primary'} onPress={onConfirm} />
        <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

export function Body({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.body, { color: theme.text }]}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.muted, { color: theme.muted }]}>{children}</Text>;
}

export function MicIcon({ color, size = 42 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="9" y="2.5" width="6" height="11" rx="3" fill={color} />
      <Path d="M6.5 11.2a5.5 5.5 0 0 0 11 0" stroke={color} strokeWidth="1.8" fill="none" />
      <Line x1="12" y1="16.8" x2="12" y2="20.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="8.5" y1="20.2" x2="15.5" y2="20.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 2 },
  back: { minHeight: 36, justifyContent: 'center' },
  backText: { fontSize: 17, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
  content: { padding: 20, gap: 14, paddingBottom: 28 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 8 },
  button: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 48, borderRadius: 14, paddingHorizontal: 12 },
  buttonText: { fontSize: 17, fontWeight: '700' },
  buttonTextCompact: { fontSize: 15 },
  field: { gap: 8 },
  label: { fontSize: 16, fontWeight: '600' },
  input: { minHeight: 56, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 18 },
  inputMulti: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  hint: { fontSize: 14, lineHeight: 20 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    minHeight: 48,
    minWidth: 92,
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: { flexDirection: 'row', gap: 12 },
  banner: { borderRadius: 16, padding: 14 },
  bannerText: { fontSize: 16, lineHeight: 22 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 16, 22, 0.55)',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  dialog: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12 },
  dialogTitle: { fontSize: 22, fontWeight: '700' },
  dialogBody: { fontSize: 17, lineHeight: 24 },
  body: { fontSize: 17, lineHeight: 24 },
  muted: { fontSize: 15, lineHeight: 21 },
});
