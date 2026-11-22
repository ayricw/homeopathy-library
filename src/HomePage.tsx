import { useState, type FormEvent, type ReactNode } from "react";
import { Atom, Bookmark, BookOpen, CalendarPlus, ChevronRight, GitCompare, Info, Library, ListTree, Search, Sparkles, UserPlus, Users } from "lucide-react";
import { Avatar } from "./ui";
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
  const tools: { href: string; icon: ReactNode; title: string; text: string; tone: string }[] = [
    ...(config?.clients ? [{ href: "#/clients", icon: <CalendarPlus />, title: "Start a visit", text: "Intake, rubrics, remedy", tone: "t1" }] : []),
    { href: "#/symptoms?tab=repertory", icon: <ListTree />, title: "Repertory", text: "Build a case from rubrics", tone: "t2" },
    { href: "#/search", icon: <BookOpen />, title: "Materia medica", text: all ? `${books} books, ${notes} notes` : "Search the books", tone: "t3" },
    { href: "#/symptoms?tab=remedies", icon: <Sparkles />, title: "Remedies", text: "Every rubric, every book", tone: "t4" },
    { href: "#/compare", icon: <GitCompare />, title: "Compare", text: "Remedies side by side", tone: "t5" },
    { href: "#/symptoms?tab=families", icon: <Atom />, title: "Families", text: "Periodic table, plants, animals", tone: "t6" },
    { href: "#/sources", icon: <Library />, title: "Library", text: "Books and your notes", tone: "t3" },
    { href: "#/collected", icon: <Bookmark />, title: "Saved", text: collected ? `${collected} passage${collected === 1 ? "" : "s"}, and your notes` : "Passages and your notes", tone: "t2" },
  ];

  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">{greeting()}</p>
        <h1>What are you working on today?</h1>
        <form className="search hero-search" role="search" onSubmit={submit}>
          <label htmlFor="home-q" className="visually-hidden">
            Search the materia medica
          </label>
          <span className="search-field">
            <Search size={20} className="field-icon" aria-hidden="true" />
            <input id="home-q" type="search" placeholder="Search the materia medica: a symptom, a remedy…" value={q} onChange={(e) => setQ(e.target.value)} />
          </span>
          <button type="submit" disabled={!q.trim()}>
            Search
          </button>
        </form>
      </div>

      <div className="tile-grid">
        {tools.map((t) => (
          <a key={t.title} className={`tile ${t.tone}`} href={t.href}>
            <span className="tile-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="tile-text">
              <b>{t.title}</b>
              <span>{t.text}</span>
            </span>
          </a>
        ))}
      </div>

      {config?.clients && (
        <div className="panel">
          <div className="panel-head">
            <h2>
              <Users size={20} aria-hidden="true" /> Recent clients
            </h2>
            <a className="button-link" href="#/clients">
              <UserPlus size={16} aria-hidden="true" /> New client
            </a>
          </div>
          {clients.loading && <p className="muted">Loading…</p>}
          {clients.error && <p className="error">{clients.error}</p>}
          {clients.data && recent.length === 0 && <p className="muted">No clients yet. Add one to start an intake.</p>}
          {recent.length > 0 && (
            <ul className="client-cards compact">
              {recent.map((c) => (
                <li key={c.id}>
                  <a href={c.last_visit_id ? `#/visits/${c.last_visit_id}` : `#/clients/${c.id}`}>
                    <Avatar name={c.name} />
                    <span className="cc-text">
                      <b>{c.name}</b>
                      <span className="muted small">{c.last_visit ? `Last visit ${shortDate(c.last_visit)} · carry on` : "No visits yet"}</span>
                    </span>
                    <ChevronRight size={18} className="muted" aria-hidden="true" />
                  </a>
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
      <p className="home-foot">
        <a href="#/about">
          <Info size={15} aria-hidden="true" /> How this works
        </a>
      </p>
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
            <strong>Remedy.</strong> See which remedies cover the most rubrics, compare them side by side, read about them in the books, and record the remedy, potency and how it was given. At the next visit, record how the client responded.
          </li>
        </ol>
      </div>
      <h2>Where things come from</h2>
      <p>
        Rubrics come from the Repertorium Publicum, a free repertory. Remedies are ranked by a Power score from 0 to 100:
        each rubric is worth more when it lists few remedies, when it is a mind (1.5x) or general (1.3x) symptom, and when you
        star it as a key symptom (2x); a remedy earns that worth times its grade out of 3. You can also rank by rubrics
        covered or by total grade. Books and notes are searched word for word: every word must appear in the passage,
        and a word ending in * matches its endings, so <code>rheumat*</code> finds rheumatic and rheumatism.
      </p>
      <h2>What is kept where</h2>
      <ul>
        <li>Clients and visits are stored encrypted, and only the accounts allowed to see client records can open them.</li>
        <li>Suggested rubrics are worked out in your browser. Nothing from a visit is sent anywhere else.</li>
        <li>Everyday-word rubric search uses a built-in word list in your browser, not AI. Nothing you type is sent anywhere.</li>
        <li>Your own repertory additions and margin notes in the books are kept in the library for you. They are about remedies and books, so don't put anything about a client in them.</li>
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
