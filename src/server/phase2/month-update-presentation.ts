import "server-only";
import Big from "big.js";
import type { MonthScenario } from "./month-scenario";
import type { MonthForecastSnapshot } from "./month-forecast-snapshot";
import type { MonthUpdateData } from "./month-update-types";
import { classifyMonthUpdateItem as classify, groupMonthUpdateItems, type MonthUpdateItem } from "@/domain/phase2/month-update-status";
import { controlObligationLabel, controlResourceLabel } from "@/domain/phase2/month-control-display";

/** Presentation over the scenario's authorities; no projection arithmetic. */
export function projectMonthUpdatePresentation(forecast: MonthForecastSnapshot, scenario: MonthScenario) {
  const inputs = scenario.inputs, plan = scenario.economicPlan;
  const resources = plan?.resources.filter(row => row.pocket === "BANK_CASH") ?? forecast.income.components.filter(row => row.central !== null).map(row => ({ key: row.key, label: row.label, amount: inputs.resourceOverrides[row.key] ?? row.central!, sourceAmount: row.central, provenance: inputs.resourceOverrides[row.key] !== undefined ? "MONTH_OVERRIDE" : "SNAPSHOT" }));
  const obligations = forecast.components.filter(row => row.key.startsWith("obligation:") && (row.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(row.label) || row.nature === "CONTRACTUAL_EXPECTED" && row.additiveGroup === "obligations" && row.central !== null))
    .map(row => ({ key: row.key, label: controlObligationLabel(row.label), amount: row.central, conditional: row.knowledgeState === "CONDITIONAL_UNKNOWN" }));
  const data: MonthUpdateData = { resources, obligations, inputs: { openingBalance: inputs.openingBalance, resourceOverrides: inputs.resourceOverrides, confirmedObligations: inputs.confirmedObligations, declinedConditionalObligations: inputs.declinedConditionalObligations, excludedFixedObligations: inputs.excludedFixedObligations, fixedAmountOverrides: inputs.fixedAmountOverrides }, bank: plan?.bankCash ?? null, funding: plan?.plannedFunding ?? null };
  const bankMissing = scenario.availableNow.value === null;
  const items: MonthUpdateItem[] = [{ id: "BANK", label: "Banque", status: classify({ needsUpdate: bankMissing, explicitlyConfirmed: !bankMissing && !!inputs.openingBalance }), summary: bankMissing ? "Solde actuel à renseigner" : "Solde daté renseigné", amount: inputs.openingBalance?.amount ?? plan?.bankCash.currentRealBankBalance.amount ?? null, date: inputs.openingBalance?.asOfDate ?? null, priority: 100, focus: "BANK", sourceKind: "BANK", provenance: inputs.openingBalance ? "USER_OBSERVATION" : "BANK_AUTHORITY" }];
  for (const provider of ["SWILE", "EDENRED"] as const) {
    const wallet = scenario.benefitWallets[provider], declared = inputs.benefitWallets![provider];
    const missing = wallet.currentBalanceKnowledge.amount === null || !wallet.expectedLoading || wallet.limitations.includes("BENEFIT_LOADING_DATE_UNKNOWN");
    items.push({ id: provider, label: provider === "SWILE" ? "Swile" : "Edenred", status: classify({ needsUpdate: missing, explicitlyConfirmed: !missing && declared.balanceObservations.length > 0 }), summary: missing ? wallet.currentBalanceKnowledge.amount === null ? "Solde actuel à renseigner" : "Chargement ou date à préciser" : "Solde et chargement datés", amount: wallet.currentBalanceKnowledge.amount, date: wallet.latestObservation?.asOfDate ?? null, priority: provider === "SWILE" ? 95 : 94, focus: provider, sourceKind: "WALLET", provenance: declared.balanceObservations.length ? "USER_OBSERVATION" : "WALLET_AUTHORITY" });
  }
  for (const row of resources) {
    const explicit = inputs.resourceOverrides[row.key] !== undefined;
    const different = explicit && (row.sourceAmount === null || !new Big(row.amount).eq(row.sourceAmount));
    items.push({ id: row.key, label: controlResourceLabel(row.label), status: classify({ modified: different, explicitlyConfirmed: explicit && !different }), summary: different ? "Montant différent ce mois" : explicit ? "Montant attendu confirmé" : "Prévision habituelle, non confirmée", amount: row.amount, beforeAmount: row.sourceAmount, date: null, priority: 85, focus: `resource-${row.key.replace(/[^a-zA-Z0-9:-]/gu, "-")}`, sourceKind: "INCOME", provenance: row.provenance });
  }
  for (const row of obligations) {
    const confirmation = inputs.confirmedObligations.find(item => item.componentKey === row.key), override = inputs.fixedAmountOverrides[row.key];
    const disabled = row.conditional ? inputs.declinedConditionalObligations.includes(row.key) : inputs.excludedFixedObligations.includes(row.key);
    const modified = row.conditional ? !!confirmation : !!override && (override.dueDate !== null || row.amount === null || !new Big(override.amount).eq(row.amount));
    const status = classify({ needsUpdate: row.conditional && !confirmation && !disabled, disabled, modified, explicitlyConfirmed: !row.conditional && !!override && !modified });
    items.push({ id: row.key, label: row.label, status, summary: status === "DISABLED" ? "Désactivé pour ce mois" : status === "MODIFIED" ? row.conditional ? "Présence confirmée pour ce mois" : "Montant ou date différents ce mois" : status === "CONFIRMED" ? "Montant attendu confirmé" : row.conditional ? "Est-ce prévu ce mois-ci ?" : "Prévision habituelle, non confirmée", beforeAmount: row.conditional ? null : row.amount, amount: disabled ? null : confirmation?.amount ?? override?.amount ?? row.amount, date: confirmation?.dueDate ?? override?.dueDate ?? null, priority: row.conditional ? 70 : 20, focus: row.key, sourceKind: row.conditional ? "CONDITIONAL" : "FIXED", provenance: disabled ? "MONTH_EXCLUSION" : confirmation ? "MONTH_CONFIRMATION" : override ? "MONTH_OVERRIDE" : "SNAPSHOT" });
  }
  return { items, ...groupMonthUpdateItems(items), data };
}
