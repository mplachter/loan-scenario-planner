import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Scenario } from "@/lib/scenarios";

interface ScenarioBarProps {
  scenarios: Scenario[];
  activeScenarioId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function ScenarioBar({
  scenarios,
  activeScenarioId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onDuplicate,
}: ScenarioBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function startEditing(scenario: Scenario) {
    setEditingId(scenario.id);
    setEditingName(scenario.name);
  }

  function commitEditing() {
    if (editingId && editingName.trim()) {
      onRename(editingId, editingName.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {scenarios.map((scenario) => {
        const isActive = scenario.id === activeScenarioId;
        if (editingId === scenario.id) {
          return (
            <Input
              key={scenario.id}
              autoFocus
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={commitEditing}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEditing();
                if (e.key === "Escape") setEditingId(null);
              }}
              className="h-7 w-32"
            />
          );
        }
        return (
          <div key={scenario.id} className="flex items-center gap-0.5">
            <Button
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onSelect(scenario.id)}
              onDoubleClick={() => startEditing(scenario)}
            >
              {scenario.name}
            </Button>
            {isActive && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Rename ${scenario.name}`}
                onClick={() => startEditing(scenario)}
              >
                <Pencil />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Duplicate ${scenario.name}`}
              onClick={() => onDuplicate(scenario.id)}
            >
              <Copy />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${scenario.name}`}
                  />
                }
              >
                <Trash2 />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete "{scenario.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(scenario.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      })}
      <Button variant="ghost" size="sm" onClick={onCreate}>
        <Plus /> New scenario
      </Button>
    </div>
  );
}
