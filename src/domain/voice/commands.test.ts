import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchVoiceCommand } from './commands';
import { speakClock, spokenSavePrompt, temperatureDetail } from './spoken';

describe('Sprachbefehle', () => {
  it('erkennt ja, speichern, nein, abbrechen und rückgängig', () => {
    assert.equal(matchVoiceCommand('Ja'), 'save');
    assert.equal(matchVoiceCommand('speichern'), 'save');
    assert.equal(matchVoiceCommand('nein'), 'cancel');
    assert.equal(matchVoiceCommand('abbrechen'), 'cancel');
    assert.equal(matchVoiceCommand('Rückgängig'), 'undo');
    assert.equal(matchVoiceCommand('trotzdem'), 'anyway');
    assert.equal(matchVoiceCommand('beenden'), 'stop');
  });

  it('lässt Messwerte in Ruhe', () => {
    assert.equal(matchVoiceCommand('Anna 38,5'), null);
    assert.equal(matchVoiceCommand('ja 38,5'), null);
    assert.equal(matchVoiceCommand('Temperatur 37,8'), null);
  });
});

describe('Vorlesen', () => {
  it('spricht die Bestätigung wie vereinbart', () => {
    const detail = temperatureDetail(38.5, 'rektal');
    assert.equal(detail, '38,5 Grad rektal');
    assert.equal(speakClock('01:52'), '1:52 Uhr');
    assert.equal(spokenSavePrompt('Anna', detail, '1:52 Uhr'), 'Anna, 38,5 Grad rektal, 1:52 Uhr. Speichern?');
  });
});
