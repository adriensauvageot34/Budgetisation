# Planner V3 — C0 foundations

Date : 5 octobre 2026 (Europe/Paris).
Scope : master M20/M21, C0 seulement. Aucun Compiler, Baseline calculée, registry métier ou UI Composer.

## Checkpoint

| Champ | Résultat |
| --- | --- |
| HEAD_BEFORE | `c057f65353b4229a9a1135b7adf682f2bad35d51` |
| HEAD_AFTER | Commit `feat(phase2): add planner contracts and plan revisions` contenant ce rapport ; SHA exacte dans le rapport de livraison et `git log -1 --format=%H -- docs/status/planner-c0-foundation-2026-10-05.md` |
| BRANCH | `main` |
| MIGRATION_REQUIRED | YES — `20261005202346_phase2_month_plan_foundation.sql` |
| REMOTE_MIGRATION_APPLIED | YES — après validation humaine ; version distante `20261005204529` |
| TYPECHECK | PASS — `tsc --noEmit` |
| BUILD | PASS — Next.js production build |
| ZERO_HISTORICAL_WRITE | YES — distant en lecture seule ; tests SQL en mémoire sur fixtures synthétiques |
| C0_READY_FOR_C1 | YES — contrats et fixtures disponibles ; C1 ne dépend pas de la persistence live |

## SCOPE_DONE

- État sémantique versionné, contrôles `SET_STATE`, Contexts actifs, préférences et langage de mutation.
- Parsing strict des enveloppes, normalisation du dernier contrôle par slot, identités uniques et contrôle des parents/cycles.
- Sérialisation canonique, SHA-256 et identités dérivées des rôles sémantiques. UUIDs explicites conservés au reload.
- Contrats partagés de Baseline, Components, Renewals, Mobility, Projection et interaction, sans moteur de calcul.
- `PlanRepository` exclusivement en lecture, avec foyer/mois/Plan/révision filtrés et vérifiés.
- Deux tables prospectives, unicité foyer/mois, FKs de scope et pointeur actif lié à la bonne révision et au bon numéro.
- Révisions append-only, `UPDATE`/`DELETE`/`TRUNCATE` refusés, accès direct applicatif limité à `SELECT` sous RLS.
- RPC atomique avec verrou de ligne, CAS ID+numéro, idempotence et refus d'un request ID réutilisé avec un contenu différent.

## Persistence et sécurité

La RPC publique `apply_phase2_month_plan_v1` est `SECURITY INVOKER` et délègue à une fonction privée `SECURITY DEFINER`.
La fonction privée vérifie `auth.uid()` et `private.user_has_household_access(household_id)` avant toute écriture.
Les auteurs sont dérivés de l'utilisateur authentifié ; aucun auteur n'est accepté dans le payload.
Les deux fonctions fixent `search_path = ''` et qualifient les relations.
Les grants par défaut sont révoqués explicitement ; `anon` et `service_role` ne disposent pas de cette voie d'Apply.
Le helper privé et le droit USAGE du rôle authenticated ont été vérifiés sur le schéma distant existant, sans lecture de données bancaires.

La RPC reçoit les 16 paramètres `p_*` documentés dans la migration : foyer, premier jour du mois,
expected active revision ID/number, apply request ID, Baseline digest/snapshot, semantic state/digest,
changeSet, manifest/digest, projection evidence, preview digest, compiler version et model versions.
Elle retourne `{ plan, revision, replayed }` avec les noms de colonnes DB.
Un replay peut retourner sa révision originale et un Plan ayant depuis avancé ; il ne réactive jamais une ancienne révision.

Le rollback produit crée une nouvelle révision portant l'ancien état ; aucune révision n'est écrasée.
Un échec transactionnel annule aussi la création initiale de l'aggregate ou une insertion de révision déjà effectuée.
Seules `phase2_month_plans` et `phase2_month_plan_revisions` sont écrites.

## TESTS_ADDED

Commandes reproductibles après installation des dépendances :

```text
npm run check:planner-c0-contracts
npm run check:planner-c0-persistence
npm run check:planner-c0
```

`@electric-sql/pglite@0.5.8` est une dépendance de développement épinglée, avec lockfile.
Le test exécute la migration SQL inchangée dans PostgreSQL en mémoire, avec les rôles, auth.uid et le helper d'accès synthétiques.
Il ne démarre pas Supabase local, ne lit pas `.env`, n'utilise aucun client live et ne contacte aucun service distant.

| Gate | Preuve | Résultat |
| --- | --- | --- |
| PLN-001 | Un seul Plan par foyer/mois, contrainte unique réellement exercée | PASS |
| PLN-002 | Mutations directes refusées ; immutabilité exercée même sous le propriétaire SQL | PASS |
| PLN-003 | CAS obsolète refusé, sans nouvelles lignes | PASS |
| PLN-004 | Replay identique ; conflit de contenu ; replay après plusieurs révisions | PASS |
| PLN-005 | Échec après création du Plan et après insertion de la révision, rollback des lignes et du pointeur | PASS |
| PLN-006 | Réapplication d'un ancien état dans une nouvelle révision chaînée | PASS |
| PLN-007 | Tables canaris historiques inchangées, seules deux tables de mutation | PASS |
| C0-ID-001 | UUIDs/IDs sémantiques conservés après sérialisation/reload | PASS |
| C0-ID-002 | Layout externe au semantic state ; injection de layout dans l'état refusée | PASS |
| C0-PARSE-001 | Version sémantique inconnue refusée | PASS |
| C0-PARSE-002 | Révision malformée, digest/état/mois/parent incohérents refusés | PASS |
| C0-RLS-001 | Deux foyers isolés en SELECT et RPC ; anon, service_role et utilisateur absent refusés | PASS |

Cas supplémentaires : normalisation, JSON sans conversion destructive, scope du repository,
versions/payloads SQL invalides et absence de fonction publique privilégiée.
Deux suites C0 : 7 groupes contrats + 9 groupes persistence, tous PASS.

## REGRESSIONS

- `check:architecture` : PASS (788 fichiers au contrôle).
- `check:phase2-forecast-temporal-mode` : PASS (13 checks), y compris `FULL_MONTH_SAFE`, temporal mode réversible et Preview/Save/reload.
- `check:phase2-planned-finance` : PASS, dont FIN-01..08, funding et non-réallocation automatique Banque.
- `check:phase2-month-control-center-v5` : PASS (38/38), avec secret Undo exclusivement fictif dans le processus de test.
- TypeScript et build de production : PASS.

## KNOWN_LIMITATIONS

- La migration n'a pas été appliquée au projet distant. Le schéma distant lu est PostgreSQL 17.6 ; le moteur de fixture est PostgreSQL 18.3.
- PGlite n'offre qu'une connexion : la contention entre plusieurs sessions PostgreSQL n'est pas exercée. Le SQL utilise `ON CONFLICT` puis `FOR UPDATE` sur le même aggregate.
- Les valeurs de contrôles/options et certaines evidences sont des enveloppes JSON ouvertes. Leurs schémas spécifiques restent la responsabilité de C1/C2/C3/C4/C6/C7.
- C0 vérifie le digest sémantique à la lecture. La DB persiste les digests fournis et ne recompile pas les evidences ; C2 doit relire les autorités, recompiler et vérifier Baseline/Preview avant tout appel RPC.
- Aucun caller applicatif ne branche encore ce repository ou la RPC. Aucun budget n'est calculé par C0.

## FOLLOW_UPS

1. Validation humaine de la migration ciblée puis application au projet V2, selon AGENTS.md règle 11.
2. Contrôles distants en lecture seule des tables, contraintes, grants et fonction après application ; tout test distant avec écriture requiert son autorisation spécifique.
3. C1 : construire la Baseline dérivée à partir de ses autorités, en ignorant les anciennes assumptions comme habitudes.
4. C2 : Compiler partagé Preview/Apply, stale guards et seul writer serveur devant la RPC.

Rollback C0 : revenir sur le code si nécessaire. Les tables prospectives vides peuvent rester ; aucune migration destructive inverse automatique.
Les DEFERRED-001→015 restent hors scope.

## Références vérifiées

- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions) : droits d'exécution et search_path.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) : grants distincts des policies.
- [PGlite](https://pglite.dev/docs/) : PostgreSQL en mémoire et connexion exclusive.
- Changelog Supabase lu le 5 octobre 2026 ; la nouvelle migration n'utilise aucune extension ou fonction affectée par les breaking changes relevés.
