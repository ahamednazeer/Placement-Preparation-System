'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MagnifyingGlass, Users } from '@phosphor-icons/react';
import { api, AdminUserListResponse, User } from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
    { value: '', label: 'All Roles' },
    { value: 'STUDENT', label: 'Student' },
    { value: 'PLACEMENT_OFFICER', label: 'Placement Officer' },
    { value: 'ADMIN', label: 'Admin' },
];

const STATUS_OPTIONS = [
    { value: '', label: 'All Statuses' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'SUSPENDED', label: 'Suspended' },
];

const PAGE_SIZE = 20;

const formatDate = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString();
};

const roleLabel = (role: User['role']) => {
    switch (role) {
        case 'PLACEMENT_OFFICER':
            return 'Placement Officer';
        case 'ADMIN':
            return 'Admin';
        default:
            return 'Student';
    }
};

const statusBadge = (status: string) => {
    switch (status) {
        case 'ACTIVE':
            return 'text-green-300 bg-green-500/20';
        case 'PENDING':
            return 'text-yellow-300 bg-yellow-500/20';
        case 'SUSPENDED':
            return 'text-red-300 bg-red-500/20';
        case 'INACTIVE':
            return 'text-slate-300 bg-slate-700/70';
        default:
            return 'text-slate-300 bg-slate-700';
    }
};

export default function AdminUsersPage() {
    const { hapticImpact } = useCapacitor();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [queryInput, setQueryInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [edits, setEdits] = useState<Record<string, { role?: string; status?: string }>>({});
    const [savingId, setSavingId] = useState<string | null>(null);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data: AdminUserListResponse = await api.listUsers({
                role: roleFilter || undefined,
                status: statusFilter || undefined,
                search: searchQuery || undefined,
                page,
                page_size: PAGE_SIZE,
            });
            setUsers(data.users || []);
            setTotal(data.total || 0);
        } catch (error) {
            console.error('Failed to load users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [roleFilter, statusFilter, searchQuery, page]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const applyFilters = () => {
        hapticImpact();
        setPage(1);
        setSearchQuery(queryInput.trim());
    };

    const resetFilters = () => {
        hapticImpact();
        setRoleFilter('');
        setStatusFilter('');
        setQueryInput('');
        setSearchQuery('');
        setPage(1);
    };

    const updateEdit = (userId: string, patch: { role?: string; status?: string }) => {
        setEdits(prev => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                ...patch,
            },
        }));
    };

    const clearEdit = (userId: string) => {
        setEdits(prev => {
            const next = { ...prev };
            delete next[userId];
            return next;
        });
    };

    const handleSave = async (userId: string) => {
        const edit = edits[userId];
        if (!edit || (!edit.role && !edit.status)) return;
        setSavingId(userId);
        hapticImpact();
        try {
            await api.updateUser(userId, edit);
            toast.success('User updated');
            clearEdit(userId);
            fetchUsers();
        } catch (error: any) {
            toast.error(error?.message || 'Failed to update user');
        } finally {
            setSavingId(null);
        }
    };

    const visibleUsers = useMemo(() => users, [users]);

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
            <div className="card">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm bg-blue-600 flex items-center justify-center">
                        <Users size={22} weight="bold" className="text-white" />
                    </div>
                    <div>
                        <h1 className="font-chivo font-bold text-lg uppercase tracking-wide">User Management</h1>
                        <p className="text-xs text-slate-500">{total} total accounts</p>
                    </div>
                </div>
            </div>

            <div className="card space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1">
                        <label className="text-[10px] uppercase tracking-wider text-slate-500">Search</label>
                        <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 relative">
                                <input
                                    value={queryInput}
                                    onChange={(e) => setQueryInput(e.target.value)}
                                    placeholder="Search by name or email"
                                    className="input-modern pr-10"
                                />
                                <MagnifyingGlass size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            </div>
                            <button onClick={applyFilters} className="btn-primary h-10 px-3 text-[11px]">
                                Apply
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={roleFilter}
                            onChange={(e) => { hapticImpact(); setRoleFilter(e.target.value); setPage(1); }}
                            className="input-modern h-10 text-[11px] uppercase"
                        >
                            {ROLE_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => { hapticImpact(); setStatusFilter(e.target.value); setPage(1); }}
                            className="input-modern h-10 text-[11px] uppercase"
                        >
                            {STATUS_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={resetFilters} className="btn-secondary h-10 px-3 text-[11px]">
                        Reset
                    </button>
                </div>
            </div>

            {visibleUsers.length === 0 ? (
                <div className="card text-center py-10">
                    <Users size={44} className="text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No users found.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {visibleUsers.map((user) => {
                        const edit = edits[user.id] || {};
                        const pendingRole = edit.role ?? user.role;
                        const pendingStatus = edit.status ?? user.status;
                        const hasChanges =
                            (edit.role !== undefined && edit.role !== user.role)
                            || (edit.status !== undefined && edit.status !== user.status);

                        return (
                            <div key={user.id} className="card">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                    <div className="min-w-0">
                                        <p className="font-chivo font-bold text-slate-100 uppercase tracking-wide text-sm truncate">
                                            {user.first_name} {user.last_name}
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                        <div className="flex flex-wrap gap-2 mt-3 text-[9px] uppercase tracking-wider">
                                            <span className={`px-2 py-1 rounded-sm ${statusBadge(user.status)}`}>{user.status}</span>
                                            <span className="px-2 py-1 rounded-sm bg-slate-800/60 text-slate-300">{roleLabel(user.role)}</span>
                                            <span className="px-2 py-1 rounded-sm bg-slate-900/70 text-slate-500">Created: {formatDate(user.created_at)}</span>
                                            <span className="px-2 py-1 rounded-sm bg-slate-900/70 text-slate-500">Last login: {formatDate(user.last_login)}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <select
                                            value={pendingRole}
                                            onChange={(e) => updateEdit(user.id, { role: e.target.value })}
                                            className="input-modern h-10 text-[11px] uppercase min-w-[180px]"
                                        >
                                            {ROLE_OPTIONS.filter(option => option.value).map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={pendingStatus}
                                            onChange={(e) => updateEdit(user.id, { status: e.target.value })}
                                            className="input-modern h-10 text-[11px] uppercase min-w-[150px]"
                                        >
                                            {STATUS_OPTIONS.filter(option => option.value).map(option => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSave(user.id)}
                                                disabled={!hasChanges || savingId === user.id}
                                                className={`h-10 px-3 text-[11px] uppercase rounded-sm font-medium tracking-wide ${!hasChanges || savingId === user.id
                                                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                                                    }`}
                                            >
                                                {savingId === user.id ? 'Saving...' : 'Save'}
                                            </button>
                                            {hasChanges && (
                                                <button
                                                    onClick={() => clearEdit(user.id)}
                                                    className="h-10 px-3 text-[11px] uppercase rounded-sm font-medium tracking-wide bg-slate-700 hover:bg-slate-600 text-white"
                                                >
                                                    Reset
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Showing {users.length} of {total}</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { hapticImpact(); setPage(Math.max(1, page - 1)); }}
                        disabled={page === 1}
                        className={`px-3 py-1.5 rounded-sm border text-[10px] uppercase tracking-wider ${page === 1 ? 'border-slate-800 text-slate-600' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                    >
                        Prev
                    </button>
                    <span className="text-[10px] uppercase tracking-wider">Page {page} / {totalPages}</span>
                    <button
                        onClick={() => { hapticImpact(); setPage(Math.min(totalPages, page + 1)); }}
                        disabled={page >= totalPages}
                        className={`px-3 py-1.5 rounded-sm border text-[10px] uppercase tracking-wider ${page >= totalPages ? 'border-slate-800 text-slate-600' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
