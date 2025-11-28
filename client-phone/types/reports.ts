export interface InterfaceUsageReport {
    Interface: string;
    TotalRx: number;
    TotalTx: number;
}

export interface DailyUsageReportPayload {
    Timestamp: string;
    Date: string;
    Interfaces: InterfaceUsageReport[];
}

// Requests
export interface TotalUsageReportRequest {
    Timestamp: string;
    Date: string;
    TotalRx: number;
    TotalTx: number;
}

export interface PerProcessUsageReportRequest {
    Timestamp: string;
    Date: string;
    Apps: {
        Identifier: string;
        TotalRx: number;
        TotalTx: number;
    }[];
}

export interface AppRegistrationRequest {
    Apps: {
        Identifier: string;
        DisplayName?: string | null;
        IconHash?: string | null;
    }[];
}

export type DeviceStatus = 'not_connected' | 'pending' | 'authed';

export type ReportMode = 'total' | 'per-process';
