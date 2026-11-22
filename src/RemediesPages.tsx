import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, ChevronRight, GitCompare, Search, Star, X } from "lucide-react";
import { ANIMAL_GROUPS, ELEMENTS, groupOf, NOSODE_GROUPS, OTHER_GROUPS, PLANT_FAMILIES, type Kingdom } from "../shared/families";
import { buildRemedyIndex, chapterCounts, compareRemedies, findRemedy, remedyRubrics, searchRemedies, type RemedyIndex } from "../shared/remedies";
import type { RepertoryFile } from "../shared/repertory";
import { go, readAbout, remedySearch, Status, useFetch, useRepertory, type LoadedRepertory } from "./App";
import { removeAddition, useBookStore } from "./books";
import { KingdomIcon, Grade, EmptyState } from "./ui";

// Remedy-centred pages: one remedy (what the books say, every rubric it is in), comparing a few
// remedies side by side, and remedies by family (periodic table, plant families, animal groups).
// All of it is worked out in the browser from the repertory file, apart from the books' passages.

let remedyIndex: RemedyIndex | null = null;
export const getRemedyIndex = (data: RepertoryFile) => {
  if (remedyIndex?.data !== data) remedyIndex = buildRemedyIndex(data);
  return remedyIndex;
};

export const remedyHref = (abbrev: string) => `#/remedy/${encodeURIComponent(abbrev)}`;

/** A remedy's name as a link to its page. */
export function RemedyLink({ abbrev, name, children }: { abbrev: string; name: string; children?: ReactNode }) {
  return (
    <a className="remedy-link" href={remedyHref(abbrev)} title={`${name}: every rubric, and what the books say`}>
      {children ?? name}
    </a>
  );
}

function WithRepertory({ children }: { children: (rep: LoadedRepertory) => ReactNode }) {
  const rep = useRepertory();
  if (rep.error) return <p className="error">The repertory could not be loaded: {rep.error}</p>;
  if (rep.rep === undefined) return <p className="muted">Loading the repertory…</p>;
  if (rep.rep === null) return <p className="muted">No repertory is included in this deployment yet.</p>;
  return <>{children(rep.rep)}</>;
}

interface RemedyPassages {
  sources: {
    source_id: string;
    title: string;
    author: string;
    kind: string;
    passages: number;
    first: { id: number; section: string | null; chapter: string | null; page_start: string | null; text: string } | null;
  }[];
}

// ---------- one remedy ----------

export function RemedyPage({ abbrev }: { abbrev: string }) {
  return <section className="wide">{<WithRepertory>{(rep) => <RemedyView rep={rep} abbrev={abbrev} />}</WithRepertory>}</section>;
}

type GradeFilter = 1 | 2 | 3;

function RemedyView({ rep, abbrev }: { rep: LoadedRepertory; abbrev: string }) {
  const data = rep.data;
  const remedy = findRemedy(data, abbrev);
  const books = useFetch<RemedyPassages>(remedy === null ? null : `/api/remedy-passages?q=${encodeURIComponent(remedySearch(data.remedies[remedy][1], data))}`);
  const [minGrade, setMinGrade] = useState<GradeFilter>(1);
  const [chapter, setChapter] = useState<string | null>(null);
  const [words, setWords] = useState("");
  const [shown, setShown] = useState(150);
  const all = useMemo(() => (remedy === null ? [] : remedyRubrics(getRemedyIndex(data), remedy)), [data, remedy]);
  if (remedy === null) {
    return <EmptyState icon={<Search />} title="Remedy not found" text="The repertory has no remedy by that name." action={<a href="#/symptoms?tab=remedies">Find a remedy</a>} />;
  }
  const [ab, name] = data.remedies[remedy];
  const group = groupOf(ab, name);
  const graded = all.filter((r) => r.grade >= minGrade);
  const chapters = chapterCounts(graded);
  const want = words.trim().toLowerCase();
  const list = graded.filter((r) => (!chapter || r.chapter === chapter) && (!want || r.path.toLowerCase().includes(want)));
  const mine = (id: number) => rep.mine.get(id)?.get(remedy);
  const top = all.filter((r) => r.grade === 3).length;

  return (
    <>
      <p className="crumbs">
        <a href="#/symptoms?tab=remedies">
          <ArrowLeft size={15} /> Remedies
        </a>
      </p>
      <header className="remedy-hero">
        <span className={`kingdom-badge k-${group.kingdom.toLowerCase()}`}>
          <KingdomIcon kingdom={group.kingdom} size={26} />
        </span>
        <div>
          <h1>{name}</h1>
          <p className="remedy-meta">
            <span className="abbrev">{ab}</span>
            <a className="chip" href={`#/symptoms?tab=families&family=${encodeURIComponent(group.family)}`}>
              {group.kingdom} · {group.family}
            </a>
            {group.elements.map((s) => (
              <a key={s} className="chip element-chip" href={`#/symptoms?tab=families&element=${s}`}>
                {s}
              </a>
            ))}
          </p>
        </div>
        <div className="hero-actions">
          <a className="button-link" href={readAbout(name, data)}>
            <BookOpen size={16} /> Read about it
          </a>
          <a className="button-link secondary" href={`#/compare?r=${encodeURIComponent(ab)}`}>
            <GitCompare size={16} /> Compare
          </a>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat">
          <b>{all.length.toLocaleString()}</b>
          <span>rubrics</span>
        </div>
        <div className="stat">
          <b>{top.toLocaleString()}</b>
          <span>in the highest grade</span>
        </div>
        <div className="stat">
          <b>{chapterCounts(all).length}</b>
          <span>chapters</span>
        </div>
        <div className="stat">
          <b>{books.data ? books.data.sources.length : "…"}</b>
          <span>books and notes</span>
        </div>
      </div>

      <h2 className="section-title">
        <BookOpen size={20} /> In the books
      </h2>
      <Status loading={books.loading} error={books.error} />
      {books.data && books.data.sources.length === 0 && <p className="muted">No book in the library has a section headed with this remedy's name.</p>}
      {books.data && books.data.sources.length > 0 && (
        <div className="book-cards">
          {books.data.sources.map((s) => (
            <article key={s.source_id} className="book-card">
              <header>
                <b>{s.title}</b>
                <span className="muted small">
                  {s.kind === "notes" ? "Notes" : s.author} · {s.passages} passage{s.passages === 1 ? "" : "s"}
                </span>
              </header>
              {s.first && <p className="book-excerpt">{s.first.text.replace(/\s+/g, " ").slice(0, 320)}…</p>}
              <footer>
                {s.first && <a href={`#/passage/${s.first.id}`}>Open the passage</a>}
                <a href={`#/search?q=${encodeURIComponent(remedySearch(name, data))}&source=${encodeURIComponent(s.source_id)}`}>All mentions</a>
              </footer>
            </article>
          ))}
        </div>
      )}

      <h2 className="section-title">
        <Search size={20} /> Every rubric it is in
      </h2>
      <p className="muted small">The reverse repertory: highest grades first, then the smallest rubrics, which say most about the remedy.</p>
      <div className="filter-bar">
        <div className="segmented" role="group" aria-label="Grade">
          {([1, 2, 3] as GradeFilter[]).map((g) => (
            <button key={g} type="button" aria-pressed={minGrade === g} onClick={() => (setMinGrade(g), setShown(150))}>
              {g === 1 ? "All grades" : g === 2 ? "Grade 2 and 3" : "Grade 3 only"}
            </button>
          ))}
        </div>
        <input type="search" className="filter-input" placeholder="Narrow by words, e.g. fear, night" value={words} onChange={(e) => (setWords(e.target.value), setShown(150))} aria-label="Narrow by words" />
      </div>
      <div className="chip-row" role="group" aria-label="Chapter">
        <button type="button" className="chip" aria-pressed={chapter === null} onClick={() => setChapter(null)}>
          All chapters <small>{graded.length}</small>
        </button>
        {chapters.map((c) => (
          <button key={c.chapter} type="button" className="chip" aria-pressed={chapter === c.chapter} onClick={() => (setChapter(c.chapter), setShown(150))}>
            {c.chapter} <small>{c.count}</small>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="muted">No rubric matches.</p>
      ) : (
        <ul className="reverse-list">
          {list.slice(0, shown).map((r) => {
            const m = mine(r.id);
            return (
              <li key={r.id}>
                <Grade grade={r.grade} />
                <span className="rr-path">{r.path}</span>
                {m && (
                  <span className="mine-tag" title={m.addition.note ?? "Added from your own experience"}>
                    <Star size={12} /> Mine
                  </span>
                )}
                <span className="muted count" title="Remedies in this rubric">
                  {r.remedyCount}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > shown && (
        <button type="button" className="secondary" onClick={() => setShown(shown + 300)}>
          Show more ({(list.length - shown).toLocaleString()} left)
        </button>
      )}
    </>
  );
}

// ---------- compare remedies ----------

export const MAX_COMPARE = 4;

export function ComparePage({ params }: { params: URLSearchParams }) {
  const keys = (params.get("r") ?? "").split("|").filter(Boolean).slice(0, MAX_COMPARE);
  return (
    <section className="wide">
      <p className="crumbs">
        <a href="#/symptoms?tab=remedies">
          <ArrowLeft size={15} /> Remedies
        </a>
      </p>
      <div className="page-head">
        <span className="page-icon">
          <GitCompare />
        </span>
        <div>
          <h1>Compare remedies</h1>
          <p className="muted">Up to {MAX_COMPARE} remedies side by side: what they share in the repertory, what only each has, and what the books say.</p>
        </div>
      </div>
      <WithRepertory>{(rep) => <CompareView rep={rep} keys={keys} />}</WithRepertory>
    </section>
  );
}

function RemedyPicker({ data, onPick, placeholder, exclude = [] }: { data: RepertoryFile; onPick: (i: number) => void; placeholder: string; exclude?: number[] }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchRemedies(data, q, 8).filter((i) => !exclude.includes(i)), [data, q, exclude.join(",")]);
  return (
    <div className="remedy-picker">
      <Search size={16} className="field-icon" />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {q.trim() && (
        <ul className="picker-list" role="listbox">
          {hits.length === 0 && <li className="muted">No remedy by that name.</li>}
          {hits.map((i) => {
            const [a, n] = data.remedies[i];
            const g = groupOf(a, n);
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(i);
                    setQ("");
                  }}
                >
                  <KingdomIcon kingdom={g.kingdom} size={16} />
                  <span>{n}</span>
                  <small className="muted">{a}</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CompareView({ rep, keys }: { rep: LoadedRepertory; keys: string[] }) {
  const data = rep.data;
  const ids = keys.map((k) => findRemedy(data, k)).filter((i): i is number => i !== null);
  const set = (next: number[]) => go("/compare", { r: next.map((i) => data.remedies[i][0]).join("|") });
  const cmp = useMemo(() => (ids.length ? compareRemedies(getRemedyIndex(data), ids, 40) : null), [data, ids.join(",")]);

  return (
    <>
      <div className="compare-pick">
        {ids.map((i) => (
          <span key={i} className="pick-chip">
            <KingdomIcon kingdom={groupOf(...data.remedies[i]).kingdom} size={14} />
            {data.remedies[i][1]}
            <button type="button" aria-label={`Remove ${data.remedies[i][1]}`} onClick={() => set(ids.filter((x) => x !== i))}>
              <X size={14} />
            </button>
          </span>
        ))}
        {ids.length < MAX_COMPARE && <RemedyPicker data={data} exclude={ids} placeholder={ids.length ? "Add another remedy" : "Type a remedy, e.g. Pulsatilla"} onPick={(i) => set([...ids, i])} />}
      </div>
      {ids.length === 0 && <EmptyState icon={<GitCompare />} title="Pick two or more remedies" text="Type a name above. You can also compare the top remedies from a case." />}
      {cmp && ids.length > 0 && (
        <>
          <div className="compare-grid" style={{ gridTemplateColumns: `repeat(${ids.length}, minmax(0, 1fr))` }}>
            {ids.map((i, col) => (
              <CompareColumn key={i} rep={rep} remedy={i} total={cmp.totals[col]} unique={cmp.unique[col]} alone={ids.length === 1} />
            ))}
          </div>
          {ids.length > 1 && (
            <>
              <h2 className="section-title">Rubrics they share</h2>
              <p className="muted small">Rubrics all {ids.length} are in, strongest first. Dots show each remedy's grade.</p>
              {cmp.shared.length === 0 ? (
                <p className="muted">They share no rubric where any of them is above grade 1.</p>
              ) : (
                <div className="rep-wrap">
                  <table className="rep shared-table">
                    <thead>
                      <tr>
                        <th className="rep-rubric">Rubric</th>
                        {ids.map((i) => (
                          <th key={i} className="center">
                            {data.remedies[i][0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cmp.shared.map((s) => (
                        <tr key={s.id}>
                          <th className="rep-rubric" scope="row">
                            {s.path} <small className="muted">{s.remedyCount}</small>
                          </th>
                          {s.grades.map((g, c) => (
                            <td key={c} className="rep-cell">
                              <span className={`dot g${g}`} title={`grade ${g}`} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function CompareColumn({ rep, remedy, total, unique, alone }: { rep: LoadedRepertory; remedy: number; total: number; unique: ReturnType<typeof remedyRubrics>; alone: boolean }) {
  const data = rep.data;
  const [ab, name] = data.remedies[remedy];
  const g = groupOf(ab, name);
  const books = useFetch<RemedyPassages>(`/api/remedy-passages?q=${encodeURIComponent(remedySearch(name, data))}`);
  const mind = useMemo(() => remedyRubrics(getRemedyIndex(data), remedy, 3).filter((r) => r.chapter === "Mind").slice(0, 8), [data, remedy]);
  return (
    <article className="compare-col">
      <header>
        <span className={`kingdom-badge small k-${g.kingdom.toLowerCase()}`}>
          <KingdomIcon kingdom={g.kingdom} size={18} />
        </span>
        <div>
          <RemedyLink abbrev={ab} name={name}>
            <b>{name}</b>
          </RemedyLink>
          <span className="muted small">
            {g.family} · {total.toLocaleString()} rubrics
          </span>
        </div>
      </header>
      <h3>Strongest in the mind</h3>
      {mind.length === 0 ? (
        <p className="muted small">No grade 3 mind rubrics.</p>
      ) : (
        <ul className="mini-list">
          {mind.map((r) => (
            <li key={r.id}>{r.path.replace(/^Mind, /, "")}</li>
          ))}
        </ul>
      )}
      <h3>{alone ? "Grade 3 rubrics" : "Only this one, grade 3"}</h3>
      {unique.length === 0 ? (
        <p className="muted small">None.</p>
      ) : (
        <ul className="mini-list">
          {unique.slice(0, 10).map((r) => (
            <li key={r.id}>{r.path}</li>
          ))}
        </ul>
      )}
      <h3>In the books</h3>
      {books.loading && <p className="muted small">Loading…</p>}
      {books.data && books.data.sources.length === 0 && <p className="muted small">No section headed with its name.</p>}
      {books.data && books.data.sources.length > 0 && (
        <ul className="mini-list">
          {books.data.sources.slice(0, 6).map((s) => (
            <li key={s.source_id}>
              {s.first ? <a href={`#/passage/${s.first.id}`}>{s.title}</a> : s.title} <span className="muted">· {s.passages}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

// ---------- remedies tab: find a remedy, my additions ----------

export function RemediesTab({ rep }: { rep: LoadedRepertory }) {
  const data = rep.data;
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchRemedies(data, q, 30), [data, q]);
  const store = useBookStore();
  const [error, setError] = useState<string>();
  return (
    <>
      <div className="tool-cards">
        <a className="tool-card" href="#/compare">
          <GitCompare />
          <b>Compare remedies</b>
          <span>Side by side, up to {MAX_COMPARE}</span>
        </a>
        <a className="tool-card" href="#/symptoms?tab=families">
          <KingdomIcon kingdom="Mineral" />
          <b>Families and tables</b>
          <span>Periodic table, plant families, animal groups</span>
        </a>
      </div>
      <div className="search big-search">
        <Search size={18} className="field-icon" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find one of ${data.remedies.length} remedies by name or abbreviation`} aria-label="Find a remedy" autoFocus />
      </div>
      {q.trim() && hits.length === 0 && <p className="muted">No remedy by that name.</p>}
      {hits.length > 0 && (
        <ul className="remedy-results">
          {hits.map((i) => {
            const [a, n] = data.remedies[i];
            const g = groupOf(a, n);
            return (
              <li key={i}>
                <a href={remedyHref(a)}>
                  <span className={`kingdom-badge small k-${g.kingdom.toLowerCase()}`}>
                    <KingdomIcon kingdom={g.kingdom} size={16} />
                  </span>
                  <span className="rr-name">
                    <b>{n}</b>
                    <small className="muted">
                      {a} · {g.family}
                    </small>
                  </span>
                  <ChevronRight size={18} className="muted" />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="section-title">
        <Star size={20} /> My additions
      </h2>
      <p className="muted small">Remedies you added to rubrics from your own experience. They count in every ranking and are marked with a star. Add one from any rubric's remedy list.</p>
      {store.additions.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ul className="additions-list">
          {store.additions.map((a) => {
            const i = findRemedy(data, a.remedy);
            return (
              <li key={a.id}>
                <Grade grade={a.grade} />
                <span>
                  <b>{i === null ? a.remedy : data.remedies[i][1]}</b> in {a.rubric_path}
                  {a.note && <small className="muted"> · {a.note}</small>}
                </span>
                <button type="button" className="icon-btn" aria-label="Remove this addition" onClick={() => removeAddition(a.id).catch((e: Error) => setError(e.message))}>
                  <X size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </>
  );
}

// ---------- families: periodic table, plants, animals ----------

type FamilyView = "elements" | "plants" | "animals" | "other";

export function FamiliesTab({ rep, params }: { rep: LoadedRepertory; params: URLSearchParams }) {
  const data = rep.data;
  const family = params.get("family");
  const element = params.get("element");
  const initial: FamilyView = element ? "elements" : family && ANIMAL_GROUPS[family] ? "animals" : family && PLANT_FAMILIES[family] ? "plants" : family && (NOSODE_GROUPS[family] || OTHER_GROUPS[family]) ? "other" : "elements";
  const [view, setView] = useState<FamilyView>(initial);
  const groups = useMemo(() => {
    const byFamily = new Map<string, { kingdom: Kingdom; members: number[] }>();
    const byElement = new Map<string, number[]>();
    data.remedies.forEach(([a, n], i) => {
      const g = groupOf(a, n);
      let f = byFamily.get(g.family);
      if (!f) byFamily.set(g.family, (f = { kingdom: g.kingdom, members: [] }));
      f.members.push(i);
      for (const s of g.elements) byElement.set(s, [...(byElement.get(s) ?? []), i]);
    });
    return { byFamily, byElement };
  }, [data]);

  return (
    <>
      <div className="segmented wide-seg" role="tablist" aria-label="Families">
        {(
          [
            ["elements", "Periodic table", "Mineral"],
            ["plants", "Plant families", "Plant"],
            ["animals", "Animal groups", "Animal"],
            ["other", "Nosodes and others", "Nosode"],
          ] as [FamilyView, string, Kingdom][]
        ).map(([v, label, k]) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>
            <KingdomIcon kingdom={k} size={16} /> {label}
          </button>
        ))}
      </div>
      {view === "elements" && <PeriodicTable data={data} byElement={groups.byElement} initial={element} />}
      {view === "plants" && <FamilyCards data={data} names={Object.keys(PLANT_FAMILIES)} byFamily={groups.byFamily} open={family} />}
      {view === "animals" && <FamilyCards data={data} names={Object.keys(ANIMAL_GROUPS)} byFamily={groups.byFamily} open={family} />}
      {view === "other" && <FamilyCards data={data} names={[...Object.keys(NOSODE_GROUPS), ...Object.keys(OTHER_GROUPS)]} byFamily={groups.byFamily} open={family} />}
    </>
  );
}

function MemberChips({ data, members }: { data: RepertoryFile; members: number[] }) {
  return (
    <p className="member-chips">
      {members.map((i) => (
        <a key={i} className="chip" href={remedyHref(data.remedies[i][0])} title={data.remedies[i][1]}>
          {data.remedies[i][1]}
        </a>
      ))}
    </p>
  );
}

function PeriodicTable({ data, byElement, initial }: { data: RepertoryFile; byElement: Map<string, number[]>; initial: string | null }) {
  const [picked, setPicked] = useState<string | null>(initial ?? "K");
  const sel = ELEMENTS.find((e) => e.symbol === picked);
  return (
    <>
      <p className="muted small">Elements with remedies in the repertory are coloured; the number is how many remedies contain the element. Pick one to see them.</p>
      <div className="ptable-wrap">
        <div className="ptable" role="grid" aria-label="Periodic table">
          {ELEMENTS.map((e) => {
            const n = byElement.get(e.symbol)?.length ?? 0;
            return (
              <button
                key={e.symbol}
                type="button"
                className={`el${n ? " has" : ""}${picked === e.symbol ? " on" : ""}${e.row >= 9 ? " f-block" : ""}`}
                style={{ gridRow: e.row, gridColumn: e.col }}
                onClick={() => setPicked(e.symbol)}
                title={`${e.name}${n ? `: ${n} remed${n === 1 ? "y" : "ies"}` : ""}`}
                aria-pressed={picked === e.symbol}
              >
                <small>{e.number}</small>
                <b>{e.symbol}</b>
                {n > 0 && <i>{n}</i>}
              </button>
            );
          })}
          <span className="ptable-gap" style={{ gridRow: 8, gridColumn: "1 / -1" }} />
        </div>
      </div>
      {sel && (
        <div className="panel element-panel">
          <h2>
            {sel.name} <span className="muted">· {sel.symbol}, row {sel.row >= 9 ? (sel.row === 9 ? "6 (lanthanides)" : "7 (actinides)") : sel.row}, column {sel.col}</span>
          </h2>
          {(byElement.get(sel.symbol) ?? []).length === 0 ? (
            <p className="muted">The repertory has no remedy made from {sel.name.toLowerCase()}.</p>
          ) : (
            <MemberChips data={data} members={byElement.get(sel.symbol)!} />
          )}
        </div>
      )}
    </>
  );
}

function FamilyCards({ data, names, byFamily, open }: { data: RepertoryFile; names: string[]; byFamily: Map<string, { kingdom: Kingdom; members: number[] }>; open: string | null }) {
  const [filter, setFilter] = useState("");
  const want = filter.trim().toLowerCase();
  const shown = names
    .map((name) => ({ name, members: byFamily.get(name)?.members ?? [], kingdom: byFamily.get(name)?.kingdom ?? "Other" }))
    .filter((f) => f.members.length > 0)
    .filter((f) => !want || f.name.toLowerCase().includes(want) || f.members.some((i) => data.remedies[i][1].toLowerCase().includes(want)));
  return (
    <>
      <input type="search" className="filter-input" placeholder="Find a family or a remedy in one" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Find a family" />
      <div className="family-cards">
        {shown.map((f) => (
          <details key={f.name} className="family-card" open={open === f.name || !!want || undefined}>
            <summary>
              <span className={`kingdom-badge small k-${f.kingdom.toLowerCase()}`}>
                <KingdomIcon kingdom={f.kingdom} size={16} />
              </span>
              <b>{f.name}</b>
              <span className="count-pill soft">{f.members.length}</span>
            </summary>
            <MemberChips data={data} members={f.members} />
          </details>
        ))}
      </div>
      <p className="muted small">Families follow common homeopathic usage. Open a remedy to see every rubric it is in.</p>
    </>
  );
}
