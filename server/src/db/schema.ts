import { pgTable, uuid, varchar, timestamp, boolean, numeric, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const sessionStatusEnum = pgEnum('session_status', ['active', 'expired']);

// Daily usage reports table (defined before interfaces to avoid circular reference)
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
  totalRxMB: numeric('total_rx_mb', { precision: 15, scale: 2 }).notNull(),
  totalTxMB: numeric('total_tx_mb', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sessions table
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  status: sessionStatusEnum('status').default('active').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Devices table
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  deviceToken: varchar('device_token', { length: 64 }).notNull().unique(),
  deviceTokenHash: varchar('device_token_hash', { length: 255 }).notNull(),
  isActivated: boolean('is_activated').default(false).notNull(),
  lastHealthCheck: timestamp('last_health_check'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Interface usage table
export const interfaces = pgTable('interfaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  reportId: uuid('report_id').references(() => reports.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  totalRx: numeric('total_rx', { precision: 20, scale: 0 }).notNull(),
  totalTx: numeric('total_tx', { precision: 20, scale: 0 }).notNull(),
  totalRxMB: numeric('total_rx_mb', { precision: 15, scale: 2 }).notNull(),
  totalTxMB: numeric('total_tx_mb', { precision: 15, scale: 2 }).notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  devices: many(devices),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
  reports: many(reports),
  interfaces: many(interfaces),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  device: one(devices, {
    fields: [reports.deviceId],
    references: [devices.id],
  }),
  interfaces: many(interfaces),
}));

export const interfacesRelations = relations(interfaces, ({ one }) => ({
  device: one(devices, {
    fields: [interfaces.deviceId],
    references: [devices.id],
  }),
  report: one(reports, {
    fields: [interfaces.reportId],
    references: [reports.id],
  }),
}));

// Type exports for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type Interface = typeof interfaces.$inferSelect;
export type NewInterface = typeof interfaces.$inferInsert;

