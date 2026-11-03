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

/** Only the trusted server constructs this adapter. A DB credential alone cannot mint
 * a valid admission: the independent signing key is private to server + private SQL table.
 * SQL freezes its DB authority footprint BEFORE the caller republishes fresh C4/owner rights.
 * All bindings expire with this connection/transaction, including failed/uncertain commits. */
export function createRootRelationWriter(config: PoolConfig, signingKey: string): RootRelationWriter & { close(): Promise<void> } {
  if (!/^[a-f0-9]{64}$/u.test(signingKey)) throw new TypeError("N1_AUTHORITY_KEY_UNAVAILABLE");
  const pool = new Pool({ ...config, max: 3, connectionTimeoutMillis: 10000 });
  return {
    async run<T>(scope: Scope, work: (transaction: RootRelationTransaction) => Promise<T>) {
      if (!rootRelationDurableEnabled()) throw new TypeError("N1_DURABLE_DISABLED");
      const client = await pool.connect(); let committed = false;
      try {
        if ((await client.query("select session_user as name")).rows[0].name !== "composer_n1_server")
          throw new TypeError("N1_SQL_ROLE_INVALID");
        await client.query("begin; set local lock_timeout='4s'; set local statement_timeout='25s'");
        const binding = (await client.query("select pg_current_xact_id()::text as transaction_id, pg_backend_pid()::text as backend_id")).rows[0];
        const opening = { kind: "n1-session-scope@1", userId: scope.userId, householdId: scope.householdId,
          targetMonth: scope.targetMonth, transactionId: binding.transaction_id, backendId: binding.backend_id, nonce: randomUUID() };
        const sign = (value: unknown) => createHmac("sha256", Buffer.from(signingKey, "hex")).update(canonicalPlannerJson(value)).digest("hex");
        const opened = plannerRecord((await client.query("select private.begin_root_draft_authority_v1($1,$2,$3,$4,$5) as value",
          [scope.userId, scope.householdId, `${scope.targetMonth}-01`, opening, sign(opening)])).rows[0].value);
        let used = false;
        const result = await work({ async commit(packet, authority) {
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
        await client.query("commit"); committed = true;
        return result;
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (["40001", "40P01", "55P03"].includes(code)) throw new TypeError("N1_DRAFT_CONFLICT");
        if (code === "42501") throw new TypeError("N1_DRAFT_ACCESS_DENIED");
        if (["22023", "23514", "23502"].includes(code)) throw new TypeError("N1_DRAFT_METADATA_INVALID");
        if (error instanceof TypeError) throw error;
        throw new TypeError("N1_DURABLE_UNAVAILABLE");
      } finally {
        if (!committed) await client.query("rollback").catch(() => undefined);
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

let runtimeWriter: ReturnType<typeof createRootRelationWriter> | undefined;
/** No pool, key or connection is obtained unless both server gates are ON. No env is sent to a client. */
export function runtimeRootRelationWriter(): RootRelationWriter | undefined {
  if (!rootRelationDurableEnabled()) return undefined;
  const connectionString = process.env.COMPOSER_ROOT_RELATIONS_DATABASE_URL;
  const key = process.env.COMPOSER_ROOT_RELATIONS_AUTHORITY_KEY;
  if (!connectionString || !key) return undefined;
  return runtimeWriter ??= createRootRelationWriter({ connectionString }, key);
}
