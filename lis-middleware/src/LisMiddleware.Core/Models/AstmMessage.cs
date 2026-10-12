namespace LisMiddleware.Core.Models;

// A complete ASTM message: the decoded text records from a sender session.
public sealed record AstmMessage(IReadOnlyList<string> Records);
