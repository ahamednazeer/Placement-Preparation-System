"""
Student Profile domain entity.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class StudentProfileEntity:
    """Student profile domain entity."""
    
    id: str
    user_id: str
    
    # Academic Info
    college_name: Optional[str] = None
    department: Optional[str] = None
    degree: Optional[str] = None
    graduation_year: Optional[int] = None
    cgpa: Optional[float] = None
    
    # Professional Info
    skills: List[str] = field(default_factory=list)
    resume_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    
    # Scores
    aptitude_score: float = 0.0
    interview_score: float = 0.0
    coding_score: float = 0.0
    overall_readiness: float = 0.0
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    @property
    def is_profile_complete(self) -> bool:
        """Check if the profile has all required fields."""
        return all([
            self.college_name,
            self.department,
            self.graduation_year,
            self.cgpa is not None,
        ])
    
    @property
    def has_resume(self) -> bool:
        """Check if resume is uploaded."""
        return self.resume_url is not None
    
    def calculate_readiness(self) -> float:
        """
        Calculate overall readiness score.
        Weighted average of aptitude, interview, and coding scores.
        """
        weights = {
            'aptitude': 0.3,
            'interview': 0.4,
            'coding': 0.3,
        }
        
        self.overall_readiness = (
            self.aptitude_score * weights['aptitude'] +
            self.interview_score * weights['interview'] +
            self.coding_score * weights['coding']
        )
        
        return self.overall_readiness
    
    def add_skill(self, skill: str) -> None:
        """Add a skill if not already present."""
        skill = skill.strip().lower()
        if skill and skill not in self.skills:
            self.skills.append(skill)
            self.updated_at = datetime.utcnow()
    
    def remove_skill(self, skill: str) -> None:
        """Remove a skill if present."""
        skill = skill.strip().lower()
        if skill in self.skills:
            self.skills.remove(skill)
            self.updated_at = datetime.utcnow()
    
    def update_score(self, category: str, score: float) -> None:
        """
        Update a specific score category.
        
        Args:
            category: 'aptitude', 'interview', or 'coding'
            score: Score value (0-100)
        """
        score = max(0.0, min(100.0, score))  # Clamp to 0-100
        
        if category == 'aptitude':
            self.aptitude_score = score
        elif category == 'interview':
            self.interview_score = score
        elif category == 'coding':
            self.coding_score = score
        
        self.calculate_readiness()
        self.updated_at = datetime.utcnow()
