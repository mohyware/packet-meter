import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../hooks/useAuth'

export default function Header() {
    const [showUserMenu, setShowUserMenu] = useState(false)
    const { loginAsync, isAuthenticated, user, logout } = useAuth()

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
                    <GoogleLogin
                        onSuccess={(credentialResponse) => {
                            if (credentialResponse.credential) {
                                loginAsync(credentialResponse.credential).catch((err) => {
                                    console.error('Login error:', err)
                                })
                            }
                        }}
                        onError={() => {
                            console.error('Google login failed')
                        }}
                        useOneTap
                        theme="outline"
                        size="large"
                        text="signin_with"
                        shape="rectangular"
                    />
                </nav>
            </div>
        </header>
    )
}

