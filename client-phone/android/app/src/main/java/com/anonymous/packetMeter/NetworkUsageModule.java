package com.anonymous.packetMeter;

import android.Manifest;
import android.app.usage.NetworkStats;
import android.app.usage.NetworkStatsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.ConnectivityManager;
import android.os.RemoteException;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

public class NetworkUsageModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;
    private final PackageManager packageManager;

    public NetworkUsageModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.packageManager = reactContext.getPackageManager();
    }

    @NonNull
    @Override
    public String getName() {
        return "NetworkUsage";
    }

    /**
     * Get network usage per app for a given period type and count.
     */
    @ReactMethod
    public void getAppNetworkUsage(String period, int count, Promise promise) {
        if (!period.equals("hour") && !period.equals("day") && !period.equals("week") && !period.equals("month")) {
            promise.reject("ERR_INVALID_PERIOD", "Allowed values: hour, day, week, month");
            return;
        }

        if (period.equals("hour") && count != 1) {
            promise.reject("ERR_INVALID_COUNT", "Count must be 1 for hour period");
            return;
        }

        if (period.equals("day") && (count < 1 || count > 7)) {
            promise.reject("ERR_INVALID_COUNT", "Count must be between 1 and 7");
            return;
        }

        if (period.equals("week") && (count < 1 || count > 4)) {
            promise.reject("ERR_INVALID_COUNT", "Count must be between 1 and 4");
            return;
        }

        NetworkStatsManager nsm = (NetworkStatsManager) reactContext
                .getSystemService(Context.NETWORK_STATS_SERVICE);

        long[] range = getTimeRange(period, count);
        long startTime = range[0];
        long endTime = range[1];

        List<JSONObject> appUsages = new ArrayList<>();

        // Get all installed applications
        List<ApplicationInfo> apps = packageManager.getInstalledApplications(PackageManager.GET_META_DATA);

        for (ApplicationInfo appInfo : apps) {
            try {
                boolean isSystemApp = (appInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
                boolean isUpdatedSystemApp = (appInfo.flags & ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0;
                boolean hasLauncher = packageManager.getLaunchIntentForPackage(appInfo.packageName) != null;

                // Skip only if it's a system app *and* has no launcher TODO: we need other
                // optimizations ways as some services use network hence we need to add them to
                // calcs
                if ((isSystemApp || isUpdatedSystemApp) && !hasLauncher) {
                    continue;
                }
                String packageName = appInfo.packageName;

                // Query network stats for this app
                NetworkStats stats = nsm.queryDetailsForUid(
                        ConnectivityManager.TYPE_WIFI, "", startTime, endTime, appInfo.uid);

                long wifiRx = 0, wifiTx = 0;
                NetworkStats.Bucket bucket = new NetworkStats.Bucket();
                while (stats.hasNextBucket()) {
                    stats.getNextBucket(bucket);
                    wifiRx += bucket.getRxBytes();
                    wifiTx += bucket.getTxBytes();
                }
                stats.close();

                // Query mobile data for this app
                NetworkStats mobileStats = nsm.queryDetailsForUid(
                        ConnectivityManager.TYPE_MOBILE,
                        null,
                        startTime,
                        endTime,
                        appInfo.uid);

                long mobileRx = 0, mobileTx = 0;
                while (mobileStats.hasNextBucket()) {
                    mobileStats.getNextBucket(bucket);
                    mobileRx += bucket.getRxBytes();
                    mobileTx += bucket.getTxBytes();
                }
                mobileStats.close();

                long totalBytes = wifiRx + wifiTx + mobileRx + mobileTx;

                // Only include apps with network usage
                if (totalBytes > 0) {
                    JSONObject appData = new JSONObject();

                    // Get app name and icon
                    String appName = packageManager.getApplicationLabel(appInfo).toString();
                    String appIcon = getAppIconAsBase64(packageName);

                    appData.put("packageName", packageName);
                    appData.put("appName", appName);
                    appData.put("icon", appIcon);
                    appData.put("uid", appInfo.uid);

                    // Network usage data
                    JSONObject wifi = new JSONObject();
                    wifi.put("rx", wifiRx);
                    wifi.put("tx", wifiTx);
                    wifi.put("total", wifiRx + wifiTx);

                    JSONObject mobile = new JSONObject();
                    mobile.put("rx", mobileRx);
                    mobile.put("tx", mobileTx);
                    mobile.put("total", mobileRx + mobileTx);

                    appData.put("wifi", wifi);
                    appData.put("mobile", mobile);
                    appData.put("totalBytes", totalBytes);

                    appUsages.add(appData);
                }
            } catch (Exception e) {
                Log.w("NetworkUsage", "Error processing app " + appInfo.packageName + ": " + e.getMessage());
            }
        }

        // Add tethering usage as an app entry
        addTetheringUsageToAppList(appUsages, nsm, startTime, endTime);

        // Sort by total bytes descending
        appUsages.sort((a, b) -> {
            try {
                return Long.compare(b.getLong("totalBytes"), a.getLong("totalBytes"));
            } catch (JSONException e) {
                return 0;
            }
        });

        JSONArray result = new JSONArray();
        for (JSONObject appUsage : appUsages) {
            result.put(appUsage);
        }

        promise.resolve(result.toString());
    }

    /**
     * Get total network usage across all apps for a given period type and count.
     */
    @ReactMethod
    public void getTotalNetworkUsage(String period, int count, Promise promise) {
        try {
            if (!period.equals("hour") && !period.equals("day") && !period.equals("week") && !period.equals("month")) {
                promise.reject("ERR_INVALID_PERIOD", "Allowed values: hour, day, week, month");
                return;
            }

            if (period.equals("hour") && count != 1) {
                promise.reject("ERR_INVALID_COUNT", "Count must be 1 for hour period");
                return;
            }

            if (period.equals("day") && (count < 1 || count > 7)) {
                promise.reject("ERR_INVALID_COUNT", "Count must be between 1 and 7");
                return;
            }

            if (period.equals("week") && (count < 1 || count > 4)) {
                promise.reject("ERR_INVALID_COUNT", "Count must be between 1 and 4");
                return;
            }

            NetworkStatsManager nsm = (NetworkStatsManager) reactContext
                    .getSystemService(Context.NETWORK_STATS_SERVICE);

            long[] range = getTimeRange(period, count);
            long startTime = range[0];
            long endTime = range[1];

            long wifiRx = 0, wifiTx = 0;
            long mobileRx = 0, mobileTx = 0;

            // ---------- Wi-Fi ----------
            NetworkStats.Bucket wifiBucket = nsm.querySummaryForDevice(
                    ConnectivityManager.TYPE_WIFI, "", startTime, endTime);
            if (wifiBucket != null) {
                wifiRx = wifiBucket.getRxBytes();
                wifiTx = wifiBucket.getTxBytes();
            }

            // ---------- Mobile ----------
            NetworkStats.Bucket mobileBucket = nsm.querySummaryForDevice(
                    ConnectivityManager.TYPE_MOBILE,
                    null,
                    startTime, endTime);
            if (mobileBucket != null) {
                mobileRx = mobileBucket.getRxBytes();
                mobileTx = mobileBucket.getTxBytes();
            }

            long wifiTotal = wifiRx + wifiTx;
            long mobileTotal = mobileRx + mobileTx;

            JSONObject wifi = new JSONObject();
            JSONObject mobile = new JSONObject();
            JSONObject totalObj = new JSONObject();

            wifi.put("rx", wifiRx);
            wifi.put("tx", wifiTx);
            wifi.put("total", wifiTotal);

            mobile.put("rx", mobileRx);
            mobile.put("tx", mobileTx);
            mobile.put("total", mobileTotal);

            totalObj.put("wifi", wifi);
            totalObj.put("mobile", mobile);
            totalObj.put("totalBytes", wifiTotal + mobileTotal);

            promise.resolve(totalObj.toString());
        } catch (RemoteException | JSONException e) {
            promise.reject("ERR_NETWORK_USAGE", e);
        }
    }

    /**
     * Convert app icon to Base64 string
     */
    private String getAppIconAsBase64(String packageName) {
        try {
            Drawable icon = packageManager.getApplicationIcon(packageName);
            Bitmap bitmap = drawableToBitmap(icon);

            // Resize bitmap to reduce size
            int size = 64; // 64x64 pixels
            Bitmap resizedBitmap = Bitmap.createScaledBitmap(bitmap, size, size, true);

            ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
            resizedBitmap.compress(Bitmap.CompressFormat.PNG, 100, byteArrayOutputStream);
            byte[] byteArray = byteArrayOutputStream.toByteArray();

            return "data:image/png;base64," + Base64.encodeToString(byteArray, Base64.DEFAULT);
        } catch (Exception e) {
            Log.w("NetworkUsage", "Error getting icon for " + packageName + ": " + e.getMessage());
            return null;
        }
    }

    /**
     * Convert Drawable to Bitmap
     */
    private Bitmap drawableToBitmap(Drawable drawable) {
        if (drawable instanceof BitmapDrawable) {
            return ((BitmapDrawable) drawable).getBitmap();
        }

        int width = drawable.getIntrinsicWidth();
        int height = drawable.getIntrinsicHeight();

        // Ensure minimum size
        width = Math.max(width, 1);
        height = Math.max(height, 1);

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
        drawable.draw(canvas);

        return bitmap;
    }

    /**
     * Add tethering usage as an app entry to the app list.
     */
    private void addTetheringUsageToAppList(List<JSONObject> appUsages, NetworkStatsManager nsm,
            long startTime, long endTime) {
        try {
            long[] tetheringUsage = getTetheringUsage(nsm, startTime, endTime,
                    null);
            long wifiRx = tetheringUsage[0];
            long wifiTx = tetheringUsage[1];
            long mobileRx = tetheringUsage[2];
            long mobileTx = tetheringUsage[3];
            long tetherTotal = wifiRx + wifiTx + mobileRx + mobileTx;

            if (tetherTotal > 0) {
                JSONObject tetheringData = new JSONObject();
                tetheringData.put("packageName", "com.android.tethering");
                tetheringData.put("appName", "Tethering / Hotspot");
                tetheringData.put("icon", (String) null);
                tetheringData.put("uid", -1);

                JSONObject wifi = new JSONObject();
                wifi.put("rx", wifiRx);
                wifi.put("tx", wifiTx);
                wifi.put("total", wifiRx + wifiTx);

                JSONObject mobile = new JSONObject();
                mobile.put("rx", mobileRx);
                mobile.put("tx", mobileTx);
                mobile.put("total", mobileRx + mobileTx);

                tetheringData.put("wifi", wifi);
                tetheringData.put("mobile", mobile);
                tetheringData.put("totalBytes", tetherTotal);

                appUsages.add(tetheringData);
            }
        } catch (Exception e) {
            Log.w("NetworkUsage", "Error getting tethering usage: " + e.getMessage());
        }
    }

    /**
     * Get total tethering (hotspot) data usage.
     * Returns [wifiRx, wifiTx, mobileRx, mobileTx]
     */
    private long[] getTetheringUsage(NetworkStatsManager nsm, long startTime, long endTime, String subscriberId) {
        long wifiRx = 0, wifiTx = 0;
        long mobileRx = 0, mobileTx = 0;

        // Query WiFi tethering usage
        try {
            NetworkStats wifiStats = nsm.queryDetailsForUid(
                    ConnectivityManager.TYPE_WIFI, "", startTime, endTime,
                    NetworkStats.Bucket.UID_TETHERING);
            NetworkStats.Bucket bucket = new NetworkStats.Bucket();
            while (wifiStats.hasNextBucket()) {
                wifiStats.getNextBucket(bucket);
                wifiRx += bucket.getRxBytes();
                wifiTx += bucket.getTxBytes();
            }
            wifiStats.close();
        } catch (Exception e) {
            Log.w("NetworkUsage", "Error querying WiFi tethering: " + e.getMessage());
        }

        // Query mobile tethering usage (if subscriberId is available)
        try {
            NetworkStats mobileStats = nsm.queryDetailsForUid(
                    ConnectivityManager.TYPE_MOBILE,
                    null,
                    startTime, endTime,
                    NetworkStats.Bucket.UID_TETHERING);
            NetworkStats.Bucket bucket = new NetworkStats.Bucket();
            while (mobileStats.hasNextBucket()) {
                mobileStats.getNextBucket(bucket);
                mobileRx += bucket.getRxBytes();
                mobileTx += bucket.getTxBytes();
            }
            mobileStats.close();
        } catch (Exception e) {
            Log.w("NetworkUsage", "Error querying mobile tethering: " + e.getMessage());
        }

        return new long[] { wifiRx, wifiTx, mobileRx, mobileTx };
    }

    /**
     * Calculates start/end time for given period and count.
     */
    private long[] getTimeRange(String period, int count) {
        Calendar cal = Calendar.getInstance();
        long end = cal.getTimeInMillis();

        switch (period) {
            case "hour":
                // For hour period, start from the beginning of the current hour
                // e.g., if it's 8:30, start from 8:00
                cal.set(Calendar.MINUTE, 0);
                cal.set(Calendar.SECOND, 0);
                cal.set(Calendar.MILLISECOND, 0);
                break;
            case "day":
                // For day period, start from midnight (00:00) of the day
                // count=1: today's midnight, count=2: yesterday's midnight, etc.
                cal.add(Calendar.DAY_OF_MONTH, -(count - 1));
                cal.set(Calendar.HOUR_OF_DAY, 0);
                cal.set(Calendar.MINUTE, 0);
                cal.set(Calendar.SECOND, 0);
                cal.set(Calendar.MILLISECOND, 0);
                break;
            case "week":
                cal.add(Calendar.WEEK_OF_YEAR, -count);
                break;
            case "month":
                cal.add(Calendar.MONTH, -count);
                break;
        }

        long start = cal.getTimeInMillis();
        return new long[] { start, end };
    }
}
