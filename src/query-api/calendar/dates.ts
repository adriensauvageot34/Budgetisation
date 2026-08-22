import {
  addDays,
  parseLocalDate,
  yearMonthOf,
  type LocalDate,
  type YearMonth,
} from "../../core/time";

export function listCivilMonthDates(month: YearMonth): readonly LocalDate[] {
  const dates: LocalDate[] = [];
  let date = parseLocalDate(`${month}-01`);
  while (yearMonthOf(date) === month) {
    dates.push(date);
    date = addDays(date, 1);
  }
  return dates;
}
