namespace LisMiddleware.Astm;

public static class AstmConstants
{
    public const byte SOH = 0x01;
    public const byte STX = 0x02;
    public const byte ETX = 0x03;
    public const byte EOT = 0x04;
    public const byte ENQ = 0x05;
    public const byte ACK = 0x06;
    public const byte NAK = 0x15;
    public const byte CR  = 0x0D;
    public const byte LF  = 0x0A;

    public const int  MaxFrameDataBytes = 240;
    public const int  ReceiverTimeoutMs = 30_000;
    public const int  MaxRetransmissions = 6;

    // ASTM E1394 record field separator
    public const char FieldSep     = '|';
    public const char ComponentSep = '^';
    public const char RepeatSep    = '\\';
    public const char EscapeChar   = '&';
}
