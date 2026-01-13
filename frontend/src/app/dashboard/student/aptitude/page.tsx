'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Brain,
    Rocket,
    Hourglass,
    CheckCircle,
    WarningCircle,
    ArrowRight,
    Timer,
    ChartLine,
    ChartLineUp,
    Exam,
    X,
    Clock,
    ArrowsCounterClockwise,
    CaretLeft,
    MonitorPlay,
    Cards,
    Plus
} from '@phosphor-icons/react';
import { ImpactStyle } from '@capacitor/haptics';
import {
    api,
    StudentAptitudeDashboard,
    AssessmentStartResponse,
    QuestionBrief,
    AttemptResponse
} from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';
import { toast } from 'sonner';


type TestState = 'DASHBOARD' | 'RUNNING' | 'COMPLETED' | 'REVIEW';

export default function AptitudePage() {
    const { hapticImpact, hapticSelection } = useCapacitor();

    // UI State
    const [view, setView] = useState<TestState>('DASHBOARD');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Data State
    const [dashboardData, setDashboardData] = useState<StudentAptitudeDashboard | null>(null);
    const [recentAttempts, setRecentAttempts] = useState<AttemptResponse[]>([]);
    const [activeTest, setActiveTest] = useState<AssessmentStartResponse | null>(null);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<string, string | null>>({});
    const [testResults, setTestResults] = useState<AttemptResponse | null>(null);

    // Timer State
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Screen size for responsive charts
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [stats, history] = await Promise.all([
                api.getStudentAptitudeDashboard(),
                api.getMyAttempts()
            ]);
            setDashboardData(stats);
            setRecentAttempts(history.slice(0, 5));
        } catch (error) {
            console.error('Failed to fetch aptitude data:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Timer Logic
    useEffect(() => {
        if (view === 'RUNNING') {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [view]);

    // Actions
    const handleStartTest = async (category?: string) => {
        hapticImpact(ImpactStyle.Medium);
        try {
            setLoading(true);
            const data = await api.startAssessment({ category, count: 10 });
            setActiveTest(data);
            setUserAnswers({});
            setCurrentQuestionIdx(0);
            setElapsedTime(0);
            setView('RUNNING');
            toast.success('Assessment started! Good luck.');
        } catch (error) {
            console.error('Failed to start assessment:', error);
            toast.error('Failed to start assessment');
        } finally {
            setLoading(false);
        }
    };

    const handleOptionSelect = (option: string) => {
        if (!activeTest) return;
        hapticSelection();
        const questionId = activeTest.questions[currentQuestionIdx].id;
        setUserAnswers(prev => ({ ...prev, [questionId]: option }));
    };

    const handleSubmitTest = async () => {
        if (!activeTest) return;
        hapticImpact(ImpactStyle.Heavy);
        setSubmitting(true);
        try {
            const result = await api.submitAssessment(activeTest.attempt_id, {
                user_answers: userAnswers,
                time_taken_seconds: elapsedTime
            });
            setTestResults(result);
            setView('COMPLETED');
            toast.success('Assessment submitted successfully!');
            fetchData(); // Refresh dashboard
        } catch (error) {
            console.error('Failed to submit assessment:', error);
            toast.error('Failed to submit assessment');
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Renderers
    const renderDashboard = () => {
        if (loading && !dashboardData) {
            return (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Skeleton variant="card" className="h-24" />
                        <Skeleton variant="card" className="h-24" />
                        <Skeleton variant="card" className="h-24" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <Skeleton variant="card" className="lg:col-span-8 h-80" />
                        <Skeleton variant="card" className="lg:col-span-4 h-80" />
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Stats Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="card flex items-center gap-4">
                        <div className="p-2.5 rounded-sm bg-blue-500/10 text-blue-400">
                            <Cards size={24} weight="duotone" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Total Attempts</p>
                            <p className="text-xl font-bold font-mono text-slate-100">{dashboardData?.total_attempts || 0}</p>
                        </div>
                    </div>
                    <div className="card flex items-center gap-4">
                        <div className="p-2.5 rounded-sm bg-emerald-500/10 text-emerald-400">
                            <ChartLineUp size={24} weight="duotone" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Average Accuracy</p>
                            <p className="text-xl font-bold font-mono text-slate-100">{dashboardData?.average_score || 0}%</p>
                        </div>
                    </div>
                    <div className="card flex items-center gap-4">
                        <div className="p-2.5 rounded-sm bg-amber-500/10 text-amber-400">
                            <Rocket size={24} weight="duotone" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Personal Best</p>
                            <p className="text-xl font-bold font-mono text-slate-100">{dashboardData?.best_score || 0}%</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Performance Analysis */}
                    <div className="lg:col-span-8 card">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-sm font-chivo font-bold uppercase tracking-wider text-slate-100">Performance Matrix</h2>
                                <p className="text-slate-500 text-[10px] font-mono">Topic-wise accuracy distribution</p>
                            </div>
                            <div className="w-8 h-8 rounded-sm bg-slate-800 flex items-center justify-center text-slate-400">
                                <ChartLine size={16} />
                            </div>
                        </div>

                        <div className="space-y-8 py-2">
                            {dashboardData?.topic_analysis && dashboardData.topic_analysis.length > 0 ? (
                                <div className="grid grid-cols-1 gap-8">
                                    {dashboardData.topic_analysis.map((entry, index) => (
                                        <div key={index} className="space-y-3 group relative">
                                            {/* Meta Info Row */}
                                            <div className="flex items-end justify-between px-1">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[7px] font-mono text-slate-600 uppercase tracking-[0.3em]">
                                                        METRIC_ID: AT-0{index + 1}
                                                    </span>
                                                    <h3 className="text-[11px] md:text-xs font-chivo font-black text-slate-100 uppercase tracking-wider group-hover:text-blue-400 transition-colors">
                                                        {entry.category.replace('_', ' ')}
                                                    </h3>
                                                </div>

                                                <div className="flex items-center gap-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[8px] font-mono text-slate-500 tracking-tighter">TELEMETRY_STATUS</span>
                                                        <span className="text-[10px] font-mono font-bold text-slate-300">
                                                            {entry.correct}/{entry.total} <span className="opacity-40">UNIT</span>
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[8px] font-mono text-slate-500 tracking-tighter">ACCURACY_VAL</span>
                                                        <span className={`text-base md:text-lg font-mono font-black italic tracking-tighter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] ${entry.accuracy > 75 ? 'text-emerald-400' : entry.accuracy > 50 ? 'text-amber-400' : 'text-red-400'
                                                            }`}>
                                                            {entry.accuracy}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bar Container */}
                                            <div className="h-2 w-full bg-slate-950/80 rounded-sm border border-slate-800/60 p-[1px] relative overflow-hidden">
                                                {/* HUD Grid Background */}
                                                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(90deg,transparent_95%,rgba(255,255,255,0.1)_95%)] bg-[length:20px_100%]" />

                                                {/* Progress Fill */}
                                                <div
                                                    className={`h-full relative rounded-[1px] transition-all duration-1500 ease-out fill-animation shadow-[0_0_15px_rgba(0,0,0,0.5)] ${entry.accuracy > 75
                                                        ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 shadow-[0_1px_10px_rgba(16,185,129,0.3)]'
                                                        : entry.accuracy > 50
                                                            ? 'bg-gradient-to-r from-amber-600 via-amber-400 to-amber-300 shadow-[0_1px_10px_rgba(245,158,11,0.3)]'
                                                            : 'bg-gradient-to-r from-red-600 via-red-400 to-red-300 shadow-[0_1px_10px_rgba(239,68,68,0.3)]'
                                                        }`}
                                                    style={{ width: `${entry.accuracy}%` }}
                                                >
                                                    {/* Scanning light effect */}
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-hud-scan" />

                                                    {/* Digital artifacts at the end of the bar */}
                                                    <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/40 shadow-[0_0_8px_white]" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-600 border border-dashed border-slate-800 rounded-sm py-16 bg-slate-950/20">
                                    <Brain size={40} weight="thin" className="mb-3 opacity-20" />
                                    <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-slate-700">Awaiting_Neural_Input_Stream</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Practice Selection */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="card bg-gradient-to-br from-blue-900/40 to-slate-900/60 border-blue-800/20 group relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="font-chivo font-bold text-lg uppercase tracking-wider mb-2 text-blue-300">Fast Assessment</h3>
                                <p className="text-slate-400 text-xs mb-6 leading-relaxed font-inter">
                                    10 random questions across all categories. Perfect for daily practice.
                                </p>
                                <button
                                    onClick={() => handleStartTest()}
                                    className="btn-primary w-full flex items-center justify-center gap-2 btn-ripple"
                                >
                                    Initialize Core
                                    <ArrowRight weight="bold" />
                                </button>
                            </div>
                            <Brain className="absolute -bottom-4 -right-4 text-blue-500/5 group-hover:scale-110 transition-transform duration-700" size={140} weight="duotone" />
                        </div>

                        <div className="card">
                            <h3 className="text-xs font-chivo font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-800 pb-2">Module Training</h3>
                            <div className="space-y-2">
                                {[
                                    { id: 'QUANTITATIVE', label: 'Quant' },
                                    { id: 'LOGICAL_REASONING', label: 'Logical' },
                                    { id: 'VERBAL_ABILITY', label: 'Verbal' },
                                    { id: 'DATA_INTERPRETATION', label: 'Data Interpretation' }
                                ].map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleStartTest(cat.id)}
                                        className="w-full group bg-slate-950/50 hover:bg-slate-800/80 p-3 border border-slate-800/40 rounded-sm flex items-center justify-between transition-all active:scale-[0.98] btn-ripple"
                                    >
                                        <span className="text-[11px] font-mono text-slate-400 group-hover:text-blue-400">{cat.label}</span>
                                        <Plus size={12} className="text-slate-600" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Post-stats section */}
                <div className="card">
                    <h3 className="text-xs font-chivo font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-800 pb-2">Session History</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {recentAttempts.length > 0 ? recentAttempts.map(attempt => (
                            <div key={attempt.id} className="flex items-center justify-between p-3 bg-slate-950/40 rounded-sm border border-slate-800/40">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${attempt.score >= 70 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                        <Timer size={16} weight="duotone" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-200">{attempt.category?.replace('_', ' ') || 'Mixed Session'}</p>
                                        <p className="text-[9px] text-slate-500 font-mono">{new Date(attempt.started_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold font-mono text-slate-100">{attempt.score}%</p>
                                    <div className="h-1 w-12 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                        <div className={`h-full ${attempt.score >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${attempt.score}%` }} />
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-2 py-8 text-center text-slate-600 border border-dashed border-slate-800 rounded-sm">
                                <p className="text-xs font-mono">No session records found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderTestRunner = () => {
        if (!activeTest) return null;

        const currentQ = activeTest.questions[currentQuestionIdx];
        const progress = ((currentQuestionIdx + 1) / activeTest.total_questions) * 100;

        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-400">
                {/* HUD Header */}
                <div className="card flex items-center justify-between gap-2 border-blue-500/20 bg-blue-900/5 px-3 py-2 md:p-4">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="p-1.5 md:p-2 bg-blue-600 rounded-sm text-white">
                            <Exam size={isMobile ? 14 : 18} weight="bold" />
                        </div>
                        <div>
                            <p className="text-[7px] md:text-[9px] text-blue-400 uppercase font-bold tracking-[0.2em] font-mono">System.Aptitude</p>
                            <p className="text-xs md:text-sm font-chivo font-bold text-slate-100 uppercase">Q{currentQuestionIdx + 1} // {activeTest.total_questions}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-6">
                        <div className="flex items-center gap-1.5 text-blue-400 text-sm md:text-lg font-mono tracking-tighter">
                            <Timer weight="bold" className="text-blue-500/40" size={isMobile ? 14 : 18} />
                            {formatTime(elapsedTime)}
                        </div>
                        <button
                            onClick={() => {
                                if (confirm('Abort session? Progress will be lost.')) {
                                    setView('DASHBOARD');
                                }
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-sm transition-colors"
                            title="Abort Test"
                        >
                            <X size={isMobile ? 16 : 20} weight="bold" />
                        </button>
                    </div>
                </div>

                {/* Progress HUD */}
                <div className="px-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1 uppercase tracking-widest">
                        <span>Transmission Progress</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                            className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-700 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Question Terminal */}
                <div className="card p-5 md:p-10 relative overflow-hidden bg-slate-900/40">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4 md:mb-6">
                            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-sm text-[8px] md:text-[9px] font-mono border border-slate-700 uppercase tracking-wider">
                                Sector: {currentQ.category.replace('_', ' ')}
                            </span>
                            <div className="h-px flex-1 bg-slate-800/50" />
                        </div>

                        <h2 className="text-base md:text-xl font-medium text-slate-100 leading-relaxed mb-6 md:mb-10 font-inter">
                            {currentQ.question_text}
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(currentQ.options).map(([key, value]) => {
                                const isSelected = userAnswers[currentQ.id] === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => handleOptionSelect(key)}
                                        className={`group relative p-4 rounded-sm text-left transition-all duration-200 border btn-ripple ${isSelected
                                            ? 'bg-blue-600/20 border-blue-500 text-blue-100'
                                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-600 text-slate-400'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-sm flex items-center justify-center font-mono font-bold text-sm transition-all ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'
                                                }`}>
                                                {key}
                                            </div>
                                            <span className="text-sm tracking-tight">{value}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {/* HUD Scanline effect */}
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-blue-500/10 animate-scanline" />
                </div>

                {/* Telemetry Navigation */}
                <div className="flex items-center justify-between pt-4">
                    <button
                        disabled={currentQuestionIdx === 0}
                        onClick={() => { hapticImpact(); setCurrentQuestionIdx(prev => prev - 1); }}
                        className="btn-secondary flex items-center gap-2 disabled:opacity-0"
                    >
                        <CaretLeft weight="bold" />
                        Prev
                    </button>

                    {currentQuestionIdx === activeTest.total_questions - 1 ? (
                        <button
                            onClick={handleSubmitTest}
                            disabled={submitting}
                            className={`btn-primary px-12 bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 flex items-center gap-2 ${submitting ? 'opacity-50' : 'animate-pulse'}`}
                        >
                            {submitting ? 'Processing...' : 'Submit Session'}
                            <CheckCircle weight="bold" />
                        </button>
                    ) : (
                        <button
                            onClick={() => { hapticImpact(); setCurrentQuestionIdx(prev => prev + 1); }}
                            className="btn-primary px-12 flex items-center gap-2"
                        >
                            Next Core
                            <ArrowRight weight="bold" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderCompleted = () => {
        if (!testResults) return null;

        return (
            <div className="max-w-xl mx-auto space-y-8 animate-in zoom-in duration-500">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-sm flex items-center justify-center mx-auto border border-emerald-500/20">
                        <CheckCircle size={40} weight="duotone" />
                    </div>
                    <h1 className="text-2xl font-chivo font-bold text-slate-100 uppercase tracking-tighter">Session.Result.Success</h1>
                    <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.2em]">Data migration to profile complete</p>
                </div>

                <div className="card bg-slate-900/40 p-10 border-slate-800 shadow-2xl">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="text-center space-y-1">
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Accuracy</p>
                            <p className="text-5xl font-mono font-bold text-gradient">{testResults.score}%</p>
                        </div>
                        <div className="text-center space-y-1 border-l border-slate-800">
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Telemetry</p>
                            <p className="text-3xl font-mono font-bold text-slate-300 pt-2">{formatTime(elapsedTime)}</p>
                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-800 text-center">
                        <p className="text-xs font-mono text-slate-400 italic">
                            {testResults.score >= 80 ? "// OPTIMAL_PERFORMANCE_DETECTED" :
                                testResults.score >= 60 ? "// COMPETENT_SKILLS_ALIGNED" :
                                    "// ADDITIONAL_TRAINING_REQUISITIONED"}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        onClick={() => setView('DASHBOARD')}
                        className="btn-secondary w-full py-4 text-xs tracking-widest font-bold btn-ripple"
                    >
                        Terminal Dashboard
                    </button>
                    <button
                        onClick={() => handleStartTest(activeTest?.questions[0].category)}
                        className="btn-primary w-full py-4 text-xs tracking-widest font-bold btn-ripple flex items-center justify-center gap-2"
                    >
                        Recycle Training
                        <ArrowsCounterClockwise weight="bold" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto py-2">
            {/* HUD Scanlines */}
            <div className="scanlines opacity-[0.03]" />

            <div className="pt-2">
                {view !== 'DASHBOARD' && view !== 'RUNNING' && (
                    <button
                        onClick={() => setView('DASHBOARD')}
                        className="mb-8 flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-all group btn-ripple px-2 py-1"
                    >
                        <CaretLeft weight="bold" className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-mono uppercase tracking-widest">Return to Base</span>
                    </button>
                )}

                {view === 'DASHBOARD' && (
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-slate-800 pb-6 px-1">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <Brain size={32} weight="duotone" className="text-blue-500" />
                                <h1 className="text-3xl md:text-4xl font-chivo font-black uppercase tracking-tighter text-slate-100">
                                    Aptitude<span className="text-blue-500">_Terminal</span>
                                </h1>
                            </div>
                            <p className="text-slate-500 text-[11px] font-mono uppercase tracking-[0.2em] ml-11">
                                Cognitive Skills Assessment & Optimization
                            </p>
                        </div>
                        <div className="hidden md:block">
                            <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-sm">
                                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">System.Status: <span className="text-emerald-500">Optimal</span></p>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'DASHBOARD' && renderDashboard()}
                {view === 'RUNNING' && renderTestRunner()}
                {view === 'COMPLETED' && renderCompleted()}
            </div>
        </div>
    );
}


