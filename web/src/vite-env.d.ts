/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GOOGLE_CLIENT_ID: string
    readonly VITE_API_BASE_URL: string
    readonly VITE_WINDOWS_DOWNLOAD_URL: string
    readonly VITE_LINUX_DOWNLOAD_URL: string
    readonly VITE_ANDROID_DOWNLOAD_URL: string
    readonly VITE_PROJECT_GITHUB_URL: string
    readonly VITE_LINKEDIN_URL: string
    readonly VITE_GITHUB_URL: string
    readonly VITE_PORTFOLIO_URL: string
    readonly VITE_JOIN_METHOD: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

