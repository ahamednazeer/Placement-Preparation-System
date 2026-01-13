"""
Database session management with async SQLAlchemy.
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Create async session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides a database session.
    Automatically handles commit/rollback and session cleanup.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for database session.
    Use this when you need a session outside of FastAPI dependency injection.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables and add any missing columns."""
    from sqlalchemy import text
    
    async with engine.begin() as conn:
        # Create all tables if they don't exist
        await conn.run_sync(Base.metadata.create_all)
        
        # Add ALL missing columns to student_profiles
        # This includes both original columns and new Module 3 columns
        all_columns = [
            # Original columns that might be missing
            ("college_name", "VARCHAR(255) DEFAULT NULL"),
            ("department", "VARCHAR(100) DEFAULT NULL"),
            ("degree", "VARCHAR(100) DEFAULT NULL"),
            ("graduation_year", "INTEGER DEFAULT NULL"),
            ("cgpa", "FLOAT DEFAULT NULL"),
            ("resume_url", "VARCHAR(500) DEFAULT NULL"),
            ("linkedin_url", "VARCHAR(500) DEFAULT NULL"),
            ("github_url", "VARCHAR(500) DEFAULT NULL"),
            ("portfolio_url", "VARCHAR(500) DEFAULT NULL"),
            ("aptitude_score", "FLOAT DEFAULT 0.0 NOT NULL"),
            ("interview_score", "FLOAT DEFAULT 0.0 NOT NULL"),
            ("coding_score", "FLOAT DEFAULT 0.0 NOT NULL"),
            ("overall_readiness", "FLOAT DEFAULT 0.0 NOT NULL"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL"),
            # New Module 3 columns
            ("register_number", "VARCHAR(50) DEFAULT NULL"),
            ("current_year", "INTEGER DEFAULT NULL"),
            ("technical_skills", "JSONB DEFAULT '[]'::jsonb"),
            ("soft_skills", "JSONB DEFAULT '{}'::jsonb"),
            ("preferred_roles", "JSONB DEFAULT '[]'::jsonb"),
            ("preferred_domains", "JSONB DEFAULT '[]'::jsonb"),
            ("profile_status", "VARCHAR(20) DEFAULT 'INCOMPLETE' NOT NULL"),
        ]
        
        for col_name, col_type in all_columns:
            try:
                # Check if column exists first
                check_result = await conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'student_profiles' AND column_name = '{col_name}'
                """))
                if not check_result.fetchone():
                    await conn.execute(text(
                        f"ALTER TABLE student_profiles ADD COLUMN {col_name} {col_type}"
                    ))
                    print(f"Added column: {col_name}")
            except Exception as e:
                print(f"Column migration for {col_name}: {e}")
        
        # Drop and recreate resumes table to ensure correct schema
        try:
            await conn.execute(text("DROP TABLE IF EXISTS resumes CASCADE"))
            await conn.execute(text("""
                CREATE TABLE resumes (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    file_path VARCHAR(500) NOT NULL,
                    file_type VARCHAR(10) NOT NULL,
                    original_filename VARCHAR(255) NOT NULL,
                    file_size_bytes INTEGER NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE NOT NULL,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_resumes_student_id ON resumes(student_id)"
            ))
            print("Resumes table created successfully")
        except Exception as e:
            print(f"Resumes table creation: {e}")


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()
