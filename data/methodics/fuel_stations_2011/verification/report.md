# fuel_stations_2011 Branch Audit Report

## Package summary
- Package: `fuel_stations_2011`
- Verification run: `python verification/run_verification.py --package data/methodics/fuel_stations_2011 --strict`
- Result: hard fails `0`, pdf re-checks `0`
- Scope: branch-by-branch variable/equation/flow/lookup/table consistency and runtime case pass status.

## Branch readiness matrix

| Branch | Formula code | Status | Recommended visibility | Golden | Equation | Lookup | Failed |
|---|---|---|---|---:|---:|---:|---:|
| `section_7/7_1_receive` | `7.1_receive` | `PASS` | `ready_public` | 1 | 1 | 2 | 0 |
| `section_7/7_1_refuel` | `7.1_refuel` | `PASS` | `ready_public` | 1 | 1 | 2 | 0 |
| `section_7/7_1_storage` | `7.1_storage` | `PASS` | `ready_public` | 1 | 1 | 3 | 0 |
| `section_7/7_1_combined` | `7.1_combined` | `PASS` | `ready_public` | 1 | 1 | 3 | 0 |
| `section_7/7_2_gas` | `7.2` | `PASS` | `beta_limited` | 1 | 1 | 0 | 0 |
| `section_5/5_2_depot_tanks` | `5.2` | `PASS` | `beta_limited` | 1 | 1 | 3 | 0 |
| `section_6/6_2_equipment` | `6.2` | `PASS` | `beta_limited` | 1 | 1 | 1 | 0 |
| `section_6/6_5_wastewater` | `6.5` | `PASS` | `beta_limited` | 1 | 1 | 1 | 0 |
| `section_6/6_6_sludge` | `6.6` | `PASS` | `beta_limited` | 1 | 1 | 1 | 0 |
| `section_4/4_2_oil_gasoline_r38` | `4.2` | `PASS` | `beta_limited` | 1 | 1 | 1 | 0 |
| `section_4/4_6_other_products_c20` | `4.6` | `PASS` | `beta_limited` | 1 | 1 | 1 | 0 |
| `section_4/4_3_pure_substance` | `4.3` | `PASS` | `beta_limited` | 1 | 1 | 3 | 0 |
| `section_4/4_4_known_mixture` | `4.4` | `PASS` | `beta_limited` | 1 | 1 | 1 | 0 |
| `section_4/4_5_gas_in_water` | `4.5` | `PASS` | `beta_limited` | 1 | 1 | 1 | 0 |
| `section_6/6_1_flanges` | `6.1` | `PASS` | `beta_limited` | 1 | 1 | 1 | 0 |
| `section_6/6_3_stationary_seals` | `6.3` | `PASS` | `beta_limited` | 1 | 1 | 1 | 0 |
| `section_6/6_4_relief_valves` | `6.4` | `BLOCKED` | `blocked` | 0 | 0 | 0 | 0 |

## Branch: section_7/7_1_receive

Formula code: `7.1_receive`

Status: PASS

Recommended visibility: ready_public

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[31, 33]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_7/7_1_refuel

Formula code: `7.1_refuel`

Status: PASS

Recommended visibility: ready_public

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[32, 33]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_7/7_1_storage

Formula code: `7.1_storage`

Status: PASS

Recommended visibility: ready_public

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[33]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_7/7_1_combined

Formula code: `7.1_combined`

Status: PASS

Recommended visibility: ready_public

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[31, 32, 33]`.

### Fixed
- Updated package metadata label and exclusivity guard in `meta.json` to clearly mark combined mode and prevent double-counting with separate 7.1 branches.

### Still flagged
- None.

### Files changed
- `data/methodics/fuel_stations_2011/meta.json`

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_7/7_2_gas

Formula code: `7.2`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[34]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_5/5_2_depot_tanks

Formula code: `5.2`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[21]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_6/6_2_equipment

Formula code: `6.2`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[23]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_6/6_5_wastewater

Formula code: `6.5`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[29]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_6/6_6_sludge

Formula code: `6.6`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[30]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_4/4_2_oil_gasoline_r38

Formula code: `4.2`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[17]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_4/4_6_other_products_c20

Formula code: `4.6`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[20]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_4/4_3_pure_substance

Formula code: `4.3`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[18]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_4/4_4_known_mixture

Formula code: `4.4`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[18]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_4/4_5_gas_in_water

Formula code: `4.5`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[19]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_6/6_1_flanges

Formula code: `6.1`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[22]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_6/6_3_stationary_seals

Formula code: `6.3`

Status: PASS

Recommended visibility: beta_limited

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[24, 25]`.

### Fixed
- None in this branch pass.

### Still flagged
- None.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- PASS

### Notes
- No equation-variable defects found in this branch during this audit pass.

## Branch: section_6/6_4_relief_valves

Formula code: `6.4`

Status: BLOCKED

Recommended visibility: blocked

### Passed
- Manifest, variables, equations, flow, lookup bindings, and validation files parsed and linked correctly.
- Runtime verification cases executed with no failures for available case sets.
- Source page traceability present in manifest: `[28]`.

### Fixed
- None in this branch pass.

### Still flagged
- Branch remains draft (`manifest.status=draft`) and has no golden/equation/lookup verification cases in runtime policy.

### Files changed
- None for branch-local files in this pass.

### PDF/evidence checked
- Automated traceability checks through manifest pages and equation source links; no missing evidence references reported by verifier.

### Golden case status
- MISSING

### Notes
- Keep hidden/blocked until method policy includes required runtime cases and branch exits draft state.

## Lookup failures fixed
- None (no lookup hard-fail cases in strict verification).

## Lookup failures still flagged
- None in strict verification output.

## Equation issues fixed
- None required; equation/token/dependency checks pass.

## Equation issues still flagged
- None in strict verification output.

## Table issues fixed
- None required; referenced tables resolve and validate.

## Table issues still flagged
- None in strict verification output.

## Validation issues fixed
- None required; branch validation files pass runtime verification policy checks.

## Validation issues still flagged
- `6.4` remains draft and intentionally excluded from ready-public policy.

## Golden case results
- 16/16 runtime-required methods have at least one passing golden case.
- `6.4` is draft and currently has no required golden case policy.

## Recommended ready_formula_codes
- `7.1_receive`, `7.1_refuel`, `7.1_storage`, `7.1_combined`

## Recommended beta_limited branches
- `7.2`, `5.2`, `6.2`, `6.5`, `6.6`, `4.2`, `4.6`, `4.3`, `4.4`, `4.5`, `6.1`, `6.3`

## Recommended hidden_internal branches
- None from the audited branch set.

## Recommended blocked branches
- `6.4`

## Files changed
- `data/methodics/fuel_stations_2011/meta.json`
- `data/methodics/fuel_stations_2011/verification/report.md`

## Commands run
- `python verification/run_verification.py --package data/methodics/fuel_stations_2011`
- `python data/methodics/fuel_stations_2011/build_methodic.py`
- `python verification/run_verification.py --package data/methodics/fuel_stations_2011 --strict`

## What was not verified
- No manual line-by-line PDF recalculation was repeated in this pass; this pass relied on existing source mappings and runtime verification.

Release recommendation: Beta
