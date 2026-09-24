import type { GlobalBackgroundFoodHighlightTuple, GlobalBackgroundFoodMonth, GlobalBackgroundRhythmsReadModel } from "@/query-api/global-v2";
import { dayLabel, formatInteger, formatMoney, monthLabel } from "./annual-month-focus";
import { RhythmMonthFocusRegion } from "./rhythm-month-focus-region";
import styles from "./background-rhythms.module.css";

const basketLabels = Object.freeze({ SMALL: "petit panier", INTERMEDIATE: "panier moyen", LARGE: "gros panier" } as const);

function FoodHighlight({ item }: { readonly item: GlobalBackgroundFoodHighlightTuple }) {
  const [, , amount, , date, label, basketClass, articleCount, , , activityLabel] = item;
  const context = [
    date === null ? undefined : dayLabel(date),
    activityLabel ?? undefined,
    basketClass == null ? undefined : basketLabels[basketClass],
    articleCount === null ? undefined : `${formatInteger(articleCount)} article${articleCount > 1 ? "s" : ""}`,
  ].filter((value): value is string => value !== undefined);
  return <li><span><strong>{label ?? "Libellé non renseigné"}</strong>{context.length === 0 ? null : <small>{context.join(" · ")}</small>}</span><b>{formatMoney(amount, true)}</b></li>;
}

function HighlightGroup({ title, items }: { readonly title: string; readonly items: readonly GlobalBackgroundFoodHighlightTuple[] }) {
  return <section className={styles.foodHighlightGroup}><h6>{title}</h6>{items.length === 0 ? <p>Aucun élément éditorial publié.</p> : <ul>{items.map((item) => <FoodHighlight key={item[0]} item={item} />)}</ul>}</section>;
}

export function FoodMonthFocus({ month, annotations, connectorPosition, onClose }: {
  readonly month: GlobalBackgroundFoodMonth;
  readonly annotations: GlobalBackgroundRhythmsReadModel["food"]["annotations"];
  readonly connectorPosition: number;
  readonly onClose: () => void;
}) {
  const [monthKey, courses, restaurants, deliveries, total, , , grocery, restaurant, deliveryPayments, highlights] = month;
  const [groceryOccurrences, , , basketStructure] = grocery;
  const [, restaurantOccurrences] = restaurant;
  const observation = annotations.find(({ toMonth }) => toMonth === monthKey)?.text;
  const titleId = `food-focus-${monthKey}`;
  return <RhythmMonthFocusRegion domain="food" labelledBy={titleId} connectorPosition={connectorPosition}>
    <header className={styles.monthFocusHeader}>
      <div><span>{monthLabel(monthKey).toLocaleUpperCase("fr-FR")}</span><h5 id={titleId}>{formatMoney(total, true)}</h5><p>consacrés à cette lecture de l’alimentation</p></div>
      <button type="button" onClick={onClose}>Revenir à l’année <span aria-hidden>→</span></button>
    </header>
    <div className={styles.foodSummaryBand}>
      <section><h6>Composition</h6><dl><div><dt>Courses</dt><dd>{formatMoney(courses, true)}</dd></div><div><dt>Restaurants</dt><dd>{formatMoney(restaurants, true)}</dd></div><div><dt>Livraisons</dt><dd>{formatMoney(deliveries, true)}</dd></div></dl></section>
      <section><h6>Rythme du mois</h6><p><strong>{formatInteger(groceryOccurrences)}</strong> passages courses</p><p><strong>{formatInteger(restaurantOccurrences)}</strong> repas repérés</p><p><strong>{formatInteger(deliveryPayments)}</strong> paiements de livraison</p></section>
      <section><h6>Structure des courses</h6>{basketStructure.status === "KNOWN" ? <dl><div><dt>Petits</dt><dd>{formatInteger(basketStructure.small)}</dd></div><div><dt>Moyens</dt><dd>{formatInteger(basketStructure.intermediate)}</dd></div><div><dt>Gros</dt><dd>{formatInteger(basketStructure.large)}</dd></div></dl> : <p>Pas assez de passages renseignés pour détailler la structure des paniers ce mois-ci.</p>}</section>
      <section><h6>Ce qui ressort</h6><p>{observation ?? "Aucune observation spécifique n’est publiée pour ce mois."}</p></section>
    </div>
    <section className={styles.monthComposition}><header><span>Lecture éditoriale</span><h5>Ce qui a composé le mois</h5></header><div>
      <HighlightGroup title="Courses" items={highlights[0]} />
      <HighlightGroup title="Restaurants & repas à l’extérieur" items={highlights[1]} />
      <HighlightGroup title="Livraisons" items={highlights[2]} />
    </div></section>
  </RhythmMonthFocusRegion>;
}
