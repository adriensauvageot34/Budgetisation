# Global V2 — état durable d’exécution

## État courant

| Champ | Valeur |
|---|---|
| Prompt | P13 — PASS, infrastructure de publication Global certifiée localement |
| Branche | `main` |
| Baseline | `9e9d69e78456060fd58beaa9d7a24911676133ce` |
| Checkpoint | `SELF` — résoudre par `git log -1 --format=%H -- docs/global-v2/GLOBAL_EXECUTION_STATE.md` |
| GLOBAL_PHASE_A1 | PASS — freeze préexistant |
| GLOBAL_PHASE_A2 | PASS |
| GLOBAL_PHASE_A3 | PASS |
| B1 | ABSORBED_BY_A1 — non réexécuté |
| P02 implementation | PASS — resolver temporel et M1 économique |
| P02 contract | PASS — B2 fermé ; sorties temporelles P04 explicitement différées |
| P02 tests | PASS — 65/65, regressions ciblées, typecheck, architecture et build |
| P03 implementation | PASS — M2 core et GlobalMaterialityEngine |
| B3 Category/Needs core | PASS |
| B4 Global Materiality | PASS |
| GLOBAL_PHASE_B_CORE | PASS |
| P04 CONTRACT_GATE | PASS |
| P04 IMPLEMENTATION_GATE | PASS |
| P04 TEST_GATE | PASS — 317 assertions, typecheck, architecture, build, diff-check |
| P05 CONTRACT_GATE | PASS |
| P05 IMPLEMENTATION_GATE | PASS |
| P05 TEST_GATE | PASS — M4 ciblé, C1–C4 et Finance recertifiés |
| M1 final | PASS — outputs temporels raccordés et recertifiés avec les consommateurs M4/M3 |
| GLOBAL_PHASE_B | PASS |
| GLOBAL_PHASE_C | PASS |
| Live gate | NOT_RUN — migration P13 préparée, non appliquée |
| Live writes | NONE |
| Prochain prompt autorisé | P14 — non démarré |

## Références et digests

- Master : `Brief_Technique_Analyse_Globale_V2_FINAL_EXHAUSTIF_MASTER.docx`
- SHA-256 Master : `8b0d0ff2381599c4495645cd1dd1ebf2fa0d027fc3113be78aee945fae12f8be`
- Index : `GLOBAL_MASTER_INDEX.json`, format `global-master-index@v1`
- Cardinalités : 2 047 exigences, 364 capabilities, 2 302 tests conceptuels.
- Autorités GA0 : AG001–AG031 fermées et encodées `UNAVAILABLE`.
- Baseline History : HC1–HC6 et `POST_HISTORY_ENTRY_GATE=PASS`, sans rebuild History dans P01.

## Inventaire Global legacy

Les neuf ressources `legacy_v1` sont conservées sans réexécution de B1 :

1. `analysis_global_initial`
2. `analysis_global_baseline`
3. `analysis_global_typical`
4. `analysis_global_breakdown`
5. `analysis_global_evolution`
6. `analysis_global_contexts`
7. `analysis_global_habits`
8. `analysis_global_profiles`
9. `analysis_global_universe`

Elles restent des contrats de compatibilité, pas une autorité V2.

## Preuves P01

| Gate | Résultat |
|---|---|
| Fondations Global V2 | PASS — 107/107 |
| Canonical repository batching | PASS |
| History Canonical | PASS |
| History transversal | PASS — 48 checks |
| History dependency manifest | PASS |
| History Month Balance | PASS — 99/99 |
| Analysis Month / marked facts | PASS |
| Analysis Global legacy | PASS |
| Typecheck | PASS |
| Architecture | PASS — 475 fichiers |
| Next production build | PASS |
| `git diff --check` | PASS |

## Limites et handoff

- P01 ne crée aucun moteur M1–M10, resolver temporel exécutable, moteur de matérialité, sélection d’insights, ReadModel, Query, publication, migration ou composant React.
- `GlobalTemporalBoundaryResolver` est propriété P02.
- `GlobalMaterialityEngine` est propriété P03.
- `InsightSelectionEngine` est propriété P14.
- Les futurs consommateurs person-scoped devront versionner leur méthode/policy avant d’exposer l’enrichissement ECF ; les totaux Household restent inchangés.
- Un lien direct `Payment_component → Person` exige une autorité Canonical future ; en son absence le résultat reste UNKNOWN.

## P13 — infrastructure de publication Global

- P12/G est la baseline certifiée; les outputs A–G ne sont pas recalculés dans ce lot.
- Profil : `global-v2-household@v1`, une génération Household Global, `FULL_RESTAGE`, aucune référence intergénération.
- Manifeste : `global-v2-publication-manifest@v1`, compact et versionné, avec closures, versions, `resourceInputHash`, `publicationFactsHash`, `manifestHash` et identité d'implémentation.
- Persistance : réutilisation des trois tables Analytics; colonne nullable `global_manifest` préparée. `NULL = LEGACY_UNKNOWN`, aucun retrofit.
- Workflow : stage inactif, seal/attach, read-back, Finalize atomique, single-active, residual-key check, immutabilité, retry transport et rollback non invalidé.
- Runtime : snapshots compatibles uniquement, sans read-through; génération épinglée et réponses tardives rejetées.
- Publication/visibility et invalidation field-aware sont centralisées dans `src/analytics/global-v2` et ne sont pas recalculées par React.
- Migration `20260906120000_global_v2_publication_infrastructure.sql` : préparée et testée sur PostgreSQL synthétique, jamais appliquée live.
- Tests : P13 54/54; HC3 100; HC4 83; HC5 160; typecheck, architecture 535 fichiers, build et diff-check PASS.
- Rapport : `docs/global-v2/execution/P13-report.md`.
- Gates : H1 PASS; H2 infrastructure PASS; instances/payload schemas exacts P14/P15; live schema PENDING.
- Écritures live : NONE. Prochain prompt : P14.

## P02 — autorité temporelle et M1 économique

- `GlobalTemporalBoundaryResolver` est désormais exécutable : CH/LT disjoints, gaps préservés, fenêtres naturelles/lookbacks, support et hash déterministe.
- Actual/Typical/Minimal réutilisent les producteurs officiels ; la nouvelle voie `FactSourceResolver.resolveCanonical()` exclut les certificats Minimal compare-only sans casser `resolve()` legacy.
- TypicalReference utilise `< M`; TypicalState utilise `<= M`; 0–5 mois est non publiable, 6–11 SUFFICIENT, ≥12 STRONG.
- Bridge/residual délègue à la primitive History autoritaire ; structure, classification et équivalents mensuels sont exposés sans ReadModel History.
- Person Finance est bornée aux bénéficiaires/parts P01 prouvés, avec reste et coverage explicites.
- Trend, Stability et Recent Change restent `PENDING_P04`; aucune valeur de substitution n'est produite.
- Rapport : `docs/global-v2/execution/P02-report.md`.
- Écritures live : NONE. Publication/migration/Query/React : NONE.

## P03 — catégories, Needs et matérialité

- M2 réutilise Actual, category amount et Typical officiels; Category/Need se réconcilient à Actual avec UNKNOWN/CONFLICT conservés.
- Need ne vient que d'un `need_id` Canonical explicite ou du repli opération unicomposant; aucun label ne produit une classification.
- Necessity/Behavior/LifeScope proviennent des `EconomicComponentClassificationFact` et restent orthogonaux.
- Fréquence × ticket est conditionnelle à un vrai PurchaseEvent entièrement couvert; l'absence d'autorité produit `UNAVAILABLE`, jamais une heuristique.
- `GlobalMaterialityEngine` centralise `materiality_v1`, support, coverage, apparition/disparition et tie-breakers; il ne sélectionne aucune carte.
- P10/M8 reste un hook optionnel unidirectionnel. Aucune publication ou persistance Global n'est créée.
- Rapport : `docs/global-v2/execution/P03-report.md`.
- Gates : P03 49/49, M1 65/65, fondations 107/107, régressions ciblées, typecheck, architecture et build PASS.
- Écritures live : NONE. Prochain prompt : P04.

## P04 — reprise en attente d'autorité

- Baseline : `3f358ed55f9d2c8d7b5fd88f493532702139d808`, main propre au départ.
- Master inchangé (digest ci-dessus); sections et annexes temporelles consultées.
- C1 BLOCKED : StabilityPolicy et critère de plateau non précisés; propositions concrètes dans `execution/P04-report.md`.
- C2 PARTIAL : primitives descriptives Theil–Sen / recent 3+3 / médiane-MAD créées; pas de raccordement M1 ni confirmation de transformation.
- Aucun commit PASS, aucun push, aucune écriture live. P05 non autorisé.

## P04 — arbitrage humain accepté et reprise

- Les sept décisions humaines remplacent le blocage d'autorité précédent, sans réécrire son historique. Aucun nouvel arbitrage de stabilité n'est demandé.
- Descriptif et matérialité sont séparés : médiane/MAD/Theil–Sen restent disponibles; aucune classe de stabilité n'est déduite d'une dérive non matérielle.
- Diagnostics exécutables 6+6 / 6+4 et persistance 5/6 / 3/4 : les plateaux exactement constants ont une preuve factuelle; les autres restent non confirmés, même si l'amplitude est matérielle.
- Ces diagnostics ne sont pas encore des transformations sémantiques : chapitres/retour, fusion/ancrage, CURRENT_REGIME et raccordement M1 restent à implémenter et certifier. Ne pas assimiler leurs candidats à des sorties M3 finales.
- Rapport et commandes : `execution/P04-report.md`, section Reprise après arbitrage.
- IMPLEMENTATION_GATE = PARTIAL; TEST_GATE complet = PARTIAL; NEXT_PERMITTED_PROMPT = P04. Aucun checkpoint PASS ni autorisation P05.

## P04 — reprise suivante : lifecycle, fusion, M1

- `temporal-lifecycle.ts` : chapitres constants ≥3 mois, retour ≥3 mois consécutifs avec double matérialité, troisième régime distinct, CURRENT_REGIME médian max12/min6 avec qualification informative préalable. Aucun faux terme à la fin des données.
- `temporal-fusion.ts` : domaines séparés, proximité ET sémantique, relation Canonical pour délai >31 jours, catalogue explicite pour groupe sans ancre ≥3 signaux / ≥2 domaines. Groupes déterministes, sans chaîne transitive arbitraire.
- `economic-temporal.ts` est appelé par l'autorité serveur M1 existante. Méthode M1 v2 et déclaration de dépendance adaptées; aucune identité History/V1 modifiée. Finance P02/P03 rejouée.
- Tests : descriptif 17/17, temporel 76/76, M1 72/72, M2/matérialité 49/49; typecheck et architecture PASS.
- Nouveau point contractuel à arbitrer : choix de `primaryDriver` inter-domaines (GLO-M03-052–054, P2927–2937). Le code expose un représentant technique stable distinct d'un driver narratif UNKNOWN; il ne prétend pas produire un TransformationArtifact final conforme.
- CONTRACT_GATE = BLOCKED pour cette sélection; IMPLEMENTATION_GATE / TEST_GATE exhaustif = PARTIAL. Voir le dernier ajout au rapport P04 pour la décision exacte et les autres fermetures restantes.
- Aucun commit, push, live write ou démarrage P05.

## P04 — arbitrage primaryDriver appliqué

- Le fallback UNKNOWN a été retiré. Choix : désignation autoritaire, lien direct à l'ancre, début certifié le plus ancien, identité canonique pour départager. Provenance du choix et `causalEvidence=false` conservés.
- `transformations.ts` assemble les fenêtres/chaptres/fusion/régime courant; `temporal-projection.ts` qualifie les taux mensuels avec exposition explicite; `temporal-dependencies.ts` déclare l'amont requis et les enrichissements optionnels.
- La convention IQR descriptive est explicitement versionnée (interpolation linéaire type 7), sans seuil de classification; robustShift est diagnostique uniquement et reste UNKNOWN avec un dénominateur nul.
- Suites : temporel 122/122 + descriptif 17/17, M1 72/72, M2 49/49, typecheck/architecture PASS.
- L'arbitrage de dominance est fermé. P04 reste PARTIAL tant que les clauses résiduelles et la matrice exhaustive C1/C2 ne sont pas certifiées; aucun nouveau choix humain n'est demandé à ce stade. Détail dans le dernier ajout au rapport P04.
- Aucun checkpoint PASS. P05 reste interdit.

- Complément de reprise : dispersion brute/ordinaire désormais distincte avec preuves d'exclusion obligatoires; 131/131 tests temporels +17 descriptifs,72 M1,49 M2. La matrice GLO-M03 dans le rapport explicite les fermetures restantes (GRADUAL_TRANSITION positif, statuts internes et variantes du catalogue). PRIMARY_DRIVER_GATE=PASS; P04 intégral reste PARTIAL, sans nouvelle demande d'arbitrage.

## P04 — clôture finale C1/C2

- Les statuts partiels ci-dessus sont historiques. État courant : les trois gates P04 sont PASS.
- GRADUAL_TRANSITION possède un chemin positif conservateur (plateaux exacts 6+6, transition monotone observée); les cas bruyants sans preuve restent candidats, sans seuil inventé. CURRENT_REGIME démarre au nouveau plateau.
- Statuts internes REJECTED/CANDIDATE/CONFIRMED_ONGOING/CONFIRMED_CLOSED et comparaison RECLASSIFIED testés. Aucun artifact publié n'est muté.
- Catalogue 31 entrées et projections aux grains humains : tests d'absence d'autorité sur toutes les entrées et projections explicites; enrichissements futurs M4/M6/M7/M8 optionnels, avec replay par closure à leur intégration.
- Tests finaux : 179 temporels/assemblage +17 descriptifs +72 M1 +49 M2 =317 PASS. Typecheck, architecture491, build Next final et diff-check PASS.
- Rapport autoritaire du lot : dernière section « Clôture C1/C2 — état final après les deux arbitrages » de `execution/P04-report.md`.
- `NEXT_PERMITTED_PROMPT = P05`, sans le démarrer. Checkpoint local uniquement, aucun push, aucun live write.

## P05 — cadences, routines et fermeture temporelle

- Activity : fréquence par exposition `PersonDayFact`, cadence à partir de trois occurrences, gaps visibles et multijour compté une fois.
- Routines : DAY_ROUTINE, tokens sémantiques, CORE/OPTIONAL, prévalence, scope et preuve de participation. Un label Place, une visite ou une dépense commune ne crée aucun rôle/routine.
- Coûts : `CAUSAL_ROUTINE_COST` séparé de `ASSOCIATED_DAY_COST`; coût typique 4–6 indicatif, >=7 suffisant; équivalent mensuel dérivé et non additif.
- Cycles : quatre familles, exposition normalisée, 8 semaines ou 3 cycles selon le type, réplication >=75 %, matérialité et régime. Un lifecycle disparu/affaibli exige une preuve longitudinale explicite.
- M4 alimente M3 de manière unidirectionnelle; C1–C4, M1 et Finance ont été rejoués. `GLOBAL_PHASE_B=PASS`, `GLOBAL_PHASE_C=PASS`.
- Place routine reste M09 `AUTHORITY_GATED`/UNAVAILABLE tant qu'aucun rôle canonique daté n'est présent; le core M4 reste certifié sans heuristique.
- Rapport : `docs/global-v2/execution/P05-report.md`.
- Aucun push, aucune écriture live, aucune publication/Query/React. Prochain prompt : P06.

## P06 — préflight D1 : comparateurs à arbitrer

- Baseline P05 : `a83dc2debaba942878798b15bd976cf89e7545df`, main propre à l'entrée ; B/C acquis.
- Lecture ciblée complète M5 et recherches complémentaires dans les sections ultérieures et les tables du Master. Matching, support, tests, FDR et LOMO sont définis ; leurs paramètres ne font pas l'objet d'une demande d'arbitrage supplémentaire.
- D1 bloque sur la population de comparaison LEAVE/REST et WEEKEND, non désignée contrairement à ONSITE vs REMOTE. Le choix modifie le sens métier de l'effet et ne peut pas être une convention implicite. Décision précise et proposition non appliquée dans `execution/P06-report.md`.
- Aucune implémentation modifiée, aucun checkpoint PASS. `GLOBAL_PHASE_D_CORE=BLOCKED`; `NEXT_PERMITTED_PROMPT=P06`. Aucun push, aucune écriture live, aucun P07.

## P06 — arbitrage journalier appliqué ; D2/D3 en cours

- Le blocage précédent des comparateurs est levé. Policies LEAVE/REST et WEEKEND versionnées selon la décision humaine ; ONSITE/REMOTE inchangés.
- Matching outcome-blind 1:1 sans remplacement, primitives statistiques et pipeline journalier partiel enregistrés ; matérialité binaire ajoutée dans le moteur partagé P03.
- 84/84 tests P06 ciblés PASS ; régressions M2 49, M1 72, P04 179, P05 67 PASS. Typecheck et architecture499 PASS.
- Pas de certification M5 exhaustive : adapters officiels, catalogue restant, scope partagé/foyer, statistiques hebdomadaires/FDR commun, états temporels complets et recertification M3 restent P06. Détail dans la dernière section de `execution/P06-report.md`.
- `COMPARATOR_AUTHORITY_GATE=PASS`; les trois gates P06 restent `PARTIAL`. Aucun nouvel arbitrage demandé. Aucun checkpoint PASS, push ou live write ; `NEXT_PERMITTED_PROMPT=P06`.

- Reprise suivante P06 : hebdomadaire Spearman inférentiel, FDR commun avec plan complet obligatoire, adaptateurs PersonDay/ActivityOccurrence, helper des états temporels et déclaration partagée des dépendances ajoutés. 118/118 tests ciblés, typecheck et architecture503 PASS. Deux lectures live de métadonnées seulement, aucune écriture. Le raccordement Canonical/contextes, l'orchestration P02/scopes, les fenêtres 6+6/feed M3 et la certification exhaustive restent ouverts ; voir la dernière matrice du rapport P06. Toujours PARTIAL, pas de checkpoint ni de P07.

## P06 — clôture D1–D3 core

- Baseline inchangée : `a83dc2debaba942878798b15bd976cf89e7545df`, branche main. Les blocages et résultats intermédiaires ci-dessus sont conservés comme chronologie.
- Matrice finale : 118 exigences et 125 tests conceptuels dans `execution/P06-report.md`, sources réutilisées depuis l'index Master; capacités futures/absentes explicitement distinguées.
- Catalogue : 31 entrées examinées dans FDR; 10 DAY exécutables sous autorité, 2 WEEK, 19 exclusions. Aucun mining, aucune causalité ou participation inférée.
- CanonicalRepository → FactSourceResolver → P02 → M5 raccordé pour Restaurant personnel; contextes et finance quotidienne sans autorité restent fermés. Aucune preuve live positive inventée.
- Fenêtres indépendantement recalculées, LOMO, FDR commun, corpus hebdomadaire lié à la preuve, feed M3 sans cycle, RelationshipInsight et accès Analytics.
- Dernier état enregistré : M5 **266/266**, intégration **20/20**, M1 **72/72**, matérialité/M2 **49/49**, P04 **179/179 +17/17**, P05 **67/67**, fondations **108/108** PASS. Typecheck, architecture **508**, build Next production, diff-check et contrôle des 21 fichiers PASS.
- Régressions B/C rejouées dans cette clôture; la dernière correction des enveloppes M5 a été suivie des suites M5/serveur/typecheck/architecture/build.
- `IMPLEMENTATION_GATE=PASS`; `CONTRACT_GATE=PASS`; `TEST_GATE=PASS`; `GLOBAL_PHASE_D_CORE=PASS`, avec la portée core et les exclusions autorisées détaillées dans le rapport.
- `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`. Aucun push, publication, migration ou P07.
- `NEXT_PERMITTED_PROMPT=P07`. Le SHA du checkpoint est celui du commit local de clôture; il n'est pas injecté récursivement dans son propre contenu.

## P07 — Moments et expériences

- Baseline : `d29ba09176a7d0726c6e67a5f0b1f7f9bd380418`, branche main, état propre à l'entrée.
- E1 borné : identité/type/dates/série depuis `moments`; membership via `moment_life_events`; participants uniquement explicites; causalité via les Facts et doctrines HC2. Les facettes Place non prouvées restent `AUTHORITY_GATED`.
- E2 : catalogue exact de 20 types et 7 familles, comparaisons SAME_SERIES/SAME_TYPE/SAME_FAMILY, facettes et support 0–2/3–4/5–7/8+, coûts causal/pendant, rôles et paiements séparés, statistiques robustes, matérialité par famille, importance non monétaire et séries.
- Chaîne read-only `CanonicalRepository → producteurs EconomicComponentFact → GlobalTemporalBoundaryResolver → M6`; closure, source hash et execution hash sensibles aux intrants déclarés.
- 133 exigences, 13 capacités et 134 tests Master attribués à P07 sont indexés dans `execution/P07-report.md`.
- Signaux nouveaux M6 vers M3/M5 déclarés; replay et recertification C/D réservés à P08 et non exécutés.
- Validations : M6 75/75, autorité 17/17, régressions HC2/P03/P06, typecheck, architecture, build Next et diff-check PASS.
- Aucun push, accès/écriture live, publication, migration, Query, ReadModel ou React.
- `IMPLEMENTATION_GATE=PASS`; `CONTRACT_GATE=PASS`; `TEST_GATE=PASS`; `GLOBAL_PHASE_E2=PASS`.
- `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P08`.

## P08 — lieux et mobilité prouvable

- Baseline : `6f8be504ba78279bd0ede91e777823806aed4dad`, branche main, état propre à l’entrée.
- M7 core consomme `PlaceVisitFact`, `PersonDayFact`, `EconomicComponentFact`, `PurchaseEventFact` et la hiérarchie Place via un adaptateur Canonical read-only.
- Visites, séjours, transitions OD, rôles Place et finance localisée restent des objets séparés. Seules les autorités directes/établissement prouvé/lieu causal déclaré/attribution Canonical sont admissibles.
- `localizedAmountCoverage` et `localizedEventCoverage` sont distinctes ; seuils de ranking 60 %/85 %, allocations source-bound et roll-ups sans double compte.
- Les rôles datés, MobilityLeg, RouteDefinition, distances, consommation/prix carburant et shared trips restent explicitement `AUTHORITY_GATED`; aucune heuristique n’est introduite.
- Replay C/D : 15 définitions P08 relues, aucune nouvelle éligible ; univers FDR et q-values inchangés, absence de cycle prouvée.
- Validations : M7 58/58, autorité 22/22, M6 75/75 +17/17, M5 266/266 +20/20, M4 67/67, M3 179/179 +17/17, matérialité 49/49, HC2 Month Balance 99/99, typecheck, architecture 516, build Next et diff-check PASS.
- Rapport : `docs/global-v2/execution/P08-report.md`. Aucun push, live write, publication, migration, Query, ReadModel ou React.
- `IMPLEMENTATION_GATE=PASS`; `CONTRACT_GATE=PASS`; `TEST_GATE=PASS`; `GLOBAL_PHASE_E3_E4=PASS`.
- `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P09`.

## P09 — achats humains et marchands

- Baseline : `4551c103c98432181982c351bb3ab256e3cf4b43`, branche main, état propre à l’entrée ; P08 acquis.
- F1 distingue schéma Purchase présent, Fact/repository raccordés et données live historiquement certifiées vides. Aucune opération n’est convertie universellement en achat ; `purchaseAt` et l’univers purchase-eligible restent gated.
- F2 : moteur `global_purchase_merchant@v1`, outcomes/adjustments, checkout/retained, fréquence, tickets, Merchant, channel/intermédiaires distincts, évolution P04, coverages et drill-down. Les euros restent ceux des `EconomicComponentFact`.
- Chaîne read-only `CanonicalRepository → PurchaseEventFact/EconomicComponentFact → GlobalTemporalBoundaryResolver → M8`; contributions unidirectionnelles vers M2/M5.
- Product/price/cadence/substitution/inflation restent explicitement `DEFERRED_P10`; aucun Swile/Edenred, backfill, migration, publication, Query ou React.
- Tests : M8 66/66, autorité 29/29, History Canonical, M2 49/49, P04 179/179, typecheck, architecture 519, build Next et diff-check PASS.
- Rapport : `docs/global-v2/execution/P09-report.md`. `IMPLEMENTATION_GATE=PASS`, `CONTRACT_GATE=PASS`, `TEST_GATE=PASS`, `GLOBAL_PHASE_F1_F2_CORE=PASS`.
- `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P10`.

## P10A — freeze Produits et convergence B/C/D

- Baseline : `3c09ea111f84d87a6bb95a82f49885cf3488d522`, main propre ; P09 acquis. Master SHA vérifié identique au registre.
- Freeze : `execution/P10-ASTRA-FREEZE.md`. Lecture ciblée M8, Scope V1 final, AG et consommateurs réels. Aucun code produit modifié, aucune lecture/écriture live.
- Merchant substitution est DATA_GATED_IMPLEMENTABLE ; ses tests positifs et d'absence sont exigibles P10B. Produit/unité/acquisition/cadence/lifecycle/indice restent AUTHORITY_GATED_UNAVAILABLE ; leur fermeture explicite est exigible, leur activation exige T01.
- Plan P10B : enrichissement M8 vers M2, séries autorisées vers C, examen de la définition M5 visite/achat localisé et replay FDR commun/no-op prouvé. Les déclarations downstream M2/M5 de M8 doivent être distinguées des inputs pour éviter un faux cycle.
- Questions humaines restantes dans ce périmètre : 0. Les suites d'implémentation P10B ne sont pas déclarées exécutées par ce freeze.
- `P10A_FREEZE_GATE=PASS`; `IMPLEMENTATION_GATE=NOT_RUN_P10B`; `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P10B`.

## P10B — produits fermés et convergence B/C/D

- Baseline : `32213755dc3473683edaf96a9243fc0a16a26922`, branche main, état propre à l'entrée ; freeze P10A appliqué sans réaudit.
- Gates produit AG002–004/012–022 fermés avec raisons typées. Les données brutes n'ouvrent aucune identité, unité, acquisition, cadence, lifecycle, substitution produit ou inflation ; activation positive sous T01 uniquement.
- Merchant Substitution conditionnel implémenté sur catalogue versionné et PurchaseEvents couverts : axes dépense/fréquence séparés, fenêtres P04 6+6/6+4, supports et seuils exacts, résultat associatif `SPEND_SHIFT`/`FREQUENCY_SHIFT`/`BOTH`.
- M8 → M2 réellement raccordé via l'adaptateur serveur et la décomposition P03; séries M8 autorisées → C. M1 reste invariant à autorité économique identique.
- Définition M5 P10 examinée parmi les 31 : autorité achat localisé absente, exclusion sans p-value, univers FDR et q-values inchangés. Aucun cycle M2↔M8, M5↔M8 ou M3→M5→M3.
- Validations ciblées : P10 56, P09 66+29, M2 49, M1 72, P04 179+17, M5 266+20 PASS; typecheck, architecture, build et diff-check documentés dans `execution/P10-report.md`.
- `IMPLEMENTATION_GATE=PASS`; `CONTRACT_GATE=PASS`; `TEST_GATE=PASS`; `GLOBAL_PHASE_F3_F4=PASS`.
- `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; aucune migration, publication ou push.
- `NEXT_PERMITTED_PROMPT=P11`.

## P11 — profils personnels comparables

- Baseline : `02f0c8197eac8bf602e5bc6abc7c0c9aa8b55422`, branche main, état propre à l'entrée; P10 acquis.
- G1 réutilise l'attribution P01 et les producteurs B–F : payer seul, finance Household commune et montants non attribuables ne deviennent jamais personnels.
- G2/M9 sépare PersonaMetric sur support propre et PersonaDifference sur intersection exacte. Brut/habituel/exceptionnel, cinq états temporels, coverage 85/60 %, matérialité P03, ranking/diversité/hystérésis sont versionnés.
- Catalogue : 10 familles; index Master P11 = 107 exigences, 17 capabilities, 127 tests conceptuels. Les observations contradictoires au même grain échouent fermées.
- ObservedPersonalTypicalCost : médiane max12, support >=6, finance 100 % et attribution >=85 % pour headline. PersonalReferenceCost reste `AUTHORITY_GATED` sous AG022; l'assembleur contractuel ne permet ni overlap ni supplément inventé.
- Validations ciblées : M9 85/85, P01 108/108, M1 72/72, M2 49/49, P04 179/179, P05 67/67, P06 266/266, P07 75/75, P08 58/58, P09 66/66, P10 56/56 PASS. Typecheck, architecture (524 fichiers) et diff-check PASS.
- Aucun Query, ReadModel, React, snapshot, publication, migration, push ou live write.
- `IMPLEMENTATION_GATE=PASS`; `CONTRACT_GATE=PASS`; `TEST_GATE=PASS`; `GLOBAL_PHASE_G1_G2=PASS`.
- `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P12`.

## P12 — participation partagée et Nous deux

- Baseline : `c0d5e708dfc4517687862bcf73ffab2b87b77698`, branche main, état propre à l'entrée; P11 acquis.
- G3/M10 : `SharedParticipationResolver` versionné, quatre états par personne, six résolutions partagées et cinq niveaux de preuve. Aucune liste positive non exhaustive ne prouve une absence.
- Co-présence : STOP/STAY, temps précis, résolution Place admissible et recouvrement normatif; catalogues exacts 14 `COPRESENCE_ALLOWED` et 12 `EXPLICIT_ONLY`.
- Moments multijours, SharedPlaceVisit, support/rate aux bons dénominateurs, exclusivité et participants externes sont séparés. Participation, coûts et attribution financière restent indépendants; aucun faux Couple ou partage 50/50.
- G4/Social : analytics d'occurrence disponible; Contact/Alias/Relation/Group restent `AUTHORITY_GATED`. Participants et contacts ont des coverages distinctes; social graph, score relationnel et cost-per-contact sont interdits.
- Chaîne Facts → M10 et closure explicites. M3/M4/M5/M9 n'ont aucun edge entrant depuis M10 et leurs régressions sont rejouées; Persona n'est jamais une source de participation.
- Validations : M10 54/54, M9 85/85, M5 266/266, M4 67/67, P04 179/179 +17/17, M6 75/75, M7 58/58, typecheck, architecture, build Next et diff-check PASS.
- Rapport : `execution/P12-report.md`. Aucun push, live write, publication, migration, Query, ReadModel ou React.
- `IMPLEMENTATION_GATE=PASS`; `CONTRACT_GATE=PASS`; `TEST_GATE=PASS`; `GLOBAL_PHASE_G3_G4=PASS`; `GLOBAL_PHASE_G=PASS`; `SOCIAL_GATE=PASS_WITH_AUTHORITY_GATED_CAPABILITIES`.
- `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P13`.

## P14 — ReadModels principaux et sélection

- Baseline : `a2591c991855b2a7e6ee545826318a90467f9ccb`, branche main, état propre à l'entrée ; P13 acquis.
- H3 : dix ressources COMPACT principales, ressource initiale/manifest légère, parsers stricts, RuntimeSchemas, builders de projection et budgets mesurés.
- `GlobalPublicationEngine` ferme l'ordre complet des hard gates ; `InsightSelectionEngine` intervient ensuite pour ranking 30/20/15/15/10/10, diversité, anti-redondance et limites de surface.
- Les KPI restent rattachés au phénomène principal ; un module peut rester visible sans insight narratif. Scores éditoriaux et grands payloads de détail ne sont pas publiés.
- Cohérence page : champs publication-scoped communs obligatoires ; policies, contrats, signatures et input hashes restent resource-specific.
- Tests : P14 83/83, 10/10 schémas principaux + initiale et transport distinct, P13 52/52, typecheck, architecture et build Next PASS ; payload COMPACT max 1 671 octets ; diff-check PASS.
- Aucun React, snapshot, publication, migration, push ou live write. Détails, résumé IA et instances finales restent P15.
- `IMPLEMENTATION_GATE=PASS`; `CONTRACT_GATE=PASS`; `TEST_GATE=PASS`; `GLOBAL_PHASE_H3=PASS`.
- `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P15`.

## P15 — détails Query et fermeture des instances

- Baseline : `71b21f555a2cbd3d090616424b0bb110541a5b12`, branche main, état propre à l'entrée ; P14 acquis.
- H4 : 34 contrats Query V2 ciblés, dont 12 ressources de tête, 10 sections EXPANDED, 9 détails analytiques disponibles, 2 détails authority-gated Product/Route et 1 méthodologie ciblée.
- Le plan synthétique exhaustif instancie 32 ressources disponibles, ferme 32/32 RuntimeSchemas, required keys, versions, closures, navigation interne et external refs History/Operations/Entity.
- Runtime snapshot-only strict : scope/params/génération épinglés, cache par paramètres, erreurs locales, une lecture snapshot et zéro producteur/read-through dans le test.
- Manifest P13 effectivement assemblé avec resourceInputHash, signatures, policies et closures ; génération commune imposée, suppression de clé et contrôle de résidu testés.
- Mesures : 42 716 octets pour 32 payloads, zéro payload strictement dupliqué, listes et séries bornées ; aucun God RPC ou micro-query par ligne.
- Validations : P15 52/52, P14 83/83, P13 52/52, typecheck, architecture, build Next et diff-check consignés dans `execution/P15-report.md`.
- Aucun React, push, live write, publication ou migration. `PENDING_LIVE_SCHEMA` reste inchangé.
- `GLOBAL_PHASE_H2_EXACT_RESOURCE_INSTANCES=PASS`; `GLOBAL_PHASE_H4=PASS`; `IMPLEMENTATION_GATE=PASS`; `CONTRACT_GATE=PASS`; `TEST_GATE=PASS`.
- `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P16`.

## P16 — frontend Analyse Globale

- Baseline : `f4653000ce16c15a945b5de37ca46c27680f4985`, branche main, état propre à l’entrée ; P15 acquis.
- Nouveau chemin parallèle `/analyse-globale` : Synthèse puis M1–M10, COMPACT/EXPANDED, sections et détails ciblés, navigation sticky, deep links, desktop/mobile, qualité, erreurs locales, focus et reduced motion.
- Runtime de visite snapshot-only : génération épinglée, cache publication/ressource/paramètres, deux lectures de fond, priorité directe et rejet des réponses tardives. Aucun import Analytics dans React.
- Cutover Production différé : l’ancienne route et ses neuf ressources restent intactes ; le build Production affiche un état sûr jusqu’à P17.
- Validations : P16 257/257, fixtures RuntimeSchemas 71/71, matrice Master 150 exigences/29 capabilities/168 tests, typecheck, architecture 554 et build Next PASS.
- Browser local : `PENDING_ENVIRONMENT`, middleware bloqué par les variables Supabase absentes ; aucun bypass ou changement d’environnement. Live smoke réservé à P17/P19.
- Aucun push, live write, publication ou migration. `GLOBAL_PHASE_H5_LOCAL=PASS`; `IMPLEMENTATION_GATE=PASS`; `CONTRACT_GATE=PASS`; `TEST_GATE=PASS`.
- `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P17`.

## P17A — audit de preuve / freeze de certification (2026-09-07)

- Baseline : `13d2f01291b544250191ac2a9b6a88223788cb14`, main, worktree propre à l'entrée. Aucun code modifié.
- Dossier : `execution/P17-ASTRA-CERTIFICATION-FREEZE.md`. Inventaire confirmé : 2 047 exigences, 364 capacités, 2 302 tests conceptuels ; digest Master inchangé. Les deux namespaces Capability n'ont pas de jointure directe et la correspondance individuelle vers les assertions n'est pas complètement prouvée.
- Les PASS historiques restent consignés, mais leurs limites sont désormais explicites : fixtures/compteurs P16 ne démontrent pas H5 complet ; frontières manifest/Query et SQL/payload incompatibles identifiées ; no-op FDR à démontrer depuis les vrais inputs. Aucun ancien PASS n'est transformé rétroactivement en preuve GC1.
- Probes synthétiques courts uniquement : enum/type de dependency acceptés à tort ; digest de dépendance modifié sans changement imposé de publicationFactsHash ; Query READY avec signature/policies non attendues par le registre. Aucun correctif produit effectué dans ce lot stratégique.
- Plan candidats, RuntimeSchemas, mutations, closure/FDR, réutilisation, performance, suites et P18/P19 documenté. Matrice individuelle et fermeture des preuves d'entrée/réutilisation restent ouvertes : `P17A_FREEZE_GATE=PARTIAL`, pas PASS par comptage.
- Le séquencement opérationnel est corrigé : P17A/P17B read-only et synthétique seulement ; schéma live P18 et publication/cutover P19 nécessitent leurs autorisations humaines distinctes. Les formulations antérieures attribuant le live à P17 sont superseded.
- `IMPLEMENTATION_GATE=NOT_RUN_P17B`; `CONTRACT_GATE=PARTIAL_TRACEABILITY_AND_ENTRY_PROOF`; `TEST_GATE=NOT_RUN_P17B`; `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; aucune migration/publication/cutover/push.
- `NEXT_PERMITTED_PROMPT=P17A_CLOSURE_ONLY`. Aucun checkpoint produit ou passage automatique à P17B. La stratégie ne requiert actuellement aucun nouvel arbitrage métier.

### P17A_CLOSURE_ONLY — reprise documentaire

- Seuls le freeze et cet état sont modifiés. §15 du freeze établit les namespaces séparés REQ/SEM_CAP/CAT_CAP/TEST, les arêtes déclarées A/D, les futurs caseId et les slots d'assertion ; 2 302/2 302 lignes de tests sont retrouvées à leur table/row source, aucune Requirement sans test référencé.
- Les 364 fiches B inspectées ne portent pas de Requirement ID explicite ; la table d'invariants 452 utilise le namespace sémantique, pas le catalogue B. Les 364 gaps CAT_CAP sont listés individuellement avec owner/table dans le freeze. Aucune jointure lexicale ou par ordre n'est fabriquée. Le binding des renvois génériques d'assertions n'est pas déclaré complet.
- Classification des preuves fermée conservativement : anciennes exécutions REPLAY_REQUIRED ou INSUFFICIENT_FOR_GC1 selon le tableau, live réservé ; protocole exact de fermeture/digest avant toute réutilisation. Aucun PASS historique effacé.
- Entrée P16 qualifiée : checkpoint historique valide mais INSUFFICIENT_FOR_GC1 ; R13–R15 sont des corrections P17B sous owner P16, sans exiger un re-PASS P16 préalable. R02–R15 possèdent owner, futur test rouge, correction et closure explicités. Ces défauts techniques ne bloquent pas à eux seuls le handoff.
- `P17A_FREEZE_GATE=PARTIAL`; `CONTRACT_GATE=PARTIAL_TRACEABILITY_ONLY`. Seule la traçabilité non démontrée empêche encore de déclarer le freeze PASS. Questions humaines métier identifiées : 0.
- Aucun test produit, GC1, build, live, migration, publication, cutover, commit ou push. `IMPLEMENTATION_GATE=NOT_RUN_P17B`; `TEST_GATE=NOT_RUN_P17B`; `LIVE_GATE=NOT_RUN`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P17A_CLOSURE_ONLY`.

## P17B — exécution partielle GC1 (2026-09-07)

- R02–R10 corrigés et prouvés de façon ciblée : parser/dependency hashes, publicationFactsHash, signatures/policies Query, request binding, metadata/version SQL, manifest et invalidation transitive.
- PGlite exécute la migration locale et valide guards/grants/handshake (`SQL=PASS`) sans connexion réelle. Les owners P01–P16 ont été rejoués et sont verts.
- Le navigateur local a révélé puis fermé un crash Server→Client, la borne codée en dur et Escape/focus de l'overlay ; build et architecture passent.
- GC1 reste `PARTIAL` : ledger individuel, candidat analytique intégré, no-op FDR dérivé, cycle SQL complet avec vrais payloads et smoke mobile/réseau/détails restent ouverts. Aucun checkpoint.
- Rapport : `execution/P17-report.md`. `LIVE_WRITES=NONE`; `LIVE_PUBLICATION=NOT_STARTED`; `NEXT_PERMITTED_PROMPT=P17B`.

### P17B — clôture GC1 prépublication (2026-09-07)

- Le handoff P17A est mécaniquement fermé par `execution/P17-evidence-ledger.json` : 2 047 Requirements, 2 302 tests conceptuels, 364 CAT_CAP, 2 350 arêtes Requirement→Test explicites et zéro crosswalk inventé. Digest : `e60340c0747371c011f16f1f44a5c5df5875d3474a82d632e7ab1c539a37ab96`.
- Un candidat intégré unique traverse dix outputs Analytics qualifiés, P14/P15, 32 instances Query, 1 artifact, 33 closures et le manifest. Certification C-A→C-E : 28/28 PASS ; R11 FDR et R12 source commune PASS.
- C-F : cycle PGlite complet sur les vrais payloads P14/P15, avec stage/retry/seal/finalize/immutabilité/génération suivante/résidu/rollback/isolation : 69/69 PASS, SQL PASS. Aucune connexion Supabase réelle.
- C-G : détails Entity distincts, mobile mono-expanded, snapshot-only, génération épinglée/refresh, réponse tardive rejetée, overlay/focus/état de visite : 286/286 PASS ; fixtures 71/71. Le smoke Production reste P19.
- Query : 57/57, 32/32 RuntimeSchemas, 42 716 octets, zéro duplication, 1 lecture snapshot et 0 producteur. Typecheck, architecture 555, build Next et diff-check PASS.
- Rapport final : `execution/P17-report.md`. `P17A_HANDOFF_CLOSURE=PASS`; `IMPLEMENTATION_GATE=PASS`; `CONTRACT_GATE=PASS`; `TEST_GATE=PASS`; `GLOBAL_PREPUBLICATION_GATE=PASS`; `FRONTEND_LOCAL_GATE=PASS`.
- `PENDING_LIVE_SCHEMA=YES`; `PENDING_PRODUCTION_SMOKE=YES`; `LIVE_PUBLICATION=NOT_STARTED`; `LIVE_WRITES=NONE`; `NEXT_PERMITTED_PROMPT=P18`; autorisation humaine distincte requise.
