import { useAuth } from '../hooks/useAuth'

interface LayoutProps {
    children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
    const { logout, user } = useAuth()

    return (
        <div className="min-h-screen flex flex-col">
            <header className="bg-white border-b border-gray-200 py-4 shadow-sm">
                <div className="max-w-7xl mx-auto px-8 flex justify-between items-center">
                    <h1 className="text-2xl font-semibold text-gray-800">PacketPilot</h1>
                    <div className="flex items-center gap-4">
                        {user?.user?.username && (
                            <span className="text-sm text-gray-600">User: {user.user.username.slice(0, 8)}...</span>
                        )}
                        <button
                            onClick={() => logout()}
                            className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>
            <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-8">{children}</main>
        </div>
    )
}

