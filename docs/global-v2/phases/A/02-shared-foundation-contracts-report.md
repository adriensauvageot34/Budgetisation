# P01 — Shared foundation contracts — rapport A2/A3

## Gate d’entrée et baseline

- Branche : `main`.
- HEAD de départ : `9a70f9b1643747f8d60214cf66c94f58d193112c`.
- A1 : PASS, lu dans `01-foundations-physical-audit.md` ; GA0 et B1 n’ont pas été rejoués.
- Les quatre non-suivis initiaux ont été vérifiés comme livrables légitimes GA0/A1 et sont inclus séparément du code P01 : `GA0-post-history-reality-check.md`, `GLOBAL_ANALYTICS_DEPENDENCY_MATRIX.md`, `GLOBAL_PROMPT_REBASE_TABLE.md`, `phases/A/01-foundations-physical-audit.md`.
- Écritures Supabase : aucune. Migration, backfill, publication et rebuild History : aucun.

## Index normatif et contrat d’exécution

La charte C01–C14 est conservée dans `GLOBAL_EXECUTION_CONTRACT.md`. `GLOBAL_MASTER_INDEX.json` est un index de traçabilité, non une copie normative : il associe chaque ID à sa source, son propriétaire P01–P20/T01 et son statut initial. Le Master reste seul détenteur du texte normatif.

| Inventaire | Attendu | Indexé | Statut |
|---|---:|---:|---|
| Exigences | 2 047 | 2 047 IDs uniques | PASS |
| Capabilities | 364 | 364 IDs uniques | PASS |
| Tests conceptuels | 2 302 | 2 302 IDs uniques | PASS |

Source Master SHA-256 : `8b0d0ff2381599c4495645cd1dd1ebf2fa0d027fc3113be78aee945fae12f8be`.

L’inventaire legacy est corrigé à neuf ressources `analysis_global_*`. B1 est absorbé par A1 et n’a pas été réexécuté.

## Matrice A2-01 à A2-13

| ID | Implémentation | Assertion principale | Sous-gate |
|---|---|---|---|
| A2-01 | `src/core/global-v2/{types,validation,hash}.ts` | Scope parallèle ; `asOf` Instant, `certifiedThrough` LocalDate, `liveThrough` optionnel ; fuseau Household ; aucun `observationWindow` ; namespace hash V2 | PASS |
| A2-02 | `types.ts`, `validation.ts` | Slices CH/LT disjoints, grains/fenêtres naturels, trous conservés, fuite LT structurelle refusée | PASS |
| A2-03 | `types.ts`, `validation.ts` | KNOWN/PARTIAL/UNKNOWN/NOT_APPLICABLE/CONFLICT ; PARTIAL exige meaning et raisons ; absence ≠ undefined | PASS |
| A2-04 | `types.ts`, `validation.ts` | eligible ≥ observed ≥ included ; excluded réconcilié ; grains, minimum, dates, gaps et compteurs distincts | PASS |
| A2-05 | `types.ts`, `validation.ts` | Coverage typée avec numérateur/dénominateur ; univers vide non 100 % ; effective = minimum des dimensions requises | PASS |
| A2-06 | `types.ts`, `validation.ts` | Provenance stricte, refs machine stables, nature/intégration/base monétaire, revisions, policies et lineage | PASS |
| A2-07 | `types.ts`, `validation.ts`, `hash.ts` | Identité engine/method/policies/grain/contrat ; signature sensible aux policies consommées et stable sinon | PASS |
| A2-08 | `types.ts`, `validation.ts`, `hash.ts` | Déclaration complète, sets canonisés, doublons refusés, input consommé absent détecté, digest déterministe | PASS |
| A2-09 | `authority-gates.ts` | AG001–AG031 = UNAVAILABLE ; aucune capability gated ne peut devenir AVAILABLE | PASS |
| A2-10 | `types.ts`, `validation.ts` | Household/Person/comparable/shared/entity scopes ; membership Household ; ensembles canonisés | PASS |
| A2-11 | Facts, repository et context | Attribution au grain source exact ; payer non bénéficiaire ; beneficiary/share/partial/conflict ; Payment_component UNKNOWN ; sélection avec coverage | PASS |
| A2-12 | `GlobalMaterialityCandidate` | Candidat seulement : support, coverage, preuves, versions et hiérarchie ; aucun moteur produit | PASS |
| A2-13 | script, package, présent rapport | Gate adversarial, régressions ciblées, architecture/typecheck/build/diff-check | PASS |

## Attribution EconomicComponentFact

`CanonicalRepository` charge `financial_source_person_links` par batches et séparément pour `Operation`, `Allocation`, `Item` et `Cash_use`. La clé est la source exacte du composant ; aucun lien Operation n’est hérité par Allocation/Item. Les `Payment_component` restent UNKNOWN sans relation Canonical directe.

Décisions implémentées :

- payer seul → UNKNOWN ;
- un beneficiary Household → resolved ;
- beneficiaries concurrents sans parts → CONFLICT ;
- parts explicites totalisant 1 → shared ;
- parts explicites sous 1 → partial avec reste exact ;
- total supérieur à 1, relations mixtes, doublon ou Person hors Household → échec fermé/conflict selon la couche ;
- aucune répartition 50/50 implicite ;
- les montants attribuables, non attribuables, dénominateurs et conflits sont exposés sans convertir l’inconnu en zéro ;
- la sélection Household legacy reste inchangée et son total réconcilie à l’identique.

Les 128 liens historiques mentionnés dans A1 ne sont utilisés ni comme nombre de composants ni comme coverage financière. Aucun chiffre privé n’est enregistré.

## Compatibilité et frontières

- `src/core/scope/*` et `analysis-scope:v1` ne sont pas modifiés ; le golden hash V1 reste `ced744bf3cfc4da031e55cd3e82166af80b36ac334ad20a35a8c12a9acfd76fc`.
- Les anciennes formes ECF `{kind:"resolved",id}` et `{kind:"unknown"}` restent parseables.
- Les contrats History, ReadModels, Query, materialization, React et migrations ne sont pas modifiés.
- Les futures générations qui consommeront la preuve personne devront changer leur closure/version ; aucune publication History active n’est touchée.
- Les sources compare-only/oracles sont absentes du code Global de production.
- `GlobalTemporalBoundaryResolver`, `GlobalMaterialityEngine` et `InsightSelectionEngine` ne sont pas implémentés ici.

## Tests exécutés

| Commande/gate | Résultat |
|---|---|
| `check-global-v2-foundations` | PASS — 107/107 |
| `check-canonical-in-batching` | PASS, y compris batches exact-source Person |
| `check-history-v2-canonical` | PASS |
| `check-history-v2-transversal` | PASS — 48 checks |
| `check-history-v2-dependency-manifest` | PASS |
| `check-history-v2-month-balance` | PASS — 99/99 |
| `check-analysis-month-contracts` | PASS — inclut la non-régression marked facts |
| `check-analysis-global-contracts` | PASS — legacy |
| `check-architecture-imports` | PASS — 475 fichiers |
| `tsc --noEmit` | PASS |
| `next build` | PASS |
| `git diff --check` | PASS |

Les fixtures sont synthétiques et les vérifications sont locales/read-only. Aucune certification live exhaustive n’a été lancée.

## A3 — certification du freeze A

A3 certifie sur le même état de code les contrats A1 puis leur implémentation A2 : portée stricte, V1 inchangé, 31 gates fermés, closures fail-closed, attribution exacte, absence d’oracle productif et régressions ciblées vertes. Aucun hard stop A n’est ouvert.

`GLOBAL_PHASE_A2 = PASS`

`GLOBAL_PHASE_A3 = PASS`

`NEXT_PERMITTED_PROMPT = P02`
