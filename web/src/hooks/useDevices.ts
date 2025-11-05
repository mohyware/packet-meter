import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { devicesApi, type CreateDeviceRequest } from '../api/devices'

export const useDevices = () => {
    const queryClient = useQueryClient()

    const { data, isLoading, error } = useQuery({
        queryKey: ['devices'],
        queryFn: () => devicesApi.getDevices(),
        refetchInterval: 5000, // Poll every 5 seconds to detect device pings
    })

    const createDeviceMutation = useMutation({
        mutationFn: (name: string) => devicesApi.createDevice(name),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['devices'] })
        },
    })

    const activateDeviceMutation = useMutation({
        mutationFn: (deviceId: string) => devicesApi.activateDevice(deviceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['devices'] })
        },
    })

    return {
        devices: data?.devices || [],
        isLoading,
        error,
        createDevice: createDeviceMutation.mutate,
        createDeviceAsync: createDeviceMutation.mutateAsync,
        isCreating: createDeviceMutation.isPending,
        activateDevice: activateDeviceMutation.mutate,
        activateDeviceAsync: activateDeviceMutation.mutateAsync,
        isActivating: activateDeviceMutation.isPending,
    }
}

export const useDeviceUsage = (deviceId: string, limit: number = 100) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ['devices', deviceId, 'usage', limit],
        queryFn: () => devicesApi.getDeviceUsage(deviceId, limit),
        enabled: !!deviceId,
    })

    return {
        reports: data?.reports || [],
        isLoading,
        error,
    }
}

