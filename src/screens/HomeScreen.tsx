import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { IconButton, MenuIcon } from '../components/chrome';
import { PersonFace } from '../components/PersonFace';
import { Button, MicIcon } from '../components/ui';
import { ageMonths, formatAgeWeeks, formatDayHeading, formatTime, sameBerlinDay } from '../domain/dates';
import { formatDecimal } from '../domain/format';
import { forChild } from '../domain/select';
import { FRAME_COLORS, type Person } from '../domain/types';
import type { CategoryName } from '../navigation/types';
import { saveChild, setActivePerson } from '../data/mutations';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

const CATEGORIES: { id: CategoryName; label: string; icon: 'thermometer' }[] = [
  { id: 'temperature', label: 'Temperatur', icon: 'thermometer' },
  { id: 'medication', label: 'Medikation', icon: 'pill' as 'thermometer' },
  { id: 'vaccination', label: 'Impfung', icon: 'needle' as 'thermometer' },
  { id: 'symptom', label: 'Symptome', icon: 'emoticon-sick-outline' as 'thermometer' },
  { id: 'weight', label: 'Gewicht', icon: 'scale-bathroom' as 'thermometer' },
  { id: 'height', label: 'Größe', icon: 'ruler' as 'thermometer' },
  { id: 'head', label: 'Kopfumfang', icon: 'head-outline' as 'thermometer' },
];

const AVATARS = [
  'face-man',
  'face-woman',
  'account-child',
  'baby-face-outline',
  'human-male',
  'human-female',
  'human-child',
  'account',
  'account-heart',
  'emoticon-happy-outline',
  'flower-outline',
  'paw',
] as const;

const TILE = 148;

export function HomeScreen({
  now,
  day,
  onShiftDay,
  onMenu,
  onFamily,
  onInvite,
  onVoice,
  onCategory,
}: {
  now: Date;
  day: Date;
  onShiftDay: (delta: number) => void;
  onMenu: () => void;
  onFamily: () => void;
  onInvite: () => void;
  onVoice: () => void;
  onCategory: (name: CategoryName) => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { data, activeChild, update } = useStore();
  const scroller = useRef<{ scrollTo: (options: { x: number; animated?: boolean }) => void } | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const people = data?.children ?? [];
  const activeIndex = Math.max(0, people.findIndex((person) => person.id === activeChild?.id));
  useEffect(() => {
    scroller.current?.scrollTo({ x: activeIndex * TILE, animated: false });
  }, [activeIndex, people.length]);
  if (!data || !activeChild) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12 }}>
        <Text style={{ color: theme.text, fontSize: 22 }}>Noch keine Person.</Text>
        <Pressable onPress={onFamily} style={{ minHeight: 56, borderRadius: 16, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.onAccent, fontSize: 17, fontWeight: '700' }}>Familie anlegen</Text>
        </Pressable>
      </View>
    );
  }
  const side = Math.max(0, (width - TILE) / 2);
  const temps = forChild(data.temperatures, activeChild.id).filter((entry) => sameBerlinDay(new Date(entry.timestamp), day));
  const doses = forChild(data.doses, activeChild.id).filter((entry) => sameBerlinDay(new Date(entry.timestamp), day));
  const today = sameBerlinDay(day, now);
  const empty = temps.length + doses.length === 0;
  const categories = CATEGORIES.filter((category) => activeChild.personType === 'kind' || category.id !== 'head');
  const perRow = Math.ceil(categories.length / 2);
  const rows = [categories.slice(0, perRow), categories.slice(perRow)];
  const editing = people.find((person) => person.id === pickerFor) ?? null;

  function selectIndex(index: number) {
    const person = people[Math.max(0, Math.min(people.length - 1, index))];
    if (!person) return;
    scroller.current?.scrollTo({ x: people.indexOf(person) * TILE, animated: true });
    if (person.id !== activeChild?.id) update((current) => setActivePerson(current, person.id));
  }

  function settle(offsetX: number) {
    selectIndex(Math.round(offsetX / TILE));
  }

  async function takePhoto(source: 'camera' | 'library') {
    if (!editing) return;
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setPhotoNote('Die Kamera ist nicht freigegeben.');
          return;
        }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.4 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4 });
      if (result.canceled || !result.assets[0]) return;
      update((current) => {
        const person = current.children.find((item) => item.id === editing.id);
        if (!person) return current;
        return saveChild(current, { ...person, photoUri: result.assets[0].uri, avatarIcon: null });
      });
      setPickerFor(null);
    } catch {
      setPhotoNote('Foto konnte hier nicht gewählt werden.');
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={(node) => {
          scroller.current = node;
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={TILE}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: side, alignItems: 'center' }}
        style={{ maxHeight: 168 }}
        onMomentumScrollEnd={(event) => settle(event.nativeEvent.contentOffset.x)}
        onScrollEndDrag={(event) => settle(event.nativeEvent.contentOffset.x)}
      >
        {people.map((person, index) => {
          const active = person.id === activeChild.id;
          return (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={person.name}
              accessibilityState={{ selected: active }}
              onPress={() => selectIndex(index)}
              style={{ width: TILE, alignItems: 'center', justifyContent: 'center', opacity: active ? 1 : 0.45, transform: [{ scale: active ? 1 : 0.82 }] }}
            >
              <PersonFace person={person} size={active ? 92 : 68} />
              <Text style={{ color: active ? person.frameColor : theme.text, fontSize: active ? 18 : 14, lineHeight: 22, fontWeight: '800', marginTop: 6 }} numberOfLines={1}>
                {person.name}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 16, maxWidth: TILE - 12, textAlign: 'center' }} numberOfLines={1}>{personAge(person, now)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Foto oder Avatar" onPress={() => setPickerFor(activeChild.id)} style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}>
        <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>Foto oder Avatar</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
        <IconButton label="Menü" onPress={onMenu}>
          <MenuIcon color={theme.text} />
        </IconButton>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <IconButton label="Vorheriger Tag" onPress={() => onShiftDay(-1)}>
            <Text style={{ color: theme.text, fontSize: 22 }}>‹</Text>
          </IconButton>
          <Text style={{ color: theme.text, fontSize: 17, lineHeight: 22, fontWeight: '700' }}>{formatDayHeading(day)}</Text>
          <IconButton label="Nächster Tag" onPress={() => onShiftDay(1)}>
            <Text style={{ color: today ? theme.muted : theme.text, fontSize: 22 }}>›</Text>
          </IconButton>
        </View>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }} style={{ flex: 1 }}>
        {data.children.filter((person) => person.personType === 'erwachsen' && (person.isAdmin || person.joinStatus === 'beigetreten')).length < 2 ? (
          <Pressable onPress={onInvite} style={{ borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, padding: 14, gap: 4 }}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Noch niemand sonst in der App</Text>
            <Text style={{ color: theme.accent, fontSize: 15, fontWeight: '700' }}>Familienmitglied einladen</Text>
          </Pressable>
        ) : null}
        {empty ? (
          <Text style={{ color: theme.muted, fontSize: 16, textAlign: 'center', paddingVertical: 28 }}>
            {today ? 'Heute noch nichts eingetragen.' : 'Keine Einträge an diesem Tag.'}
          </Text>
        ) : (
          <>
            {temps.map((entry) => (
              <Pressable key={entry.id} onPress={() => onCategory('temperature')} style={{ padding: 12, borderRadius: 12, backgroundColor: theme.card }}>
                <Text style={{ color: theme.text, fontSize: 16 }}>{formatTime(new Date(entry.timestamp))} · {formatDecimal(entry.celsius, 1)} °C</Text>
              </Pressable>
            ))}
            {doses.map((entry) => {
              const medication = data.medications.find((item) => item.id === entry.medicationId);
              return (
                <Pressable key={entry.id} onPress={() => onCategory('medication')} style={{ padding: 12, borderRadius: 12, backgroundColor: theme.card }}>
                  <Text style={{ color: theme.text, fontSize: 16 }}>{formatTime(new Date(entry.timestamp))} · {medication?.name ?? 'Medikament'} {entry.doseText}</Text>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Spracheingabe"
        onPress={onVoice}
        style={{ marginHorizontal: 16, marginBottom: 8, minHeight: 52, borderRadius: 16, backgroundColor: theme.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <MicIcon color={theme.onAccent} size={24} />
        <Text style={{ color: theme.onAccent, fontSize: 17, fontWeight: '800' }}>Spracheingabe</Text>
      </Pressable>
      <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 4 }}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: 'row' }}>
            {row.map((category) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={category.label}
                onPress={() => onCategory(category.id)}
                style={{ flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                <MaterialCommunityIcons name={category.icon} size={32} color={theme.text} />
                <Text style={{ color: theme.text, fontSize: 13, lineHeight: 16, textAlign: 'center' }} numberOfLines={1}>
                  {category.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      {editing ? (
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }]} onPress={() => setPickerFor(null)}>
          <Pressable onPress={() => undefined} style={{ backgroundColor: theme.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, gap: 10, maxHeight: '80%' }}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>Aussehen · {editing.name}</Text>
            {photoNote ? <Text style={{ color: theme.muted }}>{photoNote}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button label="Kamera" variant="secondary" onPress={() => void takePhoto('camera')} /></View>
              <View style={{ flex: 1 }}><Button label="Galerie" variant="secondary" onPress={() => void takePhoto('library')} /></View>
            </View>
            <Text style={{ color: theme.muted, fontSize: 13 }}>Avatar</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Initialen"
                onPress={() => update((current) => {
                  const person = current.children.find((item) => item.id === editing.id);
                  if (!person) return current;
                  return saveChild(current, { ...person, avatarIcon: null, photoUri: null });
                })}
                style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: theme.text, fontWeight: '800' }}>{editing.name.slice(0, 1)}</Text>
              </Pressable>
              {AVATARS.map((icon) => (
                <Pressable
                  key={icon}
                  accessibilityRole="button"
                  accessibilityLabel={icon}
                  onPress={() => update((current) => {
                    const person = current.children.find((item) => item.id === editing.id);
                    if (!person) return current;
                    return saveChild(current, { ...person, avatarIcon: icon, photoUri: null });
                  })}
                  style={{ width: 48, height: 48, borderRadius: 12, borderWidth: editing.avatarIcon === icon ? 2 : 1, borderColor: editing.avatarIcon === icon ? editing.frameColor : theme.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialCommunityIcons name={icon as 'account'} size={26} color={editing.frameColor} />
                </Pressable>
              ))}
            </View>
            <Text style={{ color: theme.muted, fontSize: 13 }}>Farbe</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {FRAME_COLORS.map((color) => (
                <Pressable
                  key={color}
                  accessibilityRole="button"
                  onPress={() => update((current) => {
                    const person = current.children.find((item) => item.id === editing.id);
                    if (!person) return current;
                    return saveChild(current, { ...person, frameColor: color });
                  })}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color, borderWidth: editing.frameColor === color ? 3 : 0, borderColor: '#fff' }}
                />
              ))}
            </View>
            <Button label="Schließen" variant="secondary" onPress={() => setPickerFor(null)} />
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

function personAge(person: Person, now: Date): string {
  if (person.personType === 'kind') return formatAgeWeeks(person.birthDate, now);
  const years = Math.floor(ageMonths(person.birthDate, now) / 12);
  return `${years} Jahre`;
}
