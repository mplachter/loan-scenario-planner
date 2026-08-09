import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ModeSwitch } from "@/components/ModeSwitch";
import { closedInputs } from "@/test/servicingFixtures";
import { formatMonthYear } from "@/lib/dates";

describe("ModeSwitch", () => {
  it("shows a plain owning label when there is no close date or existing-loan purchase date", () => {
    const inputs = closedInputs({ closeDate: null, existingLoan: null });
    render(<ModeSwitch inputs={inputs} view="buying" onViewChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "🏠 Owning" }),
    ).toBeInTheDocument();
  });

  it("shows the owning-since label formatted from the close date", () => {
    const inputs = closedInputs({ closeDate: "2026-03-15" });
    render(<ModeSwitch inputs={inputs} view="buying" onViewChange={vi.fn()} />);

    expect(
      screen.getByRole("button", {
        name: `🏠 Owning since ${formatMonthYear("2026-03-15")}`,
      }),
    ).toBeInTheDocument();
  });

  it("calls onViewChange('buying') when the Buying button is clicked", async () => {
    const inputs = closedInputs();
    const onViewChange = vi.fn();
    render(
      <ModeSwitch inputs={inputs} view="owning" onViewChange={onViewChange} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Buying" }));

    expect(onViewChange).toHaveBeenCalledWith("buying");
  });

  it("calls onViewChange('owning') when the Owning button is clicked", async () => {
    const inputs = closedInputs({ closeDate: "2026-03-15" });
    const onViewChange = vi.fn();
    render(
      <ModeSwitch inputs={inputs} view="buying" onViewChange={onViewChange} />,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: `🏠 Owning since ${formatMonthYear("2026-03-15")}`,
      }),
    );

    expect(onViewChange).toHaveBeenCalledWith("owning");
  });
});
