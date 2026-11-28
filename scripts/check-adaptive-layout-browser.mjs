import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const origin = new URL(process.env.ADAPTIVE_LAYOUT_ORIGIN ?? "http://localhost:3000");
assert(["localhost", "127.0.0.1"].includes(origin.hostname), "This check uses the local synthetic fixture.");
const require = createRequire(process.env.PLANNER_PLAYWRIGHT_TOOLS
  ? resolve(process.env.PLANNER_PLAYWRIGHT_TOOLS, "package.json") : import.meta.url);
const { chromium } = require("playwright-core");
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function fits(page, expected) {
  await page.waitForFunction(expectation => {
    const dashboard = [...document.querySelectorAll("[data-global-v2]")].find(node => node.getClientRects().length > 0);
    if (!dashboard) return false;
    const regions = [...dashboard.querySelectorAll("[data-adaptive-region]")];
    const active = regions.find(section => section.hasAttribute("data-adaptive-active"));
    if (active?.dataset.globalSection !== expectation.active) return false;
    if (document.scrollingElement.scrollHeight > innerHeight + 1) return false;

    for (const column of dashboard.querySelectorAll("[data-side]")) {
      const sections = [...column.querySelectorAll(":scope > [data-adaptive-region]")];
      if (!sections.length) continue;
      const end = column.getBoundingClientRect().bottom;
      let bottom = column.getBoundingClientRect().top;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top < bottom - 1 || rect.bottom > end + 1) return false;
        bottom = rect.bottom;
      }
      if (expectation.fillRight && column.dataset.side === "right" && end - bottom > 90) return false;
    }

    if (expectation.charts && !["car", "food"].every(name => {
      const chart = dashboard.querySelector('[data-global-section="' + name + '"] [class*="annualRiver"]');
      return chart?.getBoundingClientRect().height >= 24;
    })) return false;

    if (expectation.active === "categories") {
      const detail = active.querySelector("[data-open-category] [data-fit-detail]");
      return detail && !detail.hasAttribute("data-detail-overflow")
        && detail.getBoundingClientRect().bottom <= active.getBoundingClientRect().bottom;
    }
    return true;
  }, expected, { timeout: 15_000 }).catch(async error => {
    const layout = await page.locator("[data-adaptive-region]:visible").evaluateAll(regions => regions.map(section => ({
      name: section.dataset.globalSection,
      bottom: section.getBoundingClientRect().bottom,
      limit: section.parentElement.getBoundingClientRect().bottom,
      chart: section.querySelector('[class*="annualRiver"]')?.getBoundingClientRect().height,
    })));
    throw new Error(JSON.stringify({ expected, layout }), { cause: error });
  });
}

try {
  const page = await browser.newPage({ viewport: { width: 1820, height: 1000 }, reducedMotion: "reduce" });
  assert.equal((await page.goto(new URL("/analyse-globale?fixture=contract", origin).href, { timeout: 90_000 }))?.status(), 200);
  await fits(page, { charts: true });
  await page.getByRole("button", { name: /^Manon/ }).click();
  await page.locator('[data-profile-name="Manon"]:visible').waitFor();
  await fits(page, { active: "profiles", charts: true, fillRight: true });

  await page.setViewportSize({ width: 1366, height: 768 });
  await fits(page, { active: "profiles", charts: true, fillRight: true });
  await page.getByRole("button", { name: "Fermer le détail", exact: true }).click();
  await page.locator("[data-category-list]:visible button").first().click();
  await page.locator("[data-open-category] .ui-chart-content:visible").waitFor();
  await fits(page, { active: "categories" });
  console.log("PASS: modules in order, profiles with usable charts, and inline category within the desktop viewport");
} finally {
  await browser.close();
}
