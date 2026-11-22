-- Robyn's own repertory additions: a remedy she adds to a rubric from her experience. Merged into the
-- repertory in the browser and marked as hers. About remedies and rubrics only, never about a client.
CREATE TABLE my_additions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rubric_path TEXT NOT NULL,           -- the repertory's rubric path, e.g. "Ear, pain, burning"
  remedy TEXT NOT NULL,                -- the repertory's abbreviation, e.g. "Puls."
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  note TEXT,                           -- why, in her words (about the remedy, not a client)
  added_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (rubric_path, remedy)
);

-- Notes in the margin of a book: Robyn's own notes on a passage. About the book, never about a client.
CREATE TABLE passage_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passage_id INTEGER NOT NULL REFERENCES passages(id),
  note TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX passage_notes_passage ON passage_notes(passage_id);
