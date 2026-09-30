"use client";

import type { PlannedExpenseContext, ProspectivePersonRef } from "@/domain/phase2/planned-contract";
import { prospectivePersonIdentity } from "@/domain/phase2/planned-product";
import { SOCIAL_CONTACTS_V1 } from "@/domain/phase2/planned-rules";

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3";
export function PlannedContactField({ label, value, onChange }: { label: string; value?: ProspectivePersonRef;
  onChange: (ref?: ProspectivePersonRef) => void }) {
  return <div className="grid gap-2"><label className="grid gap-1 text-sm font-semibold">{label}
    <select className={fieldClass} value={value?.kind === "CONTACT" ? value.contactKey : value?.kind === "TEXT" ? "TEXT" : ""}
      onChange={(event) => onChange(event.target.value === "TEXT" ? { kind: "TEXT", label: "" }
        : event.target.value ? { kind: "CONTACT", contactKey: event.target.value } : undefined)}>
      <option value="">Choisir une personne</option>{SOCIAL_CONTACTS_V1.map((contact) => <option key={contact.key} value={contact.key}>{contact.label}</option>)}
      <option value="TEXT">Autre personne à saisir</option></select></label>
    {value?.kind === "TEXT" && <label className="grid gap-1 text-sm">Son nom<input className={fieldClass} value={value.label}
      onChange={(event) => onChange({ kind: "TEXT", label: event.target.value })} /></label>}
  </div>;
}

export function PlannedParticipants({ context, persons, onChange }: { context: PlannedExpenseContext;
  persons: readonly { personId: string; displayName: string }[]; onChange: (context: PlannedExpenseContext) => void }) {
  const refs = context.participantRefs ?? [];
  const toggleContact = (contactKey: string) => {
    const ref: ProspectivePersonRef = { kind: "CONTACT", contactKey };
    const has = refs.some((part) => prospectivePersonIdentity(part) === prospectivePersonIdentity(ref));
    onChange({ ...context, participantRefs: has ? refs.filter((part) => prospectivePersonIdentity(part) !== prospectivePersonIdentity(ref)) : [...refs, ref] });
  };
  return <fieldset className="grid gap-3"><legend className="text-sm font-bold">Qui participe aux dépenses ?</legend>
    <p className="text-xs text-slate-600">Ces personnes servent à proposer les quantités. Vous pouvez toujours les modifier.</p>
    <div className="flex gap-4">{persons.map((person) => <label key={person.personId} className="flex gap-2 text-sm">
      <input type="checkbox" checked={context.participantPersonIds?.includes(person.personId) ?? false} onChange={() => {
        const ids = context.participantPersonIds ?? [];
        onChange({ ...context, participantPersonIds: ids.includes(person.personId) ? ids.filter((id) => id !== person.personId) : [...ids, person.personId] });
      }} />{person.displayName}</label>)}</div>
    {context.host && <label className="flex gap-2 text-sm"><input type="checkbox" checked={context.hostParticipates ?? false}
      onChange={(event) => onChange({ ...context, hostParticipates: event.target.checked })} />La personne qui reçoit participe aux dépenses</label>}
    {context.personVisited && <label className="flex gap-2 text-sm"><input type="checkbox" checked={context.visitedPersonParticipates ?? false}
      onChange={(event) => onChange({ ...context, visitedPersonParticipates: event.target.checked })} />La personne visitée participe aux dépenses</label>}
    <details><summary className="cursor-pointer text-sm font-semibold">Ajouter des proches</summary><div className="mt-2 grid grid-cols-3 gap-2">{SOCIAL_CONTACTS_V1.map((contact) =>
      <label key={contact.key} className="flex gap-2 text-sm"><input type="checkbox" checked={refs.some((ref) => ref.kind === "CONTACT" && ref.contactKey === contact.key)}
        onChange={() => toggleContact(contact.key)} />{contact.label}</label>)}</div></details>
    {refs.map((ref, index) => ref.kind === "TEXT" && <label key={index} className="grid gap-1 text-sm">Autre participant<input className={fieldClass} value={ref.label}
      onChange={(event) => onChange({ ...context, participantRefs: refs.map((part, i) => i === index ? { kind: "TEXT", label: event.target.value } : part) })} />
      <button type="button" className="text-left underline" onClick={() => onChange({ ...context, participantRefs: refs.filter((_, i) => i !== index) })}>Retirer cette personne</button></label>)}
    <button type="button" className="text-left text-sm font-semibold underline" onClick={() => onChange({ ...context, participantRefs: [...refs, { kind: "TEXT", label: "" }] })}>Ajouter une personne par son nom</button>
    <label className="grid max-w-xs gap-1 text-sm">Invités non nommés<input className={fieldClass} type="number" min="0" max="99" value={context.additionalGuestCount ?? 0}
      onChange={(event) => onChange({ ...context, additionalGuestCount: Number(event.target.value) })} /></label>
  </fieldset>;
}
