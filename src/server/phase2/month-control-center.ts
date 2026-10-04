import "server-only";
import Big from "big.js";
import { parseMonthDecisionSettings } from "@/domain/phase2/month-decision-contract";
import { categoryDecisionCapabilities, type MonthChoiceOperation } from "@/domain/phase2/month-choice-contract";
import { parseMonthControlDraft, parseMonthControlPurpose, monthChoiceTarget, monthControlCategoryPresets, type MonthControlSection, type MonthControlPurpose } from "@/domain/phase2/month-control-contract";
import { deriveMonthScenario } from "./month-scenario";
import { monthChoiceDigest, simulateMonthChoice, proposeMonthChoices, type MonthChoiceContext } from "./month-choices";
import { projectMonthDecision } from "./month-decision-projection";
import { comparableForecastCheckpoints, calibrateForecast } from "./forecast-memory";
import { forecastTemporalPolicy } from "./forecast-temporal-policy";

import { controlDate, controlResourceLabel } from "@/domain/phase2/month-control-display";

type Scope = "ECONOMIC_MONTH" | "BANK_CASH" | "BENEFIT_FUNDING" | `CATEGORY:${string}` | `PROJECT:${string}`;
type Destination = Readonly<{ section: MonthControlSection; focus: string }>;
type RootCause = Readonly<{ key: string; label: string; explanation: string; symptoms: readonly string[];
  priority: "BLOCKING" | "STRUCTURAL" | "USEFUL" | "INFORMATIONAL"; scopes: readonly Scope[];
  actionable: boolean; destination: Destination; projectId?: string }>;
type ActiveItem = Readonly<{ key: string; label: string; value: string; nature: "INTENTION" | "DECISION" | "RESERVATION"; destination: Destination; actionLabel?: string }>;
const positive = (value: Big) => value.gt(0) ? value : new Big(0);
const money = (value: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value));
const resources = (focus: string): Destination => ({ section: "update", focus });
const settingsDestination = (focus: string): Destination => ({ section: "update", focus });

/** Interpretation only. Amounts are supplied by the existing scenario owners. */
export function projectMonthControlCenter(ctx: MonthChoiceContext) {
  const scenario = deriveMonthScenario(ctx.forecast, ctx.inputs, null, ctx.asOf, ctx.expenses), inputs = scenario.inputs;
  const settings = parseMonthDecisionSettings(inputs.decision), plan = scenario.economicPlan;
  const decision = plan ? projectMonthDecision(plan, settings, ctx.forecast.meta.targetMonth, ctx.asOf, ctx.expenses, ctx.forecast.forecastMemory) : null;
  const categoryControls = decision?.categoryControls ?? [];
  const globalDelta = decision?.goal?.central ?? null;
  const globalGap = globalDelta === null ? "0.00" : positive(new Big(globalDelta).times(-1)).toFixed(2);
  const categoryTensions = categoryControls.filter(row => row.varianceToTarget !== null && new Big(row.varianceToTarget).gt(0)).map(row => ({
    key: `category:${row.key}`, kind: "CATEGORY_TARGET" as const, categoryKey: row.key, label: row.label, target: row.target!,
    forecast: row.forecast, realized: row.realized, amount: row.varianceToTarget!, alreadyOver: row.status === "ALREADY_OVER_TARGET",
    explanation: row.status === "ALREADY_OVER_TARGET" ? `Objectif déjà dépassé de ${money(row.realizedOverTarget)}. Seul le reste du mois peut être limité.`
      : `${row.label} dépasse votre repère d’environ ${money(row.varianceToTarget!)}.`,
    destination: { section: "choices" as const, focus: row.key } }));
  const globalTensions = new Big(globalGap).gt(0) ? [{ key: "global-goal", kind: "GLOBAL_GOAL" as const,
    label: "Objectif de fin de mois", amount: globalGap, explanation: `Il manque environ ${money(globalGap)} pour atteindre votre objectif de fin de mois.`,
    destination: { section: "choices" as const, focus: "global-goal" } }] : [];
  const causes: RootCause[] = [];
  if (scenario.availableNow.value === null) causes.push({ key: "bank-balance", label: "Solde Banque à confirmer",
    explanation: "Le solde absent ou insuffisamment daté empêche de certifier le disponible bancaire, sans effacer la projection économique.",
    symptoms: ["Solde actuel non confirmé pour cette date"], priority: "STRUCTURAL", scopes: ["BANK_CASH"], actionable: true, destination: resources("BANK") });
  for (const provider of ["SWILE", "EDENRED"] as const) {
    const wallet = scenario.benefitWallets[provider], label = provider === "SWILE" ? "Swile" : "Edenred", symptoms: string[] = [];
    if (wallet.currentBalanceKnowledge.amount === null) symptoms.push("Stock actuel à confirmer");
    if (!wallet.expectedLoading) symptoms.push("Chargement mensuel non renseigné");
    if (wallet.limitations.includes("BENEFIT_LOADING_DATE_UNKNOWN")) symptoms.push("Date du chargement à préciser");
    if (new Big(wallet.shortfall).gt(0)) symptoms.push("Allocation supérieure à la capacité connue");
    if (new Big(wallet.fundingToComplete).gt(0)) symptoms.push("Financement des projets incomplet");
    if (wallet.ownerPersonId === null) symptoms.push("Propriétaire canonique non résolu");
    if (symptoms.length) causes.push({ key: `wallet:${provider}`, label: `${label} à préciser`, symptoms,
      explanation: "Ces informations limitent le financement de certains repas et projets. Leur coût économique reste affichable indépendamment.",
      priority: !plan && !wallet.expectedLoading ? "BLOCKING" : "STRUCTURAL", scopes: ["BENEFIT_FUNDING", "BANK_CASH"], actionable: symptoms.some(value => value !== "Propriétaire canonique non résolu"), destination: resources(provider) });
  }
  const obligations = ctx.forecast.components.filter(row => row.key.startsWith("obligation:"));
  for (const part of obligations.filter(row => row.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(row.label)))
    if (!inputs.confirmedObligations.some(row => row.componentKey === part.key) && !inputs.declinedConditionalObligations.includes(part.key))
      causes.push({ key: `conditional:${part.key}`, label: `${part.label} : prévu ce mois ?`, explanation: "Confirmez Oui, Non ou Je ne sais pas. Aucun montant inconnu n’est inventé.",
        symptoms: ["Charge conditionnelle non résolue"], priority: "STRUCTURAL", scopes: ["ECONOMIC_MONTH"], actionable: true, destination: settingsDestination(part.key) });
  for (const expense of ctx.expenses) {
    const symptoms: string[] = [];
    if (expense.status === "PLANNED" && expense.plannedDate && expense.plannedDate < ctx.asOf) symptoms.push("Date passée, réalisation non confirmée");
    if (expense.context?.project?.unpricedComponents?.length) symptoms.push("Budget à compléter");
    if (symptoms.length) causes.push({ key: `project:${expense.id}`, label: "title" in expense && typeof expense.title === "string" ? expense.title : "Projet à préciser", symptoms,
      explanation: "Ouvrez le projet pour compléter ou confirmer son intention auprès de son éditeur habituel.", priority: "STRUCTURAL",
      scopes: ["ECONOMIC_MONTH", `PROJECT:${expense.id}`], actionable: true, destination: { section: "update", focus: "projects" }, projectId: expense.id });
  }
  if (plan?.narrative.prediction?.currentImportsMissing) causes.push({ key: "imports", label: "Imports récents incomplets",
    explanation: "Les habitudes historiques complètent les données manquantes ; absence d’import ne signifie pas zéro dépense.", symptoms: ["Couverture récente incomplète"],
    priority: "STRUCTURAL", scopes: ["ECONOMIC_MONTH", "BANK_CASH"], actionable: false, destination: { section: "understand", focus: "imports" } });
  if (decision?.attention.some(row => row.key === "revision")) causes.push({ key: "forecast-change", label: "Projection sensiblement révisée",
    explanation: "Comparez les estimations conservées pour comprendre cette évolution.", symptoms: ["Variation depuis un checkpoint comparable"],
    priority: "INFORMATIONAL", scopes: ["ECONOMIC_MONTH"], actionable: false, destination: { section: "understand", focus: "history" } });
  const priorities = { BLOCKING: 0, STRUCTURAL: 1, USEFUL: 2, INFORMATIONAL: 3 };
  const rootCauses = [...new Map(causes.map(row => [row.key, row])).values()].sort((a, b) => priorities[a.priority] - priorities[b.priority] || a.key.localeCompare(b.key));
  const labelFor = (key: string) => categoryControls.find(row => row.key === key)?.label ?? categoryDecisionCapabilities(key)?.label
    ?? plan?.resources.find(row => row.key === key)?.label ?? ctx.forecast.components.find(row => row.key === key)?.label
    ?? ctx.forecast.income.components.find(row => row.key === key)?.label ?? key;
  const humanLabel = (key: string) => controlResourceLabel(labelFor(key));
  const activeIntentions: ActiveItem[] = Object.entries(settings.categoryTargets).map(([key, value]) => ({ key: `target:${key}`, label: humanLabel(key),
    value: `Objectif ${money(value)}`, nature: "INTENTION", destination: { section: "choices", focus: key } }));
  if (settings.goal !== null) activeIntentions.push({ key: "goal", label: "Objectif de fin de mois", value: money(settings.goal), nature: "INTENTION", destination: { section: "choices", focus: "global-goal" } });
  const activeDecisions: ActiveItem[] = Object.entries(settings.assumptions).map(([key, value]) => ({ key: `assumption:${key}`, label: humanLabel(key),
    value: value.mode === "CUSTOM" ? `Reste limité à ${money(value.amount!)}` : value.mode === "LOWER" ? "Reste réduit de 20 %" : "Reste augmenté de 20 %",
    nature: "DECISION", destination: { section: "choices", focus: `choice:${key}` } }));
  for (const [key, amount] of Object.entries(inputs.resourceOverrides)) activeDecisions.push({ key: `resource:${key}`, label: humanLabel(key), value: `Prévision du mois : ${money(amount)}`, nature: "DECISION", destination: resources("income") });
  for (const [key, row] of Object.entries(inputs.fixedAmountOverrides)) activeDecisions.push({ key: `fixed:${key}`, label: humanLabel(key), value: `Ajustée à ${money(row.amount)} ce mois`, nature: "DECISION", destination: settingsDestination(key) });
  for (const key of inputs.excludedFixedObligations) activeDecisions.push({ key: `excluded:${key}`, label: humanLabel(key), value: "Retirée de ce mois", nature: "DECISION", destination: settingsDestination(key) });
  for (const key of inputs.declinedConditionalObligations) activeDecisions.push({ key: `declined:${key}`, label: humanLabel(key), value: "Non prévue ce mois", nature: "DECISION", destination: settingsDestination(key) });
  for (const row of inputs.confirmedObligations) activeDecisions.push({ key: `confirmed:${row.componentKey}`, label: humanLabel(row.componentKey), value: `Confirmée · ${money(row.amount)} · ${controlDate(row.dueDate)}`, nature: "DECISION", destination: settingsDestination(row.componentKey) });
  const savings = plan?.savingsAllocations.items ?? inputs.declaredOutflows.map(row => ({ ...row, adjustability: row.adjustability!, source: row.source!, annualGoalRef: row.annualGoalRef! }));
  const reservations: ActiveItem[] = savings.map((row, index) => ({ key: `reservation:${row.id}`, label: row.label,
    value: `${money(row.amount)} ${row.adjustability === "PROTECTED" ? "protégés" : "réservés, ajustables"}`, nature: "RESERVATION", destination: { section: "choices", focus: `reserve-${index + 1}` } }));
  const economicFragile = !plan || rootCauses.some(row => row.scopes.includes("ECONOMIC_MONTH") && row.priority !== "INFORMATIONAL");
  const scopedReliability = { economic: !plan ? "UNAVAILABLE" : economicFragile ? "FRAGILE" : "USABLE",
    bank: !plan || plan.bankCash.endOfMonth.central === null || scenario.availableNow.value === null ? "FRAGILE" : "USABLE",
    benefit: Object.fromEntries(Object.values(scenario.benefitWallets).map(row => [row.provider, rootCauses.some(cause => cause.key === `wallet:${row.provider}`) ? "FRAGILE" : "USABLE"])) };
  const tensions = [...globalTensions, ...categoryTensions];
  const goalCount = Object.keys(settings.categoryTargets).length + (settings.goal === null ? 0 : 1);
  const goalState = goalCount === 0 ? "NO_GOALS_DEFINED" : !plan ? "GOALS_UNAVAILABLE" : tensions.length ? "GOALS_NEED_ATTENTION" : "ALL_GOALS_MET";
  const defaultPurpose: MonthControlPurpose = globalTensions.length ? { kind: "GLOBAL_GOAL" } : categoryTensions.length ? { kind: "CATEGORY_CORRECTION", categoryKey: categoryTensions[0]!.categoryKey } : plan ? { kind: "FREE_EXPLORATION" } : { kind: "NONE" };
  return { targetMonth: scenario.targetMonth, asOf: ctx.asOf, baseDigest: monthChoiceDigest(ctx), editable: scenario.targetMonth >= ctx.asOf.slice(0, 7),
    monthState: !plan ? "INCOMPLETE" : globalTensions.length ? "GLOBAL_ATTENTION" : categoryTensions.length ? "CATEGORY_ATTENTION" : "CALM",
    goalState, goalCount,
    headline: !plan ? "Complétons les ressources pour préparer ce mois" : goalState === "NO_GOALS_DEFINED" ? "Vous n’avez pas encore défini de repères pour ce mois."
      : goalState === "ALL_GOALS_MET" ? "Vos objectifs sont respectés dans la projection actuelle."
      : `${tensions.length} objectif${tensions.length > 1 ? "s demandent" : " demande"} votre attention.`,
    actionableCount: tensions.length + rootCauses.filter(row => row.actionable).length,
    projectionSummary: { economic: plan?.narrative.final ?? null, bank: plan?.bankCash.endOfMonth ?? null,
      globalGoal: settings.goal, globalDelta, globalGap, globalSatisfied: globalDelta !== null && new Big(globalDelta).gte(0),
      remainingDailyLife: plan?.monthlyLayers.remainingDailyLife ?? null, categoryGap: decision?.totalCategoryGap ?? "0.00", protectedSavings: plan?.savingsAllocations.protectedTotal ?? null },
    tensions, categoryTensions, globalTensions, rootCauses, knowledgeIssues: rootCauses, scopedReliability,
    observations: [{ key: "bank", label: "Solde Banque", nature: "FACT" as const, amount: inputs.openingBalance?.amount ?? null, date: inputs.openingBalance?.asOfDate ?? null },
      ...Object.values(scenario.benefitWallets).map(wallet => ({ key: wallet.provider, label: wallet.provider === "SWILE" ? "Solde Swile" : "Solde Edenred", nature: "FACT" as const,
        amount: wallet.latestObservation?.amount ?? null, date: wallet.latestObservation?.asOfDate ?? null }))].filter(row => row.amount !== null && row.date !== null),
    forecastNature: "FORECAST" as const,
    activeIntentions: activeIntentions.map(row => ({ ...row, actionLabel: "Modifier" })),
    activeDecisions: activeDecisions.map(row => ({ ...row, actionLabel: row.key.startsWith("excluded:") ? "Rétablir" : "Modifier" })), reservations: reservations.map(row => ({ ...row, actionLabel: "Voir" })), categoryControls, settings, savings, defaultPurpose,
    resourceInputs: { openingBalance: inputs.openingBalance, wallets: inputs.benefitWallets!, projections: scenario.benefitWallets },
    reliability: { mode: forecastTemporalPolicy().mode, modeLabel: forecastTemporalPolicy().mode === "FULL_MONTH_SAFE" ? "Mode prudent actif" : "Estimation au fil du mois active",
      modeExplanation: forecastTemporalPolicy().mode === "FULL_MONTH_SAFE" ? "L’absence de dépenses récentes ne réduit pas automatiquement les habitudes prévues du mois." : "Les estimations utilisent le moteur temporel actif, avec les données disponibles à cette date.",
      importsMissing: plan?.narrative.prediction?.currentImportsMissing ?? null, computedAt: ctx.forecast.meta.computedAt,
      publicationId: ctx.forecast.meta.sourcePublicationId, revision: ctx.forecast.meta.analyticsRevision,
      checkpoints: comparableForecastCheckpoints(ctx.forecast.forecastMemory ?? [], scenario.targetMonth).map(row => ({ date: row.as_of_date, central: row.payload.final.central })),
      calibrationAvailable: !!ctx.forecast.predictionEvidence && Object.keys(ctx.forecast.calibration ?? calibrateForecast(ctx.forecast.forecastMemory ?? [], ctx.forecast.predictionEvidence, ctx.asOf)).length > 0,
      change: decision?.change ?? null }, destinations: { bank: resources("BANK"), SWILE: resources("SWILE"), EDENRED: resources("EDENRED") } };
}
export type MonthControlCenterModel = ReturnType<typeof projectMonthControlCenter>;

/** Preview, purpose and recommendations are ephemeral projections. */
export function projectMonthControlWorkbench(ctx: MonthChoiceContext, rawPurpose: unknown, rawOperations: unknown) {
  const purpose = parseMonthControlPurpose(rawPurpose), operations = parseMonthControlDraft(rawOperations);
  const current = projectMonthControlCenter(ctx);
  const replay = operations.length ? simulateMonthChoice(ctx, { operations }) : null;
  const scenarioCtx = replay ? { ...ctx, inputs: replay.nextInputs } : ctx;
  const scenario = replay ? projectMonthControlCenter(scenarioCtx) : current;
  const categoryKey = "categoryKey" in purpose ? purpose.categoryKey : null;
  const baselineCategory = categoryKey ? current.categoryControls.find(row => row.key === categoryKey) : null;
  if (categoryKey && !baselineCategory?.target) throw new TypeError("MONTH_CONTROL_CATEGORY_TARGET_MISSING");
  if (purpose.kind === "GLOBAL_GOAL" && current.settings.goal === null) throw new TypeError("MONTH_CONTROL_GLOBAL_GOAL_MISSING");
  const scenarioCategory = categoryKey ? scenario.categoryControls.find(row => row.key === categoryKey) : null;
  const gain = replay?.view.delta ?? "0.00";
  const remainingNeed = purpose.kind === "GLOBAL_GOAL" ? scenario.projectionSummary.globalGap
    : purpose.kind === "CATEGORY_CORRECTION" ? positive(new Big(scenarioCategory!.varianceToTarget ?? 0)).toFixed(2)
    : purpose.kind === "CATEGORY_OVERAGE_OFFSET" ? positive(new Big(baselineCategory!.varianceToTarget ?? 0).minus(positive(new Big(gain)))).toFixed(2) : "0.00";
  const resolved = purpose.kind !== "NONE" && purpose.kind !== "FREE_EXPLORATION" && new Big(remainingNeed).eq(0);
  const offerContext = purpose.kind === "CATEGORY_CORRECTION" && scenarioCategory?.status === "ALREADY_OVER_TARGET" ? "Limiter le reste du mois, sans effacer le réel"
    : purpose.kind === "CATEGORY_CORRECTION" ? `Pour rapprocher ${baselineCategory!.label} de son objectif`
    : purpose.kind === "CATEGORY_OVERAGE_OFFSET" ? `Pour retrouver de la marge ailleurs ; ${baselineCategory!.label} conserve son propre écart`
    : purpose.kind === "GLOBAL_GOAL" ? "Pour atteindre votre objectif de fin de mois" : "Exploration libre, sans ajustement requis";
  const offers = purpose.kind === "NONE" || resolved || operations.length >= 2 || !current.editable ? []
    : proposeMonthChoices(scenarioCtx, { gap: remainingNeed, onlyCategory: purpose.kind === "CATEGORY_CORRECTION" ? categoryKey! : undefined,
      excludeTargets: operations.map(monthChoiceTarget), allowCombination: false }).map(offer => ({ ...offer, purpose, reason: offerContext,
        operation: offer.preview.choice.operations[0]!,
        remainingNeedAfter: purpose.kind === "FREE_EXPLORATION" ? null : purpose.kind === "CATEGORY_CORRECTION"
          ? positive(new Big(offer.preview.categoryImpacts.find(row => row.key === categoryKey)?.after ?? scenarioCategory!.forecast).minus(baselineCategory!.target!)).toFixed(2)
          : positive(new Big(remainingNeed).minus(positive(new Big(offer.preview.delta)))).toFixed(2) }));
  // Alternative UX intensities reuse the exact same operation parser and replay owner.
  const shortcuts = purpose.kind === "NONE" || resolved || operations.length >= 2 || !current.editable || !scenario.projectionSummary.economic ? []
    : scenario.categoryControls.filter(row => row.capabilities.adjustability === "ADJUSTABLE" && new Big(row.reducibleRemaining).gt(0)
      && !operations.some(op => monthChoiceTarget(op) === `category:${row.key}`)
      && (purpose.kind !== "CATEGORY_CORRECTION" || row.key === categoryKey))
      .flatMap(row => monthControlCategoryPresets(row.key, row.label, row.capabilities).flatMap(preset => {
        try { const preview = simulateMonthChoice(scenarioCtx, { operations: [preset.operation] }).view;
          return new Big(preview.delta).gt(0) ? [{ ...preset, categoryKey: row.key, categoryLabel: row.label, preview }] : []; }
        catch (error) { if (error instanceof TypeError && error.message === "MONTH_CHOICE_OCCURRENCE_UNAVAILABLE") return []; throw error; }
      }));
  const selected = operations.map(op => ({ operation: op, target: monthChoiceTarget(op),
    label: op.kind === "CATEGORY" ? current.categoryControls.find(row => row.key === op.categoryKey)!.label : current.savings.find(row => row.id === op.savingsId)!.label,
    before: op.kind === "CATEGORY" ? current.categoryControls.find(row => row.key === op.categoryKey)!.reducibleRemaining : current.savings.find(row => row.id === op.savingsId)!.amount,
    after: op.kind === "CATEGORY" ? scenario.categoryControls.find(row => row.key === op.categoryKey)!.reducibleRemaining : scenario.savings.find(row => row.id === op.savingsId)!.amount }));
  return { consequenceNature: "CONSEQUENCE" as const, model: current, scenario, purpose, operations, selected, baseDigest: current.baseDigest, preview: replay?.view ?? null,
    remainingNeed, resolved, offers, shortcuts, offerContext, canAdd: operations.length < 2, applicable: replay?.view.applicable ?? false,
    budgetMarginGain: gain, spendingReduction: replay?.view.spendingReduction ?? "0.00", reservationRelease: replay?.view.reservationRelease ?? "0.00" };
}
