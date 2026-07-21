import { useEffect, useRef, useState } from "react";

// Lets a number input be freely cleared/edited while typing (no snap-back-to-0),
// while still keeping outside state in sync when it changes from elsewhere
// (preset buttons, switching terms, etc). Only commits a value upward once the
// typed text actually parses to a number; reverts to the last good value on blur.
export function useNumberField(
  value: number,
  onChange: (value: number) => void,
) {
  const [text, setText] = useState(String(value));
  const lastPushed = useRef(value);

  useEffect(() => {
    if (value !== lastPushed.current) {
      setText(String(value));
      lastPushed.current = value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    if (raw === "" || raw === "-" || raw === "." || raw === "-.") return;
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) {
      lastPushed.current = parsed;
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(text);
    if (text === "" || Number.isNaN(parsed)) {
      setText(String(value));
      lastPushed.current = value;
    }
  };

  return { text, handleChange, handleBlur };
}
