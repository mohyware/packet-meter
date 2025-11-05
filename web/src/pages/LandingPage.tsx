export default function LandingPage() {
    return (
        <div className="w-full min-h-screen">
            <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 text-white py-24 px-4 sm:px-8 text-center">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
                        Monitor Your Network Traffic
                        <span className="block text-yellow-300"> Across All Devices</span>
                    </h1>
                    <p className="text-xl sm:text-lg opacity-95 max-w-3xl mx-auto mb-16 leading-relaxed">
                        PacketPilot helps you track and manage network usage across your PC, laptop, and mobile devices in one centralized dashboard.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-12">
                        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl border border-white/20">
                            <div className="text-5xl mb-4">📊</div>
                            <h3 className="text-2xl font-semibold mb-3">Real-time Monitoring</h3>
                            <p className="text-base opacity-90 leading-relaxed">Track data usage in real-time with detailed reports</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl border border-white/20">
                            <div className="text-5xl mb-4">📱</div>
                            <h3 className="text-2xl font-semibold mb-3">Multi-Device Support</h3>
                            <p className="text-base opacity-90 leading-relaxed">Monitor all your devices from a single dashboard</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl border border-white/20">
                            <div className="text-5xl mb-4">📈</div>
                            <h3 className="text-2xl font-semibold mb-3">Usage Analytics</h3>
                            <p className="text-base opacity-90 leading-relaxed">Get insights into your network consumption patterns</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 px-4 sm:px-8 bg-gray-50">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-4xl sm:text-3xl font-bold text-center mb-12 text-gray-800">Why PacketPilot?</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="bg-white p-10 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all">
                            <div className="text-4xl mb-4">🔒</div>
                            <h3 className="text-2xl font-semibold mb-4 text-gray-800">Secure</h3>
                            <p className="text-gray-600 leading-relaxed text-base">
                                Your data is encrypted and stored securely. We use Google OAuth for authentication, so you don't need to remember another password.
                            </p>
                        </div>
                        <div className="bg-white p-10 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all">
                            <div className="text-4xl mb-4">⚡</div>
                            <h3 className="text-2xl font-semibold mb-4 text-gray-800">Fast & Reliable</h3>
                            <p className="text-gray-600 leading-relaxed text-base">
                                Lightweight daemons run in the background with minimal resource usage. Your devices report usage data seamlessly.
                            </p>
                        </div>
                        <div className="bg-white p-10 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all">
                            <div className="text-4xl mb-4">📊</div>
                            <h3 className="text-2xl font-semibold mb-4 text-gray-800">Detailed Reports</h3>
                            <p className="text-gray-600 leading-relaxed text-base">
                                View per-interface statistics, daily summaries, and historical data. Understand exactly where your bandwidth goes.
                            </p>
                        </div>
                        <div className="bg-white p-10 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all">
                            <div className="text-4xl mb-4">🌐</div>
                            <h3 className="text-2xl font-semibold mb-4 text-gray-800">Cross-Platform</h3>
                            <p className="text-gray-600 leading-relaxed text-base">
                                Works on Windows, Linux, and mobile devices. Monitor your entire network from one place.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-24 px-4 sm:px-8 bg-gradient-to-br from-blue-500 to-green-500 text-white text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl sm:text-3xl font-bold mb-4">Ready to Get Started?</h2>
                    <p className="text-xl sm:text-lg opacity-95 leading-relaxed">
                        Sign in with your Google account to start monitoring your network traffic today.
                    </p>
                </div>
            </section>
        </div>
    )
}
