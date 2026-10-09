import { json, readJson } from '../../../../lib/http.js';
import { checkOrganizer } from '../../../../lib/auth.js';

// POST /api/events/:id/cancel  {reason}  (header X-Edit-Token)
// The pickup stays visible, marked cancelled; joining is closed.
export async function onRequestPost({ params, request, env }) {
  const { denied } = await checkOrganizer(request, env, params.id);
  if (denied) return denied;
  const body = await readJson(request);
  const reason = String((body && body.reason) || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);
  await env.DB.prepare('UPDATE events SET cancelled_at = ?, cancel_reason = ? WHERE id = ?')
    .bind(Date.now(), reason, params.id).run();
  return json({ ok: true });
}
