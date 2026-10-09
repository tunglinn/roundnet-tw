import { bad } from './http.js';

// Organizer check via X-Edit-Token. Returns {ev} (the full events row) or {denied: Response}.
export async function checkOrganizer(request, env, id) {
  const ev = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  if (!ev) return { denied: bad('err_not_found', 404) };
  const token = request.headers.get('x-edit-token');
  if (!token || token !== ev.edit_token) return { denied: bad('err_forbidden', 403) };
  return { ev };
}
