"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Plus, X } from "lucide-react";
import {
  createTaxonomySubcategory,
  linkRefundOperation,
  updateOperation,
  type OperationUpdateInput,
} from "@/app/operations/actions";
import type {
  CategoryDefinition,
  Operation,
  OperationAllocation,
  ResourceType,
} from "@/domain/budget";
import {
  getDataQualityCounts,
  isRentExpense,
} from "@/domain/data-quality";
import { isConsumptionExpense } from "@/domain/calculations";
import { formatCurrency, formatDate } from "@/lib/format";

const resourceTypes: ResourceType[] = [
  "Revenu",
  "Entrée d'argent",
  "Remboursement",
  "Transfert interne",
  "Flux technique",
];

function updateInput(
  operation: Operation,
  changes: Partial<OperationUpdateInput>,
): OperationUpdateInput {
  return {
    date: operation.date,
    amount: operation.amount,
    normalizedMerchant:
      operation.normalizedMerchant === "Non renseigné"
        ? null
        : operation.normalizedMerchant,
    flow: operation.flow,
    category: operation.category === "Non renseigné" ? null : operation.category,
    subcategory:
      operation.subcategory === "Non renseigné" ? null : operation.subcategory,
    preciseType: operation.preciseType,
    recurrence: operation.recurrence,
    importance: operation.importance,
    status: operation.status,
    note: operation.note,
    event: operation.event,
    eventDetail: operation.eventDetail ?? null,
    spendingContext: operation.spendingContext ?? null,
    lifeContext: operation.lifeContext ?? null,
    momentId: operation.momentId ?? null,
    resourceType: operation.resourceType ?? null,
    resourceContext: operation.resourceContext ?? null,
    analysisMonthOverride: operation.analysisMonthOverride ?? null,
    reimbursesOperationId: operation.reimbursesOperationId ?? null,
    uncertain: operation.uncertain,
    ...changes,
  };
}

type Draft = {
  event: string;
  detail: string;
  family: string;
  subcategory: string;
  newSubcategory: string;
  addingSubcategory: boolean;
};

export function DataQualityCenter({
  operations,
  categories,
  allocations,
  initialOpen = false,
  initialAssociationSuccess = false,
}: {
  operations: Operation[];
  categories: CategoryDefinition[];
  allocations: OperationAllocation[];
  initialOpen?: boolean;
  initialAssociationSuccess?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    initialAssociationSuccess ? "Le remboursement a bien été associé à la dépense." : null,
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const { workflow, correctionCount, enrichmentCount } = getDataQualityCounts(operations, allocations);
  const knownEvents = [...new Set(operations.map((operation) => operation.event).filter(Boolean))]
    .map(String)
    .sort((a, b) => a.localeCompare(b, "fr"));

  async function save(
    operation: Operation,
    changes: Partial<OperationUpdateInput>,
  ) {
    setSavingId(operation.id);
    setError(null);
    try {
      await updateOperation(operation.id, updateInput(operation, changes));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La modification a échoué.");
    } finally {
      setSavingId(null);
    }
  }

  async function createSubcategory(operation: Operation, draft: Draft) {
    setSavingId(operation.id);
    setError(null);
    try {
      const name = await createTaxonomySubcategory(
        draft.family,
        draft.newSubcategory,
      );
      await updateOperation(
        operation.id,
        updateInput(operation, {
          category: draft.family,
          subcategory: name,
          preciseType: null,
        }),
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La catégorie n’a pas pu être créée.");
    } finally {
      setSavingId(null);
    }
  }

  async function linkRefund(refundId: string, expenseId: string) {
    setSavingId(refundId);
    setError(null);
    setSuccess(null);
    try {
      const result = await linkRefundOperation(refundId, expenseId);
      if (!result.ok) throw new Error(result.error);
      setSuccess("Le remboursement a bien été associé à la dépense.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le remboursement n’a pas pu être rattaché.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <button type="button" className="button-secondary" onClick={() => setOpen(true)}>
        <CircleAlert size={17} /> À compléter
        <span className="ml-1 flex min-w-6 items-center justify-center rounded-full bg-[#bd4f45] px-1.5 py-0.5 text-xs font-black text-white">
          {correctionCount}
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[#24322f]/55 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Informations à compléter"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-canvas)] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-4 sm:px-6">
              <div>
                <p className="eyebrow">Qualité des données</p>
                <h2 className="text-xl font-black">À corriger · {correctionCount}</h2>
                <p className="text-sm text-[var(--color-muted)]">À enrichir · {enrichmentCount}</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Corrigez les informations qui influencent réellement l’analyse.
                </p>
              </div>
              <button type="button" className="button-secondary px-3" onClick={() => setOpen(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 p-4 sm:p-6">
              {success ? <p className="rounded-xl bg-[#dce8e3] p-3 text-sm font-bold text-[var(--color-primary-deep)]">{success}</p> : null}
              {error ? <p className="rounded-xl bg-[#f7dfda] p-3 text-sm font-bold text-[#9a463c]">{error}</p> : null}
              {!workflow.length ? (
                <div className="card p-8 text-center">
                  <p className="font-black">Aucune intervention nécessaire.</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">Les calculs disposent des informations indispensables.</p>
                </div>
              ) : null}
              {workflow.map(({ operation, issues }) => {
                const draft = drafts[operation.id] ?? {
                  event: operation.event ?? "",
                  detail: operation.eventDetail ?? "",
                  family: operation.category === "Non renseigné" ? "" : operation.category,
                  subcategory: operation.subcategory === "Non renseigné" ? "" : operation.subcategory,
                  newSubcategory: "",
                  addingSubcategory: false,
                };
                const selectedFamily = categories.find((category) => category.name === draft.family);
                const eventDetails = [...new Set(
                  operations
                    .filter((entry) => !draft.event || entry.event === draft.event)
                    .map((entry) => entry.eventDetail)
                    .filter(Boolean),
                )].map(String).sort((a, b) => a.localeCompare(b, "fr"));
                const candidates = operations
                  .filter((entry) => isConsumptionExpense(entry) && !isRentExpense(entry))
                  .sort((a, b) =>
                    Math.abs(Math.abs(a.amount) - operation.amount) -
                    Math.abs(Math.abs(b.amount) - operation.amount),
                  )
                  .slice(0, 5);
                const setDraft = (patch: Partial<Draft>) =>
                  setDrafts((values) => ({ ...values, [operation.id]: { ...draft, ...patch } }));
                return (
                  <article key={operation.id} className="card p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black">{operation.label}</p>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">
                          {formatDate(operation.date)} · {operation.sourceLabel} · {operation.category}
                        </p>
                      </div>
                      <p className={`text-lg font-black ${operation.amount >= 0 ? "positive" : "negative"}`}>
                        {formatCurrency(operation.amount, true)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {issues.map((issue) => (
                        <span key={issue.kind} className="badge" data-tone={issue.level === "correction" ? "warning" : undefined}>
                          {issue.label}
                        </span>
                      ))}
                    </div>

                    {issues.some((issue) => issue.kind === "resource_type") ? (
                      <label className="mt-4 block text-xs font-bold text-[var(--color-muted)]">
                        Type d’entrée
                        <select className="field mt-1 w-full text-sm" defaultValue="" disabled={savingId === operation.id} onChange={(event) => {
                          const value = event.target.value as ResourceType;
                          if (value) save(operation, { resourceType: value });
                        }}>
                          <option value="" disabled>Choisir</option>
                          {resourceTypes.map((value) => <option key={value}>{value}</option>)}
                        </select>
                      </label>
                    ) : null}

                    {issues.some((issue) => issue.kind === "refund_link") ? (
                      <div className="mt-4 rounded-xl bg-[var(--color-surface-soft)] p-3">
                        <p className="text-xs font-bold text-[var(--color-muted)]">Associer une dépense</p>
                        <div className="mt-2 space-y-1.5">
                          {candidates.map((candidate) => (
                            <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                              <span className="min-w-0 truncate">{formatDate(candidate.date)} · {candidate.label} · {formatCurrency(Math.abs(candidate.amount))}</span>
                              <button type="button" className="button-secondary shrink-0 px-3 py-1.5 text-xs" disabled={savingId === operation.id} onClick={() => linkRefund(operation.id, candidate.id)}>Associer</button>
                            </div>
                          ))}
                        </div>
                        <Link
                          href={`/operations?selectForRefund=${encodeURIComponent(operation.id)}&month=${encodeURIComponent(operation.importMonth)}&returnTo=${encodeURIComponent("/?complete=1")}`}
                          className="button-ghost mt-2 text-sm"
                        >
                          Explorer les dépenses
                        </Link>
                      </div>
                    ) : null}

                    {issues.some((issue) => issue.kind === "category") ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-bold text-[var(--color-muted)]">Famille
                          <select className="field mt-1 w-full text-sm" value={draft.family} onChange={(event) => setDraft({ family: event.target.value, subcategory: "" })}>
                            <option value="">Choisir</option>
                            {categories.map((category) => <option key={category.slug}>{category.name}</option>)}
                          </select>
                        </label>
                        {draft.family ? <label className="text-xs font-bold text-[var(--color-muted)]">Catégorie
                          <select className="field mt-1 w-full text-sm" value={draft.subcategory} onChange={(event) => {
                            const value = event.target.value;
                            if (value === "__add") setDraft({ addingSubcategory: true, subcategory: "" });
                            else setDraft({ subcategory: value, addingSubcategory: false });
                          }}>
                            <option value="">Sans catégorie détaillée</option>
                            {selectedFamily?.subcategories.map((value) => <option key={value}>{value}</option>)}
                            <option value="__add">+ Ajouter une catégorie</option>
                          </select>
                        </label> : null}
                        {draft.addingSubcategory ? (
                          <div className="sm:col-span-2 flex gap-2">
                            <input className="field flex-1 text-sm" value={draft.newSubcategory} placeholder="Nouvelle catégorie" onChange={(event) => setDraft({ newSubcategory: event.target.value })} />
                            <button type="button" className="button-secondary" disabled={!draft.newSubcategory.trim() || savingId === operation.id} onClick={() => createSubcategory(operation, draft)}><Plus size={15} /> Créer et choisir</button>
                          </div>
                        ) : (
                          <button type="button" className="button-primary sm:col-span-2" disabled={!draft.family || savingId === operation.id} onClick={() => save(operation, { category: draft.family, subcategory: draft.subcategory || null, preciseType: null })}>Enregistrer la catégorie</button>
                        )}
                      </div>
                    ) : null}

                    {issues.some((issue) => issue.kind === "spending_context" || issue.kind === "event") ? (
                      <div className="mt-4 rounded-xl bg-[var(--color-surface-soft)] p-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="button-secondary text-sm" disabled={savingId === operation.id} onClick={() => save(operation, { spendingContext: "Vie courante", event: null, eventDetail: null })}>Vie courante</button>
                          <span className="badge">ou Événement</span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <label className="text-xs font-bold text-[var(--color-muted)]">Événement
                            <input className="field mt-1 w-full text-sm" list="quality-events" value={draft.event} placeholder="Voyage, Soirée…" onChange={(event) => setDraft({ event: event.target.value, detail: "" })} />
                          </label>
                          <label className="text-xs font-bold text-[var(--color-muted)]">Spécification
                            <input className="field mt-1 w-full text-sm" list={`quality-event-details-${operation.id}`} value={draft.detail} placeholder="Minorque, anniversaire…" onChange={(event) => setDraft({ detail: event.target.value })} />
                          </label>
                          <button type="button" className="button-primary self-end text-sm" disabled={!draft.event.trim() || savingId === operation.id} onClick={() => save(operation, { spendingContext: "Événement", event: draft.event.trim(), eventDetail: draft.detail.trim() || null })}>Enregistrer</button>
                        </div>
                        <p className="mt-2 text-xs text-[var(--color-muted)]">+ Ajouter : saisissez librement une nouvelle valeur ; elle sera ensuite proposée depuis les données existantes.</p>
                        <datalist id={`quality-event-details-${operation.id}`}>{eventDetails.map((value) => <option key={value} value={value} />)}</datalist>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              <datalist id="quality-events">{knownEvents.map((value) => <option key={value} value={value} />)}</datalist>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

