# Composer — R6 implementation preflight — 7 octobre 2026

Audit architectural au HEAD 3490114c4f2914cd97e1d0cb2e44d0a1c208c4a7. Livrable documentaire uniquement. Les chemins sont relatifs à la racine du dépôt ; les liens partent de ce document. Les fichiers annoncés comme **à créer** sont des propositions pour une mission ultérieure : ils n'existent pas et ne sont pas créés par ce préflight.

## 1. Executive summary

**R6_PREFLIGHT_STATUS = PASS. R6_STARTED = NO.** Le Composer est une route serveur authentifiée qui publie un ComposerUiModel, puis un client orchestrant les commandes existantes. Son board est un carousel à packing dérivé ; ses objets utilisent ComposerCard ou ContextCard, et un seul registre SVG terminal PlannerIcon. Satellites, sockets et leurs détails sont actuellement imbriqués dans ContextSocket et AtomicPopover. Le HUD est ComposerCockpit ; Compare est un état temporaire de ComposerShell, avec finishComparison.

La refonte peut rester une transformation de présentation : **ComposerUiModel → adaptateur UI pur → quatre types de nodes → composants spécialisés**, sans nouvelle projection, table, commande métier ou coordonnées persistées. Beauté et Restauration sont faisables en regroupant des références stables d'objets existants. Un compteur de membres est possible ; sommer leurs montants comme une nouvelle vérité financière ne l'est pas : enveloppes, consommations explicites, enfants et valeurs inconnues ne sont pas tous additifs.

Les principales contraintes sont la conservation du drag natif et de ses identités, la protection réelle du Saving, les pages et popovers déjà montés, et la stabilité du focus lors d'une naissance/dissolution de cluster. La fixture VISUAL contient 25 objets top-level, 8 Contexts dont 2 enfants et 145 assets Library. Soirée a actuellement 3 satellites et 3 sockets vides ; Week-end, 5 et 3. La cible future est zéro socket vide au repos et au maximum 1–2 sockets utiles en sélection.

Les quatre guards métier requis et trois baselines Composer passent dans cette mission. Aucune certification navigateur, campagne de performance, extraction ou modification UI n'a été effectuée. Le brief utilisateur R6 est la cible textuelle. Aucun mockup TARGET indépendant ni brief R6 dédié n'a été trouvé dans le dépôt ; le rapport R5 signalait déjà cette absence. Cela ne bloque pas ce plan d'exécution, mais interdit de déclarer une fidélité visuelle à une image absente.

## 2. Git state

~~~ini
REPO_ROOT = C:/Users/Manon/Documents/Codex/2026-09-28/ve/work/Budgetisation
BRANCH = main
EXPECTED_HEAD = 3490114c4f2914cd97e1d0cb2e44d0a1c208c4a7
ACTUAL_HEAD = 3490114c4f2914cd97e1d0cb2e44d0a1c208c4a7
HEAD_AUDITED = 3490114c4f2914cd97e1d0cb2e44d0a1c208c4a7
WORKTREE_CLEAN_AT_START = YES
PREEXISTING_CHANGES = NONE
PREEXISTING_CHANGES_PRESERVED = YES
PRODUCT_CODE_CHANGED = NO
UI_CODE_CHANGED = NO
TEST_CODE_CHANGED = NO
DB_MIGRATION_CREATED = NO
R6_STARTED = NO
~~~

Contrôles initiaux : git rev-parse --show-toplevel, git branch --show-current, git rev-parse HEAD, git status --short et diff/index vides. Aucun reset, checkout, changement de branche ou push. Le seul fichier destiné au commit est ce document, avec le message **docs(composer): add R6 implementation preflight**. Le hash du commit documentaire est fourni par le compte rendu final et retrouvable via git log : il n'est pas inscrit dans son propre contenu.

## 3. Documents audited

| Document / source | Autorité et enseignement utilisé |
|---|---|
| [AGENTS.md](../../AGENTS.md), [SOURCE_OF_TRUTH](../specs/SOURCE_OF_TRUTH.md) | V2, owners existants, finance serveur, pas de données bancaires personnelles ni de reset local Supabase. |
| [Spécification transversale verrouillée](planning-transverse-product-spec-2026-10-07.md) | Contrats intention/filiation/coût/funding/UNKNOWN ; VisualCluster présentation seule ; futurs lots T0–T7 distincts de R6. Ses constats de tests historiques ne remplacent pas la recertification courante. |
| [C8 Composer](planner-c8-composer-2026-10-06.md) | Transport, capacités, Apply/reload, annulation et vraie UI. |
| [C4 Contexts](planner-c4-contexts-2026-10-06.md) | Slots, cardinalités, composants/enfants, compilation sous l'owner existant. |
| [R1](planner-ui-r1-spatial-clay-2026-10-06.md), [R2](planner-ui-r2-atomic-grammar-2026-10-06.md) | Clay, grammaire atomique, absence de cockpit latéral permanent. |
| [R3](planner-ui-r3-gamified-interactions-2026-10-06.md), [R4](planner-ui-r4-final-polish-2026-10-06.md) | Drag/hover, Compare, focus, pagination, réduit-motion. |
| [R5 visual fidelity lock](planner-ui-r5-visual-fidelity-lock-2026-10-06.md) | Fixture VISUAL, packing, gates desktop ; TARGET non fourni, certification d'image non acquise. |
| [Checkpoint performance fermé](planner-composer-performance-checkpoint-2026-10-07.md), [P2-D](planner-composer-performance-p2d-2026-10-07.md), [P2-C2](planner-composer-performance-p2c2-2026-10-07.md) | Respecter orchestration Forecast et fieldsets/batching ; pas de réouverture du chantier performance. |
| [Builder Clay](phase2-builder-clay-2026-10-03.md), [tokens Composer](../../src/app/mois-a-venir/composer/planner-icons/DESIGN_TOKENS.md) | Distinguer illustrations WebP du Builder et objets SVG du Composer. |
| Mission R6_PREFLIGHT fournie le 7 octobre 2026 | Cible normative Simple/Context/Cluster/Saving, phases P0–P4, audit seulement. |

Recherche par noms et contenus Composer, R6, mockup, presentation, Clay, VisualCluster, planner et performance. Aucun document dédié R6 ni image TARGET n'est référencé comme disponible. Aucune direction artistique nouvelle n'est arbitrée dans cet audit. Les détails géométriques définitifs devront être comparés à la référence lorsqu'elle sera disponible ; OQ-01 est enregistrée en §40.

## 4. Current Composer architecture

~~~mermaid
flowchart TD
  Route[ComposerPage /mois-a-venir/composer] --> Auth[withProductAuthentication puis authorizedPlanner]
  Auth --> Read[readMonthComposer / readPlannerDraft]
  Facts[Canonical et owners V2] --> World[createPlannerDependencies / readWorld]
  World --> Baseline[PlanningBaseline dérivé + PlanRevision active]
  Baseline --> Compiler[compileSemanticPlan]
  Compiler --> Financial[deriveCompiledMonthScenario puis deriveMonthScenario]
  Financial --> Projection[buildPlanProjection]
  Projection --> Read
  Read --> DTO[composerUiModel sans preview interne]
  DTO --> Shell[ComposerShell]
  Shell --> Library[ComposerLibrary]
  Shell --> HUD[ComposerCockpit]
  Shell --> Board[ComposerBoard / BoardCarousel]
  Board --> Cards[ComposerCard / ContextCard / ContextSocket]
  Shell --> Action[composerInteraction / handleComposerRequest]
  Action --> Read
  Action --> Apply[applyPlanScenario : CAS + RPC + read reload]
~~~

Le nom conceptuel PlanningWorldAdapter correspond ici à createPlannerDependencies et aux baseline adapters ; il n'existe pas un composant React portant ce nom. ComposerUiModel contient une projection métier et des métadonnées de présentation déjà préparées au serveur. Le client conserve un brouillon sémantique pour demander des évaluations, pas pour les calculer. L'Apply ne devient pas un éditeur de PlannedExpense ou de Canonical.

## 5. Entrypoints

Chaque ligne donne FILE, SYMBOL, ROLE, SERVER_OR_CLIENT, INPUT, OUTPUT, STATE_OWNER, BUSINESS_DEPENDENCIES et R6_IMPACT. Impact = besoin probable de toucher la présentation, pas autorisation de modifier un owner.

| File / Symbol | Role ; Server or client | Input → Output | State owner ; business dependencies | R6 impact |
|---|---|---|---|---|
| [page.tsx](../../src/app/mois-a-venir/composer/page.tsx), ComposerPage | Route, force-dynamic ; SERVER | searchParams.month YYYY-MM ou mois UTC courant → Shell(initialModel, transport) | Pas d'état client ; auth, cutover, readMonthComposer, composerUiModel | NONE |
| [runtime.ts](../../src/server/phase2/planner/runtime.ts), authorizedPlanner | Scope/auth/dependencies ; SERVER | session vérifiée → deps + contexte foyer | Auth serveur ; CanonicalRepository, client authentifié | NONE |
| [world-reader.ts](../../src/server/phase2/planner/world-reader.ts), createPlannerDependencies | Loader effectif ; SERVER | Canonical + client + clock → readWorld/prepareWorld/repository | Owners V2 ; Forecast et sources indépendantes | NONE |
| [draft-reader.ts](../../src/server/phase2/planner/draft-reader.ts), readPlannerDraft | Charge world + Plan actif, valide et évalue ; SERVER | household/month/raw draft éventuel → preview + état | PlanRevision/CAS, prepareWorld, evaluatePlanScenario | NONE |
| [read-model.ts](../../src/server/phase2/planner/read-model.ts), readMonthComposer | Board, catalogue, capacités ; SERVER | deps/scope/draft → MonthComposerReadModel | Compiler et registre de Contexts ; aucun nouveau owner UI | LOW, conserver |
| [composer-service.ts](../../src/server/phase2/planner/composer-service.ts), composerUiModel | Réduction/presentation du DTO ; SERVER | read model → ComposerUiModel, proof/editors/presentation | Read model existant ; enlève le preview interne et relit la révision active | LOW, conserver |
| [composer-shell.tsx](../../src/app/mois-a-venir/composer/composer-shell.tsx), ComposerShell | Orchestrateur principal ; CLIENT | initialModel + ComposerTransport → UI et demandes | Model/current, sélection, history, hover, dialogue, Compare ; contrat existant | HIGH |
| [interactions.tsx](../../src/app/mois-a-venir/composer/interactions.tsx), ComposerInteractionContext / useDragHandle | Provider/hooks locaux ; CLIENT | sources/callbacks publiés → handles natifs et interactions | Shell ; aucune requête ni finance dans le hook | MEDIUM |
| [draft-controller.ts](../../src/app/mois-a-venir/composer/draft-controller.ts), ComposerResponseGate | Rejette réponses obsolètes ; UI PURE | sequence/sourceDigest/réponse/currentDigest → accepte/refuse | Compteur local de gate ; aucun owner financier | NONE |
| [actions.ts](../../src/app/mois-a-venir/composer/actions.ts), composerInteraction | Server action ; SERVER | ComposerRequest → ComposerResponse | Auth à chaque appel ; handleComposerRequest ; revalidatePath seulement après Apply | NONE |
| [composer-service.ts](../../src/server/phase2/planner/composer-service.ts), handleComposerRequest | READ/MUTATE/DROP/CLEAR_SOCKET/EDIT_CONTEXT/PRESERVE/SUGGESTIONS/ACCEPT/APPLY ; SERVER | request + deps/household → modèle/erreur + impact serveur éventuel | Relit world/capacités ; mutations validées et Apply owner | NONE |
| [preview.ts](../../src/server/phase2/planner/preview.ts), evaluatePlanScenario ; [apply.ts](../../src/server/phase2/planner/apply.ts), previewPlanScenario | Preview ; SERVER | world/baseline/state → PlanScenarioPreview | Compiler → adapter financier → projection | NONE |
| [apply.ts](../../src/server/phase2/planner/apply.ts), applyPlanScenario ; [repository.ts](../../src/server/phase2/planner/repository.ts), createPlanApplyRepository | Apply + immediate reload ; SERVER | proof/idempotency + état → révision atomique et fresh read | Repository/RPC/CAS/recompile ; PlanRevision durable | NONE |
| Shell.run, past/future, commandes READ | Undo/Redo ; CLIENT demandant SERVER | ancien état sémantique → modèle réévalué | History locale ; pas de restauration d'une projection périmée calculée localement | MEDIUM |
| Shell.compare ; [comparison.ts](../../src/app/mois-a-venir/composer/comparison.ts), finishComparison | Variante temporaire ; CLIENT | snapshot A + brouillon B → restore A ou conserver B dans draft | Shell ; projection de B toujours serveur | MEDIUM |
| [src/app/layout.tsx](../../src/app/layout.tsx), [AppShell](../../src/components/layout/app-shell.tsx) | Providers et framing ; SERVER + CLIENT | route/children → ProductRuntimeProvider, AppShell, ExplorationRuntimeHost | Runtime global, branche spécifique Composer | LOW, Composer branch seulement si nécessaire |
| [month-control-center.tsx](../../src/app/mois-a-venir/month-control-center.tsx), [month-control-workspace.tsx](../../src/app/mois-a-venir/month-control-workspace.tsx), [page mensuelle](../../src/app/mois-a-venir/page.tsx) ; [cutover.ts](../../src/server/phase2/planner/cutover.ts), composerHref/plannerComposerEnabled | Liens d'entrée et flag ; SERVER/CLIENT selon module | mois/flag → lien pilote ; flag false → notFound sur route | Pas de suppression du Plan actif si route masquée | NONE |

Hooks d'UI réels : state/ref/effect/useId, useComposerInteractions/useDragHandle et ResizeObserver du carousel. Aucun provider DnD externe. Le reload de page repart de l'auth et du Plan actif ; le reload immédiatement après Apply se fait côté service via une nouvelle lecture. La valeur initiale du client n'est pas un cache Canonical.

## 6. Board

~~~ini
FILE = src/app/mois-a-venir/composer/composer-board.tsx
COMPONENT = ComposerBoard
LAYOUT_TECHNIQUE = custom packing + carousel + flex-wrap mosaic
STATE_INPUT = model, busy, selected, focused, InteractionContext
ITEM_INPUT = inventoryItems(model), roots Context + controls sauf reservations disponibles
SELECTION_STATE = ComposerShell.selected / focusedContext
DRAG_DEPENDENCY = native DragEvent + publishedDrop + InteractionContext
STYLE_SOURCE = composer.module.css
POSITIONS_DERIVED = YES
POSITIONS_PERSISTED = NO
~~~

[inventory-layout.ts](../../src/app/mois-a-venir/composer/inventory-layout.ts) définit InventoryItem, inventoryItems, inventoryPages et inventoryPageFor. Les Contexts enfants sont exclus du top-level. L'ordre initial alterne les variantes HABIT, COMPOSITE, SIMPLE, SAVINGS en round-robin stable ; l'ordre au sein de chaque file est celui du DTO. C'est un ordre **visuel**, pas une priorité financière ou un calendrier. Les items portent leurs références de control/Context et la variante publiée, donc le board connaît leur catégorie de rendu actuelle.

Le mosaic est en **Flex wrap**. Ce n'est ni Masonry, ni une grille CSS de cartes, ni un placement absolu de cartes. Une grille CSS existe pour les orbites du Context et pour d'autres régions du shell. Le packing maison choisit des pages d'après largeur/hauteur : largeur utile plafonnée à 1330, gap 14, au plus 3 lignes, controls 154 px de haut et Contexts 218 px ; controls SIMPLE 196, HABIT 212, SAVINGS 236 ; Contexts COMPOSITE 288 et autres Contexts 212. Palette, corbeille, ghost et détails ont un positionnement overlay indépendant.

[BoardCarousel](../../src/app/mois-a-venir/composer/board-carousel.tsx) mesure le parent stable avec ResizeObserver (box −44 px de largeur, −36 de hauteur). Taille initiale SSR 1000×470 ; si plusieurs pages, retranche encore 30 px pour la pagination. Toutes les pages restent montées ; les inactives sont inert et aria-hidden. Leur translation est temporaire. inventoryPageFor remonte les parents pour retrouver la page d'un enfant. La pagination drag utilise un dwell de 600 ms.

Fixture VISUAL : **25 wrappers inventoryCell**, 19 controls + 6 Contexts racines ; 8 ContextCard rendus en comptant 2 enfants dans des popovers fermés. SSR shell complet : environ 11 153 balises ouvrantes, 60 popovers, 6 pages initiales. Ce comptage n'est pas un nombre de fibers React ni une mesure du navigateur hydraté. inventoryPages appelé directement à 1000×470 donne [8,6,7,4] ; le carousel SSR retranche la pagination et donne 6 pages. À 1300×710 et 1490×890 : [15,10] dans le packing brut, sans déduire de ces tailles une résolution écran réelle.

**Semantic gravity future** : adapter/order visuel pur avant inventoryPages, avec un fichier local presentation/layout-order.ts en P4. Regrouper les silhouettes ou rapprocher des familles, conserver sourceRef et ordre déterministe ; jamais x/y dans semanticState, DTO transport, PlanRevision ou localStorage. Différer le repacking pendant un drag natif. Une key item.id stable ne suffit pas à éviter un remount lorsqu'un item change de parent-page ou entre dans un cluster.

## 7. Cards

Les lignes ci-dessous sont approximatives, comptées physiquement : le code est dense, la taille ne mesure pas toute la complexité. Les props incluent les callbacks optionnels.

| File / Component | Lines / props approx. | Variants réelles | Classification R6 |
|---|---|---|---|
| [composer-card.tsx](../../src/app/mois-a-venir/composer/composer-card.tsx), ComposerCard | 68 / 10 | SIMPLE, HABIT, SAVINGS ; owned, derived, unknown, locked, preserved | STYLE_ONLY P0 ; SPECIALIZE / EXTRACT_LATER P1 |
| [context-card.tsx](../../src/app/mois-a-venir/composer/context-card.tsx), ContextCard | 68 / 11 | Tous les templates, parents/enfants, readOnly, preserved, COMPOSITE si >1 socket, sinon SIMPLE actuellement | SPECIALIZE P1 ; REPLACE_PRESENTATION P3 |
| [context-socket.tsx](../../src/app/mois-a-venir/composer/context-socket.tsx), ContextSocket | 56 / 12 | Satellites CHOSEN/SUGGESTED/DERIVED/UNRESOLVED, EMPTY | EXTRACT_LATER / REPLACE_PRESENTATION P3 |
| [atomic-popover.tsx](../../src/app/mois-a-venir/composer/atomic-popover.tsx), AtomicPopover | 41 / 9 | Satellite, EMPTY, utility ; popover natif | KEEP contrat interaction ; adaptation présentation P3/P4 |
| [composer-library.tsx](../../src/app/mois-a-venir/composer/composer-library.tsx), mini-cards inline | 55 / 6 | 4 kinds d'assets, provenance/selected/capability | STYLE_ONLY P0 |
| [context-palette.tsx](../../src/app/mois-a-venir/composer/context-palette.tsx), equipment mini-cards inline | 31 / 5 | AVAILABLE/EQUIPPED/SUGGESTED/ALTERNATIVE | REPLACE_PRESENTATION P3 |
| [balance-layer.tsx](../../src/app/mois-a-venir/composer/balance-layer.tsx), suggestionCard inline | 14 / 3 | Candidats serveur, empty, busy | KEEP ; STYLE_ONLY P4 |

**ComposerCard.** BUSINESS_LOGIC : lecture de capability.actions/flexibility, value, knowledge et préférences ; construction d'une déclaration SET_STATE, aucun coût calculé. PRESENTATION_LOGIC : variant, label/person chip, formatters, référence habituelle, jauge et occurrenceStack serveur. INTERACTION_LOGIC : focus, ouvrir l'éditeur, préserver, preset et montant inline avec draft local synchronisé par effect. DRAG_LOGIC : handle seulement si protectedSavings ou preserved, plus cible d'un candidat assistant ; pas de drag libre universel des controls. SOCKET_LOGIC : aucune. POPOVER_LOGIC : utilitaire/détails/références/presets montés via AtomicPopover. STYLE_LOGIC : CSS local et largeur de jauge publiée.

**ContextCard.** BUSINESS_LOGIC : lit les capabilities REMOVE_CONTEXT/PATCH_CONTEXT, parent/readOnly/preserve, dérive les destinations depuis le DTO publié ; pas de compilation. PRESENTATION_LOGIC : centre Clay, label/date éventuelle, orbites, niveau enfant ; la cardinalité du template n'est pas le futur type visuel. INTERACTION_LOGIC : focus, edit, accept/preserve/remove, menus de reparent. DRAG_LOGIC : source context-occurrence et drop magnétique seulement si une destination compatible unique ; sinon sockets explicites. SOCKET_LOGIC : distribue tous les sockets par orbit. POPOVER_LOGIC : actions et rendu récursif d'un enfant dans les détails du satellite. STYLE_LOGIC : Context 218 px, grid d'orbites 3×3 + flex groups.

**ContextSocket.** BUSINESS_LOGIC : consomme currentItems et capabilities présentées ; canAdd et cardinality n'inventent pas de compatibilité. PRESENTATION_LOGIC : icône, marqueur, libellé, amount/details serveur. INTERACTION_LOGIC : choices, accept, edit, remove, moveTargets. DRAG_LOGIC : section droppable, satellite source avec selectionId ; child utilise sa source Context, DERIVED n'est pas draggable. SOCKET_LOGIC : ajoute un EMPTY si canAdd et REPEATING ou currentItems vide. POPOVER_LOGIC : chaque satellite et EMPTY monte ses children, même fermé. STYLE_LOGIC : bulles de 38 px et états opacity/border.

**AtomicPopover.** Aucun métier/finance : trigger natif, placement DOM viewport transitoire, close/focus restore et useDragHandle ; children fonction exécutée au rendu ; role dialog et titre. **Library/palette** : mini-cards sans composant de card dédié ; utilisent PlannerIcon et les callbacks existants. **BalanceLayer** : affiche uniquement les impacts/projections des candidats serveur et déclenche ACCEPT ou drag assistant.

Synthetic n'est pas un composant : c'est la provenance des fixtures. Person-specific est une décoration du label, adjustable/fixed vient de capability, unresolved de knowledge/value/références. Les habit/saving/simple partagent aujourd'hui ComposerCard. **God component risk** : ComposerShell (≈296 lignes mais nombreux états et handlers), puis ComposerCard/ContextCard si on y ajoute les quatre nouveaux types, le cluster, le layout et tous les états. Garder les facades ; extraire un frame sans métier et spécialiser progressivement. Ne pas construire une seule card de 2 000 lignes.

## 8. Clay/icons

**CURRENT_ICON_FLOW** : registre métier / slot baseline → composerAssetIcon + composerPresentation au serveur → iconKey dans assets/objects/satellites/dragSources → PlannerIcon client → registre terminal → SVG utilisant ClayFrame → Board / Library / satellite / palette / drag ghost. Lucide rend les actions/états (recherche, verrou, undo, check, fermer), pas les objets du mois.

Fichiers : [composer-presentation.ts](../../src/server/phase2/planner/composer-presentation.ts) (aliases et métadonnées), [planner-icon.tsx](../../src/app/mois-a-venir/composer/planner-icons/planner-icon.tsx) (21 composants enregistrés + food/delivery/fast-food → MealIcon), [clay-frame.tsx](../../src/app/mois-a-venir/composer/planner-icons/clay-frame.tsx) (matériaux), et 21 SVG dans planner-icons/icons listés en §29. Toutes les surfaces utilisent la même facade PlannerIcon. Aucun asset bitmap importé par ces composants Composer.

ClayFrame : viewBox 64×64, palette ivory/pearl/violet/sage/blue/peach/gold/shadow, 8 linearGradient à 3 stops, deux ellipses de contact, identifiants uniques useId, aucun filtre SVG. Les defs partagent du **code**, mais chaque SVG possède ses propres defs DOM. Échelles actuelles CARD 52, SATELLITE 30, PALETTE 34, LIBRARY 32. PlannerIcon est memoized ; le fallback est ActivityIcon, lui-même Clay.

Fallbacks observés dans VISUAL : cire_adrien, maquillage_manon_eyeliner, mobility:FAMILY_VISIT, mobility:WORK, other et unknown ; le Café travail reçoit meal, donc pas un fallback mais une silhouette repas. Mascara/sourcils sont reconnus comme beauty. Les clés stables viennent de targetRef/templateKey/slot/optionKey ; iconKey n'est pas une clé de classification métier fiable. Les labels ne doivent pas devenir des identifiants.

Il existe une **autre** famille d'illustrations : [builder-illustrations.tsx](../../src/app/mois-a-venir/builder-illustrations.tsx), [builder-illustration-registry.json](../../src/app/mois-a-venir/builder-illustration-registry.json), [manifest Builder](../../public/planned-visuals/builder/clay/manifest.json) et [inventaire](../design/builder-clay-inventory.json). Environ 164 WebP 1200×600, indépendants du SVG Composer ; aucun import Composer vers ce système. Ce n'est pas un deuxième registre actif du Composer à fusionner sans raison.

**FUTURE_CLAY_V2_BOUNDARY** : conserver PlannerIcon et ClayFrame comme points d'entrée ; extraire le seul registre terminal vers **src/app/mois-a-venir/composer/planner-icons/icon-registry.ts**, puis enrichir ses aliases purement visuels. Remplacer l'objet privé actuel, ne pas conserver deux mappings concurrents. Conserver les iconKey existants, normaliser les clés visuelles non reconnues sans créer de catalogue métier. Les SVG existants peuvent changer de dessin en P0 ; un éventuel coffee.tsx est une silhouette de présentation, pas un nouveau besoin. Aucun changement du mapper financier/registre de templates n'est nécessaire.

## 9. Library

[ComposerLibrary](../../src/app/mois-a-venir/composer/composer-library.tsx) rend **Ajouter à mon mois**. Source : model.library.sections/searchableAssets, sectionLabels et model.presentation.dragSources. Le catalogue réel est construit par readMonthComposer, context-registry, slots et capacités de controls/réservations. R6 ne doit ni le recopier dans un tableau React, ni inventer des compatibilités à partir d'un group label.

Catégories de rendu : SOCIAL, FOOD, ACTIVITY, PURCHASE, BEAUTY, VISIT, TRAVEL, HOME, OTHER puis controls/options ; les aliases de titres comme Habitudes & cagnottes / Équipements sont visuels. Recherche locale memoized, normalisation NFD sans diacritiques, locale française ; filtration des assets déjà autorisés. La sélection assetKey vit dans Shell, query/active index dans Library. `/` focalise la recherche ; navigation roving, flèches sur deux colonnes, Home/End, Enter depuis recherche vers premier résultat.

145 mini-cards sont montées quand la recherche est vide, dans un scroll local. Click → choose : control/réservation ouvre l'éditeur existant si autorisé ; context/option ouvre les champs serveur lorsque la destination est acceptée, sinon sélection/consigne. Drag → source publiée, sans DERIVED_CONSEQUENCE ; aucun click n'écrit directement Canonical. Icon mapping identique au Board.

P0 peut changer Clay, dimensions, contraste, typographie, catégories **affichées**, bordures et anatomie des mini-cards. P1 peut consommer les mêmes métadonnées normalisées. Préserver assetKey/capabilityRef/sections/search, keyboard et callbacks ; conserver tous les assets et les quatre kinds. Pas de nouveaux catalogue, fetch par carte, serveur ou filtre de capacités.

## 10. Composite Contexts

Identité : contextOccurrenceId stable + templateKey ; parentContextOccurrenceId/childContextOccurrenceIds explicites. Le service publie fields, components, sockets.currentItems, évaluations et capabilityRefs ; composerPresentation ajoute satellites/orbits/options/dragSources. ContextCard assemble ce rendu. Le serveur reste l'autorité d'ADD/PATCH/REMOVE/ATTACH/REPARENT et de provenance.

~~~text
Soirée : 00000000-0000-4000-8000-000000000400 / night-out
├── before : Synthetic before, PERSONAL_SUGGESTION, montant null, à accepter
├── main : Synthetic main, CHOSEN, 20.00
├── outbound : Taxi / Uber, MOBILITY_INTENT CHOSEN, 14.00
├── food / return / extras : vides actuellement, options disponibles
└── capabilities : REMOVE_CONTEXT, PATCH_CONTEXT ; capacités de slots en §13

Week-end : 00000000-0000-4000-8000-000000000300 / short-stay
├── lodging : Synthetic lodging, CHOSEN, 100.00
├── groceries : Synthetic groceries, CHOSEN, 20.00
├── restaurants : enfant restaurant, CHOSEN, montant de satellite null
├── activities : enfant activity, CHOSEN, montant de satellite null
├── transport : CAR, CHOSEN, coût économique affiché 2.00
└── purchases vide ; capabilities REMOVE_CONTEXT, PATCH_CONTEXT
~~~

Les montants ci-dessus décrivent les valeurs publiées des satellites, **pas une somme du coût du parent**. L'enfant conserve ses composants et son retrait propre ; le satellite enfant n'a pas de canRemove générique CLEAR_SOCKET. Les modes de binding/enveloppe restent ceux du Compiler, même si le prix d'un satellite est connu.

chosen = décision ou child retenu ; suggested = PERSONAL_SUGGESTION, hors coût tant que non accepté ; derived = conséquence/readOnly ; unresolved = données nécessaires absentes, selon item et évaluations. Le vocabulaire de socket.visualState inclut aussi HABITUAL ; celui de satellite ne l'inclut pas. ADD/replace passe par DROP, les items non repeating sont remplacés ; remove de sélection passe par CLEAR_SOCKET/PATCH, remove Context par DROP/TRASH et normalisation sémantique. Accept convertit la provenance via les mutations serveur validées.

**COMPOSITE_CONTEXT_FROM_EXISTING_DATA = YES. MISSING_PRESENTATION_DATA = NONE pour la structure requise. BUSINESS_CHANGE_REQUIRED = NO.** Spécialiser night-out et short-stay d'après templateKey, avec détails/enfants et capacités disponibles. Aucun montant total de card parent à inventer. Un cadeau ou visite famille peut recevoir une anatomie SimpleCardNode tout en restant un Context métier sous les mêmes handlers ; le nombre actuel de sockets ne doit pas imposer son futur type visuel.

## 11. Satellites

Pas de composant standalone Satellite aujourd'hui : [ContextSocket](../../src/app/mois-a-venir/composer/context-socket.tsx) mappe presentation.satellites vers AtomicPopover. Une future extraction ContextSatellite est indiquée en P3. Position : orbit NORTH/WEST/EAST/SOUTH du serveur, grid/flex du Context ; before NORTH, main WEST, food SOUTH, outbound EAST, return/extras répartis par fallback d'index. Pas de coordonnées durablement stockées.

Icône via PlannerIcon SATELLITE, label+state dans aria-label/title ; amount/details disponibles dans le popover. CHOSEN check, SUGGESTED sparkle/dashed, DERIVED link, UNRESOLVED marqueur. Actions : accepter si canAccept, modifier si editableAssetKey, retirer si canRemove, rattacher aux moveTargets publiés ; child ouvre son Context. Hover/focus/border/opacity sont CSS, sélection/focus remonte au Context. Drag conserve selectionId/sourceSocket ; child utilise context-occurrence, derived aucun handle.

~~~ini
SOIREE_CURRENT_SATELLITES = 3
SOIREE_CURRENT_EMPTY_SOCKETS = 3
WEEKEND_CURRENT_SATELLITES = 5
WEEKEND_CURRENT_EMPTY_SOCKETS = 3
FUTURE_REST_EMPTY_SOCKETS = 0
FUTURE_SELECTED_EMPTY_USEFUL_SOCKETS_MAX = 2
~~~

Ces comptes décrivent les racines VISUAL actuelles, pas le total des descendants. Aucun socket/satellite n'a été masqué dans cette mission.

## 12. Sockets

Deux concepts doivent rester distincts : **ComponentSlotDefinition** est un vrai contrat métier (allowed options/children, cardinalité, binding). Le **bouton + EMPTY** est une projection visuelle de la capacité de choisir/ajouter. Masquer ce bouton ne supprime pas le slot ni sa capacité.

ContextSocket rend un + si presentation.canAdd et (cardinality REPEATING ou currentItems vide), sans condition de REST/SELECTED. Un slot repeating garde donc un + même déjà occupé : restaurants/activities de Week-end. Un second cas rend une entrée Placer si compatible, sans satellites, mais sans canAdd. Soirée expose food/return/extras ; Week-end restaurants/activities/purchases.

Clic : AtomicPopover puis select des presentation.options ou Rattacher la carte sélectionnée → choose/drop. Drop : target CONTEXT_SOCKET avec contextOccurrenceId/slotKey, contrôle de compatibilité publié, puis InteractionContext.place. Incompatible : pas de preventDefault acceptant, over(null), refus/absence de mutation ; serveur revérifie et refuse une demande forgée. Le corps Context magnétise seulement une destination unique, sans sélectionner arbitrairement parmi plusieurs slots.

P3 : sélecteur local de visibilité, REST aucun EMPTY, SELECTED 1–2 utiles, conserver palette complète, remplacement via détails, routes clavier et toutes les dropCapabilities. Un slot compatible peut devenir visible pendant DRAGGING ; la limite selected doit rester explicite et ne pas conduire à déclarer toutes les capacités supprimées. Définir un ordre déterministe de slots prioritaires depuis les slots existants, pas de nouvelles règles financières.

## 13. Equipment palette

~~~ini
FILE = src/app/mois-a-venir/composer/context-palette.tsx
COMPONENT = ContextPalette
SOURCE_DATA = focused Context.sockets + presentation.sockets.options + library.searchableAssets
CAPABILITY_MODEL = options publiées ; validation finale DropCapability côté serveur
GROUPING = groupe par slotKey actuel
DRAG_SOURCE = satellite existant si option/kind correspondent, sinon assetKey
CLICK_ACTION = interaction.equip(sourceKey, CONTEXT_SOCKET) ; fallback choose
EQUIPPED_STATE = option.state EQUIPPED et Check
DISABLED_STATE = busy seulement ; EQUIPPED ne signifie pas disabled
SCROLL_MODEL = horizontal local, overlay 104px, aucune place réservée fermé
~~~

Inventaire **exhaustif des options des deux Contexts représentatifs** ci-dessous. Convention : préfixe option:night-out:slot: ou option:short-stay:slot: implicite pour les optionKeys ; les template:* sont leurs assetKeys complets. Toutes les capacités de slot listées gardent leur préfixe template:slot. Les 3 745 DropCapability du DTO complet comprennent aussi toutes les combinaisons/contraintes du catalogue ; ce nombre n'est pas le nombre de boutons de palette.

| Context / slot / cardinalité | CapabilityRefs actuelles | Options et états exacts |
|---|---|---|
| night-out before / OPTIONAL_ONE | SELECT_COMPONENT, ATTACH_CHILD_CONTEXT | template:activity ALTERNATIVE ; template:friend-visit ALTERNATIVE ; before SUGGESTED |
| night-out main / REQUIRED_ONE | SELECT_COMPONENT, ATTACH_CHILD_CONTEXT | template:activity ALTERNATIVE ; main EQUIPPED |
| night-out food / OPTIONAL_ONE | SELECT_COMPONENT, ATTACH_CHILD_CONTEXT | template:delivery, template:fast-food, template:restaurant ; restaurant, fast-food, delivery : tous AVAILABLE |
| night-out outbound / OPTIONAL_ONE | SELECT_MOBILITY_INTENT | car, train, bus, free, other, unknown ALTERNATIVE ; taxi EQUIPPED |
| night-out return / OPTIONAL_ONE | SELECT_MOBILITY_INTENT | car, train, bus, taxi, free, other, unknown : tous AVAILABLE |
| night-out extras / REPEATING | SELECT_COMPONENT | extra AVAILABLE |
| short-stay lodging / REQUIRED_ONE | SELECT_COMPONENT | lodging EQUIPPED |
| short-stay groceries / OPTIONAL_ONE | SELECT_COMPONENT | groceries EQUIPPED |
| short-stay restaurants / REPEATING | SELECT_COMPONENT, ATTACH_CHILD_CONTEXT | template:restaurant EQUIPPED ; template:delivery, template:fast-food AVAILABLE ; restaurant, fast-food, delivery AVAILABLE |
| short-stay activities / REPEATING | ATTACH_CHILD_CONTEXT | template:activity EQUIPPED |
| short-stay purchases / REPEATING | ATTACH_CHILD_CONTEXT | template:beauty-restock, template:gift, template:purchase AVAILABLE |
| short-stay transport / OPTIONAL_ONE | SELECT_MOBILITY_INTENT | car EQUIPPED ; train, bus, taxi, free, other, unknown ALTERNATIVE |

Soirée : 26 boutons/options ; Week-end : 19. Par exemple capabilityRef night-out:food:ATTACH_CHILD_CONTEXT et assetKey option:night-out:food:restaurant restent distincts d'une insertion template:restaurant. Ne pas dédupliquer ces choix par label ou les convertir l'un en l'autre.

**Regroupement futur possible sans métier = YES** : Soirée AVANT→before, MOMENT→main/extras, REPAS→food, ALLER/RETOUR→outbound/return. Conserver sous-groupes/destinations si un groupe a deux slots. Week-end garde des rubriques explicites Hébergement, Courses, Repas, Activités, Achats, Transport ; forcer ses six slots dans la seule taxonomie d'une Soirée serait trompeur. Le grouping est une configuration UI, toutes les options/états/sourceKeys et handlers restent identiques.

## 14. Drag/drop

~~~ini
LIBRARY = native HTML5 Drag and Drop
PROVIDER = ComposerInteractionContext, défini dans interactions.tsx, alimenté par Shell
SENSORS = événements natifs dragstart/dragover/dragleave/drop/dragend ; aucun dnd-kit/react-dnd
DRAGGABLE = useDragHandle + handlers Library/ContextPalette/BalanceLayer
DROPPABLE = BoardCarousel, ContextCard, ContextSocket, trash, cible assistant
COLLISION = hit-testing/bubbling DOM + leftSurface + capabilities ; pas d'algorithme externe
OVERLAY = dragPreview offscreen utilisé par setDragImage ; packGhost conditionnel ; edges dwell
DROP_HANDLER = Shell.place/equip/drop puis handleComposerRequest/resolveComposerDrop
COMMAND = DROP, CLEAR_SOCKET, MUTATE/SET_STATE, ACCEPT selon source/action
PREVIEW = previewGesture serveur, voir §15
UNDO = snapshot semanticState dans Shell puis READ serveur
~~~

Payload natif application/x-planner-asset ; effectAllowed/dropEffect move. Shell génère une identity et selectionId une fois par geste ; preparedDrop copie les valeurs et **la sélection entière reste récupérée/validée au serveur**. Source existante : selectionId stable + sourceSocket. Les options/clés publishedDrop décident la compatibilité. Le serveur relit les capabilities et vérifie le sourceSocket contre dragSources ; le client ne peut étendre la palette par son DOM.

| Flux réel | Chemin et commande | Effet / limites |
|---|---|---|
| A Library → Board | Library.start → Shell.startDrag → board over → previewGesture → place → preparedDrop DROP BOARD_ZONE | Context asset : ADD_CONTEXT par résolution serveur ; control/réservation disponible : editorDropTarget ouvre l'éditeur sans mutation automatique. Un control baseline ordinaire n'est pas un nouvel objet duplicable. Click Library ouvre les champs puis DROP. |
| B Palette → Context | ContextPalette sourceKey → equip ou drag → CONTEXT_SOCKET → DROP | Non repeating : choix/remplacement ; repeating : ajout ; child template : ATTACH/REPARENT via résolution. Conserver distinction composant/template et données inconnues. |
| C Satellite existant → cible remplacement | ContextSocket useDragHandle satellite:* → preparedDrop(sourceSocket) → DROP target | Préserve selectionId, prix/funding/journey/champs ; serveur enlève la source si socket change puis patch cible. Child utilise source Context et règles de reparent. Pas de clonage silencieux ni de perte de données. |
| D Objet/composant → retrait | source.removeOperation ; trash conditionnel → Shell.place | Context : DROP TRASH → REMOVE_CONTEXT/normalisation CANCEL_CONTEXT si appliqué ; satellite : CLEAR_SOCKET → PATCH. Boutons Retirer existent comme alternative. Pas de retrait générique des controls baseline. |
| E Protected → retrait invalide | drag control:* protected/preserved → trash Protégée → reject/recoil/place refusé | Aucun preview de retrait valide, aucune écriture ni mutation. Server guards restent autorité même si requête forgée. Un Saving adjustable non protégé n'est pas rendu protégé par son futur nom. |

Assistant : BalanceLayer drag assistant:candidateId vers son targetRef exact, puis ACCEPT digest/candidate ; ce n'est pas une source équipement libre. Les contrôles de capabilities, endpoints, gates de réponse et identities sont **KEEP**. P3 adapte la forme des poignées/cibles et sépare le satellite ; n'introduit ni provider externe ni nouveau langage de mutation. Drag d'un VisualCluster entier vers finance/Context/TRASH : **NOT_IMPLEMENTED, non requis** ; ouvrir les enfants et utiliser leurs commandes existantes.

## 15. Financial preview

**UI_FINANCIAL_RECOMPUTATION = NO.** Shell.previewGesture/hover compose une commande existante avec le draft courant et attend le transport serveur ; debounce **200 ms**. ComposerResponseGate accepte seulement la dernière sequence au bon semanticStateDigest. L'invalidation à leave/end/mutation/change de sélection invalide les réponses tardives. Pas d'AbortController : la réponse peut être ignorée, mais la requête serveur déjà partie n'est pas annulée.

~~~text
geste / preset / montant inline
→ ComposerOperation + draft source + sequence
→ composerInteraction / handleComposerRequest
→ read world + mutate draft validé + evaluatePlanScenario
→ Compiler + financial-adapter + deriveMonthScenario + PlanProjection
→ ComposerResponse.model + interactionImpact calculé au serveur
→ hoverModel temporaire / HUD ; pas de commit
~~~

interactionImpact est la différence Big(after remainder − before remainder) de deux projections owner serveur, avec null préservé. hoverPending indique Calcul… sans inventer le nouveau chiffre ; le modèle autoritaire courant demeure visible en attente. Apply est désactivé pendant hover/grab/busy. Number/Intl côté UI sert au format, signe et tonalité, jamais à une recomposition des coûts. Les jauges/compteurs de bulles viennent du modèle serveur ; les pourcentages/dimensions CSS ne constituent pas une projection financière.

Aucun cache financier, total de cluster, estimation de taxi locale ou ajout automatique d'un montant inconnu n'est autorisé. Les futures extractions doivent garder gate + source digest + preview invalidate + idempotency Apply intactes.

## 16. Saving

Objet réel VISUAL : **Synthetic adjustable saving**, targetRef **savings:00000000-0000-4000-8000-000000000700**, kind SAVINGS, knowledge KNOWN, value.amount et remainingAmount **60.00**, owned true ; capability SET_SAVINGS_ALLOCATION / SAFE_FLEX. Presentation variant SAVINGS, iconKey savings, baselineAmount **100.00**, reservationGauge **60 %**, protectedSavings **false**.

Source : réservation structurelle dans PlanningBaseline/MonthInputs puis plan-slot contrôlé ; DTO board.savings + presentation.objects. Rendu actuel ComposerCard : gauge de réservation mensuelle, référence baseline, montant inline SET_STATE, éditeur compact. Funding : allocation/réservation du scénario existant, distincte d'un paiement bancaire ou solde wallet ; le domaine de financement ne change pas parce qu'une card change de silhouette. annualGoalRef éventuellement présent ne fournit pas un montant annuel objectif/atteint ; pas de jauge annuelle inventée.

Protection : actions/flexibility, protectedSavings et préférence PRESERVE restent indépendants. Protected/preserved reçoit une source control protégée pour refus de retrait ; pas de removeOperation. Le Saving adjustable alloué n'a pas de drag libre normal de retrait. Réservation adjustable à zéro non possédée : availableReservationRefs, Library seulement, drop vers Board ouvre l'éditeur ; pas de card top-level vide. Une réservation réellement locked/protected ne devient pas cette invitation Library.

**PROTECTED_SAVING_UI_PROJECTION = YES.** Mapper futur mapSavingNode dans presentation/node-mappers.ts : sélectionner card.kind SAVINGS, recopier targetRef/value/capability/protectedSavings/reservationGauge/preference, produire mode visuel ADJUSTABLE / PROTECTED / PRESERVED. Le nom ProtectedSavingNode distingue une réservation des cards de dépense ; il ne force pas LOCKED ni protectedSavings=true. BUSINESS_CHANGE_REQUIRED = NO ; données supplémentaires annuelles = hors périmètre.

## 17. HUD

[composer-cockpit.tsx](../../src/app/mois-a-venir/composer/composer-cockpit.tsx), ComposerCockpit et ComposerProjectionDetails ; header fourni par Shell. Environ 36 lignes/8 props pour le fichier HUD principal. Aucune sidebar permanente à droite.

| Chiffre | Source précise | Format / interaction |
|---|---|---|
| Fin de mois / Variante | board.cockpit.plan.economicMonthEndRemainder | hudMoney : null → — ; bouton details ; hoverModel temporaire si accepté |
| Sans changements | projection.baseline.economicMonthEndRemainder | Baseline de la projection serveur, pas total visuel des cards |
| Impact | normal projection.plan.impactOnMonthEnd ; geste interactionImpact serveur | signedMoney ; null → — ; signe/tonalité uniquement |
| Objectif | projection.goal.targetMonthEnd | Montant fourni par owner ; null conservé |
| Marge | presentation.goalMargin | Opposé du gapToGoal calculé au serveur ; pas soustraction React |
| Actuel sous un preview | model.board.cockpit.plan.economicMonthEndRemainder | Modèle canonique du draft avant le geste, pas solde bancaire réel |
| Plan actuel dans Compare | comparison.model.board.cockpit.plan.economicMonthEndRemainder | Snapshot A, distinct de Sans changements |

**HUD_DATA_FLOW** : PlanProjectionV1 + goalMargin serveur → ComposerUiModel → Shell choisit modèle normal/hover → ComposerCockpit → display.money/Intl. pending affiche Calcul… ; unknownHint aide les null. Les détails financiers restent dans le dialogue à la demande : funding, cash low point/date, mobility, unresolved, diagnostics. P4 ne change que hiérarchie, contraste et emplacement. Préserver la distinction coût économique / cash / réservation / goal et les champs null.

## 18. Compare

~~~ini
CURRENT_COMPARE_PURPOSE = essayer une variante du brouillon Composer sans Apply
INPUT_A = snapshot du ComposerUiModel courant + past + future + suggestions
INPUT_B = brouillon temporaire édité et réévalué par le serveur
OUTPUT = restore exact de A ou conservation de B dans le draft avec une entrée Undo
PROJECTION_OWNER = evaluatePlanScenario / deriveMonthScenario / buildPlanProjection
UI_STATE = ComposerShell.comparison ; historique propre de variante ; Apply masqué
FILES = composer-shell.tsx ; comparison.ts ; composer-cockpit.tsx
REUSABLE_FOR_R6 = YES
REUSABLE_FOR_FUTURE_T7_PLAN_NOW = PARTIAL
~~~

Entrée Compare : snapshot A, vide past/future de variante, suggestions null et assistant fermé. Sortie quitter : restaure modèle et history/suggestions exactement. Garder : finishComparison garde B, ajoute A à l'histoire principale seulement si le semanticStateDigest a changé, puis réinitialise future/suggestions. Rien n'est persisté pendant cette comparaison. Le header oppose Plan actuel à Variante ; baseline Sans changements reste une troisième référence financière du même scénario.

Ce n'est pas le futur T7 **Plan ↔ Maintenant** : pas de reconstruction de plan initial et coût réel courant, pas de provenance temporelle de réalisation, pas de reconciliation nominative ajoutée. Seuls le pattern d'état temporaire et les composants de comparaison sont réutilisables. P4 peut extraire composer-compare.tsx pour le header, en gardant finishComparison et l'owner serveur ; T7 reste différé.

## 19. Styling architecture

**STYLE_ARCHITECTURE** : src/app/globals.css (imports tokens/foundations/Tailwind, styles partagés) → AppShell branche Composer (main 100dvh, padding 12px 24px 20px, overflow hidden, fond #fdfcfb) → composer.module.css (≈278 lignes, scope workspace) → quelques styles dynamiques de largeur/transform/jauge/placement DOM et peintures SVG ClayFrame. Composer emploie son CSS module ; pas de classes Tailwind comme système local concurrent.

Tokens locaux : ink #252d48, muted #73788b, line #e8e6ed, violet #7b65ab, focus #9b82c1, amber #a77834. Rayons ≈15–20 px, satellites ronds, petites shadows locales, montants tabulaires, tailles de texte souvent 8–13 px. Header grid ≈80 px ; columns grid Library 284 px + board, gap 24. Le carousel clippe les pages ; plateau a un scroll local. Orbits et forms ont leurs grids, cards le flex packing.

Layers board 0, card 1, selected 2, satellite 3, ghost 4, palette 5, popover 6, trash 7, modal 8 ; les popovers/dialogs natifs utilisent aussi la top layer. Motion hover 140, focus/palette 190, snap 240, page/reparent 210, valeur 300, trash 180 ms, pagination dwell 600. Le seul media query local est prefers-reduced-motion ; aucun breakpoint viewport actuellement. Les guards R4/R5 protègent cette structure desktop et l'absence de styles mobiles introduits arbitrairement.

| Frontière | Action autorisée future |
|---|---|
| GLOBAL_DO_NOT_TOUCH | globals.css, tokens/foundations partagés, autres pages mensuelles et Builder ; éviter fuite d'un style de Composer |
| COMPOSER_LOCAL | composer.module.css, planner-icons, attributs purement visuels et anatomy de ComposerCard/Library |
| SAFE_FOR_R6_P0 | tokens locaux, dessins SVG, contrastes/tailles/border/shadow/typographie simples ; aucune state machine |
| NEEDS_EXTRACTION_LATER | cards/card-frame, styles dédiés de cluster, satellite/équipement et Compare après frontières P1–P3 |

Pas de réécriture CSS globale. Si les tokens spécifiques augmentent, créer composer-tokens.module.css seulement avec des imports explicites depuis le module Composer, pas un thème applicatif nouveau. AppShell doit rester KEEP sauf ajustement démontré limité à sa branche data-composer-app-shell en P4.

## 20. DTO/ViewModel

Contrats actifs : [composer-contract.ts](../../src/domain/phase2/planner/composer-contract.ts), [composer-ui-contract.ts](../../src/domain/phase2/planner/composer-ui-contract.ts), [projection-contract.ts](../../src/domain/phase2/planner/projection-contract.ts), [semantic-state.ts](../../src/domain/phase2/planner/semantic-state.ts). **Classement : D, mélange contrôlé de projection métier, état sémantique et view model ; pas du domaine brut Canonical.**

~~~text
ComposerUiModel = Omit<MonthComposerReadModel, preview> +
  proof (expectedActiveRevisionId/Number, expectedBaselineDigest, expectedPreviewDigest)
  appliedContextIds, editors, controlEditors, sectionLabels, presentation

MonthComposerReadModel conservé :
  version, semanticState, activeRevisionId/Number, library, board, dropCapabilities
board : baselineControls, discretionaryControls, savings, contexts, cockpit,
        diagnostics, draft(dirty, semanticStateDigest, undoCount, redoCount)
card : cardId, targetRef, label, kind, value, knowledge, capability, historicalReferences
context : contextOccurrenceId, templateKey, parents/enfants, externalIntentId,
          readOnly, fields, components, knowledge, capabilityRefs, sockets
socket : slotKey, cardinality, visualState, currentItems, evaluations, capabilityRefs
presentation : objects, sockets, dragSources, elementCount, unresolvedCount,
               goalMargin, unresolvedRefs, availableReservationRefs
~~~

ObjectPresentation : iconKey, variant SIMPLE/HABIT/COMPOSITE/SAVINGS, baseline amount/count, protectedSavings, gauges et occurrenceStack. SocketPresentation : orbit, canAdd, satellites et options/state. SatellitePresentation : selectionId, label, iconKey, état, economicAmount/costCaption/details, editableAssetKey, canRemove/canAccept, childContextOccurrenceId. DragSource : sourceKey, assetKey, selection/sourceSocket, protected, removeOperation ou editorDropTarget, pack éventuel. DropCapability : target BOARD_ZONE/CONTEXT_SOCKET/TRASH, resolution ACCEPTED/NEEDS_CHOICE/BLOCKED, action/constraint/choices/previewSupported.

Le preview interne avec baseline snapshots, canonical evidence et financial adapter entries n'arrive pas au client. Le semanticState arrive afin d'éditer un draft et fournir les commandes ; React n'en devient pas l'owner de validation. Les champs editors/choices sont serveur. Le fichier interaction-contract.ts expose des prototypes plus anciens au nom voisin ; aucun import actif détecté dans src et scripts pour ce module. La refonte doit importer les deux contrats Composer actifs ci-dessus, sans réactiver ce prototype.

## 21. Presentation boundary

~~~ini
PRESENTATION_ADAPTER_LOCATION = src/app/mois-a-venir/composer/presentation/adapter.ts
SERVER_OR_CLIENT = CLIENT_PURE, fonction sans hooks/IO/finance
INPUT_TYPE = Readonly<ComposerUiModel>
OUTPUT_TYPE = readonly ComposerPresentationNode[]
WHY = DTO déjà suffisant ; regroupements locaux ; zéro duplication serveur/financière
~~~

Le composerPresentation serveur reste en place pour ses gauges, satellites, états, prix et sourceRefs issus du Compiler ; le nouvel adaptateur s'appuie dessus, ne le remplace pas par des heuristiques financières React. Point d'appel : ComposerBoard avant inventoryItems/packing, memoized sur modèle et règles visuelles stables. Library conserve son catalogue. Les types locaux n'élargissent pas le DTO transport ni le contrat domaine.

~~~mermaid
flowchart LR
  Owner[PlanProjection + read model existants] --> DTO[ComposerUiModel inchangé]
  DTO --> Adapter[adaptateur local pur]
  Adapter --> Nodes[ComposerPresentationNode references]
  Nodes --> Render[React spécialisé]
  Render --> Commands[callbacks actuels / ComposerOperation]
  Commands --> Server[service + Compiler + financial owner]
~~~

La frontière node conserve sourceRef/targetRef/contextOccurrenceId/selectionId, capabilities et références directes de DTO. Seulement type visuel, alias icône, ordre, membres, visibility/expanded local. Aucun cost resolver, écriture, nouvelles identities économiques, x/y durable, sérialisation cluster ou preuve Apply construite ici. Toute donnée économique manquante demeure null. Si une future cible exige un total financier certifié absent, documenter séparément la dépendance à l'owner ; ne pas le fournir en additionnant les cards.

## 22. Future presentation nodes

Les noms ci-dessous décrivent des **types UI proposés**, pas de nouvelles entités domaine.

| Node | Source current / Required data | Mapper location proposé | Missing data / Business change required |
|---|---|---|---|
| SimpleCardNode | ComposerCardView + ObjectPresentation ; ou ContextView à anatomie simple. targetRef/contextId, label, icon, value/knowledge/capability, source kind explicite | presentation/node-mappers.ts, mapSimpleNode | NONE pour Courses/Café/Coiffeur/Tabac/Cadeau/Visite ; aucun montant à fabriquer. NO |
| CompositeContextNode | ContextView night-out/short-stay + socket presentations, children, fields, sources/commands | même fichier, mapCompositeContextNode | NONE pour centre/satellites/équipement ; parent total financier non requis. NO |
| VisualClusterNode | références de nodes racines reconnus, family BEAUTY/FOOD, stable visual id, member count et local expanded | presentation/cluster-rules.ts + adapter.ts en P2 | Aucun cluster actuel ; état UI à introduire. Pas de financial total natif. NO |
| ProtectedSavingNode | card.kind SAVINGS + gauge/protected/preference/capabilities/value | node-mappers.ts, mapSavingNode | NONE pour réservation mensuelle ; pas de progression annuelle disponible. NO |

node-types.ts : union discriminée, sourceRef explicite CONTROL ou CONTEXT pour les types interactifs ; id existant sauf id purement visuel visual-cluster:BEAUTY/FOOD. P1 prévoit VisualClusterNode dans le type mais **ne regroupe rien**. Cadeau/Visite restent des Contexts métier même rendus Simple ; Soirée/Week-end sont des Composite explicites, pas tout template ayant plusieurs sockets. Habit peut rester un attribut visuel d'une SimpleCardNode ; baseline/occurrenceStack et capabilities sont conservés.

## 23. VisualCluster feasibility

~~~ini
CLUSTERING_CAN_BE_PRESENTATION_ONLY = YES
BEAUTY_CLUSTER_FEASIBLE = YES
FOOD_CLUSTER_FEASIBLE = YES
CLUSTER_FINANCIAL_TOTAL_BY_UI_SUM = NO
CLUSTER_MEMBER_COUNT = presentation children.length
~~~

Reconnaissance fiable à partir des **clés exactes** des controls, leur needOccurrence.needKey si présent, et templateKey des Contexts racines. Ne pas matcher un libellé, un prénom, une icône ou une catégorie ambiguë. Les segments PERSON:<uuid> et HOUSEHOLD sont des identités de scope existantes ; le mapping conserve la référence complète.

| Famille | Références présentes et mapping proposé | Exclusions / limites |
|---|---|---|
| BEAUTY | suffixes need:maquillage_manon_mascara, need:maquillage_manon_eyeliner, need:cire_adrien ; root template beauty-restock | Coiffeur reste Simple ; ne pas aspirer un achat déjà enfant de Week-end. need:maquillage_manon_sourcils existe aussi : whitelist explicite de présentation, sans matching générique beauty icon. |
| FOOD | domains/target suffixes adrien-work-meals, manon-work-meals, restaurants, fast-food, delivery | Café travail reste Simple ; pas de déplacement du restaurant enfant de Week-end ; pas d'assets Library comptés comme objets du mois. |

La fixture possède donc les quatre exemples Beauté demandés, un besoin Sourcils additionnel identifiable, et les cinq controls Restauration demandés. La whitelist initiale proposée inclut aussi Sourcils comme membre Beauté (cinq références), affichable dans les enfants ; les quatre exemples du brief ne sont pas une fusion métier ni une liste financière exhaustive.

**Naissance BEAUTY ≥3, dissolution ≤2** : règle dérivée déterministe. FOOD : adopter pour le plan de travail la même règle ≥3/≤2, réglage de présentation documenté ici, sans business change ; un brief visuel futur peut ajuster FOOD sans toucher au métier. Zéro cluster de Saving, aucune frontière de Context parent traversée, chaque root appartient au plus à un cluster.

Amount : une carte d'enveloppe peut déjà couvrir une consommation du Context, et les valeurs unknown/derived ne sont pas des suppléments. Ni Big côté client ni Number ni une somme de displayed amounts ne devient un coût de cluster. Recommandation initiale : afficher le **nombre d'objets**, conserver les montants individuels dans l'overlay, aucun total monétaire de cluster. Le nombre de membres n'est pas un count d'occurrences restaurant ni une quantity de produit.

Accès : bouton cluster → overlay à la demande, enfants avec leurs références et handlers actuels, clavier, focus retour et chemin pour child focus quand il n'est plus top-level. Aucun enfant détruit/muté/retiré de semanticState. Spatial memory = stable visual id, ordre dérivé et dernier focus local ; pas de centroid ni localStorage. Les enfants clusterisés quittent la liste top-level **de présentation**, pas le modèle métier ; ne pas les rendre simultanément deux fois dans le board et le panneau fermé.

## 24. UI states

| État | Exists / files | Visual / semantics | Duplicated / contradiction | R6 action |
|---|---|---|---|---|
| default / REST | YES, Card/Context/CSS | Silhouette statique ; utilities souvent opacity 0 | Sockets vides encore visibles ; controls/state vocab différents | P0 anatomy ; P3 zéro EMPTY |
| hover | YES, CSS + Shell/Card | Lift/utilities ; presets déclenchent preview serveur | Hover purement CSS et hover financier ont deux rôles | Séparer tokens et signal preview, pas fusion métier |
| selected | YES, Shell/Board/Context/CSS | focusedContext, border, palette | selected assetKey ≠ focused card id ; pas un état métier | Conserver deux identités, P3 limiter sockets |
| chosen | YES, Socket/Card/Palette | check, owned, EQUIPPED | CHOSEN satellite / chosen control / EQUIPPED option : niveaux différents | Mapper vocab visuel cohérent sans changer provenance |
| suggested | YES, Socket/Palette/BalanceLayer | dashed, sparkle, opacity ; Hors coût à accepter | Suggestion personnelle satellite et candidat financier distincts | Garder distinction et expliciter actions |
| derived | YES, Card/Context/Socket | lien/readOnly ; pas drag DERIVED | control non-owned affiché derived n'implique pas source économique identique | Ne pas déduire finance depuis couleur/state |
| unresolved | YES, knowledge/unresolvedRefs/CSS/HUD | À préciser, marqueur amber, null | EMPTY slot facultatif et coût UNKNOWN ne sont pas équivalents | P3 visibilité sans cacher résolution accessible |
| protected / preserved | YES, Card/Context/Shell | verrou/pin, retrait refusé | Préférence PRESERVE ≠ protectedSavings ≠ fixed baseline | P1 mode Saving fidèle ; P3 refus |
| dragging | YES, interactions/Shell/CSS | grabbed/sourceKey, drag image, ghost, trash | Sources enfant et satellite utilisent clés différentes | KEEP identities et DOM source |
| drop-target | YES, Board/Context/Socket | data-compatible/data-drag-over/magnetic label | Compatibilité du socket ≠ celle du corps si plusieurs destinations | P3 conserver destinations explicites |
| disabled | YES, busy/capability/CSS | disabled natif, opacity .48 | EQUIPPED palette non disabled ; locked controls sans action | Éviter de désactiver par statut visuel seul |
| loading | YES, Shell/HUD/Balance | aria-busy, Calcul…, Validation…, server suggestions | busy mutation et hoverPending indépendants | Conserver les valeurs autoritaires |
| error | YES, Shell/service | errorNotice/formError role alert ; code serveur | Message global et modal partagent errorMessage | P4 présenter sans perdre code/refus ni draft |

States de cards, sockets, options et projection n'ont pas une seule machine sémantique. P1 peut fournir des discriminants UI structurés mais ne doit pas aplatir tous ces vocabulaires dans un enum métier nouveau.

## 25. Accessibility

Existants : boutons nommés, recherche et roving Library, clavier carousel flèches/Home/End, Ctrl/Cmd+Z/Shift+Z hors champs/dialogues, Escape, aria-live polite et alert, aria-busy, SVG décoratifs aria-hidden, popover auto/role dialog avec focus titre et retour trigger, dialogue modal natif, inactives pages inert. Le select/socket, les boutons modifier/retirer/rattacher et click palette/Library servent d'alternatives au drag.

Gaps à traiter en P4 :

- Utilities et forms inline à opacity 0 restent montés : vérifier ordre Tab et révélation focus-within, éviter un focus visuellement caché.
- Pas de navigation roving globale entre toutes les cards ; définir un accès clair aux nodes et aux enfants de cluster, focus retour stable à naissance/dissolution.
- Les contrastes des petites polices, suggestions opacity .62/.72 et EMPTY .22 demandent une mesure réelle ; aucune certification WCAG de contraste n'est revendiquée ici.
- Les satellites font 38 px : vérifier taille de cible/espacement aux différentes densités ; garder labels et état autres que la couleur seule.
- AtomicPopover a aria-controls/haspopup, pas aria-expanded explicite ; synchroniser si nécessaire avec toggle natif. Les tooltips title seuls doivent avoir un nom/chemin accessible équivalent.
- Ajouter des annonces pertinentes de destination/refus/focus du cluster sans répéter tout le HUD ; maintenir l'alternative click/keyboard de chaque commande existante.
- Reduced-motion doit couvrir naissance/dissolution, overlays, packing et focus nouvellement animés. Ne pas conserver des clones focusables/aria-duplication pour l'animation.

Aucune réparation dans ce préflight. Les guards source/SSR vérifient des contrats, pas le parcours complet d'un lecteur d'écran ou les collisions de focus dans un navigateur réel.

## 26. Structural frontend performance

Audit de structure uniquement : un READ synthétique avec owners réels et SSR des composants, sans navigation chronométrée, réseau distant ni benchmark. **0 Plan, 0 PlanRevision, 0 RPC write** pour cette inspection. Les tests Apply utilisent séparément leur base PGlite isolée.

| Observation actuelle | Mesure / nature | Risque R6 |
|---|---|---|
| Shell VISUAL au repos | ≈11 153 éléments HTML/SVG, 405 SVG, 208 Clay, 208 defs, 1 664 gradients ; 25 wrappers / 6 pages SSR | HIGH si tous les nouveaux overlays et enfants sont ajoutés en double |
| Board seul, Soirée focused | ≈4 991 éléments, 271 SVG, 69 Clay/defs, 552 gradients, 59 popovers ; palette 26 options | MEDIUM ; ce périmètre exclut Library/HUD, ne pas comparer comme gain de perf |
| Library complète | 145 assets montés, recherche locale memoized | MEDIUM ; aucun catalogue/éditeur eager supplémentaire |
| Popovers fermés | 60 dans shell ; children exécutés même fermé, deux Contexts enfants déjà montés | HIGH si un overlay de chaque cluster reproduit le pattern permanent |
| Éditeurs | Un dialogue DOM permanent ; form editor et détails financiers conditionnels ; petits forms inline montés sur cards ajustables | MEDIUM ; pas de 145 formulaires d'ajout invisibles actuels |
| Pages offscreen | Toutes montées/inert ; utile pour source du drag natif | MEDIUM ; ne pas virtualiser ni repacker en aveugle dans R6 |
| Listener AtomicPopover | Par instance : toggle local + resize/scroll capture globaux, cleanup correct | MEDIUM ; avec 60 instances ≈120 listeners globaux de placement, même fermées |
| Providers/sensors | InteractionContext local, runtime global ; aucun sensor externe | LOW ; éviter nouveaux providers/sensors par card |
| Drag image | Conteneur offscreen left −1000 px ; toutes les icônes sources montées, spans inactifs display none | LOW/MEDIUM ; garder setDragImage synchronisé sans remount de source |
| Packing / lookup | useMemo items/pages ; répétition de find/filter capabilities/assets par item/slot ; pas de serveur par node | MEDIUM ; adapter pure calculée une fois, pas un calcul financier par rendu |

Les nombres SSR décrivent la structure initiale et le HTML, pas le temps de mount ni un total exact d'instances React hydratées. Risque principal futur : multiplier définitivement children/defs/listeners pour de nouveaux détails cachés. Recommander overlay cluster **monté à l'ouverture**, sans optimiser les popovers actuels dans ce lot documentaire. Pas de nouveau cache, snapshot, précompute, SQL/GET campaign ou chantier performance. Le checkpoint conserve ses budgets : mini-vérification comparable après gros lot, trois ouvertures directes maximum ; toute réouverture doit suivre ses triggers et le bon owner.

## 27. Existing tests

Tous les scripts ci-dessous existent déjà ; aucune suite modifiée/créée pendant cette mission. Les commandes sont celles de package.json lorsqu'un alias existe, exécutées directement avec Node ; pas d'installation de dépendances.

| File | Purpose / type / fixture | What it protects / useful for R6 | Cette passe |
|---|---|---|---|
| [check-phase2-planner-kernel.mjs](../../scripts/check-phase2-planner-kernel.mjs) | Domain/service/PGlite ; planner-kernel | Compiler, preview/apply/reload, CAS/idempotence, UNKNOWN, owners ; YES | PASS, 40 groupes |
| [check-phase2-planner-contexts.mjs](../../scripts/check-phase2-planner-contexts.mjs) | Context contracts/compiler ; planner-contexts | choix/composants/enfants/binding/provenance ; YES | PASS, 29 groupes |
| [check-phase2-planner-mobility.mjs](../../scripts/check-phase2-planner-mobility.mjs) | Mobility server ; planner-mobility | prix/journeys/relations/funding/fuel-cash ; YES | PASS, 37 groupes |
| [check-phase2-planned-reality.mjs](../../scripts/check-phase2-planned-reality.mjs) | Réconciliation/server ; fixtures synthétiques du script | PlannedExpense/réel protégé, non-double-compte, C7 REAL ; YES | PASS |
| [check-phase2-planner-composer.mjs](../../scripts/check-phase2-planner-composer.mjs) | Service/serialization/PGlite ; planner-headless | DTO, saving, capabilities forged, zero-write preview, Apply/reload, vieux writer, rollback ; YES | PASS, 35 groupes |
| [check-phase2-planner-interactions.mjs](../../scripts/check-phase2-planner-interactions.mjs) | R3 pure/service/SSR ; planner-atomic-ui | sources drag, remplacement/reparent, protection, gates, valeur connue/unknown ; YES | PASS, 22 checks |
| [check-phase2-planner-visual-fidelity.mjs](../../scripts/check-phase2-planner-visual-fidelity.mjs) | R5 SSR/source/packing ; planner-visual-fidelity | render, projection non altérée, readiness contract, sparse, zones desktop ; YES | PASS, 16 checks |
| [check-phase2-planner-atomic-ui.mjs](../../scripts/check-phase2-planner-atomic-ui.mjs) | R2 SSR/contracts ; planner-atomic-ui | cards/satellites/sockets/gauge/occurrences ; YES | Inventorié, non relancé |
| [check-phase2-planner-final-polish.mjs](../../scripts/check-phase2-planner-final-polish.mjs) | R4 pure/SSR/source ; planner-atomic-ui | finishComparison, Apply/gauge/empty states, keyboard/CSS ; YES | Inventorié, non relancé |
| [check-phase2-planner-simple-levers.mjs](../../scripts/check-phase2-planner-simple-levers.mjs), [check-phase2-planner-renewals.mjs](../../scripts/check-phase2-planner-renewals.mjs) | Controls/renewals ; fixtures homonymes | classes SIMPLE/HABIT, keys besoins et prix inconnus ; YES | Inventoriés |
| [check-phase2-planner-headless.mjs](../../scripts/check-phase2-planner-headless.mjs) | C7 end-to-end serveur ; planner-headless | owner projection et scenarios C7 ; YES | Inventorié |
| [smoke-phase2-planner-composer.mjs](../../scripts/smoke-phase2-planner-composer.mjs) | Navigateur ; host isolé | ouverture, édition, Apply/reload, histoire et drag ; YES | Non lancé |
| [smoke-phase2-planner-interactions.mjs](../../scripts/smoke-phase2-planner-interactions.mjs) | Navigateur ; scénarios R/RA/RB/RC | vrai drag, hover, undo/redo, protection, dialogues ; YES | Non lancé |
| [smoke-phase2-planner-final-polish.mjs](../../scripts/smoke-phase2-planner-final-polish.mjs), [smoke-phase2-planner-visual-fidelity.mjs](../../scripts/smoke-phase2-planner-visual-fidelity.mjs) | Navigateur desktop ; VISUAL/SPARSE/UNREADY | Compare, accessibilité, pages, focus, geometry/screens ; YES | Non lancés |
| [check-composer-orchestration.mjs](../../scripts/check-composer-orchestration.mjs), [check-planner-performance-parity.mjs](../../scripts/check-planner-performance-parity.mjs) | Guards structure/parité | orchestration/admission Forecast et manifest/sourceRefs ; YES | Conservés, pas de campagne |

**TESTS_EXECUTED = 7 existing suites. TESTS_STATUS = PASS.** L'inspection READ+SSR n'est pas comptée comme huitième suite. Aucun guard rouge observé, aucun test corrigé pour rendre ce préflight vert. Build/typecheck et smoke navigateur ne sont pas relancés pour ce document seul ; ils seront obligatoires aux checkpoints de code R6. Les guards visuels codent encore la présentation R5 : ne pas les supprimer globalement quand une attente de silhouette change ; distinguer attentes visuelles à migrer et invariants financiers à garder.

## 28. Validation fixture

~~~ini
FIXTURE_FILE = scripts/fixtures/planner-visual-fidelity.mjs
FIXTURE_SYMBOL = visualMonth
ROUTE_PRODUCTION = /mois-a-venir/composer?month=2026-11, authentifiée
ROUTE_SYNTHETIC = http://127.0.0.1:3108/?scenario=VISUAL
DATA_SOURCE = renewalMonth + nightMonth + weekendMonth + simpleMonth + Contexts synthétiques
REPRO_COMMAND = node scripts/serve-phase2-planner-composer-fixture.mjs
READ_ONLY_BASELINE_COMMAND = node scripts/check-phase2-planner-visual-fidelity.mjs
~~~

Le host utilise le vrai ComposerShell/AppShell et handleComposerRequest, avec PGlite isolé, providers Mobility synthétiques, fetch serveur refusant le réseau distant. Prérequis du host : dépendances esbuild présentes et .next/static/chunks contenant le CSS global d'un build Next ; si nécessaire, build normal dans la future mission de code, puis démarrer le host. Le port est configurable via PORT ; pas de bypass auth en production. Le scénario est choisi par query scenario. Les scripts smoke ont leur protocole de lancement propre : lire leur début plutôt que supposer qu'un serveur doit déjà tourner.

VISUAL contient Courses, Café travail, Coiffeur, Tabac/vape, Saving, Soirée, Week-end, Cadeau, Visite famille, les besoins Beauté et les cinq controls FOOD. Cliquer Soirée ouvre la palette Équiper ; inventoryPageFor conduit à sa page. **Aujourd'hui Beauté/Restauration clusterisés n'existent pas, et le carousel ne montre pas tous les 25 roots simultanément.** Ne pas certifier la scène R6 par une capture actuelle d'un autre écran ou par uiContract=ready : ce dernier force un état de présentation et bloque le transport Apply.

Future scène de validation à créer **en test/presentation seulement**, après P1/P2 : scripts/fixtures/planner-r6-presentation.mjs, qui réutilise visualMonth et ajoute un descripteur de scène dérivé du vrai ComposerUiModel. Conserver l'intégralité du modèle/projection/commandes ; choisir dans ce descripteur les 11 nodes visibles demandés, focus Soirée, Library et palette ouvertes (Équiper constitue le douzième élément demandé, pas un node métier). Un host de scène de présentation peut limiter le rendu à ces références pour comparer une capture unique sans inventer un monde financier réduit. En parallèle, le scénario VISUAL complet doit rester le test d'interaction et d'Apply ; aucune limitation de scène dans le produit.

Vérifier la scène : Courses, Café, Coiffeur, Tabac, Saving, Composite Soirée selected, Week-end, cluster BEAUTY, cluster FOOD, Cadeau, Visite famille, Équiper Soirée. Les enfants demandés ne restent pas top-level, mais se retrouvent exactement une fois par référence dans les overlays. Sourcils demeure accessible si membre additionnel. Ajouter des variantes de présentation 2/3 membres pour seuils, closed/open, protected/adjustable/preserved saving et keyboard ; réutiliser les builders synthétiques existants, jamais données métier persistantes. **Ne pas créer cette fixture dans le préflight.**

## 29. File inventory

Inventaire complet de la surface Composer actuelle, ses frontières immédiates et les ajouts proposés. Future action : KEEP, STYLE_ONLY, EXTRACT, SPECIALIZE, ADD_ADAPTER, REPLACE_PRESENTATION, DEFER, DO_NOT_TOUCH. Les modules métier groupés ici sont détaillés en §30.

| File | Current role / why | R6 phase | Future action | Risk |
|---|---|---|---|---|
| src/app/mois-a-venir/composer/page.tsx | Entrée serveur/auth ; préserver le chargement | NONE | KEEP | LOW |
| src/app/mois-a-venir/composer/actions.ts | Transport authentifié/revalidate | NONE | DO_NOT_TOUCH | HIGH métier |
| src/app/mois-a-venir/composer/composer-shell.tsx | Model/history/preview/Compare/editor ; éviter ajout cluster au controller | P1/P4 | EXTRACT limité à composition/header | HIGH |
| src/app/mois-a-venir/composer/composer-board.tsx | Facade board / cibles / dispatch card | P1/P3 | SPECIALIZE | HIGH DnD |
| src/app/mois-a-venir/composer/board-carousel.tsx | Pages montées, focus, dwell, mesure | P1/P4 | KEEP puis adapter entrée nodes | HIGH remount |
| src/app/mois-a-venir/composer/inventory-layout.ts | Dimensions/ordre/packing UI | P1/P4 | REPLACE_PRESENTATION de l'entrée, KEEP algorithme initial | MEDIUM |
| src/app/mois-a-venir/composer/composer-card.tsx | Card controls/Saving/HABIT | P0/P1 | STYLE_ONLY puis SPECIALIZE | HIGH |
| src/app/mois-a-venir/composer/context-card.tsx | Context et récursion/enfants | P1/P3 | SPECIALIZE | HIGH |
| src/app/mois-a-venir/composer/context-socket.tsx | Satellite et EMPTY/action/drop | P3 | EXTRACT / REPLACE_PRESENTATION | HIGH |
| src/app/mois-a-venir/composer/atomic-popover.tsx | Native details/focus/transient placement | P3/P4 | KEEP contrat / STYLE_ONLY | MEDIUM |
| src/app/mois-a-venir/composer/context-palette.tsx | Options publiées, click/drag | P3 | REPLACE_PRESENTATION grouping | HIGH |
| src/app/mois-a-venir/composer/composer-library.tsx | Catalogue/search/roving/sources | P0 | STYLE_ONLY | MEDIUM |
| src/app/mois-a-venir/composer/composer-cockpit.tsx | HUD et détails owner fields | P4 | STYLE_ONLY | HIGH finance |
| src/app/mois-a-venir/composer/comparison.ts | restore/keep history variante | NONE | KEEP | HIGH |
| src/app/mois-a-venir/composer/balance-layer.tsx | Suggestions serveur + ACCEPT | P4 | STYLE_ONLY | MEDIUM |
| src/app/mois-a-venir/composer/interactions.tsx | Native handles/preparedDrop/context | P3 | KEEP, adapter seulement interfaces visuelles | HIGH |
| src/app/mois-a-venir/composer/draft-controller.ts | sequence/digest stale guard | NONE | KEEP | HIGH |
| src/app/mois-a-venir/composer/display.ts | Intl formatters, null labels | NONE | KEEP | MEDIUM null |
| src/app/mois-a-venir/composer/presentation-label.ts | Label/person chip ; regex de prénoms actuellement | P1 | DEFER données générales, ne pas classifier avec regex | MEDIUM |
| src/app/mois-a-venir/composer/composer.module.css | CSS local/token/motion/layout | P0/P2/P3/P4 | STYLE_ONLY / REPLACE_PRESENTATION locale | HIGH scope |
| src/app/mois-a-venir/composer/planner-icons/planner-icon.tsx | Facade et registre SVG terminal | P0 | EXTRACT registre, KEEP facade | MEDIUM |
| src/app/mois-a-venir/composer/planner-icons/clay-frame.tsx | Matériaux/viewBox/defs | P0 | STYLE_ONLY | MEDIUM DOM |
| src/app/mois-a-venir/composer/planner-icons/DESIGN_TOKENS.md | Contrat visuel local | P0/P4 | KEEP puis documenter nouvelle direction validée | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/activity.tsx | ActivityIcon, fallback | P0 | STYLE_ONLY | MEDIUM fallback |
| src/app/mois-a-venir/composer/planner-icons/icons/beauty.tsx | BeautyIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/before.tsx | BeforeIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/bowling.tsx | BowlingIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/car.tsx | CarIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/clothing.tsx | ClothingIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/family.tsx | FamilyIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/fuel.tsx | FuelIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/gift.tsx | GiftIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/groceries.tsx | GroceriesIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/haircut.tsx | HaircutIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/home.tsx | HomeIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/lodging.tsx | LodgingIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/meal.tsx | MealIcon ; food/delivery/fast-food aliases | P0 | STYLE_ONLY | MEDIUM uniformité |
| src/app/mois-a-venir/composer/planner-icons/icons/night-out.tsx | NightOutIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/restaurant.tsx | RestaurantIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/savings.tsx | SavingsIcon | P0 | STYLE_ONLY | MEDIUM sens |
| src/app/mois-a-venir/composer/planner-icons/icons/short-stay.tsx | ShortStayIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/ticket.tsx | TicketIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/tobacco.tsx | TobaccoIcon | P0 | STYLE_ONLY | LOW |
| src/app/mois-a-venir/composer/planner-icons/icons/tram.tsx | TramIcon | P0 | STYLE_ONLY | LOW |
| src/components/layout/app-shell.tsx | Framing global + branche Composer | P4 | KEEP ; ajustement Composer ciblé si preuve | HIGH global |
| src/app/layout.tsx ; src/components/runtime/product-runtime-provider.tsx ; exploration-runtime-host.tsx | Providers applicatifs | NONE | DO_NOT_TOUCH | HIGH global |
| src/app/globals.css ; src/app/mois-a-venir/month-control-center.module.css | Styles partagés/autre écran | NONE | DO_NOT_TOUCH | HIGH global |
| src/app/mois-a-venir/builder-illustrations.tsx ; builder-illustration-registry.json ; public/planned-visuals/builder/clay/* | Autre système d'illustrations | NONE | DO_NOT_TOUCH | MEDIUM incohérence |
| src/domain/phase2/planner/composer-contract.ts ; composer-ui-contract.ts | DTO/commands actifs | NONE | KEEP ; types nodes locaux seulement | HIGH transport |
| src/domain/phase2/planner/interaction-contract.ts | Prototypes sans consumer actif trouvé | NONE | DEFER | MEDIUM confusion |
| src/server/phase2/planner/read-model.ts ; composer-service.ts ; composer-presentation.ts | Read model/catalogue/transport/presentation serveur | NONE | KEEP | HIGH owners |
| scripts/fixtures/planner-visual-fidelity.mjs ; scripts/lib/planner-composer-browser-entry.tsx ; scripts/serve-phase2-planner-composer-fixture.mjs | Base synthétique réelle | P1/P2 | KEEP ; scène R6 séparée | MEDIUM |
| scripts/check-phase2-planner-*.mjs ; scripts/smoke-phase2-planner-*.mjs | Tests existants décrits §27 | P0–P4 | KEEP invariants / migrer attentes visuelles démontrées | HIGH fausse certification |
| planner-icons/icon-registry.ts (à créer sous Composer) | Registre terminal extrait | P0 | EXTRACT | MEDIUM doublon |
| planner-icons/icons/coffee.tsx (éventuel, à créer sous Composer) | Silhouette spécifique si cible la demande | P0 | STYLE_ONLY | LOW |
| presentation/node-types.ts ; adapter.ts ; node-mappers.ts (à créer sous Composer) | Union/types + mapping pur | P1 | ADD_ADAPTER | HIGH frontière |
| cards/card-frame.tsx ; simple-card-node.tsx ; protected-saving-node.tsx ; composite-context-node.tsx (à créer sous Composer) | Facades spécialisées et anatomy | P1 | SPECIALIZE | HIGH DnD/focus |
| presentation/cluster-rules.ts ; clusters/visual-cluster-node.tsx ; cluster-overlay.tsx (à créer sous Composer) | Clusters UI et détail à la demande | P2 | ADD_ADAPTER / REPLACE_PRESENTATION | HIGH |
| context-satellite.tsx ; presentation/socket-visibility.ts ; equipment-groups.ts ; context-equipment-group.tsx (à créer sous Composer) | Extraction/grouping/visibility sans nouvelle capability | P3 | EXTRACT / REPLACE_PRESENTATION | HIGH |
| composer-compare.tsx ; presentation/layout-order.ts (à créer sous Composer) | Header Compare et ordre UI | P4 | EXTRACT / REPLACE_PRESENTATION | MEDIUM/HIGH |
| scripts/fixtures/planner-r6-presentation.mjs (à créer) | Scène et seuils test/UI | P1/P2 | ADD_ADAPTER test/presentation | MEDIUM |

Tous les paths abrégés de nouveaux fichiers de cette table ont pour base src/app/mois-a-venir/composer/ sauf le dernier script. Aucun fichier proposé n'est ajouté dans cette mission.

## 30. R6_DO_NOT_TOUCH

Une modification d'un owner ci-dessous pendant R6 est suspecte, sauf dépendance précise démontrée et auditée séparément. L'absence d'un chiffre pour une décoration ne justifie pas de recomposer le moteur.

| Owner / file or module | Why not R6 |
|---|---|
| Canonical : src/server/canonical/repository.ts, context.ts, client.ts, record.ts, physical-contracts.ts, in-batches.ts | Auth/foyer/facts, fieldsets/batching et erreurs ; aucune card ne mute cette autorité. |
| World/Baseline : src/server/phase2/planner/world-reader.ts, baseline-adapters.ts, baseline.ts, baseline-sources.ts, baseline-structural.ts, baseline-habits.ts, baseline-food.ts, baseline-mobility.ts, baseline-evidence.ts, simple-baseline.ts, renewal-baseline.ts | Admission Forecast, fenêtres/cutoff, historique, provenance et besoin ; pas de regroupement visual clusters ici. |
| Contrats Baseline/Plan : src/domain/phase2/planner/baseline-contract.ts, plan-contract.ts, semantic-state.ts, identity.ts | Identités et intention durable ; aucun node/position de cluster dans ces structures. |
| PlanRevision : src/server/phase2/planner/repository.ts, apply.ts, draft-reader.ts, revision-evidence.ts, change-set.ts ; supabase/migrations/20261005202346_phase2_month_plan_foundation.sql | CAS/idempotence/RPC/immutabilité/reload ; pas de migration ni nouvelle table cluster. |
| Semantic Compiler : src/server/phase2/planner/compiler.ts, context-compiler.ts, renewal-compiler.ts, constraint-engine.ts, plan-slot-resolver.ts, cost-resolver.ts, semantic-mutations.ts ; src/domain/phase2/planner/compiler-contract.ts | Coûts, substitutions/binding, contraintes, objets et manifest ; aucune silhouette comme entité économique. |
| Registre/Contexts : src/server/phase2/planner/context-registry.ts, context-state.ts, context-selections.ts ; src/domain/phase2/planner/context-contract.ts, component-contract.ts | Catalogue métier/capacités/provenance/cardinalités ; groupe palette reste local. |
| Owner financier : src/server/phase2/month-scenario.ts, planner/financial-adapter.ts, planner/projection.ts, planner/effective-month-scenario.ts ; src/domain/phase2/planner/projection-contract.ts | deriveMonthScenario, PlanProjection, non-double-compte, UNKNOWN, coût économique ; jamais recalcul React. |
| Mobility : src/server/phase2/planner/mobility-adapter.ts, mobility-compiler.ts, journey-resolver.ts, prospective-mobility-pricing.ts, mobility-selections.ts ; src/server/phase2/planned-car-estimation.ts, planned-car-providers.ts ; src/domain/phase2/planned-car.ts et planner/mobility-contract.ts | Journey owner, shared rides, prix, temps, fuel/cash ; un satellite est une vue. |
| PlannedExpense/réel : src/server/phase2/planned-expenses.ts, planned-observation-reconciliation.ts | Prévision concrète/réalisation sous leurs owners ; R6 ne développe pas T0–T7. |
| Operation : src/server/query/sources/operations.ts, src/analytics/facts/operations.ts | Economic truth et normalisation faits ; pas de mutation ni nouvelle relation Plan→Operation par UI. |
| Purchase : src/analytics/global-v2/purchases.ts, purchase-convergence.ts, purchase-aware-grocery-cost.ts ; src/server/analytics/global-v2-purchase-authority.ts | Owner achat effectif et couverture ; Beauté ne devient pas un Purchase. |
| Wallet/Funding/Cash : src/server/phase2/benefit-wallet-funding.ts, bank-cash-projection.ts, month-scenario.ts | Capacité wallet vs coût/paiement/reservation ; pas de somme de clusters ni jauge inventée. |
| Transport : src/app/mois-a-venir/composer/actions.ts ; src/server/phase2/planner/composer-service.ts, read-model.ts | Capabilities re-read, validations, preuve Apply et server impact ; garder le langage de commandes. |
| Global/navigation : src/app/globals.css, src/app/layout.tsx, autres pages mensuelles, Builder ; src/server/phase2/planner/cutover.ts | Scope local Composer ; pas de calendrier, sidebar droite ou changement de feature flag. |
| Configuration, secrets, schéma : supabase/migrations/*, .env*, auth, package manager/config | Aucun besoin R6 de migration, secret, dépendance DnD ou changement de schéma. |

## 31. R6-P0 plan

**R6_P0_ART_DIRECTION — plan prêt ; aucune implémentation dans ce document.** P0 établit Clay V2, tokens locaux et anatomy simple/Library. VisualCluster, nouveau DTO, nouveau layout ou state machine sont hors P0.

| Files to modify/create | Action concrète et ordre |
|---|---|
| planner-icons/icon-registry.ts **à créer**, planner-icons/planner-icon.tsx | Extraire les 21 entrées/aliases actuels en un registre terminal unique ; facade et iconKey existants conservés ; couvrir explicitement les fallbacks observés. |
| planner-icons/clay-frame.tsx, chacun des 21 fichiers planner-icons/icons/* de §29 | Actualiser le langage visuel selon brief/mockup disponible ; viewBox, useId, scale et rôle décoratif conservés ; contrôler lisibilité à 30/32/34/52 px et taille de defs. |
| planner-icons/icons/coffee.tsx **éventuel** | Seulement si la cible demande une silhouette Café distincte ; ajout dans le registre terminal, pas dans le catalogue métier. Le mapper actuel publie meal pour Café : un simple alias meal→coffee changerait aussi les repas. Utiliser un resolver visuel terminal avec targetRef/capabilityRef existant pour l'override Café dans Card/Library, sans changer le DTO serveur. |
| composer.module.css | Couleurs/contrastes/tailles/borders/shadows/typo et bruit visuel local ; pas de changement packing, socket visibility métier ou listeners. |
| composer-card.tsx | Anatomy des cards simples/habits et valeur ; conserver data-control/data-variant, props/callbacks, capability checks et forms. Saving garde les mêmes règles. |
| composer-library.tsx | Mini-card/search/category présentation ; préserver 145 assets, assetKey, roving, search et click/drag. |
| planner-icons/DESIGN_TOKENS.md | Documenter les tokens/dessins effectivement retenus, version/sizes/states ; ne pas inventer une fidélité TARGET. |

CLAY_REGISTRY_LOCATION = src/app/mois-a-venir/composer/planner-icons/icon-registry.ts. STYLE_FILES = composer.module.css et ClayFrame. CARD_FILES = composer-card.tsx ; LIBRARY_FILES = composer-library.tsx. NO_TOUCH_FILES = §30, Shell handlers, Context/drop/palette/layout/Compare/DTO ; ne pas introduire de cluster ou extraire tout l'orchestrateur.

VISUAL_GATES : Vue VISUAL/SPARSE, objets lisibles dans toutes les surfaces, Café/Coiffeur/Tabac/Gift/Saving distincts, unknown et locked visibles, 1440×760/900, 1728×900, 1920×1080, pas de calendrier/right sidebar. TARGET absent : indiquer la référence disponible et une revue visuelle non certifiée à l'image ; ne pas combler par un art brief inventé.

BUSINESS_GUARDS : projection/digest/manifest inchangés pour même input ; Kernel, Contexts, Mobility, Planned Reality, C8 et R5 ; vérifier Apply/reload et keyboard Library via smoke pertinent après code. Les invariants source tests restent ; seules les attentes d'apparence devenues obsolètes peuvent être révisées de façon explicitée. RISKS : doublon de registre, aliases cassés, CSS global, SVG plus volumineux, réduction de contraste ou disparition d'une action focusable.

## 32. R6-P1 plan

**R6_P1_SEMANTIC_PRESENTATION_LAYER.** PRESENTATION_ADAPTER_FILE = src/app/mois-a-venir/composer/presentation/adapter.ts ; NODE_TYPES_FILE = presentation/node-types.ts. INPUT ComposerUiModel inchangé, OUTPUT ComposerPresentationNode[]. Mapper pur, sans server-only, requête ou arithmétique de coût.

| Fichier futur / existant | Action |
|---|---|
| presentation/node-types.ts **à créer** | Union SimpleCardNode/CompositeContextNode/VisualClusterNode/ProtectedSavingNode ; source refs discriminées, données économiques reprises, readonly ; cluster inactif. |
| presentation/node-mappers.ts **à créer** | mapSimpleNode, mapCompositeContextNode, mapSavingNode ; night-out/short-stay explicites ; gift/family-visit simple anatomy en conservant source CONTEXT. |
| presentation/adapter.ts **à créer** | Mapper les roots une fois, exclure children déjà liés et availableReservationRefs comme aujourd'hui ; pas encore de regroupement. |
| cards/card-frame.tsx **à créer** | Silhouette/slots visuels sans modèle métier, mutation, coût ni fetch ; noms/focus/action slot explicites. |
| cards/simple-card-node.tsx ; protected-saving-node.tsx ; composite-context-node.tsx **à créer** | Facades spécialisées branchées sur callbacks/control ou Context actuels ; réutiliser Card/Context au départ, déplacer anatomy en petits commits compilables. |
| composer-board.tsx ; inventory-layout.ts ; board-carousel.tsx | Passer nodes à renderer/layout via bridge compatible ; id/sourceRefs stables ; garder paging/dwell/DnD/data attrs. Aucun repacking pendant geste. |
| composer-card.tsx ; context-card.tsx | Extraire uniquement ce qui est nécessaire aux facades ; préserver variantes/habit/gauge/enfants/menus ; pas de god card. |
| composer-shell.tsx | Composition/props seulement ; history/preview/gates/Apply/Compare inchangés. Si extraction d'orchestration devient nécessaire, lot isolé et tests de comportement avant de déplacer les handlers. |
| scripts/fixtures/planner-r6-presentation.mjs **à créer** | Descripteur de scène de test dérivé, sans persistance ni nouvelle projection (§28). |

REACT_BOUNDARY : Board appelle adapter, nodes renvoient aux handlers du Shell ; les composants n'importent aucun compiler/cost-resolver. DATA_FLOW = owner → DTO actuel → adapter local → typed nodes → facades → commandes existantes. Conserver les labels complets si le person chip générique n'est pas disponible : presentation-label.ts contient aujourd'hui une regex Adrien/Manon, qui ne doit pas alimenter le type de node ou les clusters.

Gate P1 : mêmes objets/références/commandes/projection ; types distincts, Saving adjustable réellement ajustable ; gift/visit utilisent toujours Context identity ; cluster type défini mais regroupement absent. Build/typecheck + Kernel/Contexts/Mobility/Reality/C8/R3 et smoke interactions/Apply/history.

## 33. R6-P2 plan

**R6_P2_VISUAL_CLUSTERS.** CLUSTER_RULE_FILE = src/app/mois-a-venir/composer/presentation/cluster-rules.ts. Aucun nouveau type domaine, table, enum métier ou montant calculé.

| Fichier futur / existant | Action |
|---|---|
| presentation/cluster-rules.ts **à créer** | Whitelist clés §23, racines seulement ; BEAUTY ≥3/≤2, FOOD même seuil proposé ; membership unique et stable. |
| presentation/adapter.ts, node-types.ts | Produire VisualClusterNode avec références readonly, member count et id visuel ; masquer seulement ses membres du top-level de présentation. |
| clusters/visual-cluster-node.tsx **à créer** | Card de cluster sans Drop/Trash financier ; ouverture et résumé non monétaire ; garde accès à chacun. |
| clusters/cluster-overlay.tsx **à créer** | Overlay monté à l'ouverture ; réutilise facades de children, même sourceRef/callbacks ; focus initial/return/escape ; ne monte pas tous les panels fermés. |
| composer-board.tsx ; inventory-layout.ts ; board-carousel.tsx | Accepter silhouette cluster ; mapper focus d'un enfant vers cluster/page ; pas de duplication ni de remount pendant drag. |
| composer.module.css | Styles cluster/overlay et transitions locales ; motion désactivable ; aucune coordonnée sauvegardée. |
| scripts/fixtures/planner-r6-presentation.mjs | Variantes 2/3 membres, open/closed, autres root non membres et prix unknown ; références snapshot inchangées. |

PRESENTATION_MAPPING : children source refs conservées, pas copie mutable de décisions ; parent composite/child Context hors groupe. CHILD_RENDERING : facades P1. BIRTH_DISSOLVE_STATE : dérivé du nombre, expanded/focus UI local seulement, dissolution referme ou rend focus au premier enfant visible pertinent. SPATIAL_MEMORY : id visuel/focus/ordre déterministe de la session ; pas x/y/centroid/localStorage. LAYOUT_IMPACT : nouveau InventoryItem de présentation, owners/DTO identiques ; freeze packing pendant native grab et réconcilier au dragend.

Tests P2 : R6-001/003/007/008/011/014/024/025/026/027/028 (§38), riche VISUAL complet et scène, Kernel/Contexts/Mobility/Reality/C8, keyboard overlay/drag child/Compare/history. Birth/dissolve ne donne aucune commande MUTATE/APPLY ; montant global du cluster reste absent.

## 34. R6-P3 plan

**R6_P3_INTERACTIONS.** Remplacer le rendu orbital bruyant sans réécrire la mécanique native ni le catalogue de commandes.

| Fichier futur / existant | Action |
|---|---|
| context-satellite.tsx **à créer**, context-socket.tsx | Extraire chaque bubble/state/actions ; conserver selectionId/sourceSocket et source enfant Context ; unknown/derived/suggestion fidèles. |
| presentation/socket-visibility.ts **à créer** | REST 0 EMPTY ; SELECTED max 1–2 utiles par Context sélectionné ; priorités déterministes ; compatible drag révèle cible utile sans retirer capabilities. |
| context-card.tsx ; cards/composite-context-node.tsx | Composer centre/satellites/EMPTY sélectionnés depuis présentations ; conserver readOnly/preserve/body unique-target logic et children. |
| equipment-groups.ts ; context-equipment-group.tsx **à créer**, context-palette.tsx | AVANT/MOMENT/REPAS/ALLER-RETOUR sur Soirée, groupes Week-end explicites ; chaque option originale reste addressable par slot/sourceKey. |
| interactions.tsx ; composer-board.tsx | KEEP preparedDrop/publishedDrop/leftSurface/Context ; déplacer les handles/cibles visuels, garder contextual trash et protected refusal. |
| atomic-popover.tsx | Préserver native top layer/focus ; adaptation des détails/labels sans éditeur financier caché par node. |
| composer-shell.tsx | Brancher composants sans changer place/equip/preview/run/Compare/Apply ; pas de nouveau sensor/provider. |
| composer.module.css | Orbites, bulles, feedback/drop/recoil et palette ; styles de cible/focus compatibles avec nouveaux wrappers. |

Replace = DROP vers le même slot non repeating, provenance/données validées au serveur ; remove = removeOperation/CLEAR_SOCKET ou Context TRASH selon source, pas une commande DELETE_CLUSTER. Contextual trash uniquement lors d'un grab concerné ; protected/preserved conserve refus local et serveur. Keyboard equivalents : palette click, select socket, Retirer/Modifier/Rattacher, accepter suggestion et ouverture enfant restent atteignables même sans EMPTY visible au repos.

Gate P3 : cinq flux A–E réexécutés dans le navigateur, notamment reparent child et move sourceSocket en gardant financement/journey/quotes/champs ; old response ignorée, zéro writes sur hover/refus ; R6-005/006/009/010/015/019/029/030 + R3/C8 et quatre guards. Ne pas dédupliquer template et component par label.

## 35. R6-P4 plan

**R6_P4_POLISH.** Aucun T7, calendrier, right sidebar ou owner supplémentaire.

| Fichier futur / existant | Action |
|---|---|
| composer-cockpit.tsx ; composer-shell.tsx | HUD/header présentation seule, même sources/chiffres/null/loading/Compare baseline. |
| composer-compare.tsx **à créer**, comparison.ts | Extraire controls/header Compare en facade ; finishComparison unchanged, Apply invisible pendant variante. |
| presentation/layout-order.ts **à créer**, inventory-layout.ts | Semantic gravity légère/ordre stable des nodes ; dense packing selon silhouettes finales ; aucune position persistée ou priorité financière. |
| board-carousel.tsx | Mesure/paging/focus stables, defer packing pendant drag, child→cluster→page ; vérifier inert/capture et pas de feedback loop ResizeObserver. |
| composer.module.css ; planner-icons/DESIGN_TOKENS.md | Hover/focus/shadows/typo, transitions/animations et reduced-motion ; scope Composer, pas de globals. |
| atomic-popover.tsx ; Library/facades/cluster-overlay | Gaps §25 : focus retour et reveal, alternatives keyboard, aria/touch target/contrast ; éviter duplicate hidden focusables. |
| src/components/layout/app-shell.tsx | KEEP ; seulement branche Composer si clipping/padding réel nécessite correction démontrée. |

Responsive desktop : tester 1440×760, 1440×900, 1728×900, 1920×1080 avec layout intrinsèque/mesuré. Conserver le scope desktop ; ne pas introduire un layout mobile ou un breakpoint CSS en passant sans réviser explicitement ses guards et son scope. Revoir la géométrie réellement hydratée, pas les seules pages SSR.

Gate P4 : smoke R4/R5, Compare enter/restore/keep + Undo/Redo, hover/Apply/reload, tab order/reader labels/contrast, reduced-motion, dense/sparse/cluster open et source drag across pages. Build/typecheck + Kernel/Contexts/Mobility/Reality ; mini-contrôle performance du checkpoint uniquement après le gros lot, sans profiler/campagne en l'absence de trigger.

## 36. Dependency graph

~~~mermaid
flowchart TD
  Base[Checkpoint 0 : guards + VISUAL + owners] --> Icons[P0 registre terminal + ClayFrame + SVG]
  Base --> Styles[P0 tokens/CSS/Card/Library anatomy]
  Icons --> P0Gate[P0 revue visuelle + invariants]
  Styles --> P0Gate
  P0Gate --> Types[P1 types + adapter + source refs]
  Types --> Cards[P1 facades Card/Context/Saving + bridge packing]
  Cards --> P1Gate[P1 identity/commands/Apply/history]
  P1Gate --> Rules[P2 cluster rules + overlay + focus map]
  Rules --> P2Gate[P2 thresholds/immutable children/zero money sum]
  P2Gate --> Interactions[P3 satellite extraction + socket visibility + equipment groups]
  Interactions --> P3Gate[P3 real native drag A-E + keyboard]
  P3Gate --> Polish[P4 HUD/Compare + semantic order + desktop/a11y/motion]
  Polish --> P4Gate[Checkpoints final : owners + browser]
~~~

PARALLELIZABLE : en P0, dessins/registre et tokens/anatomy après accord de leur contrat visuel ; en P1, types/mappers puis facades avec interface fixée ; revue de scène/test matrix en parallèle de présentation. Cela décrit les dépendances de futurs lots, pas une délégation lancée par ce préflight. Éviter deux auteurs concurrents sur composer.module.css/Shell/Board.

SEQUENTIAL : interfaces P1 avant clusters, identité/focus P2 avant drag enfants P3, silhouettes/states définitifs avant semantic packing P4. Blockers architecturaux = aucun. OQ-01 bloque uniquement une certification de fidélité à une image absente, pas le démarrage cadré P0. Ne pas implémenter clusters en P0 sous prétexte d'un dessin de groupe.

## 37. Migration checkpoints

Chaque étape de code garde une application compilable, Composer ouvrable, projection correcte, Apply/reload et Undo/Redo fonctionnels. Petits commits indépendants ; pas de rewrite from scratch. En cas d'échec, corriger/revenir sur le lot de présentation concerné sans réécrire un owner pour faire passer le visuel.

| Checkpoint | Contenu attendu | Validation requise avant suite |
|---|---|---|
| R6_CHECKPOINT_0 | HEAD préflight, VISUAL et commandes/capacités de référence, captures futures sans art changé | Quatre guards + C8/R3/R5 ; document disponible ; pas d'implémentation R6 ici |
| R6_CHECKPOINT_1 | P0 registre/Clay/tokens/anatomy simples/Library ; aucun regroupement | Compile/typecheck, ouvrir VISUAL/SPARSE, owners même input même projection ; Apply/reload/history ; gates P0 |
| R6_CHECKPOINT_2 | P1 adapter readonly/facades ; cluster type dormant | Tous IDs/data sources/capacités inchangés ; Saving ajustable/protégé ; Context simple/composite ; guards + smoke ciblé |
| R6_CHECKPOINT_3 | P2 BEAUTY/FOOD/overlay/seuils | Aucun nouveau semanticState/write ; enfants immuables/accessibles ; focus et move enfant ; Compare/Undo/Apply |
| R6_CHECKPOINT_4 | P3 satellites/sockets/équipement | REST/selected, options exhaustives, DnD A–E et keyboard réels ; prix/funding/UNKNOWN/identité conservés |
| R6_CHECKPOINT_5 | P4 HUD/Compare/layout/desktop/a11y/motion | Tests métier + smoke R4/R5/scène R6 ; contrastes/focus et sources de chaque chiffre ; mini-check comparable autorisé par checkpoint performance |

Invariant à chaque checkpoint : Preview = Apply = Immediate Reload sur fixtures applicables ; les cas BLOCKED/UNKNOWN conservent leurs refus, jamais force READY. Conserver la suite R5 avant de modifier ses assertions de silhouette ; nouvelle assertion R6 doit démontrer l'invariant de remplacement, pas masquer un guard financier rouge.

## 38. Future test matrix

Ces cas sont un **plan**, aucun nouveau test n'est écrit ici. U = pur/contrat/SSR ; S = service/PGlite ; B = navigateur réel, visuel/keyboard. Réutiliser le script existant pertinent, ajouter une suite R6 de présentation si nécessaire lors de son lot ; ne pas déplacer le métier dans les fixtures UI.

| ID | Invariant et preuve à obtenir | Type / phase |
|---|---|---|
| R6-001 | Même world/state → projection, digest financier/manifest/sourceRefs identiques avant/après présentation | S + U, chaque phase |
| R6-002 | Preview = Apply = immediate reload, mêmes preuves/CAS/idempotence ; cas stale zéro write | S + B, chaque phase |
| R6-003 | Birth/open/close/dissolve cluster ne change aucune décision/enfant métier | U + S, P2 |
| R6-004 | Simple/Composite/Cluster/Saving ont silhouettes et semantics UI distinctes | SSR + B, P1/P2/P4 |
| R6-005 | REST : 0 EMPTY sockets, capacités toujours accessibles | U + B, P3 |
| R6-006 | SELECTED : max 1–2 EMPTY utiles ; bon Context/destination | U + B, P3 |
| R6-007 | BEAUTY apparaît seulement à ≥3 membres éligibles racines | U, P2 |
| R6-008 | BEAUTY se dissout à ≤2 ; focus/enfants retrouvent chemin valide | U + B, P2 |
| R6-009 | DnD A–D émet mêmes commandes/source refs/options/provenance qu'avant | S + B, P3 |
| R6-010 | Protected/preserved refus de retrait local et serveur, zéro write | S + B, P1/P3 |
| R6-011 | Aucun x/y/coordonnée UI/cluster dans request/semanticState/revision/storage | U + S, P2/P4 |
| R6-012 | Aucun calendrier ni grille de dates ajoutée | Source + B, chaque phase |
| R6-013 | Aucune sidebar droite permanente ; HUD et détails à la demande | SSR + B, P4 |
| R6-014 | Tous les children de cluster accessibles individuellement, même identities/actions | U + B, P2/P3 |
| R6-015 | Alternative keyboard/click pour add/equip/replace/remove/accept/reparent ; focus retour | B, P3/P4 |
| R6-016 | prefers-reduced-motion couvre toutes nouvelles transitions, sans clones focusables | Source + B, P2/P4 |
| R6-017 | Compare actuel enter/restore exact/keep/history, zéro Apply pendant variante | U + S + B, P4 |
| R6-018 | Undo/Redo après édition/cluster visible/Compare, serveur re-évalue bon état | S + B, chaque phase |
| R6-019 | Library garde assets, search, categories, capabilities, drag/click et roving | U + B, P0/P3 |
| R6-020 | Planner Kernel PASS | S, chaque phase |
| R6-021 | Planner Contexts PASS | S, chaque phase |
| R6-022 | Planner Mobility PASS | S, chaque phase |
| R6-023 | Planned Reality PASS | S, chaque phase |
| R6-024 | Montants/count unknown/null ne deviennent ni zéro ni somme de cluster ; funding/cash distincts | U + S, P1/P2/P4 |
| R6-025 | root appartient à un seul cluster ; Context child ne quitte pas parent ; nonmembres inchangés | U, P2 |
| R6-026 | Naming ProtectedSavingNode ne verrouille pas adjustable60 ; protected et zero-library rules fidèles | U + S + B, P1 |
| R6-027 | Cluster fermé ne monte pas toutes les cards/éditeurs cachés ; pas de duplication permanente/defs explosion | SSR structure, P2 |
| R6-028 | Keys et parent-page/cluster : aucun remount de source pendant drag ; focus stable resize/birth/dissolve | B, P2/P4 |
| R6-029 | Move satellite conserve selectionId/sourceSocket et prix/funding/journey/quote/needOccurrence ; child reparent valide | S + B, P3 |
| R6-030 | Hover late response/digest invalidation/endDrag ; HUD conserve vrai modèle pending ; Apply disabled | U + S + B, P3/P4 |
| R6-031 | Registre terminal unique, fallback volontaire, iconKey legacy, quatre scales mêmes assets | U + B, P0 |
| R6-032 | Palette 26 options Soirée/19 Week-end conservées ; template/component homonymes non fusionnés | U + B, P3 |
| R6-033 | Desktop dense/sparse/selected/open, pagination/inert/ResizeObserver stables ; layout global hors Composer inchangé | B, P4 |
| R6-034 | Aucune nouvelle readWorld/fetch par node, pas de DTO/world/catalogue dupliqués | Source/structure + S, P1/P2 |
| R6-035 | Scene de présentation ne force pas readiness économique ; scénarios Apply utilisent modèle owner réel | S + B, P1/P2 |
| R6-036 | Seuil FOOD proposé ≥3/≤2 et présence des cinq controls demandés ; count = membres | U + B, P2 |

Ne pas ajouter des tests miroir du simple CSS ; les captures/protocoles doivent protéger de vrais états, destinations, frontières et accès, avec référence et taille desktop explicitement consignées.

## 39. Risks

| Risk | Probability | Impact | Phase | Mitigation |
|---|---|---|---|---|
| Monolithic card/Shell à quatre types + cluster + finance | HIGH | HIGH | P1–P4 | Adapter pur + frame + facades ; handlers conservés, déplacements isolés |
| Duplicated icon registry / assets incohérents | MEDIUM | MEDIUM | P0 | Extraire le terminal actuel, conserver facade ; Builder indépendant |
| UI recalculating money / cluster total faux | HIGH | CRITICAL | P2/P4 | Aucun total cluster UI ; projection/gauges owner ; null/sourceRefs conservés |
| Unstable React keys | MEDIUM | HIGH | P1/P2 | targetRef/contextId/selectionId, id visuel cluster stable ; jamais label/index enfant |
| Cluster causing remount / parent-page changé | HIGH | HIGH | P2/P4 | Freeze packing durant native grab, focus map, test browser ; key seule insuffisante |
| Drag handlers tied to current DOM shape | HIGH | HIGH | P1/P3 | Conserver data attrs/cibles/bubbling/source refs, tester A–E avant retirer anciens wrappers |
| Layout shifting / SSR puis ResizeObserver | HIGH | MEDIUM | P4 | Mesure parent stable, gate viewport hydraté, preserve drag source, focuspage déterministe |
| Saving treated as normal card / adjustable verrouillé | MEDIUM | HIGH | P1/P3 | Mapper mode réel, gauge serveur, zéro invitation/protection séparés |
| Context vs cluster confusion | HIGH | CRITICAL | P1/P2 | Union source refs, aucun ID métier cluster, children Context restent sous leur parent |
| Unnecessary DTO growth | MEDIUM | HIGH | P1/P2 | Adapter local réutilise modèles ; aucun catalogue/world/copied projection dans node transport |
| All cluster children mounted permanently | HIGH | HIGH | P2 | Overlay à la demande ; SSR structural guard ; pas double représentation interactive |
| Hidden editors mounted eagerly | MEDIUM | HIGH | P1/P2 | Dialogue/form unique actuel conservé ; pas d'éditeur par asset/node ; forms inline contrôlés |
| UNKNOWN ou coût/Bank/funding aplatis par formatter | MEDIUM | HIGH | P1/P4 | Même sources/formatters et null ; champs économiques distincts |
| Capacité supprimée avec socket invisible | HIGH | HIGH | P3 | Palette complète/select/details/keyboard ; limite visibility ≠ limite métier |
| Side effects gate/Compare/history modifiés lors d'extraction | MEDIUM | HIGH | P1/P4 | Conserver ResponseGate/finishComparison ; tests restore/keep/late-response |
| Hardcoded prénoms/fallbacks utilisés comme métier | MEDIUM | MEDIUM | P1/P2 | Clés exactes, labels display uniquement ; whitelist explicite et scope UUID conservé |
| Nouvelle art direction sans TARGET | MEDIUM | MEDIUM | P0 | OQ-01, nommer référence réellement disponible ; pas de certification d'image absente |
| Réouverture performance/back-end non autorisée | LOW | HIGH | Toutes | Respect §30 et checkpoint ; aucun profiling/snapshot/SQL nouveau dans R6 visuel |

## 40. Open questions

**OPEN_QUESTIONS_COUNT = 1. BLOCKING_OPEN_QUESTIONS_COUNT = 0.**

| ID | Question / preuve absente | Blocking? | Décision de travail / conséquence |
|---|---|---|---|
| OQ-01 | Existe-t-il hors dépôt un mockup TARGET ou brief R6 canonique, et son chemin/URL ? Aucun trouvé ; R5 le signalait déjà. | NO pour audit/plan et démarrage cadré P0 ; YES uniquement pour certifier une fidélité à ce mockup | Mission utilisateur = cible textuelle, tokens/codes R5 = baseline. Ne pas redéfinir l'art direction dans le préflight ; P0 consigne sa référence et n'annonce pas de fidélité à une image absente. |

Autres points résolus par ce plan : FOOD adopte un seuil de présentation proposé 3/2 ; Sourcils peut appartenir à la whitelist Beauté ; le cluster n'affiche aucun total financier local ; Saving conserve son mode réel ; aucune dépendance domaine pour les quatre nodes ; T7/annual saving/calendar/mobile/performance restent hors R6. Ces choix n'introduisent pas de blocker métier caché.

## 41. Machine-readable handoff

Les readiness ci-dessous signifient **plan fichier par fichier prêt**, pas phase implémentée. Tous les nouveaux chemins désignent la proposition future ; le HEAD audité reste celui du code de départ.

~~~ini
R6_PREFLIGHT_STATUS = PASS
HEAD_AUDITED = 3490114c4f2914cd97e1d0cb2e44d0a1c208c4a7
PRODUCT_CODE_CHANGED = NO
UI_CODE_CHANGED = NO
TEST_CODE_CHANGED = NO
DB_MIGRATION_CREATED = NO
R6_STARTED = NO

CURRENT_COMPOSER_ENTRYPOINT = src/app/mois-a-venir/composer/page.tsx::ComposerPage
CURRENT_BOARD_COMPONENT = src/app/mois-a-venir/composer/composer-board.tsx::ComposerBoard + board-carousel.tsx::BoardCarousel
CURRENT_CARD_COMPONENT = src/app/mois-a-venir/composer/composer-card.tsx::ComposerCard
CURRENT_LIBRARY_COMPONENT = src/app/mois-a-venir/composer/composer-library.tsx::ComposerLibrary
CURRENT_CONTEXT_COMPONENT = src/app/mois-a-venir/composer/context-card.tsx::ContextCard
CURRENT_SATELLITE_COMPONENT = src/app/mois-a-venir/composer/context-socket.tsx::ContextSocket -> atomic-popover.tsx::AtomicPopover; no standalone
CURRENT_SOCKET_COMPONENT = src/app/mois-a-venir/composer/context-socket.tsx::ContextSocket
CURRENT_EQUIPMENT_COMPONENT = src/app/mois-a-venir/composer/context-palette.tsx::ContextPalette
CURRENT_DND_SYSTEM = native HTML5 + ComposerInteractionContext + Shell.place/equip + preparedDrop + server resolveComposerDrop
CURRENT_SAVING_COMPONENT = src/app/mois-a-venir/composer/composer-card.tsx::ComposerCard variant SAVINGS
CURRENT_HUD_COMPONENT = src/app/mois-a-venir/composer/composer-cockpit.tsx::ComposerCockpit
CURRENT_COMPARE_COMPONENT = src/app/mois-a-venir/composer/composer-shell.tsx::compare/header + comparison.ts::finishComparison

PRESENTATION_ADAPTER_RECOMMENDED = YES
PRESENTATION_ADAPTER_LOCATION = src/app/mois-a-venir/composer/presentation/adapter.ts
PRESENTATION_ADAPTER_SERVER_OR_CLIENT = CLIENT_PURE
PRESENTATION_ADAPTER_INPUT = Readonly<ComposerUiModel>
PRESENTATION_ADAPTER_OUTPUT = readonly ComposerPresentationNode[]
CLAY_V2_REGISTRY_LOCATION = src/app/mois-a-venir/composer/planner-icons/icon-registry.ts
VISUAL_CLUSTER_PRESENTATION_ONLY = YES
BEAUTY_CLUSTER_FEASIBLE = YES
FOOD_CLUSTER_FEASIBLE = YES
CLUSTER_FINANCIAL_TOTAL_BY_UI_SUM = NO
BEAUTY_BIRTH_MIN = 3
BEAUTY_DISSOLVE_MAX = 2
FOOD_BIRTH_MIN_PROPOSED = 3
FOOD_DISSOLVE_MAX_PROPOSED = 2
REST_EMPTY_SOCKETS_TARGET = 0
SELECTED_EMPTY_USEFUL_SOCKETS_MAX = 2

R6_DO_NOT_TOUCH_DEFINED = YES
R6_P0_READY = YES
R6_P1_READY = YES
R6_P2_READY = YES
R6_P3_READY = YES
R6_P4_READY = YES
VALIDATION_FIXTURE = scripts/fixtures/planner-visual-fidelity.mjs::visualMonth
VALIDATION_ROUTE = http://127.0.0.1:3108/?scenario=VISUAL
TESTS_EXECUTED = 7 existing suites
TESTS_STATUS = PASS
BROWSER_CERTIFICATION_THIS_PASS = NOT_RUN
PERFORMANCE_CAMPAIGN_THIS_PASS = NO
BLOCKERS = []
OPEN_QUESTIONS = [OQ-01: external canonical R6 TARGET path/URL]
OPEN_QUESTIONS_COUNT = 1
BLOCKING_OPEN_QUESTIONS_COUNT = 0
NEXT_STEP = R6_P0_ART_DIRECTION
~~~
