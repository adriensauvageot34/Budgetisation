import { parseStringLiteral } from "../validation";

export const calendarFilterTags = Object.freeze([
  "EVENT_VISIT",
  "ACTIVITY_OUTING",
  "GROCERY",
  "DINING",
  "TRANSPORT",
  "WORK",
  "HEALTH_CARE",
  "FIXED_CHARGE",
  "SUBSCRIPTION",
  "UNASSIGNED_TIMING",
] as const);

export type CalendarFilterTag = (typeof calendarFilterTags)[number];
export const calendarFilterPresets = ["all", "daily", "highlights", "exclude-fixed", "expenses"] as const;
export type CalendarFilterPreset = (typeof calendarFilterPresets)[number];
export type CalendarAmountView = "ALL" | "EXCLUDE_FIXED";
export type CalendarFilterSelection = {
  readonly preset: CalendarFilterPreset;
  readonly tags: readonly CalendarFilterTag[];
  readonly amount: CalendarAmountView;
};

export const calendarFilterPresetRegistry = Object.freeze({
  all: { tags: calendarFilterTags, amount: "ALL" },
  daily: { tags: ["EVENT_VISIT", "ACTIVITY_OUTING", "GROCERY", "DINING", "TRANSPORT", "WORK", "HEALTH_CARE"], amount: "ALL" },
  highlights: { tags: ["EVENT_VISIT", "ACTIVITY_OUTING"], amount: "ALL" },
  "exclude-fixed": { tags: ["EVENT_VISIT", "ACTIVITY_OUTING", "GROCERY", "DINING", "TRANSPORT", "WORK", "HEALTH_CARE"], amount: "EXCLUDE_FIXED" },
  expenses: { tags: ["GROCERY", "DINING", "TRANSPORT", "HEALTH_CARE", "FIXED_CHARGE", "SUBSCRIPTION"], amount: "ALL" },
} as const satisfies Readonly<Record<CalendarFilterPreset, {
  readonly tags: readonly CalendarFilterTag[];
  readonly amount: CalendarAmountView;
}>>);

const tagSet: ReadonlySet<string> = new Set(calendarFilterTags);

export function parseCalendarFilterTag(value: unknown): CalendarFilterTag {
  return parseStringLiteral(value, tagSet, "CalendarFilterTag");
}

/** Strict product-level interpretation of the three Calendar URL controls. */
export function parseCalendarFilterSelection(input: {
  readonly preset?: string;
  readonly show?: string;
  readonly amount?: string;
}): CalendarFilterSelection {
  const preset: CalendarFilterPreset = calendarFilterPresets.includes(input.preset as CalendarFilterPreset)
    ? input.preset as CalendarFilterPreset
    : "all";
  const parsedTags: CalendarFilterTag[] = [];
  for (const rawTag of input.show?.split(",").filter(Boolean) ?? []) {
    if (!tagSet.has(rawTag)) continue;
    const tag = parseCalendarFilterTag(rawTag);
    if (!parsedTags.includes(tag)) parsedTags.push(tag);
  }
  const amount: CalendarAmountView = input.amount === "ALL" || input.amount === "EXCLUDE_FIXED"
    ? input.amount
    : calendarFilterPresetRegistry[preset].amount;
  return {
    preset,
    tags: input.show === undefined ? calendarFilterPresetRegistry[preset].tags : parsedTags,
    amount,
  };
}
