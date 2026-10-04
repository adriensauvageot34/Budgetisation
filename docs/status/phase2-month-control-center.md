# Phase 2 — Centre de contrôle du mois

## Livraison

- Base : `736f111a18c2889687a38de897d912da854add21`, `main`, arbre initial propre.
- Commit de livraison : celui contenant ce rapport (`git log -1 --format=%H -- docs/status/phase2-month-control-center.md`).
- Aucune migration ni nouvelle table. Le draft, son but, les causes et les états de modale ne sont pas persistés.
- Portée : interface PC, modèle de lecture, orchestration et réutilisation des propriétaires existants.

## Mini-audit ciblé

Les inputs mensuels, le moteur `deriveMonthScenario`, `projectMonthDecision`, les contrôles par catégorie, le financement des wallets, la projection bancaire, les cagnottes et la mémoire de prévision ont été suivis jusqu’à leurs propriétaires existants. Les points d’entrée réels de la page, des éditeurs, du calendrier et de `OverlayFrame` ont été inspectés. Aucun nouvel audit général ni reconstruction du produit.

Le modèle `month-control-center.ts` interprète ces résultats. Il ne remplace aucun moteur économique, statistique, temporel ou de mobilité. `month-control-contract.ts` contient seulement les contrats éphémères et la composition/navigation du draft.

## Modèle de lecture

- Tensions de catégorie et d’objectif global séparées des informations manquantes.
- Faits datés séparés des intentions, décisions, réservations et conséquences simulées.
- Une cause par wallet ; une cause par projet pour ses différents symptômes ; imports et révision regroupés. Seules les causes actionnables et les vraies tensions alimentent le compteur.
- Périmètres économiques, Banque, financement Benefit et projet distincts. Les imports restent une limite de connaissance ; ils ne deviennent jamais des dépenses nulles.
- Hypothèses, overrides de ressources et charges, exclusions, réponses aux échéances, objectifs et réservations sont reconstruits depuis les inputs existants.

## Workbench et adoption

Maximum deux cibles distinctes, remplacement d’une cible, retrait et réinitialisation. Le serveur rejoue l’ensemble avec `simulateMonthChoice` depuis l’état persisté ; aucun cumul de deltas indépendants en React.

Buts : corriger une catégorie, compenser son dépassement ailleurs, atteindre l’objectif global, explorer librement. Aucun levier imposé en période calme. Une réduction de Restaurant n’efface pas l’écart propre de Courses. Dans l’oracle synthétique 42 → Restaurant 28, le besoin de compensation restant vaut 14 et les propositions sont redimensionnées sur 14. Une contribution protégée de 1 200 reste identique dans les deux colonnes et ne devient jamais candidate. Consommation évitée et réservation libérée restent distinctes.

`applyMonthChoice` relit les autorités et vérifie le digest avant une seule écriture JSON mensuelle pour les deux opérations. Une prévision périmée ne produit aucune écriture ; recalcul et nouvelle application explicite sont nécessaires. Les inputs et résultats serveur sont ensuite relus. Le draft se vide et la modale reste dans sa zone.

## Corrections prouvées pendant le parcours navigateur

1. Page et actions lisaient des versions différentes de la prévision (publication contre reconstruction). `month-planning-read.ts` donne désormais le même parcours : publication valide, sinon résolution sans écriture du mois non publié. Les erreurs d’identité ne sont pas masquées par un fallback.
2. `computedAt`, horodatage de construction, n’est plus une cause artificielle de péremption du digest. Révisions, références, faits, inputs, projets, date de calcul métier et mode temporel restent couverts.
3. L’historique natif utilise `replaceState(null, …)` pour laisser Next synchroniser son URL interne ; l’ancien état marqué Next conservait l’URL précédente lors du refresh.
4. Les raccourcis Swile/Edenred visent les contrôles de wallet ; les chargements disposent d’un autre identifiant de focus. Le focus de retour est fourni au mécanisme existant de `OverlayFrame`.
5. La modale partage les variables du matériau de la page. Les boutons primaires ont retrouvé leur contraste ; le bouton de fermeture est aligné à droite.

## Interface et nettoyage

Les cinq zones sont : À piloter, Objectifs & choix, Réglages du mois, Ressources & réserves, Fiabilité. Le bouton est immédiatement avant « Ajouter une dépense ». L’ancre Choix, l’Explorer inline, le gros bloc de précision, les formulaires d’objectifs, ressources et cagnottes dans la narration, les alertes répétées et l’historique inline ont été retirés.

La narration conserve ses résultats, projets et calendrier. Les cartes offrent des raccourcis sémantiques. Le mois reste dans l’URL, avec `control` et `focus`, sans montant ni draft financier. Le provider est lié au mois et conserve le draft lors de fermeture/réouverture. Les mois passés restent dans `PastMonthView` ; les actions du Centre refusent leurs mutations. Un mois sans plan économique conserve un accès au Centre et n’invente aucun total à zéro.

`OverlayFrame` conserve le dialog, Escape, l’inertie du fond, le verrouillage du scroll, la gestion du focus et sa restauration. Aucun second portal ou piège de focus. « Voir le projet » ferme le Centre avant de solliciter l’éditeur existant. Les checkpoints restent strictement explicites.

Compatibilité conservée : `simulateMonthBehavior` est une ancienne entrée qui traduit ses presets vers le moteur partagé ; elle n’est plus rendue comme Explorer. `updateMonthInputs` reste l’entrée des formulaires existants et appelle le même propriétaire de mutation que la réponse structurée `updateMonthControlInputs`. Ce ne sont pas des autorités financières supplémentaires.

## Certification automatique

85 contrôles ciblés : **63 comportementaux et 22 vérifications de frontières/source**. Les contrôles statiques ne sont pas présentés comme des tests navigateur. Les actions, les parsers, les modèles et les propriétaires d’écriture mensuelle sont réels ; seuls les transports authentifiés/canoniques sont simulés. Aucun test n’utilise un foyer réel.

| Commande | Résultat |
| --- | --- |
| `node scripts/check-phase2-month-control-center.mjs` | PASS — 85/85 |
| `node scripts/check-phase2-category-targets-choices.mjs` | PASS — 36/36 |
| `node scripts/check-phase2-savings-allocations.mjs` | PASS |
| `node scripts/check-phase2-benefit-wallets.mjs` | PASS |
| `node scripts/check-phase2-october-contract.mjs` | PASS |
| `node scripts/check-phase2-month-narrative.mjs` | PASS |
| `node scripts/check-phase2-planned-finance.mjs` | PASS |
| `node scripts/check-phase2-planned-reliability.mjs` | PASS |
| `node scripts/check-phase2-planned-guards.mjs` | PASS |
| `node scripts/check-phase2-project-wizard.mjs` | PASS |
| `node scripts/check-phase2-forecast-temporal-mode.mjs` | PASS |
| `node scripts/check-phase2-temporal-forecast.mjs` | PASS |
| `node scripts/check-global-v2-frontend.mjs` | PASS |
| `node scripts/check-architecture-imports.mjs` | PASS |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node node_modules/next/dist/bin/next build` | PASS |
| `node scripts/check-phase2-month-decision-engine.mjs` | SAME_PREEXISTING_FAILURE |
| `node scripts/check-phase2-month-simplification.mjs` | SAME_PREEXISTING_FAILURE — importe la suite précédente |

Les deux assertions UI devenues obsolètes ont été déplacées vers le Centre dans les suites de catégories et narration. Aucun oracle financier n’a été modifié pour obtenir du vert.

### Première assertion V1, avant et après

`AssertionError [ERR_ASSERTION]: asOf excludes future history as well as future actuals`

L’assertion compare une catégorie issue de l’appel brut au forecast à la catégorie enrichie par les wallets. Les structures de financement diffèrent. Les sorties normalisées avant/après sont **strictement identiques** pour V1 et simplification ; aucun nouvel échec n’est introduit. La suite s’arrête à ce premier défaut ; ses assertions ultérieures ne sont pas déclarées PASS.

## Preuves

- Matrice détaillée : `phase2-month-control-center-tests.json`, identifiants CC-001 à CC-085.
- Parité preview/adoption/relecture : CC-029 à CC-032, CC-050 à CC-052.
- Aucun historique, achat, opération ni PlannedExpense écrit par ces fixtures : CC-053 à CC-055, CC-080.
- FULL_MONTH_SAFE, AS_OF et absence de recalibrage de règles : CC-066 à CC-068, CC-078, suites existantes.
- Lecture identique page/actions, fallback limité et timestamp non autoritaire : CC-081 à CC-083.
- Wallet stock et chargement sans faux coût de repas : CC-061 à CC-063 et CC-085.
- Logs bruts et exports de test hors dépôt : `C:/Users/Manon/Documents/Codex/2026-09-28/ve/evidence/phase2-month-control-center-2026-10-04`.

## Limites et suite

Les contrôles automatiques ne corrigent pas l’échec V1 préexistant. Le détail du parcours navigateur et les éventuelles étapes non exécutées sont consignés dans `phase2-month-control-center-browser.md` ; aucune réussite d’écriture live n’est inférée depuis les mocks.

Les futurs diagnostics AS_OF détaillés, Probable ce mois-ci et effets contextuels pourront consommer la même zone Fiabilité. Aucun de ces modules, aucune nouvelle règle mobilité ni recalibration low/high n’est introduit ici.
