import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { parseMonthChoice } from "@/domain/phase2/month-choice-contract";
import { monthInputsSchema, type MonthInputs } from "./month-scenario";
import { monthChoiceDigest, type MonthChoiceContext } from "./month-choices";

type Undo = { household: string; user: string; month: string; expires: number; digest: string;
  categories: { key: string; assumption: NonNullable<MonthInputs["decision"]>["assumptions"][string] | null }[];
  savings: { id: string; amount: string }[] };
const key = () => { const secret = process.env.SUPABASE_SECRET_KEY; if (!secret) throw new TypeError("UNDO_KEY_UNAVAILABLE"); return createHash("sha256").update(`month-choice-undo@v1:${secret}`).digest(); };

/** Ephemeral encrypted receipt, scoped to the actor and exact post-apply truth. */
export function makeMonthChoiceUndo(ctx: MonthChoiceContext, next: MonthInputs, choice: unknown, household: string, user: string) {
  const operations = parseMonthChoice(choice).operations, before = monthInputsSchema.parse(ctx.inputs);
  const receipt: Undo = { household, user, month: ctx.forecast.meta.targetMonth, expires: Date.now() + 10 * 60_000,
    digest: monthChoiceDigest({ ...ctx, inputs: next }),
    categories: operations.flatMap(op => op.kind === "CATEGORY" ? [{ key: op.categoryKey, assumption: before.decision?.assumptions[op.categoryKey] ?? null }] : []),
    savings: operations.flatMap(op => op.kind === "SAVINGS" ? before.declaredOutflows.filter(row => row.id === op.savingsId).map(row => ({ id: row.id, amount: row.amount })) : []) };
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(receipt), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}
export function restoreMonthChoiceUndo(ctx: MonthChoiceContext, token: string, household: string, user: string): MonthInputs {
  if (typeof token !== "string" || token.length > 12000) throw new TypeError("UNDO_INVALID");
  const bytes = Buffer.from(token, "base64url"), decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const receipt = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")) as Undo;
  if (receipt.household !== household || receipt.user !== user || receipt.month !== ctx.forecast.meta.targetMonth || receipt.expires < Date.now()
    || receipt.digest !== monthChoiceDigest(ctx)) throw new TypeError("UNDO_STALE_OR_UNAUTHORIZED");
  const current = monthInputsSchema.parse(ctx.inputs), assumptions = { ...current.decision!.assumptions };
  for (const item of receipt.categories) { if (item.assumption === null) delete assumptions[item.key]; else assumptions[item.key] = item.assumption; }
  const declaredOutflows = current.declaredOutflows.map(row => {
    const saved = receipt.savings.find(item => item.id === row.id);
    if (saved && (row.kind !== "SAVINGS" || row.adjustability !== "ADJUSTABLE")) throw new TypeError("UNDO_PROTECTED_SAVINGS");
    return saved ? { ...row, amount: saved.amount } : row;
  });
  return monthInputsSchema.parse({ ...current, decision: { ...current.decision, assumptions }, declaredOutflows });
}
