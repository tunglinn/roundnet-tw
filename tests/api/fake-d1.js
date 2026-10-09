// Minimal in-memory stand-in for Cloudflare D1, backed by node:sqlite, so the
// Pages Function handlers can be tested without starting a server.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Loaded via require: Vitest 2 doesn't recognise node:sqlite as a built-in import.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

export function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../../worker/schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    _run: () => db.prepare(sql).run(...args),
  });
  return {
    raw: db,
    prepare: (sql) => stmt(sql),
    batch: async (stmts) => {
      db.exec('BEGIN');
      try { stmts.forEach((s) => s._run()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      return [];
    },
  };
}

// Call a Pages Function handler like the runtime would.
export async function call(handler, { env, params = {}, method = 'GET', path = '/', body, headers = {} }) {
  const request = new Request('http://test' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await handler({ request, env, params });
  return { status: res.status, data: await res.json() };
}
