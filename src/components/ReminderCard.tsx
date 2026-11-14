import { useState } from 'react';
import { Banner, Body, Button, Muted, TextField } from './ui';
import { createId } from '../domain/ids';
import type { Reminder } from '../domain/types';
import { removeReminder, saveReminder } from '../data/mutations';
import { ensureNotificationPermission } from '../notifications/reminders';
import { useStore } from '../state/store';
import { Platform } from 'react-native';

export function ReminderCard({
  childId,
  kind,
  medicationId,
  reminder,
}: {
  childId: string;
  kind: Reminder['kind'];
  medicationId?: string;
  reminder?: Reminder;
}) {
  const { update } = useStore();
  const [mode, setMode] = useState<Reminder['mode']>(reminder?.mode ?? 'daily');
  const [times, setTimes] = useState(reminder?.times.join(', ') ?? '');
  const [hours, setHours] = useState(reminder ? String(reminder.hoursAfter).replace('.', ',') : '');
  const [enabled, setEnabled] = useState(reminder?.enabled ?? false);
  const [note, setNote] = useState<string | null>(null);

  async function save(nextEnabled: boolean) {
    const parsedTimes = times
      .split(/[, ]+/)
      .map((item) => item.trim())
      .filter((item) => /^\d{1,2}:\d{2}$/.test(item));
    const hoursAfter = Number(hours.replace(',', '.'));
    if (mode === 'daily' && parsedTimes.length === 0) {
      setNote('Trag eine oder mehrere Uhrzeiten ein, zum Beispiel 08:00, 20:00.');
      return;
    }
    if (mode === 'after' && (!Number.isFinite(hoursAfter) || hoursAfter <= 0 || hoursAfter > 72)) {
      setNote('Trag die Stunden nach dem letzten Eintrag selbst ein.');
      return;
    }
    if (nextEnabled && Platform.OS !== 'web') {
      const allowed = await ensureNotificationPermission();
      if (!allowed) {
        setNote('Mitteilungen sind nicht freigegeben.');
        return;
      }
    }
    const next: Reminder = {
      id: reminder?.id ?? createId('erinnerung'),
      childId,
      kind,
      enabled: nextEnabled,
      mode,
      times: parsedTimes,
      hoursAfter: Number.isFinite(hoursAfter) ? hoursAfter : 0,
    };
    if (medicationId) next.medicationId = medicationId;
    update((current) => saveReminder(current, next));
    setEnabled(nextEnabled);
    setNote(Platform.OS === 'web' ? 'Auf dem Handy wird das als lokale Mitteilung geplant. Im Browser nur gespeichert.' : 'Erinnerung gespeichert.');
  }

  return (
    <>
      <Body>Erinnerung</Body>
      <Muted>Täglich zu festen Zeiten oder automatisch einige Stunden nach dem letzten Eintrag. Keine Vorgabe.</Muted>
      <ViewRow selected={mode} onChange={setMode} />
      {mode === 'daily' ? (
        <TextField label="Uhrzeiten" value={times} onChangeText={setTimes} placeholder="08:00, 20:00" />
      ) : (
        <TextField label="Stunden nach dem letzten Eintrag" value={hours} onChangeText={setHours} placeholder="z. B. 6" keyboard="decimal-pad" />
      )}
      {note ? <Banner tone="info">{note}</Banner> : null}
      <Button label={enabled ? 'Erinnerung ist an' : 'Erinnerung einschalten'} onPress={() => void save(true)} />
      {reminder ? (
        <Button
          label="Erinnerung aus"
          variant="secondary"
          onPress={() => {
            update((current) => removeReminder(current, reminder.id));
            setEnabled(false);
          }}
        />
      ) : null}
    </>
  );
}

function ViewRow({ selected, onChange }: { selected: Reminder['mode']; onChange: (mode: Reminder['mode']) => void }) {
  return (
    <>
      <Button label="Täglich" variant={selected === 'daily' ? 'primary' : 'secondary'} onPress={() => onChange('daily')} />
      <Button label="Nach dem letzten Eintrag" variant={selected === 'after' ? 'primary' : 'secondary'} onPress={() => onChange('after')} />
    </>
  );
}
