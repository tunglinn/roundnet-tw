import { describe, it, expect } from 'vitest';
import { addDays, daysBetween, taipeiDate, nextDates, templateFrom, occurrence } from '../../lib/series.js';

// Fri 2026-10-09 23:30 in Taipei (15:30 UTC)
const NOW = Date.parse('2026-10-09T23:30:00+08:00');

describe('date helpers', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-31', 7)).toBe('2026-11-07');
    expect(addDays('2026-12-29', 7)).toBe('2027-01-05');
    expect(addDays('2026-10-19', -7)).toBe('2026-10-12');
    expect(daysBetween('2026-10-12', '2026-10-13')).toBe(1);
  });

  it('uses Taipei date, not UTC', () => {
    expect(taipeiDate(Date.parse('2026-10-09T16:30:00Z'))).toBe('2026-10-10');
  });
});

describe('nextDates', () => {
  it('fills weekly dates up to 4 weeks ahead', () => {
    // horizon = 2026-11-06
    expect(nextDates('2026-10-10', { now: NOW })).toEqual(['2026-10-17', '2026-10-24', '2026-10-31']);
  });

  it('stops at the until date', () => {
    expect(nextDates('2026-10-10', { now: NOW, until: '2026-10-24' })).toEqual(['2026-10-17', '2026-10-24']);
  });

  it('returns nothing when already filled', () => {
    expect(nextDates('2026-11-01', { now: NOW })).toEqual([]);
  });
});

describe('templates', () => {
  it('round-trips an event through a template onto a new date', () => {
    const v = {
      title: 'Sat pickup', starts_at: '2026-10-10T14:00:00+08:00', ends_at: '2026-10-10T17:00:00+08:00',
      place_name: 'Daan', city: 'taipei', lat: 25, lng: 121.5, level: 'any',
      max_players: 12, min_players: 6, contact: '', notes: 'hi',
    };
    const o = occurrence(templateFrom(v), '2026-10-17');
    expect(o.starts_at).toBe('2026-10-17T14:00:00+08:00');
    expect(o.ends_at).toBe('2026-10-17T17:00:00+08:00');
    expect(o.starts_ts).toBe(Date.parse('2026-10-17T06:00:00Z'));
    expect(o).toMatchObject({ title: 'Sat pickup', max_players: 12, min_players: 6, notes: 'hi' });
  });
});
