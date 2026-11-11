-- Copyright (c) 2026 GrantVRP. All rights reserved. See LICENSE.

-- Fake-code reports for the map. Written only by our server (POST /api/reports).
-- Locations are rounded to 4 decimal places (about 10 m) before saving, for privacy.
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  city_id TEXT,
  zone TEXT,
  lat REAL,
  lon REAL,
  fake_url TEXT NOT NULL,
  fake_host TEXT NOT NULL,
  verdict_reasons TEXT NOT NULL DEFAULT '[]',
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS reports_created_at ON reports (created_at);
