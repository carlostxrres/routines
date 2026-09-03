import { instantString, performedActionInputSchema, roundInputSchema } from "@shared/validation";
import { describe, expect, it } from "vitest";

// Postgres hands a timestamptz back as "2026-09-02 05:25:00+00" — a space
// where ISO puts a T, and a two-digit offset. The client echoes those values
// straight back when it PATCHes a round it just loaded, so the schemas have to
// accept them. They used to reject them, which turned every edit of an
// already-saved round into a 400.

describe("instantString", () => {
  it("accepts what Postgres returns and what the client sends, and normalises both", () => {
    expect(instantString.parse("2026-09-02 05:25:00+00")).toBe("2026-09-02T05:25:00Z");
    expect(instantString.parse("2026-09-02T05:25:00.000Z")).toBe("2026-09-02T05:25:00Z");
    expect(instantString.parse("2026-09-02 07:25:00+02")).toBe("2026-09-02T05:25:00Z");
  });

  it("still rejects anything without an unambiguous instant", () => {
    expect(instantString.safeParse("2026-09-02").success).toBe(false);
    expect(instantString.safeParse("2026-09-02T05:25:00").success).toBe(false);
    expect(instantString.safeParse("mañana").success).toBe(false);
  });
});

describe("roundInputSchema", () => {
  const base = {
    routineId: "3f2504e0-4f89-41d3-9a0c-0305e82c3300",
    date: "2026-09-02",
    startedAt: "2026-09-02 05:00:00+00",
  };

  it("defaults a round with no end to null rather than rejecting it", () => {
    expect(roundInputSchema.parse(base).endedAt).toBe(null);
  });

  it("accepts an end straight back from the database, and an explicit reopen", () => {
    expect(roundInputSchema.parse({ ...base, endedAt: "2026-09-02 06:14:00+00" }).endedAt).toBe(
      "2026-09-02T06:14:00Z",
    );
    expect(roundInputSchema.parse({ ...base, endedAt: null }).endedAt).toBe(null);
  });
});

describe("performedActionInputSchema", () => {
  it("accepts a round-trip of a row straight from the database", () => {
    const parsed = performedActionInputSchema.parse({
      id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      roundId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
      plannedActionId: "3f2504e0-4f89-41d3-9a0c-0305e82c3303",
      name: "Ducha",
      endedAt: "2026-09-02 05:25:00+00",
      comments: "",
    });
    expect(parsed.endedAt).toBe("2026-09-02T05:25:00Z");
  });
});
