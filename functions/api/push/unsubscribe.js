import { json, bad, readJson } from '../../../lib/http.js';
import { followTarget } from '../../../lib/notify.js';

// POST /api/push/unsubscribe  {endpoint, event_id, kinds}
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  if (!b || !b.endpoint) return bad('err_bad_request');
  const sub = await env.DB.prepare('SELECT id FROM push_subs WHERE endpoint = ?').bind(b.endpoint).first();
  const ev = await env.DB.prepare('SELECT id, series_id FROM events WHERE id = ?').bind(b.event_id).first();
  if (!sub || !ev) return json({ ok: true });
  const kinds = Array.isArray(b.kinds) && b.kinds.length ? b.kinds : ['updates', 'signups'];
  await env.DB.batch(kinds.map((k) => env.DB.prepare(
    'DELETE FROM push_follows WHERE sub_id = ? AND target = ? AND kind = ?'
  ).bind(sub.id, followTarget(ev, k), k)));
  return json({ ok: true });
}
