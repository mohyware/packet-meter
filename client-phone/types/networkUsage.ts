export interface AppUsageDataAPI {
    packageName: string;
    appName: string;
    icon: string | null;
    uid: number;
    wifi: {
        rx: number;
        tx: number;
        total: number;
    };
    mobile: {
        rx: number;
        tx: number;
        total: number;
    };
    totalBytes: number;
}

export interface TotalUsageDataAPI {
    wifi: {
        rx: number;
        tx: number;
        total: number;
    };
    mobile: {
        rx: number;
        tx: number;
        total: number;
    };
    totalBytes: number;
}