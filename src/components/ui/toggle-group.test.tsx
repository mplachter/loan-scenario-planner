import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

describe("ToggleGroup", () => {
  it("fires onValueChange with the clicked item's value in an array", async () => {
    const onValueChange = vi.fn();
    render(
      <ToggleGroup value={["15"]} onValueChange={onValueChange}>
        <ToggleGroupItem value="15">15 yr</ToggleGroupItem>
        <ToggleGroupItem value="30">30 yr</ToggleGroupItem>
      </ToggleGroup>,
    );

    await userEvent.click(screen.getByRole("button", { name: "30 yr" }));

    expect(onValueChange).toHaveBeenCalledWith(["30"], expect.anything());
  });
});
