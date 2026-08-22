"use client";

import type { ReactNode, RefObject } from "react";
import type { ExplorationNode } from "@/navigation";
import { canPopExploration } from "@/navigation";
import {
  EmptyState,
  ErrorState,
  ExplorationStack,
  OverlayFrame,
  OverlaySkeleton,
  RefreshIndicator,
  type UiTransportState,
} from "@/ui";
import {
  LifeEventSurface,
  MerchantSurface,
  MomentSurface,
  PersonaSurface,
  PlaceSurface,
} from "./entity-surfaces";
import { MerchantsGallery, MomentsGallery, PlacesGallery } from "./galleries";
import { MethodologySurface } from "./methodology";
import { OperationEvidenceSurface } from "./operation-evidence";
import type {
  ExplorationNavigation,
  ExplorationNodeTransport,
  ExplorationPanelState,
  GalleryRuntime,
} from "./types";
import styles from "./exploration.module.css";

const nodeLabels: Readonly<Record<ExplorationNode["kind"], string>> = {
  analysis: "Analyse ciblée",
  moment: "Moment",
  place: "Lieu",
  merchant: "Marchand",
  persona: "Persona",
  life_event: "Life Event",
  operation: "Preuve d’opération",
  methodology: "Méthodologie",
  gallery: "Galerie",
};

function TransportView<T>({
  transport,
  onRetry,
  children,
}: {
  readonly transport: UiTransportState<T>;
  readonly onRetry?: () => void;
  readonly children: (data: T) => ReactNode;
}) {
  if (transport.status === "idle" || transport.status === "loading") return <OverlaySkeleton />;
  const response = transport.status === "success" ? transport.response : transport.previousData;
  if (transport.status === "error" && response === undefined) return <ErrorState error={transport.error} onRetry={onRetry} />;
  if (response === undefined) throw new TypeError("Réponse Exploration indisponible.");
  return (
    <>
      {children(response.data)}
      {transport.status === "success" && transport.refreshing ? <RefreshIndicator announce /> : null}
      {transport.status === "error" ? <RefreshIndicator failed announce /> : null}
    </>
  );
}

export function ExplorationNodeRenderer({
  current,
  navigation,
  galleryRuntime,
  onRetry,
}: {
  readonly current: ExplorationNodeTransport;
  readonly navigation: ExplorationNavigation;
  readonly galleryRuntime?: GalleryRuntime;
  readonly onRetry?: () => void;
}) {
  switch (current.kind) {
    case "analysis":
      return (
        <article className={styles.analysisDestination}>
          <h2 data-exploration-heading="" tabIndex={-1}>Analyse ciblée</h2>
          <p>Le scope analytique est conservé par Navigation. Les surfaces Analysis restent hors de ce lot.</p>
        </article>
      );
    case "moment":
      return <TransportView transport={current.transport} onRetry={onRetry}>{(model) => <MomentSurface model={model} navigation={navigation} />}</TransportView>;
    case "place":
      return <TransportView transport={current.transport} onRetry={onRetry}>{(model) => <PlaceSurface model={model} navigation={navigation} />}</TransportView>;
    case "merchant":
      return <TransportView transport={current.transport} onRetry={onRetry}>{(model) => <MerchantSurface model={model} navigation={navigation} />}</TransportView>;
    case "persona":
      return <TransportView transport={current.transport} onRetry={onRetry}>{(model) => <PersonaSurface model={model} navigation={navigation} />}</TransportView>;
    case "life_event":
      return <TransportView transport={current.transport} onRetry={onRetry}>{(model) => <LifeEventSurface model={model} navigation={navigation} />}</TransportView>;
    case "operation":
      return <TransportView transport={current.transport} onRetry={onRetry}>{(model) => <OperationEvidenceSurface model={model} navigation={navigation} />}</TransportView>;
    case "methodology":
      return <TransportView transport={current.transport} onRetry={onRetry}>{(model) => <MethodologySurface model={model} navigation={navigation} />}</TransportView>;
    case "gallery_moments": {
      if (galleryRuntime?.gallery === "moments") {
        return <MomentsGallery state={current.transport} query={galleryRuntime.query} actions={galleryRuntime.actions} navigation={navigation} />;
      }
      return <EmptyState title="Contexte Gallery indisponible" />;
    }
    case "gallery_places": {
      if (galleryRuntime?.gallery === "places") {
        return <PlacesGallery state={current.transport} query={galleryRuntime.query} actions={galleryRuntime.actions} navigation={navigation} />;
      }
      return <EmptyState title="Contexte Gallery indisponible" />;
    }
    case "gallery_merchants": {
      if (galleryRuntime?.gallery === "merchants") {
        return <MerchantsGallery state={current.transport} query={galleryRuntime.query} actions={galleryRuntime.actions} navigation={navigation} />;
      }
      return <EmptyState title="Contexte Gallery indisponible" />;
    }
  }
}

export function ExplorationPanel({
  state,
  navigation,
  galleryRuntime,
  onRetry,
  open = true,
  backgroundRootRef,
  restoreFocusRef,
  semanticFallbackRef,
}: {
  readonly state: ExplorationPanelState;
  readonly navigation: ExplorationNavigation;
  readonly galleryRuntime?: GalleryRuntime;
  readonly onRetry?: () => void;
  readonly open?: boolean;
  readonly backgroundRootRef?: RefObject<HTMLElement | null>;
  readonly restoreFocusRef?: RefObject<HTMLElement | null>;
  readonly semanticFallbackRef?: RefObject<HTMLElement | null>;
}) {
  const canPop = canPopExploration(state.exploration);
  const currentNode = state.exploration.stack[state.exploration.stack.length - 1]!;
  return (
    <OverlayFrame
      title={nodeLabels[currentNode.kind]}
      subtitle={`Exploration · niveau ${state.exploration.stack.length}`}
      kind="exploration"
      className={styles.panel}
      open={open}
      topmost
      closeAction={{ kind: "callback", onAction: () => navigation.close() }}
      backAction={canPop ? { kind: "callback", onAction: () => navigation.pop() } : undefined}
      backgroundRootRef={backgroundRootRef}
      restoreFocusRef={restoreFocusRef}
      semanticFallbackRef={semanticFallbackRef}
    >
      <ExplorationStack
        stack={state.exploration.stack}
        semanticFallback={semanticFallbackRef?.current}
        renderNode={() => (
          <ExplorationNodeRenderer
            current={state.current}
            navigation={navigation}
            galleryRuntime={galleryRuntime}
            onRetry={onRetry}
          />
        )}
      />
    </OverlayFrame>
  );
}
