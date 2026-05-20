# KIM Icing Potential Status

Updated: 2026-05-20 13:45 KST
Spec: docs/superpowers/specs/2026-05-20-kim-icing-potential-layer.md
Plan: docs/superpowers/plans/2026-05-20-kim-icing-potential-layer.md

## Resume Point
- Last completed: Codex documentation review completed; spec/plan reconciled before implementation.
  Fixes made: hydrometeor grid scale now consistently `2e-7`; public API no longer exposes `variant`;
  UI labels use potential classes, not light/moderate/severe severity; mutual exclusion is additive,
  not a generic single-rule refactor; icing index filtering now filters variables before map-time
  trimming; Task 3 has an explicit real-data magnitude/`w` sanity step.
- Next: Start Task 1 Step 1. Keep extra attention on Task 2 Step 0 level-index regression
  (`kim-cloud-api.test.js` must stop using `KIM_NWP_LEVELS[5]` as 300hPa), Task 3 effective
  KMA-call concurrency, and Task 3 Step 5 retry-skip completeness with icing variables.

## Verified
- Live KIM API probe (run 2026051912, 850hPa, hf0): tqc/tqi/tqr/tqs/w/cld/rh_liq all return
  200 OK full grids via nph-kim_nc_xy_txt2 (KIMG/NE57, data=P).
- Confirmed multi-variable call unsupported: `name=tqc,tqi` -> `NetCDF: Variable not found`.
  One HTTP call per variable.
- `w` is signed (e.g. -0.298), consistent with upward_air_velocity m/s.
- Official NE57 variable table (reference/NWP/251114_kimg_varn_8km.pdf) confirms tqc/tqi/tqr/tqs
  are per-level mass_fraction (kg/kg, 30 levels), not column-integrated. Only graupel (grle) is absent.
- Existing helpers confirmed present: encodeComponent/decodeComponent (MISSING_ENCODED=-32768),
  buildKimNwpIndex, filterKimNwpIndexForVariables, filterKimNwpIndexForMap (server.js), readKimNwpIndex.
- Codex code/docs review confirmed current frontend sliders read levels from filtered indexes, so
  600/400hPa should render automatically for wind/temp once present in the wind/temp indexes.
- Current `metLayerVisibility.js` has per-id wind/temp/cloud branches with windFlow/windSpeed details;
  implementation must add `icing` to those branches rather than replacing them with a generic loop.

## Unverified / Skipped
- No implementation or tests run yet (spec + plan stage only).
- `tqc/tqi/tqr/tqs` exact unit (kg/kg vs g/kg) and magnitude not cleanly confirmed
  (probe parser was polluted by coordinate columns) — to be checked in Task 3.
- `w` positive=upward orientation not yet confirmed against a known ascent case.

## Deviations from Plan
- Documentation-only reconciliation before implementation: spec/plan now use potential-class wording,
  no public `variant`, filter-before-map index ordering, additive mutual exclusion, and explicit
  real-data sanity checks.
- Added spec outline note as a future-only consideration for route vertical sections; it does not add
  implementation scope to this phase.
- Added a Subagent Execution Map to the plan so implementation can follow the long-context/Superpowers
  workflow with read-only mapper/reviewer/spec/test-gap/UI/architecture agents and sequential
  implementer ownership for coupled backend/frontend edits.

## Open Decisions Resolved
- Per-variable scale: keep u/v/T/rh at 0.01, add fine scales for new vars (w=0.001, cld=1e-4,
  tqc/tqi/tqr/tqs=2e-7), clip to int16, -32768 = missing.
- Collection: config-gated bulk fetch (kim_nwp.collect_icing) in same run, bounded concurrency,
  partial failure tolerant; NOT on-demand.
- SFIP-base implemented + tested internally but NOT exposed via API/UI (no variant param).
- Mutual exclusion: ADDITIVE icing block in metLayerVisibility.js (NOT a single-rule refactor),
  to preserve existing passing metLayerVisibility tests and windFlow/windSpeed/lowPower detail.
- rh_liq used for icing; Moisture's rh untouched this phase.
- Levels: extend shared KIM_NWP_LEVELS with 600hPa + 400hPa. Wind(u/v) and Temp(T) collect at all
  pressure levels, so wind/temp overlays gain 600/400 (intended, winds/temps aloft). Icing levels =
  925/850/700/600/500/400 (drop 300 = always gated below -35C; drop 10m = surface). Moisture stays
  925/850/700/500.

## Dependencies from the Moisture layer (now shipped)
- "Cloud Potential" was renamed to "Moisture" (T-Td spread, stepped green) but keeps internal names
  cloud / kim_nwp_cloud_potential / kimNwp.variables.cloud.hash. Mutual-exclusion key stays `cloud`,
  so the icing 4-way list (wind|temp|cloud|icing) is correct.
- Scheduler now has a retry-skip completeness guard (u/v/T all levels + rh moisture levels). ICING MUST
  extend it to also require icing variables when collect_icing is on, else retries are skipped before
  icing is collected and icing never populates. Captured in Task 3 Step 5.
- filterKimNwpIndexForMap now exposes nearest-past + future valid times; icing index inherits this
  automatically (no change needed).

## Notes for Next Session / Codex
- Icing is the 4th KIM NWP overlay after wind/temp/Moisture, on the same kim_nwp pipeline.
- This is "K-FIP-inspired guidance", NOT an official icing forecast. Keep naming conservative.
- Scientific validation (PIREP/AMDAR/GK2A) is a separate future track, not this map phase.
