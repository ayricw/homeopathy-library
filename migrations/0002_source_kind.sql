-- Whether a source is a published book or Robyn's own course notes, so the two can be listed apart.
ALTER TABLE sources ADD COLUMN kind TEXT NOT NULL DEFAULT 'book' CHECK (kind IN ('book', 'notes'));
