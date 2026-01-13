'use client';

import React, { useEffect, createContext, useContext, useCallback } from 'react';
import { initCapacitor, isNative } from '@/lib/capacitor';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

interface CapacitorContextType {
    hapticImpact: (style?: ImpactStyle) => Promise<void>;
    hapticSelection: () => Promise<void>;
}

const CapacitorContext = createContext<CapacitorContextType | undefined>(undefined);

export function useCapacitor() {
    const context = useContext(CapacitorContext);
    if (!context) return {
        hapticImpact: async () => { },
        hapticSelection: async () => { }
    };
    return context;
}

interface CapacitorProviderProps {
    children: React.ReactNode;
}

export default function CapacitorProvider({ children }: CapacitorProviderProps) {
    const hapticImpact = useCallback(async (style: ImpactStyle = ImpactStyle.Light) => {
        if (isNative()) {
            try {
                await Haptics.impact({ style });
            } catch (e) {
                console.warn('Haptics not available', e);
            }
        }
    }, []);

    const hapticSelection = useCallback(async () => {
        if (isNative()) {
            try {
                await Haptics.selectionStart();
                await Haptics.selectionEnd();
            } catch (e) {
                console.warn('Haptics not available', e);
            }
        }
    }, []);

    useEffect(() => {
        // Initialize Capacitor on mount
        const init = async () => {
            initCapacitor();

            if (isNative()) {
                try {
                    // Configure Status Bar for a premium glassy look
                    await StatusBar.setStyle({ style: Style.Dark });
                    await StatusBar.setBackgroundColor({ color: '#0f172a' });
                    // Hide splash screen after initialization
                    await SplashScreen.hide({ fadeOutDuration: 500 });
                } catch (e) {
                    console.warn('Native UI plugins not available', e);
                }
            }
        };

        init();

        // Add dynamic viewport height for mobile browsers/webview
        if (typeof window !== 'undefined') {
            const setViewportHeight = () => {
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
            };
            setViewportHeight();
            window.addEventListener('resize', setViewportHeight);
            return () => window.removeEventListener('resize', setViewportHeight);
        }
    }, []);

    return (
        <CapacitorContext.Provider value={{ hapticImpact, hapticSelection }}>
            {children}
        </CapacitorContext.Provider>
    );
}
