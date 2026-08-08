"use client";

import { FileUp } from "lucide-react";

export const openImportEvent = "budgetisation:open-import";

export function ImportTrigger({
  className = "button-primary",
  label = "Importer des opérations",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(openImportEvent))}
    >
      <FileUp size={17} />
      {label}
    </button>
  );
}
