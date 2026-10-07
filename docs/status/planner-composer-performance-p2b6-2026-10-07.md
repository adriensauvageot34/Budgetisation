# Composer — lifecycle preview Centre P2-B.6 — 2026-10-07

**P2_B6 = PASS.** Le travail de preview est supprimé dans 11/12 passages de la série après ; le douzième quitte tardivement et conserve sa preview déjà démarrée. Les 38 parcours valides sont conservés. Parités Centre et Composer complètes, aucun write métier distant.

HEAD_BEFORE : `6070aa6aba8cc334315dd2e9fead07f64f9753c4`, branche `main`, checkout propre au départ. R5 inclus. HEAD_AFTER produit : `e306ca7bab1c3bf645ec7a1608bfa03f1afb5b65`. Le commit de documentation suit ce HEAD ; son propre SHA n'est pas autoréférencé dans le rapport.

Mesures publiques : [JSON P2-B.6](planner-composer-performance-p2b6-metrics-2026-10-07.json). Les traces privées restent hors Git.

## Audit du lifecycle initial

L'effet de `MonthControlCenter` attend `sessionReady`, un Centre ouvert, éditable, section `choices`. Avec `composerHref`, seul un focus `pilot…` est exclu. L'accueil normal a `focus=null` : la preview démarrait donc sur un timer de **0 ms** sans draft, ou **180 ms** avec opérations. La clé de déduplication contenait `baseDigest`, purpose et opérations.

Le premier écran (`MonthWorkspaceRoot`), le header, les cagnottes, les facts et les réglages utilisent le **model serveur déjà reçu**. Ils n'attendent pas `trial`. Les vues V2 de simulation `MonthPilotIndex/Editor/Review/Saving` utilisent le workbench et `activeTrial`. Le flow legacy sans Composer exige donc de conserver le déclenchement immédiat et le debounce des edits.

Le clic Piloter appelle `router.push(composerHref)` immédiatement. L'ancien cleanup annulait seulement un timer au démontage. L'action déjà partie continuait à lire ses 27 GET, même lorsque Next abandonnait la lecture de la réponse. Aucune surface Composer ne consomme ce résultat V2.

`previewMonthControlCenter` appelle `decisionContext(targetMonth)`, vérifie le mois et l'acteur authentifié, relit forecast/MonthInputs/PlannedExpenses puis appelle le workbench financier existant. Ni cette signature ni les owners downstream n'acceptent un AbortSignal. Les signaux trouvés dans l'action-handler Next installé concernent la lecture/décodage du corps ; ils ne sont pas transmis aux queries métier.

## A / B / C et choix

| Stratégie | Verdict | Motif |
|---|---|---|
| A — lazy/defer | retenue | L'accueil utilise déjà le model serveur ; une preview automatique peut être planifiée brièvement. |
| B — abort serveur | non disponible ici | Aucun signal transmis de l'action aux owners Supabase. Ajouter cette infrastructure dépasserait le lifecycle et les interdits de la passe. |
| C — intention de départ | retenue avec A | Annulation synchrone du timer et invalidation de la requête avant push/replace. |

**DEFER + CANCEL BEFORE START** : 800 ms uniquement pour l'accueil neutre, avec Composer disponible et sans draft. Ce délai inférieur à une seconde laisse le temps d'une orientation/clic rapide de 100–500 ms ; aucune donnée de l'accueil ne dépend de sa fin. Ce n'est pas un délai artificiel de cinq secondes. Une entrée dans une vue focused flush immédiatement la preview planifiée ; les opérations explicites gardent leur debounce de 180 ms. Sans Composer, V2 reste immédiat. Si l'utilisateur reste, la preview est exécutée normalement.

**CLIENT_CANCEL** signifie : timer supprimé avant démarrage, numéro de requête invalidé, réponses/erreurs obsolètes ignorées. **SERVER_CANCEL n'est pas implémenté**. Si le timer a déjà lancé l'action avant le clic, le serveur termine ses reads ; le client ignore seulement la réponse. Les tests couvrent les deux ordres à cette frontière. Aucune utilisation de `reader.cancel()` comme preuve d'arrêt Supabase.

## Diff produit et identité

Un seul fichier produit change : `src/app/mois-a-venir/month-control-center.tsx`.

- Annulation avant les deux chemins push, le redirect replace, fermeture et unmount.
- Reprise lors d'une réouverture ou d'un retour popstate, même si le focus est identique.
- Identité locale : mois + publication + baseDigest + purpose + opérations. Guard monté/départ/séquence/autorité pour succès et erreur.
- Un changement d'autorité invalide le résultat et le timer sans réactiver une preview pendant un départ.
- État de chargement propre à la preview actuelle : une ancienne action lente ne maintient pas le nouveau scénario en loading. Le useTransition des mutations V2 reste utilisé.

Pas de nouveau calcul financier, nouveau provider, cache, persistence, EventBus ou scheduler global. Household/Auth sont relus par l'action existante. Cutoff/facts/sourceRefs restent détenus par les owners serveur ; aucune preview n'est recyclée entre mois/publications. Le parent monte déjà le Centre avec `key={targetMonth}`.

Les 45 GET document Centre et les 291 GET Composer ne sont pas optimisés. M7, Canonical, Purchase-aware, selects, batching, pagination et prefetchs ne changent pas. Aucun SQL/index/migration/snapshot. P2-C non commencé.

## Protocole readonly

Deux copies locales isolées, Next 16.2.6 de production, instrumentation identique. **Les deux copies utilisent la variante `b` du préparateur**, donc M7 P2-B courant dans les deux : les étiquettes a/b de mesure désignent seulement avant/après P2-B.6. La copie avant vient de 6070aa6 ; la copie après possède exactement le TSX du HEAD produit final. Aucun rollback du checkout.

Avant tout patch produit : 12 rapides + 3 stay + 3 documents directs + 1 interaction Centre. Après : mêmes 19 parcours. Délais pré-déclarés alternés 100/500 ms après visibilité du bouton Piloter. Les coûts d'entrée dans le Centre et les retards de dispatch sont conservés, pas retranchés. Aucun wait sur la preview dans le chemin rapide.

Chaque parcours utilise un nouveau browser context, même mois `2026-10`, viewport CSS 1728×900, cookies en mémoire, aucun draft/cache Router réutilisé. TTI Composer : Board hydraté et recherche native Library exécutée puis effacée, comme P2-A/P2-B.5. Contrôle stay : fin de l'action readonly puis 500 ms. Interaction réelle : entrée dans Mes cagnottes pendant la fenêtre initiale ; les edits nécessitant trial sont également exercés dans les tests du composant V2.

Capture depuis avant le document parent : HTTP roots, reads métier attribués, action, prefetchs, RSC, chunks, CPU du processus et snapshots **hash-only** du modèle Centre/workbench entier. Un profil navigateur/serveur par version, premier run conservé. CPU = différence `process.cpuUsage()` avant le parcours et après TTI, incluant document parent et orchestration ; pas une attribution exclusive à la preview.

Un seul serveur Next actif pendant chaque série ; le précédent est arrêté avant la suivante. Builds/typechecks/suites lourdes terminés avant les fenêtres de mesure. Séries séquentielles avant/après, **pas des paires randomisées** : les écarts wall-clock sont observationnels. Les contrôles directs servent à repérer la variance de campagne.

Le renouvellement réel de session Supabase est vérifié hors fenêtre de mesure, avant la série après : même acteur, cookie renouvelé en mémoire. Ce POST Auth n'est pas une écriture métier. L'action locale `previewMonthControlCenter` est la seule action POST allowlistée ; autres actions locales, mutations REST/Storage distantes et RPC sont bloquées. Aucun Apply réel, migration ou écriture distante métier.

Traces privées : `C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-performance-p2b6`. Cookies, tokens, prédicats bruts, profils et données de banque ne sont pas committés. Les métriques publiques contiennent uniquement hashes, compteurs et timings.

## Mesures et parités

Toutes les médianes rapides ci-dessous incluent les 12 runs par version, premier run profilé et passage tardif compris.

| Mesure | Avant | Après | Delta |
|---|---:|---:|---:|
| Centre document GET | 45 | 45 | 0 |
| Preview V2 GET par passage | 27 | 0 dans 11/12 ; 27 dans 1/12 | −297 lectures sur 12 passages |
| Composer GET | 291 | 291 | 0 |
| Total parcours GET, médiane | 363 | 336 | −27 |
| Total parcours GET, moyenne | 363 | 338,25 | −24,75 |
| Preview started | YES, 12/12 | YES, 1/12 | 11 lancements évités |
| Preview completed côté serveur | 12/12 | 1/12 | action déjà partie non interrompue |
| Durée preview, médiane | 8 023 ms | 0 ms | −8 023 ms de travail wall concurrent médian |
| Preview overlap, médiane | 7 479 ms | 0 ms | −7 479 ms de concurrence médiane |
| Centre ouverture → clic, médiane | 845 ms | 810 ms | −35 ms |
| Composer first response, headers depuis clic | 77 ms | 68 ms | −9 ms |
| Composer first chunk depuis clic | 85 ms | 78 ms | −7 ms |
| Composer RSC complete depuis clic | 23,137 s | 18,966 s | −4,171 s |
| Board visible depuis clic | 23,674 s | 19,838 s | −3,836 s |
| Composer TTI depuis clic | 23,931 s | 20,153 s | **−3,778 s (−15,8 %)** |
| End-to-end depuis arrivée parent | 30,373 s | 29,643 s | **−0,730 s (−2,4 %)** |
| CPU serveur total du parcours | 14,657 s | 14,141 s | −0,516 s (−3,5 %) |

**WORK_REMOVED** : 324 GET de preview avant, 27 après, soit **297 GET réellement évités / 91,7 % de cette charge** sur la série. Pour les onze sorties avant démarrage : 45 + 0 + 291 = 336. Pour `after-06` : 45 + 27 + 291 = 363. Aucun read partiellement annulé n'est présenté comme supprimé.

`after-06` avait un délai demandé de 500 ms, mais le clic effectif est enregistré **1 377 ms après visibilité du bouton / 2 591 ms après ouverture**. La preview était déjà partie : durée serveur 22,365 s, overlap 21,118 s, TTI 38,762 s. C'est un incident de timing/charge observé, pas un run exclu ni une promesse d'annulation serveur. Les onze autres runs après n'ont aucun POST preview ni aucun GET qui lui soit attribué. Les compteurs déterministes testent aussi les deux ordres précis à la frontière du timer de 800 ms.

**USER_VISIBLE_GAIN** : gain observé de 3,778 s depuis le clic, seulement 0,730 s de bout en bout. Les 27 GET ne valent donc pas automatiquement 8–9 secondes gagnées. Le document parent est plus lent dans la série après : médiane 3,739 → 4,483 s ; préparation/hydratation/browser apportent aussi de la variance. P95 TTI 33,749 → 38,762 s à cause du passage tardif conservé : aucune certification d'un gain P95 ou d'un SLA production.

### Contrôles négatifs et stay

| Contrôle | Avant, n=3 | Après, n=3 | Invariants |
|---|---:|---:|---|
| Document direct Composer, TTI | 16,426 s | 15,190 s | 291 GET, aucune preview, même DTO et queries |
| Document direct, plage TTI | 15,246–17,959 s | 14,409–18,757 s | plages chevauchantes |
| Stay Centre, preview serveur | 6,585 s | 7,422 s | 27 GET et workbench entier identique |
| Stay Centre, ouverture → fin du contrôle | 7,359 s | 9,303 s | includes délai initial + fin réseau + attente de vérification 500 ms |
| Interaction Centre, fin du contrôle | 9,803 s | 9,993 s | modèle/preview identiques, focused flush |

Le contrôle direct varie de −1,236 s (−7,5 %) sans chemin de preview ni montage du Centre. Il signale bien la variance/possibilité de contamination de campagne. Vérification de scope : comparaison byte-à-byte de **903 fichiers `src` entre copies**, une seule différence, `app/mois-a-venir/month-control-center.tsx` ; aucun caller Centre dans la route Composer. Query multisets, DTO, nombre de reads et owners du contrôle direct sont identiques. Cela écarte une modification du travail Composer, mais n'attribue pas toute la différence wall-clock au patch. Séries séquentielles et trois contrôles seulement : pas d'intervalle causal ni de garantie de gain reproductible de 3,778 s.

Les stays montrent la preview disponible normalement avec son résultat entier inchangé. Le coût initial de 800 ms est attendu en arrière-plan sur l'accueil déjà rendu ; il est supprimé lorsqu'une vue focused est ouverte. La durée serveur stay augmente aussi de 837 ms dans cette campagne sans changement du code de preview. Les résultats ne sont pas tronqués pour masquer ce déplacement temporel.

### CPU / GC et limites de capture

CPU médian de parcours : 14,657 → 14,141 s. Ce compteur couvre l'ensemble du processus pendant document parent et navigation, pas une mesure isolée du coût CPU des 27 reads. Un seul run profilé de chaque version, conservé : GC serveur échantillonné sur clic → TTI **499,278 → 183,088 ms** ; GC navigateur **55,215 → 32,861 ms**. Ce sont des observations de ces deux runs, pas des médianes de GC ou une preuve de causalité. M7 ne change pas ; son travail échantillonné peut varier avec la présence du workbench concurrent.

Comme P2-B.5, le wrapper fetch Next contourne l'observer du corps REST : **body observations = 0, body bytes = null**, et non « zéro octet transféré ». La concurrence des GET mesurée à ce niveau est start→headers. Les streams CDP annulés `net::ERR_ABORTED` après HTTP 200 sont conservés ; pas d'erreur transport métier, d'exception navigateur ni de requête bloquée. Board et interaction native passent dans tous les contrôles Composer. Les octets `loadingFinished` sont seulement le sous-ensemble observé des streams achevés.

### Parité complète

- Centre initial + modèle retourné par chaque preview : **51 519 octets**, SHA256 `cc83e7f7d6f6bc3f121fb8007e3eb0ea1f6373d17b3449c97e93cc4a7a547bfc`.
- Workbench readonly complet : **136 584 octets**, SHA256 `59cb6b3e67c0fc0c62c862dd6c54bb8da05efa6bdf826b15fdcd1b90fbb36e5c`.
- BaseDigest Centre : `94787bb6ab6a4f294213ead540ca1ec1e78cc36dff72143f6a3883c30f28f852` ; mois `2026-10` partout. Texte DOM initial/final des stays identique.
- DTO Composer complet : **273 000 octets**, 15 cards, 0 Contexts, 141 assets ; SHA256 `b51c6c528e97eb4b5d155c9a5dc0bc4351a4e11929c276c9b2d1d8c207cfaadb` dans tous les 30 contrôles Composer.
- Semantic state digest UI : `f523db27e084e00fced4a18fd452416794764476743b4e676236479bd1a1d7f1`.
- Multiset de queries Composer : `43c02ddae06070c793dfb7b10bb46f2b436ef3136462a5356e5db23729198433`, même mois et mêmes prédicats. Uniquement le `validated_at=lte.<fresh-cutoff>` habituel est normalisé, après vérification qu'il se situe dans la fenêtre de la requête ; aucune autre valeur normalisée.
- Forecast, amounts, alerts/cards, diagnostics, UNKNOWN/sourceRefs du Centre sont inclus dans le modèle entier hashé. Le DTO UI entier vérifie les cards, projection, capabilities, semantic state et sourceRefs exposés. Les **22 goldens synthétiques**, avec neuf hashes par cas, vérifient également Baseline, semantic manifest, fullBusiness, knowledge et identities/sourceRefs, y compris composite/UNKNOWN/renewals/mobility/funding.
- Prefetchs inchangés et **0 GET métier** dans chaque trace de prefetch. Aucun read Composer déplacé vers un autre owner pour obtenir 291.

## Tests et incidents

`check-control-center-preview-lifecycle.mjs` exécute le TSX réel avec hooks/timers/actions différées déterministes. Les stubs concernent uniquement l'environnement UI et la réponse readonly ; aucune formule financière n'est recopiée. La campagne Chromium complète les tests de lifecycle avec React réel.

27 cas : planification courte, stays, sorties à 100/500 ms, départ après lancement, double clic, retour, close/reopen, popstate, cleanup, replay setup/cleanup de Strict Mode, unmount/remount, changement de mois/publication même digest, ordre des réponses, réseau lent, erreur actuelle/obsolète, rafraîchissement d'autorité et stale digest, payload et debounce des edits, redirect, autorité rafraîchie pendant départ, loading libéré malgré ancienne action pendante, deux ordres exacts à la frontière du timer. Ce harness teste le replay des effets ; il ne prétend pas monter un vrai root StrictMode navigateur.

Sur 6070aa6, le nouveau test échoue correctement dès le premier oracle de defer (`1 !== 0`). Après patch : tous passent. Deux anciennes assertions statiques pinnaient la variable `previousDigest` et l'expression de clé sans mois ; elles ont été remplacées par les oracles comportementaux du lifecycle, sans changement de leurs assertions métier.

Les premiers lancements de suites Undo manquaient `SUPABASE_SECRET_KEY` : `UNDO_KEY_UNAVAILABLE`. Relance avec **clé synthétique de test**, dans les harnesses mémoire uniquement. Aucun secret distant fourni à ces tests. `npx` absent du PATH : typecheck lancé directement par `node node_modules/typescript/bin/tsc --noEmit`. Échecs de harness corrigés : prototypes VM lors des comparaisons de payload, URL relative du history mock, traversal JSX et commit des updates avant d'avancer l'horloge. Ce ne sont pas des incidents réseau produit.

Typecheck final et build après patch passent. Suites finales : Centre, Centre v4/v5, choices UX, human UX, spatial UX, month decisions, category targets/choices, savings allocations, architecture et 22 goldens complets Planner performance parity. Les Apply/Undo de ces suites restent **synthétiques en mémoire**, jamais distants.

## Commits et gate

1. `f6cad9c` — `test(perf): guard control center preview lifecycle`.
2. `e306ca7` — `perf(control-center): avoid unused preview before composer navigation`.
3. Documentation/certification : commit suivant, incluant les outils d'audit et métriques publiques.

Les deux derniers oracles de frontière sont ajoutés au commit de certification ; ils ne modifient aucun fichier produit mesuré. Outils d'audit : `audit-composer-navigation.mjs`, `analyze-control-center-preview-performance.mjs`, `analyze-composer-navigation-profiles.mjs`, `lib/control-center-performance-probe.cjs`. Certification exécutable : `node scripts/analyze-control-center-preview-performance.mjs <private-audit-root> --certify` ; elle vérifie aussi l'incident tardif conservé au lieu de supposer que tout POST a été annulé.

```ini
P2B6_PREVIEW_LIFECYCLE_UNDERSTOOD = PASS
CONTROL_CENTER_STAY_BEHAVIOR = PASS
CONTROL_CENTER_RESULT_PARITY = PASS
FAST_COMPOSER_NAVIGATION_PREVIEW_WORK_REDUCED = PASS
COMPOSER_GET_COUNT_UNCHANGED = YES
COMPOSER_DIGEST_PARITY = PASS
UNKNOWN_PARITY = PASS
SOURCE_REF_PARITY = PASS
PREFETCH_UNCHANGED = YES
REMOTE_BUSINESS_WRITES = 0
MIGRATION_REQUIRED = NO
P2_C_NOT_STARTED = YES
SNAPSHOT_NOT_STARTED = YES
FRONTEND_REFACTOR_NOT_STARTED = YES
P2_B6 = PASS
```

Avant P2-B.6, le parcours Centre → Composer déclenchait 45 GET du Centre + 27 GET de preview V2 + 291 GET Composer, soit 363. Après P2-B.6 : 45 + 0 + 291 = 336 pour 11/12 passages ; le départ tardif conservé reste à 363. La preview V2 est différée et ne démarre plus lorsque le départ intervient avant son timer ; une action déjà partie continue côté serveur.

Lorsque l'utilisateur reste sur le Centre, le résultat fonctionnel reste identique. Composer reste à 291 GET et ses digests sont inchangés. Le gain utilisateur observé est de 3,778 s depuis clic et 0,730 s de bout en bout ; le travail supprimé est de 297 GET de preview sur la série de 12. P2-C peut maintenant commencer, mais n'est pas lancé. Aucun push ni déploiement.
