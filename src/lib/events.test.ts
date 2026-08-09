import { describe, expect, it } from "vitest";

import {
  createLumpSumEvent,
  createRecurringExtraEvent,
  eventsEqual,
  type MortgageEvent,
} from "@/lib/events";

describe("eventsEqual", () => {
  it("treats two empty timelines as equal", () => {
    expect(eventsEqual([], [])).toBe(true);
  });

  it("ignores array order and key insertion order", () => {
    const lump = createLumpSumEvent(12, { amount: 5000 });
    const extra = createRecurringExtraEvent(6, { amount: 300 });
    // what a UI patch produces: same fields, different key order
    const patched = { ...lump, amount: 5000 } as MortgageEvent;

    expect(eventsEqual([lump, extra], [extra, patched])).toBe(true);
  });

  it("detects an edited field", () => {
    const lump = createLumpSumEvent(12, { amount: 5000 });

    expect(eventsEqual([lump], [{ ...lump, amount: 5001 }])).toBe(false);
    expect(eventsEqual([lump], [{ ...lump, enabled: false }])).toBe(false);
  });

  it("detects an added or removed event", () => {
    const lump = createLumpSumEvent(12, { amount: 5000 });
    const extra = createRecurringExtraEvent(6, { amount: 300 });

    expect(eventsEqual([lump], [lump, extra])).toBe(false);
  });
});
