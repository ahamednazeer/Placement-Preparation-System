"""
AI Service for Interview Module.
Integrates with Groq LLM for question generation and answer evaluation.
"""
import json
from typing import Dict, Any, List, Optional

from groq import Groq

from app.core.config import settings
from app.core.constants import InterviewType, DifficultyLevel
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

RESUME CONTENT:
{resume_text[:2000] if resume_text else 'No resume uploaded'}

APTITUDE PERFORMANCE:
{json.dumps(aptitude_performance) if aptitude_performance else 'No data available'}

PREVIOUS Q&A IN THIS SESSION:
{qa_history if qa_history else 'This is the first question.'}

INSTRUCTIONS:
- Generate a single, clear question appropriate for {interview_type.value} interview
- Difficulty: {difficulty.value}
- If resume mentions specific projects/skills, ask about them
- Avoid repeating topics from previous questions
- For question #{question_number}:
  - Q1-3: Start with easier, warm-up style questions
  - Q4-7: Core competency and technical depth
  - Q8-10: Challenging, problem-solving questions

Return ONLY the question text, nothing else."""

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
            logger.info(f"Generated question #{question_number}: {question[:50]}...")
            return question
            
        except Exception as e:
            logger.error(f"Failed to generate question: {e}")
            # Fallback questions
            fallback_questions = {
                InterviewType.HR: "Tell me about yourself and why you're interested in this role.",
                InterviewType.TECHNICAL: "Can you explain a technical project you've worked on recently?",
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
