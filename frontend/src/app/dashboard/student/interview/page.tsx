'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Microphone, MicrophoneSlash, ChatCircleDots, Lightning, Users, Briefcase,
    CaretRight, Check, X, ArrowLeft, Clock, Star, ChartLine, Trophy,
    Play, Stop, PaperPlaneTilt, Spinner, Brain, Target, Lightbulb
} from '@phosphor-icons/react';
import { useCapacitor } from '@/components/CapacitorProvider';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { api, InterviewType, InterviewMode, DifficultyLevel, InterviewSessionSummary, AnswerEvaluationResponse } from '@/lib/api';
import Skeleton from '@/components/Skeleton';

// Type definitions for interview state
type ViewState = 'setup' | 'session' | 'results' | 'history';

interface InterviewConfig {
    interview_type: InterviewType;
    mode: InterviewMode;
    difficulty: DifficultyLevel;
    target_role: string;
    target_company: string;
}

interface SessionState {
    sessionId: string;
    questionNumber: number;
    questionText: string;
    questionsRemaining: number;
    isLastQuestion: boolean;
    isSubmitting: boolean;
    currentAnswer: string;
    lastEvaluation: AnswerEvaluationResponse['evaluation'] | null;
    showFeedback: boolean;
}

interface ResultsState {
    sessionId: string;
    overallScore: number;
    technicalScore: number | null;
    communicationScore: number | null;
    confidenceScore: number | null;
    feedbackSummary: string | null;
    improvementAreas: string[] | null;
    questionsAnswered: number;
}

// Interview Type Card Component
function TypeCard({
    icon: Icon,
    title,
    description,
    selected,
    onClick,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
    selected: boolean;
    onClick: () => void;
}) {
    const { hapticImpact } = useCapacitor();
    return (
        <div
            onClick={() => { hapticImpact(); onClick(); }}
            className={`card cursor-pointer transition-all duration-300 btn-ripple ${selected
                    ? 'border-purple-500 bg-gradient-to-br from-purple-900/30 to-slate-900'
                    : 'hover:border-slate-600'
                }`}
        >
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${selected ? 'bg-purple-600' : 'bg-slate-700'}`}>
                    <Icon size={24} weight="duotone" className="text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-white">{title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{description}</p>
                </div>
                {selected && (
                    <div className="p-1 bg-purple-600 rounded-full">
                        <Check size={16} className="text-white" />
                    </div>
                )}
            </div>
        </div>
    );
}

// Setup View Component
function SetupView({
    config,
    setConfig,
    onStart,
    isLoading,
}: {
    config: InterviewConfig;
    setConfig: React.Dispatch<React.SetStateAction<InterviewConfig>>;
    onStart: () => void;
    isLoading: boolean;
}) {
    const { hapticImpact } = useCapacitor();
    const { isSupported: speechSupported } = useSpeechRecognition();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider">AI Mock Interview</h1>
                <p className="text-slate-400 mt-2">Practice with personalized questions based on your resume</p>
            </div>

            {/* Interview Type Selection */}
            <div className="space-y-3">
                <h2 className="text-lg font-medium text-slate-300">Select Interview Type</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <TypeCard
                        icon={Users}
                        title="HR Interview"
                        description="Behavioral questions, motivation, career goals"
                        selected={config.interview_type === 'HR'}
                        onClick={() => setConfig(c => ({ ...c, interview_type: 'HR' }))}
                    />
                    <TypeCard
                        icon={Brain}
                        title="Technical Interview"
                        description="Skills, projects, problem-solving"
                        selected={config.interview_type === 'TECHNICAL'}
                        onClick={() => setConfig(c => ({ ...c, interview_type: 'TECHNICAL' }))}
                    />
                    <TypeCard
                        icon={ChatCircleDots}
                        title="Behavioral Interview"
                        description="STAR method, past experiences"
                        selected={config.interview_type === 'BEHAVIORAL'}
                        onClick={() => setConfig(c => ({ ...c, interview_type: 'BEHAVIORAL' }))}
                    />
                    <TypeCard
                        icon={Lightbulb}
                        title="Case Study"
                        description="Analytical thinking, problem solving"
                        selected={config.interview_type === 'CASE_STUDY'}
                        onClick={() => setConfig(c => ({ ...c, interview_type: 'CASE_STUDY' }))}
                    />
                </div>
            </div>

            {/* Mode Selection */}
            <div className="space-y-3">
                <h2 className="text-lg font-medium text-slate-300">Input Mode</h2>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => { hapticImpact(); setConfig(c => ({ ...c, mode: 'TEXT' })); }}
                        className={`card p-4 flex items-center justify-center gap-3 transition-all btn-ripple ${config.mode === 'TEXT' ? 'border-purple-500 bg-purple-900/20' : 'hover:border-slate-600'
                            }`}
                    >
                        <ChatCircleDots size={24} weight={config.mode === 'TEXT' ? 'fill' : 'regular'} />
                        <span className="font-medium">Text</span>
                    </button>
                    <button
                        onClick={() => { hapticImpact(); setConfig(c => ({ ...c, mode: 'VOICE' })); }}
                        disabled={!speechSupported}
                        className={`card p-4 flex items-center justify-center gap-3 transition-all btn-ripple ${config.mode === 'VOICE' ? 'border-purple-500 bg-purple-900/20' : 'hover:border-slate-600'
                            } ${!speechSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Microphone size={24} weight={config.mode === 'VOICE' ? 'fill' : 'regular'} />
                        <span className="font-medium">Voice</span>
                        {!speechSupported && <span className="text-xs text-slate-500">(Unavailable)</span>}
                    </button>
                </div>
            </div>

            {/* Difficulty Selection */}
            <div className="space-y-3">
                <h2 className="text-lg font-medium text-slate-300">Difficulty</h2>
                <div className="grid grid-cols-3 gap-3">
                    {(['EASY', 'MEDIUM', 'HARD'] as DifficultyLevel[]).map(level => (
                        <button
                            key={level}
                            onClick={() => { hapticImpact(); setConfig(c => ({ ...c, difficulty: level })); }}
                            className={`card p-3 text-center transition-all btn-ripple ${config.difficulty === level ? 'border-purple-500 bg-purple-900/20' : 'hover:border-slate-600'
                                }`}
                        >
                            <span className={`font-medium ${level === 'EASY' ? 'text-green-400' :
                                    level === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400'
                                }`}>{level}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Optional: Target Role/Company */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Target Role (Optional)</label>
                    <input
                        type="text"
                        value={config.target_role}
                        onChange={e => setConfig(c => ({ ...c, target_role: e.target.value }))}
                        placeholder="e.g., Software Engineer"
                        className="input-field w-full"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Target Company (Optional)</label>
                    <input
                        type="text"
                        value={config.target_company}
                        onChange={e => setConfig(c => ({ ...c, target_company: e.target.value }))}
                        placeholder="e.g., Google, TCS"
                        className="input-field w-full"
                    />
                </div>
            </div>

            {/* Start Button */}
            <button
                onClick={() => { hapticImpact(); onStart(); }}
                disabled={isLoading}
                className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-3 btn-ripple"
            >
                {isLoading ? (
                    <>
                        <Spinner size={24} className="animate-spin" />
                        Starting Interview...
                    </>
                ) : (
                    <>
                        <Play size={24} weight="fill" />
                        Start Interview
                    </>
                )}
            </button>
        </div>
    );
}

// Session View Component
function SessionView({
    session,
    config,
    onSubmit,
    onEnd,
    onNext,
}: {
    session: SessionState;
    config: InterviewConfig;
    onSubmit: (answer: string) => void;
    onEnd: () => void;
    onNext: () => void;
}) {
    const { hapticImpact } = useCapacitor();
    const [answer, setAnswer] = useState('');
    const {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        isSupported: voiceSupported,
    } = useSpeechRecognition();

    // Sync voice transcript with answer
    useEffect(() => {
        if (config.mode === 'VOICE' && transcript) {
            setAnswer(transcript);
        }
    }, [transcript, config.mode]);

    const handleSubmit = () => {
        if (!answer.trim() || session.isSubmitting) return;
        hapticImpact();
        onSubmit(answer.trim());
        setAnswer('');
        resetTranscript();
    };

    const toggleVoice = async () => {
        hapticImpact();
        if (isListening) {
            await stopListening();
        } else {
            await startListening();
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header with progress */}
            <div className="flex items-center justify-between">
                <button onClick={() => { hapticImpact(); onEnd(); }} className="btn-secondary text-sm flex items-center gap-2">
                    <X size={18} />
                    End Interview
                </button>
                <div className="text-right">
                    <span className="text-purple-400 font-mono font-bold">Q{session.questionNumber} / 10</span>
                    <div className="h-1.5 w-24 bg-slate-700 rounded-full mt-1 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500"
                            style={{ width: `${session.questionNumber * 10}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Question Card */}
            <div className="card p-6 border-purple-800/30 bg-gradient-to-br from-purple-900/10 to-slate-900/40">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-purple-600 shrink-0">
                        <Brain size={24} className="text-white" />
                    </div>
                    <div>
                        <p className="text-xs text-purple-400 uppercase tracking-wider mb-2">Question {session.questionNumber}</p>
                        <p className="text-lg text-white leading-relaxed">{session.questionText}</p>
                    </div>
                </div>
            </div>

            {/* Feedback from previous answer */}
            {session.showFeedback && session.lastEvaluation && (
                <div className="card p-4 border-blue-800/30 bg-gradient-to-br from-blue-900/10 to-slate-900/40 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-blue-400">Previous Answer Feedback</span>
                        <span className="text-2xl font-bold text-blue-400">{session.lastEvaluation.overall_score}/10</span>
                    </div>
                    <p className="text-sm text-slate-300">{session.lastEvaluation.feedback}</p>
                    <div className="flex gap-4 mt-3 text-xs">
                        {session.lastEvaluation.strengths.slice(0, 2).map((s, i) => (
                            <span key={i} className="text-green-400">✓ {s}</span>
                        ))}
                    </div>
                    <button
                        onClick={() => { hapticImpact(); onNext(); }}
                        className="btn-secondary mt-3 text-sm"
                    >
                        Continue to Question
                    </button>
                </div>
            )}

            {/* Answer Input */}
            {!session.showFeedback && (
                <div className="space-y-4">
                    {/* Text Area */}
                    <div className="relative">
                        <textarea
                            value={config.mode === 'VOICE' ? (transcript + interimTranscript) : answer}
                            onChange={e => setAnswer(e.target.value)}
                            placeholder={config.mode === 'VOICE' ? 'Click the microphone to speak...' : 'Type your answer here...'}
                            rows={6}
                            disabled={session.isSubmitting || (config.mode === 'VOICE' && isListening)}
                            className="input-field w-full resize-none"
                        />

                        {/* Voice indicator */}
                        {config.mode === 'VOICE' && isListening && (
                            <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-xs text-red-400">Listening...</span>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        {config.mode === 'VOICE' && voiceSupported && (
                            <button
                                onClick={toggleVoice}
                                className={`p-4 rounded-full transition-all ${isListening
                                        ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                                        : 'bg-purple-600 hover:bg-purple-700'
                                    }`}
                            >
                                {isListening ? (
                                    <MicrophoneSlash size={24} className="text-white" />
                                ) : (
                                    <Microphone size={24} className="text-white" />
                                )}
                            </button>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={!(config.mode === 'VOICE' ? transcript : answer).trim() || session.isSubmitting}
                            className="btn-primary flex-1 py-4 flex items-center justify-center gap-3 btn-ripple"
                        >
                            {session.isSubmitting ? (
                                <>
                                    <Spinner size={20} className="animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <PaperPlaneTilt size={20} weight="fill" />
                                    Submit Answer
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Results View Component
function ResultsView({
    results,
    onNewInterview,
    onViewHistory,
}: {
    results: ResultsState;
    onNewInterview: () => void;
    onViewHistory: () => void;
}) {
    const { hapticImpact } = useCapacitor();

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-green-400';
        if (score >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getReadiness = (score: number) => {
        if (score >= 80) return { label: 'Exceptional', color: 'text-green-400', icon: Trophy };
        if (score >= 70) return { label: 'Interview Ready', color: 'text-blue-400', icon: Check };
        if (score >= 50) return { label: 'Needs Practice', color: 'text-yellow-400', icon: Target };
        return { label: 'Keep Practicing', color: 'text-red-400', icon: Lightbulb };
    };

    const readiness = getReadiness(results.overallScore);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full mb-4">
                    <readiness.icon size={20} className={readiness.color} weight="fill" />
                    <span className={`font-medium ${readiness.color}`}>{readiness.label}</span>
                </div>
                <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider">Interview Complete!</h1>
                <p className="text-slate-400 mt-2">Here&apos;s your performance summary</p>
            </div>

            {/* Overall Score */}
            <div className="card p-6 text-center border-purple-800/30 bg-gradient-to-br from-purple-900/10 to-slate-900/40">
                <div className="relative inline-block">
                    <svg className="w-32 h-32" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#334155" strokeWidth="8" />
                        <circle
                            cx="50" cy="50" r="40"
                            fill="none"
                            stroke="url(#score-gradient)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${results.overallScore * 2.51} 251`}
                            transform="rotate(-90 50 50)"
                        />
                        <defs>
                            <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#a855f7" />
                                <stop offset="100%" stopColor="#3b82f6" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-3xl font-bold font-mono ${getScoreColor(results.overallScore)}`}>
                            {Math.round(results.overallScore)}%
                        </span>
                    </div>
                </div>
                <p className="text-slate-400 mt-2">Overall Score</p>
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Technical', score: results.technicalScore, icon: Brain },
                    { label: 'Communication', score: results.communicationScore, icon: ChatCircleDots },
                    { label: 'Confidence', score: results.confidenceScore, icon: Star },
                ].map(item => (
                    <div key={item.label} className="card p-4 text-center">
                        <item.icon size={20} className="mx-auto text-slate-400 mb-2" />
                        <p className={`text-xl font-bold font-mono ${item.score ? getScoreColor(item.score) : 'text-slate-500'}`}>
                            {item.score ? `${Math.round(item.score)}%` : '-'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                    </div>
                ))}
            </div>

            {/* Feedback Summary */}
            {results.feedbackSummary && (
                <div className="card p-4">
                    <h3 className="font-medium text-slate-300 mb-2 flex items-center gap-2">
                        <ChartLine size={18} />
                        Summary
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{results.feedbackSummary}</p>
                </div>
            )}

            {/* Improvement Areas */}
            {results.improvementAreas && results.improvementAreas.length > 0 && (
                <div className="card p-4">
                    <h3 className="font-medium text-slate-300 mb-3 flex items-center gap-2">
                        <Target size={18} />
                        Areas to Improve
                    </h3>
                    <ul className="space-y-2">
                        {results.improvementAreas.map((area, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                                <CaretRight size={16} className="text-purple-400 mt-0.5 shrink-0" />
                                <span>{area}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { hapticImpact(); onViewHistory(); }} className="btn-secondary flex items-center justify-center gap-2 btn-ripple">
                    <Clock size={18} />
                    View History
                </button>
                <button onClick={() => { hapticImpact(); onNewInterview(); }} className="btn-primary flex items-center justify-center gap-2 btn-ripple">
                    <Play size={18} weight="fill" />
                    New Interview
                </button>
            </div>
        </div>
    );
}

// History View Component
function HistoryView({
    onBack,
    onSelect,
}: {
    onBack: () => void;
    onSelect: (id: string) => void;
}) {
    const { hapticImpact } = useCapacitor();
    const [sessions, setSessions] = useState<InterviewSessionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ completed_interviews: 0, average_score: 0, best_score: 0 });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [historyData, statsData] = await Promise.all([
                api.getInterviewHistory(1, 20),
                api.getInterviewStats(),
            ]);
            setSessions(historyData.sessions);
            setStats(statsData);
        } catch (e) {
            console.error('Failed to load history:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton variant="card" className="h-24" />
                <Skeleton variant="card" className="h-24" />
                <Skeleton variant="card" className="h-24" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => { hapticImpact(); onBack(); }} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-xl font-chivo font-bold uppercase tracking-wider">Interview History</h1>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="card p-3 text-center">
                    <p className="text-2xl font-bold text-purple-400">{stats.completed_interviews}</p>
                    <p className="text-xs text-slate-500">Completed</p>
                </div>
                <div className="card p-3 text-center">
                    <p className="text-2xl font-bold text-blue-400">{Math.round(stats.average_score)}%</p>
                    <p className="text-xs text-slate-500">Average</p>
                </div>
                <div className="card p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{Math.round(stats.best_score)}%</p>
                    <p className="text-xs text-slate-500">Best</p>
                </div>
            </div>

            {/* Sessions List */}
            {sessions.length === 0 ? (
                <div className="card p-8 text-center">
                    <Clock size={48} className="mx-auto text-slate-600 mb-4" />
                    <p className="text-slate-400">No interviews yet</p>
                    <p className="text-sm text-slate-500 mt-1">Complete your first interview to see history</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => { hapticImpact(); onSelect(session.id); }}
                            className="card p-4 cursor-pointer hover:border-purple-600/50 transition-all btn-ripple"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-white">{session.interview_type} Interview</p>
                                    {session.target_role && (
                                        <p className="text-sm text-slate-400">{session.target_role}</p>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1">
                                        {new Date(session.started_at).toLocaleDateString()} • {session.questions_answered} questions
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xl font-bold font-mono ${session.overall_score >= 70 ? 'text-green-400' :
                                            session.overall_score >= 50 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>
                                        {Math.round(session.overall_score)}%
                                    </p>
                                    <p className={`text-xs ${session.is_complete ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {session.is_complete ? 'Completed' : 'In Progress'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Main Interview Page Component
export default function InterviewPage() {
    const router = useRouter();
    const { hapticImpact } = useCapacitor();

    const [view, setView] = useState<ViewState>('setup');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [config, setConfig] = useState<InterviewConfig>({
        interview_type: 'TECHNICAL',
        mode: 'TEXT',
        difficulty: 'MEDIUM',
        target_role: '',
        target_company: '',
    });

    const [session, setSession] = useState<SessionState>({
        sessionId: '',
        questionNumber: 1,
        questionText: '',
        questionsRemaining: 9,
        isLastQuestion: false,
        isSubmitting: false,
        currentAnswer: '',
        lastEvaluation: null,
        showFeedback: false,
    });

    const [results, setResults] = useState<ResultsState>({
        sessionId: '',
        overallScore: 0,
        technicalScore: null,
        communicationScore: null,
        confidenceScore: null,
        feedbackSummary: null,
        improvementAreas: null,
        questionsAnswered: 0,
    });

    const handleStartInterview = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await api.startInterview({
                interview_type: config.interview_type,
                mode: config.mode,
                difficulty: config.difficulty,
                target_role: config.target_role || undefined,
                target_company: config.target_company || undefined,
            });

            setSession({
                sessionId: response.session_id,
                questionNumber: response.question_number,
                questionText: response.question_text,
                questionsRemaining: response.questions_remaining,
                isLastQuestion: response.is_last_question,
                isSubmitting: false,
                currentAnswer: '',
                lastEvaluation: null,
                showFeedback: false,
            });

            setView('session');
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to start interview';
            setError(errorMessage);
            console.error('Failed to start interview:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitAnswer = async (answer: string) => {
        setSession(s => ({ ...s, isSubmitting: true }));

        try {
            const response = await api.submitInterviewAnswer(session.sessionId, answer);

            if (response.is_complete) {
                // Interview complete, get final results
                await handleCompleteInterview();
            } else {
                // Show feedback and prepare next question
                setSession(s => ({
                    ...s,
                    isSubmitting: false,
                    lastEvaluation: response.evaluation,
                    showFeedback: true,
                    questionNumber: response.question_number || s.questionNumber + 1,
                    questionText: response.next_question || s.questionText,
                    questionsRemaining: response.questions_remaining,
                }));
            }
        } catch (e) {
            console.error('Failed to submit answer:', e);
            setSession(s => ({ ...s, isSubmitting: false }));
        }
    };

    const handleNextQuestion = () => {
        setSession(s => ({ ...s, showFeedback: false }));
    };

    const handleCompleteInterview = async () => {
        try {
            const response = await api.completeInterview(session.sessionId);

            setResults({
                sessionId: response.id,
                overallScore: response.overall_score,
                technicalScore: response.technical_score,
                communicationScore: response.communication_score,
                confidenceScore: response.confidence_score,
                feedbackSummary: response.feedback_summary,
                improvementAreas: response.improvement_areas,
                questionsAnswered: response.conversation.filter(c => c.answer).length,
            });

            setView('results');
        } catch (e) {
            console.error('Failed to complete interview:', e);
        }
    };

    const handleNewInterview = () => {
        setConfig({
            interview_type: 'TECHNICAL',
            mode: 'TEXT',
            difficulty: 'MEDIUM',
            target_role: '',
            target_company: '',
        });
        setSession({
            sessionId: '',
            questionNumber: 1,
            questionText: '',
            questionsRemaining: 9,
            isLastQuestion: false,
            isSubmitting: false,
            currentAnswer: '',
            lastEvaluation: null,
            showFeedback: false,
        });
        setView('setup');
    };

    return (
        <div className="max-w-2xl mx-auto pb-8">
            {error && (
                <div className="mb-4 p-4 bg-red-900/20 border border-red-600/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {view === 'setup' && (
                <SetupView
                    config={config}
                    setConfig={setConfig}
                    onStart={handleStartInterview}
                    isLoading={isLoading}
                />
            )}

            {view === 'session' && (
                <SessionView
                    session={session}
                    config={config}
                    onSubmit={handleSubmitAnswer}
                    onEnd={handleCompleteInterview}
                    onNext={handleNextQuestion}
                />
            )}

            {view === 'results' && (
                <ResultsView
                    results={results}
                    onNewInterview={handleNewInterview}
                    onViewHistory={() => setView('history')}
                />
            )}

            {view === 'history' && (
                <HistoryView
                    onBack={() => setView('setup')}
                    onSelect={(id) => {
                        // Could navigate to detail view
                        console.log('Selected session:', id);
                    }}
                />
            )}
        </div>
    );
}
