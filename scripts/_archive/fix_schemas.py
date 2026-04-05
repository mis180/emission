import json
from pathlib import Path

root = Path(r"c:\ANTIGRAVITY\data\methodics")
for mdir in root.iterdir():
    if not mdir.is_dir(): continue
    vpath = mdir / "variables.json"
    if vpath.exists():
        data = json.loads(vpath.read_text(encoding='utf-8'))
        vlist = data if isinstance(data, list) else data.get('variables', [])
        changed = False
        for v in vlist:
            if 'datatype' not in v:
                v['datatype'] = 'numeric'
                changed = True
        if changed:
            if isinstance(data, list):
                data = {'variables': data}
            vpath.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')

tpath = root / "M1_storage" / "tables.json"
tdata = json.loads(tpath.read_text(encoding='utf-8'))
changed = False
for t in tdata.get('tables', []):
    if t['id'] == 'table_6_3' and 'input_keys' not in t:
        # Move input_keys right after lookup_type for consistency if possible, but python dict does ordered insertion, we'll just add it.
        t['input_keys'] = ['temperature_c']
        changed = True
    if t['id'] == 'table_6_4' and 'input_keys' not in t:
        t['input_keys'] = ['coverage_percent']
        changed = True
if changed:
    tpath.write_text(json.dumps(tdata, ensure_ascii=False, indent=2) + "\n", encoding='utf-8')

print("Fixes applied.")
