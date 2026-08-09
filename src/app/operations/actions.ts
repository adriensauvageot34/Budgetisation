"use server";

import type {
  AnalyticalStatus,
  FlowType,
  Importance,
  LifeContext,
  MonthKey,
  Recurrence,
  ResourceType,
  SpendingContext,
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
  spendingContext: SpendingContext | null;
  lifeContext: LifeContext | null;
  momentId: string | null;
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
const spendingContexts: SpendingContext[] = ["Vie courante", "Événement"];
const lifeContexts: LifeContext[] = ["Vie courante", "Hors quotidien"];

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
  input: { category: string | null; subcategory: string | null; preciseType: string | null },
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
  if (
    input.spendingContext &&
    !spendingContexts.includes(input.spendingContext)
  ) {
    throw new Error("Contexte de dépense invalide.");
  }
  if (input.lifeContext && !lifeContexts.includes(input.lifeContext)) {
    throw new Error("Contexte de vie invalide.");
  }
  if (input.momentId && input.lifeContext === "Vie courante") {
    throw new Error("Une dépense rattachée à un moment est hors quotidien.");
  }
  if (input.spendingContext === "Événement" && !optionalText(input.event)) {
    throw new Error("Renseignez l’événement associé à cette dépense.");
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
  let momentId: string | null = null;
  if (input.momentId) {
    const { data: moment, error: momentError } = await supabase
      .from("moments")
      .select("id")
      .eq("household_id", householdId)
      .eq("id", input.momentId)
      .maybeSingle();
    if (momentError) throw new Error(momentError.message);
    if (!moment) throw new Error("Moment introuvable.");
    momentId = String(moment.id);
  }
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
      spending_context: input.spendingContext,
      life_context: input.lifeContext,
      moment_id: momentId,
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

export type MomentInput = {
  name: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
};

export async function createMoment(input: MomentInput) {
  const name = optionalText(input.name);
  const type = optionalText(input.type);
  if (!name || !type) throw new Error("Renseignez le nom et le type du moment.");
  const startDate = input.startDate ? validatedDate(input.startDate) : null;
  const endDate = input.endDate ? validatedDate(input.endDate) : null;
  if (startDate && endDate && endDate < startDate) {
    throw new Error("La date de fin doit suivre la date de début.");
  }
  const supabase = await createClient();
  const householdId = await currentHouseholdId(supabase);
  const slug = `${taxonomySlug(name)}-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase.from("moments").insert({
    household_id: householdId,
    slug,
    name,
    type,
    start_date: startDate,
    end_date: endDate,
    note: optionalText(input.note),
  }).select("id,slug,name,type,start_date,end_date,note,created_at").single();
  if (error) throw new Error(error.message);
  return {
    id: String(data.id), slug: String(data.slug), name: String(data.name), type: String(data.type),
    startDate: data.start_date ? String(data.start_date) : null,
    endDate: data.end_date ? String(data.end_date) : null,
    note: data.note ? String(data.note) : null,
    createdAt: String(data.created_at),
  };
}

export type OperationAllocationInput = {
  amount: number;
  lifeContext: LifeContext | null;
  momentId: string | null;
  category: string | null;
  subcategory: string | null;
  preciseType: string | null;
  importance: Importance | null;
  recurrence: Recurrence | null;
  status: AnalyticalStatus | null;
  note: string | null;
};

export async function createOperationAllocation(operationId: string, input: OperationAllocationInput) {
  const amountCents = Math.round(Number(input.amount) * 100);
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Montant de ventilation invalide.");
  if (input.lifeContext && !lifeContexts.includes(input.lifeContext)) throw new Error("Contexte de vie invalide.");
  if (input.momentId && input.lifeContext === "Vie courante") throw new Error("Un moment implique un contexte hors quotidien.");
  if (input.importance && !importances.includes(input.importance)) throw new Error("Importance invalide.");
  if (input.recurrence && !recurrences.includes(input.recurrence)) throw new Error("Nature invalide.");
  if (input.status && !statuses.includes(input.status)) throw new Error("Statut invalide.");

  const supabase = await createClient();
  const householdId = await currentHouseholdId(supabase);
  const { data: operation, error: operationError } = await supabase.from("operations")
    .select("id,amount").eq("id", operationId).eq("household_id", householdId).eq("flow", "Dépense").lt("amount", 0).maybeSingle();
  if (operationError) throw new Error(operationError.message);
  if (!operation) throw new Error("Dépense introuvable.");

  const [{ data: refunds, error: refundError }, { data: existing, error: allocationsError }] = await Promise.all([
    supabase.from("operations").select("amount").eq("household_id", householdId).eq("reimburses_operation_id", operationId),
    supabase.from("operation_allocations").select("amount").eq("household_id", householdId).eq("operation_id", operationId),
  ]);
  if (refundError) throw new Error(refundError.message);
  if (allocationsError) throw new Error(allocationsError.message);
  const availableCents = Math.max(0, Math.round(Math.abs(Number(operation.amount)) * 100) - (refunds ?? []).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0));
  const allocatedCents = (existing ?? []).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
  if (allocatedCents + amountCents > availableCents) throw new Error("La ventilation dépasse le coût net disponible.");

  if (input.momentId) {
    const { data: moment, error } = await supabase.from("moments").select("id").eq("household_id", householdId).eq("id", input.momentId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!moment) throw new Error("Moment introuvable.");
  }
  const taxonomy = await resolveTaxonomyIds(supabase, householdId, input);
  const { data, error } = await supabase.from("operation_allocations").insert({
    household_id: householdId,
    operation_id: operationId,
    amount: amountCents / 100,
    life_context: input.lifeContext,
    moment_id: input.momentId,
    category_id: taxonomy.categoryId,
    subcategory_id: taxonomy.subcategoryId,
    precise_type_id: taxonomy.preciseTypeId,
    importance: input.importance,
    recurrence: input.recurrence,
    analytical_status: input.status,
    note: optionalText(input.note),
  }).select("id,created_at").single();
  if (error) throw new Error(error.message);
  return { id: String(data.id), createdAt: String(data.created_at) };
}

export async function deleteOperationAllocation(allocationId: string) {
  const supabase = await createClient();
  const householdId = await currentHouseholdId(supabase);
  const { count, error } = await supabase.from("operation_allocations").delete({ count: "exact" })
    .eq("id", allocationId).eq("household_id", householdId);
  if (error) throw new Error(error.message);
  if (count !== 1) throw new Error("Ventilation introuvable.");
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

export async function linkRefundOperation(
  refundOperationId: string,
  expenseOperationId: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("link_refund_operation", {
    refund_operation_id: refundOperationId,
    expense_operation_id: expenseOperationId,
  });
  return error
    ? { ok: false as const, error: error.message }
    : { ok: true as const };
}

function taxonomySlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "categorie";
}

export async function createTaxonomySubcategory(
  familyName: string,
  subcategoryName: string,
) {
  const family = optionalText(familyName);
  const subcategory = optionalText(subcategoryName);
  if (!family || !subcategory) {
    throw new Error("Renseignez la famille et la nouvelle catégorie.");
  }
  const supabase = await createClient();
  const householdId = await currentHouseholdId(supabase);
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("household_id", householdId)
    .eq("name", family)
    .maybeSingle();
  if (categoryError) throw new Error(categoryError.message);
  if (!category) throw new Error("Famille de dépense introuvable.");

  const { data: existing, error: existingError } = await supabase
    .from("subcategories")
    .select("name")
    .eq("category_id", category.id)
    .eq("name", subcategory)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return String(existing.name);

  const slug = `${taxonomySlug(subcategory)}-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase
    .from("subcategories")
    .insert({
      household_id: householdId,
      category_id: category.id,
      name: subcategory,
      slug,
    })
    .select("name")
    .single();
  if (error) throw new Error(error.message);
  return String(data.name);
}

