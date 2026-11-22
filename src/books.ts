// Repertory entries Claude drew from the library's books (public/book-rubrics.json), merged into the
// repertory in the browser. A switch, remembered on this device, decides whether they count in remedy
// ranking; entries Robyn marks wrong are kept in the database and left out for everyone.
import { useEffect, useState } from "react";
import { mergeBooks, withoutBooks, type BookMerge, type BookRubricsFile, type SavedBook } from "../shared/bookrubrics";
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

type Store = { books: SavedBook[]; flagged: Set<string>; on: boolean; version: number };
const store: Store = { books: [], flagged: new Set(), on: readSwitch(), version: 0 };
const listeners = new Set<() => void>();
const changed = () => {
  store.version++;
  for (const l of listeners) l();
};

/** Loads the books' entries and the flags; a missing file or a failed request leaves the repertory as it is. */
export async function loadBooks(): Promise<void> {
  const [file, flags] = await Promise.all([
    fetch("/book-rubrics.json", { headers: { accept: "application/json" } })
      .then(async (res) => (res.ok && (res.headers.get("content-type") ?? "").includes("json") ? ((await res.json()) as BookRubricsFile) : null))
      .catch(() => null),
    get<{ flags: string[] }>("/api/book-flags").catch(() => ({ flags: [] as string[] })),
  ]);
  store.books = file?.books ?? [];
  store.flagged = new Set(flags.flags);
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

/** The repertory with the books merged in, and the data ranking should use given the switch. */
export function mergedRepertory(base: RepertoryFile): { data: RepertoryFile; rankData: RepertoryFile; books: BooksView | null } {
  if (store.books.length === 0) return { data: base, rankData: base, books: null };
  if (!cache || cache.base !== base || cache.version !== flagVersion()) {
    const merge = mergeBooks(base, store.books, store.flagged);
    cache = { version: flagVersion(), base, merge, off: withoutBooks(base, merge.data) };
  }
  const { merge, off } = cache;
  return {
    data: merge.data,
    rankData: store.on ? merge.data : off,
    books: { ...merge, labels: store.books.map((b) => b.label), on: store.on, original: base.rubrics.length },
  };
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
