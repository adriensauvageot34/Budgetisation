"use client";

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
};

export function SegmentedControl<Value extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<Value>) {
  return (
    <div className="ui-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="ui-focusable"
          aria-pressed={option.value === value}
          disabled={option.disabledReason !== undefined}
          title={option.disabledReason}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
