import type { ReactNode } from "react";
import { Bug, FlaskConical, Gem, Leaf, PawPrint, Shapes } from "lucide-react";
import type { Kingdom } from "../shared/families";

// Small shared pieces of the interface: kingdom icons, grade marks and empty states.

const KINGDOM_ICONS = { Mineral: Gem, Plant: Leaf, Animal: PawPrint, Nosode: FlaskConical, Other: Shapes } as const;

export function KingdomIcon({ kingdom, size = 20 }: { kingdom: Kingdom; size?: number }) {
  const Icon = KINGDOM_ICONS[kingdom] ?? Bug;
  return <Icon size={size} aria-hidden="true" />;
}

/** A repertory grade as one to three filled bars. */
export function Grade({ grade }: { grade: number }) {
  return (
    <span className={`grade g${grade}`} title={`Grade ${grade}`} aria-label={`Grade ${grade}`}>
      <i />
      <i />
      <i />
    </span>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/** Initials for a client's avatar circle. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  // A stable colour per name, from a small palette.
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className={`avatar ${size} a${h % 6}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
