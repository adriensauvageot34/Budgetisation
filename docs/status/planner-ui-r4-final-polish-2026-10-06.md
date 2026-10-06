# Planner UI R4 — polish final desktop

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `6e831766c23e67f5858ecef0bb92e483f7c28731` |
| HEAD_AFTER | Commit unique contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-ui-r4-final-polish-2026-10-06.md` |
| Branche | `main` |
| PLANNER_UI_REFORGE_READY | **YES** |
| Migration / reset | Aucune / aucun |
| Écritures métier Supabase / RPC distante | **0 / 0** |
| Déploiement / push | Non exécutés |

Le SHA final exact est également enregistré dans le fichier local
`outputs/planner-ui-r4/certification.json` du workspace de cette conversation.
La référence ci-dessus évite un SHA autoréférentiel dans le commit.

## Changements

Le Board utilise désormais des plateaux de plusieurs cartes, ordonnés de façon
déterministe à partir du read-model. La taille disponible est mesurée par
ResizeObserver. Les Contexts avec davantage de sockets disposent de deux
colonnes ; les autres utilisent une colonne. À 1920×1080 les contrôles simples
peuvent occuper trois rangées. À petite hauteur le nombre de cartes par plateau
diminue. Un scroll local reste disponible pour un contenu exceptionnellement
haut, sans scroll de page.

La navigation propose précédent/suivant, points de pagination et
ArrowLeft/ArrowRight/Home/End. Pendant un drag natif, rester 600 ms au bord
change un seul plateau ; quitter puis revenir au bord permet d’avancer encore.
Les plateaux restent montés pour préserver la source du drag ; les plateaux
inactifs sont inert et exclus de l’accessibilité. Aucune page ou dimension
n’entre dans le semantic state ou la preuve Apply.

La palette réserve 104 px et la navigation 32 px. Sélection, ouverture d’un
popover et hover n’altèrent pas les dimensions du Board ou du HUD. Les montants
sont tabulaires. Les cartes gardent icône, titre, montant/occurrences et états ;
les historiques, repères, presets et explications passent dans les détails.
Un premier Escape ferme le popover, le suivant désélectionne. Le clic sur le
fond du Board désélectionne également.

Les cagnottes protégées restent verrouillées. Les allocations ajustables
utilisent un champ inline avec preview et validation par le service existant,
puis Undo/Redo. Une réservation ajustable explicitement à zéro et sans décision
Plan est disponible dans la Library : clic ou drag ouvre l’éditeur C3 existant,
sans montant automatique ni mutation au drop. Après validation elle rejoint le
Board ; Undo la remet dans la Library.

Compare affiche VARIANTE, le Plan actuel et la projection temporaire. Apply
est absent pendant la comparaison. Quitter restaure le snapshot ; garder la
variante la remet dans le brouillon normal, qui doit ensuite être appliqué.
L’assistant reste secondaire et n’apparaît pas lorsqu’aucun candidat utile
n’est publié. Chaque impact vient d’une recompilation serveur.

Tous les objets métier passent par PlannerIcon/ClayFrame, y compris le
fallback. Lucide reste réservé aux actions et statuts. Les SVG sont memoized ;
aucun listener de déplacement ne recalcule les cartes à chaque pixel. Les
timers et observers sont nettoyés. Reduced-motion supprime les transitions.

La revue visuelle a aussi corrigé un sélecteur de popover trop large :
`.atomicPopover>header` ne modifie plus l’en-tête du Context enfant. Son titre
et ses actions restent lisibles et son éditeur restitue le focus au satellite.

## Fichiers principaux

- `inventory-layout.ts`, `board-carousel.tsx` : packing, navigation et dwell.
- `composer-board.tsx`, `composer-card.tsx`, `composer-shell.tsx`, `composer-library.tsx` : densité, focus, allocations, Compare.
- `composer.module.css` : matières, dimensions fixes, typographie et couches.
- `planner-icons/planner-icon.tsx` et `planner-icons/DESIGN_TOKENS.md` : registre Clay et tokens documentés.
- `composer-presentation.ts`, `composer-ui-contract.ts` : metadata de présentation des réservations disponibles.
- `check-phase2-planner-final-polish.mjs`, `smoke-phase2-planner-final-polish.mjs` : oracles et gestes natifs R4.
- `planner-browser-inventory.mjs` : navigation des tests C8/R3 via les vrais contrôles du carousel et des popovers.

## Certification

| Vérification | Résultat |
| --- | --- |
| C0 contrats / persistence SQL | 7 / 9 groupes PASS ; PGlite isolé |
| C1–C7 | Toutes les gates rejouées PASS |
| C8 / R1 server | 35 groupes PASS |
| C8 / R1 / R2 navigateur | 37 contrôles PASS ; Preview, Apply, reload, deuxième Revision |
| R2 UI | 14 groupes PASS |
| R3 server / navigateur | 22 / 22 contrôles PASS |
| R4 core | 19 contrôles PASS |
| R4 navigateur | 17 contrôles PASS, couvrant 15 IDs R4 et 2 contrôles supplémentaires |
| R4 Context imbriqué après correction CSS | PASS à 1920×1080, 1440×900 et 1440×760 |
| Application réelle authentifiée | PASS aux quatre tailles ; 291 lectures métier, 0 écriture, 0 RPC |
| Régressions V2 concernées | 28 suites PASS |
| TypeScript --noEmit | PASS |
| Next.js build final avec TypeScript | PASS |
| Revue React / accessibilité / nettoyage des effets | PASS |
| git diff --check | PASS |

Le cumul des suites R4 couvre explicitement les **30 IDs R4-001…030** :

| Oracles | Invariant | Preuve |
| --- | --- | --- |
| R4-001–004 | Board unique, sans cockpit latéral, agenda ni barre de jours | R4 core + C8/R1 navigateur |
| R4-005–006 | HUD égal à PlanProjection ; aucune somme financière React | R4 core, recompilation indépendante + C8 |
| R4-007 | Coordonnées, pagination et présentation absentes des requêtes Apply | Traces C8/R4 + garde de parsing C8 |
| R4-008–009 | Objets Clay ; Library issue des capabilities | R4 core + registre et tokens revus |
| R4-010–011 | Satellites clavier ; popovers dans le viewport | R4 navigateur + contrôle final Context imbriqué |
| R4-012–014 | Packing déterministe ; clavier ; dwell sans drop accidentel | R4 core + drag natif, digest inchangé, aucun appel métier |
| R4-015–016 | Cagnotte protégée ; Undo/Redo retrouvent les digests | R4 core + navigateur aux deux tailles |
| R4-017–018 | ONE_OF unique ; reparenting conserve l’identité | R4/C8/R3 server + gestes navigateur |
| R4-019–020 | Assistant propositionnel ; UNKNOWN reste inconnu | R4/C8/R3 + lecture réelle à valeurs inconnues |
| R4-021–023 | Compare zéro-write ; sortie exacte ; adoption recompilable | R4 core/navigateur + R3 navigateur |
| R4-024–026 | Apply/reload ; canaris historiques ; V2 sans Plan inchangée | R4 SQL isolé + C0–C8 + lecture réelle protégée |
| R4-027–030 | Apply à 1440×760 ; overflow absent ; aucun mobile ; reduced-motion | R4 réel/isolé, C8/R3, contrôle CSS |

Les fixtures utilisent les vrais composants Composer/AppShell, les vrais
services et le Compiler, avec providers synthétiques et SQL C0 dans PGlite.
Le réseau des providers y est interdit. R4 core applique une Revision locale
et vérifie sa relecture sans draft. Les fixtures C8 A/B créent deux Revisions
locales chacune ; les fixtures R3/R4 restent sans persistence. Les canaris
historiques restent intacts. Aucune écriture distante n’a été testée.

La revue réelle utilise Next en mode production avec les données Supabase du
foyer. Le garde fetch bloque tout POST/PATCH/PUT/DELETE métier et toute RPC,
y compris GET RPC. La page, les détails, le carousel et Compare ont été
inspectés sans Apply. Les sessions Auth habituelles ne sont pas des écritures
métier. Les captures réelles affichent honnêtement les sources inconnues.
Le premier chargement réel a dépassé le délai de navigation du navigateur,
puis la page a répondu et tous les contrôles visuels ont passé. Aucun problème
de calcul ou de Console n’a été constaté par cette revue.

### Mesures réelles de hauteur CSS

| Desktop | Workspace | Viewport Board | Plateaux | Cartes visibles | Overflow page | Apply visible |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| 1920×1080 | 972,61 px | 611,61 px | 1 | 14 | Aucun | Oui |
| 1728×900 | 792,61 px | 431,61 px | 2 | 12 | Aucun | Oui |
| 1440×900 | 792,61 px | 431,61 px | 2 | 8 | Aucun | Oui |
| 1440×760 | 652,61 px | 291,61 px | 4 | 4 | Aucun | Oui |

Le mois riche synthétique de 34 objets utilise respectivement 3, 5, 7 et 9
plateaux. Les cartes peuvent être parcourues au clavier et au drag ; le
semanticStateDigest reste identique lorsqu’on change seulement de plateau.

### Régressions V2

Suites rejouées : category-targets-choices, category-observed-history,
savings-allocations, month-decisions, month-decision-engine, month-narrative,
month-simplification, october-contract, benefit-wallets, forecast-temporal-mode,
temporal-forecast, planned-finance, planned-routes, planned-guards, planned-car,
planned-reliability, planned-reality, planned-expenses, planned-expenses-ui,
planned-domain, planned-builder, planned-calendar, planned-assets,
planned-server-contract, family-visits, intent-builder, restaurant-wizard,
project-wizard.

Cinq anciens tests nécessitaient une mise en cohérence de leurs fixtures avec
les owners déjà présents avant R4 : lecture du Plan lors du cutover, séparation
declared/observed, checkpoint SAFE/ASOF, éditeurs désormais dans le Centre,
wallet stock inconnu et plafond quotidien partagé, résolution TSX du harness.
Les calculs et writers de production n’ont pas été changés pour faire passer
ces tests. Les assertions financières sont conservées ou renforcées :
déclaration sans fait canonique, UNKNOWN non certifié, égalité des termes et
rejet des checkpoints non comparables. Les vérifications du markup V2 suivent
les points d’accès actuels au Centre. La clé Undo de test est synthétique et
limitée au processus ; aucun environnement n’a été modifié.

Les scripts live-only `check-phase2-month-forecast.mjs` et
`check-phase2-month-scenario.mjs` ne sont pas des suites de fixtures rejouées
ici : leur configuration et leurs attentes portent sur une publication réelle.
La lecture réelle du Composer et les suites C2/C7/C8/R4 couvrent l’intégration
forecast → deriveMonthScenario et la compatibilité V2.

## Captures et preuves

Racine locale :
`C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r4/`.

Captures réelles : `real-r4-1920x1080.png`, `real-r4-1728x900.png`,
`real-r4-1440x900.png`, `real-r4-1440x760.png`, page 2, détails et Compare.

Dans `r4/`, chacune à **1920×1080 et 1440×900** :
normal-board, night-selected, before-popover, before-drag, contextual-trash,
tram-replaces-uber, weekend-restaurant, protected-savings, savings-inline,
assistant, compare, page-2 et drag-page-dwell. La capture du Restaurant a été
remplacée par le rendu corrigé et recontrôlé ; la variante 1440×760 est fournie
également. Les captures ont été inspectées, notamment les titres imbriqués,
la palette, les couches popover/ghost/trash et les actions principales.

Preuves : `r4/r4-browser-verification.json`,
`r4/final-popover-verification.json`, `real-browser-verification.json`,
`real-readonly-network.jsonl`, `c8/browser-verification.json`,
`r3/r3-browser-verification.json`, logs core/V2 et `certification.json`.

## Limites héritées et travail différé

La capture réelle **« Plan prêt ✓ » est différée**. L’owner C7 publie actuellement
PARTIAL ou UNKNOWN, car aucun provider de low point cash daté complet n’est
branché. Le badge reste conditionné à COMPLETE + READY ; les captures
`plan-partial-honest-*.png` montrent la situation réelle. R4 n’a pas falsifié
cette valeur et n’ajoute pas ce provider métier.

La Library de cagnottes disponibles réutilise uniquement les réservations et
capabilities publiées. Un catalogue annuel absent du read-model n’a pas été
inventé ; l’application réelle de novembre ne publie actuellement aucune
cagnotte. Les trois états sont certifiés sur autorités synthétiques explicites.

Le chargement réel lent pourra faire l’objet d’une investigation séparée ;
R4 ne change pas le bootstrap ni ses requêtes. La refonte est locale :
aucun déploiement Vercel n’a été effectué.

## Owners backend explicitement non modifiés

Baseline, Compiler, PlanSlot/cost/constraint resolvers, FinancialAdapter,
deriveMonthScenario, projection C7, apply/repository/RPC C0, effective-month
owner, assistant, Mobility/Journey/pricing, Renewals/Needs, lecteurs
d’autorités, writers historiques V2, migrations et RLS sont inchangés.
La seule modification serveur est une metadata de présentation, dérivée des
capabilities existantes et extérieure à la preuve Apply.
