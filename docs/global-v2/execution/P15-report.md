# P15 — Détails Query et fermeture des instances

## Baseline et périmètre

- Branche : `main`.
- HEAD d'entrée : `71b21f555a2cbd3d090616424b0bb110541a5b12`.
- Prérequis : P14 `IMPLEMENTATION_GATE`, `CONTRACT_GATE`, `TEST_GATE` et `GLOBAL_PHASE_H3` à `PASS`.
- Autorités : Master Global V2, `GLOBAL_EXECUTION_CONTRACT.md`, rapports P01–P14 et pipeline P13.
- Périmètre : projections détaillées, contrats Query stricts, registre V2 parallèle, instances/manifeste et runtime snapshot-only. Aucun React, aucune publication, aucune migration et aucune écriture live.

## Architecture H4

Le flux reste strictement unidirectionnel :

```text
Canonical → Facts → Analytics certifiée M1–M10
→ builders COMPACT/EXPANDED → RuntimeSchemas
→ plan d'instances déterministe → manifeste P13
→ analytics_query_snapshots → runtime Global V2
```

Les projections détaillées ne calculent aucune finance, statistique, causalité, routine, support ou matérialité. Elles transportent des métriques d'affichage, séries bornées, lignes, preuves, qualité, capabilities et destinations déjà qualifiées. `executeGlobalV2SnapshotQuery()` ne reçoit aucun producteur analytique : un miss, une invalidation, un manifeste incomplet, une signature incompatible ou une génération différente échoue localement.

Le registre Global V2 reste parallèle au registre legacy. Les neuf ressources Global historiques ne sont ni modifiées ni utilisées comme autorité V2.

## Registre réel

| Famille | Ressources | Contrat d'instance | État |
|---|---:|---|---|
| Tête | 12 | manifest, résumé importé, dix modules COMPACT ; paramètres vides | PASS |
| Sections EXPANDED | 10 | une ressource par module, `sectionKey` strict et lazy | PASS |
| Détails analytiques | 9 | catégorie/Need, transformation, routine, relation, Moment, Place, Purchase/Merchant, Persona, participation ; `entityRef` strict | PASS |
| Produit | 1 | contrat et schéma présents ; aucune instance sans Product authority | AUTHORITY_GATED |
| Route | 1 | contrat et schéma présents ; aucune instance sans MobilityLeg/Route authority | AUTHORITY_GATED |
| Méthodologie | 1 | `moduleKey` + `methodRef`, sans duplication de la méthodologie legacy | PASS |

Total : **34 contrats logiques**, dont **32 disponibles** dans la génération synthétique exhaustive de P15. Le nombre d'instances n'est pas figé à 32 : les détails d'entités suivent la cardinalité réellement atteignable de chaque génération. Les ressources Product et Route restent enregistrées mais non instanciées tant que leurs autorités P10/P08 sont fermées.

`analysis_global_summary_ai` complète l'inventaire principal P13/P14. Son payload est `FRESH`, `STALE` ou `MISSING`; un contenu présent doit avoir deux à quatre paragraphes, une date, un digest et passer le contrôle HTML sûr. Il ne devient jamais un input analytique.

## Payloads et bornes

`GlobalExpandedReadModel` porte au maximum :

- cinq insights au total, dont quatre secondaires ;
- douze métriques ;
- deux séries de trente-six points ;
- cinquante lignes ;
- vingt-quatre destinations ;
- 96 KiB par section.

Le chargement est par section et par détail : aucune requête par micro-ligne et aucun God RPC. La pagination n'est pas prévue par le Master pour ce lot ; la liste est donc bornée à cinquante lignes et toute cardinalité supérieure doit être projetée dans une autre instance explicitement contractée plutôt que tronquée silencieusement.

La fixture exhaustive mesure **42 716 octets** pour 32 payloads, **0 octet** de payload strictement dupliqué. Un clic provoque une lecture snapshot ciblée ; le test runtime mesure une lecture store et zéro appel producteur.

## Requests, cache et génération

`GlobalV2QueryRequest` exige :

- une ressource connue ;
- un `GlobalAnalysisScopeV2` strict ;
- les paramètres exacts de la ressource ;
- `{publicationId, analyticsRevision}` pour épingler le deep link.

Les propriétés inconnues et les propriétés présentes avec `undefined` sont refusées. La clé de cache inclut publication, révision Analytics, ressource, scope normalisé et paramètres canoniques. Deux sections différentes ont des clés différentes ; un scope sans filtres et le même scope normalisé avec `{filters:{}}` ont la même identité.

Chaque destination conserve `scopeHash`, `sourcePublicationId` et `sourceAnalyticsRevision`. Une destination Global interne doit pointer vers une instance exacte du manifest. Les destinations History, Operations et Entity sont des références externes explicites : elles réutilisent leurs ressources compatibles et ne provoquent aucun recalcul Global. La méthodologie Global reste une ressource ciblée V2.

## Matérialisation et H2

`buildGlobalV2QueryPlan()` :

1. valide chaque payload avec son RuntimeSchema ;
2. refuse une instance authority-gated ;
3. canonicalise paramètres et dépendances ;
4. calcule clé d'instance, `resourceInputHash` et `methodSignature` ;
5. vérifie les metadata du payload ;
6. ferme les dépendances et external refs ;
7. refuse les instances dupliquées et les destinations manquantes ;
8. impose une identité de publication commune ;
9. produit `requiredQueryKeys`, versions et closures pour le manifeste P13.

`attachGlobalV2QueryPlanToManifest()` assemble ces instances avec les artifacts sans seconde représentation. Le manifeste résultant est relu et son `manifestHash` est vérifié. Le contrôle post-finalize compare l'ensemble actif exact à la génération suivante : une clé retirée mais encore active est un résidu et échoue.

Le tri des clés du manifeste est harmonisé sur `localeCompare` pour que clés de ressources et closures emploient exactement le même ordre canonique. Ce correctif n'altère aucun payload métier et reste local à l'infrastructure Global non déployée.

## Routes et disponibilité

| Origine | Destination | Preuve |
|---|---|---|
| module COMPACT | section EXPANDED | `detailEntries.targetRef` résolu dans `requiredQueryKeys` |
| EXPANDED | détail analytique | `GLOBAL_QUERY.instanceKey` résolu dans le même manifest |
| EXPANDED | History | external ref `history_*`, génération source conservée |
| EXPANDED | Operations | external ref `operations_browse`, scope source conservé |
| EXPANDED | Entity | external ref `entity_*`, `entityRef` obligatoire |
| EXPANDED/détail | Methodology | instance `analysis_global_methodology` ciblée |
| Product/Route | détail | indisponibilité contractuelle explicite, aucune instance artificielle |

Une route, une ressource, une section ou un paramètre invalide produit `INVALID_REQUEST`. Une instance absente produit `SNAPSHOT_MISS`; les autres erreurs de génération restent locales. Une réponse tardive ne peut remplacer la génération épinglée.

## Matrice Master H4

| Exigence | Implémentation | Test | Statut |
|---|---|---|---|
| `GLO-ARC-001` | registre ciblé, aucun God RPC, pile V2 parallèle | 34 contrats/32 instances | PASS |
| `GLO-UX-097` | destination Entity distincte du détail analytique | entity ref + external ref | PASS |
| `GLO-UX-098` | détails et sous-sections lazy, précalculés | params/cache/instance exacte | PASS |
| Navigation atteignable | chaque ref interne appartient aux required keys | suppression de détail refusée | PASS |
| Deep link | scope et génération source obligatoires | mismatch publication/révision | PASS |
| Snapshot-only | runtime sans producteur ni read-through | spy producteur = 0 | PASS |
| Instance retirée | full restage et ensemble actif exact | residual-key négatif | PASS |
| RuntimeSchemas | toutes les instances disponibles | 32/32 | PASS |

Les tests Master attribués à P15 (`TEST-GLO-ARC-0001`, `TEST-GLO-UX-0115`) sont couverts par le gate paramétré, complété par les cas discriminants du prompt P15.

## Tests exécutés

- `check-global-v2-query-instances` : **52/52 PASS**.
- RuntimeSchemas candidats : **32/32 PASS**.
- Registre/reachability : **32 required query keys**, 3 familles de destinations externes, aucun doublon.
- Runtime snapshot-only : **1** lecture store, **0** appel producteur.
- P14 primary ReadModels : **83/83 PASS**.
- P13 infrastructure/manifeste : **52/52 PASS**, SQL embarqué non requis dans ce replay.
- Typecheck : **PASS**.
- Architecture : **PASS**, 544 fichiers.
- Build production Next 16.2.6 : **PASS**, compilation, TypeScript et 7/7 pages statiques.
- `git diff --check` : **PASS**.

## Frontières

- Aucun frontend ou React.
- Aucun snapshot ou publication live.
- Aucune migration ou écriture Supabase.
- `PENDING_LIVE_SCHEMA` de P13 reste inchangé et exige une autorisation humaine ultérieure.
- Les capacités Product et Route restent explicitement authority-gated ; aucune donnée n'est fabriquée.

## Gates

`GLOBAL_PHASE_H2_EXACT_RESOURCE_INSTANCES = PASS`

`GLOBAL_PHASE_H4 = PASS`

`IMPLEMENTATION_GATE = PASS`

`CONTRACT_GATE = PASS`

`TEST_GATE = PASS`

`LIVE_GATE = NOT_RUN`

`LIVE_WRITES = NONE`

`NEXT_PERMITTED_PROMPT = P16`
