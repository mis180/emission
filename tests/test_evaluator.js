async function runEvaluatorTests() {
    logMsg('\n--- Running Evaluator Tests ---');

    // Mocks for math module
    const mockEquations = {
        "eq_1": "c = a * b",
        "eq_2": "d = c + 10",
        "eq_missing_var": "y = x + z"
    };
    
    // Test base evaluation
    const scope1 = { a: 2, b: 3 };
    const res1 = Evaluator.evaluateBase("c = a * b", scope1);
    assertApprox(res1, 6, 0.0001, "Simple multiplication evaluates correctly");

    const resError = Evaluator.evaluateBase("y = x + z", { x: 5 });
    assertEq(resError, null, "Missing variable returns null");

    // Test sequence evaluation
    const seqScope = { a: 2, b: 3 };
    Evaluator.evaluateBase("c = a * b", seqScope);
    seqScope.c = 6;
    const res2 = Evaluator.evaluateBase("d = c + 10", seqScope);
    assertApprox(res2, 16, 0.0001, "Sequence evaluation handles prior state");

    logMsg('--- Evaluator Tests Complete ---');
}
