"use client";

import { createContext } from "react";
import { useLayoutMotion } from "@/components/layout/use-layout-motion";

export const GlobalLayoutMotion = createContext({
  revision: 0,
  changeLayout: (update: () => void) => update(),
});

export function useGlobalLayoutMotion() {
  return useLayoutMotion("global-layout");
}
