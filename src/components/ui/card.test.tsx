import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

describe("Card", () => {
  it("renders all its subcomponents' children in a single composed tree", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Loan summary</CardTitle>
          <CardDescription>30-year fixed</CardDescription>
          <CardAction>Edit</CardAction>
        </CardHeader>
        <CardContent>Principal and interest: $2,400</CardContent>
        <CardFooter>Updated today</CardFooter>
      </Card>,
    );

    expect(screen.getByText("Loan summary")).toBeInTheDocument();
    expect(screen.getByText("30-year fixed")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(
      screen.getByText("Principal and interest: $2,400"),
    ).toBeInTheDocument();
    expect(screen.getByText("Updated today")).toBeInTheDocument();
  });
});
