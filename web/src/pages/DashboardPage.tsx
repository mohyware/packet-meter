import { useState } from 'react'
import { useDevices } from '../hooks/useDevices'
import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
    const { devices, isLoading, createDevice, isCreating } = useDevices()
    const [newDeviceName, setNewDeviceName] = useState('')
    const [showCreateForm, setShowCreateForm] = useState(false)
    const navigate = useNavigate()

    const handleCreateDevice = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newDeviceName.trim()) return

        try {
            await createDevice(newDeviceName.trim())
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
                                    className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${device.isActivated
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                        }`}
                                >
                                    {device.isActivated ? 'Active' : 'Inactive'}
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
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
