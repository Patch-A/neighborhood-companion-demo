-- Synthetic demo only: no messages, photos, raw IPs or model inputs.
CREATE TABLE IF NOT EXISTS ai_reservations (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  minute INTEGER NOT NULL,
  client TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reservations_day ON ai_reservations(day);
CREATE INDEX IF NOT EXISTS reservations_minute ON ai_reservations(minute);
CREATE INDEX IF NOT EXISTS reservations_client_day ON ai_reservations(client, day);
CREATE INDEX IF NOT EXISTS reservations_client_minute ON ai_reservations(client, minute);
