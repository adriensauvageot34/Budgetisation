import assert from "node:assert/strict";
import { assertGlobalFoodAuthorityMonotonicity, selectGlobalFoodBackgroundVisibility } from "./lib/global-food-authority-monotonicity.mjs";

const promoted = { sourceRevision: 9, methodVersion: "global_food_rhythm@v2-purchase-aware" };
assert.equal(selectGlobalFoodBackgroundVisibility("DEFAULT", promoted, 9), "PURCHASE_AWARE_PILOT");
assert.doesNotThrow(() => assertGlobalFoodAuthorityMonotonicity(promoted, 9, "global_food_rhythm@v2-purchase-aware"));
assert.throws(
  () => assertGlobalFoodAuthorityMonotonicity(promoted, 9, "global_food_rhythm@v1"),
  /GLOBAL_FOOD_AUTHORITY_DOWNGRADE_REQUIRES_EXPLICIT_ROLLBACK/u,
);
assert.equal(selectGlobalFoodBackgroundVisibility("DEFAULT", promoted, 10), "DEFAULT");
assert.doesNotThrow(() => assertGlobalFoodAuthorityMonotonicity(promoted, 10, "global_food_rhythm@v1"));
console.log("Global V2 Food authority monotonicity: PASS");
