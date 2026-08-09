import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

describe("AlertDialog", () => {
  it("reveals its portaled content after the trigger is clicked, then confirms via Action", async () => {
    const onConfirm = vi.fn();
    render(
      <AlertDialog>
        <AlertDialogTrigger>Delete "Scenario 1"</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Delete "Scenario 1"?</AlertDialogTitle>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.queryByText('Delete "Scenario 1"?')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: 'Delete "Scenario 1"' }),
    );
    expect(screen.getByText('Delete "Scenario 1"?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Delete "Scenario 1"?')).not.toBeInTheDocument();
  });

  it("closes without confirming when Cancel is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <AlertDialog>
        <AlertDialogTrigger>Delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this?</AlertDialogTitle>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete this?")).not.toBeInTheDocument();
  });
});
