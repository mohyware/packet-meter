import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { settingsApi, type UpdateSettingsPayload } from '../api/settings'

export const useSettings = () => {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsApi.get(),
    })

    const mutation = useMutation({
        mutationFn: (payload: UpdateSettingsPayload) => settingsApi.update(payload),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['settings'] }),
                queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }),
            ])
            toast.success('Settings saved')
        },
        onError: () => {
            toast.error('Failed to update settings')
        },
    })

    return {
        settings: query.data?.settings,
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: query.refetch,
        updateSettings: mutation.mutate,
        updateSettingsAsync: mutation.mutateAsync,
        isUpdating: mutation.isPending,
    }
}

