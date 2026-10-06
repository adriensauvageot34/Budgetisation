# C7 — Planner headless : projection, assistant et Composer

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `3831737de1ea5868454e0740e07826434321d259` |
| HEAD_AFTER | Commit contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-c7-headless-2026-10-06.md` |
| BRANCH | `main` |
| MIGRATION_REQUIRED | NO |
| ZERO_HISTORICAL_WRITE | YES |
| C7_HEADLESS_PLANNER_CERTIFIED | YES — 34 groupes, dont les dix oracles C7 |

## Résultat livré

Le Planner expose un produit serveur composable avant React : bibliothèque de
capabilities, Board, cartes de contrôles et Contexts, sockets, cockpit et
résolutions de drops. Le cockpit est la PlanProjection elle-même ; les cartes
ne recalculent aucun montant. Les templates et leurs compatibilités proviennent
du registre C4, les contrôles simples de C3 et les Needs de C6.

Les actions authentifiées sont publiées dans
`src/app/mois-a-venir/planner-actions.ts` :

- `readMonthComposer(targetMonth, draft?)` ;
- `previewPlanScenario(targetMonth, draft)` ;
- `applyPlanScenario(targetMonth, draft, command)` ;
- `readPlanBalanceSuggestions(targetMonth, draft?)` ;
- `acceptPlanBalanceSuggestion(targetMonth, draft, candidateSetDigest, candidateId)`.

Le Household provient du contexte serveur autorisé. Le client ne choisit pas un
Household pour les actions. Une session changeante, une mauvaise période, une
preview périmée ou un ensemble de suggestions périmé sont refusés. Les services
internes reçoivent les dependencies authentifiées déjà utilisées en C2/C5/C6.

## Projection et propriétaires

`projection.ts` lit le scénario produit par `deriveMonthScenario()`, les
consommations de slots, les valuations de components et les prix physiques C5.
Il expose reste Baseline, reste Plan, différence, ressources, engagements,
réservations d'épargne, besoins/habitudes, vie discrétionnaire, Contexts explicites,
mobilité, réserves non résolues, financement, timing, objectif, impacts,
completeness et apply readiness.

Les subdivisions de consommation utilisent les provisions effectives du
propriétaire de prévision quand son evidence est disponible. Les Contexts sont
une vue de leurs coûts bruts déjà inclus dans les subdivisions, pas un montant
à ajouter une seconde fois. L'effet restant des intents externes provient de
l'impact net du propriétaire financier. La mobilité de travail reste structurelle.
Les contrôles et les Contexts ont des impacts marginaux obtenus en recompilant
leur retrait ; une relation non résolue conserve un impact inconnu.

Les wallets et la projection BankCash existants restent les autorités du
financement et du cash. Les dates déclarées restent déclarées ; les dates absentes
restent inconnues. La ligne de consommation économique de carburant garde
`ECONOMIC_ONLY` et n'est jamais un débit bancaire fictif.

Dans le seul adapter Plan, une allocation de financement absente sur une
PlannedExpense externe devient une liste vide explicite. Cela empêche le fallback
legacy Banque. La dépense reste une seule entrée avec sa même identité et ses
montants. Son DB row n'est pas modifié. Le flux direct V2 reste intact.
L'oracle C5-011 vérifie désormais ce financement explicitement inconnu.

Aucun provider existant ne certifie un point bas de cash daté. Les champs de
point bas restent null et la projection globale reste PARTIAL lorsque le résultat
économique est connu, UNKNOWN lorsque sa base est inconnue. Une autorisation
d'Apply reste distincte de la complétude de la connaissance : les warnings des
lots précédents demeurent visibles, les contraintes BLOCK continuent de refuser.

## Assistant propositionnel

`balance-assistant.ts` publie AdjustmentCapabilities puis simule chaque
AdjustmentCandidate par la préparation C5, le Compiler réel, l'adapter financier
et le même moteur mensuel. Le gain est la différence entre les deux restes
mensuels calculés ; aucun gain local ou addition de gains indépendants n'est utilisé.

Les presets viennent des repères disponibles, des occurrences entières et d'une
politique versionnée d'allocation ajustable. Les floors réellement attestés sont
respectés. Les épargnes PROTECTED, les ancres, PRESERVE et les besoins structurels
ne sont jamais proposés comme réductions. Une ancre sur un component ou un
Context protège la composition et ses descendants ; le travail fixe ne devient
pas un levier arbitraire. Les données manquantes génèrent des demandes de
résolution et des impacts inconnus.

Accepter une suggestion relit les autorités, régénère l'ensemble pour vérifier
son digest, produit un nouveau draft, recompile et régénère tous les candidats.
Les anciens IDs d'impacts sont invalidés. Cette opération ne persiste rien.
Seul Apply utilise la RPC C0 après la relecture et la comparaison de preview C2.

## Composition serveur

`semantic-mutations.ts` fournit SET_STATE, ADD_CONTEXT, PATCH_CONTEXT,
REMOVE_CONTEXT, ATTACH_CONTEXT et REPARENT_CONTEXT. Les identités de décisions
sont déterministes ; un reparenting garde le ContextOccurrenceId. ONE_OF remplace
la sélection antérieure, REPEATING accepte plusieurs éléments, les suggestions
personnelles non acceptées ne contribuent pas au coût.

`resolveComposerDrop()` consulte les compatibilités publiées et valide la
mutation complète. Il peut demander une sélection explicite, refuser un socket
incompatible ou résoudre une intention vers la corbeille. La preview utilise
ensuite le semantic state complet. Aucune API `previewComposerInteraction`
supplémentaire n'a été créée. Le caller dispose des digests du semantic state,
du manifest et de la preview pour ignorer une réponse devenue périmée.
Les compteurs undo/redo sont nuls dans ce read-model serveur ; aucune histoire
client fictive n'est reconstruite.

`resolveEffectiveMonthScenario()` expose aussi semanticState et projection du
Plan actif. Le reload vérifie la projection si les autorités sont identiques ;
un changement d'autorités conserve le signal CHANGED_AUTHORITIES. Sans Plan actif,
le service appelle directement le flux V2 existant, sans lire la Baseline C1.

## Fixtures et oracles

La suite dédiée `check-phase2-planner-headless.mjs` couvre :

| Scénario | Couverture |
| --- | --- |
| A | Courses, restaurant occurrence, cagnotte adjustable ; variante avec le propriétaire de prévision canonique |
| B | NightOut, Before, remplacement Uber/Tram par le socket ONE_OF |
| C | ShortStay, lodging, activity et restaurant enfants, trois intents partageant un seul trajet ; displacement courses non résolu puis confirmé |
| D | Mascara due et second Need dans un même BeautyRestock, deux NeedOccurrences conservées |
| E | PlannedExpense externe et Plan actif, une entrée financière et une carte externe readonly |

Chaque variante vérifie Board = projection, Preview = Apply = Reload, avec le SQL
C0 réel exécuté dans PGlite synthétique uniquement. Les tests additionnels
vérifient les dix oracles C7, les impacts des candidats par recompilation
indépendante, l'invalidation, les refus stale et de scope, l'authentification des
actions serveur, les ancres de components, FIN-003/004, le financement inconnu,
l'absence de date inventée et la réconciliation des subdivisions économiques.

## Validation finale

| Suite | Résultat |
| --- | --- |
| C7 headless | 34 groupes PASS ; cinq scénarios et leurs variantes, actions authentifiées et parité PostgreSQL |
| C0 contracts / persistence | 7 + 9 PASS ; PLN-001..007, CAS, idempotence et rollback atomique |
| C1 Baseline | 13 PASS |
| C2 kernel | 40 PASS ; PARITY-001..005, BASE-001..007 et FIN-001/002/005/006 |
| C3 simple levers | 30 PASS |
| C4 contexts | 29 PASS ; CTX-001/002 |
| C5 mobility | 37 PASS ; MOB-001..005 et C5-006..011 |
| C6 renewals | 31 PASS ; REN-001..005 et C6-006..011 |
| Planned Finance / Routes / Car | PASS ; providers simulés |
| V2 category targets / savings / month decisions / decision engine | PASS |
| Benefit wallets / temporal mode / temporal forecast / October contract | PASS |
| Personal Mobility / context / trips / trip contexts / monthly narrative / car rhythm | PASS |
| Architecture | PASS — 832 fichiers |
| TypeScript | PASS — tsc puis contrôle du build Next.js |
| Build Next.js | PASS — compilation de production, TypeScript et huit pages statiques |

Le runner final comporte 26 suites de régression, toutes PASS. FIN-003 et FIN-004
sont aussi nommés dans la suite C7, ce qui complète explicitement les six oracles
financiers M20. Les logs et le rapport JSON de certification sont conservés dans
les artefacts du chat.

Le premier chargement C1 a signalé MODULE_NOT_FOUND pour un paquet déjà installé ;
le rejeu standalone et le runner final ont passé avec la même version, sans
modifier les dependencies. Le script de forecast live sélectionné initialement
exigeait les paramètres distants et n'a effectué aucune lecture ; il a été exclu
du runner synthétique au profit du contrat local October et des propriétaires
financiers/temporaux. Aucune clé réelle n'a été fournie aux checks.

Les suites distantes nécessitant des identifiants réels ne sont pas exécutées.
Les cinq familles de scénarios utilisent uniquement les fixtures, PGlite et les
providers simulés. Les huit tables canaries historiques restent intactes.

## Périmètre

Aucune migration, réinitialisation, écriture Supabase distante ou RPC distante.
Aucun writer supplémentaire MonthInputs, PlannedExpense, Mobility ou historique.
Aucun apprentissage automatique de préférences/habitudes. Aucune UI React,
aucun déploiement manuel et aucun lot C8 lancé.

```ini
C7_HEADLESS_PLANNER_CERTIFIED = YES
```
