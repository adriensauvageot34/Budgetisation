# History V2 — Production smoke fixes

Date : 2026-09-01
Base : `8d1ef0e63209b858c620b297e35f290b7d51f113` (`main`)

## Symptômes et causes

- `/` et `/historique` sélectionnaient la dernière période Bootstrap clôturée/documentée, même sans publication History V2 active. Août 2026 était donc préféré à juillet 2026.
- M2, M3 et M4 trouvaient leurs snapshots, puis `validateQueryData()` les rejetait sur l'égalité `QueryCapabilities` : le runtime ne reconnaissait pas leurs dimensions implicitement agrégées.

## Corrections

`SupabaseAnalyticsMaterializationStore.readLatestPublishedHistoryV2Month()` sélectionne désormais le snapshot `history_month_calendar` le plus récent pour le Household courant, avec publication `published`, scope mensuel, contrat et signature courants, sujet Household, `is_active=true`, `invalidated_at IS NULL`, expiration absente et `publication_id` réel. Le helper authentifié `resolveLatestPublishedHistoryV2Month()` est partagé par `/` et `/historique`. Sans publication, les deux routes redirigent vers `/diagnostic`. Les deep links `/historique/[month]` restent inchangés.

Le moteur de capabilities représente maintenant plusieurs dimensions implicites par ressource :

| Ressource | Dimensions implicites |
| --- | --- |
| `history_month_categories` | Category |
| `history_category_detail` | Category, Merchant |
| `history_month_spending_nature` | LifeScope |
| `history_spending_segment_detail` | Category, LifeScope |
| `history_month_life_money` | Activity, Place |
| `history_activity_detail` | Activity |
| `history_place_detail` | Place |

Les `availabilityRules` du Metric Registry et la validation stricte `QueryCapabilities` sont conservées. Un garde-fou négatif prouve qu'une ressource sans agrégation Category continue de retourner la mesure concernée en `not_applicable` sans filtre.

## Fichiers modifiés

- `src/query-api/capabilities/engine.ts`
- `src/server/analytics/materialization/store.ts`
- `src/server/query/runtime.ts`
- `src/app/historique/page.tsx`
- `src/app/page.tsx`
- `scripts/check-history-v2-snapshot-materialization.mjs`
- `scripts/check-history-v2-frontend.mjs`
- `docs/history-v2/14-production-smoke-fixes-report.md`

## Vérifications

| Check | Résultat |
| --- | --- |
| Capabilities, matérialisation et resolver | PASS — 63 assertions |
| Frontend History V2 | PASS — 15/15 ressources, UX 132/132 |
| Bilan M1–M4 | PASS — 64/64 |
| `tsc --noEmit` | PASS |
| `next build` | PASS |
| `git diff --check` | PASS |

Le resolver fake couvre : Bootstrap juillet+août avec publication active juillet → juillet ; publication active août → août ; aucune publication → `null`.

## Périmètre et état avant déploiement

- `FIX_SCOPE = CODE_ONLY`.
- Aucun snapshot, `factsHash`, `policyVersions` ou `PublicationMeta` n'a été modifié.
- Aucune écriture Supabase, republication, migration, Stage, Finalize ou backfill n'a été exécuté.
- Aucun Preview Vercel ni smoke navigateur n'a été lancé.
- Le build local Production est prêt pour l'unique push `main` et le déploiement automatique Production.

HISTORY_V2_DEFAULT_MONTH_FIX_GATE = PASS
HISTORY_V2_CAPABILITIES_FIX_GATE = PASS
HISTORY_V2_DRILLDOWN_CAPABILITIES_GATE = PASS
HISTORY_V2_PRODUCTION_FIX_CODE_GATE = PASS
