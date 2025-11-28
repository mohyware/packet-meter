import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DeviceStatus, ReportMode } from '@/types/reports';

type ReporterState = {
    serverHost: string;
    serverPort: number;
    useTls: boolean;
    reportMode: ReportMode;
    serverTarget: 'cloud' | 'custom';
    deviceToken: string | null;
    deviceStatus: DeviceStatus;
    isSavingConfig: boolean;
};

type ReporterActions = {
    setServerHost: (host: string) => void;
    setServerPort: (port: number) => void;
    setUseTls: (useTls: boolean) => void;
    setReportMode: (mode: ReportMode) => void;
    setServerTarget: (mode: 'cloud' | 'custom') => void;
    setDeviceToken: (token: string | null) => void;
    setDeviceStatus: (status: DeviceStatus) => void;
    setIsSavingConfig: (saving: boolean) => void;
};

export const DEFAULT_HOST = process.env.EXPO_PUBLIC_SERVER_HOST || 'localhost';
export const DEFAULT_PORT = Number(process.env.EXPO_PUBLIC_SERVER_PORT || 8080);
const DEFAULT_TLS = process.env.EXPO_PUBLIC_SERVER_TLS === 'true';

export const useReporterStore = create<ReporterState & ReporterActions>()(
    persist(
        (set) => ({
            serverHost: DEFAULT_HOST,
            serverPort: DEFAULT_PORT,
            useTls: DEFAULT_TLS,
            reportMode: 'total',
            serverTarget: 'cloud',
            deviceToken: null,
            deviceStatus: 'not_connected',
            isSavingConfig: false,

            setServerHost: (serverHost) => set({ serverHost }),
            setServerPort: (serverPort) => set({ serverPort }),
            setUseTls: (useTls) => set({ useTls }),
            setReportMode: (reportMode) => set({ reportMode }),
            setServerTarget: (serverTarget) => set({ serverTarget }),
            setDeviceToken: (deviceToken) => set({ deviceToken }),
            setDeviceStatus: (deviceStatus) => set({ deviceStatus }),
            setIsSavingConfig: (isSavingConfig) => set({ isSavingConfig }),
        }),
        {
            name: 'packetmeter.reporter-store',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                serverHost: state.serverHost,
                serverPort: state.serverPort,
                useTls: state.useTls,
                reportMode: state.reportMode,
                serverTarget: state.serverTarget,
                deviceToken: state.deviceToken,
                deviceStatus: state.deviceStatus,
            }),
        }
    )
);

export async function setDeviceAuth(token: string) {
    useReporterStore.setState({ deviceToken: token, deviceStatus: 'pending' });
}

export async function clearDeviceAuth() {
    useReporterStore.setState({ deviceToken: null, deviceStatus: 'not_connected' });
}