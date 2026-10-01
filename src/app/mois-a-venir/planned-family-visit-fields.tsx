"use client";
import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { MapPin } from "lucide-react";
import { changeBuilderContext, editBuilderDraft, type BuilderState } from "@/domain/phase2/planned-builder";
import { rankFamilyVisitContacts, visitTimingIssues } from "@/domain/phase2/planned-visits";
import type { PlannedPlaceOption } from "@/domain/phase2/planned-places";
import type { PlannedTripTiming, ProspectivePersonRef } from "@/domain/phase2/planned-contract";
import { ChoiceTiles, builderButton, builderInput } from "./planned-builder-primitives";

export function PlannedFamilyVisitFields({ builder, setBuilder, persons, places, targetMonth, placePicker }: {
  builder: BuilderState; setBuilder: Dispatch<SetStateAction<BuilderState>>;
  persons: readonly { personId: string; displayName: string }[]; places: readonly PlannedPlaceOption[];
  targetMonth: string; placePicker: ReactNode;
}) {
  const context = builder.draft.context, timing = context.visitTiming!;
  const [other, setOther] = useState(false), [changePlace, setChangePlace] = useState(false);
  const [returnStyle, setReturnStyle] = useState<"SAME" | "OTHER" | null>(timing.return.date ? timing.return.date === timing.outbound.date ? "SAME" : "OTHER" : null);
  const ranked = rankFamilyVisitContacts(places), top = ranked.slice(0, 2);
  const selected = context.personVisited?.kind === "CONTACT" ? ranked.find((part) => part.contact.key === (context.personVisited as { contactKey: string }).contactKey) : undefined;
  const selectContact = (ref: ProspectivePersonRef) => {
    setBuilder((state) => changeBuilderContext(state, { ...state.draft.context, personVisited: ref }));
    setChangePlace(false);
  };
  const updateTiming = (value: PlannedTripTiming) => setBuilder((state) => editBuilderDraft(state, { ...state.draft,
    plannedDate: value.outbound.date, context: { ...state.draft.context, visitTiming: value } }));
  const known = context.place?.kind === "KNOWN" ? places.find((p) => p.placeId === (context.place as { placeId: string }).placeId) : undefined;
  const participants = context.participantPersonIds ?? [];
  return <div className="grid gap-6">
    <div id="visit-participants"><ChoiceTiles label="Qui va voir la famille ?" choices={[...persons.map((p) => ({ key: p.personId, label: p.displayName })), { key: "BOTH", label: "Nous deux" }]}
      value={!participants.length ? undefined : participants.length === persons.length ? "BOTH" : participants[0]}
      onChange={(key) => setBuilder((state) => changeBuilderContext(state, { ...state.draft.context, participantPersonIds: key === "BOTH" ? persons.map((p) => p.personId) : [key] }))} /></div>
    {!!participants.length && <section className="grid gap-3"><h4 className="text-sm font-bold">Qui allez-vous voir ?</h4><div className="grid grid-cols-2 gap-3">
      {top.map(({ contact, primaryPlace, habitual, visitDays }) => <button type="button" key={contact.key} aria-pressed={selected?.contact.key === contact.key}
        className={`rounded-xl border p-4 text-left ${selected?.contact.key === contact.key ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white"}`}
        onClick={() => selectContact({ kind: "CONTACT", contactKey: contact.key })}><strong>{habitual ? "⭐ " : ""}{contact.label}</strong>
        <p className="mt-1 text-sm text-slate-600">{[contact.relationLabel, primaryPlace?.commune].filter(Boolean).join(" · ")}</p>
        {habitual && <p className="mt-2 text-xs text-slate-500" title={`${visitDays} jours observés à ce lieu sur les 12 derniers mois ; présence du contact non déduite.`}>Lieu habituel</p>}</button>)}
    </div><button type="button" className={`${builderButton} w-fit`} onClick={() => setOther(!other)}>+ Autre membre de la famille</button>
      {(other || context.personVisited?.kind === "TEXT" || selected && !top.includes(selected)) && <><ChoiceTiles label="Autre membre de la famille" value={selected?.contact.key ?? context.personVisited?.kind}
        choices={[...ranked.slice(2).map(({ contact }) => ({ key: contact.key, label: contact.label })), { key: "TEXT", label: "Quelqu’un d’autre" }]}
        onChange={(key) => selectContact(key === "TEXT" ? { kind: "TEXT", label: "" } : { kind: "CONTACT", contactKey: key })} />
        {context.personVisited?.kind === "TEXT" && <label className="grid max-w-sm gap-1 text-sm">Son nom<input className={builderInput} value={context.personVisited.label} onChange={(e) => selectContact({ kind: "TEXT", label: e.target.value })} /></label>}</>}
    </section>}
    {!!participants.length && context.personVisited && <>
      <section id="visit-place" className="grid gap-3">
        <h4 className="text-lg font-bold">Voir {selected?.contact.label ?? (context.personVisited.kind === "TEXT" ? context.personVisited.label : "la famille")}</h4>
        {context.place && !changePlace ? <p className="flex items-center gap-2 text-sm"><MapPin size={16} />{known?.commune ?? known?.name ?? (context.place.kind === "TEXT" ? context.place.label : "Lieu choisi")}
          <button type="button" className="ml-2 text-indigo-700 underline" onClick={() => setChangePlace(true)}>Changer</button></p> : <><p className="text-sm font-semibold">Où allez-vous le voir ?</p>{placePicker}</>}
      </section>
      <section id="visit-outbound" className="grid gap-2"><h4 className="text-sm font-bold">Quand partez-vous ?</h4><div className="grid max-w-xl grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">Départ<input type="date" className={builderInput} min={`${targetMonth}-01`} max={new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 0)).toISOString().slice(0, 10)} value={timing.outbound.date ?? ""}
          onChange={(e) => { const date = e.target.value || null; updateTiming({ ...timing, outbound: { date, time: date ? timing.outbound.time : null }, return: { ...timing.return, ...(returnStyle === "SAME" ? { date, time: date ? timing.return.time : null } : {}) } }); }} /></label>
        <label className="grid gap-1 text-sm">Heure de départ · facultative<input type="time" className={builderInput} disabled={!timing.outbound.date} value={timing.outbound.time ?? ""} onChange={(e) => updateTiming({ ...timing, outbound: { ...timing.outbound, time: e.target.value || null } })} /></label>
      </div></section>
      <section id="visit-return" className="grid gap-3"><ChoiceTiles label="Quand rentrez-vous ?" value={returnStyle ?? undefined} choices={[{ key: "SAME", label: "Le même jour" }, { key: "OTHER", label: "Un autre jour" }]}
        onChange={(key) => { setReturnStyle(key as "SAME" | "OTHER"); updateTiming({ ...timing, return: { required: true, date: key === "SAME" ? timing.outbound.date : null, time: null } }); }} />
        {returnStyle && <div className="grid max-w-xl grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm">Retour au domicile<input type="date" className={builderInput} disabled={returnStyle === "SAME"} value={timing.return.date ?? ""} min={timing.outbound.date ?? undefined} onChange={(e) => updateTiming({ ...timing, return: { ...timing.return, date: e.target.value || null, time: e.target.value ? timing.return.time : null } })} /></label>
          <label className="grid gap-1 text-sm">Heure de retour · facultative<input type="time" className={builderInput} disabled={!timing.return.date} value={timing.return.time ?? ""} onChange={(e) => updateTiming({ ...timing, return: { ...timing.return, time: e.target.value || null } })} /></label>
        </div>}
        {visitTimingIssues(timing).filter((i) => i.repairTarget === "visit-return").map((i) => <p key={i.code} role="status" className="text-sm text-amber-900">{i.message}</p>)}
      </section>
    </>}
  </div>;
}
