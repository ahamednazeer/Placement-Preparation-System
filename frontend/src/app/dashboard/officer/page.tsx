'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Exam, Buildings, Users, ChartLineUp, Plus, ArrowRight, Brain } from '@phosphor-icons/react';
import { api, QuestionStatsResponse } from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';

export default function OfficerDashboard() {
    const router = useRouter();
    const { hapticImpact } = useCapacitor();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<QuestionStatsResponse | null>(null);

    useEffect(() => {
        async function fetchStats() {
            try {
                const data = await api.getQuestionStats();
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    const goToAptitude = () => {
        hapticImpact();
        router.push('/dashboard/officer/aptitude');
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton variant="card" className="h-16" />
                <div className="grid grid-cols-2 gap-3">
                    <Skeleton variant="card" className="h-20" />
                    <Skeleton variant="card" className="h-20" />
                </div>
                <Skeleton variant="card" className="h-32" />
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-20">
            {/* Header */}
            <div className="card">
                <h1 className="font-chivo font-bold text-lg uppercase tracking-wide">Officer Dashboard</h1>
                <p className="text-xs text-slate-500 mt-1">Manage aptitude questions and placement drives</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <div className="card text-center">
                    <p className="text-3xl font-bold text-blue-400">{stats?.total || 0}</p>
                    <p className="text-xs text-slate-500 uppercase">Total Questions</p>
                </div>
                <div className="card text-center">
                    <p className="text-3xl font-bold text-green-400">{stats?.by_difficulty?.EASY || 0}</p>
                    <p className="text-xs text-slate-500 uppercase">Easy</p>
                </div>
                <div className="card text-center">
                    <p className="text-3xl font-bold text-yellow-400">{stats?.by_difficulty?.MEDIUM || 0}</p>
                    <p className="text-xs text-slate-500 uppercase">Medium</p>
                </div>
                <div className="card text-center">
                    <p className="text-3xl font-bold text-red-400">{stats?.by_difficulty?.HARD || 0}</p>
                    <p className="text-xs text-slate-500 uppercase">Hard</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-sm bg-purple-600 flex items-center justify-center">
                        <Brain size={22} weight="bold" className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold">Aptitude Questions</h3>
                        <p className="text-xs text-slate-500">Create, edit, and manage questions</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={goToAptitude} className="btn-primary flex-1 h-12 flex items-center justify-center gap-2 active:scale-95">
                        <Plus size={18} weight="bold" /> Add Question
                    </button>
                    <button onClick={goToAptitude} className="btn-secondary h-12 px-4 flex items-center gap-2 active:scale-95">
                        View All <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            {/* Categories */}
            {stats && (
                <div className="card">
                    <h3 className="font-bold mb-3">By Category</h3>
                    <div className="space-y-2">
                        {Object.entries(stats.by_category).map(([cat, count]) => (
                            <div key={cat} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                                <span className="text-sm">{cat.replace('_', ' ')}</span>
                                <span className="text-sm font-mono text-slate-400">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Future: Placement Drives */}
            <div className="card opacity-60">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm bg-slate-700 flex items-center justify-center">
                        <Buildings size={22} className="text-slate-500" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold">Placement Drives</h3>
                        <p className="text-xs text-slate-500">Coming soon</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
