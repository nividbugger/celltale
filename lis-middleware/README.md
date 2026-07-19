# LIS Middleware — ASTM to REST Bridge

Windows service that bridges the **Erba XL-200** and **Sysmex XN-330** analyzers to an existing patient-record REST API.

## Architecture

```
Erba XL-200  (TCP → port 5100) ─► erba driver  ─┐
Sysmex XN-330 (TCP → port 5200) ─► sysmex driver ─┤
                                                  ▼
                                    Session Orchestrator
                                                  │
                                        REST API Adapter
                                                  ▼
                                      Existing patient API
```

## Before you build

**Required — attach vendor manuals and fill in TODO(manual) constants:**

1. `src/LisMiddleware.Drivers/Sysmex/SysmexDriver.cs` — field index constants (Q/P/O/R records)
2. `src/LisMiddleware.Drivers/Sysmex/SysmexTestCodeMap.cs` — analysis-parameter code table
3. `src/LisMiddleware.Drivers/Erba/ErbaDriver.cs` — field index constants
4. `src/LisMiddleware.Drivers/Erba/ErbaTestCodeMap.cs` — test-code table
5. After filling in the maps, remove the `Skip` attribute from the corresponding tests.

**Required — configure the API (see TODO(api) in RestApiAdapter.cs):**

Edit `src/LisMiddleware.Service/appsettings.json` → `Api` section:
- `BaseUrl`: your API's base URL
- `Auth.Type`: `bearer`, `apikey`, or `none`
- `Auth.Token`: your token or API key
- `OrderLookup.Path`: e.g. `/orders/{sampleId}`
- `OrderLookup.FieldMap`: maps neutral names to your API's JSON field names
- `ResultUpload.Path`: e.g. `/results`

Set `Api.UseFake: true` to use the in-memory fake adapter for testing without the real API.

## Build

```powershell
cd lis-middleware
dotnet build
dotnet test
```

## Run in console mode (debugging)

```powershell
cd src\LisMiddleware.Service
dotnet run
```

## Install as Windows service

```powershell
# Build release
dotnet publish -c Release -r win-x64 --self-contained -o C:\LisMiddleware\bin

# Register service (run as Administrator)
New-Service -Name "LisMiddleware" `
            -BinaryPathName "C:\LisMiddleware\bin\LisMiddleware.Service.exe" `
            -DisplayName "LIS Middleware (ASTM Bridge)" `
            -StartupType Automatic `
            -Description "Bridges Erba XL-200 and Sysmex XN-330 to the patient REST API"

Start-Service -Name "LisMiddleware"
```

Remove the service:
```powershell
Stop-Service -Name "LisMiddleware"
Remove-Service -Name "LisMiddleware"
```

## Analyzer configuration

### Sysmex XN-330
In the analyzer's host-communication settings:
- **Output Setting → Host Computer → XN-L series ASTM**
- Host IP: the IP address of this Windows machine
- Host Port: `5200`
- Protocol: ASTM

### Erba XL-200
In the analyzer's host/LIS interface configuration:
- Host IP: the IP address of this Windows machine
- Host Port: `5100`
- Protocol: ASTM (per XL-200 specification)

## Logging

Logs go to two sinks simultaneously:
- **Windows Event Log** → source `LisMiddleware`
- **Rolling file** → `C:\ProgramData\LisMiddleware\logs\lis-YYYYMMDD.log` (30-day retention)

Every ASTM frame in/out is logged at **Debug** level. Every API call and its outcome is logged at **Info** level. Change levels via `appsettings.json` → `Serilog.MinimumLevel`.

## Durable result queue

If the API is unreachable when results arrive, the `ResultSet` is serialized to:
```
C:\ProgramData\LisMiddleware\queue\<sampleId>_<timestamp>_<guid>.json
```
The `ResultRetryWorker` background service retries every 15 seconds (configurable via `Resilience.RetryIntervalMs`) with exponential back-off up to `Resilience.RetryCount` attempts.

## Project structure

```
src/
  LisMiddleware.Core/         Internal models + interfaces + session orchestrator
  LisMiddleware.Astm/         ASTM E1381 framing, checksum, session state machine
  LisMiddleware.Drivers/      Erba + Sysmex per-analyzer drivers
  LisMiddleware.Api/          REST API adapter (real + fake)
  LisMiddleware.Queue/        Durable file-system result queue + retry worker
  LisMiddleware.Service/      Windows service host, TCP listeners, wiring
tests/
  LisMiddleware.Astm.Tests/   Framing, checksum, handshake unit tests
  LisMiddleware.Drivers.Tests/ Per-driver parse/serialize round-trip tests
  LisMiddleware.Core.Tests/   Orchestrator flow tests (with fake adapter)
```
