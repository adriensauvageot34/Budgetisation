# Composer R6 — certification finale de la présentation

## 1. Executive certification

**R6_FINAL_CERTIFICATION_STATUS = PASS.** Le verdict humain fourni pour cette mission est `R6_PRODUCT_UX = PASS` et `R6_MOCKUP_FIDELITY = PASS_WITH_VISUAL_DEBT`. L'audit du HEAD R6, les contrôles ciblés et le dernier smoke Chrome sont cohérents avec ce verdict. L'architecture de présentation est **LOCKED** et la phase UI R6 peut se terminer. Le Clay reste à **3/5**, dette artistique explicite et non bloquante ; Bowling, libellé Saving et Δ Compare sont des gaps de données/contrats. Aucun P4.6, correctif Kernel, chantier de performance ou T0 n'est lancé par cette certification.

Le périmètre certifié est le Composer sur ses fixtures synthétiques et son build, avec un examen visuel des captures finales. Les parcours authentifiés distants ne sont pas requalifiés par ce document ; les commandes et invariants métier restent couverts par leurs suites existantes.

## 2. Git state

- Dépôt : `Budgetisation`, branche `main`.
- HEAD attendu et constaté au départ : `03175b861233b223665853967928b8df78c04839` (`feat(composer): lock R6 visual composition`).
- Worktree propre au départ ; aucun reset ni changement de branche.
- Cette certification ajoute uniquement ce rapport et le backlog associé. Aucun fichier React, domaine, serveur, DTO, Supabase ou migration n'est modifié.
- Commit documentaire : `docs(composer): certify R6 presentation architecture`. Le hash final est donné par `git log` après publication.

## 3. R6 history P0→P4.5

| Étape | Acquis vérifié dans le rapport de phase |
|---|---|
| P0 | Registre d'icônes Clay, identité visuelle stable, premiers volumes, états simples conservés. |
| P1/P2 | Projection `ComposerUiModel → presentation nodes`, clusters BEAUTY/FOOD à partir de trois enfants, aucun total financier fabriqué. |
| P3 | Contexts composés, sockets et palette, DnD natif, corbeille, refus protégé, alternatives clavier. |
| P3.5 | Déduplication visuelle de palette sans perte de route, un CTA vide au plus sur Soirée/Week-end sélectionnés, dock dans le flux. |
| P4 | Décision utilisateur de remplacer les orbites dispersées par une equipment row alignée en bas, silhouettes Context/Cluster distinctes, HUD et Compare apaisés. |
| P4.5 | Densité SPARSE/NORMAL/RICH, affinités sémantiques et skyline déterministe, mémoire spatiale/transitions, scénario réel 3→2→Undo→Redo. |

Le brief canonique V3 a été relu. Son dessin orbital initial est supplanté par la décision ultérieure et explicite de conserver la rangée d'équipements en bas. Le résultat final respecte cette décision.

## 4. Presentation architecture

```text
ComposerUiModel publié
  → presentation/adapter.ts (projection pure)
  → AtomicNode / VisualClusterNode
  → inventory-layout.ts (placement éphémère)
  → React ComposerCard / ContextCard / VisualClusterCard
  → commandes et preview/apply déjà publiées
```

Les nœuds simples et composites, les groupes visuels, la densité, les familles spatiales et la présentation Saving/protected sont des concepts UI. `VisualClusterNode.amount = null` ; les enfants conservent leurs identités et leurs montants propres. Aucun nœud ne devient une entité DB, une catégorie financière ou un owner métier. Le registre d'icônes reste l'unique résolution terminale des silhouettes.

## 5. Simple cards

Courses, Café, Coiffeur, Tabac/vape et les autres contrôles conservent valeur, référence habituelle, nombre d'occurrences, état inconnu et capacités publiées. Les cartes pauvres en contenu peuvent être plus compactes ; une carte riche garde sa place pour les informations utiles. `Budget à préciser` reste une valeur inconnue avec point ambre, jamais un zéro de substitution. Saving reste un objet vert distinct avec tirelire et jauge, sans protection automatique.

## 6. Composite contexts

Soirée, Week-end et les autres Contexts compatibles représentent **une chose avec plusieurs composants** : hero, titre/date, equipment row. `ContextCard` réutilise les sockets, identités, actions et coûts publiés. Soirée et Week-end ont **0 socket vide au repos** et **au plus 1 CTA vide principal à la sélection** ; les destinations compatibles restent accessibles pendant le drag et les autres options dans la palette. Aucun satellite orbital dispersé n'est rendu.

## 7. VisualClusters

BEAUTY et FOOD/RESTAURATION sont des regroupements de présentation. Ils apparaissent à `children.length >= 3` et se dissolvent à deux enfants. Les cinq enfants de chaque cluster dans `VISUAL` restent indépendants et ne figurent pas en double au premier niveau. L'overlay monte les vrais `ComposerCard`/`ContextCard` et leurs actions. Aucun total local ni commande métier `DELETE_CLUSTER` n'existe ; retirer un enfant passe par sa commande d'origine.

## 8. Equipment rows

L'ordre visuel des slots est stable. Les mini-cartes illustrées restent attachées au bas du parent ; elles exposent état, nom et interactions sans remettre des grands cercles dans les coins. Le scroll horizontal contrôlé préserve tous les composants quand la largeur manque. Masquer un socket vide au repos ne retire aucune capability publiée.

## 9. Palette

`equipmentGroups` part des options publiées ; `displayEquipmentGroups` ne fusionne visuellement que des identités d'assets explicitement connues. Chaque tile conserve toutes ses routes, dont Restaurant objet autonome/composant et Voiture aller/retour. Le smoke final retrouve **16 tiles**, **3 tiles Repas** et les choix de route corrects. Groupes, navigation clavier et défilement horizontal restent disponibles ; aucune capability n'est perdue.

## 10. DnD

Le système reste HTML5 natif avec `ComposerInteractionContext`, `preparedDrop`, `publishedDrop`, `resolveComposerDrop` et preview serveur ; aucune bibliothèque DnD n'a été ajoutée. Le smoke final a rejoué équipement par clic et drag, routes multiples, remplacement, corbeille, Undo/Redo et refus protégé sans écriture. Le retrait d'un enfant du cluster a déclenché la dissolution attendue. Les actions critiques ont une alternative clic/clavier ; le drag physique depuis un `<dialog>` modal n'a pas été requalifié au-delà des événements natifs et des alternatives déjà vérifiés en P3.

## 11. Semantic gravity

Les familles `DAILY`, `FOOD`, `MOMENTS`, `PERSONAL_CARE`, `SAVINGS`, `PURCHASES`, `HOME`, `OTHER` utilisent des identités stables, jamais le libellé libre. Le clustering précède le layout. Un packing CSS Grid à spans variables et recherche bornée des cellules libres produit des hauteurs décalées et rapproche les affinités sans titres de section. L'ordre et la pagination sont déterministes ; aucun canvas libre ni coordonnées enregistrées. À 1728×900, le board se lit comme **LIVING_INVENTORY**, malgré l'ossature Grid encore perceptible.

## 12. Content density

`SPARSE`, `NORMAL`, `RICH` sont dérivés uniquement du contenu déjà publié : montant/nombre, références, occurrences, composants équipés. Le modèle module la taille UI, pas les sommes. Les 30 gardes P4.5, dont la densité, le caractère déterministe et l'absence de coordonnées persistées, repassent.

## 13. Spatial memory

La page active mémorise temporairement les rectangles DOM. Les survivants se déplacent depuis leur ancienne zone ; un cluster naît près du centroïde de ses enfants et les enfants dissous réapparaissent près de l'ancienne capsule. Le board fige ses items et sa taille pendant un drag. Cette mémoire disparaît avec la page ; elle n'est pas un champ du brouillon.

## 14. Cluster transitions

Sur `DISSOLVE_BEAUTY`, le browser a constaté **3 enfants → retrait du Context beauté → 2 enfants uniques**, disparition du cluster et du dialogue, focus sur un bouton, puis retour du cluster par Annuler et nouvelle dissolution par Rétablir. Les deux enfants restent près de la zone initiale, sans doublon ni réouverture involontaire du dialogue. Les animations de transform/opacity sont courtes et coupées en mode mouvement réduit.

## 15. HUD

Une capsule horizontale porte `Fin de mois`, `Sans changements`, `Impact`, `Objectif`, `Marge`, avec le premier chiffre dominant. Le modèle publié est lu tel quel. Dans la fixture, la référence `889,00 €` demeure, et les autres valeurs indisponibles restent `—` ; `null` ne devient pas `0`. **HUD_VALUES_CHANGED = NO.**

## 16. Compare

Le Compare actuel montre `Actuel` et `VARIANTE`, et atténue les métriques secondaires. L'historique de variante et la sortie Compare ont repassé au navigateur. **COMPARE_SEMANTICS_CHANGED = NO.** Aucun Δ certifié n'est publié pour cette surface : l'UI ne le calcule pas et cette certification n'anticipe pas T7.

## 17. Library

La colonne reste dans la largeur cible et subordonnée au board. Recherche, raccourci `/`, navigation par flèches, Entrée, clic et source de drag restent opérants. Le dernier smoke confirme le focus du champ par `/`, le déplacement du focus entre assets et l'action par Entrée. La Library n'est pas une authority métier ; elle expose les assets et cibles du modèle publié.

## 18. Clay

Les icônes sont colorées, cohérentes entre Library, board, composants, palette et popovers, et reconnaissables pour les onze objets clés du test visuel, sous réserve du cas Bowling. Les gradients SVG restent légers, avec lumière haut-gauche, faces et ombres de contact. Le rendu demeure plus plat que les sculptures 2.5D du mockup : **CLAY_SCORE = 3/5**. Le verdict humain le classe **OPEN_NON_BLOCKING** ; une future passe artistique pourra améliorer ce seul aspect sans rouvrir les contrats R6.

## 19. Accessibility

Le contrôle visuel rapide des captures P4.5 à pleine taille ne révèle pas de contraste bloquant sur métadonnées secondaires, libellés d'équipement, badge personne, état inconnu ou catégories Library. Les libellés d'équipement restent petits, donc à surveiller lors d'un test utilisateur, sans anomalie critique observée. Chrome mesure un contour de focus de **3 px**. Recherche, navigation fléchée, fermeture Escape et retour focus des popovers/dialogs, alternatives au drag, corbeille protégée compréhensible sans animation et `aria` de base sont présents. L'émulation `prefers-reduced-motion: reduce` a constaté **0 animation de board en cours** après sélection.

## 20. Three viewports

| Taille | Résultat du smoke final | Preuve publiée P4.5 |
|---|---|---|
| 1920×1080 | 17 surfaces, 1 page, pas de clipping ni overflow document | `images/composer-r6-p45/r6-p45-board-1920x1080.png` |
| 1728×900 | 12 surfaces sur la première page au repos, famille et types lisibles ; sélection + dock sans recouvrement | `r6-p45-board-1728x900.png`, `r6-p45-soiree-selected.png` |
| 1440×900 | 9 surfaces sur la première page, pagination atteignable, deuxième page sans clipping | `r6-p45-board-1440x900.png` |

Le critère n'est pas de tout mettre sur la première page : les cartes restent entières et la navigation accessible. Aucun débordement horizontal du document n'a été mesuré.

## 21. Business isolation

Le diff depuis `8067d7624ed169a1c271f661f94cc171d0c8ed5f` contient uniquement `src/app/mois-a-venir/composer`, tests/fixtures et documentation R6 ; aucun changement dans `src/domain`, `src/server` ou `supabase`. La certification elle-même est exclusivement documentaire. IDs, capacités, mutations, montants et projection financière restent propriétaires de leurs couches existantes. **UI_FINANCIAL_RECOMPUTATION = NO ; BUSINESS_CODE_CHANGED_BY_CERTIFICATION = NO ; DTO_CHANGED = NO ; SERVER_OWNER_CHANGED = NO ; DB_MIGRATION_CREATED = NO.**

## 22. Structural performance

Contrôle structurel uniquement, sans campagne de mesure post-R6 : **NEW_SERVER_CALLS = 0 ; NEW_READWORLD_CALLS = 0**. Le packing est local et borné aux racines projetées ; un ResizeObserver suit le board. Les overlays sont conditionnels, les détails de popover ne montent qu'à l'ouverture, et les listeners de placement sont attachés à un popover ouvert puis retirés. Aucun N+1 réseau, stockage de layout, filtre SVG lourd ou nouveau provider DnD. Les petits `backdrop-filter` de dialogue ne sont pas des filtres d'icônes ni une campagne de performance.

## 23. Tests

Relancés sur le HEAD R6 attendu : `typecheck`, `build`, `check:composer-r6-p45` (30/30), `check:composer-r6-p4` (20/20), P3.5, P3, Presentation, Planner Contexts, Mobility, Planned Reality, Composer, Interactions, Visual Fidelity, Atomic UI et Final Polish : **PASS**. Les sorties détaillées des 13 suites ciblées sont conservées dans le dossier de travail de certification, hors dépôt. Le Planner Kernel n'a pas été relancé ni modifié : `KNOWN_BASELINE_FAILURE_STALE_FORECAST_ORACLE` est documenté depuis P0 et sera traité dans une mission séparée.

## 24. Browser smoke

Deux scripts Chrome synthétiques isolés de la documentation publiée ont repassé **7 scénarios de certification** et **9 scénarios de régression**, avec **0 erreur de page et 0 échec**. Ils couvrent board, Library et clavier, Soirée, Week-end, equipment row, palette, choix de route, clic/drag, remplacement, trash, protected refusal, Beauty/Food, dissolution, Annuler/Rétablir, Compare, focus, unknown, mouvement réduit et trois viewports. Les JSON de sortie sont conservés dans le dossier de travail local (`work/r6-final-smoke/` et `work/r6-final-regression/`) ; les 17 captures P4.5 commitées sont restées intactes.

## 25. Visual human gates

| Gate | Constat final |
|---|---|
| A — Reconnaître sans texte | Courses, Café, Coiffeur, Tabac/vape, Saving, Soirée, Week-end, Beauté, Restauration, Cadeau et Visite famille ont des silhouettes distinctes. Bowling exact exige une identité publiée. |
| B — Comprendre en 3 secondes | Carte simple, Context équipé, Cluster contenant des objets, Saving vert, sélection violette et ceinture Équiper se différencient. |
| C — Inventaire vivant | Tailles, teintes, capsules, composition et décalages du packing donnent `BOARD_FEELS_LIKE = LIVING_INVENTORY`, conformément au verdict humain fourni. |
| D — Bruit des contrôles | Actions secondaires majoritairement au hover, focus ou selected ; sockets vides absents au repos. |

Le mockup conserve une supériorité artistique nette sur le Clay. Cela est enregistré comme dette et ne contredit pas le PASS produit donné par l'audit humain.

## 26. Non-blocking visual debt

**R6-VISUAL-DEBT-01 — Upgrade Clay illustrations toward true 2.5D.** `OPEN_NON_BLOCKING`, priorité basse, score actuel 3/5. Les objets sont reconnaissables et l'identité visuelle stable, avec accessibilité et structure de performance conservées. Cette dette ne bloque ni Composer, ni ses interactions, ni la sortie R6, ni T0–T8. Voir le backlog ciblé.

## 27. Data gaps

- **R6-DATA-GAP-01 — Stable Bowling visual identity.** Le Context publie `activity`, sans subtype stable. Une future authority amont doit publier la clé ; aucun matching sur `label.includes("Bowling")`.
- **R6-DATA-GAP-02 — Trusted Saving display label.** La fixture publie `Synthetic adjustable saving` sans `displayLabel` fiable. L'UI conserve ce libellé plutôt que d'en fabriquer un.
- **R6-DATA-GAP-03 — Certified Compare delta.** `Actuel`/`Variante` existent, mais aucun Δ certifié n'est publié. Seul un owner métier approprié pourrait le fournir si la décision produit le demande.

Ces trois sujets sont des gaps de données/contrats, pas des bugs à contourner dans React.

## 28. R6_DO_NOT_REOPEN

**LOCKED — à ne pas rouvrir sans nouvelle exigence produit :** architecture des presentation nodes ; sémantique VisualCluster et seuil `>= 3` ; rangée d'équipements des Contexts ; visibilité des sockets ; regroupement et déduplication visuelle de palette ; DnD HTML5 natif, corbeille et refus protégé ; modèle de densité ; gravité sémantique et mémoire spatiale ; structure de présentation HUD et Compare. Une amélioration future des illustrations Clay ou une publication de données manquantes ne justifie pas une refonte générale de ces systèmes.

## 29. Next roadmap step

**RECOVER_MISSING_PRE_R6_CHECKPOINT_AND_RECERTIFY_KERNEL**, dans une mission distincte. Ne pas réparer le Kernel ici ; ne pas lancer `POST_R6_INTERACTION_PERF`, T0, Plan → Réel ou P4.6. La phase UI R6 s'arrête avec ce commit documentaire.

## 30. Machine-readable handoff

```text
R6_FINAL_CERTIFICATION_STATUS=PASS
REPO_ROOT=Budgetisation
BRANCH=main
HEAD_BEFORE=03175b861233b223665853967928b8df78c04839
HEAD_AFTER=see git log after certification commit
WORKTREE_CLEAN_AT_START=YES
FINAL_WORKTREE_CLEAN=see git status after publication
R6_PRODUCT_UX=PASS
R6_PRESENTATION_ARCHITECTURE=LOCKED
R6_MOCKUP_FIDELITY=PASS_WITH_VISUAL_DEBT
R6_VISUAL_DEBT_BLOCKING=NO
R6_READY_TO_EXIT_UI_PHASE=YES
SIMPLE_CARDS=PASS
COMPOSITE_CONTEXTS=PASS
VISUAL_CLUSTERS=PASS presentation-only threshold >=3
EQUIPMENT_ROWS=PASS
PALETTE=PASS all published routes retained
DND=PASS native HTML5
TRASH=PASS contextual
PROTECTED_REFUSAL=PASS zero write
SEMANTIC_GRAVITY=PASS deterministic family packing
CONTENT_DENSITY=PASS SPARSE/NORMAL/RICH presentation-only
SPATIAL_MEMORY=PASS transient DOM only
CLUSTER_BIRTH=PASS
CLUSTER_DISSOLVE=PASS 3→2→Undo→Redo browser
HUD=PASS values unchanged and null preserved
COMPARE=PASS semantics unchanged; certified delta absent
LIBRARY=PASS search/slash/arrows/Enter/click/drag
CLAY_SCORE=3/5
CLAY_DEBT_RECORDED=R6-VISUAL-DEBT-01 NON_BLOCKING
BOWLING_DATA_GAP_RECORDED=R6-DATA-GAP-01
SAVING_LABEL_GAP_RECORDED=R6-DATA-GAP-02
COMPARE_DELTA_GAP_RECORDED=R6-DATA-GAP-03
ACCESSIBILITY=PASS scripted paths; human quick contrast check no blocker
KEYBOARD=PASS
FOCUS=PASS 3px visible and return paths
REDUCED_MOTION=PASS zero running board animations in emulation
CONTRAST_HUMAN_CHECK=PASS no blocking issue seen at reference size
VIEWPORT_1920=PASS 17 surfaces one page
VIEWPORT_1728=PASS reference scene and dock
VIEWPORT_1440=PASS pagination and no clipping
BUSINESS_CODE_CHANGED=NO
DTO_CHANGED=NO
SERVER_OWNER_CHANGED=NO
DB_MIGRATION_CREATED=NO
UI_FINANCIAL_RECOMPUTATION=NO
NEW_SERVER_CALLS=0
NEW_READWORLD_CALLS=0
PLANNER_KERNEL=KNOWN_BASELINE_FAILURE_STALE_FORECAST_ORACLE (not run in certification)
PLANNER_CONTEXTS=PASS
PLANNER_MOBILITY=PASS
PLANNED_REALITY=PASS
PLANNER_COMPOSER=PASS
PLANNER_INTERACTIONS=PASS
VISUAL_FIDELITY=PASS
ATOMIC_UI=PASS
FINAL_POLISH=PASS
R6_PRESENTATION=PASS
R6_P3=PASS
R6_P35=PASS
R6_P4=PASS
R6_P45=PASS 30/30
TYPECHECK=PASS
BUILD=PASS
BROWSER_SMOKE=PASS 7 final + 9 regression, zero page errors
BOARD_FEELS_LIKE=LIVING_INVENTORY
CERTIFICATION_DOC=docs/status/composer-r6-final-certification-2026-10-08.md
BACKLOG_DOC=docs/status/composer-r6-post-certification-backlog-2026-10-08.md
COMMIT_CREATED=YES after publication
COMMIT_HASH=see git log after publication
NEXT_RECOMMENDED_STEP=RECOVER_MISSING_PRE_R6_CHECKPOINT_AND_RECERTIFY_KERNEL
```
