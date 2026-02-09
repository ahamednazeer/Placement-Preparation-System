'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus,
    Trash,
    PencilSimple,
    Upload,
    X,
    CheckCircle,
    CircleNotch,
    MagnifyingGlass,
    Funnel,
    Download,
    Brain,
    ListBullets,
    ChartPie,
    PaperPlaneTilt,
    Lightning,
} from '@phosphor-icons/react';
import {
    api,
    AptitudeQuestion,
    QuestionStatsResponse,
    QuestionAuditLog,
    QuestionAuditLogListResponse,
    QuestionVersion,
    QuestionVersionListResponse
} from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';
import Portal from '@/components/Portal';
import AuditLogModal from '@/components/AuditLogModal';
import QuestionVersionModal from '@/components/QuestionVersionModal';
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

export default function AptitudeManagementPage() {
    const { hapticImpact } = useCapacitor();
    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState<AptitudeQuestion[]>([]);
    const [stats, setStats] = useState<QuestionStatsResponse | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [approvalFilter, setApprovalFilter] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [showVersionModal, setShowVersionModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<AptitudeQuestion | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditLogs, setAuditLogs] = useState<QuestionAuditLog[]>([]);
    const [versionLoading, setVersionLoading] = useState(false);
    const [versions, setVersions] = useState<QuestionVersion[]>([]);
    const [versionQuestion, setVersionQuestion] = useState<AptitudeQuestion | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [sendLoadingId, setSendLoadingId] = useState<string | null>(null);

    const [aiForm, setAiForm] = useState({
        count: 5,
        category: 'QUANTITATIVE',
        difficulty: 'MEDIUM',
        sub_topic: '',
        role_tag: '',
        marks: 1,
        time_limit_seconds: '',
        status: 'DRAFT',
        instructions: '',
    });

    // Form state
    const [formData, setFormData] = useState({
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 'A',
        category: 'QUANTITATIVE',
        sub_topic: '',
        difficulty: 'MEDIUM',
        marks: 1,
        time_limit_seconds: '',
        status: 'DRAFT',
        role_tag: '',
        explanation: '',
    });

    const fetchQuestions = useCallback(async () => {
        try {
            const data = await api.getAptitudeQuestions(
                categoryFilter || undefined,
                difficultyFilter || undefined,
                page,
                statusFilter || undefined,
                true,
                approvalFilter || undefined
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

    const fetchStats = useCallback(async () => {
        try {
            const data = await api.getQuestionStats();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }, []);

    useEffect(() => {
        if (showCreateModal || showUploadModal || showAIModal || showAuditModal || showVersionModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showCreateModal, showUploadModal, showAIModal, showAuditModal, showVersionModal]);

    useEffect(() => {
        fetchQuestions();
        fetchStats();
    }, [fetchQuestions, fetchStats]);

    const resetForm = () => {
        setFormData({
            question_text: '',
            option_a: '',
            option_b: '',
            option_c: '',
            option_d: '',
            correct_option: 'A',
            category: 'QUANTITATIVE',
            sub_topic: '',
            difficulty: 'MEDIUM',
            marks: 1,
            time_limit_seconds: '',
            status: 'DRAFT',
            role_tag: '',
            explanation: '',
        });
        setEditingQuestion(null);
    };

    const openCreate = () => {
        hapticImpact();
        resetForm();
        setShowCreateModal(true);
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
            status: 'DRAFT',
            instructions: '',
        });
    };

    const openAIGenerate = () => {
        hapticImpact();
        resetAIForm();
        setShowAIModal(true);
    };

    const openEdit = (q: AptitudeQuestion) => {
        hapticImpact();
        setEditingQuestion(q);
        setFormData({
            question_text: q.question_text,
            option_a: q.options.A || '',
            option_b: q.options.B || '',
            option_c: q.options.C || '',
            option_d: q.options.D || '',
            correct_option: q.correct_option,
            category: q.category,
            sub_topic: q.sub_topic || '',
            difficulty: q.difficulty,
            marks: q.marks || 1,
            time_limit_seconds: q.time_limit_seconds ? String(q.time_limit_seconds) : '',
            status: q.status || (q.is_active ? 'ACTIVE' : 'DRAFT'),
            role_tag: q.role_tag || '',
            explanation: q.explanation || '',
        });
        setShowCreateModal(true);
    };

    const handleSave = async () => {
        hapticImpact();
        setSaving(true);
        try {
            const data = {
                question_text: formData.question_text,
                options: {
                    A: formData.option_a,
                    B: formData.option_b,
                    C: formData.option_c,
                    D: formData.option_d,
                },
                correct_option: formData.correct_option,
                category: formData.category,
                difficulty: formData.difficulty,
                sub_topic: formData.sub_topic || undefined,
                marks: Number(formData.marks) || 1,
                time_limit_seconds: formData.time_limit_seconds ? Number(formData.time_limit_seconds) : undefined,
                status: formData.status,
                role_tag: formData.role_tag || undefined,
                explanation: formData.explanation || undefined,
            };

            if (editingQuestion) {
                await api.updateQuestion(editingQuestion.id, data);
                if (formData.status === 'ACTIVE') {
                    toast.success('Sent for approval. Status set to DRAFT/PENDING until admin approves.');
                    if (statusFilter === 'ACTIVE') {
                        setStatusFilter('');
                        setPage(1);
                    }
                } else {
                    toast.success('Question updated!');
                }
            } else {
                await api.createQuestion(data);
                toast.success('Question created!');
            }

            setShowCreateModal(false);
            resetForm();
            fetchQuestions();
            fetchStats();
        } catch (error: any) {
            toast.error(error.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
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
            fetchStats();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to generate questions');
        } finally {
            setAiLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        hapticImpact();
        if (!confirm('Delete this question?')) return;
        try {
            await api.deleteQuestion(id);
            toast.success('Question deleted');
            fetchQuestions();
            fetchStats();
        } catch (error: any) {
            toast.error('Failed to delete');
        }
    };

    const handleSendForApproval = async (q: AptitudeQuestion) => {
        if (q.status === 'ARCHIVED') {
            toast.error('Unarchive the question before sending for approval.');
            return;
        }
        hapticImpact();
        if (!confirm('Send this question for admin approval?')) return;
        setSendLoadingId(q.id);
        try {
            await api.updateQuestion(q.id, { status: 'ACTIVE' });
            toast.success('Sent for approval. Status set to DRAFT/PENDING.');
            if (statusFilter === 'ACTIVE') {
                setStatusFilter('');
                setPage(1);
            }
            fetchQuestions();
            fetchStats();
        } catch (error: any) {
            toast.error(error.message || 'Failed to send for approval');
        } finally {
            setSendLoadingId(null);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const isAllSelected = questions.length > 0 && questions.every(q => selectedIds.includes(q.id));

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(prev => prev.filter(id => !questions.some(q => q.id === id)));
        } else {
            const ids = questions.map(q => q.id);
            setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
        }
    };

    const handleBulkActivate = async () => {
        if (selectedIds.length === 0) return;
        hapticImpact();
        if (!confirm(`Set ${selectedIds.length} questions to ACTIVE?`)) return;
        setBulkLoading(true);
        try {
            const results = await Promise.allSettled(
                selectedIds.map(id => api.updateQuestion(id, { status: 'ACTIVE' }))
            );
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed > 0) {
                toast.error(`${failed} updates failed`);
            } else {
                toast.success('Sent for approval. Status set to DRAFT/PENDING until admin approves.');
            }
            if (statusFilter === 'ACTIVE') {
                setStatusFilter('');
                setPage(1);
            }
            setSelectedIds([]);
            fetchQuestions();
            fetchStats();
        } catch (error: any) {
            toast.error(error.message || 'Bulk update failed');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        hapticImpact();
        setUploading(true);
        try {
            const result = await api.bulkUploadQuestions(file);
            toast.success(result.message);
            if (result.errors.length > 0) {
                toast.error(`${result.errors.length} errors occurred`);
            }
            setShowUploadModal(false);
            fetchQuestions();
            fetchStats();
        } catch (error: any) {
            toast.error(error.message || 'Upload failed');
        } finally {
            setUploading(false);
            e.target.value = '';
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

    return (
        <div className="space-y-4 pb-20">
            {/* Header */}
            <div className="card">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-sm bg-purple-600 flex items-center justify-center">
                            <Brain size={22} weight="bold" className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-chivo font-bold text-lg uppercase tracking-wide">Aptitude Questions</h1>
                            <p className="text-xs text-slate-500">{total} total questions</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={openAuditLogs} className="btn-secondary h-10 px-3 flex items-center gap-1">
                            <ChartPie size={16} /> Audit
                        </button>
                        <button onClick={openAIGenerate} className="btn-secondary h-10 px-3 flex items-center gap-1">
                            <Lightning size={16} /> AI Generate
                        </button>
                        <button onClick={() => { hapticImpact(); setShowUploadModal(true); }} className="btn-secondary h-10 px-3 flex items-center gap-1">
                            <Upload size={16} /> CSV
                        </button>
                        <button onClick={openCreate} className="btn-primary h-10 px-3 flex items-center gap-1">
                            <Plus size={16} weight="bold" /> Add
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-3 gap-2">
                    {DIFFICULTIES.map(d => (
                        <div key={d.value} className="card text-center p-3">
                            <p className={`text-2xl font-bold ${d.color.split(' ')[0]}`}>{stats.by_difficulty[d.value] || 0}</p>
                            <p className="text-xs text-slate-500">{d.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-2">
                <select
                    value={categoryFilter}
                    onChange={(e) => { hapticImpact(); setCategoryFilter(e.target.value); setPage(1); }}
                    className="input-modern h-10 flex-1"
                >
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select
                    value={difficultyFilter}
                    onChange={(e) => { hapticImpact(); setDifficultyFilter(e.target.value); setPage(1); }}
                    className="input-modern h-10 flex-1"
                >
                    <option value="">All Levels</option>
                    {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => { hapticImpact(); setStatusFilter(e.target.value); setPage(1); }}
                    className="input-modern h-10 flex-1"
                >
                    <option value="">All Status</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active (Approved)</option>
                    <option value="ARCHIVED">Archived</option>
                </select>
                <select
                    value={approvalFilter}
                    onChange={(e) => { hapticImpact(); setApprovalFilter(e.target.value); setPage(1); }}
                    className="input-modern h-10 flex-1"
                >
                    <option value="">All Approvals</option>
                    <option value="DRAFT">DRAFT (Not Submitted)</option>
                    {['PENDING', 'APPROVED', 'REJECTED'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {selectedIds.length > 0 && (
                <div className="card flex items-center justify-between">
                    <div className="text-xs text-slate-400">
                        {selectedIds.length} selected
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleBulkActivate}
                            disabled={bulkLoading}
                            className="btn-primary h-9 px-3 flex items-center gap-2"
                        >
                            {bulkLoading ? <CircleNotch size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                            Send for Approval
                        </button>
                        <button
                            onClick={() => setSelectedIds([])}
                            className="btn-secondary h-9 px-3"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="accent-blue-500"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                    />
                    Select all (page)
                </label>
                <span>Total selected: {selectedIds.length}</span>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
                {questions.length === 0 ? (
                    <div className="card text-center py-12">
                        <ListBullets size={48} className="mx-auto text-slate-600 mb-3" />
                        <p className="text-slate-400">No questions found</p>
                        <button onClick={openCreate} className="btn-primary mt-4">Add First Question</button>
                    </div>
                ) : (
                    questions.map((q, i) => (
                        <div key={q.id} className="card">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <input
                                        type="checkbox"
                                        className="mt-1 accent-blue-500"
                                        checked={selectedIds.includes(q.id)}
                                        onChange={() => toggleSelect(q.id)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium line-clamp-2">{q.question_text}</p>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            <span className="text-xs px-2 py-0.5 bg-slate-700 rounded-sm">{q.category.replace('_', ' ')}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-sm ${getDifficultyStyle(q.difficulty)}`}>{q.difficulty}</span>
                                            {q.approval_status && (
                                                <span className={`text-xs px-2 py-0.5 rounded-sm ${getApprovalStyle(q.approval_status)}`}>
                                                    {q.approval_status}
                                                </span>
                                            )}
                                        {q.status && (
                                            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-sm">
                                                {q.approval_status === 'PENDING' ? 'APPROVAL PENDING' : q.status}
                                            </span>
                                        )}
                                            {q.sub_topic && (
                                                <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded-sm">{q.sub_topic}</span>
                                            )}
                                            <span className="text-xs text-green-400">Answer: {q.correct_option}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {q.approval_status === 'DRAFT' && (
                                        <button
                                            onClick={() => handleSendForApproval(q)}
                                            className="w-9 h-9 bg-emerald-500/20 text-emerald-300 rounded-sm flex items-center justify-center hover:bg-emerald-500/30 active:scale-95"
                                            title="Send for approval"
                                            disabled={sendLoadingId === q.id}
                                        >
                                            {sendLoadingId === q.id ? <CircleNotch size={16} className="animate-spin" /> : <PaperPlaneTilt size={16} />}
                                        </button>
                                    )}
                                    <button onClick={() => openVersions(q)} className="w-9 h-9 bg-slate-700 rounded-sm flex items-center justify-center hover:bg-slate-600 active:scale-95">
                                        <ListBullets size={16} />
                                    </button>
                                    <button onClick={() => openEdit(q)} className="w-9 h-9 bg-slate-700 rounded-sm flex items-center justify-center hover:bg-slate-600 active:scale-95">
                                        <PencilSimple size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(q.id)} className="w-9 h-9 bg-red-500/20 text-red-400 rounded-sm flex items-center justify-center hover:bg-red-500/30 active:scale-95">
                                        <Trash size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <Portal>
                    <div className="fixed inset-0 z-[100] bg-black/80 overflow-y-auto overscroll-contain">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div className="card w-full max-w-lg rounded-2xl animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-bold text-lg">{editingQuestion ? 'Edit Question' : 'New Question'}</h2>
                                    <button onClick={() => { hapticImpact(); setShowCreateModal(false); resetForm(); }} className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase mb-1 block">Question *</label>
                                        <textarea
                                            value={formData.question_text}
                                            onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                                            className="input-modern h-24 resize-none"
                                            placeholder="Enter your question..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        {['A', 'B', 'C', 'D'].map(opt => (
                                            <div key={opt}>
                                                <label className="text-xs text-slate-400 uppercase mb-1 block">Option {opt} *</label>
                                                <input
                                                    type="text"
                                                    value={(formData as any)[`option_${opt.toLowerCase()}`]}
                                                    onChange={(e) => setFormData({ ...formData, [`option_${opt.toLowerCase()}`]: e.target.value })}
                                                    className="input-modern h-10"
                                                    placeholder={`Option ${opt}`}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Answer *</label>
                                            <select
                                                value={formData.correct_option}
                                                onChange={(e) => setFormData({ ...formData, correct_option: e.target.value })}
                                                className="input-modern h-10"
                                            >
                                                {['A', 'B', 'C', 'D'].map(o => <option key={o} value={o}>{o}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Category *</label>
                                            <select
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                className="input-modern h-10"
                                            >
                                                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Difficulty *</label>
                                            <select
                                                value={formData.difficulty}
                                                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                                className="input-modern h-10"
                                            >
                                                {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Sub-topic</label>
                                            <input
                                                type="text"
                                                value={formData.sub_topic}
                                                onChange={(e) => setFormData({ ...formData, sub_topic: e.target.value })}
                                                className="input-modern h-10"
                                                placeholder="e.g., Probability"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Marks</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={formData.marks}
                                                onChange={(e) => setFormData({ ...formData, marks: Number(e.target.value || 1) })}
                                                className="input-modern h-10"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Time (sec)</label>
                                            <input
                                                type="number"
                                                min={10}
                                                max={3600}
                                                value={formData.time_limit_seconds}
                                                onChange={(e) => setFormData({ ...formData, time_limit_seconds: e.target.value })}
                                                className="input-modern h-10"
                                                placeholder="Optional"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Status</label>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                className="input-modern h-10"
                                            >
                                                <option value="DRAFT">Draft</option>
                                                <option value="ACTIVE">Send for Approval</option>
                                                <option value="ARCHIVED">Archive</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Role Tag</label>
                                            <input
                                                type="text"
                                                value={formData.role_tag}
                                                onChange={(e) => setFormData({ ...formData, role_tag: e.target.value })}
                                                className="input-modern h-10"
                                                placeholder="e.g., Backend"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 uppercase mb-1 block">Explanation (optional)</label>
                                        <textarea
                                            value={formData.explanation}
                                            onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                                            className="input-modern h-16 resize-none"
                                            placeholder="Explain the answer..."
                                        />
                                    </div>

                                    <button onClick={handleSave} disabled={saving} className="btn-primary w-full h-12 flex items-center justify-center gap-2">
                                        {saving ? <CircleNotch size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                        {editingQuestion ? 'Update Question' : 'Create Question'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
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

            {/* Bulk Upload Modal */}
            {showUploadModal && (
                <Portal>
                    <div className="fixed inset-0 z-[100] bg-black/80 overflow-y-auto overscroll-contain">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div className="card w-full max-w-md animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-bold text-lg">Bulk Upload</h2>
                                    <button onClick={() => { hapticImpact(); setShowUploadModal(false); }} className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-800 rounded-sm text-sm">
                                        <p className="font-medium mb-2">CSV Format:</p>
                                        <code className="text-xs text-slate-400 break-all">
                                            question_text, option_a, option_b, option_c, option_d, correct_option, category, difficulty, explanation, sub_topic, marks, status, time_limit_seconds, role_tag, approval_status
                                        </code>
                                    </div>

                                    <label className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-slate-600 rounded-sm cursor-pointer hover:border-blue-500">
                                        {uploading ? (
                                            <CircleNotch size={40} className="animate-spin text-blue-500" />
                                        ) : (
                                            <>
                                                <Upload size={40} className="text-slate-400 mb-2" />
                                                <p className="text-sm text-slate-400">Tap to select CSV file</p>
                                            </>
                                        )}
                                        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                                    </label>
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
