import { useState, type FormEvent } from "react";
import { go, useFetch, type AppConfig } from "./App";
import type { ClientSummary, Source } from "./api";

// The home page: carry on with a client, search the books, or jump to a part of the app.
// How it all works lives on the About page.

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function HomePage({ config, collected }: { config?: AppConfig; collected: number }) {
  const sources = useFetch<{ sources: Source[] }>("/api/sources");
  const clients = useFetch<{ clients: ClientSummary[] }>(config?.clients ? "/api/clients" : null);
  const [q, setQ] = useState("");
  const all = sources.data?.sources;
  const books = all?.filter((s) => s.kind !== "notes").length;
  const notes = all?.filter((s) => s.kind === "notes").length;
  const recent = [...(clients.data?.clients ?? [])].sort((a, b) => (b.last_visit ?? "").localeCompare(a.last_visit ?? "")).slice(0, 6);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) go("/search", { q: q.trim() });
  };

  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">{greeting()}</p>
        <form className="search hero-search" role="search" onSubmit={submit}>
          <label htmlFor="home-q" className="visually-hidden">
            Search the materia medica
          </label>
          <input id="home-q" type="search" placeholder="Search the materia medica: a symptom, a remedy…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" disabled={!q.trim()}>
            Search
          </button>
        </form>
      </div>

      <div className="home-grid">
        {config?.clients && (
          <div className="panel">
            <div className="panel-head">
              <h2>Recent clients</h2>
              <a className="button-link" href="#/clients">
                + New client
              </a>
            </div>
            {clients.loading && <p className="muted">Loading…</p>}
            {clients.error && <p className="error">{clients.error}</p>}
            {clients.data && recent.length === 0 && <p className="muted">No clients yet. Add one to start an intake.</p>}
            {recent.length > 0 && (
              <ul className="home-list">
                {recent.map((c) => (
                  <li key={c.id}>
                    <a href={`#/clients/${c.id}`}>{c.name}</a>
                    {c.last_visit_id && c.last_visit ? (
                      <a className="quiet" href={`#/visits/${c.last_visit_id}`}>
                        {shortDate(c.last_visit)} · carry on →
                      </a>
                    ) : (
                      <span className="muted">No visits yet</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {(clients.data?.clients.length ?? 0) > recent.length && (
              <a href="#/clients" className="small">
                All {clients.data!.clients.length} clients →
              </a>
            )}
          </div>
        )}
        <div className="panel">
          <h2>Jump to</h2>
          <ul className="home-list">
            <li>
              <a href="#/symptoms">Repertory</a>
              <span className="muted">Rubrics and remedies</span>
            </li>
            <li>
              <a href="#/search">Materia medica</a>
              <span className="muted">Search the books</span>
            </li>
            <li>
              <a href="#/sources">Library</a>
              <span className="muted">{all ? `${books} book${books === 1 ? "" : "s"}, ${notes} note${notes === 1 ? "" : "s"}` : "Books and notes"}</span>
            </li>
            <li>
              <a href="#/collected">Saved passages</a>
              <span className="muted">{collected || "None yet"}</span>
            </li>
          </ul>
          <a href="#/about" className="small">
            How this works →
          </a>
        </div>
      </div>
    </section>
  );
}

/** How a case comes together, where things come from, and what is kept where. */
export function AboutPage() {
  return (
    <section className="about">
      <h1>About this library</h1>
      <div className="steps">
        <h2>How a case comes together</h2>
        <ol>
          <li>
            <strong>Case.</strong> Open the client and start a visit. Fill in the intake as you talk: complaints, generals, mind and emotions.
          </li>
          <li>
            <strong>Rubrics.</strong> The visit suggests rubrics from what you ticked and wrote. Add the ones that fit, or browse the repertory for more.
          </li>
          <li>
            <strong>Remedy.</strong> See which remedies cover the most rubrics, read about them in the books, and record the one you choose.
          </li>
        </ol>
      </div>
      <h2>Where things come from</h2>
      <p>
        Rubrics come from the Repertorium Publicum, a free repertory. Remedies are ranked by how many of the chosen rubrics list
        them, then by their grades (1 to 3). Books and notes are searched word for word: every word must appear in the passage,
        and a word ending in * matches its endings, so <code>rheumat*</code> finds rheumatic and rheumatism.
      </p>
      <h2>What is kept where</h2>
      <ul>
        <li>Clients and visits are stored encrypted, and only the accounts allowed to see client records can open them.</li>
        <li>Suggested rubrics are worked out in your browser. Nothing from a visit is sent anywhere else.</li>
        <li>The Repertory page and Saved passages keep nothing on the server. Saved passages stay in this browser only, so don't use them for anything about a client.</li>
      </ul>
      <h2>Please note</h2>
      <p>
        This library reproduces historical and traditional texts. Passages report what their authors claimed. The repertory
        shows what it lists. None of it is evidence that a treatment works, and none of it is a prescription or medical advice.
      </p>
    </section>
  );
}

/** The leaf mark beside the app's name. */
export const Logo = () => (
  <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="currentColor" opacity="0.14" />
    <path d="M9 23c0-8 5-13 14-14-1 9-6 14-14 14Z" fill="currentColor" />
    <path d="M9 23c3-4 6-7 10-9" stroke="var(--header)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </svg>
);
