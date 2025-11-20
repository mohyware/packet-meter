import { apiClient } from './client'
import type { UserSettings } from './auth'

export type UpdateSettingsPayload = Partial<Pick<UserSettings, 'clearReportsInterval' | 'emailReportsEnabled' | 'emailInterval'>>

interface SettingsResponse {
    success: boolean
    settings: UserSettings
    message?: string
}

export const settingsApi = {
    get: async (): Promise<SettingsResponse> => {
        const { data } = await apiClient.get<SettingsResponse>('/api/v1/settings')
        return data
    },
    update: async (payload: UpdateSettingsPayload): Promise<SettingsResponse> => {
        const { data } = await apiClient.put<SettingsResponse>('/api/v1/settings', payload)
        return data
    },
}

