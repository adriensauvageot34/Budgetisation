"use client";

import { useMemo, useState } from "react";
import {
  homeEquipment, homeEquipmentBaskets, homeEquipmentKey, homeEquipmentPurchases, homeLegacyEquipment,
  type HomeEquipment, type HomeEquipmentEdit,
} from "@/domain/phase2/planner/home-equipment";
import { componentId } from "@/domain/phase2/planner/identity";
import { plannerDigest } from "@/domain/phase2/planner/json";
import { purchaseComponents } from "@/domain/phase2/planner/purchase-basket";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import { catalogRefLocked } from "./catalog-discovery";
import { useWorkshopConfirmation } from "./workshop-confirmation";
import styles from "./composer.module.css";

const roomSuggestions = ["Lampe", "Étagère", "Chaise"];

export function HomeEquipmentEditor({ project, model, busy, onSave, openBasket, createBasket, suggestedLabel, legacyPurchases }: {
  project: PlannedContextState;
  model: ComposerUiModel;
  busy: boolean;
  onSave: (operation: ComposerOperation) => boolean;
  openBasket?: (id: string, selectionId?: string) => void;
  createBasket?: () => void;
  suggestedLabel?: string;
  legacyPurchases: readonly ComposerContextCardView[];
}) {
  const [label, setLabel] = useState(suggestedLabel ?? "");
  const [selectedId, setSelectedId] = useState<string>();
  const [feedback, setFeedback] = useState("");
  const confirm = useWorkshopConfirmation();
  const id = project.contextOccurrenceId;
  const items = useMemo(() => homeEquipment(project), [project]);
  const legacy = useMemo(() => homeLegacyEquipment(project), [project]);
  const baskets = useMemo(() => homeEquipmentBaskets(model.semanticState, project), [model.semanticState, project]);
  const cards = model.board.contexts;
  const writable = cards.some(card => card.contextOccurrenceId === id && !card.readOnly
    && card.capabilityRefs.includes("PATCH_CONTEXT")) && !catalogRefLocked(model, id);
  const availableBaskets = baskets.filter(basket => cards.some(card => card.contextOccurrenceId === basket.contextOccurrenceId
    && !card.readOnly && card.capabilityRefs.includes("PATCH_CONTEXT")) && !catalogRefLocked(model, basket.contextOccurrenceId));
  const findPurchases = (equipment: { id?: string; label: string }) => homeEquipmentPurchases(baskets, equipment);
  const known = new Set([...items, ...legacy, ...baskets.flatMap(basket => purchaseComponents(basket, "item"))]
    .map(item => homeEquipmentKey(item.label)));
  const suggestions = roomSuggestions.filter(item => !known.has(homeEquipmentKey(item)));

  const change = (next: HomeEquipmentEdit["change"]) => onSave({
    kind: "EDIT_HOME_EQUIPMENT",
    edit: { contextOccurrenceId: id, expectedContextDigest: plannerDigest(project), change: next },
  });
  const select = (item: { id?: string; label: string }) => {
    setSelectedId(item.id);
    setLabel(item.label);
    setFeedback("");
  };
  const record = (status: HomeEquipment["status"]) => {
    const key = homeEquipmentKey(label);
    if (!key || busy || !writable) return;
    const previous = items.find(item => homeEquipmentKey(item.label) === key);
    const oldLines = legacy.filter(item => homeEquipmentKey(item.label) === key);
    const legacyItem = legacy.find(item => item.selectionId === selectedId) ?? (oldLines.length === 1 ? oldLines[0] : undefined);
    const previousId = selectedId ?? previous?.id;
    const purchases = findPurchases({ id: previousId, label });
    if (purchases.length) {
      if (purchases.length === 1) openBasket?.(purchases[0].basket.contextOccurrenceId, purchases[0].line.selectionId);
      else setFeedback("Plusieurs lignes existent. Choisissez la ligne à reprendre dans les paniers liés.");
      return;
    }
    if (!selectedId && oldLines.length > 1) {
      setFeedback("Plusieurs postes portent ce nom. Choisissez le poste à reprendre.");
      return;
    }
    const equipment = { id: previousId ?? legacyItem?.selectionId ?? crypto.randomUUID(), label: label.trim(), status };
    const save = () => {
      if (change({ kind: "SET", equipment })) {
        setLabel("");
        setSelectedId(undefined);
        setFeedback("");
      }
    };
    if (legacyItem) confirm({
      message: `Reclasser « ${legacyItem.label} » ? Son ancien poste de coût sera retiré du projet.`,
      acceptLabel: "Reclasser l’équipement", accept: save,
    });
    else save();
  };
  const openLine = ({ basket, line }: ReturnType<typeof homeEquipmentPurchases>[number]) =>
    <button type="button" key={`${basket.contextOccurrenceId}:${line.selectionId}`} disabled={busy || !openBasket}
      onClick={() => openBasket?.(basket.contextOccurrenceId, line.selectionId)}>
      Reprendre {line.label}{baskets.length > 1 ? ` · ${basket.fields.label ?? "Panier"}` : ""}
    </button>;
  const planned = items.filter(item => item.status === "NEEDED").map(item => ({ item, purchases: findPurchases(item) }));

  return <section className={styles.homeEquipment} aria-label="Équipements du projet" data-home-equipment>
    <h4>Équipements du projet</h4>
    <p>Indiquez ce que vous avez déjà et ce qu’il reste à prévoir.</p>
    {items.some(item => item.status === "OWNED") && <div>
      <h5>Déjà possédés</h5>
      <ul>{items.filter(item => item.status === "OWNED").map(item =>
        <li key={item.id} data-home-equipment-id={item.id} data-home-equipment-state="OWNED">
          <span>{item.label}</span>
          <button type="button" disabled={!writable || busy} onClick={() => select(item)}>Modifier {item.label}</button>
        </li>)}</ul>
    </div>}
    {planned.some(row => !row.purchases.length) && <div>
      <h5>Besoins à satisfaire</h5>
      <ul>{planned.filter(row => !row.purchases.length).map(({ item }) =>
        <li key={item.id} data-home-equipment-id={item.id} data-home-equipment-state="NEEDED">
          <span>{item.label}</span>
          <button type="button" disabled={!writable || busy} onClick={() => select(item)}>Modifier {item.label}</button>
          {availableBaskets.map(basket => <button type="button" key={basket.contextOccurrenceId}
            disabled={!writable || busy} onClick={() => change({ kind: "BUY", id: item.id, basketId: basket.contextOccurrenceId,
              expectedBasketDigest: plannerDigest(basket) })}>
            Ajouter {item.label} {availableBaskets.length === 1 ? "au panier" : `dans ${basket.fields.label ?? "ce panier"}`}
          </button>)}
        </li>)}</ul>
      {!baskets.length && createBasket && <button type="button" disabled={!writable || busy} onClick={createBasket}>Préparer un panier Maison</button>}
      {!baskets.length && legacyPurchases.map(purchase => <button type="button" key={purchase.contextOccurrenceId}
        disabled={busy || !openBasket} onClick={() => openBasket?.(purchase.contextOccurrenceId)}>
        Ouvrir {purchase.label} pour le passer en panier
      </button>)}
    </div>}
    {!!baskets.some(basket => purchaseComponents(basket, "item").length) && <div>
      <h5>Articles dans les paniers</h5>
      <ul>{baskets.flatMap(basket => purchaseComponents(basket, "item").map(line =>
        <li key={`${basket.contextOccurrenceId}:${line.selectionId}`} data-home-equipment-id={line.selectionId} data-home-equipment-state="IN_BASKET">
          <span>{line.label} · Quantité {line.quantity}</span>{openLine({ basket, line })}
        </li>))}</ul>
    </div>}
    {!!legacy.length && <div>
      <h5>Postes d’équipement existants</h5>
      <ul>{legacy.map(item =>
        <li key={item.selectionId}><span>{item.label}</span>
          <button type="button" disabled={!writable || busy || catalogRefLocked(model, componentId(id, "items", item.selectionId))}
            onClick={() => select({ id: item.selectionId, label: item.label })}>Reclasser {item.label}</button>
        </li>)}</ul>
    </div>}
    {writable && <div>
      {!!suggestions.length && <div className={styles.linkedFilters} aria-label="Idées d’équipement">
        {suggestions.map(item => <button key={item} type="button" disabled={busy} onClick={() => select({ label: item })}>{item}</button>)}
      </div>}
      <label>Nom de l’équipement<input value={label} maxLength={120} disabled={busy}
        onChange={event => { setLabel(event.target.value); setFeedback(""); }} /></label>
      <div className={styles.linkedFilters}>
        <button type="button" disabled={busy || !homeEquipmentKey(label)} onClick={() => record("OWNED")}>Marquer comme déjà possédé</button>
        <button type="button" disabled={busy || !homeEquipmentKey(label)} onClick={() => record("NEEDED")}>Noter le besoin</button>
        {selectedId && items.some(item => item.id === selectedId) && <button type="button" disabled={busy}
          onClick={() => { if (change({ kind: "REMOVE", id: selectedId })) select({ label: "" }); }}>Retirer cet équipement</button>}
      </div>
    </div>}
    {feedback && <p role="status">{feedback}</p>}
  </section>;
}
