using System.Text;

namespace LisMiddleware.Astm;

public static class ChecksumCalculator
{
    /// <summary>
    /// Compute the ASTM E1381 checksum over <paramref name="data"/> (frame number through ETX inclusive).
    /// Checksum = sum of byte values mod 256, expressed as 2 uppercase hex characters.
    /// </summary>
    public static string Compute(ReadOnlySpan<byte> data)
    {
        int sum = 0;
        foreach (byte b in data) sum += b;
        return (sum % 256).ToString("X2");
    }

    /// <summary>Verify that the two-char checksum matches the payload.</summary>
    public static bool Verify(ReadOnlySpan<byte> payload, string checksum)
        => string.Equals(Compute(payload), checksum, StringComparison.OrdinalIgnoreCase);
}
