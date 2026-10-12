using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Models;
using Microsoft.Extensions.Logging;

namespace LisMiddleware.Api;

/// <summary>
/// In-memory fake for end-to-end testing without the real API.
/// Pre-load orders with AddOrder(); received results are stored in PostedResults.
/// </summary>
public sealed class FakeApiAdapter : IApiAdapter
{
    private readonly Dictionary<string, OrderResponse> _orders = new();
    private readonly ILogger<FakeApiAdapter> _log;

    public IReadOnlyList<ResultSet> PostedResults => _posted.AsReadOnly();
    private readonly List<ResultSet> _posted = new();

    public FakeApiAdapter(ILogger<FakeApiAdapter> log) => _log = log;

    public void AddOrder(OrderResponse order) => _orders[order.SampleId] = order;

    public Task<OrderResponse> GetOrder(SampleQuery query, CancellationToken ct)
    {
        _log.LogDebug("FakeApi GetOrder: sample={Sample}", query.SampleId);
        if (_orders.TryGetValue(query.SampleId, out var order))
            return Task.FromResult(order);

        // Return a hardcoded test patient for any unknown sample ID.
        // This lets you verify the machine↔LIS TCP/ASTM link without a real API.
        var testPatient = new Patient(
            PatientId:   query.SampleId,
            Name:        "TEST PATIENT",
            Age:         30,
            Sex:         "M",
            DateOfBirth: new DateOnly(1995, 6, 15));

        var testOrder = new OrderResponse(
            SampleId:     query.SampleId,
            Patient:      testPatient,
            OrderedTests: new List<OrderedTest>
            {
                new("GLU"), new("CREA"), new("ALT"), new("AST"), new("CHOL")
            }.AsReadOnly(),
            Found: true);

        return Task.FromResult(testOrder);
    }

    public Task PostResults(ResultSet results, CancellationToken ct)
    {
        _log.LogDebug("FakeApi PostResults: sample={Sample}", results.SampleId);
        _posted.Add(results);

        // Write a JSON file next to the exe so results can be inspected without a real API.
        try
        {
            string dir  = AppContext.BaseDirectory;
            string name = $"result_{results.AnalyzerId}_{results.SampleId}_{DateTime.Now:yyyyMMdd_HHmmss}.json";
            string path = Path.Combine(dir, name);
            var payload = new
            {
                sampleId    = results.SampleId,
                analyzerId  = results.AnalyzerId,
                completedAt = results.RunCompletedAt.ToString("o"),
                patient     = results.Patient == null ? null : new
                {
                    id   = results.Patient.PatientId,
                    name = results.Patient.Name,
                    age  = results.Patient.Age,
                    sex  = results.Patient.Sex,
                    dob  = results.Patient.DateOfBirth?.ToString("yyyy-MM-dd")
                },
                results = results.Results.Select(r => new
                {
                    testCode    = r.TestCode,
                    value       = r.Value,
                    unit        = r.Unit,
                    flag        = r.Flag.ToString(),
                    completedAt = r.CompletedAt.ToString("o")
                })
            };
            File.WriteAllText(path, System.Text.Json.JsonSerializer.Serialize(payload,
                new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
            _log.LogInformation("FakeApi: results written to {Path}", path);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "FakeApi: could not write result file");
        }

        return Task.CompletedTask;
    }
}
