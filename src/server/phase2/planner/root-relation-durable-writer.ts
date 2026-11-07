import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { Pool, type PoolConfig } from "pg";
import { canonicalPlannerJson, plannerDigest, plannerRecord } from "@/domain/phase2/planner/json";
import type { RootRelationDraftSavePacket } from "@/domain/phase2/planner/root-relation-draft-contract";
import { rootRelationDurableEnabled } from "./root-relation-durable-policy";

type Scope = Readonly<{ userId: string; householdId: string; targetMonth: string }>;
export type RootRelationTransaction = Readonly<{
  commit(packet: RootRelationDraftSavePacket, authority: unknown): Promise<unknown>;
}>;
export type RootRelationWriter = Readonly<{
  run<T>(scope: Scope, work: (transaction: RootRelationTransaction) => Promise<T>): Promise<T>;
}>;
export const ROOT_RELATION_AUTHORITY_BUDGET_MS = 8000;

/** Only the trusted server constructs this adapter. A DB credential alone cannot mint
 * a valid admission: the independent signing key is private to server + private SQL table.
 * SQL freezes its DB authority footprint BEFORE the caller republishes fresh C4/owner rights.
 * All bindings expire with this connection/transaction, including failed/uncertain commits. */
export function createRootRelationWriter(config: PoolConfig, signingKey: string,
  /** Local tests may shorten, never extend, the server's total budget. */
  budgetMs = ROOT_RELATION_AUTHORITY_BUDGET_MS): RootRelationWriter & { close(): Promise<void> } {
  if (!/^[a-f0-9]{64}$/u.test(signingKey)) throw new TypeError("N1_AUTHORITY_KEY_UNAVAILABLE");
  if (!Number.isInteger(budgetMs) || budgetMs < 50 || budgetMs > ROOT_RELATION_AUTHORITY_BUDGET_MS)
    throw new TypeError("N1_AUTHORITY_BUDGET_INVALID");
  const pool = new Pool({ ...config, max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
  // An idle backend can be terminated by PostgreSQL's independent safety timeout.
  pool.on("error", () => undefined);
  return {
    async run<T>(scope: Scope, work: (transaction: RootRelationTransaction) => Promise<T>) {
      if (!rootRelationDurableEnabled()) throw new TypeError("N1_DURABLE_DISABLED");
      const client = await pool.connect(); let committed = false, active = true, released = false;
      const expired = () => new TypeError("N1_AUTHORITY_TIMEOUT");
      const assertActive = () => { if (!active) throw expired(); };
      const destroy = () => { active = false; if (!released) { released = true; client.release(true); } };
      let rejectBackend: (error: Error) => void = () => undefined;
      const backendFailure = new Promise<never>((_, reject) => { rejectBackend = reject; });
      const onError = () => { destroy(); rejectBackend(new TypeError("N1_DURABLE_UNAVAILABLE")); };
      client.on("error", onError);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { destroy(); reject(expired()); }, budgetMs); });
      try {
        const operation = async () => {
          assertActive();
          if ((await client.query("select session_user as name")).rows[0].name !== "composer_n1_server")
            throw new TypeError("N1_SQL_ROLE_INVALID");
          assertActive();
          // PG17 total timeout is independent of statement/lock timeouts and the Node event loop.
          await client.query("set transaction_timeout='10s'; set idle_in_transaction_session_timeout='9s'; set lock_timeout='1s'; set statement_timeout='8s'");
          assertActive();
          await client.query("begin");
          const binding = (await client.query("select pg_current_xact_id()::text as transaction_id, pg_backend_pid()::text as backend_id")).rows[0];
          const opening = { kind: "n1-session-scope@1", userId: scope.userId, householdId: scope.householdId,
            targetMonth: scope.targetMonth, transactionId: binding.transaction_id, backendId: binding.backend_id, nonce: randomUUID() };
          const sign = (value: unknown) => createHmac("sha256", Buffer.from(signingKey, "hex")).update(canonicalPlannerJson(value)).digest("hex");
          const opened = plannerRecord((await client.query("select private.begin_root_draft_authority_v1($1,$2,$3,$4,$5) as value",
            [scope.userId, scope.householdId, `${scope.targetMonth}-01`, opening, sign(opening)])).rows[0].value);
          let used = false;
          assertActive();
          const result = await work({ async commit(packet, authority) {
            assertActive();
            if (used) throw new TypeError("N1_ADMISSION_ALREADY_USED"); used = true;
            if (!rootRelationDurableEnabled()) throw new TypeError("N1_DURABLE_DISABLED");
            const admission = { nonce: opened.nonce, transactionId: opened.transactionId, backendId: opened.backendId,
              userId: scope.userId, householdId: scope.householdId, targetMonth: scope.targetMonth,
              packetDigest: plannerDigest(packet), sourceDigest: plannerDigest(opened.source ?? null),
              authorityDigest: plannerDigest(authority), policy: "g-a-organizational-draft@1" };
            const signature = sign(admission);
            return (await client.query("select private.commit_root_draft_authority_v1($1,$2,$3,$4) as value",
              [packet, opened.source ?? null, admission, signature])).rows[0].value;
          } });
          assertActive();
          await client.query("commit"); committed = true;
          return result;
        };
        return await Promise.race([operation(), deadline, backendFailure]);
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (["40001", "40P01", "55P03"].includes(code)) throw new TypeError("N1_DRAFT_CONFLICT");
        if (code === "42501") throw new TypeError("N1_DRAFT_ACCESS_DENIED");
        if (["22023", "23514", "23502"].includes(code)) throw new TypeError("N1_DRAFT_METADATA_INVALID");
        if (error instanceof TypeError) throw error;
        throw new TypeError("N1_DURABLE_UNAVAILABLE");
      } finally {
        if (timer) clearTimeout(timer);
        active = false;
        // Destroy any uncommitted/uncertain connection. Never recycle an open transaction,
        // nor wait indefinitely for ROLLBACK behind a stalled query/network callback.
        if (!committed) destroy();
        if (!released) { released = true; client.removeListener("error", onError); client.release(); }
      }
    },
    close: () => pool.end(),
  };
}

/** Shared runtime remains closed: global locks are not a received shared authority protocol.
 * Local isolated recipes explicitly construct their writer. Credentials or both gates ON
 * cannot silently enable this conservative experiment on Supabase/Vercel. */
export function runtimeRootRelationWriter(): RootRelationWriter | undefined {
  if (!rootRelationDurableEnabled()) return undefined;
  return undefined;
}
