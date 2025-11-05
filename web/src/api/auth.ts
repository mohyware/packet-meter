import { apiClient } from './client'

export interface GoogleAuthResponse {
    success: boolean
    message: string
    user?: {
        id: string
        username: string
        email: string
    }
}

export interface UserInfo {
    success: boolean
    user?: {
        id: string
        username: string
        email: string
        timezone: string
    }
}

/**
 * Get user's timezone from browser
 */
function getUserTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch {
        return 'UTC'
    }
}

export const authApi = {
    /**
     * Authenticate with Google OAuth access token
     */
    loginWithGoogle: async (accessToken: string): Promise<GoogleAuthResponse> => {
        const timezone = getUserTimezone()
        const { data } = await apiClient.post<GoogleAuthResponse>(
            '/api/v1/auth/google',
            { token: accessToken, timezone }
        )
        return data
    },

    /**
     * Get current user info
     */
    getCurrentUser: async (): Promise<UserInfo> => {
        const { data } = await apiClient.get<UserInfo>('/api/v1/auth/me')
        return data
    },

    /**
     * Logout current user
     */
    logout: async (): Promise<{ success: boolean; message: string }> => {
        const { data } = await apiClient.post<{ success: boolean; message: string }>(
            '/api/v1/auth/logout'
        )
        return data
    },
}

