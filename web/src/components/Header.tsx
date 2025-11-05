import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../hooks/useAuth'

export default function Header() {
    const [showUserMenu, setShowUserMenu] = useState(false)
    // Use a lightweight auth check for header - don't trigger full auth query
    // We'll check auth status without making the API call on public pages
    const { loginAsync, isLoggingIn, isAuthenticated, user, logout } = useAuth()

    // If auth query is disabled (on public pages), isAuthenticated will be false
    // which is fine - we just show the sign-in button

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                await loginAsync(tokenResponse.access_token)
            } catch (err) {
                console.error('Login error:', err)
            }
        },
        onError: (error) => {
            console.error('Google login failed:', error)
        },
    })

    if (isAuthenticated) {
        return (
            <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex justify-between items-center">
                    <Link to="/dashboard" className="text-2xl font-bold text-gray-800 hover:text-blue-600 transition-colors">
                        PacketPilot
                    </Link>
                    <nav className="flex items-center gap-6">
                        <Link to="/dashboard" className="text-[0.9375rem] font-medium text-gray-600 hover:text-blue-600 transition-colors">
                            Dashboard
                        </Link>
                        {/* User Info Tab */}
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                                    {user?.user?.username?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span className="text-sm font-medium text-gray-700 hidden sm:block">
                                    {user?.user?.username || 'User'}
                                </span>
                                <svg
                                    className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {showUserMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowUserMenu(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-2">
                                        <div className="px-4 py-3 border-b border-gray-200">
                                            <p className="text-sm font-semibold text-gray-900">{user?.user?.username || 'User'}</p>
                                            <p className="text-xs text-gray-500 mt-1">{user?.user?.email || ''}</p>
                                        </div>
                                        <div className="px-4 py-2">
                                            <button
                                                onClick={() => {
                                                    logout()
                                                    setShowUserMenu(false)
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </nav>
                </div>
            </header>
        )
    }

    return (
        <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex justify-between items-center">
                <Link to="/" className="text-2xl sm:text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors">
                    PacketPilot
                </Link>
                <nav className="flex items-center gap-6">
                    <button
                        onClick={() => googleLogin()}
                        disabled={isLoggingIn}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 hover:shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isLoggingIn ? (
                            'Signing in...'
                        ) : (
                            <>
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                Sign In
                            </>
                        )}
                    </button>
                </nav>
            </div>
        </header>
    )
}

