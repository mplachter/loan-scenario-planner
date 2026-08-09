import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Field } from "@/components/ui/field";

describe("Field", () => {
  it("renders its label and children, and the hint only when provided", () => {
    const { rerender } = render(
      <Field label="Purchase price">
        <input aria-label="Purchase price" />
      </Field>,
    );

    expect(screen.getByText("Purchase price")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Purchase price" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Includes closing costs"),
    ).not.toBeInTheDocument();

    rerender(
      <Field label="Purchase price" hint="Includes closing costs">
        <input aria-label="Purchase price" />
      </Field>,
    );

    expect(screen.getByText("Includes closing costs")).toBeInTheDocument();
  });
});
