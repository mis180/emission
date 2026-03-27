/**
 * graph-resolver.js — Dependency Graph and Topological Sort for EMISSION Engine
 * 
 * Analyzes auto_lookups and equations to build a Directed Acyclic Graph (DAG)
 * of variable calculation steps. Outputs a perfectly sorted execution plan to let 
 * equations and table lookups interleave natively.
 */

const GraphResolver = (() => {

    /**
     * Parse dependencies out of an equation right-hand-side.
     * Heavily relies on math.js AST to find un-bound symbols.
     */
    function extractEquationDependencies(rhs) {
        if (!rhs) return [];
        if (typeof math === 'undefined' || !math.parse) {
            console.warn("[GraphResolver] math.js not found, fallback to regex extraction");
            return [...rhs.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map(m => m[0]);
        }
        
        try {
            const ast = math.parse(rhs);
            const deps = new Set();
            ast.filter(node => node.isSymbolNode && typeof math[node.name] !== 'function').forEach(node => {
                deps.add(node.name);
            });
            return Array.from(deps);
        } catch (e) {
            console.warn(`[GraphResolver] Failed to parse AST for ${rhs}: ${e.message}`);
            return [];
        }
    }

    /**
     * Extract key requirements from an auto_lookup configuration.
     */
    function extractLookupDependencies(al) {
        const deps = new Set();

        const kc = al.key;
        if (typeof kc === 'string') deps.add(kc);
        else if (Array.isArray(kc)) kc.forEach(k => deps.add(k));
        else if (typeof kc === 'object') {
            for (const cands of Object.values(kc)) {
                if (Array.isArray(cands)) cands.forEach(c => deps.add(c));
                else deps.add(cands);
            }
        }

        if (al.interpolate_key) deps.add(al.interpolate_key);
        if (al.filter_key) deps.add(al.filter_key);

        return Array.from(deps);
    }

    /**
     * Compile equations and lookups into a unified node graph structure.
     * 
     * @param {Array} variablesList - From variables.json
     * @param {Array} equationsList - From equations.json (active_equations)
     * @returns {Object} Graph { nodes: { id: { type, id, deps, payload } } }
     */
    function buildGraph(variablesList, equationsList) {
        const nodes = {};

        // 1. Add lookup nodes
        if (variablesList) {
            variablesList.forEach(v => {
                if (v.auto_lookup) {
                    nodes[v.id] = {
                        id: v.id,
                        type: 'LOOKUP',
                        deps: extractLookupDependencies(v.auto_lookup),
                        payload: v
                    };
                }
            });
        }

        // 2. Add equation nodes
        if (equationsList) {
            equationsList.forEach(eq => {
                const lhs = eq.lhs_token || eq.lhs;
                if (!lhs) return;
                
                // If there's an equation for a variable that also has a lookup,
                // the lookup provides a default/table value but the equation overrides or derives it?
                // Usually they are mutually exclusive.
                nodes[lhs] = {
                    id: lhs,
                    type: 'EQUATION',
                    deps: extractEquationDependencies(eq.rhs),
                    payload: eq
                };
            });
        }

        return nodes;
    }

    /**
     * Kahn's Algorithm for Topological Sort.
     * @param {Object} graphNodes - Output of buildGraph
     * @returns {Array} Ordered sequence of nodes to evaluate
     * @throws Error if a cycle is detected
     */
    function resolveOrder(graphNodes) {
        const inDegree = {};
        const adj = {};
        const nodeIds = Object.keys(graphNodes);

        // Initialize structures
        nodeIds.forEach(id => {
            inDegree[id] = 0;
            adj[id] = [];
        });

        // Build edges based on dependencies
        nodeIds.forEach(id => {
            const node = graphNodes[id];
            node.deps.forEach(dep => {
                // If the dependency is calculated internally, draw an edge: dep -> id
                // (e.g., node depends on dep, so dep must be calculated first)
                if (graphNodes[dep]) {
                    adj[dep].push(id);
                    inDegree[id]++;
                }
            });
        });

        // Find all initial sources (inDegree 0)
        const queue = [];
        nodeIds.forEach(id => {
            if (inDegree[id] === 0) queue.push(id);
        });

        const sorted = [];
        while (queue.length > 0) {
            const current = queue.shift();
            sorted.push(graphNodes[current]);

            adj[current].forEach(neighbor => {
                inDegree[neighbor]--;
                if (inDegree[neighbor] === 0) {
                    queue.push(neighbor);
                }
            });
        }

        if (sorted.length !== nodeIds.length) {
            // Find what is stuck in the cycle
            const cycleNodes = nodeIds.filter(id => inDegree[id] > 0);
            const cycleStr = cycleNodes.join(', ');
            throw new Error(`Cycle detected in dependency graph involving: ${cycleStr}`);
        }

        return sorted;
    }

    /**
     * Primary entry point. Returns an ordered list of tasks (Lookups & Equations).
     */
    function getExecutionPlan(variablesList, activeEquations) {
        const graph = buildGraph(variablesList, activeEquations);
        try {
            return resolveOrder(graph);
        } catch (e) {
            console.error("[GraphResolver] Topological sort failed:", e);
            return []; // Fail gracefully, maybe fallback
        }
    }

    return {
        buildGraph,
        resolveOrder,
        getExecutionPlan
    };

})();
