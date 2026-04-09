# `scratch/` — Agent & Developer Workspace

## Purpose

Temporary Python/JS scripts used for one-off audits, data inspections, and
debugging during active development. These files are **not referenced by the
app** and are **not served** to the browser.

## Current Files

| File | Purpose |
|------|---------|
| `check_inputs.py` | Audits input variable definitions across methodics |
| `check_laws.py` | Verifies regulatory law references in question JSON |
| `check_missing.py` | Lists variables referenced in equations but not defined |
| `check_q.py` | Spot-checks individual question JSON entries |

## Rules

- New temporary agent scripts go here (not at project root).
- Do **not** delete without reviewing if the script is still needed.
- Scripts that become permanent dev tools should be moved to `scripts/`.
