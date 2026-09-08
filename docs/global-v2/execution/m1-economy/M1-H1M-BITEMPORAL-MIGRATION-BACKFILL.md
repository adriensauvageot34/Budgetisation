# M1-H1M — Autorité bitemporelle Minimal et backfill préparé

Date de clôture : 2026-09-08

Baseline Git : `8d51f47ae11d2f7e32f3c7dfc8e5f3f045a40785` (`main`)

Mode : `DRY_RUN` — aucune migration appliquée, aucune écriture Supabase

## 1. Gate d’entrée

| Prérequis | Preuve | Statut |
| --- | --- | --- |
| M1-1R fondations | `M1-1R-SHARED-FOUNDATIONS-SAFE.md` | PASS |
| M1-2/3R owner | `M1-2-3R-ENGINE-OWNER-V2.md` | PASS |
| M1-4R Query | `M1-4R-QUERY-SNAPSHOTS.md` | PASS |
| M1-5/6R UI | `M1-5-6R-UI-LOCAL-REVIEW.md` | PASS |
| Décisions humaines H1 | paquet `m1-h1-human-validation-candidates@v1`, SHA-256 `ebd9a49497f2b46b6f549d879ed425748d558cc5fd8d389ff59e6ed1cac01366` | GELÉ |
| Autorisation live requise | ligne exacte `LIVE_BACKFILL_AUTHORIZED = YES` absente du prompt | NON AUTORISÉ |

H0/H1 n'ont pas été rejoués. Le paquet H1 est consommé comme preuve gelée et compare-only.

## 2. Modèle d’autorité

Le modèle implémenté est `BITEMPORAL_TYPED_RULE_AND_RECURRENCE_AUTHORITY_V1`.

La migration additive `20260908160000_m1_historical_minimal_bitemporal_authority.sql` conserve les tables d'identité existantes et ajoute :

- `minimal_baseline_rule_versions`, autorité temporelle append-only des familles Minimal ;
- `recurrence_state_history`, autorité temporelle append-only de l'éligibilité d'une série à Minimal ;
- des clés étrangères vers `households`, `minimal_baseline_rules` et `recurrence_series` ;
- des intervalles `[effective_from, effective_to)` ;
- `declared_at`, séparé de l'effectivité ;
- `source_revision`, `authority_type`, références de déclaration/validation, version de méthode, preuves et supersession ;
- `backfill_plan_hash`, pour l'idempotence logique ;
- des guards d'append-only, de Household scope, de supersession et de chevauchement contradictoire à même révision ;
- RLS et révocation de tout accès `public`, `anon` et `authenticated` ;
- lecture `service_role` et RPC serveur atomique pour l'application ultérieure autorisée.

Une correction rétrospective crée une nouvelle version et une nouvelle `sourceRevision`. Elle ne modifie pas une ancienne version ni une publication déjà matérialisée.

## 3. Reader historique

`CanonicalRepository.loadHistoricalMinimalAuthority(targetMonth)` charge uniquement :

- les versions effectives à la date demandée ;
- les versions déclarées au plus tard à l'`asOf` Canonical ;
- le Household courant ;
- les deux registres versionnés, sans lecture d'un snapshot History.

La sélection partagée retient la version canonique par révision/déclaration, respecte la borne supérieure exclusive et rejette les chevauchements contradictoires. `knowledgeAsOf` empêche qu'une déclaration rétrospective inconnue à l'époque ne soit injectée dans un replay historique antérieur.

Le reader n'utilise jamais `actif_prevision`, `minimal_month_cost@v1`, `history_minimal_preview` ou `history_month_balance_summary` comme fallback. Le code existant reste compatible avant migration : ce reader est une capacité explicite et séparée, à brancher au moment du cutover autorisé.

## 4. Décisions D1 à D4 matérialisées dans le plan

| Groupe | Décision | Versions préparées | Effectivité |
| --- | --- | ---: | --- |
| D1 | `EXCLUDED_FROM_MINIMAL` pour les règles exclues avec preuve/composants | 20 | première preuve H1, jamais avant |
| D2 | `FIXED_REQUIRED` pour les huit charges validées | 8 | première preuve H1 |
| D3 | `VARIABLE_ESSENTIAL` pour Courses, Épicerie et Carburant | 3 | dates approuvées ; Carburant garde `WORK_COMMUTE_FUEL_ONLY` |
| D4 | `VARIABLE_ESSENTIAL` pour Coiffure, Skincare et Maquillage | 3 | respectivement 2025-09-06, 2025-12-11 et 2026-03-11 |

Total : **34 versions de règles**. Les identifiants de version sont déterministes à partir de l'identité Canonical et de la révision source. Deux constructions du même plan donnent les mêmes lignes et le même hash.

## 5. Inconnues conservées

- Cinq règles sans composant/preuve historique : aucun backfill, état historique `UNKNOWN`.
- `Mixte / multi-catégories` : résolution uniquement par composants autoritaires séparables ; sinon `UNKNOWN`.
- Une famille `VARIABLE_ESSENTIAL` avec moins de six observations : contribution `UNKNOWN`, jamais zéro.
- `DECLARED_MINIMUM` sans source explicite : `UNKNOWN`.
- Les lifecycle `ENDED`, `INTERRUPTED` et `RESTARTED` ne sont jamais inférés d'un trou ou d'une dernière occurrence.

Une inconnue locale ne supprime ni les autres composantes Minimal connues, ni Actual, Typical, Trend, Structure, ni les faits d'occurrence/récurrence.

## 6. Récurrences

Les occurrences restent dans leurs sources Canonical ; aucune copie de montants privés n'est ajoutée au registre d'autorité.

| Élément | Résultat préparé |
| --- | ---: |
| Séries H1 conservées comme observations Canonical | 35 |
| Séries liées à Minimal | 16 |
| Séries robustes déclarées `ACTIVE_FOR_MINIMAL` | 15 |
| Série mono-occurrence maintenue `UNKNOWN` | 1 |

Les 15 déclarations commencent à la première occurrence observée et portent `RETROSPECTIVE_DECLARATION` ainsi que `M1-H1-GROUPED-RECURRENCE-DECISION`. Une déclaration d'activité Minimal ne prétend ni fin, ni interruption, ni reprise contractuelle.

## 7. Minimal partagé

Version de méthode : `minimal_month_cost@v2`.

- `VARIABLE_ESSENTIAL` : Q25 ;
- fenêtre : au plus douze mois éligibles strictement antérieurs à M ;
- support minimum : six observations ;
- missing distinct de zéro connu ;
- `FIXED_REQUIRED` depuis l'autorité effective ;
- `PERIODIC_REQUIRED` depuis l'équivalent mensuel structurel autorisé ;
- `DECLARED_MINIMUM` uniquement depuis une source explicite ;
- `EXCLUDED_FROM_MINIMAL` vaut zéro uniquement si la règle effective l'établit ;
- lineage, `sourceRevision`, method version et dépendances restent attachés au résultat.

Les anciennes preuves `minimal_month_cost@v1` restent `AUDIT_PROVENANCE_ONLY` et ne deviennent pas un input productif.

## 8. Preview du replay 2025-08 → 2026-07

Le mode dry-run ne lit ni n'écrit le live et ne stocke aucune valeur bancaire privée. Il valide le plan d'effectivité, la couverture atteignable et les états sûrs. Sans migration/backfill appliqué et sans réhydratation privée autorisée, une valeur agrégée n'est pas inventée.

| Mois | Statut | Valeur | Règles effectives | Récurrences Minimal actives | Composantes/locales inconnues | sourceRevision | methodVersion |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 2025-08 | PARTIAL_SAFE | non produite en dry-run | 1 | 0 | 7 | 2 | `minimal_month_cost@v2` |
| 2025-09 | PARTIAL_SAFE | non produite en dry-run | 22 | 13 | 15 | 2 | `minimal_month_cost@v2` |
| 2025-10 | PARTIAL_SAFE | non produite en dry-run | 27 | 13 | 16 | 2 | `minimal_month_cost@v2` |
| 2025-11 | PARTIAL_SAFE | non produite en dry-run | 27 | 13 | 16 | 2 | `minimal_month_cost@v2` |
| 2025-12 | PARTIAL_SAFE | non produite en dry-run | 28 | 13 | 17 | 2 | `minimal_month_cost@v2` |
| 2026-01 | PARTIAL_SAFE | non produite en dry-run | 29 | 13 | 18 | 2 | `minimal_month_cost@v2` |
| 2026-02 | PARTIAL_SAFE | non produite en dry-run | 31 | 13 | 18 | 2 | `minimal_month_cost@v2` |
| 2026-03 | PARTIAL_SAFE | non produite en dry-run | 31 | 14 | 18 | 2 | `minimal_month_cost@v2` |
| 2026-04 | PARTIAL_SAFE | non produite en dry-run | 32 | 14 | 19 | 2 | `minimal_month_cost@v2` |
| 2026-05 | PARTIAL_SAFE | non produite en dry-run | 33 | 15 | 20 | 2 | `minimal_month_cost@v2` |
| 2026-06 | PARTIAL_SAFE | non produite en dry-run | 34 | 15 | 20 | 2 | `minimal_month_cost@v2` |
| 2026-07 | PARTIAL_SAFE | non produite en dry-run | 34 | 15 | 20 | 2 | `minimal_month_cost@v2` |

Ce tableau exprime la **maximum safe coverage**, pas un objectif artificiel de douze valeurs `KNOWN`. Le nombre « composantes/locales inconnues » est un indicateur conservateur du preview de plan, pas un montant ni une cardinalité de payload productif.

## 9. Backfill et idempotence

Script : `scripts/backfill-m1-historical-minimal-authority.mjs`.

- le mode par défaut est `DRY_RUN` et affiche `liveWrites: 0` ;
- l'application nécessite simultanément `--apply`, `LIVE_BACKFILL_AUTHORIZED=YES`, le Household et les credentials serveur ;
- avant application, le script vérifie le projet/preuve H1, les 40 identités et attributs de règles, les 35 identités et attributs de séries, les cardinalités et bornes des occurrences, puis leurs digests privés sans afficher leurs valeurs ;
- le RPC verrouille la révision Household, exige la révision attendue, insère les 34 + 15 versions dans une transaction, puis invalide les consommateurs ;
- le même `planHash` complet retourne le même état sans doublon ; un état partiel est rejeté ;
- planHash dry-run : `af3e66a745555086dfebb67a9930c8500adde66180e10d8e54d11b0247ff64e5`.

Le SQL et le script ont été préparés, mais **ni l'un ni l'autre n'a été exécuté contre Supabase** dans ce lot.

## 10. Impact de recomputation

### History

`HISTORY_RECOMPUTE_SCOPE` : les deux ressources dont la closure History déclare directement `minimal` — `history_month_balance_summary` et `history_minimal_preview` — ainsi que leurs instances mensuelles août 2025 → juillet 2026. Les artifacts/ressources transitivement dépendants doivent être sélectionnés par le manifest lors du futur rebuild, jamais par une liste de payloads patchée à la main.

### Global

`GLOBAL_RECOMPUTE_SCOPE` : owner M1 complet, projections principale/détails M1 et toutes les ressources Global dont la closure dépend de M1/Minimal. La future génération doit être reconstruite sous la nouvelle `sourceRevision`; aucun snapshot Global actuel n'est muté.

Les Query snapshots History servent uniquement à la validation/réconciliation/audit, jamais à produire la nouvelle autorité.

## 11. Tests et preuves

| Preuve | Résultat |
| --- | --- |
| Gate H1M modèle/migration/repository/backfill | 53/53 PASS |
| Fondations M1-1R / Q25 / anti-over-gating | 46/46 PASS |
| Owner M1-2/3R | 56/56 PASS |
| Query M1-4R | 31/31 PASS ; 44 snapshots ; 2 détails récurrence |
| TypeScript `tsc --noEmit` | PASS |
| `git diff --check` | PASS |

Les cas couverts comprennent : Q25 et support, borne max 12 strictement antérieure, sélection par `knownAt`, future rule/recurrence sans look-ahead, fuite de `actif_prevision` interdite, borne `effectiveTo` exclusive, correction rétrospective versionnée, overlap rejeté, inconnu local non contaminant, mono-occurrence sûre, idempotence déterministe et absence d'autorité History Query.

## 12. État de déploiement

- migration créée : oui ;
- migration live appliquée : non ;
- script de backfill créé : oui ;
- backfill live appliqué : non ;
- publication History : non exécutée ;
- publication Global : non exécutée ;
- écritures Supabase : 0.

```text
M1_H1M_MIGRATION = PASS
AUTHORITY_MODEL = BITEMPORAL_TYPED_RULE_AND_RECURRENCE_AUTHORITY_V1

D1_RULES_EXCLUDED = PASS
D2_FIXED_REQUIRED = PASS
D3_VARIABLE_ESSENTIAL = PASS
D4_PERSONAL_CARE_MINIMAL = PASS

MIXED_RULE = UNKNOWN_SAFE

RULE_VERSIONING = PASS
RECURRENCE_OBSERVATION_HISTORY = PASS
RECURRENCE_STATE_VERSIONING = PASS
SINGLE_OCCURRENCE_SAFE = PASS

MINIMAL_Q25_METHOD = PASS
MINIMAL_REPLAY_DRY_RUN = PARTIAL_SAFE

ANTI_LOOKAHEAD = PASS
OVER_GATING_CHECK = PASS
IDEMPOTENCE = PASS

MIGRATION_FILES_CREATED = YES
BACKFILL_SCRIPT_CREATED = YES

LIVE_BACKFILL_AUTHORIZED = NO
SUPABASE_WRITES = 0

HISTORY_RECOMPUTE_REQUIRED = YES
GLOBAL_RECOMPUTE_REQUIRED = YES

TYPECHECK = PASS
TARGETED_TESTS = PASS

REPORT = docs/global-v2/execution/m1-economy/M1-H1M-BITEMPORAL-MIGRATION-BACKFILL.md

STOP.
```

## 13. Addendum de cutover live M1-FINAL (2026-09-08)

La clôture M1-FINAL remplace uniquement les mentions « non appliqué live » de la section 12 ; le modèle, les décisions D1–D4 et le plan de replay restent inchangés.

- projet Supabase : `ipuuhxrblxormwgoaqnz` ;
- migrations additives enregistrées live : `20260908141949`, `20260908142256`, `20260908142406` ;
- `dataRevision` : `1 → 2` ;
- 34 versions de règles et 15 versions d'état de récurrence créées ; aucune preuve inconnue transformée en valeur ;
- deuxième invocation du backfill : zéro insertion et mêmes digests (`IDEMPOTENCE = PASS`) ;
- anti-drift : 40/40 règles, 35/35 récurrences et planHash `af3e66a745555086dfebb67a9930c8500adde66180e10d8e54d11b0247ff64e5` ;
- replay 2025-08 → 2026-07 : `PARTIAL_SAFE` sur les douze mois, conformément à `MAXIMUM_SAFE_COVERAGE` ;
- History V2 reconstruit et publié sur douze générations, `analyticsRevision 80 → 92`, 947 snapshots, 24 artifacts et 12 manifests durables ;
- Global V2 reconstruit par `FULL_RESTAGE` puis publié à la révision 93, avec 103 snapshots, 1 artifact et zéro reliquat ;
- aucune ancienne génération n'a été mutée.

Les détails de publication, hashes, tests et déploiement sont consignés dans `M1-FINAL-LIVE-CUTOVER.md`.
