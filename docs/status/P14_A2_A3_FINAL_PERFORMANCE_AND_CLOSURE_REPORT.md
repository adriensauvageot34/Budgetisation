# P14-A2/A3 — performances et clôture

État de travail du 15 octobre 2026 : **PARTIAL — preuves authentifiées en attente de l'accès navigateur**. Le verdict de clôture provisoire est `P14_NOT_READY_TO_CLOSE`, car le gate Draft inter-déploiement et la comparaison réelle de ce candidat ne sont pas encore exécutés. Les travaux indépendants ci-dessous sont développés et compilés en Preview ; aucune livraison Production de performance n'a été faite.

## A. État initial vérifié

- GitHub `main` et Vercel Production : `7098e3bad96ff6be724284246f95d4370c028e9b`, déploiement `dpl_F8GXVCgTa4D6tTBmnQyEKAc5sKnF`, READY, région configurée `iad1`.
- PR Draft [#32](https://github.com/adriensauvageot34/Budgetisation/pull/32) sur `b8d365d` : contrôles Vercel PASS. Son test A→B est programmé séparément ; cette branche et son alias n'ont pas été modifiés par A2/A3.
- Production : SNAP-3 `1`, P14-P3 `0`, SNAP-1 `0`. Supabase reste en `eu-central-1` selon le préflight existant.
- État SNAP-3 relu : révision 1, époque 2, enabled=true, couverture des writers vraie. Artifacts READY : Canonical génération 2, digest `78ce99e0d65ca81ad84fcc9c9e7ab1df5e0a5e99dbad5d45271fb3edc5117dcc` ; M7 génération 1, digest `5d887dd265744dfbd7e4160a6c0fd106f8f14249d24aa2460ebdb838baea516f`. Aucune invalidation naturelle nouvelle n'est visible dans cette révision.
- Branche isolée `codex/composer-v3-p14-a2-a3-performance`, worktree `p14-a2-a3-performance`, issue de `main`. La Production restera inchangée jusqu'à résolution du gate Draft.

## B. Diagnostic borné

La référence authentifiée précédente contient dix ouvertures chaudes : FRESH P50 6,59 s / P95 descriptif 8,79 s ; World 2,82 / 4,08 s ; Evidence 2,51 / 3,63 s. Elle ne contient pas les sous-étapes nécessaires pour attribuer chacune des secondes restantes.

Le graphe du lecteur révèle deux attentes supprimables sans changement financier : un SELECT du fuseau alors que Composer fournit déjà le fuseau du contexte autorisé, puis une barrière métadonnées attendue avant des requêtes historiques qui utilisent uniquement le scope et les dates déjà admis. La portée singleton Canonical est toujours contrôlée avant toute lecture suivante. Les deux groupes conservent les mêmes requêtes, filtres, pagination et transformations ; leur chevauchement augmente la concurrence de lecture et doit être validé sur les vraies traces, en arrêtant la série si un timeout réapparaît.

L'instrumentation existante a été complétée : spans par page et par source de métadonnées ; `metricsDrainMs` distingue l'attente de collecte des corps de réponse du travail serveur ; `responseReadyMs` mesure la sortie du collecteur. Le navigateur expose des horodatages monotones de début/résolution d'action, les Resource Timings du fetch correspondant, le commit observé, la première observation FRESH après peinture et responseEnd→FRESH. Si plusieurs fetchs correspondent, l'attribution reste `UNATTRIBUTED`. Ces marqueurs ne mesurent pas une durée exclusive du rendu React ou du parsing RSC.

## C. Modifications développées

| Commit | Changement | Preuve disponible | Gain réel |
|---|---|---|---|
| `34798ff` | Sous-étapes Evidence, pages, collecte métriques et chronologie navigateur | Tests d'observation, TypeScript, builds Preview | Instrumentation seulement |
| `cd58a1e` | Évite la relecture du fuseau fourni et chevauche métadonnées/historique | Parité exacte du lecteur avant/après sur fixtures ; 1 requête évitée dans cette fixture | `NOT_MEASURED` |

Aucun calcul Canonical, M7, Forecast ou Finance V2 n'a été remplacé. Aucun cache, snapshot ou mécanisme de republication supplémentaire. Le consommateur autonome qui ne fournit pas de fuseau garde la lecture du foyer.

## D. Previews et protocole réel

| Variante | Source | Déploiement | État | Région configurée |
|---|---|---|---|---|
| Référence | `34798ff`, code instrumenté sans optimisation | `dpl_Hy6YDfpzcV8caTaLfMWy9nGsxQLH` | READY | iad1 |
| Même référence | même arbre applicatif local | `dpl_6DN9YC3xgRPAwyAXUpuLeWXt517K` | READY | fra1 |
| Candidat Evidence | `cd58a1e` | `dpl_B8GV8PZ28m8neBs85Ho9sS9tWdLz` | READY | iad1, à confirmer dans la trace d'exécution |

Alias de performance dédié : `budgetisation-p14-perf-adriensauvageot34-6137s-projects.vercel.app`, initialement sur la référence iad1. Il permet une même session applicative pendant les basculements de variantes, avec rechargement complet entre chaque mesure. L'alias de test Draft reste indépendant.

Flags identiques : SNAP-3 ON, P3 OFF, métriques/trace ON, benchmark read-only ON, autosauvegarde OFF, préparation SNAP-3 OFF. Les protections Vercel sont conservées. Les déploiements CLI proviennent du même arbre Git propre pour le code, avec `outputs`, `.env*`, `.git` et dépendances exclus de l'upload.

À la levée de la limite navigateur : même compte/mois/viewport, contrôle des deux HIT et des digests, petite série alternée puis dix paires si la charge et les résultats le permettent. Comparer d'abord référence iad1/fra1, puis référence/candidat dans la même région. Conserver les essais défavorables ; stopper les essais lourds au premier timeout reproduit. Pour l'édition : Courses, Soirée, trois montants rapides et Suggestions ; aucun Apply. Capturer uniquement métriques, versions et digests, sans contenu financier ni session. Un gain régional éventuel ne justifiera une modification Production qu'après contrôle de la portée des fonctions concernées.

| Indicateur | Avant authentifié hérité | Après A2/A3 | Gain |
|---|---:|---|---|
| Ouverture→FRESH P50 | 6,59 s, n=10 | NOT_RUN | Non revendiqué |
| Ouverture→FRESH P95 descriptif | 8,79 s, n=10 | NOT_RUN | Non revendiqué |
| Édition→FRESH P50/P95 | NOT_RUN dans cette campagne | NOT_RUN | Non revendiqué |
| Evidence P50 | 2,51 s | NOT_RUN | Non revendiqué |
| World P50 | 2,82 s | NOT_RUN | Non revendiqué |
| Temps navigateur après réponse | UNATTRIBUTED | NOT_RUN | Non revendiqué |
| Requêtes Supabase | 42 par READ de la référence héritée | NOT_RUN | 20→19 concerne uniquement la fixture |
| Octets décodés | 2 351 081 par READ hérité | NOT_RUN | Non revendiqué |

## E. Intégrité et régressions

- `check-composer-p14-a2-evidence.mjs` : cinq contrôles PASS. Comparaison du vrai lecteur au commit instrumenté précédent : sortie exacte, 1001 opérations et pagination complète, remplacement d'un achat sans double compte, PARTIAL/UNKNOWN, frontières de mois/fuseau, historique absent, scope refusé avant lectures suivantes, erreurs concurrentes et fraîcheur entre deux READ.
- `check-phase2-temporal-forecast.mjs` : 63 contrôles PASS après correction. `check-planner-performance-parity.mjs` : 22 scénarios, neuf empreintes par scénario, PASS.
- `check-composer-world-trace.mjs` : PASS, y compris isolement par requête, confidentialité des métriques, lecture seule et distinction du coût de collecte.
- TypeScript : PASS. Builds complets Vercel : READY pour les trois variantes ; environnement Windows local non réaudité.
- `check-composer-orchestration.mjs` : FAIL de harness avant exécution des assertions (`Unstubbed import ./activity-history-artifact`). Le harness et les imports du module qu'il charge sont identiques à `main` ; aucun verdict PASS ne lui est attribué. Ce défaut de stub ne démontre pas une régression de l'optimisation Evidence.
- JWT, RLS authentifiée, parité des digests réels, réponse navigateur hors ordre : `NOT_RUN` pour A2/A3 à ce stade. Aucun test financier ou Apply de Production, aucune écriture de source, aucune migration.

## F. Livraison

Branche de performance publiée pour Preview. PR, merge et Production A2/A3 : `NOT_RUN`, en attente des mesures réelles et de la livraison Draft. Rollback de l'optimisation : revenir au commit instrumenté `34798ff` ; aucune donnée à restaurer. Une région d'exécution ne sera conservée que si sa comparaison authentifiée démontre un gain répétable.

## G. Clôture P14

`P14_NOT_READY_TO_CLOSE` à ce stade : fiabilité Draft inter-déploiement non encore certifiée ; gains A2/A3 authentifiés non mesurés. Les cibles P95 <5 s à l'ouverture, <2 s à l'édition et <100 ms visuel ne sont pas certifiées. Les 30 triggers SNAP-3 et le fallback direct restent le mécanisme existant ; aucune préparation lourde n'est lancée pendant READ. La republication hors READ et son coût lors d'une première invalidation naturelle restent une limite connue, sans Cron ajouté.

## H. Préparation B1 — PlanRevision officielle → Forecast

Périmètre de conception uniquement, aucune implantation B1 dans cette branche. Réutiliser `PlanReadRepository.readActive/readRevision`, `PlanRevision` et ses preuves immuables, `resolveEffectiveMonthScenario`, le Compiler/`evaluatePlanScenario`, puis `readPlanningMonthForecast/queryMonthForecast` et `MonthForecastSnapshot`. Apply reste le seul passage Draft→révision officielle, avec CAS et idempotence. Aucun Draft non appliqué ne doit entrer dans une publication Forecast.

Le contrat consommé devra porter foyer/mois, identité et numéro de révision active, versions de méthodes, digests de sources/projection et statut de fraîcheur. La contribution du Plan doit remplacer les capacités couvertes de la Baseline, avec les mêmes identités économiques ; ne pas additionner une seconde fois les montants déjà représentés par PlannedExpenses, réservations d'épargne, achats observés ou coûts parent/enfants. Une nouvelle révision ou une source rétroactive doit invalider/admettre explicitement la projection, sans réécrire l'ancienne PlanRevision. Le READ officiel d'Apply reste autoritaire.

Premiers cas B1 : absence de Plan (parité V2), Courses 325→350 par substitution, parent Séjour/enfants, UNKNOWN/PARTIAL, changement de révision pendant le READ, réponse ancienne/replay Apply, PlannedExpense déjà présente, protections d'épargne et coûts d'usage Mobility distincts des paiements. Les consommateurs à inventorier ensuite sont la projection Forecast du mois et la restitution de Mois à venir ; aucun writer Purchase/Operation/PlannedExpense/Wallet ne doit être déclenché par cette lecture.
