import { useEffect, useRef, useState, type KeyboardEvent } from "react";

// ---------- menu bar: a row of menus across the top, like a desktop program ----------
// On a narrow screen the whole bar folds into one Menu button that lists every menu.

export interface MenuItem {
  label: string;
  href: string;
  /** A short line under the label saying what the page is for. */
  hint?: string;
  /** Shown at the right of the item, for example a count. */
  badge?: string;
  /** Runs before the page opens, for example to pick a tab on that page. */
  onPick?: () => void;
}

export interface Menu {
  label: string;
  items: MenuItem[];
}

/** The page the hash points at, without its query, so menus can show where you are. */
const here = (href: string) => href.replace(/^#/, "").split("?")[0];

export function MenuBar({ menus, path, onNavigate }: { menus: Menu[]; path: string; onNavigate: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [folded, setFolded] = useState(true);
  const bar = useRef<HTMLElement>(null);

  // Close on a click outside the bar, and whenever the page changes.
  useEffect(() => {
    if (open === null && folded) return;
    const onDown = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) {
        setOpen(null);
        setFolded(true);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, folded]);
  useEffect(() => {
    setOpen(null);
    setFolded(true);
  }, [path]);

  const pick = (item: MenuItem) => {
    item.onPick?.();
    onNavigate();
    setOpen(null);
    setFolded(true);
  };

  const focusItem = (menu: number, index: number) => {
    const items = bar.current?.querySelectorAll<HTMLElement>(`[data-menu="${menu}"] [role="menuitem"]`);
    if (items?.length) items[(index + items.length) % items.length].focus();
  };

  const onKey = (e: KeyboardEvent, menu: number) => {
    const items = [...(bar.current?.querySelectorAll<HTMLElement>(`[data-menu="${menu}"] [role="menuitem"]`) ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      setOpen(null);
      bar.current?.querySelector<HTMLElement>(`[data-menu="${menu}"] > button`)?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (open !== menu) setOpen(menu);
      requestAnimationFrame(() => focusItem(menu, at + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open !== menu) setOpen(menu);
      requestAnimationFrame(() => focusItem(menu, at < 0 ? -1 : at - 1));
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const next = (menu + (e.key === "ArrowRight" ? 1 : -1) + menus.length) % menus.length;
      bar.current?.querySelector<HTMLElement>(`[data-menu="${next}"] > button`)?.focus();
      if (open !== null) setOpen(next);
    }
  };

  return (
    <nav className="menubar" ref={bar} aria-label="Main menu">
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={!folded}
        aria-controls="menus"
        onClick={() => setFolded(!folded)}
      >
        Menu
      </button>
      <ul id="menus" className={folded ? "menus folded" : "menus"} role="menubar">
        {menus.map((menu, m) => {
          const current = menu.items.some((i) => here(i.href) === path);
          const badge = menu.items.find((i) => i.badge)?.badge;
          // Items that open the same page on different tabs are not marked, since the tab shows which is open.
          const unique = (item: MenuItem) => menus.flatMap((x) => x.items).filter((i) => here(i.href) === here(item.href)).length === 1;
          return (
            <li
              key={menu.label}
              data-menu={m}
              className={current ? "here" : undefined}
              onKeyDown={(e) => onKey(e, m)}
              onPointerEnter={(e) => e.pointerType === "mouse" && open !== null && open !== m && setOpen(m)}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={open === m}
                onClick={() => setOpen(open === m ? null : m)}
              >
                {menu.label}
                {badge && <span className="badge">{badge}</span>}
                <span className="caret" aria-hidden="true" />
              </button>
              <ul role="menu" aria-label={menu.label} hidden={open !== m}>
                {menu.items.map((item) => (
                  <li key={item.label} role="none">
                    <a
                      role="menuitem"
                      href={item.href}
                      aria-current={here(item.href) === path && unique(item) ? "page" : undefined}
                      onClick={() => pick(item)}
                    >
                      <span className="item-label">
                        {item.label}
                        {item.badge && <span className="badge">{item.badge}</span>}
                      </span>
                      {item.hint && <span className="item-hint">{item.hint}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
