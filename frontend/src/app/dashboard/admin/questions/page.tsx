'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Brain,
    CheckCircle,
    XCircle,
    CircleNotch,
    ListBullets,
    ChartPie,
    Lightning,
    X,
} from '@phosphor-icons/react';
import { api, AptitudeQuestion, QuestionAuditLog, QuestionAuditLogListResponse, QuestionVersion, QuestionVersionListResponse } from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';
import AuditLogModal from '@/components/AuditLogModal';
import QuestionVersionModal from '@/components/QuestionVersionModal';
import Portal from '@/components/Portal';
import { toast } from 'sonner';

const CATEGORIES = [
    { value: 'QUANTITATIVE', label: 'Quantitative' },
    { value: 'LOGICAL', label: 'Logical' },
    { value: 'VERBAL', label: 'Verbal' },
    { value: 'TECHNICAL', label: 'Technical' },
    { value: 'DATA_INTERPRETATION', label: 'Data Interpretation' },
];

const DIFFICULTIES = [
    { value: 'EASY', label: 'Easy', color: 'text-green-400 bg-green-500/20' },
    { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-400 bg-yellow-500/20' },
    { value: 'HARD', label: 'Hard', color: 'text-red-400 bg-red-500/20' },
];

export default function AdminQuestionApprovalsPage() {
    const { hapticImpact } = useCapacitor();
    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState<AptitudeQuestion[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    const [categoryFilter, setCategoryFilter] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [approvalFilter, setApprovalFilter] = useState('PENDING');

    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditLogs, setAuditLogs] = useState<QuestionAuditLog[]>([]);
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [versionLoading, setVersionLoading] = useState(false);
    const [versions, setVersions] = useState<QuestionVersion[]>([]);
    const [versionQuestion, setVersionQuestion] = useState<AptitudeQuestion | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiForm, setAiForm] = useState({
        count: 5,
        category: 'QUANTITATIVE',
        difficulty: 'MEDIUM',
        sub_topic: '',
        role_tag: '',
        marks: 1,
        time_limit_seconds: '',
        status: 'ACTIVE',
        instructions: '',
    });

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getAptitudeQuestions(
                categoryFilter || undefined,
                difficultyFilter || undefined,
                page,
                statusFilter || undefined,
                true,
                approvalFilter === 'ALL' ? undefined : approvalFilter
            );
            setQuestions(data.questions);
            setTotal(data.total);
        } catch (error) {
            console.error('Failed to fetch questions:', error);
            toast.error('Failed to load questions');
        } finally {
            setLoading(false);
        }
    }, [categoryFilter, difficultyFilter, statusFilter, approvalFilter, page]);

    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    useEffect(() => {
        if (showAuditModal || showVersionModal || showAIModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showAuditModal, showVersionModal, showAIModal]);

    const handleApprove = async (id: string) => {
        hapticImpact();
        setActionLoading(id);
        try {
            await api.approveQuestion(id);
            toast.success('Question approved');
            fetchQuestions();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to approve question');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        hapticImpact();
        if (!confirm('Reject this question?')) return;
        setActionLoading(id);
        try {
            await api.rejectQuestion(id);
            toast.success('Question rejected');
            fetchQuestions();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to reject question');
        } finally {
            setActionLoading(null);
        }
    };

    const loadAuditLogs = async () => {
        setAuditLoading(true);
        try {
            const data: QuestionAuditLogListResponse = await api.getQuestionAuditLogs({ page: 1, page_size: 50 });
            setAuditLogs(data.logs || []);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load audit logs');
        } finally {
            setAuditLoading(false);
        }
    };

    const resetAIForm = () => {
        setAiForm({
            count: 5,
            category: 'QUANTITATIVE',
            difficulty: 'MEDIUM',
            sub_topic: '',
            role_tag: '',
            marks: 1,
            time_limit_seconds: '',
            status: 'ACTIVE',
            instructions: '',
        });
    };

    const openAIGenerate = () => {
        hapticImpact();
        resetAIForm();
        setShowAIModal(true);
    };

    const handleAIGenerate = async () => {
        hapticImpact();
        if (!aiForm.count || aiForm.count < 1 || aiForm.count > 10) {
            toast.error('Count must be between 1 and 10');
            return;
        }
        if (aiForm.time_limit_seconds) {
            const limit = Number(aiForm.time_limit_seconds);
            if (Number.isNaN(limit) || limit < 10 || limit > 3600) {
                toast.error('Time limit must be between 10 and 3600 seconds');
                return;
            }
        }

        setAiLoading(true);
        try {
            const response = await api.generateAptitudeQuestions({
                count: aiForm.count,
                category: aiForm.category,
                difficulty: aiForm.difficulty,
                sub_topic: aiForm.sub_topic || undefined,
                role_tag: aiForm.role_tag || undefined,
                marks: Number(aiForm.marks) || 1,
                time_limit_seconds: aiForm.time_limit_seconds ? Number(aiForm.time_limit_seconds) : undefined,
                status: aiForm.status,
                instructions: aiForm.instructions || undefined,
            });
            toast.success(`Generated ${response.created_count} questions`);
            if (response.errors?.length) {
                toast.error(response.errors[0]);
            }
            setShowAIModal(false);
            resetAIForm();
            fetchQuestions();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to generate questions');
        } finally {
            setAiLoading(false);
        }
    };

    const openAuditLogs = () => {
        hapticImpact();
        setShowAuditModal(true);
        loadAuditLogs();
    };

    const loadVersions = async (questionId: string) => {
        setVersionLoading(true);
        try {
            const data: QuestionVersionListResponse = await api.getQuestionVersions(questionId, 1, 50);
            setVersions(data.versions || []);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load versions');
        } finally {
            setVersionLoading(false);
        }
    };

    const openVersions = (q: AptitudeQuestion) => {
        hapticImpact();
        setVersionQuestion(q);
        setShowVersionModal(true);
        loadVersions(q.id);
    };

    const getDifficultyStyle = (diff: string) => {
        const d = DIFFICULTIES.find(x => x.value === diff);
        return d?.color || 'text-slate-400 bg-slate-500/20';
    };

    const getApprovalStyle = (status?: string) => {
        switch (status) {
            case 'DRAFT': return 'text-slate-300 bg-slate-700/70';
            case 'APPROVED': return 'text-green-300 bg-green-500/20';
            case 'PENDING': return 'text-yellow-300 bg-yellow-500/20';
            case 'REJECTED': return 'text-red-300 bg-red-500/20';
            default: return 'text-slate-300 bg-slate-700';
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton variant="card" className="h-24" />
                <Skeleton variant="card" className="h-64" />
            </div>
        );
    }

    const totalPages = Math.max(1, Math.ceil(total / 20));

    return (
        <div className="space-y-4 pb-20">
            <div className="card">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-sm bg-emerald-600 flex items-center justify-center">
                            <Brain size={22} weight="bold" className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-chivo font-bold text-lg uppercase tracking-wide">Question Approvals</h1>
                            <p className="text-xs text-slate-500">{total} questions</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={openAuditLogs} className="btn-secondary h-10 px-3 flex items-center gap-1">
                            <ChartPie size={16} /> Audit
                        </button>
                        <button onClick={openAIGenerate} className="btn-secondary h-10 px-3 flex items-center gap-1">
                            <Lightning size={16} /> AI Generate
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <select
                    value={categoryFilter}
                    onChange={(e) => { hapticImpact(); setCategoryFilter(e.target.value); setPage(1); }}
                    className="input-modern h-10"
                >
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select
                    value={difficultyFilter}
                    onChange={(e) => { hapticImpact(); setDifficultyFilter(e.target.value); setPage(1); }}
                    className="input-modern h-10"
                >
                    <option value="">All Levels</option>
                    {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => { hapticImpact(); setStatusFilter(e.target.value); setPage(1); }}
                    className="input-modern h-10"
                >
                    <option value="">All Status</option>
                    {['DRAFT', 'ACTIVE', 'ARCHIVED'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                    value={approvalFilter}
                    onChange={(e) => { hapticImpact(); setApprovalFilter(e.target.value); setPage(1); }}
                    className="input-modern h-10"
                >
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="DRAFT">DRAFT (Not Submitted)</option>
                    <option value="ALL">ALL</option>
                </select>
            </div>

            <div className="space-y-3">
                {questions.length === 0 ? (
                    <div className="card text-center py-12">
                        <ListBullets size={48} className="mx-auto text-slate-600 mb-3" />
                        <p className="text-slate-400">No questions found</p>
                    </div>
                ) : (
                    questions.map((q) => (
                        <div key={q.id} className="card">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium line-clamp-2">{q.question_text}</p>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className="text-xs px-2 py-0.5 bg-slate-700 rounded-sm">{q.category.replace('_', ' ')}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-sm ${getDifficultyStyle(q.difficulty)}`}>{q.difficulty}</span>
                                        {q.sub_topic && (
                                            <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded-sm">{q.sub_topic}</span>
                                        )}
                                        {q.status && (
                                            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-sm">{q.status}</span>
                                        )}
                                        {q.approval_status && (
                                            <span className={`text-xs px-2 py-0.5 rounded-sm ${getApprovalStyle(q.approval_status)}`}>
                                                {q.approval_status}
                                            </span>
                                        )}
                                        {typeof q.marks === 'number' && (
                                            <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-300 rounded-sm">{q.marks} mark</span>
                                        )}
                                        {q.time_limit_seconds && (
                                            <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded-sm">{q.time_limit_seconds}s</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => openVersions(q)}
                                        className="w-10 h-10 bg-slate-700 rounded-sm flex items-center justify-center hover:bg-slate-600 active:scale-95"
                                        title="Versions"
                                    >
                                        <ListBullets size={16} />
                                    </button>
                                    {q.approval_status !== 'APPROVED' && (
                                        <button
                                            onClick={() => handleApprove(q.id)}
                                            disabled={actionLoading === q.id}
                                            className="w-10 h-10 bg-emerald-500/20 text-emerald-300 rounded-sm flex items-center justify-center hover:bg-emerald-500/30 active:scale-95"
                                            title="Approve"
                                        >
                                            {actionLoading === q.id ? <CircleNotch size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                        </button>
                                    )}
                                    {q.approval_status !== 'REJECTED' && (
                                        <button
                                            onClick={() => handleReject(q.id)}
                                            disabled={actionLoading === q.id}
                                            className="w-10 h-10 bg-red-500/20 text-red-400 rounded-sm flex items-center justify-center hover:bg-red-500/30 active:scale-95"
                                            title="Reject"
                                        >
                                            {actionLoading === q.id ? <CircleNotch size={16} className="animate-spin" /> : <XCircle size={16} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => { hapticImpact(); setPage(p => Math.max(1, p - 1)); }}
                        className="btn-secondary"
                        disabled={page <= 1}
                    >
                        Prev
                    </button>
                    <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                    <button
                        onClick={() => { hapticImpact(); setPage(p => Math.min(totalPages, p + 1)); }}
                        className="btn-secondary"
                        disabled={page >= totalPages}
                    >
                        Next
                    </button>
                </div>
            )}

            {showAIModal && (
                <Portal>
                    <div className="fixed inset-0 z-[100] bg-black/80 overflow-y-auto overscroll-contain">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div className="card w-full max-w-lg rounded-2xl animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-bold text-lg">AI Generate Questions</h2>
                                    <button onClick={() => { hapticImpact(); setShowAIModal(false); resetAIForm(); }} className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Count (1-10)</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={aiForm.count}
                                                onChange={(e) => setAiForm({ ...aiForm, count: Number(e.target.value) })}
                                                className="input-modern h-10"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Status</label>
                                            <select
                                                value={aiForm.status}
                                                onChange={(e) => setAiForm({ ...aiForm, status: e.target.value })}
                                                className="input-modern h-10"
                                            >
                                                <option value="DRAFT">Draft</option>
                                                <option value="ACTIVE">Active</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Category</label>
                                            <select
                                                value={aiForm.category}
                                                onChange={(e) => setAiForm({ ...aiForm, category: e.target.value })}
                                                className="input-modern h-10"
                                            >
                                                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Difficulty</label>
                                            <select
                                                value={aiForm.difficulty}
                                                onChange={(e) => setAiForm({ ...aiForm, difficulty: e.target.value })}
                                                className="input-modern h-10"
                                            >
                                                {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Sub-topic</label>
                                            <input
                                                type="text"
                                                value={aiForm.sub_topic}
                                                onChange={(e) => setAiForm({ ...aiForm, sub_topic: e.target.value })}
                                                className="input-modern h-10"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Role Tag</label>
                                            <input
                                                type="text"
                                                value={aiForm.role_tag}
                                                onChange={(e) => setAiForm({ ...aiForm, role_tag: e.target.value })}
                                                className="input-modern h-10"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Marks</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={aiForm.marks}
                                                onChange={(e) => setAiForm({ ...aiForm, marks: Number(e.target.value) })}
                                                className="input-modern h-10"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Time Limit (sec)</label>
                                            <input
                                                type="number"
                                                min={10}
                                                max={3600}
                                                value={aiForm.time_limit_seconds}
                                                onChange={(e) => setAiForm({ ...aiForm, time_limit_seconds: e.target.value })}
                                                className="input-modern h-10"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 uppercase mb-1 block">Extra Instructions</label>
                                        <textarea
                                            value={aiForm.instructions}
                                            onChange={(e) => setAiForm({ ...aiForm, instructions: e.target.value })}
                                            className="input-modern h-24 resize-none"
                                        />
                                    </div>

                                    <button onClick={handleAIGenerate} disabled={aiLoading} className="btn-primary w-full h-12 flex items-center justify-center gap-2">
                                        {aiLoading ? <CircleNotch size={18} className="animate-spin" /> : <Lightning size={18} />}
                                        Generate Questions
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            <AuditLogModal
                open={showAuditModal}
                onClose={() => { hapticImpact(); setShowAuditModal(false); }}
                logs={auditLogs}
                loading={auditLoading}
                title="Question Audit Logs"
            />

            <QuestionVersionModal
                open={showVersionModal}
                onClose={() => { hapticImpact(); setShowVersionModal(false); }}
                versions={versions}
                loading={versionLoading}
                title="Version History"
                questionTitle={versionQuestion?.question_text}
            />
        </div>
    );
}
