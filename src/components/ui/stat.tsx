import type { ReactNode } from "react";

interface StatProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "positive" | "negative";
}

export function Stat({ label, value, sub, tone = "default" }: StatProps) {
  const toneClass =
    tone === "positive"
      ? "text-teal-700"
      : tone === "negative"
        ? "text-red-600"
        : "text-slate-900";
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-lg md:text-xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}
