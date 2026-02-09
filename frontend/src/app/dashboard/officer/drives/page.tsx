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
    CurrencyInr,
    Calendar,
    Users,
    Eye,
    Check,
    XCircle,
    DownloadSimple,
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
    const [exporting, setExporting] = useState(false);

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
        aptitude_test_required: true,
        aptitude_question_count: '10',
        aptitude_difficulty: 'MEDIUM',
        aptitude_pass_percentage: '60',
        technical_test_required: true,
        technical_question_count: '10',
        technical_difficulty: 'MEDIUM',
        technical_pass_percentage: '60',
    });

    const fetchDrives = useCallback(async () => {
        try {
            const data = await api.listDrives({ status: statusFilter || undefined });
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
            aptitude_test_required: true,
            aptitude_question_count: '10',
            aptitude_difficulty: 'MEDIUM',
            aptitude_pass_percentage: '60',
            technical_test_required: true,
            technical_question_count: '10',
            technical_difficulty: 'MEDIUM',
            technical_pass_percentage: '60',
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
            aptitude_test_required: drive.aptitude_test_required ?? true,
            aptitude_question_count: (drive.aptitude_question_count ?? 10).toString(),
            aptitude_difficulty: drive.aptitude_difficulty || 'MEDIUM',
            aptitude_pass_percentage: (drive.aptitude_pass_percentage ?? 60).toString(),
            technical_test_required: drive.technical_test_required ?? true,
            technical_question_count: (drive.technical_question_count ?? 10).toString(),
            technical_difficulty: drive.technical_difficulty || 'MEDIUM',
            technical_pass_percentage: (drive.technical_pass_percentage ?? 60).toString(),
        });
        setShowModal(true);
    };

    const validateForm = () => {
        if (!formData.company_name.trim()) return 'Company name is required';
        if (!formData.job_title.trim()) return 'Job title is required';
        if (formData.job_description.trim().length < 10) return 'Job description must be at least 10 characters';
        if (!formData.registration_deadline) return 'Registration deadline is required';
        if (!formData.drive_date) return 'Drive date is required';

        const regDate = new Date(formData.registration_deadline);
        const driveDate = new Date(formData.drive_date);
        if (Number.isNaN(regDate.getTime()) || Number.isNaN(driveDate.getTime())) {
            return 'Please provide valid dates';
        }
        if (regDate >= driveDate) return 'Registration deadline must be before the drive date';

        if (formData.min_cgpa) {
            const cgpa = Number.parseFloat(formData.min_cgpa);
            if (Number.isNaN(cgpa)) return 'Min CGPA must be a number';
            if (cgpa < 0 || cgpa > 10) return 'Min CGPA must be between 0 and 10';
        }

        if (formData.package_lpa) {
            const pkg = Number.parseFloat(formData.package_lpa);
            if (Number.isNaN(pkg)) return 'Package must be a number';
        }

        if (formData.max_applications) {
            const maxApps = Number.parseInt(formData.max_applications, 10);
            if (Number.isNaN(maxApps) || maxApps < 1) return 'Max applications must be at least 1';
        }

        if (formData.aptitude_test_required) {
            const count = Number.parseInt(formData.aptitude_question_count, 10);
            if (Number.isNaN(count) || count < 5 || count > 50) return 'Aptitude question count must be between 5 and 50';
            const pass = Number.parseFloat(formData.aptitude_pass_percentage);
            if (Number.isNaN(pass) || pass < 0 || pass > 100) return 'Aptitude pass % must be between 0 and 100';
        }

        if (formData.technical_test_required) {
            const count = Number.parseInt(formData.technical_question_count, 10);
            if (Number.isNaN(count) || count < 5 || count > 50) return 'Technical question count must be between 5 and 50';
            const pass = Number.parseFloat(formData.technical_pass_percentage);
            if (Number.isNaN(pass) || pass < 0 || pass > 100) return 'Technical pass % must be between 0 and 100';
        }

        return null;
    };

    const handleSave = async () => {
        hapticImpact();
        const validationError = validateForm();
        if (validationError) {
            toast.error(validationError);
            return;
        }
        setSaving(true);
        try {
            const regDate = new Date(formData.registration_deadline);
            const driveDate = new Date(formData.drive_date);
            const data = {
                company_name: formData.company_name,
                job_title: formData.job_title,
                job_description: formData.job_description,
                registration_deadline: regDate.toISOString(),
                drive_date: driveDate.toISOString(),
                min_cgpa: formData.min_cgpa ? parseFloat(formData.min_cgpa) : undefined,
                package_lpa: formData.package_lpa ? parseFloat(formData.package_lpa) : undefined,
                location: formData.location || undefined,
                job_type: formData.job_type,
                allowed_departments: formData.allowed_departments
                    ? formData.allowed_departments.split(',').map(s => s.trim()).filter(Boolean)
                    : undefined,
                max_applications: formData.max_applications ? parseInt(formData.max_applications, 10) : undefined,
                aptitude_test_required: formData.aptitude_test_required,
                aptitude_question_count: formData.aptitude_test_required
                    ? parseInt(formData.aptitude_question_count, 10)
                    : undefined,
                aptitude_difficulty: formData.aptitude_test_required ? formData.aptitude_difficulty : undefined,
                aptitude_pass_percentage: formData.aptitude_test_required
                    ? parseFloat(formData.aptitude_pass_percentage)
                    : undefined,
                technical_test_required: formData.technical_test_required,
                technical_question_count: formData.technical_test_required
                    ? parseInt(formData.technical_question_count, 10)
                    : undefined,
                technical_difficulty: formData.technical_test_required ? formData.technical_difficulty : undefined,
                technical_pass_percentage: formData.technical_test_required
                    ? parseFloat(formData.technical_pass_percentage)
                    : undefined,
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

    const handleExportApplicants = async () => {
        if (!selectedDrive) return;
        hapticImpact();
        setExporting(true);
        try {
            const blob = await api.exportDriveApplicants(selectedDrive.id);
            const url = window.URL.createObjectURL(blob);
            const safeName = `${selectedDrive.company_name}-${selectedDrive.job_title}`
                .replace(/[^a-z0-9]+/gi, '_')
                .replace(/^_+|_+$/g, '')
                .toLowerCase() || 'drive_applicants';
            const link = document.createElement('a');
            link.href = url;
            link.download = `${safeName}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Applicants exported');
        } catch (error: any) {
            toast.error(error?.message || 'Failed to export applicants');
        } finally {
            setExporting(false);
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
                                        {drive.package_lpa && <span className="flex items-center gap-1"><CurrencyInr size={12} />{drive.package_lpa} LPA</span>}
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

                                    <div className="border border-slate-800/60 rounded-sm p-3 space-y-3">
                                        <p className="text-[10px] uppercase text-slate-400">Assessment Rules</p>
                                        <label className="flex items-center gap-2 text-xs text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={formData.aptitude_test_required}
                                                onChange={(e) => setFormData({ ...formData, aptitude_test_required: e.target.checked })}
                                                className="h-4 w-4"
                                            />
                                            Aptitude Test Required
                                        </label>
                                        {formData.aptitude_test_required && (
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">Count</label>
                                                    <input
                                                        type="number"
                                                        min={5}
                                                        max={50}
                                                        value={formData.aptitude_question_count}
                                                        onChange={(e) => setFormData({ ...formData, aptitude_question_count: e.target.value })}
                                                        className="input-modern h-9"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">Difficulty</label>
                                                    <select
                                                        value={formData.aptitude_difficulty}
                                                        onChange={(e) => setFormData({ ...formData, aptitude_difficulty: e.target.value })}
                                                        className="input-modern h-9"
                                                    >
                                                        <option value="EASY">Easy</option>
                                                        <option value="MEDIUM">Medium</option>
                                                        <option value="HARD">Hard</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">Pass %</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={formData.aptitude_pass_percentage}
                                                        onChange={(e) => setFormData({ ...formData, aptitude_pass_percentage: e.target.value })}
                                                        className="input-modern h-9"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <label className="flex items-center gap-2 text-xs text-slate-300 mt-2">
                                            <input
                                                type="checkbox"
                                                checked={formData.technical_test_required}
                                                onChange={(e) => setFormData({ ...formData, technical_test_required: e.target.checked })}
                                                className="h-4 w-4"
                                            />
                                            Technical Test Required
                                        </label>
                                        {formData.technical_test_required && (
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">Count</label>
                                                    <input
                                                        type="number"
                                                        min={5}
                                                        max={50}
                                                        value={formData.technical_question_count}
                                                        onChange={(e) => setFormData({ ...formData, technical_question_count: e.target.value })}
                                                        className="input-modern h-9"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">Difficulty</label>
                                                    <select
                                                        value={formData.technical_difficulty}
                                                        onChange={(e) => setFormData({ ...formData, technical_difficulty: e.target.value })}
                                                        className="input-modern h-9"
                                                    >
                                                        <option value="EASY">Easy</option>
                                                        <option value="MEDIUM">Medium</option>
                                                        <option value="HARD">Hard</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">Pass %</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={formData.technical_pass_percentage}
                                                        onChange={(e) => setFormData({ ...formData, technical_pass_percentage: e.target.value })}
                                                        className="input-modern h-9"
                                                    />
                                                </div>
                                            </div>
                                        )}
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
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleExportApplicants}
                                            disabled={exporting}
                                            className={`h-9 px-3 text-[10px] uppercase rounded-sm font-medium tracking-wide flex items-center gap-2 ${exporting ? 'bg-slate-800 text-slate-500' : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'}`}
                                        >
                                            {exporting ? <CircleNotch size={14} className="animate-spin" /> : <DownloadSimple size={14} />}
                                            Export
                                        </button>
                                        <button onClick={() => { hapticImpact(); setShowApplicants(false); }} className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                                            <X size={16} />
                                        </button>
                                    </div>
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
                                                        <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-slate-500">
                                                            {app.user_phone && <span>Phone: {app.user_phone}</span>}
                                                            {app.register_number && <span>Reg#: {app.register_number}</span>}
                                                            {app.department && <span>Dept: {app.department}</span>}
                                                            {app.graduation_year && <span>Batch: {app.graduation_year}</span>}
                                                            {app.cgpa !== undefined && app.cgpa !== null && <span>CGPA: {app.cgpa}</span>}
                                                        </div>
                                                        {(app.aptitude_status || app.technical_status) && (
                                                            <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-slate-500">
                                                                {app.aptitude_status && (
                                                                    <span>Aptitude: {app.aptitude_status}{app.aptitude_score !== undefined && app.aptitude_score !== null ? ` (${app.aptitude_score}%)` : ''}</span>
                                                                )}
                                                                {app.technical_status && (
                                                                    <span>Technical: {app.technical_status}{app.technical_score !== undefined && app.technical_score !== null ? ` (${app.technical_score}%)` : ''}</span>
                                                                )}
                                                            </div>
                                                        )}
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
