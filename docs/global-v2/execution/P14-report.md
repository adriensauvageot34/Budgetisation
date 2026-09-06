# P14 — ReadModels principaux des dix modules

## Baseline et périmètre

- Branche : `main`.
- HEAD d'entrée : `a2591c991855b2a7e6ee545826318a90467f9ccb`.
- Prérequis : P13 `IMPLEMENTATION_GATE`, `CONTRACT_GATE` et `TEST_GATE` à `PASS` ; P01–P12 certifiés dans `GLOBAL_EXECUTION_STATE.md`.
- Autorités : Master `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER`, `GLOBAL_EXECUTION_CONTRACT.md`, rapports P01–P13.
- Périmètre : types, parsers, RuntimeSchemas, builders serveur des projections COMPACT principales et sélection éditoriale. Aucun React, aucune Query live, aucun snapshot, aucune migration et aucune écriture live.

## Architecture H3

Le flux reste unidirectionnel :

```text
Canonical → Facts → Analytics M1–M10 → GlobalMaterialityEngine
→ GlobalPublicationEngine (hard gates ordonnés)
→ InsightSelectionEngine (éditorial seulement)
→ builders COMPACT → RuntimeSchemas → pipeline P13
```

Les builders ne reçoivent que des sorties déjà qualifiées : références de métriques, décisions de publication, preuves et valeurs d'affichage préparées par leurs producteurs. Ils n'ont aucune primitive de calcul financier, statistique, causal, de support ou de routine.

`GlobalPublicationEngine` expose et applique l'ordre : capability, applicability, semantic validity, knowledge, corpus/certification, support, coverage, provenance, compatibilité de base, matérialité, robustesse statistique, robustesse temporelle, sélection éditoriale, publication. Les nouveaux échecs explicites sont `MISSING_PROVENANCE`, `INCOMPATIBLE_BASE` et `INCOMPLETE_PUBLICATION_EVIDENCE`.

`InsightSelectionEngine` est strictement postérieur aux hard gates. Il :

- exige une décision `VISIBLE` et une matérialité admissible ;
- applique les poids normatifs 30/20/15/15/10/10 ;
- limite la surface à cinq, à deux par module, à une par `redundancyGroup` et à une `RECENT_ONLY` ;
- favorise la diversité de domaines avant le remplissage par score ;
- conserve tout le `supportingContext`, y compris pour les candidats non sélectionnés ;
- ne publie aucun score éditorial dans les payloads COMPACT.

## Ressources principales

| Ordre | Module | Ressource principale | Builder | RuntimeSchema |
| ---: | --- | --- | --- | --- |
| 1 | Economic | `analysis_global_economic` | `globalPrimaryReadModelBuilders` | `globalPrimaryReadModelSchemas` |
| 2 | Categories & Needs | `analysis_global_categories_needs` | idem | idem |
| 3 | Transformations | `analysis_global_transformations` | idem | idem |
| 4 | Rhythm | `analysis_global_rhythm` | idem | idem |
| 5 | Relationships | `analysis_global_relationships` | idem | idem |
| 6 | Moments | `analysis_global_moments` | idem | idem |
| 7 | Geo & Mobility | `analysis_global_geo_mobility` | idem | idem |
| 8 | Consumption | `analysis_global_consumption` | idem | idem |
| 9 | Personas | `analysis_global_personas` | idem | idem |
| 10 | Together | `analysis_global_together` | idem | idem |

`analysis_global_manifest` est la onzième ressource primaire déclarée : sa projection initiale est légère et contient seulement navigation, visibilité, capabilities et identités de publication/ressource. `analysis_global_summary_ai` et les ressources de détail restent P15. P14 ne fixe donc pas le nombre final de ressources Global à dix.

## Contrat COMPACT

Chaque module transporte au plus un `primaryInsight`, zéro à trois KPI du même phénomène, des états `VISIBLE/PLACEHOLDER/HIDDEN`, une qualification `KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE/CONFLICT`, limitations, preuves, capabilities, entrées de détail et metadata P13. Le transport `IDLE/LOADING/READY/ERROR` est un contrat enveloppe distinct : un `PARTIAL` analytique valide reste une donnée `READY`, jamais un placeholder de transport. Un module visible peut avoir des KPI structurels sans phrase narrative. Un module non visible ne peut porter ni insight ni KPI. Le schéma strict refuse toute clé de graphique/tableau et toute propriété absente matérialisée avec `undefined`.

La cohérence de page compare uniquement l'identité publication-scoped : `publicationId`, `revision`, `factsHash`, `generatedAt`, `profileId`, `manifestHash`. `policyVersions`, `contractVersion`, `methodSignature` et `resourceInputHash` restent spécifiques à chaque ressource. Une metadata absente ou une génération mélangée échoue fermée.

## Fichiers

- `src/analytics/global-v2/insight-selection.ts` : contrat candidat, ranking et sélection.
- `src/analytics/global-v2/publication.ts` : ordre complet des hard gates et raisons fail-closed.
- `src/analytics/global-v2/index.ts` : exports publics.
- `src/query-api/global-v2/types.ts` : dix ressources COMPACT et initiale légère.
- `src/query-api/global-v2/schemas.ts` : parsers stricts et onze RuntimeSchemas logiques.
- `src/query-api/global-v2/builders.ts` : projection, budgets et cohérence de publication.
- `src/query-api/global-v2/index.ts` : surface publique P14.
- `src/server/analytics/materialization/global-v2.ts` : inventaire exact des onze ressources primaires destiné au pipeline P15.
- `scripts/check-global-v2-primary-readmodels.mjs` et `package.json` : gate P14.

## Matrice exigences P14

| RequirementId | Preuve d'implémentation | Test | Statut |
| --- | --- | --- | --- |
| GLO-AI-006 | `InsightSelectionEngine.select` | sélection/hard gates/context | PASS |
| GLO-AI-007 | domaine `RELATIONSHIPS`, gate upstream requis | candidat relationnel/gated | PASS |
| GLO-AI-008 | domaine `TRANSFORMATIONS`, temporalClass | diversité/déterminisme | PASS |
| GLO-AI-009 | publication préalable obligatoire | opportunistic rejeté | PASS |
| GLO-AI-010 | domaine `PERSONAS`, context conservé | catalogue 10 modules | PASS |
| GLO-AI-011 | domaine `TOGETHER`, context conservé | catalogue 10 modules | PASS |
| GLO-AI-012 | data nature et limitations conservées | PARTIAL/limitations | PASS |
| GLO-AI-013 | poids 30/20/15/15/10/10, tie-break ID | ordre/permutation | PASS |
| GLO-ARC-012 | ordre explicite des quatorze gates | provenance/base/publication | PASS |
| GLO-FND-189 | candidat typé + contexte exhaustif | duplicate/score/context | PASS |
| GLO-PUB-005 | visibilité indépendante de la positivité | visible sans insight | PASS |
| GLO-PUB-024 | classe opportuniste sans récupération | candidat partial rejeté | PASS |
| GLO-PUB-061 | placeholder interdit à opportunistic | décision UNKNOWN | PASS |
| GLO-PUB-111 | sélection après décision publication | gated invisible | PASS |
| GLO-PUB-131 | cinq sélectionnés sur huit valides | 5/8 déterministe | PASS |
| GLO-UX-013 | KPI lié au même `phenomenonId` | second phénomène rejeté | PASS |
| GLO-UX-015 | COMPACT = un insight ; sélection globale <=5 | limites 1/5 | PASS |
| GLO-UX-068 | module structurel sans narration valide | KPI seul | PASS |
| GLO-UX-096 | moteur sélectionne, projection transporte | score interne absent | PASS |

Les 26 tests Master attribués à P14 sont couverts par le gate : `TEST-GLO-AI-0006` à `0016`, `TEST-GLO-FND-0213/0214`, `TEST-GLO-INT-0012`, `TEST-GLO-PUB-0006/0007/0027/0131/0152`, `TEST-GLO-UX-0016/0017/0019/0020/0081/0113/0114`. Les tests React-no-Analytics sont fermés structurellement : P14 ne crée aucun `.tsx`, et les builders n'importent aucun moteur métier.

## Tests exécutés

- `check-global-v2-primary-readmodels` : **83/83 PASS**.
- RuntimeSchemas principaux : **10/10 PASS** ; initiale légère : **PASS**.
- Payload COMPACT maximal mesuré : **1 671 octets**, budget technique **24 KiB**.
- Infrastructure P13 : **52/52 PASS**, SQL `NOT_RUN`.
- Typecheck : **PASS**.
- Architecture : **PASS**, 540 fichiers.
- Build production : consigné dans la clôture ci-dessous.
- `git diff --check` : consigné dans la clôture ci-dessous.

## Frontières P15

P15 finalisera les payloads de détail/exploration, `analysis_global_summary_ai`, l'enregistrement complet des instances et leur matérialisation dans P13. Aucun détail caché, résumé IA ou accès runtime n'est fabriqué dans P14.

## Gates

`GLOBAL_PHASE_H3 = PASS`

`IMPLEMENTATION_GATE = PASS`

`CONTRACT_GATE = PASS`

`TEST_GATE = PASS`

`LIVE_GATE = NOT_RUN`

`LIVE_WRITES = NONE`

`NEXT_PERMITTED_PROMPT = P15`
