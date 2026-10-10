import { json, bad, readJson, newId } from '../../../lib/http.js';
import { validEndpoint, unb64url } from '../../../lib/webpush.js';
import { followTarget, NEW_TARGET_ALL } from '../../../lib/notify.js';
import { CITIES } from '../../../lib/validate.js';

const EVENT_KINDS = ['updates', 'signups'];

function keyLength(s) {
  try { return unb64url(s).length; } catch { return 0; }
}

// What to follow, from the request body. Returns [{target, kind}] or null.
//   {event_id, kinds: ['updates', 'signups']}  — one pickup (or its series, for 'signups')
//   {city: 'taipei' | 'all', kinds: ['new']}   — new pickups in a city / anywhere
export async function followsFor(env, b) {
  const kinds = Array.isArray(b.kinds) ? b.kinds : [];
  if (kinds.length === 1 && kinds[0] === 'new') {
    if (b.city !== 'all' && !CITIES.includes(b.city)) return null;
    return [{ target: b.city === 'all' ? NEW_TARGET_ALL : 'city:' + b.city, kind: 'new' }];
  }
  const ev = await env.DB.prepare('SELECT id, series_id FROM events WHERE id = ?').bind(b.event_id ?? '').first();
  const ok = kinds.filter((k) => EVENT_KINDS.includes(k));
  if (!ev || !ok.length) return null;
  return ok.map((k) => ({ target: followTarget(ev, k), kind: k }));
}

// POST /api/push/subscribe  {subscription: PushSubscription.toJSON(), lang: 'en'|'zh', ...what to follow}
// No login: what you follow is public info anyway (who joined, what changed, new pickups).
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const sub = b && b.subscription;
  const keys = (sub && sub.keys) || {};
  if (!sub || !validEndpoint(sub.endpoint) || keyLength(keys.p256dh) !== 65 || keyLength(keys.auth) !== 16) {
    return bad('err_push_sub');
  }
  const follows = await followsFor(env, b);
  if (!follows) return bad('err_bad_request');

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
    ...follows.map((f) => env.DB.prepare(
      'INSERT OR IGNORE INTO push_follows (sub_id, target, kind, created_at) VALUES (?, ?, ?, ?)'
    ).bind(id, f.target, f.kind, now)),
  ]);
  return json({ sub_id: id });
}
