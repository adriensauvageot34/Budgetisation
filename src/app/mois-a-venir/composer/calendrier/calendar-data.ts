import "server-only";
import { addDays, parseLocalDate, parseYearMonth } from "@/core/time";
import { JULY_COMPOSER_MONTH, JULY_PILOT_DATE, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { withProductAuthentication } from "@/app/product-query";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { readMonthInputs } from "@/server/phase2/month-inputs";
import { readPlanningMonthForecast } from "@/server/phase2/month-planning-read";
import { deriveMonthScenario } from "@/server/phase2/month-scenario";
import { readMonthPredictionEvidence } from "@/server/phase2/month-prediction-evidence";
import { planningDate } from "@/server/phase2/planning-date";
import { readActiveComposerDraft } from "@/server/phase2/planner/composer-draft-service";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { readJulyBudget } from "@/server/phase2/planner/july-budget";
import { projectJulyPilot } from "@/server/phase2/planner/july-pilot";
import { readMonthComposer } from "@/server/phase2/planner/read-model";
import { readRealizedMonth, type RealizedBoard, type RealizedCard, type RealizedPayment } from "@/server/phase2/planner/realized-month";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { commerceBadgeImages } from "@/ui/media/commerce-illustrations";
import { composerCalendarArtwork } from "../../calendar-artwork";
import { calendarMetadata } from "../../calendar-metadata";
import { calendarDaySummary, calendarItemsOnDate, calendarRibbonWeeks, orderCalendarItems } from "../../calendar-presentation";
import { projectMonthCalendar, type CalendarEntry, type CalendarItem } from "../../planned-expenses-projection";

type Bootstrap = Awaited<ReturnType<typeof getBootstrapContext>>;
const categories = "/planned-visuals/commerce/categories";

export function observedCalendarItems(board: RealizedBoard, pilot: boolean): CalendarItem[] {
  const first = `${board.month}-01`;
  const last = new Date(Date.UTC(Number(board.month.slice(0, 4)), Number(board.month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return board.cards.flatMap(card => {
    if (card.section === "flows" || pilot && card.pilotStatus === "planned") return [];
    const link = realizedComposerHref(board.month, card.id);
    const participants = card.participant ? [card.participant] : card.work ? [card.work.name] : undefined;
    const status = pilot && card.pilotStatus !== "confirmed" ? "pending" : "confirmed";
    const payments: CalendarItem[] = status === "confirmed" ? card.payments.filter(payment => payment.flow === "expense").map(payment => ({
      key: payment.id, date: payment.date, label: payment.label, amount: payment.amount.replace(/^-/, ""),
      artwork: composerCalendarArtwork({ label: payment.label, art: payment.art ?? card.art, badge: payment.badge, category: payment.category }),
      nature: card.section === "fixed" ? "CERTAIN_OUTFLOW" : "DECLARED_REALIZED", composerStatus: status,
      dateCertainty: "DECLARED", participants: payment.participant ? [payment.participant] : participants, composerHref: link,
    })) : [];
    const moments = card.occurrences?.length ? card.occurrences : (card.section === "events" || !payments.length) && (card.date || !card.payments.length)
      ? [{ id: card.id, label: card.label, date: card.date, endDate: card.endDate }] : [];
    const events: CalendarItem[] = moments.flatMap(moment => {
      if (moment.date && (moment.date > last || (moment.endDate ?? moment.date) < first)) return [];
      return [{
        key: `moment:${moment.id}`, label: moment.label, date: moment.date ?? null,
        endDate: pilot && moment.endDate && moment.endDate > JULY_PILOT_DATE ? JULY_PILOT_DATE : moment.endDate,
        amount: null, dateCertainty: moment.date ? "DECLARED" : "UNKNOWN",
        nature: "PLAN_MOMENT", composerStatus: pilot ? status : "observed",
        composerHref: link, participants, artwork: composerCalendarArtwork({ label: moment.label, art: card.art }),
      }];
    });
    return [...events, ...payments];
  });
}

async function julyItems(context: Bootstrap) {
  const { householdId, timezone } = context.household!;
  const [source, evidence, model] = await Promise.all([
    readRealizedMonth(context, parseYearMonth(JULY_COMPOSER_MONTH)),
    readMonthPredictionEvidence(createCanonicalReadClient(), householdId, JULY_COMPOSER_MONTH, true, { asOfDate: JULY_PILOT_DATE, timezone }),
    composerDraftAutosaveEnabledFor(context.user.id) ? withProductAuthentication(async () => {
      const planner = await authorizedPlanner();
      const draft = await readActiveComposerDraft(planner, JULY_COMPOSER_MONTH);
      return draft ? readMonthComposer({ ...planner.deps, readWorld: planner.deps.readComposerWorld ?? planner.deps.readWorld },
        householdId, JULY_COMPOSER_MONTH, draft.semanticState) : null;
    }) : null,
  ]);
  const pilot = projectJulyPilot(source);
  const budget = readJulyBudget(source, pilot, evidence, model);
  const items = observedCalendarItems(pilot, true);
  for (const charge of budget.fixedCalendar) if (charge.status === "planned") items.push({
    key: charge.id, label: charge.label, calendarLabel: calendarMetadata(charge.label).calendarLabel, amount: charge.amount, date: charge.date,
    nature: "CERTAIN_OUTFLOW", composerStatus: "planned", fixedState: "UPCOMING", dateCertainty: charge.date ? "HISTORICAL_ESTIMATE" : "UNKNOWN",
    artwork: composerCalendarArtwork({ label: charge.label, art: charge.artwork, badge: charge.badge }),
  });
  for (const entry of budget.plannedCalendar) items.push({
    key: entry.id, label: entry.label, amount: entry.amount, date: entry.date, nature: "PLANNED_EXPENSE", composerStatus: "planned",
    dateCertainty: "DECLARED", artwork: composerCalendarArtwork({ label: entry.label, art: entry.artwork, category: entry.category }),
  });
  const plannedNames = new Set(budget.plannedCalendar.map(item => `${item.date}:${item.label}`));
  if (!model) for (const card of pilot.cards.filter(card => card.pilotStatus === "planned" && card.section === "events" && !card.payments.length)) {
    if (card.date && !plannedNames.has(`${card.date}:${card.label}`)) items.push({
      key: card.id, label: card.label, date: card.date, endDate: card.endDate, amount: null, nature: "PLANNED_EXPENSE",
      composerStatus: "planned", dateCertainty: "DECLARED",
      artwork: composerCalendarArtwork({ label: card.label, art: card.art }),
    });
  }
  return items;
}

async function fixedForecastItems(context: Bootstrap, month: string): Promise<CalendarItem[]> {
  const { householdId, timezone } = context.household!;
  const auth = await getAuthenticatedBootstrapClient();
  const client = createCanonicalReadClient();
  // In the Composer timeline these months are forecasts, as viewed from the July pilot.
  const cutoff = month <= planningDate(timezone).slice(0, 7)
    ? addDays(parseLocalDate(`${month}-01`), -1) : planningDate(timezone);
  const evidence = readMonthPredictionEvidence(client, householdId, month, true, { asOfDate: cutoff, timezone });
  const [forecast, { inputs }] = await Promise.all([
    readPlanningMonthForecast(client, householdId, month, evidence), readMonthInputs(auth.supabase, householdId, month),
  ]);
  const { planningReference } = deriveMonthScenario({ ...forecast, forecastMemory: [] }, inputs, null, cutoff);
  const charges = projectMonthCalendar(planningReference.certainOutflows.items, []);
  return [...charges.entries, ...charges.undated].map(item => {
    const label = item.label;
    const key = /google one/iu.test(label) ? "google-one" : item.brandKey;
    const badge = key && commerceBadgeImages({ identityKey: key })[0]?.src;
    const family = item.group === "Maison" ? "home" : item.group === "Télécom" ? "telecom"
      : item.group === "Assurances" ? "insurance" : item.group === "Banque" ? "bank" : "professional-services";
    return { ...item, composerStatus: "planned", artwork: { src: badge || `${categories}/${family}.webp`, kind: "badge" } };
  });
}

export async function readComposerCalendar(context: Bootstrap, month: string, mode: "realized" | "pilot" | "forecast") {
  const raw = mode === "pilot" ? await julyItems(context) : mode === "forecast" ? await fixedForecastItems(context, month)
    : observedCalendarItems(await readRealizedMonth(context, parseYearMonth(month)), false);
  const entries = raw.filter((item): item is CalendarEntry => item.date !== null);
  const first = new Date(`${month}-01T12:00:00Z`);
  const weekday = (first.getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const ribbons = calendarRibbonWeeks(entries, month);
  const weeks = Array.from({ length: Math.ceil((weekday + last) / 7) }, (_, week) => {
    const days = Array.from({ length: 7 }, (_, column) => {
      const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1 - weekday + week * 7 + column)).toISOString().slice(0, 10);
      if (!date.startsWith(month)) return { date, items: [], total: null };
      const items = orderCalendarItems(calendarItemsOnDate(entries, date));
      const summary = calendarDaySummary(items, date);
      return { date, items, total: summary.exactCount + summary.estimatedCount ? summary.grossTotal : null };
    });
    return { days, ribbons: ribbons[week]?.segments.flatMap(segment => {
      const item = entries.find(entry => entry.key === segment.ribbonItemId);
      return item ? [{ ...segment, item }] : [];
    }) ?? [] };
  });
  return { weeks, undated: raw.filter(item => item.date === null) };
}
