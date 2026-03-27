#!/usr/bin/env python3
"""
migrate_tables_m1.py — Convert M1_storage/tables.json from dual-schema
(normative_tables + lookup_tables) to a unified self-describing format.

Usage:
    python3 scripts/migrate_tables_m1.py

Reads:  data/methodics/M1_storage/tables.json
Writes: data/methodics/M1_storage/tables_unified.json  (new file, does NOT overwrite original)
Also:   data/methodics/M1_storage/tables_backup.json   (backup of original)

After visual inspection, you can replace tables.json with tables_unified.json.
"""

import json
import os
import shutil
from collections import OrderedDict


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
M1_DIR = os.path.join(PROJECT_ROOT, "data", "methodics", "M1_storage")
SRC = os.path.join(M1_DIR, "tables.json")
DST = os.path.join(M1_DIR, "tables_unified.json")
BACKUP = os.path.join(M1_DIR, "tables_backup.json")


def load_source():
    with open(SRC, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Normative tables: convert from column-based to unified flat rows
# ---------------------------------------------------------------------------
def convert_normative(ntable):
    """Convert a normative_table to the unified format."""
    tid = ntable["id"]
    title = ntable.get("title", "")
    source = ntable.get("source", {})
    cols = ntable.get("columns", [])
    rows = ntable.get("rows", [])

    # Determine input keys (string/enum columns) and output keys (number columns)
    input_cols = [c["key"] for c in cols if c.get("type") == "string"]
    output_cols = [c["key"] for c in cols if c.get("type") == "number"]

    # Determine lookup_type
    # table_6_3 and table_6_4 have a single numeric input column and need interpolation
    numeric_input_cols = [c["key"] for c in cols if c.get("type") == "number" and c.get("unit") in ("°C", "%")]

    if numeric_input_cols:
        # These are interpolation tables (6_3 by temp, 6_4 by coverage %)
        lookup_type = "interpolate"
        interpolate_key = numeric_input_cols[0]
        # For these tables, the numeric column is both input and data
        new_table = {
            "id": tid,
            "title": title,
            "source": source,
            "lookup_type": lookup_type,
            "interpolate_key": interpolate_key,
            "output_keys": [c["key"] for c in cols if c["key"] != interpolate_key],
            "data": rows  # already flat
        }
    else:
        # Exact or multi-key
        if len(input_cols) <= 1:
            lookup_type = "exact"
        else:
            lookup_type = "multi_key_exact"

        new_table = {
            "id": tid,
            "title": title,
            "source": source,
            "lookup_type": lookup_type,
            "input_keys": input_cols,
            "output_keys": output_cols,
            "data": rows  # already flat
        }

    return new_table


# ---------------------------------------------------------------------------
# Lookup tables: convert from parameter-grouped key-value to unified flat rows
# ---------------------------------------------------------------------------
def compact_interpolation_rows(rows, key_name):
    """
    For an interpolation table, remove redundant rows that lie on the same
    linear segment. Keep only breakpoints where the slope changes.
    """
    # Convert keys to numeric and sort
    numeric_rows = []
    for r in rows:
        kv = r.get("keys", {}).get(key_name)
        v = r.get("value")
        if kv is None or v is None:
            continue
        try:
            nk = float(kv)
        except (ValueError, TypeError):
            continue
        numeric_rows.append((nk, v))

    if len(numeric_rows) <= 2:
        return [{key_name: k, "value": v} for k, v in numeric_rows]

    numeric_rows.sort(key=lambda x: x[0])

    # Keep breakpoints where slope changes
    result = [numeric_rows[0]]
    for i in range(1, len(numeric_rows) - 1):
        prev_k, prev_v = result[-1]
        curr_k, curr_v = numeric_rows[i]
        next_k, next_v = numeric_rows[i + 1]

        # Check if current point lies on the line between prev and next
        if next_k == prev_k:
            result.append(numeric_rows[i])
            continue

        expected = prev_v + (curr_k - prev_k) * (next_v - prev_v) / (next_k - prev_k)
        # Use a small tolerance for floating point
        if abs(curr_v - expected) > 1e-9:
            # Also check simpler: does slope change?
            slope_before = (curr_v - prev_v) / (curr_k - prev_k) if curr_k != prev_k else float('inf')
            slope_after = (next_v - curr_v) / (next_k - curr_k) if next_k != curr_k else float('inf')
            if abs(slope_before - slope_after) > 1e-9:
                result.append(numeric_rows[i])
            else:
                # On the line, skip
                pass
        # else: on the line, skip

    result.append(numeric_rows[-1])

    return [{key_name: k, "value": v} for k, v in result]


def compact_filtered_interpolation_rows(rows, filter_key, interp_key):
    """
    For tables like Table-7 that have a category filter + numeric interpolation,
    group by filter_key, then compact each group's interpolation data.
    """
    from collections import defaultdict
    groups = defaultdict(list)
    for r in rows:
        keys = r.get("keys", {})
        filter_val = keys.get(filter_key, "")
        groups[filter_val].append(r)

    result = []
    for filter_val, group_rows in groups.items():
        compacted = compact_interpolation_rows(group_rows, interp_key)
        for cr in compacted:
            row = {filter_key: filter_val}
            row[interp_key] = cr[interp_key]
            row["value"] = cr["value"]
            result.append(row)

    return result


def merge_parameters_to_flat_rows(parameters, key_fields):
    """
    For multi-parameter exact-match tables (like Table-1 with OBUV, PDK_mr, PDK_ss),
    merge all parameters sharing the same keys into single flat rows.
    """
    from collections import OrderedDict
    merged = OrderedDict()  # keyed by tuple of key values

    for param in parameters:
        param_name = param["parameter"]
        for r in param.get("rows", []):
            keys = r.get("keys", {})
            key_tuple = tuple(sorted(keys.items()))
            val = r.get("value")

            if key_tuple not in merged:
                merged[key_tuple] = dict(keys)
            merged[key_tuple][param_name] = val

    return list(merged.values())


def convert_lookup_table(lt, seen_ids):
    """Convert a single lookup_table entry to the unified format."""
    tname = lt["table_name"]
    label = lt.get("label", "")
    source = lt.get("source", "")
    params = lt.get("parameters", [])

    # Handle duplicate Table-8 by merging instead of creating a second entry
    if tname in seen_ids:
        return None, tname  # Will be merged later

    # Determine table type based on known structure
    table_configs = {
        "Table-1": {
            "lookup_type": "exact",
            "input_keys": ["substance"],
            "merge_params": True,
        },
        "Table-3": {
            "lookup_type": "exact",
            "input_keys": ["substance"],
            "merge_params": True,
        },
        "Table-4": {
            "lookup_type": "interpolate_with_filter",
            "filter_key": "substance",
            "interpolate_key": "t",
            "merge_params": False,
        },
        "Table-5": {
            "lookup_type": "interpolate",
            "interpolate_key": "t_nk",
            "merge_params": False,
        },
        "Table-7": {
            "lookup_type": "interpolate_with_filter",
            "filter_key": "substance",
            "interpolate_key": "t",
            "merge_params": False,
        },
        "Table-8": {
            "lookup_type": "multi_key_exact",
            "input_keys": ["group", "type", "mode", "volume"],
            "merge_params": True,
        },
        "Table-9": {
            "lookup_type": "interpolate",
            "interpolate_key": "Pt_mmHg",
            "merge_params": False,
        },
        "Table-10": {
            "lookup_type": "interpolate",
            "interpolate_key": "n",
            "merge_params": False,
        },
        "Table-12": {
            "lookup_type": "exact",
            "input_keys": ["substance"],
            "merge_params": True,
        },
    }

    cfg = table_configs.get(tname)
    if not cfg:
        # Unknown table, pass through with minimal cleanup
        print(f"  WARNING: Unknown table '{tname}', converting as-is")
        return {
            "id": tname,
            "title": label,
            "source": source,
            "lookup_type": "unknown",
            "parameters": params,
        }, tname

    new_table = {
        "id": tname,
        "title": label if label else tname,
        "source": source if source else {},
        "lookup_type": cfg["lookup_type"],
    }

    if cfg["lookup_type"] == "exact":
        new_table["input_keys"] = cfg["input_keys"]
        output_keys = [p["parameter"] for p in params]
        new_table["output_keys"] = output_keys
        if cfg.get("merge_params"):
            new_table["data"] = merge_parameters_to_flat_rows(params, cfg["input_keys"])
        else:
            # Single param
            p = params[0]
            new_table["data"] = [
                {**r["keys"], p["parameter"]: r.get("value")}
                for r in p.get("rows", [])
            ]

    elif cfg["lookup_type"] == "interpolate":
        ik = cfg["interpolate_key"]
        new_table["interpolate_key"] = ik
        output_keys = [p["parameter"] for p in params]
        new_table["output_keys"] = output_keys

        if len(params) == 1:
            p = params[0]
            compacted = compact_interpolation_rows(p.get("rows", []), ik)
            # Rename "value" to parameter name
            pname = p["parameter"]
            new_table["data"] = [
                {ik: r[ik], pname: r["value"]} for r in compacted
            ]
        else:
            # Multiple output params (unusual for interpolation but handle)
            new_table["data"] = merge_parameters_to_flat_rows(params, [ik])

    elif cfg["lookup_type"] == "interpolate_with_filter":
        fk = cfg["filter_key"]
        ik = cfg["interpolate_key"]
        new_table["filter_key"] = fk
        new_table["interpolate_key"] = ik
        output_keys = [p["parameter"] for p in params]
        new_table["output_keys"] = output_keys

        for p in params:
            pname = p["parameter"]
            compacted = compact_filtered_interpolation_rows(
                p.get("rows", []), fk, ik
            )
            # Rename "value" to parameter name
            for row in compacted:
                row[pname] = row.pop("value")

            if "data" not in new_table:
                new_table["data"] = compacted
            else:
                # Merge with existing data
                existing = {(r[fk], r[ik]): r for r in new_table["data"]}
                for row in compacted:
                    key = (row[fk], row[ik])
                    if key in existing:
                        existing[key].update(row)
                    else:
                        new_table["data"].append(row)

    elif cfg["lookup_type"] == "multi_key_exact":
        new_table["input_keys"] = cfg["input_keys"]
        output_keys = [p["parameter"] for p in params]
        new_table["output_keys"] = output_keys
        if cfg.get("merge_params"):
            new_table["data"] = merge_parameters_to_flat_rows(params, cfg["input_keys"])
        else:
            p = params[0]
            new_table["data"] = [
                {**r["keys"], p["parameter"]: r.get("value")}
                for r in p.get("rows", [])
            ]

    return new_table, tname


def merge_duplicate_table(existing, lt):
    """Merge parameters from a duplicate table entry into the existing one."""
    params = lt.get("parameters", [])
    for p in params:
        pname = p["parameter"]
        if pname not in existing.get("output_keys", []):
            existing["output_keys"].append(pname)

        # Merge data
        rows = p.get("rows", [])
        for r in rows:
            keys = r.get("keys", {})
            val = r.get("value")
            # Find matching row in existing data
            found = False
            for d in existing.get("data", []):
                match = True
                for k, v in keys.items():
                    if str(d.get(k, "")) != str(v):
                        match = False
                        break
                if match:
                    d[pname] = val
                    found = True
                    break
            if not found:
                new_row = dict(keys)
                new_row[pname] = val
                existing["data"].append(new_row)


def main():
    print(f"Loading: {SRC}")
    data = load_source()

    # Backup
    print(f"Backing up to: {BACKUP}")
    shutil.copy2(SRC, BACKUP)

    unified_tables = []

    # 1. Normative tables
    print("\n=== Converting normative_tables ===")
    for nt in data.get("normative_tables", []):
        print(f"  {nt['id']}: {len(nt.get('rows', []))} rows")
        unified_tables.append(convert_normative(nt))

    # 2. Lookup tables
    print("\n=== Converting lookup_tables ===")
    seen_ids = {}  # id -> index in unified_tables
    duplicates = []

    for lt in data.get("lookup_tables", []):
        tname = lt["table_name"]
        total_rows = sum(len(p.get("rows", [])) for p in lt.get("parameters", []))

        if tname in seen_ids:
            print(f"  {tname}: DUPLICATE — merging {total_rows} rows into existing")
            merge_duplicate_table(unified_tables[seen_ids[tname]], lt)
            continue

        result, tid = convert_lookup_table(lt, set(seen_ids.keys()))
        if result is None:
            print(f"  {tname}: skipped (duplicate)")
            continue

        new_rows = len(result.get("data", []))
        print(f"  {tname}: {total_rows} → {new_rows} rows ({result['lookup_type']})")

        seen_ids[tid] = len(unified_tables)
        unified_tables.append(result)

    # Build final output
    output = {"tables": unified_tables}

    # Write
    print(f"\nWriting: {DST}")
    with open(DST, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # Stats
    old_size = os.path.getsize(SRC)
    new_size = os.path.getsize(DST)
    old_lines = sum(1 for _ in open(SRC, encoding="utf-8"))
    new_lines = sum(1 for _ in open(DST, encoding="utf-8"))
    print(f"\n=== Summary ===")
    print(f"Old: {old_size:,} bytes, {old_lines:,} lines")
    print(f"New: {new_size:,} bytes, {new_lines:,} lines")
    print(f"Reduction: {(1 - new_size/old_size)*100:.1f}% bytes, {(1 - new_lines/old_lines)*100:.1f}% lines")
    print(f"\nBackup:  {BACKUP}")
    print(f"New:     {DST}")
    print(f"\nTo activate: mv tables_unified.json tables.json")


if __name__ == "__main__":
    main()
