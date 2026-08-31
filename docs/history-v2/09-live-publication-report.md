# History V2 — publication live et rollback

## 1. Autorités, périmètre et gate d'entrée

Autorités appliquées :

1. `Brief_Technique_Historique_Mensuel_V2_FINAL_CIBLE` ;
2. `Plan_Publication_Rollback_History_V2` ;
3. `docs/history-v2/08-certification-12-months-report.md` comme preuve de
   certification, sans modification de l'oracle.

Gate d'entrée vérifié :

```text
HISTORY_V2_CERTIFICATION_GATE = PASS
```

Périmètre publié : `2025-08` à `2026-07`, uniquement pour le Household déjà
certifié du projet Supabase `ipuuhxrblxormwgoaqnz`.

État d'implémentation publié :

```text
implementationSha=e38503d0b2624786de28f7a7c31e618f95d8ed18
manifestDigest=8b68239c12a561465f9531617847d48386a37968483c377f7ffe43f4a9ed9b43
```

La recertification immédiatement antérieure à la publication a produit :

| Contrôle | Résultat |
|---|---:|
| Mois | 12/12 |
| Familles Query | 15/15 |
| Artifacts | 24/24 |
| Instances Query | 907 |
| RuntimeSchemas | 907/907 |
| Invariants mensuels | 324/324 |
| `FAIL` | 0 |

Les douze mois sont classés `DATA_MISSING`, état publiable prévu par les
contrats Quality/Visibility. Aucun état `FAIL` n'a été publié.

## 2. Préparation et transport du bundle certifié

Les douze publications ont été créées en DRAFT et intégralement staged avant le
premier Finalize. Le bundle staged est exactement celui produit par le commit et
le digest ci-dessus.

Le payload complet dépassant la taille pratique du canal SQL interactif, le
transport a utilisé un endpoint Preview Vercel temporaire :

- credentials Supabase exclusivement server-side ;
- jeton aléatoire éphémère, jamais commité ;
- hash du jeton uniquement dans le code temporaire ;
- Preview uniquement, jamais Production ;
- code et bundle confinés à une branche temporaire ;
- aucune route de publication ajoutée à `main`.

Après publication :

- deployment Preview `dpl_HECSVnPJ11LGJFQQ1cj3su1oEHz3` supprimé ;
- vérification Vercel : deployment introuvable après suppression ;
- branche distante et locale `codex/history-v2-live-stage-e38503d` supprimée ;
- jeton brut et bundles temporaires locaux supprimés.

Le Production Vercel n'a pas été modifié. Il reste sur
`a97172ae851838fcef61505c703d8c27bbb0f80e` (`Remove temporary historical
backfill access`). Aucun cutover frontend History V2 n'a été effectué.

## 3. Barrière de complétude avant Finalize

La barrière globale a été exécutée après le stage des douze mois et avant le
premier Finalize.

| Exigence | Preuve | Statut |
|---|---|---|
| 12 DRAFTs complètement staged | 12/12 | PASS |
| Deux artifacts requis par mois | 24/24 | PASS |
| Toutes les Query keys requises | 907/907 | PASS |
| Familles Query distinctes | 15/15 | PASS |
| RuntimeSchemas | validés sur les 907 payloads exacts | PASS |
| `contractVersion` | `v2` partout | PASS |
| `PublicationMeta` | présent partout | PASS |
| `factsHash` commun par publication | 0 mismatch | PASS |
| `policyVersions` par ressource | présents et identiques au payload | PASS |
| `publicationId` | 0 mismatch | PASS |
| Read-through V2 | 0 artifact, 0 snapshot | PASS |
| Lignes V2 actives avant Finalize | 0 | PASS |

Les policies sont volontairement propres à chaque ressource. La publication
contient sept ensembles de policies et treize signatures de méthode distinctes ;
ce n'est pas une divergence. Forcer un ensemble global unique aurait contredit
le contrat validé au lot 07.

## 4. Publications Finalize

Les Finalize ont été exécutés atomiquement, dans l'ordre chronologique, avec la
révision Analytics attendue de chaque DRAFT.

| Mois | Publication ID | Révision base → publiée | Artifacts | Queries | `factsHash` |
|---|---|---:|---:|---:|---|
| 2025-08 | `20bf6dc2-7812-403f-9c05-b69e49499133` | 17 → 18 | 2 | 75 | `5d81abcfe30606b16beee0d657e23b378acd59c2851c6a286955a181f826df2b` |
| 2025-09 | `15f07b61-447a-429e-8033-adfd6b7799d8` | 18 → 19 | 2 | 72 | `5cef8da88ee3708e8d0ce304696787be7e2b6fb31b5e9066c8048d7ad0bf2ffb` |
| 2025-10 | `1b3cd802-2156-4fba-987d-036e44caf368` | 19 → 20 | 2 | 77 | `8f9cddcd0c09bd56d3628bc63b814e80d18f32ba5e613dba26c6a589c9e7f18c` |
| 2025-11 | `8b442cfb-754e-434b-abed-6620e41f78b4` | 20 → 21 | 2 | 77 | `c4eedfab49072dffcee57b56c096bef5009d03f2c45a2d059a581ca6a5e3a994` |
| 2025-12 | `9783a6a8-f7b8-46a8-92a7-3f362a9ecb88` | 21 → 22 | 2 | 75 | `4eab1de9c96578ba62ae1776e931cc95f172e49a5015305f027a341009fc5d2e` |
| 2026-01 | `759d0e59-7474-4b5d-b6eb-056b577ba70c` | 22 → 23 | 2 | 79 | `96a67e80af4a2e400b2f253f377e366177168ad6511ac13a042327a0fa3e41ee` |
| 2026-02 | `0b92e570-5c77-4990-a7ba-76bec410ec5e` | 23 → 24 | 2 | 72 | `6a329eb39c199d859600400947ae0045bd2dee2b5f3060cc56e9515a08fe5675` |
| 2026-03 | `93f955ed-777b-4a99-a493-026305af1510` | 24 → 25 | 2 | 76 | `17805ab242f391ebd63b0f93613989ddf60d55ce0e5dc584e9f6a956be83e41e` |
| 2026-04 | `fabfd7ed-46c4-4d4a-9b08-98509e76567f` | 25 → 26 | 2 | 77 | `7ff3096b4ac62b775853187cbf711b08ce6bac497c572454c96d45a9d21c3339` |
| 2026-05 | `8af8a91a-d446-4542-8007-07c020515e79` | 26 → 27 | 2 | 76 | `d8efe526609c200a0a04e78fca751c8dd34b395d9895548ae956c1948920c208` |
| 2026-06 | `e079dc22-d1a7-4d5e-bdf2-1b3efc3b67e2` | 27 → 28 | 2 | 76 | `3d9fe512e8b71b6fbd743fa5d2654f76de719c8ceb5e65d8293489d141a80d8e` |
| 2026-07 | `d8f72023-6441-48d1-b447-df6f62dcf77b` | 28 → 29 | 2 | 75 | `feb8aae3a1f688703d99b2804c1f45d027720d56b5fcbf8e16ce5e0d26d6168c` |

Le statut séparément relu après chaque transaction est `published`. Les douze
mois ont leurs ensembles requis complets et actifs. Aucune génération partielle
n'est active.

## 5. Artifacts et ressources live

### Artifacts partagés

| Famille | Instances actives | Mois |
|---|---:|---:|
| `calendar_semantic_month` | 12 | 12 |
| `daily_economic_ledger_month` | 12 | 12 |

### Query resources

| Ressource | Instances actives | Mois |
|---|---:|---:|
| `history_activity_detail` | 72 | 12 |
| `history_bank_economy_bridge` | 12 | 12 |
| `history_category_detail` | 96 | 12 |
| `history_day_journal` | 365 | 12 |
| `history_minimal_preview` | 12 | 12 |
| `history_moment_detail` | 43 | 12 |
| `history_month_balance_summary` | 12 | 12 |
| `history_month_calendar` | 12 | 12 |
| `history_month_categories` | 12 | 12 |
| `history_month_life_money` | 12 | 12 |
| `history_month_overview` | 12 | 12 |
| `history_month_spending_nature` | 12 | 12 |
| `history_place_detail` | 39 | 12 |
| `history_spending_segment_detail` | 144 | 12 |
| `history_week` | 52 | 12 |
| **Total** | **907** | **12** |

`DayHoverReadModel` et `EconomicExpenseSummary` restent imbriqués dans
`history_month_calendar`, conformément au contrat : aucune seizième ressource et
aucun God RPC n'ont été créés.

## 6. Audit live après publication

État final, après le test de rollback et sa restauration :

| Contrôle live | Résultat |
|---|---:|
| `data_revision` | 1 |
| `analytics_revision` | 31 |
| Publications V2 actives | 12 |
| Artifacts V2 actifs | 24 |
| Query snapshots V2 actifs | 907 |
| Artifacts V2 read-through | 0 |
| Query V2 read-through | 0 |
| Artifacts V2 actifs sans publication | 0 |
| Query V2 actives sans publication | 0 |
| `PublicationMeta` manquant | 0 |
| `policyVersions` manquant | 0 |
| `factsHash` manquant ou discordant | 0 |
| `publicationId` discordant | 0 |
| `contractVersion` discordant | 0 |

Les 907 instances portent `contractVersion=v2`. Aucun snapshot V1 incompatible
n'est servi comme V2.

## 7. Coexistence et non-régression V1

Le Finalize V2 et le rollback réel n'ont pas désactivé les matérialisations V1.

| Preuve V1 active | Avant | Après | Statut |
|---|---:|---:|---|
| Artifacts | 4865 | 4865 | PASS |
| Query snapshots | 1538 | 1538 | PASS |
| Query snapshots Analysis | 1149 | 1149 | PASS |
| Août 2025 — artifacts | 414 | 414 | PASS |
| Août 2025 — queries | 127 | 127 | PASS |

Smoke Analysis V1 live :

| Mois | Valeur certifiée retrouvée dans les snapshots actifs | Statut |
|---|---:|---|
| 2026-05 | Actual `3289.43` | PASS |
| 2026-07 | Actual `3773.14` | PASS |

Analysis Global reste hors périmètre et n'a pas été généré ni modifié.

## 8. Preuve de rollback

La primitive transactionnelle est
`public.restore_history_v2_publication(uuid, uuid, uuid, date, bigint)`, ajoutée
par le SQL local
`supabase/migrations/20260831150000_history_v2_publication_rollback.sql` et
enregistrée dans l'historique live sous :

```text
20260831094236 history_v2_publication_rollback
```

Sécurité vérifiée : fonction `SECURITY DEFINER`, `search_path` vide, exécution
réservée à `service_role`/rôle propriétaire ; aucun droit navigateur ajouté.

Deux niveaux de preuve ont été exécutés :

1. scénario synthétique Finalize → rollback → restore dans une transaction
   externe ensuite annulée ; aucune ligne de test n'a persisté ;
2. rollback réel d'août 2025, puis restauration de la même publication.

| Étape réelle | Révision | V2 août actif | V1 août actif |
|---|---:|---:|---:|
| Avant rollback | 29 | 2 artifacts / 75 queries | 414 / 127 |
| Rollback vers aucune V2 active | 30 | 0 / 0 | 414 / 127 |
| Restore publication `20bf6dc2-…` | 31 | 2 / 75 | 414 / 127 |

Le rollback est atomique et révisionné. Aucun `UPDATE is_active` manuel n'a été
utilisé. L'état restauré est identique à l'état publié et les 12 mois sont de
nouveau actifs.

## 9. Mini-matrice Brief → contrats live

| Exigence Brief | Ressource/artifact live | Preuve | Statut |
|---|---|---|---|
| Calendar Month, Hover, top 3, Ribbons | `calendar_semantic_month` + `history_month_calendar` | 12/12 actifs, RuntimeSchema et invariants certifiés | PASS |
| Week, top 6, navigation inter-mois | `history_week` | 52 instances actives | PASS |
| Journal économique sans duplication | `history_day_journal` + Daily Ledger | 365 instances actives | PASS |
| Quick Overview sans Typical/Minimal/rang | `history_month_overview` | 12 instances actives | PASS |
| Daily reconciliation | `daily_economic_ledger_month` | 12 artifacts, residual certifié nul | PASS |
| M1 bridge/résiduel/rang/zone usuelle | `history_month_balance_summary`, `history_bank_economy_bridge` | 24 instances actives | PASS |
| M2 catégories, drivers, fréquence × ticket | `history_month_categories`, `history_category_detail` | 108 instances actives | PASS |
| M3 Necessity × Behavior, gaps, MinimalPreview | `history_month_spending_nature`, `history_spending_segment_detail`, `history_minimal_preview` | 168 instances actives | PASS |
| M4 Activities, Moments, Places et détails | `history_month_life_money` + trois détails | 166 instances actives | PASS |
| Quality/Visibility explicites | Tous les payloads V2 | 12 mois `DATA_MISSING`, aucun `FAIL`, zéro champ de publication manquant | PASS |
| 15 ressources ciblées, aucun God RPC | Registry et snapshots live | 15 familles exactement | PASS |
| V1/V2 parallèles | tables partagées versionnées | volumes V1 inchangés, V2 `contractVersion=v2` | PASS |
| Aucun read-through V2 | stores live | 0 artifact, 0 query | PASS |

## 10. Incidents et écarts observés

- La première lecture SQL du résultat de Finalize, placée dans le même statement
  que l'appel RPC, observait l'ancien état en raison de la visibilité MVCC. Une
  lecture séparée après commit a confirmé chaque statut `published` et chaque
  compte actif ; aucun Finalize n'a été rejoué.
- La première barrière supposait à tort un unique ensemble global de policies.
  Elle a été corrigée pour comparer les policies propres à chaque ressource,
  conformément au rapport 07. Les payloads n'ont pas été modifiés.
- Les douze mois restent `DATA_MISSING` pour les absences canoniques déjà
  certifiées. Aucun backfill heuristique, aucune donnée inventée et aucune
  correction d'oracle n'ont été effectués.
- Aucun mois n'a échoué pendant le stage ou le Finalize ; aucune publication
  partielle active n'a été produite.

## 11. Conclusion

Les douze mois certifiés sont publiés et actifs dans le data plane Supabase
live, avec 24 artifacts partagés et 907 Query snapshots V2. Les ensembles
requis, RuntimeSchemas, versions, policies, PublicationMeta et factsHash sont
cohérents. Le read-through V2 est absent, V1 reste intact, et le rollback
transactionnel a été prouvé puis restauré.

Le transport opérationnel temporaire a été entièrement retiré. Aucun frontend,
aucun Global et aucun cutover Vercel Production n'a été commencé.

HISTORY_V2_LIVE_GATE = PASS
