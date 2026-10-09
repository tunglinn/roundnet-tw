import { describe, it, expect } from 'vitest';
import { validateEvent, parseNames, parsePeople } from '../../lib/validate.js';

const NOW = Date.parse('2026-10-09T12:00:00+08:00');
const good = {
  title: 'Sunday pickup', date: '2026-10-12', start: '14:00', end: '17:00',
  place_name: 'Daan Park', city: 'taipei', lat: 25.03, lng: 121.53,
  level: 'any', max_players: '', contact: 'LINE: abc', notes: '',
};

describe('validateEvent', () => {
  it('accepts a valid event and builds Taipei timestamps', () => {
    const { errors, value } = validateEvent(good, NOW);
    expect(errors).toEqual([]);
    expect(value.starts_at).toBe('2026-10-12T14:00:00+08:00');
    expect(value.ends_at).toBe('2026-10-12T17:00:00+08:00');
    expect(value.starts_ts).toBe(Date.parse('2026-10-12T06:00:00Z'));
    expect(value.max_players).toBeNull();
  });

  it('flags missing required fields', () => {
    const { errors } = validateEvent({}, NOW);
    expect(errors).toEqual(expect.arrayContaining(['err_title', 'err_date', 'err_place', 'err_city', 'err_location']));
  });

  it('rejects past dates and dates more than 6 months out', () => {
    expect(validateEvent({ ...good, date: '2026-10-01' }, NOW).errors).toContain('err_date_range');
    expect(validateEvent({ ...good, date: '2027-06-01' }, NOW).errors).toContain('err_date_range');
  });

  it('rejects end before start', () => {
    expect(validateEvent({ ...good, end: '13:00' }, NOW).errors).toEqual(['err_end']);
  });

  it('rejects locations outside Taiwan but allows Kinmen', () => {
    expect(validateEvent({ ...good, lat: 35.68, lng: 139.76 }, NOW).errors).toEqual(['err_location']);
    expect(validateEvent({ ...good, lat: 24.43, lng: 118.32, city: 'kinmen' }, NOW).errors).toEqual([]);
    expect(validateEvent({ ...good, lat: '', lng: '' }, NOW).errors).toEqual(['err_location']);
  });

  it('validates max players and level', () => {
    expect(validateEvent({ ...good, max_players: '12' }, NOW).value.max_players).toBe(12);
    expect(validateEvent({ ...good, max_players: 1 }, NOW).errors).toEqual(['err_max']);
    expect(validateEvent({ ...good, max_players: 2.5 }, NOW).errors).toEqual(['err_max']);
    expect(validateEvent({ ...good, level: 'pro' }, NOW).errors).toEqual(['err_level']);
  });

  it('trims text and enforces length caps', () => {
    expect(validateEvent({ ...good, title: '  Hi  ' }, NOW).value.title).toBe('Hi');
    expect(validateEvent({ ...good, title: 'x'.repeat(81) }, NOW).errors).toEqual(['err_title']);
    expect(validateEvent({ ...good, notes: 'x'.repeat(1001) }, NOW).errors).toEqual(['err_notes']);
  });
});

describe('parseNames', () => {
  it('splits on English and Chinese separators, trims and dedupes', () => {
    expect(parseNames('Tung, Amy，小明、Ben\n amy ;  ')).toEqual(['Tung', 'Amy', '小明', 'Ben']);
  });

  it('collapses inner whitespace and caps name length', () => {
    expect(parseNames('Mary   Jane')).toEqual(['Mary Jane']);
    expect(parseNames('x'.repeat(60))[0]).toHaveLength(40);
  });

  it('caps the number of names and handles junk input', () => {
    expect(parseNames(Array.from({ length: 30 }, (_, i) => 'p' + i))).toHaveLength(20);
    expect(parseNames(undefined)).toEqual([]);
    expect(parseNames(' , ,, ')).toEqual([]);
  });
});

describe('parsePeople', () => {
  it('keeps only known gear, trims notes, dedupes names', () => {
    expect(parsePeople([
      { name: ' Tung ', brings: ['net', 'balls', 'pizza'], note: '  arrive   ~3pm ' },
      { name: 'tung', brings: ['cones'] },
      { name: 'Amy', brings: 'net' },
      { name: '' },
      null,
    ])).toEqual([
      { name: 'Tung', brings: ['net', 'balls'], note: 'arrive ~3pm' },
      { name: 'Amy', brings: [], note: '' },
    ]);
  });

  it('caps note length', () => {
    expect(parsePeople([{ name: 'A', note: 'x'.repeat(150) }])[0].note).toHaveLength(100);
  });

  it('falls back to comma-separated names', () => {
    expect(parsePeople('Tung, Amy')).toEqual([
      { name: 'Tung', brings: [], note: '' },
      { name: 'Amy', brings: [], note: '' },
    ]);
  });
});
