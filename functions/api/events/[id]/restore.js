import { json } from '../../../../lib/http.js';
import { checkOrganizer } from '../../../../lib/auth.js';

// POST /api/events/:id/restore  (header X-Edit-Token) — undo a cancel.
export async function onRequestPost({ params, request, env }) {
  const { denied } = await checkOrganizer(request, env, params.id);
  if (denied) return denied;
  await env.DB.prepare("UPDATE events SET cancelled_at = NULL, cancel_reason = '' WHERE id = ?")
    .bind(params.id).run();
  return json({ ok: true });
}
