import json
import os
import sys
from pathlib import Path
import re
from jsonschema import validate, ValidationError

sys.stdout.reconfigure(encoding='utf-8')

# Dynamic paths relative to the script location
BASE_DIR = Path(__file__).parent.parent
SCHEMAS_DIR = BASE_DIR / "data" / "schemas"

def validate_against_schema(data, schema_file, file_name):
    schema_path = SCHEMAS_DIR / schema_file
    if not schema_path.exists():
        return []
    schema = json.loads(schema_path.read_text(encoding='utf-8'))
    try:
        validate(instance=data, schema=schema)
        return []
    except ValidationError as e:
        return [f"{file_name} schema violation: {e.message}"]

def validate_methodic(methodic_path):
    errors = []
    warnings = []
    
    path = Path(methodic_path)
    methodic_id = path.name
    
    required_files = [
        'meta.json', 'variables.json', 'questions.json', 
        'equations.json', 'tables.json'
    ]
    
    data = {}
    for f in required_files:
        f_path = path / f
        if not f_path.exists():
            errors.append(f"Missing required {f}")
            continue
        try:
            data[f] = json.loads(f_path.read_text(encoding='utf-8'))
        except Exception as e:
            errors.append(f"Failed to parse {f}: {str(e)}")

    if errors:
        return errors, warnings

    # 0. Meta Check
    meta = data.get('meta.json', {})
    meta_codes = set(meta.get('formula_codes', []))

    if 'tables.json' in data:
        errs = validate_against_schema(data['tables.json'], 'tables.schema.json', 'tables.json')
        errors.extend(errs)
    if 'variables.json' in data:
        errs = validate_against_schema(data['variables.json'], 'variables.schema.json', 'variables.json')
        errors.extend(errs)

    # 1. Variables Check
    var_raw = data.get('variables.json', {})
    if isinstance(var_raw, list):
        var_list = var_raw
        errors.append("variables.json should be an object with a 'variables' key, not a raw list.")
    else:
        var_list = var_raw.get('variables', [])
    
    var_ids = {v['id'] for v in var_list if isinstance(v, dict) and 'id' in v}

    # 2. Equations Check
    eq_raw = data.get('equations.json', {})
    eq_list = eq_raw.get('active_equations', [])
    formula_codes = {eq['formula_code'] for eq in eq_list if 'formula_code' in eq}
    
    # Check if meta.json codes match equations.json
    for mc in meta_codes:
        if mc not in formula_codes:
            errors.append(f"meta.json advertises formula {mc} but it is missing in equations.json")

    for eq in eq_list:
        lhs = eq.get('lhs_token') or eq.get('lhs')
        if not lhs:
            errors.append(f"Equation missing lhs_token/lhs in formula {eq.get('formula_code')}")

    # 3. Questions Flow Check
    q_raw = data.get('questions.json', {})
    flow = q_raw.get('flow', {})
    for src_type, methods in flow.items():
        if not isinstance(methods, dict): continue
        for method_name, entry in methods.items():
            if not isinstance(entry, dict): continue
            f_code = str(entry.get('formula_code')) if entry.get('formula_code') is not None else None
            if f_code and f_code not in formula_codes:
                errors.append(f"Flow {src_type}->{method_name} references missing formula {f_code}")
            
            flow_vars = entry.get('variables', [])
            for v_id in flow_vars:
                if v_id not in var_ids:
                    errors.append(f"Flow {src_type}->{method_name} references missing variable {v_id}")

    # 4. Tables Data Integrity Check
    tables_raw = data.get('tables.json', {})
    tables_list = tables_raw.get('tables', [])
    for t in tables_list:
        if not isinstance(t, dict): continue
        t_id = t.get('id', 'unknown')
        l_type = t.get('lookup_type', 'exact')
        
        if l_type == 'smart':
            warnings.append(f"Table {t_id} uses deprecated 'smart' lookup_type. Migrate to explicit type.")
            
        if l_type in ['interpolate', 'interpolate_with_filter'] and 'interpolation' not in t:
            warnings.append(f"Table {t_id}: interpolation table missing explicit 'interpolation' config block")

        in_keys = t.get('input_keys', [])
        out_keys = t.get('output_keys', [])
        t_data = t.get('data', [])

        seen_keys = set()
        last_interp_val = {}

        for i, row in enumerate(t_data):
            # Check output keys exist
            for ok in out_keys:
                if ok not in row:
                    errors.append(f"Table {t_id} row {i} missing output key '{ok}'")

            # Check uniqueness for exact matches
            if l_type in ['exact', 'multi_key_exact']:
                try:
                    key_tuple = tuple(row.get(ik) for ik in in_keys)
                    if key_tuple in seen_keys:
                        errors.append(f"Table {t_id} has duplicate exact matching key tuple {key_tuple}")
                    seen_keys.add(key_tuple)
                except Exception:
                    pass

            # Check interpolation sort order
            if l_type in ['interpolate', 'interpolate_with_filter', 'smart'] and 'interpolate_key' in t:
                int_k = t['interpolate_key']
                val = row.get(int_k)
                if val is not None:
                    # If there's a filter key, we must check sortedness per filter group
                    f_val = row.get(t.get('filter_key')) if 'filter_key' in t else 'global'
                    last_val = last_interp_val.get(f_val)
                    if last_val is not None:
                        try:
                            if float(val) < float(last_val):
                                errors.append(f"Table {t_id} is not sorted ascending by interpolate_key '{int_k}' for filter '{f_val}'")
                        except ValueError:
                            pass
                    last_interp_val[f_val] = val

    return errors, warnings

def main():
    root = BASE_DIR / "data" / "methodics"
    all_passed = True
    
    print(f"{'Methodic ID':<20} | {'Status':<10} | {'Issues'}")
    print("-" * 60)
    
    for methodic_dir in sorted(root.iterdir()):
        if not methodic_dir.is_dir(): continue
        
        errs, warns = validate_methodic(methodic_dir)
        
        if errs:
            print(f"{methodic_dir.name:<20} | {'ERROR':<10} | {len(errs)} errors")
            for e in errs:
                print(f"  [X] {e}")
            all_passed = False
        elif warns:
            print(f"{methodic_dir.name:<20} | {'WARN':<10} | {len(warns)} warnings")
            for w in warns:
                print(f"  [!] {w}")
        else:
            print(f"{methodic_dir.name:<20} | {'PASS':<10} |")

    if not all_passed:
        exit(1)

if __name__ == "__main__":
    main()
