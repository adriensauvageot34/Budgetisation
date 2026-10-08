# Composer R6 P1/P2 — présentation et composition visuelle

Date : 8 octobre 2026. Base GitHub : `main` à `8067d7624ed169a1c271f661f94cc171d0c8ed5f`. Le commit R6 contenant ce rapport porte P0, P1 et P2 ; aucun contrat DTO/API, calcul financier, owner serveur ou migration n'a été modifié.

## Architecture P1

`presentation/adapter.ts` transforme le `ComposerUiModel` existant en nœuds locaux au navigateur : contrôles simples, Contexts et VisualClusters. `node-types.ts` porte l'identité d'origine, la taille de présentation, l'icône et les enfants d'un cluster. `cluster-rules.ts` choisit les familles par `templateKey`, `iconKey` et références stables publiées ; ni le titre affiché ni une nouvelle catégorie métier n'interviennent. Le modèle source n'est pas muté. `inventory-layout.ts` reçoit ces nœuds, conserve la pagination R5 et sait retrouver la page d'un enfant via son cluster. Les positions et les tailles ne sont jamais ajoutées à `semanticState` ou aux commandes serveur.

Le rendu de chaque enfant dans la fenêtre du cluster réutilise `ComposerCard` ou `ContextCard`, et donc ses capabilities, actions, états inconnus et handlers. Une édition ouvre l'éditeur existant ; la palette d'un Context du cluster et la zone de retrait apparaissent dans la fenêtre, où elles restent accessibles malgré le dialogue modal. L'épargne continue de passer par `ComposerCard` et ne reçoit pas un faux verrouillage.

## Composition P2 et règles de regroupement

La mosaïque déterministe place d'abord Courses, Café au travail, Coiffeur, Tabac/vape et Saving, puis Soirée, Week-end et Beauté, puis Restauration, Cadeau et Visite famille. Cadeau et Visite famille utilisent une empreinte de présentation plus compacte. Les autres objets restent sur les pages suivantes ; aucune coordonnée libre ou persistée n'est créée.

| Famille | Règle | Fixture `visualMonth` | Fallback |
|---|---|---:|---|
| BEAUTY | Context `beauty-restock`, besoins cosmétiques/cire publiés, renouvellements beauté et `iconKey=beauty` | 5 enfants | Moins de 3 : cartes d'origine |
| FOOD | Contexts `restaurant`/`fast-food`/`delivery`, repas travail par référence stable et icônes alimentaires | 5 enfants | Moins de 3 : cartes d'origine |

Le Café au travail est explicitement exclu de FOOD pour conserver sa carte tasse indépendante. Chaque racine apparaît exactement une fois : 25 références d'origine produisent 17 surfaces de premier niveau, dont deux clusters, puis les 25 références se retrouvent à l'ouverture des clusters. Les enfants restent des objets indépendants ; un retrait ou un changement recalculera la projection, et le cluster se dissout automatiquement sous trois enfants.

`amount` vaut `null` pour les deux clusters. Les sources mêlent montants, occurrences et inconnus ; un total local serait trompeur ou pourrait compter deux fois. Le nombre d'enfants et la fenêtre détaillée sont affichés à la place. Le HUD et les montants individuels restent ceux du serveur.

## Captures réelles de fixture

| Checkpoint | 1920×1080 | 1728×900 | 1440×900 |
|---|---|---|---|
| P0 avant P1/P2 | [capture](images/composer-r6/board-p0-1920x1080.png) | [capture](images/composer-r6/board-p0-1728x900.png) | [capture](images/composer-r6/board-p0-1440x900.png) |
| P1/P2 | [capture](images/composer-r6/board-1920x1080.png) | [capture](images/composer-r6/board-1728x900.png) | [capture](images/composer-r6/board-1440x900.png) |

Autres états : [Beauté ouverte](images/composer-r6/cluster-beauty.png), [Restauration ouverte](images/composer-r6/cluster-food.png), [Soirée sélectionnée avec palette](images/composer-r6/soiree-selected-palette.png), [fixture sans clusters](images/composer-r6/board-without-clusters.png) et [données incomplètes](images/composer-r6/incomplete-data.png). Les captures viennent du Composer exécuté dans le host synthétique du dépôt. Le [résultat du smoke visuel](images/composer-r6/browser-verification.json) confirme deux clusters, 11 surfaces sur la première page à 1728×900, 9 à 1440×900, et aucun débordement ni erreur navigateur.

La comparaison avec le mockup est meilleure sur la structure : les onze repères principaux sont simultanément visibles sur la première page à 1728×900, les deux capsules se distinguent des Contexts orbitaux, et les proportions varient. Les SVG restent plus plats que les sculptures de référence. Les clusters ne montrent pas de montant agrégé, par choix de fidélité aux données. Sur la capture sélectionnée à 1728×900, le dock R5 recouvre une partie de la troisième rangée ; sa refonte relève de P3. Les sockets vides et la palette R5 restent également plus visibles que dans le mockup. Ces écarts empêchent une certification visuelle complète.

## Vérifications

- PASS : `npm run build` (Next 16.2.6, compilation, TypeScript et pages).
- PASS : `check:phase2-planner-contexts`, `check:phase2-planner-mobility`, `check:phase2-planned-reality`, `check:phase2-planner-composer`, `check:phase2-planner-atomic-ui`, `check:phase2-planner-visual-fidelity` et `check:composer-r6-presentation`.
- PASS : projection déterministe, aucune mutation du DTO, 25 racines retrouvées exactement une fois, zéro total financier côté React, aucun write serveur dans le test ciblé, et fallback sans cluster sur la fixture clairsemée.
- PASS navigateur : 145 assets Library, recherche, navigation clavier, Compare entrée/sortie, Undo/Redo, sélection Soirée et palette, drag natif démarré ; fenêtres Beauté/Restauration ouvertes, édition d'un enfant Beauté et palette d'un Context enfant accessibles.
- FAIL préexistant : `check:phase2-planner-kernel` attend un objet `forecast` mais reçoit une `Promise` à `scripts/check-phase2-planner-kernel.mjs:183`. La même erreur se reproduit dans le worktree P0 isolé ; aucun owner concerné n'a changé dans R6.

Les assertions R5 qui attendaient « Budget à préciser » dans le seul HTML de la première page ont été adaptées : un objet UNKNOWN regroupé reste dans les références du cluster, puis apparaît dans sa fenêtre. L'invariant métier UNKNOWN et le reste des tests financiers n'ont pas été affaiblis.

## Checkpoint

Les critères de composition A–D et G/H progressent nettement ; la préservation des objets, des interactions testées et des montants serveur est vérifiée. Les écarts de densité avec le dock ouvert, la sculpture Clay et les sockets restants demandent P3/P4. L'application réelle authentifiée et un parcours Apply distant n'ont pas été exercés ; seules les fixtures synthétiques et le build ont été utilisés.

```ini
R6_P1_P2_STATUS = PARTIAL
UI_FINANCIAL_RECOMPUTATION = NO
DTO_CHANGED = NO
SERVER_OR_SUPABASE_CHANGED = NO
SOURCE_ROOTS = 25
PROJECTED_ROOT_REFERENCES = 25
PRESENTATION_SURFACES = 17
BEAUTY_CHILDREN = 5
FOOD_CHILDREN = 5
CLUSTER_AMOUNT = unavailable_without_financial_authority
BROWSER_VISUAL_SMOKE = PASS
BROWSER_INTERACTION_SMOKE = PASS
KERNEL_CHECK = FAIL_BASELINE_ASYNC_FORECAST_ASSERTION
P3_P4 = NOT_STARTED
```
