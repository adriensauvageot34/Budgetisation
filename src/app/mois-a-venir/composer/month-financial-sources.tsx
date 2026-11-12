import type { ComposerBudgetReading } from "@/domain/phase2/planner/composer-contract";
import { monthControlUrl } from "@/domain/phase2/month-control-contract";
import { money } from "./display";
import styles from "./month-budget.module.css";

const providerLabel = { SWILE: "Swile", EDENRED: "Edenred" };

export function monthlySourceHref(month: string, focus?: string) {
  return monthControlUrl(`/mois-a-venir?month=${encodeURIComponent(month)}`, "update", focus);
}

export function MonthlySourceLink({ month, focus, children }: { month: string; focus?: string; children: React.ReactNode }) {
  return <a className={styles.sourceLink} href={monthlySourceHref(month, focus)} target="_blank" rel="noopener">
    {children}<span className={styles.srOnly}> (nouvel onglet)</span>
  </a>;
}

export function MissingMonthlySources({ reading, month, stale }: { reading?: ComposerBudgetReading; month: string; stale: boolean }) {
  if (!reading?.monthlyLoadings || !reading.salarySources) return null;
  const loadings = reading.monthlyLoadings.filter(row => row.amount === null);
  const salaries = reading.salarySources.filter(row => row.state !== "KNOWN");
  const referenceMissing = reading.monthUpdate?.referencePublished === false;
  const count = loadings.length + salaries.length + Number(referenceMissing);
  if (!count) return null;
  return <details className={styles.missing} open data-month-missing>
    <summary>{count} information{count > 1 ? "s" : ""} à compléter</summary>
    <p>{stale ? "Dernière lecture. " : ""}Les formulaires s’ouvrent dans un nouvel onglet. Après enregistrement, revenez ici et sélectionnez « Actualiser les finances ».</p>
    <ul>
      {loadings.map(row => <li key={row.provider}>
        <strong>{providerLabel[row.provider]} · chargement du mois</strong>
        <p>Le montant prévu pour le chargement de cette carte n’a pas encore été renseigné.</p>
        <MonthlySourceLink month={month} focus={`${row.provider}:loading`}>Renseigner le chargement {providerLabel[row.provider]}</MonthlySourceLink>
      </li>)}
      {salaries.map(row => <li key={row.key}>
        <strong>{row.label} · {row.state === "UNPUBLISHED" ? "Source non publiée" : "Montant inconnu"}</strong>
        <p>La prévision mensuelle fournit ce revenu. Le montant de référence doit être publié avant qu’un ajustement mensuel soit possible.</p>
        <MonthlySourceLink month={month} focus="info">Consulter les sources du mois</MonthlySourceLink>
      </li>)}
      {referenceMissing && <li><strong>Référence budgétaire non publiée</strong>
        <p>La projection attend la publication de la prévision de ce mois.</p>
        <MonthlySourceLink month={month} focus="info">Consulter l’état de la prévision</MonthlySourceLink>
      </li>}
    </ul>
  </details>;
}

export function MonthlyLoadings({ reading, month, stale }: { reading?: ComposerBudgetReading; month: string; stale: boolean }) {
  return <div className={styles.loadings} data-month-funding>
    <p>Le chargement prévu est un flux du mois, distinct du solde de la carte et du revenu bancaire.</p>
    {reading?.monthlyLoadings?.map(row => {
      const zero = row.amount !== null && /^0(?:\.0+)?$/u.test(row.amount);
      return <div key={row.provider} data-loading={row.provider} data-knowledge={row.amount === null ? "ABSENT" : zero ? "ZERO" : "DECLARED"}>
        <div><strong>{providerLabel[row.provider]}</strong><b>{row.amount === null ? "Non renseigné" : money(row.amount)}</b></div>
        <p>{row.amount === null ? "Déclaration du mois absente" : `${stale ? "Dernière déclaration connue" : zero ? "Zéro déclaré" : "Déclaration du mois"} · ${row.date ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${row.date}T12:00:00Z`)) : "Date facultative non précisée"}`}</p>
        <MonthlySourceLink month={month} focus={`${row.provider}:loading`}>{row.amount === null ? "Renseigner le chargement" : "Ouvrir le chargement"} {providerLabel[row.provider]}</MonthlySourceLink>
      </div>;
    }) ?? <p>Déclarations de chargement non publiées dans cette lecture.</p>}
  </div>;
}
