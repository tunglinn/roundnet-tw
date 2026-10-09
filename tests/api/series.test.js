import { describe, it, expect, beforeEach } from 'vitest';
import { fakeD1, call } from './fake-d1.js';
import * as events from '../../functions/api/events.js';
import * as event from '../../functions/api/events/[id].js';
import * as signups from '../../functions/api/events/[id]/signups.js';
import * as cancel from '../../functions/api/events/[id]/cancel.js';
import * as restore from '../../functions/api/events/[id]/restore.js';
import * as endSeries from '../../functions/api/events/[id]/end-series.js';
import { addDays, taipeiDate, topUpSeries } from '../../lib/series.js';

const first = addDays(taipeiDate(), 2);
const base = {
  title: 'Sat pickup', date: first, start: '14:00', end: '17:00', place_name: 'Daan Park',
  city: 'taipei', lat: 25.03, lng: 121.53, level: 'any',
};

let env;
beforeEach(() => { env = { DB: fakeD1() }; });

const create = (extra = {}) => call(events.onRequestPost, { env, method: 'POST', body: { ...base, ...extra } });
const get = (id) => call(event.onRequestGet, { env, params: { id } });
const list = () => call(events.onRequestGet, { env });
const org = (handler, id, token, method = 'POST', body = {}) =>
  call(handler, { env, params: { id }, method, body, headers: { 'x-edit-token': token } });
const join = (id, names) => call(signups.onRequestPost, { env, params: { id }, method: 'POST', body: { names } });
const dates = (rows) => rows.map((r) => r.starts_at.slice(0, 10));

describe('weekly pickups', () => {
  it('creates weekly dates up to 4 weeks ahead, all sharing the edit token', async () => {
    const { status, data } = await create({ repeat: 'weekly' });
    expect(status).toBe(201);
    expect(data.series_id).toBeTruthy();
    const { data: rows } = await list();
    expect(dates(rows)).toEqual([first, addDays(first, 7), addDays(first, 14), addDays(first, 21)]);
    expect(rows.every((r) => r.series_id === data.series_id)).toBe(true);
    // the token works on a later date too
    const later = rows[2].id;
    expect((await org(cancel.onRequestPost, later, data.edit_token)).status).toBe(200);
  });

  it('respects the last date', async () => {
    await create({ repeat: 'weekly', until: addDays(first, 7) });
    expect(dates((await list()).data)).toEqual([first, addDays(first, 7)]);
  });

  it('tops up new dates as time passes', async () => {
    await create({ repeat: 'weekly' });
    await topUpSeries(env, Date.now() + 7 * 864e5);
    expect(dates((await list()).data)).toHaveLength(5);
  });

  it('returns the date bar on the event page', async () => {
    const { data } = await create({ repeat: 'weekly' });
    const { data: ev } = await get(data.id);
    expect(ev.series.dates).toHaveLength(4);
    expect(ev.series.ended).toBe(false);
    expect(ev.edit_token).toBeUndefined();
  });

  it('"this date only" edits leave other dates alone', async () => {
    const { data } = await create({ repeat: 'weekly' });
    const rows = (await list()).data;
    await org(event.onRequestPut, rows[1].id, data.edit_token, 'PUT',
      { ...base, date: addDays(first, 7), start: '15:00', scope: 'one' });
    const after = (await list()).data;
    expect(after.map((r) => r.starts_at.slice(11, 16))).toEqual(['14:00', '15:00', '14:00', '14:00']);
  });

  it('"this and later" edits shift later dates and future top-ups', async () => {
    const { data } = await create({ repeat: 'weekly' });
    const rows = (await list()).data;
    // move the 2nd date (and everything after) one day later and rename
    await org(event.onRequestPut, rows[1].id, data.edit_token, 'PUT',
      { ...base, title: 'Sun pickup', date: addDays(first, 8), scope: 'future' });
    let after = (await list()).data;
    expect(dates(after)).toEqual([first, addDays(first, 8), addDays(first, 15), addDays(first, 22)]);
    expect(after.map((r) => r.title)).toEqual(['Sat pickup', 'Sun pickup', 'Sun pickup', 'Sun pickup']);
    await topUpSeries(env, Date.now() + 7 * 864e5);
    after = (await list()).data;
    expect(after.at(-1)).toMatchObject({ title: 'Sun pickup' });
    expect(after.at(-1).starts_at.slice(0, 10)).toBe(addDays(first, 29));
  });

  it('ending a series removes empty later dates, cancels joined ones, and stops top-ups', async () => {
    const { data } = await create({ repeat: 'weekly' });
    const rows = (await list()).data;
    await join(rows[2].id, 'Amy');
    await org(endSeries.onRequestPost, rows[0].id, data.edit_token);
    let after = (await list()).data;
    expect(dates(after)).toEqual([first, addDays(first, 14)]);
    expect(after[0].cancelled_at).toBeNull();
    expect(after[1].cancelled_at).toBeTruthy();
    await topUpSeries(env, Date.now() + 14 * 864e5);
    expect((await list()).data).toHaveLength(2);
    expect((await get(rows[0].id)).data.series.ended).toBe(true);
  });
});

describe('cancel instead of delete', () => {
  it('cancelled pickups stay listed, refuse new signups, and can be restored', async () => {
    const { data } = await create();
    expect((await org(cancel.onRequestPost, data.id, 'wrong')).status).toBe(403);
    await org(cancel.onRequestPost, data.id, data.edit_token, 'POST', { reason: 'Typhoon' });
    const [row] = (await list()).data;
    expect(row).toMatchObject({ id: data.id, cancel_reason: 'Typhoon' });
    expect(row.cancelled_at).toBeTruthy();
    expect(await join(data.id, 'Amy')).toMatchObject({ status: 409, data: { errors: ['err_cancelled'] } });
    await org(restore.onRequestPost, data.id, data.edit_token);
    expect((await join(data.id, 'Amy')).status).toBe(201);
  });

  it('only deletes one-off pickups nobody joined', async () => {
    const empty = (await create()).data;
    expect((await org(event.onRequestDelete, empty.id, empty.edit_token, 'DELETE')).status).toBe(200);

    const joined = (await create()).data;
    await join(joined.id, 'Amy');
    expect((await org(event.onRequestDelete, joined.id, joined.edit_token, 'DELETE')).data)
      .toEqual({ errors: ['err_cannot_delete'] });

    const weekly = (await create({ repeat: 'weekly' })).data;
    expect((await org(event.onRequestDelete, weekly.id, weekly.edit_token, 'DELETE')).status).toBe(409);
  });
});
