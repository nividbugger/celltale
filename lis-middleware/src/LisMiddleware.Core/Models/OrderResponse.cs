namespace LisMiddleware.Core.Models;

public sealed record OrderResponse(
    string SampleId,
    Patient? Patient,
    IReadOnlyList<OrderedTest> OrderedTests,
    bool Found);
