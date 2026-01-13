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
} from '@phosphor-icons/react';
import { api, AptitudeQuestion, AptitudeQuestionListResponse, QuestionStatsResponse, BulkUploadResponse } from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';
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

export default function AptitudeManagementPage() {
    const { hapticImpact } = useCapacitor();
    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState<AptitudeQuestion[]>([]);
    const [stats, setStats] = useState<QuestionStatsResponse | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<AptitudeQuestion | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 'A',
        category: 'QUANTITATIVE',
        difficulty: 'MEDIUM',
        explanation: '',
    });

    const fetchQuestions = useCallback(async () => {
        try {
            const data = await api.getAptitudeQuestions(
                categoryFilter || undefined,
                difficultyFilter || undefined,
                page
            );
            setQuestions(data.questions);
            setTotal(data.total);
        } catch (error) {
            console.error('Failed to fetch questions:', error);
            toast.error('Failed to load questions');
        } finally {
            setLoading(false);
        }
    }, [categoryFilter, difficultyFilter, page]);

    const fetchStats = useCallback(async () => {
        try {
            const data = await api.getQuestionStats();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }, []);

    useEffect(() => {
        if (showCreateModal || showUploadModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showCreateModal, showUploadModal]);

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
            difficulty: 'MEDIUM',
            explanation: '',
        });
        setEditingQuestion(null);
    };

    const openCreate = () => {
        hapticImpact();
        resetForm();
        setShowCreateModal(true);
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
            difficulty: q.difficulty,
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
                explanation: formData.explanation || undefined,
            };

            if (editingQuestion) {
                await api.updateQuestion(editingQuestion.id, data);
                toast.success('Question updated!');
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

    const getDifficultyStyle = (diff: string) => {
        const d = DIFFICULTIES.find(x => x.value === diff);
        return d?.color || 'text-slate-400 bg-slate-500/20';
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
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium line-clamp-2">{q.question_text}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs px-2 py-0.5 bg-slate-700 rounded-sm">{q.category.replace('_', ' ')}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-sm ${getDifficultyStyle(q.difficulty)}`}>{q.difficulty}</span>
                                        <span className="text-xs text-green-400">Answer: {q.correct_option}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1">
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
                                            question_text, option_a, option_b, option_c, option_d, correct_option, category, difficulty, explanation
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
        </div>
    );
}
