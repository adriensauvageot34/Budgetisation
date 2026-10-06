# Planner UI R3 — interactions du Composer

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `d275fa8765535aebbf2786c42a0c7c7e158fc1a1` |
| HEAD_AFTER | Commit unique contenant ce rapport : `git log -1 --format=%H -- docs/status/planner-ui-r3-gamified-interactions-2026-10-06.md` |
| Branche | `main` |
| PLANNER_UI_R3_GAMIFIED_INTERACTIONS | **PASS** |
| Migration / Supabase distante / RPC distante | Aucune / 0 écriture / 0 appel |
| Publication Vercel | Non exécutée dans R3 |

## Interactions livrées

Le drag natif soulève le satellite de 6 px et applique une scale de 1,04. Son
image suit le curseur avec l'icône Clay, le libellé et le montant réellement
publié. Une valeur inconnue reste « À préciser ». Le montant de Before ne
devient pas une habitude à partir d'une saisie du Plan ; la suggestion personnelle
de la fixture reste hors coût jusqu'à acceptation.

Les halos et sockets magnétiques utilisent exclusivement les DropCapabilities
serveur. Une cible absente ou bloquée n'accepte pas le geste. Le noyau devient
une cible globale seulement si un unique socket compatible est publié ; sinon
les sockets restent les cibles explicites. Le snap dure 210 ms, avec une scale
de 1,08 vers 1. Undo et Redo réutilisent le même historique sémantique et ajoutent
un retour visuel sobre.

Le survol prépare une véritable opération DROP ou ACCEPT et passe par le service
Composer existant. Le HUD montre le reste canonique, le reste temporaire et
l'impact renvoyé par le serveur. Cet impact est la différence de deux projections
du Compiler réel. Le client n'additionne ni coûts ni deltas. Les identités du
geste restent fixes entre survol et dépôt. Sequence, digest et invalidation
protègent contre les réponses anciennes. Quitter la cible, terminer le drag ou
appuyer sur Échap restaure le HUD canonique ; l'attente reste discrète et ne
fournit aucune valeur anticipée.

La corbeille n'est plus présente au repos. Elle apparaît comme une petite cible
au bas du Board uniquement pendant la saisie d'un objet retirable. Les objets
PROTECTED ou PRESERVE affichent un cadenas et « Protégée » ; le dépôt est refusé
avec un recul visuel, sans mutation. Le menu accessible « Retirer ce moment »
reste disponible pour les Contexts autorisés. Un Context de brouillon est
retiré ; un Context appliqué conserve la sémantique CANCEL_CONTEXT de C8.

Tram peut être déposé directement sur le socket aller occupé par Uber. Le serveur
publie le remplacement ONE_OF, preview puis drop ; une seule sélection reste
équipée et Uber redevient une alternative. Le clic et le clavier passent par
la même opération. Aucun select HTML ne constitue l'interaction principale.
Le tarif inconnu du nouveau transport n'hérite jamais du tarif de l'ancien.

Le Restaurant peut être ajouté indépendamment depuis la Library ou rattaché à
un Week-end. Un Context existant conserve son ContextOccurrenceId lors du
reparenting. Les menus « Rattacher à … » proviennent des mêmes capacités que
le drag. Pour déplacer un composant existant, `sourceSocket` identifie uniquement
le Context, le slot et la sélection. Le service vérifie cette source contre
la présentation autorisée, conserve toute la décision serveur, puis utilise
les PATCH_CONTEXT existants pour vider la source et équiper la cible avant
une recompilation. Prix/devis, financement, lieux enregistrés et déclaration
de trajet sont conservés. La relation POSSIBLE + MERGE ne devient pas CERTAIN.

Les packs fantômes utilisent une opacité de 0,52, un contour pointillé et les
defaults structurels réellement publiés par le registre. Sans estimation
fiable, ils affichent « Estimation après ajout ». Le registre courant ne publie
pas de pack personnel Before/Transport chiffré : R3 n'en invente pas. Les
suggestions non acceptées restent hors coût et aucun ghost ne devient un choix
utilisateur par sa seule apparition.

Les bulles de consommation d'occurrences restent issues du manifest certifié.
La présentation joint le componentId à son Context et sa sélection afin de
publier le texte « 1 occurrence habituelle rattachée à … ». React ne déduit
aucun binding depuis la position de la carte. Les conséquences dérivées
conservent leur maillon bleu et leurs permissions réelles ; elles ne reçoivent
aucune nouvelle capacité d'édition ou de drag.

Les satellites de mobilité affichent le prix de leur trajet physique propriétaire.
Un trajet partagé indique où le montant est déjà compté, sans lui attribuer un
second montant. Les voitures réutilisent `transportTotals()` pour le coût
économique. Un parking inconnu reste inconnu ; le carburant utilisé ne devient
pas un débit Banque. Le trajet Taxi connu de la fixture affiche exactement 14 €.

## Assistant, comparaison et complétude

L'assistant est une petite main de suggestions, avec scroll horizontal. Chaque
carte représente un candidat réellement resimulé par C7. Clic ou drag vers sa
cible utilise ACCEPT avec candidateSetDigest et candidateId. L'acceptation
recompile, invalide les anciens impacts et régénère les candidats. Si la main
reste ouverte pendant une autre modification, ses anciens candidats sont
invalidés et relus. Aucun candidat PROTECTED/PRESERVE n'est proposé ni appliqué
automatiquement. La fermeture de la main et le dialog d'édition sont indépendants.

Comparer ouvre une branche temporaire à partir d'un snapshot immuable du modèle,
du draft, de l'historique et des suggestions. Le HUD conserve « Plan actuel »
et affiche la projection serveur de la « Variante ». La variante possède son
propre Undo/Redo. Quitter restaure exactement le snapshot et le digest antérieurs.
Garder adopte le draft de la variante et ajoute un seul point de retour dans
l'historique principal. Apply est absent pendant la comparaison. Ni l'entrée,
ni les modifications, ni Quitter/Garder ne créent de persistence ou d'Apply.

La marge d'objectif provient de la projection C7 et suit les previews : vert
calme lorsque la marge est positive, ambre lorsqu'elle est négative. Cliquer
« X à préciser » atténue les autres cartes et met en évidence les références
inconnues publiées par le serveur ; second clic ou Échap restaure le Board.
« Plan prêt ✓ » exige projectionCompleteness COMPLETE et applyReadiness READY.
Les fixtures encore PARTIAL/UNKNOWN ne reçoivent pas ce badge.

## Motion et accessibilité

Les durées sont centralisées : hover 120 ms, focus/palette 190 ms, lift 140 ms,
snap/reparent 210 ms, corbeille 180 ms et ghost 150 ms. Les effets utilisent
transform et opacity, sans animation de width/height. Le mode reduced-motion
supprime les transitions et animations ; les actions restent utilisables.
Aucune branche mobile ou media query de viewport n'a été ajoutée.

Les déplacements de composants et Contexts, remplacements, acceptations de
suggestions et retraits ont une alternative clic/clavier. Les popovers et
dialogs restituent le focus. Les timers, observateurs et effets DOM sont nettoyés.
Les coordonnées servent uniquement à la présentation DOM et aux gestes du smoke,
sans entrer dans semanticState, proof ou Apply.

## Autorités conservées

Les extensions sont dans la présentation, le DTO Composer et l'adapter de gestes
C8. Le Compiler, Baseline, Apply, la projection financière, le registre métier,
`deriveMonthScenario()` et les writers V2 restent leurs owners existants.
`read-model.ts` exporte seulement son alias de libellé de socket pour les ghosts.
Les nouveaux fichiers `interactions.tsx` et `comparison.ts` ne possèdent aucun
calcul financier, catalogue de compatibilité ou stockage.

## Vérifications

| Suite | Résultat |
| --- | --- |
| `check-phase2-planner-interactions.mjs` | 22 oracles R3-001…022 PASS |
| `smoke-phase2-planner-interactions.mjs` | 22 contrôles navigateur PASS |
| `check-phase2-planner-composer.mjs` | 35 groupes C8/R1 PASS |
| `smoke-phase2-planner-composer.mjs` | 37 contrôles C8/R1/R2 PASS |
| `check-phase2-planner-atomic-ui.mjs` | 14 groupes R2 PASS |
| `check-phase2-planner-headless.mjs` | 34 groupes C7 PASS |
| Category targets V2 | 36 groupes PASS |
| Savings allocations V2 | 21 groupes PASS |
| Month decisions V2 | PASS |
| Planned Finance / Planned Routes | PASS / PASS |
| TypeScript `--noEmit` | PASS |
| Next.js build, incluant TypeScript | PASS |
| Revue React | PASS : hooks, identités, focus, effets nettoyés, absence de somme financière client |
| `git diff --check` | PASS |

Les 22 oracles couvrent identité, remplacement, compatibilité, impact égal à une
recompilation indépendante, réponse stale, retour du HUD, corbeille, annulation
appliquée, protection, ghosts, manifest, conséquences dérivées, assistant,
comparaison, absence de persistence, absence de somme React, clavier et motion.
Le smoke réalise de vrais gestes natifs Before → Soirée, Tram → Uber,
Restaurant → Week-end, protection → corbeille, assistant clic/drag et comparaison.

Les contrôles utilisent les vrais composants Composer/AppShell, services et
Compiler, avec autorités synthétiques, providers synthétiques et SQL C0 dans
PGlite isolé. Le réseau des providers est interdit. Les fixtures navigateur
RA/RB/RC/RR ont chacune zéro Plan, zéro Revision et zéro RPC. Les fixtures C8 A/B
ont chacune deux révisions exclusivement locales, avec Apply/reload et seconde
Revision ; C/D/E/R restent sans persistence. L'oracle R3-008 vérifie également
CANCEL_CONTEXT après un Apply synthétique local. Tous les canaris historiques
sont intacts. Toutes les requêtes observées ont `uiPayloadFields = []`.

La suite category targets a reçu une clé Undo synthétique limitée au processus,
sans fichier d'environnement modifié ni secret réel chargé par ce test.

| Desktop | Hauteur CSS workspace | Hauteur scroll Board au repos | Largeur Board | Overflow page | Apply accessible |
| --- | ---: | ---: | ---: | --- | --- |
| 1920×1080 | 972,61 | 728,61 | 1584 | Aucun | Oui |
| 1728×900 | 792,61 | 548,61 | 1392 | Aucun | Oui |
| 1440×900 | 792,61 | 548,61 | 1104 | Aucun | Oui |
| 1440×760 | 652,61 | 408,61 | 1104 | Aucun | Oui |

Le HUD mesure 88 px de haut au repos ; Apply reste accessible à 162,14 px du
haut. Le Board et la palette conservent leur scroll local, les formulaires longs
leur action principale. Les captures ont été inspectées : pas de clipping du
HUD, des actions de comparaison ni des drop targets. Reduced-motion donne
`transitionDuration = 0s` et `animationDuration = 0s` dans le navigateur.

## Captures et preuves locales

Répertoire : `C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-ui-r3/`.

- `before-hover.png`, `before-equipped.png` : preview et acceptation du Before.
- `tram-replaces-uber-preview.png`, `tram-equipped.png` : remplacement direct et unique ; tarif inconnu conservé.
- `restaurant-reparent-preview.png` : cible magnétique du Week-end et lien de consommation réel.
- `protected-trash.png` : cadenas, refus et absence de mutation.
- `night-pack-ghost.png` : pack structurel fantôme, sans estimation inventée.
- `assistant-hand.png`, `assistant-drag-preview.png` : vrais candidats et leur projection serveur.
- `compare-variant.png` : plan actuel, variante et marge d'objectif ambre.
- `composer-1920x1080.png`, `composer-1728x900.png`, `composer-1440x900.png`, `composer-1440x760.png` : mesures desktop.
- `r3-browser-verification.json`, `browser-verification.json` : contrôles, traces, mesures et canaris.
- `certification.json` : SHA final et résultats consolidés.

Les captures montrent des fixtures synthétiques. Aucun test d'écriture distant,
aucun appel réel à la RPC Supabase, aucune autre migration, aucune réinitialisation
et aucun déploiement Vercel n'ont été effectués.
