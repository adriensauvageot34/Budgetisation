/** Local synthetic fixture probe only; no credentials, domain data or remote telemetry. */
export function installL2aFixtureMetrics() {
  let lastDecision: number | null = null, openingFreshMs: number | null = null;
  const decisions: number[] = [], editors: number[] = [];
  let editorClick: number | null = null, observedPanel: Element | null = null;
  const write = () => {
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    document.documentElement.setAttribute("data-l2a-metrics", JSON.stringify({
      openingFreshMs, decisions, editors,
      domNodes: document.querySelectorAll("*").length,
      resources: resources.filter(r => new URL(r.name).origin === location.origin).map(r => ({
        path: new URL(r.name).pathname, type: r.initiatorType, durationMs: r.duration,
        transferBytes: r.transferSize, decodedBytes: r.decodedBodySize,
      })),
    }));
  };
  document.addEventListener("click", event => {
    const button = (event.target as Element)?.closest("button");
    if (!button) return;
    if (button.matches("[data-preset],[data-context-focus]") || button.getAttribute("data-asset") === "template:restaurant")
      editorClick = performance.now();
    if (button.textContent === "Valider le budget") lastDecision = performance.now();
  }, true);
  new MutationObserver(() => {
    const panel = document.querySelector("[data-restaurant-editor],dialog[open] [data-night-editor], [data-catalog-context-editor]");
    if (panel && panel !== observedPanel && editorClick !== null) {
      const started = editorClick; editorClick = null; observedPanel = panel;
      requestAnimationFrame(() => requestAnimationFrame(() => { editors.push(performance.now() - started); write(); }));
    }
    if (!panel) observedPanel = null;
    const board = document.querySelector("[data-composer]");
    if (board?.getAttribute("data-preview-state") !== "FRESH") return;
    if (openingFreshMs === null) {
      openingFreshMs = -1;
      requestAnimationFrame(() => requestAnimationFrame(() => { openingFreshMs = performance.now(); write(); }));
    }
    if (lastDecision !== null) {
      const started = lastDecision; lastDecision = null;
      requestAnimationFrame(() => requestAnimationFrame(() => { decisions.push(performance.now() - started); write(); }));
    }
  }).observe(document.getElementById("root")!, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-preview-state"] });
  new PerformanceObserver(write).observe({ type: "resource", buffered: true });
}
