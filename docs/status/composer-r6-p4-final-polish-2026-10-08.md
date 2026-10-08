# Composer R6-P4 — final visual polish and semantic composition

## 1. Executive verdict

**R6_P4_STATUS = PARTIAL.** The composition is coherent, operable, and ready for the requested human visual audit. Soirée and Week-end no longer scatter satellites around a central image; each has a hero and an ordered equipment row. Compact simple cards, distinct clusters, quieter Library and palette, clearer gift and family illustrations, and a softer HUD improve the scene. The result still falls short of the mockup's rich Clay volume and organic board composition. The Comparison surface also cannot show an authoritative Δ from the current published data. This is an honest visual verdict, independent of passing tests.

## 2. Git state

- Repository: `Budgetisation`; branch: `main`.
- HEAD before: `e72f63e6388bd8028a167d62f204f0f9637793cb`; worktree clean at start.
- Commit: `feat(composer): complete R6 P4 visual polish` (hash recorded in Git log after publication).
- No other branch, migration, DTO, server owner or domain module was changed.

## 3. Visual audit input

The P3.5 fixture was inspected at 1920×1080, 1728×900 and 1440×900 before editing. The P3.5 audit screenshots and measured geometry are in the task's `work/r6-p4-audit`; the previously published P3.5 report is `docs/status/composer-r6-p35-visual-cleanup-2026-10-08.md`. Baseline: Soirée/Week-end 340×225 with orbital sockets; Gift/Family 260×178; four simple cards 230×170; Beauty 390×178 and Food 430×178. The selected 1728 scene showed eleven top-level surfaces and one empty CTA per selected context.

## 4. User decision replacing the old brief

The P4 instruction explicitly replaces orbital satellites with equipment aligned at the bottom of a parent card. The UI now renders the published sockets in a stable presentation order within `contextEquipmentRow`. The server's orbital presentation field is left intact for compatibility, but no orbital position is rendered.

## 5. Icon audit

| Object or asset | Before | After | Reason/action |
|---|---|---|---|
| Courses / Café / Coiffeur | GOOD | GOOD | Basket, cup and scissors read before labels; retained. |
| Tabac/vape | MEDIUM | MEDIUM | Vape/cigarette silhouette is recognizable at card scale; small at Library scale. |
| Saving | GOOD | GOOD | Piggy bank and green surface distinguish savings; published label remains poor. |
| Soirée / Week-end | GOOD | GOOD | Disco ball and mountain retained as distinct hero assets. |
| Beauté / Restauration | GOOD | GOOD | Beauty products and bowl align with cluster semantics. |
| Cadeau | BAD | GOOD | Rebuilt a gift box with ribbon and bow; child clothing is a separate equipment tile. |
| Visite famille | BAD | MEDIUM | Rebuilt as house and three people; clearer, still geometrically simplified. |
| Bowling | BAD | BAD | Published generic activity key makes the Bowling context use a generic activity image. A label-based icon guess would violate the stable visual identity contract. |
| Activité / Livraison / Fast-food / Restaurant / Achat | GOOD | GOOD | Existing controller, scooter, burger, meal and garment assets remain aligned with their library actions. |

For the visible fixture: BAD matches fall from **3 to 1**. The remaining Bowling mismatch needs a published identity/key decision rather than a UI label heuristic. Gift and Family are improved within the shared Clay frame, without raster assets or heavy filters.

## 6. Card density audit

Visual empty-area ratio is qualitative, not a pixel-derived metric.

| Object | P3.5 size | P3.5 density / empty area | Hierarchy and problem | P4 action | P4 empty area |
|---|---:|---|---|---|---|
| Courses | 230×170 | Medium / medium | Icon, value and habitual reference too dispersed | TIGHTEN, 240×160 | LOW |
| Café | 230×170 | Medium / medium | One occurrence and person badge | TIGHTEN, 220×160 | LOW |
| Coiffeur | 230×170 | Medium / medium | Two occurrences and small stack | TIGHTEN, 220×160 | LOW |
| Tabac/vape | 230×170 | Medium / medium | Value/reference underused card | TIGHTEN, 230×160 | LOW |
| Saving | 290×170 | Medium / intentional medium | Progress and value clear, title long | SPECIALIZE, keep footprint | MEDIUM (intentional) |
| Soirée | 340×225 | Low / high | Orbital badges read as detached objects | RECOMPOSE, 350×220 | LOW |
| Week-end | 340×225 | Low / high | Several floating badges, weak grouping | RECOMPOSE, 360×220 | LOW |
| Beauté | 390×178 | Medium / medium | White thumbnail bubbles | ENRICH PRESENTATION, 530×168 | LOW |
| Restauration | 430×178 | Medium / medium | White thumbnail bubbles | ENRICH PRESENTATION, 460×168 | LOW |
| Cadeau | 260×178 | Low / high | Gift and garment visually merged | CHANGE ICON + RECOMPOSE, 240×158 | LOW |
| Visite famille | 260×178 | Low / high | Abstract identity and empty field | CHANGE ICON + SHRINK, 240×158 | MEDIUM |

No high empty-area card remains among the eleven target surfaces. At 1728 rest, the board below the third row still has unused **board** space because pagination and card height reserve the next row; this is a packing gap, not an oversized card.

## 7. Simple cards

The four routine cards use tighter heights, a small hero beside the title, a prominent published value/count and the existing habitual reference. Hover rises by one pixel. Utility actions are quiet until hover, focus or selection. Published unknown values stay unknown.

## 8. Composite contexts

Soirée and Week-end share a legible vertical grammar: Clay hero, title/date, subtle divider, then equipment row. Week-end keeps its green/mountain identity and five equipped slots; Soirée retains the disco ball and its chosen and suggested items. Gift and Family use the same parent grammar at a smaller footprint. Bowling also uses it because it is a real context in the fixture.

## 9. Equipment row

Rows retain each socket's `selectionId`, `assetKey`, `sourceSocket`, state, drag source, popover, acceptance, removal and replacement commands. Night order: main, before, outbound, return, food, extras. Week-end order: lodging, transport, activities, restaurants, groceries, purchases. REST shows zero empty sockets; SELECTED shows one primary `+` at most. Badges are compact illustrated tiles rather than generic white circles. Synthetic placeholder labels use the published slot label in the badge; their underlying identities are unchanged.

## 10. Clusters

Beauty and Food still aggregate presentation nodes only. The five children in each remain independent in overlays, with no fabricated financial total and no duplicate top-level child. Miniatures sit in a translucent shelf, with a compact `+1` and a clear “Ouvrir les objets” action. Cluster birth/dissolve keeps the existing stable ID and focus restoration path; no new remount animation was introduced because it risked interaction instability.

## 11. Saving

The green savings surface, piggy bank, published amount and progress remain distinct and the card is not automatically protected. `SAVING_DISPLAY_LABEL_GAP`: the fixture publishes “Synthetic adjustable saving”; no trusted user-facing replacement is present in the presentation contract. The technical label is preserved instead of silently inventing one.

## 12. Library

Softer boundaries, calmer section headers and less saturated mini-cards reduce competition with the board. Search, `/` shortcut, roving arrow focus, click, Enter and drag sources remain functional. Labels remain visible rather than trading readability for decorative minimalism.

## 13. Palette

The bottom palette reads as an equipment belt attached to the selected context. Its surface, dividers and tiles are quieter; the existing horizontal scroll and group rhythm stay intact. The 1728 selected capture retains all three target rows above the dock without clipping. The multiple-route chooser still exposes each safe route.

## 14. Semantic gravity

Deterministic presentation rank groups routines first, moments/projects next, visual clusters beside their related contexts, and savings in its own green treatment. Width and height now vary by role. This is a **partial** interpretation: the first row remains five horizontally aligned cards, so the board still reads partly as a dashboard.

## 15. Packing

The existing deterministic flow and pagination are preserved. No canvas, free coordinates or persisted position was added. At 1728 the selected reference page has eleven target surfaces; at 1440 pagination is reachable; at 1920 all seventeen fixture surfaces fit without vertical clipping. The mosaic centers in the extra 1920 width. More organic cross-row packing would require a separate layout pass and visual audit.

## 16. HUD

The metrics share a softer horizontal capsule and thin separators. Fin de mois remains visually primary; semantic colors remain for impact and margin. The fixture's `Fin de mois`, `Impact`, `Objectif` and `Marge` values are unknown and still render as `—`; `Sans changements` is 889,00 €. No null became zero and React does not recalculate finance.

## 17. Compare

The existing local snapshot behavior is unchanged. Current plan and variant receive stronger visual separation and secondary metrics attenuate. **Gap:** the brief's `ACTUEL / VARIANTE / Δ` triad is incomplete: the current published model does not supply a certified delta for this UI, and deriving one in React would break P4's financial boundary. No T7 Plan ↔ Maintenant was added.

## 18. Clay final

The shared frame now emphasizes top-left light and a second contact shadow. Gift and Family use layered forms within the existing vector palette. SVGs remain small, share material gradients, and have no heavy blur filters or raster dependency. Volume improves but remains visibly flatter and simpler than the supplied 3D mockup.

## 19. Typography

Header, simple values, context titles and metric labels use clearer weight and hierarchy. Small dates and habitual references remain secondary but legible. A few equipment labels wrap at this compact size; that tradeoff remains visible in the 1728 captures.

## 20. Hover and focus

Selected cards use a violet outline/halo without filling the whole surface. Actions appear on hover, focus-within or selection. The shared `focus-visible` outline remains strong; the browser test measured a solid outline after keyboard navigation.

## 21. Motion

Hover remains subtle. The existing `prefers-reduced-motion: reduce` rule removes transitions and animations for the workspace; browser emulation measured `0s` on a context card. Cluster birth/dissolve was left at its stable baseline rather than adding risky remount effects.

## 22. Accessibility

Card focus actions, library arrow navigation, component buttons, native popover/dialog, overlay Escape, drag alternatives and keyboard editor paths are retained. AtomicPopover now reports `aria-expanded`, mounts detailed content only while open, returns focus to its trigger on Escape, and attaches resize/scroll listeners only while open. The browser smoke confirmed these paths and the protected-trash refusal. Tiny secondary controls remain a candidate for the human contrast audit.

## 23. Three viewport validation

| Viewport | Result | Evidence |
|---|---|---|
| 1920×1080 | 17 surfaces on one page, no document overflow; mosaic centered | `images/composer-r6-p4/r6-p4-board-1920x1080.png` |
| 1728×900 | 11 target surfaces in selected reference scene, one Soirée CTA, palette fits | `images/composer-r6-p4/r6-p4-board-1728x900.png`, selected/palette captures |
| 1440×900 | Pagination required and reachable; both visible pages checked for clipping | `images/composer-r6-p4/r6-p4-board-1440x900.png` |

## 24. Business invariants

No business code, DTO, server owner or DB migration changed. Existing IDs, capabilities, mutations, source and target keys, financial nulls, comparison snapshot semantics and protection flags remain authoritative. The fixture checks verified zero DB writes and zero remote writes.

## 25. Structural performance check

`NEW_SERVER_CALLS=0`; `NEW_READWORLD_CALLS=0`. No new N+1 API route, drag library, coordinate persistence or heavy SVG filter. Popover body DOM and global resize/scroll handlers now exist only while a popover is open. This is a structural mini-check, not a runtime performance campaign.

## 26. Tests

`typecheck`, `build`, `check:composer-r6-p3`, `check:composer-r6-p35`, `check:composer-r6-presentation`, `check:phase2-planner-contexts`, `check:phase2-planner-mobility`, `check:phase2-planned-reality`, `check:phase2-planner-composer`, `check:phase2-planner-interactions`, `check:phase2-planner-visual-fidelity`, `check:phase2-planner-atomic-ui`, `check:phase2-planner-final-polish`, and new `check:composer-r6-p4` passed. P4 supplies twenty checks (`R6-P4-001` through `020`). The older R2 and R5 checks were updated only for their obsolete orbit/width/lazy-popover expectations. The first sandboxed Next build failed at Windows worker spawn (`EPERM`); the approved rerun compiled and completed successfully. Planner Kernel was deliberately not repaired or rerun; known baseline classification: `KNOWN_BASELINE_FAILURE_STALE_FORECAST_ORACLE`.

## 27. Browser smoke

The final fixture smoke exercises board open, 1728/1920/1440 geometry, library search and keyboard, simple focus and edit, Soirée selection, equipment row and popover, palette equip/replace, single and multi-route drag, trash and protected refusal, Week-end, Beauty/Food overlays, Undo, Redo, Compare, focus return and reduced-motion. All tested paths passed. Cluster dissolution was not separately simulated in the browser; the existing overlay cleanup and source tests remain unchanged.

## 28. Screenshots

The `images/composer-r6-p4/` directory contains the three board sizes plus `r6-p4-soiree-rest.png`, `r6-p4-soiree-selected.png`, `r6-p4-soiree-palette.png`, `r6-p4-weekend.png`, `r6-p4-beauty.png`, `r6-p4-food.png`, `r6-p4-library.png`, `r6-p4-hud.png`, `r6-p4-compare.png` and `r6-p4-keyboard-focus.png`. Machine-readable browser results sit alongside them. All images use the synthetic local fixture, not personal financial data.

## 29. Target comparison

| Area | P3.5 | P4 | Target | Match /5 | Remaining gap |
|---|---|---|---|---:|---|
| Header | Administrative | Tighter type | Editorial title | 3 | Still conventional |
| HUD | Cell-like | Softer capsule | Strong capsule hierarchy | 3 | Unknown fixture values limit comparison |
| Library | Dominant boxes | Calmer cards | Supporting shelf | 3 | Still a dense catalogue |
| Simple cards | Airy boxes | Compact | Dense recognisable objects | 4 | Some tiny references |
| Soirée | Orbit scatter | Hero + equipment row | Rich parent object | 4 | Clay still flat |
| Week-end | Orbit scatter | Ordered row | Rich distinct parent | 4 | Small labels wrap |
| Beauté | White circles | Embedded shelf | Integrated capsule | 4 | Vector depth limited |
| Restauration | White circles | Embedded shelf | Integrated capsule | 4 | Vector depth limited |
| Saving | Distinct but wordy | Softer green | Distinct saving object | 3 | `SAVING_DISPLAY_LABEL_GAP` |
| Palette | Toolbar feel | Equipment belt | Quiet attached belt | 3 | Still full-width |
| Board packing | Even rows | Variable width/height | Organic semantic gravity | 2 | First row remains regular |
| Clay | Flat vector | More light/shadow | Sculpted 3D | 2 | Largest artistic difference |
| Typography | Small hierarchy | Clearer | Mockup hierarchy | 3 | Context details small |
| Whitespace | Large card voids | Card voids reduced | Intentional breathing | 3 | Board-level blank at 1728 rest |
| Controls noise | Visible utilities | Quieter rest | Contextual only | 4 | A few micro-markers remain |

Overall target visual match: approximately **3/5**. Functional behavior and semantics are stronger than visual fidelity to the mockup.

## 30. Remaining gaps

1. `SAVING_DISPLAY_LABEL_GAP` requires a trusted published display label.
2. Bowling's generic activity image needs a stable published identity before semantic icon remapping.
3. Compare lacks a certified Δ; no UI arithmetic was introduced.
4. Organic packing and Clay volume still trail the target mockup; preserve the current deterministic, accessible flow until the user's visual audit decides whether P4.5 is needed.
5. A dedicated cluster dissolution browser scenario was not run in this pass.

## 31. Machine-readable handoff

```text
R6_P4_STATUS=PARTIAL
REPO_ROOT=Budgetisation
BRANCH=main
HEAD_BEFORE=e72f63e6388bd8028a167d62f204f0f9637793cb
HEAD_AFTER=SEE_GIT_LOG
WORKTREE_CLEAN_AT_START=YES
FINAL_WORKTREE_CLEAN=SEE_GIT_STATUS
USER_OVERRIDE_ORBITAL_LAYOUT_APPLIED=YES
CONTEXT_EQUIPMENT_ROW_IMPLEMENTED=YES
SOIREE_ORBIT_SCATTER_REMOVED=YES
WEEKEND_ORBIT_SCATTER_REMOVED=YES
SOIREE_REST_EMPTY_SOCKETS=0
SOIREE_SELECTED_PRIMARY_CTA=1
WEEKEND_REST_EMPTY_SOCKETS=0
WEEKEND_SELECTED_PRIMARY_CTA=1
CARD_DENSITY_AUDITED=YES
HIGH_EMPTY_AREA_CARDS_REMAINING=0_OF_11_TARGET
ICON_AUDIT_DONE=YES
BAD_ICON_MATCHES_BEFORE=3
BAD_ICON_MATCHES_AFTER=1
GIFT_ICON_FIXED=YES
FAMILY_VISIT_ICON_FIXED=YES_MEDIUM_REMAINING
CLUSTER_MINIATURES_REFINED=YES
GENERIC_WHITE_BUBBLE_OVERUSE_REDUCED=YES
LIBRARY_VISUAL_WEIGHT_REDUCED=YES
PALETTE_VISUAL_WEIGHT_REDUCED=YES
SEMANTIC_GRAVITY_IMPLEMENTED=PARTIAL
PACKING_DETERMINISTIC=YES
PERSISTED_COORDINATES=NO
HUD_REDESIGNED=YES
HUD_VALUES_CHANGED=NO
COMPARE_RESTYLED=YES
COMPARE_SEMANTICS_CHANGED=NO
CLAY_VOLUME_IMPROVED=YES_PARTIAL_TO_TARGET
ICON_REGISTRY_SINGLE_SOURCE=YES
KEYBOARD_ACCESSIBILITY=PASS_TESTED_PATHS
FOCUS_VISIBLE=YES
REDUCED_MOTION=YES
CONTRAST_REVIEW=PARTIAL_HUMAN_REVIEW_RECOMMENDED
VIEWPORT_1920=PASS
VIEWPORT_1728=PASS
VIEWPORT_1440=PASS_WITH_PAGINATION
BUSINESS_CODE_CHANGED=NO
DTO_CHANGED=NO
SERVER_OWNER_CHANGED=NO
DB_MIGRATION_CREATED=NO
UI_FINANCIAL_RECOMPUTATION=NO
NEW_SERVER_CALLS=0
NEW_READWORLD_CALLS=0
PLANNER_KERNEL=NOT_RERUN
EXPECTED_KERNEL_CLASSIFICATION=KNOWN_BASELINE_FAILURE_STALE_FORECAST_ORACLE
PLANNER_CONTEXTS=PASS
PLANNER_MOBILITY=PASS
PLANNED_REALITY=PASS
PLANNER_COMPOSER=PASS
PLANNER_INTERACTIONS=PASS
VISUAL_FIDELITY=PASS
ATOMIC_UI=PASS
R6_PRESENTATION=PASS
R6_P3=PASS
R6_P35=PASS
R6_P4_TEST=PASS_20_OF_20
TYPECHECK=PASS
BUILD=PASS
BROWSER_SMOKE=PASS_TESTED_PATHS
TARGET_VISUAL_MATCH=3_OF_5_PARTIAL
R6_FINAL_READY_FOR_HUMAN_AUDIT=YES
SCREENSHOTS=docs/status/images/composer-r6-p4
DOC_FILE=docs/status/composer-r6-p4-final-polish-2026-10-08.md
COMMIT_CREATED=SEE_GIT_LOG
COMMIT_HASH=SEE_GIT_LOG
NEXT_RECOMMENDED_STEP=CHATGPT_R6_FINAL_VISUAL_AUDIT
```

**Stop after P4.** No Kernel repair, T0 or Plan → Réel work was started.
