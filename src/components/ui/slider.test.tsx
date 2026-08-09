import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Slider } from "@/components/ui/slider";

describe("Slider", () => {
  it("renders a slider role reflecting its value and fires onValueChange on arrow-key interaction", async () => {
    const onValueChange = vi.fn();
    render(
      <Slider value={[10]} min={0} max={40} onValueChange={onValueChange} />,
    );

    const thumb = screen.getByRole("slider", { hidden: true });
    expect(thumb).toHaveAttribute("aria-valuenow", "10");

    thumb.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onValueChange).toHaveBeenCalledWith([11], expect.anything());
  });
});
