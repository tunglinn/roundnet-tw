// Web Push with plain WebCrypto (works in Workers and Node), no dependencies.
//   Payload encryption: RFC 8291 (aes128gcm content coding, RFC 8188)
//   Server identification: VAPID, RFC 8292
// Keys: VAPID_PUBLIC_KEY = raw P-256 public key (65 bytes), VAPID_PRIVATE_KEY = the 'd'
// scalar (32 bytes), both base64url. Generate with `npm run vapid`.

const enc = new TextEncoder();

export function b64url(bytes) {
  const b = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64url(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export function concat(...parts) {
  const arrs = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let i = 0;
  for (const a of arrs) { out.set(a, i); i += a.length; }
  return out;
}

export async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

// RFC 8291 key schedule, shared by encrypt (server) and the test's decrypt (browser side).
export async function deriveKeys({ ecdhSecret, auth, uaPublic, asPublic, salt }) {
  const prkKey = await hmac(auth, ecdhSecret);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, [1]));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), [1]))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), [1]))).slice(0, 12);
  return { cek, nonce };
}

// Encrypt `payload` (string) for a subscription's p256dh/auth keys. Returns the request body.
export async function encryptPayload(payload, p256dh, authSecret) {
  const uaPublic = unb64url(p256dh);
  const auth = unb64url(authSecret);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));

  const { cek, nonce } = await deriveKeys({ ecdhSecret, auth, uaPublic, asPublic, salt });
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // Single record: payload + 0x02 delimiter (last record), no padding.
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), [2])));

  // Header: salt(16) | record size(4) | keyid length(1) | keyid = our ephemeral public key(65)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = 65;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

// `Authorization` header value: vapid t=<ES256 JWT>, k=<public key>
export async function vapidAuth(endpoint, { publicKey, privateKey, subject }, now = Date.now()) {
  const pub = unb64url(publicKey);
  const jwk = { kty: 'EC', crv: 'P-256', d: privateKey, x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)) };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = (obj) => b64url(enc.encode(JSON.stringify(obj)));
  const unsigned = part({ typ: 'JWT', alg: 'ES256' }) + '.' +
    part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject });
  // WebCrypto's ECDSA signature is raw r||s, which is exactly the JWS ES256 format.
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned));
  return `vapid t=${unsigned}.${b64url(sig)}, k=${publicKey}`;
}

// Send one push. Returns the push service's HTTP status (201 = accepted, 404/410 = subscription gone).
export async function sendPush(sub, message, vapid) {
  const body = await encryptPayload(JSON.stringify(message), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: String(24 * 3600),
      urgency: 'normal',
      authorization: await vapidAuth(sub.endpoint, vapid),
    },
    body,
  });
  return res.status;
}

// Only ever POST to real browser push services (the server shouldn't fetch arbitrary URLs).
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/,   // Chrome, Android, Samsung
  /(^|\.)push\.apple\.com$/,                                 // Safari / iOS
  /^updates\.push\.services\.mozilla\.com$/,                 // Firefox
  /\.notify\.windows\.com$/,                                 // Edge
];

export function validEndpoint(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && PUSH_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}
