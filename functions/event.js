// GET /event?id=… — serves the static event.html but fills in Open Graph tags,
// so a shared link previews nicely in LINE / Messenger / Instagram DMs.
export async function onRequestGet({ request, env, next }) {
  const res = await next();
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !res.ok) return res;

  const ev = await env.DB.prepare(
    `SELECT title, starts_at, ends_at, place_name,
            (SELECT COUNT(*) FROM signups s WHERE s.event_id = events.id) AS count
     FROM events WHERE id = ?`
  ).bind(id).first();
  if (!ev) return res;

  const when = ev.starts_at.slice(5, 10).replace('-', '/') + ' ' + ev.starts_at.slice(11, 16) +
    (ev.ends_at ? '–' + ev.ends_at.slice(11, 16) : '');
  const desc = `${when} · ${ev.place_name} · ${ev.count} going / 人參加`;

  return new HTMLRewriter()
    .on('meta[property="og:title"]', { element: (el) => el.setAttribute('content', ev.title) })
    .on('meta[property="og:description"]', { element: (el) => el.setAttribute('content', desc) })
    .on('meta[name="description"]', { element: (el) => el.setAttribute('content', desc) })
    .on('title', { element: (el) => el.setInnerContent(`${ev.title} · Roundnet Taiwan`) })
    .transform(res);
}
