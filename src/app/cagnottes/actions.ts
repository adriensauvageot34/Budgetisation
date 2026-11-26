"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withProductAuthentication } from "@/app/product-query";
import { forecastWindowMonths } from "@/app/mois-a-venir/month-entry";
import { parseLocalDate } from "@/core/time";
import { plannerDigest, plannerUuid } from "@/domain/phase2/planner/json";
import { effectiveSavingsAllocations, parseSavingsCents, savingsBudgetKinds, savingsGoalProgress, savingsPriorities, savingsProjects, savingsStatuses, savingsTemplates, savingsTravelTopics, seasonalSavingsProject,
  type SavingsGoalAllocation, type SavingsProject, type SavingsStatus } from "@/domain/phase2/savings-goals";
import { changeSavingsSchedule, savingsDeadlineGap, savingsFundingDate, savingsFundingMonths, savingsScheduleDeltas, suggestSavingsMoves,
  type SavingsGoalChange, type SavingsMargin, type SavingsScheduleRequest } from "@/domain/phase2/savings-schedule";
import { getBootstrapSession } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { planningDate } from "@/server/phase2/planning-date";
import { readSavingsGoal, readSavingsGoals } from "@/server/phase2/savings-goals";
import { readSavingsMargin, readSavingsMargins } from "@/server/phase2/savings-margin";

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const validYear = (year: number) => Number.isInteger(year) && year >= 2000 && year <= 2099;
function cents(text: string): number {
  const value = parseSavingsCents(text);
  if (value === null) throw new TypeError("amount");
  return value;
}

async function scope() {
  const { context, session } = await withProductAuthentication(getBootstrapSession);
  if (!context.household) redirect("/acces-refuse");
  return { client: session.supabase, householdId: context.household.householdId,
    currentMonth: planningDate(context.household.timezone).slice(0, 7) };
}

async function updateGoal(owner: Awaited<ReturnType<typeof scope>>, id: string, revision: number, values: Record<string, unknown>) {
  const { data, error } = await owner.client.from("phase2_savings_goals").update({ ...values, revision: revision + 1 })
    .eq("household_id", owner.householdId).eq("goal_id", id).eq("revision", revision).select("goal_id").maybeSingle();
  if (error?.message === "LIVRET_EXCEEDED") throw new TypeError("livret");
  if (error?.code === "23514") throw new TypeError("allocation");
  if (error) throw error;
  if (!data) throw new TypeError("stale");
}

async function mutate(form: FormData, operation: (owner: Awaited<ReturnType<typeof scope>>) => Promise<string | void>) {
  const owner = await scope();
  const month = field(form, "returnMonth");
  const goal = field(form, "goalId");
  const query = new URLSearchParams();
  if (forecastWindowMonths.includes(month)) query.set("month", month);
  const season = field(form, "returnSeason");
  if (validYear(Number(season))) query.set("season", season);
  try {
    const changedGoal = await operation(owner);
    if (changedGoal) query.set("goal", changedGoal);
    query.set("notice", "saved");
    revalidatePath("/cagnottes");
    revalidatePath("/mois-a-venir");
    revalidatePath("/mois-a-venir/composer");
  } catch (error) {
    const code = error instanceof TypeError ? error.message : "";
    if (/^[a-f0-9-]{36}$/u.test(goal)) query.set("goal", goal);
    query.set("notice", ["amount", "allocation", "month", "stale", "fields", "livret", "season"].includes(code) ? code : "unavailable");
  }
  redirect(`/cagnottes?${query}${query.has("goal") ? `#cagnotte-${query.get("goal")}` : ""}`);
}

export async function addSavingsTemplates(form: FormData) {
  await mutate(form, async ({ client, householdId, currentMonth }) => {
    const { error } = await client.from("phase2_savings_goals").upsert(savingsTemplates.map(template => ({
      household_id: householdId, label: template.label, project: template.project, deadline: template.deadline, template_key: template.key,
      travel_topic: template.travelTopic ?? null, priority: template.priority ?? "normal",
      season_year: seasonalSavingsProject(template.project) ? Number(template.deadline?.slice(0, 4) ?? currentMonth.slice(0, 4)) : null,
    })), { onConflict: "household_id,template_key", ignoreDuplicates: true });
    if (error) throw error;
  });
}

export async function saveSavingsGoal(form: FormData) {
  await mutate(form, async owner => {
    const label = field(form, "label"), project = field(form, "project") as SavingsProject, date = field(form, "deadline");
    if (!label || label.length > 100 || !Object.hasOwn(savingsProjects, project)) throw new TypeError("fields");
    let deadline: string | null = null;
    if (date) {
      try { deadline = parseLocalDate(date); } catch { throw new TypeError("fields"); }
    }
    const rawPurchase = field(form, "plannedPurchaseDate");
    let plannedPurchaseDate: string | null = null;
    if (rawPurchase) {
      try { plannedPurchaseDate = parseLocalDate(rawPurchase); } catch { throw new TypeError("fields"); }
    }
    const priority = field(form, "priority") || "normal";
    if (!Object.hasOwn(savingsPriorities, priority) || deadline && plannedPurchaseDate && plannedPurchaseDate > deadline) throw new TypeError("fields");
    const amount = field(form, "target");
    const budgetKind = field(form, "budgetKind") || "estimate";
    const recipient = field(form, "recipient");
    const season = seasonalSavingsProject(project)
      ? Number(field(form, "season") || deadline?.slice(0, 4) || owner.currentMonth.slice(0, 4)) : null;
    if (!Object.hasOwn(savingsBudgetKinds, budgetKind) || recipient.length > 80
      || season !== null && (!validYear(season) || deadline && Number(deadline.slice(0, 4)) !== season)) throw new TypeError("fields");
    const travelTopic = project === "travel" ? field(form, "travelTopic") || "other" : null;
    if (travelTopic !== null && !Object.hasOwn(savingsTravelTopics, travelTopic)) throw new TypeError("fields");
    const values = { label, project, deadline, planned_purchase_date: plannedPurchaseDate, priority, target_cents: amount ? cents(amount) : null,
      travel_topic: travelTopic, budget_kind: budgetKind, recipient: recipient || null, season_year: season, optional: form.get("optional") === "on" };
    const id = field(form, "goalId");
    if (id) {
      await updateGoal(owner, plannerUuid(id), Number(field(form, "revision")), values);
      return id;
    }
    const { data, error } = await owner.client.from("phase2_savings_goals")
      .insert({ ...values, household_id: owner.householdId }).select("goal_id").single();
    if (error) throw error;
    return String(data.goal_id);
  });
}

export async function changeSavingsAllocation(form: FormData) {
  await mutate(form, async owner => {
    const id = plannerUuid(field(form, "goalId"));
    const goal = await readSavingsGoal(owner.client, owner.householdId, id);
    if (!goal || goal.abandoned || goal.revision !== Number(field(form, "revision"))) throw new TypeError("stale");
    const action = field(form, "operation");
    const allocationId = field(form, "allocationId");
    const row = goal.allocations.find(allocation => allocation.id === allocationId);
    const available = effectiveSavingsAllocations(goal).find(allocation => allocation.id === allocationId);
    const remaining = goal.allocations.filter(allocation => allocation.id !== allocationId);
    const validateMonth = (month: string) => {
      if (month < owner.currentMonth || !forecastWindowMonths.includes(month)
        || (savingsFundingDate(goal)?.slice(0, 7) ?? "9999") < month) throw new TypeError("month");
      return month;
    };
    let allocations: SavingsGoalAllocation[];
    if (action === "add" || action === "all") {
      const amount = action === "all" ? savingsGoalProgress(goal).unassigned : cents(field(form, "amount"));
      if (!amount || amount <= 0) throw new TypeError("amount");
      allocations = [...goal.allocations, { id: randomUUID(), month: validateMonth(field(form, "month")), cents: amount, status: "planned", accounted: false }];
    } else {
      if (!row || !available) throw new TypeError("stale");
      if (action === "status") {
        const status = field(form, "status") as SavingsStatus;
        if (!Object.hasOwn(savingsStatuses, status)) throw new TypeError("fields");
        const accounted = status !== "planned" && form.get("accounted") === "on";
        const amount = cents(field(form, "amount"));
        if (amount > available.cents) throw new TypeError("allocation");
        allocations = amount === row.cents ? [...remaining, { ...row, status, accounted }]
          : [...remaining, { ...row, cents: row.cents - amount }, { ...row, id: randomUUID(), cents: amount, status, accounted }];
      } else if (action === "move" && row.status === "planned") {
        const month = validateMonth(field(form, "month"));
        const amount = cents(field(form, "amount"));
        if (amount > available.cents) throw new TypeError("allocation");
        allocations = amount === row.cents ? [...remaining, { ...row, month }]
          : [...remaining, { ...row, cents: row.cents - amount }, { ...row, id: randomUUID(), month, cents: amount }];
      } else if (action === "release" && row.status === "planned") {
        allocations = available.cents === row.cents ? remaining : [...remaining, { ...row, cents: row.cents - available.cents }];
      }
      else throw new TypeError("fields");
    }
    if (goal.targetCents === null || allocations.reduce((sum, allocation) => sum + allocation.cents, 0) > goal.targetCents) throw new TypeError("allocation");
    await updateGoal(owner, id, goal.revision, { allocations });
    return id;
  });
}

export async function setSavingsPurchaseComplete(form: FormData) {
  await mutate(form, async owner => {
    const id = plannerUuid(field(form, "goalId"));
    const goal = await readSavingsGoal(owner.client, owner.householdId, id);
    if (!goal || goal.abandoned || goal.revision !== Number(field(form, "revision"))) throw new TypeError("stale");
    await updateGoal(owner, id, goal.revision, { purchased_complete: field(form, "complete") === "yes" });
    return id;
  });
}

export async function abandonSavingsGoal(form: FormData) {
  await mutate(form, async owner => {
    const id = plannerUuid(field(form, "goalId"));
    const revision = Number(field(form, "revision"));
    const target = field(form, "destinationId");
    const { error } = await createCanonicalReadClient().rpc("abandon_phase2_savings_goal", {
      p_household: owner.householdId, p_goal: id, p_revision: revision, p_destination: target ? plannerUuid(target) : null,
    });
    if (error?.code === "40001") throw new TypeError("stale");
    if (error?.code === "23514") throw new TypeError("livret");
    if (error?.code === "22023") throw new TypeError("fields");
    if (error) throw error;
    return id;
  });
}

export async function duplicateSavingsSeason(form: FormData) {
  await mutate(form, async owner => {
    const project = field(form, "project") as SavingsProject;
    const from = Number(field(form, "fromSeason")), to = Number(field(form, "returnSeason"));
    if (!seasonalSavingsProject(project) || !validYear(from) || !validYear(to) || to <= from) throw new TypeError("season");
    const goals = (await readSavingsGoals(owner.client, owner.householdId)).filter(goal =>
      !goal.abandoned && goal.project === project && goal.season === from && goal.seriesKey);
    if (!goals.length) throw new TypeError("season");
    const { error } = await owner.client.from("phase2_savings_goals").upsert(goals.map(goal => {
      const source = goal.deadline?.slice(5);
      const deadline = source ? `${to}-${source === "02-29" && to % 4 !== 0 ? "02-28" : source}` : null;
      return { household_id: owner.householdId, project, season_year: to, series_key: goal.seriesKey, deadline,
        label: goal.label, recipient: goal.recipient, priority: goal.priority ?? "normal", optional: Boolean(goal.optional) };
    }), { onConflict: "household_id,project,season_year,series_key", ignoreDuplicates: true });
    if (error) throw error;
  });
}

type ScheduleInput = SavingsScheduleRequest | { kind: "suggest"; month: string };
const openMonths = (current: string) => forecastWindowMonths.filter(month => month >= current);
const scheduleError = (error: unknown) => {
  const key = error instanceof TypeError ? error.message : "";
  return ({
    stale: "La cagnotte a changé. Recharge la page avant de reprendre.",
    month: "Choisis un mois ouvert avant l’achat prévu ou l’échéance.",
    deadline: "Renseigne une date d’achat prévue ou une échéance pour utiliser le lissage.",
    amount: "Vérifie les montants et le reste à financer.",
  } as Record<string, string>)[key] ?? "Le planning est indisponible pour le moment.";
};

async function buildSchedule(owner: Awaited<ReturnType<typeof scope>>, input: ScheduleInput) {
  const months = openMonths(owner.currentMonth);
  if (!months.includes(input.month)) throw new TypeError("month");
  const changes: SavingsGoalChange[] = [];
  let margins: SavingsMargin[] = [];
  let remaining = 0;
  let blocked: { goalId: string; label: string; date: string | null }[] = [];
  let moves: { goalId: string; label: string; from: string; to: string; cents: number; date: string | null }[] = [];
  if (input.kind === "suggest") {
    const first = await readSavingsMargin(input.month);
    if (first.cents === null || first.cents >= 0) {
      const note = first.cents === null ? "Marge à confirmer. Le montant à reporter reste à déterminer."
        : "La marge du mois est positive ou nulle.";
      return { changes, impact: [], moves, blocked, remaining, note, stamp: "" };
    }
    const goals = await readSavingsGoals(owner.client, owner.householdId);
    const candidates = goals.filter(goal => effectiveSavingsAllocations(goal).some(row => row.month === input.month && row.status === "planned"));
    const destinations = months.filter(month => month > input.month && candidates.some(goal => savingsFundingMonths(goal, [month]).length));
    margins = [first, ...await readSavingsMargins(destinations)];
    const suggestion = suggestSavingsMoves(candidates, input.month, -first.cents, margins);
    remaining = suggestion.remaining;
    blocked = candidates.filter(goal => suggestion.blocked.includes(goal.goalId) && savingsFundingDate(goal)).map(goal => ({
      goalId: goal.goalId, label: goal.label, date: savingsFundingDate(goal) ?? null,
    }));
    for (const goal of candidates) {
      let current = goal;
      for (const move of suggestion.moves.filter(move => move.goalId === goal.goalId)) {
        const next = changeSavingsSchedule(current, { kind: "move", goalId: goal.goalId, revision: goal.revision, allocationId: move.allocationId,
          month: move.to, cents: move.cents }, months, randomUUID);
        current = { ...current, allocations: next.allocations };
        moves.push({ goalId: goal.goalId, label: goal.label, from: move.from, to: move.to, cents: move.cents, date: savingsFundingDate(goal) ?? null });
      }
      if (current !== goal) changes.push({ goal, allocations: current.allocations });
    }
  } else {
    const goal = await readSavingsGoal(owner.client, owner.householdId, plannerUuid(input.goalId));
    if (!goal) throw new TypeError("stale");
    changes.push(changeSavingsSchedule(goal, input, months, randomUUID));
  }
  const deltas = savingsScheduleDeltas(changes);
  if (input.kind !== "suggest") margins = await readSavingsMargins(deltas.map(([month]) => month));
  const impact = deltas.flatMap(([month, delta]) => margins.filter(item => item.month === month).map(item => ({
    month, delta, before: item.cents, after: item.cents === null ? null : item.cents + delta, limits: item.limits,
  })));
  const gaps = changes.map(({ goal, allocations }) => ({ goalId: goal.goalId, label: goal.label, date: savingsFundingDate(goal) ?? null,
    cents: savingsDeadlineGap({ ...goal, allocations }) ?? 0 })).filter(goal => goal.cents > 0);
  return { changes, impact, moves, blocked, gaps, remaining, note: "",
    stamp: plannerDigest({ input, revisions: changes.map(({ goal }) => [goal.goalId, goal.revision]), impact, moves, blocked, remaining, gaps }) };
}

export async function previewSavingsSchedule(input: ScheduleInput) {
  try {
    const { changes: _changes, ...preview } = await buildSchedule(await scope(), input);
    return { ok: true as const, ...preview };
  } catch (error) {
    return { ok: false as const, message: scheduleError(error) };
  }
}

export async function confirmSavingsSchedule(input: ScheduleInput, stamp: string) {
  try {
    const owner = await scope();
    const draft = await buildSchedule(owner, input);
    if (!draft.changes.length || draft.stamp !== stamp) return { ok: false as const,
      message: "Les montants ou les prévisions ont changé. Recalcule l’aperçu avant de confirmer." };
    const { error } = await owner.client.rpc("apply_phase2_savings_schedule", { p_household: owner.householdId,
      p_updates: draft.changes.map(({ goal, allocations }) => ({ id: goal.goalId, revision: goal.revision, allocations })) });
    if (error?.code === "40001") throw new TypeError("stale");
    if (error?.code === "23514") throw new TypeError("amount");
    if (error) throw error;
    revalidatePath("/cagnottes");
    revalidatePath("/mois-a-venir");
    revalidatePath("/mois-a-venir/composer");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: scheduleError(error) };
  }
}
