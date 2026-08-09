import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { NumberInput } from "@/components/ui/number-input";

describe("NumberInput", () => {
  it("renders a prefix and suffix when provided", () => {
    render(
      <NumberInput value={700000} onChange={vi.fn()} prefix="$" suffix="/mo" />,
    );

    expect(screen.getByText("$")).toBeInTheDocument();
    expect(screen.getByText("/mo")).toBeInTheDocument();
  });

  it("defaults step to 1 and reflects a custom step prop", () => {
    const { rerender } = render(<NumberInput value={5} onChange={vi.fn()} />);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("step", "1");

    rerender(<NumberInput value={5} onChange={vi.fn()} step={0.25} />);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("step", "0.25");
  });
});
