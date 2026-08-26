import type {
  CategoryId,
  MerchantId,
  OperationId,
  PlaceId,
  SubcategoryId,
} from "../../core/identity";
import type { MoneyMetricEnvelope, ReadModelSubject } from "../read-models";
import type { LocalDate } from "../../core/time";
import type { QueryCapabilities } from "../capabilities";
import type { CursorPage } from "../collections";
import type { NormalizedOperationsBrowseParams } from "../request/operations-params";

export type OperationReference<Id extends string> = {
  readonly id: Id;
  readonly label: string;
};

export type OperationsFilterCapability =
  | "category"
  | "subcategory"
  | "merchant"
  | "place"
  | "account"
  | "precise_type"
  | "necessity"
  | "fixed_variable"
  | "life_scope"
  | "quality"
  | "economic_amount";

export type OperationRowReadModel = {
  readonly operationId: OperationId;
  readonly bankDate: LocalDate;
  readonly bankLabel: string;
  readonly merchant?: OperationReference<MerchantId>;
  readonly account?: { readonly id: string; readonly label: string };
  readonly bankAmount: MoneyMetricEnvelope;
  readonly economicNet: MoneyMetricEnvelope;
  readonly economicTiming:
    | { readonly availability: "known"; readonly date: LocalDate }
    | { readonly availability: "unknown" };
  readonly category?: OperationReference<CategoryId>;
  readonly subcategory?: OperationReference<SubcategoryId>;
  readonly preciseType?: string;
  readonly necessity?: "Indispensable" | "Contraint" | "Ajustable" | "Optionnel";
  readonly fixedVariable?: "fixed" | "variable" | "unknown";
  readonly lifeScope?: "Vie courante" | "Hors quotidien";
  readonly canonicalPlace?: OperationReference<PlaceId>;
  readonly quality: "complete" | "partial" | "conflict" | "unknown";
};

export type OperationsBrowseReadModel = {
  readonly subject: ReadModelSubject;
  readonly page: CursorPage<OperationRowReadModel>;
  readonly appliedQuery: NormalizedOperationsBrowseParams;
  readonly capabilities: QueryCapabilities;
  readonly filterCapabilities: readonly OperationsFilterCapability[];
};
