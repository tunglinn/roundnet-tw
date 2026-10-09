import { parsePeople } from '../../../lib/validate.js';
import { json, bad, readJson } from '../../../lib/http.js';

// Changing or removing a signup is allowed with the name's X-Remove-Token
// (the device that added it) or the event's X-Edit-Token (the organizer).
// Returns {row} if allowed, otherwise {denied: Response}.
async function authorize(request, env, id) {
  const row = await env.DB.prepare(
    `SELECT s.event_id, s.remove_token, e.edit_token FROM signups s JOIN events e ON e.id = s.event_id
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

// PATCH /api/signups/:id  {name, brings: [...], note}
export async function onRequestPatch({ params, request, env }) {
  const { row, denied } = await authorize(request, env, params.id);
  if (denied) return denied;
  const body = await readJson(request);
  const [p] = parsePeople([body]);
  if (!p) return bad('err_names');

  const clash = await env.DB.prepare(
    'SELECT 1 AS x FROM signups WHERE event_id = ? AND id != ? AND lower(name) = lower(?)'
  ).bind(row.event_id, params.id, p.name).first();
  if (clash) return bad('err_name_taken');

  await env.DB.prepare('UPDATE signups SET name = ?, brings = ?, note = ? WHERE id = ?')
    .bind(p.name, p.brings.join(','), p.note, params.id).run();
  return json({ ok: true });
}

// DELETE /api/signups/:id
export async function onRequestDelete({ params, request, env }) {
  const { denied } = await authorize(request, env, params.id);
  if (denied) return denied;
  await env.DB.prepare('DELETE FROM signups WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
