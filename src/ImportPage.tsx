import { useState, type FormEvent } from "react";
import sample from "../library/sources/anshutz-1900-new-old-forgotten-remedies.json";
import { importText, type ImportOutcome } from "../shared/importer";
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
