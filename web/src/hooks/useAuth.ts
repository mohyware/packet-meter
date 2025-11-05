import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '../api/auth'

export const useAuth = () => {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const location = useLocation()

    // Check if user is authenticated
    // Only run this query on protected routes (not on landing page)
    const isPublicPage = location.pathname === '/'
    const { data: userInfo, isLoading } = useQuery({
        queryKey: ['auth', 'me'],
        queryFn: authApi.getCurrentUser,
        retry: false,
        enabled: !isPublicPage, // Don't check auth on landing page
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    })

    // Login with Google mutation
    const loginMutation = useMutation({
        mutationFn: authApi.loginWithGoogle,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['auth'] })
            navigate('/dashboard')
        },
        onError: (error: any) => {
            console.error('Login error:', error)
            // The error will be available in the mutation state
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

