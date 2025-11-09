import { db, users, devices, reports } from '../src/db/index.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

interface DummyDataOptions {
    userId?: string;
    deviceId?: string;
    months?: number;
    interfaces?: string[];
}

/**
 * Creates dummy data for testing purposes
 * Generates 2 months of hourly traffic reports
 */
async function insertDummyData(options: DummyDataOptions = {}) {
    const {
        userId: providedUserId,
        deviceId: providedDeviceId,
        months = 2,
        interfaces = ['eth0', 'wlan0'],
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
                    })
                    .returning();
                userId = newUser.id;
                console.log(`Created new user: ${userId}`);
            }
        }

        // Get or create device
        let deviceId = providedDeviceId;
        if (!deviceId) {
            console.log('Creating test device...');
            const existingDevice = await db
                .select()
                .from(devices)
                .where(eq(devices.userId, userId))
                .limit(1);

            if (existingDevice.length > 0) {
                deviceId = existingDevice[0].id;
                console.log(`Using existing device: ${deviceId}`);
            } else {
                // Generate a dummy device token hash
                const deviceTokenHash = await bcrypt.hash('dummy-device-token', 10);
                const [newDevice] = await db
                    .insert(devices)
                    .values({
                        userId,
                        name: 'Test Device',
                        deviceTokenHash,
                        isActivated: true,
                        lastHealthCheck: new Date(),
                    })
                    .returning();
                deviceId = newDevice.id;
                console.log(`Created new device: ${deviceId}`);
            }
        }

        // Generate timestamps for the last N months (hourly data)
        const now = new Date();
        const startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - months);
        startDate.setMinutes(0, 0, 0); // Round to the start of the hour

        const hoursToGenerate =
            Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60));
        console.log(
            `Generating ${hoursToGenerate} hours of data for ${interfaces.length} interfaces...`
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

            for (const interfaceName of interfaces) {
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
                    interfaceName,
                    timestamp: utcTimestamp,
                    totalRx: totalRx.toString(),
                    totalTx: totalTx.toString(),
                });
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
        console.log(`   - Device ID: ${deviceId}`);
        console.log(`   - Reports inserted: ${allReports.length}`);
        console.log(`   - Time range: ${startDate.toISOString()} to ${now.toISOString()}`);
        console.log(`   - Interfaces: ${interfaces.join(', ')}`);
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

