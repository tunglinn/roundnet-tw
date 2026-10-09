// Weekly repeating pickups. A series stores a template (everything except the date);
// each date is a normal row in `events` with series_id set, so signups stay per date.
// Upcoming dates are created lazily (no cron on Pages): topUpSeries() runs on reads.

import { newId } from './http.js';

export const HORIZON_DAYS = 28;
const DAY = 24 * 3600 * 1000;

// ---------- pure helpers (unit-tested) ----------

// '2026-10-12' + 7 -> '2026-10-19'
export function addDays(date, n) {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY);
}

// Today's date in Taipei.
export function taipeiDate(now = Date.now()) {
  return new Date(now + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// Weekly dates after `last`, up to `today + HORIZON_DAYS` and `until` (inclusive).
export function nextDates(last, { now = Date.now(), until = null } = {}) {
  const horizon = addDays(taipeiDate(now), HORIZON_DAYS);
  const out = [];
  for (let d = addDays(last, 7); d <= horizon && (!until || d <= until); d = addDays(d, 7)) out.push(d);
  return out;
}

// Template = validated event value minus the date-specific parts.
export function templateFrom(v) {
  return {
    title: v.title, start: v.starts_at.slice(11, 16), end: v.ends_at ? v.ends_at.slice(11, 16) : null,
    place_name: v.place_name, city: v.city, lat: v.lat, lng: v.lng, level: v.level,
    max_players: v.max_players, min_players: v.min_players, contact: v.contact, notes: v.notes,
  };
}

// Template + date -> the columns of one events row.
export function occurrence(tpl, date) {
  const starts_at = `${date}T${tpl.start}:00+08:00`;
  return {
    title: tpl.title, starts_at, ends_at: tpl.end ? `${date}T${tpl.end}:00+08:00` : null,
    starts_ts: Date.parse(starts_at), place_name: tpl.place_name, city: tpl.city, lat: tpl.lat, lng: tpl.lng,
    level: tpl.level, max_players: tpl.max_players, min_players: tpl.min_players,
    contact: tpl.contact, notes: tpl.notes,
  };
}

// ---------- D1 ----------

export function insertEvent(env, id, o, { edit_token, series_id = null, now = Date.now() }) {
  return env.DB.prepare(
    `INSERT INTO events (id, title, starts_at, ends_at, starts_ts, place_name, city, lat, lng, level,
                         max_players, min_players, contact, notes, edit_token, series_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, o.title, o.starts_at, o.ends_at, o.starts_ts, o.place_name, o.city, o.lat, o.lng, o.level,
         o.max_players, o.min_players, o.contact, o.notes, edit_token, series_id, now);
}

// Create missing upcoming dates for every active series. One read when nothing is due.
export async function topUpSeries(env, now = Date.now()) {
  const horizonTs = Date.parse(addDays(taipeiDate(now), HORIZON_DAYS - 6) + 'T00:00:00+08:00');
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.template, s.until_date, s.edit_token, MAX(e.starts_at) AS last_at
     FROM series s JOIN events e ON e.series_id = s.id
     WHERE s.ended_at IS NULL
     GROUP BY s.id HAVING MAX(e.starts_ts) < ?`
  ).bind(horizonTs).all();

  const stmts = [];
  for (const s of results) {
    const tpl = JSON.parse(s.template);
    for (const date of nextDates(s.last_at.slice(0, 10), { now, until: s.until_date })) {
      stmts.push(insertEvent(env, newId(), occurrence(tpl, date), { edit_token: s.edit_token, series_id: s.id, now }));
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
}
