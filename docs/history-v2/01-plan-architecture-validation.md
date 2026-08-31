# Historique mensuel V2 — validation technique du plan d’architecture

## Statut du document

- Document validé : `Plan_Architecture_Migration_Historique_Mensuel_V2.docx`.
- Repository validé : `Budgetisation` sur `main` au SHA `a97172ae851838fcef61505c703d8c27bbb0f80e`.
- Nature du travail : validation et planification uniquement.
- Code, migration et données modifiés pendant cette étape : **aucun**.
- Supabase : contrôles **READ-ONLY** uniquement.
- Conclusion : l’architecture additive proposée est techniquement réalisable dans le dépôt, sous les adaptations obligatoires et arbitrages explicités ci-dessous.

## Verdict exécutif

Le chemin `Canonical → Facts → Analytics/Semantic → Query/ReadModels → RuntimeSchema → snapshots → publication → React` existe réellement et peut porter l’Historique V2 sans créer une seconde chaîne métier.

Les points structurants du plan sont compatibles :

- les snapshots V1 et V2 peuvent coexister parce que la publication ne désactive que les clés logiques remplacées ;
- les quinze ressources V2 peuvent être ajoutées au registre Query actuel ;
- les semaines, jours et détails peuvent rester stockés dans la matérialisation mensuelle en mettant l’identité spécifique dans les paramètres normalisés ;
- `analytics_artifacts` peut porter les deux artefacts partagés sans nouvelle table, après généralisation de la couche TypeScript actuellement limitée aux métriques ;
- les moteurs Analysis M1–M4 peuvent être conservés comme moteurs internes plutôt que recopiés ;
- la bascule frontend peut être différée jusqu’à la certification et à la publication des douze mois.

Quatre corrections de chemin sont obligatoires avant développement fonctionnel :

1. rendre `contractVersion` et les signatures de politiques déterminables par ressource ;
2. découpler le profil de publication mensuelle de l’obligation codée en dur `analysis_month_initial` + trois métriques ;
3. compléter la migration Purchase Event non appliquée avant toute mise en production ;
4. préserver explicitement le moteur V1 de temporalité économique : le V2 doit refuser `bank_date_fallback` sans changer les résultats V1 certifiés.

Aucune décision du plan n’est impossible. Trois choix contractuels pouvant modifier le sens ou la reproductibilité doivent néanmoins être arbitrés avant les PR concernées : temporalité du Purchase Event, portée de `continuityQualifier`, et granularité de `factsHash`.

## Ce qui a été appris

### État réel du dépôt et de Supabase

- Le dépôt ne contient que quatre migrations locales : Purchase Event, correction `deplacement_pro`, périodes historiques et matérialisation Analytics. Le schéma canonique de base n’est donc pas reconstructible depuis `supabase/migrations/` seul ; Supabase distante et `docs/specs/SUPABASE_V2_REFERENCE.md` restent l’autorité de schéma.
- La migration `supabase/migrations/20260822000000_purchase_event_identity.sql` est présente dans Git mais n’est pas appliquée sur le projet distant. La liste distante contient seulement les trois migrations suivantes.
- Contrôle live READ-ONLY : `1538` snapshots actifs, dont `1536` liés à une publication et `2` read-through ; `389` ressources `history_*` actives ; `12` mois actifs ; `0` snapshot portant l’un des quinze noms V2.
- Contrôle live READ-ONLY : `public.purchase_events` et `public.purchase_event_sources` sont absentes.
- Aucune donnée personnelle, aucun montant détaillé et aucun payload de snapshot n’ont été lus pour cette validation.

### Écarts techniques majeurs

- Le contexte runtime fixe actuellement `contractVersion = v1` pour toutes les ressources. La coexistence fonctionnelle marche grâce aux nouveaux noms, mais le contrat du plan exige une identité V2 explicite et reproductible par ressource.
- `analytics_artifacts` est générique côté SQL (`artifact_family`, `metric_id`, `payload` en texte/JSONB), mais la couche TypeScript n’accepte que `metric | metric_bucket`, `ActiveMetricId` et `ProducedMetric`.
- La publication mensuelle est générique côté SQL, mais `beginMonthPublication()` exige encore `analysis_month_initial` et trois artefacts métriques. Un profil V2 ne peut pas être publié proprement sans adapter cette méthode.
- `PurchaseEventFact` porte une identité et des sources, mais aucune temporalité. `FactSourceResolver` refuse donc volontairement son usage dans un scope temporel.
- Le projecteur des composants économiques copie aujourd’hui `necessity`, `behavior` et `lifeScope` depuis l’opération sur chaque composant. C’est incompatible avec le besoin M3 sur opérations mixtes.
- La source de temporalité est renvoyée par `resolveHistoricalEconomicTiming()`, mais le fact conserve seulement le résultat `timing`. Le V2 ne peut plus distinguer après projection une date explicite d’un `bank_date_fallback`.
- Le Calendar V1 transforme tout événement multi-jour en `spanningEvent`. Il ne connaît pas `continuityQualifier`.
- Une partie de la doctrine d’affichage Calendar est encore dans React : troncature des marqueurs, grille hors mois, layout des ribbons et dérivation Week.
- Les tests du dépôt sont des scripts de contrats, pas des fichiers `*.test.*`/`*.spec.*`. Les nouvelles validations doivent donc soit suivre ce modèle, soit introduire une convention de test explicitement décidée.

## Preuves techniques

| Couche | Preuve actuelle | Fonction / table concernée | Conséquence pour V2 |
|---|---|---|---|
| Autorité | `docs/specs/SOURCE_OF_TRUTH.md` | chaîne de responsabilité | Interdit un deuxième moteur métier dans Query ou React. |
| Canonical | `src/server/canonical/repository.ts:317` | `CanonicalRepository` | Point d’entrée à étendre pour les trois données critiques. |
| Facts | `src/server/analytics/fact-source-resolver.ts:141` | `FactSourceResolver` | Doit rester l’unique résolveur de faits. |
| Analytics | `src/server/analytics/metric-query-service.ts:34` | `MetricQueryService` | Réutilisation obligatoire pour Actual/Typical/Minimal et agrégats. |
| Query | `src/server/query/sources/index.ts:15` | `createRealQuerySources()` | Composition unique des builders serveur. |
| Exécution | `src/query-api/server/execute-query.ts:122` | `executeAuthenticatedQuery()` | Frontière read-only, autorisation, schéma et cache. |
| Ressources | `src/query-api/request/resource-registry.ts:76` | registre des ressources | Ajouter les 15 ressources, leurs paramètres et scopes. |
| RuntimeSchema | `src/query-api/read-model-registry.ts:117` | registre des ReadModels | Ajouter un parseur strict par ressource. |
| Capabilities | `src/query-api/capabilities/registry.ts:194` | registre des capacités | Déclarer les nouvelles ressources Household-only. |
| Matérialisation | `src/server/analytics/materialization/identity.ts:207` | `querySnapshotIdentity()` | Ressource + scope + params + contrat + signature donnent une identité déterministe. |
| Publication app | `src/server/analytics/materialization/store.ts:565` | `beginMonthPublication()` | À généraliser par profil ; dépend encore d’Analysis V1. |
| Publication SQL | `supabase/migrations/20260825105100_analytics_materialization.sql:334` | `publish_analytics_publication()` | Stage/Finalize atomique réutilisable. |
| Coexistence | même migration, lignes `400–421` | désactivation par `artifact_key`/`query_key` présents dans la génération fraîche | Une publication V2 ne désactive pas les clés V1 différentes. |
| Backfill | `src/server/analytics/materialization/backfill.ts:187` | `certifiedMonthQueryRequests()` | À étendre par découverte des instances V2 atteignables. |
| Purchase Event SQL | `supabase/migrations/20260822000000_purchase_event_identity.sql:3` | deux tables non live | Base réutilisable, migration insuffisante en l’état. |
| Purchase Event fact | `src/analytics/facts/types.ts:195` et `:205` | `PurchaseEventSource`, `PurchaseEventFact` | Identité présente, date et provenance temporelle absentes. |
| Purchase Event source | `src/server/analytics/fact-source-resolver.ts:459` | refus du scope temporel | Confirme le blocage du Daily/Hover humain. |
| Composants | `src/analytics/facts/types.ts:91` | `EconomicComponentFact` | Grain stable et `canonicalComponentKey` déjà disponibles. |
| Classification | `src/analytics/facts/canonical.ts:795` et `:840` | `projectEconomicComponentFact()` | Héritage opération aveugle à remplacer par override puis fallback. |
| Timing | `src/analytics/facts/economic-timing.ts:48` et `:104` | `resolveHistoricalEconomicTiming()` | `bank_date_fallback` est central et doit être exclu seulement du chemin V2. |
| Occurrences | `src/analytics/facts/types.ts:114` | `ActivityOccurrenceFact` | Grain activité à conserver. |
| Life Events | `src/server/canonical/repository.ts:935` | série + parent + dates | Relations autoritaires déjà exposées. |
| Continuité | `src/server/canonical/repository.ts:1534` | sélection de `life_event_types` | Aucun `continuityQualifier` actuel. |
| Moment/Life Event | `src/server/canonical/repository.ts:1591` | `moment_life_events` | Autorité de fusion à conserver. |
| Lieu | `src/server/canonical/repository.ts:653` | `operation_place_canonical` | Autorité monétaire lieu déjà utilisée. |
| Calendar serveur V1 | `src/server/query/sources/calendar.ts:215`, `:402`, `:513` | narrations, marqueurs, spanning events | Source transitoire/comparateur, pas doctrine V2. |
| Calendar client V1 | `src/features/calendar/model.ts:133`, `:282`; `src/features/calendar/calendar-view.tsx:84` | ribbons, Week, top markers | À retirer seulement au cutover. |
| Analysis | `src/server/query/sources/analysis.ts:91`, `:248`, `:475`, `:542`, `:618` | groupes, breakdowns, structures | Moteurs internes M1–M4 réutilisables. |
| Typical | `src/analytics/references/typical-month.ts:98` | `calculateTypicalMonthCost()` | Base M1/M2, à envelopper. |
| Minimal | `src/analytics/baseline/minimal-month.ts:98`; `src/server/analytics/minimal-source-resolver.ts:225` | moteur + résolution source-aware | Base M1/M3, à conserver. |
| Materialité | `src/analytics/insights/marked-facts.ts:102` | `selectMarkedFacts()` | Seuils existants à réutiliser. |
| API meta | `src/core/api/types.ts:23` | `ApiMeta` | `factsHash`, publication revision et policy versions absents. |
| Contrat global | `src/core/api/contract-version.ts:7`; `src/server/canonical/context.ts:71` | `CURRENT_CONTRACT_VERSION = v1` | Adaptation par ressource obligatoire. |

## Matrice KEEP / ADAPT / CREATE / BACKFILL / RETIRE

### KEEP

| Contrat cible | Fichiers/tables actuels | Modification nécessaire | Nouvelles pièces | Dépendances | Risques | Statut |
|---|---|---|---|---|---|---|
| Publication mensuelle atomique | `materialization/store.ts`, `materialization/backfill.ts`, `analytics_publications`, fonction SQL de publication | Ajouter un profil V2, ne pas remplacer Draft/Stage/Finalize | Type `PublicationProfile` ou équivalent | Identités V2 complètes avant Begin | Une liste de clés incomplète pourrait activer une génération partielle | **COMPATIBLE** |
| Validation Query + RuntimeSchema | `execute-query.ts`, `server/validation.ts`, `read-model-registry.ts` | Enregistrer les nouveaux parsers stricts | Types/validateurs History V2 | Contrats partagés Quality/Display/Meta | Bypass du parser lors du backfill | **COMPATIBLE** |
| Runtime officiel read-only | `createReadOnlyQueryServicesForContext()`, scripts de checks live | Ajouter un manifest V2 sans cache write | Mode/cible de certification V2 | Ressources enregistrées | Confondre MISS de snapshot et échec du moteur | **COMPATIBLE** |
| CanonicalRepository → FactSourceResolver → MetricQueryService | fichiers homonymes | Étendre les entrées/facts, jamais dupliquer | Adaptateurs History V2 minces | Migrations critiques | Deux résolveurs de doctrine | **COMPATIBLE** |
| Relations `moment_life_events` | `repository.ts:1591`, table live | Aucune doctrine nouvelle | Lecteur réutilisé par Semantic/M4 | Household scope | Fusion heuristique parallèle | **KEEP AS IS** |
| `parent_life_event_id` | `repository.ts:935`, `life_events` | Aucune doctrine nouvelle | Consommateur Semantic | Continuity | Dédupliquer parent/enfant par proximité | **KEEP AS IS** |
| `fct_activity_occurrence` | `facts/types.ts:114`, `facts/canonical.ts`, `facts/validation.ts` | Aucun changement de grain | Projections M4 | Life Events admissibles | Recompter un multi-jour par jour | **KEEP AS IS** |
| Lieu canonique + hiérarchie | `operation_place_canonical`, `repository.ts:653`, `parent_place_id` dans le Canonical | Réutiliser les résolutions existantes | Score/couverture Place | Facts Place/finance | Inférer finance depuis GPS/narration | **COMPATIBLE** |
| Liens finance/activity/moment | loaders Canonical, `facts/activity-cost.ts`, builders Analysis/Entities | Conserver causal/associated/spentDuring séparés | Agrégateurs M4 | Daily ledger pour during exact | Fusion des trois notions | **COMPATIBLE** |
| Actual / Typical / Minimal | Metric Registry, `typical-month.ts`, `minimal-month.ts`, `minimal-source-resolver.ts` | Appeler/envelopper | Projections M1–M3 | Quality V2 | Recalcul parallèle divergent | **COMPATIBLE** |
| Matérialité/support | `marked-facts.ts`, `support.ts`, Metric Registry | Référencer les politiques existantes | Entrées du registre de signatures | Policy versions | Seuils recodés dans un builder | **COMPATIBLE** |
| Agrégats Analysis | `sources/analysis.ts`, `production/registry.ts` | Extraire/factoriser seulement si nécessaire | Façades de calcul internes | Facts/metrics | Copier le payload UI comme autorité | **COMPATIBLE** |
| Snapshots Analysis V1 | `analytics_query_snapshots`, ressources `analysis_*` | Aucun retrait avant audit Global | Vérification coexistence G14 | Publication par clé | Suppression lors d’un cleanup History | **KEEP TEMPORAIRE** |
| 389 snapshots History V1 | mêmes tables, trois ressources legacy | Servir rollback jusqu’à fenêtre close | Aucun | Cutover + zéro consommateur | Activation V2 destructrice si clés mal construites | **KEEP TEMPORAIRE** |

### ADAPT

| Contrat cible | Fichiers/tables actuels | Modification nécessaire | Nouvelles pièces | Dépendances | Risques | Statut |
|---|---|---|---|---|---|---|
| `QualityEnvelope` | `availability.ts`, `metric-envelope.ts`, coverage/support/provenance | Créer un contrat V2/adaptateur ; ne pas élargir brutalement le type V1 exhaustif | `DataStatus`, `PartialMeaning`, collection quality, reason codes | Aucun nouveau ReadModel avant stabilisation | `MetricEnvelope` exige actuellement `value:null` hors `known`; `PARTIAL` peut porter une valeur | **COMPATIBLE AVEC ADAPTER** |
| Display/Visibility | capabilities + availability | Ajouter décision serveur `VISIBLE/PLACEHOLDER/HIDDEN` | `DisplayNode`/`Visibility` + parser commun | Quality | React réinfère depuis `null`, `[]` ou coverage | **CREATE SUR BASE EXISTANTE** |
| `PublicationMeta` | `ApiMeta`, method signature, snapshot identity | Étendre le payload V2 avec revisions, publication, `factsHash`, policies | Type/parser commun V2 | Arbitrage `factsHash`, policy registry | Meta transport et meta métier divergentes | **COMPATIBLE APRÈS ARBITRAGE** |
| Version de contrat par ressource | `contract-version.ts`, `context.ts`, resource registry, identity, execute-query | Résoudre `v1/v2` depuis la ressource et l’utiliser dans query key + réponse | Champ de registre ou resolver central | Tous les schemas V2 | Un bump global invaliderait et masquerait V1 | **ADAPTATION OBLIGATOIRE** |
| Policy signatures | `analyticsMethodSignature()` | Passer d’une signature globale Calendar seule à une signature déterministe par ressource/policies | Registre des 8 versions | PublicationMeta | Signature globale invalide trop de ressources ; signature incomplète réutilise un snapshot faux | **ADAPTATION OBLIGATOIRE** |
| Stockage d’artefacts | table `analytics_artifacts`, `MetricArtifactIdentity`, store métrique | Généraliser identité/store et brancher un RuntimeSchema par famille | IDs `calendar_semantic_item`, `daily_economic_ledger`; read/write typés | Quality + policies | Mettre du JSON non validé dans le store métrique | **COMPATIBLE SANS NOUVELLE TABLE** |
| Profil de publication | `beginMonthPublication()` | Accepter explicitement les artefacts et requêtes requis par profil | Profil `history-v2-month` | Artefacts + manifest Query | Dépendance codée en dur à `analysis_month_initial` | **ADAPTATION OBLIGATOIRE** |
| History Month/Day actuels | `sources/calendar.ts`, `query-api/calendar/*` | Utiliser seulement comme oracle comparatif/source transitoire | Builders V2 séparés | Semantic + Daily | Étendre V1 jusqu’à deux doctrines imbriquées | **ADAPT, PUIS RETIRE** |
| Analysis M1–M4 | `sources/analysis.ts` et métriques | Exposer des calculs internes réutilisables ; reconstruire les projections | Façades non-UI | Quality/Meta | Dépendre des formes de page V1 | **COMPATIBLE** |
| Query registry/schemas/capabilities | registres Query existants | Ajouter ressources, params, types, parseurs, adapters, validation croisée et capabilities | Modules History V2 | Contract version | Une ressource enregistrée partiellement casse le type exhaustif | **COMPATIBLE** |
| Materialization manifest | `certifiedMonthQueryRequests()` | Découvrir d’abord les cibles depuis les ReadModels V2 top-level, normaliser toutes les requêtes, puis Begin/Stage | Manifest mensuel déterministe | Ressources calculables read-only | Découverte depuis une source différente du payload = instances manquantes | **COMPATIBLE** |
| Temporalité économique | `economic-timing.ts`, projecteur de component | Conserver la source de résolution dans le fact ou accepter une policy V2 ; V1 inchangé | Attribution method/source dans le fact | Purchase Event + Daily | Supprimer globalement le fallback ferait régresser Actual certifié | **ADAPTATION OBLIGATOIRE** |

### CREATE — données canoniques

| Contrat cible | Fichiers/tables actuels | Modification nécessaire | Nouvelles pièces | Dépendances | Risques | Statut |
|---|---|---|---|---|---|---|
| Purchase Event canonique daté | migration non live, `PurchaseEventFact`, repository/resolver | Compléter avant application : temporalité nullable + état/source, intégrité household, PK source, RLS, grants/policies | Migration ciblée révisée, colonnes/types/parsers/fact | Arbitrage temporalité | La migration actuelle n’a ni date, ni RLS, ni cohérence household entre event et source | **BLOQUÉ ARBITRAGE MÉTIER** |
| Classification composante | `EconomicComponentFact`, `canonicalComponentKey`, operation items/allocations/components/cash uses | Ajouter override canonical au grain composant, lu avant le fallback opération | Table/relation d’override + migration RLS/grants + loader | Arbitrage atomicité des 3 axes | Doubler les champs sur chaque table source ; inventer les 14 cas mixtes | **BLOQUÉ ARBITRAGE LIMITÉ** |
| `continuityQualifier` | `life_event_types`, `life_events`, `can_span_days`, calendar fields | Persister l’état explicite et sa provenance ; ne pas toucher AUTO/POINT | Colonne(s)/relation + parser/loader | Arbitrage portée/précédence | Qualifier au type ou à l’événement produit des résultats différents | **BLOQUÉ ARBITRAGE MÉTIER** |
| Contacts externes | aucune structure canonique identifiée | Aucun travail dans le chemin critique | Modèle futur | Aucun pour G14 | Inventer des participants historiques | **DIFFÉRÉ** |
| Médias Moment | aucune relation média canonique identifiée | Fallback typographique seulement maintenant | Modèle futur de media/role/order | Moment stable | Faux placeholder photographique | **DIFFÉRÉ** |
| Objets récurrents génériques | identités de certaines entités seulement | Limiter Nouveau/Réapparu aux identités existantes | Registre futur | Historique suffisant | Regroupement par libellé/date/montant | **DIFFÉRÉ** |

Pour toute nouvelle table `public`, suivre le modèle sécurité de `20260825105100_analytics_materialization.sql` : RLS, politiques Household, droits explicites et écriture server-only. La plateforme Supabase ne doit pas être supposée exposer automatiquement une nouvelle table à la Data API ; voir le [changelog Supabase sur les grants explicites](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

### CREATE — moteurs et artefacts

| Contrat cible | Base actuelle réutilisable | Modification / nouvelle pièce | Dépendances | Risques | Statut |
|---|---|---|---|---|---|
| Calendar Semantic Engine | Life Events, parent, Moment links, types Calendar V1 | Moteur serveur versionné : fusion, absorption, promotion, ordre, renderMode, membership | Continuity + Quality | Réutiliser la fusion simplifiée V1 comme doctrine | **À CRÉER** |
| `CalendarSemanticItem` mensuel | `analytics_artifacts` | Artefact partagé typé et validé | Semantic + artifact store générique | Recalcul différent dans Month/Week/Journal | **À CRÉER** |
| Daily Economic ledger | facts économiques, timing, refunds, Actual | Ledger jour + `unassignedEconomicAmount`, réconcilié au centime | Timing V2 + Purchase Event | Fallback bancaire caché, double compte refund/split | **À CRÉER** |
| EconomicExpenseSummary | composants + Purchase Event + refunds | Grain d’achat humain, exclusions techniques, top 3 | Daily ledger | `operation_id` utilisé comme identité universelle | **À CRÉER** |
| `DailyEconomicLedger` mensuel | `analytics_artifacts` | Artefact partagé typé et validé | Daily engine | Ledger recopié par surface | **À CRÉER** |
| Ribbon/order/overflow | Calendar client V1 pour comparaison | Calcul serveur top3/top6, lanes 1–4, overflow | Semantic artifact | Maintenir la logique React en parallèle | **À CRÉER** |
| Journal owner/buckets | Day V1 + relations narrative/finance | Composition serveur zones A–D, propriétaire unique | Semantic + Daily | Double propriétaire narratif | **À CRÉER** |
| Month Overview | Month summary V1 + Analysis | Flows, repères, top5 highlights stable | Semantic + Daily + M1 | Sélection UI locale | **À CRÉER** |
| Bank Economy Bridge | bank/economic canonical + Actual | Pont additif + résiduel + reasons | M1 + Quality | Confondre Bank Date et Economic Timing | **À CRÉER** |
| Historical rank/usual zone | séries Analysis | Qualification déterministe avec support | Typical/history window | Rang sur mois non comparables | **À CRÉER** |
| TypicalCompositionBaseline | Typical existant | Conserver vrais mois pivots et composition | `calculateTypicalMonthCost()` | Recalculer une médiane indépendante | **À CRÉER** |
| CategoryExplanation | breakdown/marked facts | Contributions additives, drivers, compensator | Typical baseline + materialité | Sommes non réconciliées | **À CRÉER** |
| Nouveau/Réapparu | identités canoniques | Calcul conditionnel seulement | Fenêtre suffisante | Heuristique d’identité | **À CRÉER CONDITIONNEL** |
| Fréquence × ticket | Activity occurrences + coûts | Calcul sur activités répétables/supportées | M4 facts | Diviser par occurrences ambiguës | **À CRÉER** |
| M3 matrix/margins | Analysis axes + components | Matrice, gaps, marges additive/lower-bound | Component override | Héritage opération aveugle | **À CRÉER** |
| MinimalPreview | Minimal certifié | Projection 4 familles exclusives | Minimal source-aware + M3 | Recalculer Minimal dans la projection | **À CRÉER** |
| Activity score/detail | Activity facts + activity cost | Score, causal/associated, diagnostics | M4 | Fusion coût causal/associé | **À CRÉER** |
| Moment score/detail | Moment/LifeEvent + links finance | Rang, causal, spentDuring, media status | Semantic + Daily | during déduit par bank date | **À CRÉER** |
| Place score/detail | visits, canonical place, entities | Score, couverture localisée, hiérarchie | M4 + Quality | GPS/narration transformé en attribution financière | **À CRÉER** |
| Quality/visibility projection | Quality adapter | Fonction commune utilisée par tous les builders | Lot contrats partagés | Codes de reason divergents | **À CRÉER** |

### CREATE — quinze ressources Query

Toutes les ressources utilisent la même infrastructure existante : `resource-registry.ts`, `read-model-registry.ts`, `server/types.ts`, `server/adapter-registry.ts`, `server/validation.ts`, `capabilities/registry.ts`, `server/invalidation.ts`, puis un builder sous `src/server/query/sources/`. Les nouveaux modules de types/schemas devraient être regroupés sous un domaine `history-v2` afin de ne pas étendre les contrats V1 en place.

| Contrat cible | Fichiers/builders actuels à réutiliser | Modification nécessaire | Nouvelles pièces / identité | Dépendances | Risques | Statut |
|---|---|---|---|---|---|---|
| `history_month_calendar` | Calendar V1 + semantic/daily artifacts | Nouvelle projection, jamais extension incompatible du V1 | scope month, params `{}`; hover embarqué | G3–G5 | Deux ordres Calendar | **COMPATIBLE** |
| `history_month_overview` | summary V1 + Analysis + artifacts | Builder Overview | scope month, params `{}` | G7 | Dupliquer M1 | **COMPATIBLE** |
| `history_week` | primitives calendrier + semantic artifact | Builder 7 jours serveur | scope month=`referenceMonth` du jeudi, params ISO week | G5 | Semaine rattachée à deux publications | **COMPATIBLE SI RÈGLE DU JEUDI CENTRALISÉE** |
| `history_day_journal` | day V1 + semantic/daily artifacts | Builder Journal V2 | scope month de la date, param `date` | G6 | Jour et mois incohérents | **COMPATIBLE** |
| `history_month_balance_summary` | Analysis initial/evolution, metrics | Projection M1 | scope month, params `{}` | G8 | Copier payload Analysis | **COMPATIBLE** |
| `history_month_categories` | breakdown/structure | Liste et modes M2 | scope month, params `{}` | G9 | Liste différente du manifest detail | **COMPATIBLE** |
| `history_category_detail` | breakdown, Typical, marked facts | CategoryExplanation | param `categoryId` | G9 | Snapshot absent pour une catégorie visible | **COMPATIBLE** |
| `history_month_spending_nature` | axis structure + component facts | M3 axes/matrice/marges | scope month | G10 | Classification incomplète masquée | **COMPATIBLE** |
| `history_spending_segment_detail` | structure rows/contributors | Détail filtré | params axis/bucket validés | G10 | Signatures de paramètres non canoniques | **COMPATIBLE** |
| `history_minimal_preview` | Minimal resolver | Projection 4 familles | scope month | G10 | Total différent du Minimal | **COMPATIBLE** |
| `history_month_life_money` | lived/moments/entities | Rail/listes M4 | scope month | G11 | Payload page Analysis utilisé comme autorité | **COMPATIBLE** |
| `history_activity_detail` | activity facts/costs | Détail activité | param `activityTypeKey` | G11 | Confondre ID d’activité et type stable | **COMPATIBLE APRÈS CONTRAT D’ID** |
| `history_moment_detail` | entity moment + semantic/daily | Détail Moment | param `momentId` | G11 | spentDuring incomplet présenté comme connu | **COMPATIBLE** |
| `history_place_detail` | entity place + place facts | Détail lieu | param `placeId` | G11 | Finance localisée sans coverage | **COMPATIBLE** |
| `history_bank_economy_bridge` | bank/economic metrics | Projection bridge même si hidden | scope month | G8 | Ressource omise quand non affichable | **COMPATIBLE** |

`DayHoverReadModel` n’est pas une ressource supplémentaire : il doit rester un sous-contrat de `history_month_calendar`. Les détails paramétrés sont identifiés sans migration SQL supplémentaire, car `normalized_param_signature` et `query_key` incluent déjà les paramètres.

### BACKFILL et snapshots

| Contrat cible | Fichiers/tables actuels | Modification nécessaire | Nouvelles pièces | Dépendances | Risques | Statut |
|---|---|---|---|---|---|---|
| Trois données critiques | migration Purchase Event + futures migrations | Backfill best-effort depuis relations autoritaires seulement | Scripts/SQL ciblés revus humainement | Arbitrages + G1 | Valeurs inventées pour améliorer la complétude | **PARTIAL/UNKNOWN AUTORISÉ** |
| Artefact Semantic mensuel | `analytics_artifacts` | Calcul read-only puis Stage | profil artifact V2 | G3 | Mois certifié avec version de policy erronée | **COMPATIBLE** |
| Artefact Daily mensuel | `analytics_artifacts` | Calcul/réconciliation puis Stage | profil artifact V2 | G4 | `sum(days)+unassigned != Actual` | **COMPATIBLE** |
| Top-level mensuels | `analytics_query_snapshots` | Générer 8 ressources top-level par mois | manifest V2 | G5–G11 | Publication partielle | **COMPATIBLE** |
| Weeks/days | même table | Générer semaines par referenceMonth et chaque LocalDate | découverte déterministe | Calendar contracts | Duplications aux frontières de mois | **COMPATIBLE** |
| Drill-downs atteignables | même table | Dériver les IDs des ReadModels top-level certifiés, pas d’une liste parallèle | manifest d’instances | M2/M3/M4 | Lien UI vers snapshot absent | **COMPATIBLE** |
| Certification 12 mois | scripts `check-*`, runtime read-only | Ajouter checks History V2 et manifest des limitations | rapport de certification | 100% RuntimeSchema | Confondre PARTIAL légitime et FAIL de calcul | **COMPATIBLE** |
| Stage/Finalize | `backfill.ts`, store, fonction SQL | plus ancien → récent, une publication complète par mois | commande/profil explicite | G13 | Écriture depuis build ou navigateur | **COMPATIBLE** |

Le nombre exact de nouveaux snapshots ne peut pas être fixé à cette étape : il dépend des catégories, activités, moments, lieux, segments et semaines réellement atteignables dans chaque ReadModel top-level. Le manifest doit être produit avant `beginMonthPublication()` afin que `required_query_keys` soit exhaustif.

### RETIRE

| Élément | Consommateurs actuels | Remplacement | Condition de retrait | Risque | Statut |
|---|---|---|---|---|---|
| `history_calendar_month` V1 | routes Calendar, diagnostic, model/view, backfill | `history_month_calendar` | G15 + rollback window + recherche consommateur zéro | Casser Calendar/diagnostic | **KEEP JUSQU’AU CUTOVER** |
| `history_calendar_month_summary` V1 | model Calendar + backfill | `history_month_overview` | même condition | Casser navigation/summary | **KEEP JUSQU’AU CUTOVER** |
| `history_day_detail` V1 | route Month/Day, drawer, diagnostic, backfill | `history_day_journal` + hover Month | même condition | Perdre Day direct | **KEEP JUSQU’AU CUTOVER** |
| Grille hors mois React | `features/calendar/model.ts` | jours complets serveur | nouveau frontend branché V2 | Double source | **RETIRE G15/G16** |
| Top markers/+N React | `calendar-view.tsx:84` | ordre/hidden count serveur | nouveau frontend branché V2 | Ordres différents | **RETIRE G15/G16** |
| Layout ribbons client | `model.ts:133` | segments/lanes serveur | nouveau frontend branché V2 | Layout divergent | **RETIRE G15/G16** |
| Week dérivée client | `model.ts:282`, route Week multi-month | `history_week` | ressource active et route migrée | Mauvais referenceMonth | **RETIRE G15/G16** |
| Fusion Calendar V1 | `sources/calendar.ts` | Semantic Engine V2 | zéro ressource V1 consommatrice | Suppression prématurée d’un oracle | **RETIRE G16** |
| Ancien écran Analyse mensuel | `features/analysis/month/*`, route analyse month | Bilan M1–M4 | Bilan V2 stable | Casser navigation Calendar ↔ Analyse | **RETIRE APRÈS CUTOVER** |
| Payloads Analysis de page | Query `analysis_month_*` | moteurs internes conservés | audit Global + zéro consommateur | Supprimer des calculs encore nécessaires | **RETIRE PLUS TARD** |
| Signature Calendar legacy | `analyticsMethodSignature()` | policy registry V2 | aucune clé active dépendante après fenêtre rollback | Snapshot non reproductible | **RETIRE APRÈS ROLLBACK** |

## Moteurs Analysis à conserver comme moteurs internes

| Cible | Fonctions/moteurs réels à réutiliser | Ce qui doit être conservé | Ce qui ne doit pas devenir l’autorité V2 |
|---|---|---|---|
| M1 Balance | `readAnalysisMonthInitial()`, evolution, MetricQueryService, Actual/Typical/Minimal | calculs, métriques, support et réconciliation | forme du payload de page Analysis |
| M2 Categories | `groupsForDimension()`, `breakdownRows()`, `categoryStructure()`, `selectMarkedFacts()`, Typical | agrégations et seuils | cartes/onglets actuels |
| M3 Spending nature | `canonicalAxisStructure()`, `monthStructure()`, Minimal source-aware | axes canoniques, composants, Minimal | héritage opération aveugle des axes |
| M4 Life & money | `readAnalysisMonthLived()`, `readAnalysisMonthMoments()`, `contextSections()`, builders Entities | occurrences, contextes, destinations et métriques | ordering/presentation de page actuelle |
| Global futur | toutes les ressources `analysis_global_*`, Metric Registry, snapshots Analysis | calculs et références encore consommables | nettoyage opportuniste pendant History |

La factorisation éventuelle doit déplacer du calcul existant vers une primitive partagée appelée par V1 et V2, jamais copier la formule dans un nouveau builder.

## Risques de double source de vérité

1. Étendre les payloads `history_calendar_month`/`history_day_detail` jusqu’à y loger V2 au lieu de créer des contrats séparés.
2. Recalculer Actual, Typical, Minimal, materiality ou support dans les nouveaux builders.
3. Conserver les décisions marker/ribbon/week côté React après publication des décisions serveur.
4. Construire Month, Week et Journal chacun depuis Canonical au lieu de consommer le même artefact Semantic.
5. Construire Hover, Journal et spentDuring avec trois résolutions temporelles distinctes au lieu du ledger Daily partagé.
6. Modifier globalement `resolveHistoricalEconomicTiming()` pour V2 et changer silencieusement V1.
7. Créer des colonnes d’override différentes dans chaque table de composition au lieu d’une identité composante canonique commune.
8. Déduire les instances de drill-down depuis une requête séparée de celle qui produit les liens visibles.
9. Mettre `contractVersion=v2` dans le contexte global et rendre les snapshots V1 invisibles.
10. Retirer des builders Analysis parce que leur page disparaît alors qu’ils alimentent M1–M4 ou le futur Global.

## Dépendances techniques réelles

```text
Arbitrages temporels/continuité/factsHash
  → contrats communs V2 + versionnement par ressource
  → migrations canoniques ciblées
  → repository + facts + resolvers
  → Calendar Semantic artifact ─┐
  → Daily Economic artifact ────┼→ Month / Week / Journal / Overview
                                └→ M4 Moment/Place spentDuring

Analysis/Metric engines + component overrides
  → M1 → M2 → M3 → M4

Tous les builders
  → types + RuntimeSchemas + capabilities + invalidation
  → manifest d’instances
  → certification read-only 12 mois
  → Stage/Finalize atomique
  → cutover frontend
  → retrait legacy
```

## Ordre de développement / PR recommandé

Cet ordre garde chaque PR vérifiable et évite de construire toute la V2 dans une seule branche.

1. **PR 0 — Safety baseline** : figer le SHA, le manifest V1, les valeurs certifiées et les preuves rollback. Aucun schéma.
2. **PR 1 — Contracts/infrastructure** : Quality V2, Display, PublicationMeta, version de contrat par ressource, policy registry, store d’artefacts générique, profils de publication. Aucun nouveau calcul métier.
3. **Décision humaine A/B/C** : temporalité Purchase Event, portée/précédence continuity, granularité factsHash. Ne pas fusionner la PR canonique avant décision.
4. **PR 2A — Purchase Event** : compléter la migration non live, RLS/grants/intégrité, types/repository/fact/resolver, backfill autoritaire isolé.
5. **PR 2B — Component classification + continuity** : migrations séparées et ciblées, loaders/facts, backfill best-effort avec UNKNOWN explicite.
6. **PR 3 — Fact compatibility** : préserver la source de timing dans les facts et introduire la policy V2 sans modifier les résultats V1.
7. **PR 4 — Calendar Semantic** : moteur pur, cas obligatoires, artefact mensuel versionné.
8. **PR 5 — Daily ledger** : date effective, refunds, unassigned, expense summary, invariant au centime, artefact mensuel.
9. **PR 6 — Calendar Query V2** : Month + hover + Week + Journal + Overview, types/schemas/capabilities inclus avec chaque ressource.
10. **PR 7 — Bilan M1/M2** : façades des moteurs existants, bridge, pivots Typical, category explanations.
11. **PR 8 — Bilan M3/M4** : matrice, MinimalPreview, Activity/Moment/Place et détails.
12. **PR 9 — Manifest/materialization** : découverte des instances atteignables, profil History V2, tests de clé/contrat/policy, aucune activation.
13. **PR 10 — Certification read-only** : douze mois, 100% RuntimeSchema, manifest KNOWN/PARTIAL/UNKNOWN et non-régression V1.
14. **PR 11 — Backfill/publication** : Stage/Finalize séquentiel, preuve coexistence V1/Analysis, service snapshot sans read-through inattendu, rollback.
15. **PR 12 — Frontend V2** : routes et composants contre les seules ressources V2 ; suppression des calculateurs client dans la même PR ou la suivante.
16. **PR 13 — Cutover/retire** : fenêtre d’observation, recherche zéro consommateur, retrait History V1/UI Analysis redondante ; moteurs Analysis/Global préservés.

Pour chaque PR de moteur : type → parser RuntimeSchema → calcul pur → builder Query → validation croisée → check ciblé. Pour chaque PR Supabase : migration ciblée, revue humaine, validation RLS/advisors, puis seulement application explicite.

## Écarts avec le document ChatGPT

| Point du document | Réalité du repository | Ajustement nécessaire | Nature |
|---|---|---|---|
| Coexistence V1/V2 | Le SQL la permet par clé logique ; l’app utilise un contrat global | Ajouter version par ressource, garder des noms V2 distincts | Technique, non métier |
| Publication V2 additive | SQL générique, store mensuel lié à `analysis_month_initial` et 3 métriques | Profil de publication explicite | Technique |
| Deux artefacts dans le store actuel | Table compatible, types/store metric-only | Généraliser la couche applicative et valider chaque payload | Technique |
| Purchase Event daté | Migration présente mais identité seulement, non live, sans RLS | Compléter avant application | Contrat + sécurité |
| PARTIAL via MetricEnvelope | Type actuel interdit une valeur non nulle hors `known` | Adapter V2 séparé/commun, ne pas casser V1 | Technique |
| `factsHash` dans PublicationMeta | Aucun calcul/stockage/semantics actuel | Définir portée puis implémenter dans meta V2 | Arbitrage requis |
| Aucun bank fallback V2 | Le fallback est central et sa source est perdue dans le fact | Conserver source/policy et filtrer côté V2 seulement | Technique, protège V1 |
| `continuityQualifier` | Aucun champ actuel ; seulement `can_span_days` et champs Calendar legacy | Migration + precedence explicite | Arbitrage requis |
| Toutes instances atteignables | Backfill actuel découvre seulement catégories/targets Analysis | Découverte V2 depuis top-level avant Begin | Technique |
| Tests/gates | Aucun framework de tests unitaire détecté ; scripts `check-*` | Étendre les checks ou décider une convention dédiée | Technique |
| Schéma versionné dans Git | Les tables Canonical de base ne sont pas créées par les migrations du dépôt | Toute migration V2 doit être autonome et vérifiée contre live | Gouvernance |
| KNOWN/PARTIAL/UNKNOWN par mois | Mesure impossible avant facts/migrations/moteurs | Produire au G13, pas dans cette validation | Séquencement |

## Questions nécessitant arbitrage ChatGPT

### A — Temporalité du Purchase Event

Le plan exige une temporalité économique autoritaire/source-aware, nullable. Il faut fixer l’ordre exact lorsque plusieurs sources d’un même Purchase Event portent des dates différentes ou conflictuelles : date explicite de l’événement, timing composant, Cash Use, opération fiable. Choisir une source plutôt que `UNKNOWN/CONFLICT` change le jour économique et le Hover/Journal.

**Décision attendue** : precedence complète, représentation des conflits, et droit ou non à une date au mois sans jour exact.

### B — Portée de `continuityQualifier`

Le plan ne précise pas si le qualifier appartient au type de Life Event, à chaque Life Event, ou aux deux avec override. Un default de type et un override événement produisent des ribbons différents sur l’historique.

**Décision attendue** : niveau de stockage, precedence, et comportement d’un événement `UNKNOWN` dont le type est `EXPLICIT_CONTINUITY`.

### C — Granularité de `factsHash`

Trois identités sont possibles : hash des faits canoniques du household-mois, hash des inputs de chaque artefact, ou hash des inputs de chaque ressource. Elles ne donnent pas la même notion de `CURRENT/STALE` et pas le même coût d’invalidation.

**Décision attendue** : objet exact hashé et usage autoritaire pour PublicationMeta/imported summary. La recommandation technique est de ne pas l’ajouter à la query key tant que cette sémantique n’est pas fixée.

### D — Atomicité de l’override composant

Une source historique peut prouver `necessity` sans prouver `behavior` ou `lifeScope`. Le plan doit dire si l’override est champ par champ, ou un triplet atomique. Ce choix change les cellules M3 et le statut PARTIAL.

**Décision attendue** : granularité de l’override et règle de fallback par axe.

## Décisions techniquement impossibles

- **Aucune décision d’architecture n’est impossible.**
- La migration Purchase Event actuelle ne peut toutefois pas satisfaire seule le contrat « Purchase Event daté » ; elle doit être complétée avant application.
- Une qualification historique exacte KNOWN/PARTIAL/UNKNOWN des douze mois ne peut pas être produite avant la création des trois données critiques et des moteurs ; ce résultat appartient au gate G13.
- Un cutover frontend avant G14 serait techniquement possible, mais contraire au plan de sûreté et créerait une dépendance à du read-through non certifié ; il n’est donc pas recommandé.

## Gate final

**ARCHITECTURE_GATE = PASS**

Le plan est compatible avec le repository réel et peut entrer en **LOT 0 / PR 0**. Ce PASS ne préautorise aucune écriture Supabase et ne résout pas les arbitrages A–D. Les PR portant Purchase Event, continuity, `factsHash` ou classification composante restent bloquées jusqu’aux décisions indiquées.

Conditions obligatoires de maintien du PASS :

- migration additive et contrats V2 séparés ;
- versionnement de contrat/policies par ressource ;
- preservation byte-for-byte des résultats V1 certifiés hors révision humaine ;
- deux artefacts partagés validés dans le store existant, sans table parallèle ;
- aucune logique métier V2 dans React ;
- certification read-only complète avant Stage/Finalize ;
- aucune suppression History/Analysis avant zéro consommateur, rollback prouvé et protection du futur Global.
