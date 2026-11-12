import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Banner, Body, Button, Card, ConfirmDialog, DateTimeFields, Muted, Screen, TextField } from '../components/ui';
import { combineBerlin, dateFieldValue, formatDate, formatDateTime, isoDateToGerman, timeFieldValue } from '../domain/dates';
import { createId } from '../domain/ids';
import { forChild } from '../domain/select';
import { ANTIGEN_LABELS, VACCINE_PRODUCTS, productById, type AntigenId } from '../domain/vaccines/products';
import { matchVaccineLabel } from '../domain/vaccines/matcher';
import { ADULT_STIKO_SOURCE, adultVaccinationStatus } from '../domain/vaccines/adultStiko';
import { STATUS_LABEL, STIKO_SOURCE, vaccinationStatus } from '../domain/vaccines/stiko';
import type { VaccinationEntry } from '../domain/types';
import { removeVaccination, saveVaccination } from '../data/mutations';
import { sharePlainText } from '../export/shareText';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';

const ANTIGENS = Object.keys(ANTIGEN_LABELS) as AntigenId[];

export function VaccinationScreen({ now, onAdd }: { now: Date; onAdd: (productId?: string) => void }) {
  const theme = useTheme();
  const { data, activeChild, update } = useStore();
  const [scanOpen, setScanOpen] = useState(false);
  if (!data || !activeChild) return <Body>Lege zuerst eine Person an.</Body>;
  const adult = activeChild.personType === 'erwachsen';
  const entries = forChild(data.vaccinations, activeChild.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const ownDoses = data.vaccinations.filter((entry) => entry.childId === activeChild.id);
  const status = adult ? adultVaccinationStatus(activeChild.birthDate, ownDoses, now) : vaccinationStatus(activeChild.birthDate, ownDoses, now);
  const source = adult ? ADULT_STIKO_SOURCE : STIKO_SOURCE;
  const sexLabel = adult
    ? activeChild.sex === 'junge'
      ? 'männlich'
      : 'weiblich'
    : activeChild.sex === 'maedchen'
      ? 'Mädchen'
      : 'Junge';
  const doctorText = buildDoctorText(activeChild.name, activeChild.birthDate, sexLabel, entries, status, now);

  return (
    <View style={{ gap: 14 }}>
      <Banner tone="info">
        {adult
          ? 'Orientierung nach STIKO für Erwachsene. Quelle bitte prüfen. Keine ärztliche Beurteilung.'
          : 'Orientierung nach STIKO, keine ärztliche Beurteilung. Bitte mit Kinderarzt abklären.'}
      </Banner>
      <Button label="Impfung eintragen" onPress={onAdd} />
      <Button label="Impfpass fotografieren" variant="secondary" onPress={() => setScanOpen(true)} />
      {scanOpen ? (
        <PassportScan
          onClose={() => setScanOpen(false)}
          onUse={(productId) => {
            setScanOpen(false);
            onAdd(productId);
          }}
        />
      ) : null}
      <Body>Impfstatus nach STIKO</Body>
      {status.map((row) => (
        <View key={row.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>{row.label}</Text>
          <Text style={{ color: theme.muted, fontSize: 14 }}>{row.detail}</Text>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700', width: 118, textAlign: 'right' }}>{STATUS_LABEL[row.status]}</Text>
        </View>
      ))}
      <Card>
        <Body>Für den Arzt</Body>
        <Text style={{ color: theme.text, fontSize: 14, lineHeight: 20 }}>{doctorText}</Text>
        <Button label="Zusammenfassung teilen" onPress={() => void sharePlainText('impfstatus.txt', doctorText)} />
      </Card>
      <Body>Gegebene Impfungen</Body>
      {entries.length === 0 ? <Muted>Noch nichts eingetragen.</Muted> : null}
      {entries.map((entry) => (
        <Card key={entry.id}>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{entry.productName || 'Ohne Handelsname'}</Text>
          <Body>{formatDate(new Date(entry.timestamp))}{entry.batch ? ` · Charge ${entry.batch}` : ''}</Body>
          <Muted>{entry.antigens.map((id) => ANTIGEN_LABELS[id as AntigenId] ?? id).join(', ')}</Muted>
          {entry.doctor ? <Muted>{entry.doctor}</Muted> : null}
          {entry.isExample ? <Muted>Beispieldaten</Muted> : null}
          <Button compact label="Löschen" variant="danger" onPress={() => update((current) => removeVaccination(current, entry.id))} />
        </Card>
      ))}
      <Muted>{source}</Muted>
    </View>
  );
}

function PassportScan({ onClose, onUse }: { onClose: () => void; onUse: (productId: string) => void }) {
  const [labelText, setLabelText] = useState('');
  const [hint, setHint] = useState('Im Browser und in Expo Go gibt es keine Texterkennung. Foto wählen oder den Etikettentext eintippen. Echtes OCR braucht einen Entwicklungs-Build mit ML Kit.');
  const matches = matchVaccineLabel(labelText);

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setHint('Kein Zugriff auf Fotos. Den Etikettentext kannst du unten eintippen.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled) return;
    const recognized = await recognizeLabel(result.assets[0]?.uri);
    if (recognized) setLabelText(recognized);
    else setHint('Foto ist da, der Text aber nicht lesbar. Tipp den Handelsnamen vom Etikett ab, zum Beispiel Hexyon.');
  }

  return (
    <Card>
      <Body>Impfpass fotografieren</Body>
      <Muted>{hint}</Muted>
      <Button label="Foto wählen" variant="secondary" onPress={() => void pick()} />
      <TextField label="Text vom Etikett" value={labelText} onChangeText={setLabelText} placeholder="Hexyon" />
      {matches.map((match) => (
        <Button key={match.product.id} label={`${match.product.name} übernehmen`} onPress={() => onUse(match.product.id)} />
      ))}
      <Button label="Schließen" variant="ghost" onPress={onClose} />
    </Card>
  );
}

async function recognizeLabel(uri: string | undefined): Promise<string | null> {
  if (!uri) return null;
  try {
    const dynamicRequire = Function('return typeof require === "function" ? require : null;')() as
      | ((id: string) => { recognize?: (path: string) => Promise<{ text?: string }> })
      | null;
    const native = dynamicRequire?.('@react-native-ml-kit/text-recognition');
    const result = await native?.recognize?.(uri);
    return result?.text?.trim() || null;
  } catch {
    return null;
  }
}

export function VaccinationForm({ productId: initialProductId, onDone }: { productId?: string; onDone: () => void }) {
  const presetProduct = productById(initialProductId ?? null);
  const { data, activeChild, update } = useStore();
  const [query, setQuery] = useState(presetProduct?.name ?? '');
  const [productId, setProductId] = useState<string | null>(presetProduct?.id ?? null);
  const [antigens, setAntigens] = useState<AntigenId[]>([...(presetProduct?.antigens ?? [])]);
  const [date, setDate] = useState(dateFieldValue(new Date()));
  const [time, setTime] = useState(timeFieldValue(new Date()));
  const [batch, setBatch] = useState('');
  const [doctor, setDoctor] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hits = query.trim().length > 1 ? matchVaccineLabel(query).slice(0, 6) : [];

  function choose(id: string) {
    const product = productById(id);
    if (!product) return;
    setProductId(product.id);
    setQuery(product.name);
    setAntigens([...product.antigens]);
  }

  function save() {
    if (!activeChild) return;
    const when = combineBerlin(date, time);
    if (!when) {
      setError('Datum als TT.MM.JJJJ.');
      return;
    }
    if (!query.trim() && antigens.length === 0) {
      setError('Wähle einen Impfstoff oder mindestens eine Krankheit.');
      return;
    }
    const entry: VaccinationEntry = {
      id: createId('impf'),
      childId: activeChild.id,
      timestamp: when.toISOString(),
      productId,
      productName: query.trim(),
      antigens,
      batch: batch.trim(),
      doctor: doctor.trim(),
      note: note.trim(),
      isExample: false,
    };
    update((current) => saveVaccination(current, entry));
    onDone();
  }

  return (
    <Screen
      title="Impfung"
      onBack={onDone}
      footer={
        <>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button label="Speichern" onPress={save} />
        </>
      }
    >
      <TextField label="Handelsname" value={query} onChangeText={setQuery} placeholder="z. B. Hexyon" />
      {hits.map((hit) => (
        <Button key={hit.product.id} compact label={hit.product.name} variant={productId === hit.product.id ? 'primary' : 'secondary'} onPress={() => choose(hit.product.id)} />
      ))}
      <Muted>Krankheiten werden aus der hinterlegten Liste gefüllt. Die Zusammensetzung muss zur Fachinformation passen.</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ANTIGENS.map((id) => {
          const on = antigens.includes(id);
          return (
            <Pressable key={id} onPress={() => setAntigens(on ? antigens.filter((item) => item !== id) : [...antigens, id])}>
              <Text style={{ color: on ? '#0E6B68' : '#5C6773' }}>{on ? '● ' : '○ '}{ANTIGEN_LABELS[id]}</Text>
            </Pressable>
          );
        })}
      </View>
      <DateTimeFields date={date} time={time} onChange={(nextDate, nextTime) => { setDate(nextDate); setTime(nextTime); }} />
      <TextField label="Charge" value={batch} onChangeText={setBatch} placeholder="vom Aufkleber" />
      <TextField label="Arzt oder Praxis" value={doctor} onChangeText={setDoctor} />
      <TextField label="Notiz" value={note} onChangeText={setNote} />
      {data ? <Muted>{activeChild ? `Für ${activeChild.name}, geboren ${isoDateToGerman(activeChild.birthDate)}.` : ''}</Muted> : null}
    </Screen>
  );
}

function buildDoctorText(
  name: string,
  birthDate: string,
  sex: string,
  entries: VaccinationEntry[],
  status: ReturnType<typeof vaccinationStatus>,
  now: Date,
): string {
  const lines = [
    `${name}, ${sex}, geboren ${isoDateToGerman(birthDate)}`,
    `Stand ${formatDate(now)}`,
    'Orientierung nach STIKO, keine ärztliche Beurteilung. Bitte mit Kinderarzt abklären.',
    '',
    'Gegeben:',
    ...[...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((entry) =>
      `${formatDate(new Date(entry.timestamp))} ${entry.productName || 'ohne Handelsname'}${entry.batch ? `, Charge ${entry.batch}` : ''}${entry.doctor ? `, ${entry.doctor}` : ''} — ${entry.antigens.map((id) => ANTIGEN_LABELS[id as AntigenId] ?? id).join(', ')}`,
    ),
    '',
    'Status:',
    ...status.map((row) => `${row.label}: ${row.detail} · ${STATUS_LABEL[row.status]}`),
    '',
    STIKO_SOURCE,
  ];
  return lines.join('\n');
}

void formatDateTime;
