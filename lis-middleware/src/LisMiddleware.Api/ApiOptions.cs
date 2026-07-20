namespace LisMiddleware.Api;

public sealed class ApiOptions
{
    public string BaseUrl { get; set; } = "";
    public AuthOptions Auth { get; set; } = new();
    public EndpointOptions OrderLookup  { get; set; } = new();
    public EndpointOptions ResultUpload { get; set; } = new();
    public int TimeoutSeconds { get; set; } = 5;
}

public sealed class AuthOptions
{
    public string Type { get; set; } = ""; // "bearer" | "apikey" | "none"
    public string HeaderName  { get; set; } = "Authorization";
    public string Token       { get; set; } = "";
}

public sealed class EndpointOptions
{
    public string Method       { get; set; } = "GET";
    public string Path         { get; set; } = "/";
    public Dictionary<string, string> FieldMap { get; set; } = new();
}
