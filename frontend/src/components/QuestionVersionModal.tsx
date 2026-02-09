'use client';

import { X, CircleNotch, ListBullets } from '@phosphor-icons/react';
import Portal from '@/components/Portal';
import { QuestionVersion } from '@/lib/api';

interface QuestionVersionModalProps {
    open: boolean;
    onClose: () => void;
    versions: QuestionVersion[];
    loading?: boolean;
    title?: string;
    questionTitle?: string | null;
}

export default function QuestionVersionModal({
    open,
    onClose,
    versions,
    loading = false,
    title = 'Version History',
    questionTitle,
}: QuestionVersionModalProps) {
    if (!open) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[110] bg-black/80 overflow-y-auto overscroll-contain">
                <div className="flex min-h-full items-center justify-center p-4">
                    <div className="card w-full max-w-3xl rounded-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-bold text-lg">{title}</h2>
                                <p className="text-xs text-slate-500">
                                    {questionTitle ? questionTitle.slice(0, 120) : 'Tracked edits and approvals'}
                                </p>
                            </div>
                            <button onClick={onClose} className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                <X size={16} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="py-10 text-center text-slate-400">
                                <CircleNotch size={32} className="animate-spin mx-auto mb-3" />
                                Loading versions...
                            </div>
                        ) : versions.length === 0 ? (
                            <div className="py-10 text-center text-slate-500">
                                <ListBullets size={40} className="mx-auto mb-3 text-slate-600" />
                                No versions found.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                {versions.map((version) => {
                                    const snap = version.snapshot || {};
                                    return (
                                        <div key={version.id} className="p-3 rounded-sm border border-slate-800 bg-slate-900/40">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-xs font-mono uppercase tracking-wider text-slate-300">v{version.version_number}</span>
                                                <span className="text-xs text-slate-500">{new Date(version.changed_at).toLocaleString()}</span>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-400 space-y-1">
                                                <div className="line-clamp-2">Question: {snap.question_text || 'n/a'}</div>
                                                <div>Category: {snap.category || 'n/a'} | Difficulty: {snap.difficulty || 'n/a'}</div>
                                                <div>Marks: {snap.marks ?? 1} | Time: {snap.time_limit_seconds ?? '—'}s | Status: {snap.status || 'n/a'}</div>
                                                <div>Approval: {snap.approval_status || 'n/a'}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}
