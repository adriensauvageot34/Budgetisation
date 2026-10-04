# Phase 2 — Objectifs par catégorie et Explorer nos choix V2

Date : 2026-10-04. Baseline : `c9b2d6ab6d1a15edceabbd31fa3df743424452d0`, branche `main`, propre au démarrage. Commit final : `feat(phase2): add category targets and choice explorer v2` (le commit contenant ce rapport).

## Mini-audit et autorités réutilisées

Audit limité aux fichiers demandés : contrats décision/cagnottes, projection de décision, scénario, forecast restant, inputs mensuels, impact et persistence PlannedExpense, actions, cartes, outils de décision et suites associées.

- `alreadyRealized` représente uniquement Observed. Le réel de pilotage est centralisé dans `month-category-controls.ts` : `observedEconomic + declaredRealizedEconomic`, après le rapprochement existant. Une déclaration n’est pas un débit bancaire.
- `habitualProjectGross` contient les coûts des projets compatibles actifs, déclarés ou encore prévus. Le floor est `observedEconomic + habitualProjectGross`. Aucun choix ne réduit ce floor.
- `projectedMonth.central` est le forecast comparé à l’objectif. `remainingForecastEconomic.central` est le reste après absorption des projets. Aucune reconstruction du forecast dans React.
- Une assumption CUSTOM porte le **reste**, pas le total mensuel. La sémantique économique existante est conservée ; l’ancien texte « total du mois » est corrigé. Le moteur de choix convertit une réduction en montant CUSTOM restant.
- Le coût d’une sortie provient de `conditionalMedianAmount`, avec `expectedOccurrences.central >= 1`. Sans ces faits, aucune proposition « une sortie en moins ».
- Les cagnottes réservent du budget, sans consommation économique. `PROTECTED` est interdit comme levier ; `MONTH_INPUT/ADJUSTABLE` permet une adoption explicite. `ANNUAL_PLAN/ADJUSTABLE` permet uniquement la simulation.

## Contrat et parcours

`phase2_month_inputs.payload.decision` ajoute `categoryTargets` et normalise les anciens réglages `month-decision@v1` vers `month-decision@v2` à la lecture. Aucune migration SQL, table, policy, trigger ni écriture historique. Les montants sont positifs ou nuls, avec deux décimales maximum. Les mois passés sont refusés pour ces modifications. Aucun objectif ou choix n’est copié au mois suivant.

Une clé doit être reconnue par les capabilities autorisées ou publiée avec des metadata valides. La liste historique de sept clés reste seulement un contrat de lecture V1. Les cartes et propositions V2 consomment les catégories publiées et leurs capacités ; la fixture d’une nouvelle habitude certifiée prouve le parcours sans branche React dédiée. Aucune catégorie Activités fictive n’a été ajoutée. La mobilité reste contrainte.

Le read model expose objectif, réel, forecast, variance, marge, statut, floor, reste réductible et limites. Il distingue UNDER_TARGET, ON_TARGET, FORECAST_OVER_TARGET et ALREADY_OVER_TARGET. Le dépassement total additionne uniquement les variances positives.

`simulateMonthChoice` parse une ou deux opérations distinctes, copie les inputs et rejoue `deriveMonthScenario`. Il retourne les projections avant/après, leur delta exact, les impacts par catégorie, le budget libéré par les cagnottes, la consommation réduite, le gap compensé/restant et les limites. Il ne lit ni n’écrit la base. Les propositions sont déterministes : au plus six catégories, deux cagnottes ajustables, des variantes de montant dans les places restantes et une combinaison de deux catégories, au plus neuf options affichées. Chaque option est réellement simulée.

L’interface conserve Liquid Glass et l’objectif global. Les objectifs se définissent, se modifient et se retirent dans les cartes. Explorer montre les risques et des leviers chiffrés approximatifs. La simulation reste temporaire jusqu’à **Adopter ce choix pour ce mois**. Le serveur relit les inputs, projets, faits et policy temporelle, refuse une Preview périmée, recalcule puis enregistre uniquement les inputs du mois. Le financement reste entièrement calculé par ses propriétaires existants. Une cagnotte peut compenser une marge budgétaire sans effacer un dépassement de catégorie, affiché séparément.

L’ancien endpoint `simulateMonthBehavior` est conservé comme adaptateur pour une ancienne page ouverte. Il traduit les trois identifiants en commandes du moteur partagé ; il ne possède plus ses propres formules. Les boutons statiques ne sont plus dans l’interface.

## Vérification exécutée

Toutes les commandes ci-dessous ont été exécutées depuis le repo, avec le Node fourni par l’environnement. Tests exclusivement sur fixtures synthétiques, transport authentifié mocké, vrais parsers/actions/scénarios et persistence JSON mensuelle en mémoire. Aucun test navigateur, Vercel ou écriture live n’est revendiqué.

| Commande | Résultat |
| --- | --- |
| `node scripts/check-phase2-category-targets-choices.mjs` | PASS — 36 contrôles CHOICE-001 à CHOICE-036, dont Preview/Save/reload catégorie et cagnotte, stale, annual guard et rendu React. |
| `node scripts/check-phase2-month-decision-engine.mjs` | FAIL préexistant — voir ci-dessous. |
| `node scripts/check-phase2-savings-allocations.mjs` | PASS — 21 contrôles. |
| `node scripts/check-phase2-benefit-wallets.mjs` | PASS — 36 contrôles. |
| `node scripts/check-phase2-october-contract.mjs` | PASS. |
| `node scripts/check-phase2-month-narrative.mjs` | PASS. |
| `node scripts/check-phase2-planned-finance.mjs` | PASS. |
| `node scripts/check-phase2-planned-reliability.mjs` | PASS. |
| `node scripts/check-phase2-planned-guards.mjs` | PASS. |
| `node scripts/check-phase2-project-wizard.mjs` | PASS. |
| `node scripts/check-phase2-forecast-temporal-mode.mjs` | PASS — 13 contrôles. |
| `node scripts/check-phase2-temporal-forecast.mjs` | PASS — 63 contrôles. |
| `node scripts/check-architecture-imports.mjs` | PASS — 749 fichiers. |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS. |
| `node node_modules/next/dist/bin/next build` | PASS — compilation, TypeScript et génération des pages. |
| `git diff --check` | PASS avant commit. |

La suite V1 a été exécutée **avant toute modification**, au HEAD de départ propre. Sa première assertion échoue déjà : « asOf excludes future history as well as future actuals ». Elle compare le forecast brut à la prédiction enrichie par le propriétaire de funding des wallets ; les structures de financement diffèrent. L’ancien échec ultérieur `shift = DOWN` est déjà documenté dans `phase2-full-month-safe-mode.md`. Aucun de ces échecs n’a été masqué ou transformé en PASS. Les suites temporelles, wallets et les oracles ciblés du présent lot passent séparément.

Une régression introduite pendant le développement dans la projection des anciens réglages sans `categoryTargets` a été corrigée par la normalisation au point d’entrée ; la suite temporelle a ensuite été rejouée avec succès. Les imports de types serveur directs dans le client ont été remplacés par des types inférés des actions ; le contrôle d’architecture et le build ont été rejoués avec succès.

Preuves structurées : [phase2-category-targets-choices-tests.json](phase2-category-targets-choices-tests.json). Les logs bruts sont archivés hors du dépôt dans le répertoire evidence du workspace. Ils ne contiennent que des fixtures synthétiques.

## Limites et suites

- Aucun levier chiffré sans prédiction disponible ; les faits manquants ne sont pas inventés. Une capacité déclarée ne suffit pas à créer un historique ou un coût unitaire.
- Les offres bornées ne cherchent pas une solution optimale. Les économies de consommation restent prévisionnelles.
- L’adoption des contributions ANNUAL_PLAN attend le contrat annuel. Aucun rattrapage ou dette annuelle fictive.
- Les scénarios low/central/high sont réutilisés sans refonte ni recalibration.
- FULL_MONTH_SAFE reste le défaut ; AS_OF_TEMPORAL utilise le même scénario existant. Aucun amortissement par le passage du temps n’est introduit.
- Page annuelle, optimiseur, IA, apprentissage automatique d’objectifs, contextual forecast effects, probable ce mois-ci et chantier Mobility détaillé : différés.

```ini
MIGRATION_REQUIRED = NO
CATEGORY_TARGET_MODEL = PASS
LEGACY_DECISION_COMPATIBILITY = PASS
DYNAMIC_CATEGORY_ARCHITECTURE = PASS
CHOICE_ENGINE = PASS
PROTECTED_SAVINGS_GUARD = PASS
SIMULATION_ZERO_WRITE = PASS
PREVIEW_SAVE_RELOAD = PASS (fixtures)
FULL_MONTH_SAFE = PASS
AS_OF_TEMPORAL = PASS
TYPECHECK = PASS
BUILD = PASS
ZERO_HISTORICAL_WRITE = PASS (zéro écriture live)
BROWSER_USER_FLOW = NOT_TESTED
EXISTING_V1_DECISION_SUITE = FAIL_PREEXISTING
```
