# Agent Instructions — Branch-by-Branch Audit and Repair for `fuel_stations_2011`

## Purpose

You are auditing and repairing the EMISSION methodic package:

```text
data/methodics/fuel_stations_2011/
```

The goal is to complete `fuel_stations_2011` enough to create a controlled release, then allow future methodics to reuse the same pipeline.

This task is not a rewrite. Do not delete and recreate the methodic package.

Work incrementally:

```text
audit existing → fix only source-supported defects → rebuild → verify → recommend branch status
```

---

## Non-negotiable rules

1. Do not edit generated `build/` files directly.
2. Do not invent lookup values.
3. Do not insert hidden defaults.
4. Do not hardcode methodic-specific behavior in engine or UI files.
5. Do not change stable variable IDs unless there is a documented migration reason.
6. Do not promote a branch to public readiness unless its variables, equations, lookups, tables, validation, and at least one golden case pass.
7. If source evidence is missing or unclear, flag the issue instead of guessing.
8. If a branch passes, skip it and move on.
9. If a branch fails, trace the failure back to PDF/evidence before editing.
10. Keep branch readiness separate from package existence. A branch can exist in data but remain hidden from normal users.

---

## Files you may edit

Edit only authoring and verification files:

```text
data/methodics/fuel_stations_2011/catalog/
data/methodics/fuel_stations_2011/section_*/*/
data/methodics/fuel_stations_2011/reference/
data/methodics/fuel_stations_2011/verification/
data/methodics/fuel_stations_2011/meta.json
data/registry.json
```

You may regenerate:

```text
data/methodics/fuel_stations_2011/build/
```

but do not hand-edit files inside `build/`.

---

## Source priority

Use this source-of-truth order:

```text
1. Actual repo files
2. Source PDF and evidence images
3. Authoring JSON files under section_*/* and catalog/
4. Generated build files, only for runtime inspection
5. Verification reports, as check evidence but not proof of semantic correctness
6. Official internet sources, only if PDF/evidence is unclear
7. Non-official internet sources, as hints only and never as authority
```

If PDF/evidence and current JSON disagree, the PDF/evidence wins.

If official internet source and local PDF disagree, flag the conflict for manual review before editing.

---

## Branch audit order

Audit the methodic branch by branch in this order:

```text
1. section_7/7_1_receive
2. section_7/7_1_refuel
3. section_7/7_1_storage
4. section_7/7_1_combined
5. section_7/7_2_gas
6. section_5/5_2_depot_tanks
7. section_6/6_2_equipment
8. section_6/6_5_wastewater
9. section_6/6_6_sludge
10. section_4/4_2_oil_gasoline_r38
11. section_4/4_6_other_products_c20
12. section_4/4_3_pure_substance
13. section_4/4_4_known_mixture
14. section_4/4_5_gas_in_water
15. section_6/6_1_flanges
16. section_6/6_3_stationary_seals
17. section_6/6_4_relief_valves
```

Do not promote many branches at once. Finish and classify one branch before moving to the next.

---

## Files to inspect per branch

For each branch folder, inspect:

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

Also inspect shared files when needed:

```text
catalog/enums.json
catalog/units.json
catalog/aliases.json
catalog/composition.json
reference/2011_fuel_stations_equation_architecture.md
reference/fuel_stations_2011_lookup_audit.md
reference/fuel_stations_2011_completion_implementation_plan.md
verification/golden_cases.json
verification/report.md
```

---

## Required result categories

For every checked item, use exactly one of these statuses:

| Status | Meaning |
|---|---|
| `PASS` | Correct; no edit needed. |
| `FIXED` | Defect found and fixed using source-supported evidence. |
| `NEEDS_PDF_REVIEW` | PDF/evidence must be checked manually before fix. |
| `NEEDS_MANUAL_SOURCE` | PDF does not provide value; requires external manual/company/passport/lab data. |
| `NEEDS_ENGINE_SUPPORT` | Current generic engine cannot express a valid methodic rule. |
| `BLOCKED` | Branch/item is unsafe or incomplete and must not be public. |

Do not leave vague notes like “probably OK.” Use one of the statuses above.

---

# Part 1 — Branch manifest audit

For each branch, check `manifest.json` if present.

Verify:

```text
- branch id/folder name matches intended method
- formula_code is correct
- title/description match source method
- status is honest
- source section/page references exist when available
- branch is not marked public unless verified
```

If manifest is missing but the branch otherwise exists, either add one using the project’s branch pattern or flag it as `NEEDS_REVIEW`.

Recommended branch status values:

```text
ready_public
beta_limited
hidden_internal
blocked
not_implemented
```

---

# Part 2 — Variable audit

For every variable in `variables.json`, check:

```text
- id is stable and matches usage across flow/equations/bindings/ui
- token is correct
- label is human-readable
- datatype is correct
- category is correct
- unit_id exists in catalog/units.json when unit applies
- enum_id exists in catalog/enums.json when variable is selector
- default value, if present, is valid
- constraints are reasonable
- source_ref exists when the variable comes from PDF/source methodic
- source_token_aliases are useful when PDF notation differs
- notes explain ambiguity if needed
```

Allowed categories:

```text
input
selector
lookup
calculated
constant
derived_input
meta
```

Old fields must not remain in normalized authoring variables:

```text
runtime_role
unit
options
auto_lookup
used_in_formula_codes
default_value
```

If a variable uses an old field, replace it only if the correct normalized equivalent is clear. Otherwise flag it.

## Variable decision rules

If a value comes from a user/company/passport/lab document, classify as:

```text
input
```

If a value comes from a controlled categorical choice, classify as:

```text
selector
```

If a value comes from a methodic lookup table, classify as:

```text
lookup
```

If a value is produced by runtime equation, classify as:

```text
calculated
```

If a value is fixed by the methodic and does not depend on user input, classify as:

```text
constant
```

Do not classify a missing lookup as user input unless the PDF/methodic allows manual or external source values.

---

# Part 3 — Flow audit

For each branch `flow.json`, check:

```text
- formula_code matches the branch
- variables list contains all required inputs, selectors, lookup variables, intermediates, and outputs
- every variable listed exists in variables.json or shared catalog if applicable
- no unrelated branch variables are included
- branch-specific variables are complete enough for equations and lookups
```

Check equation dependencies against flow:

```text
Every RHS dependency must either:
- appear in flow variables, or
- be a prior calculated LHS in the same branch, or
- be an approved constant.
```

If the flow omits required variables, fix `flow.json` only if the branch requirements are clear from equations/PDF. Otherwise flag.

---

# Part 4 — Equation audit

For every equation in `equations.json`, check both source and runtime sides.

## Source equations

Check:

```text
- source equation id exists
- formula name is clear
- lhs symbol matches source
- rhs_source reflects PDF meaning
- latex is correct enough for review
- page/section/source reference exists
- image_ref exists when available
- confidence/status is honest
```

## Runtime equations

Check:

```text
- formula_code matches branch
- equation_order is correct
- lhs_token exists as calculated variable
- rhs uses valid variable ids
- dependencies list matches rhs
- output_unit_id exists
- source_equation_ids link to source_equations
- constants are source coefficients or unit conversions
- equation is deterministic and math-compatible
- runtime adaptation from PDF is explained if notation differs
```

## Equation fix policy

If equation fails:

1. Check the source PDF section/formula.
2. Check equation architecture note.
3. Check source_equations in the branch.
4. Check related variables and units.
5. Fix only if the source supports the change.
6. If unsure, flag as `NEEDS_SEMANTIC_REVIEW` or `NEEDS_PDF_REVIEW`.

Never change an equation only to make a test pass.

---

# Part 5 — Lookup binding audit

For every variable with category `lookup`, check `lookup_bindings.json`.

Verify:

```text
- binding exists
- target_variable matches variable id
- table_id exists in branch tables.json
- output_key exists in table outputs and rows
- selectors map table selector names to existing variable ids
- all selector variables exist
- selector variables have enum_id when categorical
- axis_input exists when table uses range/interpolate
- on_missing or missing policy is explicit
- trace_label is clear
```

For every binding, classify missing behavior:

```text
block_calculation
manual_override_allowed
manual_override_forbidden
warn_and_continue
clamp
warn_and_clamp
hidden_internal_until_fixed
```

If missing behavior is not explicit, add it if schema supports it or flag as `NEEDS_ENGINE_SUPPORT` / `NEEDS_SCHEMA_UPDATE`.

## Lookup failure decision tree

When lookup fails:

### Case A — Unsupported user selector

Example:

```text
Enum allows value that table does not cover.
```

Fix options:

```text
- restrict enum for this branch
- add alias/normalization if values mean the same thing
- hide branch option if unsupported
```

Do not fake table rows.

### Case B — Table row missing but PDF provides it

Fix:

```text
Update tables.json from PDF/evidence.
```

### Case C — Table row missing and PDF does not provide it

Fix:

```text
Flag as NEEDS_MANUAL_SOURCE or BLOCKED.
```

### Case D — Selector names are wrong

Fix:

```text
Update lookup_bindings.json selector map.
```

### Case E — Table mode is wrong

Fix:

```text
Change table resolution to exact / range / interpolate only if source structure supports it.
```

---

# Part 6 — Table audit

For every table used by the branch, check `tables.json`.

Verify:

```text
- schema_version is correct
- table_id matches lookup bindings
- title is clear
- source document/section/page/evidence exists
- resolution is exact, range, or interpolate
- selectors are declared correctly
- axis is correct or null
- outputs are declared correctly
- rows contain all required selector/output/axis fields
- unit_id values exist in catalog/units.json
- enum_id values exist in catalog/enums.json
- no duplicate exact selector combinations
- no overlapping range intervals
- interpolation points are sortable and complete
- boundary_policy is explicit when axis is used
- missing_policy is explicit
```

Allowed table resolutions:

```text
exact
range
interpolate
```

Do not use old or vague resolver modes such as:

```text
multi_key_exact
interpolate_with_filter
range_match
smart
```

## Table fix policy

If a table fails:

1. Check the PDF table or appendix.
2. Check evidence images/crops.
3. Check current rows against source values.
4. Fix rows only from reliable source evidence.
5. If a table cannot be verified, flag as `TABLE_NEEDS_RECHECK`.
6. If table is structurally wrong but values are reliable, repair schema without changing values.

---

# Part 7 — Enum and alias audit

For every selector used by the branch:

Check:

```text
- selector variable has enum_id
- enum_id exists in catalog/enums.json
- enum values cover all branch-supported choices
- table row values match enum values or aliases normalize them
- labels are clear for users
- branch does not expose selector values that cannot resolve required lookups
```

If enum values and table values differ only by spelling/case/language, prefer adding aliases or normalization rather than duplicating meaning.

If enum value is valid globally but unsupported by this branch, restrict via branch applicability or validation.

---

# Part 8 — UI/help audit

For every user-facing variable in `ui.json`, check:

```text
- ui.json does not duplicate label/unit/type/options
- variable_id exists
- required is present for required inputs
- integer_only is present when needed
- hidden is used only when intentional
- help_text is useful
- confusing inputs include why_needed, where_to_find, example_value, unknown_guidance if supported
- expert details are optional/expandable, not required for normal users
```

UI files must not contain:

```text
label
unit
type
disabled
auto_filled
options
lookup logic
equation logic
```

If user guidance is missing, add helpful text.

Example guidance fields:

```json
{
  "variable_id": "V_sl",
  "required": true,
  "help_text": "Объём топлива, сливаемого в резервуар за одну операцию.",
  "why_needed": "Используется для расчёта максимального выброса при сливе.",
  "where_to_find": "Журнал слива, проектная документация, паспорт оборудования.",
  "example_value": "10",
  "unknown_guidance": "Если неизвестно, используйте проектную максимальную операцию или отметьте как требующее уточнения.",
  "expert_note": "Соответствует символу V_сл в разделе 7.1."
}
```

Do not duplicate calculation semantics in UI.

---

# Part 9 — Validation audit

For each branch `validation.json`, check:

```text
- all required user inputs are validated
- numeric constraints exist where needed
- physical/recommended ranges are reasonable
- selector values are constrained
- lookup failure produces a clear error
- manual override is allowed only where methodic permits
- report blockers are separated from calculation blockers
- branch applicability conditions are represented if needed
```

Separate readiness types:

```text
calculation_ready
source_record_ready
report_ready
export_ready
```

If validation cannot express a necessary generic rule, flag `NEEDS_ENGINE_SUPPORT`. Do not hardcode the rule in UI.

---

# Part 10 — Composition / pollutant audit

If the branch emits pollutant groups or splits totals by composition, check:

```text
- composition profile exists if needed
- pollutant names are consistent
- pollutant fractions sum correctly when required
- source for composition is identified
- uncertain pollutant mapping is marked needs_review
- outputs M/G are mapped to pollutant rows correctly
```

If composition is uncertain, do not silently normalize pollutant names. Flag for review.

---

# Part 11 — Golden case audit

Each public-ready branch must have at least one golden case.

Check or create:

```text
data/methodics/fuel_stations_2011/verification/golden_cases.json
```

Each golden case should include:

```text
- branch/formula_code
- raw inputs
- normalized selectors
- expected lookup values
- expected outputs M/G
- tolerance
- source of expected result
- notes about manual/PDF calculation
```

A branch can be `beta_limited` with no complete golden case, but it must not be `ready_public`.

---

# Part 12 — Internet use rule

Use internet only when local PDF/evidence is unclear or missing.

Allowed internet sources:

```text
- official government/regulatory publication
- official standards body
- official methodic/source document mirror
- manufacturer documentation for user-entered equipment/passport values
```

Not allowed as authority:

```text
- random blogs
- unsourced forum posts
- copied spreadsheets without provenance
- AI-generated summaries
- unofficial tables unless used only as clues
```

If internet confirms a value, record source URL/reference in review notes. If internet conflicts with local PDF, flag the conflict.

---

# Part 13 — Fix policy

Allowed fixes:

```text
- repair wrong selector names
- repair enum/table value mismatch
- add aliases for normalization
- correct table rows from PDF evidence
- correct units/unit_id
- correct missing source_ref
- correct equation dependencies
- correct equation if PDF/evidence supports it
- improve UI help text
- improve validation rules
- update branch status honestly
- update ready_formula_codes after verification
```

Not allowed:

```text
- hidden defaults
- invented values
- hardcoded engine exceptions for this methodic
- deleting a branch because it fails
- changing variable IDs casually
- hand-editing build files
- marking a branch ready without PDF/evidence/golden-case support
```

---

# Part 14 — Branch result format

After each branch, write a result in:

```text
data/methodics/fuel_stations_2011/verification/report.md
```

Use this format:

```markdown
## Branch: <branch folder>

Formula code: `<formula_code>`

Status: PASS / FIXED / NEEDS_REVIEW / BLOCKED

Recommended visibility: ready_public / beta_limited / hidden_internal / blocked

### Passed
- ...

### Fixed
- ...

### Still flagged
- ...

### Files changed
- ...

### PDF/evidence checked
- ...

### Golden case status
- PASS / MISSING / NEEDS_UPDATE

### Notes
- ...
```

Every branch must have a result section, even if it is skipped as already passing.

---

# Part 15 — Build and verification after branch fixes

After editing authoring files, run the build script:

```bash
python data/methodics/fuel_stations_2011/build_methodic.py
```

Then run available verification scripts. If the repo contains a specific verification command, use it. Otherwise run available JSON/schema/build checks.

Minimum post-build checks:

```text
- all JSON parses
- build files generated
- no hand-edited build files treated as source
- every flow variable exists
- every equation dependency exists
- every lookup binding target exists
- every table referenced by binding exists
- every enum_id exists
- every unit_id exists
- no old fields remain in normalized authoring where prohibited
- ready branches have golden cases
```

---

# Part 16 — Release status rules

Only promote a branch to `ready_public` if:

```text
- variables pass
- flow passes
- equations pass
- lookup bindings pass
- tables pass
- UI/help passes enough for normal users
- validation passes
- at least one golden case passes
- no unresolved normative lookup exists
- PDF/evidence review is complete
```

Use `beta_limited` if:

```text
- branch is structurally executable
- no obvious hard failure remains
- but PDF semantic review or golden cases are incomplete
```

Use `hidden_internal` if:

```text
- branch exists but should not be shown to users
- branch is useful for internal development/testing only
```

Use `blocked` if:

```text
- branch is known wrong, unsafe, or missing required normative data
```

Use `not_implemented` if:

```text
- branch is planned but not actually implemented
```

---

# Part 17 — Updating visibility

If a branch becomes public-ready, update both relevant places:

```text
data/methodics/fuel_stations_2011/meta.json
data/registry.json
```

Update:

```text
- branch/source type visibility_status
- ready_formula_codes
- release notes if applicable
```

Do not expose beta/internal branches in normal UI.

If a branch is visible by mistake, fix metadata/registry visibility rather than deleting the branch.

---

# Part 18 — Recommended promotion order

After the 7.1 liquid fuel station branches, promote branches in this order:

```text
1. 7.2 gas
2. 5.2 depot tanks
3. 6.2 equipment
4. 6.5 wastewater
5. 6.6 sludge
6. 4.2 oil/gasoline R38
7. 4.6 other petroleum products C20
8. 4.3 pure substance
9. 4.4 known mixture
10. 4.5 gas in water
11. 6.1 flanges
12. 6.3 stationary seals
13. 6.4 relief valves
```

Do not promote all branches at once.

---

# Part 19 — Known likely issue to check

Check whether `7.1_combined` is labeled clearly.

It should not be labeled only as vehicle refueling if it includes receiving, storage, and refueling.

Suggested label:

```text
АЗС: слив, хранение и заправка жидкого топлива
```

or:

```text
АЗС: полный расчет жидкого топлива
```

Also ensure `7.1_combined` is mutually exclusive with separate `7.1_receive`, `7.1_refuel`, and `7.1_storage` in normal workflow to avoid double-counting.

---

# Part 20 — Final completion report

After all branches are audited, update or create:

```text
data/methodics/fuel_stations_2011/verification/report.md
```

The final report must include:

```text
- package summary
- branches audited
- branch readiness matrix
- lookup failures fixed
- lookup failures still flagged
- equation issues fixed
- equation issues still flagged
- table issues fixed
- table issues still flagged
- validation issues fixed
- validation issues still flagged
- golden case results
- recommended ready_formula_codes
- recommended beta_limited branches
- recommended hidden_internal branches
- recommended blocked branches
- files changed
- commands run
- what was not verified
```

End with a release recommendation:

```text
Release recommendation: Ready / Beta / Internal only / Not releasable
```

---

# Part 21 — Final agent command summary

Use this summary when starting the work:

```text
Audit fuel_stations_2011 branch by branch. For every variable, flow entry, equation, lookup binding, table, enum, UI field, validation rule, and golden case: mark PASS if correct, FIXED if repaired from PDF/evidence/official source, or FLAGGED if not source-supported. Do not guess. Do not edit build files. Rebuild after authoring changes. Produce verification/report.md with branch readiness recommendations and update meta/registry only for branches that are truly ready_public.
```

