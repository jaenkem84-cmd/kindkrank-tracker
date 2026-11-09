const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const META_NAME = 'android.app.shortcuts';

/**
 * Static Android app shortcut for a development or EAS build.
 * Expo Go does not apply this plugin. Long-press the installed app icon
 * and choose "Spracheingabe" (kindkrank://voice).
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
      fs.writeFileSync(
        path.join(xmlDir, 'shortcuts.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
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
  </shortcut>
</shortcuts>
`,
      );
      const valuesDir = path.join(resDir, 'values');
      fs.mkdirSync(valuesDir, { recursive: true });
      const stringsPath = path.join(valuesDir, 'strings.xml');
      const addition = `    <string name="shortcut_voice_short">Sprache</string>
    <string name="shortcut_voice_long">Spracheingabe</string>`;
      if (!fs.existsSync(stringsPath)) {
        fs.writeFileSync(stringsPath, `<resources>\n${addition}\n</resources>\n`);
      } else {
        const current = fs.readFileSync(stringsPath, 'utf8');
        if (!current.includes('shortcut_voice_short')) {
          fs.writeFileSync(stringsPath, current.replace('</resources>', `${addition}\n</resources>`));
        }
      }
      return mod;
    },
  ]);

  return config;
}

module.exports = withVoiceShortcut;
