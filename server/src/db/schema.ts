import { DB_CLIENT } from '../config/env';
import * as postgresSchema from './schema.postgres';
import * as sqliteSchema from './schema.lite';

const isSQLite = DB_CLIENT !== 'postgres';

const schema = (
  isSQLite ? sqliteSchema : postgresSchema
) as typeof postgresSchema;

interface EnumLike {
  enumValues: readonly string[];
}

const reportTypeEnum: EnumLike =
  isSQLite && 'REPORT_TYPES' in sqliteSchema
    ? { enumValues: sqliteSchema.REPORT_TYPES }
    : 'ReportTypeEnum' in postgresSchema
      ? postgresSchema.ReportTypeEnum
      : { enumValues: ['total', 'per_process'] };

export { schema, isSQLite };

export const reports = schema.reports;
export const apps = schema.apps;
export const users = schema.users;
export const devices = schema.devices;
export const plans = schema.plans;
export const settings = schema.settings;
export const subscriptions = schema.subscriptions;

export const usersRelations = schema.usersRelations;
export const devicesRelations = schema.devicesRelations;
export const appsRelations = schema.appsRelations;
export const reportsRelations = schema.reportsRelations;
export const subscriptionsRelations = schema.subscriptionsRelations;
export const settingsRelations = schema.settingsRelations;

export const ReportTypeEnum = reportTypeEnum;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type UserWithSubscription = User & {
  subscription:
    | (Subscription & {
        plan: Plan;
      })
    | null;
};

export type SubscriptionWithDetails = Subscription & {
  user: User;
  plan: Plan;
};
