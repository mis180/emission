import json
import os

base_dir = r"c:\ANTIGRAVITY\data\methodics"

# 1. M1 equations.json fixes
m1_eq_path = os.path.join(base_dir, "M1_storage", "equations.json")
with open(m1_eq_path, "r", encoding="utf-8") as f:
    m1_eq = json.load(f)

new_m1_eqs = []
for eq in m1_eq.get("active_equations", []):
    if eq.get("status") == "draft" or eq.get("confidence") == "needs_review":
        continue
    
    if "lhs" in eq:
        del eq["lhs"]
        
    eq["confidence"] = "TRUSTED"
    eq["status"] = "active"
    
    if "Q_equip" in eq.get("rhs", ""):
        eq["rhs"] = eq["rhs"].replace("Q_equip", "Q_spec")

    new_m1_eqs.append(eq)

m1_eq["active_equations"] = new_m1_eqs
with open(m1_eq_path, "w", encoding="utf-8") as f:
    json.dump(m1_eq, f, indent=2, ensure_ascii=False)
    f.write("\n")

# 2. M1 tables.json source text
m1_tbl_path = os.path.join(base_dir, "M1_storage", "tables.json")
with open(m1_tbl_path, "r", encoding="utf-8") as f:
    m1_tbl_raw = f.read()
m1_tbl_raw = m1_tbl_raw.replace("soruce doc where i got soruce data code for calculation and other items.pdf", "РНД 211.2.02.09-2004.pdf")
with open(m1_tbl_path, "w", encoding="utf-8") as f:
    f.write(m1_tbl_raw)

# 3. M4 equations.json order and lhs
m4_eq_path = os.path.join(base_dir, "M4_fuel_stations", "equations.json")
with open(m4_eq_path, "r", encoding="utf-8") as f:
    m4_eq = json.load(f)

for i, eq in enumerate(m4_eq.get("active_equations", [])):
    if "equation_order" not in eq:
        eq["equation_order"] = i + 1
    if "lhs" in eq:
        del eq["lhs"]

with open(m4_eq_path, "w", encoding="utf-8") as f:
    json.dump(m4_eq, f, indent=2, ensure_ascii=False)
    f.write("\n")

# 4. M2 questions.json typo
m2_q_path = os.path.join(base_dir, "M2_welding", "questions.json")
with open(m2_q_path, "r", encoding="utf-8") as f:
    m2_q_raw = f.read()
m2_q_raw = m2_q_raw.replace("Маскимальный часовой расход", "Максимальный часовой расход")
with open(m2_q_path, "w", encoding="utf-8") as f:
    f.write(m2_q_raw)

# 5. M2 equations.json lhs
m2_eq_path = os.path.join(base_dir, "M2_welding", "equations.json")
with open(m2_eq_path, "r", encoding="utf-8") as f:
    m2_eq = json.load(f)

for eq in m2_eq.get("active_equations", []):
    if "lhs" in eq:
        del eq["lhs"]

with open(m2_eq_path, "w", encoding="utf-8") as f:
    json.dump(m2_eq, f, indent=2, ensure_ascii=False)
    f.write("\n")

# 6. Registry M3 formula codes
reg_path = r"c:\ANTIGRAVITY\data\registry.json"
with open(reg_path, "r", encoding="utf-8") as f:
    reg = json.load(f)

for entry in reg.get("methodics", []):
    if entry.get("id") == "M3_unorganized":
        entry["formula_codes"] = ["1"]
        
with open(reg_path, "w", encoding="utf-8") as f:
    json.dump(reg, f, indent=2, ensure_ascii=False)
    f.write("\n")
