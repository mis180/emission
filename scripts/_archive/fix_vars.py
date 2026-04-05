import json
import os

base_dir = r"c:\ANTIGRAVITY\data\methodics"
methodics = ["M1_storage", "M2_welding", "M3_unorganized", "M4_fuel_stations"]

for m in methodics:
    path = os.path.join(base_dir, m, "variables.json")
    if not os.path.exists(path): continue
    
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for v in data.get("variables", []):
        # FIX-G1 & FIX-G2
        # If float or integer, make it numeric
        if v.get("datatype") in ("float", "integer"):
            v["datatype"] = "numeric"
            
        # If it has options or is a select type, it should be string (or numeric if purely numbers, but the enums here are strings)
        # Note: M1 uses strings like "Бензин автомобильный", M2 "УОНИ-13/45", etc.
        if "options" in v or v.get("type") == "select":
            v["datatype"] = "string"
        
        # Remove rogue "type": "select"
        if v.get("type") == "select":
            del v["type"]

        # FIX-C4: M3 k_6 default_value -> default
        if "default_value" in v:
            v["default"] = v["default_value"]
            del v["default_value"]

        # FIX-I3: M4 Q_spec
        if m == "M4_fuel_stations" and v.get("id") == "Q_spec":
            if "auto_lookup" in v and isinstance(v["auto_lookup"].get("key"), list):
                v["auto_lookup"]["key"] = {
                    "equip_type": "equip_type",
                    "fluid_type": "fluid_type"
                }

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
