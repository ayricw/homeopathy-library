-- Source metadata. One row per imported file (identified by its SHA-256).
CREATE TABLE sources (
  id TEXT PRIMARY KEY,                 -- stable slug chosen in the metadata file
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  editor TEXT,
  edition TEXT,                        -- NULL when unknown; never guessed
  publication_year INTEGER,            -- NULL when unknown; never guessed
  publisher TEXT,
  language TEXT,
  source_url TEXT NOT NULL,
  attribution TEXT NOT NULL,
  reuse_terms TEXT NOT NULL,
  notes TEXT,
  original_filename TEXT NOT NULL,
  original_r2_key TEXT NOT NULL,       -- untouched original bytes
  extracted_r2_key TEXT,               -- original extracted text (UTF-8)
  sha256 TEXT NOT NULL UNIQUE,         -- duplicate detection
  byte_length INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Import progress, so an interrupted import can resume where it stopped.
CREATE TABLE imports (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'processing', 'complete', 'failed')),
  parser_version TEXT,
  total_passages INTEGER,
  processed_passages INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX imports_source ON imports(source_id);

-- Extraction failures, encoding problems, uncertain OCR, structural notes.
CREATE TABLE import_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id TEXT NOT NULL REFERENCES imports(id),
  kind TEXT NOT NULL CHECK (kind IN ('encoding', 'structure', 'extraction_failure', 'uncertain_ocr')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  detail TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX import_issues_import ON import_issues(import_id);

-- Passages hold the ORIGINAL extracted text, with exact offsets into it.
CREATE TABLE passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES sources(id),
  ordinal INTEGER NOT NULL,
  chapter TEXT,
  section TEXT,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  page_start TEXT,                     -- only from page markers in the text
  page_end TEXT,
  text TEXT NOT NULL,
  UNIQUE (source_id, ordinal)
);

-- Corrections are stored separately and never overwrite the original text.
CREATE TABLE passage_corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passage_id INTEGER NOT NULL REFERENCES passages(id),
  corrected_text TEXT NOT NULL,
  note TEXT,
  corrected_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX passage_corrections_passage ON passage_corrections(passage_id);

-- Keyword index over passages (external content, kept in sync by triggers).
CREATE VIRTUAL TABLE passages_fts USING fts5(
  text,
  section,
  content = 'passages',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TRIGGER passages_ai AFTER INSERT ON passages BEGIN
  INSERT INTO passages_fts(rowid, text, section) VALUES (new.id, new.text, new.section);
END;
CREATE TRIGGER passages_ad AFTER DELETE ON passages BEGIN
  INSERT INTO passages_fts(passages_fts, rowid, text, section) VALUES ('delete', old.id, old.text, old.section);
END;
CREATE TRIGGER passages_au AFTER UPDATE ON passages BEGIN
  INSERT INTO passages_fts(passages_fts, rowid, text, section) VALUES ('delete', old.id, old.text, old.section);
  INSERT INTO passages_fts(rowid, text, section) VALUES (new.id, new.text, new.section);
END;
