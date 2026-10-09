import { json, bad, readJson, newId } from '../../../lib/http.js';
import { validEndpoint, unb64url } from '../../../lib/webpush.js';
import { followTarget } from '../../../lib/notify.js';

const KINDS = ['updates', 'signups'];

function keyLength(s) {
  try { return unb64url(s).length; } catch { return 0; }
}

// POST /api/push/subscribe
//   {subscription: PushSubscription.toJSON(), lang: 'en'|'zh', event_id, kinds: ['updates', 'signups']}
// No login: what you follow is public info anyway (who joined, what changed).
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const sub = b && b.subscription;
  const keys = (sub && sub.keys) || {};
  if (!sub || !validEndpoint(sub.endpoint) || keyLength(keys.p256dh) !== 65 || keyLength(keys.auth) !== 16) {
    return bad('err_push_sub');
  }
  const kinds = (Array.isArray(b.kinds) ? b.kinds : []).filter((k) => KINDS.includes(k));
  if (!kinds.length) return bad('err_bad_request');
  const ev = await env.DB.prepare('SELECT id, series_id FROM events WHERE id = ?').bind(b.event_id).first();
  if (!ev) return bad('err_not_found', 404);

  const lang = b.lang === 'zh' ? 'zh' : 'en';
  const now = Date.now();
  const existing = await env.DB.prepare('SELECT id FROM push_subs WHERE endpoint = ?').bind(sub.endpoint).first();
  const id = existing ? existing.id : newId();
  await env.DB.batch([
    existing
      ? env.DB.prepare('UPDATE push_subs SET p256dh = ?, auth = ?, lang = ? WHERE id = ?')
          .bind(keys.p256dh, keys.auth, lang, id)
      : env.DB.prepare('INSERT INTO push_subs (id, endpoint, p256dh, auth, lang, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(id, sub.endpoint, keys.p256dh, keys.auth, lang, now),
    ...kinds.map((k) => env.DB.prepare(
      'INSERT OR IGNORE INTO push_follows (sub_id, target, kind, created_at) VALUES (?, ?, ?, ?)'
    ).bind(id, followTarget(ev, k), k, now)),
  ]);
  return json({ sub_id: id });
}
