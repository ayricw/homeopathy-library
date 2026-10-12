import { buildMatchQuery } from "../shared/query";
import { decodeUtf8, sha256Hex, type Issue, type Passage } from "../shared/text";

export interface Env {
  DB: D1Database;
  LIBRARY: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  ALLOW_IMPORTS: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await route(request, url, env);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error("Unhandled error", err instanceof Error ? err.message : err);
      return json({ error: "Internal error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, url: URL, env: Env): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;
  let m: RegExpMatchArray | null;

  if (method === "GET" && path === "/api/sources") return listSources(env);
  if (method === "GET" && (m = path.match(/^\/api\/sources\/([\w-]+)$/))) return getSource(env, m[1]);
  if (method === "GET" && (m = path.match(/^\/api\/sources\/([\w-]+)\/original$/))) return getOriginal(env, m[1]);
  if (method === "GET" && path === "/api/search") return search(env, url.searchParams);
  if (method === "GET" && (m = path.match(/^\/api\/passages\/(\d+)$/))) return getPassage(env, Number(m[1]), url.searchParams);

  if (path.startsWith("/api/imports")) {
    if (env.ALLOW_IMPORTS !== "true") throw new HttpError(403, "Imports are disabled in this environment.");
    if (method === "POST" && path === "/api/imports") return createImport(request, env);
    if (method === "GET" && (m = path.match(/^\/api\/imports\/([\w-]+)$/))) return json(await importStatus(env, m[1]));
    if (method === "POST" && (m = path.match(/^\/api\/imports\/([\w-]+)\/passages$/))) return addPassages(request, env, m[1]);
  }
  throw new HttpError(404, "Not found");
}

// ---------- Sources ----------

const SOURCE_COLUMNS = `id, title, author, editor, edition, publication_year, publisher, language,
  source_url, attribution, reuse_terms, notes, original_filename, sha256, byte_length, created_at`;

async function listSources(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT ${SOURCE_COLUMNS},
       (SELECT COUNT(*) FROM passages p WHERE p.source_id = s.id) AS passage_count,
       (SELECT status FROM imports i WHERE i.source_id = s.id ORDER BY created_at DESC LIMIT 1) AS import_status
     FROM sources s ORDER BY title`,
  ).all();
  return json({ sources: results });
}

async function getSource(env: Env, id: string) {
  const source = await env.DB.prepare(
    `SELECT ${SOURCE_COLUMNS}, (SELECT COUNT(*) FROM passages p WHERE p.source_id = s.id) AS passage_count
     FROM sources s WHERE id = ?`,
  )
    .bind(id)
    .first();
  if (!source) throw new HttpError(404, "Source not found");
  const { results: imports } = await env.DB.prepare(
    `SELECT id, status, parser_version, total_passages, processed_passages, error, created_at, updated_at
     FROM imports WHERE source_id = ? ORDER BY created_at DESC`,
  )
    .bind(id)
    .all();
  const { results: issues } = await env.DB.prepare(
    `SELECT ii.kind, ii.severity, ii.detail, ii.location, ii.created_at
     FROM import_issues ii JOIN imports i ON i.id = ii.import_id WHERE i.source_id = ? ORDER BY ii.id`,
  )
    .bind(id)
    .all();
  return json({ source, imports, issues });
}

async function getOriginal(env: Env, id: string) {
  const row = await env.DB.prepare("SELECT original_r2_key, original_filename FROM sources WHERE id = ?")
    .bind(id)
    .first<{ original_r2_key: string; original_filename: string }>();
  if (!row) throw new HttpError(404, "Source not found");
  const obj = await env.LIBRARY.get(row.original_r2_key);
  if (!obj) throw new HttpError(404, "Original file is missing from storage");
  const isText = /\.txt$/i.test(row.original_filename);
  return new Response(obj.body, {
    headers: {
      "content-type": isText ? "text/plain; charset=utf-8" : "application/octet-stream",
      "content-disposition": `inline; filename="${row.original_filename.replace(/[^\w.-]/g, "_")}"`,
      "x-content-type-options": "nosniff",
    },
  });
}

// ---------- Search ----------

async function search(env: Env, params: URLSearchParams) {
  const q = params.get("q") ?? "";
  const match = buildMatchQuery(q);
  if (!match) return json({ query: q, results: [], total: 0 });
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 50);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);

  const where = ["passages_fts MATCH ?"];
  const binds: unknown[] = [match];
  for (const [param, column] of [
    ["source", "s.id"],
    ["author", "s.author"],
    ["edition", "s.edition"],
  ] as const) {
    const v = params.get(param);
    if (v) {
      where.push(`${column} = ?`);
      binds.push(v);
    }
  }
  const from = `FROM passages_fts JOIN passages p ON p.id = passages_fts.rowid JOIN sources s ON s.id = p.source_id
    WHERE ${where.join(" AND ")}`;

  const [count, rows] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS n ${from}`).bind(...binds),
    env.DB.prepare(
      `SELECT p.id, p.source_id, p.ordinal, p.chapter, p.section, p.page_start, p.page_end, p.line_start, p.line_end,
         snippet(passages_fts, 0, char(2), char(3), '…', 32) AS snippet,
         s.title, s.author, s.edition, s.publication_year
       ${from} ORDER BY bm25(passages_fts) LIMIT ? OFFSET ?`,
    ).bind(...binds, limit, offset),
  ]);
  return json({
    query: q,
    match,
    total: (count.results[0] as { n: number }).n,
    limit,
    offset,
    results: rows.results,
  });
}

// ---------- Passage with context ----------

async function getPassage(env: Env, id: number, params: URLSearchParams) {
  const context = Math.min(Math.max(Number(params.get("context") ?? 2) || 0, 0), 5);
  const passage = await env.DB.prepare("SELECT * FROM passages WHERE id = ?").bind(id).first<{
    id: number;
    source_id: string;
    ordinal: number;
  }>();
  if (!passage) throw new HttpError(404, "Passage not found");
  const [src, around, corrections] = await env.DB.batch([
    env.DB.prepare(`SELECT ${SOURCE_COLUMNS} FROM sources WHERE id = ?`).bind(passage.source_id),
    env.DB.prepare(
      `SELECT id, ordinal, chapter, section, page_start, page_end, line_start, line_end, text
       FROM passages WHERE source_id = ? AND ordinal BETWEEN ? AND ? AND id != ? ORDER BY ordinal`,
    ).bind(passage.source_id, passage.ordinal - context, passage.ordinal + context, passage.id),
    env.DB.prepare("SELECT corrected_text, note, corrected_by, created_at FROM passage_corrections WHERE passage_id = ? ORDER BY id").bind(id),
  ]);
  const neighbours = around.results as { ordinal: number }[];
  return json({
    passage,
    source: src.results[0],
    before: neighbours.filter((p) => p.ordinal < passage.ordinal),
    after: neighbours.filter((p) => p.ordinal > passage.ordinal),
    corrections: corrections.results,
  });
}

// ---------- Imports ----------

interface SourceMetadata {
  id: string;
  title: string;
  author: string;
  editor?: string | null;
  edition?: string | null;
  publication_year?: number | null;
  publisher?: string | null;
  language?: string | null;
  source_url: string;
  attribution: string;
  reuse_terms: string;
  notes?: string | null;
}

function validateMetadata(raw: unknown): SourceMetadata {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "metadata must be a JSON object");
  const m = raw as Record<string, unknown>;
  for (const key of ["id", "title", "author", "source_url", "attribution", "reuse_terms"]) {
    if (typeof m[key] !== "string" || !(m[key] as string).trim()) throw new HttpError(400, `metadata.${key} is required`);
  }
  if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(m.id as string)) throw new HttpError(400, "metadata.id must be a lowercase slug");
  if (!/^https?:\/\//.test(m.source_url as string)) throw new HttpError(400, "metadata.source_url must be an http(s) URL");
  if (m.publication_year != null && !Number.isInteger(m.publication_year)) throw new HttpError(400, "metadata.publication_year must be an integer or null");
  return m as unknown as SourceMetadata;
}

async function importStatus(env: Env, importId: string) {
  const imp = await env.DB.prepare("SELECT * FROM imports WHERE id = ?").bind(importId).first();
  if (!imp) throw new HttpError(404, "Import not found");
  return imp;
}

function issueStatements(env: Env, importId: string, issues: Issue[]) {
  return issues.slice(0, 100).map((i) =>
    env.DB.prepare("INSERT INTO import_issues (import_id, kind, severity, detail, location) VALUES (?, ?, ?, ?, ?)").bind(
      importId,
      i.kind,
      i.severity,
      String(i.detail).slice(0, 2000),
      i.location ?? null,
    ),
  );
}

/** Step 1: upload the original file and metadata. Re-uploading the same file resumes the existing import. */
async function createImport(request: Request, env: Env) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "file is required");
  let metadataRaw: unknown;
  try {
    metadataRaw = JSON.parse(String(form.get("metadata") ?? ""));
  } catch {
    throw new HttpError(400, "metadata must be valid JSON");
  }
  const meta = validateMetadata(metadataRaw);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha = await sha256Hex(bytes);

  const existing = await env.DB.prepare("SELECT id FROM sources WHERE sha256 = ?").bind(sha).first<{ id: string }>();
  if (existing) {
    const imp = await env.DB.prepare("SELECT * FROM imports WHERE source_id = ? ORDER BY created_at DESC LIMIT 1")
      .bind(existing.id)
      .first();
    return json({ duplicate: true, sourceId: existing.id, import: imp });
  }
  const idTaken = await env.DB.prepare("SELECT sha256 FROM sources WHERE id = ?").bind(meta.id).first();
  if (idTaken) throw new HttpError(409, `A different file is already imported as "${meta.id}". Use a new id for a different edition or file.`);

  const filename = file.name || `${meta.id}.txt`;
  const originalKey = `originals/${sha}/${filename.replace(/[^\w.-]/g, "_")}`;
  await env.LIBRARY.put(originalKey, bytes, { sha256: sha, customMetadata: { sourceId: meta.id } });

  const decoded = decodeUtf8(bytes);
  let extractedKey: string | null = null;
  if (decoded.ok) {
    extractedKey = `extracted/${sha}.txt`;
    await env.LIBRARY.put(extractedKey, decoded.text!, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
  }

  const importId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO sources (id, title, author, editor, edition, publication_year, publisher, language, source_url,
         attribution, reuse_terms, notes, original_filename, original_r2_key, extracted_r2_key, sha256, byte_length)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      meta.id,
      meta.title,
      meta.author,
      meta.editor ?? null,
      meta.edition ?? null,
      meta.publication_year ?? null,
      meta.publisher ?? null,
      meta.language ?? null,
      meta.source_url,
      meta.attribution,
      meta.reuse_terms,
      meta.notes ?? null,
      filename,
      originalKey,
      extractedKey,
      sha,
      bytes.byteLength,
    ),
    env.DB.prepare("INSERT INTO imports (id, source_id, status, error) VALUES (?, ?, ?, ?)").bind(
      importId,
      meta.id,
      decoded.ok ? "uploaded" : "failed",
      decoded.ok ? null : decoded.error!,
    ),
  ]);
  if (!decoded.ok) {
    await env.DB.batch(issueStatements(env, importId, [{ kind: "extraction_failure", severity: "error", detail: decoded.error! }]));
  }
  return json({ duplicate: false, sourceId: meta.id, import: await importStatus(env, importId) }, 201);
}

interface PassageBatch {
  parserVersion: string;
  total: number;
  start: number;
  passages: Passage[];
  issues?: Issue[];
}

/**
 * Step 2 (repeated): store a batch of passages. Each passage must match the
 * stored extracted text at its offsets exactly, so references can be trusted.
 * Batches are idempotent; resending one is harmless.
 */
async function addPassages(request: Request, env: Env, importId: string) {
  const body = (await request.json()) as PassageBatch;
  const imp = await env.DB.prepare("SELECT * FROM imports WHERE id = ?").bind(importId).first<{
    source_id: string;
    status: string;
    parser_version: string | null;
    total_passages: number | null;
    processed_passages: number;
  }>();
  if (!imp) throw new HttpError(404, "Import not found");
  if (imp.status === "failed") throw new HttpError(409, "This import failed; see its recorded issues.");
  if (imp.status === "complete") return json(await importStatus(env, importId));
  if (imp.parser_version && imp.parser_version !== body.parserVersion) {
    throw new HttpError(409, `Import was started with parser ${imp.parser_version}; resume with the same version.`);
  }
  if (imp.total_passages != null && imp.total_passages !== body.total) {
    throw new HttpError(409, "Passage count differs from the original run; the text or parser changed.");
  }
  if (!Array.isArray(body.passages) || body.passages.length > 200) throw new HttpError(400, "Send 1 to 200 passages per batch");
  if (body.start > imp.processed_passages) throw new HttpError(409, `Expected batch starting at ${imp.processed_passages}`);

  const src = await env.DB.prepare("SELECT extracted_r2_key FROM sources WHERE id = ?")
    .bind(imp.source_id)
    .first<{ extracted_r2_key: string }>();
  const obj = await env.LIBRARY.get(src!.extracted_r2_key);
  if (!obj) throw new HttpError(500, "Extracted text is missing from storage");
  const text = await obj.text();

  body.passages.forEach((p, i) => {
    if (p.ordinal !== body.start + i) throw new HttpError(400, `Passage ordinal ${p.ordinal} is out of sequence`);
    if (text.slice(p.charStart, p.charEnd) !== p.text) {
      throw new HttpError(400, `Passage ${p.ordinal} does not match the stored text at characters ${p.charStart}-${p.charEnd}`);
    }
  });

  const processed = Math.max(imp.processed_passages, body.start + body.passages.length);
  const done = processed >= body.total;
  const stmts = body.passages.map((p) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO passages (source_id, ordinal, chapter, section, char_start, char_end, line_start, line_end,
         page_start, page_end, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(imp.source_id, p.ordinal, p.chapter, p.section, p.charStart, p.charEnd, p.lineStart, p.lineEnd, p.pageStart, p.pageEnd, p.text),
  );
  stmts.push(
    env.DB.prepare(
      `UPDATE imports SET status = ?, parser_version = ?, total_passages = ?, processed_passages = ?,
         updated_at = datetime('now') WHERE id = ?`,
    ).bind(done ? "complete" : "processing", body.parserVersion, body.total, processed, importId),
  );
  // Issues found while splitting are recorded once, atomically with the first batch.
  if (body.start === 0 && imp.processed_passages === 0) stmts.push(...issueStatements(env, importId, body.issues ?? []));
  await env.DB.batch(stmts);
  return json(await importStatus(env, importId));
}
