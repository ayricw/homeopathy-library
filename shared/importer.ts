// The import procedure, shared by the command-line importer and the web page.
// 1. Upload the original file and metadata (duplicates are detected by SHA-256).
// 2. Split the text locally and send passages in batches. Each batch is
//    verified by the Worker against the stored text, and re-running resumes.
import { decodeUtf8, PARSER_VERSION, splitPassages, type Issue } from "./text";

export const BATCH_SIZE = 100;

export interface ImportEvents {
  log?: (message: string) => void;
  progress?: (done: number, total: number) => void;
  issues?: (issues: Issue[]) => void;
}

export type ImportOutcome =
  | { kind: "complete"; sourceId: string; passages: number; resumedFrom: number }
  | { kind: "duplicate"; sourceId: string }
  | { kind: "failed"; sourceId: string; error: string };

export async function importText(
  server: string,
  file: { bytes: Uint8Array<ArrayBuffer>; name: string },
  metadata: Record<string, unknown>,
  events: ImportEvents = {},
  init: RequestInit = {},
  extraIssues: Issue[] = [],
): Promise<ImportOutcome> {
  const call = async (path: string, opts: RequestInit) => {
    const res = await fetch(server + path, { ...init, ...opts, headers: { ...(init.headers ?? {}), ...(opts.headers ?? {}) } });
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) throw new Error(`${opts.method ?? "GET"} ${path} -> ${res.status}: ${body.error ?? res.statusText}`);
    return body;
  };

  const form = new FormData();
  form.set("file", new Blob([file.bytes], { type: "text/plain" }), file.name);
  form.set("metadata", JSON.stringify(metadata));
  const created = await call("/api/imports", { method: "POST", body: form });
  const imp = created.import;
  events.log?.(`${created.duplicate ? "Already uploaded" : "Uploaded"}: ${created.sourceId} (status ${imp.status})`);
  if (imp.status === "complete") return { kind: "duplicate", sourceId: created.sourceId };
  if (imp.status === "failed") return { kind: "failed", sourceId: created.sourceId, error: imp.error };

  const decoded = decodeUtf8(file.bytes);
  if (!decoded.ok) return { kind: "failed", sourceId: created.sourceId, error: decoded.error! };
  const split = splitPassages(decoded.text!);
  const { passages } = split;
  const issues = [...extraIssues, ...split.issues];
  events.issues?.(issues);

  const resumedFrom = imp.processed_passages as number;
  if (resumedFrom > 0) events.log?.(`Resuming at passage ${resumedFrom} of ${passages.length}`);
  let start = resumedFrom;
  events.progress?.(start, passages.length);
  while (start < passages.length) {
    const status = await call(`/api/imports/${imp.id}/passages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parserVersion: PARSER_VERSION,
        total: passages.length,
        start,
        passages: passages.slice(start, start + BATCH_SIZE),
        issues,
      }),
    });
    start = status.processed_passages;
    events.progress?.(start, passages.length);
  }
  return { kind: "complete", sourceId: created.sourceId, passages: passages.length, resumedFrom };
}
