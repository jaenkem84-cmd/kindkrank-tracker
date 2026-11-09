import { Pressable, StyleSheet, Text, View } from 'react-native';
import { assessDose } from '../domain/medication';
import { ageLabel, formatDateTime, formatTime, greeting, sameBerlinDay } from '../domain/dates';
import { formatCelsius, formatSince } from '../domain/format';
import { forChild } from '../domain/select';
import { temperatureBand } from '../domain/fever';
import { MEDICAL_DISCLAIMER } from '../domain/types';
import { saveSettings } from '../data/mutations';
import { deleteExampleData, keepExampleChild } from '../data/seed';
import type { DoseEntry, Medication } from '../domain/types';
import { Banner, Body, Button, Card, MicIcon, Muted } from '../components/ui';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import type { Route } from '../navigation/types';

function nextDoseLabel(medicationDoses: DoseEntry[], medication: Medication, now: Date): string {
  const assessment = assessDose({
    doses: medicationDoses,
    minIntervalHours: medication.minIntervalHours,
    maxPer24h: medication.maxDosesPer24h,
    at: now,
  });
  if (!assessment.lastDoseAt || !assessment.nextEarliest) return 'noch keine Gabe';
  if (assessment.nextEarliest.getTime() <= now.getTime()) return 'nächste Gabe jetzt möglich';
  const when = sameBerlinDay(assessment.nextEarliest, now)
    ? `um ${formatTime(assessment.nextEarliest)}`
    : `am ${formatDateTime(assessment.nextEarliest)}`;
  return `nächste Gabe frühestens ${when}`;
}

export function HomeScreen({
  now,
  onOpen,
}: {
  now: Date;
  onOpen: (route: Route) => void;
}) {
  const theme = useTheme();
  const { data, activeChild, update } = useStore();
  if (!data || !activeChild) {
    return (
      <View style={styles.empty}>
        <Body>Lege zuerst ein Kind an.</Body>
        <Button label="Kind anlegen" onPress={() => onOpen({ name: 'child-form' })} />
      </View>
    );
  }

  const temps = forChild(data.temperatures, activeChild.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = temps[0];
  const band = latest ? temperatureBand(latest.celsius) : null;
  const meds = forChild(data.medications, activeChild.id);
  const doses = forChild(data.doses, activeChild.id);

  return (
    <View style={styles.wrap}>
      {activeChild.isExample ? (
        <Banner>
          {activeChild.name} ist ein Beispiel (geboren 15.01.2025) und kann gelöscht werden. Die zugehörigen
          Messungen und Gaben sind ebenfalls Beispiele.
        </Banner>
      ) : null}
      {activeChild.isExample ? (
        <View style={styles.row}>
          <Button compact label="Beispiel löschen" variant="danger" onPress={() => update(deleteExampleData)} />
          <Button compact label="Beispiel behalten" variant="secondary" onPress={() => update((current) => keepExampleChild(current, activeChild.id))} />
        </View>
      ) : null}

      <View>
        <Text style={[styles.hello, { color: theme.muted }]}>{greeting(now)}</Text>
        <Text style={[styles.name, { color: theme.text }]}>
          {activeChild.name}
          <Text style={{ color: theme.muted, fontSize: 18 }}>{`  ·  ${ageLabel(activeChild.birthDate, now)}`}</Text>
        </Text>
      </View>

      {data.children.length > 1 ? (
        <View style={styles.row}>
          {data.children.map((child) => {
            const selected = child.id === activeChild.id;
            return (
              <Pressable
                key={child.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => update((current) => saveSettings(current, { ...current.settings, activeChildId: child.id }))}
                style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.card, borderColor: theme.border }]}
              >
                <Text style={{ color: selected ? theme.onAccent : theme.text, fontSize: 16, fontWeight: '700' }}>{child.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Spracheingabe starten"
        onPress={() => onOpen({ name: 'voice', autoStart: true })}
        style={[styles.mic, { backgroundColor: theme.accent }]}
      >
        <MicIcon color={theme.onAccent} />
        <Text style={[styles.micLabel, { color: theme.onAccent }]}>Spracheingabe</Text>
      </Pressable>

      <Card>
        <Muted>Letzte Temperatur</Muted>
        {latest && band ? (
          <>
            <Text style={[styles.temp, { color: theme.text }]}>{formatCelsius(latest.celsius)}</Text>
            <Body>
              {formatDateTime(new Date(latest.timestamp))} · {latest.method}
            </Body>
            <Muted>{band.label} · nur Orientierung, keine Diagnose</Muted>
          </>
        ) : (
          <Body>Noch keine Messung.</Body>
        )}
        <Button label="Temperatur eintragen" onPress={() => onOpen({ name: 'temp-form' })} />
      </Card>

      {meds.map((medication) => {
        const own = doses.filter((dose) => dose.medicationId === medication.id);
        const assessment = assessDose({
          doses: own,
          minIntervalHours: medication.minIntervalHours,
          maxPer24h: medication.maxDosesPer24h,
          at: now,
        });
        return (
          <Card key={medication.id}>
            <Text style={[styles.medName, { color: theme.text }]}>{medication.name}</Text>
            <Muted>eingetragene Dosis: {medication.doseText}</Muted>
            <Body>
              {assessment.lastDoseAt
                ? `letzte Gabe ${formatDateTime(new Date(assessment.lastDoseAt))}${assessment.hoursSince !== null ? ` · ${formatSince(assessment.hoursSince)}` : ''}`
                : 'letzte Gabe: noch keine'}
            </Body>
            <Body>{nextDoseLabel(own, medication, now)}</Body>
            <Body>{`Heute: ${assessment.countToday} · letzte 24h: ${assessment.count24h} von ${medication.maxDosesPer24h}`}</Body>
            <Button label="Gabe eintragen" onPress={() => onOpen({ name: 'dose-form', medicationId: medication.id })} />
          </Card>
        );
      })}

      <View style={styles.row}>
        <Button compact label="Gewicht" variant="secondary" onPress={() => onOpen({ name: 'growth-form' })} />
        <Button compact label="Medikament" variant="secondary" onPress={() => onOpen({ name: 'med-form' })} />
      </View>
      <Muted>{MEDICAL_DISCLAIMER}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  empty: { gap: 16 },
  hello: { fontSize: 16 },
  name: { fontSize: 28, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  mic: { minHeight: 96, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  micLabel: { fontSize: 22, fontWeight: '800' },
  temp: { fontSize: 48, fontWeight: '700' },
  medName: { fontSize: 20, fontWeight: '700' },
});
