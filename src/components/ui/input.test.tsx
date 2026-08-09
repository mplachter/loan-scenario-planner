import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders as a textbox and reflects typed input", async () => {
    render(<Input aria-label="Buyer name" />);

    const input = screen.getByRole("textbox", { name: "Buyer name" });
    await userEvent.type(input, "Jamie");

    expect(input).toHaveValue("Jamie");
  });
});
