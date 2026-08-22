import "server-only";

import type { ApiMeta } from "../../core/api";
import type { QueryRevisionSnapshot } from "./types";
import { QueryTemporaryUnavailableError } from "./errors";

export function assertQueryRevisionCoherence(snapshot: QueryRevisionSnapshot): void {
  const ids = new Set<string>();
  for (const dependency of snapshot.dependencies) {
    if (dependency.dependencyId.trim().length === 0 || ids.has(dependency.dependencyId)) {
      throw new QueryTemporaryUnavailableError("Les dépendances de révision sont invalides.");
    }
    ids.add(dependency.dependencyId);
    if (
      dependency.status !== "fresh" ||
      dependency.dataRevision !== snapshot.dataRevision ||
      dependency.analyticsRevision !== snapshot.analyticsRevision
    ) {
      throw new QueryTemporaryUnavailableError();
    }
  }
}

export function assertPageRevisionCompatible(
  current: ApiMeta,
  next: ApiMeta,
): void {
  if (
    current.dataRevision !== next.dataRevision ||
    current.analyticsRevision !== next.analyticsRevision ||
    current.contractVersion !== next.contractVersion
  ) {
    throw new QueryTemporaryUnavailableError(
      "Des pages issues de révisions différentes ne peuvent pas être fusionnées.",
    );
  }
}
