namespace LisMiddleware.Core.Models;

public sealed record Patient(
    string PatientId,
    string Name,
    int? Age,
    string? Sex,
    DateOnly? DateOfBirth);
