import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// SQLite doesn't have enums, so we define them as constants for validation
export const SUBSCRIPTION_PLANS = ['pro', 'premium'] as const;
export const RENEWAL_PERIODS = ['monthly', 'yearly'] as const;
export const REPORT_TYPES = ['total', 'per_process'] as const;
export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
] as const;
export const DEVICE_TYPES = [
  'unknown',
  'android',
  'ios',
  'windows',
  'macos',
  'linux',
] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
export type RenewalPeriod = (typeof RENEWAL_PERIODS)[number];
export type ReportType = (typeof REPORT_TYPES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type DeviceType = (typeof DEVICE_TYPES)[number];

// --- Tables ---
// Usage reports table
// One report per device per app per UTC hour
export const reports = sqliteTable(
  'reports',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    deviceId: text('device_id')
      .references(() => devices.id, { onDelete: 'cascade' })
      .notNull(),

    appId: text('app_id')
      .references(() => apps.id, { onDelete: 'cascade' })
      .notNull(),

    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
    totalRx: text('total_rx').notNull(), // Store as text for large numbers
    totalTx: text('total_tx').notNull(),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    uniqueDeviceAppHour: uniqueIndex('reports_device_app_hour_unique').on(
      table.deviceId,
      table.appId,
      table.timestamp
    ),
  })
);

export const apps = sqliteTable('apps', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  deviceId: text('device_id')
    .references(() => devices.id, { onDelete: 'cascade' })
    .notNull(),

  identifier: text('identifier', { length: 300 }).notNull(),
  displayName: text('display_name', { length: 255 }),
  iconHash: text('icon_hash'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const users = sqliteTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    username: text('username', { length: 100 }).notNull(),
    email: text('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash', { length: 255 }).notNull(),
    timezone: text('timezone', { length: 50 }).default('UTC').notNull(),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    usernameIdx: index('users_username_idx').on(table.username),
  })
);

export const devices = sqliteTable('devices', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name', { length: 255 }).notNull(),
  deviceTokenHash: text('device_token_hash', { length: 255 }).notNull(),
  deviceType: text('device_type').default('unknown').notNull(), // Validate with DEVICE_TYPES
  isActivated: integer('is_activated', { mode: 'boolean' })
    .default(false)
    .notNull(),
  lastHealthCheck: integer('last_health_check', { mode: 'timestamp' }),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const plans = sqliteTable('plans', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Plan identifiers - Validate with constants
  name: text('name').notNull(),
  renewalPeriod: text('renewal_period').notNull(),

  priceCents: integer('price_cents').notNull(),

  // Features & Limits
  maxDevices: integer('max_devices').default(3).notNull(),
  maxClearReportsInterval: integer('max_clear_reports_interval')
    .default(1)
    .notNull(),
  emailReportsEnabled: integer('email_reports_enabled', { mode: 'boolean' })
    .default(true)
    .notNull(),
  reportType: text('report_type').default('total').notNull(),

  // Display & Marketing
  displayName: text('display_name', { length: 100 }).notNull(),
  description: text('description'),

  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const settings = sqliteTable(
  'settings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    clearReportsInterval: integer('clear_reports_interval')
      .default(1)
      .notNull(),
    emailReportsEnabled: integer('email_reports_enabled', { mode: 'boolean' })
      .default(true)
      .notNull(),
    emailInterval: integer('email_interval').default(1).notNull(),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex('settings_user_id_idx').on(table.userId),
  })
);

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  planId: text('plan_id')
    .references(() => plans.id, { onDelete: 'restrict' })
    .notNull(),

  status: text('status').default('trialing').notNull(),

  // Lifecycle timestamps
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  currentPeriodStart: integer('current_period_start', {
    mode: 'timestamp',
  }).notNull(),
  currentPeriodEnd: integer('current_period_end', {
    mode: 'timestamp',
  }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),

  willRenew: integer('will_renew', { mode: 'boolean' }).default(true).notNull(),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' })
    .default(false)
    .notNull(),

  subscriptionId: text('subscription_id', { length: 255 }).unique(),
  customerId: text('customer_id', { length: 255 }),

  cancellationReason: text('cancellation_reason'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});

// --- Relations (same as PostgreSQL) ---
export const usersRelations = relations(users, ({ many, one }) => ({
  devices: many(devices),
  subscriptions: many(subscriptions),
  settings: one(settings, {
    fields: [users.id],
    references: [settings.userId],
  }),
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

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, {
    fields: [settings.userId],
    references: [users.id],
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

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
