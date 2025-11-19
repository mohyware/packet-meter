import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  unique,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Enums ---
export const SubscriptionPlanEnum = pgEnum('subscription_plan', [
  'pro',
  'premium',
]);

export const RenewalPeriodEnum = pgEnum('renewal_period', [
  'monthly',
  'yearly',
]);

export const ReportTypeEnum = pgEnum('report_type', ['total', 'per_process']);

export const SubscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'canceled',
]);

export const DeviceTypeEnum = pgEnum('device_type', [
  'unknown',
  'android',
  'ios',
  'windows',
  'macos',
  'linux',
]);

// --- Tables ---
// Usage reports table
// One report per device per app per UTC hour
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

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    usernameIdx: index('users_username_idx').on(table.username),
  })
);

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  deviceTokenHash: varchar('device_token_hash', { length: 255 }).notNull(),
  deviceType: DeviceTypeEnum().default('unknown').notNull(),
  isActivated: boolean('is_activated').default(false).notNull(),
  lastHealthCheck: timestamp('last_health_check'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// TODO: Will handle subs and plans later
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Plan identifiers
  name: SubscriptionPlanEnum().notNull(),
  renewalPeriod: RenewalPeriodEnum().notNull(),

  priceCents: integer('price_cents').notNull(),

  // Features & Limits
  maxDevices: integer('max_devices').default(3).notNull(),
  clearReportsInterval: integer('clear_reports_interval').default(1).notNull(),
  emailReportsEnabled: boolean('email_reports_enabled')
    .default(false)
    .notNull(),
  reportType: ReportTypeEnum().default('total').notNull(),

  // Display & Marketing
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),

  // Can users subscribe?
  isActive: boolean('is_active').default(true).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relationships
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  planId: uuid('plan_id')
    .references(() => plans.id, { onDelete: 'restrict' })
    .notNull(),

  // Subscription status
  status: SubscriptionStatusEnum().default('trialing').notNull(),

  // Lifecycle timestamps
  startDate: timestamp('start_date').notNull(),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  endDate: timestamp('end_date'),
  cancelledAt: timestamp('cancelled_at'),

  // Renewal settings
  willRenew: boolean('will_renew').default(true).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),

  // Payment provider integration
  subscriptionId: varchar('subscription_id', { length: 255 }).unique(),
  customerId: varchar('customer_id', { length: 255 }),

  // Metadata
  cancellationReason: text('cancellation_reason'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- Relations ---
export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices),
  subscriptions: many(subscriptions),
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

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
}));

// --- Type exports ---
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
