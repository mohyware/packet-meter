using System.Collections.Generic;
using System.Text.Json.Serialization;
using PacketPilot.Daemon.Win.Models;
using PacketPilot.Daemon.Win.Monitor;

namespace PacketPilot.Daemon.Win.Utils;

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
internal partial class PacketPilotJsonContext : JsonSerializerContext
{
}

