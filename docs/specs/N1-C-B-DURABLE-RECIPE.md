# N1-C-B — local SQL recipe, durable path deliberately closed

Status: **PARTIAL**, not a completed vertical Save→Reload feature. No rollout or remote migration permission.

## What exists

N1-A/B/C-A remain the owners of relation structure, private admission, history, financial preservation, full-document codecs and receipt validation. Their version strings and historical V1 implementations are unchanged.

This tranche adds:

- A candidate SQL file at `supabase/candidates/20261103183114_n1_c_b_durable_candidate.sql`, generated initially with the official migration CLI and deliberately moved **outside `migrations/` before publication**.
- Six replacement private legacy functions, preserving their historical bodies except for ten guards immediately after locked Draft reads. Public V1/V2 Save/Archive/Restore wrappers and grants remain unchanged. N1 refuses before replay or mutation; V1 remains functional.
- A version-dispatching structural constraint accepting historical V1 and the complete N1 document without converting stored rows. N1 adds organization only; no new financial Context, component, amount, itinerary or group total.
- A private storage primitive with full source identity comparison under row lock, request envelope idempotence, base validation, concurrent-create serialization and a separate SQL gate defaulting OFF.
- A native PostgreSQL recipe testing actual transactions and concurrent connections. Its Auth functions and membership source are explicitly synthetic.
- A complete-document authenticated reader, versioned HTTP transport and real route `/api/composer/root-relation-drafts`, with separate server gates and a closed policy boundary. These are **not installed in ComposerShell**.

## Exact writer inventory

The tracked migrations define only these mutators of `phase2_composer_drafts`:

| Migration | Private functions | Public wrappers |
|---|---|---|
| `20261011130256_p07b_m0_phase2_composer_drafts_fixture_gate.sql` | save/archive/restore_phase2_composer_draft_v1 | same names in public |
| `20261011150830_p07_composer_draft_access_v2.sql` | save/archive/restore_phase2_composer_draft_v2 | same names in public |

There is no tracked DELETE RPC; ordinary clients have SELECT only, under the historical author/household policies. The v1 fixture gate and v2 access gate, author checks, membership function, CAS and requestId checks remain in place. Direct database owner/administrator SQL is privileged and not made safe by an application gate. The deployed catalog is **not inspected** by this mandate.

The historical Save function has three locked Draft reads: existing active on create, post-conflict read, and ordinary update. Each lifecycle function has one. All ten sites receive a guard. Restore against an old V1 archive refuses when another active Draft exists; it never replaces that active Draft.

## Storage primitive is not a user Save writer

`private.store_phase2_root_draft_v1(actor, household, packet, source_identity)`:

1. Requires the private SQL gate, initially OFF. The enabled row is held FOR SHARE through commit.
2. Requires actor equality with `auth.uid()`, existing v2 admission and household access.
3. Checks wire/document versions, structural validity, size, binding and base pairs.
4. Serializes N1 creations with a scoped advisory lock; existing ACTIVE uniqueness also remains.
5. Locks the selected private ACTIVE Draft and compares the full identity excluding observation timestamps/retention and the internal command ledger.
6. Replays only the same packet **and source identity** and the exact corresponding result metadata, base, document and digest.
7. Locks the Plan table in SHARE mode and the Plan row FOR SHARE, including protection of an absent-plan race. This broad table lock is conservative and requires review before any production use.
8. Stores the complete JSON, increments CAS once and preserves row identity, base, lifecycle and metadata. Create supplies all retention fields.

`n1_last_command` retains only the latest request envelope and source identity; it is not a permanent idempotency ledger. An older request after a later mutation is refused, not replayed blindly. Source identity includes full semantic JSON and mutation metadata, not just version/digest. Source and envelope storage increase per-row storage and need production sizing review.

**All EXECUTE privileges are revoked from PUBLIC, anon, authenticated AND service_role. There is no public wrapper and no server credential factory for this primitive.** Only the database owner can execute the local recipe. This is intentional, not a missing grant to fix automatically.

The SQL validator overlaps TypeScript on versions, relation shape, UUIDs, unique ids/membership, members existing as admitted roots, month, provenance, member order, graph and size. It reuses the historical V1 SQL validator for the financial envelope. It does not duplicate every C4 value grammar, financial rule or permission in SQL. SQL recomputes the SHA-256 digest using the existing TypeScript canonical JSON convention (including UTF-16 key order and number notation, with boundary tests). Strict TypeScript parsing and its digest verification remain required at server/reader boundaries. The storage primitive alone is not an admission of arbitrary JSON and is not exposed to callers that could bypass those boundaries.

## Why the positive runtime path stops

Two dependencies are not received:

1. **G-A.** No official owner in these N1 contracts attests completeness of a ROOT GROUP journey. The JourneyResolver processes explicit Mobility intents; an empty intent list or a financial FRESH result does not attest a complete group itinerary. Implementing a new group/Mobility doctrine is outside this tranche. `rootRelationDurablePolicy` returns `N1_G_A_POLICY_UNDECIDED` for every proposed group. Neither option A (incomplete organizational Draft saveable) nor B (completeness required) is approved for Production.
2. **Transaction-bound authority.** Existing F01 publishes fresh private/proposed C4 rights in server JavaScript before writing. CAS under SQL lock protects the source Draft/base, but it does not by itself prove that all authorization facts remain valid at commit. The repository does not provide a received protocol tying that publication and its permission revision to a callable SQL writer. Opening a service-role RPC or accepting a client grant/token would bypass this dependency. Runtime therefore also has an explicit `N1_SQL_AUTHORITY_NOT_RECEIVED` stop; no SQL writer is obtained or called.

The HTTP handler authenticates through `authorizedPlanner`, uses the ordinary scoped client for reads, refuses browser-provided household/grants, invokes existing private admission/owner and validates local CAS/reconciliation. G-A blocks before any successful receipt is returned. Tests cannot replace that policy with an unconditional true to claim a vertical PASS.

## Gates and exposure

- Existing `COMPOSER_ROOT_RELATIONS_ENABLED === "true"` stays unchanged.
- New `COMPOSER_ROOT_RELATIONS_DURABLE_SAVE_ENABLED === "true"` is required too.
- Both default OFF; the HTTP handler checks them before authorization or reads.
- SQL recipe gate `private.phase2_root_durable_gate.enabled` defaults false and is not client-readable/writable.
- Policy remains closed even if both application flags were accidentally true.
- Private storage EXECUTE remains revoked even if its SQL gate is enabled by an administrator.
- No Vercel variable, Supabase project, remote schema or setting is changed.

## Explicitly not integrated

ComposerShell, page opening, the financial autosave, RAW/focus/history/navigation, root workspace recovery and the existing editor are unchanged. No new button claims a Save that cannot be admitted. No second autosave is introduced. A persisted N1 Draft is not silently projected into the historical V1 writer.

Consequently the complete Shell→HTTP→admission→writer→DB→reader→Shell scenario is **NOT_RUN**, and SAVED_LOCAL_ISOLATED is **NOT_ATTESTED**. The positive SQL-owner recipe and the HTTP fail-closed scenario are different proofs, never stitched together as a user Save. Save/Reload, full source/history recovery, delayed Reload protection in the Shell and authorized lifecycle integration remain to be completed after the blocking authority/policy boundary is received.

## Local reproduction

Use a fresh native PostgreSQL 17 cluster created solely for these scripts, listening on `127.0.0.1:55439`, data directory `../p-grp-n1-c-b/pg-isolated` relative to the repository. Do not point these scripts at a pre-existing cluster. The SQL script checks the actual server data directory before creating a fresh `n1cb_recipe_*` database. It never accepts a database URL or password; it refuses any request for a secret.

Run:

```text
node scripts/check-root-relation-durable-postgres.mjs
node scripts/check-root-relation-durable-http.mjs
node scripts/check-composer-root-relation-durable-contract.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
git diff --check
```

The native SQL test does execute actual migrations/transactions and uses different connections for races, with synthetic roles, `auth.uid()` and membership functions. It does **not** certify real Supabase Auth/RLS. The HTTP test uses real loopback HTTP, transport, service and owner with synthetic auth/rows, and makes zero SQL writes. It does **not** certify SQL Save from the UI.

## Publication and next decision

No tracked GitHub workflows are present, build is `next build`, no install/prebuild/postbuild migration command exists and `vercel.json` contains no migration command. Supabase external integration settings are not certified; candidate packaging outside `migrations/` avoids making this file a default auto-migration input. Do not move it into that directory or apply it remotely without separate review.

One Draft PR only. No merge or manual deployment. Future receipt must establish a transaction-bound trusted authority mechanism and the G-A policy/completeness boundary, complete the real Shell Save/Reload and history/navigation protections, then receive synthetic vertical and explicitly authorized isolated Auth/RLS before activation. G-B/G-C stay open; no #93 change, N1-D, N2/N3/N4, Apply or Finance/Mobility calculation is introduced.
