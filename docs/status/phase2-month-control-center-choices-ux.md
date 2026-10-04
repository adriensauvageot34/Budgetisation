# Centre de contrôle — Mes choix comme application locale

Date : 4 octobre 2026. Branche : `main`.

Baseline réellement vérifiée : `57fc3d2d9e49312046ca5ffe3fc8517c4261ad08`, worktree initialement propre. Aucun reset.

## Mini-audit ciblé

Le shell est `MonthControlCenter` dans `month-control-center.tsx`, avec `OverlayFrame` et sa feuille CSS locale. La navigation locale existante appartient à `MonthLocalFocusProvider` et `month-control-contract.ts`. Les éditeurs de repères, choix et cagnottes étaient regroupés dans `month-control-choices.tsx`. Le simulateur utilisait déjà les actions serveur Preview/Apply et le digest du mois. `month-control-panels.tsx`, `month-control-update.tsx` et `month-decision-tools.tsx` portent les parcours existants de mise à jour et de compréhension.

Le patch conserve les trois onglets **Mes choix / Mettre à jour / Comprendre**. Il restructure Mes choix et compacte le shell partagé. Les deux autres parcours ont été ouverts dans le navigateur, dont un éditeur de salaire sans sauvegarde.

## Architecture et navigation

- Racine : exactement quatre grandes cartes entièrement cliquables en grille 2 × 2 : Mes repères, Tester un scénario, Mes ajustements, Mes cagnottes. Aucun formulaire à la racine.
- Vues locales : index paginés et éditeurs focalisés, sans changement d’onglet. Retour discret et stable en haut ; zone d’actions réservée en bas.
- Header : une ligne avec titre, fin de mois estimée, objectif, compteur compact et fermeture. Suppression du sous-titre et de la seconde barre de résumé.
- Sidebar : hauteur réduite et pastille ronde pour Mettre à jour ; aucune pastille lorsque le compteur vaut zéro.
- Toast local hors flux, durée 2,8 secondes. Les erreurs et l’état de recalcul restent hors flux.
- Composants partagés : `LocalChoiceScreen`, `ChoiceTile`, `ChoicePages`, `PercentStepper`, `RelativeAmountControl`, `TargetGauge`.

## Budget vertical

Le shell mesure au plus 790 px et garde 72 px disponibles dans le viewport desktop. Aux trois formats principaux, les écrans focalisés mesurés donnent :

| Zone | clientHeight | scrollHeight |
|---|---:|---:|
| Shell | 790 | 790 |
| Contenu | 707 | 707 |
| Vue focalisée | 659 | 659 |

La grille racine utilise 490 px et est centrée. Le contenu conserve `overflow: auto` comme sécurité accessible. Aucun masquage de scrollbar ne sert à produire le résultat. Le footer occupe son espace dans le layout et ne recouvre pas le corps.

Les catégories sont paginées par six ; les cagnottes et ajustements actifs par quatre. Sous 850 px de hauteur, le contenu peut défiler : le parcours garde une hauteur utile, sans couper les contrôles. La racine a aussi été contrôlée à 1440 × 850 et 1440 × 720.

## Repères et montants

Le classement utilise les metadata : repère défini, ajustabilité, montant projeté, clé stable. Les postes fixes sont dans une vue secondaire « À suivre » ; leurs repères restent accessibles sans réduction comportementale inventée.

Les contrôles ±5 % et leurs raccourcis produisent uniquement un draft local de montant en euros. Les targets, l’objectif global et les cagnottes gardent leur **persistance absolue existante**, avec validation serveur. La saisie exacte reste disponible sur demande. La jauge présente réalisé, projection et repère sans calculer un forecast.

Pour les ajustements, LOWER/HIGHER conservent leur signification existante à ±20 %. Les autres pourcentages passent par le contrat CUSTOM existant, avec un reste absolu. Le read-model serveur publie la référence habituelle via les propriétaires actuels `deriveMonthScenario` et `projectMonthDecision` ; React n’inverse pas la projection modifiée. NONE retire l’assumption, sans effacer réalisé ou projets explicites.

Les projections sont arrondies à l’euro ; faits exacts, réservations sauvegardées et saisies précises gardent les centimes.

## Simulation

Le parcours est catégorie → option → résultat. Une option personnalisée ouvre stratégie → pourcentage ou montant. Les capacités viennent du domaine partagé existant. L’occurrence restaurant, ses réductions 50/100 %, les réductions en montant, les cagnottes ajustables et les deux choix cumulés restent accessibles.

Le résultat met le gain publié par le serveur en premier, puis la fin de mois estimée et la référence. Les détails sont deux écrans séparés : trois lignes, puis les autres repères. L’explication de l’estimation est également séparée. Aucun grand tableau ni formule avec flèche n’est imposé dans le résultat principal.

Chaque changement rejoue le moteur serveur ; deux cibles au maximum. Les protections, plafonds, planchers irréversibles, Preview sans écriture, Apply atomique et digest anti-stale restent sous leurs propriétaires existants. La modification conserve les valeurs locales du choix ; le retour depuis une cagnotte simulée rejoint directement la sélection.

## Cagnottes

Création : projet → 100/250/500/1000 € ou montant exact → protection → date facultative → confirmation. Aucun stepper relatif pour une nouvelle cagnotte à zéro.

Édition : montant relatif ±5 % ou exact → protection → date → confirmation ; renommage accessible depuis la confirmation. Suppression secondaire via Plus d’options, puis confirmation dédiée. Les cagnottes protégées restent exclues des simulations et suggestions automatiques.

## Vérification visuelle réelle

`VISUAL_ITERATIONS = 4` :

1. Première implantation et parcours des écrans.
2. Corrections de pagination, focus local, footer et état de recalcul.
3. Correction de la soumission anticipée du wizard cagnotte, puis nouveau parcours et reload.
4. Correction du retour de simulation cagnotte, conservation des valeurs lors de Modifier et retrait d’une explication technique ; nouveau smoke du simulateur.

Formats testés : **1728 × 900, 1920 × 1080, 1440 × 900**. Captures et mesures DOM dans le navigateur local existant, session authentifiée. Aucun test Vercel.

Vues mesurées aux trois formats : racine ; repères ; Courses et draft −20 % ; objectif global et draft +10 % ; étapes de simulation 1/2 ; résultat un choix ; sélection du second choix ; résultat deux choix ; détail et davantage ; estimation ; index ajustements et modes LOWER/HIGHER/CUSTOM/NONE ; index cagnottes ; création étapes 1/2/3/4 et confirmation ; date ; édition montant, draft −10 % et date ; simulation personnalisée HOW/PERCENT/AMOUNT et saisie exacte ; modification d’un scénario.

Pour chaque mesure desktop : `scrollHeight <= clientHeight + 2` sur shell, contenu et vue ; contrôles et CTA dans les limites du contenu ; aucune intersection avec un footer superposé. Les screenshots ont été inspectés, notamment racine, repère, résultat un/deux choix et confirmation cagnotte.

Le JSON [phase2-month-control-center-choices-ux-verification.json](phase2-month-control-center-choices-ux-verification.json) conserve les dimensions, noms de vues et statuts, sans données financières personnelles. Les screenshots et logs complets restent hors Git dans `ve/evidence/phase2-choices-ux-2026-10-04/`.

## Incident navigateur et restauration

Lors du premier parcours cagnotte, le dernier bouton Continuer a changé de type au cours du clic en devenant le bouton de soumission React. Cela a créé involontairement une cagnotte temporaire dans les inputs mensuels live. L’incident a été signalé à l’utilisateur pendant le travail.

La seule ligne temporaire a ensuite été supprimée ; la cagnotte initiale a été conservée. Le reload a confirmé le retour à l’état métier initial. Il y a donc eu **deux écritures live dans les inputs mensuels** (création accidentelle, suppression de restauration), et non zéro. Aucune écriture historique ni modification de schéma.

Le correctif sépare les identités React des boutons Continuer/Confirmer, fixe leurs types, annule l’action par défaut de Continuer et refuse les soumissions avant l’étape de confirmation. `CHOICES-UX-090` garde cette régression. Le wizard corrigé a été rejoué jusqu’à confirmation, sans cliquer Créer ; un nouveau reload a confirmé l’absence de création.

`BROWSER_LIVE_WRITES = INCIDENT_RESTORED`. Les sauvegardes volontaires de repères, objectif, ajustements et Apply ne sont pas déclarées testées en live dans ce lot. Leur persistance est vérifiée avec les vraies actions serveur et des owners synthétiques.

## Régression après stabilisation

| Commande | Résultat |
|---|---|
| `node scripts/check-phase2-month-control-center-choices-ux.mjs` | PASS 68/68 |
| `node scripts/check-phase2-month-control-center-human-ux.mjs` | PASS 53/53 |
| `node scripts/check-phase2-month-control-center-ux.mjs` | PASS 57/57 |
| `node scripts/check-phase2-month-control-center.mjs` | PASS 85/85 |
| `node scripts/check-phase2-category-targets-choices.mjs` | PASS 36/36 |
| `node scripts/check-phase2-savings-allocations.mjs` | PASS 21/21 |
| `node scripts/check-phase2-benefit-wallets.mjs` | PASS 36/36 |
| `node scripts/check-phase2-month-narrative.mjs` | PASS |
| `node scripts/check-phase2-october-contract.mjs` | PASS |
| `node scripts/check-phase2-planned-finance.mjs` | PASS |
| `node scripts/check-phase2-planned-reliability.mjs` | PASS |
| `node scripts/check-phase2-planned-guards.mjs` | PASS |
| `node scripts/check-phase2-project-wizard.mjs` | PASS |
| `node scripts/check-phase2-forecast-temporal-mode.mjs` | PASS 13/13 |
| `node scripts/check-phase2-temporal-forecast.mjs` | PASS 63/63 |
| `node scripts/check-global-v2-frontend.mjs` | PASS 728/728 + RuntimeSchemas 71/71 |
| `node scripts/check-architecture-imports.mjs` | PASS |
| `node scripts/check-phase2-month-decision-engine.mjs` | SAME_PREEXISTING_FAILURE |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node node_modules/next/dist/bin/next build` | PASS |

Les anciennes assertions de présentation ont été adaptées aux nouveaux libellés et écrans ; aucun oracle financier n’a été changé. La suite dédiée distingue BEHAVIOR, SSR et STATIC. Un test statique n’est pas présenté comme une interaction navigateur.

L’échec V1 est toujours `asOf excludes future history as well as future actuals`, déjà documenté au baseline dans les rapports précédents. Les assertions suivantes de cette suite ne sont pas déclarées PASS ; le moteur n’est pas corrigé dans ce lot.

## Périmètre et limites

- `MIGRATION_REQUIRED = NO`. Aucun fichier de migration ajouté ; aucun moteur financier, wallet ou mobilité modifié.
- FULL_MONTH_SAFE et AS_OF_TEMPORAL : replay, Preview/Apply/reload, protections et zero-write historique passent sur fixtures synthétiques.
- Les états persistés peuplés, les targets enregistrés et leurs retours après save ont des preuves SSR/actions/reload synthétiques ; le navigateur a parcouru les drafts et l’index live disponible. Cela ne constitue pas une certification de tous les saves live.
- Des avertissements Next Image préexistants sur les dimensions de logos et des messages Fast Refresh pendant les itérations ont été observés ; aucune erreur console dans les parcours finaux.
- Petites hauteurs : fallback accessible prévu ; pas de refonte responsive mobile demandée.
- Hors périmètre : Mobility detail, AS_OF détaillé, Probable ce mois-ci, Contextual Forecast Effects, recalibrage low/high, import/rebuild.

Livraison : commit consolidé unique sur `main`, avec push. Le hash de livraison est fourni dans la réponse finale.
