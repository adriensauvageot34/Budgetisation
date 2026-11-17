import assert from "node:assert/strict";
import { commerceLibraryFixture } from "./lib/commerce-library-fixture.mjs";
import { require } from "./lib/phase2-ts-loader.mjs";
import { uuid } from "./fixtures/planner-kernel.mjs";
const sharp = require("sharp");
const { commerceAnchor } = require("@/domain/phase2/commerce-media");
const { prepareBadgeImage } = require("@/server/commerce/badge-library");
const { BootstrapAuthenticationRequiredError } = require("@/server/bootstrap/errors");
const { badgeRequest } = require("@/server/commerce/badge-http");
const fixture = await commerceLibraryFixture();
const a = fixture.service(fixture.userId), b = fixture.service(fixture.other);
const anchor = commerceAnchor(uuid(97205), "seller", "Atelier Homonyme");
const second = commerceAnchor(uuid(97206), "seller", "Atelier Homonyme");

try {
  await fixture.pg.db.exec("reset role");
  const aliasId = uuid(97004);
  await fixture.pg.db.query(`insert into public.merchants (merchant_id, nom_canonique, identity_kind, identity_classified_at,
      identity_source, commercial_display_name, commercial_family_key, visual_brand_merchant_id, generic_badge_category)
    values ($1,'Terminal bancaire 42','commercial',now(),'owner_confirmed','Fournil de recette','fournil',$2,'BAKERY')`,
  [aliasId, uuid(97001)]);
  const alias = { key: "merchant:" + aliasId, label: "Fournil de recette" };
  assert.deepEqual(await a.search("Terminal bancaire"), [alias]);
  assert.deepEqual(await a.search("Fournil de recette"), [alias]);
  assert.equal((await a.confirm({ identityKey: alias.key })).label, alias.label);
  assert.deepEqual((await a.read([alias.key], [])).merchants, [{
    key: alias.key, kind: "commercial", displayName: alias.label, genericCategory: "BAKERY", visualKey: "merchant:" + uuid(97001),
  }]);
  await fixture.pg.db.exec("reset role");
  for (const [id, name] of [[uuid(97005), "Tabac de recette A"], [uuid(97006), "Tabac de recette B"]]) {
    await fixture.pg.db.query(`insert into public.merchants (merchant_id, nom_canonique, identity_kind, identity_classified_at,
        identity_source, generic_badge_category)
      values ($1,$2,'commercial',now(),'owner_confirmed','TOBACCO')`, [id, name]);
  }
  const tobacconists = await a.search("Tabac de recette");
  assert.deepEqual(tobacconists.map(entry => entry.label), ["Tabac de recette A", "Tabac de recette B"]);
  const keys = tobacconists.map(entry => entry.key);
  const genericBadges = await a.read(keys, []);
  assert.deepEqual(genericBadges.merchants, keys.map(key => ({ key, kind: "commercial", genericCategory: "TOBACCO" })));
  assert.deepEqual(genericBadges.media, []);
  assert.deepEqual(await fixture.service(fixture.userId).read(keys, []), genericBadges);
  assert.equal((await a.read([], [anchor])).bindings.length, 0);
  const categoryOnly = await a.anchorCategory(anchor, 0, "PHARMACY");
  assert.equal(categoryOnly.identityKey, null);
  const one = await a.confirm({ newLabel: "Atelier Homonyme", anchor, expectedBindingVersion: 1 });
  let snapshot = await a.read([], [anchor, second]);
  assert.equal(snapshot.bindings.find(row => row.key === anchor.key).category, "PHARMACY");
  assert.equal(snapshot.bindings.filter(row => row.key === second.key).length, 0);
  const two = await a.confirm({ newLabel: "Atelier Homonyme", anchor: second, expectedBindingVersion: 0 });
  assert.notEqual(one.key, two.key);
  const options = await a.search("Atelier Homonyme");
  assert.equal(options.length, 4);
  assert.equal(new Set(options.map(row => row.key)).size, 4);
  const choice = await a.confirm({ identityKey: "merchant:" + uuid(97003), anchor: second, expectedBindingVersion: 1 });
  assert.equal(choice.key, "merchant:" + uuid(97003));
  const png = await sharp({ create: { width: 48, height: 48, channels: 4, background: { r: 100, g: 160, b: 210, alpha: .4 } } }).png().toBuffer();
  const file = new File([png], "recette.png", { type: "image/png" });
  const first = await a.image(one.key, one.version, file);
  assert.equal(first.hasImage, true);
  const saved = await a.download(one.key, first.version);
  const meta = await sharp(Buffer.from(await saved.arrayBuffer())).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.hasAlpha, true);
  assert.equal(meta.width, 48);
  assert.equal(fixture.files.size, 1);
  fixture.faults.loseImageUpdateReply = true;
  const replacement = await a.image(one.key, first.version, new File([fixture.syntheticImage], "replacement.webp", { type: "image/webp" }));
  assert.equal(replacement.version, first.version + 1);
  assert.equal(fixture.files.size, 1);
  await assert.rejects(a.image(one.key, first.version, file), /BADGE_CONFLICT/u);
  await assert.rejects(a.confirm({ newLabel: "Atelier Homonyme", anchor, expectedBindingVersion: 1 }), /BADGE_CONFLICT/u);
  assert.equal((await a.search("Atelier Homonyme")).length, 4);
  assert.equal(fixture.files.size, 1);
  const race = await Promise.allSettled([a.category(one.key, replacement.version, "HOME"), a.category(one.key, replacement.version, "BEAUTY")]);
  assert.equal(race.filter(row => row.status === "fulfilled").length, 1);
  assert.equal(race.filter(row => row.status === "rejected" && /BADGE_CONFLICT/u.test(row.reason.message)).length, 1);
  const ownRead = await a.read([one.key], []);
  assert.equal(ownRead.media.length, 1);
  assert.ok(ownRead.media[0].imageUrl);
  assert.equal((await b.read([one.key], [anchor])).media.length, 0);
  assert.equal((await b.search("Atelier Homonyme")).filter(row => row.key.startsWith("personal:")).length, 0);
  assert.equal(await b.download(one.key, ownRead.media[0].version), null);
  const path = [...fixture.files.keys()][0];
  assert.ok((await fixture.client(fixture.other).storage.from("composer-badge-illustrations").download(path)).error);
  assert.ok((await fixture.client(fixture.other).storage.from("composer-badge-illustrations").upload(path + "x", png)).error);
  assert.ok((await fixture.client(fixture.other).from("composer_badge_visuals").insert({
    user_id: fixture.userId, identity_key: "personal:" + uuid(98999), label: "Refus",
  }).select("version").maybeSingle()).error);
  assert.equal((await a.read([], [{ ...anchor, digest: "f".repeat(64) }])).media.length, 0);
  for (const invalid of [
    new File([Buffer.from("<svg onload='alert(1)'/>")], "unsafe.png", { type: "image/png" }),
    new File([png], "bad.webp", { type: "image/webp" }),
    new File([Buffer.alloc(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
  ]) await assert.rejects(prepareBadgeImage(invalid), /BADGE_IMAGE_INVALID/u);
  const origin = "https://fixture.test";
  const request = (body, from = origin) => new Request(origin + "/api/composer/badge-library", {
    method: "POST", headers: { origin: from, "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const readCommand = { kind: "READ", keys: [one.key], anchors: [] };
  assert.equal((await fixture.request(request(readCommand, "https://foreign.test"), "COMMAND")).status, 403);
  assert.equal((await badgeRequest(request(readCommand), "COMMAND", async () => { throw new BootstrapAuthenticationRequiredError(); })).status, 401);
  assert.equal((await fixture.request(request({ ...readCommand, userId: fixture.other }), "COMMAND")).status, 400);
  assert.equal((await fixture.request(request({ ...readCommand, keys: ["merchant:invalid"] }), "COMMAND")).status, 400);
  assert.deepEqual(await fixture.pg.counts(), { plans: 0, revisions: 0 });
  await fixture.pg.verifyCanaries();
  console.log("M09-B · RLS de deux comptes, catégories indépendantes, homonymes, import transparent, remplacement, concurrence et fichiers invalides : PASS");
} finally { await fixture.pg.close(); }
