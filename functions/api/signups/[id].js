import { json, bad } from '../../../lib/http.js';

// DELETE /api/signups/:id — allowed with the name's X-Remove-Token
// (the device that added it) or the event's X-Edit-Token (the organizer).
export async function onRequestDelete({ params, request, env }) {
  const row = await env.DB.prepare(
    `SELECT s.remove_token, e.edit_token FROM signups s JOIN events e ON e.id = s.event_id
     WHERE s.id = ?`
  ).bind(params.id).first();
  if (!row) return bad('err_not_found', 404);

  const rm = request.headers.get('x-remove-token');
  const ed = request.headers.get('x-edit-token');
  if (!((rm && rm === row.remove_token) || (ed && ed === row.edit_token))) {
    return bad('err_forbidden', 403);
  }
  await env.DB.prepare('DELETE FROM signups WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
