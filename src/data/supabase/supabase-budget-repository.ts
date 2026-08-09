import { redirect } from "next/navigation";
import type { BudgetRepository } from "@/data/budget-repository";
import type {
  Account,
  AnalyticalStatus,
  CategoryDefinition,
  FlowType,
  Importance,
  ImportBatch,
  LifeContext,
  MonthKey,
  Moment,
  Operation,
  OperationAllocation,
  Recurrence,
  ResourceType,
  SpendingContext,
} from "@/domain/budget";
import { applyInflowAnalysis } from "@/domain/inflow-analysis";
import { createClient } from "@/lib/supabase/server";

const categoryColors = [
  "#52766f",
  "#d69a3c",
  "#d36e53",
  "#806da5",
  "#5b8eaa",
  "#b65f82",
  "#61a184",
  "#8d918a",
];

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type Snapshot = {
  months: MonthKey[];
  operations: Operation[];
  accounts: Account[];
  categories: CategoryDefinition[];
  batches: ImportBatch[];
  moments: Moment[];
  allocations: OperationAllocation[];
};

type AccountRelation = { id?: unknown };
type MemberRelation = { display_name?: unknown };
type CategoryRelation = { name?: unknown };
type NamedRelation = { name?: unknown };
type ImportBatchRelation = { id?: unknown };

function related<T extends object>(value: unknown): T | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === "object" ? (candidate as T) : null;
}

function monthKey(value: unknown): MonthKey | null {
  return typeof value === "string" && value.length >= 7
    ? value.slice(0, 7)
    : null;
}

function checkResult<T>(
  result: { data: T | null; error: { message: string } | null },
  label: string,
): T {
  if (result.error) {
    throw new Error(`${label} : ${result.error.message}`);
  }
  return result.data ?? ([] as T);
}

function isMissingSchemaError(error: unknown, names: string[]) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(code) &&
    names.some((name) => message.includes(name.toLowerCase()));
}

class SupabaseBudgetRepository implements BudgetRepository {
  private snapshotPromise: Promise<Snapshot> | null = null;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly householdId: string,
  ) {}

  private snapshot() {
    if (!this.snapshotPromise) {
      this.snapshotPromise = this.loadSnapshot();
    }
    return this.snapshotPromise;
  }

  private async loadAllOperations() {
    const fields = [
            "id",
            "date",
            "import_month",
            "amount",
            "source_label",
            "normalized_merchant",
            "flow",
            "recurrence",
            "importance",
            "analytical_status",
            "note",
            "event",
            "event_detail",
            "spending_context",
            "life_context",
            "moment_id",
            "resource_type",
            "resource_context",
            "analysis_month_override",
            "reimburses_operation_id",
            "uncertain",
            "fingerprint",
            "source_metadata",
            "account:accounts!operations_account_id_fkey(id,name)",
            "person:household_members!operations_person_member_id_fkey(display_name)",
            "category:categories!operations_category_id_fkey(name,slug,color,included_in_consumption)",
            "subcategory:subcategories!operations_subcategory_id_fkey(name)",
            "precise_type:precise_types!operations_precise_type_id_fkey(name)",
            "import_batch:import_batches!operations_import_batch_id_fkey(id)",
    ];

    const load = async (selectedFields: string[]) => {
      const pageSize = 1000;
      const operationRows: Array<Record<string, unknown>> = [];
      for (let from = 0; ; from += pageSize) {
        const operationsResult = await this.supabase
          .from("operations")
          .select(selectedFields.join(","))
          .eq("household_id", this.householdId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        const operationBatch = checkResult(
          operationsResult as {
            data: Array<Record<string, unknown>> | null;
            error: { message: string } | null;
          },
          "Lecture des opérations impossible",
        );
        operationRows.push(...operationBatch);
        if (operationBatch.length < pageSize) return operationRows;
      }
    };

    let selectedFields = fields;
    const optionalFields = ["life_context", "moment_id", "spending_context"];
    for (let attempt = 0; attempt <= optionalFields.length; attempt += 1) {
      try {
        return await load(selectedFields);
      } catch (caught) {
        const missingField = caught instanceof Error
          ? optionalFields.find((field) => caught.message.toLowerCase().includes(field))
          : undefined;
        if (missingField && selectedFields.includes(missingField)) {
          selectedFields = selectedFields.filter((field) => field !== missingField);
          continue;
        }
        throw caught;
      }
    }
    return load(selectedFields);
  }

  private async loadOptionalTable(table: "moments" | "operation_allocations", fields: string) {
    const result = await this.supabase
      .from(table)
      .select(fields)
      .eq("household_id", this.householdId)
      .order("created_at", { ascending: true });
    if (result.error) {
      if (isMissingSchemaError(result.error, [table])) return [];
      throw new Error(`Lecture de ${table} impossible : ${result.error.message}`);
    }
    return (result.data ?? []) as unknown as Array<Record<string, unknown>>;
  }

  private async loadSnapshot(): Promise<Snapshot> {
    const [operationRows, categoriesResult, accountsResult, batchesResult, momentRows, allocationRows] =
      await Promise.all([
        this.loadAllOperations(),
        this.supabase
          .from("categories")
          .select(
            "name,slug,color,included_in_consumption,subcategories(name,precise_types(name))",
          )
          .eq("household_id", this.householdId)
          .order("name"),
        this.supabase
          .from("accounts")
          .select(
            "id,name,kind,color,owner:household_members!accounts_owner_member_id_fkey(display_name)",
          )
          .eq("household_id", this.householdId)
          .order("name"),
        this.supabase
          .from("import_batches")
          .select(
            "id,imported_at,month_start,month_end,status,row_count,warning_count,filename",
          )
          .eq("household_id", this.householdId)
          .order("imported_at", { ascending: false }),
        this.loadOptionalTable(
          "moments",
          "id,slug,name,type,start_date,end_date,note,created_at",
        ),
        this.loadOptionalTable(
          "operation_allocations",
          "id,operation_id,amount,life_context,moment_id,importance,recurrence,analytical_status,note,created_at,category:categories!operation_allocations_category_id_fkey(name),subcategory:subcategories!operation_allocations_subcategory_id_fkey(name),precise_type:precise_types!operation_allocations_precise_type_id_fkey(name)",
        ),
      ]);

    const categoryRows = checkResult(
      categoriesResult as { data: Array<Record<string, unknown>> | null; error: { message: string } | null },
      "Lecture de la taxonomie impossible",
    );
    const accountRows = checkResult(
      accountsResult as { data: Array<Record<string, unknown>> | null; error: { message: string } | null },
      "Lecture des comptes impossible",
    );
    const batchRows = checkResult(
      batchesResult as { data: Array<Record<string, unknown>> | null; error: { message: string } | null },
      "Lecture des imports impossible",
    );

    const categories = categoryRows.map((row, index) => {
      const subcategoryRows = Array.isArray(row.subcategories)
        ? row.subcategories.filter(
            (subcategory): subcategory is Record<string, unknown> =>
              typeof subcategory === "object" && subcategory !== null,
          )
        : [];
      const subcategories = subcategoryRows
        .map((subcategory) => String(subcategory.name ?? ""))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "fr"));
      const preciseTypesBySubcategory = Object.fromEntries(
        subcategoryRows.map((subcategory) => {
          const subcategoryName = String(subcategory.name ?? "");
          const preciseTypes = Array.isArray(subcategory.precise_types)
            ? subcategory.precise_types
                .map((preciseType) =>
                  typeof preciseType === "object" && preciseType
                    ? String(
                        (preciseType as Record<string, unknown>).name ?? "",
                      )
                    : "",
                )
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, "fr"))
            : [];
          return [subcategoryName, preciseTypes];
        }),
      );
      return {
        name: String(row.name),
        slug: String(row.slug),
        color:
          typeof row.color === "string"
            ? row.color
            : categoryColors[index % categoryColors.length],
        subcategories,
        preciseTypesBySubcategory,
        includedInConsumption: Boolean(row.included_in_consumption),
      };
    });

    const operations = applyInflowAnalysis(operationRows.map((row) => {
      const account = related<AccountRelation>(row.account);
      const person = related<MemberRelation>(row.person);
      const category = related<CategoryRelation>(row.category);
      const subcategory = related<NamedRelation>(row.subcategory);
      const preciseType = related<NamedRelation>(row.precise_type);
      const importBatch = related<ImportBatchRelation>(row.import_batch);
      const fallbackCategory = "Non renseigné";

      return {
        id: String(row.id),
        date: String(row.date),
        importMonth: monthKey(row.import_month) ?? "",
        label:
          typeof row.normalized_merchant === "string"
            ? row.normalized_merchant
            : String(row.source_label),
        normalizedMerchant:
          typeof row.normalized_merchant === "string"
            ? row.normalized_merchant
            : "Non renseigné",
        amount: Number(row.amount),
        person:
          person && typeof person.display_name === "string"
            ? person.display_name
            : null,
        accountId:
          account && typeof account.id === "string" ? account.id : null,
        flow: String(row.flow) as FlowType,
        category:
          category && typeof category.name === "string"
            ? category.name
            : fallbackCategory,
        subcategory:
          subcategory && typeof subcategory.name === "string"
            ? subcategory.name
            : "Non renseigné",
        preciseType:
          preciseType && typeof preciseType.name === "string"
            ? preciseType.name
            : null,
        importance:
          typeof row.importance === "string"
            ? (row.importance as Importance)
            : null,
        recurrence:
          typeof row.recurrence === "string"
            ? (row.recurrence as Recurrence)
            : null,
        status: String(row.analytical_status) as AnalyticalStatus,
        sourceLabel: String(row.source_label),
        importId:
          importBatch && typeof importBatch.id === "string"
            ? importBatch.id
            : "Non renseigné",
        note: typeof row.note === "string" ? row.note : null,
        event: typeof row.event === "string" ? row.event : null,
        eventDetail:
          typeof row.event_detail === "string" ? row.event_detail : null,
        spendingContext:
          typeof row.spending_context === "string"
            ? (row.spending_context as SpendingContext)
            : null,
        lifeContext:
          typeof row.life_context === "string"
            ? (row.life_context as LifeContext)
            : null,
        momentId: typeof row.moment_id === "string" ? row.moment_id : null,
        resourceType:
          typeof row.resource_type === "string"
            ? (row.resource_type as ResourceType)
            : null,
        resourceContext:
          typeof row.resource_context === "string" ? row.resource_context : null,
        analysisMonthOverride: monthKey(row.analysis_month_override),
        reimbursesOperationId:
          typeof row.reimburses_operation_id === "string"
            ? row.reimburses_operation_id
            : null,
        uncertain: Boolean(row.uncertain),
        fingerprint: String(row.fingerprint),
        sourceMetadata:
          row.source_metadata && typeof row.source_metadata === "object"
            ? (row.source_metadata as Record<string, unknown>)
            : {},
      } satisfies Operation;
    }));

    const accounts = accountRows.map((row) => {
      const owner = related<MemberRelation>(row.owner);
      return {
        id: String(row.id),
        name: String(row.name),
        owner:
          owner && typeof owner.display_name === "string"
            ? owner.display_name
            : null,
        kind: typeof row.kind === "string" ? row.kind : null,
        color: typeof row.color === "string" ? row.color : null,
      };
    });

    const batches = batchRows.map((row) => {
      const firstMonth = monthKey(row.month_start);
      const lastMonth = monthKey(row.month_end);
      const warnings = Number(row.warning_count);
      return {
        id: String(row.id),
        importedAt: String(row.imported_at),
        month: firstMonth === lastMonth ? firstMonth : lastMonth,
        firstMonth,
        lastMonth,
        status:
          String(row.status) === "processing"
            ? "À contrôler"
            : warnings > 0
              ? "Importé avec avertissements"
              : "Terminé",
        rows: Number(row.row_count),
        warnings,
        filename: String(row.filename),
      } satisfies ImportBatch;
    });

    const months = [
      ...new Set(
        operations
          .flatMap((operation) => [
            operation.importMonth,
            operation.analysisMonth ?? operation.importMonth,
          ])
          .filter((month) => Boolean(month)),
      ),
    ].sort();

    const moments = momentRows.map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      type: String(row.type),
      startDate: typeof row.start_date === "string" ? row.start_date : null,
      endDate: typeof row.end_date === "string" ? row.end_date : null,
      note: typeof row.note === "string" ? row.note : null,
      createdAt: String(row.created_at),
    } satisfies Moment));

    const allocations = allocationRows.map((row) => {
      const category = related<NamedRelation>(row.category);
      const subcategory = related<NamedRelation>(row.subcategory);
      const preciseType = related<NamedRelation>(row.precise_type);
      return {
        id: String(row.id),
        operationId: String(row.operation_id),
        amount: Number(row.amount),
        lifeContext: typeof row.life_context === "string" ? row.life_context as LifeContext : null,
        momentId: typeof row.moment_id === "string" ? row.moment_id : null,
        category: category && typeof category.name === "string" ? category.name : null,
        subcategory: subcategory && typeof subcategory.name === "string" ? subcategory.name : null,
        preciseType: preciseType && typeof preciseType.name === "string" ? preciseType.name : null,
        importance: typeof row.importance === "string" ? row.importance as Importance : null,
        recurrence: typeof row.recurrence === "string" ? row.recurrence as Recurrence : null,
        status: typeof row.analytical_status === "string" ? row.analytical_status as AnalyticalStatus : null,
        note: typeof row.note === "string" ? row.note : null,
        createdAt: String(row.created_at),
      } satisfies OperationAllocation;
    });

    return { months, operations, accounts, categories, batches, moments, allocations };
  }

  async getMonths() {
    return (await this.snapshot()).months;
  }

  async getOperations() {
    return (await this.snapshot()).operations;
  }

  async getOperationsByMonth(month: MonthKey) {
    return (await this.getOperations()).filter(
      (operation) => operation.importMonth === month,
    );
  }

  async getAccounts() {
    return (await this.snapshot()).accounts;
  }

  async getCategories() {
    return (await this.snapshot()).categories;
  }

  async getImportBatches() {
    return (await this.snapshot()).batches;
  }

  async getMoments() {
    return (await this.snapshot()).moments;
  }

  async getOperationAllocations() {
    return (await this.snapshot()).allocations;
  }
}

export async function getBudgetRepository(): Promise<BudgetRepository> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId =
    typeof data?.claims?.sub === "string" ? data.claims.sub : undefined;

  if (!userId) {
    redirect("/connexion");
  }

  const { data: membership, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Lecture du foyer impossible : ${error.message}`);
  }
  if (!membership?.household_id) {
    redirect("/acces-refuse");
  }

  return new SupabaseBudgetRepository(supabase, membership.household_id);
}
