# Roundnet Taiwan Pickups · 台灣 Roundnet 揪團

A very simple pickup tracker for roundnet in Taiwan. Add a pickup, join with your friends' names, and see where people play on a map. No login. English and 中文.

Stack: static HTML/JS (no build) + Cloudflare Pages Functions + D1. Map: Leaflet + OpenStreetMap.

## Run locally
```bash
npm install
npm run db:init     # create tables in the local D1 (once)
npm run dev         # http://localhost:8788
npm test            # unit tests for lib/validate.js
```

## Deploy (first time)
```bash
npx wrangler login
npx wrangler d1 create roundnet-tw          # copy the database_id into wrangler.jsonc
npm run db:init:remote                      # create tables in the real D1
npm run deploy                              # creates the Pages project and uploads public/ + functions/
```
Then in the Cloudflare dashboard: Pages → roundnet-tw → Custom domains to attach your domain. If the D1 binding isn't picked up, add it under Settings → Bindings (variable name `DB`).

Schema changes: run the new `worker/migrate_vN.sql` on production **before** pushing the code that uses it:
```bash
npx wrangler d1 execute roundnet-tw --remote --command="$(grep -v '^--' worker/migrate_vN.sql)"
```

## How "no login" works
- Creating a pickup returns a secret **edit link** (`/event?id=…&edit=TOKEN`). That device remembers it (localStorage); anyone with the link can edit or delete.
- Pickups are **cancelled, never deleted**, once anyone has joined, so nobody is left wondering where a pickup went. Weekly pickups can be cancelled one date at a time, or ended after a given date.
- Adding names gives each name a remove token stored on the device that added it. The organizer can remove any name.

## Ideas for later
- Cloudflare Turnstile on the create/join forms if spam shows up
- "Repeat weekly" pickups, saved spots, LINE Login
