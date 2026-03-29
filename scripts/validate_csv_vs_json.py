#!/usr/bin/env python3
"""
validate_csv_vs_json.py -- CSV vs JSON Data Integrity Validator

Compares lookup_tables/*.csv files against tables.json for each methodic.
Reports mismatches in row counts, column names, and cell values.

Usage:
    python scripts/validate_csv_vs_json.py
    python scripts/validate_csv_vs_json.py --methodic M3_unorganized
    python scripts/validate_csv_vs_json.py --verbose

Exit codes:
    0 = all tables match
    1 = mismatches found
"""

import csv
import json
import os
import sys
import argparse
from pathlib import Path

# --- Configuration ---
FLOAT_TOLERANCE = 1e-6
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "methodics"

# CSV columns that are informational-only (skip during comparison)
SKIP_CSV_COLS = {"row_no", "source_note", "density_g_cm3_raw"}

# JSON columns that are UI-only (skip during comparison)
SKIP_JSON_COLS = {"label", "note"}


def load_json_tables(methodic_path):
    """Load tables.json and return dict keyed by table id."""
    tables_path = methodic_path / "tables.json"
    if not tables_path.exists():
        return {}
    with open(tables_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    tables = data.get("tables", [])
    return {t["id"]: t for t in tables}


def load_index_csv(methodic_path):
    """Load index.csv and return list of dicts."""
    index_path = methodic_path / "lookup_tables" / "index.csv"
    if not index_path.exists():
        return []
    with open(index_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def load_csv_data(csv_path):
    """Load a CSV file and return (headers, rows)."""
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        rows = list(reader)
    return headers, rows


def try_parse_number(val):
    """Try to parse a string as a number."""
    if val is None or val == "" or val == "-":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return val


def values_match(csv_val, json_val, tolerance=FLOAT_TOLERANCE):
    """Compare two values with float tolerance."""
    csv_parsed = try_parse_number(csv_val)
    json_parsed = try_parse_number(json_val)

    # Both None/empty
    if csv_parsed is None and json_parsed is None:
        return True

    # One None, other not
    if csv_parsed is None or json_parsed is None:
        return False

    # Both numeric
    if isinstance(csv_parsed, float) and isinstance(json_parsed, (int, float)):
        return abs(csv_parsed - float(json_parsed)) < tolerance

    # String comparison
    return str(csv_parsed).strip() == str(json_parsed).strip()


def validate_methodic(methodic_path, verbose=False):
    """Validate all CSV files against tables.json for one methodic."""
    methodic_id = methodic_path.name
    json_tables = load_json_tables(methodic_path)
    index_entries = load_index_csv(methodic_path)

    if not json_tables:
        print(f"  ⏭️  No tables.json found")
        return 0, 0, 0

    if not index_entries:
        print(f"  ⏭️  No lookup_tables/index.csv found")
        return 0, 0, 0

    total = 0
    passed = 0
    failed = 0

    for entry in index_entries:
        table_id = entry.get("table_id", "").strip()
        filename = entry.get("filename", "").strip()
        total += 1

        csv_path = methodic_path / "lookup_tables" / filename
        if not csv_path.exists():
            print(f"  ❌ {table_id}: CSV file not found: {filename}")
            failed += 1
            continue

        # Find matching JSON table
        json_table = json_tables.get(table_id)
        if not json_table:
            # Try alternate ID formats
            for alt_id in [f"Table-{table_id}", f"table_{table_id}", table_id.replace("_", "-")]:
                if alt_id in json_tables:
                    json_table = json_tables[alt_id]
                    break

        if not json_table:
            print(f"  ⚠️  {table_id}: CSV exists ({filename}) but no matching JSON table found")
            print(f"       Available JSON table IDs: {list(json_tables.keys())}")
            failed += 1
            continue

        csv_headers, csv_rows = load_csv_data(csv_path)
        json_data = json_table.get("data", [])

        # --- Row count check ---
        csv_count = len(csv_rows)
        json_count = len(json_data)

        issues = []

        if csv_count != json_count:
            issues.append(f"Row count mismatch: CSV={csv_count}, JSON={json_count}")

        # --- Column check ---
        csv_cols = set(csv_headers) - SKIP_CSV_COLS
        json_cols = set()
        if json_data:
            json_cols = set(json_data[0].keys()) - SKIP_JSON_COLS

        csv_only = csv_cols - json_cols
        json_only = json_cols - csv_cols

        if csv_only and verbose:
            issues.append(f"CSV-only columns (need mapping?): {csv_only}")
        if json_only and verbose:
            issues.append(f"JSON-only columns (UI/derived?): {json_only}")

        # --- Value comparison (for shared columns) ---
        shared_cols = csv_cols & json_cols
        value_mismatches = 0
        min_rows = min(csv_count, json_count)

        for i in range(min_rows):
            csv_row = csv_rows[i]
            json_row = json_data[i]
            for col in shared_cols:
                csv_val = csv_row.get(col, "")
                json_val = json_row.get(col)
                if not values_match(csv_val, json_val):
                    value_mismatches += 1
                    if verbose and value_mismatches <= 5:
                        issues.append(
                            f"  Row {i+1}, col '{col}': CSV='{csv_val}' vs JSON='{json_val}'"
                        )

        if value_mismatches > 0:
            issues.append(
                f"Value mismatches: {value_mismatches} cells differ in {len(shared_cols)} shared columns"
            )

        # --- Report ---
        if issues:
            print(f"  ⚠️  {table_id} ({filename}):")
            for issue in issues:
                print(f"       {issue}")
            failed += 1
        else:
            if verbose:
                print(f"  ✅ {table_id} ({filename}): {csv_count} rows, {len(shared_cols)} shared cols — OK")
            passed += 1

    return total, passed, failed


def main():
    parser = argparse.ArgumentParser(description="Validate CSV ↔ JSON data integrity")
    parser.add_argument("--methodic", help="Validate only this methodic (e.g., M3_unorganized)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    args = parser.parse_args()

    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    print("=" * 60)
    print("EMISSION -- CSV vs JSON Data Integrity Validator")
    print("=" * 60)

    if not DATA_DIR.exists():
        print(f"❌ Data directory not found: {DATA_DIR}")
        sys.exit(1)

    total_tables = 0
    total_passed = 0
    total_failed = 0

    methodic_dirs = sorted(DATA_DIR.iterdir())
    if args.methodic:
        methodic_dirs = [DATA_DIR / args.methodic]

    for methodic_path in methodic_dirs:
        if not methodic_path.is_dir():
            continue

        print(f"\n📦 {methodic_path.name}")
        t, p, f = validate_methodic(methodic_path, verbose=args.verbose)
        total_tables += t
        total_passed += p
        total_failed += f

    print("\n" + "=" * 60)
    print(f"SUMMARY: {total_tables} tables checked, {total_passed} ✅ passed, {total_failed} ⚠️ issues")
    print("=" * 60)

    if total_failed > 0:
        print("\n⚠️  Some tables have discrepancies. Review above and fix CSV or JSON.")
        sys.exit(1)
    else:
        print("\n✅ All tables are in sync!")
        sys.exit(0)


if __name__ == "__main__":
    main()
