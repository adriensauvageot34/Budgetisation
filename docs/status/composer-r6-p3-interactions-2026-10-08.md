# Composer R6-P3 — objets mères et interactions

Date : 8 octobre 2026. Dépôt : `Budgetisation`, branche `main`, départ `a7d31c7bda705d338f69e1de0507b5085068a981`, arbre propre au départ. P0, P1 et P2 étaient présents. Les anciens checkpoints `3490114…` et `03f42b8…` sont absents de ce clone ; la mission P3 demande de poursuivre sans les restaurer. Aucun correctif métier ou Kernel n'est inclus.

## Audit visuel préalable

Avant la modification, la fixture `VISUAL` a été exécutée et examinée à 1920×1080, 1728×900 et 1440×900, puis avec Soirée sélectionnée et les fenêtres Beauté et Restauration ouvertes. Comparaison avec le mockup joint et le brief R6 :

| Sujet | Classe avant P3 | Constat et suite |
|---|---|---|
| Cartes simples, tailles | A_ALREADY_GOOD | Choses autonomes lisibles ; la hauteur est ensuite ajustée pour réserver la place du dock. |
| Soirée, proportions | B_FIX_IN_P3 | 340×255 px, identité Clay déjà présente, mais trois sockets vides brouillent le noyau ; cible finale 340×235 px. |
| Week-end, proportions | B_FIX_IN_P3 | 340×255 px, montagnes distinctes, mais cinq sockets vides ; cible finale 340×235 px. |
| Context vs Cluster | A_ALREADY_GOOD | Noyau avec orbites contre capsule avec miniatures ; types P1 corrects. |
| Beauté | A_ALREADY_GOOD | Capsule, enfants indépendants et overlay corrects. |
| Restauration | A_ALREADY_GOOD | Même famille de capsule avec teinte propre ; cinq enfants indépendants. |
| Saving | A_ALREADY_GOOD | Surface verte et traitement spécifique, sans assimilation automatique à « protégé ». |
| Densité du board | B_FIX_IN_P3 | Onze surfaces clés visibles à 1728×900 au repos, mais dock ouvert sur la troisième rangée. |
| Clay | C_DEFER_TO_P4 | Icônes et halos en place ; rendu moins volumétrique que la référence. |
| Bordures | A_ALREADY_GOOD | Distinction des états et familles présente. |
| Sockets | B_FIX_IN_P3 | Trois vides au repos sur Soirée, cinq sur Week-end ; réduction impérative. |
| Satellites | B_FIX_IN_P3 | Équipés visibles, mais trop petits et fiche trop administrative. |
| Palette | B_FIX_IN_P3 | Catalogue complet mais présentation en barre technique. |
| Dock inférieur | B_FIX_IN_P3 | Haut à 733 px à 1728×900, recouvrait les objets du bas. |
| Overlaps | B_FIX_IN_P3 | Recouvrement dock/rangée basse en sélection. |
| Clipping | A_ALREADY_GOOD | Pas de débordement global aux trois tailles ; pagination à 1440. |
| Rythme vertical | B_FIX_IN_P3 | Réservation du dock et ajustement des hauteurs nécessaires. |
| Rythme horizontal | C_DEFER_TO_P4 | Composition de référence lisible, mais gravité spatiale et packing final à polir. |

**D_P1_P2_BLOCKING_DEFECT : aucun.** Aucune correction P1/P2 préalable n'a été nécessaire. Les captures P1/P2 de référence restent dans `docs/status/images/composer-r6/`; l'audit préalable détaillé et ses mesures sont conservés dans le dossier de travail local `work/r6-p3-audit/` de cette session.

## Anatomy et données publiées

Soirée reste un `CompositeContextNode` unique : boule à facettes et halo au centre, titre, satellites équipés autour, puis jusqu'à deux capacités vides visibles à la sélection. Week-end suit la même grammaire d'objet mère avec montagnes et sa palette propre ; aucune taxonomie de Soirée ne lui est imposée. Beauté et Restauration restent des `VisualClusterNode`, capsules de plusieurs objets autonomes sans sockets orbitaux ni commande de cluster. Courses et les autres cartes simples restent des objets autonomes. Saving conserve sa silhouette spéciale.

`context-satellite.tsx` est une primitive de présentation. Elle lit les `selectionId`, `iconKey`, états, identités, montants et actions publiés ; elle ne crée ni entité domaine ni calcul. Les états choisi, suggéré, dérivé et à préciser ont des indices compacts. Le popover donne d'abord le nom, l'état intelligible, le montant ou son indisponibilité, puis l'action principale. Retrait, rattachement, contexte enfant et détails publiés restent accessibles dans « Autres actions et détails ». L'ouverture d'une fiche ne déclenche aucune écriture et le focus revient au satellite à la fermeture.

`presentation/socket-visibility.ts` pilote uniquement l'affichage des sockets vides : **REST = 0**, **SELECTED = au plus 2**, **DRAGGING = destinations publiées compatibles**. Les sockets équipés ne sont pas filtrés. Le choix SELECTED est déterministe, par `templateKey` et `slotKey` ; à priorité égale, tri lexicographique. Pour Soirée : `food`, `return`, `extras`, `before`, `main`, `outbound`. Pour Week-end : `purchases`, `restaurants`, `activities`, `transport`, `groceries`, `lodging`. Cette priorité est visuelle ; l'intégralité des capacités demeure dans la palette, y compris au clavier.

`presentation/palette-groups.ts` rassemble les **options publiées** par clés de slots. Soirée : Avant, Moment, Repas, Aller / retour, Compléments. Week-end : Hébergement, Courses, Repas, Activités, Achats, Transport. Un slot inconnu garde son propre groupe ; aucune option distincte n'est fusionnée selon son libellé. Le dock est une ceinture horizontale de mini cartes de 124 px, avec icône, nom, état et défilement. L'icône du contexte et « Équiper · … » identifient la palette. À 1728×900, le board se termine à 750 px et le dock commence à 762 px : les cartes basses restent visibles.

## Gestes et commandes

Le système HTML5 natif, `ComposerInteractionContext`, `preparedDrop`, `publishedDrop`, `resolveComposerDrop`, la preview serveur, `selectionId` et `sourceSocket` sont conservés. Aucune bibliothèque DnD n'est ajoutée. Les cibles compatibles se révèlent pendant le geste ; l'indication magnétique utilise les capacités publiées. La corbeille est absente au repos et apparaît seulement pendant un drag autorisant raisonnablement un retrait. Le drop protégé affiche « Protégée » et ne produit aucune requête d'écriture. Le statut Saving ne suffit pas à activer cette protection.

Parcours vérifiés dans le navigateur synthétique :

- Équipement par drag depuis la palette vers Soirée : `DROP` → `PATCH_CONTEXT` sur `food`.
- Remplacement de Taxi/Uber par l'option Voiture réellement publiée : `DROP` → `PATCH_CONTEXT` ; l'ancien choix retourne au catalogue.
- Déplacement du satellite Taxi de `outbound` à `return` : une seule commande `DROP` → `PATCH_CONTEXT`, `sourceSocket.selectionId = uber` conservé. Aucune conversion en deux gestes ajout/retrait.
- Retrait d'un satellite : `CLEAR_SOCKET` → `PATCH_CONTEXT`.
- Retrait d'un enfant de Beauté : `DROP` sur `TRASH` → `REMOVE_CONTEXT` de l'enfant. La fixture à trois enfants se dissout après ce seul changement : deux objets Beauty indépendants redeviennent top-level, sans `DELETE_CLUSTER` ni mutation métier supplémentaire.
- Refus protégé : corbeille « Protégée », zéro write. Les gestes de sélection/désélection et l'ouverture de la palette n'émettent pas de requête.

Le drag d'un enfant depuis l'overlay modal a été vérifié avec des événements HTML5 `DragEvent` dispatchés dans Chrome, puis avec l'alternative click sur la vraie commande enfant. Le déplacement physique de souris automatisé depuis un `<dialog>` modal se bloque dans ce couple Chrome headless / Playwright ; il n'est donc pas certifié par ce smoke. Les drags souris palette, satellite entre slots et satellite vers corbeille ont été exécutés physiquement. Le code garde les handlers HTML5 natifs dans l'overlay et la cible de corbeille à l'intérieur du dialogue.

Les actions critiques ont une route click ou clavier : choix de palette, ajout/remplacement, retrait, acceptation, rattachement, ouverture de l'enfant, sélection et fermeture. Les mini cartes et fiches sont des contrôles nommés ; le conteneur horizontal accepte les flèches ; le focus est restauré après popover et overlay, avec retour vers un enfant survivant si un cluster se dissout. Les animations locales conservent `prefers-reduced-motion` ; le polish de spatial memory reste pour P4.

## Vérification

Tests exécutés sur la branche modifiée :

| Gate | Résultat |
|---|---|
| `npm.cmd run typecheck` et `npm.cmd run build` | PASS |
| `check:composer-r6-p3` | PASS, 14 assertions ciblées (001–010, 012–014, 016) |
| `check:composer-r6-presentation` | PASS |
| `check:phase2-planner-contexts` | PASS, 29 groupes |
| `check:phase2-planner-mobility` | PASS, 37 groupes |
| `check:phase2-planned-reality` | PASS |
| `check:phase2-planner-composer` | PASS, 35 groupes |
| `scripts/check-phase2-planner-interactions.mjs` | PASS, 22 groupes |
| `check:phase2-planner-visual-fidelity` | PASS |
| `check:phase2-planner-atomic-ui` | PASS, 14 groupes ; seule l'attente textuelle R5 « Retenu : À préciser » a été migrée vers « Montant non disponible » dans la nouvelle fiche |
| `check:phase2-planner-final-polish` | PASS |
| `check:phase2-planner-kernel` | `KNOWN_BASELINE_FAILURE_STALE_FORECAST_ORACLE` : assertion profonde compare un Forecast résolu à une Promise ; échec connu et explicitement exclu de P3 |

Les assertions 011, 015, 017 et 018 sont couvertes par le smoke navigateur, les gardes R5 existants et l'inspection structurelle : refus protégé sans write ; alternatives clavier et focus ; zéro requête lors de la sélection et du masquage des sockets ; l'algorithme de preview stale existant n'a pas été modifié. Le navigateur a également validé Undo, Redo, Compare entrée/sortie, les deux clusters, les trois tailles demandées et l'absence d'erreur de page. Apply/reload n'est pas certifiable sur `VISUAL` : le contrat de projection C7 n'y publie pas `COMPLETE/READY`. Le scénario `uiContract=ready` est explicitement un contrat de présentation qui refuse toute application. Aucun faux Apply n'a été effectué.

Vérification structurelle courte : aucun nouveau `readWorld`, `fetch` par satellite/socket, provider DnD, owner serveur ou calcul financier React. La palette complète n'est montée que pour le contexte sélectionné ; les sockets vides cachés ne montent plus de boutons/popovers. Les overlays sont conditionnels. Le DOM n'a pas été chiffré avant/après ; la réduction vérifiable est de **3 → 0** sockets vides Soirée et **5 → 0** Week-end au repos, puis **2** au maximum à la sélection. Aucune multiplication structurelle de popovers/listeners n'a été introduite.

## Captures réelles après P3

Les PNG viennent du Composer réel compilé dans l'hôte synthétique du dépôt. Le journal JSON des assertions navigateur est [`browser-verification.json`](images/composer-r6-p3/browser-verification.json).

| État | Capture |
|---|---|
| Board 1728×900 au repos | [board-rest-1728x900.png](images/composer-r6-p3/board-rest-1728x900.png) |
| Board 1920×1080 | [board-1920x1080.png](images/composer-r6-p3/board-1920x1080.png) |
| Board 1440×900 | [board-1440x900.png](images/composer-r6-p3/board-1440x900.png) |
| Soirée au repos, sélectionnée, palette, satellites | [repos](images/composer-r6-p3/soiree-rest.png), [sélection](images/composer-r6-p3/soiree-selected.png), [palette](images/composer-r6-p3/soiree-equipment-palette.png), [satellites](images/composer-r6-p3/soiree-equipped-satellites.png) |
| Drag compatible, corbeille, refus protégé | [cible](images/composer-r6-p3/drag-compatible-target.png), [corbeille](images/composer-r6-p3/drag-trash.png), [refus](images/composer-r6-p3/protected-trash-refusal.png) |
| Fiche satellite, Week-end sélectionné | [fiche](images/composer-r6-p3/satellite-popover.png), [Week-end](images/composer-r6-p3/weekend-selected.png) |
| Beauté et Restauration ouvertes | [Beauté](images/composer-r6-p3/cluster-beauty-open-after-p3.png), [Restauration](images/composer-r6-p3/cluster-food-open-after-p3.png) |
| Retrait enfant et dissolution | [corbeille de l'overlay](images/composer-r6-p3/cluster-child-trash.png), [deux enfants autonomes](images/composer-r6-p3/cluster-beauty-dissolved.png) |

Lecture « trois secondes » de la capture principale : Soirée sélectionnée a le contour violet et un noyau central entouré de composants ; Week-end a des montagnes et la même logique de composition ; Beauté et Restauration ont des capsules avec miniatures ; Saving est vert et réservé ; la ceinture « Équiper · Soirée » indique où agir. Les objets enfants des clusters ne sont pas exposés comme cartes autonomes dans cette page tant que le cluster existe.

## Restes pour R6-P4

Les sculptures SVG sont moins volumétriques que le mockup, surtout à 1440 px. Le rythme et la gravité spatiale demandent un polish global. Après dissolution, les deux enfants réapparaissent sur la page calculée par le carousel ; ce changement de page est fonctionnel mais la continuité spatiale est perfectible. HUD, Compare, responsive mobile, algorithme de packing global et préchargement restent hors P3. La validation manuelle d'un drag souris depuis un overlay modal reste souhaitable dans l'audit UX suivant.

```ini
R6_P3_STATUS = PASS
HEAD_BEFORE = a7d31c7bda705d338f69e1de0507b5085068a981
WORKTREE_CLEAN_AT_START = YES
PRE_P3_VISUAL_AUDIT_DONE = YES
P1_P2_BLOCKING_DEFECTS_FOUND = 0
P1_P2_CORRECTIONS_REQUIRED = NO
BUSINESS_CODE_CHANGED = NO
SERVER_OWNER_CHANGED = NO
DTO_CHANGED = NO
DB_MIGRATION_CREATED = NO
UI_FINANCIAL_RECOMPUTATION = NO
COMPOSITE_CONTEXT_PARENT_METAPHOR = PASS
SOIREE_REST_EMPTY_SOCKETS = 0
SOIREE_SELECTED_EMPTY_SOCKETS = 2
WEEKEND_REST_EMPTY_SOCKETS = 0
WEEKEND_SELECTED_EMPTY_SOCKETS = 2
SATELLITE_COMPONENT_EXTRACTED = YES
SOCKET_VISIBILITY_LAYER_CREATED = YES
SOIREE_PALETTE_REDESIGNED = YES
WEEKEND_PALETTE_REDESIGNED = YES
NATIVE_DND_PRESERVED = YES
NEW_DND_LIBRARY = NO
REPLACE_FLOW = PASS
TRASH_CONTEXTUAL = PASS
PROTECTED_DROP_REFUSAL = PASS
SATELLITE_POPOVER = PASS
KEYBOARD_ALTERNATIVES = PASS
BEAUTY_CLUSTER_PRESERVED = YES
FOOD_CLUSTER_PRESERVED = YES
CONTEXT_CLUSTER_VISUAL_DISTINCTION = PASS
PLANNER_KERNEL = KNOWN_BASELINE_FAILURE_STALE_FORECAST_ORACLE
PLANNER_CONTEXTS = PASS
PLANNER_MOBILITY = PASS
PLANNED_REALITY = PASS
PLANNER_COMPOSER = PASS
PLANNER_INTERACTIONS = PASS
VISUAL_FIDELITY = PASS
R6_PRESENTATION = PASS
ATOMIC_UI = PASS
FINAL_POLISH_EXISTING = PASS
BUILD = PASS
BROWSER_SMOKE = PASS_WITH_MODAL_POINTER_AUTOMATION_LIMIT
NEW_SERVER_CALLS = 0
NEW_READWORLD_CALLS = 0
STRUCTURAL_DOM_REGRESSION = NO
SCREENSHOTS = docs/status/images/composer-r6-p3/
DOC_FILE = docs/status/composer-r6-p3-interactions-2026-10-08.md
NEXT_RECOMMENDED_STEP = CHATGPT_R6_P3_UX_AUDIT
```
