"use client";
import { useEffect, useRef, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { ASSET_CATALOG, PLANNED_SUBTYPE_LABELS } from "@/domain/phase2/planned-assets";
import { inferredActivitySubtype, purchaseSubtypeForAsset, projectEventCandidates } from "@/domain/phase2/planned-project-entities";
import { plannedContextModifiers, resolvePlannedContext } from "@/domain/phase2/planned-rules";
import { rankPlacesForPlannedContext, plannedSellerCandidates } from "@/domain/phase2/planned-places";
import { intentForDraft, PURCHASE_CHOICES } from "@/domain/phase2/planned-ux";
import { RestaurantSearchSession, type ProjectPlaceKind, type RestaurantSuggestion, type SelectedRestaurantPlace } from "@/domain/phase2/restaurant-places";
import type { QuestionContext, WizardAnswer } from "@/domain/phase2/planned-question-engine";
import { GoogleMapsAttribution } from "./restaurant-place-search";
import styles from "./project-wizard.module.css";

export function ProjectDatePicker({ month, value, range: requiredRange = false, optionalRange = false, endValue, minDate, onChoose }: {
  month: string; value: string | null; range?: boolean; optionalRange?: boolean; endValue?: string; minDate?: string; onChoose: (v: WizardAnswer) => void;
}) {
  const [range, setRange] = useState(requiredRange || !!endValue);
  const [shown, setShown] = useState(value?.slice(0, 7) ?? month), [start, setStart] = useState(value), [end, setEnd] = useState(endValue ?? "");
  const first = new Date(`${shown}-01T12:00:00Z`), count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const shift = (n: number) => setShown(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1)).toISOString().slice(0, 7));
  return <div className={styles.dateModule}><div className={styles.calendar}>
    <div className={styles.calendarNav}><button aria-label="Mois précédent" onClick={() => shift(-1)} disabled={shown <= month}><ChevronLeft size={18} /></button><strong>{new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}</strong><button aria-label="Mois suivant" onClick={() => shift(1)} disabled={!range && !minDate && shown >= month}><ChevronRight size={18} /></button></div>
    <div className={styles.days}>{["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
      {Array.from({ length: (first.getUTCDay() + 6) % 7 }, (_, i) => <span key={`empty${i}`} />)}
      {Array.from({ length: count }, (_, i) => { const date = `${shown}-${String(i + 1).padStart(2, "0")}`;
        return <button type="button" key={date} aria-label={date} aria-pressed={start === date || end === date} className={styles.day} disabled={!minDate && !start && shown !== month || !!minDate && date < minDate}
          onClick={() => { if (!range) { setStart(date); onChoose(date); } else if (!start || end || date < start) { setStart(date); setEnd(""); } else setEnd(date); }}>{i + 1}</button>; })}</div>
    </div><div className={styles.dateAside}>{range && <><p>{start ? `Départ : ${new Date(start + "T12:00Z").toLocaleDateString("fr-FR")}` : "Choisissez le départ, puis le retour."}</p><label>Retour<input className={styles.input} type="date" min={start ?? undefined} value={end} onChange={e => setEnd(e.target.value)} /></label><button className={styles.primary} disabled={!start || !end || end < start} onClick={() => onChoose({ date: start, endDate: end })}>Continuer</button></>}
      {optionalRange && <button className={styles.textButton} onClick={() => { setRange(!range); setStart(null); setEnd(""); }}>{range ? "Une seule journée" : "Sur plusieurs jours"}</button>}<button className={styles.textButton} onClick={() => onChoose(null)}>Je ne sais pas encore</button></div></div>;
}

export function ProjectEntitySearch({ context, onChoose, onCategory, seller = false }: { context: QuestionContext; onChoose: (answer: WizardAnswer) => void; onCategory?: (subtype: string) => void; seller?: boolean }) {
  const intent = intentForDraft(context.draft), currentEntity = context.draft.context.project?.entity;
  const [query, setQuery] = useState(seller ? context.draft.context.seller ?? "" : currentEntity?.label ?? ""), [page, setPage] = useState(0), [explore, setExplore] = useState(false);
  const [category, setCategory] = useState(context.draft.subtypeKey ?? ""), [manual, setManual] = useState(false), [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState<RestaurantSuggestion[]>([]), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const search = useRef(new RestaurantSearchSession()), serial = useRef(0);
  const kind: ProjectPlaceKind = intent === "restaurant" || intent === "fast_food" || intent === "work_meal" ? "RESTAURANT"
    : intent === "activity" ? "ACTIVITY" : intent === "trip" ? "DESTINATION" : intent === "party" ? "VENUE" : "RETAIL";
  const isProduct = intent === "purchase" && !seller, isBrand = intent === "groceries", isDeliverySeller = context.draft.context.purchaseMode === "DELIVERY" || context.draft.context.purchaseMode === "ONLINE" || context.draft.context.workMealMode === "DELIVERED";
  const resolved = resolvePlannedContext({ familyKey: context.draft.familyKey, subtypeKey: context.draft.subtypeKey,
    modifiers: plannedContextModifiers(context.draft.context, context.env.persons.find(p => p.personId === context.draft.context.participantPersonIds?.[0])?.displayName) });
  const compatible = isDeliverySeller ? plannedSellerCandidates(context.env.places, context.draft, context.env.persons.find(p => p.personId === context.draft.context.participantPersonIds?.[0])?.displayName) : rankPlacesForPlannedContext(context.env.places, resolved, {
    workMealPersonName: intent === "work_meal" ? context.env.persons.find(p => p.personId === context.draft.context.participantPersonIds?.[0])?.displayName : undefined,
  }).map(p => p.place);
  const local = compatible.filter(p => `${p.name} ${p.brandLabel ?? ""} ${p.commune ?? ""}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
  const products = ASSET_CATALOG.filter(a => purchaseSubtypeForAsset(a) && (!explore || !category || purchaseSubtypeForAsset(a) === category)
    && !/:(delivery_fee|service_fee)$/u.test(a.assetKey) && a.label.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
  useEffect(() => {
    const request = ++serial.current; setSuggestions([]); setMessage("");
    if (isProduct || isBrand || manual) return;
    search.current.schedule(query, "Montpellier", async (r, current) => {
      setBusy(true);
      try { const response = await fetch("/api/places/autocomplete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...r, context: { city: r.city, kind } }) });
        const value = await response.json(); if (!current() || serial.current !== request) return;
        if (!response.ok) throw new Error(value.message); setSuggestions(value.suggestions ?? []);
      } catch { if (current()) setMessage("Recherche en ligne indisponible. Vous pouvez saisir votre choix."); }
      finally { if (current()) setBusy(false); }
    });
    return () => { search.current.cancel(); serial.current++; };
  }, [query, kind, isProduct, isBrand, manual]);
  const chooseGoogle = async (suggestion: RestaurantSuggestion) => {
    const request = ++serial.current; search.current.cancel(); setBusy(true); setMessage("");
    try { const response = await fetch("/api/places/details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placeId: suggestion.placeId, sessionToken: search.current.sessionToken(), context: { kind } }) });
      const body = await response.json(); if (serial.current !== request) return; if (!response.ok) throw new Error(body.message);
      const p = body.place as SelectedRestaurantPlace; search.current.complete();
      onChoose({ label: p.displayName, googlePlaceId: p.placeId, city: p.city, address: p.formattedAddress ?? undefined,
        ...(intent === "activity" ? { subtype: inferredActivitySubtype(p) ?? category } : {}) });
    } catch { if (serial.current === request) setMessage("Ce lieu n’est pas disponible. Saisissez-le ou choisissez un autre résultat."); }
    finally { if (serial.current === request) setBusy(false); }
  };
  const options = isProduct ? products : isBrand ? [...new Map(local.map(p => [p.brandLabel || p.name, p])).values()] : local;
  const choices = intent === "activity" ? [...PLANNED_SUBTYPE_LABELS.activity, { key: "other_activity", label: "Festival / événement" }] : PURCHASE_CHOICES;
  const events = intent === "activity" || context.draft.context.outingKind === "EVENT" ? projectEventCandidates(context.env.linkedProjects ?? [], query, context.env.editedId) : [];
  const event = events[0];
  return <div className={styles.entityModule}>
    <label className={styles.search}><Search size={19} aria-hidden="true" /><input autoFocus aria-label="Rechercher" placeholder={isProduct ? "Un produit, une pièce, un cadeau…" : "Nom, enseigne ou destination · ville si utile"} value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
    {explore ? <div className={styles.choiceGrid}>{choices.slice(page * 9, page * 9 + 9).map((c, i) => <button key={c.key + i} className={styles.choice} onClick={() => { setCategory(c.key); onCategory?.(c.key); setExplore(false); setPage(0); setQuery(""); }}>{c.label}</button>)}</div>
      : manual ? <div className={styles.manual}><label>{isProduct ? "Votre achat" : "Nom"}<input className={styles.input} value={query} onChange={e => setQuery(e.target.value)} maxLength={120} /></label>{!isProduct && !isBrand && !isDeliverySeller && <label>Adresse · si connue<input className={styles.input} value={address} onChange={e => setAddress(e.target.value)} maxLength={120} /></label>}
        <button className={styles.primary} disabled={!query.trim()} onClick={() => onChoose({ label: query.trim(), address: address || undefined, ...(isProduct || intent === "activity" ? { subtype: category } : {}) })}>Continuer</button></div>
      : <div className={styles.results}>{event && <button className={styles.result} onClick={() => { const d = event.draft, e = d.context.project?.entity; onChoose({ kind: "EVENT", label: e?.label ?? d.context.eventName ?? d.title, date: d.plannedDate, endDate: d.context.endDate,
        ...(d.context.place?.kind === "KNOWN" ? { placeId: d.context.place.placeId } : {}), city: e?.city, address: e?.address, googlePlaceId: e?.googlePlaceId }); }}><strong>{event.draft.context.project?.entity?.label ?? event.draft.title}</strong><small>{event.draft.plannedDate} · événement déjà prévu</small></button>}{options.slice(page * 6, page * 6 + (suggestions.length || event ? 3 : 6)).map(item => "assetKey" in item
        ? <button className={styles.result} key={item.assetKey} onClick={() => onChoose({ label: item.label, subtype: purchaseSubtypeForAsset(item) })}><span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong></button>
        : <button className={styles.result} key={item.placeId} onClick={() => onChoose({ label: isBrand ? item.brandLabel || item.name : item.name, ...(isBrand || isDeliverySeller ? {} : { placeId: item.placeId }), city: item.commune ?? undefined,
          ...(intent === "activity" ? { subtype: inferredActivitySubtype(item) ?? category } : {}) })}><strong>{isBrand ? item.brandLabel || item.name : item.name}</strong><small>{!isBrand && item.commune}{(item.visits12Months ?? 0) >= 2 ? " · Habituel" : ""}</small></button>)}
        {suggestions.slice(0, event ? 2 : 3).map(item => <button disabled={busy} key={item.placeId} className={styles.result} onClick={() => void chooseGoogle(item)}><strong>{item.primaryText}</strong><small>{item.secondaryText}</small></button>)}
      </div>}
    <div className={styles.entityActions}>{(isProduct || intent === "activity") && <button className={styles.textButton} onClick={() => { setExplore(!explore); setPage(0); }}>Explorer les catégories</button>}
      <button className={styles.textButton} onClick={() => setManual(!manual)}>{manual ? "Rechercher" : "Saisir mon choix"}</button><button className={styles.textButton} onClick={() => onChoose("LATER")}>Pas encore</button>
      <span className={styles.pagination}><button aria-label="Résultats précédents" disabled={!page} onClick={() => setPage(page - 1)}>←</button><button aria-label="Autres résultats" disabled={(explore ? choices.length : options.length) <= (page + 1) * (explore ? 9 : 6)} onClick={() => setPage(page + 1)}>→</button></span></div>
    {busy && <p role="status" className={styles.small}>Recherche…</p>}{message && <p role="status" className={styles.small}>{message}</p>}{suggestions.length > 0 && <GoogleMapsAttribution />}
  </div>;
}
