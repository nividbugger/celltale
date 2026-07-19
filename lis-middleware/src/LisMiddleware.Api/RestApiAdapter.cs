using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LisMiddleware.Api;

/// <summary>
/// The only component that knows the existing API's URLs, auth, and JSON shapes.
/// All field names are driven by ApiOptions; if the API changes, only config changes.
///
/// TODO(api): Fill in appsettings.json Api section with actual endpoint paths,
///            field mappings, and auth credentials before connecting to the real API.
/// </summary>
public sealed class RestApiAdapter : IApiAdapter
{
    private readonly HttpClient _http;
    private readonly ApiOptions _opts;
    private readonly ILogger<RestApiAdapter> _log;

    public RestApiAdapter(HttpClient http, IOptions<ApiOptions> opts, ILogger<RestApiAdapter> log)
    {
        _http = http;
        _opts = opts.Value;
        _log  = log;
    }

    public async Task<OrderResponse> GetOrder(SampleQuery query, CancellationToken ct)
    {
        string path = _opts.OrderLookup.Path.Replace("{sampleId}", Uri.EscapeDataString(query.SampleId));
        using var req = new HttpRequestMessage(
            new HttpMethod(_opts.OrderLookup.Method), path);
        AddAuth(req);

        _log.LogInformation("GetOrder → {Method} {Path}", _opts.OrderLookup.Method, path);
        using var resp = await _http.SendAsync(req, ct);

        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound)
            return new OrderResponse(query.SampleId, null, [], Found: false);

        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
        _log.LogInformation("GetOrder ← {Status}", resp.StatusCode);

        // Celltale API returns { "found": false } on 200 when patient doesn't exist
        if (json.TryGetProperty("found", out var foundProp) && !foundProp.GetBoolean())
            return new OrderResponse(query.SampleId, null, [], Found: false);

        return MapOrderResponse(query.SampleId, json);
    }

    public async Task PostResults(ResultSet results, CancellationToken ct)
    {
        string path = _opts.ResultUpload.Path;
        var body = BuildResultPayload(results);
        using var req = new HttpRequestMessage(new HttpMethod(_opts.ResultUpload.Method), path)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };
        AddAuth(req);

        _log.LogInformation("PostResults → {Method} {Path} sample={Sample}",
            _opts.ResultUpload.Method, path, results.SampleId);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        _log.LogInformation("PostResults ← {Status}", resp.StatusCode);
    }

    private void AddAuth(HttpRequestMessage req)
    {
        switch (_opts.Auth.Type.ToLowerInvariant())
        {
            case "bearer":
                req.Headers.Authorization =
                    new AuthenticationHeaderValue("Bearer", _opts.Auth.Token);
                break;
            case "apikey":
                req.Headers.TryAddWithoutValidation(_opts.Auth.HeaderName, _opts.Auth.Token);
                break;
        }
    }

    private OrderResponse MapOrderResponse(string sampleId, JsonElement json)
    {
        // TODO(api): Update field names in ApiOptions.OrderLookup.FieldMap in appsettings.json.
        // Defaults below are examples; replace with the actual API response field names.
        var map = _opts.OrderLookup.FieldMap;

        string Get(string key, string fallback = "")
            => map.TryGetValue(key, out var field) && json.TryGetProperty(field, out var v)
                ? v.GetString() ?? fallback : fallback;

        string patientId = Get("patientId", "UNKNOWN");
        string name      = Get("name");
        string sex       = Get("sex");
        string dobStr    = Get("dateOfBirth");

        DateOnly? dob = DateOnly.TryParseExact(dobStr, ["yyyy-MM-dd", "yyyyMMdd"], out var d) ? d : null;

        // age is a JSON number in the API response; GetString() returns null for numbers
        int? age = null;
        if (map.TryGetValue("age", out var ageField) &&
            json.TryGetProperty(ageField, out var ageEl))
        {
            age = ageEl.ValueKind == JsonValueKind.Number ? ageEl.GetInt32() : null;
        }

        var patient = new Patient(patientId, name, age, sex, dob);

        var tests = new List<OrderedTest>();
        if (map.TryGetValue("tests", out var testsField) &&
            json.TryGetProperty(testsField, out var testsArr) &&
            testsArr.ValueKind == JsonValueKind.Array)
        {
            string testCodeField = map.TryGetValue("testCode", out var tf) ? tf : "code";
            foreach (var t in testsArr.EnumerateArray())
            {
                string code = t.TryGetProperty(testCodeField, out var cv) ? cv.GetString() ?? "" : "";
                if (!string.IsNullOrEmpty(code)) tests.Add(new OrderedTest(code));
            }
        }

        return new OrderResponse(sampleId, patient, tests.AsReadOnly(), Found: true);
    }

    private static object BuildResultPayload(ResultSet results)
    {
        // TODO(api): Adjust the payload shape to match the actual API's PostResults body.
        return new
        {
            sampleId   = results.SampleId,
            analyzerId = results.AnalyzerId,
            completedAt = results.RunCompletedAt.ToString("o"),
            patient = results.Patient == null ? null : new
            {
                id  = results.Patient.PatientId,
                name = results.Patient.Name
            },
            results = results.Results.Select(r => new
            {
                testCode    = r.TestCode,
                value       = r.Value,
                unit        = r.Unit,
                flag        = r.Flag.ToString(),
                completedAt = r.CompletedAt.ToString("o")
            })
        };
    }
}
