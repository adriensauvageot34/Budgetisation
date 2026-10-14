# P14-P4D — Confirmation financière après une interaction

14 octobre 2026. Base : `6ad801a71b6f612032e403b7bc10793954de2fbd`. Branche : `codex/composer-v3-p14-p4d-financial-preview`.

**Verdict : `SAFE_LOCAL_OPTIMIZATION_REAL_GAIN_NOT_CERTIFIED`.** Une reconstruction World redondante de SUGGESTIONS est supprimée avec parité complète. Aucun gain global de dernière intention → FRESH, aucune performance Supabase réelle et aucune cible P95 < 2 s ne sont certifiés.

## A. État initial et conditions

Worktree propre au départ ; ascendance P4B → P4A `33fc974` → P3 `aed9946` → P2 `3705515` → P1 `a934f60` → Express consolidé `fc8dea2` → CSS `deccdcd` → golden `7b38276` → P13 `7d7e883`. P3 reste **0**. Les configurations P1/P2 et les sources UI P4B sont identiques des deux côtés.

Le rapport P4B reste applicable : initial gzip du banc −9,9 %, assets montés 143 → 1, DOM 7 037 → 2 115. Sa série de latences défavorable n'est ni retirée ni requalifiée. Le contrôle préalable P4D est fonctionnel, pas une nouvelle certification React.

Deux bancs existants sont réutilisés :

- Serveur headless : vrais Compiler/Finance V2, repository/C0 PGlite, World et fournisseurs synthétiques ; P4B exact chargé par `git show` et candidat dans le même processus, par paires alternées.
- Navigateur : React **production**, sans Strict Mode ni Profiler, composants P4B identiques, serveur commun 127.0.0.1, fixture A/mois identique (16 éléments, trois contrôles décidés), viewport 1280×720. Quatre blocs alternés de dix modifications par variante. Le pilote appelle la véritable fonction `stage` par événement réservé au banc : les 40 gestes sont **programmatiques, pas des gestes physiques certifiés**. Trois vrais clics supplémentaires valident Soirée/Cadeau avec un retour READ retardé.

Le banc interdit APPLY/CHECK_APPLY côté transport **et** côté serveur. `draftTransport=null` : aucune autosauvegarde distante. Aucun snapshot, accès SQL principal, publication ou appel Mobility réel. Les sondes exportent durées, tailles, compteurs, séquences et digests synthétiques, jamais les requêtes financières, cookies ou secrets. [Preuves](evidence/p14-p4d/).

## B. Pourquoi une seule modification peut attendre plusieurs secondes

Le chemin principal reste :

1. `stageLocalDecision` conserve la nouvelle décision et rend la carte ; l'ancien cockpit n'est pas déclaré à jour.
2. Le scheduler attend **160 ms** pour regrouper les modifications non envoyées. La dernière intention n'attend pas une ancienne réponse déjà en cours.
3. READ appelle à nouveau `authorizedPlanner` dans l'application, puis `readPlannerDraft` : World autoritaire et Plan actif sont lus en parallèle.
4. World construit Forecast/Baseline à partir des publications et propriétaires existants, avec leurs contrôles de date/génération. P1/Express partagent des lectures dans cette demande ; ils ne suppriment pas les lectures entre deux demandes.
5. `prepareWorld` dépend du Draft actuel. Mobility peut ajouter la préparation du trajet, du véhicule et des devis admissibles.
6. `evaluatePlanScenario` compile le Plan, la référence et les impacts marginaux de chaque décision/contexte. Ce n'est pas une simple soustraction du nouveau montant dans React.
7. Le modèle complet est construit, le Plan actif est encore relu par `composerUiModel`, puis la réponse est sérialisée. Le client admet seulement le ticket/digest/périmètre courant et installe la projection.

**Cause prouvée dans le code : une nouvelle lecture World reste nécessaire à chaque READ, et l'évaluation complète garde plusieurs passages Compiler/Finance V2.** Dans la fixture navigateur, chaque READ ordinaire effectue 1 World, 1 évaluation et 5 appels Finance V2 (trois contrôles plus les deux branches). Dans le microbanc à un contrôle : 3 appels ; état neutre : 1. Cela dépend du Draft, pas d'une constante universelle.

La part dominante des secondes de production **n'est pas remesurée ici**. Les chiffres d'ouverture P14-S1-R (286 SELECT, SQL additionné 2,32 s, FRESH outil ~20 s) restent des chiffres d'ouverture, pas ceux d'une modification. Ils ne sont pas extrapolés aux interactions et la durée SQL additionnée ne remplace pas le temps mural.

### Chronologie navigateur mesurée, scénario A

T0 événement sémantique → T1 décision locale → T2 programmation → T3 envoi → T4 réponse entièrement lue et analysée → T5 admission → T6 commit du modèle/cockpit → T7 commit portant FRESH pour le digest courant.

T6/T7 utilisent `useLayoutEffect` après commit React ; ils ne mesurent pas un pixel affiché. Le rAF suivant est conservé séparément comme borne d'occasion de peinture. T4 inclut le transport, le corps et JSON.parse : **ce n'est pas du réseau pur**. Les clocks client et serveur ne sont pas soustraites entre elles.

| Phase, P50 / P95 descriptifs (ms), n=40 | P4B | P4D |
| --- | ---: | ---: |
| T0→T1 état local | 0,8 / 7,9 | 1,1 / 11,2 |
| T2→T3 attente avant envoi | 172,5 / 185,1 | 174,7 / 190,4 |
| T3→T4 réponse complète | 268,1 / 426,4 | 304,0 / 421,0 |
| T4→T5 admission | 0,8 / 1,5 | 1,0 / 2,1 |
| T5→T7 commit actuel | 10,2 / 21,6 | 13,7 / 22,3 |
| **T0→T7 FRESH** | **462,2 / 639,6** | **498,2 / 797,2** |
| T0→rAF, borne de présentation | 690,2 / 1 310,0 | 1 019,7 / 1 385,3 |

[Séries et décomposition](evidence/p14-p4d/browser-summary.json). Le dernier bloc candidat a chevauché une partie du microbanc headless : charge ambiante imparfaitement contrôlée. Les retards de rAF du navigateur de contrôle restent variables. **La série entière, défavorable au candidat, est conservée ; elle ne certifie ni amélioration ni non-dégradation perceptible.** La série preliminaire exécutée avant l'alternance est conservée séparément et n'est pas fusionnée.

Sur les 44 READ interactifs (40 simples + rafale + Undo/Redo + dernière action mémoire), P4B/P4D : serveur P50 **221,8 / 245,2 ms**, World **69,8 / 67,8 ms** avec délai artificiel 60 ms, évaluation inclusive **133,5 / 152,9 ms**, Compiler additionné **119,7 / 138,5 ms**, Finance V2 additionné **7,4 / 8,4 ms**. L'évaluation inclut les spans Compiler/Finance ; **ces durées ne s'additionnent pas**. La préparation Mobility simple est < 1 ms médian ; ce n'est pas une mesure de TomTom. Les phases bootstrap/Auth/Forecast/Canonical réels et construction UI isolée restent NOT_RUN. Le reste du serveur inclut les validations, projections et le modèle, sans attribution artificielle.

## C. Optimisation retenue : une seule lecture pour SUGGESTIONS

### Doublon démontré

P4B fait `readMonthComposer` puis `readPlanBalanceSuggestions`. Chacun appelle `readPlannerDraft` : deux World et deux évaluations du même état initial, en séquence. Le Plan actif est lu trois fois au total, dont la relecture finale de `composerUiModel`.

P4D lit une fois le Draft autoritaire, puis utilise :

- `composerFromDraftRead(read)` : projection pure du même read pour le Board.
- `balanceSuggestionsFromDraftRead(deps, read)` : mêmes capacités et même preview initiale pour les suggestions.

Chaque candidat garde sa **propre préparation du Draft et sa propre évaluation Compiler/V2**. ACCEPT continue à relire les sources et à régénérer/revalider les digests. Apply, CAS, dates, RLS et writers sont inchangés. Aucun World préparé n'est mémorisé entre états ou entre requêtes.

| Travail par SUGGESTIONS | P4B | P4D |
| --- | ---: | ---: |
| readWorld | 2 | 1 |
| Plan actif | 3 | 2 |
| Préparation/évaluation initiale dupliquée | 1 | 0 |
| Simulations des candidats distincts | Conservées | Conservées |
| Exemple état neutre : évaluations / Finance V2 | 10 / 26 | 9 / 25 |
| Exemple avec montant : évaluations / Finance V2 | 12 / 43 | 11 / 40 |
| Octets de la vraie réponse sans sondes | Identiques | Identiques |

Les réponses complètes, capacités, candidats, identités, digests et champs sont identiques sur les cinq fixtures stables. Un changement de source entre les deux anciennes lectures pouvait produire un Board et des suggestions issus de lectures différentes : le test le démontre. P4D prend une admission cohérente dans la demande ; la suivante voit les nouveaux faits. Cela ne crée pas une transaction englobant toutes les tables de World.

### Mesure comparative retenue

40 paires alternées headless, état neutre identique, délai World injecté **60 ms**, aucune lecture Supabase :

| SUGGESTIONS serveur | P4B | P4D |
| --- | ---: | ---: |
| P50 | 888,3 ms | 784,3 ms |
| P95 descriptif | 926,5 ms | 829,3 ms |

Gain médian **104,0 ms (11,7 %)** sur cette fixture. [Toutes les paires](evidence/p14-p4d/suggestions.json). C'est un bénéfice synthétique mesuré, **pas un gain Supabase/Vercel** et pas un gain de la modification simple.

La seule observation navigateur SUGGESTIONS reste défavorable : réponse **1 770,8 → 1 879,4 ms**, serveur **1 722,8 → 1 792,7 ms**, World **2 → 1**, Finance **63 → 58**. n=1, NOT_CERTIFIED. Les octets avec sonde **486 026 → 485 007** reflètent aussi la réduction des métadonnées de mesure ; ils ne prouvent aucune économie du payload produit.

Risque résiduel : une source peut changer après son admission ; la prochaine demande et Apply restent autoritaires. Rollback : revert du commit P4D ; aucun SQL, aucun Draft supprimé. La modification n'ajoute aucun drapeau de cache ni nouvelle table.

## D. Ordonnancement et hypothèses non retenues

- **Debounce inchangé** : 160 ms. Le supprimer paierait davantage de World pour des décisions immédiatement remplacées. Les trois montants programmés à ~40 ms d'intervalle donnent 1 READ/1 World et 2 demandes réellement non envoyées, dans les deux variantes.
- **Pas de file d'attente derrière l'ancienne Preview** : P2 le garantit déjà. Régressions hors ordre, changement de version, Undo, dispose et erreurs rejouées. Une requête envoyée reste active jusqu'au retour ; aucune annulation SQL par AbortController n'est revendiquée.
- **Pas de cache READ inter-requêtes ni de réactivation P3** : la nouvelle demande doit observer les changements de sources. Les demandes identiques encore en cours sont déjà regroupées par P2.
- **Pas d'actualisation automatique supplémentaire des suggestions**. `stage` les invalide/ferme ; ACCEPT relit les digests au serveur. Le mode de génération existant utilise `busy` et peut encore désactiver des contrôles pendant sa réponse. P4D ne supprime pas cette protection sans preuve de gain net et protocole client dédié.
- **Pas de suppression des impacts marginaux**, pas de réduction de période Canonical ni de prix fictif. Ces informations entrent dans le contrat et les digests financiers.
- La dégradation apparente du banc navigateur ne déclenche pas une nouvelle mission React. Le code UI, lazy loading et scheduler sont identiques à P4B ; la charge et la cadence observées ne permettent pas d'attribuer la différence à la projection pure extraite.

Une seule famille d'optimisation produit retenue. Les deux autres familles sont examinées, sans expérimentation de cache ou nouvelle architecture.

## E. Comparaison des scénarios et disponibilité authentifiée

| Indicateur | P4B | P4D | Portée |
| --- | --- | --- | --- |
| Modification simple → FRESH P50/P95 | 462,2 / 639,6 ms | 498,2 / 797,2 ms | React production synthétique, n=40, NOT_CERTIFIED réel |
| Ajout Soirée → FRESH | NOT_RUN comparatif | 2 273,5 ms, n=1 | Vrai clic, délai réponse READ injecté 1 500 ms |
| Validation repas Soirée → FRESH | NOT_RUN comparatif | 2 161,7 ms, n=1 | Décision explicite fixture ; aucun Apply |
| Ajout asset → FRESH P50/P95 | NOT_CERTIFIED | NOT_CERTIFIED | Microbanc READ du Draft équipé, n=4 ; pas de percentile UI |
| Undo → FRESH | 506,0 ms | 472,5 ms | n=1, NOT_CERTIFIED |
| Redo → FRESH | 403,3 ms | 499,9 ms | n=1, NOT_CERTIFIED |
| Dernier montant de rafale → FRESH | 495,0 ms | 479,6 ms | n=1 ; 1 READ, 2 demandes non envoyées |
| SUGGESTIONS complet | 888,3 / 926,5 ms | 784,3 / 829,3 ms | Serveur synthétique n=40, délai World 60 ms |
| READ simple : World / Finance V2 | 1 / 5 | 1 / 5 | Fixture navigateur à trois contrôles |
| READ : corps reçu médian, avec sondes | 319 769 octets | 319 768 octets | Non compressé, ce n'est pas ResourceTiming réseau |
| GET PostgREST / GET Auth / octets Supabase | NOT_RUN | NOT_RUN | Aucun nombre simulé substitué |
| Travaux obsolètes déjà lancés annulés | 0 | 0 | Pas d'annulation SQL implémentée |
| Rafale 100 actions mémoire : READ final | 1 | 1 | 99 timers non envoyés ; actions programmatiques |
| Erreurs du banc final | 0 | 0 | Aucun timeout local ; timeout Canonical réel non retesté |
| Réponse financière/digests | PASS fixture | PASS fixture | Golden et comparaison complète |

[Parcours serveur](evidence/p14-p4d/scenarios.json) : simple, Soirée configurée, composant ajouté, Undo neutre, voiture aller-retour et panne fournisseur. Quatre paires alternées par parcours, **pas de P95 fiable**. Les deux variantes gardent 1 World et le même nombre de Finance V2. Le trajet utilise 1 appel route, 1 référence carburant et 1 péage **synthétiques** ; la panne conserve la réponse admissible/UNKNOWN avec 1 route, 1 carburant, 0 péage. Aucun temps fournisseur réel n'est annoncé.

### Limite des mesures authentifiées

La session Vercel officielle a été reconnue et le projet lié Budgetisation vérifié en lecture seule. La configuration Development ne contient pas les quatre paramètres Supabase nécessaires. La récupération officielle de Preview produit uniquement des placeholders `[SENSITIVE]` pour ces paramètres. Aucun secret de la conversation n'est réutilisé et aucune protection d'export n'est contournée.

Une ancienne Preview ne sert pas l'arbre P4B/P4D et ne constitue pas une comparaison admissible. **Aucune nouvelle Preview n'est autorisée/créée dans ce lot.** Il faudrait une autorisation distincte d'un banc Preview protégé, avec transports explicitement READ-only, ou un environnement local autorisé disposant des valeurs requises. Il ne suffit pas de se connecter au site de production pour mesurer le candidat.

| Environnement | Résultat |
| --- | --- |
| Headless/PGlite synthétique | EXECUTED_PASS, latences limitées aux fixtures |
| Navigateur React production synthétique | EXECUTED, comparabilité/présentation limitées |
| Build Next complet local | EXECUTED_PASS, exit 0 |
| Mesure runtime Next authentifié | NOT_RUN |
| Lecture Supabase authentifiée protégée P4B/P4D | NOT_RUN |

## F. Fiabilité, préflight P4B et régressions

**Préflight navigateur court exécuté :** Soirée visible et panneau interactif alors que Preview=PENDING ; validation explicite du repas ; ajout Cadeau lazy pendant un nouveau calcul ; au retour FRESH le panneau est toujours « Configurer Cadeau ». Aucune fermeture/remplacement par une ancienne réponse constatée. Les trois vrais cycles atteignent FRESH avec leur digest courant ; une première validation a été correctement refusée tant que le montant Banque du composant restait absent. [Chronologie](evidence/p14-p4d/browser-preflight.json), [capture](evidence/p14-p4d/browser-preflight.png). Les réponses hors ordre et l'abandon de chunk restent couverts par les contrôles P2/P4B et leurs preuves héritées, sans nouveau PASS physique de drag.

| Contrôles | Statut |
| --- | --- |
| P4D suggestions : 10 contrôles | EXECUTED_PASS_SYNTHETIC_ONLY ; parité complète, Preserve/UNKNOWN, source changée, refus stale ACCEPT, Apply autoritaire inchangé |
| Six parcours READ P4D/P4B | EXECUTED_PASS_SYNTHETIC_ONLY ; quatre paires chacun ; transports APPLY/CHECK_APPLY refusés |
| Golden 22×9, P11/P12/P13, Kernel, Contexts, conservation P02, Mobility | PASS fixtures/PGlite |
| P1 reuse/opening, P2 mutation/scheduler/présentation/Draft durable, P3 history | PASS fixtures ; P3 désactivé dans le banc |
| P4A R6-P45 30, R6 présentation, UI atomique 14, P4B imports 4 | PASS local |
| C8, dont C8-017 | PASS 35 contrôles ; aucun `@media` ajouté |
| R3 interactions | 21 contrôles PASS puis FAIL préexistant R3-008 `CONTEXT_REFERENCE_OWNER_UNAVAILABLE` |
| TypeScript final | PASS, exit 0 |
| Build Next 16.2.6 complet | PASS, exit 0 ; dépendances normales existantes, pas CI/installation fraîche |
| Auth, autre appareil, drag interpage | NOT_RUN / NOT_CERTIFIED |

Les régressions Draft vérifient sauvegarde différée sémantique, conflit CAS, perte de réponse sans second commit, récupération archive/restauration, offline et indépendance du statut Preview. La persistance n'est pas modifiée.

Le premier lancement du nouveau test était bloqué par `spawnSync git EPERM` dans la sandbox ; il a été exécuté ensuite dans le contexte local autorisé. Sa première assertion de comptage attendait deux lectures de Plan, alors que la relecture UI en produit une troisième. L'attente du test a été corrigée en **3 → 2**, sans retirer la relecture UI ni modifier un owner. Les dix contrôles finaux passent. Le build complet a été exécuté avec ces trois fichiers produit dans leur état final ; les ajouts suivants sont uniquement des sondes/scripts et preuves.

Heap exposé par Chromium après 20/50/100 actions : P4B **18,78 / 19,14 / 22,23 Mo**, P4D **18,02 / 18,66 / 22,28 Mo** (Mo décimaux). Cette valeur inclut sondes, JSON et GC non forcé ; elle n'isole pas Undo/Redo et ne prouve aucune fuite. Aucun plafond arbitraire ajouté.

Dans les scénarios navigateur A/B et les tests propres P4D : **0 Plan, 0 PlanRevision, 0 RPC Apply, 0 écriture distante**, canaries historiques inchangés. Les autres suites Apply/Reload utilisent seulement leur base PGlite dédiée. [Journaux et statuts](evidence/p14-p4d/regressions.json), [canaries](evidence/p14-p4d/zero-financial-writes.json).

## G. Passage ciblé aux snapshots — aucune implémentation

| Coût / source | Possibilité à établir dans P14-SNAP | Garde nécessaire |
| --- | --- | --- |
| Reconstruction World à chaque READ | Préparer les faits historiques indépendants du Draft | Scope utilisateur/foyer, périodes, timezone/asOf, générations et versions propriétaires |
| Canonical, habitudes, FOOD/Persona/Renewal, faits Mobility historiques | Réutiliser une préparation certifiée entre demandes | Corrections rétroactives et dépendances des writers à auditer dans SNAP |
| Publications Global/Forecast existantes | Admettre leur génération sans reconstruction redondante | Publication présente/valide, inputHash, contrat et date ; absence reste explicite |
| MonthInputs, PlannedExpenses, Wallet/admissibilité, réservations, Plan actif | Garder la lecture/validation fraîche selon les contrats | Versions, autorisation, disponibilité et Preserve ; pas de référence figée silencieusement |
| Sélections, identités, financement, quantité, contexte parent/enfants | Dépend du Draft courant ; ne pas partager une ancienne préparation | Digest sémantique et contrats versionnés |
| Mobility prospective et devis | Conserver les preuves par trajet admissible | Identité/mode/vehicle/date/préférence, qualité et fallback ; jamais fuelPaidAmount substitué |
| Compiler/Finance V2 et impacts marginaux | Réévaluer le Draft sur des faits préparés admissibles | Aucun deuxième moteur ni projection client approchée ; parité complète |
| Apply | Relecture autoritaire conservée | CAS/idempotence et refus des preuves périmées |

P4D supprime un World par SUGGESTIONS, **aucun World par READ simple**. La reconstruction entre demandes reste le prochain levier de gain matériel à étudier avec des mesures authentifiées. Ces résultats ne suffisent pas à affirmer qu'un snapshot précis atteindra 2 secondes ni qu'il est indispensable dans tous les cas. Le périmètre, les writers et les invalidations devront être établis dans SNAP ; aucun cache World complet ni matérialisation hypothétique n'est créé ici.

## H. Livraison et verdict

**`SAFE_LOCAL_OPTIMIZATION_REAL_GAIN_NOT_CERTIFIED`.** La suppression du travail redondant et la parité sont prouvées. La réduction synthétique des suggestions ne résout pas à elle seule les secondes d'un READ principal. Les résultats navigateur négatifs et l'absence de comparaison authentifiée restent visibles.

Produit : seulement `composer-service.ts`, `read-model.ts`, `balance-assistant.ts`. Instrumentation : scripts de fixture opt-in, sondes T0–T7 et analyseurs ; aucune sonde permanente dans les composants ou lecteurs produit. Reproduction : `node scripts/check-composer-p14-p4d-suggestions.mjs` avec `P14_P4D_SUGGESTIONS_REPORT`; `node scripts/measure-composer-p14-p4d-scenarios.mjs`; banc `PLANNER_P14_P4D_MEASURE=1`, `PLANNER_P14_P4A_MEASURE=1`, `PLANNER_P14_P4B_SPLIT=1`, `COMPOSER_P14_P3_HISTORICAL_REUSE=0`, origine loopback, `?variant=P4B|P4D&batch=10`. L'analyse accepte les deux JSON client. Le banc conserve P4B exact pour les trois fichiers serveur concernés ; l'UI est identique à P4B.

**Aucun push, PR, merge, migration, déploiement ou snapshot. STOP après P14-P4D. P4C et SNAP non commencés.**
