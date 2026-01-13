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

class ApiClient {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.accessToken = localStorage.getItem('access_token');
            this.refreshToken = localStorage.getItem('refresh_token');
        }
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
            throw new Error(error.detail || `Request failed: ${response.status}`);
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
        const headers: HeadersInit = {};
        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Upload failed: ${response.status}`);
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

    // Aptitude Endpoints - Student
    async getAptitudeQuestions(category?: string, difficulty?: string, page?: number): Promise<AptitudeQuestionListResponse> {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (difficulty) params.append('difficulty', difficulty);
        if (page) params.append('page', page.toString());
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
    async getQuestionStats(): Promise<QuestionStatsResponse> {
        return this.request('/api/v1/aptitude/questions/stats');
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

    async updateApplicationStatus(driveId: string, applicationId: string, status: string, notes?: string): Promise<Applicant> {
        return this.request(`/api/v1/drives/${driveId}/applicants/${applicationId}`, {
            method: 'PUT',
            body: JSON.stringify({ status, status_notes: notes }),
        });
    }

    // Student Aptitude
    async startAssessment(data: StartAssessmentRequest): Promise<AssessmentStartResponse> {
        return this.request('/api/v1/student/aptitude/start', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async submitAssessment(attemptId: string, data: SubmitAssessmentRequest): Promise<AttemptResponse> {
        return this.request(`/api/v1/student/aptitude/submit/${attemptId}`, {
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

// Aptitude Question Types
export interface AptitudeQuestion {
    id: string;
    question_text: string;
    options: Record<string, string>;
    correct_option: string;
    category: string;
    difficulty: string;
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
    difficulty: string;
    explanation?: string;
}

export interface QuestionUpdateData {
    question_text?: string;
    options?: Record<string, string>;
    correct_option?: string;
    category?: string;
    difficulty?: string;
    explanation?: string;
}

export interface QuestionStatsResponse {
    total: number;
    by_category: Record<string, number>;
    by_difficulty: Record<string, number>;
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
}

export interface Applicant {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    resume_url: string | null;
    cover_letter: string | null;
    status: string;
    status_notes: string | null;
    applied_at: string;
}

// Student Aptitude Types
export interface StartAssessmentRequest {
    category?: string;
    count: number;
}

export interface QuestionBrief {
    id: string;
    question_text: string;
    options: Record<string, string>;
    category: string;
}

export interface AssessmentStartResponse {
    attempt_id: string;
    questions: QuestionBrief[];
    total_questions: number;
    started_at: string;
}

export interface SubmitAssessmentRequest {
    user_answers: Record<string, string | null>;
    time_taken_seconds: number;
}

export interface AttemptResponse {
    id: string;
    category: string | null;
    total_questions: number;
    score: number;
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

export const api = new ApiClient();
