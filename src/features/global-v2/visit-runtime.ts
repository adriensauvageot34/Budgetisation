import type { GlobalReadModelPublicationMeta, GlobalReadModelTransportState, GlobalV2QueryResourceName } from "@/query-api/global-v2";

export type GlobalV2UiRequest = {
  readonly resource: GlobalV2QueryResourceName;
  readonly params: Readonly<Record<string, string>>;
};

export type GlobalV2UiResponse = {
  readonly data: unknown;
  readonly publicationMeta: GlobalReadModelPublicationMeta;
};

export type GlobalV2UiTransport = (request: GlobalV2UiRequest) => Promise<GlobalV2UiResponse>;

type QueueEntry = {
  readonly key: string;
  readonly request: GlobalV2UiRequest;
  priority: "DIRECT" | "BACKGROUND";
  readonly resolve: (value: GlobalV2UiResponse) => void;
  readonly reject: (reason: unknown) => void;
};

export function globalV2UiCacheKey(publication: Pick<GlobalReadModelPublicationMeta, "publicationId" | "revision">, request: GlobalV2UiRequest): string {
  const params = Object.entries(request.params).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify([publication.publicationId, publication.revision, request.resource, params]);
}

export function sameGlobalGeneration(left: GlobalReadModelPublicationMeta, right: GlobalReadModelPublicationMeta): boolean {
  return left.publicationId === right.publicationId && left.revision === right.revision && left.factsHash === right.factsHash && left.manifestHash === right.manifestHash && left.generatedAt === right.generatedAt && left.profileId === right.profileId;
}

/** Visit-scoped snapshot client. It never receives an Analytics producer. */
export class GlobalV2VisitRuntime {
  readonly pinnedPublication: GlobalReadModelPublicationMeta;
  readonly transport: GlobalV2UiTransport;
  readonly maxConcurrentBackground: number;
  readonly #cache = new Map<string, GlobalV2UiResponse>();
  readonly #inFlight = new Map<string, Promise<GlobalV2UiResponse>>();
  readonly #queue: QueueEntry[] = [];
  #active = 0;

  constructor(
    pinnedPublication: GlobalReadModelPublicationMeta,
    transport: GlobalV2UiTransport,
    maxConcurrentBackground = 2,
  ) {
    if (!Number.isSafeInteger(maxConcurrentBackground) || maxConcurrentBackground < 1) throw new TypeError("GLOBAL_UI_CONCURRENCY_INVALID");
    this.pinnedPublication = pinnedPublication;
    this.transport = transport;
    this.maxConcurrentBackground = maxConcurrentBackground;
  }

  cacheKey(request: GlobalV2UiRequest): string {
    return globalV2UiCacheKey(this.pinnedPublication, request);
  }

  peek(request: GlobalV2UiRequest): GlobalV2UiResponse | undefined {
    return this.#cache.get(this.cacheKey(request));
  }

  request(request: GlobalV2UiRequest, priority: "DIRECT" | "BACKGROUND" = "BACKGROUND"): Promise<GlobalV2UiResponse> {
    const key = this.cacheKey(request);
    const cached = this.#cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = this.#inFlight.get(key);
    if (pending !== undefined) {
      if (priority === "DIRECT") {
        const queued = this.#queue.find((entry) => entry.key === key);
        if (queued !== undefined) {
          queued.priority = "DIRECT";
          this.#queue.sort((left, right) => (left.priority === right.priority ? 0 : left.priority === "DIRECT" ? -1 : 1));
        }
      }
      return pending;
    }
    const promise = new Promise<GlobalV2UiResponse>((resolve, reject) => {
      this.#queue.push({ key, request, priority, resolve, reject });
      this.#queue.sort((left, right) => (left.priority === right.priority ? 0 : left.priority === "DIRECT" ? -1 : 1));
      this.#drain();
    });
    this.#inFlight.set(key, promise);
    return promise;
  }

  invalidate(request: GlobalV2UiRequest): void {
    this.#cache.delete(this.cacheKey(request));
  }

  #drain(): void {
    while (this.#active < this.maxConcurrentBackground && this.#queue.length > 0) {
      const entry = this.#queue.shift()!;
      this.#active += 1;
      void this.transport(entry.request).then((response) => {
        if (!sameGlobalGeneration(this.pinnedPublication, response.publicationMeta)) throw new TypeError("GLOBAL_UI_LATE_GENERATION_REJECTED");
        this.#cache.set(entry.key, response);
        entry.resolve(response);
      }).catch(entry.reject).finally(() => {
        this.#active -= 1;
        this.#inFlight.delete(entry.key);
        this.#drain();
      });
    }
  }
}

export function globalUiErrorCode(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "GLOBAL_UI_QUERY_FAILED";
}

export function readyGlobalTransportState<Data>(data: Data): GlobalReadModelTransportState<Data> {
  return { status: "READY", data };
}

export function updateExpandedModules(current: ReadonlySet<string>, moduleKey: string, mobile: boolean): ReadonlySet<string> {
  if (mobile) return current.has(moduleKey) && current.size === 1 ? new Set() : new Set([moduleKey]);
  const next = new Set(current);
  if (next.has(moduleKey)) next.delete(moduleKey);
  else next.add(moduleKey);
  return next;
}

export function parseGlobalDeepLink(hash: string): { readonly anchor: string; readonly moduleKey?: string; readonly sectionKey?: string } | null {
  const value = hash.replace(/^#/, "").trim();
  if (value.length === 0) return null;
  if (value === "synthese") return { anchor: value };
  const [moduleKey, sectionKey] = value.split("-");
  return { anchor: value, ...(moduleKey === undefined ? {} : { moduleKey: moduleKey.toUpperCase() }), ...(sectionKey === undefined ? {} : { sectionKey: sectionKey.toUpperCase() }) };
}
