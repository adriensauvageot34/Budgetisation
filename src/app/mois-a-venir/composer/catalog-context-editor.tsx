"use client";

import { useRef, useState } from "react";
import { useWorkshopRaw } from "./inline-edit-registry";
import type { ProspectivePersonRef, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComponentSelectionV1 } from "@/domain/phase2/planner/component-contract";
import type { ComposerEditor, ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { PlannedContactField } from "../planned-people-fields";
import { PlannedPlaceField } from "../planned-place-field";
import { ContactPlaceReference } from "./workshop-place-reference";
import { CardKnowledgePanel } from "./card-knowledge-panel";
import type { CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import { WorkshopDock } from "./workshop-dock";
import type { ContextPalette } from "./context-palette";
import styles from "./composer.module.css";

type Values = Record<string, PlannerJson>;
const person = (value: PlannerJson | undefined): ProspectivePersonRef | undefined => value && typeof value === "object" && !Array.isArray(value)
  && ["HOUSEHOLD_PERSON", "CONTACT", "TEXT"].includes(String((value as Record<string, PlannerJson>).kind)) ? value as ProspectivePersonRef : undefined;
const place = (value: PlannerJson | undefined): ProspectivePlaceRef | undefined => value && typeof value === "object" && !Array.isArray(value)
  && ["KNOWN", "TEXT"].includes(String((value as Record<string, PlannerJson>).kind)) ? value as ProspectivePlaceRef : undefined;
const participants = (value: PlannerJson | undefined): ProspectivePersonRef[] => Array.isArray(value)
  ? value.flatMap(item => person(item) ? [person(item)!] : []) : [];

/** Edits only published context fields. Equipment remains attached through its R6 sockets. */
export function CatalogContextEditor({ context, editor, targetMonth, householdPersons, options, knowledge, busy, model, dockHost, choose, placeDeclines = [], declinePlace = () => {}, onSave, onCancel }: {
  context: PlannedContextState; editor: ComposerEditor; targetMonth: string;
  householdPersons: ComposerUiModel["householdPersons"]; options?: ComposerUiModel["mobilityOptions"];
  knowledge?: CardKnowledgeRead;
  placeDeclines?: readonly string[]; declinePlace?: (key: string) => void;
  model: ComposerUiModel; dockHost?: HTMLElement | null; choose: Parameters<typeof ContextPalette>[0]["choose"];
  busy: boolean; onSave: (operation: ComposerOperation) => boolean; onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(() => Object.fromEntries(editor.fields.map(field => [field.key, context.fields[field.key] ?? null])) as Values);
  const [error, setError] = useState("");
  const acceptedValues = useRef(values), initialValues = acceptedValues.current;
  useWorkshopRaw(context.contextOccurrenceId, JSON.stringify(values) !== JSON.stringify(initialValues), () => {
    setValues(initialValues); setError("");
  });
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [summaryPage, setSummaryPage] = useState(0);
  const posts = Object.entries(context.slotSelections).flatMap(([slotKey, slot]) =>
    ((slot.items ?? []) as readonly ComponentSelectionV1[]).flatMap(item => item.kind === "COMPONENT" ? [{ slotKey, item }] : []));
  const [summaryTab, setSummaryTab] = useState<"fields" | "posts">(posts.length ? "posts" : "fields");
  const [postPage, setPostPage] = useState(0), [personPage, setPersonPage] = useState(0);
  const update = (key: string, value: PlannerJson) => setValues(previous => ({ ...previous, [key]: value }));
  const save = () => {
    try {
      setError("");
      const patch: Values = {};
      for (const field of editor.fields) {
        const raw = values[field.key] ?? null;
        const value = typeof raw === "string" ? raw.trim() : raw;
        const personValue = person(value), placeValue = place(value);
        if (field.kind === "PERSON_REF" && personValue?.kind === "TEXT" && !personValue.label.trim()
          || field.kind === "PLACE_REF" && placeValue?.kind === "TEXT" && !placeValue.label.trim())
          throw Error("Précisez le nom de la personne ou du lieu, ou laissez ce champ inconnu.");
        if (field.kind === "PERSON_REFS") {
          const refs = participants(value);
          if (refs.some(ref => ref.kind === "TEXT" && !ref.label.trim()) || new Set(refs.map(prospectivePersonIdentity)).size !== refs.length)
            throw Error("Précisez chaque participant une seule fois, ou retirez la ligne vide.");
        }
        if (field.kind === "DATE" && value && typeof value === "string" && !value.startsWith(`${targetMonth}-`))
          throw Error("La date doit appartenir au mois composé.");
        const normalized = field.kind === "COUNT" ? value === "" || value === null ? null : Number(value) : value;
        if (field.kind === "COUNT" && normalized !== null && (typeof normalized !== "number" || !Number.isInteger(normalized) || normalized < 1 || normalized > 366))
          throw Error("Indiquez un nombre entier admissible, ou laissez-le inconnu.");
        const original = context.fields[field.key] ?? null;
        if (JSON.stringify(normalized) !== JSON.stringify(original)) patch[field.key] = normalized;
      }
      if (!Object.keys(patch).length) { acceptedValues.current = values; setActiveKey(null); return; }
      if (onSave({ kind: "EDIT_CONTEXT", contextOccurrenceId: context.contextOccurrenceId, values: patch })) { acceptedValues.current = values; setActiveKey(null); }
      else setError("Ce choix n’a pas été admis. Le brouillon local reste disponible.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez les champs du moment."); }
  };
  return <div data-catalog-context-editor={context.templateKey} className={styles.nightEditor}>
    <p className={styles.helper}>Les personnes, lieux et dates restent liés à ce moment. Les produits et autres équipements se choisissent dans la palette du Board ; le parent n’ajoute aucun coût.</p>
    {activeKey === null && <section className={styles.nightSection} data-catalog-summary><h3>{String(context.fields.label ?? "Votre intention")}</h3>
      <p>Choisissez uniquement la précision utile maintenant. Les autres informations restent inconnues.</p>
      {!!posts.length && <nav className={styles.nightNav} aria-label="Résumé de l’intention"><button type="button" aria-pressed={summaryTab === "fields"} onClick={() => setSummaryTab("fields")}>Informations</button><button type="button" aria-pressed={summaryTab === "posts"} onClick={() => setSummaryTab("posts")}>Postes ({posts.length})</button></nav>}
      {summaryTab === "fields" && editor.fields.slice(summaryPage * 3, summaryPage * 3 + 3).map(field => <button key={field.key} type="button" onClick={() => setActiveKey(field.key)}>
        {field.label} · {typeof values[field.key] === "string" || typeof values[field.key] === "number" ? String(values[field.key] || "À préciser") : values[field.key] ? "Choix conservé" : "À préciser"}</button>)}
      {summaryTab === "fields" && editor.fields.length > 3 && <div className={styles.nightPage}><button type="button" disabled={summaryPage === 0} onClick={() => setSummaryPage(page => page - 1)}>Précédent</button><span>{summaryPage + 1} / {Math.ceil(editor.fields.length / 3)}</span><button type="button" disabled={(summaryPage + 1) * 3 >= editor.fields.length} onClick={() => setSummaryPage(page => page + 1)}>Suivant</button></div>}
      {summaryTab === "posts" && posts.slice(postPage * 3, postPage * 3 + 3).map(({slotKey, item}) => <button key={item.selectionId} type="button" onClick={() => {
        const asset = model.library.searchableAssets.find(asset => asset.assetKey === `option:${context.templateKey}:${slotKey}:${item.optionKey}`);
        if (asset) choose(asset, { kind: "CONTEXT_SOCKET", contextOccurrenceId: context.contextOccurrenceId, slotKey }, item);
      }}>Modifier {item.label} · {item.cost.kind === "MANUAL" ? `${item.quantity} × ${item.cost.unitAmount} €` : "Prix inconnu ou devis conservé"}</button>)}
      {summaryTab === "posts" && posts.length > 3 && <div className={styles.nightPage}><button type="button" disabled={postPage === 0} onClick={() => setPostPage(page => page - 1)}>Précédent</button><span>{postPage + 1} / {Math.ceil(posts.length / 3)}</span><button type="button" disabled={(postPage + 1) * 3 >= posts.length} onClick={() => setPostPage(page => page + 1)}>Suivant</button></div>}
      <p>Choisissez les composants réels et leur prix dans le dock sous le Board.</p></section>}
    {activeKey !== null && <details><summary>Repères et provenance</summary><CardKnowledgePanel knowledge={knowledge} /></details>}
    <div className={styles.nightEditorScroll}><div className={styles.formFields}>{editor.fields.filter(field => field.key === activeKey).map(field => {
      const value = values[field.key];
      if (field.kind === "PERSON_REF") return <PlannedContactField key={field.key} label={field.label} value={person(value)} householdPersons={householdPersons}
        onChange={ref => update(field.key, ref ?? null)} />;
      if (field.kind === "PLACE_REF") return <div key={field.key}>
        {context.templateKey === "friend-visit" && <ContactPlaceReference declined={placeDeclines} decline={declinePlace} contact={person(values.personVisitedRef)} places={options?.places ?? []} value={place(value)} friend onChoose={ref => update(field.key, ref)} />}
        <PlannedPlaceField label={field.label} places={options?.places ?? []} value={place(value)} exact onChange={ref => update(field.key, ref ?? null)} /></div>;
      if (field.kind === "PERSON_REFS") return <fieldset key={field.key}><legend>{field.label}</legend>
        {participants(value).slice(personPage, personPage + 1).map((ref, offset) => { const index = personPage + offset; return <div key={`${prospectivePersonIdentity(ref)}:${index}`}>
          <PlannedContactField label={`Personne ${index + 1}`} value={ref} householdPersons={householdPersons}
            onChange={next => update(field.key, participants(value).map((current, i) => i === index ? next ?? { kind: "TEXT", label: "" } : current))} />
          <button type="button" onClick={() => update(field.key, participants(value).filter((_, i) => i !== index))}>Retirer cette personne</button>
        </div>; })}
        <div className={styles.nightPage}><button type="button" disabled={personPage === 0} onClick={() => setPersonPage(page => page - 1)}>Précédent</button><span>{participants(value).length ? personPage + 1 : 0} / {participants(value).length}</span><button type="button" disabled={personPage + 1 >= participants(value).length} onClick={() => setPersonPage(page => page + 1)}>Suivant</button></div>
        <button type="button" onClick={() => { setPersonPage(participants(value).length); update(field.key, [...participants(value), { kind: "TEXT", label: "" }]); }}>Ajouter une personne</button>
      </fieldset>;
      return <label key={field.key}>{field.label}{field.kind === "CHOICE" ? <select value={typeof value === "string" ? value : ""}
        onChange={event => update(field.key, event.target.value || null)}><option value="">À préciser</option>{field.choices?.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
        : <input type={field.kind === "DATE" ? "date" : field.kind === "COUNT" ? "number" : "text"} min={field.kind === "COUNT" ? 1 : undefined}
          max={field.kind === "COUNT" ? 366 : undefined} value={typeof value === "string" || typeof value === "number" ? value : ""}
          onChange={event => update(field.key, event.target.value)} autoComplete="off" />}</label>;
    })}</div></div>
    <WorkshopDock host={dockHost} contextId={context.contextOccurrenceId} model={model} busy={busy} choose={choose} summary={() => setActiveKey(null)}
      choices={[{ key: "summary", label: "Résumé", iconKey: "activity", selected: activeKey === null, choose: () => setActiveKey(null) },
        ...editor.fields.map(field => ({ key: field.key, label: field.label, iconKey: "activity", selected: activeKey === field.key, choose: () => setActiveKey(field.key) }))]} />
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <footer><button type="button" className={styles.secondary} disabled={busy} onClick={activeKey === null ? onCancel : () => setActiveKey(null)}>{activeKey === null ? "Retour au mois" : "Retour au résumé"}</button>
      {activeKey !== null && <button type="button" className={styles.primary} disabled={busy} onClick={save}>Conserver et prévisualiser</button>}</footer>
  </div>;
}
