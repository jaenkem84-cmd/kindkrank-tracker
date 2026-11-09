import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Banner, Body, Button, Card, ConfirmDialog, Muted, Screen, Segmented, TextField } from '../components/ui';
import { birthDateToIso, isoDateToGerman, parseGermanDate } from '../domain/dates';
import { createId } from '../domain/ids';
import { forChild } from '../domain/select';
import {
  MEASUREMENT_METHODS,
  METHOD_LABELS,
  MEDICAL_DISCLAIMER,
  type Appearance,
  type Child,
  type MeasurementMethod,
} from '../domain/types';
import { localFamilyDirectory } from '../data/sync';
import { removeChild, saveChild, saveSettings } from '../data/mutations';
import { deleteExampleData } from '../data/seed';
import { shareAllData } from '../export/shareCsv';
import type { Route } from '../navigation/types';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

export function SettingsScreen({ onOpen }: { onOpen: (route: Route) => void }) {
  const theme = useTheme();
  const { data, activeChild, update, loadError } = useStore();
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [familyNote, setFamilyNote] = useState<string | null>(null);
  if (!data) return <Body>{loadError ?? 'Keine Daten.'}</Body>;
  const snapshot = data;

  const meds = activeChild ? forChild(snapshot.medications, activeChild.id) : [];

  async function exportData() {
    setExportError(null);
    setExportNote(null);
    try {
      await shareAllData(snapshot);
      setExportNote('Die ZIP-Datei enthält alle Kinder, Temperaturen, Medikamente, Gaben und Wachstumswerte.');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export ist fehlgeschlagen.');
    }
  }

  return (
    <View style={{ gap: 14 }}>
      {loadError ? <Banner tone="danger">{loadError}</Banner> : null}
      <Card>
        <Body>Diagramm-Zeitraum</Body>
        <Muted>Die Fieberkurve zeigt die aktuelle Krankheitsphase, höchstens so viele Wochen.</Muted>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Button
            compact
            label="−"
            variant="secondary"
            onPress={() =>
              update((current) =>
                saveSettings(current, {
                  ...current.settings,
                  chartWindowWeeks: Math.max(1, current.settings.chartWindowWeeks - 1),
                }),
              )
            }
          />
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700', minWidth: 110 }}>
            {snapshot.settings.chartWindowWeeks} {snapshot.settings.chartWindowWeeks === 1 ? 'Woche' : 'Wochen'}
          </Text>
          <Button
            compact
            label="+"
            variant="secondary"
            onPress={() =>
              update((current) =>
                saveSettings(current, {
                  ...current.settings,
                  chartWindowWeeks: Math.min(12, current.settings.chartWindowWeeks + 1),
                }),
              )
            }
          />
        </View>
      </Card>

      <Segmented
        label="Standard-Messart"
        value={snapshot.settings.defaultMethod}
        options={MEASUREMENT_METHODS.map((method) => ({ value: method, label: METHOD_LABELS[method] }))}
        onChange={(defaultMethod: MeasurementMethod) =>
          update((current) => saveSettings(current, { ...current.settings, defaultMethod }))
        }
      />
      <TextField
        label="Standard für „gegeben von“"
        value={snapshot.settings.defaultGivenBy}
        onChangeText={(defaultGivenBy) => update((current) => saveSettings(current, { ...current.settings, defaultGivenBy }))}
        placeholder="z. B. Mama"
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

      <Body>Kinder</Body>
      {snapshot.children.map((child) => (
        <Pressable key={child.id} accessibilityRole="button" onPress={() => onOpen({ name: 'child-form', childId: child.id })}>
          <Card>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
              {child.name}
              {child.isExample ? ' · Beispiel' : ''}
            </Text>
            <Muted>geboren {isoDateToGerman(child.birthDate)}</Muted>
          </Card>
        </Pressable>
      ))}
      <Button label="Kind anlegen" onPress={() => onOpen({ name: 'child-form' })} />

      <Body>Medikamente{activeChild ? ` von ${activeChild.name}` : ''}</Body>
      {meds.map((medication) => (
        <Pressable key={medication.id} accessibilityRole="button" onPress={() => onOpen({ name: 'med-form', medicationId: medication.id })}>
          <Card>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{medication.name}</Text>
            <Muted>{medication.doseText}</Muted>
          </Card>
        </Pressable>
      ))}
      <Button label="Medikament anlegen" variant="secondary" onPress={() => onOpen({ name: 'med-form' })} />

      <Card>
        <Body>Alle Daten exportieren</Body>
        <Muted>Eine ZIP-Datei mit einer CSV pro Tabelle. Semikolon und UTF-8, damit Excel in Deutschland sie öffnet. Ohne Zeitfilter.</Muted>
        <Button label="CSV exportieren" onPress={() => void exportData()} />
        {exportNote ? <Banner tone="ok">{exportNote}</Banner> : null}
        {exportError ? <Banner tone="danger">{exportError}</Banner> : null}
      </Card>

      <Card>
        <Body>Familie</Body>
        <Muted>
          Die Daten liegen auf diesem Gerät. Ein Konto ist nicht nötig. Ein gemeinsamer Zugriff per Einladungslink ist
          vorbereitet, aber noch nicht verbunden.
        </Muted>
        <Button
          label="Einladungslink"
          variant="secondary"
          onPress={() => {
            void localFamilyDirectory.createInvite().then((result) => {
              setFamilyNote(result.ok ? result.url : result.reason);
            });
          }}
        />
        {familyNote ? <Muted>{familyNote}</Muted> : null}
      </Card>

      {snapshot.children.some((child) => child.isExample) ? (
        <Button label="Alle Beispieldaten löschen" variant="danger" onPress={() => update(deleteExampleData)} />
      ) : null}
      <Muted>{MEDICAL_DISCLAIMER}</Muted>
      <Muted>Kindkrank-Tracker {Constants.expoConfig?.version ?? '1.0.0'}</Muted>
    </View>
  );
}

export function ChildForm({ childId, onDone }: { childId?: string; onDone: () => void }) {
  const { data, update } = useStore();
  const existing = data?.children.find((child) => child.id === childId);
  const [name, setName] = useState(existing?.name ?? '');
  const [birth, setBirth] = useState(existing ? isoDateToGerman(existing.birthDate) : '');
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
      isExample: existing?.isExample ?? false,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    update((current) => saveChild(current, child));
    onDone();
  }

  return (
    <Screen
      title={existing ? 'Kind ändern' : 'Kind'}
      onBack={onDone}
      footer={
        <>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button label="Speichern" onPress={save} />
          {existing ? <Button label="Kind löschen" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
        </>
      }
      dialog={
        <ConfirmDialog
          visible={confirmDelete}
          title="Kind löschen?"
          message="Temperaturen, Medikamente, Gaben und Wachstum dieses Kindes werden mit gelöscht."
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
      {existing?.isExample ? <Banner>Das ist der Beispieldatensatz Anna.</Banner> : null}
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Name" />
      <TextField label="Geburtsdatum" value={birth} onChangeText={setBirth} placeholder="TT.MM.JJJJ" />
    </Screen>
  );
}
