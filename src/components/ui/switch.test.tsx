import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("renders as a switch role and fires onCheckedChange when clicked", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />);

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await userEvent.click(toggle);

    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });
});
