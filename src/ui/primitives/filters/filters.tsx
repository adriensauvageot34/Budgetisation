"use client";

import type { MetricId } from "../../../core/identity";
import type { QueryFilterKey } from "../../../query-api/capabilities/types";
import { Button, type UiAction } from "../actions";

export type FilterTriggerProps = {
  readonly label?: string;
  readonly activeCount?: number;
  readonly action: UiAction;
};

export function FilterTrigger({
  label = "Filtres",
  activeCount,
  action,
}: FilterTriggerProps) {
  return (
    <Button action={action} tone="secondary">
      {label}{activeCount === undefined ? "" : ` (${activeCount})`}
    </Button>
  );
}

export type FilterChipProps = {
  readonly filter: QueryFilterKey;
  readonly label: string;
  readonly onRemove: (filter: QueryFilterKey) => void;
};

export function FilterChip({ filter, label, onRemove }: FilterChipProps) {
  return (
    <span className="ui-filter-chip" data-filter-key={filter}>
      <span>{label}</span>
      <button
        type="button"
        className="ui-focusable"
        aria-label={`Retirer le filtre ${label}`}
        onClick={() => onRemove(filter)}
      >
        ×
      </button>
    </span>
  );
}

export type SortOption<SortKey extends string> = {
  readonly key: SortKey;
  readonly label: string;
};

export type SortControlProps<SortKey extends string> = {
  readonly label?: string;
  readonly value: SortKey;
  readonly options: readonly SortOption<SortKey>[];
  readonly onChange: (key: SortKey) => void;
};

export function SortControl<SortKey extends string>({
  label = "Trier par",
  value,
  options,
  onChange,
}: SortControlProps<SortKey>) {
  return (
    <label className="ui-control-label">
      <span>{label}</span>
      <select
        className="ui-select ui-focusable"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as SortKey)}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export type MeasureOption = {
  readonly metricId: MetricId;
  readonly label: string;
};

export type MeasureSelectorProps = {
  readonly label?: string;
  readonly value: MetricId;
  readonly availableMeasures: readonly MeasureOption[];
  readonly onChange: (metricId: MetricId) => void;
};

export function MeasureSelector({
  label = "Mesure",
  value,
  availableMeasures,
  onChange,
}: MeasureSelectorProps) {
  return (
    <label className="ui-control-label">
      <span>{label}</span>
      <select
        className="ui-select ui-focusable"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as MetricId)}
      >
        {availableMeasures.map((measure) => (
          <option key={measure.metricId} value={measure.metricId}>{measure.label}</option>
        ))}
      </select>
    </label>
  );
}
