import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ReminderCard } from '../components/ReminderCard';
import { Body, Button, Muted } from '../components/ui';
import { berlinParts } from '../domain/dates';
import type { Reminder } from '../domain/types';
import { saveReminder } from '../data/mutations';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

export function AlarmsScreen({ now }: { now: Date }) {
  const theme = useTheme();
  const { data, update } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!data) return <Body>Keine Daten.</Body>;
  const open = data.reminders.find((item) => item.id === openId) ?? null;
  const medicationName = (id?: string) => data.medications.find((item) => item.id === id)?.name ?? 'Temperatur';

  return (
    <View style={{ flex: 1 }}>
      <View style={{ gap: 10 }}>
        {data.reminders.length === 0 ? <Muted>Noch kein Alarm. Die Glocke an einem Medikament legt einen an.</Muted> : null}
        {data.reminders.map((reminder) => {
          const person = data.children.find((item) => item.id === reminder.childId);
          return (
            <View
              key={reminder.id}
              style={{
                minHeight: 64,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.card,
                flexDirection: 'row',
                alignItems: 'center',
                paddingLeft: 12,
                gap: 8,
              }}
            >
              <Pressable accessibilityRole="button" onPress={() => setOpenId(reminder.id)} style={{ flex: 1, paddingVertical: 8 }}>
                <Text style={{ color: theme.text, fontSize: 16, lineHeight: 20, fontWeight: '700' }} numberOfLines={1}>
                  {person?.name ?? 'Person'} · {medicationName(reminder.medicationId)}
                </Text>
                <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                  {scheduleText(reminder)} · {nextText(reminder, data, now)}
                </Text>
              </Pressable>
              <Switch
                accessibilityLabel={reminder.enabled ? 'Alarm aus' : 'Alarm an'}
                value={reminder.enabled}
                onValueChange={(enabled) => update((current) => saveReminder(current, { ...reminder, enabled }))}
                trackColor={{ true: theme.accent, false: theme.border }}
              />
              <Text style={{ color: theme.muted, fontSize: 22, paddingRight: 10 }}>›</Text>
            </View>
          );
        })}
      </View>
      {open ? (
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }]} onPress={() => setOpenId(null)}>
          <Pressable onPress={() => undefined} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 8, maxHeight: '86%' }}>
            <Text style={{ color: theme.text, fontSize: 18, lineHeight: 24, fontWeight: '700' }}>
              Alarm · {medicationName(open.medicationId)}
            </Text>
            <ReminderCard childId={open.childId} kind={open.kind} medicationId={open.medicationId} reminder={open} />
            <Button label="Schließen" variant="secondary" onPress={() => setOpenId(null)} />
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

function scheduleText(reminder: Reminder): string {
  if (reminder.mode === 'daily') {
    return reminder.times.length > 0 ? `täglich ${reminder.times.join(', ')}` : 'täglich, ohne Uhrzeit';
  }
  return `${String(reminder.hoursAfter).replace('.', ',')} h nach der letzten Gabe`;
}

function nextText(reminder: Reminder, data: { doses: { medicationId: string; timestamp: string }[] }, now: Date): string {
  if (!reminder.enabled) return 'aus';
  if (reminder.mode === 'daily') return nextDaily(reminder.times, now);
  const last = data.doses
    .filter((dose) => dose.medicationId === reminder.medicationId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (!last) return 'nach der nächsten Gabe';
  const at = new Date(new Date(last.timestamp).getTime() + reminder.hoursAfter * 3_600_000);
  const parts = berlinParts(at);
  const clock = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  return `nächste ${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}. ${clock}`;
}

function nextDaily(times: string[], now: Date): string {
  const parts = berlinParts(now);
  const nowMinutes = parts.hour * 60 + parts.minute;
  const sorted = times
    .map((time) => {
      const [hour, minute] = time.split(':').map(Number);
      return { time, minutes: hour * 60 + minute };
    })
    .filter((item) => Number.isFinite(item.minutes))
    .sort((a, b) => a.minutes - b.minutes);
  const later = sorted.find((item) => item.minutes > nowMinutes);
  if (later) return `nächste heute ${later.time}`;
  if (sorted[0]) return `nächste morgen ${sorted[0].time}`;
  return 'keine Uhrzeit';
}
