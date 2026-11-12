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
  onProfile,
  onVoice,
  onCategory,
}: {
  now: Date;
  day: Date;
  onShiftDay: (delta: number) => void;
  onMenu: () => void;
  onProfile: () => void;
  onVoice: () => void;
  onCategory: (name: CategoryName) => void;
}) {
  const theme = useTheme();
  const { data, activeChild, update } = useStore();
  if (!data || !activeChild) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12 }}>
        <Text style={{ color: theme.text, fontSize: 22 }}>Noch keine Person.</Text>
        <Pressable onPress={onProfile} style={{ minHeight: 56, borderRadius: 16, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.onAccent, fontSize: 17, fontWeight: '700' }}>Person anlegen</Text>
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
  const chips = [
    { label: 'Temperatur', count: temps.length, category: 'temperature' as const },
    { label: 'Medikation', count: doses.length, category: 'medication' as const },
    { label: 'Gewicht', count: weights.length, category: 'weight' as const },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 8, paddingTop: 4, flexDirection: 'row', alignItems: 'center' }}>
        <IconButton label="Menü" onPress={onMenu}>
          <MenuIcon color={theme.text} />
        </IconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>Familien-Gesundheit</Text>
          <Text style={{ color: theme.muted, fontSize: 14 }}>{activeChild.name} · {personAge(activeChild, now)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Profil" onPress={onProfile}>
          <Avatar name={activeChild.name} color={activeChild.frameColor} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: 4 }}>
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
                minWidth: 92,
                borderRadius: 16,
                paddingVertical: 8,
                paddingHorizontal: 8,
                alignItems: 'center',
                gap: 4,
                backgroundColor: theme.card,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? person.frameColor : theme.border,
              }}
            >
              <Avatar name={person.name} color={person.frameColor} size={36} />
              <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>{person.name}</Text>
              <Text style={{ color: theme.muted, fontSize: 11 }}>{person.personType === 'kind' ? 'Kind' : 'Erwachsener'}</Text>
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
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {chips.map((chip) => (
            <Pressable
              key={chip.label}
              accessibilityRole="button"
              onPress={() => onCategory(chip.category)}
              style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingVertical: 12, alignItems: 'center', backgroundColor: theme.card }}
            >
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>×{chip.count}</Text>
              <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center' }}>{chip.label}</Text>
            </Pressable>
          ))}
        </View>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, gap: 4, paddingBottom: 8 }}>
        {CATEGORIES.filter((category) => activeChild.personType === 'kind' || category.id !== 'head').map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={category.label}
            onPress={() => onCategory(category.id)}
            style={{ width: 64, minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 2 }}
          >
            <CategoryIcon name={category.id} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 10, lineHeight: 12, textAlign: 'center', width: 64 }}>{category.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function personAge(person: Person, now: Date): string {
  if (person.personType === 'kind') return formatAgeWeeks(person.birthDate, now);
  const years = Math.floor(ageMonths(person.birthDate, now) / 12);
  return `${years} Jahre`;
}
