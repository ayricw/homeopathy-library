import { useEffect, useState } from "react";

// The collect tray: passages pinned while researching. Stored only in this browser (localStorage), never on the
// server, and it holds references and short excerpts only. There is deliberately no free-text note field, so
// nothing about a patient can end up here.

export interface CollectedItem {
  passageId: number;
  sourceId: string;
  title: string;
  author: string;
  edition: string | null;
  publicationYear: number | null;
  heading: string | null;
  location: string;
  excerpt: string;
  addedAt: string;
}

const KEY = "homeopathy-library:collected:v1";
const EVENT = "homeopathy-library:collected";
const EXCERPT_CHARS = 280;
export const MAX_ITEMS = 200;

/** Shortens text to an excerpt on a word boundary. Strips FTS snippet markers. */
export function excerpt(text: string, max = EXCERPT_CHARS): string {
  const flat = text.replace(/[\u0002\u0003]/g, "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function isCollected(items: CollectedItem[], passageId: number) {
  return items.some((i) => i.passageId === passageId);
}

/** Adds the item at the front, or removes it if it is already collected. */
export function toggle(items: CollectedItem[], item: CollectedItem): CollectedItem[] {
  if (isCollected(items, item.passageId)) return items.filter((i) => i.passageId !== item.passageId);
  return [item, ...items].slice(0, MAX_ITEMS);
}

/** Groups items by source, keeping the order in which each source was first collected. */
export function groupBySource(items: CollectedItem[]): { sourceId: string; items: CollectedItem[] }[] {
  const groups = new Map<string, CollectedItem[]>();
  for (const i of items) groups.set(i.sourceId, [...(groups.get(i.sourceId) ?? []), i]);
  return [...groups].map(([sourceId, list]) => ({ sourceId, items: list }));
}

/** One citation line per item, for pasting into notes. */
export function formatReferences(items: CollectedItem[]): string {
  return groupBySource(items)
    .flatMap(({ items: list }) =>
      list.map((i) =>
        [i.author, i.title, i.edition, i.publicationYear, i.heading, i.location].filter((v) => v !== null && v !== "").join(", "),
      ),
    )
    .join("\n");
}

/** Keeps only well-formed items, so a corrupted or older stored value never breaks the page. */
export function parse(raw: string | null): CollectedItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (i): i is CollectedItem =>
        !!i &&
        typeof i === "object" &&
        Number.isInteger(i.passageId) &&
        typeof i.sourceId === "string" &&
        typeof i.title === "string" &&
        typeof i.author === "string" &&
        typeof i.location === "string" &&
        typeof i.excerpt === "string",
    );
  } catch {
    return [];
  }
}

function load(): CollectedItem[] {
  try {
    return parse(window.localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function save(items: CollectedItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage blocked or full: the tray still works for this page view.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: items }));
}

/** The collected items, kept in sync across components and browser tabs. */
export function useCollected() {
  const [items, setItems] = useState<CollectedItem[]>(load);
  useEffect(() => {
    const onLocal = (e: Event) => setItems((e as CustomEvent<CollectedItem[]>).detail);
    const onStorage = (e: StorageEvent) => e.key === KEY && setItems(load());
    window.addEventListener(EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return {
    items,
    toggle: (item: CollectedItem) => save(toggle(load(), item)),
    remove: (passageId: number) => save(load().filter((i) => i.passageId !== passageId)),
    clear: () => save([]),
  };
}
