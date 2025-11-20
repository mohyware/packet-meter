import {
    db,
    users,
    devices,
    reports,
    apps,
    plans,
    subscriptions,
} from '../src/db/index.js';
import { eq, inArray } from 'drizzle-orm';

/**
 * Deletes all data for the test user created by the dummy data script
 * This includes the user, all their devices, apps, and all reports (cascade delete)
 */
async function deleteDummyData() {
    console.log('Starting dummy data deletion...');

    try {
        // Find the test user
        const testUser = await db
            .select()
            .from(users)
            .where(eq(users.email, process.env.TEST_USER_EMAIL!))
            .limit(1);

        if (testUser.length === 0) {
            console.log(`❌ Test user not found (${process.env.TEST_USER_EMAIL!})`);
            console.log('   No data to delete.');
            return;
        }

        const user = testUser[0];
        console.log(`Found test user: ${user.username} (${user.email})`);
        console.log(`   User ID: ${user.id}`);

        // Get all devices for this user to count them
        const userDevices = await db.query.devices.findMany({
            where: eq(devices.userId, user.id),
        });

        // Get all apps and reports for these devices to count them
        const deviceIds = userDevices.map((device) => device.id);
        let appCount = 0;
        let reportCount = 0;

        if (deviceIds.length > 0) {
            // Get all apps for all devices using inArray
            const allDeviceApps = await db
                .select()
                .from(apps)
                .where(inArray(apps.deviceId, deviceIds));
            appCount = allDeviceApps.length;

            // Get all reports for all devices using inArray
            const allDeviceReports = await db
                .select()
                .from(reports)
                .where(inArray(reports.deviceId, deviceIds));
            reportCount = allDeviceReports.length;
        }

        console.log(`\nData to be deleted:`);
        console.log(`   - User: 1`);
        console.log(`   - Devices: ${userDevices.length}`);
        console.log(`   - Apps: ${appCount}`);
        console.log(`   - Reports: ${reportCount}`);

        // Delete the user (cascade will delete devices, apps, and reports)
        await db.delete(users).where(eq(users.id, user.id));

        console.log('\n✅ Dummy data deletion completed!');
        console.log(`   - Deleted user: ${user.username} (${user.email})`);
        console.log(`   - Deleted devices: ${userDevices.length} (cascaded)`);
        console.log(`   - Deleted apps: ${appCount} (cascaded)`);
        console.log(`   - Deleted reports: ${reportCount} (cascaded)`);

        const premiumPlan = await db.query.plans.findFirst({
            where: eq(plans.name, 'premium'),
        });

        if (premiumPlan && premiumPlan.description?.includes('insert-dummy-data')) {
            const remainingSubs = await db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.planId, premiumPlan.id));

            if (remainingSubs.length === 0) {
                await db.delete(plans).where(eq(plans.id, premiumPlan.id));
                console.log('   - Deleted premium test plan created by dummy data script');
            } else {
                console.log('   - Premium plan still referenced, skipping plan deletion');
            }
        }
    } catch (error) {
        console.error('Error deleting dummy data:', error);
        throw error;
    }
}

// Run the script
deleteDummyData()
    .then(() => {
        console.log('\nScript completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\nScript failed:', error);
        process.exit(1);
    });

export { deleteDummyData };

