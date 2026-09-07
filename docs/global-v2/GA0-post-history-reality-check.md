# GA0 — Post-History Reality Check — Analyse Globale V2

## 1. Executive verdict

`GA0_ENTRY_GATE = PASS`.

La fondation History finale est compatible avec la cible Global. Elle fournit les autorités économiques, les Facts principaux, les doctrines Moment/Place, les enveloppes de qualité et un modèle de publication durable réutilisable. Global doit toutefois adapter le scope temporel, la projection financière par personne, la closure, le profil de publication, les guards d'immutabilité, le cache générationnel et le mode Query afin de devenir snapshot-only et fail-closed.

Il n'existe ni publication Global live, ni artifact/snapshot Global actif. Les neuf ressources `analysis_global_*` présentes sont `legacy_v1`, calculées dynamiquement et fondées sur une fenêtre universelle; elles décrivent l'existant à retirer, pas la cible. Aucun conflit sémantique History n'a été découvert.

Les capacités mobilité, produit/cycles et contacts/social restent explicitement gated. Le core A→E, le core personne fondé sur preuves et la conception H peuvent avancer sans les inventer. PurchaseEvent dispose d'un schéma et d'un Fact, mais ses tables live sont vides : c'est un besoin de données Canonical, non une permission de déduire un achat d'une opération bancaire.

## 2. Baseline History finale utilisée

- Branche : `main`.
- Commit : `9a70f9b1643747f8d60214cf66c94f58d193112c`.
- `POST_HISTORY_ENTRY_GATE = PASS`, HC6 fermé.
- Fenêtre certifiée : `2025-08` → `2026-07`.
- Live : 12 publications, 947 Query snapshots, 24 artifacts, 12 manifests, 971 closures.
- Révisions : `dataRevision=1`, `analyticsRevision=79`.
- Runtime : snapshot-only, fail-closed, zéro read-through, cache générationnel, générations immuables.
- Doctrine : correction métier par nouvelle génération; anciennes générations conservées et inactives.

Preuves : `docs/history-v2/25-history-core-analytics-authority-report.md` à `30-post-history-entry-gate.md`, migrations HC3/HC4 et implémentations `src/analytics/history-v2/*`, `src/server/analytics/materialization/*`.

## 3. Sources lues

Ordre d'autorité appliqué :

1. `AGENTS.md`.
2. `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx` extrait du bundle Master fourni.
3. Annexes intégrées au Master : requirements, capability scope, authority gates, tests et plan conceptuel.
4. Les rapports History 25→30.
5. `GLOBAL-IMPLEMENTATION-MAP-PRE-HISTORY-FINAL.md` et `GLOBAL-CODEX-PROMPT-PACK-PRE-HISTORY-FINAL.md`, utilisés uniquement comme plans préparatoires.
6. `docs/specs/SOURCE_OF_TRUTH.md`, `docs/specs/SUPABASE_V2_REFERENCE.md`, `docs/specs/ANALYTICS_MATERIALIZATION.md`.
7. Code, migrations et schéma live comme réalités d'implémentation/physiques.

Le répertoire `docs/global-v2/prep-audits` et les audits Global 01→08 ne sont pas présents dans le repository. Le Master demeure suffisant et supérieur aux deux documents préparatoires externes.

## 4. Current repository state

### Autorités disponibles

- `CanonicalRepository` lit les opérations, composants, classifications, continuités, PersonDays, PlaceVisits, Activity occurrences/costs et PurchaseEvents.
- `FactSourceResolver` et le registre de production exposent 16 métriques actuelles, dont Actual, Typical mensuel, Minimal, category amount, localized spend, activity frequency/cost, person days, place visits et purchase count.
- Les Facts actuels sont `EconomicComponentFact`, `ActivityOccurrenceFact`, `ActivityOccurrenceCostFact`, `PersonDayFact`, `PurchaseEventFact`, `PlaceVisitFact`.
- `shared-doctrines.ts` ferme les séparations causalCost/spentDuring, présence/visite/transaction/finance localisée, coût Activity causal et classification M3.
- Les primitives MetricEnvelope/knowledge/support/coverage/provenance sont partagées et réutilisables.
- HC3/HC4 fournissent dependency manifest, resource/publication hashes, immutabilité et génération History.

### Écarts structurants

- `AnalysisTime` global impose actuellement `observationWindow`; la cible exige une fenêtre naturelle par analyse et des bornes séparées `asOf`, `certifiedThrough`, `liveThrough?`.
- `EconomicComponentFact.person` existe mais le projecteur Canonical pose actuellement `unknown`; les 128 liens explicites live ne sont pas projetés.
- `marked_facts_materiality_v1` ne couvre que total/category et ne constitue pas le moteur de matérialité/insight selection Global complet.
- Typical et Minimal officiels sont limités au mois dans le registre; Global doit les consommer via des références produites au bon grain, pas les réimplémenter.
- `global-planner.ts` ne sait agréger sûrement que des métriques mensuelles strictement additives.
- Les guards SQL HC3/HC4, le lecteur de manifest, le rebuild et le cache sont spécialisés History/month.
- Le chemin Query actuel n'est fail-closed que pour la famille `history_v2`; les ressources Global v1 font encore computation/read-through.

## 5. Current Supabase state

Inspection read-only du projet `ipuuhxrblxormwgoaqnz` :

| Domaine | État physique constaté |
|---|---|
| Révisions | `dataRevision=1`, `analyticsRevision=79` |
| Global matérialisé | aucune publication Global; aucun snapshot actif `analysis_global_*` |
| History | baseline de la section 2 confirmée |
| Économie | 1 484 composants; 1 660 opérations |
| Vie/Moment | 922 LifeEvents; 1 142 participations; 42 Moments; 57 liens Moment/LifeEvent |
| Personne | 2 personnes; 128 `financial_source_person_links`; 736 PersonDays |
| Lieux | 2 375 occurrences; `operation_place` : 136 KNOWN, 777 UNKNOWN, 571 NOT_APPLICABLE, 0 CONFLICT |
| PurchaseEvent | tables/contraintes présentes, 0 event/membership/timing |
| Classification composante | table canonique présente, 0 ligne; le fallback officiel History ne doit pas devenir heuristique Global |
| Routine Place | `person_place_roles` présente, 0 ligne |
| Mobilité | `vehicles`, `route_distances`, `fuel_price_observations` présentes, 0 ligne; pas d'identité MobilityLeg/RouteDefinition |
| Produit | 72 `operation_items`, 18 observations produit, 7 observations prix; pas de ProductFamily/Variant/Format/unit identity canonique complète |
| Contacts | aucune table Contact, ContactAlias, ContactRelation ou ContactGroup |
| Publication | `analytics_publications.dependency_manifest` existe; scope month/global supporté |

Aucune écriture, migration, publication, RPC mutante ou modification de revision n'a été exécutée.

## 6. History → Global reuse matrix

Le registre ci-dessous attribue une classification unique à chaque pièce structurante. Les adaptations n'autorisent aucune deuxième vérité métier.

| ID | Pièce | Classification | Preuve et décision exacte |
|---|---|---|---|
| H01 | `CanonicalRepository` | `REUSE` | Autorité d'accès Canonical; étendre seulement ses lectures si un input nouveau est autorisé. |
| H02 | `FactSourceResolver` | `REUSE` | Résout les Facts/Analytics officiels; aucun oracle en production. |
| H03 | `EconomicComponentFact` / projection personne | `ADAPT` | Conserver le Fact; projeter les liens explicites avec coverage, sans payer⇒bénéficiaire. |
| H04 | Classifications M3 | `REUSE` | Doctrine/fallback History officiels; aucune heuristique textuelle concurrente. |
| H05 | Actual | `REUSE` | Economic Actual officiel, jamais bank flow. |
| H06 | Typical | `ADAPT` | Réutiliser l'Analytics officiel; produire des références Global avec fenêtres/support propres. |
| H07 | Minimal | `ADAPT` | Même règle; les preuves certifiées restent compare-only. |
| H08 | Materiality existante | `ADAPT` | Généraliser au catalogue Global, aux ties, support et anti-redondance. |
| H09 | Knowledge states | `REUSE` | KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE/CONFLICT et raisons. |
| H10 | Support | `REUSE` | Enveloppe partagée, extensions seulement par contrat. |
| H11 | Coverage | `REUSE` | Numérateur/dénominateur prouvés; aucun 100 % implicite. |
| H12 | Provenance | `REUSE` | Conserver sources, evidence refs et lineage. |
| H13 | Activity Facts | `REUSE` | Occurrences et coûts causaux disponibles. |
| H14 | Moment causal semantics | `REUSE` | causalCost distinct de spentDuring; lien explicite seulement. |
| H15 | Place doctrine/facts | `REUSE` | présence, visite, transaction et finance localisée restent séparées. |
| H16 | `PersonDayFact` | `REUSE` | Exposition/person-day disponible avec couverture. |
| H17 | `PlaceVisitFact` | `REUSE` | Visite Canonical, sans inférence financière. |
| H18 | `PurchaseEventFact` et concept | `REUSE` | Contrat présent; l'absence de lignes produit UNKNOWN, pas opération⇒achat. |
| H19 | Artifacts partagés | `ADAPT` | Référencer les autorités amont/hashées; ne pas concaténer les artifacts/RMs History. |
| H20 | Dependency closure | `ADAPT` | Généraliser le manifest v2 aux dépendances/fenêtres Global. |
| H21 | Revision/invalidation | `ADAPT` | Scope Global et lookbacks par ressource; conserver data/analytics revisions. |
| H22 | Publication | `ADAPT` | Nouveau profil Global; tables communes, guards/handshake Global à concevoir. |
| H23 | Cache generation identity | `ADAPT` | Généraliser l'identité month/History à la génération Global. |
| H24 | RuntimeSchema primitives | `ADAPT` | Réutiliser parseurs/enveloppes; créer les schemas propres aux nouveaux RMs. |
| H25 | Query/materialization primitives | `ADAPT` | Staging/finalize/rollback réutilisables; rendre Global snapshot-only/fail-closed. |

## 7. Foundations classification

| ID | Fondation cible | Classification | Décision |
|---|---|---|---|
| F01 | `AnalysisScope` Global | `ADAPT` | Retirer la sémantique universelle de `observationWindow`; porter identités et scopes stricts. |
| F02 | Résolution `asOf/certifiedThrough/liveThrough` et natural windows | `NEW_ENGINE` | Un resolver serveur détermine les bornes admissibles par famille; LT reste descriptif. |
| F03 | Manifest/dépendances Global | `ADAPT` | Étendre le format HC3 sans réutiliser un payload History comme input métier. |
| F04 | Person scope | `ADAPT` | Coverage et intersections; attribution explicite seulement. |
| F05 | Capability/entity scope registry | `ADAPT` | Passer de simples maxima Query à des capacités avec authority/knowledge states. |
| F06 | ReadModels/RuntimeSchemas Global cible | `NEW_READMODEL` | Projections propres Global; les RMs v1 ne sont pas une base doctrinale. |
| F07 | Trend/recent change | `NEW_ENGINE` | 3 vs 3 récent, Theil-Sen moyen et règles de support/no-lookahead. |
| F08 | Stability/change point/regime | `NEW_ENGINE` | Median/MAD/IQR, persistence et phases versionnées. |
| F09 | Global Materiality | `NEW_ENGINE` | Composite support-aware, distinct de la sélection UI. |
| F10 | Insight selection | `NEW_ENGINE` | Déterministe, anti-redondance, evidence refs; serveur seulement. |

## 8. M1→M10 classification

| ID | Module / pièce | Classification | Réalité et owner |
|---|---|---|---|
| M01 | M1 bridge/résidual/références/équivalents structurels | `NEW_ENGINE` | B2; réutilise Actual/Typical/Minimal. |
| M02 | M1 Global RM | `NEW_READMODEL` | H3/H4. |
| M03 | M2 Category/Need core | `NEW_ENGINE` | B3; category amount/Typical/classifications réutilisés. |
| M04 | M2 purchase/merchant explanations | `NEW_ENGINE` | F puis recert B; interdit avant PurchaseEvent Canonical peuplé. |
| M05 | M2 Global RMs | `NEW_READMODEL` | H3/H4. |
| M06 | M3 transformations/change points/regimes | `NEW_ENGINE` | C2; classification M3 réutilisée. |
| M07 | M3 Global RMs | `NEW_READMODEL` | H3/H4. |
| M08 | M4 Activity cadence/routine/seasonality | `NEW_ENGINE` | C3 core; grains occurrence/day/exposition. |
| M09 | M4/M7 Place routine role | `AUTHORITY_GATED` | Table vide et aucune doctrine autorisant label répété⇒routine. |
| M10 | M4 Global RMs | `NEW_READMODEL` | H3/H4. |
| M11 | M5 RelationshipEngine core | `NEW_ENGINE` | D2; B/C uniquement au premier passage. |
| M12 | M5 Global RMs | `NEW_READMODEL` | H3/H4. |
| M13 | M6 Moment analytics | `NEW_ENGINE` | E2; causalCost/spentDuring History réutilisés. |
| M14 | M6 Global RMs | `NEW_READMODEL` | H3/H4. |
| M15 | M7 Place core/lifecycle/localized finance | `NEW_ENGINE` | E3a; doctrine Place et coverage History. |
| M16 | M7 Mobility/route/fuel | `AUTHORITY_GATED` | AG001/006-011/023 indisponibles. |
| M17 | M7 Global RMs | `NEW_READMODEL` | H3/H4. |
| M18 | M8 Purchase/Merchant core | `NEW_ENGINE` | F2 conditionnel. |
| M19 | Population Canonical PurchaseEvent | `NEW_DATA` | Tables/Fact prêts mais 0 ligne; pas de backfill heuristique. |
| M20 | M8 Product/cycles/price index | `AUTHORITY_GATED` | AG002-004/012-022 indisponibles. |
| M21 | M8 Global RMs | `NEW_READMODEL` | H3/H4, avec capabilities explicites. |
| M22 | M9 PersonaDifferenceEngine | `NEW_ENGINE` | G2, support comparable/intersection/hysteresis. |
| M23 | M9 Global RMs | `NEW_READMODEL` | H3/H4. |
| M24 | M10 SharedParticipationResolver | `NEW_ENGINE` | G3a; preuves participantes exactes, pas faux couple/50-50. |
| M25 | M10 Contact/social | `AUTHORITY_GATED` | AG024-031; schéma/autorité absents. |
| M26 | M10 Global RMs | `NEW_READMODEL` | H3/H4; sections gated visibles comme telles. |

### Nouvelles métriques identifiées

Elles utilisent les moteurs ci-dessus et le registre officiel; elles ne sont pas des calculs React.

| ID | Métrique | Classification | Owner |
|---|---|---|---|
| X01 | structural monthly equivalent / recurrence contribution | `NEW_METRIC` | B2 |
| X02 | recent/medium/long change qualification | `NEW_METRIC` | C2 |
| X03 | historical rank/current regime position | `NEW_METRIC` | C2 |
| X04 | normalized cadence/routine rate | `NEW_METRIC` | C3 |
| X05 | relationship effect/uncertainty/robustness | `NEW_METRIC` | D2 |
| X06 | Moment peer/gross-net/repetition metrics | `NEW_METRIC` | E2 |
| X07 | Place significance/lifecycle/localized coverage | `NEW_METRIC` | E3a |
| X08 | retained purchase/frequency/ticket decomposition | `NEW_METRIC` | F2 conditionnel |
| X09 | persona normalized difference/materiality | `NEW_METRIC` | G2 |
| X10 | shared participation/support metric | `NEW_METRIC` | G3a |

`NEW_FACT = 0` à GA0 : les Facts actuels couvrent le core prouvable. La personne exige l'adaptation de `EconomicComponentFact`, pas un doublon. Les futurs Mobility/Product/Contact facts restent derrière authority gates et ne sont pas autorisés tant que leurs identités ne sont pas définies.

## 9. Authority-gated final status

La règle d'état est stricte : une table brute ou un FK partiel ne rend pas disponible une capacité dont l'identité/méthode autoritaire manque.

| ID | Gate | État physique | Classification | Preuve / sortie bloquée |
|---|---|---|---|---|
| AG001 | Fuel resolver partagé | `UNAVAILABLE` | `AUTHORITY_GATED` | Sources véhicule/route/fuel vides; M7 fuel. |
| AG002 | Purchase cycle engine | `UNAVAILABLE` | `AUTHORITY_GATED` | Aucun PurchaseEvent live/product identity; M8 cycles. |
| AG003 | Product price analytics | `UNAVAILABLE` | `AUTHORITY_GATED` | 7 observations sans identité comparable complète. |
| AG004 | Personal price index | `UNAVAILABLE` | `AUTHORITY_GATED` | Unités/produits/person attribution insuffisants. |
| AG005 | Contact/social identity | `UNAVAILABLE` | `AUTHORITY_GATED` | Tables Contact absentes. |
| AG006 | Structured MobilityLeg | `UNAVAILABLE` | `AUTHORITY_GATED` | Aucun type/table/Fact MobilityLeg. |
| AG007 | RouteDefinition | `UNAVAILABLE` | `AUTHORITY_GATED` | Aucune identité de route. |
| AG008 | Route frequency | `UNAVAILABLE` | `AUTHORITY_GATED` | AG006/007 absents. |
| AG009 | Distance analysis | `UNAVAILABLE` | `AUTHORITY_GATED` | `route_distances` vide, route non identifiée. |
| AG010 | Fuel resolver M7 | `UNAVAILABLE` | `AUTHORITY_GATED` | AG001 absent. |
| AG011 | Estimated fuel cost | `UNAVAILABLE` | `AUTHORITY_GATED` | véhicule/distance/prix absents. |
| AG012 | `PurchaseLineFact` | `UNAVAILABLE` | `AUTHORITY_GATED` | 72 items bruts ne prouvent pas l'identité achat/produit cible. |
| AG013 | ProductFamily | `UNAVAILABLE` | `AUTHORITY_GATED` | Autorité canonique absente. |
| AG014 | ProductVariant | `UNAVAILABLE` | `AUTHORITY_GATED` | Autorité canonique absente. |
| AG015 | ProductFormat | `UNAVAILABLE` | `AUTHORITY_GATED` | Autorité canonique absente. |
| AG016 | Normalized unit | `UNAVAILABLE` | `AUTHORITY_GATED` | Unités comparables non contractées. |
| AG017 | ProductAcquisitionOccurrence | `UNAVAILABLE` | `AUTHORITY_GATED` | PurchaseEvent live vide et produit non résolu. |
| AG018 | Product cadence | `UNAVAILABLE` | `AUTHORITY_GATED` | AG017 absent. |
| AG019 | Product lifecycle | `UNAVAILABLE` | `AUTHORITY_GATED` | AG013-018 absents. |
| AG020 | Product substitution | `UNAVAILABLE` | `AUTHORITY_GATED` | Comparable product identity absente. |
| AG021 | Personal price index | `UNAVAILABLE` | `AUTHORITY_GATED` | Même limite AG004, aucune variante/unité/personne complète. |
| AG022 | Enriched PersonalReferenceCost | `UNAVAILABLE` | `AUTHORITY_GATED` | Enrichissement prix/produit/personne absent. |
| AG023 | Shared MobilityLeg inference | `UNAVAILABLE` | `AUTHORITY_GATED` | Aucun MobilityLeg ni participants autoritaires. |
| AG024 | Named external contacts | `UNAVAILABLE` | `AUTHORITY_GATED` | Contact absent. |
| AG025 | Social groups | `UNAVAILABLE` | `AUTHORITY_GATED` | ContactGroup absent. |
| AG026 | Advanced shared activity contacts | `UNAVAILABLE` | `AUTHORITY_GATED` | Contacts absents; participations personne ne suffisent pas. |
| AG027 | Canonical Contact consumption | `UNAVAILABLE` | `AUTHORITY_GATED` | Contact absent. |
| AG028 | ContactAlias | `UNAVAILABLE` | `AUTHORITY_GATED` | Schéma absent. |
| AG029 | ContactRelation | `UNAVAILABLE` | `AUTHORITY_GATED` | Schéma absent. |
| AG030 | ContactGroup | `UNAVAILABLE` | `AUTHORITY_GATED` | Schéma absent. |
| AG031 | Contact participation analytics | `UNAVAILABLE` | `AUTHORITY_GATED` | Identités et participation Contact absentes. |

Éléments partiels mais non contournés : les participations LifeEvent sont disponibles pour des personnes internes; les liens financiers explicites sont disponibles mais non projetés et leur couverture doit être calculée; la localisation financière est partielle; les observations produit sont des preuves brutes, pas des identités de produit. Aucun de ces éléments ne ferme les gates ci-dessus.

## 10. Legacy Global inventory / cutover map

| ID | Élément actuel | Rôle/consommateurs | Classification | Owner retrait |
|---|---|---|---|---|
| L01 | `analysis_global_initial` | bootstrap route Global v1 | `REMOVE_LEGACY` | H6 |
| L02 | `analysis_global_baseline` | baseline calculée dynamiquement | `REMOVE_LEGACY` | H6 |
| L03 | `analysis_global_typical` | typical v1 | `REMOVE_LEGACY` | H6 |
| L04 | `analysis_global_breakdown` | breakdown v1 | `REMOVE_LEGACY` | H6 |
| L05 | `analysis_global_evolution` | série v1 dynamique | `REMOVE_LEGACY` | H6 |
| L06 | `analysis_global_contexts` | contextes v1 | `REMOVE_LEGACY` | H6 |
| L07 | `analysis_global_habits` | top activity ad hoc | `REMOVE_LEGACY` | H6 |
| L08 | `analysis_global_profiles` | profils/ranks ad hoc | `REMOVE_LEGACY` | H6 |
| L09 | `analysis_global_universe` | galeries legacy | `REMOVE_LEGACY` | H6 |
| L10 | Types/schemas/validation Global v1 | contrat `legacy_v1` | `REMOVE_LEGACY` | H4/H6 |
| L11 | Builders dans `server/query/sources/analysis.ts` | agrégations, top-N, profils, fenêtre universelle | `REMOVE_LEGACY` | H4/H6 |
| L12 | Route/page Global v1 | orchestre les ressources v1 | `REMOVE_LEGACY` | H5/H6 |
| L13 | Composants `features/analysis/global/*` | affichage v1; primitives visuelles seulement copiables, pas le contrat | `REMOVE_LEGACY` | H5/H6 |
| L14 | Tests/registry/store contracts v1 | protègent le legacy jusqu'au cutover | `REMOVE_LEGACY` | H6 après inventaire consumers |

Les neuf ressources sont explicitement `legacy_v1` dans `resource-contract.ts`. Le serveur calcule aujourd'hui médianes, ranks, top lists et profils dans le builder Query; leur présence ne justifie aucun `REUSE`. Leur retrait est atomique avec le nouveau cutover, jamais anticipé.

## 11. Global scope / natural-window decision

Décision ferme : aucune `observationWindow` universelle n'est métier pour M1→M10.

- L'identité Global sépare `asOf` (instant de requête/génération), `certifiedThrough` (borne d'autorité historique) et `liveThrough?` (borne descriptive optionnelle).
- Chaque ressource déclare grain naturel, support minimum, lookback, gaps et intersection comparable.
- M1/M2/M3 utilisent souvent des séries mensuelles sans convertir les occurrences M4/M6/M7/M8 au mois par facilité.
- M4 repose sur occurrences/jours exposés; M6 sur Moments/cohortes; M7 sur visites/places; M8 sur achats; M9/M10 sur intersections comparables.
- Aucun trou n'est rempli par zéro. Aucune période incomplète n'est qualifiée comme structurelle.

Le contrat exact des types/hashes est à geler en A1; la doctrine est suffisamment définie pour commencer A1 sans hypothèse inventée.

## 12. Publication/runtime reuse/adapt decision

Les tables communes, Begin/Stage/Finalize, révisions, snapshots, artifacts, rollback et lineage sont réutilisables comme primitives. Les éléments spécialisés History doivent être adaptés :

- profil de publication Global et required keys;
- manifest Global avec natural windows, fact/entity deps et cross-phase closures;
- `publicationFactsHash`, `resourceInputHash`, `manifestHash` au périmètre Global;
- handshake/guards d'immutabilité Global;
- identité de cache générationnelle Global;
- Query Global snapshot-only/fail-closed;
- invalidation par dépendance/lookback, pas par fenêtre universelle.

La décision `FULL RESTAGE` versus `IMMUTABLE ARTIFACT REUSE CROSS-GENERATION` est reportée à H1. Le schéma actuel permet les deux directions mais ne prouve pas encore laquelle minimise le risque sans dupliquer les manifests. H1 devra mesurer closure, atomicité, rollback et taille avant décision; ce report ne bloque pas A1.

## 13. LIVE_TAIL / CERTIFIED_HISTORY boundary

- `CERTIFIED_HISTORY` est l'autorité pour trend structurel, change point, phase, régime et conclusion historique.
- `LIVE_TAIL` est descriptif, explicitement étiqueté, séparé dans support/coverage/provenance.
- LT seul ne peut créer ni persistance ni phase. Une future certification peut intégrer ces données dans une nouvelle génération.
- Le Global v1 viole potentiellement cette frontière : `documentedGlobalMonths` et les builders dynamiques utilisent le corpus courant sans identité distincte `certifiedThrough/liveThrough`.
- Correction attendue en A/H : bornes structurées, dependency hash et snapshot-only; aucun patch client.

## 14. Client Analytics leak audit

Les composants React actuels affichent principalement les payloads; aucun moteur de trend, causalité, persona, Place, Moment ou Consumption complet n'y a été trouvé. Quelques filtres/formatages de présentation existent et ne sont pas une autorité.

La fuite critique est serveur-Query : `src/server/query/sources/analysis.ts` calcule médianes, counts, ranks, top-N, profils et sélection ad hoc au moment de la requête. Ces calculs ne survivront pas au cutover. La cible impose Analytics/artifacts → RMs sélectionnés côté serveur → snapshots → React. Un futur top-N/materiality/ranking dans React serait `CLIENT_ANALYTICS_LEAK` et un hard stop.

## 15. GLOBAL_ANALYTICS_DEPENDENCY_MATRIX

La matrice physique complète est dans [GLOBAL_ANALYTICS_DEPENDENCY_MATRIX.md](./GLOBAL_ANALYTICS_DEPENDENCY_MATRIX.md). Elle couvre moteurs, sources Canonical, Facts, analytics amont, dépendances inter-modules, grains, fenêtres, scopes, policies, versions, closures, publication, invalidation, owner phase et régressions.

## 16. Final DAG / dependency graph

```text
History final / Canonical / Facts / Analytics officiels
  → GA0
  → A: scope, natural windows, quality, dependency/capability contracts
  → B: M1 + M2 core (sans M8)
  → C: M3 + M4 Activity core
  → D: M5 core sur familles B/C
  → E: M6 Moment + M7 Place core
  → recertification D ciblée si E ouvre des familles relationnelles
  → F: M8 seulement après PurchaseEvent Canonical; produit reste gated
  → recertifications B/D ciblées si F change leurs closures
  → G: M9 + M10 core sur métriques stabilisées et preuves personne
  → H: profil Global, RMs, RuntimeSchemas, Query, UI et cutover legacy
  → GC1: certification exhaustive déterministe
  → GC2: publication après autorisation humaine
```

Parallélismes sûrs après A : préparation B1 delta et C1 policies; après D core : E2 et E3a peuvent avancer séparément. Les branches Place routine, mobilité, produit et contacts restent conditionnelles et ne bloquent pas le core.

## 17. Anti-cycle decisions

- **M2 ↔ M8** : M2 core est category/Need/Typical/contributors sans achat. M8 peut plus tard enrichir drivers merchant/purchase; cela déclenche une recertification B ciblée par closure.
- **M5 ↔ M6/M7/M8** : D core consomme B/C uniquement. E/F ajoutent des familles relationnelles dans de nouvelles sorties; elles déclenchent une recertification D ciblée, jamais une dépendance inverse du moteur E/F vers son propre résultat.
- **Persona/social** : G consomme les résultats stabilisés. Aucun seuil ou moteur amont n'est modifié pour créer une différence plus spectaculaire.
- **History/Global** : Global dépend des autorités amont/hashes History, jamais de RMs History assemblés; History ne dépend pas de Global.

## 18. Cross-phase recertification map

| Événement | Closure à recalculer | Recertification minimale |
|---|---|---|
| E2 ouvre Moment relation family | M5 relation catalog + RMs concernés | D ciblé, puis downstream H |
| E3a ouvre Place relation family | M5 Place relations | D ciblé |
| PurchaseEvent Canonical devient peuplé | M8, M2 purchase drivers, M5 purchase relations | F, puis B/D ciblés |
| Person financial coverage change | M9/M10 et modules person-scoped | G + RMs dépendants |
| Authority mobilité fermée | M7 mobility et éventuelles relations | E3b + D ciblé |
| Authority produit fermée | M8 product/cycles/index | F3/F4 + B/D/G selon manifest |
| Authority contacts fermée | M10 social | G3b/G4 seulement |
| Policy/method version change | ressources qui la déclarent | nouvelle génération Global, closure exacte |

### Compatibilité des extensions futures

- **Media** : références optionnelles sur identités d'entité stables; aucun blob dans Analytics; l'absence média ne change jamais un knowledge state analytique.
- **Contextual Summary** : outputs déterministes narrables (`insightId`, support, coverage, provenance, evidence refs, limitations, lineage). Une IA ou un texte narratif n'est jamais un input métier.
- **Benefit Wallet** : architecture provider-agnostic et séparation stricte purchase/funding/bank transaction; aucune branche Swile/Edenred dans le cœur.
- **Diagnostic** : les outputs conservent support, coverage, provenance, versions, revisions, dependencies, evidence refs et publication lineage.
- **Import/actualisation** : chaque famille déclare inputs, lookbacks, invalidation scope, outputs et rebuild semantics. Aucun calcul métier ne se produit à la navigation.

Ces clauses sont des invariants A1/H1; aucun moteur Media/Summary/Wallet/Diagnostic/Import n'est créé par GA0.

## 19. PROMPT_REBASE_TABLE A1→GC2

La table complète est dans [GLOBAL_PROMPT_REBASE_TABLE.md](./GLOBAL_PROMPT_REBASE_TABLE.md). Le pack pré-History est archivé comme préparation; il n'est plus exécutable tel quel.

Le DAG est conservé mais rebasé : B1 fusionne son audit physique dans A1, C3/E3/G3 sont scindés entre core et branches gated, F2/F4/G2/G4/GC2 deviennent conditionnels, F3 reste bloqué par autorités absentes, et tous les lots d'implémentation/réalisation doivent être réécrits depuis la présente baseline.

## 20. Exact Phase A entry contract

A1 peut uniquement :

1. geler les types de temps Global sans fenêtre universelle;
2. inventorier et figer knowledge/support/coverage/provenance/partial reasons;
3. définir la forme de dependency/capability declarations et les scopes person/entity;
4. décider les adaptations minimales de `EconomicComponentFact` pour les liens personne explicites;
5. figer les identités method/policy et les invariants Media/Summary/Wallet/Diagnostic/Import;
6. produire un plan A2 borné, sans M1→M10, migration live, publication ou React.

Préconditions acquises : commit History exact, gate History PASS, réalité physique Supabase lue, classifications finales, gates explicites, DAG et matrices cohérents.

## 21. Hard stops / unresolved items

### Résultat

`UNRESOLVED_HARD_STOPS = 0` pour l'entrée A1.

Les 31 gates d'autorité sont des limites de capacité explicites, pas des contradictions structurelles. Ils deviennent un hard stop uniquement si un lot tente de publier la capacité associée sans autorité. PurchaseEvent reste `NEW_DATA`; son absence bloque F2 productif, pas A1 ni M1/M2 core.

Hard-stop mapping à conserver :

| Code | Déclencheur strict |
|---|---|
| `AUTHORITY_GATED` | Une sortie exige une autorité explicitement absente. |
| `CONTRACT_CONFLICT` | Deux contrats applicables imposent des comportements incompatibles sans ordre d'autorité résolutoire. |
| `MISSING_CANONICAL` | Un input métier requis n'existe pas dans la source Canonical. |
| `MISSING_FACT` | Le Canonical est défini mais aucun Fact autoritaire ne peut le projeter sans perte. |
| `HISTORY_SEMANTIC_CONFLICT` | Une exigence Global contredit une doctrine History finale sans résolution autorisée. |
| `NON_DETERMINISM` | Même input/version produit un résultat/hash différent. |
| `RECONCILIATION_FAILURE` | Les identités monétaires ou de cardinalité ne ferment pas. |
| `PUBLICATION_UNSAFE` | Stage/finalize/immutabilité/rollback/lecture générationnelle ne sont pas prouvés. |
| `UNKNOWN_REQUIREMENT` | Une sortie obligatoire n'a ni formule ni état d'absence autorisé. |
| `LIVE_TAIL_AUTHORITY_LEAK` | LT seul modifie une conclusion structurelle certifiée. |
| `CLIENT_ANALYTICS_LEAK` | React calcule une statistique, matérialité, ranking ou relation cible. |
| `DEPENDENCY_CLOSURE_GAP` | Un input réel manque à la closure/hash/manifest. |
| `CAPABILITY_SCOPE_VIOLATION` | Une capability indisponible est publiée comme connue ou hors de son scope. |
| `CAUSALITY_OVERCLAIM` | Une association/proximité est publiée comme cause. |
| `PERSON_ATTRIBUTION_OVERCLAIM` | Payer, compte, co-présence ou absence de preuve est transformé en bénéficiaire/personne. |

### Contrôles GA0

- Chaque `REUSE` possède une preuve physique.
- Chaque `ADAPT` décrit le delta; aucun legacy n'est classé `REUSE` par présence.
- Aucun fallback d'autorité, zero-fill, causalité de proximité, attribution personne, Place finance depuis GPS, PurchaseEvent depuis opération ou faux couple n'est autorisé.
- Aucun oracle/EXPECTED n'est une source de production.
- Aucune fenêtre universelle ni mensualisation forcée n'est conservée.
- Les cycles B↔F et D↔E/F sont cassés par core puis recertification ciblée.
- History, code produit et Supabase sont inchangés.

## Registre final de classification et comptage

Ce registre est fermé : un identifiant = une pièce = une classification. Les références croisées dans les matrices ne créent pas de seconde classification.

| Classe | Identifiants | Nombre |
|---|---|---:|
| `REUSE` | H01,H02,H04,H05,H09,H10,H11,H12,H13,H14,H15,H16,H17,H18 | 14 |
| `ADAPT` | H03,H06,H07,H08,H19,H20,H21,H22,H23,H24,H25,F01,F03,F04,F05 | 15 |
| `NEW_METRIC` | X01-X10 | 10 |
| `NEW_ENGINE` | F02,F07,F08,F09,F10,M01,M03,M04,M06,M08,M11,M13,M15,M18,M22,M24 | 16 |
| `NEW_FACT` | aucun | 0 |
| `NEW_READMODEL` | F06,M02,M05,M07,M10,M12,M14,M17,M21,M23,M26 | 11 |
| `NEW_DATA` | M19 | 1 |
| `REMOVE_LEGACY` | L01-L14 | 14 |
| `AUTHORITY_GATED` | M09,M16,M20,M25,AG001-AG031 | 35 |
| **Total** |  | **116** |

## 22. Final verdict

La frontière History→Global est claire; la cible ne dépend ni d'un RM History concaténé, ni du legacy Global, ni d'un oracle. Les fenêtres naturelles, la frontière CH/LT, les scopes, la qualité, la closure, le cutover legacy et la trajectoire de publication sont suffisamment définis pour démarrer l'audit/freeze A1. Les capacités sans autorité sont explicitement bornées et ne sont pas utilisées comme prétexte à une heuristique.

```text
GA0_ENTRY_GATE = PASS
NEXT_PERMITTED_STEP = A1 — PHYSICAL FOUNDATIONS AUDIT + CONTRACT FREEZE
```
