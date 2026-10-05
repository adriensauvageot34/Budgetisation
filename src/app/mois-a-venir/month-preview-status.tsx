"use client";
import { useEffect, useState } from "react";

/** Keep short server round trips visually quiet without blocking local inputs. */
export function MonthPreviewStatus({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setVisible(true), 200);
    return () => { clearTimeout(timer); setVisible(false); };
  }, [active]);
  return <span role="status">{active && visible ? "Mise à jour…" : ""}</span>;
}
