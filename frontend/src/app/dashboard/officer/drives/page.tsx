'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    Plus,
    Trash,
    PencilSimple,
    X,
    CheckCircle,
    CircleNotch,
    Buildings,
    MapPin,
    CurrencyDollar,
    Calendar,
    Users,
    Eye,
    Check,
    XCircle,
} from '@phosphor-icons/react';
import { api, PlacementDrive, DriveStatsResponse, Applicant } from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';
import Portal from '@/components/Portal';
import { toast } from 'sonner';

const STATUSES = [
    { value: 'UPCOMING', label: 'Upcoming', color: 'text-blue-400 bg-blue-500/20' },
    { value: 'ONGOING', label: 'Ongoing', color: 'text-green-400 bg-green-500/20' },
    { value: 'COMPLETED', label: 'Completed', color: 'text-slate-400 bg-slate-500/20' },
    { value: 'CANCELLED', label: 'Cancelled', color: 'text-red-400 bg-red-500/20' },
];

const APP_STATUSES = ['PENDING', 'SHORTLISTED', 'SELECTED', 'REJECTED'];

export default function DrivesManagementPage() {
    const { hapticImpact } = useCapacitor();
    const [loading, setLoading] = useState(true);
    const [drives, setDrives] = useState<PlacementDrive[]>([]);
    const [stats, setStats] = useState<DriveStatsResponse | null>(null);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingDrive, setEditingDrive] = useState<PlacementDrive | null>(null);
    const [saving, setSaving] = useState(false);

    const [showApplicants, setShowApplicants] = useState(false);
    const [selectedDrive, setSelectedDrive] = useState<PlacementDrive | null>(null);
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [loadingApplicants, setLoadingApplicants] = useState(false);

    const [formData, setFormData] = useState({
        company_name: '',
        job_title: '',
        job_description: '',
        registration_deadline: '',
        drive_date: '',
        min_cgpa: '',
        package_lpa: '',
        location: '',
        job_type: 'Full-time',
        allowed_departments: '',
        max_applications: '',
    });

    const fetchDrives = useCallback(async () => {
        try {
            const data = await api.getDrives(statusFilter || undefined);
            setDrives(data.drives);
            setTotal(data.total);
        } catch (error) {
            console.error('Failed to fetch drives:', error);
            toast.error('Failed to load drives');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    const fetchStats = useCallback(async () => {
        try {
            const data = await api.getDriveStats();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }, []);

    useEffect(() => {
        if (showModal || showApplicants) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showModal, showApplicants]);

    useEffect(() => {
        fetchDrives();
        fetchStats();
    }, [fetchDrives, fetchStats]);

    const resetForm = () => {
        setFormData({
            company_name: '',
            job_title: '',
            job_description: '',
            registration_deadline: '',
            drive_date: '',
            min_cgpa: '',
            package_lpa: '',
            location: '',
            job_type: 'Full-time',
            allowed_departments: '',
            max_applications: '',
        });
        setEditingDrive(null);
    };

    const openCreate = () => {
        hapticImpact();
        resetForm();
        setShowModal(true);
    };

    const openEdit = (drive: PlacementDrive) => {
        hapticImpact();
        setEditingDrive(drive);
        setFormData({
            company_name: drive.company_name,
            job_title: drive.job_title,
            job_description: drive.job_description,
            registration_deadline: drive.registration_deadline.slice(0, 16),
            drive_date: drive.drive_date.slice(0, 16),
            min_cgpa: drive.min_cgpa?.toString() || '',
            package_lpa: drive.package_lpa?.toString() || '',
            location: drive.location || '',
            job_type: drive.job_type || 'Full-time',
            allowed_departments: drive.allowed_departments?.join(', ') || '',
            max_applications: drive.max_applications?.toString() || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        hapticImpact();
        setSaving(true);
        try {
            const data = {
                company_name: formData.company_name,
                job_title: formData.job_title,
                job_description: formData.job_description,
                registration_deadline: new Date(formData.registration_deadline).toISOString(),
                drive_date: new Date(formData.drive_date).toISOString(),
                min_cgpa: formData.min_cgpa ? parseFloat(formData.min_cgpa) : undefined,
                package_lpa: formData.package_lpa ? parseFloat(formData.package_lpa) : undefined,
                location: formData.location || undefined,
                job_type: formData.job_type,
                allowed_departments: formData.allowed_departments ? formData.allowed_departments.split(',').map(s => s.trim()) : undefined,
                max_applications: formData.max_applications ? parseInt(formData.max_applications) : undefined,
            };

            if (editingDrive) {
                await api.updateDrive(editingDrive.id, data);
                toast.success('Drive updated!');
            } else {
                await api.createDrive(data);
                toast.success('Drive created!');
            }

            setShowModal(false);
            resetForm();
            fetchDrives();
            fetchStats();
        } catch (error: any) {
            toast.error(error.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        hapticImpact();
        if (!confirm('Delete this drive?')) return;
        try {
            await api.deleteDrive(id);
            toast.success('Drive deleted');
            fetchDrives();
            fetchStats();
        } catch (error: any) {
            toast.error('Failed to delete');
        }
    };

    const viewApplicants = async (drive: PlacementDrive) => {
        hapticImpact();
        setSelectedDrive(drive);
        setShowApplicants(true);
        setLoadingApplicants(true);
        try {
            const apps = await api.getDriveApplicants(drive.id);
            setApplicants(apps);
        } catch (error) {
            toast.error('Failed to load applicants');
        } finally {
            setLoadingApplicants(false);
        }
    };

    const updateStatus = async (appId: string, newStatus: string) => {
        hapticImpact();
        if (!selectedDrive) return;
        try {
            await api.updateApplicationStatus(selectedDrive.id, appId, newStatus);
            toast.success('Status updated');
            const apps = await api.getDriveApplicants(selectedDrive.id);
            setApplicants(apps);
        } catch (error) {
            toast.error('Failed to update');
        }
    };

    const getStatusStyle = (st: string) => {
        const s = STATUSES.find(x => x.value === st);
        return s?.color || 'text-slate-400 bg-slate-500/20';
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
                        <div className="w-10 h-10 rounded-sm bg-green-600 flex items-center justify-center">
                            <Buildings size={22} weight="bold" className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-chivo font-bold text-lg uppercase tracking-wide">Placement Drives</h1>
                            <p className="text-xs text-slate-500">{total} total drives</p>
                        </div>
                    </div>
                    <button onClick={openCreate} className="btn-primary h-10 px-3 flex items-center gap-1 active:scale-95">
                        <Plus size={16} weight="bold" /> New Drive
                    </button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-4 gap-2">
                    {STATUSES.map(s => (
                        <div key={s.value} className="card text-center p-2">
                            <p className={`text-xl font-bold ${s.color.split(' ')[0]}`}>{stats.by_status[s.value] || 0}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter */}
            <select
                value={statusFilter}
                onChange={(e) => { hapticImpact(); setStatusFilter(e.target.value); }}
                className="input-modern h-10 w-full"
            >
                <option value="">All Status</option>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {/* Drives List */}
            <div className="space-y-3">
                {drives.length === 0 ? (
                    <div className="card text-center py-12">
                        <Buildings size={48} className="mx-auto text-slate-600 mb-3" />
                        <p className="text-slate-400">No drives found</p>
                        <button onClick={openCreate} className="btn-primary mt-4">Create First Drive</button>
                    </div>
                ) : (
                    drives.map(drive => (
                        <div key={drive.id} className="card">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold truncate">{drive.company_name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-sm ${getStatusStyle(drive.status)}`}>{drive.status}</span>
                                    </div>
                                    <p className="text-sm text-slate-400">{drive.job_title}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                        {drive.package_lpa && <span className="flex items-center gap-1"><CurrencyDollar size={12} />{drive.package_lpa} LPA</span>}
                                        {drive.location && <span className="flex items-center gap-1"><MapPin size={12} />{drive.location}</span>}
                                        <span className="flex items-center gap-1"><Users size={12} />{drive.application_count} apps</span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1">
                                        <Calendar size={10} className="inline mr-1" />
                                        Drive: {new Date(drive.drive_date).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <button onClick={() => viewApplicants(drive)} className="w-9 h-9 bg-blue-500/20 text-blue-400 rounded-sm flex items-center justify-center active:scale-95">
                                        <Eye size={16} />
                                    </button>
                                    <button onClick={() => openEdit(drive)} className="w-9 h-9 bg-slate-700 rounded-sm flex items-center justify-center active:scale-95">
                                        <PencilSimple size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(drive.id)} className="w-9 h-9 bg-red-500/20 text-red-400 rounded-sm flex items-center justify-center active:scale-95">
                                        <Trash size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <Portal>
                    <div className="fixed inset-0 z-[100] bg-black/80 overflow-y-auto overscroll-contain">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div className="card w-full max-w-lg rounded-2xl animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="font-bold text-lg">{editingDrive ? 'Edit Drive' : 'New Drive'}</h2>
                                    <button onClick={() => { hapticImpact(); setShowModal(false); resetForm(); }} className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase mb-1 block">Company Name *</label>
                                        <input type="text" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} className="input-modern h-10" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase mb-1 block">Job Title *</label>
                                        <input type="text" value={formData.job_title} onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} className="input-modern h-10" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-end mb-1">
                                            <label className="text-xs text-slate-400 uppercase block">Description *</label>
                                            <span className={`text-[10px] ${formData.job_description.length < 10 ? 'text-yellow-500' : 'text-slate-500'}`}>
                                                {formData.job_description.length}/10 min
                                            </span>
                                        </div>
                                        <textarea value={formData.job_description} onChange={(e) => setFormData({ ...formData, job_description: e.target.value })} className="input-modern h-24 resize-none" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Deadline *</label>
                                            <input
                                                type="datetime-local"
                                                value={formData.registration_deadline}
                                                onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                                                className={`input-modern h-10 ${formData.registration_deadline && formData.drive_date && new Date(formData.registration_deadline) >= new Date(formData.drive_date) ? 'border-yellow-500/50 focus:border-yellow-500' : ''}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Drive Date *</label>
                                            <input
                                                type="datetime-local"
                                                value={formData.drive_date}
                                                onChange={(e) => setFormData({ ...formData, drive_date: e.target.value })}
                                                className={`input-modern h-10 ${formData.registration_deadline && formData.drive_date && new Date(formData.registration_deadline) >= new Date(formData.drive_date) ? 'border-yellow-500/50 focus:border-yellow-500' : ''}`}
                                            />
                                        </div>
                                    </div>
                                    {formData.registration_deadline && formData.drive_date && new Date(formData.registration_deadline) >= new Date(formData.drive_date) && (
                                        <p className="text-[10px] text-yellow-500 -mt-2">Warning: Registration deadline should be before the drive date.</p>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Min CGPA</label>
                                            <input type="number" step="0.1" value={formData.min_cgpa} onChange={(e) => setFormData({ ...formData, min_cgpa: e.target.value })} className="input-modern h-10" placeholder="6.0" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Package (LPA)</label>
                                            <input type="number" step="0.5" value={formData.package_lpa} onChange={(e) => setFormData({ ...formData, package_lpa: e.target.value })} className="input-modern h-10" placeholder="8.0" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Location</label>
                                            <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-modern h-10" placeholder="Bangalore" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 uppercase mb-1 block">Job Type</label>
                                            <select value={formData.job_type} onChange={(e) => setFormData({ ...formData, job_type: e.target.value })} className="input-modern h-10">
                                                <option>Full-time</option>
                                                <option>Internship</option>
                                                <option>Contract</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase mb-1 block">Allowed Departments (comma separated)</label>
                                        <input type="text" value={formData.allowed_departments} onChange={(e) => setFormData({ ...formData, allowed_departments: e.target.value })} className="input-modern h-10" placeholder="CSE, ECE, IT" />
                                    </div>

                                    <button onClick={handleSave} disabled={saving} className="btn-primary w-full h-12 flex items-center justify-center gap-2">
                                        {saving ? <CircleNotch size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                        {editingDrive ? 'Update Drive' : 'Create Drive'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Applicants Modal */}
            {showApplicants && selectedDrive && (
                <Portal>
                    <div className="fixed inset-0 z-[100] bg-black/80 overflow-y-auto overscroll-contain">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <div className="card w-full max-w-lg rounded-2xl animate-in zoom-in-95 duration-200">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="font-bold text-lg">Applicants</h2>
                                        <p className="text-xs text-slate-500">{selectedDrive.company_name} - {selectedDrive.job_title}</p>
                                    </div>
                                    <button onClick={() => { hapticImpact(); setShowApplicants(false); }} className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                        <X size={16} />
                                    </button>
                                </div>

                                {loadingApplicants ? (
                                    <div className="py-8 text-center"><CircleNotch size={32} className="animate-spin mx-auto text-blue-500" /></div>
                                ) : applicants.length === 0 ? (
                                    <div className="py-8 text-center text-slate-500">No applicants yet</div>
                                ) : (
                                    <div className="space-y-3">
                                        {applicants.map(app => (
                                            <div key={app.id} className="p-3 bg-slate-800 rounded-sm">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div>
                                                        <p className="font-medium">{app.user_name}</p>
                                                        <p className="text-xs text-slate-500">{app.user_email}</p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-0.5 rounded-sm ${app.status === 'SELECTED' ? 'bg-green-500/20 text-green-400' : app.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : app.status === 'SHORTLISTED' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}>
                                                        {app.status}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1">
                                                    {APP_STATUSES.filter(s => s !== app.status).map(st => (
                                                        <button key={st} onClick={() => updateStatus(app.id, st)} className={`text-xs px-2 py-1 rounded-sm active:scale-95 ${st === 'SELECTED' ? 'bg-green-500/20 text-green-400' : st === 'REJECTED' ? 'bg-red-500/20 text-red-400' : st === 'SHORTLISTED' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700'}`}>
                                                            {st}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div>
    );
}
