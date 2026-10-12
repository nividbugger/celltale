using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Models;
using Microsoft.Extensions.Logging;

namespace LisMiddleware.Core.Orchestrator;

/// <summary>
/// Ties together the driver, API adapter, and result queue.
/// Has zero vendor-specific and zero HTTP-specific code.
/// </summary>
public sealed class SessionOrchestrator
{
    private readonly IApiAdapter _api;
    private readonly IResultQueue _queue;
    private readonly ILogger<SessionOrchestrator> _log;

    public SessionOrchestrator(
        IApiAdapter api,
        IResultQueue queue,
        ILogger<SessionOrchestrator> log)
    {
        _api = api;
        _queue = queue;
        _log = log;
    }

    /// <summary>Flow 1: barcode scan -> patient + tests sent back.</summary>
    public async Task<AstmMessage> HandleQueryAsync(
        IAnalyzerDriver driver,
        AstmMessage inbound,
        CancellationToken ct)
    {
        SampleQuery query = driver.ParseQuery(inbound);
        _log.LogInformation("Order query: analyzer={Analyzer} sample={Sample}",
            driver.AnalyzerId, query.SampleId);

        OrderResponse response;
        try
        {
            response = await _api.GetOrder(query, ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "API GetOrder failed for sample {Sample}; returning no-order",
                query.SampleId);
            return driver.SerializeNoOrderResponse(query.SampleId);
        }

        if (!response.Found)
        {
            _log.LogWarning("Sample {Sample} not found in API", query.SampleId);
            return driver.SerializeNoOrderResponse(query.SampleId);
        }

        _log.LogInformation("Order found: sample={Sample} patient={Patient} tests={Tests}",
            query.SampleId, response.Patient?.PatientId, response.OrderedTests.Count);
        return driver.SerializeOrderResponse(response);
    }

    /// <summary>Flow 2: result upload -> written back to patient record.</summary>
    public async Task<bool> HandleResultsAsync(
        IAnalyzerDriver driver,
        AstmMessage inbound,
        CancellationToken ct)
    {
        ResultSet results = driver.ParseResults(inbound);
        _log.LogInformation("Results received: analyzer={Analyzer} sample={Sample} count={Count}",
            driver.AnalyzerId, results.SampleId, results.Results.Count);

        try
        {
            await _api.PostResults(results, ct);
            _log.LogInformation("Results posted: sample={Sample}", results.SampleId);
            return true;
        }
        catch (Exception ex)
        {
            _log.LogError(ex,
                "API PostResults failed for sample {Sample}; queuing for retry",
                results.SampleId);
            await _queue.EnqueueAsync(results, ct);
            return false; // caller must not ACK the analyzer; retry worker will re-post
        }
    }
}
