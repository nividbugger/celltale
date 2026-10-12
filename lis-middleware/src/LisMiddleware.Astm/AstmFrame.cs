namespace LisMiddleware.Astm;

/// <summary>A single decoded ASTM frame (STX...ETX...checksum).</summary>
public sealed class AstmFrame
{
    public int FrameNumber { get; }   // 0-7
    public string Data     { get; }   // The text payload (without framing bytes)
    public bool IsIntermediate { get; } // true = more frames follow; false = last frame (ETX)

    public AstmFrame(int frameNumber, string data, bool isIntermediate)
    {
        FrameNumber = frameNumber;
        Data = data;
        IsIntermediate = isIntermediate;
    }
}
