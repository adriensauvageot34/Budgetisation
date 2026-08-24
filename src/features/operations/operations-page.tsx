"use client";

import { useMemo, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import {
  parseCategoryId,
  parseMerchantId,
  parsePlaceId,
  parseSubcategoryId,
  type OperationId,
} from "@/core/identity";
import { useProductRuntime, useProductSurface, useQueryRuntime, useSemanticAnchor } from "@/components/runtime";
import {
  serializeRootNavigation,
  splitOperationsNavigationState,
  type OperationsNavigationFilters,
  type RootNavigationContext,
  type SemanticAnchor,
} from "@/navigation";
import {
  queryResourceKeys,
  type OperationRowReadModel,
  type OperationsBrowseReadModel,
  type OperationsBrowseSortKey,
  type OperationsFilterCapability,
  type OperationsTimeFilter,
} from "@/query-api";
import {
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  MetricDisplay,
  QualityBadge,
  RefreshIndicator,
  SectionSkeleton,
  type UiTransportState,
} from "@/ui";
import styles from "./operations.module.css";
import {
  operationDisplayModel,
  operationQueryHasLocalError,
} from "./query-state";

export type OperationsDisplayMode = "compact" | "standard" | "complete";
type PersonOption = { readonly id: string; readonly label: string };

function timeFrom(filters: OperationsNavigationFilters): OperationsTimeFilter | null {
  if ((filters.timeKind === "bank_month" || filters.timeKind === "economic_month") && filters.month) {
    return { kind: filters.timeKind, month: filters.month };
  }
  if ((filters.timeKind === "bank_range" || filters.timeKind === "economic_range") && filters.startDate && filters.endExclusive) {
    return { kind: filters.timeKind, start: filters.startDate, endExclusive: filters.endExclusive };
  }
  if (filters.timeKind === "global_window" && filters.globalWindow && filters.asOf) {
    return { kind: "global_window", window: filters.globalWindow, asOf: filters.asOf };
  }
  return null;
}

function sortFrom(value: OperationsNavigationFilters["sort"]): { readonly key: OperationsBrowseSortKey; readonly direction: "asc" | "desc" } {
  const match = /^(bank_date|economic_timing|bank_amount|economic_net)_(asc|desc)$/.exec(value ?? "bank_date_desc");
  if (match === null) return { key: "bank_date", direction: "desc" };
  return { key: match[1] as OperationsBrowseSortKey, direction: match[2] as "asc" | "desc" };
}

function queryRequest(filters: OperationsNavigationFilters) {
  const { question, display } = splitOperationsNavigationState(filters);
  const time = timeFrom(question);
  if (time === null) return null;
  const subject = question.personId
    ? { kind: "person" as const, personId: question.personId }
    : { kind: "household" as const };
  return {
    resource: queryResourceKeys.operationsBrowse,
    scope: { kind: "operations" as const, subject, time },
    params: {
      time,
      search: question.search ?? null,
      sort: sortFrom(question.sort),
      filters: {
        categoryIds: question.categoryIds,
        subcategoryIds: question.subcategoryIds,
        activityIds: question.activityIds,
        momentIds: question.momentIds,
        lifeEventIds: question.lifeEventIds,
        merchantIds: question.merchantIds,
        placeIds: question.placeIds,
        accountIds: question.accountIds,
        preciseTypes: question.preciseTypes,
        necessity: question.necessity,
        fixedVariable: question.fixedVariable?.map((value) => value === "Fixe" ? "fixed" as const : "variable" as const),
        lifeScope: question.lifeScope,
        dayContext: question.dayContext,
        quality: question.quality,
        amountMin: question.amountMin,
        amountMax: question.amountMax,
      },
      cursor: display.cursor ?? null,
      limit: 50,
    },
  };
}

function splitIds<Id extends string>(value: FormDataEntryValue | null, parser: (value: unknown) => Id): readonly Id[] | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return [...new Set(value.split(",").map((item) => parser(item.trim())))].sort();
}

function textList(value: FormDataEntryValue | null): readonly string[] | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].sort();
}

function operationAnchor(operationId: OperationId): SemanticAnchor {
  return { moduleId: "operations", item: { kind: "operation", id: operationId } };
}

function necessityLabel(value: OperationRowReadModel["necessity"]): string {
  return value ?? "—";
}

function fixedLabel(value: OperationRowReadModel["fixedVariable"]): string {
  return value === "fixed" ? "Fixe" : value === "variable" ? "Variable" : "—";
}

function OperationRow({
  row,
  mode,
  selected,
  onOpen,
}: {
  readonly row: OperationRowReadModel;
  readonly mode: OperationsDisplayMode;
  readonly selected: boolean;
  readonly onOpen: (row: OperationRowReadModel, anchor: SemanticAnchor) => void;
}) {
  const anchor = operationAnchor(row.operationId);
  const anchorRef = useSemanticAnchor(anchor);
  const open = () => onOpen(row, anchor);
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    open();
  };
  const openFromButton = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    open();
  };
  return (
    <tr
      ref={anchorRef}
      tabIndex={0}
      aria-selected={selected}
      data-selected={selected || undefined}
      onClick={open}
      onKeyDown={onKeyDown}
    >
      <td>{row.bankDate}</td>
      <td><strong>{row.merchant?.label ?? row.bankLabel}</strong>{row.merchant ? <small>{row.bankLabel}</small> : null}</td>
      <td><MetricDisplay metric={row.bankAmount} qualifierMode="full" /></td>
      {mode !== "compact" ? (
        <>
          <td><MetricDisplay metric={row.economicNet} qualifierMode="full" /></td>
          <td>{row.category?.label ?? "—"}</td>
          <td>{row.account?.label ?? "—"}</td>
        </>
      ) : null}
      {mode === "complete" ? (
        <>
          <td>{row.subcategory?.label ?? "—"}</td>
          <td>{row.preciseType ?? "—"}</td>
          <td>{necessityLabel(row.necessity)}</td>
          <td>{fixedLabel(row.fixedVariable)}</td>
          <td>{row.lifeScope ?? "—"}</td>
          <td>{row.canonicalPlace?.label ?? "—"}</td>
          <td>{row.economicTiming.availability === "known" ? row.economicTiming.date : "Inconnue"}</td>
          <td>{row.quality === "complete" ? "Complet" : <QualityBadge state={row.quality === "partial" ? "partial" : row.quality === "conflict" ? "conflict" : "incomplete"} />}</td>
        </>
      ) : null}
      <td><button className="button-ghost" type="button" onClick={openFromButton}>Voir la preuve</button></td>
    </tr>
  );
}

function FilterInput({ name, label, value }: { readonly name: string; readonly label: string; readonly value?: readonly string[] }) {
  return <label><span>{label}</span><input className="field" name={name} defaultValue={value?.join(", ") ?? ""} /></label>;
}

export function OperationsPage({
  initialState,
  initialFilters,
  months,
  persons,
  noData = false,
}: {
  readonly initialState: UiTransportState<OperationsBrowseReadModel> | null;
  readonly initialFilters: OperationsNavigationFilters;
  readonly months: readonly string[];
  readonly persons: readonly PersonOption[];
  readonly noData?: boolean;
}) {
  const runtime = useProductRuntime();
  const runtimeRoot = runtime.snapshot?.history.root;
  const filters = runtimeRoot && "kind" in runtimeRoot ? runtimeRoot.filters : initialFilters;
  const route: RootNavigationContext = { kind: "operations", filters };
  const request = useMemo(() => noData ? null : queryRequest(filters), [filters, noData]);
  const state = useQueryRuntime<"operations_browse">(request, initialState ?? undefined);
  const model = operationDisplayModel(state);
  const mode = filters.mode ?? "standard";
  const time = timeFrom(filters);
  const [selectedOperationId, setSelectedOperationId] = useState<OperationId | null>(null);
  const filtered = Boolean(
    filters.search || filters.personId || filters.categoryIds?.length || filters.subcategoryIds?.length ||
    filters.merchantIds?.length || filters.placeIds?.length || filters.accountIds?.length || filters.preciseTypes?.length ||
    filters.necessity?.length || filters.fixedVariable?.length || filters.lifeScope?.length || filters.quality?.length ||
    filters.amountMin || filters.amountMax,
  );
  const readiness = noData
    ? "ready" as const
    : state.status === "idle" || state.status === "loading"
      ? "pending" as const
      : state.status === "error" && state.previousData === undefined
        ? "terminal_without_anchor" as const
        : "ready" as const;
  useProductSurface({ route, scope: null, readiness });

  const navigate = (next: OperationsNavigationFilters, historyMode: "push" | "replace" = "push") => {
    runtime.run((controller) => controller.updateOperations(next, historyMode));
  };
  const changeQuestion = (next: OperationsNavigationFilters) => {
    navigate({ ...next, cursor: undefined, cursorTrail: undefined });
  };
  const capability = (name: OperationsFilterCapability) => model?.filterCapabilities.includes(name) === true;

  const submitToolbar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const next: OperationsNavigationFilters = {
        ...filters,
        ...(time?.kind === "bank_month" || time?.kind === "economic_month"
          ? { month: String(data.get("month")) as OperationsNavigationFilters["month"] }
          : {}),
        personId: data.get("personId") === "household" ? undefined : String(data.get("personId")) as OperationsNavigationFilters["personId"],
        search: String(data.get("search") ?? "").trim() || undefined,
        sort: String(data.get("sort")) as OperationsNavigationFilters["sort"],
        categoryIds: splitIds(data.get("categoryIds"), parseCategoryId),
        merchantIds: splitIds(data.get("merchantIds"), parseMerchantId),
      };
      changeQuestion(next);
    } catch {
      event.currentTarget.reportValidity();
    }
  };

  const submitAdvanced = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selected = (name: string) => {
      const value = String(data.get(name) ?? "");
      return value === "" ? undefined : [value];
    };
    try {
      changeQuestion({
        ...filters,
        subcategoryIds: splitIds(data.get("subcategoryIds"), parseSubcategoryId),
        placeIds: splitIds(data.get("placeIds"), parsePlaceId),
        accountIds: textList(data.get("accountIds")),
        preciseTypes: textList(data.get("preciseTypes")),
        necessity: selected("necessity") as OperationsNavigationFilters["necessity"],
        fixedVariable: selected("fixedVariable") as OperationsNavigationFilters["fixedVariable"],
        lifeScope: selected("lifeScope") as OperationsNavigationFilters["lifeScope"],
        quality: selected("quality") as OperationsNavigationFilters["quality"],
        amountMin: String(data.get("amountMin") ?? "").trim() as OperationsNavigationFilters["amountMin"] || undefined,
        amountMax: String(data.get("amountMax") ?? "").trim() as OperationsNavigationFilters["amountMax"] || undefined,
      });
    } catch {
      event.currentTarget.reportValidity();
    }
  };

  const removeFilter = (key: keyof OperationsNavigationFilters) => {
    changeQuestion({ ...filters, [key]: undefined });
  };

  return (
    <div className={styles.page} data-product-surface="operations" data-route={serializeRootNavigation(route)}>
      <header className={styles.header}>
        <span className="eyebrow">Registre de preuve</span>
        <h1>Opérations</h1>
        <p>La vérité bancaire exacte et la lecture économique qualifiée restent deux colonnes distinctes.</p>
        {runtime.snapshot?.returnDestination ? <button className="button-secondary" type="button" onClick={() => runtime.run((controller) => controller.returnToOrigin())}>Retour au contexte d’origine</button> : null}
      </header>

      {noData || time === null ? <EmptyState title="Aucune opération bancaire disponible" description="Aucune date bancaire autoritaire ne permet de choisir un mois par défaut." /> : (
        <>
          <form key={`toolbar:${serializeRootNavigation(route)}`} className={styles.toolbar} onSubmit={submitToolbar}>
            {(time.kind === "bank_month" || time.kind === "economic_month") ? (
              <label><span>{time.kind === "bank_month" ? "Période bancaire" : "Période économique"}</span><select className="field" name="month" defaultValue={time.month}>{months.map((month) => <option key={month} value={month}>{month}</option>)}</select></label>
            ) : <div><span className={styles.fieldLabel}>Période</span><strong>{time.kind === "global_window" ? `${time.window} · ${time.asOf}` : `${time.start} → ${time.endExclusive}`}</strong></div>}
            <label><span>Sujet</span><select className="field" name="personId" defaultValue={filters.personId ?? "household"}><option value="household">Foyer</option>{persons.map((person) => <option key={person.id} value={person.id} disabled={filters.personId !== person.id}>{person.label} · attribution indisponible</option>)}</select></label>
            <label className={styles.search}><span>Recherche serveur</span><input className="field" name="search" defaultValue={filters.search ?? ""} maxLength={120} placeholder="Libellé, marchand, référence…" /></label>
            <label><span>Tri serveur</span><select className="field" name="sort" defaultValue={filters.sort ?? "bank_date_desc"}><option value="bank_date_desc">Date bancaire · récent</option><option value="bank_date_asc">Date bancaire · ancien</option><option value="economic_timing_desc">Temporalité économique</option><option value="bank_amount_desc">Montant bancaire</option><option value="economic_net_desc">Valeur économique</option></select></label>
            {capability("category") ? <FilterInput name="categoryIds" label="Catégorie · ID canonique" value={filters.categoryIds} /> : null}
            {capability("merchant") ? <FilterInput name="merchantIds" label="Marchand · ID canonique" value={filters.merchantIds} /> : null}
            <button className="button-primary" type="submit">Appliquer</button>
          </form>

          <div className={styles.displayMode}>
            <label><span>Affichage</span><select className="field" value={mode} onChange={(event) => navigate({ ...filters, mode: event.currentTarget.value as OperationsDisplayMode }, "replace")}><option value="compact">Compact</option><option value="standard">Standard</option><option value="complete">Complet</option></select></label>
          </div>

          <div className={styles.chips} aria-label="Filtres actifs">
            {([
              ["categoryIds", "Catégorie"], ["subcategoryIds", "Sous-catégorie"], ["merchantIds", "Marchand"],
              ["placeIds", "Lieu"], ["accountIds", "Compte"], ["preciseTypes", "Type précis"],
              ["necessity", "Nécessité"], ["fixedVariable", "Fixe / variable"], ["lifeScope", "Périmètre de vie"],
              ["quality", "Qualité"], ["amountMin", "Montant min"], ["amountMax", "Montant max"],
            ] as const).map(([key, label]) => filters[key] === undefined ? null : <button key={key} type="button" onClick={() => removeFilter(key)}>{label} ×</button>)}
          </div>

          <details className={styles.advanced}>
            <summary>Filtres avancés</summary>
            <form key={`advanced:${serializeRootNavigation(route)}`} className={styles.advancedGrid} onSubmit={submitAdvanced}>
              {capability("subcategory") ? <FilterInput name="subcategoryIds" label="Sous-catégorie · ID canonique" value={filters.subcategoryIds} /> : null}
              {capability("place") ? <FilterInput name="placeIds" label="Lieu · ID canonique" value={filters.placeIds} /> : null}
              {capability("account") ? <FilterInput name="accountIds" label="Compte · ID canonique" value={filters.accountIds} /> : null}
              {capability("precise_type") ? <FilterInput name="preciseTypes" label="Type précis" value={filters.preciseTypes} /> : null}
              {capability("necessity") ? <label><span>Nécessité</span><select className="field" name="necessity" defaultValue={filters.necessity?.[0] ?? ""}><option value="">Toutes</option><option>Indispensable</option><option>Contraint</option><option>Ajustable</option><option>Optionnel</option></select></label> : null}
              {capability("fixed_variable") ? <label><span>Fixe / variable</span><select className="field" name="fixedVariable" defaultValue={filters.fixedVariable?.[0] ?? ""}><option value="">Tous</option><option>Fixe</option><option>Variable</option></select></label> : null}
              {capability("life_scope") ? <label><span>Périmètre de vie</span><select className="field" name="lifeScope" defaultValue={filters.lifeScope?.[0] ?? ""}><option value="">Tous</option><option>Vie courante</option><option>Hors quotidien</option></select></label> : null}
              {capability("quality") ? <label><span>Qualité</span><select className="field" name="quality" defaultValue={filters.quality?.[0] ?? ""}><option value="">Toutes</option><option value="complete">Complète</option><option value="partial">Partielle</option><option value="conflict">Conflit</option><option value="unknown">Inconnue</option></select></label> : null}
              {capability("economic_amount") ? <><label><span>Valeur économique min.</span><input className="field" name="amountMin" inputMode="decimal" defaultValue={filters.amountMin ?? ""} /></label><label><span>Valeur économique max.</span><input className="field" name="amountMax" inputMode="decimal" defaultValue={filters.amountMax ?? ""} /></label></> : null}
              <button className="button-secondary" type="submit">Appliquer les filtres avancés</button>
            </form>
          </details>

          {state.status === "idle" || state.status === "loading" ? <SectionSkeleton /> : null}
          {operationQueryHasLocalError(state) && state.status === "error" ? <ErrorState error={state.error} /> : null}
          {model?.page.state === "empty" ? <EmptyState title="Aucune opération" description="Le périmètre bancaire autoritaire ne contient aucune opération." /> : null}
          {model?.page.state === "filtered_empty" ? <FilteredEmptyState onClearFilters={filtered ? () => changeQuestion({ timeKind: filters.timeKind, month: filters.month, startDate: filters.startDate, endExclusive: filters.endExclusive, globalWindow: filters.globalWindow, asOf: filters.asOf, mode }) : undefined} /> : null}
          {model && model.page.items.length > 0 ? (
            <div className="table-shell" data-operations-table="">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Libellé / marchand</th><th>Montant bancaire exact</th>{mode !== "compact" ? <><th>Valeur économique</th><th>Catégorie</th><th>Compte</th></> : null}{mode === "complete" ? <><th>Sous-catégorie</th><th>Type précis</th><th>Nécessité</th><th>Fixe / variable</th><th>Périmètre</th><th>Lieu</th><th>Temporalité économique</th><th>Qualité</th></> : null}<th><span className="sr-only">Détail</span></th></tr></thead>
                <tbody>{model.page.items.map((row) => <OperationRow key={row.operationId} row={row} mode={mode} selected={selectedOperationId === row.operationId} onOpen={(selected, anchor) => { setSelectedOperationId(selected.operationId); runtime.run((controller) => controller.openExploration({ kind: "operation", id: selected.operationId }, anchor)); }} />)}</tbody>
              </table>
            </div>
          ) : null}
          {state.status === "success" && state.refreshing ? <RefreshIndicator announce /> : state.status === "error" && model ? <RefreshIndicator failed announce /> : null}
          <nav className={styles.pagination} aria-label="Pagination des opérations">
            <button className="button-secondary" type="button" disabled={!filters.cursorTrail?.length} onClick={() => { const previous = filters.cursorTrail?.at(-1); if (!previous) return; navigate({ ...filters, cursor: previous === "first" ? undefined : previous, cursorTrail: filters.cursorTrail?.slice(0, -1) }); }}>Page précédente</button>
            <span>{model?.page.items.length ?? 0} lignes affichées</span>
            <button className="button-secondary" type="button" disabled={!model?.page.pageInfo.nextCursor} onClick={() => { if (!model?.page.pageInfo.nextCursor) return; navigate({ ...filters, cursor: model.page.pageInfo.nextCursor, cursorTrail: [...(filters.cursorTrail ?? []), filters.cursor ?? "first"] }); }}>Page suivante</button>
          </nav>
        </>
      )}
    </div>
  );
}
