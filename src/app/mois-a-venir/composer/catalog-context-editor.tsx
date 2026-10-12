"use client";

import { useState } from "react";
import type { ProspectivePersonRef, ProspectivePlaceRef } from "@/domain/phase2/planned-contract";
import { prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import type { PlannerJson } from "@/domain/phase2/planner/json";
import type { PlannedContextState } from "@/domain/phase2/planner/semantic-state";
import type { ComposerEditor, ComposerOperation, ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import { PlannedContactField } from "../planned-people-fields";
import { PlannedPlaceField } from "../planned-place-field";
import { CardKnowledgePanel } from "./card-knowledge-panel";
import type { CardKnowledgeRead } from "@/domain/phase2/planner/card-knowledge-contract";
import styles from "./composer.module.css";

type Values = Record<string, PlannerJson>;
const person = (value: PlannerJson | undefined): ProspectivePersonRef | undefined => value && typeof value === "object" && !Array.isArray(value)
  && ["HOUSEHOLD_PERSON", "CONTACT", "TEXT"].includes(String((value as Record<string, PlannerJson>).kind)) ? value as ProspectivePersonRef : undefined;
const place = (value: PlannerJson | undefined): ProspectivePlaceRef | undefined => value && typeof value === "object" && !Array.isArray(value)
  && ["KNOWN", "TEXT"].includes(String((value as Record<string, PlannerJson>).kind)) ? value as ProspectivePlaceRef : undefined;
const participants = (value: PlannerJson | undefined): ProspectivePersonRef[] => Array.isArray(value)
  ? value.flatMap(item => person(item) ? [person(item)!] : []) : [];

/** Edits only published context fields. Equipment remains attached through its R6 sockets. */
export function CatalogContextEditor({ context, editor, targetMonth, householdPersons, options, knowledge, busy, onSave, onCancel }: {
  context: PlannedContextState; editor: ComposerEditor; targetMonth: string;
  householdPersons: ComposerUiModel["householdPersons"]; options?: ComposerUiModel["mobilityOptions"];
  knowledge?: CardKnowledgeRead;
  busy: boolean; onSave: (operation: ComposerOperation) => void; onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(() => Object.fromEntries(editor.fields.map(field => [field.key, context.fields[field.key] ?? null])) as Values);
  const [error, setError] = useState("");
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
      if (!Object.keys(patch).length) { onCancel(); return; }
      onSave({ kind: "EDIT_CONTEXT", contextOccurrenceId: context.contextOccurrenceId, values: patch });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Vérifiez les champs du moment."); }
  };
  return <div data-catalog-context-editor={context.templateKey} className={styles.nightEditor}>
    <p className={styles.helper}>Les personnes, lieux et dates restent liés à ce moment. Les équipements et leurs prix se configurent depuis la carte sur le Board ; le parent n’ajoute aucun coût.</p>
    <CardKnowledgePanel knowledge={knowledge} />
    <div className={styles.nightEditorScroll}><div className={styles.formFields}>{editor.fields.map(field => {
      const value = values[field.key];
      if (field.kind === "PERSON_REF") return <PlannedContactField key={field.key} label={field.label} value={person(value)} householdPersons={householdPersons}
        onChange={ref => update(field.key, ref ?? null)} />;
      if (field.kind === "PLACE_REF") return <PlannedPlaceField key={field.key} label={field.label} places={options?.places ?? []} value={place(value)} exact
        onChange={ref => update(field.key, ref ?? null)} />;
      if (field.kind === "PERSON_REFS") return <fieldset key={field.key}><legend>{field.label}</legend>
        {participants(value).map((ref, index) => <div key={`${prospectivePersonIdentity(ref)}:${index}`}>
          <PlannedContactField label={`Personne ${index + 1}`} value={ref} householdPersons={householdPersons}
            onChange={next => update(field.key, participants(value).map((current, i) => i === index ? next ?? { kind: "TEXT", label: "" } : current))} />
          <button type="button" onClick={() => update(field.key, participants(value).filter((_, i) => i !== index))}>Retirer cette personne</button>
        </div>)}
        <button type="button" onClick={() => update(field.key, [...participants(value), { kind: "TEXT", label: "" }])}>Ajouter une personne</button>
      </fieldset>;
      return <label key={field.key}>{field.label}{field.kind === "CHOICE" ? <select value={typeof value === "string" ? value : ""}
        onChange={event => update(field.key, event.target.value || null)}><option value="">À préciser</option>{field.choices?.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
        : <input type={field.kind === "DATE" ? "date" : field.kind === "COUNT" ? "number" : "text"} min={field.kind === "COUNT" ? 1 : undefined}
          max={field.kind === "COUNT" ? 366 : undefined} value={typeof value === "string" || typeof value === "number" ? value : ""}
          onChange={event => update(field.key, event.target.value)} autoComplete="off" />}</label>;
    })}</div></div>
    {error && <p role="alert" className={styles.formError}>{error}</p>}
    <footer><button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>Retour au mois</button>
      <button type="button" className={styles.primary} disabled={busy} onClick={save}>Prévisualiser ce moment</button></footer>
  </div>;
}
