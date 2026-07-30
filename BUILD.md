# Dodge Dash Legends — Build Guide

How to turn the game into a real downloadable app for **Windows (.exe)** and **Android (.apk)**.

---

## Prerequisites

Install these once, then you can build both targets.

| Tool | Why | Download |
|------|-----|----------|
| **Node.js 20 LTS** | Required for both Electron and Capacitor | https://nodejs.org |
| **Android Studio** | Required for Android APK only | https://developer.android.com/studio |

After installing Android Studio, also install:
- SDK Platform **Android 14 (API 34)** via *SDK Manager → SDK Platforms*
- **Android SDK Build-Tools 34** via *SDK Manager → SDK Tools*

Set the environment variable `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) to your SDK path:
- Windows default: `C:\Users\<you>\AppData\Local\Android\Sdk`

---

## Windows .exe — Electron

### Folder: `electron-app/`

```
electron-app/
  main.js          ← Electron main process
  preload.js       ← Context bridge (security layer)
  package.json     ← Dependencies + electron-builder config
  game/
    index.html     ← The game (already copied)
    icons/         ← App icons
```

### Steps

```powershell
# 1. Enter the Electron project folder
cd electron-app

# 2. Install dependencies (only needed once)
npm install

# 3. Run the game in a desktop window (development mode)
npm start

# 4. Build the Windows installer (.exe)
npm run build:win
```

The installer appears at:
```
electron-app/dist/Dodge Dash Legends Setup 1.0.0.exe
```

Double-click it to install, or distribute the `.exe` file directly.

### What you get
- **NSIS installer** with Start Menu + Desktop shortcuts
- **Fullscreen** by default (F11 toggles, Alt+F4 / Ctrl+Q quits)
- Game data saved in `%AppData%/dodge-dash-legends` via `localStorage`

---

## Android APK — Capacitor

### Folder: `capacitor-app/`

```
capacitor-app/
  capacitor.config.json    ← App ID, name, webDir
  package.json             ← Capacitor dependencies
  android-overrides/
    AndroidManifest.xml    ← Reference manifest (landscape + WebGL flags)
    network_security_config.xml  ← HTTPS-only policy
  www/
    index.html             ← The game (already copied)
    manifest.json
    icons/
```

### Steps

```powershell
# 1. Enter the Capacitor project folder
cd capacitor-app

# 2. Install Capacitor
npm install

# 3. Add the Android platform (creates the android/ folder)
npx cap add android

# 4. Copy game files into the Android project
npx cap sync android

# 5. Apply the manifest overrides (landscape + WebGL)
#    Open android/app/src/main/AndroidManifest.xml in a text editor and:
#    - Set  android:screenOrientation="landscape"  on the <activity> tag
#    - Set  android:hardwareAccelerated="true"  on both <application> and <activity>
#    - Set  android:networkSecurityConfig="@xml/network_security_config"  on <application>
#
#    Then copy the network config:
Copy-Item android-overrides\network_security_config.xml `
          android\app\src\main\res\xml\network_security_config.xml -Force

# 6. Open in Android Studio and build the APK
npx cap open android
```

Inside **Android Studio**:
1. Wait for Gradle sync to finish
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. APK is at `android/app/build/outputs/apk/debug/app-debug.apk`

For a **release APK** (to publish):
1. **Build → Generate Signed Bundle / APK**
2. Create or use your keystore
3. Choose **APK**, fill in key details, click Finish

### Install on a device without Google Play

```powershell
# Enable "Install from unknown sources" on the phone first, then:
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

Or copy the `.apk` file to the phone and tap it in the file manager.

---

## Project structure overview

```
(workspace root)
├── Dodge-Dash-Legends-main/
│   └── index.html           ← Original web game (hosted on GitHub Pages)
├── manifest.json            ← PWA web manifest
├── sw.js                    ← Service Worker (offline PWA)
├── icons/                   ← Shared icon set
├── electron-app/            ← Windows .exe build
│   ├── main.js
│   ├── preload.js
│   ├── package.json
│   └── game/                ← Copy of game (Electron-patched CSP)
└── capacitor-app/           ← Android APK build
    ├── capacitor.config.json
    ├── package.json
    ├── android-overrides/
    └── www/                 ← Copy of game
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `electron` not found | Run `npm install` inside `electron-app/` |
| White screen on launch | Check DevTools (F12 in dev mode) for CSP or path errors |
| Android Gradle sync fails | Update Android Studio + SDK, check `ANDROID_HOME` is set |
| Game shows wrong orientation | Confirm `screenOrientation="landscape"` in AndroidManifest.xml |
| WebGL not working on Android | Confirm `hardwareAccelerated="true"` in AndroidManifest.xml |
| APK installs but crashes | Run `adb logcat` and look for JavaScript errors |
