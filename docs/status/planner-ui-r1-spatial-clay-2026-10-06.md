# Planner UI R1 — atelier spatial et Clay doux

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `bf6905f3562dd0e359c9e8c8af8fbdf219d3ad88` |
| HEAD_AFTER | Commit unique contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-ui-r1-spatial-clay-2026-10-06.md` |
| BRANCH | `main` |
| Migration / Supabase distante / RPC distante | Aucune / 0 écriture / 0 appel |
| Publication distante | Non exécutée dans R1 |
| PLANNER_UI_R1_SPATIAL_CLAY | PASS |

## Présentation livrée

Le Composer possède deux colonnes : une Library de 264 px et une surface mensuelle
unifiée. Les anciennes sections Socle, Vie & envies, Contexts et Cagnottes ne
compartimentent plus le Board. Les objets suivent l'ordre stable du read-model
dans une mosaïque CSS ; il n'y a ni calendrier, ni agenda, ni canvas libre.

Le header présente le lien Centre de contrôle, le vrai mois, le statut du draft,
les compteurs serveur, un HUD financier horizontal, Undo/Redo et « Appliquer mon
mois ». Le HUD conserve les champs exacts de PlanProjection : fin de mois, impact,
objectif et marge. Les montants inconnus restent à préciser. Le détail financier,
le financement, le timing, le cash et les diagnostics restent accessibles dans
le dialog existant. Preview et assistant restent accessibles depuis le Board.

Les silhouettes SIMPLE, HABIT, COMPOSITE et SAVINGS proviennent des objets déjà
publiés. L'état non résolu ajoute un marqueur ambre et un libellé. Les contrôles
habituels peuvent afficher leur référence Baseline ; cette référence ne devient
pas un floor. Les cagnottes vivent dans la mosaïque. PROTECTED reçoit un cadenas
intégré et conserve ses restrictions.

« Ajouter un élément » ramène au même point d'entrée Library. Lorsqu'une
intention compatible est sélectionnée, cette carte appelle le même drop
BOARD_ZONE. Elle ne crée ni mutation alternative ni donnée de démonstration.

## Icônes et accessibilité

21 glyphes SVG/React locaux partagent ClayFrame : formes rondes, ivoire, accents
pastel et ombre discrète. Le registre PlannerIcon associe seulement une clé
visuelle à un composant. Il n'arbitre ni compatibilité, ni prix, ni capability.
CARD = 54 px, SATELLITE = 30 px, PALETTE = 34 px. Une même clé conserve le même
glyphe dans Library, carte et sélection de socket. Aucun asset externe téléchargé.

Les SVG décoratifs sont aria-hidden. Les états restent exprimés en texte, les
actions gardent leurs labels et leur focus visible. Le dialog natif conserve Tab,
Escape et le retour au déclencheur. La modale de détail utilise ce même mécanisme.
L'action Apply se trouve en permanence dans le header, également à faible hauteur.

## Frontière métier

`composer-presentation.ts` adapte uniquement les données déjà présentes dans le
read-model et sa preview : identité visuelle, silhouette, références Baseline,
protection, compteurs d'objets de premier niveau et signe de l'écart C7 pour
l'affichage « Marge ». Les enfants restent comptés comme sous-objets de leur
Context, sans être dupliqués comme cartes racines.

La jauge d'une cagnotte compare son allocation mensuelle à sa réservation initiale.
Elle est calculée côté présentation serveur et explicitement étiquetée « Repère
initial ». Elle ne prétend pas mesurer un solde accumulé ou un objectif annuel :
ces informations ne figurent pas dans le contrat SavingsAllocation actuel.
Aucun objectif, solde ou taux de complétion annuel n'est inventé.

React ne somme pas les montants et ne recalcule aucun reste, impact ou prix. Le
DTO de présentation ne pénètre pas PlanSemanticState, la proof ou la commande
Apply. Les coordonnées, tailles, colonnes et jauges restent graphiques.
Compiler, Apply, C0, Plan/PlanRevision, PlanningBaseline, PlanProjection,
`deriveMonthScenario()` et les writers V2 sont inchangés.

Les handlers de mutations, la séquence/digest hover, l'idempotence Apply,
Undo/Redo, ONE_OF, reparenting, sockets, acceptation de suggestions, protections
et relecture après Apply conservent leurs propriétaires certifiés.

## Fichiers modifiés

- `src/app/mois-a-venir/composer/` : shell, Library, Board, cards, Contexts,
  sockets, ancien composant cockpit réutilisé comme HUD/détail, CSS.
- `src/app/mois-a-venir/composer/planner-icons/` : ClayFrame, PlannerIcon et
  21 glyphes locaux.
- `src/domain/phase2/planner/composer-ui-contract.ts` : DTO de présentation.
- `src/server/phase2/planner/composer-presentation.ts` et `composer-service.ts` :
  enrichissement minimal du DTO, sans changement des mutations.
- `scripts/check-phase2-planner-composer.mjs` : deux contrôles R1 supplémentaires.
- `scripts/smoke-phase2-planner-composer.mjs` : structure unifiée, détail/focus,
  point d'entrée Ajouter et mesures HUD/Library/Board.
- Ce rapport.

## Certification

Les commandes demandées sont exécutées sur le dépôt réel :

```powershell
node scripts/check-phase2-planner-composer.mjs
node scripts/check-phase2-planner-headless.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

| Vérification | Résultat |
| --- | --- |
| Composer serveur | 35 groupes PASS : 33 C8 + compteurs/identités R1 + projection/cagnotte protégée R1 |
| Planner headless | 34 groupes PASS |
| TypeScript autonome | PASS |
| Build Next et TypeScript du build | PASS |
| Smoke C8 conservé | 21 groupes PASS sur la nouvelle UI |
| Smoke étendu R1 | 24 groupes PASS : C8 conservé + structure R1, détails/focus et Ajouter ; garde-fous de layout étendus |
| Moteur / migrations / lockfile | Aucune modification |
| Écritures historiques | Canaries PGlite inchangées |
| Supabase distante | Aucun accès requis pour cette refonte ; aucune écriture ni RPC |

Le smoke utilise les vrais composants Composer/AppShell, leur CSS et le service
serveur réel, avec la RPC C0 dans PGlite isolé. Les providers sont synthétiques et
les appels externes sont interdits par le host de fixtures. Les scénarios A–E
rejouent Preview/Apply/reload, seconde Revision, assistant, corbeille draft/applied,
ONE_OF, Context composite, reparenting, clavier, erreurs de formulaire et stale
hover. Aucun Apply distant n'est exécuté.

Les preuves restent hors dépôt, sans données bancaires personnelles :
`C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r1/`.

Captures : `initial-1440.png`, `composer-1920x1080.png`,
`composer-1728x900.png`, `composer-1440x900.png`, `composer-1440x760.png`,
`composite-context.png`, `scenario-D.png`, `scenario-E.png`,
`transport-form-1440x900.png` et `transport-form-1440x760.png`.
Le JSON navigateur conserve les mesures DOM : hauteur réellement disponible,
largeur du Board, Library, rectangle du HUD et position/cliquabilité d'Apply.

| Viewport CSS | Workspace (px) | Largeur Board (px) | Hauteur scroll Board (px) | Library (px) | Bas Apply (px) | Overflow page horizontal / vertical |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1920×1080 | 972.61 | 1584 | 690.61 | 264 | 162.14 | Non / Non |
| 1728×900 | 792.61 | 1392 | 510.61 | 264 | 162.14 | Non / Non |
| 1440×900 | 792.61 | 1104 | 510.61 | 264 | 162.14 | Non / Non |
| 1440×760 | 652.61 | 1104 | 370.61 | 264 | 162.14 | Non / Non |

Le HUD fait 88 px de hauteur et reste entièrement dans le viewport à chaque
taille. À 1440 px, le Board passe de 816 px dans la grille C8 précédente à
1104 px, soit 288 px récupérés. Apply est contrôlé par `elementFromPoint()`,
en plus de son rectangle DOM. Aucun test mobile ni règle mobile n'est ajouté.

## Régressions et suite R2

Aucune régression détectée dans les suites et les parcours ci-dessus.
Le nom interne `composer-cockpit.tsx` est conservé pour compatibilité de tests ;
il ne représente plus une colonne droite.

Les satellites, sockets et sélections conservent leurs interactions et peuvent
encore rendre les Contexts composites hauts. Leur refonte profonde, les packs
fantômes, la corbeille animée, l'assistant en cartes, l'absorption visuelle et
Comparer restent réservés aux passes suivantes. Comparer n'a pas été ajouté.
La progression annuelle des cagnottes exige une donnée d'objectif et de solde
provenant de son propriétaire ; la jauge mensuelle R1 n'en tient pas lieu.
La latence du lecteur distant signalée avant R1 n'est pas traitée par cette
refonte visuelle et aucun gain de performance de production n'est revendiqué.
