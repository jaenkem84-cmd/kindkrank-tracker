import { useEffect, useRef, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Avatar } from '../components/chrome';
import { Banner, Body, Button, Card, ConfirmDialog, Muted, Screen, Segmented, TextField } from '../components/ui';
import { birthDateToIso, isoDateToGerman, parseGermanDate } from '../domain/dates';
import { createId } from '../domain/ids';
import {
  FRAME_COLORS,
  INVITE_RELATIONS,
  MEASUREMENT_METHODS,
  METHOD_LABELS,
  MEDICAL_DISCLAIMER,
  type Appearance,
  type Child,
  type JoinStatus,
  type MeasurementMethod,
  type Person,
  type PersonType,
  type Sex,
} from '../domain/types';
import { acceptFamilyInvite, buildInviteMessage, isSupabaseConfigured, makeInviteCode } from '../data/familySync';
import { removeChild, saveChild, saveSettings } from '../data/mutations';
import { deleteExampleData } from '../data/seed';
import { shareAllData } from '../export/shareCsv';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

function statusLabel(person: Person): string {
  if (person.isAdmin || person.joinStatus === 'admin') return 'Admin';
  if (person.joinStatus === 'eingeladen') return 'eingeladen';
  if (person.joinStatus === 'beigetreten') return 'beigetreten';
  return 'ohne App';
}

export function SettingsScreen() {
  const theme = useTheme();
  const { data, update, loadError } = useStore();
  if (!data) return <Body>{loadError ?? 'Keine Daten.'}</Body>;
  const snapshot = data;

  return (
    <View style={{ gap: 16 }}>
      <Body>Darstellung</Body>
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
      <Segmented
        label="Standard-Messart für neue Personen"
        value={snapshot.settings.defaultMethod}
        options={MEASUREMENT_METHODS.map((method) => ({ value: method, label: METHOD_LABELS[method] }))}
        onChange={(defaultMethod: MeasurementMethod) => update((current) => saveSettings(current, { ...current.settings, defaultMethod }))}
      />
      {snapshot.children.some((child) => child.isExample) ? (
        <Button label="Beispieldaten löschen" variant="danger" onPress={() => update(deleteExampleData)} />
      ) : null}
      <Muted>{MEDICAL_DISCLAIMER}</Muted>
      <Muted>Familien-Gesundheit {Constants.expoConfig?.version ?? '1.0.0'}</Muted>
    </View>
  );
}

export function ExportScreen() {
  const { data, loadError } = useStore();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!data) return <Body>{loadError ?? 'Keine Daten.'}</Body>;
  return (
    <View style={{ gap: 12 }}>
      <Body>Alle Einträge dieser Familie, ohne Zeitfilter.</Body>
      <Button
        label="Als CSV teilen"
        onPress={() => {
          setError(null);
          void shareAllData(data)
            .then(() => setNote('ZIP mit allen Tabellen, eine Spalte person.'))
            .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Export fehlgeschlagen.'));
        }}
      />
      {note ? <Banner tone="ok">{note}</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </View>
  );
}

export function FamilyScreen({
  onEdit,
  onAdd,
  onInvite,
}: {
  onEdit: (id: string) => void;
  onAdd: () => void;
  onInvite: (personId?: string) => void;
}) {
  const theme = useTheme();
  const { data, update, loadError } = useStore();
  const [notice, setNotice] = useState<string | null>(null);
  const [code, setCode] = useState('');
  if (!data) return <Body>{loadError ?? 'Keine Daten.'}</Body>;
  const snapshot = data;
  const admin = snapshot.children.find((person) => person.isAdmin);

  const pending = (snapshot.invites ?? []).filter((invite) => invite.status === 'offen');

  function resend(inviteId: string) {
    const invite = pending.find((item) => item.id === inviteId);
    if (!invite) return;
    const token = makeInviteCode();
    const next = {
      ...invite,
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    };
    const sender = snapshot.children.find((person) => person.isSelf)?.name ?? admin?.name ?? '';
    update((current) => ({
      ...current,
      invites: (current.invites ?? []).map((item) => (item.id === inviteId ? next : item)),
    }));
    const message = buildInviteMessage(token, isSupabaseConfigured(), next.name, sender);
    void Share.share({ message });
    setNotice(message);
  }

  function withdraw(inviteId: string) {
    update((current) => {
      const invite = (current.invites ?? []).find((item) => item.id === inviteId);
      return {
        ...current,
        invites: (current.invites ?? []).map((item) => (item.id === inviteId ? { ...item, status: 'zurueckgezogen' as const } : item)),
        children: current.children.map((person) =>
          invite?.personId === person.id && person.joinStatus === 'eingeladen' ? { ...person, joinStatus: 'ohne-app' as const } : person,
        ),
      };
    });
  }

  return (
    <View style={{ gap: 12 }}>
      <Button label="Familienmitglied einladen" onPress={() => onInvite()} />
      <Body>{admin ? `${admin.name} ist Admin und legt die Familie an.` : 'Ein Admin legt die Familie an.'}</Body>
      {snapshot.children.map((person) => (
        <Card key={person.id}>
          <Pressable accessibilityRole="button" onPress={() => onEdit(person.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
            <Avatar name={person.name} color={person.frameColor} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
                {person.name}
                {person.isSelf ? ' · Ich' : ''}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
                {person.personType === 'kind' ? 'Kind' : 'Erwachsener'}
                {person.birthDate ? ` · ${isoDateToGerman(person.birthDate)}` : ''}
                {` · ${statusLabel(person)}`}
              </Text>
            </View>
          </Pressable>
          {person.personType === 'erwachsen' && !person.isAdmin && person.joinStatus !== 'beigetreten' ? (
            <Button compact label="Einladen" variant="secondary" onPress={() => onInvite(person.id)} />
          ) : null}
        </Card>
      ))}
      <Button label="Person hinzufügen" variant="secondary" onPress={onAdd} />
      {pending.length > 0 ? <Body>Offene Einladungen</Body> : null}
      {pending.map((invite) => (
        <Card key={invite.id}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{invite.name}</Text>
          <Muted>
            {INVITE_RELATIONS.find((item) => item.id === invite.relation)?.label ?? invite.relation} · Code {invite.token} · bis {isoDateToGerman(invite.expiresAt.slice(0, 10))}
          </Muted>
          <Button compact label="Erneut senden" variant="secondary" onPress={() => resend(invite.id)} />
          <Button compact label="Zurückziehen" variant="danger" onPress={() => withdraw(invite.id)} />
        </Card>
      ))}
      {notice ? (
        <Card>
          <Body>Einladung</Body>
          <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>{notice}</Text>
          {!isSupabaseConfigured() ? (
            <Muted>Ohne Supabase wird nur der Link erzeugt. Es werden keine Einträge übertragen.</Muted>
          ) : null}
        </Card>
      ) : null}
      <TextField label="Einladung annehmen" value={code} onChangeText={setCode} placeholder="Code oder Link" />
      <Button
        label="Code prüfen"
        variant="secondary"
        onPress={() => {
          void acceptFamilyInvite(code, snapshot).then((result) => {
            setNotice(result.message);
            if (result.data) update(() => result.data as NonNullable<typeof result.data>);
          });
        }}
      />
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
      if (result.data) {
        const joined = {
          ...result.data,
          children: result.data.children.map((person) =>
            person.isSelf && !person.isAdmin ? { ...person, joinStatus: 'beigetreten' as JoinStatus } : person,
          ),
        };
        update(() => joined);
      }
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
  const [name, setName] = useState(existing?.name ?? '');
  const [sex, setSex] = useState<Sex>(existing?.sex ?? 'maedchen');
  const [personType, setPersonType] = useState<PersonType>(existing?.personType ?? 'kind');
  const [birth, setBirth] = useState(existing ? isoDateToGerman(existing.birthDate) : '');
  const [color, setColor] = useState(existing?.frameColor ?? FRAME_COLORS[1]);
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
    const first = data.children.length === 0;
    const child: Child = {
      id: existing?.id ?? createId('kind'),
      name: name.trim(),
      birthDate: birthDateToIso(parsed),
      sex,
      personType,
      role: existing?.role ?? '',
      isSelf: first ? true : isSelf,
      isAdmin: existing?.isAdmin ?? first,
      joinStatus: existing?.isAdmin || first ? 'admin' : (existing?.joinStatus ?? 'ohne-app'),
      defaultMethod: method,
      frameColor: color,
      photoUri: existing?.photoUri ?? null,
      avatarIcon: existing?.avatarIcon ?? null,
      isExample: existing?.isExample ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    update((current) => {
      const saved = saveChild(current, child);
      if (!child.isSelf) return saved;
      return {
        ...saved,
        children: saved.children.map((person) => ({ ...person, isSelf: person.id === child.id })),
        settings: { ...saved.settings, defaultGivenBy: child.name },
      };
    });
    onDone();
  }

  return (
    <Screen
      title={existing ? existing.name : 'Person'}
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
            if (!existing || !data) return;
            update((current) => removeChild(current, existing.id));
            onDone();
          }}
        />
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <View style={{ alignItems: 'center' }}>
        <Avatar name={name || '?'} color={color} size={72} />
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
      <Segmented
        label="Standard-Messart"
        value={method}
        options={MEASUREMENT_METHODS.map((item) => ({ value: item, label: METHOD_LABELS[item] }))}
        onChange={setMethod}
      />
      <Body>Farbe</Body>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {FRAME_COLORS.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            onPress={() => setColor(item)}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: item, borderWidth: color === item ? 3 : 0, borderColor: '#fff' }}
          />
        ))}
      </View>
      {existing?.isAdmin ? <Muted>Admin dieser Familie. Die Rolle wird nicht mehr abgefragt.</Muted> : null}
      {existing && !existing.isAdmin ? <Button label="Person löschen" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
    </Screen>
  );
}
