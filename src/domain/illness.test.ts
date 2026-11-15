import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { temperaturesForChart } from './illness';
import type { TemperatureEntry } from './types';

const NOW = new Date('2026-11-09T18:00:00.000Z');

function entry(id: string, hoursAgo: number): TemperatureEntry {
  return {
    id,
    childId: 'anna',
    timestamp: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
    celsius: 38,
    method: 'rektal',
    note: '',
    isExample: false,
  };
}

describe('Fieberdiagramm', () => {
  it('zeigt nur die aktuelle Krankheitsphase innerhalb des Fensters', () => {
    const entries = [
      entry('alt', 24 * 20),
      entry('vorher', 24 * 10),
      entry('a', 24 * 3),
      entry('b', 24 * 2),
      entry('c', 24),
    ];
    const chart = temperaturesForChart(entries, NOW, 5);
    assert.deepEqual(chart.map((item) => item.id), ['a', 'b', 'c']);
  });

  it('schneidet auf höchstens fünf Wochen', () => {
    const entries = [entry('zu-alt', 24 * 40), entry('drin', 24 * 7)];
    const chart = temperaturesForChart(entries, NOW, 5);
    assert.deepEqual(chart.map((item) => item.id), ['drin']);
  });
});
