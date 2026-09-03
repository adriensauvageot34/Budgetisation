# History Core HC3 — dependency closure et manifest durable

Date : 2026-09-04. Base : `cb03ec737911653a6336ef79059d2744a72b90ee`, branche `main`.

## Entrée, portée et niveau de preuve

- HC1 : PASS, rapport `25-history-core-analytics-authority-report.md`.
- HC2 : PASS, section finale du rapport `26-history-core-shared-doctrines-report.md`.
- Le checkpoint initial était propre. Les moteurs et doctrines de ces deux lots sont conservés.
- Ce lot prépare du code et une migration : **aucune écriture live, publication, republication, migration appliquée, cutover, modification UI/UX ou travail Global**.
- Les preuves SQL portent sur le schéma versionné du dépôt et des tests contractuels. Aucun serveur PostgreSQL/Supabase n'a été utilisé pour exécuter la migration. La conformité au schéma live devra être recontrôlée avant son application autorisée. Ce rapport n'atteste pas d'une installation live de HC3.

## Ce qui a été confirmé

1. `balanceContext()` avait un digest commun opaque. Le preflight recevait surtout un fait contenant le `resourceInputHash` déjà construit, sans description suffisante des inputs réellement utilisés.
2. Les observations Actual historiques de M1 et les faits des mois pivots Category n'étaient pas explicitement fermés. Les descripteurs de dépenses et les annuaires lus par les builders Calendar ne figuraient pas tous dans leurs hashes provisoires.
3. `manifestDigest()` couvrait les clés et cibles atteignables, pas le contenu des dépendances. Le test existant attendait même un manifestHash identique après mutation du fait Place.
4. `HistoryV2ManifestFactDependency` conservait des identités sans leurs digests. `prepare-history-v2-live-publication.mjs` conservait les hashes dans un index de fichiers, mais n'attachait pas le détail à la publication.
5. Les migrations existantes créent déjà `analytics_publications`, `analytics_artifacts`, `analytics_query_snapshots`, la publication atomique et le rollback. Une table de snapshots supplémentaire n'est donc pas nécessaire.

## Preuves et autorités réutilisées

- `src/server/canonical/repository.ts` : `loadEconomicFacts`, `loadEconomicFactsByMomentIds`, `loadEconomicComponentClassifications`, `loadActivityOccurrences`, `loadActivityCausalFinancialLinkRows`, `loadPlaceVisits`, `loadLifeEventRecords`, `loadOperationsByBankRange`, `loadMinimalPlanningBundle`.
- La finance s'appuie notamment sur `financial_economic_cost_canonical`, les composantes/allocations/paiements/cash et leur temporalité. M3 lit `economic_component_classifications`. Activity lit `life_event_financial_links`. Place lit les présences de `location_occurrences` via les PersonDays et le `primary_place_id` des Life Events. Aucun de ces objets n'est modifié.
- `src/server/analytics/fact-source-resolver.ts` : `resolve` et ses stratégies `typical_month`, `minimal_month`, `loadActivityOccurrenceCosts`. Typical conserve sa fenêtre issue de `analysis_periods` et ses observations économiques ; Minimal conserve sa résolution source-aware existante.
- `src/analytics/history-v2/balance-authority.ts` : `resolveHistoryV2BalanceAnalyticsAuthority` fournit métrique, support, fenêtre/observations Typical, composantes Minimal, autorités Category Typical. L'oracle n'est jamais un intrant.
- `src/analytics/history-v2/shared-doctrines.ts` : projections et résolutions Moment/Activity/Place de HC2, inchangées. Le lien causal Moment hors période reste distinct de `spentDuring` et des possessions narratives.
- `scripts/check-history-v2-certification-12-months.mjs` : producteur effectif `buildReadModel`, préparation `monthData`, `historyQueryDependencies` et appel `buildHistoryV2Preflight`.
- `src/query-api/history-v2/builders.ts` et les builders Bilan existants : réutilisés sans modification des formules, classements, ReadModels ou schémas de réponse.

## Matrice de closure des 15 familles

Lecture : « manifesté » signifie enregistré dans le nouveau format et raccordé au futur stage, **pas déjà présent dans une publication live**. Les groupes sont des sélections logiques nommées avec identité Household/mois et digest de contenu ; ce n'est pas une archive des lignes bancaires. Chaque closure inclut aussi un digest du ReadModel construit, hors metadata de publication et hash auto-référent.

| RESOURCE | REAL_INPUT | FACT_DEPENDENCY | ANALYTICS_DEPENDENCY | HASHED? | MANIFESTED? | STATUS |
| --- | --- | --- | --- | --- | --- | --- |
| history_month_calendar | Grille et mois adjacents, Semantic, Ledger, personnes, descripteurs humains | Membership, événements économiques et annuaire sélectionné | calendar_artifacts, daily_ledgers, persons, expenses | Oui | Oui | PASS code |
| history_week | Les mois réellement traversés par les 7 jours, mêmes artifacts et descripteurs | Mêmes familles aux dates de la Week | calendar_artifacts, daily_ledgers, persons, expenses | Oui | Oui | PASS code |
| history_day_journal | Date, artifacts utilisés par le builder, dépenses, mouvements, liens Moment | Événements humains, colonnes d'opérations consommées, relations causales | Calendar/Daily, journal_supplement, moment_relations ; possession narrative inchangée | Oui | Oui | PASS code |
| history_month_overview | Semantic, Actual/bridge/inflows, causalité, sélection Place | Composantes, opérations, occurrences, présences, primary places | overview_supplement, moment_relations, Calendar/Daily, doctrine Place | Oui | Oui | PASS code |
| history_month_balance_summary | Actual courant, Typical qualifié, Minimal qualifié, Actuals antérieurs | Ledger courant et observations historiques ; inputs officiels des références | typical, minimal, actual_history ; zone/rang/comparaisons existants | Oui | Oui | PASS code |
| history_bank_economy_bridge | Sorties bancaires et net économique attribué | economic_components, operations | daily_ledgers, bridge existant | Oui | Oui | PASS code |
| history_month_categories | Faits courants par catégorie, labels, Category Typical | economic_components, référentiels | category_typical avec fenêtres et observations, Daily | Oui | Oui | PASS code |
| history_category_detail | Catégorie demandée, faits courants, faits des pivots, classifications | economic_components, category_history, classifications | Category Typical, composition/explanation/M3 existants | Oui | Oui | PASS code |
| history_month_spending_nature | Composantes et classifications, Actual, libellés contributeurs | economic_components, classifications, reference_labels | Daily, axes Necessity/Behavior/LifeScope et matrix existants | Oui | Oui | PASS code |
| history_spending_segment_detail | Sélection axe/bucket ou croisement, contributeurs | economic_components, classifications, reference_labels | Sélection et agrégation M3 existantes | Oui | Oui | PASS code |
| history_minimal_preview | Résultat Minimal officiel et ses composantes source-aware | Composantes de l'autorité Minimal et leur qualité | minimal ; moteur et familles existants | Oui | Oui | PASS code |
| history_month_life_money | Activity/Moment/Place et univers de classement | Occurrences, coûts, relations Moment, visites, primary places, composantes | Calendar/Daily, activity_costs, moment_relations, doctrine Place | Oui | Oui | PASS code |
| history_activity_detail | Activité sélectionnée, occurrences, coûts, liens, dépenses détaillées | activity_occurrences, activity_costs, activity_links, local_expenses | Résolution coût associé, Calendar/Daily ; détails humains existants | Oui | Oui | PASS code |
| history_moment_detail | Moment, relations économiques y compris hors mois, fenêtre, détails | moment_relations, dépenses locales et Ledger | CausalCost HC2 et spentDuring temporel distincts ; aucune nouvelle causalité | Oui | Oui | PASS code |
| history_place_detail | Présences, finance localisée, activités et libellés | place_visits, primary_places, economic_components, activity_occurrences | Couverture et scoring HC2 ; place_authorities UNKNOWN explicites | Oui | Oui | PASS code |

`historyV2ResourceDependencyGroups` est le registre exécutable des 15 familles. Le preflight refuse un groupe obligatoire absent. Les cinq détails atteignables, toutes les dates Journal et toutes les Weeks propriétaires passent par la même fermeture récursive.

Les sélections historiques sont relisibles dans l'identité JSON des groupes : `sourceMonths` pour les artifacts et Actuals antérieurs, catégorie et mois pivots pour `category_history`, périodes incluses/exclues des fenêtres Typical/Category Typical, `momentIds` effectivement demandés au Canonical (même si leur réponse est vide). Les digests des valeurs qualifiées et des fenêtres complètes restent couverts.

Les groupes peuvent volontairement couvrir un ensemble mensuel plus large que les seules lignes affichées : classement, parts, seuils, baselines et couverture dépendent de l'univers. Il ne s'agit pas d'un graphe d'invalidation optimisé à la ligne. Des colonnes non consommées d'Operations, les caches dérivés et l'oracle sont exclus ; aucune nouvelle règle métier de sélection n'est introduite.

## Chaîne de hash

1. `historyQueryDependencies()` extrait les inputs des autorités existantes, sans refaire leurs calculs. Les collections déclarées comme ensembles sont triées/dédupliquées ; l'ordre des listes de présentation reste significatif.
2. `historyResourceDependencyClosure()` produit des faits `history_input:<groupe>` avec sélecteur stable et valeur stricte JSON. L'absence d'un groupe requis provoque une erreur.
3. `sealHistoryV2QueryBuild()` valide les doublons, calcule les digests de groupes et ajoute `readmodel:<inputIdentity>` : digest du contenu du **nouveau** ReadModel. Le hash provisoire du builder est remplacé avant validation RuntimeSchema et avant tout stage ; aucun snapshot existant n'est chargé pour être patché.
4. `resourceInputHash` est calculé sur l'identité normalisée de la requête, les digests des intrants et les dépendances. Le parser peut le recalculer à partir du manifest durable seul.
5. Les deux closures artifacts comprennent aussi un digest de contenu complet, au-delà de leur ancien artifactInputHash. Les contrôles/qualités et temporalités de l'artifact ne peuvent ainsi disparaître de la fermeture.
6. `publicationFactsHash` est l'union dédupliquée des closures artifacts et Query, avec rejet de deux valeurs/digests contradictoires pour une même identité. Il est recalculable sans relire des données Canonical susceptibles d'avoir changé.
7. `manifestHash` couvre tout le document compact : format, sélections, clés, refs externes, digests, versions et identité d'implémentation. Il ne se limite plus à la topologie des clés.

Les primitives de hash historiques de `facts-hash.ts` ne sont pas changées. Le nouveau preflight utilise une représentation de fermeture à digests, explicitée par `history-v2-dependency-manifest@v2`. Ses nouveaux hashes ne doivent pas être comparés à l'ancien format comme si leurs intrants étaient identiques.

`publicationId`, `revision`, `generatedAt` et les metadata de publication ne deviennent pas des faits économiques. Les `policyVersions` restent propres à chaque ressource/artifact et sont conservées dans le manifest. Le digest d'implémentation change le manifestHash, pas artificiellement les faits. Les signatures métier existantes et les payloads legacy restent compatibles et inchangés.

`externalQueryRefs` décrit des liens de navigation vers un autre mois : **ce n'est pas une preuve de consommation de son snapshot ni de sa publication active**. Quand un builder consomme réellement des intrants hors mois, leurs digests sont couverts séparément (artifacts adjacents, historique Actual, pivots Category, relations Moment hors période). Un futur graphe ne doit pas confondre ces deux types d'arêtes.

## Format durable et choix physique

Migration préparée : `supabase/migrations/20260904120000_history_v2_dependency_manifest.sql`.

Une seule colonne nullable `analytics_publications.dependency_manifest JSONB`, sans nouvelle table. Une publication possède un seul document immutable, les snapshots gardent leur PublicationMeta actuelle. Aucun second registre de vérité ou archivage des données financières dans la colonne.

Contenu :

- `formatVersion`, `profileId`, Household/mois ;
- `manifestHash`, `publicationFactsHash` ;
- `implementation: {status, gitSha, digest}` ;
- familles, `requiredArtifactKeys`, `requiredQueryKeys`, `externalQueryRefs` ;
- `factDependencies[] : {closureId, facts: [{factType, identity, factHash}], dependencies: [{dependencyId, dependencyHash}]}` ;
- `queryVersions[]` : queryKey, inputIdentity lisible (resource/scope/params), contractVersion, methodSignature, policyVersions, resourceInputHash ;
- `artifactVersions[]` : artifactKey, contractVersion, policyVersions, artifactInputHash.

Le document synthétique de sensibilité (54 Query, 2 artifacts) mesure **158 559 octets** en JSON compact. Limite explicite : 2 000 000 octets, contrôlée en TypeScript et SQL (la représentation JSONB texte SQL peut être un peu plus grande). Un dépassement bloque ; pas de troncature silencieuse. Les valeurs des Facts/ReadModels ne sont pas dupliquées, uniquement sélecteurs/digests. Les mêmes identités répétées entre closures sont contrôlées contre les divergences.

Le digest d'implémentation couvre les sources Analytics/Core/Query/Canonical/server Analytics, le producteur, les manifests de dépendances et la configuration TypeScript, avec tri des chemins et normalisation CRLF/LF. `gitSha` est le HEAD réellement lu, non une variable d'environnement libre. Si le workspace est modifié, le digest couvre ces octets ; le SHA n'est pas présenté comme la preuve qu'ils seraient déjà commités. Le futur opérateur devra utiliser un checkout propre enregistré pour publier.

### Garde-fous préparés

- RPC `attach_history_v2_dependency_manifest` : Household/publication exacts, verrou de ligne, premier attachement sur DRAFT, réessai identique idempotent, aucune réécriture d'un manifest différent.
- Trigger : format, checksum JSON canonique SHA-256, portée, taille, clés, versions et preuve d'implémentation ; interdiction de remplir rétrospectivement une publication déjà publiée sans manifest.
- Au passage DRAFT → published : manifest obligatoire pour History V2, cardinalité exacte, correspondance snapshots/artifacts avec les clés, méthodes, contractVersion, policyVersions, hashes, identité/revision de publication et absence d'invalidation. Une erreur annule la transaction Finalize existante, donc ses activations aussi.
- Les fonctions existantes `publish_analytics_materialization` et `restore_history_v2_publication` ne sont pas remplacées. L'unicité active reste celle de la migration `20260902105811_enforce_single_active_analytics_generation.sql`.
- RLS et grants de table existants inchangés ; fonctions privées à PUBLIC/anon/authenticated, attachement exécutable seulement par service_role. Aucun endpoint navigateur créé.
- `stageHistoryV2GenerationInMemory` vérifie les digests du contenu et les versions contre le manifest : modifier le contenu d'un bundle après preflight est rejeté.
- Le préparateur SQL écrit l'attachement comme dernier fichier de stage, sans rien exécuter. Chaque batch SQL vérifie/verrouille d'abord un DRAFT ; un ancien plan pointant une publication déjà publiée ne peut pas en écraser les payloads.

## Relecture, legacy et rollback

`SupabaseHistoryManifestStore.read(householdId, publicationId)` relit la colonne, parse strictement le document, recalcule manifestHash/publicationFactsHash/resourceInputHash et vérifie la portée. Tests : JSON round-trip puis nouveau lecteur simulé, document altéré rejeté, erreur de permission non masquée.

- Colonne absente : `SCHEMA_NOT_READY` (erreur PostgreSQL ciblée), pas une preuve inventée.
- Publication absente : `NOT_FOUND`.
- Colonne NULL : `LEGACY_UNKNOWN / MANIFEST_NOT_RECORDED`.
- Manifest valide : `KNOWN`.
- Format/contenu incohérent : erreur explicite, jamais reconstruit depuis le Canonical actuel.

Le stockage des snapshots et le chemin de lecture History ne changent pas : aucun read-through. Les générations historiques sans manifest restent servables/traçables avec leur preuve limitée ; le rollback existant commute les flags actifs sans modifier leur manifest ni exiger une preuve rétrospective. Les anciens bundles preflight ne sont pas promus artificiellement au nouveau format : il faudra une nouvelle génération certifiée pour publier avec HC3.

## Tests exécutés

| Commande locale | Résultat |
| --- | --- |
| `node scripts/check-history-v2-snapshot-materialization.mjs` | 79 checks existants PASS + 100 checks HC3 PASS ; 15 familles, 54 Query, 2 artifacts, 5 refs externes |
| `node --experimental-strip-types scripts/check-history-v2-month-balance.mjs` | 99/99 PASS, dont autorités HC1/HC2 |
| `node --experimental-strip-types scripts/check-history-v2-transversal-contracts.mjs` | 48/48 PASS |
| `node --experimental-strip-types scripts/check-history-v2-calendar-daily-engines.mjs` | 42/42 PASS |
| `node --experimental-strip-types scripts/check-history-v2-readmodels.mjs` | 27/27 PASS |
| `node scripts/check-architecture-imports.mjs` | PASS, 464 fichiers |
| `tsc --noEmit` | PASS |
| `next build` | PASS, compilation/TypeScript/prérendu/routes de production |
| `node --check` producteur et préparateur SQL | PASS |
| `git diff --check` | PASS |

Les exécutables proviennent du runtime Node fourni au workspace (npm n'est pas dans PATH). Les avertissements MODULE_TYPELESS_PACKAGE_JSON existants ne sont pas des erreurs et n'ont pas motivé un changement package.json.

Les 13 mutations discriminantes passent par **la fonction de sélection du producteur réel**, extraite par AST, puis le preflight complet : Typical, composantes Minimal, Category Typical, fait d'un pivot Category, classification M3, relation causale Moment, coût Activity, visite Place, affectation de finance localisée, Actual d'un mois antérieur, descripteur Calendar, descripteur local Moment, sémantique d'une opération Journal. Chacune change le resourceInputHash concerné, publicationFactsHash et manifestHash. Le hash de publication est recalculé après sérialisation JSON.

Contre-exemples testés : ordre des objets/ensembles, doublons identiques, oracle/cache et colonne Operations non consommée ; ces changements ne modifient pas le hash métier. Changer seulement la preuve d'implémentation ne modifie pas publicationFactsHash. Une nouvelle revision/date de publication ne change pas les hashes du preflight.

Contrats SQL vérifiés par tests de migration : attachement DRAFT, immutabilité, refus de rétrofit, exigence de manifest, contrôles de metadata/hash, droits service_role, absence de modification des fonctions d'activation/rollback et des payloads. **Pas de test d'exécution PostgreSQL dans ce lot**. Pas de recertification 12 mois ni d'ancien script V1 exécuté. La non-régression porte sur les moteurs partagés HC1/HC2 et la compatibilité lecture/rollback testée, pas sur un nouveau smoke live.

## Déploiement requis — non exécuté

1. Validation humaine du SQL exact. Vérifier cible Supabase et historique live, absence de colonne/RPC homonyme et absence de drift des tables/fonctions. Arrêter en cas de divergence ; ne pas réécrire une migration déjà appliquée.
2. Exécuter les essais SQL transactionnels de DRAFT valide, manifest manquant/altéré, mismatch de payload, idempotence, refus de retrofit, rollback vers génération legacy et isolation Household dans un environnement explicitement autorisé. Aucun reset.
3. Appliquer uniquement cette migration après autorisation ; recontrôler RLS/grants et historique. Les publications existantes conservent NULL, sans backfill.
4. Déployer le code serveur/préparateur compatible. Déploiement et activation de données restent deux opérations distinctes ; ce lot n'effectue ni l'un ni l'autre.
5. Dans un lot autorisé ultérieur, générer/certifier en READ-ONLY les nouveaux bundles à partir d'un checkout enregistré. Ne pas retoucher les anciens hashes, payloads ou oracles.
6. Begin → petits stages inactifs → attacher manifest → relecture/validation → Finalize atomique → relecture de la publication. Le préparateur ne lance jamais Finalize.
7. Vérifier single-active et rollback vers une génération conservée. Un ancien binaire opérateur ne peut plus publier de nouveaux snapshots History sans manifest après migration ; prévoir ce cutover opérateur.

## Fichiers de ce lot

- `src/analytics/history-v2/dependency-graph.ts` ; export dans `src/analytics/history-v2/index.ts`.
- `src/server/analytics/materialization/history-v2.ts`, `history-manifest-store.ts`, `index.ts`.
- `scripts/check-history-v2-certification-12-months.mjs` (intrants/hash uniquement ; projection Overview extraite à l'identique).
- `scripts/prepare-history-v2-live-publication.mjs`.
- `scripts/check-history-v2-dependency-manifest.mjs`, intégré au gate `scripts/check-history-v2-snapshot-materialization.mjs`.
- La migration ciblée précitée et ce rapport.

## Limites et sortie

Les 15 closures, leur sensibilité et la relecture du format durable sont implémentées et testées localement. L'exécution SQL, la vérification du drift live, l'application et la certification des futures générations restent explicitement requises avant cutover ; aucun PASS live n'est revendiqué. La limite de taille devra être vérifiée avec les vrais manifests lors de cette certification. Les lacunes de données/autorité déjà documentées HC2 restent qualifiées, non inventées.

Aucun fichier UI, moteur métier HC1/HC2, schéma de ReadModel, payload existant ou donnée Supabase modifié. Aucun commit/push demandé ni effectué dans HC3.

HISTORY CORE HC3
PASS
