# History V2 — Quality, Visibility & Publication

Date de certification locale : 2026-08-30
Périmètre : contrats transversaux partagés uniquement.

## Gate d’entrée

| Gate requis | Preuve | Résultat |
|---|---|---|
| `CANONICAL_IMPLEMENTATION_GATE` | `docs/history-v2/02-canonical-missing-data-report.md`, lignes 5 et 199 | PASS |
| `CANONICAL_LIVE_GATE` | `docs/history-v2/02b-canonical-live-migration-report.md`, ligne 206 | PASS |

Le lot était donc autorisé à démarrer. Aucune migration, écriture Supabase,
modification Canonical, donnée de backfill ou action frontend n'a été réalisée
pendant ce lot.

## Sources et architecture retenue

Les décisions de `Contrats_Transversaux_Quality_Visibility_Publication_V2`
ont été confrontées au plan validé dans
`docs/history-v2/01-plan-architecture-validation.md` et aux rapports Canonical
02/02b.

L'existant V1 est conservé sans élargissement :

- `src/core/metrics/availability.ts` conserve les valeurs V1 minuscules
  `known`, `unknown`, `not_applicable`, `conflict` ;
- `src/core/metrics/metric-envelope.ts` conserve `value: null` pour les états
  non disponibles et ne reçoit pas `partial` ;
- les Coverage, Support et Provenance V1 ne changent pas de sens ;
- `CURRENT_CONTRACT_VERSION` reste l'alias par défaut V1 pour les anciens
  appelants.

Les contrats History V2 sont isolés sous `src/core/history-v2/`. Les règles de
production serveur associées sont sous `src/analytics/history-v2/`. Cette
séparation évite de créer deux interprétations du même objet V1 et permet une
migration ressource par ressource.

## Contrats créés ou adaptés

### Quality

`src/core/history-v2/quality.ts` définit et parse strictement :

- `DataStatus` : `KNOWN`, `PARTIAL`, `UNKNOWN`, `NOT_APPLICABLE`, `CONFLICT` ;
- `PartialMeaning` : `LOWER_BOUND`, `OBSERVED_ONLY` ;
- `Coverage`, `Support`, `Provenance` et `QualityEnvelope` ;
- `MetricValue<T>` et `CollectionValue<T>` discriminés par statut.

Les invariants importants sont exécutables :

- `KNOWN` accepte notamment zéro et une collection vide exacte ;
- `PARTIAL` exige une valeur et un `partialMeaning` ;
- une collection `PARTIAL` exige `OBSERVED_ONLY`, un `knownCount` exact et
  interdit un `totalCount` inventé ;
- les états non résolus interdisent valeur, items et compteurs ;
- Coverage et Support restent deux dimensions distinctes ;
- Coverage contrôle ratio, numérateur, dénominateur et cohérence du quotient.

`LOWER_BOUND` est une représentation disponible pour les futurs schémas de
ressource, mais aucune ressource n'est créée dans ce lot : son choix reste donc
à la politique métier du futur producteur, qui devra prouver la monotonie et la
non-négativité prévues par le contrat.

### Reason codes

`src/core/history-v2/reason-codes.ts` contient le registre fermé des codes
machine des familles DATA, REFERENCE, COVERAGE, POLICY, COLLECTION, FEATURE et
PUBLICATION. Le parser refuse toute chaîne libre.

### Visibility

`src/core/history-v2/visibility.ts` définit `DisplayNode<T>` avec :

- `VISIBLE` et une donnée obligatoire ;
- `PLACEHOLDER`, sans donnée et avec `reasonCode` obligatoire ;
- `HIDDEN`, sans donnée.

`src/analytics/history-v2/visibility-policy.ts` centralise la décision serveur
pour les rôles `CORE`, `CONDITIONAL`, `DETAIL`, les statuts Quality,
l'éligibilité, les collections connues vides et les fonctions différées. Aucun
composant React ne décide de la visibilité dans ce lot.

### Publication et factsHash

`src/core/history-v2/publication.ts` définit `PublicationMeta` :

- `publicationId` ;
- `revision` entière strictement positive ;
- `contractVersion: v2` ;
- `factsHash` SHA-256 lowercase ;
- `policyVersions` ;
- `generatedAt` UTC normalisé.

Le même module définit l'identité de source d'un sidecar et la détection stricte
de stale. Un écart d'identifiant/révision, de contrat, de factsHash ou de policy
version produit respectivement les reason codes PUBLICATION prévus.

`src/analytics/history-v2/facts-hash.ts` calcule un unique hash contractuel par
`Household + YearMonth` sur la fermeture transitive dédupliquée de la
publication : deux artifacts partagés, quinze ressources, instances de
drill-down atteignables, faits directs et dépendances historiques réelles. Les
regroupements par ressource ne participent pas au digest. Faits, clés et
dépendances sont canonisés puis triés ; les métadonnées `generatedAt`,
`publicationId`, `revision`, `policyVersions` et `contractVersion` sont exclues.
Une révision ne change donc pas le digest à faits constants, tandis que tout
fait consommé ou digest historique modifié change le hash commun de toutes les
ressources de la publication.

Les digests techniques `artifactInputHash` et `resourceInputHash` sont séparés.
Ils servent au cache, au diagnostic, à l'invalidation et à la preuve de
déterminisme locale ; ils peuvent différer et ne sont jamais exposés comme
`PublicationMeta.factsHash`.

### ApiMeta / PublicationMeta

`src/core/api/types.ts`, `src/core/api/schemas.ts` et
`src/analytics/publication/*` ajoutent `publication` à `ApiMeta` sans casser la
forme V1 :

- ApiMeta V1 sans publication continue à parser byte-for-byte ;
- ApiMeta V1 avec PublicationMeta V2 est refusé ;
- ApiMeta V2 sans PublicationMeta est refusé ;
- ApiMeta V2 exige une PublicationMeta de même version.

## ContractVersion par ressource et signatures

`src/query-api/request/resource-contract.ts` est un registre exhaustif distinct
du registre d'adapters. Les 33 ressources actuelles y sont déclarées
explicitement `legacy_v1`. Ajouter une ressource oblige TypeScript à décider sa
version de contrat.

`defineHistoryV2ResourceContract()` prépare la déclaration future d'une
ressource V2 et exige au minimum les policies `quality_visibility` et
`facts_hash`, plus ses MetricIds et policies réellement dépendants. Il ne crée
aucune ressource V2 dans ce lot.

`src/server/analytics/materialization/identity.ts` résout désormais la version
et la signature de méthode par ressource :

- une ressource V1 réutilise exactement l'ancienne signature globale certifiée ;
- une future ressource V2 signera seulement ses Metric method versions et ses
  policy versions déclarées ;
- la clé de snapshot contient le contrat effectif de la ressource, pas une
  version globale arbitraire.

`src/query-api/server/execute-query.ts` transmet également cette version
effective à l'adapter et à ApiMeta.

Conséquence : annoncer `v2` dans un contexte serveur ne transforme plus une
ressource V1 en V2 et ne permet pas de servir son snapshot sous une enveloppe
V2. Le store de matérialisation conserve par ailleurs ses comparaisons exactes
sur `contract_version` et `method_signature`.

## Policy versions

`src/core/history-v2/policy-versions.ts` fournit les identifiants stables et la
version sémantique initiale `v1` :

| Policy ID | Version |
|---|---|
| `canonical_purchase_event_timing` | v1 |
| `canonical_component_classification` | v1 |
| `canonical_continuity` | v1 |
| `quality_visibility` | v1 |
| `calendar_semantics` | v1 |
| `daily_economic_allocation` | v1 |
| `week_journal_projection` | v1 |
| `month_overview_selection` | v1 |
| `month_balance_summary` | v1 |
| `category_explanation` | v1 |
| `spending_nature` | v1 |
| `life_money_selection` | v1 |
| `facts_hash` | v1 |

Ces versions forment le vocabulaire de dépendance prévu par le plan. Elles ne
prétendent pas que CalendarSemanticItem, DailyEconomicAmount ou les nouveaux
ReadModels sont déjà implémentés. Une publication n'embarque que le sous-ensemble
effectivement déclaré par sa ressource.

## Cas d'incompatibilité snapshot couverts

| Cas | Protection | Statut |
|---|---|---|
| Snapshot V1 lu pour ressource V2 | égalité stricte `contract_version` + identité par ressource | PASS |
| Signature de méthode/policy différente | égalité stricte `method_signature` | PASS |
| ApiMeta V2 sans PublicationMeta | RuntimeSchema | PASS |
| PublicationMeta V1 dans History V2 | RuntimeSchema | PASS |
| ApiMeta V1 portant une publication V2 | RuntimeSchema | PASS |
| Sidecar lié à une autre publication/révision | `PUBLICATION_STALE` | PASS |
| Sidecar lié à un autre contrat | `PUBLICATION_CONTRACT_MISMATCH` | PASS |
| Sidecar lié à d'autres faits | `PUBLICATION_FACTS_MISMATCH` | PASS |
| Sidecar lié à d'autres policies | `PUBLICATION_POLICY_MISMATCH` | PASS |

## Tests exécutés

| Contrôle | Résultat |
|---|---|
| `check-history-v2-transversal-contracts.mjs` | PASS — 48 checks |
| `check-history-v2-canonical-contracts.mjs` | PASS |
| `check-analytics-materialization.mjs` | PASS |
| Architecture imports | PASS — 443 fichiers |
| Product completeness | PASS — 7 surfaces, 2 routes futures |
| Analysis Month contracts | PASS |
| Analysis Global contracts | PASS |
| Canonical `.in` batching | PASS |
| Calendar / Day ciblé | PASS |
| Exploration / Entities ciblé | PASS |
| TypeScript `tsc --noEmit` | PASS |
| Next.js 16.2.6 production build | PASS |

Le check live de régression n'a pas été exécuté : ce lot ne requiert aucune
connexion ni lecture Supabase. Les contrôles locaux V1, la matérialisation, le
typecheck et le build couvrent les changements apportés ici.

## Fichiers du lot

Créés :

- `src/core/history-v2/index.ts`
- `src/core/history-v2/quality.ts`
- `src/core/history-v2/reason-codes.ts`
- `src/core/history-v2/visibility.ts`
- `src/core/history-v2/policy-versions.ts`
- `src/core/history-v2/publication.ts`
- `src/analytics/history-v2/index.ts`
- `src/analytics/history-v2/visibility-policy.ts`
- `src/analytics/history-v2/facts-hash.ts`
- `src/query-api/request/resource-contract.ts`
- `scripts/check-history-v2-transversal-contracts.mjs`
- `docs/history-v2/03-quality-visibility-publication-report.md`

Adaptés :

- `src/core/api/contract-version.ts`
- `src/core/api/index.ts`
- `src/core/api/types.ts`
- `src/core/api/schemas.ts`
- `src/core/versions/types.ts`
- `src/core/versions/parsers.ts`
- `src/core/versions/index.ts`
- `src/analytics/publication/types.ts`
- `src/analytics/publication/publication.ts`
- `src/query-api/request/index.ts`
- `src/query-api/server/execute-query.ts`
- `src/server/analytics/materialization/identity.ts`
- `scripts/check-analytics-materialization.mjs`
- `package.json`

## Non-régression V1

La compatibilité V1 est obtenue par isolation et non par conversion :

- aucun type V1 MetricEnvelope/Availability/Coverage/Support/Provenance n'est
  modifié ;
- les 33 ressources existantes restent V1 ;
- l'ancienne analyticsMethodSignature V1 est conservée à l'identique ;
- les anciennes clés restent stables pour le même household/scope/ressource ;
- les parsers V1 refusent toujours `partial` ;
- ApiMeta V1 reste valide sans nouveau champ obligatoire.

## Ce qui a été appris

1. Le repo possédait déjà les primitives Quality V1 nécessaires à la production
   certifiée, mais les élargir aurait changé le contrat historique existant.
2. La matérialisation avait déjà les colonnes et comparaisons nécessaires pour
   isoler deux versions ; le manque réel était la détermination de version par
   ressource et la signature de dépendances V2.
3. `AnalyticsRevision`/`DataRevision` ne remplacent pas l'identité de publication
   History V2 : PublicationMeta et factsHash sont des dimensions distinctes.
4. Coverage, Support et Visibility doivent rester orthogonaux ; aucune heuristique
   de pourcentage n'a été ajoutée à la décision d'affichage.

## Problèmes et dette restants

- Les ressources History V2 devront déclarer explicitement leur contrat, leurs
  MetricIds et leurs policy IDs au moment de leur création.
- Chaque producteur qui choisira `LOWER_BOUND` devra apporter la preuve métier de
  monotonie et non-négativité dans son schéma/contrat de ressource.
- La persistance de PublicationMeta/factsHash dans les futurs snapshots appartient
  au lot Snapshot History V2 ; aucune migration de snapshot n'a été anticipée ici.
- CalendarSemanticItem, DailyEconomicAmount, nouveaux ReadModels, snapshots V2 et
  frontend restent volontairement hors périmètre.

## Correction contractuelle — fermeture commune de publication

La revue post-lot a identifié que les digests locaux d'artifact/ressource ne
devaient pas être assimilés au `factsHash` contractuel. La correction est
strictement transversale : aucune formule, donnée, ressource ou policy métier
n'a été changée.

Preuves discriminantes :

- A — deux sous-ensembles de ressources d'une même publication reçoivent le
  même `PublicationMeta.factsHash` ;
- B — un fait consommé uniquement par Place Detail modifie le hash commun ;
- C — `life_money_selection@v1 → @v2` conserve le hash de faits mais modifie la
  signature de matérialisation de la ressource ;
- D — l'ordre des faits, fermetures et dépendances est neutre ;
- E — date de génération, ID, révision et versions de policies sont neutres ;
- F — deux `resourceInputHash` différents coexistent avec un unique hash de
  publication.

Les builders read-only ne créent toujours aucun `PublicationMeta` factice. Le
coordinateur de fermeture est prêt pour le futur lot snapshots, qui devra lui
fournir l'union exhaustive avant toute publication.

## Gate final

QUALITY_VISIBILITY_PUBLICATION_GATE = PASS

PUBLICATION_FACTS_HASH_GATE = PASS
