# A. Verdict

`CANONICAL_CONTRACT_GATE = PASS`

`CANONICAL_IMPLEMENTATION_GATE = PASS`

Les trois contrats prioritaires du document `Contrats_Canonical_Manquants_History_V2.docx` sont compatibles avec le repository réel sans changer leur grain, leur ordre d’autorité, leurs états `UNKNOWN/PARTIAL/CONFLICT` ni leurs interdictions d’inférence. Leur implémentation est additive. Les migrations sont prêtes et les chemins Canonical/Facts sont branchés, mais aucune migration ni aucun backfill n’a été appliqué au Supabase live dans ce lot.

# B. Mini-plan qui a été suivi

1. Vérifier le modèle live en lecture seule et le comparer au contrat et au rapport `01-plan-architecture-validation.md`.
2. Remplacer, avant toute application live, la migration Purchase Event incomplète et encore non appliquée.
3. Ajouter deux structures server-only ciblées : classifications par composante/axe et assertions de continuité par instance.
4. Garder les builders Analysis V1 et `sourceAwareEconomicDimensions()` inchangés ; exposer des résolutions V2 séparées.
5. Brancher les loaders dans `CanonicalRepository`, puis dans `FactSourceResolver` sans créer de resource Query V2.
6. Tester les invariants purs, les contraintes SQL, les non-régressions V1, le typecheck et le build.

# C. Fichiers modifiés

| Fichier | Rôle et modification | Raison |
|---|---|---|
| `supabase/migrations/20260822000000_purchase_event_identity.sql` | Remplacement du brouillon non appliqué par l’identité, les memberships, les assertions temporelles, contraintes, RLS, grants et garde Household. | Le brouillon imposait à tort `operation_id` comme propriétaire unique universel et ne portait ni timing ni composantes. |
| `supabase/migrations/20260830090000_economic_component_classifications.sql` | Table d’assertions `canonicalComponentKey × axis`, états, autorité, preuves et provenance. | Permettre l’override axe par axe sans dupliquer les dimensions source existantes. |
| `supabase/migrations/20260830091000_life_event_continuity_assertions.sql` | Qualification de continuité au grain `life_event_id`. | Porter l’assertion instance sans changer la doctrine des types d’événement. |
| `src/analytics/facts/purchase-event.ts` | Résolveur temporel par rang d’autorité. | Isoler et tester la doctrine `DAY/MONTH/UNKNOWN/CONFLICT`. |
| `src/analytics/facts/component-classification.ts` | Types et résolution des trois axes. | Bloquer les fallbacks heuristiques et préserver `UNKNOWN`. |
| `src/analytics/facts/continuity.ts` | Fact de continuité et limite d’application à `EXPLICIT_CONTINUITY`. | Rendre la donnée récupérable par le futur moteur sans modifier Calendar. |
| `src/analytics/facts/types.ts` | Extension de `PurchaseEventFact` : memberships, montant dérivé, timing et provenance. | Compléter le contrat Fact. |
| `src/analytics/facts/validation.ts` | Validation stricte des nouvelles formes et combinaisons temporelles. | Refuser les états structurellement incohérents. |
| `src/analytics/facts/canonical.ts` | Projection Purchase Event, somme des composantes et lecture des assertions. | Construire le Fact depuis les seules données canoniques. |
| `src/analytics/facts/index.ts` | Exports publics des trois contrats. | Les rendre accessibles aux couches serveur futures. |
| `src/server/canonical/repository.ts` | Loaders Purchase Event, classification et continuité. | Raccorder les structures Supabase aux Facts sans modifier V1. |
| `src/server/analytics/fact-source-resolver.ts` | Méthodes V2 et résolution temporelle de `purchase_count`. | Rendre les Facts consommables par la couche Analytics, sans Query V2. |
| `scripts/check-history-v2-canonical-contracts.mjs` | Tests ciblés du lot. | Prouver les invariants métier et SQL. |
| `scripts/check-live-runtime-regressions.mjs` | Fixture Minimal remise au contrat actuel `plannedActivityDays`. | Le contrôle V1 était cassé par un ancien nom de champ ; le moteur n’a pas été modifié. |
| `package.json` | Commande `check:history-v2-canonical` ajoutée à `verify`. | Pérenniser le gate. |
| `docs/history-v2/02-canonical-missing-data-report.md` | Présent rapport. | Trace de sortie du lot. |

# D. Migrations / Supabase

## État live lu en lecture seule

- Projet inspecté : `ipuuhxrblxormwgoaqnz`.
- Les relations `purchase_events`, `purchase_event_memberships`, `purchase_event_timing_assertions`, `economic_component_classifications` et `life_event_continuity_assertions` sont absentes du live.
- La migration locale Purchase Event `20260822000000` n’est pas enregistrée dans l’historique live ; elle pouvait donc être remplacée avant application sans migration corrective supplémentaire.
- Les migrations live observées restent `20260824231804`, `20260825002850` et `20260825105100`.

## Structures et intégrité préparées

- `purchase_events` : identité UUID opaque, Household et provenance.
- `purchase_event_memberships` : cinq sources possibles, rôle `CONSUMPTION_COMPONENT` ou `EVIDENCE_SOURCE`, clé composante générée et ownership unique des composantes de consommation.
- `purchase_event_timing_assertions` : rangs autorisés, précision `DAY/MONTH`, preuves obligatoires, aucun rang bancaire.
- `economic_component_classifications` : une ligne unique par Household, composante et axe.
- `life_event_continuity_assertions` : une ligne par instance Life Event.
- Les memberships Purchase Event utilisent une FK composite `(purchase_event_id, household_id)`.
- Une garde `private.assert_history_v2_household_scope()` refuse tout Household différent du scope canonique `READY` et univoque.
- RLS activée ; droits `anon` et `authenticated` révoqués ; droits explicites réservés à `service_role`. Aucune écriture navigateur n’est ouverte.

## Application

- Écriture Supabase live : **NONE**.
- Migration appliquée : **NONE**.
- Backfill live appliqué : **NONE**.
- À appliquer ultérieurement, après validation humaine : les trois migrations, puis seulement les imports d’assertions explicitement autoritaires.

# E. Purchase Event

## Implémentation réelle

- L’identité est stable, opaque et Household-scoped.
- Une opération peut fournir plusieurs composantes réparties entre plusieurs Purchase Events ; l’opération n’est pas l’identité universelle.
- Une composante avec le rôle `CONSUMPTION_COMPONENT` ne peut avoir qu’un propriétaire Purchase Event grâce à l’index partiel unique.
- Le montant du Fact est la somme des `net` des `fct_economic_component` liés. Aucun montant parallèle n’est stocké.

## Temporalité

Ordre effectivement encodé :

1. `EXPLICIT_EVENT` ;
2. `EXPLICIT_CONSUMPTION_SOURCE` ;
3. `TRUSTED_PURCHASE_SOURCE` ;
4. `ECONOMIC_MONTH` ;
5. aucune assertion : `UNKNOWN`.

Le premier rang non vide est seul comparé. Un jour unique donne `KNOWN/DAY`. Plusieurs jours du même mois donnent `CONFLICT/MONTH`. Plusieurs mois donnent `CONFLICT/NONE`. Un mois seul donne `PARTIAL/MONTH`. `BANK_DATE_FALLBACK` n’existe ni dans les autorités TypeScript ni dans les contraintes SQL.

## Repository / resolver

- `CanonicalRepository.loadPurchaseEvents()` lit l’identité, les memberships, les assertions actives et les composantes économiques, puis projette le Fact.
- `FactSourceResolver` sélectionne les Purchase Events par `economicMonth`, expose une couverture partielle si des événements restent sans mois et refuse honnêtement les filtres/subjects non représentables.

## Backfill et historique

- Composantes économiques inspectées : **1 484**.
- Identités Purchase Event autoritaires présentes : **0**.
- Purchase Events créés/backfillés : **0**.
- Composantes automatiquement clusterisées : **0**.
- Les regroupements marchand/date/montant/libellé n’ont pas été utilisés.
- Les futurs événements sans assertion temporelle resteront `UNKNOWN`; les mois seuls resteront `PARTIAL`; les assertions contradictoires resteront `CONFLICT`.

# F. Classification composante

## Représentation et résolution

- Grain : `canonicalComponentKey × axis`.
- Axes indépendants : `NECESSITY`, `BEHAVIOR`, `LIFE_SCOPE`.
- Valeurs V2 : `Indispensable/Contraint/Optionnel`, `Fixe/Variable`, `Vie courante/Hors quotidien`.
- Résolution : assertion explicite, source composante autoritaire, fallback opération sûr, puis `UNKNOWN`.
- `Contrainte` et `Optionnelle` sont normalisés grammaticalement vers les libellés du contrat. `Ajustable` n’est pas réinterprété et reste non résolu en V2.
- Une assertion `CONFLICT` reste `CONFLICT`; aucune majorité, catégorie, marchand, composante sœur ou répartition proportionnelle n’est consulté.

## Inventaire live read-only

- Opérations : **1 660**.
- Composantes économiques : **1 484** (`Operation 1 396`, `Allocation 34`, `Item 13`, `Payment_component 1`, `Cash_use 40`).
- Opérations `operation_mixte=true` : **14**, représentant **54** composantes.
- Composantes mixtes directement résolues par source : necessity **19**, behavior **40**, lifeScope **36**.
- Composantes mixtes restant honnêtement non prouvées : necessity **35**, behavior **14**, lifeScope **18**.
- Opérations prouvées mixtes par valeurs normalisées : necessity **1**, behavior **0**, lifeScope **4**. Pour les autres axes marqués mixtes mais incomplets, le fallback est bloqué par prudence.
- Conflits persistés actuels : **0**, car la table d’assertions n’est pas encore appliquée.
- Lignes persistées par backfill : **0**. Les valeurs déjà portées par les tables source sont résolues à la lecture afin d’éviter une seconde source de vérité.

# G. ContinuityQualifier

- Représentation : `life_event_id`, Household, état, qualifier, autorité, preuves et provenance.
- Chargement : `CanonicalRepository.loadLifeEventContinuity(range)` retourne une ligne Fact pour chaque instance ; l’absence d’assertion produit `UNKNOWN`.
- `CONTINUOUS` et `NOT_CONTINUOUS` ne sont retournés que pour `KNOWN`; les contradictions structurées peuvent porter `CONFLICT`.
- `continuityForSpanBehavior()` ignore cette qualification pour `AUTO_CONTINUOUS` et `POINT`; seul `EXPLICIT_CONTINUITY` la consulte.
- `startDate != endDate` et l’ancien `spanningEvent` ne sont jamais lus comme preuves.

Inventaire live read-only :

- Life Events candidats : **922**.
- Assertions structurées autoritaires : **0**.
- Backfillés : **0**.
- Restant `UNKNOWN` : **922**.
- `CONFLICT` : **0**.
- Provenance de backfill utilisée : **NONE**.

# H. Données différables

`Contacts externes = DEFERRED`

`Moment media = DEFERRED`

`Recurring stable objects = DEFERRED`

Le core History V2 peut continuer sans ces données : aucune des trois nouvelles Facts ne les requiert, et aucune valeur factice n’a été ajoutée.

# I. Tests

| Commande | Résultat |
|---|---|
| `node --experimental-strip-types scripts/check-history-v2-canonical-contracts.mjs` | PASS |
| `node scripts/check-architecture-imports.mjs` | PASS — 433 fichiers |
| `node scripts/check-product-completeness.mjs` | PASS — 7 surfaces, 2 routes futures |
| `node --experimental-strip-types scripts/check-analysis-month-contracts.mjs` | PASS |
| `node scripts/check-analysis-global-contracts.mjs` | PASS |
| `node scripts/check-canonical-in-batching.mjs` | PASS |
| `node scripts/check-analytics-materialization.mjs` | PASS |
| `node scripts/check-calendar-day.mjs` | PASS |
| `node scripts/check-exploration-entities.mjs` | PASS |
| `node scripts/check-live-runtime-regressions.mjs` | PASS après correction de sa fixture obsolète |
| `tsc --noEmit` | PASS |
| `next build` | PASS — compilation, TypeScript et 6 pages statiques |

Le test du lot couvre : identité stable, Household, ownership unique SQL, `DAY`, `MONTH-only`, `UNKNOWN`, `CONFLICT`, absence de fallback bancaire, montant dérivé, axes indépendants, override, fallback homogène, refus sur mixte, `UNKNOWN`, `CONFLICT`, et tous les cas de continuité requis.

# J. Non-régression V1

- Aucun fichier de snapshot History V1 n’est modifié.
- Aucun oracle, manifest ou hash certifié n’est modifié.
- `sourceAwareEconomicDimensions()` reste inchangé et continue d’alimenter les builders Analysis V1.
- Actual, Typical, Minimal, Calendar, Query et React ne sont pas refactorés par ce lot.
- Les checks Analysis Month, Analysis Global, Analytics materialization, Calendar/Day, Exploration/Entities et runtime live synthétique passent.
- Le build de production passe.
- Aucune prétention de recertification live `1536/1536` n’est faite : ce lot ne modifie ni les sources V1 de ces résultats ni leurs snapshots.

# K. Nouvelles choses apprises

- La migration Purchase Event locale était un brouillon non appliqué au live ; la remplacer était plus sûr que superposer une migration corrective.
- Le canonique financier expose déjà les cinq grains `Operation`, `Allocation`, `Item`, `Payment_component` et `Cash_use` via `canonical_component_key`.
- Les tables financières historiques ne portent pas toutes directement `household_id`; le repository s’appuie déjà sur `canonical_household_scope_control`. La même garde est donc utilisée pour les nouvelles écritures.
- L’inventaire normalisé des 14 opérations mixtes distingue le marquage global `operation_mixte` de la mixité effectivement prouvée axe par axe.
- `Ajustable` existe encore dans les données historiques mais n’appartient pas au contrat necessity V2 à trois valeurs.
- La fixture runtime Minimal utilisait encore `activityOccurrences` alors que le contrat serveur actuel exige `plannedActivityDays`.

# L. Dette / risques restants

- Les migrations doivent être appliquées et validées humainement avant toute lecture live des nouvelles tables.
- Sans identités Purchase Event explicites, `purchase_count` ne peut pas être produit honnêtement sur l’historique ; aucune heuristique de secours n’est prévue.
- Les 922 Life Events restent `UNKNOWN` tant qu’aucune source structurée de continuité n’existe.
- Les classifications mixtes incomplètes restent volontairement `UNKNOWN`; leur complétude nécessite des assertions composante par composante et axe par axe.
- Le repository est actuellement mono-Household au niveau canonique ; la garde doit être réévaluée si le modèle live devient réellement multi-Household.
- La CLI Supabase n’était pas disponible localement, donc aucun `db lint` local ni application de migration n’a été exécuté.

# M. Gate final

`CANONICAL_IMPLEMENTATION_GATE = PASS`

Les trois données prioritaires sont accessibles dans Canonical/Facts et branchées au resolver. Les inconnues historiques restent explicites, aucune heuristique interdite ni date bancaire de fallback n’est utilisée, V1 est préservée et les tests/build passent. Le lot s’arrête ici : aucune QualityEnvelope V2, PublicationMeta, CalendarSemanticItem, DailyEconomicAmount, resource Query V2, snapshot V2, modification frontend ou suppression legacy n’a été commencée.
