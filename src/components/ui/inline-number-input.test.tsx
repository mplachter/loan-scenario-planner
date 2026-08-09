import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { InlineNumberInput } from "@/components/ui/inline-number-input";

describe("InlineNumberInput", () => {
  it("defaults step to 1 and reflects a custom step prop", () => {
    const { rerender } = render(
      <InlineNumberInput value={5} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("spinbutton")).toHaveAttribute("step", "1");

    rerender(<InlineNumberInput value={5} onChange={vi.fn()} step={0.5} />);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("step", "0.5");
  });
});
