'use client';

import { X, CircleNotch, ListBullets } from '@phosphor-icons/react';
import Portal from '@/components/Portal';
import { QuestionAuditLog } from '@/lib/api';

interface AuditLogModalProps {
    open: boolean;
    onClose: () => void;
    logs: QuestionAuditLog[];
    loading?: boolean;
    title?: string;
}

export default function AuditLogModal({
    open,
    onClose,
    logs,
    loading = false,
    title = 'Audit Logs',
}: AuditLogModalProps) {
    if (!open) return null;

    return (
        <Portal>
            <div className="fixed inset-0 z-[110] bg-black/80 overflow-y-auto overscroll-contain">
                <div className="flex min-h-full items-center justify-center p-4">
                    <div className="card w-full max-w-2xl rounded-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-bold text-lg">{title}</h2>
                                <p className="text-xs text-slate-500">Latest changes and approvals</p>
                            </div>
                            <button onClick={onClose} className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                <X size={16} />
                            </button>
                        </div>

                        {loading ? (
                            <div className="py-10 text-center text-slate-400">
                                <CircleNotch size={32} className="animate-spin mx-auto mb-3" />
                                Loading audit logs...
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="py-10 text-center text-slate-500">
                                <ListBullets size={40} className="mx-auto mb-3 text-slate-600" />
                                No audit entries found.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                {logs.map((log) => (
                                    <div key={log.id} className="p-3 rounded-sm border border-slate-800 bg-slate-900/40">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-xs font-mono uppercase tracking-wider text-slate-300">{log.action}</span>
                                            <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-slate-400">
                                            <div>Question: {log.question_id ? log.question_id.slice(0, 8) : 'n/a'}</div>
                                            <div>Actor: {log.actor_id ? log.actor_id.slice(0, 8) : 'system'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}
