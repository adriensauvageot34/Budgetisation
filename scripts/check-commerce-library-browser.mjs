import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { uuid } from "./fixtures/planner-kernel.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLANNER_PLAYWRIGHT_MODULE ?? "playwright-core");
const sharp = require("sharp");
const origin = "http://127.0.0.1:" + (process.env.COMPOSER_C8_TEST_PORT ?? "3230");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [], posts = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (request.method() === "POST" && ["/draft", "/interaction"].includes(new URL(request.url()).pathname))
    posts.push({ path: new URL(request.url()).pathname, kind: request.postDataJSON().kind }); });
  page.setDefaultTimeout(30000);
  const root = page.locator("[data-composer]"), library = page.locator("[data-library]");
  const dialog = page.locator("[data-commerce-library-editor]");
  const gift = page.locator("[data-gift-editor]"), basket = page.locator("[data-purchase-basket]");
  const card = n => page.locator(`[data-context="${uuid(n)}"]`);
  const button = (scope, name) => scope.getByRole("button", { name, exact: typeof name === "string" });
  const open = async n => {
    await button(library, "Mes intentions").click();
    await library.getByRole("textbox", { name: "Rechercher une intention" }).fill("");
    await library.locator(`[data-library-existing-action="${uuid(n)}"]`).click();
  };
  const closeLibrary = () => button(dialog, "Fermer la bibliothèque visuelle").click();
  const privateBadge = key => root.locator(`[data-badge-identity="${key}"]`);
  const waitPrivate = async key => { await privateBadge(key).first().waitFor(); await page.waitForFunction(k =>
    [...document.querySelectorAll("[data-badge-identity]")].some(e=>e.dataset.badgeIdentity===k&&e.dataset.badgeVisual==="IDENTITY"), key); };

  await page.goto(origin + "/?scenario=BADGES&durable=1");
  await card(97201).waitFor();
  for (const id of [97201, 97202]) {
    const layout = await card(id).evaluate(node => ({
      badgesBottom: node.querySelector('[aria-label="Identités et lieux"]').getBoundingClientRect().bottom,
      summaryTop: node.querySelector('[data-purchase-summary]').getBoundingClientRect().top,
    }));
    assert.ok(layout.badgesBottom <= layout.summaryTop, "Le badge ne masque pas l’ouverture du panier");
  }
  const digest = await root.getAttribute("data-digest");
  const leclerc = card(97202).locator("[data-commerce-badge]");
  assert.equal(await leclerc.getAttribute("data-badge-category"), "GROCERIES");
  assert.equal(await leclerc.getAttribute("data-badge-visual"), "CATEGORY_ICON");
  assert.equal(await card(97203).locator("[data-commerce-badge]").getAttribute("data-badge-category"), "RESTAURANT");
  assert.equal(await card(97204).locator("[data-commerce-badge]").getAttribute("data-badge-category"), "HAIRDRESSER");
  assert.equal(await card(97207).locator("[data-commerce-badge]").getAttribute("data-badge-identity"), null);
  await open(97201);
  assert.equal(await basket.locator('[data-commerce-badge="platform"]').getAttribute("data-badge-visual"), "IDENTITY");
  assert.equal(await basket.locator('[data-commerce-badge="seller"]').getAttribute("data-badge-identity"), null);
  assert.match(await basket.innerText(), /Vendeur déclaré · Librairie tierce/u);
  await button(basket, "Fermer le panier").click();
  await open(97205);
  assert.equal(await gift.locator("[data-commerce-badge]").getAttribute("data-badge-visual"), "NEUTRAL");
  await button(gift, "Personnaliser le badge Atelier Homonyme").click();
  await dialog.getByLabel("Catégorie du badge").selectOption("CLOTHING");
  await button(dialog, "Conserver la catégorie").click();
  await dialog.getByText("Catégorie visuelle enregistrée.", { exact: true }).waitFor();
  await closeLibrary();
  assert.equal(await gift.locator("[data-commerce-badge]").getAttribute("data-badge-identity"), null);
  await gift.locator('[data-badge-category="CLOTHING"]').waitFor();
  await button(gift, "Personnaliser le badge Atelier Homonyme").click();
  await button(dialog, "Créer et confirmer une identité personnelle").click();
  await dialog.locator("[data-confirmed-badge-identity]").waitFor();
  const identity = (await dialog.locator("small").filter({ hasText: /^personal:/u }).innerText()).trim();
  const png = await sharp({ create: { width: 80, height: 80, channels: 4, background: { r: 170, g: 110, b: 180, alpha: .6 } } }).png().toBuffer();
  await dialog.getByLabel("Fichier de l’illustration").setInputFiles({ name: "recette.png", mimeType: "image/png", buffer: png });
  await button(dialog, "Ajouter l’illustration").click();
  await dialog.getByText("Illustration enregistrée dans votre bibliothèque privée.", { exact: true }).waitFor();
  await closeLibrary();
  await waitPrivate(identity);
  assert.equal(await card(97206).locator("[data-commerce-badge]").getAttribute("data-badge-identity"), null);
  await button(gift, "Retour au mois").click();
  await open(97206);
  await button(gift, "Personnaliser le badge Atelier Homonyme").click();
  await button(dialog, "Rechercher les entreprises").click();
  const canonicalSecond = dialog.locator(`input[value="merchant:${uuid(97003)}"]`);
  await canonicalSecond.check();
  await button(dialog, "Confirmer cette entreprise").click();
  await dialog.locator("[data-confirmed-badge-identity]").waitFor();
  await closeLibrary();
  await page.locator(`[data-gift-editor] [data-badge-identity="merchant:${uuid(97003)}"]`).waitFor();
  assert.equal(await gift.locator("[data-commerce-badge]").getAttribute("data-badge-visual"), "NEUTRAL");
  await button(gift, "Retour au mois").click();
  await open(97208);
  await button(gift, "Personnaliser le badge Atelier Homonyme").click();
  await button(dialog, "Rechercher les entreprises").click();
  await dialog.locator(`input[value="${identity}"]`).check();
  await button(dialog, "Confirmer cette entreprise").click();
  await dialog.locator("[data-confirmed-badge-identity]").waitFor();
  await closeLibrary();
  await waitPrivate(identity);
  assert.equal(await gift.locator("[data-commerce-badge]").getAttribute("data-badge-identity"), identity);
  await button(gift, "Personnaliser le badge Atelier Homonyme").click();
  const webp = await sharp(png).tint("#86b8c6").webp().toBuffer();
  await dialog.getByLabel("Fichier de l’illustration").setInputFiles({ name: "remplacement.webp", mimeType: "image/webp", buffer: webp });
  await button(dialog, "Remplacer l’illustration").click();
  await dialog.getByText("Illustration enregistrée dans votre bibliothèque privée.", { exact: true }).waitFor();
  await closeLibrary();
  await waitPrivate(identity);
  assert.equal(await root.getAttribute("data-digest"), digest);
  assert.equal(posts.length, 1);
  await page.reload();
  await card(97205).locator(`[data-badge-identity="${identity}"]`).waitFor();
  assert.equal(await card(97206).locator("[data-commerce-badge]").getAttribute("data-badge-identity"), "merchant:" + uuid(97003));
  assert.equal(await card(97208).locator("[data-commerce-badge]").getAttribute("data-badge-identity"), identity);
  assert.equal(await root.getAttribute("data-digest"), digest);
  await page.route("**/planned-visuals/commerce/platforms/amazon.webp", route => route.fulfill({ status: 404, body: "" }));
  await page.route("**/fixture-badge-image/**", route => route.fulfill({ status: 200, contentType: "image/webp", body: "defective" }));
  await page.reload();
  await card(97201).scrollIntoViewIfNeeded();
  await card(97201).locator('[data-badge-visual="CATEGORY_ICON"]').first().waitFor();
  await card(97205).scrollIntoViewIfNeeded();
  try { await card(97205).locator('[data-badge-visual="CATEGORY_ICON"]').waitFor(); }
  catch (error) {
    console.error(await card(97205).locator('[data-commerce-badge]').evaluateAll(nodes => nodes.map(node => ({
      html: node.outerHTML, images: [...node.querySelectorAll('img')].map(image => ({ src: image.src, complete: image.complete, width: image.naturalWidth }))
    }))));
    if (process.env.BADGE_SCREENSHOT) await page.screenshot({ path: process.env.BADGE_SCREENSHOT });
    throw error;
  }
  assert.deepEqual(posts, [{ path: "/interaction", kind: "READ" }, { path: "/interaction", kind: "READ" }, { path: "/interaction", kind: "READ" }]);
  assert.equal(await root.getAttribute("data-digest"), digest);
  const snapshot = await (await page.request.get(origin + "/draft?scenario=BADGES")).json();
  assert.equal(snapshot.active, null); assert.equal(snapshot.archives.length, 0);
  assert.deepEqual(errors, []);
  if (process.env.BADGE_SCREENSHOT) await page.screenshot({ path: process.env.BADGE_SCREENSHOT });
  console.log("M09-B navigateur · badges, catégories, import PNG/WebP, reprise, remplacement commun, homonymes, fichier absent/défectueux et zéro Save/Preview supplémentaire : PASS");
} finally { await browser.close(); }
