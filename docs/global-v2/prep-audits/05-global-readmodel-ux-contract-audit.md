# Analyse Globale V2 — audit préparatoire ReadModels / Query / UX / contrat React

> **Nature du document** : audit préparatoire en lecture seule.
>
> **Aucune implémentation frontend. Aucune migration. Aucun changement runtime. Aucune écriture Supabase.**
>
> **Seul ce document d’audit est ajouté au repository.**
>
> **Baseline repository distante observée** : branche `main`, commit `f4a6b33c815dcbf6fca92c21121102010c61d3c5` (`docs(global-v2): audit runtime publication query foundation`).
>
> **État History pris en compte** : HC1 communiqué `PASS`; HC2 → HC6 non fermés. Les contrats History qui touchent M3 / Moment / Activity / Place, dependency closure, publication, correction et cache restent à revalider à `GA0` après `POST_HISTORY_ENTRY_GATE = PASS`.
>
> **Autorité normative** : `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx` version 3.0 FINAL VERROUILLÉ, puis ses registres. Les anciennes ressources `analysis_global_*`, l’ancienne route et les anciens composants Global décrivent l’EXISTANT/legacy et ne deviennent jamais la cible par ressemblance.

---

# 0. Verdict exécutif

La cible ReadModel / Query / UX de l’Analyse Globale est suffisamment verrouillée par le Master pour préparer la future Phase H **sans nouvelle décision produit structurante aujourd’hui**.

La doctrine de tête est nette :

```text
une seule page /analyse-globale
↓
une publication Global cohérente
↓
Synthèse contextuelle lorsqu’elle existe
↓
M1 → M10 dans un ordre stable
↓
chaque module COMPACT par défaut
↓
0 ou 1 insight principal sélectionné serveur
+ 0 à 3 KPIs sélectionnés serveur
↓
Explorer = détails déjà calculés, chargés à la demande
↓
Entity Detail / History / Methodology selon destination
```

Le point le plus important pour le contrat frontend est :

```text
Analytics choisit CE QUI EST VRAI
InsightSelectionEngine choisit CE QUI EST À MONTRER
GlobalPublicationEngine choisit CE QUI EST VISIBLE / PLACEHOLDER / HIDDEN
ReadModels préparent CE QUE REACT DOIT RENDRE
React choisit seulement COMMENT LE PRÉSENTER ET COMMENT NAVIGUER
```

React ne doit donc jamais sélectionner lui-même « le fait le plus intéressant », recalculer un KPI, classer les lieux, sommer une série, calculer un delta, inférer une tendance, une causalité, une relation, un Persona ou une présence partagée.

L’audit recommande une stratégie de Query qui évite les deux extrêmes :

- **pas** un unique gigantesque payload Global contenant les dix modules et tous leurs détails cachés ;
- **pas** une Query différente pour chaque micro-ligne d’interface.

La bonne cible est :

```text
Global publication/page shell léger
+
10 PRIMARY_RM compacts, indépendamment versionnés mais cohérents avec la même publication
+
Résumé contextuel séparé
+
DETAIL_RM / RELATION_RM / ENTITY_DETAIL lazy seulement quand l’utilisateur explore
```

Les noms physiques exacts des futures Query resources ne sont **pas** figés ici. Le Master impose notamment que le Summary compact ne transporte pas en secret les données de l’état expanded.

Le socle de navigation actuel est intéressant : `ExplorationNode`, stack, semantic anchors, focus et restauration du scroll sont de bons candidats à la réutilisation. En revanche, l’Exploration actuelle ne possède pas de nœud `purchase` ni de nœud `relationship`; ils ne doivent surtout pas être simulés par un `operation` ou une autre entité si la sémantique ne correspond pas.

Les anciens ReadModels `AnalysisGlobalInitial/Baseline/Typical/Evolution/Habits/Profiles/Universe` et l’ancien écran à sept modules restent `legacy_v1`. Ils ne satisfont ni la cible M1→M10, ni l’absence de période Global universelle, ni la doctrine COMPACT/EXPANDED du Master.

```text
GLOBAL H CONTRACT
READY_TO_DESIGN_LATER
```

Ce verdict signifie : **la frontière serveur/client, la granularité conceptuelle des ReadModels, les états UX, les drill-downs et les contraintes responsive/accessibilité sont suffisamment compris pour alimenter les futurs prompts. Les schémas physiques, noms de resources et composants finaux restent à décider après GA0 et pendant la Phase H.**

---

# 1. Sources et méthode

## 1.1 Sources normatives

Sources prioritaires :

- `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx` ;
- `GLOBAL_REQUIREMENTS_MATRIX_Analyse_Globale_V2_FINAL.docx` ;
- `GLOBAL_TEST_CATALOG_Analyse_Globale_V2_FINAL.docx` ;
- `GLOBAL_CONCEPTUAL_DEPENDENCY_AND_IMPLEMENTATION_PLAN.docx`.

Le Master fixe notamment :

- une page produit unique `/analyse-globale` ;
- Synthèse puis M1 → M10 dans un ordre stable ;
- aucun filtre temporel Global universel ;
- état normal d’un module = `COMPACT` ;
- maximum 1 insight principal + 0–3 KPIs dans le compact ;
- pas de gros graphique, tableau ou liste longue dans le compact ;
- `InsightSelectionEngine` choisit quoi montrer ; React ne choisit jamais les conclusions ;
- état expanded séparé du Summary ;
- `VISIBLE / PLACEHOLDER / HIDDEN` piloté en amont ;
- support / coverage / provenance accessibles sans transformer la page en console technique ;
- valeurs estimées signalées discrètement ;
- publicationId cohérent entre les ressources affichées ;
- navigation et cache cohérents avec la publication ;
- mobile une colonne + navigation sticky ;
- accessibilité clavier/focus/reduced-motion/équivalent textuel des charts ;
- aucune information critique uniquement au hover ;
- pas d’ordre des modules appris automatiquement depuis la télémétrie UX.

## 1.2 Audits préparatoires déjà produits

- `01-global-master-capability-map.md` ;
- `02-history-global-boundary-audit.md` ;
- `03-global-authority-dependency-preaudit.md` ;
- `04-global-runtime-publication-query-audit.md`.

Cet audit 05 ne redéfinit pas leurs conclusions. Il traduit la cible analytique en **contrat de projection et d’exploration**.

## 1.3 Code observé

Principales zones lues :

- `src/query-api/analysis/global/**` ;
- `src/query-api/request/resource-contract.ts` ;
- `src/query-api/server/**` ;
- `src/server/query/runtime.ts` ;
- `src/features/analysis/global/**` ;
- `src/navigation/contracts/**` ;
- `src/navigation/controller/**` ;
- `src/features/exploration/**` ;
- `src/ui/metrics/**` ;
- audits History 20–24 / reports frontend.

Règle : l’EXISTANT est observé pour détecter les primitives réutilisables et les anti-patterns ; il n’est jamais utilisé pour simplifier la cible.

---

# 2. Doctrine UX cible : une page cohérente, Query modularisée

## 2.1 Une seule expérience utilisateur

La cible n’est pas dix pages indépendantes alignées dans un menu.

Le récit principal est :

```text
ANALYSE GLOBALE
Données certifiées jusqu’au …

NAVIGATION STICKY
Synthèse | Économie | Catégories | Chapitres | Rythme | Vie↔€ | Moments | Lieux | Conso | Profils | Nous deux

SYNTHÈSE

M1 compact
M2 compact
...
M10 compact
```

Les modules peuvent avoir des ressources Query séparées, mais cela ne doit jamais produire une sensation de dix mini-applications.

## 2.2 Lecture sans interaction

Le Master impose que la page soit utile sans ouvrir quoi que ce soit.

Par défaut :

- 2–4 paragraphes de résumé si un résumé importé compatible existe ;
- maximum 10 modules ;
- au plus 1 insight principal par module ;
- 0–3 KPIs par module ;
- support humain court si utile ;
- CTA `Explorer`.

Il n’y a pas de couche supplémentaire `Top insights` entre Synthèse et modules.

## 2.3 État COMPACT

Le Primary ReadModel d’un module doit pouvoir alimenter quelque chose de la forme conceptuelle :

```text
moduleId
ordinal
label
visibility
principalInsight?       # déjà sélectionné côté serveur
keyMetrics[0..3]        # déjà sélectionnées côté serveur
supportSummary?         # texte/refs préparés, pas calculs React
availableSections       # sections publiables, ordre contractuel
exploreDestination
publication lineage
```

Les noms de champs ci-dessus sont conceptuels uniquement.

Le `principalInsight` est optionnel. Si aucun insight matériel n’existe, le module peut montrer ses métriques structurelles sans phrase artificielle.

## 2.4 État EXPANDED

Le compact ne doit **pas** contenir en payload caché toute la profondeur analytique.

Le Master demande un contrat expanded séparé. La granularité exacte dépend du module, mais le principe est :

```text
Primary RM compact
↓ Explorer
Detail RM overview
↓
sections secondaires lazy si elles ont une vraie profondeur
↓
Entity / Relation / History / Methodology
```

La modularité Query doit suivre la valeur produit et le poids des données, pas chaque accordéon visuel.

---

# 3. EXISTANT Global : ce qui est réutilisable et ce qui ne l’est pas

## 3.1 ReadModels Global legacy

Le repo possède actuellement :

- `AnalysisGlobalInitialReadModel` ;
- `AnalysisGlobalBaselineReadModel` ;
- `AnalysisGlobalTypicalReadModel` ;
- `AnalysisGlobalEvolutionReadModel` ;
- `AnalysisGlobalHabitsReadModel` ;
- `AnalysisGlobalProfilesReadModel` ;
- `AnalysisGlobalUniverseReadModel` ;
- Breakdown / Contexts de compatibilité.

Ils partagent `AnalysisGlobalIdentity` :

```text
observationWindow
asOf
subject
```

Cette identité entre en conflit avec la doctrine finale « aucune période Global universelle ». Ces ReadModels sont donc des **ressources legacy utiles comme preuve de patterns techniques**, pas des contrats produit V2 à conserver.

## 3.2 Frontend legacy

L’écran courant utilise sept actes/modules :

```text
Chiffres
Socle
Vie habituelle
Évolution
Habitudes
Profils
Univers
```

Le Master final exige Synthèse + dix modules fixes. Le frontend courant est donc à remplacer/adapter lourdement, pas à étendre jusqu’à dix par accumulation.

Le frontend courant montre toutefois des primitives utiles :

- états transport `idle/loading/error/success` ;
- ModuleBoundary et skeleton ;
- refresh indicator ;
- navigation locale ;
- chargement Query indépendant ;
- certaines interactions de sélection purement locales.

## 3.3 RuntimeSchema

Les anciens Global ReadModels possèdent déjà validation/runtime schemas. Le **mécanisme** est réutilisable ; les schemas Global V2 finaux seront nouveaux.

## 3.4 Navigation / Exploration

Le contrat `ExplorationNode` actuel sait représenter :

- analysis target ;
- Moment ;
- Place ;
- Merchant ;
- Persona ;
- Life Event ;
- Operation ;
- Methodology ;
- Gallery.

`AnalysisTargetSubject` sait notamment représenter family/category/activity/context.

La navigation possède aussi :

- stack d’exploration ;
- semantic anchors ;
- checkpoint ;
- mémoire scrollY / anchorOffset ;
- restauration focus/scroll.

Cette base est un fort candidat `REUSE/ADAPT` pour Global H.

### Gap important : Purchase

Il n’existe pas actuellement de `ExplorationNode.kind = purchase`.

M8 étant au grain PurchaseEvent, Global H devra décider après GA0 si :

- un vrai Purchase Detail typé est requis ;
- ou si le détail produit/achat reste un Detail RM du module.

Interdit : mapper silencieusement un PurchaseEvent sur `operation` juste parce qu’une opération bancaire existe. `PurchaseEvent ≠ bank transaction`.

### Gap important : Relationship

Il n’existe pas non plus de nœud générique `relationship`.

M5 peut parfaitement utiliser un `RELATION_READMODEL` module-local sans créer une nouvelle « entité relation » dans Navigation Core. Un type d’exploration générique ne sera ajouté que si le futur design prouve sa nécessité.

---

# 4. Architecture ReadModel cible

## 4.1 Quatre niveaux de projection

La Phase H doit distinguer :

### A. Global Page / Publication shell

Responsabilités conceptuelles :

- publication attendue ;
- asOf exact ;
- certifiedThrough ;
- liveThrough lorsque pertinent ;
- ordre fixe M1→M10 ;
- visibilité top-level ;
- cohérence de révision ;
- état du résumé importé ;
- signal « nouvelle publication disponible » sans hot-swap.

Ce shell ne calcule aucun insight.

### B. PRIMARY_RM — un par module

Responsable du mode COMPACT :

- identité module ;
- insight principal éventuel ;
- 0–3 KPIs ;
- résumé de support humain ;
- disponibilité des sections ;
- destinations d’exploration ;
- publication lineage.

### C. DETAIL_RM / RELATION_RM

Chargé uniquement à l’exploration pour :

- séries ;
- breakdowns ;
- comparaisons ;
- listes significatives ;
- relations ;
- méthodologie ;
- preuves agrégées.

Une section légère peut être embedded dans un détail parent. Une section lourde, paginable ou conditionnelle mérite une Query dédiée.

### D. ENTITY_DETAIL

Utilise autant que possible l’Exploration commune : Moment, Place, Merchant, Persona, Life Event, Operation et futures entités réellement nécessaires.

Le Global ne doit pas créer sa propre « version d’un marchand » ou d’un lieu si la fiche entité canonique suffit.

---

# 5. Matrice synthétique M1 → M10

| Module | PRIMARY_RM conceptuel | DETAIL_RMS principaux | Drill-downs majeurs | Qualité dominante |
|---|---|---|---|---|
| M1 Économie | Actual/Typical/Minimal + structure + insight principal + 0–3 KPI | évolution, structure, récurrences, contributeurs, méthode | mois History, récurrence, catégorie/Need, methodology | support temporel, certified history, provenance |
| M2 Catégories & Needs | catégories/Needs structurants + insight + KPI | breakdown, évolution, contributeurs, fréquence×ticket conditionnelle | catégorie, Need/family, mois History, Merchant/Purchase si autorisé | category/Need coverage, purchase coverage |
| M3 Chapitres | phase/régime actuel + transformation principale éventuelle | timeline transformations, transformation detail, evidence | mois/jour History, Moment/LifeEvent, relation publiée | support avant/après, gaps, persistence |
| M4 Rythme | routine/cadence principales + KPIs | activités, contexts, routines, evolution, seasonality | Activity, jour History, Place, Person | occurrence support, day coverage, seasonality cycles |
| M5 Vie↔Argent | relations matérielles sélectionnées | relation list, relation detail, populations/contrasts, method | Activity/Context/Place/Moment, History evidence | comparable support, multiple-testing, association≠causalité |
| M6 Moments | Moments/séries importantes + causal vs during | comparisons, factors, series detail | Moment, LifeEvent, History month/day | comparable Moment support, causal authority |
| M7 Lieux | lieux/évolution principaux | important places, evolution, mobility conditional, localized finance conditional | Place, History occurrences, route detail si autorité | place coverage, localization coverage, estimate provenance |
| M8 Conso | merchants/purchase habits principales | merchants, cadence, substitution, product lifecycle conditional, price conditional | Merchant, Purchase, Product, Operation preuve | PurchaseEvent support, product/price coverage |
| M9 Profils | différences pairwise matérielles + personne KPIs | difference detail, person sections, personal typical, enriched cost conditional | Persona/Person, Activity, Place, category, History evidence | common comparable support, person attribution |
| M10 Nous deux | shared participation principales + KPIs | shared activity/place/moment, participation evidence, shared causal finance | Activity, Moment, Place, Person | shared evidence state, no 50/50, participant coverage |

`Social` reste transversal : pas de onzième module top-level. Ses sorties apparaissent uniquement dans les modules où le Master les autorise et selon leur visibility.

---

# 6. Module 1 — Notre fonctionnement économique

## PRIMARY_RM

Le compact doit pouvoir présenter :

- Actual/référence courante pertinente lorsque contractuellement utile ;
- Typical officiel ;
- Minimal officiel ;
- stabilité/tendance si elle constitue l’insight principal ;
- au plus 3 KPIs réellement structurants ;
- support/corpus sous forme humaine concise.

Le serveur choisit quels KPIs sont les 0–3 clés. React ne prend pas toutes les métriques puis ne conserve pas les trois plus « intéressantes ».

## DETAIL_RMS

Candidats conceptuels :

- overview économique ;
- évolution Actual/Typical/Minimal ;
- structure Necessity / Behavior / LifeScope ;
- récurrences structurelles ;
- contributeurs d’évolution ;
- méthode & données.

Pas besoin d’une Query distincte par axe si un seul ReadModel de structure reste compact et cohérent.

## DRILLDOWNS

- point mensuel → mois History canonique ;
- catégorie/Need contributeur → analyse ciblée ou détail Global M2 ;
- récurrence → détail récurrence si contrat réel ;
- méthode → Methodology lorsque l’objet est une MetricId, sinon section méthode du module.

## CLIENT_ALLOWED_TRANSFORMS

- formatage € / pourcentage déjà calculé ;
- choix visuel de série fournie ;
- ouverture/fermeture de section ;
- sélection locale d’un point pour afficher son tooltip préparé ;
- navigation.

## CLIENT_FORBIDDEN_TRANSFORMS

- `Typical - Minimal` si le delta contractuel n’est pas déjà fourni ;
- somme des composants pour reconstruire Actual ;
- recalcul de share ;
- median/MAD/IQR ;
- trend ;
- stability ;
- top contributeurs ;
- structural recurring equivalent ;
- sélection de l’insight principal.

## QUALITY_STATES

- manque de mois certifiés → support insuffisant, pas faux trend ;
- trou temporel → gap conservé ;
- Typical/Minimal unavailable → UNKNOWN/placeholder selon publication policy ;
- zéro réel → KNOWN 0 ;
- valeur estimée → marqueur discret + provenance dans méthode.

---

# 7. Module 2 — Catégories & Needs

## PRIMARY_RM

- répartition structurante ;
- insight principal éventuellement lié à une évolution matérielle ;
- 0–3 KPIs ;
- couverture catégorie/Need explicitement disponible mais non omniprésente visuellement.

## DETAIL_RMS

- breakdown Category/Subcategory/Need ;
- séries historiques ;
- contributeurs ;
- frequency×ticket uniquement si PurchaseEvent support fiable ;
- méthode & données.

## DRILLDOWNS

- Category → target analysis / History category lorsque le contexte est mensuel ;
- Need/family → analyse ciblée ;
- month → History ;
- Merchant → fiche Merchant ;
- Purchase → vrai Purchase detail seulement si contrat existe ;
- Operation → seulement comme preuve bancaire, jamais substitut du PurchaseEvent.

## CLIENT_FORBIDDEN_TRANSFORMS

- regroupement de catégories ;
- part du total ;
- delta €/% ;
- trend ;
- fréquence × ticket decomposition ;
- classement par importance ;
- compensation d’une coverage manquante.

## QUALITY_STATES

Un total financier peut être KNOWN alors que `needCoverage` est PARTIAL. React ne doit pas appliquer la coverage Need au total financier comme si toute la finance devenait inconnue.

---

# 8. Module 3 — Chapitres & transformations

## PRIMARY_RM

- phase/régime courant publié ;
- transformation principale éventuelle ;
- dates/intervalle préparés ;
- 0–3 signaux/KPIs seulement si le moteur les a sélectionnés.

## DETAIL_RMS

- timeline de transformations ;
- transformation detail ;
- before/after evidence ;
- contributions multi-domaines ;
- relations changées après Phase D lorsque autorisées ;
- méthode & données.

## DRILLDOWNS

- anchor temporel → mois History ;
- date/jour → History Journal lorsque le contrat de navigation le permet ;
- Moment/LifeEvent → exploration entité ;
- Activity/Place → entité/analyse ciblée ;
- Relationship → M5 relation detail, pas causalité inventée.

## CLIENT_FORBIDDEN_TRANSFORMS

- détection de rupture ;
- comparaison before/after ;
- persistence gate ;
- qualification DURABLE_CHANGE / NEW_PHASE / TEMPORARY_CHAPTER ;
- fusion multi-domaines ;
- réordonnancement des transformations par intuition UI.

## QUALITY_STATES

- transformation non confirmée par support suffisant → partial/placeholder ;
- LIVE_TAIL peut confirmer provisoirement une phase existante, jamais créer seul une nouvelle transformation certifiée ;
- gaps visibles dans evidence, pas interpolés React.

---

# 9. Module 4 — Notre rythme de vie & nos habitudes

## PRIMARY_RM

- routines/cadences principales ;
- métriques d’occurrence ;
- insight principal seulement si matériel et supporté ;
- jamais « pas d’activité = inactivité » sans observabilité.

## DETAIL_RMS

- activités/cadence ;
- contextes de journées ;
- routines ;
- évolution ;
- seasonality ;
- Activity detail ;
- méthode & données.

## DRILLDOWNS

- Activity → analyse/détail Activity ;
- jour → History Journal ;
- Place → Place entity ;
- Person → Persona/M9 ;
- routine évolution → M3 si transformation publiée.

## CLIENT_FORBIDDEN_TRANSFORMS

- cadence ;
- routine detection ;
- seasonality ;
- coût causal/associé ;
- fréquence habituelle ;
- population de jours ;
- support suffisant.

## QUALITY_STATES

Knowledge state de l’occurrence et support statistique restent distincts. Trois occurrences peuvent être KNOWN et néanmoins insuffisantes pour déclarer une routine.

---

# 10. Module 5 — Vie ↔ Argent

## PRIMARY_RM

- relations publiables retenues par le moteur ;
- une relation principale éventuelle ;
- 0–3 KPIs de contexte ;
- langage d’association, pas de causalité sauf contrat explicite.

## DETAIL_RMS

- liste des RelationshipInsights publiés ;
- relation detail ;
- populations comparées ;
- effet/delta préparé ;
- support, coverage, multiple-testing/FDR ;
- méthode & données.

## DRILLDOWNS

- relation → détail local M5 ;
- facteur Activity/Context/Place/Moment → entité/analyse cible ;
- mois/jour de preuve → History ;
- methodology → méthode du moteur.

Une `RelationshipInsight` n’a pas besoin de devenir une entité globale de navigation si cela n’apporte rien.

## CLIENT_FORBIDDEN_TRANSFORMS

- coefficient/effect size ;
- significance ;
- FDR ;
- construction des groupes ;
- support intersection ;
- relationship strength ;
- association → causalité ;
- tri matériel.

## QUALITY_STATES

Une relation non significative n’est pas une relation « négative ». Elle peut être absente/HIDDEN ou représentée comme insuffisante selon la politique. `UNKNOWN`, `not material` et `no association observed` restent distincts.

---

# 11. Module 6 — Moments & expériences

## PRIMARY_RM

- Moment/famille d’expériences principale ;
- causalCost et spentDuring seulement sous des libellés explicitement distincts ;
- peer comparison si support suffisant ;
- 0–3 KPIs.

## DETAIL_RMS

- Moment group/series ;
- peer comparison ;
- factor deltas ;
- causal vs concomitant finance ;
- Moment detail / LifeEvent detail ;
- méthode & données.

## DRILLDOWNS

- Moment → Exploration Moment ;
- LifeEvent → Exploration Life Event ;
- month/day → History ;
- Activity/Place participant → leurs détails ;
- M10 lorsque la dimension partagée est publiée.

## CLIENT_FORBIDDEN_TRANSFORMS

- comparabilité des Moments ;
- peer group ;
- causal cost ;
- spentDuring ;
- factor delta ;
- typical Moment cost ;
- ranking des expériences.

## QUALITY_STATES

`spentDuring ≠ causalCost`. L’UI ne doit jamais présenter l’un comme l’autre si l’un manque. Support de famille de Moments et knowledge state de chaque Moment sont séparés.

---

# 12. Module 7 — Nos lieux & notre mobilité

## PRIMARY_RM

- lieux importants/évolution préparés par Geo Analytics ;
- nombre de visites/jours/stays pertinents ;
- insight principal ;
- mobilité conditionnelle seulement si l’autorité existe.

## DETAIL_RMS

- overview ;
- évolution géographique ;
- lieux importants ;
- Place detail ;
- routes/mobilité conditionnelles ;
- finance localisée conditionnelle ;
- méthode & données.

Le Master donne précisément le pattern expanded : vue d’ensemble + évolution + lieux importants + trajets + finance localisée + méthode, avec HIDDEN/PLACEHOLDER selon éligibilité.

## DRILLDOWNS

- Place → Exploration Place ;
- occurrence → mois/jour History ;
- route → détail mobilité si autorité ;
- localized finance → catégorie/merchant/history evidence ;
- shared place → M10 si participation prouvée.

## CLIENT_FORBIDDEN_TRANSFORMS

- GPS → visite ;
- visite → transaction ;
- localized coverage ;
- place importance ;
- ranking ;
- distance/route ;
- estimation carburant ;
- coût mobilité ;
- shared presence.

## QUALITY_STATES

Présence géographique, visite et finance localisée ont chacune leur knowledge/coverage. Une absence de localisation n’est pas `0 € localisé`. Une estimation mobilité conserve sa provenance estimée.

---

# 13. Module 8 — Nos habitudes de consommation

## PRIMARY_RM

- habitudes marchands / achats structurantes ;
- fréquence/ticket déjà calculés ;
- éventuelle substitution matérielle ;
- 0–3 KPIs ;
- produit/prix uniquement si les authority gates sont ouverts.

## DETAIL_RMS

- Merchant analytics ;
- purchase cadence ;
- substitution ;
- Purchase detail si réellement nécessaire ;
- product lifecycle conditionnel ;
- product detail conditionnel ;
- personal price index conditionnel ;
- price/quantity/mix detail conditionnel ;
- méthode & données.

## DRILLDOWNS

- Merchant → Exploration Merchant ;
- Purchase → futur Purchase detail typé si construit ;
- Product → detail conditionnel ;
- category → M2 ;
- month → History ;
- operation → seulement preuve/source, jamais identité achat.

## CLIENT_FORBIDDEN_TRANSFORMS

- bank operation → PurchaseEvent ;
- retained purchase count ;
- mean/median ticket ;
- cadence ;
- substitution ;
- purchase lifecycle ;
- FIRST_OBSERVED/ADOPTED/DORMANT/ABANDONED/REACTIVATED ;
- Törnqvist ;
- decomposition prix/quantité/mix.

## QUALITY_STATES

Produit absent des données ≠ aucun produit acheté. Purchase coverage et product coverage restent distincts. Une capability DATA/AUTHORITY_GATED non disponible doit être HIDDEN ou PLACEHOLDER selon le Master, pas remplie avec une approximation bancaire.

---

# 14. Module 9 — Nos profils — Adrien & Manon

## PRIMARY_RM

- différences pairwise réellement distinctives sélectionnées serveur ;
- métriques personnelles structurantes ;
- support commun de comparaison ;
- 0–3 KPIs par lecture, sans symétrie artificielle.

Desktop peut utiliser deux colonnes lorsqu’elles aident, mais le backend doit fournir les comparaisons pairwise communes.

## DETAIL_RMS

- persona differences ;
- difference detail ;
- sections personne ;
- ObservedPersonalTypicalCost ;
- PersonalReferenceCost conditionnel ;
- Activity/Place/Consumption profile detail ;
- méthode & données.

## DRILLDOWNS

- Person → Exploration Persona ;
- différence catégorie/activity/place/merchant → entité/module cible ;
- month evidence → History ;
- M10 pour partage, sans mélanger individuel et couple.

## CLIENT_FORBIDDEN_TRANSFORMS

- comparer des corpus non communs ;
- delta personne ;
- ranking des différences ;
- materiality ;
- exceptional exclusion ;
- observed personal typical ;
- enrichissement personnel ;
- « remplir » une carte vide pour symétrie.

## QUALITY_STATES

Chaque Persona peut avoir des sections différentes. Une section non pertinente est omise ; on ne produit pas une carte vide pour égaliser les colonnes. Une comparaison directe exige un support comparable commun.

---

# 15. Module 10 — Nous deux

## PRIMARY_RM

- activités/lieux/Moments réellement partagés ;
- taux/support partagé ;
- insight principal éventuel ;
- coût d’expérience partagé uniquement au sens causal/contextuel autorisé, jamais attribution 50/50 automatique.

## DETAIL_RMS

- shared activities ;
- shared places ;
- shared Moments ;
- participation evidence ;
- shared causal finance detail si explicitement autorisé ;
- social context conditionnel ;
- méthode & données.

## DRILLDOWNS

- Activity → Activity detail ;
- Moment → Moment entity ;
- Place → Place entity ;
- Person → Persona ;
- History occurrence → month/day ;
- participant evidence → preuve sans fabriquer identité externe.

## CLIENT_FORBIDDEN_TRANSFORMS

- co-présence → activité partagée ;
- 50/50 ;
- participant inference ;
- shared rate ;
- shared causal cost ;
- conflit participant → PRESENT ;
- social graph.

## QUALITY_STATES

La participation garde des états explicites `PRESENT / ABSENT / UNKNOWN / CONFLICT` ou contrat équivalent. `UNKNOWN` ne peut jamais devenir `ABSENT` pour simplifier l’UI.

---

# 16. Dimension sociale transversale

La dimension sociale **n’est pas un module 11**.

Ses outputs peuvent enrichir :

- M3 transformations ;
- M6 Moments ;
- M9 Persona ;
- M10 Nous deux ;
- éventuellement d’autres détails explicitement autorisés.

Si l’autorité Contact/Group n’existe pas :

- garder participant externe non résolu ;
- ne pas inférer identité ;
- ne pas créer un graphe social automatique ;
- visibility HIDDEN/PLACEHOLDER selon contrat.

---

# 17. Stratégie de Query : éviter monolithe et fragmentation

## 17.1 Ce qui doit être indépendant

Au minimum conceptuellement :

- Global page/publication shell ;
- ImportedGlobalSummaryReadModel ;
- M1 Primary ;
- M2 Primary ;
- … ;
- M10 Primary.

Tous doivent être compatibles avec le `publicationId` attendu par la page.

## 17.2 Ce qui doit rester lazy

- séries lourdes ;
- tables ;
- heatmaps ;
- long rankings ;
- Relationship details ;
- entity details ;
- product/price/mobility conditionnels ;
- méthode détaillée ;
- preuves longues.

## 17.3 Ce qui ne justifie pas forcément une Query dédiée

- un petit paragraphe d’explication déjà lié au même overview ;
- 2–3 valeurs supplémentaires légères ;
- état d’ouverture d’un accordéon ;
- label/localized formatting ;
- liste de sections disponibles déjà contenue dans le RM parent.

## 17.4 Batch initial

Le Master exige que les dix modules compacts soient lisibles sans interaction. Deux options physiques restent ouvertes :

- charger le shell + les dix Primary RMs en parallèle ;
- charger un ensemble initial prioritaire puis compléter rapidement les autres compacts avant interaction.

L’audit 04 interdit de choisir sans mesure. Ce qui est fixé : **aucun détail lourd ne doit être embarqué juste pour éviter une Query lazy**.

## 17.5 Cache et publication

Cible UX :

```text
cache key conceptuelle = publicationId + resourceKey + parameters
```

Si un RM récupéré n’appartient pas à la publication attendue :

- ne pas l’afficher dans la page actuelle ;
- réessayer contre la bonne publication ou proposer actualisation ;
- ne jamais hot-swap M4 alors que M1/M2/M3 appartiennent encore à l’ancienne génération.

---

# 18. Drill-down map globale

## 18.1 Taxonomie

| Destination | Usage Global | Contrat recommandé |
|---|---|---|
| Module detail | profondeur analytique du même module | DETAIL_RM |
| Relationship | détail statistique M5 | RELATION_RM module-local par défaut |
| Moment | fiche sémantique | Exploration existante |
| Life Event | fiche sémantique | Exploration existante |
| Place | fiche entité | Exploration existante |
| Merchant | fiche entité | Exploration existante |
| Person | Persona / M9 | Exploration existante + Global detail |
| Category | analyse ciblée / M2 | AnalysisTarget existant ou RM Global |
| Activity | analyse ciblée / M4 | AnalysisTarget existant ou RM Global |
| Operation | preuve bancaire | Exploration Operation |
| Purchase | achat humain | gap : contrat typé à décider si requis |
| Product | conditionnel M8 | gap : seulement si authority + UX cible |
| Month | contexte historique | History V2 canonique |
| Day | Journal historique | History V2 / semantic navigation |
| Method | explication calcul | Methodology MetricId ou Method/Data RM |

## 18.2 Règle de profondeur

Un drill-down n’autorise pas le client à recalculer une analyse à partir de ce qu’il voit.

Exemple interdit :

```text
ouvrir Place
→ récupérer les opérations visibles
→ les sommer React
→ afficher « ce lieu coûte X »
```

Le coût localisé doit être une sortie Analytics autoritaire.

---

# 19. Global ↔ History UX

History et Global répondent à des questions différentes :

```text
History = que s’est-il passé dans cette période ?
Global = que raconte l’ensemble des données fiables ?
```

Global peut donc **pointer vers History comme preuve temporelle**, sans dupliquer le calendrier/journal.

## 19.1 Mois

Destination actuelle V2 : `/historique/[month]`.

Cas utiles :

- point de courbe M1/M2 ;
- transformation M3 ;
- changement de routine M4 ;
- période de relation M5 ;
- Moment M6 ;
- évolution de lieu M7 ;
- purchase/merchant trend M8 ;
- evidence Persona M9 ;
- expérience partagée M10.

Le lien doit transporter l’intention sémantique utile si le Navigation Core le permet, sans embarquer des DTOs serveur dans l’URL/checkpoint.

## 19.2 Jour

Une preuve au grain jour doit ouvrir le Journal/Day surface de History, pas reconstruire un mini-Journal dans Global.

## 19.3 Moment

Par défaut : ouvrir la fiche Moment commune. Le passage vers le mois History est une navigation secondaire lorsque l’utilisateur veut le contexte temporel.

## 19.4 Activity

Un Activity detail Global peut montrer le comportement multi-périodes. Le History Activity detail reste utile lorsqu’un mois précis est sélectionné. Ne pas faire du snapshot mensuel History la source du Global.

## 19.5 Place

La fiche Place commune porte l’identité. Global M7 porte l’analyse longue ; History porte le contexte mensuel. Les trois ne doivent pas se dupliquer.

## 19.6 Category

M2 porte la structure globale. History Category Detail porte un mois. Le drill-down doit choisir selon la question, pas recopier un écran.

---

# 20. Contrat React : quatre classes de transformation

## 20.1 `SERVER_PREPARED`

Doivent obligatoirement arriver prêts :

- principal insight ;
- sélection 0–3 KPI ;
- ordre métier des éléments ;
- top N ;
- rank ;
- materiality ;
- share ;
- delta ;
- comparaison ;
- trend ;
- stability ;
- seasonality ;
- change point ;
- before/after ;
- recurrence cadence ;
- relationship significance/effect/FDR ;
- causal vs associated ;
- Moment comparability ;
- causalMomentCost ;
- spentDuring ;
- place importance ;
- localized finance / coverage ;
- mobility cost ;
- purchase cadence ;
- merchant substitution ;
- product lifecycle ;
- price index/decomposition ;
- Persona common-support comparison ;
- PersonaDifference ranking ;
- SharedParticipation ;
- shared rates/costs ;
- support intersection ;
- coverage qualification ;
- visibility `VISIBLE/PLACEHOLDER/HIDDEN` ;
- qualification/reason codes ;
- reference windows ;
- corpus `CERTIFIED_HISTORY` / `LIVE_TAIL` eligibility.

## 20.2 `PRESENTATION_ONLY`

React peut :

- grid/flex/layout ;
- afficher/masquer selon visibility déjà fournie ;
- ouvrir/fermer accordéons ;
- gérer tabs de présentation ;
- gérer focus ;
- scroll ;
- drawer / bottom sheet ;
- skeleton / loading / error ;
- choix responsive ;
- tooltips ;
- animation sobre ;
- aria ;
- texte alternatif ;
- sélection locale d’un point déjà calculé.

## 20.3 `LIGHT_FORMATTING`

Autorisé :

- locale date ;
- format monnaie ;
- format pourcentage d’un ratio déjà calculé ;
- unité ;
- arrondi d’affichage selon policy ;
- labels courts ;
- troncature textuelle non sémantique.

Le calcul `ratio = a / b` n’est pas du formatting : le serveur doit fournir le ratio.

## 20.4 `FORBIDDEN_CLIENT_CALC`

Interdit notamment :

- somme de valeurs métier pour recréer KPI ;
- moyenne/médiane ;
- delta absolu/relatif ;
- topN/rank ;
- materiality ;
- trend/stability ;
- significance ;
- causalité ;
- routine ;
- importance Place ;
- localized spend ;
- support/coverage threshold ;
- selection d’insight ;
- ordre de modules ;
- déduplication économique ;
- PurchaseEvent resolution ;
- Persona difference ;
- inference de partage ;
- choix du corpus historique.

---

# 21. Audit des risques React dans l’existant legacy

Le frontend Global actuel n’est pas la cible, mais plusieurs patterns méritent une règle de migration.

## 21.1 `Math.round(activityRate * 100)`

Acceptable seulement comme **formatage** d’un ratio déjà calculé côté serveur. Ne doit pas devenir une habitude où React calcule le ratio lui-même.

## 21.2 `.at(-1)` sur une série

Acceptable comme sélection locale si le serveur a déjà fourni une série ordonnée et si l’action n’attribue aucune sémantique « actuel/important ».

Dans Global final, React ne doit pas décider que « dernier point = régime courant » ; ce concept appartient à Analytics.

## 21.3 `.filter(available)`

Une filtration de présentation peut être acceptable si `available/visibility` est une décision serveur. Interdit si React détermine la disponibilité à partir des données brutes.

## 21.4 `activeFilterCount`

Compter le nombre de filtres UI actifs est purement présentation/navigation. Aucun problème tant que les filtres ne redéfinissent pas les références analytiques.

## 21.5 Navigation basée sur `observationWindow`

Legacy. Le Master final n’a pas de fenêtre Global universelle ; ne pas réutiliser ce pattern comme contrat de tous les modules.

---

# 22. Knowledge states, support et coverage

## 22.1 Trois axes indépendants

L’UX doit conserver au moins :

```text
KNOWLEDGE STATE
KNOWN / PARTIAL / UNKNOWN / NOT_APPLICABLE / CONFLICT

SUPPORT
INSUFFICIENT / PARTIAL_SUPPORT / SUFFICIENT / STRONG
(ou projection équivalente versionnée)

COVERAGE
par dimension réellement concernée
```

Connaître précisément trois Moments (`KNOWN`) ne signifie pas disposer d’un support suffisant pour une estimation typique.

## 22.2 KNOWN

`KNOWN + value=0` affiche zéro lorsque zéro est une observation réelle.

Aucune décoration technique permanente si la valeur est Observed et bien supportée.

## 22.3 PARTIAL

Une partie fiable peut être affichée seulement si la policy l’autorise.

Le ReadModel doit préserver la raison : observed subset, lower bound, missing intervals/linkage/source, ou contrat final équivalent.

React ne transforme jamais PARTIAL en KNOWN parce que la carte serait plus simple.

## 22.4 UNKNOWN

Concept applicable mais valeur inconnue.

- pas de `0` ;
- pas de faux KPI ;
- message discret « non disponible / non estimé » selon provenance ;
- placeholder compact si l’absence est informative.

## 22.5 NOT_APPLICABLE

Concept sans sens pour ce contexte.

Sous-section généralement `HIDDEN`, donc ni rendue ni dans la navigation locale.

## 22.6 CONFLICT

Sources autoritaires incompatibles.

- ne pas afficher une valeur arbitrée client ;
- état « à vérifier » ou raison utilisateur ;
- conserver la trace pour Method/Data/Diagnostic futur.

## 22.7 Support insuffisant

Un résultat descriptif peut être KNOWN mais une conclusion structurelle interdite.

Exemple :

```text
3 week-ends documentés
→ count KNOWN
→ typical weekend cost : INSUFFICIENT SUPPORT
```

Le compact peut montrer le count, pas inventer une phrase « vos week-ends coûtent habituellement… ».

## 22.8 Coverage insuffisante

Coverage est dimensionnelle.

Exemple :

```text
Actual total = KNOWN
needCoverage = 72%
```

La totalité financière ne devient pas UNKNOWN. La ventilation Need est qualifiée comme partielle.

## 22.9 Absence réelle vs absence de données

Seulement une observation complète permettant de conclure absence autorise un `KNOWN 0`.

Sinon : UNKNOWN/PARTIAL.

---

# 23. Visibilité : VISIBLE / PLACEHOLDER / HIDDEN

## VISIBLE

Surface réellement rendue et navigation autorisée.

## PLACEHOLDER

L’absence est informative.

Exemple : saisonnalité avec seulement deux cycles complets.

Le placeholder :

- reste compact ;
- explique pourquoi la conclusion n’est pas encore possible ;
- ne prend pas la place d’un grand module vide.

## HIDDEN

Surface sans raison d’être visible :

- pas rendue ;
- pas dans la navigation ;
- pas de carte vide pour maintenir une symétrie.

React applique cette décision ; il ne la produit pas.

---

# 24. Méthode & données

Le Master interdit de coller en permanence :

```text
supportStatus
coverage
methodVersion
provenance
```

à côté de chaque valeur.

La cible est une progressive disclosure commune :

```text
Méthode & données
→ basé sur X unités / mois certifiés
→ coverage pertinente
→ référence utilisée
→ méthode/version
→ provenance / estimation
→ limites/gaps
```

Une valeur estimée conserve cependant un signal discret obligatoire (`≈` ou équivalent) avant même d’ouvrir le détail.

Ce mécanisme doit être commun à M1→M10 pour éviter dix conventions différentes.

---

# 25. Responsive — contraintes de contrat, pas CSS final

## 25.1 Structure mobile

Le target impose :

```text
Header
↓
Navigation Global sticky
↓
Synthèse
↓
M1 compact
↓
...
↓
M10 compact
```

Une seule colonne.

## 25.2 Navigation mobile

Labels courts :

```text
Synthèse | Économie | Catégories | Chapitres | Rythme | Vie↔€ | Moments | Lieux | Conso | Profils | Nous deux
```

Le chip actif doit revenir dans la zone visible.

Le CSS legacy rend actuellement `.localNav` non-sticky sous 48rem : ce comportement ne doit pas être conservé dans la cible.

## 25.3 KPIs

Pas de grille rigide de 4+ KPIs minuscules.

Le RM ne doit pas imposer une présentation nécessitant quatre colonnes. Limite produit : 0–3 KPIs compacts, affichables sur 1–2 colonnes selon largeur.

## 25.4 Expanded mobile

- preview simple → bottom sheet possible ;
- contenu complexe → plein écran ;
- navigation vers le module ne l’ouvre pas automatiquement ;
- `Explorer` reste une action distincte.

## 25.5 Tables / heatmaps

Un détail large peut scroller horizontalement si nécessaire, mais :

- aucune information critique uniquement dans une matrice impossible à lire mobile ;
- équivalent textuel/table accessible ;
- server-prepared data ;
- pas de recompute client pour fabriquer une vue mobile simplifiée.

---

# 26. Accessibilité — contraintes que les ReadModels doivent permettre

La future Phase H doit permettre :

- `aria-expanded` / `aria-controls` sur sections expandable ;
- navigation entièrement clavier ;
- ordre DOM cohérent avec ordre visuel ;
- focus restauré après fermeture drawer/fullscreen ;
- semantic anchors ;
- `prefers-reduced-motion` ;
- charts avec équivalent textuel ;
- points/éléments graphiques sélectionnables au clavier lorsque interactifs ;
- couleur jamais seule porteuse du sens ;
- aucune info critique uniquement au hover ;
- labels accessibles pour valeurs partielles/estimées/conflit.

Conséquence ReadModel : un chart ne peut pas recevoir seulement des coordonnées visuelles opaques. Il doit conserver labels, valeurs/états et sens sémantique nécessaires à une alternative accessible.

---

# 27. Navigation, focus et restauration

Le Master demande que le retour depuis Entity Detail restaure exactement section et scroll.

L’existant possède déjà :

- `NavigationCheckpoint` ;
- `SemanticAnchor` ;
- `ScrollMemory` ;
- `anchorOffset` ;
- stack Exploration ;
- readiness ;
- focus/scroll restoration.

C’est un excellent candidat à l’adaptation Global.

Le futur Global doit définir des anchors stables pour :

- `#synthese` ;
- M1→M10 ;
- éventuellement sections expanded si deep-linkable.

Le checkpoint ne doit pas stocker des séries ou DTOs ; il doit stocker uniquement le contexte minimum reconstructible.

---

# 28. Publication / cohérence de page

Le ReadModel Global ne peut pas être pensé sans publication.

La page doit connaître une génération attendue.

Chaque ressource rendue doit être compatible :

```text
publicationId attendu
contractVersion compatible
method signature compatible
revision/source lineage compatible
```

Une nouvelle génération publiée pendant le scroll :

- ne remplace pas silencieusement les modules déjà lus ;
- peut déclencher un signal « une version plus récente est disponible » ;
- le refresh charge alors un ensemble cohérent.

Le `RefreshIndicator` legacy est une primitive UI possible, mais le contrat final doit être publication-aware et non simple stale-while-revalidate de ressources indépendantes.

---

# 29. Charts

Le Master limite leur rôle : comprendre une évolution ou une structure.

Donc :

- aucun gros chart dans le compact ;
- un chart expanded seulement s’il répond à une question ;
- séries préparées serveur ;
- axes/unités cohérents ;
- pas de mélange EUR et occurrences sur un axe sans contrat ;
- gaps conservés ;
- état inconnu visible ;
- alternative accessible.

React peut tracer les points, mais ne calcule pas la série analytique.

---

# 30. Instrumentation UX

Événements techniques prévus par le Master :

```text
global_module_viewed
global_module_expanded
global_section_expanded
global_entity_opened
global_methodology_opened
```

Usage autorisé : comprendre l’utilisation réelle pour une décision produit ultérieure.

Usage interdit :

```text
90% des clics vont sur M7
→ automatiquement déplacer M7 avant M1
```

L’ordre des modules reste stable et contractuel.

---

# 31. Résumé contextuel et Phase H

Le Résumé contextuel est Phase I, après stabilisation déterministe.

La Phase H doit néanmoins réserver une surface propre :

```text
ImportedGlobalSummaryReadModel
```

avec :

- publication source ;
- fraîcheur/stale ;
- texte importé validé ;
- absence/placeholder ;
- aucune capacité de recalcul.

Le résumé ne doit pas devenir le Primary RM d’un module ni transporter des vérités différentes.

Si Phase I n’est pas encore implémentée, Global déterministe doit rester parfaitement lisible sans elle.

---

# 32. Compatibilité Media — limite de cet audit

Le design détaillé Media relève de l’audit 06 / checkpoint Media futur.

Contrainte ReadModel à préserver :

- un Moment/Place/Activity peut recevoir plus tard une `mediaRef` optionnelle ;
- l’absence de média n’altère pas knowledge/support Analytics ;
- le Summary compact ne dépend jamais d’une image ;
- React résout une ref, pas un blob ;
- ajout média = contenu/presentation scope, pas recalcul des insights.

Aucun contrat Media final n’est fixé ici.

---

# 33. Matrice finale demandée — par module

| Module | PRIMARY_RM | DETAIL_RMS | DRILLDOWNS | CLIENT_ALLOWED_TRANSFORMS | CLIENT_FORBIDDEN_TRANSFORMS | QUALITY_STATES |
|---|---|---|---|---|---|---|
| M1 | compact économie | evolution/structure/recurrences/contributors/method | month, category, recurrence, methodology | format, select point, expand | sum, Typical/Minimal delta, trend, stability, rank | certified support, gaps, unknown refs |
| M2 | compact categories/Needs | breakdown/evolution/contributors/frequency-ticket conditional | category, Need, merchant, purchase, month | display/filter UI only | shares, deltas, frequency-ticket, ranking | category/need/purchase coverage |
| M3 | compact chapters/current regime | timeline/transformation/evidence/method | month/day, Moment, LifeEvent, Activity, relation | expand/navigation | change-point, before-after, persistence, fusion | before/after support, gaps, live-tail |
| M4 | compact routines/cadence | activity/context/routine/evolution/seasonality | Activity, day, Place, Person | tabs/expand | routine, seasonality, cadence, causal costs | occurrence/day support, cycles |
| M5 | compact relationships | list/relation-detail/populations/method | relation-local, Activity, Place, Moment, History | select published relation | stats, FDR, effect, significance, causal inference | comparable support, not-material≠unknown |
| M6 | compact Moments | series/comparison/factors/method | Moment, LifeEvent, History, Activity, Place | navigation/display | peer group, causalCost, spentDuring, deltas | Moment-family support, causal authority |
| M7 | compact geo | evolution/places/routes/localized-finance/method | Place, History, mobility | layout/map interaction only | GPS→visit, rank, localized spend, distance/cost | location/localization/mobility coverage |
| M8 | compact consumption | merchant/purchase/substitution/product/price/method | Merchant, Purchase, Product, Operation proof, month | expand/display | Purchase resolution, cadence, lifecycle, price index | purchase/product/price coverage |
| M9 | compact profiles | differences/person-sections/personal-cost/method | Persona, Activity, Place, category, History | 1/2-column layout | pairwise calc, ranking, common support, fake symmetry | person attribution/common support |
| M10 | compact shared | shared activity/place/moment/evidence/finance/method | Activity, Moment, Place, Person, History | expand/navigation | co-presence inference, 50/50, shared rate/cost | PRESENT/ABSENT/UNKNOWN/CONFLICT, participant coverage |

---

# 34. Classification des primitives UX/Query existantes

| Primitive existante | Cible Global H | Pré-classement | Pourquoi |
|---|---|---|---|
| Query API normalization/auth/capabilities | toutes queries | `LIKELY_REUSE` | boundary générique forte |
| RuntimeSchema validation | tous RMs | `LIKELY_REUSE` | mécanisme générique |
| Materialized Query read | publication-first Global | `ADAPT` | doit devenir profil Global cohérent |
| `UiTransportState` / skeleton/error | modules | `LIKELY_REUSE` | transport UI, pas doctrine |
| `AnalysisGlobalModuleBoundary` | readiness modules | `ADAPT` | enum/modules legacy mais pattern utile |
| Exploration stack | entity drilldowns | `LIKELY_REUSE` | stack/focus/navigation déjà robuste |
| semantic anchors / scroll restoration | retour exact | `LIKELY_REUSE` | correspond au Master |
| MetricDisplay | knowledge/support/provenance | `ADAPT` | mécanisme bon, Global policies plus riches |
| legacy Global ReadModels | M1→M10 | `MUST_NOT_REUSE_AS_TARGET` | 7 actes, observationWindow, doctrine legacy |
| legacy Global route | `/analyse-globale` | `REMOVE/REPLACE` | sous History et mauvais contexte |
| legacy Global CSS | responsive final | `MUST_NOT_COPY_AS_TARGET` | mobile nav non-sticky notamment |
| legacy Global React module selection | server selected insights | `REVIEW_EACH_PATTERN` | ne pas importer de sélection métier client |
| `AnalysisTargetSubject` | Category/Activity drilldowns | `LIKELY_REUSE` | destinations typées déjà présentes |
| Exploration `operation` | preuve bancaire | `REUSE_FOR_OPERATION_ONLY` | ne pas confondre avec Purchase |
| Purchase destination | M8 | `GAP` | aucun nœud typé actuel |
| Relationship destination | M5 | `NO_GENERIC_ENTITY_REQUIRED_YET` | relation detail peut rester module-local |

Toutes les classifications physiques restent à confirmer à `GA0`.

---

# 35. Ce que GA0 devra revalider

Après HC6 :

1. Le contrat quality/support final issu de History est-il assez générique pour Global ?
2. HC2 a-t-il modifié les destinations/relations Activity/Moment/Place ?
3. HC3 a-t-il ajouté un manifest/lineage que les RMs Global doivent référencer ?
4. HC4/HC5 changent-ils l’identité de génération/cache utile à la page Global ?
5. Les primitives de navigation History sont-elles restées compatibles avec les deep-links proposés ?
6. Quels `analysis_global_*` legacy peuvent être supprimés ou cannibalisés pour primitives seulement ?
7. La vraie `GLOBAL_ANALYTICS_DEPENDENCY_MATRIX` impose-t-elle de regrouper ou séparer certains Detail RMs ?
8. Les 31 `AUTHORITY_GATED` rendent quelles sections HIDDEN / PLACEHOLDER / VISIBLE ?
9. Purchase Detail nécessite-t-il une extension Navigation Core ?
10. Product Detail nécessite-t-il une nouvelle entité UX ou seulement un détail M8 ?
11. Quel contrat de publication transporte `publicationId/asOf/certifiedThrough/liveThrough` ?
12. Quel budget payload/latency détermine le batch initial exact ?

---

# 36. Décisions qui NE SONT PAS nécessaires maintenant

Pas besoin de décider avant Global H :

- couleurs finales ;
- radius/ombres ;
- hauteur exacte des cartes ;
- animation précise ;
- position pixel-perfect du sticky nav ;
- chart library ;
- breakpoint exacts au-delà des obligations Master ;
- nombre exact de Query resources ;
- nom physique de chaque ReadModel ;
- drawer vs route pour chaque détail complexe tant que le contrat de retour est respecté ;
- Media final.

Ces choix relèvent du design/implémentation H, après moteurs et publication stables.

---

# 37. Hard stops futurs Phase H

Phase H devra s’arrêter si :

- React doit recalculer une vérité pour afficher le Master ;
- un Primary RM ne peut pas fournir l’insight/KPI déjà sélectionné ;
- la page mélange des publicationIds ;
- le compact doit embarquer tous les détails pour fonctionner ;
- un PurchaseEvent doit être déguisé en Operation ;
- un RelationshipInsight doit être déclaré causal par l’UI ;
- un module conditionnel doit inventer une donnée pour remplir une carte ;
- support insuffisant est converti en zéro ;
- coverage partielle est perdue ;
- HIDDEN reste dans la navigation ;
- le retour Entity Detail ne peut pas restaurer section+scroll ;
- mobile exige de supprimer une information analytique au lieu de la reflow/progressive-disclosure ;
- un chart n’a aucun équivalent accessible ;
- le frontend doit lire des données brutes pour reconstruire topN/trend/rank/materiality.

---

# 38. Handoff vers audit 06

L’audit 06 doit désormais vérifier que ce contrat ReadModel ne ferme pas la porte à :

- Media : refs optionnelles sans impact Analytics ;
- Contextual Summary : evidenceRefs/publication lineage et stale behavior ;
- Benefit Wallet : M8 PurchaseEvent indépendant du funding/provider ;
- Diagnostic : support/coverage/provenance/reasonCodes observables ;
- Import/Refresh : outputs et dependencies invalidables sans que React devienne orchestrateur.

---

# 39. Vérification de périmètre

Cet audit :

- ne crée aucun ReadModel ;
- ne crée aucune Query resource ;
- ne modifie aucun composant React ;
- ne modifie aucune route ;
- ne modifie aucun CSS ;
- ne modifie aucune table ;
- ne crée aucune migration ;
- ne touche pas Supabase ;
- ne décide pas les noms physiques finaux ;
- ne modifie pas History ;
- ne modifie pas le Master ;
- ne réintroduit pas la doctrine legacy Global.

Le seul changement repository est le présent rapport.

---

# 40. Verdict final

La cible H est suffisamment déterminée :

- une seule page cohérente ;
- dix modules stables ;
- Summary compact et profondeur lazy ;
- sélection d’insights/KPIs côté serveur ;
- publication-aware Query resources ;
- React limité à présentation/navigation ;
- knowledge/support/coverage séparés ;
- destinations History/Entity réutilisées sans duplication ;
- navigation/restauration existante largement réutilisable ;
- mobile/accessibilité déjà normés au niveau contrat ;
- gaps Purchase/Relationship clairement identifiés sans invention.

Les inconnues restantes sont des choix physiques de Phase H / GA0, pas des lacunes produit empêchant la préparation des prompts.

```text
GLOBAL H CONTRACT
READY_TO_DESIGN_LATER
```
