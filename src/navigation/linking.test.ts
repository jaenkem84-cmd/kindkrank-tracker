import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isVoiceLink, voicePreviewFromUrl } from './linking';

describe('Sprach-Link', () => {
  it('erkennt den App-Link und den Expo-Pfad', () => {
    assert.equal(isVoiceLink('kindkrank://voice'), true);
    assert.equal(isVoiceLink('kindkrank://voice/'), true);
    assert.equal(isVoiceLink('exp://127.0.0.1:8081/--/voice'), true);
    assert.equal(isVoiceLink('kindkrank://fieber'), false);
    assert.equal(isVoiceLink(null), false);
  });

  it('liest die Vorschaustände nur aus dem Query', () => {
    assert.equal(voicePreviewFromUrl('http://localhost:8081/?voicePreview=listening'), 'listening');
    assert.equal(voicePreviewFromUrl('kindkrank://voice?voicePreview=confirm'), 'confirm');
    assert.equal(voicePreviewFromUrl('kindkrank://voice'), null);
  });
});
