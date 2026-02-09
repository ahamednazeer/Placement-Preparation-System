'use client';

import React, { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    GraduationCap,
    Briefcase,
    FileText,
    Check,
    Plus,
    X,
    Upload,
    Trash,
    CircleNotch,
    CheckCircle,
    LinkedinLogo,
    GithubLogo,
    Globe,
    CaretLeft,
    Target,
    ArrowRight,
    Camera,
    User,
    Warning,
    FloppyDisk,
} from '@phosphor-icons/react';
import { api, ProfileResponse, ResumeInfo } from '@/lib/api';
import { useCapacitor } from '@/components/CapacitorProvider';
import Skeleton from '@/components/Skeleton';
import { toast } from 'sonner';

const SOFT_SKILLS = ['communication', 'leadership', 'teamwork', 'problem_solving', 'adaptability'];
const DOMAINS = ['IT Services', 'Product', 'Engineering', 'Analytics', 'Finance', 'Consulting'];
const DEGREES = ['B.E.', 'B.Tech', 'M.Tech', 'MCA', 'BCA', 'B.Sc', 'M.Sc'];
const POPULAR_SKILLS = ['Python', 'JavaScript', 'Java', 'React', 'Node.js', 'SQL'];
const POPULAR_ROLES = ['Software Developer', 'Data Analyst', 'Full Stack Developer', 'DevOps Engineer'];

interface FormData {
    register_number: string;
    college_name: string;
    department: string;
    degree: string;
    current_year: number | '';
    graduation_year: number | '';
    cgpa: number | '';
    linkedin_url: string;
    github_url: string;
    portfolio_url: string;
}

function ProfilePageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const isSetupMode = searchParams.get('setup') === 'true';
    const { hapticImpact } = useCapacitor();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [autoSaving, setAutoSaving] = useState(false);
    const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
    const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null);
    const [uploading, setUploading] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
    const autoSaveInFlight = useRef(false);
    const autoSaveQueued = useRef(false);
    const autoSaveReady = useRef(false);
    const lastChangeAt = useRef(0);

    const [skills, setSkills] = useState<string[]>([]);
    const [newSkill, setNewSkill] = useState('');
    const [softSkills, setSoftSkills] = useState<Record<string, number>>({});
    const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
    const [newRole, setNewRole] = useState('');
    const [preferredDomains, setPreferredDomains] = useState<string[]>([]);

    const { register, reset, getValues, trigger, watch, formState: { errors, isDirty } } = useForm<FormData>({
        mode: 'onChange',
        shouldUnregister: false,
    });

    const applyProfileData = useCallback((profileData: ProfileResponse) => {
        setSkills(profileData.technical_skills || []);
        setSoftSkills(profileData.soft_skills || {});
        setPreferredRoles(profileData.preferred_roles || []);
        setPreferredDomains(profileData.preferred_domains || []);
        reset({
            register_number: profileData.register_number || '',
            college_name: profileData.college_name || '',
            department: profileData.department || '',
            degree: profileData.degree || '',
            current_year: profileData.current_year || '',
            graduation_year: profileData.graduation_year || '',
            cgpa: profileData.cgpa || '',
            linkedin_url: profileData.linkedin_url || '',
            github_url: profileData.github_url || '',
            portfolio_url: profileData.portfolio_url || '',
        }, { keepDirty: false });
    }, [reset]);

    // Track unsaved changes
    useEffect(() => {
        setHasUnsavedChanges(isDirty);
    }, [isDirty]);

    // Warn on browser close/refresh
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const fetchProfile = useCallback(async () => {
        try {
            const [profileData, resumeData] = await Promise.all([
                api.getProfile(),
                api.getResumeInfo(),
            ]);
            setResumeInfo(resumeData);
            applyProfileData(profileData);
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        } finally {
            autoSaveReady.current = true;
            setLoading(false);
        }
    }, [applyProfileData]);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    const buildProfilePayload = useCallback(() => {
        const data = getValues();
        const toNumberInRange = (value: number | '' | undefined, min: number, max: number) => {
            if (value === '' || value === undefined) return undefined;
            const num = typeof value === 'number' ? value : Number(value);
            if (!Number.isFinite(num)) return undefined;
            if (num < min || num > max) return undefined;
            return num;
        };
        return {
            register_number: data.register_number || undefined,
            college_name: data.college_name || undefined,
            department: data.department || undefined,
            degree: data.degree || undefined,
            current_year: toNumberInRange(data.current_year, 1, 8),
            graduation_year: toNumberInRange(data.graduation_year, 2020, 2035),
            cgpa: toNumberInRange(data.cgpa, 0, 10),
            technical_skills: skills,
            soft_skills: softSkills,
            preferred_roles: preferredRoles,
            preferred_domains: preferredDomains,
            // allow clearing by sending empty string
            linkedin_url: (data.linkedin_url ?? '').trim(),
            github_url: (data.github_url ?? '').trim(),
            portfolio_url: (data.portfolio_url ?? '').trim(),
        };
    }, [getValues, skills, softSkills, preferredRoles, preferredDomains]);

    // Auto-save function
    const autoSave = useCallback(async () => {
        if (autoSaveInFlight.current) return;
        autoSaveInFlight.current = true;
        const saveStartedAt = Date.now();
        setAutoSaving(true);
        try {
            const updated = await api.updateProfile(buildProfilePayload());
            if (lastChangeAt.current <= saveStartedAt) {
                applyProfileData(updated);
                setHasUnsavedChanges(false);
            }
            setAutoSaveError(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Auto-save failed';
            setAutoSaveError(message);
        } finally {
            setAutoSaving(false);
            autoSaveInFlight.current = false;
            if (autoSaveQueued.current) {
                autoSaveQueued.current = false;
                // schedule a new save for changes made while saving
                if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
                autoSaveTimer.current = setTimeout(() => autoSave(), 600);
            }
        }
    }, [applyProfileData, buildProfilePayload]);

    const scheduleAutoSave = useCallback(() => {
        if (loading || !autoSaveReady.current) return;
        if (autoSaveInFlight.current) {
            autoSaveQueued.current = true;
            return;
        }
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => autoSave(), 1000);
    }, [autoSave, loading]);

    // Trigger auto-save on any form change
    useEffect(() => {
        const subscription = watch(() => {
            lastChangeAt.current = Date.now();
            if (autoSaveError) setAutoSaveError(null);
            scheduleAutoSave();
        });
        return () => subscription.unsubscribe();
    }, [watch, scheduleAutoSave, autoSaveError]);

    // Trigger auto-save on non-form state changes (skills, preferences)
    useEffect(() => {
        lastChangeAt.current = Date.now();
        scheduleAutoSave();
    }, [skills, softSkills, preferredRoles, preferredDomains, scheduleAutoSave]);

    const saveProfile = async () => {
        hapticImpact();
        setSaving(true);
        const data = getValues();
        try {
            const updated = await api.updateProfile(buildProfilePayload());
            applyProfileData(updated);
            toast.success('Profile saved!');
            setHasUnsavedChanges(false);
            if (isSetupMode) router.push('/dashboard/student');
            return true;
        } catch (error: any) {
            toast.error(error?.message || 'Failed to save');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const next = async () => {
        hapticImpact();
            if (step === 1) {
            const valid = await trigger(['register_number', 'college_name', 'department', 'degree', 'current_year', 'graduation_year', 'cgpa']);
            if (!valid) { toast.error('Fill all required fields'); return; }
        }
        if (step < 5) setStep(step + 1);
        else saveProfile();
    };

    const back = () => {
        hapticImpact();
        if (step > 1) setStep(step - 1);
    };

    const handleBack = () => {
        if (hasUnsavedChanges) {
            setShowExitConfirm(true);
        } else {
            router.back();
        }
    };

    const addSkill = (s: string) => {
        if (s.trim() && !skills.includes(s.toLowerCase().trim())) {
            hapticImpact(); setSkills([...skills, s.toLowerCase().trim()]); setNewSkill('');
            setHasUnsavedChanges(true);
        }
    };
    const addRole = (r: string) => {
        if (r.trim() && !preferredRoles.includes(r.trim())) {
            hapticImpact(); setPreferredRoles([...preferredRoles, r.trim()]); setNewRole('');
            setHasUnsavedChanges(true);
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            hapticImpact();
            const reader = new FileReader();
            reader.onload = (ev) => {
                setProfilePhoto(ev.target?.result as string);
                toast.success('Photo updated!');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        hapticImpact(); setUploading(true);
        try {
            const result = await api.uploadResume(file);
            if (result.success && result.resume) { setResumeInfo(result.resume); toast.success('Resume uploaded!'); }
        } catch (error: any) { toast.error(error?.message || 'Upload failed'); }
        finally { setUploading(false); e.target.value = ''; }
    };

    if (loading) return <div className="space-y-4"><Skeleton variant="card" className="h-20" /><Skeleton variant="card" className="h-64" /></div>;

    const stepTitles = ['Academic Details', 'Technical Skills', 'Career Goals', 'Resume Upload', 'Social Links'];
    const stepIcons = [GraduationCap, Briefcase, Target, FileText, Globe];
    const StepIcon = stepIcons[step - 1];

    // Input class with error state
    const inputClass = (hasError: boolean) => `input-modern h-12 transition-all ${hasError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`;

    return (
        <div className="space-y-4 pb-24 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Exit Confirmation Modal */}
            {showExitConfirm && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div className="card max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3">
                            <Warning size={24} className="text-yellow-500" />
                            <h3 className="font-bold">Unsaved Changes</h3>
                        </div>
                        <p className="text-sm text-slate-400">You have unsaved changes. Do you want to save before leaving?</p>
                        <div className="flex gap-2">
                            <button onClick={() => { hapticImpact(); setShowExitConfirm(false); router.back(); }} className="btn-secondary flex-1 active:scale-95 transition-transform">Discard</button>
                            <button onClick={async () => { hapticImpact(); await saveProfile(); router.back(); }} className="btn-primary flex-1 active:scale-95 transition-transform">Save & Exit</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header with Profile Photo */}
            <div className="card">
                <div className="flex items-center gap-4">
                    {/* Profile Photo */}
                    <label className="relative cursor-pointer group">
                        <div className="w-14 h-14 rounded-sm bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-slate-700 group-hover:border-blue-500 transition-colors">
                            {profilePhoto ? (
                                <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <User size={28} className="text-slate-500" />
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <Camera size={12} className="text-white" />
                        </div>
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>

                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <StepIcon size={18} className="text-blue-400" />
                            <h1 className="font-chivo font-bold text-lg uppercase tracking-wide">{stepTitles[step - 1]}</h1>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">Step {step}/5</span>
                            {autoSaving && (
                                <span className="text-xs text-blue-400 flex items-center gap-1">
                                    <CircleNotch size={10} className="animate-spin" /> Saving...
                                </span>
                            )}
                            {!autoSaving && autoSaveError && (
                                <span className="text-xs text-red-400 flex items-center gap-1">
                                    <Warning size={10} /> {autoSaveError}
                                </span>
                            )}
                            {!autoSaving && !autoSaveError && !hasUnsavedChanges && step > 1 && (
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                    <Check size={10} /> Saved
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Step Progress */}
                <div className="flex gap-1 mt-4">
                    {[1, 2, 3, 4, 5].map(s => (
                        <button
                            key={s}
                            onClick={() => { hapticImpact(); setStep(s); }}
                            className={`flex-1 h-2 rounded-full transition-all ${s < step ? 'bg-green-500' : s === step ? 'bg-blue-500' : 'bg-slate-700'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Step 1: Academic */}
            {step === 1 && (
                <div className="card space-y-4 animate-in slide-in-from-right-4 duration-200">
                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                            Register Number <span className="text-red-400">*</span>
                        </label>
                        <input {...register('register_number', { required: true })} className={inputClass(!!errors.register_number)} placeholder="e.g., 2021CSE001" />
                        {errors.register_number && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><Warning size={12} /> Required</p>}
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                            College <span className="text-red-400">*</span>
                        </label>
                        <input {...register('college_name', { required: true })} className={inputClass(!!errors.college_name)} placeholder="Your college name" />
                        {errors.college_name && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><Warning size={12} /> Required</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                                Department <span className="text-red-400">*</span>
                            </label>
                            <input {...register('department', { required: true })} className={inputClass(!!errors.department)} placeholder="CSE" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                                Degree <span className="text-red-400">*</span>
                            </label>
                            <select {...register('degree', { required: true })} className={inputClass(!!errors.degree)}>
                                <option value="">Select</option>
                                {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                                Year <span className="text-red-400">*</span>
                            </label>
                            <select {...register('current_year', { required: true, valueAsNumber: true })} className={`${inputClass(!!errors.current_year)} text-center`}>
                                <option value="">-</option>
                                {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">Grad</label>
                            <input type="number" {...register('graduation_year', { required: true, min: 2020, max: 2035, valueAsNumber: true })} className={`${inputClass(!!errors.graduation_year)} text-center`} placeholder="2025" />
                            {errors.graduation_year && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><Warning size={12} /> 2020-2035</p>}
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase tracking-wider mb-1 block">
                                CGPA <span className="text-red-400">*</span>
                            </label>
                            <input type="number" step="0.01" {...register('cgpa', { required: true, min: 0, max: 10, valueAsNumber: true })} className={`${inputClass(!!errors.cgpa)} text-center`} placeholder="8.5" />
                            {errors.cgpa && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><Warning size={12} /> 0-10</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Skills */}
            {step === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                    <div className="card">
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Quick Add</label>
                        <div className="flex flex-wrap gap-2">
                            {POPULAR_SKILLS.filter(s => !skills.includes(s.toLowerCase())).map(s => (
                                <button key={s} type="button" onClick={() => addSkill(s)} className="btn-secondary text-xs py-2 active:scale-95 transition-transform">+ {s}</button>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                            <input type="text" value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill(newSkill))} className="input-modern h-12 flex-1" placeholder="Custom skill..." />
                            <button type="button" onClick={() => addSkill(newSkill)} className="btn-primary h-12 px-4 active:scale-95 transition-transform"><Plus size={18} /></button>
                        </div>
                        {skills.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800">
                                {skills.map(s => (
                                    <span key={s} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-900/30 text-purple-300 rounded-sm text-sm animate-in zoom-in duration-150">
                                        {s} <button type="button" onClick={() => { hapticImpact(); setSkills(skills.filter(x => x !== s)); setHasUnsavedChanges(true); }} className="hover:text-red-400 transition-colors"><X size={14} /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="card">
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-3 block">Soft Skills (1-5)</label>
                        {SOFT_SKILLS.map(skill => (
                            <div key={skill} className="flex items-center justify-between py-2">
                                <span className="text-sm capitalize">{skill.replace('_', ' ')}</span>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <button key={n} type="button" onClick={() => { hapticImpact(); setSoftSkills({ ...softSkills, [skill]: n }); setHasUnsavedChanges(true); }}
                                            className={`w-9 h-9 rounded-sm text-sm font-bold transition-all active:scale-90 ${softSkills[skill] >= n ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{n}</button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 3: Career */}
            {step === 3 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                    <div className="card">
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">Job Roles</label>
                        <div className="flex flex-wrap gap-2">
                            {POPULAR_ROLES.filter(r => !preferredRoles.includes(r)).map(r => (
                                <button key={r} type="button" onClick={() => addRole(r)} className="btn-secondary text-xs py-2 active:scale-95 transition-transform">+ {r}</button>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                            <input type="text" value={newRole} onChange={e => setNewRole(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRole(newRole))} className="input-modern h-12 flex-1" placeholder="Custom role..." />
                            <button type="button" onClick={() => addRole(newRole)} className="btn-primary h-12 px-4 active:scale-95 transition-transform"><Plus size={18} /></button>
                        </div>
                        {preferredRoles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800">
                                {preferredRoles.map(r => (
                                    <span key={r} className="inline-flex items-center gap-1 px-3 py-1 bg-green-900/30 text-green-300 rounded-sm text-sm animate-in zoom-in duration-150">
                                        {r} <button type="button" onClick={() => { hapticImpact(); setPreferredRoles(preferredRoles.filter(x => x !== r)); setHasUnsavedChanges(true); }} className="hover:text-red-400 transition-colors"><X size={14} /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="card">
                        <label className="text-xs text-slate-400 uppercase tracking-wider mb-3 block">Domains</label>
                        <div className="grid grid-cols-2 gap-2">
                            {DOMAINS.map(d => (
                                <button key={d} type="button" onClick={() => { hapticImpact(); setPreferredDomains(preferredDomains.includes(d) ? preferredDomains.filter(x => x !== d) : [...preferredDomains, d]); setHasUnsavedChanges(true); }}
                                    className={`py-3 rounded-sm text-sm font-medium transition-all active:scale-95 ${preferredDomains.includes(d) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'}`}>
                                    {preferredDomains.includes(d) && <Check size={14} className="inline mr-1" />}{d}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Resume */}
            {step === 4 && (
                <div className="card animate-in slide-in-from-right-4 duration-200">
                    {resumeInfo ? (
                        <div>
                            <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-sm">
                                <FileText size={28} className="text-blue-400" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{resumeInfo.original_filename}</p>
                                    <p className="text-xs text-slate-500">{resumeInfo.file_size_mb} MB</p>
                                </div>
                                <CheckCircle size={20} className="text-green-400" />
                            </div>
                            <button type="button" onClick={async () => { hapticImpact(); await api.deleteResume(); setResumeInfo(null); toast.success('Deleted'); }} className="btn-secondary w-full mt-3 flex items-center justify-center gap-2 active:scale-95 transition-transform"><Trash size={16} /> Remove</button>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-600 rounded-sm cursor-pointer hover:border-blue-500 transition-colors active:scale-[0.99]">
                            {uploading ? <CircleNotch size={40} className="animate-spin text-blue-500" /> : (
                                <><Upload size={40} className="text-slate-400 mb-2" /><p className="text-sm text-slate-400">Tap to upload</p><p className="text-xs text-slate-600">PDF or DOCX, max 5MB</p></>
                            )}
                            <input type="file" accept=".pdf,.docx" onChange={handleResumeUpload} className="hidden" disabled={uploading} />
                        </label>
                    )}
                </div>
            )}

            {/* Step 5: Links */}
            {step === 5 && (
                <div className="card space-y-4 animate-in slide-in-from-right-4 duration-200">
                    <p className="text-xs text-slate-500">Optional but recommended</p>
                    <div>
                        <label className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider mb-1"><LinkedinLogo size={14} weight="fill" className="text-[#0A66C2]" /> LinkedIn</label>
                        <input {...register('linkedin_url')} className="input-modern h-12" placeholder="linkedin.com/in/username" />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider mb-1"><GithubLogo size={14} weight="fill" /> GitHub</label>
                        <input {...register('github_url')} className="input-modern h-12" placeholder="github.com/username" />
                    </div>
                    <div>
                        <label className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wider mb-1"><Globe size={14} className="text-emerald-400" /> Portfolio</label>
                        <input {...register('portfolio_url')} className="input-modern h-12" placeholder="yourwebsite.com" />
                    </div>
                </div>
            )}

            {/* Fixed Bottom Nav */}
            <div className="fixed bottom-16 left-0 right-0 p-4 bg-slate-950/95 backdrop-blur border-t border-slate-800">
                <div className="flex gap-3 max-w-lg mx-auto">
                    {step > 1 && (
                        <button type="button" onClick={back} className="btn-secondary h-12 px-4 flex items-center gap-1 active:scale-95 transition-transform">
                            <CaretLeft size={18} weight="bold" /> Back
                        </button>
                    )}
                    <button type="button" onClick={next} disabled={saving} className="btn-primary h-12 flex-1 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                        {saving ? <CircleNotch size={18} className="animate-spin" /> : step < 5 ? <><span>Continue</span><ArrowRight size={18} /></> : <><FloppyDisk size={18} /> Save Profile</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="space-y-4"><Skeleton variant="card" className="h-20" /><Skeleton variant="card" className="h-64" /></div>}>
            <ProfilePageContent />
        </Suspense>
    );
}
