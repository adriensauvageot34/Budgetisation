# Global V2 — état durable d’exécution

## État courant

| Champ | Valeur |
|---|---|
| Prompt | P05 — PASS, M4 et C3/C4 certifiés |
| Branche | `main` |
| Baseline | `3f358ed55f9d2c8d7b5fd88f493532702139d808` |
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
| Live gate | NOT_RUN — non requis, aucune écriture autorisée dans P05 |
| Live writes | NONE |
| Prochain prompt autorisé | P06 — non démarré |

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
