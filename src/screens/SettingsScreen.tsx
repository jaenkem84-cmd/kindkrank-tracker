import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Avatar } from '../components/chrome';
import { Banner, Body, Button, Card, ConfirmDialog, Muted, Screen, Segmented, TextField } from '../components/ui';
import { birthDateToIso, isoDateToGerman, parseGermanDate } from '../domain/dates';
import { createId } from '../domain/ids';
import {
  CAREGIVER_ROLES,
  FRAME_COLORS,
  MEASUREMENT_METHODS,
  METHOD_LABELS,
  MEDICAL_DISCLAIMER,
  type Appearance,
  type Caregiver,
  type Child,
  type MeasurementMethod,
  type Sex,
} from '../domain/types';
import { localFamilyDirectory } from '../data/sync';
import { removeCaregiver, removeChild, saveCaregiver, saveChild, saveSettings } from '../data/mutations';
import { deleteExampleData } from '../data/seed';
import { shareAllData } from '../export/shareCsv';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

export function SettingsScreen({
  onEditChild,
  onAddChild,
  onEditMember,
  onAddMember,
}: {
  onEditChild: (id: string) => void;
  onAddChild: () => void;
  onEditMember: (id: string) => void;
  onAddMember: () => void;
}) {
  const theme = useTheme();
  const { data, update, loadError } = useStore();
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [familyNote, setFamilyNote] = useState<string | null>(null);
  if (!data) return <Body>{loadError ?? 'Keine Daten.'}</Body>;
  const snapshot = data;
  const owner = snapshot.caregivers.find((person) => person.isOwner) ?? snapshot.caregivers[0];

  return (
    <View style={{ gap: 16 }}>
      {owner ? (
        <Pressable onPress={() => onEditMember(owner.id)} style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <Avatar name={owner.name} color={theme.accent} size={84} />
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>{owner.name}</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Body>Mein Baby</Body>
        <Pressable accessibilityRole="button" accessibilityLabel="Kind hinzufügen" onPress={onAddChild} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.accent, fontSize: 28 }}>+</Text>
        </Pressable>
      </View>
      {snapshot.children.map((child) => (
        <Pressable key={child.id} onPress={() => onEditChild(child.id)}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={child.name} color={child.frameColor} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{child.name}{child.isExample ? ' · Beispiel' : ''}</Text>
                <Muted>geboren {isoDateToGerman(child.birthDate)}</Muted>
              </View>
              <Text style={{ color: theme.muted, fontSize: 18 }}>✎</Text>
            </View>
          </Card>
        </Pressable>
      ))}
      <Body>Familienmitglied</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {snapshot.caregivers.map((person) => (
          <Pressable key={person.id} onPress={() => onEditMember(person.id)} style={{ width: '47%', backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 6, minHeight: 120 }}>
            <Avatar name={person.name} color={theme.accent} size={42} />
            <Text style={{ color: theme.text, fontWeight: '700' }}>{person.name}{person.isOwner ? ' ♔' : ''}</Text>
            <Muted>{person.role}</Muted>
          </Pressable>
        ))}
        <Pressable onPress={onAddMember} style={{ width: '47%', backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 14, minHeight: 120, justifyContent: 'center' }}>
          <Text style={{ color: theme.accent, fontSize: 28 }}>+</Text>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Mitglieder hinzufügen</Text>
          <Muted>Einträge anzeigen & bearbeiten</Muted>
        </Pressable>
      </View>
      <Body>Allgemeines</Body>
      <Segmented
        label="Standard-Messart"
        value={snapshot.settings.defaultMethod}
        options={MEASUREMENT_METHODS.map((method) => ({ value: method, label: METHOD_LABELS[method] }))}
        onChange={(defaultMethod: MeasurementMethod) => update((current) => saveSettings(current, { ...current.settings, defaultMethod }))}
      />
      <TextField
        label="Standard für „gegeben von“"
        value={snapshot.settings.defaultGivenBy}
        onChangeText={(defaultGivenBy) => update((current) => saveSettings(current, { ...current.settings, defaultGivenBy }))}
        placeholder="Papa"
      />
      <Segmented
        label="Erscheinungsbild"
        value={snapshot.settings.appearance}
        options={[
          { value: 'system' as Appearance, label: 'System' },
          { value: 'light' as Appearance, label: 'Hell' },
          { value: 'dark' as Appearance, label: 'Dunkel' },
        ]}
        onChange={(appearance) => update((current) => saveSettings(current, { ...current.settings, appearance }))}
      />
      <Button
        label="Alle Daten als CSV exportieren"
        onPress={() => {
          setExportError(null);
          void shareAllData(snapshot)
            .then(() => setExportNote('ZIP mit allen Tabellen, ohne Zeitfilter.'))
            .catch((error: unknown) => setExportError(error instanceof Error ? error.message : 'Export fehlgeschlagen.'));
        }}
      />
      {exportNote ? <Banner tone="ok">{exportNote}</Banner> : null}
      {exportError ? <Banner tone="danger">{exportError}</Banner> : null}
      <Button
        label="Einladungslink"
        variant="secondary"
        onPress={() => {
          void localFamilyDirectory.createInvite().then((result) => setFamilyNote(result.ok ? result.url : result.reason));
        }}
      />
      {familyNote ? <Muted>{familyNote}</Muted> : null}
      {snapshot.children.some((child) => child.isExample) ? (
        <Button label="Beispieldaten löschen" variant="danger" onPress={() => update(deleteExampleData)} />
      ) : null}
      <Muted>{MEDICAL_DISCLAIMER}</Muted>
      <Muted>Kindkrank-Tracker {Constants.expoConfig?.version ?? '1.0.0'}</Muted>
    </View>
  );
}

export function ProfileScreen({ childId, onDone }: { childId?: string; onDone: () => void }) {
  const { data, update } = useStore();
  const existing = data?.children.find((child) => child.id === childId);
  const owner = data?.caregivers.find((person) => person.isOwner);
  const [name, setName] = useState(existing?.name ?? '');
  const [sex, setSex] = useState<Sex>(existing?.sex ?? 'maedchen');
  const [birth, setBirth] = useState(existing ? isoDateToGerman(existing.birthDate) : '');
  const [color, setColor] = useState(existing?.frameColor ?? FRAME_COLORS[1]);
  const [role, setRole] = useState(owner?.role ?? 'Vater');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    if (!data) return;
    const parsed = parseGermanDate(birth);
    if (!name.trim()) {
      setError('Wie heißt das Kind?');
      return;
    }
    if (!parsed) {
      setError('Geburtsdatum als TT.MM.JJJJ.');
      return;
    }
    const child: Child = {
      id: existing?.id ?? createId('kind'),
      name: name.trim(),
      birthDate: birthDateToIso(parsed),
      sex,
      frameColor: color,
      isExample: existing?.isExample ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    update((current) => {
      const withChild = saveChild(current, child);
      if (!owner) return withChild;
      return saveCaregiver(withChild, { ...owner, role });
    });
    onDone();
  }

  return (
    <Screen
      title="Profil"
      onBack={onDone}
      right={<Button compact label="Speichern" onPress={save} />}
      dialog={
        <ConfirmDialog
          visible={confirmDelete}
          title="Kind löschen?"
          message="Messungen, Medikamente und Gaben dieses Kindes werden mit gelöscht."
          confirmLabel="Wirklich löschen"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            if (!existing) return;
            update((current) => removeChild(current, existing.id));
            onDone();
          }}
        />
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <View style={{ alignItems: 'center' }}>
        <Avatar name={name || '?'} color={color} size={84} />
      </View>
      <TextField label="Name" value={name} onChangeText={setName} />
      <Segmented
        label="Geschlecht"
        value={sex}
        options={[
          { value: 'junge' as Sex, label: 'Junge' },
          { value: 'maedchen' as Sex, label: 'Mädchen' },
        ]}
        onChange={setSex}
      />
      <TextField label="Geburtstag" value={birth} onChangeText={setBirth} placeholder="TT.MM.JJJJ" />
      <Body>Rahmenfarbe</Body>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {FRAME_COLORS.map((item) => (
          <Pressable key={item} accessibilityRole="button" onPress={() => setColor(item)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: item, borderWidth: color === item ? 3 : 0, borderColor: '#fff' }} />
        ))}
      </View>
      <Segmented label="Beziehung zum Kind" value={role} options={CAREGIVER_ROLES.map((item) => ({ value: item, label: item }))} onChange={setRole} />
      {existing ? <Button label="Kind löschen" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
    </Screen>
  );
}

export function MemberScreen({ memberId, onDone }: { memberId?: string; onDone: () => void }) {
  const { data, update } = useStore();
  const existing = data?.caregivers.find((person) => person.id === memberId);
  const [name, setName] = useState(existing?.name ?? '');
  const [role, setRole] = useState(existing?.role ?? 'Mutter');
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!name.trim()) {
      setError('Name fehlt.');
      return;
    }
    const person: Caregiver = {
      id: existing?.id ?? createId('person'),
      name: name.trim(),
      role,
      isOwner: existing?.isOwner ?? false,
    };
    update((current) => saveCaregiver(current, person));
    onDone();
  }

  return (
    <Screen title={existing?.isOwner ? 'Dein Profil' : 'Familienmitglied'} onBack={onDone} right={<Button compact label="Speichern" onPress={save} />}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <TextField label="Name" value={name} onChangeText={setName} />
      <Segmented label="Rolle" value={role} options={CAREGIVER_ROLES.map((item) => ({ value: item, label: item }))} onChange={setRole} />
      {existing && !existing.isOwner ? (
        <Button label="Entfernen" variant="danger" onPress={() => { update((current) => removeCaregiver(current, existing.id)); onDone(); }} />
      ) : null}
      <Muted>Mitglieder können später über einen Einladungslink dieselben Einträge sehen. In diesem Prototyp bleiben die Daten auf dem Gerät.</Muted>
    </Screen>
  );
}
