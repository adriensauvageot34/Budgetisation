# Centre de contrôle V3 — livraison desktop

Date : 2026-10-05. Branche : main. Baseline : `8f25956dfd72c8feba908adc7da965aebd66f621`.
HEAD de livraison : commit contenant ce rapport (`feat(phase2): redesign control center as spatial workspace`).

## Architecture et périmètre

Les onglets et la navigation latérale du Centre sont remplacés par trois cartes entièrement cliquables : Piloter mon mois, Mes cagnottes, Mettre à jour. Le compteur apparaît seulement sur cette dernière. Le header conserve le résultat mensuel, l'objectif, les informations et la fermeture.

Piloter ouvre directement les catégories, puis une vue réunissant objectif, hypothèse active et simulation. Les modèles existants de cible, simulation et ajustement restent les authorities. Aucun second moteur financier. Les anciens liens passent par un adaptateur de focus local ; aucun état de navigation supplémentaire n'est persisté.

La classification des mises à jour est centralisée dans le read-model serveur. Priorité exclusive : besoin d'actualisation, désactivation, modification, confirmation explicite. Une prévision habituelle sans confirmation reste une référence neutre (`status: null`), pas une confirmation inventée. Ornikar suit la déclaration conditionnelle : inconnue à actualiser, non désactivée, oui modifiée. Les stocks et dates des wallets et le solde bancaire sont vérifiés séparément.

Le triage conserve l'éditeur courant durant le rafraîchissement puis propose l'information suivante depuis le read-model recalculé. Les actions de restauration et de sauvegarde existantes sont réutilisées. Les cartes désactivées, le journal des modifications et les confirmations ont des présentations distinctes. Le panneau Informations ne contient que des faits de calcul et de provenance ; l'ancienne page Comprendre et son action de conservation ne font plus partie du Centre.

## Historique et mini-audit

Le moteur mensuel expose sept catégories, dont six ajustables et le trajet de Manon fixe. Les catégories supplémentaires présentes dans les projets ou l'analytics ne sont pas fabriquées comme leviers mensuels. La grille suit les capacités publiées.

Les références minimum/médiane/maximum proviennent exclusivement de mois historiques clos, complets et comparables, avec au moins trois observations. Matching canonique, provenance des sources et attribution des personnes sont conservés. Les mois partiels, valeurs absentes et attributions ambiguës sont exclus. Les bornes basses/hautes du forecast ne sont jamais utilisées comme historique. Les données live observées ne suffisent pas actuellement pour toutes les références.

Aucune migration, modification Supabase ou écriture historique/live n'a été réalisée. Aucun travail mobile ou responsive ajouté.

## Vérifications exécutées

Commandes : `node scripts/<nom>.mjs` pour les suites ci-dessous ; `node node_modules/typescript/bin/tsc --noEmit` ; `node node_modules/next/dist/bin/next build` ; `git diff --check`.

| Suite | Résultat |
| --- | --- |
| check-phase2-month-control-center-spatial-ux | PASS 64/64 |
| check-phase2-month-control-center-choices-ux | PASS 68/68 |
| check-phase2-month-control-center-human-ux | PASS 53/53 |
| check-phase2-month-control-center-ux | PASS 57/57 |
| check-phase2-month-control-center | PASS 85/85 |
| check-phase2-category-targets-choices | PASS 36 |
| check-phase2-savings-allocations | PASS 21 |
| check-phase2-benefit-wallets | PASS 36 |
| check-phase2-month-narrative | PASS |
| check-phase2-october-contract | PASS |
| check-phase2-planned-finance | PASS |
| check-phase2-planned-reliability | PASS |
| check-phase2-planned-guards | PASS |
| check-phase2-project-wizard | PASS |
| check-phase2-forecast-temporal-mode | PASS 13 |
| check-phase2-temporal-forecast | PASS 63 |
| check-global-v2-frontend | PASS 728/728 ; RuntimeSchemas 71/71 |
| check-architecture-imports | PASS 770 fichiers |
| check-phase2-month-decision-engine | Échec préexistant identique : `asOf excludes future history as well as future actuals` |
| Typecheck / build production / diff check | PASS |

Les assertions de présentation devenues obsolètes ont été adaptées ; les assertions financières sont conservées. Les suites couvrent Preview sans écriture, application atomique, péremption, plancher irréversible, épargne protégée, FULL_MONTH_SAFE et AS_OF, sauvegarde/relecture avec infrastructure synthétique et exclusion des statuts.

## Vérification navigateur desktop

40 captures et mesures sur 1728×900, 1920×1080 et 1440×900 : modal dans le viewport, aucun scroll vertical du contenu principal, aucune action tronquée. Parcours : accueil, index et catégorie Pilotage, Cagnottes, accueil Mise à jour, quatre statuts, solde bancaire et Informations. Les références habituelles et les champs stock/date/chargement wallet ont aussi été inspectés.

Le Preview serveur et l'invalidation après édition ont été exercés. Deux corrections issues de cette vérification : Escape ferme Informations avant le Centre ; une saisie exacte non recalculée bloque application et enregistrement de cible. Aucune sauvegarde, application ou réactivation live n'a été exécutée dans le navigateur ; ces actions sont prouvées par les suites synthétiques, pas par un test live.

Les preuves détaillées et captures potentiellement personnelles restent hors du dépôt : `../evidence/phase2-control-spatial-v3` depuis la racine de travail `ve`. Résumé sans données personnelles : `phase2-month-control-center-spatial-v3-verification.json`.

## Limites et suites

- Échec V1 préexistant indiqué ci-dessus ; moteur concerné inchangé.
- Historique comparable insuffisant pour certaines références live ; absence expliquée dans l'interface.
- Leviers supplémentaires uniquement quand le moteur mensuel les publiera.
- Écritures navigateur live non testées dans ce lot.
- Avertissements préexistants de proportions d'images de marques, sans erreur fonctionnelle du Centre.
- Les adaptateurs de liens anciens restent nécessaires pour la compatibilité ; aucune ancienne authority de statut ou de calcul n'est conservée dans React.
