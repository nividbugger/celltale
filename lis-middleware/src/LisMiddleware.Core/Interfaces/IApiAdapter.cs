using LisMiddleware.Core.Models;

namespace LisMiddleware.Core.Interfaces;

public interface IApiAdapter
{
    Task<OrderResponse> GetOrder(SampleQuery query, CancellationToken ct);
    Task PostResults(ResultSet results, CancellationToken ct);
}
