# Migration: Shared Table Storage

**Date**: 2026-04-20
**Target**: `fuel_stations_2011`

## Decision
Move from per-method and flat catalog lookup table storage to a shared catalog structure where each table has its own directory containing both the JSON definition and the source evidence.

## Target Architecture
- **Catalog**: `catalog/tables/<table_id>/`
- **JSON**: `catalog/tables/<table_id>/table.json`
- **Evidence**: `catalog/tables/<table_id>/source.png`
- **Registry**: `catalog/tables/index.json`

## Status
Migration in progress. `build_methodic.py` updated to prioritize this structure.
Legacy `lookup_tables/` and flat JSON files in `catalog/tables/` will be removed after verification.
