import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

describe("Tabs", () => {
  it("mounts only the active panel's content and swaps it when a different trigger is clicked", async () => {
    render(
      <Tabs defaultValue="setup">
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
        </TabsList>
        <TabsContent value="setup">Setup panel content</TabsContent>
        <TabsContent value="strategy">Strategy panel content</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText("Setup panel content")).toBeInTheDocument();
    expect(
      screen.queryByText("Strategy panel content"),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Strategy" }));

    expect(screen.getByText("Strategy panel content")).toBeInTheDocument();
    expect(screen.queryByText("Setup panel content")).not.toBeInTheDocument();
  });
});
