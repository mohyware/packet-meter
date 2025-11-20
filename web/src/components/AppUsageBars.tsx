import { useDeviceReportsStore } from '../stores/deviceReportsStore';
import { AppIcon } from '../utils/appIcon';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Info, Lock } from 'lucide-react';

export function AppUsageBars() {
  const { selectedReport, allAppsReport, setSelectedReport } =
    useDeviceReportsStore();
  const { features } = useAuth();
  const navigate = useNavigate();
  const report = selectedReport;

  if (!report) return null;

  const hasPerProcessAccess = features.reportType === 'per_process';

  const handleReset = () => {
    setSelectedReport(allAppsReport);
  };

  const handleUpgrade = () => {
    navigate('/settings');
  };

  const bytesToMB = (bytes: string): number => {
    return parseFloat(bytes) / (1024 * 1024);
  };

  const formatMB = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  // Locked state
  if (!hasPerProcessAccess) {
    const totalRx = bytesToMB(report.totalRx);
    const totalTx = bytesToMB(report.totalTx);
    const totalCombined = totalRx + totalTx;

    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">
            {report.id === 'all-reports'
              ? 'App Usage - All Reports'
              : `App Usage - ${new Date(report.timestamp).toLocaleString()}`}
          </h3>
          <button
            onClick={handleReset}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Reset
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

        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-8 text-center">
          <div className="flex justify-center mb-4">
            <Lock className="w-16 h-16 text-indigo-500" />
          </div>
          <h4 className="text-xl font-semibold text-gray-800 mb-2">
            Per-App Usage Locked
          </h4>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Upgrade your plan to see detailed per-application network usage
            breakdown. Your current plan only shows total usage.
          </p>
          <button
            onClick={handleUpgrade}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg"
          >
            Upgrade Your Plan
          </button>
        </div>
      </div>
    );
  }

  const apps = [...report.apps]
    .map((app) => ({
      id: app.id,
      identifier: app.identifier,
      displayName: app.displayName,
      iconHash: app.iconHash,
      name:
        app.identifier === 'total-usage'
          ? 'Untracked Usage'
          : (app.displayName ?? app.identifier),
      isUntracked: app.identifier === 'total-usage',
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

  const renderProgressBar = (
    download: number,
    upload: number,
    total: number,
    totalUsage: number
  ) => {
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
          {report.id === 'all-reports'
            ? 'App Usage - All Reports'
            : `App Usage - ${new Date(report.timestamp).toLocaleString()}`}
        </h3>
        {report.id !== 'all-reports' && (
          <button
            onClick={handleReset}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Back to all reports
          </button>
        )}
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
            <div
              key={app.id || index}
              className="flex items-center gap-4 py-3 border-b border-gray-200 last:border-0"
            >
              <AppIcon
                identifier={app.identifier}
                displayName={app.displayName}
                iconHash={app.iconHash}
                size={30}
                className="mr-2"
              />
              <div className="w-48 min-w-48 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div
                    className="font-medium text-gray-800 truncate"
                    title={app.name}
                  >
                    {app.name}
                  </div>
                  {app.isUntracked && (
                    <div className="relative group">
                      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 flex-shrink-0" />
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10 w-56 p-2 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-normal">
                        Usage before enabling per process track
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  )}
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
