package com.anonymous.clientphone.network;

import android.app.usage.NetworkStats;
import android.app.usage.NetworkStatsManager;
import android.net.ConnectivityManager;
import android.os.Build;
import android.telephony.TelephonyManager;
import android.content.Context;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class NetworkUsageModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext reactContext;

  public NetworkUsageModule(ReactApplicationContext context) {
    super(context);
    this.reactContext = context;
  }

  @Override
  public String getName() {
    return "NetworkUsage";
  }

  @ReactMethod
  public void getTotalUsage(Promise promise) {
    try {
      NetworkStatsManager manager = 
          (NetworkStatsManager) reactContext.getSystemService(Context.NETWORK_STATS_SERVICE);
      TelephonyManager telephonyManager =
          (TelephonyManager) reactContext.getSystemService(Context.TELEPHONY_SERVICE);
      String subscriberId = telephonyManager.getSubscriberId();

      long now = System.currentTimeMillis();
      NetworkStats.Bucket bucket =
          manager.querySummaryForDevice(ConnectivityManager.TYPE_MOBILE, subscriberId, 0, now);

      long rxBytes = bucket.getRxBytes();
      long txBytes = bucket.getTxBytes();

      promise.resolve(rxBytes + txBytes);
    } catch (Exception e) {
      promise.reject("ERR_USAGE", e);
    }
  }
}
