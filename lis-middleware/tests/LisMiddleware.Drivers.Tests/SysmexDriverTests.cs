using Xunit;
using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Models;
using LisMiddleware.Drivers.Sysmex;
using Microsoft.Extensions.Logging.Abstractions;

namespace LisMiddleware.Drivers.Tests;

/// <summary>
/// Unit tests for the Sysmex XN-330 driver.
///
/// TODO(manual): Replace the sample frames below with actual captured frames from
///               a Sysmex XN-330 connection once the host interface specification is available.
///               Each test that exercises field parsing must be driven by a real captured frame,
///               not a synthetic one, to confirm that the field index constants are correct.
/// </summary>
public class SysmexDriverTests
{
    private readonly SysmexDriver _driver = new(NullLogger<SysmexDriver>.Instance);

    // -------------------------------------------------------------------
    // Classification tests
    // -------------------------------------------------------------------

    [Fact]
    public void ClassifyMessage_WithQRecord_ReturnsQuery()
    {
        // TODO(manual): replace with a captured Sysmex query frame
        var msg = MakeMessage("H|\\^&|||LIS||||||LIS||P|1", "Q|1|SAM001^||ALL");
        Assert.Equal(MessageKind.Query, _driver.ClassifyMessage(msg));
    }

    [Fact]
    public void ClassifyMessage_WithRRecord_ReturnsResults()
    {
        // TODO(manual): replace with a captured Sysmex result frame
        var msg = MakeMessage("H|\\^&|||LIS||||||LIS||P|1", "R|1|^^^WBC|5.0|10^9/L|N");
        Assert.Equal(MessageKind.Results, _driver.ClassifyMessage(msg));
    }

    [Fact]
    public void ClassifyMessage_NoKnownRecord_ReturnsUnknown()
    {
        var msg = MakeMessage("H|\\^&|||LIS", "L|1|N");
        Assert.Equal(MessageKind.Unknown, _driver.ClassifyMessage(msg));
    }

    // -------------------------------------------------------------------
    // Query parsing â€” stubs: update field indices after getting the manual
    // -------------------------------------------------------------------

    [Fact(Skip = "TODO(manual): update Q_SampleId field index from XN-series spec before enabling")]
    public void ParseQuery_RealSysmexFrame_ExtractsSampleId()
    {
        // TODO(manual): paste a real captured Sysmex Q record here
        var msg = MakeMessage("H|...", "Q|1|SAMPLE123^||ALL");
        var query = _driver.ParseQuery(msg);
        Assert.Equal("SAMPLE123", query.SampleId);
        Assert.Equal("sysmex", query.AnalyzerId);
    }

    [Fact(Skip = "TODO(manual): update field indices from XN-series spec before enabling")]
    public void ParseQuery_WorklistInquiry_ExtractsRackAndPosition()
    {
        // TODO(manual): paste a real captured Sysmex worklist Q record here
        var msg = MakeMessage("H|...", "Q|1|^RACK01^01||ALL");
        var query = _driver.ParseQuery(msg);
        Assert.Equal("RACK01", query.RackId);
        Assert.Equal("01",     query.Position);
    }

    // -------------------------------------------------------------------
    // Result parsing â€” stubs
    // -------------------------------------------------------------------

    [Fact(Skip = "TODO(manual): update R record field indices from XN-series spec before enabling")]
    public void ParseResults_MaskedAnalysisError_SetsFlag()
    {
        // TODO(manual): paste a real captured Sysmex R record with masked value
        var msg = MakeMessage(
            "H|...",
            "P|1|PAT001||||Smith^John",
            "O|1|SAM001",
            "R|1|^^^WBC|----|10^9/L|N",
            "L|1|N");
        var rs = _driver.ParseResults(msg);
        var result = rs.Results.First(r => r.TestCode.Contains("WBC", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(ResultFlag.AnalysisError, result.Flag);
        Assert.Null(result.Value);
    }

    [Fact(Skip = "TODO(manual): update R record field indices from XN-series spec before enabling")]
    public void ParseResults_OutOfRange_SetsFlag()
    {
        var msg = MakeMessage(
            "H|...",
            "O|1|SAM002",
            "R|1|^^^WBC|++++|10^9/L|N",
            "L|1|N");
        var rs = _driver.ParseResults(msg);
        var result = rs.Results.First();
        Assert.Equal(ResultFlag.OutOfRange, result.Flag);
    }

    // -------------------------------------------------------------------
    // Serialization round-trip â€” stubs
    // -------------------------------------------------------------------

    [Fact(Skip = "TODO(manual): enable after field indices confirmed")]
    public void SerializeOrderResponse_ProducesValidRecords()
    {
        var response = new OrderResponse(
            "SAM001",
            new Patient("PAT001", "John Smith", 45, "M", new DateOnly(1980, 1, 15)),
            [new OrderedTest("WBC"), new OrderedTest("RBC")],
            Found: true);

        var msg = _driver.SerializeOrderResponse(response);
        Assert.Contains(msg.Records, r => AstmRecord.RecordType(r) == "H");
        Assert.Contains(msg.Records, r => AstmRecord.RecordType(r) == "P");
        Assert.Contains(msg.Records, r => AstmRecord.RecordType(r) == "O");
        Assert.Contains(msg.Records, r => AstmRecord.RecordType(r) == "L");
    }

    [Fact]
    public void SerializeNoOrderResponse_ContainsExpectedRecordTypes()
    {
        var msg = _driver.SerializeNoOrderResponse("SAM999");
        Assert.Contains(msg.Records, r => AstmRecord.RecordType(r) == "H");
        Assert.Contains(msg.Records, r => AstmRecord.RecordType(r) == "O");
        Assert.Contains(msg.Records, r => AstmRecord.RecordType(r) == "L");
    }

    // -------------------------------------------------------------------
    private static AstmMessage MakeMessage(params string[] records)
        => new(records.ToList().AsReadOnly());
}

