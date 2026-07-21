import type { ReactNode } from "react";

interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}

export function Field({ label, children, hint }: FieldProps) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-600 mb-1">{label}</div>
      {children}
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
