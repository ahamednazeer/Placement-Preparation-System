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
        
        # Add missing columns to aptitude_questions
        aptitude_columns = [
            ("sub_topic", "VARCHAR(100) DEFAULT NULL"),
            ("role_tag", "VARCHAR(100) DEFAULT NULL"),
            ("marks", "INTEGER DEFAULT 1 NOT NULL"),
            ("time_limit_seconds", "INTEGER DEFAULT NULL"),
            ("status", "VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL"),
            ("approval_status", "VARCHAR(20) DEFAULT 'APPROVED' NOT NULL"),
            ("approved_by", "UUID DEFAULT NULL"),
            ("approved_at", "TIMESTAMP DEFAULT NULL"),
            ("version_number", "INTEGER DEFAULT 1 NOT NULL"),
            ("previous_version_id", "UUID DEFAULT NULL"),
        ]
        
        for col_name, col_type in aptitude_columns:
            try:
                check_result = await conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'aptitude_questions' AND column_name = '{col_name}'
                """))
                if not check_result.fetchone():
                    await conn.execute(text(
                        f"ALTER TABLE aptitude_questions ADD COLUMN {col_name} {col_type}"
                    ))
                    print(f"Added aptitude_questions column: {col_name}")
            except Exception as e:
                print(f"Aptitude column migration for {col_name}: {e}")

        # Add missing columns to aptitude_attempts
        attempt_columns = [
            ("mode", "VARCHAR(20) DEFAULT 'PRACTICE' NOT NULL"),
            ("status", "VARCHAR(20) DEFAULT 'IN_PROGRESS' NOT NULL"),
            ("difficulty", "VARCHAR(20) DEFAULT NULL"),
            ("question_ids", "JSONB DEFAULT NULL"),
            ("option_orders", "JSONB DEFAULT NULL"),
            ("generated_questions", "JSONB DEFAULT NULL"),
        ]
        for col_name, col_type in attempt_columns:
            try:
                check_result = await conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'aptitude_attempts' AND column_name = '{col_name}'
                """))
                if not check_result.fetchone():
                    await conn.execute(text(
                        f"ALTER TABLE aptitude_attempts ADD COLUMN {col_name} {col_type}"
                    ))
                    print(f"Added aptitude_attempts column: {col_name}")
            except Exception as e:
                print(f"Aptitude attempts column migration for {col_name}: {e}")

        # Add missing columns to interview_sessions
        interview_columns = [
            ("mode", "VARCHAR(20) DEFAULT 'TEXT' NOT NULL"),
            ("difficulty", "VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL"),
            ("status", "VARCHAR(20) DEFAULT 'IN_PROGRESS' NOT NULL"),
        ]
        for col_name, col_type in interview_columns:
            try:
                check_result = await conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'interview_sessions' AND column_name = '{col_name}'
                """))
                if not check_result.fetchone():
                    await conn.execute(text(
                        f"ALTER TABLE interview_sessions ADD COLUMN {col_name} {col_type}"
                    ))
                    print(f"Added interview_sessions column: {col_name}")
            except Exception as e:
                print(f"Interview sessions column migration for {col_name}: {e}")

        # Add missing columns to placement_drives (assessment settings)
        drive_assessment_columns = [
            ("aptitude_test_required", "BOOLEAN DEFAULT FALSE NOT NULL"),
            ("aptitude_question_count", "INTEGER DEFAULT 10 NOT NULL"),
            ("aptitude_difficulty", "VARCHAR(20) DEFAULT NULL"),
            ("aptitude_pass_percentage", "FLOAT DEFAULT 60.0 NOT NULL"),
            ("technical_test_required", "BOOLEAN DEFAULT FALSE NOT NULL"),
            ("technical_question_count", "INTEGER DEFAULT 10 NOT NULL"),
            ("technical_difficulty", "VARCHAR(20) DEFAULT NULL"),
            ("technical_pass_percentage", "FLOAT DEFAULT 60.0 NOT NULL"),
        ]
        for col_name, col_type in drive_assessment_columns:
            try:
                check_result = await conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'placement_drives' AND column_name = '{col_name}'
                """))
                if not check_result.fetchone():
                    await conn.execute(text(
                        f"ALTER TABLE placement_drives ADD COLUMN {col_name} {col_type}"
                    ))
                    print(f"Added placement_drives column: {col_name}")
            except Exception as e:
                print(f"Placement drives column migration for {col_name}: {e}")

        # Add missing columns to drive_applications (assessment tracking)
        application_assessment_columns = [
            ("aptitude_attempt_id", "UUID DEFAULT NULL"),
            ("aptitude_status", "VARCHAR(20) DEFAULT 'NOT_STARTED' NOT NULL"),
            ("aptitude_score", "FLOAT DEFAULT NULL"),
            ("technical_attempt_id", "UUID DEFAULT NULL"),
            ("technical_status", "VARCHAR(20) DEFAULT 'NOT_STARTED' NOT NULL"),
            ("technical_score", "FLOAT DEFAULT NULL"),
        ]
        for col_name, col_type in application_assessment_columns:
            try:
                check_result = await conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'drive_applications' AND column_name = '{col_name}'
                """))
                if not check_result.fetchone():
                    await conn.execute(text(
                        f"ALTER TABLE drive_applications ADD COLUMN {col_name} {col_type}"
                    ))
                    print(f"Added drive_applications column: {col_name}")
            except Exception as e:
                print(f"Drive applications column migration for {col_name}: {e}")

        # Backfill interview session defaults (best-effort)
        try:
            await conn.execute(text("""
                UPDATE interview_sessions
                SET mode = 'TEXT'
                WHERE mode IS NULL OR mode = ''
            """))
            await conn.execute(text("""
                UPDATE interview_sessions
                SET difficulty = 'MEDIUM'
                WHERE difficulty IS NULL OR difficulty = ''
            """))
            await conn.execute(text("""
                UPDATE interview_sessions
                SET status = 'IN_PROGRESS'
                WHERE status IS NULL OR status = ''
            """))
            await conn.execute(text("""
                UPDATE interview_sessions
                SET status = 'COMPLETED'
                WHERE ended_at IS NOT NULL AND status = 'IN_PROGRESS'
            """))
        except Exception as e:
            print(f"Interview sessions backfill: {e}")
        
        # Sync status with is_active for existing rows (best-effort)
        try:
            await conn.execute(text("SAVEPOINT aptitude_status_backfill"))
            await conn.execute(text("""
                UPDATE aptitude_questions
                SET status = (
                    CASE
                        WHEN is_active = TRUE THEN 'ACTIVE'
                        ELSE 'ARCHIVED'
                    END
                )::questionstatus
                WHERE status IS NULL OR status::text = ''
            """))
            await conn.execute(text("RELEASE SAVEPOINT aptitude_status_backfill"))
        except Exception as e:
            try:
                await conn.execute(text("ROLLBACK TO SAVEPOINT aptitude_status_backfill"))
            except Exception:
                pass
            print(f"Aptitude status backfill: {e}")

        try:
            await conn.execute(text("SAVEPOINT aptitude_approval_backfill"))
            await conn.execute(text("""
                UPDATE aptitude_questions
                SET approval_status = 'APPROVED'::questionapprovalstatus
                WHERE approval_status IS NULL OR approval_status::text = ''
            """))
            await conn.execute(text("RELEASE SAVEPOINT aptitude_approval_backfill"))
        except Exception as e:
            try:
                await conn.execute(text("ROLLBACK TO SAVEPOINT aptitude_approval_backfill"))
            except Exception:
                pass
            print(f"Aptitude approval backfill: {e}")

        # Ensure enum types and align column types (PostgreSQL only)
        try:
            if engine.dialect.name == "postgresql":
                await conn.execute(text("SAVEPOINT aptitude_enum_align"))
                await conn.execute(text("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'questionstatus') THEN
                            CREATE TYPE questionstatus AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'questionapprovalstatus') THEN
                            CREATE TYPE questionapprovalstatus AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
                        END IF;
                        IF NOT EXISTS (
                            SELECT 1
                            FROM pg_enum e
                            JOIN pg_type t ON t.oid = e.enumtypid
                            WHERE t.typname = 'questionapprovalstatus' AND e.enumlabel = 'DRAFT'
                        ) THEN
                            ALTER TYPE questionapprovalstatus ADD VALUE 'DRAFT';
                        END IF;
                    END$$;
                """))

                status_info = await conn.execute(text("""
                    SELECT data_type, udt_name FROM information_schema.columns
                    WHERE table_name = 'aptitude_questions' AND column_name = 'status'
                """))
                status_row = status_info.fetchone()
                if status_row and status_row.data_type == 'character varying':
                    await conn.execute(text("""
                        UPDATE aptitude_questions
                        SET status = UPPER(TRIM(status))
                        WHERE status IS NOT NULL
                    """))
                    await conn.execute(text("""
                        UPDATE aptitude_questions
                        SET status = 'ACTIVE'
                        WHERE status IS NULL OR status = ''
                    """))
                    await conn.execute(text("""
                        ALTER TABLE aptitude_questions
                        ALTER COLUMN status DROP DEFAULT
                    """))
                    await conn.execute(text("""
                        ALTER TABLE aptitude_questions
                        ALTER COLUMN status TYPE questionstatus USING status::questionstatus
                    """))
                    await conn.execute(text("""
                        ALTER TABLE aptitude_questions
                        ALTER COLUMN status SET DEFAULT 'ACTIVE'
                    """))

                approval_info = await conn.execute(text("""
                    SELECT data_type, udt_name FROM information_schema.columns
                    WHERE table_name = 'aptitude_questions' AND column_name = 'approval_status'
                """))
                approval_row = approval_info.fetchone()
                if approval_row and approval_row.data_type == 'character varying':
                    await conn.execute(text("""
                        UPDATE aptitude_questions
                        SET approval_status = UPPER(TRIM(approval_status))
                        WHERE approval_status IS NOT NULL
                    """))
                    await conn.execute(text("""
                        UPDATE aptitude_questions
                        SET approval_status = 'APPROVED'
                        WHERE approval_status IS NULL OR approval_status = ''
                    """))
                    await conn.execute(text("""
                        ALTER TABLE aptitude_questions
                        ALTER COLUMN approval_status DROP DEFAULT
                    """))
                    await conn.execute(text("""
                        ALTER TABLE aptitude_questions
                        ALTER COLUMN approval_status TYPE questionapprovalstatus USING approval_status::questionapprovalstatus
                    """))
                    await conn.execute(text("""
                        ALTER TABLE aptitude_questions
                        ALTER COLUMN approval_status SET DEFAULT 'APPROVED'
                    """))
                await conn.execute(text("RELEASE SAVEPOINT aptitude_enum_align"))
        except Exception as e:
            try:
                await conn.execute(text("ROLLBACK TO SAVEPOINT aptitude_enum_align"))
            except Exception:
                pass
            print(f"Aptitude enum alignment: {e}")

        # Create aptitude question versions table
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS aptitude_question_versions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    question_id UUID NOT NULL REFERENCES aptitude_questions(id) ON DELETE CASCADE,
                    version_number INTEGER NOT NULL,
                    snapshot JSONB NOT NULL,
                    changed_by UUID DEFAULT NULL REFERENCES users(id),
                    change_reason VARCHAR(255) DEFAULT NULL,
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_question_versions_qid ON aptitude_question_versions(question_id)"
            ))
        except Exception as e:
            print(f"Aptitude versions table ensure: {e}")

        # Create aptitude question audit logs table
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS aptitude_question_audit_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    question_id UUID DEFAULT NULL,
                    action VARCHAR(50) NOT NULL,
                    actor_id UUID DEFAULT NULL REFERENCES users(id),
                    before_data JSONB DEFAULT NULL,
                    after_data JSONB DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_question_audit_qid ON aptitude_question_audit_logs(question_id)"
            ))
        except Exception as e:
            print(f"Aptitude audit table ensure: {e}")

        # Create aptitude attempt details table
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS aptitude_attempt_details (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    attempt_id UUID NOT NULL REFERENCES aptitude_attempts(id) ON DELETE CASCADE,
                    question_id UUID DEFAULT NULL REFERENCES aptitude_questions(id) ON DELETE CASCADE,
                    question_text TEXT DEFAULT NULL,
                    options JSONB DEFAULT NULL,
                    generated BOOLEAN DEFAULT FALSE NOT NULL,
                    selected_option VARCHAR(1) DEFAULT NULL,
                    correct_option VARCHAR(1) NOT NULL,
                    is_correct BOOLEAN DEFAULT FALSE NOT NULL,
                    marks INTEGER DEFAULT 1 NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_attempt_details_attempt_id ON aptitude_attempt_details(attempt_id)"
            ))
            # Ensure new columns exist in existing tables
            await conn.execute(text("""
                ALTER TABLE aptitude_attempt_details
                ALTER COLUMN question_id DROP NOT NULL
            """))
        except Exception as e:
            print(f"Aptitude attempt details ensure: {e}")

        # Backfill missing columns for attempt details (best-effort)
        attempt_detail_columns = [
            ("question_text", "TEXT DEFAULT NULL"),
            ("options", "JSONB DEFAULT NULL"),
            ("generated", "BOOLEAN DEFAULT FALSE NOT NULL"),
        ]
        for col_name, col_type in attempt_detail_columns:
            try:
                check_result = await conn.execute(text(f"""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = 'aptitude_attempt_details' AND column_name = '{col_name}'
                """))
                if not check_result.fetchone():
                    await conn.execute(text(
                        f"ALTER TABLE aptitude_attempt_details ADD COLUMN {col_name} {col_type}"
                    ))
                    print(f"Added aptitude_attempt_details column: {col_name}")
            except Exception as e:
                print(f"Aptitude attempt details column migration for {col_name}: {e}")

        # Create interview answers table
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS interview_answers (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    question_number INTEGER NOT NULL,
                    question_text TEXT NOT NULL,
                    answer_text TEXT NOT NULL,
                    evaluation JSONB DEFAULT NULL,
                    overall_score FLOAT DEFAULT 0.0 NOT NULL,
                    relevance_score FLOAT DEFAULT 0.0 NOT NULL,
                    clarity_score FLOAT DEFAULT 0.0 NOT NULL,
                    depth_score FLOAT DEFAULT 0.0 NOT NULL,
                    confidence_score FLOAT DEFAULT 0.0 NOT NULL,
                    feedback TEXT DEFAULT NULL,
                    strengths JSONB DEFAULT NULL,
                    improvements JSONB DEFAULT NULL,
                    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_interview_answers_session_id ON interview_answers(session_id)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_interview_answers_user_id ON interview_answers(user_id)"
            ))
        except Exception as e:
            print(f"Interview answers table ensure: {e}")

        # Backfill: convert legacy PENDING drafts to DRAFT if never submitted
        try:
            if engine.dialect.name == "postgresql":
                await conn.execute(text("SAVEPOINT aptitude_pending_cleanup"))
                await conn.execute(text("""
                    UPDATE aptitude_questions q
                    SET approval_status = 'DRAFT'
                    WHERE q.approval_status::text = 'PENDING'
                      AND q.status::text = 'DRAFT'
                      AND q.approved_by IS NULL
                      AND NOT EXISTS (
                          SELECT 1 FROM aptitude_question_audit_logs l
                          WHERE l.question_id = q.id AND l.action = 'SUBMIT_FOR_APPROVAL'
                      )
                """))
                await conn.execute(text("RELEASE SAVEPOINT aptitude_pending_cleanup"))
        except Exception as e:
            try:
                await conn.execute(text("ROLLBACK TO SAVEPOINT aptitude_pending_cleanup"))
            except Exception:
                pass
            print(f"Aptitude pending cleanup: {e}")
        
        # Ensure resumes table exists (do not drop data)
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS resumes (
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
            print("Resumes table ensured")
        except Exception as e:
            print(f"Resumes table ensure: {e}")


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()
