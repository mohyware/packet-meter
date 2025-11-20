import { apiClient } from './client'
import { getUserTimezone } from '../utils/timezone'

export interface UserSettings {
    clearReportsInterval: number
    emailReportsEnabled: boolean
    emailInterval: number
    createdAt?: string
    updatedAt?: string
}

export interface AuthResponse {
    success: boolean
    message: string
    user?: {
        id: string
        username: string
        email: string
    }
}

export interface PlanFeatures {
    maxDevices: number
    clearReportsInterval: number
    maxClearReportsInterval?: number
    emailReportsEnabled: boolean
    reportType: 'total' | 'per_process'
    planName: string
}

export const DEFAULT_PLAN_FEATURES: PlanFeatures = {
    maxDevices: 3,
    clearReportsInterval: 1,
    maxClearReportsInterval: 1,
    emailReportsEnabled: false,
    reportType: 'total',
    planName: 'free',
}

export interface UserProfile {
    id: string
    username: string
    email: string
    timezone: string
}

export interface UserInfo {
    success: boolean
    user?: UserProfile
    features?: PlanFeatures
    settings?: UserSettings
}

export const authApi = {
    /**
     * Authenticate with Google OAuth 
     */
    loginWithGoogle: async (idToken: string): Promise<AuthResponse> => {
        const timezone = getUserTimezone()
        const { data } = await apiClient.post<AuthResponse>(
            '/api/v1/auth/google',
            { token: idToken, timezone }
        )
        return data
    },

    /**
     * Authenticate with username/password
     */
    loginWithCredentials: async (input: {
        email: string
        password: string
    }): Promise<AuthResponse> => {
        const timezone = getUserTimezone()
        const { data } = await apiClient.post<AuthResponse>(
            '/api/v1/auth/login',
            { ...input, timezone }
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

