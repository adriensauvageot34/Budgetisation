"use client";

import { useMemo } from "react";
import { createGlobalV2FixtureTransport, type GlobalV2FixtureBundle, type GlobalV2FixtureScenario } from "./fixture-data";
import { GlobalV2Page } from "./global-v2-page";

/** Development/browser-test adapter. It is never rendered by the production route. */
export function GlobalV2FixturePage({ bundle, scenario, certifiedThrough }: {
  readonly bundle: GlobalV2FixtureBundle;
  readonly scenario: GlobalV2FixtureScenario;
  readonly certifiedThrough: string;
}) {
  const transport = useMemo(() => createGlobalV2FixtureTransport(bundle, scenario), [bundle, scenario]);
  return <GlobalV2Page bundle={bundle} transport={transport} certifiedThrough={certifiedThrough} />;
}
