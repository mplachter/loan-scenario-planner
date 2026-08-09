import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberInput } from "@/components/ui/number-input";

describe("useNumberField (via NumberInput)", () => {
  it("lets the field be cleared to an empty string without snapping to 0", async () => {
    const onChange = vi.fn();
    render(<NumberInput value={700000} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");

    await userEvent.clear(input);

    expect(input).toHaveValue(null);
    expect(onChange).not.toHaveBeenCalledWith(0);
  });

  it("fires onChange live with the parsed value on each valid keystroke", async () => {
    const onChange = vi.fn();
    render(<NumberInput value={700000} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");

    await userEvent.clear(input);
    await userEvent.type(input, "850000");

    expect(onChange).toHaveBeenLastCalledWith(850000);
  });

  it("snaps the displayed value back to the last-good prop value on blur when left empty", async () => {
    const onChange = vi.fn();
    render(<NumberInput value={700000} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");

    await userEvent.clear(input);
    await userEvent.tab();

    expect(input).toHaveValue(700000);
    expect(onChange).not.toHaveBeenCalledWith(0);
  });
});
