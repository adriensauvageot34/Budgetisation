"use client";

import { useState } from "react";

export function RealizedBadge({ label, sources, named = false }: {
  label: string;
  sources: readonly string[];
  named?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const src = sources[index];
  return src ? <img src={src} alt={named ? label : ""} title={label} width={28} height={28}
    loading="lazy" decoding="async" onError={() => setIndex(previous => previous + 1)} /> : null;
}
