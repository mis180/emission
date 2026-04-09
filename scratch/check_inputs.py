import json, os, re

def get_rhs_variables(rhs):
    # simple variable extraction
    # replace math functions and numbers
    b = re.sub(r'[0-9]+(\.[0-9]+)?(e-?[0-9]+)?', ' ', rhs)
    b = re.sub(r'sqrt|log|exp|pow|sin|cos|tan', ' ', b)
    vars = re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*', b)
    return set(vars)

registry = json.load(open('data/registry.json', encoding='utf-8'))
for m in registry['methodics']:
    path = m['path']
    if not os.path.exists(path): continue
    if "M13" in path or "M14" in path or "M15" in path or "M16" in path or "M17" in path or "M18" in path or "M19" in path: continue
    
    try:
        qs = json.load(open(os.path.join(path, "questions.json"), encoding="utf-8"))
        eqs = json.load(open(os.path.join(path, "equations.json"), encoding="utf-8"))
        vars_json = json.load(open(os.path.join(path, "variables.json"), encoding="utf-8"))
    except:
        continue
        
    flow = qs.get("flow", {})
    active_eqs = eqs.get("active_equations", [])
    all_var_defs = {v["id"]: v for v in vars_json.get("variables", [])}
    
    # Check each flow configuration
    for source_type, st_config in flow.items():
        for calc_method, cfg in st_config.items():
            f_code = cfg.get("formula_code")
            flow_vars = set(cfg.get("variables", []))
            
            # Find equations for this formula_code
            my_eqs = [e for e in active_eqs if e.get("formula_code") == f_code]
            if not my_eqs: continue
            
            # What variables do these equations require?
            required_rhs = set()
            produced_lhs = set()
            for eq in sorted(my_eqs, key=lambda x: x.get("equation_order", 0)):
                rhs_vars = get_rhs_variables(eq.get("rhs", ""))
                required_rhs.update(rhs_vars - produced_lhs)
                produced_lhs.add(eq.get("lhs_token", ""))
            
            # For each required RHS, if it has an auto_lookup, we need ITS keys instead
            final_required = set()
            for req in required_rhs:
                vd = all_var_defs.get(req, {})
                if vd.get("auto_lookup"):
                    al = vd["auto_lookup"]
                    key = al.get("key", {})
                    if isinstance(key, str):
                        final_required.add(key)
                    elif isinstance(key, list):
                        final_required.update(key)
                    elif isinstance(key, dict):
                        for k, v in key.items():
                            if isinstance(v, list):
                                final_required.update(v)
                            else:
                                final_required.add(v)
                    
                    if "interpolate_key" in al and al["interpolate_key"] != "t":
                        pass # often interpolate_key is part of key
                else:
                    final_required.add(req)
            
            # What is missing from flow?
            missing = final_required - flow_vars
            # Ignore standard constants or unknown words
            missing = {m for m in missing if m in all_var_defs}
            
            if missing:
                print(f"{m['id']} [{source_type}/{calc_method}] missing inputs: {list(missing)}")
