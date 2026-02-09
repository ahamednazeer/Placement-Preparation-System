'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowClockwise, Brain, Buildings, ChartLineUp, Microphone } from '@phosphor-icons/react';
import { api, DriveStatsResponse, InterviewStatsResponse, QuestionStatsResponse } from '@/lib/api';
import Skeleton from '@/components/Skeleton';
import { toast } from 'sonner';

const sortEntries = (record?: Record<string, number> | null) =>
    Object.entries(record || {}).sort((a, b) => a[0].localeCompare(b[0]));

const formatNumber = (value?: number | null) =>
    Number.isFinite(value as number) ? (value as number).toLocaleString() : '--';

const formatScore = (value?: number | null) =>
    Number.isFinite(value as number) ? (value as number).toFixed(1) : '--';

export default function AdminAnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [questionStats, setQuestionStats] = useState<QuestionStatsResponse | null>(null);
    const [driveStats, setDriveStats] = useState<DriveStatsResponse | null>(null);
    const [interviewStats, setInterviewStats] = useState<InterviewStatsResponse | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        const [questionsRes, drivesRes, summaryRes] = await Promise.allSettled([
            api.getQuestionStats(),
            api.getDriveStats(),
            api.getAdminSummary(),
        ]);

        if (questionsRes.status === 'fulfilled') {
            setQuestionStats(questionsRes.value);
        } else {
            console.error('Failed to load question stats:', questionsRes.reason);
            toast.error('Failed to load question stats');
            setQuestionStats(null);
        }

        if (drivesRes.status === 'fulfilled') {
            setDriveStats(drivesRes.value);
        } else {
            console.error('Failed to load drive stats:', drivesRes.reason);
            toast.error('Failed to load drive stats');
            setDriveStats(null);
        }

        if (summaryRes.status === 'fulfilled') {
            setInterviewStats({
                completed_interviews: summaryRes.value.interview_completed || 0,
                average_score: summaryRes.value.interview_average_score ?? 0,
                best_score: summaryRes.value.interview_best_score ?? 0,
            });
        } else {
            console.error('Failed to load interview stats:', summaryRes.reason);
            toast.error('Failed to load interview stats');
            setInterviewStats(null);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton variant="card" className="h-24" />
                <Skeleton variant="card" className="h-64" />
            </div>
        );
    }

    const questionByCategory = sortEntries(questionStats?.by_category);
    const questionByDifficulty = sortEntries(questionStats?.by_difficulty);
    const driveByStatus = sortEntries(driveStats?.by_status);

    return (
        <div className="space-y-4 pb-20">
            <div className="card">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-sm bg-purple-600 flex items-center justify-center">
                            <ChartLineUp size={22} weight="bold" className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-chivo font-bold text-lg uppercase tracking-wide">Analytics</h1>
                            <p className="text-xs text-slate-500">System health and engagement metrics</p>
                        </div>
                    </div>
                    <button
                        onClick={loadStats}
                        className="btn-secondary h-9 px-3 text-[10px] flex items-center gap-2"
                    >
                        <ArrowClockwise size={14} /> Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-sm bg-blue-500/20">
                            <Brain size={18} className="text-blue-400" weight="duotone" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Questions</p>
                            <p className="text-2xl font-bold text-slate-100">{formatNumber(questionStats?.total)}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-sm bg-emerald-500/20">
                            <Buildings size={18} className="text-emerald-400" weight="duotone" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Drives</p>
                            <p className="text-2xl font-bold text-slate-100">{formatNumber(driveStats?.total)}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-sm bg-purple-500/20">
                            <Microphone size={18} className="text-purple-400" weight="duotone" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Completed</p>
                            <p className="text-2xl font-bold text-slate-100">{formatNumber(interviewStats?.completed_interviews)}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-sm bg-yellow-500/20">
                            <Microphone size={18} className="text-yellow-400" weight="duotone" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Avg Score</p>
                            <p className="text-2xl font-bold text-slate-100">{formatScore(interviewStats?.average_score)}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-sm bg-rose-500/20">
                            <Microphone size={18} className="text-rose-400" weight="duotone" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Best Score</p>
                            <p className="text-2xl font-bold text-slate-100">{formatScore(interviewStats?.best_score)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card">
                    <h3 className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Questions by Category</h3>
                    {questionByCategory.length === 0 ? (
                        <p className="text-xs text-slate-500">No question data yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {questionByCategory.map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">{key.replace(/_/g, ' ')}</span>
                                    <span className="font-mono text-slate-200">{value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="card">
                    <h3 className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Questions by Difficulty</h3>
                    {questionByDifficulty.length === 0 ? (
                        <p className="text-xs text-slate-500">No difficulty data yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {questionByDifficulty.map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">{key}</span>
                                    <span className="font-mono text-slate-200">{value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="card">
                <h3 className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-3">Drive Status Breakdown</h3>
                {driveByStatus.length === 0 ? (
                    <p className="text-xs text-slate-500">No drive data yet.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {driveByStatus.map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between text-xs bg-slate-900/60 border border-slate-800/60 rounded-sm px-3 py-2">
                                <span className="text-slate-400">{key}</span>
                                <span className="font-mono text-slate-200">{value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
