import { Temporal } from "@js-temporal/polyfill";
import { addDays, type LocalDate } from "./time";

export type RibbonInput = Readonly<{ calendarItemId: string; startDate: LocalDate; endDate: LocalDate; priorityBand: number; priorityWeight: number }>;
export type RibbonSegment = Readonly<{ ribbonItemId: string; weekStart: LocalDate; segmentStart: LocalDate; segmentEnd: LocalDate;
  originalStart: LocalDate; originalEnd: LocalDate; startColumn: number; endColumn: number; lane: 1 | 2 | 3 | 4 }>;
export type RibbonOverflow = Omit<RibbonSegment, "startColumn" | "endColumn" | "lane">;
export type RibbonWeek = Readonly<{ weekStart: LocalDate; segments: readonly RibbonSegment[]; overflowSegments: readonly RibbonOverflow[]; ribbonOverflow: number }>;

/** The historical calendar's segmentation/lane algorithm, shared as presentation only. No amounts or writes. */
export function layoutCalendarRibbons(ribbons: readonly RibbonInput[], monthStart: LocalDate, monthEnd: LocalDate): readonly RibbonWeek[] {
  const monday = (date: LocalDate) => addDays(date, 1 - Temporal.PlainDate.from(date).dayOfWeek);
  const duration = (start: LocalDate, end: LocalDate) => Temporal.PlainDate.from(start).until(Temporal.PlainDate.from(end), { largestUnit: "day" }).days + 1;
  const weekStarts: LocalDate[] = [];
  for (let date = monday(monthStart); date <= monday(monthEnd); date = addDays(date, 7)) weekStarts.push(date);
  const previousLane = new Map<string, 1 | 2 | 3 | 4>();
  return weekStarts.map(weekStart => {
    const weekEnd = addDays(weekStart, 6);
    const candidates = ribbons.filter(item => item.startDate <= weekEnd && item.endDate >= weekStart)
      .map(item => ({ item, segmentStart: item.startDate < weekStart ? weekStart : item.startDate, segmentEnd: item.endDate > weekEnd ? weekEnd : item.endDate }))
      .sort((a, b) => b.item.priorityBand - a.item.priorityBand || b.item.priorityWeight - a.item.priorityWeight
        || duration(b.segmentStart, b.segmentEnd) - duration(a.segmentStart, a.segmentEnd)
        || a.segmentStart.localeCompare(b.segmentStart) || a.item.calendarItemId.localeCompare(b.item.calendarItemId));
    const laneEnds = new Map<number, LocalDate>(), segments: RibbonSegment[] = [], overflowSegments: RibbonOverflow[] = [];
    for (const candidate of candidates) {
      const preferred = previousLane.get(candidate.item.calendarItemId);
      const laneChoices = [...new Set([...(preferred === undefined ? [] : [String(preferred)]), "1", "2", "3", "4"])].sort().map(Number) as (1 | 2 | 3 | 4)[];
      const lane = laneChoices.find(value => !laneEnds.has(value) || laneEnds.get(value)! < candidate.segmentStart);
      const shared = { ribbonItemId: candidate.item.calendarItemId, weekStart, segmentStart: candidate.segmentStart,
        segmentEnd: candidate.segmentEnd, originalStart: candidate.item.startDate, originalEnd: candidate.item.endDate };
      if (lane === undefined) { overflowSegments.push(shared); continue; }
      laneEnds.set(lane, candidate.segmentEnd); previousLane.set(candidate.item.calendarItemId, lane);
      segments.push({ ...shared, startColumn: Temporal.PlainDate.from(candidate.segmentStart).dayOfWeek,
        endColumn: Temporal.PlainDate.from(candidate.segmentEnd).dayOfWeek, lane });
    }
    return { weekStart, segments, overflowSegments, ribbonOverflow: overflowSegments.length };
  });
}
