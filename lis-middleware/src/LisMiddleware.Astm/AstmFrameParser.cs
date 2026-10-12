using System.Text;

namespace LisMiddleware.Astm;

/// <summary>
/// Stateless helpers for building and parsing ASTM E1381 frames.
/// Frame structure: STX + frameNum(char) + data + ETX + chk1 + chk2 + CR + LF
/// </summary>
public static class AstmFrameParser
{
    /// <summary>
    /// Build a complete frame byte sequence from data text.
    /// </summary>
    public static byte[] BuildFrame(int frameNumber, string data, bool intermediate = false)
    {
        // intermediate frames end with ETB (0x17) not ETX; last frame ends with ETX
        byte terminator = intermediate ? (byte)0x17 : AstmConstants.ETX;

        using var ms = new MemoryStream();
        ms.WriteByte(AstmConstants.STX);

        byte fnByte = (byte)('0' + (frameNumber % 8));
        ms.WriteByte(fnByte);

        byte[] dataBytes = Encoding.ASCII.GetBytes(data);
        ms.Write(dataBytes);
        ms.WriteByte(terminator);

        // checksum covers frame-number through terminator
        byte[] checksumPayload = [fnByte, ..dataBytes, terminator];
        string chk = ChecksumCalculator.Compute(checksumPayload);
        ms.Write(Encoding.ASCII.GetBytes(chk));

        ms.WriteByte(AstmConstants.CR);
        ms.WriteByte(AstmConstants.LF);

        return ms.ToArray();
    }

    /// <summary>
    /// Parse a frame from a byte buffer. Returns null if the buffer does not contain a full frame.
    /// Throws <see cref="AstmProtocolException"/> on checksum failure.
    /// </summary>
    public static (AstmFrame? Frame, int BytesConsumed) TryParseFrame(ReadOnlySpan<byte> buffer)
    {
        int stxIdx = buffer.IndexOf(AstmConstants.STX);
        if (stxIdx < 0) return (null, 0);

        // Scan for ETX or ETB after STX
        int start = stxIdx + 1; // frame number byte
        int termIdx = -1;
        byte terminator = 0;
        for (int i = start + 1; i < buffer.Length; i++)
        {
            if (buffer[i] == AstmConstants.ETX || buffer[i] == 0x17)
            {
                termIdx = i;
                terminator = buffer[i];
                break;
            }
        }
        if (termIdx < 0) return (null, 0);

        // need at least 2 checksum chars after terminator; CR/LF are consumed separately below
        int afterTerm = termIdx + 1;
        if (afterTerm + 2 > buffer.Length) return (null, 0);

        byte fnByte = buffer[start];
        int frameNumber = fnByte - '0';

        // Payload for checksum: frame-number byte through terminator (inclusive)
        ReadOnlySpan<byte> csPayload = buffer.Slice(start, termIdx - start + 1);
        string receivedCs = Encoding.ASCII.GetString(buffer.Slice(afterTerm, 2));

        if (!ChecksumCalculator.Verify(csPayload, receivedCs))
            throw new AstmProtocolException(
                $"Checksum mismatch: expected {ChecksumCalculator.Compute(csPayload)}, got {receivedCs}");

        string data = Encoding.ASCII.GetString(buffer.Slice(start + 1, termIdx - start - 1));
        bool isIntermediate = terminator == 0x17;

        int consumed = afterTerm + 2; // past checksum
        // consume optional CR/LF
        while (consumed < buffer.Length &&
               (buffer[consumed] == AstmConstants.CR || buffer[consumed] == AstmConstants.LF))
            consumed++;

        return (new AstmFrame(frameNumber, data, isIntermediate), consumed - stxIdx);
    }
}
