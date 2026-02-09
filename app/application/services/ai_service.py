"""
AI Service for Interview Module.
Integrates with Groq LLM for question generation and answer evaluation.
"""
import json
import random
from typing import Dict, Any, List, Optional

from groq import Groq

from app.core.config import settings
from app.core.constants import InterviewType, DifficultyLevel, AptitudeCategory
from app.utils.logger import logger


# Best Groq models (as of Jan 2026)
LLM_MODEL = "llama-3.3-70b-versatile"  # Best for reasoning and generation
STT_MODEL = "whisper-large-v3"  # For speech-to-text


class AIService:
    """AI service for interview question generation and evaluation."""
    
    def __init__(self):
        self.client = Groq(api_key=settings.groq_api_key)
    
    async def generate_interview_question(
        self,
        interview_type: InterviewType,
        difficulty: DifficultyLevel,
        student_context: Dict[str, Any],
        previous_qa: List[Dict[str, Any]],
        question_number: int,
    ) -> str:
        """
        Generate a contextual interview question based on student profile and resume.
        
        Args:
            interview_type: Type of interview (HR, Technical, etc.)
            difficulty: Question difficulty level
            student_context: Student profile, skills, resume data
            previous_qa: Previous questions and answers in this session
            question_number: Current question number (1-10)
        
        Returns:
            Generated question text
        """
        # Build context from student data
        profile = student_context.get("profile", {})
        resume_text = student_context.get("resume_text", "")
        skills = student_context.get("skills", [])
        aptitude_performance = student_context.get("aptitude_performance", {})
        missing_skills = student_context.get("missing_skills", [])
        missing_skills_text = ", ".join([str(s) for s in missing_skills if str(s).strip()]) if missing_skills else "Not specified"
        resume_score = student_context.get("resume_score", 0)
        
        # Format previous Q&A for context
        qa_history = ""
        if previous_qa:
            qa_history = "\n".join([
                f"Q{i+1}: {qa.get('question', '')}\nA: {qa.get('answer', '')}"
                for i, qa in enumerate(previous_qa[-3:])  # Last 3 Q&A for context
            ])
        
        system_prompt = self._get_interviewer_system_prompt(interview_type, difficulty)
        
        user_prompt = f"""Generate interview question #{question_number} for this candidate.

CANDIDATE PROFILE:
- Name: {profile.get('first_name', 'Candidate')} {profile.get('last_name', '')}
- Department: {profile.get('department', 'Not specified')}
- Degree: {profile.get('degree', 'Not specified')}
- CGPA: {profile.get('cgpa', 'Not specified')}
- Technical Skills: {', '.join(skills) if skills else 'Not specified'}
- Preferred Roles: {', '.join(profile.get('preferred_roles', [])) if profile.get('preferred_roles') else 'Not specified'}
- Missing Skills (from resume analysis): {missing_skills_text}
- Resume Score: {resume_score}

RESUME CONTENT:
{resume_text[:2000] if resume_text else 'No resume uploaded'}

APTITUDE PERFORMANCE:
{json.dumps(aptitude_performance) if aptitude_performance else 'No data available'}

PREVIOUS Q&A IN THIS SESSION:
{qa_history if qa_history else 'This is the first question.'}

INSTRUCTIONS:
- Generate a single, clear question appropriate for {interview_type.value} interview
- Difficulty: {difficulty.value}
- If resume mentions specific projects/skills, ask about the technical skills (avoid personal identifiers)
- For TECHNICAL interviews, prioritize skills listed and optionally probe missing skills
- Avoid repeating topics from previous questions
- For question #{question_number}:
  - Q1-3: Start with easier, warm-up style questions
  - Q4-7: Core competency and technical depth
  - Q8-10: Challenging, problem-solving questions

Return ONLY the question text, nothing else."""

        last_error: Optional[Exception] = None
        for attempt in range(2):
            try:
                response = self.client.chat.completions.create(
                    model=LLM_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.7,
                    max_tokens=300,
                )
                
                question = response.choices[0].message.content.strip()
                if question:
                    logger.info(f"Generated question #{question_number}: {question[:50]}...")
                    return question
            except Exception as e:
                last_error = e
                logger.error(f"Failed to generate question (attempt {attempt + 1}): {e}")

        if last_error:
            logger.error(f"Failed to generate question after retries: {last_error}")

        # Fallback questions
        fallback_questions = {
            InterviewType.HR: "Tell me about yourself and why you're interested in this role.",
            InterviewType.TECHNICAL: "Can you walk me through a recent technical challenge you solved?",
            InterviewType.BEHAVIORAL: "Describe a challenging situation you faced and how you handled it.",
            InterviewType.CASE_STUDY: "How would you approach solving a problem with limited information?",
        }
        return fallback_questions.get(interview_type, fallback_questions[InterviewType.HR])
    
    async def evaluate_answer(
        self,
        question: str,
        answer: str,
        interview_type: InterviewType,
        student_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Evaluate a candidate's answer.
        
        Returns:
            Dict with score (0-10), feedback, and individual metrics
        """
        system_prompt = """You are an expert interview evaluator. Analyze the candidate's answer and provide:
1. An overall score from 0-10
2. Scores for: relevance, clarity, depth, confidence (each 0-10)
3. Brief, constructive feedback (2-3 sentences)
4. Key strengths (1-2 points)
5. Areas to improve (1-2 points)

Respond in JSON format only."""

        user_prompt = f"""Evaluate this {interview_type.value} interview answer:

QUESTION: {question}

CANDIDATE'S ANSWER: {answer}

CANDIDATE BACKGROUND:
- Department: {student_context.get('profile', {}).get('department', 'Not specified')}
- Skills: {', '.join(student_context.get('skills', []))}

Respond with JSON:
{{
    "overall_score": <0-10>,
    "relevance_score": <0-10>,
    "clarity_score": <0-10>,
    "depth_score": <0-10>,
    "confidence_score": <0-10>,
    "feedback": "<constructive feedback>",
    "strengths": ["<strength1>", "<strength2>"],
    "improvements": ["<improvement1>", "<improvement2>"]
}}"""

        try:
            response = self.client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=500,
                response_format={"type": "json_object"},
            )
            
            result = json.loads(response.choices[0].message.content)
            logger.info(f"Evaluated answer - Score: {result.get('overall_score', 0)}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to evaluate answer: {e}")
            return {
                "overall_score": 5,
                "relevance_score": 5,
                "clarity_score": 5,
                "depth_score": 5,
                "confidence_score": 5,
                "feedback": "Thank you for your answer. Keep practicing for more detailed feedback.",
                "strengths": ["Attempted to answer the question"],
                "improvements": ["Provide more specific examples"],
            }

    async def generate_aptitude_questions(
        self,
        category: AptitudeCategory,
        difficulty: DifficultyLevel,
        count: int,
        sub_topic: Optional[str] = None,
        role_tag: Optional[str] = None,
        marks: int = 1,
        time_limit_seconds: Optional[int] = None,
        instructions: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate aptitude MCQ questions as JSON.
        
        Returns:
            List of dicts with question_text, options, correct_option, explanation, sub_topic
        """
        if not settings.groq_api_key:
            raise RuntimeError("Groq API key is not configured")

        system_prompt = """You are an expert aptitude test creator.
Generate high-quality multiple-choice questions (MCQs).
Requirements:
- Exactly four options (A, B, C, D)
- Exactly one correct option
- Clear, unambiguous wording
- Provide a concise explanation for the correct answer
- Avoid trick questions and ambiguous phrasing
Return JSON only."""

        user_prompt = f"""Generate {count} unique aptitude questions.

CATEGORY: {category.value}
DIFFICULTY: {difficulty.value}
SUB-TOPIC: {sub_topic or "Any"}
ROLE TAG: {role_tag or "N/A"}
MARKS: {marks}
TIME LIMIT (seconds): {time_limit_seconds or "N/A"}
EXTRA INSTRUCTIONS: {instructions or "None"}

Return a JSON object exactly like:
{{
  "questions": [
    {{
      "question_text": "...",
      "options": {{ "A": "...", "B": "...", "C": "...", "D": "..." }},
      "correct_option": "A",
      "explanation": "...",
      "sub_topic": "..."
    }}
  ]
}}
"""

        response = self.client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=min(1200, 250 * max(1, count)),
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        data = json.loads(content) if content else {}
        questions = data.get("questions", data if isinstance(data, list) else [])

        if not isinstance(questions, list):
            raise ValueError("AI response did not contain a questions list")

        return questions
    
    async def generate_feedback_summary(
        self,
        interview_type: InterviewType,
        conversation: List[Dict[str, Any]],
        student_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate comprehensive feedback summary for the entire interview.
        
        Returns:
            Dict with overall assessment, strengths, weaknesses, suggestions
        """
        # Format all Q&A
        qa_summary = "\n\n".join([
            f"Q{i+1}: {qa.get('question', '')}\nAnswer: {qa.get('answer', '')}\nScore: {qa.get('evaluation', {}).get('overall_score', 'N/A')}/10"
            for i, qa in enumerate(conversation)
        ])
        
        system_prompt = """You are a senior HR professional providing final interview feedback.
Create a comprehensive, encouraging yet honest assessment.
Respond in JSON format only."""

        user_prompt = f"""Generate final feedback for this {interview_type.value} interview:

INTERVIEW TRANSCRIPT:
{qa_summary}

CANDIDATE PROFILE:
- Department: {student_context.get('profile', {}).get('department', 'Not specified')}
- Skills: {', '.join(student_context.get('skills', []))}

Provide JSON response:
{{
    "overall_assessment": "<2-3 sentence summary>",
    "overall_score": <0-100>,
    "communication_score": <0-100>,
    "technical_score": <0-100>,
    "confidence_score": <0-100>,
    "strengths": ["<strength1>", "<strength2>", "<strength3>"],
    "weaknesses": ["<weakness1>", "<weakness2>"],
    "improvement_suggestions": ["<suggestion1>", "<suggestion2>", "<suggestion3>"],
    "recommended_topics_to_study": ["<topic1>", "<topic2>"],
    "interview_readiness": "<not_ready|needs_practice|interview_ready|exceptional>"
}}"""

        try:
            response = self.client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.4,
                max_tokens=800,
                response_format={"type": "json_object"},
            )
            
            result = json.loads(response.choices[0].message.content)
            logger.info(f"Generated feedback summary - Overall: {result.get('overall_score', 0)}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to generate feedback summary: {e}")
            # Calculate average from individual scores
            scores = [qa.get("evaluation", {}).get("overall_score", 5) for qa in conversation]
            avg_score = sum(scores) / len(scores) * 10 if scores else 50
            
            return {
                "overall_assessment": "Thank you for completing the interview. Continue practicing to improve.",
                "overall_score": round(avg_score, 1),
                "communication_score": round(avg_score, 1),
                "technical_score": round(avg_score, 1),
                "confidence_score": round(avg_score, 1),
                "strengths": ["Completed the interview", "Showed effort"],
                "weaknesses": ["More practice needed"],
                "improvement_suggestions": ["Practice regularly", "Prepare specific examples", "Research common questions"],
                "recommended_topics_to_study": ["Interview preparation", "Communication skills"],
                "interview_readiness": "needs_practice",
            }

    async def analyze_resume(
        self,
        resume_text: str,
        preferred_role: Optional[str],
        existing_skills: List[str],
    ) -> Dict[str, Any]:
        """
        Analyze a resume and return structured insights.
        
        Returns:
            Dict with structured data, scores, missing skills, suggestions
        """
        system_prompt = """You are a resume analysis engine. Extract structured information and score the resume.
Respond in JSON only with these fields:
{
  "structured": { "name": "", "email": "", "education": "", "experience_years": 0, "projects": 0 },
  "extracted_skills": [],
  "skill_match_score": 0,
  "ats_score": 0,
  "content_score": 0,
  "project_score": 0,
  "missing_skills": [],
  "suggestions": []
}
All scores must be 0-100."""

        role_text = preferred_role or "Not specified"
        user_prompt = f"""Analyze this resume and return JSON only.

PREFERRED ROLE: {role_text}
EXISTING SKILLS (from profile): {', '.join(existing_skills) if existing_skills else 'None'}

RESUME TEXT:
{resume_text}

INSTRUCTIONS:
- Extract core fields into "structured"
- Normalize skills (e.g., JS -> JavaScript)
- Provide missing skills for the preferred role if possible
- Provide ATS, content, project, and skill match scores (0-100)
- Suggestions should be short action items (max 10)
"""

        try:
            response = self.client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=900,
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Resume analysis failed: {e}")
            return {
                "structured": {},
                "extracted_skills": existing_skills,
                "skill_match_score": 50,
                "ats_score": 50,
                "content_score": 50,
                "project_score": 50,
                "missing_skills": [],
                "suggestions": [
                    "Add measurable outcomes to projects",
                    "Include more role-specific keywords",
                    "Improve formatting for ATS clarity",
                ],
            }

    async def generate_resume_based_questions(
        self,
        resume_text: str,
        preferred_role: Optional[str],
        difficulty: DifficultyLevel,
        count: int = 3,
        skill_hints: Optional[List[str]] = None,
        project_hints: Optional[List[str]] = None,
        avoid_questions: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generate resume-based aptitude/technical MCQs.
        Returns list of {question_text, options:{A..D}, correct_option, explanation, category, marks}.
        """
        skill_hints = [s.strip() for s in (skill_hints or []) if str(s).strip()]
        project_hints = [p.strip() for p in (project_hints or []) if str(p).strip()]
        skill_text = ", ".join(skill_hints) if skill_hints else "None"
        avoid_questions = [str(q).strip() for q in (avoid_questions or []) if str(q).strip()]
        avoid_text = " | ".join(avoid_questions[:10]) if avoid_questions else "None"
        if skill_hints:
            shuffled = list(skill_hints)
            random.shuffle(shuffled)
            skill_text = ", ".join(shuffled)

        system_prompt = """You are an assessment generator. Create multiple-choice questions (MCQ) based on a student's resume.
Return JSON only:
{
  "questions": [
    {
      "question_text": "",
      "skill_reference": "",
      "options": {"A": "", "B": "", "C": "", "D": ""},
      "correct_option": "A",
      "explanation": "",
      "category": "RESUME",
      "marks": 1
    }
  ]
}
Rules:
- Questions must test technical knowledge of skills listed in SKILL_HINTS
- Do NOT ask questions that only confirm resume facts (e.g., "Which skills are listed")
- 4 options exactly, one correct option
- Keep explanations short
- Category should be RESUME
- If SKILL_HINTS are provided, each question MUST reference at least one skill from SKILL_HINTS
- skill_reference must be one item from SKILL_HINTS when provided
- question_text must include the exact skill_reference text
- Questions MUST be skill/technology/project/role focused.
- Do NOT ask about personal identifiers or education details (name, institute, college, university, school, CGPA/GPA, phone, email, address, date of birth, registration number).
- Do NOT mention specific project names from the resume.
"""
        user_prompt = f"""Generate {count} MCQ questions based on this resume.

Preferred role: {preferred_role or "Not specified"}
Difficulty: {difficulty.value}
SKILL_HINTS: {skill_text}
AVOID_QUESTIONS: {avoid_text}

Resume text:
{resume_text[:5000]}
"""
        try:
            response = self.client.chat.completions.create(
                model=LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.4,
                max_tokens=1200,
                response_format={"type": "json_object"},
            )
            payload = json.loads(response.choices[0].message.content)
            questions = payload.get("questions") if isinstance(payload, dict) else []
            valid: List[Dict[str, Any]] = []
            blocked_terms = [
                "institute", "college", "university", "school", "campus",
                "cgpa", "gpa", "grade", "percentage", "marksheet",
                "phone", "email", "address", "dob", "date of birth",
                "registration", "register number", "roll number",
                "explicitly listed", "listed in the resume", "mentioned in the resume", "in the resume", "resume",
                "project",
            ]
            avoid_set = {q.lower() for q in avoid_questions}

            skill_hint_set = {s.lower() for s in skill_hints}
            primary_valid: List[Dict[str, Any]] = []
            secondary_valid: List[Dict[str, Any]] = []

            for q in questions or []:
                options = q.get("options") or {}
                if not q.get("question_text"):
                    continue
                question_text = str(q.get("question_text", "")).strip()
                lowered = question_text.lower()
                if any(avoid in lowered for avoid in avoid_set):
                    continue
                if any(term in lowered for term in blocked_terms):
                    continue
                if not isinstance(options, dict) or set(options.keys()) != {"A", "B", "C", "D"}:
                    continue
                correct = str(q.get("correct_option", "")).upper()
                if correct not in options:
                    continue
                if skill_hints:
                    skill_match = any(skill in lowered for skill in skill_hint_set)
                    if not skill_match:
                        continue
                primary_valid.append({
                    "question_text": question_text,
                    "options": {k: str(v).strip() for k, v in options.items()},
                    "correct_option": correct,
                    "explanation": str(q.get("explanation") or "").strip() or None,
                    "category": "RESUME",
                    "marks": int(q.get("marks") or 1),
                })
            combined = primary_valid
            if len(combined) < count and secondary_valid:
                combined.extend(secondary_valid)
            return combined[:count]
        except Exception as e:
            logger.error(f"Resume-based question generation failed: {e}")
            return []
    
    async def transcribe_audio(self, audio_file_path: str) -> str:
        """
        Transcribe audio to text using Whisper.
        Used as fallback when native STT is not available.
        
        Args:
            audio_file_path: Path to audio file
            
        Returns:
            Transcribed text
        """
        try:
            with open(audio_file_path, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    model=STT_MODEL,
                    file=audio_file,
                    language="en",
                    prompt="This is an interview answer. The speaker is answering questions clearly.",
                    temperature=0.0,  # Lower temperature for more accurate transcription
                )
            return response.text
        except Exception as e:
            logger.error(f"Failed to transcribe audio: {e}")
            return ""
    
    def _get_interviewer_system_prompt(
        self, 
        interview_type: InterviewType, 
        difficulty: DifficultyLevel
    ) -> str:
        """Get system prompt based on interview type."""
        base_prompt = """You are an experienced interviewer conducting a mock interview. 
Your goal is to help candidates prepare for real interviews by asking relevant, 
professional questions based on their background."""
        
        type_specifics = {
            InterviewType.HR: """
Focus on:
- Motivation and career goals
- Cultural fit and values
- Communication and interpersonal skills
- Strengths, weaknesses, and self-awareness
- Situational and behavioral questions (STAR method)""",
            
            InterviewType.TECHNICAL: """
Focus on:
- Technical skills mentioned in resume
- Problem-solving approach
- Coding concepts and system design
- Project experience and challenges
- Domain-specific knowledge""",
            
            InterviewType.BEHAVIORAL: """
Focus on:
- Past experiences using STAR method
- Teamwork and leadership
- Conflict resolution
- Adaptability and learning
- Decision-making process""",
            
            InterviewType.CASE_STUDY: """
Focus on:
- Analytical thinking
- Structured problem-solving
- Business acumen
- Creativity and innovation
- Quantitative reasoning""",
        }
        
        difficulty_guidance = {
            DifficultyLevel.EASY: "Ask straightforward, foundational questions. Be encouraging.",
            DifficultyLevel.MEDIUM: "Ask moderately challenging questions that require some depth.",
            DifficultyLevel.HARD: "Ask challenging questions that test deep understanding and problem-solving.",
        }
        
        return f"""{base_prompt}

INTERVIEW TYPE: {interview_type.value}
{type_specifics.get(interview_type, type_specifics[InterviewType.HR])}

DIFFICULTY: {difficulty.value}
{difficulty_guidance.get(difficulty, difficulty_guidance[DifficultyLevel.MEDIUM])}"""


# Singleton instance
_ai_service: Optional[AIService] = None


def get_ai_service() -> AIService:
    """Get or create AI service singleton."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
