using Xunit;
using LisMiddleware.Drivers;

namespace LisMiddleware.Astm.Tests;

public class AstmRecordHelperTests
{
    [Fact]
    public void Fields_SplitsOnPipe()
    {
        string[] fields = AstmRecord.Fields("H|A|B|C");
        Assert.Equal(new[] { "H", "A", "B", "C" }, fields);
    }

    [Fact]
    public void Field_IndexOutOfRange_ReturnsDefault()
    {
        Assert.Equal("", AstmRecord.Field("H|A", 5));
    }

    [Fact]
    public void Component_SplitsOnCaret()
    {
        string[] comps = AstmRecord.Components("Smith^John^M");
        Assert.Equal(new[] { "Smith", "John", "M" }, comps);
    }

    [Fact]
    public void RecordType_ReturnsFirstField()
    {
        Assert.Equal("H", AstmRecord.RecordType("H|\\^&|||LIS"));
    }

    [Fact]
    public void Build_JoinsWithPipe()
    {
        string record = AstmRecord.Build("P", "1", "PID001", null, null, "Smith^John");
        Assert.Equal("P|1|PID001|||Smith^John", record);
    }
}

