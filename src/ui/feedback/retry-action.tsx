"use client";

export type RetryActionProps = {
  readonly onRetry: () => void;
  readonly label?: string;
  readonly disabled?: boolean;
};

export function RetryAction({
  onRetry,
  label = "Réessayer",
  disabled = false,
}: RetryActionProps) {
  return (
    <button type="button" onClick={onRetry} disabled={disabled}>
      {label}
    </button>
  );
}
