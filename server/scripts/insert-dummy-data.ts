import { db, users, devices, reports, apps } from '../src/db/index.js';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

interface DummyDataOptions {
    userId?: string;
    deviceIds?: string[];
    months?: number;
    appIdentifiers?: string[];
}

/**
 * Creates dummy data for testing purposes
 * Generates 2 months of hourly traffic reports for 2 devices with multiple apps
 */
async function insertDummyData(options: DummyDataOptions = {}) {
    const {
        userId: providedUserId,
        deviceIds: providedDeviceIds,
        months = 2,
        appIdentifiers = [
            'com.chrome.browser',
            'com.whatsapp',
            'com.spotify.music',
            'C:\\Program Files\\Microsoft Edge\\msedge.exe',
            'C:\\Program Files\\Firefox\\firefox.exe',
        ],
    } = options;

    console.log('Starting dummy data insertion...');

    try {
        // Get or create user
        let userId = providedUserId;
        if (!userId) {
            console.log('Creating test user...');
            const existingUser = await db
                .select()
                .from(users)
                .where(eq(users.email, process.env.TEST_USER_EMAIL!))
                .limit(1);

            if (existingUser.length > 0) {
                userId = existingUser[0].id;
                console.log(`Using existing user: ${userId}`);
            } else {
                const passwordHash = await bcrypt.hash('test123', 10);
                const [newUser] = await db
                    .insert(users)
                    .values({
                        username: 'testuser',
                        email: process.env.TEST_USER_EMAIL!,
                        passwordHash,
                        timezone: 'America/New_York',
                        subscriptionPlan: 'premier',
                        subscriptionStatus: 'active',
                        renewalPeriod: 'monthly',
                        subscriptionStartDate: new Date(),
                    })
                    .returning();
                userId = newUser.id;
                console.log(`Created new user: ${userId}`);
            }
        }

        // Get or create devices (create 2 devices)
        let deviceIds = providedDeviceIds;
        if (!deviceIds || deviceIds.length === 0) {
            console.log('Creating test devices...');
            const existingDevices = await db
                .select()
                .from(devices)
                .where(eq(devices.userId, userId));

            if (existingDevices.length >= 2) {
                deviceIds = existingDevices.slice(0, 2).map((d) => d.id);
                console.log(`Using existing devices: ${deviceIds.join(', ')}`);
            } else {
                deviceIds = [];
                const deviceNames = ['Test Device 1', 'Test Device 2'];
                const deviceTypes = ['windows', 'android'];

                for (let i = 0; i < 2; i++) {
                    // Check if device already exists
                    const existingDevice = existingDevices.find(
                        (d) => d.name === deviceNames[i]
                    );

                    if (existingDevice) {
                        deviceIds.push(existingDevice.id);
                        console.log(`Using existing device: ${deviceNames[i]} (${existingDevice.id})`);
                    } else {
                        // Generate a dummy device token hash
                        const deviceTokenHash = await bcrypt.hash(
                            `dummy-device-token-${i}`,
                            10
                        );
                        const [newDevice] = await db
                            .insert(devices)
                            .values({
                                userId,
                                name: deviceNames[i],
                                deviceTokenHash,
                                deviceType: deviceTypes[i],
                                isActivated: true,
                                lastHealthCheck: new Date(),
                            })
                            .returning();
                        deviceIds.push(newDevice.id);
                        console.log(`Created new device: ${deviceNames[i]} (${newDevice.id})`);
                    }
                }
            }
        }

        // Create apps for each device
        console.log('Creating apps for devices...');
        const deviceAppMap = new Map<string, Map<string, string>>();

        for (const deviceId of deviceIds) {
            const appMap = new Map<string, string>();
            deviceAppMap.set(deviceId, appMap);

            for (const identifier of appIdentifiers) {
                // Check if app already exists
                const existingApp = await db.query.apps.findFirst({
                    where: and(
                        eq(apps.deviceId, deviceId),
                        eq(apps.identifier, identifier)
                    ),
                });

                if (existingApp) {
                    appMap.set(identifier, existingApp.id);
                } else {
                    // Extract display name from identifier
                    const displayName = identifier.includes('\\')
                        ? identifier.split('\\').pop()?.replace('.exe', '') || identifier
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
                }
            }
            console.log(`Created/found ${appMap.size} apps for device ${deviceId}`);
        }

        // Generate timestamps for the last N months (hourly data)
        const now = new Date();
        const startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - months);
        startDate.setMinutes(0, 0, 0); // Round to the start of the hour

        const hoursToGenerate =
            Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60));
        console.log(
            `Generating ${hoursToGenerate} hours of data for ${deviceIds.length} devices with ${appIdentifiers.length} apps each...`
        );

        // Generate reports in batches
        const batchSize = 1000;
        const allReports: typeof reports.$inferInsert[] = [];

        for (let hour = 0; hour < hoursToGenerate; hour++) {
            const timestamp = new Date(startDate);
            timestamp.setHours(timestamp.getHours() + hour);

            // Round to the hour (ensure UTC)
            timestamp.setMinutes(0, 0, 0);
            const utcTimestamp = new Date(
                timestamp.toISOString().slice(0, 13) + ':00:00.000Z'
            );

            for (const deviceId of deviceIds) {
                const appMap = deviceAppMap.get(deviceId)!;

                for (const [identifier, appId] of appMap) {
                    // Generate realistic network traffic data
                    // Vary traffic based on time of day (more during day, less at night)
                    const hourOfDay = utcTimestamp.getUTCHours();
                    const dayOfWeek = utcTimestamp.getUTCDay();

                    // Base multiplier: more traffic during business hours (9 AM - 5 PM)
                    let trafficMultiplier = 1.0;
                    if (hourOfDay >= 9 && hourOfDay < 17) {
                        trafficMultiplier = 2.5; // Peak hours
                    } else if (hourOfDay >= 7 && hourOfDay < 22) {
                        trafficMultiplier = 1.5; // Regular hours
                    } else {
                        trafficMultiplier = 0.3; // Off-peak hours
                    }

                    // Less traffic on weekends
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        trafficMultiplier *= 0.6;
                    }

                    // Add some randomness
                    const randomFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3

                    // Generate traffic in bytes (realistic values: 100MB to 10GB per hour)
                    const baseRxBytes = 100 * 1024 * 1024; // 100 MB base
                    const baseTxBytes = 50 * 1024 * 1024; // 50 MB base

                    const totalRx =
                        BigInt(
                            Math.floor(
                                baseRxBytes * trafficMultiplier * randomFactor * (Math.random() + 0.5)
                            )
                        ) + BigInt(Math.floor(Math.random() * 1000000000));
                    const totalTx =
                        BigInt(
                            Math.floor(
                                baseTxBytes * trafficMultiplier * randomFactor * (Math.random() + 0.5)
                            )
                        ) + BigInt(Math.floor(Math.random() * 500000000));

                    allReports.push({
                        deviceId,
                        appId,
                        timestamp: utcTimestamp,
                        totalRx: totalRx.toString(),
                        totalTx: totalTx.toString(),
                    });
                }
            }
        }

        console.log(`Generated ${allReports.length} reports. Inserting into database...`);

        // Insert in batches
        for (let i = 0; i < allReports.length; i += batchSize) {
            const batch = allReports.slice(i, i + batchSize);
            try {
                await db.insert(reports).values(batch).onConflictDoNothing();
                console.log(
                    `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allReports.length / batchSize)}`
                );
            } catch (error) {
                console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
                // Continue with next batch
            }
        }

        console.log('✅ Dummy data insertion completed!');
        console.log(`   - User ID: ${userId}`);
        console.log(`   - Devices: ${deviceIds.length} (${deviceIds.join(', ')})`);
        console.log(`   - Apps per device: ${appIdentifiers.length}`);
        console.log(`   - Reports inserted: ${allReports.length}`);
        console.log(`   - Time range: ${startDate.toISOString()} to ${now.toISOString()}`);
    } catch (error) {
        console.error('Error inserting dummy data:', error);
        throw error;
    }
}

// Run the script
insertDummyData()
    .then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });

export { insertDummyData };

