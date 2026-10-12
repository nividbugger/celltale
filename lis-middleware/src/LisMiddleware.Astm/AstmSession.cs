using System.Net.Sockets;
using System.Text;
using LisMiddleware.Core.Models;
using Microsoft.Extensions.Logging;

namespace LisMiddleware.Astm;

/// <summary>
/// Manages one ASTM session (one TCP connection) in receiver mode.
/// Handles the ENQ/ACK/NAK handshake, frame reassembly, and EOT.
/// Exposes a clean async API: receive a complete message, send a message.
/// </summary>
public sealed class AstmSession : IDisposable
{
    private readonly NetworkStream _stream;
    private readonly ILogger _log;
    private readonly byte[] _readBuf = new byte[4096];
    private readonly List<byte> _overflow = new();

    public AstmSession(NetworkStream stream, ILogger log)
    {
        _stream = stream;
        _log = log;
    }

    /// <summary>
    /// Wait for a sender to initiate a session (ENQ) and receive a complete ASTM message.
    /// Returns null if the connection closed cleanly before any session started.
    /// </summary>
    public async Task<AstmMessage?> ReceiveMessageAsync(CancellationToken ct)
    {
        // Wait for ENQ
        byte control = await ReadControlByteAsync(ct);
        if (control == 0) return null; // EOF
        if (control != AstmConstants.ENQ)
        {
            _log.LogWarning("Expected ENQ, got 0x{Byte:X2}", control);
            return null;
        }
        await WriteByteAsync(AstmConstants.ACK, ct);
        _log.LogDebug("ENQ received, ACK sent");

        var records = new List<string>();
        var frameBuffer = new List<byte>();
        int lastFrameNumber = -1;

        while (true)
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(AstmConstants.ReceiverTimeoutMs);

            byte b;
            try { b = await ReadControlByteAsync(timeout.Token); }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                _log.LogWarning("Receiver timeout: no data in {Ms} ms", AstmConstants.ReceiverTimeoutMs);
                return null;
            }

            if (b == AstmConstants.EOT)
            {
                _log.LogDebug("EOT received; message complete with {Count} records", records.Count);
                return new AstmMessage(records.AsReadOnly());
            }

            if (b == AstmConstants.STX)
            {
                // Read frame bytes until ETX (0x03) or ETB (0x17).
                // Do NOT stop at CR — CR is the record separator inside frame data and
                // stopping early causes multi-record frames to be truncated (checksum mismatch → NAK loop).
                var frameBuf = new List<byte> { AstmConstants.STX };
                while (true)
                {
                    byte fb = await ReadByteRawAsync(timeout.Token);
                    frameBuf.Add(fb);
                    if (fb == AstmConstants.ETX || fb == 0x17) // ETB
                    {
                        // Read exactly 2 checksum bytes + trailing CR
                        frameBuf.Add(await ReadByteRawAsync(timeout.Token)); // cs1
                        frameBuf.Add(await ReadByteRawAsync(timeout.Token)); // cs2
                        frameBuf.Add(await ReadByteRawAsync(timeout.Token)); // CR
                        // Any trailing LF will be consumed by the next ReadControlByteAsync
                        // and silently dropped (it is none of ENQ / STX / EOT).
                        break;
                    }
                }

                byte[] frameBytes = [.. frameBuf];
                try
                {
                    var (frame, _) = AstmFrameParser.TryParseFrame(frameBytes);
                    if (frame == null)
                    {
                        _log.LogWarning("Could not parse frame; sending NAK");
                        await WriteByteAsync(AstmConstants.NAK, ct);
                        continue;
                    }

                    _log.LogDebug("Frame {Num} received ({Len} bytes data)",
                        frame.FrameNumber, frame.Data.Length);

                    frameBuffer.AddRange(Encoding.ASCII.GetBytes(frame.Data));
                    lastFrameNumber = frame.FrameNumber;
                    await WriteByteAsync(AstmConstants.ACK, ct);

                    if (!frame.IsIntermediate)
                    {
                        // Complete record(s) in the buffer
                        string allData = Encoding.ASCII.GetString([.. frameBuffer]);
                        frameBuffer.Clear();
                        foreach (string record in allData.Split('\r', StringSplitOptions.RemoveEmptyEntries))
                            if (!string.IsNullOrWhiteSpace(record))
                                records.Add(record);
                    }
                }
                catch (AstmProtocolException ex)
                {
                    _log.LogWarning(ex, "Frame checksum error; sending NAK");
                    await WriteByteAsync(AstmConstants.NAK, ct);
                }
            }
            else if (b == AstmConstants.ENQ)
            {
                // Repeat ENQ: sender wants to retransmit; ACK to continue
                _log.LogDebug("Repeat ENQ received; ACKing");
                await WriteByteAsync(AstmConstants.ACK, ct);
            }
        }
    }

    /// <summary>
    /// Send a complete ASTM message to the analyzer (sender role).
    /// Breaks records into frames of up to MaxFrameDataBytes.
    /// </summary>
    public async Task SendMessageAsync(AstmMessage message, CancellationToken ct)
    {
        // Send ENQ, wait for ACK
        await WriteByteAsync(AstmConstants.ENQ, ct);
        byte ack = await ReadControlByteAsync(ct);
        if (ack != AstmConstants.ACK)
            throw new AstmProtocolException($"Expected ACK after ENQ, got 0x{ack:X2}");

        // Concatenate all records separated by CR
        string fullData = string.Join("\r", message.Records) + "\r";
        byte[] dataBytes = Encoding.ASCII.GetBytes(fullData);

        int frameNum = 1;
        int offset = 0;
        while (offset < dataBytes.Length)
        {
            int chunkLen = Math.Min(AstmConstants.MaxFrameDataBytes, dataBytes.Length - offset);
            bool isLast = offset + chunkLen >= dataBytes.Length;
            string chunk = Encoding.ASCII.GetString(dataBytes, offset, chunkLen);

            int retries = 0;
            while (true)
            {
                byte[] frameBytes = AstmFrameParser.BuildFrame(frameNum, chunk, !isLast);
                _log.LogDebug("Sending frame {Num} ({Len} bytes)", frameNum, chunkLen);
                await _stream.WriteAsync(frameBytes, ct);

                byte response = await ReadControlByteAsync(ct);
                if (response == AstmConstants.ACK) break;
                if (response == AstmConstants.NAK)
                {
                    if (++retries > AstmConstants.MaxRetransmissions)
                        throw new AstmProtocolException("Too many NAKs; aborting");
                    _log.LogWarning("NAK received for frame {Num}; retransmitting", frameNum);
                }
                else
                    throw new AstmProtocolException($"Unexpected byte 0x{response:X2} during send");
            }

            frameNum = (frameNum + 1) % 8;
            offset += chunkLen;
        }

        await WriteByteAsync(AstmConstants.EOT, ct);
        _log.LogDebug("EOT sent; message send complete");
    }

    private async Task<byte> ReadControlByteAsync(CancellationToken ct)
    {
        // Single-byte read for control characters
        byte[] buf = new byte[1];
        int n = await _stream.ReadAsync(buf.AsMemory(0, 1), ct);
        if (n == 0) return 0;
        return buf[0];
    }

    private async Task<byte> ReadByteRawAsync(CancellationToken ct)
    {
        byte[] buf = new byte[1];
        int n = await _stream.ReadAsync(buf.AsMemory(0, 1), ct);
        if (n == 0) throw new EndOfStreamException("Connection closed mid-frame");
        return buf[0];
    }

    private Task WriteByteAsync(byte b, CancellationToken ct)
        => _stream.WriteAsync(new[] { b }, 0, 1, ct);

    public void Dispose() => _stream.Dispose();
}
