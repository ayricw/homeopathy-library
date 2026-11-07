import { useState, type FormEvent } from "react";
import sample from "../library/sources/anshutz-1900-new-old-forgotten-remedies.json";
import { importText, type ImportOutcome } from "../shared/importer";
import { notesMetadata, notesSkipReason } from "../shared/notes";
import { extractText } from "./extract";
import type { Issue } from "../shared/text";

type Meta = Record<string, string>;

const FIELDS: [key: string, label: string, required: boolean, long?: boolean][] = [
  ["id", "Library id (lowercase-with-dashes)", true],
  ["title", "Title", true],
  ["author", "Author", true],
  ["editor", "Editor", false],
  ["edition", "Edition (leave blank if unknown)", false],
  ["publication_year", "Publication year (leave blank if unknown)", false],
  ["publisher", "Publisher", false],
  ["language", "Language", false],
  ["source_url", "Source URL", true],
  ["attribution", "Attribution", true, true],
  ["reuse_terms", "Reuse terms", true, true],
  ["notes", "Notes", false, true],
];

const fromSample = (): Meta =>
  Object.fromEntries(FIELDS.map(([k]) => [k, (sample as Record<string, unknown>)[k] == null ? "" : String((sample as Record<string, unknown>)[k])]));

export function ImportPage() {
  const [meta, setMeta] = useState<Meta>(fromSample);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setLog([]);
    setIssues([]);
    setOutcome(null);
    setError(null);
    const metadata: Record<string, unknown> = {};
    for (const [k] of FIELDS) {
      const v = meta[k].trim();
      metadata[k] = v === "" ? null : k === "publication_year" ? Number(v) : v;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await importText(window.location.origin, { bytes, name: file.name }, metadata, {
        log: (m) => setLog((l) => [...l, m]),
        progress: (done, total) => setProgress([done, total]),
        issues: setIssues,
      });
      setOutcome(result);
    } catch (err) {
      setError(`${err instanceof Error ? err.message : err}. Run the import again to resume where it stopped.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <NotesImport />
      <h1>Import a book</h1>
      <p className="muted">
        UTF-8 plain text only for now. Check the source's reuse terms before importing. The original file is kept unchanged.
        Importing the same file again resumes an interrupted import or reports a duplicate.
      </p>
      <form className="import" onSubmit={submit}>
        <label>
          Text file
          <input type="file" accept=".txt,text/plain" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <p className="muted">
          The form is filled in for the sample book. Download "Plain Text UTF-8" from{" "}
          <a href="https://www.gutenberg.org/ebooks/38757" target="_blank" rel="noopener noreferrer">
            its Project Gutenberg page
          </a>{" "}
          and choose that file above.
        </p>
        {FIELDS.map(([key, label, required, long]) => (
          <label key={key}>
            {label}
            {long ? (
              <textarea rows={3} value={meta[key]} required={required} onChange={(e) => setMeta({ ...meta, [key]: e.target.value })} />
            ) : (
              <input value={meta[key]} required={required} onChange={(e) => setMeta({ ...meta, [key]: e.target.value })} />
            )}
          </label>
        ))}
        <button type="submit" disabled={busy || !file}>
          {busy ? "Importing…" : "Import"}
        </button>
      </form>

      {progress && (
        <p>
          <progress max={progress[1] || 1} value={progress[0]} /> {progress[0]}/{progress[1]} passages
        </p>
      )}
      {log.map((l, i) => (
        <p key={i} className="muted">
          {l}
        </p>
      ))}
      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((i, n) => (
            <li key={n}>
              <span className={`badge ${i.severity}`}>{i.severity}</span> {i.detail}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
      {outcome?.kind === "complete" && (
        <p>
          Imported {outcome.passages} passages. <a href={`#/sources/${outcome.sourceId}`}>View the source</a>
        </p>
      )}
      {outcome?.kind === "duplicate" && (
        <p>
          This exact file is already in the library. Nothing changed. <a href={`#/sources/${outcome.sourceId}`}>View it</a>
        </p>
      )}
      {outcome?.kind === "failed" && <p className="error">Import failed: {outcome.error}</p>}
    </section>
  );
}

// ---------- notes: Word and PDF files, many at once ----------

interface NoteRow {
  file: File;
  include: boolean;
  skip: string | null;
  status: string;
  sourceId?: string;
  failed?: boolean;
}

function NotesImport() {
  const [rows, setRows] = useState<NoteRow[]>([]);
  const [author, setAuthor] = useState("School of Intuitive Homeopathy (course notes)");
  const [busy, setBusy] = useState(false);

  const choose = (files: FileList | null) =>
    setRows(
      [...(files ?? [])].map((file) => {
        const skip = notesSkipReason(file.name);
        return { file, include: !skip, skip, status: skip ?? "" };
      }),
    );
  const update = (i: number, patch: Partial<NoteRow>) => setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  const run = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    for (const [i, row] of rows.entries()) {
      if (!row.include || row.sourceId) continue;
      try {
        update(i, { status: "Reading the text…", failed: false });
        const text = await extractText(row.file);
        if (text.replace(/\[Pg \d+\]/g, "").trim().length < 40) {
          update(i, { status: "No text found. It is probably scanned images or slides without text.", failed: true });
          continue;
        }
        const bytes = new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
        const name = row.file.name.replace(/\.[^.]+$/, "") + ".txt";
        const result = await importText(window.location.origin, { bytes, name }, notesMetadata(row.file.name, author.trim() || "Course notes"), {
          progress: (done, total) => update(i, { status: `Importing ${done}/${total} passages…` }),
        });
        if (result.kind === "complete") update(i, { status: `Imported, ${result.passages} passages.`, sourceId: result.sourceId });
        else if (result.kind === "duplicate") update(i, { status: "Already in the library.", sourceId: result.sourceId });
        else update(i, { status: `Failed: ${result.error}`, failed: true });
      } catch (err) {
        update(i, { status: `Failed: ${err instanceof Error ? err.message : err}`, failed: true });
      }
    }
    setBusy(false);
  };

  const chosen = rows.filter((r) => r.include && !r.sourceId).length;
  return (
    <div className="notes-import">
      <h1>Import notes</h1>
      <p className="muted">
        Choose Word (.docx) or PDF files, as many as you like. The text is read here in the browser and added to the library as
        Notes, kept apart from the books and searchable with them. Case files and blank forms are left out unless you tick them.
        Old .doc files and slide decks (.pptx) can't be read; save them as .docx or PDF first.
      </p>
      <form className="import" onSubmit={run}>
        <label>
          Files
          <input type="file" multiple accept=".docx,.pdf,.txt" onChange={(e) => choose(e.target.files)} disabled={busy} />
        </label>
        <label>
          Author or course
          <input value={author} onChange={(e) => setAuthor(e.target.value)} disabled={busy} />
        </label>
        {rows.length > 0 && (
          <ul className="notes-files">
            {rows.map((r, i) => (
              <li key={i}>
                <label>
                  <input type="checkbox" checked={r.include} disabled={busy || !!r.sourceId} onChange={(e) => update(i, { include: e.target.checked })} />{" "}
                  {r.file.name}
                </label>
                {r.status && (
                  <span className={r.failed ? "error small" : "muted small"}>
                    {" "}
                    {r.status} {r.sourceId && <a href={`#/sources/${r.sourceId}`}>View</a>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <button type="submit" disabled={busy || chosen === 0}>
          {busy ? "Importing…" : `Import ${chosen} file${chosen === 1 ? "" : "s"}`}
        </button>
      </form>
    </div>
  );
}
