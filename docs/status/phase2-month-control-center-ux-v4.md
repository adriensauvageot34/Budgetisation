# Centre de contrôle V4 — livraison

Date : 5 octobre 2026. Branche : `main`.

```ini
HEAD_BEFORE = 4f8133334035b3cd6db1f9cac209ae867b94b093
HEAD_AFTER = d21e8d864aee3f7edd5e917b002b0bd29c892a32
MIGRATION_REQUIRED = NO
INFO_ICON_FIXED = PASS
CONTEXTUAL_HEADER = PASS
BIDIRECTIONAL_PILOTING = PASS
ZERO_BASE_PRESETS = PASS
IMPLICIT_SIMULATION = PASS
MULTI_POST_INTEGRATED = PASS
SAVINGS_EDITOR_SIMPLIFIED = PASS
BANK_BALANCE_CARD_VISIBLE = PASS
BANK_BALANCE_NOT_COUNTED_AS_RESOURCE = PASS
BANK_DOUBLE_COUNT_GUARD = PASS
POST_APPLY_BASELINE_REFRESH = PASS_SYNTHETIC
ZERO_VERTICAL_SCROLL = PASS
HISTORY_LOW_MEDIAN_HIGH = OUT_OF_SCOPE
TYPECHECK = PASS
BUILD = PASS
TARGETED_TESTS = PASS
BROWSER_FLOW = PARTIAL
BROWSER_READ_ONLY = PASS
BROWSER_FINANCIAL_WRITES = NOT_TESTED
LIVE_FINANCIAL_WRITES = 0
```

HEAD_AFTER identifie le commit de code testé. Le commit documentaire suivant ajoute ce rapport sans modifier le code exécuté.

Mois bas / Médiane / Mois haut n’ont pas été modifiés dans ce chantier ; leur doctrine et leur disponibilité font l’objet d’un audit parallèle.

## Mini-audit ciblé et owners réutilisés

| Sujet | Owner conservé | Intervention V4 |
| --- | --- | --- |
| Overlay, navigation, header, refresh | `month-control-center.tsx`, `OverlayFrame`, `month-control-focus.tsx` | Composition du header centralisée, orchestration du brouillon existant |
| Intentions, parseur, limite de deux postes | `month-choice-contract.ts`, `month-control-contract.ts` | Montant testé et provenance locale du preset ; aucune nouvelle persistence |
| P, R, F, capacités de catégorie | `month-category-controls.ts`, `categoryDecisionFacts` | Plancher réutilisé, sans duplication du calcul |
| H et presets publiés | `projectMonthControlCenter` | Montants des raccourcis calculés et filtrés sur le serveur |
| Simulation, impact, application | `simulateMonthChoice`, `deriveMonthScenario`, actions existantes | Conversion de l’intention en hypothèse CUSTOM puis replay complet |
| Cible, hypothèse appliquée, digest | `MonthDecisionSettings`, `monthChoiceDigest`, inputs mensuels | Contrats existants conservés ; preview périmée refusée |
| Solde bancaire daté | `bankCash.currentRealBankBalance`, `scenario.availableNow` | Carte de stock distincte des ressources économiques |
| Cagnottes | `SavingsAllocation`, `declaredOutflows`, replay mensuel | Éditeur de réservation direct ; protections et refus serveur |
| Dimensions, footer, icônes | CSS du Centre, `LocalChoiceScreen`, Lucide | Bande compacte, icône Info SVG dans une cible carrée 46×46 |

Le total des ressources reste `plan.economicResources`. La carte Banque ne participe à aucun total React. FULL_MONTH_SAFE et AS_OF_TEMPORAL conservent leurs owners et leurs oracles.

## Décisions UX et code modifié

- `month-pilot-editor.tsx` remplace l’ancien éditeur intégré à `month-control-workspace.tsx` : une seule valeur T, édition directe, validation du plancher publié, simulation implicite, actions selon l’état.
- `month-control-workspace.tsx` conserve les trois zones et la grille ; les cartes rendent P→T et « Dans le scénario ». L’accès autonome « Simuler plusieurs ajustements » disparaît.
- `month-control-simulator.tsx` réutilise le contrat existant pour le deuxième poste et le résumé. Une catégorie choisie ou modifiée ouvre le même éditeur V4 ; la limite reste deux.
- `month-control-center.tsx` applique la politique de header, préserve la séquence des requêtes, invalide les previews et remet l’éditeur à la nouvelle baseline après application. Le message d’application accepte les impacts négatifs.
- `month-control-contract.ts` expose la composition explicite du header. Objectif et Information restent dans les vues globales pertinentes.
- `month-choice-contract.ts`, `month-choices.ts`, `month-control-center.ts` serveur étendent les intentions avec TEST_AMOUNT et TEST_SAVINGS. Les conséquences restent celles du replay existant. Le pourcentage se rebase sur P ; le montant absolu reste absolu.
- `month-saving-editor.tsx` remplace le parcours d’édition d’une cagnotte ajustable. Saisie directe, −20/−50, Libérer tout, aperçu serveur, suppression explicite avec confirmation. Libérer tout conserve l’identité de la cagnotte à montant zéro.
- `month-choice-editors.tsx` conserve le parcours de création et la vue protégée ; l’édition ajustable est déléguée au nouvel éditeur.
- `actions.ts` refuse les modifications/suppressions de cagnottes protégées et vérifie le digest fourni avant sauvegarde. Les écritures passent toujours par l’owner mensuel existant.
- `month-preview-status.tsx` retarde le statut discret de 200 ms. L’aperçu cagnotte est lié à son montant et au digest courant : aucun ancien impact après reset ou édition.
- `bank-stock-card.tsx`, `month-story.tsx`, `month-forecast-view.tsx` donnent une place visible au stock, avec date humaine et modification. L’état inconnu affiche une demande de saisie, jamais un faux zéro ; la carte existe aussi quand le mois est incomplet.
- `month-control-center.module.css` ajoute uniquement les dimensions et styles ordinateur nécessaires.
- `package.json` et `check-phase2-month-control-center-v4.mjs` exposent la nouvelle certification ciblée.
- Les suites UX existantes suivent le déplacement de composant, les nouveaux libellés et les refus de modification des cagnottes protégées. Aucun oracle financier n’a été assoupli.

## Tests exécutés

Commandes : `node scripts/<nom>.mjs`, avec une clé synthétique de test pour les suites qui exercent le reçu Undo chiffré. Les actions financières utilisent exclusivement le harness en mémoire.

| Suite | Résultat |
| --- | --- |
| `check-phase2-month-control-center-v4` | 52/52 PASS : HDR, INFO, PILOT, MULTI, APPLY, SAVE-UX, BANK-UX, ASYNC, HIST, origines et parity |
| `check-phase2-month-control-center` | 85/85 PASS |
| `check-phase2-month-control-center-spatial-ux` | 78/78 PASS |
| `check-phase2-month-control-center-human-ux` | 53/53 PASS |
| `check-phase2-month-control-center-choices-ux` | 68/68 PASS |
| `check-phase2-month-control-center-ux` | 57/57 PASS |
| `check-phase2-category-targets-choices` | 36/36 PASS |
| `check-phase2-savings-allocations` | 21/21 PASS |
| `check-phase2-benefit-wallets` | 36/36 PASS |
| `check-phase2-month-narrative` | PASS |
| `check-phase2-october-contract` | PASS |
| `check-phase2-planned-finance` | PASS |
| `check-phase2-planned-reliability` | PASS |
| `check-phase2-planned-guards` | PASS, probes de zero-write historiques sur mocks |
| `check-phase2-temporal-forecast` | 63/63 PASS |
| `check-phase2-forecast-temporal-mode` | 13/13 PASS |
| `check-global-v2-frontend` avec `--experimental-strip-types` | 728/728 PASS ; RuntimeSchemas 71/71 PASS |
| `check-architecture-imports` | PASS, 775 fichiers |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `node node_modules/next/dist/bin/next build` | PASS |
| `git diff --check` | PASS |

Les nouvelles fixtures couvrent explicitement P=0/H=87 pour Restaurants, 447→403 après Apply, origine −10 % rebasée 460→414, saisie absolue conservée, hausse de réservation, libération totale sans suppression implicite, refus stale et Preview/Save/reload. Les tests ne touchent aucun foyer réel.

## Parcours navigateur et dimensions

Navigateur réellement disponible : contrôle CUA de l’application locale Next.js, connecté à son backend existant. Aucune installation de suite supplémentaire.

Parcours vérifiés sans sauvegarde : accueil, Information, pilotage, catégories, hausse +5 %, réduction −5 %, saisie exacte du deuxième poste, résumé global, retour grille conservant P→T, abandon du scénario, cagnottes, réduction de réservation et dépenses inchangées, ouverture puis annulation de la confirmation de suppression, Mettre à jour, état Confirmés, édition Banque et carte Banque principale.

Information : un SVG, cible 46×46, fond transparent, line-height 0, nom accessible. Aucun objectif global dans les catégories, cagnottes, états, mises à jour ou Banque. Console d’erreurs : vide lors du contrôle final.

28 mesures DOM couvrent sept états : cagnotte neutre, active, confirmation, résultat, Banque, catégorie neutre et résultat. Dimensions : 1728×780, 1440×760, 1920×900, 1920×1080. Pour chaque mesure : hauteur de scroll égale à la hauteur disponible, aucun overflow interne identifié et aucun bouton dépassant le cadre. Aucun masquage d’overflow n’a été ajouté. Override de viewport restauré après les mesures.

Les captures contenant des valeurs personnelles restent hors Git dans `C:/Users/Manon/Documents/Codex/2026-09-28/ve/evidence/control-v4/`, avec les logs et `desktop-measures.json`.

## Limites et échecs préexistants

- Les dernières actions de sauvegarde/suppression du navigateur sur le foyer réel sont NOT_TESTED conformément au brief V4. Elles ne sont pas assimilées à PASS. Leur validation serveur, persistence et reload sont PASS sur données synthétiques.
- Deux délais de contrôle navigateur ont été dépassés pendant compilation/recalcul local ; la session a été reprise, puis les parcours ont été vérifiés. Pas d’erreur console dans la vérification finale.
- Une ancienne assertion statique CC-056 recherchait une juxtaposition de setters absente déjà dans `4f81333` ; cette absence a été prouvée avec `git show`. L’assertion vérifie maintenant les resets et le refresh sans imposer leur juxtaposition textuelle. Les autres assertions modifiées correspondent aux changements UX V4 demandés.
- Aucun blocker automatique restant. L’audit parallèle bas/médiane/haut reste hors scope. Pas de migration, d’écriture historique, de nouvelle table ou de nouvelle persistence.
