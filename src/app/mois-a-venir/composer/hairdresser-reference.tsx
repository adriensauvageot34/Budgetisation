import { Eye } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannerJson, PlannerJsonObject } from "@/domain/phase2/planner/json";
import { hairdresserReferenceLines, isHairdresserReference } from "@/domain/phase2/planner/composer-library-index";
import { AtomicPopover, placeAtomicPopover } from "./atomic-popover";
import { money } from "./display";
import styles from "./composer.module.css";

const record = (value: PlannerJson | undefined): PlannerJsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as PlannerJsonObject : {};
const text = (value: PlannerJson | undefined) => typeof value === "string" && value.trim() ? value.trim() : null;
const priceSources: Readonly<Record<string, string>> = { MANUAL: "Prix déclaré", LAST_KNOWN: "Repère historique · date du prix non publiée",
  SYSTEM_DEFAULT: "Repère système", CALCULATED: "Estimation calculée par la source" };

function HairdresserFacts({ id, children }: { id: string; children: ReactNode }) {
  const body = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    // AtomicPopover mounts its facts after opening. Place this read with its full height.
    const panel = body.current?.closest<HTMLElement>("[data-atomic-popover]");
    const trigger = panel && document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(panel.id)}"]`);
    if (panel && trigger) placeAtomicPopover(panel, trigger);
  });
  return <section ref={body} className={styles.serviceFacts} data-service-reference={id}>{children}</section>;
}

/** Reads only the authorized card already in Composer. No fetch, draft or writer. */
export function HairdresserReference({ model, id, focus }: { model: ComposerUiModel; id: string; focus: () => void }) {
  const card = model.board.contexts.find(card => card.contextOccurrenceId === id);
  if (!card || !isHairdresserReference(model, card)) return null;
  const context = record(card.fields.context), place = record(context.place), project = record(context.project);
  const incomplete = card.knowledge !== "KNOWN" || Array.isArray(project.unpricedComponents) && project.unpricedComponents.length > 0;
  const lines = hairdresserReferenceLines(card);
  const placeLabel = place.kind === "TEXT" ? text(place.label) : place.kind === "KNOWN"
    ? model.mobilityOptions?.places.find(candidate => candidate.placeId === place.placeId)?.name ?? "Lieu lié indisponible" : null;
  return <div className={styles.hairdresserReference} data-hairdresser-reference={id}>
    <AtomicPopover label={`Voir cette prestation · ${card.label}`} state="DERIVED" focus={focus}
      icon={<><Eye size={14} /><span>Voir cette prestation</span></>}>
      {() => <HairdresserFacts id={card.externalIntentId!}>
        <p>Lecture seule · dépense déjà référencée dans ce mois.</p>
        <dl>
          <dt>Prestation référencée</dt><dd>{card.label}</dd>
          <dt>Prestataire indiqué</dt><dd>{text(context.seller) ?? "Non renseigné"}</dd>
          <dt>Lieu indiqué</dt><dd>{placeLabel ?? "Non renseigné"}</dd>
          <dt>Date indiquée</dt><dd>{typeof card.fields.plannedDate === "string"
            ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${card.fields.plannedDate}T12:00:00Z`)) : "Non renseignée"}</dd>
          <dt>Statut de la dépense</dt><dd>Non publié dans cette vue</dd>
        </dl>
        {lines.map((line, index) => {
          const amount = text(line.unitAmount);
          const known = !incomplete && amount !== null && /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount) && Number.isFinite(Number(amount));
          return <div key={text(line.id) ?? index} data-service-line={text(line.id)}>
            <strong>{text(line.label) ?? "Prestation sans libellé"}</strong>
            <p>Prix unitaire indiqué · {known ? money(amount) : "Inconnu / budget incomplet"}</p>
            <p>Quantité indiquée · {text(line.quantity) ?? "Non renseignée"}</p>
            <p>{priceSources[text(line.priceSource) ?? ""] ?? "Source du prix non renseignée"}</p>
          </div>;
        })}
        <p>Cette référence et sa date ne prouvent ni un rendez-vous réservé ni un paiement. Aucune modification n’est disponible ici.</p>
      </HairdresserFacts>}
    </AtomicPopover>
  </div>;
}
