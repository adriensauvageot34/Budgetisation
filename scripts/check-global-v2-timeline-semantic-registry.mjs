import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export default {};", shortCircuit: true };
    }
    const target = specifier.startsWith("@/")
      ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href
      : specifier;
    try {
      return nextResolve(target, context);
    } catch (originalError) {
      if ((!target.startsWith(".") && !target.startsWith("file:")) || /\.[cm]?[jt]sx?$/u.test(target)) {
        throw originalError;
      }
      for (const candidate of [`${target}.ts`, `${target}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const taxonomy = await import("../src/analytics/global-v2/timeline-semantic-taxonomy.ts");
const assertions = await import("../src/server/canonical/timeline-semantic-assertions.ts");
const migrationPath = path.join(root, "supabase", "migrations", "20260917131428_add_timeline_semantic_assertions.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const repositorySource = fs.readFileSync(path.join(root, "src", "server", "canonical", "timeline-semantic-assertions.ts"), "utf8");

let checks = 0;
const check = (callback) => { callback(); checks += 1; };
const rejects = (callback, pattern) => check(() => assert.throws(callback, pattern));
const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const householdId = uuid(1);

check(() => assert.equal(taxonomy.TIMELINE_SEMANTIC_TAXONOMY_VERSION, "timeline_semantic_taxonomy@v1"));
check(() => assert.deepEqual(taxonomy.timelineSemanticTaxonomyCounts, { GRAND: 7, INTERMEDIATE: 20, CLOSE: 53 }));
check(() => assert.equal(taxonomy.timelineSemanticTaxonomy.length, 80));

const canonicalTaxonomy = taxonomy.timelineSemanticTaxonomy.map((entry) => ({
  level: entry.level,
  key: entry.key,
  label: entry.label,
  parentKey: entry.parentKey ?? null,
  parentLevel: entry.parentLevel ?? null,
}));
check(() => assert.equal(
  createHash("sha256").update(JSON.stringify(canonicalTaxonomy)).digest("hex"),
  "45fbae7993856ddc2653819785759685ddea114c7f52b5b57ed35192abfbf55b",
  "Le catalogue doit rester byte-equivalent à fixture.taxonomy après normalisation null.",
));

check(() => assert.deepEqual(
  taxonomy.resolveTimelineSemanticClassification("soiree_techno_rave"),
  {
    taxonomyVersion: "timeline_semantic_taxonomy@v1",
    close: { key: "soiree_techno_rave", label: "Soirée techno / rave" },
    intermediate: { key: "sorties_festives_et_nocturnes", label: "Sorties festives & nocturnes" },
    grand: { key: "sorties_loisirs_et_culture", label: "Sorties, loisirs & culture" },
  },
));
rejects(() => taxonomy.resolveTimelineSemanticClassification("unknown"), /CLOSE_FAMILY_UNKNOWN/);
rejects(() => taxonomy.resolveTimelineSemanticClassification("soiree_techno_rave", "v2"), /VERSION_INVALID/);

const validDraft = {
  assertionId: uuid(2),
  eventRef: { sourceKind: "MOMENT", momentId: uuid(3) },
  visibilityTier: "PRINCIPAL",
  closeFamilyKey: "soiree_techno_rave",
  taxonomyVersion: "timeline_semantic_taxonomy@v1",
  authority: "DECLARED_BY_USER",
  provenance: "CONTROLLED_SOURCE_PACK",
  evidenceRefs: [`moment:${uuid(3)}`],
  sourceRevision: 3,
  declaredAt: "2026-09-17T10:00:00.000Z",
  validatedAt: "2026-09-17T10:00:00.000Z",
};
check(() => assert.deepEqual(assertions.parseTimelineEventSemanticAssertionDraft(validDraft), validDraft));
rejects(() => assertions.parseTimelineEventSemanticAssertionDraft({ ...validDraft, eventRef: { sourceKind: "MOMENT", momentId: uuid(3), lifeEventId: uuid(4) } }), /EVENT_XOR_INVALID/);
rejects(() => assertions.parseTimelineEventSemanticAssertionDraft({ ...validDraft, eventRef: { sourceKind: "MOMENT" } }), /EVENT_XOR_INVALID/);
rejects(() => assertions.parseTimelineEventSemanticAssertionDraft({ ...validDraft, eventRef: { sourceKind: "LIFE_EVENT", momentId: uuid(3) } }), /EVENT_REF_KIND_INVALID/);
rejects(() => assertions.parseTimelineEventSemanticAssertionDraft({ ...validDraft, visibilityTier: "VISIBLE" }), /VISIBILITY_INVALID/);
rejects(() => assertions.parseTimelineEventSemanticAssertionDraft({ ...validDraft, taxonomyVersion: "timeline_semantic_taxonomy@v2" }), /VERSION_INVALID/);
rejects(() => assertions.parseTimelineEventSemanticAssertionDraft({ ...validDraft, closeFamilyKey: "sorties_festives_et_nocturnes" }), /CLOSE_FAMILY_UNKNOWN/);

const validRow = {
  timeline_event_semantic_assertion_id: validDraft.assertionId,
  household_id: householdId,
  moment_id: validDraft.eventRef.momentId,
  life_event_id: null,
  visibility_tier: validDraft.visibilityTier,
  close_family_key: validDraft.closeFamilyKey,
  taxonomy_version: validDraft.taxonomyVersion,
  authority: validDraft.authority,
  provenance: validDraft.provenance,
  evidence_refs: validDraft.evidenceRefs,
  source_revision: validDraft.sourceRevision,
  declared_at: validDraft.declaredAt,
  validated_at: validDraft.validatedAt,
  is_active: true,
};
check(() => assert.equal(assertions.parseTimelineEventSemanticAssertionRow(validRow, householdId).classification.grand.key, "sorties_loisirs_et_culture"));
rejects(() => assertions.parseTimelineEventSemanticAssertionRow(validRow, uuid(9)), /CROSS_HOUSEHOLD/);

const createTable = migration.match(/create table public\.timeline_event_semantic_assertions[\s\S]*?\n\);/iu)?.[0] ?? "";
check(() => assert.match(createTable, /num_nonnulls\(moment_id, life_event_id\) = 1/u));
check(() => assert.doesNotMatch(createTable, /intermediate_family_key|grand_family_key/iu));
check(() => assert.equal((createTable.match(/^\s*'[a-z0-9_]+'[,]?\s*$/gmu) ?? []).length, 53));
const sqlCloseKeys = (createTable.match(/close_family_key text not null check \(close_family_key in \(([\s\S]*?)\n  \)\)/iu)?.[1].match(/'([a-z0-9_]+)'/gu) ?? [])
  .map((entry) => entry.slice(1, -1));
const catalogCloseKeys = canonicalTaxonomy.filter(({ level }) => level === "CLOSE").map(({ key }) => key);
check(() => assert.deepEqual(sqlCloseKeys, catalogCloseKeys));
check(() => assert.match(migration, /create unique index timeline_event_semantic_one_active_moment[\s\S]*where is_active and moment_id is not null/iu));
check(() => assert.match(migration, /create unique index timeline_event_semantic_one_active_life_event[\s\S]*where is_active and life_event_id is not null/iu));
check(() => assert.match(migration, /enable row level security/iu));
check(() => assert.match(migration, /revoke all on table public\.timeline_event_semantic_assertions from public, anon, authenticated/iu));
check(() => assert.match(migration, /grant select, insert, update on table public\.timeline_event_semantic_assertions to service_role/iu));
check(() => assert.match(migration, /assert_timeline_semantic_entity_household_scope/iu));
check(() => assert.doesNotMatch(migration, /update\s+public\.household_revisions|insert\s+into\s+public\.household_revisions/iu));
check(() => assert.match(repositorySource, /\.eq\("household_id", this\.context\.householdId\)/u));
check(() => assert.match(repositorySource, /p_household_id: this\.context\.householdId/u));

console.log(`Global V2 timeline semantic registry checks: ${checks} passed.`);
