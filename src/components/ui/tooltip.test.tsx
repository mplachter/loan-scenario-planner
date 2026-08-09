import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

describe("Tooltip", () => {
  it("shows its portaled content only after the trigger is hovered", async () => {
    render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Extra detail</TooltipContent>
      </Tooltip>,
    );

    expect(screen.queryByText("Extra detail")).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText("Hover me"));

    expect(await screen.findByText("Extra detail")).toBeInTheDocument();
  });
});
