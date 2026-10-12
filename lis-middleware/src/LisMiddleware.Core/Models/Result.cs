namespace LisMiddleware.Core.Models;

public sealed record Result(
    string TestCode,
    string? Value,
    string? Unit,
    ResultFlag Flag,
    DateTimeOffset CompletedAt,
    string? ReferenceRange = null);
