"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const AppToolbarTarget = createContext<HTMLElement | null | undefined>(undefined);

export function AppToolbarContent({ children, className, inline = false }: {
  children: ReactNode;
  className?: string;
  inline?: boolean;
}) {
  const target = useContext(AppToolbarTarget);
  if (inline || target === undefined) return <header className={className}>{children}</header>;
  return target ? createPortal(<div className={className}>{children}</div>, target) : null;
}
