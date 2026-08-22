import type { ApiError } from "../../core/api";
import { resolveErrorPresentation } from "./error-presentation";
import { RetryAction } from "./retry-action";

export type ErrorStateProps = {
  readonly error: ApiError;
  readonly onRetry?: () => void;
  readonly showRequestId?: boolean;
};

export function ErrorState({
  error,
  onRetry,
  showRequestId = false,
}: ErrorStateProps) {
  const presentation = resolveErrorPresentation(error);
  return (
    <section data-ui-feedback="error" aria-labelledby="ui-error-title">
      <h2 id="ui-error-title">{presentation.title}</h2>
      <p>{presentation.description}</p>
      {showRequestId ? <small>Référence : {presentation.requestId}</small> : null}
      {presentation.retryAllowed && onRetry ? (
        <RetryAction onRetry={onRetry} />
      ) : null}
    </section>
  );
}
