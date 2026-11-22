// Saves one model's entries from a "Book rubrics trial" run into public/book-rubrics.json, which the app
// reads to add the books' entries to remedy ranking (with an on/off switch). Run by the "Save book
// rubrics" workflow, which downloads the trial's artifact first.
//
//   npx tsx scripts/save-book-rubrics.ts <trial.json> --model <model> --label <short name> --run <run id>
//
// Needs public/data/repertory.json (npm run build:repertory) to match remedy names.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { saveEntries, type BookEntry, type BookRubricsFile } from "../shared/bookrubrics";
import type { RepertoryFile } from "../shared/repertory";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : "";
};
const model = flag("model") || "claude-opus-5-5";
const label = flag("label");
const run = flag("run");
const out = flag("out") || "public/book-rubrics.json";
const [trialPath] = args;
if (!trialPath || !label) {
  console.error("Usage: tsx scripts/save-book-rubrics.ts <trial.json> --model <model> --label <short name> --run <run id>");
  process.exit(2);
}

const trial = JSON.parse(readFileSync(trialPath, "utf8")) as {
  source: string;
  title: string;
  results: { model: string; entries: BookEntry[] }[];
};
const result = trial.results.find((r) => r.model === model);
if (!result) throw new Error(`${trialPath} has no results from ${model}`);
const repertory = JSON.parse(readFileSync("public/data/repertory.json", "utf8")) as RepertoryFile;
const { saved, skipped } = saveEntries(repertory, result.entries);

const file: BookRubricsFile = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : { format: 1, books: [] };
file.books = file.books.filter((b) => b.source !== trial.source);
file.books.push({ source: trial.source, title: trial.title, label, model, run, entries: saved });
file.books.sort((a, b) => a.label.localeCompare(b.label));
writeFileSync(out, JSON.stringify(file).replace(/\],\[/g, "],\n["));
console.log(
  `${trial.source}: ${saved.length} entries saved from ${result.entries.length}; ` +
    `${skipped.unknownRemedy} skipped (remedy not in the repertory), ${skipped.listOnly} skipped (quote only names remedies).`,
);
