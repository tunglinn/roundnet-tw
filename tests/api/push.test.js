import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fakeD1, call } from './fake-d1.js';
import { vapidKeys, fakeBrowser, decrypt, fakePushService } from './push-helpers.js';
import * as events from '../../functions/api/events.js';
import * as event from '../../functions/api/events/[id].js';
import * as signups from '../../functions/api/events/[id]/signups.js';
import * as signup from '../../functions/api/signups/[id].js';
import * as cancel from '../../functions/api/events/[id]/cancel.js';
import * as subscribe from '../../functions/api/push/subscribe.js';
import * as unsubscribe from '../../functions/api/push/unsubscribe.js';
import * as key from '../../functions/api/push/key.js';
import { addDays, taipeiDate } from '../../lib/series.js';

const base = {
  title: 'Sat pickup', date: addDays(taipeiDate(), 2), start: '14:00', place_name: 'Daan Park',
  city: 'taipei', lat: 25.03, lng: 121.53,
};

let env, push;
beforeEach(async () => {
  env = { DB: fakeD1(), ...(await vapidKeys()) };
  env.VAPID_PUBLIC_KEY = env.publicKey;
  env.VAPID_PRIVATE_KEY = env.privateKey;
  push = fakePushService();
});
afterEach(() => push.restore());

const create = (extra = {}) => call(events.onRequestPost, { env, method: 'POST', body: { ...base, ...extra } }).then((r) => r.data);
const follow = (browser, event_id, kinds, lang = 'en') =>
  call(subscribe.onRequestPost, { env, method: 'POST', body: { subscription: browser.subscription, event_id, kinds, lang } });
const join = (id, people, headers = {}) =>
  call(signups.onRequestPost, { env, params: { id }, method: 'POST', body: { people }, headers });
const received = async (browser) => Promise.all(
  push.sent.filter((s) => s.url === browser.subscription.endpoint).map(async (s) => JSON.parse((await decrypt(s.body, browser)).text)));

describe('push notifications', () => {
  it('serves the public key only when configured', async () => {
    expect((await call(key.onRequestGet, { env })).data).toEqual({ key: env.VAPID_PUBLIC_KEY });
    expect((await call(key.onRequestGet, { env: { DB: env.DB } })).status).toBe(503);
  });

  it('tells the organizer who joined and left, in their language', async () => {
    const ev = await create();
    const organizer = await fakeBrowser();
    await follow(organizer, ev.id, ['signups', 'updates'], 'zh');
    const { data } = await join(ev.id, [{ name: 'Tung' }, { name: 'Amy' }]);
    await call(signup.onRequestDelete, {
      env, params: { id: data.added[1].id }, method: 'DELETE', headers: { 'x-remove-token': data.added[1].remove_token },
    });
    const msgs = await received(organizer);
    expect(msgs.map((m) => m.body)).toEqual(['Tung, Amy 報名了 · 共 2 人', 'Amy 取消報名 · 共 1 人']);
    expect(msgs[0]).toMatchObject({ title: 'Sat pickup', url: '/event?id=' + ev.id, tag: ev.id });
    const req = push.sent[0];
    expect(req.headers['content-encoding']).toBe('aes128gcm');
    expect(req.headers.authorization).toMatch(/^vapid t=.+, k=/);
  });

  it('tells players about changes and cancellations, but not about joins', async () => {
    const ev = await create();
    const player = await fakeBrowser();
    await follow(player, ev.id, ['updates']);
    await join(ev.id, [{ name: 'Tung' }]);
    await call(event.onRequestPut, {
      env, params: { id: ev.id }, method: 'PUT', body: { ...base, start: '15:00' }, headers: { 'x-edit-token': ev.edit_token },
    });
    await call(cancel.onRequestPost, {
      env, params: { id: ev.id }, method: 'POST', body: { reason: 'Typhoon' }, headers: { 'x-edit-token': ev.edit_token },
    });
    const when = base.date.slice(5).replace('-', '/');
    expect((await received(player)).map((m) => m.body)).toEqual([
      `Updated: ${when} 15:00 · Daan Park`,
      `Cancelled: ${when} 15:00 · Typhoon`,
    ]);
  });

  it("doesn't notify the device that made the change", async () => {
    const ev = await create();
    const organizer = await fakeBrowser();
    const { data } = await follow(organizer, ev.id, ['signups']);
    await join(ev.id, [{ name: 'Tung' }], { 'x-push-sub': data.sub_id });
    expect(push.sent).toHaveLength(0);
  });

  it('organizer of a weekly pickup hears about every date', async () => {
    const ev = await create({ repeat: 'weekly' });
    const organizer = await fakeBrowser();
    await follow(organizer, ev.id, ['signups']);
    const later = (await call(events.onRequestGet, { env })).data[2];
    await join(later.id, [{ name: 'Ben' }]);
    expect((await received(organizer))[0]).toMatchObject({ body: 'Ben joined · 1 going', url: '/event?id=' + later.id });
  });

  it('forgets subscriptions the push service says are gone', async () => {
    push.restore();
    push = fakePushService(410);
    const ev = await create();
    await follow(await fakeBrowser(), ev.id, ['signups']);
    await join(ev.id, [{ name: 'Tung' }]);
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM push_subs').get().n).toBe(0);
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM push_follows').get().n).toBe(0);
  });

  it('unsubscribing stops notifications; resubscribing reuses the device', async () => {
    const ev = await create();
    const b = await fakeBrowser();
    const first = (await follow(b, ev.id, ['signups'])).data.sub_id;
    expect((await follow(b, ev.id, ['updates'])).data.sub_id).toBe(first);
    await call(unsubscribe.onRequestPost, { env, method: 'POST', body: { endpoint: b.subscription.endpoint, event_id: ev.id } });
    await join(ev.id, [{ name: 'Tung' }]);
    expect(push.sent).toHaveLength(0);
  });

  it('rejects endpoints that are not browser push services', async () => {
    const ev = await create();
    const b = await fakeBrowser('https://evil.example.com/hook');
    expect((await follow(b, ev.id, ['updates'])).data).toEqual({ errors: ['err_push_sub'] });
  });

  it('sends nothing (and fails nothing) when push is not configured', async () => {
    delete env.VAPID_PRIVATE_KEY;
    const ev = await create();
    await follow(await fakeBrowser(), ev.id, ['signups']);
    expect((await join(ev.id, [{ name: 'Tung' }])).status).toBe(201);
    expect(push.sent).toHaveLength(0);
  });
});

describe('new pickup notifications', () => {
  const followCity = (browser, city, lang = 'en') =>
    call(subscribe.onRequestPost, { env, method: 'POST', body: { subscription: browser.subscription, city, kinds: ['new'], lang } });

  it('notifies followers of that city and of all of Taiwan, not other cities', async () => {
    const taipei = await fakeBrowser();
    const anywhere = await fakeBrowser();
    const tainan = await fakeBrowser();
    await followCity(taipei, 'taipei', 'zh');
    await followCity(anywhere, 'all');
    await followCity(tainan, 'tainan');
    const ev = await create();
    const when = base.date.slice(5).replace('-', '/');
    expect(await received(taipei)).toEqual([
      { title: 'Sat pickup', body: `新揪團：${when} 14:00 · Daan Park`, url: '/event?id=' + ev.id, tag: ev.id },
    ]);
    expect((await received(anywhere))[0].body).toBe(`New pickup: ${when} 14:00 · Daan Park`);
    expect(await received(tainan)).toEqual([]);
  });

  it('announces a weekly series once', async () => {
    const b = await fakeBrowser();
    await followCity(b, 'taipei');
    await create({ repeat: 'weekly' });
    const msgs = await received(b);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body).toMatch(/^New weekly pickup, starting /);
  });

  it("doesn't notify the device that created it", async () => {
    const b = await fakeBrowser();
    const { data } = await followCity(b, 'all');
    await call(events.onRequestPost, { env, method: 'POST', body: base, headers: { 'x-push-sub': data.sub_id } });
    expect(push.sent).toHaveLength(0);
  });

  it('rejects unknown cities and can be turned off', async () => {
    const b = await fakeBrowser();
    expect((await followCity(b, 'tokyo')).status).toBe(400);
    await followCity(b, 'taipei');
    await call(unsubscribe.onRequestPost, {
      env, method: 'POST', body: { endpoint: b.subscription.endpoint, city: 'taipei', kinds: ['new'] },
    });
    await create();
    expect(push.sent).toHaveLength(0);
  });
});
