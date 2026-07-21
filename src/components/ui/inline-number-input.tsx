import { useNumberField } from "@/hooks/useNumberField";
import { cn } from "@/lib/utils";

interface InlineNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  className?: string;
}

export function InlineNumberInput({
  value,
  onChange,
  step = 1,
  className = "",
}: InlineNumberInputProps) {
  const { text, handleChange, handleBlur } = useNumberField(value, onChange);
  return (
    <input
      type="number"
      value={text}
      step={step}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(className)}
    />
  );
}
