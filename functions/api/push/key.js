import { json, bad } from '../../../lib/http.js';

// GET /api/push/key — the VAPID public key browsers need to subscribe.
export async function onRequestGet({ env }) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return bad('err_push_off', 503);
  return json({ key: env.VAPID_PUBLIC_KEY });
}
