import { z } from 'zod';

// Auth validation schemas
export const registerSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  timezone: z.string().optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  timezone: z.string().optional(),
});

export const googleAuthSchema = z.object({
  token: z.string().min(1),
  timezone: z.string().optional(),
});

// Device validation schemas
export const createDeviceSchema = z.object({
  name: z.string().min(1).max(255),
});

export const updateDeviceSchema = z.object({
  name: z.string().min(1).max(255),
});

export const deviceHealthCheckSchema = z.object({
  deviceId: z.string().uuid(),
});

const appSchema = z.object({
  Identifier: z.string(),
  DisplayName: z.string(),
  IconHash: z.string().nullable(),
});

const appUsageSchema = z.object({
  Identifier: z.string(),
  TotalRx: z.number().nonnegative(),
  TotalTx: z.number().nonnegative(),
});

export const registerAppsSchema = z.object({
  Apps: z.array(appSchema),
});

export const dailyUsageReportSchema = z.object({
  Timestamp: z.string(),
  Date: z.string(),
  Apps: z.array(appUsageSchema),
});
