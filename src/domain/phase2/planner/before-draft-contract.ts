import type { ComposerOperation } from "./composer-ui-contract";
import { plannerDigestString, plannerKeys, plannerRecord, plannerUuid } from "./json";
import type { PlanSemanticStateV1 } from "./semantic-state";

export const BEFORE_N2_DISABLED = "COMPOSER_BEFORE_N2_DISABLED";
export const BEFORE_N2_APPLY_UNAVAILABLE = "COMPOSER_BEFORE_N2_APPLY_UNAVAILABLE";
export const beforeN2DisabledMessage = "Le Before descriptif est désactivé. Les brouillons existants restent conservés.";
export const beforeN2ApplyMessage = "L’application d’un mois contenant un Before descriptif n’est pas disponible. Votre brouillon reste conservé.";
export const beforeN2UndoMessage = "Cette annulation rétablirait un choix que le brouillon ne sait pas enregistrer. Le cadre actuel est conservé.";

export const BEFORE_ADMISSION_VERSION = "before-admission-replay@v2" as const;
export const BEFORE_ADMISSION_MAX_STEPS = 64;
export const BEFORE_ADMISSION_MAX_BYTES = 1_150_000;
export const BEFORE_ADMISSION_BUDGET_MS = 5000;
/** Closed N2 adapter, not an extensible Composer replay registry. */
export type BeforeOperation = Extract<ComposerOperation, { kind: "EDIT_NIGHT_OUT" | "PRESERVE" | "DROP" | "EDIT_CONTEXT" }>;
export type BeforeAdmissionStep = Readonly<{ sourceDigest: string; operation: BeforeOperation }>;
export type BeforeDraftAdmission = Readonly<{ version: typeof BEFORE_ADMISSION_VERSION | "before-admission-replay@v1";
  parentContextOccurrenceId: string; baseDigest: string; steps: readonly BeforeAdmissionStep[] }>;

export function hasBeforeDraft(state: PlanSemanticStateV1 | undefined | null): boolean {
  return !!state?.contexts.some(c => Object.hasOwn(c.fields, "beforeMoment") || c.fields.fieldSchemaVersion === "context-fields@v7");
}
/** The old Before uses bottle/extras or null. Versioned Before commands are N2. */
export function isBeforeN2Operation(operation: ComposerOperation): boolean {
  return operation.kind === "EDIT_NIGHT_OUT" && !!operation.edit?.before
    && Object.hasOwn(operation.edit.before, "version");
}

/** Checkpoints, financial controls, N1 and arbitrary Context writers have no admission here. */
export function parseBeforeDraftAdmission(input: unknown): BeforeDraftAdmission {
  const value = plannerRecord(input); plannerKeys(value, ["version", "parentContextOccurrenceId", "baseDigest", "steps"]);
  if (![BEFORE_ADMISSION_VERSION, "before-admission-replay@v1"].includes(String(value.version)) || !Array.isArray(value.steps)
    || value.steps.length > BEFORE_ADMISSION_MAX_STEPS) throw new TypeError("BEFORE_ADMISSION_LIMIT_OR_VERSION");
  plannerUuid(value.parentContextOccurrenceId); plannerDigestString(value.baseDigest);
  for (const raw of value.steps) {
    const step = plannerRecord(raw); plannerKeys(step, ["sourceDigest", "operation"]); plannerDigestString(step.sourceDigest);
    const operation = plannerRecord(step.operation);
    if (operation.kind === "EDIT_NIGHT_OUT") {
      plannerKeys(operation, ["kind", "edit"]); const edit = plannerRecord(operation.edit);
      plannerKeys(edit, ["contextOccurrenceId", "fields", "before", "slots", "consumption", "globalConsumption", "coverageReplacement"], ["contextOccurrenceId", "fields"]);
      plannerRecord(edit.fields);
      if (edit.contextOccurrenceId !== value.parentContextOccurrenceId) throw new TypeError("BEFORE_ADMISSION_TARGET_INVALID");
      if (Object.hasOwn(edit, "before")) {
        const before = plannerRecord(edit.before);
        if (before.version !== "before-moment-edit@v1" && before.version !== "before-moment-remove@v1") throw new TypeError("BEFORE_ADMISSION_OWNER_REQUIRED");
      }
      if (value.version === "before-admission-replay@v1") { plannerKeys(edit, ["contextOccurrenceId", "fields", "before"]); plannerKeys(plannerRecord(edit.fields), []); }
    } else if (operation.kind === "PRESERVE") {
      plannerKeys(operation, ["kind", "targetRef", "preserve"]); plannerUuid(operation.targetRef);
      if (typeof operation.preserve !== "boolean") throw new TypeError("BEFORE_ADMISSION_PRESERVE_INVALID");
    } else if (value.version === BEFORE_ADMISSION_VERSION && operation.kind === "DROP") {
      plannerKeys(operation, ["kind", "assetKey", "target", "values", "identity", "selectionId", "presetKey"], ["kind", "assetKey", "target", "values", "identity", "selectionId"]);
      plannerUuid(operation.identity); plannerUuid(operation.selectionId); const target = plannerRecord(operation.target);
      plannerKeys(target, ["kind"]); plannerRecord(operation.values);
      const create = operation.assetKey === "template:night-out" && operation.presetKey === "bar-apero" && target.kind === "BOARD_ZONE";
      const remove = operation.assetKey === `context-occurrence:${value.parentContextOccurrenceId}` && target.kind === "TRASH";
      if ((!create && !remove) || operation.identity !== value.parentContextOccurrenceId) throw new TypeError("BEFORE_ADMISSION_DROP_SCOPE_INVALID");
    } else if (value.version === BEFORE_ADMISSION_VERSION && operation.kind === "EDIT_CONTEXT") {
      plannerKeys(operation, ["kind", "contextOccurrenceId", "values"]); plannerUuid(operation.contextOccurrenceId);
      plannerKeys(plannerRecord(operation.values), ["label", "plannedDate", "placeRef", "participantRefs"], []);
    } else throw new TypeError("BEFORE_ADMISSION_MIXED_UNSUPPORTED");
  }
  return value as unknown as BeforeDraftAdmission;
}
export function beforeAdmissionMessage(code: string): string {
  if (code === BEFORE_N2_DISABLED) return beforeN2DisabledMessage;
  if (/LIMIT|BUDGET|SIZE/.test(code)) return "La limite de vérification du Before est atteinte. Vos choix restent dans cette page ; aucune saisie n’a été supprimée.";
  if (/BOOTSTRAP|PARENT/.test(code)) return "La base ou la création du Bar n’a pas pu être vérifiée. Vos choix locaux restent conservés dans cette page.";
  if (/CHANNEL/.test(code)) return "Le canal de sauvegarde sécurisé du Before est indisponible. Vos choix restent dans cette page.";
  if (code === "BEFORE_ADMISSION_HISTORY_OWNER_REQUIRED") return "Ce retour à un ancien choix ne peut pas encore être enregistré. Vos choix locaux et vos saisies restent conservés.";
  if (/MIXED|RECONCILIATION|HISTORY/.test(code)) return "Cette combinaison de décisions ne peut pas être vérifiée pour la sauvegarde du Before. Le cadre sélectionné et vos saisies restent conservés.";
  return "Le Before n’a pas pu être admis pour la sauvegarde. Vos choix et saisies restent dans cette page ; vérifiez la version et les protections de la carte.";
}
