import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SectionTitle } from "@/components/ui/section-title";

describe("SectionTitle", () => {
  it("renders the title, and the note only when provided", () => {
    const { rerender } = render(<SectionTitle title="Closing costs" />);

    expect(screen.getByText("Closing costs")).toBeInTheDocument();
    expect(screen.queryByText("Estimated at close")).not.toBeInTheDocument();

    rerender(<SectionTitle title="Closing costs" note="Estimated at close" />);

    expect(screen.getByText("Estimated at close")).toBeInTheDocument();
  });
});
