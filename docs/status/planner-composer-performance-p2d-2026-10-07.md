# Composer P2-D LEAN — barrière Forecast supprimée

**P2_D_LEAN = PASS.** Les sources Baseline commencent dès que le repository autorisé, le mois et le cutoff sont disponibles, pendant la lecture du Forecast. Leur attente initiale passe de **2 779,06 ms à 0,31 ms médianes**. Même admission du Forecast publié, mêmes queries et outputs ; aucune autre barrière modifiée.

HEAD_BEFORE : `bf6d3db4906cd6169925cc993797e4f3c57f9510`, `main`, worktree propre. HEAD_AFTER produit testé : `25358cb51e1720b8023ea4d49a451fe60f4d1238`. Le HEAD documentaire final se retrouve avec `git log -1 --format=%H -- docs/status/planner-composer-performance-p2d-2026-10-07.md`. Aucun reset, push ou déploiement.

## Diagnostic ciblé et choix

Diagnostic démarré à 16:28:40 UTC ; décision après les trois ouvertures directes et la lecture des dépendances, avant 16:39:59 UTC, donc sous le plafond de 20–30 minutes. Rapports P2-B/B.5/B.6/C/C2 et sections orchestration P0/P1 réutilisés ; aucune nouvelle matrice des 291 GET.

| Candidat | Observation avant, n=3 | Gain potentiel / risque | Décision |
|---|---|---|---|
| Forecast avant les sources | Sources démarrées à 2,779 s [2,665–4,100] après `readWorld`. Leurs paramètres sont prêts au début. | Environ 2,8 s de barrière ; petit diff, admission de génération à conserver. | Retenu. |
| Sujets Needs après la jointure globale | Product observations prêtes tôt ; attente médiane jusqu'à la lecture des sujets 12,919 s. Cependant la fin des sources dépasse Purchase-aware de seulement 0,108 s [0,104–0,116]. | Grand délai apparent, mais tail critique ici trop faible. Nécessite de préserver les gates d'admission. | Non modifié. |
| Purchase-aware après les facts économiques | Lectures purchase après `loadEconomicFacts` ; tail Purchase-aware 1,362 s [1,276–6,981]. Le premier run est lent et conservé. | Possible recouvrement, mais pipeline, branche DEFAULT/absence d'events et erreurs plus complexes. | Non modifié ; candidat d'une passe distincte. |

Le DAG vérifié pour le candidat retenu :

```text
repository autorisé + month + cutoff ─→ Forecast publié
repository autorisé + month + cutoff ─→ lectures des sources
Forecast + sources ─→ admission publication/revisions identiques
                    ─→ sujets Needs / personal mobility / Baseline
                    ─→ world / Compiler existants
```

Les dix branches de `readPlanningBaselineSources` utilisent client/context, month, range, cutoff et les options simple/renewals. Aucune ne lit les valeurs du Forecast. Celui-ci n'intervient qu'après leur jointure, via `admitPlanningForecast`. Les authorities fraîches et le Forecast restent comparés sur mois, publication, source revision et analytics revision.

## Patch et sémantique d'erreur

Deux fichiers produit seulement : `world-reader.ts` démarre les deux Promises puis attend **Forecast, ensuite sources** ; `baseline-adapters.ts` accepte aussi le Forecast en Promise et attend sa valeur avant l'admission. **12 insertions / 4 suppressions**, commentaires compris. `readDirectWorld` reste inchangé. Aucun SELECT, filtre, ID, fenêtre, batch, pagination, owner, cache, formule financière ou frontend modifié.

Une rejection précoce des sources est observée immédiatement par un handler ; l'await porte ensuite sur la **Promise originale**, qui rejette normalement. Il ne fournit aucun résultat/fallback de remplacement. Si Forecast échoue aussi, son erreur conserve la priorité initiale. Aucun `Promise.allSettled`, cancellation, résultat partiel ou masquage de diagnostic ajouté.

Le nouveau test `check-composer-orchestration.mjs` exécute les vrais corps des deux owners avec leurs dépendances différées : **15 cas PASS**. Ordres rapides/lents inversés, rejection seule ou double, erreur Forecast prioritaire quel que soit l'ordre, inputs manquants, conflit de sujet, UNKNOWN nullable, génération modifiée, mêmes scopes/keys, égalité du world entier et zéro rejection abandonnée. Rouge avant patch sur le démarrage indépendant, vert après. Aucun réseau dans ce test.

## Mini-timeline et chemin critique

Offsets depuis le début de `readWorld`, secondes, médianes de trois lectures directes ; chaque cellule est une statistique indépendante. Les durées sont inclusives et les médianes ne s'additionnent pas. START / DURATION / READY détaillés sont dans les [métriques publiques](planner-composer-performance-p2d-metrics-2026-10-07.json).

| Branche | Avant : START / DURATION / READY | Après : START / DURATION / READY |
|---|---|---|
| Forecast publié | 0,000 / 2,768 / 2,778 | 0,000 / 4,048 / 4,048 |
| Sources Baseline | 2,779 / 13,755 / 17,855 | 0,000 / 13,429 / 13,429 |
| Authorities Forecast | 2,783 / 6,087 / 10,187 | 0,001 / 4,675 / 4,676 |
| Product observations | 2,785 / 0,728 / 3,657 | 0,002 / 0,556 / 0,557 |
| Facts économiques | 2,791 / 12,284 / 16,385 | 0,003 / 11,985 / 11,988 |
| Mobility authority | 2,786 / 11,615 / 15,716 | 0,002 / 11,635 / 11,638 |
| Purchase-aware | 2,790 / 13,646 / 17,747 | 0,003 / 13,326 / 13,329 |
| Baseline builder | 17,856 / 0,064 / 17,886 | 13,429 / 0,034 / 13,463 |

Les paramètres des sources sont disponibles à **0 s**. Avant : branche à **2,779 s**, barrière ≈2,8 s. Après : **0,00031 s médiane**, plage **0,00025–0,00821 s**, pendant le Forecast. Le Forecast lui-même est plus lent dans la série après ; on ne le confond pas avec l'attente supprimée.

| Mesure serveur, s, médiane [min–max], n=3 | Avant | Après |
|---|---|---|
| CRITICAL_PATH, `readWorld` START→READY | 17,886 [15,149–32,116] | 13,463 [12,384–17,751] |
| Requête Composer complète, Auth/boot/compile/réponse inclus | 20,251 [19,810–34,923] | 14,444 [13,320–20,586] |
| `loadEconomicFacts`, durée owner | 12,284 [11,034–22,164] | 11,985 [11,102–12,565] |
| Purchase-aware, durée owner | 13,646 [12,310–29,146] | 13,326 [12,260–17,543] |

**MAX_RELEVANT_IN_FLIGHT_READS : 46→46**, médiane des pics 45→45 ; intervalles observés directs 38–46→39–46. Branche Purchase-aware : 33→33. Les clients après culminent à 36/43/38. Aucun batching ni limite de concurrence changé. Comme P2-B.6, cette mesure couvre **start→headers**, le wrapper Next ne donnant pas les bodies REST ; ce n'est pas une mesure jusqu'à leur parsing complet.

## Navigateur, parité et limites

Trois ouvertures directes **avant le patch**, trois directes après, puis trois Centre→Composer rapides après, délai demandé 100 ms. Production Next locale, un serveur actif par série, contextes Chromium neufs, même mois `2026-10`, viewport CSS 1728×900 et même TTI Board hydraté + recherche native Library. Aucun test/build dans les fenêtres navigateur. Le build avant existant P2-C2 est réutilisé ; comparison byte-à-byte des **903 fichiers src** : seulement les deux owners ci-dessus diffèrent entre copies instrumentées.

| Mesure navigateur, s, médiane [min–max], n=3 | Direct avant | Direct après | Centre→Composer après, depuis clic |
|---|---|---|---|
| RSC complete | 20,265 [19,829–34,948] | 14,459 [13,333–20,618] | 13,326 [11,682–14,512] |
| Board | 20,618 [20,221–35,250] | 14,759 [13,623–20,931] | 13,640 [11,975–14,803] |
| TTI | 21,641 [21,233–35,854] | 15,283 [14,131–21,597] | 13,806 [12,128–15,012] |

Les premiers runs lents sont conservés. Séries successives, n=3, variance de réseau/CPU/boot/Auth : **les −4,423 s de `readWorld` et −6,358 s de TTI ne sont pas des gains causaux garantis ni un SLA**. Preuve forte : la dépendance artificielle et son attente ont disparu, sans augmentation du pic observé. Le chemin critique diminue ; aucun profil V8/heap/GC nécessaire ou exécuté.

**291 GET Composer à chacun des neuf parcours** ; query scopes exactement identiques après normalisation du seul cutoff frais habituel `person_habit_assertions.validated_at` (bornes vérifiées). Aucun SELECT normalisé. DTO entier **273 000 octets**, SHA256 `b51c6c528e97eb4b5d155c9a5dc0bc4351a4e11929c276c9b2d1d8c207cfaadb`, identique dans les neuf cas. Pas d'erreur métier, exception navigateur, action bloquée ou drain incomplet ; seuls des streams HTTP 200 annulés par leur lecteur sont conservés. **P2-B.6 : 3/3, zéro POST/span/GET de preview V2**, 45 GET Centre + 291 Composer = 336 ; prefetchs sans GET métier.

**Un replay ciblé avant, cinq après**, même capture P1 projetée P2-C2, cutoff `2026-10-06T21:00:00Z`, aucun fallback réseau. **5/5 outputs identiques** : harness, DTO entier, et hashes des outputs complets de `readPlanningBaselineSources`, `readWorld`, `loadPurchaseAwareCanonical`, `readMonthComposer`. Queries littérales, **313 GET / 38 377 lignes / 13 303 172 octets**, identiques avant/après. Next bodies non observés = bytes/rows inconnus dans ces traces, pas zéro ; la preuve lignes/octets vient du replay fixe. Les timings replay sans latence réseau et avec build simultané servent uniquement à la parité, pas au benchmark serveur.

## Validation et suite

PASS : orchestration **15 cas** ; Baseline **14** ; Renewals **32 groupes** ; temporal Forecast **63 checks** ; Planner performance parity **22×9 hashes** ; P2-B.6 lifecycle **27/27** ; canonical batching ; architecture **882 fichiers** ; `tsc --noEmit` du checkout. **Un unique Next 16.2.6 production build final PASS** dans la copie après : compilation 32,7 s, TypeScript 42 s, huit pages statiques et finalisation. Même code produit plus probes d'audit symétriques. Le script distant `check-phase2-month-forecast` a seulement échoué sur ses arguments requis, avant toute query ; pas de relance distante, les fixtures temporelles synthétiques pertinentes ont été utilisées.

Commits : `3bb12be` — test ; `25358cb` — barrière Forecast ; commit documentaire final. Raw, Auth, prédicats et helpers privés restent hors Git dans `outputs/planner-performance-p2d` et `work/p2d-*` du workspace de chat. Probes/méthode : harnesses existants `audit-composer-navigation`, `audit-composer-performance-headless`, preload readonly et copie `prepare-composer-navigation-runtime b`. Les processus Next, Chrome et Auth propres à l'audit sont arrêtés.

**Hotspot restant : collecte/hydratation/projection des facts économiques**, owner médian ≈12 s, puis le tail Purchase-aware ≈1,3 s. Recommandation **P2-D2 ciblé sur les dépendances internes de ces owners**, en séparant attentes nécessaires et coût CPU, avant de choisir un éventuel P2-E. P2-D s'arrête après cette seule barrière ; aucun autre chantier commencé.

```ini
ORCHESTRATION_CRITICAL_PATH_AUDITED = PASS
HIGH_VALUE_BARRIER = PASS
FACT_SET_UNCHANGED = YES
QUERY_SCOPE_UNCHANGED = YES
GET_COUNT_EFFECTIVELY_UNCHANGED = YES
HISTORY_WINDOW_UNCHANGED = YES
BATCHING_UNCHANGED = YES
FAILURE_SEMANTICS_PRESERVED = YES
NO_UNBOUNDED_DB_CONCURRENCY = YES
TOUCHED_OWNER_PARITY = PASS
PLANNER_GOLDEN_PARITY = PASS
UNKNOWN_PARITY = PASS
IDENTITY_PARITY = PASS
SOURCE_REF_PARITY = PASS
FIVE_REPLAYS = PASS
P2_B6_PRESERVED = YES
REMOTE_BUSINESS_WRITES = 0
MIGRATION_REQUIRED = NO
P2_D2_NOT_STARTED = YES
SQL_OPTIMIZATION_NOT_STARTED = YES
SNAPSHOT_NOT_STARTED = YES
FRONTEND_REFACTOR_NOT_STARTED = YES
R6_NOT_STARTED = YES
P2_D_LEAN = PASS
```
