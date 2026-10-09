import { validateEvent } from '../../lib/validate.js';
import { json, bad, readJson, newId, newToken } from '../../lib/http.js';
import { topUpSeries, templateFrom, occurrence, nextDates, insertEvent } from '../../lib/series.js';

// GET /api/events?city=taipei — upcoming pickups (incl. ones that started in the last 3h).
// Cancelled pickups are included so people can see they were cancelled.
export async function onRequestGet({ request, env }) {
  await topUpSeries(env);
  const city = new URL(request.url).searchParams.get('city');
  const args = [Date.now() - 3 * 3600 * 1000];
  let sql = `SELECT e.id, e.title, e.starts_at, e.ends_at, e.place_name, e.city, e.lat, e.lng,
                    e.level, e.max_players, e.min_players, e.series_id, e.cancelled_at, e.cancel_reason,
                    (SELECT COUNT(*) FROM signups s WHERE s.event_id = e.id) AS count,
                    EXISTS (SELECT 1 FROM signups s WHERE s.event_id = e.id
                            AND ',' || s.brings || ',' LIKE '%,net,%') AS has_net,
                    EXISTS (SELECT 1 FROM signups s WHERE s.event_id = e.id
                            AND ',' || s.brings || ',' LIKE '%,balls,%') AS has_balls
             FROM events e WHERE e.starts_ts >= ?`;
  if (city) {
    sql += ' AND e.city = ?';
    args.push(city);
  }
  sql += ' ORDER BY e.starts_ts LIMIT 300';
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return json(results);
}

// POST /api/events — create; returns the secret edit_token once.
// With repeat: 'weekly' also creates the series and its dates for the next 4 weeks.
export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body) return bad('err_bad_request');
  const { errors, value: v } = validateEvent(body);
  if (errors.length) return bad(errors);

  const id = newId();
  const edit_token = newToken();
  const now = Date.now();

  if (v.repeat !== 'weekly') {
    await insertEvent(env, id, v, { edit_token, now }).run();
    return json({ id, edit_token }, 201);
  }

  const series_id = newId();
  const tpl = templateFrom(v);
  const date = v.starts_at.slice(0, 10);
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO series (id, template, until_date, edit_token, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(series_id, JSON.stringify(tpl), v.until, edit_token, now),
    insertEvent(env, id, v, { edit_token, series_id, now }),
    ...nextDates(date, { now, until: v.until }).map((d) =>
      insertEvent(env, newId(), occurrence(tpl, d), { edit_token, series_id, now })),
  ]);
  return json({ id, edit_token, series_id }, 201);
}
