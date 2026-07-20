using Xunit;
using LisMiddleware.Api;
using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Models;
using LisMiddleware.Core.Orchestrator;
using LisMiddleware.Drivers.Sysmex;
using Microsoft.Extensions.Logging.Abstractions;

namespace LisMiddleware.Core.Tests;

public class OrchestratorFlowTests
{
    private readonly FakeApiAdapter _api = new(NullLogger<FakeApiAdapter>.Instance);
    private readonly FakeResultQueue _queue = new();
    private readonly SessionOrchestrator _orchestrator;
    private readonly SysmexDriver _driver = new(NullLogger<SysmexDriver>.Instance);

    public OrchestratorFlowTests()
    {
        _orchestrator = new SessionOrchestrator(_api, _queue, NullLogger<SessionOrchestrator>.Instance);
    }

    // -------------------------------------------------------------------
    // Flow 1: order query
    // -------------------------------------------------------------------

    [Fact]
    public async Task HandleQuery_SampleFound_ReturnsOrderResponse()
    {
        var order = new OrderResponse(
            "SAM001",
            new Patient("P001", "John Smith", 40, "M", null),
            [new OrderedTest("WBC")],
            Found: true);
        _api.AddOrder(order);

        var msg = MakeQueryMessage("SAM001");
        var response = await _orchestrator.HandleQueryAsync(_driver, msg, default);

        // The response must have at least H and L records
        Assert.Contains(response.Records, r => r.StartsWith("H"));
        Assert.Contains(response.Records, r => r.StartsWith("L"));
    }

    [Fact]
    public async Task HandleQuery_SampleNotFound_ReturnsNoOrderMessage()
    {
        // No order registered -> API returns Found=false
        var msg = MakeQueryMessage("UNKNOWN999");
        var response = await _orchestrator.HandleQueryAsync(_driver, msg, default);

        // Even a no-order response has H and L records
        Assert.Contains(response.Records, r => r.StartsWith("H"));
        Assert.Contains(response.Records, r => r.StartsWith("L"));
    }

    [Fact]
    public async Task HandleQuery_ApiThrows_ReturnsNoOrderMessage()
    {
        var failingApi = new FailingApiAdapter();
        var orch = new SessionOrchestrator(failingApi, _queue, NullLogger<SessionOrchestrator>.Instance);

        var msg = MakeQueryMessage("SAM002");
        // Should not throw â€” orchestrator swallows the error and returns no-order
        var response = await orch.HandleQueryAsync(_driver, msg, default);
        Assert.NotEmpty(response.Records);
    }

    // -------------------------------------------------------------------
    // Flow 2: result upload
    // -------------------------------------------------------------------

    [Fact]
    public async Task HandleResults_ApiSucceeds_ReturnsTrueAndDoesNotQueue()
    {
        var msg = MakeResultMessage("SAM003");
        bool ok = await _orchestrator.HandleResultsAsync(_driver, msg, default);

        Assert.True(ok);
        Assert.Empty(_queue.Items);
        Assert.Single(_api.PostedResults);
    }

    [Fact]
    public async Task HandleResults_ApiFails_ReturnsFalseAndQueues()
    {
        var failingApi = new FailingApiAdapter();
        var orch = new SessionOrchestrator(failingApi, _queue, NullLogger<SessionOrchestrator>.Instance);

        var msg = MakeResultMessage("SAM004");
        bool ok = await orch.HandleResultsAsync(_driver, msg, default);

        Assert.False(ok);
        Assert.Single(_queue.Items); // result must be queued
    }

    // -------------------------------------------------------------------
    private static AstmMessage MakeQueryMessage(string sampleId)
        => new([
            $"H|\\^&|||LIS||||||LIS||P|1",
            $"Q|1|{sampleId}^||ALL",
            "L|1|F"
        ]);

    private static AstmMessage MakeResultMessage(string sampleId)
        => new([
            $"H|\\^&|||LIS||||||LIS||P|1",
            $"P|1|PAT001||||Smith^John",
            $"O|1|{sampleId}",
            $"R|1|^^^WBC|5.0|10^9/L|N||||||20240101120000",
            "L|1|N"
        ]);
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

internal sealed class FakeResultQueue : IResultQueue
{
    public List<ResultSet> Items { get; } = new();

    public Task EnqueueAsync(ResultSet results, CancellationToken ct) { Items.Add(results); return Task.CompletedTask; }
    public Task<IReadOnlyList<ResultSet>> DequeueAllAsync(CancellationToken ct) => Task.FromResult<IReadOnlyList<ResultSet>>(Items.AsReadOnly());
    public Task AcknowledgeAsync(ResultSet results, CancellationToken ct) { Items.Remove(results); return Task.CompletedTask; }
}

internal sealed class FailingApiAdapter : IApiAdapter
{
    public Task<OrderResponse> GetOrder(SampleQuery query, CancellationToken ct) => throw new HttpRequestException("API down");
    public Task PostResults(ResultSet results, CancellationToken ct) => throw new HttpRequestException("API down");
}

