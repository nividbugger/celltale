using System.Text.Json;
using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LisMiddleware.Queue;

/// <summary>
/// Durable result queue backed by JSON files in a local directory.
/// One file per ResultSet. Files are deleted after a successful API post.
/// </summary>
public sealed class FileSystemResultQueue : IResultQueue
{
    private readonly string _dir;
    private readonly ILogger<FileSystemResultQueue> _log;

    public FileSystemResultQueue(IOptions<QueueOptions> opts, ILogger<FileSystemResultQueue> log)
    {
        _dir = opts.Value.ResultQueuePath;
        _log = log;
        Directory.CreateDirectory(_dir);
    }

    public async Task EnqueueAsync(ResultSet results, CancellationToken ct)
    {
        string filename = $"{results.SampleId}_{results.RunCompletedAt:yyyyMMddHHmmss}_{Guid.NewGuid():N}.json";
        string path = Path.Combine(_dir, filename);
        string json = JsonSerializer.Serialize(results, _jsonOpts);
        await File.WriteAllTextAsync(path, json, ct);
        _log.LogInformation("Queued result for retry: {File}", filename);
    }

    public async Task<IReadOnlyList<ResultSet>> DequeueAllAsync(CancellationToken ct)
    {
        var result = new List<ResultSet>();
        foreach (string file in Directory.GetFiles(_dir, "*.json"))
        {
            try
            {
                string json = await File.ReadAllTextAsync(file, ct);
                var rs = JsonSerializer.Deserialize<ResultSet>(json, _jsonOpts);
                if (rs != null) result.Add(rs);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Could not deserialize queue file {File}; skipping", file);
            }
        }
        return result.AsReadOnly();
    }

    public Task AcknowledgeAsync(ResultSet results, CancellationToken ct)
    {
        // Remove by prefix match since the file has a Guid suffix
        string prefix = $"{results.SampleId}_{results.RunCompletedAt:yyyyMMddHHmmss}_";
        foreach (string file in Directory.GetFiles(_dir, $"{prefix}*.json"))
        {
            try { File.Delete(file); _log.LogInformation("Dequeued: {File}", Path.GetFileName(file)); }
            catch (Exception ex) { _log.LogWarning(ex, "Could not delete queue file {File}", file); }
        }
        return Task.CompletedTask;
    }

    private static readonly JsonSerializerOptions _jsonOpts = new()
    {
        WriteIndented = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };
}
