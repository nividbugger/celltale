using LisMiddleware.Core.Models;

namespace LisMiddleware.Core.Interfaces;

public interface IResultQueue
{
    Task EnqueueAsync(ResultSet results, CancellationToken ct);
    Task<IReadOnlyList<ResultSet>> DequeueAllAsync(CancellationToken ct);
    Task AcknowledgeAsync(ResultSet results, CancellationToken ct);
}
