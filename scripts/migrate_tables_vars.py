import os
import json
from pathlib import Path

def migrate_variables(var_path):
    with open(var_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if isinstance(data, list):
        print(f"Migrating {var_path.name} to object format.")
        data = { "variables": data }
        with open(var_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

def migrate_tables(table_path):
    with open(table_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if "tables" in data:
        return # Already migrated

    new_tables = []
    
    for table_list in ["lookup_tables", "normative_tables"]:
        if table_list in data:
            for t in data[table_list]:
                # Conversion
                new_t = {
                    "id": t.get("id", f"migrated_{len(new_tables)}"),
                    "title": t.get("name", t.get("title", "")),
                }
                
                input_keys = t.get("keys", ["substance"] if table_list == "normative_tables" else [])
                new_t["input_keys"] = input_keys
                
                output_keys = t.get("columns", ["PDK", "OBUV"] if table_list == "normative_tables" else [])
                new_t["output_keys"] = output_keys
                
                if len(input_keys) > 1:
                    new_t["lookup_type"] = "multi_key_exact"
                else:
                    new_t["lookup_type"] = "exact" # Default, may need manual adjustment for interpolation
                
                # Keep other properties
                for k in t.keys():
                    if k not in ["id", "name", "title", "keys", "columns", "data"]:
                        new_t[k] = t[k]
                
                new_t["data"] = t.get("data", [])
                
                # Remove empty title if present
                if not new_t["title"]:
                    del new_t["title"]
                    
                new_tables.append(new_t)

    print(f"Migrating {table_path.name} to new format.")
    with open(table_path, 'w', encoding='utf-8') as f:
        json.dump({ "tables": new_tables }, f, ensure_ascii=False, indent=2)

def clean_orphans(methodic_dir):
    orphans = ["tables_backup.json", "tables_unified.json"]
    for o in orphans:
        p = methodic_dir / o
        if p.exists():
            print(f"Removing orphan: {p}")
            p.unlink()

def main():
    methodics_dir = Path(r"c:\ANTIGRAVITY\data\methodics")
    for d in methodics_dir.iterdir():
        if d.is_dir():
            print(f"Processing {d.name}...")
            clean_orphans(d)
            
            var_file = d / "variables.json"
            if var_file.exists():
                migrate_variables(var_file)
                
            table_file = d / "tables.json"
            if table_file.exists():
                migrate_tables(table_file)

if __name__ == "__main__":
    main()
