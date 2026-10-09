// Test stand-ins for a browser (push subscription keys) and a push service (fetch).
import { b64url, unb64url, deriveKeys } from '../../lib/webpush.js';

export async function vapidKeys() {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const jwk = await crypto.subtle.exportKey('jwk', k.privateKey);
  return { publicKey: b64url(await crypto.subtle.exportKey('raw', k.publicKey)), privateKey: jwk.d };
}

// What PushManager.subscribe() would produce, plus the private key to decrypt with.
export async function fakeBrowser(endpoint = 'https://fcm.googleapis.com/fcm/send/' + crypto.randomUUID()) {
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    privateKey: ua.privateKey,
    subscription: {
      endpoint,
      keys: { p256dh: b64url(await crypto.subtle.exportKey('raw', ua.publicKey)), auth: b64url(auth) },
    },
  };
}

// Browser side of RFC 8291: decrypt an aes128gcm push body.
export async function decrypt(body, browser) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, browser.privateKey, 256));
  const { cek, nonce } = await deriveKeys({
    ecdhSecret, auth: unb64url(browser.subscription.keys.auth),
    uaPublic: unb64url(browser.subscription.keys.p256dh), asPublic, salt,
  });
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, body.slice(21 + idlen)));
  if (plain.at(-1) !== 2) throw new Error('missing last-record delimiter');
  return { rs, text: new TextDecoder().decode(plain.slice(0, -1)) };
}

// Replace global fetch with a fake push service that records requests.
export function fakePushService(status = 201) {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push({ url, headers: init.headers, body: new Uint8Array(init.body) });
    return new Response(null, { status: typeof status === 'function' ? status(url) : status });
  };
  return { sent, restore: () => { globalThis.fetch = realFetch; } };
}
