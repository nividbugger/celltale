using Xunit;
using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Models;
using LisMiddleware.Drivers.Erba;
using Microsoft.Extensions.Logging.Abstractions;

namespace LisMiddleware.Drivers.Tests;

/// <summary>
/// Unit tests for the Erba XL-200 driver.
/// All synthetic frames follow the format confirmed in the EM 200 Host Interface Document v2.0.
/// </summary>
public class ErbaDriverTests
{
    private readonly ErbaDriver _driver = new(NullLogger<ErbaDriver>.Instance);

    // ── Classification ────────────────────────────────────────────────────────

    [Fact]
    public void ClassifyMessage_WithQRecord_ReturnsQuery()
    {
        var msg = MakeMessage("H|`^&||||||||||P|E 1394-97|20260718", "Q|1|^10006122|||S|||||||O");
        Assert.Equal(MessageKind.Query, _driver.ClassifyMessage(msg));
    }

    [Fact]
    public void ClassifyMessage_WithRRecord_ReturnsResults()
    {
        var msg = MakeMessage("H|`^&||||||||||P|E 1394-97|20260718", "R|1|^^^LDH|321|U/L|||N|F||||20080605120000");
        Assert.Equal(MessageKind.Results, _driver.ClassifyMessage(msg));
    }

    // ── Q record parsing (barcode scan) ───────────────────────────────────────

    [Fact]
    public void ParseQuery_ErbaFormat_ExtractsSampleIdFromComponent1()
    {
        // Real Erba Q frame: Q|1|^10006122|||S|||||||O
        // Field 3 = "^10006122" → component 0 = "", component 1 = "10006122"
        var msg = MakeMessage(
            "H|`^&||||||||||P|E 1394-97|20260718",
            "Q|1|^10006122|||S|||||||O",
            "L|1|N");
        var query = _driver.ParseQuery(msg);
        Assert.Equal("10006122", query.SampleId);
    }

    [Fact]
    public void ParseQuery_ThrowsWhenSampleIdEmpty()
    {
        // Field 3 = "^" means both components empty → should throw
        var msg = MakeMessage("H|`^&", "Q|1|^|||S|||||||O");
        Assert.Throws<InvalidOperationException>(() => _driver.ParseQuery(msg));
    }

    // ── R record parsing ──────────────────────────────────────────────────────

    [Fact]
    public void ParseResults_ErbaRRecord_ExtractsTestCodeFromComponent3()
    {
        // R field 3 = "^^^LDH" → split by ^ → ["","","","LDH"] → component 3 = "LDH"
        var msg = MakeMessage(
            "H|`^&||||||||||P|E 1394-97|20260718",
            "P|1|PAT001|||VICHARE^PAT1||19710704|M",
            "O|1|10006122||^^^LDH|R",
            "R|1|^^^LDH|321|U/L|||N|F||||20080605120000",
            "L|1|N");
        var rs = _driver.ParseResults(msg);
        Assert.Single(rs.Results);
        Assert.Equal("LDH", rs.Results[0].TestCode);
        Assert.Equal("321", rs.Results[0].Value);
        Assert.Equal("U/L", rs.Results[0].Unit);
        Assert.Equal(ResultFlag.Normal, rs.Results[0].Flag);
    }

    [Fact]
    public void ParseResults_MaskedAnalysisError_SetsCorrectFlag()
    {
        var msg = MakeMessage(
            "H|`^&",
            "P|1|PAT002|||DOE^JANE||19800101|F",
            "O|1|SAM002",
            "R|1|^^^ALT|----|U/L|||N|F||||20260718090000",
            "L|1|N");
        var rs = _driver.ParseResults(msg);
        Assert.Equal(ResultFlag.AnalysisError, rs.Results[0].Flag);
        Assert.Null(rs.Results[0].Value);
    }

    [Fact]
    public void ParseResults_ExtractsSampleIdFromOField3()
    {
        var msg = MakeMessage(
            "H|`^&",
            "O|1|SAMPLE99||^^^GLU|R",
            "R|1|^^^GLU|5.4|mmol/L|||N|F||||20260718090000",
            "L|1|N");
        var rs = _driver.ParseResults(msg);
        Assert.Equal("SAMPLE99", rs.SampleId);
    }

    // ── Outbound serialization ─────────────────────────────────────────────────

    [Fact]
    public void SerializeOrderResponse_HRecord_UsesBacktickDelimiter()
    {
        var response = new OrderResponse("10006122",
            new Patient("10006122", "John Smith", 35, "M", new DateOnly(1991, 5, 15)),
            new List<OrderedTest> { new("GLU") }.AsReadOnly(),
            Found: true);

        var msg = _driver.SerializeOrderResponse(response);
        string hRecord = msg.Records.First(r => AstmRecord.RecordType(r) == "H");
        Assert.StartsWith("H|`^&", hRecord);
    }

    [Fact]
    public void SerializeOrderResponse_HRecord_HasCorrectVersion()
    {
        var response = new OrderResponse("S001",
            new Patient("S001", "Test Patient", 30, "F", null),
            Array.Empty<OrderedTest>(),
            Found: true);

        var msg = _driver.SerializeOrderResponse(response);
        string hRecord = msg.Records.First(r => AstmRecord.RecordType(r) == "H");
        Assert.Contains("E 1394-97", hRecord);
    }

    [Fact]
    public void SerializeOrderResponse_PRecord_UsesDobNotAge()
    {
        var dob = new DateOnly(1971, 7, 4);
        var response = new OrderResponse("10006122",
            new Patient("10006122", "VICHARE PAT1", null, "M", dob),
            Array.Empty<OrderedTest>(),
            Found: true);

        var msg = _driver.SerializeOrderResponse(response);
        string pRecord = msg.Records.First(r => AstmRecord.RecordType(r) == "P");
        // Field 8 (index 7) should contain "19710704"
        string dobField = AstmRecord.Field(pRecord, 7);
        Assert.Equal("19710704", dobField);
    }

    [Fact]
    public void SerializeOrderResponse_PRecord_DerivesApproxDobFromAgeWhenNoDob()
    {
        var response = new OrderResponse("10006122",
            new Patient("10006122", "JOHN SMITH", 35, "M", null),
            Array.Empty<OrderedTest>(),
            Found: true);

        var msg = _driver.SerializeOrderResponse(response);
        string pRecord = msg.Records.First(r => AstmRecord.RecordType(r) == "P");
        string dobField = AstmRecord.Field(pRecord, 7);
        // Approximate DOB = (currentYear - 35) + "0101"
        string expectedYear = (DateTime.Now.Year - 35).ToString();
        Assert.StartsWith(expectedYear, dobField);
        Assert.EndsWith("0101", dobField);
    }

    [Fact]
    public void SerializeOrderResponse_ORecord_UsesBacktickRepeatBetweenTests()
    {
        var response = new OrderResponse("10006122",
            new Patient("10006122", "JOHN DOE", 40, "M", null),
            new List<OrderedTest> { new("ALT"), new("AST"), new("GLU") }.AsReadOnly(),
            Found: true);

        var msg = _driver.SerializeOrderResponse(response);
        string oRecord = msg.Records.First(r => AstmRecord.RecordType(r) == "O");
        string testField = AstmRecord.Field(oRecord, 4); // field 5 = test list
        // ALT→SGPTD, AST→SGOTD, GLU→GLU; separated by backtick
        Assert.Contains("`", testField);
        Assert.Contains("^^^SGPTD", testField);
        Assert.Contains("^^^SGOTD", testField);
        Assert.Contains("^^^GLU", testField);
    }

    [Fact]
    public void SerializeOrderResponse_ORecord_ReportTypeIsQ()
    {
        var response = new OrderResponse("10006122",
            new Patient("10006122", "JOHN DOE", 40, "M", null),
            Array.Empty<OrderedTest>(),
            Found: true);

        var msg = _driver.SerializeOrderResponse(response);
        string oRecord = msg.Records.First(r => AstmRecord.RecordType(r) == "O");
        // Report type at field 26 (index 25)
        string reportType = AstmRecord.Field(oRecord, 25);
        Assert.Equal("Q", reportType);
    }

    [Fact]
    public void SerializeNoOrderResponse_ORecord_ReportTypeIsZ()
    {
        var msg = _driver.SerializeNoOrderResponse("SAM888");
        string oRecord = msg.Records.First(r => AstmRecord.RecordType(r) == "O");
        string reportType = AstmRecord.Field(oRecord, 25);
        Assert.Equal("Z", reportType);
    }

    [Fact]
    public void SerializeNoOrderResponse_ContainsHOL()
    {
        var msg = _driver.SerializeNoOrderResponse("SAM888");
        Assert.Contains(msg.Records, r => AstmRecord.RecordType(r) == "H");
        Assert.Contains(msg.Records, r => AstmRecord.RecordType(r) == "O");
        Assert.Contains(msg.Records, r => AstmRecord.RecordType(r) == "L");
        Assert.DoesNotContain(msg.Records, r => AstmRecord.RecordType(r) == "P");
    }

    private static AstmMessage MakeMessage(params string[] records)
        => new(records.ToList().AsReadOnly());
}
