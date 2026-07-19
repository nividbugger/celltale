namespace LisMiddleware.Core.Models;

public sealed record ResultSet(
    string SampleId,
    string AnalyzerId,
    Patient? Patient,
    IReadOnlyList<Result> Results,
    DateTimeOffset RunCompletedAt);
