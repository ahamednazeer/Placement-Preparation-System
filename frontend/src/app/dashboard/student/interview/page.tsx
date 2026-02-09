'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Microphone, MicrophoneSlash, ChatCircleDots, Lightning, Users, Briefcase,
    CaretRight, Check, X, ArrowLeft, Clock, Star, ChartLine, Trophy,
    Play, Stop, PaperPlaneTilt, Spinner, Brain, Target, Lightbulb
} from '@phosphor-icons/react';
import { useCapacitor } from '@/components/CapacitorProvider';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { api, InterviewType, InterviewMode, DifficultyLevel, InterviewSessionSummary, AnswerEvaluationResponse, InterviewAnswerItem } from '@/lib/api';
import Skeleton from '@/components/Skeleton';

// Type definitions for interview state
type ViewState = 'setup' | 'session' | 'results' | 'history' | 'review';

interface InterviewConfig {
    interview_type: InterviewType;
    mode: InterviewMode;
    difficulty: DifficultyLevel;
    target_role: string;
    target_company: string;
    voiceInterviewer: boolean;
    autoAdvance: boolean;
    strictTurnTaking: boolean;
    fullScreen: boolean;
    questionTimeLimit: number;
    pushToTalk: boolean;
    autoStartMic: boolean;
    ambientSound: boolean;
    voiceStyle: 'DEFAULT' | 'FEMININE' | 'MASCULINE';
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
    history: { role: 'interviewer' | 'candidate'; text: string; timestamp: string }[];
    pendingQuestion: string | null;
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

const interviewPersonas: Record<InterviewType, { name: string; title: string; accent: string }> = {
    TECHNICAL: { name: 'NOVA', title: 'Technical Interviewer', accent: 'text-blue-400' },
    HR: { name: 'ARIA', title: 'HR Specialist', accent: 'text-emerald-400' },
    BEHAVIORAL: { name: 'LEX', title: 'Behavioral Coach', accent: 'text-yellow-400' },
    CASE_STUDY: { name: 'KAI', title: 'Case Interviewer', accent: 'text-purple-400' },
};

function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.max(0, seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}
interface ReviewState {
    sessionId: string;
    answers: InterviewAnswerItem[];
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
    onViewHistory,
}: {
    config: InterviewConfig;
    setConfig: React.Dispatch<React.SetStateAction<InterviewConfig>>;
    onStart: () => void;
    isLoading: boolean;
    onViewHistory: () => void;
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
            <div className="flex justify-center">
                <button onClick={() => { hapticImpact(); onViewHistory(); }} className="btn-secondary flex items-center justify-center gap-2 btn-ripple">
                    <Clock size={18} />
                    View History
                </button>
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

            {/* Real Interview Mode */}
            <div className="space-y-3">
                <h2 className="text-lg font-medium text-slate-300">Real Interview Mode</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                        onClick={() => { hapticImpact(); setConfig(c => ({ ...c, voiceInterviewer: !c.voiceInterviewer })); }}
                        className={`card p-3 flex items-center justify-between transition-all btn-ripple ${config.voiceInterviewer ? 'border-blue-500 bg-blue-900/10' : 'hover:border-slate-600'
                            }`}
                    >
                        <span className="text-sm">AI Voice Interviewer</span>
                        <span className={`text-xs ${config.voiceInterviewer ? 'text-blue-400' : 'text-slate-500'}`}>
                            {config.voiceInterviewer ? 'ON' : 'OFF'}
                        </span>
                    </button>
                    <button
                        onClick={() => { hapticImpact(); setConfig(c => ({ ...c, strictTurnTaking: !c.strictTurnTaking })); }}
                        className={`card p-3 flex items-center justify-between transition-all btn-ripple ${config.strictTurnTaking ? 'border-emerald-500 bg-emerald-900/10' : 'hover:border-slate-600'
                            }`}
                    >
                        <span className="text-sm">Strict Turn-Taking</span>
                        <span className={`text-xs ${config.strictTurnTaking ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {config.strictTurnTaking ? 'ON' : 'OFF'}
                        </span>
                    </button>
                    <button
                        onClick={() => { hapticImpact(); setConfig(c => ({ ...c, autoAdvance: !c.autoAdvance })); }}
                        className={`card p-3 flex items-center justify-between transition-all btn-ripple ${config.autoAdvance ? 'border-purple-500 bg-purple-900/10' : 'hover:border-slate-600'
                            }`}
                    >
                        <span className="text-sm">Auto-Advance</span>
                        <span className={`text-xs ${config.autoAdvance ? 'text-purple-400' : 'text-slate-500'}`}>
                            {config.autoAdvance ? 'ON' : 'OFF'}
                        </span>
                    </button>
                    <button
                        onClick={() => { hapticImpact(); setConfig(c => ({ ...c, fullScreen: !c.fullScreen })); }}
                        className={`card p-3 flex items-center justify-between transition-all btn-ripple ${config.fullScreen ? 'border-yellow-500 bg-yellow-900/10' : 'hover:border-slate-600'
                            }`}
                    >
                        <span className="text-sm">Focus Mode</span>
                        <span className={`text-xs ${config.fullScreen ? 'text-yellow-400' : 'text-slate-500'}`}>
                            {config.fullScreen ? 'ON' : 'OFF'}
                        </span>
                    </button>
                    <button
                        onClick={() => { hapticImpact(); setConfig(c => ({ ...c, pushToTalk: !c.pushToTalk })); }}
                        className={`card p-3 flex items-center justify-between transition-all btn-ripple ${config.pushToTalk ? 'border-slate-500 bg-slate-800/60' : 'hover:border-slate-600'
                            }`}
                    >
                        <span className="text-sm">Push-to-Talk</span>
                        <span className={`text-xs ${config.pushToTalk ? 'text-slate-300' : 'text-slate-500'}`}>
                            {config.pushToTalk ? 'ON' : 'OFF'}
                        </span>
                    </button>
                    <button
                        onClick={() => { hapticImpact(); setConfig(c => ({ ...c, autoStartMic: !c.autoStartMic })); }}
                        disabled={config.pushToTalk}
                        className={`card p-3 flex items-center justify-between transition-all btn-ripple ${config.autoStartMic ? 'border-cyan-500 bg-cyan-900/10' : 'hover:border-slate-600'
                            } ${config.pushToTalk ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                        <span className="text-sm">Auto Mic After Question</span>
                        <span className={`text-xs ${config.autoStartMic ? 'text-cyan-300' : 'text-slate-500'}`}>
                            {config.autoStartMic ? 'ON' : 'OFF'}
                        </span>
                    </button>
                    <button
                        onClick={() => { hapticImpact(); setConfig(c => ({ ...c, ambientSound: !c.ambientSound })); }}
                        className={`card p-3 flex items-center justify-between transition-all btn-ripple ${config.ambientSound ? 'border-slate-500 bg-slate-800/60' : 'hover:border-slate-600'
                            }`}
                    >
                        <span className="text-sm">Room Tone</span>
                        <span className={`text-xs ${config.ambientSound ? 'text-slate-300' : 'text-slate-500'}`}>
                            {config.ambientSound ? 'ON' : 'OFF'}
                        </span>
                    </button>
                </div>
                <div className="card p-3 border-slate-700/60">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-300">Time per question</span>
                        <span className="text-xs text-slate-500 font-mono">{config.questionTimeLimit}s</span>
                    </div>
                    <input
                        type="range"
                        min={60}
                        max={240}
                        step={15}
                        value={config.questionTimeLimit}
                        onChange={(e) => setConfig(c => ({ ...c, questionTimeLimit: Number(e.target.value) }))}
                        className="w-full accent-purple-500"
                    />
                </div>
                <div className="card p-3 border-slate-700/60">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-300">Interviewer voice</span>
                        <span className="text-xs text-slate-500">{config.voiceStyle}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {(['DEFAULT', 'FEMININE', 'MASCULINE'] as const).map(style => (
                            <button
                                key={style}
                                onClick={() => { hapticImpact(); setConfig(c => ({ ...c, voiceStyle: style })); }}
                                className={`card p-2 text-xs uppercase tracking-wider ${config.voiceStyle === style ? 'border-purple-500 text-purple-300' : 'text-slate-500 hover:border-slate-600'}`}
                            >
                                {style === 'DEFAULT' ? 'Default' : style === 'FEMININE' ? 'Soft' : 'Deep'}
                            </button>
                        ))}
                    </div>
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
    const [countdown, setCountdown] = useState(3);
    const [preInterviewDone, setPreInterviewDone] = useState(false);
    const [isInterviewerSpeaking, setIsInterviewerSpeaking] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [canAnswer, setCanAnswer] = useState(!config.strictTurnTaking);
    const [timeLeft, setTimeLeft] = useState(config.questionTimeLimit);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const answerRef = useRef('');
    const isListeningRef = useRef(false);
    const ambientRef = useRef<{ ctx: AudioContext | null; source: AudioBufferSourceNode | null; gain: GainNode | null }>({
        ctx: null,
        source: null,
        gain: null,
    });
    const [ambientBlocked, setAmbientBlocked] = useState(false);
    const persona = interviewPersonas[config.interview_type];
    const {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        isSupported: voiceSupported,
        isProcessing,
    } = useSpeechRecognition();

    // Sync voice transcript with answer
    useEffect(() => {
        if (config.mode === 'VOICE' && transcript) {
            setAnswer(transcript);
        }
    }, [transcript, config.mode]);

    useEffect(() => {
        answerRef.current = answer;
    }, [answer]);

    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    const pickVoice = (voices: SpeechSynthesisVoice[]) => {
        if (!voices.length) return null;
        const lowerStyle = config.voiceStyle;
        const byLang = voices.filter(v => v.lang?.toLowerCase().startsWith('en'));
        const candidates = byLang.length ? byLang : voices;
        const matchByHint = (hints: string[]) =>
            candidates.find(v => hints.some(h => v.name?.toLowerCase().includes(h)));
        if (lowerStyle === 'FEMININE') {
            return matchByHint(['female', 'samantha', 'victoria', 'zira', 'karen']) || candidates[0];
        }
        if (lowerStyle === 'MASCULINE') {
            return matchByHint(['male', 'daniel', 'alex', 'fred', 'tom', 'david']) || candidates[0];
        }
        return candidates[0];
    };

    const speakQuestion = useCallback(async (text: string) => {
        if (!config.voiceInterviewer) {
            return;
        }

        // Use Capacitor TTS on native platforms (Android/iOS)
        if (Capacitor.isNativePlatform()) {
            try {
                setIsInterviewerSpeaking(true);
                await TextToSpeech.speak({
                    text: text,
                    lang: 'en-US',
                    rate: 1.0,
                    pitch: config.voiceStyle === 'FEMININE' ? 1.1 : 0.95,
                    volume: 1.0,
                    category: 'ambient',
                });
                setIsInterviewerSpeaking(false);
            } catch (e) {
                console.warn('Native TTS failed:', e);
                setIsInterviewerSpeaking(false);
            }
            return;
        }

        // Web: Use Web Speech API
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            return;
        }
        return new Promise<void>((resolve) => {
            try {
                const synth = window.speechSynthesis;
                if (synth.speaking) synth.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                const voices = synth.getVoices();
                const selected = pickVoice(voices);
                if (selected) utterance.voice = selected;
                utterance.rate = 1;
                utterance.pitch = config.voiceStyle === 'FEMININE' ? 1.1 : 0.95;
                utterance.onend = () => {
                    setIsInterviewerSpeaking(false);
                    resolve();
                };
                utterance.onerror = () => {
                    setIsInterviewerSpeaking(false);
                    resolve();
                };
                setIsInterviewerSpeaking(true);
                synth.speak(utterance);
            } catch {
                setIsInterviewerSpeaking(false);
                resolve();
            }
        });
    }, [config.voiceInterviewer, config.voiceStyle]);

    const stopAmbientSound = useCallback(() => {
        const current = ambientRef.current;
        if (current.source) {
            try {
                current.source.stop();
            } catch { }
        }
        if (current.ctx) {
            try {
                current.ctx.close();
            } catch { }
        }
        ambientRef.current = { ctx: null, source: null, gain: null };
    }, []);

    const startAmbientSound = useCallback(async () => {
        if (!config.ambientSound || typeof window === 'undefined') return;
        if (ambientRef.current.ctx) return;
        const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
            data[i] = (Math.random() * 2 - 1) * 0.04;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0.012;
        source.connect(gain);
        gain.connect(ctx.destination);
        try {
            await ctx.resume();
            source.start();
            ambientRef.current = { ctx, source, gain };
            setAmbientBlocked(false);
        } catch {
            setAmbientBlocked(true);
            stopAmbientSound();
        }
    }, [config.ambientSound, stopAmbientSound]);

    const handleSubmit = async (force: boolean = false) => {
        if (session.isSubmitting) return;
        const finalAnswer = (answerRef.current || '').trim();
        if (!finalAnswer && !force) return;
        hapticImpact();
        if (isListening) {
            await stopListening();
        }
        onSubmit(finalAnswer || 'No response provided.');
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

    // Pre-interview countdown
    useEffect(() => {
        if (preInterviewDone) return;
        if (countdown <= 0) {
            setPreInterviewDone(true);
            return;
        }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown, preInterviewDone]);

    // Reset question timer on new question
    useEffect(() => {
        if (!preInterviewDone || session.showFeedback) return;
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(config.questionTimeLimit);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    handleSubmit(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [session.questionText, session.showFeedback, preInterviewDone, config.questionTimeLimit]);

    // Interrogator speaking / turn-taking
    useEffect(() => {
        if (!preInterviewDone || session.showFeedback) return;
        let cancelled = false;
        const run = async () => {
            setCanAnswer(!config.strictTurnTaking);
            setIsThinking(true);
            const thinkDelay = 700 + Math.floor(Math.random() * 900);
            await new Promise(res => setTimeout(res, thinkDelay));
            if (cancelled) return;
            setIsThinking(false);
            if (config.voiceInterviewer) {
                await speakQuestion(session.questionText);
                if (cancelled) return;
            }
            setCanAnswer(true);
            if (config.mode === 'VOICE' && config.autoStartMic && !config.pushToTalk) {
                if (!isListeningRef.current) {
                    await startListening();
                }
            }
        };
        run();
        return () => {
            cancelled = true;
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, [session.questionText, session.showFeedback, preInterviewDone, config.voiceInterviewer, config.strictTurnTaking, config.mode, config.autoStartMic, config.pushToTalk, speakQuestion, startListening]);

    useEffect(() => {
        if (preInterviewDone && config.ambientSound) {
            startAmbientSound();
        } else {
            stopAmbientSound();
        }
        return () => {
            stopAmbientSound();
        };
    }, [preInterviewDone, config.ambientSound, startAmbientSound, stopAmbientSound]);

    // Auto-advance after feedback
    useEffect(() => {
        if (!session.showFeedback || !config.autoAdvance) return;
        if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = setTimeout(() => onNext(), 2000);
        return () => {
            if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
        };
    }, [session.showFeedback, config.autoAdvance, onNext]);

    const inputDisabled = session.isSubmitting
        || isInterviewerSpeaking
        || isThinking
        || !preInterviewDone
        || (config.strictTurnTaking && !canAnswer);

    // Push-to-talk hotkey
    useEffect(() => {
        if (config.mode !== 'VOICE' || !config.pushToTalk) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code !== 'Space') return;
            const active = document.activeElement;
            if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return;
            if (inputDisabled) return;
            e.preventDefault();
            if (!isListeningRef.current) {
                startListening();
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code !== 'Space') return;
            const active = document.activeElement;
            if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return;
            e.preventDefault();
            if (isListeningRef.current) {
                stopListening();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [config.mode, config.pushToTalk, inputDisabled, startListening, stopListening]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header with progress */}
            <div className="flex items-center justify-between">
                <button onClick={() => { hapticImpact(); onEnd(); }} className="btn-secondary text-sm flex items-center gap-2">
                    <X size={18} />
                    End Interview
                </button>
                <div className="text-right">
                    <div className="flex items-center justify-end gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 text-red-400">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            LIVE
                        </span>
                        <span className="font-mono">{formatTime(timeLeft)}</span>
                    </div>
                    <span className="text-purple-400 font-mono font-bold">Q{session.questionNumber} / 10</span>
                    <div className="h-1.5 w-24 bg-slate-700 rounded-full mt-1 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-600 to-blue-500 transition-all duration-500"
                            style={{ width: `${session.questionNumber * 10}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Interviewer Persona */}
            <div className="card p-4 border-blue-800/30 bg-gradient-to-br from-blue-900/10 to-slate-900/40">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                        <Microphone size={22} className="text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <p className={`text-sm uppercase tracking-wider ${persona?.accent}`}>{persona?.name}</p>
                        <p className="text-xs text-slate-400">{persona?.title} • {config.interview_type}</p>
                    </div>
                    <div className="text-xs text-slate-400">
                        {config.voiceInterviewer ? 'Voice interviewer' : 'Text interviewer'}
                    </div>
                </div>
            </div>

            {/* Conversation Feed */}
            <div className="card p-4 space-y-3 max-h-40 overflow-y-auto">
                {session.history.slice(-6).map((entry, idx) => (
                    <div key={`${entry.timestamp}-${idx}`} className={`flex ${entry.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${entry.role === 'candidate'
                                ? 'bg-purple-600/20 text-purple-100 border border-purple-600/40'
                                : 'bg-slate-800/80 text-slate-200 border border-slate-700'
                            }`}>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                                {entry.role === 'candidate' ? 'You' : 'Interviewer'}
                            </p>
                            {entry.text}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Spinner size={14} className="animate-spin" />
                        Interviewer is thinking...
                    </div>
                )}
                {isInterviewerSpeaking && (
                    <div className="flex items-center gap-2 text-xs text-blue-400">
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
                        </div>
                        Interviewer speaking...
                    </div>
                )}
                {config.ambientSound && !ambientBlocked && (
                    <div className="text-[10px] text-slate-500">Room tone enabled</div>
                )}
                {config.ambientSound && ambientBlocked && (
                    <button
                        onClick={() => startAmbientSound()}
                        className="text-[10px] text-slate-400 underline"
                    >
                        Tap to enable room tone
                    </button>
                )}
            </div>

            {/* Countdown Overlay */}
            {!preInterviewDone && (
                <div className="card p-10 text-center border-purple-800/30 bg-gradient-to-br from-purple-900/10 to-slate-900/40">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Interview starts in</p>
                    <p className="text-5xl font-bold font-mono text-purple-400 mt-3">{countdown}</p>
                    <p className="text-xs text-slate-500 mt-3">Stay calm. Speak clearly.</p>
                </div>
            )}

            {/* Question Card */}
            {preInterviewDone && !session.showFeedback && (
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
            )}

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
            {!session.showFeedback && preInterviewDone && (
                <div className="space-y-4">
                    {/* Text Area */}
                    <div className="relative">
                        <textarea
                            value={config.mode === 'VOICE' ? (transcript + interimTranscript) : answer}
                            onChange={e => setAnswer(e.target.value)}
                            placeholder={config.mode === 'VOICE' ? 'Click the microphone to speak...' : 'Type your answer here...'}
                            rows={6}
                            disabled={inputDisabled || (config.mode === 'VOICE' && isListening)}
                            className="input-field w-full resize-none"
                        />

                        {/* Voice indicator */}
                        {config.mode === 'VOICE' && (
                            <div className="absolute bottom-3 left-3 flex items-center gap-3">
                                {isListening && (
                                    <>
                                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                        <div className="flex items-end gap-1">
                                            <span className="w-1 h-2 bg-red-400 animate-pulse" />
                                            <span className="w-1 h-4 bg-red-400 animate-pulse [animation-delay:150ms]" />
                                            <span className="w-1 h-3 bg-red-400 animate-pulse [animation-delay:300ms]" />
                                            <span className="w-1 h-5 bg-red-400 animate-pulse [animation-delay:450ms]" />
                                        </div>
                                        <span className="text-xs text-red-400">Interviewer is listening...</span>
                                    </>
                                )}
                                {isProcessing && (
                                    <span className="text-xs text-slate-400">Processing audio...</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 items-center">
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
                        {config.mode === 'VOICE' && config.pushToTalk && (
                            <span className="text-xs text-slate-500">Hold <span className="text-slate-300 font-mono">Space</span> to talk</span>
                        )}

                        <button
                            onClick={() => handleSubmit()}
                            disabled={inputDisabled || !(config.mode === 'VOICE' ? transcript : answer).trim()}
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
    onViewReview,
}: {
    results: ResultsState;
    onNewInterview: () => void;
    onViewHistory: () => void;
    onViewReview: () => void;
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
            <div className="grid grid-cols-3 gap-3">
                <button onClick={() => { hapticImpact(); onViewHistory(); }} className="btn-secondary flex items-center justify-center gap-2 btn-ripple">
                    <Clock size={18} />
                    View History
                </button>
                <button onClick={() => { hapticImpact(); onViewReview(); }} className="btn-secondary flex items-center justify-center gap-2 btn-ripple">
                    <ChartLine size={18} />
                    Answer Review
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
                                    <p className={`text-xs ${session.status === 'COMPLETED'
                                        ? 'text-green-400'
                                        : session.status === 'ABANDONED'
                                            ? 'text-red-400'
                                            : 'text-yellow-400'
                                        }`}>
                                        {session.status === 'COMPLETED'
                                            ? 'Completed'
                                            : session.status === 'ABANDONED'
                                                ? 'Abandoned'
                                                : 'In Progress'}
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

function ReviewView({
    review,
    onBack,
}: {
    review: ReviewState;
    onBack: () => void;
}) {
    const { hapticImpact } = useCapacitor();
    if (!review.answers.length) {
        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center gap-4">
                    <button onClick={() => { hapticImpact(); onBack(); }} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-xl font-chivo font-bold uppercase tracking-wider">Answer Review</h1>
                </div>
                <div className="card p-6 text-center">
                    <p className="text-slate-400">No answers available for this session.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
                <button onClick={() => { hapticImpact(); onBack(); }} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-chivo font-bold uppercase tracking-wider">Answer Review</h1>
                    <p className="text-xs text-slate-500 mt-1">Session {review.sessionId.slice(0, 8)}</p>
                </div>
            </div>

            <div className="space-y-4">
                {review.answers.map(answer => (
                    <div key={answer.id} className="card p-5 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs text-purple-400 uppercase tracking-wider mb-1">Question {answer.question_number}</p>
                                <p className="text-white">{answer.question_text}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold font-mono text-blue-400">{Math.round(answer.overall_score)}%</p>
                                <p className="text-[10px] text-slate-500">Overall</p>
                            </div>
                        </div>

                        <div className="text-sm text-slate-300 bg-slate-900/40 border border-slate-700 rounded-md p-3">
                            {answer.answer_text}
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            {[
                                { label: 'Relevance', value: answer.relevance_score },
                                { label: 'Clarity', value: answer.clarity_score },
                                { label: 'Depth', value: answer.depth_score },
                                { label: 'Confidence', value: answer.confidence_score },
                            ].map(item => (
                                <div key={item.label} className="rounded-md border border-slate-700 bg-slate-900/40 p-2">
                                    <p className="font-mono text-slate-200">{Math.round(item.value)}%</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{item.label}</p>
                                </div>
                            ))}
                        </div>

                        {answer.feedback && (
                            <div className="text-sm text-slate-400">
                                <span className="text-blue-400 font-medium">Feedback:</span> {answer.feedback}
                            </div>
                        )}

                        {(answer.strengths && answer.strengths.length > 0) && (
                            <div className="text-sm text-slate-400">
                                <span className="text-green-400 font-medium">Strengths:</span> {answer.strengths.join(', ')}
                            </div>
                        )}

                        {(answer.improvements && answer.improvements.length > 0) && (
                            <div className="text-sm text-slate-400">
                                <span className="text-amber-400 font-medium">Improvements:</span> {answer.improvements.join(', ')}
                            </div>
                        )}
                    </div>
                ))}
            </div>
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
        voiceInterviewer: true,
        autoAdvance: true,
        strictTurnTaking: true,
        fullScreen: true,
        questionTimeLimit: 120,
        pushToTalk: false,
        autoStartMic: true,
        ambientSound: true,
        voiceStyle: 'DEFAULT',
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
        history: [],
        pendingQuestion: null,
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
    const [review, setReview] = useState<ReviewState>({ sessionId: '', answers: [] });
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewBackView, setReviewBackView] = useState<ViewState>('history');

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
                history: [{
                    role: 'interviewer',
                    text: response.question_text,
                    timestamp: new Date().toISOString(),
                }],
                pendingQuestion: null,
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
                setSession(s => ({
                    ...s,
                    isSubmitting: false,
                    history: [
                        ...s.history,
                        { role: 'candidate', text: answer, timestamp: new Date().toISOString() },
                    ],
                    pendingQuestion: null,
                }));
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
                    history: [
                        ...s.history,
                        { role: 'candidate', text: answer, timestamp: new Date().toISOString() },
                    ],
                    pendingQuestion: response.next_question || null,
                }));
            }
        } catch (e) {
            console.error('Failed to submit answer:', e);
            setSession(s => ({ ...s, isSubmitting: false }));
        }
    };

    const handleNextQuestion = () => {
        setSession(s => ({
            ...s,
            showFeedback: false,
            history: s.pendingQuestion
                ? [
                    ...s.history,
                    { role: 'interviewer', text: s.pendingQuestion, timestamp: new Date().toISOString() },
                ]
                : s.history,
            pendingQuestion: null,
        }));
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

    const handleLoadReview = async (sessionId: string, backView: ViewState) => {
        setReviewLoading(true);
        setError(null);
        try {
            const response = await api.getInterviewAnswers(sessionId);
            setReview({ sessionId: response.session_id, answers: response.answers || [] });
            setReviewBackView(backView);
            setView('review');
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to load answer review';
            setError(errorMessage);
        } finally {
            setReviewLoading(false);
        }
    };

    const handleNewInterview = () => {
        setConfig({
            interview_type: 'TECHNICAL',
            mode: 'TEXT',
            difficulty: 'MEDIUM',
            target_role: '',
            target_company: '',
            voiceInterviewer: true,
            autoAdvance: true,
            strictTurnTaking: true,
            fullScreen: true,
            questionTimeLimit: 120,
            pushToTalk: false,
            autoStartMic: true,
            ambientSound: true,
            voiceStyle: 'DEFAULT',
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
            history: [],
            pendingQuestion: null,
        });
        setView('setup');
    };

    const focusMode = view === 'session' && config.fullScreen;

    return (
        <div className={focusMode ? 'fixed inset-0 z-50 bg-[#0b1020] overflow-y-auto px-4 py-8' : ''}>
            <div className={focusMode ? 'max-w-3xl mx-auto pb-8' : 'max-w-2xl mx-auto pb-8'}>
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
                        onViewHistory={() => setView('history')}
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
                        onViewReview={() => handleLoadReview(results.sessionId, 'results')}
                    />
                )}

                {view === 'history' && (
                    <HistoryView
                        onBack={() => setView('setup')}
                        onSelect={(id) => handleLoadReview(id, 'history')}
                    />
                )}

                {view === 'review' && (
                    reviewLoading ? (
                        <div className="space-y-4">
                            <Skeleton variant="card" className="h-24" />
                            <Skeleton variant="card" className="h-24" />
                            <Skeleton variant="card" className="h-24" />
                        </div>
                    ) : (
                        <ReviewView
                            review={review}
                            onBack={() => setView(reviewBackView)}
                        />
                    )
                )}
            </div>
        </div>
    );
}
