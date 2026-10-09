import { parseNames, MAX_SIGNUPS_PER_EVENT } from '../../../../lib/validate.js';
import { json, bad, readJson, newId, newToken } from '../../../../lib/http.js';

// POST /api/events/:id/signups  {names: "Tung, Amy, Ben"}
// Each name becomes its own signup with its own remove_token (returned only here).
// Names already on the list (case-insensitive) are skipped, which also absorbs double-submits.
export async function onRequestPost({ params, request, env }) {
  const ev = await env.DB.prepare('SELECT id FROM events WHERE id = ?').bind(params.id).first();
  if (!ev) return bad('err_not_found', 404);

  const body = await readJson(request);
  const names = parseNames(body && body.names);
  if (!names.length) return bad('err_names');

  const { results: existing } = await env.DB.prepare(
    'SELECT name FROM signups WHERE event_id = ?'
  ).bind(params.id).all();
  const taken = new Set(existing.map((r) => r.name.toLowerCase()));
  const fresh = names.filter((n) => !taken.has(n.toLowerCase()));
  const skipped = names.filter((n) => taken.has(n.toLowerCase()));
  if (existing.length + fresh.length > MAX_SIGNUPS_PER_EVENT) return bad('err_too_many');

  const now = Date.now();
  const added = fresh.map((name) => ({ id: newId(), name, remove_token: newToken() }));
  if (added.length) {
    await env.DB.batch(added.map((s) =>
      env.DB.prepare(
        'INSERT INTO signups (id, event_id, name, remove_token, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(s.id, params.id, s.name, s.remove_token, now)
    ));
  }
  return json({ added, skipped }, 201);
}
