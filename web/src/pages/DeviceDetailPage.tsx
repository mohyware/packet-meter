import { useParams } from 'react-router-dom'
import { useDeviceUsage } from '../hooks/useDevices'

export default function DeviceDetailPage() {
    const { deviceId } = useParams<{ deviceId: string }>()
    const { reports, isLoading } = useDeviceUsage(deviceId || '', 100)

    if (isLoading) {
        return (
            <div className="text-center py-12 text-gray-600">
                <div>Loading device usage...</div>
            </div>
        )
    }

    const formatMB = (mb: string) => {
        const num = parseFloat(mb)
        if (num >= 1024) {
            return `${(num / 1024).toFixed(2)} GB`
        }
        return `${num.toFixed(2)} MB`
    }

    return (
        <div className="w-full">
            <h2 className="text-3xl font-semibold text-gray-800 mb-8">Device Usage Reports</h2>
            {reports.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                    <p>No usage reports yet. Reports will appear here once the device starts sending data.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {reports.map((report) => (
                        <div key={report.id} className="bg-white rounded-lg p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                                <h3 className="text-xl font-semibold text-gray-800 m-0">{report.date}</h3>
                                <span className="text-sm text-gray-600">
                                    {new Date(report.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs text-gray-600 uppercase tracking-wide">Total Received</span>
                                    <span className="text-2xl font-semibold text-gray-800">{formatMB(report.totalRxMB)}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs text-gray-600 uppercase tracking-wide">Total Sent</span>
                                    <span className="text-2xl font-semibold text-gray-800">{formatMB(report.totalTxMB)}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs text-gray-600 uppercase tracking-wide">Total Combined</span>
                                    <span className="text-2xl font-semibold text-blue-600">
                                        {formatMB(
                                            (
                                                parseFloat(report.totalRxMB) + parseFloat(report.totalTxMB)
                                            ).toString()
                                        )}
                                    </span>
                                </div>
                            </div>
                            {report.interfaces.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <h4 className="text-base font-semibold text-gray-800 mb-4">Interfaces:</h4>
                                    <div className="flex flex-col gap-3">
                                        {report.interfaces.map((iface) => (
                                            <div
                                                key={iface.id}
                                                className="flex justify-between items-center px-3 py-3 bg-gray-50 rounded-lg text-sm"
                                            >
                                                <span className="font-semibold text-gray-800">{iface.name}</span>
                                                <span className="text-gray-600">
                                                    RX: {formatMB(iface.totalRxMB)} | TX: {formatMB(iface.totalTxMB)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
