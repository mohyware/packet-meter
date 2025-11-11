import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDeviceUsage, useDevices } from '../hooks/useDevices';
import { TimePeriodSelector, TimePeriod } from '../components/TimePeriodSelector';
import { DownloadUploadChart } from '../components/UsageChart';

export default function DeviceDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | null>(null);
  const [selectedCount, setSelectedCount] = useState(1);
  const { reports, isLoading: isLoadingUsage } = useDeviceUsage(
    deviceId ?? '',
    1000,
    selectedPeriod ?? undefined,
    selectedPeriod ? selectedCount : undefined
  );
  const {
    devices,
    isLoading: isLoadingDevices,
    updateDeviceAsync,
    isUpdating,
    deleteDeviceAsync,
    isDeleting,
  } = useDevices();
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const device = devices.find((d) => d.id === deviceId);

  if (isLoadingDevices || isLoadingUsage) {
    return (
      <div className="text-center py-12 text-gray-600">
        <div>Loading device...</div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center py-12 text-gray-600">
        <div>Device not found</div>
      </div>
    );
  }

  const handleEditName = async () => {
    if (!editName.trim() || !deviceId) return;
    try {
      await updateDeviceAsync({ deviceId, name: editName.trim() });
      setEditingName(false);
      setEditName('');
    } catch (error) {
      console.error('Failed to update device name:', error);
    }
  };

  const handleDelete = async () => {
    if (!deviceId) return;
    try {
      await deleteDeviceAsync(deviceId);
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to delete device:', error);
    }
  };

  const startEdit = () => {
    setEditName(device.name);
    setEditingName(true);
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-start mb-8">
        <div className="flex-1">
          {editingName ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-3xl font-semibold text-gray-800 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <button
                onClick={handleEditName}
                disabled={isUpdating || !editName.trim()}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-60"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setEditName('');
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          ) : (
            <h2 className="text-3xl font-semibold text-gray-800 mb-2">
              {device.name}
            </h2>
          )}
          <div className="flex items-center gap-4 mt-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${device.status === 'active'
                ? 'bg-green-100 text-green-800'
                : device.status === 'pendingApproval'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
                }`}
            >
              {device.status === 'active'
                ? 'Active'
                : device.status === 'pendingApproval'
                  ? 'Pending Approval'
                  : 'Pending'}
            </span>
            <span className="text-sm text-gray-600">
              Created: {new Date(device.createdAt).toLocaleDateString()}
            </span>
            {device.lastHealthCheck && (
              <span className="text-sm text-gray-600">
                Last seen: {new Date(device.lastHealthCheck).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        {!editingName && (
          <div className="flex gap-2">
            <button
              onClick={startEdit}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Edit Name
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
            >
              Delete Device
            </button>
          </div>
        )}
      </div>

      <TimePeriodSelector
        selectedPeriod={selectedPeriod}
        selectedCount={selectedCount}
        onPeriodChange={setSelectedPeriod}
        onCountChange={setSelectedCount}
      />

      {reports.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <p>
            No usage reports yet. Reports will appear here once the device
            starts sending data.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <DownloadUploadChart
            reports={reports}
            period={selectedPeriod ?? undefined}
          />
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Delete Device
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{device.name}</strong>?
              This action cannot be undone and will delete all associated usage
              reports.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition-colors"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
