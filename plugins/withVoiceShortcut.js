const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withMainActivity } = require('@expo/config-plugins');

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

const ALIAS_NAME = '.VoiceLauncher';

function ensureVoiceAlias(application) {
  const aliases = application['activity-alias'] ?? [];
  const alias = {
    $: {
      'android:name': ALIAS_NAME,
      'android:targetActivity': '.MainActivity',
      'android:exported': 'true',
      'android:enabled': 'true',
      'android:launchMode': 'singleTask',
      'android:label': '@string/voice_launcher_name',
      'android:icon': '@mipmap/ic_launcher_voice',
      'android:roundIcon': '@mipmap/ic_launcher_voice',
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      },
    ],
  };
  const index = aliases.findIndex((item) => item.$?.['android:name'] === ALIAS_NAME);
  if (index >= 0) aliases[index] = alias;
  else aliases.push(alias);
  application['activity-alias'] = aliases;
  return application;
}

function patchMainActivity(contents) {
  if (contents.includes('fun openVoiceWhenAlias')) return contents;
  let next = contents;
  if (!next.includes('import android.content.Intent')) {
    next = next.replace(/package [^\n]+\n/, (line) => `${line}\nimport android.content.Intent\nimport android.net.Uri\n`);
  } else if (!next.includes('import android.net.Uri')) {
    next = next.replace('import android.content.Intent', 'import android.content.Intent\nimport android.net.Uri');
  }
  const helper = `
  private fun openVoiceWhenAlias(intent: Intent?) {
    val name = intent?.component?.className ?: return
    if (!name.endsWith(".VoiceLauncher")) return
    if (intent.data != null) return
    intent.action = Intent.ACTION_VIEW
    intent.data = Uri.parse("kindkrank://voice")
  }
`;
  next = next.replace(
    /override fun onCreate\(savedInstanceState: Bundle\?\) \{\n/,
    'override fun onCreate(savedInstanceState: Bundle?) {\n    openVoiceWhenAlias(intent)\n',
  );
  if (next.includes('override fun onNewIntent')) {
    next = next.replace(
      /override fun onNewIntent\(intent: Intent\) \{\n/,
      'override fun onNewIntent(intent: Intent) {\n    openVoiceWhenAlias(intent)\n',
    );
  } else {
    const end = next.lastIndexOf('}');
    next =
      next.slice(0, end) +
      helper +
      '\n  override fun onNewIntent(intent: Intent) {\n    openVoiceWhenAlias(intent)\n    super.onNewIntent(intent)\n  }\n' +
      next.slice(end);
  }
  if (!next.includes('fun openVoiceWhenAlias')) {
    const end = next.lastIndexOf('}');
    next = next.slice(0, end) + helper + next.slice(end);
  }
  return next;
}

function upsertStrings(xml) {
  const lines = [
    ['shortcut_voice_short', 'Spracheingabe'],
    ['shortcut_voice_long', 'Spracheingabe starten'],
    ['voice_launcher_name', 'FamCare Voice'],
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
    ensureVoiceAlias(application);
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

  config = withMainActivity(config, (mod) => {
    if (mod.modResults.language === 'kt') {
      mod.modResults.contents = patchMainActivity(mod.modResults.contents);
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
      const icon = path.join(mod.modRequest.projectRoot, 'assets/voice-launcher.png');
      const foreground = path.join(mod.modRequest.projectRoot, 'assets/voice-launcher-foreground.png');
      const mipmap = path.join(resDir, 'mipmap-xxxhdpi');
      fs.mkdirSync(mipmap, { recursive: true });
      if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(mipmap, 'ic_launcher_voice.png'));
      const anydpi = path.join(resDir, 'mipmap-anydpi-v26');
      fs.mkdirSync(anydpi, { recursive: true });
      fs.writeFileSync(
        path.join(anydpi, 'ic_launcher_voice.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/voice_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_voice_foreground"/>
</adaptive-icon>
`,
      );
      const drawable = path.join(resDir, 'drawable');
      fs.mkdirSync(drawable, { recursive: true });
      if (fs.existsSync(foreground)) fs.copyFileSync(foreground, path.join(drawable, 'ic_launcher_voice_foreground.png'));
      const colorsPath = path.join(valuesDir, 'colors.xml');
      const colorLine = '<color name="voice_launcher_background">#0E6B68</color>';
      if (!fs.existsSync(colorsPath)) {
        fs.writeFileSync(colorsPath, `<resources>\n    ${colorLine}\n</resources>\n`);
      } else {
        const colors = fs.readFileSync(colorsPath, 'utf8');
        if (!colors.includes('voice_launcher_background')) {
          fs.writeFileSync(colorsPath, colors.replace('</resources>', `    ${colorLine}\n</resources>`));
        }
      }
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
module.exports.ensureVoiceAlias = ensureVoiceAlias;
module.exports.patchMainActivity = patchMainActivity;
