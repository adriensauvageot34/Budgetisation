import type { GlobalBackgroundFoodHighlight, GlobalBackgroundFoodSemanticMonth, GlobalBackgroundFoodSemantic } from "@/query-api/global-v2";
import { dayLabel, formatInteger, formatMoney, monthLabel } from "./annual-month-focus";
import { foodMoneyAccessibleLabel, formatFoodMoney } from "./food-money-presentation";
import { RhythmMonthFocusRegion } from "./rhythm-month-focus-region";
import styles from "./background-rhythms.module.css";

const basketLabels = Object.freeze({ SMALL: "petit panier", INTERMEDIATE: "panier moyen", LARGE: "gros panier" } as const);

function FoodHighlight({ item }: { readonly item: GlobalBackgroundFoodHighlight }) {
  const { amount, date, merchantLabel, basketClass, articleCount, activityLabel, channel } = item;
  const context = [
    date === null ? undefined : dayLabel(date),
    channel === "UBER_EATS" ? "via Uber Eats" : undefined,
    activityLabel ?? undefined,
    basketClass == null ? undefined : basketLabels[basketClass],
    articleCount === null ? undefined : `${formatInteger(articleCount)} article${articleCount > 1 ? "s" : ""}`,
  ].filter((value): value is string => value !== undefined);
  return <li><span><strong>{merchantLabel ?? "Libellé non renseigné"}</strong>{context.length === 0 ? null : <small>{context.join(" · ")}</small>}</span><b>{formatFoodMoney(amount)}</b></li>;
}

function HighlightGroup({ title, items }: { readonly title: string; readonly items: readonly GlobalBackgroundFoodHighlight[] }) {
  return <section className={styles.foodHighlightGroup}><h6>{title}</h6>{items.length === 0 ? <p>Aucun élément éditorial publié.</p> : <ul>{items.map((item) => <FoodHighlight key={item.stableSourceId} item={item} />)}</ul>}</section>;
}

export function FoodMonthFocus({ month, annotations, connectorPosition, onClose }: {
  readonly month: GlobalBackgroundFoodSemanticMonth;
  readonly annotations: GlobalBackgroundFoodSemantic["annotations"];
  readonly connectorPosition: number;
  readonly onClose: () => void;
}) {
  const { month: monthKey, money, grocery, restaurant, deliveryPurchaseCount, highlights } = month;
  const [groceryOccurrences, , , basketStructure] = grocery;
  const [, restaurantOccurrences] = restaurant;
  const observation = annotations.find(({ toMonth }) => toMonth === monthKey)?.text;
  const titleId = `food-focus-${monthKey}`;
  return <RhythmMonthFocusRegion domain="food" labelledBy={titleId} connectorPosition={connectorPosition}>
    <header className={styles.monthFocusHeader}>
      <div><span>{monthLabel(monthKey).toLocaleUpperCase("fr-FR")}</span><h5 id={titleId}><span aria-hidden="true">{formatFoodMoney(money.total)}</span><span className={styles.srOnly}>{foodMoneyAccessibleLabel(money.total)}</span></h5><p>consacrés à cette lecture de l’alimentation</p>{month.showBenefitFunding && month.monthlyBenefitFunding !== null ? <small>dont {formatMoney(month.monthlyBenefitFunding, true)} financés par titres-restaurant</small> : null}{month.benefitCoverage === "OUT_OF_COVERAGE" ? <small>Source titres-restaurant non observée pour ce mois</small> : null}</div>
      <button type="button" onClick={onClose}>Revenir à l’année <span aria-hidden>→</span></button>
    </header>
    <div className={styles.foodSummaryBand}>
      <section><h6>Composition</h6><dl><div><dt>Courses</dt><dd>{formatFoodMoney(money.courses)}</dd></div><div><dt>Restaurants</dt><dd>{formatFoodMoney(money.restaurants)}</dd></div><div><dt>Livraisons</dt><dd>{formatFoodMoney(money.deliveries)}</dd></div></dl></section>
      <section><h6>Rythme du mois</h6><p><strong>{formatInteger(groceryOccurrences)}</strong> passages courses</p><p><strong>{formatInteger(restaurantOccurrences)}</strong> repas repérés</p><p><strong>{formatInteger(deliveryPurchaseCount)}</strong> achats en livraison</p></section>
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
