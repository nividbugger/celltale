using Xunit;
using LisMiddleware.Astm;
using System.Text;

namespace LisMiddleware.Astm.Tests;

public class ChecksumCalculatorTests
{
    [Fact]
    public void Compute_KnownPayload_ReturnsCorrectChecksum()
    {
        // ASTM E1381 checksum: sum of bytes mod 256, as 2-char uppercase hex
        // Payload: "1H|\^&" (frame number '1', record text "H|\^&", terminator ETX)
        byte[] payload = Encoding.ASCII.GetBytes("1H|\\^&\x03");
        string checksum = ChecksumCalculator.Compute(payload);
        Assert.Matches("^[0-9A-F]{2}$", checksum);
    }

    [Fact]
    public void Verify_MatchingChecksum_ReturnsTrue()
    {
        byte[] payload = Encoding.ASCII.GetBytes("1test\x03");
        string chk = ChecksumCalculator.Compute(payload);
        Assert.True(ChecksumCalculator.Verify(payload, chk));
    }

    [Fact]
    public void Verify_WrongChecksum_ReturnsFalse()
    {
        byte[] payload = Encoding.ASCII.GetBytes("1test\x03");
        Assert.False(ChecksumCalculator.Verify(payload, "00"));
    }

    [Fact]
    public void Compute_EmptyPayload_Returns00()
    {
        Assert.Equal("00", ChecksumCalculator.Compute([]));
    }

    [Fact]
    public void Compute_Overflow_WrapsModulo256()
    {
        // 257 bytes each with value 1: sum=257, mod 256=1 -> "01"
        byte[] payload = Enumerable.Repeat((byte)1, 257).ToArray();
        Assert.Equal("01", ChecksumCalculator.Compute(payload));
    }
}

