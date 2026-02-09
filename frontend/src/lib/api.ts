/**
 * API client for the Placement Preparation System
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface AuthResponse {
    user: User;
    access_token: string;
    refresh_token: string;
    token_type: string;
}

interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role: 'STUDENT' | 'PLACEMENT_OFFICER' | 'ADMIN';
    status: string;
    created_at: string;
    last_login?: string;
}

export interface AdminUserListResponse {
    users: User[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface AdminSummaryResponse {
    total_users: number;
    by_role: Record<string, number>;
    recent_users: User[];
    interview_completed: number;
    interview_average_score?: number | null;
    interview_best_score?: number | null;
}

class ApiClient {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.accessToken = localStorage.getItem('access_token');
            this.refreshToken = localStorage.getItem('refresh_token');
        }
    }

    private formatErrorDetail(detail: any): string | null {
        if (!detail) return null;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail)) {
            const messages = detail.map((item) => {
                if (!item || typeof item !== 'object') return String(item);
                const msg = item.msg || item.message || JSON.stringify(item);
                const loc = Array.isArray(item.loc) ? item.loc.slice(1).join('.') : '';
                return loc ? `${loc}: ${msg}` : msg;
            });
            return messages.join(', ');
        }
        if (typeof detail === 'object') {
            return detail.message || JSON.stringify(detail);
        }
        return null;
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.accessToken) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 && this.refreshToken) {
            const refreshed = await this.tryRefreshToken();
            if (refreshed) {
                (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
                const retryResponse = await fetch(url, { ...options, headers });
                if (!retryResponse.ok) {
                    const error = await retryResponse.json().catch(() => ({}));
                    throw new Error(error.detail || `Request failed: ${retryResponse.status}`);
                }
                return retryResponse.json();
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const detail = this.formatErrorDetail(error.detail);
            throw new Error(detail || error.message || `Request failed: ${response.status}`);
        }

        return response.json();
    }

    private async tryRefreshToken(): Promise<boolean> {
        if (!this.refreshToken) return false;
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: this.refreshToken }),
            });
            if (response.ok) {
                const data: TokenResponse = await response.json();
                this.setTokens(data.access_token, data.refresh_token);
                return true;
            }
        } catch (e) {
            console.error('Token refresh failed:', e);
        }
        this.clearTokens();
        return false;
    }

    private setTokens(accessToken: string, refreshToken: string): void {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
        }
    }

    public clearTokens(): void {
        this.accessToken = null;
        this.refreshToken = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        }
    }

    public getToken(): string | null {
        return this.accessToken;
    }

    // Auth Endpoints
    async register(data: { email: string; password: string; first_name: string; last_name: string; phone?: string; role?: string }): Promise<AuthResponse> {
        const response = await this.request<AuthResponse>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(data) });
        this.setTokens(response.access_token, response.refresh_token);
        return response;
    }

    async login(email: string, password: string): Promise<AuthResponse> {
        const response = await this.request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        this.setTokens(response.access_token, response.refresh_token);
        return response;
    }

    async logout(): Promise<void> {
        try { await this.request('/api/v1/auth/logout', { method: 'POST' }); } finally { this.clearTokens(); }
    }

    async getMe(): Promise<User> {
        return this.request<User>('/api/v1/auth/me');
    }

    async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
        return this.request('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
    }

    // Admin Endpoints
    async listUsers(params?: { role?: string; status?: string; search?: string; page?: number; page_size?: number }): Promise<AdminUserListResponse> {
        const query = new URLSearchParams();
        if (params?.role) query.append('role', params.role);
        if (params?.status) query.append('status_filter', params.status);
        if (params?.search) query.append('search', params.search);
        if (params?.page) query.append('page', params.page.toString());
        if (params?.page_size) query.append('page_size', params.page_size.toString());
        const endpoint = `/api/v1/admin/users${query.toString() ? `?${query.toString()}` : ''}`;
        return this.request(endpoint);
    }

    async updateUser(userId: string, data: { role?: string; status?: string }): Promise<User> {
        return this.request(`/api/v1/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) });
    }

    async createUser(data: { email: string; password: string; first_name: string; last_name: string; phone?: string; role?: string }): Promise<User> {
        return this.request('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(data) });
    }

    async getAdminSummary(): Promise<AdminSummaryResponse> {
        return this.request('/api/v1/admin/summary');
    }

    // Profile Endpoints
    async getProfile(): Promise<ProfileResponse> {
        return this.request('/api/v1/profile');
    }

    async updateProfile(data: ProfileUpdateData): Promise<ProfileResponse> {
        return this.request('/api/v1/profile', { method: 'PUT', body: JSON.stringify(data) });
    }

    async getProfileStatus(): Promise<ProfileStatusResponse> {
        return this.request('/api/v1/profile/status');
    }

    async addSkill(skill: string): Promise<{ message: string }> {
        return this.request('/api/v1/profile/skills', { method: 'POST', body: JSON.stringify({ skill }) });
    }

    async removeSkill(skill: string): Promise<{ message: string }> {
        return this.request(`/api/v1/profile/skills/${encodeURIComponent(skill)}`, { method: 'DELETE' });
    }

    async uploadResume(file: File): Promise<ResumeUploadResponse> {
        const formData = new FormData();
        formData.append('file', file);

        const url = `${API_BASE_URL}/api/v1/profile/resume`;
        const makeRequest = async () => {
            const headers: HeadersInit = {};
            if (this.accessToken) {
                headers['Authorization'] = `Bearer ${this.accessToken}`;
            }
            return fetch(url, {
                method: 'POST',
                headers,
                body: formData,
            });
        };

        let response = await makeRequest();

        if (response.status === 401 && this.refreshToken) {
            const refreshed = await this.tryRefreshToken();
            if (refreshed) {
                response = await makeRequest();
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const detail = this.formatErrorDetail(error.detail);
            throw new Error(detail || error.message || `Upload failed: ${response.status}`);
        }

        return response.json();
    }

    async getResumeInfo(): Promise<ResumeInfo | null> {
        try {
            return await this.request('/api/v1/profile/resume');
        } catch {
            return null;
        }
    }

    async deleteResume(): Promise<{ message: string }> {
        return this.request('/api/v1/profile/resume', { method: 'DELETE' });
    }

    async analyzeResume(): Promise<ResumeAnalysis> {
        return this.request('/api/v1/profile/resume/analyze', { method: 'POST' });
    }

    async getResumeAnalysis(): Promise<ResumeAnalysis | null> {
        try {
            return await this.request('/api/v1/profile/resume/analysis');
        } catch {
            return null;
        }
    }

    async getResumeProjectHints(): Promise<ResumeProjectHints | null> {
        try {
            return await this.request('/api/v1/profile/resume/projects');
        } catch {
            return null;
        }
    }

    // Aptitude Endpoints - Student
    async getAptitudeQuestions(
        category?: string,
        difficulty?: string,
        page?: number,
        status?: string,
        includeInactive?: boolean,
        approvalStatus?: string
    ): Promise<AptitudeQuestionListResponse> {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (difficulty) params.append('difficulty', difficulty);
        if (status) params.append('status', status);
        if (page) params.append('page', page.toString());
        if (includeInactive) params.append('include_inactive', 'true');
        if (approvalStatus) params.append('approval_status', approvalStatus);
        return this.request(`/api/v1/aptitude/questions?${params.toString()}`);
    }
    async startAptitudeTest(category?: string): Promise<any> { return this.request('/api/v1/aptitude/test/start', { method: 'POST', body: JSON.stringify({ category }) }); }
    async submitAptitudeTest(testId: string, answers: Record<string, string>): Promise<any> { return this.request(`/api/v1/aptitude/test/${testId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }); }

    // Aptitude Endpoints - Officer Management
    async createQuestion(data: QuestionCreateData): Promise<AptitudeQuestion> {
        return this.request('/api/v1/aptitude/questions', { method: 'POST', body: JSON.stringify(data) });
    }
    async updateQuestion(id: string, data: QuestionUpdateData): Promise<AptitudeQuestion> {
        return this.request(`/api/v1/aptitude/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    }
    async deleteQuestion(id: string): Promise<void> {
        await this.request(`/api/v1/aptitude/questions/${id}`, { method: 'DELETE' });
    }
    async approveQuestion(id: string): Promise<AptitudeQuestion> {
        return this.request(`/api/v1/aptitude/questions/${id}/approve`, { method: 'POST' });
    }
    async rejectQuestion(id: string): Promise<AptitudeQuestion> {
        return this.request(`/api/v1/aptitude/questions/${id}/reject`, { method: 'POST' });
    }
    async getQuestionAuditLogs(params?: { question_id?: string; action?: string; page?: number; page_size?: number }): Promise<QuestionAuditLogListResponse> {
        const qs = new URLSearchParams();
        if (params?.question_id) qs.append('question_id', params.question_id);
        if (params?.action) qs.append('action', params.action);
        if (params?.page) qs.append('page', params.page.toString());
        if (params?.page_size) qs.append('page_size', params.page_size.toString());
        return this.request(`/api/v1/aptitude/questions/audit?${qs.toString()}`);
    }
    async getQuestionVersions(questionId: string, page?: number, page_size?: number): Promise<QuestionVersionListResponse> {
        const qs = new URLSearchParams();
        if (page) qs.append('page', page.toString());
        if (page_size) qs.append('page_size', page_size.toString());
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return this.request(`/api/v1/aptitude/questions/${questionId}/versions${suffix}`);
    }
    async getQuestionStats(): Promise<QuestionStatsResponse> {
        return this.request('/api/v1/aptitude/questions/stats');
    }

    async generateAptitudeQuestions(data: AIGenerateRequest): Promise<AIGenerateResponse> {
        return this.request('/api/v1/aptitude/questions/ai-generate', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }
    async bulkUploadQuestions(file: File): Promise<BulkUploadResponse> {
        const formData = new FormData();
        formData.append('file', file);
        const url = `${API_BASE_URL}/api/v1/aptitude/questions/bulk-upload`;
        const headers: HeadersInit = {};
        if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
        const response = await fetch(url, { method: 'POST', headers, body: formData });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Bulk upload failed');
        }
        return response.json();
    }
    async getCategories(): Promise<{ value: string; label: string }[]> {
        return this.request('/api/v1/aptitude/categories');
    }
    async getDifficulties(): Promise<{ value: string; label: string }[]> {
        return this.request('/api/v1/aptitude/difficulties');
    }

    // Interview Endpoints
    async startInterview(data: StartInterviewRequest): Promise<InterviewQuestionResponse> {
        return this.request('/api/v1/interview/start', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async submitInterviewAnswer(sessionId: string, answerText: string): Promise<AnswerEvaluationResponse> {
        return this.request(`/api/v1/interview/${sessionId}/answer`, {
            method: 'POST',
            body: JSON.stringify({ answer_text: answerText }),
        });
    }

    async completeInterview(sessionId: string): Promise<InterviewSessionResponse> {
        return this.request(`/api/v1/interview/${sessionId}/complete`, { method: 'POST' });
    }

    async getInterviewSession(sessionId: string): Promise<InterviewSessionResponse> {
        return this.request(`/api/v1/interview/${sessionId}`);
    }

    async getInterviewHistory(page: number = 1, pageSize: number = 10): Promise<InterviewHistoryResponse> {
        return this.request(`/api/v1/interview/history?page=${page}&page_size=${pageSize}`);
    }

    async getInterviewStats(): Promise<InterviewStatsResponse> {
        return this.request('/api/v1/interview/stats');
    }

    async getInterviewAnswers(sessionId: string): Promise<InterviewAnswerListResponse> {
        return this.request(`/api/v1/interview/${sessionId}/answers`);
    }

    // Placement Drives Endpoints
    async listDrives(params?: { status?: string; page?: number; page_size?: number }): Promise<DriveListResponse> {
        const query = new URLSearchParams();
        if (params?.status) query.append('status_filter', params.status);
        if (params?.page) query.append('page', params.page.toString());
        if (params?.page_size) query.append('page_size', params.page_size.toString());

        const endpoint = `/api/v1/drives${query.toString() ? `?${query.toString()}` : ''}`;
        return this.request(endpoint);
    }

    async getDrive(driveId: string): Promise<PlacementDrive> {
        return this.request(`/api/v1/drives/${driveId}`);
    }

    async createDrive(data: DriveCreateData): Promise<PlacementDrive> {
        return this.request('/api/v1/drives', { method: 'POST', body: JSON.stringify(data) });
    }

    async updateDrive(driveId: string, data: Partial<DriveCreateData>): Promise<PlacementDrive> {
        return this.request(`/api/v1/drives/${driveId}`, { method: 'PUT', body: JSON.stringify(data) });
    }

    async deleteDrive(driveId: string): Promise<void> {
        await this.request(`/api/v1/drives/${driveId}`, { method: 'DELETE' });
    }

    async getDriveStats(): Promise<DriveStatsResponse> {
        return this.request('/api/v1/drives/stats');
    }

    async applyToDrive(driveId: string, data?: { resume_url?: string; cover_letter?: string }): Promise<MyApplication> {
        return this.request(`/api/v1/drives/${driveId}/apply`, { method: 'POST', body: JSON.stringify(data || {}) });
    }

    async getMyApplications(): Promise<MyApplication[]> {
        return this.request('/api/v1/drives/my-applications');
    }

    async getDriveApplicants(driveId: string, status?: string): Promise<Applicant[]> {
        const endpoint = `/api/v1/drives/${driveId}/applicants${status ? `?status_filter=${status}` : ''}`;
        return this.request(endpoint);
    }

    async exportDriveApplicants(driveId: string, status?: string): Promise<Blob> {
        const query = status ? `?status_filter=${encodeURIComponent(status)}` : '';
        const url = `${API_BASE_URL}/api/v1/drives/${driveId}/applicants/export${query}`;
        const makeRequest = async () => {
            const headers: HeadersInit = {};
            if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
            return fetch(url, { method: 'GET', headers });
        };

        let response = await makeRequest();
        if (response.status === 401 && this.refreshToken) {
            const refreshed = await this.tryRefreshToken();
            if (refreshed) {
                response = await makeRequest();
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const detail = this.formatErrorDetail(error.detail);
            throw new Error(detail || error.message || `Request failed: ${response.status}`);
        }

        return response.blob();
    }

    async updateApplicationStatus(driveId: string, applicationId: string, status: string, notes?: string): Promise<Applicant> {
        return this.request(`/api/v1/drives/${driveId}/applicants/${applicationId}`, {
            method: 'PUT',
            body: JSON.stringify({ status, status_notes: notes }),
        });
    }

    async startDriveAssessment(driveId: string, stage: 'APTITUDE' | 'TECHNICAL'): Promise<DriveAssessmentStartResponse> {
        return this.request(`/api/v1/drives/${driveId}/assessments/${stage}/start`, {
            method: 'POST',
        });
    }

    async getActiveDriveAssessment(driveId: string, stage: 'APTITUDE' | 'TECHNICAL'): Promise<DriveAssessmentActiveResponse> {
        return this.request(`/api/v1/drives/${driveId}/assessments/${stage}/active`);
    }

    async submitDriveAssessment(
        driveId: string,
        stage: 'APTITUDE' | 'TECHNICAL',
        attemptId: string,
        data: SubmitAssessmentRequest
    ): Promise<DriveAssessmentSubmitResponse> {
        return this.request(`/api/v1/drives/${driveId}/assessments/${stage}/submit/${attemptId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Student Aptitude
    async startAssessment(data: StartAssessmentRequest): Promise<AssessmentStartResponse> {
        return this.request('/api/v1/student/aptitude/start', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getActiveAssessment(): Promise<ActiveAssessmentResponse> {
        return this.request('/api/v1/student/aptitude/active');
    }

    async submitAssessment(attemptId: string, data: SubmitAssessmentRequest): Promise<AttemptResponse> {
        return this.request(`/api/v1/student/aptitude/submit/${attemptId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async autoSaveAssessment(attemptId: string, data: { user_answers: Record<string, string | null> }): Promise<{ success: boolean }> {
        return this.request(`/api/v1/student/aptitude/autosave/${attemptId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getMyAttempts(): Promise<AttemptResponse[]> {
        return this.request('/api/v1/student/aptitude/attempts');
    }

    async getAttemptDetail(attemptId: string): Promise<AttemptDetailResponse> {
        return this.request(`/api/v1/student/aptitude/attempts/${attemptId}`);
    }

    async discardAttempt(attemptId: string): Promise<{ success: boolean }> {
        return this.request(`/api/v1/student/aptitude/attempts/${attemptId}`, {
            method: 'DELETE',
        });
    }

    async getStudentAptitudeDashboard(): Promise<StudentAptitudeDashboard> {
        return this.request('/api/v1/student/aptitude/dashboard');
    }
}

// Type definitions
export interface ProfileResponse {
    id: string;
    user_id: string;
    register_number: string | null;
    college_name: string | null;
    department: string | null;
    degree: string | null;
    current_year: number | null;
    graduation_year: number | null;
    cgpa: number | null;
    technical_skills: string[];
    soft_skills: Record<string, number>;
    preferred_roles: string[];
    preferred_domains: string[];
    resume_url: string | null;
    linkedin_url: string | null;
    github_url: string | null;
    portfolio_url: string | null;
    profile_status: 'INCOMPLETE' | 'COMPLETE';
    aptitude_score: number;
    interview_score: number;
    coding_score: number;
    overall_readiness: number;
    created_at: string;
    updated_at: string;
}

export interface ProfileUpdateData {
    register_number?: string;
    college_name?: string;
    department?: string;
    degree?: string;
    current_year?: number;
    graduation_year?: number;
    cgpa?: number;
    technical_skills?: string[];
    soft_skills?: { communication?: number; leadership?: number; teamwork?: number; problem_solving?: number; adaptability?: number };
    preferred_roles?: string[];
    preferred_domains?: string[];
    linkedin_url?: string;
    github_url?: string;
    portfolio_url?: string;
}

export interface ProfileStatusResponse {
    is_complete: boolean;
    status: string;
    missing_required: string[];
    missing_optional: string[];
    completion_percentage: number;
}

export interface ResumeInfo {
    id: string;
    original_filename: string;
    file_type: string;
    file_size_bytes: number;
    file_size_mb: number;
    uploaded_at: string;
    download_url: string;
}

export interface ResumeUploadResponse {
    success: boolean;
    message: string;
    resume?: ResumeInfo;
}

export interface ResumeAnalysis {
    id: string;
    student_id: string;
    resume_id: string | null;
    preferred_role: string | null;
    resume_score: number;
    skill_match_score: number;
    ats_score: number;
    content_score: number;
    project_score: number;
    extracted_skills: string[];
    missing_skills: string[];
    suggestions: string[];
    structured_data: Record<string, any>;
    analyzed_at: string;
}

export interface ResumeProjectHints {
    projects: string[];
    source: string;
}

// Aptitude Question Types
export interface AptitudeQuestion {
    id: string;
    question_text: string;
    options: Record<string, string>;
    correct_option: string;
    category: string;
    sub_topic?: string | null;
    difficulty: string;
    marks?: number;
    time_limit_seconds?: number | null;
    status?: string;
    approval_status?: string;
    approved_by?: string | null;
    approved_at?: string | null;
    role_tag?: string | null;
    version_number?: number;
    previous_version_id?: string | null;
    explanation: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AptitudeQuestionListResponse {
    questions: AptitudeQuestion[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface QuestionCreateData {
    question_text: string;
    options: Record<string, string>;
    correct_option: string;
    category: string;
    sub_topic?: string;
    difficulty: string;
    marks?: number;
    time_limit_seconds?: number;
    status?: string;
    role_tag?: string;
    explanation?: string;
}

export interface QuestionUpdateData {
    question_text?: string;
    options?: Record<string, string>;
    correct_option?: string;
    category?: string;
    sub_topic?: string;
    difficulty?: string;
    marks?: number;
    time_limit_seconds?: number;
    status?: string;
    role_tag?: string;
    explanation?: string;
}

export interface QuestionAuditLog {
    id: string;
    question_id: string | null;
    action: string;
    actor_id: string | null;
    before_data: Record<string, any> | null;
    after_data: Record<string, any> | null;
    created_at: string;
}

export interface QuestionAuditLogListResponse {
    logs: QuestionAuditLog[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface QuestionVersion {
    id: string;
    question_id: string;
    version_number: number;
    snapshot: Record<string, any>;
    changed_by: string | null;
    change_reason: string | null;
    changed_at: string;
}

export interface QuestionVersionListResponse {
    versions: QuestionVersion[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface QuestionStatsResponse {
    total: number;
    by_category: Record<string, number>;
    by_difficulty: Record<string, number>;
}

export interface AIGenerateRequest {
    count: number;
    category: string;
    difficulty: string;
    sub_topic?: string;
    role_tag?: string;
    marks?: number;
    time_limit_seconds?: number;
    status?: string;
    instructions?: string;
}

export interface AIGenerateResponse {
    success: boolean;
    created_count: number;
    errors: string[];
    questions: AptitudeQuestion[];
}

export interface BulkUploadResponse {
    success: boolean;
    created_count: number;
    errors: string[];
    message: string;
}

// Placement Drive Types
export interface PlacementDrive {
    id: string;
    company_name: string;
    company_logo_url: string | null;
    job_title: string;
    job_description: string;
    min_cgpa: number | null;
    allowed_departments: string[];
    allowed_graduation_years: number[];
    package_lpa: number | null;
    location: string | null;
    job_type: string | null;
    registration_deadline: string;
    drive_date: string;
    status: string;
    max_applications: number | null;
    application_count: number;
    created_at: string;
    aptitude_test_required: boolean;
    aptitude_question_count: number;
    aptitude_difficulty: string | null;
    aptitude_pass_percentage: number;
    technical_test_required: boolean;
    technical_question_count: number;
    technical_difficulty: string | null;
    technical_pass_percentage: number;
}

export interface DriveListResponse {
    drives: PlacementDrive[];
    total: number;
    page: number;
    page_size: number;
}

export interface DriveCreateData {
    company_name: string;
    job_title: string;
    job_description: string;
    registration_deadline: string;
    drive_date: string;
    company_logo_url?: string;
    min_cgpa?: number;
    allowed_departments?: string[];
    allowed_graduation_years?: number[];
    package_lpa?: number;
    location?: string;
    job_type?: string;
    max_applications?: number;
    aptitude_test_required?: boolean;
    aptitude_question_count?: number;
    aptitude_difficulty?: string | null;
    aptitude_pass_percentage?: number;
    technical_test_required?: boolean;
    technical_question_count?: number;
    technical_difficulty?: string | null;
    technical_pass_percentage?: number;
}

export interface DriveStatsResponse {
    total: number;
    by_status: Record<string, number>;
}

export interface MyApplication {
    id: string;
    drive_id: string;
    company_name: string;
    job_title: string;
    status: string;
    status_notes: string | null;
    applied_at: string;
    drive_date: string;
    aptitude_status?: string | null;
    aptitude_score?: number | null;
    technical_status?: string | null;
    technical_score?: number | null;
    aptitude_test_required?: boolean;
    aptitude_question_count?: number;
    aptitude_difficulty?: string | null;
    aptitude_pass_percentage?: number;
    technical_test_required?: boolean;
    technical_question_count?: number;
    technical_difficulty?: string | null;
    technical_pass_percentage?: number;
}

export interface Applicant {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    user_phone?: string | null;
    register_number?: string | null;
    department?: string | null;
    graduation_year?: number | null;
    cgpa?: number | null;
    resume_url: string | null;
    cover_letter: string | null;
    status: string;
    status_notes: string | null;
    aptitude_status?: string | null;
    aptitude_score?: number | null;
    technical_status?: string | null;
    technical_score?: number | null;
    applied_at: string;
}

// Student Aptitude Types
export interface StartAssessmentRequest {
    category?: string;
    count: number;
    difficulty?: string;
    mode?: 'PRACTICE' | 'TEST' | 'RESUME_ONLY';
    resume_question_count?: number;
}

export interface QuestionBrief {
    id: string;
    question_text: string;
    options: Record<string, string>;
    category: string;
    difficulty: string;
    sub_topic?: string | null;
    marks?: number;
    time_limit_seconds?: number | null;
}

export interface AssessmentStartResponse {
    attempt_id: string;
    questions: QuestionBrief[];
    total_questions: number;
    started_at: string;
    mode: 'PRACTICE' | 'TEST' | 'RESUME_ONLY';
    category?: string | null;
    difficulty?: string | null;
}

export interface ActiveAssessmentResponse extends AssessmentStartResponse {
    user_answers: Record<string, string | null>;
}

export interface DriveAssessmentStartResponse extends AssessmentStartResponse {
    stage: 'APTITUDE' | 'TECHNICAL';
    pass_percentage: number;
}

export interface DriveAssessmentActiveResponse extends ActiveAssessmentResponse {
    stage: 'APTITUDE' | 'TECHNICAL';
    pass_percentage: number;
}

export interface DriveAssessmentSubmitResponse extends AttemptResponse {
    stage: 'APTITUDE' | 'TECHNICAL';
    passed: boolean;
    pass_percentage: number;
}

export interface SubmitAssessmentRequest {
    user_answers: Record<string, string | null>;
    time_taken_seconds: number;
}

export interface AttemptResponse {
    id: string;
    category: string | null;
    total_questions: number;
    correct_answers: number;
    wrong_answers: number;
    skipped: number;
    score: number;
    time_taken_seconds: number;
    completed_at: string | null;
    started_at: string;
}

export interface DetailedAnswer {
    id: string;
    question_text: string;
    options: Record<string, string>;
    correct_option: string;
    selected_option: string | null;
    is_correct: boolean;
    marks?: number | null;
    explanation: string | null;
    category: string;
}

export interface AttemptDetailResponse {
    id: string;
    user_id: string;
    category: string | null;
    total_questions: number;
    correct_answers: number;
    wrong_answers: number;
    skipped: number;
    score: number;
    time_taken_seconds: number;
    started_at: string;
    completed_at: string | null;
    detailed_answers: DetailedAnswer[];
}

export interface TopicAnalysisItem {
    category: string;
    correct: number;
    total: number;
    accuracy: number;
}

export interface StudentAptitudeDashboard {
    total_attempts: number;
    average_score: number;
    best_score: number;
    topic_analysis: TopicAnalysisItem[];
}

// Interview Types
export type InterviewType = 'TECHNICAL' | 'HR' | 'BEHAVIORAL' | 'CASE_STUDY';
export type InterviewMode = 'TEXT' | 'VOICE';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

export interface StartInterviewRequest {
    interview_type: InterviewType;
    mode?: InterviewMode;
    difficulty?: DifficultyLevel;
    target_role?: string;
    target_company?: string;
}

export interface InterviewQuestionResponse {
    session_id: string;
    question_number: number;
    question_text: string;
    is_last_question: boolean;
    questions_remaining: number;
}

export interface AnswerEvaluationResponse {
    evaluation: {
        overall_score: number;
        relevance_score: number;
        clarity_score: number;
        depth_score: number;
        confidence_score: number;
        feedback: string;
        strengths: string[];
        improvements: string[];
    };
    next_question: string | null;
    question_number: number | null;
    is_complete: boolean;
    questions_remaining: number;
}

export interface ConversationItem {
    question_number: number;
    question: string;
    answer: string | null;
    evaluation: AnswerEvaluationResponse['evaluation'] | null;
    asked_at: string | null;
    answered_at: string | null;
}

export interface InterviewSessionResponse {
    id: string;
    interview_type: string;
    mode: InterviewMode | string;
    difficulty: DifficultyLevel | string;
    status: string;
    target_role: string | null;
    target_company: string | null;
    conversation: ConversationItem[];
    overall_score: number;
    technical_score: number | null;
    communication_score: number | null;
    confidence_score: number | null;
    feedback_summary: string | null;
    improvement_areas: string[] | null;
    started_at: string;
    ended_at: string | null;
    is_complete: boolean;
}

export interface InterviewSessionSummary {
    id: string;
    interview_type: string;
    mode: InterviewMode | string;
    difficulty: DifficultyLevel | string;
    status: string;
    target_role: string | null;
    overall_score: number;
    questions_answered: number;
    started_at: string;
    ended_at: string | null;
    is_complete: boolean;
}

export interface InterviewHistoryResponse {
    sessions: InterviewSessionSummary[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface InterviewStatsResponse {
    completed_interviews: number;
    average_score: number;
    best_score: number;
}

export interface InterviewAnswerItem {
    id: string;
    question_number: number;
    question_text: string;
    answer_text: string;
    overall_score: number;
    relevance_score: number;
    clarity_score: number;
    depth_score: number;
    confidence_score: number;
    feedback: string | null;
    strengths: string[] | null;
    improvements: string[] | null;
    answered_at: string;
}

export interface InterviewAnswerListResponse {
    session_id: string;
    answers: InterviewAnswerItem[];
}

export const api = new ApiClient();
