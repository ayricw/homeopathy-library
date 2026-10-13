-- Structured repertories: rubrics (symptoms) with the remedies listed under them and their grades.
-- Imported by scripts/import-repertory.ts from an OOREP database dump. See AGENTS.md.

CREATE TABLE repertories (
  id TEXT PRIMARY KEY,                 -- slug from library/repertories/<id>.json
  id_base INTEGER NOT NULL UNIQUE,     -- rubric ids for this repertory are id_base * 10000000 + source rubric id
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  edition TEXT,                        -- NULL when unknown; never guessed
  publication_year INTEGER,
  publisher TEXT,
  language TEXT,
  source_url TEXT NOT NULL,
  attribution TEXT NOT NULL,
  reuse_terms TEXT NOT NULL,
  notes TEXT,
  original_filename TEXT NOT NULL,
  sha256 TEXT NOT NULL,                -- of the dump file the rows came from
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Remedy ids are OOREP's own ids, so remedies are shared by every repertory imported from OOREP.
CREATE TABLE remedies (
  id INTEGER PRIMARY KEY,
  abbrev TEXT NOT NULL,
  name TEXT NOT NULL
);
CREATE INDEX remedies_abbrev ON remedies(abbrev);

CREATE TABLE rubrics (
  id INTEGER PRIMARY KEY,
  repertory_id TEXT NOT NULL REFERENCES repertories(id),
  chapter TEXT NOT NULL,               -- first part of the path, e.g. "Mind"
  path TEXT NOT NULL,                  -- full rubric, e.g. "Mind, anxiety, night"
  remedy_count INTEGER NOT NULL
);
CREATE INDEX rubrics_repertory ON rubrics(repertory_id);

CREATE TABLE rubric_remedies (
  rubric_id INTEGER NOT NULL REFERENCES rubrics(id),
  remedy_id INTEGER NOT NULL REFERENCES remedies(id),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 4),
  PRIMARY KEY (rubric_id, remedy_id)
) WITHOUT ROWID;

CREATE VIRTUAL TABLE rubrics_fts USING fts5(
  path,
  content = 'rubrics',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER rubrics_ai AFTER INSERT ON rubrics BEGIN
  INSERT INTO rubrics_fts(rowid, path) VALUES (new.id, new.path);
END;
CREATE TRIGGER rubrics_ad AFTER DELETE ON rubrics BEGIN
  INSERT INTO rubrics_fts(rubrics_fts, rowid, path) VALUES ('delete', old.id, old.path);
END;
CREATE TRIGGER rubrics_au AFTER UPDATE ON rubrics BEGIN
  INSERT INTO rubrics_fts(rubrics_fts, rowid, path) VALUES ('delete', old.id, old.path);
  INSERT INTO rubrics_fts(rowid, path) VALUES (new.id, new.path);
END;
