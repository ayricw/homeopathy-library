import { useEffect, useRef, useState } from "react";
import { toRubric, type RankMethod, type Rubric } from "../shared/repertory";
import { send, type ClientDetail, type ClientSummary, type Visit } from "./api";
import { emptyVisit, MAX_ANSWER, VISIT_KINDS, type VisitKind } from "../shared/clients";
import { FORMS, KIND_LABEL } from "./intake";
import { go, RepertoryCase, Status, useFetch, useRepertory, type AppConfig, type LoadedRepertory } from "./App";

// Client records. Names and visits are stored encrypted in the clients database by the Worker.
// They are never put in the URL (pages use random ids), browser storage or logs.

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function TestOnly({ config }: { config?: AppConfig }) {
  if (!config || config.environment === "production") return null;
  return (
    <p className="warning">
      This is the {config.environment} version. Use made-up test clients only. Real client records go in the production app.
    </p>
  );
}

function NotAvailable() {
  return <p className="muted">Client records are not available for this account.</p>;
}

export function ClientsPage({ config }: { config?: AppConfig }) {
  const [reload, setReload] = useState(0);
  const list = useFetch<{ clients: ClientSummary[] }>(config?.clients ? `/api/clients?r=${reload}` : null);
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (config && !config.clients) return <NotAvailable />;

  const add = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const { id } = await send<{ id: string }>("POST", "/api/clients", { name });
      setName("");
      setReload((r) => r + 1);
      go(`/clients/${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const shown = (list.data?.clients ?? []).filter((c) => c.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <section>
      <h1>Clients</h1>
      <TestOnly config={config} />
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <label htmlFor="new-client" className="visually-hidden">
          New client name
        </label>
        <input id="new-client" value={name} onChange={(e) => setName(e.target.value)} placeholder="New client's name or initials" maxLength={100} autoComplete="off" />
        <button type="submit" disabled={busy || !name.trim()}>
          Add client
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <Status loading={list.loading} error={list.error} />
      {list.data && list.data.clients.length === 0 && <p className="muted">No clients yet.</p>}
      {list.data && list.data.clients.length > 8 && (
        <input className="browse-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a client" aria-label="Find a client" />
      )}
      {shown.length > 0 && (
        <ul className="client-list">
          {shown.map((c) => (
            <li key={c.id}>
              <a href={`#/clients/${c.id}`}>{c.name}</a>
              <span className="muted">
                {c.visit_count} visit{c.visit_count === 1 ? "" : "s"}
                {c.last_visit ? `, last ${c.last_visit}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Names and visits are stored encrypted and are visible only to the accounts allowed to see client records.</p>
    </section>
  );
}

export function ClientPage({ id, config }: { id: string; config?: AppConfig }) {
  const [reload, setReload] = useState(0);
  const detail = useFetch<ClientDetail>(config?.clients ? `/api/clients/${id}?r=${reload}` : null);
  // A client's first visit is a full intake; later ones are follow-ups, unless another type is picked.
  const [kind, setKind] = useState<VisitKind | null>(null);
  const newKind = kind ?? (detail.data?.visits.length ? "followup" : "adult");
  const [rename, setRename] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string>();
  if (config && !config.clients) return <NotAvailable />;

  const act = async (fn: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const c = detail.data?.client;

  return (
    <section>
      <p className="crumbs">
        <a href="#/clients">Clients</a>
      </p>
      <TestOnly config={config} />
      <Status loading={detail.loading && !c} error={detail.error} />
      {c && (
        <>
          {rename === null ? (
            <h1 className="client-head">
              {c.name}
              <button type="button" className="secondary" onClick={() => setRename(c.name)}>
                Rename
              </button>
            </h1>
          ) : (
            <form
              className="search"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  await send("PATCH", `/api/clients/${id}`, { name: rename });
                  setRename(null);
                  setReload((r) => r + 1);
                });
              }}
            >
              <label htmlFor="rename" className="visually-hidden">
                Client name
              </label>
              <input id="rename" value={rename} onChange={(e) => setRename(e.target.value)} maxLength={100} autoComplete="off" autoFocus />
              <button type="submit" disabled={!rename.trim()}>
                Save
              </button>
              <button type="button" className="secondary" onClick={() => setRename(null)}>
                Cancel
              </button>
            </form>
          )}

          <form
            className="controls"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                const { id: visitId } = await send<{ id: string }>("POST", `/api/clients/${id}/visits`, { date, data: emptyVisit(newKind) });
                go(`/visits/${visitId}`);
              });
            }}
          >
            <label htmlFor="visit-date">Visit date</label>
            <input id="visit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <label htmlFor="new-visit-kind">Type</label>
            <select id="new-visit-kind" value={newKind} onChange={(e) => setKind(e.target.value as VisitKind)}>
              {VISIT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <button type="submit">Start a visit</button>
          </form>
          {error && <p className="error">{error}</p>}

          <h2>Visits</h2>
          {detail.data!.visits.length === 0 ? (
            <p className="muted">No visits yet.</p>
          ) : (
            <ul className="client-list">
              {detail.data!.visits.map((v) => (
                <li key={v.id}>
                  <a href={`#/visits/${v.id}`}>{v.date}</a>
                  <span className="muted">
                    {KIND_LABEL[v.kind ?? "acute"]} · {v.rubric_count} rubric{v.rubric_count === 1 ? "" : "s"}
                    {v.remedy ? ` · ${v.remedy}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2>Record</h2>
          <p className="links">
            <a href={`/api/clients/${id}/export`} download>
              Download this client's record
            </a>
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (!window.confirm(`Permanently delete ${c.name} and all ${detail.data!.visits.length} visits? This cannot be undone.`)) return;
                void act(async () => {
                  await send("DELETE", `/api/clients/${id}`);
                  go("/clients");
                });
              }}
            >
              Delete client
            </button>
          </p>
        </>
      )}
    </section>
  );
}

type SaveState = "saved" | "unsaved" | "saving" | { error: string };

export function VisitPage({ id, config }: { id: string; config?: AppConfig }) {
  const rep = useRepertory();
  const loaded = useFetch<{ visit: Visit; client: { id: string; name: string } }>(config?.clients ? `/api/visits/${id}` : null);
  if (config && !config.clients) return <NotAvailable />;
  return (
    <section className="wide">
      <TestOnly config={config} />
      <Status loading={loaded.loading} error={loaded.error} />
      {rep.error && <p className="error">The repertory could not be loaded: {rep.error}</p>}
      {rep.rep === null && <p className="muted">No repertory is included in this deployment yet.</p>}
      {loaded.data && rep.rep && <VisitEditor key={id} rep={rep.rep} visit={loaded.data.visit} client={loaded.data.client} />}
    </section>
  );
}

function VisitEditor({ rep, visit, client }: { rep: LoadedRepertory; visit: Visit; client: { id: string; name: string } }) {
  // Rubrics are saved by path. Paths the current repertory file no longer has are kept, shown and saved again unchanged.
  const [initial] = useState(() => {
    const found: Rubric[] = [];
    const missing: string[] = [];
    for (const path of visit.rubrics) {
      const n = rep.tree.byPath.get(path);
      const rubricId = n === undefined ? null : rep.tree.nodes[n].id;
      if (rubricId === null) missing.push(path);
      else found.push(toRubric(rep.data, rubricId));
    }
    return { found, missing };
  });
  const [rubrics, setRubrics] = useState<Rubric[]>(initial.found);
  const [method, setMethod] = useState<RankMethod>(visit.method);
  const [date, setDate] = useState(visit.date);
  const [notes, setNotes] = useState(visit.notes);
  const [remedy, setRemedy] = useState(visit.remedy);
  const [kind, setKind] = useState<VisitKind>(visit.kind ?? "acute");
  const [answers, setAnswers] = useState<Record<string, string>>(visit.answers ?? {});
  const [state, setState] = useState<SaveState>("saved");

  const payload = { date, data: { rubrics: [...rubrics.map((r) => r.path), ...initial.missing], method, notes, remedy, kind, answers } };
  const pending = useRef<string | null>(null);
  const first = useRef(true);
  const serialized = JSON.stringify(payload);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = serialized;
    setState("unsaved");
    const t = setTimeout(async () => {
      setState("saving");
      try {
        await send("PUT", `/api/visits/${visit.id}`, JSON.parse(serialized));
        if (pending.current === serialized) {
          pending.current = null;
          setState("saved");
        }
      } catch (e) {
        setState({ error: (e as Error).message });
      }
    }, 800);
    return () => clearTimeout(t);
  }, [serialized, visit.id]);

  // Leaving the page (another tab of the app, or closing it) saves anything not yet saved.
  useEffect(() => {
    const flush = () => {
      if (pending.current) void send("PUT", `/api/visits/${visit.id}`, JSON.parse(pending.current), { keepalive: true }).catch(() => {});
    };
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      flush();
    };
  }, [visit.id]);

  return (
    <>
      <p className="crumbs">
        <a href="#/clients">Clients</a> › <a href={`#/clients/${client.id}`}>{client.name}</a> › Visit
      </p>
      <h1 className="client-head">
        {client.name}
        <span className={`save-state${typeof state === "object" ? " error" : ""}`} role="status">
          {state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "unsaved" ? "Not saved yet" : `Not saved: ${state.error}`}
        </span>
      </h1>
      <div className="controls">
        <label htmlFor="visit-date">Visit date</label>
        <input id="visit-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} required />
        <label htmlFor="visit-kind">Visit type</label>
        <select id="visit-kind" value={kind} onChange={(e) => setKind(e.target.value as VisitKind)}>
          {VISIT_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <CaseForm kind={kind} answers={answers} setAnswer={(id, text) => setAnswers((a) => ({ ...a, [id]: text }))} />
      <h2>Other notes</h2>
      <label htmlFor="visit-notes" className="visually-hidden">
        Other notes
      </label>
      <textarea id="visit-notes" className="visit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={20000} rows={6} />
      <h2>Rubrics from the case</h2>
      {initial.missing.length > 0 && (
        <p className="warning">
          {initial.missing.length} rubric{initial.missing.length === 1 ? " is" : "s are"} not in the current repertory and{" "}
          {initial.missing.length === 1 ? "is" : "are"} left out of the ranking: {initial.missing.join("; ")}
        </p>
      )}
      <RepertoryCase rep={rep} rubrics={rubrics} setRubrics={setRubrics} method={method} setMethod={setMethod} saved />
      <div className="controls">
        <label htmlFor="visit-remedy">Remedy chosen</label>
        <input id="visit-remedy" value={remedy} onChange={(e) => setRemedy(e.target.value)} maxLength={200} autoComplete="off" />
      </div>
      <p className="links">
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (!window.confirm(`Permanently delete this visit (${date})? This cannot be undone.`)) return;
            pending.current = null;
            void send("DELETE", `/api/visits/${visit.id}`)
              .then(() => go(`/clients/${client.id}`))
              .catch((e: Error) => setState({ error: e.message }));
          }}
        >
          Delete visit
        </button>
      </p>
    </>
  );
}


/** The visit's form: one block per section, each question with its own box. Sections fold away. */
function CaseForm({ kind, answers, setAnswer }: { kind: VisitKind; answers: Record<string, string>; setAnswer: (id: string, text: string) => void }) {
  return (
    <div className="case-form">
      {FORMS[kind].map((section) => {
        const done = section.questions.filter((q) => answers[q.id]?.trim()).length;
        return (
          <details key={section.title} open>
            <summary>
              <h2>{section.title}</h2>
              <span className="muted">
                {done} of {section.questions.length}
              </span>
            </summary>
            {section.questions.map((q) => (
              <div key={q.id} className="question">
                <label htmlFor={`q-${q.id}`}>{q.label}</label>
                {q.hint && <p className="hint">{q.hint}</p>}
                <textarea
                  id={`q-${q.id}`}
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  maxLength={MAX_ANSWER}
                  rows={q.id === "sensation" || q.id === "main-complaint" ? 8 : 3}
                />
              </div>
            ))}
          </details>
        );
      })}
    </div>
  );
}
