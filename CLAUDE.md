# CLAUDE.md

Roundnet pickup tracker for Taiwan. No login, bilingual (en / zh-TW), old-school UI on purpose.

- `public/` is the static site (Pages output dir). Plain global-function JS, no build, no framework. `app/i18n.js` (strings + `t()`), `app/app.js` (helpers, `renderChrome()`, `api()`, map helpers), `app/style.css` (Win95-style look).
- `functions/` contains the Pages Functions: `api/events.js`, `api/events/[id].js`, `api/events/[id]/{signups,cancel,restore,end-series}.js`, `api/signups/[id].js`. `event.js` fills in OG tags on `/event` for link previews. `public/_routes.json` limits Functions to `/api/*` and `/event`.
- `lib/validate.js` is pure server validation, unit-tested in `tests/unit/`. Errors are i18n keys (`err_*`) that the client shows via `t()`.
- Every UI string goes through `t()` and needs both `en` and `zh` entries. `CITIES` is duplicated in `lib/validate.js` and `public/app/app.js`, so keep them in sync.
- Secrets: events have `edit_token` (header `x-edit-token`) and signups have `remove_token` (header `x-remove-token`). Never select them in GET responses.
- Signups have `brings` (comma-separated `GEAR` keys; `GEAR` is duplicated in `lib/validate.js` and `public/app/app.js`) and `note`. Schema changes: update `worker/schema.sql` for new installs **and** add a `worker/migrate_vN.sql` for existing DBs, applied by hand (local and `--remote`) before deploying code that uses it.
- **Pickups are cancelled, not deleted** (`cancelled_at`, `cancel_reason`), so people can see what happened. DELETE only works on a one-off pickup with no signups.
- **Weekly pickups** (`lib/series.js`): a `series` row holds a JSON template, and each date is a normal `events` row with `series_id`, so signups stay per date. Dates are created up to 4 weeks ahead by `topUpSeries()`, which runs on list and event reads because Pages has no cron. All dates share the series' `edit_token`; the client stores it as `edit-series:<id>`. The list and map show only the next date per series (`collapseSeries()` in app.js).
- Tests: `tests/unit/` (pure), `tests/api/` (real handlers against an in-memory D1 shim on `node:sqlite`, `tests/api/fake-d1.js`). No server needed.
- Remote migrations: `--file` fails with OAuth logins (import API auth error), so use `npx wrangler d1 execute roundnet-tw --remote --command="$(grep -v '^--' worker/migrate_vN.sql)"`. Use the `=` form and strip `--` comment lines, or wrangler parses them as flags.
- Times are stored as Taipei local ISO strings (`+08:00`) plus `starts_ts` (ms) for queries.
- Commands: `npm run dev`, `npm test`, `npm run db -- "<SQL>"`, `npm run db:init`, `npm run deploy`.
