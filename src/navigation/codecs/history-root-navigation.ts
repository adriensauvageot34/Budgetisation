import {
  parsePersonId,
} from "../../core/identity";
import {
  parseGlobalWindow,
  parseLocalDate,
  parseYearMonth,
} from "../../core/time";
import {
  validationFailure,
  withValidationPath,
} from "../../core/validation";
import {
  operationsNavigationFiltersSchema,
  type OperationsNavigationFilters,
} from "../contracts/operations";
import {
  historyRootContextSchema,
  parseCalendarWeekRef,
  type HistoryRootContext,
  rootNavigationContextSchema,
  type RootNavigationContext,
} from "../contracts/routes";

const relativeUrlBase = "https://budgetisation.invalid";
const defaultGlobalWindow = "last_12_months" as const;
const analysisFilterKeys = [
  "categoryIds",
  "activityIds",
  "merchantIds",
  "placeIds",
  "lifeScopeContext",
  "dayContext",
] as const;

function rejectUrl(message: string, path: readonly string[] = []): never {
  validationFailure({
    path,
    code: "invalid_navigation_url",
    message,
  });
}

function parseRelativeUrl(value: unknown): URL {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("#")
  ) {
    rejectUrl("La navigation doit être une URL relative sans fragment.");
  }

  const url = new URL(value, relativeUrlBase);
  if (url.origin !== relativeUrlBase) {
    rejectUrl("La navigation doit rester sur l'origine applicative.");
  }

  return url;
}

function readSearchParams(
  url: URL,
  allowedKeys: readonly string[],
): ReadonlyMap<string, string> {
  const allowed = new Set(allowedKeys);
  const values = new Map<string, string>();

  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) {
      rejectUrl(`Le paramètre ${key} n'est pas autorisé.`, ["searchParams", key]);
    }
  }

  for (const key of allowedKeys) {
    const candidates = url.searchParams.getAll(key);
    if (candidates.length > 1) {
      rejectUrl(`Le paramètre ${key} ne peut apparaître qu'une fois.`, [
        "searchParams",
        key,
      ]);
    }
    if (candidates.length === 1) values.set(key, candidates[0]);
  }

  return values;
}

function assertAllowedSearchParams(
  url: URL,
  allowedKeys: readonly string[],
): void {
  const allowed = new Set(allowedKeys);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) {
      rejectUrl(`Le paramètre ${key} n'est pas autorisé.`, ["searchParams", key]);
    }
  }
}

function readOptionalSingleSearchParam(
  url: URL,
  key: string,
): string | undefined {
  const candidates = url.searchParams.getAll(key);
  if (candidates.length > 1) {
    rejectUrl(`Le paramètre ${key} ne peut apparaître qu'une fois.`, [
      "searchParams",
      key,
    ]);
  }
  return candidates[0];
}

function analysisFiltersFromUrl(url: URL) {
  const filters = Object.fromEntries(
    analysisFilterKeys.map((key) => [key, url.searchParams.getAll(key)]),
  ) as Record<(typeof analysisFilterKeys)[number], string[]>;
  return analysisFilterKeys.some((key) => filters[key].length > 0) ? filters : undefined;
}

function parseOperationsNavigation(url: URL): RootNavigationContext {
  const allowedKeys = [
    "month",
    "startDate",
    "endExclusive",
    "timeKind",
    "globalWindow",
    "asOf",
    "personId",
    "categoryIds",
    "subcategoryIds",
    "activityIds",
    "momentIds",
    "lifeEventIds",
    "merchantIds",
    "placeIds",
    "accountIds",
    "preciseTypes",
    "necessity",
    "fixedVariable",
    "lifeScope",
    "dayContext",
    "quality",
    "amountMin",
    "amountMax",
    "search",
    "sort",
    "mode",
    "cursor",
    "cursorTrail",
  ] as const;
  assertAllowedSearchParams(url, allowedKeys);

  const month = readOptionalSingleSearchParam(url, "month");
  const startDate = readOptionalSingleSearchParam(url, "startDate");
  const endExclusive = readOptionalSingleSearchParam(url, "endExclusive");
  const timeKind = readOptionalSingleSearchParam(url, "timeKind");
  const globalWindow = readOptionalSingleSearchParam(url, "globalWindow");
  const asOf = readOptionalSingleSearchParam(url, "asOf");
  const rawPersonId = readOptionalSingleSearchParam(url, "personId");
  const personId = rawPersonId === "household" ? undefined : rawPersonId;
  const categoryIds = url.searchParams.getAll("categoryIds");
  const subcategoryIds = url.searchParams.getAll("subcategoryIds");
  const activityIds = url.searchParams.getAll("activityIds");
  const momentIds = url.searchParams.getAll("momentIds");
  const lifeEventIds = url.searchParams.getAll("lifeEventIds");
  const merchantIds = url.searchParams.getAll("merchantIds");
  const placeIds = url.searchParams.getAll("placeIds");
  const accountIds = url.searchParams.getAll("accountIds");
  const preciseTypes = url.searchParams.getAll("preciseTypes");
  const necessity = url.searchParams.getAll("necessity");
  const fixedVariable = url.searchParams.getAll("fixedVariable");
  const lifeScope = url.searchParams.getAll("lifeScope");
  const dayContext = url.searchParams.getAll("dayContext");
  const quality = url.searchParams.getAll("quality");
  const amountMin = readOptionalSingleSearchParam(url, "amountMin");
  const amountMax = readOptionalSingleSearchParam(url, "amountMax");
  const rawSearch = readOptionalSingleSearchParam(url, "search");
  const search = rawSearch === "" ? undefined : rawSearch;
  const sort = readOptionalSingleSearchParam(url, "sort");
  const mode = readOptionalSingleSearchParam(url, "mode");
  const cursor = readOptionalSingleSearchParam(url, "cursor");
  const cursorTrail = url.searchParams.getAll("cursorTrail");

  return {
    kind: "operations",
    filters: operationsNavigationFiltersSchema.parse({
      ...(timeKind === undefined ? {} : { timeKind }),
      ...(month === undefined ? {} : { month }),
      ...(startDate === undefined ? {} : { startDate }),
      ...(endExclusive === undefined ? {} : { endExclusive }),
      ...(globalWindow === undefined ? {} : { globalWindow }),
      ...(asOf === undefined ? {} : { asOf }),
      ...(personId === undefined ? {} : { personId }),
      ...(categoryIds.length === 0 ? {} : { categoryIds }),
      ...(subcategoryIds.length === 0 ? {} : { subcategoryIds }),
      ...(activityIds.length === 0 ? {} : { activityIds }),
      ...(momentIds.length === 0 ? {} : { momentIds }),
      ...(lifeEventIds.length === 0 ? {} : { lifeEventIds }),
      ...(merchantIds.length === 0 ? {} : { merchantIds }),
      ...(placeIds.length === 0 ? {} : { placeIds }),
      ...(accountIds.length === 0 ? {} : { accountIds }),
      ...(preciseTypes.length === 0 ? {} : { preciseTypes }),
      ...(necessity.length === 0 ? {} : { necessity }),
      ...(fixedVariable.length === 0 ? {} : { fixedVariable }),
      ...(lifeScope.length === 0 ? {} : { lifeScope }),
      ...(dayContext.length === 0 ? {} : { dayContext }),
      ...(quality.length === 0 ? {} : { quality }),
      ...(amountMin === undefined ? {} : { amountMin }),
      ...(amountMax === undefined ? {} : { amountMax }),
      ...(search === undefined ? {} : { search }),
      ...(sort === undefined ? {} : { sort }),
      ...(mode === undefined ? {} : { mode }),
      ...(cursor === undefined ? {} : { cursor }),
      ...(cursorTrail.length === 0 ? {} : { cursorTrail }),
    }),
  };
}

function parseHistoryRootNavigation(url: URL): HistoryRootContext {
  const segments = url.pathname.split("/");

  if (
    segments.length >= 3 &&
    segments[0] === "" &&
    segments[1] === "historique" &&
    segments[2] === "calendrier"
  ) {
    if (segments.length === 3) {
      const searchParams = readSearchParams(url, ["personId"]);
      const rawPersonId = searchParams.get("personId");
      return {
        area: "calendar",
        context: {
          kind: "calendar_overview",
          ...(rawPersonId === undefined || rawPersonId === ""
            ? {}
            : { personId: withValidationPath("personId", () => parsePersonId(rawPersonId)) }),
        },
      };
    }

    if (segments.length === 4) {
      const searchParams = readSearchParams(url, ["day", "personId"]);
      const month = withValidationPath("month", () =>
        parseYearMonth(segments[3]),
      );
      const dayValue = searchParams.get("day");
      const day =
        dayValue === undefined
          ? undefined
          : withValidationPath("day", () => parseLocalDate(dayValue));
      const rawPersonId = searchParams.get("personId");

      return historyRootContextSchema.parse({
        area: "calendar",
        context: {
          kind: "calendar_month",
          month,
          ...(day === undefined ? {} : { day }),
          ...(rawPersonId === undefined || rawPersonId === ""
            ? {}
            : { personId: withValidationPath("personId", () => parsePersonId(rawPersonId)) }),
        },
      });
    }

    if (segments.length === 5) {
      const searchParams = readSearchParams(url, ["personId"]);
      const rawPersonId = searchParams.get("personId");
      return {
        area: "calendar",
        context: {
          kind: "calendar_week",
          month: withValidationPath("month", () =>
            parseYearMonth(segments[3]),
          ),
          week: withValidationPath("week", () =>
            parseCalendarWeekRef(segments[4]),
          ),
          ...(rawPersonId === undefined || rawPersonId === ""
            ? {}
            : { personId: withValidationPath("personId", () => parsePersonId(rawPersonId)) }),
        },
      };
    }
  }

  if (
    segments.length === 4 &&
    segments[0] === "" &&
    segments[1] === "historique" &&
    segments[2] === "analyse"
  ) {
    if (segments[3] === "global") {
      assertAllowedSearchParams(url, ["window", "asOf", "personId", ...analysisFilterKeys]);
      const windowValue = readOptionalSingleSearchParam(url, "window") ?? defaultGlobalWindow;
      const asOfValue = readOptionalSingleSearchParam(url, "asOf");
      const rawPersonId = readOptionalSingleSearchParam(url, "personId");
      const personId = rawPersonId === undefined || rawPersonId === ""
        ? undefined
        : withValidationPath("personId", () => parsePersonId(rawPersonId));
      return {
        area: "analysis",
        context: {
          kind: "analysis_global",
          observationWindow: withValidationPath("window", () =>
            parseGlobalWindow(windowValue),
          ),
          ...(asOfValue === undefined
            ? {}
            : {
                asOf: withValidationPath("asOf", () =>
                  parseYearMonth(asOfValue),
                ),
              }),
          ...(personId === undefined
            ? {}
            : { personId }),
          ...(analysisFiltersFromUrl(url) === undefined ? {} : { filters: analysisFiltersFromUrl(url) as never }),
        },
      };
    }

    assertAllowedSearchParams(url, ["personId", ...analysisFilterKeys]);
    const rawPersonId = readOptionalSingleSearchParam(url, "personId");
    const personId = rawPersonId === undefined || rawPersonId === ""
      ? undefined
      : withValidationPath("personId", () => parsePersonId(rawPersonId));
    return {
      area: "analysis",
      context: {
        kind: "analysis_month",
        month: withValidationPath("month", () =>
          parseYearMonth(segments[3]),
        ),
        ...(personId === undefined ? {} : { personId }),
        ...(analysisFiltersFromUrl(url) === undefined ? {} : { filters: analysisFiltersFromUrl(url) as never }),
      },
    };
  }

  rejectUrl("La route Historique n'est pas reconnue.", ["pathname"]);
}

function serializeHistoryRootNavigation(
  value: HistoryRootContext,
): string {
  const route = historyRootContextSchema.parse(value);

  if (route.area === "calendar") {
    if (route.context.kind === "calendar_overview") {
      return route.context.personId === undefined
        ? "/historique/calendrier"
        : `/historique/calendrier?${new URLSearchParams({ personId: route.context.personId }).toString()}`;
    }

    const root = `/historique/calendrier/${route.context.month}`;
    if (route.context.kind === "calendar_week") {
      if (route.context.personId === undefined) return `${root}/${route.context.week}`;
      return `${root}/${route.context.week}?${new URLSearchParams({ personId: route.context.personId }).toString()}`;
    }

    if (route.context.day === undefined && route.context.personId === undefined) return root;
    const params = new URLSearchParams();
    if (route.context.day !== undefined) params.set("day", route.context.day);
    if (route.context.personId !== undefined) params.set("personId", route.context.personId);
    return `${root}?${params.toString()}`;
  }

  if (route.context.kind === "analysis_month") {
    const params = new URLSearchParams();
    if (route.context.personId !== undefined) params.set("personId", route.context.personId);
    appendAnalysisFilters(params, route.context.filters);
    const query = params.toString();
    return `/historique/analyse/${route.context.month}${query.length === 0 ? "" : `?${query}`}`;
  }

  const params = new URLSearchParams({
    window: route.context.observationWindow,
  });
  if (route.context.asOf !== undefined) {
    params.set("asOf", route.context.asOf);
  }
  if (route.context.personId !== undefined) {
    params.set("personId", route.context.personId);
  }
  appendAnalysisFilters(params, route.context.filters);
  return `/historique/analyse/global?${params.toString()}`;
}

function appendAnalysisFilters(
  params: URLSearchParams,
  filters: import("../../core/scope").NormalizedAnalysisFilters | undefined,
): void {
  if (filters === undefined) return;
  for (const key of analysisFilterKeys) {
    for (const value of filters[key]) params.append(key, value);
  }
}

export function parseRootNavigation(value: unknown): RootNavigationContext {
  const url = parseRelativeUrl(value);
  return url.pathname === "/operations"
    ? parseOperationsNavigation(url)
    : parseHistoryRootNavigation(url);
}

function appendIdFilters(
  params: URLSearchParams,
  key: string,
  values: readonly string[] | undefined,
): void {
  for (const value of values ?? []) params.append(key, value);
}

function serializeOperationsNavigation(
  filters: OperationsNavigationFilters,
): string {
  const normalized = operationsNavigationFiltersSchema.parse(filters);
  const params = new URLSearchParams();
  if (normalized.timeKind !== undefined) params.set("timeKind", normalized.timeKind);
  if (normalized.month !== undefined) params.set("month", normalized.month);
  if (
    normalized.startDate !== undefined &&
    normalized.endExclusive !== undefined
  ) {
    params.set("startDate", normalized.startDate);
    params.set("endExclusive", normalized.endExclusive);
  }
  if (normalized.globalWindow !== undefined && normalized.asOf !== undefined) {
    params.set("globalWindow", normalized.globalWindow);
    params.set("asOf", normalized.asOf);
  }
  if (normalized.personId !== undefined) {
    params.set("personId", normalized.personId);
  }
  appendIdFilters(params, "categoryIds", normalized.categoryIds);
  appendIdFilters(params, "subcategoryIds", normalized.subcategoryIds);
  appendIdFilters(params, "activityIds", normalized.activityIds);
  appendIdFilters(params, "momentIds", normalized.momentIds);
  appendIdFilters(params, "lifeEventIds", normalized.lifeEventIds);
  appendIdFilters(params, "merchantIds", normalized.merchantIds);
  appendIdFilters(params, "placeIds", normalized.placeIds);
  appendIdFilters(params, "accountIds", normalized.accountIds);
  appendIdFilters(params, "preciseTypes", normalized.preciseTypes);
  appendIdFilters(params, "necessity", normalized.necessity);
  appendIdFilters(params, "fixedVariable", normalized.fixedVariable);
  appendIdFilters(params, "lifeScope", normalized.lifeScope);
  appendIdFilters(params, "dayContext", normalized.dayContext);
  appendIdFilters(params, "quality", normalized.quality);
  if (normalized.amountMin !== undefined) params.set("amountMin", normalized.amountMin);
  if (normalized.amountMax !== undefined) params.set("amountMax", normalized.amountMax);
  if (normalized.search !== undefined) params.set("search", normalized.search);
  if (normalized.sort !== undefined) params.set("sort", normalized.sort);
  if (normalized.mode !== undefined) params.set("mode", normalized.mode);
  if (normalized.cursor !== undefined) params.set("cursor", normalized.cursor);
  appendIdFilters(params, "cursorTrail", normalized.cursorTrail);

  const query = params.toString();
  return query.length === 0 ? "/operations" : `/operations?${query}`;
}

export function serializeRootNavigation(value: RootNavigationContext): string {
  const route = rootNavigationContextSchema.parse(value);
  return "kind" in route
    ? serializeOperationsNavigation(route.filters)
    : serializeHistoryRootNavigation(route);
}
