"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type {
  GalleryMerchantsReadModel,
  GalleryMomentsReadModel,
  GalleryPlacesReadModel,
  MerchantsGalleryFilters,
  MomentsGalleryFilters,
  PlacesGalleryFilters,
} from "@/query-api";
import {
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
  FilterChip,
  FilteredEmptyState,
  RefreshIndicator,
  ResponsiveCardGrid,
  ScopeSelector,
  type UiTransportState,
} from "@/ui";
import { MerchantCard, MomentCard, PlaceCard } from "./cards";
import type {
  ExplorationNavigation,
  GalleryActions,
  GalleryQueryState,
  MerchantsGallerySortKey,
  MomentsGallerySortKey,
  PlacesGallerySortKey,
} from "./types";
import styles from "./exploration.module.css";

function GalleryToolbar<SortKey extends string>({
  label,
  query,
  sorts,
  actions,
  filterChips,
}: {
  readonly label: string;
  readonly query: GalleryQueryState<SortKey, unknown>;
  readonly sorts: readonly { readonly id: SortKey; readonly label: string }[];
  readonly actions: GalleryActions<SortKey>;
  readonly filterChips: readonly {
    readonly filter: "activityIds" | "placeIds";
    readonly label: string;
  }[];
}) {
  const [draft, setDraft] = useState(query.search);
  useEffect(() => setDraft(query.search), [query.search]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    actions.onSearch(draft.trim());
  };
  return (
    <form className={styles.galleryToolbar} role="search" aria-label={`Rechercher dans ${label}`} onSubmit={submit}>
      <label className={styles.searchLabel}>
        <span>Recherche</span>
        <input className="ui-select ui-focusable" type="search" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />
      </label>
      <Button type="submit" tone="secondary" action={{ kind: "callback", onAction: () => undefined }}>Rechercher</Button>
      <ScopeSelector label="Tri serveur" value={query.sort} options={sorts} onChange={actions.onSort} />
      {filterChips.map((chip) => (
        <FilterChip
          key={chip.filter}
          filter={chip.filter}
          label={chip.label}
          onRemove={() => actions.onRemoveFilter(chip.filter)}
        />
      ))}
    </form>
  );
}

function GalleryState({
  state,
  queryRestricted,
  onRetry,
  onClear,
  render,
}: {
  readonly state: UiTransportState<{ readonly page: { readonly items: readonly unknown[]; readonly state: "nonempty" | "empty" | "filtered_empty"; readonly pageInfo: { readonly nextCursor: string | null; readonly hasMore: boolean } } }>;
  readonly queryRestricted: boolean;
  readonly onRetry?: () => void;
  readonly onClear: () => void;
  readonly render: (data: { readonly page: { readonly items: readonly unknown[]; readonly state: "nonempty" | "empty" | "filtered_empty"; readonly pageInfo: { readonly nextCursor: string | null; readonly hasMore: boolean } } }, refreshing: boolean, refreshFailed: boolean) => ReactNode;
}) {
  if (state.status === "idle" || state.status === "loading") {
    return <div className={styles.gallerySkeleton}>{Array.from({ length: 6 }, (_, index) => <CardSkeleton key={index} />)}</div>;
  }
  const response = state.status === "success" ? state.response : state.previousData;
  if (state.status === "error" && response === undefined) return <ErrorState error={state.error} onRetry={onRetry} />;
  if (response === undefined) throw new TypeError("Réponse Gallery indisponible.");
  if (response.data.page.state === "empty") return <EmptyState title="Aucun élément dans cette galerie" />;
  if (response.data.page.state === "filtered_empty") {
    return <FilteredEmptyState onClearFilters={queryRestricted ? onClear : undefined} />;
  }
  return render(response.data, state.status === "success" && state.refreshing, state.status === "error");
}

export function MomentsGallery({
  state,
  query,
  actions,
  navigation,
}: {
  readonly state: UiTransportState<GalleryMomentsReadModel>;
  readonly query: GalleryQueryState<MomentsGallerySortKey, MomentsGalleryFilters>;
  readonly actions: GalleryActions<MomentsGallerySortKey>;
  readonly navigation: ExplorationNavigation;
}) {
  return (
    <section className={styles.gallerySurface} data-gallery="moments">
      <header><span className={styles.eyebrow}>Galerie globale</span><h2 data-exploration-heading="" tabIndex={-1}>Moments</h2></header>
      <GalleryToolbar
        label="les Moments"
        query={query}
        sorts={[{ id: "recent", label: "Plus récents" }]}
        actions={actions}
        filterChips={[
          ...(query.filters.activityIds.length > 0 ? [{ filter: "activityIds" as const, label: `Activités (${query.filters.activityIds.length})` }] : []),
          ...(query.filters.placeIds.length > 0 ? [{ filter: "placeIds" as const, label: `Lieux (${query.filters.placeIds.length})` }] : []),
        ]}
      />
      <GalleryState
        state={state}
        queryRestricted={query.search.length > 0 || query.filters.activityIds.length > 0 || query.filters.placeIds.length > 0}
        onRetry={actions.onRetry}
        onClear={() => {
          actions.onSearch("");
          if (query.filters.activityIds.length > 0) actions.onRemoveFilter("activityIds");
          if (query.filters.placeIds.length > 0) actions.onRemoveFilter("placeIds");
        }}
        render={(data, refreshing, failed) => (
          <>
            <ResponsiveCardGrid label="Moments">
              {(data.page.items as GalleryMomentsReadModel["page"]["items"]).map((item) => <MomentCard key={item.momentId} momentId={item.momentId} title={item.title} navigation={navigation} />)}
            </ResponsiveCardGrid>
            <GalleryFooter pageInfo={data.page.pageInfo} refreshing={refreshing} failed={failed} onLoadMore={actions.onLoadMore} onRetry={actions.onRetry} />
          </>
        )}
      />
    </section>
  );
}

export function PlacesGallery({
  state,
  query,
  actions,
  navigation,
}: {
  readonly state: UiTransportState<GalleryPlacesReadModel>;
  readonly query: GalleryQueryState<PlacesGallerySortKey, PlacesGalleryFilters>;
  readonly actions: GalleryActions<PlacesGallerySortKey>;
  readonly navigation: ExplorationNavigation;
}) {
  return (
    <section className={styles.gallerySurface} data-gallery="places">
      <header><span className={styles.eyebrow}>Galerie globale</span><h2 data-exploration-heading="" tabIndex={-1}>Lieux</h2></header>
      <GalleryToolbar
        label="les lieux"
        query={query}
        sorts={[{ id: "frequent", label: "Plus fréquentés" }, { id: "spent", label: "Plus dépensés" }, { id: "recent", label: "Plus récents" }]}
        actions={actions}
        filterChips={query.filters.activityIds.length > 0 ? [{ filter: "activityIds", label: `Activités (${query.filters.activityIds.length})` }] : []}
      />
      <GalleryState
        state={state}
        queryRestricted={query.search.length > 0 || query.filters.activityIds.length > 0}
        onRetry={actions.onRetry}
        onClear={() => {
          actions.onSearch("");
          if (query.filters.activityIds.length > 0) actions.onRemoveFilter("activityIds");
        }}
        render={(data, refreshing, failed) => (
          <>
            <ResponsiveCardGrid label="Lieux">
              {(data.page.items as GalleryPlacesReadModel["page"]["items"]).map((item) => <PlaceCard key={item.placeId} placeId={item.placeId} label={item.label} visitCount={item.visitCount} localizedSpend={item.localizedSpend} navigation={navigation} />)}
            </ResponsiveCardGrid>
            <GalleryFooter pageInfo={data.page.pageInfo} refreshing={refreshing} failed={failed} onLoadMore={actions.onLoadMore} onRetry={actions.onRetry} />
          </>
        )}
      />
    </section>
  );
}

export function MerchantsGallery({
  state,
  query,
  actions,
  navigation,
}: {
  readonly state: UiTransportState<GalleryMerchantsReadModel>;
  readonly query: GalleryQueryState<MerchantsGallerySortKey, MerchantsGalleryFilters>;
  readonly actions: GalleryActions<MerchantsGallerySortKey>;
  readonly navigation: ExplorationNavigation;
}) {
  return (
    <section className={styles.gallerySurface} data-gallery="merchants">
      <header><span className={styles.eyebrow}>Galerie globale</span><h2 data-exploration-heading="" tabIndex={-1}>Marchands</h2></header>
      <GalleryToolbar
        label="les marchands"
        query={query}
        sorts={[{ id: "spent", label: "Plus dépensés" }, { id: "frequent", label: "Plus fréquents" }, { id: "recent", label: "Plus récents" }]}
        actions={actions}
        filterChips={[
          ...(query.filters.activityIds.length > 0 ? [{ filter: "activityIds" as const, label: `Activités (${query.filters.activityIds.length})` }] : []),
          ...(query.filters.placeIds.length > 0 ? [{ filter: "placeIds" as const, label: `Lieux (${query.filters.placeIds.length})` }] : []),
        ]}
      />
      <GalleryState
        state={state}
        queryRestricted={query.search.length > 0 || query.filters.activityIds.length > 0 || query.filters.placeIds.length > 0}
        onRetry={actions.onRetry}
        onClear={() => {
          actions.onSearch("");
          if (query.filters.activityIds.length > 0) actions.onRemoveFilter("activityIds");
          if (query.filters.placeIds.length > 0) actions.onRemoveFilter("placeIds");
        }}
        render={(data, refreshing, failed) => (
          <>
            <ResponsiveCardGrid label="Marchands">
              {(data.page.items as GalleryMerchantsReadModel["page"]["items"]).map((item) => <MerchantCard key={item.merchantId} merchantId={item.merchantId} label={item.label} economicAmount={item.economicAmount} purchaseCount={item.purchaseCount} navigation={navigation} />)}
            </ResponsiveCardGrid>
            <GalleryFooter pageInfo={data.page.pageInfo} refreshing={refreshing} failed={failed} onLoadMore={actions.onLoadMore} onRetry={actions.onRetry} />
          </>
        )}
      />
    </section>
  );
}

function GalleryFooter({
  pageInfo,
  refreshing,
  failed,
  onLoadMore,
  onRetry,
}: {
  readonly pageInfo: { readonly nextCursor: string | null; readonly hasMore: boolean };
  readonly refreshing: boolean;
  readonly failed: boolean;
  readonly onLoadMore: (cursor: string) => void;
  readonly onRetry?: () => void;
}) {
  return (
    <footer className={styles.galleryFooter}>
      {refreshing ? <RefreshIndicator announce /> : null}
      {failed ? <RefreshIndicator failed announce /> : null}
      {failed && onRetry ? <Button tone="quiet" action={{ kind: "callback", onAction: onRetry }}>Réessayer</Button> : null}
      {pageInfo.hasMore && pageInfo.nextCursor ? (
        <Button tone="secondary" action={{ kind: "callback", onAction: () => onLoadMore(pageInfo.nextCursor!) }}>Charger la suite</Button>
      ) : null}
    </footer>
  );
}
