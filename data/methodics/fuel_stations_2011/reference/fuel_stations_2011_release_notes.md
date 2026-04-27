# fuel_stations_2011 - Release Notes

Date: 2026-04-25

## Ready Scope

The ready normal-user scope is limited to AZS liquid-fuel workflows:

- `7.1_receive`
- `7.1_refuel`
- `7.1_storage`
- `7.1_combined`

`7.1_combined` remains the recommended primary branch for normal AZS liquid-fuel station calculations. It includes receive, refuel, and storage losses; do not add `7.1_storage` separately for the same facility.

## Lookup Reliability Changes

- Added `substance_petroleum_products` to restrict fuel-station exact lookup branches to `gasoline_auto`, `diesel`, and `oils`.
- Added `substance_pure_app16` and connected Appendix 16 vapor-pressure lookup to the exact substances present in `Table_App_16`.
- Repaired `5_2_depot_tanks` to use `tank_type_storage` instead of the AZS `tank_type` selector for Appendix 13.
- Changed `Table_Appendix_13.missing_policy` from `default_zero` to `error`; zero values now come only from explicit table rows.
- Corrected `Pt_max` and `Pt_min` units from `mmhg` to `pa` to match `Table_App_16`.
- Added negative lookup verification support and cases for unsupported selectors.
- Added verifier checks for table selector enum coverage, cross-method `enum_id` conflicts, and lookup target/table output unit mismatches.
- Synchronized active method manifests with their lookup bindings through `shared_tables_used`.
- Aligned Section 7 subbranch manifest codes with runtime formula codes.
- Updated validation/test metadata so passing executable cases are `active`; beta branches remain `beta_pending_pdf_review` and are not exposed as production-ready.

## Verification

Commands run:

```powershell
python data\methodics\fuel_stations_2011\build_methodic.py
python verification\run_verification.py --package data\methodics\fuel_stations_2011
python verification\format_ag_review.py --report verification\reports\fuel_stations_2011.verification.json --output verification\reports\fuel_stations_2011.verification.review.md
```

Result:

- Build: success
- Verification hard fails: 0
- Verification warnings: 0
- Golden cases: 19 pass / 0 fail
- Equation cases: 19 pass / 0 fail
- Lookup cases: 25 pass / 0 fail

## Branch Visibility

`data/methodics/fuel_stations_2011/meta.json` now carries branch-level `visibility_status` values.

Normal UI exposes only `ready_public` source types. Beta/internal branches remain available in the data package for development and later review but are not presented as production-ready choices.

## Remaining Manual Recheck Items

- Full PDF semantic spot-check for Sections 4, 5, 6, and 7.2 before production exposure.
- `section_6/6_4_relief_valves` event logic and verification case design.
- Branch-specific source evidence/crop completeness for any branch promoted from Beta to Ready.
- Product composition/reporting alignment after calculation snapshots are introduced.
