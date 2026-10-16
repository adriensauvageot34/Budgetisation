import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { SemanticMutation } from "@/domain/phase2/planner/adjustment-contract";
import { InlineControlValue } from "@/app/mois-a-venir/composer/inline-control-value";
import { InlineEditContext, useOwnedInlineEdits } from "@/app/mois-a-venir/composer/inline-edit-registry";
import styles from "@/app/mois-a-venir/composer/composer.module.css";

/** Component lifecycle probe only: no Compiler replacement, price calculation,
 * HTTP, storage or real Draft. Two identical labels have distinct identities. */
function LifecycleProbe() {
  const [visible, setVisible] = useState(true), [amounts, setAmounts] = useState({ A: "250.00", B: "50.00" });
  const [events, setEvents] = useState<SemanticMutation[]>([]), edits = useOwnedInlineEdits();
  const card = (id: "A" | "B") => ({ targetRef: id, label: "Objet identique", value: { amount: amounts[id], decisionValue: { amount: amounts[id] } },
    capability: { fields: { amount: { status: "EDITABLE", minimum: "0.00", maximum: "999999999.99", integer: false, step: "5.00" } } } }) as unknown as ComposerCardView;
  const mutate = (mutation: SemanticMutation) => {
    if (mutation.kind !== "SET_STATE" || !["A", "B"].includes(mutation.targetRef) || typeof mutation.value.amount !== "string") throw Error("PROBE_UNEXPECTED_MUTATION");
    setEvents(previous => [...previous, mutation]); setAmounts(previous => ({ ...previous, [mutation.targetRef]: mutation.value.amount as string }));
  };
  return <InlineEditContext.Provider value={edits.registry}><h1>C1 · cycle de vie isolé</h1>
    <p>Aucune donnée distante, aucun calcul financier.</p>
    <button data-toggle-a onPointerDown={() => setVisible(value => !value)}>{visible ? "Démonter A" : "Remonter A"}</button>
    {(["A", "B"] as const).map(id => (id !== "A" || visible) && <section key={id} data-probe-card={id} className={styles.card} style={{ width: 300, margin: 12 }}>
      <h2>Objet identique · {id}</h2><InlineControlValue card={card(id)} dimension="amount" busy={false} focus={() => {}} mutate={mutate} /></section>)}
    <output data-probe-events>{JSON.stringify(events)}</output><output data-probe-count>{edits.count}</output>
  </InlineEditContext.Provider>;
}
createRoot(document.getElementById("root")!).render(<LifecycleProbe />);
