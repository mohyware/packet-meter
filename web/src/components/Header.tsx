import { FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

export default function Header() {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [classicEmail, setClassicEmail] = useState('');
  const [classicPassword, setClassicPassword] = useState('');
  const {
    loginAsync,
    loginWithCredentialsAsync,
    isAuthenticated,
    user,
    logout,
    features,
    isClassicLoggingIn,
  } = useAuth();
  const location = useLocation();
  const isDashboardRoute =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/devices') ||
    location.pathname.startsWith('/settings');
  const joinMethodRaw = import.meta.env.VITE_JOIN_METHOD;
  const isGoogleJoin = (joinMethodRaw ?? 'google').toLowerCase() === 'google';
  const nodeEnv = import.meta.env.VITE_NODE_ENV;

  async function handleClassicLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = classicEmail.trim();
    const password = classicPassword;

    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }
    await loginWithCredentialsAsync({ email, password });
  }

  if (isAuthenticated) {
    return (
      <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex justify-between items-center">
          <Link
            to="/"
            className="text-2xl font-bold text-gray-800 hover:text-[#5355C4] transition-colors"
          >
            PacketMeter
          </Link>
          <nav className="flex items-center gap-6">
            {!isDashboardRoute && (
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow"
              >
                Continue to Dashboard
              </Link>
            )}
            {/* User Info Tab */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-3 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                  {user?.user?.username?.charAt(0).toUpperCase() ?? 'U'}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-tight">
                  <span className="text-sm font-medium text-gray-700">
                    {user?.user?.username ?? 'User'}
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
                    {features.planName ?? 'free'} plan
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
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
                      <p className="text-sm font-semibold text-gray-900">
                        {user?.user?.username ?? 'User'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {user?.user?.email ?? ''}
                      </p>
                    </div>
                    <div className="px-4 py-2 space-y-1">
                      <Link
                        to="/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
                      >
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
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
    );
  }

  return (
    <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex justify-between items-center">
        <Link
          to="/"
          className="text-2xl sm:text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors"
        >
          PacketMeter
        </Link>
        <nav className="flex items-center gap-6">
          {nodeEnv !== 'production' &&
            (!isGoogleJoin ? (
              <form
                onSubmit={handleClassicLogin}
                className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
              >
                <input
                  type="email"
                  value={classicEmail}
                  onChange={(event) => setClassicEmail(event.target.value)}
                  placeholder="Email"
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoComplete="email"
                  disabled={isClassicLoggingIn}
                />
                <input
                  type="password"
                  value={classicPassword}
                  onChange={(event) => setClassicPassword(event.target.value)}
                  placeholder="Password"
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoComplete="current-password"
                  disabled={isClassicLoggingIn}
                />
                <button
                  type="submit"
                  disabled={isClassicLoggingIn}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  {isClassicLoggingIn ? 'Logging in...' : 'Login'}
                </button>
              </form>
            ) : (
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  if (credentialResponse.credential) {
                    loginAsync(credentialResponse.credential).catch(() => {
                      // Error is already handled in the mutation's onError
                    });
                  }
                }}
                onError={() => {
                  toast.error('Google login failed. Please try again.');
                }}
                useOneTap
                theme="outline"
                size="large"
                text="signin_with"
                shape="rectangular"
              />
            ))}
        </nav>
      </div>
    </header>
  );
}
