"""
FastAPI Application Entry Point.
Main application configuration and router setup.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.constants import API_V1_PREFIX
from app.startup import lifespan
from app.middleware.logging_middleware import LoggingMiddleware

# Import routers
from app.api.v1.auth.routes import router as auth_router
from app.api.v1.profile.routes import router as profile_router
from app.api.v1.aptitude.routes import router as aptitude_router
from app.api.v1.aptitude.student_routes import router as aptitude_student_router
from app.api.v1.drives.routes import router as drives_router
from app.api.v1.interview.routes import router as interview_router


def create_application() -> FastAPI:
    """
    Create and configure the FastAPI application.
    
    Returns:
        Configured FastAPI application instance.
    """
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="AI-Powered Placement Preparation System API",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )
    
    # Add CORS middleware - allow all origins for mobile app development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow all origins for Capacitor support
        allow_credentials=False,  # Must be False when using "*"
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
    
    # Add logging middleware
    app.add_middleware(LoggingMiddleware)
    
    # Register API routers
    app.include_router(auth_router, prefix=f"{API_V1_PREFIX}/auth", tags=["Authentication"])
    app.include_router(profile_router, prefix=f"{API_V1_PREFIX}/profile", tags=["Student Profile"])
    app.include_router(aptitude_router, prefix=API_V1_PREFIX, tags=["Aptitude Questions"])
    app.include_router(aptitude_student_router, prefix=API_V1_PREFIX, tags=["Student Aptitude"])
    app.include_router(drives_router, prefix=API_V1_PREFIX, tags=["Placement Drives"])
    app.include_router(interview_router, prefix=f"{API_V1_PREFIX}/interview", tags=["Mock Interview"])
    
    # Health check endpoint
    @app.get("/health", tags=["Health"])
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "app": settings.app_name,
            "version": settings.app_version,
        }
    
    # Root endpoint
    @app.get("/", tags=["Root"])
    async def root():
        """Root endpoint with API information."""
        return {
            "message": "Welcome to the Placement Preparation System API",
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/health",
        }
    
    return app


# Create application instance
app = create_application()


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
