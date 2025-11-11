import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { devicesApi } from '../api/devices'
import { AxiosError } from 'axios'

export const useDevices = () => {
    const queryClient = useQueryClient()

    const { data, isLoading, error } = useQuery({
        queryKey: ['devices'],
        queryFn: () => devicesApi.getDevices(),
        refetchInterval: 5000, // Poll every 5 seconds to detect device pings
    })

    const createDeviceMutation = useMutation({
        mutationFn: (name: string) => devicesApi.createDevice(name),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['devices'] })
        },
        onError: (error: AxiosError) => {
            console.error('Create device error:', error.response?.data)
        },
    })

    const activateDeviceMutation = useMutation({
        mutationFn: (deviceId: string) => devicesApi.activateDevice(deviceId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['devices'] })
        },
        onError: (error: AxiosError) => {
            console.error('Activate device error:', error.response?.data)
        },
    })

    const updateDeviceMutation = useMutation({
        mutationFn: ({ deviceId, name }: { deviceId: string; name: string }) =>
            devicesApi.updateDevice(deviceId, name),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['devices'] })
        },
        onError: (error: AxiosError) => {
            console.error('Update device error:', error.response?.data)
        },
    })

    const deleteDeviceMutation = useMutation({
        mutationFn: (deviceId: string) => devicesApi.deleteDevice(deviceId),
        onSuccess: async (_, deviceId) => {
            await queryClient.invalidateQueries({ queryKey: ['devices'] })
            await queryClient.invalidateQueries({ queryKey: ['devices', deviceId, 'usage'] })
        },
        onError: (error: AxiosError) => {
            console.error('Delete device error:', error.response?.data)
        },
    })

    return {
        devices: data?.devices ?? [],
        isLoading,
        error,
        createDevice: createDeviceMutation.mutate,
        createDeviceAsync: createDeviceMutation.mutateAsync,
        isCreating: createDeviceMutation.isPending,
        activateDevice: activateDeviceMutation.mutate,
        activateDeviceAsync: activateDeviceMutation.mutateAsync,
        isActivating: activateDeviceMutation.isPending,
        updateDevice: updateDeviceMutation.mutate,
        updateDeviceAsync: updateDeviceMutation.mutateAsync,
        isUpdating: updateDeviceMutation.isPending,
        deleteDevice: deleteDeviceMutation.mutate,
        deleteDeviceAsync: deleteDeviceMutation.mutateAsync,
        isDeleting: deleteDeviceMutation.isPending,
    }
}

export const useDeviceUsage = (
    deviceId: string,
    limit = 100,
    period?: 'hours' | 'days' | 'months',
    count?: number
) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['devices', deviceId, 'usage', limit, period, count],
        queryFn: () => devicesApi.getDeviceUsage(deviceId, limit, period, count),
        enabled: !!deviceId,
    })

    return {
        reports: data?.reports ?? [],
        isLoading,
        error,
    }
}

