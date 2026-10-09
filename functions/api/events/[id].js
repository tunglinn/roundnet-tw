import { validateEvent } from '../../../lib/validate.js';
import { json, bad, readJson } from '../../../lib/http.js';

const PUBLIC_COLS = `id, title, starts_at, ends_at, place_name, city, lat, lng, level,
                     max_players, min_players, contact, notes, created_at`;

// Returns null if ok, otherwise an error Response.
async function checkOrganizer(request, env, id) {
  const row = await env.DB.prepare('SELECT edit_token FROM events WHERE id = ?').bind(id).first();
  if (!row) return bad('err_not_found', 404);
  const token = request.headers.get('x-edit-token');
  if (!token || token !== row.edit_token) return bad('err_forbidden', 403);
  return null;
}

// GET /api/events/:id — event + signups in sign-up order (no tokens)
export async function onRequestGet({ params, env }) {
  const ev = await env.DB.prepare(`SELECT ${PUBLIC_COLS} FROM events WHERE id = ?`).bind(params.id).first();
  if (!ev) return bad('err_not_found', 404);
  const { results } = await env.DB.prepare(
    'SELECT id, name, brings, note FROM signups WHERE event_id = ? ORDER BY created_at, rowid'
  ).bind(params.id).all();
  const signups = results.map((s) => ({ ...s, brings: s.brings ? s.brings.split(',') : [] }));
  return json({ ...ev, signups });
}

// PUT /api/events/:id  (header X-Edit-Token)
export async function onRequestPut({ params, request, env }) {
  const denied = await checkOrganizer(request, env, params.id);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return bad('err_bad_request');
  const { errors, value: v } = validateEvent(body);
  if (errors.length) return bad(errors);

  await env.DB.prepare(
    `UPDATE events SET title = ?, starts_at = ?, ends_at = ?, starts_ts = ?, place_name = ?, city = ?,
                       lat = ?, lng = ?, level = ?, max_players = ?, min_players = ?, contact = ?, notes = ?
     WHERE id = ?`
  ).bind(v.title, v.starts_at, v.ends_at, v.starts_ts, v.place_name, v.city, v.lat, v.lng,
         v.level, v.max_players, v.min_players, v.contact, v.notes, params.id).run();
  return json({ ok: true });
}

// DELETE /api/events/:id  (header X-Edit-Token)
export async function onRequestDelete({ params, request, env }) {
  const denied = await checkOrganizer(request, env, params.id);
  if (denied) return denied;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM signups WHERE event_id = ?').bind(params.id),
    env.DB.prepare('DELETE FROM events WHERE id = ?').bind(params.id),
  ]);
  return json({ ok: true });
}
