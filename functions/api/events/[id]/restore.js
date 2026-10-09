import { json } from '../../../../lib/http.js';
import { checkOrganizer } from '../../../../lib/auth.js';
import { notify, inBackground } from '../../../../lib/notify.js';

// POST /api/events/:id/restore  (header X-Edit-Token) — undo a cancel.
export async function onRequestPost(ctx) {
  const { params, request, env } = ctx;
  const { denied } = await checkOrganizer(request, env, params.id);
  if (denied) return denied;
  await env.DB.prepare("UPDATE events SET cancelled_at = NULL, cancel_reason = '' WHERE id = ?")
    .bind(params.id).run();
  inBackground(ctx, notify(env, {
    eventId: params.id, kinds: ['updates', 'signups'], msg: 'restored', exclude: request.headers.get('x-push-sub'),
  }));
  return json({ ok: true });
}
