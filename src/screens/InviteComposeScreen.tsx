import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Banner, Body, Button, Muted, TextField } from '../components/ui';
import { buildInviteMessage, isSupabaseConfigured, makeInviteCode } from '../data/familySync';
import { saveChild } from '../data/mutations';
import { createId } from '../domain/ids';
import { INVITE_RELATIONS, type FamilyInvite, type InviteRelation, type Person } from '../domain/types';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

export function InviteComposeScreen({ personId, onDone }: { personId?: string; onDone: () => void }) {
  const theme = useTheme();
  const { data, update } = useStore();
  const preset = data?.children.find((person) => person.id === personId);
  const [name, setName] = useState(preset?.name ?? '');
  const [chosenId, setChosenId] = useState<string | null>(preset?.id ?? null);
  const [relation, setRelation] = useState<InviteRelation>('partner');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<FamilyInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const adults = (data?.children ?? []).filter((person) => person.personType === 'erwachsen' && !person.isAdmin);
  const sender = data?.children.find((person) => person.isSelf)?.name ?? data?.children.find((person) => person.isAdmin)?.name ?? 'Jemand';

  function choose(person: Person) {
    setChosenId(person.id);
    setName(person.name);
  }

  async function copy(code: string) {
    await Clipboard.setStringAsync(code);
    setCopied(true);
  }

  async function send() {
    if (!data) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Wie heißt die Person?');
      return;
    }
    const existing = data.children.find((person) => person.id === chosenId) ?? data.children.find((person) => person.name.toLowerCase() === trimmed.toLowerCase());
    let person = existing;
    if (!person) {
      person = {
        id: createId('kind'),
        name: trimmed,
        birthDate: '',
        sex: relation === 'vater' || relation === 'grossvater' ? 'junge' : 'maedchen',
        personType: 'erwachsen',
        role: '',
        isSelf: false,
        isAdmin: false,
        joinStatus: 'eingeladen',
        defaultMethod: 'oral',
        frameColor: '#8B5CF6',
        photoUri: null,
        avatarIcon: null,
        isExample: false,
        createdAt: new Date().toISOString(),
      };
    }
    const invite: FamilyInvite = {
      id: createId('einladung'),
      token: makeInviteCode(),
      personId: person.id,
      name: trimmed,
      relation,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      status: 'offen',
    };
    const message = buildInviteMessage(invite.token, isSupabaseConfigured(), trimmed, sender);
    update((current) => {
      const withPerson = saveChild(current, { ...person!, name: trimmed, joinStatus: 'eingeladen', role: person!.role });
      return { ...withPerson, invites: [...(withPerson.invites ?? []), invite] };
    });
    setSent(invite);
    setError(null);
    try {
      await Share.share({ message });
    } catch {
      setError('Das Teilen-Fenster war nicht verfügbar. Den Code kannst du kopieren.');
    }
  }

  if (sent) {
    return (
      <View style={{ gap: 14, alignItems: 'center' }}>
        <MaterialCommunityIcons name="email-heart-outline" size={72} color={theme.accent} />
        <Text style={{ color: theme.text, fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' }}>Einladung ist bereit</Text>
        <Text style={{ color: theme.text, fontSize: 32, letterSpacing: 4, fontWeight: '800' }}>{sent.token}</Text>
        <Muted>Gilt 7 Tage. Kein Google-Konto nötig.</Muted>
        {!isSupabaseConfigured() ? <Banner tone="info">Ohne gemeinsamen Ordner wird nur der Code geteilt. Es werden noch keine Einträge übertragen.</Banner> : null}
        <Button label={copied ? 'Code kopiert' : 'Code kopieren'} onPress={() => void copy(sent.token)} />
        <Button
          label="Nochmal teilen"
          variant="secondary"
          onPress={() => void Share.share({ message: buildInviteMessage(sent.token, isSupabaseConfigured(), sent.name, sender) })}
        />
        <Button label="Fertig" variant="secondary" onPress={onDone} />
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <MaterialCommunityIcons name="account-multiple-plus-outline" size={72} color={theme.accent} />
        <Text style={{ color: theme.text, fontSize: 26, lineHeight: 32, fontWeight: '800', textAlign: 'center' }}>Familienmitglied einladen</Text>
        <Body>Die Einladung gilt für die ganze Familie. Kein Google-Konto.</Body>
      </View>
      {adults.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {adults.map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              onPress={() => choose(person)}
              style={{
                minHeight: 40,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: chosenId === person.id ? theme.accent : theme.border,
                backgroundColor: chosenId === person.id ? theme.accentSoft : theme.card,
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>{person.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextField label="Name" value={name} onChangeText={(value) => { setName(value); setChosenId(null); }} placeholder="Wie heißt die Person?" />
      <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22, fontWeight: '700' }}>In welcher Beziehung stehst du zu der eingeladenen Person?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {INVITE_RELATIONS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => setRelation(item.id)}
            style={{
              minHeight: 40,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: relation === item.id ? theme.accent : theme.border,
              backgroundColor: relation === item.id ? theme.accent : theme.card,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: relation === item.id ? theme.onAccent : theme.text, fontWeight: '700' }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button label="Einladung senden" onPress={() => void send()} />
    </View>
  );
}
