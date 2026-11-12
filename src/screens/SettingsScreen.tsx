import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
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
  type PersonType,
  type Sex,
} from '../domain/types';
import { acceptFamilyInvite, createFamilyInvite } from '../data/familySync';
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
  const [inviteText, setInviteText] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
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
        <Body>Familie</Body>
        <Pressable accessibilityRole="button" accessibilityLabel="Person hinzufügen" onPress={onAddChild} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
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
                <Muted>
                  {child.personType === 'kind' ? 'Kind' : 'Erwachsener'}
                  {child.isSelf ? ' · Das bin ich' : child.role ? ` · ${child.role}` : ''}
                  {child.birthDate ? ` · ${isoDateToGerman(child.birthDate)}` : ''}
                </Muted>
              </View>
              <Text style={{ color: theme.muted, fontSize: 18 }}>✎</Text>
            </View>
          </Card>
        </Pressable>
      ))}
      <Muted>Die Einladung gilt für die ganze Familie, nicht für eine einzelne Person.</Muted>
      <Body>Familienmitglied</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {snapshot.caregivers.map((person) => (
          <Pressable key={person.id} onPress={() => onEditMember(person.id)} style={{ width: '47%', backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 14, gap: 6, minHeight: 120 }}>
            <Avatar name={person.name} color={theme.accent} size={42} />
            <Text style={{ color: theme.text, fontWeight: '700' }}>{person.name}{person.isOwner ? ' ♔' : ''}</Text>
            <Muted>{person.role}</Muted>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mitglied hinzufügen"
          onPress={() => {
            void createFamilyInvite(snapshot)
              .then(async (result) => {
                if (result.data !== snapshot) update(() => result.data);
                setInviteText(result.message);
                try {
                  await Share.share({ message: result.message });
                } catch {
                  // The text stays on screen when the sheet is unavailable.
                }
              })
              .catch((error: unknown) => setFamilyNote(error instanceof Error ? error.message : 'Einladung fehlgeschlagen.'));
          }}
          style={{ width: '47%', backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 14, minHeight: 120, justifyContent: 'center' }}
        >
          <Text style={{ color: theme.accent, fontSize: 28 }}>+</Text>
          <Text style={{ color: theme.text, fontWeight: '700' }}>Mitglied hinzufügen</Text>
          <Muted>Einträge anzeigen & bearbeiten</Muted>
        </Pressable>
      </View>
      {inviteText ? (
        <Card>
          <Body>Einladung</Body>
          <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>{inviteText}</Text>
          <Button label="Nochmal teilen" onPress={() => void Share.share({ message: inviteText })} />
        </Card>
      ) : null}
      <TextField label="Einladung annehmen" value={inviteCode} onChangeText={setInviteCode} placeholder="Code oder Link" />
      <Button
        label="Code prüfen"
        variant="secondary"
        onPress={() => {
          void acceptFamilyInvite(inviteCode, snapshot).then((result) => {
            setFamilyNote(result.message);
            if (result.data) update(() => result.data as NonNullable<typeof result.data>);
          });
        }}
      />
      {familyNote ? <Muted>{familyNote}</Muted> : null}
      <Body>Allgemeines</Body>
      <Segmented
        label="Standard-Messart für neue Personen"
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
      {snapshot.children.some((child) => child.isExample) ? (
        <Button label="Beispieldaten löschen" variant="danger" onPress={() => update(deleteExampleData)} />
      ) : null}
      <Muted>{MEDICAL_DISCLAIMER}</Muted>
      <Muted>Familien-Gesundheit {Constants.expoConfig?.version ?? '1.0.0'}</Muted>
    </View>
  );
}

export function InviteAcceptScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const { data, update } = useStore();
  const [message, setMessage] = useState('Einladung wird geprüft …');
  const started = useRef(false);
  useEffect(() => {
    if (!data || started.current) return;
    started.current = true;
    void acceptFamilyInvite(token, data).then((result) => {
      setMessage(result.message);
      if (result.data) update(() => result.data as NonNullable<typeof result.data>);
    });
  }, [data, token, update]);
  return (
    <Screen title="Einladung" onBack={onDone}>
      <Body>{message}</Body>
    </Screen>
  );
}

export function ProfileScreen({ childId, onDone }: { childId?: string; onDone: () => void }) {
  const { data, update } = useStore();
  const existing = data?.children.find((child) => child.id === childId);
  const owner = data?.caregivers.find((person) => person.isOwner);
  const [name, setName] = useState(existing?.name ?? '');
  const [sex, setSex] = useState<Sex>(existing?.sex ?? 'maedchen');
  const [personType, setPersonType] = useState<PersonType>(existing?.personType ?? 'kind');
  const [birth, setBirth] = useState(existing ? isoDateToGerman(existing.birthDate) : '');
  const [color, setColor] = useState(existing?.frameColor ?? FRAME_COLORS[1]);
  const [role, setRole] = useState(existing?.role || owner?.role || '');
  const [isSelf, setIsSelf] = useState(existing?.isSelf ?? false);
  const [method, setMethod] = useState<MeasurementMethod>(existing?.defaultMethod ?? (existing?.personType === 'erwachsen' ? 'oral' : 'rektal'));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save() {
    if (!data) return;
    const parsed = parseGermanDate(birth);
    if (!name.trim()) {
      setError('Wie heißt die Person?');
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
      personType,
      role,
      isSelf,
      defaultMethod: method,
      frameColor: color,
      isExample: existing?.isExample ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    update((current) => {
      const withChild = saveChild(current, child);
      const marked = isSelf
        ? { ...withChild, children: withChild.children.map((person) => ({ ...person, isSelf: person.id === child.id })) }
        : withChild;
      if (!owner || !isSelf) return marked;
      return saveCaregiver(marked, { ...owner, name: child.name, role: role || owner.role });
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
          title="Person löschen?"
          message="Messungen, Medikamente und Gaben dieser Person werden mit gelöscht."
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
        label="Art"
        value={personType}
        options={[
          { value: 'kind' as PersonType, label: 'Kind' },
          { value: 'erwachsen' as PersonType, label: 'Erwachsener' },
        ]}
        onChange={(next) => {
          setPersonType(next);
          setMethod((current) => (next === 'erwachsen' && current === 'rektal' ? 'oral' : current));
        }}
      />
      <Segmented
        label="Geschlecht"
        value={sex}
        options={
          personType === 'erwachsen'
            ? [
                { value: 'junge' as Sex, label: 'männlich' },
                { value: 'maedchen' as Sex, label: 'weiblich' },
              ]
            : [
                { value: 'junge' as Sex, label: 'Junge' },
                { value: 'maedchen' as Sex, label: 'Mädchen' },
              ]
        }
        onChange={setSex}
      />
      <TextField label="Geburtstag" value={birth} onChangeText={setBirth} placeholder="TT.MM.JJJJ" />
      <Segmented
        label="Das bin ich"
        value={isSelf ? 'ja' : 'nein'}
        options={[
          { value: 'ja', label: 'Ja' },
          { value: 'nein', label: 'Nein' },
        ]}
        onChange={(value) => setIsSelf(value === 'ja')}
      />
      <Segmented label="Rolle für die Spracheingabe" value={role || 'keine'} options={[{ value: 'keine', label: 'keine' }, ...CAREGIVER_ROLES.map((item) => ({ value: item, label: item }))]} onChange={(value) => setRole(value === 'keine' ? '' : value)} />
      <Segmented
        label="Standard-Messart"
        value={method}
        options={MEASUREMENT_METHODS.map((item) => ({ value: item, label: METHOD_LABELS[item] }))}
        onChange={setMethod}
      />
      <Body>Rahmenfarbe</Body>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {FRAME_COLORS.map((item) => (
          <Pressable key={item} accessibilityRole="button" onPress={() => setColor(item)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: item, borderWidth: color === item ? 3 : 0, borderColor: '#fff' }} />
        ))}
      </View>
      {existing ? <Button label="Person löschen" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
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
      <Muted>Ein gemeinsamer Ordner braucht Supabase. Ohne diese Einrichtung bleibt jede Einladung nur ein Link, es werden keine Einträge übertragen.</Muted>
    </Screen>
  );
}
