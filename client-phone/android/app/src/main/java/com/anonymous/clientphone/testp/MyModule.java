package com.anonymous.clientphone.testp;

import android.widget.Toast;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class MyModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public MyModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "MyModule";
    }

    @ReactMethod
    public void showToast(String message) {
        Toast.makeText(reactContext, message, Toast.LENGTH_SHORT).show();
    }
}
