import type { LocalDate, YearMonth } from "@/core/time";
import type {
  CalendarWeekRef,
  ExplorationNode,
  NavigationCommandResult,
} from "@/navigation";

export type CalendarNavigation = {
  openCalendarMonth(month: YearMonth): NavigationCommandResult;
  openCalendarWeek(month: YearMonth, week: CalendarWeekRef): NavigationCommandResult;
  openDay(date: LocalDate): NavigationCommandResult;
  closeDay(): NavigationCommandResult;
  previousDay(): NavigationCommandResult;
  nextDay(): NavigationCommandResult;
  openExploration(node: ExplorationNode): NavigationCommandResult;
  goToAnalysis(): Promise<NavigationCommandResult>;
};
