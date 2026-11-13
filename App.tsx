import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from './src/components/chrome';
import { inviteTokenFromUrl, isVoiceLink } from './src/navigation/linking';
import type { CategoryName, Route } from './src/navigation/types';
import { shiftBerlinDays, sameBerlinDay } from './src/domain/dates';
import { syncReminders } from './src/notifications/reminders';
import { Screen } from './src/components/ui';
import { GrowthScreen, GrowthForm } from './src/screens/GrowthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { DoseForm, MedicationForm, MedicationScreen } from './src/screens/MedicationScreen';
import { ExportScreen, FamilyScreen, InviteAcceptScreen, ProfileScreen, SettingsScreen } from './src/screens/SettingsScreen';
import { SymptomScreen } from './src/screens/SymptomScreen';
import { TemperatureForm, TemperatureScreen } from './src/screens/TemperatureScreen';
import { VaccinationForm, VaccinationScreen } from './src/screens/VaccinationScreen';
import { VoiceScreen } from './src/screens/VoiceScreen';
import { StoreProvider, useStore } from './src/state/store';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import type { GrowthMetric } from './src/domain/who/who';

const CATEGORY_TITLE: Record<CategoryName, string> = {
  temperature: 'Temperatur',
  medication: 'Medikation',
  vaccination: 'Impfung',
  symptom: 'Symptome',
  weight: 'Gewicht',
  height: 'Größe',
  head: 'Kopfumfang',
};

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { ready, data, loadError } = useStore();
  useEffect(() => {
    if (data) void syncReminders(data);
  }, [data]);
  return (
    <ThemeProvider appearance={data?.settings.appearance ?? 'system'}>
      <StatusBar style="auto" />
      {ready && data ? <Shell /> : <Loading message={loadError ?? 'Wird geladen …'} />}
    </ThemeProvider>
  );
}

function Loading({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: theme.bg }]}>
      <Text style={{ color: theme.text, fontSize: 18 }}>{message}</Text>
    </SafeAreaView>
  );
}

function Shell() {
  const theme = useTheme();
  const now = useNow();
  const { data } = useStore();
  const [day, setDay] = useState(() => new Date());
  const [stack, setStack] = useState<Route[]>([]);
  const [drawer, setDrawer] = useState(false);
  const route = stack[stack.length - 1];
  const self = data?.children.find((person) => person.isSelf) ?? data?.children.find((person) => person.isAdmin);

  useEffect(() => {
    const open = (url: string | null) => {
      const token = inviteTokenFromUrl(url);
      if (token) {
        setStack([{ name: 'invite', token }]);
        return;
      }
      if (isVoiceLink(url)) setStack([{ name: 'voice', autoStart: true }]);
    };
    void Linking.getInitialURL().then(open);
    const subscription = Linking.addEventListener('url', ({ url }) => open(url));
    return () => subscription.remove();
  }, []);

  function push(next: Route) {
    setDrawer(false);
    setStack((current) => [...current, next]);
  }
  function pop() {
    setStack((current) => current.slice(0, -1));
  }

  const ownChrome = Boolean(route && !isCategory(route.name));
  const body = route ? (
    <RouteScreen route={route} now={now} onDone={pop} onPush={push} />
  ) : (
    <HomeScreen
      now={now}
      day={day}
      onShiftDay={(delta) => {
        setDay((current) => {
          const next = shiftBerlinDays(current, delta);
          if (delta > 0 && sameBerlinDay(current, now)) return current;
          if (next.getTime() > now.getTime() && !sameBerlinDay(next, now)) return current;
          return next;
        });
      }}
      onMenu={() => setDrawer(true)}
      onFamily={() => push({ name: 'family' })}
      onVoice={() => push({ name: 'voice', autoStart: true })}
      onCategory={(name) => push({ name })}
    />
  );

  if (ownChrome) {
    return <View style={[styles.fill, { backgroundColor: theme.bg }]}>{body}</View>;
  }

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      {route && isCategory(route.name) ? (
        <View style={[styles.categoryHeader, { backgroundColor: theme.bg }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zurück" onPress={pop} style={styles.back}>
            <Text style={{ color: theme.accent, fontSize: 16, lineHeight: 22, fontWeight: '700' }}>Zurück</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 26, lineHeight: 32, fontWeight: '700' }}>{CATEGORY_TITLE[route.name]}</Text>
        </View>
      ) : null}
      {route && isOwnLayout(route.name) ? (
        <View style={styles.fill}>{body}</View>
      ) : route && isCategory(route.name) ? (
        <ScrollView contentContainerStyle={styles.categoryBody} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {drawer ? (
        <Pressable style={styles.backdrop} onPress={() => setDrawer(false)}>
          <Pressable style={[styles.drawer, { backgroundColor: theme.card }]} onPress={() => undefined}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 28 }}>
              <Avatar name={self?.name ?? '?'} color={self?.frameColor ?? theme.accent} size={48} />
              <View>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{self?.name ?? 'Familie'}</Text>
                <Text style={{ color: theme.muted, fontSize: 14 }}>{self?.isAdmin ? 'Admin' : 'Familien-Gesundheit'}</Text>
              </View>
            </View>
            <DrawerItem label="Familie" onPress={() => push({ name: 'family' })} />
            <DrawerItem label="Export" onPress={() => push({ name: 'export' })} />
            <DrawerItem label="Einstellungen" onPress={() => push({ name: 'settings' })} />
          </Pressable>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function DrawerItem({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 52, justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}

function isOwnLayout(name: string): boolean {
  return name === 'temperature' || name === 'medication' || name === 'vaccination' || name === 'symptom' || name === 'weight' || name === 'height' || name === 'head';
}

function isCategory(name: string): name is CategoryName {
  return (
    name === 'temperature' ||
    name === 'medication' ||
    name === 'vaccination' ||
    name === 'symptom' ||
    name === 'weight' ||
    name === 'height' ||
    name === 'head'
  );
}

function RouteScreen({
  route,
  now,
  onDone,
  onPush,
}: {
  route: Route;
  now: Date;
  onDone: () => void;
  onPush: (route: Route) => void;
}) {
  if (route.name === 'temperature') {
    return <TemperatureScreen now={now} onAdd={() => onPush({ name: 'temp-form' })} onEdit={(entryId) => onPush({ name: 'temp-form', entryId })} />;
  }
  if (route.name === 'medication') {
    return (
      <MedicationScreen
        now={now}
        onAdd={() => onPush({ name: 'med-form' })}
        onEdit={(medicationId) => onPush({ name: 'med-form', medicationId })}
        onDose={(medicationId) => onPush({ name: 'dose-form', medicationId })}
      />
    );
  }
  if (route.name === 'vaccination') {
    return <VaccinationScreen now={now} onAdd={(productId) => onPush({ name: 'vaccination-form', productId })} />;
  }
  if (route.name === 'symptom') return <SymptomScreen now={now} />;
  if (route.name === 'weight' || route.name === 'height' || route.name === 'head') {
    const metric: GrowthMetric = route.name === 'weight' ? 'weight' : route.name === 'height' ? 'height' : 'head';
    return <GrowthScreen metric={metric} onAdd={() => onPush({ name: 'growth-form', metric })} onEdit={(entryId) => onPush({ name: 'growth-form', entryId, metric })} />;
  }
  if (route.name === 'voice') return <VoiceScreen autoStart={route.autoStart} onDone={onDone} />;
  if (route.name === 'profile') return <ProfileScreen childId={route.childId} onDone={onDone} />;
  if (route.name === 'settings') {
    return (
      <Screen title="Einstellungen" onBack={onDone}>
        <SettingsScreen />
      </Screen>
    );
  }
  if (route.name === 'family') {
    return (
      <Screen title="Familie" onBack={onDone}>
        <FamilyScreen onEdit={(childId) => onPush({ name: 'profile', childId })} onAdd={() => onPush({ name: 'profile' })} />
      </Screen>
    );
  }
  if (route.name === 'export') {
    return (
      <Screen title="Export" onBack={onDone}>
        <ExportScreen />
      </Screen>
    );
  }
  if (route.name === 'temp-form') return <TemperatureForm entryId={route.entryId} onDone={onDone} />;
  if (route.name === 'med-form') return <MedicationForm medicationId={route.medicationId} prefillName={route.prefillName} onDone={onDone} />;
  if (route.name === 'dose-form') return <DoseForm medicationId={route.medicationId} entryId={route.entryId} onDone={onDone} />;
  if (route.name === 'growth-form') return <GrowthForm entryId={route.entryId} onDone={onDone} />;
  if (route.name === 'vaccination-form') return <VaccinationForm productId={route.productId} onDone={onDone} />;
  if (route.name === 'invite') return <InviteAcceptScreen token={route.token} onDone={onDone} />;
  return null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  categoryHeader: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8 },
  back: { minHeight: 40, justifyContent: 'center' },
  categoryBody: { padding: 16, gap: 12, paddingBottom: 32 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row' },
  drawer: { width: '78%', maxWidth: 340, padding: 22, paddingTop: 28 },
});
