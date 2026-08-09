import { describe, expect, it } from "vitest";
import {
  addMonthsISO,
  dateToMonthISO,
  daysInMonthUTC,
  firstOfMonthISO,
  firstPaymentDateFor,
  formatFullDate,
  formatMonthYear,
  monthsBetweenISO,
  monthToDateISO,
  parseISO,
  toISO,
} from "./dates";

describe("addMonthsISO", () => {
  it("carries across a year boundary", () => {
    expect(addMonthsISO("2029-11-15", 3)).toBe("2030-02-15");
  });

  it("carries backward across a year boundary", () => {
    expect(addMonthsISO("2030-01-10", -2)).toBe("2029-11-10");
  });

  it("clamps end-of-month days instead of rolling into the next month", () => {
    // 2029 is not a leap year, so Feb has 28 days.
    expect(addMonthsISO("2029-01-31", 1)).toBe("2029-02-28");
  });

  it("clamps correctly into a leap February", () => {
    expect(addMonthsISO("2032-01-31", 1)).toBe("2032-02-29");
  });

  it("is a no-op for zero months", () => {
    expect(addMonthsISO("2029-06-15", 0)).toBe("2029-06-15");
  });
});

describe("daysInMonthUTC", () => {
  it("knows February's length in leap and non-leap years", () => {
    expect(daysInMonthUTC(2029, 2)).toBe(28);
    expect(daysInMonthUTC(2032, 2)).toBe(29);
  });
});

describe("firstPaymentDateFor", () => {
  it("skips to the 1st of the second month after a mid-month close", () => {
    expect(firstPaymentDateFor("2029-03-15")).toBe("2029-05-01");
  });

  it("skips to the 1st of the second month after a first-of-month close", () => {
    expect(firstPaymentDateFor("2029-03-01")).toBe("2029-05-01");
  });
});

describe("monthToDateISO / dateToMonthISO round-trip", () => {
  const firstPayment = "2029-05-01";

  it("round-trips a set of months through date and back", () => {
    for (const month of [1, 2, 6, 12, 36, 360]) {
      const date = monthToDateISO(firstPayment, month);
      expect(dateToMonthISO(firstPayment, date)).toBe(month);
    }
  });

  it("month 1 is the first payment date itself", () => {
    expect(monthToDateISO(firstPayment, 1)).toBe(firstPayment);
  });

  it("returns a value <= 0 for dates before the first payment, uncamped", () => {
    expect(dateToMonthISO(firstPayment, "2029-03-01")).toBeLessThanOrEqual(0);
  });
});

describe("monthsBetweenISO", () => {
  it("counts whole calendar months between two dates", () => {
    expect(monthsBetweenISO("2029-01-01", "2030-01-01")).toBe(12);
    expect(monthsBetweenISO("2029-01-15", "2029-01-01")).toBe(0);
  });
});

describe("firstOfMonthISO", () => {
  it("clamps a date down to the 1st of its month", () => {
    expect(firstOfMonthISO("2029-03-15")).toBe("2029-03-01");
  });
});

describe("parseISO / toISO", () => {
  it("round-trips components", () => {
    expect(toISO(2029, 3, 5)).toBe("2029-03-05");
    expect(parseISO("2029-03-05")).toEqual({ y: 2029, m: 3, d: 5 });
  });
});

describe("formatting has no off-by-one day drift", () => {
  it("formats a month/year label without shifting the day", () => {
    expect(formatMonthYear("2029-03-01")).toBe("Mar 2029");
    expect(formatMonthYear("2029-12-31")).toBe("Dec 2029");
  });

  it("formats a full date without shifting the day", () => {
    expect(formatFullDate("2029-03-15")).toBe("Mar 15, 2029");
    expect(formatFullDate("2029-01-01")).toBe("Jan 1, 2029");
  });
});
