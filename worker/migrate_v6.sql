-- v6: people can say they're not going.
ALTER TABLE signups ADD COLUMN going INTEGER NOT NULL DEFAULT 1;
