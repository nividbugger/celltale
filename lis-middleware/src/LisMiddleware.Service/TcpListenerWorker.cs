using System.Net;
using System.Net.Sockets;
using LisMiddleware.Astm;
using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Orchestrator;
using LisMiddleware.Drivers;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LisMiddleware.Service;

/// <summary>
/// BackgroundService that owns one TCP listener for one analyzer.
/// Reconnect-tolerant: drops old connection, keeps accepting new ones.
/// </summary>
public sealed class TcpListenerWorker : BackgroundService
{
    private readonly string _analyzerName;
    private readonly ListenerOptions _opts;
    private readonly SessionOrchestrator _orchestrator;
    private readonly ILoggerFactory _loggerFactory;
    private readonly ILogger<TcpListenerWorker> _log;

    public TcpListenerWorker(
        string analyzerName,
        ListenerOptions opts,
        SessionOrchestrator orchestrator,
        ILoggerFactory loggerFactory)
    {
        _analyzerName = analyzerName;
        _opts         = opts;
        _orchestrator = orchestrator;
        _loggerFactory = loggerFactory;
        _log = loggerFactory.CreateLogger<TcpListenerWorker>();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var listener = new TcpListener(IPAddress.Any, _opts.Port);
        listener.Start();
        _log.LogInformation("Listening for {Analyzer} on port {Port}", _analyzerName, _opts.Port);

        IAnalyzerDriver driver = DriverFactory.Create(_opts.Driver, _loggerFactory);

        while (!stoppingToken.IsCancellationRequested)
        {
            TcpClient client;
            try
            {
                client = await listener.AcceptTcpClientAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "{Analyzer}: accept failed", _analyzerName);
                continue;
            }

            _ = HandleClientAsync(client, driver, stoppingToken);
        }

        listener.Stop();
    }

    private async Task HandleClientAsync(TcpClient client, IAnalyzerDriver driver, CancellationToken ct)
    {
        string remote = client.Client.RemoteEndPoint?.ToString() ?? "?";
        _log.LogInformation("{Analyzer}: connection from {Remote}", _analyzerName, remote);

        try
        {
            using var session = new AstmSession(client.GetStream(),
                _loggerFactory.CreateLogger<AstmSession>());

            while (!ct.IsCancellationRequested)
            {
                var message = await session.ReceiveMessageAsync(ct);
                if (message == null) break;

                var kind = driver.ClassifyMessage(message);
                _log.LogInformation("{Analyzer}: received {Kind} message", _analyzerName, kind);

                switch (kind)
                {
                    case MessageKind.Query:
                        var responseMsg = await _orchestrator.HandleQueryAsync(driver, message, ct);
                        await session.SendMessageAsync(responseMsg, ct);
                        break;

                    case MessageKind.Results:
                        bool ack = await _orchestrator.HandleResultsAsync(driver, message, ct);
                        if (!ack)
                            _log.LogWarning("{Analyzer}: API post failed; result queued for retry", _analyzerName);
                        break;

                    default:
                        var types = string.Join(",", message.Records.Select(LisMiddleware.Drivers.AstmRecord.RecordType));
                        _log.LogWarning("{Analyzer}: unknown message kind; record types={Types}", _analyzerName, types);
                        break;
                }
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _log.LogError(ex, "{Analyzer}: session error with {Remote}", _analyzerName, remote);
        }
        finally
        {
            client.Dispose();
            _log.LogInformation("{Analyzer}: disconnected {Remote}", _analyzerName, remote);
        }
    }
}
