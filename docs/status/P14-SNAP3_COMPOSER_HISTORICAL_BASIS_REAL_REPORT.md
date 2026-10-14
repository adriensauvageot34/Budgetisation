# P14-SNAP-3 — socle Canonical/M7/Global, mesures réelles et gate de livraison

Date : 14 octobre 2026. **SNAP3_REAL_GAIN_PARTIAL_BLOCKED_CANONICAL_REFRESH**. La première tranche Canonical avait démontré un gain réel avant M7. Après la migration M7, l'ancien artifact Canonical est correctement invalidé, mais sa republication a rencontré un timeout PostgreSQL. M7 est publié et relu avec une session authentifiée ; la consommation combinée Canonical + M7 n'est donc pas certifiée. SNAP-3 reste désactivé en Production.

## Point de départ

- Main distant vérifié par `git fetch origin main` : `f765f6d3e38d9f338f6a442071bc4eddfa01b6e7`.
- Worktree initial propre ; branche dédiée `codex/composer-v3-p14-snap3-historical-basis` créée depuis ce main.
- Première implémentation : `920549d54c81dae362649bee3f5e70186996abb0`.
- Instrumentation opt-in et preuves utiles reprises de `c0fdbe0`, sans réintroduire un prototype de lecteur. P3 OFF, SNAP-1/2 OFF dans les Previews.

## A. Travail développé

`historical-basis.ts` prépare avec **le vrai `CanonicalRepository.loadPurchaseAwareCanonical(PURCHASE_AWARE_PILOT)`** puis conserve exactement ses faits `fct_purchase_aware_economic_component` consommés par Baseline. La préparation inclut toujours la découverte bancaire/date réelle/forced-month, coûts, timing, rapprochements et classifications du propriétaire. Aucun filtrage économique simplifié n'est ajouté. Cette section décrit la première tranche ; l'extension M7/Global est documentée en F.

Les sorties préparées sont compressées sans perte (`deflate-raw-json@1`), avec digest du payload et de l'enveloppe, limites de 8 Mio décodés et 2 Mio pour l'enveloppe SQL. Ce sont des plafonds de protection, pas des mesures de volumétrie réelle. Le READ n'effectue aucune préparation ni publication ; OFF ne construit aucun store et n'exécute aucune RPC d'admission. MISS confirmé revient au lecteur direct ; erreur de transport, permission ou corruption reste une erreur explicite.

Le scope exact conserve auteur/foyer/personnes/timezone/contrat/plage/méthode. La borne historique remplace le jour courant dans l'identité : une plage close ne change pas simplement parce que le jour avance. Les corrections rétroactives doivent avancer la preuve de dépendances.

Apply et CHECK_APPLY conservent les chemins autoritaires existants. Draft, Plan, MonthInputs, PlannedExpenses, Wallet, épargne, évidence courante et devis restent vivants. La préparation d'évidence historique n'a pas été ajoutée ; M7 et Global compact figurent en F.

## B. Migration Canonical appliquée

Fichier complet : [P14_SNAP3_CANONICAL_BASIS_REVIEW.sql](../../supabase/candidates/P14_SNAP3_CANONICAL_BASIS_REVIEW.sql).

SHA-256 des octets du fichier : **35582B111D8B22B921D4E7BF49E6653CEF5F6A2AC0AC1CEE9D3BCD2068C2B810**.

- Deux tables privées : `composer_historical_basis_state` et `composer_historical_basis_artifacts`, RLS activée, aucun accès direct ordinaire ou service_role.
- Inspect authentifié : autorisation actuelle via l'autorité Auth/membership/personnes/timezone et scope Canonical existante ; aucune confiance dans user_metadata.
- Publish service_role uniquement, owner postgres, search_path vide, digest, preuve fraîche, génération CAS et vérification après verrou. Aucun retry aveugle après réponse perdue.
- 22 triggers statement ALWAYS : operations, allocations, items, payment_components, cash_economic_uses, refunds, consumption_segments, operation_place_links, financial_source_person_links, categories, subcategories, merchants, purchase_events, memberships, timing, economic_components, purchase classifications, component classifications, households, persons, household_memberships, analysis_periods.
- Dépendances de vues recensées par catalogue SQL récursif borné. Les définitions de huit vues sont attestées à chaque inspection ; absence/altération de la couverture rend le socle inadmissible.
- Les triggers n'écrivent que le compteur privé. Compteur global conservateur : son verrou peut ajouter de la contention et son indisponibilité peut faire échouer un writer source. Coût/contension Production **NOT_RUN**. Aucune prétention à une granularité par mois.
- La migration est atomique dans son SQL avec lock_timeout 5 s ; publish limite l'attente du compteur à 2 s. Aucun relèvement de statement_timeout.

La revue automatique avait demandé un accord explicite sur ce SQL exact, en raison des 22 triggers sur des sources financières. Après cet accord, le fichier à l'empreinte ci-dessus a été appliqué par `supabase_apply_migration` : **`20261014165936_composer_historical_basis_canonical`**. Sa copie versionnée se trouve dans `supabase/migrations/` avec la même empreinte. Aucun contournement ni exécution SQL parallèle n'a été utilisé.

Contrôles distants immédiats : deux tables avec RLS, 22 triggers ALWAYS, couverture des writers `true`, propriétaires RPC `postgres`, inspect exécutable par `authenticated` mais pas `anon`, publish exécutable par `service_role` mais pas `authenticated`, aucun INSERT direct `authenticated` sur l'artifact. Un seul état. L'Advisor signale `rls_enabled_no_policy` pour les deux tables privées ; c'est cohérent avec l'absence voulue d'accès direct et les RPC `SECURITY DEFINER`. Il signale aussi l'inspection `SECURITY DEFINER` accessible à `authenticated` ; ce droit est intentionnel et les tests JWT ci-dessous en vérifient les barrières. Les deux index d'artifact sont encore non utilisés avec une seule ligne, constat attendu.

## C. Contrôles exécutés

| Contrôle | Statut et limite |
|---|---|
| Migration exacte PostgreSQL 17.11 | PASS, nouvelle base synthétique distincte |
| Sorties du builder propriétaire, UNKNOWN/PARTIAL/timing et compression sans perte | PASS synthétique |
| HIT sans reconstruction / OFF sans admission | PASS synthétique |
| CAS simultané, deux backends PostgreSQL distincts | PASS, un gagnant |
| Réponse perdue, relecture du commit / ancien CAS refusé | PASS synthétique |
| INSERT/UPDATE/DELETE/TRUNCATE des sources + rollback | PASS synthétique, 22 dépendances |
| Droits directs, scope auteur/foyer/personnes, appartenance | PASS avec rôles SQL locaux, **pas des JWT Supabase** |
| OFF serveur, trigger désactivé, définition de vue modifiée | PASS, admission fermée |
| TypeScript | PASS |
| Next complet local | PASS, log conservé |
| Next des deux Previews du code 920549d | READY réel |
| Trace concurrente/thenables/isolation/garde lecture seule | PASS |
| C2 purchase-aware | PASS 61/61 |
| Golden | PASS 22 scénarios × 9 empreintes, zéro écriture distante |
| P11/P12/P13, Kernel, Baseline, Mobility, Preview lifecycle, FOOD | PASS fixtures locales |
| SNAP-1 | PASS 16 contrôles ; premier essai arrêté par dossier existant, log initial conservé |
| SNAP-2 | PASS 17 contrôles PostgreSQL 17 synthétique, World/Finance/Apply inclus |
| API Preview sans session Budgetisation | PASS, HTTP 401 AUTHENTICATION_REQUIRED via vercel curl officiel |
| Migration réelle / RLS-grants-couverture structurels | PASS lecture distante, aucun writer métier sollicité |
| Publication réelle Canonical et relecture | PASS JWT réel ; génération 1, 200 faits, 34,24 s hors READ, 368 328 octets décodés, 45 408 octets transférés |
| JWT Supabase SNAP-3 / autorisation | PASS ciblé : auteur, foyer, personnes altérés refusés ; publication refusée au rôle authentifié |
| Invalidation réelle par mutation financière | NOT_RUN ; aucune source réelle mutée pour le test |

R3-008 `CONTEXT_REFERENCE_OWNER_UNAVAILABLE` reste un échec préexistant documenté ; il n'a pas été réexécuté ni requalifié en PASS ici. Les contrôles React des deux composants concernés préservent authentification serveur, gating, boutons natifs, état accessible et absence de calcul financier client.

## D. Previews et mesures

Code produit identique dans les deux uploads CLI : `920549d`. Même iad1, P3=0, SNAP-1=0, autosave=false, instrumentation identique, garde lecture seule ; seule la consommation SNAP-3 varie. Les nouveaux logs synthétiques ne sont pas des données financières ni des changements du build financier.

- OFF : `dpl_4tbs8pu7kq8QuZnbA1WWwL3u5Rig`, [Preview](https://budgetisation-l4rndz2de-adriensauvageot34-6137s-projects.vercel.app), READY.
- ON : `dpl_CZxtZr2paTTBJw9AJjoCCtQ5YVUT`, [Preview](https://budgetisation-fnnijf9sq-adriensauvageot34-6137s-projects.vercel.app), READY.
- Protection Vercel conservée ; aucune promotion ni modification de configuration globale.

| Mesure réelle SNAP-3 | OFF | ON | Gain |
|---|---|---|---|
| Ouverture FRESH P50/P95, première tranche Canonical, n=5 | 16,57 / 27,34 s | 11,73 / 12,23 s | Médiane appariée 7,35 s ; P95 descriptif |
| Dernière décision → FRESH / Soirée / SUGGESTIONS | NOT_RUN | NOT_RUN | Non établi |
| World, première tranche Canonical, n=5 | 13,51 / 24,07 s | 7,34 / 8,52 s | Descriptif, branches parallèles variables |
| Canonical direct / admission, n=5 | 13,30 / 23,85 s | 1,79 / 3,14 s | Reconstruction remplacée par admission |
| M7 / Global / Evidence / Finance | Mesures détaillées à compléter | Mesures détaillées à compléter | M7 est devenu la barrière ON |
| GET/RPC métier par ouverture | 284 | 127 | 157 évités sur cette première tranche |
| Octets / admission / préparation | Dernière paire 11,75 Mio lus | 7,51 Mio lus ; préparation 34,24 s hors READ | Octets fetch, non trafic facturé |
| HIT/MISS, timeouts | 5 lectures directes | 5 HIT Canonical | Aucun timeout dans ces dix ouvertures |

Un artifact réel SNAP-3 a été publié puis relu. Cinq paires alternées de rechargement chaud authentifié, même compte/mois/région `iad1`/viewport 1728×900/code et même digest de projection. Détails individuels sans données personnelles : [preuve JSON](evidence/p14-snap3/real-canonical-first-proof.json).

| Mesure, n=5 par variante | OFF P50 / P95 descriptif | ON P50 / P95 descriptif |
|---|---:|---:|
| Board + Preview FRESH navigateur | 16,57 / 27,34 s | 11,73 / 12,23 s |
| World serveur | 13,51 / 24,07 s | 7,34 / 8,52 s |
| Canonical propriétaire direct / admission artifact | 13,30 / 23,85 s | 1,79 / 3,14 s |
| M7 contextuel | 12,89 / 21,93 s | 7,14 / 8,31 s |
| GET/RPC métier par ouverture | 284 | 127 |

Gains FRESH appariés : **15,61 ; 3,23 ; 7,35 ; 8,14 ; 2,50 s**, médiane 7,35 s. Les cinq HIT ont supprimé 157 appels observés. Toutes les projections ont le même digest, tous les Boards sont FRESH et le garde d'écriture du benchmark n'a rien intercepté. Sur la dernière paire, les corps de réponses observés totalisent 11,75 Mio OFF contre 7,51 Mio ON ; ce sont des octets lus par `fetch`, pas une mesure du trafic facturé. P95 n=5 reste descriptif, non une certification de fiabilité. Les branches parallèles M7/Global ont aussi fortement varié entre paires : on ne peut pas attribuer causalement tout le gain FRESH à Canonical. Le travail Canonical évité et son coût d'admission, eux, sont directement constatés. M7 devient la principale barrière ON.

## E. Livraison et rollback

Production/main restent `f765f6d`, inchangés. Aucun push, PR ou merge SNAP-3 ; aucune activation Production. Aucune écriture financière, Apply, publication Global/Forecast forcée ou compte fictif. Ce maintien est une décision de gate : après M7, l'artifact Canonical est obsolète et la seule tentative de republication a échoué sur `57014`.

Rollback applicatif prévu : `COMPOSER_P14_SNAP3_HISTORICAL_BASIS=0`, lecteur direct et aucun coût d'admission. En cas d'incident des writers, désactiver non destructivement la consommation et le state, puis examiner le mécanisme de version avant toute suppression de trigger ; ne jamais réactiver un ancien artifact sans nouvelle preuve. Aucune suppression d'artifact, Draft ou Plan.

## F. Extension M7 et Global compact (14 octobre)

Après la preuve Canonical, le commit local `d01a06e6e63640873c6c51dbf09a0dfaaba472a3` ajoute le socle M7 et la lecture Global/FOOD compacte. M7 prépare hors READ les occurrences, legs et relations Mobility propriétaires, puis les admet avec scope, digest, version et preuve de couverture. Les données MonthInputs, PlannedExpenses, Wallet, Draft et Plan actif restent lues en direct ; Compiler/Finance V2 et Apply restent inchangés. Global réutilise la publication `analysis_global_background_rhythms` de la même génération que Forecast, avec le validateur du propriétaire ; le chemin sans Forecast fourni conserve son lecteur complet.

La variante SQL M7 approuvée, SHA-256 `E81B79F8CB4948A3335C90404D728428DD320C6AF7C0514C08239E5FBE28D041`, a passé huit contrôles PostgreSQL 17 synthétiques et a été appliquée officiellement comme `20261014174653_composer_historical_basis_m7`. La copie versionnée est identique octet pour octet. Elle étend la couverture à 30 triggers ALWAYS et élève l'époque de schéma : l'ancien artifact Canonical est volontairement inadmissible jusqu'à republication. Les deux tables privées, RPC et grants restent les mêmes. Les contrôles distants ont confirmé la couverture de writers et les droits attendus ; ils ne remplacent pas un test de consommation M7 avec vrai JWT. Aucun writer financier n'a été sollicité.

Contrôles locaux après extension : TypeScript PASS ; PostgreSQL 17 M7 8/8 PASS ; Global/FOOD 50 contrôles PASS dont les rejets de publication absente, méthode invalide et génération discordante ; Baseline 14/14 PASS après adaptation du mock au lecteur compact. Le build Next local est **NOT_CERTIFIED** : arrêté après blocage prolongé à l'optimisation Turbopack, sans erreur produit démontrée. Les deux Previews Vercel du même code sont **READY**, vérification de build distante distincte.

Previews instrumentées et protégées, sans promotion : SNAP-3 ON `dpl_6GkiiBE63opkvZPpdZr23NDuZJMC`, OFF `dpl_GZazrLT3kNpPRQDxKPtYcwedU47h`. Les deux premières Previews du même code, dépourvues de télémétrie garantie, sont exclues des chiffres. Les résultats Canonical du tableau ci-dessus concernent le commit antérieur `920549d`, et ne sont pas attribués à M7/Global.

### Publication authentifiée et échec Canonical

- M7 a été préparé une fois dans la Preview ON, publié puis relu avec un vrai JWT Budgetisation. La vérification ultérieure indique « historique disponible et relu » ; les trois READ ON ci-dessous sont des **HIT M7**. Ce n'est pas une preuve d'invalidation par mutation réelle ni un test de scope altéré pour M7.
- L'époque de schéma M7 rend l'artifact Canonical précédent inadmissible, comme prévu. Une tentative de republication Canonical via la Preview a rendu HTTP 503 et aucune publication n'a été confirmée. Les logs de cette tentative contiennent `CanonicalReadError` sur `places` et `timing`, PostgreSQL `57014` (`statement_timeout`). La requête propriétaire exacte n'est pas isolée davantage. Aucune nouvelle préparation Canonical lourde n'a été lancée après ce constat.
- Les mesures finales suivantes comparent donc **M7 HIT ON contre M7 direct OFF, avec Canonical direct dans les deux variantes**. Elles ne mesurent pas le socle complet à deux artifacts.

### A/B authentifié M7, trois paires bornées

Même code produit `d01a06e`, même compte, octobre 2026, région `iad1`, fenêtre **1440×900**, mois et digest Finance V2 identiques. Les trois paires alternent ON puis OFF ; tous les Boards ont atteint `FRESH`, aucune écriture n'a été interceptée et aucune des six lectures n'a signalé de timeout. Les essais initiaux avec des fenêtres différentes ont été exclus. [Paires et protocole sans données personnelles](evidence/p14-snap3/real-m7-controlled-proof.json).

| Mesure, n=3 par variante | OFF P50 / P95 descriptif | ON P50 / P95 descriptif |
|---|---:|---:|
| Board et Preview `FRESH` navigateur | 27,70 / 31,42 s | 19,45 / 19,75 s |
| World serveur | 14,53 / 28,77 s | 14,36 / 16,65 s |
| Canonical direct, encore sur la barrière | 14,30 / 28,48 s | 13,68 / 15,83 s |
| M7 direct / admission | 13,43 / 23,56 s | 1,66 / 1,84 s |
| GET/RPC métier par ouverture | 274 | 200 |
| Corps HTTP décodés observés par ouverture | 9,89 Mo | 6,58 Mo |

Gains `FRESH` appariés OFF − ON : **8,25 s ; −0,21 s ; 11,67 s**, médiane 8,25 s. **74 GET/RPC** sont évités par ouverture dans ce protocole. Le gain de M7 est directement visible sur sa branche ; le gain utilisateur global est **instable et non causalement attribuable** avec trois paires : Canonical direct varie fortement, jusqu'à 28,48 s côté OFF, et reste le chemin critique côté ON. Le P95 à n=3 est une statistique descriptive, pas une certification de fiabilité ni une preuve que les cibles 5 s/2 s sont atteintes. Le champ « corps HTTP décodés » ne représente pas le trafic réseau facturé.

Global/FOOD compact réutilise la publication de même génération que Forecast ; dans les READ ON observés, sa branche de publications est de 0,55 à 1,67 s, sans publication Global supplémentaire. Son gain isolé, l'ajout Soirée → FRESH, SUGGESTIONS et la dernière décision → FRESH restent **NOT_RUN** dans le protocole final. Finance V2 a pris 0,29 à 0,32 s sur les READ ON, sans divergence de digest. Le délai hors serveur est variable et ne peut pas être attribué à un composant unique à partir de ces trois paires.

### Verdict et décision de livraison

`SNAP3_REAL_GAIN_PARTIAL_BLOCKED_CANONICAL_REFRESH` : M7 montre une réduction réelle de travail avec parité observée, et la première tranche Canonical avait démontré un gain FRESH. Le socle complet ne peut pas être activé tant que Canonical n'est pas republié et mesuré après M7. Le build Next local de l'extension reste `NOT_CERTIFIED` ; les deux builds Preview sont `READY`. Le test d'invalidation par écriture financière réelle et les tests de sécurité M7 avec scope altéré restent `NOT_RUN`.

**Aucun push, PR, merge, activation ni déploiement Production SNAP-3** à ce gate. Production et `main` servent toujours `f765f6d`. Les deux migrations additives sont déjà déployées et tracées localement : Canonical `20261014165936`, M7 `20261014174653`. Leur couverture de writers a été vérifiée structurellement ; le coût opérationnel réel de leurs triggers n'a pas été quantifié. SNAP-3 OFF évite l'admission en Production, mais n'annule pas le coût potentiel des triggers SQL déjà installés.

Étape minimale : rendre la préparation Canonical propriétaire fiable sous la limite SQL, sans augmenter `statement_timeout` ni perdre des faits, puis republier **une seule fois** et mesurer de nouveau Canonical + M7 ensemble. Si cela demande une autre migration ou une modification de doctrine Canonical, la soumettre à revue avant exécution. Conserver les artifacts et la possibilité de désactiver la consommation sans suppression. SNAP-4 n'est pas commencé.
