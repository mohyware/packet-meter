import { useState, useEffect, useRef } from 'react'
import { useDevices } from '../hooks/useDevices'
import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
    const { devices, isLoading, createDeviceAsync, isCreating, activateDeviceAsync, isActivating } = useDevices()
    const [newDeviceName, setNewDeviceName] = useState('')
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [showTokenModal, setShowTokenModal] = useState(false)
    const [createdToken, setCreatedToken] = useState<string | null>(null)
    const [createdQr, setCreatedQr] = useState<string | null>(null)
    const [createdDeviceName, setCreatedDeviceName] = useState<string | null>(null)
    const [pendingApprovalDevices, setPendingApprovalDevices] = useState<Set<string>>(new Set())
    const previousDevicesRef = useRef<typeof devices>([])
    const navigate = useNavigate()

    // Detect when devices change from pending to pendingApproval
    useEffect(() => {
        const previousDevices = previousDevicesRef.current
        const newPendingApproval = new Set<string>()

        devices.forEach(device => {
            if (device.status === 'pendingApproval') {
                // Check if this device was previously pending (not pendingApproval)
                const wasPending = previousDevices.find(
                    prev => prev.id === device.id && prev.status === 'pending'
                )

                if (wasPending) {
                    // Device just pinged and needs approval
                    newPendingApproval.add(device.id)
                }
            }
        })

        if (newPendingApproval.size > 0) {
            setPendingApprovalDevices(newPendingApproval)
        }

        previousDevicesRef.current = devices
    }, [devices])

    const handleCreateDevice = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newDeviceName.trim()) return

        try {
            const res = await createDeviceAsync(newDeviceName.trim())
            if (res?.token) {
                setCreatedToken(res.token)
                setCreatedQr(res.qrCode)
                setCreatedDeviceName(res.device.name)
                setShowTokenModal(true)
            }
            setNewDeviceName('')
            setShowCreateForm(false)
        } catch (error) {
            console.error('Failed to create device:', error)
        }
    }

    if (isLoading) {
        return (
            <div className="text-center py-12 text-gray-600">
                <div>Loading devices...</div>
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* Notification banner for devices pending approval */}
            {pendingApprovalDevices.size > 0 && (
                <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm font-medium text-yellow-800">
                                    {pendingApprovalDevices.size === 1
                                        ? 'A device is waiting for your approval!'
                                        : `${pendingApprovalDevices.size} devices are waiting for your approval!`}
                                </p>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Device(s) have connected and are ready to be approved.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setPendingApprovalDevices(new Set())}
                            className="text-yellow-400 hover:text-yellow-500"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-semibold text-gray-800">Your Devices</h2>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                    {showCreateForm ? 'Cancel' : '+ Add Device'}
                </button>
            </div>

            {showCreateForm && (
                <form onSubmit={handleCreateDevice} className="bg-white p-6 rounded-lg shadow-sm mb-8 flex gap-4">
                    <input
                        type="text"
                        value={newDeviceName}
                        onChange={(e) => setNewDeviceName(e.target.value)}
                        placeholder="Device name (e.g., My Home PC)"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        required
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={isCreating || !newDeviceName.trim()}
                        className="px-6 py-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isCreating ? 'Creating...' : 'Create Device'}
                    </button>
                </form>
            )}

            {devices.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                    <p>No devices yet. Create your first device to start monitoring!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {devices.map((device) => (
                        <div
                            key={device.id}
                            className="bg-white rounded-lg p-6 shadow-sm cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                            onClick={() => navigate(`/devices/${device.id}`)}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold text-gray-800 m-0">{device.name}</h3>
                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${device.status === 'active'
                                        ? 'bg-green-100 text-green-800'
                                        : device.status === 'pendingApproval'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-gray-100 text-gray-800'
                                        }`}
                                >
                                    {device.status === 'active' ? 'Active' : device.status === 'pendingApproval' ? 'Pending Approval' : 'Pending'}
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Created:</span>
                                    <span className="text-gray-800 font-medium">
                                        {new Date(device.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                {device.lastHealthCheck && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Last seen:</span>
                                        <span className="text-gray-800 font-medium">
                                            {new Date(device.lastHealthCheck).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {device.status === 'pending' && (
                                    <div className="pt-3">
                                        <p className="text-sm text-gray-600 italic">
                                            Waiting for device to enter token...
                                        </p>
                                    </div>
                                )}
                                {device.status === 'pendingApproval' && (
                                    <div className="pt-3">
                                        <button
                                            className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                            disabled={isActivating}
                                            onClick={async (e) => {
                                                e.stopPropagation()
                                                try {
                                                    await activateDeviceAsync(device.id)
                                                    // Remove from pending approval notifications after successful activation
                                                    setPendingApprovalDevices(prev => {
                                                        const newSet = new Set(prev)
                                                        newSet.delete(device.id)
                                                        return newSet
                                                    })
                                                } catch (err) {
                                                    console.error('Activate failed', err)
                                                }
                                            }}
                                        >
                                            {isActivating ? 'Activating...' : 'Approve'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <TokenModal open={showTokenModal} onClose={() => setShowTokenModal(false)} token={createdToken} qr={createdQr} name={createdDeviceName} />
        </div>
    )
}

// Simple modal to show token and QR after creation
// (click overlay or Close to dismiss)
function TokenModal({ open, onClose, token, qr, name }: { open: boolean; onClose: () => void; token: string | null; qr: string | null; name: string | null }) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Device Created</h3>
                <p className="text-sm text-gray-600 mb-4">{name}</p>
                {qr && (
                    <div className="flex justify-center mb-4">
                        <img src={qr} alt="Device QR" className="w-48 h-48" />
                    </div>
                )}
                {token && (
                    <div className="bg-gray-100 rounded p-3 text-xs break-all text-gray-800 mb-4">
                        {token}
                    </div>
                )}
                <p className="text-sm text-gray-600 mb-4">Scan the QR with your device app or copy the token for the daemon config.</p>
                <div className="flex justify-end">
                    <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    )
}
