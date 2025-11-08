import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import type { AxiosError } from 'axios';

export const useAuth = () => {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    // Check if user is authenticated
    const { data: userInfo, isLoading } = useQuery({
        queryKey: ['auth', 'me'],
        queryFn: authApi.getCurrentUser,
        retry: false,
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        // Don't throw errors for 401 (unauthorized) - that's expected when not logged in
        throwOnError: (error: AxiosError) => {
            const status = error.response?.status;
            // Only throw non-401 errors
            return status !== 401 && status !== 403;
        },
    })

    // Login with Google mutation
    const loginMutation = useMutation({
        mutationFn: authApi.loginWithGoogle,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['auth'] })
            navigate('/dashboard')
        },
        onError: (error: AxiosError) => {
            console.error('Login error:', error.response?.data)
        },
    })

    // Logout mutation
    const logoutMutation = useMutation({
        mutationFn: authApi.logout,
        onSuccess: () => {
            queryClient.clear()
            navigate('/')
        },
    })

    return {
        user: userInfo,
        isAuthenticated: !!userInfo?.success,
        isLoading,
        login: loginMutation.mutate,
        loginAsync: loginMutation.mutateAsync,
        loginMutation, // Expose mutation for error handling
        logout: logoutMutation.mutate,
        isLoggingIn: loginMutation.isPending,
        isLoggingOut: logoutMutation.isPending,
    }
}

