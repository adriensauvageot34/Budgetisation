# Composer V3 — P03, interaction immédiate et Preview sûre

**Date :** 9 octobre 2026. **Point de départ vérifié :** HEAD `43c2cc51b13ad539ecc43184507b78b3417c1ee9`, descendant de P01 `29367d4a5177f982a71f8fa9bdf9f651af8ca412`, worktree propre. Branche de travail `codex/composer-v3-p03-interaction`. **Mandat :** P03 uniquement, sans migration ni écriture hors Planner.

## Statuts de départ et décisions

L'utilisateur a fixé `G1_CONTRACT_FIXTURE = EXECUTED_PASS`, `P02 = ACCEPTED_WITH_RESERVATIONS`, `P02_AUTHENTICATED_E2E = NOT_RUN`, `E0_REAL_AUTHENTICATED = NOT_RUN`. DEC-09 et DEC-10 sont validées : panneau latéral par défaut, modal complexe, popover atomique ; fermeture du panneau sans Apply, Undo/Redo conservé. DEC-01 demeure S2 exploratoire séparé d'une décision retenue. Aucun autre arbitrage secondaire n'est déduit de cette autorisation.

## Trajet ACTION → Draft → finance constaté

Avant P03, `ComposerShell.run()` attendait `handleComposerRequest()` avant d'installer la carte, l'historique et la projection. Le service lit le modèle initial, résout la capacité et la mutation, appelle `readMonthComposer()` à nouveau si l'état change, puis publie le modèle. `readMonthComposer()` garde le Compiler et Finance V2 comme propriétaire financier ; le service effectue deux `readWorld` pour `DROP` et `EDIT_CONTEXT` dans la fixture mesurée.

Après P03, l'ajout d'un Context racine admis par une capacité publiée crée immédiatement un UUID et un objet dans le Draft local. `visualDraftModel()` place la carte sur le Board sans calculer montant ou projection ; le panneau de configuration s'ouvre immédiatement. Les éditeurs usuels sont latéraux, les Contexts complexes restent en modal. Une édition de montant `SET_STATE`, une édition des champs de Context et le retrait simple d'un Context peuvent aussi mettre à jour le Draft local. L'ordonnanceur coalesce ces versions et envoie `READ` au service existant ; il n'effectue aucun calcul financier et ne modifie aucun owner. Les gestes de survol des cibles de drag n'envoient plus de requête financière. Les survols d'un préréglage qui portent une **mutation hypothétique** restent une exploration S2 : le HUD indique « Hypothèse », avec un digest distinct ; seul `ACCEPT` explicite retient une suggestion.

Le scheduler associe chaque requête au digest du Draft, au mois, à la version de preuve World connue (`baselineDigest`, révision active) et à une séquence. Il ignore les réponses tardives, les digests discordants et les réponses d'une version d'autorité devenue obsolète. États exposés : `PENDING`, `FRESH`, `STALE`, `FAILED`, `BLOCKED`. Pendant `PENDING/STALE/FAILED`, le HUD masque les montants et les détails financiers ; Apply est désactivé. Une erreur laisse le Draft local et l'historique en place. Apply garde sa relecture et son contrôle de preuve serveur distincts. Aucune table snapshot, aucun cache global, aucun deuxième moteur financier.

**Portée précise de l'immédiateté :** Context racine via Library ou DROP sur Board, `SET_STATE` d'un contrôle, édition de champs et retrait simple. L'équipement d'un socket, le rattachement d'un enfant et les opérations de graphe restent résolus par les capacités et mutations serveur existantes ; leur interaction visuelle détaillée n'est pas certifiée ici. L'éditeur d'un Context ajouté peut être fermé sans appliquer le mois ; ses changements déjà soumis restent dans le Draft mémoire. Le Draft durable serveur est réservé à P07 et à la validation technique séparée du schéma/RLS.

## Mesures avant / après

Même script `work/p01_fixture_timing.mjs`, même checkout et fixture PGlite synthétique, 12 échantillons par opération, `readWorld` local fixe, Windows Node 22.18.0 ; exécutions séparées et donc bruit possibles. Fichiers de preuve hors dépôt dans `work/p03-test-logs/before-server-fixture.json` et `after-server-fixture.json`.

| Mesure serveur fixture | Avant P03 | Après P03 | Lecture |
|---|---:|---:|---|
| `READ` chaud, médiane | 17,64 ms | 17,77 ms | 1 `readWorld` |
| `DROP` serveur, médiane | 46,86 ms | 45,86 ms | 2 `readWorld` |
| `EDIT_CONTEXT` serveur, médiane | 60,15 ms | 58,12 ms | 2 `readWorld` |
| GET distants / écritures distantes | 0 / 0 | 0 / 0 | Fixture isolée |

Le nouveau trajet de l'UI envoie un `READ` coalescé après la mutation locale ; ce tableau mesure les opérations serveur historiques, **pas** la latence du nouveau trajet complet. DROP→carte visible, ouverture→panneau interactif, édition→Preview, GET réseau et P95 navigateur avant/après : **NOT_RUN**. La mesure navigateur P01 n'est pas substituée à une mesure P03 comparable. Aucun SLA P95 n'est adopté. `E0_REAL_AUTHENTICATED = NOT_RUN` et reste requis avant P14/P15.

Le script distinct `scripts/measure-composer-p03-fixture.mjs` mesure le nouveau trajet **Node, sans DOM** sur 12 échantillons : ajout local + projection de vue médiane 0,26 ms, puis `READ` de Preview médian 30,30 ms et 1 `readWorld` ; contrôle Courses local 0,20 ms, puis `READ` médian 29,38 ms et 1 `readWorld`. Ce sont des temps de calcul synthétiques, pas DROP→peinture ni panneau interactif. Les séries historiques `DROP/EDIT_CONTEXT` et la série nouvelle `READ` n'ont pas le même périmètre et ne servent pas à annoncer un gain UX certifié.

## Vérifications exécutées

| Vérification | Résultat et limite |
|---|---|
| `node scripts/check-composer-p03-interaction.mjs` | **EXECUTED_PASS**, 12 contrôles : carte locale avec ID stable sans lecture World, aller-retour Compiler/digest, retrait et Undo sémantique, 300→350→330, parité du digest et de la Preview avec `MUTATE`, réponses hors ordre, suppression/Undo pendant lecture, panne serveur, World changé, coalescing, digest erroné. PGlite synthétique ; 0 écriture distante/DB. Le test vérifie la vue rendue statiquement et le scheduler, pas un vrai geste navigateur. |
| `node scripts/measure-composer-p03-fixture.mjs` | **EXECUTED_PASS**, 12 ajouts et 12 montants, `READ` serveur réel sur World/PGlite synthétiques ; aucune mesure de rendu ou d'authentification. |
| R6 P3/P3.5/P4/P4.5 et présentation | **EXECUTED_PASS** : 14 + 14 + 20 + 30 contrôles et projection de clusters. Exercices de contrats et rendus statiques ; aucune capture aux trois viewports P03. |
| C8 Composer, P02 conservation, R3 interactions | **EXECUTED_PASS** : 35 + 8 + 22 contrôles. C8 inclut sa fixture Apply/Reload PGlite, sans certification authentifiée. |
| Parité historique | **EXECUTED_PASS**, 22 cas × 9 hashes. |
| TypeScript et imports | **EXECUTED_PASS** : `tsc --noEmit` et 900 fichiers d'architecture. |
| Build Next | **PARTIAL** : compilation Turbopack réussie ; échec ultérieur `spawn EPERM` pendant `Running TypeScript`. Le build complet ne porte pas un statut PASS. La configuration temporaire `turbopack.root` a été retirée. |
| Navigateur synthétique / A11Y / 3 viewports | **NOT_RUN** : le binaire esbuild du serveur fixture échoue sur `spawn EPERM`. La demande d'exécution hors sandbox a été rejetée par la revue automatique à cause de la limite d'usage, sans décision sur la sûreté ; aucun contournement n'a été tenté. |
| E2E authentifié et performance réelle | **NOT_RUN** : aucune donnée personnelle ni mutation distante. |

## Risques et verdict G2

Le Board immédiat, le panneau et son focus clavier ne sont pas encore mesurés dans un navigateur avec le code P03. Les équipements, clusters, navigation et protections passent les suites de contrats R6, mais leurs interactions visuelles à trois tailles et leur accessibilité restent à vérifier. La sélection S2 exploratoire est balisée ; la confirmation groupée d'Apply relève du durcissement Apply ultérieur. Le nouveau Draft est seulement en mémoire et n'est pas une reprise durable. Une saisie locale non admissible peut rester visible avec état `FAILED`, sans devenir applicable ; l'utilisateur peut la corriger, et Apply reste fermé.

**Verdict :** `G2_P03_CONTRACT_FIXTURE = EXECUTED_PASS` ; `G2_P03_BROWSER = NOT_RUN` ; `G2_P03_REAL_AUTHENTICATED = NOT_RUN` ; `G2_P03 = PARTIAL_NOT_CERTIFIED`. `P03 = IMPLEMENTED_FOR_REVIEW_WITH_RESERVATIONS`, sans affirmation de certification finale. Les mesures navigateur comparables, tests de gestes/A11Y à trois viewports et build complet doivent être repris dès que l'exécution du serveur fixture est disponible. **STOP après P03** : aucun P04, aucune migration, aucun chantier Plan→Réel.
