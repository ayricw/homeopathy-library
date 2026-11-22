import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Download,
  ListTree,
  Minus,
  Pencil,
  Pill,
  Printer,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { MAX_CASE_RUBRICS, repertorize, toRubric, type RankMethod, type RepertoryFile, type Rubric } from "../shared/repertory";
import { buildSuggestIndex, groupSuggestions, phrasesFromAnswers, suggestRubrics, type SuggestIndex, type Suggestion } from "../shared/suggest";
import { send, type ClientDetail, type ClientSummary, type PreviousVisit, type Visit } from "./api";
import { emptyVisit, MAX_ANSWER, RESPONSES, VISIT_KINDS, type Response, type VisitKind } from "../shared/clients";
import { Avatar, EmptyState } from "./ui";
import { FORMS, KIND_LABEL, OPTION_SEPARATOR, type Question } from "./intake";
import { CaseList, CaseResults, go, liveRubrics, RubricPicker, Status, useFetch, useRepertory, type AppConfig, type LoadedRepertory } from "./App";
import { shortDate } from "./HomePage";

// Client records. Names and visits are stored encrypted in the clients database by the Worker.
// They are never put in the URL (pages use random ids), browser storage or logs.

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** How a client did since the last remedy, with an icon and a colour for the timeline. */
export const RESPONSE_LABEL: Record<Exclude<Response, "">, string> = {
  better: "Better",
  partly: "Partly better",
  same: "No change",
  worse: "Worse",
  aggravation: "Aggravation first",
};
export function ResponseIcon({ response, size = 15 }: { response: Response; size?: number }) {
  if (response === "better" || response === "partly") return <TrendingUp size={size} aria-hidden="true" />;
  if (response === "worse") return <TrendingDown size={size} aria-hidden="true" />;
  if (response === "aggravation") return <Zap size={size} aria-hidden="true" />;
  return <Minus size={size} aria-hidden="true" />;
}
export function ResponseBadge({ response }: { response: Response }) {
  if (!response) return null;
  return (
    <span className={`response-badge r-${response}`}>
      <ResponseIcon response={response} size={13} />
      {RESPONSE_LABEL[response]}
    </span>
  );
}
/** "Pulsatilla 200C" */
export const prescription = (v: { remedy: string; potency?: string }) => [v.remedy, v.potency].filter(Boolean).join(" ");
export const POTENCIES = ["6C", "12C", "30C", "200C", "1M", "10M", "LM1", "LM2", "LM3", "6X", "12X"];

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
      <div className="page-head">
        <span className="page-icon">
          <Users />
        </span>
        <div>
          <h1>Clients</h1>
          <p className="muted">Every client's visits, prescriptions and how they responded, stored encrypted.</p>
        </div>
      </div>
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
        <span className="search-field">
          <UserPlus size={18} className="field-icon" aria-hidden="true" />
          <input id="new-client" value={name} onChange={(e) => setName(e.target.value)} placeholder="New client's name or initials" maxLength={100} autoComplete="off" />
        </span>
        <button type="submit" disabled={busy || !name.trim()}>
          Add client
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      <Status loading={list.loading} error={list.error} />
      {list.data && list.data.clients.length === 0 && <EmptyState icon={<Users />} title="No clients yet" text="Add a client above to start their first intake." />}
      {list.data && list.data.clients.length > 8 && (
        <span className="search-field filter-field">
          <Search size={16} className="field-icon" aria-hidden="true" />
          <input className="browse-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a client" aria-label="Find a client" />
        </span>
      )}
      {shown.length > 0 && (
        <ul className="client-cards">
          {shown.map((c) => (
            <li key={c.id}>
              <a href={`#/clients/${c.id}`}>
                <Avatar name={c.name} />
                <span className="cc-text">
                  <b>{c.name}</b>
                  <span className="muted small">
                    {c.visit_count} visit{c.visit_count === 1 ? "" : "s"}
                    {c.last_visit ? ` · last ${shortDate(c.last_visit)}` : ""}
                  </span>
                </span>
                <ChevronRight size={18} className="muted" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A small menu for actions that should be hard to hit by mistake. */
function MoreMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <details className="more-menu" ref={ref}>
      <summary>More ▾</summary>
      <div className="menu">{children}</div>
    </details>
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
            <div className="title-row">
              <Avatar name={c.name} size="lg" />
              <h1>{c.name}</h1>
              <MoreMenu>
                <button type="button" onClick={() => setRename(c.name)}>
                  <Pencil size={15} aria-hidden="true" /> Rename
                </button>
                <button type="button" onClick={() => window.print()}>
                  <Printer size={15} aria-hidden="true" /> Print timeline
                </button>
                <a href={`/api/clients/${id}/export`} download>
                  <Download size={15} aria-hidden="true" /> Download record
                </a>
                <button
                  type="button"
                  className="danger-item"
                  onClick={() => {
                    if (!window.confirm(`Permanently delete ${c.name} and all ${detail.data!.visits.length} visits? This cannot be undone.`)) return;
                    void act(async () => {
                      await send("DELETE", `/api/clients/${id}`);
                      go("/clients");
                    });
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" /> Delete client…
                </button>
              </MoreMenu>
            </div>
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
            className="controls start-visit"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                const { id: visitId } = await send<{ id: string }>("POST", `/api/clients/${id}/visits`, { date, data: emptyVisit(newKind) });
                go(`/visits/${visitId}`);
              });
            }}
          >
            <label htmlFor="new-visit-kind">
              <CalendarDays size={17} aria-hidden="true" /> New visit
            </label>
            <select id="new-visit-kind" value={newKind} onChange={(e) => setKind(e.target.value as VisitKind)}>
              {VISIT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <label htmlFor="visit-date" className="visually-hidden">
              Visit date
            </label>
            <input id="visit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <button type="submit">Start visit</button>
          </form>
          {error && <p className="error">{error}</p>}

          <Timeline visits={detail.data!.visits} />
        </>
      )}
    </section>
  );
}

/** The client's visits, newest first: what was given each time and how they responded by the next visit. */
function Timeline({ visits }: { visits: ClientDetail["visits"] }) {
  if (visits.length === 0) return <EmptyState icon={<CalendarDays />} title="No visits yet" text="Start the first visit above. A first visit opens the full intake." />;
  // Oldest first for the summary strip: remedy, then the response recorded at the next visit.
  const chrono = [...visits].reverse();
  const given = chrono.map((v, i) => ({ v, response: chrono[i + 1]?.response ?? "" })).filter((x) => x.v.remedy);
  return (
    <>
      {given.length > 0 && (
        <div className="rx-strip" aria-label="Remedies given">
          <h2>
            <Pill size={18} aria-hidden="true" /> Remedies given
          </h2>
          <ol>
            {given.map(({ v, response }) => (
              <li key={v.id} className={response ? `r-${response}` : undefined}>
                <b>{prescription(v)}</b>
                <span className="muted small">{shortDate(v.date)}</span>
                {response ? <ResponseBadge response={response} /> : <span className="muted small">Response not recorded yet</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      <h2 className="section-title">
        <CalendarDays size={20} aria-hidden="true" /> Timeline
      </h2>
      <ol className="timeline">
        {visits.map((v) => (
          <li key={v.id} className={v.response ? `r-${v.response}` : undefined}>
            <span className="tl-dot" aria-hidden="true" />
            <a href={`#/visits/${v.id}`} className="tl-card">
              <span className="visit-when">
                <b>{shortDate(v.date)}</b> <span className="kind-pill">{KIND_LABEL[v.kind ?? "acute"]}</span>
                {v.response && <ResponseBadge response={v.response} />}
              </span>
              {v.response_note && <span className="tl-response">“{v.response_note}”</span>}
              {v.complaint && <span className="visit-complaint">{v.complaint}</span>}
              <span className="tl-meta">
                {v.remedy ? (
                  <span className="rx">
                    <Pill size={14} aria-hidden="true" /> {prescription(v)}
                    {v.dosing && <span className="muted"> · {v.dosing}</span>}
                  </span>
                ) : (
                  <span className="muted">No remedy recorded</span>
                )}
                <span className="muted">
                  {v.rubric_count} rubric{v.rubric_count === 1 ? "" : "s"}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}

type SaveState = "saved" | "unsaved" | "saving" | { error: string };

export function VisitPage({ id, config }: { id: string; config?: AppConfig }) {
  const rep = useRepertory();
  const loaded = useFetch<{ visit: Visit; client: { id: string; name: string }; previous: PreviousVisit | null }>(config?.clients ? `/api/visits/${id}` : null);
  if (config && !config.clients) return <NotAvailable />;
  return (
    <section className="wide">
      <TestOnly config={config} />
      <Status loading={loaded.loading} error={loaded.error} />
      {rep.error && <p className="error">The repertory could not be loaded: {rep.error}</p>}
      {rep.rep === null && <p className="muted">No repertory is included in this deployment yet.</p>}
      {loaded.data && rep.rep && <VisitEditor key={id} rep={rep.rep} visit={loaded.data.visit} client={loaded.data.client} previous={loaded.data.previous ?? null} />}
    </section>
  );
}

type Step = "case" | "rubrics" | "remedy";
// Remembered per visit for this page load, so coming back from reading a remedy lands on the same step.
const visitStep = new Map<string, Step>();

function VisitEditor({ rep, visit, client, previous }: { rep: LoadedRepertory; visit: Visit; client: { id: string; name: string }; previous: PreviousVisit | null }) {
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
  const [rubricsState, setRubrics] = useState<Rubric[]>(initial.found);
  const rubrics = liveRubrics(rep.data, rubricsState);
  const [method, setMethod] = useState<RankMethod>(visit.method);
  const [date, setDate] = useState(visit.date);
  const [notes, setNotes] = useState(visit.notes);
  const [remedy, setRemedy] = useState(visit.remedy);
  const [potency, setPotency] = useState(visit.potency ?? "");
  const [dosing, setDosing] = useState(visit.dosing ?? "");
  const [response, setResponse] = useState<Response>(visit.response ?? "");
  const [responseNotes, setResponseNotes] = useState(visit.responseNotes ?? "");
  const [kind, setKind] = useState<VisitKind>(visit.kind ?? "acute");
  const [answers, setAnswers] = useState<Record<string, string>>(visit.answers ?? {});
  const [state, setState] = useState<SaveState>("saved");
  const [step, setStepState] = useState<Step>(() => visitStep.get(visit.id) ?? "case");
  const setStep = (s: Step) => {
    visitStep.set(visit.id, s);
    setStepState(s);
    window.scrollTo({ top: 0 });
  };

  const payload = {
    date,
    data: { rubrics: [...rubricsState.map((r) => r.path), ...initial.missing], method, notes, remedy, potency, dosing, response, responseNotes, kind, answers },
  };
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

  const deferred = useDeferredValue(answers);
  const suggestions = useMemo(() => {
    const questions = FORMS[kind].flatMap((s) => s.questions);
    return suggestRubrics(getSuggestIndex(rep.data), phrasesFromAnswers(deferred, questions, OPTION_SEPARATOR));
  }, [rep.data, kind, deferred]);
  const inCase = new Set(rubrics.map((r) => r.id));
  const waiting = suggestions.filter((s) => !inCase.has(s.id)).length;
  const answered = FORMS[kind].flatMap((s) => s.questions).filter((q) => answers[q.id]?.trim() || answers[`${q.id}-more`]?.trim()).length;
  const ranked = useMemo(() => repertorize(rep.rankData, rubrics.map((r) => r.id), method), [rep.rankData, rubrics.map((r) => r.id).join(","), method]);

  const steps: { id: Step; title: string; note: string; icon: ReactNode }[] = [
    { id: "case", title: "1 · Case", note: `${answered} answer${answered === 1 ? "" : "s"}`, icon: <ClipboardList size={20} aria-hidden="true" /> },
    { id: "rubrics", title: "2 · Rubrics", note: `${rubrics.length} in the case${waiting ? `, ${waiting} suggested` : ""}`, icon: <ListTree size={20} aria-hidden="true" /> },
    { id: "remedy", title: "3 · Remedy", note: prescription({ remedy, potency }) || "Not chosen yet", icon: <Pill size={20} aria-hidden="true" /> },
  ];
  const at = steps.findIndex((s) => s.id === step);
  const nav = (
    <div className="step-nav">
      {at > 0 ? (
        <button type="button" className="secondary" onClick={() => setStep(steps[at - 1].id)}>
          ← {steps[at - 1].title.split(" · ")[1]}
        </button>
      ) : (
        <span />
      )}
      {at < steps.length - 1 ? (
        <button type="button" onClick={() => setStep(steps[at + 1].id)}>
          Next: {steps[at + 1].title.split(" · ")[1]} →
        </button>
      ) : (
        <a className="button-link" href={`#/clients/${client.id}`}>
          Done, back to {client.name}
        </a>
      )}
    </div>
  );

  return (
    <>
      <p className="crumbs">
        <a href="#/clients">Clients</a> › <a href={`#/clients/${client.id}`}>{client.name}</a> › Visit
      </p>
      <div className="title-row">
        <h1>{client.name}</h1>
        <span className="kind-pill">{KIND_LABEL[kind]}</span>
        <span className="muted visit-date">{shortDate(date)}</span>
        <span className={`save-state${typeof state === "object" ? " error" : ""}`} role="status">
          {state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "unsaved" ? "Not saved yet" : `Not saved: ${state.error}`}
        </span>
        <MoreMenu>
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
          <p className="muted small">Changing the type changes the questions. Answers already written are kept.</p>
          <a href={`#/visits/${visit.id}/report`}>
            <Printer size={15} aria-hidden="true" /> Case report to print
          </a>
          <button
            type="button"
            className="danger-item"
            onClick={() => {
              if (!window.confirm(`Permanently delete this visit (${date})? This cannot be undone.`)) return;
              pending.current = null;
              void send("DELETE", `/api/visits/${visit.id}`)
                .then(() => go(`/clients/${client.id}`))
                .catch((e: Error) => setState({ error: e.message }));
            }}
          >
            <Trash2 size={15} aria-hidden="true" /> Delete visit…
          </button>
        </MoreMenu>
      </div>

      <div className="visit-steps" role="tablist" aria-label="Visit steps">
        {steps.map((s, i) => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === step} className={i < at ? "done" : undefined} onClick={() => setStep(s.id)}>
            <span className="step-icon">{s.icon}</span>
            <span className="step-text">
              <b>{s.title}</b>
              <span>{s.note}</span>
            </span>
          </button>
        ))}
      </div>

      {step === "case" && (kind === "followup" || previous?.remedy || response) && (
        <section className="since-last">
          <h2>
            <TrendingUp size={18} aria-hidden="true" /> Since the last remedy
          </h2>
          {previous?.remedy ? (
            <p className="muted">
              Last visit {shortDate(previous.date)}: <b className="rx-inline">{prescription(previous)}</b>
              {previous.dosing && ` · ${previous.dosing}`}
            </p>
          ) : (
            <p className="muted">No remedy was recorded at the last visit.</p>
          )}
          <div className="segmented response-pick" role="radiogroup" aria-label="Response to the last remedy">
            {RESPONSES.filter((r): r is Exclude<Response, ""> => r !== "").map((r) => (
              <button key={r} type="button" role="radio" aria-checked={response === r} className={`r-${r}`} onClick={() => setResponse(response === r ? "" : r)}>
                <ResponseIcon response={r} /> {RESPONSE_LABEL[r]}
              </button>
            ))}
          </div>
          <label htmlFor="response-notes" className="visually-hidden">
            How they responded
          </label>
          <textarea
            id="response-notes"
            className="visit-notes"
            value={responseNotes}
            onChange={(e) => setResponseNotes(e.target.value)}
            maxLength={5000}
            rows={2}
            placeholder="What changed: energy, sleep, mood, the main complaint, any return of old symptoms"
          />
        </section>
      )}

      {step === "case" && (
        <div className="visit-layout">
          <CaseForm kind={kind} answers={answers} setAnswer={(id, text) => setAnswers((a) => ({ ...a, [id]: text }))} />
          <aside className="peek">
            <h2>So far</h2>
            <p>
              <b>{waiting}</b> suggested rubric{waiting === 1 ? "" : "s"} from your answers
            </p>
            <p>
              <b>{rubrics.length}</b> rubric{rubrics.length === 1 ? "" : "s"} in the case
            </p>
            {ranked.length > 0 && (
              <ol className="peek-remedies">
                {ranked.slice(0, 3).map((m) => (
                  <li key={m.index}>
                    <span>{m.name}</span>
                    <span className="muted">
                      {m.covered}/{rubrics.length}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <button type="button" onClick={() => setStep("rubrics")}>
              Go to Rubrics →
            </button>
          </aside>
          <div className="other-notes">
            <h2>Other notes</h2>
            <label htmlFor="visit-notes" className="visually-hidden">
              Other notes
            </label>
            <textarea id="visit-notes" className="visit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={20000} rows={5} />
          </div>
        </div>
      )}

      {step === "rubrics" && (
        <div className="rubrics-layout">
          <div>
            {initial.missing.length > 0 && (
              <p className="warning">
                {initial.missing.length} rubric{initial.missing.length === 1 ? " is" : "s are"} not in the current repertory and{" "}
                {initial.missing.length === 1 ? "is" : "are"} left out of the ranking: {initial.missing.join("; ")}
              </p>
            )}
            <SuggestedRubrics rep={rep} kind={kind} suggestions={suggestions} rubrics={rubrics} setRubrics={setRubrics} />
            <h2>Find more in the repertory</h2>
            <RubricPicker rep={rep} rubrics={rubrics} setRubrics={setRubrics} />
          </div>
          <aside className="case-side">
            <h2>
              In the case <span className="muted">· {rubrics.length}</span>
            </h2>
            <CaseList rubrics={rubrics} setRubrics={setRubrics} />
          </aside>
        </div>
      )}

      {step === "remedy" && (
        <>
          <CaseResults rep={rep} rubrics={rubrics} setRubrics={setRubrics} method={method} setMethod={setMethod} chosen={remedy} onChoose={setRemedy} />
          <section className="rx-card">
            <h2>
              <Pill size={20} aria-hidden="true" /> Prescription
            </h2>
            <div className="rx-fields">
              <label>
                <span>Remedy</span>
                <input id="visit-remedy" value={remedy} onChange={(e) => setRemedy(e.target.value)} maxLength={200} autoComplete="off" placeholder="Choose above, or type one" />
              </label>
              <label>
                <span>Potency</span>
                <input list="potencies" value={potency} onChange={(e) => setPotency(e.target.value)} maxLength={40} autoComplete="off" placeholder="e.g. 200C" />
                <datalist id="potencies">
                  {POTENCIES.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
              <label className="wide-field">
                <span>How given</span>
                <input value={dosing} onChange={(e) => setDosing(e.target.value)} maxLength={500} autoComplete="off" placeholder="Your own words, e.g. one dose, then wait" />
              </label>
            </div>
            <p className="muted small">Your record of what you gave. The app never suggests a potency or dose.</p>
          </section>
        </>
      )}

      {nav}
    </>
  );
}

/** The visit's form: a list of sections to jump to, then one block per section. Sections fold away. */
function CaseForm({ kind, answers, setAnswer }: { kind: VisitKind; answers: Record<string, string>; setAnswer: (id: string, text: string) => void }) {
  const answered = (q: Question, from = answers) => !!(from[q.id]?.trim() || from[`${q.id}-more`]?.trim());
  // Folded sections open if they had answers when the visit was opened; after that they open and close only by hand.
  const [loaded] = useState(answers);
  const jump = (i: number) => {
    const el = document.getElementById(`section-${i}`) as HTMLDetailsElement | null;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <>
      <nav className="section-index" aria-label="Intake sections">
        {FORMS[kind].map((section, i) => {
          const n = section.questions.filter((q) => answered(q)).length;
          return (
            <button key={section.title} type="button" className={n > 0 ? "has" : undefined} onClick={() => jump(i)}>
              <span>{section.title}</span>
              <small>
                {n}/{section.questions.length}
              </small>
            </button>
          );
        })}
      </nav>
      <div className="case-form">
        {FORMS[kind].map((section, i) => (
          <details key={section.title} id={`section-${i}`} open={!section.folded || section.questions.some((q) => answered(q, loaded))}>
            <summary>
              <h2>{section.title}</h2>
              <span className="muted">
                {section.questions.filter((q) => answered(q)).length} of {section.questions.length}
              </span>
            </summary>
            {section.questions.map((q) => (
              <div key={q.id} className="question">
                {q.options ? (
                  <TickList question={q} value={answers[q.id] ?? ""} more={answers[`${q.id}-more`] ?? ""} setAnswer={setAnswer} />
                ) : (
                  <>
                    <label htmlFor={`q-${q.id}`}>{q.label}</label>
                    {q.hint && <p className="hint">{q.hint}</p>}
                    <textarea
                      id={`q-${q.id}`}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      maxLength={MAX_ANSWER}
                      rows={q.long ? 7 : 2}
                    />
                  </>
                )}
              </div>
            ))}
          </details>
        ))}
      </div>
    </>
  );
}

function TickList({ question: q, value, more, setAnswer }: { question: Question; value: string; more: string; setAnswer: (id: string, text: string) => void }) {
  const ticked = value ? value.split(OPTION_SEPARATOR) : [];
  // Ticks saved under an option that has since been renamed or removed stay in the answer and are shown too.
  const shown = [...q.options!, ...ticked.filter((t) => !q.options!.includes(t))];
  const toggle = (o: string) =>
    setAnswer(q.id, shown.filter((x) => (x === o ? !ticked.includes(o) : ticked.includes(x))).join(OPTION_SEPARATOR));
  return (
    <fieldset>
      <legend>{q.label}</legend>
      {q.hint && <p className="hint">{q.hint}</p>}
      <div className="ticks">
        {shown.map((o) => (
          <button key={o} type="button" aria-pressed={ticked.includes(o)} onClick={() => toggle(o)}>
            {o}
          </button>
        ))}
      </div>
      <label htmlFor={`q-${q.id}-more`} className="visually-hidden">
        {q.label}: details
      </label>
      <textarea
        id={`q-${q.id}-more`}
        placeholder="Details, other, or how strongly"
        value={more}
        onChange={(e) => setAnswer(`${q.id}-more`, e.target.value)}
        maxLength={MAX_ANSWER}
        rows={1}
      />
    </fieldset>
  );
}

// Built once per repertory file, the first time a visit shows suggestions.
let suggestIndex: { data: RepertoryFile; index: SuggestIndex } | null = null;
const getSuggestIndex = (data: RepertoryFile) => {
  if (suggestIndex?.data !== data) suggestIndex = { data, index: buildSuggestIndex(data) };
  return suggestIndex.index;
};

const PER_GROUP = 3;

/** Rubrics matching what is ticked and written on the form. Worked out in the browser; nothing is sent anywhere. */
function SuggestedRubrics({
  rep,
  kind,
  suggestions,
  rubrics,
  setRubrics,
}: {
  rep: LoadedRepertory;
  kind: VisitKind;
  suggestions: Suggestion[];
  rubrics: Rubric[];
  setRubrics: (next: Rubric[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const inCase = new Set(rubrics.map((r) => r.id));
  const full = rubrics.length >= MAX_CASE_RUBRICS;
  const { groups, broad } = groupSuggestions(FORMS[kind], suggestions);

  const row = (s: Suggestion) => {
    const added = inCase.has(s.id);
    return (
      <li key={s.id}>
        <div>
          <span className="suggest-path">{s.path}</span>
          <span className="suggest-from">
            {s.from} · {s.remedyCount} {s.remedyCount === 1 ? "remedy" : "remedies"}
          </span>
        </div>
        <button
          type="button"
          className={added ? "secondary" : undefined}
          disabled={added || full}
          onClick={() => setRubrics([...rubrics, toRubric(rep.data, s.id)])}
        >
          {added ? "Added ✓" : "Add"}
        </button>
      </li>
    );
  };

  return (
    <section className="suggested">
      <h2>Suggested from the case</h2>
      {suggestions.length === 0 ? (
        <p className="muted small">Tick boxes and write answers in the Case step, and matching rubrics appear here.</p>
      ) : (
        <>
          {groups.map((g) => {
            const open = expanded.has(g.title);
            const shown = open ? g.items : g.items.slice(0, PER_GROUP);
            return (
              <div key={g.title} className="suggest-group">
                <h3>{g.title}</h3>
                <ul className="suggest-list">{shown.map(row)}</ul>
                {g.items.length > shown.length && (
                  <button type="button" className="link more-link" onClick={() => setExpanded(new Set([...expanded, g.title]))}>
                    {g.items.length - shown.length} more from {g.title.toLowerCase()}
                  </button>
                )}
              </div>
            );
          })}
          {broad.length > 0 && (
            <details className="suggest-group broad">
              <summary>
                {broad.length} broad rubric{broad.length === 1 ? "" : "s"} hidden (very general, or over 150 remedies)
              </summary>
              <ul className="suggest-list">{broad.map(row)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
