import { Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, CategoryIcon, IconButton, MenuIcon } from '../components/chrome';
import { MicIcon } from '../components/ui';
import { ageMonths, formatAgeWeeks, formatDayHeading, formatTime, sameBerlinDay } from '../domain/dates';
import { formatDecimal } from '../domain/format';
import { forChild } from '../domain/select';
import type { Person } from '../domain/types';
import type { CategoryName } from '../navigation/types';
import { setActivePerson } from '../data/mutations';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

const CATEGORIES: { id: CategoryName; label: string }[] = [
  { id: 'temperature', label: 'Temperatur' },
  { id: 'medication', label: 'Medikation' },
  { id: 'vaccination', label: 'Impfung' },
  { id: 'symptom', label: 'Symptome' },
  { id: 'weight', label: 'Gewicht' },
  { id: 'height', label: 'Größe' },
  { id: 'head', label: 'Kopfumfang' },
];

export function HomeScreen({
  now,
  day,
  onShiftDay,
  onMenu,
  onFamily,
  onVoice,
  onCategory,
}: {
  now: Date;
  day: Date;
  onShiftDay: (delta: number) => void;
  onMenu: () => void;
  onFamily: () => void;
  onVoice: () => void;
  onCategory: (name: CategoryName) => void;
}) {
  const theme = useTheme();
  const { data, activeChild, update } = useStore();
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
  const temps = forChild(data.temperatures, activeChild.id).filter((entry) => sameBerlinDay(new Date(entry.timestamp), day));
  const doses = forChild(data.doses, activeChild.id).filter((entry) => sameBerlinDay(new Date(entry.timestamp), day));
  const weights = forChild(data.growth, activeChild.id).filter(
    (entry) => entry.weightKg !== undefined && sameBerlinDay(new Date(entry.timestamp), day),
  );
  const today = sameBerlinDay(day, now);
  const empty = temps.length + doses.length + weights.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 8, paddingTop: 4, flexDirection: 'row', alignItems: 'center' }}>
        <IconButton label="Menü" onPress={onMenu}>
          <MenuIcon color={theme.text} />
        </IconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 20, lineHeight: 26, fontWeight: '700' }}>Familien-Gesundheit</Text>
          <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>{activeChild.name} · {personAge(activeChild, now)}</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: 84 }}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: 'center' }}
      >
        {data.children.map((person) => {
          const selected = person.id === activeChild.id;
          return (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={person.name}
              accessibilityState={{ selected }}
              onPress={() => update((current) => setActivePerson(current, person.id))}
              style={{
                width: 104,
                height: 72,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                backgroundColor: theme.card,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? person.frameColor : theme.border,
              }}
            >
              <Avatar name={person.name} color={person.frameColor} size={28} />
              <Text style={{ color: theme.text, fontSize: 13, lineHeight: 16, fontWeight: '700' }} numberOfLines={1}>
                {person.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, minHeight: 48 }}>
        <IconButton label="Vorheriger Tag" onPress={() => onShiftDay(-1)}>
          <Text style={{ color: theme.text, fontSize: 22 }}>‹</Text>
        </IconButton>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{formatDayHeading(day)}</Text>
        <IconButton label="Nächster Tag" onPress={() => onShiftDay(1)}>
          <Text style={{ color: today ? theme.muted : theme.text, fontSize: 22 }}>›</Text>
        </IconButton>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
        {empty ? (
          <View style={{ alignItems: 'center', paddingVertical: 36, gap: 8 }}>
            <Text style={{ color: theme.muted, fontSize: 17, textAlign: 'center' }}>
              {today ? 'Jetzt Einträge für heute hinzufügen' : 'Keine Einträge an diesem Tag.'}
            </Text>
            <Text style={{ color: theme.muted, fontSize: 22 }}>↓</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {temps.map((entry) => (
              <Pressable key={entry.id} onPress={() => onCategory('temperature')} style={{ padding: 12, borderRadius: 12, backgroundColor: theme.card }}>
                <Text style={{ color: theme.text, fontSize: 16 }}>{formatTime(new Date(entry.timestamp))} · {formatDecimal(entry.celsius, 1)} °C</Text>
              </Pressable>
            ))}
            {doses.map((entry) => {
              const medication = data.medications.find((item) => item.id === entry.medicationId);
              return (
                <Pressable key={entry.id} onPress={() => onCategory('medication')} style={{ padding: 12, borderRadius: 12, backgroundColor: theme.card }}>
                  <Text style={{ color: theme.text, fontSize: 16 }}>
                    {formatTime(new Date(entry.timestamp))} · {medication?.name ?? 'Medikament'} {entry.doseText}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {activeChild.isExample ? (
          <Text style={{ color: theme.muted, fontSize: 13 }}>Beispieldaten. In den Einstellungen löschen.</Text>
        ) : null}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Spracheingabe"
        onPress={onVoice}
        style={{ marginHorizontal: 16, marginBottom: 8, minHeight: 64, borderRadius: 18, backgroundColor: theme.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
      >
        <MicIcon color={theme.onAccent} size={28} />
        <Text style={{ color: theme.onAccent, fontSize: 18, fontWeight: '800' }}>Spracheingabe</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', paddingHorizontal: 4, paddingBottom: 6 }}>
        {CATEGORIES.filter((category) => activeChild.personType === 'kind' || category.id !== 'head').map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={category.label}
            onPress={() => onCategory(category.id)}
            style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 2 }}
          >
            <CategoryIcon name={category.id} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 10, lineHeight: 12, textAlign: 'center' }} numberOfLines={2}>
              {category.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function personAge(person: Person, now: Date): string {
  if (person.personType === 'kind') return formatAgeWeeks(person.birthDate, now);
  const years = Math.floor(ageMonths(person.birthDate, now) / 12);
  return `${years} Jahre`;
}
