import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { reflow } from "../shared/text";
import { ImportPage } from "./ImportPage";
import { get, type PassageRef, type PassageResponse, type SearchResponse, type Source, type SourceDetail } from "./api";

// ---------- tiny hash router: #/search?q=..  #/passage/12  #/sources  #/sources/id ----------

function useRoute() {
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

const go = (path: string, params?: Record<string, string>) => {
  const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString() : "";
  window.location.hash = qs ? `${path}?${qs}` : path;
};

function useFetch<T>(path: string | null) {
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

export function App() {
  const { path, params } = useRoute();
  const config = useFetch<{ environment: string; allowImports: boolean }>("/api/config");
  let page: ReactNode;
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/passage\/(\d+)$/))) page = <PassagePage id={m[1]} q={params.get("q") ?? ""} />;
  else if ((m = path.match(/^\/sources\/([\w-]+)$/))) page = <SourcePage id={m[1]} />;
  else if (path === "/sources") page = <SourcesPage />;
  else if (path === "/import") page = <ImportPage />;
  else page = <SearchPage params={params} />;

  return (
    <>
      <header className="top">
        <a className="brand" href="#/search">
          Homeopathy Library
        </a>
        <nav>
          <a href="#/search">Search</a>
          <a href="#/sources">Sources</a>
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

function Status({ loading, error }: { loading: boolean; error?: string }) {
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
              <li key={r.id}>
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
