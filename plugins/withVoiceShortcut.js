const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const META_NAME = 'android.app.shortcuts';

function buildShortcutsXml(packageName) {
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <capability android:name="actions.intent.OPEN_APP_FEATURE">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity"
      android:data="kindkrank://voice">
      <parameter
        android:name="feature"
        android:key="feature" />
    </intent>
  </capability>
  <shortcut
    android:shortcutId="voice"
    android:enabled="true"
    android:shortcutShortLabel="@string/shortcut_voice_short"
    android:shortcutLongLabel="@string/shortcut_voice_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity"
      android:data="kindkrank://voice" />
    <capability-binding android:key="actions.intent.OPEN_APP_FEATURE">
      <parameter-binding
        android:key="feature"
        android:value="@array/voice_feature_synonyms" />
    </capability-binding>
  </shortcut>
</shortcuts>
`;
}

function buildFeatureSynonymsXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string-array name="voice_feature_synonyms">
    <item>Spracheingabe</item>
    <item>Sprache</item>
    <item>voice input</item>
    <item>voice</item>
    <item>speech input</item>
  </string-array>
</resources>
`;
}

function upsertStrings(xml) {
  const lines = [
    ['shortcut_voice_short', 'Spracheingabe'],
    ['shortcut_voice_long', 'Spracheingabe starten'],
  ];
  let next = xml;
  for (const [name, value] of lines) {
    const line = `<string name="${name}">${value}</string>`;
    const pattern = new RegExp(`<string name="${name}">[^<]*</string>`);
    if (pattern.test(next)) next = next.replace(pattern, line);
    else next = next.replace('</resources>', `    ${line}\n</resources>`);
  }
  return next;
}

/**
 * Static shortcut plus the Open-app-feature capability.
 * Expo Go never applies this plugin. The installed app opens kindkrank://voice.
 */
function withVoiceShortcut(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const activity = (application.activity ?? []).find((item) => {
      const name = item.$?.['android:name'] ?? '';
      return name === '.MainActivity' || name.endsWith('.MainActivity');
    });
    if (!activity) return mod;
    const meta = activity['meta-data'] ?? [];
    if (!meta.some((item) => item.$?.['android:name'] === META_NAME)) {
      meta.push({
        $: {
          'android:name': META_NAME,
          'android:resource': '@xml/shortcuts',
        },
      });
      activity['meta-data'] = meta;
    }
    return mod;
  });

  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      const resDir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
      const xmlDir = path.join(resDir, 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      const packageName = mod.android?.package ?? 'de.kindkrank.tracker';
      fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), buildShortcutsXml(packageName));
      const valuesDir = path.join(resDir, 'values');
      fs.mkdirSync(valuesDir, { recursive: true });
      fs.writeFileSync(path.join(valuesDir, 'voice_features.xml'), buildFeatureSynonymsXml());
      const stringsPath = path.join(valuesDir, 'strings.xml');
      if (!fs.existsSync(stringsPath)) {
        fs.writeFileSync(stringsPath, upsertStrings('<resources>\n</resources>\n'));
      } else {
        fs.writeFileSync(stringsPath, upsertStrings(fs.readFileSync(stringsPath, 'utf8')));
      }
      return mod;
    },
  ]);

  return config;
}

module.exports = withVoiceShortcut;
module.exports.buildShortcutsXml = buildShortcutsXml;
module.exports.buildFeatureSynonymsXml = buildFeatureSynonymsXml;
