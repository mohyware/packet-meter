import { useEffect, useRef, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { AppUsageBars } from './AppUsageBars';
import { useDeviceReportsStore } from '../stores/deviceReportsStore';
import { useTimePeriodStore } from '../stores/timePeriodStore';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export function UsageChart() {
  const { reports } = useDeviceReportsStore();
  const { selectedPeriod } = useTimePeriodStore();
  const appUsageBarsRef = useRef<HTMLDivElement>(null);

  const bytesToMB = (bytes: string): number => {
    return parseFloat(bytes) / (1024 * 1024);
  };

  const { selectedReport, setSelectedReport } = useDeviceReportsStore();
  const sortedReports = useMemo(
    () =>
      [...reports].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    [reports]
  );

  // Calculate time span once for all labels
  const timestamps = sortedReports.map((r) => new Date(r.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeSpanHours = (maxTime - minTime) / (1000 * 60 * 60);
  const timeSpanDays = timeSpanHours / 24;

  // Downsample TODO: add conditions for different screen sizes
  const shouldDownsample = timeSpanDays >= 6;
  const displayReports = useMemo(() => {
    if (!shouldDownsample) return sortedReports;
    return sortedReports.filter(
      (_, index) => index % Math.ceil(timeSpanDays / 3) === 0
    );
  }, [sortedReports, shouldDownsample, timeSpanDays]);

  // Count unique days in the dataset
  const uniqueDays = new Set(
    displayReports.map((r) => new Date(r.timestamp).toLocaleDateString())
  ).size;

  // Count unique months in the dataset
  const uniqueMonths = new Set(
    displayReports.map((r) => {
      const d = new Date(r.timestamp);
      return `${d.getFullYear()}-${d.getMonth()}`;
    })
  ).size;

  const formatLabel = (timestamp: string): string => {
    const date = new Date(timestamp);
    // TODO: this needs to be tested

    // If data spans less than 2 days OR we have less than 3 unique days, show time
    if (timeSpanDays < 2 || uniqueDays <= 2) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // Last 7 days
    if (timeSpanDays < 7) {
      return date.toLocaleDateString([], {
        day: 'numeric',
        weekday: 'short',
      });
    }

    // If data spans less than 60 days AND we have less than 45 unique days, show day + date
    if (timeSpanDays < 60 && uniqueDays < 45) {
      return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        weekday: uniqueDays <= 14 ? 'short' : undefined, // Show weekday only if <= 2 weeks
      });
    }

    // If data spans 60+ days but less than a year, show date without weekday
    if (timeSpanDays < 365) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    // If data spans multiple months across years, include year
    if (uniqueMonths > 12 || maxTime - minTime > 365 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
    }

    // For monthly views within same year
    if (selectedPeriod === 'months' || uniqueMonths >= 3) {
      return date.toLocaleDateString([], { month: 'short' });
    }

    // Fallback: show full date and time
    return (
      date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  const labels = displayReports.map((report) => formatLabel(report.timestamp));

  // Calculate total usage (download + upload) for each report
  const totalData = displayReports.map(
    (report) => bytesToMB(report.totalRx) + bytesToMB(report.totalTx)
  );

  const formatMB = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const data = {
    labels,
    datasets: [
      {
        label: 'Total Usage (MB)',
        data: totalData,
        borderColor: '#5355C4',
        backgroundColor: 'rgba(83, 85, 196, 0.1)',
        fill: true,
        pointRadius: 6,
        pointHoverRadius: 8,
        tension: 0.4,
      },
    ],
  };

  const handleChartClick = (_event: unknown, elements: { index: number }[]) => {
    if (elements && elements.length > 0) {
      const element = elements[0];
      const index = element.index;
      if (index >= 0 && index < displayReports.length) {
        const clickedReport = displayReports[index];
        if (clickedReport) {
          setSelectedReport(clickedReport);
        }
      }
    }
  };

  // Scroll to AppUsageBars when a report is selected
  useEffect(() => {
    if (
      selectedReport &&
      selectedReport.id !== 'all-reports' &&
      appUsageBarsRef.current
    ) {
      const timer = setTimeout(() => {
        appUsageBarsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [selectedReport]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleChartClick,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Total Network Usage Over Time',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: function (tooltipItems: TooltipItem<'line'>[]) {
            // Show timestamp as title
            const index = tooltipItems[0].dataIndex;
            const report = displayReports[index];
            if (report) {
              const date = new Date(report.timestamp);
              return date.toLocaleString();
            }
            return '';
          },
          label: function (context: TooltipItem<'line'>) {
            const index = context.dataIndex;
            const report = displayReports[index];

            if (!report) return '';

            const downloadMB = bytesToMB(report.totalRx);
            const uploadMB = bytesToMB(report.totalTx);
            const totalMB = downloadMB + uploadMB;

            return [
              `Total: ${formatMB(totalMB)}`,
              `Download: ${formatMB(downloadMB)}`,
              `Upload: ${formatMB(uploadMB)}`,
            ];
          },
          afterBody: function (tooltipItems: TooltipItem<'line'>[]) {
            const index = tooltipItems[0].dataIndex;
            const report = displayReports[index];

            if (!report || report.apps.length === 0) return [];

            const allApps = [...report.apps]
              .map((app) => ({
                name: app.displayName ?? app.identifier,
                rx: bytesToMB(app.totalRx),
                tx: bytesToMB(app.totalTx),
                total: bytesToMB(app.totalRx) + bytesToMB(app.totalTx),
              }))
              .sort((a, b) => b.total - a.total);

            if (allApps.length === 0) return [];

            const lines: string[] = [''];

            const firstApp = allApps[0];

            if (allApps.length > 1) {
              const remainingCount = allApps.length - 1;
              lines.push(`${firstApp.name} + ${remainingCount} more`);
            } else {
              lines.push(`${firstApp.name}`);
            }

            lines.push('click to know more');

            return lines;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value: string | number) {
            const numValue =
              typeof value === 'string' ? parseFloat(value) : value;
            if (numValue >= 1024) {
              return (numValue / 1024).toFixed(1) + ' GB';
            }
            return numValue.toFixed(0) + ' MB';
          },
        },
      },
    },
  };

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <p className="text-center text-gray-600">No data available for chart</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div style={{ height: '400px' }}>
          <Line data={data} options={options} />
        </div>
      </div>

      {selectedReport && (
        <div ref={appUsageBarsRef} className="scroll-mt-32">
          <AppUsageBars />
        </div>
      )}
    </div>
  );
}
