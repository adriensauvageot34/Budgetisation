# Composer R6 P0 — direction artistique

Date : 8 octobre 2026. Périmètre : présentation locale du Composer, sans changement des owners métier.

## Point de départ

Le dépôt GitHub `adriensauvageot34/Budgetisation` était sur `main`, propre, au commit `8067d7624ed169a1c271f661f94cc171d0c8ed5f`. Le HEAD `03f42b80f73f9f3f424e3fcf2805183935c29dc2` annoncé par la mission ne figurait pas sur ce `main` ; aucun reset n'a été effectué. Les documents de préflight R6 cités dans la mission n'étaient pas dans cette version distante. Le brief UI/UX joint et le mockup fourni ont été lus et comparés au rendu.

La livraison P0 et P1/P2 est réunie dans le commit R6 contenant ce rapport. Une copie de travail isolée au HEAD initial, avec seulement les fichiers P0, a servi à exécuter et capturer le checkpoint P0 avant la couche de présentation.

## Implantation P0

- `planner-icons/icon-registry.ts` devient l'unique registre terminal des silhouettes. `PlannerIcon` conserve les `iconKey` publiés ; `visual-identity.ts` ne retire que le préfixe de portée `PERSON:<id>:` pour les exceptions visuelles stables. Aucun label visible ni prénom ne pilote le choix.
- Le Café au travail conserve son `iconKey` métier `meal` et reçoit une tasse uniquement par `targetRef`/`capabilityRef` stable. Cire, mascara, eyeliner et les besoins de mobilité ont aussi des silhouettes distinctes. L'icône mobilité montre un trajet sans affirmer un mode de transport. Le fallback `ActivityIcon` reste réservé aux clés inconnues.
- Clay V2 renforce les couleurs, les volumes et les ombres de contact pour Courses, Coiffeur, Tabac/vape, Soirée, Week-end, Beauté, Restaurant, Cadeau et Saving. Les nouvelles silhouettes Café, Cire, Mascara, Eyeliner, Livraison et Fast-food utilisent le même cadre. Les définitions SVG ne comprennent que les matières utilisées par l'icône, avec des identifiants `useId` uniques.
- `ComposerCard` conserve ses handlers et sémantiques SIMPLE/HABIT/SAVINGS, UNKNOWN, PRESERVED, DERIVED et locked. L'illustration passe à 76 px sur carte ; le montant, le titre, la référence et les actions secondaires gagnent une hiérarchie plus claire. L'épargne ajustable reste ajustable : la tirelire n'impose pas un état verrouillé.
- La Library conserve ses 145 assets et ses capacités de recherche, navigation clavier, clic et drag. Les mini-cartes, la typographie et les fonds sont plus lisibles. Les tailles Clay sont cohérentes entre Library, Board, satellites et palette.
- Les styles sont locaux à `composer.module.css`. Ni `globals.css`, ni les DTO, ni les fichiers `src/server`, `src/domain` ou `supabase` n'ont changé.

## Captures et comparaison

Le checkpoint P0 exécuté sur la fixture `visualMonth` est visible à [1728×900](images/composer-r6/board-p0-1728x900.png), [1920×1080](images/composer-r6/board-p0-1920x1080.png) et [1440×900](images/composer-r6/board-p0-1440x900.png). Il s'agit du vrai Composer R5 avec la seule passe visuelle P0, pas d'un montage. La [capture P1/P2 à 1728×900](images/composer-r6/board-1728x900.png) montre le résultat ultérieur.

Face au mockup, les silhouettes Courses, Café, Coiffeur, Tabac, Soirée, Week-end, Cadeau et Saving se différencient sans leurs textes. P0 conserve volontairement la grille R5, les orbites et leurs sockets ; la présence Clay et les surfaces progressent, mais les objets restent dispersés avant P1/P2. Les illustrations SVG restent moins volumétriques que celles du mockup. Les labels de certains Contexts demeurent petits dans P0.

## Vérification et frontières

La fixture complète conserve 145 assets Library. Le smoke final a vérifié recherche, navigation fléchée, Compare, Undo/Redo, palette Soirée et démarrage du drag natif. Le build Next.js, TypeScript, les contrôles Contexts, Mobility, Planned Reality, Composer, Atomic UI et Visual Fidelity passent. `check:phase2-planner-kernel` échoue sur une assertion où le test attend un objet `forecast` et reçoit une `Promise` ; la même erreur est reproduite dans le worktree P0 isolé, sans modification des fichiers serveur. Le test n'est donc pas présenté comme PASS.

La structure SVG reste contenue : 756 gradients mesurés dans la fixture P0 à 1728×900, avec 145 assets. Aucun nouveau fetch ou owner financier n'a été introduit. Les captures finales et l'audit des écarts P1/P2 sont dans le [rapport R6 P1/P2](composer-r6-p1-p2-presentation-2026-10-08.md).

```ini
R6_P0_STATUS = PARTIAL
BRANCH = main
HEAD_BEFORE = 8067d7624ed169a1c271f661f94cc171d0c8ed5f
HEAD_AFTER = commit contenant ce rapport
UI_FINANCIAL_RECOMPUTATION = NO
DTO_CHANGED = NO
SERVER_OR_SUPABASE_CHANGED = NO
LIBRARY_ASSETS = 145
VISUAL_FIDELITY_TO_TARGET = PARTIAL
KERNEL_CHECK = FAIL_BASELINE_ASYNC_FORECAST_ASSERTION
P0_CAPTURE = images/composer-r6/board-p0-1728x900.png
NEXT = R6 P1/P2, livré dans le même commit
```
