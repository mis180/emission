"""Prepare cleaned JSON data files for the methodic folder structure."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "methodics" / "M1_2011-07"
OUT.mkdir(parents=True, exist_ok=True)

# --- equations.json: keep only active_equations ---
eq_raw = json.loads((ROOT / "equations.json").read_text(encoding="utf-8"))
eq_clean = {"active_equations": eq_raw["active_equations"]}
(OUT / "equations.json").write_text(json.dumps(eq_clean, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"equations.json: {len(eq_clean['active_equations'])} active equations")

# --- variables.json: keep only variables array ---
var_raw = json.loads((ROOT / "variables.json").read_text(encoding="utf-8"))
var_clean = {"variables": var_raw["variables"]}
(OUT / "variables.json").write_text(json.dumps(var_clean, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"variables.json: {len(var_clean['variables'])} variables")

# --- tables.json: keep normative_tables + lookup_tables ---
tbl_raw = json.loads((ROOT / "tables.json").read_text(encoding="utf-8"))
tbl_clean = {
    "normative_tables": tbl_raw.get("normative_tables", []),
    "lookup_tables": tbl_raw.get("lookup_tables", [])
}
(OUT / "tables.json").write_text(json.dumps(tbl_clean, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"tables.json: {len(tbl_clean['normative_tables'])} normative, {len(tbl_clean['lookup_tables'])} lookup")

# --- questions.json: keep questions + add flow mapping ---
q_raw = json.loads((ROOT / "questions.json").read_text(encoding="utf-8"))
q_clean = {
    "flow": {
        "tank_industrial": {
            "oil_gasoline_R38": {
                "formula_code": "4.2",
                "variables": ["P38", "m", "Kt_max", "Kt_min", "Kr_avg", "Kv", "Vmax", "B", "rho", "Vp", "Np", "Kob"]
            },
            "other_products_C20": {
                "formula_code": "4.6",
                "variables": ["C20", "Kt_max", "Kt_min", "Kr_avg", "Vmax", "B", "rho", "Vp", "Np", "Kob"]
            },
            "pure_substance": {
                "formula_code": "4.3",
                "variables": ["Pt_max", "Pt_min", "m", "Kr_max", "Kr_avg", "Kv", "Vmax", "B", "rho", "T_max", "T_min", "Kob"]
            },
            "known_mixture": {
                "formula_code": "4.4",
                "variables": ["Kg_max", "Kg_min", "X_i", "m_i", "Kr_max", "Kr_avg", "Kv", "Vmax", "B", "rho", "T_max", "T_min", "Kob"]
            },
            "gas_in_water": {
                "formula_code": "4.5",
                "variables": ["Kg_max", "Kg_min", "X_i", "m_i", "Kr_max", "Kr_avg", "Kv", "Vmax", "B", "rho", "T_max", "T_min", "Kob"]
            }
        },
        "tank_depot": {
            "_default": {
                "formula_code": "5.2",
                "variables": ["C20", "K_dep", "Vmax", "B", "rho", "F_adj"]
            }
        },
        "unorg_equipment": {
            "_default": {
                "formula_code": "6.2",
                "variables": ["equipType", "productBoilGroup", "equipCount", "equipHours"]
            }
        },
        "unorg_wastewater": {
            "_default": {
                "formula_code": "6.5",
                "variables": ["wwType", "wwArea", "wwTempAvg", "wwTempSummer"]
            }
        },
        "unorg_sludge": {
            "_default": {
                "formula_code": "6.6",
                "variables": ["sludgeArea"]
            }
        },
        "fuel_station_liquid": {
            "_default": {
                "formula_code": "7.1",
                "variables": ["Sr_max", "Vsl", "Sr_oz", "Sr_vl", "Sb_oz", "Sb_vl", "Qoz", "Qvl", "J_spill"]
            }
        },
        "fuel_station_gas": {
            "_default": {
                "formula_code": "7.2",
                "variables": ["gasDensity", "orificeArea", "pressureHead", "simultaneous", "eventDuration", "eventCount"]
            }
        }
    },
    "questions": q_raw["questions"]
}
(OUT / "questions.json").write_text(json.dumps(q_clean, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"questions.json: {len(q_clean['questions'])} questions, {len(q_clean['flow'])} source types with flow")

print("\nDone! All cleaned files written to:", OUT)
