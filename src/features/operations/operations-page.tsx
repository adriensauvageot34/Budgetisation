"use client";

import Link from "next/link";
import type { OperationsBrowseReadModel, OperationsTimeFilter } from "@/query-api";
import {
  EmptyState,
  ErrorState,
  MetricDisplay,
  QualityBadge,
  SectionSkeleton,
  type UiTransportState,
} from "@/ui";
import { useProductRuntime } from "@/components/runtime";
import styles from "./operations.module.css";

export type OperationsDisplayMode = "compact" | "standard" | "complete";

type PersonOption = { readonly id: string; readonly label: string };

function appendTime(params: URLSearchParams, time: OperationsTimeFilter): void {
  params.set("timeKind", time.kind);
  if (time.kind === "bank_month" || time.kind === "economic_month") {
    params.set("month", time.month);
  } else if (time.kind === "bank_range" || time.kind === "economic_range") {
    params.set("startDate", time.start);
    params.set("endExclusive", time.endExclusive);
  } else {
    params.set("globalWindow", time.window);
    params.set("asOf", time.asOf);
  }
}

function TimeHiddenFields({ time }: { readonly time: OperationsTimeFilter }) {
  return (
    <>
      <input type="hidden" name="timeKind" value={time.kind} />
      {time.kind === "bank_month" || time.kind === "economic_month" ? (
        <input type="hidden" name="month" value={time.month} />
      ) : time.kind === "bank_range" || time.kind === "economic_range" ? (
        <>
          <input type="hidden" name="startDate" value={time.start} />
          <input type="hidden" name="endExclusive" value={time.endExclusive} />
        </>
      ) : (
        <>
          <input type="hidden" name="globalWindow" value={time.window} />
          <input type="hidden" name="asOf" value={time.asOf} />
        </>
      )}
    </>
  );
}

export function OperationsPage({
  state,
  mode,
  time,
  search,
  sort,
  cursor,
  subject,
  months,
  persons,
}: {
  readonly state: UiTransportState<OperationsBrowseReadModel>;
  readonly mode: OperationsDisplayMode;
  readonly time: OperationsTimeFilter;
  readonly search: string;
  readonly sort: string;
  readonly cursor: string | null;
  readonly subject: string;
  readonly months: readonly string[];
  readonly persons: readonly PersonOption[];
}) {
  const runtime = useProductRuntime();
  const response = state.status === "success"
    ? state.response
    : state.status === "error"
      ? state.previousData
      : undefined;
  const model = response?.data;
  const nextPageParams = new URLSearchParams();
  appendTime(nextPageParams, time);
  if (subject !== "household") nextPageParams.set("personId", subject);
  if (search.length > 0) nextPageParams.set("search", search);
  nextPageParams.set("sort", sort);
  nextPageParams.set("mode", mode);
  if (model?.page.pageInfo.nextCursor) {
    nextPageParams.set("cursor", model.page.pageInfo.nextCursor);
  }

  return (
    <div className={styles.page} data-product-surface="operations">
      <header className={styles.header}>
        <span className="eyebrow">Registre de preuve</span>
        <h1>Opérations</h1>
        <p>Flux bancaires et lecture économique restent distincts. Recherche, tri et pagination sont exécutés côté serveur.</p>
      </header>

      <form className={styles.toolbar} method="get" action="/operations">
        {time.kind === "bank_month" || time.kind === "economic_month" ? (
          <label>
            <span>{time.kind === "bank_month" ? "Période bancaire" : "Période économique"}</span>
            <input type="hidden" name="timeKind" value={time.kind} />
            <select className="field" name="month" defaultValue={time.month}>
              {months.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        ) : time.kind === "bank_range" || time.kind === "economic_range" ? (
          <label>
            <span>{time.kind === "bank_range" ? "Plage bancaire" : "Plage économique"}</span>
            <TimeHiddenFields time={time} />
            <span className="field" aria-label={`Du ${time.start} au ${time.endExclusive}`}>{time.start} → {time.endExclusive}</span>
          </label>
        ) : (
          <label>
            <span>Fenêtre globale</span>
            <input type="hidden" name="timeKind" value="global_window" />
            <input type="hidden" name="asOf" value={time.asOf} />
            <select className="field" name="globalWindow" defaultValue={time.window}>
              <option value="last_12_months">12 derniers mois</option>
              <option value="last_6_months">Semestre</option>
              <option value="last_3_months">Trimestre</option>
              <option value="last_complete_summer">Été</option>
            </select>
          </label>
        )}
        <label>
          <span>Foyer / personne</span>
          <select className="field" name="personId" defaultValue={subject}>
            <option value="household">Foyer</option>
            {persons.map((person) => <option key={person.id} value={person.id}>{person.label}</option>)}
          </select>
        </label>
        <label className={styles.search}>
          <span>Recherche</span>
          <input className="field" name="search" defaultValue={search} placeholder="Libellé ou marchand" maxLength={120} />
        </label>
        <label>
          <span>Tri</span>
          <select className="field" name="sort" defaultValue={sort}>
            <option value="bank_date_desc">Date bancaire · récent</option>
            <option value="bank_date_asc">Date bancaire · ancien</option>
            <option value="economic_timing_desc">Temporalité économique</option>
            <option value="bank_amount_desc">Montant bancaire</option>
            <option value="economic_net_desc">Valeur économique</option>
          </select>
        </label>
        <label aria-describedby="operations-reference-reason">
          <span>Catégorie</span>
          <select className="field" disabled><option>Référentiel indisponible</option></select>
        </label>
        <label aria-describedby="operations-reference-reason">
          <span>Marchand</span>
          <select className="field" disabled><option>Référentiel indisponible</option></select>
        </label>
        <input type="hidden" name="mode" value={mode} />
        <button className="button-primary" type="submit">Appliquer</button>
      </form>

      <form className={styles.displayMode} method="get" action="/operations">
        <TimeHiddenFields time={time} />
        {subject !== "household" ? <input type="hidden" name="personId" value={subject} /> : null}
        {search.length > 0 ? <input type="hidden" name="search" value={search} /> : null}
        <input type="hidden" name="sort" value={sort} />
        {cursor ? <input type="hidden" name="cursor" value={cursor} /> : null}
        <label>
          <span>Affichage</span>
          <select className="field" name="mode" defaultValue={mode}>
            <option value="compact">Compacte</option>
            <option value="standard">Standard</option>
            <option value="complete">Complète</option>
          </select>
        </label>
        <button className="button-secondary" type="submit">Changer le mode</button>
      </form>

      {search.length > 0 || subject !== "household" || time.kind !== "bank_month" ? (
        <div className={styles.chips} aria-label="Filtres actifs">
          {time.kind !== "bank_month" ? <span>{time.kind.replaceAll("_", " ")}</span> : null}
          {subject !== "household" ? <span>Personne sélectionnée</span> : null}
          {search.length > 0 ? <span>Recherche : {search}</span> : null}
        </div>
      ) : null}

      <details className={styles.advanced}>
        <summary>Filtres avancés</summary>
        <p id="operations-reference-reason">Catégorie, marchand, compte, qualité, lieu, activité et relations contextuelles sont contractés par la Query. Les listes de référence sont indisponibles tant que la couche canonique n’est pas exposée à la session applicative.</p>
      </details>

      {state.status === "idle" || state.status === "loading" ? <SectionSkeleton /> : null}
      {state.status === "error" && model === undefined ? <ErrorState error={state.error} /> : null}
      {model && model.page.items.length === 0 ? (
        <EmptyState title="Aucune opération" description="La requête autoritaire ne renvoie aucune ligne pour ce périmètre." />
      ) : null}
      {model && model.page.items.length > 0 ? (
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th><th>Libellé / marchand</th><th>Montant bancaire</th>
                {mode !== "compact" ? <><th>Valeur économique</th><th>Catégorie</th><th>Compte</th></> : null}
                {mode === "complete" ? <><th>Qualification</th><th>Temporalité</th><th>Qualité</th></> : null}
                <th><span className="sr-only">Détail</span></th>
              </tr>
            </thead>
            <tbody>
              {model.page.items.map((row) => (
                <tr key={row.operationId}>
                  <td>{row.bankDate}</td>
                  <td><strong>{row.merchant?.label ?? row.bankLabel}</strong>{row.merchant ? <small>{row.bankLabel}</small> : null}</td>
                  <td><MetricDisplay metric={row.bankAmount} /></td>
                  {mode !== "compact" ? <><td><MetricDisplay metric={row.economicNet} /></td><td>{row.category?.label ?? "—"}</td><td>{row.account?.label ?? "—"}</td></> : null}
                  {mode === "complete" ? <><td>{[row.subcategory?.label, row.preciseType, row.necessity, row.fixedVariable, row.lifeScope, row.canonicalPlace?.label].filter(Boolean).join(" · ") || "—"}</td><td>{row.economicTiming.availability === "known" ? row.economicTiming.date : "Inconnue"}</td><td>{row.quality === "complete" ? <span>Complet</span> : <QualityBadge state={row.quality === "partial" ? "partial" : row.quality === "conflict" ? "conflict" : "incomplete"} />}</td></> : null}
                  <td><button className="button-ghost" type="button" onClick={() => runtime.run((controller) => controller.openExploration({ kind: "operation", id: row.operationId }))}>Voir la preuve</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {model?.page.pageInfo.nextCursor ? (
        <Link className="button-secondary" href={`/operations?${nextPageParams.toString()}`}>Page suivante</Link>
      ) : null}
    </div>
  );
}
