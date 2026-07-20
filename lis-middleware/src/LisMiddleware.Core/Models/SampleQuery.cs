namespace LisMiddleware.Core.Models;

public sealed record SampleQuery(
    string SampleId,
    string AnalyzerId,
    string? RackId = null,
    string? Position = null);
