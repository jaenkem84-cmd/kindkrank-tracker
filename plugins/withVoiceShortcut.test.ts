import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const shortcut = require('./withVoiceShortcut.js') as {
  buildShortcutsXml: (packageName: string) => string;
  buildFeatureSynonymsXml: () => string;
  ensureVoiceAlias: (application: { 'activity-alias'?: Array<Record<string, unknown>> }) => void;
  patchMainActivity: (source: string) => string;
};
const { SWIFT } = require('./withVoiceIntent.js') as { SWIFT: string };
const { buildShortcutsXml, buildFeatureSynonymsXml, ensureVoiceAlias, patchMainActivity } = shortcut;

describe('Android-Sprachverknüpfung', () => {
  it('öffnet kindkrank://voice und nennt die Funktion Spracheingabe', () => {
    const xml = buildShortcutsXml('de.kindkrank.tracker');
    assert.match(xml, /actions\.intent\.OPEN_APP_FEATURE/);
    assert.match(xml, /kindkrank:\/\/voice/);
    assert.match(xml, /de\.kindkrank\.tracker\.MainActivity/);
    assert.match(xml, /voice_feature_synonyms/);
    const synonyms = buildFeatureSynonymsXml();
    assert.match(synonyms, /<item>Spracheingabe<\/item>/);
    assert.match(synonyms, /<item>voice input<\/item>/);
  });

  it('legt FamCare Voice als exportierten Launcher-Alias an', () => {
    const application: { 'activity-alias'?: Array<{ $: Record<string, string>; 'intent-filter': Array<{ action: Array<{ $: Record<string, string> }>; category: Array<{ $: Record<string, string> }> }> }> } = {};
    ensureVoiceAlias(application);
    const alias = application['activity-alias']?.[0];
    assert.ok(alias);
    assert.equal(alias.$['android:exported'], 'true');
    assert.equal(alias.$['android:enabled'], 'true');
    assert.equal(alias.$['android:targetActivity'], '.MainActivity');
    assert.equal(alias.$['android:label'], '@string/voice_launcher_name');
    assert.equal(alias['intent-filter'][0].action[0].$['android:name'], 'android.intent.action.MAIN');
    assert.equal(alias['intent-filter'][0].category[0].$['android:name'], 'android.intent.category.LAUNCHER');
  });

  it('öffnet kindkrank://voice, wenn der Alias die Aktivität startet', () => {
    const sample = [
      'package de.kindkrank.tracker',
      '',
      'import android.os.Bundle',
      '',
      'class MainActivity : ReactActivity() {',
      '  override fun onCreate(savedInstanceState: Bundle?) {',
      '    setTheme(R.style.AppTheme);',
      '    super.onCreate(null)',
      '  }',
      '}',
      '',
    ].join('\n');
    const patched = patchMainActivity(sample);
    assert.match(patched, /openVoiceWhenAlias\(intent\)/);
    assert.match(patched, /kindkrank:\/\/voice/);
    assert.match(patched, /\.VoiceLauncher/);
    assert.match(patched, /override fun onNewIntent/);
    assert.equal(patchMainActivity(patched), patched);
  });

  it('nennt den Siri-Kurzbefehl FamCare Voice', () => {
    assert.match(SWIFT, /FamCare Voice/);
    assert.match(SWIFT, /kindkrank:\/\/voice/);
    assert.match(SWIFT, /applicationName/);
  });
});
