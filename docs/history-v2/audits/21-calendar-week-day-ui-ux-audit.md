# History V2 — audit Calendar / Week / Journal : technique, data, UI et UX

> **Nature du document** : audit descriptif en lecture du comportement actuellement versionné. Aucune correction applicative n’est implémentée ici.
> **Baseline auditée** : branche distante `main`, commit `2c51cdbcdd23a849d5d6bd112296231cb29a654e` (`docs(history-v2): add current runtime architecture audit`). Le seul écart avec le commit applicatif précédent `efa4cd2a4c27b4831263816d96f76e859a4356fb` est l’ajout du rapport d’audit 20 ; le runtime History V2 observé est donc inchangé.
> **Sources relues directement** : route `/historique/[month]`, feature `src/features/history-v2/**`, builders/schemas `src/query-api/history-v2/**`, moteurs Calendar/Daily, matérialisation Query, runtime client et primitives d’overlay.
> **Limites** : aucun accès live Supabase, aucun navigateur automatisé, aucun profiling runtime et aucun `git status` local ne sont disponibles via le connecteur GitHub utilisé pour cet audit. Les observations UI sont donc une revue du code/CSS actuel et non un smoke visuel humain.

---

## Executive summary

La chaîne temporelle History V2 est **réellement implémentée de bout en bout** : Calendar mensuel, Hover, vraie vue Week et Journal du jour utilisent des ReadModels History V2 snapshotés. La navigation produit ne déclenche pas de recalcul Analytics : les routes demandent des ressources Query ; le runtime exige un snapshot History V2 publié et compatible.

Le socle technique est solide :

- grille mensuelle serveur complète lundi → dimanche ;
- jours adjacents appartenant réellement au mois voisin ;
- Daily Economic Ledger autoritaire pour le montant journalier ;
- Calendar Semantic autoritaire pour fusion/absorption/agrégation, ordre des markers et ribbons ;
- vue Week serveur indépendante, exactement 7 jours ;
- Hover déjà inclus dans le snapshot Month/Week, donc instantané et sans requête au survol ;
- Journal lazy, snapshoté, avec séparation stricte entre timeline horaire, événements sans horaire, ribbons continus et mouvements financiers ;
- `causalCost` et `spentDuring` restent deux notions distinctes ;
- aucune date bancaire n’est inventée comme date économique quotidienne ;
- états KNOWN/PARTIAL/UNKNOWN/CONFLICT/NOT_APPLICABLE conservés jusqu’à React.

Les principaux points ouverts sont plus ciblés :

1. **Contrat Month markers ambigu dans le runtime courant** : le builder prépare explicitement `visibleMarkers` top 3 pour Month, mais le composant Month ignore ce champ et reprojette `orderedMarkerGroups` côté client avec une limite de **6**. Le comportement utilisateur actuel est donc jusqu’à 6 markers filtrés par cellule. Ce n’est pas un recalcul de classement, mais c’est un écart concret entre projection serveur préparée et rendu courant ; il faut décider quelle limite fait autorité avant de figer définitivement le snapshot/ReadModel.
2. **Navigation mensuelle non bornée par les publications réellement disponibles** : les flèches font `month ± 1` sans consulter la liste des mois publiés. Une URL de mois valide mais sans snapshot peut donc mener à un état d’erreur plutôt qu’à une navigation empêchée/explicite.
3. **Desktop-first assumé techniquement** : `.page { min-width: 1040px; }` et aucune media query de réduction de layout n’existent. Le Calendar/Week n’est pas une expérience mobile responsive au sens courant.
4. **Week peu découvrable sur tactile** : le bouton semaine est visuellement masqué (`opacity: 0`) et apparaît au hover/focus. Au clavier il est découvrable au focus ; sur tactile l’affordance est faible.
5. **PARTIAL est parfois volontairement rendu comme une simple valeur** (`partialDisplay="value-only"`) dans les cellules/hover. KNOWN et PARTIAL peuvent donc être visuellement presque indistinguables dans les zones denses.
6. **Performance correcte côté calcul**, mais quelques coûts d’interface existent : payload Calendar riche et redondant, un listener global de dismiss par cellule, changement de filtre via navigation RSC alors que le filtrage visible est client-side, absence de préfetch J−1/J+1.

Conclusion : pas de reconstruction globale nécessaire. Les moteurs Calendar/Daily et le Journal sont de bonnes fondations. Le Calendar a cependant un **petit point de contrat structurel à trancher** avant de le déclarer figé.

---

# A. Comportement actuel

## A.1 Sélection du mois

### Point d’entrée

`/historique` appelle `resolveLatestPublishedHistoryV2Month()` puis redirige vers le dernier mois possédant un `history_month_calendar` actif, non invalidé et rattaché à une publication `published`.

### Route mensuelle

`/historique/[month]` parse strictement `YYYY-MM`.

Deux états de vue existent :

```text
/historique/2026-05                    → Calendar
/historique/2026-05?view=balance       → Bilan
```

Tout `view` non reconnu est canonisé vers Calendar.

Le changement de mois dans `HistoryShell` fait :

```text
addMonths(month, -1)
addMonths(month, +1)
```

puis `router.push()` sans scroll reset.

### Limite actuelle

La navigation visible ne consulte pas `eligibleHistoryMonths()` et ne désactive pas les mois sans publication. Le helper `src/server/bootstrap/history-calendar.ts` sait pourtant calculer des mois fermés/documentés, mais aucune consommation active de ce helper n’a été trouvée dans la route History V2 actuelle.

Conséquence :

- le dernier mois d’entrée est bien un mois publié ;
- une navigation manuelle peut cependant demander un autre mois valide ;
- si aucun snapshot History V2 compatible n’existe, Query renvoie `TEMPORARY_UNAVAILABLE` au lieu de recalculer le mois.

### Mois courant vs mois fermé

Le backend connaît `isClosed` dans `materializationPeriod()` :

- mois fermé → snapshot sans expiration et cache API `revalidate: never` ;
- période non fermée → logique stale-while-revalidate pour les ressources matérialisables ordinaires.

History V2 reste cependant snapshot-first et son source dynamique refuse de fabriquer un faux ReadModel en cas de miss.

**Aucune distinction visuelle “mois courant / mois fermé” n’est rendue dans Calendar/Week.** Dans l’expérience History actuelle, la notion de fermeture est essentiellement une propriété de publication/runtime.

Classification UX : **UX_À_POLIR**.

---

## A.2 Construction de la grille mensuelle

Autorité : `buildMonthCalendarReadModel()` et `monthGrid()`.

Le mois est étendu :

```text
1er jour du mois
→ lundi de la semaine contenant ce jour

dernier jour du mois
→ dimanche de la semaine contenant ce jour
```

Le résultat contient 4 à 6 semaines complètes, chacune avec exactement 7 dates lundi → dimanche.

Chaque cellule possède :

- `date` ;
- `inSelectedMonth` ;
- `targetMonth` ;
- `economicAmount` ;
- `economicAmountExcludingFixed` ;
- `personContexts` ;
- `orderedMarkerGroups` ;
- `visibleMarkers` ;
- `hiddenMarkerCount` ;
- `activeRibbonItemIds` ;
- `hover` ;
- `journalRef` ;
- provenance/quality indirectes.

Les jours hors mois ne sont pas des cases décoratives. Ils utilisent l’artifact du mois réel de la date. Si cet artifact adjacent n’est pas disponible, les valeurs concernées deviennent UNKNOWN / `DATA_NO_SOURCE` au lieu d’être inventées.

UI : les jours hors mois ont fond gris clair et `opacity: .62`.

Classification UX : **UX_SOLIDE**.

---

## A.3 Données visibles dans une cellule

### 1. Date

```text
MonthCalendarDayReadModel.date
→ formatCalendarDay()
→ <strong> dans dayHeading
```

Un jour extérieur affiche aussi le contexte de mois via le formateur.

### 2. Montant journalier

Avec filtre normal :

```text
Canonical economic sources
→ CanonicalRepository.loadEconomicFacts()
→ EconomicComponentFact
→ buildDailyEconomicLedgerMonthFromCanonical()
→ buildDailyEconomicLedgerMonthArtifact()
→ DailyEconomicLedgerMonthArtifact.days[].economicAmount
→ dailyAmount()
→ dayReadModel().economicAmount
→ MonthCalendarDayReadModel.economicAmount
→ amountNode(filters)
→ MoneyMetric
```

Doctrine importante : `BANK_DATE_FALLBACK` est explicitement rejeté comme autorité quotidienne par Daily Finance V2.

Si un composant du mois n’a pas de timing quotidien affirmable :

- jour avec dépenses observées → `PARTIAL / OBSERVED_ONLY` ;
- jour sans montant affecté mais timing incomplet → `UNKNOWN` ;
- autorités contradictoires → `CONFLICT`.

Le ledger impose :

```text
SUM(jours affirmables) + unassignedEconomicAmount = Actual
```

### 3. Montant « Sans charges fixes »

```text
EconomicComponentFact
+ catégories/sous-catégories
+ economic_component_classifications
+ recurrence/taxonomy
+ Daily Economic Ledger
→ buildCalendarEconomicProjection()
→ CalendarEconomicProjection.days[].economicAmountExcludingFixed
→ CalendarSemanticMonthArtifact.economicProjection
→ dailyAmountExcludingFixed()
→ MonthCalendarDayReadModel.economicAmountExcludingFixed
→ amountNode(filters.amount = EXCLUDE_FIXED)
→ MoneyMetric
```

Les composantes `NON_FIXED` sont additionnées. Une classification inconnue ou un timing non assigné rend la valeur PARTIAL ; aucun montant fixe n’est deviné.

### 4. Contextes personnels

```text
Canonical Life/Event/context authority
→ Calendar Semantic items renderMode=Context
→ CalendarDayProjection.contextItems
+ personDirectory
→ contextSummaries()
→ MonthCalendarDayReadModel.personContexts
→ ContextRow
→ pastilles d’initiales
```

Le builder transforme plusieurs contextes contradictoires pour une même personne en `CONFLICT`. Dans ce cas, la cellule ne reçoit pas de pastille contextuelle affirmée ; le détail de qualité reste davantage visible dans le Hover/ReadModel que dans la cellule compacte.

Note technique : l’adapter canonique `buildCalendarSemanticMonthFromCanonical()` passe actuellement `contexts: []` au moteur pour la famille dédiée de contexts. Des items Life Event peuvent néanmoins être eux-mêmes catalogués `renderMode=Context`; il ne faut donc pas interpréter ce tableau vide comme « aucun contexte possible ».

### 5. Markers

```text
life_events + moments + relations
→ Calendar Semantic
→ fusion / absorption / agrégation
→ markerSort()

Economic components datés + qualifications
→ Calendar Economic Projection
→ economic markers

Life markers + economic markers
→ attachCalendarEconomicProjection()
→ orderedMarkerGroups par jour
→ dayReadModel().orderedMarkerGroups
→ projectFilteredMarkers() côté React
→ MarkerList
```

Le frontend **ne trie pas** les markers. Il conserve l’ordre du serveur puis applique uniquement :

- sélection par `filterTags` ;
- limite visuelle ;
- compteur caché.

### 6. Ribbons

```text
Life Events / Moments
+ continuité autoritaire
→ renderMode Ribbon
→ buildRibbonWeeks()
→ lanes 1..4 + overflow
→ ribbonProjection()
→ MonthCalendarReadModel.ribbonSegments / ribbonOverflow
→ RibbonRail
```

La position `gridColumn` et la lane sont déjà publiées. React ne réalloue aucune lane.

---

# B. Architecture technique

## B.1 Chaîne Calendar

```text
CanonicalRepository
  ↓
ActivityOccurrenceFact / EconomicComponentFact / continuity / moments
  ↓
buildCalendarSemanticMonthFromCanonical()
buildDailyEconomicLedgerMonthFromCanonical()
  ↓
CalendarSemanticMonthArtifact
DailyEconomicLedgerMonthArtifact
  ↓
buildCalendarCentricMonthFromCanonical()
  ↓
Calendar Semantic + Economic Projection
  ↓
buildMonthCalendarReadModel()
  ↓
RuntimeSchema strict
  ↓
analytics_query_snapshots
  ↓
executeQuery() snapshot-only pour History V2
  ↓
RSC /historique/[month]
  ↓
CalendarMonthView
```

## B.2 Chargement Calendar

À l’ouverture mensuelle, la route demande en parallèle :

1. `history_month_calendar` ;
2. `history_month_overview`.

Le Hover est imbriqué dans `history_month_calendar` : **aucune requête supplémentaire au survol**.

## B.3 RuntimeSchema

Le schema vérifie notamment :

- structures strictes ;
- dates ;
- 4–6 semaines ;
- 7 jours par semaine ;
- `markerTier` seulement pour `renderMode=Marker` ;
- ressources de target Calendar autorisées ;
- MetricValue / CollectionValue ;
- champs `economicAmountExcludingFixed` du contrat courant ;
- cohérence de publication/policies.

Des variantes explicitement anciennes restent acceptables par identité :

- `history_v2_calendar_centric_old` ;
- `history_v2_visible_gaps_legacy`.

Cela constitue une compatibilité de snapshot contrôlée, pas un fallback V1.

---

# C. Data lineage détaillée

## C.1 Life Events / activités

```text
public.life_events
→ CanonicalRepository.loadActivityOccurrences()
→ ActivityOccurrenceFact
→ buildCalendarSemanticMonthFromCanonical()
→ CalendarLifeEventSource
→ buildCalendarSemanticMonthArtifact()
→ CalendarSemanticItem
→ CalendarDayProjection / ribbons
→ CalendarItemSummary / JournalTimelineItem
→ Calendar / Hover / Journal
```

Le passage Calendar Semantic peut :

- fusionner Life Event + Moment principal ;
- absorber un composant ;
- agréger plusieurs occurrences selon la policy ;
- transformer un événement continu en Ribbon lorsque la continuité est autorisée.

Il n’existe donc volontairement pas de bijection brute `1 row life_events = 1 marker UI`.

## C.2 Moments

```text
moments
+ moment_life_events
+ Life Events
→ Calendar Semantic fusion
→ CalendarSemanticItem sourceKind moment/fused
→ Calendar marker/ribbon ou Journal item
→ targetRef Moment
→ history_moment_detail lazy
```

Dans le Journal, un Moment peut aussi recevoir :

- `causalCost` : source causale autoritaire fournie au builder ;
- `spentDuring` : calcul temporel serveur séparé ;
- causal expenses : ownership narratif autoritaire.

## C.3 Participants

```text
ActivityOccurrenceFact.participantIds
+ CalendarSemanticItem.householdParticipants
+ personDirectory
→ ParticipantSummary / PersonContextSummary
→ pastilles Calendar
→ participants Journal
```

Les participants externes sont conservés séparément lorsqu’ils sont présents.

## C.4 Dépenses quotidiennes humaines

```text
EconomicComponentFact
+ PurchaseEventFact
→ Daily Economic Ledger allocationEntries / expenseEvents
+ EconomicExpenseDescriptor
→ expenseSummariesForDate()
→ tri serveur montant desc puis ordre stable
→ Hover : préfixe serveur 3
→ Journal : dépenses du jour non déjà possédées par un Moment
```

Le grain d’affichage est `expenseEventId`, pas `marchand + date + montant`.

## C.5 Remboursements / entrées / mouvements techniques

Ces familles sont injectées via `JournalSupplement` dans `buildJournalDayReadModel()` puis filtrées par date :

```text
JournalSupplement.refundsAndAdjustments
→ RefundMovementSummary

JournalSupplement.inflows
→ BankInflowSummary

JournalSupplement.technicalMovements
→ TechnicalMovementSummary
```

Elles ne sont pas fusionnées avec `economicExpenses`.

L’audit du présent lot vérifie le contrat et la projection Journal ; il ne prétend pas refaire un audit live ligne-par-ligne de la construction du supplement de chaque publication.

## C.6 Lieux / visites

Le Journal n’expose pas une section autonome « visites GPS » construite depuis `PlaceVisitFact`.

Les lieux apparaissent principalement :

- comme `placeLabel` associé à un item de timeline lorsque le supplement possède une autorité correspondante ;
- dans les détails Moment/Place accessibles ailleurs dans History V2.

`PlaceVisitFact` reste une fondation Canonical/Analytics partagée mais **une occurrence GPS brute n’est pas convertie directement en événement Journal**.

---

# D. Composants

## D.1 CalendarMonthView

Responsabilité : présentation de `MonthCalendarReadModel`.

Transformations client :

- sélection des ribbon rows par `weekStart` ;
- filtrage des markers selon le preset ;
- limite visuelle après filtre ;
- choix du montant ALL / EXCLUDE_FIXED ;
- ouverture overlays.

Aucun :

- calcul Actual ;
- classement sémantique ;
- fusion Life Event/Moment ;
- calcul de continuité ;
- allocation de lane ;
- calcul de date économique.

## D.2 CalendarDayCell

Interactions :

- hover sur l’article → preview après 300 ms ;
- sortie → fermeture après 125 ms ;
- focus du bouton jour → preview immédiate ;
- clic sur bouton jour → Journal ;
- clic marker ciblable → Activity/Moment/Journal selon `targetRef`.

Point UX : toute la surface visuelle de la cellule n’est pas un unique bouton. Le bouton Journal couvre l’en-tête date/montant ; les contexts et markers sont des zones séparées. Le hover est attaché à toute la cellule, mais cliquer un espace neutre hors bouton n’ouvre pas forcément le Journal.

Classification : **UX_À_POLIR**.

## D.3 DayHoverPopover

Portal `document.body`, position fixe.

Contenu actuel :

- date ;
- montant filtré ;
- note données partielles ;
- événements Calendar ;
- ribbons actifs ;
- contextes ;
- top dépenses ;
- compteur de dépenses cachées ;
- bouton `Ouvrir le journal`.

Le Hover n’effectue aucun `sort()` métier.

Transformations React observées :

- filtre `calendarEvents` par tags ;
- `.slice(0, 3)` après filtrage ;
- `.slice(0, 3)` à nouveau sur `economicExpenses`, bien que le builder fournisse déjà un préfixe serveur de 3.

Le top dépenses est donc **sélectionné côté serveur** ; le slice React est redondant.

Les événements du Hover ne sont pas eux-mêmes des liens vers leurs détails. Le chemin principal reste `Ouvrir le journal`.

## D.4 WeekView

La vue Week existe réellement et n’est pas un simple agrandissement CSS du Calendar.

Elle consomme `WeekReadModel` :

- `weekStart` lundi obligatoire ;
- `weekEnd` dimanche ;
- `referenceMonth` = mois du jeudi ;
- exactement 7 jours ;
- markers serveur préparés top 6 ;
- ribbons dédiés.

Navigation :

```text
Calendar
→ icône semaine
→ ?week=YYYY-MM-DD

Week
→ Retour au mois
→ Semaine précédente
→ Semaine suivante
```

Les semaines bi-mois conservent les lanes des artifacts mensuels. L’union ribbon est explicitement PARTIAL plutôt que de recompactager arbitrairement les lanes.

## D.5 JournalPanel

Lazy Query :

```text
history_day_journal
scope month = yearMonthOf(date)
params = { date }
```

Le panneau est un `OverlayFrame` de type `day_drawer`.

Sections :

1. date + montant + participants ;
2. navigation J−1 / J+1 ;
3. Contextes du jour ;
4. Événements continus ;
5. Chronologie ;
6. Sans horaire précisé ;
7. `<details>` Dépenses et autres mouvements.

Dans une timeline Moment :

- `Dépenses liées` = causalCost ;
- `Dépensé pendant` = spentDuring ;
- bouton `Ouvrir le moment`.

C’est une distinction technique et sémantique solide.

---

# E. UX

## E.1 Calendar → détail

Chemins principaux :

```text
Calendar → Journal
1 clic sur le bouton jour

Calendar → Marker ciblé
1 clic sur le marker

Calendar → Week
1 clic sur l’icône semaine, lorsqu’elle est découverte

Calendar → Hover → Journal
hover/focus + 1 clic

Journal → Moment Detail
1 clic supplémentaire sur "Ouvrir le moment"
```

Le nombre de clics est court.

Classification : **UX_SOLIDE**.

## E.2 Continuité de navigation

Points forts :

- URL conserve mois, week, filtres et overlay ;
- `router.push/replace(..., { scroll:false })` évite les retours systématiques en haut ;
- overlay stack logique jusqu’à 6 niveaux ;
- bouton Back de l’overlay lorsque stack > 1 ;
- scroll de l’overlay précédent mémorisé ;
- focus de l’invocateur mémorisé/restauré ;
- J−1/J+1 remplace le Journal sans fermer le drawer.

Classification : **UX_SOLIDE**.

## E.3 Discoverability Week

Le bouton semaine :

```css
opacity: 0
```

et devient visible seulement :

```css
.calendarWeek:hover .weekLink
.weekLink:focus-visible
```

Au clavier, le focus le révèle. Sur desktop souris, le hover le révèle. Sur tactile, la découverte est faible et dépend du comportement hover du navigateur.

Classification : **UX_MANQUANTE sur tactile / UX_À_POLIR globalement**.

## E.4 Hover

Souris : délai 300 ms, fermeture 125 ms. Le popover garde la fermeture en attente lorsqu’on entre dessus.

Clavier : focus du jour ouvre immédiatement la preview.

Tactile : aucun déclencheur dédié au preview. Le tap principal ouvre directement le Journal ; l’utilisateur ne bénéficie donc pas nécessairement de l’étape preview.

Le rôle `dialog` du Hover est plus fort sémantiquement que son comportement réel : il n’est pas un OverlayFrame, n’a pas de focus trap et le focus reste initialement sur le jour. Comme le Journal est directement ouvrable par Enter/clic, cela n’empêche pas l’accès fonctionnel, mais la sémantique/accessibilité du preview mérite un polish.

Classification : **UX_À_POLIR**.

## E.5 Densité et hiérarchie

Calendar :

- date + montant ;
- contexts ;
- jusqu’à plusieurs markers ;
- ribbons au-dessus de la row.

La hiérarchie est logique, mais une cellule chargée peut devenir dense, surtout puisque le rendu courant peut afficher jusqu’à 6 markers.

Week utilise des cellules beaucoup plus hautes (`min-height: 360px`), donc accepte mieux 6 markers.

Classification :

- Month : **UX_À_POLIR** ;
- Week : **UX_SOLIDE** sur desktop.

## E.6 Affordances

Clair :

- markers ciblables sont des `<button>` ;
- ribbons ciblables sont des `<button>` ;
- day heading est un bouton ;
- focus-visible est dessiné.

Moins clair :

- toute la cellule ressemble à une unité interactive mais n’est pas entièrement cliquable ;
- certains markers peuvent être des `<div>` non cliquables selon absence de target ;
- événements continus dans Journal sont informatifs et non cliquables ;
- `placeLabel` dans Journal est du texte, pas un lien ;
- Life Event/Activity dans timeline n’a pas systématiquement un CTA détail, contrairement au Moment.

Classification : **UX_À_POLIR**.

---

# F. UI

## F.1 Typographie et spacing

La hiérarchie CSS est cohérente :

- titre mois 22px / 800 ;
- weekday 13px / 800 ;
- markers 12px ;
- context initials 10px / 900 ;
- Journal amount 30px / 850 ;
- gaps réguliers 3–16px selon niveau.

La densité Calendar est volontairement compacte.

## F.2 Couleurs

Les différences sémantiques ne sont pas principalement codées par couleur :

- icons Lucide selon `iconKey` ;
- contexts/ribbons dans une palette verte uniforme ;
- jours hors mois gris/opacity ;
- focus primary.

`markerTier` est émis comme `data-tier`, mais aucune règle CSS utilisant `data-tier` n’a été trouvée dans la feature actuelle. Dominant/Standard/Secondary influence donc le contrat et l’ordre, mais pas une différenciation visuelle spécifique dans ce CSS.

## F.3 Longues chaînes

Protections présentes :

- markers : `overflow-wrap:anywhere`, line clamp 2 ;
- ribbons : ellipsis ;
- carousel title : clamp 2 ;
- subtitle : ellipsis ;
- raw label bancaire : wrap.

C’est solide pour desktop.

## F.4 Hover/focus/active

- day focus : outline 2px ;
- day hover-open : box-shadow primary ;
- ribbon button : outline ;
- controls : hover/focus visible ;
- filter selected : `aria-pressed` + fond/bordure.

Bon niveau général.

## F.5 Motion

- transition vue ~180 ms ;
- hover ~150 ms ;
- carousel automatique 7 s.

`prefers-reduced-motion` retire les transforms de quelques animations, mais ne supprime pas toutes les transitions/variations d’opacité. C’est une prise en compte partielle, pas totale.

---

# G. Responsive et accessibilité

## G.1 Responsive

Constat direct :

```css
.page {
  min-width: 1040px;
}
```

Calendar et Week utilisent des grilles fixes 7 colonnes et aucune media query de réorganisation n’a été trouvée.

Le fichier ne comporte qu’une media query `prefers-reduced-motion`.

Conclusion :

- desktop large : architecture adaptée ;
- petit laptop : probablement acceptable avec largeur suffisante ;
- tablette étroite/mobile : **pas de vraie adaptation responsive**, débordement horizontal probable.

Classification : **UX_MANQUANTE pour mobile**.

## G.2 Clavier

Présent :

- boutons natifs ;
- aria-label jours ;
- week button focus visible ;
- Escape filter/menu/overlay ;
- OverlayFrame focus trap ;
- retour focus ;
- tablist Calendar/Bilan ;
- boutons markers/ribbons.

À polir :

- le tablist principal Calendar/Bilan ne possède pas de logique ArrowLeft/ArrowRight dédiée ;
- Day Hover `role=dialog` n’a pas la gestion focus d’un vrai dialog ;
- le bouton « Ouvrir le journal » dans le portal de hover n’est pas le chemin clavier le plus naturel, même si Enter sur le jour ouvre déjà le Journal.

## G.3 Overlay Journal

`OverlayFrame` apporte :

- `role=dialog` ;
- `aria-modal` topmost ;
- focus trap ;
- Escape ;
- scroll lock ;
- backdrop close ;
- focus restoration.

`HistoryOverlayHost` ne fournit pas `backgroundRootRef`, donc la fonctionnalité facultative qui suspend/inert explicitement le fond n’est pas utilisée ici. Le focus trap et `aria-modal` restent actifs.

---

# H. États de données

## H.1 Métriques

| État | Rendu normal |
|---|---|
| `KNOWN` | valeur |
| `KNOWN(0)` | valeur zéro réelle |
| `PARTIAL / LOWER_BOUND` | `Au moins X` + badge partial en mode complet |
| `PARTIAL / OBSERVED_ONLY` | `Observé : X` + badge partial en mode complet |
| `UNKNOWN` | `Indisponible` |
| `NOT_APPLICABLE` | `Non applicable` |
| `CONFLICT` | `À vérifier` |

### Exception densité Calendar

Avec `partialDisplay="value-only"`, PARTIAL affiche seulement la valeur. Cette variante est utilisée notamment dans des montants compacts Calendar/Hover.

Donc :

```text
KNOWN 42 €
PARTIAL OBSERVED_ONLY 42 €
```

peuvent devenir visuellement quasi identiques, à part attributs/classes non textuels.

Classification : **UX_À_POLIR**.

## H.2 Collections

| État | Rendu |
|---|---|
| KNOWN non vide | items |
| KNOWN vide | `Aucun élément pour ce mois` |
| PARTIAL | note partielle + items selon contexte |
| UNKNOWN | `Indisponible` |
| NOT_APPLICABLE | `Non applicable` |
| CONFLICT | `Données à vérifier` |

Collection vide connue et collection inconnue sont donc bien distinctes.

## H.3 États qui se confondent partiellement

1. `PARTIAL` vs `KNOWN` en mode `value-only`.
2. Dans une cellule, un conflit de contextes peut se traduire par absence de pastille plutôt que par un badge conflit explicite.
3. `UNKNOWN` et certaines causes techniques différentes convergent visuellement vers `Indisponible`, même si `reasonCode` reste disponible dans les placeholders adaptés.

Aucun faux zéro généralisé n’a été observé.

---

# I. Performance

## I.1 Calendar mensuel

### Requêtes

Initialement : **2 ressources Query serveur en parallèle** : Calendar + Overview.

Aucune requête Hover.

### Payload

Le payload Calendar est volontairement riche pour rendre le Hover instantané. Une journée peut contenir simultanément :

- `orderedMarkerGroups` complet ;
- `visibleMarkers` ;
- `hiddenMarkerCount` ;
- `hover.calendarEvents` dérivé du même ordre ;
- contexts ;
- hover contexts ;
- hover expenses ;
- refs/provenance ;
- ribbons au niveau mois.

Il existe donc de la **duplication de projection dans le snapshot/payload**, en échange d’un Hover sans waterfall.

### Listeners

Chaque `CalendarDayCell` installe son propre listener `historyTransientDismissEvent`; une grille de 35–42 jours possède donc 35–42 listeners de ce type, auxquels s’ajoutent les RibbonRails.

Ce n’est pas identifié comme un problème de performance mesuré, mais c’est un coût structurel observable.

### Filtres

Le calcul visible des markers est client-side, mais un preset appelle `router.replace()` pour persister l’URL. Cela provoque une navigation App Router et peut rejouer la route serveur Calendar/Overview alors que les ressources métier ne dépendent pas du filtre.

Avantage : URL/deep-link canonique.

Coût : round-trip RSC potentiellement évitable si un jour on souhaite optimiser l’interaction.

Aucune optimisation n’est proposée/implémentée dans cet audit.

## I.2 Week

Initial : **2 ressources Query serveur** : Week + Overview.

La semaine possède seulement 7 jours mais des cellules plus riches. Même cache/snapshot policy que Month.

## I.3 Journal

Ouverture : **1 POST `/api/query`** pour `history_day_journal` si absent du cache client.

Le cache client :

- déduplique les requêtes identiques in-flight ;
- conserve les réponses réussies ;
- ne revalide pas un snapshot fermé dont `cachePolicy.revalidate === "never"`.

J−1/J+1 :

- nouvelle identité Query ;
- aucun prefetch explicite du voisin ;
- première visite d’un jour voisin = click → Query → rendu ;
- retour vers un jour déjà visité = cache probable.

Le hook client ne coupe pas physiquement la requête fetch lorsqu’un composant est démonté ; il empêche seulement la mise à jour d’état via un flag `active`.

Classification performance générale : **bonne, avec quelques optimisations possibles non bloquantes**.

---

# J. Incohérences observées

## J.1 Limite Month : ReadModel top 3 vs UI top 6

Le builder fait explicitement :

```text
Month → dayReadModel(..., markerLimit = 3)
Week  → dayReadModel(..., markerLimit = 6)
```

et publie :

- `visibleMarkers` ;
- `hiddenMarkerCount`.

Mais le composant courant fait :

```tsx
<FilteredMarkerList day={day} limit={6} ... />
```

pour **CalendarDayCell comme pour WeekDay**.

`FilteredMarkerList` ignore `visibleMarkers` et repart du `orderedMarkerGroups` complet afin d’appliquer les filtres.

Conséquence : le Calendar Month actuel affiche jusqu’à **6 markers filtrés**, pas 3.

Le classement reste autoritaire serveur ; ce n’est pas un recalcul sémantique React. En revanche, il existe un désalignement de contrat/projection :

- soit Month doit réellement rester à 3 → le composant est à corriger ;
- soit le nouveau choix UX est 6 → le ReadModel et ses champs `visibleMarkers/hiddenMarkerCount` doivent être réalignés ou explicitement considérés comme projections historiques inutilisées.

**Décision humaine requise avant republish définitif.**

Classification : **READMODEL/SNAPSHOT ADJUSTMENT CANDIDATE**.

## J.2 Champs serveur préparés mais non consommés directement

Dans le Calendar actuel :

- `visibleMarkers` n’est pas la source du rendu ;
- `hiddenMarkerCount` n’est pas la source du compteur filtré ;
- `activeRibbonItemIds` n’est pas utilisé pour dessiner les ribbons ; la top-level ribbon projection est utilisée.

Ce n’est pas automatiquement une erreur : les filtres exigent le full ordered set. Mais cela mérite une clarification de contrat pour réduire ambiguïté et payload redondant.

## J.3 `unassignedTiming`

`buildMonthCalendarReadModel()` continue de publier `unassignedTiming` comme VISIBLE. Le dernier polish UI a retiré son bandeau visible.

Donc : donnée snapshotée, non rendue dans la surface Calendar actuelle.

## J.4 Mois disponibles

Backend : notion de mois fermés/documentés et snapshots publiés.

Frontend : boutons ±1 non bornés.

C’est une incohérence de navigation/availability, pas une incohérence financière.

## J.5 Week cross-month

L’union de ribbons de deux artifacts mensuels est marquée PARTIAL, car les lanes ont été assignées séparément. Le builder conserve les lanes observées et n’invente pas un layout hebdomadaire atomique.

Ce comportement est prudent et documenté ; il ne constitue pas un bug, mais peut produire une différence de qualité sur semaine chevauchant deux mois.

---

# K. Détails susceptibles de nécessiter un ajustement ReadModel / snapshot

### K1 — Décision top 3 / top 6 Month

**Priorité haute dans le polish History**, car le snapshot contient aujourd’hui une projection Month top3 que React n’utilise pas comme limite.

Impact possible :

- UI seulement si la cible reste top3 ;
- ou ReadModel + RuntimeSchema + snapshot/republish si la cible devient officiellement top6 ou si les champs préfixés sont retirés/redéfinis.

### K2 — Navigation par mois publié

Peut rester un simple contrat route/navigation si une liste de mois disponibles est chargée sans modifier les snapshots Calendar.

Si cette information doit être affichée dans le shell, prévoir une source autoritaire légère plutôt que déduire de l’URL ou de la date courante.

### K3 — Qualité PARTIAL compacte

Probablement UI-only si on ajoute un indicateur visuel à partir de `MetricValue` déjà publié.

### K4 — Context conflict dans cellule

Si l’objectif est de rendre explicitement le conflit dans la cellule, le ReadModel possède déjà suffisamment de signaux dans la collection Hover mais `personContexts` compact ne porte pas un nœud global de statut. Selon le design retenu, cela peut être UI-only via un champ existant ou demander une petite projection de summary.

### K5 — Responsive mobile

Principalement UI/CSS si l’on accepte un Calendar scrollable/adapté. Si l’UX mobile veut une autre densité de markers/ribbons, cela peut conduire à une projection ReadModel dédiée, mais ce n’est pas nécessaire aujourd’hui pour corriger le débordement.

### K6 — Payload Hover

Le Hover embarqué est efficace pour la latence mais duplique des données. Un changement vers Hover lazy serait une décision d’architecture Query/snapshot ; **aucune raison impérative de le faire n’a été constatée sans mesure de payload réelle**.

---

# L. Corrections candidates — NON IMPLÉMENTÉES

| Candidate | Nature | Urgence | Snapshot probable ? |
|---|---|---:|---|
| Trancher Month top3 vs top6 et réaligner contrat/rendu | contrat UI/ReadModel | haute | possible |
| Borner les flèches aux mois publiés ou afficher indisponibilité explicitement | UX/navigation | moyenne | non, sauf nouveau ReadModel availability |
| Rendre l’entrée Week visible sans hover desktop | UX | moyenne | non |
| Définir comportement responsive sous 1040px | UI/UX | moyenne | non dans le scénario simple |
| Rendre PARTIAL compact visuellement identifiable | UI/qualité | moyenne | non |
| Clarifier cellule entière cliquable vs zones interactives séparées | UX | basse/moyenne | non |
| Revoir sémantique/focus du Day Hover | accessibilité | moyenne | non |
| Évaluer après mesure la duplication payload Month/Hover | performance | basse | éventuellement |
| Mutualiser les listeners de dismiss si profiling le justifie | performance interne | basse | non |
| Précharger J−1/J+1 si latence réelle perceptible | performance UX | basse | non |
| Clarifier l’utilité finale de `visibleMarkers`, `hiddenMarkerCount`, `activeRibbonItemIds`, `unassignedTiming` | contrat/nettoyage | moyenne | possible si contrat change |

Aucune de ces corrections n’est effectuée dans ce lot.

---

# Readiness

## CALENDAR READINESS

**STRUCTURAL_FIX_NEEDED**

Motif précis : le moteur et le snapshot sont solides, mais la limite de markers du Month est actuellement contradictoire entre la projection serveur (`visibleMarkers` top3) et le rendu client (projection filtrée jusqu’à 6). Ce point doit être tranché avant de déclarer le contrat Calendar définitivement figé. Les autres défauts relevés sont majoritairement du polish UX/UI.

## WEEK READINESS

**POLISH_NEEDED**

La vue Week est une vraie ressource serveur, cohérente et sans recalcul métier React. Les restes concernent surtout discoverability tactile, responsive, présentation PARTIAL et quelques détails d’accessibilité/performance.

## DAY/JOURNAL READINESS

**POLISH_NEEDED**

Le Journal possède une structure métier robuste, notamment la séparation causalité/contexte, timeline horaire/sans horaire et mouvements financiers. Les restes sont principalement des affordances de navigation vers certains détails, du responsive/accessibilité et l’absence de prefetch des jours voisins.

---

## Résumé des classifications UX

| Zone | Classe dominante |
|---|---|
| Construction grille / jours adjacents | `UX_SOLIDE` |
| Navigation Calendar → Journal | `UX_SOLIDE` |
| Navigation overlay / retour / focus | `UX_SOLIDE` |
| Hover souris | `UX_SOLIDE` à `UX_À_POLIR` |
| Hover tactile | `UX_MANQUANTE` comme preview, mais Journal reste accessible directement |
| Week desktop | `UX_SOLIDE` |
| Discoverability Week tactile | `UX_MANQUANTE` |
| Journal structure | `UX_SOLIDE` |
| Affordances détails Journal | `UX_À_POLIR` |
| États de qualité compacts | `UX_À_POLIR` |
| Mobile / petit écran | `UX_MANQUANTE` |

---

## Vérification de périmètre

- aucun moteur Analytics modifié ;
- aucun ReadModel modifié ;
- aucun RuntimeSchema modifié ;
- aucun composant React modifié ;
- aucun CSS modifié ;
- aucune migration créée ;
- aucune donnée Supabase lue/écrite ;
- aucun snapshot republié ;
- seul ce rapport d’audit est ajouté au repository.
