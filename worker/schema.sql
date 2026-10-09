CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  starts_at   TEXT NOT NULL,          -- Taipei local, e.g. 2026-10-12T14:00:00+08:00
  ends_at     TEXT,
  starts_ts   INTEGER NOT NULL,       -- epoch ms, for sorting/filtering
  place_name  TEXT NOT NULL,
  city        TEXT NOT NULL,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  level       TEXT NOT NULL DEFAULT 'any',
  max_players INTEGER,
  min_players INTEGER,                -- needed to confirm; NULL = happens regardless (still needs net + balls)
  contact     TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  edit_token  TEXT NOT NULL,
  series_id   TEXT,                   -- set for weekly pickups (see series)
  cancelled_at INTEGER,               -- pickups are cancelled, not deleted
  cancel_reason TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_starts ON events (starts_ts);
CREATE INDEX IF NOT EXISTS idx_events_series ON events (series_id, starts_ts);

-- Weekly repeating pickups. Each date is its own events row; template is the JSON
-- of everything but the date (lib/series.js templateFrom).
CREATE TABLE IF NOT EXISTS series (
  id          TEXT PRIMARY KEY,
  template    TEXT NOT NULL,
  until_date  TEXT,                   -- last date (YYYY-MM-DD), NULL = no end
  edit_token  TEXT NOT NULL,          -- shared by all its dates
  ended_at    INTEGER,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS signups (
  id           TEXT PRIMARY KEY,
  event_id     TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  brings       TEXT NOT NULL DEFAULT '',   -- comma-separated gear keys, e.g. "net,balls"
  note         TEXT NOT NULL DEFAULT '',
  remove_token TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signups_event ON signups (event_id, created_at);
