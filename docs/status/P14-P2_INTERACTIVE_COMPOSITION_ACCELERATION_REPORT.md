# P14-P2 — Édition et recalculs Composer

Date : 13 octobre 2026. Base vérifiée : `a934f60f7f796b4522cbccfbb7b01edfab96dea5`.
Branche locale : `codex/composer-v3-p14-p2-interactive-composition`.

## Verdict

**`SAFE_LOCAL_OPTIMIZATION_REAL_GAIN_NOT_CERTIFIED`**.

Le travail inutile diminue réellement dans les fixtures exécutées. La parité financière passe et le build Next complet termine avec le code 0. Les objectifs interactifs ne sont pas démontrés : le rendu P95 reste supérieur à 100 ms et certaines confirmations FRESH dépassent 2 s. Aucun gain Supabase, Vercel ou utilisateur en production n'est revendiqué. Aucun push, PR, merge, déploiement, migration, snapshot durable ou travail P14-P3 n'a été effectué.

## A. Modifications conservées

| Chemin | Avant | Après / travail évité | Risque et rollback |
|---|---|---|---|
| Mutation serveur : `composer-service.ts`, nouveau `composer-mutation-world.ts` | Deux `readWorld`, pour valider avant puis simuler après | Une lecture des **faits sources** limitée à cette requête/auteur autorisé/foyer/mois. Deux `prepareWorld` et deux évaluations financières conservées | Source modifiée après sa lecture non détectable par cette Preview seule. Prochaine requête et Apply relisent les autorités. `COMPOSER_P14_P2_SINGLE_WORLD=0` restitue les deux lectures |
| `preview-scheduler.ts` | Même intention en attente : timer remplacé, parfois nouveau READ déjà lancé | Regroupement uniquement si digest, mois, version et ticket en attente sont identiques. Aucun résultat terminé conservé | Une intention différente garde sa programmation immédiate après le debounce existant. Drapeau client `NEXT_PUBLIC_COMPOSER_P14_P2_INTERACTIONS=0` |
| `composer-shell.tsx` | Répéter une décision inchangée déclenche encore une Preview ; survol identique répété relance une demande | Aucun READ pour un choix identique déjà FRESH/BLOCKED ou en attente. Survol identique en cours regroupé ; aucun nouveau survol pendant une Preview principale en attente | FAILED/STALE peuvent être relancés avec le même choix. « Actualiser la prévisualisation » conserve une véritable lecture. Même drapeau client pour rollback (nouveau build requis) |
| `local-draft.ts` | Digest répété, recréation de cartes/sockets inchangés, comparaisons digest des mêmes listes | Digest unique ; références de cartes et listes inchangées conservées | Comparaison exacte de l'état du Context, sans montant calculé localement. Différence d'ordre JSON : optimisation manquée seulement. Revert de ce fichier |
| `durable-draft.ts` | Digest de l'état recalculé sur chaque rendu, y compris pour initialiser un ref déjà créé | Digest mémoïsé sur l'identité de l'état sémantique immuable | L'état est remplacé par les mutations existantes ; aucune mutation en place introduite. Revert de ce fichier |

Le partage serveur s'applique à MUTATE, DROP, CLEAR_SOCKET, EDIT_GIFT, EDIT_NIGHT_OUT, EDIT_SHORT_STAY, EDIT_FAMILY_VISIT, EDIT_CONTEXT et PRESERVE. READ reste une lecture indépendante. APPLY, CHECK_APPLY, ACCEPT et les suggestions conservent leur orchestration. Les lectures du Plan actif et les validateurs de références ne sont pas mémoïsés. La préparation Mobility dépendante de chaque Draft est exécutée avant **et** après : voiture → train supprime toujours les coûts de carburant prospectifs.

### Frontière de fraîcheur

Le résultat de `readWorld` est partagé, pas un World préparé, et pas entre requêtes. Ce n'est pas une transaction PostgreSQL englobant toutes les lectures historiques. Les protections de génération/date/publication du lecteur P1 demeurent. Le test changeant MonthInputs entre les deux anciennes lectures démontre que l'ancien chemin **acceptait** deux ensembles différents sans contrôle d'égalité. P2 compare avant/après sur les mêmes faits admis ; ses résultats correspondent à une lecture indépendante de ces faits. Une source peut changer après cette admission, comme après un READ ordinaire. P2 n'affirme pas une fraîcheur permanente. La requête suivante voit le changement ; Apply le relit et refuse une preuve périmée avant RPC. Les versions du Plan actif continuent à être relues par leurs propriétaires.

## B. Expériences et mesures

### Mutation serveur : huit paires alternées

PGlite/C0 et Compiler/Finance V2 véritables ; faits et fournisseurs Mobility synthétiques. Délai injecté de **120 ms par World**, hypothèse de **20 GET simulés par World**. Ces GET ne sont pas du SQL ni des appels Supabase mesurés.

| Mesure par mutation | P1 | P2 |
|---|---:|---:|
| Lectures World | 2 | 1 |
| GET simulés | 40 | 20 |
| Préparations dépendantes du Draft | 2 | 2 |
| Évaluations de scénario | 2 | 2 |
| Appels Finance V2, cas montant | 4 | 4 |
| Durée P50, n=8 | 409,99 ms | 282,59 ms |
| Durée P95, rang le plus proche, n=8 | 415,32 ms | 294,01 ms |

Gain médian de cette fixture : 127,40 ms (31,1 %). Le bénéfice démontré est la suppression d'une lecture de faits ; ce délai simulé ne prédit pas le gain réel. CPU Finance conservé dans les échantillons bruts ; aucun calcul financier nécessaire n'a été supprimé pour cette mutation.

### Séance navigateur P1/P2

Une paire finale, 1280 × 720, même machine Windows, navigateur intégré, React 19 en mode développement/Profiler, même CSS de production, mêmes faits PGlite, délai World 120 ms, `COMPOSER_P14_P1_READ_REUSE=1` des deux côtés. Les quatre modules client P1 sont chargés directement avec `git show` depuis la base exacte ; le serveur P1 utilise le chemin deux lectures avec le drapeau P2 à 0. Le reste des contrats et moteurs est identique. Aucun accès distant n'est disponible dans le host de fixture (`fetch` serveur interdit).

Séquence : Soirée → trois équipements → quantité → Visite famille → Séjour court → cinq montants → dix éditions → vingt Contexts → suppression de deux → six Undo/Redo → sauvegarde et FRESH. Trois répétitions d'un choix identique et cinq survols identiques complètent le diagnostic. Les équipements complexes gardent leur fallback validé au serveur : quatre DROP serveur, des deux côtés.

Le pilote déclenche les opérations par un événement réservé à la fixture, qui appelle **la fonction stage réelle** de Composer. Il attend l'accusé de rendu puis 40–60 ms avant le geste suivant. Ce n'est pas une mesure complète d'un glisser-déposer physique ou de tous les événements du panneau. Le dernier geste est chronométré dans la page avec `performance.now`, jusqu'au premier commit React FRESH suivant. L'ajout visuel est mesuré jusqu'au callback `requestAnimationFrame` suivant ; ce marqueur de rendu n'est pas une mesure du scan physique de l'écran. Les événements React rendent les intervalles effectifs variables : les rafales ne sont pas toutes inférieures aux 160 ms de debounce.

| Mesure | P1 | P2 |
|---|---:|---:|
| Demandes envoyées, ouverture incluse | 49 | 48 |
| READ principaux | 40 | 43 |
| MUTATE de survol | 5 | 1 |
| DROP serveur | 4 | 4 |
| World effectivement démarrés et terminés | 58 | 48 |
| Évaluations de scénario | 58 | 53 |
| Appels Finance V2 | 815 | 598 |
| CPU Finance V2 additionné | 1 518,43 ms | 1 112,09 ms |
| Autosauvegardes confirmées | 8 | 7 |
| Digest final / Preview finale | Identiques | Identiques |
| Contexts finaux / état | 20 / SAVED / FRESH | 20 / SAVED / FRESH |
| Ajout visuel P50 / P95, n=20 | 145,20 / 200,10 ms | 166,10 / 286,00 ms |
| Traitement synchrone des ajouts P50 / P95, n=20 | 3,20 / 5,80 ms | 4,20 / 9,30 ms |
| Dernière intention → FRESH P50 / P95 | 985,40 / 11 392,20 ms, n=13 | 837,90 / 11 150,40 ms, n=12 |
| Rendu Profiler P50 / P95 | 95,90 / 325,20 ms, n=128 | 93,30 / 306,50 ms, n=124 |

**Dix lectures World supprimées au total, pas une division par deux des READ du Board.** Décomposition : quatre deuxièmes lectures des DROP supprimées ; quatre survols supprimés et une deuxième lecture évitée sur le survol conservé (neuf World) ; trois READ principaux supplémentaires dans le rythme effectif P2. Bilan : 4 + 9 − 3 = 10. Les READ principaux augmentent dans cette paire : la réduction des rafales distinctes n'est donc pas démontrée au navigateur. La baisse des évaluations/calls Finance vient des demandes secondaires éliminées ; leur quantité par requête dépend du nombre de Contexts.

Les percentiles sont descriptifs d'une seule séance, sans intervalle de confiance ni certification d'amélioration de latence. Le P95 visuel est **plus élevé** pour P2 : cette observation est conservée, pas transformée en PASS. Les traitements synchrones restent courts ; attente de rendu, charge React et recouvrement des réponses dominent. Les marques de requête client arrêtées avant réception complète de certains anciens survols ne servent pas à compter le travail : les traces serveur ont été extraites après leur achèvement. Aucun calcul déjà envoyé n'est présenté comme annulé.

Les pilotes préliminaires ne sont pas agrégés : le premier utilisait des historiques React insuffisamment synchronisés ; un ancien onglet P1 avait aussi 918 × 811 contre 1280 × 720. Une observation CDP a expiré au démarrage de chaque séance finale : l'état « initial » a été relu avant le clic, sans double lancement. Les preuves finales contiennent les cinquante opérations locales et le même état final. Aucune série distante de performance n'a été lancée.

### CPU local, ordonnancement, sauvegarde et hover

- `visualDraftModel`, vingt Contexts, quatre parités complètes : 80 paires alternées. P1 P50/P95 **2,139/4,517 ms**, P2 **1,013/2,421 ms**. Fonction plus légère et cartes inchangées identiques par référence ; aucune promesse de gain de rendu total. Au navigateur, 60 appels/252,8 ms deviennent 56/118,6 ms.
- Hook Draft réel, même objet sémantique, 21 rendus déterministes : **42 → 1** calculs digest. Aucun changement du debounce 1 s, du maximum 5 s, des CAS ou des request IDs.
- Scheduler réel : trois intentions identiques déjà envoyées **3 → 1**, résultat accepté **1 → 1**. Dix états distincts avant le debounce donnent **1 READ des deux côtés** : mécanisme P03 existant, pas un nouveau gain P2. Une intention différente commence sans attendre l'ancien serveur ; seul le dernier résultat est installé. Les réponses de World/version/Undo/dispose périmées sont refusées. Un READ terminé n'est jamais mis en cache.
- Hover navigateur : **5 → 1**. Pas de suppression générale du hover et pas de file derrière laquelle la Preview principale devrait attendre. Les appels déjà commencés continuent ; leur résultat peut être écarté.
- Les 14 saves C4 n'ont pas de trace par geste suffisante pour déclarer lesquels étaient superflus. Cette mission constate **8 → 7**, sans deux digests sauvegardés identiques consécutifs. Les sauvegardes intermédiaires pendant les changements et les retours Undo sont légitimes ; la variation de compte peut venir du rythme effectif. Aucun regroupement serveur supplémentaire ni sécurité affaiblie.
- Une stratégie « un seul READ en vol pour tous les états différents » est écartée : elle ferait attendre la dernière intention derrière une ancienne lecture. Le nombre de calculs obsolètes déjà démarrés reste un levier ouvert, pas un problème prétendument résolu.

## C. Parité, sécurité et résultats exacts

| Contrôle réellement exécuté | Résultat / limite |
|---|---|
| P2 mutation, 12 groupes | PASS synthétique : réponses complètes égales sur montant, ajout, Soirée riche, label, protection, Séjour UNKNOWN, voiture → train ; erreur World, référence invalide et Context verrouillé conservés |
| Digests/projections | Les deux résultats avant/après de chaque mutation ont chacun leurs trois digests explicitement vérifiés (quatorze triplets P1/P2 dans `mutation.json`). `deepEqual` des réponses P1/P2 inclut les preuves, modèle, capacités, `previewDigest`, projection/manifest et provenance ; golden 22 × 9 PASS |
| Changement de source / concurrence | Nouvelle requête observe une nouvelle source ; deux requêtes simultanées ne partagent pas World ; mismatch de foyer/mois rejeté ; Apply stale refuse avant RPC |
| P2 scheduler, 5 groupes | PASS synthétique : intentions identiques, dix éditions, priorité du dernier état, World/Undo/dispose, aucun cache après achèvement |
| P2 présentation, 4 cas | PASS : objets complets identiques à P1, coûts du cockpit non calculés localement, fallback complexe conservé, références de cartes inchangées stables |
| P2 hook durable, 7 groupes | PASS déterministe : debounce, sauvegarde lente puis nouveaux edits, reprise du même ID après commit perdu (une version), conflit de deux sessions et conservation locale, offline sans écriture puis online, archive/restauration avec réponse perdue et relecture, mémo digest |
| P03 / P02 conservation | PASS : 12 contrôles interaction et 8 groupes conservation, UNKNOWN, références, Undo/Redo, Apply/Reload PGlite |
| C8 | PASS : 35 contrôles dont C8-017, protections et canaries historiques |
| R3 interactions | **FAIL préexistant R3-008** : `CONTEXT_REFERENCE_OWNER_UNAVAILABLE`; les 21 autres contrôles PASS. Même réserve attestée en P1, pas de correction hors périmètre |
| Kernel / Baseline / Mobility / P11 | PASS sur les fixtures existantes ; périodes, UNKNOWN/PARTIAL, protections, composants, absence de double compte |
| P13 | PASS, 8 contrôles PGlite : CAS, idempotence, commit réussi/relecture échouée, replay, récupération de réponse perdue |
| P1 lecture réutilisée / ouverture | PASS, 13 et 11 contrôles : timezone, date, publication, sources rétroactives, historique absent, résultat plafonné incomplet, concurrence, source indisponible |
| Présentation R6 | PASS ; aucun fichier CSS modifié |
| TypeScript | PASS, `node node_modules/typescript/bin/tsc --noEmit`, sortie 0 |
| Next complet | PASS, `node node_modules/next/dist/bin/next build`, sortie 0, génération des pages et finalisation effectuées ; Windows/Node 22.18/Next 16.2.6, dépendances installées réutilisées, pas CI ni installation fraîche |
| Navigateur : Reload / archive / restore | PASS fixture. Même Draft `6c478bde-ec95-4375-9a42-cda3e20c26ba`, version 7 → 8 ABANDONED → 9 ACTIVE, même digest, vingt Contexts, SAVED/FRESH. Confirmation explicite, aucune PlanRevision |
| Navigateur : vraie Library / panneau / réponse perdue | PASS fixture. Clic Soirée → carte et panneau « Configurer Soirée », avertissement S2 visible. SAVE avec 503 après commit, relecture confirme le Draft : une seule écriture/version 1, SAVED/FRESH, console sans erreur capturée |
| Auth Supabase / vraie panne réseau / appareil supplémentaire | NOT_RUN pour P2. Offline/concurrence prouvés au harnais du hook, pas présentés comme JWT/RLS ou coupure physique du réseau |
| Glisser-déposer physique / mesure ouverture du panneau | NOT_RUN comme benchmark P1/P2 ; le panneau a été ouvert au navigateur, sans percentile propre |
| Capture image | ÉCHEC outil « Unable to capture screenshot » ; preuves DOM et serveur disponibles, aucune capture inventée |

Les tests de mutation ne font aucune écriture vers Supabase principal. Le host browser conserve uniquement des Drafts synthétiques en mémoire ; PGlite sert C0/Plan sur les tests isolés. Sur les deux séances : **plans=0, revisions=0, RPC Apply=0, écritures distantes=0, canaries historiques inchangés**. Les tests Apply P02/P13 exécutent leurs écritures exclusivement dans leurs instances PGlite. Aucune Operation, Purchase, PlannedExpense, MonthInput, Mobility observée, Wallet ou épargne réelle n'a été modifiée.

## D. Preuves et reproduction

Preuves versionnées : [`evidence/p14-p2`](evidence/p14-p2). `browser-comparison.json` est recalculable à partir des traces client et serveur assainies ; tous leurs montants/identités sont synthétiques. Les extraits serveur omettent les cockpits répétitifs. Les versions intégrales et les pilotes restent hors checkout produit dans le dossier Codex `outputs/p14-p2`. Les fichiers de build esbuild et le journal Next original restent également hors dépôt ; les espaces de fin de ligne du journal versionné ont été nettoyés sans retirer de résultat. `source-fingerprints.json` identifie les sources produit mesurées et construites ; les changements de pilote intervenus ensuite ne changent pas le produit.

Commandes réellement exécutées :

```text
node scripts/check-composer-p14-p2-mutation.mjs
node scripts/check-composer-p14-p2-scheduler.mjs
node scripts/check-composer-p14-p2-presentation.mjs
node scripts/check-composer-p14-p2-durable.mjs
node scripts/analyze-composer-p14-p2-results.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

La liste des quinze scripts de régression et leurs sorties est dans `regressions.json`; journaux individuels conservés. Le premier test de présentation avait demandé à stage un équipement nécessitant le serveur : assertion de harnais corrigée en conservant le fallback P1, puis quatre parités exécutées. Aucun changement produit pour faire passer ce test. Les exécutions Git/esbuild/build ont utilisé l'autorisation locale normale de lancer leurs sous-processus ; aucune protection de sandbox contournée.

Pour reproduire le navigateur : lancer `scripts/serve-phase2-planner-composer-fixture.mjs` sur deux ports loopback avec `PLANNER_P14_P2_MEASURE=1`, `PLANNER_P14_P2_WORLD_DELAY=120`, `COMPOSER_P14_P1_READ_REUSE=1`, un dossier distinct `PLANNER_C8_BROWSER_OUTPUT`, et esbuild via `PLANNER_BROWSER_TOOLS`. P1 : `PLANNER_P14_P2_VARIANT=P1`, `COMPOSER_P14_P2_SINGLE_WORLD=0`. P2 : variante P2 et drapeau 1. Ouvrir `/?scenario=P2_<identifiant_neuf>&durable=1` à la même résolution, cliquer « P2 — Exécuter la séance », puis attendre la fin des calculs secondaires avant `/evidence`. Le host produit des traces client dans son dossier de sortie ; le serveur doit rester réservé aux fixtures. Il ne charge aucun compte réel.

## E. Suite minimale, sans commencer P3

1. **Preview : coût de chaque READ World restant.** P2 n'accélère pas encore la lecture historique d'une intention distincte. Les mesures P1 restent la référence réelle, avec leurs réserves sur le garde final. Préparer P3 avec les manifestes/date/génération/permissions des hydratations par lieu/événement déjà identifiées, puis réduire seulement les sous-lectures admissibles. Pas de World inter-requêtes sans invalidation démontrée.
2. **UI : rendu des cartes, pas seulement digests.** Le CPU synchrone des ajouts P95 est 9,3 ms mais leur marque visuelle P95 est 286 ms. Mesurer un profil React de production contrôlé avant toute nouvelle modification des composants ; aucune refonte ou optimisation généralisée n'est justifiée ici.
3. **Calculs obsolètes distincts :** le debounce existant est utile uniquement si les événements arrivent avant son expiration. Conserver la priorité du dernier état ; ne pas promettre une annulation SQL avec un AbortController client.

Le timeout Canonical 57014 et sa cause inconnue restent ouverts ; ils n'ont pas été testés ni résolus par ces fixtures. Aucun snapshot nouveau n'est justifié par cette mission. Les modifications sont locales et réversibles ; le commit de clôture contient le produit, le pilote, les tests et ce rapport, descendant de P1. **Arrêt après P14-P2.**
