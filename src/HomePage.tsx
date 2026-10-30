import { useState, type FormEvent, type ReactNode } from "react";
import { go, useFetch, type AppConfig } from "./App";
import type { Source } from "./api";

// The welcome page: a short greeting, a quick search, and a card for each part of the app.

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function HomePage({ config, collected }: { config?: AppConfig; collected: number }) {
  const sources = useFetch<{ sources: Source[] }>("/api/sources");
  const [q, setQ] = useState("");
  const books = sources.data?.sources.length;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) go("/search", { q: q.trim() });
  };

  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">{greeting()}</p>
        <h1>Your homeopathy library, repertory and case notes, in one place.</h1>
        <form className="search hero-search" role="search" onSubmit={submit}>
          <label htmlFor="home-q" className="visually-hidden">
            Search the books
          </label>
          <input id="home-q" type="search" placeholder="Search the books: a symptom, a remedy, a condition…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" disabled={!q.trim()}>
            Search
          </button>
        </form>
      </div>

      <div className="cards">
        {config?.clients && (
          <Card href="#/clients" icon={<IconPerson />} title="Clients" action="Open clients">
            Start a full intake or a follow-up, then build rubrics from the case.
          </Card>
        )}
        <Card href="#/symptoms" icon={<IconTree />} title="Repertory" action="Build a case">
          Find rubrics for each symptom, step by step or by words, and see which remedies cover them all.
        </Card>
        <Card href="#/search" icon={<IconSearch />} title="Search the books" action="Search">
          Look up what the materia medica says about a symptom or a remedy, with page references.
        </Card>
        <Card href="#/sources" icon={<IconBook />} title="Library" action="Browse books" stat={books === undefined ? undefined : `${books} book${books === 1 ? "" : "s"}`}>
          Every book in the library, with its edition and where it came from.
        </Card>
        <Card href="#/collected" icon={<IconPin />} title="Collected" action="Open" stat={collected ? `${collected} pinned` : undefined}>
          Passages you have pinned while reading, ready to copy with their references.
        </Card>
      </div>

      <div className="steps">
        <h2>How a case comes together</h2>
        <ol>
          <li>
            <strong>Take the case.</strong> Fill in the intake as you talk: complaints, generals, mind and emotions.
          </li>
          <li>
            <strong>Choose rubrics.</strong> Turn the strongest symptoms into repertory rubrics and add them to the case.
          </li>
          <li>
            <strong>Compare remedies.</strong> See which remedies cover the most rubrics, then read about them in the books.
          </li>
        </ol>
      </div>
    </section>
  );
}

function Card({ href, icon, title, action, stat, children }: { href: string; icon: ReactNode; title: string; action: string; stat?: string; children: ReactNode }) {
  return (
    <a className="card" href={href}>
      <span className="card-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="card-title">
        {title}
        {stat && <span className="card-stat">{stat}</span>}
      </span>
      <span className="card-text">{children}</span>
      <span className="card-action">{action} →</span>
    </a>
  );
}

const svg = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);
const IconPerson = () => svg(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" /></>);
const IconTree = () => svg(<><path d="M6 4v16" /><path d="M6 8h6v4h6" /><path d="M12 12v6h6" /><circle cx="18" cy="12" r="1.5" /><circle cx="18" cy="18" r="1.5" /></>);
const IconSearch = () => svg(<><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></>);
const IconBook = () => svg(<><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5Z" /><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5Z" /></>);
const IconPin = () => svg(<><path d="M9 4h6l-1 5 3 3H7l3-3Z" /><path d="M12 12v8" /></>);

/** The leaf mark beside the app's name. */
export const Logo = () => (
  <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="currentColor" opacity="0.14" />
    <path d="M9 23c0-8 5-13 14-14-1 9-6 14-14 14Z" fill="currentColor" />
    <path d="M9 23c3-4 6-7 10-9" stroke="var(--header)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </svg>
);
