# History V2 — Certification des migrations Canonical live

Date de certification : 2026-08-30

## A. Périmètre et résultat

Cette certification ferme uniquement l'application live des trois migrations Canonical validées dans `02-canonical-missing-data-report.md`. Elle n'ajoute aucune donnée, aucun backfill, aucune Query V2, aucun snapshot V2, aucune pièce Quality/Visibility et aucune modification frontend ou Calendar.

Projet Supabase certifié :

- nom : `Budgetisation` ;
- project ref : `ipuuhxrblxormwgoaqnz` ;
- organisation : `gemtanhfwpvvcojflypm` ;
- région : `eu-central-1` ;
- état observé : `ACTIVE_HEALTHY` ;
- PostgreSQL : `17.6`.

Le connecteur Supabase ne présentait qu'un seul projet cible et son project ref correspond exactement au projet déjà audité. Aucune migration n'a été réappliquée pendant cette reprise de certification.

## B. Migrations réellement appliquées

Les corps SQL appliqués sont ceux des fichiers locaux validés, sans changement matériel par rapport au rapport 02.

| Contrat | Fichier SQL local | SHA-256 du SQL appliqué | Version dans l'historique live | État |
|---|---|---|---|---|
| Purchase Event | `supabase/migrations/20260822000000_purchase_event_identity.sql` | `76CA0AB50433ED4D0CCDFE5CCE64148D1487015AB1468AEDF313772FA4C04069` | `20260829231059 purchase_event_identity` | APPLIQUÉ |
| Economic component classifications | `supabase/migrations/20260830090000_economic_component_classifications.sql` | `F077ED5E6F813C57E24E9187B18F3CD972500E3C0F5AA4281B5B01D9A4EFF502` | `20260829231101 economic_component_classifications` | APPLIQUÉ |
| Life event continuity assertions | `supabase/migrations/20260830091000_life_event_continuity_assertions.sql` | `89F3DDF0BDA2EC59BD77B8C0896221A41F5AC485B772BD675C30B7E8236DF78D` | `20260829231103 life_event_continuity_assertions` | APPLIQUÉ |

Les versions live ont été horodatées automatiquement par l'outil d'application Supabase ; elles diffèrent donc des préfixes de fichiers locaux. Les noms et les corps SQL appliqués correspondent. Il s'agit d'un écart administratif d'identifiant de migration, pas d'un écart de schéma.

### Historique avant

1. `20260824231804 set_deplacement_pro_multi_day`
2. `20260825002850 complete_historical_analysis_periods`
3. `20260825105100 analytics_materialization`

### Historique après

1. `20260824231804 set_deplacement_pro_multi_day`
2. `20260825002850 complete_historical_analysis_periods`
3. `20260825105100 analytics_materialization`
4. `20260829231059 purchase_event_identity`
5. `20260829231101 economic_component_classifications`
6. `20260829231103 life_event_continuity_assertions`

## C. Structures live obtenues

Les cinq tables attendues sont présentes :

- `public.purchase_events` ;
- `public.purchase_event_memberships` ;
- `public.purchase_event_timing_assertions` ;
- `public.economic_component_classifications` ;
- `public.life_event_continuity_assertions`.

Les colonnes live correspondent aux projections du code : identifiants Purchase Event et Household, sources composantes exclusives, clés canoniques, preuves et provenance, assertions temporelles jour/mois, classifications par axe, et assertion de continuité Life Event.

### Purchase Event

- PK sur chaque table et identité unique `(purchase_event_id, household_id)` sur `purchase_events`.
- FK Household sur les trois tables.
- FK composites `(purchase_event_id, household_id)` des memberships et timing vers `purchase_events`, avec `ON DELETE CASCADE`.
- FK sources vers `operations`, `operation_allocations`, `operation_items`, `payment_components` et `cash_economic_uses`.
- `purchase_event_memberships_source_xor` impose exactement une source canonique.
- `purchase_event_memberships_event_source_unique` empêche la répétition d'une même source dans un événement.
- L'index unique partiel `purchase_event_consumption_owner_unique` impose qu'une `canonical_component_key` de type `CONSUMPTION_COMPONENT` n'ait qu'un seul Purchase Event propriétaire.
- Les contraintes de timing imposent l'autorité, la précision `DAY` ou `MONTH`, la cohérence date/mois et une preuve non vide.

### Economic component classifications

- FK Household et FK vers les cinq familles de sources financières canoniques.
- `economic_component_classifications_source_xor` impose exactement une source.
- Unicité `(household_id, canonical_component_key, axis)`.
- Axes, statuts, valeurs, autorités, provenance et preuves sont contraints ; `UNKNOWN` et `CONFLICT` restent explicites.

### Life event continuity assertions

- PK et FK `life_event_id` vers `life_events`, avec `ON DELETE CASCADE`.
- FK Household.
- Statut, qualificateur de continuité, autorité, provenance et preuves sont contraints ; aucune continuité n'est déduite par défaut.

## D. Household scope

La fonction `private.assert_history_v2_household_scope()` existe avec :

- `SECURITY INVOKER` ;
- `search_path = ''` ;
- exécution refusée à `PUBLIC`, `anon` et `authenticated` ;
- exécution accordée à `service_role`.

Cinq triggers actifs, un par nouvelle table, appellent cette fonction avant insertion ou modification de `household_id`. La fonction exige que `public.canonical_household_scope_control` soit `READY`, que son compteur Household soit exactement `1` et que la ligne porte exactement ce Household. Les FK Household complètent cette garde.

## E. RLS, grants et exposition navigateur

| Contrôle | Résultat live |
|---|---|
| RLS activée sur les cinq tables | PASS |
| Policies navigateur présentes | `0` sur chaque table |
| `anon` — SELECT/INSERT/UPDATE/DELETE | aucun droit sur les cinq tables |
| `authenticated` — SELECT/INSERT/UPDATE/DELETE | aucun droit sur les cinq tables |
| `service_role` — SELECT/INSERT/UPDATE/DELETE | droits présents sur les cinq tables |
| `service_role` — exécution de la garde Household | accordée |
| `anon` / `authenticated` — exécution de la garde Household | refusée |

`anon` et `authenticated` conservent l'usage normal du schéma `public`, mais n'ont aucun privilège sur ces tables. L'usage du schéma ne leur donne donc aucun accès aux nouvelles relations. L'absence de policy RLS est volontaire pour ces structures server-only et ne doit pas être corrigée par une policy navigateur.

L'advisor Supabase signale les cinq tables en information `rls_enabled_no_policy`. Ce signal est cohérent avec le modèle server-only certifié. Aucun warning ou error de sécurité propre à ces migrations n'a été détecté. Le warning global `auth_leaked_password_protection` existant concerne la configuration Auth du projet et non ce lot.

## F. Lecture par CanonicalRepository et FactSourceResolver

Les sélections exactes utilisées par `CanonicalRepository` ont été exécutées sur le live dans une transaction read-only avec `current_user = service_role` :

- `purchase_events` ;
- `purchase_event_memberships` ;
- `purchase_event_timing_assertions` ;
- `economic_component_classifications` ;
- `life_event_continuity_assertions`.

Toutes les projections de colonnes ont été acceptées sans erreur de relation, de colonne, de RLS ou de grant. Elles ont retourné zéro ligne, conformément à l'absence de backfill.

Le raccordement code est cohérent :

- `CanonicalRepository.loadPurchaseEvents()` lit les trois relations Purchase Event puis applique `projectPurchaseEventFact()` ;
- `CanonicalRepository.loadEconomicComponentClassifications()` lit les assertions de classification puis applique `resolveEconomicComponentClassifications()` ;
- `CanonicalRepository.loadLifeEventContinuity()` lit les assertions de continuité ;
- `CanonicalRepository.purchaseEventSourceHealth()` sonde les trois relations Purchase Event ;
- `FactSourceResolver` délègue à ces loaders et expose `fct_purchase_event`, les classifications et la continuité sans source parallèle.

Le typecheck, les tests Canonical et le build valident les signatures et le raccordement. La certification live a été faite au niveau de la base sous `service_role`, les secrets serveur Vercel n'étant pas chargés dans l'environnement local ; aucun secret n'a été lu ni copié. Le résultat attendu actuel des loaders pour les nouvelles relations est donc une collection vide, pas une erreur.

## G. Données après migration et absence de backfill

Comptage final, refait après tous les tests :

| Table | Lignes |
|---|---:|
| `purchase_events` | 0 |
| `purchase_event_memberships` | 0 |
| `purchase_event_timing_assertions` | 0 |
| `economic_component_classifications` | 0 |
| `life_event_continuity_assertions` | 0 |

Les migrations ne contiennent aucun `INSERT`, `UPDATE` ou `DELETE`. Aucun backfill heuristique, Purchase Event fabriqué, classification déduite ou continuité inventée n'a été exécuté. Aucune donnée Canonical préexistante n'a été modifiée.

## H. Tests exécutés

Le wrapper `pnpm` fourni par l'environnement s'est arrêté avant l'exécution des scripts sur sa politique locale `ERR_PNPM_IGNORED_BUILDS` pour `sharp`. Aucun réglage ni build script n'a été approuvé. Les commandes du dépôt ont ensuite été exécutées directement, byte-for-byte, avec le runtime Node fourni et les dépendances déjà présentes.

| Contrôle | Résultat |
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
| `node scripts/check-live-runtime-regressions.mjs` | PASS |
| `tsc --noEmit` | PASS |
| `next build` | PASS — Next 16.2.6, compilation et TypeScript, 6 pages statiques |

## I. Non-régression V1

- Aucun snapshot, oracle, manifest ou hash V1 n'a été modifié par cette certification.
- Les checks Analysis Month, Analysis Global, Analytics materialization, Calendar/Day, Exploration/Entities et runtime passent.
- `sourceAwareEconomicDimensions()` et les builders Analysis V1 restent les moteurs internes existants.
- Aucun Calendar, `DailyEconomicAmount`, Query V2, snapshot V2, frontend ou legacy n'a été commencé ou retiré.
- Cette certification ne prétend pas recertifier les `1536/1536` snapshots historiques : elle certifie uniquement le schéma Canonical live ajouté.

## J. Écarts avec le rapport 02

- Changement attendu : les trois migrations que le rapport 02 déclarait locales et non appliquées figurent maintenant dans l'historique live.
- Aucun écart matériel de SQL ou de structure n'a été détecté.
- Les versions générées dans l'historique live diffèrent des préfixes de fichiers locaux ; les noms et les corps appliqués correspondent.
- Les cinq nouvelles tables sont volontairement vides ; le rapport 02 n'autorisait aucun remplissage heuristique.
- Les advisors ajoutent des informations de performance sur plusieurs FK non indexées. Elles ne remettent pas en cause l'intégrité ni la sécurité du schéma vide et n'ont pas été traitées hors périmètre.

## K. Mini-matrice de conformité

| Exigence Canonical du Brief | État live | Preuve | Statut |
|---|---|---|---|
| Identité Purchase Event explicite | Trois tables Purchase Event présentes | relations, PK, FK composites et projections live | PASS |
| Une composante de consommation n'a qu'un propriétaire | Appliqué | index unique partiel `purchase_event_consumption_owner_unique` | PASS |
| Source financière explicite et non ambiguë | Appliqué | checks `source_xor` et FK vers les cinq familles | PASS |
| Timing sans fallback bancaire inventé | Appliqué | assertions `DAY/MONTH`, autorité, date/mois et preuve requise | PASS |
| Classifications par composante et par axe | Appliqué | unicité composante/axe et contraintes statut/valeur/autorité | PASS |
| Continuité Life Event explicite | Appliqué | table dédiée, PK/FK Life Event et statuts `KNOWN/UNKNOWN/CONFLICT` | PASS |
| Household unique | Appliqué | cinq triggers, contrôle `READY`, compteur `1`, FK Household | PASS |
| Structures server-only | Appliqué | RLS, zéro policy, zéro DML anon/auth, droits service_role | PASS |
| Lecture par la couche Canonical | Compatible | projections exactes exécutées sous service_role, typecheck et build | PASS |
| Aucun backfill heuristique | Respecté | zéro ligne dans les cinq tables après tous les checks | PASS |
| Non-régression V1 | Préservée | suite ciblée V1 et build PASS | PASS |

## L. Nouvelles informations apprises et dette restante

- Le schéma live accepte les sélections exactes de la couche Canonical sous `service_role` ; l'ancien état `MISSING_MIGRATION` de Purchase Event n'est plus attendu.
- La combinaison RLS sans policy et révocation explicite des grants produit bien l'exposition server-only recherchée.
- Les cinq nouvelles relations démarrent à zéro ligne : toute connaissance future devra venir d'une assertion explicite, d'une source structurée autoritaire ou d'un backfill contrôlé distinctement validé.
- Les advisors de performance relèvent des FK sans index couvrant et l'index timing encore inutilisé. C'est une dette de performance à réévaluer avant un volume significatif, pas une raison d'ajouter des index dans cette mission.
- L'écart entre préfixes locaux et versions d'historique live doit rester documenté afin d'éviter un faux positif dans un futur contrôle de drift.
- Les alertes globales préexistantes du projet, dont la protection contre les mots de passe divulgués, restent hors périmètre de ce lot.

CANONICAL_LIVE_GATE = PASS
