/**
 * Capacitor initialization and platform utilities
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';

/**
 * Check if running on native platform
 */
export const isNative = (): boolean => {
    return Capacitor.isNativePlatform();
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
    return Capacitor.getPlatform() === 'android';
};

/**
 * Initialize Capacitor plugins
 */
export const initCapacitor = async (): Promise<void> => {
    if (!isNative()) return;

    try {
        // Configure status bar
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0f172a' });

        // Hide splash screen after app loads
        await SplashScreen.hide();

        // Set up keyboard listeners
        Keyboard.addListener('keyboardWillShow', (info) => {
            document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
        });

        Keyboard.addListener('keyboardWillHide', () => {
            document.body.style.setProperty('--keyboard-height', '0px');
        });

        // Set up back button handler for Android
        if (isAndroid()) {
            App.addListener('backButton', ({ canGoBack }) => {
                if (canGoBack) {
                    window.history.back();
                } else {
                    App.exitApp();
                }
            });
        }

        // Network status listener
        Network.addListener('networkStatusChange', (status) => {
            console.log('Network status:', status.connected ? 'online' : 'offline');
        });

        console.log('✅ Capacitor initialized');
    } catch (error) {
        console.error('❌ Capacitor initialization error:', error);
    }
};

/**
 * Get network status
 */
export const getNetworkStatus = async (): Promise<boolean> => {
    if (!isNative()) return navigator.onLine;
    const status = await Network.getStatus();
    return status.connected;
};

/**
 * Safe area insets for notched devices
 */
export const getSafeAreaInsets = (): {
    top: number;
    bottom: number;
    left: number;
    right: number;
} => {
    if (typeof window === 'undefined') {
        return { top: 0, bottom: 0, left: 0, right: 0 };
    }

    const computedStyle = getComputedStyle(document.documentElement);
    return {
        top: parseInt(computedStyle.getPropertyValue('--sat') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0'),
        left: parseInt(computedStyle.getPropertyValue('--sal') || '0'),
        right: parseInt(computedStyle.getPropertyValue('--sar') || '0'),
    };
};
