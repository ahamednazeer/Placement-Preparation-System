"""
Score value object.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Score:
    """Immutable score value object (0-100 range)."""
    
    value: float
    
    def __post_init__(self):
        """Validate score range."""
        if not 0 <= self.value <= 100:
            # Use object.__setattr__ for frozen dataclass
            object.__setattr__(self, 'value', max(0.0, min(100.0, self.value)))
    
    def __str__(self) -> str:
        return f"{self.value:.1f}%"
    
    @property
    def is_passing(self) -> bool:
        """Check if score is passing (>= 60%)."""
        return self.value >= 60.0
    
    @property
    def is_excellent(self) -> bool:
        """Check if score is excellent (>= 90%)."""
        return self.value >= 90.0
    
    @property
    def grade(self) -> str:
        """Get letter grade for the score."""
        if self.value >= 90:
            return "A"
        elif self.value >= 80:
            return "B"
        elif self.value >= 70:
            return "C"
        elif self.value >= 60:
            return "D"
        else:
            return "F"
    
    def __float__(self) -> float:
        return self.value
    
    def __int__(self) -> int:
        return int(self.value)
