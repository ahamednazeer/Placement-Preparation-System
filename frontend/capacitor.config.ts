import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.placementprep.app',
    appName: 'Placement Prep',
    webDir: 'out',

    // Server configuration
    server: {
        // Allow HTTP connections for development
        cleartext: true,
        // Use http scheme to avoid mixed content issues with local development
        androidScheme: 'http',
    },

    // Android specific configuration
    android: {
        allowMixedContent: true,  // Allow HTTP requests during development
        captureInput: true,
        webContentsDebuggingEnabled: true, // Set to true for development
        backgroundColor: '#0f172a',

        // Build config
        buildOptions: {
            keystorePath: 'release.keystore',
            keystoreAlias: 'release',
        },
    },

    // Plugins configuration
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: '#0f172a',
            androidSplashResourceName: 'splash',
            androidScaleType: 'CENTER_CROP',
            showSpinner: false,
            splashFullScreen: true,
            splashImmersive: true,
        },
        StatusBar: {
            style: 'DARK',
            backgroundColor: '#0f172a',
        },
        Keyboard: {
            resizeOnFullScreen: true,
        },
    },
};

export default config;
