import { validateEvent } from '../../../lib/validate.js';
import { json, bad, readJson } from '../../../lib/http.js';
import { checkOrganizer } from '../../../lib/auth.js';
import { notify, inBackground } from '../../../lib/notify.js';
import { topUpSeries, templateFrom, occurrence, addDays, daysBetween } from '../../../lib/series.js';

const PUBLIC_COLS = `id, title, starts_at, ends_at, place_name, city, lat, lng, level,
                     max_players, min_players, contact, notes, series_id, cancelled_at, cancel_reason, created_at`;

// GET /api/events/:id — event + signups in sign-up order (no tokens).
// For a weekly pickup, `series.dates` lists its upcoming dates for the date bar.
export async function onRequestGet({ params, env }) {
  await topUpSeries(env);
  const ev = await env.DB.prepare(`SELECT ${PUBLIC_COLS} FROM events WHERE id = ?`).bind(params.id).first();
  if (!ev) return bad('err_not_found', 404);
  const { results } = await env.DB.prepare(
    'SELECT id, name, brings, note FROM signups WHERE event_id = ? ORDER BY created_at, rowid'
  ).bind(params.id).all();
  const signups = results.map((s) => ({ ...s, brings: s.brings ? s.brings.split(',') : [] }));

  let series = null;
  if (ev.series_id) {
    const s = await env.DB.prepare('SELECT until_date, ended_at FROM series WHERE id = ?').bind(ev.series_id).first();
    const { results: dates } = await env.DB.prepare(
      `SELECT id, starts_at, cancelled_at FROM events
       WHERE series_id = ? AND (starts_ts >= ? OR id = ?) ORDER BY starts_ts`
    ).bind(ev.series_id, Date.now() - 3 * 3600 * 1000, ev.id).all();
    series = { until_date: s.until_date, ended: !!s.ended_at, dates };
  }
  return json({ ...ev, signups, series });
}

function updateStmt(env, id, o) {
  return env.DB.prepare(
    `UPDATE events SET title = ?, starts_at = ?, ends_at = ?, starts_ts = ?, place_name = ?, city = ?,
                       lat = ?, lng = ?, level = ?, max_players = ?, min_players = ?, contact = ?, notes = ?
     WHERE id = ?`
  ).bind(o.title, o.starts_at, o.ends_at, o.starts_ts, o.place_name, o.city, o.lat, o.lng,
         o.level, o.max_players, o.min_players, o.contact, o.notes, id);
}

// PUT /api/events/:id  (header X-Edit-Token)
// body.scope = 'future' (weekly pickups only): apply to this and all later dates, and to
// dates created from now on. Moving the date shifts every later date by the same number of days.
export async function onRequestPut(ctx) {
  const { params, request, env } = ctx;
  const { ev, denied } = await checkOrganizer(request, env, params.id);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return bad('err_bad_request');
  const { errors, value: v } = validateEvent(body);
  if (errors.length) return bad(errors);

  const exclude = request.headers.get('x-push-sub');
  const changed = (id, kinds = ['updates', 'signups']) => notify(env, { eventId: id, kinds, msg: 'changed', exclude });

  if (body.scope !== 'future' || !ev.series_id) {
    await updateStmt(env, params.id, v).run();
    inBackground(ctx, changed(params.id));
    return json({ ok: true });
  }

  const tpl = templateFrom(v);
  const shift = daysBetween(ev.starts_at.slice(0, 10), v.starts_at.slice(0, 10));
  const { results: later } = await env.DB.prepare(
    'SELECT id, starts_at FROM events WHERE series_id = ? AND starts_ts >= ?'
  ).bind(ev.series_id, ev.starts_ts).all();
  await env.DB.batch([
    env.DB.prepare('UPDATE series SET template = ? WHERE id = ?').bind(JSON.stringify(tpl), ev.series_id),
    ...later.map((e) => updateStmt(env, e.id, occurrence(tpl, addDays(e.starts_at.slice(0, 10), shift)))),
  ]);
  // Players follow single dates, so tell each changed date's followers. Organizers follow
  // the whole series, so they get one notification instead of one per date.
  inBackground(ctx, Promise.all([
    ...later.map((e) => changed(e.id, ['updates'])),
    changed(params.id, ['signups']),
  ]));
  return json({ ok: true });
}

// DELETE /api/events/:id  (header X-Edit-Token)
// Pickups aren't deleted once people know about them; they get cancelled instead.
// Only a one-off pickup nobody has joined can be deleted (typos, tests).
export async function onRequestDelete({ params, request, env }) {
  const { ev, denied } = await checkOrganizer(request, env, params.id);
  if (denied) return denied;
  const joined = await env.DB.prepare('SELECT 1 AS x FROM signups WHERE event_id = ? LIMIT 1').bind(params.id).first();
  if (joined || ev.series_id) return bad('err_cannot_delete', 409);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM events WHERE id = ?').bind(params.id),
    env.DB.prepare('DELETE FROM push_follows WHERE target = ?').bind(params.id),
  ]);
  return json({ ok: true });
}
