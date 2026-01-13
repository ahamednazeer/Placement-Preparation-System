'use client';

import React, { useEffect, useState } from 'react';
import { Brain, Microphone, Code, Buildings, Trophy, ChartLineUp, Clock, Target } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';

interface ScoreCardProps {
    title: string;
    score: number;
    icon: React.ElementType;
    color: string;
    href: string;
}

function ScoreCard({ title, score, icon: Icon, color, href }: ScoreCardProps) {
    const router = useRouter();
    const { hapticImpact } = useCapacitor();
    const colorClasses: Record<string, string> = {
        blue: 'from-blue-600 to-blue-800 text-blue-400',
        green: 'from-green-600 to-green-800 text-green-400',
        purple: 'from-purple-600 to-purple-800 text-purple-400',
        orange: 'from-orange-600 to-orange-800 text-orange-400',
    };

    return (
        <div
            onClick={() => { hapticImpact(); router.push(href); }}
            className="card card-hover cursor-pointer group btn-ripple"
        >
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-sm bg-gradient-to-br ${colorClasses[color]?.split(' ').slice(0, 2).join(' ')} shadow-lg`}>
                    <Icon size={24} weight="duotone" className="text-white" />
                </div>
                <div className={`text-2xl font-bold font-mono ${colorClasses[color]?.split(' ').slice(2).join(' ')}`}>
                    {score}%
                </div>
            </div>
            <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider">{title}</h3>
            <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full bg-gradient-to-r ${colorClasses[color]?.split(' ').slice(0, 2).join(' ')} transition-all duration-500`}
                    style={{ width: `${score}%` }}
                />
            </div>
            <p className="text-xs text-slate-500 mt-2 group-hover:text-slate-400 transition-colors">
                Click to practice →
            </p>
        </div>
    );
}

export default function StudentDashboard() {
    const router = useRouter();
    const { hapticImpact } = useCapacitor();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [profileStatus, setProfileStatus] = useState<{ is_complete: boolean; completion_percentage: number } | null>(null);
    const [scores] = useState({
        aptitude: 0,
        interview: 0,
        coding: 0,
        overall: 0,
    });

    useEffect(() => {
        async function fetchData() {
            try {
                const [userData, statusData] = await Promise.all([
                    api.getMe(),
                    api.getProfileStatus(),
                ]);
                setUser(userData);
                setProfileStatus(statusData);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <Skeleton variant="card" className="h-40" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Skeleton variant="card" className="h-32" />
                    <Skeleton variant="card" className="h-32" />
                    <Skeleton variant="card" className="h-32" />
                    <Skeleton variant="card" className="h-32" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Skeleton variant="card" className="h-20" />
                    <Skeleton variant="card" className="h-20" />
                    <Skeleton variant="card" className="h-20" />
                    <Skeleton variant="card" className="h-20" />
                </div>
                <Skeleton variant="card" className="h-40" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Profile Incomplete Warning */}
            {profileStatus && !profileStatus.is_complete && (
                <div
                    onClick={() => { hapticImpact(); router.push('/dashboard/student/profile?setup=true'); }}
                    className="card p-4 border border-yellow-600/30 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 cursor-pointer hover:border-yellow-500/50 transition-all btn-ripple"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-yellow-500/20">
                            <ChartLineUp size={24} className="text-yellow-400" weight="duotone" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-yellow-300">Complete Your Profile</h3>
                            <p className="text-xs text-slate-400">
                                Your profile is {profileStatus.completion_percentage}% complete. Add missing details to unlock all features.
                            </p>
                        </div>
                        <div className="text-yellow-400 font-mono font-bold">
                            {profileStatus.completion_percentage}%
                        </div>
                    </div>
                    <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
                            style={{ width: `${profileStatus.completion_percentage}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Overall Readiness Score */}
            <div className="card p-6 border-blue-800/20 bg-gradient-to-br from-blue-900/10 to-slate-900/40">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-chivo font-bold uppercase tracking-wider mb-1">
                            Readiness Score
                        </h2>
                        <p className="text-slate-400 text-sm">Your overall placement readiness based on all modules</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <svg className="w-24 h-24" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" fill="none" stroke="#334155" strokeWidth="8" />
                                <circle
                                    cx="50" cy="50" r="40"
                                    fill="none"
                                    stroke="url(#gradient)"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${scores.overall * 2.51} 251`}
                                    transform="rotate(-90 50 50)"
                                />
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#3b82f6" />
                                        <stop offset="100%" stopColor="#22c55e" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl font-bold font-mono text-gradient">{scores.overall}%</span>
                            </div>
                        </div>
                        <div className="text-sm">
                            <p className="text-slate-400 font-medium">
                                {scores.overall === 0 ? 'Start practicing to see progress' : scores.overall >= 70 ? '✓ Ready for placements' : '↗ Keep practicing'}
                            </p>
                            <p className="text-slate-500">Target: 70%</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Score Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ScoreCard title="Aptitude" score={scores.aptitude} icon={Brain} color="blue" href="/dashboard/student/aptitude" />
                <ScoreCard title="Interview" score={scores.interview} icon={Microphone} color="purple" href="/dashboard/student/interview" />
                <ScoreCard title="Coding" score={scores.coding} icon={Code} color="green" href="/dashboard/student/coding" />
                <ScoreCard title="Applications" score={0} icon={Buildings} color="orange" href="/dashboard/student/placements" />
            </div>

            {/* Stats Row - Empty State */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { icon: Target, label: 'Tests Taken', value: 0, subtext: 'This month' },
                    { icon: Trophy, label: 'Best Score', value: '-', subtext: 'No tests yet' },
                    { icon: Clock, label: 'Practice Time', value: '0h', subtext: 'This week' },
                    { icon: ChartLineUp, label: 'Improvement', value: '-', subtext: 'No data yet' },
                ].map((stat, i) => (
                    <div key={i} className="card btn-ripple" onClick={() => hapticImpact()}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-sm bg-slate-800">
                                <stat.icon size={20} className="text-blue-400" weight="duotone" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">{stat.label}</p>
                                <p className="text-lg font-bold text-slate-100">{stat.value}</p>
                                <p className="text-xs text-slate-500">{stat.subtext}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="card">
                <h3 className="text-lg font-chivo font-bold uppercase tracking-wider mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button onClick={() => { hapticImpact(); router.push('/dashboard/student/aptitude'); }} className="btn-primary flex items-center justify-center gap-2 btn-ripple">
                        <Brain size={18} /> Start Aptitude Test
                    </button>
                    <button onClick={() => { hapticImpact(); router.push('/dashboard/student/interview'); }} className="btn-secondary flex items-center justify-center gap-2 btn-ripple">
                        <Microphone size={18} /> Mock Interview
                    </button>
                    <button onClick={() => { hapticImpact(); router.push('/dashboard/student/coding'); }} className="btn-secondary flex items-center justify-center gap-2 btn-ripple">
                        <Code size={18} /> Coding Practice
                    </button>
                    <button onClick={() => { hapticImpact(); router.push('/dashboard/student/placements'); }} className="btn-secondary flex items-center justify-center gap-2 btn-ripple">
                        <Buildings size={18} /> View Drives
                    </button>
                </div>
            </div>

            {/* Recent Activity - Empty State */}
            <div className="card">
                <h3 className="text-lg font-chivo font-bold uppercase tracking-wider mb-4">Recent Activity</h3>
                <div className="text-center py-8">
                    <p className="text-slate-500 text-sm">No recent activity yet.</p>
                    <p className="text-slate-600 text-xs mt-1">Start practicing to see your activity here.</p>
                </div>
            </div>
        </div>
    );
}
