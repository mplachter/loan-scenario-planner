import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Stat } from "@/components/ui/stat";

describe("Stat", () => {
  it("renders label, value, and sub when all are provided", () => {
    render(
      <Stat
        label="Monthly payment"
        value="$2,400"
        sub="Principal + interest"
      />,
    );

    expect(screen.getByText("Monthly payment")).toBeInTheDocument();
    expect(screen.getByText("$2,400")).toBeInTheDocument();
    expect(screen.getByText("Principal + interest")).toBeInTheDocument();
  });

  it("omits the sub line when not provided", () => {
    render(<Stat label="Monthly payment" value="$2,400" />);

    expect(screen.getByText("$2,400")).toBeInTheDocument();
    expect(screen.queryByText("Principal + interest")).not.toBeInTheDocument();
  });

  it("applies a different tone class for positive vs negative vs default", () => {
    const { rerender } = render(
      <Stat label="Net" value="$100" tone="positive" />,
    );
    expect(screen.getByText("$100")).toHaveClass("text-teal-700");

    rerender(<Stat label="Net" value="-$100" tone="negative" />);
    expect(screen.getByText("-$100")).toHaveClass("text-red-600");

    rerender(<Stat label="Net" value="$0" />);
    expect(screen.getByText("$0")).toHaveClass("text-slate-900");
  });
});
