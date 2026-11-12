import type { SaveStatus } from "./durable-draft";
import styles from "./composer.module.css";

export function saveStatusPresentation(status: SaveStatus, durable: boolean) {
  if (!durable) return { label: "Brouillon en mémoire", detail: "Ces choix restent dans cette page. Aucun enregistrement serveur n’est confirmé." };
  return {
    CLEAN: { label: "Aucun brouillon enregistré", detail: "Vos prochains choix validés seront enregistrés automatiquement." },
    DIRTY: { label: "Modifications à enregistrer", detail: "Les choix validés attendent leur enregistrement." },
    SAVING: { label: "Enregistrement en cours…", detail: "Attendez la confirmation avant de recharger la page." },
    SAVED: { label: "Sauvegardé", detail: "Les choix validés ont été confirmés par le serveur." },
    ERROR: { label: "Sauvegarde non confirmée", detail: "Gardez cette page ouverte et utilisez Réessayer la sauvegarde dans les options du mois." },
    CONFLICT: { label: "Versions à vérifier", detail: "Le brouillon ou le Plan a changé. Consultez les options du mois pour le relire." },
    OFFLINE: { label: "Hors ligne · non enregistré", detail: "Les modifications restent dans cette page en attendant la connexion." },
  }[status];
}

export function ComposerSaveStatus({ status, durable, raw, suspended = false }: {
  status: SaveStatus; durable: boolean; raw: boolean; suspended?: boolean;
}) {
  const presentation = saveStatusPresentation(status, durable && !suspended);
  return <>
    <span className={styles.draftStatus} data-draft-status data-state={durable && !suspended ? status : "MEMORY"}
      title={presentation.detail} role="status">{suspended ? "Organisation locale non sauvegardée" : presentation.label}</span>
    {raw && <span className={styles.inlineEditNotice} data-save-raw data-inline-unvalidated role="status"
      title="Cette saisie reste dans le formulaire jusqu’à votre validation.">Saisie non validée</span>}
  </>;
}
