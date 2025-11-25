import {
  BarChart3,
  ChartArea,
  Github,
  GitFork,
  Globe2,
  Gauge,
  Linkedin,
  Hourglass,
  MailOpen,
  Monitor,
  MonitorSmartphone,
  ServerCog,
  ShieldBan,
  Smartphone,
  Terminal,
  Zap,
  ExternalLink,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="w-full min-h-screen">
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-purple-600 text-white py-24 px-4 sm:px-8 text-center">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Monitor Your Network Traffic
            <span className="block text-black/80"> Across All Devices</span>
          </h1>
          <p className="text-xl sm:text-lg opacity-95 max-w-3xl mx-auto mb-16 leading-relaxed">
            PacketMeter helps you track and manage network usage across your PC,
            laptop, and mobile devices in one centralized dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={import.meta.env.VITE_PROJECT_GITHUB_URL}
              target="_blank"
              className="px-4 py-3 bg-black/60 text-white font-semibold rounded-full shadow-lg hover:-translate-y-0.5 transition-transform flex items-center gap-2"
            >
              <Github className="h-6 w-6" />
              View on GitHub
            </a>
            <a
              href={import.meta.env.VITE_WINDOWS_DOWNLOAD_URL}
              target="_blank"
              className="px-6 py-3 bg-white text-indigo-900 font-semibold rounded-full shadow-lg hover:-translate-y-0.5 transition-transform flex items-center gap-2"
            >
              <Monitor className="h-5 w-5" />
              Download For Windows
            </a>
            <a
              href={import.meta.env.VITE_LINUX_DOWNLOAD_URL}
              target="_blank"
              className="px-6 py-3 bg-white/80 text-indigo-700 font-semibold rounded-full shadow-lg hover:-translate-y-0.5 transition-transform flex items-center gap-2"
            >
              <Terminal className="h-5 w-5" />
              Download For Linux
            </a>
            <a
              href={import.meta.env.VITE_ANDROID_DOWNLOAD_URL}
              target="_blank"
              className="px-6 py-3 bg-green-300 text-indigo-900 font-semibold rounded-full shadow-lg hover:-translate-y-0.5 transition-transform flex items-center gap-2"
            >
              <Smartphone className="h-5 w-5" />
              Download For Android
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-12">
            <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl border border-white/20 text-center flex flex-col items-center">
              <GitFork className="h-12 w-12 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">
                Open Source & Self-Hosted
              </h3>
              <p className="text-base opacity-90 leading-relaxed">
                Cross-platform, open source, and easy to self-host for full
                control over your data
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl border border-white/20 text-center flex flex-col items-center">
              <MonitorSmartphone className="h-12 w-12 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">
                Multi-Device Support
              </h3>
              <p className="text-base opacity-90 leading-relaxed">
                Monitor all your devices from a single dashboard
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl border border-white/20 text-center flex flex-col items-center">
              <ChartArea className="h-12 w-12 mb-4" />
              <h3 className="text-2xl font-semibold mb-3">Usage Analytics</h3>
              <p className="text-base opacity-90 leading-relaxed">
                Get insights into your network consumption patterns
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 sm:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl sm:text-3xl font-bold text-center mb-12 text-gray-800">
            Why PacketMeter?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-10 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all">
              <MailOpen className="h-12 w-12 mb-4 text-indigo-600" />
              <h3 className="text-2xl font-semibold mb-4 text-gray-800">
                Email Reports
              </h3>
              <p className="text-gray-600 leading-relaxed text-base">
                Traffic usage reports delivered to your inbox daily, weekly, or
                on a custom schedule you control.
              </p>
            </div>
            <div className="bg-white p-10 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all">
              <Zap className="h-12 w-12 mb-4 text-indigo-600" />
              <h3 className="text-2xl font-semibold mb-4 text-gray-800">
                Fast & Reliable
              </h3>
              <p className="text-gray-600 leading-relaxed text-base">
                Lightweight daemons run in the background with minimal resource
                usage. Your devices report usage data seamlessly.
              </p>
            </div>
            <div className="bg-white p-10 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all">
              <BarChart3 className="h-12 w-12 mb-4 text-indigo-600" />
              <h3 className="text-2xl font-semibold mb-4 text-gray-800">
                Detailed Reports
              </h3>
              <p className="text-gray-600 leading-relaxed text-base">
                View per-app statistics, daily summaries, and historical data.
                Understand exactly where your bandwidth goes.
              </p>
            </div>
            <div className="bg-white p-10 rounded-xl shadow-md hover:-translate-y-1 hover:shadow-lg transition-all">
              <Globe2 className="h-12 w-12 mb-4 text-indigo-600" />
              <h3 className="text-2xl font-semibold mb-4 text-gray-800">
                Cross-Platform
              </h3>
              <p className="text-gray-600 leading-relaxed text-base">
                Works on Windows, Linux, and mobile devices. Monitor your entire
                network from one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-8 bg-white">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6 text-indigo-600">
            <Hourglass className="h-6 w-6" />
            <span className="uppercase tracking-wide font-semibold">
              Coming Soon
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
            Advanced Controls for Your Entire Network
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-8 text-left flex flex-col gap-4">
              <ShieldBan className="h-10 w-10 text-indigo-600" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Firewall Policies
                </h3>
                <p className="text-gray-600 text-base">
                  Admins will be able to block specific apps or websites per
                  device using fine-grained firewall rules.
                </p>
              </div>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-8 text-left flex flex-col gap-4">
              <ServerCog className="h-10 w-10 text-indigo-600" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  DNS Control
                </h3>
                <p className="text-gray-600 text-base">
                  Adjust DNS profiles for each device to enforce safe browsing
                  or custom routing per team or household.
                </p>
              </div>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-8 text-left flex flex-col gap-4">
              <Gauge className="h-10 w-10 text-indigo-600" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Quota Limits
                </h3>
                <p className="text-gray-600 text-base">
                  Set per-device or per-app data limits to control usage and
                  prevent unexpected overages.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <footer className="bg-gray-900 text-gray-300 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm">© 2025 PacketMeter. All rights reserved.</p>
          <div className="flex flex-col sm:flex-row items-center gap-4 text-sm">
            <span className="flex items-center gap-3">
              <a
                href={import.meta.env.VITE_PORTFOLIO_URL}
                target="_blank"
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                <ExternalLink className="h-4 w-4" />
                Mohy.dev
              </a>
              <a
                href={import.meta.env.VITE_LINKEDIN_URL}
                target="_blank"
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </a>
              <a
                href={import.meta.env.VITE_GITHUB_URL}
                target="_blank"
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
