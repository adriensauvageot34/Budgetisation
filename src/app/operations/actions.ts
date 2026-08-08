"use server";

import type {
  AnalyticalStatus,
  FlowType,
  Importance,
  MonthKey,
  Recurrence,
  ResourceType,
} from "@/domain/budget";
import { createClient } from "@/lib/supabase/server";

export type OperationUpdateInput = {
  date: string;
  amount: number;
  normalizedMerchant: string | null;
  flow: FlowType;
  category: string | null;
  subcategory: string | null;
  preciseType: string | null;
  recurrence: Recurrence | null;
  importance: Importance | null;
  status: AnalyticalStatus;
  note: string | null;
  event: string | null;
  eventDetail: string | null;
  resourceType: ResourceType | null;
  resourceContext: string | null;
  analysisMonthOverride: MonthKey | null;
  reimbursesOperationId: string | null;
  uncertain: boolean;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const flows: FlowType[] = [
  "Dépense",
  "Revenu",
  "Remboursement",
  "Transfert interne",
  "Prêt et avance",
  "Flux technique",
];
const recurrences: Recurrence[] = ["Fixe", "Variable"];
const importances: Importance[] = [
  "Indispensable",
  "Contrainte",
  "Ajustable",
  "Optionnelle",
];
const statuses: AnalyticalStatus[] = [
  "Habituel",
  "Exceptionnel",
  "Hors budget",
  "À ventiler",
];
const resourceTypes: ResourceType[] = [
  "Revenu",
  "Entrée d'argent",
  "Remboursement",
  "Transfert interne",
  "Flux technique",
  "À qualifier",
];

function optionalText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validatedDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Date invalide.");
  }
  return value;
}

function validatedMonth(value: MonthKey | null) {
  if (!value) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error("Mois de rattachement invalide.");
  }
  return `${value}-01`;
}

async function currentHouseholdId(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Session Supabase invalide.");

  const { data, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.household_id) throw new Error("Utilisateur non rattaché à un foyer.");
  return String(data.household_id);
}

async function resolveTaxonomyIds(
  supabase: SupabaseServerClient,
  householdId: string,
  input: OperationUpdateInput,
) {
  const categoryName = optionalText(input.category);
  const subcategoryName = optionalText(input.subcategory);
  const preciseTypeName = optionalText(input.preciseType);

  if (!categoryName) {
    if (subcategoryName || preciseTypeName) {
      throw new Error("Sélectionnez une catégorie avant son classement détaillé.");
    }
    return { categoryId: null, subcategoryId: null, preciseTypeId: null };
  }

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("household_id", householdId)
    .eq("name", categoryName)
    .maybeSingle();
  if (categoryError) throw new Error(categoryError.message);
  if (!category) throw new Error("Catégorie introuvable.");

  if (!subcategoryName) {
    if (preciseTypeName) {
      throw new Error("Sélectionnez une sous-catégorie avant le type précis.");
    }
    return {
      categoryId: String(category.id),
      subcategoryId: null,
      preciseTypeId: null,
    };
  }

  const { data: subcategory, error: subcategoryError } = await supabase
    .from("subcategories")
    .select("id")
    .eq("household_id", householdId)
    .eq("category_id", category.id)
    .eq("name", subcategoryName)
    .maybeSingle();
  if (subcategoryError) throw new Error(subcategoryError.message);
  if (!subcategory) throw new Error("Sous-catégorie introuvable.");

  if (!preciseTypeName) {
    return {
      categoryId: String(category.id),
      subcategoryId: String(subcategory.id),
      preciseTypeId: null,
    };
  }

  const { data: preciseType, error: preciseTypeError } = await supabase
    .from("precise_types")
    .select("id")
    .eq("household_id", householdId)
    .eq("subcategory_id", subcategory.id)
    .eq("name", preciseTypeName)
    .maybeSingle();
  if (preciseTypeError) throw new Error(preciseTypeError.message);
  if (!preciseType) throw new Error("Type précis introuvable.");

  return {
    categoryId: String(category.id),
    subcategoryId: String(subcategory.id),
    preciseTypeId: String(preciseType.id),
  };
}

export async function updateOperation(
  operationId: string,
  input: OperationUpdateInput,
) {
  const date = validatedDate(input.date);
  const amount = Number(input.amount);
  if (!Number.isFinite(amount)) throw new Error("Montant invalide.");
  if (!flows.includes(input.flow)) throw new Error("Flux invalide.");
  if (input.recurrence && !recurrences.includes(input.recurrence)) {
    throw new Error("Nature invalide.");
  }
  if (input.importance && !importances.includes(input.importance)) {
    throw new Error("Importance invalide.");
  }
  if (!statuses.includes(input.status)) throw new Error("Statut invalide.");
  if (input.resourceType && !resourceTypes.includes(input.resourceType)) {
    throw new Error("Type de ressource invalide.");
  }
  if (amount <= 0 && input.analysisMonthOverride) {
    throw new Error("Le mois analytique manuel est réservé aux flux entrants.");
  }

  const supabase = await createClient();
  const householdId = await currentHouseholdId(supabase);
  const { categoryId, subcategoryId, preciseTypeId } =
    await resolveTaxonomyIds(supabase, householdId, input);
  const roundedAmount = Math.round((amount + Number.EPSILON) * 100) / 100;
  const analysisMonthOverride = validatedMonth(input.analysisMonthOverride);
  let reimbursesOperationId: string | null = null;

  if (input.reimbursesOperationId) {
    if (input.resourceType !== "Remboursement" || roundedAmount <= 0) {
      throw new Error("Seul un remboursement entrant peut être affecté.");
    }
    if (input.reimbursesOperationId === operationId) {
      throw new Error("Une opération ne peut pas se rembourser elle-même.");
    }
    const { data: reimbursedOperation, error: reimbursementError } =
      await supabase
        .from("operations")
        .select("id")
        .eq("id", input.reimbursesOperationId)
        .eq("household_id", householdId)
        .eq("flow", "Dépense")
        .lt("amount", 0)
        .maybeSingle();
    if (reimbursementError) throw new Error(reimbursementError.message);
    if (!reimbursedOperation) {
      throw new Error("Dépense remboursée introuvable.");
    }
    reimbursesOperationId = String(reimbursedOperation.id);
  }

  const { data, error } = await supabase
    .from("operations")
    .update({
      date,
      import_month: `${date.slice(0, 7)}-01`,
      amount: roundedAmount,
      debit: roundedAmount < 0 ? Math.abs(roundedAmount) : null,
      credit: roundedAmount > 0 ? roundedAmount : null,
      normalized_merchant: optionalText(input.normalizedMerchant),
      flow: input.flow,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      precise_type_id: preciseTypeId,
      recurrence: input.recurrence,
      importance: input.importance,
      analytical_status: input.status,
      note: optionalText(input.note),
      event: optionalText(input.event),
      event_detail: optionalText(input.eventDetail),
      resource_type: input.resourceType,
      resource_context: optionalText(input.resourceContext),
      analysis_month_override: analysisMonthOverride,
      reimburses_operation_id: reimbursesOperationId,
      uncertain: input.uncertain,
    })
    .eq("id", operationId)
    .eq("household_id", householdId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Opération introuvable ou non autorisée.");
}

export async function deleteOperation(operationId: string) {
  const supabase = await createClient();
  const householdId = await currentHouseholdId(supabase);
  const { count, error } = await supabase
    .from("operations")
    .delete({ count: "exact" })
    .eq("id", operationId)
    .eq("household_id", householdId);

  if (error) throw new Error(error.message);
  if (count !== 1) throw new Error("Opération introuvable ou non autorisée.");
}
