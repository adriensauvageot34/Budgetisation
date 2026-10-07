# Checkpoint performance — Composer V3 — 2026-10-07

## 1. Executive summary

**PERFORMANCE_CHECKPOINT = PASS. PERFORMANCE PHASE = CLOSED FOR NOW.** La phase P0→P2-E2 est clôturée pour reprendre le produit. Les gains livrés portent sur les parsings Temporal, la recherche de présence M7, la preview V2 concurrente du Centre, le payload Operations et la barrière Forecast. Les investigations suivantes n'ont pas démontré un autre levier simple de grande valeur : partage Canonical insuffisamment rentable, pas de seconde grosse barrière sûre, SQL critique rapide, tuning de concurrence peu rentable.

Composer conserve **291 GET métier par ouverture Next** et un coût distant significatif. La référence récente à trois ouvertures donne **16,576 s de TTI médian**, avec une forte dispersion ; ce n'est ni un SLA ni une mesure Vercel. Le coût restant est connu et accepté pour cette reprise, sans prétendre qu'il est résolu.

Ce checkpoint est **documentaire uniquement**. HEAD_BEFORE réel : `80065184a38b06d8e3cdc06c83fd401d19b116fb`, branche `main`, worktree initial propre. HEAD_AFTER_PRODUCT identique ; dernier code produit : `25358cb51e1720b8023ea4d49a451fe60f4d1238` (P2-D), avec `git diff 25358cb HEAD -- src` vide. Le SHA documentaire final se résout par `git log -1 --format=%H -- docs/status/planner-composer-performance-checkpoint-2026-10-07.md`. Aucun reset, push ou déploiement.

## 2. Point de départ

[P0](planner-composer-performance-audit-2026-10-06.md) et [P1](planner-composer-performance-forensics-2026-10-06.md) ont audité **R5 inclus**, au code `3eba1887571aa649696a21beb0e642495d188fab`. Production Next locale sous Windows, Node 24.19.0 / Next 16.2.6, autorités Supabase distantes ; poste d'environ 6 GB de RAM, pression mémoire et réseau variables. Aucun benchmark du déploiement Vercel R5.

P0 : cinq hard refreshs, **68,076 s médianes jusqu'à l'interaction**, première réponse **66,664 s**. Une lecture headless distincte dure **67,5067 s**, dont **41,1131 s** de calcul synchrone M7 après ses dépendances. P1 confirme **832 557 overlaps**, **2 463 850 parses Instant**, **10 767 validations timezone** et deux compile/derive sur l'état neutre réel. Ces durées viennent d'exécutions distinctes et ne s'additionnent pas.

Next réalise 291 GET strictement distincts ; le harness headless sans memo Next en réalise **313**, avec **38 377 lignes / 15 773 984 octets décodés**, répétitions incluses. Le DTO UI fait **273 000 octets** : 15 cartes, zéro Context, 141 assets dans cette capture. Ces chiffres ne décrivent pas tous les futurs mois composites.

## 3. Optimisations réalisées, par cause

### CPU et algorithmes

[P2-A](planner-composer-performance-p2a-2026-10-07.md) réutilise les Instant immuables **dans un build M7**, borne la validation réussie de timezone **à une instance de repository/requête**, et réutilise l'évaluation neutre uniquement après équivalence complète de l'état normalisé, de la version Compiler et des PlanSlots. Résultats : **2 463 850→3 344 parses**, **10 767→2 validations** sur le pipeline réel, **2→1 compile et derive** sur le cas certifié. Les erreurs ne sont pas mémorisées ; l'Apply relit/recompile toujours ses autorités. Les états non neutres et les impacts marginaux gardent leur calcul nécessaire.

[P2-B](planner-composer-performance-p2b-2026-10-07.md) indexe les intervalles exacts par personne, dans le build, sans changer le prédicat Temporal final, les bornes, l'ordre de source ou les identités. **832 557→1 666 overlaps**, soit **830 891 appels évités** ; les **1 638 overlaps positifs** restent identiques. Les candidats de visites passent de 832 477 à 1 586, les 80 comparaisons de participations prioritaires restent. L'index prépare 97 bornes réussies supplémentaires : **3 441 parses au checkpoint**, contre 3 344 après P2-A. Il réduit les candidats inutiles ; son pire cas tous chevauchants reste quadratique, sans cutoff caché.

### Travail serveur inutile sur Centre→Composer

[P2-B.5](planner-composer-performance-p2b5-2026-10-07.md) explique la différence hard/client : **45 GET parent + 27 preview + 291 Composer = 363**, alors que le document direct n'a pas ces lectures du Centre. La régression client séquentielle P2-B **27,975→35,389 s** n'est pas reproduite dans les **12 paires alternées**, toutes plus rapides avec l'index ; elle reste compatible avec la variance de campagne/charge. Les prefetchs observés n'exécutent aucun GET métier. Des headers RSC rapides ne signifient pas un Board prêt ; une action déjà envoyée continue côté serveur.

[P2-B.6](planner-composer-performance-p2b6-2026-10-07.md) diffère de **800 ms** la preview sur l'accueil neutre avec Composer, puis annule son timer avant navigation. Une vue focused la déclenche immédiatement ; les edits gardent leur debounce de 180 ms, le flow V2 sans Composer et le stay gardent leurs résultats. **11/12 départs de la campagne évitent la preview**, soit **297 GET évités sur 12 passages**. Le départ tardif conservé déclenche encore ses 27 GET : **pas d'annulation serveur**. Parcours rapide avant démarrage : **45+0+291=336 GET**. Les trois contrôles rapides P2-C2 puis P2-D vérifient chacun zéro preview.

### Payload et partage

[P2-C](planner-composer-performance-p2c-2026-10-07.md) examine trois candidats de partage. Le meilleur potentiel sûr représente **11 GET / 327 lignes / 214 864 octets**, seulement 3,78 % des GET Next et 1,36 % des octets headless initiaux. Les autres scopes/fieldsets ne sont pas interchangeables ou les doublons stricts sont déjà absorbés par Next. **STOP_NO_HIGH_VALUE_REUSE**, sans nouvelle closure/cache.

[P2-C2](planner-composer-performance-p2c2-2026-10-07.md) réduit le seul SELECT by-ID Operations audité de **67 à 23 champs**, en préservant l'alias monétaire textuel exact et tous les champs utilisés. Hydratation historique : **3 603 183→1 221 089 octets**, toujours **1 436 opérations / 12 GET**. Toutes les populations, fenêtres, sources et provenances restent ; aucun champ n'est supprimé de la DB. Payload global headless en replay : **15 773 984→13 303 172 octets**. Un batch distant readonly confirme les 23 champs par deep equality, et cinq replays / 22 goldens conservent les outputs.

### Orchestration

[P2-D](planner-composer-performance-p2d-2026-10-07.md) démarre Forecast et sources Baseline dès que repository autorisé, mois et cutoff sont prêts. Attente d'entrée des sources : **2 779,06→0,31 ms médianes**. L'admission des générations/publications, la priorité d'erreur Forecast et les résultats restent inchangés ; pic observé **46→46**, mêmes queries. Seule cette dépendance artificielle a été retirée.

[P2-D2](planner-composer-performance-p2d2-2026-10-07.md) ne trouve pas de seconde barrière sûre de grande valeur. Découverte d'IDs, coûts puis hydratation sont les étapes réelles. La projection finale après dernière query économique ne prend que **0,313–0,337 s**. Le tail Purchase-aware médian de 1,367 s n'est pas un gain directement supprimable : changer son déclenchement/admission et ses erreurs nécessiterait une autre preuve. **STOP_NO_HIGH_VALUE_INTERNAL_BARRIER**.

### SQL et transport

[P2-E1](planner-composer-performance-p2e1-2026-10-07.md) mesure Timing / Timing control / Reconciliation / Operation place : SELECT représentatifs exécutés en **environ 12–17 ms**, sans mauvais plan majeur, index invalide utilisé ou spill démontré. En contrôle Composer, SQL IN cumulé **0,408 / 0,658 / 0,509 / 0,671 s**, contre Node historique **10,755 / 10,751 / 7,649 / 10,748 s**. SQL inclut un batch Purchase-aware en plus de l'historique ; ces scopes et durées ne se soustraient pas comme des contributions wall-clock. **SQL_OPTIMIZATION_JUSTIFIED = NO**, limité à ces familles auditées.

[P2-E2](planner-composer-performance-p2e2-2026-10-07.md) teste Timing control isolé, trois runs à concurrence 1/3/5. Concurrence 3 : famille **0,715 s**, headers **165 ms**, pic 3 ; concurrence 5 : **0,647 s**, **229 ms**, pic 5. Seulement **68 ms gagnés**, avec coût unitaire accru ; pas de candidat justifiant un test Composer/patch. Les 117 batches sont identiques à la capture, zéro erreur. **STOP_NO_HIGH_VALUE_TRANSPORT_TUNING** : 3 est suffisamment proche du meilleur compromis isolé observé, sans preuve d'optimum universel sous Composer.

## 4. Gains structurels certifiés

Les compteurs, bytes et dépendances ci-dessous sont les preuves fortes. Les temps SQL/projection sont des observations délimitées, pas des gains livrés ; les latences d'ouverture restent indicatives.

| Dimension | Départ | Checkpoint | Statut / source |
|---|---:|---:|---|
| GET métier Composer Next | 291 | 291 | Structure inchangée, P0→P2-E1 ; aucun nouveau run P2-E2/checkpoint |
| Preview V2 parasite | +27 GET | 0 si départ avant démarrage | P2-B.6 : 11/12, départ tardif conservé ; P2-D : 3/3 rapides |
| GET parcours Centre rapide | 363 | 336 | Parent 45 conservé, P2-B.6/P2-D ; 363 si preview déjà partie |
| Parses Instant réussis M7 | 2 463 850 | 3 441 | P2-A : 3 344 ; P2-B : +97 lors de préparation exacte |
| Validations timezone du pipeline | 10 767 | 2 | P2-A, réutilisation request-local ; pas une validation unique globale |
| Compile / derive sur état neutre certifié | 2 / 2 | 1 / 1 | P2-A ; recalcul nécessaire conservé hors guard |
| Appels overlaps M7 | 832 557 | 1 666 | P2-B, 830 891 évités, résultats positifs/identités inchangés |
| Champs Operations by-ID | 67 | 23 | P2-C2, 22 colonnes + alias exact |
| Hydratation historique Operations | 3 603 183 octets | 1 221 089 octets | P2-C2 : mêmes 1 436 lignes / 12 GET, −66,1 % |
| Payload global headless décodé | 15 773 984 octets | 13 303 172 octets | P2-C2/P2-D replay : 313 GET / 38 377 lignes, −15,7 % |
| Attente artificielle avant sources | 2 779,06 ms | 0,31 ms | Avant/après P2-D ; P1 observait 1 761,1 ms sur un autre run |
| Projection économique finale post-I/O | Non isolée P0/P1 | 0,313–0,337 s | P2-D2, non-hotspot ; aucune réduction revendiquée |
| SQL critique cumulé par famille | Non isolé P0/P1 | 0,408–0,671 s | P2-E1, historique + Purchase-aware, aucune optimisation SQL |
| Concurrence économique / batch IN | 3 / 120 | 3 / 120 | Conservés ; autres IN=100, pagination=1 000 |
| DTO UI réel | 273 000 octets | 273 000 octets | Digest entier identique dans les campagnes certifiées |
| TTI ouverture | 68,076 s hard P0 | 16,576 s direct P2-D2 | Ordre de grandeur inter-campagnes, **pas un delta causal consolidé** |

Les octets headless sont des bodies décodés, répétitions incluses, pas un transfert réseau compressé de Next. Le wrapper Next ne mesure pas les bodies sur les dernières campagnes : bytes/rows non observés restent **UNKNOWN**, jamais zéro. Le coût du GC et les spans inclusifs ne constituent pas des économies indépendantes à additionner.

## 5. Wall-clock observé et limites

TTI = Board hydraté puis recherche Library native traitée, pas temps de preview/Apply distant. Production locale, desktop CSS 1728×900. Chaque ligne garde sa campagne/mode ; aucune nouvelle ouverture n'est faite pour ce checkpoint.

| Campagne / mode | n | TTI médian | Plage |
|---|---:|---:|---:|
| P0, hard refresh R5 | 5 | 68,076 s | 43,011–84,446 s |
| P2-A final, hard refresh | 5 | 27,614 s | 22,379–38,346 s |
| P2-B après, hard refresh | 5 | 18,155 s | 15,789–20,247 s |
| P2-D après, document direct | 3 | 15,283 s | 14,131–21,597 s |
| **P2-D2, document direct, référence récente n=3** | **3** | **16,576 s** | **14,361–20,200 s** |
| P2-D après, Centre→Composer rapide, depuis clic | 3 | 13,806 s | 12,128–15,012 s |
| P2-E1, contrôle frais SQL/HTTP | 1 | 21,268 s | Un seul run, pas une distribution |

P2-D2 est la dernière série directe à trois runs sur le code produit encore présent ; P2-E1, plus récent et conservé, est un contrôle SQL à un run. P2-E2 n'a pas remesuré Composer. **Pas de formule « 68→16 s = pourcentage exact attribuable aux patches »** : modes, instrumentation, cold/warm, pression RAM, charge Auth et réseau ne sont pas parfaitement comparables. Les p95 sur petits n sont peu informatifs ; les runs lents/échecs restent décrits dans chaque rapport, notamment l'Auth 504 initial et le départ Centre tardif.

Référence serveur et ouverture comparable **P2-D2**, n=3, à utiliser pour un futur contrôle direct :

| Mesure | Médiane | Plage |
|---|---:|---:|
| loadEconomicFacts | 12,602 s | 11,280–15,094 s |
| Purchase-aware total | 14,662 s | 12,340–16,462 s |
| readWorld | 14,810 s | 12,468–16,634 s |
| RSC complete | 15,817 s | 13,526–19,205 s |
| Board visible | 16,061 s | 13,814–19,512 s |
| TTI direct | 16,576 s | 14,361–20,200 s |

Les contrôles Centre sont mesurés depuis clic, le document direct depuis navigation ; ne pas les comparer en ignorant le parent. Premiers headers/first chunk RSC anticipés ne remplacent pas RSC complete. Aucun temps de mutation distante, assistant riche ou Apply réel n'est extrapolé depuis cette ouverture vide.

## 6. Hotspot restant

**Les 291 GET restent un coût structurel connu**, lié à la collecte Canonical distante et ses hydratations batchées. P2-D2 observe des queries économiques en cours sur 97,18–97,62 % de la durée owner, avec seulement environ 0,3 s de projection après dernière query. Cette union d'intervalles n'est pas un pourcentage de CPU idle ni du temps SQL pur.

Les quatre familles P2-E1 prennent **7,65–10,75 s côté Node** malgré **0,41–0,67 s SQL cumulées**. Headers historiques moyens **1,816–2,473 s**, pic EconomicFacts 33 / Composer 43–46. L'analyse offline P2-E2 distingue file des workers et délai fetch→headers déjà lancé : la queue locale n'explique pas à elle seule l'inflation des headers. Transport/API/pool/PostgREST/scheduling restent partiellement **UNKNOWN** ; body et finalisation SDK isolés sont de l'ordre de quelques ms ou moins.

Pas de gros CPU post-I/O, seconde barrière sûre, partage rentable parmi les candidats inspectés, mauvais plan majeur sur les quatre familles ou tuning significatif démontré. Cela ferme **cette phase**, sans déclarer tous les owners SQL/transport optimaux. Aucun besoin de poursuivre immédiatement avant les features.

## 7. Optimisations non retenues / différées

Seuls sharing ciblé, barrières et concurrence ont fait l'objet des expériences décrites ; les alternatives hors scope ci-dessous ne sont pas présentées comme benchmarkées.

| Piste | Décision et raison |
|---|---|
| Mega-cache Canonical | Non introduit : freshness, révisions, permissions et comparabilité ne sont pas prouvées pour un tel cache. |
| Partage de closures à faible rendement | P2-C arrêté : meilleur potentiel sûr de 11 GET / 0,215 Mo trop faible pour couvrir plusieurs hydratations. |
| Concurrence 5 | P2-E2 non retenue : seulement 68 ms sur une famille isolée, headers et pic accrus ; aucun gain global certifié. |
| Index SQL spéculatifs | Non justifiés par les plans/temps exécutés des quatre familles ; aucun DDL. |
| Réécriture des vues SQL | Non retenue : ces SELECT rapides ne démontrent pas le défaut dominant supposé. |
| Scheduler global custom | Non introduit : pas de gain de grande valeur prouvé justifiant de remplacer les workers bornés existants. |
| Pool HTTP custom | Non introduit : attribution fine inconnue, aucune preuve pour changer la gestion des connexions. |
| Snapshot historique immédiat | Différé à P3 : contrat produit/provenance/invalidation à stabiliser, pas un prérequis actuel. |
| Réduction arbitraire des fenêtres historiques | Refusée : changerait références, completeness, floors ou autorité personnelle. |
| Suppression de facts | Refusée : accélérer en retirant une evidence n'est pas la parité ; P2-C2 retire seulement des colonnes inutilisées du SELECT audité. |
| Augmentation agressive du parallélisme | Non retenue : risque de contention globale, aucun gain global suffisant certifié. |
| P2-F DTO / P2-G frontend performance | **DEFERRED UNTIL TRIGGER**, sauf nouvelle preuve produit ; 273 kB de DTO ne dominent pas les 10+ secondes serveur. |

## 8. Invariants performance et architecture

Canonical reste la vérité source, **PlanningBaseline dérivé**, **PlanRevision durable**. Le Plan exprime une intention et n'écrase pas le réel. Preview = Apply = Immediate Reload conserve le Compiler/financial owner existant et le server re-read/recompile ; stale authorities/revision/pricing produit zéro write. La parité existante couvre des fixtures synthétiques, elle n'autorise pas un Apply distant.

UNKNOWN, unresolved/completeness, références historiques fermées, contraintes réellement soutenues, protected savings, sourceRefs et provenance restent présents. Une intention compte une fois : external PlannedExpense, Context, PlanSlot, Need et journey doivent garder leurs relations explicites. Cash et coût économique fuel restent séparés ; aucune seconde vérité financière dans React, cache, snapshot ou nouvel owner.

### Performance regression guards

Conserver les invariants **structurels**, sans seuil fragile de timing CI. Les guards existants sont les points d'entrée ; aucune nouvelle suite n'est créée ici.

| Garde | Régression à prévenir | Vérification existante |
|---|---|---|
| P2-A Instant | Même timestamp reparsé massivement, memo entre builds/households, erreurs cachées | [check-mobility-build-memo](../../scripts/check-mobility-build-memo.mjs) |
| P2-A timezone | Validation répétée non bornée ou timezone admise sans validation | [check-timezone-validation-scope](../../scripts/check-timezone-validation-scope.mjs) |
| P2-A neutralité | Retour à deux compile/derive sur le cas entièrement équivalent sans justification ; suppression hors guard | [check-planner-neutral-evaluation](../../scripts/check-planner-neutral-evaluation.mjs) |
| P2-B M7 | Retour au scan pairwise brut massif ; perte de frontières, source order, fallback ou identité | [index exact](../../scripts/check-mobility-presence-index.mjs), [scaling](../../scripts/check-presence-index-scaling.mjs) |
| P2-B.6 Centre | Preview démarrée avant un départ rapide, réponse stale appliquée, stay/legacy cassé | [lifecycle](../../scripts/check-control-center-preview-lifecycle.mjs), 27 cas certifiés |
| P2-C2 Operations | Retour by-ID à `select("*")`, précision monétaire ou metadata consumer perdue | [fieldset](../../scripts/check-historical-operations-fieldset.mjs) |
| P2-D Forecast | Branche indépendante replacée derrière Forecast, priorité d'erreurs/admission modifiée | [orchestration](../../scripts/check-composer-orchestration.mjs), 15 cas certifiés |
| Parité métier | Projection seule égale mais UNKNOWN, identités, sourceRefs ou manifest différents | [Planner performance parity](../../scripts/check-planner-performance-parity.mjs), 22 cas × 9 hashes |
| Batching | Concurrence non bornée, batch/pagination ou échec partiel implicite | [canonical batching](../../scripts/check-canonical-in-batching.mjs) |

Pour chaque nouveau owner : documenter scope, rôle, fenêtres, SELECT requis, batching et dépendances ; éviter N+1 par item/card/Context, duplicate full-world build et lectures Canonical déjà fournies par une authority **réellement comparable**. Aucun cache cross-request implicite. Une branche indépendante démarre avec ses inputs prêts, sans forcer un parallélisme global. Toute nouvelle métadonnée nécessaire étend explicitement le fieldset et son guard ; ne pas contourner la provenance pour préserver un chiffre.

## 9. Triggers de réouverture

Garde-fous de roadmap, **pas des SLA contractuels**. Comparer même parcours, machine/runtime, mois/dataset/état, cutoff/protocole, scénario d'Auth et instrumentation ; expliquer les différences légitimes de la feature. Un run lent, +200 ms isolés, +1 GET ou une impression ponctuelle ne rouvrent pas la phase.

| Trigger | Seuil de réouverture |
|---|---|
| A — ouverture directe | TTI médian **+25 %** ou **+3 s absolues durables** face au checkpoint comparable ; référence P2-D2 16,576 s. |
| B — serveur | readWorld ou RSC complete **+25 % durable**, ou nouvelle barrière identifiable **≥1 s** ; références P2-D2 14,810 / 15,817 s. |
| C — volume | **≥10 % de GET** ou **≥20 % de payload serveur** ajoutés sans justification produit claire ; comparer séparément 291 GET Next, 273 000 bytes DTO et le payload headless de 13 303 172 bytes. |
| D — algorithme | Retour d'un O(N²) brut massif, centaines de milliers/millions de parses répétées, duplicate full-world build ou nouveau N+1. |
| E — interaction | Action attendue locale durablement **>800 ms**, ou répétitions **>500 ms** accompagnées d'un blocage perceptible : audit limité à cette interaction. |

« Durable » exclut un pic isolé : constater le dépassement sur la médiane d'un mini-check comparable, vérifier la charge/scope, puis confirmer dans un contrôle ciblé avant optimisation. Une violation structurelle identifiée peut déclencher directement l'investigation. P2-E1 à un run n'est pas une régression de feature : même code, autre fenêtre, contrôle distinct. Si le dataset/produit a changé, établir une comparaison pertinente, sans masquer la hausse ni déclarer artificiellement une régression réseau.

**Budget après chaque gros lot fonctionnel**, pas après chaque bouton : **trois ouvertures directes maximum**, GET count, DTO size, un guard métier pertinent, résultats et contexte consignés. Aucun profil, campagne SQL/replay/concurrence lourde hors trigger. En cas de trigger confirmé, limiter le chantier au propriétaire concerné et ses contrôles ; l'autorisation de ce checkpoint ne démarre aucune de ces campagnes.

## 10. Position snapshot

**P3 snapshot n'est pas annulé, il reste différé : “candidate future optimization, not current prerequisite.”** Les optimisations évidentes sont faites, tandis que Plan→PlannedExpense→Réel, Mobility, wallets, provenance/maturity, Mois à venir, Prévoir une dépense et R6 vont encore faire évoluer les frontières produit. Une authority historique réutilisable pourra devenir utile lorsque ses clés, fraîcheur, invalidation et provenance seront plus stables. Aucun snapshot, précompute, Redis ou cache nouveau n'est implémenté maintenant.

## 11. Roadmap produit

**PERFORMANCE PHASE = CLOSED FOR NOW. PRODUCT_FEATURE_WORK_CAN_RESUME = YES.**

1. Spécification transversale **Plan → Mois à venir → Prévoir une dépense → Réel**.
2. **R6 — Art Direction + Semantic Presentation Layer**.
3. Enrichissement produit par lots.
4. Mini-check performance après gros lots uniquement.
5. Réouverture performance seulement sur trigger confirmé.
6. Plus tard, P3 snapshot si toujours utile.

Aucune étape n'est démarrée dans ce checkpoint. P2-F/P2-G ne sont pas lancés automatiquement ; cette décision ne bloque pas R6 comme tranche produit.

## 12. Gate finale et certification documentaire

Les douze rapports P0/P1/P2 ont été consolidés ; liens source inclus dans les sections ci-dessus. Les preuves existantes sont réutilisées, pas recertifiées par une nouvelle campagne. Dernier code produit inchangé depuis P2-D ; P2-D2 certifie goldens 22×9, lifecycle, orchestration, architecture 882 fichiers, typecheck et build ; P2-E1 confirme architecture PASS. Aucune de ces suites n'est présentée comme relancée au checkpoint.

Vérifications de cette passe : HEAD/status/log réels, cohérence des métriques/sources et liens, `git diff -- src` et `git diff -- supabase` vides ; un seul document ajouté. Aucun SQL, lecture Supabase supplémentaire, benchmark navigateur, profiling, replay, typecheck ou build. **Remote business writes = 0, migration = none.** Un seul commit : `docs(perf): checkpoint Composer performance`, puis status/HEAD/log final vérifiés ; le HEAD documentaire complet et le worktree propre sont communiqués à la livraison.

```ini
PERFORMANCE_CHECKPOINT = PASS
PERFORMANCE_PHASE = CLOSED_FOR_NOW
P0 = COMPLETE
P1 = COMPLETE
P2_A = PASS
P2_B = PASS
P2_B5 = PASS
P2_B6 = PASS
P2_C = STOP_NO_HIGH_VALUE_REUSE
P2_C2 = PASS
P2_D = PASS
P2_D2 = STOP_NO_HIGH_VALUE_INTERNAL_BARRIER
P2_E1 = PASS_SQL_NOT_JUSTIFIED
P2_E2 = STOP_NO_HIGH_VALUE_TRANSPORT_TUNING
CURRENT_KNOWN_GET_COMPOSER = 291
CURRENT_DTO_BYTES = 273000
CURRENT_HEADLESS_DECODED_BYTES = 13303172
CURRENT_ECONOMIC_CONCURRENCY = 3
CURRENT_ECONOMIC_IN_BATCH_SIZE = 120
SQL_OPTIMIZATION_JUSTIFIED = NO
TRANSPORT_TUNING_JUSTIFIED = NO
SNAPSHOT_REQUIRED_NOW = NO
P3_SNAPSHOT = DEFERRED
P2_F = DEFERRED_UNTIL_TRIGGER
P2_G = DEFERRED_UNTIL_TRIGGER
PRODUCT_CODE_CHANGED = NO
REMOTE_BUSINESS_WRITES = 0
MIGRATION_REQUIRED = NO
SNAPSHOT_NOT_STARTED = YES
FRONTEND_REFACTOR_NOT_STARTED = YES
R6_NOT_STARTED = YES
PRODUCT_FEATURE_WORK_CAN_RESUME = YES
NEXT_PHASE = TRANSVERSE_PRODUCT_SPEC_THEN_R6
```
