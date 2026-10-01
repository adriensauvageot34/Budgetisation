# Mois à venir — simplification de la page

Brief : `PROMPT_CODEX_MOIS_A_VENIR_SIMPLIFICATION_INFOBESITE_V1_2026-10-01.md`.

## Résultat

```ini
HEAD_BEFORE = 8d220e108d9d9bf5600261a2de3bbf417e0b4cc7
HEAD_AFTER = commit portant ce rapport (git log -1 --format=%H -- docs/status/phase2-month-simplification-2026-10-01.md)
MIGRATIONS = NONE

MONTH_HEADER_SIMPLIFIED = PASS
STICKY_NAV = PASS
GLOBAL_ADD_EXPENSE_CTA = PASS
BUILDER_OVERLAY = PASS
EMPTY_PROJECTS_HIDDEN = PASS
EMPTY_CALENDAR_COPY_REMOVED = PASS
NECESSARY_CARDS_SIMPLIFIED = PASS
OBSERVED_PLANNED_REMAINING = PASS
PLANNED_ABSORPTION = PASS
REALIZED_RECONCILIATION = PASS
IMPORT_PARTIAL_COPY_REMOVED = PASS
WHY_BLOCKS_REMOVED = PASS
MONTH_HYPOTHESIS_MOVED = PASS
NECESSARY_REFERENCE_REMOVED = PASS
AFTER_ESSENTIAL_SIMPLIFIED = PASS
EARLY_MONTH_PROJECTION_FALLBACK = PASS
AT_AFFINER_POLICY = PASS
EXTRAS_SIMPLIFIED = PASS
EXTRAS_REFERENCE_REMOVED = PASS
FINAL_PROJECTION_SIMPLIFIED = PASS
WATCH_BLOCK_CONDITIONAL = PASS
PROJECTION_EVOLUTION_CONDITIONAL = PASS
EXPLORE_CHOICES_PRESERVED = PASS
TEST_EXPENSE_REMOVED_FROM_CHOICES = PASS
PRECISION_MODULE_SIMPLIFIED = PASS
AUTOMATIC_200_EUR_BUFFER_REMOVED = PASS
USER_DEFINED_GOAL_ONLY = PASS
UNIT_TESTS = PASS
TYPECHECK = PASS
LINT = NOT_CONFIGURED
BUILD = PASS
BROWSER_SMOKE = PASS (lecture, ancres, ouverture/fermeture, focus, console)
KNOWN_LIMITATIONS = voir ci-dessous
FOLLOW_UPS = aucun blocage identifié pour ce patch
```

## Changements

- Un seul titre du mois, centré dans le sélecteur. Le calendrier porte le titre « Calendrier ».
- Navigation sticky sur toute la page, CTA permanent et ancres sans section vide. Les ancres tiennent compte de la hauteur de la barre.
- Tous les parcours du Builder utilisent la surcouche existante. Le draft, la confirmation d’abandon, les réparations et les actions serveur restent conservés. Le retour de focus et la position à l’activation sont mémorisés.
- Projets en liste unique, uniquement quand ils existent. Les actions et détails se déplient volontairement.
- Cartes du quotidien : projection, observé, prévu, encore estimé. Les réalisations déclarées changent de colonne ; le calcul de baseline reste identique.
- Montants de présentation arrondis ensemble, avec conservation des zéros et réconciliation des trois composantes. Les totaux des headers sont la somme des cartes.
- Extras et jalons compacts. Provenance, couverture et méthode restent accessibles via ⓘ.
- Hypothèses déplacées dans Réglages du mois. Alertes de couverture et blocs sans comparaison supprimés. Seuls les checkpoints du même mois et de la version courante sont comparables.
- Les scénarios calculés restent visibles dès le début du mois. Une absence de ressources structurantes continue à empêcher une présentation trompeuse.
- Objectif personnel explicitement défini, sans coût ni déduction financière. Le champ historique `safetyReserve` reste lisible mais n’affecte plus les calculs. Le buffer des anciens snapshots est neutralisé à la lecture, sans réécriture. Un ancien formulaire de réserve encore ouvert applique un objectif personnel.

## Autorités et correspondance des noms

« Quotidien » correspond à `prediction.essential`, « Extras » à `prediction.optional`.
« Observé » inclut les faits importés et les réalisations déclarées pour la présentation.
Une déclaration reste prospective : aucun débit historique n’est créé.
Les deux nouveaux sous-totaux de statut sont produits dans le moteur existant `remaining-month-forecast`, sans calcul métier dans React.
Le mode passé utilise toujours `PastMonthView`.

## Vérifications exécutées

Exécutables : Node fourni avec Codex, depuis la racine du dépôt.

```text
node scripts/check-phase2-month-simplification.mjs       PASS
  inclut le rerun check-phase2-month-decision-engine.mjs  PASS
node scripts/check-phase2-month-decisions.mjs           PASS
node scripts/check-phase2-month-narrative.mjs            PASS
node scripts/check-phase2-planned-server-contract.mjs    PASS
node scripts/check-phase2-planned-calendar.mjs           PASS
node scripts/check-phase2-restaurant-wizard.mjs          PASS
node scripts/check-phase2-planned-builder.mjs            PASS
node node_modules/typescript/bin/tsc --noEmit            PASS
node node_modules/next/dist/bin/next build               PASS
git diff --check                                        PASS
```

Les tests ciblés couvrent les courses planifiées puis déclarées, les repas travail d’Adrien et Manon, les observations fractionnaires, les estimations épuisées, les arrondis, les modes temporels, l’absence de projet/alerte/checkpoint comparable, l’apparition du premier projet, la forme de la surcouche, les simulations sans écriture et l’isolement de l’objectif.

Le test de neutralité du lifecycle compare toutes les anciennes valeurs financières ; seuls les nouveaux sous-totaux de présentation sont exclus de cette égalité, puis vérifiés séparément.

Contrôle navigateur sur le build de production local, avec session réelle :

- titre unique et projets vides absents ;
- quotidien et jalons numériques dès le premier jour du mois ;
- navigation sticky, CTA visible et ancre Quotidien sous la barre ;
- dialogue d’ajout ouvert puis fermé, focus rendu au CTA ;
- même position de scroll entre surcouche ouverte et fermée ; les commandes d’automatisation peuvent recentrer le CTA avant son activation ;
- aucun avertissement ni erreur console pendant le contrôle ;
- aucun enregistrement de dépense, d’hypothèse ou de checkpoint effectué.

## Limites

Le dépôt ne configure pas ESLint : aucun PASS de lint n’est revendiqué.
Les anciens scripts live `check-phase2-month-forecast` et `check-phase2-month-scenario` ont été tentés mais leur garde exige un foyer et un mois explicites ; ils n’ont donc exécuté aucun audit live. Leurs attentes de buffer ont été adaptées à la doctrine du brief. Les tests ciblés ci-dessus couvrent les anciennes formes en mémoire.
Les transitions d’enregistrement sont vérifiées par les harnesses serveur ; aucun CRUD réel supplémentaire n’a été exécuté sur Supabase.
Le shim de lecture des snapshots publiés antérieurs est conservé. Aucun nouveau schéma, seconde authority financière, historique, ni modèle responsive n’a été ajouté.

## FILES_CHANGED

```text
src/app/mois-a-venir/actions.ts
src/app/mois-a-venir/month-calendar.tsx
src/app/mois-a-venir/month-decision-tools.tsx
src/app/mois-a-venir/month-forecast-view.tsx
src/app/mois-a-venir/month-narrative-cards.tsx
src/app/mois-a-venir/month-section-nav.tsx
src/app/mois-a-venir/month-story.tsx
src/app/mois-a-venir/planned-expense-interactions.tsx
src/app/mois-a-venir/planned-expenses-control.tsx
src/app/mois-a-venir/planned-wizard-visuals.tsx
src/server/phase2/forecast-memory.ts
src/server/phase2/month-decision-projection.ts
src/server/phase2/month-forecast.ts
src/server/phase2/month-scenario.ts
src/server/phase2/remaining-month-forecast.ts
scripts/check-phase2-month-decision-engine.mjs
scripts/check-phase2-month-decisions.mjs
scripts/check-phase2-month-forecast.mjs
scripts/check-phase2-month-narrative.mjs
scripts/check-phase2-month-scenario.mjs
scripts/check-phase2-month-simplification.mjs
docs/status/phase2-month-simplification-2026-10-01.md
```
