'use client';

import React, { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCapacitor } from '@/components/CapacitorProvider';
import {
    Briefcase,
    SignOut,
    Gauge,
    Users,
    Brain,
    Microphone,
    Code,
    Buildings,
    User as UserIcon,
    Exam,
    ChartLineUp,
} from '@phosphor-icons/react';

interface MenuItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

interface DashboardLayoutProps {
    children: ReactNode;
}

const menuItemsByRole: Record<string, MenuItem[]> = {
    ADMIN: [
        { icon: Gauge, label: 'Overview', path: '/dashboard/admin' },
        { icon: Users, label: 'Users', path: '/dashboard/admin/users' },
        { icon: Exam, label: 'Questions', path: '/dashboard/admin/questions' },
        { icon: Buildings, label: 'Drives', path: '/dashboard/admin/drives' },
        { icon: ChartLineUp, label: 'Analytics', path: '/dashboard/admin/analytics' },
    ],
    PLACEMENT_OFFICER: [
        { icon: Gauge, label: 'Dashboard', path: '/dashboard/officer' },
        { icon: Exam, label: 'Aptitude', path: '/dashboard/officer/aptitude' },
        { icon: Buildings, label: 'Drives', path: '/dashboard/officer/drives' },
    ],
    STUDENT: [
        { icon: Gauge, label: 'Home', path: '/dashboard/student' },
        { icon: Brain, label: 'Aptitude', path: '/dashboard/student/aptitude' },
        { icon: Buildings, label: 'Drives', path: '/dashboard/student/drives' },
        { icon: UserIcon, label: 'Profile', path: '/dashboard/student/profile' },
    ],
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading, logout } = useAuth();
    const { hapticImpact } = useCapacitor();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-sat p-sab">
                <div className="text-center space-y-4">
                    <Briefcase size={48} className="text-blue-500 animate-pulse mx-auto" />
                    <div className="text-slate-500 font-mono text-sm animate-pulse">Loading...</div>
                </div>
            </div>
        );
    }

    if (!user) return null; // AuthProvider handles redirect

    const role = user.role || 'STUDENT';
    const name = user.first_name || 'User';
    const menuItems = menuItemsByRole[role] || menuItemsByRole.STUDENT;

    // Take first 5 items for bottom nav (mobile)
    const bottomNavItems = menuItems.slice(0, 5);

    const handleNavClick = (path: string) => {
        hapticImpact();
        router.push(path);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col" style={{ paddingTop: 'var(--sat)' }}>
            {/* Mobile Header */}
            <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/50" style={{ paddingTop: 'var(--sat)' }}>
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Briefcase size={24} weight="duotone" className="text-blue-400" />
                        <div>
                            <h1 className="font-chivo font-bold text-sm uppercase tracking-wider">Placement Prep</h1>
                            <p className="text-xs text-slate-500">{role.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 hidden sm:block">{name}</span>
                        <button
                            onClick={() => { hapticImpact(); logout(); }}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-full transition-colors btn-ripple"
                            style={{ minWidth: 'var(--touch-target)', minHeight: 'var(--touch-target)' }}
                            title="Logout"
                        >
                            <SignOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto pb-20 relative transition-all duration-300">
                <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {children}
                </div>
            </main>

            <nav
                className="fixed bottom-0 left-0 right-0 glass-panel border-t border-slate-800/50 z-40"
                style={{ paddingBottom: 'var(--sab)' }}
            >
                <div className="flex items-center justify-around px-2 py-1">
                    {bottomNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => handleNavClick(item.path)}
                                className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-150 relative btn-ripple ${isActive
                                    ? 'text-blue-400'
                                    : 'text-slate-500 active:text-slate-300'
                                    }`}
                                style={{ minWidth: 'var(--touch-target)', minHeight: 'var(--touch-target)' }}
                            >
                                <Icon
                                    size={22}
                                    weight={isActive ? 'fill' : 'regular'}
                                    className="mb-0.5"
                                />
                                <span className={`text-[10px] font-medium ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="absolute -bottom-0.5 w-8 h-0.5 bg-blue-400 rounded-full animate-in fade-in zoom-in duration-300" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
