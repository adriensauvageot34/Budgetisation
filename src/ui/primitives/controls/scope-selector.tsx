"use client";

export type ScopeSelectorOption<ScopeId extends string> = {
  readonly id: ScopeId;
  readonly label: string;
};

export type ScopeSelectorProps<ScopeId extends string> = {
  readonly label: string;
  readonly value: ScopeId;
  readonly options: readonly ScopeSelectorOption<ScopeId>[];
  readonly onChange: (scopeId: ScopeId) => void;
};

export function ScopeSelector<ScopeId extends string>({
  label,
  value,
  options,
  onChange,
}: ScopeSelectorProps<ScopeId>) {
  return (
    <label className="ui-control-label">
      <span>{label}</span>
      <select
        className="ui-select ui-focusable"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as ScopeId)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
