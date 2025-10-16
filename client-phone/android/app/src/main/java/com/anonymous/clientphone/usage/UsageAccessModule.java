package com.anonymous.clientphone.usage;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.provider.Settings;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class UsageAccessModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext reactContext;

  public UsageAccessModule(ReactApplicationContext context) {
    super(context);
    this.reactContext = context;
  }

  @Override
  public String getName() {
    return "UsageAccess";
  }

  @ReactMethod
  public void openUsageAccessSettings() {
    Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    reactContext.startActivity(intent);
  }

  @ReactMethod
  public void hasUsageAccess(Promise promise) {
    try {
      AppOpsManager appOps = (AppOpsManager) reactContext.getSystemService(Context.APP_OPS_SERVICE);
      ApplicationInfo appInfo = reactContext.getPackageManager()
          .getApplicationInfo(reactContext.getPackageName(), 0);
      int mode = appOps.checkOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          appInfo.uid,
          appInfo.packageName
      );
      promise.resolve(mode == AppOpsManager.MODE_ALLOWED);
    } catch (Exception e) {
      promise.reject("ERR_USAGE_CHECK", e);
    }
  }
}
