using LisMiddleware.Api;
using LisMiddleware.Core.Interfaces;
using LisMiddleware.Core.Orchestrator;
using LisMiddleware.Queue;
using LisMiddleware.Service;
using Microsoft.Extensions.Options;
using Polly;
using Polly.Extensions.Http;
using Serilog;

var host = Host.CreateDefaultBuilder(args)
    .UseWindowsService(o => o.ServiceName = "LisMiddleware")
    .UseSerilog((ctx, lc) => lc
        .ReadFrom.Configuration(ctx.Configuration)
        .WriteTo.EventLog("LisMiddleware", manageEventSource: true)
        .WriteTo.File(
            @"C:\ProgramData\LisMiddleware\logs\lis-.log",
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 30))
    .ConfigureServices((ctx, services) =>
    {
        var cfg = ctx.Configuration;

        // Options
        services.Configure<QueueOptions>(cfg.GetSection("Resilience"));
        services.Configure<ApiOptions>(cfg.GetSection("Api"));

        // API adapter (real or fake based on config)
        bool useFake = cfg.GetValue<bool>("Api:UseFake");
        if (useFake)
        {
            services.AddSingleton<IApiAdapter, FakeApiAdapter>();
        }
        else
        {
            services.AddHttpClient<RestApiAdapter>((sp, http) =>
            {
                var opts = sp.GetRequiredService<IOptions<ApiOptions>>().Value;
                http.BaseAddress = new Uri(opts.BaseUrl);
                http.Timeout = TimeSpan.FromSeconds(opts.TimeoutSeconds);
            })
            .AddPolicyHandler(HttpPolicyExtensions
                .HandleTransientHttpError()
                .WaitAndRetryAsync(3, retry => TimeSpan.FromSeconds(Math.Pow(2, retry))));
            services.AddSingleton<IApiAdapter>(sp => sp.GetRequiredService<RestApiAdapter>());
        }

        // Queue + retry worker
        services.AddSingleton<IResultQueue, FileSystemResultQueue>();
        services.AddHostedService<ResultRetryWorker>();

        // Orchestrator
        services.AddSingleton<SessionOrchestrator>();

        // One TCP listener per analyzer
        var listeners = cfg.GetSection("Listeners").GetChildren();
        foreach (var section in listeners)
        {
            string name = section.Key;
            var opts = new ListenerOptions();
            section.Bind(opts);
            services.AddSingleton<IHostedService>(sp =>
                new TcpListenerWorker(
                    name, opts,
                    sp.GetRequiredService<SessionOrchestrator>(),
                    sp.GetRequiredService<ILoggerFactory>()));
        }
    })
    .Build();

await host.RunAsync();
