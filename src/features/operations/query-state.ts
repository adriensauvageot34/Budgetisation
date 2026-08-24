import type { OperationsBrowseReadModel } from "@/query-api";
import type { UiTransportState } from "@/ui";

export function operationDisplayModel(
  state: UiTransportState<OperationsBrowseReadModel>,
): OperationsBrowseReadModel | undefined {
  return state.status === "success"
    ? state.response.data
    : state.status === "error"
      ? state.previousData?.data
      : undefined;
}

export function operationQueryHasLocalError(
  state: UiTransportState<OperationsBrowseReadModel>,
): boolean {
  return state.status === "error" && operationDisplayModel(state) === undefined;
}
