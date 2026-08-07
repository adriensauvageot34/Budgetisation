"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
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
} from "@/domain/budget";
import {
  formatCurrency,
  formatDate,
  formatMonth,
} from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

type ViewMode = "Compacte" | "Standard" | "Complète";
type SortKey = "date" | "label" | "amount" | "category" | "accountId";
type SortDirection = "asc" | "desc";

const pageSize = 50;

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
}: {
  months: MonthKey[];
  operations: Operation[];
  categories: CategoryDefinition[];
  accounts: Account[];
  initialMonth: MonthKey;
}) {
  const [view, setView] = useState<ViewMode>("Standard");
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState<MonthKey | "Tous">(initialMonth);
  const [category, setCategory] = useState("Toutes");
  const [accountId, setAccountId] = useState("Tous");
  const [flow, setFlow] = useState<FlowType | "Tous">("Tous");
  const [person, setPerson] = useState<Person | "Toutes">("Toutes");
  const [importance, setImportance] = useState<Importance | "Toutes">("Toutes");
  const [recurrence, setRecurrence] = useState<Recurrence | "Toutes">("Toutes");
  const [status, setStatus] = useState<AnalyticalStatus | "Tous">("Tous");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(
    null,
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
    return operations
      .filter(
        (operation) =>
          (month === "Tous" || operation.importMonth === month) &&
          (category === "Toutes" || operation.category === category) &&
          (accountId === "Tous" || operation.accountId === accountId) &&
          (flow === "Tous" || operation.flow === flow) &&
          (person === "Toutes" || operation.person === person) &&
          (importance === "Toutes" || operation.importance === importance) &&
          (recurrence === "Toutes" || operation.recurrence === recurrence) &&
          (status === "Tous" || operation.status === status) &&
          (!normalizedQuery ||
            [
              operation.label,
              operation.normalizedMerchant,
              operation.sourceLabel,
              operation.subcategory,
              operation.preciseType,
            ]
              .join(" ")
              .toLocaleLowerCase("fr-FR")
              .includes(normalizedQuery)),
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
    flow,
    importance,
    month,
    operations,
    person,
    query,
    recurrence,
    sortDirection,
    sortKey,
    status,
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
    setMonth(initialMonth);
    setCategory("Toutes");
    setAccountId("Tous");
    setFlow("Tous");
    setPerson("Toutes");
    setImportance("Toutes");
    setRecurrence("Toutes");
    setStatus("Tous");
    setAdvancedOpen(false);
    setSortKey("date");
    setSortDirection("desc");
    setPage(1);
  }

  const activeAdvanced = [person, importance, recurrence, status].filter(
    (value) => value !== "Toutes" && value !== "Tous",
  ).length;
  const accountName = (id: string) =>
    accounts.find((account) => account.id === id)?.name ?? id;

  const filterFields = (
    <>
      <label className="text-xs font-bold text-[var(--color-muted)]">
        Mois
        <select
          className="field mt-1 w-full capitalize text-sm"
          value={month}
          onChange={(event) => {
            setMonth(event.target.value as MonthKey | "Tous");
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
      <PageHeader
        eyebrow="Recherche détaillée"
        title="Opérations"
        description="Retrouvez une transaction, vérifiez son classement et consultez sa traçabilité sans modifier les données."
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
                <option>Adrien</option>
                <option>Manon</option>
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
          Cliquez sur une opération pour consulter son détail
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
                  onClick={() => setSelectedOperation(operation)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedOperation(operation);
                    }
                  }}
                >
                  <td className="whitespace-nowrap">
                    {formatDate(operation.date)}
                  </td>
                  <td>
                    <p className="font-extrabold">{operation.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {operation.normalizedMerchant} · {operation.person}
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
                      <td>{operation.preciseType}</td>
                      <td>{operation.importance}</td>
                      <td>{operation.recurrence}</td>
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
            onClick={() => setSelectedOperation(operation)}
            className="card w-full p-4 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-extrabold">{operation.label}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {formatDate(operation.date)} · {operation.person}
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
            if (event.target === event.currentTarget) setSelectedOperation(null);
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
                <p className="eyebrow mb-2">Détail consultatif</p>
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
                onClick={() => setSelectedOperation(null)}
                aria-label="Fermer"
              >
                <X size={17} />
              </button>
            </div>

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
                  {selectedOperation.person}
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
                  ["Type précis", selectedOperation.preciseType],
                  ["Importance", selectedOperation.importance],
                  ["Nature", selectedOperation.recurrence],
                  ["Statut", selectedOperation.status],
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
              <p className="eyebrow mb-3">Données bancaires fictives</p>
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

            <p className="mt-6 text-xs leading-5 text-[var(--color-muted)]">
              Cette première version est en lecture seule. La correction du
              classement sera ajoutée dans une phase ultérieure.
            </p>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
