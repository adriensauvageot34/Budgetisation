import { useState } from "react";
import { MapPin, Plus, Users } from "lucide-react";
import type { ProspectivePersonRef, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";
import type { ComposerContextCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import { barPersonLabel, barPlaceLabel } from "./bar-living-details";
import { barEndpointLabel } from "./bar-place-knowledge";
import { barSearchText } from "./bar-search";
import { ContextPalette, type PaletteQuestion } from "./context-palette";
import styles from "./composer.module.css";

export type CardReferenceKind = "place" | "people";
type ReferenceKey = "placeRef" | "destinationRef" | "participantRefs" | "recipientRef";

function referenceKey(card: ComposerContextCardView, model: ComposerUiModel, kind: CardReferenceKind): ReferenceKey | undefined {
  const keys: readonly ReferenceKey[] = kind === "place" ? ["placeRef", "destinationRef"] : ["participantRefs", "recipientRef"];
  const editor = model.editors.find(editor => editor.assetKey === `template:${card.templateKey}`);
  return keys.find(key => editor?.fields.some(field => field.key === key));
}

function peopleOnCard(card: ComposerContextCardView, key: ReferenceKey) {
  const refs = card.fields[key];
  return (key === "participantRefs" ? Array.isArray(refs) ? refs : [] : refs ? [refs] : []) as readonly ProspectivePersonRef[];
}

export function CardReferenceChip({ card, model, kind, filled, editable, busy, open }: {
  card: ComposerContextCardView; model: ComposerUiModel; kind: CardReferenceKind; filled?: boolean;
  editable: boolean; busy: boolean; open?: (kind: CardReferenceKind) => void;
}) {
  const key = referenceKey(card, model, kind);
  if (!key) return null;
  const place = kind === "place" ? card.fields[key] as ProspectivePlaceRef | undefined : undefined;
  const names = kind === "people" ? peopleOnCard(card, key).map(person => barPersonLabel(person, model)) : [];
  const hasValue = !!place || names.length > 0;
  if (kind === "place" && !!filled !== hasValue || !hasValue && (!editable || !open)) return null;
  const caption = place ? barPlaceLabel(place, model) : names.length ? names.join(", ") : undefined;
  const short = names.length > 1 ? `${names[0]} +${names.length - 1}` : caption;
  const title = kind === "place" ? "Lieu" : key === "recipientRef" ? "Destinataire" : "Personnes";
  const Icon = !hasValue ? Plus : kind === "place" ? MapPin : Users;
  const content = <><Icon size={13} aria-hidden="true" /><span>{short ?? title}</span></>;
  if (!editable || !open) return <span className={styles.contextReferenceChip} title={caption}>{content}</span>;
  return <button type="button" className={styles.contextReferenceChip} data-context-reference={kind}
    disabled={busy} title={caption} aria-label={caption ? `Modifier · ${title} · ${caption}` : `Ajouter · ${title}`}
    onClick={() => open(kind)}>{content}</button>;
}

export function CardReferenceDock({ card, model, kind, busy, close, request }: {
  card: ComposerContextCardView; model: ComposerUiModel; kind: CardReferenceKind; busy: boolean;
  close: () => void; request: (operation: ComposerOperation) => boolean | void;
}) {
  const [query, setQuery] = useState("");
  const key = referenceKey(card, model, kind);
  if (!key) return null;
  const typed = query.trim().slice(0, 120);
  const needle = barSearchText(typed);
  const matches = (label: string) => barSearchText(label).includes(needle);
  const save = (value: PlannerJson, keepOpen = false) => {
    const contextOccurrenceId = card.contextOccurrenceId, values = { [key]: value };
    const operation: ComposerOperation = card.templateKey === "night-out"
      ? { kind: "EDIT_NIGHT_OUT", edit: { contextOccurrenceId, fields: values } }
      : { kind: "EDIT_CONTEXT", contextOccurrenceId, values };
    if (request(operation) !== false) {
      if (keepOpen) setQuery("");
      else close();
    }
  };
  const choices: PaletteQuestion["choices"][number][] = [];
  if (kind === "place") {
    const current = card.fields[key] as ProspectivePlaceRef | undefined;
    const places = model.mobilityOptions?.places ?? [];
    const sorted = [...places].filter(place => matches(`${place.name} ${place.commune ?? ""} ${barEndpointLabel(place)}`))
      .sort((a, b) => Number(b.placeId === (current?.kind === "KNOWN" ? current.placeId : null))
        - Number(a.placeId === (current?.kind === "KNOWN" ? current.placeId : null))
        || (b.visits12Months ?? 0) - (a.visits12Months ?? 0) || a.name.localeCompare(b.name, "fr"));
    if (typed && !sorted.some(place => barSearchText(place.name) === needle || barSearchText(barEndpointLabel(place)) === needle)) {
      choices.push({ key: "new-place", label: `Utiliser « ${typed} »`, iconKey: "place",
        choose: () => save({ kind: "TEXT", label: typed, provenance: "USER_DECLARED_PROSPECTIVE" }) });
    }
    choices.push(...sorted.map(place => ({
      key: place.placeId, label: barEndpointLabel(place), iconKey: "place",
      selected: current?.kind === "KNOWN" && current.placeId === place.placeId,
      choose: () => save({ kind: "KNOWN", placeId: place.placeId }),
    })));
    if (current) choices.unshift({ key: "clear-place", label: "Retirer le lieu", iconKey: "place", choose: () => save(null) });
  } else {
    const participants = peopleOnCard(card, key), multiple = key === "participantRefs";
    const active = new Set(participants.map(prospectivePersonIdentity));
    const candidates: ProspectivePersonRef[] = [
      ...participants,
      ...model.householdPersons.map(person => ({ kind: "HOUSEHOLD_PERSON" as const, personId: person.personId })),
      ...SOCIAL_CONTACTS_V1.map(contact => ({ kind: "CONTACT" as const, contactKey: contact.key })),
    ];
    const byIdentity = new Map(candidates.map(person => [prospectivePersonIdentity(person), person]));
    const choose = (person: ProspectivePersonRef) => {
      if (!multiple) { save(person); return; }
      const id = prospectivePersonIdentity(person);
      if (active.has(id)) save(participants.filter(value => prospectivePersonIdentity(value) !== id), true);
      else if (participants.length < 50) save([...participants, person], true);
    };
    if (typed && !candidates.some(person => barSearchText(barPersonLabel(person, model)) === needle)) {
      choices.push({ key: "new-person", label: `Ajouter « ${typed} »`, iconKey: "people",
        choose: () => choose({ kind: "TEXT", label: typed }) });
    }
    for (const [id, person] of byIdentity) {
      const label = barPersonLabel(person, model);
      if (matches(label)) choices.push({ key: id, label, iconKey: "people", selected: active.has(id), choose: () => choose(person) });
    }
    if (!multiple && participants.length) choices.unshift({ key: "clear-person", label: "Retirer le destinataire", iconKey: "people", choose: () => save(null) });
  }
  const title = kind === "place" ? "Lieu" : key === "recipientRef" ? "Destinataire" : "Personnes";
  return <div data-card-reference-dock onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
    <ContextPalette card={card} model={model} busy={busy} choose={() => {}} close={close} appearance="bar"
      question={{ title: `${title} · ${card.label}`, nature: kind === "people" ? "PEOPLE" : "PLACE_FAVORITES", choices,
        search: { value: query, change: setQuery, label: kind === "place" ? "Rechercher ou saisir un lieu" : "Rechercher ou saisir un nom" },
        filterChoices: false, hideCatalog: true, dismissible: true }} />
  </div>;
}
