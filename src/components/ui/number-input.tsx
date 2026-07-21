import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { useNumberField } from "@/hooks/useNumberField";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  disabled?: boolean;
}

export function NumberInput({
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  disabled,
  className,
  ...rest
}: NumberInputProps) {
  const { text, handleChange, handleBlur } = useNumberField(value, onChange);
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        value={text}
        step={step}
        disabled={disabled}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn(prefix && "pl-7", suffix && "pr-8", className)}
        {...rest}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
          {suffix}
        </span>
      )}
    </div>
  );
}
