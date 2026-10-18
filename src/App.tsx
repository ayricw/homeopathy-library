import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { reflow } from "../shared/text";
import { ImportPage } from "./ImportPage";
import { ClientPage, ClientsPage, VisitPage } from "./ClientsPages";
import { excerpt, formatReferences, groupBySource, isCollected, useCollected, type CollectedItem } from "./collect";
import {
  ancestry,
  buildTree,
  filterChildren,
  repertorize,
  rubricRemedies,
  searchRubrics,
  tokenize,
  toRubric,
  MAX_CASE_RUBRICS,
  type RankMethod,
  type RepertoryFile,
  type Rubric,
  type RubricTree,
} from "../shared/repertory";
import { get, post, type SymptomResponse, type PassageRef, type PassageResponse, type SearchResponse, type Source, type SourceDetail } from "./api";

// ---------- tiny hash router: #/search?q=..  #/passage/12  #/sources  #/sources/id ----------

export function useRoute() {
  const read = () => {
    const raw = window.location.hash.replace(/^#/, "") || "/search";
    const [path, query = ""] = raw.split("?");
    return { path, params: new URLSearchParams(query) };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const go = (path: string, params?: Record<string, string>) => {
  const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString() : "";
  window.location.hash = qs ? `${path}?${qs}` : path;
};

export function useFetch<T>(path: string | null) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: !!path });
  useEffect(() => {
    if (!path) return setState({ loading: false });
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    get<T>(path)
      .then((data) => live && setState({ data, loading: false }))
      .catch((e: Error) => live && setState({ error: e.message, loading: false }));
    return () => {
      live = false;
    };
  }, [path]);
  return state;
}

// ---------- shared bits ----------

export interface AppConfig {
  environment: string;
  allowImports: boolean;
  clients: boolean;
}

export function App() {
  const { path, params } = useRoute();
  const collected = useCollected();
  const config = useFetch<AppConfig>("/api/config");
  let page: ReactNode;
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/passage\/(\d+)$/))) page = <PassagePage id={m[1]} q={params.get("q") ?? ""} />;
  else if ((m = path.match(/^\/sources\/([\w-]+)$/))) page = <SourcePage id={m[1]} />;
  else if (path === "/sources") page = <SourcesPage />;
  else if (path === "/import") page = <ImportPage />;
  else if (path === "/collected") page = <CollectedPage />;
  else if (path === "/symptoms") page = <SymptomsPage />;
  else if (path === "/clients") page = <ClientsPage config={config.data} />;
  else if ((m = path.match(/^\/clients\/([0-9a-f-]{36})$/))) page = <ClientPage id={m[1]} config={config.data} />;
  else if ((m = path.match(/^\/visits\/([0-9a-f-]{36})$/))) page = <VisitPage id={m[1]} config={config.data} />;
  else page = <SearchPage params={params} />;

  return (
    <>
      <header className="top">
        <a className="brand" href="#/search">
          Homeopathy Library
        </a>
        <nav>
          <a href="#/search">Search</a>
          {config.data?.clients && <a href="#/clients">Clients</a>}
          <a href="#/symptoms">Symptoms</a>
          <a href="#/sources">Sources</a>
          <a href="#/collected">Collected{collected.items.length > 0 && ` (${collected.items.length})`}</a>
          {config.data?.allowImports && <a href="#/import">Import</a>}
        </nav>
      </header>
      <main>{page}</main>
      <footer className="notice">
        This library reproduces historical and traditional texts. Passages report what their authors claimed. They are not
        evidence that a treatment works and are not medical advice.
      </footer>
    </>
  );
}

export function Status({ loading, error }: { loading: boolean; error?: string }) {
  if (error) return <p className="error">{error}</p>;
  if (loading) return <p className="muted">Loading…</p>;
  return null;
}

/** Renders FTS snippet markers (\u0002 … \u0003) as <mark> without using innerHTML. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\u0002[^\u0003]*\u0003)/);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("\u0002") ? <mark key={i}>{p.slice(1, -1)}</mark> : <span key={i}>{p.replace(/\s+/g, " ")}</span>,
      )}
    </>
  );
}

function pages(p: PassageRef) {
  if (!p.page_start) return null;
  return p.page_end && p.page_end !== p.page_start ? `pp. ${p.page_start}–${p.page_end}` : `p. ${p.page_start}`;
}

function refLine(p: PassageRef) {
  return [p.chapter, p.section, pages(p), `lines ${p.line_start}–${p.line_end}`].filter(Boolean).join(" · ");
}

function citation(s: Pick<Source, "title" | "author" | "edition" | "publication_year">) {
  return [s.author, s.edition, s.publication_year].filter(Boolean).join(", ");
}

function itemFrom(p: PassageRef, s: Pick<Source, "title" | "author" | "edition" | "publication_year">, sourceId: string, text: string): CollectedItem {
  return {
    passageId: p.id,
    sourceId,
    title: s.title,
    author: s.author,
    edition: s.edition,
    publicationYear: s.publication_year,
    heading: p.section ?? p.chapter,
    location: [pages(p), `lines ${p.line_start}–${p.line_end}`].filter(Boolean).join(", "),
    excerpt: excerpt(text),
    addedAt: new Date().toISOString(),
  };
}

function CollectButton({ item }: { item: CollectedItem }) {
  const { items, toggle } = useCollected();
  const on = isCollected(items, item.passageId);
  return (
    <button type="button" className={`collect${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggle(item)}>
      {on ? "Collected ✓" : "Collect"}
    </button>
  );
}

// ---------- search ----------

function SearchPage({ params }: { params: URLSearchParams }) {
  const q = params.get("q") ?? "";
  const filters = { source: params.get("source") ?? "", author: params.get("author") ?? "", edition: params.get("edition") ?? "" };
  const offset = Number(params.get("offset")) || 0;
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const sources = useFetch<{ sources: Source[] }>("/api/sources");
  const qs = new URLSearchParams({ q, ...filters, offset: String(offset) });
  for (const [k, v] of [...qs]) if (!v) qs.delete(k);
  const results = useFetch<SearchResponse>(q.trim() ? `/api/search?${qs}` : null);

  const all = sources.data?.sources ?? [];
  const authors = [...new Set(all.map((s) => s.author))].sort();
  const editions = [...new Set(all.map((s) => s.edition).filter((e): e is string => !!e))].sort();
  const set = (patch: Record<string, string>) => go("/search", { q, ...filters, ...patch });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    go("/search", { ...filters, q: draft.trim() });
  };

  return (
    <section>
      <form className="search" onSubmit={submit} role="search">
        <label htmlFor="q" className="visually-hidden">
          Search the library
        </label>
        <input
          id="q"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='Condition, symptom, or remedy. Use "quotes" for a phrase.'
          autoFocus
        />
        <button type="submit">Search</button>
      </form>

      <div className="filters">
        <select aria-label="Source" value={filters.source} onChange={(e) => set({ source: e.target.value, offset: "" })}>
          <option value="">All sources</option>
          {all.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        <select aria-label="Author" value={filters.author} onChange={(e) => set({ author: e.target.value, offset: "" })}>
          <option value="">All authors</option>
          {authors.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select aria-label="Edition" value={filters.edition} onChange={(e) => set({ edition: e.target.value, offset: "" })} disabled={!editions.length}>
          <option value="">{editions.length ? "All editions" : "No editions recorded"}</option>
          {editions.map((ed) => (
            <option key={ed}>{ed}</option>
          ))}
        </select>
      </div>

      {!q && (
        <p className="muted">
          Search for exact words in {all.length === 1 ? "1 source" : `${all.length} sources`}. Every word must appear in the
          passage. A word ending in * matches its prefix, so <code>rheumat*</code> finds rheumatic and rheumatism.
        </p>
      )}
      <Status loading={results.loading} error={results.error} />
      {results.data && (
        <>
          <p className="muted">
            {results.data.total === 0
              ? "No passages contain all of those words. Try fewer or different words."
              : `${results.data.total} passage${results.data.total === 1 ? "" : "s"} found`}
          </p>
          <ol className="results">
            {results.data.results.map((r) => (
              <li key={r.id} className="result">
                <CollectButton item={itemFrom(r, r, r.source_id, r.snippet)} />
                <a href={`#/passage/${r.id}?q=${encodeURIComponent(q)}`}>
                  <div className="ref">
                    <strong>{r.section ?? r.chapter ?? "Untitled section"}</strong>
                    <span>{[pages(r), `lines ${r.line_start}–${r.line_end}`].filter(Boolean).join(" · ")}</span>
                  </div>
                  <p className="snippet">
                    <Snippet text={r.snippet} />
                  </p>
                  <div className="source-line">
                    {r.title} · {citation(r)}
                  </div>
                </a>
              </li>
            ))}
          </ol>
          <Pager total={results.data.total} limit={results.data.limit} offset={offset} onPage={(o) => set({ offset: String(o) })} />
        </>
      )}
    </section>
  );
}

function Pager({ total, limit, offset, onPage }: { total: number; limit: number; offset: number; onPage: (o: number) => void }) {
  if (total <= limit) return null;
  return (
    <div className="pager">
      <button disabled={offset === 0} onClick={() => onPage(Math.max(offset - limit, 0))}>
        Previous
      </button>
      <span className="muted">
        {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <button disabled={offset + limit >= total} onClick={() => onPage(offset + limit)}>
        Next
      </button>
    </div>
  );
}

// ---------- passage with context ----------

function PassagePage({ id, q }: { id: string; q: string }) {
  const [exact, setExact] = useState(false);
  const { data, loading, error } = useFetch<PassageResponse>(`/api/passages/${id}?context=2`);
  if (!data) return <Status loading={loading} error={error} />;
  const { passage: p, source: s } = data;
  const show = (t: string) => (exact ? <pre>{t}</pre> : reflow(t).split("\n\n").map((para, i) => <p key={i}>{para}</p>));

  return (
    <article className="passage-page">
      <p>
        <a href={q ? `#/search?q=${encodeURIComponent(q)}` : "#/search"}>← Back to results</a>
      </p>
      <header className="passage-head">
        <h1>{p.section ?? p.chapter ?? "Untitled section"}</h1>
        <dl className="refs">
          <dt>Source</dt>
          <dd>
            <a href={`#/sources/${s.id}`}>{s.title}</a>
          </dd>
          <dt>Author</dt>
          <dd>{s.author}</dd>
          <dt>Edition</dt>
          <dd>{s.edition ?? <span className="muted">Not recorded</span>}</dd>
          <dt>Published</dt>
          <dd>{s.publication_year ?? <span className="muted">Not recorded</span>}</dd>
          {p.chapter && (
            <>
              <dt>Chapter</dt>
              <dd>{p.chapter}</dd>
            </>
          )}
          <dt>Page</dt>
          <dd>{pages(p) ?? <span className="muted">This file has no page numbers</span>}</dd>
          <dt>Location</dt>
          <dd>
            Lines {p.line_start}–{p.line_end} of the original text (passage {p.ordinal + 1})
          </dd>
        </dl>
        <p className="links">
          <a href={s.source_url} target="_blank" rel="noopener noreferrer">
            Source page ↗
          </a>
          <a href={`/api/sources/${s.id}/original`} target="_blank" rel="noopener">
            Original file
          </a>
          <CollectButton item={itemFrom(p, s, s.id, reflow(p.text))} />
          <label>
            <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} /> Show exact original line breaks
          </label>
        </p>
      </header>

      {data.before.map((c) => (
        <Context key={c.id} p={c} q={q} current={p}>
          {show(c.text)}
        </Context>
      ))}
      <section className="current" aria-label="Matched passage">
        {show(p.text)}
        {data.corrections.length > 0 && (
          <aside className="corrections">
            <h2>Corrected text</h2>
            {data.corrections.map((c, i) => (
              <div key={i}>
                {show(c.corrected_text)}
                {c.note && <p className="muted">Note: {c.note}</p>}
              </div>
            ))}
          </aside>
        )}
      </section>
      {data.after.map((c) => (
        <Context key={c.id} p={c} q={q} current={p}>
          {show(c.text)}
        </Context>
      ))}
      <p className="attribution">{s.attribution}</p>
    </article>
  );
}

function Context({ p, q, current, children }: { p: PassageRef; q: string; current: PassageRef; children: ReactNode }) {
  const changed = p.section !== current.section || p.chapter !== current.chapter;
  return (
    <section className="context">
      <a className="context-ref" href={`#/passage/${p.id}${q ? `?q=${encodeURIComponent(q)}` : ""}`}>
        {changed ? refLine(p) : [pages(p), `lines ${p.line_start}–${p.line_end}`].filter(Boolean).join(" · ")}
      </a>
      {children}
    </section>
  );
}

// ---------- symptom search ----------
// Symptoms and chosen rubrics live only in memory: never in the URL, browser storage or the server.
// They survive moving between pages and are gone when the tab is closed or reloaded.

const caseMemory: {
  rubrics: Rubric[];
  method: "symptoms" | "grades";
  tab: "repertory" | "books";
  mode: "browse" | "find";
  /** Path of the open level in Browse, or null for the chapter list. */
  browseAt: string | null;
} = {
  rubrics: [],
  method: "symptoms",
  tab: "repertory",
  mode: "browse",
  browseAt: null,
};

export type LoadedRepertory = { data: RepertoryFile; tokens: string[][]; tree: RubricTree };

// The repertory file is loaded once per page load and searched in the browser.
let repertoryLoad: Promise<LoadedRepertory | null> | null = null;
function loadRepertory() {
  repertoryLoad ??= fetch("/data/repertory.json", { headers: { accept: "application/json" } })
    .then(async (res) => {
      // A missing file falls through to the app's index.html, so check the type.
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return null;
      const data = (await res.json()) as RepertoryFile;
      return { data, tokens: tokenize(data), tree: buildTree(data) };
    })
    .catch((e) => {
      repertoryLoad = null;
      throw e;
    });
  return repertoryLoad;
}

export function useRepertory() {
  const [state, setState] = useState<{ rep?: LoadedRepertory | null; error?: string }>({});
  useEffect(() => {
    let live = true;
    loadRepertory()
      .then((rep) => live && setState({ rep }))
      .catch((e: Error) => live && setState({ error: e.message }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

function SymptomsPage() {
  const rep = useRepertory();
  const [tab, setTab] = useState(caseMemory.tab);
  const choose = (t: typeof tab) => {
    caseMemory.tab = t;
    setTab(t);
  };
  return (
    <section className="wide">
      <h1>Symptom search</h1>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "repertory"} onClick={() => choose("repertory")}>
          Repertory
        </button>
        <button type="button" role="tab" aria-selected={tab === "books"} onClick={() => choose("books")}>
          Book passages
        </button>
      </div>
      {tab === "repertory" ? (
        rep.error ? (
          <p className="error">The repertory could not be loaded: {rep.error}</p>
        ) : rep.rep === undefined ? (
          <p className="muted">Loading the repertory…</p>
        ) : rep.rep === null ? (
          <p className="muted">No repertory is included in this deployment yet. See README.md for how to add one.</p>
        ) : (
          <MemoryCase rep={rep.rep} />
        )
      ) : (
        <BookSymptoms />
      )}
    </section>
  );
}

const GRADE_LABEL = ["", "grade 1", "grade 2", "grade 3", "grade 4"];

function RubricRemedies({ data, id }: { data: RepertoryFile; id: number }) {
  const list = rubricRemedies(data, id);
  return (
    <p className="rubric-remedies">
      {list.map((r, i) => (
        <span key={r.abbrev} className={`g${r.grade}`} title={`${r.name}, ${GRADE_LABEL[r.grade]}`}>
          {r.abbrev}
          {i < list.length - 1 ? ", " : ""}
        </span>
      ))}
    </p>
  );
}

/** The Symptoms page case: kept in page memory only. */
function MemoryCase({ rep }: { rep: LoadedRepertory }) {
  const [rubrics, setRubricsState] = useState<Rubric[]>(caseMemory.rubrics);
  const [method, setMethodState] = useState(caseMemory.method);
  return (
    <RepertoryCase
      rep={rep}
      rubrics={rubrics}
      setRubrics={(next) => {
        caseMemory.rubrics = next;
        setRubricsState(next);
      }}
      method={method}
      setMethod={(m) => {
        caseMemory.method = m;
        setMethodState(m);
      }}
    />
  );
}

export function RepertoryCase({
  rep: { data: rep, tokens, tree },
  rubrics,
  setRubrics,
  method,
  setMethod,
  saved = false,
}: {
  rep: LoadedRepertory;
  rubrics: Rubric[];
  setRubrics: (next: Rubric[]) => void;
  method: RankMethod;
  setMethod: (m: RankMethod) => void;
  /** True on a client visit, where the case is saved to the client's record. */
  saved?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [mode, setModeState] = useState(caseMemory.mode);
  const [browsePath, setBrowsePath] = useState(caseMemory.browseAt);
  const setMode = (m: typeof mode) => {
    caseMemory.mode = m;
    setModeState(m);
  };
  const browseAt = browsePath === null ? null : (tree.byPath.get(browsePath) ?? null);
  const goTo = (n: number | null) => {
    const path = n === null ? null : tree.nodes[n].path;
    caseMemory.browseAt = path;
    setBrowsePath(path);
  };
  const found = useMemo(() => (query ? searchRubrics(rep, tokens, query, 40) : null), [rep, tokens, query]);
  // The case is kept by rubric id; drop any that no longer exist in a newer repertory file.
  const caseRubrics = rubrics.filter((r) => rep.rubrics[r.id]?.[0] === r.path);
  const ids = caseRubrics.map((r) => r.id);
  const ranked = useMemo(() => repertorize(rep, ids, method), [rep, ids.join(","), method]);
  const shown = ranked.slice(0, 30);
  const full = caseRubrics.length >= MAX_CASE_RUBRICS;

  const add = (r: Rubric) => !ids.includes(r.id) && !full && setRubrics([...caseRubrics, r]);
  const remove = (id: number) => setRubrics(caseRubrics.filter((r) => r.id !== id));

  return (
    <>
      <p className="muted">
        Start from the body area and narrow down (Ear, then pain, then burning), or find a rubric by its words, and add
        each symptom to the case. Remedies are ranked by how many of the chosen rubrics list
        them, then by their grades (1 to 3). Rubrics come from{" "}
        <a href={rep.source.source_url} target="_blank" rel="noopener noreferrer" title={rep.source.reuse_terms}>
          {rep.source.title}
        </a>{" "}
        ({rep.rubrics.length.toLocaleString()} rubrics).{" "}
        {saved ? "The rubrics you add are saved to this visit, encrypted." : "Everything here runs in your browser and nothing is saved."} This shows what the repertory lists. It is not
        evidence that a remedy works and it is not a prescription.
      </p>
      <div className="tabs sub" role="tablist" aria-label="How to choose rubrics">
        <button type="button" role="tab" aria-selected={mode === "browse"} onClick={() => setMode("browse")}>
          Browse
        </button>
        <button type="button" role="tab" aria-selected={mode === "find"} onClick={() => setMode("find")}>
          Find by words
        </button>
      </div>
      {mode === "browse" ? (
        <RubricBrowser data={rep} tree={tree} at={browseAt} goTo={goTo} ids={ids} full={full} add={add} />
      ) : (
        <>
        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(draft.trim());
          }}
        >
          <label htmlFor="rubric-q" className="visually-hidden">
            Find a rubric
          </label>
          <input
            id="rubric-q"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Find a rubric, e.g. anxiety night, or restless* (a * matches word endings)"
          />
          <button type="submit">Find</button>
        </form>

        {query && (
          <div className="rubric-results">
            {found && found.length === 0 && <p className="muted">No rubric contains all of those words.</p>}
            <ul className="rubric-list">
              {found?.map((r) => {
                const inCase = ids.includes(r.id);
                return (
                  <li key={r.id}>
                    <div className="rubric-row">
                      <button type="button" className="link" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                        {r.path}
                      </button>
                      <span className="muted count">{r.remedyCount}</span>
                      <button type="button" className="secondary small-btn" onClick={() => (goTo(tree.byPath.get(r.path) ?? null), setMode("browse"))}>
                        In tree
                      </button>
                      <button type="button" className={`collect${inCase ? " on" : ""}`} disabled={inCase || full} onClick={() => add(r)}>
                        {inCase ? "Added ✓" : "Add"}
                      </button>
                    </div>
                    {open === r.id && <RubricRemedies data={rep} id={r.id} />}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        </>
      )}

      <h2 className="case-head">
        Case <span className="muted">· {caseRubrics.length} rubric{caseRubrics.length === 1 ? "" : "s"}</span>
        {caseRubrics.length > 0 && (
          <button type="button" className="secondary" onClick={() => setRubrics([])}>
            Clear case
          </button>
        )}
      </h2>
      {full && <p className="muted">A case can hold {MAX_CASE_RUBRICS} rubrics. Remove one to add another.</p>}
      {caseRubrics.length === 0 ? (
        <p className="muted">No rubrics yet. Find one above and press Add.</p>
      ) : (
        <>
          <div className="controls">
            <label htmlFor="method">Rank by</label>
            <select id="method" value={method} onChange={(e) => setMethod(e.target.value as RankMethod)}>
              <option value="symptoms">Rubrics covered, then grades</option>
              <option value="grades">Total grade, then rubrics covered</option>
            </select>
            <span className="muted">
              {ranked.length} remed{ranked.length === 1 ? "y" : "ies"}
              {ranked.length > shown.length ? `, top ${shown.length} shown` : ""}
            </span>
          </div>
          <div className="rep-wrap">
            <table className="rep grid">
              <thead>
                <tr>
                  <th className="rep-rubric">Rubric</th>
                  {shown.map((m) => (
                    <th key={m.index} className="rem" title={m.name}>
                      <span>{m.abbrev}</span>
                    </th>
                  ))}
                </tr>
                <tr className="totals">
                  <th className="rep-rubric muted">Rubrics covered / total grade</th>
                  {shown.map((m) => (
                    <th key={m.index}>
                      <b>{m.covered}</b>
                      {m.total}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {caseRubrics.map((r, row) => (
                  <tr key={r.id}>
                    <th className="rep-rubric" scope="row">
                      <button type="button" className="remove" aria-label={`Remove ${r.path}`} onClick={() => remove(r.id)}>
                        ×
                      </button>
                      {r.path}
                      <small>{r.remedyCount}</small>
                    </th>
                    {shown.map((m) => (
                      <td key={m.index} className="rep-cell">
                        {m.grades[row] > 0 && <span className={`dot g${m.grades[row]}`} title={`${m.name}: ${GRADE_LABEL[m.grades[row]]}`} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Larger dots are higher grades. Columns are remedies, ranked left to right. Hover a dot or remedy for its full
            name. Use the Book passages tab or Search to read what the books say about a remedy.
          </p>
        </>
      )}
    </>
  );
}

function RubricBrowser({
  data,
  tree,
  at,
  goTo,
  ids,
  full,
  add,
}: {
  data: RepertoryFile;
  tree: RubricTree;
  at: number | null;
  goTo: (n: number | null) => void;
  ids: number[];
  full: boolean;
  add: (r: Rubric) => void;
}) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    setFilter("");
    setOpen(null);
  }, [at]);
  const node = at === null ? null : tree.nodes[at];
  const list = useMemo(() => filterChildren(tree, at, filter), [tree, at, filter]);

  const addButton = (id: number) => {
    const inCase = ids.includes(id);
    return (
      <button type="button" className={`collect${inCase ? " on" : ""}`} disabled={inCase || full} onClick={() => add(toRubric(data, id))}>
        {inCase ? "Added ✓" : "Add"}
      </button>
    );
  };

  if (node === null) {
    return (
      <>
        <p className="muted small">Pick the body area or section the symptom belongs to.</p>
        <ul className="chapters">
          {tree.roots.map((n) => (
            <li key={n}>
              <button type="button" onClick={() => goTo(n)}>
                {tree.nodes[n].label}
                <small>{tree.nodes[n].children.length}</small>
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="browse">
      <nav className="crumbs" aria-label="Rubric path">
        <button type="button" className="link" onClick={() => goTo(null)}>
          All sections
        </button>
        {ancestry(tree, at!).map((n) => (
          <span key={n}>
            {" › "}
            {n === at ? (
              <b>{tree.nodes[n].label}</b>
            ) : (
              <button type="button" className="link" onClick={() => goTo(n)}>
                {tree.nodes[n].label}
              </button>
            )}
          </span>
        ))}
      </nav>
      {node.id !== null && (
        <div className="rubric-row here">
          <button type="button" className="link" aria-expanded={open === -1} onClick={() => setOpen(open === -1 ? null : -1)}>
            {node.path} <span className="muted">· {node.remedyCount} remed{node.remedyCount === 1 ? "y" : "ies"}</span>
          </button>
          {addButton(node.id)}
        </div>
      )}
      {node.id !== null && open === -1 && <RubricRemedies data={data} id={node.id} />}
      {node.children.length > 0 && (
        <>
          <label htmlFor="browse-filter" className="visually-hidden">
            Narrow this list
          </label>
          <input
            id="browse-filter"
            className="browse-filter"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Narrow these ${node.children.length} options, e.g. burn, puls, night`}
          />
          {list.length === 0 && <p className="muted">Nothing here starts with those words.</p>}
          <ul className="rubric-list">
            {list.map((c) => {
              const child = tree.nodes[c];
              return (
                <li key={c}>
                  <div className="rubric-row">
                    {child.children.length > 0 ? (
                      <button type="button" className="link" onClick={() => goTo(c)}>
                        {child.label} <span className="more">{child.children.length} ›</span>
                      </button>
                    ) : (
                      <button type="button" className="link" aria-expanded={open === c} onClick={() => setOpen(open === c ? null : c)}>
                        {child.label}
                      </button>
                    )}
                    {child.id !== null && <span className="muted count">{child.remedyCount}</span>}
                    {child.id !== null && addButton(child.id)}
                  </div>
                  {open === c && child.id !== null && <RubricRemedies data={data} id={child.id} />}
                </li>
              );
            })}
          </ul>
          <p className="muted small">
            A number with › opens more detailed options. The other number is how many remedies the rubric lists. Tap a rubric
            without › to see its remedies.
          </p>
        </>
      )}
    </div>
  );
}

function BookSymptoms() {
  const sources = useFetch<{ sources: Source[] }>("/api/sources");
  const all = sources.data?.sources ?? [];
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<Set<string> | null>(null); // null = every book
  const [state, setState] = useState<{ data?: SymptomResponse; error?: string; loading: boolean }>({ loading: false });
  const picked = chosen ?? new Set(all.map((s) => s.id));
  const titles = new Map(all.map((s) => [s.id, s.title]));

  const toggleSource = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const symptoms = text.split("\n").filter((l) => l.trim());
    if (!symptoms.length || !picked.size) return;
    setState({ loading: true });
    post<SymptomResponse>("/api/symptoms", { symptoms, sources: chosen ? [...picked] : [] })
      .then((data) => setState({ data, loading: false }))
      .catch((err: Error) => setState({ error: err.message, loading: false }));
  };
  const data = state.data;

  return (
    <>
      <p className="muted">
        Type one symptom per line. Each line is searched like the Search page, and matching passages are grouped under the
        remedy heading they appear in. Remedies are listed by how many of your symptoms their passages mention. This shows
        what the books say. It is not evidence that a remedy works and it is not a prescription.
      </p>
      <form className="symptoms" onSubmit={submit}>
        <label htmlFor="symptoms" className="visually-hidden">
          Symptoms, one per line
        </label>
        <textarea
          id="symptoms"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"burning pain\nworse at night\nthirst for small sips\nrestless"}
        />
        <fieldset className="books">
          <legend>Books to search</legend>
          {all.map((s) => (
            <label key={s.id}>
              <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggleSource(s.id)} /> {s.title}
            </label>
          ))}
          {all.length > 1 && (
            <button type="button" className="secondary" onClick={() => setChosen(picked.size === all.length ? new Set() : null)}>
              {picked.size === all.length ? "Select none" : "Select all"}
            </button>
          )}
        </fieldset>
        <button type="submit" disabled={!text.trim() || !picked.size || state.loading}>
          Find remedies
        </button>
      </form>

      <Status loading={state.loading} error={state.error} />
      {data && (
        <>
          {data.skipped.length > 0 && <p className="muted">Skipped (no searchable words): {data.skipped.join(", ")}</p>}
          <p className="muted">
            {data.total === 0
              ? "No remedy passages mention any of those symptoms. Try other words, or a prefix such as rheumat*."
              : `${data.total} remed${data.total === 1 ? "y" : "ies"} mention at least one symptom${data.total > data.remedies.length ? `. Showing the top ${data.remedies.length}` : ""}.`}
          </p>
          {data.remedies.length > 0 && (
            <div className="rep-wrap">
              <table className="rep">
                <thead>
                  <tr>
                    <th className="rep-remedy">Remedy</th>
                    <th className="rep-score" title="Symptoms mentioned">Covers</th>
                    {data.symptoms.map((s, i) => (
                      <th key={i} className="rep-sym">
                        <span>{s}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.remedies.map((r) => (
                    <tr key={r.remedy} className={r.covered === data.symptoms.length ? "all" : undefined}>
                      <th className="rep-remedy" scope="row">
                        {r.remedy}
                        <small>{r.sources.map((id) => titles.get(id) ?? id).join(" · ")}</small>
                      </th>
                      <td className="rep-score">
                        {r.covered}/{data.symptoms.length}
                      </td>
                      {r.cells.map((c, i) => (
                        <td key={i} className="rep-cell">
                          {c.hits > 0 && c.passageId !== null ? (
                            <a
                              href={`#/passage/${c.passageId}?q=${encodeURIComponent(data.symptoms[i])}`}
                              title={`${c.hits} passage${c.hits === 1 ? "" : "s"} mention "${data.symptoms[i]}". Open the first.`}
                            >
                              <span className={`hits h${Math.min(c.hits, 4)}`}>{c.hits}</span>
                            </a>
                          ) : (
                            <span className="none" aria-label="not mentioned">·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small">
            Numbers are how many passages under that remedy heading contain the symptom's words. Click a number to read the
            first one. Grouping relies on the book's headings, so a heading that is not a remedy name can appear here.
          </p>
        </>
      )}
    </>
  );
}

// ---------- collect tray ----------

function CollectedPage() {
  const { items, remove, clear } = useCollected();
  const [copied, setCopied] = useState("");
  const [confirming, setConfirming] = useState(false);
  const copy = () =>
    navigator.clipboard
      .writeText(formatReferences(items))
      .then(() => setCopied("References copied."))
      .catch(() => setCopied("Copying is blocked in this browser. Select the references below instead."));

  return (
    <section>
      <h1>Collected passages</h1>
      <p className="muted">
        Passages you pin with Collect while researching. They are saved only in this browser on this device and are never
        sent to the server. Do not use this tray for anything about a patient.
      </p>
      {items.length === 0 ? (
        <p className="muted">Nothing collected yet. Use Collect on a search result or a passage to pin it here.</p>
      ) : (
        <>
          <div className="tray-actions">
            <button type="button" onClick={copy}>
              Copy references
            </button>
            {confirming ? (
              <>
                <span className="muted">Remove all {items.length}?</span>
                <button type="button" className="secondary" onClick={() => {
                    clear();
                    setConfirming(false);
                  }}>
                  Yes, clear
                </button>
                <button type="button" className="secondary" onClick={() => setConfirming(false)}>
                  Keep
                </button>
              </>
            ) : (
              <button type="button" className="secondary" onClick={() => setConfirming(true)}>
                Clear all
              </button>
            )}
            {copied && <span className="muted" role="status">{copied}</span>}
          </div>
          {groupBySource(items).map((g) => (
            <div key={g.sourceId} className="tray-group">
              <h2>
                <a href={`#/sources/${g.sourceId}`}>{g.items[0].title}</a>
                <span className="source-line"> · {citation({ ...g.items[0], publication_year: g.items[0].publicationYear })}</span>
              </h2>
              <ol className="results">
                {g.items.map((i) => (
                  <li key={i.passageId} className="result">
                    <button type="button" className="collect on" onClick={() => remove(i.passageId)}>
                      Remove
                    </button>
                    <a href={`#/passage/${i.passageId}`}>
                      <div className="ref">
                        <strong>{i.heading ?? "Untitled section"}</strong>
                        <span>{i.location}</span>
                      </div>
                      <p className="snippet">{i.excerpt}</p>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <details className="tray-refs">
            <summary>References as text</summary>
            <pre>{formatReferences(items)}</pre>
          </details>
        </>
      )}
    </section>
  );
}

// ---------- sources ----------

function SourcesPage() {
  const { data, loading, error } = useFetch<{ sources: Source[] }>("/api/sources");
  if (!data) return <Status loading={loading} error={error} />;
  if (!data.sources.length) return <p className="muted">No sources imported yet. See README.md for how to import a book.</p>;
  return (
    <section>
      <h1>Sources</h1>
      <ul className="sources">
        {data.sources.map((s) => (
          <li key={s.id}>
            <a href={`#/sources/${s.id}`}>
              <strong>{s.title}</strong>
              <span>{citation(s)}</span>
              <span className="muted">
                {s.passage_count} passages · import {s.import_status ?? "unknown"}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourcePage({ id }: { id: string }) {
  const { data, loading, error } = useFetch<SourceDetail>(`/api/sources/${id}`);
  if (!data) return <Status loading={loading} error={error} />;
  const { source: s, imports, issues } = data;
  const rows: [string, ReactNode][] = [
    ["Title", s.title],
    ["Author", s.author],
    ["Editor", s.editor],
    ["Edition", s.edition],
    ["Publication year", s.publication_year],
    ["Publisher", s.publisher],
    ["Language", s.language],
    [
      "Source URL",
      <a href={s.source_url} target="_blank" rel="noopener noreferrer">
        {s.source_url}
      </a>,
    ],
    ["Attribution", s.attribution],
    ["Reuse terms", s.reuse_terms],
    ["Notes", s.notes],
    [
      "Original file",
      <a href={`/api/sources/${s.id}/original`} target="_blank" rel="noopener">
        {s.original_filename}
      </a>,
    ],
    ["File size", `${(s.byte_length / 1024).toFixed(0)} KB`],
    ["SHA-256", <code className="hash">{s.sha256}</code>],
    ["Passages", s.passage_count],
  ];
  return (
    <section>
      <p>
        <a href="#/sources">← All sources</a>
      </p>
      <h1>{s.title}</h1>
      <dl className="meta">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v ?? <span className="muted">Not recorded</span>}</dd>
          </div>
        ))}
      </dl>
      <h2>Import</h2>
      {imports.map((i) => (
        <p key={i.id}>
          <span className={`badge ${i.status}`}>{i.status}</span> {i.processed_passages}/{i.total_passages ?? "?"} passages · updated{" "}
          {i.updated_at} UTC
          {i.error && <span className="error"> {i.error}</span>}
        </p>
      ))}
      {issues.length > 0 && (
        <>
          <h2>Import notes and problems</h2>
          <ul className="issues">
            {issues.map((i, n) => (
              <li key={n}>
                <span className={`badge ${i.severity}`}>{i.severity}</span> {i.detail}
                {i.location && <span className="muted"> ({i.location})</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
