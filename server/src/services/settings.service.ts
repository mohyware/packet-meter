import { eq } from 'drizzle-orm';
import { db, settings, Setting } from '../db';

export interface SettingsInput {
  clearReportsInterval: number;
  emailReportsEnabled: boolean;
  emailInterval: number;
}

export interface UpdateSettingsInput {
  clearReportsInterval?: number;
  emailReportsEnabled?: boolean;
  emailInterval?: number;
}

const DEFAULT_SETTINGS: SettingsInput = {
  clearReportsInterval: 1,
  emailReportsEnabled: false,
  emailInterval: 1,
};

export async function ensureSettingsForUser(
  userId: string,
  overrides: Partial<SettingsInput> = {}
): Promise<Setting> {
  const existing = await db.query.settings.findFirst({
    where: eq(settings.userId, userId),
  });

  if (existing) {
    return existing;
  }

  const [record] = await db
    .insert(settings)
    .values({
      userId,
      clearReportsInterval:
        overrides.clearReportsInterval ?? DEFAULT_SETTINGS.clearReportsInterval,
      emailReportsEnabled:
        overrides.emailReportsEnabled ?? DEFAULT_SETTINGS.emailReportsEnabled,
      emailInterval: overrides.emailInterval ?? DEFAULT_SETTINGS.emailInterval,
    })
    .returning();

  return record;
}

export async function getSettingsForUser(userId: string): Promise<Setting> {
  const existing = await db.query.settings.findFirst({
    where: eq(settings.userId, userId),
  });

  if (existing) {
    return existing;
  }

  return ensureSettingsForUser(userId);
}

export async function updateSettingsForUser(
  userId: string,
  updates: UpdateSettingsInput
): Promise<Setting> {
  if (!updates || Object.keys(updates).length === 0) {
    throw new Error('No settings updates provided');
  }

  await ensureSettingsForUser(userId);

  const [record] = await db
    .update(settings)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(settings.userId, userId))
    .returning();

  if (!record) {
    throw new Error('Failed to update user settings');
  }

  return record;
}
