-- v4: weekly repeating pickups + cancel instead of delete.
ALTER TABLE events ADD COLUMN series_id TEXT;
ALTER TABLE events ADD COLUMN cancelled_at INTEGER;
ALTER TABLE events ADD COLUMN cancel_reason TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_events_series ON events (series_id, starts_ts);
CREATE TABLE IF NOT EXISTS series (
  id          TEXT PRIMARY KEY,
  template    TEXT NOT NULL,
  until_date  TEXT,
  edit_token  TEXT NOT NULL,
  ended_at    INTEGER,
  created_at  INTEGER NOT NULL
);
