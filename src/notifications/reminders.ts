import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { AppData, Reminder } from '../domain/types';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

let scheduledKey = '';

/** Reschedules local notifications from the saved reminder rules. No-op on web. */
export async function syncReminders(data: AppData): Promise<void> {
  if (Platform.OS === 'web') return;
  const key = JSON.stringify(
    data.reminders.map((reminder) => ({
      ...reminder,
      anchor: anchorTime(data, reminder),
    })),
  );
  if (key === scheduledKey) return;
  scheduledKey = key;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const granted = await Notifications.getPermissionsAsync();
  if (!granted.granted) return;
  for (const reminder of data.reminders) {
    if (!reminder.enabled) continue;
    const child = data.children.find((item) => item.id === reminder.childId);
    const medication = data.medications.find((item) => item.id === reminder.medicationId);
    const title = reminder.kind === 'temperature' ? 'Temperatur' : (medication?.name ?? 'Medikament');
    const who = child?.name ?? '';
    if (reminder.mode === 'daily') {
      for (const time of reminder.times) {
        const match = time.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) continue;
        await Notifications.scheduleNotificationAsync({
          content: { title, body: `${who}: Erinnerung ${time}.` },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: Number(match[1]),
            minute: Number(match[2]),
          },
        });
      }
    } else {
      const anchor = anchorTime(data, reminder);
      if (!anchor) continue;
      const when = new Date(anchor + reminder.hoursAfter * 3_600_000);
      if (when.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title, body: `${who}: ${reminder.hoursAfter} Stunden seit dem letzten Eintrag.` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      });
    }
  }
}

function anchorTime(data: AppData, reminder: Reminder): number | null {
  if (reminder.kind === 'temperature') {
    const latest = data.temperatures
      .filter((entry) => entry.childId === reminder.childId)
      .map((entry) => new Date(entry.timestamp).getTime())
      .sort((a, b) => b - a)[0];
    return latest ?? null;
  }
  const latest = data.doses
    .filter((entry) => entry.medicationId === reminder.medicationId)
    .map((entry) => new Date(entry.timestamp).getTime())
    .sort((a, b) => b - a)[0];
  return latest ?? null;
}
