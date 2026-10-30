import type { VisitKind } from "../shared/clients";
export interface Source {
  id: string;
  title: string;
  author: string;
  editor: string | null;
  edition: string | null;
  publication_year: number | null;
  publisher: string | null;
  language: string | null;
  source_url: string;
  attribution: string;
  reuse_terms: string;
  notes: string | null;
  original_filename: string;
  sha256: string;
  byte_length: number;
  created_at: string;
  passage_count: number;
  import_status?: string | null;
}

export interface PassageRef {
  id: number;
  ordinal: number;
  chapter: string | null;
  section: string | null;
  page_start: string | null;
  page_end: string | null;
  line_start: number;
  line_end: number;
}

export interface SearchHit extends PassageRef {
  source_id: string;
  snippet: string;
  title: string;
  author: string;
  edition: string | null;
  publication_year: number | null;
}

export interface SearchResponse {
  query: string;
  total: number;
  limit: number;
  offset: number;
  results: SearchHit[];
}

export interface PassageText extends PassageRef {
  text: string;
}

export interface PassageResponse {
  passage: PassageText & { source_id: string };
  source: Source;
  before: PassageText[];
  after: PassageText[];
  corrections: { corrected_text: string; note: string | null; corrected_by: string | null; created_at: string }[];
}

export interface SourceDetail {
  source: Source;
  imports: { id: string; status: string; total_passages: number | null; processed_passages: number; error: string | null; updated_at: string }[];
  issues: { kind: string; severity: string; detail: string; location: string | null }[];
}

export interface SymptomResponse {
  symptoms: string[];
  skipped: string[];
  total: number;
  remedies: { remedy: string; sources: string[]; covered: number; totalHits: number; cells: { hits: number; passageId: number | null }[] }[];
}

export async function post<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(data) });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export interface ClientSummary {
  id: string;
  name: string;
  visit_count: number;
  last_visit: string | null;
}

export interface ClientDetail {
  client: { id: string; name: string; created_at: string };
  visits: { id: string; date: string; rubric_count: number; remedy: string; kind: VisitKind }[];
}

export interface Visit {
  id: string;
  client_id: string;
  date: string;
  rubrics: string[];
  method: "symptoms" | "grades";
  notes: string;
  remedy: string;
  kind?: VisitKind;
  answers?: Record<string, string>;
}

export async function send<T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, data?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { accept: "application/json", "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}
