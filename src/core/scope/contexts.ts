import { parseStringLiteral } from "../validation";

export type LifeScopeContext = "Vie courante" | "Hors quotidien";

export type DayContext =
  | "work_onsite"
  | "remote"
  | "weekend_home"
  | "leave_home";

const lifeScopeContexts: ReadonlySet<string> = new Set<LifeScopeContext>([
  "Vie courante",
  "Hors quotidien",
]);
const dayContexts: ReadonlySet<string> = new Set<DayContext>([
  "work_onsite",
  "remote",
  "weekend_home",
  "leave_home",
]);

export function parseLifeScopeContext(value: unknown): LifeScopeContext {
  return parseStringLiteral<LifeScopeContext>(
    value,
    lifeScopeContexts,
    "LifeScopeContext",
  );
}

export function parseDayContext(value: unknown): DayContext {
  return parseStringLiteral<DayContext>(value, dayContexts, "DayContext");
}
