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
    Plus,
    Lightning
} from '@phosphor-icons/react';
import { ImpactStyle } from '@capacitor/haptics';
import {
    api,
    PlacementDrive,
    StudentAptitudeDashboard,
    AssessmentStartResponse,
    QuestionBrief,
    AttemptResponse,
    AttemptDetailResponse,
    ActiveAssessmentResponse,
    ResumeAnalysis,
    DriveAssessmentStartResponse,
    DriveAssessmentActiveResponse,
    DriveAssessmentSubmitResponse
} from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';


type TestState = 'DASHBOARD' | 'RUNNING' | 'COMPLETED' | 'REVIEW';

export default function AptitudePage() {
    const { hapticImpact, hapticSelection } = useCapacitor();
    const searchParams = useSearchParams();
    const driveId = searchParams.get('drive');
    const stageParam = searchParams.get('stage');
    const driveStage = stageParam === 'APTITUDE' || stageParam === 'TECHNICAL' ? stageParam : null;
    const isDriveAssessment = Boolean(driveId && driveStage);

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
    const [attemptDetail, setAttemptDetail] = useState<AttemptDetailResponse | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [activeResume, setActiveResume] = useState<ActiveAssessmentResponse | null>(null);
    const [mode, setMode] = useState<'PRACTICE' | 'TEST' | 'RESUME_ONLY'>('PRACTICE');
    const [difficultyFilter, setDifficultyFilter] = useState('');
    const [questionCount, setQuestionCount] = useState(10);
    const [resumeQuestionCount, setResumeQuestionCount] = useState(2);
    const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
    const [autoSaving, setAutoSaving] = useState(false);
    const [questionsLoading, setQuestionsLoading] = useState(false);
    const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysis | null>(null);
    const [resumeSkills, setResumeSkills] = useState<string[]>([]);
    const [resumeSkillLoading, setResumeSkillLoading] = useState(false);
    const [resumeAnalyzing, setResumeAnalyzing] = useState(false);
    const [resumeProjects, setResumeProjects] = useState<string[]>([]);
    const [driveInfo, setDriveInfo] = useState<PlacementDrive | null>(null);
    const [drivePassPercentage, setDrivePassPercentage] = useState<number | null>(null);
    const [driveResult, setDriveResult] = useState<DriveAssessmentSubmitResponse | null>(null);

    // Timer State
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const questionTimerRef = useRef<NodeJS.Timeout | null>(null);
    const userAnswersRef = useRef<Record<string, string | null>>({});
    const timeLeftByQuestionRef = useRef<Record<string, number>>({});
    const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
    const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        if (isDriveAssessment) return;
        fetchData();
    }, [fetchData, isDriveAssessment]);

    useEffect(() => {
        const loadActive = async () => {
            try {
                if (isDriveAssessment) {
                    setLoading(true);
                }
                if (isDriveAssessment && driveId && driveStage) {
                    const data = await api.getActiveDriveAssessment(driveId, driveStage);
                    setActiveResume(data as DriveAssessmentActiveResponse);
                    setDrivePassPercentage(data.pass_percentage);
                    return;
                }
                const data = await api.getActiveAssessment();
                setActiveResume(data);
            } catch (error: any) {
                const msg = String(error?.message || '');
                if (msg.includes('No active attempt') || msg.includes('404')) return;
                if (msg.includes('Session expired')) {
                    toast.error('Previous session expired.');
                    return;
                }
                // ignore other errors silently for now
            } finally {
                if (isDriveAssessment) {
                    setLoading(false);
                }
            }
        };
        loadActive();
    }, [isDriveAssessment, driveId, driveStage]);

    useEffect(() => {
        const loadDriveInfo = async () => {
            if (!isDriveAssessment || !driveId) return;
            try {
                const drive = await api.getDrive(driveId);
                setDriveInfo(drive);
            } catch (error) {
                // Ignore drive info errors for now
            }
        };
        loadDriveInfo();
    }, [isDriveAssessment, driveId]);

    const loadResumeAnalysis = useCallback(async () => {
        setResumeSkillLoading(true);
        try {
            const [analysis, projectHints] = await Promise.all([
                api.getResumeAnalysis(),
                api.getResumeProjectHints(),
            ]);
            setResumeAnalysis(analysis);
            if (!analysis && !projectHints) {
                setResumeSkills([]);
                setResumeProjects([]);
                return;
            }
            if (analysis) {
                const skills = new Set<string>();
                (analysis.extracted_skills || []).forEach((s) => skills.add(String(s)));
                const structured = analysis.structured_data || {};
                const structuredSkills = structured.skills || structured.technical_skills || [];
                if (Array.isArray(structuredSkills)) {
                    structuredSkills.forEach((s: any) => skills.add(String(s)));
                }
                setResumeSkills(Array.from(skills).filter((s) => s.trim()));
            } else {
                setResumeSkills([]);
            }

            if (projectHints && projectHints.projects?.length) {
                setResumeProjects(projectHints.projects);
            } else if (analysis) {
                const projects = new Set<string>();
                const structured = analysis.structured_data || {};
                const structuredProjects = structured.projects || structured.project_titles || [];
                if (Array.isArray(structuredProjects)) {
                    structuredProjects.forEach((p: any) => projects.add(String(p)));
                }
                if (Array.isArray(structured.experience_projects)) {
                    structured.experience_projects.forEach((p: any) => projects.add(String(p)));
                }
                setResumeProjects(Array.from(projects).filter((p) => p.trim()));
            } else {
                setResumeProjects([]);
            }
        } finally {
            setResumeSkillLoading(false);
        }
    }, []);

    const handleRunResumeAnalysis = async () => {
        if (resumeAnalyzing) return;
        setResumeAnalyzing(true);
        try {
            await api.analyzeResume();
            await loadResumeAnalysis();
            toast.success('Resume analysis completed.');
        } catch (error) {
            const message = error instanceof Error ? error.message : null;
            toast.error(message || 'Resume analysis failed');
        } finally {
            setResumeAnalyzing(false);
        }
    };

    useEffect(() => {
        if (isDriveAssessment || mode === 'PRACTICE') return;
        loadResumeAnalysis();
    }, [mode, loadResumeAnalysis, isDriveAssessment]);

    useEffect(() => {
        userAnswersRef.current = userAnswers;
    }, [userAnswers]);

    useEffect(() => {
        if (isDriveAssessment) {
            setMode('TEST');
        }
    }, [isDriveAssessment]);

    useEffect(() => {
        if (mode === 'RESUME_ONLY') {
            setResumeQuestionCount(questionCount);
            return;
        }
        setResumeQuestionCount((prev) => Math.min(prev, questionCount));
    }, [mode, questionCount]);

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
            setQuestionsLoading(true);
            let data: AssessmentStartResponse | DriveAssessmentStartResponse;
            if (isDriveAssessment && driveId && driveStage) {
                data = await api.startDriveAssessment(driveId, driveStage);
                setDrivePassPercentage((data as DriveAssessmentStartResponse).pass_percentage);
            } else {
                const allowedCategories = ['QUANTITATIVE', 'LOGICAL', 'VERBAL', 'TECHNICAL', 'DATA_INTERPRETATION'];
                const normalizedCategory = category && allowedCategories.includes(category) ? category : undefined;
                data = await api.startAssessment({
                    category: normalizedCategory,
                    count: questionCount,
                    difficulty: difficultyFilter || undefined,
                    mode,
                    resume_question_count: mode === 'PRACTICE' ? undefined : resumeQuestionCount
                });
            }
            setActiveTest(data);
            if (isDriveAssessment) {
                setDriveResult(null);
            }
            setUserAnswers({});
            userAnswersRef.current = {};
            timeLeftByQuestionRef.current = {};
            setCurrentQuestionIdx(0);
            setElapsedTime(0);
            setQuestionTimeLeft(null);
            setView('RUNNING');
            toast.success('Assessment started! Good luck.');
        } catch (error) {
            console.error('Failed to start assessment:', error);
            const message = error instanceof Error ? error.message : null;
            toast.error(message || 'Failed to start assessment');
        } finally {
            setLoading(false);
            setQuestionsLoading(false);
        }
    };

    const handleResumeTest = () => {
        if (!activeResume) return;
        hapticImpact(ImpactStyle.Medium);
        setActiveTest(activeResume);
        setUserAnswers(activeResume.user_answers || {});
        userAnswersRef.current = activeResume.user_answers || {};
        timeLeftByQuestionRef.current = {};
        const firstUnanswered = activeResume.questions.findIndex(
            q => !(activeResume.user_answers || {})[q.id]
        );
        setCurrentQuestionIdx(firstUnanswered >= 0 ? firstUnanswered : 0);
        setElapsedTime(0);
        setQuestionTimeLeft(null);
        setActiveResume(null);
        setView('RUNNING');
    };

    const handleOptionSelect = (option: string) => {
        if (!activeTest) return;
        hapticSelection();
        const questionId = activeTest.questions[currentQuestionIdx].id;
        const updated = { ...userAnswersRef.current, [questionId]: option };
        userAnswersRef.current = updated;
        setUserAnswers(updated);
    };

    const buildAnswerMap = useCallback((base?: Record<string, string | null>) => {
        const map = { ...(base || userAnswersRef.current) };
        if (activeTest) {
            activeTest.questions.forEach(q => {
                if (!(q.id in map)) {
                    map[q.id] = null;
                }
            });
        }
        return map;
    }, [activeTest]);

    const submitAssessmentWithMap = useCallback(async (answersMap: Record<string, string | null>) => {
        if (!activeTest || submitting) return;
        hapticImpact(ImpactStyle.Heavy);
        setSubmitting(true);
        try {
            let result: AttemptResponse | DriveAssessmentSubmitResponse;
            if (isDriveAssessment && driveId && driveStage) {
                result = await api.submitDriveAssessment(driveId, driveStage, activeTest.attempt_id, {
                    user_answers: answersMap,
                    time_taken_seconds: elapsedTime
                });
                setDriveResult(result as DriveAssessmentSubmitResponse);
            } else {
                result = await api.submitAssessment(activeTest.attempt_id, {
                    user_answers: answersMap,
                    time_taken_seconds: elapsedTime
                });
            }
            setTestResults(result as AttemptResponse);
            setView('COMPLETED');
            toast.success('Assessment submitted successfully!');
            if (!isDriveAssessment) {
                fetchData(); // Refresh dashboard
            }
        } catch (error) {
            console.error('Failed to submit assessment:', error);
            toast.error('Failed to submit assessment');
        } finally {
            setSubmitting(false);
        }
    }, [activeTest, elapsedTime, fetchData, hapticImpact, submitting, isDriveAssessment, driveId, driveStage]);

    const handleSubmitTest = async () => {
        if (!activeTest) return;
        const answersMap = buildAnswerMap();
        await submitAssessmentWithMap(answersMap);
    };

    const handleQuestionTimeout = useCallback(() => {
        if (!activeTest) return;
        const currentQ = activeTest.questions[currentQuestionIdx];
        const base = { ...userAnswersRef.current };
        if (!(currentQ.id in base)) {
            base[currentQ.id] = null;
            userAnswersRef.current = base;
            setUserAnswers(base);
        }

        if (currentQuestionIdx >= activeTest.total_questions - 1) {
            const answersMap = buildAnswerMap(base);
            submitAssessmentWithMap(answersMap);
            return;
        }

        setCurrentQuestionIdx(prev => Math.min(activeTest.total_questions - 1, prev + 1));
    }, [activeTest, buildAnswerMap, currentQuestionIdx, submitAssessmentWithMap]);

    useEffect(() => {
        if (questionTimerRef.current) {
            clearInterval(questionTimerRef.current);
            questionTimerRef.current = null;
        }

        if (view !== 'RUNNING' || !activeTest) {
            setQuestionTimeLeft(null);
            return;
        }

        const currentQ = activeTest.questions[currentQuestionIdx];
        if (!currentQ?.time_limit_seconds) {
            setQuestionTimeLeft(null);
            return;
        }

        const questionId = currentQ.id;
        const saved = timeLeftByQuestionRef.current[questionId];
        const initial = typeof saved === 'number' ? saved : currentQ.time_limit_seconds;
        timeLeftByQuestionRef.current[questionId] = initial;
        setQuestionTimeLeft(initial);
        questionTimerRef.current = setInterval(() => {
            setQuestionTimeLeft(prev => {
                if (prev === null) return null;
                if (prev <= 1) {
                    if (questionTimerRef.current) {
                        clearInterval(questionTimerRef.current);
                        questionTimerRef.current = null;
                    }
                    timeLeftByQuestionRef.current[questionId] = 0;
                    handleQuestionTimeout();
                    return 0;
                }
                const next = prev - 1;
                timeLeftByQuestionRef.current[questionId] = next;
                return next;
            });
        }, 1000);

        return () => {
            if (questionTimerRef.current) {
                clearInterval(questionTimerRef.current);
                questionTimerRef.current = null;
            }
        };
    }, [view, activeTest, currentQuestionIdx, handleQuestionTimeout]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const loadAttemptDetail = async (attemptId: string) => {
        setDetailLoading(true);
        try {
            const detail = await api.getAttemptDetail(attemptId);
            setAttemptDetail(detail);
        } catch (error) {
            console.error('Failed to load attempt details:', error);
            toast.error('Failed to load detailed results');
        } finally {
            setDetailLoading(false);
        }
    };

    const autoSaveAnswers = useCallback(async () => {
        if (!activeTest || autoSaving) return;
        setAutoSaving(true);
        try {
            await api.autoSaveAssessment(activeTest.attempt_id, {
                user_answers: userAnswersRef.current,
            });
        } catch (error) {
            // Silent fail, autosave retries on next change/interval
        } finally {
            setAutoSaving(false);
        }
    }, [activeTest, autoSaving]);

    useEffect(() => {
        if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        if (view !== 'RUNNING' || !activeTest) return;
        autoSaveRef.current = setTimeout(() => {
            autoSaveAnswers();
        }, 700);
        return () => {
            if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
        };
    }, [userAnswers, view, activeTest, autoSaveAnswers]);

    useEffect(() => {
        if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
        if (view !== 'RUNNING' || !activeTest) return;
        autoSaveIntervalRef.current = setInterval(() => {
            autoSaveAnswers();
        }, 10000);
        return () => {
            if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
        };
    }, [view, activeTest, autoSaveAnswers]);

    useEffect(() => {
        if (!activeTest || view !== 'RUNNING') return;
        if (activeTest.questions.length === 0) return;
        const answers = userAnswersRef.current || {};
        const firstUnanswered = activeTest.questions.findIndex((q) => !answers[q.id]);
        if (firstUnanswered >= 0) {
            setCurrentQuestionIdx(firstUnanswered);
            return;
        }
        if (activeTest.questions.length === 0) return;
        if (currentQuestionIdx < 0) {
            setCurrentQuestionIdx(0);
            return;
        }
        if (currentQuestionIdx >= activeTest.questions.length) {
            setCurrentQuestionIdx(activeTest.questions.length - 1);
        }
    }, [activeTest, currentQuestionIdx, view, userAnswers]);

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

        const isResumeOnly = mode === 'RESUME_ONLY';
        const modeLabel = mode === 'RESUME_ONLY' ? 'Resume-Only' : mode === 'TEST' ? 'Timed Test' : 'Practice';

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
                        {activeResume && (
                            <div className="card border-emerald-500/30 bg-emerald-500/5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 rounded-sm bg-emerald-500/20 text-emerald-300">
                                        <Lightning size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-chivo font-bold uppercase tracking-widest text-emerald-300">Active Session</h3>
                                        <p className="text-[10px] text-slate-500 font-mono">
                                            {activeResume.total_questions} questions · {activeResume.mode}
                                        </p>
                                        <p className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">
                                            Started {new Date(activeResume.started_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    <button onClick={handleResumeTest} className="btn-primary w-full">Resume Session</button>
                                    <button
                                        onClick={async () => {
                                            if (!activeResume?.attempt_id) return;
                                            if (!confirm('Discard this session? This will remove saved progress.')) return;
                                            try {
                                                await api.discardAttempt(activeResume.attempt_id);
                                                setActiveResume(null);
                                                toast.success('Session discarded.');
                                            } catch (error) {
                                                const message = error instanceof Error ? error.message : null;
                                                toast.error(message || 'Failed to discard session');
                                            }
                                        }}
                                        className="btn-secondary w-full"
                                    >
                                        Discard Session
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="card">
                            <h3 className="text-xs font-chivo font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-800 pb-2">Configuration</h3>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        value={mode}
                                        onChange={(e) => setMode(e.target.value as 'PRACTICE' | 'TEST' | 'RESUME_ONLY')}
                                        className="input-modern h-10"
                                    >
                                        <option value="PRACTICE">Practice</option>
                                        <option value="TEST">Test (Timed)</option>
                                        <option value="RESUME_ONLY">Resume-Only (Timed)</option>
                                    </select>
                                    <select
                                        value={difficultyFilter}
                                        onChange={(e) => setDifficultyFilter(e.target.value)}
                                        className="input-modern h-10"
                                    >
                                        <option value="">All Difficulty</option>
                                        <option value="EASY">Easy</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HARD">Hard</option>
                                    </select>
                                </div>
                                <select
                                    value={questionCount}
                                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                                    className="input-modern h-10"
                                >
                                    {[5, 10, 15, 20, 25].map(n => (
                                        <option key={n} value={n}>{n} Questions</option>
                                    ))}
                                </select>
                                {mode !== 'PRACTICE' && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-slate-500">
                                            <span>Resume Questions</span>
                                            <span className="text-slate-300">{resumeQuestionCount}/{questionCount}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={mode === 'RESUME_ONLY' ? questionCount : 0}
                                            max={questionCount}
                                            value={resumeQuestionCount}
                                            onChange={(e) => setResumeQuestionCount(Number(e.target.value))}
                                            disabled={mode === 'RESUME_ONLY'}
                                            className="w-full accent-emerald-400"
                                        />
                                        <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
                                            {mode === 'RESUME_ONLY'
                                                ? 'All questions generated from your resume.'
                                                : '0 = bank only, max = resume-only.'}
                                        </p>
                                    </div>
                                )}
                                {mode !== 'PRACTICE' && (
                                    <div className="rounded-sm border border-slate-800/60 bg-slate-950/40 p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Resume Skills</p>
                                            {resumeAnalysis && (
                                                <span className="text-[9px] text-slate-400 font-mono">Score {Math.round(resumeAnalysis.resume_score)}</span>
                                            )}
                                        </div>
                                        {resumeSkillLoading ? (
                                            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Scanning resume…</p>
                                        ) : resumeSkills.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {resumeSkills.slice(0, 18).map((skill) => (
                                                    <span
                                                        key={skill}
                                                        className="px-2 py-0.5 rounded-sm text-[9px] font-mono uppercase tracking-widest bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                                {resumeSkills.length > 18 && (
                                                    <span className="px-2 py-0.5 rounded-sm text-[9px] font-mono uppercase tracking-widest bg-slate-800 text-slate-400 border border-slate-700">
                                                        +{resumeSkills.length - 18} more
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                                                    No extracted skills yet.
                                                </p>
                                                <button
                                                    onClick={handleRunResumeAnalysis}
                                                    disabled={resumeAnalyzing}
                                                    className="btn-secondary h-8 px-3 text-[10px] uppercase tracking-widest"
                                                >
                                                    {resumeAnalyzing ? 'Analyzing…' : 'Run Analysis'}
                                                </button>
                                            </div>
                                        )}

                                        <div className="mt-3 border-t border-slate-800/60 pt-3">
                                            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">Resume Projects</p>
                                            {resumeSkillLoading ? (
                                                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Scanning projects…</p>
                                            ) : resumeProjects.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {resumeProjects.slice(0, 10).map((project) => (
                                                        <span
                                                            key={project}
                                                            className="px-2 py-0.5 rounded-sm text-[9px] font-mono uppercase tracking-widest bg-blue-500/10 text-blue-300 border border-blue-500/20"
                                                        >
                                                            {project}
                                                        </span>
                                                    ))}
                                                    {resumeProjects.length > 10 && (
                                                        <span className="px-2 py-0.5 rounded-sm text-[9px] font-mono uppercase tracking-widest bg-slate-800 text-slate-400 border border-slate-700">
                                                            +{resumeProjects.length - 10} more
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                                                    No project titles detected yet.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="card bg-gradient-to-br from-blue-900/40 to-slate-900/60 border-blue-800/20 group relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="font-chivo font-bold text-lg uppercase tracking-wider mb-2 text-blue-300">Fast Assessment</h3>
                                <p className="text-slate-400 text-xs mb-6 leading-relaxed font-inter">
                                    {mode === 'RESUME_ONLY'
                                        ? `${questionCount} resume-derived questions.`
                                        : `${questionCount} randomized questions across all categories.`} Mode: {modeLabel}.
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
                                    { id: 'LOGICAL', label: 'Logical' },
                                    { id: 'VERBAL', label: 'Verbal' },
                                    { id: 'TECHNICAL', label: 'Technical' },
                                    { id: 'DATA_INTERPRETATION', label: 'Data Interpretation' }
                                ].map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleStartTest(cat.id)}
                                        disabled={isResumeOnly}
                                        title={isResumeOnly ? 'Resume-only ignores category filters' : 'Start module'}
                                        className={`w-full group p-3 border rounded-sm flex items-center justify-between transition-all active:scale-[0.98] btn-ripple ${isResumeOnly ? 'bg-slate-950/30 border-slate-900/60 text-slate-600 cursor-not-allowed' : 'bg-slate-950/50 hover:bg-slate-800/80 border-slate-800/40'}`}
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
        if (questionsLoading) {
            return (
                <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-300">
                    <div className="card p-6 text-center">
                        <p className="text-slate-400 text-sm font-mono uppercase tracking-widest">Loading Questions</p>
                        <div className="mt-4 h-1 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                            <div className="h-full w-1/3 bg-gradient-to-r from-blue-600 to-emerald-500 animate-pulse" />
                        </div>
                    </div>
                    <Skeleton variant="card" className="h-64" />
                </div>
            );
        }
        if (!activeTest) return null;

        const currentQ = activeTest.questions[currentQuestionIdx];
        if (!currentQ) {
            return (
                <div className="max-w-2xl mx-auto card text-center py-10">
                    <p className="text-slate-400 text-sm">No questions available for this session.</p>
                    <button
                        onClick={() => setView('DASHBOARD')}
                        className="btn-secondary mt-4"
                    >
                        Back to Dashboard
                    </button>
                </div>
            );
        }
        const isTimedSession = activeTest.mode !== 'PRACTICE';
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
                        {questionTimeLeft !== null && (
                            <div className="flex items-center gap-1.5 text-amber-400 text-sm md:text-lg font-mono tracking-tighter">
                                <Clock weight="bold" className="text-amber-500/40" size={isMobile ? 14 : 18} />
                                {formatTime(questionTimeLeft)}
                            </div>
                        )}
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
                        <div className="flex flex-wrap items-center gap-2 mb-4 md:mb-6">
                            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-sm text-[8px] md:text-[9px] font-mono border border-slate-700 uppercase tracking-wider">
                                Sector: {currentQ.category.replace('_', ' ')}
                            </span>
                            {currentQ.sub_topic && (
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-sm text-[8px] md:text-[9px] font-mono border border-slate-700 uppercase tracking-wider">
                                    Topic: {currentQ.sub_topic}
                                </span>
                            )}
                            {currentQ.difficulty && (
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-sm text-[8px] md:text-[9px] font-mono border border-slate-700 uppercase tracking-wider">
                                    Level: {currentQ.difficulty}
                                </span>
                            )}
                            {typeof currentQ.marks === 'number' && (
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-sm text-[8px] md:text-[9px] font-mono border border-slate-700 uppercase tracking-wider">
                                    Marks: {currentQ.marks}
                                </span>
                            )}
                            {currentQ.time_limit_seconds && (
                                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-sm text-[8px] md:text-[9px] font-mono border border-slate-700 uppercase tracking-wider">
                                    Time: {formatTime(currentQ.time_limit_seconds)}
                                </span>
                            )}
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
                        disabled={currentQuestionIdx === 0 || isTimedSession}
                        onClick={() => { hapticImpact(); setCurrentQuestionIdx(prev => prev - 1); }}
                        className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isTimedSession ? 'Prev disabled for timed sessions' : 'Previous'}
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

        const timeTaken = testResults.time_taken_seconds ?? elapsedTime;
        const isDrive = isDriveAssessment && driveStage;
        const drivePassed = isDrive ? driveResult?.passed : null;
        const driveOutcomeText = drivePassed === false ? 'Assessment Failed' : 'Assessment Passed';
        const iconClasses = drivePassed === false
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';

        return (
            <div className="max-w-xl mx-auto space-y-8 animate-in zoom-in duration-500">
                <div className="text-center space-y-4">
                    <div className={`w-20 h-20 rounded-sm flex items-center justify-center mx-auto border ${iconClasses}`}>
                        <CheckCircle size={40} weight="duotone" />
                    </div>
                    <h1 className="text-2xl font-chivo font-bold text-slate-100 uppercase tracking-tighter">
                        {isDrive ? driveOutcomeText : 'Session.Result.Success'}
                    </h1>
                    <p className="text-slate-500 text-[10px] font-mono uppercase tracking-[0.2em]">
                        {isDrive ? 'Drive assessment completed' : 'Data migration to profile complete'}
                    </p>
                </div>

                <div className="card bg-slate-900/40 p-10 border-slate-800 shadow-2xl">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="text-center space-y-1">
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Accuracy</p>
                            <p className="text-5xl font-mono font-bold text-gradient">{testResults.score}%</p>
                        </div>
                        <div className="text-center space-y-1 border-l border-slate-800">
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Telemetry</p>
                            <p className="text-3xl font-mono font-bold text-slate-300 pt-2">{formatTime(timeTaken)}</p>
                        </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-slate-800 text-center">
                        <p className="text-xs font-mono text-slate-400 italic">
                            {isDrive
                                ? (drivePassed === false ? "// DRIVE_STAGE_FAILED" : "// DRIVE_STAGE_CLEARED")
                                : testResults.score >= 80 ? "// OPTIMAL_PERFORMANCE_DETECTED" :
                                    testResults.score >= 60 ? "// COMPETENT_SKILLS_ALIGNED" :
                                        "// ADDITIONAL_TRAINING_REQUISITIONED"}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="card p-4 text-center">
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Total</p>
                        <p className="text-2xl font-mono font-bold text-slate-200">{testResults.total_questions}</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Correct</p>
                        <p className="text-2xl font-mono font-bold text-emerald-400">{testResults.correct_answers ?? 0}</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Wrong</p>
                        <p className="text-2xl font-mono font-bold text-red-400">{testResults.wrong_answers ?? 0}</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Skipped</p>
                        <p className="text-2xl font-mono font-bold text-amber-300">{testResults.skipped ?? 0}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                            setView('REVIEW');
                            if (testResults?.id) {
                                loadAttemptDetail(testResults.id);
                            }
                        }}
                        className="btn-secondary w-full py-4 text-xs tracking-widest font-bold btn-ripple"
                    >
                        View Detailed Answers
                    </button>
                    <button
                        onClick={() => setView('DASHBOARD')}
                        className="btn-secondary w-full py-4 text-xs tracking-widest font-bold btn-ripple"
                    >
                        Terminal Dashboard
                    </button>
                    {!isDriveAssessment && (
                        <button
                            onClick={() => handleStartTest(activeTest?.questions[0].category)}
                            className="btn-primary w-full py-4 text-xs tracking-widest font-bold btn-ripple flex items-center justify-center gap-2"
                        >
                            Recycle Training
                            <ArrowsCounterClockwise weight="bold" />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderReview = () => {
        if (detailLoading) {
            return (
                <div className="space-y-4">
                    <Skeleton variant="card" className="h-24" />
                    <Skeleton variant="card" className="h-64" />
                </div>
            );
        }

        if (!attemptDetail) {
            return (
                <div className="card text-center py-10">
                    <p className="text-slate-500 text-sm">No detailed results available.</p>
                    <button
                        onClick={() => setView('COMPLETED')}
                        className="btn-secondary mt-4"
                    >
                        Back to Summary
                    </button>
                </div>
            );
        }

        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
                <div className="card p-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-chivo font-bold uppercase tracking-wider text-slate-100">Detailed Answers</h2>
                        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                            {attemptDetail.correct_answers} correct · {attemptDetail.wrong_answers} wrong · {attemptDetail.skipped} skipped
                        </p>
                    </div>
                    <button
                        onClick={() => setView('COMPLETED')}
                        className="btn-secondary h-9 px-3"
                    >
                        Back
                    </button>
                </div>

                <div className="space-y-3">
                    {attemptDetail.detailed_answers.map((ans, idx) => (
                        <div key={`${ans.id}-${idx}`} className="card p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-mono text-slate-500">Q{idx + 1} · {ans.category.replace('_', ' ')}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-sm ${ans.is_correct ? 'bg-emerald-500/20 text-emerald-300' : (ans.selected_option ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300')}`}>
                                    {ans.is_correct ? 'Correct' : (ans.selected_option ? 'Wrong' : 'Skipped')}
                                </span>
                            </div>
                            <p className="text-sm text-slate-100 mb-3">{ans.question_text}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                {Object.entries(ans.options).map(([key, value]) => {
                                    const isCorrect = ans.correct_option === key;
                                    const isSelected = ans.selected_option === key;
                                    return (
                                        <div
                                            key={key}
                                            className={`p-2 rounded-sm border ${isCorrect ? 'border-emerald-500/40 bg-emerald-500/10' : isSelected ? 'border-red-500/40 bg-red-500/10' : 'border-slate-800 bg-slate-900/40'}`}
                                        >
                                            <span className="font-mono text-slate-400 mr-2">{key}.</span>
                                            <span className="text-slate-300">{value}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            {ans.explanation && (
                                <div className="mt-3 text-xs text-slate-400">
                                    <span className="text-slate-500 font-mono uppercase tracking-widest mr-2">Explanation</span>
                                    {ans.explanation}
                                </div>
                            )}
                            {typeof ans.marks === 'number' && (
                                <div className="mt-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                                    Marks: {ans.marks}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (isDriveAssessment && view === 'DASHBOARD') {
        if (loading) {
            return (
                <div className="space-y-4">
                    <Skeleton variant="card" className="h-20" />
                    <Skeleton variant="card" className="h-64" />
                </div>
            );
        }

        const passThreshold = drivePassPercentage ?? (
            driveStage === 'APTITUDE'
                ? driveInfo?.aptitude_pass_percentage
                : driveInfo?.technical_pass_percentage
        );

        return (
            <div className="max-w-3xl mx-auto py-6 space-y-4">
                <div className="scanlines opacity-[0.03]" />
                <div className="card space-y-2">
                    <h1 className="font-chivo font-bold text-xl uppercase tracking-tight">Drive Assessment</h1>
                    <p className="text-xs text-slate-500">
                        {driveInfo ? `${driveInfo.company_name} — ${driveInfo.job_title}` : 'Loading drive info...'}
                    </p>
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase font-mono text-slate-400">
                        <span className="px-2 py-1 rounded-sm border border-slate-800">Stage: {driveStage}</span>
                        {typeof passThreshold === 'number' && (
                            <span className="px-2 py-1 rounded-sm border border-slate-800">Pass: {passThreshold}%</span>
                        )}
                    </div>
                </div>

                <div className="card">
                    {activeResume ? (
                        <button onClick={handleResumeTest} className="btn-primary w-full h-12 flex items-center justify-center gap-2 uppercase tracking-widest">
                            Resume Assessment
                        </button>
                    ) : (
                        <button onClick={() => handleStartTest()} className="btn-primary w-full h-12 flex items-center justify-center gap-2 uppercase tracking-widest">
                            Start Assessment
                        </button>
                    )}
                </div>
            </div>
        );
    }

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
                {view === 'REVIEW' && renderReview()}
            </div>
        </div>
    );
}
