namespace LisMiddleware.Astm;

public sealed class AstmProtocolException : Exception
{
    public AstmProtocolException(string message) : base(message) { }
    public AstmProtocolException(string message, Exception inner) : base(message, inner) { }
}
