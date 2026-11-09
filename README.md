# Kindkrank-Tracker

Eine ruhige Android-App für Eltern, die ein krankes Kind im Blick behalten: Temperatur, selbst eingetragene Medikamente, Gewicht und Wachstum. Die Oberfläche ist Deutsch, die Zeiten Europe/Berlin, das Datum `TT.MM.JJJJ`, die Uhr 24 Stunden. Einheiten: °C, mg/ml als freier Dosistest, kg, cm.

**Keine Diagnose und keine Dosierungsempfehlung.** Die Linien im Fieberdiagramm sind nur eine Orientierung. Abstände und Höchstmengen trägst du selbst ein, so wie sie auf dem Beipackzettel stehen oder von Ärztin, Arzt oder Apotheke genannt wurden. Die App rechnet keine Dosis aus.

Technisch: Expo SDK 58, React Native, TypeScript. Der erste Start legt Beispieldaten an: das Kind **Anna, geboren 15.01.2025**, klar als Beispiel markiert, inklusive ein paar Messungen und Gaben. Alles davon lässt sich auf dem Startbildschirm oder unter Mehr löschen.

## Funktionen

1. Mehrere Kinder (Name, Geburtsdatum).
2. Temperatur mit Zeitpunkt (Standard: jetzt, plus „vor 15 Minuten“ und weitere Schnellwahl), Messart (Standard rektal, außerdem axillar, oral, Ohr, Stirn) und Notiz. Das Diagramm zeigt die aktuelle Krankheitsphase (neue Phase nach mehr als 48 Stunden Pause), höchstens die letzten 5 Wochen. Die Wochenzahl steht unter Mehr (1 bis 12). Orientierungslinien: 37,6 erhöhte Temperatur, 38,5 Fieber, 39 hohes Fieber, 40 ärztlich abklären.
3. Medikamente, die du selbst anlegst: Name, Dosis als Text, Mindestabstand in Stunden, höchstens so viele Gaben in 24 Stunden. Eine Gabe merkt sich Zeitpunkt, gebende Person und die letzte Dosis dieses Medikaments. Pro Medikament siehst du die letzte Gabe, die vergangene Zeit, „nächste Gabe frühestens um HH:MM“ und „Heute / letzte 24h: X von Y“. Zu früh oder über dem Maximum erscheint eine deutliche Warnung. Speichern geht danach nur mit Bestätigung.
4. Gewicht (kg), Größe (cm) und Kopfumfang (cm) mit einer einfachen Kurve über das Alter. Keine Perzentile.
5. Große Spracheingabe auf dem Startbildschirm. Der Parser versteht zum Beispiel „Temperatur jetzt 38,2“, „38.2 Grad“, „vor 15 Minuten 37,3 Grad“, „Ibuprofen gegeben“, „Paracetamol-Zäpfchen gegeben“, „Gewicht 9,6 Kilo“. Vor dem Speichern kannst du alles noch ändern. Ein späteres Sprachmodell (zum Beispiel Gemini) kann vor den Regeln eingehängt werden, siehe unten. In Snack und Expo Go tippst du den Satz; das Mikrofon läuft dort meist nicht.
6. Deep Link `kindkrank://voice` öffnet direkt die Spracheingabe. Im APK gibt es dazu eine Android-App-Verknüpfung.
7. Speicher hinter einer Repository-Schnittstelle. Dieser Prototyp speichert lokal (AsyncStorage). Kein Konto, kein API-Schlüssel. Der Plan für einen Familien-Einladungslink steht weiter unten.
8. Unter Mehr exportierst du **alle** Daten als ZIP mit einer CSV pro Tabelle (Semikolon, UTF-8 mit BOM, für Excel in Deutschland). Ohne Wochenfilter.
9. Mehr: Diagrammfenster, Standard-Messart, Standard für „gegeben von“, Kinder, Medikamente, Export, Erscheinungsbild (System, Hell, Dunkel).

## Am PC ansehen

Es gibt zwei Wege. Der zweite ist der, der mit diesem Stand sofort funktioniert.

### 1. Expo Snack (Android-Emulator im Browser)

Snack erwartet eine Datei `App.tsx` im Repository. Die ist der Einstieg dieser App.

Das Repository auf GitHub:

https://github.com/jaenkem84-cmd/kindkrank-tracker

Snack kann ein öffentliches Repository so öffnen (Chrome auf dem PC):

1. Diese Adresse öffnen: https://snack.expo.dev/@git/github.com/jaenkem84-cmd/kindkrank-tracker
2. Falls Snack nach einem Branch fragt oder `main` den Prototyp noch nicht enthält, den Branch `cursor/kindkrank-tracker-e609` importieren. Dafür im Snack-Menü **Import git repository** wählen und diese URL einfügen:

   https://github.com/jaenkem84-cmd/kindkrank-tracker/tree/cursor/kindkrank-tracker-e609

   Alternativ direkt: https://snack.expo.dev/@git/github.com/jaenkem84-cmd/kindkrank-tracker:cursor/kindkrank-tracker-e609
3. Rechts die Plattform **Android** wählen.
4. Auf **Tap to play** tippen. Der Emulator bootet den Android-Player von Snack.

Das Repository muss dafür **öffentlich** sein. Snack liest GitHub ohne dein Login.

**Grenze, Stand 9. November 2026:** Der Snack-Runtime-Code auf GitHub kennt SDK-Versionen bis 56. Diese App ist Expo SDK 58, weil die Expo-Go-App aus dem Play Store nur noch SDK 58 öffnet. Wenn Snack „unsupported SDK“ oder einen roten Fehler zeigt, ist das der Grund und kein Fehler in den Bildschirmen. Dann den nächsten Abschnitt nutzen. Sobald Snack SDK 58 ausliefert, gilt derselbe Import.

Ein lokales Config-Plugin (`plugins/withVoiceShortcut.js`) hängt nur am APK-Build für die Homescreen-Verknüpfung. Expo Go und der Web-Start ignorieren es.

### 2. Browser auf dem PC, dieser Code, sofort

Im Projektordner:

```bash
npm install
npx expo start --web
```

Expo öffnet Chrome mit derselben Oberfläche. Für eine handyähnliche Breite: in Chrome die Entwicklertools öffnen (F12) und die Geräteleiste einschalten, zum Beispiel 390 × 844. Das ist die Web-Ausgabe von React Native, nicht der Snack-Android-Emulator, aber es ist genau dieser Prototyp, inklusive Beispieldaten, Diagramm und CSV-Download.

`npx expo start` ohne `--web` startet denselben Dev-Server. Danach `w` drücken, um den Browser zu öffnen.

## Expo Go auf dem Android-Handy

1. Im Play Store **Expo Go** installieren. Die aktuelle Fassung (ab Oktober 2026, Version 58.x) unterstützt SDK 58. Eine ältere Expo-Go-App öffnet dieses Projekt nicht.
2. Rechner und Handy ins gleiche WLAN.
3. Im Projektordner `npx expo start` ausführen.
4. Den QR-Code **in Expo Go** scannen (unter Android die Schaltfläche in Expo Go, nicht nur die normale Kamera).
5. Anna und die Beispielwerte erscheinen. Oben steht, dass es Beispieldaten sind.

Wenn das Handy den Rechner nicht erreicht: `npx expo start --tunnel`.

## Installierbare APK (EAS)

Die Expo-Projekt-ID steht schon in `app.json`:

`expo.extra.eas.projectId` = `a0440d97-fdfd-493d-908e-790b802845d9`

In diesem Checkout wurde `eas init` nicht ausgeführt, und es gibt hier kein Expo-Login. Das machst du auf deinem Rechner, im Projektordner:

```bash
npx eas-cli@latest login
npx eas-cli@latest init --id a0440d97-fdfd-493d-908e-790b802845d9
npx eas-cli@latest build -p android --profile preview
```

`eas.json` enthält das Profil `preview` mit `distribution: internal` und `android.buildType: apk`. Das Ergebnis ist eine installierbare APK, kein Play-Store-Bundle. Wenn `eas init` meldet, dass die Projekt-ID bereits gesetzt ist, den Befehl überspringen und nur `build` ausführen.

Der Slug in `app.json` ist `kindkrank-tracker`, das Android-Paket `de.kindkrank.tracker`. Wenn das bestehende Projekt auf expo.dev einen anderen Slug hat, `expo.slug` an den Slug dort anpassen. Die Projekt-ID ist die Verbindung.

Nach dem Build zeigt Expo einen Link. Die APK auf dem Handy laden und installieren.

## Spracheingabe

Der Parser ist absichtlich austauschbar.

- `src/domain/voice/parser.ts` ist der regelbasierte Parser für Deutsch.
- `interpretUtterance(text, kontext, parserListe)` geht die Liste der Reihe nach durch. Ein Parser, der `null` oder `unknown` liefert, gibt an den nächsten ab.
- `createLlmParser` in `src/domain/voice/llmParser.ts` ist die Stelle für ein späteres Modell. Kein Netzwerk, kein API-Schlüssel in diesem Prototyp. Ein Gemini-Adapter käme als erster Eintrag in die Liste und würde bei Unsicherheit `null` zurückgeben.

Im Browser (Chrome, `localhost` oder HTTPS) versucht die App die Web Speech API mit `de-DE`. Klappt das, erscheint das Mikrofon. In Snack, im Android-Emulator und in Expo Go ist diese API meist nicht da. Dann bleibt das Textfeld, und **Auswerten** nutzt denselben Parser. Nichts wird gespeichert, bevor die Zusammenfassung bestätigt ist.

Echtes Mikrofon auf dem Handy braucht ein natives Modul, das nicht in Expo Go liegt:

```bash
npx expo install expo-speech-recognition
```

Danach die Anleitung des Pakets für das Config-Plugin und die Mikrofon-Berechtigung übernehmen und einen Development- oder Preview-Build bauen (`eas build`, nicht Expo Go). Der Codepfad dafür liegt in `src/speech/recognition.ts`: er lädt `expo-speech-recognition` nur, wenn das Paket im Build vorhanden ist, und fällt sonst auf Tippen zurück. Solange das Paket nicht installiert ist, bleibt der Start in Expo Go und im Browser unberührt.

## Homescreen-Verknüpfung

Der Link lautet `kindkrank://voice` und öffnet die Spracheingabe.

- **Installierte APK:** App-Icon lang drücken. Dort liegt die Verknüpfung **Spracheingabe** (kurz: Sprache). Sie wird beim nächsten Prebuild aus `plugins/withVoiceShortcut.js` in die Android-Shortcuts geschrieben. Dieselbe Kachel lässt sich auf den Homescreen ziehen. Ein eigener Android-Widget (App-Widget mit eigener Fläche) ist in Expo Go nicht möglich und in diesem Prototyp nicht als Widget gebaut; die App-Verknüpfung ist der vorbereitete Weg.
- **Expo Go:** Der eigene Scheme `kindkrank://` öffnet Expo Go nicht. Dort die große Taste **Spracheingabe** auf dem Startbildschirm nutzen. Ein Shortcut auf `exp://…/--/voice` gilt nur, solange der Dev-Server läuft, und ist als Homescreen-Icon unpraktisch.
- Zum Prüfen einer installierten App: `npx uri-scheme open kindkrank://voice --android`.

## Daten, Export, Familie

Alles geht durch `KindkrankRepository` (`src/data/repository.ts`). Die mitgelieferte Umsetzung `createAsyncStorageRepository` schreibt ein JSON-Dokument unter dem Schlüssel `kindkrank.v1`. Die Bildschirme kennen den Speicher nicht.

CSV-Export unter Mehr schreibt eine ZIP-Datei mit:

- `kinder.csv`
- `temperatur.csv`
- `medikamente.csv`
- `gaben.csv`
- `wachstum.csv`

Trennzeichen ist das Semikolon, dazu ein UTF-8-BOM. Auf dem Handy öffnet sich das Teilen-Menü, im Browser der Download oder das Teilen-Fenster, wenn der Browser Dateien teilen kann.

**Familienzugang, noch nicht angeschlossen.** Geplant ist ein zweites Repository gegen Supabase oder die Firebase-Free-Tier, ohne dass die Bildschirme sich ändern.

- Eine Familie hat eine `family_id`.
- Tabellen spiegeln die lokalen Listen: Kinder, Temperaturen, Medikamente, Gaben, Wachstum, Einstellungen.
- Einladung: Tabelle `invites` mit zufälligem Token, Ablauf und einmaliger Nutzung. Der Link hat die Form `https://…/join/<token>` oder `kindkrank://join/<token>`.
- Row Level Security: nur Mitglieder der `family_id` lesen und schreiben.
- Die App bleibt ohne Konto startbar. Erst „Einladungslink“ unter Mehr würde anmelden oder einen anonymen Familienraum anlegen. Der jetzige Knopf erklärt nur, dass noch kein Backend hängt (`src/data/sync.ts`).
- Keine Schlüssel in der App, bis dieses Backend wirklich angeschlossen wird.

## Tests und Skripte

```bash
npm test
npx tsc --noEmit
npx expo start
```

`npm test` prüft den Sprachparser (die Beispielsätze, Messart, mehrdeutiges Paracetamol, austauschbaren Parser) und die Medikamentenlogik (Mindestabstand, genau 24 Stunden, Maximum, Berliner Kalendertag).

## Nächste Schritte

- Snack, sobald der Runtime SDK 58 kann, mit der GitHub-URL oben öffnen.
- Preview-APK mit den EAS-Befehlen oben bauen und die Verknüpfung **Spracheingabe** auf den Homescreen legen.
- `expo-speech-recognition` in einem Development-Build für das echte Mikrofon.
- Familien-Backend (Supabase oder Firebase) hinter `KindkrankRepository`, Einladung per Link.
- Optional ein Modell-Parser über `createLlmParser`, der bei Unsicherheit die Regeln weiterarbeiten lässt.
)
