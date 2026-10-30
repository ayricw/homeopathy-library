import { describe, expect, it } from "vitest";
import { VISIT_KINDS } from "../shared/clients";
import { FORMS, OPTION_SEPARATOR } from "../src/intake";

describe("visit forms", () => {
  it("has one form per visit kind, with valid and unique question ids", () => {
    for (const kind of VISIT_KINDS) {
      const ids = FORMS[kind].flatMap((s) => s.questions.flatMap((q) => (q.options ? [q.id, `${q.id}-more`] : [q.id])));
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size, kind).toBe(ids.length);
      for (const id of ids) expect(id, kind).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it("keeps tick-list options joinable and distinct", () => {
    for (const q of Object.values(FORMS).flat().flatMap((s) => s.questions)) {
      if (!q.options) continue;
      expect(new Set(q.options).size, q.id).toBe(q.options.length);
      for (const o of q.options) expect(o.includes(OPTION_SEPARATOR), o).toBe(false);
    }
  });
});
