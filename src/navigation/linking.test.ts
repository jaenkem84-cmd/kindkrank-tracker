import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isVoiceLink } from './linking';

describe('Sprach-Link', () => {
  it('erkennt den App-Link und den Expo-Pfad', () => {
    assert.equal(isVoiceLink('kindkrank://voice'), true);
    assert.equal(isVoiceLink('kindkrank://voice/'), true);
    assert.equal(isVoiceLink('exp://127.0.0.1:8081/--/voice'), true);
    assert.equal(isVoiceLink('kindkrank://fieber'), false);
    assert.equal(isVoiceLink(null), false);
  });
});
