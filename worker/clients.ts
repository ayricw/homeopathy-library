// Client records API. Only the emails in CLIENT_EMAILS can use it (on top of the Access check that
// guards the whole app), and only when the CLIENTS database and the CLIENT_KEY secret are set up.
// Names and visit contents are encrypted before they are stored and are never logged.
import {
  cleanDate,
  cleanName,
  cleanVisit,
  emptyVisit,
  importKey,
  nameContext,
  open,
  seal,
  visitContext,
  type VisitData,
} from "../shared/clients";
import { allowedEmails } from "./access";
import { HttpError, json } from "./http";

export interface ClientsEnv {
  CLIENTS?: D1Database;
  CLIENT_KEY?: string; // 32 random bytes, base64; a Worker secret
  CLIENT_EMAILS?: string; // comma-separated; a Worker secret
  ENVIRONMENT: string;
}

type Who = { local: boolean; email: string | null };

// Used only by `vite dev` on this machine, so local testing needs no secret. Never used when deployed.
const LOCAL_ONLY_KEY = "bG9jYWwtb25seS1rZXktbm90LWZvci1yZWFsLWRhdGE=";

export function clientsAllowed(env: ClientsEnv, who: Who): boolean {
  if (!env.CLIENTS) return false;
  if (who.local) return true;
  return !!env.CLIENT_KEY && !!who.email && allowedEmails(env.CLIENT_EMAILS).has(who.email);
}

let keyCache: { secret: string; key: Promise<CryptoKey> } | null = null;
function clientKey(env: ClientsEnv, who: Who) {
  const secret = env.CLIENT_KEY ?? (who.local ? LOCAL_ONLY_KEY : "");
  if (keyCache?.secret !== secret) keyCache = { secret, key: importKey(secret) };
  return keyCache.key;
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const data = await request.json().catch(() => null);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpError(400, "Expected a JSON object.");
  return data as Record<string, unknown>;
}

function must<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new HttpError(400, r.error);
  return r.value;
}

const today = () => new Date().toISOString().slice(0, 10);
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

interface ClientRow {
  id: string;
  name_enc: string;
  created_at: string;
  updated_at: string;
}
interface VisitRow {
  id: string;
  client_id: string;
  visit_date: string;
  data_enc: string;
  created_at: string;
  updated_at: string;
}

/** Handles /api/clients and /api/visits. Returns null for any other path. */
export async function routeClients(request: Request, url: URL, env: ClientsEnv, who: Who): Promise<Response | null> {
  const path = url.pathname.replace(/\/+$/, "");
  if (!/^\/api\/(clients|visits)(\/|$)/.test(path)) return null;
  if (!clientsAllowed(env, who)) throw new HttpError(403, "Client records are not available for this account.");
  const db = env.CLIENTS!;
  const key = await clientKey(env, who);
  const method = request.method;
  let m: RegExpMatchArray | null;

  const getClient = async (id: string) => {
    const row = await db.prepare("SELECT * FROM clients WHERE id = ?").bind(id).first<ClientRow>();
    if (!row) throw new HttpError(404, "Client not found");
    return { id: row.id, name: await open(key, nameContext(row.id), row.name_enc), created_at: row.created_at, updated_at: row.updated_at };
  };
  const readVisit = async (row: VisitRow) => ({
    id: row.id,
    client_id: row.client_id,
    date: row.visit_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...(JSON.parse(await open(key, visitContext(row.client_id, row.id), row.data_enc)) as VisitData),
  });
  const getVisit = async (id: string) => {
    const row = await db.prepare("SELECT * FROM visits WHERE id = ?").bind(id).first<VisitRow>();
    if (!row) throw new HttpError(404, "Visit not found");
    return readVisit(row);
  };
  const clientVisits = async (clientId: string) => {
    const { results } = await db.prepare("SELECT * FROM visits WHERE client_id = ? ORDER BY visit_date DESC, created_at DESC").bind(clientId).all<VisitRow>();
    return Promise.all(results.map(readVisit));
  };

  if (path === "/api/clients" && method === "GET") {
    const { results } = await db
      .prepare(
        `SELECT c.*, COUNT(v.id) AS visit_count, MAX(v.visit_date) AS last_visit
         FROM clients c LEFT JOIN visits v ON v.client_id = c.id GROUP BY c.id`,
      )
      .all<ClientRow & { visit_count: number; last_visit: string | null }>();
    const clients = await Promise.all(
      results.map(async (r) => ({ id: r.id, name: await open(key, nameContext(r.id), r.name_enc), visit_count: r.visit_count, last_visit: r.last_visit })),
    );
    clients.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return json({ clients });
  }

  if (path === "/api/clients" && method === "POST") {
    const name = must(cleanName((await body(request)).name));
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO clients (id, name_enc) VALUES (?, ?)").bind(id, await seal(key, nameContext(id), name)).run();
    return json({ id }, 201);
  }

  if ((m = path.match(new RegExp(`^/api/clients/(${UUID})$`)))) {
    const id = m[1];
    if (method === "GET") {
      const client = await getClient(id);
      const visits = (await clientVisits(id)).map((v) => ({ id: v.id, date: v.date, rubric_count: v.rubrics.length, remedy: v.remedy }));
      return json({ client, visits });
    }
    if (method === "PATCH") {
      await getClient(id);
      const name = must(cleanName((await body(request)).name));
      await db.prepare("UPDATE clients SET name_enc = ?, updated_at = datetime('now') WHERE id = ?").bind(await seal(key, nameContext(id), name), id).run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await getClient(id);
      await db.batch([db.prepare("DELETE FROM visits WHERE client_id = ?").bind(id), db.prepare("DELETE FROM clients WHERE id = ?").bind(id)]);
      return json({ ok: true });
    }
  }

  if ((m = path.match(new RegExp(`^/api/clients/(${UUID})/export$`))) && method === "GET") {
    const client = await getClient(m[1]);
    const visits = (await clientVisits(m[1])).map(({ client_id: _, ...v }) => v);
    const record = { format: "homeopathy-library client record v1", exported_at: new Date().toISOString(), client, visits };
    return new Response(JSON.stringify(record, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="client-record.json"',
        "cache-control": "no-store",
      },
    });
  }

  if ((m = path.match(new RegExp(`^/api/clients/(${UUID})/visits$`))) && method === "POST") {
    const clientId = m[1];
    await getClient(clientId);
    const input = await body(request);
    const date = must(cleanDate(input.date ?? today()));
    const data = input.data === undefined ? emptyVisit() : must(cleanVisit(input.data));
    const id = crypto.randomUUID();
    await db
      .prepare("INSERT INTO visits (id, client_id, visit_date, data_enc) VALUES (?, ?, ?, ?)")
      .bind(id, clientId, date, await seal(key, visitContext(clientId, id), JSON.stringify(data)))
      .run();
    return json({ id }, 201);
  }

  if ((m = path.match(new RegExp(`^/api/visits/(${UUID})$`)))) {
    const id = m[1];
    if (method === "GET") {
      const visit = await getVisit(id);
      const client = await getClient(visit.client_id);
      return json({ visit, client: { id: client.id, name: client.name } });
    }
    if (method === "PUT") {
      const visit = await getVisit(id);
      const input = await body(request);
      const date = must(cleanDate(input.date));
      const data = must(cleanVisit(input.data));
      await db
        .prepare("UPDATE visits SET visit_date = ?, data_enc = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(date, await seal(key, visitContext(visit.client_id, id), JSON.stringify(data)), id)
        .run();
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await getVisit(id);
      await db.prepare("DELETE FROM visits WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
  }

  throw new HttpError(404, "Not found");
}
