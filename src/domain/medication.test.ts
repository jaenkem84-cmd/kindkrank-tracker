import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessDose } from './medication';

const NOW = new Date('2026-11-09T18:00:00.000Z');

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe('Medikamentenabstand und Maximum', () => {
  it('warnt, wenn der Mindestabstand noch nicht um ist', () => {
    const result = assessDose({
      doses: [{ timestamp: hoursAgo(5) }],
      minIntervalHours: 6,
      maxPer24h: 4,
      at: NOW,
    });
    assert.equal(result.tooSoon, true);
    assert.equal(result.exceedsMax, false);
    assert.equal(result.hoursSince, 5);
    assert.equal(result.nextEarliest?.toISOString(), new Date(NOW.getTime() + 3_600_000).toISOString());
    assert.equal(result.count24h, 1);
  });

  it('erlaubt eine Gabe genau am Ende des Abstands', () => {
    const result = assessDose({
      doses: [{ timestamp: hoursAgo(6) }],
      minIntervalHours: 6,
      maxPer24h: 4,
      at: NOW,
    });
    assert.equal(result.tooSoon, false);
    assert.equal(result.hoursSince, 6);
  });

  it('warnt nicht, wenn es noch keine Gabe gibt', () => {
    const result = assessDose({
      doses: [],
      minIntervalHours: 6,
      maxPer24h: 4,
      at: NOW,
    });
    assert.equal(result.tooSoon, false);
    assert.equal(result.exceedsMax, false);
    assert.equal(result.lastDoseAt, null);
    assert.equal(result.nextEarliest, null);
    assert.equal(result.count24h, 0);
  });

  it('zählt die 24-Stunden-Grenze ohne die neue Gabe und warnt bei Überschreitung', () => {
    const doses = [1, 2, 3, 4].map((n) => ({ timestamp: hoursAgo(n * 2) }));
    const four = assessDose({ doses: doses.slice(0, 3), minIntervalHours: 1, maxPer24h: 4, at: NOW });
    assert.equal(four.count24h, 3);
    assert.equal(four.exceedsMax, false);

    const fifth = assessDose({ doses, minIntervalHours: 1, maxPer24h: 4, at: NOW });
    assert.equal(fifth.count24h, 4);
    assert.equal(fifth.exceedsMax, true);
  });

  it('zählt eine Gabe von genau vor 24 Stunden nicht mehr mit', () => {
    const result = assessDose({
      doses: [{ timestamp: hoursAgo(24) }, { timestamp: hoursAgo(3) }],
      minIntervalHours: 1,
      maxPer24h: 2,
      at: NOW,
    });
    assert.equal(result.count24h, 1);
    assert.equal(result.exceedsMax, false);
  });

  it('warnt auch, wenn eine schon eingetragene spätere Gabe zu nah liegt', () => {
    const result = assessDose({
      doses: [{ timestamp: new Date(NOW.getTime() + 2 * 3_600_000).toISOString() }],
      minIntervalHours: 6,
      maxPer24h: 4,
      at: NOW,
    });
    assert.equal(result.tooSoon, true);
    assert.equal(result.count24h, 0);
  });

  it('zählt Heute nach dem Berliner Kalendertag', () => {
    const result = assessDose({
      doses: [
        { timestamp: '2026-11-08T22:30:00.000Z' },
        { timestamp: '2026-11-08T23:30:00.000Z' },
        { timestamp: hoursAgo(2) },
      ],
      minIntervalHours: 1,
      maxPer24h: 4,
      at: NOW,
    });
    assert.equal(result.countToday, 2);
  });
});
