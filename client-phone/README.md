# Packet Meter (Phone Client)

Mobile app built with React Native and Expo that monitors network traffic usage using Android's `NetworkStatsManager` API. The app tracks per-app and total network usage, reporting data to a central server via background tasks.

Currently, the data is stored daily, not hourly, because this API doesn’t provide real-time usage. I’m still exploring ways to get real-time usage data, similar to how apps like GlassWire do for example.

## Prerequisites

- Node.js (v18 or higher)
- Android Studio with Android SDK
- Expo CLI (`npm install -g expo-cli`)
- Android device or emulator

## Getting Started

```bash
# 1. Install JS dependencies
npm install

# 2. Navigate to android folder
cd android

# 3. Build and install
./gradlew installDebug

# Run on Android device/emulator
npx expo run:android
```
