import { describe, it, expect } from 'vitest';
import { encryptPayload, vapidAuth, validEndpoint, b64url, unb64url } from '../../lib/webpush.js';
import { vapidKeys, fakeBrowser, decrypt } from '../api/push-helpers.js';

describe('payload encryption (RFC 8291)', () => {
  it('decrypts on the browser side to the original message', async () => {
    const browser = await fakeBrowser();
    const msg = JSON.stringify({ title: 'Sat pickup 大安', body: 'Tung, Amy joined · 5 going' });
    const body = await encryptPayload(msg, browser.subscription.keys.p256dh, browser.subscription.keys.auth);
    const { rs, text } = await decrypt(body, browser);
    expect(text).toBe(msg);
    expect(rs).toBe(4096);
    expect(body[20]).toBe(65);  // keyid = 65-byte uncompressed P-256 key
  });

  it('uses a fresh key and salt every time', async () => {
    const { subscription: { keys } } = await fakeBrowser();
    const a = await encryptPayload('x', keys.p256dh, keys.auth);
    const b = await encryptPayload('x', keys.p256dh, keys.auth);
    expect(b64url(a.slice(0, 86))).not.toBe(b64url(b.slice(0, 86)));
  });
});

describe('VAPID (RFC 8292)', () => {
  it('signs a JWT for the push service origin that verifies with the public key', async () => {
    const keys = await vapidKeys();
    const now = Date.parse('2026-10-10T00:00:00Z');
    const header = await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', { ...keys, subject: 'https://roundnet-tw.pages.dev' }, now);
    const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
    expect(k).toBe(keys.publicKey);
    const [h, c, sig] = jwt.split('.');
    expect(JSON.parse(new TextDecoder().decode(unb64url(h)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(new TextDecoder().decode(unb64url(c)))).toEqual({
      aud: 'https://fcm.googleapis.com', exp: now / 1000 + 12 * 3600, sub: 'https://roundnet-tw.pages.dev',
    });
    const pub = await crypto.subtle.importKey('raw', unb64url(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, unb64url(sig), new TextEncoder().encode(h + '.' + c));
    expect(ok).toBe(true);
  });
});

describe('validEndpoint', () => {
  it('only allows real push services over https', () => {
    expect(validEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true);
    expect(validEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(validEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
    expect(validEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(validEndpoint('https://evil.example.com/fcm.googleapis.com')).toBe(false);
    expect(validEndpoint('https://push.apple.com.evil.com/x')).toBe(false);
    expect(validEndpoint('not a url')).toBe(false);
  });
});
