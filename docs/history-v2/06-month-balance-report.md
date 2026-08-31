# History V2 — Lot 06 — Calculs Bilan Mois M1–M4

## Gate d'entrée

Le lot a démarré après lecture de l'autorité normative
`Brief_Technique_Historique_Mensuel_V2_FINAL_CIBLE`, du contrat
`Contrats_Calculs_Bilan_Mois_M1_M4_V2` et du rapport corrigé du lot 05.

Preuve d'entrée :

```text
docs/history-v2/05-history-readmodels-report.md
HISTORY_READMODELS_GATE = PASS
```

La séparation corrigée `causalCost` / `spentDuring` du lot 05 est conservée.
Le présent lot ne modifie ni le Journal, ni `computeSpentDuring`, ni les moteurs
Calendar/Daily, ni les moteurs Analysis V1.

## Architecture retenue

Le Bilan V2 est une couche de projection et de sélection au-dessus des moteurs
certifiés existants :

- `Actual`, `Typical`, `Minimal`, `category_amount`, `merchant_net_amount`,
  `fixed_variable_amount`, `life_scope_amount`, `activity_frequency`,
  `activity_causal_cost`, `localized_spend`, `place_visit_count` et
  `distinct_visit_days` restent produits par `src/analytics/production/` et
  `src/server/query/sources/analysis.ts` ;
- `projectAnalysisMoneyMetric()` est l'unique adaptateur
  `ScopedMoneyMetricReadModel → MetricNode<Money>` ; il projette la valeur du
  moteur Analysis sans la recalculer ;
- `src/analytics/history-v2/month-balance/` contient uniquement les nouveautés
  M1–M4 : seuils, bridge, compositions, explications, classifications de
  présentation et scores ;
- `src/query-api/history-v2/month-balance-*` porte les ReadModels, builders et
  RuntimeSchemas ;
- les onze ressources sont enregistrées comme History V2, `contractVersion=v2`,
  avec `resourceInputHash` interne et versions de policies propres ; leur futur
  `PublicationMeta.factsHash` provient de la fermeture mensuelle commune ;
- les sources serveur restent volontairement `TEMPORARY_UNAVAILABLE` tant que le
  lot snapshots n'a pas alloué de vraie publication `FROZEN_MONTH`. Aucun ID de
  publication factice n'est créé.

Cette séparation évite une seconde source de vérité : le Bilan ne possède aucun
moteur alternatif pour les métriques Analysis existantes.

## Fichiers créés

- `src/analytics/history-v2/month-balance/types.ts`
- `src/analytics/history-v2/month-balance/engine.ts`
- `src/analytics/history-v2/month-balance/index.ts`
- `src/query-api/history-v2/month-balance-types.ts`
- `src/query-api/history-v2/month-balance-builders.ts`
- `src/query-api/history-v2/month-balance-schemas.ts`
- `scripts/check-history-v2-month-balance.mjs`
- `docs/history-v2/06-month-balance-report.md`

## Fichiers adaptés

- `src/analytics/history-v2/index.ts`
- `src/query-api/history-v2/index.ts`
- `src/query-api/request/read-model-params.ts`
- `src/query-api/request/index.ts`
- `src/query-api/request/resource-registry.ts`
- `src/query-api/request/resource-contract.ts`
- `src/query-api/read-model-registry.ts`
- `src/query-api/capabilities/registry.ts`
- `src/query-api/server/types.ts`
- `src/query-api/server/adapter-registry.ts`
- `src/query-api/server/validation.ts`
- `src/query-api/server/invalidation.ts`
- `src/server/query/sources/history-v2.ts`
- `src/server/query/runtime.ts`
- `scripts/check-history-v2-readmodels.mjs`
- `scripts/check-history-v2-transversal-contracts.mjs`
- `package.json`

## Ressources Query V2

Les quatre ressources Calendar V2 existantes sont conservées :

1. `history_month_calendar`
2. `history_week`
3. `history_day_journal`
4. `history_month_overview`

Les onze ressources Bilan sont ajoutées :

5. `history_month_balance_summary`
6. `history_bank_economy_bridge`
7. `history_month_categories`
8. `history_category_detail {categoryId}`
9. `history_month_spending_nature`
10. `history_spending_segment_detail {axis,bucket}` ou
    `{necessity,behavior}`
11. `history_minimal_preview`
12. `history_month_life_money`
13. `history_activity_detail {activityTypeKey}`
14. `history_moment_detail {momentId}`
15. `history_place_detail {placeId}`

Le Resource Registry, le Resource Contract Registry, le Capability Registry,
l'Adapter Registry et l'Output Schema Registry sont exhaustifs. Les paramètres
de détail refusent les clés inconnues, les identifiants vides et les formes
ambiguës. `history_spending_segment_detail` exige exactement un axe simple ou
une cellule `Necessity × Behavior`.

## M1 — Synthèse du mois

### Calculs

- `compareMonthReference()` calcule `Actual − Typical` ou `Actual − Minimal`.
- Le pourcentage utilise `abs(reference)` ; si la référence vaut zéro, il est
  absent. Une rupture de base non nulle satisfait le côté relatif de la
  matérialité, mais n'invente jamais un pourcentage.
- `evaluateMateriality()` applique conjointement `50 EUR` et `10 %`.
- `computeUsualZone()` applique `max(50 EUR, 10 % Typical)`.
- support Typical `<6` : `NOT_APPLICABLE` / support insuffisant ; `6–8` :
  `limited` ; `>=9` : `sufficient`.
- `computeHistoricalRank()` utilise le rang de compétition au centime :
  `1 + count(actual comparable > actual courant)` ; univers incluant le mois
  courant ; présentation neutre sous quatre mois.
- `buildBankEconomyBridge()` calcule le gap, les lignes signées, l'Actual
  reconstruit et le residual. La visibilité applique
  `max(25 EUR, 1 % × max(abs(BankOutflows), abs(Actual)))`.
- le bridge est `KNOWN` seulement si les lignes sont closes et le residual est
  dans `±0,01 EUR`; sinon `PARTIAL/OBSERVED_ONLY`, ou `CONFLICT` si deux
  autorités s'opposent.
- les `lineId` sont uniques, empêchant le double comptage cash/remboursement/
  retrait.
- `resolveImportedSummaryFreshness()` distingue strictement `MISSING`,
  `CURRENT`, `STALE` à partir de publication, révision, contrat, factsHash et
  signature de policies.

### Exemple de projection

```json
{
  "actualValue": { "visibility": "VISIBLE", "data": { "status": "KNOWN", "value": "1200" } },
  "actualVsTypical": {
    "visibility": "VISIBLE",
    "data": {
      "status": "KNOWN",
      "value": { "actual": "1200", "reference": "1000", "delta": "200", "relativeDelta": 0.2 }
    }
  },
  "importedSummary": { "freshness": "MISSING" }
}
```

## M2 — Catégories et explications

### TypicalCompositionBaseline

- utilise exactement les `pivotMonthIds` du Typical ;
- un pivot impair reprend le vecteur central ; deux pivots pairs moyennent les
  deux vecteurs ;
- une sous-catégorie absente d'un pivot complet vaut zéro ; absente d'un pivot
  partiel, elle reste `UNKNOWN` ;
- une composition complète doit se réconcilier à `0,01 EUR` avec le Typical de
  la catégorie, sinon le builder refuse le résultat.

### Drivers et compensateur

- contribution = `Actual sous-catégorie − baseline` ;
- driver : même signe et `>= max(15 EUR, 15 % abs(delta catégorie))`, top 3 ;
- compensateur : signe opposé et
  `>= max(15 EUR, 20 % abs(delta catégorie))`, top 1 ;
- le residual explicite ferme l'additivité ;
- le bloc Why est visible seulement si la catégorie est matérielle et possède
  au moins un driver robuste.

### Sélection et identité

- `selectCategoryPreview()` réserve avant le tri par montant toutes les
  catégories matérielles, nouvelles ou réapparues ; limite huit ; `Other` est
  calculé après extraction ; non-classifié reste séparé ;
- `classifyStableIdentityLifecycle()` exige un identifiant stable, trois mois
  immédiatement antérieurs complets et connus, le seuil
  `25 EUR AND (10 % catégorie OR 50 EUR)` ; une série annuelle attendue n'est
  jamais marquée Réapparue ;
- `explainFrequencyTicket()` exige six mois de référence, couverture courante
  `>=80 %`, support ticket `<5/5–7/>=8` et applique les seuils exacts fréquence
  (`1` et `25 %`) et ticket (`5 EUR` et `15 %`) ; dominance `1,5×` ;
- `selectMerchantPurchaseDrivers()` exige couverture merchant `>=90 %`, sens
  cohérent et contribution matérielle ; les Purchase Events exigent l'identité
  canonique et `max(25 EUR, 25 % contribution)` ;
- les Purchase Events déjà représentés par un Moment causal ou par un badge
  New/Reappeared sont exclus ; merchant + purchase restent limités à trois ;
  aucun regroupement merchant/date/montant n'existe.

## M3 — Nature de dépenses et MinimalPreview

`buildSpendingAxes()` consomme la population économique de l'Actual et traite
indépendamment :

- `Necessity`: `INDISPENSABLE`, `CONSTRAINED`, `OPTIONAL` ;
- `Behavior`: `FIXED`, `VARIABLE` ;
- `LifeScope`: `CURRENT_LIFE`, `OUT_OF_DAILY` ;
- matrice `Necessity × Behavior` sur les seules composantes doublement
  qualifiées.

Les parts utilisent toujours l'Actual total. La couverture utilise les montants
absolus classifiés sur les montants absolus de l'Actual. Une classification
incomplète produit `PARTIAL/OBSERVED_ONLY`; aucune somme inconnue n'est
redistribuée. Un gap est matériel seulement s'il est strictement supérieur à
`max(25 EUR, 2 % Actual)`.

- marge immédiate : uniquement `OPTIONAL × VARIABLE` ;
- marge moyen terme : uniquement `OPTIONAL × FIXED` ;
- les marges ne sont jamais additionnées ;
- une marge partielle est `LOWER_BOUND` seulement si toutes les composantes
  sources prouvent la monotonie/non-négativité, sinon `OBSERVED_ONLY`.

`buildMinimalPreview()` ne recalcule pas Minimal. Il projette exclusivement les
composantes du moteur Minimal dans quatre familles additives :

1. `OBLIGATIONS`
2. `VARIABLES_INDISPENSABLES`
3. `PROVISIONS`
4. `BESOINS_CONDITIONNELS`

Deux exemples maximum sont conservés par famille. La somme doit être égale au
Minimal à `0,01 EUR`, sinon le contrat échoue.

## M4 — Vie et argent

### Activities

- `computeActivityInterestScore()` implémente les cinq sous-scores exacts
  fréquence `35`, narration `25`, sémantique `20`, finance `15`, intensité `5` ;
- un `priorityBand=5` non mappé est une erreur de contrat ;
- un coût `PARTIAL/OBSERVED_ONLY` ne donne aucun point financier ; un
  `LOWER_BOUND` ne compte que s'il franchit sûrement le seuil transmis ;
- `rankActivities()` applique tous les tie-breakers dans l'ordre normatif ;
- `resolveActivityCost()` donne priorité à `CAUSAL`, puis `ASSOCIATED`, déduplique
  par `expenseEventId` et ne calcule jamais un `spentDuring` d'activité ;
- Activity Detail exige les occurrences en ordre effectif et sépare dépenses
  causales et associées sans répétition.

### Moments

- `rankMoments()` conserve d'abord l'ordre exact des highlights puis applique
  band, weight, continu/ponctuel, jours vécus, coût comparable tardif, date et ID ;
- la carte porte le coût causal, jamais `spentDuring` ;
- Moment Detail conserve `causalCost` et `spentDuring` comme métriques
  orthogonales et leurs listes de dépenses séparées ;
- `selectMomentMedia()` applique cover, favorite/principal, puis première image
  directe de la période ; sans image directe, seul le fallback graphique est
  autorisé. Aucune image externe n'est inventée.

### Places

- `selectDisplayPlaceCandidate()` choisit d'abord l'autorité narrative directe,
  puis le niveau canonique le plus spécifique ; les preuves GPS ne font pas
  partie du type accepté ;
- `computePlaceSignificanceScore()` implémente narration, présence, activités,
  finance qualifiée, bonus sémantique et pénalités routine ;
- la finance ne score que si `localizedCoverage>=80 %` ; candidat `score>=20`,
  top 6, tie-breakers normatifs ;
- `resolveLocalizedAmountVisibility()` : `>=80 %` valeur carte/detail connue ;
  `60–79,99 %` carte masquée et détail partiel ; `<60 %` aucun total ;
  dénominateur nul = `NOT_APPLICABLE` ;
- le détail accepte des jours uniquement en ordre croissant et n'expose pas le
  score comme métrique métier.

## Quality, Visibility et PublicationMeta

Chaque ReadModel Bilan contient :

- `resourceInputHash`, digest technique interne non publié comme factsHash ;
- `policyVersions` résolues depuis son Resource Contract ;
- `publicationMeta` optionnelle avant snapshot ;
- `QualityEnvelope` aux métriques et collections ;
- `DisplayNode` pour la visibilité indépendante de la calculabilité.

Les policies V1 utilisées sont :

- `month_balance_summary@v1` ;
- `category_explanation@v1` ;
- `spending_nature@v1` ;
- `life_money_selection@v1` ;
- et, selon la ressource, les policies Canonical, Calendar, Daily,
  `quality_visibility@v1` et `facts_hash@v1` héritées.

`analyticsMethodSignature(resource)` inclut automatiquement les versions des
métriques actives et l'union déterministe des policies de la ressource. Un
snapshot V1 ne peut donc pas satisfaire l'identité d'une ressource Bilan V2.

## RuntimeSchemas

Les onze RuntimeSchemas :

- refusent les clés top-level inconnues ;
- refusent toute propriété présente avec `undefined` dans le graphe de données ;
- refusent les nombres non finis et valeurs non sérialisables ;
- vérifient Household, mois, sourceRefs uniques, capabilities exactes,
  resourceInputHash, policyVersions et cohérence des policies PublicationMeta ;
- sont enregistrés dans `QueryDataByResource` et
  `queryDataSchemaByResource` sans orphelin.

La validation serveur vérifie aussi le mois demandé et l'identité de détail
(`categoryId`, `activityTypeKey`, `momentId`, `placeId`, segment).

## Tests et preuves

### Lot M1–M4

```text
History V2 Month Balance: 61/61 PASS
```

Cas couverts : seuils absolus/relatifs, référence zéro, support Typical, rang au
centime, bridge/résidual/double comptage, freshness importée, pivots Typical,
réconciliation composition, drivers/compensateur, New/Reappeared, fréquence ×
ticket, aperçu top/Other/non-classifié, merchant/purchase, axes/matrice/marges,
MinimalPreview, scores/tie-breakers Activity/Moment/Place, coûts Activity,
sélection média, hiérarchie Place, localizedCoverage, parsers stricts, projection
du moteur Analysis et parité des 15 ressources.

### Non-régressions

```text
History V2 ReadModels: 21/21 PASS
History V2 Calendar + Daily Finance: 29/29 PASS
History V2 transversal contracts: 48 checks PASS
History V2 canonical contracts: PASS
ANALYSIS_MONTH_CONTRACT_INVARIANTS=PASS
Analytics materialization checks: PASS
Product completeness check: PASS
Architecture import check: PASS (464 fichiers)
TypeScript: PASS
Next production build: PASS
```

## Réconciliations

- bridge : `bankOutflows + Σ(adjustments) + residual = Actual` ;
- TypicalComposition : `Σ(sous-catégories baseline) = Typical catégorie` si
  complet ;
- CategoryExplanation : `Σ(drivers + compensator) + residual = delta catégorie`
  sur la projection affichée ;
- Spending axes : classifié + non-classifié conserve la population Actual ;
- MinimalPreview : `Σ(4 familles) = Minimal` ;
- aucune marge immédiate/moyen terme n'est additionnée ;
- aucune agrégation de présentation ne modifie les grains Fact existants.

## Matrice de conformité Brief M1–M4

| Exigence Brief M1–M4 | Calcul / ReadModel | Preuve | Statut |
|---|---|---|---|
| Actual/Typical/Minimal sans duplication | `projectAnalysisMoneyMetric`, Summary | projection d'un `ScopedMoneyMetricReadModel`, test 61/61 | PASS |
| Delta et pourcentage base zéro | `compareMonthReference` | tests référence normale/zéro | PASS |
| Matérialité 50 EUR + 10 % | `evaluateMateriality` | test delta 200/1000 | PASS |
| Zone habituelle/support | `computeUsualZone` | tests n=5, n=8 | PASS |
| Rang historique au centime | `computeHistoricalRank` | test rang compétition | PASS |
| Bridge/gap/residual | `buildBankEconomyBridge`, ressource bridge | tests clôture et lineId dupliqué | PASS |
| Summary importé MISSING/CURRENT/STALE | `resolveImportedSummaryFreshness` | tests fermeture complète | PASS |
| TypicalComposition pivots exacts | `computeTypicalCompositionBaseline` | test deux pivots + rejet non réconcilié | PASS |
| Drivers/compensateur/résidual | `explainCategory` | test signes et seuils | PASS |
| Top 8 / Other / non-classifié | `selectCategoryPreview` | test réservation New | PASS |
| New/Réapparu identité stable | `classifyStableIdentityLifecycle` | cas NEW et REAPPEARED | PASS |
| Fréquence × ticket | `explainFrequencyTicket` | dominance et support insuffisant | PASS |
| Merchant/Purchase sans heuristique | `selectMerchantPurchaseDrivers` | exclusion purchase causal | PASS |
| Axes indépendants / parts sur Actual | `buildSpendingAxes` | axes complets/partiels | PASS |
| Matrice et gaps | `buildSpendingAxes` | gap strict + cellule | PASS |
| Marges immédiate/moyen terme | `buildSpendingAxes` | LOWER_BOUND/OBSERVED_ONLY | PASS |
| MinimalPreview quatre familles | `buildMinimalPreview` | quatre familles + rejet non additif | PASS |
| ActivityInterestScore / tie-breakers | `computeActivityInterestScore`, `rankActivities` | score exact + band invalide | PASS |
| Coût causal puis associé | `resolveActivityCost`, Activity Detail | déduplication expenseEventId | PASS |
| Moment rank | `rankMoments` | highlight #1 avant #2 | PASS |
| causalCost/spentDuring orthogonaux | Moment Detail + lot 05 inchangé | types/listes distincts, tests lot 05 | PASS |
| Média/fallback Moment | `selectMomentMedia` | cover et fallback graphique | PASS |
| Place candidate et hiérarchie | `selectDisplayPlaceCandidate` | test lieu direct le plus précis | PASS |
| PlaceSignificanceScore | `computePlaceSignificanceScore`, `rankPlaces` | seuil candidat/top 6/finance | PASS |
| localizedCoverage | `resolveLocalizedAmountVisibility` | seuils 60/80 et partial meaning | PASS |
| ReadModels/resources/schemas | 11 ressources Bilan | parité registry + schemas, 15 V2 | PASS |
| hash interne/factsHash/policies/contractVersion | Resource Contract + schemas | transversal 48 checks, signature déterministe | PASS |
| Publication live | hors périmètre explicitement demandé | aucune écriture/snapshot | DEFERRED |
| Frontend | hors périmètre explicitement demandé | aucun composant modifié | DEFERRED |

## KNOWN / PARTIAL / UNKNOWN

- `KNOWN` : valeur et population fermées par le contrat ;
- `PARTIAL/LOWER_BOUND` : uniquement lorsque monotonie/non-négativité permet une
  borne sûre ;
- `PARTIAL/OBSERVED_ONLY` : subset utile sans extrapolation ;
- `UNKNOWN` : référence, couverture, identité ou autorité insuffisante ;
- `NOT_APPLICABLE` : politique inapplicable (support insuffisant, zéro
  dénominateur localisable, etc.) ;
- `CONFLICT` : autorités contradictoires, jamais résolues arbitrairement.

## Non-régression Analysis V1

`src/server/query/sources/analysis.ts`, les producers, le registry métrique et
les moteurs Typical/Minimal n'ont pas été modifiés par ce lot. Le test
`ANALYSIS_MONTH_CONTRACT_INVARIANTS=PASS`, le typecheck et le build prouvent la
compatibilité. Le chemin History V2 référence les mêmes MetricIds et leurs
MethodVersions dans ses signatures.

## Conformité au Brief et exigences différées

Toutes les règles calculables M1–M4 du Brief sont représentées par une primitive
nommée, un ReadModel et un test discriminant. Les seules étapes différées sont
celles explicitement hors de ce lot : publication de snapshots History V2 live
et frontend. Cette déférence n'invente ni PublicationMeta ni donnée de
présentation.

## Nouvelles informations apprises

- le Policy Registry contenait déjà les quatre policies Bilan `@v1`; aucune
  nouvelle version arbitraire n'était nécessaire ;
- les moteurs Analysis exposent déjà tous les MetricIds requis, ce qui permet un
  adaptateur de projection unique plutôt qu'un nouveau producteur ;
- l'ajout des onze ressources rend les assertions historiques « 4 ressources
  V2 » obsolètes : elles ont été portées à la liste exhaustive des 15 ;
- le garde de publication du lot 05 est réutilisable tel quel pour les onze
  ressources Bilan ;
- les paramètres du détail segment nécessitent une union exclusive explicite
  pour empêcher une clé ambiguë de participer au cache.

## Gaps et risques restants

- aucune vraie publication mensuelle Bilan V2 n'existe encore ; les endpoints
  restent donc correctement indisponibles plutôt que de servir un snapshot V1 ;
- la validation sur données live représentatives appartient au futur lot de
  snapshots/publication ; ce rapport certifie le moteur read-only et ses
  invariants, pas une publication live ;
- les imports résumés externes pourront être `MISSING` ou `STALE` selon leur
  sidecar réel ; cela ne doit jamais être transformé en `UNKNOWN` analytique.

## Correction contractuelle — hash commun et invalidation

Les onze builders Bilan ont été alignés sur la même séparation que les quatre
ReadModels Calendar : `resourceInputHash` prouve leurs entrées locales, tandis
que `PublicationMeta.factsHash` identifie la fermeture complète Household +
YearMonth. Les versions de policies restent propres à chaque ressource.

`historyV2ResourceMethodSignature()` démontre qu'un passage de
`life_money_selection@v1` à `@v2` change la signature de matérialisation sans
modifier le hash des faits. Inversement, un fait consommé par un seul détail
change le hash commun de toutes les ressources de la publication. Aucun moteur
M1–M4, seuil, classement, RuntimeSchema métier ou source Analysis V1 n'a été
modifié par cette correction.

Preuves : transversal `48 checks`, matérialisation `PASS`, Bilan `61/61`,
ReadModels `22/22`, Calendar/Daily `29/29`.

## Statut final

`MONTH_BALANCE_GATE = PASS`
