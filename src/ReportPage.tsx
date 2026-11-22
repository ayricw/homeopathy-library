import { ArrowLeft, Printer } from "lucide-react";
import { repertorize } from "../shared/repertory";
import type { PreviousVisit, Visit } from "./api";
import { Logo, shortDate } from "./HomePage";
import { pct, Status, useFetch, useRepertory, type AppConfig, type LoadedRepertory } from "./App";
import { FORMS, KIND_LABEL } from "./intake";
import { prescription, RESPONSE_LABEL } from "./ClientsPages";

// A visit laid out for printing or saving as a PDF from the browser's print dialog: the answers given,
// the rubrics, the top remedies and the prescription. Nothing is generated or stored elsewhere.

type Loaded = { visit: Visit; client: { id: string; name: string }; previous: PreviousVisit | null };

export function VisitReport({ id, config }: { id: string; config?: AppConfig }) {
  const loaded = useFetch<Loaded>(config?.clients ? `/api/visits/${id}` : null);
  const rep = useRepertory();
  if (config && !config.clients) return <p className="muted">Client records are not available for this account.</p>;
  return (
    <section className="report-page">
      <div className="report-toolbar no-print">
        <a href={`#/visits/${id}`}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to the visit
        </a>
        <button type="button" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> Print or save as PDF
        </button>
      </div>
      <Status loading={loaded.loading} error={loaded.error} />
      {loaded.data && <Report data={loaded.data} rep={rep.rep ?? null} />}
    </section>
  );
}

function Report({ data: { visit, client, previous }, rep }: { data: Loaded; rep: LoadedRepertory | null }) {
  const kind = visit.kind ?? "acute";
  const answers = visit.answers ?? {};
  const sections = FORMS[kind]
    .map((s) => ({
      title: s.title,
      rows: s.questions
        .map((q) => ({ q: q.label, a: [answers[q.id], answers[`${q.id}-more`]].filter((x) => x?.trim()).join(". ") }))
        .filter((r) => r.a),
    }))
    .filter((s) => s.rows.length);
  // Rubric paths to ids in the current repertory; paths it no longer has are listed but not ranked.
  const ids: number[] = [];
  if (rep) for (const p of visit.rubrics) {
    const n = rep.tree.byPath.get(p);
    const rid = n === undefined ? null : rep.tree.nodes[n].id;
    if (rid !== null) ids.push(rid);
  }
  const ranked = rep && ids.length ? repertorize(rep.rankData, ids, visit.method).slice(0, 10) : [];

  return (
    <article className="report">
      <header className="report-head">
        <span className="report-brand">
          <Logo /> Homeopathy Library
        </span>
        <h1>Case report</h1>
        <dl>
          <dt>Client</dt>
          <dd>{client.name}</dd>
          <dt>Visit</dt>
          <dd>
            {shortDate(visit.date)} · {KIND_LABEL[kind]}
          </dd>
          {visit.remedy && (
            <>
              <dt>Prescription</dt>
              <dd>
                <b>{prescription({ remedy: visit.remedy, potency: visit.potency })}</b>
                {visit.dosing && ` · ${visit.dosing}`}
              </dd>
            </>
          )}
        </dl>
      </header>

      {(previous?.remedy || visit.response) && (
        <section>
          <h2>Since the last remedy</h2>
          {previous?.remedy && (
            <p>
              Given {shortDate(previous.date)}: <b>{prescription(previous)}</b>
              {previous.dosing && ` · ${previous.dosing}`}
            </p>
          )}
          {visit.response && (
            <p>
              Response: <b>{RESPONSE_LABEL[visit.response]}</b>
            </p>
          )}
          {visit.responseNotes && <p className="pre">{visit.responseNotes}</p>}
        </section>
      )}

      {sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          <dl className="qa">
            {s.rows.map((r) => (
              <div key={r.q}>
                <dt>{r.q}</dt>
                <dd className="pre">{r.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {visit.notes.trim() && (
        <section>
          <h2>Other notes</h2>
          <p className="pre">{visit.notes}</p>
        </section>
      )}

      <section>
        <h2>Rubrics ({visit.rubrics.length})</h2>
        {visit.rubrics.length === 0 ? (
          <p className="muted">None chosen.</p>
        ) : (
          <ol className="report-rubrics">
            {visit.rubrics.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        )}
      </section>

      {ranked.length > 0 && (
        <section>
          <h2>Top remedies in the repertory</h2>
          <table className="report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Remedy</th>
                <th>Rubrics covered</th>
                <th>Total grade</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((m, i) => (
                <tr key={m.index}>
                  <td>{i + 1}</td>
                  <td>{m.name}</td>
                  <td>
                    {m.covered} of {ids.length} ({pct(m.covered, ids.length)}%)
                  </td>
                  <td>
                    {m.total} of {ids.length * 3} ({pct(m.total, ids.length * 3)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <footer className="report-foot">
        Printed {new Date().toLocaleDateString()} · Confidential client record. The repertory ranking shows what the repertory lists; it is not a prescription.
      </footer>
    </article>
  );
}
