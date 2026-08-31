# History V2 — Calendar Semantic & Daily Economic Finance

## Gate d'entrée

Le lot a démarré après lecture des sources normatives suivantes :

- `Brief_Technique_Historique_Mensuel_V2_FINAL_CIBLE` — autorité fonctionnelle,
  technique et UX supérieure ;
- `Contrat_Moteurs_Calendar_DailyFinance_V2` — précision d'implémentation du
  présent lot ;
- `docs/history-v2/03-quality-visibility-publication-report.md`.

Le gate requis est confirmé dans le rapport 03 :

`QUALITY_VISIBILITY_PUBLICATION_GATE = PASS`

Le lot reste limité aux deux moteurs partagés, à leurs artifacts mensuels, à
leurs RuntimeSchemas et à leur adaptateur canonique read-only. Aucun ReadModel,
snapshot History V2, frontend ou changement du moteur Calendar V1 n'est inclus.

## Architecture retenue

Les moteurs V2 sont isolés du chemin certifié V1 :

- le moteur Calendar V2 transforme des sources canoniques normalisées en
  `CalendarSemanticItem`, projections jour et segments Ribbon ;
- le moteur Daily Finance V2 transforme les composantes qui contribuent à
  Actual en `EconomicAllocationEntry`, `DailyEconomicAmount` et événements
  économiques ;
- l'adaptateur serveur charge les facts canoniques sans écriture et produit les
  deux artifacts mensuels ;
- les résultats transportent les policy versions V2 et un `factsHash`
  déterministe ;
- `analytics_artifacts` est physiquement apte à stocker du JSON versionné, mais
  son store actuel valide exclusivement `ProducedMetric` et son identité TypeScript
  n'accepte que `metric|metric_bucket`. Le présent lot ne détourne donc pas ce
  store et ne publie rien. Son élargissement atomique appartient au futur lot de
  snapshots History V2.

Cette séparation évite une seconde source de vérité et empêche un artifact partagé
V2 d'être servi comme une métrique V1.

## Fichiers du lot

- `src/analytics/history-v2/calendar/types.ts`
- `src/analytics/history-v2/calendar/catalog.ts`
- `src/analytics/history-v2/calendar/engine.ts`
- `src/analytics/history-v2/calendar/schemas.ts`
- `src/analytics/history-v2/calendar/index.ts`
- `src/analytics/history-v2/daily-finance/types.ts`
- `src/analytics/history-v2/daily-finance/engine.ts`
- `src/analytics/history-v2/daily-finance/schemas.ts`
- `src/analytics/history-v2/daily-finance/index.ts`
- `src/analytics/history-v2/index.ts`
- `src/server/analytics/history-v2-monthly-engines.ts`
- `scripts/check-history-v2-calendar-daily-engines.mjs`
- `package.json`
- `docs/history-v2/04-calendar-daily-finance-report.md`

## Calendar Semantic Engine

### Contrat produit

`CalendarSemanticItem` porte l'identité, les références sources, le propriétaire
narratif, le titre et son autorité, `iconKey`, `renderMode`, `markerTier`, la
priorité, le comportement temporel, la continuité qualifiée, les participants,
le parent, le membership, `rawOccurrenceCount`, la visibilité mensuelle, la
provenance et la qualité.

Le pipeline implémenté est :

1. validation exhaustive des catalogues ;
2. normalisation Life Event/Activity et Moment ;
3. création des Contexts structurés et déduplication exacte ;
4. fusion exclusivement par `moment_life_events` Confirmé/Déduit ;
5. absorption `Composant`, sans absorption automatique de `Préparation` ;
6. absorption parent/enfant seulement si le parent est réellement représenté sur
   la date ; sinon promotion autonome de l'enfant ;
7. décision Marker/Ribbon fondée sur `spanBehavior` et l'autorité de continuité ;
8. agrégation visuelle déterministe, sans mutation du compte analytique brut ;
9. tri total des Markers, top 3 et `hiddenMarkerGroupCount` ;
10. segmentation hebdomadaire des Ribbons, lanes 1 à 4 et overflow distinct.

### Catalogue Life Event / Activity — 25/25

| # | type_key | mode | tier | band/weight | iconKey | visibilité | span |
|---:|---|---|---|---:|---|---|---|
| 1 | shopping_commerce | Marker | Secondary | 2/40 | shopping | si spécifique | POINT |
| 2 | courses_alimentaires | Marker | Secondary | 2/30 | groceries | si spécifique | POINT |
| 3 | demarche_admin | Marker | Standard | 3/55 | administrative | oui | POINT |
| 4 | retrait_banque | DetailOnly | — | 1/25 | bank_cash | non | POINT |
| 5 | celebration | Marker | Dominant | 5/90 | celebration | oui | EXPLICIT_CONTINUITY |
| 6 | journee_maison | Context | — | 1/35 | home | context band | DAILY_CONTEXT |
| 7 | spectacle_culture | Marker | Dominant | 4/90 | culture | oui | EXPLICIT_CONTINUITY |
| 8 | sortie_soiree | Marker | Dominant | 4/80 | nightlife | oui | POINT |
| 9 | activite_loisir | Marker | Standard | 3/75 | leisure | oui | EXPLICIT_CONTINUITY |
| 10 | examen_permis | Marker | Dominant | 5/80 | permit_exam | oui | POINT |
| 11 | lecon_conduite | Marker | Standard | 3/65 | driving_lesson | oui | POINT |
| 12 | livraison_repas | Marker | Secondary | 2/45 | food_delivery | si spécifique | POINT |
| 13 | repas_restaurant | Marker | Secondary | 2/45 | restaurant | si spécifique | POINT |
| 14 | rdv_medical | Marker | Standard | 3/60 | medical | oui | POINT |
| 15 | pharmacie | Marker | Secondary | 2/35 | pharmacy | oui | POINT |
| 16 | visite_famille | Marker | Standard | 4/65 | family | oui | AUTO_CONTINUOUS |
| 17 | visite_ami | Marker | Standard | 4/60 | friends | oui | AUTO_CONTINUOUS |
| 18 | soin_personnel | Marker | Standard | 2/50 | personal_care | oui | POINT |
| 19 | voyage_sejour | Marker/Ribbon | Dominant | 5/95 | travel | oui | AUTO_CONTINUOUS |
| 20 | entretien_voiture | Marker | Standard | 3/55 | vehicle_service | oui | POINT |
| 21 | carburant | DetailOnly | — | 1/25 | fuel | non | POINT |
| 22 | deplacement_pro | Marker/Ribbon | Standard | 4/75 | business_trip | oui | EXPLICIT_CONTINUITY |
| 23 | travail_site | Context | — | 1/70 | work_site | context band | DAILY_CONTEXT |
| 24 | teletravail | Context | — | 1/70 | remote_work | context band | DAILY_CONTEXT |
| 25 | funeraire | Marker/Ribbon | Dominant | 5/100 | funeral | oui | EXPLICIT_CONTINUITY |

Une clé absente de ce catalogue provoque une erreur contractuelle. Il n'existe
aucun fallback silencieux vers un type générique.

### Catalogue Moment — 20/20

| # | type canonique live | clé normalisée | mode | band/weight | iconKey | span |
|---:|---|---|---|---:|---|---|
| 1 | Anniversaire | anniversaire | Marker | 5/90 | birthday | EXPLICIT_CONTINUITY |
| 2 | Boîte de nuit | boite-de-nuit | Marker | 4/85 | nightlife | POINT |
| 3 | Concert / spectacle | concert-spectacle | Marker | 4/90 | culture | POINT |
| 4 | Déplacement professionnel | deplacement-professionnel | Marker/Ribbon | 4/80 | business_trip | EXPLICIT_CONTINUITY |
| 5 | Entretien / contrôle véhicule | entretien-controle-vehicule | DetailOnly | 3/60 | vehicle_service | PROJECT_PERIOD |
| 6 | Événement familial / déplacement | evenement-familial-deplacement | Marker/Ribbon | 4/90 | family_event | EXPLICIT_CONTINUITY |
| 7 | Fête / célébration | fete-celebration | Marker/Ribbon | 5/90 | celebration | EXPLICIT_CONTINUITY |
| 8 | Projet / achat maison | projet-achat-maison | DetailOnly | 3/60 | home_project | PROJECT_PERIOD |
| 9 | Projet / séance photo | projet-seance-photo | DetailOnly | 3/60 | photo_project | PROJECT_PERIOD |
| 10 | Projet personnel | projet-personnel | DetailOnly | 3/55 | personal_project | PROJECT_PERIOD |
| 11 | Réparation / imprévu | reparation-imprevu | DetailOnly | 3/70 | incident_repair | INCIDENT_PERIOD |
| 12 | Soirée | soiree | Marker | 4/80 | nightlife | POINT |
| 13 | Soirée techno | soiree-techno | Marker | 4/85 | techno_night | POINT |
| 14 | Sortie / activité | sortie-activite | Marker/Ribbon | 4/75 | leisure | EXPLICIT_CONTINUITY |
| 15 | Sortie / événement | sortie-evenement | Marker/Ribbon | 4/80 | event_outing | EXPLICIT_CONTINUITY |
| 16 | Sortie / excursion | sortie-excursion | Marker/Ribbon | 4/80 | excursion | EXPLICIT_CONTINUITY |
| 17 | Sortie / plage | sortie-plage | Marker | 3/70 | beach | POINT |
| 18 | Visite familiale | visite-familiale | Marker/Ribbon | 4/70 | family | AUTO_CONTINUOUS |
| 19 | Voyage | voyage | Marker/Ribbon | 5/95 | travel | AUTO_CONTINUOUS |
| 20 | Week-end / escapade | week-end-escapade | Marker/Ribbon | 5/92 | weekend_trip | AUTO_CONTINUOUS |

Les libellés français observés dans le schéma live sont des clés explicites du
catalogue. Les clés normalisées sont également acceptées, sans fallback générique.

### Ordre, top 3 et overflow

L'ordre Marker suit exactement : band décroissante, Moment fusionné avant Life
Event autonome, weight décroissant, Confirmé avant Déduit, qualité du titre,
heure connue avant inconnue, heure croissante, puis identité stable.

`hiddenMarkerGroupCount` compte les groupes Marker restant après le top 3. Il
n'inclut ni sources absorbées, ni Contexts, ni Ribbons, ni DetailOnly. Les Ribbons
ont leur propre `ribbonOverflow`, qui compte des items Ribbon distincts sans lane.

## Daily Economic Finance

### Unité économique et ordre d'autorité

L'unité est la composante économique contribuant à Actual. Elle apparaît une fois
dans `allocationEntries`, soit avec une date effective, soit dans
`unassignedEconomicAmount`.

L'ordre appliqué est :

1. Purchase Event canonique à précision DAY ;
2. assertion explicite de consommation convergente ;
3. date documentée d'un Cash Use ;
4. source achat fiable attestée par le schéma ;
5. mois économique sans jour : unassigned ;
6. absence de preuve : unassigned.

Une autorité de rang supérieur en conflit interdit tout fallback de rang inférieur.
Deux assertions de même rang et de jours différents donnent
`DATA_CONFLICTING_AUTHORITIES`. `bank_date_fallback` reste intact dans le moteur
V1, mais l'adaptateur l'étiquette et le moteur History V2 le refuse comme autorité
quotidienne.

### Purchase Event, Cash Uses, remboursements et composantes

- plusieurs operations/allocations/items/payment components d'un même Purchase
  Event partagent la date de l'événement et ne forment qu'un
  `EconomicExpenseEvent` ;
- un Cash Use documenté est une consommation, tandis que le retrait bancaire ne
  devient jamais une deuxième dépense ;
- une correction/remboursement lié hérite du jour économique de la source ;
- un remboursement non lié n'est pas placé au jour de réception bancaire ;
- une appartenance de composante à plusieurs Purchase Events est un conflit ;
- aucune clé marchand+date+montant, proximité ou autre heuristique n'est utilisée.

### KNOWN / PARTIAL / UNKNOWN / CONFLICT

- tous les composants mensuels datés : jours connus, y compris `KNOWN(0)` ;
- montant daté présent et composantes non datées possibles : `PARTIAL` avec
  `OBSERVED_ONLY` ;
- aucun montant daté et composantes non datées possibles : `UNKNOWN` ;
- conflit d'autorités empêchant l'affectation : `CONFLICT` sur les jours sans
  montant observé, ou `PARTIAL` observé avec reasonCode de conflit ;
- aucune hypothèse de monotonie n'est faite : `LOWER_BOUND` n'est pas fabriqué.

### Couverture et réconciliation

La couverture timing utilise les valeurs absolues :

`sum(abs(composantes datées)) / sum(abs(toutes composantes Actual))`

avec `unit=amount_abs` et `basis=absolute_economic_component_amount`. Elle ne se
substitue pas au Support.

Le moteur calcule avec les `Money` canoniques non arrondis :

`Actual - assignedEconomicAmount - unassignedEconomicAmount = 0`

Un résiduel non nul fait échouer le moteur ; il n'est jamais masqué dans
`unassignedEconomicAmount`. L'assertion supplémentaire vérifie :

`SUM(days) + unassignedEconomicAmount = Actual`

## Artifacts partagés

### Calendar Semantic mensuel

`CalendarSemanticMonthArtifact` contient : household, mois, collection qualifiée
d'items, projection des jours, semaines Ribbon, problèmes sémantiques, scope
d'intersection mensuelle, policies et `factsHash`.

Policies :

- `canonical_continuity=v1`
- `calendar_semantics=v1`
- `quality_visibility=v1`
- `facts_hash=v1`

### Daily Economic Ledger mensuel

`DailyEconomicLedgerMonthArtifact` contient : household, mois, devise, Actual,
jours, allocations, événements économiques, montant non affecté, montant affecté,
résiduel, couverture timing, issues, policies et `factsHash`.

Policies :

- `canonical_purchase_event_timing=v1`
- `daily_economic_allocation=v1`
- `quality_visibility=v1`
- `facts_hash=v1`

Les deux payloads sont validables par RuntimeSchema et prêts à recevoir une
identité de publication V2 dans le lot Snapshot. Aucun snapshot live n'a été écrit.

## Exécutions read-only et observations live

Les moteurs purs ont été exécutés sans écriture sur trois mois représentatifs :

- 2026-04 ;
- 2026-05 ;
- 2026-07.

Les fixtures couvrent mois sans autorité quotidienne, mois entièrement daté,
mixte daté/non daté, remboursement, Cash Use et conflits. Chaque exécution est
réconciliée à zéro.

Des contrôles SQL live exclusivement read-only et agrégés ont aussi été effectués
sur le projet déjà certifié `ipuuhxrblxormwgoaqnz`, pour avril à juillet 2026 :

- les 25 types Life Event existent dans le référentiel ; 20 sont effectivement
  observés sur cette fenêtre ;
- 11 des 20 types Moment sont observés sur cette fenêtre ; tous correspondent à
  une entrée explicite du catalogue ;
- `moment_life_events` contient des relations Composant, Événement principal et
  Préparation en Confirmé/Déduit ;
- les nouvelles tables Purchase Event ne contiennent encore aucun événement ni
  assertion datée ;
- les 1 484 lignes du timing canonique live portent actuellement un mois nul et
  aucune autorité quotidienne issue de ce family ;
- aucun Cash Use daté n'a été observé sur avril-juillet.

Conséquence attendue, et non contournée : tant que ces autorités ne sont pas
alimentées, le Daily Ledger V2 affecte ces composantes à
`unassignedEconomicAmount`; il ne les force pas au jour bancaire. Aucun backfill,
aucune écriture et aucune publication n'ont été réalisés.

## Tests

### Tests ciblés du lot

`npm run check:history-v2-calendar-daily`

Résultat : **PASS — 29/29 checks**.

Cas couverts :

- catalogues exacts 25 + 20 et rejet des inconnus ;
- fusion principale, absorption Composant, maintien Préparation ;
- parent présent absorbant, enfant sans parent promu ;
- visibilité “si spécifique” sans score ou heuristique ;
- agrégation visuelle avec membership stable et rawOccurrenceCount conservé ;
- top 3, `+N` par groupe ;
- Ribbon 4 lanes et overflow distinct ;
- continuité absente ⇒ non-Ribbon ; continuité explicite ⇒ Ribbon ;
- fusion transportant la continuité sans faux warning ;
- RuntimeSchemas KNOWN/PARTIAL ;
- Purchase Event multi-composantes ;
- Cash Use ;
- refus du `bank_date_fallback` ;
- autorité directe convergente et conflit de même rang ;
- remboursement lié et remboursement non lié ;
- double membership Purchase Event ;
- KNOWN/PARTIAL/UNKNOWN/CONFLICT ;
- réconciliation et rejet d'un Actual incohérent ;
- avril, mai et juillet read-only.

### Non-régression et build

| Commande | Résultat |
|---|---|
| `npm run check:history-v2-canonical` | PASS |
| `npm run check:history-v2-transversal` | PASS — 42 checks |
| `npm run check:architecture` | PASS — 453 fichiers |
| `npm run check:calendar-day` | PASS |
| `npm run check:analysis-month-contracts` | PASS |
| `npm run check:analysis-global-contracts` | PASS |
| `npm run check:analytics-materialization` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — Next 16.2.6, production |
| `git diff --check` | PASS |

Le warning Node `MODULE_TYPELESS_PACKAGE_JSON` est informatif et préexiste sur les
scripts TypeScript strip-types ; aucune conversion globale du package en ESM n'a
été introduite.

## Conformité au Brief FINAL CIBLE

| Exigence pertinente | Preuve | Statut |
|---|---|---|
| Catalogue Life Event/Activity exhaustif | `LIFE_EVENT_ACTIVITY_CATALOG`, assertion 25 | PASS |
| Catalogue Moment exhaustif | `MOMENT_CATALOG`, assertion 20 | PASS |
| Aucun fallback générique silencieux | `requireLifeEventCatalogEntry`, `requireMomentCatalogEntry` | PASS |
| Fusion uniquement canonique | relations persistées Confirmé/Déduit | PASS |
| Absorption/promotion enfant | `fuseAndAbsorb`, `absorbChildren` + tests | PASS |
| Agrégation sans mutation analytique | membership + somme rawOccurrenceCount | PASS |
| Ordre Marker/top 3/+N | comparateur total + projection par jour | PASS |
| Ribbons/lanes/overflow | segmentation semaine, lanes 1–4 | PASS |
| Continuité explicite sûre | absence/conflict ⇒ non-Ribbon + reasonCode | PASS |
| Date économique source-aware | Purchase Event puis autorités canoniques | PASS |
| Refus de Bank Date en V2 quotidien | evidence `BANK_DATE_FALLBACK` non admissible | PASS |
| V1 préservé | `resolveHistoricalEconomicTiming` inchangé | PASS |
| Purchase Event/Cash/refund | allocations et expense events + tests | PASS |
| PARTIAL/UNKNOWN/CONFLICT | MetricValue V2 + tests | PASS |
| Réconciliation exacte | résiduel bloquant + somme jours/unassigned | PASS |
| Artifacts mensuels partagés | Calendar artifact + Daily Ledger artifact | PASS |
| Aucun snapshot V2 live | aucune écriture/store appelée | PASS |

## Écarts et risques restants

1. Les tables Purchase Event sont volontairement vides après la migration
   canonique. Le moteur gère cette absence, mais une couverture quotidienne élevée
   nécessitera des assertions canoniques futures, sans heuristique.
2. Le timing canonique live ne fournit pas encore de mois/jour exploitable pour
   les lignes observées. Le résultat strict est un montant non affecté, pas une
   date bancaire inventée.
3. Le store `analytics_artifacts` doit être élargi avec une famille et un parser
   dédiés avant toute persistance ; réutiliser son API métrique actuelle serait un
   conflit de contrat.
4. Le fact `PersonDayFact` courant expose l'observabilité de localisation mais pas
   une taxonomie de contexte quotidien. Les Contexts actuellement disponibles
   sont donc produits par les Life Events structurés (`travail_site`,
   `teletravail`, `journee_maison`) ou par l'entrée contextuelle explicite du
   moteur. Aucun contexte maladie/congé n'est déduit d'un texte libre.

## Nouvelles découvertes

1. Les 20 libellés Moment du live sont exactement représentables par le catalogue
   normatif ; aucune normalisation approximative n'est nécessaire.
2. Les relations de fusion nécessaires existent déjà en Confirmé/Déduit et
   distinguent correctement principal, composant et préparation.
3. La population mensuelle V1 et l'autorité quotidienne V2 doivent être deux
   décisions séparées : le fallback bancaire peut encore sélectionner une
   composante dans le mois V1 sans devenir une date économique quotidienne V2.
4. Les sources live actuelles rendent `unassignedEconomicAmount` indispensable :
   le supprimer ou forcer des jours ferait perdre l'information de qualité.

## Gate final

CALENDAR_DAILY_ENGINE_GATE = PASS
