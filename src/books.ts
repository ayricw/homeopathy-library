// Repertory entries Claude drew from the library's books (public/book-rubrics.json), merged into the
// repertory in the browser. A switch, remembered on this device, decides whether they count in remedy
// ranking; entries Robyn marks wrong are kept in the database and left out for everyone.
import { useEffect, useState } from "react";
import { mergeBooks, withoutBooks, type BookMerge, type BookRubricsFile, type SavedBook } from "../shared/bookrubrics";
import { mergeAdditions, type Addition, type AdditionMerge } from "../shared/additions";
import type { RepertoryFile } from "../shared/repertory";
import { get, send } from "./api";

const SWITCH_KEY = "includeBooks";

function readSwitch(): boolean {
  try {
    return localStorage.getItem(SWITCH_KEY) !== "off";
  } catch {
    return true;
  }
}

type Store = { books: SavedBook[]; flagged: Set<string>; on: boolean; version: number; additions: Addition[]; additionsVersion: number };
const store: Store = { books: [], flagged: new Set(), on: readSwitch(), version: 0, additions: [], additionsVersion: 0 };
const listeners = new Set<() => void>();
const changed = () => {
  store.version++;
  for (const l of listeners) l();
};

/** Loads the books' entries and the flags; a missing file or a failed request leaves the repertory as it is. */
export async function loadBooks(): Promise<void> {
  const [file, flags, mine] = await Promise.all([
    fetch("/book-rubrics.json", { headers: { accept: "application/json" } })
      .then(async (res) => (res.ok && (res.headers.get("content-type") ?? "").includes("json") ? ((await res.json()) as BookRubricsFile) : null))
      .catch(() => null),
    get<{ flags: string[] }>("/api/book-flags").catch(() => ({ flags: [] as string[] })),
    get<{ additions: Addition[] }>("/api/additions").catch(() => ({ additions: [] as Addition[] })),
  ]);
  store.books = file?.books ?? [];
  store.flagged = new Set(flags.flags);
  store.additions = mine.additions;
}

/** Adds (or regrades) a remedy in a rubric from Robyn's own experience. */
export async function saveAddition(rubric: string, remedy: string, grade: number, note: string) {
  const { addition } = await send<{ addition: Addition }>("POST", "/api/additions", { rubric, remedy, grade, note });
  store.additions = [...store.additions.filter((a) => a.id !== addition.id), addition];
  store.additionsVersion++;
  changed();
}

export async function removeAddition(id: number) {
  await send("DELETE", "/api/additions", { id });
  store.additions = store.additions.filter((a) => a.id !== id);
  store.additionsVersion++;
  changed();
}

export function setBooksOn(on: boolean) {
  store.on = on;
  try {
    localStorage.setItem(SWITCH_KEY, on ? "on" : "off");
  } catch {
    // Private windows may refuse storage; the switch still works for this page.
  }
  changed();
}

/** Marks a book entry wrong (or not), for everyone. */
export async function flagEntry(key: string, wrong: boolean) {
  await send(wrong ? "POST" : "DELETE", "/api/book-flags", { key });
  if (wrong) store.flagged.add(key);
  else store.flagged.delete(key);
  changed();
}

export const isFlagged = (key: string) => store.flagged.has(key);

/** Re-renders when the switch or the flags change. */
export function useBookStore(): Store {
  const [, setVersion] = useState(store.version);
  useEffect(() => {
    const l = () => setVersion(store.version);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return store;
}

export interface BooksView extends BookMerge {
  labels: string[];
  on: boolean;
  /** Number of rubrics in the repertory itself; later ids are rubrics only the books have. */
  original: number;
}

let cache: { version: number; base: RepertoryFile; merge: BookMerge; off: RepertoryFile } | null = null;
let mineCache: { data: RepertoryFile; off: RepertoryFile; version: number; mergedOn: AdditionMerge; mergedOff: AdditionMerge } | null = null;

export type MyMarks = AdditionMerge["marks"];

/**
 * The repertory with the books' entries and Robyn's own additions merged in, and the data ranking
 * should use given the books switch. Her additions always count.
 */
export function mergedRepertory(base: RepertoryFile): { data: RepertoryFile; rankData: RepertoryFile; books: BooksView | null; mine: MyMarks } {
  let data = base;
  let off = base;
  let books: BooksView | null = null;
  if (store.books.length > 0) {
    if (!cache || cache.base !== base || cache.version !== flagVersion()) {
      const merge = mergeBooks(base, store.books, store.flagged);
      cache = { version: flagVersion(), base, merge, off: withoutBooks(base, merge.data) };
    }
    data = cache.merge.data;
    off = cache.off;
    books = { ...cache.merge, labels: [...new Set(store.books.map((b) => b.label))], on: store.on, original: base.rubrics.length };
  }
  if (!mineCache || mineCache.data !== data || mineCache.off !== off || mineCache.version !== store.additionsVersion) {
    mineCache = { data, off, version: store.additionsVersion, mergedOn: mergeAdditions(data, store.additions), mergedOff: mergeAdditions(off, store.additions) };
  }
  return { data: mineCache.mergedOn.data, rankData: store.on ? mineCache.mergedOn.data : mineCache.mergedOff.data, books, mine: mineCache.mergedOn.marks };
}

// The merge depends on the flags only, not the switch.
let flagSnapshot = "";
let flagCount = 0;
function flagVersion(): number {
  const s = [...store.flagged].sort().join("\n");
  if (s !== flagSnapshot) {
    flagSnapshot = s;
    flagCount++;
  }
  return flagCount;
}
