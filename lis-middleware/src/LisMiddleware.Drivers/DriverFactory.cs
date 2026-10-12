using LisMiddleware.Core.Interfaces;
using LisMiddleware.Drivers.Erba;
using LisMiddleware.Drivers.Sysmex;
using Microsoft.Extensions.Logging;

namespace LisMiddleware.Drivers;

public static class DriverFactory
{
    public static IAnalyzerDriver Create(string driverId, ILoggerFactory loggerFactory)
        => driverId.ToLowerInvariant() switch
        {
            "erba"   => new ErbaDriver(loggerFactory.CreateLogger<ErbaDriver>()),
            "sysmex" => new SysmexDriver(loggerFactory.CreateLogger<SysmexDriver>()),
            _ => throw new ArgumentException($"Unknown driver: {driverId}")
        };
}
