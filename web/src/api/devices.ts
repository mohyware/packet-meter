import { apiClient } from './client'

export interface Device {
    id: string
    name: string
    isActivated: boolean
    lastHealthCheck: string | null
    createdAt: string
    status: 'pending' | 'pendingApproval' | 'active'
}

export interface CreateDeviceRequest {
    name: string
}

export interface CreateDeviceResponse {
    success: boolean
    message: string
    device: Device
    token: string
    qrCode: string
}

export interface DeviceUsageReport {
    id: string
    deviceId: string
    timestamp: string
    totalRx: string
    totalTx: string
    interfaces: {
        name: string
        totalRx: string
        totalTx: string
    }[]
}

export interface DevicesResponse {
    success: boolean
    devices: Device[]
}

export interface DeviceUsageResponse {
    success: boolean
    reports: DeviceUsageReport[]
}

export const devicesApi = {
    /**
     * Get all devices for the current user
     */
    getDevices: async (): Promise<DevicesResponse> => {
        const { data } = await apiClient.get<DevicesResponse>('/api/v1/devices')
        return data
    },

    /**
     * Create a new device
     */
    createDevice: async (
        name: string
    ): Promise<CreateDeviceResponse> => {
        const { data } = await apiClient.post<CreateDeviceResponse>(
            '/api/v1/devices',
            { name }
        )
        return data
    },

    /**
     * Get usage reports for a device
     */
    getDeviceUsage: async (
        deviceId: string,
        limit = 100
    ): Promise<DeviceUsageResponse> => {
        const { data } = await apiClient.get<DeviceUsageResponse>(
            `/api/v1/devices/${deviceId}/usage`,
            { params: { limit } }
        )
        return data
    },

    /**
     * Activate a device (after user approves)
     */
    activateDevice: async (
        deviceId: string
    ): Promise<{ success: boolean; message: string; device: Device }> => {
        const { data } = await apiClient.post<{ success: boolean; message: string; device: Device }>(
            `/api/v1/devices/${deviceId}/activate`
        )
        return data
    },

    /**
     * Update device name
     */
    updateDevice: async (
        deviceId: string,
        name: string
    ): Promise<{ success: boolean; message: string; device: Device }> => {
        const { data } = await apiClient.patch<{ success: boolean; message: string; device: Device }>(
            `/api/v1/devices/${deviceId}`,
            { name }
        )
        return data
    },

    /**
     * Delete a device
     */
    deleteDevice: async (
        deviceId: string
    ): Promise<{ success: boolean; message: string }> => {
        const { data } = await apiClient.delete<{ success: boolean; message: string }>(
            `/api/v1/devices/${deviceId}`
        )
        return data
    },
}

