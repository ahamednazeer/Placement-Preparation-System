'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Buildings, ChartLineUp, Exam, Gear, UserPlus, Users, X, CircleNotch } from '@phosphor-icons/react';
import { api, AdminSummaryResponse, DriveStatsResponse, QuestionStatsResponse, User } from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';
import Portal from '@/components/Portal';
import { toast } from 'sonner';

export default function AdminDashboard() {
    const router = useRouter();
    const { hapticImpact } = useCapacitor();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<AdminSummaryResponse | null>(null);
    const [questionStats, setQuestionStats] = useState<QuestionStatsResponse | null>(null);
    const [driveStats, setDriveStats] = useState<DriveStatsResponse | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        role: 'STUDENT',
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [summaryData, questionData, driveData] = await Promise.all([
                api.getAdminSummary(),
                api.getQuestionStats(),
                api.getDriveStats(),
            ]);
            setSummary(summaryData);
            setQuestionStats(questionData);
            setDriveStats(driveData);
        } catch (error) {
            console.error('Failed to load admin dashboard:', error);
            toast.error('Failed to load admin dashboard');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const totalUsers = summary?.total_users ?? 0;
    const students = summary?.by_role?.STUDENT ?? 0;
    const officers = summary?.by_role?.PLACEMENT_OFFICER ?? 0;
    const admins = summary?.by_role?.ADMIN ?? 0;
    const successRate = summary?.interview_average_score !== null && summary?.interview_average_score !== undefined
        ? `${Math.round(summary.interview_average_score)}%`
        : '-';

    const recentUsers = useMemo<User[]>(() => summary?.recent_users || [], [summary]);

    const handleNav = (path: string) => {
        hapticImpact();
        router.push(path);
    };

    const resetForm = () => {
        setFormData({
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            password: '',
            role: 'STUDENT',
        });
    };

    const validateCreate = () => {
        if (!formData.first_name.trim()) return 'First name is required';
        if (!formData.last_name.trim()) return 'Last name is required';
        if (!formData.email.trim() || !formData.email.includes('@')) return 'Valid email is required';
        if (!formData.password || formData.password.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(formData.password)) return 'Password must include an uppercase letter';
        if (!/[a-z]/.test(formData.password)) return 'Password must include a lowercase letter';
        if (!/[0-9]/.test(formData.password)) return 'Password must include a number';
        return null;
    };

    const handleCreateUser = async () => {
        const error = validateCreate();
        if (error) {
            toast.error(error);
            return;
        }
        setCreating(true);
        try {
            await api.createUser({
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                email: formData.email.trim().toLowerCase(),
                phone: formData.phone.trim() || undefined,
                password: formData.password,
                role: formData.role,
            });
            toast.success('User created');
            setShowCreate(false);
            resetForm();
            loadData();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create user');
        } finally {
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton variant="card" className="h-24" />
                <Skeleton variant="card" className="h-48" />
                <Skeleton variant="card" className="h-48" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider">Admin Dashboard</h1>
                    <p className="text-slate-400 text-sm mt-1">System overview and user management</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { icon: Users, label: 'Total Users', value: totalUsers },
                    { icon: Exam, label: 'Questions', value: questionStats?.total ?? 0 },
                    { icon: Buildings, label: 'Drives', value: driveStats?.total ?? 0 },
                    { icon: ChartLineUp, label: 'Success Rate', value: successRate },
                ].map((stat, i) => (
                    <div key={i} className="card">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-sm bg-slate-800">
                                <stat.icon size={24} className="text-purple-400" weight="duotone" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">{stat.label}</p>
                                <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* User Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                    <h3 className="text-sm font-mono text-slate-500 uppercase tracking-wider mb-2">Students</h3>
                    <p className="text-3xl font-bold text-blue-400">{students}</p>
                    <p className="text-xs text-slate-500 mt-1">Active registrations</p>
                </div>
                <div className="card">
                    <h3 className="text-sm font-mono text-slate-500 uppercase tracking-wider mb-2">Officers</h3>
                    <p className="text-3xl font-bold text-green-400">{officers}</p>
                    <p className="text-xs text-slate-500 mt-1">Placement officers</p>
                </div>
                <div className="card">
                    <h3 className="text-sm font-mono text-slate-500 uppercase tracking-wider mb-2">Admins</h3>
                    <p className="text-3xl font-bold text-purple-400">{admins}</p>
                    <p className="text-xs text-slate-500 mt-1">System administrators</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
                <h3 className="text-lg font-chivo font-bold uppercase tracking-wider mb-4">Admin Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button onClick={() => { hapticImpact(); setShowCreate(true); }} className="btn-primary flex items-center justify-center gap-2">
                        <UserPlus size={18} /> Add User
                    </button>
                    <button onClick={() => handleNav('/dashboard/admin/users')} className="btn-secondary flex items-center justify-center gap-2">
                        <Users size={18} /> Manage Users
                    </button>
                    <button onClick={() => handleNav('/dashboard/admin/analytics')} className="btn-secondary flex items-center justify-center gap-2">
                        <ChartLineUp size={18} /> View Analytics
                    </button>
                    <button
                        onClick={() => { hapticImpact(); toast.info('Settings coming soon'); }}
                        className="btn-secondary flex items-center justify-center gap-2"
                    >
                        <Gear size={18} /> Settings
                    </button>
                </div>
            </div>

            {/* Recent Users */}
            <div className="card">
                <h3 className="text-lg font-chivo font-bold uppercase tracking-wider mb-4">Recent Registrations</h3>
                {recentUsers.length === 0 ? (
                    <div className="text-center py-8">
                        <Users size={48} className="text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">No recent registrations.</p>
                        <p className="text-slate-600 text-xs mt-1">New users will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentUsers.map((user) => (
                            <div key={user.id} className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-800 rounded-sm">
                                <div>
                                    <p className="font-medium text-slate-100">{user.first_name} {user.last_name}</p>
                                    <p className="text-xs text-slate-500">{user.email}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400">{user.role.replace('_', ' ')}</p>
                                    <p className="text-[10px] text-slate-600">{new Date(user.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showCreate && (
                <Portal>
                    <div className="fixed inset-0 z-[100] bg-black/80 overflow-y-auto overscroll-contain">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div className="card w-full max-w-lg rounded-2xl animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-bold text-lg">Create User</h2>
                                    <button
                                        onClick={() => { hapticImpact(); setShowCreate(false); resetForm(); }}
                                        className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">First Name *</label>
                                            <input
                                                type="text"
                                                value={formData.first_name}
                                                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                                className="input-modern h-10"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Last Name *</label>
                                            <input
                                                type="text"
                                                value={formData.last_name}
                                                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                                className="input-modern h-10"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 uppercase mb-1 block">Email *</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="input-modern h-10"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Phone</label>
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="input-modern h-10"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Role</label>
                                            <select
                                                value={formData.role}
                                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                                className="input-modern h-10"
                                            >
                                                <option value="STUDENT">Student</option>
                                                <option value="PLACEMENT_OFFICER">Placement Officer</option>
                                                <option value="ADMIN">Admin</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 uppercase mb-1 block">Password *</label>
                                        <input
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="input-modern h-10"
                                            placeholder="Min 8 chars, 1 upper, 1 lower, 1 digit"
                                        />
                                    </div>

                                    <button
                                        onClick={handleCreateUser}
                                        disabled={creating}
                                        className="btn-primary w-full h-12 flex items-center justify-center gap-2"
                                    >
                                        {creating ? <CircleNotch size={18} className="animate-spin" /> : <UserPlus size={18} />}
                                        Create User
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
