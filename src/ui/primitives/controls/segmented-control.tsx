"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { initialRovingIndex, isButtonActivationKey, resolveRovingIndex } from "../../accessibility";

export type SegmentedControlOption<Value extends string> = {
  readonly value: Value;
  readonly label: string;
  readonly disabledReason?: string;
};

export type SegmentedControlProps<Value extends string> = {
  readonly label: string;
  readonly value: Value;
  readonly options: readonly SegmentedControlOption<Value>[];
  readonly onChange: (value: Value) => void;
  readonly activationMode?: "automatic" | "manual";
};

export function SegmentedControl<Value extends string>({
  label,
  value,
  options,
  onChange,
  activationMode = "manual",
}: SegmentedControlProps<Value>) {
  const preferredIndex = options.findIndex((option) => option.value === value);
  const items = options.map((option) => ({ disabled: option.disabledReason !== undefined }));
  const [focusIndex, setFocusIndex] = useState(() => initialRovingIndex(items, preferredIndex));
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setFocusIndex(initialRovingIndex(items, preferredIndex));
  }, [preferredIndex, options]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = resolveRovingIndex(items, index, event.key, "horizontal");
    if (nextIndex !== null && nextIndex >= 0) {
      event.preventDefault();
      setFocusIndex(nextIndex);
      refs.current[nextIndex]?.focus();
      if (activationMode === "automatic") onChange(options[nextIndex]!.value);
      return;
    }
    if (activationMode === "manual" && isButtonActivationKey(event.key)) {
      event.preventDefault();
      if (options[index]?.disabledReason === undefined) onChange(options[index]!.value);
    }
  };

  return (
    <div className="ui-segmented" role="group" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          className="ui-focusable"
          aria-pressed={option.value === value}
          aria-disabled={option.disabledReason !== undefined || undefined}
          tabIndex={index === focusIndex ? 0 : -1}
          title={option.disabledReason}
          ref={(element) => { refs.current[index] = element; }}
          onFocus={() => setFocusIndex(index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onClick={() => {
            if (option.disabledReason === undefined) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
