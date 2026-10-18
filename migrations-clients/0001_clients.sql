-- Client records. This database is separate from the library database (DB) so it can be
-- exported, backed up or deleted on its own. Names and visit contents are encrypted by the
-- Worker (AES-GCM, key in the CLIENT_KEY secret) before they reach this database, so the
-- columns below hold ciphertext. Only ids and dates are stored in the clear.
CREATE TABLE clients (
  id TEXT PRIMARY KEY,                 -- random UUID
  name_enc TEXT NOT NULL,              -- encrypted display name
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE visits (
  id TEXT PRIMARY KEY,                 -- random UUID
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  visit_date TEXT NOT NULL,            -- YYYY-MM-DD
  data_enc TEXT NOT NULL,              -- encrypted JSON: rubrics, ranking method, notes, remedy chosen
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX visits_by_client ON visits(client_id, visit_date);
