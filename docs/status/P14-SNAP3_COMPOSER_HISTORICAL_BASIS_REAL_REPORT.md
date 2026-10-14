# P14-SNAP-3 — progression de la première tranche Canonical

Date : 14 octobre 2026. **SNAP3_CANONICAL_REAL_GAIN_FIRST_PROOF**. La mission n'est pas clôturée.

## Point de départ

- Main distant vérifié par `git fetch origin main` : `f765f6d3e38d9f338f6a442071bc4eddfa01b6e7`.
- Worktree initial propre ; branche dédiée `codex/composer-v3-p14-snap3-historical-basis` créée depuis ce main.
- Première implémentation : `920549d54c81dae362649bee3f5e70186996abb0`.
- Instrumentation opt-in et preuves utiles reprises de `c0fdbe0`, sans réintroduire un prototype de lecteur. P3 OFF, SNAP-1/2 OFF dans les Previews.

## A. Travail développé

`historical-basis.ts` prépare avec **le vrai `CanonicalRepository.loadPurchaseAwareCanonical(PURCHASE_AWARE_PILOT)`** puis conserve exactement ses faits `fct_purchase_aware_economic_component` consommés par Baseline. La préparation inclut toujours la découverte bancaire/date réelle/forced-month, coûts, timing, rapprochements et classifications du propriétaire. Aucun filtrage économique simplifié n'est ajouté.

Les sorties préparées sont compressées sans perte (`deflate-raw-json@1`), avec digest du payload et de l'enveloppe, limites de 8 Mio décodés et 2 Mio pour l'enveloppe SQL. Ce sont des plafonds de protection, pas des mesures de volumétrie réelle. Le READ n'effectue aucune préparation ni publication ; OFF ne construit aucun store et n'exécute aucune RPC d'admission. MISS confirmé revient au lecteur direct ; erreur de transport, permission ou corruption reste une erreur explicite.

Le scope exact conserve auteur/foyer/personnes/timezone/contrat/plage/méthode. La borne historique remplace le jour courant dans l'identité : une plage close ne change pas simplement parce que le jour avance. Les corrections rétroactives doivent avancer la preuve de dépendances.

Apply et CHECK_APPLY conservent les chemins autoritaires existants. Draft, Plan, MonthInputs, PlannedExpenses, Wallet, épargne, évidence courante et devis restent vivants. **M7, Global compact et préparation d'évidence historique : non implémentés**, conformément au gate du premier test réel.

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
| Ouverture FRESH P50/P95 | NOT_RUN | NOT_RUN | Non établi |
| Dernière décision → FRESH / Soirée / SUGGESTIONS | NOT_RUN | NOT_RUN | Non établi |
| World / Canonical / M7 / Global / Evidence / Finance | NOT_RUN | NOT_RUN | Non établi |
| GET/RPC / octets / admission / préparation | NOT_RUN | NOT_RUN | Non établi |
| HIT/MISS, timeouts | NOT_RUN | NOT_RUN | Non établi |

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

Production/main restent `f765f6d`, inchangés. Aucun push, PR ou merge SNAP-3 ; aucune activation Production. Aucune écriture financière, Apply, publication Global/Forecast forcée ou compte fictif.

Rollback applicatif prévu : `COMPOSER_P14_SNAP3_HISTORICAL_BASIS=0`, lecteur direct et aucun coût d'admission. En cas d'incident des writers, désactiver non destructivement la consommation et le state, puis examiner le mécanisme de version avant toute suppression de trigger ; ne jamais réactiver un ancien artifact sans nouvelle preuve. Aucune suppression d'artifact, Draft ou Plan.

## F. Reprise minimale

1. Préparer et publier la première portion Canonical via la route authentifiée dédiée, mesurer sa complétude, sa taille, son coût et sa parité.
2. Mesurer OFF/ON alternés à scope/viewport/Draft identiques ; distinguer World et FRESH, préserver les essais défavorables.
3. Étendre M7 et le lecteur Global compact **uniquement après cette première preuve** ; puis gates de livraison/activation prévus par la mission.

Le premier gate réel Canonical justifie l'étude de M7 et Global compact. SNAP-3 reste une mission en cours ; SNAP-4 n'est pas commencé.
