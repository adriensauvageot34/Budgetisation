"use client";

import { createContext, type RefObject } from "react";

// Composer registers its guard in the shared shell, above the individual month routes.
export type ComposerMonthNavigationGuard = (navigate: () => void) => string | null;
export const ComposerMonthNavigationContext = createContext<RefObject<ComposerMonthNavigationGuard | null> | null>(null);
