import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Explain, ExplainerNote } from "@/components/ui/explainer";
import { EXPLAINERS } from "@/lib/explainers";

describe("Explain", () => {
  it("shows the explainer's term and description in a tooltip on hover", async () => {
    render(<Explain k="pmi" />);
    const { term, what } = EXPLAINERS.pmi;

    expect(screen.queryByText(term)).not.toBeInTheDocument();

    await userEvent.hover(screen.getByRole("button"));

    expect(await screen.findByText(term)).toBeInTheDocument();
    expect(screen.getByText(what)).toBeInTheDocument();
  });
});

describe("ExplainerNote", () => {
  it("renders the explainer's content inline without any interaction", () => {
    render(<ExplainerNote k="recast" />);
    const { term, what } = EXPLAINERS.recast;

    expect(screen.getByText(term)).toBeInTheDocument();
    expect(screen.getByText(what)).toBeInTheDocument();
  });
});
