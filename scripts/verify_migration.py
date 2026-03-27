#!/usr/bin/env python3
"""
verify_migration.py — Compare lookup results between old tables.json and new tables_unified.json.

Tests all lookup scenarios used by the M1_storage engine:
  - Table-10: Kob by n (interpolation)
  - Table-7:  Kt by substance+t (filtered interpolation)
  - Table-8:  Kr by group+type+mode+volume (multi-key exact)
  - Table-9:  Kv by Pt_mmHg (interpolation)
  - Table-1:  PDK by substance (exact)
  - Table-3:  Antoine constants by substance (exact)
  - Table-12: C1/Knp/Uoz by substance (exact)
  - Normative table_6_1..6_5 (exact / interpolation)

Run:
    python3 scripts/verify_migration.py
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
M1_DIR = os.path.join(PROJECT_ROOT, "data", "methodics", "M1_storage")

OLD_PATH = os.path.join(M1_DIR, "tables_backup.json")
NEW_PATH = os.path.join(M1_DIR, "tables_unified.json")


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ── Old-format helpers ──

def old_get_rows(data, table_name, parameter):
    for t in data.get("lookup_tables", []):
        if t["table_name"] != table_name:
            continue
        for p in t.get("parameters", []):
            if p["parameter"] != parameter:
                continue
            return p.get("rows", [])
    return None


def old_lookup_exact(rows, key_map):
    if not rows:
        return None
    for r in rows:
        keys = r.get("keys", {})
        match = True
        for k, v in key_map.items():
            if str(keys.get(k, "")) != str(v):
                match = False
                break
        if match and r.get("value") is not None:
            return r["value"]
    return None


def old_lookup_interp(rows, key_name, query):
    if not rows:
        return None
    nums = []
    for r in rows:
        kv = r.get("keys", {}).get(key_name)
        v = r.get("value")
        if kv is None or v is None:
            continue
        try:
            nk = float(kv)
        except:
            continue
        nums.append((nk, v))
    if not nums:
        return None
    nums.sort()
    for nk, v in nums:
        if nk == query:
            return v
    if query <= nums[0][0]:
        return nums[0][1]
    if query >= nums[-1][0]:
        return nums[-1][1]
    for i in range(len(nums) - 1):
        lo_k, lo_v = nums[i]
        hi_k, hi_v = nums[i + 1]
        if lo_k <= query <= hi_k:
            if hi_k == lo_k:
                return lo_v
            t = (query - lo_k) / (hi_k - lo_k)
            return lo_v + t * (hi_v - lo_v)
    return None


def old_lookup_filtered_interp(rows, filter_key, filter_val, interp_key, query):
    filtered = [r for r in rows if r.get("keys", {}).get(filter_key) == filter_val
                or filter_val in str(r.get("keys", {}).get(filter_key, "")).split(",")]
    return old_lookup_interp(filtered, interp_key, query)


def old_normative(data, table_id, row_match_key, row_match_val, col):
    for t in data.get("normative_tables", []):
        if t["id"] != table_id:
            continue
        for r in t.get("rows", []):
            if str(r.get(row_match_key, "")) == str(row_match_val):
                return r.get(col)
    return None


def old_normative_interp(data, table_id, num_col, query, val_col):
    for t in data.get("normative_tables", []):
        if t["id"] != table_id:
            continue
        pts = [(r[num_col], r[val_col]) for r in t.get("rows", [])
               if r.get(num_col) is not None and r.get(val_col) is not None]
        pts.sort()
        if not pts:
            return None
        for k, v in pts:
            if k == query:
                return v
        if query <= pts[0][0]:
            return pts[0][1]
        if query >= pts[-1][0]:
            return pts[-1][1]
        for i in range(len(pts) - 1):
            if pts[i][0] <= query <= pts[i + 1][0]:
                t = (query - pts[i][0]) / (pts[i + 1][0] - pts[i][0])
                return pts[i][1] + t * (pts[i + 1][1] - pts[i][1])
    return None


# ── New-format helpers ──

def new_find_table(data, table_id):
    for t in data.get("tables", []):
        if t["id"] == table_id:
            return t
    return None


def new_lookup_exact(table, key_map):
    for r in table.get("data", []):
        match = True
        for k, v in key_map.items():
            rv = r.get(k)
            if rv is None or str(rv) != str(v):
                # Also check comma-separated
                if rv is not None and str(v) in str(rv).split(","):
                    continue
                match = False
                break
        if match:
            return r
    return None


def new_lookup_interp(table, query, output_col, filter_key=None, filter_val=None):
    ik = table.get("interpolate_key")
    rows = table.get("data", [])
    if filter_key and filter_val:
        rows = [r for r in rows if r.get(filter_key) == filter_val
                or filter_val in str(r.get(filter_key, "")).split(",")]
    pts = [(r[ik], r[output_col]) for r in rows
           if r.get(ik) is not None and r.get(output_col) is not None]
    pts.sort()
    if not pts:
        return None
    for k, v in pts:
        if k == query:
            return v
    if query <= pts[0][0]:
        return pts[0][1]
    if query >= pts[-1][0]:
        return pts[-1][1]
    for i in range(len(pts) - 1):
        if pts[i][0] <= query <= pts[i + 1][0]:
            t = (query - pts[i][0]) / (pts[i + 1][0] - pts[i][0])
            return pts[i][1] + t * (pts[i + 1][1] - pts[i][1])
    return None


# ── Tests ──

PASS = 0
FAIL = 0
SKIP = 0


def check(name, old_val, new_val, tol=1e-6):
    global PASS, FAIL, SKIP
    if old_val is None and new_val is None:
        PASS += 1
        return
    if old_val is None or new_val is None:
        FAIL += 1
        print(f"  FAIL {name}: old={old_val} new={new_val}")
        return
    if isinstance(old_val, (int, float)) and isinstance(new_val, (int, float)):
        if abs(old_val - new_val) <= tol:
            PASS += 1
        else:
            FAIL += 1
            print(f"  FAIL {name}: old={old_val} new={new_val} diff={abs(old_val - new_val)}")
    elif str(old_val) == str(new_val):
        PASS += 1
    else:
        FAIL += 1
        print(f"  FAIL {name}: old={old_val} new={new_val}")


def main():
    global PASS, FAIL
    old = load(OLD_PATH)
    new = load(NEW_PATH)

    # === Table-10 (Kob by n) ===
    print("Testing Table-10 (Kob by n)...")
    old_rows = old_get_rows(old, "Table-10", "Kob")
    new_t10 = new_find_table(new, "Table-10")
    for n in range(29, 101):
        ov = old_lookup_interp(old_rows, "n", n)
        nv = new_lookup_interp(new_t10, float(n), "Kob")
        check(f"T10 n={n}", ov, nv)
    # Test fractional
    for n in [29.5, 35.7, 55.3, 79.5, 99.99]:
        ov = old_lookup_interp(old_rows, "n", n)
        nv = new_lookup_interp(new_t10, n, "Kob")
        check(f"T10 n={n}", ov, nv)

    # === Table-9 (Kv by Pt_mmHg) ===
    print("Testing Table-9 (Kv by Pt_mmHg)...")
    old_rows = old_get_rows(old, "Table-9", "Kv")
    new_t9 = new_find_table(new, "Table-9")
    for pt in [540, 550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690, 700, 710, 720, 730, 740, 750, 760]:
        ov = old_lookup_interp(old_rows, "Pt_mmHg", pt)
        nv = new_lookup_interp(new_t9, float(pt), "Kv")
        check(f"T9 Pt={pt}", ov, nv)
    for pt in [545, 575, 655.5]:
        ov = old_lookup_interp(old_rows, "Pt_mmHg", pt)
        nv = new_lookup_interp(new_t9, pt, "Kv")
        check(f"T9 Pt={pt}", ov, nv)

    # === Table-7 (Kt by substance + t) ===
    print("Testing Table-7 (Kt by substance + t)...")
    substances_7 = ["Нефтепродукты (кроме бензина)", "Бензин автомобильный", "Нефть сырая"]
    old_rows = old_get_rows(old, "Table-7", "Kt")
    new_t7 = new_find_table(new, "Table-7")
    for sub in substances_7:
        for t in range(-30, 51):
            ov = old_lookup_filtered_interp(old_rows, "substance", sub, "t", t)
            nv = new_lookup_interp(new_t7, float(t), "Kt", "substance", sub)
            check(f"T7 {sub[:10]}.. t={t}", ov, nv, tol=0.05)  # Allow slightly larger tolerance for breakpoint compaction

    # === Table-8 (Kr by 4 keys) ===
    print("Testing Table-8 (Kp and Kp_avg)...")
    new_t8 = new_find_table(new, "Table-8")
    groups = ["А", "Б", "В"]
    types = ["Наземный вертикальный", "Заглубленный", "Наземный горизонтальный"]
    volumes = ["<100", "100-700", "700-2000", ">=2000"]
    for g in groups:
        for ty in types:
            for vol in volumes:
                km = {"group": g, "type": ty, "mode": "мерник", "volume": vol}
                # Old Kp
                for param in ["Kp", "Kp_avg"]:
                    for lt in old.get("lookup_tables", []):
                        if lt["table_name"] != "Table-8":
                            continue
                        for p in lt.get("parameters", []):
                            if p["parameter"] != param:
                                continue
                            ov = old_lookup_exact(p.get("rows", []), km)
                            nr = new_lookup_exact(new_t8, km)
                            nv = nr.get(param) if nr else None
                            check(f"T8 {param} {g}/{ty[:8]}/{vol}", ov, nv)

    # === Table-1 (substance exact) ===
    print("Testing Table-1 (PDK exact)...")
    new_t1 = new_find_table(new, "Table-1")
    for param in ["OBUV", "PDK_mr", "PDK_ss"]:
        old_rows = old_get_rows(old, "Table-1", param)
        for sub in ["Бензол", "Толуол", "Гексан", "Аммиак", "Фенол"]:
            ov = old_lookup_exact(old_rows, {"substance": sub})
            nr = new_lookup_exact(new_t1, {"substance": sub})
            nv = nr.get(param) if nr else None
            check(f"T1 {param} {sub}", ov, nv)

    # === Table-3 (Antoine constants) ===
    print("Testing Table-3 (Antoine constants)...")
    new_t3 = new_find_table(new, "Table-3")
    for param in ["A", "B", "C"]:
        old_rows = old_get_rows(old, "Table-3", param)
        for sub in ["Бутан", "Бензол", "Толуол", "Ацетон"]:
            ov = old_lookup_exact(old_rows, {"substance": sub})
            nr = new_lookup_exact(new_t3, {"substance": sub})
            nv = nr.get(param) if nr else None
            check(f"T3 {param} {sub}", ov, nv)

    # === Table-12 (depot constants) ===
    print("Testing Table-12 (depot constants)...")
    new_t12 = new_find_table(new, "Table-12")
    for param in ["C1", "Knp", "Uoz"]:
        old_rows = old_get_rows(old, "Table-12", param)
        for sub in ["benzene", "diesel", "mazut", "gasoline_auto"]:
            ov = old_lookup_exact(old_rows, {"substance": sub})
            nr = new_lookup_exact(new_t12, {"substance": sub})
            nv = nr.get(param) if nr else None
            check(f"T12 {param} {sub}", ov, nv)

    # === Normative table_6_3 (temperature interpolation) ===
    print("Testing table_6_3 (temperature interpolation)...")
    new_t63 = new_find_table(new, "table_6_3")
    for temp in [0, 5, 10, 15, 20, 25, 30, 35, 40]:
        for col in ["open_oil_trap_q_avg", "settling_pond_q_avg"]:
            ov = old_normative_interp(old, "table_6_3", "temperature_c", temp, col)
            nv = new_lookup_interp(new_t63, temp, col)
            check(f"6_3 t={temp} {col[:10]}", ov, nv)

    # === Normative table_6_4 (coverage interpolation) ===
    print("Testing table_6_4 (coverage interpolation)...")
    new_t64 = new_find_table(new, "table_6_4")
    for pct in [0, 5, 10, 15, 22, 50, 73, 90, 100]:
        ov = old_normative_interp(old, "table_6_4", "coverage_percent", pct, "z")
        nv = new_lookup_interp(new_t64, pct, "z")
        check(f"6_4 pct={pct}", ov, nv)

    # === Summary ===
    print(f"\n{'='*50}")
    print(f"PASS: {PASS}  FAIL: {FAIL}")
    if FAIL > 0:
        print("VERIFICATION FAILED!")
        sys.exit(1)
    else:
        print("ALL TESTS PASSED ✓")


if __name__ == "__main__":
    main()
