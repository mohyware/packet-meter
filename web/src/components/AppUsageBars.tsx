import { DeviceUsageReport } from '../api/devices';

interface AppUsageBarsProps {
    report: DeviceUsageReport;
    onClose: () => void;
}

export function AppUsageBars({ report, onClose }: AppUsageBarsProps) {
    const bytesToMB = (bytes: string): number => {
        return parseFloat(bytes) / (1024 * 1024);
    };

    const formatMB = (mb: number): string => {
        if (mb >= 1024) {
            return `${(mb / 1024).toFixed(2)} GB`;
        }
        return `${mb.toFixed(2)} MB`;
    };

    const apps = [...report.apps]
        .map(app => ({
            name: app.displayName ?? app.identifier,
            rx: bytesToMB(app.totalRx),
            tx: bytesToMB(app.totalTx),
            total: bytesToMB(app.totalRx) + bytesToMB(app.totalTx),
        }))
        .sort((a, b) => b.total - a.total);

    // TODO: need to be cached
    // Calculate total usage of all apps
    const totalRx = bytesToMB(report.totalRx);
    const totalTx = bytesToMB(report.totalTx);
    const totalCombined = totalRx + totalTx;

    const renderProgressBar = (download: number, upload: number, total: number, totalUsage: number) => {
        // Calculate the bar width as percentage of total usage of all apps
        const barWidthPercent = totalUsage > 0 ? (total / totalUsage) * 100 : 0;

        // Calculate download and upload as percentages of this app's total
        const downloadPercentOfApp = total > 0 ? (download / total) * 100 : 0;
        const uploadPercentOfApp = total > 0 ? (upload / total) * 100 : 0;

        return (
            <div className="flex items-center flex-1 min-w-0">
                <div className="relative h-6 bg-gray-200 rounded overflow-hidden flex-1 max-w-md">
                    {/* Container bar that represents this app's total relative to total usage of all apps */}
                    <div
                        className="absolute left-0 top-0 h-full"
                        style={{ width: `${barWidthPercent}%` }}
                    >
                        {/* Download (blue) - portion of this app's bar */}
                        {download > 0 && (
                            <div
                                className="absolute left-0 top-0 h-full bg-blue-500 transition-all"
                                style={{
                                    width: `${downloadPercentOfApp}%`,
                                    minWidth: download > 0 ? '1px' : '0',
                                }}
                                title={`Download: ${formatMB(download)}`}
                            />
                        )}
                        {/* Upload (green) - portion of this app's bar, after download */}
                        {upload > 0 && (
                            <div
                                className="absolute top-0 h-full bg-green-500 transition-all"
                                style={{
                                    left: `${downloadPercentOfApp}%`,
                                    width: `${uploadPercentOfApp}%`,
                                    minWidth: upload > 0 ? '1px' : '0',
                                }}
                                title={`Upload: ${formatMB(upload)}`}
                            />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                    App Usage - {new Date(report.timestamp).toLocaleString()}
                </h3>
                <button
                    onClick={onClose}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                    Close
                </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6 pb-4 border-b border-gray-200">
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600 uppercase tracking-wide">
                        Total Received
                    </span>
                    <span className="text-lg font-semibold text-blue-600">
                        {formatMB(totalRx)}
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600 uppercase tracking-wide">
                        Total Sent
                    </span>
                    <span className="text-lg font-semibold text-green-600">
                        {formatMB(totalTx)}
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600 uppercase tracking-wide">
                        Total Combined
                    </span>
                    <span className="text-lg font-semibold text-gray-800">
                        {formatMB(totalCombined)}
                    </span>
                </div>
            </div>

            <div className="space-y-4">
                {apps.map((app, index) => {
                    const downloadStr = formatMB(app.rx);
                    const uploadStr = formatMB(app.tx);

                    return (
                        <div key={index} className="flex items-center gap-4 py-3 border-b border-gray-200 last:border-0">
                            <div className="w-48 min-w-48 flex-shrink-0">
                                <div className="font-medium text-gray-800 truncate" title={app.name}>
                                    {app.name}
                                </div>
                            </div>
                            {renderProgressBar(app.rx, app.tx, app.total, totalCombined)}
                            <div className="text-sm text-gray-700 whitespace-nowrap font-mono flex-shrink-0 ml-4">
                                <span className="text-blue-600">{downloadStr}</span>
                                <span className="mx-1 text-gray-400">/</span>
                                <span className="text-green-600">{uploadStr}</span>
                                <span className="ml-2 text-gray-500">↑↓</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

