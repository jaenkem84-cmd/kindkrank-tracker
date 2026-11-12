import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Banner, Body, Button, Card, Muted, TextField } from '../components/ui';
import { dateFieldValue, formatDateTime, timeFieldValue, combineBerlin } from '../domain/dates';
import { createId } from '../domain/ids';
import { forChild } from '../domain/select';
import { SYMPTOM_CHIPS } from '../domain/symptoms';
import type { SymptomEntry } from '../domain/types';
import { removeSymptom, saveSymptom } from '../data/mutations';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

export function SymptomScreen({ now }: { now: Date }) {
  const theme = useTheme();
  const { data, activeChild, update } = useStore();
  const [freeText, setFreeText] = useState('');
  const [note, setNote] = useState('');
  const [severity, setSeverity] = useState<1 | 2 | 3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!data || !activeChild) return <Body>Lege zuerst eine Person an.</Body>;
  const entries = forChild(data.symptoms, activeChild.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  function save(label: string, symptomId: string | null) {
    const entry: SymptomEntry = {
      id: createId('sym'),
      childId: activeChild!.id,
      timestamp: now.toISOString(),
      symptomId,
      label,
      severity,
      note: note.trim(),
      isExample: false,
    };
    update((current) => saveSymptom(current, entry));
    setNote('');
    setFreeText('');
    setSeverity(null);
    setError(null);
  }

  return (
    <View style={{ gap: 14 }}>
      <Muted>Tippe ein Symptom. Es wird mit der aktuellen Uhrzeit gespeichert.</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SYMPTOM_CHIPS.map((chip) => (
          <Pressable
            key={chip.id}
            accessibilityRole="button"
            onPress={() => save(chip.label, chip.id)}
            style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, justifyContent: 'center' }}
          >
            <Text style={{ color: theme.text, fontSize: 15 }}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3].map((level) => (
          <Button
            key={level}
            compact
            label={level === 1 ? 'leicht' : level === 2 ? 'mittel' : 'stark'}
            variant={severity === level ? 'primary' : 'secondary'}
            onPress={() => setSeverity(severity === level ? null : (level as 1 | 2 | 3))}
          />
        ))}
      </View>
      <TextField label="Notiz zur nächsten Eingabe" value={note} onChangeText={setNote} placeholder="optional" />
      <TextField label="Eigenes Symptom" value={freeText} onChangeText={setFreeText} placeholder="freier Text" />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button
        label="Freitext speichern"
        variant="secondary"
        onPress={() => {
          if (!freeText.trim()) {
            setError('Schreib das Symptom oder tippe einen Chip.');
            return;
          }
          save(freeText.trim(), null);
        }}
      />
      {entries.map((entry) => (
        <Card key={entry.id}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{entry.label}</Text>
          <Body>
            {formatDateTime(new Date(entry.timestamp))}
            {entry.severity ? ` · ${entry.severity === 1 ? 'leicht' : entry.severity === 2 ? 'mittel' : 'stark'}` : ''}
          </Body>
          {entry.note ? <Muted>{entry.note}</Muted> : null}
          {entry.isExample ? <Muted>Beispieldaten</Muted> : null}
          <Button compact label="Löschen" variant="danger" onPress={() => update((current) => removeSymptom(current, entry.id))} />
        </Card>
      ))}
      <Muted>Datum zum Nachtragen: {dateFieldValue(now)} {timeFieldValue(now)}. Ein anderes Datum geht über die Spracheingabe, zum Beispiel „gestern Husten“.</Muted>
    </View>
  );
}

void combineBerlin;
