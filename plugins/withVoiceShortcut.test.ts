import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
const { buildShortcutsXml, buildFeatureSynonymsXml } = require('./withVoiceShortcut.js') as {
  buildShortcutsXml: (packageName: string) => string;
  buildFeatureSynonymsXml: () => string;
};

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
});
