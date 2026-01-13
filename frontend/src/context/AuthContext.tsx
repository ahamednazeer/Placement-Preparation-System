'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, User } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const checkAuth = async () => {
        try {
            const token = api.getToken();
            if (!token) {
                setUser(null);
                return;
            }
            const userData = await api.getMe();
            setUser(userData);
        } catch (error) {
            console.error('Auth check failed:', error);
            api.clearTokens();
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    // Handle protected routes
    useEffect(() => {
        if (!loading) {
            const isPublicRoute = pathname === '/' || pathname === '/register';
            if (!user && !isPublicRoute) {
                router.replace('/');
            } else if (user && isPublicRoute) {
                const roleRoutes: Record<string, string> = {
                    ADMIN: '/dashboard/admin',
                    PLACEMENT_OFFICER: '/dashboard/officer',
                    STUDENT: '/dashboard/student',
                };
                router.replace(roleRoutes[user.role] || '/dashboard/student');
            }
        }
    }, [user, loading, pathname, router]);

    const login = async (email: string, password: string) => {
        const response = await api.login(email, password);
        setUser(response.user);
    };

    const logout = () => {
        api.clearTokens();
        setUser(null);
        router.push('/');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
