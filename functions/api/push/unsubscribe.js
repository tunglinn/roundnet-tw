import { json, bad, readJson } from '../../../lib/http.js';
import { followsFor } from './subscribe.js';

// POST /api/push/unsubscribe  {endpoint, ...same "what to follow" fields as subscribe}
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  if (!b || !b.endpoint) return bad('err_bad_request');
  const sub = await env.DB.prepare('SELECT id FROM push_subs WHERE endpoint = ?').bind(b.endpoint).first();
  // No kinds given for a pickup = stop all notifications about it.
  const kinds = Array.isArray(b.kinds) && b.kinds.length ? b.kinds : ['updates', 'signups'];
  const follows = await followsFor(env, { ...b, kinds });
  if (!sub || !follows) return json({ ok: true });
  await env.DB.batch(follows.map((f) => env.DB.prepare(
    'DELETE FROM push_follows WHERE sub_id = ? AND target = ? AND kind = ?'
  ).bind(sub.id, f.target, f.kind)));
  return json({ ok: true });
}
