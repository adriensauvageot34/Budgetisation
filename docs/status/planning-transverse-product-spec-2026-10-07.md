# Planning — spécification produit transversale canonique — 7 octobre 2026

Contrat Plan → Mois à venir → Prévoir une dépense → Réel, avant R6.

## 1. Executive summary

**TRANSVERSE_PRODUCT_SPEC_STATUS = PASS (contrat documentaire).** Cette qualification porte sur les décisions de cette spécification, pas sur une certification de fonctionnalités encore absentes. Une intention garde une filiation explicite ; ses représentations ne constituent pas des coûts supplémentaires. La résolution s'effectue par **unité économique couverte**, jamais au niveau du Context entier. Le coût, les paiements, la capacité wallet, la temporalité, la provenance et la maturité sont des dimensions distinctes.

**DECISION.** Conserver Canonical comme autorité des faits, PlanRevision comme intention durable, et `deriveMonthScenario()` comme owner financier prospectif. Étendre le Compiler et ses adapters pour résoudre les remplacements avant leur entrée dans cet owner ; ne créer aucun moteur financier concurrent. Apply ne matérialise aucune PlannedExpense. Une préparation explicite ne remplace que les composants et occurrences désignés. Le réel protégé et les prévisions concrètes restent sous leurs owners lorsqu'un nouveau Plan est appliqué.

**EXISTING.** Baseline dérivé, révisions immuables, CAS et idempotence Apply, liaison aux enveloppes, journeys explicites, séparation fuel/cash, rapprochement PlannedExpense/réel et intégration du Plan actif dans la page mensuelle existent. **GAP.** Filiation Plan → lignes PlannedExpense, rapprochement partiel, annulation durable, dates souples enrichies et comparaison initial/courant ne sont pas livrés. Le Planner refuse actuellement certaines enveloppes ayant déjà du réel ; il ne faut pas retirer ce refus avant certification de son remplacement.

### Périmètre et convention de lecture

- `EXISTING` : comportement lu au HEAD audité, avec référence précise. Une migration versionnée n'est pas une preuve de schéma distant actuel.
- `TARGET` : contrat futur, non implémenté dans cette passe.
- `DECISION` : arbitrage normatif verrouillé pour les futurs lots.
- `GAP` : différence démontrée entre EXISTING et TARGET.

Audit local du code et des migrations ; aucune lecture Supabase distante, mutation métier, migration, UI R6 ou campagne performance. Les montants ci-dessous sont synthétiques. Le contrat de normalisation Canonical des remboursements, parents/enfants et temporalités reste applicable : « réel » signifie le **montant économique effectif Canonical**, pas systématiquement le montant brut du débit bancaire.

### État Git de référence

```ini
REPO_ROOT = C:/Users/Manon/Documents/Codex/2026-09-28/ve/work/Budgetisation
REMOTE = https://github.com/adriensauvageot34/Budgetisation.git
BRANCH = main
HEAD_BEFORE = 8067d7624ed169a1c271f661f94cc171d0c8ed5f
HEAD_AFTER = 8067d7624ed169a1c271f661f94cc171d0c8ed5f
WORKTREE_WAS_CLEAN_AT_START = YES
PREEXISTING_CHANGES = NONE
PREEXISTING_CHANGES_PRESERVED = YES
PRODUCT_CODE_CHANGED = NO
DB_MIGRATION_CREATED = NO
R6_STARTED = NO
```

Le dossier initial de conversation n'était pas Git. Le checkout ci-dessus a été identifié par son remote, ses symboles Planner et son checkpoint courant. Les anciens checkouts et copies de benchmark n'ont pas été utilisés comme autorité. Aucun checkout, reset, changement de branche, commit, push ou déploiement.

## 2. Current architecture audit

Les références relatives sont résolues depuis ce document. Les noms de types/fonctions permettent de retrouver les contrats même après déplacement de lignes.

| Réf. | Fichier / symbole audité | EXISTING : comportement et limite |
|---|---|---|
| E01 | [SOURCE_OF_TRUTH](../specs/SOURCE_OF_TRUTH.md), [PHASE2_MONTH_MODULES](../specs/PHASE2_MONTH_MODULES.md), [SUPABASE_V2_REFERENCE](../specs/SUPABASE_V2_REFERENCE.md), `AGENTS.md` à la racine | Brief produit et Supabase autorités ; React présente. La carte Supabase est explicitement un snapshot historique Gate 0, pas un état courant. |
| E02 | [checkpoint performance](planner-composer-performance-checkpoint-2026-10-07.md), §8–11 | Phase fermée ; 291 GET Next historiques, DTO 273 000 octets ; P3 différé. Ces mesures ne sont pas relancées ici. |
| E03 | [world-reader.ts](../../src/server/phase2/planner/world-reader.ts), `createPlannerDependencies` | Implémentation effective du « PlanningWorldAdapter », sans type portant exactement ce nom : scope foyer, cutoff Temporal, Forecast et sources démarrés indépendamment, prepareWorld Mobility, chemin V2 direct. |
| E04 | [baseline-adapters.ts](../../src/server/phase2/planner/baseline-adapters.ts), `readPlanningBaselineSources`, `admitPlanningForecast` | Lit owners Canonical, habits, Purchase-aware, M7, inputs, PlannedExpenses ; admet même publication/sourceRevision/analyticsRevision ; historique borné avant mois/cutoff et mois complets. |
| E05 | [baseline-contract.ts](../../src/domain/phase2/planner/baseline-contract.ts), [baseline.ts](../../src/server/phase2/planner/baseline.ts), [simple-baseline.ts](../../src/server/phase2/planner/simple-baseline.ts), [renewal-baseline.ts](../../src/server/phase2/planner/renewal-baseline.ts) | `PlanningBaselineV1` dérivé avec digest, sourceRefs, UNKNOWN, réserves et references ; restaurants/fast-food/delivery distincts ; floor observé groceries/tobacco. |
| E06 | [plan-contract.ts](../../src/domain/phase2/planner/plan-contract.ts), [repository.ts](../../src/server/phase2/planner/repository.ts) | `Plan`, `PlanRevision`, readActivePlan/readRevision/readAppliedRequest ; JSON semanticState/manifest/evidence durables, pointer actif, chaîne parent. |
| E07 | [migration Plan](../../supabase/migrations/20261005202346_phase2_month_plan_foundation.sql), tables `phase2_month_plans`, `phase2_month_plan_revisions`, RPC `apply_phase2_month_plan_v1` | Un Plan/foyer/mois ; revision number/request uniques ; trigger interdit UPDATE/DELETE/TRUNCATE révisions ; reads RLS, writer atomique authentifié. |
| E08 | [draft-reader.ts](../../src/server/phase2/planner/draft-reader.ts), [semantic-state.ts](../../src/domain/phase2/planner/semantic-state.ts), [semantic-mutations.ts](../../src/server/phase2/planner/semantic-mutations.ts) | Draft en mémoire ; seed actif ou empty ; dernier SET_STATE par slot ; Contexts UUID `ACTIVE` uniquement ; REMOVE_CONTEXT retire le subtree du nouvel état, anciennes révisions conservées. |
| E09 | [identity.ts](../../src/domain/phase2/planner/identity.ts), [component-contract.ts](../../src/domain/phase2/planner/component-contract.ts), [context-selections.ts](../../src/server/phase2/planner/context-selections.ts) | IDs déterministes, selections persistées dans semanticState, unicité selectionId locale au socket ; pas d'identité canonique de chaque occurrence anonyme d'un count. |
| E10 | [context-compiler.ts](../../src/server/phase2/planner/context-compiler.ts), [context-state.ts](../../src/server/phase2/planner/context-state.ts), [context-registry.ts](../../src/server/phase2/planner/context-registry.ts) | Composite/child/one-of/repeating ; suggestions personnelles non contributives ; bindings consumes/extra/unresolved ; promotion et reparent structuraux. Parent n'ajoute pas de total indépendant. |
| E11 | [compiler.ts](../../src/server/phase2/planner/compiler.ts), `compileSemanticPlan`, [plan-slot-resolver.ts](../../src/server/phase2/planner/plan-slot-resolver.ts) | Compile composants, externals et Mobility ; capacités amount/count consommées avant prix ; ownership group dining. `kernel.generic.externalIntentId` référence une root externe entière, sans préparation de composant. `external:*` représente une ligne externe mappée à un slot, sans être une filiation depuis le Plan. |
| E12 | [financial-adapter.ts](../../src/server/phase2/planner/financial-adapter.ts) | Neutralise inputs V2 possédés et remplace références possédées ; entries `planner:*` synthétiques request-local ; external line baselineKey neutralisée si déjà possédée ; un seul appel au financier existant. |
| E13 | [constraint-engine.ts](../../src/server/phase2/planner/constraint-engine.ts), `evaluatePlanConstraints` | Protège savings/floors ; `OWNED_SLOT_OBSERVED_RECONCILIATION_REQUIRED` BLOCK si du réel courant touche un slot possédé. `compiler.ts` refuse externals mappés `DECLARED_REALIZED` par `PLANNER_EXTERNAL_REALIZED_RECONCILIATION_REQUIRED`. |
| E14 | [preview.ts](../../src/server/phase2/planner/preview.ts), [apply.ts](../../src/server/phase2/planner/apply.ts), [revision-evidence.ts](../../src/server/phase2/planner/revision-evidence.ts) | Même compile/derive ; Apply relit/recompile, compare baseline/preview/base, zéro write stale ; retry immutable evidence ; une RPC, aucun writer PlannedExpense/MonthInputs. |
| E15 | [effective-month-scenario.ts](../../src/server/phase2/planner/effective-month-scenario.ts), [projection.ts](../../src/server/phase2/planner/projection.ts), [projection-contract.ts](../../src/domain/phase2/planner/projection-contract.ts) | V2 sans Plan, recompilation révision active sinon ; EXACT ou CHANGED_AUTHORITIES ; divergence sous mêmes autorités refusée. Projection explicative, pas somme des cards. Completeness actuelle toujours PARTIAL si remainder connu : cash low point non certifié. |
| E16 | [planned-contract.ts](../../src/domain/phase2/planned-contract.ts), [planned-expenses.ts](../../src/server/phase2/planned-expenses.ts), `PlannedExpense`, `resolvePlannedExpenseDraft` | Root UUID, lignes CostItem IDs, quantity/unitAmount, montant dérivé ; plannedDate nullable, contexte participants/routes ; statuts PLANNED/DECLARED_REALIZED, CAS updatedAt, replay UUID. Pas de source Plan par ligne. |
| E17 | [migration PlannedExpense](../../supabase/migrations/20260928163114_phase2_planned_expenses.sql), [report month](../../supabase/migrations/20260929232710_phase2_planned_report_month.sql) | Table prospective RLS ; CostItems JSONB, root reportable avec même ID ; annulation/suppression actuelle DELETE. Aucun tombstone CANCELLED. Les contraintes JSONB ont été enrichies par les migrations suivantes. |
| E18 | [planned-observation-reconciliation.ts](../../src/server/phase2/planned-observation-reconciliation.ts), `economicObservations`, `reconcilePlannedObservations` | Groupe par purchaseEventId sinon operationId ; `context.realityLink` USER_CONFIRMED root → un PurchaseEvent/Operation ; matching automatique exact et unique bilatéral (catégorie, vendeur, jour, gross, personne, funding complet). PARTIAL refusé ; projet multi-modules non couvert par rapprochement de lignes. |
| E19 | [month-prediction-evidence.ts](../../src/server/phase2/month-prediction-evidence.ts), `mergePredictionPurchases`, [CanonicalRepository](../../src/server/canonical/repository.ts), `loadPurchaseAwareCanonical` | Purchase-aware retire Operations représentées, conserve gross/funding séparés et LOWER_BOUND ; génération/périmètre contrôlés. Evidence mensuelle lit funding/ledger. Ce chemin actuel dépasse le statut pilote historique du rapport C2. |
| E20 | [Purchase ADR](../swile/c1-purchase-gross-assertion-adr.md), [C2 Canonical](../swile/c2-purchase-aware-canonical.md), [foundation générique](../../supabase/migrations/20260925003500_generic_benefit_purchase_foundation.sql) | Gross sur PurchaseEvent, unique consumption owner Operation ou composant natif ; memberships/funding/ledger explicites ; montant et temps indépendants. Les rapports datés décrivent leur lot, pas tous les consumers actuels. |
| E21 | [month-scenario.ts](../../src/server/phase2/month-scenario.ts), `deriveEconomicPlan`, `deriveMonthScenario`, [remaining-month-forecast.ts](../../src/server/phase2/remaining-month-forecast.ts) | Écarte dépenses reconciled des prévisions actives ; quotidien résiduel + réel + externals, absorption une fois. Mode par défaut FULL_MONTH_SAFE, absence d'import/date dépassée ne supprime pas arbitrairement les habitudes. |
| E22 | [forecast-temporal-policy.ts](../../src/server/phase2/forecast-temporal-policy.ts), [bank-cash-projection.ts](../../src/server/phase2/bank-cash-projection.ts) | Modes SAFE/AS_OF explicites ; cash as-of via balance, observations, échéances, payments non bookés ; ne pas redébiter une observation déjà dans le solde. |
| E23 | [mobility-contract.ts](../../src/domain/phase2/planner/mobility-contract.ts), [journey-resolver.ts](../../src/server/phase2/planner/journey-resolver.ts), [mobility-compiler.ts](../../src/server/phase2/planner/mobility-compiler.ts) | Context → MobilityIntent → PhysicalJourneyRequirement ; relations owns/shares/adds-stop/access/no-additional ; similar ≠ identity ; externals expense+costLineIds explicites, pas seconde requête coût pour journey external. |
| E24 | [prospective-mobility-pricing.ts](../../src/server/phase2/planner/prospective-mobility-pricing.ts), [planned-money.ts](../../src/domain/phase2/planned-money.ts), [Canonical Mobility](../canonical-mobility/CANONICAL_MOBILITY_CONTRACT.md), [canonical/mobility.ts](../../src/server/canonical/mobility.ts), [canonical/mobility-trips.ts](../../src/server/canonical/mobility-trips.ts) | Digest de demande contrôle prix/routes frais ; fuel_usage ECONOMIC_ONLY ; réel unique par leg, context links M7 dérivés, ni personnes ni liens ne multiplient le coût. Pas de relation Plan journey → leg réel dans ces contrats. |
| E25 | [benefit-wallets.ts](../../src/domain/phase2/benefit-wallets.ts), [benefit-wallet-funding.ts](../../src/server/phase2/benefit-wallet-funding.ts), [benefit-wallet-policy.ts](../../src/domain/phase2/benefit-wallet-policy.ts) | Stock observé/reconstruit seulement avec couverture continue ; chargements datés, cap quotidien, réservations prioritaires ; shortfall/fundingToComplete sans fallback Banque automatique ; modèle mensuel agrégé par provider, plusieurs wallets même provider non résolus. |
| E26 | [page mensuelle](../../src/app/mois-a-venir/page.tsx), [month-control-center.ts](../../src/server/phase2/month-control-center.ts), [cutover.ts](../../src/server/phase2/planner/cutover.ts) | Page consomme scénario effectif ; détail marginal V2 par carte sauté avec Plan actif ; legacy writer protège seulement targets Plan ; flag Composer masque entrée mais ne retire pas autorité d'un Plan appliqué. |
| E27 | [planned-expenses-actions.ts](../../src/app/mois-a-venir/planned-expenses-actions.ts), [month-choices.ts](../../src/server/phase2/month-choices.ts) | Des preflights/actions utilisent encore derive V2 direct. L'intégration page active existe, mais toutes les simulations de mutations externes ne consomment pas encore uniformément l'autorité Plan actif. |
| E28 | [composer-presentation.ts](../../src/server/phase2/planner/composer-presentation.ts), [composer-ui-contract.ts](../../src/domain/phase2/planner/composer-ui-contract.ts) | Aliases/icônes/orbits/variants UI sur manifest ; liens de consommation et journey recopiés. Nodes R6 cités dans la mission ne sont pas une nouvelle autorité métier existante. |

## 3. Existing authorities — TABLE A

| Concept | Owner actuel | Persisté ? | Dérivé ? | Mutable ? | Source of truth ? | Proposé |
|---|---|---|---|---|---|---|
| Faits financiers | CanonicalRepository + vues SQL Canonical, E19/E20 | Sources oui | Facts oui | Correction par owner historique | Oui, faits | Aucun writer Plan historique |
| Operation | operations + financial_bank_cost_canonical | Oui | Vue bancaire | Owner Banque | Oui, mouvement bancaire | Aucun planRevisionId direct |
| Purchase | purchase_events/memberships/consumption owner | Oui | Fact effectif | Owner achat/import | Oui, achat/gross/qualité | Liens réalisation depuis couche prospective |
| Mobility observée | mobility_legs/trips, M7 context/presence | Legs/trips oui | Context links/rollups oui | Owner Mobility | Oui, déplacement ; coût d'usage estimé reste estimé | Association directe journey/legs avec coverage |
| Wallet | benefit_wallets/ledger + balance observations | Oui | Stock/capacité oui | Owner wallet/input | Oui pour observations, non pour réserve simulée | Allocation par wallet si plusieurs propriétaires |
| Resources/obligations | Forecast courant admis, MonthInputs autorisés | Sources/inputs oui | Projection oui | Owner dédié | Vérité de leur domaine | Préserver publications et dates inconnues |
| Cagnotte/réservation | declaredOutflows + metadata savings, baseline-structural | Inputs oui | Vue Plan oui | Adjustable seulement via capability | Réservation réelle sous son owner | ProtectedSavingNode est une présentation |
| PlanningBaseline | buildRenewalPlanningBaseline | Pas d'autorité persistée autonome | Oui | Reconstruit | Non | baselineSnapshot existant dans révision = preuve figée de décision, pas cache live |
| Draft | readPlannerDraft + semanticState mémoire | Non | Preview | Oui | Non | Pas de cloud draft requis |
| PlanRevision | tables/RPC E06/E07 | Oui, immutable | Compilation evidence figée | Non | Oui, intention à cette version | Réutiliser chaîne ; version future de contrats |
| Context/component | semanticState/Compiler | Intentions JSON oui ; compiled evidence oui | Composants évalués oui | Future-only après commitment | Oui pour intention, non pour faits | Lineage par feuille, parent non additif |
| PlannedExpense | table/service E16/E17 | Oui | Gross/scenario/maturity oui | CAS, service propre | Oui, prévision concrète/déclaration | Source lines, cancel history, coverage |
| PlanProjection/scénario effectif | Compiler adapter → deriveMonthScenario → buildPlanProjection | Evidence Apply oui | Live oui | Reconstruit | Seul résultat prospectif financier | Étendre vue explicative, pas seconde finance |
| Publication | analytics_publications/query snapshots E04/E19 | Oui | Published generation | Owner analytics | Fraîcheur et génération des analytics | Apply ne publie pas d'analytics |

**DECISION.** Le snapshot Baseline déjà contenu dans PlanRevision est nécessaire à l'audit du Plan initial. L'interdiction de « persister PlanningBaseline » signifie ne pas en faire une autorité autonome ou un snapshot historique réutilisable P3 ; elle n'exige pas de supprimer cette preuve existante.

## 4. Existing identity model

**EXISTING.** E09 calcule `planSlotId(slotIdentityKey)` sans foyer/mois ; c'est une identité de slot sémantique, pas une clé globalement unique d'intention. `componentId(contextOccurrenceId, slotKey, selectionId)` est déterministe pour un composant composable ; `kernel.generic` utilise le rôle et `single`. Un changement prix/quantité/date ne change pas cet ID si les arguments restent les mêmes ; déplacer une selection dans un autre Context/socket le change. `selectionId` est une string non vide, unique seulement dans son socket : ne pas la traiter comme UUID global.

`mobilityIntentId(contextOccurrenceId, slotKey)` ignore le mode et la route. Le journey actuellement construit utilise `prospectiveJourneyId(householdId, month, ownerIntentId)` ; le helper `physicalJourneyRequirementId(planId, owningContextId, journeySlot)` existe mais n'est pas le builder utilisé par le resolver audité. Besoins/episodes utilisent `needOccurrenceId` et `acquisitionEpisodeId`, adaptés au renouvellement, pas à toutes les intentions.

Root PlannedExpense UUID et CostItem ID restent stables lors d'une correction qui conserve la ligne ; une ligne recréée a une autre identité. Root reportée garde son UUID mais change de mois. PurchaseEvent, Operation et MobilityLeg ont leurs identités propres. `planner:*`, `external:*`, bindings, pricing digests et ids de drag sont des identités dérivées de projection ; un hash de prix ou de montant n'est jamais une filiation.

## 5. Target conceptual model

**TARGET / DECISION.** Une unité de résolution correspond à une feuille économique ou à une partie explicitement couverte de cette feuille. Son parent Context sert à regrouper/expliquer. Un slot d'enveloppe représente une capacité amount/count ; sa consommation n'affirme pas qu'un achat particulier avait déjà une identité dans le Plan.

```text
Canonical/inputs/habits → Baseline dérivé → PlanRevision.semanticState
                                           │ component / slot capacity
                                           ▼ lien de matérialisation explicite
                                      PlannedExpense.CostItem
                                           │ réalisation par coverage
                                           ▼
                                   Purchase OU economic owner Operation
                                   └─ funding → wallet / Operation bancaire
Context → MobilityIntent → physical journey → economic fuel/fare/toll/parking
                                             └─ legs observés via relation directe

Toutes les feuilles effectives → adapter Compiler → deriveMonthScenario
                                                → PlanProjection / Mois à venir
```

Pas de table générique « toute intention de toute l'application », ni copie du réel dans Plan. La couche de liens et le manifest disent **quelle représentation couvre quelle unité et quelle dimension**, sans posséder de montant financier parallèle.

## 6. Stable identity / lineage contract — TABLE B

| Object | Stable identity | Parent/source | Successor | Relation required | Exists today? |
|---|---|---|---|---|---|
| Plan | planId ; foyer/mois unique | Foyer/mois | Révisions | Pointer actif existant | EXISTING |
| Revision | planRevisionId | planId + parentRevisionId | Revision suivante | Chaîne immutable | EXISTING |
| Slot capacité | (foyer, mois, slotIdentityKey), planSlotId comme alias | Baseline + décision révision | Occurrences/feuilles consommatrices | CONSUMES_SLOT amount/count | EXISTING capacité ; TARGET lineage d'occurrences |
| Context | (plan scope, contextOccurrenceId UUID) | Parent facultatif | Même UUID versions suivantes | Parent graphe | EXISTING |
| Component | (plan scope, componentId) | Context/socket/selection | Même ID si même intention | Révision source prouve existence | EXISTING ID ; GAP lien externe |
| Occurrence individualisée d'un slot count | occurrenceId UUID alloué une seule fois | Slot + révision d'individualisation | Component/PlannedExpense | Capacité consommée = une occurrence | TARGET, absence actuelle |
| CostItem concret | (plannedExpenseId, costItemId) | Root | Allocations réalisation | Source Plan par ligne ; coverage | EXISTING ID ; TARGET relation |
| Purchase/Operation économique | purchaseEventId / canonicalComponentKey | Consumption owner Canonical | Corrections/remboursements Canonical | Relation réalisation de ligne | EXISTING root realityLink seulement |
| Journey | (foyer, mois, physicalJourneyRequirementId) | MobilityIntent owner | Legs/transport concret | Relation déjà explicite intent/journey ; observed coverage à ajouter | EXISTING prospectif ; GAP réel |
| Funding | Allocation de ligne ou purchase_funding_component_id | Un seul coût payable | Wallet debit / bank Operation | Source, montant et source financière identifiés | EXISTING provider ; TARGET wallet précis si nécessaire |

### Contrat minimal des liens futurs

**DECISION.** Une PlannedExpense ne porte pas un lien Plan ambigu au niveau root. Chaque ligne issue du Plan a une relation typée contenant `originPlanRevisionId`, `sourceRef`, `coverage`, `relation = MATERIALIZES` :

```text
sourceRef = COMPONENT { componentId }
          | SLOT_OCCURRENCE { slotIdentityKey, occurrenceId }
coverage  = FULL | QUANTITY { units, unit } | ECONOMIC_SHARE { share }
```

La révision source donne `planId`, foyer, mois, Context et composants du manifest : **pas de planId/contextId redondants sur la ligne**, ni lineageKey générique concurrente. Une référence à un composant compilé est validée dans le manifest immutable, car ce composant n'a pas de table à laquelle accrocher une FK SQL simple. FK composite révision/foyer, validation serveur de la feuille et index des liens sont nécessaires au futur stockage (§23).

Le lien source est figé à la première matérialisation. Une nouvelle révision conserve le même componentId ; elle ne réécrit pas `originPlanRevisionId`. Tous les liens vers la même feuille sont groupés par plan scope + componentId, indépendamment de la révision source. Un replay identique réutilise root/line IDs et relation ; deux créations concurrentes ne peuvent couvrir deux fois FULL ni dépasser la coverage autorisée. Plusieurs lignes peuvent partitionner une feuille ; aucune ligne ne matérialise deux feuilles implicitement. Les coûts détaillés d'une feuille unique peuvent avoir plusieurs lignes couvrant une partition exhaustive explicite.

**DECISION.** `quantity` d'un article, nombre de personnes et `occurrenceCount` ne sont jamais interchangeables. Pour individualiser 1 restaurant d'un count 2, allouer occurrenceId stable à cette unité et consommer 1 capacité ; les unités encore anonymes restent un count résiduel, sans inventer leurs dates. Une fois individualisée, l'occurrence survit aux révisions et une réalisation la consomme une fois. Un simple amount envelope est relié par consommation monétaire, jamais présenté comme preuve que chaque achat y était nominativement prévu.

Les changements d'amount/date/funding gardent l'identité ; une autre sortie explicitement ajoutée obtient un autre ID. Reparent d'un child garde ses propres composants. Pour déplacer/promouvoir un composant déjà lié, interdire une transformation qui change silencieusement son componentId : conserver sa feuille d'origine protégée et déplacer seulement sa présentation, ou enregistrer un mapping explicite de succession/partition dans le changeSet versionné. Ce mapping est acyclique, conserve la coverage et ne fusionne pas deux sorties par similarité. T0 doit fournir ce mapping avant d'exposer de telles mutations ; en son absence, refus structuré et zéro write.

**Operation ne connaît pas directement le Plan.** La relation réalisation relie ligne PlannedExpense → economic owner Canonical (Purchase prioritaire quand il existe), puis les memberships/funding existants donnent l'Operation. Pour du réel sans préparation préalable, un lien `FULFILLS` component/occurrence → owner Canonical est permis dans la même couche prospective, sans créer une fausse PlannedExpense. Sans lien ni matching certifié, aucun fait n'est déclaré réalisation nominative ; il peut néanmoins consommer une capacité de catégorie reconnue par l'owner.

**Mobility** connaît son MobilityIntent/Context via le journey owner existant ; les composants fuel/fare dérivés connaissent le journey. La relation au réel part du journey vers legs/segments. Ne pas copier séparément Context et PlanRevision dans tous les legs historiques.

## 7. Provenance contract

**EXISTING.** E05/E09 exposent sourceRefs/evidenceRefs, huit `PlannerProvenance`, knowledge/confidence/freshness/modelVersion. Component selections ont un autre vocabulaire de défaut/suggestion/décision. Le Compiler marque actuellement certains externals mappés `CANONICAL_FACT` alors qu'il s'agit de PlannedExpenses ; ce code est une preuve de leur source autorisée, **pas une preuve d'observation réelle**.

**DECISION.** Conserver ces références sans conversion destructive. TARGET ajoute à la vue résolue `sourceLayer = BASELINE | PLAN | CONCRETE_FORECAST | OBSERVED` et `origin = PLAN_MATERIALIZATION | EXTERNAL_INTENTION | DERIVED`, en complément des preuves détaillées existantes. Ces labels ne remplacent pas la provenance fine. Réserver l'étiquette d'observation effective aux facts admis par l'owner Canonical ; la provenance d'une décision peut rester PLAN après réalisation.

La ligne préparée conserve ses décisions explicites et un lien vers la preuve originelle ; ne copier ni le world complet, ni la baseline, ni les objets Canonical. Prix/date/funding ont chacun sourceRefs et quality propres. Le manifest de résolution retient winnerRef, coveredRefs, suppressedRefs, reason, knowledge et sourceRefs, même si la contribution supprimée n'entre plus dans le total. UNKNOWN, LOWER_BOUND, CONFLICT et NOT_APPLICABLE restent distincts de zéro.

## 8. Maturity contract — TABLE D

**DECISION.** Maturité agrégée dérivée de coverage et des owners. Pas de statut PARTIALLY_PREPARED/REALIZED dupliqué à écrire sur toutes les couches. `DECLARED_REALIZED` n'est pas `REAL_OBSERVED` : une déclaration reste une prévision concrète déclarée, remplaçable par Canonical.

| State | Meaning | Entry condition | Exit condition | Persistent or derived |
|---|---|---|---|---|
| PLANNED | Intention future sans préparation | Plan actif applicable | Première coverage concrète / cancellation | Dérivé |
| PARTIALLY_PREPARED | Une partie active a une prévision concrète | Coverage concrète strictement partielle | Couverture complète, réalisation ou cancel | Dérivé ; lignes sources persistées |
| PREPARED | Tout le périmètre actif est concrétisé | Coverage complète, prix éventuellement encore partiels | Réalisation/correction/cancel de l'owner | Dérivé |
| PARTIALLY_REALIZED | Des unités économiques sont observées, d'autres restent futures | Coverage observed strictement partielle | Dernière unité réalisée ou reste annulé | Dérivé |
| REALIZED | Plus de futur actif et toutes unités non annulées réalisées | Observation économique couvrante admise | Correction Canonical uniquement | Dérivé |
| CANCELLED | Aucun futur actif et aucune unité réalisée | Cancellation explicite totale | Réactivation explicite | Décision cancel persistée ; vue dérivée |
| CLOSED_WITH_REALIZED_PART | Reste annulé mais réel ou obligation retenus | Cancellation de la partie future | Corrections/refunds par owners | Dérivé, détail de coverage conservé |

Pour les vues, exposer aussi les quantités/counts planned/prepared/observed/cancelled et `declarationStatus`, sans confondre cette ventilation avec completeness. Une intention plan-only peut avoir un coût économique estimable et une identité complète ; elle n'est pas incomplète du seul fait de sa maturité. L'incertitude du cash daté peut, indépendamment, rendre la projection globale PARTIAL comme aujourd'hui.

## 9. Temporal contract

**EXISTING.** `PlannerTemporalRef` = DATED(date,time nullable) ou MONTH_UNSCHEDULED ; Context fields DATE validés dans le mois ; PlannedExpense plannedDate nullable, endDate/visitTiming/route times existent. Pas de soft weeks. Les obligations peuvent avoir une date estimée, explicitement qualifiée ; freshness n'est pas une échéance.

**TARGET / DECISION.** Union versionnée : MONTH_UNSCHEDULED, SOFT_MONTH_WINDOW et DATED. `SOFT_MONTH_WINDOW` porte `targetMonth`, `bucket = START | WEEK_2 | WEEK_3 | END | WHEN_POSSIBLE`, sans date ISO fictive. Convention des fenêtres : START jours 1–7, WEEK_2 8–14, WEEK_3 15–21, END 22–dernier jour ; WHEN_POSSIBLE tout le mois. Ce sont des contraintes souples, pas des rendez-vous ni des dates de paiement. Les buckets restent déclarés ; leur dépassement n'annule rien.

Une matérialisation peut conserver une date inconnue. Une date/heure de prévision concrète vient de l'utilisateur ou d'une autorité explicite ; elle se superpose pour les seules unités couvertes, sans réécrire le Plan initial. Un événement peut être daté tandis que son paiement ne l'est pas. Le réel utilise la date économique et la date bancaire de leurs owners respectifs, y compris si elles diffèrent de mois.

Le mois/jour sont civils dans la timezone IANA du foyer (Europe/Paris pour les exemples). Si une heure est utilisée comme instant, conserver timezone et résoudre explicitement les heures inexistantes/ambiguës ; ne pas laisser le timezone du poste décider. Un transfert intermois d'une PlannedExpense liée garde son lien originel mais doit persister `DEFERRED_TO_MONTH` pour supprimer son ancien futur et le porter une fois dans le mois cible ; le simple report actuel sans lineage ne suffit pas à cette extension. Ressources wallets du nouveau mois revalidées, jamais copiées automatiquement.

## 10. Precedence / replacement rules — TABLE C

**TARGET / DECISION.** Precedence par unité couverte **et par dimension**, après validation du scope, de l'identité et de la qualité. L'état du Context parent ne choisit pas le prix de tous ses enfants.

| Situation | Candidates | Winner | Retained for history? | Financial contribution |
|---|---|---|---|---|
| Capacité modifiée explicitement | Baseline, contrôle Plan actif | Plan sur slot possédé | Baseline evidence et ancien Plan oui | Capacité effective, pas Baseline + Plan |
| Feuille préparée FULL | Plan, ligne concrète liée | Concrete forecast | Les deux oui | Ligne concrète une fois |
| Feuille réalisée FULL | Plan, concrete, Canonical couvrant | REAL OBSERVED | Toutes représentations oui | Coût Canonical effectif une fois |
| Plusieurs composants du Context | Winners propres à chaque feuille | Winner par feuille | Oui | Somme des feuilles effectives ; aucun total parent additionnel |
| Paiement observé seulement | Coût concret 142, acompte bancaire 40 | Concrete pour coût, banque pour paiement 40 | Oui | Économique 142 ; cash déjà payé 40 + futur 102 si engagement total connu |
| Réel partiellement connu FULL | LOWER_BOUND 20, prévision 47 couvrant le même coût | Borne réelle, estimation de complément qualifiée | Oui | Borne ≥20 ; central estimé max(20,47)=47, jamais 20+47 |
| Deux observations prétendent réaliser FULL | Deux liens non partitionnés | Aucun arbitrage silencieux | Oui | CONFLICT, blocage du remplacement ; candidates non additionnées comme même coût |
| Cancellation future explicite | Tombstone, Plan/Baseline | Cancellation pour futur concerné | Oui | Zéro futur ; réel/obligation séparés conservés |
| Sources sans identité équivalente | Deux sorties même date/vendeur | Deux intentions distinctes ou ambiguity | Oui | Aucun remplacement nominatif par similarité |

### Algorithme conceptuel verrouillé

1. Admettre un world autorisé foyer/mois/cutoff/publication, lire Plan actif, externals, faits et liens en batch. Charger aussi les seules révisions d'origine nécessaires aux liens ; pas toute la chaîne historique.
2. Normaliser les **faits effectifs** avec Canonical : Purchase/Operation owner unique, parents/enfants exclusifs, net/refunds, unique MobilityLeg. Cette normalisation précède toute precedence Plan.
3. Compiler les intentions actives en feuilles/capacités. Garder aussi les sources figées de feuilles préparées, réalisées, annulées ou reportées absentes du nouveau semanticState : leur absence ne supprime pas une obligation ni un fait.
4. Former les groupes d'équivalence par relations explicites (§6/12/13). Valider coverage disjointe, dimension ECONOMIC/FUNDING/PAYMENT/MOBILITY_USAGE, scope et unités. Le binding de catégorie autorise absorption de capacité ; il ne prouve pas l'identité d'une sortie nominative.
5. Partitionner chaque feuille en unités observées, concrètes, futures Plan et annulées. Pour chaque partition : REAL > CONCRETE > PLAN > BASELINE. Un winner FULL masque tout estimate du même coût, même si son prix diffère. Une coverage partielle ne masque que son périmètre ; ne pas soustraire une simple proximité monétaire.
6. Résoudre séparément quantité/occurrence/temps/prix/funding. Une quantité inconnue ne devient pas zéro ; un total réel LOWER_BOUND ne devient pas exact. Si le total FULL est inconnu, garder borne, estimation et raisons distinctes, ou remainder null si aucun estimate compatible n'est certifiable. Si les unités réalisées sont connues et disjointes, additionner uniquement leur coût et celui des unités restantes.
7. Consommer chaque capacité de slot une fois, après résolution des feuilles, et calculer son résiduel. Émettre les contributions effectives et le manifest des remplacements vers l'adapter existant, puis `deriveMonthScenario`. Ne pas ajouter les winners réels sous forme de faux PlannedExpense si l'evidence Canonical les contient déjà.
8. Projeter la vue avec provenance/maturité/knowledge, liens suppressed et variance. Toute ambiguity d'identité bloquant une déduplication garde un diagnostic et une projection non certifiée ; l'UI ne choisit aucun winner.

### Count, amount et personnes

Pour une capacité **COUNT mensuelle totale applicable** `N`, un unit price `u`, `r` occurrences observées, `c` concrètes non observées et `p` Plan explicites encore futures : `nResidual = max(0, N-r-c-p)`. N compte les unités non annulées, y compris celles déjà réalisées ; les cancellations ont déjà retiré leur capacité de N. Contribution = coûts réels uniques + coûts concrets uniques + coûts des feuilles Plan + `nResidual*u`. Prix observé différent de u ne consomme pas un count fractionnaire. Une sortie à deux personnes = une occurrence si le modèle de slot est sortie du foyer ; deux repas individuels de travail = deux occurrences de leurs slots PERSON respectifs. Ni nombre de paiements ni nombre de participants ne multiplie une sortie.

Pour une **AMOUNT mensuelle totale** `T`, économique observé `O`, concret futur compatible `C`, Plan explicite compatible `P`, réserve restante = `max(0,T-O-C-P)`. Projeté = `O+C+P+réserve`. Les dépassements réels/concrets restent visibles, jamais écrêtés à T. Un futur lot ne doit pas changer implicitement la signification des contrôles actuels en « montant restant » : les API doivent porter `budgetBasis = MONTH_TOTAL`. Une saisie « encore 100 » est traduite explicitement en target mensuel par l'owner à partir du protégé, avec preuves ; pas dans React.

L'annulation d'une occurrence individualisée retire sa capacité ; elle ne la rend pas anonymement disponible. Si le slot est possédé par le Plan, la commande coordonnée append une révision portant le count résultant et le tombstone, sans modifier l'ancienne révision. Exemple count2, une occurrence annulée ⇒ nouveau count1 et résiduel1 ; ne pas soustraire ensuite une deuxième fois le tombstone. Une nouvelle saisie count1 désigne ce total non annulé ; une commande distincte peut explicitement restaurer une capacité, sans réactiver la sortie annulée. Si la capacité provient seulement de Baseline sans contrôle Plan, l'individualisation/cancellation produit un contrôle explicite du Plan lorsqu'un Plan existe ; hors Plan, conserver le parcours V2 et ne pas déclarer la suppression de la root comme annulation de toute l'habitude. Pour une enveloppe amount anonyme, retirer une feuille sans réduire le budget conserve un budget disponible : l'UI doit proposer l'action explicite de baisse d'enveloppe, sans prétendre que la sortie annulée est encore prévue. Le monde sans Plan conserve sa politique SAFE actuelle ; aucune extinction sur silence des imports.

Les dates économiques fixent le mois de contribution des faits, même si le Plan source concernait un autre mois. Les liens conservés empêchent de recréer le futur dans le mois d'origine ; le budget mensuel peut être transféré explicitement. Plan-only dans un mois fermé est une variance/non-réalisation, pas un réel inventé.

## 11. Plan → PlannedExpense

**EXISTING.** Apply écrit seulement PlanRevision (E14). Les entries `planner:*` sont des ponts runtime ; elles ne sont pas des roots enregistrées. **DECISION.** Maintenir cette frontière.

**TARGET.** La matérialisation naît sur une action explicite « préparer cette intention/ce composant », ou une réservation confirmée par un parcours autorisé produisant cette même commande. Une simple saisie de prix/date dans Composer, un drag, Preview ou Apply ne déclenche rien. La maturité PREPARED ne dépend pas d'une date obligatoire : une prévision concrète peut encore être à dater.

Commande proposée : `materializePlanSelection(expectedActiveRevisionId, expectedPreviewDigest, sourceSelections[], draftId, plannedExpenseDraft)`. Les sources désignent la révision auditable, les feuilles/occurrences et coverage ; le serveur vérifie membership, état applicable, absence de overlap, prix/dates/funding et autorité fraîche. Il retourne la root et une projection effective, avec révisions des owners. CAS/idempotence source+root+liens atomiques ; zero-write si stale/invalide. Le UUID draft et les CostItem IDs sont stables au replay.

Copier uniquement le contenu éditable utile : label, participants/lieux pertinents, prix/quantity explicitement retenus, temporalité concrète éventuelle, choix funding. Le pricing dérivé est revalidé par son owner ; une quote du manifest n'est pas une donnée live réutilisable sans validation. Référencer source component/occurrence et provenance ; ne copier ni baseline, ni coût total du Context, ni trips observés, ni réservations wallet comme débits. La baselineKey compatible est une relation d'absorption, pas une seconde source monétaire.

Week-end : hôtel préparé 142 et activité 38 peuvent être des roots distinctes ou deux lignes d'une root si leurs dates/lifecycle restent compatibles. Transport 27 et restaurant 45 restent Plan : économique effectif **252**, jamais ancien Context +142+38. Une root concrete groupant des dates/lifecycles incompatibles doit être scindée ; modules enfants actuels ne créent pas automatiquement des roots.

Une matérialisation ne modifie pas la révision Plan originelle : son overlay effectif devient CONCRETE, provenance originelle PLAN. Son statut prospectif initial reste PLANNED. Ajouter `commitmentKind = ESTIMATE | COMMITTED_LIABILITY` pour distinguer un prix préparé révocable d'une réservation créant une obligation due : cette propriété n'est ni la maturité ni un fait bancaire.

## 12. PlannedExpense → Real

**EXISTING.** E18 fournit déjà un lien root vers un fact et un matching exact unique. Il n'est pas un graphe d'allocations de lignes ; il refuse PARTIAL et les composites incompatibles. E19 retire déjà les Operations représentées par un Purchase. Ne pas remplacer ce code par du fuzzy matching.

**TARGET / DECISION.** Une relation de réalisation précise `(plannedExpenseId,costItemId) → canonicalEconomicOwnerRef`, coverage et mode `USER_CONFIRMED | EXACT_UNIQUE`. Favoriser PurchaseEvent s'il couvre l'achat ; utiliser canonicalComponentKey de l'Operation sinon. L'Operation peut être une source de paiement d'un achat, sans être son coût supplémentaire. Un champ root realityLink reste le raccourci compatible des cas univoques couvrant toutes les lignes ; sa conversion vers le graphe est déterministe et ne duplique pas les relations.

Une observation ne peut réaliser FULL deux lignes indépendantes ; un achat couvrant plusieurs lignes exige des allocations économiques explicites dont la somme n'excède pas son coût Canonical. À couverture totale, somme = coût net applicable, arrondie au centime avec un reliquat attribué explicitement à une ligne stable. Plusieurs paiements d'un même achat ne sont pas plusieurs réalisations économiques. Un paiement carte seul ne prouve pas le gross d'un achat mixte : utiliser les preuves Purchase/Funding existantes.

Matching automatique seulement à unicité bilatérale et evidence complète, sans élargir les critères actuels par simple proximité. Un lien utilisateur peut lever une variance de prix (47 → 47,80) mais pas inventer un propriétaire Canonical, une catégorie ou une temporalité incohérente. Un matching ambiguous reste une suggestion sans remplacement financier certifié. Pour un composite, allocation confirmée par ligne obligatoire ; part non allouée reste diagnostic.

La relation vit dans la couche prospective ; elle n'écrit pas opérations, purchases, legs, imports ou publications. Le réel se corrige uniquement via son owner. Une correction/unlink validée relance la résolution : le fact reste unique dans le total mensuel, la prévision peut redevenir active uniquement si elle représente une intention future distincte explicitement confirmée. Un simple unlink ne doit pas créer arbitrairement une deuxième dépense pour une sortie déjà observée.

Déclaration utilisateur : conserver `DECLARED_REALIZED`, date et prix déclarés ; réservations deviennent usedDeclared comme aujourd'hui. Un vrai fact couvrant remplace ce déclaré et sa réserve. Une date passée sans fact, ou une absence d'import, n'est ni réalisation ni annulation. LOWER_BOUND protège la borne réelle et qualifie le complément (§10), sans obtenir REALIZED complet par simple montant minimum.

## 13. Context → Mobility

**DECISION.** Réutiliser E23/E24 : Context owner de l'intention ; Mobility owner du mouvement. `MobilityIntent` porte Context ; `PhysicalJourneyRequirement` porte ownerIntent et participants ; les composants économiques portent physicalJourneyRequirementId. Relations CERTAIN/MERGE nécessaires ; SIMILAR_ONLY ne fusionne rien.

La feuille transport du Plan utilise le coût du journey comme sa **valorisation**, elle ne conserve pas un prix forfaitaire additif à côté de fuel/fare/toll/parking. Si un composant transport 27 existe déjà, le binding `VALUED_BY_JOURNEY` doit le désigner ; sa valeur devient celle des sous-coûts du journey et son total parent reste explicatif. Une ligne externe de transport liée au journey est déjà utilisée une fois par le resolver actuel ; préserver l'ensemble exact externalCostLineIds.

TARGET ajoute `journeyFulfillment` journey → liste de MobilityLeg IDs/segments couverts, avec sens/outbound/return et preuve explicite. Coût d'usage observé veut dire valorisation estimée par l'owner Mobility d'un déplacement réellement observé : ce n'est pas un prix carburant payé connu. Un aller réel ne supprime pas le retour encore Plan. Dédupliquer les legs par leur ID, quelle que soit la pluralité des Contexts ou participants.

Modifier destination/mode avant préparation/réalisation conserve l'intention de déplacement mais invalide le pricing digest et recalcule le futur. Passer voiture→train supprime fuel futur du même périmètre et substitue le fare train ; pas fuel+fare. Les legs réels anciens et les billets engagés restent protégés. Si aller déjà effectué en voiture, un retour en train est une nouvelle partie future explicite, pas une mutation rétroactive de l'aller. Journey partagé modifié : valider tous les liens compatibles, refuser une modification contradictoire tant qu'ils ne sont pas résolus.

Trajet annulé : futur usage zéro et tombstone ; legs déjà observés conservés. Un débit carburant de 50 € ne réalise **pas** un trajet estimé 27 : achat de carburant et consommation du véhicule sont des autorités distinctes. Cash reflète le débit réel ; consommation Mobility compte 27 dans sa métrique d'usage. Ne pas additionner un refill classé achat de stock comme second coût d'usage du même trajet, ni fabriquer Operation 27. La sélection de la métrique économique mensuelle reste celle des owners existants, pas une somme des deux vues.

## 14. Cost ↔ Funding / wallets

**EXISTING.** CostItemGross = quantity×unitAmount arrondi une fois ; allocations BANK/SWILE/EDENRED sont séparées ; fuel ECONOMIC_ONLY n'en réserve aucune. Purchase gross/funding et wallet balance/ledger sont séparés. E25 calcule disponibilité datée et shortfall ; plusieurs wallets d'un provider ne sont pas silencieusement regroupés.

**DECISION.** Coût restaurant 45, funding Swile 25 et Banque 20 : **économique =45, futur cash bancaire =20, wallet réservé =25**. Aucune somme 45+25+20. Un crédit wallet n'est ni achat ni salaire bancaire. Les ressources économiques actuellement retenues par deriveMonthScenario restent celles de son contrat ; la capacité de stock wallet ne devient pas une deuxième entrée de ressources en plus du chargement déjà prévu.

Pour le payable, allocation complète = somme des montants de sources exactement égale au coût. UNKNOWN funding n'efface pas le coût ; il produit un cash non certifié et fundingToComplete. Le réel d'un achat remplace ses allocations estimées avec `purchase_funding_components` et ses Operations/ledger effectifs ; retire les réservations correspondantes sans créer de débit sur le wallet. Le solde réel as-of inclut déjà ses mouvements : seules obligations de paiement non bookées sont projetées au-delà.

Wallet insuffisant : coût 45, allocation Swile demandée25, capacité prouvée10, Banque choisie20 ⇒ supported wallet10, **fundingToComplete15**, cash déclaré20, financement total non certifié. Ne pas passer automatiquement Banque à35. Une commande explicite réalloue Swile10/Bank35 et recalcule toute capacité. Une absence de date rend la faisabilité datée inconnue ; elle ne force pas une date artificielle. Les caps et dates éligibles viennent de la policy existante, pas de la spec UI.

TARGET : si plusieurs personnes/wallets, allocation identifiée par walletId ; provider et owner dérivés du wallet autorisé. Une allocation Banque peut porter bankAccountId pour un forecast par compte ; ne pas confondre bénéficiaire, participant, payeur et owner wallet. Exemple partagé 45 : wallet Adrien15 + wallet Manon10 + Bank20 =45, une sortie, une contribution. Le forecast générique doit refuser les allocations provider-only ambiguës plutôt que choisir le premier wallet. Les totaux PERSON ne sont additifs entre personnes que si les parts économiques sont explicites et disjointes ; une dimension de participation n'est pas une répartition monétaire.

## 15. Mid-month Plan revisions

**EXISTING.** PlanRevision N est immutable ; N+1 change pointer actif après CAS et conserve parent/changeSet/evidence. Relecture effective compile N avec les autorités actuelles ; CHANGED_AUTHORITIES est légitime et ne réécrit pas evidence figée. Les slots réels non réconciliés sont encore bloqués (E13).

**TARGET / DECISION.** N+1 remplace les **intentions futures non préparées/non réalisées** du même Plan. Il ne modifie aucun fact ni contenu PlannedExpense ; les feuilles préparées sont des overlays indépendants retrouvés par leurs liens, y compris si la feuille disparaît du semanticState N+1. Le Composer doit montrer ces feuilles protégées et offrir une action explicite vers leur owner pour changer/annuler la préparation.

Hôtel réservé142 le 12 : nouveau week-end peut changer restaurant45→30 et activité38→0 si ces parties ne sont pas engagées ; hôtel142 reste. Si activité38 est préparée, sa modification passe par PlannedExpense, jamais par remplacement implicite de la feuille Plan. Un target count/amount inférieur au réalisé+engagé protégé est refusé ; afficher overshoot et permettre une commande « supprimer seulement le futur » ramenant target au floor protégé. Un overshoot survenu par nouveau réel n'est jamais masqué et ne rend pas le fait invalide.

Conserver trois références : **initial = revisionNumber1**, **active = pointer actuel**, **current = scénario dérivé du Plan actif avec overlays et faits au cutoff**. Le premier n'est pas recalculé avec les prix actuels ; utiliser son projectionEvidence/manifest/version. Les changements opérés dans Composer peuvent toujours être comparés à l'intention initiale, même après préparation/réalisation.

Parité = mêmes semanticState, autorités, liens, cutoff civil, versions Compiler/pricing et base revision. Preview=Apply=Immediate Reload sous mêmes inputs ; un fait publié ou une date as-of nouvelle peut changer current, avec raison CHANGED_AUTHORITIES. Étendre digest/evidence aux liens de realization/cancellation/funding, sans exclure leur freshness pour obtenir artificiellement la parité. Un Apply idempotent ancien renvoie sa preuve d'origine, jamais un current reconstruit présenté comme cette preuve.

## 16. Cancellation

**GAP.** REMOVE_CONTEXT laisse l'histoire des révisions, mais sans tombstone métier ; DELETE PlannedExpense supprime sa root prospective. Cela ne couvre pas le contrat transversal de cancellation.

**DECISION.** Persister une décision de cancellation avec source/unit coverage, auteur, instant, raison facultative et version/CAS. Le futur ciblé sort de la projection ; history et source IDs restent. Un montant annulé = zéro applicable avec reason CANCELLED, **pas UNKNOWN**. Un tombstone interdit la résurrection via Baseline, une ancienne préparation, un replay ou un nouveau reload. Réactivation seulement explicite et auditée ; obligations/facts toujours relus.

Annuler un Context sans préparation : annuler feuilles futures et leur capacité individualisée. Avec PlannedExpense : Plan Apply seul ne l'annule pas ; commande coordonnée explicite annule les lignes révocables dans leur owner, conserve source links et résout la projection. Partial cancel exige cancellation par ligne/coverage, pas suppression de root avec enfants réels. Les deletes liés sont interdits sans cette transition ; roots externes non liées peuvent conserver leur parcours legacy jusqu'à son lot de migration, sans réécrire le passé perdu.

Si hôtel142 déjà payé puis week-end annulé : réel142 reste, transport/restaurant/activité futurs zéro. Si réservation non remboursable142 due mais pas payée : coût/obligation142 et cash futur142 restent même si le voyage n'a pas lieu. La commande cancel identifie cette liability ; ne pas l'effacer comme estimation. Si refund50 observé : Canonical net applicable92 (selon sa temporalité) et cash refund50 via owners, pas « cancel=-142 ». Date du refund peut être dans un autre mois. Maturité parent CLOSED_WITH_REALIZED_PART ou obligation retenue, jamais CANCELLED pur.

## 17. After-plan intentions

**DECISION.** Une root créée directement dans Prévoir une dépense garde creationOrigin EXTERNAL_INTENTION, même si elle consomme une enveloppe du Plan. Aucun faux componentId ni sourceRevision ne lui est inventé. Sa relation à l'initial se dérive de membership dans le manifest initial et createdAt : EXTERNAL_PREEXISTING si déjà présente avant l'initial, AFTER_INITIAL_PLAN si créée après ; nouveau Context Plan créé N+1 = ADDED_IN_REVISION. Ces vues ne remplacent pas la provenance détaillée.

Bowling48 ajouté après Apply : contribution current48 supplémentaire si aucune capacité compatible explicitement consommée ; initial0 pour cette unité ; réel ultérieur48 remplace48. Dans la comparaison, afficher « ajouté après le Plan », jamais variance d'un prix initial fictif. Une adoption dans N+1 crée une association `ADOPTS_EXISTING`, pas une matérialisation de ce nouveau composant en une deuxième root. creationOrigin et absence dans initial restent immuables. Une root externe peut exister sans aucun Plan.

## 18. Mois à venir integration

**EXISTING.** E15/E26 : `resolveEffectiveMonthScenario()` est déjà le point d'entrée page, DIRECT_V2 sans Plan et PLAN_V1 avec Plan. `projectMonthControlCenter()` reçoit effectiveScenario/appliedProjection. Ceci est acquis ; ne pas proposer de reconstruire cette intégration depuis zéro.

**GAP / TARGET.** Étendre ce point d'entrée à la résolution par coverage avant l'adapter. Tous les preflights de création/édition/déclaration/report, calendar, details et actions de choix doivent consommer ce même world effectif ; les appels V2 directs restants E27 ne suffisent pas pour un Plan actif. Simulation d'une mutation remplace/exclut la root ciblée et ses liens dans le même world, sans nouveau build par carte. Fallback V2 direct réservé au cas sans Plan et aux compatibilités explicitement validées, jamais en cas de Plan conflictuel.

Vue proposée : résultat existant scenario/projection/revision + `resolutionManifest`, `lifecycleViews`, `authorityIdentity`. La finance vient exclusivement de scenario ; ces vues expliquent la résolution et ne recalculent pas un total. Les calendars montrent les occurrences concrètement datées et un groupe « temporalité souple/à dater » ; ils n'induisent aucun paiement daté depuis le bucket Plan. Parent Context et composants sont une même contribution financière, quelles que soient les représentations visuelles.

API/DTO versionnés et scopes explicites ; les raisons suppression/variance sont exposées par l'owner. React ne recalcule ni remainder, ni balance, ni absorption, ni couverture financière. Les mutations utilisent baseRevisionId + updatedAt des roots + digest des autorités/relations concernés. Une publication analytics n'est pas requise pour une mutation prospective.

## 19. Compare Plan ↔ Maintenant

**TARGET / DECISION.** Comparaison en lecture à partir des autorités existantes : initial evidence N1, evidence d'une active N quelconque, scénario current au cutoff, et facts Canonical effectifs. Aucune table « vérité UI » ni total autonome recalculé depuis cards. Initial61/current74/observed74 ⇒ variance économique +13 ; une éventuelle réserve future d'une autre occurrence est expliquée séparément.

Aligner les unités par component/occurrence IDs et relations d'adoption/succession/couverture ; garder added, cancelled, deferred, prepared et unmatched actual dans des classes explicatives distinctes. Pour les enveloppes anonymes, comparer capacité mensuelle et consommation de catégorie ; ne prétendre aucun matching nominatif absent. Actual sans lien peut figurer en « réel non rattaché » tout en étant déjà inclus une fois dans le résultat financier Canonical.

Ne pas recompilier le Plan initial sous des autorités courantes puis appeler cette valeur « prévue initialement ». Lire projectionEvidence et manifest/version figés ; conserver UNKNOWN initial comme UNKNOWN, pas une variance numérique imaginaire. Les métriques de coût, cash, usage Mobility et wallet consumption ont leurs colonnes propres. Leur comparaison est un lens non additif, aucune entrée vers la projection prospective.

## 20. Anti-double-count matrix — TABLE E

### Croisement complet des sept représentations

**TARGET / DECISION.** Chaque paire peut coexister en stockage/evidence. « Remplace » concerne seulement une contribution de la même unité et dimension ; jamais suppression de l'objet source. Les cellules ci-dessous sont symétriques et couvrent les 21 paires distinctes. B=Baseline, P=Plan, PE=PlannedExpense, Pu=Purchase, O=Operation, M=Mobility, F=Wallet/Funding.

| Paire | Même intention / clé ou relation permettant de le savoir | Contribue / remplace | Provenance / histoire conservée |
|---|---|---|---|
| B/P | Slot scope + slotIdentityKey, ownership manifest | P remplace B pour capacité possédée ; B reste ailleurs | B sourceRefs, snapshot de décision |
| B/PE | baselineKey + scope/person + consumes capacity | PE + B résiduel ; aucun B complet additionnel | B référence habituelle, PE intention explicite |
| B/Pu | Catégorie/slot compatible et facts uniques | Pu réel + capacité B résiduelle par owner | History source de B et fact actuel distincts |
| B/O | Canonical owner/catégorie et mouvement réel | Économique Canonical + résiduel B ; cash sous Banque | O source bancaire, pas estimate Baseline |
| B/M | Domain mobility + legs/journey coverage | Usage réel + résiduel prospectif même métrique ; pas historique + forecast complet | B history/prix ; M movement |
| B/F | Source financière d'une capacité, pas identité de coût | F ne crée pas coût ; limite financement | Evidence stock/loading distincte |
| P/PE | MATERIALIZES component/occurrence + coverage | PE masque P couvert ; P reste non couvert | Source revision/component conservés |
| P/Pu | FULFILLS direct ou via PE + owner effectif | Pu masque P couvert | Plan initial et variance |
| P/O | Réalisation via PE ou FULFILLS economic owner | Économique observé masque coût P ; O paiement séparé | Aucun FK direct O→Plan |
| P/M | VALUED_BY_JOURNEY + journey fulfillment | M valorise/remplace transport P ; aucun deuxième forfait | Context intention ; journey evidence |
| P/F | Allocation attachée à feuille payable | P coût une fois ; F ventilation/capacité | Allocations décision et stock facts |
| PE/Pu | Réalisation ligne/coverage → purchaseEventId | Pu coût effectif, PE futur masqué | Prix préparé/déclaré et variance |
| PE/O | Réalisation ligne → canonicalComponentKey, ou Purchase funding | O économique si owner ; O cash si paiement ; PE reste pour obligations non couvertes | Root/line IDs ; bank dates |
| PE/M | externalExpenseId/externalCostLineIds ou journey link | Ligne transport valorisée par M ou concrete une fois | PE contexte ; M route/legs |
| PE/F | costItem allocation source/wallet ; payable | PE coût une fois ; funding réserve seulement | Reserved/usedDeclared ≠ ledger observé |
| Pu/O | purchase_event_memberships et purchase_funding_components | Pu effective cost ; O bank debit, pas second cost | Unique consumption owner et paiement |
| Pu/M | Relation de transport réellement couverte ; fuel refill n'est pas usage | Fare de l'achat remplace fare prospectif ; usage fuel distinct, pas une somme des lenses | Achat/legs chacun dans sa métrique |
| Pu/F | purchase_funding_components + ledger purchaseEventId | Pu coût ; F paiement/stock | Aucun montant gross recopié en coût wallet |
| O/M | Mouvement bancaire vs usage véhicule, aucune égalité présumée | Cash O ; usage M ; aucun fake O ni matching fuel-refill→journey | Deux domaines distincts |
| O/F | BANK funding operation_id ou ledger externe distinct | Débit réel une fois par source ; F n'ajoute pas coût | Payment ID, couvertures des sources |
| M/F | Fare/toll/parking payable ; fuel ECONOMIC_ONLY | Coût M une fois ; funding des seules parties payables | Fuel sans réservation Banque/wallet |

Dans une même représentation : déduplication par IDs de facts, overlap FULL/partiel refusé, parent/enfant non additifs. Deux Contexts reliés au même journey ne créent pas deux coûts ; deux personnes reliées au même Purchase ne créent pas deux achats. Une part individuelle explicite constitue une partition, pas une deuxième vérité.

### Scénarios chiffrés obligatoires

| Scenario | Representations present | Effective contribution | Suppressed contribution | Reason |
|---|---|---|---|---|
| A — Restaurant Baseline2 → Plan1 | B count2, P count1, u=45, aucune réalisation | **45** pour 1 occurrence | B90 | Plan ownership ; pas 135 |
| B — Restaurant matérialisé | P45, PE47 FULL | **47** | P45 | MATERIALIZES même component ; pas 92 |
| C — Restaurant réalisé | P45, PE47, O économique47,80 FULL | **47,80** ; cash47,80 si Bank seul prouvé | P45 et PE47 | Réalisation confirme variance+0,80 ; pas 94,80 |
| D — Week-end voiture | P transport≈27, M journey≈27 | **≈27 usage**, cash fuel0 prospectif | Forfait P27 comme montant additif | Journey valorise transport, pas 54 |
| E — Mix funding | Restaurant45, Swile25, Bank20 | **45 économique**, **20 cash**, wallet25 | Funding comme coûts supplémentaires | Répartition45=25+20 |
| F — Courses | P MONTH_TOTAL450, réel compatible287, aucun concret futur | **450 projeté =287 réel+163 restant** | P450 en supplément du réel | Amount capacity et floor ; si réel510, projeté≥510 et reste0 |
| G — Composite partiel | Hôtel concrete/real142, transportP27, restaurantP45, activitéconcrete38 | **252=142+27+45+38** | Anciens prix Plan hôtel/activité, total parent | Résolution feuille par feuille |
| H — Count partiel | P2 sorties u45 ; 1 observed47,80, secondeP45 | **92,80** | Estimate45 de la première | Réel consomme 1 occurrence, pas 47,80/45 occurrences |
| I — Paiement partiel | Hôtel engagement142, Bank acompte40 booké | **142 économique** ; **102 cash futur** | Estimate paiement initial142 et débit40 futur | Acompte est funding/payment, pas coût142+40 |
| J — LOWER_BOUND FULL | Observation≥20, estimate concrete47, même unité FULL | **borne≥20, central estimé47** | Total additive67 et faux exact20 | Qualités distinctes ; complément estimé27 explicatif |
| K — Annulation après hôtel payé | Hôtel real142, P transport27/resto45 annulés | **142**, futur0 | P72, anciennes prévisions hôtel | Le réel et history restent |
| L — Ajout Bowling | PE externe48 après initial, puis Pu48 | **48** avant/après réalisation | PE48 lorsque Pu couvre | Initial0 ; provenance AFTER_INITIAL_PLAN |
| M — Deux personnes | Une sortie45, walletA15/walletB10/Bank20 | **45**, une occurrence | Participation comme multiplicateur | Funding partitionné, coûts non dupliqués |
| N — Wallet insuffisant | E, mais capacitéSwile10 | **45** ; cash choisi20 ; gap15 | Conversion automatique gap→cash | Cash total non certifié jusqu'à réallocation explicite |

Les nombres supposent un seul périmètre économique mensuel et des liens certifiés. Sans preuve d'identité, le système n'applique pas silencieusement les suppressions de B/C/G ; il renvoie l'absence de rapprochement ou le conflit, conformément à §10/12.

## 21. Lifecycle diagrams

**TARGET.** Les flèches sont des liens/évolutions de représentation, pas des copies de vérité.

```text
A — Lifecycle simple
BASELINE (dérivé)
  ↓ capacité / référence
PLAN INTENTION (révision immutable)
  ↓ commande explicite ; source feuille + coverage
PLANNED EXPENSE (prévision concrète / déclaration)
  ↓ relation réalisation vers owner Canonical
REAL (Purchase ou Operation économique ; paiements séparés)

B — Context partiellement matérialisé
Context Week-end (parent non additif)
├── Hébergement → PlannedExpense142 → Real142
├── Transport   → Plan / Mobility prospective27
├── Restaurant  → Plan45
└── Activité    → PlannedExpense38
Effective : 252 ; prepared/realized par feuille

C — Funding
Economic cost45
   ↓ allocation, aucun coût supplémentaire
Funding allocation
├── Wallet25 → réserve prospective OU ledger réel
└── Bank20   → paiement futur OU Operation bancaire réelle

D — Precedence (même unité, dimension et coverage)
REAL OBSERVED
  > CONCRETE FORECAST / déclaration
  > PLAN
  > BASELINE
Cancellation explicite : retire le futur, conserve réel/obligations

E — Revision mid-month
PlanRevision N (history/evidence immutable)
   ↓ mois partiellement réalisé/préparé
PlanRevision N+1 (nouvelle intention active)
   ├── future intent libre peut changer
   ├── concrete overlays restent sous PlannedExpense
   └── realized facts restent sous Canonical

F — Mobility
Context → MobilityIntent → Journey unique
                         ├── fuel_usage ECONOMIC_ONLY
                         ├── fare/toll/parking payables
                         └── legs observés par coverage dirigée
Operation carburant ≠ réalisation économique d'un journey
```

## 22. State-transition tables

**TARGET.** Toute transition mutationnelle est autorisée foyer, CAS/idempotente et auditée. Le coût/projection est recalculé par les mêmes owners.

| Objet / from → to | Déclencheur | Écriture autorisée | Effet financier / refus |
|---|---|---|---|
| Draft → applied revision | Apply explicite frais | Une RPC Plan, evidence | Nouvelle intention active, pas de PE automatique |
| Plan feuille → prepared part/full | Commande materialize | PE + source relations atomiques | Masque seulement coverage Plan |
| PE PLANNED → DECLARED_REALIZED | Déclaration utilisateur | Coûts finaux + statut CAS comme aujourd'hui | Même coût à contenu identique, funding usedDeclared ; aucune observation créée |
| PE declared → planned | Restore explicite sans réalisation protégée | Owner PE CAS | Réserve future ; refuse si cela doublerait la même sortie réellement observée |
| Prévision → partial/full observed | Fact admis + fulfillment certifié | Relation prospective uniquement | Coût fact, suppression coverage prévue ; pas d'écriture Canonical |
| Plan N → N+1 | Recomposer futur | Nouvelle révision uniquement | Préparé/réel protégés ; mutation de leurs prix refusée |
| Future actif → cancelled | Commande cancel coverage | Décision tombstone + PE révocable si explicitement ciblée | Futur zéro ; liability/real restent |
| Partial realized → closed_with_realized_part | Annuler reste | Cancel reste, pas facts | Réel retenu, aucun futur résiduel ciblé |
| Cancelled → active future | Réactivation explicite | Nouvelle décision/révision, mêmes IDs si même intention | Ancienne cancellation reste history ; pas résurrection par reload |
| Journey car → train | Éditer futur non protégé | Révision + revalidation pricing/relations | Fare remplace fuel futur, observed car immutable |
| PE moisA → moisB | Report explicite | Owner PE + deferral/source coverage atomiques | A futur0, B contribution unique ; Plan initial A inchangé |
| External PE → adopted in Plan | Association explicite | Révision + ADOPTS_EXISTING | Une root ; origine externe initiale conservée |
| Observed fact → corrected/refunded | Parcours owner Canonical | Hors Plan, owner historique | Projection reflète fact/version/temps corrigés |

Une transition dérivée de maturité n'entraîne pas automatiquement une mutation des statuts persistés. Les transitions vers UNKNOWN/CONFLICT sont des changements de knowledge/evidence, pas des annulations métier.

## 23. Required schema/API changes — PROPOSED ONLY

**TARGET uniquement. Aucun DDL ni code ci-dessous n'est exécuté ou créé dans cette mission.** Les noms physiques sont des propositions de lots, les responsabilités et contraintes sont normatives.

| Changement proposé | Forme / invariants requis | Pourquoi / owner |
|---|---|---|
| Semantic state/manifest version suivante | soft temporal ref ; occurrenceId individualisé ; cancellation/deferral/succession refs ; compat read v1 | Contrat parse strict actuel et SQL state validator à faire évoluer ensemble ; E07/E08/E09 |
| `phase2_plan_materialization_links` | linkId, householdId, originPlanRevisionId, sourceRef discriminée, targetPlannedExpenseId/targetCostItemId, relation MATERIALIZES/ADOPTS_EXISTING, coverage, audit timestamps | Pas de amounts cache. FK révision/foyer et root/foyer ; CostItem/source composant JSONB validés atomiquement ; index household+plan source et target root |
| `phase2_planned_realization_links` | Source XOR ligne PE OU feuille Plan directe ; canonical owner ref typée, coverage/allocation économique, USER_CONFIRMED/EXACT_UNIQUE, evidence, active version | Réutiliser realityLink root pour migration sans doublon ; unique consumption coverage ; pas de FK Plan dans Operation |
| `phase2_journey_fulfillments` | originRevision/journey proof, household, journey ID, leg ID/segment dirigé, coverage, mode/evidence | Pas de copie coût/distance ; index batch journey/legs ; leg partagé ne devient pas plusieurs coûts |
| Lifecycle/audit prospectif | `phase2_planned_expense_events` immutable avec versions source/target, commandes cancel/restore/defer/commitment et contenus nécessaires à l'historique des prix ; tombstones source/coverage ; root CANCELLED seulement si tout révocable annulé | Service PE unique writer ; append audit atomique avec root+liens. Content snapshots sont evidence, pas autorité live ni cache Canonical. Historique des prix concrets ne peut pas être promis avec le seul UPDATE actuel |
| Métadonnées concrètes | creationOrigin immutable, commitmentKind par ligne, sourceRefs/quality des prix/dates ; cancellation partielle dans events/coverage | Ne pas stocker maturity agrégée. Commitment≠declaredObserved ; root active même si une seule partie est due |
| Funding allocation précise | walletId quand plusieurs wallets possibles ; provider/owner résolus ; bankAccountId optionnel si projection par compte | Compat provider-only seulement si choix unique ; pas de personne déduite de participation |
| Read APIs | `resolveEffectiveMonthScenario` étendu ; simulate mutation effective ; read compare evidence ; batch read links/affected revisions | Scénario financier existant réutilisé ; manifest de résolution explicatif |
| Mutation APIs | materialize, link/unlink fulfillment, cancelCoverage, defer, change prepared commitment/funding ; revision-aware | Versions/CAS atomiques, scope autorisé, preflight commun, zéro-write stale ; Apply reste writer Plan |

Le stockage normalisé des liens est préféré à un lien opaque dans `context` : accès par source, unicité de coverage, validation foyer et batch reads doivent être possibles sans scanner tous les JSONB du mois/historique. Le JSONB reste approprié aux intentions/fields existants et aux evidence envelopes. Ne pas créer une table normale par composant évalué pour recopier le manifest.

Précisions de stockage : les liens vers canonicalComponentKey exigent vérification de l'owner physique courant et de son scope, pas une FK directe vers une vue. FK physiques réutilisées lorsqu'elles existent. Pour CostItem dans JSONB, un service/contrôle transactionnel valide ID unique et existence sur version root ; une édition ne peut supprimer une ligne référencée sans transition explicite. Le sourceRef original est immuable ; une adoption ultérieure est une autre relation, pas mutation de création. Les allocations de réalisation portent des parts attestées du fact, **pas des montants observations copiés comme nouvelle vérité**.

Protéger chaque table prospective par household RLS, grants minimaux et contrôle de tous les endpoints liés. Les écritures multi-objets doivent être dans une transaction serveur/RPC ciblée avec relecture/CAS finale et replay de request ID ; le client ne fournit aucun winner, coût dérivé ou evidence arbitraire. Les contrôles overlap/coverage ne peuvent pas se limiter à un preflight JS avant deux INSERT concurrents. Les futurs DDL exigent les procédures et validations humaines du dépôt ; pas de Supabase local/distant reset.

## 24. Changes explicitly NOT required

**DECISION.** Pas de nouvelle vérité financière, table « intention universelle », Plan FK sur operations, nouvelle table calendrier, gross parallèle sur PlannedExpense, fake fuel Operation, copie de mobility legs, assimilation cancellation/UNKNOWN, assimilation declaration/observed, ni nouvelle autorité Baseline persistée.

Pas de changement des ressources/cagnottes réelles lors d'une réserve prospective. Pas de renormalisation des facts selon les cards. Pas de labels Beauté/Restauration qui deviennent des catégories Canonical nouvelles. Pas de changement de batching/concurrence/SQL/fenêtres, cache global, P3 Historical Planning Authority, snapshot historique ou campagne performance. Les evidence snapshots de Plan et de mutations prospectives servent à l'audit, pas à accélérer la lecture Canonical.

R6 n'est pas lancé. Son contrat de consommation est néanmoins verrouillé :

| Node présentation futur | Contenu autorisé | Limite métier |
|---|---|---|
| SimpleCardNode | Capacité simple ou feuille effective avec identity/ref/capabilities | Ne crée aucune dépense par son rendu |
| CompositeContextNode | Context et feuilles/childs, maturités/provenances, montant explicatif | Parent non additif ; préparation indépendante par feuille |
| VisualClusterNode | Collection visuelle de refs existantes, titre/icône/layout | Presentation-only ; pas d'ID économique, count, funding ou lineage autonome |
| ProtectedSavingNode | Réservation existante + capability/flexibility | Gauge/rendu ne libère pas cagnotte ; protection owner maintenue |

R6 consomme les contrats effectivement disponibles, versionnés, et indique les capabilities non disponibles. Il ne simule pas localement les futures fonctions encore absentes. Layout/drag/animations/palette/Clay peuvent suivre dans une mission dédiée après ce lock.

## 25. Migration / implementation batches

**PROPOSED ONLY.** Ordre issu des dépendances du code ; la mission suivante peut être R6 sur cette frontière de présentation. Les lots métier ci-dessous ne sont pas exécutés. Gate générale : facts et révisions immuables, aucune autre authority financière, zero-write stale, budget mini-check §27.

| Lot | Objectif et dépendances | Fichiers/zones probables | Migration future ? | Risques principaux | Tests de gate | Performance mini-check |
|---|---|---|---|---|---|---|
| T0 — Contracts / IDs | Versionner coverage/refs/temporalité/maturity/commitment ; figer stabilité et succession ; dépend de cette spec | domain/phase2/planner/*, planned-contract, parsers + SQL state validator lors activation v2 | Contrats non ; validator oui à activation, sans changer revisions v1 | Instabilité ID, quantity/count mélangés, loss UNKNOWN | TRANS-010/012/013/015/016/018 | Taille DTO/manifest ; aucune lecture nouvelle pour simple parsing |
| T1 — Effective resolution integration | Fournir resolver typé au Compiler/adapters et tous preflights mensuels ; préserver guards observés jusqu'à T3 | effective-month-scenario, compiler, financial-adapter, month-scenario, planned-expenses-actions, month-choices, projections | Non, lire absence de liens comme compat explicite | V2 direct résiduel, facts injectés twice, nouveau moteur | TRANS-001/009/011/014/017/020 | Un world/read par request ; pas build par carte ; counts DTO |
| T2 — Partial materialization / lineage | Matérialiser feuilles/occurrences + liens atomiques ; dépend T0/T1 ; d'abord périmètres non observés certifiés | planned-expenses service, Plan read repo, source-links repo proposé, materialization commands | Oui, source links, occurrence metadata, creationOrigin/commitment | Concurrence overlap, PE orpheline, mauvaise baseline absorption | TRANS-001/006/016/021/022 | Batch source refs/roots ; pas scan historique pour chaque composant |
| T3 — Real reconciliation / residual capacities | Étendre E18 par ligne/coverage ; direct fulfillment ; amount/count réalisés ; lever uniquement guards certifiés ; dépend T1/T2 | planned-observation-reconciliation, prediction evidence, plan-slot-resolver, constraint-engine, adapters, bank-cash | Oui realization links + invariants | Achat mixte, partial amount, scope/person, fact payé sans coût connu | TRANS-002/005/011/014/023/024/025 | Index facts/links une fois par world ; sélecteurs by-ID batchés |
| T4 — Mid-month / cancellation / deferral | Overlay protégé, audit prospectif, tombstones, report lié intermois ; dépend T2/T3 | apply/change-set, semantic-mutations, draft reader, planned-expenses report/delete/restore | Oui events/cancellation/version validators | Disparition engagé/réel, résurrection baseline, multi-objet non atomique | TRANS-005/007/008/019/026/027/028 | Origines pertinentes seulement, pas lecture de toutes révisions |
| T5 — Mobility lineage | Journey valuation explicite + directed observed fulfillment ; dépend T0/T1/T3/T4 | journey-resolver, mobility-compiler/pricing, mobility adapters/repositories | Oui relation fulfillment ; pas colonnes de coût dupliqué sur legs | Shared legs, car/train, aller seul, refill/usage | TRANS-003/029/030/031 | Batch legs par ID, index M7 existant préservé, reprice seulement affected |
| T6 — Funding / wallets | Allocation par wallet + payments coverage ; dépend T1/T2/T3 ; compat provider unique maintenue | benefit-wallet-funding, planned money/contracts, purchase funding evidence, bank-cash | Oui si validation JSON/funding précise évolue ; aucune nouvelle authority wallet | Daily cap, time unknown, multi-owner, bank fallback caché | TRANS-004/013/032/033/034 | Une projection capacité/owner, pas requête par allocation |
| T7 — Plan ↔ Maintenant | Compare immutable initial/active/current/real, added/deferred/cancelled ; dépend T3/T4, compléter dimensions après T5/T6 | Plan read repo, query/read model compare proposé, projection evidence | Non ; N1 par index existant | Recalcul initial avec prix actuels, lens re-additif, hidden UNKNOWN | TRANS-008/010/035/036 | Lecture initial + active + origines nécessaires, pas history scan |
| T8 — End-of-month analytics | Lecture des résultats/couvertures clôturées, variance et non réalisation ; dépend T7 et gates owners | Analytics/query publications existantes, exports synthétiques | Seulement si extension contractuelle démontrée | Transformer intentions non observées en facts, influer cutoff historique | TRANS-005/010/011/037 | Publication/batching existants ; pas P3 lancé par défaut |

Les lots T5/T6 peuvent avancer après leurs gates sans bloquer un R6 de présentation. Aucun lot ne contourne les refus actuels avec un fallback silencieux ; feature flags/capabilities empêchent l'ouverture des parcours non certifiés. Une migration future exige d'abord inventaire distant actuel, ciblage et validation humaine conformément à AGENTS.md ; ce document ne constitue pas son autorisation.

## 26. Required tests / invariants

**TARGET tests à implémenter dans leurs lots.** Fixtures synthétiques, oracle indépendant du montant recalculé et assertions de graph/coverage/evidence/CAS en plus du total. Tests existants utiles : kernel/context/mobility/PlannedReality/wallet/temporal/parity, réutilisés sans en faire des preuves de features absentes.

| ID | Invariant / oracle de gate |
|---|---|
| TRANS-001 | P45 matérialisé PE47 ⇒47, jamais92 ; mêmes IDs/sourceRefs gardés |
| TRANS-002 | PE47 réalisé par owner Operation47,80 ⇒47,80 ; aucune réserve47 restante sur cette coverage |
| TRANS-003 | TransportP27 valorisé journey27 ⇒27 ; aucun coût27 additionnel |
| TRANS-004 | Restaurant45/Swile25/Bank20 ⇒45 économique/20 cash/25 wallet |
| TRANS-005 | N+1 ne modifie aucune ligne fact réelle ni evidence N/N1 ; réel supérieur au target conservé |
| TRANS-006 | Hôtel142/transport27/resto45/activité38 partiellement préparés ⇒252, overlays par feuille |
| TRANS-007 | Cancel futur ⇒0 pour unités ciblées, history/tombstone gardés ; count2→1 garde1 unité anonyme, pas0 ; reload/replay ne ressuscitent pas |
| TRANS-008 | Bowling48 externe après initial ⇒initial absent/current48 ; adoption N+1 conserve origine |
| TRANS-009 | Preview=Apply=Immediate Reload : scenario, projection, IDs, manifest, provenance, relations et readiness sous mêmes autorités |
| TRANS-010 | UNKNOWN/LOWER_BOUND/CONFLICT/completeness/sourceRefs/provenance conservés aux boundaries, pas null→0 |
| TRANS-011 | Même unité/coverage ⇒une contribution ; Purchase et Operations liées ne dupliquent pas ; parents/children exclusifs |
| TRANS-012 | Plan-only estimable n'est pas déclaré incomplete à cause de sa maturité ; cash inconnu qualifié séparément |
| TRANS-013 | Provenance PLAN après préparation/réalisation ; maturity indépendante ; declaration n'est pas observed |
| TRANS-014 | REAL>CONCRETE>PLAN>BASELINE sous identité+dimension+coverage équivalentes ; unrelated jamais écrasé |
| TRANS-015 | Prix/quantité/date changés, ID conservé ; changement socket protégé refuse ou succession attestée, jamais hash de montant |
| TRANS-016 | Count2 dont une occurrence réelle47,80 ⇒count restant1 et total92,80 àu45 ; quantity repas≠participants≠count |
| TRANS-017 | Preflight PE avec Plan actif égale scénario effectif ; aucune simulation V2 directe concurrente |
| TRANS-018 | Soft WEEK_2 sans date ne devient pas un ISO day ; date réelle remplace seulement temporalité couverte |
| TRANS-019 | Prepared hotel protégé absent de N+1 reste142 ; l'owner PE doit modifier son engagement explicitement |
| TRANS-020 | DIRECT_V2 sans Plan strictement compatible ; Composer flag false conserve Plan appliqué |
| TRANS-021 | Double materialization concurrente FULL : une root+liens, replay exact ou conflict zero-write ; pas orphan root |
| TRANS-022 | Coverage partielle unités disjointes ; overlaps/full+partial excess refusés ; round cents stable |
| TRANS-023 | Ambiguity bilatérale matching, composite multi-facts, lien autre foyer : aucune réalisation silencieuse |
| TRANS-024 | Purchase45 funding25+20 remplace Operation bank20 comme coût ; garde le débit20 en cash |
| TRANS-025 | LOWER_BOUND20 sur coût estimé47 FULL ⇒borne20/central estimate47, jamais67 ou exact20 ; inconnus bloquent certif |
| TRANS-026 | Cancel après real142 ou liability142 garde142 ; refund50 via Canonical, pas cancel négatif fictif |
| TRANS-027 | ReportA→B lié ⇒A futur0/B unique ; origin revision A immutable, walletsB revalidés |
| TRANS-028 | Correction/unlink d'un lien observé garde fact unique ; restore ne fabrique pas une seconde sortie |
| TRANS-029 | Aller réel/retour prospectif : seul aller remplacé ; directed legs dedupés |
| TRANS-030 | Voiture→train : fuel futur retiré/fare ajouté, prix stale refusé ; observed car inchangé |
| TRANS-031 | Deux Contexts/deux personnes un journey ⇒une somme legs ; fuel refill jamais fulfillment de trajet |
| TRANS-032 | StockSwile10 pour allocation25/Bank20 ⇒gap15, cost45 ; pas fallbackBank35 sans commande |
| TRANS-033 | Wallet connu seulement avant loading/date/cap : interdit utilisation prématurée ; sans date feasibility UNKNOWN |
| TRANS-034 | Deux wallets même provider : walletId obligatoire ; shares disjointes, coûts household uniques |
| TRANS-035 | Compare initial61/current74/actual74 ⇒+13 ; added48 initial absent ; compare ne change pas scenario |
| TRANS-036 | Autorités changées entre preview/apply ⇒zero-write stale ; reload après publication ⇒CHANGED_AUTHORITIES, pas faux EXACT |
| TRANS-037 | Mois clôturé : aucune intention non observée transformée en fact ; analytics conserve unknown et source version |
| TRANS-038 | Scope household/person et currencies/unit/coverage incohérents refusés sur tous les liens et commands |
| TRANS-039 | Source event journal immutable et CAS root+relations : prix concrets initiaux/histoire cancellation consultables sans autorité financière parallèle |
| TRANS-040 | Groceries MONTH_TOTAL450/observé287 ⇒163 encore prévu ; réel510 ⇒pas target510 écrasé à450 |

### Red Team du contrat (revue documentaire, pas tests de features livrées)

| Cas exigé | Réponse unique que le futur agent doit appliquer | Règle / résultat |
|---|---|---|
| 1 Baseline restaurants réduite | Remplacer capacité, pas ajouter Plan | A :1×45=45 (§10/20) |
| 2 Plan restaurant préparé | Overlay FULL leaf | B :47 (§11) |
| 3 Réel supérieur au prévu | Réel effectif remplace, variance conservée | C :47,80 (§12) |
| 4 Week-end partiellement préparé | Winner par composant, parent non additif | G :252 (§10/11) |
| 5 Week-end modifié après hôtel réservé | Hôtel142 protégé, autres futurs modifiables selon leurs owners | §15 ; aucun effacement implicite hôtel |
| 6 Annulé après paiement partiel | Garder coûts/obligations réels, annuler futur non engagé ; acompte n'est pas forcément coût total | §10/16 ; total142 si hôtel142 connu/payé/engagé, cash pending102 si acompte40 |
| 7 Visite famille Mobility | Unique journey valorise transport, Context owner intent | D :≈27 (§13) |
| 8 Voiture remplacée par train | Substitution futur, legs anciens protégés | §13 ; fare seul pour futur couvert |
| 9 Swile partiel restaurant | Cost et funding colonnes séparées | E :45/25/20 (§14) |
| 10 Wallet insuffisant | Gap explicite, pas allocation Bank inventée | N :cost45/gap15/cash choisi20 (§14) |
| 11 Dépense après Plan | Origine externe et absence initiale conservées | L :48, initial absent (§17/19) |
| 12 Nouveau Plan après faits | Overlays real/concrete protégés ; remplacer seulement futur libre | §15 ; refus actuel conservé jusqu'au gateT3 |
| 13 Deux personnes partageant | Une sortie/journey, funding par owners distincts | M :45 une occurrence (§6/14) |
| 14 UNKNOWN/incomplet | Pas zero implicite ni cancellation ; borne/estimation distinguées | J ; remainder null si aucun estimate compatible (§7/10) |
| 15 Reload après Apply | Même evidence si autorités identiques ; raison explicite si elles avancent | §15 ; TRANS-009/036 |

Revue additionnelle : acompte contre coût total, count contre quantity, annulation de liability non payée, origine adoptée après initial, report intermois, déplacement d'ID lié, refunds et achat mixte. Leurs réponses sont fixées dans §6/10–17 ; aucune ne requiert une seconde vérité financière.

### Vérifications réellement exécutées pendant cette mission

| Commande locale | Résultat observé au HEAD audité |
|---|---|
| `node scripts/check-phase2-planner-contexts.mjs` | PASS, 29 oracle groups, PostgreSQL embarqué éphémère/fixtures synthétiques ; pas Supabase local |
| `node scripts/check-phase2-planner-mobility.mjs` | PASS, 37 oracle groups, pricing/route/shared/directions/zero-write et roundtrips synthétiques |
| `node scripts/check-phase2-planned-reality.mjs` | PASS, C7 REAL-01..07, CAS/idempotence, coûts déclarés, reserved/usedDeclared, report/restauration/suppression, historical zero-write ; harness mémoire |
| `node scripts/check-phase2-planner-kernel.mjs` | FAIL après 37 groupes PASS, `KERNEL-WORLD-READERS` ligne183 : fixture compare `options.forecast` résolu à `published`, reçoit Promise depuis world-reader ligne30 |

Cet échec est présent sur le code non modifié : l'oracle de reader n'a pas suivi le contrat Forecast-or-Promise explicite de `readPlanningBaselineSources` depuis l'orchestration P2-D. Il faut faire évoluer cet oracle dans une tâche dédiée en vérifiant admission de génération/priorité d'erreurs, plutôt que retirer le démarrage anticipé des sources. La suite complète kernel n'est **pas** déclarée PASS ; ses groupes après l'échec n'ont pas été exécutés. Aucun fichier de test n'a été corrigé ici. Les passages de parité avant l'échec et les suites Context/Mobility sont des preuves délimitées, pas une certification du Plan→Réel cible.

Les suites wallet/temporal/parity générales, typecheck/build et benchmarks ne sont pas relancés dans cette passe documentaire. Aucun runner V1, aucune DB distante, aucun service local Supabase ou publication n'est lancé. Les runners choisis ne produisent pas de rapport de fichier sans opt-in ; status final vérifie le périmètre.

Contrôles documentaires exécutés : ordre exact des 29 sections, parsing JSON du handoff, 64 liens relatifs existants, 40 IDs TRANS distincts et clôture des code fences. `git diff --check` et `git diff --no-index --check -- NUL <spec>` ne signalent pas d'erreur de whitespace ; le diff no-index présente le seul document créé. HEAD/branche identiques ; `git diff --name-only` vide pour fichiers tracked et `git ls-files --others --exclude-standard` contient uniquement la spec. `git status` final : branche main, uniquement `?? docs/status/planning-transverse-product-spec-2026-10-07.md`, aucune modification préexistante ou produit.

## 27. Performance considerations

**DECISION.** Maintenir le checkpoint E02 : phase CLOSED_FOR_NOW, final target non atteint. Le coût connu ne justifie pas de modifier les contrats ou de retirer des preuves. Valeurs historiques : 291 GET Composer Next, DTO273000 bytes, IN économique120/concurrence3, autres IN100/pagination1000. Ces chiffres ont des scopes différents et ne s'additionnent pas en wall-clock.

Lire les liens du foyer/mois et origins nécessaires par relation directe, puis indexer par source/target/canonicalRef dans un build. Pas requête par component, wallet allocation, card ou journey ; pas nouvelle reconstruction du world par objet. Conserver fenêtres, admission de génération, temporal parsing memo local et presence index exact existants. Any fieldset nouveau doit ajouter explicitement les colonnes réellement nécessaires et son guard, sans retour à SELECT* Operations by-ID.

Le resolver groupe par identity/coverage via Maps et arrays triés stables ; coût attendu O(n + liens) hors résolution des partitions locales, documenter les bornes de coverage pour éviter O(n²) sur tous les candidates. Matching confirmé utilise IDs directs ; matching exact candidate indexé par critères requis, pas scan historique complet pour chaque intention. Pas cache cross-request implicite ni précompute P3. La révision initiale se lit directement par planId/revisionNumber1, sources via IDs stockés, pas historique intégral des versions.

Après chaque gros lot : au maximum trois ouvertures directes comparables, compter GET, taille DTO et un guard métier pertinent. Comparer même runtime/machine/month/dataset/cutoff/état ; distinguer volume justifié et régression. Triggers historiques : TTI durable +25% ou +3s ; readWorld/RSC +25% ou barrière≥1s ; GET≥10% ou payload≥20% sans justification ; N+1/duplicate-world/O(n²) massif structurel. Pas nouvelle campagne pour une variation isolée ; confirmer un trigger avant investigation ciblée. Les contraintes de fraîcheur/CAS priment sur un gain de cache conjectural.

## 28. Open questions, if any

```ini
OPEN_QUESTIONS_COUNT = 0
BLOCKING_OPEN_QUESTIONS_COUNT = 0
```

Les arbitrages métier requis sont fermés par les DECISION de ce document. Les éléments restant à vérifier ne sont pas des règles métier indécises : état du schéma distant avant chaque future migration, compatibilité des grants/DDL physiques, résultats des futurs gates, et adaptation de l'oracle kernel existant. Le repository ne contient pas tout le DDL historique ; cette passe ne prétend pas certifier un inventaire Supabase live.

Risques avant R6 : représenter à tort `DECLARED_REALIZED` comme observé, sommer gross Context et enfants, cacher les refus d'owned observed slots, transformer clusters en modèle métier, ou afficher COMPLETE quand cash/timing ne sont pas certifiés. R6 doit consommer capabilities/diagnostics actuels et cette frontière, sans activer les lots futurs. Risque de validation connu : suite kernel entière rouge pour l'oracle décrit §26 ; le traiter avant de présenter une certification globale au prochain gate.

## 29. Machine-readable handoff

```json
{
  "contract": "planning-transverse-product-spec@2026-10-07",
  "TRANSVERSE_PRODUCT_SPEC_STATUS": "PASS",
  "STATUS_SCOPE": "DOCUMENTARY_CONTRACT_ONLY",
  "REPO_ROOT": "C:/Users/Manon/Documents/Codex/2026-09-28/ve/work/Budgetisation",
  "BRANCH": "main",
  "HEAD_BEFORE": "8067d7624ed169a1c271f661f94cc171d0c8ed5f",
  "HEAD_AFTER": "8067d7624ed169a1c271f661f94cc171d0c8ed5f",
  "WORKTREE_WAS_CLEAN_AT_START": "YES",
  "PREEXISTING_CHANGES_PRESERVED": "YES",
  "PREEXISTING_CHANGES": [],
  "PRODUCT_CODE_CHANGED": "NO",
  "DB_MIGRATION_CREATED": "NO",
  "R6_STARTED": "NO",
  "SPEC_FILE": "docs/status/planning-transverse-product-spec-2026-10-07.md",
  "SPEC_IS_SELF_CONTAINED": "YES",
  "EXISTING_AUTHORITIES_AUDITED": ["Canonical", "Bank/Operation", "Purchase", "Mobility", "Wallet/Funding", "Resources", "Savings", "Baseline", "Plan/Draft/Revision", "Compiler", "PlannedExpense", "MonthScenario/Projection", "Publication"],
  "IDENTITY_CONTRACT_LOCKED": "YES",
  "LINEAGE_CONTRACT_LOCKED": "YES",
  "PRECEDENCE_LOCKED": "YES",
  "ANTI_DOUBLE_COUNT_LOCKED": "YES",
  "PARTIAL_MATERIALIZATION_LOCKED": "YES",
  "MOBILITY_LINKAGE_LOCKED": "YES",
  "FUNDING_CONTRACT_LOCKED": "YES",
  "MID_MONTH_REVISION_LOCKED": "YES",
  "OPEN_QUESTIONS_COUNT": 0,
  "BLOCKING_OPEN_QUESTIONS_COUNT": 0,
  "IMPLEMENTATION_BATCHES_PROPOSED": ["T0 Contracts/IDs", "T1 Effective resolution", "T2 Partial materialization/lineage", "T3 Real reconciliation", "T4 Revision/cancellation/deferral", "T5 Mobility", "T6 Funding/wallets", "T7 Compare Plan/Now", "T8 End-of-month analytics"],
  "EXISTING_SUITE_RESULTS": {"contexts": "PASS_29_GROUPS", "mobility": "PASS_37_GROUPS", "planned_reality": "PASS", "kernel": "FAIL_WORLD_READER_ORACLE_PROMISE_AFTER_37_PASS"},
  "TARGET_FEATURES_IMPLEMENTED": "NO",
  "REMOTE_BUSINESS_WRITES": 0,
  "PERFORMANCE_PHASE": "CLOSED_FOR_NOW",
  "NEXT_RECOMMENDED_STEP": "R6 presentation using this semantic lock; adapt kernel reader oracle before global recertification; implement T0-T8 in separate authorized batches",
  "CREATED_FILES": ["docs/status/planning-transverse-product-spec-2026-10-07.md"],
  "MODIFIED_EXISTING_FILES": [],
  "FINAL_GIT_STATUS": "?? docs/status/planning-transverse-product-spec-2026-10-07.md"
}
```

Sortie attendue : un seul document non committé, diff de contenu documentaire vérifié séparément car Git n'affiche pas les fichiers untracked dans `git diff` standard. Aucun git add nécessaire pour la mission ; le document est disponible dans le corpus canonique existant.
