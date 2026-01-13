# Android Build Guide

## Prerequisites

1. **Android Studio** (latest version)
2. **JDK 17+**
3. **Android SDK** (API 33+)

## Development Build

```bash
# Build the Next.js app and sync to Android
npm run build:android

# Open in Android Studio
npm run android
```

## Build Commands

```bash
# Build Next.js static export
npm run build

# Sync web assets to Android
npx cap sync android

# Copy web assets only (no plugin updates)
npx cap copy android

# Open Android Studio
npx cap open android
```

## Production Release Build

### 1. Generate Keystore (one-time)

```bash
cd android
keytool -genkey -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Configure Signing

Create `android/keystore.properties`:
```properties
storePassword=your_store_password
keyPassword=your_key_password
keyAlias=release
storeFile=release.keystore
```

### 3. Update build.gradle

In `android/app/build.gradle`, add signing config:
```gradle
android {
    signingConfigs {
        release {
            def keystorePropertiesFile = rootProject.file("keystore.properties")
            def keystoreProperties = new Properties()
            keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
            
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 4. Build Release APK

```bash
cd android
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

### 5. Build Release AAB (for Play Store)

```bash
cd android
./gradlew bundleRelease
```

AAB location: `android/app/build/outputs/bundle/release/app-release.aab`

## App Icons

Replace icons in these directories:
- `android/app/src/main/res/mipmap-mdpi/` (48x48)
- `android/app/src/main/res/mipmap-hdpi/` (72x72)
- `android/app/src/main/res/mipmap-xhdpi/` (96x96)
- `android/app/src/main/res/mipmap-xxhdpi/` (144x144)
- `android/app/src/main/res/mipmap-xxxhdpi/` (192x192)

## Splash Screen

Add splash drawable in:
- `android/app/src/main/res/drawable/splash.xml`

## API URL Configuration

For development with local backend:
1. Edit `capacitor.config.ts`
2. Uncomment and set `server.url` to your local IP:
   ```typescript
   server: {
       url: 'http://192.168.1.100:3000',
       cleartext: true,
   }
   ```

For production:
- Set `NEXT_PUBLIC_API_URL` in your build environment
