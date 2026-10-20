import { parsePeople } from '../../../lib/validate.js';
import { json, bad, readJson } from '../../../lib/http.js';
import { notify, inBackground, signupDetails } from '../../../lib/notify.js';

// Changing or removing a signup is allowed with the name's X-Remove-Token
// (the device that added it) or the event's X-Edit-Token (the organizer).
// Returns {row} if allowed, otherwise {denied: Response}.
async function authorize(request, env, id) {
  const row = await env.DB.prepare(
    `SELECT s.event_id, s.name, s.going, s.remove_token, e.edit_token FROM signups s JOIN events e ON e.id = s.event_id
     WHERE s.id = ?`
  ).bind(id).first();
  if (!row) return { denied: bad('err_not_found', 404) };
  const rm = request.headers.get('x-remove-token');
  const ed = request.headers.get('x-edit-token');
  if (!((rm && rm === row.remove_token) || (ed && ed === row.edit_token))) {
    return { denied: bad('err_forbidden', 403) };
  }
  return { row };
}

const goingCount = async (env, eventId) =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM signups WHERE event_id = ? AND going = 1').bind(eventId).first()).n;

// PATCH /api/signups/:id  {name, brings: [...], note, going}
export async function onRequestPatch(ctx) {
  const { params, request, env } = ctx;
  const { row, denied } = await authorize(request, env, params.id);
  if (denied) return denied;
  const body = await readJson(request);
  const [p] = parsePeople([body]);
  if (!p) return bad('err_names');

  const clash = await env.DB.prepare(
    'SELECT 1 AS x FROM signups WHERE event_id = ? AND id != ? AND lower(name) = lower(?)'
  ).bind(row.event_id, params.id, p.name).first();
  if (clash) return bad('err_name_taken');

  await env.DB.prepare('UPDATE signups SET name = ?, brings = ?, note = ?, going = ? WHERE id = ?')
    .bind(p.name, p.brings.join(','), p.note, p.going ? 1 : 0, params.id).run();
  // Switching between going / not going is a join or leave; other edits by someone going are 'edited'.
  const exclude = request.headers.get('x-push-sub');
  if (p.going !== !!row.going) {
    inBackground(ctx, notify(env, {
      eventId: row.event_id, kinds: ['signups'], msg: p.going ? 'joined' : 'left', exclude,
      vars: { names: p.name, count: await goingCount(env, row.event_id) },
    }));
  } else if (p.going) {
    inBackground(ctx, notify(env, {
      eventId: row.event_id, kinds: ['signups'], msg: 'edited', exclude,
      vars: { name: p.name, details: (lang) => signupDetails(lang, p.brings, p.note) },
    }));
  }
  return json({ ok: true });
}

// DELETE /api/signups/:id
export async function onRequestDelete(ctx) {
  const { params, request, env } = ctx;
  const { row, denied } = await authorize(request, env, params.id);
  if (denied) return denied;
  await env.DB.prepare('DELETE FROM signups WHERE id = ?').bind(params.id).run();
  if (row.going) {
    inBackground(ctx, notify(env, {
      eventId: row.event_id, kinds: ['signups'], msg: 'left', exclude: request.headers.get('x-push-sub'),
      vars: { names: row.name, count: await goingCount(env, row.event_id) },
    }));
  }
  return json({ ok: true });
}
