'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    Buildings,
    MapPin,
    CurrencyInr,
    Calendar,
    Clock,
    CheckCircle,
    CircleNotch,
    X,
    XCircle,
    PaperPlaneTilt,
    ListBullets,
    ArrowRight,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { api, PlacementDrive, MyApplication } from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';
import Portal from '@/components/Portal';
import { toast } from 'sonner';

export default function StudentDrivesPage() {
    const { hapticImpact } = useCapacitor();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [drives, setDrives] = useState<PlacementDrive[]>([]);
    const [myApps, setMyApps] = useState<MyApplication[]>([]);
    const [tab, setTab] = useState<'browse' | 'applied'>('browse');

    const [showApplyModal, setShowApplyModal] = useState(false);
    const [selectedDrive, setSelectedDrive] = useState<PlacementDrive | null>(null);
    const [coverLetter, setCoverLetter] = useState('');
    const [applying, setApplying] = useState(false);

    const fetchDrives = useCallback(async () => {
        try {
            const drivesData = await api.listDrives({ status: 'UPCOMING' });
            setDrives(drivesData.drives);
        } catch (error) {
            console.error('Failed to fetch:', error);
            toast.error('Failed to load drives');
        }
    }, []);

    const fetchMyApplications = useCallback(async () => {
        try {
            const appsData = await api.getMyApplications();
            setMyApps(appsData);
        } catch (error) {
            console.error('Failed to fetch applications:', error);
            toast.error('Failed to load applications');
        }
    }, []);

    useEffect(() => {
        if (showApplyModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showApplyModal]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([fetchDrives(), fetchMyApplications()]);
            setLoading(false);
        };
        loadData();
    }, [fetchDrives, fetchMyApplications]);

    const appliedDriveIds = new Set(myApps.map(a => a.drive_id));

    const openApply = (drive: PlacementDrive) => {
        hapticImpact();
        setSelectedDrive(drive);
        setCoverLetter('');
        setShowApplyModal(true);
    };

    const handleApply = async () => {
        if (!selectedDrive) return;
        hapticImpact();
        setApplying(true);
        try {
            await api.applyToDrive(selectedDrive.id, { cover_letter: coverLetter || undefined });
            toast.success('Applied successfully!');
            setShowApplyModal(false);
            // Refresh both drives and applications after applying
            await Promise.all([fetchDrives(), fetchMyApplications()]);
        } catch (error: any) {
            toast.error(error.message || 'Failed to apply');
        } finally {
            setApplying(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'IN_PROCESS': return 'text-blue-400 bg-blue-500/20';
            case 'SELECTED': return 'text-green-400 bg-green-500/20';
            case 'REJECTED': return 'text-red-400 bg-red-500/20';
            case 'SHORTLISTED': return 'text-yellow-400 bg-yellow-500/20';
            default: return 'text-slate-400 bg-slate-700';
        }
    };

    const getDisplayStatus = (app: MyApplication) => {
        const aptitudeRequired = !!app.aptitude_test_required;
        const technicalRequired = !!app.technical_test_required;
        const aptitudePassed = !aptitudeRequired || app.aptitude_status === 'PASSED';
        const technicalPassed = !technicalRequired || app.technical_status === 'PASSED';
        if (app.status === 'PENDING' && aptitudePassed && technicalPassed) {
            return 'IN_PROCESS';
        }
        return app.status;
    };

    const getNextAssessmentStage = (app: MyApplication): 'APTITUDE' | 'TECHNICAL' | null => {
        if (['REJECTED', 'WITHDRAWN', 'SELECTED'].includes(app.status)) {
            return null;
        }
        if (app.aptitude_test_required && app.aptitude_status !== 'PASSED') {
            return 'APTITUDE';
        }
        if (app.technical_test_required && app.technical_status !== 'PASSED') {
            return 'TECHNICAL';
        }
        return null;
    };

    const startAssessment = (driveId: string, stage: 'APTITUDE' | 'TECHNICAL') => {
        hapticImpact();
        router.push(`/dashboard/student/aptitude?drive=${driveId}&stage=${stage}`);
    };

    if (loading) {
        return <div className="space-y-4"><Skeleton variant="card" className="h-20" /><Skeleton variant="card" className="h-64" /></div>;
    }

    return (
        <div className="max-w-5xl mx-auto py-2">
            <div className="scanlines opacity-[0.03]" />

            <div className="space-y-4 pb-20 relative z-10">
                {/* Header */}
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-sm bg-green-600 flex items-center justify-center">
                            <Buildings size={22} weight="bold" className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-chivo font-bold text-lg uppercase tracking-wide">Placement Drives</h1>
                            <p className="text-xs text-slate-500">{drives.length} upcoming drives</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button onClick={() => { hapticImpact(); setTab('browse'); }} className={`flex-1 h-10 rounded-sm font-medium text-[11px] uppercase tracking-wider btn-ripple ${tab === 'browse' ? 'btn-primary shadow-blue-500/10' : 'btn-secondary shadow-none'} active:scale-95 transition-all`}>
                        Browse Drives
                    </button>
                    <button onClick={() => { hapticImpact(); setTab('applied'); }} className={`flex-1 h-10 rounded-sm font-medium text-[11px] uppercase tracking-wider btn-ripple ${tab === 'applied' ? 'btn-primary shadow-blue-500/10' : 'btn-secondary shadow-none'} active:scale-95 transition-all`}>
                        Applications ({myApps.length})
                    </button>
                </div>

                {/* Browse Tab */}
                {tab === 'browse' && (
                    <div className="space-y-3">
                        {drives.length === 0 ? (
                            <div className="card text-center py-12">
                                <Buildings size={48} className="mx-auto text-slate-600 mb-3" />
                                <p className="text-slate-400">No upcoming drives</p>
                            </div>
                        ) : (
                            drives.map(drive => {
                                const isClosed = new Date(drive.registration_deadline).getTime() < Date.now();
                                return (
                                <div
                                    key={drive.id}
                                    className={`card group hover:border-blue-500/30 transition-all duration-300 ${isClosed ? 'opacity-60' : ''}`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-chivo font-bold text-slate-100 uppercase tracking-tight">{drive.company_name}</h3>
                                                <div className="h-px flex-1 bg-slate-800/50" />
                                            </div>
                                            <p className="text-xs text-blue-400 font-mono mb-3">{drive.job_title}</p>

                                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4 mt-2">
                                                {drive.package_lpa && (
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <CurrencyInr size={14} className="text-blue-500/60" />
                                                        <span className="font-mono">{drive.package_lpa} LPA</span>
                                                    </div>
                                                )}
                                                {drive.location && (
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <MapPin size={14} className="text-blue-500/60" />
                                                        <span className="truncate">{drive.location}</span>
                                                    </div>
                                                )}
                                                {drive.min_cgpa && (
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                                                        <span>Min CGPA: {drive.min_cgpa}</span>
                                                    </div>
                                                )}
                                                {(drive.aptitude_test_required || drive.technical_test_required) && (
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                                                        <span>
                                                            Assessments: {[
                                                                drive.aptitude_test_required ? 'Aptitude' : null,
                                                                drive.technical_test_required ? 'Technical' : null,
                                                            ].filter(Boolean).join(' + ')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 pt-3 border-t border-slate-800/40">
                                                <div className="flex items-center gap-1.5 text-[9px] text-slate-500 uppercase font-mono">
                                                    <Clock size={12} className="text-red-500/40" />
                                                    Deadline: {new Date(drive.registration_deadline).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[9px] text-slate-500 uppercase font-mono">
                                                    <Calendar size={12} className="text-blue-500/40" />
                                                    Drive: {new Date(drive.drive_date).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="pt-2 sm:pt-0">
                                            {appliedDriveIds.has(drive.id) ? (
                                                <div className="px-3 py-1.5 bg-emerald-500/10 rounded-sm border border-emerald-500/20 text-[10px] text-emerald-400 flex items-center justify-center gap-2 font-bold uppercase tracking-widest">
                                                    <CheckCircle size={14} /> Applied
                                                </div>
                                            ) : isClosed ? (
                                                <div className="px-3 py-1.5 bg-rose-500/10 rounded-sm border border-rose-500/20 text-[10px] text-rose-300 flex items-center justify-center gap-2 font-bold uppercase tracking-widest">
                                                    <XCircle size={14} /> Registration Closed
                                                </div>
                                            ) : (
                                                <button onClick={() => openApply(drive)} className="btn-primary w-full sm:w-auto h-9 px-4 text-[10px] flex items-center justify-center gap-2 btn-ripple font-bold tracking-widest">
                                                    <PaperPlaneTilt size={14} /> INITIALIZE_APPLICATION
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )})
                        )}
                    </div>
                )}

                {/* My Applications Tab */}
                {tab === 'applied' && (
                    <div className="space-y-3">
                        {myApps.length === 0 ? (
                            <div className="card text-center py-12">
                                <ListBullets size={48} className="mx-auto text-slate-600 mb-3" />
                                <p className="text-slate-400">No applications yet</p>
                            </div>
                        ) : (
                            myApps.map(app => {
                                const displayStatus = getDisplayStatus(app);
                                const nextStage = getNextAssessmentStage(app);
                                const isResume = nextStage === 'APTITUDE'
                                    ? app.aptitude_status === 'IN_PROGRESS'
                                    : app.technical_status === 'IN_PROGRESS';
                                const isRetry = nextStage === 'APTITUDE'
                                    ? app.aptitude_status === 'FAILED'
                                    : app.technical_status === 'FAILED';
                                return (
                                    <div key={app.id} className="card border-slate-800/40">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-chivo font-bold text-slate-200 uppercase tracking-tight">{app.company_name}</h3>
                                                    <div className="h-px flex-1 bg-slate-800/30" />
                                                </div>
                                                <p className="text-xs text-blue-400 font-mono">{app.job_title}</p>
                                                <div className="flex items-center gap-4 mt-3">
                                                    <p className="text-[9px] text-slate-500 uppercase font-mono flex items-center gap-1.5">
                                                        <Calendar size={12} className="text-slate-600" />
                                                        Applied: {new Date(app.applied_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                {(app.aptitude_test_required || app.technical_test_required) && (
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {app.aptitude_test_required && (
                                                            <span className={`text-[9px] uppercase font-mono px-2 py-1 rounded-sm border ${app.aptitude_status === 'PASSED' ? 'border-emerald-500/40 text-emerald-400' : app.aptitude_status === 'FAILED' ? 'border-rose-500/40 text-rose-300' : 'border-slate-700 text-slate-400'}`}>
                                                                Aptitude: {app.aptitude_status || 'NOT_STARTED'}
                                                            </span>
                                                        )}
                                                        {app.technical_test_required && (
                                                            <span className={`text-[9px] uppercase font-mono px-2 py-1 rounded-sm border ${app.technical_status === 'PASSED' ? 'border-emerald-500/40 text-emerald-400' : app.technical_status === 'FAILED' ? 'border-rose-500/40 text-rose-300' : 'border-slate-700 text-slate-400'}`}>
                                                                Technical: {app.technical_status || 'NOT_STARTED'}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-start sm:items-end gap-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm border ${getStatusColor(displayStatus)}`}>
                                                    {displayStatus}
                                                </span>
                                                {nextStage && (
                                                    <button
                                                        onClick={() => startAssessment(app.drive_id, nextStage)}
                                                        className="btn-secondary h-8 px-3 text-[10px] uppercase tracking-widest flex items-center gap-2"
                                                    >
                                                        <ArrowRight size={12} />
                                                        {isRetry ? 'Retry' : (isResume ? 'Resume' : 'Start')} {nextStage}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {app.status_notes && (
                                            <div className="mt-4 p-3 bg-slate-950/40 border-l-2 border-slate-700 rounded-sm">
                                                <p className="text-[9px] text-slate-500 uppercase font-mono mb-1">Status_Notes</p>
                                                <p className="text-xs text-slate-400 italic line-clamp-2">{app.status_notes}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Apply Modal */}
                {showApplyModal && selectedDrive && (
                    <Portal>
                        <div className="fixed inset-0 z-[100] bg-black/80 overflow-y-auto overscroll-contain">
                            <div className="flex min-h-full items-center justify-center p-4">
                                <div className="card w-full max-w-md rounded-sm border-blue-500/20 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                                        <h2 className="font-chivo font-bold uppercase tracking-tight text-slate-100">Apply_Protocol</h2>
                                        <button onClick={() => setShowApplyModal(false)} className="w-8 h-8 hover:bg-slate-800 rounded-sm flex items-center justify-center transition-colors">
                                            <X size={18} />
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="p-4 bg-blue-900/10 border border-blue-500/10 rounded-sm">
                                            <p className="text-[10px] text-blue-400 uppercase font-mono tracking-widest mb-1">Company_Target</p>
                                            <p className="font-bold text-slate-100">{selectedDrive.company_name}</p>
                                            <p className="text-xs text-slate-400 mt-1">{selectedDrive.job_title} // {selectedDrive.location}</p>
                                        </div>

                                        <div>
                                            <label className="text-[9px] text-slate-500 uppercase font-mono tracking-[0.2em] mb-2 block">Optional_Cover_Telemetry</label>
                                            <textarea
                                                value={coverLetter}
                                                onChange={(e) => setCoverLetter(e.target.value)}
                                                className="input-modern h-32 resize-none text-[11px]"
                                                placeholder="Why are you compatible with this mandate?"
                                            />
                                        </div>

                                        <button onClick={handleApply} disabled={applying} className="btn-primary w-full h-12 flex items-center justify-center gap-3 btn-ripple font-bold tracking-[0.2em] text-xs uppercase">
                                            {applying ? <CircleNotch size={18} className="animate-spin" /> : <PaperPlaneTilt size={18} />}
                                            EXCHANGE_SUBMISSION
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Portal>
                )}
            </div>
        </div>
    );
}
