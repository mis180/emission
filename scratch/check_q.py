import json, glob

for f in glob.glob('data/methodics/M[5-9]_*/questions.json') + glob.glob('data/methodics/M1[0-2]_*/questions.json'):
    try:
        qs = json.load(open(f, encoding='utf-8'))
        questions = qs.get("questions", [])
        flow = qs.get("flow", {})
        
        # Collect all variables from flow
        flow_vars = set()
        for st in flow.values():
            for cm in st.values():
                flow_vars.update(cm.get("variables", []))
                
        # Are there questions defined for all flow vars?
        defined_qs = {q.get("variable_id") for q in questions if "variable_id" in q}
        missing_defs = flow_vars - defined_qs
        if missing_defs:
            print(f"{f}: missing question definition for {missing_defs}")
            
    except Exception as e:
        print(f"{f}: Error {e}")
