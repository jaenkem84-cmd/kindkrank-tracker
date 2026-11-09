import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MeasurementMethod } from '../types';
import { createLlmParser } from './llmParser';
import { interpretUtterance, parseUtterance, ruleBasedParser } from './parser';
import type { ParseContext } from './types';

const NOW = new Date('2026-11-09T18:00:00.000Z');

function context(extra?: Partial<ParseContext>): ParseContext {
  return {
    now: NOW,
    activeChildId: 'anna',
    defaultMethod: 'rektal' satisfies MeasurementMethod,
    defaultGivenBy: 'Mama',
    children: [
      { id: 'anna', name: 'Anna' },
      { id: 'ben', name: 'Ben' },
    ],
    medications: [
      { id: 'ibu', childId: 'anna', name: 'Ibuprofen-Saft (Beispiel)', doseText: '2,5 ml' },
      { id: 'zap', childId: 'anna', name: 'Paracetamol-Zäpfchen (Beispiel)', doseText: '1 Zäpfchen' },
      { id: 'saft', childId: 'anna', name: 'Paracetamol-Saft (Beispiel)', doseText: '5 ml' },
    ],
    lastDoseTextByMedicationId: { ibu: '2,5 ml' },
    ...extra,
  };
}

describe('Sprachparser', () => {
  it('versteht Temperatur jetzt mit Komma', () => {
    const result = parseUtterance('Temperatur jetzt 38,2', context());
    assert.equal(result.intent.type, 'temperature');
    if (result.intent.type !== 'temperature') return;
    assert.equal(result.intent.celsius, 38.2);
    assert.equal(result.intent.timestamp, NOW.toISOString());
    assert.equal(result.intent.method, 'rektal');
    assert.equal(result.intent.childId, 'anna');
  });

  it('versteht 38.2 Grad', () => {
    const result = parseUtterance('38.2 Grad', context());
    assert.equal(result.intent.type, 'temperature');
    if (result.intent.type !== 'temperature') return;
    assert.equal(result.intent.celsius, 38.2);
    assert.equal(result.intent.timestamp, NOW.toISOString());
  });

  it('versteht vor 15 Minuten', () => {
    const result = parseUtterance('vor 15 Minuten 37,3 Grad', context());
    assert.equal(result.intent.type, 'temperature');
    if (result.intent.type !== 'temperature') return;
    assert.equal(result.intent.celsius, 37.3);
    assert.equal(result.intent.timestamp, new Date(NOW.getTime() - 15 * 60_000).toISOString());
  });

  it('versteht gestern um 22:15 in Europe/Berlin', () => {
    const result = parseUtterance('gestern um 22:15 39,1 Grad', context());
    assert.equal(result.intent.type, 'temperature');
    if (result.intent.type !== 'temperature') return;
    assert.equal(result.intent.celsius, 39.1);
    assert.equal(result.intent.timestamp, '2026-11-08T21:15:00.000Z');
  });

  it('erkennt Messart und Kind', () => {
    const result = parseUtterance('Ben 38,5 Grad im Ohr', context());
    assert.equal(result.intent.type, 'temperature');
    if (result.intent.type !== 'temperature') return;
    assert.equal(result.intent.childId, 'ben');
    assert.equal(result.intent.method, 'ohr');
    assert.equal(result.intent.celsius, 38.5);
  });

  it('ordnet Ibuprofen gegeben dem passenden Medikament zu', () => {
    const result = parseUtterance('Ibuprofen gegeben', context());
    assert.equal(result.intent.type, 'dose');
    if (result.intent.type !== 'dose') return;
    assert.equal(result.intent.medicationId, 'ibu');
    assert.equal(result.intent.doseText, '2,5 ml');
    assert.equal(result.intent.givenBy, 'Mama');
    assert.equal(result.intent.timestamp, NOW.toISOString());
  });

  it('versteht Paracetamol-Zäpfchen gegeben', () => {
    const result = parseUtterance('Paracetamol-Zäpfchen gegeben', context());
    assert.equal(result.intent.type, 'dose');
    if (result.intent.type !== 'dose') return;
    assert.equal(result.intent.medicationId, 'zap');
    assert.equal(result.intent.doseText, '1 Zäpfchen');
  });

  it('lässt mehrdeutiges Paracetamol offen', () => {
    const result = parseUtterance('Paracetamol gegeben', context());
    assert.equal(result.intent.type, 'dose');
    if (result.intent.type !== 'dose') return;
    assert.equal(result.intent.medicationId, null);
    assert.deepEqual(result.intent.candidateIds.sort(), ['saft', 'zap']);
  });

  it('verschiebt eine Gabe um die genannten Stunden', () => {
    const result = parseUtterance('vor 2 Stunden Ibuprofen gegeben', context());
    assert.equal(result.intent.type, 'dose');
    if (result.intent.type !== 'dose') return;
    assert.equal(result.intent.medicationId, 'ibu');
    assert.equal(result.intent.timestamp, new Date(NOW.getTime() - 2 * 3_600_000).toISOString());
  });

  it('versteht Gewicht mit Komma', () => {
    const result = parseUtterance('Gewicht 9,6 Kilo', context());
    assert.equal(result.intent.type, 'growth');
    if (result.intent.type !== 'growth') return;
    assert.equal(result.intent.weightKg, 9.6);
    assert.equal(result.intent.childId, 'anna');
    assert.equal(result.intent.timestamp, NOW.toISOString());
  });

  it('versteht Husten und hat erbrochen als Symptom', () => {
    const cough = parseUtterance('Husten', context());
    assert.equal(cough.intent.type, 'symptom');
    if (cough.intent.type === 'symptom') assert.equal(cough.intent.symptomId, 'husten');
    const sick = parseUtterance('hat erbrochen', context());
    assert.equal(sick.intent.type, 'symptom');
    if (sick.intent.type === 'symptom') assert.equal(sick.intent.symptomId, 'erbrechen');
  });

  it('meldet unbekannte Sätze', () => {
    const result = parseUtterance('Hallo Welt', context());
    assert.equal(result.intent.type, 'unknown');
  });

  it('lässt einen späteren Parser vor den Regeln laufen', async () => {
    const llm = createLlmParser(async () => ({
      parserId: 'llm',
      summary: 'vom Modell',
      intent: {
        type: 'growth',
        childId: 'anna',
        timestamp: NOW.toISOString(),
        weightKg: 10,
        heightCm: null,
        headCm: null,
      },
    }));
    const result = await interpretUtterance('irgendwas', context(), [llm]);
    assert.equal(result.parserId, 'llm');
    assert.equal(result.intent.type, 'growth');
  });

  it('fällt auf die Regeln zurück, wenn das Modell nichts erkennt', async () => {
    const llm = createLlmParser(async () => null);
    const result = await interpretUtterance('38,2 Grad', context(), [llm, ruleBasedParser]);
    assert.equal(result.intent.type, 'temperature');
    assert.equal(result.parserId, 'rules-de');
  });
});
