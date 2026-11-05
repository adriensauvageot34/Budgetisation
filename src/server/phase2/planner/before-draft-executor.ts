import "server-only";
import { Pool } from "pg";
import { isAdmittedBeforeSave, type BeforeDraftWriter } from "./before-draft-admission";

let pool: Pool | undefined;
/** No default service-role fallback. Provisioning this dedicated LOGIN remains an external gate. */
export const executeBeforeDraft: BeforeDraftWriter = async admission => {
  if (!isAdmittedBeforeSave(admission)) throw new TypeError("BEFORE_ADMISSION_NOT_SERVER_ISSUED");
  const connectionString = process.env.COMPOSER_BEFORE_DATABASE_URL;
  if (!connectionString) throw new TypeError("BEFORE_ADMISSION_CHANNEL_UNAVAILABLE");
  pool ??= new Pool({ connectionString, max: 2, idleTimeoutMillis: 10000, connectionTimeoutMillis: 3000,
    statement_timeout: 4000, application_name: "composer-before-admission" });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const roles = await client.query(`select not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb
      and pg_has_role(session_user,'composer_before_executor','member')
      and session_user not in ('postgres','service_role','authenticated','anon','authenticator')
      and not pg_has_role(session_user,'postgres','member') and not pg_has_role(session_user,'service_role','member')
      and not pg_has_role(session_user,'composer_before_owner','member') as allowed from pg_roles where rolname=session_user`);
    if (roles.rows[0]?.allowed !== true) throw new TypeError("BEFORE_ADMISSION_CHANNEL_ROLE_INVALID");
    await client.query("set local role composer_before_executor");
    const c = admission.command;
    const { rows } = await client.query(`select private.save_composer_before_draft_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as result`,
      [admission.householdId, c.targetMonth + "-01", c.expectedDraftId, c.expectedDraftVersion, c.requestId,
        admission.basePlanId, c.expectedBaseRevisionId, c.expectedBaseRevisionNumber, JSON.stringify(c.semanticState), c.digest,
        admission.userId, admission.expectedDigest, admission.fingerprint]);
    await client.query("commit"); return { data: rows[0].result, error: null };
  } catch (error) {
    await client.query("rollback");
    if (error instanceof TypeError) throw error;
    return { data: null, error: { code: typeof error === "object" && error && "code" in error ? String(error.code) : "UNAVAILABLE" } };
  } finally { client.release(); }
};
