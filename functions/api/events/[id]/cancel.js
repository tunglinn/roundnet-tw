import { json, readJson } from '../../../../lib/http.js';
import { checkOrganizer } from '../../../../lib/auth.js';
import { notify, inBackground } from '../../../../lib/notify.js';

// POST /api/events/:id/cancel  {reason}  (header X-Edit-Token)
// The pickup stays visible, marked cancelled; joining is closed.
export async function onRequestPost(ctx) {
  const { params, request, env } = ctx;
  const { denied } = await checkOrganizer(request, env, params.id);
  if (denied) return denied;
  const body = await readJson(request);
  const reason = String((body && body.reason) || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);
  await env.DB.prepare('UPDATE events SET cancelled_at = ?, cancel_reason = ? WHERE id = ?')
    .bind(Date.now(), reason, params.id).run();
  inBackground(ctx, notify(env, {
    eventId: params.id, kinds: ['updates', 'signups'], msg: 'cancelled',
    exclude: request.headers.get('x-push-sub'), vars: { reason: reason ? ' · ' + reason : '' },
  }));
  return json({ ok: true });
}
