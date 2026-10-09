import { json, bad } from '../../../../lib/http.js';
import { checkOrganizer } from '../../../../lib/auth.js';

// POST /api/events/:id/end-series  (header X-Edit-Token)
// Stops the weekly series after this date: no new dates are created; later dates
// nobody joined are removed, later dates with signups are cancelled (so people find out).
export async function onRequestPost({ params, request, env }) {
  const { ev, denied } = await checkOrganizer(request, env, params.id);
  if (denied) return denied;
  if (!ev.series_id) return bad('err_bad_request');

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE series SET ended_at = ?, until_date = ? WHERE id = ?')
      .bind(now, ev.starts_at.slice(0, 10), ev.series_id),
    env.DB.prepare(
      `DELETE FROM events WHERE series_id = ? AND starts_ts > ?
       AND NOT EXISTS (SELECT 1 FROM signups s WHERE s.event_id = events.id)`
    ).bind(ev.series_id, ev.starts_ts),
    env.DB.prepare(
      `UPDATE events SET cancelled_at = COALESCE(cancelled_at, ?)
       WHERE series_id = ? AND starts_ts > ?`
    ).bind(now, ev.series_id, ev.starts_ts),
  ]);
  return json({ ok: true });
}
