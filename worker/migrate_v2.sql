-- v2: per-person gear and note on signups.
ALTER TABLE signups ADD COLUMN brings TEXT NOT NULL DEFAULT '';
ALTER TABLE signups ADD COLUMN note TEXT NOT NULL DEFAULT '';
