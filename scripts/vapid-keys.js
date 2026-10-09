// Prints a new VAPID key pair for push notifications (npm run vapid).
// Public key -> "vars" in wrangler.jsonc. Private key -> .dev.vars locally, and a Pages secret in production.
import { b64url } from '../lib/webpush.js';

const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const jwk = await crypto.subtle.exportKey('jwk', k.privateKey);
console.log('VAPID_PUBLIC_KEY=' + b64url(await crypto.subtle.exportKey('raw', k.publicKey)));
console.log('VAPID_PRIVATE_KEY=' + jwk.d);
