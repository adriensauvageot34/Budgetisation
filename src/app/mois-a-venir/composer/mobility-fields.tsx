"use client";

import { useState } from "react";
import type { ComposerField } from "@/domain/phase2/planner/composer-ui-contract";
import styles from "./composer.module.css";

const sections = [
  { key: "route", label: "Trajet", fields: ["origin", "destination"] },
  { key: "cost", label: "Frais", fields: ["costMode", "amount", "preference", "parkingMode", "parkingAmount"] },
  { key: "funding", label: "Financement", fields: ["funding", "fundingAmount"] },
  { key: "time", label: "Horaires et retour", fields: ["returnRequired", "plannedTime", "returnTime"] },
  { key: "sharing", label: "Trajet partagé", fields: ["targetIntentId"] },
] as const;

/** Group the fields published by Mobility. No inferred mode, price or journey. */
export function mobilityFieldGroups(fields: readonly ComposerField[]) {
  const known = new Set<string>(sections.flatMap(section => [...section.fields]));
  return [...sections.map(section => ({ key: section.key as string, label: section.label as string,
    fields: fields.filter(field => (section.fields as readonly string[]).includes(field.key)) })),
    { key: "other", label: "Autres précisions", fields: fields.filter(field => !known.has(field.key)) }]
    .filter(section => section.fields.length);
}

export function MobilityFields({ fields, values, preserved, focusField, busy, change }: {
  fields: readonly ComposerField[]; values: Readonly<Record<string, string>>; preserved: Readonly<Record<string, string>>;
  focusField?: string; busy: boolean; change(key: string, value: string): void;
}) {
  const groups = mobilityFieldGroups(fields);
  const [selected, setSelected] = useState(() => groups.find(group => group.fields.some(field => field.key === focusField))?.key ?? groups[0]?.key);
  const active = groups.find(group => group.key === selected) ?? groups[0];
  return <div data-mobility-fields>
    <nav className={styles.mobilitySections} aria-label="Précisions du déplacement">{groups.map(group =>
      <button type="button" key={group.key} disabled={busy} aria-current={active?.key === group.key ? "step" : undefined}
        onClick={() => setSelected(group.key)}>{group.label}</button>)}</nav>
    <fieldset disabled={busy} className={styles.nightQuestion}><legend>{active?.label}</legend>
      {active?.fields.map(field => <label key={field.key}>{field.label}{field.kind === "CHOICE"
        ? <select name={field.key} value={values[field.key] ?? field.choices?.[0]?.value ?? ""} onChange={event => change(field.key, event.target.value)}>
          {field.choices?.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          {field.key === "funding" && preserved.funding === "EXISTING" && <option value="EXISTING">Conserver le financement antérieur</option>}
          {field.key === "parkingMode" && preserved.parkingMode === "EXISTING" && <option value="EXISTING">Conserver le devis de stationnement</option>}
        </select>
        : <input name={field.key} value={values[field.key] ?? preserved[field.key] ?? field.initial ?? ""} autoComplete="off"
          onChange={event => change(field.key, event.target.value)} inputMode={field.kind === "AMOUNT" ? "decimal" : undefined} />}</label>)}
    </fieldset>
    {active?.key === "cost" && <p>Le parking appartient au trajet en voiture. Un billet ou une course reste un montant déclaré pour le trajet complet. Les péages et le carburant restent évalués par Mobility.</p>}
    {active?.key === "sharing" && <p>Un trajet partagé conserve les frais sur le trajet propriétaire. Aucun second billet ni parking n’est ajouté automatiquement.</p>}
  </div>;
}
