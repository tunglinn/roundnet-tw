-- v5: push notifications.
CREATE TABLE IF NOT EXISTS push_subs (
  id          TEXT PRIMARY KEY,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT 'en',
  created_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS push_follows (
  sub_id      TEXT NOT NULL,
  target      TEXT NOT NULL,
  kind        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (sub_id, target, kind)
);
CREATE INDEX IF NOT EXISTS idx_push_follows_target ON push_follows (target, kind);
