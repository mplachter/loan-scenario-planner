import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Label } from "@/components/ui/label";

describe("Label", () => {
  it("renders its children as a label element", () => {
    render(<Label htmlFor="rate">Interest rate</Label>);

    const label = screen.getByText("Interest rate");
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveAttribute("for", "rate");
  });
});
