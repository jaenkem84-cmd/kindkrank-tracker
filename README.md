# Familien-Gesundheit

Die Oberfläche heißt vorerst Familien-Gesundheit. Paketname, Slug `kindkrank-tracker` und die App-ID `de.kindkrank.tracker` bleiben, damit Expo und EAS weiter funktionieren. „Kind“ bleibt dort stehen, wo es um Kinder geht.

Eine ruhige Android-App für Eltern, die ein krankes Kind im Blick behalten: Temperatur, selbst eingetragene Medikamente, Gewicht und Wachstum. Die Oberfläche ist Deutsch, die Zeiten Europe/Berlin, das Datum `TT.MM.JJJJ`, die Uhr 24 Stunden. Einheiten: °C, mg/ml als freier Dosistest, kg, cm.

**Keine Diagnose und keine Dosierungsempfehlung.** Die Linien im Fieberdiagramm sind nur eine Orientierung. Abstände und Höchstmengen trägst du selbst ein, so wie sie auf dem Beipackzettel stehen oder von Ärztin, Arzt oder Apotheke genannt wurden. Die App rechnet keine Dosis aus.

Technisch: Expo SDK 58, React Native, TypeScript. Der erste Start legt Beispieldaten an: **Anna, Mädchen, geboren 15.01.2025**, klar als Beispiel markiert, mit den erfassten Messwerten für Temperatur, Größe, Kopfumfang, Gewicht und die genannten Gaben. Löschen geht in den Einstellungen.

## Funktionen

1. Mehrere Kinder (Name, Geburtsdatum).
2. Temperatur mit Zeitpunkt, Messart (Standard rektal) und Notiz. Das Diagramm steht direkt auf der Seite Temperatur. Standard sind die letzten 5 Tage, umschaltbar auf 7 oder 14. Mitternacht ist eine kräftige Gitterlinie, dazwischen 3, 6 oder 12 Stunden. Orientierungslinien: 37,6 / 38,5 / 39 / 40. Gaben liegen als kurze Striche auf der Zeitachse. Ein Punkt lässt sich antippen.
3. Medikation, die du selbst anlegst: Name, Dosis als Text, Mindestabstand in Stunden, höchstens so viele Gaben in 24 Stunden. Eine Gabe merkt sich Zeitpunkt, gebende Person und die letzte Dosis. Zu früh oder über dem Maximum erscheint eine Warnung. Speichern geht danach nur mit Bestätigung.
4. Impfung: Handelsname aus einer kurzen Liste gängiger Präparate (Zusammensetzung laut Fachinformation, vom Paul-Ehrlich-Institut zu prüfen), Charge, Arzt, Notiz. Der Impfstatus orientiert sich am STIKO-Kalender im Epidemiologischen Bulletin 4/2026 und muss mit dem Bulletin des laufenden Jahres abgeglichen werden. Die Übersicht sagt erledigt, fällig, überfällig oder später und ist keine ärztliche Auskunft. „Für den Arzt“ lässt sich teilen. „Impfpass fotografieren“ nimmt ein Foto; Texterkennung auf dem Gerät gibt es erst in einem Entwicklungs-Build mit `@react-native-ml-kit/text-recognition`. Bis dahin tippst du den Text vom Etikett, derselbe Abgleich schlägt den Handelsnamen vor.
5. Symptome mit Uhrzeit, optional leicht/mittel/stark und Notiz. Die Chips sind Husten, Schnupfen, Erbrechen, Durchfall, Ausschlag, Ohrenschmerzen, Halsschmerzen, Appetitlosigkeit, wenig getrunken, Müdigkeit/schlapp, Atemnot, Krampf, plus Freitext. Auf dem Temperaturdiagramm liegen sie als Punkte, abschaltbar. „Husten“ und „hat erbrochen“ versteht die Spracheingabe.
6. Gewicht (kg), Größe (cm) und Kopfumfang (cm), jeweils mit Diagramm über das Alter. Jahre kräftig, Monate hell, Beschriftung standardmäßig alle 4 Monate. Darüber die WHO-Perzentile P3, P15, P50, P85 und P97, am rechten Rand beschriftet. Ein Tipp auf einen Messpunkt nennt den nahen Perzentilwert. Zeitraum 1 Jahr, 2 Jahre oder 5 Jahre direkt am Diagramm.
7. Große Spracheingabe auf dem Startbildschirm. Der Parser versteht zum Beispiel „Anna 38,5“, „Temperatur jetzt 38,2“, „vor 15 Minuten 37,3 Grad“, „Ibuprofen gegeben“, „Gewicht 9,6 Kilo“. In der APK liest die App den Eintrag vor und speichert nach etwa drei Sekunden oder auf „ja“. In Snack und Expo Go tippst du den Satz; das Mikrofon läuft dort nicht.
8. Deep Link `kindkrank://voice` öffnet direkt die Spracheingabe und hört in der APK sofort zu. Icon lang drücken: Verknüpfung **Spracheingabe**. „Hey Google“ ist auf Deutsch 2026 nicht zuverlässig, siehe unten.
9. Speicher hinter einer Repository-Schnittstelle. Dieser Prototyp speichert lokal (AsyncStorage). Kein Konto, kein API-Schlüssel. Der Plan für einen Familien-Einladungslink steht weiter unten.
10. In den Einstellungen exportierst du **alle** Daten als ZIP mit einer CSV pro Tabelle, einschließlich Impfungen und Symptome (Semikolon, UTF-8 mit BOM). Ohne Wochenfilter.
11. Startseite wie ein Tagesbuch: Name und Alter in Wochen und Tagen, Profilbild mit Rahmenfarbe, Tag vor und zurück, Zähler für den Tag, unten die Leiste Temperatur, Medikation, Impfung, Symptome, Gewicht, Größe, Kopfumfang. Hamburger-Menü: Alarme, Familie, Export und Einstellungen. Kein eigener Punkt Analyse und keine zentrale Erinnerungsliste. Erinnerungen sitzen bei Temperatur und bei jedem Medikament. Auf dem Handy sind das lokale Mitteilungen. Im Browser werden sie nur gespeichert.

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

## Installierbare APK (Windows)

Die Expo-Projekt-ID steht schon in `app.json`:

`expo.extra.eas.projectId` = `a0440d97-fdfd-493d-908e-790b802845d9`

`eas.json` hat das Profil `preview`: interne Verteilung, Android-APK. Kein Play-Store-Bundle. Expo Go bleibt für alles andere nutzbar. Mikrofon, Vorlesen ohne Unterbrechung und der Assistenten-Link brauchen diese APK.

Im Projektordner, in PowerShell oder Eingabeaufforderung:

```bat
git pull
npm install
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

`eas init` ist nicht nötig, solange die Projekt-ID in `app.json` steht. Wenn Expo nach dem Slug fragt: `kindkrank-tracker`. Android-Paket: `de.kindkrank.tracker`.

Der Build läuft auf den Servern von Expo. Am Ende erscheint ein Link und ein QR-Code.

1. Den Link auf dem Android-Handy öffnen und die APK laden.
2. Installation aus dieser Quelle erlauben, falls Android fragt.
3. Die App heißt **Familien-Gesundheit** und liegt neben Expo Go. Expo Go nicht deinstallieren.
4. Beim ersten Spracheingabe-Start einmal **Mikrofon erlauben**. Diese eine Rückfrage lässt sich nicht überspringen. Danach nicht mehr.

Prüfen, dass der Deep Link die Spracheingabe öffnet (Handy per USB, USB-Debugging an):

```bat
adb shell am start -a android.intent.action.VIEW -d "kindkrank://voice" de.kindkrank.tracker
```

Die App muss direkt „Ich höre zu“ zeigen.

## Freihändige Spracheingabe

Beispiel, beide Hände am Thermometer: „Anna 38,5“. Die App liest vor: „Anna, 38,5 Grad rektal, 1:52 Uhr. Speichern?“ Nach etwa drei Sekunden Stille speichert sie. Vorher „ja“ oder „speichern“ speichert sofort, „nein“ oder „abbrechen“ verwirft, „rückgängig“ nimmt den letzten Eintrag dieser Sitzung zurück, „beenden“ schließt die Spracheingabe. Der Bildschirm bleibt an. Ein kurzer Ton und eine Vibration markieren Zuhören, Speichern und Abbruch.

Eine Grenze bei einem Medikament wird nicht automatisch gespeichert. Dann sagt die App den Grund, und „trotzdem“ speichert bewusst darüber hinweg.

In Expo Go und ohne Mikrofon bleibt das Textfeld. **Auswerten** nutzt denselben Parser und dieselbe Ansage. Dort tippt man Speichern oder Abbrechen.

Der Parser ist austauschbar.

- `src/domain/voice/parser.ts` ist der regelbasierte Parser für Deutsch.
- `interpretUtterance(text, kontext, parserListe)` geht die Liste der Reihe nach durch.
- `createLlmParser` in `src/domain/voice/llmParser.ts` ist die Stelle für ein späteres Modell. Kein Netzwerk und kein API-Schlüssel in diesem Prototyp.

Die gesprochene Zeile geht an die Spracherkennung des Geräts (auf vielen Android-Handys der Dienst von Google). Die App schickt den fertigen Eintrag nicht an einen Assistenten.

## Hey Google, Gemini und Siri

Stand November 2026, nach der Dokumentation von Android App Actions und den öffentlichen Hinweisen zu Gemini:

- `actions.intent.OPEN_APP_FEATURE` ist die eingebaute App-Action, um eine Funktion zu öffnen. Die dokumentierten Sprachen dafür sind Englisch (mehrere Regionen), Spanisch (Spanien) und Portugiesisch (Brasilien). **Deutsch ist nicht dabei.** Custom Intents sind nur `en-US`.
- Die APK enthält die Capability trotzdem, mit den Funktionsnamen Spracheingabe, Sprache, voice input, voice und speech input, erfüllt über `kindkrank://voice`. Das schreibt `plugins/withVoiceShortcut.js`.
- Gemini als Standard-Assistent öffnet auf „Hey Google, öffne Familien-Gesundheit“ die App, übergibt die Funktion aber oft nicht. Die Spracheingabe startet dann nicht. Zurückschalten auf den klassischen Assistant stellt das nach Berichten aus 2025 nicht zuverlässig wieder her.
- Eine statische App-Verknüpfung **öffnet der Assistent nicht verlässlich nur wegen ihres Namens.** Lang drücken auf das Icon ist zuverlässig.

Was auf dem Handy verlässlich ist:

1. App-Icon lang drücken → **Spracheingabe**. Danach kein Tippen mehr. Die Kachel kann auf den Startbildschirm gezogen werden.
2. Diese Sätze nach der Installation ausprobieren. Es kann ein paar Stunden dauern, bis Google die Verknüpfung indexiert, und ein Neustart hilft manchmal:
   - „Hey Google, öffne Familien-Gesundheit Spracheingabe“
   - „Hey Google, Spracheingabe in Familien-Gesundheit“
   - „Hey Google, öffne Spracheingabe“
3. Nur wenn die Assistant-Sprache Englisch ist, zusätzlich: „Hey Google, open voice input on Familien-Gesundheit“ und „Hey Google, open Familien-Gesundheit voice input“.
4. Routine, wenn der Aktionspicker eine Verknüpfung anbietet: Google-App oder Gemini → Einstellungen → Routinen. Auslöser genau „Spracheingabe für Familien-Gesundheit“. Aktion: die Verknüpfung **Spracheingabe** von Familien-Gesundheit, nicht nur „App öffnen“. „App öffnen“ landet auf dem Startbildschirm. Danach: „Hey Google, starte Spracheingabe für Familien-Gesundheit“. Gemini führt nicht jede Routinen-Aktion aus und sagt das dann.

iOS, nachrangig: `plugins/withVoiceIntent.js` legt beim iOS-Build einen App Intent und einen Siri-Kurzbefehl „Spracheingabe“ an. Siri-Sätze müssen den App-Namen enthalten, also „Spracheingabe in Familien-Gesundheit“. Zuverlässiger auf dem iPhone ist ein eigener Kurzbefehl: Aktion „URL öffnen“ mit `kindkrank://voice`, zu Siri hinzufügen. Der Android-Build hängt nicht an dieser Datei.

## Supabase für die Familie

Ohne die beiden Werte unten bleibt die App lokal. „Mitglied hinzufügen“ erzeugt trotzdem einen Link `kindkrank://invite/…` und einen Code. Die Meldung sagt ausdrücklich, dass noch nichts übertragen wird. Erst mit einem eingerichteten Projekt werden Einträge wirklich geteilt.

1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt anlegen.
2. Unter Authentication → Providers **Anonymous Sign-Ins** einschalten.
3. Im SQL-Editor den Inhalt von `supabase/schema.sql` ausführen.
4. Unter Project Settings → API die Project URL und den **anon public** Schlüssel kopieren. Den `service_role`-Schlüssel nicht verwenden.
5. Im Projektordner eine Datei `.env` anlegen (Vorlage: `.env.example`):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=dein-anon-schluessel
```

6. `npx expo start` neu starten. Danach legt die erste Einladung eine Familie an und speichert die Einträge dort. Die andere Person öffnet `kindkrank://invite/CODE` oder tippt den Code unter Einstellungen ein. Die Einladung gilt 7 Tage.

Eine eigene https-Seite ist optional über `EXPO_PUBLIC_INVITE_WEB_BASE`. Ohne sie steht im geteilten Text, dass es noch keine Webseite gibt und der Code reicht.

Das Schema nutzt Zeilensicherheit: nur Mitglieder einer Familie lesen und schreiben deren Dokument. Anlegen und Beitreten laufen über die Funktionen `ensure_family`, `create_invite` und `accept_invite`.

## Daten, Export, Familie

Alles geht durch `KindkrankRepository` (`src/data/repository.ts`). Die mitgelieferte Umsetzung `createAsyncStorageRepository` schreibt ein JSON-Dokument unter dem Schlüssel `kindkrank.v5`. Ältere Stände (`v3`, `v4`) werden beim Laden zu einer Familienliste: bisherige Kinder bleiben Typ Kind, Betreuende wie Michael oder Julia werden Erwachsene in derselben Liste, die Eintrags-IDs bleiben. Die Bildschirme kennen den Speicher nicht.

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
