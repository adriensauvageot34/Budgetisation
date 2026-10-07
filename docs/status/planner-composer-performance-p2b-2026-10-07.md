# Composer — performance P2-B — 2026-10-07

HEAD_BEFORE : `47a59e0fda43f39e2107bbcde33091a27fb3ebdd`, `main`, R5 et P2-A inclus, arbre propre au départ. P2-B certifié après les campagnes complètes ci-dessous.

## CURRENT_OVERLAP_SEMANTICS

L'oracle existant est inchangé : `startA < endB && startB < endA`, évalué dans cet ordre par `Temporal.Instant.compare`. L'égalité d'une fin et d'un début exclut donc la paire adjacente. Il ne s'agit pas du test de point aux bornes inclusives et tolérance de 120 minutes utilisé pour l'admission des Context links : cette autre règle reste inchangée.

Le resolver pairwise ne valide pas lui-même la durée. Une durée nulle située strictement dans un intervalle peut satisfaire ses deux inégalités ; une durée inversée peut également les satisfaire lorsqu'elle est contenue dans un intervalle suffisamment large. L'index conserve exactement ces résultats. En amont, le parseur Canonical `parsePlaceVisitFact` exige startedAt < endedAt pour une visite known ; `pointCompatible` rejette end < start lorsqu'il est atteint. Aucun de ces owners n'est modifié. Les fixtures adversariales directes vérifient aussi le comportement du builder sans présumer l'admission Canonical.

Seules les visites `timePrecision === "exact"` et `interval.kind === "known"` entrent dans la recherche pairwise. Les visites unknown/partial/approximate sont toujours exclues par `exactVisitInterval`. Une borne nullable dans un known adversarial est convertie par String comme avant et peut produire une erreur de parsing. Les participations sans une des bornes retournent null ; elles ne deviennent pas un intervalle ouvert. Une participation exacte positive de l'autre personne conserve sa priorité sur les visites et son appel direct à overlaps.

La zone civile du leg est résolue par l'owner existant. Les bornes de présence désignent des instants absolus, offsets et nanosecondes conservés ; aucun bucket de jour, mois, heure ou fenêtre approximative n'intervient. Les passages minuit/mois/année, événements multi-jours et DST 23/25 h suivent les mêmes inégalités.

Une erreur de parsing d'une visite ne doit pas apparaître lors de la préparation de l'index si l'ancien oracle l'aurait court-circuitée. Elle est retenue comme candidat fallback, dans l'ordre source, puis repassée par overlaps. Une requête non parsable conserve toute la liste source. Les erreurs finales et leur ordre restent ceux de l'oracle ; aucun diagnostic n'est inventé ou supprimé.

## Preuve du pruning et architecture

Avant : pour chaque Context link admis, et chaque autre personne du household, parcours des visites de cette personne puis overlaps pour chaque intervalle exact known. Les participations exactes positives prioritaires, résolutions de lieu, conflit ici/ailleurs, identités et evidenceRefs sont des règles existantes distinctes du candidate search.

Après : à la première recherche pour une personne, un index local au build conserve une référence vers chaque visite admissible, son ordinal source et ses deux epochNanoseconds. Aucun fait, ID, lieu, provenance ou intervalle n'est fusionné. Les entrées sont triées par start, end puis ordinal source. Un tableau parallèle conserve le maximum des ends pour chaque sous-arbre équilibré implicite ; aucun objet tree ni dépendance nouvelle.

Pour une requête A, un sous-arbre est éliminé uniquement si tous ses ends sont <= startA. La partie droite est éliminée uniquement si ses starts sont >= endA. Chaque autre entrée dont endB > startA est candidate. Ainsi toute paire satisfaisant les deux inégalités de l'oracle est conservée, y compris les durées zéro/inversées parsables. Les erreurs non indexables restent dans le fallback. Le résultat revient dans l'ordre des ordinaux source avant le flatMap original ; l'index ne peut donc décider ni la relation finale, ni les evidenceRefs, ni leur digest.

La Map personne → index est créée après l'admission household et la construction des Context links, dans chaque appel M7. Elle utilise les mêmes listes de visites que l'ancien resolver. Aucune donnée n'est partagée entre households, utilisateurs, requêtes, publications ou builds. P2-A reste intact : l'index appelle le même helper instant avec la même Map build-local et clé littérale ; aucune validation timezone ni logique Temporal n'est remplacée. L'index n'est pas dans l'output, le semanticInput ou les hashes.

Préparation O(N log N) pour le tri, puis O(N) pour les maxima ; stockage O(N). La recherche coupe les sous-arbres impossibles et visite les candidats plausibles, avec un pire cas O(N) avant le tri des K candidats O(K log K) pour restaurer l'ordre source. Un dataset où toutes les présences se croisent exige toujours N² candidats sur N recherches : aucun cutoff ne masque ce pire cas.

Le helper test/audit charge l'implémentation P2-A figée depuis une fixture de code source dont le SHA256 et le commit d'origine sont vérifiés, en dehors du runtime produit. La fixture a été extraite du HEAD_BEFORE et n'exige pas un historique Git profond pour exécuter le test. Il compare toute l'autorité, erreurs et identités de couples, pas seulement les montants ou leur cardinalité. Les données privées et la capture M7 restent hors Git.

## Commits et périmètre

HEAD_AFTER_CODE / HEAD_AFTER : `b845d0884f6abb680f26a88f007be5634052a29f`. Les tests et le build portent sur ce code produit ; les changements suivants ajoutent seulement le rapport, la certification et les helpers d'audit.

1. `13792cf6b2b363248c06eec9ca8c2d9e1d0856c3` — `test(perf): add exact presence interval oracle`.
2. `b845d0884f6abb680f26a88f007be5634052a29f` — `perf(mobility): index historical presence intervals`.
3. `docs(perf): certify composer P2-B` — ce rapport et les helpers ; son SHA complet se résout sans auto-référence avec `git log -1 --format=%H -- docs/status/planner-composer-performance-p2b-2026-10-07.md`.

R5 `3eba1887571aa649696a21beb0e642495d188fab` reste ancêtre de main. Le changement produit se limite à `src/analytics/global-v2/mobility-context.ts` et au nouveau `mobility-presence-index.ts` (candidate search). `overlaps`, les règles M7, le memo Instant P2-A, les scopes timezone, la réutilisation neutre du Compiler, les methodVersions et les owners financiers restent identiques. Aucun fichier frontend/CSS, query Canonical, schéma ou migration n'est modifié. Aucun push ni déploiement.

## Méthode et séries

Windows x64, Ryzen 7 3700U, Node 24.19.0, Next 16.2.6, build de production. Même machine et protocole P2-A ; pression mémoire/réseau partagés, séries successives non randomisées. Ces latences sont locales, sans promesse pour Vercel. Les tests/builds ne tournent pas pendant les fenêtres benchmark. Le lancement du serveur Next a commencé près de la fin du profil après : cette proximité et la variance inter-séries limitent l'interprétation du profil n=1.

Avant : vrai code P2-A au HEAD_BEFORE, instrumenté dans une copie jetable hors Git. Après : vrai code de l'index, même instrumentation et mêmes owners. Aucun prototype P1 actif. Seuls les compteurs et la capture privée de l'input M7 sont ajoutés au runtime d'audit ; cette écriture de diagnostic locale est symétrique avant/après. Rien n'est ajouté aux logs ou au state global de production.

Owner réel : **5 lectures avant et 5 après**, readonly Supabase distante. Replay : **5 avant, 25 après**, même capture P0/P1/P2-A et même cutoff `2026-10-06T21:00:00Z`, réponse absente = erreur, **aucun fallback réseau**. CPU : un replay offline profilé avant et après avec fenêtre owner identique au protocole P2-A, startup du loader TypeScript exclu. Un profil live avant supplémentaire est conservé à part.

Navigateur : **5 navigations client puis 5 hard refreshs avant et après**, Chromium isolé, viewport CSS réel **1728×900**. Même définition TTI P2-A : Board hydraté puis interaction native de recherche Library traitée ; champ vide rétabli. Aucun changement des bornes TTI, timeout ou code navigateur. Pas de flush de cache OS : la première requête de chaque processus et les suivantes sont toutes retenues, sans prétendre certifier un démarrage entièrement froid. Tous les 20 accès Next Composer sont HTTP 200, sans erreur page, blocage ou mutation métier.

Les raw, profiles complets, facts, cookies et données d'Auth restent privés dans `C:/Users/Manon/Documents/Codex/2026-10-05/vu-x20/outputs/planner-performance-p2b`. Seuls les timings, compteurs et hashes sont committés dans [les métriques publiques](planner-composer-performance-p2b-metrics-2026-10-07.json). Les goldens commités sont synthétiques ou du code source, aucune capture de monde personnel n'entre dans Git.

## Performance avant/après remesurée

Médianes en ms, sauf compteurs et profiles CPU n=1. P2-A dans ce tableau désigne la **nouvelle campagne avant patch**, pas les médianes historiques recopiées. M7 sync est la tranche synchrone du builder, proxy du coût CPU ; M7 total inclut ses lectures. SERVER est l'owner complet. Les spans parallèles/inclusifs ne s'additionnent pas. FIRST_RESPONSE hard est le début de réponse document ; la première réponse client peut être un shell RSC anticipé et ne mesure pas l'arrivée complète du Board.

| Mesure | P2-A remesuré | P2-B | Gain |
|---|---:|---:|---:|
| TOTAL_PRESENCE_INTERVALS | 1694 | 1694 | 0 |
| PAIRWISE_THEORETICAL_PAIRS — visites | 832477 | 832477 | 0 |
| CANDIDATE_PAIRS_GENERATED — visites | 832477 | 1586 | 830891 (99.81 %) |
| OVERLAPS_CALL_COUNT — visites + participations | 832557 | 1666 | 830891 (99.80 %) |
| POSITIVE_OVERLAPS — toutes | 1638 | 1638 | 0, parité exacte |
| POSITIVE_VISIT_OVERLAPS | 1586 | 1586 | 0, identités exactes |
| RESOLVE_PAIRWISE_PRESENCE_CALLS | 1695 | 1695 | 0 |
| INDEX_BUILD_MS — médiane owner réel | 0 | 41.51 | Coût ajouté |
| INDEX_LOOKUP_MS — total/requête, médiane owner réel | — | 29.82 | 895 lookups/build |
| OVERLAPS_CPU_MS — sous-arbre inclusif, profil n=1 | 12,228.05 | 41.01 | 12,187.04 ms (99.66 %) |
| RESOLVE_PAIRWISE_CPU_MS — inclusif, profil n=1 | 13,676.30 | 1,086.85 | 12,589.45 ms (92.05 %) |
| M7_CPU_MS — bucket + descendants, profil n=1 | 15,265.96 | 5,233.46 | 10,032.50 ms (65.72 %) |
| M7_SYNC_MS — médiane owner réel n=5 | 5,649.99 | 1,452.45 | 4,197.54 ms (74.29 %) |
| M7_TOTAL_MS — médiane owner réel n=5 | 16,653.06 | 12,467.11 | 4,185.95 ms (25.14 %) |
| SERVER_MS — owner réel n=5 | 21,800.62 | 17,451.87 | 4,348.75 ms (19.95 %) |
| FIRST_RESPONSE_MS — hard n=5 | 34,402.40 | 17,011.00 | 17,391.40 ms (50.55 %) |
| TTI_HARD_MS — n=5 | 35,957.00 | 18,155.00 | 17,802.00 ms (49.51 %) |
| TTI_CLIENT_MS — n=5 | 27,975.00 | 35,389.00 | -7,414.00 ms (-26.50 %) |
| FIRST_RESPONSE_MS — client n=5 | 76.92 | 231.49 | -154.57 ms (-200.95 %) |
| REPLAY_MS — n=5 / n=25 | 18,462.14 | 5,714.71 | 12,747.44 ms (69.05 %) |
| TEMPORAL_PARSE_COUNT | 3344 | 3441 | +97 parsings réussis, oracle inchangé |
| INSTANT_HELPER_CALLS | 2463850 | 15564 | 2448286 (99.37 %) |
| TIMEZONE_VALIDATION_COUNT | 2 | 2 | 0 |
| COMPILE_COUNT | 1 | 1 | 0 |
| DERIVE_COUNT | 1 | 1 | 0 |
| GET_COUNT — Next Composer | 291 | 291 | 0 |
| GET_COUNT — harness owner | 313 | 313 | 0 |
| PAYLOAD_BYTES — DTO UI exact | 273000 | 273000 | 0 |
| PAYLOAD_BYTES — REST décodé owner | 15773984 | 15773984 | 0 |

`NEW_OVERLAPS_CALL_COUNT = 1666`, `REDUCTION_COUNT = 830891`, `REDUCTION_PERCENT = 99.7998935809 %` (arrondi humain **99,80 %**). Les 832477 couples théoriques sont les visites ; les **80 comparaisons de participations prioritaires** restent inchangées, dont 52 positives. Les 1586 matches de visites, les 1638 positives totales et leurs identités exactes sont inchangés.

Le hard refresh médian satisfait la cible souhaitée <20 s. **La navigation client se dégrade de 7414 ms, soit +26,50 %** dans ces séries. Elle reste un point ouvert : le gain algorithmique déterministe ne justifie pas une déclaration d'amélioration de tous les modes d'ouverture. Les temps serveur des navigations client après varient également fortement. Aucun run lent n'est retiré.

Référence publiée P2-A (autre campagne, même machine) : overlaps CPU 6197.48 ms, resolvePairwise CPU 6837.54 ms, M7 CPU 8069.47 ms, M7 sync 9632.54 ms, server 29716.03 ms, first response hard 26177.10 ms, hard TTI **27614 ms**, client TTI **32726 ms**. P2-B hard **18155 ms** est 34,25 % sous cette référence historique. Pour attribuer le gain dans la campagne actuelle, comparer **35957 → 18155 ms** ; la différence entre 27614 historique et 35957 remesuré illustre la variance.

### Distribution complète conservée

P95 = nearest rank ; pour n=5 il égale le maximum. Aucun seuil CI sur les millisecondes.

| Série | n avant / après | Avant min / médiane / max / p95 ms | Après min / médiane / max / p95 ms |
|---|---:|---:|---:|
| Owner réel | 5 / 5 | 19,448.81 / 21,800.62 / 23,730.91 / 23,730.91 | 16,791.65 / 17,451.87 / 44,381.56 / 44,381.56 |
| M7 sync réel | 5 / 5 | 5,150.50 / 5,649.99 / 8,523.82 / 8,523.82 | 1,258.72 / 1,452.45 / 4,869.57 / 4,869.57 |
| M7 total réel | 5 / 5 | 14,056.01 / 16,653.06 / 18,872.82 / 18,872.82 | 11,963.46 / 12,467.11 / 27,526.58 / 27,526.58 |
| Replay offline | 5 / 25 | 9,824.74 / 18,462.14 / 28,194.71 / 28,194.71 | 3,865.96 / 5,714.71 / 13,386.65 / 8,052.41 |
| Replay process CPU | 5 / 25 | 10,984.00 / 18,657.00 / 23,376.00 / 23,376.00 | 4,187.00 / 6,298.00 / 10,859.00 / 10,155.00 |
| Hard TTI | 5 / 5 | 26,188.00 / 35,957.00 / 40,822.00 / 40,822.00 | 15,789.00 / 18,155.00 / 20,247.00 / 20,247.00 |
| Client TTI | 5 / 5 | 27,034.00 / 27,975.00 / 28,657.00 / 28,657.00 | 26,380.00 / 35,389.00 / 44,187.00 / 44,187.00 |

Owner réel avant, ms : 22,028.47, 19,448.81, 21,800.62, 20,810.57, 23,730.91. Après : 34,973.91, 44,381.56, 17,451.87, 17,060.16, 16,791.65. Les deux premiers runs après, 34973.91 et 44381.56 ms, restent dans les statistiques.

Hard TTI avant, ms : 37869, 26188, 33016, 40822, 35957. Après : 20247, 17524, 19279, 18155, 15789. Client TTI avant : 27786, 28225, 27034, 27975, 28657. Après : 42928, 35389, 26380, 44187, 29741. Les **25 samples replay après** complets et leurs compteurs sont dans le JSON public : 0 erreur, 0 divergence, 0 fallback réseau.

## Index : préparation, recherche, mémoire et fallback

Réel : **2 index personne, 1694 entrées, 895 lookups** par build. Préparation médiane 41.51 ms (min 36.57 / max 128.17), recherche cumulée médiane 29.82 ms (min 25.76 / max 285.40). Replay après n=25 : préparation médiane 42.78 ms, recherche médiane 30.50 ms. L'instrumentation des recherches utilise performance.now et peut subir GC/scheduling ; le coût mesuré est conservé.

Dans le même replay profilé après : **préparation 163.63 ms**, **recherche cumulée 148.62 ms**, **overlaps final 41.01 ms de sous-arbre CPU échantillonné**, resolvePairwise inclusif 1086.85 ms. Les deux premiers chiffres sont wall instrumenté, le troisième est échantillonné ; ils ne sont pas additionnés comme un gain ou une mesure unique de CPU.

Mémoire retenue, processus isolé `--expose-gc`, 5 builds gardés vivants avec facts/memo préchauffés exclus : **1214216 octets**, soit environ **242843 octets/build (~237 KiB)**. Inclut tableaux, entrées, ordinaux, références, bornes BigInt, maxima et closures. Aucun clone des facts/world. La différence heapUsed à chaud d'environ 9 MB dans les probes inclut les allocations transitoires, le parsing et le GC : elle n'est pas la taille retenue de l'index. Mesure GC approximative, non garantie au byte ; durée de vie = un build M7.

Fallback limité aux bornes non parsables (visite retained pour l'oracle) ou à une requête non parsable (liste source complète). **Données réelles : 0 entrée fallback, 0 requête fallback**. Les fixtures invalide/null/error/short-circuit passent sans ignorer silencieusement de fait. Les fallback restent soumis à overlaps, aux mêmes erreurs et à l'ordre d'origine.

Le nombre de parsings Instant réussis passe de **3344 à 3441** : l'index prépare 97 bornes valides que l'ancien court-circuit ne lisait pas. Le parser/memo P2-A et leurs clés ne changent pas. Les tentatives de parsing invalide sont interceptées à la préparation puis rejouées par l'oracle ; elles ne deviennent pas une admission de source nouvelle.

## Scaling synthétique exact

N visites et N recherches, self inclus dans cette fixture synthétique uniquement. Oracle brute exhaustif des inégalités BigInt + fixtures M7 avec le vrai overlaps Temporal. 15 combinaisons, aucune tolérance ou limite de candidats ; counts égaux à tous les vrais matches.

| N | Brute N² | Index non chevauchants | Index modérés | Index tous chevauchants | Parité matches |
|---|---:|---:|---:|---:|---|
| 100 | 10000 | 100 | 494 | 10000 | YES |
| 500 | 250000 | 500 | 2494 | 250000 | YES |
| 1000 | 1000000 | 1000 | 4994 | 1000000 | YES |
| 2000 | 4000000 | 2000 | 9994 | 4000000 | YES |
| 5000 | 25000000 | 5000 | 24994 | 25000000 | YES |

| N | Cas | Build index ms | Lookup index total ms | Brute prédicat BigInt ms |
|---|---|---:|---:|---:|
| 100 | non-overlapping | 17.34 | 4.54 | 2.15 |
| 100 | moderate | 5.36 | 2.77 | 1.12 |
| 100 | all-overlapping | 1.26 | 7.90 | 1.50 |
| 500 | non-overlapping | 19.63 | 7.43 | 17.06 |
| 500 | moderate | 14.01 | 8.97 | 21.21 |
| 500 | all-overlapping | 4.71 | 97.42 | 4.75 |
| 1000 | non-overlapping | 24.93 | 10.41 | 71.13 |
| 1000 | moderate | 45.62 | 33.10 | 15.91 |
| 1000 | all-overlapping | 14.15 | 518.38 | 65.01 |
| 2000 | non-overlapping | 48.74 | 26.90 | 135.48 |
| 2000 | moderate | 46.06 | 27.08 | 99.07 |
| 2000 | all-overlapping | 27.28 | 1,634.70 | 184.86 |
| 5000 | non-overlapping | 173.11 | 76.72 | 699.08 |
| 5000 | moderate | 146.99 | 70.95 | 517.07 |
| 5000 | all-overlapping | 37.34 | 9,991.47 | 580.17 |

Best case : N candidats pour les recherches non chevauchantes, hors coût de recherche/tri ; cas réel : 832477 → 1586 candidats de visites. Worst case : tous chevauchants, N² candidats conservés. À 5000, l'index matérialise et remet en ordre 25 millions de candidats (~9991 ms de recherche), alors que le brute de scaling ne fait que compter un prédicat BigInt (~580 ms). **Ces timings sont asymétriques, pas une comparaison de deux builds M7 complets** ; ils montrent aussi le surcoût de l'index lorsque rien n'est éliminable. Aucun cutoff ou seuil temporel CI n'est introduit. Les mesures heap transitoires de scaling, parfois négatives sous GC, restent dans l'artifact ; la mesure retenue ci-dessus est la référence mémoire.

## Profil CPU comparable à P2-A

Fenêtre owner du replay offline : avant 23720.66 ms, après 19198.40 ms. Un profil de chaque, données et cutoff identiques. Les buckets ci-dessous sont exclusifs selon l'analyzer P0/P1 ; les sous-arbres overlaps/resolvePairwise/instant/linkTemporal ci-dessus sont inclusifs et se recouvrent, à ne pas sommer. Sampling et pression machine empêchent de transformer n=1 en SLA.

| Bucket échantillonné | P2-A remesuré ms | P2-B ms |
|---|---:|---:|
| Other CPU | 5,588.56 | 13,091.64 |
| (idle) | 14.04 | 4.69 |
| (garbage collector) | 2,805.97 | 833.58 |
| (program) | 23.13 | 24.20 |
| Timezone validator + descendants | 21.26 | 9.59 |
| M7 + descendants | 15,265.96 | 5,233.46 |

Overlaps : **12228.05 → 41.01 ms** ; resolvePairwise : **13676.30 → 1086.85 ms** ; M7 + descendants : **15265.96 → 5233.46 ms**. Instant inclusif : 1033.05 → 157.72 ms ; linkTemporalAssessment : 316.66 → 936.58 ms. Le Temporal self restant est 2969.08 ms, réparti entre comparaisons/admission et autres opérations temporelles ; les parsings Instant n'expliquent plus le coût pairwise.

Le bucket Other CPU après est plus grand (13091.64 ms). Le profil y expose strict parsing/validation, projections Canonical, sérialisation/hash, Planner et coûts du harness replay (lecture de fichiers/capture/Date figée). **Ce replay n'a pas de DB wait distante** ; ses lectures de fichiers ne sont pas une preuve de latence réseau. Le profiling sampling n'isole pas à lui seul le temps d'attente DB.

Sur les **lectures réelles**, `loadPurchaseAwareCanonical` est sur le chemin des sources Baseline (médiane inclusive **14303.10 ms**), `readPlanningBaselineSources` **14407.44 ms**, contre M7 sync **1452.45 ms** et owner complet **17451.87 ms**. M7 total reste **12467.11 ms**, incluant ses dépendances. Les nombreux `queryRows`/closures se chevauchent : leurs durées ne sont jamais additionnées pour fabriquer un wall total. **Le hotspot de bout en bout restant est la collecte et les projections/validations Canonical, avec les reads répétés de closures**, puis d'autres computations hors overlaps. Recommandation : **P2-C — shared comparable Canonical request closures**, avec profiling séparé des waits et du CPU, et investigation du client TTI. Aucune implémentation P2-C/P2-D.

## Parité métier et 25 replays

132 fixtures temporelles (32 nommées + 100 déterministes seeded avec 40 visites), **288 couples positifs synthétiques**, mêmes tuples exacts, autorité complète ou même erreur, facts immuables. Elles couvrent les 25 classes demandées : aucun/complet/partiel gauche/droit, identiques/start/end/adjacent/inclus, zéro/inversé, minuit/mois/année/DST23/DST25/multi-jours, plusieurs visites/personnes, lieux identiques/conflits, invalid/nullable/end manquant/unresolved, nanosecondes/offsets et scaling non/fortement chevauchants. Deux visites identiques dans le temps restent deux faits ; nouveau build/publication/household ne réutilise aucun candidat.

Golden réel privé : deep equality **de toute l'autorité M7** et du tableau trié des tuples [Context resolution, subject, autre personne, visitKey, personDay, place, bornes des deux intervalles]. L'égalité de sortie couvre relations/person-days, evidenceRefs, diagnostics et identités, pas seulement le nombre de positives. Aucun tuple personnel n'est publié.

Les 25 replays après, les 5 lectures avant/après et les profils ont les mêmes 7 digests Composer et métadonnées. Le hash exact du DTO complet a été ajouté au probe après les premières séries avant ; le profil offline avant exécute bien l'ancien code et établit ce hash, identique dans **toutes les captures après**. La couverture du DTO avant n'est donc pas annoncée comme 5 hashes déjà présents dans les raw précédents. Le monde réel capturé contient 15 cards, 141 assets, 0 Context actif ; les Contexts composites, identités de Components/PlanSlots/MobilityIntents/PhysicalJourneys/NeedOccurrences et savings sont vérifiés en plus sur **22 goldens synthétiques × 9 hashes**, non modifiés.

| Oracle | P2-A | P2-B | PASS |
|---|---|---|---|
| Exact matched pair set | `989df837c10b8818d4f83d424f57f4cb7b57c67dae89fffd217471a135deed15` | `989df837c10b8818d4f83d424f57f4cb7b57c67dae89fffd217471a135deed15` | YES |
| M7 authority complète | `96dcf7a84e2f8af5bbfd6ffaef156b8a3a4d23ca57d755683f021810142cebd1` | `96dcf7a84e2f8af5bbfd6ffaef156b8a3a4d23ca57d755683f021810142cebd1` | YES |
| M7 outputHash | `6cbb97b13ad19f1c16987b4a184264a352ad97762fcb3fddac56ef27f911d71a` | `6cbb97b13ad19f1c16987b4a184264a352ad97762fcb3fddac56ef27f911d71a` | YES |
| UNKNOWN/knowledge M7 | `b6aa800b335baac47b72bc38abd0b61546b020f8069b15ab3751732f724cd5f2` | `b6aa800b335baac47b72bc38abd0b61546b020f8069b15ab3751732f724cd5f2` | YES |
| Identités M7 | `8c303e780c02f2d46fdb1b4ccacbe47ee50b12ea5cbe42730cb373fb911d1b39` | `8c303e780c02f2d46fdb1b4ccacbe47ee50b12ea5cbe42730cb373fb911d1b39` | YES |
| sourceRefs/evidenceRefs M7 | `6928924d28af555b15ffc0cd03fccd30555e8925ddab02d3007d29aab6d20235` | `6928924d28af555b15ffc0cd03fccd30555e8925ddab02d3007d29aab6d20235` | YES |
| Context links M7 | `db6b68f1b273987178dbc99708554328b50b65c22227abc12901dbd4ca6282ab` | `db6b68f1b273987178dbc99708554328b50b65c22227abc12901dbd4ca6282ab` | YES |
| Presence resolutions M7 | `05c8eb28d1e06c85aa0b2a365d0c4dfeb3f260c0b12babfcd71e52607bb1ffc7` | `05c8eb28d1e06c85aa0b2a365d0c4dfeb3f260c0b12babfcd71e52607bb1ffc7` | YES |
| PlanningBaseline | `c27f43b48ee9511c8c7327008fcb1fe52ca49c8cf207549f4372561ce310b4ff` | `c27f43b48ee9511c8c7327008fcb1fe52ca49c8cf207549f4372561ce310b4ff` | YES |
| Semantic state | `b97f6c274627901f9fc5179900b97b87981896fb9dad89f80a0928613db331b9` | `b97f6c274627901f9fc5179900b97b87981896fb9dad89f80a0928613db331b9` | YES |
| Semantic manifest | `34360075778b2f89e41083fe6219908b657ed99599f4413ff1ac9a1337beefc1` | `34360075778b2f89e41083fe6219908b657ed99599f4413ff1ac9a1337beefc1` | YES |
| Projection cockpit | `2cb51bb83000eb0b84a6ba08b0e2d52c222b5719ec3e7dd50fbafbba77451fb7` | `2cb51bb83000eb0b84a6ba08b0e2d52c222b5719ec3e7dd50fbafbba77451fb7` | YES |
| Cards / Board | `968cbee0b2f3eb2fa17060a482bc4828f342f0701415f7df3e324e166c1c994f` | `968cbee0b2f3eb2fa17060a482bc4828f342f0701415f7df3e324e166c1c994f` | YES |
| Capabilities | `f587ccefac1249fc674bf79520088c9a5a9aea5a44c7be732e71ff3253565e2e` | `f587ccefac1249fc674bf79520088c9a5a9aea5a44c7be732e71ff3253565e2e` | YES |
| UNKNOWN / diagnostics Composer | `5e577b95b4c0a77597a468ff708042cbc9d19468c8e759804070bc9435dec0f8` | `5e577b95b4c0a77597a468ff708042cbc9d19468c8e759804070bc9435dec0f8` | YES |
| DTO UI complet — profil avant / tous après | `a6213449261e89ae852a15c7f1679af24b5f21e6bbbdda09a6e719c0e7ecb5c6` | `a6213449261e89ae852a15c7f1679af24b5f21e6bbbdda09a6e719c0e7ecb5c6` | YES |
| Identités Planner + sourceRefs, 22 cas — hash agrégé | `40a93b23cb3ff9365dc459ce449fdf8fc821870142a1103cb3b29dbbe22993ae` | `40a93b23cb3ff9365dc459ce449fdf8fc821870142a1103cb3b29dbbe22993ae` | YES |
| Knowledge Planner, 22 cas — hash agrégé | `6daadf96d58de4b805861e0bf14ff0511d3b0c74307477646b73ea146dbb15ff` | `6daadf96d58de4b805861e0bf14ff0511d3b0c74307477646b73ea146dbb15ff` | YES |
| Preview, 22 cas — hash agrégé | `8b6398799198925fb5233332c7a0290cc071cf2e88bfd34cac8008470ed07585` | `8b6398799198925fb5233332c7a0290cc071cf2e88bfd34cac8008470ed07585` | YES |
| Business complet dont savings, 22 cas — hash agrégé | `eb94ad0782370903c2e40dddb7b55a6e930b5a1ef347c35c6949a1c010401234` | `eb94ad0782370903c2e40dddb7b55a6e930b5a1ef347c35c6949a1c010401234` | YES |

Les agrégats des 22 cas sont SHA256 des tableaux [nom, digest] dans l'ordre des goldens. Le test courant compare chacune des **198 valeurs** à la fixture figée pré-P2-A ; les identités incluent sourceRefs et tous les objets Planner cités. Les captures réelles testent également les states/unknown et outputs complets, indépendamment de ces agrégats.

### Preview, Apply re-read/recompile, Reload

**PGlite synthétique uniquement**, aucun Supabase local, appel réseau interdit. Sept parcours passent par le vrai service Apply, relecture/recompilation serveur, la RPC C0 inchangée dans cette base virtuelle, puis `resolveEffectiveMonthScenario`. Equality complète de scenario, projection, semantic state ; evidence EXACT ; canaries historiques intactes. Aucun Apply/RPC distant.

Hash du tableau = SHA256 de `{semantic, manifest, projection}`, utilisant les digests métier des goldens avant puis l'evidence réellement persistée par Apply et la preview Reload. Il ne masque pas une différence d'état : la deep equality complète vient en plus. Les IDs aléatoires de Revision et createdAt de persistence ne sont pas présentés comme un hash invariant.

| Cas | Avant | Apply | Reload | PASS |
|---|---|---|---|---|
| simple-month | `96df7bec4cf651e0600d878432bb5218df2a6a3ccc824500ce59f4c39c097687` | `96df7bec4cf651e0600d878432bb5218df2a6a3ccc824500ce59f4c39c097687` | `96df7bec4cf651e0600d878432bb5218df2a6a3ccc824500ce59f4c39c097687` | YES |
| night-out-uber | `be4f426586f5fd9b15d91431a3d21b92add860f1d74a2133caae3b78b22a49b6` | `be4f426586f5fd9b15d91431a3d21b92add860f1d74a2133caae3b78b22a49b6` | `be4f426586f5fd9b15d91431a3d21b92add860f1d74a2133caae3b78b22a49b6` | YES |
| night-out-tram | `11c934bb148a3f1e74936f8fae126cb32adfb21114ccf26bef16f74f42e78439` | `11c934bb148a3f1e74936f8fae126cb32adfb21114ccf26bef16f74f42e78439` | `11c934bb148a3f1e74936f8fae126cb32adfb21114ccf26bef16f74f42e78439` | YES |
| short-stay-unresolved | `85180f27f4e3b28b44cebe11fb66514647277f47a467dc089e168e70e3fea2b1` | `85180f27f4e3b28b44cebe11fb66514647277f47a467dc089e168e70e3fea2b1` | `85180f27f4e3b28b44cebe11fb66514647277f47a467dc089e168e70e3fea2b1` | YES |
| short-stay-confirmed-consumption | `bb30383692ea8418ffdfb701d3ab2f15dc40174a2122640e496c63f752d9dd5f` | `bb30383692ea8418ffdfb701d3ab2f15dc40174a2122640e496c63f752d9dd5f` | `bb30383692ea8418ffdfb701d3ab2f15dc40174a2122640e496c63f752d9dd5f` | YES |
| needs-two-in-one-purchase | `faec6e11584ec444761962e27c8ef629f21dae84e7ef15d2ea37131569a7b744` | `faec6e11584ec444761962e27c8ef629f21dae84e7ef15d2ea37131569a7b744` | `faec6e11584ec444761962e27c8ef629f21dae84e7ef15d2ea37131569a7b744` | YES |
| external-intent | `19f7f8a68e4de92cac4fe0630cfbade233c191c1d2f0dd109495b7d1dc2e9e2c` | `19f7f8a68e4de92cac4fe0630cfbade233c191c1d2f0dd109495b7d1dc2e9e2c` | `19f7f8a68e4de92cac4fe0630cfbade233c191c1d2f0dd109495b7d1dc2e9e2c` | YES |

Les hashes preview avant/après de chaque cas sont aussi conservés dans le JSON public. Ces dry-runs testent une application virtuelle, jamais des writes sur des facts personnels.

## GET, cutoff et payload

Next : **291 GET métier à chacun des 20 accès**, mêmes endpoints et paramètres, hormis le cutoff existant `person_habit_assertions.validated_at=lte.<knowledgeCutoff frais>`. Le navigateur utilise l'heure réelle de chaque lecture, déjà avant P2-B : les hashes littéraux des multisets diffèrent donc entre ouvertures, avant comme après. Ils sont conservés dans l'artifact.

Le comparateur vérifie que cette **seule valeur dynamique**, une par requête, reste `lte` et se situe dans la fenêtre de la requête ±100 ms ; toutes les autres clés/valeurs et leur cardinalité restent littérales. Le hash du multiset comparable est identique sur les 20 accès : `82804291a343b13377a0f9c29b700dfd95ad40e0764a5b1ef1ef7b6e67e66ccf`. Aucune query ou borne effective n'est modifiée pour le benchmark.

Owner/replay cutoff fixe : **313 GET métier + 2 GET Auth**, hash littéral strict identique `81f78ddd1f383e2bc4860236b9b816c54543783e41e59fe13fe58aa4dbaf9d8c`. DTO UI exact **273000 octets**, hash complet inchangé ; réponses REST décodées owner **15773984 octets**, inchangées. `GET_MULTISET_UNCHANGED = YES` désigne cette preuve avec cutoff navigateur explicitement paramétré et la preuve littérale au cutoff fixe, pas une affirmation erronée d'égalité des timestamps réels.

## Tests et reproductibilité

Les **26 suites** suivantes ont exit 0, logs privés conservés ; commandes exactes exécutées : `node --experimental-strip-types scripts/check-<nom>.mjs`.

- `check-canonical-mobility.mjs` — PASS.
- `check-personal-mobility.mjs` — PASS.
- `check-mobility-context.mjs` — PASS.
- `check-mobility-trip-contexts.mjs` — PASS.
- `check-mobility-trips.mjs` — PASS.
- `check-monthly-mobility-narrative.mjs` — PASS.
- `check-mobility-build-memo.mjs` — PASS.
- `check-mobility-presence-index.mjs` — PASS.
- `check-presence-index-scaling.mjs` — PASS.
- `check-timezone-validation-scope.mjs` — PASS.
- `check-planner-neutral-evaluation.mjs` — PASS.
- `check-planner-performance-parity.mjs` — PASS.
- `check-phase2-planner-baseline.mjs` — PASS.
- `check-phase2-planner-simple-levers.mjs` — PASS.
- `check-phase2-planner-kernel.mjs` — PASS.
- `check-phase2-planner-contexts.mjs` — PASS.
- `check-phase2-planner-mobility.mjs` — PASS.
- `check-phase2-planner-renewals.mjs` — PASS.
- `check-phase2-planner-headless.mjs` — PASS.
- `check-phase2-planner-composer.mjs` — PASS.
- `check-phase2-planner-interactions.mjs` — PASS.
- `check-phase2-planner-atomic-ui.mjs` — PASS.
- `check-phase2-planner-visual-fidelity.mjs` — PASS.
- `check-phase2-planner-final-polish.mjs` — PASS.
- `check-architecture-imports.mjs` — PASS.
- `check-composer-performance-probe.mjs` — PASS.

Canonical Mobility utilise la source Excel approuvée existante via `MOBILITY_SOURCE_XLSX`, même certification P2-A ; fichier lu, pas modifié ni committé. Kernel/headless utilisent leurs bases PGlite synthétiques habituelles. `node node_modules/typescript/bin/tsc --noEmit` : **PASS**. Next production build : **PASS**, compilation 49 s, TypeScript 102 s, 8 pages générées ; route Composer présente. Aucun changement produit après ces vérifications. La suite exacte réelle a été rejouée après la fixation du code source oracle en fixture, PASS.

Reproduire sans credentials ni données réelles :

`node --experimental-strip-types scripts/check-mobility-presence-index.mjs` ; `node --experimental-strip-types scripts/check-presence-index-scaling.mjs --benchmark <sortie>` ; `node scripts/audit-planner-p2b-roundtrip.mjs <sortie>`.

Avec les artefacts privés autorisés : `node scripts/check-mobility-presence-index.mjs <private-m7-input.json> <sortie-public.json>` ; `node --expose-gc scripts/audit-presence-index-memory.mjs <private-m7-input.json> <sortie-public.json>` ; `node scripts/analyze-composer-performance-p2b.mjs <output-root> --certify`. Dernier résultat : **P2B_MEASUREMENT_CERTIFICATION PASS**. Les analyzers CPU existants sont `analyze-composer-cpu-profile.mjs` et `analyze-m7-cpu-p2a.mjs`, avec profile et events pour aligner la fenêtre owner.

`prepare-composer-performance-p2b-runtime.mjs` exige une copie marquée sans .git et instrumente le vrai code, pas la production. Les probes continuent de refuser mutations REST/Storage métier et RPC. Auth est renouvelé uniquement avant les campagnes ; aucune mutation métier distante, zéro tentative Apply distante.

## Incidents et limites conservés

La première connexion CDP de bootstrap a échoué avant toute série mesurée car le Chrome isolé s'était terminé avec son parent. Le nouveau Chrome reste vivant pendant les séries ; zéro run benchmark censuré pour ce problème. Aucun timeout/session expirée dans les séries retenues. Le profil initial avant utilisait par erreur les reads live : conservé comme supplément `baseline/cpu`, exclu de la paire offline définie pour le tableau CPU.

Le compteur brut `work.overlapCalls` des cinq premiers owners live avant additionnait deux hooks d'audit portant le même nom (1665114). Les raw et timings restent conservés. Le compteur séparé `finalOverlapCalls` de l'oracle indépendant, des replays avant et des profils confirme **832557** ; le tableau ne réinterprète pas 1665114 comme le nombre d'appels produit. L'audit a été corrigé, sans modifier overlaps ni réécrire les mesures.

Une première assertion d'égalité des hashes littéraux Next a échoué à cause du cutoff frais déjà présent avant patch. Ce constat est conservé et le comparateur est maintenant strict sauf cette valeur attendue, après validation de ses bornes dans chaque requête. Aucun digest métier n'a divergé. Tous les runs valides, notamment les deux owners après les plus lents et la régression client, restent publiés. Les processus Next/Chromium lancés uniquement pour cet audit sont arrêtés après les mesures ; les autres sessions ne sont pas touchées.

Le pire cas tous chevauchants coûte plus de matérialisation/tri que le brute de scaling. Les profiles n=1 et séries non randomisées ne démontrent pas une baisse de latence sur chaque navigation ou en production ; la preuve forte porte sur les paires exactes, les counts déterministes et la parité complète. L'ancienne implémentation figée reste uniquement un oracle test/audit. Aucun cache, snapshot d'autorité, index DB ou apprentissage métier nouveau.

## Gates finales

```ini
HISTORICAL_PRESENCE_INDEX = PASS
EXACT_PAIR_PARITY = PASS
M7_DIGEST_PARITY = PASS
BUSINESS_DIGEST_PARITY = PASS
PROJECTION_PARITY = PASS
UNKNOWN_PARITY = PASS
IDENTITY_PARITY = PASS
SOURCE_REF_PARITY = PASS
PREVIEW_APPLY_RELOAD_PARITY = PASS
OVERLAP_CALLS_MEASURED_BEFORE_AFTER = YES
REAL_COMPOSER_REBENCHMARKED = YES
GET_MULTISET_UNCHANGED = YES
REMOTE_WRITES = 0
MIGRATION_REQUIRED = NO
P2_C_NOT_STARTED = YES
P2_D_NOT_STARTED = YES
SNAPSHOT_NOT_STARTED = YES
FRONTEND_UNCHANGED = YES
PLANNER_COMPOSER_PERFORMANCE_P2B = PASS
```

Avant P2-B, M7 évaluait environ **832557 couples de présence**. Après indexation, il en évalue **1666**, soit **−99,80 %**. Le résultat exact des relations temporelles est inchangé.

Le CPU overlaps remesuré passe de **12228,05 à 41,01 ms** (référence historique P2-A 6197,48 ms). M7 sync réel remesuré passe de **5649,99 à 1452,45 ms** (référence historique 9632,54 ms).

Le Composer passe de **27,61 s médianes publiées P2-A à 18,16 s en hard refresh** ; la comparaison actuelle avant/après est **35,96 → 18,16 s**. La navigation client de cette campagne se dégrade **27,98 → 35,39 s** et reste explicitement ouverte.

Les **291 GET**, le DTO UI et le payload Canonical comparable restent inchangés, sous la réserve documentée du cutoff temporel frais des requêtes navigateur. Le nouveau hotspot principal est la **collecte et les projections Canonical / closures répétées**. P2-C est recommandé, **pas lancé**.
