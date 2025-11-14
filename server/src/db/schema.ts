import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Usage reports table - stores app-level usage data grouped by UTC hour
// One report per device per app per UTC hour (unique constraint on deviceId + appId + timestamp hour)
// Timestamps are stored in UTC and rounded to the hour
// Queries use user's local timezone to filter and aggregate data
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .references(() => devices.id, { onDelete: 'cascade' })
      .notNull(),

    appId: uuid('app_id')
      .references(() => apps.id, { onDelete: 'cascade' })
      .notNull(),

    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    totalRx: numeric('total_rx', { precision: 20, scale: 0 }).notNull(),
    totalTx: numeric('total_tx', { precision: 20, scale: 0 }).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueDeviceAppHour: unique().on(
      table.deviceId,
      table.appId,
      table.timestamp
    ),
  })
);

export const apps = pgTable('apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id')
    .references(() => devices.id, { onDelete: 'cascade' })
    .notNull(),

  // Unique identity of an app per device e.g. package name for Android, full exe path for Windows
  identifier: varchar('identifier', { length: 300 }).notNull(),

  displayName: varchar('display_name', { length: 255 }),
  iconHash: text('icon_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),

  // Subscription fields
  subscriptionPlan: varchar('subscription_plan', { length: 50 })
    .default('free')
    .notNull(),
  subscriptionStatus: varchar('subscription_status', { length: 50 })
    .default('inactive')
    .notNull(),
  subscriptionId: varchar('subscription_id', { length: 255 }),
  renewalPeriod: varchar('renewal_period', { length: 50 }),
  subscriptionStartDate: timestamp('subscription_start_date'),
  subscriptionEndDate: timestamp('subscription_end_date'),
  subscriptionCancelledAt: timestamp('subscription_cancelled_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  deviceTokenHash: varchar('device_token_hash', { length: 255 }).notNull(),
  deviceType: varchar('device_type', { length: 20 })
    .default('unknown')
    .notNull(),
  isActivated: boolean('is_activated').default(false).notNull(),
  lastHealthCheck: timestamp('last_health_check'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
  reports: many(reports),
  apps: many(apps),
}));

export const appsRelations = relations(apps, ({ one, many }) => ({
  device: one(devices, {
    fields: [apps.deviceId],
    references: [devices.id],
  }),
  reports: many(reports),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  device: one(devices, {
    fields: [reports.deviceId],
    references: [devices.id],
  }),
  app: one(apps, {
    fields: [reports.appId],
    references: [apps.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
