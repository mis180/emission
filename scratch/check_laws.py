import json, os, glob

def check_methodic(path):
    errors = []
    
    # Check meta.json
    try:
        meta = json.load(open(os.path.join(path, "meta.json"), encoding="utf-8"))
        source_types = [st["value"] for st in meta.get("source_types", [])]
    except Exception as e:
        return [f"meta.json parse error: {e}"]
        
    # Check questions.json
    try:
        qs = json.load(open(os.path.join(path, "questions.json"), encoding="utf-8"))
        flow_keys = list(qs.get("flow", {}).keys())
        for f in flow_keys:
            if f not in source_types:
                errors.append(f"questions.json flow key '{f}' not in meta.json source_types")
    except Exception as e:
        errors.append(f"questions.json parse error: {e}")
        
    return errors

registry = json.load(open('data/registry.json', encoding='utf-8'))
for m in registry['methodics']:
    path = m['path']
    errs = check_methodic(path)
    if errs:
        print(f"Errors in {m['id']}:")
        for err in errs:
            print(f"  - {err}")
    
