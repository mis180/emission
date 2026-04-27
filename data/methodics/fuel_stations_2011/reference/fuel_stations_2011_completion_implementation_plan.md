# fuel_stations_2011 — Completion Implementation Plan for Agent

**Purpose:** finish `fuel_stations_2011` to a reliable, releasable state without endlessly rebuilding the same methodic.

**Main rule:** do not delete and recreate `fuel_stations_2011`. Audit and patch the existing per-method authoring folders, rebuild generated output, verify, then assign release status by branch.

---

## 0. Conceptual double-check

You are not doing the wrong thing conceptually. The core architecture is correct:

```text
PDF / evidence
→ equation architecture note
→ normalized authoring JSON
→ generated build bundle
→ lookup/equation engine
→ traceable calculation result
→ project/report layer
```

The problem is probably scope control. You may be trying to make one large methodic feel “perfect” before moving on. That can trap the project.

The better target is:

```text
A methodic package is complete enough when:
1. the folder structure is stable,
2. every active branch can build,
3. every active branch has verified variables/equations/lookups,
4. every active branch has at least one golden case,
5. unsupported or uncertain branches are marked Beta/Internal/Blocked,
6. normal users only see Ready branches.
```

Do not require every obscure branch to be production-ready before starting the next methodic. Use branch-level release status.

---

## 1. Agent mission

The agent must complete a focused reliability pass for:

```text
data/methodics/fuel_stations_2011/
```

The agent must produce:

1. updated lookup audit findings,
2. repaired authoring JSON where needed,
3. rebuilt runtime `build/` files,
4. validation reports,
5. branch release matrix,
6. short release notes,
7. a clear list of remaining manual recheck items.

The agent must not:

- delete the methodic folder,
- rerun legacy restructuring/normalization from scratch,
- hand-edit generated `build/` files as source truth,
- invent lookup values,
- add methodic-specific exceptions into `app.js`, UI modules, or engine modules,
- expose unverified branches as normal production options.

---

## 2. Source-of-truth order

Use this order when files disagree:

1. actual repo files,
2. source PDF and evidence images,
3. authoring JSON in `section_*/*/` and `catalog/`,
4. generated `build/` files,
5. verification reports,
6. future architecture/product notes.

Generated `build/` files are runtime output only. They may be deleted and regenerated, but should not be manually repaired as the canonical source.

---

## 3. Scope decision

### In scope

```text
data/methodics/fuel_stations_2011/meta.json
data/methodics/fuel_stations_2011/catalog/*.json
data/methodics/fuel_stations_2011/section_4/*/*.json
data/methodics/fuel_stations_2011/section_5/*/*.json
data/methodics/fuel_stations_2011/section_6/*/*.json
data/methodics/fuel_stations_2011/section_7/*/*.json
data/methodics/fuel_stations_2011/reference/*.md
data/methodics/fuel_stations_2011/build_methodic.py
verification/reports/ or equivalent local reports folder
```

### Conditionally in scope

Only touch these if an actual generic bug is proven:

```text
engine/lookup-engine.js
engine/wizard.js
engine/evaluator.js
engine/graph-resolver.js
ui/wizard-ui.js
```

### Out of scope for this pass

```text
new methodics
large UI redesign
database persistence
full report mapper
GIS/meteo work
framework migration
```

---

## 4. Recommended release strategy

Do not treat `fuel_stations_2011` as one all-or-nothing methodic.

Assign status per branch:

| Status | Meaning | User visibility |
|---|---|---|
| Ready | Structurally valid, lookup-valid, formula-verified, golden case passes | normal users can use |
| Beta | Builds and mostly works, but needs manual PDF/golden review | advanced/internal only |
| Internal | Useful for development but not user-safe | hidden from normal users |
| Blocked | Known defect prevents reliable calculation | hidden |
| Not implemented | Branch exists in PDF but not implemented safely | hidden |

Suggested priority:

1. `7.1_combined` — most valuable for AZS liquid fuel stations.
2. `7.1_receive`, `7.1_refuel`, `7.1_storage` — verify as sub-branches.
3. `5.2_depot_tanks` — useful for depot/storage workflows.
4. `6.2_equipment`, `6.5_wastewater`, `6.6_sludge` — simpler source types if tables are clean.
5. `4.2`, `4.3`, `4.4`, `4.5`, `4.6` — keep Beta/Internal unless golden cases are strong.
6. `6.4_relief_valves` — likely requires special review because event logic differs from ordinary annual source flows.

---

## 5. Pre-flight setup

### 5.1 Create working branch

Use a branch name like:

```text
finish-fuel-stations-2011-lookup-release
```

### 5.2 Add the audit document

Place this file if not already present:

```text
data/methodics/fuel_stations_2011/reference/fuel_stations_2011_lookup_audit.md
```

### 5.3 Confirm skills are updated

The active `.agent` structure should be:

```text
.agent/
  README.md
  readme_big_picture.md
  skills/
    00_project_rules/
    10_methodic_lifecycle/
    20_product_workflow/
    30_maps_meteo_dispersion/
    40_persistence_audit/
    50_kz_reporting_era_alignment/
    90_future_architecture/
```

Do not keep old methodic skill folders active side by side with the new lifecycle skill.

---

## 6. Read-only audit phase

The first agent pass must be read-only. It should inspect and report before editing.

### 6.1 Folder inventory

For each method folder, confirm required files exist:

```text
manifest.json
variables.json
equations.json
flow.json
lookup_bindings.json
tables.json
ui.json
validation.json
```

If `manifest.json` or `validation.json` is not currently part of the actual package standard in the repo, do not invent it blindly. Record as missing/recommended, then check whether the build script expects it.

### 6.2 JSON parse audit

For every JSON file under:

```text
catalog/
section_4/
section_5/
section_6/
section_7/
```

check:

- valid JSON,
- no duplicate top-level IDs where uniqueness is required,
- no empty required arrays unless intentionally empty,
- no old prohibited fields in normalized authoring files.

Prohibited old fields in new authoring:

```text
auto_lookup
used_in_formula_codes
inline options arrays in variables
runtime_role in newly normalized records if category is standard
inline unit strings where unit_id should be used
```

Important: if the current repo still intentionally uses `runtime_role` for backward compatibility, do not mass-rewrite it without confirming the build/runtime expectations. Report the mismatch first.

### 6.3 Branch inventory

Create a table:

| Branch folder | formula_code | Flow path | Has variables | Has equations | Has lookups | Has tables | Initial status |
|---|---|---|---|---|---|---|---|

Expected branch groups:

```text
section_4:
  4_2_oil_gasoline_r38
  4_3_pure_substance
  4_4_known_mixture
  4_5_gas_in_water
  4_6_other_products_c20

section_5:
  5_2_depot_tanks

section_6:
  6_1_flanges
  6_2_equipment
  6_4_relief_valves
  6_5_wastewater
  6_6_sludge

section_7:
  7_1_receive
  7_1_refuel
  7_1_storage
  7_1_combined
  7_2_gas
```

### 6.4 Flow coverage audit

For each branch:

1. collect variables listed in `flow.json`,
2. confirm each exists in that method folder `variables.json`,
3. confirm every required user-facing variable has a UI entry or is intentionally hidden/system-managed,
4. confirm calculated outputs appear as variables if equations produce them.

Record:

```text
missing variable definitions
unused variable definitions
flow variables with no UI guidance
UI variables absent from flow
```

### 6.5 Equation dependency audit

For every runtime equation:

- `lhs_token` exists as a calculated variable,
- every RHS dependency exists in flow variables, prior equation outputs, constants, or supported math functions,
- equations are ordered or graph-resolvable,
- source equation IDs exist in `source_equations`, if used,
- output unit is declared.

Record:

```text
missing dependency
wrong variable ID
equation output not declared
source/runtime mismatch requiring PDF recheck
```

### 6.6 Lookup coverage audit

For every variable with category/role `lookup`:

- exactly one binding exists,
- binding target matches the variable ID,
- binding `table_id` exists in method `tables.json`,
- binding `output_key` exists in table outputs/rows,
- every selector input exists as variable,
- axis input exists when used,
- table resolution mode is supported,
- missing policy is explicit or inherited from table.

Create/update this table in `reference/fuel_stations_2011_lookup_audit.md`:

| Branch | Target variable | Table ID | Resolution | Selectors | Axis input | Output key | Policy | Status | Fix |
|---|---|---|---|---|---|---|---|---|---|

### 6.7 Enum/table domain audit

For every categorical selector used by a lookup:

1. collect enum values from `catalog/enums.json`,
2. collect actual selector values from table rows,
3. compare sets,
4. record alias/normalization needs.

Classify mismatches:

| Mismatch type | Meaning | Fix |
|---|---|---|
| enum too broad | user can choose values not covered by table | restrict branch options or mark values unsupported |
| table spelling differs | same concept, different token/spelling | add alias/normalization or normalize table rows |
| table missing row | PDF/extraction problem | repair table from evidence |
| enum missing value | table has legitimate value absent from enum | add enum value if branch needs it |

### 6.8 Table evidence audit

For every table consumed by active branches:

- table has `source` metadata,
- source has document/section/page/image reference where available,
- rows are complete,
- no placeholder/null output values unless intentionally blocked,
- no OCR garbage in selector values,
- numeric values parse as numbers,
- intervals do not overlap for range tables,
- interpolation axes are sorted and complete.

Do not try to verify every PDF table manually in the first pass. Prioritize tables used by Ready candidates.

Priority tables:

```text
Table_15_tank
Table_15_vehicle
Table_12
Table_Appendix_13
Table_Spill_J
Table_App_8
Table_App_10
Table_6_1
Table_6_3
Table_6_4
Table_6_5
```

### 6.9 UI guidance audit

For Ready-candidate branches, verify important user inputs have enough guidance:

- plain label comes from variable definition,
- `ui.json` has help text where needed,
- confusing fields have why/where/example guidance if the schema supports it,
- lookup fields are not presented as editable normal inputs,
- missing values produce actionable validation messages.

Minimum Ready-level guidance for `7.1_combined`:

```text
substance
climate_zone
tank_type
tank_type_storage
tank_volume_cat
PZV_receive
PZV_refuel
V_sl
t_unload
VTRK
NN
Qoz
Qvl
NP
```

### 6.10 Existing build script audit

Inspect `build_methodic.py` without editing first.

Confirm:

- it reads authoring folders,
- it merges catalog and section files as expected,
- it writes only to `build/`,
- it does not silently drop branch files,
- it reports duplicate IDs or conflicts,
- it preserves table/source provenance.

---

## 7. Fix phase — order of operations

Fix in this order. Do not jump to UI/engine before data integrity is clean.

### Fix level 1 — Hard structural blockers

Repair:

- invalid JSON,
- missing required files,
- missing variables referenced by flow/equations/bindings,
- broken table references,
- duplicate IDs that make build ambiguous.

### Fix level 2 — Lookup binding defects

Repair:

- wrong `target_variable`,
- wrong `table_id`,
- wrong `output_key`,
- wrong selector variable names,
- missing axis input,
- unsupported/old resolution mode.

### Fix level 3 — Enum/table normalization defects

Repair:

- enum value/token mismatch,
- aliases not applied,
- table rows using inconsistent values,
- UI selectors allowing unsupported table values.

Use normalized machine tokens in JSON. Keep Russian labels for display.

### Fix level 4 — Table row/evidence defects

Repair only from PDF/evidence. If a value cannot be verified:

- do not guess,
- mark as `manual_recheck`,
- block the branch or keep it Beta/Internal.

### Fix level 5 — Equation defects

Repair:

- missing dependencies,
- wrong units/conversion constants,
- source/runtime equation mismatch,
- branch aggregation mistakes.

Do not change formulas just to make a test pass. First check PDF/evidence and architecture note.

### Fix level 6 — UI/help defects

Improve user guidance only after data and formulas are stable.

### Fix level 7 — Generic engine defects only if proven

Only edit engine if:

- JSON is correct,
- table schema is valid,
- binding is valid,
- and the generic resolver still fails.

Engine changes must be generic capability improvements, not `fuel_stations_2011` shortcuts.

---

## 8. Lookup failure policy

Every lookup must end in one of these outcomes:

| Outcome | Use when |
|---|---|
| resolved | table returns trusted value |
| error/block | normative table value is required and missing |
| warning + manual override | PDF allows external/manual value or branch is advanced/internal |
| clamp with warning | interpolation/range boundary policy explicitly allows it |
| branch hidden | lookup coverage is not safe for normal users |

Never use hidden fallback values.

Manual override must preserve:

```text
variable ID
failed lookup selectors
original table/binding attempted
manual value
reason if available
warning status
report trace note
```

---

## 9. Build phase

After authoring fixes:

1. remove or ignore old generated files in `build/`,
2. run `build_methodic.py`,
3. confirm generated files exist:

```text
build/variables.json
build/equations.json
build/tables.json
build/flow.json
build/lookup_bindings.json
build/ui.json
build/build_report.json
```

4. confirm no authoring changes were made directly in `build/`,
5. inspect build report for warnings/errors.

---

## 10. Verification phase

### 10.1 Structural verification

Required checks:

- all JSON parses,
- every flow variable exists,
- every equation dependency exists,
- every lookup variable has one binding,
- every binding table exists,
- every binding output exists,
- every enum reference exists,
- every default selector value is valid,
- every UI variable exists,
- no prohibited old fields remain unless intentionally supported.

### 10.2 Lookup verification

For each Ready-candidate branch, run:

1. valid lookup case,
2. invalid selector case,
3. missing combination case,
4. boundary/range case if applicable,
5. interpolation case if applicable,
6. manual override case if allowed.

### 10.3 Equation verification

For each Ready-candidate branch:

- execute branch with known inputs,
- confirm all lookups resolve,
- confirm equations run in dependency order,
- confirm outputs `M` and/or `G` exist,
- confirm units are correct,
- confirm trace contains inputs, lookups, equations, and outputs.

### 10.4 Golden cases

Create or update golden cases for:

```text
7.1_combined gasoline station normal case
7.1_receive standalone
7.1_refuel standalone
7.1_storage standalone
5.2 depot tank normal case
6.2 equipment leakage if table 6.1 is clean
6.5 wastewater if table 6.3/6.4 is clean
6.6 sludge if table 6.5 is clean
```

Each golden case should include:

```text
branch/formula_code
raw inputs
normalized selectors
resolved lookup values
lookup provenance
expected equation steps where practical
expected outputs M/G with tolerance
status: verified / needs manual check
```

### 10.5 PDF semantic verification

For Ready branches only, manually recheck:

- formulas against PDF/equation architecture note,
- table values against evidence images or source PDF,
- unit conversions,
- branch aggregation logic,
- special assumptions such as non-simultaneous operations.

Record unresolved concerns as manual recheck items, not silent fixes.

---

## 11. Branch release matrix

At the end, create:

```text
data/methodics/fuel_stations_2011/reference/fuel_stations_2011_release_matrix.md
```

Template:

| Branch | Formula code | Structural | Lookup | Equation | Golden case | PDF recheck | Recommended status | Notes |
|---|---|---|---|---|---|---|---|---|
| 7_1_combined | 7.1_combined | pass/fail | pass/fail | pass/fail | pass/fail | pass/fail | Ready/Beta/Internal/Blocked | ... |

Only branches with all critical checks passing should be `Ready`.

---

## 12. Registry / visibility update

After release matrix is complete:

1. keep `fuel_stations_2011` active only if at least one Ready branch exists,
2. expose only Ready branches to normal users,
3. show Beta/Internal branches only in advanced or development mode,
4. hide Blocked/Not implemented branches,
5. add release notes explaining what is Ready and what remains under review.

If current registry does not support branch-level visibility, do not fake readiness. Add a clear TODO or implement a generic visibility mechanism.

---

## 13. Reporting and snapshot readiness

Do not block methodic completion on full persistence/database work.

However, make sure the calculation result can produce a snapshot-shaped record later:

```text
methodic id
methodic version/release id
formula_code
raw inputs
normalized selector values
resolved lookup values
lookup provenance
equation steps
outputs
composition
validation warnings/errors
```

This is enough to prepare for immutable calculation snapshots later.

---

## 14. Deliverables checklist

The agent is done with this pass when these files exist or are updated:

```text
data/methodics/fuel_stations_2011/reference/fuel_stations_2011_lookup_audit.md
data/methodics/fuel_stations_2011/reference/fuel_stations_2011_release_matrix.md
data/methodics/fuel_stations_2011/reference/fuel_stations_2011_release_notes.md
```

And these conditions are true:

```text
build/ regenerated from authoring files
structural verifier passes for Ready branches
lookup audit has no unresolved blockers for Ready branches
golden cases pass for Ready branches
manual recheck items are listed honestly
normal UI/registry does not expose unsafe branches as production-ready
```

---

## 15. Stop condition — when to move on to new methodics

Move on from `fuel_stations_2011` when:

1. `7.1_combined` is Ready or explicitly Beta with clear limitations,
2. the methodic package builds cleanly,
3. no hidden lookup defaults remain,
4. unverified branches are hidden or marked non-production,
5. at least one end-to-end golden case is passing,
6. remaining work is listed in release notes instead of kept in your head.

Do not wait for every section 4/5/6/7 branch to be perfect before starting the next methodic.

---

## 16. Agent execution prompt

Use this prompt for the next implementation agent:

```text
You are working on EMISSION. Your task is to finish the reliability pass for data/methodics/fuel_stations_2011.

Do not delete or recreate the methodic. Do not rerun legacy restructuring/normalization playbooks from scratch. Work on the existing per-method authoring folders and catalog files. Generated build files are runtime output only; rebuild them from authoring files and do not hand-edit them as source truth.

First perform a read-only audit. Update reference/fuel_stations_2011_lookup_audit.md with lookup coverage, enum/table mismatches, missing policies, and blockers. Then patch only the smallest necessary authoring JSON files. Rebuild with build_methodic.py. Run structural verification, lookup tests, and golden cases for Ready-candidate branches.

Prioritize branch 7.1_combined, then its sub-branches 7.1_receive, 7.1_refuel, 7.1_storage, then 5.2_depot_tanks. Keep uncertain branches Beta/Internal/Blocked rather than forcing them to production.

Never invent lookup values. If a PDF/table value cannot be verified, mark manual_recheck or block the branch. Do not add methodic-specific JavaScript exceptions. Engine changes are allowed only for generic resolver/evaluator bugs proven after data validation.

Final deliverables:
1. updated lookup audit,
2. release matrix by branch,
3. release notes,
4. rebuilt build/ output,
5. list of changed files,
6. validation/golden case results,
7. honest remaining manual recheck items.
```

---

## 17. Practical completion bar

For your own planning, treat this as the realistic finish line:

```text
fuel_stations_2011 v1 usable release:
- 7.1_combined Ready for normal AZS liquid fuel use
- receive/refuel/storage sub-branches verified enough to support combined
- lookup provenance visible in trace
- missing lookup values fail loudly
- remaining industrial/depot/unorganized branches either Beta/Internal or Ready based on actual verification
```

That is enough to start the next methodic without abandoning quality.
