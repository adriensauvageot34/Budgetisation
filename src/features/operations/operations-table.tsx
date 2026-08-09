"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CornerUpLeft,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  deleteOperation,
  updateOperation,
  type OperationUpdateInput,
} from "@/app/operations/actions";
import type {
  Account,
  AnalyticalStatus,
  CategoryDefinition,
  FlowType,
  Importance,
  MonthKey,
  Operation,
  Person,
  Recurrence,
  ResourceType,
  SpendingContext,
} from "@/domain/budget";
import {
  applyInflowAnalysis,
  operationAnalysisMonth,
} from "@/domain/inflow-analysis";
import { isConsumptionExpense } from "@/domain/calculations";
import { getSpendingContext } from "@/domain/spending-context";
import {
  formatCurrency,
  formatDate,
  formatMonth,
} from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

type ViewMode = "Compacte" | "Standard" | "Complète";
type SortKey = "date" | "label" | "amount" | "category" | "accountId";
type SortDirection = "asc" | "desc";
type PanelMode = "read" | "edit" | "delete";

type ExpenseScope = "all" | "current" | "events" | "unconfirmed";

export type OperationsInitialFilters = {
  month?: MonthKey;
  startMonth?: MonthKey;
  endMonth?: MonthKey;
  category?: string;
  subcategory?: string;
  person?: Person;
  accountId?: string;
  importance?: Importance;
  recurrence?: Recurrence;
  status?: AnalyticalStatus;
  event?: string;
  eventDetail?: string;
  scope?: ExpenseScope;
};

type OperationDraft = {
  date: string;
  amount: string;
  normalizedMerchant: string;
  flow: FlowType;
  category: string;
  subcategory: string;
  preciseType: string;
  recurrence: Recurrence | "";
  importance: Importance | "";
  status: AnalyticalStatus;
  note: string;
  event: string;
  eventDetail: string;
  spendingContext: SpendingContext | "";
  resourceType: ResourceType | "";
  resourceContext: string;
  analysisMonthOverride: MonthKey | "";
  reimbursesOperationId: string;
  uncertain: boolean;
};

const pageSize = 50;
const flowOptions: FlowType[] = [
  "Dépense",
  "Revenu",
  "Remboursement",
  "Transfert interne",
  "Prêt et avance",
  "Flux technique",
];
const importanceOptions: Importance[] = [
  "Indispensable",
  "Contrainte",
  "Ajustable",
  "Optionnelle",
];
const statusOptions: AnalyticalStatus[] = [
  "Habituel",
  "Exceptionnel",
  "Hors budget",
  "À ventiler",
];
const resourceTypeOptions: ResourceType[] = [
  "Revenu",
  "Entrée d'argent",
  "Remboursement",
  "Transfert interne",
  "Flux technique",
  "À qualifier",
];

function operationDraft(operation: Operation): OperationDraft {
  return {
    date: operation.date,
    amount: String(operation.amount),
    normalizedMerchant:
      operation.normalizedMerchant === "Non renseigné"
        ? ""
        : operation.normalizedMerchant,
    flow: operation.flow,
    category:
      operation.category === "Non renseigné" ? "" : operation.category,
    subcategory:
      operation.subcategory === "Non renseigné" ? "" : operation.subcategory,
    preciseType: operation.preciseType ?? "",
    recurrence: operation.recurrence ?? "",
    importance: operation.importance ?? "",
    status: operation.status,
    note: operation.note ?? "",
    event: operation.event ?? "",
    eventDetail: operation.eventDetail ?? "",
    spendingContext: operation.spendingContext ?? "",
    resourceType: operation.resourceType ?? "",
    resourceContext: operation.resourceContext ?? "",
    analysisMonthOverride: operation.analysisMonthOverride ?? "",
    reimbursesOperationId: operation.reimbursesOperationId ?? "",
    uncertain: operation.uncertain,
  };
}

function StatusBadge({ status }: { status: AnalyticalStatus }) {
  const tone =
    status === "Habituel"
      ? "positive"
      : status === "Exceptionnel" || status === "À ventiler"
        ? "warning"
        : "negative";
  return (
    <span className="badge" data-tone={tone}>
      {status}
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      className={`inline-flex w-full items-center gap-1 ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active ? (
        direction === "asc" ? (
          <ArrowUp size={13} />
        ) : (
          <ArrowDown size={13} />
        )
      ) : null}
    </button>
  );
}

export function OperationsTable({
  months,
  operations,
  categories,
  accounts,
  initialMonth,
  initialFilters = {},
  returnTo,
}: {
  months: MonthKey[];
  operations: Operation[];
  categories: CategoryDefinition[];
  accounts: Account[];
  initialMonth: MonthKey;
  initialFilters?: OperationsInitialFilters;
  returnTo?: string;
}) {
  const router = useRouter();
  const [operationRows, setOperationRows] = useState(operations);
  const [view, setView] = useState<ViewMode>("Standard");
  const [query, setQuery] = useState("");
  const hasInitialPeriod = Boolean(
    initialFilters.startMonth || initialFilters.endMonth,
  );
  const [month, setMonth] = useState<MonthKey | "Tous">(
    initialFilters.month ?? (hasInitialPeriod ? "Tous" : initialMonth),
  );
  const [startMonth, setStartMonth] = useState<MonthKey | "">(
    initialFilters.startMonth ?? "",
  );
  const [endMonth, setEndMonth] = useState<MonthKey | "">(
    initialFilters.endMonth ?? "",
  );
  const [category, setCategory] = useState(
    initialFilters.category ?? "Toutes",
  );
  const [subcategory, setSubcategory] = useState(
    initialFilters.subcategory ?? "Toutes",
  );
  const [accountId, setAccountId] = useState(initialFilters.accountId ?? "Tous");
  const [flow, setFlow] = useState<FlowType | "Tous">("Tous");
  const [person, setPerson] = useState<Person | "Toutes">(
    initialFilters.person ?? "Toutes",
  );
  const [importance, setImportance] = useState<Importance | "Toutes">(
    initialFilters.importance ?? "Toutes",
  );
  const [recurrence, setRecurrence] = useState<Recurrence | "Toutes">(
    initialFilters.recurrence ?? "Toutes",
  );
  const [status, setStatus] = useState<AnalyticalStatus | "Tous">(
    initialFilters.status ?? "Tous",
  );
  const [expenseScope, setExpenseScope] = useState<ExpenseScope>(
    initialFilters.scope ?? "all",
  );
  const [eventFilter, setEventFilter] = useState(initialFilters.event ?? "Tous");
  const [eventDetailFilter, setEventDetailFilter] = useState(
    initialFilters.eventDetail ?? "Toutes",
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(
    null,
  );
  const [panelMode, setPanelMode] = useState<PanelMode>("read");
  const [draft, setDraft] = useState<OperationDraft | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reimbursementQuery, setReimbursementQuery] = useState("");

  useEffect(() => {
    setOperationRows(operations);
  }, [operations]);

  const people = [
    ...new Set(
      operationRows
        .map((operation) => operation.person)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const events = [
    ...new Set(
      operationRows
        .map((operation) => operation.event)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const eventDetails = [
    ...new Set(
      operationRows
        .filter(
          (operation) =>
            eventFilter === "Tous" || operation.event === eventFilter,
        )
        .map((operation) => operation.eventDetail)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const subcategories = [
    ...new Set(
      operationRows
        .filter(
          (operation) =>
            category === "Toutes" || operation.category === category,
        )
        .map((operation) => operation.subcategory)
        .filter((value) => value && value !== "Non renseigné"),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
    return operationRows
      .filter(
        (operation) => {
          const contextMonth = returnTo
            ? isConsumptionExpense(operation)
              ? operation.importMonth
              : operationAnalysisMonth(operation)
            : operation.importMonth;
          return (
          (month === "Tous" || contextMonth === month) &&
          (!startMonth || contextMonth >= startMonth) &&
          (!endMonth || contextMonth <= endMonth) &&
          (category === "Toutes" || operation.category === category) &&
          (subcategory === "Toutes" || operation.subcategory === subcategory) &&
          (accountId === "Tous" || operation.accountId === accountId) &&
          (flow === "Tous" || operation.flow === flow) &&
          (person === "Toutes" || operation.person === person) &&
          (importance === "Toutes" || operation.importance === importance) &&
          (recurrence === "Toutes" || operation.recurrence === recurrence) &&
          (status === "Tous" || operation.status === status) &&
          (expenseScope === "all" ||
            (expenseScope === "current" &&
              getSpendingContext(operation) === "Vie courante") ||
            (expenseScope === "events" &&
              getSpendingContext(operation) === "Événement") ||
            (expenseScope === "unconfirmed" &&
              getSpendingContext(operation) === "À confirmer")) &&
          (eventFilter === "Tous" || operation.event === eventFilter) &&
          (eventDetailFilter === "Toutes" ||
            operation.eventDetail === eventDetailFilter) &&
          (!normalizedQuery ||
            [
              operation.label,
              operation.normalizedMerchant,
              operation.sourceLabel,
              operation.subcategory,
              operation.preciseType,
              operation.event,
              operation.eventDetail,
              operation.resourceType,
              operation.resourceContext,
            ]
              .join(" ")
              .toLocaleLowerCase("fr-FR")
              .includes(normalizedQuery))
          );
        },
      )
      .sort((a, b) => {
        const aValue =
          sortKey === "accountId"
            ? (accounts.find((account) => account.id === a.accountId)?.name ??
              a.accountId)
            : a[sortKey];
        const bValue =
          sortKey === "accountId"
            ? (accounts.find((account) => account.id === b.accountId)?.name ??
              b.accountId)
            : b[sortKey];
        const comparison =
          typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue), "fr");
        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [
    accountId,
    accounts,
    category,
    endMonth,
    eventDetailFilter,
    eventFilter,
    expenseScope,
    flow,
    importance,
    month,
    operationRows,
    person,
    query,
    recurrence,
    returnTo,
    sortDirection,
    sortKey,
    status,
    startMonth,
    subcategory,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageOperations = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  function sortBy(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "date" ? "desc" : "asc");
    }
    setPage(1);
  }

  function resetFilters() {
    setView("Standard");
    setQuery("");
    setMonth(initialFilters.month ?? (hasInitialPeriod ? "Tous" : initialMonth));
    setStartMonth(initialFilters.startMonth ?? "");
    setEndMonth(initialFilters.endMonth ?? "");
    setCategory(initialFilters.category ?? "Toutes");
    setSubcategory(initialFilters.subcategory ?? "Toutes");
    setAccountId(initialFilters.accountId ?? "Tous");
    setFlow("Tous");
    setPerson(initialFilters.person ?? "Toutes");
    setImportance(initialFilters.importance ?? "Toutes");
    setRecurrence(initialFilters.recurrence ?? "Toutes");
    setStatus(initialFilters.status ?? "Tous");
    setExpenseScope(initialFilters.scope ?? "all");
    setEventFilter(initialFilters.event ?? "Tous");
    setEventDetailFilter(initialFilters.eventDetail ?? "Toutes");
    setAdvancedOpen(false);
    setSortKey("date");
    setSortDirection("desc");
    setPage(1);
  }

  const activeAdvanced = [
    person,
    importance,
    recurrence,
    status,
    subcategory,
    startMonth,
    endMonth,
    eventFilter,
    eventDetailFilter,
    expenseScope,
  ].filter(
    (value) => value !== "Toutes" && value !== "Tous",
  ).filter((value) => value !== "" && value !== "all").length;
  const accountName = (id: string | null) =>
    accounts.find((account) => account.id === id)?.name ?? "Non renseigné";
  const activeFilterChips = [
    month !== "Tous" ? { label: formatMonth(month), clear: () => setMonth("Tous") } : null,
    startMonth ? { label: `Depuis ${formatMonth(startMonth)}`, clear: () => setStartMonth("") } : null,
    endMonth ? { label: `Jusqu’à ${formatMonth(endMonth)}`, clear: () => setEndMonth("") } : null,
    person !== "Toutes" ? { label: person, clear: () => setPerson("Toutes") } : null,
    accountId !== "Tous" ? { label: accountName(accountId), clear: () => setAccountId("Tous") } : null,
    category !== "Toutes" ? { label: category, clear: () => setCategory("Toutes") } : null,
    subcategory !== "Toutes" ? { label: subcategory, clear: () => setSubcategory("Toutes") } : null,
    importance !== "Toutes" ? { label: importance, clear: () => setImportance("Toutes") } : null,
    recurrence !== "Toutes" ? { label: recurrence, clear: () => setRecurrence("Toutes") } : null,
    status !== "Tous" ? { label: status, clear: () => setStatus("Tous") } : null,
    expenseScope !== "all" ? {
      label: expenseScope === "current" ? "Vie courante" : expenseScope === "events" ? "Événements" : "À confirmer",
      clear: () => setExpenseScope("all"),
    } : null,
    eventFilter !== "Tous" ? { label: eventFilter, clear: () => setEventFilter("Tous") } : null,
    eventDetailFilter !== "Toutes" ? { label: eventDetailFilter, clear: () => setEventDetailFilter("Toutes") } : null,
  ].filter((entry): entry is { label: string; clear: () => void } => Boolean(entry));
  const selectedDraftCategory = categories.find(
    (entry) => entry.name === draft?.category,
  );
  const draftSubcategories = selectedDraftCategory?.subcategories ?? [];
  const draftPreciseTypes = draft?.subcategory
    ? (selectedDraftCategory?.preciseTypesBySubcategory?.[
        draft.subcategory
      ] ?? [])
    : [];
  const reimbursementCandidates = useMemo(() => {
    const query = reimbursementQuery.trim().toLocaleLowerCase("fr-FR");
    return operationRows
      .filter(
        (operation) =>
          isConsumptionExpense(operation) &&
          operation.id !== selectedOperation?.id &&
          (!query ||
            [
              operation.label,
              operation.sourceLabel,
              operation.category,
              operation.event,
              operation.eventDetail,
            ]
              .join(" ")
              .toLocaleLowerCase("fr-FR")
              .includes(query)),
      )
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100);
  }, [operationRows, reimbursementQuery, selectedOperation?.id]);
  const selectedReimbursedOperation = selectedOperation?.reimbursesOperationId
    ? operationRows.find(
        (operation) => operation.id === selectedOperation.reimbursesOperationId,
      )
    : null;

  function openOperation(operation: Operation) {
    setSelectedOperation(operation);
    setDraft(operationDraft(operation));
    setPanelMode("read");
    setActionError(null);
    setReimbursementQuery("");
  }

  function closePanel() {
    if (actionPending) return;
    setSelectedOperation(null);
    setDraft(null);
    setPanelMode("read");
    setActionError(null);
    setReimbursementQuery("");
  }

  function cancelEditing() {
    if (!selectedOperation || actionPending) return;
    setDraft(operationDraft(selectedOperation));
    setPanelMode("read");
    setActionError(null);
    setReimbursementQuery("");
  }

  function updateDraft<K extends keyof OperationDraft>(
    key: K,
    value: OperationDraft[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function confirmUpdate() {
    if (!selectedOperation || !draft || actionPending) return;
    const parsedAmount = Number(draft.amount.replace(",", "."));
    if (!draft.date || !Number.isFinite(parsedAmount)) {
      setActionError("Renseignez une date et un montant valides.");
      return;
    }
    const amount =
      Math.round((parsedAmount + Number.EPSILON) * 100) / 100;

    const input: OperationUpdateInput = {
      date: draft.date,
      amount,
      normalizedMerchant: draft.normalizedMerchant || null,
      flow: draft.flow,
      category: draft.category || null,
      subcategory: draft.subcategory || null,
      preciseType: draft.preciseType || null,
      recurrence: draft.recurrence || null,
      importance: draft.importance || null,
      status: draft.status,
      note: draft.note || null,
      event: draft.event || null,
      eventDetail: draft.eventDetail || null,
      spendingContext: draft.spendingContext || null,
      resourceType: draft.resourceType || null,
      resourceContext: draft.resourceContext || null,
      analysisMonthOverride:
        amount > 0 ? draft.analysisMonthOverride || null : null,
      reimbursesOperationId:
        draft.resourceType === "Remboursement"
          ? draft.reimbursesOperationId || null
          : null,
      uncertain: draft.uncertain,
    };

    setActionPending(true);
    setActionError(null);
    try {
      await updateOperation(selectedOperation.id, input);
      const normalizedMerchant = draft.normalizedMerchant.trim();
      const updatedOperation: Operation = {
        ...selectedOperation,
        date: draft.date,
        importMonth: draft.date.slice(0, 7),
        amount,
        normalizedMerchant: normalizedMerchant || "Non renseigné",
        label: normalizedMerchant || selectedOperation.sourceLabel,
        flow: draft.flow,
        category: draft.category || "Non renseigné",
        subcategory: draft.subcategory || "Non renseigné",
        preciseType: draft.preciseType || null,
        recurrence: draft.recurrence || null,
        importance: draft.importance || null,
        status: draft.status,
        note: draft.note.trim() || null,
        event: draft.event.trim() || null,
        eventDetail: draft.eventDetail.trim() || null,
        spendingContext: draft.spendingContext || null,
        resourceType: draft.resourceType || null,
        resourceContext: draft.resourceContext.trim() || null,
        analysisMonthOverride:
          amount > 0 ? draft.analysisMonthOverride || null : null,
        analysisMonth:
          draft.analysisMonthOverride || selectedOperation.analysisMonth,
        reimbursesOperationId:
          draft.resourceType === "Remboursement"
            ? draft.reimbursesOperationId || null
            : null,
        uncertain: draft.uncertain,
      };
      const analysedRows = applyInflowAnalysis(
        operationRows.map((operation) =>
          operation.id === updatedOperation.id ? updatedOperation : operation,
        ),
      );
      const analysedOperation =
        analysedRows.find((operation) => operation.id === updatedOperation.id) ??
        updatedOperation;
      setOperationRows(analysedRows);
      setSelectedOperation(analysedOperation);
      setDraft(operationDraft(analysedOperation));
      setPanelMode("read");
      router.refresh();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "La modification a échoué.",
      );
    } finally {
      setActionPending(false);
    }
  }

  async function confirmDelete() {
    if (!selectedOperation || actionPending) return;
    setActionPending(true);
    setActionError(null);
    try {
      await deleteOperation(selectedOperation.id);
      setOperationRows((rows) =>
        rows.filter((operation) => operation.id !== selectedOperation.id),
      );
      setSelectedOperation(null);
      setDraft(null);
      setPanelMode("read");
      router.refresh();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "La suppression a échoué.",
      );
    } finally {
      setActionPending(false);
    }
  }

  const filterFields = (
    <>
      <label className="text-xs font-bold text-[var(--color-muted)]">
        Mois
        <select
          className="field mt-1 w-full capitalize text-sm"
          value={month}
          onChange={(event) => {
            setMonth(event.target.value as MonthKey | "Tous");
            setStartMonth("");
            setEndMonth("");
            setPage(1);
          }}
        >
          <option value="Tous">Tous les mois</option>
          {months.map((entry) => (
            <option key={entry} value={entry}>
              {formatMonth(entry)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-bold text-[var(--color-muted)]">
        Catégorie
        <select
          className="field mt-1 w-full text-sm"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setSubcategory("Toutes");
            setPage(1);
          }}
        >
          <option>Toutes</option>
          {categories.map((entry) => (
            <option key={entry.slug}>{entry.name}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-bold text-[var(--color-muted)]">
        Compte
        <select
          className="field mt-1 w-full text-sm"
          value={accountId}
          onChange={(event) => {
            setAccountId(event.target.value);
            setPage(1);
          }}
        >
          <option value="Tous">Tous</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-bold text-[var(--color-muted)]">
        Type de flux
        <select
          className="field mt-1 w-full text-sm"
          value={flow}
          onChange={(event) => {
            setFlow(event.target.value as FlowType | "Tous");
            setPage(1);
          }}
        >
          <option>Tous</option>
          <option>Dépense</option>
          <option>Revenu</option>
          <option>Remboursement</option>
          <option>Transfert interne</option>
          <option>Prêt et avance</option>
          <option>Flux technique</option>
        </select>
      </label>
    </>
  );

  return (
    <div>
      {returnTo ? (
        <Link
          href={returnTo}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)]"
        >
          <CornerUpLeft size={16} />
          Retour à l’analyse
        </Link>
      ) : null}
      <PageHeader
        eyebrow="Recherche détaillée"
        title="Opérations"
        description="Retrouvez une transaction, vérifiez son classement et corrigez-la si nécessaire."
        action={
          <div className="flex rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white p-1">
            {(["Compacte", "Standard", "Complète"] as ViewMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={`rounded-[0.5rem] px-3 py-2 text-xs font-extrabold transition sm:text-sm ${
                    view === mode
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)]"
                  }`}
                >
                  {mode}
                </button>
              ),
            )}
          </div>
        }
      />

      <section className="card mb-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="relative flex-1">
            <span className="text-xs font-bold text-[var(--color-muted)]">
              Recherche libre
            </span>
            <Search
              size={17}
              className="absolute bottom-[0.82rem] left-3 text-[var(--color-faint)]"
            />
            <input
              className="field mt-1 w-full pl-10"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Libellé, commerçant, sous-catégorie…"
            />
          </label>
          <button
            type="button"
            className="button-secondary lg:hidden"
            onClick={() => setMobileFiltersOpen((value) => !value)}
          >
            <Filter size={16} />
            Filtres
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setAdvancedOpen((value) => !value)}
          >
            <SlidersHorizontal size={16} />
            Filtres avancés
            {activeAdvanced ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-[0.68rem] text-white">
                {activeAdvanced}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="button-ghost"
            onClick={resetFilters}
          >
            <RotateCcw size={16} />
            Réinitialiser
          </button>
        </div>

        <div className="mt-4 hidden grid-cols-2 gap-3 lg:grid lg:grid-cols-4">
          {filterFields}
        </div>

        {mobileFiltersOpen ? (
          <div className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2 lg:hidden">
            {filterFields}
          </div>
        ) : null}

        {advancedOpen ? (
          <div className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Du mois
              <select
                className="field mt-1 w-full capitalize text-sm"
                value={startMonth}
                onChange={(event) => {
                  setStartMonth(event.target.value as MonthKey | "");
                  setMonth("Tous");
                  setPage(1);
                }}
              >
                <option value="">Non limité</option>
                {months.map((entry) => (
                  <option key={entry} value={entry}>{formatMonth(entry)}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Au mois
              <select
                className="field mt-1 w-full capitalize text-sm"
                value={endMonth}
                onChange={(event) => {
                  setEndMonth(event.target.value as MonthKey | "");
                  setMonth("Tous");
                  setPage(1);
                }}
              >
                <option value="">Non limité</option>
                {months.map((entry) => (
                  <option key={entry} value={entry}>{formatMonth(entry)}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Personne
              <select
                className="field mt-1 w-full text-sm"
                value={person}
                onChange={(event) => {
                  setPerson(event.target.value as Person | "Toutes");
                  setPage(1);
                }}
              >
                <option>Toutes</option>
                {people.map((entry) => (
                  <option key={entry}>{entry}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Sous-catégorie
              <select
                className="field mt-1 w-full text-sm"
                value={subcategory}
                onChange={(event) => {
                  setSubcategory(event.target.value);
                  setPage(1);
                }}
              >
                <option>Toutes</option>
                {subcategories.map((entry) => <option key={entry}>{entry}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Importance
              <select
                className="field mt-1 w-full text-sm"
                value={importance}
                onChange={(event) => {
                  setImportance(event.target.value as Importance | "Toutes");
                  setPage(1);
                }}
              >
                <option>Toutes</option>
                <option>Indispensable</option>
                <option>Contrainte</option>
                <option>Ajustable</option>
                <option>Optionnelle</option>
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Nature
              <select
                className="field mt-1 w-full text-sm"
                value={recurrence}
                onChange={(event) => {
                  setRecurrence(event.target.value as Recurrence | "Toutes");
                  setPage(1);
                }}
              >
                <option>Toutes</option>
                <option>Fixe</option>
                <option>Variable</option>
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Statut analytique
              <select
                className="field mt-1 w-full text-sm"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as AnalyticalStatus | "Tous");
                  setPage(1);
                }}
              >
                <option>Tous</option>
                <option>Habituel</option>
                <option>Exceptionnel</option>
                <option>Hors budget</option>
                <option>À ventiler</option>
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Contexte
              <select
                className="field mt-1 w-full text-sm"
                value={expenseScope}
                onChange={(event) => {
                  setExpenseScope(event.target.value as ExpenseScope);
                  setPage(1);
                }}
              >
                <option value="all">Toutes les dépenses</option>
                <option value="current">Vie courante</option>
                <option value="events">Événements</option>
                <option value="unconfirmed">À confirmer</option>
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Événement
              <select
                className="field mt-1 w-full text-sm"
                value={eventFilter}
                onChange={(event) => {
                  setEventFilter(event.target.value);
                  setEventDetailFilter("Toutes");
                  setPage(1);
                }}
              >
                <option>Tous</option>
                {events.map((entry) => <option key={entry}>{entry}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--color-muted)]">
              Détail événement
              <select
                className="field mt-1 w-full text-sm"
                value={eventDetailFilter}
                onChange={(event) => {
                  setEventDetailFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option>Toutes</option>
                {eventDetails.map((entry) => <option key={entry}>{entry}</option>)}
              </select>
            </label>
          </div>
        ) : null}

        {activeFilterChips.length ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
            {activeFilterChips.map((entry) => (
              <button
                key={entry.label}
                type="button"
                className="badge transition hover:text-[var(--color-ink)]"
                onClick={() => {
                  entry.clear();
                  setPage(1);
                }}
              >
                {entry.label} <X size={12} />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-muted)]">
          <span className="font-black text-[var(--color-ink)]">
            {filtered.length}
          </span>{" "}
          résultat{filtered.length > 1 ? "s" : ""} · vue{" "}
          <span className="font-bold lowercase">{view}</span>
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          Cliquez sur une opération pour consulter ou modifier son détail
        </p>
      </div>

      <section className="table-shell hidden md:block">
        <div className="overflow-x-auto">
          <table
            className={`data-table ${
              view === "Complète" ? "min-w-[1400px]" : "min-w-[780px]"
            }`}
          >
            <thead>
              <tr>
                <th className="w-[132px]">
                  <SortHeader
                    label="Date"
                    sortKey="date"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={sortBy}
                  />
                </th>
                <th>
                  <SortHeader
                    label="Libellé"
                    sortKey="label"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={sortBy}
                  />
                </th>
                <th className="w-[130px] text-right">
                  <SortHeader
                    label="Montant"
                    sortKey="amount"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={sortBy}
                    align="right"
                  />
                </th>
                {view !== "Compacte" ? (
                  <>
                    <th>
                      <SortHeader
                        label="Catégorie"
                        sortKey="category"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onSort={sortBy}
                      />
                    </th>
                    <th>
                      <SortHeader
                        label="Compte"
                        sortKey="accountId"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onSort={sortBy}
                      />
                    </th>
                  </>
                ) : null}
                {view === "Complète" ? (
                  <>
                    <th>Sous-catégorie</th>
                    <th>Type précis</th>
                    <th>Importance</th>
                    <th>Nature</th>
                    <th>Statut</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {pageOperations.map((operation) => (
                <tr
                  key={operation.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => openOperation(operation)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openOperation(operation);
                    }
                  }}
                >
                  <td className="whitespace-nowrap">
                    {formatDate(operation.date)}
                  </td>
                  <td>
                    <p className="font-extrabold">{operation.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {operation.normalizedMerchant} · {operation.person ?? "Non renseigné"}
                    </p>
                  </td>
                  <td
                    className={`whitespace-nowrap text-right font-black ${
                      operation.amount >= 0 ? "positive" : "negative"
                    }`}
                  >
                    {operation.amount > 0 ? "+" : ""}
                    {formatCurrency(operation.amount, true)}
                  </td>
                  {view !== "Compacte" ? (
                    <>
                      <td>{operation.category}</td>
                      <td>{accountName(operation.accountId)}</td>
                    </>
                  ) : null}
                  {view === "Complète" ? (
                    <>
                      <td>{operation.subcategory}</td>
                      <td>{operation.preciseType ?? "Non renseigné"}</td>
                      <td>{operation.importance ?? "Non renseigné"}</td>
                      <td>{operation.recurrence ?? "Non renseigné"}</td>
                      <td>
                        <StatusBadge status={operation.status} />
                      </td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 md:hidden">
        {pageOperations.map((operation) => (
          <button
            key={operation.id}
            type="button"
            onClick={() => openOperation(operation)}
            className="card w-full p-4 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-extrabold">{operation.label}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {formatDate(operation.date)} · {operation.person ?? "Non renseigné"}
                </p>
              </div>
              <p
                className={`shrink-0 font-black ${
                  operation.amount >= 0 ? "positive" : "negative"
                }`}
              >
                {operation.amount > 0 ? "+" : ""}
                {formatCurrency(operation.amount, true)}
              </p>
            </div>
            {view !== "Compacte" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge">{operation.category}</span>
                <span className="badge">{accountName(operation.accountId)}</span>
                {view === "Complète" ? (
                  <StatusBadge status={operation.status} />
                ) : null}
              </div>
            ) : null}
          </button>
        ))}
      </section>

      {!pageOperations.length ? (
        <div className="card p-10 text-center">
          <p className="font-black">Aucune opération ne correspond aux filtres.</p>
          <button
            type="button"
            className="button-secondary mt-4"
            onClick={resetFilters}
          >
            <RotateCcw size={16} />
            Revenir à la vue initiale
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-muted)]">
          Page {safePage} sur {totalPages} · 50 opérations par page
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="button-secondary min-h-10 px-3"
            disabled={safePage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            aria-label="Page précédente"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            className="button-secondary min-h-10 px-3"
            disabled={safePage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            aria-label="Page suivante"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      {selectedOperation ? (
        <div
          className="fixed inset-0 z-50 bg-[#1d2927]/35"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePanel();
          }}
        >
          <aside
            className="absolute inset-y-0 right-0 w-full max-w-[520px] overflow-y-auto bg-white p-5 shadow-2xl sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-label={`Détail de ${selectedOperation.label}`}
          >
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow mb-2">
                  {panelMode === "read"
                    ? "Détail consultatif"
                    : panelMode === "edit"
                      ? "Modifier l’opération"
                      : "Confirmer la suppression"}
                </p>
                <h2 className="text-2xl font-black tracking-[-0.035em]">
                  {selectedOperation.label}
                </h2>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  {formatDate(selectedOperation.date)} ·{" "}
                  {selectedOperation.normalizedMerchant}
                </p>
              </div>
              <button
                type="button"
                className="button-secondary min-h-10 shrink-0 px-3"
                onClick={closePanel}
                aria-label="Fermer"
              >
                <X size={17} />
              </button>
            </div>

            {panelMode === "read" ? (
              <>
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-primary)] p-5 text-white">
              <p className="text-sm font-bold text-white/65">Montant</p>
              <p className="mt-1 text-4xl font-black tracking-[-0.05em]">
                {selectedOperation.amount > 0 ? "+" : ""}
                {formatCurrency(selectedOperation.amount, true)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold">
                  {selectedOperation.flow}
                </span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold">
                  {selectedOperation.person ?? "Non renseigné"}
                </span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold">
                  {accountName(selectedOperation.accountId)}
                </span>
              </div>
            </div>

            <section className="mt-6">
              <p className="eyebrow mb-3">Classement analytique</p>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-4 text-sm">
                {[
                  ["Catégorie", selectedOperation.category],
                  ["Sous-catégorie", selectedOperation.subcategory],
                  ["Type précis", selectedOperation.preciseType ?? "Non renseigné"],
                  ["Importance", selectedOperation.importance ?? "Non renseigné"],
                  ["Nature", selectedOperation.recurrence ?? "Non renseigné"],
                  ["Statut", selectedOperation.status],
                  [
                    "Type de ressource",
                    selectedOperation.resourceType ?? "Non renseigné",
                  ],
                  [
                    "Mois analytique",
                    formatMonth(operationAnalysisMonth(selectedOperation)),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-bold text-[var(--color-muted)]">
                      {label}
                    </dt>
                    <dd className="mt-1 font-extrabold">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="mt-6">
              <p className="eyebrow mb-3">Données bancaires</p>
              <div className="space-y-4 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                <div>
                  <p className="text-xs font-bold text-[var(--color-muted)]">
                    Libellé bancaire d’origine
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {selectedOperation.sourceLabel}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--color-muted)]">
                    Marchand normalisé
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {selectedOperation.normalizedMerchant}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <p className="eyebrow mb-3">Traçabilité de l’import</p>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--color-muted)]">Lot d’import</span>
                  <span className="font-extrabold">
                    {selectedOperation.importId}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--color-muted)]">
                    Qualité du classement
                  </span>
                  <span
                    className="badge"
                    data-tone={selectedOperation.uncertain ? "warning" : "positive"}
                  >
                    {selectedOperation.uncertain
                      ? "À vérifier"
                      : "Classement précis"}
                  </span>
                </div>
                {selectedOperation.note ? (
                  <p className="mt-4 rounded-xl bg-[var(--color-surface-soft)] p-3 text-[var(--color-muted)]">
                    {selectedOperation.note}
                  </p>
                ) : null}
              </div>
            </section>

            {selectedOperation.event ? (
              <p className="mt-4 rounded-xl bg-[var(--color-surface-soft)] p-3 text-sm text-[var(--color-muted)]">
                Événement : {selectedOperation.event}
                {selectedOperation.eventDetail
                  ? ` · ${selectedOperation.eventDetail}`
                  : ""}
              </p>
            ) : null}

            {selectedOperation.resourceContext ? (
              <p className="mt-4 rounded-xl bg-[var(--color-surface-soft)] p-3 text-sm text-[var(--color-muted)]">
                Contexte : {selectedOperation.resourceContext}
              </p>
            ) : null}

            {selectedOperation.resourceType === "Remboursement" ? (
              <p className="mt-4 rounded-xl bg-[var(--color-surface-soft)] p-3 text-sm text-[var(--color-muted)]">
                {selectedReimbursedOperation
                  ? `Remboursement de : ${formatDate(selectedReimbursedOperation.date)} · ${selectedReimbursedOperation.label} · ${formatCurrency(Math.abs(selectedReimbursedOperation.amount))}`
                  : "Remboursement à affecter"}
              </p>
            ) : null}

            {selectedOperation.analysisUncertain ? (
              <p className="mt-4 rounded-xl bg-[#f6ead2] p-3 text-sm font-bold text-[#8a6021]">
                Rattachement analytique à contrôler.
              </p>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setDraft(operationDraft(selectedOperation));
                  setPanelMode("edit");
                  setActionError(null);
                }}
              >
                Modifier
              </button>
            </div>
              </>
            ) : panelMode === "edit" && draft ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void confirmUpdate();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Date
                    <input
                      type="date"
                      className="field mt-1 w-full text-sm"
                      value={draft.date}
                      onChange={(event) => updateDraft("date", event.target.value)}
                      required
                    />
                  </label>
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Montant
                    <input
                      type="text"
                      inputMode="decimal"
                      className="field mt-1 w-full text-sm"
                      value={draft.amount}
                      onChange={(event) => updateDraft("amount", event.target.value)}
                      required
                    />
                  </label>
                </div>

                <label className="mt-4 block text-xs font-bold text-[var(--color-muted)]">
                  Libellé bancaire d’origine
                  <div className="mt-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-3 text-sm font-bold text-[var(--color-ink)]">
                    {selectedOperation.sourceLabel}
                  </div>
                </label>

                <label className="mt-4 block text-xs font-bold text-[var(--color-muted)]">
                  Commerçant / tiers normalisé
                  <input
                    className="field mt-1 w-full text-sm"
                    value={draft.normalizedMerchant}
                    onChange={(event) =>
                      updateDraft("normalizedMerchant", event.target.value)
                    }
                  />
                </label>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Flux
                    <select
                      className="field mt-1 w-full text-sm"
                      value={draft.flow}
                      onChange={(event) =>
                        updateDraft("flow", event.target.value as FlowType)
                      }
                    >
                      {flowOptions.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Type de ressource
                    <select
                      className="field mt-1 w-full text-sm"
                      value={draft.resourceType}
                      onChange={(event) => {
                        const value = event.target.value as ResourceType | "";
                        updateDraft("resourceType", value);
                        if (value !== "Remboursement") {
                          updateDraft("reimbursesOperationId", "");
                        }
                      }}
                    >
                      <option value="">Automatique</option>
                      {resourceTypeOptions.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Catégorie
                    <select
                      className="field mt-1 w-full text-sm"
                      value={draft.category}
                      onChange={(event) => {
                        updateDraft("category", event.target.value);
                        updateDraft("subcategory", "");
                        updateDraft("preciseType", "");
                      }}
                    >
                      <option value="">Non renseigné</option>
                      {categories.map((entry) => (
                        <option key={entry.slug} value={entry.name}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Sous-catégorie
                    <select
                      className="field mt-1 w-full text-sm"
                      value={draft.subcategory}
                      disabled={!draft.category}
                      onChange={(event) => {
                        updateDraft("subcategory", event.target.value);
                        updateDraft("preciseType", "");
                      }}
                    >
                      <option value="">Non renseigné</option>
                      {draftSubcategories.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Type précis
                    <select
                      className="field mt-1 w-full text-sm"
                      value={draft.preciseType}
                      disabled={!draft.subcategory || !draftPreciseTypes.length}
                      onChange={(event) =>
                        updateDraft("preciseType", event.target.value)
                      }
                    >
                      <option value="">Non renseigné</option>
                      {draftPreciseTypes.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Nature
                    <select
                      className="field mt-1 w-full text-sm"
                      value={draft.recurrence}
                      onChange={(event) =>
                        updateDraft(
                          "recurrence",
                          event.target.value as Recurrence | "",
                        )
                      }
                    >
                      <option value="">Non renseigné</option>
                      <option>Fixe</option>
                      <option>Variable</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Importance
                    <select
                      className="field mt-1 w-full text-sm"
                      value={draft.importance}
                      onChange={(event) =>
                        updateDraft(
                          "importance",
                          event.target.value as Importance | "",
                        )
                      }
                    >
                      <option value="">Non renseigné</option>
                      {importanceOptions.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-[var(--color-muted)] sm:col-span-2">
                    Statut analytique
                    <select
                      className="field mt-1 w-full text-sm"
                      value={draft.status}
                      onChange={(event) =>
                        updateDraft(
                          "status",
                          event.target.value as AnalyticalStatus,
                        )
                      }
                    >
                      {statusOptions.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Contexte de l’entrée
                    <input
                      className="field mt-1 w-full text-sm"
                      value={draft.resourceContext}
                      onChange={(event) =>
                        updateDraft("resourceContext", event.target.value)
                      }
                      placeholder="Aide parentale, cadeau…"
                    />
                  </label>
                  <label className="text-xs font-bold text-[var(--color-muted)]">
                    Mois de rattachement analytique
                    <select
                      className="field mt-1 w-full text-sm"
                      value={draft.analysisMonthOverride}
                      disabled={Number(draft.amount.replace(",", ".")) <= 0}
                      onChange={(event) =>
                        updateDraft(
                          "analysisMonthOverride",
                          event.target.value as MonthKey | "",
                        )
                      }
                    >
                      <option value="">
                        Automatique · {formatMonth(operationAnalysisMonth(selectedOperation))}
                      </option>
                      {months.map((entry) => (
                        <option key={entry} value={entry}>
                          {formatMonth(entry)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {draft.resourceType === "Remboursement" &&
                Number(draft.amount.replace(",", ".")) > 0 ? (
                  <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                    <p className="text-xs font-bold text-[var(--color-muted)]">
                      Remboursement de
                    </p>
                    <input
                      className="field mt-2 w-full text-sm"
                      value={reimbursementQuery}
                      onChange={(event) => setReimbursementQuery(event.target.value)}
                      placeholder="Rechercher une dépense"
                    />
                    <select
                      className="field mt-2 w-full text-sm"
                      value={draft.reimbursesOperationId}
                      onChange={(event) =>
                        updateDraft("reimbursesOperationId", event.target.value)
                      }
                    >
                      <option value="">Remboursement à affecter</option>
                      {reimbursementCandidates.map((operation) => (
                        <option key={operation.id} value={operation.id}>
                          {formatDate(operation.date)} · {operation.label} ·{" "}
                          {formatCurrency(Math.abs(operation.amount))} ·{" "}
                          {operation.category}
                          {operation.event ? ` · ${operation.event}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <label className="mt-4 block text-xs font-bold text-[var(--color-muted)]">
                  Note
                  <textarea
                    className="field mt-1 min-h-24 w-full resize-y text-sm"
                    value={draft.note}
                    onChange={(event) => updateDraft("note", event.target.value)}
                  />
                </label>
                <label className="mt-4 block text-xs font-bold text-[var(--color-muted)]">
                  Événement
                  <input
                    className="field mt-1 w-full text-sm"
                    value={draft.event}
                    onChange={(event) => updateDraft("event", event.target.value)}
                  />
                </label>
                <label className="mt-4 block text-xs font-bold text-[var(--color-muted)]">
                  Contexte de dépense confirmé
                  <select
                    className="field mt-1 w-full text-sm"
                    value={draft.spendingContext}
                    onChange={(event) =>
                      updateDraft(
                        "spendingContext",
                        event.target.value as SpendingContext | "",
                      )
                    }
                  >
                    <option value="">Automatique / à confirmer</option>
                    <option>Vie courante</option>
                    <option>Événement</option>
                  </select>
                </label>
                <label className="mt-4 block text-xs font-bold text-[var(--color-muted)]">
                  Spécification de l’événement
                  <input
                    className="field mt-1 w-full text-sm"
                    value={draft.eventDetail}
                    onChange={(event) =>
                      updateDraft("eventDetail", event.target.value)
                    }
                    placeholder="Minorque, Anniversaire Adrien, Canapé…"
                  />
                </label>
                <label className="mt-4 flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={draft.uncertain}
                    onChange={(event) =>
                      updateDraft("uncertain", event.target.checked)
                    }
                  />
                  Classification incertaine
                </label>

                {actionError ? (
                  <p className="mt-4 rounded-[var(--radius-sm)] bg-[#fff1ef] p-3 text-sm font-bold text-[#9a463c]">
                    {actionError}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-[var(--color-border)] pt-5">
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={actionPending}
                    onClick={cancelEditing}
                  >
                    Annuler
                  </button>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-[var(--radius-sm)] border border-[#c9655b] px-4 py-2.5 text-sm font-extrabold text-[#a83d35] transition hover:bg-[#fff1ef]"
                      disabled={actionPending}
                      onClick={() => {
                        setPanelMode("delete");
                        setActionError(null);
                      }}
                    >
                      Supprimer
                    </button>
                    <button
                      type="submit"
                      className="button-primary"
                      disabled={actionPending}
                    >
                      {actionPending ? "Enregistrement…" : "Confirmer"}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="rounded-[var(--radius-md)] border border-[#e5aaa2] bg-[#fff7f5] p-5">
                <p className="font-black text-[#913c34]">
                  Cette opération sera supprimée définitivement.
                </p>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Le libellé bancaire et la traçabilité de cette opération ne
                  seront plus disponibles.
                </p>
                {actionError ? (
                  <p className="mt-4 text-sm font-bold text-[#9a463c]">
                    {actionError}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={actionPending}
                    onClick={cancelEditing}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="rounded-[var(--radius-sm)] bg-[#a9443a] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#8f372f]"
                    disabled={actionPending}
                    onClick={() => void confirmDelete()}
                  >
                    {actionPending
                      ? "Suppression…"
                      : "Confirmer la suppression"}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
