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
  contact     TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  edit_token  TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_starts ON events (starts_ts);

CREATE TABLE IF NOT EXISTS signups (
  id           TEXT PRIMARY KEY,
  event_id     TEXT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  remove_token TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signups_event ON signups (event_id, created_at);
