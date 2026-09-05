# Global V2 — état durable d’exécution

## État courant

| Champ | Valeur |
|---|---|
| Prompt | P02 — Autorité temporelle et fonctionnement économique |
| Branche | `main` |
| Baseline | `f27aa4780f73da64b36463d996ab57d37bcfa2f9` |
| Checkpoint | `SELF` — résoudre par `git log -1 --format=%H -- docs/global-v2/GLOBAL_EXECUTION_STATE.md` |
| GLOBAL_PHASE_A1 | PASS — freeze préexistant |
| GLOBAL_PHASE_A2 | PASS |
| GLOBAL_PHASE_A3 | PASS |
| B1 | ABSORBED_BY_A1 — non réexécuté |
| P02 implementation | PASS — resolver temporel et M1 économique |
| P02 contract | PASS — B2 fermé ; sorties temporelles P04 explicitement différées |
| P02 tests | PASS — 65/65, regressions ciblées, typecheck, architecture et build |
| Live gate | NOT_RUN — non requis et interdit pour P02 |
| Live writes | NONE |
| Prochain prompt autorisé | P03 uniquement |

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
