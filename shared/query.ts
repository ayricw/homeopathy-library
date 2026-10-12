// Turns what a person types into a safe SQLite FTS5 MATCH expression.
// Every term is quoted, so FTS operators typed by the user (OR, NEAR, column
// filters, parentheses) are treated as plain words. Terms are ANDed.
//   burning pain        -> "burning" "pain"
//   "burning pain"      -> "burning pain"   (exact phrase)
//   burn*               -> "burn"*          (prefix)

export function buildMatchQuery(input: string): string | null {
  const parts: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    if (m[1] !== undefined) {
      const words = clean(m[1]);
      if (words) parts.push(`"${words}"`);
    } else {
      const raw = m[2];
      const prefix = raw.endsWith("*");
      const words = clean(raw);
      if (!words) continue;
      // A token like "nux-vomica" becomes the phrase "nux vomica".
      parts.push(prefix && !words.includes(" ") ? `"${words}"*` : `"${words}"`);
    }
  }
  return parts.length ? parts.join(" ") : null;
}

function clean(s: string): string {
  return s
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
