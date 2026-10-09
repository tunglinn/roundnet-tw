-- v3: players needed for a pickup to be confirmed.
ALTER TABLE events ADD COLUMN min_players INTEGER;
