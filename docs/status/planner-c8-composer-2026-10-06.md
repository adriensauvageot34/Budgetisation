# C8 — Composer desktop, cutover et certification finale

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `130853487beb4f36c2e05ad6ec738783aa30be02` |
| HEAD_AFTER | Commit contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-c8-composer-2026-10-06.md` |
| BRANCH | `main` |
| MIGRATION_REQUIRED | NO |
| REMOTE_SUPABASE_WRITES / REMOTE_RPC_CALLS | 0 / 0 |
| ZERO_HISTORICAL_WRITE | YES — huit tables canaries inchangées |
| PLANNER_V3_READY | YES |

## Produit livré

`/mois-a-venir/composer?month=YYYY-MM` présente la bibliothèque de capabilities,
le Board du mois et le cockpit serveur. Le Board regroupe Socle du mois, Vie &
envies, Contexts & projets et Cagnottes. Les colonnes défilent localement ; leur
position graphique n'entre jamais dans le modèle métier ou l'Apply.

Les templates, options, sockets, contraintes, presets et compatibilités viennent
des propriétaires C3–C7. React reçoit un DTO de présentation sans BaselineSnapshot,
manifest complet ni entrées financières synthétiques. Le cockpit affiche les
champs exacts de PlanProjection ; il ne somme pas les cartes. Un montant, une
relation, une date ou un financement inconnus restent visibles comme inconnus.

Le parcours comprend :

- ajout par glisser-déposer, clic et clavier ; sockets compatibles et snap ;
- suggestions visuelles non acceptées et non valorisées, cartes choisies,
  dérivées, structurelles et non résolues ;
- formulaires de contrôles, components, financement, mobilité et métadonnées de
  Context, avec conservation du brouillon et des champs lors d'une erreur ;
- remplacement ONE_OF unique, répétitions, reparenting sans changement d'identité ;
- corbeille contextualisée, Undo/Redo du draft et protection PRESERVE ;
- preview au survol recompilée par le serveur, réponse séquencée et liée au digest ;
- assistant propositionnel, acceptation et régénération des impacts ;
- Preview, Apply authentifié, reload immédiat puis édition d'une nouvelle Revision.

La mobilité de travail fixe reste structurelle. PROTECTED ne publie aucune
réduction. Aucun score moral, XP, calcul financier parallèle ou code mobile
n'est introduit. Les libellés de Needs et des sockets sont présentés en français
par le serveur ; leurs identités métier restent inchangées.
Chaque socket reçoit aussi ses choix de menu du registre serveur, sans répéter
une option de transport issue d'autres templates. Les drops compatibles depuis
la bibliothèque conservent leurs capabilities complètes.

Les modales longues gardent leur titre et leur action primaire visibles, y
compris à 1440×760 : seuls les champs défilent. Le dialog natif maintient le focus,
Escape ferme la modale et le focus revient à l'action d'ouverture.

## Authentification, Apply et historique

`runtime.ts` construit le scope autorisé depuis l'utilisateur authentifié et le
bootstrap, avec une horloge figée pour la lecture. La Server Action vérifie ce
scope à chaque requête ; le navigateur ne choisit ni Household, ni client, ni
autorité. `composer-service.ts` valide les intentions via les capabilities C7,
recompile et renvoie une vue complète. Il n'écrit qu'à travers l'Apply C2.

Apply relit les autorités, recompile et exige la parité avec la preview avant
d'utiliser la RPC C0. Les previews périmées produisent zéro écriture. Une période
historique est refusée avant la RPC. Les retry d'un même Apply conservent leur
identifiant d'idempotence.

Retirer un Context du draft ne persiste rien. Retirer un Context déjà appliqué
produit `CANCEL_CONTEXT` dans le changeSet de la prochaine Revision. Le semantic
state normalisé ne conserve pas une copie fantôme annulée ; la Revision parente
et son identité restent dans l'historique immuable. Les changeSets dépassant
500 événements sont groupés en lots, sans tronquer les intentions ou imposer
une limite de deux opérations.

Un trajet explicitement partagé conserve les lieux enregistrés et n'est
valorisé qu'une fois : prix et financement appartiennent au trajet propriétaire.
Un prix indépendant contradictoire est refusé. Le carburant économique ne
devient pas un débit bancaire fictif. Un devis existant reste conservé lors
d'une édition sans nouveau prix, y compris avec une quantité supérieure à un.

## Cutover et retour réversible

Les liens « Piloter mon mois / Composer mon mois » ouvrent le nouveau workspace.
Sans active Plan, les scénarios et writers V2 conservent leur comportement.
Avec un Plan actif, les seules catégories et allocations possédées par ses slots
deviennent readonly dans l'ancien writer. La garde serveur retourne
`PLAN_V3_ACTIVE_READ_ONLY`, y compris pour les anciennes actions authentifiées.

La page mensuelle et le Centre utilisent `resolveEffectiveMonthScenario()`.
La vue appliquée expose PlanProjection, les Contexts et les informations de cash
et financement. Elle ne présente pas le total partiel de l'ancien moteur comme
un reste certifié lorsque C7 le déclare inconnu. Banque, Wallets, ressources,
Mettre à jour, facts et intents externes restent accessibles. Le calendrier
conserve les échéances et reports externes réels. Conserver un Plan déjà actif
ne crée aucun ancien checkpoint parallèle.

`PLANNER_COMPOSER_ENABLED=false` masque l'entrée et la route du Composer. Ce
retour UI n'ignore jamais un Plan déjà appliqué : son scénario reste l'autorité
et ses targets restent protégés. Aucune migration, modification de schéma,
suppression brutale d'éditeur V2 ou modification de `deriveMonthScenario()`.

## Certification

| Validation | Résultat |
| --- | --- |
| Suite C8 serveur | 33 groupes PASS ; vraie RPC C0 dans PGlite synthétique, un Plan et quatre Revisions |
| Suite C7 headless | 34 groupes PASS ; scénarios A–E, variantes, authenticité des actions et parité |
| Régressions C0–C6 et V2 | 33 suites PASS, puis suite Spatial UX supplémentaire PASS : 34 suites distinctes |
| Relectures finales des suites touchées | Month Decision Engine, Centre de contrôle (85) et Spatial UX (78) PASS |
| Navigateur desktop | 21 groupes PASS, vrais composants Composer/AppShell et CSS de production |
| Typecheck | PASS : `tsc --noEmit` et vérification TypeScript du build |
| Build Next.js | PASS ; route dynamique `/mois-a-venir/composer` incluse |
| Secrets / historique / Supabase distante | Aucun secret ajouté, canaries inchangées, zéro écriture/RPC distante |

Les régressions comprennent category targets, savings, month decisions,
planned finance/routes/car, benefit wallets, forecast temporel, personal/canonical
mobility, narratif mobilité, Centre V2/V4/V5, UX, architecture et complétude.
Le client mémoire V2 autorise désormais la lecture scopée de `phase2_month_plans`
pour vérifier l'absence de Plan ; aucune permission de mutation Plan n'y est
ajoutée. Les anciennes assertions interdisant les écritures historiques restent
actives.

### Matrice des interactions

| Oracle | Preuve exécutée |
| --- | --- |
| IGT-001 / 002 | Drag Library → ADD_CONTEXT et choix socket → PATCH_CONTEXT ; service et navigateur |
| IGT-003 | Draft REMOVE_CONTEXT / applied CANCEL_CONTEXT, Apply et lecture du changeSet |
| IGT-004 | Coordonnées rejetées par le parseur ; payload exclusivement sémantique |
| IGT-005 | Ghost PERSONAL_SUGGESTION non valorisé |
| IGT-006 | Cartes dérivées/structurelles sans drop de modification ; capabilities bloquées |
| IGT-007 / C8-010 | Gate sequence/digest ; réponse hover retardée après une preview plus récente ignorée au navigateur |
| IGT-008 | Vrai Tab/Enter, focus visible, édition puis action primaire |
| IGT-009 / C8-016 | Cockpit égal au PlanProjection de la réponse serveur ; aucune somme React |
| C8-011 | Drag et click avec la même intention → semantic state et projection identiques |
| C8-012 | Coordonnées interdites dans le payload Apply |
| C8-013 / 014 | Soirée appliquée annulée dans une seconde Revision ; suppression draft sans écriture |
| C8-015 | Uber remplacé par train/tram : une seule sélection et une seule représentation |
| C8-017 | Aucun code mobile ou media query ajouté au Composer |
| C8-018 | Ancien writer authentifié bloqué pour un target possédé ; Banque et targets non possédés modifiables |
| C8-019 | Sans Plan : projection directe V2 et writer V2 compatibles |
| C8-020 | Actions primaires visibles et atteignables, y compris formulaires longs et faible hauteur desktop |

Le navigateur a également exécuté Undo/Redo avec retour aux mêmes digests,
preset au clic, erreur de formulaire sans perte des champs, assistant accepté,
Preview → Apply → reload, seconde Revision, Context composite et reparenting
au clic avec conservation du ContextOccurrenceId.

### Fixtures desktop

| Fixture | Parcours vérifié |
| --- | --- |
| A | Courses ajustées, occurrence restaurant, épargne ajustable ; deux Apply et deux Revisions, reload identique |
| B | NightOut, Before, socket transport ONE_OF ; Apply puis annulation appliquée dans une seconde Revision |
| C | ShortStay, lodging, enfants activity/restaurant, un seul trajet partagé ; déplacement courses non résolu, reparenting |
| D | Mascara due, BeautyRestock et second Need dans le même achat ; cockpit conforme à C7 |
| E | PlannedExpense externe conservée une seule fois dans la composition ; cockpit conforme à C7 |

Les variantes confirmées/non résolues de displacement et les Apply/reload des
cinq scénarios sont aussi rejoués dans la suite C7. Le navigateur vérifie les
composants réels, pas une maquette des cartes.

| Viewport CSS | Hauteur workspace réelle | Hauteur Board | Bas du bouton Apply | Overflow page horizontal / vertical |
| --- | ---: | ---: | ---: | --- |
| 1920×1080 | 972,61 px | 760,11 px | 998,61 px | Non / Non |
| 1728×900 | 792,61 px | 580,11 px | 818,61 px | Non / Non |
| 1440×900 | 792,61 px | 580,11 px | 818,61 px | Non / Non |
| 1440×760 | 652,61 px | 440,11 px | 678,61 px | Non / Non |

Le header AppShell mesuré fait 75,39 px. Les hauteurs du workspace sont issues
des éléments DOM et tiennent compte du header et des espacements réels.
Aucune vérification mobile n'a été lancée.

## Reproduction et preuves

Suites :

```powershell
node scripts/check-phase2-planner-composer.mjs
node scripts/check-phase2-planner-headless.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

Le smoke utilise `agent-browser@0.38.2` et `esbuild@0.25.12` installés dans un
dossier d'outils extérieur au dépôt. Le serveur fixtures assemble les vrais
composants et le CSS global du build, interdit les appels réseau des providers
et sert uniquement sur loopback :

```powershell
$env:PLANNER_BROWSER_TOOLS='<dossier outils contenant node_modules>'
$env:PLANNER_C8_BROWSER_OUTPUT='<dossier de preuves extérieur au dépôt>'
node scripts/serve-phase2-planner-composer-fixture.mjs
# Dans un second terminal :
$env:AGENT_BROWSER_CLI='<dossier outils>/node_modules/agent-browser/bin/agent-browser.js'
$env:PLANNER_C8_BROWSER_OUTPUT='<même dossier de preuves>'
node scripts/smoke-phase2-planner-composer.mjs
```

Repartir d'un serveur fixtures neuf pour un smoke complet. Les suites V2
d'Undo utilisent, dans leur environnement synthétique uniquement,
`SUPABASE_SECRET_KEY=synthetic-undo-check-only` pour tester la signature locale.
Les exports serveur/C7 sont contrôlés par `PLANNER_C8_REPORT_PATH` et
`PLANNER_C7_REPORT_PATH`.

Les JSON, logs et captures synthétiques de cette certification sont conservés
hors du dépôt, dans le workspace de la conversation :
`C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-c8/`.
Ils ne contiennent aucune donnée bancaire réelle.

L'autorisation humaine antérieure limitant Supabase distante à la migration C0
ciblée et aux vérifications readonly reste respectée. La certification Apply
utilise la migration C0 existante dans PGlite isolé, avec providers synthétiques ;
elle ne prétend pas avoir effectué un Apply/RPC distant ni un parcours Vercel
en production. Aucun déploiement manuel, autre migration ou reset n'a été lancé.
