using Xunit;
using LisMiddleware.Astm;
using System.Text;

namespace LisMiddleware.Astm.Tests;

public class AstmFramingTests
{
    [Fact]
    public void BuildFrame_RoundTrip_ParsesBack()
    {
        byte[] frame = AstmFrameParser.BuildFrame(1, "H|\\^&|||LIS|||||||P|1", intermediate: false);
        var (parsed, _) = AstmFrameParser.TryParseFrame(frame);

        Assert.NotNull(parsed);
        Assert.Equal(1, parsed.FrameNumber);
        Assert.Equal("H|\\^&|||LIS|||||||P|1", parsed.Data);
        Assert.False(parsed.IsIntermediate);
    }

    [Fact]
    public void BuildFrame_IntermediateFlag_ParsesAsIntermediate()
    {
        byte[] frame = AstmFrameParser.BuildFrame(3, "some data", intermediate: true);
        var (parsed, _) = AstmFrameParser.TryParseFrame(frame);

        Assert.NotNull(parsed);
        Assert.True(parsed.IsIntermediate);
    }

    [Fact]
    public void BuildFrame_FrameNumberWraps_Mod8()
    {
        // Frame number 8 should wrap to 0
        byte[] frame = AstmFrameParser.BuildFrame(8, "data", false);
        var (parsed, _) = AstmFrameParser.TryParseFrame(frame);
        Assert.NotNull(parsed);
        Assert.Equal(0, parsed.FrameNumber);
    }

    [Fact]
    public void TryParseFrame_CorruptChecksum_ThrowsProtocolException()
    {
        byte[] good = AstmFrameParser.BuildFrame(1, "test", false);
        // Corrupt the checksum bytes (positions: STX + fn + data + ETX + [cs1,cs2] + CR + LF)
        // checksum is at good.Length - 4 and good.Length - 3
        good[good.Length - 4] = (byte)'X';
        good[good.Length - 3] = (byte)'X';

        Assert.Throws<AstmProtocolException>(() => AstmFrameParser.TryParseFrame(good));
    }

    [Fact]
    public void TryParseFrame_EmptyBuffer_ReturnsNull()
    {
        var (frame, consumed) = AstmFrameParser.TryParseFrame([]);
        Assert.Null(frame);
        Assert.Equal(0, consumed);
    }

    [Fact]
    public void TryParseFrame_IncompleteBuffer_ReturnsNull()
    {
        byte[] partial = [AstmConstants.STX, (byte)'1', (byte)'H'];
        var (frame, _) = AstmFrameParser.TryParseFrame(partial);
        Assert.Null(frame);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(7)]
    public void BuildFrame_ValidFrameNumbers_RoundTrip(int frameNumber)
    {
        byte[] frame = AstmFrameParser.BuildFrame(frameNumber, "payload", false);
        var (parsed, _) = AstmFrameParser.TryParseFrame(frame);
        Assert.NotNull(parsed);
        Assert.Equal(frameNumber, parsed.FrameNumber);
    }
}

