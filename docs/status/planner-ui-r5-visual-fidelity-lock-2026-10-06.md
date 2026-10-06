# R5 — Visual fidelity lock et affinage UX

Date : 6 octobre 2026. Périmètre : Composer desktop, présentation et gestes existants.

## État de livraison

Les changements sont dans le working tree de `main`, sans commit, push ni déploiement.

```ini
HEAD_BEFORE = 4a42dbd82bc62994eed7ed6173b8633d55225425
HEAD_AFTER = 4a42dbd82bc62994eed7ed6173b8633d55225425
PLANNER_UI_R5_VISUAL_FIDELITY = PENDING_TARGET_COMPARISON
```

La pièce jointe R5 contient le texte de mission, mais aucune des images annoncées. Une recherche des images dans les attachments, puis des noms CURRENT/TARGET/Composer dans Downloads, n'a pas retrouvé TARGET. Une demande de chemins a été adressée à l'utilisateur pendant le travail. La comparaison obligatoire CURRENT / TARGET / NEW ne peut donc pas être certifiée. Aucune image de substitution ne prétend être TARGET.

## Changements

- La route Composer utilise un shell immersif, avec sortie vers le Centre de contrôle. Les autres routes gardent leur navigation.
- Header unique de 80 px, HUD blanc compact, cinq métriques issues des owners serveur, chiffres tabulaires et dimensions stables. Unknown reste `—`.
- Board transparent, sans titre secondaire ni toolbar administrative. La palette n'existe que lorsqu'un Context est sélectionné et apparaît en overlay.
- Library de 284 px, groupes humains issus des sections serveur, grille à deux colonnes, asset entier draggable. Quick-find `/`, accents ignorés, Enter/clic/drag ; navigation par flèches avec un seul arrêt Tab pour la grille.
- Packing visuel déterministe par silhouettes. Cartes SIMPLE 196 px, HABIT 212 px, COMPOSITE 288 px, SAVINGS 236 px ; hauteurs 154/218 px. Maximum trois rangées par page. Aucun agrandissement des cartes dans un mois presque vide.
- Pagination affichée uniquement en débordement. Mesure du Board stable avant soustraction des 30 px de pagination, sans boucle de ResizeObserver. Dwell conservé à 600 ms.
- Le viewport utilise `overflow: clip` : le drag natif ne peut plus faire défiler horizontalement les pages en contournant le transform contrôlé du carousel.
- Choix de sélection **A** : la sélection et sa palette restent actives lors d'un changement manuel de page. Aucun changement de draft.
- Valeurs ajustables cliquables ; édition inline seulement lorsque la capability publie SET_SLOT_AMOUNT ou SET_SAVINGS_ALLOCATION. Les valeurs inconnues, dont Repas travail Manon, ne deviennent jamais zéro.
- Actions secondaires visibles au hover/focus, puces de personnes, références historiques dans les détails, statut inconnu en micro-texte.
- Les zones transparentes des orbites n'interceptent plus les actions du Context ; les sockets restent interactifs. Le parcours C8 du Context équipé vérifie le menu, le retrait appliqué et l'annulation conservée.
- Le choix « Déplacer » d'un enfant ferme son popover tout en conservant la source sélectionnée, afin que le clic suivant puisse atteindre le socket de destination. Même opération de reparenting serveur, même identité de Context.
- Matières Clay SVG partagées : gradients mats, lumière haut gauche, ombres de contact. Tailles CARD 52 / SATELLITE 30 / PALETTE 34 / LIBRARY 32 px. Icônes memoized et identifiants SVG uniques.
- Raison d'Apply désactivé accessible au hover/focus, avec action vers les éléments unresolved. Statuts explicites Brouillon / Appliqué, révision N / Nouvelle modification.
- Ctrl/Cmd+Z et Ctrl/Cmd+Shift+Z, focus visible, mouvement réduit. Protégée apparaît dès le drag natif, avant toute entrée dans Trash. Dépense négative en ambre ; erreur/suppression en rouge.
- Prévisualisation serveur en attente : `Calcul…`, conservation de la dernière valeur autoritaire ; aucune valeur provisoire inventée. Suggestions accessibles depuis le menu secondaire et rendues dans la main existante. Compare conserve ses owners.

Les groupes récents/fréquents, favoris et barre de densité optionnels sont reportés : aucune métadonnée fiable de fréquence ou préférence n'est fournie par le contrat actuel. Aucun catalogue métier supplémentaire n'est créé pour les simuler.

## Mesures de la fixture dédiée

Fixture VISUAL : 25 objets racines synthétiques, plus enfants, compilés par les vrais owners C7. Courses, Tabac, repas travail, Coiffeur, Restaurants, Soirée, Vêtements, Week-end, Cadeau, visite famille, beauté, Bowling et cagnottes. Données exclusivement dans le host isolé.

| Viewport | Header | Library | Board utile | Objets visibles | 1re rangée | Rangées | Pages | Assets Library visibles |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1728×900 | 80 | 284 | 758 | 15 | 5 | 3 | 2 | 8 |
| 1920×1080 | 80 | 284 | 938 | 15 | 5 | 3 | 2 | 11 |
| 1440×900 | 80 | 284 | 758 | 12 | 4 | 3 | 3 | 8 |
| 1440×760 | 80 | 284 | 618 | 8 | 4 | 2 | 3 | 7 |

Les dimensions sont en pixels CSS. Carte SIMPLE mesurée : 196 px. Pas de scroll horizontal de page, pas de scroll vertical global, Apply visible aux quatre tailles. Les Contexts composites apparaissent dès la première page. SPARSE contient exactement trois objets de taille normale, sans pagination ; RICH teste le débordement et le dwell.

## Références visuelles

- [CURRENT synthétique capturé avant R5](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/CURRENT-1728x900.png).
- [CURRENT réel issu de R4](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r4/real-r4-1728x900.png).
- TARGET : non disponible, comparaison finale en attente.
- [NEW fixture 1728×900](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/r5/NEW-rest-1728x900.png).
- [NEW application réelle 1728×900](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/NEW-real-1728x900.png).

Inspection explicite CURRENT / NEW : suppression du shell administratif, de la grosse card HUD mauve, du double header Board et du pied de palette vide ; silhouettes plus compactes, Clay plus contrastés, densité et hiérarchie corrigées. Le CURRENT synthétique utilise la fixture RR antérieure (17 objets) et NEW la fixture dédiée VISUAL (25), ce n'est pas une comparaison de montants. Les captures réelles utilisent les données du mois, sans ajout d'objets. Aucune conclusion de ressemblance à TARGET n'est avancée.

## Captures demandées

Racine absolue : `C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/r5/`.

| Scénario | Fichier |
|---|---|
| Repos 1728×900 | NEW-rest-1728x900.png |
| Repos 1920×1080 | NEW-rest-1920x1080.png |
| 1440×900 | NEW-rest-1440x900.png |
| 1440×760 | NEW-rest-1440x760.png |
| Context sélectionné | NEW-context-selected.png |
| Équiper | NEW-equipment-palette.png |
| Satellite popover | NEW-satellite-popover.png |
| Focus unresolved | NEW-unresolved-focus.png |
| Apply désactivé et raison | NEW-apply-disabled-reason.png |
| Contrat visuel COMPLETE + READY | NEW-apply-ready-contract-only.png |
| Drag Library | NEW-drag-library.png |
| Drag satellite | NEW-drag-satellite.png |
| Trash | NEW-trash.png |
| Protégée | NEW-protected.png |
| Assistant | NEW-assistant.png |
| Compare | NEW-compare.png |
| Mois presque vide | NEW-sparse-month.png |
| Mois riche | NEW-rich-month.png |

La sélection d'un Context ouvre immédiatement sa palette : ces deux captures décrivent le même geste atomique. Captures supplémentaires : édition inline, attente serveur, sélection conservée après pagination, dwell natif, application/reload isolés et quatre tailles sur l'application réelle.

**Fixture Apply ready :** C7 ne publie pas actuellement COMPLETE pour ces autorités. Le DTO de présentation de test est explicitement marqué `ready-presentation-only`, conserve les montants du vrai Compiler et utilise un transport qui refuse toutes les opérations (`UI_CONTRACT_ONLY`). Elle teste uniquement la branche visuelle « Plan prêt ». Aucun Apply n'en découle. Les fixtures ordinaires ne modifient jamais la réponse du Compiler. Les états PARTIAL + READY_WITH_WARNINGS restent applicables selon le contrat C7 ; R5 n'ajoute pas une interdiction métier différente.

## Préservation des owners et sécurité des données

`git diff --quiet -- src/server src/domain supabase` retourne 0 : aucun fichier du moteur, contrat métier ou schéma modifié, y compris aucun nouveau fichier dans ces dossiers. `deriveMonthScenario()` inchangé. Aucun fichier de migration ajouté. Les dimensions, page, sélection visuelle et coordonnées restent hors semanticState et payload Apply. [Contrôle Git final](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/final-git-verification.json) : même HEAD, `main`, diff check PASS, aucun commit/push/déploiement R5.

Les tests de persistence/apply utilisent PGlite isolé et les fixtures synthétiques existantes ; ce n'est pas une instance Supabase locale. La RPC est testée dans cette base de test uniquement. Les canaris historiques sont vérifiés. Les previews et les gestes R3/R4/R5 n'ont créé aucune PlanRevision dans leurs scénarios sans Apply.

Le smoke réel utilise Next production local et Supabase existante, avec un garde fetch préchargé qui refuse les écritures REST/Storage et toute RPC. Authentification séparée ; aucune opération métier distante, aucun Apply distant, aucun reset. Résultat sur le dernier build : **559 lectures métier, zéro écriture métier, zéro RPC, zéro tentative bloquée**. Compare quitte exactement vers le digest précédent ; aucune erreur navigateur. Les preuves réseau ne contiennent que méthode/chemin/indicateurs, sans token ni query string. Captures et preuves réelles restent hors dépôt.

| Application réelle | Board utile | Objets visibles | Pages |
|---|---:|---:|---:|
| 1728×900 | 788 | 15 | 1 |
| 1920×1080 | 968 | 15 | 1 |
| 1440×900 | 758 | 12 | 2 |
| 1440×760 | 618 | 12 | 2 |

Header 80 px et Library 284 px aux quatre tailles ; aucun overflow de page, Apply visible. [Preuve finale réelle](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/real-browser-verification.json) et [journal réseau sans secrets](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/real-readonly-network.jsonl).

## Vérifications

Preuves locales :

- [42 suites C0–C8, R2–R5 et V2](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/tests/regressions.json).
- `check-phase2-planner-visual-fidelity.mjs` : 16 checks, dont 14 oracles R5, zéro RPC et zéro persistence.
- TypeScript `tsc --noEmit` : exit 0.
- Build Next final, après les corrections du débordement natif et du déplacement depuis un popover : exit 0 (compilation, TypeScript et génération terminés).
- [Smoke R5 final : 24 checks PASS](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/r5/r5-browser-verification.json), dont le nouvel oracle de débordement natif. Erreurs navigateur : aucune ; RPC et revisions : zéro pour tous ses scénarios. Les 18 captures demandées sont présentes. Le mois RICH montre 14 objets sur la première de trois pages à 1728×900.
- Smoke réel sur le build final : PASS, quatre viewports, zéro écriture métier et zéro RPC.
- [Smoke C8 : 38 checks PASS](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/c8/browser-verification.json), dont les parcours R1/R2, Apply/reload, deuxième révision, assistant, stale guard, ONE_OF et reparenting. R5-036 vérifie les libellés après chaque Apply. Quatre RPC dans PGlite isolé pour les deux scénarios appliqués ; zéro écriture distante et zéro écriture historique.
- [Smoke R3 : 22 checks PASS](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/r3/r3-browser-verification.json), hover serveur, coût du geste vérifié exactement contre la réponse serveur, drag/drop natif, ONE_OF, reparenting, protections, assistant, Compare, Undo/Redo. Zéro RPC, zéro persistence, zéro écriture historique.
- [Smoke R4 : 17 checks PASS](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/r4/r4-browser-verification.json), quatre tailles desktop, pagination clavier, dwell natif, sélection, ONE_OF, savings, assistant, Compare, projection partielle et mouvement réduit. Zéro RPC, zéro PlanRevision et zéro écriture historique dans ses six scénarios.

La suite category-targets-choices a d'abord échoué faute de clé de signature Undo dans l'environnement de test. Relance réussie avec une SUPABASE_SECRET_KEY synthétique, conformément à son owner existant. Aucun changement de l'environnement de production. Les premiers smokes concurrents ont rencontré des délais de connexion de l'outil navigateur Windows. L'avertissement beforeunload du brouillon empêchait aussi la navigation vers une autre fixture ; les scénarios utilisent désormais des documents dans des onglets distincts, sans désactiver cette protection. Les sélecteurs de smoke suivent les vrais menus, montants cliquables et zones de drop, sans enlever les assertions financières. Une inspection des PNG a révélé l'autoscroll horizontal natif du carousel ; correction CSS et oracle de scrollLeft nul ajoutés, puis reprise des smokes sur cette version.

L'oracle R4-020 vérifie le reste contre la réponse du serveur correspondant au digest restauré après Compare, et le compteur d'inconnues séparément : une projection PARTIAL peut légitimement avoir un reste connu. Une première adaptation supposait à tort que tout PARTIAL devait afficher `—` ; cette attente de test a été corrigée sans modifier le calcul ni la valeur affichée. La dernière réponse du journal pouvait aussi correspondre à la variante abandonnée : l'oracle sélectionne la projection ayant le même digest que le draft restauré. Les références nulles restent explicitement vérifiées par les suites dédiées R5 et C8.

Sur le dernier build, le premier `wait` navigateur a dépassé son délai de 25 secondes pendant le chargement des sources réelles. L'authentification avait réussi ; le chargement a ensuite abouti et le smoke complet est passé sans erreur navigateur. Le journal serveur a aussi enregistré `CanonicalReadError`, source `timing`, code Supabase/Postgres `57014` : « canceling statement due to statement timeout ». Ce résultat est conservé dans le [diagnostic serveur](C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r5/real-server-diagnostic.json). Les owners de chargement n'ont pas été modifiés : la mission R5 demande explicitement leur préservation. Le passage du smoke final ne garantit pas l'absence de ce timeout lors d'un nouveau chargement.

Couverture des 36 oracles :

| Vérification | Oracles R5 |
|---|---|
| Suite dédiée, SSR et vrais owners C7 | 001, 002, 003, 008, 012, 013, 015, 017, 020, 021, 022, 031, 032, 033 |
| Navigateur R5, mesures et gestes natifs | 003–007, 009–011, 014–016, 018–019, 023–030, 032, 035 |
| Apply, reload et seconde révision dans PGlite | 036 |
| Suites R2/R3 et smoke R3 : identité, ONE_OF, reparent, retrait, preview, assistant | 034 |

Le loading est testé avec une réponse serveur volontairement retardée dans le host de test. La valeur reste exactement celle précédant la requête ; après réponse elle égale la projection enregistrée côté serveur. Le digest du draft ne change pas pendant ce hover. Le scénario natif de protection vérifie aussi que le scrollLeft interne reste nul.

## Fichiers

Production : `src/components/layout/app-shell.tsx` ; `src/app/mois-a-venir/composer/{board-carousel,composer-board,composer-card,composer-cockpit,composer-library,composer-shell,context-card,context-palette}.tsx` ; `composer.module.css`, `inventory-layout.ts`, nouveau `presentation-label.ts` ; `planner-icons/{clay-frame,planner-icon}.tsx`, `DESIGN_TOKENS.md` et les 21 sculptures SVG dans `planner-icons/icons/`.

Tests : nouveaux `scripts/fixtures/planner-visual-fidelity.mjs`, `scripts/check-phase2-planner-visual-fidelity.mjs`, `scripts/smoke-phase2-planner-visual-fidelity.mjs` ; adaptations du host et entry fixture, de `planner-browser-inventory.mjs`, des smokes C8/R3/R4 ; deux commandes npm R5 dans `package.json`. Aucun changement de dépendance.

## Limite de certification

La validation finale reste conditionnée à l'image TARGET et à l'inspection côte à côte exigée par les sections 72/80 de la mission. Les résultats techniques et les mesures ne remplacent pas cette preuve visuelle.
