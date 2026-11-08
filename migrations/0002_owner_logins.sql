-- Failed sign-ins to the owner area, to slow down password guessing.
-- Only a hash of the network address is kept, never the address itself.
CREATE TABLE IF NOT EXISTS owner_logins (
  ip_hash TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS owner_logins_at ON owner_logins (ip_hash, at);
