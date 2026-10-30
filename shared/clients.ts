// Client records: field encryption and validation, shared by the Worker and the tests.
// Names and visit contents are encrypted with AES-GCM before they are stored. The key is the
// CLIENT_KEY Worker secret (32 random bytes, base64). Each value is bound to its record and
// field as additional data, so a stored value copied onto another record does not decrypt.

export const MAX_NAME = 100;
export const MAX_NOTES = 20_000;
export const MAX_REMEDY = 200;
export const MAX_VISIT_RUBRICS = 40;
export const MAX_RUBRIC_PATH = 500;
export const MAX_ANSWER = 10_000;
export const MAX_ANSWERS_TOTAL = 150_000;

/** The kinds of visit; each has its own form (src/intake.ts). Visits saved before kinds existed are acute. */
export const VISIT_KINDS = ["adult", "child", "followup", "acute"] as const;
export type VisitKind = (typeof VISIT_KINDS)[number];

export interface VisitData {
  /** Rubric paths, e.g. "Ear, pain, burning". Paths, not ids, so a rebuilt repertory file still matches. */
  rubrics: string[];
  method: "symptoms" | "grades";
  notes: string;
  remedy: string;
  kind: VisitKind;
  /** Answers to the visit form, by question id. Answers to another kind's form are kept if the kind is changed. */
  answers: Record<string, string>;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function importKey(secret: string | undefined): Promise<CryptoKey> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = unb64((secret ?? "").trim());
  } catch {
    raw = new Uint8Array();
  }
  if (raw.length !== 32) throw new Error("CLIENT_KEY must be 32 random bytes, base64-encoded.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(key: CryptoKey, context: string, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(context) }, key, enc.encode(value)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return `v1:${b64(out)}`;
}

export async function open(key: CryptoKey, context: string, sealed: string): Promise<string> {
  if (!sealed.startsWith("v1:")) throw new Error("Unknown encryption format");
  const bytes = unb64(sealed.slice(3));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: enc.encode(context) }, key, bytes.slice(12));
  return dec.decode(pt);
}

export const nameContext = (clientId: string) => `client:${clientId}:name`;
export const visitContext = (clientId: string, visitId: string) => `visit:${clientId}:${visitId}:data`;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function cleanName(input: unknown): Result<string> {
  if (typeof input !== "string") return { ok: false, error: "Enter a name." };
  const name = input.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Enter a name." };
  if (name.length > MAX_NAME) return { ok: false, error: `A name can be at most ${MAX_NAME} characters.` };
  return { ok: true, value: name };
}

export function cleanDate(input: unknown): Result<string> {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return { ok: false, error: "Enter the visit date as YYYY-MM-DD." };
  const d = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input) return { ok: false, error: "That date does not exist." };
  return { ok: true, value: input };
}

export function cleanVisit(input: unknown): Result<VisitData> {
  const v = (input ?? {}) as Record<string, unknown>;
  const rubrics = v.rubrics ?? [];
  if (!Array.isArray(rubrics) || rubrics.some((r) => typeof r !== "string" || !r.trim() || r.length > MAX_RUBRIC_PATH)) {
    return { ok: false, error: "Rubrics must be a list of rubric paths." };
  }
  const unique = [...new Set(rubrics.map((r: string) => r.trim()))];
  if (unique.length > MAX_VISIT_RUBRICS) return { ok: false, error: `A visit can hold ${MAX_VISIT_RUBRICS} rubrics.` };
  const method = v.method ?? "symptoms";
  if (method !== "symptoms" && method !== "grades") return { ok: false, error: "Unknown ranking method." };
  const notes = v.notes ?? "";
  if (typeof notes !== "string" || notes.length > MAX_NOTES) return { ok: false, error: `Notes can be at most ${MAX_NOTES.toLocaleString()} characters.` };
  const remedy = v.remedy ?? "";
  if (typeof remedy !== "string" || remedy.length > MAX_REMEDY) return { ok: false, error: `The remedy can be at most ${MAX_REMEDY} characters.` };
  const kind = v.kind ?? "acute";
  if (!(VISIT_KINDS as readonly unknown[]).includes(kind)) return { ok: false, error: "Unknown visit type." };
  const raw = v.answers ?? {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: "Answers must be an object." };
  const answers: Record<string, string> = {};
  let total = 0;
  for (const [id, text] of Object.entries(raw)) {
    if (!/^[a-z0-9-]{1,40}$/.test(id) || typeof text !== "string") return { ok: false, error: "Answers are not in the expected form." };
    if (text.length > MAX_ANSWER) return { ok: false, error: `Each answer can be at most ${MAX_ANSWER.toLocaleString()} characters.` };
    total += text.length;
    if (text.trim()) answers[id] = text;
  }
  if (total > MAX_ANSWERS_TOTAL) return { ok: false, error: `The form can hold at most ${MAX_ANSWERS_TOTAL.toLocaleString()} characters.` };
  return { ok: true, value: { rubrics: unique, method, notes, remedy: remedy.trim(), kind: kind as VisitKind, answers } };
}

export const emptyVisit = (kind: VisitKind = "acute"): VisitData => ({ rubrics: [], method: "symptoms", notes: "", remedy: "", kind, answers: {} });
