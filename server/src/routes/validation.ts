import { z } from 'zod';

// Auth validation schemas
export const registerSchema = z.object({
    username: z.string().min(3).max(100),
    email: z.string().email(),
    password: z.string().min(8),
});

export const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

export const googleAuthSchema = z.object({
    token: z.string().min(1),
});

// Device validation schemas
export const createDeviceSchema = z.object({
    name: z.string().min(1).max(255),
});

export const deviceHealthCheckSchema = z.object({
    deviceId: z.string().uuid(),
});

const interfaceUsageSchema = z.object({
    Interface: z.string(),
    TotalRx: z.number().nonnegative(),
    TotalTx: z.number().nonnegative(),
    TotalRxMB: z.number().nonnegative(),
    TotalTxMB: z.number().nonnegative(),
});

export const dailyUsageReportSchema = z.object({
    // DeviceId is no longer required - we get it from the token
    Timestamp: z.string(),
    Date: z.string(), // YYYY-MM-DD
    Interfaces: z.array(interfaceUsageSchema),
    TotalRxMB: z.number().nonnegative(),
    TotalTxMB: z.number().nonnegative(),
});

