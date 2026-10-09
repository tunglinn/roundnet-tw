import { parsePeople, MAX_SIGNUPS_PER_EVENT } from '../../../../lib/validate.js';
import { json, bad, readJson, newId, newToken } from '../../../../lib/http.js';

// POST /api/events/:id/signups
//   {people: [{name: "Tung", brings: ["net", "balls"], note: "arrive ~3pm"}, ...]}
//   or {names: "Tung, Amy, Ben"} (names only)
// Each person becomes its own signup with its own remove_token (returned only here).
// Names already on the list (case-insensitive) are skipped, which also absorbs double-submits.
export async function onRequestPost({ params, request, env }) {
  const ev = await env.DB.prepare('SELECT id, cancelled_at FROM events WHERE id = ?').bind(params.id).first();
  if (!ev) return bad('err_not_found', 404);
  if (ev.cancelled_at) return bad('err_cancelled', 409);

  const body = await readJson(request);
  const people = parsePeople(body && (body.people ?? body.names));
  if (!people.length) return bad('err_names');

  const { results: existing } = await env.DB.prepare(
    'SELECT name FROM signups WHERE event_id = ?'
  ).bind(params.id).all();
  const taken = new Set(existing.map((r) => r.name.toLowerCase()));
  const fresh = people.filter((p) => !taken.has(p.name.toLowerCase()));
  const skipped = people.filter((p) => taken.has(p.name.toLowerCase())).map((p) => p.name);
  if (existing.length + fresh.length > MAX_SIGNUPS_PER_EVENT) return bad('err_too_many');

  const now = Date.now();
  const added = fresh.map((p) => ({ id: newId(), name: p.name, remove_token: newToken(), brings: p.brings, note: p.note }));
  if (added.length) {
    await env.DB.batch(added.map((s) =>
      env.DB.prepare(
        'INSERT INTO signups (id, event_id, name, brings, note, remove_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(s.id, params.id, s.name, s.brings.join(','), s.note, s.remove_token, now)
    ));
  }
  return json({ added, skipped }, 201);
}
