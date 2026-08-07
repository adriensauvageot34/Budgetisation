import { redirect } from "next/navigation";
import type { BudgetRepository } from "@/data/budget-repository";
import type {
  Account,
  AnalyticalStatus,
  CategoryDefinition,
  FlowType,
  Importance,
  ImportBatch,
  MonthKey,
  Operation,
  Recurrence,
} from "@/domain/budget";
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
};

function related<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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

  private async loadSnapshot(): Promise<Snapshot> {
    const [operationsResult, categoriesResult, accountsResult, batchesResult] =
      await Promise.all([
        this.supabase
          .from("operations")
          .select(
            [
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
              "uncertain",
              "fingerprint",
              "source_metadata",
              "account:accounts!operations_account_id_fkey(id,name)",
              "person:household_members!operations_person_member_id_fkey(display_name)",
              "category:categories!operations_category_id_fkey(name,slug,color,included_in_consumption)",
              "subcategory:subcategories!operations_subcategory_id_fkey(name)",
              "precise_type:precise_types!operations_precise_type_id_fkey(name)",
              "import_batch:import_batches!operations_import_batch_id_fkey(id)",
            ].join(","),
          )
          .eq("household_id", this.householdId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        this.supabase
          .from("categories")
          .select("name,slug,color,included_in_consumption,subcategories(name)")
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
      ]);

    const operationRows = checkResult(
      operationsResult as { data: Array<Record<string, unknown>> | null; error: { message: string } | null },
      "Lecture des opérations impossible",
    );
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
      const subcategories = Array.isArray(row.subcategories)
        ? row.subcategories
            .map((subcategory) =>
              typeof subcategory === "object" && subcategory
                ? String((subcategory as Record<string, unknown>).name ?? "")
                : "",
            )
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, "fr"))
        : [];
      return {
        name: String(row.name),
        slug: String(row.slug),
        color:
          typeof row.color === "string"
            ? row.color
            : categoryColors[index % categoryColors.length],
        subcategories,
        includedInConsumption: Boolean(row.included_in_consumption),
      };
    });

    const operations = operationRows.map((row) => {
      const account = related(row.account as Record<string, unknown> | null);
      const person = related(row.person as Record<string, unknown> | null);
      const category = related(row.category as Record<string, unknown> | null);
      const subcategory = related(
        row.subcategory as Record<string, unknown> | null,
      );
      const preciseType = related(
        row.precise_type as Record<string, unknown> | null,
      );
      const importBatch = related(
        row.import_batch as Record<string, unknown> | null,
      );
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
        uncertain: Boolean(row.uncertain),
        fingerprint: String(row.fingerprint),
        sourceMetadata:
          row.source_metadata && typeof row.source_metadata === "object"
            ? (row.source_metadata as Record<string, unknown>)
            : {},
      } satisfies Operation;
    });

    const accounts = accountRows.map((row) => {
      const owner = related(row.owner as Record<string, unknown> | null);
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
          .map((operation) => operation.importMonth)
          .filter((month) => Boolean(month)),
      ),
    ].sort();

    return { months, operations, accounts, categories, batches };
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
