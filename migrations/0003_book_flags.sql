-- Entries Claude drew from a book that Robyn marked as wrong; the app leaves them out of remedy ranking.
-- Holds only the book entry (book, remedy, rubric), never anything about a client.
CREATE TABLE book_flags (
  entry_key TEXT PRIMARY KEY,
  flagged_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
