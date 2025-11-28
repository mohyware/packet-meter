import { AppUsageDataAPI, TotalUsageDataAPI } from '@/types/networkUsage';
import { NativeModules } from "react-native";

const { NetworkUsage, UsageAccessPermission } = NativeModules;

export async function apiCheckPermission() {
    return UsageAccessPermission.hasUsageAccess();
}

export async function apiGetAppUsage(period: string, count: number): Promise<AppUsageDataAPI[]> {
    console.log('apiGetAppUsage', period, count, JSON.parse(await NetworkUsage.getAppNetworkUsage(period, count)).length);
    return JSON.parse(await NetworkUsage.getAppNetworkUsage(period, count)) as AppUsageDataAPI[];
}

export async function apiGetTotalUsage(period: string, count: number): Promise<TotalUsageDataAPI> {
    return JSON.parse(await NetworkUsage.getTotalNetworkUsage(period, count)) as TotalUsageDataAPI;
}

export async function apiOpenUsageSettings(): Promise<void> {
    return UsageAccessPermission.openUsageAccessSettings();
}
