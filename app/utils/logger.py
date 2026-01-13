"""
Logging configuration for the application.
"""
import logging
import sys
from typing import Optional

from app.core.config import settings


def setup_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Set up and return a configured logger.
    
    Args:
        name: Logger name. Defaults to root logger.
        
    Returns:
        Configured logger instance.
    """
    logger = logging.getLogger(name or "placement_prep")
    
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
        logger.addHandler(handler)
    
    logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)
    logger.propagate = False
    
    return logger


# Default application logger
logger = setup_logger()
