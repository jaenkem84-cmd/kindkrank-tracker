import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymptomGlyph } from '../components/SymptomGlyph';
import { Banner, Body, Button, Card, Muted, TextField } from '../components/ui';
import { formatDateTime } from '../domain/dates';
import { createId } from '../domain/ids';
import { forChild } from '../domain/select';
import { BUILTIN_SYMPTOM_ICONS, SYMPTOM_ICON_PALETTE } from '../domain/symptomIcons';
import { SYMPTOM_CHIPS } from '../domain/symptoms';
import type { CustomSymptom, SymptomEntry } from '../domain/types';
import { removeCustomSymptom, removeSymptom, saveCustomSymptom, saveSymptom } from '../data/mutations';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

export function SymptomScreen({ now }: { now: Date }) {
  const theme = useTheme();
  const { data, activeChild, update } = useStore();
  const [note, setNote] = useState('');
  const [severity, setSeverity] = useState<1 | 2 | 3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<CustomSymptom | 'new' | null>(null);
  if (!data || !activeChild) return <Body>Lege zuerst eine Person an.</Body>;
  const customs = data.customSymptoms ?? [];
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
    setSeverity(null);
    setError(null);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <Muted>Tippen speichert das Symptom mit der aktuellen Uhrzeit.</Muted>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([1, 2, 3] as const).map((level) => (
            <Button
              key={level}
              compact
              label={level === 1 ? 'leicht' : level === 2 ? 'mittel' : 'stark'}
              variant={severity === level ? 'primary' : 'secondary'}
              onPress={() => setSeverity(severity === level ? null : level)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SYMPTOM_CHIPS.map((chip) => (
            <SymptomChip
              key={chip.id}
              label={chip.label}
              icon={BUILTIN_SYMPTOM_ICONS[chip.id]}
              onPress={() => save(chip.label, chip.id)}
            />
          ))}
          {customs.map((chip) => (
            <SymptomChip key={chip.id} label={chip.name} icon={chip.icon} onPress={() => save(chip.name, chip.id)} onEdit={() => setSheet(chip)} />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Eigenes Symptom"
            onPress={() => setSheet('new')}
            style={{
              minHeight: 44,
              minWidth: 44,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.accent, fontSize: 22, lineHeight: 26, fontWeight: '700' }}>+</Text>
          </Pressable>
        </View>
        <TextField label="Notiz zur nächsten Eingabe" value={note} onChangeText={setNote} placeholder="optional" />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {entries.map((entry) => {
          const icon =
            (entry.symptomId && BUILTIN_SYMPTOM_ICONS[entry.symptomId]) ||
            customs.find((item) => item.id === entry.symptomId)?.icon;
          return (
            <Card key={entry.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {icon ? <SymptomGlyph name={icon} color={theme.text} size={22} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 17, lineHeight: 22, fontWeight: '700' }}>{entry.label}</Text>
                  <Body>
                    {formatDateTime(new Date(entry.timestamp))}
                    {entry.severity ? ` · ${entry.severity === 1 ? 'leicht' : entry.severity === 2 ? 'mittel' : 'stark'}` : ''}
                  </Body>
                </View>
              </View>
              {entry.note ? <Muted>{entry.note}</Muted> : null}
              <Button compact label="Löschen" variant="danger" onPress={() => update((current) => removeSymptom(current, entry.id))} />
            </Card>
          );
        })}
      </ScrollView>
      {sheet ? (
        <SymptomSheet
          existing={sheet === 'new' ? null : sheet}
          onClose={() => setSheet(null)}
          onSave={(symptom) => {
            update((current) => saveCustomSymptom(current, symptom));
            setSheet(null);
          }}
          onDelete={(id) => {
            update((current) => removeCustomSymptom(current, id));
            setSheet(null);
          }}
        />
      ) : null}
    </View>
  );
}

function SymptomChip({ label, icon, onPress, onEdit }: { label: string; icon?: string; onPress: () => void; onEdit?: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card }}>
      <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: onEdit ? 4 : 12, minHeight: 44 }}>
        {icon ? <SymptomGlyph name={icon} color={theme.text} size={20} /> : null}
        <Text style={{ color: theme.text, fontSize: 15, lineHeight: 20 }}>{label}</Text>
      </Pressable>
      {onEdit ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} bearbeiten`} onPress={onEdit} style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <SymptomGlyph name="pencil-outline" color={theme.muted} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

function SymptomSheet({
  existing,
  onClose,
  onSave,
  onDelete,
}: {
  existing: CustomSymptom | null;
  onClose: () => void;
  onSave: (symptom: CustomSymptom) => void;
  onDelete: (id: string) => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? SYMPTOM_ICON_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);

  return (
    <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }]} onPress={onClose}>
      <Pressable onPress={() => undefined} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 10, maxHeight: '88%' }}>
        <Text style={{ color: theme.text, fontSize: 18, lineHeight: 24, fontWeight: '700' }}>{existing ? 'Symptom ändern' : 'Eigenes Symptom'}</Text>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="z. B. Schwindel" />
        <ScrollView style={{ maxHeight: 196 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SYMPTOM_ICON_PALETTE.map((item) => {
            const selected = item === icon;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={item}
                onPress={() => setIcon(item)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? theme.accent : theme.border,
                  backgroundColor: theme.card,
                }}
              >
                <SymptomGlyph name={item} color={selected ? theme.accent : theme.text} size={22} />
              </Pressable>
            );
          })}
        </ScrollView>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button
          label="Speichern"
          onPress={() => {
            if (!name.trim()) {
              setError('Wie heißt das Symptom?');
              return;
            }
            onSave({ id: existing?.id ?? createId('symptom'), name: name.trim(), icon });
          }}
        />
        {existing ? <Button label="Symptom löschen" variant="danger" onPress={() => onDelete(existing.id)} /> : null}
        <Button label="Schließen" variant="secondary" onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}
