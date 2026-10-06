# Planner UI R2 — grammaire atomique

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `8578d1d5f6f26613ce053d3adf4b4e7739ecfaec` |
| HEAD_AFTER | Commit unique contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-ui-r2-atomic-grammar-2026-10-06.md` |
| Branche | `main` |
| PLANNER_UI_R2_ATOMIC_GRAMMAR | **PASS** |
| Migration / Supabase distante / RPC distante | Aucune / 0 écriture / 0 appel |
| Publication distante | Non exécutée dans R2 |

## Présentation livrée

Les Contexts composites possèdent un noyau et quatre pistes d'orbite CSS stables.
Before se place au nord, le moment principal à l'ouest, l'aller à l'est et le
repas au sud. Les autres sockets occupent des pistes déterministes ; les groupes
se développent dans la grille sans chevaucher les cartes voisines. Les pistes
réservent leur espace au repos et en focus : la sélection ne change pas les
coordonnées métier, ne déplace pas la mosaïque et ne persiste aucune position.

Les satellites représentent exactement `socket.currentItems`. Les sockets vides
apparaissent uniquement avec une permission publiée ; un socket répétable peut
conserver son bouton d'ajout après sélection. Les composants remplis sont des
perles contenant les glyphes Clay R1 de 30 px. Les suggestions ont un contour
violet pointillé et une étoile ; les éléments dérivés ont un maillon bleu ; les
inconnues ont un point ambre. Les libellés d'état sont accessibles dans les
tooltips, popovers et noms accessibles, sans badges de texte permanents.

Le titre, le noyau ou un satellite permettent de sélectionner le moment. Le
focus ajoute un contour violet et un fond lavande. La palette « Équiper » apparaît
uniquement pour le Context sélectionné et disparaît quand on quitte la sélection.
Ses groupes viennent des sockets serveur. Les options équipées, suggérées et
les alternatives ONE_OF possèdent leurs marqueurs. La bande se parcourt au
clavier ou par son scroll horizontal ; les options incompatibles sont absentes.
Le scroll local garde la carte sélectionnée visible avec une marge de 10 px à
1440×900. Le HUD et Apply restent fixes.

Un satellite ouvre un popover natif dans la couche supérieure du navigateur.
Son ancrage et ses limites sont calculés à partir du DOM, sans entrer dans le
draft. Resize et scroll actualisent cet ancrage. Entrée ouvre les détails,
Échap ferme et restitue le focus. Un éditeur ouvert depuis un popover imbriqué
revient à l'invocateur visible du noyau après fermeture du dialog. Modifier,
accepter et retirer utilisent les
opérations C8 existantes et leurs permissions. Un enfant conserve son propre
owner TRASH/reparent ; son identité n'est pas remplacée par un CLEAR_SOCKET.

Les cartes simples conservent leurs silhouettes. Les références Baseline et
les jauges de choix restent des repères, sans devenir des floors. Les occurrences
forment une pile de trois bulles au maximum, avec le surplus exact publié par le
serveur. Les liens de consommation viennent du manifest certifié : une bulle
reliée porte un maillon bleu, sans déduire une consommation depuis la position
graphique. Les cagnottes PROTECTED conservent leur cadenas et n'ont aucune action
de réduction/suppression. L'éditeur des allocations ajustables est compact et
utilise le preview serveur existant.

Les transitions de sélection durent 190 ms, celles des satellites 160 ms, les
hovers 120 ms et l'apparition de la palette 190 ms. Le mode reduced-motion coupe
transitions/animations ; vérification navigateur : `transitionDuration = 0s`,
`animationDuration = 0s`. Le scroll Library respecte également cette préférence.
La seule exception au garde C8-017 concerne `prefers-reduced-motion: reduce` ; les
media queries de viewport et les branches mobiles restent interdites.

## Frontières d'autorité

`composer-presentation.ts` publie des métadonnées visuelles à partir des
DropCapabilities et des choix déjà exposés. React ne connaît ni catalogue de
compatibilité, ni binding policy, ni règle ONE_OF métier. Les popovers affichent
les évaluations exactes : inconnue → « À préciser », suggestion → hors coût
jusqu'à acceptation. Ils ne totalisent aucun montant.

Les ajouts au DTO sont `presentation.sockets`, `choiceGauge` et
`occurrenceStack` ; ils restent hors `semanticState`, proof et Apply payload.
Les baselines, Compiler, Apply, projection, read-model métier,
`deriveMonthScenario()` et writers V2 ne sont pas modifiés.

### Données absentes, à garder explicites pour R3

La consommation d'occurrences est déjà exposable :
`occurrenceStack.links: { componentId, count }[]` est copié du
`financialAdapterInput.adapterManifest.baselineConsumptions`. Aucun champ de
consommation financière ne manque pour les bulles R2. Pour un futur clic vers le
moment consommateur, enrichir la présentation avec `contextOccurrenceId` et
`selectionId` joints par le serveur au composant existant ; ne pas les deviner
dans React.

Le DTO actuel ne fournit pas de coût habituel de Before avec preuve. Un futur
champ de présentation pourrait être `historicalReference: { unitAmount,
knowledge, sourceRefs, comparisonWindow } | null`, provenant d'un owner
d'observations comparable. R2 ne transforme pas un prix saisi dans le nouveau
Plan ou une ancienne assumption en habitude.

Les owners des cagnottes fournissent l'allocation mensuelle et un annualGoalRef,
sans solde ni montant cible annuel. La jauge reste donc comparée à la réservation
initiale du mois. Un futur owner devra fournir explicitement `{ goalRef,
targetAmount, currentBalance, balanceAsOf, sourceRefs }` avant d'afficher un
objectif annuel ou un solde. Aucun 420/800 €, participant ou total de soirée
illustratif n'a été injecté dans les données de production.

## Vérifications

| Suite | Résultat |
| --- | --- |
| `check-phase2-planner-atomic-ui.mjs` | 14 groupes PASS : R2-001…013 + consommation du manifest |
| `check-phase2-planner-composer.mjs` | 35 groupes C8/R1 PASS |
| `check-phase2-planner-headless.mjs` | 34 groupes C7 PASS |
| `check-phase2-planned-finance.mjs` | PASS |
| Category targets / savings allocations / month decisions V2 | PASS, suites dédiées |
| `check-phase2-planned-routes.mjs` | PASS |
| TypeScript `--noEmit` | PASS |
| Next.js build + TypeScript | PASS |
| Smoke navigateur C8/R1/R2 | 37 contrôles PASS, dont éditeur enfant et retour du focus |
| Revue React | Hooks, identités stables, actions accessibles, effets DOM nettoyés, aucun calcul financier client |
| `git diff --check` | PASS |

Le smoke utilise les vrais composants Composer et AppShell, les services,
Compiler et SQL C0 réels, avec autorités synthétiques et PGlite isolé. Les appels
prospectifs sont synthétiques et le réseau des providers est interdit. A/B ont
chacun deux révisions locales ; C/D/E/R ont zéro Plan et zéro Revision persistés.
Les canaris historiques sont intacts. Le scénario R vérifie suggestion, coût
inconnu, palette, clavier/Échap et cagnotte protégée avec zéro RPC.

Le parcours conserve Preview, Apply/reload, seconde Revision, stale guard,
Undo/Redo, assistant, DnD, reparenting, remplacement ONE_OF et annulation d'un
Context appliqué. Toutes les requêtes réellement observées ont
`uiPayloadFields = []`. Les contrôles dérivés non modifiables sont également
vérifiés par rendu DOM du contrat en lecture seule.

| Desktop | Hauteur CSS workspace | Hauteur scroll Board au repos | Largeur Board | Overflow page | Apply accessible |
| --- | ---: | ---: | ---: | --- | --- |
| 1920×1080 | 972,61 | 690,61 | 1584 | Aucun | Oui |
| 1728×900 | 792,61 | 510,61 | 1392 | Aucun | Oui |
| 1440×900 | 792,61 | 510,61 | 1104 | Aucun | Oui |
| 1440×760 | 652,61 | 370,61 | 1104 | Aucun | Oui |

Le HUD mesure 88 px de haut. Apply reste à 162,14 px du haut sur ces dimensions.
Les formulaires longs conservent leur action principale à 900 et 760 px de haut.
Les popovers sont contenus dans le viewport et les captures ont été inspectées.

## Captures et preuves locales

Répertoire : `C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r2/`.

- `board-rest.png` : Board au repos, palette absente.
- `night-selected.png` : Soirée, orbite et palette sélectionnées.
- `before-popover.png` : suggestion Before, détails ouverts au clavier.
- `protected-savings.png` : allocation protégée, cadenas et absence de writer.
- `weekend-composite.png` : séjour, hébergement, enfants et mobilité partagée.
- `composer-1920x1080.png`, `composer-1728x900.png`, `composer-1440x900.png`,
  `composer-1440x760.png` : smoke des tailles desktop.
- `browser-verification.json` : mesures, contrôles et canaris.
- `certification.json` : SHA final et résultats consolidés.

Les montants et labels de ces captures sont des fixtures synthétiques. Aucune
écriture métier distante ni publication Vercel n'a été effectuée.

La suite V2 category targets nécessite une clé de chiffrement Undo. Elle a été
rejouée avec une clé synthétique limitée au processus de test, sans charger de
secret réel ni modifier un fichier d'environnement.
