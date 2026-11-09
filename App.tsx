import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './src/components/ui';
import { isVoiceLink } from './src/navigation/linking';
import type { Route, TabName } from './src/navigation/types';
import { GrowthForm, GrowthScreen } from './src/screens/GrowthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { DoseForm, MedicationForm, MedicationScreen } from './src/screens/MedicationScreen';
import { ChildForm, SettingsScreen } from './src/screens/SettingsScreen';
import { TemperatureForm, TemperatureScreen } from './src/screens/TemperatureScreen';
import { VoiceScreen } from './src/screens/VoiceScreen';
import { StoreProvider, useStore } from './src/state/store';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

const TABS: { id: TabName; label: string }[] = [
  { id: 'home', label: 'Start' },
  { id: 'fever', label: 'Fieber' },
  { id: 'meds', label: 'Gaben' },
  { id: 'growth', label: 'Wachstum' },
  { id: 'settings', label: 'Mehr' },
];

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
  const [tab, setTab] = useState<TabName>('home');
  const [stack, setStack] = useState<Route[]>([]);
  const route = stack[stack.length - 1];

  useEffect(() => {
    const open = () => setStack([{ name: 'voice', autoStart: true }]);
    void Linking.getInitialURL().then((url) => {
      if (isVoiceLink(url)) open();
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isVoiceLink(url)) open();
    });
    return () => subscription.remove();
  }, []);

  function push(next: Route) {
    setStack((current) => [...current, next]);
  }
  function pop() {
    setStack((current) => current.slice(0, -1));
  }

  if (route) return <RouteScreen route={route} onDone={pop} />;

  const title = tab === 'home' ? 'Kindkrank' : TABS.find((item) => item.id === tab)?.label ?? '';

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {tab === 'fever' ? <Button label="Temperatur eintragen" onPress={() => push({ name: 'temp-form' })} /> : null}
        {tab === 'meds' ? <Button label="Medikament anlegen" onPress={() => push({ name: 'med-form' })} /> : null}
        {tab === 'growth' ? <Button label="Messung eintragen" onPress={() => push({ name: 'growth-form' })} /> : null}
        {tab === 'home' ? <HomeScreen now={now} onOpen={push} /> : null}
        {tab === 'fever' ? <TemperatureScreen now={now} onEdit={(entryId) => push({ name: 'temp-form', entryId })} /> : null}
        {tab === 'meds' ? (
          <MedicationScreen
            now={now}
            onDose={(medicationId) => push({ name: 'dose-form', medicationId })}
            onEdit={(medicationId) => push({ name: 'med-form', medicationId })}
          />
        ) : null}
        {tab === 'growth' ? <GrowthScreen onEdit={(entryId) => push({ name: 'growth-form', entryId })} /> : null}
        {tab === 'settings' ? <SettingsScreen onOpen={push} /> : null}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={[styles.tabs, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setTab(item.id)}
              style={styles.tab}
            >
              <Text style={{ color: selected ? theme.accent : theme.muted, fontSize: 13, fontWeight: '700' }}>{item.label}</Text>
            </Pressable>
          );
        })}
      </SafeAreaView>
    </SafeAreaView>
  );
}

function RouteScreen({ route, onDone }: { route: Route; onDone: () => void }) {
  switch (route.name) {
    case 'voice':
      return <VoiceScreen autoStart={route.autoStart} onDone={onDone} />;
    case 'child-form':
      return <ChildForm childId={route.childId} onDone={onDone} />;
    case 'temp-form':
      return <TemperatureForm entryId={route.entryId} onDone={onDone} />;
    case 'med-form':
      return <MedicationForm medicationId={route.medicationId} prefillName={route.prefillName} onDone={onDone} />;
    case 'dose-form':
      return <DoseForm medicationId={route.medicationId} entryId={route.entryId} onDone={onDone} />;
    case 'growth-form':
      return <GrowthForm entryId={route.entryId} onDone={onDone} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  content: { padding: 20, gap: 14, paddingBottom: 24 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center' },
});
