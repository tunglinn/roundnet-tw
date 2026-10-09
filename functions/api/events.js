import { validateEvent } from '../../lib/validate.js';
import { json, bad, readJson, newId, newToken } from '../../lib/http.js';

// GET /api/events?city=taipei — upcoming pickups (incl. ones that started in the last 3h)
export async function onRequestGet({ request, env }) {
  const city = new URL(request.url).searchParams.get('city');
  const args = [Date.now() - 3 * 3600 * 1000];
  let sql = `SELECT e.id, e.title, e.starts_at, e.ends_at, e.place_name, e.city, e.lat, e.lng,
                    e.level, e.max_players,
                    (SELECT COUNT(*) FROM signups s WHERE s.event_id = e.id) AS count
             FROM events e WHERE e.starts_ts >= ?`;
  if (city) {
    sql += ' AND e.city = ?';
    args.push(city);
  }
  sql += ' ORDER BY e.starts_ts LIMIT 200';
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json(results);
}

// POST /api/events — create; returns the secret edit_token once.
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return bad('err_bad_request');
  const { errors, value: v } = validateEvent(body);
  if (errors.length) return bad(errors);

  const id = newId();
  const edit_token = newToken();
  await env.DB.prepare(
    `INSERT INTO events (id, title, starts_at, ends_at, starts_ts, place_name, city, lat, lng,
                         level, max_players, contact, notes, edit_token, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, v.title, v.starts_at, v.ends_at, v.starts_ts, v.place_name, v.city, v.lat, v.lng,
         v.level, v.max_players, v.contact, v.notes, edit_token, Date.now()).run();

  return json({ id, edit_token }, 201);
}
