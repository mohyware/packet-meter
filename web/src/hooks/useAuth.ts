import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { authApi, DEFAULT_PLAN_FEATURES, PlanFeatures } from '../api/auth'
import type { AxiosError } from 'axios';

export const useAuth = () => {
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    // Check if user is authenticated
    const { data: userInfo, isLoading, error } = useQuery({
        queryKey: ['auth', 'me'],
        queryFn: authApi.getCurrentUser,
        retry: false,
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        // Don't throw errors for 401/403 (unauthorized) or network errors - handle gracefully
        throwOnError: false,
    })

    const planFeatures: PlanFeatures = userInfo?.features ?? DEFAULT_PLAN_FEATURES

    useEffect(() => {
        if (error && 'code' in error) {
            const axiosError = error as AxiosError
            if (axiosError.code === 'ERR_NETWORK' || axiosError.message === 'Network Error' || axiosError.code === 'ERR_CONNECTION_REFUSED') {
                toast.error('Server connection failed. Please check your connection.', {
                    id: 'server-error',
                })
            }
        }
    }, [error])

    // Login with Google mutation
    const loginMutation = useMutation({
        mutationFn: authApi.loginWithGoogle,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['auth'] })
            toast.success('Login successful!')
            navigate('/dashboard')
        },
        onError: (error: AxiosError) => {
            if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
                toast.error('Cannot connect to server. Please check your connection.')
            } else {
                const errorData = error.response?.data as { message?: string } | undefined
                const errorMessage = errorData?.message ?? 'Login failed. Please try again.'
                toast.error(errorMessage)
            }
        },
    })

    // Logout mutation
    const logoutMutation = useMutation({
        mutationFn: authApi.logout,
        onSuccess: () => {
            queryClient.clear()
            toast.success('Logged out successfully')
            navigate('/')
        },
        onError: () => {
            // Even if logout fails on server, clear local state
            queryClient.clear()
            navigate('/')
        },
    })

    // Check if error is a network/server error
    const isServerError = error && (
        (error as AxiosError).code === 'ERR_NETWORK' ||
        (error as AxiosError).message === 'Network Error' ||
        (error as AxiosError).code === 'ERR_CONNECTION_REFUSED'
    );

    return {
        user: userInfo,
        features: planFeatures,
        isAuthenticated: !!userInfo?.success,
        isLoading,
        error,
        isServerError,
        login: loginMutation.mutate,
        loginAsync: loginMutation.mutateAsync,
        loginMutation,
        logout: logoutMutation.mutate,
        isLoggingIn: loginMutation.isPending,
        isLoggingOut: logoutMutation.isPending,
    }
}

