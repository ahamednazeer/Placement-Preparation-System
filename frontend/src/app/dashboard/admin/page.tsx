'use client';

import React from 'react';
import { Users, Exam, Buildings, ChartLineUp, UserPlus, Gear } from '@phosphor-icons/react';

export default function AdminDashboard() {
    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider">Admin Dashboard</h1>
                    <p className="text-slate-400 text-sm mt-1">System overview and user management</p>
                </div>
            </div>

            {/* Stats Grid - Empty State */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { icon: Users, label: 'Total Users', value: 0 },
                    { icon: Exam, label: 'Questions', value: 0 },
                    { icon: Buildings, label: 'Drives', value: 0 },
                    { icon: ChartLineUp, label: 'Success Rate', value: '-' },
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

            {/* User Breakdown - Empty State */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                    <h3 className="text-sm font-mono text-slate-500 uppercase tracking-wider mb-2">Students</h3>
                    <p className="text-3xl font-bold text-blue-400">0</p>
                    <p className="text-xs text-slate-500 mt-1">Active registrations</p>
                </div>
                <div className="card">
                    <h3 className="text-sm font-mono text-slate-500 uppercase tracking-wider mb-2">Officers</h3>
                    <p className="text-3xl font-bold text-green-400">0</p>
                    <p className="text-xs text-slate-500 mt-1">Placement officers</p>
                </div>
                <div className="card">
                    <h3 className="text-sm font-mono text-slate-500 uppercase tracking-wider mb-2">Admins</h3>
                    <p className="text-3xl font-bold text-purple-400">0</p>
                    <p className="text-xs text-slate-500 mt-1">System administrators</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
                <h3 className="text-lg font-chivo font-bold uppercase tracking-wider mb-4">Admin Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button className="btn-primary flex items-center justify-center gap-2">
                        <UserPlus size={18} /> Add User
                    </button>
                    <button className="btn-secondary flex items-center justify-center gap-2">
                        <Users size={18} /> Manage Users
                    </button>
                    <button className="btn-secondary flex items-center justify-center gap-2">
                        <ChartLineUp size={18} /> View Analytics
                    </button>
                    <button className="btn-secondary flex items-center justify-center gap-2">
                        <Gear size={18} /> Settings
                    </button>
                </div>
            </div>

            {/* Recent Users - Empty State */}
            <div className="card">
                <h3 className="text-lg font-chivo font-bold uppercase tracking-wider mb-4">Recent Registrations</h3>
                <div className="text-center py-8">
                    <Users size={48} className="text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No recent registrations.</p>
                    <p className="text-slate-600 text-xs mt-1">New users will appear here.</p>
                </div>
            </div>
        </div>
    );
}
