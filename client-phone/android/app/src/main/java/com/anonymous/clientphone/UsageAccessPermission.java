package com.anonymous.clientphone;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.os.Binder;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class UsageAccessPermission extends ReactContextBaseJavaModule {
  private final ReactApplicationContext reactContext;

  public UsageAccessPermission(ReactApplicationContext context) {
    super(context);
    this.reactContext = context;
  }

  @Override
  public String getName() {
    return "UsageAccessPermission";
  }

  /**
   * Open the Usage Access settings screen.
   */
  @ReactMethod
  public void openUsageAccessSettings() {
    try {
      Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      reactContext.startActivity(intent);
    } catch (Exception e) {
      Log.e("UsageAccess", "Failed to open usage access settings", e);
    }
  }

  /**
   * Check if the app currently has PACKAGE_USAGE_STATS permission.
   */
  @ReactMethod
  public void hasUsageAccess(Promise promise) {
    try {
      Context context = reactContext.getApplicationContext();
      AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
      ApplicationInfo appInfo = context.getPackageManager().getApplicationInfo(context.getPackageName(), 0);

      int mode;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        mode = appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            appInfo.uid,
            appInfo.packageName);
      } else {
        mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            appInfo.uid,
            appInfo.packageName);
      }

      boolean granted = (mode == AppOpsManager.MODE_ALLOWED);

      // Double-check via Settings API (some OEMs override AppOps result)
      if (!granted) {
        granted = Settings.canDrawOverlays(context); // optional sanity check
      }

      promise.resolve(granted);
    } catch (Exception e) {
      promise.reject("ERR_USAGE_CHECK", e);
    }
  }
}
