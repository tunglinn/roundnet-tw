// Who gets which notification, and what it says.
// A device (push_subs row) follows a target with a kind:
//   kind 'updates' — pickup changed / cancelled / back on    (players; target = event id)
//   kind 'signups' — people joined / left                     (organizers; target = event id,
//                                                              or 's:<series id>' for every date)
// Organizers follow both kinds, so they also hear about changes made by co-organizers.

import { sendPush } from './webpush.js';

const MSG = {
  en: {
    joined: '{names} joined · {count} going',
    left: '{names} left · {count} going',
    changed: 'Updated: {when} · {place}',
    cancelled: 'Cancelled: {when}{reason}',
    restored: 'Back on: {when} · {place}',
  },
  zh: {
    joined: '{names} 報名了 · 共 {count} 人',
    left: '{names} 取消報名 · 共 {count} 人',
    changed: '已更新：{when} · {place}',
    cancelled: '已取消：{when}{reason}',
    restored: '恢復舉行：{when} · {place}',
  },
};

export function messageText(lang, msg, vars) {
  const tpl = (MSG[lang] || MSG.en)[msg];
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
}

// "Tung, Amy, Ben +2"
export function namesText(names, max = 3) {
  return names.slice(0, max).join(', ') + (names.length > max ? ` +${names.length - max}` : '');
}

// "10/12 14:00"
export function whenText(starts_at) {
  return starts_at.slice(5, 10).replace('-', '/') + ' ' + starts_at.slice(11, 16);
}

export function followTarget(ev, kind) {
  return kind === 'signups' && ev.series_id ? 's:' + ev.series_id : ev.id;
}

// Push `msg` about one pickup to every device following it with one of `kinds`,
// except `exclude` (the device that made the change). Never throws.
export async function notify(env, { eventId, kinds, msg, vars = {}, exclude = null }) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 0;  // push not configured
  const ev = await env.DB.prepare(
    'SELECT id, title, starts_at, place_name, series_id FROM events WHERE id = ?'
  ).bind(eventId).first();
  if (!ev) return 0;

  const { results: subs } = await env.DB.prepare(
    `SELECT DISTINCT s.id, s.endpoint, s.p256dh, s.auth, s.lang
     FROM push_follows f JOIN push_subs s ON s.id = f.sub_id
     WHERE f.target IN (?, ?) AND f.kind IN (${kinds.map(() => '?').join(', ')}) AND s.id != ?`
  ).bind(ev.id, ev.series_id ? 's:' + ev.series_id : ev.id, ...kinds, exclude || '').all();

  const vapid = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || 'https://roundnet-tw.pages.dev',
  };
  const all = { when: whenText(ev.starts_at), place: ev.place_name, ...vars };
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    const lang = s.lang === 'zh' ? 'zh' : 'en';
    const message = {
      title: ev.title,
      body: messageText(lang, msg, all),
      url: '/event?id=' + ev.id,
      tag: ev.id,  // a newer notification about the same pickup replaces the older one
    };
    try {
      const status = await sendPush(s, message, vapid);
      if (status === 404 || status === 410) {
        // Browser unsubscribed or the subscription expired: forget it.
        await env.DB.batch([
          env.DB.prepare('DELETE FROM push_follows WHERE sub_id = ?').bind(s.id),
          env.DB.prepare('DELETE FROM push_subs WHERE id = ?').bind(s.id),
        ]);
      } else if (status < 300) {
        sent++;
      }
    } catch {
      // Network hiccup: skip this one rather than fail the user's request.
    }
  }));
  return sent;
}

// Run notifications after the response is sent (Pages `waitUntil`), never failing the request.
export function inBackground(ctx, promise) {
  ctx.waitUntil(Promise.resolve(promise).catch(() => {}));
}
