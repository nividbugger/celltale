using LisMiddleware.Core.Interfaces;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LisMiddleware.Queue;

/// <summary>
/// Background service that periodically retries queued results that failed to post.
/// </summary>
public sealed class ResultRetryWorker : BackgroundService
{
    private readonly IResultQueue _queue;
    private readonly IApiAdapter _api;
    private readonly QueueOptions _opts;
    private readonly ILogger<ResultRetryWorker> _log;

    public ResultRetryWorker(
        IResultQueue queue,
        IApiAdapter api,
        IOptions<QueueOptions> opts,
        ILogger<ResultRetryWorker> log)
    {
        _queue = queue;
        _api   = api;
        _opts  = opts.Value;
        _log   = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("ResultRetryWorker started; retry interval {Ms} ms", _opts.RetryIntervalMs);
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(_opts.RetryIntervalMs, stoppingToken);
            await RetryPendingAsync(stoppingToken);
        }
    }

    private async Task RetryPendingAsync(CancellationToken ct)
    {
        var pending = await _queue.DequeueAllAsync(ct);
        if (pending.Count == 0) return;

        _log.LogInformation("Retrying {Count} queued result(s)", pending.Count);
        foreach (var rs in pending)
        {
            int attempt = 0;
            bool posted = false;
            while (attempt < _opts.RetryCount && !ct.IsCancellationRequested)
            {
                attempt++;
                try
                {
                    await _api.PostResults(rs, ct);
                    await _queue.AcknowledgeAsync(rs, ct);
                    _log.LogInformation("Retry succeeded: sample={Sample} attempt={Attempt}",
                        rs.SampleId, attempt);
                    posted = true;
                    break;
                }
                catch (Exception ex)
                {
                    int delay = _opts.BackoffSeconds * attempt * 1000;
                    _log.LogWarning(ex,
                        "Retry {Attempt}/{Max} failed for sample={Sample}; back-off {Delay} ms",
                        attempt, _opts.RetryCount, rs.SampleId, delay);
                    await Task.Delay(delay, ct);
                }
            }
            if (!posted)
                _log.LogError("All {Max} retries exhausted for sample={Sample}; left in queue",
                    _opts.RetryCount, rs.SampleId);
        }
    }
}
