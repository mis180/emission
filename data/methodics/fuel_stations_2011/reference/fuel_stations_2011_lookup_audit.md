# fuel_stations_2011 - Lookup Reliability Audit

Audit date: 2026-04-25

This is a static and runtime lookup reliability audit for `data/methodics/fuel_stations_2011`. It confirms that active lookup bindings resolve from authoring JSON and shared catalog tables without hidden defaults or hallucinated values. It does not replace full manual PDF semantic review for every non-ready branch.

## Current Snapshot

| Item | Result |
|---|---:|
| Build status | success |
| Runtime variables | 130 |
| Runtime equations | 56 |
| Runtime tables | 17 |
| Runtime lookup bindings | 32 |
| Runtime flow methods | 19 |
| Verification methods discovered | 20 |
| Golden cases | 19 pass / 0 fail |
| Equation cases | 19 pass / 0 fail |
| Lookup cases | 25 pass / 0 fail |
| Verification hard fails | 0 |
| Verification warnings | 0 |

Build warnings are expected:

- `USING_CATALOG_TABLES: loaded 17 tables from catalog/tables`
- `SKIPPED_METHOD: 6_4_relief_valves (status=draft)`

## Fixed Findings

| Area | Previous issue | Fix |
|---|---|---|
| Appendix 16 pure substances | `Table_App_16` had row values absent from the selector enum. | Added `substance_pure_app16`, pointed `Table_App_16` and `4_3_pure_substance.substance_pure` to it, and added positive/negative lookup cases. |
| Section 7 fuel station products | AZS branches used broad `substance`, allowing values not covered by fuel-station exact tables. | Added `substance_petroleum_products` with `gasoline_auto`, `diesel`, and `oils`; applied it to Section 7 liquid-fuel branches. |
| Section 5 depot products | Depot table lookups used broad `substance`. | Applied `substance_petroleum_products` to `5_2_depot_tanks`. |
| Section 6.1 flange products | Table 12 lookups used broad `substance`. | Applied `substance_petroleum_products` to `6_1_flanges`. |
| Section 5 depot tank type | `5_2_depot_tanks` reused AZS `tank_type` but Appendix 13 needs storage tank construction. | Replaced the branch-local flow, UI, binding, and verification input with `tank_type_storage`. |
| Appendix 13 missing policy | `Table_Appendix_13` used `default_zero`, which could hide unsupported combinations. | Changed `missing_policy` to `error`. Zero values remain explicit rows where encoded. |
| Appendix 16 pressure units | `Pt_max` and `Pt_min` were declared as `mmhg` while `Table_App_16` outputs `pa`. | Updated the variables and expected lookup units to `pa`. |
| Manifest lookup provenance | Active method manifests had empty `shared_tables_used` even when lookup bindings referenced catalog tables. | Synchronized `shared_tables_used` with each method's lookup bindings. |
| Section 7 subbranch manifest codes | `7_1_receive`, `7_1_refuel`, and `7_1_storage` manifests used generic `7.1` instead of runtime formula codes. | Aligned manifest `formula_code` with `flow.json` (`7.1_receive`, `7.1_refuel`, `7.1_storage`). |
| Validation/test lifecycle metadata | Several passing branches still had `method_status: draft`, `missing_tests: true`, or draft verification cases. | Added/updated validation metadata and marked executable verification cases `active` while keeping beta branches pending PDF review. |

## Selector Restrictions

The following user-facing selector restrictions are now data-driven from methodic JSON:

| Selector | Enum | Used by |
|---|---|---|
| `substance` | `substance_petroleum_products` | `5.2`, `6.1`, `7.1_receive`, `7.1_refuel`, `7.1_storage`, `7.1_combined` |
| `substance_pure` | `substance_pure_app16` | `4.3` |
| `tank_type_storage` | `tank_type_storage` | `5.2`, `7.1_storage`, `7.1_combined` |

The global `substance` enum remains available for other methodics/branches, but it is no longer used by the fuel-station exact lookup branches where table coverage is narrower.

## Runtime Lookup Coverage Added

| Method | Added lookup coverage |
|---|---|
| `4.3` | Appendix 16 positive case for `n_octane`; unsupported pure-substance negative case. |
| `5.2` | Appendix 13 storage-loss positive case; unsupported petroleum-table substance negative case. |
| `7.1_receive` | Unsupported tank-table substance negative case. |
| `7.1_refuel` | Unsupported vehicle/refuel-table substance negative case. |
| `7.1_storage` | Appendix 13 storage-loss positive case; unsupported storage-table substance negative case. |
| `7.1_combined` | Appendix 13 storage-loss positive case; unsupported tank-table substance negative case. |

Negative cases now pass only when the lookup resolver raises the expected no-match error.

## Current Blockers

There are no unresolved structural lookup blockers for the ready Section 7 liquid-fuel branches.

`section_6/6_4_relief_valves` remains draft and is skipped by the build. Keep it hidden/internal until its event logic, source equations, and verification cases are reviewed.

## Remaining Review Items

| Area | Status | Reason |
|---|---|---|
| Section 4 industrial tank branches | Beta | Runtime verification and metadata pass, but full PDF semantic spot-check is still needed before normal-user release. |
| Section 5 depot tanks | Beta | Lookup structure, tests, and metadata pass; keep beta until PDF semantic review confirms Appendix 13 and Table 12 assumptions. |
| Section 6 unorganized branches | Beta | Runtime verification and metadata pass; release should wait for branch-specific PDF review. |
| Section 7.2 gas branch | Beta | Runtime verification and metadata pass, but it is not part of the liquid AZS ready scope. |
| Relief valves `6.4` | Internal/Blocked | Draft branch skipped by build. |

## Validation Commands

```powershell
python data\methodics\fuel_stations_2011\build_methodic.py
python verification\run_verification.py --package data\methodics\fuel_stations_2011
python verification\format_ag_review.py --report verification\reports\fuel_stations_2011.verification.json --output verification\reports\fuel_stations_2011.verification.review.md
```
