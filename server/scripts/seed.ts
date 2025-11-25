import {
    db,
    users,
    devices,
    reports,
    apps,
    plans,
    subscriptions,
    settings,
    User,
    closeDb,
} from '../src/db/index.js';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { addMonths } from 'date-fns';

type SeedTier = 'normal' | 'premier';

const NORMAL_TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'NORMAL_TEST_USER_EMAIL';
const PREMIER_TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'premier-user@packetmeter.dev';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'test123';

interface TierConfig {
    emailEnv: string;
    username: string;
    timezone: string;
    plan?: {
        name: 'pro' | 'premium';
        maxDevices: number;
        maxClearReportsInterval: number;
        emailReportsEnabled: boolean;
        reportType: 'total' | 'per_process';
    };
    settings: {
        clearReportsInterval: number;
        emailReportsEnabled: boolean;
        emailInterval: number;
    };
}

interface CliOptions {
    tier: SeedTier;
    dummyData: boolean;
}

const TIER_CONFIG: Record<SeedTier, TierConfig> = {
    normal: {
        emailEnv: NORMAL_TEST_USER_EMAIL,
        username: 'normal-user',
        timezone: 'America/New_York',
        settings: {
            clearReportsInterval: 1,
            emailReportsEnabled: false,
            emailInterval: 1,
        },
    },
    premier: {
        emailEnv: PREMIER_TEST_USER_EMAIL,
        username: 'premier-user',
        timezone: 'America/Los_Angeles',
        plan: {
            name: 'premium',
            maxDevices: -1,
            maxClearReportsInterval: -1,
            emailReportsEnabled: true,
            reportType: 'per_process',
        },
        settings: {
            clearReportsInterval: 30,
            emailReportsEnabled: true,
            emailInterval: 1,
        },
    },
};

const DEFAULT_APP_IDENTIFIERS = [
    'com.chrome.browser',
    'com.whatsapp',
    'com.spotify.music',
    'C:\\\\Program Files\\\\Microsoft Edge\\\\msedge.exe',
    'C:\\\\Program Files\\\\Firefox\\\\firefox.exe',
];

const MONTHS_OF_DUMMY_DATA = 2;
const DEVICE_NAMES = ['Seed Device A', 'Seed Device B'] as const;
const DEVICE_TYPES: Array<'windows' | 'android'> = ['windows', 'android'];
const PLAN_DESCRIPTION_MARKER = '[seed-script]';

function parseCliOptions(): CliOptions {
    const args = process.argv.slice(2);
    const options: CliOptions = { tier: 'premier', dummyData: false };

    for (const arg of args) {
        if (arg.startsWith('--tier=')) {
            const value = arg.split('=')[1];
            if (value === 'normal' || value === 'premier') {
                options.tier = value;
            } else {
                throw new Error(`Invalid --tier value "${value}". Use "normal" or "premier".`);
            }
        } else if (arg.startsWith('--dummy')) {
            options.dummyData = true;
        }
    }

    return options;
}

async function ensurePlan(tier: SeedTier) {
    const config = TIER_CONFIG[tier].plan;
    if (!config) {
        throw new Error(`Plan configuration not found for tier ${tier}`);
    }
    let planRecord = await db.query.plans.findFirst({
        where: eq(plans.name, config.name),
    });

    if (!planRecord) {
        const [newPlan] = await db
            .insert(plans)
            .values({
                name: config.name,
                renewalPeriod: 'monthly',
                priceCents: 0,
                maxDevices: config.maxDevices,
                maxClearReportsInterval: config.maxClearReportsInterval,
                emailReportsEnabled: config.emailReportsEnabled,
                reportType: config.reportType,
                displayName: `${config.name === 'premium' ? 'Premium' : 'Pro'} Seed Plan`,
                description: `${PLAN_DESCRIPTION_MARKER} ${tier} plan`,
                isActive: true,
            })
            .returning();
        planRecord = newPlan;
        console.log(`Created ${tier} plan (${planRecord.id})`);
    } else {
        const needsUpdate =
            planRecord.maxDevices !== config.maxDevices ||
            planRecord.maxClearReportsInterval !== config.maxClearReportsInterval ||
            planRecord.emailReportsEnabled !== config.emailReportsEnabled ||
            planRecord.reportType !== config.reportType;

        if (needsUpdate) {
            await db
                .update(plans)
                .set({
                    maxDevices: config.maxDevices,
                    maxClearReportsInterval: config.maxClearReportsInterval,
                    emailReportsEnabled: config.emailReportsEnabled,
                    reportType: config.reportType,
                    updatedAt: new Date(),
                })
                .where(eq(plans.id, planRecord.id));
            console.log(`Updated existing ${tier} plan configuration.`);
        }
    }

    return planRecord;
}

async function ensureUser(email: string, username: string, timezone: string) {
    const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
    });

    if (existingUser) {
        return existingUser;
    }

    const passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, 10);
    const [newUser] = await db
        .insert(users)
        .values({
            username,
            email,
            passwordHash,
            timezone,
        })
        .returning();

    console.log(`Created new user ${email} (${newUser.id})`);
    return newUser;
}

async function ensureSubscription(userId: string, planId: string) {
    const existingSubscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
    });

    if (existingSubscription) {
        console.log(`Using existing subscription (${existingSubscription.id})`);
        return existingSubscription;
    }

    const now = new Date();
    const currentPeriodEnd = addMonths(now, 1);

    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId,
            planId,
            status: 'active',
            startDate: now,
            currentPeriodStart: now,
            currentPeriodEnd,
            willRenew: true,
            cancelAtPeriodEnd: false,
            subscriptionId: `seed-${userId}`,
            customerId: `seed-customer-${userId}`,
        })
        .returning();

    console.log(`Created subscription (${subscription.id}) for user ${userId}`);
    return subscription;
}

async function ensureSettingsForUser(tier: SeedTier, userId: string) {
    const { settings: tierSettings } = TIER_CONFIG[tier];
    const existing = await db.query.settings.findFirst({
        where: eq(settings.userId, userId),
    });

    if (existing) {
        await db
            .update(settings)
            .set({
                clearReportsInterval: tierSettings.clearReportsInterval,
                emailReportsEnabled: tierSettings.emailReportsEnabled,
                emailInterval: tierSettings.emailInterval,
                updatedAt: new Date(),
            })
            .where(eq(settings.id, existing.id));
        console.log('Updated user settings.');
    } else {
        await db.insert(settings).values({
            userId,
            clearReportsInterval: tierSettings.clearReportsInterval,
            emailReportsEnabled: tierSettings.emailReportsEnabled,
            emailInterval: tierSettings.emailInterval,
        });
        console.log('Created user settings.');
    }
}

async function seedDummyData(userId: string, timezone: string) {
    const devicesForUser = await db.query.devices.findMany({
        where: eq(devices.userId, userId),
    });

    const deviceIds: string[] = [];

    for (let i = 0; i < DEVICE_NAMES.length; i += 1) {
        const existing = devicesForUser.find((d) => d.name === DEVICE_NAMES[i]);
        if (existing) {
            deviceIds.push(existing.id);
            continue;
        }

        const deviceTokenHash = await bcrypt.hash(`seed-device-${i}`, 10);
        const [newDevice] = await db
            .insert(devices)
            .values({
                userId,
                name: DEVICE_NAMES[i],
                deviceTokenHash,
                deviceType: DEVICE_TYPES[i],
                isActivated: true,
                lastHealthCheck: new Date(),
            })
            .returning();
        deviceIds.push(newDevice.id);
        console.log(`Created device ${DEVICE_NAMES[i]} (${newDevice.id})`);
    }

    const deviceAppMap = new Map<string, Map<string, string>>();
    for (const deviceId of deviceIds) {
        const appMap = new Map<string, string>();
        deviceAppMap.set(deviceId, appMap);

        for (const identifier of DEFAULT_APP_IDENTIFIERS) {
            const existingApp = await db.query.apps.findFirst({
                where: and(eq(apps.deviceId, deviceId), eq(apps.identifier, identifier)),
            });

            if (existingApp) {
                appMap.set(identifier, existingApp.id);
                continue;
            }

            const displayName = identifier.includes('\\')
                ? identifier.split('\\').pop()?.replace('.exe', '') ?? identifier
                : identifier.split('.').slice(-2).join('.');

            const [newApp] = await db
                .insert(apps)
                .values({
                    deviceId,
                    identifier,
                    displayName,
                })
                .returning();
            appMap.set(identifier, newApp.id);
            console.log(`Created app ${displayName} for device ${deviceId}`);
        }

        console.log(`Created/found ${appMap.size} apps for device ${deviceId}`);
    }

    const now = new Date();
    const startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - MONTHS_OF_DUMMY_DATA);
    startDate.setMinutes(0, 0, 0);

    const hoursToGenerate = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60));
    const batchSize = 1000;
    const pendingReports: typeof reports.$inferInsert[] = [];

    console.log(
        `Generating ${hoursToGenerate} hours of usage for ${deviceIds.length} devices (${timezone}).`
    );

    for (let hour = 0; hour < hoursToGenerate; hour += 1) {
        const timestamp = new Date(startDate);
        timestamp.setHours(timestamp.getHours() + hour);
        timestamp.setMinutes(0, 0, 0);
        const utcTimestamp = new Date(timestamp.toISOString().slice(0, 13) + ':00:00.000Z');

        for (const deviceId of deviceIds) {
            const appMap = deviceAppMap.get(deviceId);
            if (!appMap) {
                continue;
            }

            for (const [, appId] of appMap) {
                const hourOfDay = utcTimestamp.getUTCHours();
                const dayOfWeek = utcTimestamp.getUTCDay();

                let trafficMultiplier = 1.0;
                if (hourOfDay >= 9 && hourOfDay < 17) {
                    trafficMultiplier = 2.5;
                } else if (hourOfDay >= 7 && hourOfDay < 22) {
                    trafficMultiplier = 1.5;
                } else {
                    trafficMultiplier = 0.4;
                }

                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    trafficMultiplier *= 0.6;
                }

                const randomFactor = 0.7 + Math.random() * 0.6;
                const baseRxBytes = 100 * 1024 * 1024;
                const baseTxBytes = 50 * 1024 * 1024;

                const totalRx =
                    BigInt(
                        Math.floor(
                            baseRxBytes * trafficMultiplier * randomFactor * (Math.random() + 0.5)
                        )
                    ) + BigInt(Math.floor(Math.random() * 500_000_000));
                const totalTx =
                    BigInt(
                        Math.floor(
                            baseTxBytes * trafficMultiplier * randomFactor * (Math.random() + 0.5)
                        )
                    ) + BigInt(Math.floor(Math.random() * 250_000_000));

                pendingReports.push({
                    deviceId,
                    appId,
                    timestamp: utcTimestamp,
                    totalRx: totalRx.toString(),
                    totalTx: totalTx.toString(),
                });

                if (pendingReports.length >= batchSize) {
                    const batch = pendingReports.splice(0, batchSize);
                    await db.insert(reports).values(batch).onConflictDoNothing();
                }
            }
        }
    }

    if (pendingReports.length > 0) {
        await db.insert(reports).values(pendingReports).onConflictDoNothing();
    }

    console.log(
        `Inserted dummy usage data for ${deviceIds.length} devices (${DEFAULT_APP_IDENTIFIERS.length} apps each).`
    );
}

async function seedTier(tier: SeedTier, dummyData: boolean) {
    console.log(`\nSeeding data for ${tier} user (dummy data: ${dummyData})`);
    const config = TIER_CONFIG[tier];

    let user: User;

    if (tier === 'premier') {
        const plan = await ensurePlan(tier);
        user = await ensureUser(config.emailEnv, config.username, config.timezone);
        await ensureSubscription(user.id, plan.id);
        await ensureSettingsForUser(tier, user.id);
    } else {
        user = await ensureUser(config.emailEnv, config.username, config.timezone);
        await ensureSettingsForUser(tier, user.id);
    }

    if (dummyData) {
        await seedDummyData(user.id, config.timezone);
    } else {
        console.log('Skipping dummy data generation.');
    }
}

async function main() {
    const { tier, dummyData } = parseCliOptions();
    await seedTier(tier, dummyData);
    console.log('\nSeeding complete.');

    await closeDb();
    console.log('Database connection closed.');
}

main().catch((error) => {
    console.error('Seed script failed:', error);
    process.exitCode = 1;
});

