"""
Startup and shutdown event handlers.
Initializes database connections and other startup tasks.
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.infrastructure.database.session import init_db, close_db
from app.utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan handler.
    Runs startup and shutdown logic.
    
    Args:
        app: FastAPI application instance.
    """
    # Startup
    logger.info("Starting up Placement Preparation System...")
    
    try:
        # Initialize database
        await init_db()
        logger.info("Database initialized successfully")
        
        yield
        
    finally:
        # Shutdown
        logger.info("Shutting down Placement Preparation System...")
        
        # Close database connections
        await close_db()
        logger.info("Database connections closed")
