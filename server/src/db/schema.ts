import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  numeric,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Usage reports table - stores interface-level usage data grouped by UTC hour
// One report per device per interface per UTC hour (unique constraint on deviceId + interfaceName + timestamp hour)
// Timestamps are stored in UTC and rounded to the hour
// Queries use user's local timezone to filter and aggregate data
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .references(() => devices.id, { onDelete: 'cascade' })
      .notNull(),
    interfaceName: varchar('interface_name', { length: 100 }).notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    totalRx: numeric('total_rx', { precision: 20, scale: 0 }).notNull(),
    totalTx: numeric('total_tx', { precision: 20, scale: 0 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueDeviceInterfaceHour: unique().on(
      table.deviceId,
      table.interfaceName,
      table.timestamp
    ),
  })
);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Devices table
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  deviceTokenHash: varchar('device_token_hash', { length: 255 }).notNull(),
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
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  device: one(devices, {
    fields: [reports.deviceId],
    references: [devices.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
