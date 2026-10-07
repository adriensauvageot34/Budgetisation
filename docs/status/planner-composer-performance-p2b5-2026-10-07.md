# Composer — audit navigation client P2-B.5 — 2026-10-07

**P2-B.5 terminé : régression relative non reproduite, différence document/client expliquée.** P2-B est plus rapide dans chacune des 12 paires alternées. La preview V2 concurrente reste une charge réelle du parcours Centre ; le parcours complet n'est pas déclaré optimisé.

HEAD_BEFORE : `605236226777f060aa85a943071dc3933357db66`, main propre, P2-B et R5 inclus. R5 `3eba1887571aa649696a21beb0e642495d188fab` est vérifié comme ancêtre. Aucun correctif produit pendant cette passe, aucun push ni déploiement.

Mesures publiques : [JSON P2-B.5](planner-composer-performance-p2b5-metrics-2026-10-07.json). Les traces privées restent hors Git.

## Protocole fixé avant les mesures

Deux copies jetables hors Git, builds Next 16.2.6 de production, même environnement et même instrumentation. A charge uniquement le fichier M7 pré-index figé au commit `47a59e0fda43f39e2107bbcde33091a27fb3ebdd`, SHA256 `0494c704a174202d8e4dce9eb981f7e7000dd32979bbc6d152a45b48477d74ba`. B utilise le code P2-B actuel. Tous les autres fichiers produit sont identiques. Aucun rollback du checkout, frontend, query, migration, snapshot ou correction.

Douze paires de navigations Centre → Composer, **12 A + 12 B**, ordre AB aux paires impaires, BA aux paires paires. Puis 3 contrôles par version avec attente de fin de preview V2, et 3 ouvertures document directes par version. Même mois explicite `2026-10`, viewport CSS 1728×900, critère TTI natif P2-A inchangé : Board hydraté puis recherche Library traitée. Les contextes navigateur neufs évitent de réutiliser un cache Router ou un draft de session ; leurs cookies sont copiés en mémoire. Les premières paires incluent un profil serveur et navigateur de chaque version et restent dans les statistiques principales.

Le chemin rapide ouvre le Centre, attend le socket Piloter visible puis 100 ms, et clique sans attendre la preview V2. Le contrôle calme attend la réponse complète de cette même preview, puis 500 ms. Le contrôle document direct évite le Centre, avec le même mois ; il ne prétend pas reproduire un reload d'une page déjà chaude. Le wall depuis le départ, le temps du Centre et le temps depuis le clic sont tous conservés : attendre davantage avant le clic ne constitue pas un gain de bout en bout.

Capture complète depuis avant l'arrivée sur la page parent : GET du Centre, POST de preview, GET RSC Composer, prefetch, chunks, réponse streamée, CPU, long tasks et mémoire du processus. Aucun reset de trace après l'ouverture du Centre. La preview autorisée est identifiée par son export `previewMonthControlCenter` dans le manifest du build. Toute autre action POST locale, mutation REST/Storage métier ou RPC Supabase est bloquée.

Les reads réels restent distants et readonly. Les données de session, query values et profils bruts restent privés dans `C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-performance-p2b5`. Aucune donnée bancaire personnelle n'est committée. Chaque série valide est retenue, y compris la première paire profilée et les runs lents. Les erreurs de préparation sont enregistrées séparément.

## Ce que montrent déjà les traces P2-B antérieures

Les 20 accès utilisent tous `phase2_month_inputs.target_month=eq.2026-10-01` : l'écart hard/client ne provient pas d'un mois différent.

Chaque navigation client rapide possède une preview V2 avec **27 GET métier**, qui chevauche les **291 GET Composer**. Les cinq hard refreshs de chaque état n'ont pas cette preview. La durée de la preview, dont le code ne change pas entre A/B, est de 6–8 s avant et 9–16 s après dans la campagne séquentielle précédente. Les réponses de prefetch des autres routes ne lancent aucun GET métier dans ces captures.

Le code `month-control-center.tsx` ouvre un root sans focus pilot ; son effet déclenche `previewMonthControlCenter` dès que le Centre est ouvert/éditable. Le clic pilot appelle `router.push(composerHref)`. Le timer est annulé à l'unmount, mais une action serveur déjà lancée reste une requête concurrente. Le code Next installé `app-router-instance.js` donne priorité à la navigation et marque l'action pending comme discarded ; il ne place pas la navigation derrière la fin de cette action. Ces mécanismes sont vérifiés par les timings, pas déduits d'une seule première réponse RSC.

## Résultat des 12 paires alternées

TTI natif en secondes depuis le clic Piloter ; la première paire profilée est conservée.

| Paire | Ordre | Avant index A | P2-B B | B − A |
|---|---|---:|---:|---:|
| 01 | AB | 45,529 | 28,616 | −16,913 |
| 02 | BA | 36,380 | 23,583 | −12,797 |
| 03 | AB | 34,438 | 24,461 | −9,977 |
| 04 | BA | 33,071 | 20,662 | −12,409 |
| 05 | AB | 34,367 | 21,262 | −13,105 |
| 06 | BA | 35,408 | 21,311 | −14,097 |
| 07 | AB | 34,035 | 21,918 | −12,117 |
| 08 | BA, reprise | 30,246 | 24,101 | −6,145 |
| 09 | AB | 70,375 | 36,187 | −34,188 |
| 10 | BA | 51,755 | 29,304 | −22,451 |
| 11 | AB | 47,448 | 39,497 | −7,951 |
| 12 | BA | 36,263 | 24,758 | −11,505 |

Les 12 différences sont négatives, dans les deux ordres. Médianes appariées : **35,836 → 24,281 s**, soit −32,24 %. Différence médiane des paires : **−12,603 s** ; intervalle bootstrap apparié local 95 %, 10000 tirages à seed fixe : **[−15,505 ; −10,741] s**. Cet intervalle descriptif suppose les paires rééchantillonnables ; il ne garantit pas une latence en production ni l'indépendance de la charge système.

Un treizième B valide, **41,457 s**, précède un A en erreur réseau dans une paire interrompue. Il reste publié et inclus dans les statistiques par version, sans être artificiellement apparié. Ainsi la médiane de **tous** les clients rapides B est **24,461 s**, n=13 ; A n=12 reste 35,836 s. Aucun run lent valide retiré : A atteint 70,375 s et B 41,457 s.

## Contrôles de parcours

Chaque contrôle compte 3 observations par version ; les clients rapides comptent 12 A et 13 B. Le bout en bout part du début de l'essai, avant la requête parent, et inclut la préparation navigateur. Les médianes de colonnes ne doivent pas être additionnées.

| Parcours | TTI A depuis clic | TTI B depuis clic | Bout en bout A | Bout en bout B |
|---|---:|---:|---:|---:|
| Centre → Composer rapide | 35,836 s | 24,461 s | 42,034 s | 36,896 s |
| Centre → Composer, preview déjà terminée | 23,876 s | 18,252 s | 38,490 s | 35,256 s |
| Ouverture document directe | 23,924 s | 15,751 s | 24,442 s | 16,086 s |

Le contrôle calme garantit **zéro chevauchement** preview/Composer. L'attente avant clic est cependant payée : chez B, le temps Centre-ouvert → clic est médian 13,189 s contre 0,455 s sur le chemin rapide. Son TTI plus court ne justifie donc pas de remplacer le parcours par une attente obligatoire. Ces contrôles sont peu nombreux et réalisés après la série rapide : ils montrent la différence de charge et de timing, sans isoler causalement un coût exact de la preview.

## Requêtes du Centre et preview concurrente

| Requête propriétaire | GET métier par essai | Effet observé |
|---|---:|---|
| Document parent `GET /mois-a-venir` | 45 | Forecast et modèle du Centre, avant clic |
| Action locale readonly `POST /mois-a-venir` | 27 | `previewMonthControlCenter`, démarre à l'ouverture du Centre |
| `GET /mois-a-venir/composer` | 291 | RSC client ou document direct, mêmes queries comparables |
| Prefetch des autres routes | 0 | Shells RSC, aucun owner métier exécuté |

Le parcours client fait donc **363 GET métier au total**, contre **291** pour le document direct. Les GET Auth sont exclus de ces comptes. Les 27 GET de preview couvrent notamment `operations` ×3, `phase2_month_inputs` ×2, `financial_economic_cost_canonical` ×2, `analytics_query_snapshots` ×2, `households` ×2, wallets, needs, mobility et Purchase-aware sources. L'inventaire intégral par table, count et timing de réponse est dans le JSON public, sans predicates personnels ni corps de réponse.

Sur les clients rapides, preview médiane **10,587 s A / 9,005 s B** ; chevauchement avec Composer **10,415 s / 8,829 s**. Le serveur commence Composer avant la fin de preview dans tous ces essais. La navigation prend donc effectivement priorité côté Router ; elle ne bloque pas jusqu'à la réponse de l'action. L'action déjà envoyée continue son travail serveur. Le contrôle calme finit cette même action avant navigation.

Les cinq routes de prefetch observées sont `/diagnostic`, `/operations`, `/analyse-globale`, `/mois-a-venir`, `/historique`. Les 37 essais vérifient leurs propres racines HTTP GET : **aucun GET métier** associé. Une première association d'analyse par path et timestamp seulement attribuait deux POST de preview au prefetch `/mois-a-venir` ; le matcher tient maintenant compte de la méthode et de la racine la plus proche. Les traces brutes ne sont pas modifiées.

La charge navigateur médiane du parcours rapide est de **45 requêtes locales**, dont **22 assets statiques**. Leur transfert encodé est identique à 9 octets près : **792415 octets A / 792406 B**. Le réseau client ne reçoit pas un bundle grossissant de plusieurs secondes après P2-B. Le JSON distingue les octets réellement observés et les streams sans `loadingFinished` complet.

CDP signale aussi `net::ERR_ABORTED`, `canceled=true`, sur des prefetchs, des réponses de preview et certains streams Composer **après HTTP 200**. Ces signaux sont conservés ; aucune erreur de transport non annulée dans les essais valides. Next installé possède des appels `reader.cancel()` / `responseBodyClone.cancel()` dans `fetch-server-response.js`. On ne confond pas ces annulations côté lecteur avec le fetch Supabase en erreur de la paire interrompue, ni avec l'annulation du travail serveur : les racines serveur finissent en 200, et le Board/recherche natifs sont vérifiés. La somme des seuls `loadingFinished.encodedBytes` est donc un sous-ensemble observé, pas la taille complète du transfert.

## RSC, CPU navigateur et serveur

Le premier fragment RSC n'est pas le Board prêt. Sur les clients rapides :

| Depuis clic, médiane | A | B, tous valides |
|---|---:|---:|
| Premiers headers serveur | 0,123 s | 0,095 s |
| Premier write streamé | 0,142 s | 0,116 s |
| Réponse RSC terminée | 34,976 s | 23,743 s |
| Board observé | 35,626 s | 24,232 s |
| TTI Library native | 35,836 s | 24,461 s |
| Fin stream → TTI | 0,917 s | 0,892 s |
| Somme long tasks navigateur | 0,824 s | 0,864 s |

Les owners backend restent le chemin dominant. `loadPurchaseAwareCanonical` dure médian **24,363 → 14,476 s**, et le builder M7 instrumenté **11,216 → 1,194 s** sur les clients rapides ; les spans imbriqués et le travail concurrent ne sont pas additionnables. Aucun calcul financier local nouveau ni payload réduit.

La paire 01 fournit les profils V8 serveur/navigateur alignés sur la fenêtre clic → TTI ; les sourcemaps serveur identifient les sources. **Un seul profil par variante**, conservé dans les statistiques, et non une moyenne de campagne :

| Temps échantillonné, fenêtre client | A | B |
|---|---:|---:|
| Serveur, M7 et descendants | 13,829 s | 2,090 s |
| Serveur, GC | 3,851 s | 0,673 s |
| Serveur, idle | 8,131 s | 8,837 s |
| Navigateur, idle | 41,231 s | 25,702 s |
| Navigateur, autre CPU JS échantillonné | 1,963 s | 1,333 s |
| Navigateur, program non attribué | 2,197 s | 1,510 s |

Environ 90 % du profil navigateur de cette fenêtre est idle, ce qui écarte un blocage React de dizaines de secondes comme explication dominante de cette paire. Le profil serveur inclut les deux requêtes concurrentes, le GC et le coût des probes ; il n'isole pas magiquement le CPU de preview. Parmi les coûts restants figurent la sérialisation/hash Canonical et les owners forecast. Aucun nom métier n'est deviné pour les frames minifiées sans sourcemap.

## Variance et limites de la conclusion

L'ancienne campagne séquentielle donnait **27,975 → 35,389 s** en client (+26,50 %) et **35,957 → 18,155 s** en hard refresh. La preview concurrente, dont le code n'avait pas changé, passait alors de **7,364 à 15,285 s** médianes. Le même mois et les mêmes 291 queries excluent un écart de cible ; la série alternée inverse la régression dans les 12 paires et le profil retrouve la réduction M7 attendue.

**Conclusion : l'ancienne régression relative est compatible principalement avec la variance de campagne/charge, et n'est pas un effet P2-B reproduit.** La charge supplémentaire du chemin Centre est prouvée indépendamment. On ne peut attribuer exactement chaque seconde de l'ancien écart à Supabase, au réseau, au GC ou à Windows avec ces traces ; cela ne devient pas une promesse de rapidité sur Vercel.

Dans la nouvelle série, les réponses GET Composer jusqu'aux headers ont une médiane des médianes de **697 ms A / 638 ms B** ; le maximum par essai a une médiane de **13,314 / 6,680 s**. Ces temps incluent le scheduling du processus Node et ne représentent pas une latence réseau pure. Jusqu'à **46 GET en vol vers les headers** sont observés. Le wrapper `fetch` de Next contourne les hooks `response.text/json` de cette copie : **aucun body REST mesuré**, donc bytes REST `null`, et concurrence calculée jusqu'aux headers seulement. On ne transforme pas cette absence d'observation en zéro réseau. Les chunks HTTP et tailles du DTO sont effectivement observés.

Les samples mémoire 1 Hz montrent de la pression sur le poste : minima de RAM disponible **14,32 MiB A / 45,82 MiB B**, notamment durant la paire 09 lente ; RSS maxima des processus actifs **490,85 / 491,25 MiB**. Une faible RAM est une observation de charge, pas une mesure de paging ni une preuve de causalité. Deux processus Next vivent simultanément mais un seul essai est dispatché à la fois ; la campagne précédente n'utilisait pas exactement ce protocole. Les cinq paires post-reprise restent plus rapides en B comme les sept premières.

Le critère Board hydraté puis recherche native est conservé, mais le polling de readiness passe de 400 à 100 ms. L'observation peut donc gagner environ 300 ms par rapport à l'ancienne campagne. Les nouveaux contextes navigateur neufs changent aussi les caches client. Ces différences empêchent d'assimiler les valeurs absolues des deux campagnes ; elles sont identiques entre A et B dans les 12 paires actuelles. Les contrôles document sont des ouvertures fraîches, distinctes du reload `ignoreCache` antérieur.

## Parité, incidents et vérifications

Les **903 fichiers `src`** des deux copies ont été hashés : seule `analytics/global-v2/mobility-context.ts` diffère. Le source du Centre est identique, SHA256 `3350569a9b2579c40fb718a8679c6ab99ba5de2f2f64ac39128696417190e7a1`. Les 37 résultats UI ont exactement **273000 octets**, **15 cartes, 0 contexte, 141 assets**, hash complet commun `b51c6c528e97eb4b5d155c9a5dc0bc4351a4e11929c276c9b2d1d8c207cfaadb`.

Le multiset des queries Composer est identique au hash comparable `43c02ddae06070c793dfb7b10bb46f2b436ef3136462a5356e5db23729198433`. La seule valeur normalisée est le cutoff frais `person_habit_assertions.validated_at=lte.<fresh-cutoff>`, **une fois** par essai, borné dans sa requête Composer ±100 ms. Toutes les autres valeurs sont comparées littéralement, puis hashées. Il ne s'agit pas d'une affirmation d'égalité de timestamps frais.

Incidents conservés dans les artefacts privés :

- Setup initial : dossier de redirection absent et cadrage stdin Auth corrigé avant toute mesure. Aucun credential enregistré dans les rapports.
- Preflight : selector mal échappé, exception avant ouverture du Centre. Trace séparée, aucun TTI déclaré ; selector d'audit corrigé.
- Première paire 08 : B valide 41,457 s conservé ; A rencontre `TypeError` de fetch Supabase, dont une attente d'environ 52,81 s, puis timeout readiness. La cause réseau exacte reste inconnue. Trace séparée conservée ; le contrôle HTTPS readonly retrouve ensuite une réponse en 416 ms. Les deux serveurs et le navigateur d'audit sont redémarrés, mêmes builds, Auth renouvelée ; toute la paire BA est reprise. Le A en erreur n'est pas converti en succès ni en latence comparable.

**36 essais du plan + 1 B valide supplémentaire** : aucune exception navigateur, aucun HTTP métier en erreur, aucun blocage de mutation tenté, aucun drain incomplet. Zéro écriture métier distante ; seules les Auth de bootstrap et les actions locales readonly prévues sont utilisées. Aucun Apply, RPC, migration, reset ni modification historique. La restriction humaine sur les tests distants en écriture reste respectée.

Vérifications effectivement exécutées :

- Deux builds Next production **PASS**, TypeScript du build **PASS**, compilation A 81 s / B 90 s ; 8 pages statiques générées par build, route Composer présente.
- `node scripts/check-composer-performance-probe.mjs` **PASS**, 8 checks ; 3 mutations synthétiques bloquées, zéro réseau distant.
- `node scripts/check-composer-navigation-probe.mjs` **PASS**, flags RSC/prefetch, stream, métadonnées de réponse et non-exposition de credential/action/body ; 3 mutations synthétiques bloquées, zéro réseau distant.
- `node --check` sur les 6 nouveaux helpers JS **PASS**.
- `node scripts/analyze-composer-navigation.mjs <audit-root> --certify` **P2B5_READONLY_MEASUREMENT_CERTIFICATION PASS** : 36 essais planifiés, 12 paires, parité queries, 291/27/45 GET, zéro write, preview readonly 200, prefetch sans owner, viewport 1728×900, Library native.
- `node scripts/analyze-composer-navigation-profiles.mjs <audit-root>` **PASS**, sourcemaps/horloges alignées.

Les 26 suites produit et le typecheck distinct certifiés par P2-B ne sont pas revendiqués comme rejoués dans P2-B.5 ; cette passe ne modifie aucun fichier produit. Les processus Next/Chromium lancés pour cet audit sont arrêtés.

## Reproduction et décision

`prepare-composer-navigation-runtime.mjs <fresh-copy> a|b` crée les copies d'audit marquées, sans .git, à partir du checkout ; A exige le source oracle pré-index figé. Faire les deux builds avant la campagne, lancer les deux Next avec `--require scripts/lib/composer-navigation-probe.cjs`, sorties distinctes et `COMPOSER_PERF_PRIVATE_QUERIES=1`. L'Auth autorisée doit être apportée au navigateur privé hors Git ; aucun secret dans le plan ni la CLI d'audit.

`audit-composer-navigation.mjs <browser-connection.json> <plan.json> <sortie>` suit le plan et refuse une reprise qui sauterait un essai en erreur. Plan privé conservé : mois `2026-10`, 12 AB/BA alternés, puis 3 contrôles calmes et document par variante en ordre alterné. Profiler seulement la paire 01, qui reste mesurée. Les analyzers lisent les traces privées ; le JSON committé est leur sortie publique enrichie des checks, incidents et limites, sans données bancaires.

```ini
P2B5_CONTROLLED_CLIENT_PAIRS = 12
P2B5_ADDITIONAL_VALID_B_RETAINED = YES
P2B5_PAIRED_B_FASTER = 12/12
P2B5_RELATIVE_REGRESSION_REPRODUCED = NO
P2B5_HARD_CLIENT_DIFFERENCE_EXPLAINED = YES
P2B5_PREVIEW_V2_CONCURRENCY_CONFIRMED = YES
P2B5_PREFETCH_BUSINESS_READS = 0
P2B5_PRODUCT_FIX_APPLIED = NO
P2B5_COMPLETE_USER_JOURNEY_OPTIMIZED = NO
P2B5_GATE = PASS
REMOTE_BUSINESS_WRITES = 0
MIGRATION = NONE
PUSH = NONE
VERCEL_DEPLOYMENT = NONE
P2_C_NOT_STARTED = YES
```

Le suivi pertinent est d'examiner le déclenchement/lifecycle de la preview V2 à l'ouverture du Centre et son utilité avant une navigation Composer. La suppression, annulation ou mutualisation serait un chantier distinct avec garde de parité ; aucune de ces corrections n'est faite ici. P2-C reste séparé.

HEAD_FINAL se retrouve par `git log -1 --format=%H -- docs/status/planner-composer-performance-p2b5-2026-10-07.md` après le commit local d'audit. Le SHA complet est communiqué dans la livraison, sans hash auto-référent inventé dans le rapport.
