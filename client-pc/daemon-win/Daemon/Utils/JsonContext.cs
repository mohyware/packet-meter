using System.Collections.Generic;
using System.Text.Json.Serialization;
using Daemon.Models;
using Daemon.Monitor;

namespace Daemon.Utils;

[JsonSourceGenerationOptions(
    GenerationMode = JsonSourceGenerationMode.Metadata,
    WriteIndented = false)]
[JsonSerializable(typeof(RegisterAppsRequest))]
[JsonSerializable(typeof(UsageReportRequest))]
[JsonSerializable(typeof(TotalUsageReportRequest))]
[JsonSerializable(typeof(ServerResponse))]
[JsonSerializable(typeof(AppRegistration))]
[JsonSerializable(typeof(AppUsageData))]
[JsonSerializable(typeof(List<AppRegistration>))]
[JsonSerializable(typeof(List<AppUsageData>))]
[JsonSerializable(typeof(TotalUsage))]
[JsonSerializable(typeof(InterfaceUsage))]
[JsonSerializable(typeof(Dictionary<string, InterfaceUsage>))]
[JsonSerializable(typeof(ProcessNetworkUsage))]
[JsonSerializable(typeof(PersistedUsage))]
internal partial class PacketMeterJsonContext : JsonSerializerContext
{
}

