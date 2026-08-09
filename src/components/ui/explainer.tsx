import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { EXPLAINERS, type ExplainerKey } from "@/lib/explainers";

export function Explain({ k }: { k: ExplainerKey }) {
  const { term, what, why, watchOut } = EXPLAINERS[k];
  return (
    <Tooltip>
      <TooltipTrigger className="cursor-help align-baseline">
        <Info className="size-3 text-slate-400 inline align-baseline" />
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 max-w-xs">
          <div className="font-semibold">{term}</div>
          <div>{what}</div>
          <div className="text-slate-300">{why}</div>
          {watchOut && <div>⚠ {watchOut}</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ExplainerNote({ k }: { k: ExplainerKey }) {
  const { term, what, why, watchOut } = EXPLAINERS[k];
  return (
    <div className="bg-slate-100 rounded-lg p-3 text-xs text-slate-700 space-y-1">
      <div className="font-semibold text-slate-800">{term}</div>
      <div>{what}</div>
      <div className="text-slate-500">{why}</div>
      {watchOut && <div className="text-amber-700">⚠ {watchOut}</div>}
    </div>
  );
}
