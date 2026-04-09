import json, os, glob
registry = json.load(open('data/registry.json', encoding='utf-8'))
for m in registry['methodics']:
    path = m['path']
    files = ['meta.json', 'questions.json', 'variables.json', 'equations.json', 'tables.json', 'composition.json']
    missing = [f for f in files if not os.path.exists(os.path.join(path, f))]
    if missing:
        print(f"Missing in {m['id']}: {missing}")
